import assert from 'node:assert/strict'
import { buildFtsMatchQuery } from './ftsQuery'

assert.equal(buildFtsMatchQuery('hello world'), '"hello"* AND "world"*')
assert.equal(buildFtsMatchQuery('  '), null)

console.log('ftsQuery.test.ts: all passed')
