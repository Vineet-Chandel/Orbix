import { useState, useMemo, useCallback } from "react";
import type { ClubEventApplicantRow } from "../../../api/collegeEventsApi";
import type {
    ColumnFilterRule,
    SortState,
    DynamicQuestionMeta,
    ApplicationsFilterState,
} from "./types";

/**
 * Extracts a normalized string or primitive representation of an applicant's cell value for a column
 */
export function getApplicantCellValue(
    app: ClubEventApplicantRow,
    columnId: string,
    minTeamSize?: number,
    _maxTeamSize?: number
): any {
    switch (columnId) {
        case "teamReadiness": {
            const teamName =
                app.teamName ||
                (app.answers && app.answers.__teamName) ||
                (app.formResponse && app.formResponse.__teamName) ||
                "";
            const isTeam = Boolean(app.teamId || teamName);
            if (!isTeam) {
                return "No Team";
            }
            const minSize = minTeamSize || (app as any).minTeamSize || 2;
            const confirmedCount =
                app.teamMembersCount ??
                (app.teamMembers ? app.teamMembers.length : 1);
            return confirmedCount >= minSize ? "Ready" : "Incomplete";
        }
        case "status":
            return app.status || "pending";
        case "applicantName":
            return app.applicantName || "";
        case "username":
            return app.username || "";
        case "applicantEmail":
            return app.applicantEmail || "";
        case "phoneNumber":
            return app.phoneNumber || "";
        case "institutionName":
            return app.institutionName || app.campusName || "";
        case "institutionCity":
            return app.institutionCity || "";
        case "institutionState":
            return app.institutionState || "";
        case "rollNumber": {
            const ans = { ...(app.answers || {}), ...(app.formResponse || {}) };
            return app.rollNumber || ans["q_roll_number"] || ans["roll_number"] || "";
        }
        case "department": {
            const ans = { ...(app.answers || {}), ...(app.formResponse || {}) };
            return app.department || ans["q_department"] || ans["department"] || "";
        }
        case "registeredAt":
            return app.registeredAt || "";
        default: {
            // Dynamic question check
            const attachments = app.fileAttachments || [];
            const matchedFiles = attachments.filter((f) => f.questionId === columnId);
            if (matchedFiles.length > 0) {
                return matchedFiles.map((f) => f.fileName || f.fileUrl).join(", ");
            }

            const ans = { ...(app.answers || {}), ...(app.formResponse || {}) };
            let val = ans[columnId];
            if (val === undefined && columnId.startsWith("q_")) {
                val = ans[columnId.replace(/^q_/, "")];
            } else if (val === undefined) {
                val = ans[`q_${columnId}`];
            }

            if (val === null || val === undefined) return "";
            if (Array.isArray(val)) return val.join(", ");
            if (typeof val === "object") return JSON.stringify(val);
            return String(val);
        }
    }
}

interface UseApplicationsFilterSortProps {
    applications: ClubEventApplicantRow[];
    dynamicQuestions: DynamicQuestionMeta[];
    minTeamSize?: number;
    maxTeamSize?: number;
    isTeamEvent?: boolean;
}

