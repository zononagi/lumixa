import { describe, it, expect } from 'vitest'
import { buildCode } from './codeBuilder'

describe('buildCode', () => {
  it('builds a typed const', () => {
    expect(buildCode({ kind: 'variable', name: 'total', type: 'number', value: '0', declaration: 'const' })).toBe(
      'const total: number = 0'
    )
  })

  it('omits type/value when not given', () => {
    expect(buildCode({ kind: 'variable', name: 'x', declaration: 'let' })).toBe('let x')
  })

  it('builds an async function with a Promise return type', () => {
    expect(
      buildCode({ kind: 'function', name: 'load', params: 'id: string', returnType: 'User', async: true })
    ).toBe('async function load(id: string): Promise<User> {\n  \n}')
  })

  it('builds an interface from properties', () => {
    expect(
      buildCode({
        kind: 'interface',
        name: 'User',
        props: [
          { name: 'id', type: 'number' },
          { name: 'name', type: 'string' }
        ]
      })
    ).toBe('interface User {\n  id: number\n  name: string\n}')
  })

  it('builds a for...of loop', () => {
    expect(buildCode({ kind: 'loop', style: 'forOf', iterable: 'users', item: 'user' })).toBe(
      'for (const user of users) {\n  \n}'
    )
  })

  it('builds a React component', () => {
    expect(buildCode({ kind: 'component', name: 'UserCard' })).toContain(
      'export function UserCard(): JSX.Element'
    )
  })

  it('builds an API request with error handling', () => {
    const code = buildCode({ kind: 'apiRequest', name: 'getUsers', url: '/api/users', responseType: 'User[]' })
    expect(code).toContain('async function getUsers(): Promise<User[]>')
    expect(code).toContain('await fetch("/api/users")')
    expect(code).toContain('catch (error)')
  })

  it('builds a try/catch around an operation', () => {
    expect(buildCode({ kind: 'tryCatch', operation: 'await save()' })).toBe(
      'try {\n  await save()\n} catch (error) {\n  console.error(error)\n}'
    )
  })
})
