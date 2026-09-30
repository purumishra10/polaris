/**
 * Laptop-friendly 3D defaults.
 * 8 hardware threads or fewer (typical student laptops) drop shadows,
 * bloom, HDR environments, and most of the snow field. Stronger machines
 * keep the cinematic pass.
 */
function detectLite() {
  if (typeof navigator === 'undefined') return false
  const cores = navigator.hardwareConcurrency || 4
  const reduced =
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  const mem = navigator.deviceMemory
  return Boolean(reduced || cores <= 8 || (mem && mem <= 4))
}

export const liteGraphics = detectLite()

export function snowCap(count, liteMax, fullMax) {
  const cap = liteGraphics ? liteMax : fullMax
  return Math.max(0, Math.min(cap, Math.round(count)))
}
