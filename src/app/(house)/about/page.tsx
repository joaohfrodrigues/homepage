import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import ReactMarkdown from 'react-markdown'
import { ArrowRight, FileText, Mail } from 'lucide-react'
import { PersonJsonLd } from '@/components/person-jsonld'
import { HouseOverlay } from '@/components/house/house-overlay'
import { InterviewButton } from '@/components/house/interview-card'
import { getPage } from '@/lib/pages'
import { getWork } from '@/lib/work'
import { employers } from '@/lib/work-history'
import { buildOpenGraphMetadata, GITHUB_URL, LINKEDIN_URL } from '@/lib/site-config'

export function generateMetadata(): Metadata {
  const page = getPage('about')
  if (!page) return {}
  return {
    title: 'About',
    description: page.description,
    ...buildOpenGraphMetadata({ type: 'website', title: 'João Rodrigues', description: page.description, url: '/about', ownImage: true }),
  }
}

const LINK = 'pixel-button pointer-coarse:min-h-11'

/**
 * Who João is and what he does, in one place: the work first, for anyone
 * hiring, then life outside it (content/pages/about.md). /work redirects here.
 */
export default async function AboutPage() {
  const page = getPage('about')
  const work = await getWork()
  if (!page || !work) notFound()

  return (
    <HouseOverlay eyebrow="Living room · João" title="About João">
      <PersonJsonLd work={work} />
      <p className="font-pixel text-[#8e2a20]">{work.headline}</p>
      {work.availability && (
        <p className="mt-3 inline-block border-2 border-[#2d6b4f] bg-[#e3efe6] px-3 py-1 text-sm text-[#1f4d38]">
          {work.availability}
        </p>
      )}
      <p className="mt-4 max-w-prose leading-relaxed">{work.summary}</p>

      <nav aria-label="Contact" className="mt-5 flex flex-wrap gap-3">
        <a href={LINKEDIN_URL} className={`${LINK} bg-[#8e2a20] hover:bg-[#a5372b]`} target="_blank" rel="noopener noreferrer">
          LinkedIn
        </a>
        <a href={GITHUB_URL} className={LINK} target="_blank" rel="noopener noreferrer">
          GitHub
        </a>
        {/* Both are off by default (content/work.yaml), to keep them from scrapers. */}
        {work.cvUrl && (
          <a href={work.cvUrl} className={LINK} target="_blank" rel="noopener">
            <FileText size={14} />
            CV (PDF)
          </a>
        )}
        {work.email && (
          <a href={`mailto:${work.email}`} className={LINK}>
            <Mail size={14} />
            Email
          </a>
        )}
        <InterviewButton />
      </nav>

      {work.experience.length > 0 && (
        <section className="mt-10" aria-labelledby="about-experience">
          <h2 id="about-experience" className="font-pixel mb-4 text-xl">
            Experience
          </h2>
          <ol className="space-y-6">
            {employers(work.experience).map((employer) =>
              employer.roles.length === 1 ? (
                <li key={`${employer.company}-${employer.period}`} className="border-l-4 border-[#2a2233] pl-4">
                  <p className="font-medium">
                    {employer.roles[0].role}
                    {employer.company && <span className="text-[#6d6359]"> · {employer.company}</span>}
                  </p>
                  <p className="text-sm text-[#6d6359]">{employer.period}</p>
                  {employer.roles[0].outcome && <p className="mt-1 max-w-prose text-sm leading-relaxed">{employer.roles[0].outcome}</p>}
                </li>
              ) : (
                // Several roles at one company: one stay with its own dates, so a promotion doesn't read as a new job.
                <li key={`${employer.company}-${employer.period}`} className="border-l-4 border-[#2a2233] pl-4">
                  <p className="font-medium">{employer.company}</p>
                  <p className="text-sm text-[#6d6359]">
                    {employer.period} · {employer.roles.length} roles
                  </p>
                  <ol className="mt-3 space-y-4">
                    {employer.roles.map((job) => (
                      <li key={job.role} className="border-l-2 border-[#2a2233]/30 pl-3">
                        <p className="text-sm font-medium">
                          {job.role} <span className="font-normal text-[#6d6359]">· {job.period}</span>
                        </p>
                        {job.outcome && <p className="mt-1 max-w-prose text-sm leading-relaxed">{job.outcome}</p>}
                      </li>
                    ))}
                  </ol>
                </li>
              ),
            )}
          </ol>
        </section>
      )}

      {work.projects.length > 0 && (
        <section className="mt-10" aria-labelledby="about-projects">
          <h2 id="about-projects" className="font-pixel mb-4 text-xl">
            Side projects
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
        <section className="mt-10" aria-labelledby="about-stack">
          <h2 id="about-stack" className="font-pixel mb-4 text-xl">
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

      <section className="mt-10 border-t-4 border-[#2a2233] pt-6" aria-labelledby="about-outside">
        <h2 id="about-outside" className="font-pixel mb-4 text-xl">
          Outside work
        </h2>
        <div className="prose prose-neutral max-w-none">
          <ReactMarkdown
            components={{
              // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
              img: ({ node, ...props }: any) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img {...props} alt={props.alt ?? ''} className="w-full max-w-xs" />
              ),
            }}
          >
            {page.content}
          </ReactMarkdown>
        </div>
      </section>
    </HouseOverlay>
  )
}
