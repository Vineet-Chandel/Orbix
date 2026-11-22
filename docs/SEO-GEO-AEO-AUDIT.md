# SEO / GEO / AEO audit

Audit date: 22 November 2026. Inspection completed before SEO implementation.

## Architecture

React 19.2 / React Router 7.18 / Vite 8.3 / TypeScript frontend, Express 5.2 / PostgreSQL / Redis backend. BrowserRouter uses CSR and lazy route imports. The HTML root is initially empty. No SSR/SSG/ISR, SEO package, sitemap, robots file, deployment manifest, canonical system or JSON-LD was found. Some profile components set document.title after fetching. Authentication uses protected client routes plus server middleware; client guards alone are not indexing controls.

The user confirmed https://theorbix.world as the canonical production origin. Active local configuration is localhost; repository examples also contain orbix.dev. Hosting/CDN ownership is not established by checked-in deployment configuration. No active analytics/consent integration was found; Firebase example measurement IDs are placeholders.

Public content includes static documentation (9 registries), one hardcoded AWS deployment workbook (18 lessons), marketing, club pages, event registration, public profiles and certificate verification. Database club_events/verified_clubs expose explicit publication/privacy fields. Blog aliases accept arbitrary publication slugs and fall back to the same content, creating infinite duplicate routes. Docs also accept aliases and unknown documents.

## Findings by priority

### Critical

- Empty initial HTML prevents reliable non-JavaScript discovery; SPA fallbacks return soft 404s.
- No canonical origin/robots policy; authenticated and personal-record URLs have no initial noindex.
- No publication-filtered dynamic sitemap. SEO must never use privileged manager/owner responses or index personal profile/certificate/application records.

### High

- Duplicate homepage-style titles, absent descriptions/OG/canonical/structured data.
- Arbitrary blog slugs, plural aliases, docs synonyms and legacy profile URLs multiply duplicates.
- Important links/chapters use click handlers; deferred homepage sections require viewport interaction.
- Pricing/customer pages contain template-style capability/testimonial claims requiring human verification. Exclude from indexing pending approval rather than endorse them in schema.
- No deployment wiring for frontend HTML status codes or root sitemap/robots requests.

### Medium

- Public event detail route absent (only registration utility); no discoverable public event collection pagination.
- Large Markdown/Mermaid/ELK bundles. Route lazy loading already exists; avoid removing interactive documentation.
- Images use mixed formats, some omit dimensions/loading hints. Existing fonts use display=swap; keep essential hero priority and avoid lazy loading it.
- Public user content can contain private details intentionally published in text/media; do not infer consent to search-index personal records from profile visibility.

### Low

- Inconsistent answer-first descriptions, FAQ/schema reuse, visible breadcrumbs and operations documentation.
- No automated route-policy coverage, sitemap/XML/JSON-LD/privacy or HTML-source regressions.

## Recommended architecture and implementation plan

1. Shared typed route/content/metadata policy, one environment-based HTTPS origin, default-deny indexing for unknown/private routes.
2. Build an additional Vite server-renderer for existing public React components, served to all visitors by Express (no user-agent cloaking). Preserve CSR dashboard and auth boundaries. Public metadata appears in response HTML, not only post-render DOM. CSR takeover is intentional unless a shared hydration tree can be proved safe.
3. Strict public-field projections for published public clubs and open national events. No personal-profile indexing. Build paged sitemap index from the same eligibility predicate; query live visibility before serving dynamic pages, never stale privileged caches.
4. Central client metadata transitions and JSON-LD; dynamic metadata uses a dedicated public allowlisted endpoint. New public event detail component shares its DTO between server/client.
5. Correct HTTP redirects/status, root robots/sitemap routes, explicit preview noindex, crawlable links/answer-first public content, brand social card, useful media fixes.
6. Test canonical/escaping/schema/route coverage/XML and rendered initial HTML. Run existing tests/build/lint/type checks and document real measurements and access limitations.

## Risks

