import { useCallback, useEffect, useRef, useState } from 'react'

/** Observes an element's content width (ResizeObserver). */
export function useContainerWidth<T extends HTMLElement = HTMLDivElement>() {
  const [width, setWidth] = useState(0)
  const observerRef = useRef<ResizeObserver | null>(null)

  const ref = useCallback((node: T | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null

    if (!node) return

    const update = (w: number) => {
      if (w > 0) setWidth(w)
    }

    update(node.clientWidth)
    const ro = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) update(entry.contentRect.width)
    })
    ro.observe(node)
    observerRef.current = ro
  }, [])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  return { ref, width }
}
