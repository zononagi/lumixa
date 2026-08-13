/**
 * Secret redaction for anything Lumixa might log or surface from a child
 * process. Best-effort defense-in-depth: the agent CLI owns the real secrets,
 * but we never want a token echoed into a stderr line to reach a log file.
 */

const PATTERNS: Array<[RegExp, string]> = [
  // Anthropic API keys and OAuth-style tokens.
  [/sk-ant-[A-Za-z0-9_-]{10,}/g, 'sk-ant-***'],
  [/\b(oauth|session|refresh|access)[-_]?tokens?["'\s:=]+[A-Za-z0-9._-]{12,}/gi, '$1_token=***'],
  // Bearer headers.
  [/Bearer\s+[A-Za-z0-9._-]{12,}/gi, 'Bearer ***'],
  // key/secret/password = value assignments.
  [/\b(api[_-]?key|secret|password|passwd|pwd)["'\s:=]+[^\s"']{6,}/gi, '$1=***'],
  // Long hex/base64 blobs that look like credentials (24+ chars).
  [/\b[A-Fa-f0-9]{32,}\b/g, '***'],
  // Cookie headers.
  [/\bCookie:\s*[^\n]+/gi, 'Cookie: ***']
]

export function redactSecrets(input: string): string {
  let out = input
  for (const [re, replacement] of PATTERNS) out = out.replace(re, replacement)
  return out
}
