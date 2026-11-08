import { query } from "../src/database/client.js";
import {
    createProject,
    getUserProjects,
    getProjectById,
    updateProject,
    deleteProject,
    reorderProjects,
    toggleProjectPublish,
    analyzeGithubRepo,
    getPublicProjectsByUsername,
} from "../src/services/project/projectService.js";
import { validateProjectPayload, ProjectValidationError } from "../src/validators/ProjectValidator.js";

async function runTests() {
    console.log("🚀 Starting Phase 1 Project Showcase Backend Tests...\n");

    // 1. Create a temporary test user
    const testUsername = `tp_${Date.now().toString(36)}`;
    const testEmail = `${testUsername}@example.com`;
    const userRes = await query(
        `INSERT INTO users (username, firstname, lastname, email, password)
         VALUES ($1, 'Test', 'User', $2, 'testpass123')
         RETURNING id, username;`,
        [testUsername, testEmail]
    );
    const testUserId = userRes.rows[0].id;
    console.log(`✅ Created test user: ${testUsername} (${testUserId})`);

    try {
        // Test 1: Initial empty state (0 projects)
        console.log("\n[Test 1] Verifying empty state (0 projects)...");
        const initial = await getUserProjects(testUserId);
        if (initial.count !== 0 || initial.projects.length !== 0) {
            throw new Error(`Expected 0 projects, got ${initial.count}`);
        }
        if (initial.isCapacityReached !== false) {
            throw new Error("Capacity should not be reached at 0 projects");
        }
        console.log("✅ Empty state verified: 0 / 4 projects.");

        // Test 2: GitHub Repository Analysis (Lifecycle step 2 & 3: Does NOT auto-save)
        console.log("\n[Test 2] Testing GitHub repository analysis intelligence...");
        let analysis: any;
        try {
            analysis = await analyzeGithubRepo("https://github.com/facebook/react");
            if (!analysis.title || !analysis.repoStars || !analysis.technologies.length) {
                throw new Error("GitHub analysis failed to extract required fields.");
            }
            console.log(`✅ GitHub Analysis Success: Title='${analysis.title}', Language='${analysis.repoLanguage}', Stars=${analysis.repoStars}`);
        } catch (err: any) {
            if (err.message && err.message.includes("rate limit")) {
                console.log(`⚠️ Unauthenticated GitHub rate limit reached on test runner: "${err.message}"`);
                console.log("Using synthetic analysis payload to test lifecycle non-destruction & subsequent CRUD operations.");
                analysis = {
                    title: "React",
                    tagline: "The library for web and native user interfaces.",
                    description: "React is a JavaScript library for building user interfaces.",
                    category: "Frontend Framework",
                    repoUrl: "https://github.com/facebook/react",
                    repoName: "facebook/react",
                    repoStars: 228000,
                    repoLanguage: "JavaScript",
                    technologies: ["React", "JavaScript", "Flow"],
                    features: [{ title: "Component-based architecture" }, { title: "Virtual DOM diffing" }],
                };
            } else {
                throw err;
            }
        }
        
        // Verify database is STILL empty (analysis does NOT auto-publish or save)
        const postAnalysisCheck = await getUserProjects(testUserId);
        if (postAnalysisCheck.count !== 0) {
            throw new Error("Analysis must NOT automatically create a project in the database!");
        }
        console.log("✅ Analysis non-destructive guarantee verified: Database remains at 0 projects.");

        // Test 3: Create Project 1 (Draft)
        console.log("\n[Test 3] Creating Project 1 as draft...");
        const p1Input = validateProjectPayload({
            title: analysis.title,
            tagline: analysis.tagline,
            description: analysis.description,
            category: analysis.category,
            repoUrl: analysis.repoUrl,
            repoName: analysis.repoName,
            repoStars: analysis.repoStars,
            repoLanguage: analysis.repoLanguage,
            technologies: analysis.technologies,
            features: analysis.features,
            status: "draft",
            isPublished: false,
        });
        const p1 = await createProject(testUserId, p1Input);
        if (!p1.id || p1.status !== "draft" || p1.isPublished !== false) {
            throw new Error("Project 1 creation as draft failed.");
        }
        console.log(`✅ Project 1 Created: id=${p1.id}, slug=${p1.slug}, status=${p1.status}`);

        // Test 4: Create Projects 2, 3, and 4
        console.log("\n[Test 4] Adding projects up to capacity (4/4)...");
        const p2 = await createProject(
            testUserId,
            validateProjectPayload({
                title: "Orbix Core Engine",
                tagline: "High-throughput analytics backend",
                category: "Distributed Systems",
                technologies: ["Node.js", "TypeScript", "PostgreSQL", "Redis"],
                features: [{ title: "Sub-50ms query cache" }, { title: "Fault-tolerant rate limiting" }],
                status: "published",
                isPublished: true,
            })
        );
        const p3 = await createProject(
            testUserId,
            validateProjectPayload({
                title: "Cloud MicroVM Runtime",
                tagline: "Zero cold-start edge routing",
                category: "Cloud & DevOps",
                technologies: ["Rust", "WASM", "Docker"],
                status: "published",
                isPublished: true,
            })
        );
        const p4 = await createProject(
            testUserId,
            validateProjectPayload({
                title: "Neural Code Reviewer",
                tagline: "Local LLM code audit tool",
                category: "AI / ML",
                technologies: ["Python", "PyTorch", "FastAPI"],
                status: "published",
                isPublished: true,
            })
        );
        console.log(`✅ Added Projects 2 (${p2.id}), 3 (${p3.id}), and 4 (${p4.id}).`);

        const atCapacity = await getUserProjects(testUserId);
        if (atCapacity.count !== 4 || atCapacity.isCapacityReached !== true) {
            throw new Error(`Expected capacity reached at 4, got count=${atCapacity.count}, isCapacityReached=${atCapacity.isCapacityReached}`);
        }
        console.log("✅ Capacity verified: 4 / 4 Projects Added. isCapacityReached = true.");

        // Test 5: Atomic hard limit enforcement (Attempting 5th project must fail)
        console.log("\n[Test 5] Attempting to create 5th project (Must throw capacity error)...");
        let capacityErrorCaught = false;
        try {
            await createProject(
                testUserId,
                validateProjectPayload({
                    title: "Illegal 5th Project",
                    category: "Other",
                    status: "draft",
                })
            );
        } catch (err: any) {
            capacityErrorCaught = true;
            console.log(`✅ 5th project correctly rejected with error: "${err.message}"`);
        }
        if (!capacityErrorCaught) {
            throw new Error("FAILED: 5th project was allowed! Hard limit violated.");
        }

        // Test 6: Project Update / Edit
        console.log("\n[Test 6] Testing Project Update...");
        const updatedP2 = await updateProject(p2.id, testUserId, {
            tagline: "Ultra-fast distributed analytics backend with 99.99% uptime",
            technologies: ["Node.js", "TypeScript", "PostgreSQL", "Redis", "Kafka"],
            features: [
                { title: "Sub-50ms query cache" },
                { title: "Fault-tolerant rate limiting" },
                { title: "Multi-cluster synchronization" },
            ],
            liveUrl: "https://orbix.dev/demo",
        });
        if (
            updatedP2.tagline !== "Ultra-fast distributed analytics backend with 99.99% uptime" ||
            updatedP2.technologies.length !== 5 ||
            updatedP2.features.length !== 3 ||
            updatedP2.liveUrl !== "https://orbix.dev/demo"
        ) {
            throw new Error("Project update did not persist correctly.");
        }
        console.log("✅ Project 2 successfully updated with new tagline, tech, and features.");

        // Test 7: Toggle Publish / Unpublish
        console.log("\n[Test 7] Testing quick publish toggle...");
        const unpublishedP2 = await toggleProjectPublish(p2.id, testUserId, false);
        if (unpublishedP2.isPublished !== false || unpublishedP2.status !== "draft") {
            throw new Error("Failed to unpublish project 2.");
        }
        const republishedP2 = await toggleProjectPublish(p2.id, testUserId, true);
        if (republishedP2.isPublished !== true || republishedP2.status !== "published") {
            throw new Error("Failed to republish project 2.");
        }
        console.log("✅ Toggle publish/unpublish verified successfully.");

        // Test 8: Reorder Projects
        console.log("\n[Test 8] Testing project reordering...");
        const reordered = await reorderProjects(testUserId, [p4.id, p3.id, p2.id, p1.id]);
        if (reordered[0].id !== p4.id || reordered[1].id !== p3.id) {
            throw new Error("Project reordering did not update display_order correctly.");
        }
        console.log("✅ Project reordering verified successfully.");

        // Test 9: Public vs Owner Project Visibility
        console.log("\n[Test 9] Testing public profile project visibility...");
        // Public visitor should only see published projects (p1 is draft, p2, p3, p4 are published)
        const publicView = await getPublicProjectsByUsername(testUsername);
        if (publicView.projects.some((p) => p.status === "draft")) {
            throw new Error("Public visitor should NEVER see draft projects!");
        }
        console.log(`✅ Public view returned ${publicView.projects.length} published projects (drafts hidden).`);

        // Owner view should see all projects including drafts
        const ownerView = await getPublicProjectsByUsername(testUsername, testUserId);
        if (ownerView.projects.length !== 4) {
            throw new Error(`Owner should see all 4 projects including drafts, got ${ownerView.projects.length}`);
        }
        console.log("✅ Owner view returned all 4 projects including drafts.");

        // Test 10: Delete a project and verify slot is freed
        console.log("\n[Test 10] Deleting a project to free up capacity...");
        await deleteProject(p1.id, testUserId);
        const postDelete = await getUserProjects(testUserId);
        if (postDelete.count !== 3 || postDelete.isCapacityReached !== false) {
            throw new Error(`Expected 3 projects after deletion, got count=${postDelete.count}`);
        }
        console.log(`✅ Deletion succeeded: Count is now ${postDelete.count} / 4. isCapacityReached = false.`);

        // Test 11: Adding a new project into the freed slot
        console.log("\n[Test 11] Adding a new project into the freed 4th slot...");
        const pReplacement = await createProject(
            testUserId,
            validateProjectPayload({
                title: "Replacement Project",
                tagline: "Created after freeing up a slot",
                category: "Web3",
                status: "published",
                isPublished: true,
            })
        );
        const postReplacement = await getUserProjects(testUserId);
        if (postReplacement.count !== 4 || postReplacement.isCapacityReached !== true) {
            throw new Error("Replacement project could not be added to freed slot.");
        }
        console.log(`✅ Replacement project created (${pReplacement.id}). Capacity is now 4 / 4 again.`);

        console.log("\n🎉 ALL 11 BACKEND PROJECT SHOWCASE TESTS PASSED PERFECTLY!\n");
    } finally {
        // Clean up test user and projects
        await query(`DELETE FROM users WHERE id = $1;`, [testUserId]);
        console.log(`🧹 Cleaned up test user: ${testUsername}`);
        process.exit(0);
    }
}

runTests().catch((err) => {
    console.error("❌ Test failed:", err);
    process.exit(1);
});
