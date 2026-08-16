/**
 * Shared contract for the Project Creation Engine. Dependency-free (types +
 * template catalog metadata) so main (which scaffolds files) and renderer (the
 * wizard) agree. Actual template file contents live in the main scaffold service.
 */

export type TemplateKind = 'web' | 'node'

export interface ProjectTemplate {
  id: string
  name: string
  description: string
  kind: TemplateKind
}

/** Built-in templates. Extensible: add an entry here + a generator in scaffold.ts. */
export const PROJECT_TEMPLATES: ProjectTemplate[] = [
  {
    id: 'react-ts-vite',
    name: 'React + TypeScript + Vite',
    description: 'A fast modern web app (recommended for most web projects).',
    kind: 'web'
  },
  {
    id: 'node-ts',
    name: 'Node.js + TypeScript',
    description: 'A CLI, server, script or bot backend.',
    kind: 'node'
  }
]

export interface ScaffoldPlan {
  /** Absolute path of the folder to create the project in (must be empty/new). */
  targetDir: string
  /** Project name (used in package.json + README). */
  name: string
  templateId: string
  /** Feature labels captured from the description (README + Claude prompt). */
  features: string[]
}

export interface ScaffoldResult {
  ok: boolean
  /** Beginner-friendly outcome (never a raw stack trace). */
  message: string
  /** Absolute project root, when created. */
  root?: string
  /** Rel paths of the files written. */
  files: string[]
}