export function useApplicationsFilterSort({
    applications,
    dynamicQuestions: _dynamicQuestions,
    minTeamSize,
    maxTeamSize,
    isTeamEvent: _isTeamEvent,
}: UseApplicationsFilterSortProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [statusFilter, setStatusFilter] =
        useState<ApplicationsFilterState["statusFilter"]>("all");
    const [institutionFilter, setInstitutionFilter] = useState("all");
    const [stateFilter, setStateFilter] = useState("all");
    const [columnFilters, setColumnFilters] = useState<Record<string, ColumnFilterRule>>({});
    const [sort, setSort] = useState<SortState | null>({
        columnId: "registeredAt",
        direction: "desc",
    });

    const setColumnFilter = useCallback((columnId: string, rule: ColumnFilterRule | null) => {
        setColumnFilters((prev) => {
            const next = { ...prev };
            if (!rule) {
                delete next[columnId];
            } else {
                next[columnId] = rule;
            }
            return next;
        });
    }, []);

    const removeColumnFilter = useCallback((columnId: string) => {
        setColumnFilters((prev) => {
            const next = { ...prev };
            delete next[columnId];
            return next;
        });
    }, []);

    const clearAllFilters = useCallback(() => {
        setSearchQuery("");
        setStatusFilter("all");
        setInstitutionFilter("all");
        setStateFilter("all");
        setColumnFilters({});
    }, []);

    const toggleSort = useCallback((columnId: string) => {
        setSort((prev) => {
            if (!prev || prev.columnId !== columnId) {
                // When clicking teamReadiness, organizers expect ready candidates at the top on the very first tap (desc)
                const initialDir = columnId === "teamReadiness" ? "desc" : "asc";
                return { columnId, direction: initialDir };
            }

            if (columnId === "teamReadiness") {
                // For teamReadiness: desc (Ready first) -> asc (Incomplete first) -> clear to default
                if (prev.direction === "desc") {
                    return { columnId, direction: "asc" };
                }
                return { columnId: "registeredAt", direction: "desc" };
            } else {
                // For text/numeric columns: asc -> desc -> clear to default
                if (prev.direction === "asc") {
                    return { columnId, direction: "desc" };
                }
                return { columnId: "registeredAt", direction: "desc" };
            }
        });
    }, []);

    const activeColumnFiltersCount = Object.keys(columnFilters).length;
    const hasActiveFilters =
        searchQuery.trim().length > 0 ||
        statusFilter !== "all" ||
        institutionFilter !== "all" ||
        stateFilter !== "all" ||
        activeColumnFiltersCount > 0;

    // Filter and Sort Pipeline
    const filteredAndSortedApplications = useMemo(() => {
        let result = applications.slice();

        // 1. Status Filter Tab
        if (statusFilter !== "all") {
            result = result.filter((app) => app.status === statusFilter);
        }

        // 2. Institution Filter
        if (institutionFilter !== "all") {
            result = result.filter(
                (app) => (app.institutionName || app.campusName) === institutionFilter
            );
        }

        // 3. State Filter
        if (stateFilter !== "all") {
            result = result.filter((app) => app.institutionState === stateFilter);
        }

        // 4. Global Search Query
        const q = searchQuery.trim().toLowerCase();
        if (q) {
            result = result.filter((app) => {
                const nameMatch = (app.applicantName || "").toLowerCase().includes(q);
                const usernameMatch = (app.username || "").toLowerCase().includes(q);
                const emailMatch = (app.applicantEmail || "").toLowerCase().includes(q);
                const phoneMatch = (app.phoneNumber || "").toLowerCase().includes(q);
                const instMatch = (app.institutionName || app.campusName || "")
                    .toLowerCase()
                    .includes(q);
                const cityMatch = (app.institutionCity || "").toLowerCase().includes(q);
                const stateMatch = (app.institutionState || "").toLowerCase().includes(q);
                const rollMatch = (app.rollNumber || "").toLowerCase().includes(q);
                const deptMatch = (app.department || "").toLowerCase().includes(q);
                const teamNameMatch = (
                    app.teamName ||
                    (app.answers && app.answers.__teamName) ||
                    (app.formResponse && app.formResponse.__teamName) ||
                    ""
                )
                    .toLowerCase()
                    .includes(q);
                const readinessVal = getApplicantCellValue(app, "teamReadiness", minTeamSize, maxTeamSize);
                const readinessMatch = String(readinessVal).toLowerCase().includes(q);

                if (
                    nameMatch ||
                    usernameMatch ||
                    emailMatch ||
                    phoneMatch ||
                    instMatch ||
                    cityMatch ||
                    stateMatch ||
                    rollMatch ||
                    deptMatch ||
                    teamNameMatch ||
                    readinessMatch
                ) {
                    return true;
                }

                // Check answers / form response values
                const answers = { ...(app.answers || {}), ...(app.formResponse || {}) };
                for (const val of Object.values(answers)) {
                    if (val && String(val).toLowerCase().includes(q)) {
                        return true;
                    }
                }

                // Check file attachment names
                if (app.fileAttachments) {
                    for (const f of app.fileAttachments) {
                        if (f.fileName && f.fileName.toLowerCase().includes(q)) {
                            return true;
                        }
                    }
                }

                return false;
            });
        }

        // 5. Column-Specific Filter Rules
        const rules = Object.values(columnFilters);
        if (rules.length > 0) {
            result = result.filter((app) => {
                for (const rule of rules) {
                    const rawVal = getApplicantCellValue(app, rule.columnId, minTeamSize, maxTeamSize);
                    const strVal = String(rawVal ?? "").trim().toLowerCase();
                    const targetVal = String(rule.value ?? "").trim().toLowerCase();

                    // Multi-select checkboxes filter (for status, teamReadiness or multi-choice options)
                    if (rule.selectedOptions && rule.selectedOptions.length > 0) {
                        const targetOptions = rule.selectedOptions.map((opt) => opt.toLowerCase());
                        if (Array.isArray(rawVal)) {
                            const hasAny = rawVal.some((item) =>
                                targetOptions.includes(String(item).toLowerCase())
                            );
                            if (!hasAny) return false;
                        } else {
                            if (!targetOptions.includes(strVal)) {
                                return false;
                            }
                        }
                        continue;
                    }

                    switch (rule.operator) {
                        case "contains":
                            if (!strVal.includes(targetVal)) return false;
                            break;
                        case "does_not_contain":
                            if (strVal.includes(targetVal)) return false;
                            break;
                        case "equals":
                            if (strVal !== targetVal) return false;
                            break;
                        case "does_not_equal":
                            if (strVal === targetVal) return false;
                            break;
                        case "starts_with":
                            if (!strVal.startsWith(targetVal)) return false;
                            break;
                        case "is_empty":
                            if (strVal !== "" && strVal !== "no team") return false;
                            break;
                        case "is_not_empty":
                            if (strVal === "" || strVal === "no team") return false;
                            break;
                        case "has_file": {
                            const files = app.fileAttachments?.filter(
                                (f) => f.questionId === rule.columnId
                            );
                            if (!files || files.length === 0) return false;
                            break;
                        }
                        case "no_file": {
                            const files = app.fileAttachments?.filter(
                                (f) => f.questionId === rule.columnId
                            );
                            if (files && files.length > 0) return false;
                            break;
                        }
                        default:
                            break;
                    }
                }
                return true;
            });
        }

        // 6. Sorting
        if (sort && sort.columnId) {
            result.sort((a, b) => {
                // Dedicated Team Readiness Sorting (Ready > Incomplete > Solo)
                if (sort.columnId === "teamReadiness") {
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

                    const scoreA = getReadinessScore(a);
                    const scoreB = getReadinessScore(b);

                    if (scoreA !== scoreB) {
                        // "desc" (arrow down): Ready candidates (score 2) at the top!
                        // "asc" (arrow up): Incomplete candidates (score 1/0) at the top!
                        return sort.direction === "desc" ? scoreB - scoreA : scoreA - scoreB;
                    }

                    // Secondary tie-breaker: number of confirmed team members
                    const countA = a.teamMembersCount ?? (a.teamMembers ? a.teamMembers.length : 1);
                    const countB = b.teamMembersCount ?? (b.teamMembers ? b.teamMembers.length : 1);
                    if (countA !== countB) {
                        return sort.direction === "desc" ? countB - countA : countA - countB;
                    }

                    // Tertiary tie-breaker: Team name alphabetical
                    const teamA = (a.teamName || a.answers?.__teamName || "").toLowerCase();
                    const teamB = (b.teamName || b.answers?.__teamName || "").toLowerCase();
                    const cmpTeam = teamA.localeCompare(teamB);
                    if (cmpTeam !== 0) return cmpTeam;

                    // Final tie-breaker: Student name alphabetical
                    const nameA = (a.applicantName || "").toLowerCase();
                    const nameB = (b.applicantName || "").toLowerCase();
                    return nameA.localeCompare(nameB);
                }

                const valA = getApplicantCellValue(a, sort.columnId, minTeamSize, maxTeamSize);
                const valB = getApplicantCellValue(b, sort.columnId, minTeamSize, maxTeamSize);

                // Date sorting for timestamps
                if (sort.columnId === "registeredAt") {
                    const dateA = new Date(valA).getTime() || 0;
                    const dateB = new Date(valB).getTime() || 0;
                    return sort.direction === "asc" ? dateA - dateB : dateB - dateA;
                }

                // Numeric sorting if both are valid numbers
                const numA = Number(valA);
                const numB = Number(valB);
                if (!isNaN(numA) && !isNaN(numB) && valA !== "" && valB !== "") {
                    return sort.direction === "asc" ? numA - numB : numB - numA;
                }

                // String sorting
                const strA = String(valA ?? "").toLowerCase();
                const strB = String(valB ?? "").toLowerCase();
                const cmp = strA.localeCompare(strB);
                return sort.direction === "asc" ? cmp : -cmp;
            });
        }

        return result;
    }, [
        applications,
        statusFilter,
        institutionFilter,
        stateFilter,
        searchQuery,
        columnFilters,
        sort,
        minTeamSize,
        maxTeamSize,
    ]);

    return {
        searchQuery,
        setSearchQuery,
        statusFilter,
        setStatusFilter,
        institutionFilter,
        setInstitutionFilter,
        stateFilter,
        setStateFilter,
        columnFilters,
        setColumnFilter,
        removeColumnFilter,
        clearAllFilters,
        sort,
        setSort,
        toggleSort,
        filteredApplications: filteredAndSortedApplications,
        activeFiltersCount:
            (statusFilter !== "all" ? 1 : 0) +
            (institutionFilter !== "all" ? 1 : 0) +
            (stateFilter !== "all" ? 1 : 0) +
            (searchQuery.trim().length > 0 ? 1 : 0) +
            activeColumnFiltersCount,
        hasActiveFilters,
    };
}
