import assert from 'node:assert/strict'
import {
  buildMintThemeName,
  parseFontName,
  parseMintThemeName
} from './desktopTheme'

const aquaDark = parseMintThemeName('Mint-Y-Dark-Aqua')
assert.ok(aquaDark)
assert.equal(aquaDark.style, 'y')
assert.equal(aquaDark.appearance, 'dark')
assert.equal(aquaDark.colorName, 'Aqua')
assert.equal(buildMintThemeName(aquaDark, 'light'), 'Mint-Y-Aqua')
assert.equal(buildMintThemeName(aquaDark, 'dark'), 'Mint-Y-Dark-Aqua')

const plain = parseMintThemeName('Mint-Y-Dark')
assert.ok(plain)
assert.equal(plain.colorName, null)
assert.equal(buildMintThemeName(plain, 'light'), 'Mint-Y')

const darker = parseMintThemeName('Mint-L-Darker-Teal')
assert.ok(darker)
assert.equal(darker.style, 'l')
assert.equal(darker.appearance, 'darker')
assert.equal(buildMintThemeName(darker, 'darker'), 'Mint-L-Darker-Teal')

const font = parseFontName('Ubuntu 10')
assert.equal(font.family, 'Ubuntu')
assert.equal(font.sizePt, 10)

const bold = parseFontName('Ubuntu Bold 11')
assert.equal(bold.family, 'Ubuntu')
assert.equal(bold.sizePt, 11)

assert.equal(parseMintThemeName('Adwaita'), null)

console.log('desktopTheme.test.ts: ok')
