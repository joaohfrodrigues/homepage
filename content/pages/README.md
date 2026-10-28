# Static pages

Each `.md` file here is a page read by `getPage(slug)` in `src/lib/pages.ts` and rendered with
`react-markdown`. Today that's only `about.md`, the "Outside work" part of `/about`. These files
aren't in Keystatic, so edit them directly. The work on that page comes from the Keystatic `work`
singleton instead.

Frontmatter: `title` and `description` are used; `url` is ignored.

To add a page:

1. Create `<slug>.md` with frontmatter.
2. Add `src/app/(house)/<slug>/page.tsx` calling `getPage('<slug>')` (copy the About route).
3. Add it to `src/app/sitemap.ts` and give it a place in the house.
