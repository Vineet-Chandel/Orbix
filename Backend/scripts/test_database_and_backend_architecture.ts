if (typeof process.loadEnvFile === "function") { try { process.loadEnvFile(path.resolve(__dirname, "../.env")); } catch {} }

import { query } from "../src/database/client.js";
import {
    createProject,
    updateProject,
    deleteProject,
    getProjectById,
    getUserProjects,
    getPublicProjectsByUsername,
} from "../src/services/project/projectService.js";
import { ProjectValidationError } from "../src/validators/ProjectValidator.js";

async function runPhase6Tests() {
    console.log("🛠️ Running Phase 6: Database & Backend Architecture Tests...\n");

    // Setup User A (Project Owner) and User B (Attacker / Different User)
    const usernameA = `owner_${Date.now().toString(36)}`;
    const emailA = `${usernameA}@orbix.test`;
    const userARes = await query<{ id: string }>(
        `INSERT INTO users (username, firstname, lastname, email, password, is_public)
         VALUES ($1, 'Owner', 'User', $2, 'hashed_pw', true)
         RETURNING id`,
        [usernameA, emailA]
    );
    const userAId = userARes.rows[0].id;

    const usernameB = `attacker_${Date.now().toString(36)}`;
    const emailB = `${usernameB}@orbix.test`;
    const userBRes = await query<{ id: string }>(
        `INSERT INTO users (username, firstname, lastname, email, password, is_public)
         VALUES ($1, 'Attacker', 'User', $2, 'hashed_pw', true)
         RETURNING id`,
        [usernameB, emailB]
    );
    const userBId = userBRes.rows[0].id;

    console.log(`✅ [Setup] User A (Owner): ${usernameA} (${userAId})`);
    console.log(`✅ [Setup] User B (Viewer/Attacker): ${usernameB} (${userBId})`);

    const createdProjectIds: string[] = [];

    try {
        // =========================================================================
        // Test 1: Scalable Project Entity with Full Logical Model
        // =========================================================================
        console.log("\n[Test 1] Testing Scalable Project Entity Schema & Logical Model Columns...");
        const project1 = await createProject(userAId, {
            title: "Orbix Real-Time Ingress",
            tagline: "Ultra-low latency edge gateway",
            description: "Distributed reverse proxy and API routing platform.",
            shortDescription: "Ultra-low latency edge gateway built with Rust & eBPF.",
            fullOverview: "Deep dive into zero-copy buffer allocations and lock-free quorums.",
            category: "Distributed Systems",
            projectType: "Backend service",
            developmentStatus: "Completed",
            status: "published",
            isPublished: true,
            isPinned: true,
            showOnProfile: true,
            repositoryProvider: "github",
            repositoryOwner: "orbix-core",
            repositoryVisibility: "public",
            repositoryMetadata: {
                openIssues: 3,
                topics: ["networking", "ebpf", "rust", "proxy"],
                latestReleaseTag: "v1.4.0",
            },
            extractionStatus: "completed",
            extractionCompleteness: 98,
            repositoryLinkVisibility: "visible",
            repoUrl: "https://github.com/orbix-core/ingress",
            repoName: "orbix-core/ingress",
            repoStars: 1850,
            repoForks: 320,
            repoLanguage: "Rust",
            liveUrl: "https://ingress.orbix.dev",
            technologies: ["Rust", "eBPF", "Tokio"],
            features: [
                { title: "Zero-copy buffers", description: "Bypasses kernel memory overhead" },
                { title: "eBPF packet filter", description: "Hardware-accelerated packet filtering" },
            ],
            rawExtractedData: {
                title: "Orbix Real-Time Ingress",
                repoStars: 1850,
                scorecard: { completenessScore: 98 },
            },
            fieldOverrides: {
                shortDescription: true,
            },
        });
        createdProjectIds.push(project1.id);

        if (project1.repositoryProvider !== "github") throw new Error("repositoryProvider mismatch!");
        if (project1.repositoryOwner !== "orbix-core") throw new Error("repositoryOwner mismatch!");
        if (project1.repositoryVisibility !== "public") throw new Error("repositoryVisibility mismatch!");
        if (project1.extractionStatus !== "completed") throw new Error("extractionStatus mismatch!");
        if (project1.extractionCompleteness !== 98) throw new Error("extractionCompleteness mismatch!");
        if (project1.showOnProfile !== true) throw new Error("showOnProfile mismatch!");
        if (project1.repositoryLinkVisibility !== "visible") throw new Error("repositoryLinkVisibility mismatch!");
        console.log("✅ All logical model columns persisted and formatted accurately.");

        // =========================================================================
        // Test 2: Ownership Protection & ID Tampering Rejection
        // =========================================================================
        console.log("\n[Test 2] Testing Ownership Authorization & ID Tampering Protection...");
        
        // User B attempts to retrieve User A's project when it is private/draft
        const draftProject = await createProject(userAId, {
            title: "Private Internal Architecture",
            status: "draft",
            isPublished: false,
            category: "Cybersecurity",
        });
        createdProjectIds.push(draftProject.id);

        try {
            await getProjectById(draftProject.id, userBId);
            throw new Error("Security failure: User B was able to retrieve User A's private draft project!");
        } catch (err: any) {
            if (!(err instanceof ProjectValidationError) || !err.message.includes("private")) {
                throw new Error(`Unexpected error on unauthorized get: ${err.message}`);
            }
            console.log("✅ User B blocked from accessing User A's draft project via ID.");
        }

        // User B attempts to UPDATE User A's project
        try {
            await updateProject(project1.id, userBId, {
                title: "Hacked by User B",
            });
            throw new Error("Security failure: User B was able to modify User A's project!");
        } catch (err: any) {
            if (!(err instanceof ProjectValidationError) || !err.message.includes("Unauthorized")) {
                throw new Error(`Unexpected error on unauthorized update: ${err.message}`);
            }
            console.log("✅ User B blocked from modifying User A's project via ID.");
        }

        // User B attempts to DELETE User A's project
        try {
            await deleteProject(project1.id, userBId);
            throw new Error("Security failure: User B was able to delete User A's project!");
        } catch (err: any) {
            if (!(err instanceof ProjectValidationError) || !err.message.includes("not owned by you")) {
                throw new Error(`Unexpected error on unauthorized delete: ${err.message}`);
            }
            console.log("✅ User B blocked from deleting User A's project via ID.");
        }

        // Clean up draft project before capacity tests
        await deleteProject(draftProject.id, userAId);
        createdProjectIds.splice(createdProjectIds.indexOf(draftProject.id), 1);

        // =========================================================================
        // Test 3: Public Profile Visibility & Private Metadata Redaction
        // =========================================================================
        console.log("\n[Test 3] Testing Public Profile Filtering & Sensitive Extraction Redaction...");

        // Create Project 2: Published but show_on_profile = false
        const project2 = await createProject(userAId, {
            title: "Orbix Canary Worker",
            status: "published",
            isPublished: true,
            showOnProfile: false, // Hidden from public portfolio
            category: "Cloud & DevOps",
        });
        createdProjectIds.push(project2.id);

        // Create Project 3: Private repo with hidden links
        const project3 = await createProject(userAId, {
            title: "Proprietary Trade Engine",
            status: "published",
            isPublished: true,
            showOnProfile: true,
            isRepoPrivate: true,
            hideRepoUrl: true,
            repoUrl: "https://github.com/orbix-internal/secret-engine",
            repoName: "orbix-internal/secret-engine",
            category: "Fintech",
            externalLinks: [
                { label: "Public Whitepaper", url: "https://whitepaper.orbix.dev", isHidden: false },
                { label: "Internal Canary Metrics", url: "https://internal.orbix.dev", isHidden: true },
            ],
            rawExtractedData: { secretKey: "internal_gh_metadata_should_not_leak" },
            fieldOverrides: { title: true },
            syncMetadata: { internalTokens: "redacted" },
        });
        createdProjectIds.push(project3.id);

        // Public visitor view (Unauthenticated, viewerId = undefined)
        const publicShowcase = await getPublicProjectsByUsername(usernameA, undefined);
        console.log(`Public showcase count: ${publicShowcase.projects.length}`);

        // Verify Project 2 (show_on_profile = false) is excluded from public showcase
        const hasProject2 = publicShowcase.projects.some((p) => p.id === project2.id);
        if (hasProject2) {
            throw new Error("Security failure: Project with show_on_profile = false leaked to public profile!");
        }
        console.log("✅ Projects with show_on_profile = false are strictly excluded from public showcase.");

        // Verify Project 3 has private repo URL redacted
        const publicProject3 = publicShowcase.projects.find((p) => p.id === project3.id);
        if (!publicProject3) throw new Error("Project 3 not returned in public showcase!");
        if (publicProject3.repoUrl !== undefined) {
            throw new Error(`Security failure: Private repoUrl leaked in public view: ${publicProject3.repoUrl}`);
        }
        if (publicProject3.repoName !== "Proprietary Codebase (Private)") {
            throw new Error(`Expected redacted repoName, got: ${publicProject3.repoName}`);
        }
        console.log("✅ Private repository URL and name successfully redacted for public visitors.");

        // Verify hidden external link is redacted
        if (publicProject3.externalLinks.some((l) => l.label.includes("Internal Canary"))) {
            throw new Error("Security failure: Hidden external link leaked to public visitor!");
        }
        console.log("✅ Hidden external links successfully redacted for public visitors.");

        // Verify raw extraction & provenance metadata is stripped
        if (publicProject3.rawExtractedData !== undefined || publicProject3.fieldOverrides !== undefined || publicProject3.syncMetadata !== undefined) {
            throw new Error("Security failure: Internal extraction/provenance metadata leaked to unauthenticated visitor!");
        }
        console.log("✅ Internal extraction snapshot, field overrides, and sync metadata stripped from public API.");

        // Owner view: Owner sees all projects including show_on_profile = false and unredacted links
        const ownerShowcase = await getPublicProjectsByUsername(usernameA, userAId);
        if (ownerShowcase.projects.length !== 3) {
            throw new Error(`Expected owner to see all 3 projects, got ${ownerShowcase.projects.length}`);
        }
        console.log("✅ Authenticated project owner sees full administrative showcase.");

        // =========================================================================
        // Test 4: Atomic Concurrency & 4-Project Maximum Capacity Enforcement
        // =========================================================================
        console.log("\n[Test 4] Testing Atomic 4-Project Maximum Enforcement & Concurrent Race Conditions...");
        
        // Fill up to 4th project
        const project4 = await createProject(userAId, {
            title: "Project Slot 4",
            category: "Mobile",
        });
        createdProjectIds.push(project4.id);

        const userAProjects = await getUserProjects(userAId);
        if (userAProjects.count !== 4 || !userAProjects.isCapacityReached) {
            throw new Error(`Expected 4/4 projects, got ${userAProjects.count}`);
        }
        console.log("✅ Reached capacity: 4 / 4 Projects Added. isCapacityReached = true.");

        // Single insert attempt for 5th project must fail
        try {
            await createProject(userAId, {
                title: "Illegal Project 5",
                category: "AI / ML",
            });
            throw new Error("Capacity violation: 5th project was inserted!");
        } catch (err: any) {
            if (!(err instanceof ProjectValidationError) || !err.message.includes("Maximum project capacity reached")) {
                throw new Error(`Unexpected error on 5th project: ${err.message}`);
            }
            console.log("✅ 5th project rejected by atomic capacity check.");
        }

        // Concurrent race condition test: Try inserting 2 projects simultaneously
        const concurrentAttempts = await Promise.allSettled([
            createProject(userAId, { title: "Concurrent Project A", category: "AI / ML" }),
            createProject(userAId, { title: "Concurrent Project B", category: "Web3" }),
        ]);

        const rejectedCount = concurrentAttempts.filter((res) => res.status === "rejected").length;
        if (rejectedCount !== 2) {
            throw new Error("Atomic concurrency failure: Concurrent insertions were not all rejected at capacity limit!");
        }
        console.log("✅ Concurrent insertion attempts strictly serialized and rejected via advisory lock.");

        console.log("\n=======================================================");
        console.log("🎉 ALL PHASE 6 ARCHITECTURE & SECURITY TESTS PASSED! 🎉");
        console.log("=======================================================\n");
    } finally {
        // Clean up test data
        for (const pid of createdProjectIds) {
            await query("DELETE FROM user_projects WHERE id = $1", [pid]);
        }
        await query("DELETE FROM users WHERE id IN ($1, $2)", [userAId, userBId]);
        console.log("🧹 Test records cleaned up successfully.");
    }
}

runPhase6Tests()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        console.error("\n❌ Phase 6 Test Failed:", err);
        process.exit(1);
    });
