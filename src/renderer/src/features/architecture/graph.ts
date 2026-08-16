import type { BrainFileNode } from '@shared/brain'

/**
 * Architecture Map model (spec §27-§28). Turns the Project Brain dependency
 * graph into a readable, focused neighborhood around one file: what it depends
 * on, and what depends on it. Pure + unit-tested; the SVG layout lives in the
 * component.
 */

export interface GraphNode {
  rel: string
  path: string
  kind: BrainFileNode['kind']
  exports: string[]
  /** short display label (file name). */
  label: string
}

export interface Neighborhood {
  center: GraphNode | null
  /** Files the center imports (depends on). */
  imports: GraphNode[]
  /** Files that import the center (used by). */
  importers: GraphNode[]
  moreImports: number
  moreImporters: number
}

const nameOf = (rel: string): string => rel.split('/').pop() ?? rel

function toNode(f: BrainFileNode): GraphNode {
  return { rel: f.rel, path: f.path, kind: f.kind, exports: f.exports, label: nameOf(f.rel) }
}

/**
 * Pick a sensible default focus: the source/component file with the most
 * importers (a hub), so the map opens on something meaningful.
 */
export function pickDefaultCenter(files: BrainFileNode[]): string | null {
  const importerCount = new Map<string, number>()
  for (const f of files) for (const dep of f.imports) importerCount.set(dep, (importerCount.get(dep) ?? 0) + 1)
  let best: string | null = null
  let bestN = -1
  for (const f of files) {
    if (f.kind !== 'source' && f.kind !== 'component') continue
    const n = importerCount.get(f.rel) ?? 0
    if (n > bestN) {
      bestN = n
      best = f.rel
    }
  }
  return best ?? files[0]?.rel ?? null
}

export function buildNeighborhood(
  files: BrainFileNode[],
  centerRel: string | null,
  cap = 8
): Neighborhood {
  const byRel = new Map(files.map((f) => [f.rel, f]))
  const center = centerRel ? byRel.get(centerRel) : undefined
  if (!center) {
    return { center: null, imports: [], importers: [], moreImports: 0, moreImporters: 0 }
  }

  const importNodes = center.imports
    .map((rel) => byRel.get(rel))
    .filter((f): f is BrainFileNode => !!f)
    .map(toNode)

  const importerNodes = files
    .filter((f) => f.imports.includes(center.rel))
    .map(toNode)
    .sort((a, b) => a.rel.localeCompare(b.rel))

  return {
    center: toNode(center),
    imports: importNodes.slice(0, cap),
    importers: importerNodes.slice(0, cap),
    moreImports: Math.max(0, importNodes.length - cap),
    moreImporters: Math.max(0, importerNodes.length - cap)
  }
}

/** Human explanation of a directed edge from → to (spec §28 "Why connected?"). */
export function whyConnected(from: GraphNode, to: GraphNode): string {
  const base = `${from.label} imports ${to.label}`
  if (to.exports.length) {
    const names = to.exports.filter((e) => e !== 'default').slice(0, 3)
    if (names.length) return `${base} — may use ${names.join(', ')}`
  }
  return base
}
