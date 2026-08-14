import { useCallback, useEffect, useState, type JSX } from 'react'
import type { SnapshotMeta } from '@shared/ipc'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useT } from '@renderer/i18n'

/**
 * Safe Mode panel (spec §52–§57). Lets the user take a manual "safety net"
 * snapshot of the workspace and restore one later. Restoring first auto-creates
 * a snapshot of the current state (§57), and reloads any open editor tabs from
 * disk so the UI reflects the reverted files. This is explicitly a temporary
 * safety net, not a Git replacement (§54).
 */
export function SafeModePanel(): JSX.Element {
  const t = useT()
  const root = useWorkspaceStore((s) => s.root)
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    if (!root) {
      setSnapshots([])
      return
    }
    setSnapshots(await window.lumixa.snapshot.list(root))
  }, [root])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const create = async (): Promise<void> => {
    if (!root) return
    setBusy(true)
    const res = await window.lumixa.snapshot.create(root, label)
    setBusy(false)
    setNotice(res.message)
    setLabel('')
    await refresh()
  }

  const restore = async (m: SnapshotMeta): Promise<void> => {
    if (!root) return
    const when = new Date(m.createdAt).toLocaleString()
    if (!window.confirm(t('safe.confirmRestore', { label: m.label || when }))) return
    setBusy(true)
    const res = await window.lumixa.snapshot.restore(root, m.id)
    setBusy(false)
    setNotice(res.message)
    await reloadOpenTabs()
    await refresh()
  }

  const remove = async (m: SnapshotMeta): Promise<void> => {
    if (!root) return
    await window.lumixa.snapshot.delete(root, m.id)
    await refresh()
  }

  return (
    <div className="sidebar safe">
      <div className="sidebar-header">
        <span>{t('safe.title')}</span>
        <button title={t('git.refresh')} onClick={() => void refresh()}>
          ↻
        </button>
      </div>

      {!root ? (
        <div className="empty-hint">{t('safe.noWorkspace')}</div>
      ) : (
        <div className="safe-body">
          <p className="hint safe-note">{t('safe.note')}</p>

          <div className="safe-create">
            <input
              value={label}
              placeholder={t('safe.labelPlaceholder')}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') void create()
              }}
            />
            <button className="safe-snap-btn" disabled={busy} onClick={() => void create()}>
              {t('safe.create')}
            </button>
          </div>

          {notice && <div className="safe-notice">{notice}</div>}

          {snapshots.length === 0 ? (
            <div className="empty-hint">{t('safe.empty')}</div>
          ) : (
            <div className="safe-list">
              {snapshots.map((m) => (
                <div key={m.id} className={`safe-item ${m.auto ? 'auto' : ''}`}>
                  <div className="safe-item-main">
                    <span className="safe-item-label">
                      {m.label || t('safe.untitled')}
                      {m.auto && <span className="safe-auto-tag">{t('safe.autoTag')}</span>}
                    </span>
                    <span className="safe-item-meta">
                      {new Date(m.createdAt).toLocaleString()} · {t('safe.files', { n: m.fileCount })}
                    </span>
                  </div>
                  <div className="safe-item-actions">
                    <button disabled={busy} onClick={() => void restore(m)}>
                      {t('safe.restore')}
                    </button>
                    <button className="safe-del" title={t('safe.delete')} onClick={() => void remove(m)}>
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** After a restore, reflect on-disk changes into any open editor tabs. */
async function reloadOpenTabs(): Promise<void> {
  const editor = useEditorStore.getState()
  for (const tab of editor.tabs) {
    try {
      const content = await window.lumixa.fs.readFile(tab.path)
      editor.setSavedContent(tab.path, content)
    } catch {
      /* file may no longer exist — leave the tab as-is */
    }
  }
}
