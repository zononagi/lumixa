import { promises as fs } from 'node:fs'
import { join } from 'node:path'

/**
 * Project Memory. Gathers the well-known context files at the workspace root so
 * the AI automatically "knows" the project on every request — READMEs, agent
 * instruction files, a Lumixa notes file, and package metadata.
 */
const CONTEXT_FILES = [
  'LUMIXA.md',
  'lumixa.md',
  'CLAUDE.md',
  'AGENTS.md',
  'README.md',
  'package.json',
  'tsconfig.json',
  '.gitignore'
]

const PER_FILE_LIMIT = 6000 // chars, to keep the prompt bounded
const TOTAL_LIMIT = 20000

export async function buildProjectContext(root: string): Promise<string> {
  const parts: string[] = []
  let total = 0
  for (const name of CONTEXT_FILES) {
    if (total >= TOTAL_LIMIT) break
    try {
      let content = await fs.readFile(join(root, name), 'utf-8')
      if (content.length > PER_FILE_LIMIT) {
        content = content.slice(0, PER_FILE_LIMIT) + '\n…(truncated)'
      }
      const block = `--- ${name} ---\n${content}`
      parts.push(block)
      total += block.length
    } catch {
      // file not present — skip
    }
  }
  if (parts.length === 0) return ''
  return `# Project context (auto-loaded by Lumixa)\n\n${parts.join('\n\n')}`
}
