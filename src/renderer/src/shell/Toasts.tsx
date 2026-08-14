import type { JSX } from 'react'
import { useNotifyStore } from '@renderer/stores/notifyStore'

/** Renders the beginner notification toasts (spec §74) bottom-right. */
export function Toasts(): JSX.Element {
  const toasts = useNotifyStore((s) => s.toasts)
  const dismiss = useNotifyStore((s) => s.dismiss)
  const icon = { info: 'ℹ', success: '✓', warn: '⚠', error: '✕', tip: '💡' }
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} onClick={() => dismiss(t.id)}>
          <span className="toast-icon">{icon[t.kind]}</span>
          <span className="toast-msg">{t.message}</span>
        </div>
      ))}
    </div>
  )
}
