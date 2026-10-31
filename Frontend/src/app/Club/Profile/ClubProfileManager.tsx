import React, { useState, useEffect, useMemo, useRef } from "react";
import {
    Save,
    UploadCloud,
    Globe,
    Building2,
    Mail,
    Phone,
    Trophy,
    UserCheck,
    FileText,
    Sparkles,
    Eye,
    AlertCircle,
    Info,
    Check,
    Layers,
    Loader2,
    ShieldCheck,
    CheckCircle2,
    Trash2,
    RefreshCw,
} from "lucide-react";
import type { ClubProfileData } from "../../../utils/clubProfileApi";
import {
    requestClubUploadSignature,
    uploadClubImageToCloudinary,
} from "../../../utils/clubProfileApi";
import { useAppDispatch, useAppSelector, fetchClubProfile, saveClubProfile } from "../../../store";
import { useToast } from "../../../context/ToastContext";
import { ClubMarkdownEditor } from "./ClubMarkdownEditor";
import { ClubCoordinatorsManager } from "./ClubCoordinatorsManager";
import { ClubAchievementsManager } from "./ClubAchievementsManager";

interface ClubProfileManagerProps {
    clubId?: string;
    onProfileUpdated?: () => void;
}

const CATEGORIES = [
    "Technical & Coding",
    "Robotics & Hardware",
    "Design & Creative Arts",
    "Artificial Intelligence & ML",
    "Web3 & Blockchain",
    "Entrepreneurship & Startups",
    "Cultural & Literary",
    "Sports & Fitness",
    "Social Impact & Environment",
    "Academic & Research",
    "Other",
];

const OPERATING_STATUSES = [
    { value: "active", label: "Active", desc: "Regularly organizing events and active chapters" },
    { value: "recruiting", label: "Recruiting", desc: "Currently onboarding new team leads & members" },
    { value: "hiatus", label: "On Hiatus", desc: "Temporarily paused for semester break or reorganization" },
    { value: "inactive", label: "Inactive", desc: "Archived or historical club record" },
];

