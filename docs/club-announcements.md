# Orbix club announcements — implementation report

The uploaded announcement specification is implemented inside the existing Orbix application. The club sidebar's **Announcements** entry opens `/club/announcements`. Active personal-account members can also open Announcements in their team workspace or use `/club-announcements`. Shared posts use `/announcements/:announcementId` and the existing session.

## Completed behavior

- Minimal composer: a club identity, message, attachments, preview, draft/save and publish controls. No mandatory title or category. Text-only, media-only and mixed-media posts are accepted.
- TipTap structured rich text: paragraph/heading styles, bold, italic, underline, strike, inline code, approved font sizes and colors, highlighting, alignment, lists, quotes, separators, link editing/removal, undo/redo and editor keyboard shortcuts.
- Shared validation and a React renderer preserve supported formatting without rendering arbitrary HTML. Pasted HTML is sanitized. Text length, document complexity, hyperlinks and attachment counts are bounded.
- Images and galleries, a native full-screen image dialog, native video/audio controls, video posters, PDF cards and on-demand PDF previews. PDFs are not downloaded merely because a card enters the feed.
- Direct signed Cloudinary uploads with progress, cancellation, retry, re-upload and server-side asset verification. Upload failures and publication failures preserve the entered message and selected files while the composer remains open.
- Like/unlike with optimistic rollback, authoritative counts and unique database membership. Share uses the Web Share API and a copy-link fallback. There are no announcement comments, replies, discussions or comment counts.
- Campus and selected-club feeds with stable composite cursors, ten-item pages, a thirty-item maximum, duplicate suppression, cancellable requests, IntersectionObserver prefetching, loading states, explicit retries and an end-of-feed indicator.
- Active members may publish. The author and club owner/admin may manage a post while their membership remains active. Private drafts do not appear to other ordinary members. Cross-club campus visibility requires a public, published club profile at the same college. Single-post links and likes apply the same access rules.
- Soft deletion, audit entries, durable notification jobs and periodic orphan cleanup. Existing platform notifications link to the announcement and respect the existing workspace mute preference.
- The rich-text editor is a separate lazy chunk and is downloaded when the composer opens. The initial feed does not import TipTap.

## Frontend changes

| File or directory | Purpose |
| --- | --- |
| `Frontend/src/api/clubAnnouncementsApi.ts` | Existing-session API transport, direct uploads and sharing |
| `Frontend/src/api/clubAnnouncementsApi.test.ts` | API, sharing, progress and cancellation tests |
| `Frontend/src/app/Club/ClubAnnouncementsSection.tsx` | Integrated feed, composer entry point, club selection and pagination states |
| `Frontend/src/app/Club/Announcements/AnnouncementEditor.tsx` | TipTap editor and formatting controls |
| `Frontend/src/app/Club/Announcements/AnnouncementComposer.tsx` | Upload lifecycle, previews and publishing |
| `Frontend/src/app/Club/Announcements/AnnouncementRichText.tsx` | Safe structured-content rendering |
| `Frontend/src/app/Club/Announcements/AnnouncementMedia.tsx` | Galleries, full-screen images, players and deferred PDF previews |
| `Frontend/src/app/Club/Announcements/AnnouncementCard.tsx` | Post identity, expansion, likes, shares and management |
| `Frontend/src/app/Club/Announcements/useAnnouncementFeed.ts` | Cancellable cursor pagination and deduplication |
| `Frontend/src/app/Club/Announcements/AnnouncementPermalinkPage.tsx` | Session-aware single-post page |
| `Frontend/src/app/Club/Announcements/MemberAnnouncementsPage.tsx` | Personal-account member entry point |
| `Frontend/src/app/Club/Announcements/announcements.css` | Shared editor/renderer styles and responsive media dialog |
| `Frontend/src/app/Club/Announcements/announcementRendering.test.tsx` | Rich text, media, engagement UI and page-merge tests |
| `Frontend/src/app/Club/ClubDashboardPage.tsx`, `ClubSidebar.tsx` | Replaced the placeholder and connected the sidebar |
| `Frontend/src/app/Club/TeamWorkspace/WorkspaceShell.tsx` | Member workspace navigation |
| `Frontend/src/app/Notifications/NotificationsView.tsx` | Announcement notification destination |
| `Frontend/src/App.tsx` | Member and permalink routes |
| `Frontend/package.json`, `Frontend/package-lock.json` | Declared and locked TipTap packages; added the announcement test command |

