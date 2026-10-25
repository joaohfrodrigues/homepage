import type { VisitorStats } from '@/components/house/visitor-stats'
import type { DialogueId } from './bridge'
import type { UnlockId } from './layout'

export type MissionId = 'bathroom'

/** Things that happen elsewhere in the house which a mission step can wait for. */
export type MissionEvent = 'perfect-bica'

/**
 * One thing to do. A step is done in one of three ways: the stats say so
 * (`stat`), something happens while it's the step to do (`event`), or the
 * visitor picks a choice in a dialogue (`prompt`). Steps are done in order,
 * so a later step never counts before the ones above it.
 */
export interface MissionStep {
  id: string
  /** What to do, shown in the guestbook once the step is reached. */
  title: string
  /** A nudge, shown in the guestbook and given by João while this is the step to do. */
  hint: string
  stat?: (stats: VisitorStats) => boolean
  event?: MissionEvent
  /** Shown where the event happened (e.g. under the bica) when it completes this step. */
  feedback?: string
  /**
   * While this is the step to do, dialogue `at` offers `choice` (with `lines`
   * in place of its usual ones, if given); picking it does the step and shows `reply`.
   */
  prompt?: { at: DialogueId; choice: string; lines?: string[]; reply: { speaker?: string; lines: string[] } }
}

export interface Mission {
  id: MissionId
  title: string
  /** João's choice for a hint while the mission is under way. */
  ask: string
  steps: MissionStep[]
  /** What finishing it gives: part of the house opens and/or a sticker (an `ACHIEVEMENTS` id). */
  reward: { unlock?: UnlockId; sticker?: string; text: string }
}

export const MISSIONS: Mission[] = [
  {
    id: 'bathroom',
    title: 'The stuck door',
    ask: 'Any tips for that bathroom door?',
    steps: [
      {
        id: 'try',
        title: 'Try the bathroom door three times',
        hint: 'The bathroom door won’t open. Keep trying the handle.',
        stat: (stats) => stats.doorTries >= 3,
      },
      {
        id: 'ask',
        title: 'Ask João about the door',
        hint: 'João must know how to get that door open.',
        prompt: {
          at: 'joao',
          choice: 'The bathroom door won’t open',
          reply: {
            speaker: 'João',
            lines: [
              'Ah, that door. It’s older than me, and the wood swells whenever it’s damp, so it jams in the frame.',
              'There’s a knack to it. But a trade secret like that costs a bica. A perfect one.',
            ],
          },
        },
      },
      {
        id: 'bica',
        title: 'Pull João a perfect bica',
        hint: 'João won’t give up the knack for less than a perfect bica: nine bar, right in the gold.',
        event: 'perfect-bica',
        feedback: 'João will want this one. Take it to him.',
      },
      {
        id: 'deliver',
        title: 'Take the bica to João',
        hint: 'João is waiting for his bica.',
        prompt: {
          at: 'joao',
          choice: 'Here’s your bica',
          reply: {
            speaker: 'João',
            lines: [
              'Perfeito. Okay, here’s the knack.',
              'Lift the handle right up, then put your shoulder into the top corner of the door. That’s where it sticks.',
            ],
          },
        },
      },
      {
        id: 'shove',
        title: 'Shoulder the bathroom door open',
        hint: 'Lift the handle and shove the top corner of the bathroom door.',
        prompt: {
          at: 'bathroom',
          lines: ['The handle turns, but the door doesn’t budge.'],
          choice: 'Lift the handle and shove',
          reply: {
            lines: [
              'You lift the handle and throw your shoulder into the top corner.',
              '*CRACK*',
              'The door bursts open, and you very nearly follow it in.',
            ],
          },
        },
      },
    ],
    reward: { unlock: 'bathroom', sticker: 'unstuck', text: 'The bathroom is open.' },
  },
]

export function getMission(id: MissionId): Mission {
  return MISSIONS.find((mission) => mission.id === id)!
}

const stepKey = (mission: Mission, step: MissionStep) => `${mission.id}/${step.id}`

/** How many steps are done, counting from the first. */
export function missionProgress(stats: VisitorStats, mission: Mission): number {
  let done = 0
  for (const step of mission.steps) {
    const recorded = stats.missionSteps.includes(stepKey(mission, step))
    if (!recorded && !step.stat?.(stats)) break
    done++
  }
  return done
}

/** The step to do next, or undefined once the mission is finished. */
export function currentStep(stats: VisitorStats, mission: Mission): MissionStep | undefined {
  return mission.steps[missionProgress(stats, mission)]
}

/** Started once its first step is done, which is also when the guestbook names it. */
export function isMissionStarted(stats: VisitorStats, mission: Mission): boolean {
  return missionProgress(stats, mission) > 0
}

export function isMissionComplete(stats: VisitorStats, id: MissionId): boolean {
  const mission = getMission(id)
  return missionProgress(stats, mission) === mission.steps.length
}

/** Missions under way: started, not finished. */
export function activeMissions(stats: VisitorStats): Mission[] {
  return MISSIONS.filter((mission) => isMissionStarted(stats, mission) && currentStep(stats, mission) !== undefined)
}

/** Everything finished missions have opened. Derived from the steps, so a guestbook reset locks it all again. */
export function unlocksOf(stats: VisitorStats): Set<UnlockId> {
  return new Set(
    MISSIONS.filter((mission) => mission.reward.unlock && isMissionComplete(stats, mission.id)).map(
      (mission) => mission.reward.unlock!,
    ),
  )
}

/** Does `stepId` of a mission if it's the step to do (a prompt was picked). Returns whether it did. */
export function completeStep(stats: VisitorStats, id: MissionId, stepId: string): boolean {
  const mission = getMission(id)
  const step = currentStep(stats, mission)
  if (step?.id !== stepId) return false
  stats.missionSteps.push(stepKey(mission, step))
  return true
}

/** Records `event` against every mission whose next step waits for it; returns the steps it did. */
export function missionEvent(stats: VisitorStats, event: MissionEvent): MissionStep[] {
  const done: MissionStep[] = []
  for (const mission of MISSIONS) {
    const step = currentStep(stats, mission)
    if (step?.event !== event) continue
    stats.missionSteps.push(stepKey(mission, step))
    done.push(step)
  }
  return done
}
