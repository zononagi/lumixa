import { create } from 'zustand'
import type { SkillFact } from '@renderer/features/memory/skillMemory'

/**
 * User-stated project rules for Skill Memory (spec §33-§35). Auto-derived facts
 * are computed live elsewhere; this store only owns the rules the user typed,
 * persisted per workspace. Every user rule is sourced as "user instruction" with
 * high confidence (they said it) — we never fabricate rules.
 */
const keyFor = (root: string): string => `lumixa.skills.${root}`

function load(root: string): SkillFact[] {
  try {
    const raw = localStorage.getItem(keyFor(root))
    return raw ? (JSON.parse(raw) as SkillFact[]) : []
  } catch {
    return []
  }
}
function save(root: string, facts: SkillFact[]): void {
  try {
    localStorage.setItem(keyFor(root), JSON.stringify(facts))
  } catch {
    /* ignore quota */
  }
}

interface SkillMemoryState {
  root: string | null
  userFacts: SkillFact[]
  loadFor: (root: string) => void
  add: (text: string) => void
  remove: (id: string) => void
}

/** Read the current user rules for a workspace without React (for agentContext). */
export function readUserFacts(root: string): SkillFact[] {
  return load(root)
}

export const useSkillMemoryStore = create<SkillMemoryState>((set, get) => ({
  root: null,
  userFacts: [],

  loadFor: (root) => set({ root, userFacts: load(root) }),

  add: (text) => {
    const root = get().root
    const clean = text.trim()
    if (!root || !clean) return
    const fact: SkillFact = {
      id: `u:${Date.now().toString(36)}`,
      text: clean.slice(0, 200),
      source: 'user instruction',
      confidence: 'high'
    }
    const userFacts = [...get().userFacts, fact]
    save(root, userFacts)
    set({ userFacts })
  },

  remove: (id) => {
    const root = get().root
    if (!root) return
    const userFacts = get().userFacts.filter((f) => f.id !== id)
    save(root, userFacts)
    set({ userFacts })
  }
}))
