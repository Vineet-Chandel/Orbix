import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
    Settings,
    Menu,
    ArrowLeft,
} from "lucide-react";
import { useAppDispatch, useAppSelector, updateUserProfile, clearUser } from "../../store";
import { useToast } from "../../context/ToastContext";
import { updateProfile } from "../../utils/profileApi";
import { Sidebar } from "../Dashboard/Sidebar";
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import type { SettingsViewKey } from "./types";
import { SettingsHub } from "./SettingsHub";
import { AccountCenterView } from "./AccountCenterView";
import { AccountPrivacyView } from "./AccountPrivacyView";
import { SettingDetailView } from "./SettingDetailView";

export default function SettingsPage() {
    const dispatch = useAppDispatch();
    const navigate = useNavigate();
    const toast = useToast();
    const { user } = useAppSelector((state) => state.user);

    const [searchParams, setSearchParams] = useSearchParams();
    const contentScrollRef = useRef<HTMLDivElement>(null);

    // Active subview determined by URL ?view= query parameter (defaults to "hub")
    const currentView = (searchParams.get("view") as SettingsViewKey) || "hub";

    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Controlled public profile state directly from user
    const [isPublic, setIsPublic] = useState<boolean>(() => {
        return user?.isPublic !== false;
    });

    // Synchronize local state if user changes in Redux
    useEffect(() => {
        if (user) {
            setIsPublic(user.isPublic !== false);
        }
    }, [user?.isPublic]);

    // Handle view navigation
    const handleSelectView = (view: SettingsViewKey) => {
        if (view === "hub") {
            setSearchParams({});
        } else {
            setSearchParams({ view });
        }
        // Smoothly scroll back to top of main card content
        contentScrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    };

    // Handle instant zero-lag privacy toggle
    const handleTogglePrivacy = async (newIsPublic: boolean) => {
        if (isUpdating) return;

        // 1. Synchronously update local and Redux state immediately (ZERO LAG)
        setIsPublic(newIsPublic);

        if (!newIsPublic) {
            // Turning Private: automatically cascades hire, resume, and open-to-work to false
            dispatch(
                updateUserProfile({
                    isPublic: false,
                    isHireable: false,
                    isOpenToWork: false,
                    isResumePublic: false,
                })
            );
        } else {
            // Turning Public
            dispatch(
                updateUserProfile({
                    isPublic: true,
                })
            );
        }

        // 2. Persist to backend database via PUT /api/profile
        setIsUpdating(true);
        try {
            const payload: any = {
                isPublic: newIsPublic,
            };

            if (!newIsPublic) {
                payload.isHireable = false;
                payload.isOpenToWork = false;
            }

            const updatedUser = await updateProfile(payload);

            if (updatedUser) {
                dispatch(updateUserProfile(updatedUser));
            }

            if (!newIsPublic) {
                toast.success(
                    "Hire, resume, and open to work buttons have been automatically disabled.",
                    { title: "Profile is now Private" }
                );
            } else {
                toast.success(
                    "Your developer showcase and platform analytics are visible to the public.",
                    { title: "Profile is now Public" }
                );
            }
        } catch (err: any) {
            console.error("Failed to update profile privacy:", err);
            // Revert state if request failed
            setIsPublic(!newIsPublic);
            dispatch(
                updateUserProfile({
                    isPublic: !newIsPublic,
                })
            );
            toast.error(
                err?.message || "Could not save your privacy preferences. Please try again.",
                { title: "Failed to update privacy" }
            );
        } finally {
            setIsUpdating(false);
        }
    };

    // Handle logout action
    const handleConfirmLogout = async () => {
        setIsLoggingOut(true);
        try {
            const endpoints = [
                "/api/auth/signout",
                "http://localhost:3000/api/auth/signout",
            ];
            await Promise.allSettled(
                endpoints.map((url) =>
                    fetch(url, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        credentials: "include",
                    })
                )
            );
        } catch {
            // ignore network failure on logout
        } finally {
            try {
                localStorage.removeItem("orbix_token");
                localStorage.removeItem("orbix_user");
            } catch {
                // ignore
            }
            dispatch(clearUser());
            setIsLoggingOut(false);
            setIsLogoutModalOpen(false);
            toast.success("You have been signed out successfully.", { title: "Logged Out" });
            navigate("/auth/signin");
        }
    };

    // Render active view based on currentView
    const renderActiveView = () => {
        if (currentView === "hub") {
            return (
                <SettingsHub
                    user={user}
                    isPublic={isPublic}
                    onSelectView={handleSelectView}
                    onRequestLogout={() => setIsLogoutModalOpen(true)}
                />
            );
        }

        if (currentView === "account-center") {
            return (
                <AccountCenterView
                    user={user}
                    isPublic={isPublic}
                    onSelectView={handleSelectView}
                    onBack={() => handleSelectView("hub")}
                />
            );
        }

        if (currentView === "account-privacy") {
            return (
                <AccountPrivacyView
                    user={user}
                    isPublic={isPublic}
                    isUpdating={isUpdating}
                    onTogglePrivacy={handleTogglePrivacy}
                    onBack={() => handleSelectView("account-center")}
                />
            );
        }

        return (
            <SettingDetailView
                viewKey={currentView}
                user={user}
                onBack={() => {
                    if (["verify-account", "password-security", "manage-account"].includes(currentView)) {
                        handleSelectView("account-center");
                    } else {
                        handleSelectView("hub");
                    }
                }}
                onSelectView={handleSelectView}
            />
        );
    };

    return (
        <div className="flex h-screen bg-white text-neutral-900 overflow-hidden font-sans">
            {/* Desktop & Mobile Collapsible Navigation Sidebar */}
            <Sidebar
                activeTab="settings"
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto min-w-0 p-2 sm:p-3 lg:p-3">
                <section
                    ref={contentScrollRef}
                    aria-label="Account Settings & Preferences"
                    className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
                >
                    <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6 w-full">
                        {/* Page Header (rendered on hub view) */}
                        {currentView === "hub" && (
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b-2 border-black/15">
                                <div className="flex items-start gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsMobileSidebarOpen(true)}
                                        className="lg:hidden mt-0.5 p-2 text-black hover:bg-neutral-100 rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] transition-all cursor-pointer shrink-0"
                                        aria-label="Open sidebar"
                                    >
                                        <Menu className="w-5 h-5 stroke-[2.5]" />
                                    </button>
                                    <div className="space-y-1">
                                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FFE566] border-2 border-black text-black font-black text-xs shadow-[2px_2px_0px_#000] uppercase tracking-wider">
                                            <Settings className="w-3.5 h-3.5 stroke-[2.5]" />
                                            <span>Settings & Preferences</span>
                                        </div>
                                        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-black tracking-tight pt-1">
                                            Settings
                                        </h1>
                                        <p className="text-xs sm:text-sm text-neutral-600 font-bold">
                                            Manage your account center, privacy controls, activity history, and platform preferences.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Breadcrumbs for Subviews */}
                        {currentView !== "hub" && (
                            <div className="flex items-center justify-between gap-3 text-xs font-bold text-neutral-600 pb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <button
                                        type="button"
                                        onClick={() => handleSelectView("hub")}
                                        className="hover:text-black hover:underline cursor-pointer flex items-center gap-1 font-black text-black"
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Settings</span>
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

                                <button
                                    type="button"
                                    onClick={() => handleSelectView("hub")}
                                    className="px-3 py-1 rounded-lg bg-white hover:bg-neutral-100 text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] transition-all cursor-pointer"
                                >
                                    All Settings
                                </button>
                            </div>
                        )}

                        {/* Active View Container */}
                        {renderActiveView()}
                    </div>

                    {/* Bottom Full-Width Desk Illustration (Matching all app sections) */}
                    <SectionBottomIllustration alt="Settings workspace illustration" />
                </section>
            </div>

            {/* Logout Confirmation Modal */}
            <ConfirmationModal
                isOpen={isLogoutModalOpen}
                onClose={() => !isLoggingOut && setIsLogoutModalOpen(false)}
                onConfirm={handleConfirmLogout}
                isLoading={isLoggingOut}
                title="Log out of Orbix?"
                description={
                    <span>
                        Are you sure you want to sign out of{" "}
                        <strong className="text-black font-black">
                            @{user?.username || "your account"}
                        </strong>
                        ? You can log back in at any time with your credentials.
                    </span>
                }
                confirmText={isLoggingOut ? "Signing out..." : "Log Out"}
                cancelText="Cancel"
                variant="danger"
            />
        </div>
    );
}
