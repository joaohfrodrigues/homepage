/**
 * The house's sound effects: footsteps, a pop when something is used, Zeno's
 * meow, the coffee machine, a chime for new stickers, and the hidden
 * behaviours' heartbeat, beers, snores and morning birds. Most are
 * synthesised with the Web Audio API; Zeno, the Super Bock and the coffee
 * machine are recordings from `public/house/sounds/` (see CREDITS.txt there),
 * with a synthesised stand-in should a file fail to load. They're on by
 * default but stay silent until the visitor has clicked or pressed a key, and
 * the HUD's sound button turns them off.
 */

import { isSoundOn, noiseBuffer, sample, wake, type Audio } from './audio'

type Sound = (audio: Audio, start: number) => void

/** The recordings, each with the gain that sits it level with the synthesised sounds. */
const RECORDINGS = { 'zeno-meow': 0.35, beer: 0.12, coffee: 0.6 } as const
type Recording = keyof typeof RECORDINGS

/** A recording that has started, so it can be faded out early. */
interface Playing {
  ctx: AudioContext
  gain: GainNode
}

let preloaded = false

function play(sound: Sound) {
  if (!isSoundOn()) return
  const audio = wake()
  if (!audio) return
  // The first sound of the visit starts fetching the recordings, so they're ready when needed.
  if (!preloaded) {
    preloaded = true
    for (const name of Object.keys(RECORDINGS) as Recording[]) void sample(audio.ctx, name)
  }
  sound(audio, audio.ctx.currentTime + 0.01)
}

/** Plays a recording, or `fallback` if it won't load; `then` gets the time it ends. */
function recorded(name: Recording, fallback: Sound, then?: (audio: Audio, end: number) => void): Promise<Playing | null> {
  return new Promise((resolve) =>
    play((audio, t) => {
      void sample(audio.ctx, name).then((buffer) => {
        const start = Math.max(t, audio.ctx.currentTime + 0.01)
        if (!buffer) {
          fallback(audio, start)
          then?.(audio, start + 0.5)
          return resolve(null)
        }
        const source = audio.ctx.createBufferSource()
        source.buffer = buffer
        const gain = audio.ctx.createGain()
        gain.gain.value = RECORDINGS[name]
        source.connect(gain).connect(audio.out)
        source.start(start)
        then?.(audio, start + buffer.duration)
        resolve({ ctx: audio.ctx, gain })
      })
    }),
  )
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
  void recorded('zeno-meow', synthMeow)
}

const synthMeow: Sound = ({ ctx, out }, t) => {
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
}

let pouring: Promise<Playing | null> | null = null

/** The coffee machine starts pulling; it runs until `bicaResult` or the end of the recording. */
export function steam() {
  pouring = recorded('coffee', (audio, t) => {
    burst(audio, t, { length: 0.7, level: 0.05, filter: 'highpass', cutoff: 3500, attack: 0.1 })
    note(audio, t, { from: 60, length: 0.5, level: 0.05, type: 'triangle' })
  })
}

/** How the bica came out: a bright ding for a perfect one, a dull clunk for a bad one. */
export function bicaResult(result: 'perfect' | 'good' | 'under' | 'over') {
  // The machine stops with the pull.
  void pouring?.then((playing) => playing?.gain.gain.setTargetAtTime(0, playing.ctx.currentTime, 0.08))
  pouring = null
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

/** Lub-dub, with each thump of a caffeine overdose. */
export function heartbeat() {
  play((audio, t) => {
    note(audio, t, { from: 70, to: 40, length: 0.14, level: 0.2 })
    note(audio, t + 0.17, { from: 60, to: 38, length: 0.12, level: 0.13 })
  })
}

/** A Super Bock opening. A hiccup follows once the beers have gone to your head. */
export function beer(hiccup: boolean) {
  void recorded(
    'beer',
    (audio, t) => {
      note(audio, t, { from: 1100, to: 380, length: 0.06, level: 0.1 })
      burst(audio, t + 0.03, { length: 0.5, level: 0.05, filter: 'highpass', cutoff: 4000, attack: 0.02 })
    },
    (audio, end) => {
      if (!hiccup) return
      note(audio, end + 0.25, { from: 280, to: 720, length: 0.1, level: 0.09, type: 'triangle' })
      burst(audio, end + 0.25, { length: 0.05, level: 0.04, filter: 'bandpass', cutoff: 1500 })
    },
  )
}

/** Glasses clinking for the toast. */
export function clink() {
  play((audio, t) => {
    // Inharmonic partials make it ring like glass rather than a bell.
    for (const [from, level] of [
      [2350, 0.05],
      [3620, 0.03],
      [5110, 0.02],
    ])
      note(audio, t, { from, length: 0.6, level })
  })
}

/** Nodding off: two slow snores. */
export function snore() {
  play((audio, t) => {
    for (const at of [0.2, 1.7]) {
      burst(audio, t + at, { length: 0.9, level: 0.06, filter: 'lowpass', cutoff: 380, attack: 0.5 })
      note(audio, t + at + 0.2, { from: 72, to: 64, length: 0.7, level: 0.035, type: 'sawtooth' })
    }
  })
}

/** Morning on the sofa: birds outside. */
export function birdsong() {
  play((audio, t) => {
    for (const [at, from, to] of [
      [0.1, 2600, 3900],
      [0.25, 2800, 4100],
      [0.9, 3300, 2500],
      [1.05, 3300, 2500],
      [1.2, 3400, 2600],
    ])
      note(audio, t + at, { from, to, length: 0.09, level: 0.03 })
  })
}
