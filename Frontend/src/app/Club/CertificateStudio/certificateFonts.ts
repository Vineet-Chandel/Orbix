import "./certificateFonts.css";

export type CertificateFontCategory =
    | "Formal Serif"
    | "Calligraphy & Script"
    | "Modern Sans"
    | "Monospace";

export interface CertificateFontDefinition {
    id: string;
    label: string;
    category: CertificateFontCategory;
    fontFamily: string; // CSS font-family stack with quotes and fallbacks
    description: string;
}

/**
 * Curated list of the best and most widely used fonts for certificates,
 * diplomas, awards, credentials, and verification seals.
 */
export const CERTIFICATE_FONTS: CertificateFontDefinition[] = [
    // --- 1. Classical & Formal Serif (Diplomas, Honors, Titles, Citations) ---
    {
        id: "Cinzel",
        label: "Cinzel",
        category: "Formal Serif",
        fontFamily: "'Cinzel', Georgia, 'Times New Roman', serif",
        description: "Classical Roman proportions — the gold standard for certificate headers",
    },
    {
        id: "Cinzel Decorative",
        label: "Cinzel Decorative",
        category: "Formal Serif",
        fontFamily: "'Cinzel Decorative', 'Cinzel', Georgia, serif",
        description: "Ornate Roman capitals with swashes and regal flourishes",
    },
    {
        id: "Playfair Display",
        label: "Playfair Display",
        category: "Formal Serif",
        fontFamily: "'Playfair Display', Georgia, 'Times New Roman', serif",
        description: "Prestigious high-contrast serif for titles and headings",
    },
    {
        id: "Cormorant Garamond",
        label: "Cormorant Garamond",
        category: "Formal Serif",
        fontFamily: "'Cormorant Garamond', Garamond, 'Times New Roman', serif",
        description: "Classic academic & university diploma serif",
    },
    {
        id: "EB Garamond",
        label: "EB Garamond",
        category: "Formal Serif",
        fontFamily: "'EB Garamond', Garamond, 'Times New Roman', serif",
        description: "Timeless Renaissance serif for body citations and formal decrees",
    },
    {
        id: "Merriweather",
        label: "Merriweather",
        category: "Formal Serif",
        fontFamily: "'Merriweather', Georgia, 'Times New Roman', serif",
        description: "Stately, highly legible serif for citation paragraphs",
    },
    {
        id: "Libre Baskerville",
        label: "Libre Baskerville",
        category: "Formal Serif",
        fontFamily: "'Libre Baskerville', Baskerville, Georgia, serif",
        description: "Authoritative institutional serif for accreditation credentials",
    },
    {
        id: "Bodoni Moda",
        label: "Bodoni Moda",
        category: "Formal Serif",
        fontFamily: "'Bodoni Moda', 'Bodoni MT', Didot, Georgia, serif",
        description: "Luxury high-contrast serif for gala awards and premier distinctions",
    },

    // --- 2. Calligraphic & Script (Recipient Names, Signatures, Distinction) ---
    {
        id: "Great Vibes",
        label: "Great Vibes",
        category: "Calligraphy & Script",
        fontFamily: "'Great Vibes', 'Brush Script MT', cursive",
        description: "Flowing elegant calligraphy — #1 choice for recipient names",
    },
    {
        id: "Alex Brush",
        label: "Alex Brush",
        category: "Calligraphy & Script",
        fontFamily: "'Alex Brush', 'Brush Script MT', cursive",
        description: "Fluid, highly legible brush cursive for names and signatures",
    },
    {
        id: "Pinyon Script",
        label: "Pinyon Script",
        category: "Calligraphy & Script",
        fontFamily: "'Pinyon Script', 'Brush Script MT', cursive",
        description: "Aristocratic high-slant calligraphy for luxury academic honors",
    },
    {
        id: "Allura",
        label: "Allura",
        category: "Calligraphy & Script",
        fontFamily: "'Allura', 'Brush Script MT', cursive",
        description: "Clean, refined flowing script for certificate citations",
    },
    {
        id: "Dancing Script",
        label: "Dancing Script",
        category: "Calligraphy & Script",
        fontFamily: "'Dancing Script', cursive",
        description: "Lively, modern casual script for club participation awards",
    },
    {
        id: "Parisienne",
        label: "Parisienne",
        category: "Calligraphy & Script",
        fontFamily: "'Parisienne', cursive",
        description: "Romantic French calligraphy for arts and cultural recognitions",
    },

    // --- 3. Modern & Tech Sans-Serif (Modern Certs, Tech Hackathons, Summits) ---
    {
        id: "Montserrat",
        label: "Montserrat",
        category: "Modern Sans",
        fontFamily: "'Montserrat', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        description: "Clean geometric sans — modern corporate certificate standard",
    },
    {
        id: "Space Grotesk",
        label: "Space Grotesk",
        category: "Modern Sans",
        fontFamily: "'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        description: "Neo-brutalist tech display font for hackathons and summits",
    },
    {
        id: "Poppins",
        label: "Poppins",
        category: "Modern Sans",
        fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        description: "Crisp geometric sans — Orbix signature style",
    },
    {
        id: "Inter",
        label: "Inter",
        category: "Modern Sans",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        description: "Ultra-clean sans for credential metadata, hashes, and dates",
    },
    {
        id: "Outfit",
        label: "Outfit",
        category: "Modern Sans",
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        description: "Contemporary high-end geometric sans",
    },
    {
        id: "Roboto",
        label: "Roboto",
        category: "Modern Sans",
        fontFamily: "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        description: "Clean universal corporate sans",
    },
    {
        id: "Open Sans",
        label: "Open Sans",
        category: "Modern Sans",
        fontFamily: "'Open Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        description: "Balanced, highly readable neutral sans",
    },
    {
        id: "Lato",
        label: "Lato",
        category: "Modern Sans",
        fontFamily: "'Lato', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        description: "Warm humanist sans with classical proportions",
    },
    {
        id: "Oswald",
        label: "Oswald",
        category: "Modern Sans",
        fontFamily: "'Oswald', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
        description: "Bold condensed display for badges, headers, and dates",
    },

    // --- 4. Monospace & Security / Accreditation ---
    {
        id: "Courier Prime",
        label: "Courier Prime",
        category: "Monospace",
        fontFamily: "'Courier Prime', 'Courier New', Courier, monospace",
        description: "Classic typewriter — certificate serials and verification seals",
    },
    {
        id: "JetBrains Mono",
        label: "JetBrains Mono",
        category: "Monospace",
        fontFamily: "'JetBrains Mono', Menlo, Monaco, Consolas, monospace",
        description: "Developer code font for hackathon and engineering awards",
    },
];

