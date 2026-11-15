import assert from 'node:assert/strict'
import {
  buildObsidianOpenUrl,
  displayObsidianLink,
  isObsidianUrl,
  parseObsidianOpenUrl,
  validateObsidianLink
} from './obsidianLinks'

const url = buildObsidianOpenUrl('Test Vault', 'Characters/Hero')
assert.ok(url.startsWith('obsidian://open?'))
assert.equal(isObsidianUrl(url), true)
assert.equal(isObsidianUrl('https://example.com'), false)

const parsed = parseObsidianOpenUrl(url)
assert.ok(parsed)
assert.equal(parsed.vault, 'Test Vault')
assert.equal(parsed.file, 'Characters/Hero')

assert.equal(displayObsidianLink(url), 'Test Vault · Characters/Hero')
assert.equal(validateObsidianLink('', 'Vault', 'Note'), 'Label is required.')
assert.equal(validateObsidianLink('Hero', 'Vault', ''), 'Note path is required.')
assert.equal(validateObsidianLink('Hero', '', 'Note'), null)

console.log('obsidianLinks.test.ts: ok')
