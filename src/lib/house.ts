import 'server-only'
import { getTrips, type Trip } from './photos'
import { getPage } from './pages'
import { GITHUB_URL, LINKEDIN_URL, UNSPLASH_URL } from './site-config'

export interface ContactLink {
  label: string
  href: string
}

/** Everything the house needs on the client, serialized once per layout render. */
export interface HouseData {
  trips: Trip[]
  /** First paragraph of the About page, for João's dialogue. */
  aboutIntro: string
  contactLinks: ContactLink[]
}

export function getHouseData(): HouseData {
  const about = getPage('about')
  const aboutIntro =
    about?.content
      .split(/\n\s*\n/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .find((p) => p && !p.startsWith('!') && !p.startsWith('#')) ?? ''

  return {
    trips: getTrips(),
    aboutIntro,
    contactLinks: [
      { label: 'LinkedIn', href: LINKEDIN_URL },
      { label: 'GitHub', href: GITHUB_URL },
      { label: 'Unsplash', href: UNSPLASH_URL },
    ],
  }
}
