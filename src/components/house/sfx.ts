/**
 * The house's sound effects: footsteps, a pop when something is used, Zeno's
 * meow, the coffee machine and a chime for new stickers. Like the record
 * player they're synthesised with the Web Audio API, so there are no files to
 * download. They're on by default but stay silent until the visitor has
 * clicked or pressed a key, and the HUD's sound button turns them off.
 */

import { isSoundOn, noiseBuffer, wake, type Audio } from './audio'

type Sound = (audio: Audio, start: number) => void

function play(sound: Sound) {
  if (!isSoundOn()) return
  const audio = wake()
  if (audio) sound(audio, audio.ctx.currentTime + 0.01)
}

const hz = (note: number) => 440 * 2 ** ((note - 69) / 12)

/** A decaying oscillator note. */
function note(
  { ctx, out }: Audio,
  start: number,
  { from, to = from, length, level, type = 'sine' }: { from: number; to?: number; length: number; level: number; type?: OscillatorType },
) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(from, start)
  if (to !== from) osc.frequency.exponentialRampToValueAtTime(to, start + length * 0.6)
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(level, start + 0.005)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
  osc.connect(gain).connect(out)
  osc.start(start)
  osc.stop(start + length + 0.02)
}

/** A filtered burst of noise. */
function burst(
  { ctx, out }: Audio,
  start: number,
  { length, level, filter, cutoff, attack = 0.003 }: { length: number; level: number; filter: BiquadFilterType; cutoff: number; attack?: number },
) {
  const source = ctx.createBufferSource()
  source.buffer = noiseBuffer(ctx)
  const shape = ctx.createBiquadFilter()
  shape.type = filter
  shape.frequency.value = cutoff
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, start)
  gain.gain.linearRampToValueAtTime(level, start + attack)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + length)
  source.connect(shape).connect(gain).connect(out)
  source.start(start, Math.random())
  source.stop(start + length + 0.02)
}

let leftFoot = false

/** A soft tap on the floorboards, alternating feet; meant to be barely there. */
export function step() {
  leftFoot = !leftFoot
  const cutoff = leftFoot ? 520 : 640
  play((audio, t) => {
    burst(audio, t, { length: 0.06, level: 0.035, filter: 'lowpass', cutoff })
    note(audio, t, { from: leftFoot ? 95 : 110, to: 70, length: 0.05, level: 0.03 })
  })
}

/** Something used: a panel opening, a page, a light switch. */
export function pop() {
  play((audio, t) => note(audio, t, { from: 420, to: 760, length: 0.09, level: 0.09 }))
}

/** Someone starts talking. */
export function blip() {
  play((audio, t) => {
    note(audio, t, { from: 660, length: 0.05, level: 0.04, type: 'square' })
    note(audio, t + 0.06, { from: 880, length: 0.06, level: 0.035, type: 'square' })
  })
}

/** Knock knock, on the bathroom door. */
export function knock() {
  play((audio, t) => {
    for (const at of [0, 0.16]) {
      note(audio, t + at, { from: 190, to: 90, length: 0.08, level: 0.16 })
      burst(audio, t + at, { length: 0.04, level: 0.08, filter: 'bandpass', cutoff: 900 })
    }
  })
}

/** Zeno, pleased to be petted. */
export function meow() {
  play(({ ctx, out }, t) => {
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(520, t)
    osc.frequency.linearRampToValueAtTime(780, t + 0.18)
    osc.frequency.linearRampToValueAtTime(470, t + 0.55)
    // The "eeow" comes from sweeping a vowel-ish band-pass over the saw.
    const mouth = ctx.createBiquadFilter()
    mouth.type = 'bandpass'
    mouth.Q.value = 4
    mouth.frequency.setValueAtTime(900, t)
    mouth.frequency.linearRampToValueAtTime(1800, t + 0.2)
    mouth.frequency.linearRampToValueAtTime(800, t + 0.55)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, t)
    gain.gain.linearRampToValueAtTime(0.14, t + 0.06)
    gain.gain.setTargetAtTime(0, t + 0.42, 0.06)
    osc.connect(mouth).connect(gain).connect(out)
    osc.start(t)
    osc.stop(t + 0.8)
  })
}

/** The coffee machine starts pulling. */
export function steam() {
  play((audio, t) => {
    burst(audio, t, { length: 0.7, level: 0.05, filter: 'highpass', cutoff: 3500, attack: 0.1 })
    note(audio, t, { from: 60, length: 0.5, level: 0.05, type: 'triangle' })
  })
}

/** How the bica came out: a bright ding for a perfect one, a dull clunk for a bad one. */
export function bicaResult(result: 'perfect' | 'good' | 'under' | 'over') {
  play((audio, t) => {
    if (result === 'perfect') {
      note(audio, t, { from: hz(88), length: 0.9, level: 0.07 })
      note(audio, t, { from: hz(95), length: 0.7, level: 0.04 })
    } else if (result === 'good') {
      note(audio, t, { from: hz(83), length: 0.5, level: 0.06 })
    } else {
      note(audio, t, { from: 150, to: 110, length: 0.15, level: 0.06, type: 'square' })
    }
  })
}

/** A little rising arpeggio for a new sticker. */
export function chime() {
  play((audio, t) => {
    ;[72, 76, 79, 84].forEach((n, i) => note(audio, t + i * 0.08, { from: hz(n), length: 0.4, level: 0.06, type: 'triangle' }))
  })
}

/** The lights going off for the night, or on again. */
export function lightSwitch() {
  play((audio, t) => {
    burst(audio, t, { length: 0.02, level: 0.12, filter: 'highpass', cutoff: 2000 })
    note(audio, t, { from: 1400, length: 0.025, level: 0.04, type: 'square' })
  })
}
