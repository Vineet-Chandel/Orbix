# SEO maintenance and external setup

## Production configuration and routing

The owner confirmed `https://theorbix.world`. `SITE_URL` is the single canonical-origin variable; only its validated public value reaches the browser. Configure the same value during the frontend build and at backend runtime. Never use a request Host header to generate canonical URLs.

| Variable | Purpose | Production / preview |
|---|---|---|
| SITE_URL | Absolute HTTPS origin without a path, query, credentials or fragment | Confirmed canonical origin; missing/invalid fails closed |
| SEO_INDEXING_ENABLED | Deliberate indexing opt-in | true only for canonical production; false for previews |
| NODE_ENV | Server/build environment | production required for indexing |
| SERVE_FRONTEND | Serve public HTML and built assets through the application Express process | true for this hosting arrangement; default false preserves API-only deployments |
| SEO_ENFORCE_CANONICAL_HOST | Redirect alternate hosts to SITE_URL | Optional; enable only when proxy forwards original Host |
| WEB_PORT | Standalone public preview process | Default 4173; preview is not the full authenticated API |

Build both artifacts with `npm run build --prefix Frontend`. Keep `Frontend/dist` and `Frontend/dist-server` beside the backend in the release. Keep existing FRONTEND_URL/OAuth callback/CORS settings aligned with the canonical site; SITE_URL configures SEO, not identity-provider registration. Production must route HTML, `/robots.txt`, `/sitemap.xml`, `/sitemaps/*` and assets to Express, with `/api/*` retaining existing API routing. **A CDN/static-host catch-all that serves index.html directly bypasses SSR, status codes and dynamic sitemaps.** If frontend/API use separate hosts, proxy these public routes to the public document server on the canonical origin. Do not send visitors to an API-only root response.

TLS termination must permanently redirect HTTP to HTTPS and forward the canonical Host. Enable gzip/Brotli for static CSS/JS/images at the edge; the public HTML handler also negotiates asynchronous gzip itself. Fingerprinted assets have immutable one-year caching. HTML and dynamic sitemaps use no-store so publication/privacy changes are not retained in shared caches. Static anonymous React body rendering is bounded and memoized in-process; it never contains request cookies/user state.

Set preview indexing false on both build/runtime environments. The server also requires the incoming Host header to match SITE_URL before emitting indexable metadata or sitemap URLs. Preserve that header through the reverse proxy. Server and browser configuration must agree; verify the rendered HTML and hydrated/taken-over DOM after deployment. Default index.html intentionally has noindex so an accidentally deployed raw SPA shell does not become an indexed copy.

## Production authentication setup

Keep `JWT_SECRET` in the hosting provider's backend secret store. Use the same value across replicas and preserve the existing secure value across releases. The backend refuses missing or weak values in production. Plan any rotation with the deployment owner. Rotation invalidates existing signed sessions and verification flows, and GitHub App credentials encrypted using the old key need a migration or reauthorization.

Configure `ORBIX_STAFF_EMAILS` only for identities explicitly approved for administrator access. Use `ORBIX_REVIEWER_EMAILS` for the club application review queue. Each setting is a comma-separated server-only list. An empty staff list grants no environment-based administrator access. Database-assigned staff roles are evaluated separately.

After deploying to the canonical host, verify personal sign-in, club sign-in, refresh and sign-out with dedicated test accounts. Check the reviewer queue with an approved reviewer and check that a reviewer-only account and an ordinary account are denied on governance routes. On mobile, verify that opening the authenticated dashboards and switching between club directory views works. Record public SEO and Lighthouse checks against the deployed release.

## Local and CI checks

Install dependencies in both Backend and Frontend. Build first, then run:

- `npm run test:seo --prefix Backend` — route coverage, metadata, canonicals, schema, robots, sitemap policies, private data, native HTTP responses, gzip and real built SSR pages.
- `npm run test:privacy --prefix Backend` — privacy/auth regression checks.
- Existing frontend/backend test commands.
- `npm run lint --prefix Frontend` and frontend/backend TypeScript checks. Do not silently ignore existing lint/type debt.
- `.github/workflows/seo.yml` validates SEO on pull requests/pushes without external paid tools or deployment. CI previews intentionally use indexing disabled. Configure repository variable SITE_URL with the approved origin; it is not a secret.

When adding a route, update the application route inventory (`shared/seo/appRoutes.ts`), review its indexing policy, register approved public metadata in `shared/seo/routes.ts`, and add the actual public component to the server entry. Tests fail if the router inventory drifts or any approved public page cannot render. New private routes must remain noindex and retain real authorization. Do not add personal profiles or private club records to public selectors.

