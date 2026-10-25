/**
 * The house's sound effects: footsteps, a pop when something is used, Zeno's
 * meow, the coffee machine, a chime for new stickers, the trophy poster's
 * rustle and a fanfare for making a top 10, the stuck bathroom door and the
 * cabinet over its sink, the hidden behaviours' heartbeat, beers, snores and
 * morning birds, and the gulls over the roofs. Most are
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

let preloaded = false

/** Plays a sound now; false if it can't be heard (sounds off, or no click or key press yet). */
function play(sound: Sound): boolean {
  if (!isSoundOn()) return false
  const audio = wake()
  if (!audio) return false
  // The first sound of the visit starts fetching the recordings, so they're ready when needed.
  if (!preloaded) {
    preloaded = true
    for (const name of Object.keys(RECORDINGS) as Recording[]) void sample(audio.ctx, name)
  }
  sound(audio, audio.ctx.currentTime + 0.01)
  return true
}

/**
 * Plays a recording, or `fallback` if it won't load; `then` gets the time it
 * ends. Resolves with the milliseconds until it ends, or null if it didn't play.
 */
function recorded(name: Recording, fallback: Sound, then?: (audio: Audio, end: number) => void): Promise<number | null> {
  return new Promise((resolve) => {
    const played = play((audio, t) => {
      void sample(audio.ctx, name).then((buffer) => {
        const start = Math.max(t, audio.ctx.currentTime + 0.01)
        const ended = (end: number) => {
          then?.(audio, end)
          resolve((end - audio.ctx.currentTime) * 1000)
        }
        if (!buffer) {
          fallback(audio, start)
          return ended(start + 0.7)
        }
        const source = audio.ctx.createBufferSource()
        source.buffer = buffer
        const gain = audio.ctx.createGain()
        gain.gain.value = RECORDINGS[name]
        source.connect(gain).connect(audio.out)
        source.start(start)
        ended(start + buffer.duration)
      })
    })
    if (!played) resolve(null)
  })
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

/** The stuck bathroom door: the handle clicks down and up, and the door thumps against its frame. */
export function doorRattle() {
  play((audio, t) => {
    for (const at of [0, 0.22]) {
      burst(audio, t + at, { length: 0.025, level: 0.07, filter: 'bandpass', cutoff: 3000 })
      note(audio, t + at, { from: 2100, length: 0.02, level: 0.02, type: 'square' })
      note(audio, t + at + 0.05, { from: 140, to: 80, length: 0.09, level: 0.14 })
      burst(audio, t + at + 0.05, { length: 0.06, level: 0.06, filter: 'lowpass', cutoff: 700 })
    }
  })
}

/** The shoulder that frees it: a thump, the wood cracking out of the frame, and the hinges' creak. */
export function doorBurst() {
  play((audio, t) => {
    note(audio, t, { from: 110, to: 55, length: 0.22, level: 0.2 })
    burst(audio, t, { length: 0.1, level: 0.08, filter: 'lowpass', cutoff: 500 })
    for (const at of [0.08, 0.11, 0.15]) burst(audio, t + at, { length: 0.04, level: 0.09, filter: 'bandpass', cutoff: 1800 })
    // A slow sawtooth through a narrow band-pass groans like an old hinge.
    const { ctx, out } = audio
    const start = t + 0.25
    const osc = ctx.createOscillator()
    osc.type = 'sawtooth'
    osc.frequency.setValueAtTime(38, start)
    osc.frequency.linearRampToValueAtTime(62, start + 0.6)
    const hinge = ctx.createBiquadFilter()
    hinge.type = 'bandpass'
    hinge.Q.value = 8
    hinge.frequency.setValueAtTime(1100, start)
    hinge.frequency.linearRampToValueAtTime(1500, start + 0.6)
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0, start)
    gain.gain.linearRampToValueAtTime(0.08, start + 0.08)
    gain.gain.setTargetAtTime(0, start + 0.5, 0.08)
    osc.connect(hinge).connect(gain).connect(out)
    osc.start(start)
    osc.stop(start + 0.9)
  })
}

