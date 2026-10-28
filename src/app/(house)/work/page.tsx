import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowRight, FileText, Mail } from 'lucide-react'
import { PersonJsonLd } from '@/components/person-jsonld'
import { HouseOverlay } from '@/components/house/house-overlay'
import { Prompt, Terminal } from '@/components/house/writing-centerpieces'
import { getWork, type Work } from '@/lib/work'
import { AUTHOR_NAME, buildOpenGraphMetadata, GITHUB_URL, LINKEDIN_URL } from '@/lib/site-config'

export async function generateMetadata(): Promise<Metadata> {
  const work = await getWork()
  if (!work) return {}
  return {
    title: 'Work',
    description: work.summary,
    ...buildOpenGraphMetadata({ type: 'website', title: 'João Rodrigues · Work', description: work.summary, url: '/work', ownImage: true }),
  }
}

const LINK = 'pixel-button pointer-coarse:min-h-11'

/** The workstation's monitor: the short version, as a terminal session, before the page spells it out. */
function WorkTerminal({ work }: { work: Work }) {
  const now = work.experience.find((job) => job.current)
  const terminalLink = 'underline-offset-4 hover:text-[#f4ecd8] hover:underline'
  return (
    <Terminal>
      <Prompt host="desk" command="whoami" />
      <p className="mb-3 text-[#c9d6c3]">
        {AUTHOR_NAME}: {work.headline}
      </p>
      {now && (
        <>
          <Prompt host="desk" command="cat ~/work/now" />
          <p className="mb-3 text-[#c9d6c3]">
            {now.role} at {now.company}, since {now.period.split('–')[0].trim()}
          </p>
        </>
      )}
      {work.projects.length > 0 && (
        <>
          <Prompt host="desk" command="ls ~/projects" />
          <p className="mb-3 flex flex-wrap gap-x-5">
            {work.projects.map((project) => (
              <Link key={project.title} href={project.href} scroll={false} className={terminalLink}>
                {project.title.toLowerCase().replace(/\s+/g, '-')}/
              </Link>
            ))}
          </p>
        </>
      )}
      {work.cvUrl && (
        <>
          <Prompt host="desk" command="open cv.pdf" />
          <p className="mb-3">
            <a href={work.cvUrl} target="_blank" rel="noopener" className={terminalLink}>
              {work.cvUrl.split('/').pop()}
            </a>
          </p>
        </>
      )}
      <Prompt host="desk" />
    </Terminal>
  )
}

/** The professional version of About: the fast lane for anyone hiring. */
export default async function WorkPage() {
  const work = await getWork()
  if (!work) notFound()

  return (
    <HouseOverlay eyebrow="Study · Workstation" title="João Rodrigues">
      <PersonJsonLd work={work} />
      <WorkTerminal work={work} />
      {work.availability && (
        <p className="mt-3 inline-block border-2 border-[#2d6b4f] bg-[#e3efe6] px-3 py-1 text-sm text-[#1f4d38]">
          {work.availability}
        </p>
      )}
      <p className="mt-6 max-w-prose leading-relaxed">{work.summary}</p>

      <nav aria-label="Contact" className="mt-5 flex flex-wrap gap-3">
        {work.cvUrl && (
          <a href={work.cvUrl} className={`${LINK} bg-[#8e2a20] hover:bg-[#a5372b]`} target="_blank" rel="noopener">
            <FileText size={14} />
            CV (PDF)
          </a>
        )}
        <a href={LINKEDIN_URL} className={LINK} target="_blank" rel="noopener noreferrer">
          LinkedIn
        </a>
        <a href={GITHUB_URL} className={LINK} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        {work.email && (
          <a href={`mailto:${work.email}`} className={LINK}>
            <Mail size={14} />
            Email
          </a>
        )}
      </nav>

      {work.experience.length > 0 && (
        <section className="mt-10" aria-labelledby="work-experience">
          <h2 id="work-experience" className="font-pixel mb-4 text-xl">
            Experience
          </h2>
          <ol className="space-y-5">
            {work.experience.map((job) => (
              <li key={`${job.company}-${job.role}`} className="border-l-4 border-[#2a2233] pl-4">
                <p className="font-medium">
                  {job.role}
                  {job.company && <span className="text-[#6d6359]"> · {job.company}</span>}
                </p>
                <p className="text-sm text-[#6d6359]">{job.period}</p>
                {job.outcome && <p className="mt-1 max-w-prose text-sm leading-relaxed">{job.outcome}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      {work.projects.length > 0 && (
        <section className="mt-10" aria-labelledby="work-projects">
          <h2 id="work-projects" className="font-pixel mb-4 text-xl">
            Selected projects
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {work.projects.map((project) => (
              <li key={project.title}>
                <Link
                  href={project.href}
                  scroll={false}
                  className="group flex h-full flex-col border-2 border-[#2a2233] p-4 hover:bg-[#ebe0c8]"
                >
                  <span className="font-pixel text-base group-hover:underline underline-offset-4">{project.title}</span>
                  <span className="mt-2 flex-1 text-sm leading-relaxed text-[#4a4038]">{project.blurb}</span>
                  <span className="mt-3 inline-flex items-center gap-1 text-sm text-[#8e2a20]">
                    Read more <ArrowRight size={12} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {work.stack.length > 0 && (
        <section className="mt-10" aria-labelledby="work-stack">
          <h2 id="work-stack" className="font-pixel mb-4 text-xl">
            Stack
          </h2>
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[auto_1fr]">
            {work.stack.map(({ group, items }) => (
              <div key={group} className="contents">
                <dt className="font-pixel text-sm text-[#6d6359]">{group}</dt>
                <dd className="flex flex-wrap gap-2">
                  {items.map((item) => (
                    <span key={item} className="border-2 border-[#2a2233]/30 px-2 py-0.5 text-sm">
                      {item}
                    </span>
                  ))}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {(work.education.length > 0 || work.certifications.length > 0) && (
        <section className="mt-10 grid gap-8 sm:grid-cols-2" aria-label="Education and certifications">
          {work.education.length > 0 && (
            <div>
              <h2 className="font-pixel mb-4 text-xl">Education</h2>
              <ul className="space-y-4">
                {work.education.map((school) => (
                  <li key={school.degree}>
                    <p className="font-medium">{school.degree}</p>
                    <p className="text-sm text-[#6d6359]">
                      {school.school} · {school.period}
                    </p>
                    {school.note && <p className="mt-1 text-sm leading-relaxed">{school.note}</p>}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {work.certifications.length > 0 && (
            <div>
              <h2 className="font-pixel mb-4 text-xl">Certifications</h2>
              <ul className="list-inside list-disc space-y-1 text-sm">
                {work.certifications.map((certification) => (
                  <li key={certification}>{certification}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      <p className="mt-10 border-t-4 border-[#2a2233] pt-5 text-sm text-[#6d6359]">
        Rather see the person than the CV? <Link href="/about" scroll={false} className="underline underline-offset-4">About me</Link>, or close
        this and walk around the flat.
      </p>
    </HouseOverlay>
  )
}
