export const SITE_URL = 'https://joaohfrodrigues.com'
export const SITE_NAME = 'João Rodrigues'
export const AUTHOR_NAME = 'João Rodrigues'

export const GITHUB_URL = 'https://github.com/joaohfrodrigues'
export const UNSPLASH_URL = 'https://unsplash.com/@joaohfrodrigues'

export const SOCIAL_LINKS = [GITHUB_URL, UNSPLASH_URL]

export const DEFAULT_OG_IMAGE = `${SITE_URL}/opengraph-image`

export function buildOpenGraphMetadata({
  type,
  title,
  description,
  image,
  url,
  publishedTime,
}: {
  type: 'article' | 'website'
  title: string
  description: string
  image?: string | null
  url: string
  publishedTime?: string
}) {
  const images = [image || DEFAULT_OG_IMAGE]
  return {
    openGraph: {
      type,
      title,
      description,
      images,
      url,
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      images,
    },
  }
}
