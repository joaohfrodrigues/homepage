import type { Metadata } from 'next'
import Image from 'next/image'
import { getGearGroupedByHobby } from '@/lib/gear'
import { buildOpenGraphMetadata } from '@/lib/site-config'

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
            <div className="flex flex-col gap-8">
              {group.categories.map((category) => (
                <div key={category.category}>
                  <h3 className="text-sm font-medium uppercase tracking-wide text-muted-foreground mb-4">
                    {category.category}
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {category.items.map((item) => (
                      <div
                        key={item.slug}
                        className="flex flex-col gap-3 rounded-lg border border-border p-4"
                      >
                        <div className="relative aspect-video overflow-hidden rounded-md bg-muted">
                          {item.photo && (
                            <Image
                              src={item.photo}
                              alt={item.name}
                              fill
                              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                              className="object-cover"
                            />
                          )}
                        </div>
                        <h4 className="text-lg font-semibold tracking-tight">{item.name}</h4>
                        {item.note && (
                          <p className="text-sm text-muted-foreground">{item.note}</p>
                        )}
                        {item.link && (
                          <a
                            href={item.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm font-medium text-foreground underline underline-offset-4 hover:text-muted-foreground"
                          >
                            View product
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </main>
  )
}