- Production reverse proxy must route HTML, robots and sitemap to Express, not a generic static SPA fallback. This cannot be deployed without authorization.
- SSR can reveal browser-only imports; verify real generated renderer. No user/session state may enter shared HTML caches.
- Changing personal indexing to noindex is a deliberate privacy policy. Existing public profile URLs remain functional.
- Static prerendering would retain withdrawn dynamic data; prefer live publication checks for public entities. Sitemaps omit entries on database failure and must not fall back to privileged data.
- Existing backend type-check failures and broad lint debt predate this work; distinguish baselines from regressions.
- Domain verification, real CWV, external search tooling, claims and social-profile ownership require owner input/access.

## Complete frontend route inventory (pre-implementation)

For every route below: unique title is required; descriptions and self canonicals apply only to approved public pages. Private/utility routes receive generic non-personal titles, noindex/nofollow and no sitemap/schema. Public indexable routes receive description/canonical/WebPage/Breadcrumb schema, inclusion in sitemap, and initial server-rendered content after implementation. Dynamic organization/event schema is only emitted after live publication checks. Public personal pages remain crawlable to process noindex but are deliberately excluded from sitemap/schema. Authentication remains mandatory independently of indexing controls.

| Route | Classification | Crawl | Index/sitemap | Initial primary content before changes |
|---|---|---|---|---|
| `/` | Public indexable | Yes | Yes | CSR / interaction or API fetch |
| `/clubs` | Public indexable | Yes | Yes | CSR / interaction or API fetch |
| `/customers` | Public; content approval required | Yes | No | CSR / interaction or API fetch |
| `/pricing` | Public; content approval required | Yes | No | CSR / interaction or API fetch |
| `/privacy` | Public indexable | Yes | Yes | CSR / interaction or API fetch |
| `/privacy-policy` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/terms` | Public indexable | Yes | Yes | CSR / interaction or API fetch |
| `/terms-and-conditions` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/terms-of-service` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/events/guardian-consent` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/platform` | Public indexable | Yes | Yes | CSR / interaction or API fetch |
| `/demo` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/demo/profile` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/demo-profile` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/demo/club` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/demo-club` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/leaderboard` | Public interactive collection | Yes | Events after implementation; leaderboard noindex | CSR / interaction or API fetch |
| `/events` | Public interactive collection | Yes | Events after implementation; leaderboard noindex | CSR / interaction or API fetch |
| `/events/:eventId/register` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/card` | Public indexable | Yes | Yes | CSR / interaction or API fetch |
| `/platforms` | Public indexable | Yes | Yes | CSR / interaction or API fetch |
| `/orbit` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/events-showcase` | Public indexable | Yes | Yes | CSR / interaction or API fetch |
| `/event-calendar` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/blog/:hoster/:blogName` | Dynamic workbook/alias; validate publication | Yes | Canonical ready lessons only | CSR / interaction or API fetch |
| `/blog/:hoster/:blogName/:pageId` | Dynamic workbook/alias; validate publication | Yes | Canonical ready lessons only | CSR / interaction or API fetch |
| `/blogs` | Public indexable | Yes | Yes | CSR / interaction or API fetch |
| `/blog` | Dynamic workbook/alias; validate publication | Yes | Canonical ready lessons only | CSR / interaction or API fetch |
| `/blogs/:hoster/:blogName` | Dynamic workbook/alias; validate publication | Yes | Canonical ready lessons only | CSR / interaction or API fetch |
| `/blogs/:hoster/:blogName/:pageId` | Dynamic workbook/alias; validate publication | Yes | Canonical ready lessons only | CSR / interaction or API fetch |
| `/blog/:pageId` | Dynamic workbook/alias; validate publication | Yes | Canonical ready lessons only | CSR / interaction or API fetch |
| `/docs` | Public indexable | Yes | Yes | CSR / interaction or API fetch |
| `/docs/algorithm` | Dynamic docs/alias; validate registry | Yes | Canonical registry only | CSR / interaction or API fetch |
| `/docs/:slug` | Dynamic docs/alias; validate registry | Yes | Canonical registry only | CSR / interaction or API fetch |
| `/docs/:folderId/:docId` | Dynamic docs/alias; validate registry | Yes | Canonical registry only | CSR / interaction or API fetch |
| `/profile/u/:username` | Public personal profile/alias | Yes | No (privacy) | CSR / interaction or API fetch |
| `/profile/:username` | Public personal profile/alias | Yes | No (privacy) | CSR / interaction or API fetch |
| `/u/:username` | Public personal profile/alias | Yes | No (privacy) | CSR / interaction or API fetch |
| `/verify/certificate/:credentialCode` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/verify-cert/:credentialCode` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/verify/:credentialCode` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/verify` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/auth/signup` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/auth/signin` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/auth/forgot-password` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/forgot-password` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/auth/callback` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/login` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/workspace` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/student/activity` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/events/tracker` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/workspace-invite` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/club/team-workspace/join` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/join-club` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/club/join` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/status` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/clubs/status` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/dashboard` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/team` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/team-workspace` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/recruitment` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/events` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/events/:eventId` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/events/:eventId/checkin` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/analytics` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/trends` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/certificates` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/feedback-surveys` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/announcements` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/credibility` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/profile` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/manage-profile` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/clubs` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/campus-clubs` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/other-clubs` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/settings` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club/inbox` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/announcements/:announcementId` | Potential restricted club announcement | Yes (noindex) | No (conservative) | CSR / interaction or API fetch |
| `/clubs/:slug` | Dynamic organization; public publication required | Yes | Eligible records only | CSR / interaction or API fetch |
| `/staff/club-reviews` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/onboarding` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/auth/profiles` | Utility/auth/callback/record/demo | Yes (noindex) | No | CSR / interaction or API fetch |
| `/profile/setup` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/club-announcements` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/dashboard` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/college-clubs` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/campus-clubs` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/college-events` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/college-events/:eventId` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/college-events/:eventId/:slug` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/activity` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/applications` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/explore` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/trends` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/reports` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/notifications` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/inbox` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/profile` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/settings` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/resume` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/projects` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/wallet` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/certificates` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/workspace` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/workspace/:clubId` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `/workspace/:clubId/:section` | Authenticated/internal/admin or redirect | Yes (noindex); API disallowed | No | CSR / interaction or API fetch |
| `*` | Error/fallback | Yes | No; HTTP 404 | CSR / interaction or API fetch |

Total: 108 declared frontend path patterns. Detailed implemented counts and validation are recorded in SEO-IMPLEMENTATION.md.

## API and system route policy

The executed AST audit lists 632 literal backend HTTP route registrations in `docs/api-route-audit.md` (router-relative; mounts/aliases are defined in Backend/src/index.ts; array-based paths and inherited guards require tracing). Every `/api/*` route receives `X-Robots-Tag: noindex,nofollow` and is disallowed in robots.txt. Health/API/webhook/callback resources require no SEO description, canonical, structured data or sitemap entry; authentication remains independent. The anonymous SEO DTO endpoint exposes only publication-filtered fields and is also noindex. Authenticated dynamic HTML requests use the existing authorized client flow rather than anonymous SSR.

## Implemented route policy matrix

Generated by `npm run audit:seo --prefix Backend`. This covers every declared path pattern, including aliases. Database-dependent inclusion remains conditional; no private data is fetched to build this report.

| Route | Index / sitemap | Title / description | Canonical | Schema | Initial content |
|---|---|---|---|---|---|
| `/` | Yes | Registry title; Registry/public record | Absolute self URL; page query preserved for collections | WebPage/Article + site entities + breadcrumbs | Server-rendered for eligible records; initial HTML |
| `/clubs` | Yes | Registry title; Registry/public record | Absolute self URL; page query preserved for collections | WebPage/Article + site entities + breadcrumbs | Server-rendered for eligible records; initial HTML |
| `/customers` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/pricing` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/privacy` | Yes | Registry title; Registry/public record | Absolute self URL; page query preserved for collections | WebPage/Article + site entities + breadcrumbs | Server-rendered for eligible records; initial HTML |
| `/privacy-policy` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /privacy | None | SPA shell / redirect / error; never server-render private content |
| `/terms` | Yes | Registry title; Registry/public record | Absolute self URL; page query preserved for collections | WebPage/Article + site entities + breadcrumbs | Server-rendered for eligible records; initial HTML |
| `/terms-and-conditions` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /terms | None | SPA shell / redirect / error; never server-render private content |
| `/terms-of-service` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /terms | None | SPA shell / redirect / error; never server-render private content |
| `/events/guardian-consent` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/platform` | Yes | Registry title; Registry/public record | Absolute self URL; page query preserved for collections | WebPage/Article + site entities + breadcrumbs | Server-rendered for eligible records; initial HTML |
| `/demo` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /profile/u/Vineet-Chandel | None | SPA shell / redirect / error; never server-render private content |
| `/demo/profile` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /profile/u/Vineet-Chandel | None | SPA shell / redirect / error; never server-render private content |
| `/demo-profile` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /profile/u/Vineet-Chandel | None | SPA shell / redirect / error; never server-render private content |
| `/demo/club` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /clubs/aws-swg-psit | None | SPA shell / redirect / error; never server-render private content |
| `/demo-club` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /clubs/aws-swg-psit | None | SPA shell / redirect / error; never server-render private content |
| `/leaderboard` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/events` | Yes | Registry title; Registry/public record | Absolute self URL; page query preserved for collections | WebPage/Article + site entities + breadcrumbs | Server-rendered for eligible records; initial HTML |
| `/events/:eventId` | Only live published/public records | Entity title; Registry/public record | Absolute self URL; page query preserved for collections | Event + WebPage + BreadcrumbList | Server-rendered for eligible records; initial HTML |
| `/about` | Yes | Registry title; Registry/public record | Absolute self URL; page query preserved for collections | WebPage/Article + site entities + breadcrumbs | Server-rendered for eligible records; initial HTML |
| `/events/:eventId/register` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/card` | Yes | Registry title; Registry/public record | Absolute self URL; page query preserved for collections | WebPage/Article + site entities + breadcrumbs | Server-rendered for eligible records; initial HTML |
| `/platforms` | Yes | Registry title; Registry/public record | Absolute self URL; page query preserved for collections | WebPage/Article + site entities + breadcrumbs | Server-rendered for eligible records; initial HTML |
| `/orbit` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /platforms | None | SPA shell / redirect / error; never server-render private content |
| `/events-showcase` | Yes | Registry title; Registry/public record | Absolute self URL; page query preserved for collections | WebPage/Article + site entities + breadcrumbs | Server-rendered for eligible records; initial HTML |
| `/event-calendar` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /events-showcase | None | SPA shell / redirect / error; never server-render private content |
| `/blog/:hoster/:blogName` | Yes | Registry title; Registry/public record | Absolute self URL; page query preserved for collections | WebPage/Article + site entities + breadcrumbs | Server-rendered for eligible records; initial HTML |
| `/blog/:hoster/:blogName/:pageId` | Yes | Registry title; Registry/public record | Absolute self URL; page query preserved for collections | WebPage/Article + site entities + breadcrumbs | Server-rendered for eligible records; initial HTML |
| `/blogs` | Yes | Registry title; Registry/public record | Absolute self URL; page query preserved for collections | WebPage/Article + site entities + breadcrumbs | Server-rendered for eligible records; initial HTML |
| `/blog` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /blogs | None | SPA shell / redirect / error; never server-render private content |
| `/blogs/:hoster/:blogName` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /blog/aws-sbg-psit/aws-launchpad-2026 | None | SPA shell / redirect / error; never server-render private content |
| `/blogs/:hoster/:blogName/:pageId` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /blog/aws-sbg-psit/aws-launchpad-2026/intro-deployment | None | SPA shell / redirect / error; never server-render private content |
| `/blog/:pageId` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /blog/aws-sbg-psit/aws-launchpad-2026/intro-deployment | None | SPA shell / redirect / error; never server-render private content |
| `/docs` | Yes | Registry title; Registry/public record | Absolute self URL; page query preserved for collections | WebPage/Article + site entities + breadcrumbs | Server-rendered for eligible records; initial HTML |
| `/docs/algorithm` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /docs/orbix-score-algorithm | None | SPA shell / redirect / error; never server-render private content |
| `/docs/:slug` | Yes | Registry title; Registry/public record | Absolute self URL; page query preserved for collections | WebPage/Article + site entities + breadcrumbs | Server-rendered for eligible records; initial HTML |
| `/docs/:folderId/:docId` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /docs/orbix-score-algorithm | None | SPA shell / redirect / error; never server-render private content |
| `/profile/u/:username` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/profile/:username` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /profile/u/example-user | None | SPA shell / redirect / error; never server-render private content |
| `/u/:username` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /profile/u/example-user | None | SPA shell / redirect / error; never server-render private content |
| `/verify/certificate/:credentialCode` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/verify-cert/:credentialCode` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/verify/:credentialCode` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/verify` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/auth/signup` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/auth/signin` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/auth/forgot-password` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /auth/signin?view=forgot-password | None | SPA shell / redirect / error; never server-render private content |
| `/forgot-password` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /auth/signin?view=forgot-password | None | SPA shell / redirect / error; never server-render private content |
| `/auth/callback` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/login` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /auth/signin | None | SPA shell / redirect / error; never server-render private content |
| `/workspace` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/student/activity` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/events/tracker` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/workspace-invite` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/club/team-workspace/join` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/join-club` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/club/join` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/club/status` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/clubs/status` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /club/status | None | SPA shell / redirect / error; never server-render private content |
| `/club` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /club/dashboard | None | SPA shell / redirect / error; never server-render private content |
| `/club/dashboard` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/club/team` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/club/team-workspace` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/club/recruitment` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/club/events` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/club/events/:eventId` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/club/events/:eventId/checkin` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/club/analytics` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/club/trends` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /club/analytics | None | SPA shell / redirect / error; never server-render private content |
| `/club/certificates` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/club/feedback-surveys` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/club/announcements` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/club/credibility` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /club/dashboard | None | SPA shell / redirect / error; never server-render private content |
| `/club/profile` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/club/manage-profile` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /club/profile | None | SPA shell / redirect / error; never server-render private content |
| `/club/clubs` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/club/campus-clubs` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /club/clubs | None | SPA shell / redirect / error; never server-render private content |
| `/club/other-clubs` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /club/clubs | None | SPA shell / redirect / error; never server-render private content |
| `/club/settings` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/club/inbox` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/announcements/:announcementId` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/clubs/:slug` | Only live published/public records | Entity title; Registry/public record | Absolute self URL; page query preserved for collections | Organization + WebPage + BreadcrumbList | Server-rendered for eligible records; initial HTML |
| `/staff/club-reviews` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/onboarding` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/auth/profiles` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/profile/setup` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/club-announcements` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/dashboard` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/college-clubs` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/campus-clubs` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/college-events` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/college-events/:eventId` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/college-events/:eventId/:slug` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/activity` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/applications` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/explore` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/trends` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/reports` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/notifications` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/inbox` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/profile` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/settings` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/resume` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/projects` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/wallet` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /activity?tab=certificates | None | SPA shell / redirect / error; never server-render private content |
| `/certificates` | No | Generic non-personal route title; Non-indexable utility description | Redirect to /activity?tab=certificates | None | SPA shell / redirect / error; never server-render private content |
| `/workspace` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/workspace/:clubId` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `/workspace/:clubId/:section` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |
| `*` | No | Generic non-personal route title; Non-indexable utility description | None | None | SPA shell / redirect / error; never server-render private content |

Counts: {"declaredPatterns":110,"uniquePatterns":109,"concretePublicUrls":39,"staticMarketing":12,"docs":9,"workbookLessons":18,"guardedPersonal":23,"guardedClub":23,"dynamicIndexableFamilies":["public clubs","published national open events"]}.
