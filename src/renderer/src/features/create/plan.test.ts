import { describe, it, expect } from 'vitest'
import {
  analyzeDescription,
  buildImplementPrompt,
  detectFeatures,
  detectTemplate,
  slugify,
  suggestName
} from './plan'

describe('detectTemplate', () => {
  it('routes backend/CLI intents to node, else web (default)', () => {
    expect(detectTemplate('a REST API server for todos')).toBe('node-ts')
    expect(detectTemplate('a discord bot')).toBe('node-ts')
    expect(detectTemplate('a music player web app')).toBe('react-ts-vite')
    expect(detectTemplate('something nice')).toBe('react-ts-vite')
  })
})

describe('detectFeatures', () => {
  it('extracts curated features from the description', () => {
    const f = detectFeatures('music player with a playlist, search, and dark mode plus login')
    expect(f).toContain('Playlist')
    expect(f).toContain('Search')
    expect(f).toContain('Dark mode')
    expect(f).toContain('Authentication')
  })
  it('returns empty when nothing matches', () => {
    expect(detectFeatures('a plain thing')).toEqual([])
  })
})

describe('slugify / suggestName', () => {
  it('slugifies to npm-safe names', () => {
    expect(slugify('My Cool App!!')).toBe('my-cool-app')
    expect(slugify('   ')).toBe('my-app')
  })
  it('suggests a name from an "X app" phrase', () => {
    expect(suggestName('I want a Music Player app with search')).toBe('music-player-app')
  })
  it('falls back to first words', () => {
    expect(suggestName('todo list manager')).toBe('todo-list-manager')
  })
})

describe('analyzeDescription', () => {
  it('produces a full plan', () => {
    const plan = analyzeDescription('A React dashboard with charts, auth and dark mode')
    expect(plan.templateId).toBe('react-ts-vite')
    expect(plan.features).toContain('Dashboard')
    expect(plan.features).toContain('Authentication')
    expect(plan.name).toBeTruthy()
  })
})

describe('buildImplementPrompt', () => {
  it('includes the goal and features', () => {
    const p = buildImplementPrompt('build a blog', ['Search', 'Comments & likes'])
    expect(p).toContain('build a blog')
    expect(p).toContain('Search')
    expect(p).toContain('Comments & likes')
  })
})
