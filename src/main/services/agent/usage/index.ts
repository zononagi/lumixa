import type { UsageStatus } from '@shared/usage'
import { ClaudeCodeUsageProvider } from './claudeCodeUsage'
import type { UsageProvider } from './types'

/** Singleton usage provider (only Claude Code today). */
const provider: UsageProvider = new ClaudeCodeUsageProvider()

export function getUsage(): Promise<UsageStatus> {
  return provider.getUsage()
}

export { ingestUsageLine } from './signalStore'
