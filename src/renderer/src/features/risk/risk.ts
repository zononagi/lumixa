import type { BrainFileNode } from '@shared/brain'

/**
 * Risk Detector (spec §36-§37). Classifies files into critical areas (auth, DB,
 * migrations, payments, secrets, infra, deploy) by path, and flags critical
 * files that currently have uncommitted changes as risky changes in progress.
 * Pure + unit-tested; consequences/recommendations copy lives in i18n, keyed by
 * category, so this stays logic-only.
 */

export type RiskCategory =
  | 'migration'
  | 'database'
  | 'payments'
  | 'auth'
  | 'secrets'
  | 'infra'
  | 'deploy'

export const RISK_CATEGORIES: RiskCategory[] = [
  'migration',
  'database',
  'payments',
  'auth',
  'secrets',
  'infra',
  'deploy'
]

// Order matters: more specific categories first (migration before database).
const PATTERNS: [RiskCategory, RegExp][] = [
  ['migration', /migration|migrate|\bknex\b|\balembic\b/i],
  ['secrets', /\.env(\.|$)|secret|credential|\bapi[-_]?key|\.pem$|\.key$/i],
  ['payments', /payment|billing|checkout|stripe|paypal|invoice|subscription/i],
  ['database', /database|(^|\/)db(\/|$)|schema|prisma|drizzle|typeorm|sequelize|\.sql$|repository/i],
  ['auth', /auth|login|logout|session|oauth|jwt|passport|password|permission|authoriz/i],
  ['deploy', /(^|\/)\.github\/workflows\/|deploy|release|(^|\/)ci\.ya?ml$/i],
  ['infra', /dockerfile|docker-compose|kubernetes|(^|\/)k8s(\/|$)|terraform|\.tf$|nginx|helm/i]
]

/** The critical category a file belongs to, or null if it's not sensitive. */
export function classifyCritical(rel: string): RiskCategory | null {
  for (const [cat, re] of PATTERNS) if (re.test(rel)) return cat
  return null
}

export interface RiskItem {
  rel: string
  path: string
  category: RiskCategory
  /** True when the file currently has uncommitted changes. */
  changed: boolean
}

/**
 * All critical files, with a `changed` flag for those in the working set.
 * Changed critical files sort first (they're the active risk).
 */
export function scanRisks(files: BrainFileNode[], changed: ReadonlySet<string>): RiskItem[] {
  const items: RiskItem[] = []
  for (const f of files) {
    const category = classifyCritical(f.rel)
    if (!category) continue
    items.push({ rel: f.rel, path: f.path, category, changed: changed.has(f.rel) })
  }
  return items.sort(
    (a, b) => Number(b.changed) - Number(a.changed) || a.rel.localeCompare(b.rel)
  )
}

/** Group critical files by category (for the "danger zones" overview). */
export function criticalAreas(items: RiskItem[]): Map<RiskCategory, RiskItem[]> {
  const map = new Map<RiskCategory, RiskItem[]>()
  for (const it of items) {
    const list = map.get(it.category)
    if (list) list.push(it)
    else map.set(it.category, [it])
  }
  return map
}

/** Prompt for Claude Code to review a risky change safely. */
export function buildRiskReviewPrompt(rel: string, category: RiskCategory): string {
  return (
    `Carefully review my change to \`${rel}\`. This is a ${category}-related file, which is ` +
    `high-risk. Point out any way this change could break existing behavior, lose data, or ` +
    `create a security issue, and suggest safeguards (tests, backups, staged rollout). ` +
    `Do not change files — just review.`
  )
}
