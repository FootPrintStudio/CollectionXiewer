import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Requires hovering a drop target for `holdMs` before `ready` becomes true.
 */
export function useDelayedDropTarget(holdMs: number) {
  const [targetId, setTargetId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const targetIdRef = useRef<string | null>(null)
  const readyRef = useRef(false)

  useEffect(() => {
    targetIdRef.current = targetId
    readyRef.current = ready
  }, [targetId, ready])

  const clear = useCallback(() => {
    if (timerRef.current != null) clearTimeout(timerRef.current)
    timerRef.current = null
    targetIdRef.current = null
    readyRef.current = false
    setTargetId(null)
    setReady(false)
  }, [])

  const arm = useCallback(
    (id: string | null) => {
      if (id == null) {
        clear()
        return
      }
      if (id === targetIdRef.current && (readyRef.current || timerRef.current != null)) return
      if (timerRef.current != null) clearTimeout(timerRef.current)
      targetIdRef.current = id
      readyRef.current = false
      setTargetId(id)
      setReady(false)
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        readyRef.current = true
        setReady(true)
      }, holdMs)
    },
    [clear, holdMs]
  )

  const getCommittedTarget = useCallback((): string | null => {
    return readyRef.current ? targetIdRef.current : null
  }, [])

  const isPending = useCallback(
    (id: string) => targetId === id && !ready,
    [targetId, ready]
  )

  const isReady = useCallback((id: string) => targetId === id && ready, [targetId, ready])

  return { targetId, ready, arm, clear, isPending, isReady, getCommittedTarget }
}