export const ClubProfileManager: React.FC<ClubProfileManagerProps> = ({
    clubId,
    onProfileUpdated,
}) => {
    const toast = useToast();

    const dispatch = useAppDispatch();
    const clubState = useAppSelector((state) => state.club);

    // Derived data from centralized Redux store
    const club = clubState.club;
    const coordinators = clubState.coordinators;
    const achievements = clubState.achievements;
    const permissions = clubState.permissions;
    const completion = clubState.completion;

    // Form fields state
    const [name, setName] = useState("");
    const [slug, setSlug] = useState("");
    const [category, setCategory] = useState("Technical & Coding");
    const [shortDescription, setShortDescription] = useState("");
    const [about, setAbout] = useState("");
    const [mission, setMission] = useState("");
    const [vision, setVision] = useState("");
    const [foundedYear, setFoundedYear] = useState<string>("");
    const [operatingStatus, setOperatingStatus] = useState<"active" | "recruiting" | "hiatus" | "inactive">("active");
    const [focusAreas, setFocusAreas] = useState<string[]>([]);
    const [newTagInput, setNewTagInput] = useState("");

    // Media
    const [logoUrl, setLogoUrl] = useState("");
    const [coverImageUrl, setCoverImageUrl] = useState("");

    // Contact & Social
    const [publicEmail, setPublicEmail] = useState("");
    const [contactPhone, setContactPhone] = useState("");
    const [websiteUrl, setWebsiteUrl] = useState("");
    const [socialGithub, setSocialGithub] = useState("");
    const [socialLinkedin, setSocialLinkedin] = useState("");
    const [socialInstagram, setSocialInstagram] = useState("");
    const [socialX, setSocialX] = useState("");
    const [socialDiscord, setSocialDiscord] = useState("");
    const [socialYoutube, setSocialYoutube] = useState("");

    // Recruitment & Publishing
    const [recruitmentStatus, setRecruitmentStatus] = useState<"open" | "closed" | "upcoming">("closed");
    const [recruitmentAnnouncement, setRecruitmentAnnouncement] = useState("");
    const [recruitmentUrl, setRecruitmentUrl] = useState("");
    const [publicationStatus, setPublicationStatus] = useState<"draft" | "published" | "hidden">("published");
    const [profileVisibility, setProfileVisibility] = useState<"public" | "unlisted" | "private">("public");

    // UI & Action states
    const [activeSection, setActiveSection] = useState<string>("basic");
    const [isSaving, setIsSaving] = useState(false);
    const [isUploadingLogo, setIsUploadingLogo] = useState(false);
    const [isUploadingCover, setIsUploadingCover] = useState(false);
    const [logoUploadPercent, setLogoUploadPercent] = useState<number | null>(null);
    const [coverUploadPercent, setCoverUploadPercent] = useState<number | null>(null);
    const [isDraggingLogo, setIsDraggingLogo] = useState(false);
    const [isDraggingCover, setIsDraggingCover] = useState(false);

    // Initial snapshot for change detection
    const initialSnapshotRef = useRef<string>("");
    const logoInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    const populateFormFromClub = (c: ClubProfileData) => {
        setName(c.name || "");
        setSlug(c.slug || "");
        setCategory(c.category || "Technical & Coding");
        setShortDescription(c.shortDescription || "");
        setAbout(c.about || "");
        setMission(c.mission || "");
        setVision(c.vision || "");
        setFoundedYear(c.foundedYear ? String(c.foundedYear) : "");
        setOperatingStatus(c.operatingStatus || "active");
        setFocusAreas(Array.isArray(c.focusAreas) ? c.focusAreas : []);

        setLogoUrl(c.logoUrl || "");
        setCoverImageUrl(c.coverImageUrl || "");

        setPublicEmail(c.publicEmail || "");
        setContactPhone(c.contactPhone || "");
        setWebsiteUrl(c.websiteUrl || "");

        const s = c.socialLinks || {};
        setSocialGithub(s.github || "");
        setSocialLinkedin(s.linkedin || "");
        setSocialInstagram(s.instagram || "");
        setSocialX(s.x || (s as any).twitter || "");
        setSocialDiscord(s.discord || "");
        setSocialYoutube(s.youtube || "");

        setRecruitmentStatus(c.recruitmentStatus || "closed");
        setRecruitmentAnnouncement(c.recruitmentAnnouncement || "");
        setRecruitmentUrl(c.recruitmentUrl || "");
        setPublicationStatus(c.publicationStatus || "published");
        setProfileVisibility(c.profileVisibility || "public");

        initialSnapshotRef.current = JSON.stringify({
            name: c.name || "",
            category: c.category || "Technical & Coding",
            shortDescription: c.shortDescription || "",
            about: c.about || "",
            mission: c.mission || "",
            vision: c.vision || "",
            foundedYear: c.foundedYear ? String(c.foundedYear) : "",
            operatingStatus: c.operatingStatus || "active",
            focusAreas: Array.isArray(c.focusAreas) ? c.focusAreas : [],
            logoUrl: c.logoUrl || "",
            coverImageUrl: c.coverImageUrl || "",
            publicEmail: c.publicEmail || "",
            contactPhone: c.contactPhone || "",
            websiteUrl: c.websiteUrl || "",
            socialLinks: s,
            recruitmentStatus: c.recruitmentStatus || "closed",
            recruitmentAnnouncement: c.recruitmentAnnouncement || "",
            recruitmentUrl: c.recruitmentUrl || "",
            publicationStatus: c.publicationStatus || "published",
            profileVisibility: c.profileVisibility || "public",
        });
    };

    const loadProfile = async (force = false) => {
        try {
            const data = await dispatch(fetchClubProfile({ clubId, force })).unwrap();
            if (data?.club) {
                populateFormFromClub(data.club);
            }
        } catch (err: any) {
            console.error("Load club profile error:", err);
            toast.error(err || "Failed to load club profile.");
        }
    };

    // Synchronize form with Redux store on mount or club change
    useEffect(() => {
        if (clubState.isInitialized && clubState.club) {
            populateFormFromClub(clubState.club);
        } else {
            loadProfile(false);
        }
    }, [clubId, clubState.isInitialized]);

    // Check if form has unsaved modifications
    const hasChanges = useMemo(() => {
        if (!initialSnapshotRef.current) return false;
        const current = JSON.stringify({
            name,
            category,
            shortDescription,
            about,
            mission,
            vision,
            foundedYear,
            operatingStatus,
            focusAreas,
            logoUrl,
            coverImageUrl,
            publicEmail,
            contactPhone,
            websiteUrl,
            socialLinks: {
                github: socialGithub.trim() || undefined,
                linkedin: socialLinkedin.trim() || undefined,
                instagram: socialInstagram.trim() || undefined,
                x: socialX.trim() || undefined,
                discord: socialDiscord.trim() || undefined,
                youtube: socialYoutube.trim() || undefined,
            },
            recruitmentStatus,
            recruitmentAnnouncement,
            recruitmentUrl,
            publicationStatus,
            profileVisibility,
        });
        return current !== initialSnapshotRef.current;
    }, [
        name,
        category,
        shortDescription,
        about,
        mission,
        vision,
        foundedYear,
        operatingStatus,
        focusAreas,
        logoUrl,
        coverImageUrl,
        publicEmail,
        contactPhone,
        websiteUrl,
        socialGithub,
        socialLinkedin,
        socialInstagram,
        socialX,
        socialDiscord,
        socialYoutube,
        recruitmentStatus,
        recruitmentAnnouncement,
        recruitmentUrl,
        publicationStatus,
        profileVisibility,
    ]);

    // Direct Cloudinary upload for Club Logo
    const uploadLogoFile = async (file: File) => {
        if (!file || !club) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please select a valid image file (PNG, JPG, WEBP).");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Logo file size must be under 5 MB.");
            return;
        }

        try {
            setIsUploadingLogo(true);
            setLogoUploadPercent(0);

            const config = await requestClubUploadSignature("logo", club.id);
            const res = await uploadClubImageToCloudinary(config, file, (percent) => {
                setLogoUploadPercent(percent);
            });

            setLogoUrl(res.secureUrl);

            // Immediately auto-persist to database & Redux
            const updated = await dispatch(saveClubProfile({ payload: { logoUrl: res.secureUrl }, clubId: club.id })).unwrap();
            if (updated?.club) {
                populateFormFromClub(updated.club);
            }

            toast.success("Club official logo uploaded and saved successfully!", {
                title: "Logo Saved",
            });
            if (onProfileUpdated) onProfileUpdated();
        } catch (err: any) {
            console.error("Upload error:", err);
            toast.error(err.message || "Failed to upload logo.");
        } finally {
            setIsUploadingLogo(false);
            setLogoUploadPercent(null);
            if (logoInputRef.current) logoInputRef.current.value = "";
        }
    };

    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) uploadLogoFile(file);
    };

    const handleRemoveLogo = async () => {
        if (!club) return;
        try {
            setIsUploadingLogo(true);
            setLogoUrl("");
            const updated = await dispatch(saveClubProfile({ payload: { logoUrl: null }, clubId: club.id })).unwrap();
            if (updated?.club) {
                populateFormFromClub(updated.club);
            }
            toast.success("Club official logo removed.");
            if (onProfileUpdated) onProfileUpdated();
        } catch (err: any) {
            toast.error(err.message || "Failed to remove logo.");
        } finally {
            setIsUploadingLogo(false);
        }
    };

    // Direct Cloudinary upload for Club Cover Banner
    const uploadCoverFile = async (file: File) => {
        if (!file || !club) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please select a valid image file (PNG, JPG, WEBP).");
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            toast.error("Header banner file size must be under 5 MB.");
            return;
        }

        try {
            setIsUploadingCover(true);
            setCoverUploadPercent(0);

            const config = await requestClubUploadSignature("banner", club.id);
            const res = await uploadClubImageToCloudinary(config, file, (percent) => {
                setCoverUploadPercent(percent);
            });

            setCoverImageUrl(res.secureUrl);

            // Immediately auto-persist to database & Redux
            const updated = await dispatch(saveClubProfile({ payload: { coverImageUrl: res.secureUrl }, clubId: club.id })).unwrap();
            if (updated?.club) {
                populateFormFromClub(updated.club);
            }

            toast.success("Header showcase banner uploaded and saved successfully!", {
                title: "Banner Saved",
            });
            if (onProfileUpdated) onProfileUpdated();
        } catch (err: any) {
            console.error("Upload error:", err);
            toast.error(err.message || "Failed to upload header banner.");
        } finally {
            setIsUploadingCover(false);
            setCoverUploadPercent(null);
            if (coverInputRef.current) coverInputRef.current.value = "";
        }
    };

    const handleCoverUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) uploadCoverFile(file);
    };

    const handleResetCover = async () => {
        if (!club) return;
        try {
            setIsUploadingCover(true);
            setCoverImageUrl("");
            const updated = await dispatch(saveClubProfile({ payload: { coverImageUrl: null }, clubId: club.id })).unwrap();
            if (updated?.club) {
                populateFormFromClub(updated.club);
            }
            toast.success("Header banner reset to default.");
            if (onProfileUpdated) onProfileUpdated();
        } catch (err: any) {
            toast.error(err.message || "Failed to reset header banner.");
        } finally {
            setIsUploadingCover(false);
        }
    };

    // Add Focus Area tag
    const handleAddFocusArea = (e?: React.KeyboardEvent | React.MouseEvent) => {
        if (e && "key" in e && e.key !== "Enter") return;
        if (e) e.preventDefault();

        const tag = newTagInput.trim();
        if (tag && !focusAreas.includes(tag)) {
            if (focusAreas.length >= 15) {
                toast.info("Maximum 15 focus tags allowed.");
                return;
            }
            setFocusAreas([...focusAreas, tag]);
            setNewTagInput("");
        }
    };

    const handleRemoveFocusArea = (tagToRemove: string) => {
        setFocusAreas(focusAreas.filter((t) => t !== tagToRemove));
    };

    // Submit save profile
    const handleSaveProfile = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!club) return;

        try {
            setIsSaving(true);

            const payload: Record<string, any> = {
                name: name.trim(),
                category: category.trim(),
                shortDescription: shortDescription.trim() || null,
                about: about.trim() || null,
                mission: mission.trim() || null,
                vision: vision.trim() || null,
                foundedYear: foundedYear ? parseInt(foundedYear, 10) : null,
                operatingStatus,
                focusAreas,
                logoUrl: logoUrl.trim() || null,
                coverImageUrl: coverImageUrl.trim() || null,
                websiteUrl: websiteUrl.trim() || null,
                publicEmail: publicEmail.trim() || null,
                contactPhone: contactPhone.trim() || null,
                socialLinks: {
                    github: socialGithub.trim() || undefined,
                    linkedin: socialLinkedin.trim() || undefined,
                    instagram: socialInstagram.trim() || undefined,
                    x: socialX.trim() || undefined,
                    discord: socialDiscord.trim() || undefined,
                    youtube: socialYoutube.trim() || undefined,
                },
                recruitmentStatus,
                recruitmentAnnouncement: recruitmentAnnouncement.trim() || null,
                recruitmentUrl: recruitmentUrl.trim() || null,
                publicationStatus,
                profileVisibility,
            };

            const updatedData = await dispatch(saveClubProfile({ payload, clubId: club.id })).unwrap();
            if (updatedData?.club) {
                populateFormFromClub(updatedData.club);
            }

            toast.success("Club profile updated and published successfully!", {
                title: "Profile Saved",
            });

            if (onProfileUpdated) onProfileUpdated();
        } catch (err: any) {
            console.error("Save profile error:", err);
            toast.error(err || "Failed to update club profile.", {
                title: "Update Error",
            });
        } finally {
            setIsSaving(false);
        }
    };

    const isGlobalLoading = clubState.loading && !clubState.isInitialized && !club;
    if (isGlobalLoading) {
        return (
            <div className="p-12 text-center flex flex-col items-center justify-center space-y-3">
                <Loader2 className="w-8 h-8 animate-spin text-black" />
                <p className="text-xs font-bold text-neutral-600">Loading club profile...</p>
            </div>
        );
    }

    if (!club) {
        return (
            <div className="p-8 rounded-2xl bg-white border-2 border-black text-center space-y-3 shadow-[4px_4px_0px_#000]">
                <AlertCircle className="w-8 h-8 text-red-500 mx-auto" />
                <h3 className="text-base font-black text-black">Club Workspace Not Found</h3>
                <p className="text-xs text-neutral-600">You must be associated with a verified collegiate club to access this management area.</p>
            </div>
        );
    }

    const canManage = permissions?.canManageProfile ?? true;

    const sections = [
        { id: "basic", label: "Basic Info", icon: Info },
        { id: "branding", label: "Branding & Media", icon: Layers },
        { id: "about", label: "About Story", icon: FileText },
        { id: "coordinators", label: "Coordinators", icon: UserCheck, count: coordinators.length },
        { id: "organisation", label: "Organisation & Contact", icon: Building2 },
        { id: "online", label: "Online Presence", icon: Globe },
        { id: "achievements", label: "Achievements", icon: Trophy, count: achievements.length },
        { id: "recruitment", label: "Recruitment", icon: Sparkles },
        { id: "visibility", label: "Publishing", icon: Eye },
    ];

    return (
        <div className="space-y-6">
            {/* ========================================================================= */}
            {/* STICKY TOP ACTION BAR & PROFILE COMPLETION STATUS CARD */}
            {/* ========================================================================= */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="flex items-start gap-4">
                    {/* Club Logo Avatar */}
                    <div className="w-14 h-14 rounded-2xl bg-[#FAF6EE] border-2 border-black overflow-hidden shrink-0 flex items-center justify-center shadow-[2px_2px_0px_#000]">
                        {logoUrl ? (
                            <img src={logoUrl} alt={name} className="w-full h-full object-cover" />
                        ) : (
                            <span className="text-base font-black text-black">{name.slice(0, 2).toUpperCase()}</span>
                        )}
                    </div>

                    <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-lg sm:text-xl font-black text-black tracking-tight">{name || "Club Profile"}</h2>
                        </div>
                        <p className="text-xs font-bold text-neutral-600 flex items-center gap-1.5 flex-wrap">
                            <span>{club.collegeName}</span>
                            <span>•</span>
                            <span className="font-mono text-neutral-500">/clubs/{slug}</span>
                        </p>
                    </div>
                </div>

                {/* Actions & Completion Meter */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    {/* Completion Meter */}
                    <div className="px-3.5 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-3">
                        <div className="text-right">
                            <div className="text-xs font-black text-black">{completion.percentage}% Complete</div>
                            <div className="text-[10px] font-medium text-neutral-500">
                                {completion.missingItems.length === 0 ? "All items filled" : `${completion.missingItems.length} items missing`}
                            </div>
                        </div>
                        <div className="w-14 bg-white h-2.5 rounded-full border border-black overflow-hidden shadow-inner">
                            <div
                                className="bg-[#a2ff86] h-full transition-all duration-300"
                                style={{ width: `${completion.percentage}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            {/* ========================================================================= */}
            {/* HORIZONTAL SECTION NAVIGATION PILLS */}
            {/* ========================================================================= */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
                {sections.map((sec) => {
                    const Icon = sec.icon;
                    const isActive = activeSection === sec.id;
                    return (
                        <button
                            key={sec.id}
                            type="button"
                            onClick={() => setActiveSection(sec.id)}
                            className={`px-3.5 py-2 rounded-xl border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] shrink-0 flex items-center gap-2 transition-all cursor-pointer ${
                                isActive
                                    ? "bg-black text-[#a2ff86]"
                                    : "bg-white text-black hover:bg-neutral-100"
                            }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{sec.label}</span>
                            {sec.count !== undefined && sec.count > 0 && (
                                <span
                                    className={`px-1.5 py-0.2 rounded-md text-[10px] font-black border ${
                                        isActive ? "bg-white text-black border-black" : "bg-[#a2ff86] text-black border-black"
                                    }`}
                                >
                                    {sec.count}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* ========================================================================= */}
            {/* SECTION CONTENT CARDS */}
            {/* ========================================================================= */}

            {/* SECTION 1: BASIC INFORMATION */}
            {activeSection === "basic" && (
                <div className="p-6 sm:p-7 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                    <div className="pb-4 border-b border-black/10">
                        <h3 className="text-base font-black text-black">Basic Club Identity</h3>
                        <p className="text-xs font-medium text-neutral-600 mt-0.5">
                            Core chapter identification, category classification, and operating status.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="md:col-span-2">
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                                Official Club Name *
                            </label>
                            <input
                                type="text"
                                required
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="e.g. Google Developer Student Club"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                                Primary Category
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden cursor-pointer"
                            >
                                {CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                                Founded Year
                            </label>
                            <input
                                type="number"
                                min={1950}
                                max={new Date().getFullYear() + 1}
                                value={foundedYear}
                                onChange={(e) => setFoundedYear(e.target.value)}
                                placeholder="e.g. 2021"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                            Tagline / Short Description (Headline)
                        </label>
                        <input
                            type="text"
                            maxLength={250}
                            value={shortDescription}
                            onChange={(e) => setShortDescription(e.target.value)}
                            placeholder="e.g. Empowering student developers through open-source collaborations and competitive programming"
                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                        />
                        <span className="text-[10px] text-neutral-500 flex justify-end mt-1">
                            {shortDescription.length}/250 characters
                        </span>
                    </div>

                    {/* Operating Status Selector */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-2">
                            Operating Status
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                            {OPERATING_STATUSES.map((status) => {
                                const selected = operatingStatus === status.value;
                                return (
                                    <button
                                        key={status.value}
                                        type="button"
                                        onClick={() => setOperatingStatus(status.value as any)}
                                        className={`p-3.5 rounded-xl border-2 border-black text-left transition-all cursor-pointer ${
                                            selected
                                                ? "bg-black text-white shadow-[2px_2px_0px_#000]"
                                                : "bg-[#FAF6EE] text-black hover:bg-white"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black">{status.label}</span>
                                            {selected && <Check className="w-3.5 h-3.5 text-[#a2ff86]" />}
                                        </div>
                                        <p
                                            className={`text-[10px] font-medium mt-1 leading-snug ${
                                                selected ? "text-neutral-300" : "text-neutral-600"
                                            }`}
                                        >
                                            {status.desc}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 2: BRANDING & MEDIA */}
            {activeSection === "branding" && (
                <div className="space-y-6">
                    {/* Hidden File Inputs */}
                    <input
                        type="file"
                        ref={logoInputRef}
                        onChange={handleLogoUpload}
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                    />
                    <input
                        type="file"
                        ref={coverInputRef}
                        onChange={handleCoverUpload}
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                    />

                    {/* CARD 1: CLUB OFFICIAL LOGO */}
                    <div className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-5">
                        {/* Header Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-black/10">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                    <UploadCloud className="w-6 h-6 text-black stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-lg sm:text-xl font-black text-black">
                                        Upload Club Official Logo
                                    </h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                        Upload your official square or circular logo to represent your club across student directories.
                                    </p>
                                </div>
                            </div>
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase bg-[#FAF6EE] text-neutral-800 border-2 border-black shadow-[1.5px_1.5px_0px_#000] self-start sm:self-center">
                                Max 5 MB
                            </span>
                        </div>

                        {/* Drag & Drop Area */}
                        <div
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDraggingLogo(false);
                                if (!isUploadingLogo && e.dataTransfer.files?.[0]) {
                                    uploadLogoFile(e.dataTransfer.files[0]);
                                }
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!isUploadingLogo) setIsDraggingLogo(true);
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDraggingLogo(false);
                            }}
                            onClick={() => !isUploadingLogo && logoInputRef.current?.click()}
                            className={`p-6 sm:p-8 border-2 border-dashed rounded-2xl text-center space-y-4 cursor-pointer transition-all ${
                                isDraggingLogo
                                    ? "bg-[#a2ff86]/20 border-black ring-2 ring-black scale-[0.99]"
                                    : logoUrl
                                    ? "bg-[#FAF6EE] border-black shadow-[2px_2px_0px_#000]"
                                    : "bg-[#FAF6EE]/60 border-black/35 hover:border-black hover:bg-[#FAF6EE]"
                            }`}
                        >
                            {isUploadingLogo ? (
                                /* Uploading State */
                                <div className="space-y-3 py-3">
                                    <div className="w-14 h-14 rounded-2xl bg-[#a2ff86] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                                        <Loader2 className="w-7 h-7 text-black stroke-[2.5] animate-spin" />
                                    </div>
                                    <div className="space-y-1 max-w-sm mx-auto">
                                        <p className="text-sm font-black text-black">
                                            Uploading logo to Cloudinary...
                                        </p>
                                        <p className="text-xs text-neutral-600 font-bold">
                                            {logoUploadPercent !== null ? `${logoUploadPercent}% completed` : "Processing..."}
                                        </p>
                                    </div>
                                    {logoUploadPercent !== null && (
                                        <div className="w-48 max-w-full mx-auto bg-white h-2.5 rounded-full border border-black overflow-hidden shadow-inner">
                                            <div
                                                className="bg-[#a2ff86] h-full transition-all duration-200"
                                                style={{ width: `${logoUploadPercent}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : logoUrl ? (
                                /* Selected / Uploaded State */
                                <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                                    <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-white border-2 border-black overflow-hidden relative shadow-[3px_3px_0px_#000] flex items-center justify-center mx-auto">
                                        <img src={logoUrl} alt="Club Logo" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-black text-xs font-bold text-neutral-800 shadow-[1px_1px_0px_#000]">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Club official logo active & uploaded</span>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => logoInputRef.current?.click()}
                                            className="px-4 py-2 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                                            <span>Change Logo</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleRemoveLogo}
                                            disabled={isUploadingLogo}
                                            className="px-3.5 py-2 rounded-xl bg-white text-rose-600 hover:bg-rose-50 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>Remove</span>
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-neutral-500 font-medium">
                                        Or drag and drop a new logo file over this block to replace it
                                    </p>
                                </div>
                            ) : (
                                /* Empty Dropzone State */
                                <div className="space-y-3">
                                    <div className="w-14 h-14 rounded-2xl bg-white border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000] hover:scale-105 transition-transform">
                                        <UploadCloud className="w-7 h-7 text-black stroke-[2.5]" />
                                    </div>
                                    <div className="space-y-1 max-w-md mx-auto">
                                        <p className="text-sm sm:text-base font-black text-black">
                                            Drag and drop your logo file here
                                        </p>
                                        <p className="text-xs text-neutral-600 font-medium">
                                            or click anywhere in this block to browse your device
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-neutral-600">
                                        <span className="px-2 py-0.5 rounded bg-white border border-black/20 shadow-[1px_1px_0px_#000] font-mono">.PNG</span>
                                        <span className="px-2 py-0.5 rounded bg-white border border-black/20 shadow-[1px_1px_0px_#000] font-mono">.JPG</span>
                                        <span className="px-2 py-0.5 rounded bg-white border border-black/20 shadow-[1px_1px_0px_#000] font-mono">.WEBP</span>
                                        <span>• Up to 5 MB</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Bar */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                            <p className="text-xs text-neutral-600 font-medium flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>Securely processed and stored via Cloudinary storage</span>
                            </p>
                            {!logoUrl && (
                                <button
                                    type="button"
                                    onClick={() => logoInputRef.current?.click()}
                                    disabled={isUploadingLogo}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#FFE566] hover:bg-[#ffe043] text-black text-xs sm:text-sm font-black uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                                    <span>BROWSE & UPLOAD LOGO</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* CARD 2: HEADER SHOWCASE BANNER */}
                    <div className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-black shadow-[6px_6px_0px_#000] space-y-5">
                        {/* Header Row */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b-2 border-black/10">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center shrink-0 shadow-[2px_2px_0px_#000]">
                                    <UploadCloud className="w-6 h-6 text-black stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-lg sm:text-xl font-black text-black">
                                        Upload Header Showcase Banner
                                    </h3>
                                    <p className="text-xs sm:text-sm text-neutral-600 font-medium">
                                        Upload your high-resolution custom chapter banner (3:1 wide ratio recommended).
                                    </p>
                                </div>
                            </div>
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black uppercase bg-[#FAF6EE] text-neutral-800 border-2 border-black shadow-[1.5px_1.5px_0px_#000] self-start sm:self-center">
                                Max 5 MB
                            </span>
                        </div>

                        {/* Drag & Drop Area */}
                        <div
                            onDrop={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDraggingCover(false);
                                if (!isUploadingCover && e.dataTransfer.files?.[0]) {
                                    uploadCoverFile(e.dataTransfer.files[0]);
                                }
                            }}
                            onDragOver={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!isUploadingCover) setIsDraggingCover(true);
                            }}
                            onDragLeave={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setIsDraggingCover(false);
                            }}
                            onClick={() => !isUploadingCover && coverInputRef.current?.click()}
                            className={`p-6 sm:p-8 border-2 border-dashed rounded-2xl text-center space-y-4 cursor-pointer transition-all ${
                                isDraggingCover
                                    ? "bg-[#a2ff86]/20 border-black ring-2 ring-black scale-[0.99]"
                                    : coverImageUrl
                                    ? "bg-[#FAF6EE] border-black shadow-[2px_2px_0px_#000]"
                                    : "bg-[#FAF6EE]/60 border-black/35 hover:border-black hover:bg-[#FAF6EE]"
                            }`}
                        >
                            {isUploadingCover ? (
                                /* Uploading State */
                                <div className="space-y-3 py-3">
                                    <div className="w-14 h-14 rounded-2xl bg-[#a2ff86] border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000]">
                                        <Loader2 className="w-7 h-7 text-black stroke-[2.5] animate-spin" />
                                    </div>
                                    <div className="space-y-1 max-w-sm mx-auto">
                                        <p className="text-sm font-black text-black">
                                            Uploading banner to Cloudinary...
                                        </p>
                                        <p className="text-xs text-neutral-600 font-bold">
                                            {coverUploadPercent !== null ? `${coverUploadPercent}% completed` : "Processing..."}
                                        </p>
                                    </div>
                                    {coverUploadPercent !== null && (
                                        <div className="w-48 max-w-full mx-auto bg-white h-2.5 rounded-full border border-black overflow-hidden shadow-inner">
                                            <div
                                                className="bg-[#a2ff86] h-full transition-all duration-200"
                                                style={{ width: `${coverUploadPercent}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ) : coverImageUrl ? (
                                /* Selected / Uploaded State */
                                <div className="space-y-3" onClick={(e) => e.stopPropagation()}>
                                    <div className="w-full h-36 sm:h-48 rounded-2xl bg-white border-2 border-black overflow-hidden relative shadow-[3px_3px_0px_#000] flex items-center justify-center">
                                        <img src={coverImageUrl} alt="Header Banner" className="w-full h-full object-cover" />
                                    </div>
                                    <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white border border-black text-xs font-bold text-neutral-800 shadow-[1px_1px_0px_#000]">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        <span>Header showcase banner active & uploaded</span>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => coverInputRef.current?.click()}
                                            className="px-4 py-2 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                        >
                                            <RefreshCw className="w-3.5 h-3.5 stroke-[2.5]" />
                                            <span>Change Banner</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleResetCover}
                                            disabled={isUploadingCover}
                                            className="px-3.5 py-2 rounded-xl bg-white text-rose-600 hover:bg-rose-50 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                            <span>Reset to Default</span>
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-neutral-500 font-medium">
                                        Or drag and drop a new banner image over this block to replace it
                                    </p>
                                </div>
                            ) : (
                                /* Empty Dropzone State */
                                <div className="space-y-3">
                                    <div className="w-14 h-14 rounded-2xl bg-white border-2 border-black flex items-center justify-center mx-auto shadow-[2px_2px_0px_#000] hover:scale-105 transition-transform">
                                        <UploadCloud className="w-7 h-7 text-black stroke-[2.5]" />
                                    </div>
                                    <div className="space-y-1 max-w-md mx-auto">
                                        <p className="text-sm sm:text-base font-black text-black">
                                            Drag and drop your banner image here
                                        </p>
                                        <p className="text-xs text-neutral-600 font-medium">
                                            or click anywhere in this block to browse your device
                                        </p>
                                    </div>
                                    <div className="flex items-center justify-center gap-2 text-[11px] font-bold text-neutral-600">
                                        <span className="px-2 py-0.5 rounded bg-white border border-black/20 shadow-[1px_1px_0px_#000] font-mono">.PNG</span>
                                        <span className="px-2 py-0.5 rounded bg-white border border-black/20 shadow-[1px_1px_0px_#000] font-mono">.JPG</span>
                                        <span className="px-2 py-0.5 rounded bg-white border border-black/20 shadow-[1px_1px_0px_#000] font-mono">.WEBP</span>
                                        <span>• Up to 5 MB</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Action Bar */}
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
                            <p className="text-xs text-neutral-600 font-medium flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>Securely processed and stored via Cloudinary storage</span>
                            </p>
                            {!coverImageUrl && (
                                <button
                                    type="button"
                                    onClick={() => coverInputRef.current?.click()}
                                    disabled={isUploadingCover}
                                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-[#FFE566] hover:bg-[#ffe043] text-black text-xs sm:text-sm font-black uppercase tracking-wider border-2 border-black shadow-[4px_4px_0px_#000] hover:shadow-[1px_1px_0px_#000] hover:translate-x-[2px] hover:translate-y-[2px] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    <UploadCloud className="w-4 h-4 stroke-[2.5]" />
                                    <span>BROWSE & UPLOAD BANNER</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 3: ABOUT STORY, MISSION & FOCUS AREAS */}
            {activeSection === "about" && (
                <div className="p-6 sm:p-7 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                    <div className="pb-4 border-b border-black/10">
                        <h3 className="text-base font-black text-black">About the Club & Narrative</h3>
                        <p className="text-xs font-medium text-neutral-600 mt-0.5">
                            Rich Markdown description, mission & vision statements, and core technology/domain focus areas.
                        </p>
                    </div>

                    {/* Rich Markdown Editor for About */}
                    <div className="space-y-1.5">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            About Club Story (Markdown Supported) *
                        </label>
                        <ClubMarkdownEditor value={about} onChange={setAbout} />
                        <span className="text-[10px] text-neutral-500 block mt-1">
                            Supports bold, italics, headings, bullet lists, markdown tables, quotes, and links.
                        </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-black/10">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                                Mission Statement
                            </label>
                            <textarea
                                rows={3}
                                value={mission}
                                onChange={(e) => setMission(e.target.value)}
                                placeholder="What is your club's primary purpose and commitment to students?"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium text-black focus:bg-white focus:outline-hidden resize-none"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                                Vision Statement
                            </label>
                            <textarea
                                rows={3}
                                value={vision}
                                onChange={(e) => setVision(e.target.value)}
                                placeholder="Where do you see the club in 3-5 years? What impact do you seek?"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium text-black focus:bg-white focus:outline-hidden resize-none"
                            />
                        </div>
                    </div>

                    {/* Focus Areas Tag Selector */}
                    <div className="space-y-2 pt-3 border-t border-black/10">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            Focus Areas & Topics
                        </label>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={newTagInput}
                                onChange={(e) => setNewTagInput(e.target.value)}
                                onKeyDown={handleAddFocusArea}
                                placeholder="e.g. Competitive Programming, Cloud, UI/UX, Rust, System Design..."
                                className="w-full max-w-md px-3.5 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                            />
                            <button
                                type="button"
                                onClick={handleAddFocusArea}
                                className="px-4 py-2 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-800 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer"
                            >
                                + Add Tag
                            </button>
                        </div>

                        {/* Tag Pills */}
                        <div className="flex flex-wrap gap-2 pt-2">
                            {focusAreas.map((tag) => (
                                <span
                                    key={tag}
                                    className="px-3 py-1 rounded-full bg-[#FAF6EE] border-2 border-black text-xs font-black text-black shadow-[1px_1px_0px_#000] flex items-center gap-2"
                                >
                                    <span>#{tag}</span>
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveFocusArea(tag)}
                                        className="text-neutral-500 hover:text-red-600 font-bold cursor-pointer"
                                    >
                                        ×
                                    </button>
                                </span>
                            ))}
                            {focusAreas.length === 0 && (
                                <span className="text-xs text-neutral-400 italic">No focus tags added yet.</span>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 4: COORDINATORS */}
            {activeSection === "coordinators" && (
                <div className="p-6 sm:p-7 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000]">
                    <ClubCoordinatorsManager
                        clubId={club.id}
                        coordinators={coordinators}
                        canManage={canManage}
                        onUpdate={loadProfile}
                    />
                </div>
            )}

            {/* SECTION 5: ORGANISATION DETAILS & CONTACT */}
            {activeSection === "organisation" && (
                <div className="p-6 sm:p-7 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                    <div className="pb-4 border-b border-black/10">
                        <h3 className="text-base font-black text-black">Organisation Affiliation & Official Contacts</h3>
                        <p className="text-xs font-medium text-neutral-600 mt-0.5">
                            Verified collegiate institution details and official chapter communication channels.
                        </p>
                    </div>

                    {/* Verified Institution Details Card (Read-only verified badge) */}
                    <div className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-start gap-3">
                        <Building2 className="w-5 h-5 text-black shrink-0 mt-0.5" />
                        <div className="space-y-1">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="text-xs font-black text-black">Affiliated College / University</h4>
                                <span className="px-2 py-0.5 rounded-full bg-[#a2ff86] border border-black text-[9px] font-black text-black">
                                    Verified
                                </span>
                            </div>
                            <p className="text-xs font-bold text-neutral-800">{club.collegeName}</p>
                            <p className="text-[11px] font-medium text-neutral-600">
                                {club.collegeCity}, {club.collegeState}, {club.collegeCountry}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                                Public Contact Email
                            </label>
                            <div className="relative flex items-center">
                                <Mail className="w-4 h-4 text-neutral-500 absolute left-3" />
                                <input
                                    type="email"
                                    value={publicEmail}
                                    onChange={(e) => setPublicEmail(e.target.value)}
                                    placeholder="contact@myclub.org or lead@college.edu"
                                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                                />
                            </div>
                            <span className="text-[10px] text-neutral-500 mt-1 block">Displayed on public profile for student inquiries.</span>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                                Contact Phone / WhatsApp
                            </label>
                            <div className="relative flex items-center">
                                <Phone className="w-4 h-4 text-neutral-500 absolute left-3" />
                                <input
                                    type="tel"
                                    value={contactPhone}
                                    onChange={(e) => setContactPhone(e.target.value)}
                                    placeholder="+91 98765 43210"
                                    className="w-full pl-9 pr-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 6: ONLINE PRESENCE & CHANNELS */}
            {activeSection === "online" && (
                <div className="p-6 sm:p-7 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                    <div className="pb-4 border-b border-black/10">
                        <h3 className="text-base font-black text-black">Online Presence & Community Channels</h3>
                        <p className="text-xs font-medium text-neutral-600 mt-0.5">
                            Connect your official website, code repositories, social accounts, and Discord server.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                Official Website URL
                            </label>
                            <input
                                type="url"
                                value={websiteUrl}
                                onChange={(e) => setWebsiteUrl(e.target.value)}
                                placeholder="https://gdsc.community.dev"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                GitHub Organization URL
                            </label>
                            <input
                                type="url"
                                value={socialGithub}
                                onChange={(e) => setSocialGithub(e.target.value)}
                                placeholder="https://github.com/myclub"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                LinkedIn Page URL
                            </label>
                            <input
                                type="url"
                                value={socialLinkedin}
                                onChange={(e) => setSocialLinkedin(e.target.value)}
                                placeholder="https://linkedin.com/company/myclub"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                Instagram Profile URL
                            </label>
                            <input
                                type="url"
                                value={socialInstagram}
                                onChange={(e) => setSocialInstagram(e.target.value)}
                                placeholder="https://instagram.com/myclub"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                X / Twitter Profile URL
                            </label>
                            <input
                                type="url"
                                value={socialX}
                                onChange={(e) => setSocialX(e.target.value)}
                                placeholder="https://x.com/myclub"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                Discord Community Invite URL
                            </label>
                            <input
                                type="url"
                                value={socialDiscord}
                                onChange={(e) => setSocialDiscord(e.target.value)}
                                placeholder="https://discord.gg/..."
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                YouTube Channel URL
                            </label>
                            <input
                                type="url"
                                value={socialYoutube}
                                onChange={(e) => setSocialYoutube(e.target.value)}
                                placeholder="https://youtube.com/@myclub"
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* SECTION 7: ACHIEVEMENTS */}
            {activeSection === "achievements" && (
                <div className="p-6 sm:p-7 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000]">
                    <ClubAchievementsManager
                        clubId={club.id}
                        achievements={achievements}
                        canManage={canManage}
                        onUpdate={loadProfile}
                    />
                </div>
            )}

            {/* SECTION 8: MEMBERSHIP & RECRUITMENT */}
            {activeSection === "recruitment" && (
                <div className="p-6 sm:p-7 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                    <div className="pb-4 border-b border-black/10">
                        <h3 className="text-base font-black text-black">Membership & Recruitment Drive</h3>
                        <p className="text-xs font-medium text-neutral-600 mt-0.5">
                            Publish seasonal auditions, member recruitment calls, and direct candidate application forms.
                        </p>
                    </div>

                    {/* Recruitment Status Radio Buttons */}
                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-2">
                            Recruitment Status
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                                { val: "open", label: "Applications Open", color: "bg-[#a2ff86]", desc: "Students can apply immediately" },
                                { val: "upcoming", label: "Auditions Upcoming", color: "bg-[#FFE566]", desc: "Recruitment opening soon" },
                                { val: "closed", label: "Recruitment Closed", color: "bg-neutral-200", desc: "No active member drive" },
                            ].map((item) => {
                                const selected = recruitmentStatus === item.val;
                                return (
                                    <button
                                        key={item.val}
                                        type="button"
                                        onClick={() => setRecruitmentStatus(item.val as any)}
                                        className={`p-3.5 rounded-xl border-2 border-black text-left transition-all cursor-pointer ${
                                            selected
                                                ? "bg-black text-white shadow-[2px_2px_0px_#000]"
                                                : "bg-[#FAF6EE] text-black hover:bg-white"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black">{item.label}</span>
                                            {selected && <Check className="w-3.5 h-3.5 text-[#a2ff86]" />}
                                        </div>
                                        <p
                                            className={`text-[10px] font-medium mt-1 leading-snug ${
                                                selected ? "text-neutral-300" : "text-neutral-600"
                                            }`}
                                        >
                                            {item.desc}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                            Application Form URL (Google Forms, Typeform, etc.)
                        </label>
                        <input
                            type="url"
                            value={recruitmentUrl}
                            onChange={(e) => setRecruitmentUrl(e.target.value)}
                            placeholder="https://forms.gle/... or https://typeform.com/..."
                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                            Recruitment Announcement / Instructions
                        </label>
                        <textarea
                            rows={3}
                            value={recruitmentAnnouncement}
                            onChange={(e) => setRecruitmentAnnouncement(e.target.value)}
                            placeholder="e.g. Fall 2026 developer auditions are now live! We're recruiting Frontend, Backend, AI/ML, and Event leads..."
                            className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-medium text-black focus:bg-white focus:outline-hidden resize-none"
                        />
                    </div>
                </div>
            )}

            {/* SECTION 9: VISIBILITY & PUBLISHING */}
            {activeSection === "visibility" && (
                <div className="p-6 sm:p-7 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                    <div className="pb-4 border-b border-black/10">
                        <h3 className="text-base font-black text-black">Publication & Showcase Visibility</h3>
                        <p className="text-xs font-medium text-neutral-600 mt-0.5">
                            Control whether your club profile is publicly indexed, in draft mode, or restricted to members.
                        </p>
                    </div>

                    {/* Publication Status */}
                    <div className="space-y-3">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            Publication Lifecycle Status
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                            {[
                                {
                                    val: "published",
                                    label: "Published (Live)",
                                    badge: "bg-[#a2ff86]",
                                    desc: "Visible to all collegiate students, external visitors, and search engines.",
                                },
                                {
                                    val: "draft",
                                    label: "Draft Mode",
                                    badge: "bg-[#FFE566]",
                                    desc: "Only authorized club managers can preview. Hidden from public listings.",
                                },
                                {
                                    val: "hidden",
                                    label: "Hidden / Archived",
                                    badge: "bg-neutral-200",
                                    desc: "Temporarily deactivated. Cannot be viewed by external visitors.",
                                },
                            ].map((item) => {
                                const isSelected = publicationStatus === item.val;
                                return (
                                    <button
                                        key={item.val}
                                        type="button"
                                        onClick={() => setPublicationStatus(item.val as any)}
                                        className={`p-4 rounded-xl border-2 border-black text-left transition-all cursor-pointer ${
                                            isSelected
                                                ? "bg-black text-white shadow-[3px_3px_0px_#000]"
                                                : "bg-[#FAF6EE] text-black hover:bg-white"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black">{item.label}</span>
                                            {isSelected && <Check className="w-4 h-4 text-[#a2ff86]" />}
                                        </div>
                                        <p
                                            className={`text-[11px] font-medium mt-1.5 leading-relaxed ${
                                                isSelected ? "text-neutral-300" : "text-neutral-600"
                                            }`}
                                        >
                                            {item.desc}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Profile Visibility */}
                    <div className="space-y-3 pt-3 border-t border-black/10">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            Profile Visibility
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                            {[
                                {
                                    val: "public",
                                    label: "Public",
                                    desc: "Anyone with the link or browsing the Orbix Club Directory can view.",
                                },
                                {
                                    val: "unlisted",
                                    label: "Unlisted",
                                    desc: "Only accessible to users who possess the direct link.",
                                },
                                {
                                    val: "private",
                                    label: "Private",
                                    desc: "Restricted exclusively to accepted chapter members.",
                                },
                            ].map((item) => {
                                const isSelected = profileVisibility === item.val;
                                return (
                                    <button
                                        key={item.val}
                                        type="button"
                                        onClick={() => setProfileVisibility(item.val as any)}
                                        className={`p-4 rounded-xl border-2 border-black text-left transition-all cursor-pointer ${
                                            isSelected
                                                ? "bg-black text-white shadow-[3px_3px_0px_#000]"
                                                : "bg-[#FAF6EE] text-black hover:bg-white"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <span className="text-xs font-black">{item.label}</span>
                                            {isSelected && <Check className="w-4 h-4 text-[#a2ff86]" />}
                                        </div>
                                        <p
                                            className={`text-[11px] font-medium mt-1.5 leading-relaxed ${
                                                isSelected ? "text-neutral-300" : "text-neutral-600"
                                            }`}
                                        >
                                            {item.desc}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </div>
            )}

            {/* Centered Bottom Save Changes Button */}
            {canManage && (
                <div className="pt-6 pb-6 flex justify-center items-center">
                    <button
                        type="button"
                        onClick={() => handleSaveProfile()}
                        disabled={isSaving || !hasChanges}
                        className={`px-8 py-3 rounded-xl border-2 border-black text-sm font-black shadow-[3px_3px_0px_#000] flex items-center justify-center gap-2 transition-all ${
                            hasChanges
                                ? "bg-[#a2ff86] text-black hover:bg-[#8ee675] cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                                : "bg-neutral-100 text-neutral-400 cursor-not-allowed opacity-75"
                        }`}
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>Saving Changes...</span>
                            </>
                        ) : (
                            <>
                                <Save className="w-4 h-4" />
                                <span>{hasChanges ? "Save Changes" : "Saved"}</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};
