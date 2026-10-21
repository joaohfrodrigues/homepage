'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils'
import { PanelWindow } from './panel-window'
import { readStats, updateStats, type BicaResult } from './visitor-stats'

interface Props {
  onClose: () => void
}

type Phase = 'ready' | 'pulling' | 'done'
type Result = BicaResult

const MAX_BAR = 15
const SWEET_SPOT = 9

const RESULTS: Record<Result, { title: string; text: string; coffee: string; crema: string }> = {
  perfect: { title: 'Perfect bica!', text: 'Thick hazelnut crema. João would approve.', coffee: '#4a2c1a', crema: '#c08a4a' },
  good: { title: 'A decent bica', text: 'Drinkable. Not one for the photos.', coffee: '#4a2c1a', crema: '#a07850' },
  under: { title: 'Watery', text: 'Under-extracted — not enough pressure.', coffee: '#8a6040', crema: '#b89874' },
  over: { title: 'Bitter', text: 'Over-extracted — easy on the pressure.', coffee: '#2a1810', crema: '#4a2c1a' },
}

function judge(bar: number): Result {
  const off = Math.abs(bar - SWEET_SPOT)
  if (off <= 0.5) return 'perfect'
  if (off <= 1.5) return 'good'
  return bar < SWEET_SPOT ? 'under' : 'over'
}

/**
 * The kitchen's espresso machine: start the pull, then stop the pressure
 * needle as close to 9 bar as possible. Perfect pulls in a row speed it up.
 */
export function BicaPanel({ onClose }: Props) {
  const [phase, setPhase] = useState<Phase>('ready')
  const [bar, setBar] = useState(0)
  const [result, setResult] = useState<Result | null>(null)
  const [streak, setStreak] = useState(0)
  // Only ever rendered client-side (it opens from the game), so localStorage is safe here.
  const [best, setBest] = useState(() => readStats().bicaBestStreak)
  const frame = useRef<number | null>(null)
  const angle = useRef(-Math.PI / 2)
  const actionRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (phase !== 'pulling') return
    let last = performance.now()
    const speed = Math.min(3 + streak * 0.5, 7)
    const tick = (now: number) => {
      angle.current += ((now - last) / 1000) * speed
      last = now
      setBar(((Math.sin(angle.current) + 1) / 2) * MAX_BAR)
      frame.current = requestAnimationFrame(tick)
    }
    frame.current = requestAnimationFrame(tick)
    return () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current)
    }
  }, [phase, streak])

  useEffect(() => {
    actionRef.current?.focus()
  }, [phase])

  const act = useCallback(() => {
    if (phase === 'pulling') {
      const outcome = judge(bar)
      const nextStreak = outcome === 'perfect' ? streak + 1 : 0
      setResult(outcome)
      setStreak(nextStreak)
      setPhase('done')
      if (nextStreak > best) setBest(nextStreak)
      updateStats((stats) => {
        stats.bicas[outcome]++
        stats.bicaBestStreak = Math.max(stats.bicaBestStreak, nextStreak)
      })
    } else {
      angle.current = -Math.PI / 2
      setResult(null)
      setPhase('pulling')
    }
  }, [phase, bar, streak, best])

  const outcome = result ? RESULTS[result] : null
  const needle = (bar / MAX_BAR) * 100

  return (
    <PanelWindow eyebrow="Kitchen · Coffee machine" title="Pull a bica" width="narrow" onClose={onClose}>
      <p className="mb-4 text-sm text-[#6d6359]">
        A good bica pulls at about 9 bar. Start the pull, then stop the needle in the gold zone.
      </p>

      <div className="relative mb-2 flex justify-between font-pixel text-xs text-[#6d6359]">
        <span>0 bar</span>
        <span className="absolute -translate-x-1/2" style={{ left: `${(SWEET_SPOT / MAX_BAR) * 100}%` }}>
          9
        </span>
        <span>15 bar</span>
      </div>
      <div className="relative h-8 border-4 border-[#2a2233] bg-[#9fc3d6]" aria-hidden>
        {/* Zones: watery · decent · perfect · decent · bitter */}
        <div className="absolute inset-y-0 bg-[#d8b45a]" style={{ left: `${(7.5 / MAX_BAR) * 100}%`, width: `${(3 / MAX_BAR) * 100}%` }} />
        <div className="absolute inset-y-0 bg-[#c9a227]" style={{ left: `${(8.5 / MAX_BAR) * 100}%`, width: `${(1 / MAX_BAR) * 100}%` }} />
        <div className="absolute inset-y-0 right-0 bg-[#8e2f35]" style={{ left: `${(10.5 / MAX_BAR) * 100}%` }} />
        <div className="absolute -top-2 -bottom-2 w-1.5 -translate-x-1/2 bg-[#2a2233]" style={{ left: `${needle}%` }} />
      </div>
      <p className="font-pixel mt-2 text-center text-sm" aria-live="polite">
        {phase === 'pulling' ? `${bar.toFixed(1)} bar` : outcome ? `${outcome.title} (${bar.toFixed(1)} bar)` : 'Ready when you are'}
      </p>

      <div className="mt-5 flex items-end justify-center gap-6">
        {/* The cup fills with whatever the pull produced. */}
        <div className="relative h-16 w-16" aria-hidden>
          <div className="absolute inset-x-1 bottom-0 top-3 overflow-hidden border-4 border-t-0 border-[#2a2233] bg-[#f4f6f8]">
            <div
              className={cn('absolute inset-x-0 bottom-0 transition-[height] duration-700', phase === 'pulling' && 'duration-[2000ms]')}
              style={{
                height: phase === 'ready' ? '0%' : phase === 'pulling' ? '55%' : '70%',
                background: outcome?.coffee ?? '#4a2c1a',
              }}
            >
              <div className="h-1.5" style={{ background: outcome?.crema ?? '#a07850' }} />
            </div>
          </div>
          <div className="absolute -right-2 top-6 h-5 w-3 border-4 border-l-0 border-[#2a2233]" />
        </div>
        <div className="text-sm">
          {outcome && <p className="mb-1 text-[#6d6359]">{outcome.text}</p>}
          <p className="font-pixel text-xs text-[#6d6359]">
            Perfect streak: {streak} · Best: {best}
          </p>
        </div>
      </div>

      <div className="mt-5 flex justify-center">
        <button ref={actionRef} type="button" className="pixel-button" onClick={act}>
          {phase === 'pulling' ? 'Stop!' : phase === 'done' ? 'Another one' : 'Start the pull'}
        </button>
      </div>
    </PanelWindow>
  )
}
