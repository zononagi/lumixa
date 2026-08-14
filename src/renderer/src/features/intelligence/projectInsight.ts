/**
 * Project Intelligence helpers (spec §14, §15, §38, §66, §67). Pure, tested
 * heuristics — no AI — used by Project Onboarding to tell a beginner what a
 * project is and where to start.
 */

/** Infer a friendly project-type label from the declared dependency names. */
export function detectProjectType(depNames: string[]): string {
  const has = (n: string): boolean => depNames.includes(n)
  const ts = has('typescript')
  const suffix = ts ? ' + TypeScript' : ''

  if (has('next')) return `Next.js${suffix}`
  if (has('electron')) return `Electron${suffix}`
  if (has('react-native') || has('expo')) return `React Native${suffix}`
  if (has('react')) return `React${suffix}`
  if (has('vue')) return `Vue${suffix}`
  if (has('svelte')) return `Svelte${suffix}`
  if (has('@angular/core')) return 'Angular'
  if (has('express') || has('fastify') || has('koa')) return `Node.js API${suffix}`
  if (has('vite')) return `Vite${suffix}`
  if (ts) return 'TypeScript'
  return 'JavaScript / Node.js'
}

/** Candidate entry-point files, most-likely first. The caller filters to those
 *  that actually exist (§14: never assume a structure that isn't there). */
export function entryPointCandidates(): string[] {
  return [
    'src/main.tsx',
    'src/main.ts',
    'src/index.tsx',
    'src/index.ts',
    'src/App.tsx',
    'src/app.tsx',
    'index.ts',
    'index.js',
    'main.py',
    'app.py',
    'main.go'
  ]
}

/** Explain the purpose of a directory/file from common naming conventions. */
export function describePath(relPath: string): string | undefined {
  const p = relPath.replace(/\\/g, '/').toLowerCase()
  const table: { re: RegExp; desc: string }[] = [
    { re: /(^|\/)components?(\/|$)/, desc: 'UI components' },
    { re: /(^|\/)pages?(\/|$)/, desc: 'Application pages / routes' },
    { re: /(^|\/)(services?|api)(\/|$)/, desc: 'API / external service calls' },
    { re: /(^|\/)hooks?(\/|$)/, desc: 'Reusable React hooks' },
    { re: /(^|\/)stores?(\/|$)/, desc: 'State management' },
    { re: /(^|\/)(types?|models?)(\/|$)/, desc: 'Type / data definitions' },
    { re: /(^|\/)(utils?|lib|helpers?)(\/|$)/, desc: 'Utility / helper functions' },
    { re: /(^|\/)(styles?|css)(\/|$)/, desc: 'Styles' },
    { re: /(^|\/)(tests?|__tests__|spec)(\/|$)/, desc: 'Tests' },
    { re: /(^|\/)assets?(\/|$)/, desc: 'Static assets' },
    { re: /\.test\.[jt]sx?$/, desc: 'A test file' },
    { re: /(^|\/)main\.[jt]sx?$/, desc: 'Application entry point' }
  ]
  for (const { re, desc } of table) if (re.test(p)) return desc
  return undefined
}
