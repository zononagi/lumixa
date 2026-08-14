import { useEffect, useState, type JSX } from 'react'
import type { ShellInfo } from '@shared/ipc'
import { useUiStore } from '@renderer/stores/uiStore'
import { useMarkersStore } from '@renderer/features/problems/markersStore'
import { ProblemsPanel } from '@renderer/features/problems/ProblemsPanel'
import { WhatsNextPanel } from '@renderer/features/whatsnext/WhatsNextPanel'
import { explainCommand } from '@renderer/lib/explainCommand'
import { useT, useI18nStore } from '@renderer/i18n'
import { TerminalView } from './TerminalView'

/** Bottom dock with Terminal / Problems tabs. */
export function BottomPanel(): JSX.Element | null {
  const open = useUiStore((s) => s.terminalOpen)
  const setTerminal = useUiStore((s) => s.setTerminal)
  const tab = useUiStore((s) => s.bottomTab)
  const setBottomTab = useUiStore((s) => s.setBottomTab)
  const problemCount = useMarkersStore((s) => s.problems.length)
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
        <button
          className={`bottom-tab ${tab === 'terminal' ? 'active' : ''}`}
          onClick={() => setBottomTab('terminal')}
        >
          {t('terminal.title')}
        </button>
        <button
          className={`bottom-tab ${tab === 'problems' ? 'active' : ''}`}
          onClick={() => setBottomTab('problems')}
        >
          {t('problems.title')}
          {problemCount > 0 ? ` (${problemCount})` : ''}
        </button>
        <button
          className={`bottom-tab ${tab === 'whatsnext' ? 'active' : ''}`}
          onClick={() => setBottomTab('whatsnext')}
        >
          {t('next.title')}
        </button>
        {tab === 'terminal' && (
          <select value={shellPath} onChange={(e) => setShellPath(e.target.value)}>
            {shells.map((s) => (
              <option key={s.id} value={s.path}>
                {s.label}
              </option>
            ))}
          </select>
        )}
        <div style={{ flex: 1 }} />
        <button title={t('terminal.close')} onClick={() => setTerminal(false)}>
          ✕
        </button>
      </div>
      {/* body + optional command helper rendered below */}
      <div className="bottom-body">
        {/* Keep the terminal mounted across tab switches; just hide it. */}
        <div style={{ height: '100%', display: tab === 'terminal' ? 'block' : 'none' }}>
          {shellPath && <TerminalView key={shellPath} shellPath={shellPath} visible={open && tab === 'terminal'} />}
        </div>
        {tab === 'problems' && <ProblemsPanel />}
        {tab === 'whatsnext' && <WhatsNextPanel />}
      </div>
      {tab === 'terminal' && <CommandHelper />}
    </div>
  )
}

/** Command Explanation (spec §50): type/paste a command to understand it before
 *  running — so beginners don't have to leave the IDE to search for it. */
function CommandHelper(): JSX.Element {
  const t = useT()
  const ja = useI18nStore((s) => s.locale) === 'ja'
  const [cmd, setCmd] = useState('')
  const explanation = explainCommand(cmd, ja ? 'ja' : 'en')
  return (
    <div className="cmd-helper">
      <input
        value={cmd}
        placeholder={t('terminal.explainPlaceholder')}
        onChange={(e) => setCmd(e.target.value)}
      />
      {cmd.trim() && (
        <span className={`cmd-explain ${explanation ? '' : 'unknown'}`}>
          {explanation ?? t('terminal.explainUnknown')}
        </span>
      )}
    </div>
  )
}
