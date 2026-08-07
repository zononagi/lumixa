import type { JSX } from 'react'
import type { DirEntry } from '@shared/ipc'
import { useWorkspaceStore } from '@renderer/stores/workspaceStore'
import { useEditorStore } from '@renderer/stores/editorStore'

/** File tree. Lazy-loads directory children on expand; opens files into tabs. */
export function Explorer(): JSX.Element {
  const { root, rootName, openFolder } = useWorkspaceStore()

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <span>Explorer</span>
        <button title="Open Folder" onClick={() => void openFolder()}>
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
          No folder is open.
          <br />
          <button onClick={() => void openFolder()}>Open Folder</button>
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
