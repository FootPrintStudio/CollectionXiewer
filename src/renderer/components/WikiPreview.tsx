import { useMemo } from 'react'
import { markdownToHtml } from '../lib/markdown'

interface Props {
  source: string
  onTagLink: (slug: string) => void
  onCollectionLink: (id: number) => void
}

export function WikiPreview({ source, onTagLink, onCollectionLink }: Props) {
  const html = useMemo(() => markdownToHtml(source), [source])

  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const anchor = (e.target as HTMLElement).closest('a')
    if (!anchor) return
    const href = anchor.getAttribute('href')
    if (!href) return

    if (href.startsWith('tag://')) {
      e.preventDefault()
      onTagLink(href.slice(7))
      return
    }
    if (href.startsWith('collection://')) {
      e.preventDefault()
      onCollectionLink(Number(href.slice(14)))
      return
    }
    if (/^https?:/i.test(href)) {
      e.preventDefault()
      void window.collectionXiewer.shell.openExternal(href)
    }
  }

  if (!source.trim()) {
    return <p className="wiki-preview wiki-preview--empty">Nothing to preview yet.</p>
  }

  return (
    <div
      className="wiki-preview"
      dangerouslySetInnerHTML={{ __html: html }}
      onClick={onClick}
    />
  )
}
