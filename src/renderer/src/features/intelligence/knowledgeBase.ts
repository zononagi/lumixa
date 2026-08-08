/**
 * Static knowledge base for Learning Mode / Error Explainer / Why? — no AI.
 *
 * Two curated tables:
 *   - API explanations for common JS/TS/React built-ins (shown on hover).
 *   - Friendly explanations for common TypeScript compiler error codes.
 *
 * Text is bilingual (ja / en); callers pick by the active UI locale.
 */

export interface Explanation {
  ja: string
  en: string
}

const API: Record<string, Explanation> = {
  map: {
    ja: '配列の各要素を変換し、新しい配列を返します。元の配列は変更しません。',
    en: 'Transforms each element of an array and returns a new array. Does not mutate the original.'
  },
  filter: {
    ja: '条件に一致する要素だけを取り出して新しい配列を作ります。',
    en: 'Keeps only the elements that match a condition, returning a new array.'
  },
  reduce: {
    ja: '配列を1つの値に畳み込みます（合計や集計など）。',
    en: 'Folds an array into a single value (sum, aggregate, …).'
  },
  forEach: {
    ja: '配列の各要素に対して処理を実行します。戻り値はありません。',
    en: 'Runs a function for each element. Returns nothing.'
  },
  find: {
    ja: '条件に最初に一致した要素を返します。無ければ undefined。',
    en: 'Returns the first element matching a condition, or undefined.'
  },
  includes: {
    ja: '配列や文字列に指定の値が含まれるかを true/false で返します。',
    en: 'Returns true/false for whether an array or string contains a value.'
  },
  push: { ja: '配列の末尾に要素を追加します（破壊的）。', en: 'Appends an element to the end of an array (mutates).' },
  slice: { ja: '配列や文字列の一部をコピーして返します（非破壊）。', en: 'Returns a shallow copy of part of an array/string (non-mutating).' },
  splice: { ja: '配列の要素を追加・削除します（破壊的）。', en: 'Adds/removes elements in place (mutates the array).' },
  useState: {
    ja: 'React のフック。状態と、その更新関数のペアを返します。',
    en: 'React hook. Returns a stateful value and a function to update it.'
  },
  useEffect: {
    ja: 'React のフック。レンダー後に副作用（購読・取得など）を実行します。',
    en: 'React hook. Runs side effects (subscriptions, fetching) after render.'
  },
  useMemo: { ja: '依存が変わった時だけ再計算し、結果をキャッシュします。', en: 'Caches a computed value, recomputing only when dependencies change.' },
  JSON: { ja: 'JSON.parse は文字列→値、JSON.stringify は値→文字列に変換します。', en: 'JSON.parse: string→value; JSON.stringify: value→string.' },
  Promise: { ja: '非同期処理の結果を表すオブジェクト。await で結果を待てます。', en: 'Represents an async result; await it to get the value.' },
  console: { ja: 'デバッグ用の出力。console.log(...) で値を表示します。', en: 'Debug output; console.log(...) prints values.' }
}

// Common TS compiler error codes → plain explanation + hint.
const ERRORS: Record<number, Explanation> = {
  2304: {
    ja: '名前が見つかりません。変数・関数名のスペル、または import 忘れの可能性があります。',
    en: 'Cannot find this name. Check the spelling, or you may be missing an import.'
  },
  2322: {
    ja: '型が合いません。期待される型と実際の値の型が違います（例: number に string）。',
    en: 'Type mismatch — the value type does not match the expected type (e.g. string given, number expected).'
  },
  2339: {
    ja: 'そのプロパティは型に存在しません。名前の誤りか、別の型かもしれません。',
    en: 'That property does not exist on the type — a typo, or the value is a different type.'
  },
  2551: {
    ja: 'プロパティが存在しません。似た名前のプロパティがある可能性があります。',
    en: 'Property does not exist — there may be a similarly-named one.'
  },
  2554: {
    ja: '引数の数が合いません。関数のシグネチャを確認してください。',
    en: 'Wrong number of arguments — check the function signature.'
  },
  2531: { ja: 'オブジェクトが null の可能性があります。事前に null チェックが必要です。', en: 'Object is possibly null — add a null check first.' },
  18048: { ja: '値が undefined の可能性があります。存在確認や ?. の使用を検討してください。', en: 'Value is possibly undefined — guard it or use optional chaining (?.).' },
  7006: { ja: 'パラメータの型が暗黙の any です。型注釈を付けると安全です。', en: 'Parameter implicitly has an any type — add a type annotation.' },
  2678: { ja: '比較している型が一致しません。', en: 'The compared types do not overlap.' },
  1005: { ja: '構文エラー：記号（; や } など）が不足しています。', en: 'Syntax error: an expected token (like ; or }) is missing.' }
}

export function explainApi(word: string): Explanation | undefined {
  return API[word]
}

export function explainError(code: number | string | undefined): Explanation | undefined {
  const n = typeof code === 'string' ? parseInt(code.replace(/\D/g, ''), 10) : code
  return n != null && !Number.isNaN(n) ? ERRORS[n] : undefined
}
