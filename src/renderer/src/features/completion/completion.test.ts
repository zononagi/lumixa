import { describe, it, expect, beforeEach } from 'vitest'
import { rank } from './candidateRanker'
import * as cache from './completionCache'
import type { Candidate, CompletionContext } from './types'

const ctx = (word: string): CompletionContext => ({
  language: 'typescript',
  text: '',
  offset: 0,
  linePrefix: word,
  word,
  cacheKey: `typescript::${word}`
})

const cand = (label: string, source: Candidate['source'], word: string): Candidate => ({
  label,
  insert: label.slice(word.length),
  source,
  confidence: 0
})

describe('candidateRanker', () => {
  it('prefers local scope over project over keyword', () => {
    const word = 'user'
    const ranked = rank(
      [
        cand('userKeyword', 'keyword', word),
        cand('userProject', 'project', word),
        cand('userLocal', 'local-scope', word)
      ],
      ctx(word)
    )
    expect(ranked.map((c) => c.source)).toEqual(['local-scope', 'project', 'keyword'])
  })

  it('gives higher confidence to longer typed prefixes', () => {
    const short = rank([cand('fetchUsers', 'local-scope', 'fe')], ctx('fe'))[0]
    const long = rank([cand('fetchUsers', 'local-scope', 'fetchUse')], ctx('fetchUse'))[0]
    expect(long.confidence).toBeGreaterThan(short.confidence)
  })

  it('keeps confidence within [0,1]', () => {
    for (const c of rank([cand('handleSubmitCallback', 'local-scope', 'handleSubmit')], ctx('handleSubmit'))) {
      expect(c.confidence).toBeGreaterThanOrEqual(0)
      expect(c.confidence).toBeLessThanOrEqual(1)
    }
  })

  it('penalises the same candidate when the result set is ambiguous', () => {
    const word = 'on'
    // All inserts are 5 chars so only the set size differs.
    const conf = (list: Candidate[]): number =>
      rank(list, ctx(word)).find((c) => c.label === 'onClick')!.confidence
    const single = conf([cand('onClick', 'local-scope', word)])
    const many = conf([
      cand('onClick', 'local-scope', word),
      cand('onScope', 'local-scope', word),
      cand('onThing', 'local-scope', word),
      cand('onWorld', 'local-scope', word),
      cand('onQuery', 'local-scope', word)
    ])
    expect(single).toBeGreaterThan(many)
  })
})

describe('completionCache', () => {
  beforeEach(() => cache.clear())

  it('returns entries only for the matching document version', () => {
    const c = [cand('users', 'local-scope', 'us')]
    cache.set('k', 1, c)
    expect(cache.get('k', 1)).toBe(c)
    expect(cache.get('k', 2)).toBeUndefined() // stale version invalidated
    expect(cache.get('missing', 1)).toBeUndefined()
  })
})
