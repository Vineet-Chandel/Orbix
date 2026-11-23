# API route audit inventory

632 literal route registrations scanned from every Backend/src TypeScript module.

Paths are relative to each router mount; aliases are registered in Backend/src/index.ts. Counts cover inline handlers only; imported service calls require tracing. Middleware lists show direct identifiers, not inherited guards. This is a static inventory, not measured latency or proof of authorization.

Every mounted API request now has completion timing. Enable API_PERFORMANCE_LOG_ALL=true for a representative window to compute p50/p95/p99 by namespace, method, and route template. No request body, query string, token, email or user ID is logged. Query timing covers the shared query() wrapper, including pool acquisition, and can overlap when queries run in parallel. Direct pool.query()/transaction clients are not counted.

| Method | Router | Relative path | Source | Direct middleware | Inline awaits / SQL / fetch |
| --- | --- | --- | --- | --- | --- |
| POST | app | /api/verification/college/webhook/sheerid | Backend/src/index.ts:61 | sheerIdWebhook | 0 / 0 / 0 |
| GET | apiRouter | /health | Backend/src/index.ts:80 | — | 0 / 0 / 0 |
| GET | apiRouter | / | Backend/src/index.ts:89 | — | 0 / 0 / 0 |
| GET | app | /health | Backend/src/index.ts:179 | — | 0 / 0 / 0 |
| GET | app | / | Backend/src/index.ts:197 | — | 0 / 0 / 0 |
| GET | accountGovernanceRouter | /status | Backend/src/Routes/account/accountGovernanceRoutes.ts:21 | authenticate | 1 / 0 / 0 |
| GET | accountGovernanceRouter | /timeline | Backend/src/Routes/account/accountGovernanceRoutes.ts:46 | authenticate | 1 / 0 / 0 |
| GET | accountGovernanceRouter | /admin/search | Backend/src/Routes/account/accountGovernanceRoutes.ts:74 | authenticate, requireGovernanceAdmin | 1 / 0 / 0 |
| GET | accountGovernanceRouter | /admin/user/:userId | Backend/src/Routes/account/accountGovernanceRoutes.ts:99 | authenticate, requireGovernanceAdmin | 1 / 0 / 0 |
| POST | accountGovernanceRouter | /admin/standing | Backend/src/Routes/account/accountGovernanceRoutes.ts:118 | authenticate, requireGovernanceAdmin | 1 / 0 / 0 |
| POST | accountGovernanceRouter | /admin/restriction | Backend/src/Routes/account/accountGovernanceRoutes.ts:168 | authenticate, requireGovernanceAdmin | 1 / 0 / 0 |
| DELETE | accountGovernanceRouter | /admin/restriction/:id | Backend/src/Routes/account/accountGovernanceRoutes.ts:216 | authenticate, requireGovernanceAdmin | 1 / 0 / 0 |
| GET | manageAccountsRouter | /status | Backend/src/Routes/account/manageAccountsRoutes.ts:25 | authenticate | 1 / 0 / 0 |
| POST | manageAccountsRouter | /email/change/start | Backend/src/Routes/account/manageAccountsRoutes.ts:50 | authenticate | 1 / 0 / 0 |
| POST | manageAccountsRouter | /email/change/authorize-old | Backend/src/Routes/account/manageAccountsRoutes.ts:91 | authenticate | 1 / 0 / 0 |
| POST | manageAccountsRouter | /email/change/verify-new | Backend/src/Routes/account/manageAccountsRoutes.ts:132 | authenticate | 1 / 0 / 0 |
| POST | manageAccountsRouter | /email/change/resend | Backend/src/Routes/account/manageAccountsRoutes.ts:187 | authenticate | 1 / 0 / 0 |
| POST | manageAccountsRouter | /email/change/cancel | Backend/src/Routes/account/manageAccountsRoutes.ts:228 | authenticate | 1 / 0 / 0 |
| POST | manageAccountsRouter | /email/verify-primary/send | Backend/src/Routes/account/manageAccountsRoutes.ts:251 | authenticate | 2 / 0 / 0 |
| POST | manageAccountsRouter | /email/verify-primary/confirm | Backend/src/Routes/account/manageAccountsRoutes.ts:295 | authenticate | 1 / 0 / 0 |
| GET | manageAccountsRouter | /username/check | Backend/src/Routes/account/manageAccountsRoutes.ts:329 | authenticate | 1 / 0 / 0 |
| POST | manageAccountsRouter | /username/change/request | Backend/src/Routes/account/manageAccountsRoutes.ts:348 | authenticate | 1 / 0 / 0 |
| POST | manageAccountsRouter | /username/change/confirm | Backend/src/Routes/account/manageAccountsRoutes.ts:389 | authenticate | 1 / 0 / 0 |
| POST | manageAccountsRouter | /password/change | Backend/src/Routes/account/manageAccountsRoutes.ts:443 | authenticate | 2 / 0 / 0 |
| GET | manageAccountsRouter | /data-archive/info | Backend/src/Routes/account/manageAccountsRoutes.ts:473 | authenticate | 1 / 0 / 0 |
| POST | manageAccountsRouter | /data-archive/request-code | Backend/src/Routes/account/manageAccountsRoutes.ts:498 | authenticate | 1 / 0 / 0 |
| POST | manageAccountsRouter | /data-archive/generate | Backend/src/Routes/account/manageAccountsRoutes.ts:520 | authenticate | 1 / 0 / 0 |
| GET | manageAccountsRouter | /data-archive/download/:exportId | Backend/src/Routes/account/manageAccountsRoutes.ts:557 | authenticate | 1 / 0 / 0 |
| GET | privacyRouter | /preferences | Backend/src/Routes/account/privacyRoutes.ts:19 | authenticate | 1 / 0 / 0 |
| PUT | privacyRouter | /preferences | Backend/src/Routes/account/privacyRoutes.ts:37 | authenticate | 1 / 0 / 0 |
| GET | privacyRouter | /inventory | Backend/src/Routes/account/privacyRoutes.ts:63 | — | 0 / 0 / 0 |
| POST | privacyRouter | /deletion | Backend/src/Routes/account/privacyRoutes.ts:72 | authenticate | 1 / 0 / 0 |
| DELETE | privacyRouter | /deletion | Backend/src/Routes/account/privacyRoutes.ts:95 | authenticate | 1 / 0 / 0 |
| GET | privacyRouter | /history | Backend/src/Routes/account/privacyRoutes.ts:116 | authenticate | 1 / 0 / 0 |
| POST | privacyRouter | /purge/execute | Backend/src/Routes/account/privacyRoutes.ts:135 | — | 1 / 0 / 0 |
| GET | emailMonitoringRouter | /health | Backend/src/Routes/admin/emailMonitoringRoutes.ts:18 | authenticate | 3 / 2 / 0 |
| GET | emailMonitoringRouter | /queue/stats | Backend/src/Routes/admin/emailMonitoringRoutes.ts:51 | authenticate | 3 / 2 / 0 |
| GET | emailMonitoringRouter | /jobs | Backend/src/Routes/admin/emailMonitoringRoutes.ts:102 | authenticate | 1 / 0 / 0 |
| GET | emailMonitoringRouter | /jobs/:id | Backend/src/Routes/admin/emailMonitoringRoutes.ts:134 | authenticate | 2 / 1 / 0 |
| GET | emailMonitoringRouter | /dead-letters | Backend/src/Routes/admin/emailMonitoringRoutes.ts:164 | authenticate | 1 / 0 / 0 |
| GET | emailMonitoringRouter | /dead-letters/:id | Backend/src/Routes/admin/emailMonitoringRoutes.ts:196 | authenticate | 1 / 0 / 0 |
| POST | emailMonitoringRouter | /dead-letters/:id/retry | Backend/src/Routes/admin/emailMonitoringRoutes.ts:218 | authenticate | 1 / 0 / 0 |
| POST | emailMonitoringRouter | /dead-letters/bulk-retry | Backend/src/Routes/admin/emailMonitoringRoutes.ts:239 | authenticate | 2 / 1 / 0 |
| POST | emailMonitoringRouter | /dead-letters/:id/discard | Backend/src/Routes/admin/emailMonitoringRoutes.ts:276 | authenticate | 1 / 0 / 0 |
| POST | authRouter | /signup/send-email-otp | Backend/src/Routes/auth/auth.ts:47 | — | 5 / 2 / 0 |
| POST | authRouter | /signup/verify-email-otp | Backend/src/Routes/auth/auth.ts:141 | — | 1 / 0 / 0 |
| POST | authRouter | /signup | Backend/src/Routes/auth/auth.ts:179 | — | 9 / 3 / 0 |
| POST | authRouter | /signin | Backend/src/Routes/auth/auth.ts:439 | — | 15 / 6 / 0 |
| POST | authRouter | /refresh | Backend/src/Routes/auth/auth.ts:1060 | handleTokenRefresh | 0 / 0 / 0 |
| POST | authRouter | /refresh-token | Backend/src/Routes/auth/auth.ts:1061 | handleTokenRefresh | 0 / 0 / 0 |
| GET | authRouter | /refresh | Backend/src/Routes/auth/auth.ts:1062 | handleTokenRefresh | 0 / 0 / 0 |
| POST | authRouter | /signout | Backend/src/Routes/auth/auth.ts:1130 | handleSignout | 0 / 0 / 0 |
| POST | authRouter | /logout | Backend/src/Routes/auth/auth.ts:1131 | handleSignout | 0 / 0 / 0 |
| GET | authRouter | /profile/me | Backend/src/Routes/auth/auth.ts:1135 | authenticate, handleGetMyProfile | 0 / 0 / 0 |
| GET | authRouter | /me | Backend/src/Routes/auth/auth.ts:1136 | authenticate, handleGetMyProfile | 0 / 0 / 0 |
| POST | authRouter | /profile/save | Backend/src/Routes/auth/auth.ts:1139 | authenticate, handleSavePortals | 0 / 0 / 0 |
| GET | authRouter | /profile/save | Backend/src/Routes/auth/auth.ts:1140 | authenticate, handleGetSavedPortals | 0 / 0 / 0 |
| POST | authRouter | /2fa/verify-login | Backend/src/Routes/auth/auth.ts:1281 | handleVerifyLogin2FA | 0 / 0 / 0 |
| POST | authRouter | /2fa/resend-login-otp | Backend/src/Routes/auth/auth.ts:1315 | handleResendLoginOtp | 0 / 0 / 0 |
| POST | authRouter | /2fa/setup/send-otp | Backend/src/Routes/auth/auth.ts:1359 | authenticate, handleSendSetupOtp | 0 / 0 / 0 |
| POST | authRouter | /2fa/setup/verify-otp | Backend/src/Routes/auth/auth.ts:1394 | authenticate, handleVerifySetupOtp | 0 / 0 / 0 |
| POST | authRouter | /2fa/disable | Backend/src/Routes/auth/auth.ts:1429 | authenticate, handleDisable2FA | 0 / 0 / 0 |
| POST | authRouter | /password/change | Backend/src/Routes/auth/auth.ts:1455 | authenticate, handlePasswordChange | 0 / 0 / 0 |
| POST | authRouter | /forgot-password/find-account | Backend/src/Routes/auth/auth.ts:1564 | handleForgotPasswordFindAccount | 0 / 0 / 0 |
| POST | authRouter | /forgot-password/request-otp | Backend/src/Routes/auth/auth.ts:1565 | handleForgotPasswordFindAccount | 0 / 0 / 0 |
| POST | authRouter | /forgot-password/resend-otp | Backend/src/Routes/auth/auth.ts:1566 | handleForgotPasswordResendOtp | 0 / 0 / 0 |
| POST | authRouter | /forgot-password/verify-otp | Backend/src/Routes/auth/auth.ts:1567 | handleForgotPasswordVerifyOtp | 0 / 0 / 0 |
| POST | authRouter | /forgot-password/reset | Backend/src/Routes/auth/auth.ts:1568 | handleForgotPasswordReset | 0 / 0 / 0 |
| GET | oauthRouter | /google | Backend/src/Routes/auth/oauthRoutes.ts:14 | — | 1 / 0 / 0 |
| GET | oauthRouter | /google/callback | Backend/src/Routes/auth/oauthRoutes.ts:45 | — | 4 / 0 / 0 |
| GET | oauthRouter | /github | Backend/src/Routes/auth/oauthRoutes.ts:109 | — | 1 / 0 / 0 |
| ALL | oauthRouter | /github/link | Backend/src/Routes/auth/oauthRoutes.ts:141 | authenticate | 3 / 0 / 0 |
| POST | blogRouter | /likes/batch | Backend/src/Routes/blog/blogRoutes.ts:14 | optionalAuthenticate, getBatchPublicationLikesHandler | 0 / 0 / 0 |
| GET | blogRouter | /:hoster/:blogName/likes | Backend/src/Routes/blog/blogRoutes.ts:17 | optionalAuthenticate, getPublicationLikesHandler | 0 / 0 / 0 |
| POST | blogRouter | /:hoster/:blogName/likes | Backend/src/Routes/blog/blogRoutes.ts:18 | authenticate, likePublicationHandler | 0 / 0 / 0 |
| DELETE | blogRouter | /:hoster/:blogName/likes | Backend/src/Routes/blog/blogRoutes.ts:19 | authenticate, unlikePublicationHandler | 0 / 0 / 0 |
| GET | clubRouter | /college-clubs | Backend/src/Routes/club/club.ts:66 | authenticate | 1 / 0 / 0 |
| GET | clubRouter | /check-availability | Backend/src/Routes/club/club.ts:353 | optionalAuthenticate | 6 / 5 / 0 |
| POST | clubRouter | /verify/send-email-otp | Backend/src/Routes/club/club.ts:495 | optionalAuthenticate | 4 / 3 / 0 |
| POST | clubRouter | /verify/verify-email-otp | Backend/src/Routes/club/club.ts:573 | — | 1 / 0 / 0 |
| POST | clubRouter | /verify/send-phone-otp | Backend/src/Routes/club/club.ts:605 | optionalAuthenticate | 1 / 0 / 0 |
| POST | clubRouter | /verify/verify-phone-otp | Backend/src/Routes/club/club.ts:674 | handleVerifyPhoneRequest | 0 / 0 / 0 |
| POST | clubRouter | /register | Backend/src/Routes/club/club.ts:683 | optionalAuthenticate | 15 / 9 / 0 |
| GET | clubRouter | /application-status | Backend/src/Routes/club/club.ts:1161 | authenticate, requireClubAccount | 2 / 2 / 0 |
| GET | clubRouter | /reviewer/check-access | Backend/src/Routes/club/club.ts:1268 | authenticate | 0 / 0 / 0 |
| GET | clubRouter | /reviewer/queue | Backend/src/Routes/club/club.ts:1289 | authenticate, authenticateReviewer | 1 / 1 / 0 |
| GET | clubRouter | /reviewer/request/:id | Backend/src/Routes/club/club.ts:1359 | authenticate, authenticateReviewer | 1 / 1 / 0 |
| PATCH | clubRouter | /reviewer/request/:id | Backend/src/Routes/club/club.ts:1401 | authenticate, authenticateReviewer | 7 / 2 / 0 |
| POST | clubRouter | /reviewer/promote/:id | Backend/src/Routes/club/club.ts:1808 | authenticate, authenticateReviewer, handlePromoteClub | 0 / 0 / 0 |
| POST | clubRouter | /reviewer/approve/:id | Backend/src/Routes/club/club.ts:1809 | authenticate, authenticateReviewer, handlePromoteClub | 0 / 0 / 0 |
| GET | clubRouter | /session-state | Backend/src/Routes/club/club.ts:1815 | authenticate, requireClubAccount | 2 / 2 / 0 |
| GET | clubRouter | /events | Backend/src/Routes/club/club.ts:1888 | authenticate, requireClubAccount | 3 / 2 / 0 |
| GET | clubRouter | /events/creation-eligibility | Backend/src/Routes/club/club.ts:1968 | authenticate, requireClubAccount | 3 / 1 / 0 |
| GET | clubRouter | /events/audience-pools | Backend/src/Routes/club/club.ts:2002 | authenticate, requireClubAccount | 3 / 1 / 0 |
| GET | clubRouter | /events/:eventId | Backend/src/Routes/club/club.ts:2037 | authenticate, requireClubAccount | 4 / 3 / 0 |
| POST | clubRouter | /events | Backend/src/Routes/club/club.ts:2128 | authenticate, requireClubAccount | 8 / 3 / 0 |
| PATCH | clubRouter | /events/:eventId | Backend/src/Routes/club/club.ts:2420 | authenticate, requireClubAccount | 9 / 6 / 0 |
| DELETE | clubRouter | /events/:eventId | Backend/src/Routes/club/club.ts:2813 | authenticate, requireClubAccount | 7 / 4 / 0 |
| POST | clubRouter | /:clubId/messages | Backend/src/Routes/club/club.ts:3038 | authenticate | 1 / 0 / 0 |
| GET | clubRouter | /:clubId/my-conversation | Backend/src/Routes/club/club.ts:3086 | authenticate | 2 / 2 / 0 |
| GET | clubRouter | /college-events | Backend/src/Routes/club/club.ts:3127 | optionalAuthenticate | 5 / 5 / 0 |
| GET | clubRouter | /public-events/:eventId | Backend/src/Routes/club/club.ts:3365 | optionalAuthenticate | 1 / 1 / 0 |
| POST | clubRouter | /events/:eventId/like | Backend/src/Routes/club/club.ts:3471 | authenticate | 1 / 0 / 0 |
| POST | clubRouter | /events/:eventId/register | Backend/src/Routes/club/club.ts:3494 | authenticate | 9 / 6 / 0 |
| POST | clubRouter | /events/:eventId/cancel | Backend/src/Routes/club/club.ts:3936 | authenticate | 14 / 14 / 0 |
| GET | clubRouter | /user/applications | Backend/src/Routes/club/club.ts:4093 | authenticate | 2 / 2 / 0 |
| GET | clubRouter | /events/:eventId/applications | Backend/src/Routes/club/club.ts:4202 | authenticate, requireClubAccount | 4 / 3 / 0 |
| PATCH | clubRouter | /events/:eventId/applications/batch | Backend/src/Routes/club/club.ts:4354 | authenticate, requireClubAccount | 10 / 9 / 0 |
| PATCH | clubRouter | /events/:eventId/applications/:registrationId | Backend/src/Routes/club/club.ts:4566 | authenticate, requireClubAccount | 10 / 9 / 0 |
| GET | clubRouter | /events/:eventId/applications/export | Backend/src/Routes/club/club.ts:4744 | authenticate, requireClubAccount | 5 / 4 / 0 |
| POST | clubRouter | /events/:eventId/checkin | Backend/src/Routes/club/club.ts:5011 | authenticate, requireClubAccount | 3 / 2 / 0 |
| POST | clubRouter | /events/:eventId/checkin-verify | Backend/src/Routes/club/club.ts:5062 | authenticate, requireClubAccount | 6 / 4 / 0 |
| GET | clubRouter | /inbox | Backend/src/Routes/club/club.ts:5279 | authenticate, requireClubAccount | 2 / 1 / 0 |
| GET | clubRouter | /inbox/unread-count | Backend/src/Routes/club/club.ts:5339 | authenticate, requireClubAccount | 2 / 1 / 0 |
| GET | clubRouter | /inbox/:conversationId/messages | Backend/src/Routes/club/club.ts:5378 | authenticate, requireClubAccount | 4 / 3 / 0 |
| POST | clubRouter | /inbox/:conversationId/reply | Backend/src/Routes/club/club.ts:5453 | authenticate, requireClubAccount | 2 / 0 / 0 |
| PATCH | clubRouter | /inbox/:conversationId/read | Backend/src/Routes/club/club.ts:5482 | authenticate, requireClubAccount | 2 / 1 / 0 |
| PATCH | clubRouter | /inbox/:conversationId/archive | Backend/src/Routes/club/club.ts:5504 | authenticate, requireClubAccount | 2 / 1 / 0 |
| DELETE | clubRouter | /inbox/:conversationId | Backend/src/Routes/club/club.ts:5526 | authenticate, requireClubAccount | 2 / 1 / 0 |
| POST | clubRouter | /inbox/bulk-delete | Backend/src/Routes/club/club.ts:5543 | authenticate, requireClubAccount | 2 / 1 / 0 |
| POST | clubRouter | /inbox/bulk-read | Backend/src/Routes/club/club.ts:5562 | authenticate, requireClubAccount | 2 / 1 / 0 |
| POST | clubRouter | /moderation/mute | Backend/src/Routes/club/club.ts:5582 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | clubRouter | /moderation/unmute | Backend/src/Routes/club/club.ts:5597 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | clubRouter | /moderation/block | Backend/src/Routes/club/club.ts:5612 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | clubRouter | /moderation/unblock | Backend/src/Routes/club/club.ts:5627 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | clubRouter | /moderation/list | Backend/src/Routes/club/club.ts:5642 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | clubRouter | /certificates/events | Backend/src/Routes/club/club.ts:5663 | authenticate, requireClubAccount | 2 / 1 / 0 |
| GET | clubRouter | /certificates/event/:eventId/recipients | Backend/src/Routes/club/club.ts:5696 | authenticate, requireClubAccount | 3 / 2 / 0 |
| GET | clubRouter | /certificates/eligible-recipients | Backend/src/Routes/club/club.ts:5750 | authenticate, requireClubAccount | 2 / 1 / 0 |
| POST | clubRouter | /certificates/issue | Backend/src/Routes/club/club.ts:5891 | authenticate, requireClubAccount | 9 / 7 / 0 |
| GET | clubRouter | /certificates/issued | Backend/src/Routes/club/club.ts:6151 | authenticate, requireClubAccount | 2 / 1 / 0 |
| DELETE | clubRouter | /certificates/:certificateId | Backend/src/Routes/club/club.ts:6191 | authenticate, requireClubAccount | 2 / 1 / 0 |
| GET | clubRouter | /user/certificates | Backend/src/Routes/club/club.ts:6217 | authenticate | 1 / 1 / 0 |
| GET | clubRouter | /certificates/verify/:credentialCode | Backend/src/Routes/club/club.ts:6275 | optionalAuthenticate | 1 / 1 / 0 |
| GET | clubRouter | /public/:slug | Backend/src/Routes/club/club.ts:6326 | optionalAuthenticate, handleGetPublicClub | 0 / 0 / 0 |
| GET | clubRouter | /:slug | Backend/src/Routes/club/club.ts:6327 | optionalAuthenticate, handleGetPublicClub | 0 / 0 / 0 |
| GET | clubRouter | /events/guardian-consent/verify | Backend/src/Routes/club/club.ts:6336 | — | 1 / 1 / 0 |
| POST | clubRouter | /events/guardian-consent/confirm | Backend/src/Routes/club/club.ts:6396 | — | 3 / 3 / 0 |
| GET | router | /context | Backend/src/Routes/club/clubAnnouncementRoutes.ts:21 | — | 1 / 0 / 0 |
| GET | router | / | Backend/src/Routes/club/clubAnnouncementRoutes.ts:25 | — | 3 / 0 / 0 |
| POST | router | /uploads/signature | Backend/src/Routes/club/clubAnnouncementRoutes.ts:32 | — | 3 / 0 / 0 |
| POST | router | /uploads/:id/complete | Backend/src/Routes/club/clubAnnouncementRoutes.ts:38 | — | 4 / 1 / 0 |
| DELETE | router | /uploads/:id | Backend/src/Routes/club/clubAnnouncementRoutes.ts:46 | — | 2 / 0 / 0 |
| POST | router | / | Backend/src/Routes/club/clubAnnouncementRoutes.ts:51 | — | 5 / 0 / 0 |
| GET | router | /:id | Backend/src/Routes/club/clubAnnouncementRoutes.ts:60 | — | 2 / 0 / 0 |
| PATCH | router | /:id | Backend/src/Routes/club/clubAnnouncementRoutes.ts:64 | — | 6 / 0 / 0 |
| DELETE | router | /:id | Backend/src/Routes/club/clubAnnouncementRoutes.ts:73 | — | 2 / 0 / 0 |
| GET | certificateRouter | /templates | Backend/src/Routes/club/clubCertificateRoutes.ts:49 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | certificateRouter | /templates/:templateId | Backend/src/Routes/club/clubCertificateRoutes.ts:72 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | certificateRouter | /templates | Backend/src/Routes/club/clubCertificateRoutes.ts:95 | authenticate, requireClubAccount | 2 / 0 / 0 |
| PUT | certificateRouter | /templates/:templateId | Backend/src/Routes/club/clubCertificateRoutes.ts:132 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | certificateRouter | /templates/:templateId/duplicate | Backend/src/Routes/club/clubCertificateRoutes.ts:160 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | certificateRouter | /templates/:templateId/rename | Backend/src/Routes/club/clubCertificateRoutes.ts:186 | authenticate, requireClubAccount | 2 / 0 / 0 |
| DELETE | certificateRouter | /templates/:templateId | Backend/src/Routes/club/clubCertificateRoutes.ts:209 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | certificateRouter | /upload-background | Backend/src/Routes/club/clubCertificateRoutes.ts:232 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | certificateRouter | /events/:eventId/eligibility | Backend/src/Routes/club/clubCertificateRoutes.ts:273 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | certificateRouter | /recipient-directory | Backend/src/Routes/club/clubCertificateRoutes.ts:299 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | certificateRouter | /issue-batch | Backend/src/Routes/club/clubCertificateRoutes.ts:322 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | certificateRouter | /teams/:teamId/roster | Backend/src/Routes/club/clubCertificateRoutes.ts:386 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | certificateRouter | /batches | Backend/src/Routes/club/clubCertificateRoutes.ts:406 | authenticate, requireClubAccount | 3 / 2 / 0 |
| GET | certificateRouter | /queue/metrics | Backend/src/Routes/club/clubCertificateRoutes.ts:466 | authenticate, requireClubAccount | 1 / 0 / 0 |
| GET | certificateRouter | /batches/:batchId/progress | Backend/src/Routes/club/clubCertificateRoutes.ts:483 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | certificateRouter | /batches/:batchId/retry-failed | Backend/src/Routes/club/clubCertificateRoutes.ts:506 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | certificateRouter | /batches/:batchId/cancel | Backend/src/Routes/club/clubCertificateRoutes.ts:529 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | certificateRouter | /batches/:batchId/errors | Backend/src/Routes/club/clubCertificateRoutes.ts:552 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | certificateRouter | /batches/:batchId/report | Backend/src/Routes/club/clubCertificateRoutes.ts:571 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | certificateRouter | /batches/:batchId/resume | Backend/src/Routes/club/clubCertificateRoutes.ts:600 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | certificateRouter | /batches/resume-stalled | Backend/src/Routes/club/clubCertificateRoutes.ts:623 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | certificateRouter | /csv/reconcile | Backend/src/Routes/club/clubCertificateRoutes.ts:645 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | certificateRouter | /csv/sample-template | Backend/src/Routes/club/clubCertificateRoutes.ts:696 | authenticate, requireClubAccount | 0 / 0 / 0 |
| GET | certificateRouter | /stats | Backend/src/Routes/club/clubCertificateRoutes.ts:720 | authenticate, requireClubAccount | 2 / 1 / 0 |
| GET | certificateRouter | /history | Backend/src/Routes/club/clubCertificateRoutes.ts:763 | authenticate, requireClubAccount | 2 / 1 / 0 |
| GET | certificateRouter | /settings | Backend/src/Routes/club/clubCertificateRoutes.ts:862 | authenticate, requireClubAccount | 2 / 1 / 0 |
| PUT | certificateRouter | /settings | Backend/src/Routes/club/clubCertificateRoutes.ts:900 | authenticate, requireClubAccount | 2 / 1 / 0 |
| POST | certificateRouter | /preview-sample | Backend/src/Routes/club/clubCertificateRoutes.ts:953 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | certificateRouter | /:certificateId/preview | Backend/src/Routes/club/clubCertificateRoutes.ts:1056 | optionalAuthenticate | 1 / 0 / 0 |
| GET | certificateRouter | /:certificateId/preview-data | Backend/src/Routes/club/clubCertificateRoutes.ts:1086 | optionalAuthenticate | 1 / 0 / 0 |
| GET | certificateRouter | /:certificateId/download | Backend/src/Routes/club/clubCertificateRoutes.ts:1129 | optionalAuthenticate | 3 / 1 / 0 |
| GET | certificateRouter | /verify/:credentialCode | Backend/src/Routes/club/clubCertificateRoutes.ts:1231 | optionalAuthenticate | 1 / 0 / 0 |
| GET | certificateRouter | /public/verify/:identifier | Backend/src/Routes/club/clubCertificateRoutes.ts:1294 | optionalAuthenticate | 1 / 0 / 0 |
| POST | certificateRouter | /:certificateId/revoke | Backend/src/Routes/club/clubCertificateRoutes.ts:1314 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | certificateRouter | /:certificateId/reissue | Backend/src/Routes/club/clubCertificateRoutes.ts:1343 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | certificateRouter | /:certificateId/audit-history | Backend/src/Routes/club/clubCertificateRoutes.ts:1379 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | certificateRouter | /user/wallet | Backend/src/Routes/club/clubCertificateRoutes.ts:1398 | authenticate | 1 / 0 / 0 |
| GET | certificateRouter | /audit-logs | Backend/src/Routes/club/clubCertificateRoutes.ts:1427 | authenticate, requireClubAccount | 2 / 1 / 0 |
| POST | certificateRouter | /user/:certificateId/reveal | Backend/src/Routes/club/clubCertificateRoutes.ts:1459 | authenticate | 6 / 6 / 0 |
| GET | certificateRouter | /claim/:claimToken | Backend/src/Routes/club/clubCertificateRoutes.ts:1579 | optionalAuthenticate | 1 / 0 / 0 |
| POST | certificateRouter | /claim/:claimToken | Backend/src/Routes/club/clubCertificateRoutes.ts:1602 | authenticate | 1 / 0 / 0 |
| GET | clubCredibilityRouter | /credibility | Backend/src/Routes/club/clubCredibilityRoutes.ts:30 | authenticate, requireClubAccount | 3 / 0 / 0 |
| GET | clubCredibilityRouter | /credibility/history | Backend/src/Routes/club/clubCredibilityRoutes.ts:62 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | clubCredibilityRouter | /credibility/creation-eligibility | Backend/src/Routes/club/clubCredibilityRoutes.ts:118 | authenticate, requireClubAccount, handleGetCreationEligibility | 0 / 0 / 0 |
| GET | clubCredibilityRouter | /events/creation-eligibility | Backend/src/Routes/club/clubCredibilityRoutes.ts:119 | authenticate, requireClubAccount, handleGetCreationEligibility | 0 / 0 / 0 |
| GET | clubCredibilityRouter | /credibility/audience-pools | Backend/src/Routes/club/clubCredibilityRoutes.ts:147 | authenticate, requireClubAccount, handleGetAudiencePools | 0 / 0 / 0 |
| GET | clubCredibilityRouter | /events/audience-pools | Backend/src/Routes/club/clubCredibilityRoutes.ts:148 | authenticate, requireClubAccount, handleGetAudiencePools | 0 / 0 / 0 |
| GET | clubCredibilityRouter | /audience-pools | Backend/src/Routes/club/clubCredibilityRoutes.ts:149 | authenticate, requireClubAccount, handleGetAudiencePools | 0 / 0 / 0 |
| POST | clubCredibilityRouter | /credibility/preview-impact | Backend/src/Routes/club/clubCredibilityRoutes.ts:155 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | clubCredibilityRouter | /credibility/appeals | Backend/src/Routes/club/clubCredibilityRoutes.ts:193 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | clubCredibilityRouter | /credibility/recalculate | Backend/src/Routes/club/clubCredibilityRoutes.ts:231 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | clubCredibilityRouter | /credibility/certificates/preflight | Backend/src/Routes/club/clubCredibilityRoutes.ts:260 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | clubCredibilityRouter | /:clubId/credibility/public | Backend/src/Routes/club/clubCredibilityRoutes.ts:298 | optionalAuthenticate | 1 / 0 / 0 |
| GET | clubProfileRouter | / | Backend/src/Routes/club/clubProfileRoutes.ts:11 | authenticate, requireClubAccount | 1 / 0 / 0 |
| GET | clubProfileRouter | /college-clubs | Backend/src/Routes/club/clubProfileRoutes.ts:39 | authenticate | 1 / 0 / 0 |
| PATCH | clubProfileRouter | / | Backend/src/Routes/club/clubProfileRoutes.ts:69 | authenticate, requireClubAccount | 1 / 0 / 0 |
| DELETE | clubProfileRouter | /image | Backend/src/Routes/club/clubProfileRoutes.ts:97 | authenticate, requireClubAccount | 1 / 0 / 0 |
| GET | clubProfileRouter | /preview | Backend/src/Routes/club/clubProfileRoutes.ts:133 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | clubProfileRouter | /upload-signature | Backend/src/Routes/club/clubProfileRoutes.ts:164 | authenticate, requireClubAccount | 1 / 0 / 0 |
| POST | clubProfileRouter | /coordinators | Backend/src/Routes/club/clubProfileRoutes.ts:199 | authenticate, requireClubAccount | 1 / 0 / 0 |
| PATCH | clubProfileRouter | /coordinators/:id | Backend/src/Routes/club/clubProfileRoutes.ts:223 | authenticate, requireClubAccount | 1 / 0 / 0 |
| DELETE | clubProfileRouter | /coordinators/:id | Backend/src/Routes/club/clubProfileRoutes.ts:252 | authenticate, requireClubAccount | 1 / 0 / 0 |
| POST | clubProfileRouter | /coordinators/reorder | Backend/src/Routes/club/clubProfileRoutes.ts:280 | authenticate, requireClubAccount | 1 / 0 / 0 |
| POST | clubProfileRouter | /achievements | Backend/src/Routes/club/clubProfileRoutes.ts:307 | authenticate, requireClubAccount | 1 / 0 / 0 |
| PATCH | clubProfileRouter | /achievements/:id | Backend/src/Routes/club/clubProfileRoutes.ts:331 | authenticate, requireClubAccount | 1 / 0 / 0 |
| DELETE | clubProfileRouter | /achievements/:id | Backend/src/Routes/club/clubProfileRoutes.ts:360 | authenticate, requireClubAccount | 1 / 0 / 0 |
| POST | clubProfileRouter | /achievements/reorder | Backend/src/Routes/club/clubProfileRoutes.ts:388 | authenticate, requireClubAccount | 1 / 0 / 0 |
| GET | clubSettingsRouter | /status | Backend/src/Routes/club/clubSettingsRoutes.ts:14 | authenticate | 1 / 0 / 0 |
| PATCH | clubSettingsRouter | /privacy | Backend/src/Routes/club/clubSettingsRoutes.ts:39 | authenticate | 1 / 0 / 0 |
| POST | clubSettingsRouter | /password/change | Backend/src/Routes/club/clubSettingsRoutes.ts:61 | authenticate | 1 / 0 / 0 |
| POST | clubSettingsRouter | /verify-email/send | Backend/src/Routes/club/clubSettingsRoutes.ts:84 | authenticate | 2 / 0 / 0 |
| POST | clubSettingsRouter | /verify-email/confirm | Backend/src/Routes/club/clubSettingsRoutes.ts:127 | authenticate | 1 / 0 / 0 |
| GET | clubSettingsRouter | /data-archive | Backend/src/Routes/club/clubSettingsRoutes.ts:161 | authenticate | 1 / 0 / 0 |
| GET | clubTeamRouter | /stats | Backend/src/Routes/club/clubTeamRoutes.ts:32 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | clubTeamRouter | /teams | Backend/src/Routes/club/clubTeamRoutes.ts:49 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | clubTeamRouter | /teams | Backend/src/Routes/club/clubTeamRoutes.ts:67 | authenticate, requireClubAccount | 2 / 0 / 0 |
| PATCH | clubTeamRouter | /teams/:teamId | Backend/src/Routes/club/clubTeamRoutes.ts:98 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | clubTeamRouter | /teams/:teamId/archive | Backend/src/Routes/club/clubTeamRoutes.ts:127 | authenticate, requireClubAccount | 2 / 0 / 0 |
| DELETE | clubTeamRouter | /teams/:teamId | Backend/src/Routes/club/clubTeamRoutes.ts:150 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | clubTeamRouter | /search-users | Backend/src/Routes/club/clubTeamRoutes.ts:167 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | clubTeamRouter | /members | Backend/src/Routes/club/clubTeamRoutes.ts:184 | authenticate, requireClubAccount | 2 / 0 / 0 |
| PATCH | clubTeamRouter | /members/:membershipId | Backend/src/Routes/club/clubTeamRoutes.ts:209 | authenticate, requireClubAccount | 2 / 0 / 0 |
| DELETE | clubTeamRouter | /members/:membershipId | Backend/src/Routes/club/clubTeamRoutes.ts:234 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | clubTeamRouter | /members/:membershipId/assign-team | Backend/src/Routes/club/clubTeamRoutes.ts:251 | authenticate, requireClubAccount | 2 / 0 / 0 |
| DELETE | clubTeamRouter | /teams/:teamId/members/:targetUserId | Backend/src/Routes/club/clubTeamRoutes.ts:280 | authenticate, requireClubAccount | 2 / 0 / 0 |
| GET | clubTeamRouter | /invitations | Backend/src/Routes/club/clubTeamRoutes.ts:298 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | clubTeamRouter | /invitations | Backend/src/Routes/club/clubTeamRoutes.ts:315 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | clubTeamRouter | /invitations/:invitationId/cancel | Backend/src/Routes/club/clubTeamRoutes.ts:347 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | clubTeamRouter | /invitations/:invitationId/resend | Backend/src/Routes/club/clubTeamRoutes.ts:364 | authenticate, requireClubAccount | 2 / 0 / 0 |
| POST | clubTeamRouter | /invitations/:invitationId/accept | Backend/src/Routes/club/clubTeamRoutes.ts:381 | authenticate | 1 / 0 / 0 |
| POST | clubTeamRouter | /invitations/:invitationId/decline | Backend/src/Routes/club/clubTeamRoutes.ts:400 | authenticate | 1 / 0 / 0 |
| POST | eventEngagementRouter | /events/engagement/batch | Backend/src/Routes/events/eventEngagementRoutes.ts:16 | optionalAuthenticate, getBatchEventEngagementHandler | 0 / 0 / 0 |
| POST | eventEngagementRouter | /club/events/engagement/batch | Backend/src/Routes/events/eventEngagementRoutes.ts:17 | optionalAuthenticate, getBatchEventEngagementHandler | 0 / 0 / 0 |
| GET | eventEngagementRouter | /events/:eventId/engagement | Backend/src/Routes/events/eventEngagementRoutes.ts:20 | optionalAuthenticate, getEventEngagementHandler | 0 / 0 / 0 |
| GET | eventEngagementRouter | /club/events/:eventId/engagement | Backend/src/Routes/events/eventEngagementRoutes.ts:21 | optionalAuthenticate, getEventEngagementHandler | 0 / 0 / 0 |
| POST | eventEngagementRouter | /events/:eventId/likes | Backend/src/Routes/events/eventEngagementRoutes.ts:24 | authenticate, likeEventHandler | 0 / 0 / 0 |
| POST | eventEngagementRouter | /club/events/:eventId/likes | Backend/src/Routes/events/eventEngagementRoutes.ts:25 | authenticate, likeEventHandler | 0 / 0 / 0 |
| DELETE | eventEngagementRouter | /events/:eventId/likes | Backend/src/Routes/events/eventEngagementRoutes.ts:26 | authenticate, unlikeEventHandler | 0 / 0 / 0 |
| DELETE | eventEngagementRouter | /club/events/:eventId/likes | Backend/src/Routes/events/eventEngagementRoutes.ts:27 | authenticate, unlikeEventHandler | 0 / 0 / 0 |
| POST | eventEngagementRouter | /events/:eventId/like | Backend/src/Routes/events/eventEngagementRoutes.ts:30 | authenticate, toggleEventLikeHandler | 0 / 0 / 0 |
| POST | eventEngagementRouter | /club/events/:eventId/like | Backend/src/Routes/events/eventEngagementRoutes.ts:31 | authenticate, toggleEventLikeHandler | 0 / 0 / 0 |
| POST | eventEngagementRouter | /events/:eventId/shares | Backend/src/Routes/events/eventEngagementRoutes.ts:34 | optionalAuthenticate, recordEventShareHandler | 0 / 0 / 0 |
| POST | eventEngagementRouter | /club/events/:eventId/shares | Backend/src/Routes/events/eventEngagementRoutes.ts:35 | optionalAuthenticate, recordEventShareHandler | 0 / 0 / 0 |
| POST | eventEngagementRouter | /events/:eventId/share | Backend/src/Routes/events/eventEngagementRoutes.ts:36 | optionalAuthenticate, recordEventShareHandler | 0 / 0 / 0 |
| POST | eventEngagementRouter | /club/events/:eventId/share | Backend/src/Routes/events/eventEngagementRoutes.ts:37 | optionalAuthenticate, recordEventShareHandler | 0 / 0 / 0 |
| GET | eventFormRouter | /club/events/:eventId/form | Backend/src/Routes/events/eventFormRoutes.ts:35 | — | 1 / 0 / 0 |
| POST | eventFormRouter | /club/events/:eventId/form | Backend/src/Routes/events/eventFormRoutes.ts:70 | — | 1 / 0 / 0 |
| PUT | eventFormRouter | /club/events/:eventId/form/draft | Backend/src/Routes/events/eventFormRoutes.ts:118 | handleSaveDraft | 0 / 0 / 0 |
| PUT | eventFormRouter | /club/events/:eventId/form | Backend/src/Routes/events/eventFormRoutes.ts:119 | handleSaveDraft | 0 / 0 / 0 |
| PATCH | eventFormRouter | /club/events/:eventId/form/draft/autosave | Backend/src/Routes/events/eventFormRoutes.ts:125 | rateLimitDraftAutosave | 1 / 0 / 0 |
| POST | eventFormRouter | /club/events/:eventId/form/publish | Backend/src/Routes/events/eventFormRoutes.ts:150 | — | 1 / 0 / 0 |
| POST | eventFormRouter | /club/events/:eventId/form/close | Backend/src/Routes/events/eventFormRoutes.ts:178 | — | 1 / 0 / 0 |
| POST | eventFormRouter | /club/events/:eventId/form/revert/:versionId | Backend/src/Routes/events/eventFormRoutes.ts:205 | — | 1 / 0 / 0 |
| POST | eventFormRouter | /club/events/:eventId/form/questions | Backend/src/Routes/events/eventFormRoutes.ts:231 | — | 1 / 0 / 0 |
| PUT | eventFormRouter | /club/events/:eventId/form/questions/:questionId | Backend/src/Routes/events/eventFormRoutes.ts:260 | — | 1 / 0 / 0 |
| DELETE | eventFormRouter | /club/events/:eventId/form/questions/:questionId | Backend/src/Routes/events/eventFormRoutes.ts:285 | — | 1 / 0 / 0 |
| POST | eventFormRouter | /club/events/:eventId/form/sections | Backend/src/Routes/events/eventFormRoutes.ts:310 | — | 1 / 0 / 0 |
| DELETE | eventFormRouter | /club/events/:eventId/form/sections/:sectionId | Backend/src/Routes/events/eventFormRoutes.ts:334 | — | 1 / 0 / 0 |
| PUT | eventFormRouter | /club/events/:eventId/form/reorder | Backend/src/Routes/events/eventFormRoutes.ts:359 | — | 1 / 0 / 0 |
| POST | eventFormRouter | /club/events/:eventId/form/import-questions | Backend/src/Routes/events/eventFormRoutes.ts:383 | — | 1 / 0 / 0 |
| GET | eventFormRouter | /club/events/:eventId/form/question-library | Backend/src/Routes/events/eventFormRoutes.ts:412 | — | 1 / 0 / 0 |
| POST | eventFormRouter | /club/events/:eventId/form/ai-suggest | Backend/src/Routes/events/eventFormRoutes.ts:434 | — | 1 / 0 / 0 |
| POST | eventFormRouter | /club/events/:eventId/form/qr-checkin | Backend/src/Routes/events/eventFormRoutes.ts:462 | — | 1 / 0 / 0 |
| GET | eventFormRouter | /club/:clubId/forms/cross-event-analytics | Backend/src/Routes/events/eventFormRoutes.ts:488 | — | 1 / 0 / 0 |
| GET | eventFormRouter | /club/events/:eventId/form/versions | Backend/src/Routes/events/eventFormRoutes.ts:509 | — | 1 / 0 / 0 |
| GET | eventFormRouter | /club/events/:eventId/form/versions/:versionId | Backend/src/Routes/events/eventFormRoutes.ts:532 | — | 1 / 0 / 0 |
| GET | eventFormRouter | /club/events/:eventId/form/responses | Backend/src/Routes/events/eventFormRoutes.ts:555 | — | 1 / 0 / 0 |
| GET | eventFormRouter | /club/events/:eventId/form/responses/export | Backend/src/Routes/events/eventFormRoutes.ts:625 | — | 1 / 0 / 0 |
| POST | eventFormRouter | /club/events/:eventId/form/responses/export | Backend/src/Routes/events/eventFormRoutes.ts:660 | — | 1 / 0 / 0 |
| PUT | eventFormRouter | /club/events/:eventId/form/responses/:registrationId/status | Backend/src/Routes/events/eventFormRoutes.ts:690 | — | 1 / 0 / 0 |
| GET | eventFormRouter | /club/events/:eventId/form/stats | Backend/src/Routes/events/eventFormRoutes.ts:720 | — | 1 / 0 / 0 |
| POST | eventFormRouter | /club/events/:eventId/form/release-grades | Backend/src/Routes/events/eventFormRoutes.ts:744 | — | 1 / 0 / 0 |
| POST | eventFormRouter | /club/events/:eventId/form/upload-signature | Backend/src/Routes/events/eventFormRoutes.ts:769 | — | 1 / 0 / 0 |
| GET | eventFormRouter | /events/:eventId/form | Backend/src/Routes/events/eventFormRoutes.ts:806 | optionalAuthenticate | 1 / 0 / 0 |
| GET | eventFormRouter | /events/:eventId/form/draft | Backend/src/Routes/events/eventFormRoutes.ts:852 | authenticate | 1 / 0 / 0 |
| PUT | eventFormRouter | /events/:eventId/form/draft | Backend/src/Routes/events/eventFormRoutes.ts:875 | authenticate, rateLimitDraftAutosave | 1 / 0 / 0 |
| DELETE | eventFormRouter | /events/:eventId/form/draft | Backend/src/Routes/events/eventFormRoutes.ts:899 | authenticate | 1 / 0 / 0 |
| POST | eventFormRouter | /events/:eventId/form/upload-signature | Backend/src/Routes/events/eventFormRoutes.ts:922 | authenticate | 1 / 0 / 0 |
| POST | eventFormRouter | /events/:eventId/form/upload | Backend/src/Routes/events/eventFormRoutes.ts:952 | authenticate | 1 / 0 / 0 |
| POST | eventFormRouter | /events/:eventId/form/submit | Backend/src/Routes/events/eventFormRoutes.ts:1020 | optionalAuthenticate, rateLimitFormSubmissions, preventConcurrentSubmissions, handleFormSubmission | 0 / 0 / 0 |
| POST | eventFormRouter | /events/:eventId/register | Backend/src/Routes/events/eventFormRoutes.ts:1021 | optionalAuthenticate, rateLimitFormSubmissions, preventConcurrentSubmissions, handleFormSubmission | 0 / 0 / 0 |
| GET | eventFormRouter | /events/:eventId/form/registration | Backend/src/Routes/events/eventFormRoutes.ts:1027 | authenticate | 1 / 0 / 0 |
| PUT | eventFormRouter | /events/:eventId/form/registration | Backend/src/Routes/events/eventFormRoutes.ts:1050 | authenticate, rateLimitFormSubmissions, preventConcurrentSubmissions | 1 / 0 / 0 |
| POST | eventFormRouter | /events/:eventId/form/cancel | Backend/src/Routes/events/eventFormRoutes.ts:1075 | authenticate | 1 / 0 / 0 |
| GET | eventLifecycleRouter | /club/events/:eventId/stages | Backend/src/Routes/events/eventLifecycleRoutes.ts:18 | authenticate, requireClubAccount | 1 / 0 / 0 |
| POST | eventLifecycleRouter | /club/events/:eventId/stages/batch | Backend/src/Routes/events/eventLifecycleRoutes.ts:38 | authenticate, requireClubAccount | 1 / 0 / 0 |
| PATCH | eventLifecycleRouter | /club/events/:eventId/stages/:stageId | Backend/src/Routes/events/eventLifecycleRoutes.ts:65 | authenticate, requireClubAccount | 1 / 0 / 0 |
| DELETE | eventLifecycleRouter | /club/events/:eventId/stages/:stageId | Backend/src/Routes/events/eventLifecycleRoutes.ts:87 | authenticate, requireClubAccount | 1 / 0 / 0 |
| POST | eventLifecycleRouter | /club/events/:eventId/stages/reorder | Backend/src/Routes/events/eventLifecycleRoutes.ts:109 | authenticate, requireClubAccount | 1 / 0 / 0 |
| POST | eventLifecycleRouter | /club/events/:eventId/stages/:stageId/override | Backend/src/Routes/events/eventLifecycleRoutes.ts:130 | authenticate, requireClubAccount | 1 / 0 / 0 |
| GET | eventLifecycleRouter | /club/events/:eventId/stages/:stageId/form | Backend/src/Routes/events/eventLifecycleRoutes.ts:161 | authenticate, requireClubAccount | 1 / 0 / 0 |
| PUT | eventLifecycleRouter | /club/events/:eventId/stages/:stageId/form | Backend/src/Routes/events/eventLifecycleRoutes.ts:181 | authenticate, requireClubAccount | 1 / 0 / 0 |
| GET | eventLifecycleRouter | /club/events/:eventId/stages/:stageId/submissions | Backend/src/Routes/events/eventLifecycleRoutes.ts:202 | authenticate, requireClubAccount | 1 / 0 / 0 |
| GET | eventLifecycleRouter | /club/events/:eventId/stages/:stageId/criteria | Backend/src/Routes/events/eventLifecycleRoutes.ts:227 | authenticate | 1 / 0 / 0 |
| PUT | eventLifecycleRouter | /club/events/:eventId/stages/:stageId/criteria | Backend/src/Routes/events/eventLifecycleRoutes.ts:246 | authenticate, requireClubAccount | 1 / 0 / 0 |
| GET | eventLifecycleRouter | /club/events/:eventId/stages/:stageId/judges | Backend/src/Routes/events/eventLifecycleRoutes.ts:268 | authenticate, requireClubAccount | 1 / 0 / 0 |
| POST | eventLifecycleRouter | /club/events/:eventId/stages/:stageId/judges | Backend/src/Routes/events/eventLifecycleRoutes.ts:288 | authenticate, requireClubAccount | 1 / 0 / 0 |
| POST | eventLifecycleRouter | /club/events/:eventId/stages/:stageId/shortlist | Backend/src/Routes/events/eventLifecycleRoutes.ts:310 | authenticate, requireClubAccount | 1 / 0 / 0 |
| GET | eventLifecycleRouter | /club/events/:eventId/stages/:stageId/advancements | Backend/src/Routes/events/eventLifecycleRoutes.ts:337 | authenticate | 1 / 0 / 0 |
| GET | eventLifecycleRouter | /events/:eventId/timeline | Backend/src/Routes/events/eventLifecycleRoutes.ts:360 | optionalAuthenticate | 1 / 0 / 0 |
| GET | eventLifecycleRouter | /events/:eventId/stages/:stageId/my-submission | Backend/src/Routes/events/eventLifecycleRoutes.ts:375 | authenticate | 2 / 1 / 0 |
| POST | eventLifecycleRouter | /events/:eventId/stages/:stageId/upload-signature | Backend/src/Routes/events/eventLifecycleRoutes.ts:407 | authenticate | 1 / 0 / 0 |
| POST | eventLifecycleRouter | /events/:eventId/stages/:stageId/submit | Backend/src/Routes/events/eventLifecycleRoutes.ts:436 | authenticate | 2 / 1 / 0 |
| POST | eventLifecycleRouter | /judging/stages/:stageId/submissions/:submissionId/evaluate | Backend/src/Routes/events/eventLifecycleRoutes.ts:492 | authenticate | 1 / 0 / 0 |
| GET | eventsRouter | / | Backend/src/Routes/events/events.ts:780 | — | 1 / 0 / 0 |
| POST | eventsRouter | /reminders | Backend/src/Routes/events/events.ts:823 | optionalAuthenticate | 0 / 0 / 0 |
| GET | eventsRouter | /reminders | Backend/src/Routes/events/events.ts:846 | optionalAuthenticate | 0 / 0 / 0 |
| POST | eventTeamRouter | /events/:eventId/teams | Backend/src/Routes/events/eventTeamRoutes.ts:12 | authenticate | 1 / 0 / 0 |
| POST | eventTeamRouter | /events/:eventId/teams/join | Backend/src/Routes/events/eventTeamRoutes.ts:37 | authenticate | 1 / 0 / 0 |
| GET | eventTeamRouter | /events/:eventId/my-team | Backend/src/Routes/events/eventTeamRoutes.ts:62 | authenticate | 1 / 0 / 0 |
| GET | eventTeamRouter | /events/:eventId/teams/:teamId | Backend/src/Routes/events/eventTeamRoutes.ts:86 | authenticate | 1 / 0 / 0 |
| GET | eventTeamRouter | /events/:eventId/search-users | Backend/src/Routes/events/eventTeamRoutes.ts:109 | authenticate | 1 / 0 / 0 |
| GET | eventTeamRouter | /events/:eventId/teams/:teamId/search-users | Backend/src/Routes/events/eventTeamRoutes.ts:134 | authenticate | 1 / 0 / 0 |
| POST | eventTeamRouter | /events/:eventId/teams/:teamId/invites | Backend/src/Routes/events/eventTeamRoutes.ts:159 | authenticate | 1 / 0 / 0 |
| DELETE | eventTeamRouter | /events/:eventId/teams/:teamId/invites/:invitationId | Backend/src/Routes/events/eventTeamRoutes.ts:185 | authenticate | 1 / 0 / 0 |
| POST | eventTeamRouter | /events/:eventId/teams/:teamId/invites/:invitationId/cancel | Backend/src/Routes/events/eventTeamRoutes.ts:203 | authenticate | 1 / 0 / 0 |
| GET | eventTeamRouter | /events/invitations/my | Backend/src/Routes/events/eventTeamRoutes.ts:225 | authenticate | 1 / 0 / 0 |
| POST | eventTeamRouter | /events/invitations/:invitationId/respond | Backend/src/Routes/events/eventTeamRoutes.ts:246 | authenticate | 1 / 0 / 0 |
| POST | eventTeamRouter | /events/:eventId/teams/:teamId/leave | Backend/src/Routes/events/eventTeamRoutes.ts:271 | authenticate | 1 / 0 / 0 |
| DELETE | eventTeamRouter | /events/:eventId/teams/:teamId/members/:targetUserId | Backend/src/Routes/events/eventTeamRoutes.ts:291 | authenticate | 1 / 0 / 0 |
| POST | eventTeamRouter | /events/:eventId/teams/:teamId/transfer-leader | Backend/src/Routes/events/eventTeamRoutes.ts:312 | authenticate | 1 / 0 / 0 |
| PATCH | eventTeamRouter | /events/:eventId/teams/:teamId/rename | Backend/src/Routes/events/eventTeamRoutes.ts:337 | authenticate | 1 / 0 / 0 |
| GET | eventTeamRouter | /club/events/:eventId/teams | Backend/src/Routes/events/eventTeamRoutes.ts:358 | authenticate, requireClubAccount | 1 / 0 / 0 |
| POST | helpRouter | /upload-signature | Backend/src/Routes/help/helpRoutes.ts:21 | authenticate | 0 / 0 / 0 |
| POST | helpRouter | /upload | Backend/src/Routes/help/helpRoutes.ts:76 | authenticate | 1 / 0 / 0 |
| POST | helpRouter | /tickets | Backend/src/Routes/help/helpRoutes.ts:159 | authenticate | 6 / 5 / 0 |
| GET | helpRouter | /tickets | Backend/src/Routes/help/helpRoutes.ts:388 | authenticate | 2 / 2 / 0 |
| GET | helpRouter | /tickets/:id | Backend/src/Routes/help/helpRoutes.ts:471 | authenticate | 2 / 2 / 0 |
| POST | helpRouter | /tickets/:id/messages | Backend/src/Routes/help/helpRoutes.ts:554 | authenticate | 3 / 3 / 0 |
| GET | helpRouter | /categories | Backend/src/Routes/help/helpRoutes.ts:679 | — | 0 / 0 / 0 |
| GET | helpRouter | /faqs | Backend/src/Routes/help/helpRoutes.ts:745 | — | 1 / 1 / 0 |
| POST | helpRouter | /faqs/:id/feedback | Backend/src/Routes/help/helpRoutes.ts:804 | — | 5 / 5 / 0 |
| GET | helpRouter | /admin/tickets | Backend/src/Routes/help/helpRoutes.ts:862 | authenticate, requireSupportStaff | 2 / 2 / 0 |
| PATCH | helpRouter | /admin/tickets/:id | Backend/src/Routes/help/helpRoutes.ts:943 | authenticate, requireSupportStaff | 3 / 3 / 0 |
| POST | helpRouter | /admin/tickets/:id/reply | Backend/src/Routes/help/helpRoutes.ts:1041 | authenticate, requireSupportStaff | 4 / 4 / 0 |
| GET | institutionsRouter | /search | Backend/src/Routes/institutions/institutions.ts:12 | — | 2 / 2 / 0 |
| GET | institutionsRouter | /:id | Backend/src/Routes/institutions/institutions.ts:96 | — | 1 / 1 / 0 |
| POST | institutionsRouter | /verification-request | Backend/src/Routes/institutions/institutions.ts:154 | optionalAuthenticate | 3 / 3 / 0 |
| GET | institutionsRouter | /verification-requests/mine | Backend/src/Routes/institutions/institutions.ts:267 | authenticate | 1 / 1 / 0 |
| GET | leaderboardRouter | /algorithm | Backend/src/Routes/leaderboard/leaderboard.ts:637 | — | 0 / 0 / 0 |
| GET | leaderboardRouter | /colleges/:collegeId | Backend/src/Routes/leaderboard/leaderboard.ts:939 | optionalAuthenticate | 12 / 4 / 0 |
| GET | leaderboardRouter | /rank/:username | Backend/src/Routes/leaderboard/leaderboard.ts:1427 | — | 1 / 0 / 0 |
| POST | leaderboardRouter | /sync | Backend/src/Routes/leaderboard/leaderboard.ts:1458 | authenticate | 1 / 0 / 0 |
| POST | leaderboardRouter | /recalculate-all | Backend/src/Routes/leaderboard/leaderboard.ts:1490 | — | 3 / 1 / 0 |
| GET | notificationsRouter | / | Backend/src/Routes/notifications/notifications.ts:12 | authenticate | 3 / 4 / 0 |
| GET | notificationsRouter | /unread-count | Backend/src/Routes/notifications/notifications.ts:196 | authenticate | 1 / 1 / 0 |
| POST | notificationsRouter | /mark-read | Backend/src/Routes/notifications/notifications.ts:233 | authenticate | 2 / 2 / 0 |
| POST | notificationsRouter | /mark-unread | Backend/src/Routes/notifications/notifications.ts:282 | authenticate | 1 / 1 / 0 |
| POST | notificationsRouter | /bulk-delete | Backend/src/Routes/notifications/notifications.ts:322 | authenticate | 1 / 1 / 0 |
| DELETE | notificationsRouter | /:id | Backend/src/Routes/notifications/notifications.ts:360 | authenticate | 1 / 1 / 0 |
| POST | notificationsRouter | /send | Backend/src/Routes/notifications/notifications.ts:397 | authenticate, handleSendNotification | 0 / 0 / 0 |
| GET | platformRouter | /about | Backend/src/Routes/platform/platformRoutes.ts:59 | — | 0 / 0 / 0 |
| GET | portalsRouter | /fetch | Backend/src/Routes/portals/portals.ts:1763 | — | 1 / 0 / 0 |
| GET | portalsRouter | /submissions/unified | Backend/src/Routes/portals/portals.ts:2387 | — | 7 / 1 / 0 |
| GET | portalsRouter | /development/unified | Backend/src/Routes/portals/portals.ts:2821 | — | 4 / 0 / 0 |
| GET | portalsRouter | /contests | Backend/src/Routes/portals/portals.ts:2927 | — | 5 / 1 / 0 |
| POST | portalsRouter | /save | Backend/src/Routes/portals/portals.ts:4082 | authenticate, handleSavePortals | 0 / 0 / 0 |
| POST | portalsRouter | /profile/save | Backend/src/Routes/portals/portals.ts:4083 | authenticate, handleSavePortals | 0 / 0 / 0 |
| GET | portalsRouter | /save | Backend/src/Routes/portals/portals.ts:4084 | authenticate, handleGetSavedPortals | 0 / 0 / 0 |
| GET | portalsRouter | /profile/save | Backend/src/Routes/portals/portals.ts:4085 | authenticate, handleGetSavedPortals | 0 / 0 / 0 |
| GET | portalsRouter | /links | Backend/src/Routes/portals/portals.ts:4086 | authenticate, handleGetSavedPortals | 0 / 0 / 0 |
| POST | portalsRouter | /resync | Backend/src/Routes/portals/portals.ts:4089 | authenticate, handleResyncPortals | 0 / 0 / 0 |
| GET | portalsRouter | /resync | Backend/src/Routes/portals/portals.ts:4090 | authenticate, handleResyncPortals | 0 / 0 / 0 |
| POST | portalsRouter | /profile/resync | Backend/src/Routes/portals/portals.ts:4091 | authenticate, handleResyncPortals | 0 / 0 / 0 |
| GET | portalsRouter | /profile/resync | Backend/src/Routes/portals/portals.ts:4092 | authenticate, handleResyncPortals | 0 / 0 / 0 |
| POST | portalsRouter | /verification/initiate | Backend/src/Routes/portals/portals.ts:4098 | authenticate | 2 / 0 / 0 |
| POST | portalsRouter | /verification/confirm | Backend/src/Routes/portals/portals.ts:4177 | authenticate | 2 / 0 / 0 |
| POST | portalsRouter | /verification/cancel | Backend/src/Routes/portals/portals.ts:4248 | authenticate | 1 / 0 / 0 |
| DELETE | portalsRouter | /:portal | Backend/src/Routes/portals/portals.ts:4263 | authenticate | 2 / 1 / 0 |
| PUT | portalsRouter | /:portal | Backend/src/Routes/portals/portals.ts:4306 | authenticate | 5 / 2 / 0 |
| POST | photoRouter | /upload-signature | Backend/src/Routes/profile/photo.ts:631 | handleUploadSignature | 0 / 0 / 0 |
| POST | photoRouter | /confirm | Backend/src/Routes/profile/photo.ts:632 | handleConfirmPhoto | 0 / 0 / 0 |
| POST | photoRouter | /restore | Backend/src/Routes/profile/photo.ts:633 | handleRestorePhoto | 0 / 0 / 0 |
| POST | photoRouter | /default | Backend/src/Routes/profile/photo.ts:634 | handleUseDefaultAvatar | 0 / 0 / 0 |
| DELETE | photoRouter | / | Backend/src/Routes/profile/photo.ts:635 | handleUseDefaultAvatar | 0 / 0 / 0 |
| GET | profileRouter | /me | Backend/src/Routes/profile/profile.ts:364 | authenticate, handleGetMyProfile | 0 / 0 / 0 |
| GET | profileRouter | / | Backend/src/Routes/profile/profile.ts:365 | authenticate, handleGetMyProfile | 0 / 0 / 0 |
| PUT | profileRouter | / | Backend/src/Routes/profile/profile.ts:371 | authenticate | 17 / 15 / 0 |
| GET | profileRouter | /public/:username | Backend/src/Routes/profile/profile.ts:1337 | optionalAuthenticate, handleGetPublicProfile | 0 / 0 / 0 |
| GET | profileRouter | /user/:username | Backend/src/Routes/profile/profile.ts:1338 | optionalAuthenticate, handleGetPublicProfile | 0 / 0 / 0 |
| GET | profileRouter | /explore | Backend/src/Routes/profile/profile.ts:1722 | optionalAuthenticate, handleExploreProfiles | 0 / 0 / 0 |
| GET | profileRouter | /privacy-audit/:username | Backend/src/Routes/profile/profile.ts:1723 | authenticate, handlePrivacyAudit | 0 / 0 / 0 |
| GET | profileRouter | /:username/privacy-audit | Backend/src/Routes/profile/profile.ts:1724 | authenticate, handlePrivacyAudit | 0 / 0 / 0 |
| POST | profileRouter | /:username/hire-message | Backend/src/Routes/profile/profile.ts:1855 | handleSendHireMessage | 0 / 0 / 0 |
| POST | profileRouter | /hire-message | Backend/src/Routes/profile/profile.ts:1856 | handleSendHireMessage | 0 / 0 / 0 |
| GET | profileRouter | /messages | Backend/src/Routes/profile/profile.ts:1862 | authenticate | 1 / 1 / 0 |
| DELETE | profileRouter | /platforms/:portal | Backend/src/Routes/profile/profile.ts:1896 | authenticate | 2 / 1 / 0 |
| PUT | profileRouter | /platforms/:portal | Backend/src/Routes/profile/profile.ts:1942 | authenticate | 6 / 3 / 0 |
| GET | resumeRouter | / | Backend/src/Routes/profile/resume.ts:1070 | authenticate, restrictClubAccounts, handleGetResume | 0 / 0 / 0 |
| GET | resumeRouter | /view | Backend/src/Routes/profile/resume.ts:1071 | authenticate, restrictClubAccounts | 0 / 0 / 0 |
| GET | resumeRouter | /view/:username | Backend/src/Routes/profile/resume.ts:1072 | optionalAuthenticate | 0 / 0 / 0 |
| GET | resumeRouter | /download | Backend/src/Routes/profile/resume.ts:1073 | authenticate, restrictClubAccounts | 0 / 0 / 0 |
| GET | resumeRouter | /download/:username | Backend/src/Routes/profile/resume.ts:1074 | optionalAuthenticate | 0 / 0 / 0 |
| POST | resumeRouter | /upload | Backend/src/Routes/profile/resume.ts:1075 | authenticate, restrictClubAccounts, handleDirectResumeUpload | 0 / 0 / 0 |
| POST | resumeRouter | /re-analyze | Backend/src/Routes/profile/resume.ts:1076 | authenticate, restrictClubAccounts, handleReAnalyzeResume | 0 / 0 / 0 |
| DELETE | resumeRouter | / | Backend/src/Routes/profile/resume.ts:1077 | authenticate, restrictClubAccounts, handleDeleteResume | 0 / 0 / 0 |
| PATCH | resumeRouter | /visibility | Backend/src/Routes/profile/resume.ts:1078 | authenticate, restrictClubAccounts, handleToggleResumeVisibility | 0 / 0 / 0 |
| GET | resumeRouter | /public/:username | Backend/src/Routes/profile/resume.ts:1079 | optionalAuthenticate, handleGetPublicResume | 0 / 0 / 0 |
| POST | intelligenceRouter | /upload-analyze | Backend/src/Routes/profile/resumeIntelligence.ts:37 | authenticate | 4 / 2 / 0 |
| POST | intelligenceRouter | /analyze | Backend/src/Routes/profile/resumeIntelligence.ts:112 | authenticate | 3 / 2 / 0 |
| GET | intelligenceRouter | /sync-proposal | Backend/src/Routes/profile/resumeIntelligence.ts:167 | authenticate | 1 / 1 / 0 |
| POST | intelligenceRouter | /apply-sync | Backend/src/Routes/profile/resumeIntelligence.ts:217 | authenticate | 5 / 3 / 0 |
| GET | projectRouter | / | Backend/src/Routes/projects/projectRoutes.ts:41 | authenticate | 1 / 0 / 0 |
| POST | projectRouter | /analyze-repo | Backend/src/Routes/projects/projectRoutes.ts:67 | authenticate | 1 / 0 / 0 |
| GET | projectRouter | /github-app/install | Backend/src/Routes/projects/projectRoutes.ts:115 | authenticate | 0 / 0 / 0 |
| GET | projectRouter | /github-app/callback | Backend/src/Routes/projects/projectRoutes.ts:143 | — | 1 / 0 / 0 |
| GET | projectRouter | /github-app/status | Backend/src/Routes/projects/projectRoutes.ts:181 | authenticate | 1 / 0 / 0 |
| DELETE | projectRouter | /github-app/disconnect | Backend/src/Routes/projects/projectRoutes.ts:205 | authenticate | 1 / 0 / 0 |
| GET | projectRouter | /user/:username | Backend/src/Routes/projects/projectRoutes.ts:230 | optionalAuthenticate | 1 / 0 / 0 |
| GET | projectRouter | /:id | Backend/src/Routes/projects/projectRoutes.ts:256 | optionalAuthenticate | 1 / 0 / 0 |
| POST | projectRouter | / | Backend/src/Routes/projects/projectRoutes.ts:278 | authenticate | 1 / 0 / 0 |
| PUT | projectRouter | /:id | Backend/src/Routes/projects/projectRoutes.ts:306 | authenticate | 1 / 0 / 0 |
| DELETE | projectRouter | /:id | Backend/src/Routes/projects/projectRoutes.ts:335 | authenticate | 1 / 0 / 0 |
| PATCH | projectRouter | /reorder | Backend/src/Routes/projects/projectRoutes.ts:362 | authenticate | 1 / 0 / 0 |
| PATCH | projectRouter | /:id/publish | Backend/src/Routes/projects/projectRoutes.ts:396 | authenticate | 1 / 0 / 0 |
| POST | projectRouter | /media/signature | Backend/src/Routes/projects/projectRoutes.ts:426 | authenticate | 0 / 0 / 0 |
| GET | projectRouter | /:id/sync/diff | Backend/src/Routes/projects/projectRoutes.ts:481 | authenticate | 1 / 0 / 0 |
| POST | projectRouter | /:id/sync/merge | Backend/src/Routes/projects/projectRoutes.ts:508 | authenticate | 1 / 0 / 0 |
| POST | projectRouter | /:id/sync/reset-field | Backend/src/Routes/projects/projectRoutes.ts:537 | authenticate | 1 / 0 / 0 |
| POST | relationshipRouter | /batch | Backend/src/Routes/relationships/relationshipRoutes.ts:60 | authenticate | 1 / 0 / 0 |
| GET | relationshipRouter | /requests/pending | Backend/src/Routes/relationships/relationshipRoutes.ts:93 | authenticate | 1 / 0 / 0 |
| GET | relationshipRouter | /quota | Backend/src/Routes/relationships/relationshipRoutes.ts:119 | authenticate | 1 / 0 / 0 |
| GET | relationshipRouter | /:userId | Backend/src/Routes/relationships/relationshipRoutes.ts:141 | authenticate | 2 / 0 / 0 |
| POST | relationshipRouter | /:userId/request | Backend/src/Routes/relationships/relationshipRoutes.ts:172 | authenticate | 2 / 0 / 0 |
| POST | relationshipRouter | /:userId/accept | Backend/src/Routes/relationships/relationshipRoutes.ts:213 | authenticate | 2 / 0 / 0 |
| POST | relationshipRouter | /:userId/decline | Backend/src/Routes/relationships/relationshipRoutes.ts:247 | authenticate | 2 / 0 / 0 |
| POST | relationshipRouter | /:userId/cancel | Backend/src/Routes/relationships/relationshipRoutes.ts:276 | authenticate | 2 / 0 / 0 |
| DELETE | relationshipRouter | /:userId | Backend/src/Routes/relationships/relationshipRoutes.ts:305 | authenticate | 2 / 0 / 0 |
| POST | blockRouter | /:userId | Backend/src/Routes/relationships/relationshipRoutes.ts:338 | authenticate | 2 / 0 / 0 |
| DELETE | blockRouter | /:userId | Backend/src/Routes/relationships/relationshipRoutes.ts:382 | authenticate | 2 / 0 / 0 |
| GET | settingsRelationshipRouter | /connections | Backend/src/Routes/relationships/relationshipRoutes.ts:414 | authenticate | 1 / 0 / 0 |
| GET | settingsRelationshipRouter | /blocked | Backend/src/Routes/relationships/relationshipRoutes.ts:440 | authenticate | 1 / 0 / 0 |
| GET | sessionRouter | /overview | Backend/src/Routes/session/sessionRoutes.ts:24 | authenticate | 1 / 0 / 0 |
| GET | sessionRouter | / | Backend/src/Routes/session/sessionRoutes.ts:48 | authenticate | 1 / 0 / 0 |
| GET | sessionRouter | /history | Backend/src/Routes/session/sessionRoutes.ts:72 | authenticate | 1 / 0 / 0 |
| DELETE | sessionRouter | /:sessionId | Backend/src/Routes/session/sessionRoutes.ts:98 | authenticate | 1 / 0 / 0 |
| POST | sessionRouter | /revoke-others | Backend/src/Routes/session/sessionRoutes.ts:122 | authenticate | 1 / 0 / 0 |
| POST | sessionRouter | /revoke-all | Backend/src/Routes/session/sessionRoutes.ts:153 | authenticate | 1 / 0 / 0 |
| GET | sessionRouter | /security-events | Backend/src/Routes/session/sessionRoutes.ts:181 | authenticate | 1 / 0 / 0 |
| GET | sessionRouter | /clubs/:clubId/activity | Backend/src/Routes/session/sessionRoutes.ts:213 | authenticate, requireClubAccount | 1 / 0 / 0 |
| POST | sessionRouter | /clubs/:clubId/activity/log | Backend/src/Routes/session/sessionRoutes.ts:250 | authenticate, requireClubAccount | 1 / 0 / 0 |
| GET | studentCollegeVerificationRouter | /status | Backend/src/Routes/verification/collegeVerificationRoutes.ts:61 | authenticate, requireStudentAccount | 1 / 0 / 0 |
| POST | studentCollegeVerificationRouter | /ocr-preview | Backend/src/Routes/verification/collegeVerificationRoutes.ts:79 | authenticate, requireStudentAccount | 1 / 0 / 0 |
| POST | studentCollegeVerificationRouter | /submit | Backend/src/Routes/verification/collegeVerificationRoutes.ts:120 | authenticate, requireStudentAccount | 0 / 0 / 0 |
| POST | studentCollegeVerificationRouter | /email/send | Backend/src/Routes/verification/collegeVerificationRoutes.ts:122 | authenticate, requireStudentAccount | 0 / 0 / 0 |
| GET | studentCollegeVerificationRouter | /email/verify | Backend/src/Routes/verification/collegeVerificationRoutes.ts:166 | authenticate, requireStudentAccount, handleEmailTokenVerification | 0 / 0 / 0 |
| POST | studentCollegeVerificationRouter | /email/verify | Backend/src/Routes/verification/collegeVerificationRoutes.ts:167 | authenticate, requireStudentAccount, handleEmailTokenVerification | 0 / 0 / 0 |
| GET | verificationRouter | /status | Backend/src/Routes/verification/verificationRoutes.ts:12 | authenticate | 1 / 0 / 0 |
| POST | verificationRouter | /send-otp | Backend/src/Routes/verification/verificationRoutes.ts:39 | authenticate | 1 / 0 / 0 |
| POST | verificationRouter | /verify-otp | Backend/src/Routes/verification/verificationRoutes.ts:84 | authenticate | 1 / 0 / 0 |
| POST | verificationRouter | /phone/verify-firebase | Backend/src/Routes/verification/verificationRoutes.ts:120 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /health | Backend/src/Routes/workspace/workspaceRoutes.ts:93 | — | 1 / 0 / 0 |
| GET | workspaceRouter | / | Backend/src/Routes/workspace/workspaceRoutes.ts:123 | authenticate | 6 / 0 / 0 |
| GET | workspaceRouter | /capabilities | Backend/src/Routes/workspace/workspaceRoutes.ts:170 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /my-workspaces | Backend/src/Routes/workspace/workspaceRoutes.ts:203 | authenticate | 2 / 1 / 0 |
| GET | workspaceRouter | /templates | Backend/src/Routes/workspace/workspaceRoutes.ts:251 | authenticate | 0 / 0 / 0 |
| POST | workspaceRouter | /templates/apply | Backend/src/Routes/workspace/workspaceRoutes.ts:260 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /manager | Backend/src/Routes/workspace/workspaceRoutes.ts:300 | authenticate | 3 / 0 / 0 |
| DELETE | workspaceRouter | /manager | Backend/src/Routes/workspace/workspaceRoutes.ts:336 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /settings | Backend/src/Routes/workspace/workspaceRoutes.ts:370 | authenticate | 3 / 0 / 0 |
| PATCH | workspaceRouter | /settings | Backend/src/Routes/workspace/workspaceRoutes.ts:416 | authenticate | 11 / 4 / 0 |
| GET | workspaceRouter | /departments | Backend/src/Routes/workspace/workspaceRoutes.ts:503 | authenticate | 4 / 0 / 0 |
| POST | workspaceRouter | /departments/seed-defaults | Backend/src/Routes/workspace/workspaceRoutes.ts:530 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /departments | Backend/src/Routes/workspace/workspaceRoutes.ts:560 | authenticate | 3 / 0 / 0 |
| PUT | workspaceRouter | /departments/reorder | Backend/src/Routes/workspace/workspaceRoutes.ts:591 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /departments/:deptId | Backend/src/Routes/workspace/workspaceRoutes.ts:622 | authenticate | 3 / 0 / 0 |
| PATCH | workspaceRouter | /departments/:deptId | Backend/src/Routes/workspace/workspaceRoutes.ts:644 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /departments/:deptId/archive | Backend/src/Routes/workspace/workspaceRoutes.ts:677 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /departments/:deptId/restore | Backend/src/Routes/workspace/workspaceRoutes.ts:705 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /departments/:deptId/members | Backend/src/Routes/workspace/workspaceRoutes.ts:734 | authenticate | 3 / 0 / 0 |
| DELETE | workspaceRouter | /departments/:deptId/members/:memberId | Backend/src/Routes/workspace/workspaceRoutes.ts:774 | authenticate | 3 / 0 / 0 |
| PATCH | workspaceRouter | /departments/:deptId/members/:memberId/role | Backend/src/Routes/workspace/workspaceRoutes.ts:805 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /departments/transfer | Backend/src/Routes/workspace/workspaceRoutes.ts:837 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /departments/transfers | Backend/src/Routes/workspace/workspaceRoutes.ts:872 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /members | Backend/src/Routes/workspace/workspaceRoutes.ts:904 | authenticate | 7 / 0 / 0 |
| PATCH | workspaceRouter | /members/:targetUserId/role | Backend/src/Routes/workspace/workspaceRoutes.ts:1002 | authenticate | 3 / 0 / 0 |
| PATCH | workspaceRouter | /members/:targetUserId/suspension | Backend/src/Routes/workspace/workspaceRoutes.ts:1039 | authenticate | 3 / 0 / 0 |
| PATCH | workspaceRouter | /members/:targetUserId/permissions | Backend/src/Routes/workspace/workspaceRoutes.ts:1113 | authenticate, handleMemberPermissionsUpdate | 0 / 0 / 0 |
| PATCH | workspaceRouter | /members/:targetUserId/custom-permissions | Backend/src/Routes/workspace/workspaceRoutes.ts:1114 | authenticate, handleMemberPermissionsUpdate | 0 / 0 / 0 |
| DELETE | workspaceRouter | /members/:targetUserId | Backend/src/Routes/workspace/workspaceRoutes.ts:1120 | authenticate | 3 / 0 / 0 |
| PATCH | workspaceRouter | /members/:targetUserId/custom-permissions | Backend/src/Routes/workspace/workspaceRoutes.ts:1149 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /invitations | Backend/src/Routes/workspace/workspaceRoutes.ts:1193 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /invitations | Backend/src/Routes/workspace/workspaceRoutes.ts:1230 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /invitations/:invitationId/revoke | Backend/src/Routes/workspace/workspaceRoutes.ts:1250 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /invitations/verify | Backend/src/Routes/workspace/workspaceRoutes.ts:1279 | — | 1 / 0 / 0 |
| GET | workspaceRouter | /invitations/my-pending | Backend/src/Routes/workspace/workspaceRoutes.ts:1297 | authenticate | 2 / 2 / 0 |
| POST | workspaceRouter | /invitations/accept | Backend/src/Routes/workspace/workspaceRoutes.ts:1391 | authenticate | 14 / 3 / 0 |
| GET | workspaceRouter | /roles | Backend/src/Routes/workspace/workspaceRoutes.ts:1565 | authenticate | 4 / 0 / 0 |
| POST | workspaceRouter | /roles | Backend/src/Routes/workspace/workspaceRoutes.ts:1590 | authenticate | 3 / 0 / 0 |
| PATCH | workspaceRouter | /roles/:roleId | Backend/src/Routes/workspace/workspaceRoutes.ts:1623 | authenticate | 3 / 0 / 0 |
| DELETE | workspaceRouter | /roles/:roleId | Backend/src/Routes/workspace/workspaceRoutes.ts:1661 | authenticate | 3 / 0 / 0 |
| PUT | workspaceRouter | /roles/reorder | Backend/src/Routes/workspace/workspaceRoutes.ts:1690 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /permissions/preview | Backend/src/Routes/workspace/workspaceRoutes.ts:1723 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /categories | Backend/src/Routes/workspace/workspaceRoutes.ts:1756 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /categories | Backend/src/Routes/workspace/workspaceRoutes.ts:1777 | authenticate | 3 / 0 / 0 |
| PUT | workspaceRouter | /categories/reorder | Backend/src/Routes/workspace/workspaceRoutes.ts:1803 | authenticate | 3 / 0 / 0 |
| PATCH | workspaceRouter | /categories/:categoryId | Backend/src/Routes/workspace/workspaceRoutes.ts:1833 | authenticate | 3 / 0 / 0 |
| DELETE | workspaceRouter | /categories/:categoryId | Backend/src/Routes/workspace/workspaceRoutes.ts:1859 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /categories/:categoryId/overrides | Backend/src/Routes/workspace/workspaceRoutes.ts:1884 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /channels | Backend/src/Routes/workspace/workspaceRoutes.ts:1915 | authenticate | 3 / 0 / 0 |
| PUT | workspaceRouter | /channels/reorder | Backend/src/Routes/workspace/workspaceRoutes.ts:1941 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /channels/:channelId | Backend/src/Routes/workspace/workspaceRoutes.ts:1972 | authenticate | 3 / 0 / 0 |
| PATCH | workspaceRouter | /channels/:channelId | Backend/src/Routes/workspace/workspaceRoutes.ts:1997 | authenticate | 3 / 0 / 0 |
| DELETE | workspaceRouter | /channels/:channelId | Backend/src/Routes/workspace/workspaceRoutes.ts:2023 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /channels/:channelId/sync | Backend/src/Routes/workspace/workspaceRoutes.ts:2049 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /channels/:channelId/overrides | Backend/src/Routes/workspace/workspaceRoutes.ts:2074 | authenticate | 3 / 0 / 0 |
| DELETE | workspaceRouter | /channels/:channelId/overrides/:overrideId | Backend/src/Routes/workspace/workspaceRoutes.ts:2100 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /channels/:channelId/messages | Backend/src/Routes/workspace/workspaceRoutes.ts:2132 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /channels/:channelId/messages | Backend/src/Routes/workspace/workspaceRoutes.ts:2165 | authenticate | 3 / 0 / 0 |
| PATCH | workspaceRouter | /channels/:channelId/messages/:messageId | Backend/src/Routes/workspace/workspaceRoutes.ts:2195 | authenticate | 3 / 0 / 0 |
| DELETE | workspaceRouter | /channels/:channelId/messages/:messageId | Backend/src/Routes/workspace/workspaceRoutes.ts:2226 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /channels/:channelId/messages/:messageId/pin | Backend/src/Routes/workspace/workspaceRoutes.ts:2251 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /channels/:channelId/messages/:messageId/reactions | Backend/src/Routes/workspace/workspaceRoutes.ts:2278 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /messages/search | Backend/src/Routes/workspace/workspaceRoutes.ts:2309 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /channels/:channelId/read | Backend/src/Routes/workspace/workspaceRoutes.ts:2340 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /channels-unread | Backend/src/Routes/workspace/workspaceRoutes.ts:2366 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /channels/:channelId/threads | Backend/src/Routes/workspace/workspaceRoutes.ts:2390 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /threads/:threadId | Backend/src/Routes/workspace/workspaceRoutes.ts:2423 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /channels/:channelId/threads | Backend/src/Routes/workspace/workspaceRoutes.ts:2448 | authenticate | 3 / 0 / 0 |
| PATCH | workspaceRouter | /threads/:threadId | Backend/src/Routes/workspace/workspaceRoutes.ts:2474 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /realtime/stream | Backend/src/Routes/workspace/workspaceRoutes.ts:2505 | authenticate | 5 / 0 / 0 |
| POST | workspaceRouter | /tasks | Backend/src/Routes/workspace/workspaceRoutes.ts:2595 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /tasks | Backend/src/Routes/workspace/workspaceRoutes.ts:2651 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /tasks/my-tasks | Backend/src/Routes/workspace/workspaceRoutes.ts:2704 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /tasks/accountability | Backend/src/Routes/workspace/workspaceRoutes.ts:2737 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /tasks/:taskId | Backend/src/Routes/workspace/workspaceRoutes.ts:2760 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /tasks/:taskId/reassignments | Backend/src/Routes/workspace/workspaceRoutes.ts:2783 | authenticate | 3 / 0 / 0 |
| PATCH | workspaceRouter | /tasks/:taskId | Backend/src/Routes/workspace/workspaceRoutes.ts:2810 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /tasks/:taskId/transition | Backend/src/Routes/workspace/workspaceRoutes.ts:2871 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /tasks/:taskId/assign | Backend/src/Routes/workspace/workspaceRoutes.ts:2911 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /tasks/:taskId/submit | Backend/src/Routes/workspace/workspaceRoutes.ts:2945 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /tasks/:taskId/review | Backend/src/Routes/workspace/workspaceRoutes.ts:2982 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /tasks/:taskId/comments | Backend/src/Routes/workspace/workspaceRoutes.ts:3022 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /tasks/:taskId/comments | Backend/src/Routes/workspace/workspaceRoutes.ts:3059 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /tasks/:taskId/watch | Backend/src/Routes/workspace/workspaceRoutes.ts:3082 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /tasks/:taskId/activity | Backend/src/Routes/workspace/workspaceRoutes.ts:3105 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /tasks/:taskId/checklist | Backend/src/Routes/workspace/workspaceRoutes.ts:3129 | authenticate | 3 / 0 / 0 |
| DELETE | workspaceRouter | /tasks/:taskId | Backend/src/Routes/workspace/workspaceRoutes.ts:3168 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /files/upload-intent | Backend/src/Routes/workspace/workspaceRoutes.ts:3195 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /files/register-upload | Backend/src/Routes/workspace/workspaceRoutes.ts:3250 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /files/direct-upload | Backend/src/Routes/workspace/workspaceRoutes.ts:3309 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /files/:fileId/delivery-url | Backend/src/Routes/workspace/workspaceRoutes.ts:3357 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /files | Backend/src/Routes/workspace/workspaceRoutes.ts:3398 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /files/storage/usage | Backend/src/Routes/workspace/workspaceRoutes.ts:3436 | authenticate | 3 / 0 / 0 |
| DELETE | workspaceRouter | /files/:fileId | Backend/src/Routes/workspace/workspaceRoutes.ts:3459 | authenticate | 3 / 0 / 0 |
| PATCH | workspaceRouter | /files/:fileId/rename | Backend/src/Routes/workspace/workspaceRoutes.ts:3484 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /files/:fileId/replace | Backend/src/Routes/workspace/workspaceRoutes.ts:3519 | authenticate | 3 / 0 / 0 |
| GET | workspaceRouter | /files/:fileId/share-url | Backend/src/Routes/workspace/workspaceRoutes.ts:3563 | authenticate | 3 / 0 / 0 |
| POST | workspaceRouter | /webhooks/resend | Backend/src/Routes/workspace/workspaceRoutes.ts:3600 | — | 0 / 0 / 0 |
| GET | workspaceRouter | /notifications | Backend/src/Routes/workspace/workspaceRoutes.ts:3605 | authenticate | 2 / 0 / 0 |
| PATCH | workspaceRouter | /notifications/:notificationId/read | Backend/src/Routes/workspace/workspaceRoutes.ts:3617 | authenticate | 2 / 0 / 0 |
| POST | workspaceRouter | /notifications/read-all | Backend/src/Routes/workspace/workspaceRoutes.ts:3629 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /notifications/preferences | Backend/src/Routes/workspace/workspaceRoutes.ts:3641 | authenticate | 2 / 0 / 0 |
| PUT | workspaceRouter | /notifications/preferences | Backend/src/Routes/workspace/workspaceRoutes.ts:3653 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/notifications | Backend/src/Routes/workspace/workspaceRoutes.ts:3665 | authenticate | 0 / 0 / 0 |
| PATCH | workspaceRouter | /:workspaceId/notifications/:notificationId/read | Backend/src/Routes/workspace/workspaceRoutes.ts:3666 | authenticate | 0 / 0 / 0 |
| POST | workspaceRouter | /:workspaceId/notifications/read-all | Backend/src/Routes/workspace/workspaceRoutes.ts:3667 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/notifications/preferences | Backend/src/Routes/workspace/workspaceRoutes.ts:3668 | authenticate | 0 / 0 / 0 |
| PUT | workspaceRouter | /:workspaceId/notifications/preferences | Backend/src/Routes/workspace/workspaceRoutes.ts:3669 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /dashboard/overview | Backend/src/Routes/workspace/workspaceRoutes.ts:3678 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /dashboard/departments/:departmentId | Backend/src/Routes/workspace/workspaceRoutes.ts:3690 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /activity | Backend/src/Routes/workspace/workspaceRoutes.ts:3702 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /audit-logs | Backend/src/Routes/workspace/workspaceRoutes.ts:3714 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /history | Backend/src/Routes/workspace/workspaceRoutes.ts:3727 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /history/export | Backend/src/Routes/workspace/workspaceRoutes.ts:3739 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /history/:itemId/inspect | Backend/src/Routes/workspace/workspaceRoutes.ts:3751 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /search | Backend/src/Routes/workspace/workspaceRoutes.ts:3763 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/dashboard/overview | Backend/src/Routes/workspace/workspaceRoutes.ts:3775 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/dashboard/departments/:departmentId | Backend/src/Routes/workspace/workspaceRoutes.ts:3776 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/activity | Backend/src/Routes/workspace/workspaceRoutes.ts:3777 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/audit-logs | Backend/src/Routes/workspace/workspaceRoutes.ts:3778 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/history/export | Backend/src/Routes/workspace/workspaceRoutes.ts:3779 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/history/:itemId/inspect | Backend/src/Routes/workspace/workspaceRoutes.ts:3780 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/history | Backend/src/Routes/workspace/workspaceRoutes.ts:3781 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/search | Backend/src/Routes/workspace/workspaceRoutes.ts:3782 | authenticate | 0 / 0 / 0 |
| POST | workspaceRouter | /recognition/awards | Backend/src/Routes/workspace/workspaceRoutes.ts:3789 | authenticate | 2 / 0 / 0 |
| POST | workspaceRouter | /recognition/awards/:awardId/reverse | Backend/src/Routes/workspace/workspaceRoutes.ts:3798 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /recognition/policy | Backend/src/Routes/workspace/workspaceRoutes.ts:3807 | authenticate | 2 / 0 / 0 |
| PATCH | workspaceRouter | /recognition/policy | Backend/src/Routes/workspace/workspaceRoutes.ts:3816 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /recognition/categories | Backend/src/Routes/workspace/workspaceRoutes.ts:3825 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /recognition/history | Backend/src/Routes/workspace/workspaceRoutes.ts:3834 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /recognition/summary | Backend/src/Routes/workspace/workspaceRoutes.ts:3843 | authenticate | 2 / 0 / 0 |
| POST | workspaceRouter | /recognition/budget | Backend/src/Routes/workspace/workspaceRoutes.ts:3852 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /recognition/budgets | Backend/src/Routes/workspace/workspaceRoutes.ts:3861 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /recognition/analytics | Backend/src/Routes/workspace/workspaceRoutes.ts:3870 | authenticate | 2 / 0 / 0 |
| PATCH | workspaceRouter | /recognition/categories/:categoryId | Backend/src/Routes/workspace/workspaceRoutes.ts:3879 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /recognition/awards/:awardId | Backend/src/Routes/workspace/workspaceRoutes.ts:3888 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /recognition/departments/:departmentId | Backend/src/Routes/workspace/workspaceRoutes.ts:3897 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /recognition/members/:userId/profile | Backend/src/Routes/workspace/workspaceRoutes.ts:3906 | authenticate | 2 / 0 / 0 |
| POST | workspaceRouter | /recognition/awards/:awardId/notes | Backend/src/Routes/workspace/workspaceRoutes.ts:3915 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /recognition/awards/:awardId/notes | Backend/src/Routes/workspace/workspaceRoutes.ts:3924 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /recognition/leaderboards | Backend/src/Routes/workspace/workspaceRoutes.ts:3933 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /recognition/analytics/comprehensive | Backend/src/Routes/workspace/workspaceRoutes.ts:3942 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /recognition/analytics/members/:userId | Backend/src/Routes/workspace/workspaceRoutes.ts:3951 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /recognition/leaderboards/redis/top | Backend/src/Routes/workspace/workspaceRoutes.ts:3961 | authenticate | 2 / 0 / 0 |
| GET | workspaceRouter | /recognition/leaderboards/redis/nearby | Backend/src/Routes/workspace/workspaceRoutes.ts:3970 | authenticate | 2 / 0 / 0 |
| POST | workspaceRouter | /recognition/leaderboards/rebuild | Backend/src/Routes/workspace/workspaceRoutes.ts:3979 | authenticate | 2 / 0 / 0 |
| POST | workspaceRouter | /recognition/leaderboards/reconcile | Backend/src/Routes/workspace/workspaceRoutes.ts:3988 | authenticate | 2 / 0 / 0 |
| POST | workspaceRouter | /:workspaceId/recognition/awards | Backend/src/Routes/workspace/workspaceRoutes.ts:3998 | authenticate | 0 / 0 / 0 |
| POST | workspaceRouter | /:workspaceId/recognition/awards/:awardId/reverse | Backend/src/Routes/workspace/workspaceRoutes.ts:3999 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/recognition/awards/:awardId | Backend/src/Routes/workspace/workspaceRoutes.ts:4000 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/recognition/departments/:departmentId | Backend/src/Routes/workspace/workspaceRoutes.ts:4001 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/recognition/members/:userId/profile | Backend/src/Routes/workspace/workspaceRoutes.ts:4002 | authenticate | 0 / 0 / 0 |
| POST | workspaceRouter | /:workspaceId/recognition/awards/:awardId/notes | Backend/src/Routes/workspace/workspaceRoutes.ts:4003 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/recognition/awards/:awardId/notes | Backend/src/Routes/workspace/workspaceRoutes.ts:4004 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/recognition/leaderboards | Backend/src/Routes/workspace/workspaceRoutes.ts:4005 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/recognition/leaderboards/redis/top | Backend/src/Routes/workspace/workspaceRoutes.ts:4006 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/recognition/leaderboards/redis/nearby | Backend/src/Routes/workspace/workspaceRoutes.ts:4007 | authenticate | 0 / 0 / 0 |
| POST | workspaceRouter | /:workspaceId/recognition/leaderboards/rebuild | Backend/src/Routes/workspace/workspaceRoutes.ts:4008 | authenticate | 0 / 0 / 0 |
| POST | workspaceRouter | /:workspaceId/recognition/leaderboards/reconcile | Backend/src/Routes/workspace/workspaceRoutes.ts:4009 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/recognition/policy | Backend/src/Routes/workspace/workspaceRoutes.ts:4010 | authenticate | 0 / 0 / 0 |
| PATCH | workspaceRouter | /:workspaceId/recognition/policy | Backend/src/Routes/workspace/workspaceRoutes.ts:4011 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/recognition/categories | Backend/src/Routes/workspace/workspaceRoutes.ts:4012 | authenticate | 0 / 0 / 0 |
| PATCH | workspaceRouter | /:workspaceId/recognition/categories/:categoryId | Backend/src/Routes/workspace/workspaceRoutes.ts:4013 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/recognition/history | Backend/src/Routes/workspace/workspaceRoutes.ts:4014 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/recognition/summary | Backend/src/Routes/workspace/workspaceRoutes.ts:4015 | authenticate | 0 / 0 / 0 |
| POST | workspaceRouter | /:workspaceId/recognition/budget | Backend/src/Routes/workspace/workspaceRoutes.ts:4016 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/recognition/budgets | Backend/src/Routes/workspace/workspaceRoutes.ts:4017 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/recognition/analytics | Backend/src/Routes/workspace/workspaceRoutes.ts:4018 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/recognition/analytics/comprehensive | Backend/src/Routes/workspace/workspaceRoutes.ts:4019 | authenticate | 0 / 0 / 0 |
| GET | workspaceRouter | /:workspaceId/recognition/analytics/members/:userId | Backend/src/Routes/workspace/workspaceRoutes.ts:4020 | authenticate | 0 / 0 / 0 |
| GET | router | /robots.txt | Backend/src/seo/web.ts:26 | — | 0 / 0 / 0 |
| GET | router | /sitemap.xml | Backend/src/seo/web.ts:27 | — | 1 / 0 / 0 |
| GET | router | /sitemaps/:file | Backend/src/seo/web.ts:36 | — | 1 / 0 / 0 |
| GET | router | /api/seo/page | Backend/src/seo/web.ts:47 | noindex | 1 / 0 / 0 |
