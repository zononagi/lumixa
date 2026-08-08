import type { JSX } from 'react'
import { useUiStore } from '@renderer/stores/uiStore'

/**
 * "Why?" overlay — shows the static-analysis explanation composed by the
 * `why.explain` / git-blame commands. Plain text, no AI.
 */
export function WhyOverlay(): JSX.Element | null {
  const text = useUiStore((s) => s.whyText)
  const setWhy = useUiStore((s) => s.setWhy)
  if (text === null) return null

  return (
    <div className="why-backdrop" onClick={() => setWhy(null)}>
      <div className="why" onClick={(e) => e.stopPropagation()}>
        <div className="why-header">
          <span>Why? / Explain</span>
          <button onClick={() => setWhy(null)}>✕</button>
        </div>
        <pre className="why-body">{text}</pre>
      </div>
    </div>
  )
}
