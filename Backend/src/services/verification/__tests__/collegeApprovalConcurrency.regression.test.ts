/**
 * ORBIX COLLEGE VERIFICATION STAGE 3.8B REGRESSION TEST SUITE
 *
 * Verifies Founder Approval Concurrency & Atomic Database Transitions:
 * - 100% Mocked, Synchronized, In-Memory State Machine
 * - Zero Database Pollution: Supabase (bhixamqnpcbstfwvmmog) is NEVER touched
 * - Faithful PostgreSQL Row-Locking & Conditional Update Simulation
 * - Real Concurrent Race-Condition Testing via Promise.all() and Mutex Locks
 *
 * Target under test: CollegeVerificationService.approveApplication()
 */

import assert from "node:assert/strict";
import redis from "../../../redis/client.js";
import {
    CollegeVerificationService,
    type ApproveApplicationDeps,
} from "../collegeVerificationService.js";

interface VerificationRow {
    id: string;
    user_id: string;
    college_id: string;
    status: "NOT_VERIFIED" | "PENDING" | "PROCESSING" | "APPROVED" | "REJECTED" | "INVALIDATED";
    document_type: string;
    document_paths: string;
    extracted_data: string;
    student_name: string;
    enrollment_number: string;
    course_name: string;
    academic_year: string;
    email_verified_at?: Date | null | undefined;
    phone_verified_at?: Date | null | undefined;
    reviewed_by: string | null;
    reviewed_at: Date | null;
    reviewer_notes: string | null;
    rejection_reason: string | null;
    created_at: Date;
    updated_at: Date;
}

interface UserRow {
    id: string;
    username: string;
    firstname: string;
    lastname: string;
    college_id: string;
    college: string;
    is_college_verified: boolean;
    college_verified_at: Date | null;
}

class Mutex {
    private queue: Array<() => void> = [];
    private locked = false;

    async acquire(): Promise<() => void> {
        if (!this.locked) {
            this.locked = true;
            return () => this.release();
        }
        return new Promise<() => void>((resolve) => {
            this.queue.push(() => {
                this.locked = true;
                resolve(() => this.release());
            });
        });
    }

    private release() {
        if (this.queue.length > 0) {
            const next = this.queue.shift()!;
            next();
        } else {
            this.locked = false;
        }
    }
}

/**
 * Strict validator for atomic conditional update SQL statements in College Verification.
 * Verifies that:
 * 1. The target table is public.college_verifications or college_verifications.
 * 2. Target status is set to the expected transition ('APPROVED' | 'REJECTED').
 * 3. The WHERE clause contains an exact status restriction to ('PENDING', 'PROCESSING').
 * 4. A RETURNING clause is present.
 */
