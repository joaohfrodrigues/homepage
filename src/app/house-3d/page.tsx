import type { Metadata } from 'next'
import { LowPolyHouse } from '@/components/house3d/low-poly-house'

export const metadata: Metadata = {
  title: 'Low-poly house (work in progress)',
  robots: { index: false, follow: false },
}

/** The house being rebuilt in low-poly 3D; not linked from the site until it replaces the pixel one. */
export default function House3dPage() {
  return <LowPolyHouse />
}
