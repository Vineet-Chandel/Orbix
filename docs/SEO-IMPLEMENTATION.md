# SEO / GEO / AEO implementation

## Repository analysis

- React 19.2.8, React Router 7.18.4, Vite 8.3 and TypeScript browser frontend; Express 5.2.1, PostgreSQL, Redis and TSX backend runtime.
- Original rendering: client-only BrowserRouter with an empty HTML root, no canonical/description/robots/sitemap/JSON-LD architecture, fragmented profile title effects and numerous route aliases.
- Confirmed production origin: `https://theorbix.world`. Metadata uses the environment-based SITE_URL; no request-derived host or localhost fallback is emitted.
- Implemented inventory: **110 declared frontend path entries, 109 unique patterns** (the pre-existing `/workspace` duplicate is preserved). **46 entries are inside explicit auth route guards**: 23 personal and 23 club. Additional auth/callback/personal-record/utility routes are also noindex.
- Indexable content registry: **39 concrete URLs** (12 static/collection pages, 9 documentation pages, 18 real workbook lessons), plus **2 conditional database content families**: published public clubs and published national open events. Paginated public collections are self-canonical with a page query. Numbers do not claim a count of real published database records.
- Full route policy, including aliases, titles, descriptions, canonicals, schema, sitemap eligibility and initial-content behavior: `SEO-GEO-AEO-AUDIT.md` and `SEO-ROUTE-INVENTORY.json`.

## Implemented behavior

### Centralized metadata and policy

Shared typed modules govern site origin, approved routes, aliases, privacy defaults, descriptions, canonicals, Open Graph, Twitter cards and JSON-LD. Public docs/workbook metadata is derived from the same registries used by their visible UI. A browser route component updates managed head tags after client navigation; competing title setters were removed. Missing/invalid site configuration and previews are noindex.

Personal profiles, certificates, applications, dashboards, account settings, auth flows, invitations and announcements are deliberately excluded from sitemap/schema/indexing. Synthetic demo club aliases also remain functional but noindex; they cannot masquerade as real organizations in schema. Customer/pricing templates remain functional but noindex until the owner validates their claims. This does not replace auth: protected routes and existing server permission middleware remain active.

### Initial public HTML and HTTP behavior

Vite now builds a second, server-only renderer using existing public React components. Express serves the same public document to people and crawlers, with an anonymous request-local Redux state and the providers needed by those components. It waits for lazy public content to resolve before sending HTML, and falls back to a generic 503/noindex document on render failure. No user-agent-specific dynamic rendering or crawler-only text is used. Authenticated dynamic HTML requests deliberately retain the authorized CSR path so anonymous rendering cannot bypass moderation/member restrictions. Anonymous browsers reuse their URL-scoped public bootstrap data, avoiding dependence on robots-disallowed APIs during first render.

The browser intentionally uses existing `createRoot` CSR takeover. It does **not** claim to hydrate a different server tree. Existing dashboard, auth and navigation remain on the current client architecture. Existing contest-tracker functionality remains present; published public event content is added alongside it.

Approved static React bodies are memoized in a bounded process-local cache. Private or dynamic entity HTML is not put in that cache. Dynamic publication checks use allowlisted live queries rather than manager/owner payloads or stale public caches. Metadata/content requests are deduplicated only while in flight, without retaining withdrawn data.

Permanent aliases/trailing-slash variants use 308; unknown public pages, invalid workbook publications and unavailable records return 404; repository/render outages return 503/noindex. Optional host enforcement and documented edge HTTPS routing handle production host/protocol normalization. Private HTML uses noindex with no-store. All API responses get X-Robots-Tag noindex.

### Discovery, schema and GEO/AEO

