import type { Metadata } from 'next'
import Image from 'next/image'
import { getGearGroupedByHobby } from '@/lib/gear'
import { buildOpenGraphMetadata } from '@/lib/site-config'
import { Tag } from '@/components/tag'

const description = 'The equipment behind João\'s hobbies, grouped by hobby and category.'

export const metadata: Metadata = {
  title: 'Gear',
  description,
  ...buildOpenGraphMetadata({
    type: 'website',
    title: 'Gear',
    description,
    url: '/gear',
  }),
}

export default async function GearPage() {
  const groups = await getGearGroupedByHobby()

  return (
    <main className="container mx-auto max-w-5xl px-4 py-16">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-bold tracking-tight mb-3">Gear</h1>
        <p className="text-muted-foreground text-lg">{description}</p>
      </header>

      <div className="flex flex-col gap-12">
        {groups.map((group) => (
          <section key={group.hobbySlug}>
            <h2 className="text-2xl font-semibold tracking-tight mb-6">{group.hobbyTitle}</h2>
            <div className="columns-1 sm:columns-2 lg:columns-3 gap-6">
              {group.categories.flatMap((category) =>
                category.items.map((item) => (
                  <div
                    key={item.slug}
                    className="mb-6 break-inside-avoid rounded-lg bg-muted/40 p-5"
                  >
                    <div className="mb-3 flex items-center gap-2">
                      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                        Gear
                      </p>
                      <Tag label={category.category} />
                    </div>
                    {item.photo && (
                      <div className="relative mb-4 aspect-[4/3] overflow-hidden rounded-md bg-muted">
                        <Image
                          src={item.photo}
                          alt={item.name}
                          fill
                          sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                          className="object-cover"
                        />
                      </div>
                    )}
                    <h3 className="text-xl font-semibold tracking-tight">{item.name}</h3>
                    {item.note && <p className="mt-2 text-sm text-muted-foreground">{item.note}</p>}
                    {item.link && (
                      <a
                        href={item.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-3 inline-block text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
                      >
                        View product
                      </a>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
