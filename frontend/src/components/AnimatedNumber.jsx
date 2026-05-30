import { useEffect, useRef, useState } from 'react'

const AnimatedNumber = ({ value, suffix = '', decimals = 0 }) => {
  const numericValue = Number(value) || 0
  const [display, setDisplay] = useState(numericValue)
  const displayRef = useRef(numericValue)

  useEffect(() => {
    const start = displayRef.current
    const delta = numericValue - start
    if (Math.abs(delta) < 0.01) return undefined

    const startedAt = performance.now()
    const duration = 520
    let frame

    const tick = (now) => {
      const progress = Math.min(1, (now - startedAt) / duration)
      const eased = 1 - (1 - progress) ** 3
      const next = start + delta * eased
      displayRef.current = next
      setDisplay(next)
      if (progress < 1) frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [numericValue])

  return `${display.toFixed(decimals)}${suffix}`
}

export default AnimatedNumber
