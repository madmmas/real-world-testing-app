# SEO — Public catalog (`frontend/web`, :3000)

The public site is a Vite SPA (nginx `try_files` → `index.html`). Test crawlability, indexation, and on-page markup for **listed** books. Admin (`:3004`), auth, and seller tools must stay out of the public index. Lighthouse SEO, crawling the raw HTML, and a JS-enabled fetch (Playwright) are all in scope.

`pnpm db:setup` first. Only **listed** in-stock titles belong on Home / Search.

## Crawl and index

- **SEO-PUB-01** `GET /`, `/search`, `/books/:id` return **200** (SPA shell). Unknown paths also serve `index.html` — record that as a soft-404 risk unless the hydrated UI shows “not found”.
- **SEO-PUB-02** View-source (no JS): `<html lang="en">`, charset, viewport, `<title>Books Library</title>`. Book body is **not** in the shell (`#root` empty) — crawlers that skip JS never see title/author/price.
- **SEO-PUB-03** After hydrate, Home has one logical h1 (“Find your next book”); Search has h1 “Search”; book detail heading matches the GraphQL `title` (today that heading is `h2` — flag if there is no `h1`).
- **SEO-PUB-04** Distinct titles per route after hydrate (home vs `/search?q=` vs book). If every path keeps `Books Library`, log it as a duplicate-title finding.
- **SEO-PUB-05** No `robots.txt` / `sitemap.xml` at the origin (404 or SPA). Document; listed book URLs `/books/:id` are the would-be sitemap entries.
- **SEO-PUB-06** Admin https://localhost:3004, `/signin`, `/signup`, `/forgot`, `/reset`, `/orders`, `/settings`, `/inventory`, `/store`, `/sales` are not linked from the anonymous header. Assert they would be `noindex` if meta/robots existed.
- **SEO-PUB-07** Unlisted / sold-out books: omitted from `frontpage` and default `searchBooks`; direct `/books/:id` may still render — must not be treated as a canonical listed product.

## On-page catalog

- **SEO-PUB-08** Home “See all” → `/search?category=<slug>` (shareable query). Hydrated results match that category.
- **SEO-PUB-09** Search cards link to `/books/:id` (not JS-only click handlers). URL is reload-safe (SPA fallback).
- **SEO-PUB-10** Book page exposes title, author, store name, category, price, stock, description, ISBN when present; cover `alt` is the title (not empty).
- **SEO-PUB-11** Cover URLs are `/media/…` or a stable origin; `GET` cover returns an image (`200`, image content-type), not the SPA HTML.
- **SEO-PUB-12** No `meta name="description"`, Open Graph, canonical, or JSON-LD `Book`/`Product` in the current shell — record as gaps. If added later, OG `og:title` / `og:image` must match the listed book.

## Performance / mobile (ranking signals)

- **SEO-PUB-13** Viewport meta present; 375px home does not require horizontal page scroll (shelves may scroll inside).
- **SEO-PUB-14** HTTPS on :3000; hashed `/assets/` send long cache (`immutable`). HTML is not immutable.
- **SEO-PUB-15** Home LCP candidate is a cover or the h1; gzip/br on JS/CSS (nginx `gzip on`).
