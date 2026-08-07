import test from 'node:test'
import assert from 'node:assert/strict'
import { parseOpenAIStreamChunk } from './openai'

test('parseOpenAIStreamChunk extracts assistant text deltas', () => {
  const chunk = [
    'data: {"choices":[{"delta":{"content":"Hello"}}]}',
    '',
    'data: {"choices":[{"delta":{"content":" world"}}]}',
    '',
    'data: [DONE]'
  ].join('\n')

  assert.deepEqual(parseOpenAIStreamChunk(chunk), ['Hello', ' world'])
})

test('parseOpenAIStreamChunk ignores non-content events', () => {
  const chunk = [
    'event: ping',
    'data: {}',
    '',
    'data: {"choices":[{"delta":{}}]}'
  ].join('\n')

  assert.deepEqual(parseOpenAIStreamChunk(chunk), [])
})
