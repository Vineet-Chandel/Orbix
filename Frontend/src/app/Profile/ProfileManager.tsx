import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Briefcase, Mail, Trash2, Plus, FileText, Globe, Lock } from "lucide-react";
import { useAppDispatch, useAppSelector, updateUserProfile } from "../../store";
import { useToast } from "../../context/ToastContext";
import { updateProfile, getInstitutionById, updateResumeVisibility, type InstitutionItem } from "../../utils/profileApi";
import { CollegeAutocomplete } from "../../components/CollegeAutocomplete";
import { CollegeChangeWarningModal } from "../../components/CollegeChangeWarningModal";
import { usePlatformSync } from "../../hooks/usePlatformSync";
import { Sidebar } from "../Dashboard/Sidebar";
import { ProfilePhotoFrame } from "./ProfilePhotoFrame";
import { ConnectedPlatformsSection } from "../Dashboard/ConnectedPlatformsSection";
import { ProfileCardStudio } from "./CardStudio/ProfileCardStudio";
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";
import { NeoToggle } from "../../components/NeoToggle";
import {
    detectPlatform,
    getPlatformIcon,
    sanitizePlatformUrl,
    PLATFORM_REGISTRY,
} from "../../utils/platformLinks";

interface LinkRow {
    id: string;
    label: string;
    url: string;
    platform?: string;
}

function parseInitialLinks(usr: any): LinkRow[] {
    let rawLinks = usr?.links;
    if (typeof rawLinks === "string") {
        try {
            rawLinks = JSON.parse(rawLinks);
        } catch {
            rawLinks = [];
        }
    }
    if (Array.isArray(rawLinks)) {
        return rawLinks.slice(0, 4).map((l: any, i: number) => ({
            id: l.id || `link-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 6)}`,
            label: l.label || l.platform || "Link",
            url: l.url || "",
            platform: l.platform || detectPlatform(l.url || l.label)?.id,
        }));
    }
    const legacy: LinkRow[] = [];
    if (usr?.linkedin) {
        legacy.push({
            id: "init-linkedin",
            label: "LinkedIn",
            url: usr.linkedin,
            platform: "linkedin",
        });
    }
    if (usr?.github) {
        legacy.push({
            id: "init-github",
            label: "GitHub",
            url: usr.github,
            platform: "github",
        });
    }
    if (usr?.website) {
        legacy.push({
            id: "init-website",
            label: "Portfolio",
            url: usr.website,
            platform: detectPlatform(usr.website)?.id,
        });
    }
    if (usr?.customLink) {
        legacy.push({
            id: "init-custom",
            label: "Link",
            url: usr.customLink,
            platform: detectPlatform(usr.customLink)?.id,
        });
    }
    return legacy.slice(0, 4);
}

