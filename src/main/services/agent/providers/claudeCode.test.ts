import { describe, it, expect } from 'vitest'
import { ClaudeCodeProvider } from './claudeCode'

const p = new ClaudeCodeProvider()

describe('ClaudeCodeProvider.parseLine (real stream-json protocol)', () => {
  it('maps a system/init line to session-init', () => {
    const line = JSON.stringify({
      type: 'system',
      subtype: 'init',
      session_id: 'abc-123',
      model: 'claude-haiku-4-5',
      cwd: 'C:/proj',
      claude_code_version: '2.1.220'
    })
    expect(p.parseLine(line)).toEqual([
      {
        kind: 'session-init',
        providerSessionId: 'abc-123',
        model: 'claude-haiku-4-5',
        cwd: 'C:/proj',
        version: '2.1.220'
      }
    ])
  })

  it('maps assistant text and thinking blocks', () => {
    const text = JSON.stringify({ type: 'assistant', message: { content: [{ type: 'text', text: 'hello' }] } })
    const think = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'thinking', thinking: 'hmm' }] }
    })
    expect(p.parseLine(text)).toEqual([{ kind: 'assistant-text', text: 'hello' }])
    expect(p.parseLine(think)).toEqual([{ kind: 'assistant-thinking', text: 'hmm' }])
  })

  it('maps a tool_use block and derives a file-change for edits', () => {
    const line = JSON.stringify({
      type: 'assistant',
      message: {
        content: [{ type: 'tool_use', id: 'tool_1', name: 'Edit', input: { file_path: 'src/App.tsx' } }]
      }
    })
    const events = p.parseLine(line)
    expect(events[0]).toMatchObject({ kind: 'tool-call', toolCallId: 'tool_1', name: 'Edit' })
    expect(events[1]).toEqual({ kind: 'file-change', path: 'src/App.tsx', changeType: 'modified' })
  })

  it('treats Write as a created file-change and Bash without file path as none', () => {
    const write = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', id: 't', name: 'Write', input: { file_path: 'new.ts' } }] }
    })
    expect(p.parseLine(write).find((e) => e.kind === 'file-change')).toEqual({
      kind: 'file-change',
      path: 'new.ts',
      changeType: 'created'
    })
    const bash = JSON.stringify({
      type: 'assistant',
      message: { content: [{ type: 'tool_use', id: 't', name: 'Bash', input: { command: 'npm test' } }] }
    })
    const events = p.parseLine(bash)
    expect(events.some((e) => e.kind === 'file-change')).toBe(false)
    expect(events[0]).toMatchObject({ kind: 'tool-call', summary: 'Bash: npm test' })
  })

  it('maps a user tool_result to tool-result', () => {
    const line = JSON.stringify({
      type: 'user',
      message: {
        content: [{ type: 'tool_result', tool_use_id: 'tool_1', is_error: false, content: 'ok' }]
      }
    })
    expect(p.parseLine(line)).toEqual([
      { kind: 'tool-result', toolCallId: 'tool_1', isError: false, summary: 'ok' }
    ])
  })

  it('maps a result line to completed, carrying cost and duration', () => {
    const line = JSON.stringify({
      type: 'result',
      subtype: 'success',
      is_error: false,
      result: 'PONG',
      total_cost_usd: 0.02,
      duration_ms: 3129
    })
    expect(p.parseLine(line)).toEqual([
      { kind: 'completed', isError: false, result: 'PONG', costUsd: 0.02, durationMs: 3129 }
    ])
  })

  it('surfaces permission_denials from a result line', () => {
    const line = JSON.stringify({
      type: 'result',
      is_error: false,
      permission_denials: [{ tool_name: 'Bash' }]
    })
    const events = p.parseLine(line)
    expect(events[0]).toMatchObject({ kind: 'permission-request', tool: 'Bash' })
    expect(events[1]).toMatchObject({ kind: 'completed' })
  })

  it('ignores malformed and non-JSON lines', () => {
    expect(p.parseLine('not json')).toEqual([])
    expect(p.parseLine('{ broken')).toEqual([])
    expect(p.parseLine('')).toEqual([])
    expect(p.parseLine('Shell cwd was reset to C:/x')).toEqual([])
  })

  it('ignores noisy system subtypes (thinking_tokens, post_turn_summary)', () => {
    expect(p.parseLine(JSON.stringify({ type: 'system', subtype: 'thinking_tokens' }))).toEqual([])
    expect(p.parseLine(JSON.stringify({ type: 'system', subtype: 'post_turn_summary' }))).toEqual([])
  })
})

describe('ClaudeCodeProvider.createRunSpec', () => {
  it('starts a fresh session with --session-id and resumes with --resume', () => {
    const fresh = p.createRunSpec({
      message: 'hi',
      workspacePath: '/w',
      sessionId: 'sid',
      resume: false
    })
    expect(fresh.args).toContain('--session-id')
    expect(fresh.args).toContain('sid')
    expect(fresh.args).not.toContain('--resume')
    expect(fresh.args).toContain('stream-json')

    const resumed = p.createRunSpec({
      message: 'again',
      workspacePath: '/w',
      sessionId: 'sid',
      resume: true
    })
    expect(resumed.args).toContain('--resume')
    expect(resumed.args).not.toContain('--session-id')
  })

  it('passes model and permission mode when provided', () => {
    const spec = p.createRunSpec({
      message: 'hi',
      workspacePath: '/w',
      sessionId: 'sid',
      resume: false,
      model: 'claude-haiku-4-5',
      permissionMode: 'acceptEdits'
    })
    expect(spec.args).toContain('--model')
    expect(spec.args).toContain('claude-haiku-4-5')
    expect(spec.args).toContain('acceptEdits')
    expect(spec.cwd).toBe('/w')
  })
})
