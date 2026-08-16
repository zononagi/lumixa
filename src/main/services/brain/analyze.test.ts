import { describe, it, expect } from 'vitest'
import {
  classifyKind,
  countLines,
  isCriticalPath,
  isSecretPath,
  packageOf,
  parseExports,
  parseImports,
  resolveRelative
} from './analyze'

describe('parseImports', () => {
  it('separates relative specifiers from external packages', () => {
    const text = `
      import React from 'react'
      import { foo } from './foo'
      import bar from '../lib/bar'
      export { x } from './x'
      const y = require('lodash')
      const z = await import('@scope/pkg/sub')
      import fs from 'node:fs'
    `
    const { relative, packages } = parseImports(text)
    expect(relative.sort()).toEqual(['../lib/bar', './foo', './x'])
    expect(packages.sort()).toEqual(['@scope/pkg', 'lodash', 'react'])
    // node builtins are excluded
    expect(packages).not.toContain('fs')
  })
})

describe('packageOf', () => {
  it('handles scopes and subpaths and skips builtins/relative', () => {
    expect(packageOf('react-dom/client')).toBe('react-dom')
    expect(packageOf('@mui/material/Button')).toBe('@mui/material')
    expect(packageOf('./local')).toBeNull()
    expect(packageOf('node:path')).toBeNull()
    expect(packageOf('fs')).toBeNull()
  })
})

describe('parseExports', () => {
  it('captures named, list and default exports', () => {
    const text = `
      export const a = 1
      export function b() {}
      export class C {}
      export interface D {}
      export { e, f as g }
      export default function () {}
    `
    const names = parseExports(text).sort()
    expect(names).toContain('a')
    expect(names).toContain('b')
    expect(names).toContain('C')
    expect(names).toContain('D')
    expect(names).toContain('e')
    expect(names).toContain('f')
    expect(names).toContain('default')
  })
})

describe('resolveRelative', () => {
  const files = new Set(['src/foo.ts', 'src/lib/bar.tsx', 'src/dir/index.ts'])
  it('resolves with extension inference', () => {
    expect(resolveRelative('src/app.ts', './foo', files)).toBe('src/foo.ts')
  })
  it('resolves parent traversal', () => {
    expect(resolveRelative('src/lib/x.ts', '../foo', files)).toBe('src/foo.ts')
  })
  it('resolves directory index', () => {
    expect(resolveRelative('src/app.ts', './dir', files)).toBe('src/dir/index.ts')
  })
  it('returns null for unknown targets', () => {
    expect(resolveRelative('src/app.ts', './missing', files)).toBeNull()
  })
})

describe('classifyKind', () => {
  it('detects each kind', () => {
    expect(classifyKind('src/a.test.ts', '')).toBe('test')
    expect(classifyKind('src/styles.css', '')).toBe('style')
    expect(classifyKind('README.md', '')).toBe('doc')
    expect(classifyKind('tsconfig.json', '')).toBe('config')
    expect(classifyKind('src/Button.tsx', 'return (<div/>)')).toBe('component')
    expect(classifyKind('src/util.ts', 'export const x = 1')).toBe('source')
  })
})

describe('secret + critical detection', () => {
  it('flags secret files', () => {
    expect(isSecretPath('.env')).toBe(true)
    expect(isSecretPath('config/.env.local')).toBe(true)
    expect(isSecretPath('certs/server.pem')).toBe(true)
    expect(isSecretPath('src/app.ts')).toBe(false)
  })
  it('flags critical areas', () => {
    expect(isCriticalPath('src/auth/session.ts')).toBe(true)
    expect(isCriticalPath('src/database/migration.ts')).toBe(true)
    expect(isCriticalPath('src/ui/Button.tsx')).toBe(false)
  })
})

describe('countLines', () => {
  it('counts newlines + 1', () => {
    expect(countLines('')).toBe(0)
    expect(countLines('a')).toBe(1)
    expect(countLines('a\nb\nc')).toBe(3)
  })
})
