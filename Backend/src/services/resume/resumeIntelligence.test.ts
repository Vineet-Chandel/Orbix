import { analyzeResumeWithGemini } from "./geminiResumeAnalyzer.js";
import type { CodingProfileEntry } from "./resumeTypes.js";

async function runTestSuite() {
    console.log("🧪 Starting Orbix Resume Gemini AI Intelligence Test Suite...\n");
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

    const mockResumeText = `
Aarav Sharma
Software Engineer | Full Stack Developer
aarav.sharma@example.com | +91 9876543210 | Bengaluru, India
github.com/aaravsharma | linkedin.com/in/aaravsharma

EDUCATION
Indian Institute of Information Technology, Bengaluru
Bachelor of Technology in Computer Science & Engineering (2022 - 2026) | CGPA: 8.9/10

TECHNICAL SKILLS
Languages: TypeScript, JavaScript, Python, C++, SQL
Frameworks: React, Next.js, Node.js, Express, Tailwind CSS
Databases & Tools: PostgreSQL, Redis, Docker, Git, Linux
Core Concepts: Data Structures, Algorithms, REST APIs, Microservices, CI/CD

PROJECTS
DevPulse - Real-Time Code Collaboration Platform (React, Node.js, PostgreSQL, Docker)
- Architected a real-time collaborative code editor supporting 500+ concurrent sessions using WebSockets.
- Optimized database indexing and query caching in Redis, decreasing query execution latency by 42% under 3,000 QPS.
- Containerized frontend and backend services using Docker and configured automated CI/CD deployment pipelines.

WORK EXPERIENCE
Software Engineering Intern - CloudCraft Systems (June 2025 - August 2025)
- Engineered scalable RESTful microservices in Node.js and TypeScript handling 1M+ daily API requests.
- Refactored legacy monolithic endpoints into decoupled serverless functions, decreasing server overhead costs by 28%.
`;

    const verifiedProfiles: CodingProfileEntry[] = [
        {
            portal: "github",
            username: "aaravsharma",
            url: "https://github.com/aaravsharma",
            verified: true,
            lastSyncStatus: "valid",
        },
    ];

    try {
        console.log("1. Testing Gemini Resume Analyzer...");
        const report = await analyzeResumeWithGemini(
            mockResumeText,
            "Aarav_Sharma_Resume.pdf",
            180000,
            verifiedProfiles
        );

        assert(report.overallScore > 60, "Overall score is above 60 for high-quality resume", `Got ${report.overallScore}`);
        assert(report.scoreGrade === "Top Tier" || report.scoreGrade === "Competitive", "Score grade is Competitive or Top Tier", `Got ${report.scoreGrade}`);
        assert(report.targetRoleDetected.length > 0, "Target role detected", report.targetRoleDetected);
        assert(report.detectedSkills.languages.includes("TypeScript"), "Detected TypeScript", JSON.stringify(report.detectedSkills.languages));
        assert(report.detectedSkills.frameworks.includes("React"), "Detected React", JSON.stringify(report.detectedSkills.frameworks));
        assert(report.detectedSkills.databasesAndTools.includes("Docker"), "Detected Docker", JSON.stringify(report.detectedSkills.databasesAndTools));
        assert(report.strengths.length > 0, "Identified strengths", `Count: ${report.strengths.length}`);
        assert(report.checks.length >= 6, "All 6+ recruiter checks evaluated", `Count: ${report.checks.length}`);

        console.log("\n📊 Summary:");
        console.log(`Passed: ${passed}`);
        console.log(`Failed: ${failed}`);
    } catch (err: any) {
        console.error("Test error:", err);
    }
}

runTestSuite();
