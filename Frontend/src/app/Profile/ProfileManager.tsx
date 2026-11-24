import React, { useState, useEffect, useMemo, useCallback, useRef, useId } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Briefcase, Mail, Trash2, Plus, FileText, Globe, Lock, GraduationCap, ExternalLink, LoaderCircle } from "lucide-react";
import { useAppDispatch, useAppSelector, updateUserProfile } from "../../store";
import type { User } from "../../store/userSlice";
import { ToastActionNotice, useToast } from "../../context/ToastContext";
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

    // Canonical public profile showcase link for this developer
    const publicProfilePath = user?.username
        ? `/profile/u/${encodeURIComponent(user.username)}`
        : "/demo";

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
    const [collegeDraft, setCollegeDraft] = useState<InstitutionItem | null | undefined>();
    const [resolvedCollege, setResolvedCollege] = useState<InstitutionItem | null>(null);
    const [collegeSearchRevision, setCollegeSearchRevision] = useState(0);
    const savedCollegeId = user?.collegeId || user?.college?.id || null;
    const savedCollege = user?.college ?? (resolvedCollege?.id === savedCollegeId ? resolvedCollege : null);
    const selectedCollege = collegeDraft === undefined ? savedCollege : collegeDraft;
    const selectedCollegeId = collegeDraft === undefined ? savedCollegeId : collegeDraft?.id ?? null;
    const profileFormId = useId();
    const profileFormRef = useRef<HTMLFormElement>(null);
    const profileSaveInFlight = useRef(false);
    const [savingProfile, setSavingProfile] = useState(false);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isCollegeConfirmModalOpen, setIsCollegeConfirmModalOpen] = useState(false);


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
                    if (!next[k] || !next[k].username || next[k].username !== handle || next[k].ownershipStatus !== p.ownershipStatus) {
                        const isOwnershipVerified = p.ownershipStatus === "VERIFIED" || p.ownership_status === "VERIFIED";
                        next[k] = {
                            portal: k,
                            username: handle,
                            profileUrl: p.link || p.profileUrl || "",
                            verified: isOwnershipVerified,
                            ownershipStatus: isOwnershipVerified ? "VERIFIED" : (p.ownershipStatus || p.ownership_status || "CONNECTED_UNVERIFIED"),
                            verificationMethod: p.verificationMethod || p.verification_method || null,
                            verifiedAt: p.verifiedAt || p.verified_at || null,
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
        }
    }, [user]);

    useEffect(() => {
        if (!savedCollegeId || user?.college?.id === savedCollegeId) return;
        let cancelled = false;
        void getInstitutionById(savedCollegeId).then((institution) => {
            if (!cancelled) setResolvedCollege(institution);
        }).catch(() => {});
        return () => { cancelled = true; };
    }, [savedCollegeId, user?.college?.id]);

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
        return selectedCollegeId !== savedCollegeId;
    }, [user, firstName, lastName, headline, bio, location, skills, links, selectedCollegeId, savedCollegeId]);

    const restoreProfileDraft = (profile: User) => {
        setFirstName(profile.firstName || "");
        setLastName(profile.lastName || "");
        setHeadline(profile.headline || "");
        setBio(profile.bio || "");
        setLocation(profile.location || "");
        setSkills(Array.isArray(profile.skills) ? profile.skills : []);
        setLinks(parseInitialLinks(profile));
        setNewSkillInput("");
        setCollegeDraft(undefined);
        setCollegeSearchRevision((revision) => revision + 1);
    };

    const cancelProfileChanges = () => {
        if (!user || profileSaveInFlight.current) return;
        restoreProfileDraft(user);
        profileFormRef.current?.focus({ preventScroll: true });
    };

    // Execute profile save after all validations and confirmations
    const executeSaveProfile = async () => {
        if (!user || profileSaveInFlight.current) return;
        profileSaveInFlight.current = true;
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
                collegeId: selectedCollegeId,
            };

            const updated = await updateProfile(payload);
            dispatch(updateUserProfile(updated));
            restoreProfileDraft({ ...user, ...updated });
            profileFormRef.current?.focus({ preventScroll: true });
            toast.success("Your profile details have been saved successfully!", {
                title: "Profile Updated",
            });
        } catch (err: any) {
            toast.error(err.message || "Failed to update profile", {
                title: "Update Error",
            });
        } finally {
            profileSaveInFlight.current = false;
            setSavingProfile(false);
        }
    };

    // Handle profile save form submission
    const handleSaveProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!hasChanges || profileSaveInFlight.current || isCollegeConfirmModalOpen) return;
        if (selectedCollegeId && selectedCollegeId !== savedCollegeId) {
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
                    if (tab === "clubs") navigate("/college-clubs");
                    if (tab === "college-events") navigate("/college-events");
                    if (tab === "events") navigate("/events");
                    if (tab === "activity" || tab === "applications") navigate("/activity");
                    if (tab === "explore") navigate("/explore");
                    if (tab === "trends") navigate("/trends");
                    if (tab === "notifications") navigate("/notifications");
                    if (tab === "settings") navigate("/settings");
                    if (tab === ("workspace" as any)) navigate("/workspace");
                }}
            />

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full min-h-0 overflow-y-auto min-w-0 p-2 sm:p-3 lg:p-3">
                <section
                    aria-label="Profile & Card Studio"
                    className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] overflow-y-auto scrollbar-none flex flex-col justify-between"
                >
                    <div className="p-4 sm:p-6 lg:p-8 pb-36 sm:pb-36 lg:pb-8 flex-1 space-y-6">
                        {/* ========================================================================= */}
                        {/* PAGE HEADER: Neo-Brutalist Heading */}
                        {/* ========================================================================= */}
                        <div className="pb-5 border-b-2 border-black/55 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <div className="flex items-center gap-3">
                                    <h1 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                                        Profile & Showcase Studio
                                    </h1>
                                </div>
                                <p className="text-xs sm:text-sm font-bold text-neutral-700 max-w-2xl">
                                    Manage your developer showcase, social cards, verified directory affiliation, and recruiter contact visibility.
                                </p>
                            </div>

                            {/* Public Profile Redirection Button */}
                            <div className="flex items-center gap-2.5 self-start sm:self-auto shrink-0">
                                <Link
                                    to={publicProfilePath}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl bg-white hover:bg-[#FAF6EE] text-black text-xs sm:text-sm font-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[1px] hover:translate-y-[1px] active:translate-x-[2px] active:translate-y-[2px] transition-all cursor-pointer select-none group"
                                    title={`View your public profile showcase (@${user?.username || "user"})`}
                                >
                                    <Globe className="w-4 h-4 text-black stroke-[2.5]" />
                                    <span>View Public Profile</span>
                                    <ExternalLink className="w-3.5 h-3.5 text-black stroke-[2.5] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                                </Link>
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

                                <form id={profileFormId} ref={profileFormRef} tabIndex={-1} onSubmit={handleSaveProfile} className="space-y-5 focus:outline-none">
                                    <fieldset disabled={savingProfile} className="min-w-0 space-y-5">
                                    {/* First Name & Last Name (Left) and Avatar Profile Photo (Right) — Responsive Full-Width Stacked on Mobile */}
                                    <div className="flex flex-col sm:flex-row items-center sm:items-end gap-4 sm:gap-5">
                                        {/* First Name & Last Name Fields (at the left of the avatar) */}
                                        <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-4 order-2 sm:order-1">
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

                                        {/* Avatar with all functionalities (Full-width responsive centered presentation on mobile) */}
                                        <div className="w-full sm:w-auto flex justify-center shrink-0 order-1 sm:order-2 pb-2 sm:pb-0">
                                            <ProfilePhotoFrame
                                                currentPhotoUrl={user?.photoUrl || user?.avatarUrl}
                                                hasPreviousPhoto={user?.hasPreviousPhoto}
                                                previousPhotoUrl={user?.previousPhotoUrl}
                                                displayName={`${firstName} ${lastName}`.trim() || user?.username || "User"}
                                                username={user?.username || ""}
                                                size="lg"
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
                                                key={collegeSearchRevision}
                                                value={selectedCollegeId}
                                                selectedCollege={selectedCollege}
                                                onChange={setCollegeDraft}
                                                disabled={savingProfile}
                                                canChangeCollege={user?.canChangeCollege}
                                                collegeUpdatedAt={user?.collegeUpdatedAt}
                                                collegeLockRemainingMs={user?.collegeLockRemainingMs}
                                                nextAllowedCollegeChangeAt={user?.nextAllowedCollegeChangeAt}
                                            />

                                            {/* College Verification Entry Point Card */}
                                            {selectedCollege?.id ? (
                                                <div className="mt-3 p-3.5 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                                    <div className="flex items-center gap-2 min-w-0">
                                                        <div className="w-7 h-7 rounded-lg bg-[#FFE566] border border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                                                            <GraduationCap className="w-4 h-4 text-black stroke-[2.5]" />
                                                        </div>
                                                        <div className="min-w-0">
                                                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600 block">
                                                                Selected Institution
                                                            </span>
                                                            <h4 className="text-xs font-black text-black truncate">
                                                                {selectedCollege.officialName}
                                                            </h4>
                                                        </div>
                                                    </div>
                                                    <p className="text-[11px] text-neutral-600 font-semibold leading-relaxed">
                                                        Your profile is linked with {selectedCollege.officialName}. You have access to official campus chapters, college events, and leaderboards.
                                                    </p>
                                                </div>
                                            ) : (
                                                <div className="mt-3 p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-dashed border-black/40 space-y-1.5">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-6 h-6 rounded-lg bg-[#FFE566] border border-black flex items-center justify-center shrink-0">
                                                            <GraduationCap className="w-3.5 h-3.5 text-black stroke-[2.5]" />
                                                        </div>
                                                        <span className="text-xs font-black uppercase tracking-wider text-black">
                                                            College Affiliation Required
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-neutral-600 font-semibold leading-relaxed">
                                                        Search and select your university above to link your campus. This enables you to access campus clubs and college events.
                                                    </p>
                                                </div>
                                            )}
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

                                    </fieldset>

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
                                                    showStatusText={true}
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
                                                    showStatusText={true}
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
                                                        showStatusText={true}
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

            <ToastActionNotice
                open={(hasChanges || savingProfile) && !isCollegeConfirmModalOpen}
                title={savingProfile ? "Saving profile changes…" : "Unsaved profile changes"}
                actions={
                    <>
                        <button
                            type="button"
                            disabled={savingProfile}
                            onClick={cancelProfileChanges}
                            className="inline-flex items-center justify-center rounded-xl border-2 border-black bg-white px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-black text-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 disabled:opacity-60 cursor-pointer active:translate-x-[1px] active:translate-y-[1px] transition-all select-none"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form={profileFormId}
                            disabled={savingProfile}
                            className="inline-flex items-center justify-center gap-1.5 rounded-xl border-2 border-black bg-[#a2ff86] px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-black text-black shadow-[2px_2px_0px_#000] hover:bg-[#8ee673] disabled:opacity-60 cursor-pointer active:translate-x-[1px] active:translate-y-[1px] transition-all select-none"
                        >
                            {savingProfile && <LoaderCircle className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />}
                            Save changes
                        </button>
                    </>
                }
            />

            {/* Warning Modal when saving a new college affiliation */}
            <CollegeChangeWarningModal
                isOpen={isCollegeConfirmModalOpen}
                onClose={() => setIsCollegeConfirmModalOpen(false)}
                onConfirm={() => {
                    setIsCollegeConfirmModalOpen(false);
                    void executeSaveProfile();
                }}
                currentCollegeName={selectedCollege?.officialName}
                isLocked={user?.canChangeCollege === false}
                remainingMs={user?.collegeLockRemainingMs}
                nextAllowedDate={user?.nextAllowedCollegeChangeAt}
            />
        </div>
    );
}
