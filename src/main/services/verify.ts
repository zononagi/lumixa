import { spawn } from 'node:child_process'
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import type { AvailableScripts, VerifyResult, VerifyScript } from '@shared/engine'
import { VERIFY_SCRIPTS } from '@shared/engine'

/**
 * Verification runner for the Self-Healing Engine. Runs a project's npm scripts
 * (typecheck / test / build / lint) as one-shot child processes and captures
 * their combined output. Deliberately limited to these named scripts — it never
 * runs arbitrary or destructive commands (spec §21).
 */

const OUTPUT_TAIL = 24_000
const DEFAULT_TIMEOUT = 8 * 60_000

function tail(s: string): string {
  return s.length > OUTPUT_TAIL ? '…(truncated)…\n' + s.slice(-OUTPUT_TAIL) : s
}

/** Report which known verification scripts the project actually defines. */
export async function listScripts(root: string): Promise<AvailableScripts> {
  try {
    const raw = await fs.readFile(join(root, 'package.json'), 'utf-8')
    const pkg = JSON.parse(raw) as { scripts?: Record<string, string> }
    const scripts = pkg.scripts ?? {}
    return {
      isProject: true,
      available: VERIFY_SCRIPTS.filter((s) => typeof scripts[s] === 'string')
    }
  } catch {
    return { isProject: false, available: [] }
  }
}

/** Run a single verification script and capture its result. Never throws. */
export function runScript(
  root: string,
  script: VerifyScript,
  timeoutMs = DEFAULT_TIMEOUT
): Promise<VerifyResult> {
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32'
    const start = Date.now()
    let out = ''
    let timedOut = false
    let settled = false

    const done = (code: number | null): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({
        script,
        code,
        ok: code === 0 && !timedOut,
        output: tail(out) || '(no output)',
        durationMs: Date.now() - start,
        timedOut
      })
    }

    let child: ReturnType<typeof spawn>
    try {
      // `npm run <script>` — shell:true on Windows so npm.cmd resolves via PATH.
      child = spawn(isWin ? 'npm.cmd' : 'npm', ['run', script], {
        cwd: root,
        shell: isWin,
        windowsHide: true,
        env: process.env
      })
    } catch (e) {
      out += `Failed to start npm: ${e instanceof Error ? e.message : String(e)}`
      done(null)
      return
    }

    const timer = setTimeout(() => {
      timedOut = true
      out += '\n[verification timed out]'
      child.kill()
    }, timeoutMs)

    child.stdout?.setEncoding('utf-8')
    child.stderr?.setEncoding('utf-8')
    child.stdout?.on('data', (d: string) => (out += d))
    child.stderr?.on('data', (d: string) => (out += d))
    child.on('error', (err) => {
      out += `\n[spawn error] ${err.message}`
      done(null)
    })
    child.on('close', (code) => done(code))
  })
}
