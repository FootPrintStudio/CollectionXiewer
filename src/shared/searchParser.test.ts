import assert from 'node:assert/strict'
import { parseSearchQuery } from './searchParser'
import type { SearchResolveContext } from './searchParser'

const ctx: SearchResolveContext = {
  tags: [
    { id: 1, slug: 'hero', display_name: 'Hero', disambiguator: null },
    { id: 2, slug: 'orange', display_name: 'Orange', disambiguator: null },
    { id: 3, slug: 'salt', display_name: 'Salt', disambiguator: null },
    { id: 4, slug: 'green', display_name: 'Green', disambiguator: null },
    { id: 5, slug: 'cape', display_name: 'Cape', disambiguator: null }
  ],
  collections: [{ id: 10, name: 'Summer' }],
  roots: [{ id: 20, path: '/photos' }]
}

function parse(text: string) {
  return parseSearchQuery(text, ctx)
}

// Implicit AND, same subject group 1
{
  const { ast, errors } = parse('tag:hero@subject tag:cape@subject')
  assert.equal(errors.length, 0)
  assert.equal(ast.type, 'and')
  if (ast.type === 'and') {
    assert.equal(ast.children.length, 2)
    const a = ast.children[0]
    const b = ast.children[1]
    assert.equal(a?.type, 'tag')
    assert.equal(b?.type, 'tag')
    if (a?.type === 'tag' && b?.type === 'tag') {
      assert.equal(a.subjectGroup, 1)
      assert.equal(b.subjectGroup, 1)
    }
  }
}

// Two scope groups with explicit AND (flat AND; engine buckets by subjectGroup)
{
  const { ast, errors } = parse(
    'tag:hero@subject:1 tag:orange@subject:1 AND tag:salt@subject:2 tag:green@subject:2'
  )
  assert.equal(errors.length, 0)
  assert.equal(ast.type, 'and')
  if (ast.type === 'and') {
    const tags = ast.children.filter((c) => c.type === 'tag')
    assert.equal(tags.length, 4)
    const groups = new Set(
      tags.map((t) => (t.type === 'tag' ? t.subjectGroup : undefined))
    )
    assert.deepEqual([...groups].sort(), [1, 2])
  }
}

// Loose tags (no subject group)
{
  const { ast, errors } = parse('tag:hero tag:orange')
  assert.equal(errors.length, 0)
  if (ast.type === 'and') {
    for (const c of ast.children) {
      if (c.type === 'tag') assert.equal(c.subjectGroup, undefined)
    }
  }
}

// Collection quoted
{
  const { ast, errors } = parse('collection:"Summer"')
  assert.equal(errors.length, 0)
  assert.equal(ast.type, 'collection')
  if (ast.type === 'collection') assert.equal(ast.collectionId, 10)
}

// Unknown tag fails
{
  const { errors } = parse('tag:nonexistent')
  assert.ok(errors.length > 0)
}

// OR with subject-scoped clause (AST shape for evaluator)
{
  const { ast, errors } = parse('tag:hero@subject OR tag:orange')
  assert.equal(errors.length, 0)
  assert.equal(ast.type, 'or')
  if (ast.type === 'or') {
    const scoped = ast.children.find((c) => c.type === 'tag' && c.subjectGroup === 1)
    assert.ok(scoped)
  }
}

// Curation clauses
{
  const { ast, errors } = parse('untagged:')
  assert.equal(errors.length, 0)
  assert.equal(ast.type, 'untagged')
}
{
  const { ast, errors } = parse('wiki:empty')
  assert.equal(errors.length, 0)
  assert.equal(ast.type, 'wikiEmpty')
}
{
  const { ast, errors } = parse('wiki:"motion"')
  assert.equal(errors.length, 0)
  assert.equal(ast.type, 'wiki')
  if (ast.type === 'wiki') assert.equal(ast.query, 'motion')
}

console.log('searchParser.test.ts: all passed')
