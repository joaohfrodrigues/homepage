import { config, collection, fields } from '@keystatic/core'

// Use local file storage during development so the admin UI reads and writes
// the repo's content directly. Only switch to GitHub-backed storage in
// production builds, where editing happens through the GitHub App OAuth flow.
//
// This must branch on NODE_ENV alone (not on credential presence) because
// keystatic.config.ts is imported by a client component (src/app/keystatic).
// Non-NEXT_PUBLIC_ env vars are undefined in the browser bundle, so gating on
// them made the client and server disagree on storage kind in production.
const useGitHubStorage = process.env.NODE_ENV !== 'development'

export default config({
  storage: useGitHubStorage
    ? {
        kind: 'github',
        repo: {
          owner: 'joaohfrodrigues',
          name: 'homepage',
        },
      }
    : { kind: 'local' },

  ui: {
    brand: { name: 'joaohfrodrigues.com' },
  },

  collections: {
    projects: collection({
      label: 'Projects',
      slugField: 'title',
      path: 'content/projects/*',
      format: { contentField: 'body' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        description: fields.text({ label: 'Description', multiline: true }),
        coverImage: fields.image({
          label: 'Cover Image',
          directory: 'public/images/projects',
          publicPath: '/images/projects/',
        }),
        status: fields.select({
          label: 'Status',
          options: [
            { label: 'Active', value: 'active' },
            { label: 'Archived', value: 'archived' },
          ],
          defaultValue: 'active',
        }),
        order: fields.number({ label: 'Display Order', defaultValue: 99 }),
        body: fields.document({
          label: 'Introduction',
          formatting: true,
          dividers: true,
          links: true,
          images: {
            directory: 'public/images/projects',
            publicPath: '/images/projects/',
          },
        }),
      },
    }),

    articles: collection({
      label: 'Articles',
      slugField: 'title',
      path: 'content/articles/*',
      format: { contentField: 'body' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        publishedAt: fields.date({ label: 'Published at' }),
        description: fields.text({ label: 'Description', multiline: true }),
        project: fields.relationship({
          label: 'Project',
          collection: 'projects',
          description: 'Leave empty for a standalone article',
        }),
        draft: fields.checkbox({ label: 'Draft', defaultValue: false }),
        body: fields.document({
          label: 'Content',
          formatting: true,
          dividers: true,
          links: true,
          images: {
            directory: 'public/images/articles',
            publicPath: '/images/articles/',
          },
        }),
      },
    }),

    gear: collection({
      label: 'Gear',
      slugField: 'name',
      path: 'content/gear/*',
      schema: {
        name: fields.slug({ name: { label: 'Name' } }),
        hobby: fields.relationship({
          label: 'Hobby',
          collection: 'hobbies',
          validation: { isRequired: true },
        }),
        category: fields.text({ label: 'Category' }),
        dateAdded: fields.date({ label: 'Date added' }),
        photo: fields.image({
          label: 'Photo',
          directory: 'public/images/gear',
          publicPath: '/images/gear/',
        }),
        note: fields.text({ label: 'Note', multiline: true }),
        link: fields.url({ label: 'Link', description: 'Optional purchase/product link' }),
      },
    }),

    hobbies: collection({
      label: 'Hobbies',
      slugField: 'title',
      path: 'content/hobbies/*',
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        blurb: fields.text({ label: 'Blurb', multiline: true }),
        dateAdded: fields.date({ label: 'Date added' }),
        coverImage: fields.image({
          label: 'Cover Image',
          directory: 'public/images/hobbies',
          publicPath: '/images/hobbies/',
        }),
        order: fields.number({ label: 'Display Order', defaultValue: 99 }),
        showOnLandingPage: fields.checkbox({
          label: 'Show on landing page',
          defaultValue: true,
        }),
        tiles: fields.array(
          fields.object({
            image: fields.image({
              label: 'Image',
              directory: 'public/images/hobbies',
              publicPath: '/images/hobbies/',
            }),
            caption: fields.text({ label: 'Caption' }),
          }),
          {
            label: 'Tiles',
            itemLabel: (props) => props.fields.caption.value || 'Tile',
          }
        ),
      },
    }),
  },
})
