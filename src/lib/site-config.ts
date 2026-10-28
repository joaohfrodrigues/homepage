import ogImage from '@/assets/og-image.png'

export const SITE_URL = 'https://joaohfrodrigues.com'
export const SITE_NAME = 'João Rodrigues'
export const AUTHOR_NAME = 'João Rodrigues'

export const GITHUB_URL = 'https://github.com/joaohfrodrigues'
export const UNSPLASH_URL = 'https://unsplash.com/@joaohfrodrigues'
export const LINKEDIN_URL = 'https://www.linkedin.com/in/joaohfrodrigues/'

export const SOCIAL_LINKS = [GITHUB_URL, UNSPLASH_URL, LINKEDIN_URL]

// The house snapshot from scripts/og_snapshot.mjs. Importing it fingerprints
// its URL, so link previews (WhatsApp caches hard) refetch it when it changes.
export const DEFAULT_OG_IMAGE = {
  url: ogImage.src,
  width: ogImage.width,
  height: ogImage.height,
  alt: 'The living room of João’s pixel-art house',
}

export function buildOpenGraphMetadata({
  type,
  title,
  description,
  image,
  url,
  publishedTime,
  ownImage = false,
}: {
  type: 'article' | 'website'
  title: string
  description: string
  image?: string | null
  url: string
  publishedTime?: string
  /** The route has its own opengraph-image and twitter-image files, which only apply when no images are set here. */
  ownImage?: boolean
}) {
  const images = ownImage ? {} : { images: image ? [image] : [DEFAULT_OG_IMAGE] }
  return {
    openGraph: {
      type,
      title,
      description,
      ...images,
      url,
      ...(publishedTime ? { publishedTime } : {}),
    },
    twitter: {
      card: 'summary_large_image' as const,
      title,
      description,
      ...images,
    },
  }
}
