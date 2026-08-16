import type { BrainFileNode, ImpactResult, RiskLevel } from '@shared/brain'
import { isCriticalPath } from './analyze'

/**
 * Change Impact Radar (spec §10–§12). Given the dependency graph and a target
 * file, find everything that could break if the target changes, and score the
 * risk. Pure — takes the file list, returns a result — so it is unit-tested and
 * runs without Claude Code.
 */

/** Build reverse adjacency: rel → files that import it. */
function buildImporters(files: BrainFileNode[]): Map<string, string[]> {
  const importers = new Map<string, string[]>()
  for (const f of files) {
    for (const dep of f.imports) {
      const list = importers.get(dep)
      if (list) list.push(f.rel)
      else importers.set(dep, [f.rel])
    }
  }
  return importers
}

export function computeImpact(files: BrainFileNode[], targetRel: string): ImpactResult {
  const byRel = new Map(files.map((f) => [f.rel, f]))
  const importers = buildImporters(files)

  const direct = [...(importers.get(targetRel) ?? [])].sort()
  const directSet = new Set(direct)

  // BFS over reverse edges to find transitively-affected files + max depth.
  const seen = new Set<string>([targetRel, ...direct])
  const indirect: string[] = []
  let depth = direct.length > 0 ? 1 : 0
  let frontier = [...direct]
  while (frontier.length) {
    const next: string[] = []
    for (const rel of frontier) {
      for (const up of importers.get(rel) ?? []) {
        if (seen.has(up)) continue
        seen.add(up)
        indirect.push(up)
        next.push(up)
      }
    }
    if (next.length) depth++
    frontier = next
  }
  indirect.sort()

  const affected = [...direct, ...indirect]
  const affectedTests = affected.filter((rel) => byRel.get(rel)?.kind === 'test').sort()
  const targetNode = byRel.get(targetRel)
  const affectedPackages = [...(targetNode?.packages ?? [])].sort()
  const critical = isCriticalPath(targetRel)

  // --- Risk score (0-100) with explainable reasons ------------------------
  const reasons: string[] = []
  let score = 0

  if (direct.length) {
    score += Math.min(40, direct.length * 8)
    reasons.push(`${direct.length} file(s) import this directly`)
  }
  if (indirect.length) {
    score += Math.min(25, indirect.length * 3)
    reasons.push(`${indirect.length} file(s) affected indirectly`)
  }
  if (depth >= 3) {
    score += 10
    reasons.push(`dependency chain is ${depth} levels deep`)
  }
  if (critical) {
    score += 35
    reasons.push('lives in a critical area (auth / database / payments / …)')
  }
  if (affected.length > 0 && affectedTests.length === 0) {
    score += 15
    reasons.push('no tests cover the affected files')
  } else if (affectedTests.length > 0) {
    reasons.push(`${affectedTests.length} related test file(s) — run them to verify`)
  }
  if ((targetNode?.exports.length ?? 0) >= 5) {
    score += 5
    reasons.push('exports a wide public surface')
  }
  if (affected.length === 0) {
    reasons.push('nothing else imports this file — isolated change')
  }

  score = Math.max(0, Math.min(100, score))
  const riskLevel: RiskLevel = score >= 67 ? 'high' : score >= 34 ? 'medium' : 'low'

  return {
    target: targetRel,
    direct,
    indirect,
    affectedTests,
    affectedPackages,
    riskScore: score,
    riskLevel,
    critical,
    reasons
  }
}
