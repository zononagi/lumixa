import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { DependencyInfo, ProjectHealth } from '@shared/ipc'

/**
 * Project Intelligence — a best-effort, dependency-light scan of the workspace:
 * reads package.json, walks the source tree (skipping node_modules/.git/etc),
 * and counts which declared dependencies are actually imported. Powers the
 * Dependency Explorer + Project Health views. No AI, no network.
 */

const IGNORED = new Set(['node_modules', '.git', 'dist', 'out', '.vite', 'build', 'coverage'])
const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'])
const MAX_FILES = 5000

const BUILTINS = new Set([
  'fs', 'path', 'os', 'http', 'https', 'url', 'crypto', 'stream', 'util', 'events',
  'child_process', 'node:fs', 'node:path', 'node:os', 'node:url', 'node:crypto',
  'assert', 'buffer', 'zlib', 'net', 'tls', 'dns', 'readline', 'process'
])

async function walk(dir: string, out: string[]): Promise<void> {
  if (out.length >= MAX_FILES) return
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(dir, { withFileTypes: true })
  } catch {
    return
  }
  for (const e of entries) {
    if (out.length >= MAX_FILES) return
    if (e.name.startsWith('.') && e.name !== '.') continue
    if (IGNORED.has(e.name)) continue
    const full = join(dir, e.name)
    if (e.isDirectory()) await walk(full, out)
    else {
      const dot = e.name.lastIndexOf('.')
      if (dot >= 0 && CODE_EXT.has(e.name.slice(dot))) out.push(full)
    }
  }
}

/** Extract the package name from an import specifier ('foo/bar' → 'foo', '@a/b/c' → '@a/b'). */
function pkgOf(spec: string): string | null {
  if (spec.startsWith('.') || spec.startsWith('/')) return null
  const parts = spec.split('/')
  return spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

const IMPORT_RE = /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)/g

export async function buildProjectHealth(root: string): Promise<ProjectHealth> {
  let pkgRaw: string
  try {
    pkgRaw = await fs.readFile(join(root, 'package.json'), 'utf-8')
  } catch {
    return {
      isProject: false,
      fileCount: 0,
      dependencies: [],
      unusedDependencies: [],
      missingDependencies: []
    }
  }

  let pkg: { name?: string; dependencies?: Record<string, string>; devDependencies?: Record<string, string> }
  try {
    pkg = JSON.parse(pkgRaw)
  } catch (e) {
    return {
      isProject: true,
      fileCount: 0,
      dependencies: [],
      unusedDependencies: [],
      missingDependencies: [],
      error: `package.json is not valid JSON: ${e instanceof Error ? e.message : String(e)}`
    }
  }

  const deps = pkg.dependencies ?? {}
  const devDeps = pkg.devDependencies ?? {}
  const declared = new Set([...Object.keys(deps), ...Object.keys(devDeps)])

  const files: string[] = []
  await walk(root, files)

  const usage = new Map<string, number>()
  const imported = new Set<string>()
  for (const file of files) {
    let text: string
    try {
      text = await fs.readFile(file, 'utf-8')
    } catch {
      continue
    }
    const seenInFile = new Set<string>()
    let m: RegExpExecArray | null
    IMPORT_RE.lastIndex = 0
    while ((m = IMPORT_RE.exec(text)) !== null) {
      const spec = m[1] ?? m[2] ?? m[3]
      const name = spec ? pkgOf(spec) : null
      if (!name || BUILTINS.has(name)) continue
      imported.add(name)
      if (!seenInFile.has(name)) {
        seenInFile.add(name)
        usage.set(name, (usage.get(name) ?? 0) + 1)
      }
    }
  }

  const dependencies: DependencyInfo[] = [...declared]
    .map((name) => ({
      name,
      version: deps[name] ?? devDeps[name] ?? '',
      dev: !(name in deps),
      usedBy: usage.get(name) ?? 0
    }))
    .sort((a, b) => b.usedBy - a.usedBy || a.name.localeCompare(b.name))

  const unusedDependencies = dependencies
    .filter((d) => !d.dev && d.usedBy === 0)
    .map((d) => d.name)

  const missingDependencies = [...imported]
    .filter((name) => !declared.has(name))
    .sort()

  return {
    isProject: true,
    name: pkg.name,
    fileCount: files.length,
    dependencies,
    unusedDependencies,
    missingDependencies
  }
}
