import type { Work } from '@/lib/work'
import { AUTHOR_NAME, SITE_URL, SOCIAL_LINKS } from '@/lib/site-config'

/** schema.org Person for search engines; with the Work content it adds job title, employer and skills. */
export function PersonJsonLd({ work }: { work?: Work | null }) {
  const current = work?.experience.find((job) => job.current && job.company)
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: AUTHOR_NAME,
    url: SITE_URL,
    sameAs: SOCIAL_LINKS,
    ...(work?.headline ? { jobTitle: work.headline.split('·')[0].trim() } : {}),
    ...(current ? { worksFor: { '@type': 'Organization', name: current.company } } : {}),
    ...(work?.stack.length ? { knowsAbout: work.stack.flatMap(({ items }) => items) } : {}),
    ...(work?.education.length
      ? { alumniOf: work.education.map(({ school }) => ({ '@type': 'CollegeOrUniversity', name: school })) }
      : {}),
    address: { '@type': 'PostalAddress', addressLocality: 'Lisbon', addressCountry: 'PT' },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
