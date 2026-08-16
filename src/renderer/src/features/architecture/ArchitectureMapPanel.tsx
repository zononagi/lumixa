import { useMemo, useState, type JSX } from 'react'
import { useBrainStore } from '@renderer/stores/brainStore'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useT } from '@renderer/i18n'
import {
  buildNeighborhood,
  pickDefaultCenter,
  whyConnected,
  type GraphNode
} from './graph'

/**
 * Architecture Map panel (spec §27-§28). Renders an interactive dependency
 * neighborhood around the focused file: importers (used by) on top, the file in
 * the middle, its imports (depends on) below. Click a node to open it and
 * re-center; hover an edge for "why connected". Rebuilt live as the Brain
 * updates. Self-contained SVG — no external graph library.
 */
const W = 280
const H = 300
const NODE_W = 78
const NODE_H = 22

export function ArchitectureMapPanel(): JSX.Element {
  const t = useT()
  const root = useWorkspaceStore((s) => s.root)
  const files = useBrainStore((s) => s.brain?.files)
  const activePath = useEditorStore((s) => s.activePath)
  const openFile = useEditorStore((s) => s.openFile)
  const [override, setOverride] = useState<string | null>(null)

  const centerRel = useMemo(() => {
    if (!files) return null
    if (override && files.some((f) => f.rel === override)) return override
    const active = files.find((f) => f.path === activePath)
    if (active) return active.rel
    return pickDefaultCenter(files)
  }, [files, override, activePath])

  const hood = useMemo(
    () => (files ? buildNeighborhood(files, centerRel) : null),
    [files, centerRel]
  )

  if (!root) {
    return (
      <div className="sidebar arch">
        <div className="sidebar-header">
          <span>{t('arch.title')}</span>
        </div>
        <div className="empty-hint">{t('arch.noWorkspace')}</div>
      </div>
    )
  }

  const go = (n: GraphNode): void => {
    setOverride(n.rel)
    void openFile(n.path, n.label)
  }

  const rowX = (i: number, n: number): number => ((i + 1) / (n + 1)) * W

  return (
    <div className="sidebar arch">
      <div className="sidebar-header">
        <span>{t('arch.title')}</span>
      </div>

      <div className="arch-body">
        {!hood?.center ? (
          <div className="empty-hint">{t('arch.pickFile')}</div>
        ) : (
          <>
            <div className="arch-focus" title={hood.center.rel}>
              {hood.center.label}
            </div>
            <div className="arch-counts">
              {t('arch.usedBy', { n: hood.importers.length + hood.moreImporters })} ·{' '}
              {t('arch.dependsOn', { n: hood.imports.length + hood.moreImports })}
            </div>

            <svg className="arch-svg" viewBox={`0 0 ${W} ${H}`} role="img">
              <defs>
                <marker
                  id="arch-arrow"
                  markerWidth="6"
                  markerHeight="6"
                  refX="5"
                  refY="3"
                  orient="auto"
                >
                  <path d="M0,0 L6,3 L0,6 Z" className="arch-arrow-head" />
                </marker>
              </defs>

              {/* edges: importer -> center */}
              {hood.importers.map((n, i) => {
                const x = rowX(i, hood.importers.length)
                return (
                  <line
                    key={`ei${n.rel}`}
                    className="arch-edge"
                    x1={x}
                    y1={34 + NODE_H / 2}
                    x2={W / 2}
                    y2={H / 2 - NODE_H / 2}
                    markerEnd="url(#arch-arrow)"
                  >
                    <title>{whyConnected(n, hood.center!)}</title>
                  </line>
                )
              })}
              {/* edges: center -> import */}
              {hood.imports.map((n, i) => {
                const x = rowX(i, hood.imports.length)
                return (
                  <line
                    key={`eo${n.rel}`}
                    className="arch-edge"
                    x1={W / 2}
                    y1={H / 2 + NODE_H / 2}
                    x2={x}
                    y2={H - 34 - NODE_H / 2}
                    markerEnd="url(#arch-arrow)"
                  >
                    <title>{whyConnected(hood.center!, n)}</title>
                  </line>
                )
              })}

              {/* importer nodes (top) */}
              {hood.importers.map((n, i) => (
                <GraphNodeRect key={n.rel} node={n} x={rowX(i, hood.importers.length)} y={34} onClick={() => go(n)} />
              ))}
              {/* center */}
              <GraphNodeRect node={hood.center} x={W / 2} y={H / 2} center onClick={() => go(hood.center!)} />
              {/* import nodes (bottom) */}
              {hood.imports.map((n, i) => (
                <GraphNodeRect key={n.rel} node={n} x={rowX(i, hood.imports.length)} y={H - 34} onClick={() => go(n)} />
              ))}
            </svg>

            <div className="arch-legend">
              <span>↑ {t('arch.usedByLegend')}</span>
              <span>↓ {t('arch.dependsLegend')}</span>
            </div>
            {(hood.moreImporters > 0 || hood.moreImports > 0) && (
              <div className="arch-more">
                {hood.moreImporters > 0 && t('arch.moreUsedBy', { n: hood.moreImporters })}
                {hood.moreImporters > 0 && hood.moreImports > 0 && ' · '}
                {hood.moreImports > 0 && t('arch.moreDeps', { n: hood.moreImports })}
              </div>
            )}
            {hood.importers.length === 0 && hood.imports.length === 0 && (
              <div className="empty-hint">{t('arch.isolated')}</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function GraphNodeRect({
  node,
  x,
  y,
  center,
  onClick
}: {
  node: GraphNode
  x: number
  y: number
  center?: boolean
  onClick: () => void
}): JSX.Element {
  const label = node.label.length > 12 ? node.label.slice(0, 11) + '…' : node.label
  return (
    <g className={`arch-node ${node.kind} ${center ? 'center' : ''}`} onClick={onClick}>
      <rect x={x - NODE_W / 2} y={y - NODE_H / 2} width={NODE_W} height={NODE_H} rx={5}>
        <title>{node.rel}</title>
      </rect>
      <text x={x} y={y + 4} textAnchor="middle">
        {label}
      </text>
    </g>
  )
}
