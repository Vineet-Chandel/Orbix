import { createApi, fakeBaseQuery } from "@reduxjs/toolkit/query/react";
import { fetchCollegeEvents, fetchStudentApplications, type CollegeEventsResponse, type StudentApplicationItem } from "../api/collegeEventsApi";
import { fetchStudentCertificates, type CertificateItem } from "../api/clubCertificatesApi";
import { fetchCollegeClubs, type CollegeClubsResponse } from "../utils/clubProfileApi";
import { fetchClubCredibility, fetchClubCredibilityHistory, recalculateClubCredibility, submitCredibilityAppeal } from "../api/clubCredibilityApi";
import { workspaceApi } from "../api/workspaceApi";

// Identity is part of every key. Private responses stay in memory, never localStorage.
export interface PersonalDataScope {
    userId: string;
    collegeId?: string;
    collegeName?: string;
}

async function result<T>(load: () => Promise<T>) {
    try { return { data: await load() }; }
    catch (error) {
        return { error: { message: error instanceof Error ? error.message : "Unable to load this section." } };
    }
}

export const personalDataApi = createApi({
    reducerPath: "personalDataApi",
    baseQuery: fakeBaseQuery<{ message: string }>(),
    keepUnusedDataFor: 300,
    refetchOnMountOrArgChange: 60,
    tagTypes: ["CampusEvents", "Applications", "ClubCredibility"],
    endpoints: (build) => ({
        clubCredibility: build.query<{
            overview: Awaited<ReturnType<typeof fetchClubCredibility>>;
            ledger: Awaited<ReturnType<typeof fetchClubCredibilityHistory>>;
        }, string>({
            queryFn: () => result(async () => {
                const [overview, ledger] = await Promise.all([fetchClubCredibility(), fetchClubCredibilityHistory(1, 15)]);
                return { overview, ledger };
            }),
            keepUnusedDataFor: 900,
            providesTags: (_result, _error, clubId) => [{ type: "ClubCredibility", id: clubId }],
        }),
        clubCredibilityLedger: build.query<Awaited<ReturnType<typeof fetchClubCredibilityHistory>>, { clubId: string; page: number }>({
            queryFn: ({ page }) => result(() => fetchClubCredibilityHistory(page, 20)),
            keepUnusedDataFor: 900,
            providesTags: (_result, _error, { clubId }) => [{ type: "ClubCredibility", id: clubId }],
        }),
        syncClubCredibility: build.mutation<unknown, string>({
            queryFn: () => result(recalculateClubCredibility),
            invalidatesTags: (_result, error, clubId) => error ? [] : [{ type: "ClubCredibility", id: clubId }],
        }),
        appealClubCredibility: build.mutation<unknown, { clubId: string; ledgerId: string; reason: string }>({
            queryFn: ({ ledgerId, reason }) => result(() => submitCredibilityAppeal({ ledgerId, reason })),
            invalidatesTags: (_result, error, { clubId }) => error ? [] : [{ type: "ClubCredibility", id: clubId }],
        }),
        campusEvents: build.query<CollegeEventsResponse, PersonalDataScope>({
            queryFn: (scope) => result(() => fetchCollegeEvents(scope)),
            providesTags: ["CampusEvents"],
        }),
        campusClubs: build.query<CollegeClubsResponse, PersonalDataScope>({
            queryFn: (scope) => result(() => fetchCollegeClubs(scope)),
        }),
        myWorkspaces: build.query<Awaited<ReturnType<typeof workspaceApi.getMyWorkspaces>>, string>({
            queryFn: () => result(() => workspaceApi.getMyWorkspaces()),
        }),
        applications: build.query<StudentApplicationItem[], string>({
            queryFn: () => result(fetchStudentApplications),
            providesTags: ["Applications"],
        }),
        certificates: build.query<CertificateItem[], string>({
            queryFn: () => result(fetchStudentCertificates),
        }),
    }),
});

export const { useCampusEventsQuery, useCampusClubsQuery, useMyWorkspacesQuery,
    useApplicationsQuery, useCertificatesQuery, useClubCredibilityQuery, useClubCredibilityLedgerQuery,
    useSyncClubCredibilityMutation, useAppealClubCredibilityMutation } = personalDataApi;
