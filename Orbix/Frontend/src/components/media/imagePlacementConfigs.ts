/**
 * Orbix Adaptive Image Upload & Editing System — Placement Configuration
 * Platform-wide registry of exact display specifications, aspect ratios,
 * fit strategies, safe areas, and editor features for every media placement.
 */

export type ImageCropShape = "circle" | "square" | "rectangle" | "freeform";
export type ImageFitMode = "cover" | "contain";

export interface AspectRatioPreset {
    id: string;
    label: string;
    ratio: number; // width / height
    width: number;
    height: number;
    description?: string;
}

export interface PreviewContextSpec {
    id: string;
    label: string;
    shape: "circle" | "square" | "rounded" | "banner";
    aspectRatio: number;
    containerClassName: string;
    description: string;
}

export interface OverlapSafeZone {
    position: "bottom-left" | "bottom-center" | "bottom-right" | "top-left" | "top-right";
    widthPercent: number;
    heightPercent: number;
    label: string;
}

export interface MediaPlacementConfig {
    placementId: string;
    title: string;
    subtitle?: string;
    description: string;

    // Primary dimensions & aspect ratio
    aspectRatio: number; // width / height (e.g. 1.0, 2.4, 16/9, 3.0)
    aspectRatioPresets?: AspectRatioPreset[];

    shape: ImageCropShape;
    fit: ImageFitMode;

    minWidth: number;
    minHeight: number;
    recommendedWidth: number;
    recommendedHeight: number;
    maxFileSizeMB: number;
    allowedMimeTypes: string[];

    // High-resolution Canvas export output
    exportTarget: {
        width: number;
        height: number;
        mimeType: "image/webp" | "image/png" | "image/jpeg";
        quality: number;
    };

    // Enabled editor controls
    features: {
        crop: boolean;
        zoom: boolean;
        rotate: boolean;
        flip: boolean;
        pan: boolean;
        brightness: boolean;
        contrast: boolean;
        saturation: boolean;
        exposure?: boolean;
        warmth?: boolean;
        sharpness?: boolean;
        blur?: boolean;
        grayscale?: boolean;
        filterPresets?: boolean;
        backgroundFill: boolean;
        aspectRatioSwitch: boolean;
        freeformCrop?: boolean;
        fitModes?: boolean;
        focalPoint?: boolean;
        safeAreaOverlay: boolean;
    };

    // Safe area margins in percentage (0 to 100)
    safeArea?: {
        top: number;
        right: number;
        bottom: number;
        left: number;
        label?: string;
        overlapZone?: OverlapSafeZone;
    };

    // Live multi-context previews
    previewContexts: PreviewContextSpec[];
}

