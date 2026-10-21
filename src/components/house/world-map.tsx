'use client'

import { Minus, Plus, Scan } from 'lucide-react'
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { fitView, panView, sameView, zoomView, type LatLon, type MapView } from '@/game/map-projection'
import { SEA_CSS, loadLand, renderMap, type LandData } from '@/game/world-map'
import { cn } from '@/lib/utils'

/** The map's pixel-art resolution at every zoom level. */
const PIXELS = { w: 176, h: 100 }
export const MAP_ASPECT = PIXELS.w / PIXELS.h

const ZOOM_STEP = 1.6
/** Pointer travel (px) after which a press is a drag rather than a click. */
const DRAG_SLOP = 4

/** View state for a WorldMap, starting fitted around `points`. */
export function useMapView(points: LatLon[]) {
  const fitted = useMemo(() => fitView(points, MAP_ASPECT), [points])
  const [view, setView] = useState(fitted)
  return { view, setView, fitted }
}

/**
 * CSS position for a point at fractions of the map. Rounded so the server's
 * and the browser's float formatting agree when the map is hydrated.
 */
export function mapPosition({ x, y }: { x: number; y: number }) {
  return { left: `${(x * 100).toFixed(3)}%`, top: `${(y * 100).toFixed(3)}%` }
}

interface Props extends Omit<React.HTMLAttributes<HTMLDivElement>, 'onClick'> {
  view: MapView
  fitted: MapView
  onViewChange: (view: MapView) => void
  /** A click (not a drag) on the map, at fractions of the view. */
  onMapClick?: (x: number, y: number) => void
  /** Pins and markers, positioned in % of the map. */
  children?: React.ReactNode
}

/**
 * The pixel world map, rasterized live for the current view so the
 * coastline stays chunky pixel art at every zoom. Drag to pan; zoom with the
 * buttons, + / - keys, a pinch, or Ctrl/⌘-scroll (plain scrolling still
 * scrolls the page).
 */
