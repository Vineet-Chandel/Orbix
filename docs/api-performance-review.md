# Navigation and API performance review

## Scope and evidence

The Redux provider and store are already mounted once in main.tsx. Navigation was not recreating the store. Campus events, campus clubs, applications, certificates and sidebar workspaces were fetching into component-local state on mount. Event Tracker explicitly sent refresh=true on every mount, bypassing browser and server freshness checks.

The generated [route inventory](api-route-audit.md) scans all backend TypeScript modules and lists 626 literal route registrations, including inline SQL/external-fetch/await counts and direct middleware identifiers. Aliases and inherited router guards require the mount definitions in index.ts. This is a source audit, not 626 live benchmarks or a security certification. Dedicated request-path changes cover authentication, profiles, calendar aggregation, campus events and shared database access. Other endpoints have static inventory and shared timing coverage; their production latency remains to be measured.

## Implemented behavior

| Area | Change | Result and limits |
| --- | --- | --- |
| Personal navigation | RTK Query owns campus events, campus clubs, applications, certificate counts and sidebar workspace data | Same-key requests deduplicate. Data stays in Redux for five minutes after unsubscribe. Revisiting data older than one minute revalidates while retaining visible content. Explicit retry/refetch still works. |
| Identity isolation | Query keys contain user identity and campus scope; private query state resets when identity changes | No new private browser-storage persistence. Late responses after logout cannot restore the cache. Backend still enforces access independently of client keys. |
| Registration changes | Patch the cached event/application and invalidate related query tags | Registration updates refresh application data; withdrawal refreshes campus event status. |
| Dashboard and Trends | Components show initial skeletons only when no cached analytics exist | Fetching flags still track actual requests for deduplication. Previously loaded analytics stay visible during revalidation. |
| Event Tracker | Removed automatic forced refresh; five-minute client freshness window and explicit in-flight flag | Includes empty calendars. Background refresh does not replace existing content with a loader. Filtered responses do not mark the full-calendar cache fresh. |
| Public calendar server cache | Eight-minute fresh cache, up to one hour total retention, then hard expiry | An expired fresh public calendar can return immediately while providers refresh. Concurrent refreshes share work within a process. Redis shares successful entries across replicas. Keys are month-specific and memory is bounded to 24 entries. This stale policy is never used for sessions or permissions. |
| Public refresh control | Minimum 30 seconds between forced provider refreshes when cached | Prevents each public refresh parameter from launching a new external fetch. This is per process; it is not a distributed rate limiter. |
| Redis on critical auth reads | 75 ms budget per cache read, then original PostgreSQL fallback; atomic revocation/active marker lookup; UUID mapping goes directly to its index | Revocation wins over active markers. Database failure does not turn into an authorized session. Cache writes do not block public-calendar responses. |
| Profile reads | Links, institution and verification queries run concurrently after the user lookup | Removes serial database round trips without adding a private server response cache. |
| Campus event SQL | Reuse lateral registration-stage and active-stage lookups | Four registration-stage scans become one and two active-stage scans become one per event. Existing event_id/stage_order index supports the lookup. Visibility and registration eligibility behavior are preserved. Execution plans still need staging validation. |
| Database connections | Five-second acquisition timeout; 60-second idle retention; configurable DB_POOL_MAX (default 20) | Reduces frequent connection churn and bounds connection-acquisition delays. This is not a query execution deadline. Budget max connections across every replica and worker. |
| SQL retry policy | No automatic retries of arbitrary SQL by default | Avoids stacking timeouts and replaying a possibly committed write. Explicit retries remain available to callers that know an operation is safe. |
| Startup | Production does not run the large schema synchronization block by default | Avoids DDL lock contention while the web server is already accepting requests. Apply migrations/schema initialization in the release step. Development keeps its prior default unless explicitly disabled. |
| API observability | Completion logs include namespace, route template, status, elapsed time, shared-wrapper query count and database time | Slow requests (at least 1 second) and 5xx always log. API_PERFORMANCE_LOG_ALL=true records successful fast requests as well. Logs omit request URLs, query strings, bodies and identities. Direct transaction/pool queries are not counted; overlapping query durations can exceed wall time. |
| CORS | Credentialed origins restricted to FRONTEND_URL, CORS_ALLOWED_ORIGINS and the request's same origin | Adds Vary: Origin and ten-minute preflight caching. Arbitrary-origin credential reflection is removed. This does not replace authentication or CSRF protections. |

## Deployment and measurement

1. Set FRONTEND_URL to the exact deployed frontend origin. Add only intentional preview/admin frontend origins to CORS_ALLOWED_ORIGINS. Development allows localhost:5173 and 127.0.0.1:5173.
2. Set NODE_ENV=production. Run the existing db:init-schema/migration release process before serving a new schema. Leave DB_SCHEMA_SYNC_ON_STARTUP=false for web replicas. Existing schema changes from other work are not applied by this performance patch.
3. Set DB_POOL_MAX from the provider's connection limit divided across web and worker processes, with headroom. Keep Redis and PostgreSQL in the same region as the API where possible. Cache availability does not prove short network round trips.
4. Enable API_PERFORMANCE_LOG_ALL=true temporarily and collect an actual traffic window. Group api_request logs by namespace, method and route; compute p50/p95/p99 and errors. Compare first request after idle, warm request, and concurrent requests separately. Disable full logging afterwards if volume is high.
5. Exercise Dashboard → College Events → Clubs → Event Tracker → Activity → Dashboard. In browser Network tools verify that fresh queries are reused, aged entries refresh without a full-screen data loader, and explicit refresh still works. Repeat after a registration, withdrawal, logout and different-user login.
6. In staging, test Redis latency/outage, a slow external provider, database connection exhaustion, and the campus query with EXPLAIN (ANALYZE, BUFFERS) on representative data. Load-test reads with realistic authenticated identities; do not replay write endpoints merely to benchmark them.

There is no measured production before/after latency in this change. Cold API hosting, database/provider sleep, DNS/TLS setup, live external fetches on a truly cold calendar, large unpaginated lists and first-load JavaScript chunks can still add delay. Serving stale data or globally caching authenticated responses for those cases would require endpoint-specific correctness and invalidation work. Per-process refresh deduplication also does not prevent a simultaneous refresh on each web replica.

## Verification

- Final frontend production build passed, including the loading-selector and in-flight guard changes. Vite still reports existing oversized chunks.
- Backend regression suite: 38 passed, one database integration test skipped because it requires its isolated PostgreSQL fixture.
- Existing frontend navigation, roster and form tests: 43 passed.
- Dedicated performance/security regressions: 24 passed. They cover request deduplication, cache retention, identity reset, late logout responses, empty-calendar freshness, background refresh deduplication, stale expiry, Redis timeouts, CORS and request-metric isolation. Run `cd Backend && npm run test:performance`.
- Backend full type-check is blocked by existing pdf-lib module-resolution and application typing errors. Changed infrastructure files are checked for new diagnostics separately; the repository cannot currently claim a clean backend type-check.

Regenerate the inventory with `cd Backend && npm run audit:api`.
