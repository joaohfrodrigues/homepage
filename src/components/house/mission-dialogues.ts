import { MISSIONS, currentStep, getMission, isMissionStarted, type MissionId } from '@/game/missions'
import type { Dialogue, DialogueChoice, DialogueKey } from './dialogues'
import type { VisitorStats } from './visitor-stats'

/** Dialogue only missions open: João's hint for one, or the reply to a mission choice. */
export type MissionDialogueKey = `mission-hint:${MissionId}` | `mission-reply:${MissionId}/${string}`

export function missionReplyKey(mission: MissionId, step: string): MissionDialogueKey {
  return `mission-reply:${mission}/${step}`
}

export function isMissionDialogue(key: string): key is MissionDialogueKey {
  return key.startsWith('mission-hint:') || key.startsWith('mission-reply:')
}

export function buildMissionDialogue(key: MissionDialogueKey, stats: VisitorStats): Dialogue {
  if (key.startsWith('mission-hint:')) {
    const mission = getMission(key.slice('mission-hint:'.length) as MissionId)
    const step = currentStep(stats, mission)
    return {
      speaker: 'João',
      lines: [step ? step.hint : 'All sorted, thanks to you!'],
      choices: [{ label: 'Thanks!', kind: 'close' }],
    }
  }
  const [missionId, stepId] = key.slice('mission-reply:'.length).split('/')
  const mission = getMission(missionId as MissionId)
  const step = mission.steps.find((candidate) => candidate.id === stepId)
  const finished = mission.steps.at(-1) === step
  return {
    speaker: step?.prompt?.reply.speaker,
    lines: step?.prompt?.reply.lines ?? [],
    choices: [{ label: finished ? 'Mission complete!' : 'Will do', kind: 'close' }],
  }
}

/**
 * Adds what missions have to say to one of the house's own dialogues: the
 * choice that does the step to do there (with its lines in place of the
 * usual ones, if it has some; a mission whose first step is a choice starts
 * this way), and, for missions under way, João's offer of a hint. New
 * choices go before the last one, which is always the way out.
 */
export function withMissionChoices(dialogue: Dialogue, id: DialogueKey, stats: VisitorStats): Dialogue {
  let lines = dialogue.lines
  const added: DialogueChoice[] = []
  for (const mission of MISSIONS) {
    const step = currentStep(stats, mission)
    if (!step) continue
    if (step.prompt?.at === id) {
      lines = step.prompt.lines ?? lines
      added.push({ label: step.prompt.choice, kind: 'mission', mission: mission.id, step: step.id })
    } else if (id === 'joao' && isMissionStarted(stats, mission)) {
      added.push({ label: mission.ask, kind: 'mission', mission: mission.id })
    }
  }
  if (added.length === 0) return dialogue
  const choices = [...dialogue.choices]
  choices.splice(Math.max(0, choices.length - 1), 0, ...added)
  return { ...dialogue, lines, choices }
}
