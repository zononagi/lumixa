import { describe, it, expect } from 'vitest'
import {
  buildBreakdownPrompt,
  computeProgress,
  evaluateTask,
  nextAction,
  parseTasksFromResponse,
  type EvalContext,
  type GoalTask
} from './goal'

const ctx = (over: Partial<EvalContext> = {}): EvalContext => ({
  files: [
    { rel: 'src/cart/Cart.tsx', exports: ['Cart'] },
    { rel: 'src/auth/session.ts', exports: ['login'] }
  ],
  testsPass: null,
  ...over
})

const task = (check: GoalTask['check'], over: Partial<GoalTask> = {}): GoalTask => ({
  id: 't1',
  title: 'Task',
  check,
  ...over
})

describe('evaluateTask', () => {
  it('file check matches by glob and substring', () => {
    expect(evaluateTask(task({ type: 'file', value: 'src/cart/*' }), ctx())).toBe(true)
    expect(evaluateTask(task({ type: 'file', value: 'cart/Cart' }), ctx())).toBe(true)
    expect(evaluateTask(task({ type: 'file', value: 'src/checkout/*' }), ctx())).toBe(false)
  })
  it('keyword check matches path or exports', () => {
    expect(evaluateTask(task({ type: 'keyword', value: 'login' }), ctx())).toBe(true)
    expect(evaluateTask(task({ type: 'keyword', value: 'nowhere' }), ctx())).toBe(false)
  })
  it('tests check reflects the real run result', () => {
    expect(evaluateTask(task({ type: 'tests' }), ctx({ testsPass: true }))).toBe(true)
    expect(evaluateTask(task({ type: 'tests' }), ctx({ testsPass: false }))).toBe(false)
    expect(evaluateTask(task({ type: 'tests' }), ctx({ testsPass: null }))).toBe(false)
  })
  it('manual check uses the user flag only', () => {
    expect(evaluateTask(task({ type: 'manual' }, { manualDone: true }), ctx())).toBe(true)
    expect(evaluateTask(task({ type: 'manual' }), ctx())).toBe(false)
  })
})

describe('computeProgress + nextAction', () => {
  const tasks: GoalTask[] = [
    task({ type: 'file', value: 'src/cart/*' }, { id: 'a', title: 'Cart' }),
    task({ type: 'file', value: 'src/checkout/*' }, { id: 'b', title: 'Checkout' })
  ]
  it('measures progress from real state, not self-report', () => {
    const p = computeProgress(tasks, ctx())
    expect(p).toEqual({ done: 1, total: 2, percent: 50 })
  })
  it('next action is the first unmet task', () => {
    expect(nextAction(tasks, ctx())?.id).toBe('b')
  })
})

describe('parseTasksFromResponse', () => {
  it('parses a fenced json array', () => {
    const text =
      'Sure!\n```json\n[{"title":"Build cart","hint":"add cart","complexity":"medium","check":{"type":"file","value":"src/cart/*"}}]\n```\nDone.'
    const tasks = parseTasksFromResponse(text)
    expect(tasks).toHaveLength(1)
    expect(tasks[0].title).toBe('Build cart')
    expect(tasks[0].check).toEqual({ type: 'file', value: 'src/cart/*' })
    expect(tasks[0].complexity).toBe('medium')
  })
  it('falls back to a bare array and defaults bad checks to manual', () => {
    const tasks = parseTasksFromResponse('[{"title":"X","check":{"type":"weird"}}]')
    expect(tasks[0].check.type).toBe('manual')
  })
  it('returns empty on unparseable text', () => {
    expect(parseTasksFromResponse('no json here')).toEqual([])
  })
})

describe('buildBreakdownPrompt', () => {
  it('asks for a json array and includes the goal', () => {
    const p = buildBreakdownPrompt('build a blog', { framework: 'React', testing: 'Vitest' })
    expect(p).toContain('json')
    expect(p).toContain('build a blog')
    expect(p).toContain('React')
  })
})
