import type { DialogueId, PanelId } from '@/game/bridge'
import type { HouseData } from '@/lib/house'

/** Dialogue ids the game can open, plus follow-ups only reachable from a choice. */
export type DialogueKey = DialogueId | 'joao-contact' | 'caffeine-overdose' | 'beer' | 'sofa-wake'

export type DialogueChoice =
  | { label: string; kind: 'link'; href: string }
  | { label: string; kind: 'external'; href: string }
  | { label: string; kind: 'next'; id: DialogueKey }
  | { label: string; kind: 'panel'; panel: PanelId }
  | { label: string; kind: 'night'; on: boolean }
  | { label: string; kind: 'beer' }
  | { label: string; kind: 'close' }

export interface Dialogue {
  speaker?: string
  lines: string[]
  choices: DialogueChoice[]
}

export function buildDialogue(
  id: DialogueKey,
  data: HouseData,
  house: { night: boolean; buzzing?: boolean; beers?: number },
): Dialogue {
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
          ...(house.buzzing ? ['…you’re buzzing a bit. How many bicas was that?'] : []),
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
    case 'caffeine-overdose':
      return {
        speaker: 'João',
        lines: ['Whoa. You’re vibrating.', 'Sit down, have a glass of water. The machine’s closed for a bit.'],
        choices: [{ label: 'I feel GREAT', kind: 'close' }],
      }
    case 'fridge':
      return {
        lines: ['Magnets from João’s trips all over the door. Inside: leftovers, oat milk and a row of Super Bock.'],
        choices: [
          { label: 'Look at the magnets', kind: 'panel', panel: 'geoguess' },
          { label: 'Grab a Super Bock', kind: 'beer' },
          { label: 'Close the door', kind: 'close' },
        ],
      }
    case 'beer': {
      const beers = house.beers ?? 1
      if (beers >= 5) {
        return {
          lines: ['The floor tilts a little. Was it always like that?'],
          choices: [{ label: 'Totally fine', kind: 'close' }],
        }
      }
      if (beers >= 3) {
        return { speaker: 'João', lines: ['Saúde!'], choices: [{ label: 'Saúde!', kind: 'close' }] }
      }
      return { lines: ['Ice cold. Very refreshing.'], choices: [{ label: 'Ahh', kind: 'close' }] }
    }
    case 'sofa-wake':
      return {
        speaker: 'João',
        lines: [
          'Morning. You had seven.',
          'There’s a glass of water by the sofa, and I put the kettle on. Coffee’s ready when you are.',
        ],
        choices: [
          { label: 'Water first, thanks', kind: 'close' },
          { label: 'Coffee, please', kind: 'panel', panel: 'bica' },
        ],
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
    case 'zeno':
      return house.night
        ? {
            lines: ['Zeno blinks at you slowly from the dark. In cat, that’s a kiss.'],
            choices: [{ label: 'Blink back', kind: 'close' }],
          }
        : {
            lines: ['Zeno, the tuxedo cat, bumps his head into your hand.', 'Prrrrrrrr…'],
            choices: [{ label: 'Scratch behind the ears', kind: 'close' }],
          }
    case 'litterbox-dirty':
      return {
        lines: ['You scoop out Zeno’s litter box. He watches from a safe distance, faintly offended.'],
        choices: [{ label: 'All fresh again', kind: 'close' }],
      }
    case 'litterbox-clean':
      return {
        lines: ['Zeno’s litter box is spotless. For now.'],
        choices: [{ label: 'Leave it be', kind: 'close' }],
      }
    case 'balcony':
      return house.night
        ? {
            lines: [
              'The street lamps are on, and the river is a dark ribbon past the rooftops.',
              'Somewhere downhill, someone is singing fado.',
            ],
            choices: [{ label: 'Listen a while', kind: 'close' }],
          }
        : {
            lines: [
              'Terracotta rooftops tumble down towards the Tejo.',
              'A tram squeals round the corner below, and a neighbour’s washing flaps in the breeze.',
            ],
            choices: [{ label: 'Back inside', kind: 'close' }],
          }
  }
}
