"use client"

import { Icon } from "@repo/icons";
import { useCallback, useEffect, useRef, useState } from "react"
import { flushSync } from "react-dom"



export type TransitionVariant =
  | "circle"
  | "square"
  | "triangle"
  | "diamond"
  | "hexagon"
  | "rectangle"
  | "star"

interface AnimatedThemeTogglerProps extends React.ComponentPropsWithoutRef<"button"> {
  duration?: number
  variant?: TransitionVariant
  /** When true, the transition expands from the viewport center instead of the icon. */
  fromCenter?: boolean
  /**
   * Controlled theme value. When provided, the parent owns persistence
   * (e.g. `next-themes`) and this component will not write to localStorage.
   */
  theme?: "light" | "dark"
  /** Called on toggle. Pair with `theme` for controlled usage. */
  onThemeChange?: (theme: "light" | "dark") => void
}

function polygonCollapsed(point: string, vertexCount: number): string {
  const pairs = Array.from({ length: vertexCount }, () => point).join(", ")
  return `polygon(${pairs})`
}

// All coordinates are percentages of the snapshot reference box: Chrome 150
// renders absolute px clip-path coordinates on ::view-transition-new(root)
// unscaled on fractional display scales (e.g. Windows 150%) for the first
// transition after load, so px values land at the wrong position (#989).
function getThemeTransitionClipPaths(
  variant: TransitionVariant,
  cx: number,
  cy: number,
  maxRadius: number,
  viewportWidth: number,
  viewportHeight: number
): [string, string] {
  const toX = (x: number) => `${(x / viewportWidth) * 100}%`
  const toY = (y: number) => `${(y / viewportHeight) * 100}%`
  const point = (x: number, y: number) => `${toX(x)} ${toY(y)}`
  // circle() percentage radii resolve against hypot(w, h) / sqrt(2) of the reference box.
  const toRadius = (r: number) =>
    `${(r / (Math.hypot(viewportWidth, viewportHeight) / Math.SQRT2)) * 100}%`

  switch (variant) {
    case "circle":
      return [
        `circle(0% at ${point(cx, cy)})`,
        `circle(${toRadius(maxRadius)} at ${point(cx, cy)})`,
      ]
    case "square": {
      const halfW = Math.max(cx, viewportWidth - cx)
      const halfH = Math.max(cy, viewportHeight - cy)
      const halfSide = Math.max(halfW, halfH) * 1.05
      const end = [
        point(cx - halfSide, cy - halfSide),
        point(cx + halfSide, cy - halfSide),
        point(cx + halfSide, cy + halfSide),
        point(cx - halfSide, cy + halfSide),
      ].join(", ")
      return [polygonCollapsed(point(cx, cy), 4), `polygon(${end})`]
    }
    case "triangle": {
      const scale = maxRadius * 2.2
      const dx = (Math.sqrt(3) / 2) * scale
      const verts = [
        point(cx, cy - scale),
        point(cx + dx, cy + 0.5 * scale),
        point(cx - dx, cy + 0.5 * scale),
      ].join(", ")
      return [polygonCollapsed(point(cx, cy), 3), `polygon(${verts})`]
    }
    case "diamond": {
      // Slightly larger than the view-transition circle radius so axis-aligned coverage matches the circle reveal.
      const R = maxRadius * Math.SQRT2
      const end = [
        point(cx, cy - R),
        point(cx + R, cy),
        point(cx, cy + R),
        point(cx - R, cy),
      ].join(", ")
      return [polygonCollapsed(point(cx, cy), 4), `polygon(${end})`]
    }
    case "hexagon": {
      const R = maxRadius * Math.SQRT2
      const verts: string[] = []
      for (let i = 0; i < 6; i++) {
        const a = -Math.PI / 2 + (i * Math.PI) / 3
        verts.push(point(cx + R * Math.cos(a), cy + R * Math.sin(a)))
      }
      return [
        polygonCollapsed(point(cx, cy), 6),
        `polygon(${verts.join(", ")})`,
      ]
    }
    case "rectangle": {
      const halfW = Math.max(cx, viewportWidth - cx)
      const halfH = Math.max(cy, viewportHeight - cy)
      const end = [
        point(cx - halfW, cy - halfH),
        point(cx + halfW, cy - halfH),
        point(cx + halfW, cy + halfH),
        point(cx - halfW, cy + halfH),
      ].join(", ")
      return [polygonCollapsed(point(cx, cy), 4), `polygon(${end})`]
    }
    case "star": {
      // Small overscan so the last frames never leave a 1px seam before the transition group ends.
      const R = maxRadius * Math.SQRT2 * 1.03
      const innerRatio = 0.42
      const starPolygon = (radius: number) => {
        const verts: string[] = []
        for (let i = 0; i < 5; i++) {
          const outerA = -Math.PI / 2 + (i * 2 * Math.PI) / 5
          verts.push(
            point(
              cx + radius * Math.cos(outerA),
              cy + radius * Math.sin(outerA)
            )
          )
          const innerA = outerA + Math.PI / 5
          verts.push(
            point(
              cx + radius * innerRatio * Math.cos(innerA),
              cy + radius * innerRatio * Math.sin(innerA)
            )
          )
        }
        return `polygon(${verts.join(", ")})`
      }
      const startR = Math.max(2, R * 0.025)
      return [starPolygon(startR), starPolygon(R)]
    }
    default:
      return [
        `circle(0% at ${point(cx, cy)})`,
        `circle(${toRadius(maxRadius)} at ${point(cx, cy)})`,
      ]
  }
}

