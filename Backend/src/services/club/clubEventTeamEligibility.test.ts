import test, { describe } from "node:test";
import assert from "node:assert/strict";

/**
 * Unit tests for Campus-Restricted vs. Pan-India Team Invites & Applications Deduplication
 */
describe("Team Event Invites & Eligibility Guard", () => {
    const hostCollegeId = "11111111-1111-4111-8111-111111111111";
    const externalCollegeId = "22222222-2222-4222-8222-222222222222";

    function evaluateInviteEligibility(params: {
        eventScope: "CAMPUS" | "PAN_INDIA";
        clubCollegeId: string | null;
        targetUserCollegeId: string | null;
        targetUserExistingTeamId?: string | null;
        targetUserExistingRegTeamId?: string | null;
    }) {
        const isCampusRestricted = params.eventScope !== "PAN_INDIA";

        // 1. Check if user is already participating in another team
        if (params.targetUserExistingTeamId || params.targetUserExistingRegTeamId) {
            return {
                isEligible: false,
                reason: "ALREADY_REGISTERED_IN_TEAM",
                message: "An Orbix member can only register for any event with one team only.",
            };
        }

        // 2. Campus Eligibility Check
        if (isCampusRestricted && params.clubCollegeId) {
            if (!params.targetUserCollegeId || params.targetUserCollegeId !== params.clubCollegeId) {
                return {
                    isEligible: false,
                    reason: "CAMPUS_COLLEGE_MISMATCH",
                    message: "Campus Restricted: Developer is from a different college.",
                };
            }
        }

        return {
            isEligible: true,
            reason: null,
            message: "Eligible to invite.",
        };
    }

    test("Campus event strictly blocks developers from a different college", () => {
        const result = evaluateInviteEligibility({
            eventScope: "CAMPUS",
            clubCollegeId: hostCollegeId,
            targetUserCollegeId: externalCollegeId,
        });

        assert.equal(result.isEligible, false);
        assert.equal(result.reason, "CAMPUS_COLLEGE_MISMATCH");
    });

    test("Campus event strictly blocks developers with no college assigned", () => {
        const result = evaluateInviteEligibility({
            eventScope: "CAMPUS",
            clubCollegeId: hostCollegeId,
            targetUserCollegeId: null,
        });

        assert.equal(result.isEligible, false);
        assert.equal(result.reason, "CAMPUS_COLLEGE_MISMATCH");
    });

    test("Campus event allows developers from the same college", () => {
        const result = evaluateInviteEligibility({
            eventScope: "CAMPUS",
            clubCollegeId: hostCollegeId,
            targetUserCollegeId: hostCollegeId,
        });

        assert.equal(result.isEligible, true);
        assert.equal(result.reason, null);
    });

    test("Pan-India event allows developers from ANY college across India", () => {
        const result = evaluateInviteEligibility({
            eventScope: "PAN_INDIA",
            clubCollegeId: hostCollegeId,
            targetUserCollegeId: externalCollegeId,
        });

        assert.equal(result.isEligible, true);
        assert.equal(result.reason, null);
    });

    test("Blocks inviting a developer who is already registered in another team", () => {
        const result = evaluateInviteEligibility({
            eventScope: "PAN_INDIA",
            clubCollegeId: hostCollegeId,
            targetUserCollegeId: externalCollegeId,
            targetUserExistingTeamId: "team_999",
        });

        assert.equal(result.isEligible, false);
        assert.equal(result.reason, "ALREADY_REGISTERED_IN_TEAM");
    });
});

describe("Applications Roster Single Team Deduplication", () => {
    interface MockRegRow {
        id: string;
        userId: string;
        teamId: string | null;
        teamRole: "leader" | "member" | null;
        applicantName: string;
        answers: Record<string, any> | null;
        registeredAt: string;
    }

    function deduplicateApplications(rows: MockRegRow[]): MockRegRow[] {
        const teamMap = new Map<string, MockRegRow>();
        const individualRows: MockRegRow[] = [];

        for (const row of rows) {
            if (!row.teamId) {
                individualRows.push(row);
                continue;
            }

            const existing = teamMap.get(row.teamId);
            if (!existing) {
                teamMap.set(row.teamId, row);
            } else {
                // Keep the leader row, or the row with non-empty answers
                const isCurrentLeader = row.teamRole === "leader";
                const hasCurrentAnswers = row.answers && Object.keys(row.answers).length > 0;
                const hasExistingAnswers = existing.answers && Object.keys(existing.answers).length > 0;

                if (isCurrentLeader || (hasCurrentAnswers && !hasExistingAnswers)) {
                    teamMap.set(row.teamId, row);
                }
            }
        }

        return [...individualRows, ...Array.from(teamMap.values())];
    }

    test("Deduplicates multiple team member rows into exactly 1 team row per team", () => {
        const team1 = "team-novatrix-uuid";
        const team2 = "team-swastika-uuid";

        const rows: MockRegRow[] = [
            // Team 1: Leader (with form responses)
            {
                id: "reg-1",
                userId: "user-bhumika",
                teamId: team1,
                teamRole: "leader",
                applicantName: "Bhumika Gupta",
                answers: { q_team_name: "Novatrix", q_year: "2nd Year" },
                registeredAt: "2026-11-19T10:00:00Z",
            },
            // Team 1: Member (empty answers - previously created duplicate row)
            {
                id: "reg-2",
                userId: "user-anshika",
                teamId: team1,
                teamRole: "member",
                applicantName: "Anshika Mishra",
                answers: null,
                registeredAt: "2026-11-19T10:05:00Z",
            },
            // Team 2: Member
            {
                id: "reg-3",
                userId: "user-akrati",
                teamId: team2,
                teamRole: "member",
                applicantName: "Akrati Developer",
                answers: null,
                registeredAt: "2026-11-19T11:00:00Z",
            },
            // Team 2: Leader
            {
                id: "reg-4",
                userId: "user-hardik",
                teamId: team2,
                teamRole: "leader",
                applicantName: "Hardik Soni",
                answers: { q_team_name: "SWASTIKA", q_year: "2nd Year" },
                registeredAt: "2026-11-19T10:50:00Z",
            },
            // Individual applicant (no team)
            {
                id: "reg-5",
                userId: "user-solo",
                teamId: null,
                teamRole: null,
                applicantName: "Solo Student",
                answers: { q_notes: "Solo participation" },
                registeredAt: "2026-11-19T12:00:00Z",
            },
        ];

        const deduplicated = deduplicateApplications(rows);

        // Should contain 3 rows: 1 for Team 1, 1 for Team 2, 1 for Solo
        assert.equal(deduplicated.length, 3);

        const novatrix = deduplicated.find((r) => r.teamId === team1);
        assert.ok(novatrix);
        assert.equal(novatrix.applicantName, "Bhumika Gupta");
        assert.deepEqual(novatrix.answers, { q_team_name: "Novatrix", q_year: "2nd Year" });

        const swastika = deduplicated.find((r) => r.teamId === team2);
        assert.ok(swastika);
        assert.equal(swastika.applicantName, "Hardik Soni");
        assert.deepEqual(swastika.answers, { q_team_name: "SWASTIKA", q_year: "2nd Year" });

        const solo = deduplicated.find((r) => r.id === "reg-5");
        assert.ok(solo);
        assert.equal(solo.applicantName, "Solo Student");
    });
});