- Runtime robots.txt advertises the absolute sitemap index, permits public assets, disallows API crawling and explicitly blocks training-only GPTBot/CCBot. Public discovery such as OAI-SearchBot remains permitted. No llms.txt is added.
- Sitemap index + 1,000-URL child maps use real publication filters and database update timestamps; static labels do not produce fake lastmod. The serializer also rejects private routes, aliases and duplicates. Failures do not fall back to private/unpublished records.
- Organization, WebSite, WebPage/CollectionPage, BreadcrumbList and relevant SoftwareApplication/Article/TechArticle/Event entities are generated centrally. Organization profiles have their own IDs. No fabricated offers, ratings, founders, social profiles, authors, testimonials or addresses are added. Event location markup uses available visible information; physical rich-result eligibility still requires owner-supplied detailed venue/address data where necessary.
- Homepage/about answer-first content explains actual developer/club workflows, ownership verification, visibility and public event discovery. Public clubs/events have crawlable paginated directories; workbook chapter links and pagination are real links; unknown documents no longer silently become duplicate pages.
- Editorial facts requiring approval are listed in `SEO-CONTENT-GAPS.md`. FAQ rich-result markup is intentionally omitted for this non-government/non-health application.

### Media and performance

- Created an actual 1200x630, approximately 32 KB PNG social card using existing Orbix colors and brand name; its dimensions are tested. Organization logo uses the existing favicon. No external image accessibility is claimed before deployment.
- Added real measured intrinsic dimensions to the existing footer image, and high fetch priority to the above-the-fold workbook banner without inventing its dimensions.
- Added meaningful primary headings to public landing/showcase routes and downgraded embedded card headings to avoid multiple primary headings on the card page.
- Preserved existing lazy route loading and below-fold image loading; large interactive Markdown/Mermaid features were not removed to manipulate a score.
- Fingerprinted assets have immutable one-year caching, static public files bounded caching, and HTML uses asynchronous gzip negotiation. HTML/sitemap responses remain no-store to protect publication withdrawals. Production edge compression for static JS/CSS remains a deployment responsibility.
- Existing large bundles remain. Local server render duration/HTML size are engineering observations, **not** LCP/INP/CLS measurements. No field Core Web Vitals or Lighthouse score is claimed.

## Files created / changed for this task

