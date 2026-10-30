import React, { useState, useEffect, useMemo, useRef } from "react";
import {
    Save,
    ExternalLink,
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
} from "lucide-react";
import type { ClubProfileData, ClubCoordinator, ClubAchievement } from "../../../utils/clubProfileApi";
import {
    fetchClubFullProfile,
    updateClubProfile,
    requestClubUploadSignature,
    uploadClubImageToCloudinary,
} from "../../../utils/clubProfileApi";
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

    // Data states
    const [loading, setLoading] = useState(true);
    const [club, setClub] = useState<ClubProfileData | null>(null);
    const [coordinators, setCoordinators] = useState<ClubCoordinator[]>([]);
    const [achievements, setAchievements] = useState<ClubAchievement[]>([]);
    const [permissions, setPermissions] = useState<any>(null);
    const [completion, setCompletion] = useState<{ percentage: number; missingItems: string[] }>({
        percentage: 0,
        missingItems: [],
    });

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

    const logoInputRef = useRef<HTMLInputElement>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);

    // Initial snapshot for change detection
    const initialSnapshotRef = useRef<string>("");

    const loadProfile = async () => {
        try {
            setLoading(true);
            const data = await fetchClubFullProfile(clubId);
            const c = data.club;
            setClub(c);
            setCoordinators(data.coordinators || []);
            setAchievements(data.achievements || []);
            setPermissions(data.permissions);
            setCompletion(data.completion || { percentage: 0, missingItems: [] });

            // Initialize form states
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
            setSocialX(s.x || s.twitter || "");
            setSocialDiscord(s.discord || "");
            setSocialYoutube(s.youtube || "");

            setRecruitmentStatus(c.recruitmentStatus || "closed");
            setRecruitmentAnnouncement(c.recruitmentAnnouncement || "");
            setRecruitmentUrl(c.recruitmentUrl || "");
            setPublicationStatus(c.publicationStatus || "published");
            setProfileVisibility(c.profileVisibility || "public");

            initialSnapshotRef.current = JSON.stringify({
                name: c.name || "",
                slug: c.slug || "",
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
        } catch (err: any) {
            console.error("Load club profile error:", err);
            toast.error(err.message || "Failed to load club profile.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadProfile();
    }, [clubId]);

    // Check if form has unsaved modifications
    const hasChanges = useMemo(() => {
        if (!initialSnapshotRef.current) return false;
        const current = JSON.stringify({
            name,
            slug,
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
        slug,
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
    const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !club) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file (PNG, JPG, WEBP).");
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
            toast.success("Club logo uploaded! Click 'Save Changes' to apply.");
        } catch (err: any) {
            console.error("Upload error:", err);
            toast.error(err.message || "Failed to upload logo.");
        } finally {
            setIsUploadingLogo(false);
            setLogoUploadPercent(null);
            if (logoInputRef.current) logoInputRef.current.value = "";
        }
    };

    // Direct Cloudinary upload for Club Cover Banner
    const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !club) return;

        if (!file.type.startsWith("image/")) {
            toast.error("Please select an image file (PNG, JPG, WEBP).");
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
            toast.success("Header banner uploaded! Click 'Save Changes' to apply.");
        } catch (err: any) {
            console.error("Upload error:", err);
            toast.error(err.message || "Failed to upload header banner.");
        } finally {
            setIsUploadingCover(false);
            setCoverUploadPercent(null);
            if (coverInputRef.current) coverInputRef.current.value = "";
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
                slug: slug.trim().toLowerCase(),
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

            const updatedData = await updateClubProfile(payload, club.id);
            setClub(updatedData.club);
            setCompletion(updatedData.completion);
            initialSnapshotRef.current = JSON.stringify({
                name: updatedData.club.name,
                slug: updatedData.club.slug,
                category: updatedData.club.category,
                shortDescription: updatedData.club.shortDescription || "",
                about: updatedData.club.about || "",
                mission: updatedData.club.mission || "",
                vision: updatedData.club.vision || "",
                foundedYear: updatedData.club.foundedYear ? String(updatedData.club.foundedYear) : "",
                operatingStatus: updatedData.club.operatingStatus,
                focusAreas: updatedData.club.focusAreas || [],
                logoUrl: updatedData.club.logoUrl || "",
                coverImageUrl: updatedData.club.coverImageUrl || "",
                publicEmail: updatedData.club.publicEmail || "",
                contactPhone: updatedData.club.contactPhone || "",
                websiteUrl: updatedData.club.websiteUrl || "",
                socialLinks: updatedData.club.socialLinks || {},
                recruitmentStatus: updatedData.club.recruitmentStatus,
                recruitmentAnnouncement: updatedData.club.recruitmentAnnouncement || "",
                recruitmentUrl: updatedData.club.recruitmentUrl || "",
                publicationStatus: updatedData.club.publicationStatus,
                profileVisibility: updatedData.club.profileVisibility,
            });

            toast.success("Club profile updated and published successfully!", {
                title: "Profile Saved",
            });

            if (onProfileUpdated) onProfileUpdated();
        } catch (err: any) {
            console.error("Save profile error:", err);
            toast.error(err.message || "Failed to update club profile.", {
                title: "Update Error",
            });
        } finally {
            setIsSaving(false);
        }
    };

    if (loading) {
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
                            <span className="px-2 py-0.5 rounded-full bg-[#a2ff86] border border-black text-[10px] font-black text-black shadow-[1px_1px_0px_#000]">
                                Verified Chapter
                            </span>
                            <span
                                className={`px-2 py-0.5 rounded-full border border-black text-[10px] font-black shadow-[1px_1px_0px_#000] ${
                                    publicationStatus === "published"
                                        ? "bg-black text-[#a2ff86]"
                                        : publicationStatus === "draft"
                                        ? "bg-[#FFE566] text-black"
                                        : "bg-neutral-200 text-neutral-800"
                                }`}
                            >
                                {publicationStatus === "published" ? "Live & Published" : publicationStatus === "draft" ? "Draft Mode" : "Hidden"}
                            </span>
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

                    {/* Preview Button */}
                    <a
                        href={`/clubs/${slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3.5 py-2.5 rounded-xl bg-white text-black hover:bg-neutral-100 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Public Preview</span>
                    </a>

                    {/* Save Changes Button */}
                    {canManage && (
                        <button
                            type="button"
                            onClick={() => handleSaveProfile()}
                            disabled={isSaving || !hasChanges}
                            className={`px-5 py-2.5 rounded-xl border-2 border-black text-xs font-black shadow-[3px_3px_0px_#000] flex items-center justify-center gap-1.5 transition-all ${
                                hasChanges
                                    ? "bg-black text-[#a2ff86] hover:bg-neutral-800 cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                                    : "bg-neutral-100 text-neutral-400 cursor-not-allowed opacity-75"
                            }`}
                        >
                            {isSaving ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <>
                                    <Save className="w-3.5 h-3.5" />
                                    <span>{hasChanges ? "Save Changes" : "Saved"}</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>

            {/* Missing items helper banner if incomplete */}
            {completion.missingItems.length > 0 && (
                <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center gap-2.5">
                    <Info className="w-4 h-4 text-black shrink-0" />
                    <p className="text-xs font-bold text-neutral-800 flex-1">
                        <span className="font-black text-black">Recommended for 100% showcase strength:</span>{" "}
                        {completion.missingItems.slice(0, 3).join(", ")}
                        {completion.missingItems.length > 3 && ` +${completion.missingItems.length - 3} more`}
                    </p>
                </div>
            )}

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
                        <div>
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
                                Club Username / Public Slug *
                            </label>
                            <div className="relative flex items-center">
                                <span className="absolute left-3 text-xs font-mono font-bold text-neutral-500">
                                    orbix.in/clubs/
                                </span>
                                <input
                                    type="text"
                                    required
                                    value={slug}
                                    onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                                    placeholder="gdsc-aec"
                                    className="w-full pl-28 pr-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-mono font-bold text-black focus:bg-white focus:outline-hidden"
                                />
                            </div>
                            <span className="text-[10px] text-neutral-500 mt-1 block">
                                Lowercase alphanumeric with hyphens. Used in public sharing URLs.
                            </span>
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
                <div className="p-6 sm:p-7 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                    <div className="pb-4 border-b border-black/10">
                        <h3 className="text-base font-black text-black">Branding & Media Assets</h3>
                        <p className="text-xs font-medium text-neutral-600 mt-0.5">
                            Upload your official chapter logo and custom header banner directly via secure Cloudinary storage.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                        {/* Club Official Logo */}
                        <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-wider text-black">Club Logo (Square / Circular)</h4>
                            <div className="flex items-center gap-4">
                                <div className="w-20 h-20 rounded-2xl bg-white border-2 border-black overflow-hidden shrink-0 flex items-center justify-center font-black text-base shadow-[2px_2px_0px_#000]">
                                    {logoUrl ? (
                                        <img src={logoUrl} alt="Logo" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-neutral-400">No Logo</span>
                                    )}
                                </div>
                                <div className="space-y-2 flex-1">
                                    <input
                                        type="file"
                                        ref={logoInputRef}
                                        onChange={handleLogoUpload}
                                        accept="image/png,image/jpeg,image/webp"
                                        className="hidden"
                                    />
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            disabled={isUploadingLogo}
                                            onClick={() => logoInputRef.current?.click()}
                                            className="px-3 py-1.5 rounded-lg bg-black text-[#a2ff86] border border-black text-xs font-black shadow-[1px_1px_0px_#000] hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                        >
                                            {isUploadingLogo ? (
                                                <>
                                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    <span>Uploading {logoUploadPercent !== null ? `${logoUploadPercent}%` : ""}</span>
                                                </>
                                            ) : (
                                                <>
                                                    <UploadCloud className="w-3.5 h-3.5" />
                                                    <span>Upload Logo</span>
                                                </>
                                            )}
                                        </button>
                                        {logoUrl && (
                                            <button
                                                type="button"
                                                onClick={() => setLogoUrl("")}
                                                className="px-2.5 py-1.5 rounded-lg bg-white text-red-600 border border-black text-xs font-bold hover:bg-red-50 cursor-pointer"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                    <p className="text-[10px] text-neutral-500">Recommended: 400x400 PNG or WEBP with transparent background.</p>
                                </div>
                            </div>
                        </div>

                        {/* Club Header Banner */}
                        <div className="p-5 rounded-2xl bg-[#FAF6EE] border-2 border-black space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-wider text-black">Header Showcase Banner</h4>
                            <div className="space-y-3">
                                <div className="w-full h-24 rounded-xl bg-white border-2 border-black overflow-hidden relative shadow-[2px_2px_0px_#000] flex items-center justify-center">
                                    {coverImageUrl ? (
                                        <img src={coverImageUrl} alt="Banner" className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-xs font-bold text-neutral-400">Default Geometric Banner</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="file"
                                        ref={coverInputRef}
                                        onChange={handleCoverUpload}
                                        accept="image/png,image/jpeg,image/webp"
                                        className="hidden"
                                    />
                                    <button
                                        type="button"
                                        disabled={isUploadingCover}
                                        onClick={() => coverInputRef.current?.click()}
                                        className="px-3 py-1.5 rounded-lg bg-black text-[#a2ff86] border border-black text-xs font-black shadow-[1px_1px_0px_#000] hover:bg-neutral-800 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                    >
                                        {isUploadingCover ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                <span>Uploading {coverUploadPercent !== null ? `${coverUploadPercent}%` : ""}</span>
                                            </>
                                        ) : (
                                            <>
                                                <UploadCloud className="w-3.5 h-3.5" />
                                                <span>Upload Banner</span>
                                            </>
                                        )}
                                    </button>
                                    {coverImageUrl && (
                                        <button
                                            type="button"
                                            onClick={() => setCoverImageUrl("")}
                                            className="px-2.5 py-1.5 rounded-lg bg-white text-red-600 border border-black text-xs font-bold hover:bg-red-50 cursor-pointer"
                                        >
                                            Reset to Default
                                        </button>
                                    )}
                                </div>
                                <p className="text-[10px] text-neutral-500">Recommended: 1200x400 JPG or WEBP (3:1 ratio).</p>
                            </div>
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

            {/* Bottom Save Bar (Sticky or bottom helper) */}
            {hasChanges && (
                <div className="p-4 rounded-xl bg-black text-white border-2 border-black shadow-[4px_4px_0px_#000] flex items-center justify-between gap-4 animate-in slide-in-from-bottom-2 duration-150">
                    <div className="flex items-center gap-2 text-xs font-bold">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#FFE566] animate-pulse" />
                        <span>You have unsaved changes in your club profile.</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => handleSaveProfile()}
                        disabled={isSaving}
                        className="px-5 py-2 rounded-lg bg-[#a2ff86] text-black hover:bg-[#8ee675] border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5"
                    >
                        {isSaving ? (
                            <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Saving Changes...</span>
                            </>
                        ) : (
                            <>
                                <Save className="w-3.5 h-3.5" />
                                <span>Save Changes</span>
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    );
};
