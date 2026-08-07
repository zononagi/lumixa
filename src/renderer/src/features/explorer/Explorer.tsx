import type { JSX } from 'react'
import type { DirEntry } from '@shared/ipc'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useEditorStore } from '@renderer/stores/editorStore'
import { useT } from '@renderer/i18n'

/** File tree. Lazy-loads directory children on expand; opens files into tabs. */
export function Explorer(): JSX.Element {
  const { root, rootName, openFolder } = useWorkspaceStore()
  const t = useT()

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span>{t('explorer.title')}</span>
        <button title={t('explorer.openFolder')} onClick={() => void openFolder()}>
          📂
        </button>
      </div>
      {root ? (
        <div className="tree">
          <TreeNode
            entry={{ name: rootName ?? root, path: root, isDirectory: true }}
            depth={0}
            forceOpen
          />
        </div>
      ) : (
        <div className="empty-hint">
          {t('explorer.empty')}
          <br />
          <button onClick={() => void openFolder()}>{t('explorer.openFolder')}</button>
        </div>
      )}
    </div>
  )
}

function TreeNode({
  entry,
  depth,
  forceOpen
}: {
  entry: DirEntry
  depth: number
  forceOpen?: boolean
}): JSX.Element {
  const { expanded, toggleDir, childrenByPath } = useWorkspaceStore()
  const openFile = useEditorStore((s) => s.openFile)
  const isOpen = forceOpen || expanded.has(entry.path)
  const children = childrenByPath[entry.path]

  const onClick = (): void => {
    if (entry.isDirectory) void toggleDir(entry.path)
    else void openFile(entry.path, entry.name)
  }

  return (
    <>
      <div
        className="tree-row"
        style={{ paddingLeft: 8 + depth * 12 }}
        onClick={onClick}
      >
        <span className="twisty">
          {entry.isDirectory ? (isOpen ? '▾' : '▸') : ''}
        </span>
        <span>
          {entry.isDirectory ? '📁' : '📄'} {entry.name}
        </span>
      </div>
      {entry.isDirectory &&
        isOpen &&
        children?.map((child) => (
          <TreeNode key={child.path} entry={child} depth={depth + 1} />
        ))}
    </>
  )
}
