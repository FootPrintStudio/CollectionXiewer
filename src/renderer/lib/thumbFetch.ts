const MAX_CONCURRENT = 6

type Job = {
  run: () => void
}

let active = 0
const queue: Job[] = []

function pump(): void {
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const job = queue.shift()!
    job.run()
  }
}

/** Bounded concurrency for gallery thumb IPC (R06). */
export function fetchThumbBase64(mediaId: number, size: number): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const job: Job = {
      run: () => {
        active++
        void window.collectionXiewer.thumb
          .get(mediaId, size)
          .then(resolve, reject)
          .finally(() => {
            active--
            pump()
          })
      }
    }
    queue.push(job)
    pump()
  })
}
