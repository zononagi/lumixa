import { PROJECT_TEMPLATES } from '@shared/create'

/**
 * Project Creation planning helpers (spec §3-§8). Turn a free-text description
 * into a recommended template, a project name, and a feature checklist — with
 * smart defaults so beginners aren't asked to make lots of technical choices
 * (§5). Pure + unit-tested. Claude Code can refine later; this always works.
 */

/** Node-ish intents route to the Node template; everything else defaults to web (§5). */
const NODE_HINTS = /\b(cli|command[- ]?line|server|api|backend|bot|script|daemon|worker|discord|webhook|graphql|rest api)\b/i

export function detectTemplate(description: string): string {
  if (NODE_HINTS.test(description)) return 'node-ts'
  return 'react-ts-vite'
}

/** Curated keyword → feature-label map (kept small + high-precision). */
const FEATURE_MAP: [RegExp, string][] = [
  [/\b(login|log ?in|sign ?in|sign ?up|auth|authentication|account)\b/i, 'Authentication'],
  [/\bdark ?mode|theme\b/i, 'Dark mode'],
  [/\bsearch\b/i, 'Search'],
  [/\b(cart|checkout|payment|stripe|billing)\b/i, 'Cart & checkout'],
  [/\b(chat|messaging|message)\b/i, 'Chat / messaging'],
  [/\b(upload|file upload|drag ?and ?drop)\b/i, 'File upload'],
  [/\bplaylist\b/i, 'Playlist'],
  [/\b(waveform|audio|music|player)\b/i, 'Audio playback'],
  [/\b(dashboard|admin|analytics|chart|graph)\b/i, 'Dashboard'],
  [/\b(comment|comments|like|likes|rating)\b/i, 'Comments & likes'],
  [/\b(video|stream|streaming)\b/i, 'Video'],
  [/\b(profile|settings|preferences)\b/i, 'User profile / settings'],
  [/\b(notification|notify|alert)\b/i, 'Notifications'],
  [/\b(realtime|real[- ]time|websocket|live)\b/i, 'Realtime updates'],
  [/\b(map|maps|location|geo)\b/i, 'Maps / location'],
  [/\b(i18n|translation|multilingual|language)\b/i, 'Internationalization']
]

export function detectFeatures(description: string): string[] {
  const out: string[] = []
  for (const [re, label] of FEATURE_MAP) {
    if (re.test(description) && !out.includes(label)) out.push(label)
  }
  return out
}

/** Turn a phrase into a safe, npm-friendly project folder name. */
export function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return slug || 'my-app'
}

/**
 * Suggest a project name from the description: prefer an explicit "X app/site/
 * tool" phrase, else the first few meaningful words, else a default.
 */
export function suggestName(description: string): string {
  // Capture the 1-2 words right before an "app/site/tool/…" keyword.
  const m = description.match(
    /([A-Za-z0-9]+(?:\s+[A-Za-z0-9]+)?)\s+(app|site|website|tool|dashboard|game|bot|api)\b/i
  )
  if (m) return slugify(`${m[1]} ${m[2]}`)
  const words = (description.match(/[A-Za-z][A-Za-z0-9]+/g) ?? []).slice(0, 3)
  return words.length ? slugify(words.join(' ')) : 'my-app'
}

export interface ProjectPlan {
  name: string
  templateId: string
  features: string[]
}

export function analyzeDescription(description: string): ProjectPlan {
  return {
    name: suggestName(description),
    templateId: detectTemplate(description),
    features: detectFeatures(description)
  }
}

export function templateName(id: string): string {
  return PROJECT_TEMPLATES.find((t) => t.id === id)?.name ?? id
}

/** Prompt for Claude Code to implement the requested features after scaffolding. */
export function buildImplementPrompt(description: string, features: string[]): string {
  return (
    `This is a freshly scaffolded project. Implement what the user asked for, following the ` +
    `existing setup and conventions. Build incrementally and keep it runnable.\n\n` +
    `## Goal\n${description}\n\n` +
    (features.length ? `## Features to cover\n${features.map((f) => `- ${f}`).join('\n')}\n` : '')
  )
}