## Backend and shared changes

| File or directory | Purpose |
| --- | --- |
| `Backend/src/Routes/club/clubAnnouncementRoutes.ts` | Authenticated announcement endpoints and safe errors |
| `Backend/src/Routes/club/club.ts` | Router mount |
| `Backend/src/services/announcements/announcementPolicy.ts` | IDs, bounded content, permissions, limits and composite cursors |
| `Backend/src/services/announcements/announcementRepository.ts` | Indexed SQL queries, transactions, idempotency, engagement and audit persistence |
| `Backend/src/services/announcements/announcementMediaService.ts` | Signed Cloudinary upload intents, provider verification and media delivery |
| `Backend/src/services/announcements/*.test.ts` | Policy, media, permission/rollback and optional PostgreSQL integration tests |
| `Backend/src/workers/announcementWorker.ts` | Durable notifications and retryable orphan cleanup |
| `Backend/src/index.ts` | Background worker start/stop |
| `Backend/src/services/workspace/workspaceCapabilityService.ts` | Active-member Announcements navigation capability |
| `Backend/src/database/migrations/068_club_announcements.sql` | New announcement schema |
| `Backend/src/database/run_migration.ts` | Migration signature registration |
| `Backend/src/database/schema_production_complete.sql` | Fresh-install schema support |
| `Backend/package.json` | Added announcement tests to the existing test command |
| `shared/announcements.ts`, `shared/package.json` | Shared content/media types, validation and supported editor schema |

## Database

Migration `068_club_announcements.sql` adds:

- `club_announcements`: structured content, normalized text, author, club, publication/deletion state and timestamps. `(author_id, client_request_id)` prevents duplicate publication across retries.
- `club_announcement_assets`: scoped upload intents and verified Cloudinary metadata; ordered attachments point to their announcement.
- `club_announcement_likes`: composite primary key `(announcement_id, user_id)`. Counts are calculated from this authoritative relation, so there is no denormalized counter to reconcile. Per-post row locking serializes engagement against deletion and concurrent like operations.
- `club_announcement_limits`: atomic per-user/action rate limits that work across application instances.
- `club_announcement_jobs`: durable, idempotent notification work created within the publication transaction.
- `club_announcement_audit`: creation, update and deletion records.

Indexes cover live club feeds, published feeds, parent attachment order, expired orphan uploads and pending notification jobs. Pagination compares `(created_at, id)` directly; cursor timestamps retain PostgreSQL microseconds and do not require the cursor row to remain present. User and club deletion preserve orphan cleanup records instead of losing Cloudinary references.

## APIs

Base path: `/api/club/announcements` (also mounted by the existing `/api/clubs` alias).

| Method | Path | Behavior |
| --- | --- | --- |
| GET | `/context` | Authorized clubs and configured media limits |
| GET | `/?clubId=…&scope=mine|campus&limit=10&cursor=…` | Paginated authorized feed |
| GET | `/:id` | One authorized post |
| POST | `/` | Idempotent creation using `clientRequestId` |
| PATCH | `/:id` | Authorized content, media and status changes |
| DELETE | `/:id` | Soft deletion |
| POST | `/uploads/signature` | Authenticated scoped upload intent and signature |
| POST | `/uploads/:id/complete` | Verify provider metadata and register the uploaded asset |
| DELETE | `/uploads/:id` | Cancel/discard an unattached upload |
| PUT | `/:id/like` | Ensure a like exists |
| DELETE | `/:id/like` | Ensure a like does not exist |

No comment routes or comment tables were added.

## Cloudinary and configuration

The existing Cloudinary configuration is reused. The database stores identifiers and metadata, not file contents. Upload IDs use `clubs/{clubId}/announcements/{uploadId}/…`, authenticated delivery, signed ownership context and `overwrite=false`. The backend reads actual provider metadata rather than accepting a browser-supplied URL. It checks identity, resource type, delivery type, format and byte size; video dimensions and PDF magic bytes are also checked.

