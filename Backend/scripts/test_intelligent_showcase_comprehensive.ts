if (typeof process.loadEnvFile === "function") { try { process.loadEnvFile(path.resolve(__dirname, "../.env")); } catch {} }

import { query } from "../src/database/client.js";
import {
    createProject,
    updateProject,
    deleteProject,
    reorderProjects,
    getProjectById,
    getUserProjects,
    getPublicProjectsByUsername,
    toggleProjectPublish,
    checkProjectSyncDiff,
    applyProjectSyncMerge,
    resetProjectFieldToExtracted,
} from "../src/services/project/projectService.js";
import {
    buildMergedProjectPayload,
    computeProjectDiff,
} from "../src/services/project/projectMergeEngine.js";
import {
    parseAndNormalizeGithubUrl,
    GithubUrlValidationError,
} from "../src/services/project/githubUrlParser.js";
import {
    encryptSecret,
    decryptSecret,
    generateInstallationState,
    verifyInstallationState,
} from "../src/services/project/githubAppService.js";
import { ProjectValidationError } from "../src/validators/ProjectValidator.js";

async function runComprehensiveVerification() {
    console.log("===============================================================================");
    console.log("🚀 ORBIX INTELLIGENT PROJECT SHOWCASE — COMPREHENSIVE END-TO-END VERIFICATION");
    console.log("===============================================================================\n");

    // Setup Test Users (username varchar(20) limit)
    const suffix = Math.random().toString(36).slice(2, 8);
    const usernameOwner = `ow_${suffix}`;
    const emailOwner = `${usernameOwner}@orbix.test`;
    const ownerRes = await query<{ id: string }>(
        `INSERT INTO users (username, firstname, lastname, email, password, is_public)
         VALUES ($1, 'Showcase', 'Owner', $2, 'hashed_pw', true)
         RETURNING id`,
        [usernameOwner, emailOwner]
    );
    const ownerId = ownerRes.rows[0].id;

    const usernameAttacker = `at_${suffix}`;
    const emailAttacker = `${usernameAttacker}@orbix.test`;
    const attackerRes = await query<{ id: string }>(
        `INSERT INTO users (username, firstname, lastname, email, password, is_public)
         VALUES ($1, 'Showcase', 'Attacker', $2, 'hashed_pw', true)
         RETURNING id`,
        [usernameAttacker, emailAttacker]
    );
    const attackerId = attackerRes.rows[0].id;

    console.log(`👤 Owner User: ${usernameOwner} (${ownerId})`);
    console.log(`👤 Attacker User: ${usernameAttacker} (${attackerId})\n`);

    const createdProjectIds: string[] = [];

    try {
        // =========================================================================
        // SECTION 1: SSRF PROTECTION & GITHUB URL VALIDATION
        // =========================================================================
        console.log("🛡️ [Section 1] Testing SSRF Protection & URL Normalization...");

        const invalidUrls = [
            "https://github.com.attacker.example/facebook/react",
            "http://localhost/facebook/react",
            "http://127.0.0.1/facebook/react",
            "http://169.254.169.254/latest/meta-data",
            "http://192.168.1.1/test/repo",
            "http://10.0.0.1/internal/repo",
            "https://notgithub.com/facebook/react",
            "https://attacker:secret@github.com/facebook/react",
            "ftp://github.com/facebook/react",
            "https://gitlab.com/gitlab-org/gitlab",
            "https://bitbucket.org/atlassian/sample",
        ];

        for (const badUrl of invalidUrls) {
            try {
                parseAndNormalizeGithubUrl(badUrl);
                throw new Error(`SSRF vulnerability: '${badUrl}' was unexpectedly accepted!`);
            } catch (err: any) {
                if (err instanceof GithubUrlValidationError) {
                    // Expected rejection
                } else {
                    throw err;
                }
            }
        }
        console.log(`✅ All ${invalidUrls.length} malicious SSRF and unsupported URLs successfully rejected.`);

        // Test safe normalization
        const validNormalizationCases = [
            {
                input: "https://github.com/facebook/react.git",
                expected: "facebook/react",
            },
            {
                input: "https://github.com/vercel/next.js/tree/canary",
                expected: "vercel/next.js",
            },
            {
                input: "github.com/tailwindlabs/tailwindcss/",
                expected: "tailwindlabs/tailwindcss",
            },
            {
                input: "torvalds/linux",
                expected: "torvalds/linux",
            },
        ];

        for (const testCase of validNormalizationCases) {
            const parsed = parseAndNormalizeGithubUrl(testCase.input);
            if (parsed.normalizedFullName !== testCase.expected) {
                throw new Error(`Normalization mismatch for '${testCase.input}': expected '${testCase.expected}', got '${parsed.normalizedFullName}'`);
            }
        }
        console.log(`✅ All ${validNormalizationCases.length} valid GitHub URLs safely normalized.\n`);

        // =========================================================================
        // SECTION 2: GITHUB CREDENTIAL ENCRYPTION & CSRF PROTECTION
        // =========================================================================
        console.log("🔐 [Section 2] Testing GitHub Credential Encryption & State CSRF Verification...");
        const sampleToken = "ghp_secure_installation_token_abc123xyz789";
        const encrypted = encryptSecret(sampleToken);
        const decrypted = decryptSecret(encrypted);

        if (decrypted !== sampleToken) {
            throw new Error("AES-256-GCM token encryption roundtrip failed.");
        }
        if (encrypted.includes(sampleToken)) {
            throw new Error("Plaintext token leaked in encrypted payload!");
        }
        console.log("✅ AES-256-GCM token encryption & authenticated decryption verified.");

        // CSRF state verification
        const stateToken = generateInstallationState(ownerId, "facebook/react");
        const verifiedState = verifyInstallationState(stateToken);
        if (verifiedState.userId !== ownerId || verifiedState.repoHint !== "facebook/react") {
            throw new Error("State HMAC verification returned corrupted payload.");
        }
        console.log("✅ HMAC-SHA256 OAuth/Install state verification verified.\n");

        // =========================================================================
        // SECTION 3: ATOMIC 4-PROJECT CAPACITY & RACE CONDITION SERIALIZATION
        // =========================================================================
        console.log("📦 [Section 3] Testing 4-Project Capacity Limit & Atomic Locking...");

        // Initially 0 projects
        const initialList = await getUserProjects(ownerId);
        if (initialList.count !== 0 || initialList.projects.length !== 0) {
            throw new Error("Initial projects count should be 0.");
        }
        console.log("✅ Case 1: Initial state has 0 projects.");

        // Add 4 projects
        for (let i = 1; i <= 4; i++) {
            const p = await createProject(ownerId, {
                title: `Production System ${i}`,
                tagline: `Flagship Architecture #${i}`,
                description: `High-availability cloud native architecture #${i}`,
                category: i % 2 === 0 ? "Distributed Systems" : "Full-Stack",
                isPublished: i <= 3, // 3 published, 1 draft
                showOnProfile: true,
                technologies: ["TypeScript", "PostgreSQL", "Docker"],
                features: [{ title: `Feature #${i}` }],
                displayOrder: i - 1,
            });
            createdProjectIds.push(p.id);
        }

        const capacityList = await getUserProjects(ownerId);
        if (capacityList.count !== 4 || !capacityList.isCapacityReached) {
            throw new Error(`Expected 4 projects and isCapacityReached = true, got count=${capacityList.count}`);
        }
        console.log(`✅ Successfully added 4 projects. Capacity status: ${capacityList.count} / ${capacityList.maxCapacity} (Reached: ${capacityList.isCapacityReached}).`);

        // Attempt 5th project (Must be rejected)
        let fifthRejected = false;
        try {
            await createProject(ownerId, {
                title: "Illegal 5th Project",
                tagline: "Should be blocked",
                description: "This should fail",
            });
        } catch (err: any) {
            fifthRejected = true;
            if (!err.message.includes("Maximum project capacity reached") && !err.message.includes("4 projects")) {
                throw new Error(`Unexpected error message on 5th project: ${err.message}`);
            }
        }

        if (!fifthRejected) {
            throw new Error("5th project was unexpectedly created! Capacity limit failure.");
        }
        console.log("✅ 5th project successfully blocked by atomic transaction check.");

        // Concurrent insertion race condition
        const concurrentAttempts = await Promise.allSettled([
            createProject(ownerId, { title: "Concurrent A", tagline: "Race test" }),
            createProject(ownerId, { title: "Concurrent B", tagline: "Race test" }),
        ]);
        const rejectedCount = concurrentAttempts.filter((res) => res.status === "rejected").length;
        if (rejectedCount !== 2) {
            throw new Error(`Concurrent race condition failed: expected 2 rejections, got ${rejectedCount}`);
        }
        console.log("✅ Concurrent 5th-project insertion race conditions strictly serialized and rejected via advisory transaction lock.\n");

        // =========================================================================
        // SECTION 4: IDOR & OWNERSHIP AUTHORIZATION
        // =========================================================================
        console.log("🔒 [Section 4] Testing IDOR & Ownership Authorization Boundaries...");
        const targetProjectId = createdProjectIds[0];

        // Attacker attempts to update Owner's project
        let attackerUpdateBlocked = false;
        try {
            await updateProject(targetProjectId, attackerId, { title: "Hacked by Attacker" });
        } catch (err: any) {
            attackerUpdateBlocked = true;
        }
        if (!attackerUpdateBlocked) {
            throw new Error("IDOR failure: Attacker was able to update Owner's project!");
        }
        console.log("✅ Attacker blocked from updating Owner's project via ID manipulation.");

        // Attacker attempts to delete Owner's project
        let attackerDeleteBlocked = false;
        try {
            await deleteProject(targetProjectId, attackerId);
        } catch (err: any) {
            attackerDeleteBlocked = true;
        }
        if (!attackerDeleteBlocked) {
            throw new Error("IDOR failure: Attacker was able to delete Owner's project!");
        }
        console.log("✅ Attacker blocked from deleting Owner's project via ID manipulation.");

        // Attacker attempts to access private draft
        const draftProjectId = createdProjectIds[3]; // 4th project is draft (isPublished = false)
        let attackerDraftAccessBlocked = false;
        try {
            await getProjectById(draftProjectId, attackerId);
        } catch (err: any) {
            attackerDraftAccessBlocked = true;
        }
        if (!attackerDraftAccessBlocked) {
            throw new Error("IDOR failure: Attacker was able to view Owner's draft project!");
        }
        console.log("✅ Attacker blocked from retrieving Owner's draft project.\n");

        // =========================================================================
        // SECTION 5: FIELD-LEVEL PROVENANCE & MERGE STRATEGY
        // =========================================================================
        console.log("🧬 [Section 5] Testing User Editing & Merge Provenance Strategy...");
        // Set extracted data snapshot
        await query(
            `UPDATE user_projects 
             SET raw_extracted_data = $1, repo_url = 'https://github.com/orbix/engine'
             WHERE id = $2`,
            [
                JSON.stringify({
                    title: "Engine Upstream",
                    tagline: "Upstream extracted tagline",
                    description: "Upstream extracted description",
                }),
                targetProjectId,
            ]
        );

        // User manually edits title and tagline
        await updateProject(targetProjectId, ownerId, {
            title: "Orbix Core Engine (Authoritative User Title)",
            tagline: "Custom Authoritative Tagline",
        });

        // Verify field_overrides
        const projectBeforeSync = await getProjectById(targetProjectId, ownerId);
        if (!projectBeforeSync.fieldOverrides?.title || !projectBeforeSync.fieldOverrides?.tagline) {
            throw new Error("fieldOverrides did not record user edits on title/tagline.");
        }
        console.log("✅ Field-level provenance correctly tracked user overrides.");

        // Apply simulated sync merge with new upstream title
        const freshMock = {
            title: "New Upstream Engine v2",
            tagline: "New Upstream Tagline",
            description: "New Upstream Description",
            stars: 450,
            forks: 60,
        };
        const mergeResult = buildMergedProjectPayload(
            projectBeforeSync,
            freshMock,
            projectBeforeSync.fieldOverrides || {},
            { title: "keep_user" } // User decides to keep their custom title
        );
        if (mergeResult.mergedPayload.title !== "Orbix Core Engine (Authoritative User Title)") {
            throw new Error("Sync merge blew away user's authoritative title override!");
        }
        await updateProject(targetProjectId, ownerId, {
            ...mergeResult.mergedPayload,
            fieldOverrides: mergeResult.updatedOverrides,
        });
        console.log("✅ Upstream repository sync preserved user-edited fields.");

        // Test selective field reset
        const resetResult = await resetProjectFieldToExtracted(targetProjectId, ownerId, "title");
        if (resetResult.title !== "Engine Upstream") {
            throw new Error(`Field reset failed: expected 'Engine Upstream', got '${resetResult.title}'`);
        }
        if (resetResult.fieldOverrides?.title) {
            throw new Error("fieldOverrides for title should be cleared after reset.");
        }
        console.log("✅ Selective field reset successfully restored extracted upstream value.\n");

        // =========================================================================
        // SECTION 6: PHASE 7 PROFILE SHOWCASE CONDITIONAL RENDERING RULES
        // =========================================================================
        console.log("🎨 [Section 6] Testing Phase 7 Profile Rendering Acceptance Cases...");

        // Case 2: User has published projects
        const publicShowcaseCase2 = await getPublicProjectsByUsername(usernameOwner);
        if (publicShowcaseCase2.projects.length !== 3) {
            throw new Error(`Expected 3 published projects, got ${publicShowcaseCase2.projects.length}`);
        }
        // Verify redaction of internal metadata
        for (const pubProj of publicShowcaseCase2.projects) {
            if ((pubProj as any).rawExtractedData || (pubProj as any).fieldOverrides || (pubProj as any).syncMetadata) {
                throw new Error("Sensitive extraction metadata leaked in public API response!");
            }
        }
        console.log("✅ Case 2: Public showcase returns only published projects and redacts sensitive extraction metadata.");

        // Case 3: Projects exist but none are published
        // Unpublish all 3 published projects
        for (let i = 0; i < 3; i++) {
            await toggleProjectPublish(createdProjectIds[i], ownerId, false);
        }
        const publicShowcaseCase3 = await getPublicProjectsByUsername(usernameOwner);
        if (publicShowcaseCase3.projects.length !== 0) {
            throw new Error(`Case 3 failed: expected 0 projects in public showcase, got ${publicShowcaseCase3.projects.length}`);
        }
        console.log("✅ Case 3: When all projects are unpublished/draft, public showcase returns 0 projects (UI section disappears).");

        // Case 4: User publishes a project after previously having zero published
        await toggleProjectPublish(createdProjectIds[0], ownerId, true);
        const publicShowcaseCase4 = await getPublicProjectsByUsername(usernameOwner);
        if (publicShowcaseCase4.projects.length !== 1 || publicShowcaseCase4.projects[0].id !== createdProjectIds[0]) {
            throw new Error("Case 4 failed: Published project did not immediately appear in public showcase.");
        }
        console.log("✅ Case 4: Toggling a project to published immediately exposes it on public profile without manual configuration.");

        // Test show_on_profile toggle independence
        await updateProject(createdProjectIds[0], ownerId, {
            showOnProfile: false,
        });
        const publicShowcaseHidden = await getPublicProjectsByUsername(usernameOwner);
        if (publicShowcaseHidden.projects.length !== 0) {
            throw new Error("Project with showOnProfile = false was unexpectedly returned in public showcase!");
        }
        console.log("✅ Projects with showOnProfile = false are strictly excluded from public profile.");

        // Re-enable showOnProfile
        await updateProject(createdProjectIds[0], ownerId, {
            showOnProfile: true,
        });

        // Case 5: User deletes all projects
        for (const pid of createdProjectIds) {
            await deleteProject(pid, ownerId);
        }
        const publicShowcaseCase5 = await getPublicProjectsByUsername(usernameOwner);
        if (publicShowcaseCase5.projects.length !== 0) {
            throw new Error(`Case 5 failed: expected 0 projects after deletion, got ${publicShowcaseCase5.projects.length}`);
        }
        const userProjectsAfterDelete = await getUserProjects(ownerId);
        if (userProjectsAfterDelete.count !== 0 || userProjectsAfterDelete.isCapacityReached !== false) {
            throw new Error("Slot reclamation failed after deletion.");
        }
        console.log("✅ Case 5: Deleting all projects empties public showcase and fully reclaims all 4 capacity slots.\n");

        console.log("===============================================================================");
        console.log("🎉 ALL COMPREHENSIVE INTELLIGENT PROJECT SHOWCASE TESTS PASSED PERFECTLY! 🎉");
        console.log("===============================================================================\n");

    } finally {
        // Cleanup Test Data
        await query(`DELETE FROM user_projects WHERE user_id IN ($1, $2);`, [ownerId, attackerId]);
        await query(`DELETE FROM user_github_installations WHERE user_id IN ($1, $2);`, [ownerId, attackerId]);
        await query(`DELETE FROM users WHERE id IN ($1, $2);`, [ownerId, attackerId]);
        console.log("🧹 Test user records and project entities successfully cleaned up.");
    }
}

runComprehensiveVerification()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("❌ Comprehensive Verification Failed:", err);
        process.exit(1);
    });
