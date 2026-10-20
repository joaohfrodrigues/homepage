import type { DialogueId, PanelId } from '@/game/bridge'
import { getTopic, type TopicId } from '@/game/topics'
import type { HouseData } from '@/lib/house'

/** Dialogue ids the game can open, plus follow-ups only reachable from a choice. */
export type DialogueKey = DialogueId | 'joao-contact'

export type DialogueChoice =
  | { label: string; kind: 'link'; href: string }
  | { label: string; kind: 'external'; href: string }
  | { label: string; kind: 'next'; id: DialogueKey }
  | { label: string; kind: 'panel'; panel: PanelId }
  | { label: string; kind: 'night'; on: boolean }
  | { label: string; kind: 'close' }

export interface Dialogue {
  speaker?: string
  lines: string[]
  choices: DialogueChoice[]
}

export function buildDialogue(id: DialogueKey, data: HouseData, house: { night: boolean }): Dialogue {
  const contactChoices: DialogueChoice[] = data.contactLinks.map((link) => ({
    label: link.label,
    kind: 'external',
    href: link.href,
  }))

  switch (id) {
    case 'joao':
      return {
        speaker: 'João',
        lines: [
          "Hey, welcome in! I'm João.",
          ...(data.aboutIntro ? [data.aboutIntro] : []),
          'Make yourself at home. The map in the study has every trip I’ve photographed, and most things around the flat have a story.',
        ],
        choices: [
          { label: 'Tell me more about you', kind: 'link', href: '/about' },
          { label: 'How can I reach you?', kind: 'next', id: 'joao-contact' },
          { label: 'See you around', kind: 'close' },
        ],
      }
    case 'joao-contact':
      return {
        speaker: 'João',
        lines: [
          "LinkedIn is the quickest way to reach me. Code's on GitHub, and the photos also live on Unsplash. There's a note with all of it on the console by the front door.",
        ],
        choices: [...contactChoices, { label: 'Thanks!', kind: 'close' }],
      }
    case 'letterbox':
      return {
        lines: [
          'Today’s post, stacked on the console by the door.',
          'A note on top: “Best way to reach me is LinkedIn. Code lives on GitHub, photos on Unsplash.”',
        ],
        choices: [...contactChoices, { label: 'Put it back', kind: 'close' }],
      }
    case 'front-door':
      return {
        lines: ["The front door. You've only just arrived, so have a look around first!"],
        choices: [
          { label: 'Open the directory', kind: 'panel', panel: 'directory' },
          { label: 'Stay a while', kind: 'close' },
        ],
      }
    case 'bed':
      return house.night
        ? {
            lines: ['It’s late, and the bed looks very inviting.'],
            choices: [
              { label: 'Sleep until morning', kind: 'night', on: false },
              { label: 'Five more minutes', kind: 'close' },
            ],
          }
        : {
            lines: ['A neatly made double bed. The duvet looks very soft.'],
            choices: [
              { label: 'Nap until evening', kind: 'night', on: true },
              { label: 'Not now', kind: 'close' },
            ],
          }
    case 'alarm':
      return {
        lines: ['The alarm clock is set for 06:30. A sticky note on it says “long run day”.'],
        choices: [
          { label: 'See the races →', kind: 'link', href: '/hobbies/running' },
          { label: 'Snooze', kind: 'close' },
        ],
      }
    case 'bathroom':
      return {
        lines: ['*knock knock*', '“Occupied!”', '…wasn’t João in the living room?'],
        choices: [{ label: 'Better leave it', kind: 'close' }],
      }
    default: {
      const topic = getTopic(id.slice('topic:'.length) as TopicId)
      return {
        lines: [topic.look],
        choices: [
          { label: `${topic.title} →`, kind: 'link', href: topic.href },
          { label: 'Back', kind: 'close' },
        ],
      }
    }
  }
}