export const AnimatedThemeToggler = ({
  className,
  duration = 400,
  variant,
  fromCenter = false,
  theme,
  onThemeChange,
  children,
  ...props
}: AnimatedThemeTogglerProps) => {
  const shape = variant ?? "circle"
  const isControlled = theme !== undefined
  const [internalIsDark, setInternalIsDark] = useState(false)
  const isDark = isControlled ? theme === "dark" : internalIsDark
  const buttonRef = useRef<HTMLButtonElement>(null)
  const iconRef = useRef<HTMLSpanElement>(null)
  const isTransitioningRef = useRef(false)
  useEffect(() => {
    return () => {
      const root = document.documentElement
      if (!isTransitioningRef.current) return
      delete root.dataset.magicuiThemeVt
      root.style.removeProperty("--magicui-theme-toggle-vt-duration")
      root.style.removeProperty("--magicui-theme-vt-clip-from")
    }
  }, [])

  useEffect(() => {
    if (isControlled) return

    const updateTheme = () => {
      setInternalIsDark(document.documentElement.classList.contains("dark"))
    }

    updateTheme()

    const observer = new MutationObserver(updateTheme)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    })

    return () => observer.disconnect()
  }, [isControlled])

  const toggleTheme = useCallback(() => {
    const button = buttonRef.current
    if (
      !button || !iconRef.current ||
      isTransitioningRef.current ||
      document.documentElement.dataset.magicuiThemeVt === "active"
    )
      return

    // innerWidth/innerHeight (not visualViewport): percentages must resolve
    // against the snapshot reference box, which includes classic scrollbars.
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    let x: number
    let y: number
    if (fromCenter) {
      x = viewportWidth / 2
      y = viewportHeight / 2
    } else {
      const { top, left, width, height } = iconRef.current.getBoundingClientRect()
      x = left + width / 2
      y = top + height / 2
    }

    const maxRadius = Math.hypot(
      Math.max(x, viewportWidth - x),
      Math.max(y, viewportHeight - y)
    )

    const applyTheme = () => {
      const newTheme = !document.documentElement.classList.contains("dark")
      // Always toggle the class synchronously so the View Transitions API
      // snapshots the new theme inside the startViewTransition callback.
      document.documentElement.classList.toggle("dark", newTheme)
      document.documentElement.classList.toggle("light", !newTheme)
      if (isControlled) {
        onThemeChange?.(newTheme ? "dark" : "light")
      } else {
        setInternalIsDark(newTheme)
        localStorage.setItem("theme", newTheme ? "dark" : "light")
      }
    }

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      applyTheme()
      return
    }

    // Keep the outgoing profile visible around the expanding circle, including
    // in embedded browsers that skip native view-transition snapshots.
    const profile = button.closest("main.profile")
    if (profile) {
      const layer = document.createElement("div")
      const outgoing = profile.cloneNode(true) as HTMLElement
      const rect = profile.getBoundingClientRect()
      layer.className = document.documentElement.classList.contains("dark") ? "dark" : "light"
      layer.dataset.theme = layer.className
      layer.inert = true
      layer.setAttribute("aria-hidden", "true")
      layer.style.cssText = "position:fixed;inset:0;z-index:2147483646;overflow:hidden;pointer-events:none;"
      layer.style.backgroundColor = getComputedStyle(document.body).backgroundColor
      outgoing.style.cssText += `;position:absolute;margin:0;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;`
      layer.append(outgoing)
      document.body.append(layer)
      isTransitioningRef.current = true
      flushSync(applyTheme)
      const start = performance.now()
      const frame = (now: number) => {
        const progress = Math.min(1, (now - start) / duration)
        const radius = maxRadius * progress * progress * (3 - 2 * progress)
        layer.style.maskImage = `radial-gradient(circle at ${x}px ${y}px, transparent ${radius}px, black ${radius + 1}px)`
        if (progress < 1 && button.isConnected) requestAnimationFrame(frame)
        else { layer.remove(); isTransitioningRef.current = false }
      }
      requestAnimationFrame(frame)
      return
    }
    if (typeof document.startViewTransition !== "function") {
      flushSync(applyTheme)
      document.body.animate([{opacity: .55}, {opacity: 1}], {duration, easing: "ease-out"})
      return
    }

    const clipPath = getThemeTransitionClipPaths(
      shape,
      x,
      y,
      maxRadius,
      viewportWidth,
      viewportHeight
    )

    const root = document.documentElement
    root.dataset.magicuiThemeVt = "active"
    root.style.setProperty(
      "--magicui-theme-toggle-vt-duration",
      `${duration}ms`
    )
    // Pin the collapsed clip-path via CSS so Firefox does not paint the new
    // theme unclipped between snapshot and the ready.then() JS animation.
    root.style.setProperty("--magicui-theme-vt-clip-from", clipPath[0])
    root.style.setProperty("--theme-reveal-end", clipPath[1])
    const cleanup = () => {
      isTransitioningRef.current = false
      delete root.dataset.magicuiThemeVt
      root.style.removeProperty("--magicui-theme-toggle-vt-duration")
      root.style.removeProperty("--magicui-theme-vt-clip-from")
      root.style.removeProperty("--theme-reveal-end")
    }

    isTransitioningRef.current = true
    const transition = document.startViewTransition(() => {
      flushSync(applyTheme)
    })
    transition.ready.catch(() => {})
    if (typeof transition?.finished?.finally === "function") {
      transition.finished.finally(cleanup).catch(() => {})
    } else {
      cleanup()
    }

  }, [
    shape,
    fromCenter,
    duration,

    isControlled,
    onThemeChange,

  ])

  return (
    <button
      type="button"
      ref={buttonRef}
      onClick={toggleTheme}
      className={className}
      {...props}
    >
      <span ref={iconRef}><Icon name={isDark ? "sun" : "moon"} size={24} /></span>{children}

    </button>
  )
}
