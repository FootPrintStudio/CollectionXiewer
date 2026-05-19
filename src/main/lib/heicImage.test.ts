import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { readHeicDimensions, heicToJpeg } from './heicImage'

const sample = '/home/carl-heinz/Downloads/Test media/sample-heic-1.heic'

async function run(): Promise<void> {
  if (!existsSync(sample)) {
    console.log('heicImage.test.ts: skipped (no sample HEIC on disk)')
    return
  }

  const dims = await readHeicDimensions(sample)
  assert.ok(dims && dims.width > 0 && dims.height > 0)

  const jpeg = await heicToJpeg(sample, 256)
  assert.ok(jpeg && jpeg.length > 1000)

  console.log('heicImage.test.ts: all passed')
}

void run()
