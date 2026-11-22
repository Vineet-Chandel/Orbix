# Orbix privacy and production review

Date: 22 November 2026

Status: source hardening implemented. This is not certification that all deployed services, stored data, or third-party integrations are free of security defects. The working tree has not been deployed by this audit.

## Public-field policy

| Surface | Public output | Restricted output |
|---|---|---|
| Personal profile | Name, avatar, professional details and selected links when the profile is public | Account email, phone, credentials, private profiles, hidden platforms, blocked access |
| Club profile and campus directory | Published profile fields, public coordinators, events and achievements | Authentication owner ID, hidden coordinators, unauthorized draft/private previews |
| Club contact fields | Masked phone (`93******44`) and masked email (`p***@gmail.com`) | Complete phone and email values; both camelCase and snake_case aliases masked before serialization |
| Private profile/club management | Authenticated account owners and authorized managers may edit actual contact details | Public visitors do not receive the management representation |
| Resume | Publicly opted-in documents through the API view/download paths | Cached metadata cannot bypass current visibility or logged-in block checks; no raw storage URL in public metadata |
| Privacy diagnostics | Account owner only | Another account cannot retrieve private scores/platform counts through diagnostics |
| Authentication | Verification proofs and normal session responses | Raw OTPs and publicly known fallback signing keys |
| Error screen/API errors | Short recovery instructions and safe error messages | Developer stack panels, 500 exception details, common SQL/provider diagnostics |

Publishing a biography, event description, link or resume deliberately makes that content available under its visibility policy. Field masking cannot safely erase all contact details that users type into free text or embed in uploaded documents.

## Fixes

1. Removed the visible developer diagnostic panels from the shared error boundary, including development previews. The original panels already had a development-only condition; this was not evidence that the production build served them.
2. Centralized generic server-error responses, removed diagnostic properties from API error bodies, filtered common infrastructure details in misclassified 400 errors, disabled the Express fingerprint, and added no-store JSON responses and content-type/referrer protections.
3. Removed raw OTP responses and password-reset OTP console output, including the unsafe sandbox/provider-failure branches. Production verification now fails with an unavailable response if delivery fails or is simulated/restricted.
4. Removed hardcoded JWT/state-signing secret fallbacks from verification, reset, account-management, 2FA and GitHub App services. Production signing secrets must be configured and at least 32 characters long.
5. Removed default email-based staff/reviewer grants, a default club registration password and a default webhook verification secret. Explicit environment configuration is required.
6. Personal public-profile cache reads now happen after current profile visibility and block checks. Owner representations do not populate public caches. Only public platform connections are serialized for visitors.
7. Public club/directory phone and email fields are masked at the server. Hidden coordinators are excluded from the directory. Old public club and personal cache namespaces are replaced to avoid serving legacy representations after deployment.
8. A caller-supplied club ID no longer grants preview access. Inactive club memberships no longer confer club permissions.
9. Legacy aggregate analytics validate profile visibility and block state before reading caches. Aggregates containing any hidden platform are withheld from public visitors; owners retain access. This deliberately suppresses a mixed-visibility aggregate rather than risking disclosure of the hidden connection. Individual public profile platforms remain visible.
10. Public resume metadata checks current visibility, uses gated API URLs and does not publish raw storage URLs. Streaming and metadata deny blocked logged-in viewers. Document responses use private/no-store caching. Optional storage redirects use a 60-second signed URL when a storage public ID is present.
11. Public platform metadata no longer includes runtime environment, repository location or deployment commit. Workspace health no longer returns the Redis namespace.
12. Strengthened local secret-file ignore patterns, redacted bundled demo contact fields and generated a location-based redacted inventory.

## UI changes

- One campus club grid, current club first, replacing the separate self/peer lanes.
- Responsive one/two/three-column layout, wrapping filters and accessible search/recruitment controls.
- Club cards allow long titles to wrap and grid items to shrink.
- Masked contact badges have no misleading `tel:`/`mailto:` links containing masked values.
- Shorter recovery copy, no stack expander, stacked mobile recovery buttons.

## Validation

- Frontend production build passes; generated client output contains no source maps.
- Existing frontend regression tests: 56 passed.
- Final combined backend suite: 159 passed, 10 database integration tests skipped (169 tests total).
- Final dedicated privacy suite: 18 passed, covering cache/privacy changes, blocks, diagnostic ownership, spoofed club context, inactive membership, resume access, masking, generic errors, signing-key requirements and delivery failures.
- Backend type-check comparison: existing application diagnostics remain; this change introduced no new application diagnostic types when compared with the original checkout. Existing pdf-lib/module and strict optional-property errors still prevent a clean backend type-check.
- Current inventory scans nonignored tracked/untracked source and configuration text. Credential-pattern candidates were reviewed: they are test fixtures and form-validation strings, not confirmed provider credentials. Recognized provider/private-key signatures were not found in the scanned backend source or generated client JS. Pattern scanning cannot identify every possible secret.
- Git history filename scan found no tracked Backend/.env, Frontend/.env, PEM or KEY files. It does not prove that no historical secret existed under another filename.
- Browser/mobile visual verification and live API/deployment checks were not completed: the local preview listener was denied by the execution environment. Layout changes have compile/source verification only.

## Deployment and remaining checks

- Configure a unique strong JWT_SECRET, explicit staff/reviewer allowlists, real production mail/SMS delivery and RESEND_WEBHOOK_SECRET where used. Missing configuration now fails closed.
- If a deployment previously used a fallback signing key, rotate its signing key and revoke existing sessions/proofs. GitHub private-project ciphertext derived from that fallback may require reauthorization after changing its encryption key.
- Purge old CDN/browser document caches at rollout where possible. Previously downloaded public documents cannot be recalled. Existing direct Cloudinary upload URLs may still be accessible independently of the API; storage-side access policies and older uploads require a separate live check.
- Verify mobile views, owner/member/nonmember/private/blocked scenarios against a staging database and deployed backend.
- Resolve the pre-existing backend type-check errors before treating the project as build-clean. Dependency advisory checks, load tests and a deployment penetration test were not completed in this pass.
- Verify production log access/retention: delivery logs can contain recipient addresses. They are server logs, not public API responses, but still need appropriate access controls.

Reference: [OWASP API3 — object property authorization and excessive data exposure](https://api-security.owasp.org/editions/2023/en/0xa3-broken-object-property-level-authorization/).

See [security-contact-inventory.md](security-contact-inventory.md) for masked contact occurrences and credential configuration locations. Reproduce it with `python3 scripts/audit-public-data.py`; raw credential values are never written to that inventory.
