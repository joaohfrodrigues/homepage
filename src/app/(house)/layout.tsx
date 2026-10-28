import Link from 'next/link'
import { HouseShell } from '@/components/house/house-shell'
import { getHouseData } from '@/lib/house'

export default async function HouseLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HouseShell data={await getHouseData()}>{children}</HouseShell>
      <noscript>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#141019] p-6 text-[#f4ecd8]">
          <div className="max-w-md text-center">
            <p className="font-pixel mb-4 text-lg">The house needs JavaScript to open its doors.</p>
            <nav className="flex flex-wrap justify-center gap-4 underline underline-offset-4">
              <Link href="/photography">Photography</Link>
              <Link href="/writing">Writing</Link>
              <Link href="/hobbies">Hobbies</Link>
              <Link href="/about">About</Link>
            </nav>
          </div>
        </div>
      </noscript>
    </>
  )
}
