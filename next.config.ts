import type { NextConfig } from 'next'
import path from 'path'

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  outputFileTracingIncludes: {
    // /hobbies renders dynamically (it reads searchParams for the category
    // filter), so Keystatic's reader hits these content files via fs at
    // request time in the Lambda. Vercel's file tracer can't see that
    // dynamic read, so without this they're pruned from the deployment and
    // every hobby card comes back empty in production.
    '/**': ['./data/photos.db', './content/**'],
  },
  // Require better-sqlite3 at runtime (native module, not bundled) under both
  // Turbopack and webpack.
  serverExternalPackages: ['better-sqlite3'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
      },
    ],
  },
}

export default nextConfig
