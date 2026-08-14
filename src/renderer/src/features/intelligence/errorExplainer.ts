/**
 * Error Explainer (spec §31–§34). Turns a raw diagnostic into a beginner-friendly
 * "What happened? / Why? / How to fix?" explanation, plus a classification and
 * the original technical message (§32 keeps the raw text available).
 *
 * Pure and dependency-light (only the static knowledge base) so the priority /
 * classification logic can be unit-tested. No AI: this is static analysis over
 * the compiler's own diagnostic. Complex cases still get an "Ask Claude Code"
 * button in the UI (§79/§80) — but Lumixa explains what it can first.
 */
import { explainError } from './knowledgeBase'

export type ErrorCategory =
  | 'syntax'
  | 'type'
  | 'missing-import'
  | 'module-not-found'
  | 'missing-property'
  | 'argument-mismatch'
  | 'null-undefined'
  | 'implicit-any'
  | 'unused'
  | 'return-type'
  | 'config'
  | 'unknown'

export interface DiagnosticInput {
  message: string
  code?: string | number
  /** Monaco MarkerSeverity: 8=error, 4=warning. */
  severity: number
}

export interface DiagnosticExplanation {
  category: ErrorCategory
  categoryLabel: string
  /** Plain-language "what happened". */
  what: string
  /** Plain-language "why". */
  why: string
  /** Plain-language "how to fix". */
  fix: string
  /** The original compiler message, kept for the "Technical details" section. */
  technical: string
  /** An editor action to offer as a one-click fix, if one is likely to help. */
  action?: 'quickFix' | 'organizeImports'
}

type Locale = 'ja' | 'en'

const CODE_MAP: Record<number, ErrorCategory> = {
  1002: 'syntax',
  1003: 'syntax',
  1005: 'syntax',
  1109: 'syntax',
  1128: 'syntax',
  2304: 'missing-import',
  2307: 'module-not-found',
  2322: 'type',
  2740: 'type',
  2741: 'type',
  2345: 'argument-mismatch',
  2554: 'argument-mismatch',
  2339: 'missing-property',
  2551: 'missing-property',
  2531: 'null-undefined',
  2532: 'null-undefined',
  2533: 'null-undefined',
  18047: 'null-undefined',
  18048: 'null-undefined',
  7005: 'implicit-any',
  7006: 'implicit-any',
  7031: 'implicit-any',
  6133: 'unused',
  6196: 'unused',
  6198: 'unused'
}

function toCodeNumber(code: string | number | undefined): number | undefined {
  if (typeof code === 'number') return code
  if (typeof code === 'string') {
    const n = parseInt(code.replace(/\D/g, ''), 10)
    return Number.isNaN(n) ? undefined : n
  }
  return undefined
}

/** Classify a diagnostic, preferring the compiler code, falling back to text. */
export function classify(input: DiagnosticInput): ErrorCategory {
  const code = toCodeNumber(input.code)
  if (code != null && CODE_MAP[code]) return CODE_MAP[code]

  const m = input.message
  if (/cannot find module|module not found|could not find a declaration file/i.test(m))
    return 'module-not-found'
  if (/cannot find name/i.test(m)) return 'missing-import'
  if (/property '.*' does not exist/i.test(m)) return 'missing-property'
  if (/expected \d+ argument|argument of type .* is not assignable/i.test(m))
    return 'argument-mismatch'
  if (/is possibly 'null'|is possibly 'undefined'|possibly null|possibly undefined/i.test(m))
    return 'null-undefined'
  if (/implicitly has an? .*any/i.test(m)) return 'implicit-any'
  if (/is declared but .*never (read|used)|never used/i.test(m)) return 'unused'
  if (/not assignable to return type/i.test(m)) return 'return-type'
  if (/is not assignable to type|type '.*' is not assignable/i.test(m)) return 'type'
  if (/expected|unexpected token|unterminated/i.test(m)) return 'syntax'
  if (/tsconfig|compiler option|cannot write file/i.test(m)) return 'config'
  return 'unknown'
}

