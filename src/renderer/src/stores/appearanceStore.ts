import { create } from 'zustand'
import * as monaco from 'monaco-editor'
import type { WindowEffect } from '@shared/ipc'

/**
 * Appearance: Windows 11 Mica/Acrylic backdrop, UI translucency, a background
 * image/video ("Background Cover"-style), and VS Code-compatible themes.
 *
 * The store is the single source of truth for the shell's CSS colour variables
 * so translucency and imported themes compose cleanly. Settings persist to
 * localStorage and re-apply on startup.
 */

export type ThemeMode = 'dark' | 'light' | 'custom'
export type BackgroundType = 'none' | 'image' | 'video'

/** Colours a theme contributes to the shell (hex, no alpha). */
interface Palette {
  bg: string
  elevated: string
  activitybar: string
  border: string
  fg: string
  muted: string
  accent: string
}

const DARK: Palette = {
  bg: '#1e1e1e',
  elevated: '#252526',
  activitybar: '#333333',
  border: '#2b2b2b',
  fg: '#cccccc',
  muted: '#858585',
  accent: '#0e639c'
}
const LIGHT: Palette = {
  bg: '#ffffff',
  elevated: '#f3f3f3',
  activitybar: '#e8e8e8',
  border: '#dcdcdc',
  fg: '#1f1f1f',
  muted: '#6a6a6a',
  accent: '#0067c0'
}

/** A parsed VS Code theme mapped for Monaco + the shell palette. */
export interface CustomTheme {
  name: string
  base: 'vs' | 'vs-dark' | 'hc-black'
  rules: monaco.editor.ITokenThemeRule[]
  colors: Record<string, string>
  palette: Palette
}

interface Background {
  type: BackgroundType
  url: string
}

interface AppearanceState {
  effect: WindowEffect
  opacity: number // surface alpha when translucent (0.3–1)
  background: Background
  dim: number // 0–0.85 dark overlay over the background
  mode: ThemeMode
  custom: CustomTheme | null

  monacoTheme: string
  setEffect: (e: WindowEffect) => void
  setOpacity: (o: number) => void
  setBackground: (b: Background) => void
  setDim: (d: number) => void
  setMode: (m: 'dark' | 'light') => void
  setCustomTheme: (t: CustomTheme) => void
  init: () => void
}

const STORE_KEY = 'lumixa.appearance'

interface Persisted {
  effect: WindowEffect
  opacity: number
  background: Background
  dim: number
  mode: ThemeMode
  custom: CustomTheme | null
}

function load(): Persisted {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (raw) return JSON.parse(raw) as Persisted
  } catch {
    /* ignore */
  }
  return {
    effect: 'none',
    opacity: 0.85,
    background: { type: 'none', url: '' },
    dim: 0.35,
    mode: 'dark',
    custom: null
  }
}

const hexToRgb = (hex: string): string => {
  const h = hex.replace('#', '')
  const n = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6)
  const int = parseInt(n, 16)
  return `${(int >> 16) & 255}, ${(int >> 8) & 255}, ${int & 255}`
}

const rgba = (hex: string, a: number): string => `rgba(${hexToRgb(hex)}, ${a})`

