import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { createRequire } from "module";
import type { ResumeContent, ExportValidationResult } from "./resumeTypes.js";

const require = createRequire(import.meta.url || (process.cwd() + "/package.json"));
const { PDFParse } = require("pdf-parse");

export async function generateAtsPdf(
    content: ResumeContent,
    options: { templateId?: string } = {}
): Promise<{ pdfBuffer: Buffer; validation: ExportValidationResult }> {
    const doc = await PDFDocument.create();

    const fontRegular = await doc.embedFont(StandardFonts.Helvetica);
    const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
    const fontItalic = await doc.embedFont(StandardFonts.HelveticaOblique);

    const PAGE_WIDTH = 612; // Standard Letter width in points
    const PAGE_HEIGHT = 792; // Standard Letter height in points
    const MARGIN_LEFT = 36;
    const MARGIN_RIGHT = 36;
    const MARGIN_TOP = 40;
    const MARGIN_BOTTOM = 36;
    const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;

    let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let currentY = PAGE_HEIGHT - MARGIN_TOP;

    const checkPageBreak = (neededHeight: number) => {
        if (currentY - neededHeight < MARGIN_BOTTOM) {
            page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            currentY = PAGE_HEIGHT - MARGIN_TOP;
        }
    };

    const drawSectionTitle = (title: string) => {
        checkPageBreak(30);
        currentY -= 14;
        page.drawText(title.toUpperCase(), {
            x: MARGIN_LEFT,
            y: currentY,
            size: 11,
            font: fontBold,
            color: rgb(0.1, 0.1, 0.1),
        });

        currentY -= 4;
        page.drawLine({
            start: { x: MARGIN_LEFT, y: currentY },
            end: { x: PAGE_WIDTH - MARGIN_RIGHT, y: currentY },
            thickness: 0.75,
            color: rgb(0.3, 0.3, 0.3),
        });
        currentY -= 8;
    };

    const wrapText = (text: string, font: any, size: number, maxWidth: number): string[] => {
        const words = text.split(/\s+/);
        const lines: string[] = [];
        let curLine = "";

        for (const w of words) {
            const testLine = curLine ? `${curLine} ${w}` : w;
            const width = font.widthOfTextAtSize(testLine, size);
            if (width > maxWidth && curLine) {
                lines.push(curLine);
                curLine = w;
            } else {
                curLine = testLine;
            }
        }
        if (curLine) lines.push(curLine);
        return lines;
    };

    // =========================================================================
    // 1. HEADER: Candidate Name & Headline
    // =========================================================================
    const name = content.contact.fullName || "Candidate Name";
    const nameWidth = fontBold.widthOfTextAtSize(name, 19);
    page.drawText(name, {
        x: (PAGE_WIDTH - nameWidth) / 2,
        y: currentY,
        size: 19,
        font: fontBold,
        color: rgb(0.05, 0.05, 0.05),
    });
    currentY -= 15;

    if (content.contact.headline) {
        const headlineWidth = fontRegular.widthOfTextAtSize(content.contact.headline, 10);
        page.drawText(content.contact.headline, {
            x: (PAGE_WIDTH - headlineWidth) / 2,
            y: currentY,
            size: 10,
            font: fontRegular,
            color: rgb(0.25, 0.25, 0.25),
        });
        currentY -= 14;
    }

    // 2. CONTACT DETAILS ROW
    const contactParts: string[] = [];
    if (content.contact.includeEmail && content.contact.email) contactParts.push(content.contact.email);
    if (content.contact.includePhone && content.contact.phone) contactParts.push(content.contact.phone);
    if (content.contact.includeLocation && content.contact.location) contactParts.push(content.contact.location);
    if (content.contact.githubUrl) {
        const cleanGh = content.contact.githubUrl.replace(/^https?:\/\/(www\.)?github\.com\//i, "github.com/");
        contactParts.push(cleanGh);
    }
    if (content.contact.linkedinUrl) {
        const cleanLi = content.contact.linkedinUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "linkedin.com/in/");
        contactParts.push(cleanLi);
    }
    if (content.contact.portfolioUrl) {
        const cleanPort = content.contact.portfolioUrl.replace(/^https?:\/\/(www\.)?/i, "");
        contactParts.push(cleanPort);
    }

    if (contactParts.length > 0) {
        const contactLine = contactParts.join("  |  ");
        const contactWidth = fontRegular.widthOfTextAtSize(contactLine, 8.5);
        const contactX = Math.max(MARGIN_LEFT, (PAGE_WIDTH - contactWidth) / 2);

        page.drawText(contactLine, {
            x: contactX,
            y: currentY,
            size: 8.5,
            font: fontRegular,
            color: rgb(0.2, 0.2, 0.2),
        });
        currentY -= 14;
    }

    // =========================================================================
    // 2. PROFESSIONAL SUMMARY
    // =========================================================================
    if (content.summary && content.visibleSections?.summary !== false) {
        drawSectionTitle("Professional Summary");
        const lines = wrapText(content.summary, fontRegular, 9, CONTENT_WIDTH);
        for (const line of lines) {
            checkPageBreak(12);
            page.drawText(line, {
                x: MARGIN_LEFT,
                y: currentY,
                size: 9,
                font: fontRegular,
                color: rgb(0.15, 0.15, 0.15),
            });
            currentY -= 12;
        }
    }

    // =========================================================================
    // 3. EDUCATION
    // =========================================================================
    if (content.education && content.education.length > 0 && content.visibleSections?.education !== false) {
        drawSectionTitle("Education");
        for (const edu of content.education) {
            checkPageBreak(24);
            // Institution & Location
            page.drawText(edu.institution, {
                x: MARGIN_LEFT,
                y: currentY,
                size: 10,
                font: fontBold,
                color: rgb(0.1, 0.1, 0.1),
            });
            if (edu.location) {
                const locWidth = fontRegular.widthOfTextAtSize(edu.location, 9);
                page.drawText(edu.location, {
                    x: PAGE_WIDTH - MARGIN_RIGHT - locWidth,
                    y: currentY,
                    size: 9,
                    font: fontRegular,
                    color: rgb(0.3, 0.3, 0.3),
                });
            }
            currentY -= 12;

            // Degree & Graduation Date
            const degreeText = `${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ""}${edu.cgpa ? `  (CGPA: ${edu.cgpa})` : ""}`;
            page.drawText(degreeText, {
                x: MARGIN_LEFT,
                y: currentY,
                size: 9,
                font: fontItalic,
                color: rgb(0.2, 0.2, 0.2),
            });
            if (edu.expectedGraduation || edu.endDate) {
                const dateText = edu.expectedGraduation ? `Graduating: ${edu.expectedGraduation}` : edu.endDate || "";
                const dateWidth = fontRegular.widthOfTextAtSize(dateText, 8.5);
                page.drawText(dateText, {
                    x: PAGE_WIDTH - MARGIN_RIGHT - dateWidth,
                    y: currentY,
                    size: 8.5,
                    font: fontRegular,
                    color: rgb(0.3, 0.3, 0.3),
                });
            }
            currentY -= 12;

            // Highlights
            if (edu.highlights && edu.highlights.length > 0) {
                for (const h of edu.highlights) {
                    const hLines = wrapText(`•  ${h}`, fontRegular, 8.5, CONTENT_WIDTH - 12);
                    for (const hl of hLines) {
                        checkPageBreak(11);
                        page.drawText(hl, {
                            x: MARGIN_LEFT + 8,
                            y: currentY,
                            size: 8.5,
                            font: fontRegular,
                            color: rgb(0.25, 0.25, 0.25),
                        });
                        currentY -= 11;
                    }
                }
            }
            currentY -= 3;
        }
    }

    // =========================================================================
    // 4. SKILLS & TECHNOLOGIES
    // =========================================================================
    if (content.skills && content.skills.length > 0 && content.visibleSections?.skills !== false) {
        drawSectionTitle("Technical Skills");
        for (const cat of content.skills) {
            checkPageBreak(14);
            const linePrefix = `${cat.category}: `;
            const prefixWidth = fontBold.widthOfTextAtSize(linePrefix, 9);
            const remainingWidth = CONTENT_WIDTH - prefixWidth;

            const skillsJoined = cat.items.join(", ");
            const lines = wrapText(skillsJoined, fontRegular, 9, remainingWidth);

            page.drawText(linePrefix, {
                x: MARGIN_LEFT,
                y: currentY,
                size: 9,
                font: fontBold,
                color: rgb(0.1, 0.1, 0.1),
            });

            if (lines[0]) {
                page.drawText(lines[0], {
                    x: MARGIN_LEFT + prefixWidth,
                    y: currentY,
                    size: 9,
                    font: fontRegular,
                    color: rgb(0.2, 0.2, 0.2),
                });
            }
            currentY -= 12;

            for (let i = 1; i < lines.length; i++) {
                checkPageBreak(12);
                page.drawText(lines[i]!, {
                    x: MARGIN_LEFT + prefixWidth,
                    y: currentY,
                    size: 9,
                    font: fontRegular,
                    color: rgb(0.2, 0.2, 0.2),
                });
                currentY -= 12;
            }
        }
        currentY -= 2;
    }

    // =========================================================================
    // 5. PROJECTS
    // =========================================================================
    if (content.projects && content.projects.length > 0 && content.visibleSections?.projects !== false) {
        drawSectionTitle("Software Engineering Projects");
        for (const proj of content.projects) {
            checkPageBreak(24);
            // Title & Technologies
            const titleText = proj.title;
            page.drawText(titleText, {
                x: MARGIN_LEFT,
                y: currentY,
                size: 10,
                font: fontBold,
                color: rgb(0.1, 0.1, 0.1),
            });

            if (proj.technologies && proj.technologies.length > 0) {
                const techText = `|  ${proj.technologies.join(", ")}`;
                const titleWidth = fontBold.widthOfTextAtSize(titleText, 10);
                page.drawText(techText, {
                    x: MARGIN_LEFT + titleWidth + 6,
                    y: currentY,
                    size: 8.5,
                    font: fontItalic,
                    color: rgb(0.3, 0.3, 0.3),
                });
            }

            if (proj.liveUrl || proj.githubUrl) {
                const linkText = proj.liveUrl || proj.githubUrl || "";
                const cleanLink = linkText.replace(/^https?:\/\//i, "");
                const linkWidth = fontRegular.widthOfTextAtSize(cleanLink, 8.5);
                page.drawText(cleanLink, {
                    x: PAGE_WIDTH - MARGIN_RIGHT - linkWidth,
                    y: currentY,
                    size: 8.5,
                    font: fontRegular,
                    color: rgb(0.1, 0.35, 0.75),
                });
            }
            currentY -= 12;

            // Project Bullets
            for (const bullet of proj.bullets || []) {
                const bLines = wrapText(bullet, fontRegular, 8.5, CONTENT_WIDTH - 14);
                for (let idx = 0; idx < bLines.length; idx++) {
                    checkPageBreak(11);
                    if (idx === 0) {
                        page.drawText("•", {
                            x: MARGIN_LEFT + 4,
                            y: currentY,
                            size: 9,
                            font: fontBold,
                            color: rgb(0.2, 0.2, 0.2),
                        });
                    }
                    page.drawText(bLines[idx]!, {
                        x: MARGIN_LEFT + 14,
                        y: currentY,
                        size: 8.5,
                        font: fontRegular,
                        color: rgb(0.2, 0.2, 0.2),
                    });
                    currentY -= 11;
                }
            }
            currentY -= 4;
        }
    }

    // =========================================================================
    // 6. WORK EXPERIENCE & INTERNSHIPS
    // =========================================================================
    if (content.experience && content.experience.length > 0 && content.visibleSections?.experience !== false) {
        drawSectionTitle("Work Experience & Internships");
        for (const exp of content.experience) {
            checkPageBreak(24);
            page.drawText(exp.company, {
                x: MARGIN_LEFT,
                y: currentY,
                size: 10,
                font: fontBold,
                color: rgb(0.1, 0.1, 0.1),
            });

            if (exp.location) {
                const locWidth = fontRegular.widthOfTextAtSize(exp.location, 9);
                page.drawText(exp.location, {
                    x: PAGE_WIDTH - MARGIN_RIGHT - locWidth,
                    y: currentY,
                    size: 9,
                    font: fontRegular,
                    color: rgb(0.3, 0.3, 0.3),
                });
            }
            currentY -= 12;

            page.drawText(exp.role, {
                x: MARGIN_LEFT,
                y: currentY,
                size: 9,
                font: fontItalic,
                color: rgb(0.2, 0.2, 0.2),
            });

            const dateStr = [exp.startDate, exp.isCurrent ? "Present" : exp.endDate].filter(Boolean).join(" - ");
            if (dateStr) {
                const dateWidth = fontRegular.widthOfTextAtSize(dateStr, 8.5);
                page.drawText(dateStr, {
                    x: PAGE_WIDTH - MARGIN_RIGHT - dateWidth,
                    y: currentY,
                    size: 8.5,
                    font: fontRegular,
                    color: rgb(0.3, 0.3, 0.3),
                });
            }
            currentY -= 12;

            for (const bullet of exp.bullets || []) {
                const bLines = wrapText(bullet, fontRegular, 8.5, CONTENT_WIDTH - 14);
                for (let idx = 0; idx < bLines.length; idx++) {
                    checkPageBreak(11);
                    if (idx === 0) {
                        page.drawText("•", {
                            x: MARGIN_LEFT + 4,
                            y: currentY,
                            size: 9,
                            font: fontBold,
                            color: rgb(0.2, 0.2, 0.2),
                        });
                    }
                    page.drawText(bLines[idx]!, {
                        x: MARGIN_LEFT + 14,
                        y: currentY,
                        size: 8.5,
                        font: fontRegular,
                        color: rgb(0.2, 0.2, 0.2),
                    });
                    currentY -= 11;
                }
            }
            currentY -= 4;
        }
    }

    // =========================================================================
    // 7. VERIFIED CODING PROFILES (Orbix Authenticated)
    // =========================================================================
    if (content.codingProfiles && content.codingProfiles.length > 0 && content.visibleSections?.codingProfiles !== false) {
        drawSectionTitle("Verified Coding Profiles & Developer Activity");
        for (const p of content.codingProfiles) {
            checkPageBreak(13);
            const portalCap = p.portal.charAt(0).toUpperCase() + p.portal.slice(1);
            const handleText = `${portalCap} (@${p.username}): `;
            const statsParts: string[] = [];
            if (p.totalSolved) statsParts.push(`${p.totalSolved.toLocaleString()} Problems Solved`);
            if (p.contestRating) statsParts.push(`Rating ${p.contestRating}`);
            if (p.globalRank) statsParts.push(`Rank ${p.globalRank}`);
            if (p.verified) statsParts.push("[Orbix Verified]");

            const statsLine = statsParts.join("  |  ") || p.url;
            page.drawText(`•  ${handleText}`, {
                x: MARGIN_LEFT + 4,
                y: currentY,
                size: 8.5,
                font: fontBold,
                color: rgb(0.1, 0.1, 0.1),
            });

            const handleWidth = fontBold.widthOfTextAtSize(`•  ${handleText}`, 8.5);
            page.drawText(statsLine, {
                x: MARGIN_LEFT + 4 + handleWidth,
                y: currentY,
                size: 8.5,
                font: fontRegular,
                color: rgb(0.25, 0.25, 0.25),
            });
            currentY -= 12;
        }
    }

    // =========================================================================
    // 8. CERTIFICATIONS
    // =========================================================================
    if (content.certifications && content.certifications.length > 0 && content.visibleSections?.certifications !== false) {
        drawSectionTitle("Certifications & Honors");
        for (const cert of content.certifications) {
            checkPageBreak(13);
            const certText = `•  ${cert.title}${cert.issuer ? ` - ${cert.issuer}` : ""}${cert.date ? ` (${cert.date})` : ""}`;
            page.drawText(certText, {
                x: MARGIN_LEFT + 4,
                y: currentY,
                size: 8.5,
                font: fontRegular,
                color: rgb(0.2, 0.2, 0.2),
            });
            currentY -= 12;
        }
    }

    // Save and re-validate
    const pdfBytes = await doc.save();
    const pdfBuffer = Buffer.from(pdfBytes);
    const sizeMb = pdfBuffer.length / (1024 * 1024);

    // Run real post-generation validation using pdf-parse
    let extractedText = "";
    let pageCount = doc.getPageCount();
    try {
        const parser = new PDFParse({ data: pdfBuffer });
        const parsed = await parser.getText();
        extractedText = parsed.text || "";
        if (parsed.total) pageCount = parsed.total;
    } catch (err) {
        console.warn("PDF extraction test warning:", err);
    }

    const verifiedTokensFound: string[] = [];
    const missingTokens: string[] = [];

    const tokensToVerify = [
        content.contact.fullName,
        content.contact.email,
        ...content.education.map((e) => e.institution),
        ...content.skills.flatMap((c) => c.items).slice(0, 5),
    ].filter(Boolean);

    for (const token of tokensToVerify) {
        if (extractedText.toLowerCase().includes(token.toLowerCase())) {
            verifiedTokensFound.push(token);
        } else {
            missingTokens.push(token);
        }
    }

    const validation: ExportValidationResult = {
        success: pdfBuffer.length > 0 && sizeMb <= 5.0 && extractedText.length > 50,
        format: "pdf",
        filesizeBytes: pdfBuffer.length,
        filesizeMb: Number(sizeMb.toFixed(3)),
        pageCount,
        isUnder5Mb: sizeMb <= 5.0,
        extractedCharacters: extractedText.length,
        textIntegrityPassed: missingTokens.length === 0,
        verifiedTokensFound,
        missingTokens,
        warnings: sizeMb > 2.5 ? ["File size is over 2.5 MB. Optimal ATS target is under 2 MB."] : [],
    };

    return { pdfBuffer, validation };
}
