import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { EditorView } from '@codemirror/view'
import { tags as t } from '@lezer/highlight'

const wikiEditorTheme = EditorView.theme(
  {
    '&': {
      backgroundColor: 'var(--bg-panel)',
      color: 'var(--text)'
    },
    '.cm-scroller': {
      fontFamily: 'var(--font-mono)',
      backgroundColor: 'var(--bg-panel)'
    },
    '&.cm-focused': {
      outline: '1px solid var(--accent)',
      outlineOffset: -1
    },
    '.cm-content': {
      fontFamily: 'var(--font-mono)',
      fontSize: '0.82rem',
      lineHeight: '1.55',
      caretColor: 'var(--accent)',
      color: 'var(--text)'
    },
    '.cm-line': {
      color: 'var(--text)'
    },
    '.cm-cursor, .cm-dropCursor': {
      borderLeftColor: 'var(--accent)'
    },
    '.cm-gutters': {
      backgroundColor: 'var(--bg-panel)',
      color: 'var(--text-muted)',
      borderRight: '1px dashed var(--border-dashed)'
    },
    '.cm-activeLine': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)'
    },
    '.cm-activeLineGutter': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 14%, var(--bg-panel))'
    },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 28%, transparent) !important'
    }
  },
  { dark: true }
)

const wikiHighlightStyle = HighlightStyle.define([
  { tag: t.heading, color: 'var(--text)', fontWeight: '700' },
  { tag: [t.heading1, t.heading2, t.heading3, t.heading4, t.heading5, t.heading6], color: 'var(--text)', fontWeight: '700' },
  { tag: t.strong, color: 'var(--text)', fontWeight: '700' },
  { tag: t.emphasis, color: 'var(--text)', fontStyle: 'italic' },
  { tag: [t.link, t.url, t.labelName], color: 'var(--accent-hover)' },
  { tag: t.content, color: 'var(--text)' },
  { tag: [t.string, t.literal], color: 'var(--text)' },
  { tag: [t.quote, t.comment, t.meta], color: 'var(--text-muted)' },
  { tag: [t.keyword, t.atom, t.number, t.bool, t.regexp, t.escape], color: 'var(--text)' },
  { tag: t.list, color: 'var(--text)' },
  { tag: t.strikethrough, textDecoration: 'line-through', color: 'var(--text-muted)' },
  { tag: t.invalid, color: 'var(--danger)' }
])

export const wikiCodemirrorExtensions = [
  wikiEditorTheme,
  syntaxHighlighting(wikiHighlightStyle),
  EditorView.lineWrapping
]
