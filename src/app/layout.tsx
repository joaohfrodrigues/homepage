import type { Metadata } from 'next'
import './globals.css'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { SITE_URL, SITE_NAME } from '@/lib/site-config'

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
  },
  twitter: {
    card: 'summary_large_image',
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="font-sans min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