/** Turn a primitive type name into a beginner-friendly word. */
function friendlyType(name: string, locale: Locale): string {
  const t = name.trim().replace(/^['"]|['"]$/g, '')
  const map: Record<string, { ja: string; en: string }> = {
    number: { ja: '数値', en: 'a number' },
    string: { ja: '文字（テキスト）', en: 'text' },
    boolean: { ja: '真偽値（true/false）', en: 'true/false' },
    undefined: { ja: '未定義（undefined）', en: 'undefined' },
    null: { ja: '空（null）', en: 'null' }
  }
  const hit = map[t]
  if (hit) return hit[locale]
  return locale === 'ja' ? `「${t}」型` : `type '${t}'`
}

const LABELS: Record<ErrorCategory, { ja: string; en: string }> = {
  syntax: { ja: '文法エラー', en: 'Syntax error' },
  type: { ja: '型エラー', en: 'Type error' },
  'missing-import': { ja: '未定義の名前 / import 忘れ', en: 'Missing name / import' },
  'module-not-found': { ja: 'モジュールが見つからない', en: 'Module not found' },
  'missing-property': { ja: '存在しないプロパティ', en: 'Missing property' },
  'argument-mismatch': { ja: '引数の不一致', en: 'Argument mismatch' },
  'null-undefined': { ja: 'null / undefined の可能性', en: 'Possibly null / undefined' },
  'implicit-any': { ja: '暗黙の any', en: 'Implicit any' },
  unused: { ja: '未使用', en: 'Unused' },
  'return-type': { ja: '戻り値の型エラー', en: 'Return type error' },
  config: { ja: '設定エラー', en: 'Configuration error' },
  unknown: { ja: 'エラー', en: 'Error' }
}

export function explainDiagnostic(
  input: DiagnosticInput,
  locale: Locale
): DiagnosticExplanation {
  const category = classify(input)
  const ja = locale === 'ja'
  const base = {
    category,
    categoryLabel: LABELS[category][locale],
    technical: input.message
  }

  // Enrich the "why" with the curated compiler-code explanation when available.
  const coded = explainError(input.code)
  const codedWhy = coded ? coded[locale] : ''

  switch (category) {
    case 'type': {
      const mm = input.message.match(/type '([^']+)' is not assignable to type '([^']+)'/i)
      const what = ja
        ? mm
          ? `${friendlyType(mm[2], locale)}が必要な場所に、${friendlyType(mm[1], locale)}が入っています。`
          : '値の「種類（型）」が合っていません。'
        : mm
          ? `You put ${friendlyType(mm[1], locale)} where ${friendlyType(mm[2], locale)} is expected.`
          : "A value's kind (type) does not match what's expected."
      return {
        ...base,
        what,
        why: codedWhy || (ja ? '期待される型と実際の値の型が違うためです。' : 'The expected type and the actual value type differ.'),
        fix: ja
          ? '値を正しい型に直すか、変換してください（例: Number(x) や String(x)）。'
          : 'Change the value to the right type, or convert it (e.g. Number(x), String(x)).',
        action: 'quickFix'
      }
    }
    case 'missing-import': {
      const name = input.message.match(/cannot find name '([^']+)'/i)?.[1]
      return {
        ...base,
        what: ja
          ? `${name ? `「${name}」という` : ''}名前が見つかりません。`
          : `${name ? `The name '${name}' ` : 'This name '}can't be found.`,
        why: codedWhy || (ja ? 'スペルミスか、import を忘れている可能性があります。' : "It may be a typo, or you're missing an import."),
        fix: ja
          ? 'Quick Fix で import を追加できることが多いです。名前のスペルも確認してください。'
          : 'Quick Fix can often add the import. Also check the spelling.',
        action: 'quickFix'
      }
    }
    case 'module-not-found': {
      const mod = input.message.match(/cannot find module '([^']+)'/i)?.[1]
      return {
        ...base,
        what: ja
          ? `${mod ? `「${mod}」という` : ''}モジュール（パッケージ）が見つかりません。`
          : `The module (package)${mod ? ` '${mod}'` : ''} can't be found.`,
        why: ja
          ? 'パッケージがインストールされていないか、パスが間違っている可能性があります。'
          : 'The package may not be installed, or the path is wrong.',
        fix: ja
          ? 'ターミナルで `npm install <パッケージ名>` を実行するか、import のパスを確認してください。'
          : 'Run `npm install <package>` in the terminal, or check the import path.'
      }
    }
    case 'missing-property': {
      const prop = input.message.match(/property '([^']+)'/i)?.[1]
      return {
        ...base,
        what: ja
          ? `${prop ? `「${prop}」という` : ''}プロパティが、その値には存在しません。`
          : `The property${prop ? ` '${prop}'` : ''} doesn't exist on that value.`,
        why: codedWhy || (ja ? '名前の打ち間違いか、値が想定と違う型かもしれません。' : 'A typo, or the value is a different type than expected.'),
        fix: ja
          ? 'プロパティ名を確認し、必要なら型定義を見直してください。'
          : 'Check the property name; adjust the type definition if needed.',
        action: 'quickFix'
      }
    }
    case 'argument-mismatch':
      return {
        ...base,
        what: ja ? '関数に渡している引数が合っていません。' : "The arguments passed to a function don't match.",
        why: codedWhy || (ja ? '引数の数、または型が関数の定義と違います。' : 'The number or type of arguments differs from the function definition.'),
        fix: ja ? '関数の定義（何をいくつ渡すか）を確認してください。' : 'Check the function definition (what and how many arguments it takes).',
        action: 'quickFix'
      }
    case 'null-undefined':
      return {
        ...base,
        what: ja ? '値が空（null / undefined）になっている可能性があります。' : 'The value might be empty (null / undefined).',
        why: codedWhy || (ja ? 'データがまだ読み込まれていない、または存在しない場合があります。' : "The data may not be loaded yet, or doesn't exist."),
        fix: ja
          ? '使う前に存在チェックを入れる（if (x) …）か、`?.`（オプショナルチェーン）を使ってください。'
          : 'Guard it before use (if (x) …) or use optional chaining (?.).',
        action: 'quickFix'
      }
    case 'implicit-any':
      return {
        ...base,
        what: ja ? '型が指定されておらず、any（なんでも）になっています。' : 'No type is specified, so it defaults to any (anything).',
        why: codedWhy || (ja ? '型注釈がないと、間違いに気づきにくくなります。' : 'Without a type annotation, mistakes are harder to catch.'),
        fix: ja ? '変数や引数に型注釈を付けてください（例: (x: number)）。' : 'Add a type annotation (e.g. (x: number)).'
      }
    case 'unused':
      return {
        ...base,
        what: ja ? '宣言したのに使われていない変数 / import があります。' : 'Something is declared but never used.',
        why: ja ? '不要なコードは混乱のもとになります。' : 'Unused code adds noise and confusion.',
        fix: ja ? '使わないなら削除してください。import は Organize Imports で整理できます。' : 'Remove it if unneeded. Organize Imports can clean up imports.',
        action: 'organizeImports'
      }
    case 'return-type':
      return {
        ...base,
        what: ja ? '関数が返している値の型が、宣言した戻り値の型と合いません。' : "The returned value's type doesn't match the declared return type.",
        why: ja ? '関数の戻り値の型注釈と、実際に return している値が違います。' : 'The declared return type and the actual returned value differ.',
        fix: ja ? 'return する値か、戻り値の型注釈のどちらかを直してください。' : 'Fix either the returned value or the declared return type.'
      }
    case 'syntax':
      return {
        ...base,
        what: ja ? 'コードの書き方（文法）に誤りがあります。' : 'The code has a grammar (syntax) mistake.',
        why: codedWhy || (ja ? '記号（; } ) など）の不足や、綴りの誤りがよくある原因です。' : 'A missing symbol (; } )) or a typo is a common cause.'),
        fix: ja ? '該当行の記号の対応（括弧・引用符）を確認してください。' : 'Check matching symbols on the line (brackets, quotes).'
      }
    case 'config':
      return {
        ...base,
        what: ja ? '設定ファイル（tsconfig など）に関する問題です。' : 'A problem related to a config file (like tsconfig).',
        why: ja ? '設定値が不足・不整合の可能性があります。' : 'A setting may be missing or inconsistent.',
        fix: ja ? '設定ファイルを確認してください。' : 'Review the configuration file.'
      }
    default:
      return {
        ...base,
        what: ja ? 'エラーが発生しました。' : 'An error occurred.',
        why: codedWhy || (ja ? '下の技術的な詳細に、原因の手がかりがあります。' : 'The technical details below hold clues to the cause.'),
        fix: ja ? '詳細を確認し、必要なら Quick Fix や Claude Code に相談してください。' : 'Review the details; try Quick Fix or ask Claude Code if needed.',
        action: 'quickFix'
      }
  }
}
