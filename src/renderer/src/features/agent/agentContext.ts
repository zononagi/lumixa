import { getActiveEditor } from '@renderer/lib/editorBridge'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useBrainStore } from '@renderer/stores/brainStore'
import { readUserFacts } from '@renderer/stores/skillMemoryStore'
import { allFacts, deriveFacts, formatFacts } from '@renderer/features/memory/skillMemory'
import { useMarkersStore, type Problem } from '@renderer/features/problems/markersStore'

/**
 * Editor / workspace context that can be attached to a Claude Code message so a
 * beginner never has to describe their code or paste file paths by hand.
 *
 * Gathering is lazy: attachments are resolved to text only at send time, so an
 * attached "Selection" always reflects what is selected *now*, not when it was
 * toggled. The pure formatting helpers (`formatBlock`, `composeMessage`) are
 * unit-tested; the store-reading gatherers are thin and side-effect free.
 */
export type ContextKind = 'file' | 'selection' | 'workspace' | 'problems' | 'gitDiff' | 'knowledge'

export interface ContextBlock {
  kind: ContextKind
  /** Short chip label, e.g. "Selection (App.tsx)". */
  label: string
  /** Fenced/markdown body inserted above the user's prompt. */
  text: string
}

const MAX_BLOCK_CHARS = 12_000

function relPath(path: string): string {
  const root = useWorkspaceStore.getState().root
  if (root && path.startsWith(root)) return path.slice(root.length).replace(/^[\\/]/, '')
  return path.split(/[\\/]/).pop() ?? path
}

function fenceFor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'ts',
    tsx: 'tsx',
    js: 'js',
    jsx: 'jsx',
    json: 'json',
    css: 'css',
    html: 'html',
    md: 'markdown',
    py: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    sh: 'bash'
  }
  return map[ext] ?? ''
}

function clamp(s: string): string {
  return s.length > MAX_BLOCK_CHARS ? s.slice(0, MAX_BLOCK_CHARS) + '\n… (truncated)' : s
}

// ---------------------------------------------------------------------------
// Availability — which context kinds make sense right now
// ---------------------------------------------------------------------------

export interface ContextAvailability {
  file: boolean
  selection: boolean
  workspace: boolean
  problems: boolean
  gitDiff: boolean
  knowledge: boolean
}

/** True when the active editor has a non-empty text selection. */
export function hasSelection(): boolean {
  const active = getActiveEditor()
  const sel = active?.editor.getSelection()
  return !!sel && !sel.isEmpty()
}

export function contextAvailability(): ContextAvailability {
  const editor = useEditorStore.getState()
  const root = useWorkspaceStore.getState().root
  const problems = useMarkersStore.getState().problems
  return {
    file: editor.activePath != null,
    selection: hasSelection(),
    workspace: root != null,
    problems: problems.length > 0,
    gitDiff: root != null,
    knowledge: root != null
  }
}

// ---------------------------------------------------------------------------
// Pure formatting (unit-tested)
// ---------------------------------------------------------------------------

export function formatBlock(block: ContextBlock): string {
  return `### ${block.label}\n${clamp(block.text)}`
}

/**
 * Assemble the final message: a "Context" preamble (if any) followed by the
 * user's prompt. Returns the prompt unchanged when there are no blocks.
 */
export function composeMessage(userText: string, blocks: ContextBlock[]): string {
  if (blocks.length === 0) return userText
  const preamble = blocks.map(formatBlock).join('\n\n')
  return `The user is working in Lumixa and attached this context:\n\n${preamble}\n\n---\n\n${userText}`
}

export function problemsToText(problems: Problem[]): string {
  const lines = problems
    .slice(0, 50)
    .map((p) => {
      const sev = p.severity >= 8 ? 'error' : 'warning'
      return `- ${sev} ${p.path}:${p.line}:${p.column} — ${p.message}${p.code ? ` (${p.code})` : ''}`
    })
  return lines.join('\n') || '(no problems reported)'
}

// ---------------------------------------------------------------------------
// Gatherers — resolve a ContextKind to a block at send time
// ---------------------------------------------------------------------------

async function buildFile(): Promise<ContextBlock | null> {
  const editor = useEditorStore.getState()
  const tab = editor.tabs.find((t) => t.path === editor.activePath)
  if (!tab) return null
  return {
    kind: 'file',
    label: `Current file (${tab.name})`,
    text: `${relPath(tab.path)}\n\n\`\`\`${fenceFor(tab.name)}\n${tab.content}\n\`\`\``
  }
}

function buildSelection(): ContextBlock | null {
  const active = getActiveEditor()
  const sel = active?.editor.getSelection()
  const model = active?.editor.getModel()
  if (!active || !sel || sel.isEmpty() || !model) return null
  const text = model.getValueInRange(sel)
  const name = model.uri.path.split('/').pop() ?? 'selection'
  return {
    kind: 'selection',
    label: `Selection (${name})`,
    text: `${name} lines ${sel.startLineNumber}-${sel.endLineNumber}\n\n\`\`\`${fenceFor(name)}\n${text}\n\`\`\``
  }
}

function buildWorkspace(): ContextBlock | null {
  const ws = useWorkspaceStore.getState()
  if (!ws.root) return null
  return {
    kind: 'workspace',
    label: `Workspace (${ws.rootName ?? 'folder'})`,
    text: `Working folder: ${ws.root}`
  }
}

function buildProblems(): ContextBlock | null {
  const problems = useMarkersStore.getState().problems
  if (problems.length === 0) return null
  return {
    kind: 'problems',
    label: `Problems (${problems.length})`,
    text: '```\n' + problemsToText(problems) + '\n```'
  }
}

function buildKnowledge(): ContextBlock | null {
  const root = useWorkspaceStore.getState().root
  if (!root) return null
  const brain = useBrainStore.getState().brain
  const facts = allFacts(deriveFacts(brain?.summary ?? null, brain?.files ?? []), readUserFacts(root))
  if (facts.length === 0) return null
  return { kind: 'knowledge', label: `Project knowledge (${facts.length})`, text: formatFacts(facts) }
}

async function buildGitDiff(): Promise<ContextBlock | null> {
  const root = useWorkspaceStore.getState().root
  if (!root) return null
  let diff = ''
  try {
    diff = await window.lumixa.git.workingDiff(root)
  } catch {
    return null
  }
  if (!diff.trim()) return null
  return { kind: 'gitDiff', label: 'Git diff', text: '```diff\n' + diff + '\n```' }
}

/** Resolve the selected kinds to blocks, dropping any that are empty right now. */
export async function gatherContext(kinds: ContextKind[]): Promise<ContextBlock[]> {
  const blocks: ContextBlock[] = []
  for (const kind of kinds) {
    let block: ContextBlock | null = null
    if (kind === 'file') block = await buildFile()
    else if (kind === 'selection') block = buildSelection()
    else if (kind === 'workspace') block = buildWorkspace()
    else if (kind === 'problems') block = buildProblems()
    else if (kind === 'gitDiff') block = await buildGitDiff()
    else if (kind === 'knowledge') block = buildKnowledge()
    if (block) blocks.push(block)
  }
  return blocks
}

/** Short label for a context chip / menu item. */
export const CONTEXT_META: Record<ContextKind, { icon: string; mention: string }> = {
  file: { icon: '📄', mention: '@file' },
  selection: { icon: '✂', mention: '@selection' },
  workspace: { icon: '🗂', mention: '@workspace' },
  problems: { icon: '⚠', mention: '@problems' },
  gitDiff: { icon: '⑂', mention: '@git' },
  knowledge: { icon: '📓', mention: '@knowledge' }
}
