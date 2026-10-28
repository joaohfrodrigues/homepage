# Static Content Pages

This directory contains markdown files for static pages that don't require dynamic data. Today
that's `about.md`, shown at `/about`. The Work page (`/work`) is not one of these: it is structured
content edited as the Keystatic `work` singleton in `content/work.yaml`.

## Structure

- Each `.md` file is one page, read by `getPage(slug)` in `src/lib/pages.ts`
- Files use YAML frontmatter for metadata: `title` and `description` are read; `url` is kept for
    reference but unused
- Content is written in markdown and rendered with `react-markdown`
- These files are not a Keystatic collection, so edit them directly rather than through the CMS

## Example

```markdown
---
title: 'Page Title'
description: 'Page description for SEO'
url: 'https://joaohfrodrigues.com/page-name'
---

## Section Title

Your content here...
```

## Adding New Pages

1. Create a new `.md` file in this directory
2. Add frontmatter with metadata
3. Write content in markdown
4. Add a route at `src/app/(house)/<slug>/page.tsx` that calls `getPage('<slug>')` (copy
    `src/app/(house)/about/page.tsx`) so the page opens inside the house
5. Add it to `src/app/sitemap.ts` and give it somewhere in the house to be reached from

## Editing Existing Pages

Simply edit the markdown file - no code changes needed!
