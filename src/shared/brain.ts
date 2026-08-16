/**
 * Shared contract for the Project Brain — Lumixa's structural understanding of
 * the open workspace. Dependency-free (types + tiny constants only) so both the
 * main process (which builds the index) and the renderer (which renders it) can
 * import it without drift.
 *
 * The Brain is the foundation of the Autonomous Development Engine: every later
 * subsystem (Change Impact, Watcher, Bug Detective, Goal Mode…) reads from it.
 * It is produced by static analysis alone — no AI, no network — so it works even
 * when Claude Code is unavailable (graceful degradation).
 */

/** A single source file as understood by the Brain. */
export interface BrainFileNode {
  /** Absolute path on disk. */
  path: string
  /** Path relative to the workspace root, POSIX-separated (graph key). */
  rel: string
  ext: string
  /** Line count (0 for files whose content was skipped, e.g. secrets). */
  loc: number
  /** Internal dependencies: rel paths of workspace files this file imports. */
  imports: string[]
  /** External npm packages imported (bare specifiers, scope-aware). */
  packages: string[]
  /** Best-effort exported symbol names. */
  exports: string[]
  kind: 'component' | 'test' | 'config' | 'style' | 'doc' | 'source'
}

/** High-level, human-readable read on the project's stack and shape. */
export interface ProjectSummary {
  framework?: string
  language?: string
  build?: string
  state?: string
  testing?: string
  ui?: string
  packageManager?: string
  backend?: string
  runtime?: string
  architecture?: string
}

export interface BrainStats {
  files: number
  components: number
  tests: number
  /** Declared dependencies (deps + devDeps) from package.json. */
  dependencies: number
  /** Internal file→file edges in the dependency graph. */
  internalEdges: number
  loc: number
  /** Epoch ms of the most recent (re)index. */
  lastIndexed: number
}

export interface ProjectBrain {
  root: string
  name?: string
  isProject: boolean
  summary: ProjectSummary
  stats: BrainStats
  files: BrainFileNode[]
  /** Files the indexer skipped reading because they look secret (spec §50). */
  skippedSecrets: string[]
}

export type RiskLevel = 'low' | 'medium' | 'high'

/** Change Impact Radar result for a single target file. */
export interface ImpactResult {
  /** Target rel path. */
  target: string
  /** Files that import the target directly (rel paths). */
  direct: string[]
  /** Files transitively affected (rel paths, excludes direct + target). */
  indirect: string[]
  /** Affected test files among direct+indirect. */
  affectedTests: string[]
  /** External API/contract touch points among affected files (best-effort). */
  affectedPackages: string[]
  riskScore: number
  riskLevel: RiskLevel
  /** True when the target lives in a critical area (auth/db/payments/…). */
  critical: boolean
  /** Plain-language reasons behind the score (spec §45 explainability). */
  reasons: string[]
}

/** Directory/file names never walked during indexing. */
export const BRAIN_IGNORED_DIRS = [
  'node_modules',
  '.git',
  'dist',
  'out',
  '.vite',
  'build',
  'coverage',
  '.next',
  '.turbo',
  '.cache'
] as const

/** Path fragments that mark critical, high-risk areas (spec §37). */
export const CRITICAL_AREA_PATTERNS = [
  'auth',
  'login',
  'session',
  'token',
  'payment',
  'billing',
  'checkout',
  'database',
  'migration',
  'schema',
  'secret',
  'credential',
  'security',
  'permission'
] as const
