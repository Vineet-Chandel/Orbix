if (typeof process.loadEnvFile === "function") { try { process.loadEnvFile(path.resolve(__dirname, "../.env")); } catch {} }

import { query } from "../src/database/client.js";
import {
    computeProjectDiff,
    buildMergedProjectPayload,
} from "../src/services/project/projectMergeEngine.js";
import {
    createProject,
    updateProject,
    deleteProject,
    getProjectById,
    checkProjectSyncDiff,
    applyProjectSyncMerge,
    resetProjectFieldToExtracted,
} from "../src/services/project/projectService.js";

async function runPhase5Tests() {
    console.log("🛠️ Running Phase 5: User Editing & Data Merge Strategy Tests...\n");

    // 0. Setup Temporary Test User
    const testEmail = `test_merge_${Date.now()}@orbix.test`;
    const testUsername = `testmerge_${Date.now().toString(36)}`;
    const userRes = await query<{ id: string }>(
        `INSERT INTO users (username, firstname, lastname, email, password)
         VALUES ($1, 'Merge', 'Tester', $2, 'hashed_pw')
         RETURNING id`,
        [testUsername, testEmail]
    );
    const userId = userRes.rows[0].id;
    console.log(`✅ [Setup] Test user initialized: ${testUsername} (${userId})`);

    let projectId: string | null = null;

    try {
        // 1. Test Project Creation with Original Extracted Repository Snapshot
        console.log("\n[Test 1] Creating project with initial raw_extracted_data...");
        const initialExtractedData = {
            title: "Distributed KV Store",
            tagline: "High performance consistent key-value storage engine",
            description: "A Raft-replicated consistent key-value storage system.",
            category: "Distributed Systems",
            repoStars: 150,
            repoForks: 25,
            repoLanguage: "Go",
            technologies: ["Go", "Raft", "gRPC"],
            features: [
                { title: "Raft Consensus", description: "Strict linearizability" },
                { title: "LSM-Tree Storage", description: "High write throughput" },
            ],
            liveUrl: "https://kv.example.com",
        };

        const created = await createProject(userId, {
            title: initialExtractedData.title,
            tagline: initialExtractedData.tagline,
            description: initialExtractedData.description,
            category: initialExtractedData.category,
            repoUrl: "https://github.com/orbix-demo/kv-store",
            repoName: "orbix-demo/kv-store",
            repoStars: initialExtractedData.repoStars,
            repoForks: initialExtractedData.repoForks,
            repoLanguage: initialExtractedData.repoLanguage,
            technologies: initialExtractedData.technologies,
            features: initialExtractedData.features,
            liveUrl: initialExtractedData.liveUrl,
            rawExtractedData: initialExtractedData,
            fieldOverrides: {},
        });

        projectId = created.id;
        console.log(`✅ Project created with ID: ${projectId}`);
        if (!created.rawExtractedData || created.rawExtractedData.title !== "Distributed KV Store") {
            throw new Error("rawExtractedData was not persisted properly!");
        }
        if (created.fieldOverrides && Object.keys(created.fieldOverrides).length > 0) {
            throw new Error("fieldOverrides should initially be empty!");
        }

        // 2. User edits description & tagline manually (Provenance Tracking)
        console.log("\n[Test 2] Simulating User Manual Customization (Setting Field Overrides)...");
        const userCustomDescription = "Orbix Engine: Scalable distributed coordination and key-value platform built for ultra-low latency.";
        const userCustomTagline = "Next-gen distributed coordination system";

        const updated = await updateProject(projectId, userId, {
            description: userCustomDescription,
            tagline: userCustomTagline,
            fieldOverrides: {
                description: true,
                tagline: true,
            },
        });

        if (updated.description !== userCustomDescription) {
            throw new Error("User description did not save correctly!");
        }
        if (!updated.fieldOverrides?.description || !updated.fieldOverrides?.tagline) {
            throw new Error("fieldOverrides flags were not saved properly!");
        }
        console.log("✅ User manual overrides registered: { description: true, tagline: true }");

        // 3. Test Pure Merge Engine Diffing (computeProjectDiff)
        console.log("\n[Test 3] Testing Pure Project Merge Engine Diff Computation...");
        const freshExtractionMock: any = {
            repoUrl: "https://github.com/orbix-demo/kv-store",
            title: "Distributed KV Store",
            tagline: "Updated upstream tagline from GitHub",
            description: "Upstream GitHub README update: New raft engine v2.",
            category: "Distributed Systems",
            stars: 350, // Stars increased +200!
            forks: 48,  // Forks increased +23!
            primaryLanguage: "Go",
            technologies: ["Go", "Raft", "gRPC", "Prometheus"], // Added Prometheus
            features: [
                { title: "Raft Consensus", description: "Strict linearizability" },
                { title: "LSM-Tree Storage", description: "High write throughput" },
                { title: "Dynamic Clustering", description: "Zero downtime rebalancing" },
            ],
            liveUrl: "https://kv.example.com",
            license: "Apache-2.0",
        };

        const diffAnalysis = computeProjectDiff(
            updated,
            freshExtractionMock,
            updated.fieldOverrides || {},
            updated.rawExtractedData || {}
        );

        if (!diffAnalysis.hasDifferences) {
            throw new Error("Diff engine failed to detect differences!");
        }
        // Verify user-overridden fields are identified as conflicts with preserve_user_edit recommendation
        const descDiff = diffAnalysis.diffs["description"];
        if (descDiff.changeType !== "conflict" || descDiff.recommendedAction !== "preserve_user_edit") {
            throw new Error(`Expected conflict and preserve_user_edit for description, got ${descDiff.changeType} / ${descDiff.recommendedAction}`);
        }
        console.log("✅ User-overridden description protected: changeType='conflict', recommendedAction='preserve_user_edit'");

        // Verify non-overridden fields (like technologies & features) are identified as auto-update candidates
        const techDiff = diffAnalysis.diffs["technologies"];
        if (techDiff.changeType !== "modified" || techDiff.recommendedAction !== "auto_update") {
            throw new Error(`Expected modified and auto_update for technologies, got ${techDiff.changeType}`);
        }
        console.log("✅ Non-overridden technologies correctly marked for auto_update.");

        // 4. Test Merge Payload Construction with User Authoritativeness Guarantee
        console.log("\n[Test 4] Testing buildMergedProjectPayload (User Authoritativeness)...");
        const mergeResult = buildMergedProjectPayload(
            updated,
            freshExtractionMock,
            updated.fieldOverrides || {},
            { description: "keep_user", tagline: "keep_user" } // User decides to keep their custom edits
        );

        if (mergeResult.mergedPayload.description !== userCustomDescription) {
            throw new Error("Merge engine failed to preserve user's authoritative description!");
        }
        if (mergeResult.mergedPayload.tagline !== userCustomTagline) {
            throw new Error("Merge engine failed to preserve user's authoritative tagline!");
        }
        if (mergeResult.mergedPayload.repoStars !== 350 || mergeResult.mergedPayload.repoForks !== 48) {
            throw new Error("Merge engine failed to auto-update GitHub stats (stars/forks)!");
        }
        console.log("✅ Merge engine verified: User description & tagline preserved; GitHub stats updated to 350 stars, 48 forks.");

        // 5. Test Single-Field Reset to Original Extracted Repository Value
        console.log("\n[Test 5] Testing Individual Field Reset (resetProjectFieldToExtracted)...");
        const resetProject = await resetProjectFieldToExtracted(projectId, userId, "description");

        if (resetProject.description !== initialExtractedData.description) {
            throw new Error(`Expected description to reset to '${initialExtractedData.description}', got '${resetProject.description}'`);
        }
        if (resetProject.fieldOverrides?.description) {
            throw new Error("fieldOverrides.description was not cleared after reset!");
        }
        // Ensure tagline is still overridden
        if (resetProject.tagline !== userCustomTagline || !resetProject.fieldOverrides?.tagline) {
            throw new Error("Other field overrides (tagline) were accidentally mutated during single-field reset!");
        }
        console.log(`✅ Single field 'description' successfully reverted to '${resetProject.description}' while 'tagline' remained protected.`);

        console.log("\n=======================================================");
        console.log("🎉 ALL PHASE 5 DATA MERGE & PROVENANCE TESTS PASSED! 🎉");
        console.log("=======================================================\n");
    } finally {
        // Clean up test records
        if (projectId) {
            await deleteProject(projectId, userId);
            console.log("🧹 Test project cleaned up.");
        }
        await query("DELETE FROM users WHERE id = $1", [userId]);
        console.log("🧹 Test user cleaned up.");
    }
}

runPhase5Tests()
    .then(() => {
        process.exit(0);
    })
    .catch((err) => {
        console.error("\n❌ Phase 5 Test Failed:", err);
        process.exit(1);
    });
