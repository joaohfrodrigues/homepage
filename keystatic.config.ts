import { config, collection, fields, singleton } from '@keystatic/core'

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
      columns: ['status', 'order'],
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
      columns: ['publishedAt', 'project', 'draft'],
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
      columns: ['hobby', 'category', 'dateAdded'],
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

    events: collection({
      label: 'Events',
      slugField: 'name',
      path: 'content/events/*',
      columns: ['hobby', 'location', 'date'],
      schema: {
        name: fields.slug({ name: { label: 'Name' } }),
        hobby: fields.relationship({
          label: 'Hobby',
          collection: 'hobbies',
          validation: { isRequired: true },
        }),
        location: fields.text({ label: 'Location' }),
        date: fields.date({ label: 'Date' }),
        photo: fields.image({
          label: 'Photo',
          directory: 'public/images/events',
          publicPath: '/images/events/',
        }),
        note: fields.text({ label: 'Note', multiline: true }),
        link: fields.url({ label: 'Link', description: 'Optional event link' }),
      },
    }),

    watchItems: collection({
      label: 'Watch Items',
      slugField: 'title',
      path: 'content/watch-items/*',
      columns: ['type', 'year', 'rating', 'hidden'],
      schema: {
        title: fields.slug({ name: { label: 'Title' } }),
        type: fields.select({
          label: 'Type',
          options: [
            { label: 'Film', value: 'film' },
            { label: 'Series', value: 'series' },
          ],
          defaultValue: 'film',
        }),
        // Stored as a full ISO 8601 timestamp (not fields.date, which is
        // date-only) so same-day entries still sort correctly by time.
        watchedAt: fields.text({ label: 'Watched At (ISO timestamp)' }),
        year: fields.number({ label: 'Year' }),
        posterUrl: fields.text({ label: 'Poster URL' }),
        rating: fields.number({ label: 'Rating' }),
        note: fields.text({ label: 'Note', multiline: true }),
        hidden: fields.checkbox({
          label: 'Hidden',
          description: 'Hide this entry from the /hobbies feed without deleting it',
          defaultValue: false,
        }),
      },
    }),

    hobbies: collection({
      label: 'Hobbies',
      slugField: 'title',
      path: 'content/hobbies/*',
      columns: ['order', 'showOnLandingPage', 'dateAdded'],
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

  singletons: {
    // The work half of /about (experience, projects, stack), and the recruiters' tour.
    work: singleton({
      label: 'Work',
      path: 'content/work',
      schema: {
        headline: fields.text({ label: 'Headline', description: 'One line under the title, e.g. "Data Engineer · Lisbon"' }),
        summary: fields.text({ label: 'Summary', multiline: true, description: 'Two or three sentences: role, domain, strengths' }),
        availability: fields.text({
          label: 'Availability',
          description: 'Shown as a badge, e.g. "Open to senior data engineering roles". Leave empty to hide it.',
        }),
        cvUrl: fields.text({ label: 'CV link', description: 'A path under public/ (e.g. /files/cv.pdf) or a full URL. Left empty, the CV stays off the site.' }),
        email: fields.text({ label: 'Email', description: 'Empty leaves contact to LinkedIn and GitHub' }),
        experience: fields.array(
          fields.object({
            role: fields.text({ label: 'Role' }),
            company: fields.text({ label: 'Company' }),
            period: fields.text({ label: 'Period', description: 'e.g. "2022 – now"' }),
            current: fields.checkbox({ label: 'Current job', defaultValue: false }),
            outcome: fields.text({ label: 'What I did', multiline: true }),
          }),
          { label: 'Experience', itemLabel: (props) => props.fields.role.value || 'Role' }
        ),
        stack: fields.array(
          fields.object({
            group: fields.text({ label: 'Group', description: 'e.g. "Data", "Cloud"' }),
            items: fields.text({ label: 'Tools', description: 'Comma-separated' }),
          }),
          { label: 'Stack', itemLabel: (props) => props.fields.group.value || 'Group' }
        ),
        projects: fields.array(
          fields.object({
            title: fields.text({ label: 'Title' }),
            blurb: fields.text({ label: 'What’s interesting', multiline: true }),
            href: fields.text({ label: 'Link' }),
          }),
          { label: 'Selected projects', itemLabel: (props) => props.fields.title.value || 'Project' }
        ),
        education: fields.array(
          fields.object({
            degree: fields.text({ label: 'Degree' }),
            school: fields.text({ label: 'School' }),
            period: fields.text({ label: 'Period' }),
            note: fields.text({ label: 'Note', multiline: true }),
          }),
          { label: 'Education', itemLabel: (props) => props.fields.degree.value || 'Degree' }
        ),
        certifications: fields.array(fields.text({ label: 'Certification' }), {
          label: 'Certifications',
          itemLabel: (props) => props.value || 'Certification',
        }),
      },
    }),
  },
})
