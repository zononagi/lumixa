import { useEffect, useMemo, type JSX } from 'react'
import { useRiskStore } from '@renderer/stores/riskStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useBrainStore } from '@renderer/stores/brainStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useAgentStore } from '@renderer/stores/agentStore'
import { useUiStore } from '@renderer/stores/uiStore'
import { useT, type TKey } from '@renderer/i18n'
import {
  buildRiskReviewPrompt,
  criticalAreas,
  scanRisks,
  type RiskCategory,
  type RiskItem
} from './risk'

/**
 * Risk Detector panel (spec §36-§37). Surfaces critical files that currently
 * have uncommitted changes (the active risk) with consequences + recommended
 * safeguards, and an overview of the project's danger zones by category.
 */
const CAT_ICON: Record<RiskCategory, string> = {
  migration: '🗄',
  database: '🗃',
  payments: '💳',
  auth: '🔐',
  secrets: '🔒',
  infra: '🏗',
  deploy: '🚀'
}

export function RiskDetectorPanel(): JSX.Element {
  const t = useT()
  const root = useWorkspaceStore((s) => s.root)
  const files = useBrainStore((s) => s.brain?.files)
  const { changed, refresh, snapshot } = useRiskStore()

  useEffect(() => {
    if (root) void refresh(root)
  }, [root, refresh])

  const items = useMemo(() => (files ? scanRisks(files, changed) : []), [files, changed])
  const risky = items.filter((i) => i.changed)
  const areas = useMemo(() => criticalAreas(items), [items])

  if (!root) {
    return (
      <div className="sidebar risk">
        <div className="sidebar-header">
          <span>{t('risk.title')}</span>
        </div>
        <div className="empty-hint">{t('risk.noWorkspace')}</div>
      </div>
    )
  }

  return (
    <div className="sidebar risk">
      <div className="sidebar-header">
        <span>{t('risk.title')}</span>
        <button title={t('risk.refresh')} onClick={() => void refresh(root)}>
          ↻
        </button>
      </div>

      <div className="risk-body">
        <div className="risk-section-title">{t('risk.inProgress')}</div>
        {risky.length === 0 ? (
          <div className="empty-hint">{t('risk.noneInProgress')}</div>
        ) : (
          <>
            <div className="risk-banner">⚠ {t('risk.banner', { n: risky.length })}</div>
            {risky.map((it) => (
              <RiskCard key={it.rel} item={it} onSnapshot={snapshot} />
            ))}
          </>
        )}

        <div className="risk-section-title">{t('risk.zones')}</div>
        {areas.size === 0 ? (
          <div className="empty-hint">{t('risk.noZones')}</div>
        ) : (
          [...areas.entries()].map(([cat, list]) => (
            <ZoneRow key={cat} category={cat} list={list} />
          ))
        )}
      </div>
    </div>
  )
}

function RiskCard({ item, onSnapshot }: { item: RiskItem; onSnapshot: () => void }): JSX.Element {
  const t = useT()
  const openFile = useEditorStore((s) => s.openFile)
  const claudeReady = useAgentStore((s) =>
    s.providers.some((p) => p.id === 'claude-code' && p.state === 'authenticated')
  )
  const requestPrefill = useAgentStore((s) => s.requestPrefill)
  const setLeftView = useUiStore((s) => s.setLeftView)

  const review = (): void => {
    setLeftView('agent')
    void requestPrefill(buildRiskReviewPrompt(item.rel, item.category), ['file', 'gitDiff'])
  }

  return (
    <div className="risk-card">
      <div className="risk-card-head">
        <span className="risk-cat-icon">{CAT_ICON[item.category]}</span>
        <span className="risk-cat-label">{t(`risk.cat.${item.category}` as TKey)}</span>
        <button
          className="risk-file"
          title={item.rel}
          onClick={() => void openFile(item.path, item.rel.split('/').pop() ?? item.rel)}
        >
          {item.rel.split('/').pop()}
        </button>
      </div>
      <div className="risk-cons">{t(`risk.cons.${item.category}` as TKey)}</div>
      <div className="risk-rec">
        <strong>{t('risk.recommended')}</strong> {t(`risk.rec.${item.category}` as TKey)}
      </div>
      <div className="risk-actions">
        <button className="risk-snapshot" onClick={onSnapshot}>
          {t('risk.snapshot')}
        </button>
        {claudeReady && (
          <button className="risk-review" onClick={review}>
            {t('risk.review')}
          </button>
        )}
      </div>
    </div>
  )
}

function ZoneRow({ category, list }: { category: RiskCategory; list: RiskItem[] }): JSX.Element {
  const t = useT()
  return (
    <details className="risk-zone">
      <summary>
        <span className="risk-cat-icon">{CAT_ICON[category]}</span>
        {t(`risk.cat.${category}` as TKey)}
        <span className="risk-zone-count">{list.length}</span>
      </summary>
      {list.slice(0, 40).map((it) => (
        <div key={it.rel} className={`risk-zone-file ${it.changed ? 'changed' : ''}`} title={it.rel}>
          {it.rel}
        </div>
      ))}
    </details>
  )
}
