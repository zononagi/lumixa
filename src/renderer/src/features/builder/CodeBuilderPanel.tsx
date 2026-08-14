import { useMemo, useState, type JSX } from 'react'
import { getActiveEditor, runEditorAction } from '@renderer/lib/editorBridge'
import { useNotifyStore } from '@renderer/stores/notifyStore'
import { useT } from '@renderer/i18n'
import { BUILDER_KINDS, buildCode, type BuilderSpec, type Prop } from './codeBuilder'

/**
 * Code Builder panel (spec §17–§27). A beginner fills a small form, sees a live
 * Preview, and inserts the generated code at the cursor. Insertion is followed
 * by Format Document, so the editor's own formatter owns indentation (§26).
 */
export function CodeBuilderPanel(): JSX.Element {
  const t = useT()
  const notify = useNotifyStore((s) => s.notify)
  const [kind, setKind] = useState<BuilderSpec['kind']>('function')
  const [f, setF] = useState({
    name: '',
    type: '',
    value: '',
    declaration: 'const' as 'const' | 'let',
    params: '',
    returnType: '',
    async: false,
    props: 'id: number\nname: string',
    style: 'forOf' as 'for' | 'forOf' | 'forEach' | 'while',
    iterable: '',
    item: 'item',
    condition: '',
    url: '',
    operation: ''
  })

  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]): void => setF((p) => ({ ...p, [k]: v }))

  const spec = useMemo<BuilderSpec>(() => toSpec(kind, f), [kind, f])
  const preview = useMemo(() => buildCode(spec), [spec])

  const insert = (): void => {
    const ok = insertAtCursor(preview)
    notify(
      ok ? 'success' : 'warn',
      ok ? t('builder.inserted') : t('builder.noEditor')
    )
  }

  return (
    <div className="sidebar builder">
      <div className="sidebar-header">
        <span>{t('builder.title')}</span>
      </div>
      <div className="builder-body">
        <label className="builder-label">{t('builder.what')}</label>
        <select value={kind} onChange={(e) => setKind(e.target.value as BuilderSpec['kind'])}>
          {BUILDER_KINDS.map((k) => (
            <option key={k.kind} value={k.kind}>
              {t(k.labelKey)}
            </option>
          ))}
        </select>

        <div className="builder-fields">
          {(kind === 'variable' || kind === 'function' || kind === 'interface' || kind === 'component' || kind === 'apiRequest') && (
            <Field label={t('builder.name')} value={f.name} onChange={(v) => set('name', v)} />
          )}

          {kind === 'variable' && (
            <>
              <Field label={t('builder.type')} value={f.type} onChange={(v) => set('type', v)} />
              <Field label={t('builder.value')} value={f.value} onChange={(v) => set('value', v)} />
              <Select
                label="const / let"
                value={f.declaration}
                options={['const', 'let']}
                onChange={(v) => set('declaration', v as 'const' | 'let')}
              />
            </>
          )}

          {kind === 'function' && (
            <>
              <Field label={t('builder.params')} value={f.params} onChange={(v) => set('params', v)} />
              <Field label={t('builder.returnType')} value={f.returnType} onChange={(v) => set('returnType', v)} />
              <Check label={t('builder.async')} checked={f.async} onChange={(v) => set('async', v)} />
            </>
          )}

          {kind === 'interface' && (
            <TextArea label={t('builder.props')} value={f.props} onChange={(v) => set('props', v)} />
          )}

          {kind === 'loop' && (
            <>
              <Select
                label={t('builder.loopStyle')}
                value={f.style}
                options={['forOf', 'for', 'forEach', 'while']}
                onChange={(v) => set('style', v as typeof f.style)}
              />
              <Field label={t('builder.iterable')} value={f.iterable} onChange={(v) => set('iterable', v)} />
              <Field label={t('builder.item')} value={f.item} onChange={(v) => set('item', v)} />
            </>
          )}

          {kind === 'condition' && (
            <Field label={t('builder.condition')} value={f.condition} onChange={(v) => set('condition', v)} />
          )}

          {kind === 'apiRequest' && (
            <>
              <Field label="URL" value={f.url} onChange={(v) => set('url', v)} />
              <Field label={t('builder.returnType')} value={f.returnType} onChange={(v) => set('returnType', v)} />
            </>
          )}

          {kind === 'tryCatch' && (
            <Field label={t('builder.operation')} value={f.operation} onChange={(v) => set('operation', v)} />
          )}
        </div>

        <label className="builder-label">{t('builder.preview')}</label>
        <pre className="builder-preview">{preview}</pre>

        <button className="builder-insert" onClick={insert}>
          {t('builder.insert')}
        </button>
      </div>
    </div>
  )
}

function toSpec(kind: BuilderSpec['kind'], f: Record<string, unknown>): BuilderSpec {
  const s = (k: string): string => (f[k] as string) || ''
  switch (kind) {
    case 'variable':
      return { kind, name: s('name') || 'value', type: s('type') || undefined, value: s('value') || undefined, declaration: f.declaration as 'const' | 'let' }
    case 'function':
      return { kind, name: s('name') || 'doSomething', params: s('params'), returnType: s('returnType') || undefined, async: f.async as boolean }
    case 'interface':
      return { kind, name: s('name') || 'Model', props: parseProps(s('props')) }
    case 'component':
      return { kind, name: s('name') || 'Component' }
    case 'loop':
      return { kind, style: f.style as 'for' | 'forOf' | 'forEach' | 'while', iterable: s('iterable') || 'items', item: s('item') || 'item' }
    case 'condition':
      return { kind, condition: s('condition') || 'condition' }
    case 'apiRequest':
      return { kind, name: s('name') || 'fetchData', url: s('url') || '/api', responseType: s('returnType') || 'unknown' }
    case 'tryCatch':
      return { kind, operation: s('operation') || 'doWork()' }
  }
}

function parseProps(text: string): Prop[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [name, ...rest] = l.split(':')
      return { name: name.trim(), type: rest.join(':').trim() || 'unknown' }
    })
}

function insertAtCursor(code: string): boolean {
  const active = getActiveEditor()
  if (!active) return false
  const { editor } = active
  const selection = editor.getSelection()
  const pos = editor.getPosition()
  if (!selection && !pos) return false
  const range = selection ?? {
    startLineNumber: pos!.lineNumber,
    startColumn: pos!.column,
    endLineNumber: pos!.lineNumber,
    endColumn: pos!.column
  }
  editor.executeEdits('code-builder', [{ range, text: code, forceMoveMarkers: true }])
  editor.focus()
  runEditorAction('editor.action.formatDocument')
  return true
}

// --- tiny form primitives ---
function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }): JSX.Element {
  return (
    <label className="builder-field">
      <span>{label}</span>
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
function TextArea({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }): JSX.Element {
  return (
    <label className="builder-field">
      <span>{label}</span>
      <textarea value={value} rows={4} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }): JSX.Element {
  return (
    <label className="builder-field">
      <span>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
    </label>
  )
}
function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }): JSX.Element {
  return (
    <label className="builder-check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  )
}
