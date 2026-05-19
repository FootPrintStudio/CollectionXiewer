import assert from 'node:assert/strict'
import { defaultSearchAst, isEmptySearchAst, countSearchClauses } from './searchAst'
import { formatSearchQuery, parseSearchQuery } from './searchParser'

const ctx = {
  tags: [{ id: 1, slug: 'hero', display_name: 'Hero', disambiguator: null }],
  collections: [],
  roots: []
}

assert.equal(isEmptySearchAst(defaultSearchAst), true)
assert.equal(isEmptySearchAst({ type: 'tag', tagId: 1, include: true }), false)
assert.equal(isEmptySearchAst({ type: 'or', children: [] }), false)

const single = parseSearchQuery('tag:hero', ctx)
assert.equal(single.errors.length, 0)
assert.equal(single.ast.type, 'tag')
assert.equal(isEmptySearchAst(single.ast), false)
assert.equal(countSearchClauses(single.ast), 1)

assert.equal(formatSearchQuery({ type: 'untagged' }), 'untagged:')
assert.equal(formatSearchQuery({ type: 'wikiEmpty' }), 'wiki:empty')

console.log('searchAst.test.ts: all passed')
