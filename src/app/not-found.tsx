import Link from 'next/link'

/** Outside the house layout, so it draws its own pixel window on the night backdrop. */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#141019] p-6">
      <div className="pixel-window max-w-md p-7 text-center">
        <p className="font-pixel text-xs uppercase tracking-widest text-[#8e2a20]">404</p>
        <h1 className="font-pixel text-2xl">No room here</h1>
        <p className="mt-2 text-[#6d6359]">That door doesn&rsquo;t lead anywhere in the house.</p>
        <Link href="/" className="pixel-button mt-5">
          Back to the house
        </Link>
      </div>
    </main>
  )
}
