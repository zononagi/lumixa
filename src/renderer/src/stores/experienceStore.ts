import { create } from 'zustand'

/**
 * Experience level (spec §3–§5). Controls how much hand-holding vs. raw detail
 * the UI surfaces. This is the Phase-1 foundation the beginner features build on:
 *
 *  - beginner : friendly language, What's Next front-and-centre, extra guidance.
 *  - developer: guidance available on demand, but speed-first defaults.
 *  - expert   : raw diagnostics / advanced detail, minimal beginner UI.
 *
 * The mode never *removes* capability — it only changes defaults and how much
 * explanatory UI is shown, so it can't get an advanced user stuck (spec §5, §93.6).
 */
export type ExperienceMode = 'beginner' | 'developer' | 'expert'

const KEY = 'lumixa.experienceMode'

function detect(): ExperienceMode {
  const stored = localStorage.getItem(KEY) as ExperienceMode | null
  if (stored === 'beginner' || stored === 'developer' || stored === 'expert') return stored
  return 'developer' // safe default: full capability, guidance on demand
}

interface ExperienceState {
  mode: ExperienceMode
  setMode: (m: ExperienceMode) => void
  /** Show extra beginner explanations / plain-language labels. */
  showBeginnerHelp: boolean
  /** Show raw diagnostics / advanced technical detail by default. */
  showRawDetail: boolean
}

function derive(mode: ExperienceMode): Pick<ExperienceState, 'showBeginnerHelp' | 'showRawDetail'> {
  return {
    showBeginnerHelp: mode === 'beginner',
    showRawDetail: mode === 'expert'
  }
}

export const useExperienceStore = create<ExperienceState>((set) => {
  const mode = detect()
  return {
    mode,
    ...derive(mode),
    setMode: (m) => {
      localStorage.setItem(KEY, m)
      set({ mode: m, ...derive(m) })
    }
  }
})
