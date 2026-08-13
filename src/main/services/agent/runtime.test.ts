import { describe, it, expect } from 'vitest'
import type { AgentEvent, AgentSession, ProviderStatus } from '@shared/agent'
import { AgentRuntime } from './runtime'
import { ClaudeCodeProvider } from './providers/claudeCode'
import type { AIProvider, RunSpec, RunSpecInput } from './providers/types'

/**
 * Fake provider whose "process" is a real Node child that echoes canned NDJSON.
 * This exercises the full spawn -> stream -> parse -> dispatch path (and process
 * cleanup) WITHOUT requiring Claude Code to be installed — satisfying the CI
 * requirement for a fake process layer.
 */
class FakeProvider implements AIProvider {
  readonly id = 'fake'
  readonly name = 'Fake'
  private readonly claude = new ClaudeCodeProvider()

  async detect(): Promise<ProviderStatus> {
    return { id: this.id, name: this.name, state: 'authenticated' }
  }

  createRunSpec(input: RunSpecInput): RunSpec {
    const lines = [
      JSON.stringify({
        type: 'system',
        subtype: 'init',
        session_id: input.sessionId,
        model: 'fake-model',
        cwd: input.workspacePath,
        claude_code_version: '0.0.0'
      }),
      JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'hi there' }] } }),
      JSON.stringify({
        type: 'assistant',
        message: { content: [{ type: 'tool_use', id: 't1', name: 'Write', input: { file_path: 'a.txt' } }] }
      }),
      JSON.stringify({
        type: 'result',
        is_error: false,
        result: 'done',
        total_cost_usd: 0,
        duration_ms: 7
      })
    ]
    const payload = lines.join('\n') + '\n'
    const script = `process.stdout.write(${JSON.stringify(payload)})`
    return { command: process.execPath, args: ['-e', script], cwd: input.workspacePath }
  }

  parseLine(line: string): AgentEvent[] {
    return this.claude.parseLine(line)
  }
}

function waitFor(pred: () => boolean, timeoutMs = 8000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const tick = (): void => {
      if (pred()) return resolve()
      if (Date.now() - start > timeoutMs) return reject(new Error('timeout waiting for condition'))
      setTimeout(tick, 20)
    }
    tick()
  })
}

describe('AgentRuntime (fake process)', () => {
  it('streams events and drives session status through a full turn', async () => {
    const events: Array<{ id: string; event: AgentEvent }> = []
    const statuses: AgentSession[] = []
    const rawLines: string[] = []

    const runtime = new AgentRuntime({
      event: (id, event) => events.push({ id, event }),
      sessionUpdate: (session) => statuses.push({ ...session }),
      rawLine: (line) => rawLines.push(line)
    })
    runtime.register(new FakeProvider())

    const session = await runtime.startSession({ providerId: 'fake', workspacePath: process.cwd() })
    runtime.sendMessage(session.id, 'improve the login screen')

    await waitFor(() => events.some((e) => e.event.kind === 'completed'))

    const kinds = events.map((e) => e.event.kind)
    expect(kinds).toContain('session-init')
    expect(kinds).toContain('assistant-text')
    expect(kinds).toContain('tool-call')
    expect(kinds).toContain('file-change')
    expect(kinds).toContain('completed')

    // A file-change for the Write tool with the right path.
    const fileChange = events.find((e) => e.event.kind === 'file-change')
    expect(fileChange?.event).toMatchObject({ path: 'a.txt', changeType: 'created' })

    // Status went working -> completed.
    const statusValues = statuses.map((s) => s.status)
    expect(statusValues).toContain('working')
    expect(statusValues[statusValues.length - 1]).toBe('completed')

    // Raw lines were forwarded (used by the usage monitor).
    expect(rawLines.length).toBeGreaterThan(0)

    runtime.disposeAll()
  })

  it('rejects a second message while a turn is in flight', async () => {
    const runtime = new AgentRuntime({ event: () => {}, sessionUpdate: () => {} })
    runtime.register(new FakeProvider())
    const session = await runtime.startSession({ providerId: 'fake', workspacePath: process.cwd() })
    runtime.sendMessage(session.id, 'first')
    expect(() => runtime.sendMessage(session.id, 'second')).toThrow(/already working/i)
    runtime.disposeAll()
  })

  it('refuses to start a session for an invalid workspace', async () => {
    const runtime = new AgentRuntime({ event: () => {}, sessionUpdate: () => {} })
    runtime.register(new FakeProvider())
    await expect(
      runtime.startSession({ providerId: 'fake', workspacePath: '/definitely/not/a/real/path/xyz' })
    ).rejects.toThrow(/workspace/i)
  })
})
