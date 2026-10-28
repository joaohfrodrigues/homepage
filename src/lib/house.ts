import 'server-only'
import { getGeoPhotos, getTrips, type GeoPhoto, type Trip } from './photos'
import { isOnMap } from '@/game/map-projection'
import { GITHUB_URL, LINKEDIN_URL, UNSPLASH_URL } from './site-config'
import { getWork } from './work'
import { currentRole, describeCurrentRole } from './work-history'
import { getPublishedArticles } from './articles'
import { getHobbies } from './hobbies'
import { getProjects } from './projects'
import type { WorkstationInfo } from '@/components/house/terminal-session'
import type { InterviewInfo } from '@/components/house/interview'

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
  /** The recruiters' guided tour; null without the Work content. */
  interview: InterviewInfo | null
}

export async function getHouseData(): Promise<HouseData> {
  const [work, articles, projects, hobbies] = await Promise.all([getWork(), getPublishedArticles(), getProjects(), getHobbies()])
  const current = work && currentRole(work.experience)
  const trips = getTrips()
  const page = ({ slug, title }: { slug: string; title: string }) => ({ slug, title })
  return {
    trips,
    geoPhotos: getGeoPhotos().filter((photo) => photo.url && isOnMap(photo.lat, photo.lon)),
    contactLinks: [
      { label: 'LinkedIn', href: LINKEDIN_URL },
      { label: 'GitHub', href: GITHUB_URL },
      { label: 'Unsplash', href: UNSPLASH_URL },
    ],
    workstation: work && {
      headline: work.headline,
      now: current ? describeCurrentRole(current) : null,
      // "This site" lists as this-site/, like a folder.
      projects: work.projects.map(({ title, href }) => ({ name: title.toLowerCase().replace(/\s+/g, '-'), href })),
      cvUrl: work.cvUrl,
      writing: {
        projects: projects.map((project) => ({
          ...page(project),
          articles: articles.filter((article) => article.project === project.slug).map(page),
        })),
        articles: articles.filter((article) => !article.project).map(page),
      },
      trips: trips.map(page),
      hobbies: hobbies.map(page),
    },
    interview: work && { headline: work.headline, current, stack: work.stack, projects: work.projects },
  }
}