/** The mirror cabinet: its magnetic catch letting go, and a few things clinking on the glass shelf. */
export function cabinet() {
  play((audio, t) => {
    burst(audio, t, { length: 0.03, level: 0.06, filter: 'bandpass', cutoff: 2200 })
    note(audio, t + 0.09, { from: 2900, length: 0.12, level: 0.015 })
    note(audio, t + 0.14, { from: 3500, length: 0.1, level: 0.01 })
  })
}

/** A pill popped out of its blister pack, then water from the tap into a glass. */
export function paracetamol() {
  play((audio, t) => {
    burst(audio, t, { length: 0.04, level: 0.07, filter: 'highpass', cutoff: 3000 })
    note(audio, t, { from: 900, to: 500, length: 0.03, level: 0.03, type: 'square' })
    burst(audio, t + 0.4, { length: 1.1, level: 0.04, filter: 'bandpass', cutoff: 2600, attack: 0.08 })
    // The glass filling: its ring rises as the water climbs.
    note(audio, t + 0.4, { from: 700, to: 1300, length: 1, level: 0.012 })
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

let pouring = false

/**
 * The coffee machine starts pulling. The recording outlasts a pull in the
 * game, so it always plays to the end, and pulls made meanwhile don't start
 * another over it.
 */
export function steam() {
  if (pouring) return
  pouring = true
  void recorded('coffee', (audio, t) => {
    burst(audio, t, { length: 0.7, level: 0.05, filter: 'highpass', cutoff: 3500, attack: 0.1 })
    note(audio, t, { from: 60, length: 0.5, level: 0.05, type: 'triangle' })
  }).then((ms) => window.setTimeout(() => (pouring = false), ms ?? 0))
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

/** The trophy poster's paper, looked at up close: barely there. */
export function rustle() {
  play((audio, t) => {
    burst(audio, t, { length: 0.08, level: 0.03, filter: 'bandpass', cutoff: 3200, attack: 0.01 })
    burst(audio, t + 0.07, { length: 0.12, level: 0.022, filter: 'bandpass', cutoff: 2400, attack: 0.02 })
  })
}

const taDaDaa: Sound = (audio, t) => {
  note(audio, t, { from: hz(67), length: 0.12, level: 0.04, type: 'square' })
  note(audio, t + 0.12, { from: hz(72), length: 0.12, level: 0.04, type: 'square' })
  note(audio, t + 0.24, { from: hz(76), length: 0.5, level: 0.045, type: 'square' })
  note(audio, t + 0.24, { from: hz(64), length: 0.5, level: 0.025, type: 'triangle' })
}

/** Ta-da-daa: a submitted score made a top 10. */
export function fanfare() {
  play(taDaDaa)
}

/** A pen scratching a quick autograph on the Hall of Fame, then the fanfare. */
export function signature() {
  play((audio, t) => {
    // Short strokes of nib on paper, each pitched a little differently, like loops of a signature.
    ;[2600, 3400, 2200, 3800, 3000].forEach((cutoff, i) => {
      burst(audio, t + i * 0.07, { length: 0.06, level: 0.025, filter: 'bandpass', cutoff, attack: 0.01 })
    })
    taDaDaa(audio, t + 0.45)
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

/** A gull gliding over the rooftops: a few falling "kyow"s, far off. */
export function gull() {
  play((audio, t) => {
    const calls = 2 + Math.floor(Math.random() * 3)
    for (let i = 0; i < calls; i++) gullCall(audio, t + i * 0.28)
  })
}

const gullCall: Sound = ({ ctx, out }, t) => {
  const osc = ctx.createOscillator()
  osc.type = 'sawtooth'
  osc.frequency.setValueAtTime(1500, t)
  osc.frequency.linearRampToValueAtTime(2100, t + 0.05)
  osc.frequency.exponentialRampToValueAtTime(950, t + 0.24)
  // A narrow, nasal band-pass turns the saw into a squawk.
  const throat = ctx.createBiquadFilter()
  throat.type = 'bandpass'
  throat.Q.value = 6
  throat.frequency.setValueAtTime(2600, t)
  throat.frequency.exponentialRampToValueAtTime(1600, t + 0.24)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0, t)
  gain.gain.linearRampToValueAtTime(0.05, t + 0.02)
  gain.gain.setTargetAtTime(0, t + 0.16, 0.04)
  osc.connect(throat).connect(gain).connect(out)
  osc.start(t)
  osc.stop(t + 0.4)
}