export const useAppearanceStore = create<AppearanceState>((set, get) => {
  const persist = (): void => {
    const { effect, opacity, background, dim, mode, custom } = get()
    localStorage.setItem(STORE_KEY, JSON.stringify({ effect, opacity, background, dim, mode, custom }))
  }

  const apply = (): void => {
    const { effect, opacity, mode, custom, background } = get()
    const root = document.documentElement

    const palette = mode === 'custom' && custom ? custom.palette : mode === 'light' ? LIGHT : DARK
    const translucent = effect !== 'none' || background.type !== 'none'
    const alpha = translucent ? opacity : 1

    root.style.setProperty('--bg', rgba(palette.bg, alpha))
    root.style.setProperty('--bg-elevated', rgba(palette.elevated, alpha))
    root.style.setProperty('--bg-activitybar', rgba(palette.activitybar, alpha))
    root.style.setProperty('--border', palette.border)
    root.style.setProperty('--fg', palette.fg)
    root.style.setProperty('--fg-muted', palette.muted)
    root.style.setProperty('--accent', palette.accent)
    if (translucent) root.setAttribute('data-translucent', '')
    else root.removeAttribute('data-translucent')

    // Monaco theme
    let monacoTheme = mode === 'light' ? 'vs' : 'vs-dark'
    if (mode === 'custom' && custom) {
      try {
        monaco.editor.defineTheme('lumixa-custom', {
          base: custom.base,
          inherit: true,
          rules: custom.rules,
          colors: custom.colors
        })
        monacoTheme = 'lumixa-custom'
      } catch {
        monacoTheme = custom.base
      }
    }
    monaco.editor.setTheme(monacoTheme)
    set({ monacoTheme })

    void window.lumixa.window.setEffect(effect)
  }

  const initial = load()
  return {
    ...initial,
    monacoTheme: initial.mode === 'light' ? 'vs' : 'vs-dark',

    setEffect: (effect) => {
      set({ effect })
      persist()
      apply()
    },
    setOpacity: (opacity) => {
      set({ opacity })
      persist()
      apply()
    },
    setBackground: (background) => {
      set({ background })
      persist()
      apply()
    },
    setDim: (dim) => {
      set({ dim })
      persist()
    },
    setMode: (mode) => {
      set({ mode })
      persist()
      apply()
    },
    setCustomTheme: (custom) => {
      set({ custom, mode: 'custom' })
      persist()
      apply()
    },
    init: () => apply()
  }
})

/**
 * Parse a VS Code colour-theme JSON into a Monaco-ready CustomTheme.
 * Handles the common shape: { name, type, colors, tokenColors }.
 */
export function parseVSCodeTheme(json: string, fallbackName: string): CustomTheme {
  const raw = JSON.parse(json) as {
    name?: string
    type?: string
    colors?: Record<string, string>
    tokenColors?: { scope?: string | string[]; settings?: Record<string, string> }[]
  }
  const colors = raw.colors ?? {}
  const base: CustomTheme['base'] = raw.type === 'light' ? 'vs' : raw.type === 'hc' ? 'hc-black' : 'vs-dark'

  const rules: monaco.editor.ITokenThemeRule[] = []
  for (const tc of raw.tokenColors ?? []) {
    if (!tc.settings) continue
    const scopes = Array.isArray(tc.scope) ? tc.scope : tc.scope ? tc.scope.split(',') : ['']
    for (const scope of scopes) {
      const rule: monaco.editor.ITokenThemeRule = { token: scope.trim() }
      if (tc.settings.foreground) rule.foreground = tc.settings.foreground.replace('#', '')
      if (tc.settings.background) rule.background = tc.settings.background.replace('#', '')
      if (tc.settings.fontStyle) rule.fontStyle = tc.settings.fontStyle
      rules.push(rule)
    }
  }

  // Monaco requires every colour value to be a valid hex string.
  const cleanColors: Record<string, string> = {}
  for (const [k, v] of Object.entries(colors)) {
    if (typeof v === 'string' && /^#([0-9a-fA-F]{3,8})$/.test(v)) cleanColors[k] = v
  }

  const pick = (...keys: string[]): string | undefined => {
    for (const k of keys) if (colors[k]) return colors[k].slice(0, 7)
    return undefined
  }
  const defaults = base === 'vs' ? LIGHT : DARK
  const palette: Palette = {
    bg: pick('editor.background') ?? defaults.bg,
    elevated: pick('sideBar.background', 'editorGroupHeader.tabsBackground') ?? defaults.elevated,
    activitybar: pick('activityBar.background') ?? defaults.activitybar,
    border: pick('panel.border', 'editorGroup.border', 'contrastBorder') ?? defaults.border,
    fg: pick('editor.foreground', 'foreground') ?? defaults.fg,
    muted: pick('descriptionForeground', 'disabledForeground') ?? defaults.muted,
    accent: pick('focusBorder', 'button.background', 'activityBarBadge.background') ?? defaults.accent
  }

  return { name: raw.name ?? fallbackName, base, rules, colors: cleanColors, palette }
}
