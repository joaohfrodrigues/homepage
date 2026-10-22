'use client'

import { useEffect, useRef } from 'react'

/** ↑↑↓↓←→←→BA, as KeyboardEvent.key values (letters lowercased). */
const KONAMI = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

/**
 * Calls `onCode` once the Konami code has been typed while `enabled`. It only
 * listens: the arrows (and A) still walk the guest, and nothing happens until
 * the sequence is complete.
 */
export function useKonamiCode(enabled: boolean, onCode: () => void) {
  const handler = useRef(onCode)
  useEffect(() => {
    handler.current = onCode
  })

  useEffect(() => {
    if (!enabled) return
    // Starts over whenever the house stops taking input, so a panel in between breaks the sequence.
    let typed: string[] = []
    function onKey(e: KeyboardEvent) {
      if (e.repeat || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable]')) return
      typed = [...typed, e.key.length === 1 ? e.key.toLowerCase() : e.key].slice(-KONAMI.length)
      if (typed.length === KONAMI.length && typed.every((key, i) => key === KONAMI[i])) {
        typed = []
        handler.current()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [enabled])
}

/** A short 8-bit fanfare from square waves. Silently skipped where Web Audio isn't available. */
export function playFanfare() {
  try {
    const audio = new AudioContext()
    const notes: [frequency: number, start: number, length: number][] = [
      [523.25, 0, 0.1],
      [659.25, 0.1, 0.1],
      [783.99, 0.2, 0.1],
      [1046.5, 0.3, 0.18],
      [783.99, 0.5, 0.1],
      [1046.5, 0.6, 0.4],
    ]
    for (const [frequency, start, length] of notes) {
      const osc = audio.createOscillator()
      const gain = audio.createGain()
      osc.type = 'square'
      osc.frequency.value = frequency
      gain.gain.setValueAtTime(0.06, audio.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + start + length)
      osc.connect(gain).connect(audio.destination)
      osc.start(audio.currentTime + start)
      osc.stop(audio.currentTime + start + length)
    }
    setTimeout(() => audio.close(), 1500)
  } catch {
    // No Web Audio: the party is a quiet one.
  }
}
