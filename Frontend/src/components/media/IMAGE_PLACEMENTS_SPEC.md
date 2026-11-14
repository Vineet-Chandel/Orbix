# Orbix — Adaptive Image Upload & Placement Specification

> **Platform Architecture Reference**  
> Complete audit of all public, authenticated, and administrative image placements across Orbix.  
> Every placement defines exact rendered dimensions, aspect ratios, fit strategies, shapes, responsive behaviors, safe areas, and editing requirements.

---

## 1. Complete Placement Matrix

| Placement ID | Label / Context | Shape | Aspect Ratio | Rendered Dimensions | Fit Strategy | Responsive Breakpoints | Editing & Safe Area Requirements |
|---|---|---|---|---|---|---|---|
| `user_avatar` | User Profile Photo / Avatar | Circle / Rounded Square | **1:1** (Square) | 96x96 to 112x112 (`lg`), 40x40 (`sm`), 48x48 (`md`) | `cover` (center / face) | Scales from 96px (`<sm`) to 112px (`>=sm`) on profile; 40px in navigation | Circular crop mask overlay; face positioning, zoom (1x–3x), rotate (90° / fine), flip, contrast/brightness adjustments. Live circular & square preview. |
| `user_cover` | User Profile Cover Banner | Rounded Rectangle | **3:1** (Wide) | Full-width container (max 1600px), height 180px–280px | `cover` | 180px on mobile (`<sm`), 240px on tablet (`md`), 280px on desktop (`lg`) | Panoramic 3:1 crop guide. Vertical focal positioning so developer headers aren't clipped. |
| `club_logo` | Club Chapter Logo / Crest | Rounded Square & Circle | **1:1** (Square) | 96x96 to 112x112 (`profile`), 56x56 (`cards`), 40x40 (`sidebar`), 32x32 (`event badge`) | `cover` / `contain` | 96px on mobile, 112px on desktop; 56px in cards; 40px in sidebar | 1:1 crop. Dual-preview (Circle and Rounded-2xl). Background color fill option for transparent crests. |
| `club_banner` | Club Header Banner | Landscape Rectangle | **2.6:1** (2.4:1 to 2.8:1) | `aspect-[2.4/1]` to `aspect-[2.8/1]`, max-height 320px | `contain` / `cover` | Mobile: `aspect-[2.4/1]`, Desktop: `aspect-[2.8/1]`, max-h-80 | Overlapping logo safe zone: bottom-left safe area (-mt-16 to -mt-20) indicator so banner art/text isn't obscured by the overlapping club logo. |
| `event_banner` | Event Hero Banner & Poster | Multi-Ratio (Primary **2.4:1**) | **2.4:1** (Hero), **16:9** (Standard), **4:5** (Editorial Poster), **9:16** (Story Pass) | Hero: `aspect-[2.4/1]`, max-h-96; Cards: `aspect-[2.4/1]`; Pass: `aspect-[2.4/1]` / `aspect-[2/1]` | `contain` on dark `#0a0a0a` backdrop | Fluid responsive width; maintains 2.4:1 ratio without stretching or cropping text | Safe-area margins (inner 85% safe zone for event title, date, venue, QR codes). Multi-ratio preview switcher (2.4:1, 16:9, 4:5, 1:1). Background fill color selector. |
| `club_coordinator` | Club Coordinator / Lead Photo | Rounded Square (`rounded-2xl`) | **1:1** (Square) | 56x56 (`w-14 h-14`) | `cover` | Fixed 56px across all viewports | 1:1 crop with face centering, zoom (1x–3x), rotate, flip. |
| `club_achievement` | Achievement Badge / Distinction | Rounded Square (`rounded-xl`) | **1:1** (Square) | 48x48 (`w-12 h-12`) | `cover` / `contain` | Fixed 48px | 1:1 crop, transparent background preservation, trophy/badge centering. |
| `project_cover` | Project Primary Cover | Landscape | **16:9** (1.78:1) | Full width, max-h-56 (224px) | `cover` | Fluid container max 800px; responsive height | 16:9 widescreen crop, focal alignment for UI screenshots / mockups. |
| `project_gallery` | Project Screenshot / Diagram | Flexible / Freeform | **16:9**, **4:3**, or Freeform | Max width 1200px, responsive | `contain` / `cover` | Responsive container with light/dark canvas | Aspect ratio presets + freeform crop; rotate, brightness, zoom for high-detail architecture diagrams. |
| `form_header` | Event Registration Form Header | Ultra-Wide Landscape | **3.75:1** (1200x320) | `w-full h-28` (drawer preview), `h-44 sm:h-64 lg:h-72` (live form) | `cover` | Height scales from 176px (`<sm`) to 256px (`sm`) to 288px (`lg`) | Ultra-wide banner crop; safe area for form title overlay at bottom-left. |
| `certificate_crest` | Certificate Seal / Crest / Logo | Square / Circular | **1:1** (Square) | 64x64 to 120x120 | `contain` | Scaled to SVG certificate canvas DPI | Transparent PNG preservation; background removal; crisp contrast. |
| `certificate_signature` | Signer Signature | Wide Horizontal | **3:1** to **4:1** | 180x60 to 240x60 | `contain` | Scaled to SVG signature line | High-contrast black/dark-ink thresholding on transparent background. |

---

## 2. Shared Neobrutalist UI Specifications

All editor components, panels, modals, and dropzones adhere to Orbix's core design system:
1. **Borders & Shadows**:
   - Containers: `border-2 border-black` or `border-3 border-black` with `shadow-[4px_4px_0px_#000]` or `shadow-[6px_6px_0px_#000]`.
   - Small controls / badges: `border-2 border-black` with `shadow-[2px_2px_0px_#000]`.
   - Interactive button presses: `active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_#000]`.
2. **Palette**:
   - Canvas background: `#FAF6EE` (Warm Parchment)
   - Accents: `#a2ff86` (Neo-Green), `#FFE566` (Neo-Yellow), `#38BDF8` (Sky Blue), `#FF6B6B` (Coral Red).
   - Canvas dots: `bg-[radial-gradient(#d3cbbe_1.5px,transparent_1.5px)] [background-size:16px_16px]`.
3. **Typography**:
   - Headings: `font-black text-black tracking-tight`.
   - Meta & Badges: `text-[10px] font-black uppercase tracking-wider`.
   - Controls & Buttons: `text-xs font-black`.
4. **Touch & Mobile Accessibility**:
   - Minimum 44x44px touch targets.
   - Dual input: Touch pinch-to-zoom + slider zoom; drag-to-pan + direction step buttons.
   - Keyboard accessible: Arrow keys for fine panning, +/- for zoom, [ and ] for 90° rotation.
