/**
 * Heuristic detection of destructive / dangerous shell commands. Used to gate
 * command execution in the terminal behind a confirmation dialog.
 *
 * This is intentionally conservative — it errs toward asking. It is a safety
 * prompt, not a security boundary.
 */
const PATTERNS: { re: RegExp; reason: string }[] = [
  { re: /\brm\s+(-[a-z]*r[a-z]*f|-[a-z]*f[a-z]*r)\b/i, reason: 'Recursive force delete (rm -rf)' },
  { re: /\brm\s+-[a-z]*r\b/i, reason: 'Recursive delete (rm -r)' },
  { re: /\bRemove-Item\b.*(-Recurse|-Force)/i, reason: 'PowerShell Remove-Item -Recurse/-Force' },
  { re: /\b(rd|rmdir)\s+\/s\b/i, reason: 'Recursive directory removal' },
  { re: /\bdel\s+\/[sq]\b/i, reason: 'Force/recursive del' },
  { re: /\bformat\s+[a-z]:/i, reason: 'Disk format' },
  { re: /\b(mkfs|dd)\b/i, reason: 'Low-level disk write' },
  { re: /\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|push\s+.*--force)/i, reason: 'Destructive git operation' },
  { re: />\s*\/dev\/sd[a-z]/i, reason: 'Raw device write' },
  { re: /:\(\)\s*\{.*\};\s*:/, reason: 'Fork bomb' },
  { re: /\bshutdown\b|\breboot\b|\bhalt\b/i, reason: 'System power state change' },
  { re: /\bcurl\b.*\|\s*(sh|bash|powershell|iex)/i, reason: 'Piping remote script to a shell' },
  { re: /\bInvoke-Expression\b|\biex\b/i, reason: 'Dynamic code execution (iex)' }
]

export interface DangerVerdict {
  dangerous: boolean
  reason?: string
}

export function checkDanger(command: string): DangerVerdict {
  for (const { re, reason } of PATTERNS) {
    if (re.test(command)) return { dangerous: true, reason }
  }
  return { dangerous: false }
}
