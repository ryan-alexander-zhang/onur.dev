# Ryan Alexander Zhang

<img src="site-preview.png" alt="Ryan Alexander Zhang personal website" style="border-radius: 12px; border: 1px solid #e5e7eb" />

<br>
<br>

This repository contains my personal website. It is built with `Next.js`, `Tailwind CSS`, `Contentful`, and a few small
integrations for bookmarks, analytics, and profile data. The home page intro and sidebar profile now read directly from
my GitHub profile and profile `README`, so updating GitHub is enough to refresh that content.

## Overview

- `/` — Home page.
- `/[slug]` — Static pre-rendered pages using [Contentful](https://www.contentful.com). (e.g. `/stack`)
- `/writing` — Writing page.
- `/writing/[slug]` — Static pre-rendered writing pages using [Contentful](https://www.contentful.com).
- `/journey` — Journey page.
- `/bookmarks` — Bookmarks page.
- `/bookmarks/[slug]` — Static pre-rendered bookmarks pages using [Raindrop](https://raindrop.io/).
- `/bookmarks.xml` — Bookmarks XML feed.
- `/api` — API routes.

## Running Locally

```bash
$ git clone <your-repository-url>
$ cd <repo-directory>
$ bun i
$ bun dev
```

Create a `.env` file based on [`.env.example`](./.env.example).

To enable page view tracking, apply the SQL in [`supabase/migrations/20260613195000_page_views.sql`](./supabase/migrations/20260613195000_page_views.sql)
to your Supabase project. This creates the `public.pages` table, exposes read access for the browser client, registers
the table for Realtime, and installs the `increment_view_count(page_slug)` RPC used by the Next.js API route.

Tinybird analytics resources now live under [`tinybird/`](./tinybird). The runtime site still uses `flock.js`, but the
datasource, tokens, and query endpoints are defined in-repo. See
[docs/tinybird-integration.md](./docs/tinybird-integration.md).

## Tech Stack

- [Next.js](https://nextjs.org)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
- [Contentful](https://www.contentful.com)
- [Raindrop](https://raindrop.io)
- [Supabase](https://supabase.com)
- [Tinybird](https://tinybird.co)
- [Vercel](https://vercel.com)

## Repo Activity

![Alt](https://repobeats.axiom.co/api/embed/2d43636ebc156829d3e99c6f8c2b68d5aa6ebf93.svg 'Repobeats analytics image')

## License

1. Feel free to take inspiration from this code.
2. Avoid directly copying it, please.
3. Crediting the author is appreciated.

No complicated licensing. Be kind and help others learn.

> You can use the same license with: https://github.com/superkhau/lice

```bash
$ npm install -g lice
$ lice -l personal_site
```