Dynamic sitemap eligibility and HTML/API visibility share the SQL predicates in `Backend/src/seo/publicRepository.ts`. A club must be active, published, explicitly public and publicly visible. Events additionally must be published, national and open to all. Personal profiles, records, drafts, deleted content and unlisted/private clubs are excluded. Sitemaps split at 1,000 URLs and carry only real database update timestamps; static month labels do not become invented lastmod dates. On DB outage dynamic documents/sitemap requests return 503 with no sensitive exception details.

## Search Console / analytics setup

### Google Search Console

Open https://search.google.com/search-console and add a Domain property for the confirmed production host. The domain owner must authorize the DNS TXT record Google supplies. Do not invent a token. After DNS verification, submit `/sitemap.xml`; inspect both public static and public dynamic URLs with URL Inspection. Check received HTML, selected canonical, indexing exclusions and the noindex response of representative private routes. Search Console reports real queries, clicks, impressions and indexing decisions; code changes do not guarantee indexing.

### Google Analytics 4 (optional)

Open https://analytics.google.com and create/authorize the correct property and web data stream. Obtain the genuine measurement ID from the owner. This implementation does not add a tracking script. Any later analytics work must respect consent and existing privacy policy. Allowlist public marketing/content routes and sanitize URLs; do not send emails, usernames, certificate codes, auth query tokens, application IDs or private dashboard paths as analytics parameters. Verify consent before enabling collection. Preserve an evidence log distinguishing field data from synthetic tests.

### Bing Webmaster Tools

Open https://www.bing.com/webmasters, add the site and complete the owner-provided DNS verification or authorized Search Console import. Submit the canonical sitemap index, inspect crawl/indexing issues and check that private paths remain excluded.

### IndexNow evaluation

Deferred intentionally: publication changes and privacy withdrawals occur in several services, and a reliable outbox/invalidation integration plus verified host ownership is needed before submitting URLs automatically. Sitemaps already provide discovery. A future integration should use a backend-only key, host verification file, publication-aware outbox, idempotent deduplication, bounded retries and deletion/withdrawal notifications. Never submit personal/private URLs. IndexNow is separate from Google's indexing mechanisms; do not add anonymous Google sitemap ping calls.

### Validation tools

- https://search.google.com/test/rich-results — inspect deployed supported schema and eligibility; JSON syntax tests alone are not a rich-result certification.
- https://validator.schema.org — validate Schema.org vocabulary and graph structure.
- https://pagespeed.web.dev — measure deployed lab/available field data separately. Record date, device, network and URL.
- Lighthouse in browser DevTools or an approved local CLI — capture mobile/desktop runs after deployment; never label local SSR timing as LCP, INP or CLS.

Targets are LCP <=2.5s, INP <=200ms and CLS <0.1 at the relevant field-data percentile. No field measurements or ranking improvements are inferred from the build.

## Recurring review schedule

### Weekly

- Check Search Console indexing issues.
- Review crawl and sitemap errors.
- Check website availability.
- Check broken links.
- Review newly published pages.
- Review important page metadata and representative privacy/noindex boundaries.

### Monthly

- Review organic search performance.
- Compare clicks, impressions, CTR and average position.
- Review queries and landing pages.
- Review Core Web Vitals, separating field data from lab results.
- Update outdated content.
- Audit redirects and canonical URLs.
- Review Bing Webmaster Tools.
- Review structured data errors.

### Quarterly

- Review the complete site architecture.
- Audit indexable and non-indexable routes.
- Identify content gaps.
- Review competing search topics.
- Review important backlinks and brand mentions.
- Evaluate GEO/AEO visibility using available analytics and dated, reproducible query testing; record missing citations as observations, not evidence of technical failure.
- Review technical SEO dependencies and configuration.

## Crawler policies and security

Public discovery is allowed under ordinary robots rules; APIs are disallowed while private HTML remains fetchable to process noindex. Training-only GPTBot/CCBot are explicitly disallowed. OAI-SearchBot can retrieve intended public pages. Authentication and authorization remain independent of robots/noindex. No llms.txt or ranking-guarantee file is added.

Official references:

- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- https://developers.google.com/search/docs/appearance/ai-features
- https://developers.google.com/search/docs/appearance/structured-data/sd-policies
- https://developers.google.com/search/blog/2023/08/howto-faq-changes
- https://developers.openai.com/api/docs/bots
- https://www.bing.com/indexnow/getstarted
