import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import { useUiStore } from '@renderer/stores/uiStore'
import { buildCommands, type Command } from './commands'

/**
 * Command Palette (Ctrl/Cmd+Shift+P). A fuzzy-filtered list of Lumixa commands
 * — file/view/editor/git/learn actions — decoupled from the features they drive
 * via the command registry in commands.ts.
 */
function fuzzy(query: string, text: string): boolean {
  const q = query.toLowerCase()
  const t = text.toLowerCase()
  let i = 0
  for (const ch of t) {
    if (ch === q[i]) i++
    if (i === q.length) return true
  }
  return q.length === 0
}

export function CommandPalette(): JSX.Element | null {
  const open = useUiStore((s) => s.paletteOpen)
  const setPalette = useUiStore((s) => s.setPalette)
  const [query, setQuery] = useState('')
  const [index, setIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const commands = useMemo<Command[]>(() => (open ? buildCommands() : []), [open])
  const filtered = useMemo(
    () => commands.filter((c) => fuzzy(query, `${c.category} ${c.title}`)),
    [commands, query]
  )

  useEffect(() => {
    if (open) {
      setQuery('')
      setIndex(0)
      // Focus after mount.
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  useEffect(() => setIndex(0), [query])

  if (!open) return null

  const run = (cmd: Command | undefined): void => {
    if (!cmd) return
    setPalette(false)
    cmd.run()
  }

  return (
    <div className="palette-backdrop" onClick={() => setPalette(false)}>
      <div className="palette" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Type a command…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') setPalette(false)
            else if (e.key === 'ArrowDown') {
              e.preventDefault()
              setIndex((i) => Math.min(i + 1, filtered.length - 1))
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              setIndex((i) => Math.max(i - 1, 0))
            } else if (e.key === 'Enter') {
              e.preventDefault()
              run(filtered[index])
            }
          }}
        />
        <div className="palette-list">
          {filtered.length === 0 && <div className="palette-empty">No matching commands</div>}
          {filtered.map((c, i) => (
            <div
              key={c.id}
              className={`palette-item ${i === index ? 'active' : ''}`}
              onMouseEnter={() => setIndex(i)}
              onClick={() => run(c)}
            >
              <span className="palette-cat">{c.category}</span>
              <span className="palette-title">{c.title}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
