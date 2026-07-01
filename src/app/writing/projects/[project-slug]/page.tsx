import { notFound } from 'next/navigation'
import Link from 'next/link'
import { getAllProjectSlugs, getProject } from '@/lib/projects'
import { getProjectArticles } from '@/lib/articles'
import { ArticleBody } from '@/components/article-body'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import type { Metadata } from 'next'

export async function generateStaticParams() {
  const slugs = await getAllProjectSlugs()
  return slugs.map((slug) => ({ 'project-slug': slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ 'project-slug': string }>
}): Promise<Metadata> {
  const { 'project-slug': projectSlug } = await params
  const project = await getProject(projectSlug)
  if (!project) return {}
  return {
    title: project.title,
    description: project.description,
    ...buildOpenGraphMetadata({
      type: 'website',
      title: project.title,
      description: project.description,
      image: project.coverImage,
      url: `/writing/projects/${projectSlug}`,
    }),
  }
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ 'project-slug': string }>
}) {
  const { 'project-slug': projectSlug } = await params
  const [project, articles] = await Promise.all([
    getProject(projectSlug),
    getProjectArticles(projectSlug),
  ])

  if (!project) notFound()

  return (
    <main className="container max-w-3xl py-12">
      <div className="mb-6">
        <Link
          href="/writing"
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Writing
        </Link>
      </div>

      <header className="mb-8">
        <p className="text-sm text-muted-foreground mb-2 uppercase tracking-widest">Project</p>
        <h1 className="text-3xl font-bold tracking-tight mb-3">{project.title}</h1>
        <p className="text-muted-foreground">{project.description}</p>
      </header>

      {(project.body as unknown[]).length > 0 && (
        <div className="mb-12 prose-sm">
          <ArticleBody document={project.body} />
        </div>
      )}

      <section>
        <h2 className="text-lg font-semibold mb-6 border-b border-border pb-3">Articles</h2>
        {articles.length === 0 ? (
          <p className="text-muted-foreground">No articles yet.</p>
        ) : (
          <ul className="space-y-8">
            {articles.map((article) => (
              <li key={article.slug}>
                <article>
                  <time className="text-sm text-muted-foreground">
                    {new Date(article.publishedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </time>
                  <h3 className="text-xl font-semibold mt-1 mb-2">
                    <Link
                      href={`/writing/projects/${projectSlug}/${article.slug}`}
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
        )}
      </section>
    </main>
  )
}