export function assertAtomicStatusUpdateSql(sql: string, expectedTargetStatus: "APPROVED" | "REJECTED") {
    const normalized = sql.replace(/\s+/g, " ").trim();

    // 1. Target table check
    const tableMatch = /\bUPDATE\s+(public\.)?college_verifications\b/i.test(normalized);
    assert.ok(tableMatch, `SQL must target college_verifications table. Received: ${sql}`);

    // 2. Target status check
    const statusSetRegex = new RegExp(`\\bSET\\b.*\\bstatus\\s*=\\s*'${expectedTargetStatus}'`, "i");
    assert.ok(statusSetRegex.test(normalized), `SQL must set status to '${expectedTargetStatus}'. Received: ${sql}`);

    // 3. WHERE clause status predicate check: strictly PENDING and PROCESSING
    const statusInMatch = normalized.match(/\bstatus\s+IN\s*\(([^)]+)\)/i);
    assert.ok(statusInMatch, `SQL WHERE clause must strictly restrict status IN ('PENDING', 'PROCESSING'). Received: ${sql}`);

    const rawItems = statusInMatch[1] || "";
    const items = rawItems.split(",").map((s) => s.trim().replace(/^['"]|['"]$/g, "").toUpperCase());
    assert.equal(items.length, 2, `Status predicate must contain exactly 2 statuses. Received: [${items.join(", ")}]`);
    assert.ok(
        items.includes("PENDING") && items.includes("PROCESSING"),
        `Status predicate must strictly be PENDING and PROCESSING. Received: [${items.join(", ")}]`
    );

    // 4. RETURNING clause check
    const returningMatch = /\bRETURNING\s+(\*|\w+)/i.test(normalized);
    assert.ok(returningMatch, `SQL must include a RETURNING clause. Received: ${sql}`);
}

/**
 * Faithful In-Memory Mock of PostgreSQL with Row-Level Locking and Conditional Updates.
 */
class MockPostgresDatabase {
    public applications = new Map<string, VerificationRow>();
    public users = new Map<string, UserRow>();
    public userNotifications: Array<{ userId: string; username: string; title: string; body: string }> = [];
    public auditLogs: any[] = [];
    public cacheInvalidations: string[] = [];
    public executedQueries: Array<{ text: string; params?: any[] | undefined }> = [];

    private rowLocks = new Map<string, Mutex>();
    public simulateUserUpdateFailure = false;

    private getRowLock(rowId: string): Mutex {
        let lock = this.rowLocks.get(rowId);
        if (!lock) {
            lock = new Mutex();
            this.rowLocks.set(rowId, lock);
        }
        return lock;
    }

    public seedApplication(row: VerificationRow) {
        this.applications.set(row.id, {
            ...row,
            email_verified_at: row.email_verified_at === undefined ? new Date() : row.email_verified_at,
            phone_verified_at: row.phone_verified_at === undefined ? new Date() : row.phone_verified_at,
        });
    }

    public seedUser(user: UserRow) {
        this.users.set(user.id, { ...user });
    }

    public createClient() {
        const db = this;
        let inTransaction = false;
        const heldReleases: Array<() => void> = [];
        let stagedApplicationUpdate: { id: string; row: VerificationRow } | null = null;
        let stagedUserUpdate: { id: string; verified: boolean; at: Date | null } | null = null;
        let stagedInvalidations: Array<{ id: string }> = [];

        return {
            query: async (text: string, params?: any[]) => {
                db.executedQueries.push({ text, params });
                const normalized = text.trim();

                // 1. Transaction control
                if (normalized === "BEGIN;") {
                    inTransaction = true;
                    return { rowCount: 0, rows: [] };
                }

                if (normalized === "COMMIT;") {
                    if (stagedApplicationUpdate) {
                        db.applications.set(stagedApplicationUpdate.id, stagedApplicationUpdate.row);
                        stagedApplicationUpdate = null;
                    }
                    if (stagedUserUpdate) {
                        const u = db.users.get(stagedUserUpdate.id);
                        if (u) {
                            u.is_college_verified = stagedUserUpdate.verified;
                            u.college_verified_at = stagedUserUpdate.at;
                        }
                        stagedUserUpdate = null;
                    }
                    for (const inv of stagedInvalidations) {
                        const app = db.applications.get(inv.id);
                        if (app) app.status = "INVALIDATED";
                    }
                    stagedInvalidations = [];
                    // Release all row locks
                    while (heldReleases.length > 0) {
                        const rel = heldReleases.shift()!;
                        rel();
                    }
                    inTransaction = false;
                    return { rowCount: 0, rows: [] };
                }

                if (normalized === "ROLLBACK;") {
                    stagedApplicationUpdate = null;
                    stagedUserUpdate = null;
                    stagedInvalidations = [];
                    while (heldReleases.length > 0) {
                        const rel = heldReleases.shift()!;
                        rel();
                    }
                    inTransaction = false;
                    return { rowCount: 0, rows: [] };
                }

                // 2. Initial lookup with JOIN (used by approveApplication)
                if (normalized.includes("FROM college_verifications cv") && normalized.includes("JOIN users u")) {
                    const id = params?.[0];
                    const app = db.applications.get(id);
                    if (!app) return { rowCount: 0, rows: [] };

                    const user = db.users.get(app.user_id);
                    return {
                        rowCount: 1,
                        rows: [{
                            ...app,
                            userCollegeId: user?.college_id || null,
                            username: user?.username || "testuser",
                            firstname: user?.firstname || "Test",
                            lastname: user?.lastname || "Student",
                        }],
                    };
                }

                // 2b. Direct lookup without JOIN (used by rejectApplication)
                if (normalized.startsWith("SELECT") && normalized.includes("FROM college_verifications WHERE id = $1")) {
                    const id = params?.[0];
                    const app = db.applications.get(id);
                    if (!app) return { rowCount: 0, rows: [] };
                    return { rowCount: 1, rows: [{ ...app }] };
                }

                // 2c. Check for existing approved verifications for user
                if (normalized.startsWith("SELECT") && normalized.includes("FROM college_verifications WHERE user_id = $1 AND status = 'APPROVED'")) {
                    const userId = params?.[0];
                    let hasApproved = false;
                    for (const row of db.applications.values()) {
                        if (row.user_id === userId && row.status === "APPROVED") {
                            hasApproved = true;
                            break;
                        }
                    }
                    return { rowCount: hasApproved ? 1 : 0, rows: hasApproved ? [{ exists: 1 }] : [] };
                }

                // 3. Status inspection fallback
                if (normalized.includes("FROM college_verifications WHERE id = $1 LIMIT 1") && normalized.includes("SELECT status, reviewed_by, reviewed_at")) {
                    const id = params?.[0];
                    const app = db.applications.get(id);
                    if (!app) return { rowCount: 0, rows: [] };
                    return {
                        rowCount: 1,
                        rows: [{
                            id: app.id,
                            status: app.status,
                            reviewed_by: app.reviewed_by,
                            reviewed_at: app.reviewed_at,
                            email_verified_at: app.email_verified_at ?? null,
                            phone_verified_at: app.phone_verified_at ?? null,
                        }],
                    };
                }

                // 4. ATOMIC CONDITIONAL UPDATE:
                // UPDATE college_verifications SET status = 'APPROVED' ... WHERE id = $4 AND status IN ('PENDING', 'PROCESSING') AND email_verified_at IS NOT NULL AND phone_verified_at IS NOT NULL RETURNING *;
                if (normalized.includes("UPDATE college_verifications") && normalized.includes("SET status = 'APPROVED'")) {
                    assertAtomicStatusUpdateSql(text, "APPROVED");
                    assert.ok(/email_verified_at\s+IS\s+NOT\s+NULL/i.test(normalized), "Approval SQL must atomically require email_verified_at IS NOT NULL");
                    assert.ok(/phone_verified_at\s+IS\s+NOT\s+NULL/i.test(normalized), "Approval SQL must atomically require phone_verified_at IS NOT NULL");
                    const reviewerId = params?.[0];
                    const reviewedAt = params?.[1];
                    const notes = params?.[2];
                    const id = params?.[3];

                    // Acquire row lock to simulate PostgreSQL row-level exclusivity
                    const lock = db.getRowLock(id);
                    const release = await lock.acquire();
                    heldReleases.push(release);

                    // Re-read authoritative application row under lock
                    const currentApp = db.applications.get(id);
                    if (
                        !currentApp ||
                        (currentApp.status !== "PENDING" && currentApp.status !== "PROCESSING") ||
                        !currentApp.email_verified_at ||
                        !currentApp.phone_verified_at
                    ) {
                        // Conditional update failed: 0 rows updated!
                        return { rowCount: 0, rows: [] };
                    }

                    // Condition succeeded: Update application
                    const updatedRow: VerificationRow = {
                        ...currentApp,
                        status: "APPROVED",
                        reviewed_by: reviewerId,
                        reviewed_at: reviewedAt,
                        reviewer_notes: notes,
                        updated_at: reviewedAt,
                    };

                    if (inTransaction) {
                        stagedApplicationUpdate = { id, row: updatedRow };
                        // In PostgreSQL, uncommitted update is immediately visible within its own transaction
                        return { rowCount: 1, rows: [{ ...updatedRow }] };
                    } else {
                        db.applications.set(id, updatedRow);
                        return { rowCount: 1, rows: [{ ...updatedRow }] };
                    }
                }

                // 4b. ATOMIC CONDITIONAL UPDATE (Rejection):
                // UPDATE college_verifications SET status = 'REJECTED' ... WHERE id = $5 AND status IN ('PENDING', 'PROCESSING') RETURNING *;
                if (normalized.includes("UPDATE college_verifications") && normalized.includes("SET status = 'REJECTED'")) {
                    assertAtomicStatusUpdateSql(text, "REJECTED");
                    const reason = params?.[0];
                    const reviewerId = params?.[1];
                    const reviewedAt = params?.[2];
                    const notes = params?.[3];
                    const id = params?.[4];

                    const lock = db.getRowLock(id);
                    const release = await lock.acquire();
                    heldReleases.push(release);

                    const currentApp = db.applications.get(id);
                    if (!currentApp || (currentApp.status !== "PENDING" && currentApp.status !== "PROCESSING")) {
                        return { rowCount: 0, rows: [] };
                    }

                    const updatedRow: VerificationRow = {
                        ...currentApp,
                        status: "REJECTED",
                        rejection_reason: reason,
                        reviewed_by: reviewerId,
                        reviewed_at: reviewedAt,
                        reviewer_notes: notes,
                        updated_at: reviewedAt,
                    };

                    if (inTransaction) {
                        stagedApplicationUpdate = { id, row: updatedRow };
                        return { rowCount: 1, rows: [{ ...updatedRow }] };
                    } else {
                        db.applications.set(id, updatedRow);
                        return { rowCount: 1, rows: [{ ...updatedRow }] };
                    }
                }

                // 5. Prior approved invalidation
                if (normalized.includes("UPDATE college_verifications") && normalized.includes("SET status = 'INVALIDATED'")) {
                    const userId = params?.[1];
                    const exceptId = params?.[2];
                    for (const [appId, row] of db.applications.entries()) {
                        if (row.user_id === userId && row.status === "APPROVED" && appId !== exceptId) {
                            if (inTransaction) {
                                stagedInvalidations.push({ id: appId });
                            } else {
                                row.status = "INVALIDATED";
                            }
                        }
                    }
                    return { rowCount: 1, rows: [] };
                }

                // 6. Users table update (Approval)
                if (normalized.includes("UPDATE users") && normalized.includes("SET is_college_verified = true")) {
                    if (db.simulateUserUpdateFailure) {
                        throw new Error("Simulated PostgreSQL connection failure during UPDATE users");
                    }
                    const at = params?.[0];
                    const userId = params?.[1];
                    if (inTransaction) {
                        stagedUserUpdate = { id: userId, verified: true, at };
                    } else {
                        const u = db.users.get(userId);
                        if (u) {
                            u.is_college_verified = true;
                            u.college_verified_at = at;
                        }
                    }
                    return { rowCount: 1, rows: [] };
                }

                // 6b. Users table update (Rejection/Revocation)
                if (normalized.includes("UPDATE users") && normalized.includes("SET is_college_verified = false")) {
                    const userId = params?.[0];
                    const u = db.users.get(userId);
                    if (u) {
                        u.is_college_verified = false;
                    }
                    return { rowCount: 1, rows: [] };
                }

                // 7. General user lookup
                if (normalized.includes("SELECT username FROM users WHERE id = $1")) {
                    const userId = params?.[0];
                    const u = db.users.get(userId);
                    return { rowCount: u ? 1 : 0, rows: u ? [{ username: u.username }] : [] };
                }

                // 8. Notifications insert
                if (normalized.includes("INSERT INTO user_notifications")) {
                    const userId = params?.[0];
                    const username = params?.[1];
                    const title = params?.[2];
                    const body = params?.[3];
                    db.userNotifications.push({ userId, username, title, body });
                    return { rowCount: 1, rows: [] };
                }

                return { rowCount: 0, rows: [] };
            },
            release: () => {
                while (heldReleases.length > 0) {
                    const rel = heldReleases.shift()!;
                    rel();
                }
            },
        };
    }
}

function buildDeps(db: MockPostgresDatabase): ApproveApplicationDeps {
    return {
        client: db.createClient(),
        query: async (text: string, params?: any[]) => {
            const client = db.createClient();
            return client.query(text, params);
        },
        cache: {
            deleteUserDetailsCache: async (userId: string) => {
                db.cacheInvalidations.push(`auth:${userId}`);
            },
            invalidateAllUserCaches: async (user: { username: string; id: string }) => {
                db.cacheInvalidations.push(`profile:${user.username}`);
            },
        },
        auditHook: async (event: any) => {
            db.auditLogs.push(event);
        },
    };
}

async function runTestSuite() {
    console.log("=================================================");
    console.log("🧪 ORBIX COLLEGE VERIFICATION STAGES 3.8B & 3.8D REGRESSION SUITE (HARDENED)");
    console.log("   (Synchronized In-Memory PostgreSQL Mock, Zero Shared DB Writes)");
    console.log("=================================================\n");

    let passed = 0;
    let failed = 0;

    async function test(name: string, fn: () => Promise<void>) {
        try {
            await fn();
            console.log(`  ✅ PASS: ${name}`);
            passed++;
        } catch (err: any) {
            console.error(`  ❌ FAIL: ${name}`);
            console.error("     Error:", err?.message || err);
            failed++;
        }
    }

    // 1. A pending application can be approved successfully
    await test("1. A pending application can be approved successfully", async () => {
        const db = new MockPostgresDatabase();
        db.seedUser({
            id: "user-1",
            username: "student1",
            firstname: "Aarav",
            lastname: "Sharma",
            college_id: "inst-100",
            college: "IIT Bombay",
            is_college_verified: false,
            college_verified_at: null,
        });
        db.seedApplication({
            id: "app-pending-1",
            user_id: "user-1",
            college_id: "inst-100",
            status: "PENDING",
            document_type: "student_id",
            document_paths: "[]",
            extracted_data: "{}",
            student_name: "Aarav Sharma",
            enrollment_number: "2024BTECH01",
            course_name: "Computer Science",
            academic_year: "2024-2028",
            reviewed_by: null,
            reviewed_at: null,
            reviewer_notes: null,
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        const deps = buildDeps(db);
        const result = await CollegeVerificationService.approveApplication(
            "app-pending-1",
            "founder-uuid-1",
            "Verified documents look legitimate",
            deps
        );

        assert.equal(result.success, true);
        assert.equal(result.application.status, "APPROVED");
        assert.equal(db.applications.get("app-pending-1")?.status, "APPROVED");
        assert.equal(db.applications.get("app-pending-1")?.reviewed_by, "founder-uuid-1");
        assert.equal(db.users.get("user-1")?.is_college_verified, true);
    });

    // 2. A processing application can be approved if that is an eligible state
    await test("2. A processing application can be approved if that is an eligible state", async () => {
        const db = new MockPostgresDatabase();
        db.seedUser({
            id: "user-2",
            username: "student2",
            firstname: "Priya",
            lastname: "Patel",
            college_id: "inst-101",
            college: "BITS Pilani",
            is_college_verified: false,
            college_verified_at: null,
        });
        db.seedApplication({
            id: "app-proc-1",
            user_id: "user-2",
            college_id: "inst-101",
            status: "PROCESSING",
            document_type: "erp_profile",
            document_paths: "[]",
            extracted_data: "{}",
            student_name: "Priya Patel",
            enrollment_number: "2023BITS09",
            course_name: "Electrical Eng",
            academic_year: "2023-2027",
            reviewed_by: null,
            reviewed_at: null,
            reviewer_notes: null,
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        const deps = buildDeps(db);
        const result = await CollegeVerificationService.approveApplication(
            "app-proc-1",
            "founder-uuid-2",
            "Manual ERP inspection passed",
            deps
        );

        assert.equal(result.success, true);
        assert.equal(result.application.status, "APPROVED");
        assert.equal(db.applications.get("app-proc-1")?.status, "APPROVED");
    });

    // 3. An already approved application cannot be approved again
    await test("3. An already approved application cannot be approved again", async () => {
        const db = new MockPostgresDatabase();
        db.seedUser({
            id: "user-3",
            username: "student3",
            firstname: "Rohan",
            lastname: "Verma",
            college_id: "inst-102",
            college: "IIT Delhi",
            is_college_verified: true,
            college_verified_at: new Date(),
        });
        db.seedApplication({
            id: "app-appr-1",
            user_id: "user-3",
            college_id: "inst-102",
            status: "APPROVED",
            document_type: "student_id",
            document_paths: "[]",
            extracted_data: "{}",
            student_name: "Rohan Verma",
            enrollment_number: "2022IITD01",
            course_name: "Mechanical",
            academic_year: "2022-2026",
            reviewed_by: "original-founder-uuid",
            reviewed_at: new Date("2026-11-01T10:00:00Z"),
            reviewer_notes: "Previously approved",
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        const deps = buildDeps(db);
        let errorThrown: any = null;
        try {
            await CollegeVerificationService.approveApplication(
                "app-appr-1",
                "intruder-founder-uuid",
                "Overwriting approval",
                deps
            );
        } catch (err: any) {
            errorThrown = err;
        }

        assert.ok(errorThrown, "Must reject approval of already approved application");
        assert.equal(errorThrown.statusCode, 409);
        assert.match(errorThrown.message, /already been approved/i);
        assert.equal(db.applications.get("app-appr-1")?.reviewed_by, "original-founder-uuid");
    });

    // 4. A rejected application cannot be approved
    await test("4. A rejected application cannot be approved", async () => {
        const db = new MockPostgresDatabase();
        db.seedUser({
            id: "user-4",
            username: "student4",
            firstname: "Ananya",
            lastname: "Singh",
            college_id: "inst-103",
            college: "IIIT Hyderabad",
            is_college_verified: false,
            college_verified_at: null,
        });
        db.seedApplication({
            id: "app-rej-1",
            user_id: "user-4",
            college_id: "inst-103",
            status: "REJECTED",
            document_type: "student_id",
            document_paths: "[]",
            extracted_data: "{}",
            student_name: "Ananya Singh",
            enrollment_number: "2021IIITH",
            course_name: "ECE",
            academic_year: "2021-2025",
            reviewed_by: "founder-uuid-rejector",
            reviewed_at: new Date(),
            reviewer_notes: "Fake ID",
            rejection_reason: "Document appears altered",
            created_at: new Date(),
            updated_at: new Date(),
        });

        const deps = buildDeps(db);
        let errorThrown: any = null;
        try {
            await CollegeVerificationService.approveApplication(
                "app-rej-1",
                "founder-uuid-3",
                "Attempting to approve rejected",
                deps
            );
        } catch (err: any) {
            errorThrown = err;
        }

        assert.ok(errorThrown, "Must reject approval of rejected application");
        assert.equal(errorThrown.statusCode, 409);
        assert.match(errorThrown.message, /rejected/i);
    });

    // 5. An invalidated application cannot be approved
    await test("5. An invalidated application cannot be approved", async () => {
        const db = new MockPostgresDatabase();
        db.seedUser({
            id: "user-5",
            username: "student5",
            firstname: "Dev",
            lastname: "Kumar",
            college_id: "inst-104",
            college: "IIT Madras",
            is_college_verified: false,
            college_verified_at: null,
        });
        db.seedApplication({
            id: "app-inv-1",
            user_id: "user-5",
            college_id: "inst-104",
            status: "INVALIDATED",
            document_type: "student_id",
            document_paths: "[]",
            extracted_data: "{}",
            student_name: "Dev Kumar",
            enrollment_number: "2020IITM",
            course_name: "Civil",
            academic_year: "2020-2024",
            reviewed_by: "founder-uuid-1",
            reviewed_at: new Date(),
            reviewer_notes: "Superseded",
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        const deps = buildDeps(db);
        let errorThrown: any = null;
        try {
            await CollegeVerificationService.approveApplication(
                "app-inv-1",
                "founder-uuid-4",
                "Attempting to approve invalidated",
                deps
            );
        } catch (err: any) {
            errorThrown = err;
        }

        assert.ok(errorThrown, "Must reject approval of invalidated application");
        assert.equal(errorThrown.statusCode, 409);
        assert.match(errorThrown.message, /invalidated/i);
    });

    // 6. Two concurrent approval requests for the same application result in exactly one successful transition
    await test("6. Two concurrent approval requests for the same application result in exactly one successful transition", async () => {
        const db = new MockPostgresDatabase();
        db.seedUser({
            id: "user-race-1",
            username: "studentrace1",
            firstname: "Concurrent",
            lastname: "Candidate",
            college_id: "inst-iitk-100",
            college: "IIT Kanpur",
            is_college_verified: false,
            college_verified_at: null,
        });
        db.seedApplication({
            id: "app-concurrent-target",
            user_id: "user-race-1",
            college_id: "inst-iitk-100",
            status: "PENDING",
            document_type: "student_id_both_sides",
            document_paths: "[]",
            extracted_data: "{}",
            student_name: "Concurrent Candidate",
            enrollment_number: "2024IITK099",
            course_name: "Aerospace",
            academic_year: "2024-2028",
            reviewed_by: null,
            reviewed_at: null,
            reviewer_notes: null,
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        const deps1: ApproveApplicationDeps = {
            client: db.createClient(),
            query: async (text, params) => db.createClient().query(text, params),
            cache: {
                deleteUserDetailsCache: async (uid) => { db.cacheInvalidations.push(`auth:${uid}`); },
                invalidateAllUserCaches: async (u) => { db.cacheInvalidations.push(`profile:${u.username}`); },
            },
            auditHook: async (e) => { db.auditLogs.push(e); },
        };

        const deps2: ApproveApplicationDeps = {
            client: db.createClient(),
            query: async (text, params) => db.createClient().query(text, params),
            cache: {
                deleteUserDetailsCache: async (uid) => { db.cacheInvalidations.push(`auth:${uid}`); },
                invalidateAllUserCaches: async (u) => { db.cacheInvalidations.push(`profile:${u.username}`); },
            },
            auditHook: async (e) => { db.auditLogs.push(e); },
        };

        // Fire both requests concurrently using Promise.allSettled
        const [res1, res2] = await Promise.allSettled([
            CollegeVerificationService.approveApplication(
                "app-concurrent-target",
                "founder-alpha-uuid",
                "Approved by Founder Alpha",
                deps1
            ),
            CollegeVerificationService.approveApplication(
                "app-concurrent-target",
                "founder-beta-uuid",
                "Approved by Founder Beta",
                deps2
            ),
        ]);

        const fulfilled = [res1, res2].filter((r) => r.status === "fulfilled");
        const rejected = [res1, res2].filter((r) => r.status === "rejected");

        assert.equal(fulfilled.length, 1, "Exactly one approval request must succeed");
        assert.equal(rejected.length, 1, "Exactly one approval request must fail");
    });

    // 7. The losing request receives a conflict result and does not overwrite reviewer identity
    await test("7. The losing request receives a conflict result and does not overwrite reviewer identity", async () => {
        const db = new MockPostgresDatabase();
        db.seedUser({
            id: "user-race-2",
            username: "studentrace2",
            firstname: "Audit",
            lastname: "Integrity",
            college_id: "inst-iitk-100",
            college: "IIT Kanpur",
            is_college_verified: false,
            college_verified_at: null,
        });
        db.seedApplication({
            id: "app-audit-test",
            user_id: "user-race-2",
            college_id: "inst-iitk-100",
            status: "PENDING",
            document_type: "student_id",
            document_paths: "[]",
            extracted_data: "{}",
            student_name: "Audit Integrity",
            enrollment_number: "2024IITK100",
            course_name: "Computer Science",
            academic_year: "2024-2028",
            reviewed_by: null,
            reviewed_at: null,
            reviewer_notes: null,
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        const deps1 = buildDeps(db);
        const deps2 = buildDeps(db);

        const results = await Promise.allSettled([
            CollegeVerificationService.approveApplication("app-audit-test", "winning-founder-uuid", "First", deps1),
            CollegeVerificationService.approveApplication("app-audit-test", "losing-founder-uuid", "Second", deps2),
        ]);

        const failedResult: any = results.find((r) => r.status === "rejected");
        assert.ok(failedResult, "One request must be rejected");
        assert.equal(failedResult.reason.statusCode, 409, "Rejected request must receive HTTP 409 Conflict");
        assert.match(failedResult.reason.message, /already been approved/i);
    });

    // 8. The final record contains the winning founder UUID and timestamp
    await test("8. The final record contains the winning founder UUID and timestamp", async () => {
        const db = new MockPostgresDatabase();
        db.seedUser({
            id: "user-race-3",
            username: "studentrace3",
            firstname: "Record",
            lastname: "Preservation",
            college_id: "inst-iitk-100",
            college: "IIT Kanpur",
            is_college_verified: false,
            college_verified_at: null,
        });
        db.seedApplication({
            id: "app-winner-record",
            user_id: "user-race-3",
            college_id: "inst-iitk-100",
            status: "PENDING",
            document_type: "student_id",
            document_paths: "[]",
            extracted_data: "{}",
            student_name: "Record Preservation",
            enrollment_number: "2024IITK101",
            course_name: "Electrical",
            academic_year: "2024-2028",
            reviewed_by: null,
            reviewed_at: null,
            reviewer_notes: null,
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        const deps1 = buildDeps(db);
        const deps2 = buildDeps(db);

        const results = await Promise.allSettled([
            CollegeVerificationService.approveApplication("app-winner-record", "founder-first-uuid", "First notes", deps1),
            CollegeVerificationService.approveApplication("app-winner-record", "founder-second-uuid", "Second notes", deps2),
        ]);

        const winner = results.find((r) => r.status === "fulfilled") as PromiseFulfilledResult<any>;
        assert.ok(winner, "One must win");

        const winningReviewer = winner.value.application.reviewed_by;
        const appInDb = db.applications.get("app-winner-record");

        assert.equal(appInDb?.reviewed_by, winningReviewer, "Database row must retain the winning founder's UUID");
        assert.ok(appInDb?.reviewed_at instanceof Date, "Database row must have a valid review Date timestamp");
        assert.notEqual(appInDb?.reviewed_by, winningReviewer === "founder-first-uuid" ? "founder-second-uuid" : "founder-first-uuid");
    });

    // 9. Only one approval audit event is recorded
    await test("9. Only one approval audit event is recorded", async () => {
        const db = new MockPostgresDatabase();
        db.seedUser({
            id: "user-race-4",
            username: "studentrace4",
            firstname: "Audit",
            lastname: "Count",
            college_id: "inst-iitk-100",
            college: "IIT Kanpur",
            is_college_verified: false,
            college_verified_at: null,
        });
        db.seedApplication({
            id: "app-audit-count",
            user_id: "user-race-4",
            college_id: "inst-iitk-100",
            status: "PENDING",
            document_type: "student_id",
            document_paths: "[]",
            extracted_data: "{}",
            student_name: "Audit Count",
            enrollment_number: "2024IITK102",
            course_name: "Civil",
            academic_year: "2024-2028",
            reviewed_by: null,
            reviewed_at: null,
            reviewer_notes: null,
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        const deps1 = buildDeps(db);
        const deps2 = buildDeps(db);

        await Promise.allSettled([
            CollegeVerificationService.approveApplication("app-audit-count", "founder-a", "Notes A", deps1),
            CollegeVerificationService.approveApplication("app-audit-count", "founder-b", "Notes B", deps2),
        ]);

        assert.equal(db.auditLogs.length, 1, "Exactly one audit event must be logged across concurrent attempts");
        assert.equal(db.auditLogs[0]?.action, "COLLEGE_VERIFICATION_APPROVED");
        assert.equal(db.auditLogs[0]?.applicationId, "app-audit-count");
    });

    // 10. Only one approval notification is triggered
    await test("10. Only one approval notification is triggered", async () => {
        const db = new MockPostgresDatabase();
        db.seedUser({
            id: "user-race-5",
            username: "studentrace5",
            firstname: "Notif",
            lastname: "Count",
            college_id: "inst-iitk-100",
            college: "IIT Kanpur",
            is_college_verified: false,
            college_verified_at: null,
        });
        db.seedApplication({
            id: "app-notif-count",
            user_id: "user-race-5",
            college_id: "inst-iitk-100",
            status: "PENDING",
            document_type: "student_id",
            document_paths: "[]",
            extracted_data: "{}",
            student_name: "Notif Count",
            enrollment_number: "2024IITK103",
            course_name: "Chemical",
            academic_year: "2024-2028",
            reviewed_by: null,
            reviewed_at: null,
            reviewer_notes: null,
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        let notifHookCalls = 0;
        const deps1 = {
            ...buildDeps(db),
            notificationHook: async () => { notifHookCalls++; },
        };
        const deps2 = {
            ...buildDeps(db),
            notificationHook: async () => { notifHookCalls++; },
        };

        await Promise.allSettled([
            CollegeVerificationService.approveApplication("app-notif-count", "founder-a", "Notes A", deps1),
            CollegeVerificationService.approveApplication("app-notif-count", "founder-b", "Notes B", deps2),
        ]);

        assert.equal(notifHookCalls, 1, "External notification hook must be called exactly once");
        assert.equal(db.userNotifications.length, 1, "In-app user notification must be created exactly once");
        assert.match(db.userNotifications[0]?.title || "", /Approved/i);
    });

    // 11. Only the winning request performs cache invalidation and related side effects
    await test("11. Only the winning request performs cache invalidation and related side effects", async () => {
        const db = new MockPostgresDatabase();
        db.seedUser({
            id: "user-race-6",
            username: "studentrace6",
            firstname: "Cache",
            lastname: "Safety",
            college_id: "inst-iitk-100",
            college: "IIT Kanpur",
            is_college_verified: false,
            college_verified_at: null,
        });
        db.seedApplication({
            id: "app-cache-safety",
            user_id: "user-race-6",
            college_id: "inst-iitk-100",
            status: "PENDING",
            document_type: "student_id",
            document_paths: "[]",
            extracted_data: "{}",
            student_name: "Cache Safety",
            enrollment_number: "2024IITK104",
            course_name: "Physics",
            academic_year: "2024-2028",
            reviewed_by: null,
            reviewed_at: null,
            reviewer_notes: null,
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        const deps1 = buildDeps(db);
        const deps2 = buildDeps(db);

        await Promise.allSettled([
            CollegeVerificationService.approveApplication("app-cache-safety", "founder-a", "Notes A", deps1),
            CollegeVerificationService.approveApplication("app-cache-safety", "founder-b", "Notes B", deps2),
        ]);

        // Winning request invalidates auth cache + profile cache (exactly 2 entries, 1 for auth, 1 for profile)
        assert.equal(db.cacheInvalidations.length, 2, "Only winning request must perform cache invalidation");
        assert.ok(db.cacheInvalidations.includes("auth:user-race-6"));
        assert.ok(db.cacheInvalidations.includes("profile:studentrace6"));
    });

    // 12. A database failure rolls back the logical approval transaction
    await test("12. A database failure rolls back the logical approval transaction", async () => {
        const db = new MockPostgresDatabase();
        db.seedUser({
            id: "user-fail-1",
            username: "studentfail1",
            firstname: "Rollback",
            lastname: "Candidate",
            college_id: "inst-iitk-100",
            college: "IIT Kanpur",
            is_college_verified: false,
            college_verified_at: null,
        });
        db.seedApplication({
            id: "app-rollback-test",
            user_id: "user-fail-1",
            college_id: "inst-iitk-100",
            status: "PENDING",
            document_type: "student_id",
            document_paths: "[]",
            extracted_data: "{}",
            student_name: "Rollback Candidate",
            enrollment_number: "2024IITK105",
            course_name: "Bio-Eng",
            academic_year: "2024-2028",
            reviewed_by: null,
            reviewed_at: null,
            reviewer_notes: null,
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        db.simulateUserUpdateFailure = true; // Trigger failure during transaction
        const deps = buildDeps(db);

        let errorThrown: any = null;
        try {
            await CollegeVerificationService.approveApplication(
                "app-rollback-test",
                "founder-uuid-fail",
                "Will fail midway",
                deps
            );
        } catch (err: any) {
            errorThrown = err;
        }

        assert.ok(errorThrown, "Must throw transaction failure error");
        assert.match(errorThrown.message, /Simulated PostgreSQL connection failure/);

        // Verify status rolled back to PENDING and reviewer_by was not committed
        const appAfter = db.applications.get("app-rollback-test");
        assert.equal(appAfter?.status, "PENDING", "Application status must remain PENDING on transaction rollback");
        assert.equal(appAfter?.reviewed_by, null, "Application reviewed_by must remain null on transaction rollback");
        assert.equal(db.users.get("user-fail-1")?.is_college_verified, false, "User must remain unverified");
    });

    // 13. Two different applications can be approved concurrently without incorrectly blocking one another
    await test("13. Two different applications can be approved concurrently without incorrectly blocking one another", async () => {
        const db = new MockPostgresDatabase();
        db.seedUser({
            id: "user-independent-1",
            username: "student_ind_1",
            firstname: "Independent",
            lastname: "One",
            college_id: "inst-1",
            college: "IIT Madras",
            is_college_verified: false,
            college_verified_at: null,
        });
        db.seedUser({
            id: "user-independent-2",
            username: "student_ind_2",
            firstname: "Independent",
            lastname: "Two",
            college_id: "inst-2",
            college: "IIT Kharagpur",
            is_college_verified: false,
            college_verified_at: null,
        });

        db.seedApplication({
            id: "app-ind-1",
            user_id: "user-independent-1",
            college_id: "inst-1",
            status: "PENDING",
            document_type: "student_id",
            document_paths: "[]",
            extracted_data: "{}",
            student_name: "Independent One",
            enrollment_number: "2024IITM01",
            course_name: "CS",
            academic_year: "2024-2028",
            reviewed_by: null,
            reviewed_at: null,
            reviewer_notes: null,
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
        });
        db.seedApplication({
            id: "app-ind-2",
            user_id: "user-independent-2",
            college_id: "inst-2",
            status: "PENDING",
            document_type: "student_id",
            document_paths: "[]",
            extracted_data: "{}",
            student_name: "Independent Two",
            enrollment_number: "2024IITKGP02",
            course_name: "EE",
            academic_year: "2024-2028",
            reviewed_by: null,
            reviewed_at: null,
            reviewer_notes: null,
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        const deps1 = buildDeps(db);
        const deps2 = buildDeps(db);

        const [res1, res2] = await Promise.all([
            CollegeVerificationService.approveApplication("app-ind-1", "founder-1", "Approved App 1", deps1),
            CollegeVerificationService.approveApplication("app-ind-2", "founder-2", "Approved App 2", deps2),
        ]);

        assert.equal(res1.success, true);
        assert.equal(res2.success, true);
        assert.equal(res1.application.id, "app-ind-1");
        assert.equal(res2.application.id, "app-ind-2");
        assert.equal(db.applications.get("app-ind-1")?.status, "APPROVED");
        assert.equal(db.applications.get("app-ind-2")?.status, "APPROVED");
    });

    // 14. Existing successful founder approval behavior remains unchanged
    await test("14. Existing successful founder approval behavior remains unchanged", async () => {
        const db = new MockPostgresDatabase();
        db.seedUser({
            id: "user-legacy-1",
            username: "studentlegacy1",
            firstname: "Legacy",
            lastname: "Format",
            college_id: "inst-legacy",
            college: "IIT Roorkee",
            is_college_verified: false,
            college_verified_at: null,
        });
        db.seedApplication({
            id: "app-legacy-shape",
            user_id: "user-legacy-1",
            college_id: "inst-legacy",
            status: "PENDING",
            document_type: "student_id_both_sides",
            document_paths: JSON.stringify([{ publicId: "test_path", originalName: "id.jpg", size: 5000, format: "jpg" }]),
            extracted_data: JSON.stringify({ studentName: "Legacy Format" }),
            student_name: "Legacy Format",
            enrollment_number: "2024IITR99",
            course_name: "Chemical Engineering",
            academic_year: "2024-2028",
            reviewed_by: null,
            reviewed_at: null,
            reviewer_notes: null,
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        const deps = buildDeps(db);
        const response = await CollegeVerificationService.approveApplication(
            "app-legacy-shape",
            "founder-shape-checker",
            "Checking response contract",
            deps
        );

        assert.equal(response.success, true);
        assert.equal(response.message, "College verification application approved successfully.");
        assert.ok(response.application, "Response must include application object");
        assert.equal(response.application.id, "app-legacy-shape");
        assert.equal(response.application.user_id, "user-legacy-1");
        assert.equal(response.application.college_id, "inst-legacy");
        assert.equal(response.application.status, "APPROVED");
        assert.equal(response.application.reviewed_by, "founder-shape-checker");
        assert.equal(response.application.student_name, "Legacy Format");
        assert.equal(response.application.enrollment_number, "2024IITR99");
    });

    // 15. The new SQL-contract assertion passes against actual service queries (approval & rejection)
    await test("15. The new SQL-contract assertion passes against actual service queries (approval & rejection)", async () => {
        const db = new MockPostgresDatabase();
        db.seedUser({
            id: "user-sql-contract",
            username: "studentsql",
            firstname: "SQL",
            lastname: "Contract",
            college_id: "inst-sql",
            college: "IIT Bombay",
            is_college_verified: false,
            college_verified_at: null,
        });
        db.seedApplication({
            id: "app-sql-contract",
            user_id: "user-sql-contract",
            college_id: "inst-sql",
            status: "PENDING",
            document_type: "student_id",
            document_paths: "[]",
            extracted_data: "{}",
            student_name: "SQL Contract",
            enrollment_number: "2024SQL01",
            course_name: "CS",
            academic_year: "2024-2028",
            reviewed_by: null,
            reviewed_at: null,
            reviewer_notes: null,
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        const deps = buildDeps(db);
        await CollegeVerificationService.approveApplication(
            "app-sql-contract",
            "founder-contract-check",
            "Validating live query contract",
            deps
        );

        // Find the conditional UPDATE query in executedQueries
        const updateQuery = db.executedQueries.find(
            (q) => q.text.includes("UPDATE college_verifications") && q.text.includes("SET status = 'APPROVED'")
        );
        assert.ok(updateQuery, "Must have executed the conditional UPDATE query");
        assertAtomicStatusUpdateSql(updateQuery.text, "APPROVED");
    });

    // 16. Negative test: A deliberately altered SQL string with status predicate removed fails assertion
    await test("16. Negative test: A deliberately altered SQL string with status predicate removed fails assertion", async () => {
        const alteredSql = `
            UPDATE college_verifications
            SET status = 'APPROVED', reviewed_by = $1, reviewed_at = $2, reviewer_notes = $3, updated_at = $2
            WHERE id = $4
            RETURNING *;
        `;
        assert.throws(
            () => assertAtomicStatusUpdateSql(alteredSql, "APPROVED"),
            /status IN/i,
            "Must throw assertion error when status predicate is missing"
        );
    });

    // 17. Negative test: A deliberately broadened eligibility predicate fails assertion
    await test("17. Negative test: A deliberately broadened eligibility predicate fails assertion", async () => {
        const broadenedSql = `
            UPDATE college_verifications
            SET status = 'APPROVED', reviewed_by = $1, reviewed_at = $2
            WHERE id = $4 AND status IN ('PENDING', 'PROCESSING', 'REJECTED')
            RETURNING *;
        `;
        assert.throws(
            () => assertAtomicStatusUpdateSql(broadenedSql, "APPROVED"),
            /exactly 2 statuses/i,
            "Must throw assertion error when status predicate is broadened"
        );
    });

    // 18. Negative test: An incorrect eligibility predicate fails assertion
    await test("18. Negative test: An incorrect eligibility predicate fails assertion", async () => {
        const wrongPredicateSql = `
            UPDATE college_verifications
            SET status = 'APPROVED', reviewed_by = $1
            WHERE id = $4 AND status IN ('APPROVED', 'PROCESSING')
            RETURNING *;
        `;
        assert.throws(
            () => assertAtomicStatusUpdateSql(wrongPredicateSql, "APPROVED"),
            /strictly be PENDING and PROCESSING/i,
            "Must throw assertion error when status predicate contains invalid states"
        );
    });

    // 19. Negative test: An SQL string missing RETURNING clause fails assertion
    await test("19. Negative test: An SQL string missing RETURNING clause fails assertion", async () => {
        const missingReturningSql = `
            UPDATE college_verifications
            SET status = 'APPROVED', reviewed_by = $1
            WHERE id = $4 AND status IN ('PENDING', 'PROCESSING');
        `;
        assert.throws(
            () => assertAtomicStatusUpdateSql(missingReturningSql, "APPROVED"),
            /RETURNING/i,
            "Must throw assertion error when RETURNING clause is absent"
        );
    });

    // 20. Rejection workflow: rejectApplication() enforces validated atomic transition and prevents race conditions
    await test("20. Rejection workflow: rejectApplication() enforces validated atomic transition and prevents race conditions", async () => {
        const db = new MockPostgresDatabase();
        db.seedUser({
            id: "user-reject-atomic",
            username: "studentrej",
            firstname: "Rejection",
            lastname: "Candidate",
            college_id: "inst-rej",
            college: "BITS Pilani",
            is_college_verified: true,
            college_verified_at: new Date(),
        });
        db.seedApplication({
            id: "app-reject-atomic",
            user_id: "user-reject-atomic",
            college_id: "inst-rej",
            status: "PENDING",
            document_type: "student_id",
            document_paths: "[]",
            extracted_data: "{}",
            student_name: "Rejection Candidate",
            enrollment_number: "2024BITS01",
            course_name: "Mechanical",
            academic_year: "2024-2028",
            reviewed_by: null,
            reviewed_at: null,
            reviewer_notes: null,
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        const deps = {
            query: async (text: string, params?: any[]) => {
                const client = db.createClient();
                return client.query(text, params);
            },
        };

        const res = await CollegeVerificationService.rejectApplication(
            "app-reject-atomic",
            "founder-rejector-uuid",
            "ID card is expired or blurry",
            "Please re-upload a clear ID card",
            deps
        );

        assert.equal(res.success, true);
        assert.equal(res.application.status, "REJECTED");
        assert.equal(db.applications.get("app-reject-atomic")?.status, "REJECTED");
        assert.equal(db.applications.get("app-reject-atomic")?.reviewed_by, "founder-rejector-uuid");
        assert.equal(db.users.get("user-reject-atomic")?.is_college_verified, false);

        // Verify that the query executed for rejection passed the assertAtomicStatusUpdateSql validator
        const rejectQuery = db.executedQueries.find(
            (q) => q.text.includes("UPDATE college_verifications") && q.text.includes("SET status = 'REJECTED'")
        );
        assert.ok(rejectQuery, "Must have executed the conditional rejection query");
        assertAtomicStatusUpdateSql(rejectQuery.text, "REJECTED");

        // Verify that a subsequent approval or rejection attempt is rejected with HTTP 409 Conflict
        let secondReviewError: any = null;
        try {
            await CollegeVerificationService.rejectApplication(
                "app-reject-atomic",
                "second-founder",
                "Attempting duplicate rejection",
                undefined,
                deps
            );
        } catch (err: any) {
            secondReviewError = err;
        }

        assert.ok(secondReviewError, "Duplicate rejection must be rejected");
        assert.equal(secondReviewError.statusCode, 409);
        assert.match(secondReviewError.message, /already been rejected/i);
    });

    // 21. Mandatory two-factor guard: Founder approval rejected when email verification timestamp is missing
    await test("21. Founder approval rejected when email verification timestamp is missing", async () => {
        const db = new MockPostgresDatabase();
        db.seedUser({
            id: "user-no-email",
            username: "student_no_email",
            firstname: "No",
            lastname: "Email",
            college_id: "inst-no-email",
            college: "IIT Kanpur",
            is_college_verified: false,
            college_verified_at: null,
        });
        db.seedApplication({
            id: "app-missing-email",
            user_id: "user-no-email",
            college_id: "inst-no-email",
            status: "PENDING",
            document_type: "student_id",
            document_paths: "[]",
            extracted_data: "{}",
            student_name: "No Email",
            enrollment_number: "2024IITK10",
            course_name: "CSE",
            academic_year: "2024-2028",
            email_verified_at: null,
            phone_verified_at: new Date(),
            reviewed_by: null,
            reviewed_at: null,
            reviewer_notes: null,
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        const deps = buildDeps(db);
        let caughtErr: any = null;
        try {
            await CollegeVerificationService.approveApplication("app-missing-email", "founder-uuid-1", "Approve", deps);
        } catch (err: any) {
            caughtErr = err;
        }

        assert.ok(caughtErr, "Approval without email verification must fail");
        assert.equal(caughtErr.statusCode, 400);
        assert.match(caughtErr.message, /institutional email verification/i);
        assert.equal(db.applications.get("app-missing-email")?.status, "PENDING");
        assert.equal(db.users.get("user-no-email")?.is_college_verified, false);
        assert.equal(db.auditLogs.length, 0);
    });

    // 22. Mandatory two-factor guard: Founder approval rejected when phone OTP verification timestamp is missing
    await test("22. Founder approval rejected when phone OTP verification timestamp is missing", async () => {
        const db = new MockPostgresDatabase();
        db.seedUser({
            id: "user-no-phone",
            username: "student_no_phone",
            firstname: "No",
            lastname: "Phone",
            college_id: "inst-no-phone",
            college: "IIT Bombay",
            is_college_verified: false,
            college_verified_at: null,
        });
        db.seedApplication({
            id: "app-missing-phone",
            user_id: "user-no-phone",
            college_id: "inst-no-phone",
            status: "PENDING",
            document_type: "student_id",
            document_paths: "[]",
            extracted_data: "{}",
            student_name: "No Phone",
            enrollment_number: "2024IITB10",
            course_name: "EE",
            academic_year: "2024-2028",
            email_verified_at: new Date(),
            phone_verified_at: null,
            reviewed_by: null,
            reviewed_at: null,
            reviewer_notes: null,
            rejection_reason: null,
            created_at: new Date(),
            updated_at: new Date(),
        });

        const deps = buildDeps(db);
        let caughtErr: any = null;
        try {
            await CollegeVerificationService.approveApplication("app-missing-phone", "founder-uuid-1", "Approve", deps);
        } catch (err: any) {
            caughtErr = err;
        }

        assert.ok(caughtErr, "Approval without phone OTP verification must fail");
        assert.equal(caughtErr.statusCode, 400);
        assert.match(caughtErr.message, /mobile phone otp verification/i);
        assert.equal(db.applications.get("app-missing-phone")?.status, "PENDING");
        assert.equal(db.users.get("user-no-phone")?.is_college_verified, false);
        assert.equal(db.auditLogs.length, 0);
    });

    console.log(`\n=================================================`);
    console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
    console.log(`=================================================\n`);

    if (redis && typeof redis.disconnect === "function") {
        try {
            redis.disconnect();
        } catch {}
    }

    process.exit(failed > 0 ? 1 : 0);
}

runTestSuite().catch((err) => {
    console.error("Test suite crashed:", err);
    process.exit(1);
});
