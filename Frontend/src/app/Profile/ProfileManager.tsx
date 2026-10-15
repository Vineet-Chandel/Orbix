import React, { useState, useEffect, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector, updateUserProfile } from "../../store";
import { useToast } from "../../context/ToastContext";
import {
    PLATFORM_REGISTRY,
    TOTAL_SUPPORTED_PLATFORMS,
    type PlatformDefinition,
} from "../../utils/platformRegistry";
import { getPortalIcon } from "../../utils/portalIcons";
import {
    updateProfile,
    togglePlatformVisibility,
    disconnectPlatform,
    editPlatformHandle,
} from "../../utils/profileApi";
import { usePlatformSync } from "../../hooks/usePlatformSync";
import { judgePortalInput } from "../../utils/portalParser";
import type { PortalProfileData } from "../Dashboard/ConnectedPlatformsSection";
import { Sidebar } from "../Dashboard/Sidebar";

export default function ProfileManager() {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const toast = useToast();
    const { user } = useAppSelector((state) => state.user);
    const platformSync = usePlatformSync();

    // Local Profile Edit Form State
    const [firstName, setFirstName] = useState(user?.firstName || "");
    const [lastName, setLastName] = useState(user?.lastName || "");
    const [headline, setHeadline] = useState(user?.headline || "");
    const [bio, setBio] = useState(user?.bio || "");
    const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
    const [coverImageUrl, setCoverImageUrl] = useState(user?.coverImageUrl || "");
    const [website, setWebsite] = useState(user?.website || "");
    const [location, setLocation] = useState(user?.location || "");
    const [skills, setSkills] = useState<string[]>(user?.skills || []);
    const [newSkillInput, setNewSkillInput] = useState("");
    const [isPublic, setIsPublic] = useState(user?.isPublic !== false);
    const [savingProfile, setSavingProfile] = useState(false);

    // Platform category filter
    const [categoryFilter, setCategoryFilter] = useState<string>("All");

    // Connected Platforms from localStorage / sync
    const [connectedPortals, setConnectedPortals] = useState<Record<string, any>>(() => {
        try {
            const raw = localStorage.getItem("orbix_connected_portals");
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    });

    // Procedural Connect / Edit Platform Modal State
    const [activeConnectPlatform, setActiveConnectPlatform] = useState<PlatformDefinition | null>(null);
    const [inputHandleOrUrl, setInputHandleOrUrl] = useState("");
    const [isVerifyingPortal, setIsVerifyingPortal] = useState(false);
    const [verifiedPortalData, setVerifiedPortalData] = useState<PortalProfileData | null>(null);
    const [verifyPortalError, setVerifyPortalError] = useState<string | null>(null);
    const [isSavingVerifiedPortal, setIsSavingVerifiedPortal] = useState(false);

    const [disconnectingPortal, setDisconnectingPortal] = useState<string | null>(null);
    const [isDisconnecting, setIsDisconnecting] = useState(false);

    // Sync state listener
    useEffect(() => {
        const handleSync = () => {
            try {
                const raw = localStorage.getItem("orbix_connected_portals");
                setConnectedPortals(raw ? JSON.parse(raw) : {});
            } catch {
                setConnectedPortals({});
            }
        };

        window.addEventListener("orbix_portals_updated", handleSync);
        window.addEventListener("storage", handleSync);
        return () => {
            window.removeEventListener("orbix_portals_updated", handleSync);
            window.removeEventListener("storage", handleSync);
        };
    }, []);

    // Sync initial form values when user object loads
    useEffect(() => {
        if (user) {
            setFirstName(user.firstName || "");
            setLastName(user.lastName || "");
            setHeadline(user.headline || "");
            setBio(user.bio || "");
            setAvatarUrl(user.avatarUrl || "");
            setCoverImageUrl(user.coverImageUrl || "");
            setWebsite(user.website || "");
            setLocation(user.location || "");
            setSkills(Array.isArray(user.skills) ? user.skills : []);
            setIsPublic(user.isPublic !== false);
        }
    }, [user]);

    // Connected count derived from real data
    const connectedCount = useMemo(() => {
        return Object.keys(connectedPortals).length;
    }, [connectedPortals]);

    // Filtered platform definitions
    const filteredPlatforms = useMemo(() => {
        if (categoryFilter === "All") return PLATFORM_REGISTRY;
        return PLATFORM_REGISTRY.filter((p) => p.categoryGroup === categoryFilter);
    }, [categoryFilter]);

    // Handle profile save
    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setSavingProfile(true);

        try {
            const payload = {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                headline: headline.trim(),
                bio: bio.trim(),
                avatarUrl: avatarUrl.trim(),
                coverImageUrl: coverImageUrl.trim(),
                website: website.trim(),
                location: location.trim(),
                skills,
                isPublic,
            };

            const updated = await updateProfile(payload);
            dispatch(updateUserProfile(updated));
            toast.success("Your profile details have been saved successfully!", {
                title: "Profile Updated",
            });
        } catch (err: any) {
            toast.error(err.message || "Failed to update profile", {
                title: "Update Error",
            });
        } finally {
            setSavingProfile(false);
        }
    };

    // Add skill tag
    const handleAddSkill = (e?: React.KeyboardEvent | React.MouseEvent) => {
        if (e && "key" in e && e.key !== "Enter") return;
        if (e) e.preventDefault();

        const trimmed = newSkillInput.trim();
        if (trimmed && !skills.includes(trimmed)) {
            setSkills([...skills, trimmed]);
            setNewSkillInput("");
        }
    };

    const handleRemoveSkill = (skillToRemove: string) => {
        setSkills(skills.filter((s) => s !== skillToRemove));
    };

    // Toggle platform visibility
    const handleToggleVisibility = async (portalId: string, currentPublic: boolean) => {
        const nextState = !currentPublic;
        try {
            await togglePlatformVisibility(portalId, nextState);

            // Update local state
            const updated = {
                ...connectedPortals,
                [portalId]: {
                    ...connectedPortals[portalId],
                    isPublic: nextState,
                },
            };
            setConnectedPortals(updated);
            localStorage.setItem("orbix_connected_portals", JSON.stringify(updated));
            window.dispatchEvent(new Event("orbix_portals_updated"));

            toast.success(
                `${portalId.toUpperCase()} is now ${nextState ? "visible" : "hidden"} on your public profile.`,
                { title: "Visibility Updated" }
            );
        } catch (err: any) {
            toast.error(err.message || "Failed to update visibility", { title: "Error" });
        }
    };

    // Live Debounced Procedural Verification Effect
    useEffect(() => {
        if (!activeConnectPlatform) {
            setVerifiedPortalData(null);
            setVerifyPortalError(null);
            setIsVerifyingPortal(false);
            return;
        }

        const trimmed = inputHandleOrUrl.trim();
        if (!trimmed) {
            setVerifiedPortalData(null);
            setVerifyPortalError(null);
            setIsVerifyingPortal(false);
            return;
        }

        const judgment = judgePortalInput(activeConnectPlatform.id, trimmed);
        if (!judgment.isValid || !judgment.username) {
            setVerifiedPortalData(null);
            setVerifyPortalError(judgment.message || "Invalid handle or link format.");
            setIsVerifyingPortal(false);
            return;
        }

        const username = judgment.username;
        const portalId = activeConnectPlatform.id;

        let isMounted = true;
        const controller = new AbortController();

        setIsVerifyingPortal(true);
        setVerifyPortalError(null);

        const timer = setTimeout(async () => {
            const endpoints = [
                `/api/portals/fetch?portal=${encodeURIComponent(portalId)}&username=${encodeURIComponent(username)}`,
                `http://localhost:3000/api/portals/fetch?portal=${encodeURIComponent(portalId)}&username=${encodeURIComponent(username)}`,
            ];

            let data: PortalProfileData | null = null;
            let errorMessage: string | null = null;

            for (const url of endpoints) {
                try {
                    const res = await fetch(url, { signal: controller.signal });
                    if (res.ok) {
                        const json = await res.json();
                        if (json && json.success) {
                            data = json;
                            break;
                        }
                    } else if (res.status === 404) {
                        const errJson = await res.json().catch(() => ({}));
                        errorMessage = errJson.message || `Account '@${username}' not found on ${activeConnectPlatform.name}.`;
                        break;
                    }
                } catch {
                    // Try next endpoint
                }
            }

            if (!isMounted) return;

            setIsVerifyingPortal(false);
            if (data && data.success) {
                setVerifiedPortalData(data);
                setVerifyPortalError(null);
            } else {
                setVerifiedPortalData(null);
                setVerifyPortalError(errorMessage || `Account '@${username}' not found on ${activeConnectPlatform.name}.`);
            }
        }, 400);

        return () => {
            isMounted = false;
            clearTimeout(timer);
            controller.abort();
        };
    }, [activeConnectPlatform, inputHandleOrUrl]);

    // Open Procedural Connect Modal helper
    const handleOpenConnectModal = (platform: PlatformDefinition, existingHandle?: string) => {
        setActiveConnectPlatform(platform);
        setInputHandleOrUrl(existingHandle || "");
        setVerifiedPortalData(null);
        setVerifyPortalError(null);
        setIsVerifyingPortal(false);
    };

    // Confirm Verified Connection
    const handleConfirmVerifiedConnect = async () => {
        if (!activeConnectPlatform || !verifiedPortalData) return;
        setIsSavingVerifiedPortal(true);

        const portal = activeConnectPlatform.id;
        const targetHandle = verifiedPortalData.username;

        try {
            await editPlatformHandle(portal, targetHandle);

            const updated = {
                ...connectedPortals,
                [portal]: {
                    portal,
                    username: targetHandle,
                    url: verifiedPortalData.profileUrl || activeConnectPlatform.buildUrl(targetHandle),
                    verified: true,
                    isPublic: true,
                    displayName: verifiedPortalData.name,
                    avatar: verifiedPortalData.avatar,
                    stats: verifiedPortalData.stats || [],
                    lastSyncStatus: "valid",
                    lastSyncAt: new Date().toISOString(),
                },
            };

            setConnectedPortals(updated);
            localStorage.setItem("orbix_connected_portals", JSON.stringify(updated));

            // Also synchronize orbix_portals format for backwards compatibility
            try {
                const rawPortals: Record<string, any> = {};
                for (const [id, prof] of Object.entries(updated)) {
                    rawPortals[id] = {
                        raw: prof.username,
                        username: prof.username,
                        url: prof.url,
                    };
                }
                localStorage.setItem("orbix_portals", JSON.stringify(rawPortals));
            } catch {
                // ignore
            }

            window.dispatchEvent(new Event("orbix_portals_updated"));
            window.dispatchEvent(new Event("storage"));

            toast.success(`Successfully connected ${activeConnectPlatform.name} account (@${targetHandle})!`, {
                title: "Platform Linked",
            });

            setActiveConnectPlatform(null);
            setInputHandleOrUrl("");
            setVerifiedPortalData(null);
            setVerifyPortalError(null);
        } catch (err: any) {
            toast.error(err.message || "Failed to link platform", { title: "Error" });
        } finally {
            setIsSavingVerifiedPortal(false);
        }
    };

    // Disconnect platform
    const handleConfirmDisconnect = async () => {
        if (!disconnectingPortal) return;
        setIsDisconnecting(true);

        try {
            await disconnectPlatform(disconnectingPortal);

            const updated = { ...connectedPortals };
            delete updated[disconnectingPortal];
            setConnectedPortals(updated);
            localStorage.setItem("orbix_connected_portals", JSON.stringify(updated));
            window.dispatchEvent(new Event("orbix_portals_updated"));

            toast.success(`Disconnected ${disconnectingPortal} from your account.`, {
                title: "Platform Disconnected",
            });
            setDisconnectingPortal(null);
        } catch (err: any) {
            toast.error(err.message || "Failed to disconnect", { title: "Error" });
        } finally {
            setIsDisconnecting(false);
        }
    };

    // Copy public profile link
    const handleCopyProfileLink = () => {
        const publicUrl = `${window.location.origin}/profile/${encodeURIComponent(user?.username || "")}`;
        navigator.clipboard.writeText(publicUrl).then(
            () => toast.success("Public profile link copied to clipboard!", { title: "Link Copied" }),
            () => toast.error("Could not copy link to clipboard.", { title: "Copy Failed" })
        );
    };

    // Native Web Share API
    const handleShareProfile = async () => {
        const publicUrl = `${window.location.origin}/profile/${encodeURIComponent(user?.username || "")}`;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: `${firstName} ${lastName} (@${user?.username}) — Orbix Profile`,
                    text: headline || "Check out my developer and competitive programming profiles on Orbix!",
                    url: publicUrl,
                });
            } catch {
                // user dismissed share dialog
            }
        } else {
            handleCopyProfileLink();
        }
    };

    const publicUrl = `/profile/${encodeURIComponent(user?.username || "")}`;

    return (
        <div className="min-h-screen bg-[#F0F2F6] text-neutral-900 font-sans flex antialiased selection:bg-neutral-900 selection:text-white">
            {/* Desktop & Mobile Floating Sidebar */}
            <Sidebar
                activeTab="profile"
                onTabChange={(tab) => {
                    if (tab === "dashboard") navigate("/dashboard");
                    if (tab === "profile") navigate("/profile");
                    if (tab === "connect-platform") navigate("/onboarding");
                    if (tab === "resume") navigate("/resume");
                    if (tab === "projects") navigate("/projects");
                }}
            />

            {/* Main Content Area */}
            <main className="flex-1 min-w-0 flex flex-col min-h-screen p-3 sm:p-5 lg:pl-0">
                {/* Header Navbar */}
                <header className="w-full rounded-2xl bg-white border border-neutral-200/90 shadow-xs px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 flex-shrink-0">
                    <div>
                        <div className="flex items-center gap-2 text-xs font-semibold text-neutral-400 mb-1">
                            <Link to="/dashboard" className="hover:text-neutral-700 transition-colors">
                                Dashboard
                            </Link>
                            <span>/</span>
                            <span className="text-neutral-800">Profile Manager</span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-black text-neutral-900 tracking-tight flex items-center gap-2.5">
                            <span>My Developer Profile</span>
                            <span
                                className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider ${
                                    isPublic
                                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200/70"
                                        : "bg-neutral-100 text-neutral-600 border border-neutral-200"
                                }`}
                            >
                                {isPublic ? "Public Showcase" : "Private"}
                            </span>
                        </h1>
                    </div>

                    {/* Quick Profile Link & Share Controls */}
                    <div className="flex items-center gap-2.5 flex-wrap">
                        <Link
                            to={publicUrl}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition-all cursor-pointer"
                            title="Preview your public profile"
                        >
                            <svg className="w-4 h-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            <span>Preview Showcase</span>
                        </Link>

                        <button
                            type="button"
                            onClick={handleCopyProfileLink}
                            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-800 text-xs font-bold transition-all shadow-2xs cursor-pointer"
                        >
                            <svg className="w-4 h-4 text-neutral-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                            </svg>
                            <span>Copy Link</span>
                        </button>

                        <button
                            type="button"
                            onClick={handleShareProfile}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-sm cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
                        >
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                            </svg>
                            <span>Share Profile</span>
                        </button>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                    {/* Column 1 & 2: Edit Profile Information Form */}
                    <div className="lg:col-span-1 space-y-5">
                        {/* Profile Info Card */}
                        <div className="rounded-2xl bg-white border border-neutral-200/90 shadow-xs p-5">
                            <h2 className="text-base font-bold text-neutral-900 mb-4 pb-2 border-b border-neutral-100 flex items-center justify-between">
                                <span>Personal Details</span>
                                <span className="text-xs font-mono font-medium text-neutral-400">@{user?.username}</span>
                            </h2>

                            <form onSubmit={handleSaveProfile} className="space-y-4">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-700 mb-1">First Name</label>
                                        <input
                                            type="text"
                                            value={firstName}
                                            onChange={(e) => setFirstName(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all"
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-700 mb-1">Last Name</label>
                                        <input
                                            type="text"
                                            value={lastName}
                                            onChange={(e) => setLastName(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-neutral-700 mb-1">Headline</label>
                                    <input
                                        type="text"
                                        placeholder="e.g. Senior Full-Stack Engineer & Competitive Programmer"
                                        value={headline}
                                        maxLength={255}
                                        onChange={(e) => setHeadline(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all"
                                    />
                                    <span className="text-[10px] text-neutral-400 flex justify-end mt-0.5">{headline.length}/255</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-neutral-700 mb-1">Biography</label>
                                    <textarea
                                        rows={3}
                                        placeholder="Write a brief intro about yourself, your tech stack, and what you're passionate about..."
                                        value={bio}
                                        maxLength={2000}
                                        onChange={(e) => setBio(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all resize-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-700 mb-1">Location</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. San Francisco, CA"
                                            value={location}
                                            onChange={(e) => setLocation(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-bold text-neutral-700 mb-1">Portfolio / Website</label>
                                        <input
                                            type="url"
                                            placeholder="https://yourportfolio.dev"
                                            value={website}
                                            onChange={(e) => setWebsite(e.target.value)}
                                            className="w-full px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-neutral-700 mb-1">Avatar Image URL</label>
                                    <input
                                        type="url"
                                        placeholder="https://..."
                                        value={avatarUrl}
                                        onChange={(e) => setAvatarUrl(e.target.value)}
                                        className="w-full px-3 py-2 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all"
                                    />
                                </div>

                                {/* Skills Tags */}
                                <div>
                                    <label className="block text-xs font-bold text-neutral-700 mb-1">Skills & Technologies</label>
                                    <div className="flex gap-2 mb-2">
                                        <input
                                            type="text"
                                            placeholder="Type skill & press Enter"
                                            value={newSkillInput}
                                            onChange={(e) => setNewSkillInput(e.target.value)}
                                            onKeyDown={handleAddSkill}
                                            className="flex-1 px-3 py-1.5 rounded-xl bg-neutral-50 border border-neutral-200 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all"
                                        />
                                        <button
                                            type="button"
                                            onClick={handleAddSkill}
                                            className="px-3 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-xs font-bold text-neutral-800 transition-colors"
                                        >
                                            Add
                                        </button>
                                    </div>

                                    <div className="flex flex-wrap gap-1.5 min-h-[32px]">
                                        {skills.map((skill) => (
                                            <span
                                                key={skill}
                                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-100 border border-neutral-200 text-neutral-800 text-[11px] font-semibold"
                                            >
                                                <span>{skill}</span>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveSkill(skill)}
                                                    className="text-neutral-400 hover:text-rose-500 transition-colors cursor-pointer"
                                                >
                                                    &times;
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                {/* Profile Public Visibility Switch */}
                                <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
                                    <div>
                                        <p className="text-xs font-bold text-neutral-900">Public Profile</p>
                                        <p className="text-[11px] text-neutral-500">Allow public visitors to see your showcase page</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setIsPublic(!isPublic)}
                                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                                            isPublic ? "bg-black" : "bg-neutral-300"
                                        }`}
                                    >
                                        <span
                                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                                isPublic ? "translate-x-6" : "translate-x-1"
                                            }`}
                                        />
                                    </button>
                                </div>

                                {/* Save Button */}
                                <div className="pt-3">
                                    <button
                                        type="submit"
                                        disabled={savingProfile}
                                        className="w-full h-11 flex items-center justify-center rounded-full bg-black text-white text-xs font-bold hover:bg-neutral-800 transition-all cursor-pointer shadow-sm hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50"
                                    >
                                        {savingProfile ? (
                                            <div className="flex items-center gap-2">
                                                <svg className="h-4 w-4 animate-spin text-white" fill="none" viewBox="0 0 24 24">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                                </svg>
                                                <span>Saving Changes...</span>
                                            </div>
                                        ) : (
                                            <span>Save Profile Details</span>
                                        )}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>

                    {/* Column 2 & 3: The 16-Platform Catalogue Management */}
                    <div className="lg:col-span-2 space-y-5">
                        <div className="rounded-2xl bg-white border border-neutral-200/90 shadow-xs p-5">
                            {/* Platforms Header Controls */}
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-neutral-100">
                                <div>
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-lg font-black text-neutral-900 tracking-tight">Platforms</h2>
                                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-neutral-900 text-white">
                                            {connectedCount} of {TOTAL_SUPPORTED_PLATFORMS} connected
                                        </span>
                                    </div>
                                    <p className="text-xs text-neutral-500 mt-0.5">
                                        Connect your developer and competitive programming profiles.
                                    </p>
                                </div>

                                {/* Re-sync Button */}
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => platformSync.resyncAll({ force: true })}
                                        disabled={platformSync.isSyncing}
                                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-2xs"
                                        title="Re-verify handles and refresh platform stats"
                                    >
                                        <svg
                                            className={`w-3.5 h-3.5 ${platformSync.isSyncing ? "animate-spin text-neutral-900" : "text-neutral-600"}`}
                                            fill="none"
                                            viewBox="0 0 24 24"
                                            stroke="currentColor"
                                            strokeWidth="2.5"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                                        </svg>
                                        <span>{platformSync.isSyncing ? "Re-syncing..." : "Re-sync"}</span>
                                    </button>
                                </div>
                            </div>

                            {/* Category Filter Pills */}
                            <div className="flex items-center gap-2 py-3 overflow-x-auto no-scrollbar border-b border-neutral-100">
                                {["All", "Competitive Programming", "Coding Practice", "Portfolio & Publishing"].map((cat) => (
                                    <button
                                        key={cat}
                                        type="button"
                                        onClick={() => setCategoryFilter(cat)}
                                        className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors whitespace-nowrap cursor-pointer ${
                                            categoryFilter === cat
                                                ? "bg-neutral-900 text-white"
                                                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 hover:text-neutral-900"
                                        }`}
                                    >
                                        {cat}
                                    </button>
                                ))}
                            </div>

                            {/* Platform Cards Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-4">
                                {filteredPlatforms.map((def) => {
                                    const connection = connectedPortals[def.id];
                                    const isConnected = !!connection;
                                    const isPublicVisibility = connection?.isPublic !== false;
                                    const handle = connection?.username || connection?.portal_username || "";
                                    const profileUrl = connection?.url || connection?.link || def.buildUrl(handle);
                                    const isBroken = connection?.verified === false || connection?.lastSyncStatus === "broken";

                                    return (
                                        <div
                                            key={def.id}
                                            className={`rounded-2xl border transition-all p-4 flex flex-col justify-between ${
                                                isConnected
                                                    ? isBroken
                                                        ? "border-rose-200 bg-rose-50/20"
                                                        : "border-neutral-200/90 bg-white hover:border-neutral-300"
                                                    : "border-neutral-200/60 bg-neutral-50/50 hover:bg-neutral-50"
                                            }`}
                                        >
                                            {/* Top row: Icon, Name, Category */}
                                            <div className="flex items-start justify-between gap-3">
                                                <div className="flex items-center gap-3 min-w-0">
                                                    <div className="w-10 h-10 rounded-xl bg-white border border-neutral-200/80 flex items-center justify-center flex-shrink-0 shadow-2xs">
                                                        {getPortalIcon(def.id, "w-5 h-5")}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <h3 className="text-sm font-extrabold text-neutral-900 truncate">
                                                                {def.name}
                                                            </h3>
                                                            {isConnected && (
                                                                <span
                                                                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                                                        isBroken ? "bg-rose-500 animate-pulse" : "bg-emerald-500"
                                                                    }`}
                                                                />
                                                            )}
                                                        </div>
                                                        <span className="text-[10px] text-neutral-400 font-medium block truncate">
                                                            {def.category}
                                                        </span>
                                                    </div>
                                                </div>

                                                {/* Connection Status Badge */}
                                                <div>
                                                    {isConnected ? (
                                                        <span
                                                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                                isBroken
                                                                    ? "bg-rose-100 text-rose-700 border border-rose-200"
                                                                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                                            }`}
                                                        >
                                                            {isBroken ? "Needs Attention" : "Connected"}
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] font-bold text-neutral-400">
                                                            Not connected
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Middle row: Handle / Stats if connected */}
                                            {isConnected && (
                                                <div className="my-3 pt-2.5 border-t border-neutral-100">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <a
                                                            href={profileUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs font-mono font-bold text-neutral-900 hover:text-indigo-600 truncate flex items-center gap-1 group"
                                                            title={`Open ${def.name} profile in new tab`}
                                                        >
                                                            <span>@{handle}</span>
                                                            <svg className="w-3 h-3 text-neutral-400 group-hover:text-indigo-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                                                <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                                                            </svg>
                                                        </a>

                                                        {/* Public / Hidden Toggle Icon */}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleToggleVisibility(def.id, isPublicVisibility)}
                                                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold transition-colors cursor-pointer ${
                                                                isPublicVisibility
                                                                    ? "bg-neutral-100 text-neutral-700 hover:bg-neutral-200"
                                                                    : "bg-amber-50 text-amber-700 border border-amber-200 hover:bg-amber-100"
                                                            }`}
                                                            title={isPublicVisibility ? "Visible on public profile" : "Hidden from public profile"}
                                                        >
                                                            {isPublicVisibility ? "Public 👁️" : "Hidden 🔒"}
                                                        </button>
                                                    </div>

                                                    {/* Stats preview if available */}
                                                    {Array.isArray(connection.stats) && connection.stats.length > 0 && (
                                                        <div className="flex flex-wrap gap-1.5 mt-2">
                                                            {connection.stats.slice(0, 2).map((st: any, idx: number) => (
                                                                <span
                                                                    key={idx}
                                                                    className="text-[10px] font-medium px-2 py-0.5 rounded-md bg-neutral-100 text-neutral-600"
                                                                >
                                                                    {st.value || st.label}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            )}

                                            {/* Bottom row: Action Buttons */}
                                            <div className="pt-2 flex items-center justify-end gap-2">
                                                {isConnected ? (
                                                    <>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleOpenConnectModal(def, handle)}
                                                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-neutral-600 hover:text-neutral-950 hover:bg-neutral-100 transition-colors cursor-pointer"
                                                        >
                                                            Edit
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setDisconnectingPortal(def.id)}
                                                            className="px-2.5 py-1 rounded-lg text-xs font-semibold text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                                                        >
                                                            Disconnect
                                                        </button>
                                                    </>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenConnectModal(def, "")}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black hover:bg-neutral-800 text-white text-xs font-bold transition-all shadow-2xs hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
                                                    >
                                                        <span>+ Connect</span>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Procedural Connect / Edit Platform Verification Modal */}
            {activeConnectPlatform && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        onClick={() => {
                            if (!isSavingVerifiedPortal) setActiveConnectPlatform(null);
                        }}
                        className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-fadeIn"
                    />

                    <div className="relative z-10 w-full max-w-lg rounded-2xl bg-white border border-neutral-200 shadow-2xl p-5 sm:p-6 animate-scaleUp">
                        {/* Header */}
                        <div className="flex items-center justify-between pb-3.5 border-b border-neutral-100">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-center p-2 shadow-2xs">
                                    {getPortalIcon(activeConnectPlatform.id, "w-6 h-6")}
                                </div>
                                <div>
                                    <h3 className="text-base font-extrabold text-neutral-900 leading-tight">
                                        {connectedPortals[activeConnectPlatform.id] ? "Update" : "Connect"} {activeConnectPlatform.name}
                                    </h3>
                                    <p className="text-xs text-neutral-500">
                                        {activeConnectPlatform.category}
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                disabled={isSavingVerifiedPortal}
                                onClick={() => setActiveConnectPlatform(null)}
                                className="w-8 h-8 rounded-full hover:bg-neutral-100 text-neutral-400 hover:text-neutral-700 flex items-center justify-center transition-colors cursor-pointer"
                            >
                                ✕
                            </button>
                        </div>

                        {/* Input & Procedural Verification Section */}
                        <div className="space-y-3.5 pt-4">
                            <div className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="block text-xs font-bold text-neutral-700">
                                        Account Username or Profile URL
                                    </label>
                                    {/* Real-time input detection badge */}
                                    {(() => {
                                        if (!inputHandleOrUrl.trim()) return null;
                                        const judgment = judgePortalInput(activeConnectPlatform.id, inputHandleOrUrl);
                                        if (judgment.badgeVariant === "username") {
                                            return (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                                                    ✓ Username detected
                                                </span>
                                            );
                                        }
                                        if (judgment.badgeVariant === "link") {
                                            return (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full border border-sky-200">
                                                    ✓ Full Link detected
                                                </span>
                                            );
                                        }
                                        if (judgment.badgeVariant === "error") {
                                            return (
                                                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                                                    ⚠️ {judgment.badgeLabel}
                                                </span>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>

                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder={activeConnectPlatform.placeholder}
                                        value={inputHandleOrUrl}
                                        onChange={(e) => setInputHandleOrUrl(e.target.value)}
                                        className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-50 border border-neutral-300 text-xs font-medium text-neutral-900 focus:bg-white focus:border-neutral-900 focus:outline-hidden transition-all pr-8"
                                        autoFocus
                                    />
                                    {inputHandleOrUrl && (
                                        <button
                                            type="button"
                                            onClick={() => setInputHandleOrUrl("")}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700 text-xs p-1 cursor-pointer"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                <p className="text-[11px] text-neutral-400">
                                    Paste your {activeConnectPlatform.name} profile link or enter your account handle directly.
                                </p>
                            </div>

                            {/* Verification In-Progress Skeleton */}
                            {isVerifyingPortal && (
                                <div className="rounded-2xl border border-neutral-200 bg-neutral-50/80 p-3.5 animate-pulse flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-11 h-11 rounded-full bg-neutral-200" />
                                        <div className="space-y-1.5">
                                            <div className="w-28 h-3 bg-neutral-200 rounded" />
                                            <div className="w-16 h-2.5 bg-neutral-200 rounded" />
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-neutral-500 font-semibold">
                                        <span className="w-3.5 h-3.5 border-2 border-neutral-400 border-t-neutral-800 rounded-full animate-spin" />
                                        <span>Verifying account...</span>
                                    </div>
                                </div>
                            )}

                            {/* Error Banner when Account Not Found — Connect button is completely hidden! */}
                            {verifyPortalError && !isVerifyingPortal && (
                                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200/90 text-xs font-semibold text-rose-700 flex items-start gap-2.5 animate-fadeIn">
                                    <span className="text-sm flex-shrink-0">⚠️</span>
                                    <div className="flex-1">
                                        <p>{verifyPortalError}</p>
                                        <p className="text-[11px] font-normal text-rose-600/80 mt-0.5">
                                            Make sure the username exists publicly on {activeConnectPlatform.name}.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Interactive Verified Preview Card — Appears ONLY when verified! */}
                            {verifiedPortalData && !isVerifyingPortal && (
                                <div className="rounded-2xl border border-neutral-800 bg-[#0b0f19] p-4 text-white shadow-xl animate-fadeIn">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                                        {/* Left: Avatar with Brand ring & Portal badge + User info + Stats */}
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="relative flex-shrink-0">
                                                <img
                                                    src={verifiedPortalData.avatar}
                                                    alt={verifiedPortalData.name}
                                                    referrerPolicy="no-referrer"
                                                    className="h-12 w-12 rounded-full object-cover border-2 p-0.5 bg-neutral-900 shadow-md"
                                                    style={{ borderColor: activeConnectPlatform.brandColor }}
                                                    onError={(e) => {
                                                        (e.target as HTMLImageElement).src = `https://ui-avatars.com/api/?name=${encodeURIComponent(
                                                            verifiedPortalData.name || verifiedPortalData.username
                                                        )}&background=${activeConnectPlatform.brandColor.replace("#", "")}&color=fff&size=128&bold=true`;
                                                    }}
                                                />
                                                <div className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-white p-0.5 shadow-md">
                                                    {getPortalIcon(activeConnectPlatform.id, "h-3.5 w-3.5")}
                                                </div>
                                            </div>

                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h4 className="truncate text-sm sm:text-base font-bold text-white tracking-tight">
                                                        {verifiedPortalData.name}
                                                    </h4>
                                                    <span className="text-xs font-mono text-neutral-400 truncate">
                                                        @{verifiedPortalData.username}
                                                    </span>
                                                </div>

                                                {/* Stats tags row */}
                                                {verifiedPortalData.stats && verifiedPortalData.stats.length > 0 && (
                                                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                                        {verifiedPortalData.stats.map((st, idx) => (
                                                            <span
                                                                key={idx}
                                                                className="inline-flex items-center rounded-md bg-neutral-800/90 px-2 py-0.5 text-[10px] sm:text-xs font-medium text-neutral-200 border border-neutral-700/60 shadow-2xs"
                                                            >
                                                                {st.value}
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Right: Confirmation prompt + Yes, connect button */}
                                        <div className="flex items-center justify-end gap-2.5 flex-shrink-0 pt-2 sm:pt-0 border-t border-neutral-800/80 sm:border-t-0">
                                            <span className="text-xs font-medium text-neutral-400 hidden sm:inline-block">
                                                Is this you?
                                            </span>
                                            <button
                                                type="button"
                                                onClick={handleConfirmVerifiedConnect}
                                                disabled={isSavingVerifiedPortal}
                                                className="flex items-center gap-1.5 rounded-full px-4 sm:px-5 py-2 text-xs sm:text-sm font-bold text-white shadow-md transition-all hover:scale-105 active:scale-95 cursor-pointer disabled:opacity-50"
                                                style={{ backgroundColor: activeConnectPlatform.brandColor }}
                                            >
                                                {isSavingVerifiedPortal ? (
                                                    <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                ) : (
                                                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                                        <polyline points="20 6 9 17 4 12" />
                                                    </svg>
                                                )}
                                                <span>{isSavingVerifiedPortal ? "Connecting..." : "Yes, connect"}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer Actions */}
                        <div className="flex items-center justify-end gap-2 pt-4 mt-4 border-t border-neutral-100">
                            <button
                                type="button"
                                disabled={isSavingVerifiedPortal}
                                onClick={() => setActiveConnectPlatform(null)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Disconnect Confirmation Modal */}
            {disconnectingPortal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div
                        onClick={() => setDisconnectingPortal(null)}
                        className="fixed inset-0 bg-black/60 backdrop-blur-xs animate-fadeIn"
                    />

                    <div className="relative z-10 w-full max-w-sm rounded-2xl bg-white border border-neutral-200 shadow-2xl p-6 text-center animate-scaleUp">
                        <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center mb-3">
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                        </div>
                        <h3 className="text-base font-extrabold text-neutral-900 mb-1">
                            Disconnect {disconnectingPortal.toUpperCase()}?
                        </h3>
                        <p className="text-xs text-neutral-500 mb-5">
                            This will remove the connected link and stats from your public profile and dashboard.
                        </p>

                        <div className="flex items-center justify-center gap-2">
                            <button
                                type="button"
                                onClick={() => setDisconnectingPortal(null)}
                                className="px-4 py-2 rounded-xl text-xs font-semibold text-neutral-600 hover:bg-neutral-100 transition-colors cursor-pointer"
                            >
                                Keep Connected
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDisconnect}
                                disabled={isDisconnecting}
                                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                            >
                                {isDisconnecting ? "Disconnecting..." : "Yes, Disconnect"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