export default function ProfileManager() {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const toast = useToast();
    const { user } = useAppSelector((state) => state.user);
    const platformSync = usePlatformSync();

    // Profile Edit Form State
    const [firstName, setFirstName] = useState(user?.firstName || "");
    const [lastName, setLastName] = useState(user?.lastName || "");
    const [headline, setHeadline] = useState(user?.headline || "");
    const [bio, setBio] = useState(user?.bio || "");
    const [location, setLocation] = useState(user?.location || "");
    const [skills, setSkills] = useState<string[]>(user?.skills || []);
    const [links, setLinks] = useState<LinkRow[]>(() => parseInitialLinks(user));
    const [newSkillInput, setNewSkillInput] = useState("");
    const [isOpenToWork, setIsOpenToWork] = useState(Boolean(user?.isOpenToWork));
    const [isHireable, setIsHireable] = useState(Boolean(user?.isHireable));
    const [selectedCollege, setSelectedCollege] = useState<InstitutionItem | null>(user?.college || null);
    const [savingProfile, setSavingProfile] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isCollegeConfirmModalOpen, setIsCollegeConfirmModalOpen] = useState(false);
    const [hasConfirmedCollegeSave, setHasConfirmedCollegeSave] = useState(false);

    // Connected Platforms from localStorage / sync
    const [connectedPortals, setConnectedPortals] = useState<Record<string, any>>(() => {
        try {
            const raw = localStorage.getItem("orbix_connected_portals");
            return raw ? JSON.parse(raw) : {};
        } catch {
            return {};
        }
    });

    // Listen for portal changes across tabs / storage
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

    // Sync connectedPortals from user.platforms when available
    useEffect(() => {
        if (user?.platforms && Array.isArray(user.platforms) && user.platforms.length > 0) {
            setConnectedPortals((prev) => {
                const next = { ...prev };
                let hasChanges = false;
                for (const p of user.platforms!) {
                    const k = (p.portal || "").toLowerCase().trim();
                    if (!k) continue;
                    const handle = (p.portalUsername || p.portal_username || p.username || "").trim();
                    if (!next[k] || !next[k].username || next[k].username !== handle) {
                        next[k] = {
                            portal: k,
                            username: handle,
                            profileUrl: p.link || p.profileUrl || "",
                            verified: p.verified !== false,
                            displayName: p.displayName || p.display_name || handle,
                            avatarUrl: p.avatarUrl || p.avatar_url,
                            stats: p.stats,
                            syncStatus: p.lastSyncStatus || p.syncStatus || "valid",
                            lastSyncAt: p.lastSyncAt || p.last_sync_at,
                        };
                        hasChanges = true;
                    }
                }
                if (hasChanges) {
                    try {
                        localStorage.setItem("orbix_connected_portals", JSON.stringify(next));
                    } catch {}
                    return next;
                }
                return prev;
            });
        }
    }, [user?.platforms]);

    // Track whether form has initialized from user state to prevent clobbering edits on background updates
    const hasInitializedRef = useRef(false);

    // Sync initial form values when user object loads
    useEffect(() => {
        if (user && !hasInitializedRef.current) {
            hasInitializedRef.current = true;
            setFirstName(user.firstName || "");
            setLastName(user.lastName || "");
            setHeadline(user.headline || "");
            setBio(user.bio || "");
            setLocation(user.location || "");
            setSkills(Array.isArray(user.skills) ? user.skills : []);
            setLinks(parseInitialLinks(user));
            setIsOpenToWork(Boolean(user.isOpenToWork));
            setIsHireable(Boolean(user.isHireable));
            if (user.college) {
                setSelectedCollege(user.college);
            } else if (user.collegeId) {
                getInstitutionById(user.collegeId).then((inst) => {
                    if (inst) setSelectedCollege(inst);
                });
            } else {
                setSelectedCollege(null);
            }
        }
    }, [user]);

    // Live sync when resume-to-profile sync occurs
    useEffect(() => {
        const handleProfileSync = (event: Event) => {
            const detail = (event as CustomEvent)?.detail;
            if (detail) {
                if (Array.isArray(detail.skills) && detail.skills.length > 0) {
                    setSkills(detail.skills);
                }
                if (detail.headline) setHeadline(detail.headline);
                if (detail.bio) setBio(detail.bio);
                if (detail.location) setLocation(detail.location);
                if (detail.links) setLinks(parseInitialLinks(detail));
                if (detail.college) {
                    setSelectedCollege(detail.college);
                } else if (detail.collegeId) {
                    getInstitutionById(detail.collegeId).then((inst) => {
                        if (inst) setSelectedCollege(inst);
                    });
                }
            }
        };

        window.addEventListener("orbix_profile_updated", handleProfileSync);
        return () => window.removeEventListener("orbix_profile_updated", handleProfileSync);
    }, []);

    // Pending toggle queue to batch & sequence concurrent or rapid toggle clicks
    const pendingTogglesRef = useRef<{ isOpenToWork?: boolean; isHireable?: boolean }>({});
    const isFlushingTogglesRef = useRef(false);

    // Synchronize toggles from external user updates only when no toggle flush is in-flight or pending
    useEffect(() => {
        if (user && hasInitializedRef.current && !isFlushingTogglesRef.current && Object.keys(pendingTogglesRef.current).length === 0) {
            setIsOpenToWork(Boolean(user.isOpenToWork));
            setIsHireable(Boolean(user.isHireable));
        }
    }, [user?.isOpenToWork, user?.isHireable]);

    // Dynamic Links handlers
    const handleAddLink = () => {
        if (links.length >= 4) {
            toast.info("Maximum of 4 links allowed");
            return;
        }
        setLinks([
            ...links,
            {
                id: `link-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                label: "",
                url: "",
            },
        ]);
    };

    const handleRemoveLink = (index: number) => {
        setLinks(links.filter((_, i) => i !== index));
    };

    const handleLinkChange = (index: number, field: "label" | "url", value: string) => {
        setLinks((prev) => {
            const next = [...prev];
            const row = { ...next[index] };

            if (field === "url") {
                row.url = value;
                const detected = detectPlatform(value);
                if (detected) {
                    row.platform = detected.id;
                    if (!row.label || row.label === "Link" || PLATFORM_REGISTRY.some((p) => p.name.toLowerCase() === row.label.toLowerCase())) {
                        row.label = detected.name;
                    }
                } else {
                    row.platform = undefined;
                }
            } else if (field === "label") {
                row.label = value;
                const detected = detectPlatform(value);
                if (detected) {
                    row.platform = detected.id;
                }
            }

            next[index] = row;
            return next;
        });
    };

    // Queue worker that handles sequential/batched updates without race conditions
    const flushToggleQueue = useCallback(async () => {
        if (isFlushingTogglesRef.current) return;
        isFlushingTogglesRef.current = true;

        try {
            while (Object.keys(pendingTogglesRef.current).length > 0) {
                // Snapshot the current pending batch
                const batch = { ...pendingTogglesRef.current };
                for (const key of Object.keys(batch) as Array<keyof typeof batch>) {
                    delete pendingTogglesRef.current[key];
                }

                const updated = await updateProfile(batch);
                dispatch(updateUserProfile(updated));
            }
        } catch (err: any) {
            console.error("Failed to update profile toggles:", err);
            toast.error(err.message || "Failed to update toggle setting", {
                title: "Update Error",
            });
        } finally {
            isFlushingTogglesRef.current = false;
            // If another click arrived while request was in-flight, flush it immediately
            if (Object.keys(pendingTogglesRef.current).length > 0) {
                flushToggleQueue();
            }
        }
    }, [dispatch]);

    // Handle instant toggle for Open to work (smooth functional update, no race condition)
    const handleToggleOpenToWork = () => {
        if (user?.isPublic === false) {
            toast.info(
                "Open to Work is automatically turned off while your profile is Private. Switch your profile to Public in Settings to activate it.",
                { title: "Profile is Private" }
            );
            return;
        }
        setIsOpenToWork((prev) => {
            const nextVal = !prev;
            pendingTogglesRef.current.isOpenToWork = nextVal;
            toast.success(
                nextVal
                    ? "Open to work tag is now active on your public profile showcase."
                    : "Open to work tag has been disabled.",
                { title: nextVal ? "Open to Work Active" : "Open to Work Inactive" }
            );
            setTimeout(() => flushToggleQueue(), 0);
            return nextVal;
        });
    };

    // Handle instant toggle for Hire me button (smooth functional update, no race condition)
    const handleToggleHireMe = () => {
        if (user?.isPublic === false) {
            toast.info(
                "Hire Me inquiries are automatically turned off while your profile is Private. Switch your profile to Public in Settings to activate them.",
                { title: "Profile is Private" }
            );
            return;
        }
        setIsHireable((prev) => {
            const nextVal = !prev;
            pendingTogglesRef.current.isHireable = nextVal;
            toast.success(
                nextVal
                    ? "Hire me button is now visible so recruiters can message you directly."
                    : "Hire me button has been hidden from your showcase.",
                { title: nextVal ? "Hire Me Active" : "Hire Me Inactive" }
            );
            setTimeout(() => flushToggleQueue(), 0);
            return nextVal;
        });
    };

    // Handle instant toggle for Resume Public / Private visibility
    const [isTogglingResumeVisibility, setIsTogglingResumeVisibility] = useState(false);

    const handleToggleResumeVisibility = async () => {
        if (!user?.resumeUrl) {
            toast.error("No resume uploaded yet. Please upload a resume first.", {
                title: "No Resume Found",
            });
            return;
        }

        if (user?.isPublic === false) {
            toast.info(
                "Resume sharing is disabled while your profile is Private. Switch your profile to Public in Settings to share it.",
                { title: "Profile is Private" }
            );
            return;
        }

        if (isTogglingResumeVisibility) return;

        const currentVal = user?.isResumePublic !== false;
        const nextVal = !currentVal;

        setIsTogglingResumeVisibility(true);
        // Optimistic update in Redux store
        dispatch(updateUserProfile({ isResumePublic: nextVal }));

        try {
            await updateResumeVisibility(nextVal);
            toast.success(
                nextVal
                    ? "Your resume is now public and can be viewed or downloaded from your profile."
                    : "Your resume is now private and hidden from your public profile.",
                { title: nextVal ? "Resume Public" : "Resume Private" }
            );
        } catch (err: any) {
            // Rollback optimistic update
            dispatch(updateUserProfile({ isResumePublic: currentVal }));
            toast.error(err.message || "Failed to update resume visibility", {
                title: "Update Error",
            });
        } finally {
            setIsTogglingResumeVisibility(false);
        }
    };

    // Determine whether user has made any changes compared to current saved profile state
    const hasChanges = useMemo(() => {
        if (!user) return false;

        const currentFirst = firstName.trim();
        const initialFirst = (user.firstName || "").trim();
        if (currentFirst !== initialFirst) return true;

        const currentLast = lastName.trim();
        const initialLast = (user.lastName || "").trim();
        if (currentLast !== initialLast) return true;

        const currentHeadline = headline.trim();
        const initialHeadline = (user.headline || "").trim();
        if (currentHeadline !== initialHeadline) return true;

        const currentBio = bio.trim();
        const initialBio = (user.bio || "").trim();
        if (currentBio !== initialBio) return true;

        const currentLocation = location.trim();
        const initialLocation = (user.location || "").trim();
        if (currentLocation !== initialLocation) return true;

        if (Boolean(isOpenToWork) !== Boolean(user.isOpenToWork)) return true;
        if (Boolean(isHireable) !== Boolean(user.isHireable)) return true;

        // Skills comparison
        const currentSkills = skills.map((s) => s.trim()).filter(Boolean);
        const initialSkills = (Array.isArray(user.skills) ? user.skills : [])
            .map((s: string) => String(s).trim())
            .filter(Boolean);
        if (currentSkills.length !== initialSkills.length) return true;
        for (let i = 0; i < currentSkills.length; i++) {
            if (currentSkills[i] !== initialSkills[i]) return true;
        }

        // Links comparison
        const currentClean = links
            .filter((l) => l.url && l.url.trim().length > 0)
            .map((l) => ({
                label: (l.label || "Link").trim(),
                url: sanitizePlatformUrl(l.url.trim()),
                platform: l.platform || detectPlatform(l.url.trim())?.id || "",
            }))
            .slice(0, 4);

        const initialClean = parseInitialLinks(user)
            .filter((l) => l.url && l.url.trim().length > 0)
            .map((l) => ({
                label: (l.label || "Link").trim(),
                url: sanitizePlatformUrl(l.url.trim()),
                platform: l.platform || detectPlatform(l.url.trim())?.id || "",
            }))
            .slice(0, 4);

        if (currentClean.length !== initialClean.length) return true;
        for (let i = 0; i < currentClean.length; i++) {
            const c = currentClean[i];
            const init = initialClean[i];
            if (!c || !init) return true;
            if (c.label !== init.label || c.url !== init.url || c.platform !== init.platform) {
                return true;
            }
        }

        // Check raw rows if user added an empty row or is editing text
        const initialRaw = parseInitialLinks(user);
        if (links.length !== initialRaw.length) return true;
        for (let i = 0; i < links.length; i++) {
            const raw = links[i];
            const init = initialRaw[i];
            if (!raw || !init) return true;
            if ((raw.label || "").trim() !== (init.label || "").trim() || (raw.url || "").trim() !== (init.url || "").trim()) {
                return true;
            }
        }

        // College comparison
        const currentCollegeId = selectedCollege?.id || null;
        const initialCollegeId = user.collegeId || user.college?.id || null;
        if (currentCollegeId !== initialCollegeId) return true;

        return false;
    }, [user, firstName, lastName, headline, bio, location, skills, links, isOpenToWork, isHireable, selectedCollege]);

    // Execute profile save after all validations and confirmations
    const executeSaveProfile = async () => {
        setSavingProfile(true);

        try {
            const sanitizedLinks = links
                .filter((l) => l.url.trim().length > 0)
                .map((l) => ({
                    label: l.label.trim() || "Link",
                    url: sanitizePlatformUrl(l.url.trim()),
                    platform: l.platform || detectPlatform(l.url.trim())?.id,
                }))
                .slice(0, 4);

            const payload = {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                headline: headline.trim(),
                bio: bio.trim(),
                location: location.trim(),
                skills,
                links: sanitizedLinks,
                isOpenToWork: user?.isPublic === false ? false : isOpenToWork,
                isHireable: user?.isPublic === false ? false : isHireable,
                collegeId: selectedCollege?.id || null,
            };

            const updated = await updateProfile(payload);
            dispatch(updateUserProfile(updated));
            setHasConfirmedCollegeSave(false);
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

    // Handle profile save form submission
    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hasChanges) {
            toast.info("No profile changes detected to save");
            return;
        }

        const initialCollegeId = user?.collegeId || user?.college?.id || null;
        const currentCollegeId = selectedCollege?.id || null;
        const isCollegeChanging = currentCollegeId !== initialCollegeId;

        // If setting or changing a college and user has not yet confirmed the warning modal
        if (isCollegeChanging && selectedCollege?.id && !hasConfirmedCollegeSave) {
            setIsCollegeConfirmModalOpen(true);
            return;
        }

        await executeSaveProfile();
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

    // Live combined user object for the Card Studio to react instantly to form edits
    const liveUser = useMemo(() => ({
        ...user,
        firstName,
        lastName,
        headline,
        bio,
        location,
        skills,
        collegeId: selectedCollege?.id || null,
        college: selectedCollege,
        links: links.map((l) => ({
            label: l.label.trim() || "Link",
            url: sanitizePlatformUrl(l.url.trim()),
            platform: l.platform || detectPlatform(l.url.trim())?.id,
        })).slice(0, 4),
        isOpenToWork,
        isHireable,
        photoUrl: user?.photoUrl || user?.avatarUrl,
    }), [user, firstName, lastName, headline, bio, location, skills, links, isOpenToWork, isHireable, selectedCollege]);

    return (
        <div className="flex h-screen bg-white text-neutral-900 overflow-hidden font-sans">
            {/* Desktop & Mobile Floating Sidebar */}
            <Sidebar
                activeTab="profile"
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
                onTabChange={(tab) => {
                    if (tab === "dashboard") navigate("/dashboard");
                    if (tab === "profile") navigate("/profile");
                    if (tab === "connect-platform") navigate("/onboarding");
                    if (tab === "resume") navigate("/resume");
                    if (tab === "projects") navigate("/projects");
                    if (tab === "leaderboard") navigate("/leaderboard");
                }}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto min-w-0 p-2 sm:p-3 lg:p-3">
                <section
                    aria-label="Developer Profile & Card Studio"
                    className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
                >
                    <div className="p-4 sm:p-6 lg:p-8 flex-1 space-y-6">
                        {/* ========================================================================= */}
                        {/* PAGE HEADER: Neo-Brutalist Heading */}
                        {/* ========================================================================= */}
                        <div className="pb-5 border-b-2 border-black/55 flex items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsMobileSidebarOpen(true)}
                                        className="lg:hidden p-2 bg-white text-black rounded-lg border-2 border-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 cursor-pointer"
                                        aria-label="Open sidebar"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                                            <line x1="3" y1="12" x2="21" y2="12" />
                                            <line x1="3" y1="6" x2="21" y2="6" />
                                            <line x1="3" y1="18" x2="21" y2="18" />
                                        </svg>
                                    </button>
                                    <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                        Profile & Showcase Studio
                                    </h1>
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-neutral-700 max-w-2xl">
                                    Manage your developer showcase, social cards, verified directory affiliation, and recruiter contact visibility.
                                </p>
                            </div>
                        </div>

                        {/* Split Layout: Left Column = Personal Details, Right Column = Orbix Share Card Studio */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                            {/* LEFT COLUMN: Personal Details Card */}
                            <div className="rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-6 sm:p-7">
                                <div className="pb-4 border-b-2 border-black/10 mb-6">
                                    <h2 className="text-lg font-black text-black">Personal Details</h2>
                                    <p className="text-xs font-medium text-neutral-600 mt-0.5">Manage your showcase details and profile photo.</p>
                                </div>

                                {/* Profile Photo Interactive Frame */}
                                <div className="flex flex-col sm:flex-row sm:items-center gap-5 p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black mb-6 shadow-[2px_2px_0px_#000]">
                                    <ProfilePhotoFrame
                                        currentPhotoUrl={user?.photoUrl || user?.avatarUrl}
                                        hasPreviousPhoto={user?.hasPreviousPhoto}
                                        previousPhotoUrl={user?.previousPhotoUrl}
                                        displayName={`${firstName} ${lastName}`.trim() || user?.username || "User"}
                                        username={user?.username || ""}
                                        size="lg"
                                    />
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h3 className="text-sm font-black text-black truncate">
                                                Profile Photo
                                            </h3>
                                            {user?.photoUrl ? (
                                                <span className="px-2 py-0.5 rounded-full bg-[#a2ff86] border border-black text-[10px] font-black text-black shadow-[1px_1px_0px_#000]">
                                                    Custom
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full bg-neutral-100 border border-black text-[10px] font-black text-black shadow-[1px_1px_0px_#000]">
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs font-medium text-neutral-600 mt-1 leading-relaxed">
                                            Hover or tap avatar to upload, restore, or reset photo. Images are optimized and face-cropped automatically.
                                        </p>
                                        {user?.hasPreviousPhoto && (
                                            <span className="inline-flex items-center gap-1.5 text-[11px] text-black font-bold mt-2">
                                                <span className="w-2 h-2 rounded-full bg-emerald-500 border border-black" />
                                                <span>Previous photo available for instant restoration</span>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <form onSubmit={handleSaveProfile} className="space-y-5">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">First Name</label>
                                            <input
                                                type="text"
                                                value={firstName}
                                                onChange={(e) => setFirstName(e.target.value)}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_#000] transition-all"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">Last Name</label>
                                            <input
                                                type="text"
                                                value={lastName}
                                                onChange={(e) => setLastName(e.target.value)}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_#000] transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">Headline</label>
                                        <input
                                            type="text"
                                            placeholder="e.g. Senior Full-Stack Engineer & Competitive Programmer"
                                            value={headline}
                                            maxLength={255}
                                            onChange={(e) => setHeadline(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_#000] transition-all"
                                        />
                                        <span className="text-[10px] font-bold text-neutral-500 flex justify-end mt-1">{headline.length}/255</span>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">Biography</label>
                                        <textarea
                                            rows={3}
                                            placeholder="Write a brief intro about yourself, your tech stack, and what you're passionate about..."
                                            value={bio}
                                            maxLength={2000}
                                            onChange={(e) => setBio(e.target.value)}
                                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_#000] transition-all resize-none"
                                        />
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">Location</label>
                                            <input
                                                type="text"
                                                placeholder="e.g. San Francisco, CA"
                                                value={location}
                                                onChange={(e) => setLocation(e.target.value)}
                                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_#000] transition-all"
                                            />
                                        </div>

                                        {/* Verified College / University Selector */}
                                        <div className="pb-1">
                                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                                                College / University (Verified Directory)
                                            </label>
                                            <CollegeAutocomplete
                                                value={selectedCollege?.id}
                                                selectedCollege={selectedCollege}
                                                onChange={setSelectedCollege}
                                                canChangeCollege={user?.canChangeCollege}
                                                collegeUpdatedAt={user?.collegeUpdatedAt}
                                                collegeLockRemainingMs={user?.collegeLockRemainingMs}
                                                nextAllowedCollegeChangeAt={user?.nextAllowedCollegeChangeAt}
                                            />
                                        </div>

                                        {/* Dynamic Links Section */}
                                        <div className="space-y-3 pt-4 border-t-2 border-black/10">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <label className="block text-xs font-black tracking-wider uppercase text-black">
                                                            LINKS ({links.length}/4)
                                                        </label>
                                                    </div>
                                                    <p className="text-[11px] text-neutral-600 font-medium mt-0.5">
                                                        Portfolio, blog, X, anything with https://
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Platform Autocomplete Datalist */}
                                            <datalist id="platform-suggestions">
                                                {PLATFORM_REGISTRY.map((p) => (
                                                     <option key={p.id} value={p.name} />
                                                ))}
                                            </datalist>

                                            {/* Links Rows */}
                                            <div className="space-y-2.5">
                                                {links.map((item, index) => (
                                                    <div
                                                        key={item.id}
                                                        className="flex items-center gap-2 group"
                                                    >
                                                        {/* Label / Platform Input */}
                                                        <div className="w-28 sm:w-36 flex-shrink-0">
                                                            <input
                                                                type="text"
                                                                list="platform-suggestions"
                                                                placeholder="Label"
                                                                value={item.label}
                                                                onChange={(e) => handleLinkChange(index, "label", e.target.value)}
                                                                className="w-full px-3 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black placeholder:text-neutral-500 focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_#000] transition-all"
                                                            />
                                                        </div>

                                                        {/* URL Input with Live Icon on Left */}
                                                        <div className="relative flex-1 min-w-0">
                                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-black">
                                                                {getPlatformIcon(
                                                                    item.platform || item.label || item.url,
                                                                    "w-4 h-4 flex-shrink-0"
                                                                )}
                                                            </div>
                                                            <input
                                                                type="text"
                                                                placeholder="https://..."
                                                                value={item.url}
                                                                onChange={(e) => handleLinkChange(index, "url", e.target.value)}
                                                                className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black placeholder:text-neutral-500 focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_#000] transition-all"
                                                            />
                                                        </div>

                                                        {/* Trash / Delete button */}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleRemoveLink(index)}
                                                            className="w-9 h-9 rounded-xl border-2 border-black hover:bg-rose-100 bg-white text-black hover:text-rose-600 flex items-center justify-center transition-colors cursor-pointer flex-shrink-0 shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px]"
                                                            title="Delete link"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>

                                            {/* + Add Link Button */}
                                            {links.length < 4 && (
                                                <div className="pt-1">
                                                    <button
                                                        type="button"
                                                        onClick={handleAddLink}
                                                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-white border-2 border-black hover:bg-neutral-100 text-black text-xs font-black uppercase tracking-wider transition-all shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] cursor-pointer"
                                                    >
                                                        <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                                                        <span>Add link</span>
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Skills Tags */}
                                    <div className="pt-4 border-t-2 border-black/10">
                                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">Skills & Technologies</label>
                                        <div className="flex gap-2 mb-2.5">
                                            <input
                                                type="text"
                                                placeholder="Type skill & press Enter"
                                                value={newSkillInput}
                                                onChange={(e) => setNewSkillInput(e.target.value)}
                                                onKeyDown={handleAddSkill}
                                                className="flex-1 px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_#000] transition-all"
                                            />
                                            <button
                                                type="button"
                                                onClick={handleAddSkill}
                                                className="px-4 py-2 rounded-xl bg-black hover:bg-neutral-800 text-xs font-black uppercase tracking-wider text-white border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] transition-all cursor-pointer"
                                            >
                                                Add
                                            </button>
                                        </div>

                                        <div className="flex flex-wrap gap-2 min-h-[32px]">
                                            {skills.map((skill) => (
                                                <span
                                                    key={skill}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FAF6EE] border-2 border-black text-black text-xs font-black shadow-[2px_2px_0px_#000]"
                                                >
                                                    <span>{skill}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveSkill(skill)}
                                                        className="text-neutral-500 hover:text-rose-600 font-black cursor-pointer ml-0.5"
                                                    >
                                                        &times;
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Save Button */}
                                    <div className="pt-4 border-t-2 border-black/10">
                                        <button
                                            type="submit"
                                            disabled={!hasChanges || savingProfile}
                                            className={`w-full h-11 flex items-center justify-center rounded-xl text-xs font-black uppercase tracking-wider transition-all border-2 border-black shadow-[3px_3px_0px_#000] ${
                                                hasChanges && !savingProfile
                                                    ? "bg-[#a2ff86] hover:bg-[#8ee673] text-black cursor-pointer hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px]"
                                                    : "bg-neutral-100 text-neutral-400 cursor-not-allowed shadow-none"
                                            }`}
                                        >
                                            {savingProfile ? (
                                                <div className="flex items-center gap-2">
                                                    <svg className="h-4 w-4 animate-spin text-black" fill="none" viewBox="0 0 24 24">
                                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                                                    </svg>
                                                    <span>Saving Changes...</span>
                                                </div>
                                            ) : hasChanges ? (
                                                <span>Save Profile Details</span>
                                            ) : (
                                                <span>No Changes to Save</span>
                                            )}
                                        </button>
                                    </div>

                                    {/* OPEN TO WORK, HIRE ME & RESUME VISIBILITY SECTION */}
                                    <div className="space-y-2 pt-4 border-t-2 border-black/10">
                                        <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-600">
                                            {Boolean(user?.resumeUrl) ? "OPEN TO WORK, HIRE ME & RESUME VISIBILITY" : "OPEN TO WORK AND HIRE ME"}
                                        </label>
                                        <div className="space-y-2.5">
                                            {/* Toggle 1: Open to work */}
                                            <div className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] transition-all">
                                                <div className="flex items-center gap-3">
                                                    <Briefcase className="w-4 h-4 text-black flex-shrink-0 stroke-[2.5]" />
                                                    <span className="text-xs sm:text-sm font-bold text-black">
                                                        Show an Open to work tag on your profile
                                                    </span>
                                                </div>
                                                <NeoToggle
                                                    checked={isOpenToWork}
                                                    onChange={handleToggleOpenToWork}
                                                    onIcon={<Briefcase className="w-3.5 h-3.5 text-black stroke-[3]" />}
                                                    offIcon={<Briefcase className="w-3.5 h-3.5 text-neutral-600 stroke-[2.5]" />}
                                                    onStatusText="Status: Active"
                                                    offStatusText="Status: Hidden"
                                                    ariaLabel="Toggle Open to work status"
                                                />
                                            </div>

                                            {/* Toggle 2: Hire me */}
                                            <div className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] transition-all">
                                                <div className="flex items-center gap-3">
                                                    <Mail className="w-4 h-4 text-black flex-shrink-0 stroke-[2.5]" />
                                                    <span className="text-xs sm:text-sm font-bold text-black">
                                                        Show a Hire me button so recruiters can message you
                                                    </span>
                                                </div>
                                                <NeoToggle
                                                    checked={isHireable}
                                                    onChange={handleToggleHireMe}
                                                    onIcon={<Mail className="w-3.5 h-3.5 text-black stroke-[3]" />}
                                                    offIcon={<Mail className="w-3.5 h-3.5 text-neutral-600 stroke-[2.5]" />}
                                                    onStatusText="Status: Active"
                                                    offStatusText="Status: Off"
                                                    ariaLabel="Toggle Hire me recruiter button"
                                                />
                                            </div>

                                            {/* Toggle 3: Resume Public / Private (only appears when resume is uploaded) */}
                                            {Boolean(user?.resumeUrl) && (
                                                <div className="flex items-center justify-between px-4 py-3.5 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] transition-all">
                                                    <div className="flex items-center gap-3 min-w-0">
                                                        <FileText className="w-4 h-4 text-black flex-shrink-0 stroke-[2.5]" />
                                                        <div className="flex flex-col min-w-0">
                                                            <span className="text-xs sm:text-sm font-bold text-black truncate">
                                                                Make your attached resume public on your profile
                                                            </span>
                                                            {user?.resumeFilename && (
                                                                <span className="text-[11px] text-neutral-500 font-medium truncate">
                                                                    {user.resumeFilename}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <NeoToggle
                                                        checked={user?.isResumePublic !== false}
                                                        onChange={handleToggleResumeVisibility}
                                                        disabled={isTogglingResumeVisibility}
                                                        onIcon={<Globe className="w-3.5 h-3.5 text-black stroke-[3]" />}
                                                        offIcon={<Lock className="w-3.5 h-3.5 text-neutral-700 stroke-[3]" />}
                                                        onStatusText="Status: Public"
                                                        offStatusText="Status: Private"
                                                        ariaLabel="Toggle resume public visibility"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </form>
                            </div>

                            {/* RIGHT COLUMN: Orbix Share Card Studio (Sticky on Desktop) */}
                            <div className="lg:sticky lg:top-5">
                                <ProfileCardStudio
                                    user={liveUser}
                                    connectedPortals={connectedPortals}
                                />
                            </div>
                        </div>

                        {/* Connected Platforms Section (Shifted below the Personal Details Card) */}
                        <div className="w-full">
                            <ConnectedPlatformsSection
                                connectedPortals={connectedPortals}
                                onPortalsChange={(updated) => setConnectedPortals(updated)}
                                syncState={platformSync}
                            />
                        </div>
                    </div>

                    {/* ========================================================================= */}
                    {/* BOTTOM FULL-WIDTH DESK ILLUSTRATION (Matching Connected Platforms & Resume) */}
                    {/* ========================================================================= */}
                    <SectionBottomIllustration alt="Profile workspace illustration" />
                </section>
            </div>

            {/* Warning Modal when saving a new college affiliation */}
            <CollegeChangeWarningModal
                isOpen={isCollegeConfirmModalOpen}
                onClose={() => setIsCollegeConfirmModalOpen(false)}
                onConfirm={() => {
                    setHasConfirmedCollegeSave(true);
                    setIsCollegeConfirmModalOpen(false);
                    setTimeout(() => executeSaveProfile(), 50);
                }}
                currentCollegeName={selectedCollege?.officialName}
                isLocked={user?.canChangeCollege === false}
                remainingMs={user?.collegeLockRemainingMs}
                nextAllowedDate={user?.nextAllowedCollegeChangeAt}
            />
        </div>
    );
}
