import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import type { EnvToolStatus } from '@shared/ipc'

/**
 * Environment Doctor (spec §9–§11). Detects whether the common developer tools a
 * project might need are installed and on PATH, and reads their version — but
 * NEVER installs or changes anything (§10): it only reports, so the user stays in
 * control. PATH problems surface as "installed but not found" naturally, because
 * detection uses the same PATH the app was launched with.
 */

const pexec = promisify(execFile)

interface ToolSpec {
  id: string
  name: string
  /** Command + arg that prints a version. */
  cmd: string
  args: string[]
  /** A one-line beginner explanation of what the tool is (shown if missing). */
  whatJa: string
  whatEn: string
}

const TOOLS: ToolSpec[] = [
  {
    id: 'node',
    name: 'Node.js',
    cmd: 'node',
    args: ['--version'],
    whatJa: 'ブラウザの外で JavaScript を実行するための環境です。',
    whatEn: 'Lets JavaScript run outside a browser.'
  },
  {
    id: 'npm',
    name: 'npm',
    cmd: 'npm',
    args: ['--version'],
    whatJa: 'Node.js のパッケージ（ライブラリ）管理ツールです。',
    whatEn: "Node.js's package (library) manager."
  },
  {
    id: 'git',
    name: 'Git',
    cmd: 'git',
    args: ['--version'],
    whatJa: 'コードの変更履歴を管理するバージョン管理ツールです。',
    whatEn: 'Version control for tracking code changes.'
  },
  {
    id: 'python',
    name: 'Python',
    cmd: process.platform === 'win32' ? 'python' : 'python3',
    args: ['--version'],
    whatJa: 'Python のスクリプトを実行するための言語ランタイムです。',
    whatEn: 'The runtime for running Python scripts.'
  },
  {
    id: 'pnpm',
    name: 'pnpm',
    cmd: 'pnpm',
    args: ['--version'],
    whatJa: '高速な代替パッケージマネージャです。',
    whatEn: 'A fast alternative package manager.'
  },
  {
    id: 'yarn',
    name: 'Yarn',
    cmd: 'yarn',
    args: ['--version'],
    whatJa: '代替パッケージマネージャです。',
    whatEn: 'An alternative package manager.'
  }
]

function parseVersion(raw: string): string | undefined {
  const m = raw.match(/(\d+\.\d+\.\d+)/)
  return m ? m[1] : raw.trim().split(/\r?\n/)[0] || undefined
}

async function detectOne(tool: ToolSpec): Promise<EnvToolStatus> {
  try {
    const { stdout, stderr } = await pexec(tool.cmd, tool.args, {
      windowsHide: true,
      timeout: 8000,
      // .cmd shims (npm/pnpm/yarn on Windows) need a shell to resolve.
      shell: process.platform === 'win32'
    })
    return {
      id: tool.id,
      name: tool.name,
      installed: true,
      version: parseVersion(stdout || stderr),
      whatJa: tool.whatJa,
      whatEn: tool.whatEn
    }
  } catch {
    return {
      id: tool.id,
      name: tool.name,
      installed: false,
      whatJa: tool.whatJa,
      whatEn: tool.whatEn
    }
  }
}

/** Detect all known tools in parallel. Never throws. */
export async function checkEnvironment(): Promise<EnvToolStatus[]> {
  return Promise.all(TOOLS.map(detectOne))
}
