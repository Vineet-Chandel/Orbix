import { query } from "../src/database/client.js";

async function verifyLifecycleEngine() {
    console.log("=== VERIFYING EVENT LIFECYCLE ENGINE ===");

    const tables = [
        "club_event_stages",
        "club_event_stage_forms",
        "club_event_stage_submissions",
        "club_event_submission_assets",
        "club_event_judging_criteria",
        "club_event_judges",
        "club_event_evaluations",
        "club_event_stage_advancements",
        "club_event_communication_logs",
        "club_event_audit_logs",
    ];

    for (const tbl of tables) {
        const res = await query(
            `SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = $1
            );`,
            [tbl]
        );
        console.log(`Table ${tbl}:`, res.rows[0].exists ? "EXISTS (OK)" : "MISSING (FAIL)");
    }

    console.log("=== VERIFICATION COMPLETED ===");
    process.exit(0);
}

verifyLifecycleEngine().catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
});
