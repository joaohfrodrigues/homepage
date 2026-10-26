import type { Metadata } from 'next'
import { LowPolyRoom } from '@/components/house3d/low-poly-room'

export const metadata: Metadata = {
  title: 'Low-poly living room (proof of concept)',
  robots: { index: false, follow: false },
}

/** A proof of concept for rebuilding the house in low-poly 3D; not linked from the site. */
export default function House3dPage() {
  return <LowPolyRoom />
}
