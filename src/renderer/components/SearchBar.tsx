import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SavedSearch } from '../../shared/types'
import type { SearchNode } from '../../shared/searchAst'
import { defaultSearchAst, isEmptySearchAst, countSearchClauses } from '../../shared/searchAst'
import {
  formatSearchQuery,
  parseSearchQuery,
  type SearchResolveContext
} from '../../shared/searchParser'
import { useAppStore } from '../store/appStore'
import { SearchAutocomplete, type SearchAutocompleteHandle } from './SearchAutocomplete'
import { handleSearchAutocompleteKeyDown } from '../lib/searchAutocompleteKeys'
import { SavedSearchesMenu } from './SavedSearchesMenu'
import { SaveSearchModal } from '../ui/SaveSearchModal'

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
  const [activeSavedSearchId, setActiveSavedSearchId] = useState<number | null>(null)
  const [saveModal, setSaveModal] = useState<{ queryText: string; ast: SearchNode } | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const autocompleteRef = useRef<SearchAutocompleteHandle>(null)

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

  const commitLocalQuery = useCallback((): { queryText: string; ast: SearchNode } | null => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
    const trimmed = localText.trim()
    if (!trimmed) {
      setParseError(null)
      setSearchQuery('', defaultSearchAst)
      return null
    }
    const { ast, errors } = parseSearchQuery(trimmed, resolveCtx)
    if (errors.length > 0) {
      setParseError(errors[0]!.message)
      return null
    }
    setParseError(null)
    setSearchQuery(trimmed, ast)
    return { queryText: trimmed, ast }
  }, [localText, resolveCtx, setSearchQuery])

  const buildSavedPayload = useCallback(
    (queryText: string, ast: SearchNode) =>
      JSON.stringify({
        v: 2,
        ast,
        queryText
      } satisfies { v: 2; ast: SearchNode; queryText: string }),
    []
  )

  const localQueryState = useMemo(() => {
    const trimmed = localText.trim()
    if (!trimmed) {
      return { clauseCount: 0, canSave: false, ast: defaultSearchAst, error: null as string | null }
    }
    const { ast, errors } = parseSearchQuery(trimmed, resolveCtx)
    if (errors.length > 0) {
      return {
        clauseCount: 0,
        canSave: false,
        ast: defaultSearchAst,
        error: errors[0]!.message
      }
    }
    return {
      clauseCount: countSearchClauses(ast),
      canSave: !isEmptySearchAst(ast),
      ast,
      error: null as string | null
    }
  }, [localText, resolveCtx])

  const loadSaved = useCallback(
    (row: SavedSearch, text: string, ast: SearchNode) => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      setActiveSavedSearchId(row.id)
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

  const updateSavedRow = useCallback(
    async (id: number) => {
      const committed = commitLocalQuery()
      if (!committed || isEmptySearchAst(committed.ast)) return
      await window.collectionXiewer.search.savedUpdate(id, {
        query_json: buildSavedPayload(committed.queryText, committed.ast)
      })
      setActiveSavedSearchId(id)
      setSavedRefreshKey((k) => k + 1)
    },
    [commitLocalQuery, buildSavedPayload]
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

  const displayError = localQueryState.error ?? parseError
  const clauseCount = localQueryState.clauseCount
  const chipText = localQueryState.canSave
    ? formatSearchQuery(localQueryState.ast, resolveCtx)
    : isEmptySearchAst(searchAst)
      ? ''
      : formatSearchQuery(searchAst, resolveCtx)

  const openSaveAsNew = () => {
    const committed = commitLocalQuery()
    if (!committed || isEmptySearchAst(committed.ast)) return
    setSaveModal(committed)
  }

  return (
    <div className="search-bar">
      <span className="search-bar__title">Search</span>
      <div className="search-bar__input-wrap">
        <input
          ref={inputRef}
          type="text"
          className={`search-bar__input${displayError ? ' search-bar__input--error' : ''}`}
          value={localText}
          onChange={(e) => {
            setLocalText(e.target.value)
            setActiveSavedSearchId(null)
            setCursor(e.target.selectionStart ?? e.target.value.length)
          }}
          onSelect={(e) => {
            const t = e.target as HTMLInputElement
            setCursor(t.selectionStart ?? t.value.length)
          }}
          onKeyDown={(e) => {
            if (handleSearchAutocompleteKeyDown(e, autocompleteRef)) return
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
          aria-invalid={displayError != null}
          aria-describedby={displayError ? 'search-parse-error' : undefined}
          autoComplete="off"
        />
        <SearchAutocomplete
          ref={autocompleteRef}
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
          onUpdateRow={(id) => void updateSavedRow(id)}
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
            setActiveSavedSearchId(null)
            setParseError(null)
            setSearchQuery('', { type: 'and', children: [] })
            void refreshMedia()
          }}
        >
          Clear
        </button>
        <button
          type="button"
          onClick={() => void updateSavedRow(activeSavedSearchId!)}
          disabled={activeSavedSearchId == null || !localQueryState.canSave}
          title="Overwrite the loaded saved search with the current query"
        >
          Update
        </button>
        <button
          type="button"
          onClick={openSaveAsNew}
          disabled={!localQueryState.canSave}
        >
          Save as…
        </button>
      </div>
      {helpOpen ? (
        <pre className="search-bar__help" role="doc-tip">
          {SYNTAX_HELP}
        </pre>
      ) : null}
      {displayError ? (
        <span id="search-parse-error" className="search-bar__error" role="alert">
          {displayError}
        </span>
      ) : (
        <span className="search-bar__status">
          {clauseCount > 0 ? `${clauseCount} clause(s)` : 'All media'}
        </span>
      )}
      {chipText && !displayError ? (
        <div className="search-bar__chips" aria-label="Active filters">
          <span className="search-bar__chip">{chipText}</span>
        </div>
      ) : null}
      {saveModal ? (
        <SaveSearchModal
          queryText={saveModal.queryText}
          ast={saveModal.ast}
          onClose={() => setSaveModal(null)}
          onSaved={(row) => {
            setActiveSavedSearchId(row.id)
            setSavedRefreshKey((k) => k + 1)
          }}
        />
      ) : null}
    </div>
  )
}