export const MEDIA_PLACEMENTS: Record<string, MediaPlacementConfig> = {
    // -------------------------------------------------------------------------
    // 1. User Profile Avatar
    // -------------------------------------------------------------------------
    user_avatar: {
        placementId: "user_avatar",
        title: "Profile Photo",
        subtitle: "Personal Developer Identity",
        description: "Position and zoom your face to ensure your profile appears centered across all device screens, leaderboards, and navigation bars.",
        aspectRatio: 1.0,
        shape: "circle",
        fit: "cover",
        minWidth: 128,
        minHeight: 128,
        recommendedWidth: 512,
        recommendedHeight: 512,
        maxFileSizeMB: 5,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        exportTarget: {
            width: 512,
            height: 512,
            mimeType: "image/webp",
            quality: 0.92,
        },
        features: {
            crop: true,
            zoom: true,
            rotate: true,
            flip: true,
            pan: true,
            brightness: true,
            contrast: true,
            saturation: true,
            exposure: true,
            warmth: true,
            sharpness: true,
            blur: true,
            grayscale: true,
            filterPresets: true,
            backgroundFill: false,
            aspectRatioSwitch: false,
            safeAreaOverlay: true,
            focalPoint: true,
        },
        safeArea: {
            top: 5,
            right: 5,
            bottom: 5,
            left: 5,
            label: "Face Safe Zone (Keep eyes & facial center within circle)",
        },
        previewContexts: [
            {
                id: "profile_card",
                label: "Public Profile",
                shape: "rounded",
                aspectRatio: 1.0,
                containerClassName: "w-24 h-24 rounded-2xl border-2 border-black overflow-hidden shadow-[2px_2px_0px_#000]",
                description: "Appears on your main developer showcase card (112x112)",
            },
            {
                id: "navbar",
                label: "Top Bar & Sidebar",
                shape: "circle",
                aspectRatio: 1.0,
                containerClassName: "w-10 h-10 rounded-full border-2 border-black overflow-hidden shadow-[1px_1px_0px_#000]",
                description: "Navigation avatar and user dropdown (40x40)",
            },
            {
                id: "leaderboard",
                label: "Leaderboards",
                shape: "circle",
                aspectRatio: 1.0,
                containerClassName: "w-12 h-12 rounded-full border-2 border-black overflow-hidden shadow-[1.5px_1.5px_0px_#000]",
                description: "Campus rankings & podium listing (48x48)",
            },
        ],
    },

    // -------------------------------------------------------------------------
    // 2. User Profile Cover Banner
    // -------------------------------------------------------------------------
    user_cover: {
        placementId: "user_cover",
        title: "Developer Profile Cover",
        subtitle: "Profile Showcase Hero Banner",
        description: "Choose and position your panoramic banner artwork behind your developer card.",
        aspectRatio: 3.0,
        shape: "rectangle",
        fit: "cover",
        minWidth: 600,
        minHeight: 200,
        recommendedWidth: 1500,
        recommendedHeight: 500,
        maxFileSizeMB: 8,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        exportTarget: {
            width: 1500,
            height: 500,
            mimeType: "image/webp",
            quality: 0.9,
        },
        features: {
            crop: true,
            zoom: true,
            rotate: true,
            flip: false,
            pan: true,
            brightness: true,
            contrast: true,
            saturation: true,
            backgroundFill: true,
            aspectRatioSwitch: false,
            safeAreaOverlay: true,
        },
        safeArea: {
            top: 10,
            right: 8,
            bottom: 10,
            left: 8,
            label: "Banner Focal Area",
        },
        previewContexts: [
            {
                id: "desktop_cover",
                label: "Desktop Profile",
                shape: "banner",
                aspectRatio: 3.0,
                containerClassName: "w-full aspect-[3/1] rounded-2xl border-2 border-black overflow-hidden shadow-[3px_3px_0px_#000]",
                description: "Full-width hero backdrop (1500x500)",
            },
        ],
    },

    // -------------------------------------------------------------------------
    // 3. Club Chapter Logo
    // -------------------------------------------------------------------------
    club_logo: {
        placementId: "club_logo",
        title: "Club Chapter Logo",
        subtitle: "Official Collegiate Chapter Emblem",
        description: "Upload and format your club's emblem. Supports square badges, circular icons, and transparent crests.",
        aspectRatio: 1.0,
        shape: "square",
        fit: "cover",
        minWidth: 128,
        minHeight: 128,
        recommendedWidth: 600,
        recommendedHeight: 600,
        maxFileSizeMB: 5,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
        exportTarget: {
            width: 600,
            height: 600,
            mimeType: "image/png",
            quality: 0.95,
        },
        features: {
            crop: true,
            zoom: true,
            rotate: true,
            flip: true,
            pan: true,
            brightness: true,
            contrast: true,
            saturation: true,
            exposure: true,
            warmth: true,
            sharpness: true,
            blur: true,
            grayscale: true,
            filterPresets: true,
            backgroundFill: true,
            aspectRatioSwitch: false,
            fitModes: true,
            focalPoint: true,
            safeAreaOverlay: true,
        },
        safeArea: {
            top: 8,
            right: 8,
            bottom: 8,
            left: 8,
            label: "Logo Safe Margins (Keep artwork inside circle boundary)",
        },
        previewContexts: [
            {
                id: "club_header",
                label: "Club Profile Header",
                shape: "rounded",
                aspectRatio: 1.0,
                containerClassName: "w-20 h-20 rounded-2xl bg-white border-2 border-black overflow-hidden shadow-[3px_3px_0px_#000]",
                description: "Overlapping hero emblem on public club page (112x112)",
            },
            {
                id: "club_card",
                label: "Explore Card",
                shape: "rounded",
                aspectRatio: 1.0,
                containerClassName: "w-14 h-14 rounded-xl bg-white border-2 border-black overflow-hidden shadow-[2px_2px_0px_#000]",
                description: "Club discovery listings (56x56)",
            },
            {
                id: "club_sidebar",
                label: "Club Portal Sidebar",
                shape: "circle",
                aspectRatio: 1.0,
                containerClassName: "w-10 h-10 rounded-full bg-white border-2 border-black overflow-hidden shadow-[1px_1px_0px_#000]",
                description: "Navigation badge in club workspace (40x40)",
            },
        ],
    },

    // -------------------------------------------------------------------------
    // 4. Club Header Banner
    // -------------------------------------------------------------------------
    club_banner: {
        placementId: "club_banner",
        title: "Club Header Banner",
        subtitle: "Panoramic Chapter Hero Visual",
        description: "Adjust composition and alignment for your club's hero banner. Pay attention to the bottom-left zone where the club logo overlaps.",
        aspectRatio: 2.6, // Balanced between 2.4/1 (mobile) and 2.8/1 (desktop)
        aspectRatioPresets: [
            { id: "club_standard", label: "Hero Banner (2.6:1)", ratio: 2.6, width: 1300, height: 500, description: "Default wide banner ratio" },
            { id: "club_wide", label: "Ultra-Wide (3:1)", ratio: 3.0, width: 1500, height: 500, description: "Ultra-wide widescreen banner" },
            { id: "club_card", label: "Card Ratio (2.4:1)", ratio: 2.4, width: 1200, height: 500, description: "Card preview thumbnail" },
        ],
        shape: "rectangle",
        fit: "contain",
        minWidth: 800,
        minHeight: 300,
        recommendedWidth: 1400,
        recommendedHeight: 540,
        maxFileSizeMB: 8,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        exportTarget: {
            width: 1400,
            height: 540,
            mimeType: "image/webp",
            quality: 0.9,
        },
        features: {
            crop: true,
            zoom: true,
            rotate: true,
            flip: true,
            pan: true,
            brightness: true,
            contrast: true,
            saturation: true,
            exposure: true,
            warmth: true,
            sharpness: true,
            blur: true,
            grayscale: true,
            filterPresets: true,
            backgroundFill: true,
            aspectRatioSwitch: true,
            freeformCrop: true,
            fitModes: true,
            focalPoint: true,
            safeAreaOverlay: true,
        },
        safeArea: {
            top: 8,
            right: 6,
            bottom: 8,
            left: 6,
            label: "Text & Artwork Safe Zone",
            overlapZone: {
                position: "bottom-left",
                widthPercent: 22,
                heightPercent: 38,
                label: "Club Logo Overlap Area",
            },
        },
        previewContexts: [
            {
                id: "public_club_hero",
                label: "Public Club Profile",
                shape: "banner",
                aspectRatio: 2.6,
                containerClassName: "w-full aspect-[2.6/1] max-h-48 rounded-xl bg-neutral-950 border-2 border-black overflow-hidden shadow-[3px_3px_0px_#000]",
                description: "Full-width hero header on club profile page",
            },
            {
                id: "club_listing_card",
                label: "Club Directory Card",
                shape: "banner",
                aspectRatio: 2.4,
                containerClassName: "w-full aspect-[2.4/1] max-h-36 rounded-xl bg-neutral-950 border-2 border-black overflow-hidden shadow-[2px_2px_0px_#000]",
                description: "Club discovery card header",
            },
        ],
    },

    // -------------------------------------------------------------------------
    // 5. Event Banner & Poster
    // -------------------------------------------------------------------------
    event_banner: {
        placementId: "event_banner",
        title: "Event Banner & Poster Artwork",
        subtitle: "Multi-Surface Event Visual System",
        description: "Position artwork, preserve key dates and titles, and preview across Event Cards, Hero Headers, and 3D QR Pass Invitations.",
        aspectRatio: 2.4, // Primary Orbix event ratio: 2.4:1
        aspectRatioPresets: [
            { id: "event_hero", label: "Banner Card (2.4:1)", ratio: 2.4, width: 1200, height: 500, description: "Official event card & portal hero" },
            { id: "event_standard", label: "Standard 16:9", ratio: 16 / 9, width: 1200, height: 675, description: "Standard widescreen landscape" },
            { id: "event_poster", label: "Editorial Poster (4:5)", ratio: 4 / 5, width: 800, height: 1000, description: "Portrait print & mobile pass" },
            { id: "event_story", label: "Story Format (9:16)", ratio: 9 / 16, width: 720, height: 1280, description: "Vertical Instagram & WhatsApp story" },
            { id: "event_square", label: "Square Feed (1:1)", ratio: 1.0, width: 800, height: 800, description: "Square feed promotion" },
            { id: "event_freeform", label: "Freeform Crop", ratio: 0, width: 1200, height: 800, description: "Custom boundary sizing" },
        ],
        shape: "rectangle",
        fit: "contain",
        minWidth: 800,
        minHeight: 330,
        recommendedWidth: 1440,
        recommendedHeight: 600,
        maxFileSizeMB: 8,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        exportTarget: {
            width: 1440,
            height: 600,
            mimeType: "image/webp",
            quality: 0.92,
        },
        features: {
            crop: true,
            zoom: true,
            rotate: true,
            flip: true,
            pan: true,
            brightness: true,
            contrast: true,
            saturation: true,
            exposure: true,
            warmth: true,
            sharpness: true,
            blur: true,
            grayscale: true,
            filterPresets: true,
            backgroundFill: true,
            aspectRatioSwitch: true,
            freeformCrop: true,
            fitModes: true,
            focalPoint: true,
            safeAreaOverlay: true,
        },
        safeArea: {
            top: 10,
            right: 8,
            bottom: 10,
            left: 8,
            label: "Text & Title Safe Zone (Keep event name & date visible)",
        },
        previewContexts: [
            {
                id: "event_card_preview",
                label: "Event Listing Card",
                shape: "banner",
                aspectRatio: 2.4,
                containerClassName: "w-full aspect-[2.4/1] max-h-44 rounded-xl bg-neutral-950 border-2 border-black overflow-hidden shadow-[2px_2px_0px_#000]",
                description: "Rendered in campus & national event listings (object-contain)",
            },
            {
                id: "event_detail_hero",
                label: "Event Detail Page Hero",
                shape: "banner",
                aspectRatio: 2.4,
                containerClassName: "w-full aspect-[2.4/1] max-h-56 rounded-2xl bg-neutral-950 border-2 border-black overflow-hidden shadow-[3px_3px_0px_#000]",
                description: "Main visual banner on event landing page",
            },
            {
                id: "event_pass_front",
                label: "Editorial Pass Front",
                shape: "banner",
                aspectRatio: 2.4,
                containerClassName: "w-full aspect-[2.4/1] max-h-40 bg-neutral-950 border-b-2 border-black overflow-hidden",
                description: "Header on 3D downloadable registration pass",
            },
        ],
    },

    // -------------------------------------------------------------------------
    // 6. Club Coordinator Photo
    // -------------------------------------------------------------------------
    club_coordinator: {
        placementId: "club_coordinator",
        title: "Coordinator Photo",
        subtitle: "Chapter Lead & Organizer Portrait",
        description: "Center student organizers and lead coordinators with a crisp portrait crop.",
        aspectRatio: 1.0,
        shape: "square",
        fit: "cover",
        minWidth: 128,
        minHeight: 128,
        recommendedWidth: 400,
        recommendedHeight: 400,
        maxFileSizeMB: 5,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        exportTarget: {
            width: 400,
            height: 400,
            mimeType: "image/webp",
            quality: 0.9,
        },
        features: {
            crop: true,
            zoom: true,
            rotate: true,
            flip: true,
            pan: true,
            brightness: true,
            contrast: true,
            saturation: true,
            exposure: true,
            warmth: true,
            sharpness: true,
            blur: true,
            grayscale: true,
            filterPresets: true,
            backgroundFill: false,
            aspectRatioSwitch: false,
            safeAreaOverlay: true,
            focalPoint: true,
        },
        safeArea: {
            top: 6,
            right: 6,
            bottom: 6,
            left: 6,
            label: "Portrait Center Safe Zone",
        },
        previewContexts: [
            {
                id: "coordinator_card",
                label: "Team Card",
                shape: "rounded",
                aspectRatio: 1.0,
                containerClassName: "w-14 h-14 rounded-2xl bg-white border-2 border-black overflow-hidden shadow-[2px_2px_0px_#000]",
                description: "Chapter leads grid on public club profile (56x56)",
            },
        ],
    },

    // -------------------------------------------------------------------------
    // 7. Club Achievement Badge
    // -------------------------------------------------------------------------
    club_achievement: {
        placementId: "club_achievement",
        title: "Achievement Badge",
        subtitle: "Award, Milestone, or Trophy Distinction",
        description: "Center certificates, hackathon trophies, and distinction badges.",
        aspectRatio: 1.0,
        shape: "square",
        fit: "contain",
        minWidth: 100,
        minHeight: 100,
        recommendedWidth: 400,
        recommendedHeight: 400,
        maxFileSizeMB: 5,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp", "image/svg+xml"],
        exportTarget: {
            width: 400,
            height: 400,
            mimeType: "image/png",
            quality: 0.95,
        },
        features: {
            crop: true,
            zoom: true,
            rotate: true,
            flip: false,
            pan: true,
            brightness: true,
            contrast: true,
            saturation: true,
            backgroundFill: true,
            aspectRatioSwitch: false,
            safeAreaOverlay: true,
        },
        safeArea: {
            top: 8,
            right: 8,
            bottom: 8,
            left: 8,
            label: "Trophy Safe Margins",
        },
        previewContexts: [
            {
                id: "achievement_row",
                label: "Achievement Card",
                shape: "rounded",
                aspectRatio: 1.0,
                containerClassName: "w-12 h-12 rounded-xl bg-[#FFE566] border-2 border-black overflow-hidden shadow-[1px_1px_0px_#000]",
                description: "Distinctions list on public club profile (48x48)",
            },
        ],
    },

    // -------------------------------------------------------------------------
    // 8. Project Primary Cover & Gallery Screenshots
    // -------------------------------------------------------------------------
    project_cover: {
        placementId: "project_cover",
        title: "Project Cover Image",
        subtitle: "Portfolio Project Hero Visual",
        description: "Align your project UI mockup or hero screenshot for portfolio cards and project modal.",
        aspectRatio: 16 / 9,
        aspectRatioPresets: [
            { id: "project_16_9", label: "Widescreen (16:9)", ratio: 16 / 9, width: 1280, height: 720, description: "Standard widescreen presentation" },
            { id: "project_2_1", label: "Panoramic (2:1)", ratio: 2.0, width: 1200, height: 600, description: "Wide landscape hero" },
            { id: "project_4_3", label: "Classic (4:3)", ratio: 4 / 3, width: 1000, height: 750, description: "Detailed screen capture" },
        ],
        shape: "rectangle",
        fit: "cover",
        minWidth: 640,
        minHeight: 360,
        recommendedWidth: 1280,
        recommendedHeight: 720,
        maxFileSizeMB: 10,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        exportTarget: {
            width: 1280,
            height: 720,
            mimeType: "image/webp",
            quality: 0.9,
        },
        features: {
            crop: true,
            zoom: true,
            rotate: true,
            flip: true,
            pan: true,
            brightness: true,
            contrast: true,
            saturation: true,
            exposure: true,
            warmth: true,
            sharpness: true,
            blur: true,
            grayscale: true,
            filterPresets: true,
            backgroundFill: true,
            aspectRatioSwitch: true,
            freeformCrop: true,
            fitModes: true,
            focalPoint: true,
            safeAreaOverlay: true,
        },
        safeArea: {
            top: 5,
            right: 5,
            bottom: 5,
            left: 5,
            label: "Screenshot Safe Area",
        },
        previewContexts: [
            {
                id: "project_card",
                label: "Project Card",
                shape: "rounded",
                aspectRatio: 16 / 9,
                containerClassName: "w-full aspect-[16/9] max-h-44 rounded-xl border-2 border-black overflow-hidden shadow-[2px_2px_0px_#000]",
                description: "Portfolio grid and public showcase",
            },
        ],
    },

    // -------------------------------------------------------------------------
    // 9. Event Registration Form Header Banner
    // -------------------------------------------------------------------------
    form_header: {
        placementId: "form_header",
        title: "Registration Form Banner",
        subtitle: "Form Theme Header Artwork",
        description: "Align your custom header banner displayed at the top of the event registration wizard.",
        aspectRatio: 3.75, // 1200x320
        aspectRatioPresets: [
            { id: "form_ultrawide", label: "Ultra-Wide (3.75:1)", ratio: 3.75, width: 1200, height: 320, description: "Compact form header banner" },
            { id: "form_standard", label: "Panoramic (3:1)", ratio: 3.0, width: 1200, height: 400, description: "Standard form header banner" },
        ],
        shape: "rectangle",
        fit: "cover",
        minWidth: 800,
        minHeight: 250,
        recommendedWidth: 1200,
        recommendedHeight: 320,
        maxFileSizeMB: 8,
        allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
        exportTarget: {
            width: 1200,
            height: 320,
            mimeType: "image/webp",
            quality: 0.9,
        },
        features: {
            crop: true,
            zoom: true,
            rotate: true,
            flip: true,
            pan: true,
            brightness: true,
            contrast: true,
            saturation: true,
            exposure: true,
            warmth: true,
            sharpness: true,
            blur: true,
            grayscale: true,
            filterPresets: true,
            backgroundFill: true,
            aspectRatioSwitch: true,
            freeformCrop: true,
            fitModes: true,
            focalPoint: true,
            safeAreaOverlay: true,
        },
        safeArea: {
            top: 8,
            right: 6,
            bottom: 8,
            left: 6,
            label: "Header Text Safe Zone",
        },
        previewContexts: [
            {
                id: "form_live_header",
                label: "Student Registration Wizard",
                shape: "banner",
                aspectRatio: 3.75,
                containerClassName: "w-full h-32 rounded-2xl border-2 border-black overflow-hidden shadow-[2px_2px_0px_#000]",
                description: "Rendered above registration questions",
            },
        ],
    },

    // -------------------------------------------------------------------------
    // 10. Certificate Crest / Seal / Logo
    // -------------------------------------------------------------------------
    certificate_crest: {
        placementId: "certificate_crest",
        title: "Certificate Seal & Crest",
        subtitle: "Official Institutional Verification Mark",
        description: "Format organization crests and collegiate seals with transparency support.",
        aspectRatio: 1.0,
        shape: "circle",
        fit: "contain",
        minWidth: 128,
        minHeight: 128,
        recommendedWidth: 600,
        recommendedHeight: 600,
        maxFileSizeMB: 5,
        allowedMimeTypes: ["image/png", "image/svg+xml", "image/webp"],
        exportTarget: {
            width: 600,
            height: 600,
            mimeType: "image/png",
            quality: 0.98,
        },
        features: {
            crop: true,
            zoom: true,
            rotate: true,
            flip: false,
            pan: true,
            brightness: true,
            contrast: true,
            saturation: false,
            backgroundFill: false,
            aspectRatioSwitch: false,
            safeAreaOverlay: true,
        },
        safeArea: {
            top: 5,
            right: 5,
            bottom: 5,
            left: 5,
            label: "Crest Safe Boundary",
        },
        previewContexts: [
            {
                id: "certificate_seal_preview",
                label: "Certificate Canvas Seal",
                shape: "circle",
                aspectRatio: 1.0,
                containerClassName: "w-16 h-16 rounded-full border border-black overflow-hidden",
                description: "Rendered on issued PDF and verification page",
            },
        ],
    },
};

/**
 * Returns configuration for a placement ID, falling back to user_avatar if not found.
 */
export function getMediaPlacementConfig(placementId: string): MediaPlacementConfig {
    return MEDIA_PLACEMENTS[placementId] || MEDIA_PLACEMENTS.user_avatar;
}
