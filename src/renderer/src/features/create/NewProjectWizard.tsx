import { type JSX } from 'react'
import { PROJECT_TEMPLATES } from '@shared/create'
import { useCreateStore } from '@renderer/stores/createStore'
import { useUiStore } from '@renderer/stores/uiStore'
import { useAgentStore } from '@renderer/stores/agentStore'
import { useHealStore } from '@renderer/stores/healStore'
import { runInTerminal } from '@renderer/lib/terminalBridge'
import { useT } from '@renderer/i18n'
import { buildImplementPrompt, templateName } from './plan'

/**
 * New Project wizard (Project Creation Engine, spec §1-§9, §36-§37). Three
 * steps: describe → review the plan → create + next steps. Creation scaffolds a
 * real project, opens it (Brain indexes it), and seeds Goal Mode. The heavy
 * follow-ups (install, implement, verify) are explicit, visible actions (§35).
 */
export function NewProjectWizard(): JSX.Element | null {
  const t = useT()
  const open = useUiStore((s) => s.newProjectOpen)
  const {
    step,
    description,
    name,
    templateId,
    features,
    parentDir,
    creating,
    result,
    setDescription,
    setName,
    setTemplateId,
    removeFeature,
    browse,
    analyze,
    back,
    createProject,
    reset
  } = useCreateStore()

  if (!open) return null

  return (
    <div className="np-overlay" onClick={reset}>
      <div className="np-modal" onClick={(e) => e.stopPropagation()}>
        <div className="np-head">
          <span className="np-title">{t('create.title')}</span>
          <button className="np-close" onClick={reset}>
            ×
          </button>
        </div>

        {step === 'describe' && (
          <div className="np-body">
            <div className="np-label">{t('create.whatToBuild')}</div>
            <textarea
              className="np-desc"
              autoFocus
              value={description}
              placeholder={t('create.descPlaceholder')}
              onChange={(e) => setDescription(e.target.value)}
            />
            <div className="np-actions">
              <button className="np-primary" disabled={!description.trim()} onClick={analyze}>
                {t('create.analyze')}
              </button>
            </div>
          </div>
        )}

        {step === 'plan' && (
          <div className="np-body">
            <div className="np-row">
              <label className="np-field">
                <span>{t('create.name')}</span>
                <input value={name} onChange={(e) => setName(e.target.value)} />
              </label>
            </div>

            <div className="np-row">
              <label className="np-field">
                <span>{t('create.location')}</span>
                <div className="np-loc">
                  <input readOnly value={parentDir ?? ''} placeholder={t('create.noLocation')} />
                  <button onClick={() => void browse()}>{t('create.browse')}</button>
                </div>
              </label>
            </div>

            <div className="np-label">{t('create.stack')}</div>
            <div className="np-templates">
              {PROJECT_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  className={`np-tpl ${templateId === tpl.id ? 'on' : ''}`}
                  onClick={() => setTemplateId(tpl.id)}
                >
                  <span className="np-tpl-name">{tpl.name}</span>
                  <span className="np-tpl-desc">{tpl.description}</span>
                </button>
              ))}
            </div>

            <div className="np-label">{t('create.features')}</div>
            {features.length === 0 ? (
              <div className="np-empty">{t('create.noFeatures')}</div>
            ) : (
              <div className="np-features">
                {features.map((f) => (
                  <span key={f} className="np-feature">
                    {f}
                    <span className="np-feature-x" onClick={() => removeFeature(f)}>
                      ×
                    </span>
                  </span>
                ))}
              </div>
            )}

            {result && !result.ok && <div className="np-error">{result.message}</div>}

            <div className="np-actions">
              <button className="np-secondary" onClick={back}>
                {t('create.back')}
              </button>
              <button
                className="np-primary"
                disabled={creating || !parentDir || !name}
                onClick={() => void createProject()}
              >
                {creating ? t('create.creating') : t('create.create')}
              </button>
            </div>
          </div>
        )}

        {step === 'result' && result?.ok && <ResultStep />}
      </div>
    </div>
  )
}

function ResultStep(): JSX.Element {
  const t = useT()
  const { name, description, features, result, reset } = useCreateStore()
  const setLeftView = useUiStore((s) => s.setLeftView)
  const setTerminal = useUiStore((s) => s.setTerminal)
  const claudeReady = useAgentStore((s) =>
    s.providers.some((p) => p.id === 'claude-code' && p.state === 'authenticated')
  )
  const requestPrefill = useAgentStore((s) => s.requestPrefill)
  const runHeal = useHealStore((s) => s.run)

  const install = (): void => {
    setTerminal(true)
    setTimeout(() => runInTerminal('npm install'), 200)
    reset()
  }
  const implement = (): void => {
    reset()
    setLeftView('agent')
    void requestPrefill(buildImplementPrompt(description, features), ['knowledge'], true)
  }
  const verify = (): void => {
    reset()
    setLeftView('heal')
    void runHeal()
  }
  const goal = (): void => {
    reset()
    setLeftView('goal')
  }

  return (
    <div className="np-body">
      <div className="np-success">✓ {t('create.done', { name })}</div>
      <div className="np-success-sub">{t('create.doneSub', { n: result?.files.length ?? 0 })}</div>

      <div className="np-next-label">{t('create.nextSteps')}</div>
      <div className="np-next">
        <button className="np-next-btn" onClick={install}>
          <span className="np-next-title">📦 {t('create.install')}</span>
          <span className="np-next-desc">{t('create.installDesc')}</span>
        </button>
        {claudeReady && (
          <button className="np-next-btn" onClick={implement}>
            <span className="np-next-title">✦ {t('create.implement')}</span>
            <span className="np-next-desc">{t('create.implementDesc')}</span>
          </button>
        )}
        <button className="np-next-btn" onClick={goal}>
          <span className="np-next-title">🎯 {t('create.openGoal')}</span>
          <span className="np-next-desc">{t('create.openGoalDesc')}</span>
        </button>
        <button className="np-next-btn" onClick={verify}>
          <span className="np-next-title">🩺 {t('create.verify')}</span>
          <span className="np-next-desc">{t('create.verifyDesc')}</span>
        </button>
      </div>

      <div className="np-actions">
        <button className="np-primary" onClick={reset}>
          {t('create.finish')}
        </button>
      </div>
    </div>
  )
}
