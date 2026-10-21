'use client'

import { useEffect, useRef, useState } from 'react'
import type { Dialogue, DialogueChoice } from './dialogues'

interface Props {
  dialogue: Dialogue
  onChoose: (choice: DialogueChoice) => void
  onClose: () => void
}

const CHARS_PER_TICK = 2
const TICK_MS = 16

/**
 * Bottom-of-screen RPG dialogue: types each line out, then offers choices.
 * Give it a `key` per dialogue so switching dialogues restarts from line one.
 */
export function DialogueBox({ dialogue, onChoose, onClose }: Props) {
  const [lineIndex, setLineIndex] = useState(0)
  const [shown, setShown] = useState(0)
  const [selected, setSelected] = useState(0)
  const choiceRefs = useRef<(HTMLButtonElement | null)[]>([])
  const boxRef = useRef<HTMLDivElement>(null)

  const line = dialogue.lines[lineIndex] ?? ''
  const typing = shown < line.length
  const lastLine = lineIndex === dialogue.lines.length - 1
  const showChoices = lastLine && !typing

  useEffect(() => {
    if (!typing) return
    const timer = setTimeout(() => setShown((n) => Math.min(line.length, n + CHARS_PER_TICK)), TICK_MS)
    return () => clearTimeout(timer)
  }, [typing, shown, line.length])

  useEffect(() => {
    if (showChoices) choiceRefs.current[0]?.focus()
    else boxRef.current?.focus()
  }, [showChoices, lineIndex])

  function advance() {
    if (typing) setShown(line.length)
    else if (!lastLine) {
      setLineIndex((i) => i + 1)
      setShown(0)
    }
  }

  function select(index: number) {
    const count = dialogue.choices.length
    const next = (index + count) % count
    setSelected(next)
    choiceRefs.current[next]?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      e.stopPropagation()
      onClose()
      return
    }
    if (showChoices) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault()
        select(selected + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault()
        select(selected - 1)
      } else if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') {
        // Handled here rather than by the focused button's native click, so the
        // highlighted choice is what's picked even if focus has wandered.
        e.preventDefault()
        onChoose(dialogue.choices[selected])
      }
      return
    }
    if (e.key === 'Enter' || e.key === ' ' || e.key === 'e' || e.key === 'E') {
      e.preventDefault()
      advance()
    }
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex justify-center p-4 pb-6 sm:pb-10">
      <div
        ref={boxRef}
        role="dialog"
        aria-label={dialogue.speaker ? `Talking to ${dialogue.speaker}` : 'Notice'}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onClick={showChoices ? undefined : advance}
        className="pixel-window pointer-events-auto relative w-full max-w-2xl cursor-default p-5 pt-6 outline-none"
      >
        {dialogue.speaker && (
          <div className="font-pixel absolute -top-4 left-5 bg-[#2a2233] px-3 py-0.5 text-sm text-[#f4ecd8]">
            {dialogue.speaker}
          </div>
        )}
        <p className="font-pixel min-h-[3.5rem] text-base leading-relaxed sm:text-lg" aria-live="polite">
          {line.slice(0, shown)}
          <span className="invisible">{line.slice(shown)}</span>
        </p>

        {showChoices ? (
          <div className="mt-4 flex flex-wrap gap-3">
            {dialogue.choices.map((choice, i) => (
              <button
                key={choice.label}
                ref={(el) => {
                  choiceRefs.current[i] = el
                }}
                type="button"
                className={`pixel-button ${i === selected ? 'bg-[#3d3150]' : ''}`}
                onFocus={() => setSelected(i)}
                onMouseEnter={() => setSelected(i)}
                onClick={(e) => {
                  e.stopPropagation()
                  onChoose(choice)
                }}
              >
                <span aria-hidden className={`text-[#e8c95a] ${i === selected ? '' : 'invisible'}`}>
                  ▸
                </span>
                {choice.label}
                {choice.kind === 'external' && <span aria-hidden>↗</span>}
              </button>
            ))}
          </div>
        ) : (
          <div className="font-pixel mt-2 flex justify-end text-xs text-[#6d6359]">
            <span className="animate-pulse">{typing ? '…' : 'Click or press E ▾'}</span>
          </div>
        )}
      </div>
    </div>
  )
}
