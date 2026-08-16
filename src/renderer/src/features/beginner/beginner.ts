import { explainCommand } from '@renderer/lib/explainCommand'
import { checkDanger } from '@renderer/lib/danger'

/**
 * Beginner Assistant helpers (spec §38-§39). Thin, tested composition over the
 * existing command explainer + danger detector — no duplicated logic. The panel
 * reuses errorExplainer for the error-translation half.
 */
export interface CommandHelp {
  explanation: string | undefined
  dangerous: boolean
  reason?: string
  /** True when Lumixa recognises the command (has a plain-language explanation). */
  known: boolean
}

export function commandHelp(command: string, locale: 'ja' | 'en'): CommandHelp {
  const explanation = explainCommand(command, locale)
  const d = checkDanger(command)
  return { explanation, dangerous: d.dangerous, reason: d.reason, known: explanation !== undefined }
}

/** The install command for a detected package manager (defaults to npm). */
export function installCommandFor(packageManager: string | undefined): string {
  switch (packageManager) {
    case 'pnpm':
      return 'pnpm install'
    case 'yarn':
      return 'yarn'
    case 'bun':
      return 'bun install'
    default:
      return 'npm install'
  }
}