export function WorldMap({ view, fitted, onViewChange, onMapClick, children, className, style, onKeyDown, ...rest }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const [land, setLand] = useState<LandData | null>(null)
  // Handlers outlive renders (window listeners, the wheel listener), so they
  // read these. A gesture writes viewRef itself so moves between renders add up.
  const viewRef = useRef(view)
  const changeRef = useRef(onViewChange)
  useLayoutEffect(() => {
    viewRef.current = view
    changeRef.current = onViewChange
  })
  const dragged = useRef(false)
  const gesture = useRef<Map<number, { x: number; y: number }> | null>(null)

  useEffect(() => {
    let live = true
    loadLand()
      .then((data) => live && setLand(data))
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d')
    if (!land || !ctx) return
    const frame = requestAnimationFrame(() => ctx.putImageData(renderMap(land, view, PIXELS.w, PIXELS.h), 0, 0))
    return () => cancelAnimationFrame(frame)
  }, [land, view])

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    function onWheel(e: WheelEvent) {
      // Trackpad pinches arrive as wheel events with ctrlKey set.
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const rect = box!.getBoundingClientRect()
      const factor = Math.exp(-e.deltaY * 0.01)
      apply(
        zoomView(viewRef.current, factor, (e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height, MAP_ASPECT),
      )
    }
    box.addEventListener('wheel', onWheel, { passive: false })
    return () => box.removeEventListener('wheel', onWheel)
  }, [])

  function apply(next: MapView) {
    viewRef.current = next
    changeRef.current(next)
  }

  function zoom(factor: number) {
    apply(zoomView(viewRef.current, factor, 0.5, 0.5, MAP_ASPECT))
  }

  function onPointerDown(e: React.PointerEvent) {
    if (e.button !== 0 || (e.target as Element).closest('button')) return
    const active = gesture.current
    if (active) {
      // A second finger joining the gesture turns the drag into a pinch.
      if (e.pointerType === 'touch' && active.size === 1) active.set(e.pointerId, { x: e.clientX, y: e.clientY })
      return
    }
    const box = boxRef.current!
    const pointers = new Map<number, { x: number; y: number }>()
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
    gesture.current = pointers
    const start = { x: e.clientX, y: e.clientY }
    dragged.current = false

    function move(ev: PointerEvent) {
      const last = pointers.get(ev.pointerId)
      if (!last) return
      if (!dragged.current && pointers.size === 1 && Math.hypot(ev.clientX - start.x, ev.clientY - start.y) < DRAG_SLOP) return
      dragged.current = true
      const rect = box.getBoundingClientRect()
      if (pointers.size === 2) {
        const other = [...pointers.entries()].find(([id]) => id !== ev.pointerId)![1]
        const before = Math.hypot(last.x - other.x, last.y - other.y)
        const after = Math.hypot(ev.clientX - other.x, ev.clientY - other.y)
        const fx = ((ev.clientX + other.x) / 2 - rect.left) / rect.width
        const fy = ((ev.clientY + other.y) / 2 - rect.top) / rect.height
        if (before > 0) apply(zoomView(viewRef.current, after / before, fx, fy, MAP_ASPECT))
      } else {
        apply(
          panView(viewRef.current, -(ev.clientX - last.x) / rect.width, -(ev.clientY - last.y) / rect.height, MAP_ASPECT),
        )
      }
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY })
    }
    function up(ev: PointerEvent) {
      pointers.delete(ev.pointerId)
      if (pointers.size > 0) return
      gesture.current = null
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  // A drag that ends over a pin must not follow its link.
  function onClickCapture(e: React.MouseEvent) {
    if (!dragged.current) return
    e.preventDefault()
    e.stopPropagation()
    dragged.current = false
  }

  function onClick(e: React.MouseEvent) {
    if (!onMapClick || (e.target as Element).closest('button, a')) return
    const rect = boxRef.current!.getBoundingClientRect()
    onMapClick((e.clientX - rect.left) / rect.width, (e.clientY - rect.top) / rect.height)
  }

  function handleKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget && (e.key === '+' || e.key === '=' || e.key === '-')) {
      e.preventDefault()
      zoom(e.key === '-' ? 1 / ZOOM_STEP : ZOOM_STEP)
      return
    }
    onKeyDown?.(e)
  }

  const zoomedIn = !sameView(view, fitted)

  return (
    <div
      ref={boxRef}
      {...rest}
      onPointerDown={onPointerDown}
      onClickCapture={onClickCapture}
      onClick={onClick}
      onKeyDown={handleKey}
      className={cn('relative w-full overflow-hidden border-4 border-[#2a2233] select-none', className)}
      // Once zoomed in a finger pans the map; at the fitted view it still scrolls the page.
      style={{ aspectRatio: `${PIXELS.w} / ${PIXELS.h}`, background: SEA_CSS, touchAction: zoomedIn ? 'none' : 'pan-y', ...style }}
    >
      <canvas
        ref={canvasRef}
        width={PIXELS.w}
        height={PIXELS.h}
        aria-hidden
        className="absolute inset-0 h-full w-full"
        style={{ imageRendering: 'pixelated' }}
      />
      {children}
      <div className="absolute right-1.5 bottom-1.5 flex gap-1">
        <MapButton label="Zoom in" onClick={() => zoom(ZOOM_STEP)}>
          <Plus className="size-3.5" />
        </MapButton>
        <MapButton label="Zoom out" onClick={() => zoom(1 / ZOOM_STEP)}>
          <Minus className="size-3.5" />
        </MapButton>
        {zoomedIn && (
          <MapButton label="Show every trip" onClick={() => onViewChange(fitted)}>
            <Scan className="size-3.5" />
          </MapButton>
        )}
      </div>
    </div>
  )
}

function MapButton({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="grid size-6 place-items-center bg-[#2a2233] text-[#f4ecd8] shadow-[0_2px_0_#120e18] hover:bg-[#3d3150] focus-visible:ring-2 focus-visible:ring-[#c9a227] focus-visible:outline-none active:translate-y-px"
    >
      {children}
    </button>
  )
}
