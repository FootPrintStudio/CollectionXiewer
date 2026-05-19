import { useEffect, useMemo, useState } from 'react'
import { useAppStore } from '../store/appStore'
import { formatTagLabel } from '../../shared/tagDisplay'
import { describeColorInheritance, DEFAULT_TAG_COLOR } from '../../shared/tagColor'
import { describeIconInheritance, normalizeTagIcon } from '../../shared/tagIcon'
import type { Tag, TagConnection, TagExternalLink } from '../../shared/types'
import { WikiEditor } from './WikiEditor'
import { tagChipStyle } from '../lib/tagChipStyle'
import { useResolvedTagColor } from '../hooks/useResolvedTagColor'
import { useResolvedTagIcon } from '../hooks/useResolvedTagIcon'
import { TagGlyph } from './TagGlyph'
import { TagChipContent } from './TagChipContent'
import { TagInheritSwitch } from '../ui/TagInheritSwitch'
import { TagConnectionsSection } from './TagConnectionsSection'
import { TagExternalLinksSection } from './TagExternalLinksSection'

export function TagPanel() {
  const selectedTagId = useAppStore((s) => s.selectedTagId)
  const refreshTags = useAppStore((s) => s.refreshTags)
  const selectTag = useAppStore((s) => s.selectTag)
  const tagGroups = useAppStore((s) => s.tagGroups)
  const tags = useAppStore((s) => s.tags)
  const [tag, setTag] = useState<Tag | null>(null)
  const [connections, setConnections] = useState<TagConnection[]>([])
  const [links, setLinks] = useState<TagExternalLink[]>([])
  const [allTags, setAllTags] = useState<Tag[]>([])

  const effectiveColor = useResolvedTagColor(tag)
  const effectiveIcon = useResolvedTagIcon(tag)

  const inheritSource = useMemo(() => {
    if (!tag) return ''
    const tagsById = new Map(tags.map((t) => [t.id, t]))
    const tagGroupsById = new Map(tagGroups.map((g) => [g.id, g]))
    return describeColorInheritance(tag, tagsById, tagGroupsById)
  }, [tag, tags, tagGroups])

  const tagsById = useMemo(() => new Map(tags.map((t) => [t.id, t])), [tags])

  const inheritIconSource = useMemo(() => {
    if (!tag) return ''
    const tagsById = new Map(tags.map((t) => [t.id, t]))
    const tagGroupsById = new Map(tagGroups.map((g) => [g.id, g]))
    return describeIconInheritance(tag, tagsById, tagGroupsById)
  }, [tag, tags, tagGroups])

  useEffect(() => {
    if (!selectedTagId) {
      setTag(null)
      return
    }
    void (async () => {
      const t = await window.collectionXiewer.tags.get(selectedTagId)
      setTag(t ?? null)
      setConnections(await window.collectionXiewer.tags.connections(selectedTagId))
      setLinks(await window.collectionXiewer.tags.externalLinks(selectedTagId))
      setAllTags(await window.collectionXiewer.tags.list())
    })()
  }, [selectedTagId])

  if (!selectedTagId || !tag) {
    return null
  }

  const update = async (patch: Partial<Tag>) => {
    const updated = await window.collectionXiewer.tags.update(tag.id, patch)
    setTag(updated)
    await refreshTags()
  }

  const setInheritColor = (inherit: boolean) => {
    void update({
      use_custom_color: !inherit,
      ...(inherit ? {} : { color: tag.color ?? effectiveColor ?? DEFAULT_TAG_COLOR })
    })
  }

  const setInheritIcon = (inherit: boolean) => {
    void update({
      use_custom_icon: !inherit,
      ...(inherit ? {} : { icon: tag.icon ?? effectiveIcon })
    })
  }

  return (
    <div className="tag-panel-content">
      <h2 style={{ margin: '0 0 0.5rem', fontSize: '1.1rem' }}>{formatTagLabel(tag)}</h2>

      <div className="field">
        <label>Display name</label>
        <input
          value={tag.display_name}
          onChange={(e) => setTag({ ...tag, display_name: e.target.value })}
          onBlur={() => void update({ display_name: tag.display_name })}
        />
      </div>

      <div className="field">
        <label>Disambiguator</label>
        <input
          value={tag.disambiguator ?? ''}
          onChange={(e) => setTag({ ...tag, disambiguator: e.target.value || null })}
          onBlur={() => void update({ disambiguator: tag.disambiguator })}
        />
      </div>

      <section className="tag-appearance-section" aria-label="Tag appearance">
        <p className="panel-title">Appearance</p>
        <div className="tag-appearance-section__body">
          <div className="tag-appearance-section__controls">
            <div className="tag-appearance-section__row">
              <label>Colour</label>
              <div className="tag-appearance-section__row-content">
                <div className="tag-appearance-field__row">
                  <TagInheritSwitch
                    inherit={!tag.use_custom_color}
                    onChange={setInheritColor}
                    ariaLabel="Inherit or custom colour"
                  />
                  {tag.use_custom_color ? (
                    <input
                      type="color"
                      className="tag-appearance-field__color"
                      value={tag.color ?? DEFAULT_TAG_COLOR}
                      onChange={(e) => {
                        const color = e.target.value
                        setTag({ ...tag, color })
                        void update({ color })
                      }}
                    />
                  ) : null}
                </div>
                {!tag.use_custom_color ? (
                  <span className="tag-appearance-section__inherit-note">{inheritSource}</span>
                ) : null}
              </div>
            </div>

            <div className="tag-appearance-section__row">
              <label>Icon</label>
              <div className="tag-appearance-section__row-content">
                <div className="tag-appearance-field__row">
                  <TagInheritSwitch
                    inherit={!tag.use_custom_icon}
                    onChange={setInheritIcon}
                    ariaLabel="Inherit or custom icon"
                  />
                  {tag.use_custom_icon ? (
                    <input
                      type="text"
                      className="tag-appearance-field__icon-input"
                      value={tag.icon ?? ''}
                      maxLength={4}
                      spellCheck={false}
                      placeholder="🐕"
                      onChange={(e) => setTag({ ...tag, icon: e.target.value || null })}
                      onBlur={() => void update({ icon: normalizeTagIcon(tag.icon) })}
                    />
                  ) : null}
                </div>
                {!tag.use_custom_icon ? (
                  <span className="tag-appearance-section__inherit-note">
                    {effectiveIcon ? (
                      <TagGlyph icon={effectiveIcon} color={effectiveColor} className="tag-appearance-section__inherit-glyph" />
                    ) : null}
                    {inheritIconSource}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="tag-appearance-section__preview">
            <span className="chip tag-appearance-section__preview-chip" style={tagChipStyle(effectiveColor)}>
              <TagChipContent tag={tag} />
            </span>
          </div>
        </div>
      </section>
      <div className="field">
        <label>Tag group</label>
        <select
          value={tag.tag_group_id ?? ''}
          onChange={(e) =>
            void update({
              tag_group_id: e.target.value ? Number(e.target.value) : null
            })
          }
        >
          <option value="">Uncategorized</option>
          {tagGroups.map((g) => (
            <option key={g.id} value={g.id}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label>Parent tag</label>
        <select
          value={tag.parent_id ?? ''}
          onChange={(e) =>
            void update({ parent_id: e.target.value ? Number(e.target.value) : null })
          }
        >
          <option value="">None</option>
          {allTags
            .filter((t) => t.id !== tag.id)
            .map((t) => (
              <option key={t.id} value={t.id}>
                {formatTagLabel(t)}
              </option>
            ))}
        </select>
      </div>

      <TagConnectionsSection
        sourceTag={tag}
        connections={connections}
        tagsById={tagsById}
        onSelectTag={selectTag}
        onConnectionsChange={setConnections}
      />

      <TagExternalLinksSection tag={tag} links={links} onLinksChange={setLinks} />

      <WikiEditor entityType="tag" entityId={tag.id} />
    </div>
  )
}
