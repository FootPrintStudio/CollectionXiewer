import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, Folder } from 'lucide-react'
import type { WatchRoot } from '../../shared/types'
import { buildWatchRootTree, watchRootFolderName, type WatchRootTreeNode } from '../../shared/watchRootTree'
import { useAppStore } from '../store/appStore'
import { ContextMenu, type ContextMenuItem } from '../ui/ContextMenu'
import { ConfirmDialog } from '../ui/ConfirmDialog'

interface Props {
  roots: WatchRoot[]
  onRescan: (rootId: number) => void
}

export function WatchRootTreeView({ roots, onRescan }: Props) {
  const refreshRoots = useAppStore((s) => s.refreshRoots)
  const refreshMedia = useAppStore((s) => s.refreshMedia)
  const tree = useMemo(() => buildWatchRootTree(roots), [roots])
  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set())
  const [menu, setMenu] = useState<{ x: number; y: number; root: WatchRoot } | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<WatchRoot | null>(null)

  const toggleCollapsed = (id: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const removeRoot = async (root: WatchRoot) => {
    await window.collectionXiewer.roots.remove(root.id)
    await refreshRoots()
    await refreshMedia()
  }

  const menuItems: ContextMenuItem[] = menu
    ? [
        {
          label: 'Rescan folder',
          onClick: () => {
            onRescan(menu.root.id)
            setMenu(null)
          }
        },
        {
          label: 'Remove from library',
          danger: true,
          onClick: () => {
            setConfirmRemove(menu.root)
            setMenu(null)
          }
        }
      ]
    : []

  if (tree.length === 0) {
    return (
      <p className="empty-hint" style={{ padding: '1rem 0' }}>
        No watch folders yet.
      </p>
    )
  }

  return (
    <>
      <ul className="watch-root-tree">{tree.map((node) => renderNode(node, 0))}</ul>

      {menu ? <ContextMenu x={menu.x} y={menu.y} items={menuItems} onClose={() => setMenu(null)} /> : null}

      {confirmRemove ? (
        <ConfirmDialog
          title="Remove watch folder"
          message={`Remove “${watchRootFolderName(confirmRemove.path)}” from the library? Files on disk are not deleted—only indexed media from this folder is removed.`}
          confirmLabel="Remove"
          danger
          onCancel={() => setConfirmRemove(null)}
          onConfirm={() => {
            void removeRoot(confirmRemove)
            setConfirmRemove(null)
          }}
        />
      ) : null}
    </>
  )

  function renderNode(node: WatchRootTreeNode, depth: number) {
    const { root, children } = node
    const hasChildren = children.length > 0
    const isCollapsed = collapsed.has(root.id)
    const label = watchRootFolderName(root.path)

    return (
      <li key={root.id} className="watch-root-tree__item">
        <div
          className="watch-root-tree__row"
          style={{ paddingLeft: `${depth * 12 + 4}px` }}
          onContextMenu={(e) => {
            e.preventDefault()
            setMenu({ x: e.clientX, y: e.clientY, root })
          }}
        >
          <button
            type="button"
            className="watch-root-tree__toggle"
            aria-label={isCollapsed ? 'Expand' : 'Collapse'}
            onClick={() => hasChildren && toggleCollapsed(root.id)}
            style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
          >
            {hasChildren ? (
              isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />
            ) : null}
          </button>
          <Folder size={14} className="watch-root-tree__icon" aria-hidden />
          <span className="watch-root-tree__label" title={root.path}>
            {label}
          </span>
          <button
            type="button"
            className="watch-root-tree__scan"
            title={`Rescan ${root.path}`}
            onClick={() => onRescan(root.id)}
          >
            Scan
          </button>
        </div>
        {hasChildren && !isCollapsed ? (
          <ul className="watch-root-tree">{children.map((child) => renderNode(child, depth + 1))}</ul>
        ) : null}
      </li>
    )
  }
}
