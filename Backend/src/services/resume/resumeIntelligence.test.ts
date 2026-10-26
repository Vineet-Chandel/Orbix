import { analyzeResumeContent } from "./resumeAnalyzer.js";
import { runJobMatchAnalysis } from "./jobMatcher.js";
import { generateAtsPdf } from "./pdfGenerator.js";
import { generateAtsDocx } from "./docxGenerator.js";
import { parseUploadedDocument } from "./documentParser.js";
import type { ResumeContent, CodingProfileEntry } from "./resumeTypes.js";

async function runTestSuite() {
    console.log("🧪 Starting Orbix Resume Intelligence Test Suite...\n");
    let passed = 0;
    let failed = 0;

    const assert = (condition: boolean, testName: string, detail: string = "") => {
        if (condition) {
            console.log(`  ✅ PASS: ${testName}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${testName} - ${detail}`);
            failed++;
        }
    };

    // Fixture 1: Student / Fresher Resume Content
    const studentResume: ResumeContent = {
        contact: {
            fullName: "Aarav Sharma",
            headline: "Computer Science Undergraduate | Full Stack Developer",
            email: "aarav.sharma@example.com",
            phone: "+91 9876543210",
            location: "Bengaluru, India",
            githubUrl: "https://github.com/aaravsharma",
            linkedinUrl: "https://linkedin.com/in/aaravsharma",
            includeEmail: true,
            includePhone: true,
            includeLocation: true,
        },
        summary: "Motivated computer science student with a strong passion for scalable web systems, data structures, and algorithms. Experienced in building responsive full-stack applications with React, Node.js, and PostgreSQL.",
        education: [
            {
                id: "edu_1",
                institution: "Indian Institute of Information Technology",
                degree: "Bachelor of Technology",
                fieldOfStudy: "Computer Science and Engineering",
                expectedGraduation: "2026",
                cgpa: "8.9/10",
                location: "Bengaluru, India",
                highlights: ["Coursework: Data Structures, Operating Systems, Computer Networks, Database Management"],
            },
        ],
        skills: [
            { category: "Languages", items: ["TypeScript", "JavaScript", "Python", "C++", "SQL"] },
            { category: "Frameworks & Libraries", items: ["React", "Node.js", "Express", "Tailwind CSS"] },
            { category: "Databases & Tools", items: ["PostgreSQL", "Redis", "Docker", "Git", "GitHub Actions"] },
        ],
        projects: [
            {
                id: "proj_1",
                title: "DevPulse - Real-Time Code Collaboration Platform",
                technologies: ["React", "Node.js", "WebSockets", "Redis", "PostgreSQL"],
                liveUrl: "https://devpulse.dev",
                githubUrl: "https://github.com/aaravsharma/devpulse",
                bullets: [
                    "Architected a real-time collaborative code editor supporting concurrent sessions across 500+ simulated users using WebSockets and Redis Pub/Sub.",
                    "Engineered a resilient AST parser microservice in Node.js to provide syntax diagnostics with sub-50ms latency.",
                    "Optimized PostgreSQL connection pooling and database indexing, decreasing average query response times by 42%.",
                ],
            },
            {
                id: "proj_2",
                title: "AlgoTrack - CP Contest Radar & Analytics",
                technologies: ["TypeScript", "Next.js", "Docker", "Tailwind CSS"],
                bullets: [
                    "Developed an automated contest aggregation pipeline synchronizing schedules from 6 competitive platforms via cron workers.",
                    "Containerized client and server microservices using Docker to achieve deterministic multi-stage CI/CD deployments.",
                ],
            },
        ],
        experience: [], // Student has NO work experience yet
        codingProfiles: [
            {
                portal: "leetcode",
                username: "aarav_codes",
                url: "https://leetcode.com/u/aarav_codes",
                verified: true,
                totalSolved: 642,
                contestRating: 1845,
                globalRank: "Top 4.2%",
                lastSyncAt: "2026-10-25T12:00:00Z",
            },
            {
                portal: "codeforces",
                username: "aarav_cf",
                url: "https://codeforces.com/profile/aarav_cf",
                verified: true,
                contestRating: 1612,
                totalSolved: 310,
                lastSyncAt: "2026-10-25T12:00:00Z",
            },
        ],
        certifications: [],
        sectionOrder: ["contact", "summary", "education", "skills", "projects", "codingProfiles"],
        visibleSections: {
            contact: true,
            summary: true,
            education: true,
            skills: true,
            projects: true,
            codingProfiles: true,
            experience: false,
            certifications: false,
        },
    };

    // -------------------------------------------------------------------------
    // TEST 1: 8-Check Analysis for Fresher (No work experience must NOT fail)
    // -------------------------------------------------------------------------
    console.log("Section 1: 8 Recruiter / ATS Checks Analysis");
    const report = analyzeResumeContent(studentResume);
    assert(report.checks.length === 8, "Evaluates all 8 recruiter checks", `Count was ${report.checks.length}`);

    const structureCheck = report.checks.find((c) => c.id === "structure");
    assert(structureCheck?.status === "pass", "Student without work experience passes standard sections with project focus", `Status was ${structureCheck?.status}`);

    const formatCheck = report.checks.find((c) => c.id === "format");
    assert(formatCheck?.status === "pass", "Single-column linear format passes ATS structure check", `Status was ${formatCheck?.status}`);

    const verifiedCheck = report.checks.find((c) => c.id === "profile_link");
    assert(verifiedCheck?.status === "pass", "Verified coding profiles with live stats pass verification check", `Status was ${verifiedCheck?.status}`);

    const verbCheck = report.checks.find((c) => c.id === "action_verbs");
    assert(verbCheck?.status === "pass", "Action-driven past tense verbs pass verb check", `Status was ${verbCheck?.status}`);

    const stackCheck = report.checks.find((c) => c.id === "skills_highlight");
    assert(stackCheck?.status === "pass", "Skills corroborated by projects pass stack coherence check", `Status was ${stackCheck?.status}`);

    assert(report.overallScore >= 80 && report.overallScore <= 100, `High quality resume yields expected score: ${report.overallScore}/100`);

    // -------------------------------------------------------------------------
    // TEST 2: Flawed Resume Detection (Warnings & Failures must be honest)
    // -------------------------------------------------------------------------
    console.log("\nSection 2: Detection of Flaws, Weak Verbs & Unverified URLs");
    const flawedResume: ResumeContent = {
        ...studentResume,
        contact: {
            ...studentResume.contact,
            email: "invalid-email-address", // Invalid email!
        },
        skills: [{ category: "Skills", items: ["COBOL", "Fortran", "Pascal"] }], // Not in projects!
        projects: [
            {
                id: "p1",
                title: "Bad Project",
                technologies: [],
                bullets: [
                    "worked on making a website for college", // Weak verb!
                    "responsible for handling bug fixes", // Passive phrase!
                ],
            },
        ],
        codingProfiles: [
            {
                portal: "leetcode",
                username: "fake_handle",
                url: "https://leetcode.com/fake_handle",
                verified: false, // Unverified link!
            },
        ],
    };

    const flawedReport = analyzeResumeContent(flawedResume);
    const flawedContact = flawedReport.findings.find((f) => f.checkId === "contact_info");
    assert(flawedContact?.status === "fail", "Invalid email triggers FAIL finding on Contact Clarity", `Status was ${flawedContact?.status}`);

    const flawedVerbs = flawedReport.findings.find((f) => f.checkId === "action_verbs");
    assert(flawedVerbs?.status === "warn", "Weak verbs ('worked on', 'responsible for') trigger WARNING finding with suggestions", `Status was ${flawedVerbs?.status}`);

    const flawedVerified = flawedReport.findings.find((f) => f.checkId === "profile_link");
    assert(flawedVerified?.status === "warn", "Unverified text URL triggers WARNING: URL in text != verified platform", `Status was ${flawedVerified?.status}`);

    const flawedStack = flawedReport.findings.find((f) => f.checkId === "skills_highlight");
    assert(flawedStack?.status === "warn", "Uncorroborated skills trigger WARNING on Stack Coherence", `Status was ${flawedStack?.status}`);

    // -------------------------------------------------------------------------
    // TEST 3: Job Match & Tailoring Engine
    // -------------------------------------------------------------------------
    console.log("\nSection 3: Job Match & Role-Specific Tailoring");
    const sampleJobDescription = `
        We are looking for a Junior Full Stack Engineer to join our core backend team.
        Requirements:
        - Strong proficiency in TypeScript, React, and Node.js.
        - Experience with PostgreSQL database design, connection pooling, and indexing.
        - Familiarity with Redis caching and Docker containerization.
        - Solid understanding of Data Structures and Algorithms.
        - Nice to have: Kubernetes and AWS cloud infrastructure.
    `;

    const matchReport = runJobMatchAnalysis(
        studentResume,
        "Junior Full Stack Engineer",
        "Swiggy",
        sampleJobDescription
    );

    assert(matchReport.matchedSkills.length >= 4, `Matched skills identified (${matchReport.matchedSkills.map((s) => s.name).join(", ")})`);
    assert(matchReport.missingSkills.some((s) => s.name.toLowerCase() === "kubernetes" || s.name.toLowerCase() === "aws"), "Identified missing skills (Kubernetes / AWS) from JD without inventing them");
    assert(matchReport.matchScore >= 70, `Calculated transparent match score: ${matchReport.matchScore}/100`);
    assert(Boolean(matchReport.suggestedSummaryRewrite && matchReport.suggestedSummaryRewrite.includes("Aarav Sharma")), "Generated grounded summary rewrite containing candidate facts");

    // -------------------------------------------------------------------------
    // TEST 4: Native PDF Generation & Text Extraction Validation
    // -------------------------------------------------------------------------
    console.log("\nSection 4: Native PDF Generation & Post-Export Verification");
    const { pdfBuffer, validation: pdfValidation } = await generateAtsPdf(studentResume);
    assert(pdfBuffer.length > 2000, `Generated PDF buffer non-empty (${pdfBuffer.length} bytes)`);
    assert(pdfValidation.success, "PDF passes post-export integrity check");
    assert(pdfValidation.isUnder5Mb, `PDF is strictly under 5 MB budget (${pdfValidation.filesizeMb} MB)`);
    assert(pdfValidation.pageCount >= 1 && pdfValidation.pageCount <= 2, `Page count is optimal (${pdfValidation.pageCount} page(s))`);
    assert(pdfValidation.textIntegrityPassed, "Extracted text contains all verified tokens (Candidate name, institution, skills)");

    // Test text extraction from generated PDF buffer with parseUploadedDocument
    const parsedPdf = await parseUploadedDocument(pdfBuffer, "Aarav_Sharma_Resume.pdf", "application/pdf");
    assert(parsedPdf.rawText.includes("Aarav Sharma"), "Uploaded PDF text extraction captures candidate name");
    assert(parsedPdf.detectedSections.includes("Skills") && parsedPdf.detectedSections.includes("Projects"), `Extracted detected sections: ${parsedPdf.detectedSections.join(", ")}`);

    // -------------------------------------------------------------------------
    // TEST 5: Native DOCX Generation & Text Extraction Validation
    // -------------------------------------------------------------------------
    console.log("\nSection 5: Native DOCX Generation & Post-Export Verification");
    const { docxBuffer, validation: docxValidation } = await generateAtsDocx(studentResume);
    assert(docxBuffer.length > 3000, `Generated DOCX buffer non-empty (${docxBuffer.length} bytes)`);
    assert(docxValidation.success, "DOCX passes post-export integrity check with mammoth");
    assert(docxValidation.textIntegrityPassed, "Extracted DOCX text verifies candidate identity and education");

    // Test text extraction from generated DOCX buffer with parseUploadedDocument
    const parsedDocx = await parseUploadedDocument(docxBuffer, "Aarav_Sharma_Resume.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    assert(parsedDocx.rawText.includes("Aarav Sharma"), "Uploaded DOCX text extraction captures candidate name");

    console.log(`\n🏁 Test Suite Complete: ${passed} passed, ${failed} failed.`);
    if (failed > 0) {
        process.exit(1);
    }
}

runTestSuite().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
