import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SearchNode } from '../../shared/searchAst'
import { isEmptySearchAst, countSearchClauses } from '../../shared/searchAst'
import {
  formatSearchQuery,
  parseSearchQuery,
  type SearchResolveContext
} from '../../shared/searchParser'
import { useAppStore } from '../store/appStore'
import { SearchAutocomplete } from './SearchAutocomplete'
import { SavedSearchesMenu } from './SavedSearchesMenu'

const SYNTAX_HELP = `tag:slug — tag on media (descendants included)
-tag:slug — without tag (inclusive tag: clauses in the same AND take priority)
tag:a tag:b — both (anywhere)
tag:a@subject tag:b@subject — same subject (group 1)
tag:a@subject:1 tag:b@subject:1 AND tag:c@subject:2 — two subject groups
suggested:slug — soft-linked suggestion
collection:"Name" — collection membership
principal:slug — principal tag on any collection
folder:"/path/to/root" — under watch folder
name:pattern — path/filename (use * ? globs)
wiki:"phrase" — media wiki body (full-text)
wiki:empty — empty or missing media wiki
untagged: — no tags on media
kind:image — media kind
AND OR NOT ( ) — boolean logic`

export function SearchBar() {
  const searchQueryText = useAppStore((s) => s.searchQueryText)
  const setSearchQuery = useAppStore((s) => s.setSearchQuery)
  const tags = useAppStore((s) => s.tags)
  const collections = useAppStore((s) => s.collections)
  const roots = useAppStore((s) => s.roots)
  const searchAst = useAppStore((s) => s.searchAst)
  const refreshMedia = useAppStore((s) => s.refreshMedia)

  const [localText, setLocalText] = useState(searchQueryText)
  const [cursor, setCursor] = useState(0)
  const [parseError, setParseError] = useState<string | null>(null)
  const [helpOpen, setHelpOpen] = useState(false)
  const [savedRefreshKey, setSavedRefreshKey] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const resolveCtx: SearchResolveContext = useMemo(
    () => ({
      tags: tags.map((t) => ({
        id: t.id,
        slug: t.slug,
        display_name: t.display_name,
        disambiguator: t.disambiguator
      })),
      collections: collections.map((c) => ({ id: c.id, name: c.name })),
      roots: roots.map((r) => ({ id: r.id, path: r.path }))
    }),
    [tags, collections, roots]
  )

  const applyQuery = useCallback(
    (text: string, runSearch = false) => {
      const trimmed = text.trim()
      if (!trimmed) {
        setParseError(null)
        setSearchQuery('', { type: 'and', children: [] })
        if (runSearch) void refreshMedia()
        return true
      }
      const { ast, errors } = parseSearchQuery(trimmed, resolveCtx)
      if (errors.length > 0) {
        setParseError(errors[0]!.message)
        return false
      }
      setParseError(null)
      setSearchQuery(trimmed, ast)
      if (runSearch) void refreshMedia()
      return true
    },
    [resolveCtx, setSearchQuery, refreshMedia]
  )

  const loadSaved = useCallback(
    (text: string, ast: SearchNode) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      setLocalText(text)
      setParseError(null)
      setSearchQuery(text, ast)
      void refreshMedia()
      requestAnimationFrame(() => {
        inputRef.current?.focus()
        const end = text.length
        inputRef.current?.setSelectionRange(end, end)
        setCursor(end)
      })
    },
    [setSearchQuery, refreshMedia]
  )

  useEffect(() => {
    setLocalText(searchQueryText)
  }, [searchQueryText])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (localText.trim() === searchQueryText.trim()) return
      if (applyQuery(localText, true)) {
        /* refresh inside applyQuery when valid */
      }
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [localText, searchQueryText, applyQuery])

  const clauseCount = isEmptySearchAst(searchAst) ? 0 : countSearchClauses(searchAst)
  const chipText = isEmptySearchAst(searchAst) ? '' : formatSearchQuery(searchAst, resolveCtx)

  const saveSearch = async () => {
    if (parseError || isEmptySearchAst(searchAst)) return
    const name = prompt('Saved search name?')
    if (name) {
      const payload = JSON.stringify({
        v: 2,
        ast: searchAst,
        queryText: searchQueryText
      } satisfies { v: 2; ast: SearchNode; queryText: string })
      await window.collectionXiewer.search.savedCreate(name, payload)
      setSavedRefreshKey((k) => k + 1)
    }
  }

  return (
    <div className="search-bar">
      <span className="search-bar__title">Search</span>
      <div className="search-bar__input-wrap">
        <input
          ref={inputRef}
          type="text"
          className={`search-bar__input${parseError ? ' search-bar__input--error' : ''}`}
          value={localText}
          onChange={(e) => {
            setLocalText(e.target.value)
            setCursor(e.target.selectionStart ?? e.target.value.length)
          }}
          onSelect={(e) => {
            const t = e.target as HTMLInputElement
            setCursor(t.selectionStart ?? t.value.length)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              if (debounceRef.current) clearTimeout(debounceRef.current)
              applyQuery(localText, true)
            }
          }}
          onClick={(e) => {
            const t = e.target as HTMLInputElement
            setCursor(t.selectionStart ?? t.value.length)
          }}
          placeholder='tag:hero@subject — type tag: coll: folder: for suggestions'
          spellCheck={false}
          aria-invalid={parseError != null}
          aria-describedby={parseError ? 'search-parse-error' : undefined}
          autoComplete="off"
        />
        <SearchAutocomplete
          text={localText}
          cursor={cursor}
          tags={tags}
          collections={collections}
          roots={roots}
          onApply={(nextText, nextCursor) => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            setLocalText(nextText)
            setCursor(nextCursor)
            applyQuery(nextText, true)
            requestAnimationFrame(() => {
              inputRef.current?.focus()
              inputRef.current?.setSelectionRange(nextCursor, nextCursor)
            })
          }}
        />
      </div>
      <div className="search-bar__actions">
        <SavedSearchesMenu
          resolveCtx={resolveCtx}
          refreshKey={savedRefreshKey}
          onLoad={loadSaved}
        />
        <button
          type="button"
          className="search-bar__help-btn"
          onClick={() => setHelpOpen((o) => !o)}
          title="Syntax help"
          aria-expanded={helpOpen}
        >
          ?
        </button>
        <button
          type="button"
          onClick={() => {
            if (debounceRef.current) clearTimeout(debounceRef.current)
            setLocalText('')
            setParseError(null)
            setSearchQuery('', { type: 'and', children: [] })
            void refreshMedia()
          }}
        >
          Clear
        </button>
        <button type="button" onClick={() => void saveSearch()} disabled={!!parseError || clauseCount === 0}>
          Save
        </button>
      </div>
      {helpOpen ? (
        <pre className="search-bar__help" role="doc-tip">
          {SYNTAX_HELP}
        </pre>
      ) : null}
      {parseError ? (
        <span id="search-parse-error" className="search-bar__error" role="alert">
          {parseError}
        </span>
      ) : (
        <span className="search-bar__status">
          {clauseCount > 0 ? `${clauseCount} clause(s)` : 'All media'}
        </span>
      )}
      {chipText && !parseError ? (
        <div className="search-bar__chips" aria-label="Active filters">
          <span className="search-bar__chip">{chipText}</span>
        </div>
      ) : null}
    </div>
  )
}
