import 'server-only'
import { getGeoPhotos, getTrips, type GeoPhoto, type Trip } from './photos'
import { isOnMap } from '@/game/map-projection'
import { GITHUB_URL, LINKEDIN_URL, UNSPLASH_URL } from './site-config'
import { getWork } from './work'
import type { WorkstationInfo } from '@/components/house/terminal-session'

export interface ContactLink {
  label: string
  href: string
}

/** Everything the house needs on the client, serialized once per layout render. */
export interface HouseData {
  trips: Trip[]
  /** Photo pool for the fridge's "Where was this taken?" game. */
  geoPhotos: GeoPhoto[]
  contactLinks: ContactLink[]
  /** The study workstation's terminal; null without the Work content. */
  workstation: WorkstationInfo | null
}

export async function getHouseData(): Promise<HouseData> {
  const work = await getWork()
  const now = work?.experience.find((job) => job.current)
  return {
    trips: getTrips(),
    geoPhotos: getGeoPhotos().filter((photo) => photo.url && isOnMap(photo.lat, photo.lon)),
    contactLinks: [
      { label: 'LinkedIn', href: LINKEDIN_URL },
      { label: 'GitHub', href: GITHUB_URL },
      { label: 'Unsplash', href: UNSPLASH_URL },
    ],
    workstation: work && {
      headline: work.headline,
      now: now ? `${now.role} at ${now.company}, since ${now.period.split('–')[0].trim()}` : null,
      // "This site" lists as this-site/, like a folder.
      projects: work.projects.map(({ title, href }) => ({ name: title.toLowerCase().replace(/\s+/g, '-'), href })),
      cvUrl: work.cvUrl,
    },
  }
}
