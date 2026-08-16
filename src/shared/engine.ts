/**
 * Shared contract for the Autonomous Development Engine's verification + self-
 * healing layer. Dependency-free (types + constants only) so main and renderer
 * stay in sync.
 *
 * Self-Healing (spec §18–§21): when a verification step (typecheck / test /
 * build / lint) fails, Lumixa routes the captured error to the user's Claude
 * Code CLI with a fix prompt, re-verifies, and loops — bounded by a max attempt
 * count so it can never run away.
 */

/** npm scripts the engine knows how to run as verification gates. */
export type VerifyScript = 'typecheck' | 'test' | 'build' | 'lint'

export const VERIFY_SCRIPTS: VerifyScript[] = ['typecheck', 'test', 'build', 'lint']

/** Which known verification scripts actually exist in this project. */
export interface AvailableScripts {
  isProject: boolean
  available: VerifyScript[]
}

export interface VerifyResult {
  script: VerifyScript
  /** Process exit code (null when spawn failed or was killed). */
  code: number | null
  ok: boolean
  /** Tail of combined stdout+stderr (capped), safe for display + Claude prompt. */
  output: string
  durationMs: number
  timedOut: boolean
}

/** Hard ceiling on automatic repair attempts (spec §20 — no infinite loops). */
export const MAX_HEAL_ATTEMPTS = 3