| Path | Responsibility |
|---|---|
| `shared/seo/bootstrap.ts`, `shared/seo/demoClub.ts` | URL-scoped public bootstrap handoff and synthetic demo exclusions |
| `shared/seo/site.ts` | Validated canonical origin, safe URLs/text/HTML/JSON |
| `shared/seo/routes.ts` | Approved public metadata, alias normalization, private/default-deny policy |
| `shared/seo/appRoutes.ts` | Complete frontend route inventory checked against App.tsx |
| `shared/seo/docs.ts`, `shared/seo/workbook.ts`, `shared/seo/docAliases.ts` | Shared existing public content registries and documentation aliases |
| `shared/seo/metadata.ts` | Titles, descriptions, OG/Twitter, JSON-LD and managed head HTML |
| `shared/seo/crawling.ts` | Robots, sitemap/index XML and defensive route filtering |
| `shared/seo/seo.test.ts` | Policy, canonical, graph, escaping, inventory and social asset tests |
| `Backend/src/seo/publicRepository.ts` | Explicit public SQL projections and paginated sitemap/content reads |
| `Backend/src/seo/web.ts` | Initial HTML, real HTTP statuses, root robots/sitemaps, public DTO API, assets, gzip and safe caches |
| `Backend/src/seo/server.ts` | Standalone public preview entry |
| `Backend/src/seo/web.test.ts`, `Backend/src/seo/rendered.test.ts` | Native request/response and real built renderer tests |
| `docs/api-route-audit.md` | Regenerated inventory of 632 literal backend HTTP registrations |
| `Backend/scripts/seo-route-report.ts` | Reproducible route inventory / audit matrix generation |
| `Backend/src/index.ts` | Opt-in public document hosting, API noindex header |
| `Backend/package.json` | SEO tests, audit and public preview commands |
| `Frontend/src/seo/client.ts`, `Frontend/src/seo/RouteSeo.tsx` | Safe initial public DTO reads, in-flight deduplication and client head updates |
| `Frontend/src/seo/entry-server.tsx` | Complete anonymous public React server renderer |
| `Frontend/src/seo/PublicAnswers.tsx` | Reusable answer-first content and About page |
| `Frontend/src/seo/PublicEventPage.tsx`, `Frontend/src/seo/EventsIndex.tsx` | Published event detail/directory, preserving contest tracker |
| `Frontend/src/seo/PublicClubDirectory.tsx` | Crawlable public club collection with pagination |
| `Frontend/src/seo/StandaloneShowcase.tsx` | Primary heading and introduction for standalone showcases |
| `Frontend/src/App.tsx` | Central metadata, public event details/about routes and showcase wrappers |
| `Frontend/index.html` | Safe noindex shell / managed metadata defaults |
| `Frontend/vite.config.ts`, `Frontend/package.json` | Public config injection, browser + server production build |
| `Frontend/eslint.config.js`, `.gitignore` | Exclude generated server build artifacts |
| `Frontend/public/social-card.png` | Real publicly served branded OG image |
| `Frontend/src/data/docsRegistry.ts`, `Frontend/src/LandingPages/Blog/data/navigation.js` | Compatibility re-exports of centralized content |
| `Frontend/src/LandingPages/Blog/Landing.jsx`, `Frontend/src/LandingPages/Docs/DocsViewerPage.tsx` | Reject unknown content instead of duplicate fallbacks |
| `Frontend/src/LandingPages/Blog/BlogCollectionPage.tsx` | Discoverable lesson directory and priority banner |
| `Frontend/src/LandingPages/Blog/components/layout/Sidebar.jsx`, `Frontend/src/LandingPages/Blog/components/documentation/ChapterPagination.jsx` | Crawlable chapter navigation with keyboard/modified-click support |
| `Frontend/src/LandingPages/Main-Landing-Pages/Personal-Account-Landing-Pages/Landing.tsx` | Visible answer-first public content |
| `Frontend/src/LandingPages/Main-Landing-Pages/Club-Account-Landing-Pages/Landing.tsx` | Public club directory alongside existing landing content |
| `Frontend/src/LandingPages/Main-Landing-Pages/Hero/Landing.tsx`, `Frontend/src/LandingPages/Main-Landing-Pages/Footer/Footer.tsx` | Primary headings and real image dimensions |
| `Frontend/src/app/Profile/CardStudio/InstagramStoryCard.tsx`, `Frontend/src/app/Profile/CardStudio/LinkedInCard.tsx` | Embedded heading hierarchy |
| `Frontend/src/app/Profile/PublicProfilePage.tsx`, `Frontend/src/app/Club/PublicClubProfilePage.tsx`, `Frontend/src/pages/NotFoundPage.tsx` | Remove conflicting document-title effects |
| `Backend/.env.example`, `Frontend/.env.example` | Confirmed public origin and safe environment switches |
| `.github/workflows/seo.yml` | PR/push build, focused lint and SEO regressions; not executed on GitHub in this session |
| `docs/SEO-GEO-AEO-AUDIT.md`, `docs/SEO-ROUTE-INVENTORY.json`, `docs/SEO-MAINTENANCE.md`, `docs/SEO-CONTENT-GAPS.md`, `docs/SEO-IMPLEMENTATION.md` | Audit, inventory, operations, owner input and this final implementation report |

Earlier uncommitted privacy fixes and the user's loader SVG work were preserved. They are not attributed to this SEO task.

## External setup and remaining actions

