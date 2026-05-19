import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { pickSeekSeconds, probeVideoStream, videoThumbnailToJpeg } from './videoThumb'

assert.equal(pickSeekSeconds(null), 1)
assert.equal(pickSeekSeconds(800), 0.4)
assert.equal(pickSeekSeconds(10_000), 1)

const sample = '/home/carl-heinz/Downloads/Test media/sample-wheel-landon.mp4'

async function run(): Promise<void> {
  if (!existsSync(sample)) {
    console.log('videoThumb.test.ts: skipped (no sample video on disk)')
    return
  }

  const probe = await probeVideoStream(sample)
  assert.ok(probe && probe.width === 640 && probe.height === 360)

  const jpeg = await videoThumbnailToJpeg(sample, 256)
  assert.ok(jpeg && jpeg.length > 500)

  console.log('videoThumb.test.ts: all passed')
}

void run()
