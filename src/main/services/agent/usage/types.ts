import type { UsageStatus } from '@shared/usage'

/**
 * Usage-source abstraction (spec §18). Keeps usage acquisition independent of
 * the rest of the app: if Claude Code ever ships an official usage API/CLI, only
 * a new provider implementation is needed — nothing else changes.
 */
export interface UsageProvider {
  readonly id: string
  /** Whether this provider can currently produce any usage data at all. */
  isSupported(): Promise<boolean>
  /** Best-effort current usage. Must never fabricate figures. */
  getUsage(): Promise<UsageStatus>
  /** Local timestamp (ms) of the last successful read, 0 if never. */
  getLastUpdated(): number
}
