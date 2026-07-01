import { config, collection, fields } from '@keystatic/core'

const hasGitHubCredentials = Boolean(
  process.env.KEYSTATIC_GITHUB_CLIENT_ID &&
    process.env.KEYSTATIC_GITHUB_CLIENT_SECRET &&
    process.env.KEYSTATIC_SECRET
)

// Use local file storage during development so the admin UI reads and writes
// the repo's content directly. Only switch to GitHub-backed storage in
// production builds, where editing happens through the GitHub App OAuth flow.
const useGitHubStorage =
  process.env.NODE_ENV !== 'development' && hasGitHubCredentials

export default config({
  storage: useGitHubStorage
    ? {
        kind: 'github',
        repo: {
          owner: 'joaohfrodrigues',
          name: 'photography-home',
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
        project: fields.text({
          label: 'Project',
          description: 'Slug of the project this article belongs to (leave empty for standalone)',
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

    hobbies: collection({
      label: 'Hobbies',
      slugField: 'title',
      path: 'content/hobbies/*',
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        blurb: fields.text({ label: 'Blurb', multiline: true }),
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
        route: fields.text({
          label: 'Route override',
          description:
            'Optional external/override route for hobbies that need a non-generic page (leave empty to use /hobbies/[slug])',
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
