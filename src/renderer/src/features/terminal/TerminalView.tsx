import { useEffect, useRef, type JSX } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { checkDanger } from '@renderer/lib/danger'
import { setTerminalRunner } from '@renderer/lib/terminalBridge'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useT } from '@renderer/i18n'

/**
 * A single xterm.js terminal bound to a main-process shell.
 *
 * The shell reads whole commands from its stdin pipe and owns the prompt and
 * command echo (PowerShell/cmd print `PS>` / `C:\>` and echo the line). We give
 * live typing feedback by echoing keystrokes locally, then erase that local
 * echo on Enter so the shell's own echo isn't duplicated. Destructive commands
 * are gated behind a confirmation before being sent.
 */
export function TerminalView({
  shellPath,
  visible
}: {
  shellPath: string
  visible: boolean
}): JSX.Element {
  const hostRef = useRef<HTMLDivElement>(null)
  const fitRef = useRef<FitAddon | null>(null)
  const cwd = useWorkspaceStore((s) => s.root)
  const t = useT()
  const tRef = useRef(t)
  tRef.current = t

  useEffect(() => {
    const host = hostRef.current
    if (!host) return

    const id = 'term-' + Math.random().toString(36).slice(2)
    const term = new Terminal({
      fontFamily: "'Cascadia Code', 'Consolas', monospace",
      fontSize: 13,
      cursorBlink: true,
      theme: { background: '#1e1e1e', foreground: '#cccccc', cursor: '#cccccc' }
    })
    const fit = new FitAddon()
    fitRef.current = fit
    term.loadAddon(fit)
    term.open(host)
    fit.fit()

    term.write(`\x1b[90m${tRef.current('terminal.intro')}\x1b[0m\r\n`)

    let line = ''

    const send = (data: string): void => void window.lumixa.terminal.input(id, data)

    const onData = term.onData((data) => {
      for (const ch of data) {
        if (ch === '\r') {
          const cmd = line
          // Erase our local echo; the shell will echo the command itself.
          if (line.length) term.write('\b \b'.repeat(line.length))
          line = ''

          const verdict = checkDanger(cmd)
          if (verdict.dangerous) {
            const ok = window.confirm(
              tRef.current('terminal.dangerConfirm', {
                cmd,
                reason: verdict.reason ?? ''
              })
            )
            if (!ok) {
              term.write(`\r\n\x1b[33m${tRef.current('terminal.cancelled')}\x1b[0m`)
              send('\n') // nudge a fresh prompt
              continue
            }
          }
          send(cmd + '\n')
        } else if (ch === '\x7f') {
          if (line.length > 0) {
            line = line.slice(0, -1)
            term.write('\b \b')
          }
        } else if (ch === '\x03') {
          line = ''
          term.write('^C')
          send('\n')
        } else if (ch >= ' ') {
          line += ch
          term.write(ch)
        }
      }
    })

    // Let other features (Beginner Assistant) run a command here. Echoes it
    // locally for visibility, then sends it through the same shell pipe.
    setTerminalRunner((cmd) => {
      term.focus()
      term.write(`\r\n${cmd}`)
      term.write('\b \b'.repeat(cmd.length))
      send(cmd + '\n')
    })

    const offData = window.lumixa.terminal.onData((e) => {
      if (e.id === id) term.write(e.data)
    })
    const offExit = window.lumixa.terminal.onExit((e) => {
      if (e.id === id) term.write(`\r\n\x1b[90m[process exited: ${e.code ?? 0}]\x1b[0m\r\n`)
    })

    void window.lumixa.terminal.create({
      id,
      shellPath,
      cwd: cwd ?? undefined,
      cols: term.cols,
      rows: term.rows
    })

    const onResize = (): void => fit.fit()
    window.addEventListener('resize', onResize)

    return () => {
      onData.dispose()
      offData()
      offExit()
      setTerminalRunner(null)
      window.removeEventListener('resize', onResize)
      void window.lumixa.terminal.kill(id)
      term.dispose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shellPath])

  useEffect(() => {
    if (visible) setTimeout(() => fitRef.current?.fit(), 30)
  }, [visible])

  return <div className="term-host" ref={hostRef} />
}
