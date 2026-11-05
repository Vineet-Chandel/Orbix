import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import {
    ArrowLeft,
} from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import { ConfirmationModal } from "../../../components/ConfirmationModal";
import type { ClubSettingsViewKey } from "./types";
import { ClubSettingsHub } from "./ClubSettingsHub";
import { ClubAccountCenterView } from "./ClubAccountCenterView";
import { ClubAccountPrivacyView } from "./ClubAccountPrivacyView";
import { ClubSettingDetailView } from "./ClubSettingDetailView";
import {
    fetchClubSettingsStatus,
    updateClubPrivacy,
} from "../../../api/clubSettingsApi";

interface ClubSettingsViewProps {
    club: {
        id: string;
        name: string;
        slug: string;
        college_name: string;
        college_city?: string;
        college_state?: string;
        logo_url: string | null;
        public_email?: string | null;
        verified_at?: string;
        is_active?: boolean;
        profile_visibility?: "public" | "unlisted" | "private";
    };
    user: any;
    onSignOut: () => void;
}

export const ClubSettingsView: React.FC<ClubSettingsViewProps> = ({
    club: initialClub,
    user,
    onSignOut,
}) => {
    const toast = useToast();
    const [searchParams, setSearchParams] = useSearchParams();
    const contentScrollRef = useRef<HTMLDivElement>(null);

    // Active subview determined by URL ?view= query parameter (defaults to "hub")
    const currentView = (searchParams.get("view") as ClubSettingsViewKey) || "hub";

    const [isUpdatingPrivacy, setIsUpdatingPrivacy] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Local club and privacy state
    const [clubState, setClubState] = useState(initialClub);
    const [isPublic, setIsPublic] = useState<boolean>(() => {
        return initialClub.profile_visibility !== "private";
    });

    const refreshClubStatus = async () => {
        try {
            const data = await fetchClubSettingsStatus();
            if (data?.club) {
                setClubState(data.club);
                setIsPublic(data.club.profile_visibility !== "private");
            }
        } catch {
            // ignore background sync errors
        }
    };

    useEffect(() => {
        refreshClubStatus();
    }, []);

    // Handle view navigation
    const handleSelectView = (view: ClubSettingsViewKey) => {
        if (view === "hub") {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.delete("view");
                return next;
            }, { replace: true });
        } else {
            setSearchParams((prev) => {
                const next = new URLSearchParams(prev);
                next.set("view", view);
                return next;
            }, { replace: true });
        }
        contentScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Instant zero-lag privacy toggle
    const handleTogglePrivacy = async (newIsPublic: boolean) => {
        if (isUpdatingPrivacy) return;

        // 1. Optimistic local update
        setIsPublic(newIsPublic);
        setClubState((prev) => ({
            ...prev,
            profile_visibility: newIsPublic ? "public" : "private",
        }));

        // 2. Persist to backend
        setIsUpdatingPrivacy(true);
        try {
            await updateClubPrivacy({
                isPublic: newIsPublic,
                profileVisibility: newIsPublic ? "public" : "private",
            });

            if (!newIsPublic) {
                toast.success(
                    "Club showcase is now Private. Public explore rankings and student discovery are paused.",
                    { title: "Showcase is now Private" }
                );
            } else {
                toast.success(
                    "Club showcase is now Public. Campus students and sponsors can view your organization.",
                    { title: "Showcase is now Public" }
                );
            }
        } catch (err: any) {
            // Rollback on failure
            setIsPublic(!newIsPublic);
            setClubState((prev) => ({
                ...prev,
                profile_visibility: !newIsPublic ? "public" : "private",
            }));
            toast.error(err?.message || "Failed to update showcase privacy. Please try again.", {
                title: "Privacy Update Failed",
            });
        } finally {
            setIsUpdatingPrivacy(false);
        }
    };

    const handleConfirmLogout = async () => {
        setIsLoggingOut(true);
        try {
            await onSignOut();
        } finally {
            setIsLoggingOut(false);
            setIsLogoutModalOpen(false);
        }
    };

    const renderActiveView = () => {
        if (currentView === "hub") {
            return (
                <ClubSettingsHub
                    club={clubState}
                    user={user}
                    isPublic={isPublic}
                    onSelectView={handleSelectView}
                    onRequestLogout={() => setIsLogoutModalOpen(true)}
                />
            );
        }

        if (currentView === "account-center") {
            return (
                <ClubAccountCenterView
                    club={clubState}
                    user={user}
                    isPublic={isPublic}
                    onSelectView={handleSelectView}
                    onBack={() => handleSelectView("hub")}
                />
            );
        }

        if (currentView === "account-privacy") {
            return (
                <ClubAccountPrivacyView
                    club={clubState}
                    user={user}
                    isPublic={isPublic}
                    isUpdating={isUpdatingPrivacy}
                    onTogglePrivacy={handleTogglePrivacy}
                    onBack={() => handleSelectView("account-center")}
                />
            );
        }

        return (
            <ClubSettingDetailView
                viewKey={currentView}
                club={clubState}
                user={user}
                onBack={() => {
                    if (["verify-account", "password-security", "manage-account"].includes(currentView)) {
                        handleSelectView("account-center");
                    } else {
                        handleSelectView("hub");
                    }
                }}
                onSelectView={handleSelectView}
                onRefreshStatus={refreshClubStatus}
            />
        );
    };

    return (
        <div ref={contentScrollRef} className="space-y-6">
            {/* Top Subview Breadcrumbs Header */}
            {currentView !== "hub" && (
                <div className="flex items-center justify-between gap-3 text-xs font-bold text-neutral-600 pb-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <button
                            type="button"
                            onClick={() => handleSelectView("hub")}
                            className="hover:text-black hover:underline cursor-pointer flex items-center gap-1 font-black text-black"
                        >
                            <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                            <span>Club Settings</span>
                        </button>
                        <span>/</span>
                        {["verify-account", "account-privacy", "password-security", "manage-account"].includes(currentView) && (
                            <>
                                <button
                                    type="button"
                                    onClick={() => handleSelectView("account-center")}
                                    className="hover:text-black hover:underline cursor-pointer"
                                >
                                    Account Center
                                </button>
                                <span>/</span>
                            </>
                        )}
                        <span className="text-black font-black capitalize">
                            {currentView.replace(/-/g, " ")}
                        </span>
                    </div>
                </div>
            )}

            {/* Active Content */}
            {renderActiveView()}

            {/* Logout Confirmation Modal */}
            <ConfirmationModal
                isOpen={isLogoutModalOpen}
                onClose={() => !isLoggingOut && setIsLogoutModalOpen(false)}
                onConfirm={handleConfirmLogout}
                isLoading={isLoggingOut}
                title="Log out of Club Space?"
                description={
                    <span>
                        Are you sure you want to sign out of{" "}
                        <strong className="text-black font-black">
                            @{clubState.slug || "your organization"}
                        </strong>
                        ? You can sign back in at any time with your credentials.
                    </span>
                }
                confirmText={isLoggingOut ? "Signing out..." : "Log Out"}
                cancelText="Cancel"
                variant="danger"
            />
        </div>
    );
};
