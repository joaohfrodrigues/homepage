import type { Metadata, Viewport } from 'next'
import { Pixelify_Sans } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import { SITE_URL, SITE_NAME, DEFAULT_OG_IMAGE } from '@/lib/site-config'

const pixel = Pixelify_Sans({ subsets: ['latin'], variable: '--font-pixel' })
// Pixelify's digits are hard to read (5 passes for S), so the pixel stack
// takes 0-9 from VT323 instead. The file is subset to the ten digits, and the
// unicode-range lets every other character fall through to Pixelify. No
// fallback face: one without the range would claim all the other characters.
const pixelDigits = localFont({
  src: '../../public/fonts/VT323-digits.woff2',
  variable: '--font-pixel-digits',
  adjustFontFallback: false,
  declarations: [
    { prop: 'unicode-range', value: 'U+0030-0039' },
    // VT323 draws small for its em; this lines its digits up with Pixelify's.
    { prop: 'size-adjust', value: '130%' },
  ],
})

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'João Rodrigues',
    template: '%s | João Rodrigues',
  },
  description:
    'Personal site of João Rodrigues — photography, writing, film & TV, and music.',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    siteName: SITE_NAME,
    images: [DEFAULT_OG_IMAGE],
  },
  twitter: {
    card: 'summary_large_image',
    images: [DEFAULT_OG_IMAGE],
  },
}

// viewport-fit=cover lets the page opt into edge-to-edge rendering so
// env(safe-area-inset-*) resolves to real values instead of 0 — needed for
// the Keystatic safe-area padding in globals.css.
export const viewport: Viewport = {
  viewportFit: 'cover',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${pixel.variable} ${pixelDigits.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.6.0/css/all.min.css"
          crossOrigin="anonymous"
          referrerPolicy="no-referrer"
        />
      </head>
      <body className="font-sans min-h-screen flex flex-col">{children}</body>
    </html>
  )
}
