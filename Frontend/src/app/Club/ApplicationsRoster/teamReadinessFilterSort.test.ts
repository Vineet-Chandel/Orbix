import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getApplicantCellValue } from "./useApplicationsFilterSort";
import type { ClubEventApplicantRow } from "../../../api/collegeEventsApi";

function createMockApplicant(partial: Partial<ClubEventApplicantRow>): ClubEventApplicantRow {
    return {
        id: "app-default",
        userId: "user-default",
        applicantName: "Default Student",
        applicantEmail: "default@example.com",
        username: "default_user",
        avatarUrl: null,
        department: "Computer Science",
        yearOfStudy: "3rd Year",
        rollNumber: "CS101",
        phoneNumber: "9876543210",
        ticketCode: "TCK-100",
        status: "pending",
        registeredAt: "2026-11-19T10:00:00.000Z",
        checkedInAt: null,
        notes: "",
        ...partial,
    };
}

describe("teamReadiness getApplicantCellValue", () => {
    it("returns 'Ready' when applicant has a team with confirmed members meeting minTeamSize", () => {
        const app = createMockApplicant({
            teamId: "team-1",
            teamName: "FCB",
            teamMembersCount: 2,
        });

        assert.equal(getApplicantCellValue(app, "teamReadiness", 2), "Ready");
    });

    it("returns 'Ready' when teamMembers array count meets minTeamSize", () => {
        const app = createMockApplicant({
            teamId: "team-1",
            teamName: "FCB",
            teamMembers: [
                { userId: "u1", username: "u1", name: "User 1", email: "u1@e.com", role: "leader", status: "active" },
                { userId: "u2", username: "u2", name: "User 2", email: "u2@e.com", role: "member", status: "active" },
            ],
        });

        assert.equal(getApplicantCellValue(app, "teamReadiness", 2), "Ready");
    });

    it("returns 'Incomplete' when confirmed members are less than minTeamSize", () => {
        const app = createMockApplicant({
            teamId: "team-2",
            teamName: "vineet the master",
            teamMembersCount: 0,
        });

        assert.equal(getApplicantCellValue(app, "teamReadiness", 2), "Incomplete");
    });

    it("returns 'Incomplete' when applicant has staged team name with 1 member when minTeamSize is 2", () => {
        const app = createMockApplicant({
            answers: { __teamName: "Alpha Team" },
            teamMembersCount: 1,
        });

        assert.equal(getApplicantCellValue(app, "teamReadiness", 2), "Incomplete");
    });

    it("returns 'No Team' when applicant has no team data", () => {
        const app = createMockApplicant({
            teamId: null,
            teamName: null,
        });

        assert.equal(getApplicantCellValue(app, "teamReadiness", 2), "No Team");
    });
});

describe("teamReadiness sorting logic", () => {
    const readyApp1 = createMockApplicant({
        id: "app-1",
        applicantName: "Vineet Chandel",
        teamId: "team-1",
        teamName: "fcb",
        teamMembersCount: 2,
    });

    const readyApp2 = createMockApplicant({
        id: "app-2",
        applicantName: "Vineet Singh",
        teamId: "team-1",
        teamName: "fcb",
        teamMembersCount: 2,
    });

    const incompleteApp = createMockApplicant({
        id: "app-3",
        applicantName: "Vineet Singh Solo",
        teamId: "team-2",
        teamName: "vineet the master",
        teamMembersCount: 0,
    });

    const soloApp = createMockApplicant({
        id: "app-4",
        applicantName: "Solo Applicant",
        teamId: null,
        teamName: null,
    });

    function sortApps(apps: ClubEventApplicantRow[], direction: "asc" | "desc", minTeamSize = 2) {
        const getReadinessScore = (app: ClubEventApplicantRow) => {
            const teamName =
                app.teamName ||
                (app.answers && app.answers.__teamName) ||
                (app.formResponse && app.formResponse.__teamName) ||
                "";
            const isTeam = Boolean(app.teamId || teamName);
            if (!isTeam) return 0;
            const minSize = minTeamSize || (app as any).minTeamSize || 2;
            const confirmedCount =
                app.teamMembersCount ??
                (app.teamMembers ? app.teamMembers.length : 1);
            return confirmedCount >= minSize ? 2 : 1;
        };

        return [...apps].sort((a, b) => {
            const scoreA = getReadinessScore(a);
            const scoreB = getReadinessScore(b);

            if (scoreA !== scoreB) {
                return direction === "desc" ? scoreB - scoreA : scoreA - scoreB;
            }

            const countA = a.teamMembersCount ?? (a.teamMembers ? a.teamMembers.length : 1);
            const countB = b.teamMembersCount ?? (b.teamMembers ? b.teamMembers.length : 1);
            if (countA !== countB) {
                return direction === "desc" ? countB - countA : countA - countB;
            }

            const teamA = (a.teamName || a.answers?.__teamName || "").toLowerCase();
            const teamB = (b.teamName || b.answers?.__teamName || "").toLowerCase();
            const cmpTeam = teamA.localeCompare(teamB);
            if (cmpTeam !== 0) return cmpTeam;

            const nameA = (a.applicantName || "").toLowerCase();
            const nameB = (b.applicantName || "").toLowerCase();
            return nameA.localeCompare(nameB);
        });
    }

    it("puts all Ready candidates at the top when sorted descending (direction = 'desc')", () => {
        const unsorted = [incompleteApp, readyApp2, soloApp, readyApp1];
        const sorted = sortApps(unsorted, "desc");

        assert.equal(sorted[0].id, "app-1");
        assert.equal(sorted[1].id, "app-2");
        assert.equal(sorted[2].id, "app-3");
        assert.equal(sorted[3].id, "app-4");

        // Verify top candidates are Ready
        assert.equal(getApplicantCellValue(sorted[0], "teamReadiness", 2), "Ready");
        assert.equal(getApplicantCellValue(sorted[1], "teamReadiness", 2), "Ready");
        assert.equal(getApplicantCellValue(sorted[2], "teamReadiness", 2), "Incomplete");
        assert.equal(getApplicantCellValue(sorted[3], "teamReadiness", 2), "No Team");
    });

    it("puts Incomplete/No-team candidates at the top when sorted ascending (direction = 'asc')", () => {
        const unsorted = [readyApp1, incompleteApp, readyApp2, soloApp];
        const sorted = sortApps(unsorted, "asc");

        // Incomplete / No team comes first in asc
        assert.equal(sorted[0].id, "app-4"); // score 0
        assert.equal(sorted[1].id, "app-3"); // score 1
        assert.equal(getApplicantCellValue(sorted[2], "teamReadiness", 2), "Ready");
        assert.equal(getApplicantCellValue(sorted[3], "teamReadiness", 2), "Ready");
    });
});
