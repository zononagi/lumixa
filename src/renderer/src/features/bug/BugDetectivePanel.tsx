import { type JSX } from 'react'
import { useBugStore } from '@renderer/stores/bugStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useAgentStore } from '@renderer/stores/agentStore'
import { useBrainStore } from '@renderer/stores/brainStore'
import { useT } from '@renderer/i18n'

/**
 * Bug Detective panel (spec §15-§17). The user describes a bug in plain words;
 * Lumixa shows the deterministic evidence it collected, then hands a structured
 * investigation to Claude Code (which reasons + can reproduce via tests). The
 * hypotheses/confidence appear in the Claude Code panel — clearly AI analysis.
 */
export function BugDetectivePanel(): JSX.Element {
  const t = useT()
  const root = useWorkspaceStore((s) => s.root)
  const { description, evidence, gathering, setDescription, gather, investigate } = useBugStore()
  const openFile = useEditorStore((s) => s.openFile)
  const brainFiles = useBrainStore((s) => s.brain?.files)
  const claudeReady = useAgentStore((s) =>
    s.providers.some((p) => p.id === 'claude-code' && p.state === 'authenticated')
  )

  const openRel = (rel: string): void => {
    // Resolve the absolute path from the Brain's node list (cross-platform).
    const abs = brainFiles?.find((f) => f.rel === rel)?.path
    if (abs) void openFile(abs, rel.split('/').pop() ?? rel)
  }

  if (!root) {
    return (
      <div className="sidebar bug">
        <div className="sidebar-header">
          <span>{t('bug.title')}</span>
        </div>
        <div className="empty-hint">{t('bug.noWorkspace')}</div>
      </div>
    )
  }

  return (
    <div className="sidebar bug">
      <div className="sidebar-header">
        <span>{t('bug.title')}</span>
      </div>

      <div className="bug-body">
        <div className="bug-intro">{t('bug.intro')}</div>

        <textarea
          className="bug-input"
          value={description}
          placeholder={t('bug.placeholder')}
          onChange={(e) => setDescription(e.target.value)}
        />

        <div className="bug-actions">
          <button className="bug-gather" disabled={gathering} onClick={() => void gather()}>
            {t('bug.gather')}
          </button>
          <button
            className="bug-investigate"
            disabled={gathering || !description.trim()}
            onClick={() => void investigate()}
          >
            {t('bug.investigate')}
          </button>
        </div>

        {!claudeReady && <div className="bug-warn">{t('bug.noClaude')}</div>}
        {gathering && <div className="bug-gathering">{t('bug.gathering')}</div>}

        {evidence && (
          <div className="bug-evidence">
            <div className="bug-section-title">{t('bug.evidence')}</div>

            {evidence.keywords.length > 0 && (
              <div className="bug-keywords">
                {evidence.keywords.map((k) => (
                  <span key={k} className="bug-kw">
                    {k}
                  </span>
                ))}
              </div>
            )}

            <EvidenceRow label={t('bug.relatedFiles')} value={evidence.relatedFiles.length} />
            {evidence.relatedFiles.map((rel) => (
              <button key={rel} className="bug-file" title={rel} onClick={() => openRel(rel)}>
                {rel}
              </button>
            ))}

            <EvidenceRow label={t('bug.problems')} value={evidence.problems.length} />
            <EvidenceRow label={t('bug.commits')} value={evidence.recentCommits.length} />
            <EvidenceRow
              label={t('bug.uncommitted')}
              value={evidence.hasUncommitted ? t('bug.yes') : t('bug.no')}
            />

            <div className="bug-hint">{t('bug.handoffHint')}</div>
          </div>
        )}
      </div>
    </div>
  )
}

function EvidenceRow({ label, value }: { label: string; value: number | string }): JSX.Element {
  return (
    <div className="bug-ev-row">
      <span className="bug-ev-label">{label}</span>
      <span className="bug-ev-value">{value}</span>
    </div>
  )
}