// Lookup maps for fast font family resolution
const fontMap = new Map<string, string>();
for (const f of CERTIFICATE_FONTS) {
    fontMap.set(f.id.toLowerCase(), f.fontFamily);
}

/**
 * Returns the CSS font-family string with fallbacks for a given font name or id.
 * Handles legacy names, partial names, or font strings that already have fallbacks.
 */
export function getCertificateFontFamily(fontName?: string): string {
    if (!fontName) {
        return "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    }

    const clean = fontName.trim();
    if (!clean) {
        return "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    }

    // Direct case-insensitive match
    const lower = clean.toLowerCase();
    if (fontMap.has(lower)) {
        return fontMap.get(lower)!;
    }

    // Extract first token if it's a comma-separated list e.g. "Space Grotesk, sans-serif"
    const firstFamily = lower.split(",")[0].replace(/['"]/g, "").trim();
    if (fontMap.has(firstFamily)) {
        return fontMap.get(firstFamily)!;
    }

    // Search for any substring match across curated fonts
    for (const f of CERTIFICATE_FONTS) {
        const idLower = f.id.toLowerCase();
        if (lower.includes(idLower) || idLower.includes(firstFamily)) {
            return f.fontFamily;
        }
    }

    // If it already contains quotes or commas, trust the string
    if (clean.includes(",") || clean.includes("'") || clean.includes('"')) {
        return clean;
    }

    // Fallback: quote font name and add system sans-serif fallback
    return `'${clean}', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif`;
}

/**
 * Options array configured for NeoSelect with font preview styles and category tags.
 */
export const CERTIFICATE_FONT_OPTIONS = CERTIFICATE_FONTS.map((font) => ({
    value: font.id,
    label: font.label,
    description: `${font.category} • ${font.description}`,
    style: { fontFamily: font.fontFamily },
}));

/**
 * Estimates the minimum bounding box height needed for wrapped/multiline text.
 * Prevents text overflow by allowing element containers to auto-adjust vertically.
 */
export function estimateTextContentHeight(
    text: string,
    width: number,
    fontSize: number = 24,
    lineHeight: number = 1.3,
    letterSpacing: number = 0
): number {
    if (!text) return Math.max(28, Math.round(fontSize * lineHeight));

    const paragraphs = text.split("\n");
    let totalLines = 0;

    // Approximate average glyph width ~ 0.55 * fontSize + tracking
    const avgCharWidth = Math.max(6, fontSize * 0.55 + (letterSpacing || 0));
    const effectiveWidth = Math.max(width - 8, 40);
    const charsPerLine = Math.max(Math.floor(effectiveWidth / avgCharWidth), 1);

    for (const para of paragraphs) {
        if (!para.trim()) {
            totalLines += 1;
            continue;
        }

        const words = para.split(" ");
        let currentLineLength = 0;
        let paraLines = 1;

        for (const word of words) {
            const wordLen = word.length;
            if (wordLen > charsPerLine) {
                paraLines += Math.floor(wordLen / charsPerLine);
                currentLineLength = wordLen % charsPerLine;
                continue;
            }

            if (currentLineLength === 0) {
                currentLineLength = wordLen;
            } else if (currentLineLength + 1 + wordLen <= charsPerLine) {
                currentLineLength += 1 + wordLen;
            } else {
                paraLines += 1;
                currentLineLength = wordLen;
            }
        }

        totalLines += paraLines;
    }

    const calculatedHeight = Math.round(totalLines * fontSize * lineHeight + 8);
    return Math.max(calculatedHeight, Math.round(fontSize * lineHeight + 8));
}
