import { useEffect, useMemo, type JSX } from 'react'
import { useGoalStore } from '@renderer/stores/goalStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useBrainStore } from '@renderer/stores/brainStore'
import { useTestGuardianStore } from '@renderer/stores/testGuardianStore'
import { useAgentStore } from '@renderer/stores/agentStore'
import { useT, type TKey } from '@renderer/i18n'
import {
  computeProgress,
  evaluateTask,
  nextAction,
  type EvalContext,
  type GoalTask
} from './goal'

/**
 * Goal Mode panel (spec §29-§32). Describe a goal → Claude Code breaks it into
 * checkable tasks → Lumixa measures progress from the real project state (files
 * + tests), never from an AI self-report. Each task can be built by Claude Code.
 */
export function GoalModePanel(): JSX.Element {
  const t = useT()
  const root = useWorkspaceStore((s) => s.root)
  const { goal, input, generating, setInput, loadFor, create, generate, reset } = useGoalStore()
  const files = useBrainStore((s) => s.brain?.files)
  const testsPass = useTestGuardianStore((s) => (s.result ? s.result.ok : null))

  useEffect(() => {
    if (root) loadFor(root)
  }, [root, loadFor])

  const ctx: EvalContext = useMemo(
    () => ({ files: (files ?? []).map((f) => ({ rel: f.rel, exports: f.exports })), testsPass }),
    [files, testsPass]
  )

  if (!root) {
    return (
      <div className="sidebar goal">
        <div className="sidebar-header">
          <span>{t('goal.title')}</span>
        </div>
        <div className="empty-hint">{t('goal.noWorkspace')}</div>
      </div>
    )
  }

  const progress = goal ? computeProgress(goal.tasks, ctx) : null
  const next = goal ? nextAction(goal.tasks, ctx) : null

  return (
    <div className="sidebar goal">
      <div className="sidebar-header">
        <span>{t('goal.title')}</span>
        {goal && (
          <button title={t('goal.reset')} onClick={reset}>
            ✕
          </button>
        )}
      </div>

      <div className="goal-body">
        {!goal ? (
          <>
            <div className="goal-intro">{t('goal.intro')}</div>
            <textarea
              className="goal-input"
              value={input}
              placeholder={t('goal.placeholder')}
              onChange={(e) => setInput(e.target.value)}
            />
            <div className="goal-actions">
              <button className="goal-generate" disabled={!input.trim() || generating} onClick={() => void generate()}>
                {generating ? t('goal.generating') : t('goal.generate')}
              </button>
              <button className="goal-manual-create" disabled={!input.trim()} onClick={create}>
                {t('goal.startManual')}
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="goal-text">{goal.text}</div>

            {progress && (
              <div className="goal-progress">
                <div className="goal-prog-top">
                  <span className="goal-prog-pct">{progress.percent}%</span>
                  <span className="goal-prog-meta">
                    {t('goal.done', { d: progress.done, n: progress.total })}
                  </span>
                </div>
                <div className="goal-prog-bar">
                  <div className="goal-prog-fill" style={{ width: `${progress.percent}%` }} />
                </div>
              </div>
            )}

            {goal.tasks.length === 0 && (
              <div className="goal-empty">
                <div className="empty-hint">{t('goal.noTasks')}</div>
                <button className="goal-generate" disabled={generating} onClick={() => void generate()}>
                  {generating ? t('goal.generating') : t('goal.generate')}
                </button>
              </div>
            )}

            {next && <NextAction task={next} />}

            {goal.tasks.length > 0 && (
              <div className="goal-tasks">
                <div className="goal-section-title">{t('goal.tasks')}</div>
                {goal.tasks.map((task) => (
                  <TaskRow key={task.id} task={task} done={evaluateTask(task, ctx)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function NextAction({ task }: { task: GoalTask }): JSX.Element {
  const t = useT()
  const buildTask = useGoalStore((s) => s.buildTask)
  const claudeReady = useAgentStore((s) =>
    s.providers.some((p) => p.id === 'claude-code' && p.state === 'authenticated')
  )
  return (
    <div className="goal-next">
      <div className="goal-next-label">{t('goal.nextAction')}</div>
      <div className="goal-next-title">{task.title}</div>
      {task.hint && <div className="goal-next-why">{task.hint}</div>}
      <div className="goal-next-foot">
        {task.complexity && (
          <span className={`goal-cx ${task.complexity}`}>{t(`goal.cx.${task.complexity}` as TKey)}</span>
        )}
        {claudeReady && (
          <button className="goal-build" onClick={() => void buildTask(task)}>
            {t('goal.build')}
          </button>
        )}
      </div>
    </div>
  )
}

function TaskRow({ task, done }: { task: GoalTask; done: boolean }): JSX.Element {
  const t = useT()
  const toggleManual = useGoalStore((s) => s.toggleManual)
  const buildTask = useGoalStore((s) => s.buildTask)
  const claudeReady = useAgentStore((s) =>
    s.providers.some((p) => p.id === 'claude-code' && p.state === 'authenticated')
  )
  const isManual = task.check.type === 'manual'
  return (
    <div className={`goal-task ${done ? 'done' : ''}`}>
      <button
        className="goal-check"
        title={isManual ? t('goal.toggleManual') : t('goal.autoChecked')}
        onClick={() => isManual && toggleManual(task.id)}
        style={{ cursor: isManual ? 'pointer' : 'default' }}
      >
        {done ? '☑' : '☐'}
      </button>
      <span className="goal-task-title">{task.title}</span>
      {!done && claudeReady && (
        <button className="goal-task-build" title={t('goal.build')} onClick={() => void buildTask(task)}>
          ▶
        </button>
      )}
    </div>
  )
}
