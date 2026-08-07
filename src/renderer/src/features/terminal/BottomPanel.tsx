import { useEffect, useState, type JSX } from 'react'
import type { ShellInfo } from '@shared/ipc'
import { useUiStore } from '@renderer/stores/uiStore'
import { useT } from '@renderer/i18n'
import { TerminalView } from './TerminalView'

/** Bottom dock hosting the terminal, with a shell picker. */
export function BottomPanel(): JSX.Element | null {
  const open = useUiStore((s) => s.terminalOpen)
  const setTerminal = useUiStore((s) => s.setTerminal)
  const t = useT()
  const [shells, setShells] = useState<ShellInfo[]>([])
  const [shellPath, setShellPath] = useState<string>('')

  useEffect(() => {
    void window.lumixa.terminal.listShells().then((list) => {
      setShells(list)
      if (list.length > 0) setShellPath((prev) => prev || list[0].path)
    })
  }, [])

  if (!open) return null

  return (
    <div className="bottom-panel">
      <div className="bottom-header">
        <span className="title">{t('terminal.title')}</span>
        <select value={shellPath} onChange={(e) => setShellPath(e.target.value)}>
          {shells.map((s) => (
            <option key={s.id} value={s.path}>
              {s.label}
            </option>
          ))}
        </select>
        <div style={{ flex: 1 }} />
        <button title={t('terminal.close')} onClick={() => setTerminal(false)}>
          ✕
        </button>
      </div>
      <div className="bottom-body">
        {shellPath && <TerminalView key={shellPath} shellPath={shellPath} visible={open} />}
      </div>
    </div>
  )
}
