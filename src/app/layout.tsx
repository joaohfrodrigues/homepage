import type { Metadata } from 'next'
import { Lora } from 'next/font/google'
import localFont from 'next/font/local'
import './globals.css'
import { Header } from '@/components/header'
import { Footer } from '@/components/footer'
import { SITE_URL, SITE_NAME } from '@/lib/site-config'

const lora = Lora({ subsets: ['latin'], variable: '--font-serif' })
const lego = localFont({ src: '../../public/fonts/LEGO.ttf', variable: '--font-lego' })
const legoThick = localFont({
  src: '../../public/fonts/Legothick.ttf',
  variable: '--font-lego-thick',
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
    <html lang="en" className={`${lora.variable} ${lego.variable} ${legoThick.variable}`}>
      <body className="font-sans min-h-screen flex flex-col">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
