import fs from 'fs'
import path from 'path'
import { reader } from './reader'

export interface Work {
  headline: string
  summary: string
  availability: string
  cvUrl: string
  email: string
  experience: { role: string; company: string; period: string; current: boolean; outcome: string }[]
  stack: { group: string; items: string[] }[]
  projects: { title: string; blurb: string; href: string }[]
  education: { degree: string; school: string; period: string; note: string }[]
  certifications: string[]
}

/** A full URL, or a path under public/ that is really there, so the CV button never leads to a 404. */
function hasFile(url: string): boolean {
  if (!url) return false
  if (!url.startsWith('/')) return true
  return fs.existsSync(path.join(process.cwd(), 'public', url))
}

/** João's work (shown on /about), edited as the Keystatic `work` singleton (content/work.yaml). */
export async function getWork(): Promise<Work | null> {
  const work = await reader.singletons.work.read()
  if (!work) return null
  return {
    ...work,
    cvUrl: hasFile(work.cvUrl) ? work.cvUrl : '',
    experience: work.experience.filter((job) => job.role),
    stack: work.stack
      .map(({ group, items }) => ({
        group,
        items: items
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
      }))
      .filter(({ items }) => items.length > 0),
    projects: work.projects.filter((project) => project.title),
    education: work.education.filter((school) => school.degree),
    certifications: work.certifications.filter(Boolean),
  }
}
