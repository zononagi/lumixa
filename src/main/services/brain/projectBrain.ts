import { promises as fs } from 'node:fs'
import { join, relative } from 'node:path'
import type { BrainFileNode, ImpactResult, ProjectBrain } from '@shared/brain'
import { BRAIN_IGNORED_DIRS } from '@shared/brain'
import {
  classifyKind,
  countLines,
  isCodeFile,
  isSecretPath,
  parseExports,
  parseImports,
  resolveRelative,
  toPosix
} from './analyze'
import { detectSummary } from './summary'
import { computeImpact } from './impact'

/**
 * ProjectBrainService — Lumixa's structural understanding of the open workspace
 * (spec §4–§9). Walks the source tree once, builds a file dependency graph and a
 * stack summary by static analysis (no AI, no network), then maintains it
 * incrementally as files change. Everything is held in memory, keyed by root.
 *
 * Kept deliberately separate from the AI runtime so the Brain works even when
 * Claude Code is unavailable (graceful degradation, spec §55).
 */

const IGNORED = new Set<string>(BRAIN_IGNORED_DIRS)
const INDEX_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte',
  '.css', '.scss', '.sass', '.less', '.md', '.mdx', '.json', '.yaml', '.yml'
])
const MAX_FILES = 6000
const MAX_READ_BYTES = 512 * 1024

interface Store {
  brain: ProjectBrain
}

/** In-memory Brain per workspace root. */
const stores = new Map<string, Store>()

function extOf(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i) : ''
}

async function walk(root: string, dir: string, out: string[]): Promise<void> {
  if (out.length >= MAX_FILES) return
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (out.length >= MAX_FILES) return
    if (IGNORED.has(e.name)) continue
    // Skip hidden files/dirs, but keep .env* so they can be flagged as secrets.
    if (e.name.startsWith('.') && !e.name.startsWith('.env')) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) {
      await walk(root, full, out)
    } else if (INDEX_EXT.has(extOf(e.name)) || isSecretPath(e.name)) {
      out.push(full)
    }
  }
}

async function readSafe(path: string): Promise<string | null> {
  try {
    const stat = await fs.stat(path)
    if (stat.size > MAX_READ_BYTES) return ''
    return await fs.readFile(path, 'utf-8')
  } catch {
    return null
  }
}

/** Parse one file into a node (imports left unresolved — done in a second pass). */
async function analyzeFile(
  root: string,
  abs: string
): Promise<{ node: BrainFileNode; relSpecs: string[]; secret: boolean } | null> {
  const rel = toPosix(relative(root, abs))
  const secret = isSecretPath(rel)
  const content = secret ? '' : await readSafe(abs)
  if (content === null) return null // unreadable / gone
  const code = isCodeFile(rel)
  const parsed = code ? parseImports(content) : { relative: [], packages: [] }
  const node: BrainFileNode = {
    path: abs,
    rel,
    ext: extOf(rel),
    loc: countLines(content),
    imports: [], // resolved later
    packages: parsed.packages,
    exports: code ? parseExports(content) : [],
    kind: classifyKind(rel, content)
  }
  return { node, relSpecs: parsed.relative, secret }
}

function recomputeStats(brain: ProjectBrain): void {
  let components = 0
  let tests = 0
  let loc = 0
  let edges = 0
  for (const f of brain.files) {
    if (f.kind === 'component') components++
    if (f.kind === 'test') tests++
    loc += f.loc
    edges += f.imports.length
  }
  brain.stats = {
    files: brain.files.length,
    components,
    tests,
    dependencies: brain.stats.dependencies,
    internalEdges: edges,
    loc,
    lastIndexed: Date.now()
  }
}

async function readPackageJson(
  root: string
): Promise<{ name?: string; declared: Set<string>; isProject: boolean }> {
  try {
    const raw = await fs.readFile(join(root, 'package.json'), 'utf-8')
    const pkg = JSON.parse(raw) as {
      name?: string
      dependencies?: Record<string, string>
      devDependencies?: Record<string, string>
    }
    const declared = new Set([
      ...Object.keys(pkg.dependencies ?? {}),
      ...Object.keys(pkg.devDependencies ?? {})
    ])
    return { name: pkg.name, declared, isProject: true }
  } catch {
    return { declared: new Set(), isProject: false }
  }
}

