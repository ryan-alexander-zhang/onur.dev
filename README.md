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
- `/cards` — Permanent-note boxes by tag, with random draws and outgoing-link exploration.
- `/cards/[noteId]` — Permanent note in Chinese or English, with related cards by link distance.
- `/journey` — Journey page.
- `/bookmarks` — All bookmarks, with content search and `#tag` filtering.
- `/bookmarks/[slug]` — Bookmark groups from an Obsidian Base catalog published to Contentful.
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

If Vercel hits GitHub API rate limits during build, set `GITHUB_TOKEN` in the project environment variables. The site
can fall back without it, but authenticated requests are more reliable for profile metadata during prerendering.

To enable page view tracking, apply the SQL in
[`supabase/migrations/20260613195000_page_views.sql`](./supabase/migrations/20260613195000_page_views.sql) to your
Supabase project. This creates the `public.pages` table, exposes read access for the browser client, registers the table
for Realtime, and installs the `increment_view_count(page_slug)` RPC used by the Next.js API route.

Tinybird analytics resources now live under [`tinybird/`](./tinybird). The runtime site still uses `flock.js`, but the
datasource, tokens, and query endpoints are defined in-repo. See
[docs/tinybird-integration.md](./docs/tinybird-integration.md).

## Permanent Notes

Cards read published `permanentNote` entries from Contentful; development also uses published entries by default.
Chinese and English content share one canonical `noteId` and URL. Configure `CONTENTFUL_ENVIRONMENT_ID` (default
`master`) and optionally `CONTENTFUL_LOCALE` (otherwise Contentful's default locale) alongside delivery credentials.
Missing credentials or an uninstalled content model produces an empty collection; service and authorization failures
surface as errors.

`/cards` opens directly into the first tag's infinite carousel. Choose a box in the left sidebar (or the mobile
selector), then use previous/next, drag, horizontal touch swipes, or scroll on the stage to browse. Side cards recenter
when clicked; Random draws uniformly from the selected box. Click the center card or its language control to flip
between Chinese and English. Its body scrolls independently, and its source button opens references.

The relationship view follows actual outgoing links from both language bodies across tags. **Level** sets the maximum
link distance; notes appear as labeled dots, deduplicated with actual directed edges. Selecting a node or a body link
returns to its card, keeping the current box if it contains the note, otherwise selecting the destination's box. Drag to
pan, scroll or pinch to zoom, **Fit** to see the whole graph, and **Focus** to center the current note. With the map
focused, arrow keys pan, `+`/`-` zoom, `F` or `0` fits, and `C` focuses. Card links retain canonical `/cards/[noteId]`
URLs; the tag/view query and browser Back preserve workspace context. Carousel movement, flips, and the map respect the
system's reduced-motion preference.

Publish permanent notes through the vault's QuickAdd commands described below. After publishing, the
`permanentNote` revalidation webhook refreshes the cards collection, every
detail/graph view, and sitemap.

## Content Publishing

Publishing scripts and their documentation are maintained directly in the `zettelkasten` Obsidian vault under
`99-Meta/Scripts/`. Use the installed QuickAdd commands to check, preview, and publish writing, pages, journal
entries, permanent notes, and bookmarks. The vault scripts run independently of this website repository.

For bookmarks, `Bookmarks Check Base`, `Bookmarks Preview Base`, and `Bookmarks Publish Base` use the `网站` view
in `Bookmarks.base`. The complete catalog is stored in one Contentful entry, `bookmarkCatalog_main`. The website
uses `bookmark_group` for groups and `tags` for tag filtering; `bookmark_kind` is no longer used.

Bookmark search filters text immediately; press **Enter** (or the arrow in the input) for AI matching.
When composing `#tag`, Enter selects the tag instead. Group and all selected tags restrict AI candidates;
editing the query or filters returns to text search. AI results are ranked by relevance and may be empty.
Timeouts and errors preserve local text search. Draft previews use text search only.

Set `JEV_KEY` in the ignored root `.env.local` for local development, or in Vercel's server environment
settings for deployment, then restart/redeploy. An exported shell variable also works if Next.js inherits it.
Never prefix this key with `NEXT_PUBLIC_`, add it to `next.config`'s `env`, or commit it. Only the server-only
search module reads it; browsers call `/api/bookmarks/search` with query/group/tags and receive ranked IDs.
The server reads the published Contentful catalog and sends only title, description, group and tags to
`https://api.typesafe.ai`; it does not accept client-supplied documents or send draft notes, covers or URLs.

Search pins `jev-1.13.0`, uses a provisional 0.7 matching threshold, batches up to 48 candidates with 4 workers,
and aborts upstream work after 8 seconds. Successful results (including empty results) are cached for 15 minutes
using the candidate content, query, filters, prompt and model versions. Limits are 10 requests per IP per minute,
30 uncached searches per minute and 3 concurrent searches **per server instance**, with a 1,000-candidate ceiling.
These in-memory limits and caches reset on restart and are not shared across serverless instances. Configure
Vercel Firewall rate limits and provider spending limits for a deployment-wide budget; hiding the key alone
does not prevent visitors from consuming search quota through the public endpoint.

The server needs outbound access to Jev. A local HTTP 451 response was observed on a direct connection;
the same request succeeded through the developer's existing proxy. A terminal's proxy configuration does
not necessarily apply to Node's `fetch`. Verify the Node/server network path when testing locally and the
deployment region when hosting; no developer-specific proxy address is embedded in the website.

Run search unit tests with `node --conditions=react-server --test tests/bookmark-semantic-search.test.mjs`
and browser checks with `npx playwright test --config tests/bookmarks-ui.config.cjs`.

This repository maintains the website's Contentful readers, rendering, cache revalidation, and website tests.
Change publishing behavior in the vault scripts; their former source files and generators remain available in Git
history. The remaining `scripts/setup-contentful-model.sh` and `scripts/generate-env-example.sh` are optional
repository setup utilities, not dependencies of the installed QuickAdd commands.

## Tech Stack

- [Next.js](https://nextjs.org)
- [Tailwind CSS](https://tailwindcss.com)
- [shadcn/ui](https://ui.shadcn.com)
- [Contentful](https://www.contentful.com)
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
