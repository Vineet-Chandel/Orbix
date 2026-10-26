import {
    Document,
    Packer,
    Paragraph,
    TextRun,
    HeadingLevel,
    AlignmentType,
    BorderStyle,
    ExternalHyperlink,
} from "docx";
import mammoth from "mammoth";
import type { ResumeContent, ExportValidationResult } from "./resumeTypes.js";

export async function generateAtsDocx(
    content: ResumeContent,
    options: { templateId?: string } = {}
): Promise<{ docxBuffer: Buffer; validation: ExportValidationResult }> {
    const children: Paragraph[] = [];

    // Helper for Section Titles
    const createSectionHeader = (title: string) => {
        return new Paragraph({
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 240, after: 80 },
            border: {
                bottom: {
                    color: "555555",
                    space: 2,
                    style: BorderStyle.SINGLE,
                    size: 8,
                },
            },
            children: [
                new TextRun({
                    text: title.toUpperCase(),
                    bold: true,
                    size: 22, // 11pt
                    color: "111111",
                    font: "Arial",
                }),
            ],
        });
    };

    // 1. Candidate Name (Centered, Bold, 20pt)
    children.push(
        new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 0, after: 60 },
            children: [
                new TextRun({
                    text: content.contact.fullName || "Candidate Name",
                    bold: true,
                    size: 38, // 19pt
                    color: "050505",
                    font: "Arial",
                }),
            ],
        })
    );

    // Headline
    if (content.contact.headline) {
        children.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 80 },
                children: [
                    new TextRun({
                        text: content.contact.headline,
                        size: 20, // 10pt
                        color: "444444",
                        font: "Arial",
                    }),
                ],
            })
        );
    }

    // Contact Details Line
    const contactParts: string[] = [];
    if (content.contact.includeEmail && content.contact.email) contactParts.push(content.contact.email);
    if (content.contact.includePhone && content.contact.phone) contactParts.push(content.contact.phone);
    if (content.contact.includeLocation && content.contact.location) contactParts.push(content.contact.location);
    if (content.contact.githubUrl) {
        contactParts.push(content.contact.githubUrl.replace(/^https?:\/\/(www\.)?github\.com\//i, "github.com/"));
    }
    if (content.contact.linkedinUrl) {
        contactParts.push(content.contact.linkedinUrl.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//i, "linkedin.com/in/"));
    }
    if (content.contact.portfolioUrl) {
        contactParts.push(content.contact.portfolioUrl.replace(/^https?:\/\/(www\.)?/i, ""));
    }

    if (contactParts.length > 0) {
        children.push(
            new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { after: 180 },
                children: [
                    new TextRun({
                        text: contactParts.join("  |  "),
                        size: 18, // 9pt
                        color: "333333",
                        font: "Arial",
                    }),
                ],
            })
        );
    }

    // 2. Summary
    if (content.summary && content.visibleSections?.summary !== false) {
        children.push(createSectionHeader("Professional Summary"));
        children.push(
            new Paragraph({
                spacing: { after: 120 },
                children: [
                    new TextRun({
                        text: content.summary,
                        size: 19, // 9.5pt
                        font: "Arial",
                        color: "222222",
                    }),
                ],
            })
        );
    }

    // 3. Education
    if (content.education && content.education.length > 0 && content.visibleSections?.education !== false) {
        children.push(createSectionHeader("Education"));
        for (const edu of content.education) {
            children.push(
                new Paragraph({
                    spacing: { before: 80, after: 40 },
                    children: [
                        new TextRun({
                            text: edu.institution,
                            bold: true,
                            size: 20, // 10pt
                            font: "Arial",
                        }),
                        new TextRun({
                            text: edu.location ? ` — ${edu.location}` : "",
                            size: 18,
                            font: "Arial",
                            color: "555555",
                        }),
                    ],
                })
            );

            const degreeText = `${edu.degree}${edu.fieldOfStudy ? ` in ${edu.fieldOfStudy}` : ""}${edu.cgpa ? ` (CGPA: ${edu.cgpa})` : ""}${edu.expectedGraduation ? `  |  Graduation: ${edu.expectedGraduation}` : ""}`;
            children.push(
                new Paragraph({
                    spacing: { after: 60 },
                    children: [
                        new TextRun({
                            text: degreeText,
                            italics: true,
                            size: 19,
                            font: "Arial",
                            color: "333333",
                        }),
                    ],
                })
            );

            for (const h of edu.highlights || []) {
                children.push(
                    new Paragraph({
                        bullet: { level: 0 },
                        spacing: { after: 40 },
                        children: [
                            new TextRun({
                                text: h,
                                size: 18,
                                font: "Arial",
                            }),
                        ],
                    })
                );
            }
        }
    }

    // 4. Skills
    if (content.skills && content.skills.length > 0 && content.visibleSections?.skills !== false) {
        children.push(createSectionHeader("Technical Skills"));
        for (const cat of content.skills) {
            children.push(
                new Paragraph({
                    spacing: { after: 60 },
                    children: [
                        new TextRun({
                            text: `${cat.category}: `,
                            bold: true,
                            size: 19,
                            font: "Arial",
                        }),
                        new TextRun({
                            text: cat.items.join(", "),
                            size: 19,
                            font: "Arial",
                            color: "222222",
                        }),
                    ],
                })
            );
        }
    }

    // 5. Projects
    if (content.projects && content.projects.length > 0 && content.visibleSections?.projects !== false) {
        children.push(createSectionHeader("Software Engineering Projects"));
        for (const proj of content.projects) {
            const projectHeaderChildren: (TextRun | ExternalHyperlink)[] = [
                new TextRun({
                    text: proj.title,
                    bold: true,
                    size: 20,
                    font: "Arial",
                }),
            ];

            if (proj.technologies && proj.technologies.length > 0) {
                projectHeaderChildren.push(
                    new TextRun({
                        text: `  |  ${proj.technologies.join(", ")}`,
                        italics: true,
                        size: 18,
                        font: "Arial",
                        color: "555555",
                    })
                );
            }

            if (proj.liveUrl || proj.githubUrl) {
                const link = proj.liveUrl || proj.githubUrl || "";
                projectHeaderChildren.push(
                    new TextRun({ text: "  |  ", size: 18, font: "Arial" }),
                    new ExternalHyperlink({
                        children: [
                            new TextRun({
                                text: link.replace(/^https?:\/\//i, ""),
                                style: "Hyperlink",
                                size: 18,
                                font: "Arial",
                                color: "0055aa",
                            }),
                        ],
                        link,
                    })
                );
            }

            children.push(
                new Paragraph({
                    spacing: { before: 80, after: 40 },
                    children: projectHeaderChildren,
                })
            );

            for (const b of proj.bullets || []) {
                children.push(
                    new Paragraph({
                        bullet: { level: 0 },
                        spacing: { after: 40 },
                        children: [
                            new TextRun({
                                text: b,
                                size: 18,
                                font: "Arial",
                                color: "222222",
                            }),
                        ],
                    })
                );
            }
        }
    }

    // 6. Experience
    if (content.experience && content.experience.length > 0 && content.visibleSections?.experience !== false) {
        children.push(createSectionHeader("Work Experience & Internships"));
        for (const exp of content.experience) {
            children.push(
                new Paragraph({
                    spacing: { before: 80, after: 30 },
                    children: [
                        new TextRun({
                            text: exp.company,
                            bold: true,
                            size: 20,
                            font: "Arial",
                        }),
                        new TextRun({
                            text: exp.location ? ` — ${exp.location}` : "",
                            size: 18,
                            font: "Arial",
                            color: "555555",
                        }),
                    ],
                })
            );

            const roleDate = `${exp.role}${exp.startDate ? `  |  ${exp.startDate} - ${exp.isCurrent ? "Present" : exp.endDate || ""}` : ""}`;
            children.push(
                new Paragraph({
                    spacing: { after: 50 },
                    children: [
                        new TextRun({
                            text: roleDate,
                            italics: true,
                            size: 19,
                            font: "Arial",
                            color: "333333",
                        }),
                    ],
                })
            );

            for (const b of exp.bullets || []) {
                children.push(
                    new Paragraph({
                        bullet: { level: 0 },
                        spacing: { after: 40 },
                        children: [
                            new TextRun({
                                text: b,
                                size: 18,
                                font: "Arial",
                                color: "222222",
                            }),
                        ],
                    })
                );
            }
        }
    }

    // 7. Verified Coding Profiles
    if (content.codingProfiles && content.codingProfiles.length > 0 && content.visibleSections?.codingProfiles !== false) {
        children.push(createSectionHeader("Verified Coding Profiles & Developer Activity"));
        for (const p of content.codingProfiles) {
            const portalCap = p.portal.charAt(0).toUpperCase() + p.portal.slice(1);
            const statsParts: string[] = [];
            if (p.totalSolved) statsParts.push(`${p.totalSolved.toLocaleString()} Solved`);
            if (p.contestRating) statsParts.push(`Rating ${p.contestRating}`);
            if (p.globalRank) statsParts.push(`Rank ${p.globalRank}`);
            if (p.verified) statsParts.push("[Orbix Verified]");

            children.push(
                new Paragraph({
                    bullet: { level: 0 },
                    spacing: { after: 40 },
                    children: [
                        new TextRun({
                            text: `${portalCap} (@${p.username}): `,
                            bold: true,
                            size: 18,
                            font: "Arial",
                        }),
                        new TextRun({
                            text: statsParts.join("  |  ") || p.url,
                            size: 18,
                            font: "Arial",
                            color: "333333",
                        }),
                    ],
                })
            );
        }
    }

    // 8. Certifications
    if (content.certifications && content.certifications.length > 0 && content.visibleSections?.certifications !== false) {
        children.push(createSectionHeader("Certifications & Honors"));
        for (const cert of content.certifications) {
            children.push(
                new Paragraph({
                    bullet: { level: 0 },
                    spacing: { after: 40 },
                    children: [
                        new TextRun({
                            text: `${cert.title}${cert.issuer ? ` — ${cert.issuer}` : ""}${cert.date ? ` (${cert.date})` : ""}`,
                            size: 18,
                            font: "Arial",
                        }),
                    ],
                })
            );
        }
    }

    const doc = new Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: 720, // 0.5 in
                            bottom: 720,
                            left: 720,
                            right: 720,
                        },
                    },
                },
                children,
            },
        ],
    });

    const docxBuffer = await Packer.toBuffer(doc);
    const sizeMb = docxBuffer.length / (1024 * 1024);

    // Validate with mammoth
    let extractedText = "";
    try {
        const result = await mammoth.extractRawText({ buffer: docxBuffer });
        extractedText = result.value || "";
    } catch (err) {
        console.warn("DOCX extraction validation warning:", err);
    }

    const verifiedTokensFound: string[] = [];
    const missingTokens: string[] = [];
    const tokensToVerify = [
        content.contact.fullName,
        content.contact.email,
        ...content.education.map((e) => e.institution),
    ].filter(Boolean);

    for (const token of tokensToVerify) {
        if (extractedText.toLowerCase().includes(token.toLowerCase())) {
            verifiedTokensFound.push(token);
        } else {
            missingTokens.push(token);
        }
    }

    const validation: ExportValidationResult = {
        success: docxBuffer.length > 0 && sizeMb <= 5.0 && extractedText.length > 50,
        format: "docx",
        filesizeBytes: docxBuffer.length,
        filesizeMb: Number(sizeMb.toFixed(3)),
        pageCount: 1, // Word pages reflow dynamically in Word
        isUnder5Mb: sizeMb <= 5.0,
        extractedCharacters: extractedText.length,
        textIntegrityPassed: missingTokens.length === 0,
        verifiedTokensFound,
        missingTokens,
        warnings: [],
    };

    return { docxBuffer, validation };
}
