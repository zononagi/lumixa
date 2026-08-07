import type { EditorTab } from '@renderer/stores/editorStore'

/**
 * Composer edit protocol. We ask the model to emit whole-file replacements in a
 * delimited block format that is trivial and robust to parse (streaming-safe,
 * no JSON escaping pitfalls).
 */
export const COMPOSER_SYSTEM = `You are Lumixa Composer, a precise multi-file code editor.
When asked to make changes, respond with the FULL new content of each file you change, using EXACTLY this format and nothing else:

<<<FILE path/to/file.ext>>>
<the complete new file content>
<<<END>>>

Rules:
- Use the same file paths given in the context.
- Emit a block only for files you actually change or create.
- Output the ENTIRE file content, not a diff or a fragment.
- Do not add commentary, explanations, or markdown fences around the blocks.`

export interface ProposedEdit {
  path: string
  newContent: string
}

/** Build the user message: the instruction plus the current open files. */
export function buildContext(instruction: string, tabs: EditorTab[]): string {
  const files = tabs
    .map((t) => `<<<FILE ${t.path}>>>\n${t.content}\n<<<END>>>`)
    .join('\n\n')
  return `# Instruction\n${instruction}\n\n# Open files (current content)\n${
    files || '(no files open — you may create new files)'
  }`
}

const BLOCK_RE = /<<<FILE (.+?)>>>\r?\n([\s\S]*?)\r?\n<<<END>>>/g

export function parseEdits(text: string): ProposedEdit[] {
  const edits: ProposedEdit[] = []
  let m: RegExpExecArray | null
  BLOCK_RE.lastIndex = 0
  while ((m = BLOCK_RE.exec(text)) !== null) {
    edits.push({ path: m[1].trim(), newContent: m[2] })
  }
  return edits
}
