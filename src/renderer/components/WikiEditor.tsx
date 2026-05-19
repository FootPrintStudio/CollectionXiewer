import { useCallback, useEffect, useMemo, useState } from 'react'
import CodeMirror from '@uiw/react-codemirror'
import { markdown } from '@codemirror/lang-markdown'
import { useAppStore } from '../store/appStore'
import { TagInheritSwitch } from '../ui/TagInheritSwitch'
import { wikiCodemirrorExtensions } from '../lib/wikiCodemirrorTheme'
import { WikiPreview } from './WikiPreview'
import { SectionHelp } from '../ui/SectionHelp'

type WikiViewMode = 'edit' | 'preview'

interface Props {
  entityType: 'tag' | 'media' | 'collection'
  entityId: number
}

export function WikiEditor({ entityType, entityId }: Props) {
  const [body, setBody] = useState('')
  const [savedBody, setSavedBody] = useState('')
  const [viewMode, setViewMode] = useState<WikiViewMode>('preview')
  const [loading, setLoading] = useState(true)
  const setSelectedTagId = useAppStore((s) => s.setSelectedTagId)
  const setSelectedCollectionId = useAppStore((s) => s.setSelectedCollectionId)
  const setDetailsFocus = useAppStore((s) => s.setDetailsFocus)
  const refreshMedia = useAppStore((s) => s.refreshMedia)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void window.collectionXiewer.wiki.get(entityType, entityId).then((p) => {
      if (cancelled) return
      setBody(p.body_md)
      setSavedBody(p.body_md)
      setViewMode('preview')
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [entityType, entityId])

  const isDirty = body !== savedBody
  const isPreview = viewMode === 'preview'

  const save = useCallback(() => {
    if (!isDirty) return
    void window.collectionXiewer.wiki.save(entityType, entityId, body).then(() => {
      setSavedBody(body)
    })
  }, [body, entityType, entityId, isDirty])

  const onTagLink = useCallback((slug: string) => {
    void window.collectionXiewer.tags.list().then((tags) => {
      const t = tags.find((x) => x.slug === slug)
      if (t) {
        setSelectedTagId(t.id)
        setDetailsFocus('tag')
      }
    })
  }, [setSelectedTagId, setDetailsFocus])

  const onCollectionLink = useCallback(
    (id: number) => {
      setSelectedCollectionId(id)
      setDetailsFocus('collection')
      void refreshMedia()
    },
    [setSelectedCollectionId, setDetailsFocus, refreshMedia]
  )

  const setPreviewMode = useCallback(
    (preview: boolean) => {
      if (preview) {
        if (viewMode === 'edit') save()
        setViewMode('preview')
      } else {
        setViewMode('edit')
      }
    },
    [save, viewMode]
  )

  const extensions = useMemo(() => [markdown(), ...wikiCodemirrorExtensions], [])

  return (
    <section className="wiki-section" aria-label="Wiki">
      <div className="wiki-section__header">
        <p className="panel-title">
          Wiki
          <SectionHelp label="Wiki help">
            Markdown notes. Link tags with <code>[[tag:slug]]</code> and collections with{' '}
            <code>[[collection:123]]</code>.
          </SectionHelp>
        </p>
        <div className="wiki-section__controls">
          {isDirty ? <span className="wiki-section__status">Unsaved</span> : null}
          <TagInheritSwitch
            inherit={isPreview}
            onChange={setPreviewMode}
            inheritLabel="Preview"
            customLabel="Edit"
            ariaLabel="Wiki preview or edit"
          />
        </div>
      </div>

      <div className="wiki-editor">
        {loading ? (
          <p className="wiki-editor__loading">Loading…</p>
        ) : isPreview ? (
          <WikiPreview
            source={body}
            onTagLink={onTagLink}
            onCollectionLink={onCollectionLink}
          />
        ) : (
          <CodeMirror
            value={body}
            height="200px"
            theme="none"
            className="wiki-editor__codemirror"
            extensions={extensions}
            onChange={(v) => setBody(v)}
            onBlur={save}
          />
        )}
      </div>
    </section>
  )
}
