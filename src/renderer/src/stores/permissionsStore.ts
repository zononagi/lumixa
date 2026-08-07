import { create } from 'zustand'

/**
 * Permission management. Coarse-grained policies gate the capabilities that can
 * affect the user's machine: writing files (Composer apply / AI edits) and
 * running shell commands (terminal / AI). Each policy is allow / ask / deny.
 *
 * `ensure(cap)` returns true when the action may proceed. For 'ask' it shows a
 * confirm dialog; for 'deny' it always blocks.
 */
export type Policy = 'allow' | 'ask' | 'deny'
export type Capability = 'fileWrite' | 'runCommand' | 'network'

interface PermissionsState {
  policies: Record<Capability, Policy>
  set: (cap: Capability, policy: Policy) => void
  ensure: (cap: Capability, detail: string) => boolean
}

const KEY = 'lumixa.permissions'
const DEFAULTS: Record<Capability, Policy> = {
  // Ordinary commands run freely by default; dangerous ones still prompt via the
  // separate danger heuristic. Tighten to 'ask'/'deny' in Settings.
  fileWrite: 'allow',
  runCommand: 'allow',
  network: 'allow'
}

const LABELS: Record<Capability, string> = {
  fileWrite: 'write files',
  runCommand: 'run a command',
  network: 'access the network'
}

function load(): Record<Capability, Policy> {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Record<Capability, Policy>) }
  } catch {
    /* ignore */
  }
  return { ...DEFAULTS }
}

export const usePermissionsStore = create<PermissionsState>((setState, get) => ({
  policies: load(),

  set: (cap, policy) => {
    setState((s) => {
      const policies = { ...s.policies, [cap]: policy }
      localStorage.setItem(KEY, JSON.stringify(policies))
      return { policies }
    })
  },

  ensure: (cap, detail) => {
    const policy = get().policies[cap]
    if (policy === 'deny') {
      // eslint-disable-next-line no-alert
      window.alert(`Blocked by permissions: Lumixa may not ${LABELS[cap]}.\n\n${detail}`)
      return false
    }
    if (policy === 'ask') {
      // eslint-disable-next-line no-alert
      return window.confirm(`Allow Lumixa to ${LABELS[cap]}?\n\n${detail}`)
    }
    return true
  }
}))
