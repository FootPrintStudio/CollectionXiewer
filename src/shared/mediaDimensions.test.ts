import assert from 'node:assert/strict'
import { displayDimensions, mediaAspectRatio } from './mediaDimensions'

const stacked = displayDimensions(248, 2048, 'motion')
assert.equal(stacked.width, 248)
assert.equal(stacked.height, 256)

const normal = displayDimensions(248, 256, 'motion')
assert.equal(normal.height, 256)

const ratio = mediaAspectRatio(248, 2048, 'motion')
assert.ok(ratio > 0.9 && ratio < 1.1, `expected ~1:1, got ${ratio}`)

console.log('mediaDimensions.test.ts: all passed')
