'use client'

import Image from 'next/image'
import { DocumentRenderer } from '@keystatic/core/renderer'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ArticleBody({ document }: { document: any[] }) {
  return (
    <div className="prose prose-neutral dark:prose-invert max-w-none">
      <DocumentRenderer
        document={document}
        renderers={{
          block: {
            image: ({ src, alt, title }) => (
              <figure className="my-8">
                <Image
                  src={src}
                  alt={alt ?? ''}
                  title={title}
                  width={800}
                  height={600}
                  className="rounded-lg w-full h-auto"
                  unoptimized
                />
                {title && (
                  <figcaption className="text-center text-sm text-muted-foreground mt-2">
                    {title}
                  </figcaption>
                )}
              </figure>
            ),
            code: ({ children, language }) => (
              <pre className={`language-${language ?? 'text'} overflow-x-auto`}>
                <code className={`language-${language ?? 'text'}`}>{children}</code>
              </pre>
            ),
          },
        }}
      />
    </div>
  )
}
