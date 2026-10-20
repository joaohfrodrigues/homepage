import type { DialogueId } from '@/game/bridge'
import { getTopic, type TopicId } from '@/game/topics'
import type { HouseData } from '@/lib/house'

/** Dialogue ids the game can open, plus follow-ups only reachable from a choice. */
export type DialogueKey = DialogueId | 'joao-contact'

export type DialogueChoice =
  | { label: string; kind: 'link'; href: string }
  | { label: string; kind: 'external'; href: string }
  | { label: string; kind: 'next'; id: DialogueKey }
  | { label: string; kind: 'directory' }
  | { label: string; kind: 'close' }

export interface Dialogue {
  speaker?: string
  lines: string[]
  choices: DialogueChoice[]
}

export function buildDialogue(id: DialogueKey, data: HouseData): Dialogue {
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
          'Make yourself at home. The map table in the study has every trip I’ve photographed, and most things around the house have a story.',
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
          "LinkedIn is the quickest way to reach me. Code's on GitHub, and the photos also live on Unsplash. There's a letterbox by the front door too.",
        ],
        choices: [...contactChoices, { label: 'Thanks!', kind: 'close' }],
      }
    case 'letterbox':
      return {
        lines: [
          'A red letterbox labelled “João Rodrigues”.',
          'A note is taped inside: “Best way to reach me is LinkedIn. Code lives on GitHub, photos on Unsplash.”',
        ],
        choices: [...contactChoices, { label: 'Close the flap', kind: 'close' }],
      }
    case 'front-door':
      return {
        lines: ["The front door. You've only just arrived, so have a look around first!"],
        choices: [
          { label: 'Open the directory', kind: 'directory' },
          { label: 'Stay a while', kind: 'close' },
        ],
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