Images have a 1600px ingestion bound, automatic quality, and signed responsive CDN variants at 480/960/1600px with automatic format selection. Video delivery uses signed optimized MP4 variants and generated posters. Audio and document delivery preserve their playable/document formats. Original download links expire after fifteen minutes; the card provides a refresh action. Signed CDN variants are bearer links supplied only after an announcement access check.

Uploads must be verified within fifteen minutes. Verified, unattached uploads have a seventy-minute retention window. Orphan cleanup waits beyond Cloudinary's one-hour upload-signature window, retries failures and checks all three resource types because Cloudinary excludes `resource_type` from upload signatures. Publishing associates assets transactionally; a failed publication leaves verified uploads available for retry within their retention window. Deleted posts stop resolving through the API immediately, and detached media is cleaned up after the grace period.

| Environment variable | Requirement |
| --- | --- |
| `CLOUDINARY_CLOUD_NAME` | Existing required media configuration |
| `CLOUDINARY_API_KEY` | Existing required media configuration; public upload API key |
| `CLOUDINARY_API_SECRET` | Existing required server-only secret |
| `ANNOUNCEMENT_IMAGE_MAX_BYTES` | Optional lower limit; default/cap 10 MiB |
| `ANNOUNCEMENT_VIDEO_MAX_BYTES` | Optional lower limit; default/cap 100 MiB |
| `ANNOUNCEMENT_AUDIO_MAX_BYTES` | Optional lower limit; default/cap 25 MiB |
| `ANNOUNCEMENT_PDF_MAX_BYTES` | Optional lower limit; default/cap 20 MiB |
| `ANNOUNCEMENTS_TEST_DATABASE_URL` | Optional isolated local PostgreSQL integration-test database |

Existing database/authentication configuration and the standardized API client’s optional `VITE_API_BASE_URL` remain in use. No additional broker or Redis deployment is required. Ensure the Cloudinary product environment permits authenticated image/video/raw uploads and PDF delivery, and permits the signed transformations used here.

Provider references: [signed uploads](https://cloudinary.com/documentation/upload_images), [authenticated delivery](https://cloudinary.com/documentation/control_access_to_media), [video optimization](https://cloudinary.com/documentation/video_optimization), [TipTap React](https://tiptap.dev/docs/editor/getting-started/install/react).

## Validation and deployment

Automated coverage includes text/media-only validation, rich-text persistence/rendering, unsafe links, file restrictions, provider ownership/format checks, signed uploads, responsive image URLs, authorization and transaction rollback, API session forwarding, upload cancellation/progress, canonical sharing, no-comment card rendering and duplicate-page suppression. Existing club/event regression tests are also run.

Validation results recorded during implementation:

| Check | Result |
| --- | --- |
| Frontend production build | Passed |
| Announcement frontend and shared-schema lint | Passed |
| Backend policy/media/repository and existing registration tests | 23 passed; optional PostgreSQL integration suite skipped |
| Frontend announcement and existing club/event regression tests | 36 passed |
| Migration 068 offline dry run | Passed discovery; existing earlier numbering warnings remain |
| Repository-wide backend type check | Existing unrelated errors remain; no announcement-specific errors reported |
| Live PostgreSQL, browser/mobile interactions and Cloudinary transfers | Not verified in this environment |

Run the focused frontend tests from `Frontend` with `npm run test:announcements`. Run backend tests from `Backend` with `npm test`. The optional PostgreSQL integration test is skipped until `ANNOUNCEMENTS_TEST_DATABASE_URL` is supplied. It only accepts localhost databases named `orbix_announcements_test` or `orbix_announcements_test_*`, creates a unique isolated schema, and drops that schema after testing. It covers concurrent repeated likes/unlikes, duplicate publication, timestamp ties, new feed insertions, deleted cursor anchors, private/draft access and soft deletion.

The migration's offline dry run passes discovery; it reports existing numbering issues in older migrations. Apply migration 068 through the project's normal migration workflow with the correct target/identity safeguards, then deploy/restart the backend and frontend. The fresh-install schema includes the same tables.

Live migration execution, browser interaction at desktop/mobile widths, actual Cloudinary transfers, and API latency/load measurements still require verification in a running environment. This execution environment denies local server sockets and PostgreSQL shared memory, so those checks cannot be represented as completed. The repository-wide backend type check also reports errors in existing unrelated modules; announcement-specific errors are checked separately.
