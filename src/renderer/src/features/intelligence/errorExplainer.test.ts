import { describe, it, expect } from 'vitest'
import { classify, explainDiagnostic } from './errorExplainer'

describe('classify', () => {
  it('prefers the compiler code over the message text', () => {
    expect(classify({ message: 'anything', code: 2307, severity: 8 })).toBe('module-not-found')
    expect(classify({ message: 'anything', code: '2322', severity: 8 })).toBe('type')
    expect(classify({ message: 'anything', code: 6133, severity: 4 })).toBe('unused')
  })

  it('falls back to message patterns when there is no known code', () => {
    expect(classify({ message: "Cannot find module 'react'", severity: 8 })).toBe('module-not-found')
    expect(classify({ message: "Cannot find name 'useState'", severity: 8 })).toBe('missing-import')
    expect(classify({ message: "Property 'foo' does not exist on type 'Bar'", severity: 8 })).toBe(
      'missing-property'
    )
    expect(classify({ message: "'x' is possibly 'undefined'.", severity: 8 })).toBe('null-undefined')
    expect(classify({ message: 'Unexpected token', severity: 8 })).toBe('syntax')
  })

  it('returns "unknown" for unrecognised diagnostics', () => {
    expect(classify({ message: 'some novel runtime complaint', severity: 8 })).toBe('unknown')
  })
})

describe('explainDiagnostic', () => {
  it('produces the beginner type-mismatch translation (§32)', () => {
    const ex = explainDiagnostic(
      { message: "Type 'string' is not assignable to type 'number'.", code: 2322, severity: 8 },
      'ja'
    )
    expect(ex.category).toBe('type')
    // Expected place wants a number; text was given.
    expect(ex.what).toContain('数値')
    expect(ex.what).toContain('文字')
    // Raw message is preserved for the technical-details section.
    expect(ex.technical).toContain("Type 'string' is not assignable")
  })

  it('always fills what / why / fix and a localized category label', () => {
    for (const locale of ['ja', 'en'] as const) {
      const ex = explainDiagnostic({ message: "Cannot find name 'x'", code: 2304, severity: 8 }, locale)
      expect(ex.what).toBeTruthy()
      expect(ex.why).toBeTruthy()
      expect(ex.fix).toBeTruthy()
      expect(ex.categoryLabel).toBeTruthy()
    }
  })

  it('suggests Quick Fix for missing imports and Organize Imports for unused', () => {
    expect(
      explainDiagnostic({ message: "Cannot find name 'useState'", code: 2304, severity: 8 }, 'en').action
    ).toBe('quickFix')
    expect(
      explainDiagnostic({ message: "'a' is declared but its value is never read.", code: 6133, severity: 4 }, 'en')
        .action
    ).toBe('organizeImports')
  })

  it('does not invent a fix action for module-not-found (needs npm install)', () => {
    const ex = explainDiagnostic({ message: "Cannot find module 'left-pad'", code: 2307, severity: 8 }, 'en')
    expect(ex.action).toBeUndefined()
    expect(ex.fix.toLowerCase()).toContain('npm install')
  })
})
