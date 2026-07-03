import Link from 'next/link'
import Image from 'next/image'
import { getStandaloneArticles } from '@/lib/articles'
import { getProjects } from '@/lib/projects'
import type { Metadata } from 'next'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { formatDate } from '@/lib/format-date'
import { EmptyState } from '@/components/ui/empty-state'
import { PageHeader } from '@/components/ui/page-header'
import { SectionTitle } from '@/components/ui/section-title'
import { PageContainer } from '@/components/ui/page-container'

const description = 'Articles on home servers, photography, and technology.'

export const metadata: Metadata = {
  title: 'Writing',
  description,
  ...buildOpenGraphMetadata({
    type: 'website',
    title: 'Writing',
    description,
    url: '/writing',
  }),
}

export default async function WritingPage() {
  const [projects, standaloneArticles] = await Promise.all([
    getProjects(),
    getStandaloneArticles(),
  ])

  return (
    <PageContainer as="main" width="narrow" className="py-12">
      <PageHeader title="Writing" description={description} className="mb-12" />

      {projects.length > 0 && (
        <section className="mb-16">
          <SectionTitle>Projects</SectionTitle>
          <ul className="space-y-6">
            {projects.map((project) => (
              <li key={project.slug}>
                <Link
                  href={`/writing/projects/${project.slug}`}
                  className="group flex gap-5 items-start"
                >
                  {project.coverImage && (
                    <div className="relative w-20 h-20 shrink-0 rounded overflow-hidden bg-muted">
                      <Image
                        src={project.coverImage}
                        alt={project.title}
                        fill
                        className="object-cover"
                        sizes="80px"
                      />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold group-hover:underline underline-offset-4">
                        {project.title}
                      </h3>
                      {project.status === 'archived' && (
                        <span className="text-xs px-2 py-0.5 rounded border border-border text-muted-foreground">
                          Archived
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {project.description}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {standaloneArticles.length > 0 && (
        <section>
          <SectionTitle>Standalone Articles</SectionTitle>
          <ul className="space-y-10">
            {standaloneArticles.map((article) => (
              <li key={article.slug}>
                <article>
                  <time className="text-sm text-muted-foreground">
                    {formatDate(article.publishedAt)}
                  </time>
                  <h3 className="text-xl font-semibold mt-1 mb-2">
                    <Link
                      href={`/writing/${article.slug}`}
                      className="hover:underline underline-offset-4"
                    >
                      {article.title}
                    </Link>
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {article.description}
                  </p>
                </article>
              </li>
            ))}
          </ul>
        </section>
      )}

      {projects.length === 0 && standaloneArticles.length === 0 && (
        <EmptyState message="No articles yet." />
      )}
    </PageContainer>
  )
}
