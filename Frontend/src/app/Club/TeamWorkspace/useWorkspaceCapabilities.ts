// Frontend/src/app/Club/TeamWorkspace/useWorkspaceCapabilities.ts
import { useState, useEffect, useCallback, useMemo } from "react";
import { workspaceApi } from "../../../api/workspaceApi";
import type {
    MemberCapabilityResolution,
    WorkspaceModuleCapabilities,
} from "../../../types/workspace";

interface UseWorkspaceCapabilitiesOptions {
    clubId: string;
    initialCapabilities?: MemberCapabilityResolution | null;
    autoFetch?: boolean;
}

export function useWorkspaceCapabilities({
    clubId,
    initialCapabilities = null,
    autoFetch = true,
}: UseWorkspaceCapabilitiesOptions) {
    const [capabilities, setCapabilities] = useState<MemberCapabilityResolution | null>(initialCapabilities);
    const [loading, setLoading] = useState<boolean>(!initialCapabilities && autoFetch);
    const [error, setError] = useState<string | null>(null);

    // Sync if initialCapabilities changes
    useEffect(() => {
        if (initialCapabilities) {
            setCapabilities(initialCapabilities);
            setLoading(false);
        }
    }, [initialCapabilities]);

    const fetchCapabilities = useCallback(async () => {
        if (!clubId) return;
        setLoading(true);
        setError(null);
        try {
            const res = await workspaceApi.getCapabilities(clubId);
            if (res.success && res.capabilities) {
                setCapabilities(res.capabilities);
            }
        } catch (err: any) {
            console.error("[useWorkspaceCapabilities] Error resolving capabilities:", err);
            setError(err.message || "Failed to load member capabilities.");
        } finally {
            setLoading(false);
        }
    }, [clubId]);

    useEffect(() => {
        if (autoFetch && !initialCapabilities && clubId) {
            fetchCapabilities();
        }
    }, [autoFetch, initialCapabilities, clubId, fetchCapabilities]);

    // Convenient capability query helpers
    const can = useCallback(
        <M extends keyof WorkspaceModuleCapabilities>(
            moduleName: M,
            actionName: keyof NonNullable<WorkspaceModuleCapabilities[M]>
        ): boolean => {
            if (!capabilities) return false;
            const mod = capabilities.capabilities[moduleName] as any;
            if (!mod) return false;
            return Boolean(mod[actionName]);
        },
        [capabilities]
    );

    const canManageDepartment = useCallback(
        (departmentId?: string): boolean => {
            if (!capabilities) return false;
            const depts = capabilities.capabilities.departments;
            if (depts.manageAll) return true;
            if (!departmentId) return depts.manageAssigned;
            return (
                depts.manageableDepartmentIds.includes("*") ||
                depts.manageableDepartmentIds.includes(departmentId) ||
                capabilities.leadDepartmentIds.includes(departmentId)
            );
        },
        [capabilities]
    );

    const canManageMember = useCallback(
        (targetMemberRank?: number): boolean => {
            if (!capabilities) return false;
            if (!capabilities.capabilities.members.manage) return false;
            if (capabilities.isOwner) return true;
            if (targetMemberRank === undefined) return true;
            return targetMemberRank <= capabilities.highestManageableRank;
        },
        [capabilities]
    );

    const canReviewTask = useCallback(
        (taskDepartmentId?: string): boolean => {
            if (!capabilities) return false;
            const tasks = capabilities.capabilities.tasks;
            if (!tasks.review) return false;
            if (capabilities.isOwner || capabilities.isAdmin) return true;
            if (!taskDepartmentId) return true;
            return (
                tasks.manageableDepartmentIds.includes("*") ||
                tasks.manageableDepartmentIds.includes(taskDepartmentId) ||
                capabilities.leadDepartmentIds.includes(taskDepartmentId)
            );
        },
        [capabilities]
    );

    const isTabAllowed = useCallback(
        (tabId: string): boolean => {
            if (!capabilities) return false;
            return capabilities.navigation.allowedTabs.includes(tabId);
        },
        [capabilities]
    );

    const allowedTabs = useMemo(() => {
        return capabilities?.navigation.allowedTabs || ["overview"];
    }, [capabilities]);

    return {
        capabilities,
        loading,
        error,
        refreshCapabilities: fetchCapabilities,
        can,
        canManageDepartment,
        canManageMember,
        canReviewTask,
        isTabAllowed,
        allowedTabs,
        isOwner: capabilities?.isOwner || false,
        isAdmin: capabilities?.isAdmin || false,
        isWorkspaceManager: capabilities?.isWorkspaceManager || false,
        leadDepartmentIds: capabilities?.leadDepartmentIds || [],
        memberDepartmentIds: capabilities?.memberDepartmentIds || [],
    };
}
