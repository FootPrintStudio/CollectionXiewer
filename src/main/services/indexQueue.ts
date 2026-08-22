/** Bounded async queue for filesystem indexing work. */
const MAX_CONCURRENT = 2

type Job = () => Promise<void>

let active = 0
let draining = false
const queue: Array<{ job: Job; resolve: () => void; reject: (e: unknown) => void }> = []
let drainWaiters: Array<() => void> = []

function notifyDrain(): void {
  if (active > 0 || queue.length > 0) return
  const waiters = drainWaiters
  drainWaiters = []
  for (const w of waiters) w()
}

function pump(): void {
  if (draining) {
    notifyDrain()
    return
  }
  while (active < MAX_CONCURRENT && queue.length > 0) {
    const item = queue.shift()!
    active++
    void item.job().then(
      () => {
        active--
        item.resolve()
        pump()
        notifyDrain()
      },
      (err) => {
        active--
        item.reject(err)
        pump()
        notifyDrain()
      }
    )
  }
  notifyDrain()
}

export function enqueueIndexJob(job: Job): Promise<void> {
  if (draining) return Promise.reject(new Error('Indexer is shutting down'))
  return new Promise((resolve, reject) => {
    queue.push({ job, resolve, reject })
    pump()
  })
}

/** Reject queued work and wait for in-flight jobs before closing the DB. */
export async function drainIndexQueue(): Promise<void> {
  draining = true
  while (queue.length > 0) {
    const item = queue.shift()!
    item.reject(new Error('Indexer is shutting down'))
  }
  if (active === 0) return
  await new Promise<void>((resolve) => {
    drainWaiters.push(resolve)
  })
}