async function rootFlags(root: string): Promise<{ hasTsconfig: boolean; lockfiles: string[] }> {
  let names: string[] = []
  try {
    names = await fs.readdir(root)
  } catch {
    /* ignore */
  }
  const lockfiles = names.filter((n) =>
    ['package-lock.json', 'pnpm-lock.yaml', 'yarn.lock', 'bun.lockb'].includes(n)
  )
  return { hasTsconfig: names.some((n) => /^tsconfig.*\.json$/.test(n)), lockfiles }
}

/** Full (re)index of a workspace. Idempotent; replaces any prior Brain. */
export async function indexProject(root: string): Promise<ProjectBrain> {
  const [{ name, declared, isProject }, flags] = await Promise.all([
    readPackageJson(root),
    rootFlags(root)
  ])

  const abs: string[] = []
  await walk(root, root, abs)

  const nodes: BrainFileNode[] = []
  const specsByRel = new Map<string, string[]>()
  const skippedSecrets: string[] = []
  for (const a of abs) {
    const res = await analyzeFile(root, a)
    if (!res) continue
    nodes.push(res.node)
    specsByRel.set(res.node.rel, res.relSpecs)
    if (res.secret) skippedSecrets.push(res.node.rel)
  }

  const fileSet = new Set(nodes.map((n) => n.rel))
  for (const node of nodes) {
    node.imports = resolveAll(node.rel, specsByRel.get(node.rel) ?? [], fileSet)
  }

  const brain: ProjectBrain = {
    root,
    name,
    isProject,
    summary: detectSummary(declared, nodes, flags),
    stats: {
      files: nodes.length,
      components: 0,
      tests: 0,
      dependencies: declared.size,
      internalEdges: 0,
      loc: 0,
      lastIndexed: Date.now()
    },
    files: nodes,
    skippedSecrets
  }
  recomputeStats(brain)
  stores.set(root, { brain })
  return brain
}

function resolveAll(rel: string, specs: string[], fileSet: ReadonlySet<string>): string[] {
  const out = new Set<string>()
  for (const spec of specs) {
    const r = resolveRelative(rel, spec, fileSet)
    if (r && r !== rel) out.add(r)
  }
  return [...out]
}

export function getBrain(root: string): ProjectBrain | null {
  return stores.get(root)?.brain ?? null
}

/**
 * Incrementally reflect a single file change (spec §6). Re-parses just that
 * file and re-resolves its imports against the current set. Adds new files and
 * drops deleted ones. Returns the updated Brain, or null if the root isn't
 * indexed yet (caller should full-index first).
 */
export async function updateFile(root: string, absPath: string): Promise<ProjectBrain | null> {
  const store = stores.get(root)
  if (!store) return null
  const brain = store.brain
  const rel = toPosix(relative(root, absPath))
  // Ignore paths outside the root or in ignored trees.
  if (rel.startsWith('..') || rel.split('/').some((seg) => IGNORED.has(seg))) return brain
  if (!INDEX_EXT.has(extOf(rel))) return brain

  const res = await analyzeFile(root, absPath)
  const idx = brain.files.findIndex((f) => f.rel === rel)

  if (!res) {
    // File is gone — remove it.
    if (idx >= 0) brain.files.splice(idx, 1)
    brain.skippedSecrets = brain.skippedSecrets.filter((s) => s !== rel)
    recomputeStats(brain)
    return brain
  }

  const fileSet = new Set(brain.files.map((f) => f.rel))
  fileSet.add(rel)
  res.node.imports = resolveAll(rel, res.relSpecs, fileSet)
  if (idx >= 0) brain.files[idx] = res.node
  else brain.files.push(res.node)
  if (res.secret && !brain.skippedSecrets.includes(rel)) brain.skippedSecrets.push(rel)
  recomputeStats(brain)
  return brain
}

/** Change Impact Radar for one file. Full-indexes on demand if needed. */
export async function analyzeImpact(root: string, absPath: string): Promise<ImpactResult | null> {
  let brain = getBrain(root)
  if (!brain) brain = await indexProject(root)
  const rel = toPosix(relative(root, absPath))
  if (!brain.files.some((f) => f.rel === rel)) return null
  return computeImpact(brain.files, rel)
}

/** Drop a workspace's Brain (e.g. when the folder is closed). */
export function disposeBrain(root: string): void {
  stores.delete(root)
}
