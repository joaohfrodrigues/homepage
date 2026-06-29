import { config, collection, singleton, fields } from '@keystatic/core'

const hasGitHubCredentials = Boolean(
  process.env.KEYSTATIC_GITHUB_CLIENT_ID &&
    process.env.KEYSTATIC_GITHUB_CLIENT_SECRET &&
    process.env.KEYSTATIC_SECRET
)

export default config({
  storage: hasGitHubCredentials
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
    articles: collection({
      label: 'Articles',
      slugField: 'title',
      path: 'content/articles/*',
      format: { contentField: 'body' },
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        publishedAt: fields.date({ label: 'Published at' }),
        description: fields.text({ label: 'Description', multiline: true }),
        tags: fields.array(fields.text({ label: 'Tag' }), {
          label: 'Tags',
          itemLabel: (props) => props.value,
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

    gigs: collection({
      label: 'Gigs',
      slugField: 'title',
      path: 'content/gigs/*',
      schema: {
        title: fields.slug({ name: { label: 'Title (used as slug)' } }),
        date: fields.date({ label: 'Date' }),
        venue: fields.text({ label: 'Venue' }),
        city: fields.text({ label: 'City' }),
        country: fields.text({ label: 'Country' }),
        description: fields.text({ label: 'Description', multiline: true }),
        setlist: fields.array(
          fields.object({
            title: fields.text({ label: 'Song Title' }),
            artist: fields.text({ label: 'Original Artist (leave blank for originals)' }),
          }),
          {
            label: 'Setlist',
            itemLabel: (props) => props.fields.title.value || 'Untitled',
          }
        ),
      },
    }),
  },

  singletons: {
    band: singleton({
      label: 'Band',
      path: 'content/band',
      schema: {
        name: fields.text({ label: 'Band Name' }),
        description: fields.text({ label: 'Description', multiline: true }),
        formedYear: fields.number({ label: 'Formed Year' }),
        members: fields.array(
          fields.object({
            name: fields.text({ label: 'Name' }),
            instrument: fields.text({ label: 'Instrument' }),
          }),
          {
            label: 'Members',
            itemLabel: (props) => props.fields.name.value || 'Member',
          }
        ),
      },
    }),
  },
})
