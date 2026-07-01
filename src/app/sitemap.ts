import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site-config'
import { getAllCollections } from '@/lib/photos'
import { getAllProjectSlugs } from '@/lib/projects'
import { getLandingHobbies } from '@/lib/hobbies'
import { reader } from '@/lib/reader'

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [collections, projectSlugs, articleEntries, landingHobbies] = await Promise.all([
    getAllCollections(),
    getAllProjectSlugs(),
    reader.collections.articles.all(),
    getLandingHobbies(),
  ])

  const publishedArticles = articleEntries.filter((e) => !e.entry.draft)

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/photography`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/writing`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/hobbies`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE_URL}/watching`, changeFrequency: 'weekly', priority: 0.5 },
    { url: `${SITE_URL}/about`, changeFrequency: 'monthly', priority: 0.5 },
  ]

  const hobbyRoutes: MetadataRoute.Sitemap = landingHobbies
    .filter((hobby) => !hobby.route)
    .map((hobby) => ({
      url: `${SITE_URL}/hobbies/${hobby.slug}`,
      changeFrequency: 'monthly',
      priority: 0.6,
    }))

  const collectionRoutes: MetadataRoute.Sitemap = collections.map((c) => ({
    url: `${SITE_URL}/photography/${c.slug}`,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  const standaloneArticleRoutes: MetadataRoute.Sitemap = publishedArticles
    .filter((e) => !e.entry.project)
    .map((e) => ({
      url: `${SITE_URL}/writing/${e.slug}`,
      changeFrequency: 'yearly',
      priority: 0.6,
    }))

  const projectRoutes: MetadataRoute.Sitemap = projectSlugs.map((slug) => ({
    url: `${SITE_URL}/writing/projects/${slug}`,
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  const projectArticleRoutes: MetadataRoute.Sitemap = publishedArticles
    .filter((e) => e.entry.project && projectSlugs.includes(e.entry.project))
    .map((e) => ({
      url: `${SITE_URL}/writing/projects/${e.entry.project}/${e.slug}`,
      changeFrequency: 'yearly',
      priority: 0.6,
    }))

  return [
    ...staticRoutes,
    ...collectionRoutes,
    ...standaloneArticleRoutes,
    ...projectRoutes,
    ...projectArticleRoutes,
    ...hobbyRoutes,
  ]
}
