import { useEffect, useMemo, useState, type JSX } from 'react'
import { useSkillMemoryStore } from '@renderer/stores/skillMemoryStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useBrainStore } from '@renderer/stores/brainStore'
import { useAgentStore } from '@renderer/stores/agentStore'
import { useUiStore } from '@renderer/stores/uiStore'
import { useT, type TKey } from '@renderer/i18n'
import { allFacts, deriveFacts, type SkillFact } from './skillMemory'

/**
 * Skill Memory panel (spec §33-§35). Shows what Lumixa knows about this project
 * — auto-derived facts (with source + confidence) and user-added rules. Nothing
 * is presented without provenance. The knowledge can be attached to Claude Code
 * via the "+ Context → Project knowledge" chip, or shared directly here.
 */
export function SkillMemoryPanel(): JSX.Element {
  const t = useT()
  const root = useWorkspaceStore((s) => s.root)
  const summary = useBrainStore((s) => s.brain?.summary)
  const files = useBrainStore((s) => s.brain?.files)
  const { userFacts, loadFor, add, remove } = useSkillMemoryStore()
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (root) loadFor(root)
  }, [root, loadFor])

  const derived = useMemo(
    () => deriveFacts(summary ?? null, files ?? []),
    [summary, files]
  )

  if (!root) {
    return (
      <div className="sidebar memory">
        <div className="sidebar-header">
          <span>{t('mem.title')}</span>
        </div>
        <div className="empty-hint">{t('mem.noWorkspace')}</div>
      </div>
    )
  }

  const submit = (): void => {
    add(draft)
    setDraft('')
  }

  return (
    <div className="sidebar memory">
      <div className="sidebar-header">
        <span>{t('mem.title')}</span>
      </div>

      <div className="mem-body">
        <div className="mem-intro">{t('mem.intro')}</div>

        <div className="mem-section-title">{t('mem.derived')}</div>
        {derived.length === 0 ? (
          <div className="empty-hint">{t('mem.deriving')}</div>
        ) : (
          derived.map((f) => <FactRow key={f.id} fact={f} />)
        )}

        <div className="mem-section-title">{t('mem.yourRules')}</div>
        {userFacts.map((f) => (
          <FactRow key={f.id} fact={f} onRemove={() => remove(f.id)} />
        ))}
        <div className="mem-add">
          <input
            value={draft}
            placeholder={t('mem.addPlaceholder')}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
          />
          <button disabled={!draft.trim()} onClick={submit}>
            {t('mem.add')}
          </button>
        </div>

        <ShareButton derived={derived} user={userFacts} />
      </div>
    </div>
  )
}

const SOURCE_LABEL: Record<SkillFact['source'], TKey> = {
  'package.json': 'mem.src.pkg',
  config: 'mem.src.config',
  'code pattern': 'mem.src.pattern',
  'user instruction': 'mem.src.user',
  documentation: 'mem.src.doc'
}

function FactRow({ fact, onRemove }: { fact: SkillFact; onRemove?: () => void }): JSX.Element {
  const t = useT()
  return (
    <div className="mem-fact">
      <div className="mem-fact-main">
        <span className="mem-fact-text">{fact.text}</span>
        {onRemove && (
          <button className="mem-remove" onClick={onRemove} title={t('mem.remove')}>
            ×
          </button>
        )}
      </div>
      <div className="mem-fact-meta">
        <span className="mem-src">{t(SOURCE_LABEL[fact.source])}</span>
        <span className={`mem-conf ${fact.confidence}`}>{t(`mem.conf.${fact.confidence}` as TKey)}</span>
      </div>
    </div>
  )
}

function ShareButton({ derived, user }: { derived: SkillFact[]; user: SkillFact[] }): JSX.Element | null {
  const t = useT()
  const claudeReady = useAgentStore((s) =>
    s.providers.some((p) => p.id === 'claude-code' && p.state === 'authenticated')
  )
  const requestPrefill = useAgentStore((s) => s.requestPrefill)
  const setLeftView = useUiStore((s) => s.setLeftView)
  if (!claudeReady || allFacts(derived, user).length === 0) return null
  return (
    <button
      className="mem-share"
      onClick={() => {
        setLeftView('agent')
        void requestPrefill(t('mem.sharePrompt'), ['knowledge'])
      }}
    >
      {t('mem.share')}
    </button>
  )
}
