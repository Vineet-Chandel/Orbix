import dotenv from "dotenv";
dotenv.config();

import { query } from "../src/database/client.js";
import {
    validateProjectPayload,
    ProjectValidationError,
} from "../src/validators/ProjectValidator.js";
import {
    createProject,
    updateProject,
    deleteProject,
    getProjectById,
    getPublicProjectsByUsername,
} from "../src/services/project/projectService.js";

async function runPhase4Tests() {
    console.log("🛠️ Running Phase 4: Dynamic Project Creation Form Tests...\n");

    // 1. Test Input Validation & Schema Sanitization
    console.log("[Test 1] Testing Schema Validation for Sections A through H...");
    
    // Test unsafe URL injection rejection
    try {
        validateProjectPayload({
            title: "Security Test Project",
            liveUrl: "javascript:alert('xss')",
        });
        throw new Error("Failed to reject unsafe javascript: URL scheme in liveUrl!");
    } catch (err: any) {
        if (!(err instanceof ProjectValidationError) || !err.message.includes("http:// or https://")) {
            throw new Error(`Unexpected error on XSS URL: ${err.message}`);
        }
        console.log("✅ Unsafe URL scheme (javascript:) strictly rejected.");
    }

    // 2. Validate Comprehensive Phase 4 Payload
    const fullPayload = validateProjectPayload({
        title: "Orbix Core Engine",
        tagline: "High-throughput asynchronous event protocol",
        description: "A distributed engine capable of processing 100k events/sec.",
        fullOverview: "Detailed markdown overview discussing the Raft consensus and Zero-copy serialization.",
        category: "Distributed Systems",
        projectType: "Backend service",
        developmentStatus: "In development",
        status: "published",
        isPublished: true,
        isPinned: true,
        isRepoPrivate: false,
        hideRepoUrl: false,
        repoUrl: "https://github.com/orbix-org/core-engine",
        repoName: "orbix-org/core-engine",
        repoStars: 1420,
        repoForks: 310,
        repoLanguage: "Rust",
        liveUrl: "https://engine.orbix.dev",
        demoVideoUrl: "https://youtube.com/watch?v=orbix-demo",
        documentationUrl: "https://docs.orbix.dev",
        apiDocUrl: "https://api.orbix.dev/openapi.json",
        figmaUrl: "https://figma.com/file/orbix-architecture",
        imageUrl: "https://images.unsplash.com/photo-1555066931-4365d14bab8c",
        galleryImages: [
            {
                id: "img_arch",
                url: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31",
                caption: "System Topology & Ingress Architecture",
                type: "architecture",
                displayOrder: 0,
            },
            {
                id: "img_dash",
                url: "https://images.unsplash.com/photo-1551288049-bebda4e38f71",
                caption: "Real-time Telemetry Dashboard",
                type: "screenshot",
                displayOrder: 1,
            },
        ],
        technologies: ["Rust", "Tokio", "gRPC", "PostgreSQL", "Docker"],
        categorizedTechnologies: {
            Languages: [{ name: "Rust", category: "Languages", verified: true, confidence: 1.0 }],
            Backend: [{ name: "Tokio", category: "Backend", verified: true }, { name: "gRPC", category: "Backend", verified: true }],
            Database: [{ name: "PostgreSQL", category: "Database", verified: true }],
            DevOps: [{ name: "Docker", category: "DevOps", verified: true }],
        },
        features: [
            { id: "f1", title: "Zero-copy Serialization", description: "Bypasses heap allocation for high throughput" },
            { id: "f2", title: "Raft Consensus Cluster", description: "Fault-tolerant leader election" },
            { id: "f3", title: "Automatic Sharding", description: "Dynamically distributes partitions across nodes" },
        ],
        externalLinks: [
            { id: "l1", label: "Architecture RFC", url: "https://github.com/orbix-org/rfcs/blob/main/001.md", isHidden: false },
            { id: "l2", label: "Internal Canary Metrics", url: "https://canary.internal.orbix.dev", isHidden: true },
        ],
        architectureNotes: "Leader-follower quorum model with disk-persisted write-ahead logs.",
        story: {
            problemStatement: "Existing message brokers choked at 50,000 concurrent consumers under heavy burst loads.",
            motivation: "Engineered to deliver sub-millisecond p99 latency without allocating garbage-collected memory.",
            solution: "Custom ring-buffer architecture paired with eBPF network packet dispatching.",
            targetAudience: "Infrastructure engineers and distributed system architects.",
            differentiation: "5x lower memory footprint compared to JVM-based brokers.",
            challenges: "Debugging lock-free atomics and preventing memory leaks in async workers.",
            learnings: "Mastered lock-free data structures and cross-thread channel optimizations.",
        },
        contribution: {
            myRole: "Founding Systems Architect",
            myResponsibilities: "Designed the ring-buffer storage engine, Raft replication, and benchmark harness.",
            isTeamProject: true,
            teamMembers: ["@vineetchandel", "@alex-dev", "@sarah-rust"],
            contributionDescription: "Authored 80% of the core Rust crates and conducted all end-to-end chaos tests.",
        },
        additionalDetails: {
            achievements: ["Featured on Hacker News Frontpage", "Used in production across 3 enterprise clusters"],
            performanceMetrics: [
                { label: "Throughput", value: "140k req/s" },
                { label: "P99 Latency", value: "0.85ms" },
                { label: "Memory Usage", value: "42MB" },
            ],
            futureImprovements: ["Implement zero-knowledge proofs for audit logs", "WASM plugin runtime"],
            deploymentInfo: "Bare-metal Debian 12 cluster with 10Gbps bonded NICs and NVMe arrays.",
            customFields: [
                { key: "Security Audit", value: "Passed (Cure53 Q3 2026)" },
                { key: "License", value: "Apache-2.0" },
            ],
            notes: "Ready for public RFC feedback.",
        },
    });

    console.log("✅ Validation succeeded. All Section A through H fields properly sanitized.");

    // 3. Test Database Persistence via createProject
    console.log("\n[Test 2] Creating project with complete Phase 4 schema...");
    const testUsername = `p4_${Date.now().toString(36)}`;
    const userRes = await query(
        `INSERT INTO users (username, firstname, lastname, email, password) 
         VALUES ($1, 'DynamicForm', 'Tester', $2, 'hashed_pw') 
         RETURNING id, username;`,
        [testUsername, `${testUsername}@orbix.dev`]
    );
    const userId = userRes.rows[0].id;

    const created = await createProject(userId, fullPayload);

    if (created.title !== "Orbix Core Engine") throw new Error("Title mismatch!");
    if (created.projectType !== "Backend service") throw new Error(`ProjectType mismatch: ${created.projectType}`);
    if (created.developmentStatus !== "In development") throw new Error(`DevelopmentStatus mismatch: ${created.developmentStatus}`);
    if (!created.story?.problemStatement) throw new Error("Story problem statement missing!");
    if (!created.contribution?.isTeamProject || created.contribution.teamMembers?.length !== 3) {
        throw new Error("Contribution details missing or corrupted!");
    }
    if (created.additionalDetails?.performanceMetrics?.length !== 3) {
        throw new Error("Performance metrics not persisted!");
    }
    if (created.galleryImages.length !== 2) throw new Error("Gallery images not persisted!");
    if (!created.categorizedTechnologies?.["Languages"]) throw new Error("Categorized technologies missing!");

    console.log(`✅ Project created successfully with ID: ${created.id}`);
    console.log(`- Project Type: ${created.projectType}`);
    console.log(`- Dev Status: ${created.developmentStatus}`);
    console.log(`- Story Problem: "${created.story?.problemStatement.slice(0, 45)}..."`);
    console.log(`- Contributor Role: ${created.contribution?.myRole} (Team of ${created.contribution?.teamMembers?.length})`);
    console.log(`- Performance Metrics: ${created.additionalDetails?.performanceMetrics?.map((m) => `${m.label}: ${m.value}`).join(", ")}`);

    // 4. Test Dynamic Partial Updates
    console.log("\n[Test 3] Testing dynamic updates to Section C, D, and H...");
    const updated = await updateProject(created.id, userId, {
        developmentStatus: "Completed",
        features: [
            ...created.features,
            { id: "f4", title: "Dynamic Plugin Hot-Reloading", description: "Zero-downtime updates" },
        ],
        story: {
            ...created.story,
            motivation: "Updated motivation after production stress-tests.",
        },
        additionalDetails: {
            ...created.additionalDetails,
            achievements: [...(created.additionalDetails?.achievements || []), "1,000 GitHub Stars"],
        },
    });

    if (updated.developmentStatus !== "Completed") throw new Error("Failed to update developmentStatus!");
    if (updated.features.length !== 4) throw new Error(`Expected 4 features, got ${updated.features.length}`);
    if (updated.additionalDetails?.achievements?.length !== 3) throw new Error("Achievements update failed!");
    console.log("✅ Dynamic updates to features, story, and achievements persisted cleanly.");

    // 5. Test Public vs Owner Redaction
    console.log("\n[Test 4] Testing public visibility & redaction of hidden links...");
    // Owner view
    const ownerView = await getProjectById(created.id, userId);
    if (ownerView.externalLinks.length !== 2) {
        throw new Error(`Owner should see both links, got ${ownerView.externalLinks.length}`);
    }

    // Public visitor view
    const publicProfile = await getPublicProjectsByUsername(testUsername);
    const publicProject = publicProfile.projects[0];
    if (publicProject.externalLinks.length !== 1) {
        throw new Error(`Public visitor should only see 1 public link (hidden filtered out), got ${publicProject.externalLinks.length}`);
    }
    if (publicProject.externalLinks[0].label !== "Architecture RFC") {
        throw new Error("Wrong link displayed publicly!");
    }
    console.log("✅ Public view filtered out internal canary link (zero leakage of hidden external links).");

    // Clean up
    await deleteProject(created.id, userId);
    await query(`DELETE FROM users WHERE id = $1;`, [userId]);
    console.log("🧹 Cleaned up test user.");

    console.log("\n🎉 ALL PHASE 4 DYNAMIC FORM TESTS PASSED PERFECTLY!\n");
    process.exit(0);
}

runPhase4Tests().catch((err) => {
    console.error("❌ Phase 4 Test Failed:", err);
    process.exit(1);
});
