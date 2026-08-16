import type { BrainFileNode, ProjectSummary } from '@shared/brain'

/**
 * Derive a human-readable project summary (spec §9) from the declared
 * dependencies, lockfiles and file layout. Pure and dependency-light so it can
 * be unit-tested and run without Claude Code.
 */

interface Flags {
  hasTsconfig: boolean
  /** Basenames of lockfiles found at the root. */
  lockfiles: string[]
}

/** First dependency in `candidates` that is declared → its label. */
function pick(declared: ReadonlySet<string>, candidates: [string, string][]): string | undefined {
  for (const [dep, label] of candidates) if (declared.has(dep)) return label
  return undefined
}

export function detectSummary(
  declared: ReadonlySet<string>,
  files: BrainFileNode[],
  flags: Flags
): ProjectSummary {
  const rels = files.map((f) => f.rel)
  const has = (p: string): boolean => rels.some((r) => r.startsWith(p))

  const framework = pick(declared, [
    ['next', 'Next.js'],
    ['@angular/core', 'Angular'],
    ['react', 'React'],
    ['vue', 'Vue'],
    ['svelte', 'Svelte'],
    ['solid-js', 'Solid']
  ])

  const build = pick(declared, [
    ['electron-vite', 'electron-vite'],
    ['next', 'Next.js'],
    ['vite', 'Vite'],
    ['webpack', 'Webpack'],
    ['rollup', 'Rollup'],
    ['parcel', 'Parcel'],
    ['esbuild', 'esbuild']
  ])

  const state = pick(declared, [
    ['zustand', 'Zustand'],
    ['@reduxjs/toolkit', 'Redux Toolkit'],
    ['redux', 'Redux'],
    ['jotai', 'Jotai'],
    ['recoil', 'Recoil'],
    ['mobx', 'MobX'],
    ['valtio', 'Valtio']
  ])

  const testing = pick(declared, [
    ['vitest', 'Vitest'],
    ['jest', 'Jest'],
    ['@playwright/test', 'Playwright'],
    ['cypress', 'Cypress'],
    ['mocha', 'Mocha']
  ])

  const ui = pick(declared, [
    ['@mui/material', 'MUI'],
    ['antd', 'Ant Design'],
    ['@chakra-ui/react', 'Chakra UI'],
    ['@mantine/core', 'Mantine'],
    ['tailwindcss', 'Tailwind CSS'],
    ['bootstrap', 'Bootstrap']
  ])

  const backend = pick(declared, [
    ['@nestjs/core', 'NestJS'],
    ['express', 'Express'],
    ['fastify', 'Fastify'],
    ['koa', 'Koa'],
    ['hono', 'Hono']
  ])

  const language = flags.hasTsconfig || declared.has('typescript') ? 'TypeScript' : 'JavaScript'

  const runtime = declared.has('electron')
    ? 'Electron (desktop)'
    : declared.has('react-native') || declared.has('expo')
      ? 'React Native (mobile)'
      : framework
        ? 'Web'
        : 'Node.js'

  let packageManager: string | undefined
  if (flags.lockfiles.includes('pnpm-lock.yaml')) packageManager = 'pnpm'
  else if (flags.lockfiles.includes('yarn.lock')) packageManager = 'yarn'
  else if (flags.lockfiles.includes('bun.lockb')) packageManager = 'bun'
  else if (flags.lockfiles.includes('package-lock.json')) packageManager = 'npm'

  const architecture = has('src/features/')
    ? 'Feature-based'
    : has('src/pages/') || has('src/components/')
      ? 'Layered'
      : 'Flat'

  return {
    framework,
    language,
    build,
    state,
    testing,
    ui,
    packageManager,
    backend,
    runtime,
    architecture
  }
}
