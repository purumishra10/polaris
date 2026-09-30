import { useEffect, useState } from 'react'

/**
 * True while the element is on screen and the tab is visible. Feed it into
 * an R3F `frameloop` so offscreen WebGL canvases stop burning the GPU.
 */
export function useCanvasActive(ref, rootMargin = '120px') {
  const [inView, setInView] = useState(true)
  const [tabVisible, setTabVisible] = useState(
    typeof document === 'undefined' ? true : document.visibilityState !== 'hidden',
  )

  useEffect(() => {
    const node = ref.current
    if (!node || typeof IntersectionObserver === 'undefined') return undefined
    const observer = new IntersectionObserver(
      ([entry]) => setInView(entry.isIntersecting),
      { rootMargin },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [ref, rootMargin])

  useEffect(() => {
    const onVisibility = () => setTabVisible(document.visibilityState !== 'hidden')
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  return inView && tabVisible
}
