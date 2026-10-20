import { Header } from '@/components/header'
import { Footer } from '@/components/footer'

/** Pages that haven't moved into the house yet keep the classic site chrome. */
export default function ClassicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  )
}