1. Set matching SITE_URL/indexing environment values at build/runtime; route the canonical origin through the new public HTML handler with SERVE_FRONTEND enabled. Package both build outputs and the frontend runtime dependencies needed by the renderer. Existing backend TSX runtime requirements still apply.
2. Verify HTTPS and alternate host redirects at the real proxy/CDN, and retain API authorization. Purge any old static-SPA/CDN fallbacks. A code change cannot make an unmodified static hosting configuration render server HTML.
3. Complete domain ownership verification and submit sitemap in Google Search Console and Bing Webmaster Tools. Credentials/verification tokens were not invented.
4. Have content owners approve pricing/customer claims, platform-list consistency, official contacts/socials, article dates/bylines and detailed event venues.
5. Validate deployed social URLs, Rich Results/Schema.org, browser navigation/auth, mobile layouts, and real CWV/Lighthouse. A read-only browser check reached the live homepage. It still served the previous title and had no managed SEO tags or canonical in the inspected DOM. The live robots URL displayed the application’s fallback page and the sitemap URL did not display sitemap XML. The local preview rendered the new implementation. No production Lighthouse or field score was collected.
6. Resolve existing broad backend type-check failures and full-project lint resource/debt separately. Focused SEO checks and introduced diagnostic comparisons are recorded below.

No commit, push, deployment, analytics script or external indexing submission was performed.

## Verification results

| Check | Observed result |
|---|---|
| Frontend TypeScript and production builds | Browser and server bundles built successfully. |
| SEO suite | 35 passed, including all 39 registry renders, publication withdrawal, noindex, canonical URLs, JSON-LD, XML, compression, redirects, and template content integrity. |
| Existing suites | 56 frontend and 159 backend tests passed. 10 backend database integration tests were skipped. |
| Lint | Focused SEO lint passed. The repository-wide lint process exhausted its Node heap. |
| Backend types | The repository-wide check still fails on existing diagnostics. Comparison with the earlier baseline found no new application diagnostic types. |
| Local HTTP | Documentation returned 200, an unknown document returned 404, and the social PNG returned 200 as image/png. The canonical Host returned the robots sitemap directive and an XML sitemap containing exactly 39 canonical URLs. A local preview Host returned disallow-all robots. |
| Local browser | Docs rendered with its expected title and heading. Following the scoring guide link updated the route and page title and cleared the previous page’s bootstrap data. Preview pages retained noindex. |
| Live browser | Existing production frontend remains on its prior serving path. Rollout and ownership verification are still pending. |
| Lighthouse and Core Web Vitals | Lighthouse CLI was unavailable. Mobile rendering, signed-in browser flows and field CWV remain unverified. |

A single unthrottled loopback run transferred about 7.9 KB, 15.4 KB and 8.8 KB of gzip HTML for the homepage, docs and workbook hub respectively. Local time to first byte was 1.95 s for the first request, including renderer import, then 24 ms and 12 ms for the next two distinct routes. These are local HTTP measurements. CDN behavior, client performance and Web Vitals require browser or field measurements.

The follow-up keeps legacy OAuth callbacks ahead of the HTML handler. It also preserves link access to published unlisted clubs as a noindex client page. Alternate hosts cannot return an indexable document or populated sitemap even when the production indexing flag is set. Hosting must forward the canonical Host header.


## Production readiness follow-up

Both live sign-in forms accepted submission and returned to sign-in during the browser check. No authenticated dashboard or account session was confirmed. The homepage, docs and club sign-in had no horizontal overflow at a 375 × 812 viewport. The local sign-in forms now show persistent inline errors. Verify both accounts again against the deployed release, including session refresh, sign-out and authenticated mobile layouts.

Reviewer-only environment entries no longer grant administrator access. Recognition summaries now use the authenticated account as their subject and reject requests for another member. Auth cache writes omit password hashes and remove an existing hash field on refresh. Cache reads return explicit profile fields, so legacy entries cannot return a hash. Untouched cache entries expire under the existing one-day TTL. Production signing secrets and user roles still require setup in the hosting environment described in the maintenance guide.

The production frontend build, 106 frontend tests, 141 backend suite tests, 20 privacy tests and 35 SEO tests passed. Ten migration tests were skipped because the local sandbox blocked PostgreSQL shared memory. Full frontend lint exhausted the Node heap, and focused sign-in lint still reports existing errors. The strict backend type check dropped from 280 to 147 diagnostics and still fails. The remaining diagnostics are concentrated in résumé processing, workspace repositories and leaderboards, and project routes and extraction. No production rollout or Lighthouse run was completed.
