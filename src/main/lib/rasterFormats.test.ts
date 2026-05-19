import assert from 'node:assert/strict'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  decodeExoticRaster,
  readExoticRasterDimensionsFromBuffer
} from './rasterFormats'

function makeBmp(w: number, h: number): Buffer {
  const row = Math.ceil((w * 3) / 4) * 4
  const sz = 54 + row * h
  const b = Buffer.alloc(sz)
  b.write('BM', 0)
  b.writeUInt32LE(sz, 2)
  b.writeUInt32LE(54, 10)
  b.writeUInt32LE(40, 14)
  b.writeInt32LE(w, 18)
  b.writeInt32LE(h, 22)
  b.writeUInt16LE(1, 26)
  b.writeUInt16LE(24, 28)
  b.writeUInt32LE(row * h, 34)
  return b
}

function makeTga(w: number, h: number): Buffer {
  const header = Buffer.alloc(18)
  header[2] = 2
  header.writeUInt16LE(w, 12)
  header.writeUInt16LE(h, 14)
  header[16] = 24
  return Buffer.concat([header, Buffer.alloc(w * h * 3)])
}

const bmp = makeBmp(128, 96)
const tga = makeTga(64, 48)

assert.deepEqual(readExoticRasterDimensionsFromBuffer(bmp, '.bmp'), { width: 128, height: 96 })
assert.deepEqual(readExoticRasterDimensionsFromBuffer(tga, '.tga'), { width: 64, height: 48 })

const dir = tmpdir()
const bmpPath = join(dir, 'cx-test.bmp')
const tgaPath = join(dir, 'cx-test.tga')
writeFileSync(bmpPath, bmp)
writeFileSync(tgaPath, tga)

async function run(): Promise<void> {
const decodedBmp = await decodeExoticRaster(bmpPath)
assert.equal(decodedBmp?.width, 128)
assert.equal(decodedBmp?.data.length, 128 * 96 * 4)
// 24-bit BMP via bmp-js leaves A=0; we must output opaque alpha for Sharp
let opaqueAlpha = 0
for (let i = 3; i < decodedBmp!.data.length; i += 4) {
  if (decodedBmp!.data[i] === 255) opaqueAlpha++
}
assert.equal(opaqueAlpha, 128 * 96)

  const decodedTga = await decodeExoticRaster(tgaPath)
  assert.equal(decodedTga?.width, 64)

  console.log('rasterFormats.test.ts: all passed')
}

void run()
