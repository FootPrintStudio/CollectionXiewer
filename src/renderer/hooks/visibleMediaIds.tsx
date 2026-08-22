import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode
} from 'react'

type Ctx = {
  register: (id: number) => void
  unregister: (id: number) => void
}

const VisibleMediaIdsContext = createContext<Ctx | null>(null)

/** Tracks media ids currently mounted in the gallery virtualizer (viewport + overscan). */
export function VisibleMediaIdsProvider({
  children,
  onChange
}: {
  children: ReactNode
  onChange: (ids: number[]) => void
}) {
  const idsRef = useRef(new Set<number>())
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const flush = useCallback(() => {
    timerRef.current = null
    onChangeRef.current([...idsRef.current])
  }, [])

  const schedule = useCallback(() => {
    if (timerRef.current != null) return
    timerRef.current = setTimeout(flush, 80)
  }, [flush])

  useEffect(
    () => () => {
      if (timerRef.current != null) clearTimeout(timerRef.current)
    },
    []
  )

  const register = useCallback(
    (id: number) => {
      if (idsRef.current.has(id)) return
      idsRef.current.add(id)
      schedule()
    },
    [schedule]
  )

  const unregister = useCallback(
    (id: number) => {
      if (!idsRef.current.delete(id)) return
      schedule()
    },
    [schedule]
  )

  const value = useMemo(() => ({ register, unregister }), [register, unregister])

  return (
    <VisibleMediaIdsContext.Provider value={value}>{children}</VisibleMediaIdsContext.Provider>
  )
}

export function useRegisterVisibleMedia(mediaId: number): void {
  const ctx = useContext(VisibleMediaIdsContext)
  useEffect(() => {
    if (!ctx) return
    ctx.register(mediaId)
    return () => ctx.unregister(mediaId)
  }, [ctx, mediaId])
}
