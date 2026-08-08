import type * as Monaco from 'monaco-editor'
import { useI18nStore } from '@renderer/i18n'
import { explainApi, explainError } from './knowledgeBase'

/**
 * Learning Mode — augments Monaco's built-in hovers with plain-language
 * explanations of common APIs and of any compiler error on the hovered line.
 * Non-AI: text comes from the static knowledge base.
 */

const LANGUAGES = ['typescript', 'javascript', 'typescriptreact', 'javascriptreact']

let registered = false

export function installLearningHovers(monaco: typeof Monaco): void {
  if (registered) return
  registered = true

  const provider: Monaco.languages.HoverProvider = {
    provideHover(model, position) {
      const locale = useI18nStore.getState().locale === 'ja' ? 'ja' : 'en'
      const contents: Monaco.IMarkdownString[] = []

      const word = model.getWordAtPosition(position)?.word
      const api = word ? explainApi(word) : undefined
      if (api) contents.push({ value: `**📘 ${word}** — ${api[locale]}` })

      // Explain any diagnostic covering this position.
      for (const m of monaco.editor.getModelMarkers({ resource: model.uri })) {
        if (
          m.startLineNumber <= position.lineNumber &&
          m.endLineNumber >= position.lineNumber
        ) {
          const err = explainError(typeof m.code === 'object' ? m.code?.value : m.code)
          if (err) contents.push({ value: `**💡 ${locale === 'ja' ? 'このエラーの意味' : 'What this error means'}** — ${err[locale]}` })
        }
      }

      if (contents.length === 0) return null
      return { contents }
    }
  }

  for (const language of LANGUAGES) {
    monaco.languages.registerHoverProvider(language, provider)
  }
}
