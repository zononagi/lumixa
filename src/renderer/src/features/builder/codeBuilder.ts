/**
 * Code Builder generators (spec §17–§26). Pure, dependency-free functions that
 * turn a small structured spec into a code snippet. Formatting niceties (final
 * indentation, semicolons) are left to the editor's formatter (§26) — these
 * produce clean, minimal, correct output that the Monaco formatter then tidies.
 *
 * No AST library and no AI: this is deterministic templating, which keeps it
 * fast, offline, and unit-testable.
 */
import type { TKey } from '@renderer/i18n'

export interface Prop {
  name: string
  type: string
}

export type BuilderSpec =
  | { kind: 'variable'; name: string; type?: string; value?: string; declaration: 'const' | 'let' }
  | { kind: 'function'; name: string; params: string; returnType?: string; async: boolean }
  | { kind: 'interface'; name: string; props: Prop[] }
  | { kind: 'component'; name: string }
  | { kind: 'loop'; style: 'for' | 'forOf' | 'forEach' | 'while'; iterable: string; item: string }
  | { kind: 'condition'; condition: string }
  | { kind: 'apiRequest'; name: string; url: string; responseType: string }
  | { kind: 'tryCatch'; operation: string }

/** Human-facing catalogue for the UI (label + i18n key per kind). */
export const BUILDER_KINDS: { kind: BuilderSpec['kind']; labelKey: TKey }[] = [
  { kind: 'variable', labelKey: 'builder.kind.variable' },
  { kind: 'function', labelKey: 'builder.kind.function' },
  { kind: 'interface', labelKey: 'builder.kind.interface' },
  { kind: 'component', labelKey: 'builder.kind.component' },
  { kind: 'loop', labelKey: 'builder.kind.loop' },
  { kind: 'condition', labelKey: 'builder.kind.condition' },
  { kind: 'apiRequest', labelKey: 'builder.kind.apiRequest' },
  { kind: 'tryCatch', labelKey: 'builder.kind.tryCatch' }
]

export function buildCode(spec: BuilderSpec): string {
  switch (spec.kind) {
    case 'variable': {
      const type = spec.type ? `: ${spec.type}` : ''
      const value = spec.value ? ` = ${spec.value}` : ''
      return `${spec.declaration} ${spec.name}${type}${value}`
    }
    case 'function': {
      const ret = spec.returnType
        ? spec.async
          ? `: Promise<${spec.returnType}>`
          : `: ${spec.returnType}`
        : ''
      const kw = spec.async ? 'async function' : 'function'
      return `${kw} ${spec.name}(${spec.params})${ret} {\n  \n}`
    }
    case 'interface': {
      const body = spec.props.length
        ? spec.props.map((p) => `  ${p.name}: ${p.type}`).join('\n')
        : '  '
      return `interface ${spec.name} {\n${body}\n}`
    }
    case 'component':
      return (
        `export function ${spec.name}(): JSX.Element {\n` +
        `  return (\n` +
        `    <div>${spec.name}</div>\n` +
        `  )\n` +
        `}`
      )
    case 'loop':
      switch (spec.style) {
        case 'forOf':
          return `for (const ${spec.item} of ${spec.iterable}) {\n  \n}`
        case 'forEach':
          return `${spec.iterable}.forEach((${spec.item}) => {\n  \n})`
        case 'while':
          return `while (${spec.iterable}) {\n  \n}`
        case 'for':
        default:
          return `for (let ${spec.item} = 0; ${spec.item} < ${spec.iterable}.length; ${spec.item}++) {\n  \n}`
      }
    case 'condition':
      return `if (${spec.condition}) {\n  \n}`
    case 'apiRequest':
      return (
        `async function ${spec.name}(): Promise<${spec.responseType}> {\n` +
        `  try {\n` +
        `    const response = await fetch("${spec.url}")\n` +
        `    if (!response.ok) {\n` +
        `      throw new Error(\`HTTP \${response.status}\`)\n` +
        `    }\n` +
        `    return await response.json()\n` +
        `  } catch (error) {\n` +
        `    console.error(error)\n` +
        `    throw error\n` +
        `  }\n` +
        `}`
      )
    case 'tryCatch':
      return `try {\n  ${spec.operation}\n} catch (error) {\n  console.error(error)\n}`
  }
}
