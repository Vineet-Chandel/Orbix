# Orbix — Adaptive Image Upload & Placement Specification

> **Platform Architecture Reference**  
> Complete audit of all public, authenticated, and administrative image placements across Orbix.  
> Every placement defines exact rendered dimensions, aspect ratios, fit strategies, shapes, responsive behaviors, safe areas, and editing requirements.

---

## 1. Complete Placement Matrix

| Placement ID | Label / Context | Shape | Aspect Ratio | Rendered Dimensions | Fit Strategy | Responsive Breakpoints | Editing & Safe Area Requirements |
|---|---|---|---|---|---|---|---|
| `user_avatar` | User Profile Photo / Avatar | Circle / Rounded Square | **1:1** (Square) | 96x96 to 112x112 (`lg`), 40x40 (`sm`), 48x48 (`md`) | `cover` (center / face) | Scales from 96px (`<sm`) to 112px (`>=sm`) on profile; 40px in navigation | Circular crop mask overlay; face positioning, zoom (0.5x–3.5x), rotate (90° / fine), flip H & V, filter presets, focal point pin. Live circular & square preview. |
| `user_cover` | User Profile Cover Banner | Rounded Rectangle | **3:1** (Wide) | Full-width container (max 1600px), height 180px–280px | `cover` | 180px on mobile (`<sm`), 240px on tablet (`md`), 280px on desktop (`lg`) | Panoramic 3:1 crop guide. Vertical focal positioning so developer headers aren't clipped. |
| `club_logo` | Club Chapter Logo / Crest | Rounded Square & Circle | **1:1** (Square) | 96x96 to 112x112 (`profile`), 56x56 (`cards`), 40x40 (`sidebar`), 32x32 (`event badge`) | `cover` / `contain` | 96px on mobile, 112px on desktop; 56px in cards; 40px in sidebar | 1:1 crop. Dual-preview (Circle and Rounded-2xl). Background color fill option for transparent crests. |
| `club_banner` | Club Header Banner | Landscape Rectangle | **2.6:1** (2.4:1 to 2.8:1) | `aspect-[2.4/1]` to `aspect-[2.8/1]`, max-height 320px | `contain` / `cover` | Mobile: `aspect-[2.4/1]`, Desktop: `aspect-[2.8/1]`, max-h-80 | Overlapping logo safe zone: bottom-left safe area (-mt-16 to -mt-20) indicator so banner art/text isn't obscured by the overlapping club logo. |
| `event_banner` | Event Hero Banner & Poster | Multi-Ratio (Primary **2.4:1**) | **2.4:1** (Hero), **16:9** (Standard), **4:5** (Editorial Poster), **9:16** (Story Pass), **Freeform** | Hero: `aspect-[2.4/1]`, max-h-96; Cards: `aspect-[2.4/1]`; Pass: `aspect-[2.4/1]` / `aspect-[2/1]` | `contain` on dark `#0a0a0a` backdrop | Fluid responsive width; maintains 2.4:1 ratio without stretching or cropping text | Safe-area margins (inner 85% safe zone for event title, date, venue, QR codes). Multi-ratio preview switcher (2.4:1, 16:9, 4:5, 1:1). 8-point interactive resize handles. Background fill color selector. |
| `club_coordinator` | Club Coordinator / Lead Photo | Rounded Square (`rounded-2xl`) | **1:1** (Square) | 56x56 (`w-14 h-14`) | `cover` | Fixed 56px across all viewports | 1:1 crop with face centering, zoom (0.5x–3.5x), rotate, flip. |
| `club_achievement` | Achievement Badge / Distinction | Rounded Square (`rounded-xl`) | **1:1** (Square) | 48x48 (`w-12 h-12`) | `cover` / `contain` | Fixed 48px | 1:1 crop, transparent background preservation, trophy/badge centering. |
| `project_cover` | Project Primary Cover | Landscape | **16:9** (1.78:1) | Full width, max-h-56 (224px) | `cover` | Fluid container max 800px; responsive height | 16:9 widescreen crop, focal alignment for UI screenshots / mockups. |
| `project_gallery` | Project Screenshot / Diagram | Flexible / Freeform | **16:9**, **4:3**, or Freeform | Max width 1200px, responsive | `contain` / `cover` | Responsive container with light/dark canvas | Aspect ratio presets + freeform crop; rotate, brightness, zoom for high-detail architecture diagrams. |
| `form_header` | Event Registration Form Header | Ultra-Wide Landscape | **3.75:1** (1200x320) | `w-full h-28` (drawer preview), `h-44 sm:h-64 lg:h-72` (live form) | `cover` | Height scales from 176px (`<sm`) to 256px (`sm`) to 288px (`lg`) | Ultra-wide banner crop; safe area for form title overlay at bottom-left. |

---

## 2. Production Media Processing Architecture

```
[User Device: Raw File]
          │
          ▼
[AdaptiveImageEditorModal] (Client-side interactive framing, zoom, pan, rotate, filters)
          │
          ▼
[imageCanvasUtils] (Offscreen Canvas rendering -> high-res WebP/PNG Blob & File)
          │
          ▼
[Backend: Signature Request] (Signs params, verifies user session, issues 15-min expiring intent)
          │
          ▼
[Direct Cloudinary Upload] (Uploads framed asset directly to CDN via signed URL)
          │
          ▼
[Backend: Asset Confirmation] (Server-side Cloudinary verification, atomic DB commit, safe cleanup)
          │
          ▼
[Cloudinary CDN Delivery] (On-the-fly responsive variants: f_auto, q_auto, g_face, w_*, c_fill/c_fit)
```

### A. Separation of Responsibilities
1. **Frontend**: Interactive positioning, focal pinning, rule-of-thirds alignment, safe-area visualization, and offscreen canvas pixel processing.
2. **Backend**: Cryptographic ticket signing (`api_sign_request`), intent recording in PostgreSQL, ownership verification, format validation, and atomic database commits.
3. **Cloudinary CDN**: Edge caching, format negotiation (AVIF/WebP based on browser Accept header), intelligent compression (`q_auto`), and responsive derivative generation.

### B. Responsive Delivery Derivatives (`cloudinaryDelivery.ts`)
- **Avatars**: `w_160,h_160,c_thumb,g_face,f_auto,q_auto`
- **Event Banners**: `w_1440,h_600,c_fit,f_auto,q_auto` (Hero); `w_640,h_266,c_fit,f_auto,q_auto` (Cards)
- **Club Banners**: `w_1440,h_553,c_fill,g_auto,f_auto,q_auto` (Desktop); `w_640,h_246,c_fill,g_auto,f_auto,q_auto` (Mobile)
- **Thumbnails**: `w_300,h_300,c_fill,f_auto,q_auto`
- **SrcSet**: Automated generation of `320w`, `640w`, `960w`, `1200w`, `1600w` for high-DPI displays.

---

## 3. Reliability & Lifecycle Guarantees

1. **Non-Destructive Editing**: The user's original image file is never modified on disk. Adjustments exist in editor memory and produce a new high-fidelity output upon confirmation.
2. **Zero-Downtime Replacement**: When replacing an avatar or banner, the existing asset remains live until the new asset is confirmed and committed to the database.
3. **Orphan Prevention**: If an upload fails or the modal is cancelled, no database record is created. Expired upload tickets are purged automatically after 15 minutes.
4. **History & Navigation**: Full Undo (`Cmd+Z`) and Redo (`Cmd+Y`) history stack with instant state restoration.
