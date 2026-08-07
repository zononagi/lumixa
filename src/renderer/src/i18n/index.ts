import { create } from 'zustand'
import { en } from './locales/en'
import { ja } from './locales/ja'
import { ko } from './locales/ko'

/**
 * Minimal, dependency-free i18n. `en` defines the key set; other locales must
 * match its shape. `t(key, vars)` interpolates `{name}` placeholders and falls
 * back to English for any missing key. Locale choice persists in localStorage.
 */
export type Locale = 'ja' | 'en' | 'ko'
export type TKey = keyof typeof en

export const LOCALES: { id: Locale; label: string }[] = [
  { id: 'ja', label: '日本語' },
  { id: 'en', label: 'English' },
  { id: 'ko', label: '한국어' }
]

const dicts: Record<Locale, typeof en> = { en, ja, ko }

function detect(): Locale {
  const stored = localStorage.getItem('lumixa.locale') as Locale | null
  if (stored && dicts[stored]) return stored
  const nav = navigator.language.toLowerCase()
  if (nav.startsWith('ja')) return 'ja'
  if (nav.startsWith('ko')) return 'ko'
  return 'en'
}

interface I18nState {
  locale: Locale
  setLocale: (l: Locale) => void
}

export const useI18nStore = create<I18nState>((set) => ({
  locale: detect(),
  setLocale: (l) => {
    localStorage.setItem('lumixa.locale', l)
    set({ locale: l })
  }
}))

/** Hook returning a translate function bound to the current locale. */
export function useT(): (key: TKey, vars?: Record<string, string | number>) => string {
  const locale = useI18nStore((s) => s.locale)
  return (key, vars) => {
    let s: string = dicts[locale][key] ?? en[key] ?? key
    if (vars) for (const k of Object.keys(vars)) s = s.split(`{${k}}`).join(String(vars[k]))
    return s
  }
}
