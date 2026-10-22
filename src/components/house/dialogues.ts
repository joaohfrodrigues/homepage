import type { DialogueId, PanelId } from '@/game/bridge'
import type { HouseData } from '@/lib/house'
import type { Weather } from '@/lib/weather'

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

export function buildDialogue(id: DialogueKey, data: HouseData, house: { night: boolean; weather: Weather }): Dialogue {
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
      return {
        lines: balconyView(house.night, house.weather),
        choices: [{ label: house.night ? 'Listen a while' : 'Back inside', kind: 'close' }],
      }
  }
}

/** The view from the balcony, by time of day and Lisbon's actual sky. */
function balconyView(night: boolean, weather: Weather): string[] {
  switch (weather) {
    case 'clear':
      return night
        ? [
            'The street lamps are on, and the river is a dark ribbon past the rooftops.',
            'Somewhere downhill, someone is singing fado.',
          ]
        : [
            'Terracotta rooftops tumble down towards the Tejo.',
            'A tram squeals round the corner below, and a neighbour’s washing flaps in the breeze.',
          ]
    case 'cloudy':
      return night
        ? [
            'No stars tonight: the clouds sit low over the rooftops, orange with the city’s light.',
            'Somewhere downhill, someone is singing fado.',
          ]
        : [
            'A grey lid of cloud sits over the city, and the Tejo has gone the colour of pewter.',
            'Across the street, a neighbour takes the washing in, just in case.',
          ]
    case 'rain':
      return night
        ? [
            'Raining in Lisbon. Again.',
            'The street lamps smear gold across the wet cobbles, and the fado downhill has moved indoors.',
          ]
        : ['Raining in Lisbon. Again.', 'The rooftops shine, and the tram below hisses through the puddles.']
    case 'storm':
      return [
        'Thunder rolls in over the Tejo, and the rain comes down sideways.',
        night
          ? 'Each flash lights up the whole city for a heartbeat.'
          : 'The tram below gives up and waits it out with its doors shut.',
      ]
  }
}
