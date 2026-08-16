import { CRITICAL_AREA_PATTERNS } from '@shared/brain'
import type { BrainFileNode } from '@shared/brain'

/**
 * Pure static-analysis helpers for the Project Brain. No filesystem, no state —
 * everything here is deterministic and unit-tested. The Brain service composes
 * these over the walked file set.
 */

const IMPORT_RE =
  /(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|require\(\s*['"]([^'"]+)['"]\s*\)|import\(\s*['"]([^'"]+)['"]\s*\)/g

const EXPORT_NAMED_RE = /export\s+(?:const|let|var|function|class|interface|type|enum)\s+([A-Za-z_$][\w$]*)/g
const EXPORT_LIST_RE = /export\s*\{([^}]*)\}/g

const CODE_EXT = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte'])
/** Extensions tried when resolving an extensionless relative import. */
const RESOLVE_EXT = ['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.svelte', '.json']

const NODE_BUILTINS = new Set([
  'fs', 'path', 'os', 'http', 'https', 'url', 'crypto', 'stream', 'util', 'events',
  'child_process', 'assert', 'buffer', 'zlib', 'net', 'tls', 'dns', 'readline', 'process'
])

const SECRET_RE = /(^|\/)(\.env(\.|$)|.*\.(pem|key|p12|pfx)$|.*(secret|credential|token)s?\.[\w]+$)/i

export function isCodeFile(rel: string): boolean {
  const dot = rel.lastIndexOf('.')
  return dot >= 0 && CODE_EXT.has(rel.slice(dot))
}

/** True for files whose *contents* must never be read into an AI context. */
export function isSecretPath(rel: string): boolean {
  return SECRET_RE.test(rel)
}

/** True when a file sits in a critical, high-risk area (auth/db/payments/…). */
export function isCriticalPath(rel: string): boolean {
  const lower = rel.toLowerCase()
  return CRITICAL_AREA_PATTERNS.some((p) => lower.includes(p))
}

/** Package name from a bare specifier: 'a/b'→'a', '@s/p/x'→'@s/p'. */
export function packageOf(spec: string): string | null {
  if (spec.startsWith('.') || spec.startsWith('/')) return null
  const bare = spec.startsWith('node:') ? spec.slice(5) : spec
  if (NODE_BUILTINS.has(bare)) return null
  const parts = bare.split('/')
  return bare.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
}

export interface ParsedImports {
  /** Relative specifiers as written (e.g. './x', '../y'). */
  relative: string[]
  /** External package names (deduped). */
  packages: string[]
}

export function parseImports(text: string): ParsedImports {
  const relative: string[] = []
  const packages = new Set<string>()
  let m: RegExpExecArray | null
  IMPORT_RE.lastIndex = 0
  while ((m = IMPORT_RE.exec(text)) !== null) {
    const spec = m[1] ?? m[2] ?? m[3]
    if (!spec) continue
    if (spec.startsWith('.') || spec.startsWith('/')) {
      relative.push(spec)
    } else {
      const pkg = packageOf(spec)
      if (pkg) packages.add(pkg)
    }
  }
  return { relative, packages: [...packages] }
}

export function parseExports(text: string): string[] {
  const names = new Set<string>()
  let m: RegExpExecArray | null
  EXPORT_NAMED_RE.lastIndex = 0
  while ((m = EXPORT_NAMED_RE.exec(text)) !== null) names.add(m[1])
  EXPORT_LIST_RE.lastIndex = 0
  while ((m = EXPORT_LIST_RE.exec(text)) !== null) {
    for (const part of m[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim()
      if (/^[A-Za-z_$][\w$]*$/.test(name)) names.add(name)
    }
  }
  if (/export\s+default/.test(text)) names.add('default')
  return [...names]
}

// ---------------------------------------------------------------------------
// POSIX-ish path math (works on rel paths regardless of host separator)
// ---------------------------------------------------------------------------

/** Normalize slashes to POSIX and collapse `.`/`..` segments. */
export function toPosix(p: string): string {
  return p.replace(/\\/g, '/')
}

function dirOf(rel: string): string {
  const i = rel.lastIndexOf('/')
  return i < 0 ? '' : rel.slice(0, i)
}

function joinNormalize(base: string, spec: string): string {
  const segs = (base ? base.split('/') : []).concat(spec.split('/'))
  const out: string[] = []
  for (const s of segs) {
    if (s === '' || s === '.') continue
    if (s === '..') out.pop()
    else out.push(s)
  }
  return out.join('/')
}

/**
 * Resolve a relative import specifier against the set of known workspace files.
 * Returns the matched rel path, or null when it points outside the indexed set
 * (e.g. an asset, or a file above MAX_FILES).
 */
export function resolveRelative(
  importerRel: string,
  spec: string,
  fileSet: ReadonlySet<string>
): string | null {
  const base = joinNormalize(dirOf(toPosix(importerRel)), toPosix(spec))
  if (fileSet.has(base)) return base
  for (const ext of RESOLVE_EXT) {
    if (fileSet.has(base + ext)) return base + ext
  }
  for (const ext of RESOLVE_EXT) {
    const idx = `${base}/index${ext}`
    if (fileSet.has(idx)) return idx
  }
  return null
}

// ---------------------------------------------------------------------------
// File classification
// ---------------------------------------------------------------------------

const CONFIG_NAMES = /(^|\/)(package\.json|tsconfig[\w.-]*\.json|vite\.config\.[jt]s|.*\.config\.[jt]s|\.eslintrc[\w.]*|\.prettierrc[\w.]*|electron-builder\.ya?ml|\.gitignore)$/i

export function classifyKind(rel: string, text: string): BrainFileNode['kind'] {
  const lower = rel.toLowerCase()
  if (/\.(test|spec)\.[\w]+$/.test(lower) || /(^|\/)__tests__\//.test(lower)) return 'test'
  if (/\.(css|scss|sass|less)$/.test(lower)) return 'style'
  if (/\.(md|mdx)$/.test(lower)) return 'doc'
  if (CONFIG_NAMES.test(rel) || /\.(json|ya?ml|toml)$/.test(lower)) return 'config'
  const base = rel.split('/').pop() ?? rel
  const isPascal = /^[A-Z][A-Za-z0-9]*\.(t|j)sx?$/.test(base)
  if ((base.endsWith('.tsx') || base.endsWith('.jsx') || base.endsWith('.vue') || base.endsWith('.svelte')) &&
      (isPascal || /return\s*\(|<[A-Z][\w]*[\s/>]/.test(text))) {
    return 'component'
  }
  return 'source'
}

export function countLines(text: string): number {
  if (!text) return 0
  let n = 1
  for (let i = 0; i < text.length; i++) if (text.charCodeAt(i) === 10) n++
  return n
}
