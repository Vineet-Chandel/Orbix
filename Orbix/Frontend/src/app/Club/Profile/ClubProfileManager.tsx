import React, { useState, useEffect, useMemo, useRef } from "react";
import {
    Save,
    Check,
    ArrowLeft,
    ArrowRight,
    Plus,
} from "lucide-react";
import type { ClubProfileData, ClubLink, ClubVisibilityTier } from "../../../utils/clubProfileApi";
import { useAppDispatch, useAppSelector, fetchClubProfile, saveClubProfile } from "../../../store";
import { useToast } from "../../../context/ToastContext";
import { StepIdentity } from "./StepIdentity";
import { StepBrandStory } from "./StepBrandStory";
import { StepPeopleContact } from "./StepPeopleContact";
import { StepLinksAchievements } from "./StepLinksAchievements";
import { StepRecruitmentPublishing } from "./StepRecruitmentPublishing";
import { ProfilePreviewModal } from "./ProfilePreviewModal";
import { PublishValidationModal } from "./PublishValidationModal";

interface ClubProfileManagerProps {
    clubId?: string;
    onProfileUpdated?: (updatedClub?: any) => void;
}

export const ClubProfileManager: React.FC<ClubProfileManagerProps> = ({
    clubId,
    onProfileUpdated,
}) => {
    const toast = useToast();
    const dispatch = useAppDispatch();
    const clubState = useAppSelector((state) => state.club);

    // Redux state
    const club = clubState.club;
    const coordinators = clubState.coordinators;
    const achievements = clubState.achievements;
    const permissions = clubState.permissions;
    const completion = clubState.completion;

    // Navigation Step state (1 to 5)
    const [currentStep, setCurrentStep] = useState<number>(1);

    // Form fields state
    // Step 1: Identity
    const [name, setName] = useState("");
    const [category, setCategory] = useState("Technical & Coding");
    const [foundedYear, setFoundedYear] = useState<string>("");
    const [operatingStatus, setOperatingStatus] = useState<"active" | "on_hiatus" | "inactive">("active");

    // Step 2: Brand & Story
    const [logoUrl, setLogoUrl] = useState("");
    const [coverImageUrl, setCoverImageUrl] = useState("");
    const [about, setAbout] = useState("");
    const [tagline, setTagline] = useState("");
    const [focusAreas, setFocusAreas] = useState<string[]>([]);

    // Step 3: People & Contact
    const [publicEmail, setPublicEmail] = useState("");
    const [contactPhone, setContactPhone] = useState("");

    // Step 4: Links & Achievements
    const [links, setLinks] = useState<ClubLink[]>([]);

    // Step 5: Recruitment & Publishing
    const [recruitmentStatus, setRecruitmentStatus] = useState<"open" | "upcoming" | "closed">("closed");
    const [recruitmentAnnouncement, setRecruitmentAnnouncement] = useState("");
    const [recruitmentUrl, setRecruitmentUrl] = useState("");
    const [visibility, setVisibility] = useState<ClubVisibilityTier>("draft");

    // UI & Action states
    const [isSaving, setIsSaving] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
    const [validationMissingItems, setValidationMissingItems] = useState<string[]>([]);

    // Profile sections breakdown for completeness scoring and direct step-navigation
    const profileSections = useMemo(() => [
        {
            id: "name",
            label: "Club Identity & Name",
            description: "Official chapter title (min 2 characters)",
            stepId: 1,
            isRequired: true,
            isCompleted: Boolean(name.trim().length >= 2),
        },
        {
            id: "category",
            label: "Primary Category",
            description: "Specialized domain (Coding, Robotics, etc.)",
            stepId: 1,
            isRequired: true,
            isCompleted: Boolean(category.trim()),
        },
        {
            id: "college",
            label: "College Affiliation",
            description: "Verified institutional directory link",
            stepId: 1,
            isRequired: true,
            isCompleted: Boolean(club?.collegeName || club?.collegeId),
        },
        {
            id: "status",
            label: "Operating Status & Era",
            description: "Active chapter status & founded year",
            stepId: 1,
            isRequired: false,
            isCompleted: Boolean(operatingStatus && foundedYear),
        },
        {
            id: "about",
            label: "Chapter Story & About",
            description: "Comprehensive narrative (20+ characters)",
            stepId: 2,
            isRequired: true,
            isCompleted: Boolean(about.trim().length >= 20),
        },
        {
            id: "branding",
            label: "Logo & Showcase Banner",
            description: "High-resolution avatar & cover assets",
            stepId: 2,
            isRequired: false,
            isCompleted: Boolean(logoUrl || coverImageUrl),
        },
        {
            id: "coordinators",
            label: "Student Leads & Roster",
            description: "Appointed student coordinators & leads",
            stepId: 3,
            isRequired: false,
            isCompleted: Boolean(coordinators && coordinators.length > 0),
        },
        {
            id: "contact",
            label: "Contact & Social Channels",
            description: "Public contact email & verified handles",
            stepId: 4,
            isRequired: false,
            isCompleted: Boolean(publicEmail || (links && links.length > 0)),
        },
        {
            id: "publishing",
            label: "Recruitment & Publishing",
            description: "Auditions drive & public showcase tier",
            stepId: 5,
            isRequired: false,
            isCompleted: Boolean(recruitmentStatus && (visibility === "public" || visibility === "unlisted")),
        },
    ], [
        name,
        category,
        club?.collegeName,
        club?.collegeId,
        operatingStatus,
        foundedYear,
        about,
        logoUrl,
        coverImageUrl,
        coordinators,
        publicEmail,
        links,
        recruitmentStatus,
        visibility,
    ]);

    const completedCount = useMemo(() => {
        return profileSections.filter((s) => s.isCompleted).length;
    }, [profileSections]);

    const displayPercentage = useMemo(() => {
        const calculated = Math.round((completedCount / profileSections.length) * 100);
        return Math.max(completion?.percentage || 0, calculated);
    }, [completedCount, profileSections.length, completion?.percentage]);

    const completionBadge = useMemo(() => {
        if (displayPercentage >= 100) {
            return {
                label: "Fully Complete",
                bg: "bg-[#a2ff86]",
                text: "text-black",
            };
        }
        if (displayPercentage >= 70) {
            return {
                label: "Almost Ready",
                bg: "bg-[#FFE566]",
                text: "text-black",
            };
        }
        if (displayPercentage >= 40) {
            return {
                label: "In Progress",
                bg: "bg-[#FFE566]",
                text: "text-black",
            };
        }
        return {
            label: "Getting Started",
            bg: "bg-neutral-100",
            text: "text-neutral-700",
        };
    }, [displayPercentage]);

    // Snapshot for dirty-state tracking
    const initialSnapshotRef = useRef<string>("");
    const hasPopulatedForClubIdRef = useRef<string | null>(null);

    // Synchronize form from club data
    const populateForm = (c: ClubProfileData) => {
        hasPopulatedForClubIdRef.current = c.id || clubId || null;
        setName(c.name || "");
        setCategory(c.category || "Technical & Coding");
        setFoundedYear(c.foundedYear ? String(c.foundedYear) : "");

        const rawOp = (c.operatingStatus || "active").toLowerCase();
        setOperatingStatus(rawOp === "hiatus" ? "on_hiatus" : rawOp === "recruiting" ? "active" : (rawOp as any));

        setLogoUrl(c.logoUrl || "");
        setCoverImageUrl(c.coverImageUrl || "");
        setAbout(c.about || "");
        setTagline(c.shortDescription || "");
        setFocusAreas(Array.isArray(c.focusAreas) ? c.focusAreas : []);

        setPublicEmail(c.publicEmail || "");
        setContactPhone(c.contactPhone || "");

        // Synthesize links if empty
        if (Array.isArray(c.links) && c.links.length > 0) {
            setLinks(c.links);
        } else {
            const synth: ClubLink[] = [];
            let ord = 0;
            if (c.websiteUrl) {
                synth.push({ id: `synth-web`, platform: "website", url: c.websiteUrl, label: "Official Website", displayOrder: ord++ });
            }
            const s = c.socialLinks || {};
            for (const [k, v] of Object.entries(s)) {
                if (v && typeof v === "string" && v.trim().length > 0) {
                    const plat = k.toLowerCase() === "twitter" ? "x" : k.toLowerCase();
                    synth.push({ id: `synth-${plat}`, platform: plat, url: v.trim(), displayOrder: ord++ });
                }
            }
            setLinks(synth);
        }

        setRecruitmentStatus(c.recruitmentStatus || "closed");
        setRecruitmentAnnouncement(c.recruitmentAnnouncement || "");
        setRecruitmentUrl(c.recruitmentUrl || "");

        // Visibility tier
        let vis = c.visibility;
        if (!vis) {
            vis = c.publicationStatus === "published"
                ? ((c.profileVisibility as any) || "public")
                : (c.publicationStatus === "hidden" ? "archived" : "draft");
        }
        setVisibility(vis);

        initialSnapshotRef.current = JSON.stringify({
            name: c.name || "",
            category: c.category || "Technical & Coding",
            foundedYear: c.foundedYear ? String(c.foundedYear) : "",
            operatingStatus: rawOp === "hiatus" ? "on_hiatus" : rawOp === "recruiting" ? "active" : rawOp,
            logoUrl: c.logoUrl || "",
            coverImageUrl: c.coverImageUrl || "",
            about: c.about || "",
            tagline: c.shortDescription || "",
            focusAreas: Array.isArray(c.focusAreas) ? c.focusAreas : [],
            publicEmail: c.publicEmail || "",
            contactPhone: c.contactPhone || "",
            links: Array.isArray(c.links) ? c.links : [],
            recruitmentStatus: c.recruitmentStatus || "closed",
            recruitmentAnnouncement: c.recruitmentAnnouncement || "",
            recruitmentUrl: c.recruitmentUrl || "",
            visibility: vis,
        });
    };

    // Load profile on mount or club change
    useEffect(() => {
        if (hasPopulatedForClubIdRef.current !== clubId) {
            if (!clubState.isInitialized && !clubState.loading) {
                dispatch(fetchClubProfile({ clubId }))
                    .unwrap()
                    .then((data) => {
                        if (data?.club) populateForm(data.club);
                    })
                    .catch((err) => toast.error(err || "Failed to load club profile."));
            } else if (clubState.club && clubState.club.id === clubId) {
                populateForm(clubState.club);
            }
        }
    }, [clubId, clubState.isInitialized, clubState.loading, clubState.club]);

    // Check if form is dirty
    const isDirty = useMemo(() => {
        if (!initialSnapshotRef.current) return false;
        const currentSnapshot = JSON.stringify({
            name,
            category,
            foundedYear,
            operatingStatus,
            logoUrl,
            coverImageUrl,
            about,
            tagline,
            focusAreas,
            publicEmail,
            contactPhone,
            links,
            recruitmentStatus,
            recruitmentAnnouncement,
            recruitmentUrl,
            visibility,
        });
        return currentSnapshot !== initialSnapshotRef.current;
    }, [
        name,
        category,
        foundedYear,
        operatingStatus,
        logoUrl,
        coverImageUrl,
        about,
        tagline,
        focusAreas,
        publicEmail,
        contactPhone,
        links,
        recruitmentStatus,
        recruitmentAnnouncement,
        recruitmentUrl,
        visibility,
    ]);

    // Client-side publishing requirements checklist
    const checkPublishRequirements = (): { valid: boolean; missing: string[] } => {
        const missing: string[] = [];
        if (!name.trim() || name.trim().length < 2) {
            missing.push("Official Club Name (minimum 2 characters)");
        }
        if (!category.trim()) {
            missing.push("Primary Category");
        }
        if (!about.trim() || about.trim().length < 20) {
            missing.push("About the Club story (minimum 20 characters)");
        }
        if (!club?.collegeName && !club?.collegeId) {
            missing.push("Verified Affiliated Institution record");
        }
        return {
            valid: missing.length === 0,
            missing,
        };
    };

    const handleSave = async (targetVisibility?: ClubVisibilityTier) => {
        const effectiveVisibility = targetVisibility || visibility;

        // If user is publishing (public or unlisted), enforce publish checks
        if (effectiveVisibility === "public" || effectiveVisibility === "unlisted") {
            const check = checkPublishRequirements();
            if (!check.valid) {
                setValidationMissingItems(check.missing);
                setIsValidationModalOpen(true);
                return;
            }
        }

        try {
            setIsSaving(true);
            const payload = {
                name: name.trim(),
                category: category.trim(),
                foundedYear: foundedYear ? parseInt(foundedYear, 10) : null,
                operatingStatus,
                logoUrl: logoUrl.trim() || null,
                coverImageUrl: coverImageUrl.trim() || null,
                about: about.trim(),
                tagline: tagline.trim(),
                shortDescription: tagline.trim(),
                focusAreas,
                publicEmail: publicEmail.trim() || null,
                contactPhone: contactPhone.trim() || null,
                links,
                recruitmentStatus,
                recruitmentAnnouncement: recruitmentAnnouncement.trim() || null,
                recruitmentUrl: recruitmentUrl.trim() || null,
                visibility: effectiveVisibility,
            };

            const updated = await dispatch(saveClubProfile({ payload, clubId })).unwrap();
            if (updated?.club) {
                populateForm(updated.club);
            }

            if (effectiveVisibility === "public") {
                toast.success("Club profile published to the Orbix Directory!");
            } else if (effectiveVisibility === "unlisted") {
                toast.success("Club profile saved as unlisted (direct link only).");
            } else if (effectiveVisibility === "archived") {
                toast.info("Club profile archived.");
            } else {
                toast.success("Club profile draft saved successfully!");
            }

            if (onProfileUpdated) onProfileUpdated(updated.club);
        } catch (err: any) {
            console.error("Save profile error:", err);
            if (err?.checklist && Array.isArray(err.checklist)) {
                setValidationMissingItems(err.checklist);
                setIsValidationModalOpen(true);
            } else {
                toast.error(err || "Failed to save profile changes.");
            }
        } finally {
            setIsSaving(false);
        }
    };

    const handleNextStep = () => {
        if (currentStep < 5) {
            setCurrentStep(currentStep + 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    const handlePrevStep = () => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
            window.scrollTo({ top: 0, behavior: "smooth" });
        }
    };

    // Construct preview club object for modal
    const previewClubData: ClubProfileData = useMemo(() => {
        return {
            id: club?.id || "preview-id",
            name: name || "Club Name",
            slug: club?.slug || "club-preview",
            category,
            collegeName: club?.collegeName || "Your College / University",
            collegeCity: club?.collegeCity || "",
            collegeState: club?.collegeState || "",
            collegeCountry: club?.collegeCountry || "India",
            shortDescription: tagline || null,
            about: about || null,
            logoUrl: logoUrl || null,
            coverImageUrl: coverImageUrl || null,
            websiteUrl: links.find((l) => l.platform === "website")?.url || null,
            publicEmail: publicEmail || null,
            contactPhone: contactPhone || null,
            links,
            socialLinks: null,
            foundedYear: foundedYear ? parseInt(foundedYear, 10) : null,
            operatingStatus,
            mission: null,
            vision: null,
            focusAreas,
            visibility,
            publicationStatus: visibility === "archived" ? "hidden" : visibility === "draft" ? "draft" : "published",
            profileVisibility: visibility === "unlisted" ? "unlisted" : visibility === "private" ? "private" : "public",
            recruitmentStatus,
            recruitmentAnnouncement: recruitmentAnnouncement || null,
            recruitmentUrl: recruitmentUrl || null,
            isActive: visibility !== "archived",
            verifiedAt: club?.verifiedAt || new Date().toISOString(),
            createdAt: club?.createdAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
    }, [
        club,
        name,
        category,
        tagline,
        about,
        logoUrl,
        coverImageUrl,
        links,
        publicEmail,
        contactPhone,
        foundedYear,
        operatingStatus,
        focusAreas,
        visibility,
        recruitmentStatus,
        recruitmentAnnouncement,
        recruitmentUrl,
    ]);

    const steps = [
        { id: 1, title: "Identity", subtitle: "Name & Affiliation" },
        { id: 2, title: "Brand & Story", subtitle: "Media & Narrative" },
        { id: 3, title: "People & Contact", subtitle: "Leads & Channels" },
        { id: 4, title: "Links & Achievements", subtitle: "Social & Awards" },
        { id: 5, title: "Recruitment & Publishing", subtitle: "Auditions & Visibility" },
    ];

    const canPublishCheck = checkPublishRequirements();

    return (
        <div className="space-y-6 pb-28">
            {/* Main Profile Completeness Block (Replaces redundant second heading & enhances completion experience) */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-5">
                {/* Header & Percentage */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2.5 flex-wrap">
                            <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                                Profile Completeness
                            </h2>
                            <span className={`px-2.5 py-0.5 rounded-full border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_#000] ${completionBadge.bg} ${completionBadge.text}`}>
                                {completionBadge.label}
                            </span>
                        </div>
                        <p className="text-xs sm:text-sm text-neutral-600 font-medium mt-1">
                            Complete your chapter attributes to maximize student trust, event reach, and official institutional verification.
                        </p>
                    </div>

                    <div className="flex sm:flex-col items-baseline sm:items-end justify-between sm:justify-center gap-0.5 shrink-0">
                        <span className="text-2xl sm:text-3xl font-black font-mono text-black">
                            {displayPercentage}%
                        </span>
                        <span className="text-xs font-bold text-neutral-500 font-mono">
                            ({completedCount}/{profileSections.length} sections)
                        </span>
                    </div>
                </div>

                {/* Sleek Progress Bar (Using the specified green #a2ff86) */}
                <div className="w-full h-3.5 bg-neutral-100 rounded-full border-2 border-black overflow-hidden relative shadow-[inset_1px_1px_2px_rgba(0,0,0,0.08)]">
                    <div
                        className="h-full bg-[#a2ff86] border-r-2 border-black transition-all duration-500 rounded-full"
                        style={{ width: `${Math.max(displayPercentage, 2)}%` }}
                    />
                </div>

                {/* Section Checklist Grid (Inspired by UI with Orbix Neo-Brutalist Theme) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    {profileSections.map((section) => (
                        <div
                            key={section.id}
                            className={`p-3.5 sm:p-4 rounded-xl border-2 transition-all flex items-center justify-between gap-3 ${
                                section.isCompleted
                                    ? "bg-[#fafdf8] border-black shadow-[2px_2px_0px_#000]"
                                    : "bg-white border-neutral-300 hover:border-black hover:shadow-[2px_2px_0px_#000]"
                            }`}
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <div
                                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 ${
                                        section.isCompleted
                                            ? "bg-[#a2ff86] border-black shadow-[1px_1px_0px_#000]"
                                            : "bg-neutral-100 border-neutral-400"
                                    }`}
                                >
                                    {section.isCompleted ? (
                                        <Check className="w-4 h-4 text-black stroke-[3]" />
                                    ) : (
                                        <div className="w-2 h-2 rounded-full bg-neutral-400" />
                                    )}
                                </div>
                                <div className="min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="text-xs sm:text-sm font-black text-black leading-tight truncate">
                                            {section.label}
                                        </span>
                                        {section.isRequired && !section.isCompleted && (
                                            <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-rose-100 text-rose-600 border border-rose-300">
                                                Required
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-[11px] text-neutral-500 font-medium truncate mt-0.5">
                                        {section.description}
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={() => {
                                    setCurrentStep(section.stepId);
                                    const el = document.getElementById("club-step-content");
                                    if (el) {
                                        el.scrollIntoView({ behavior: "smooth", block: "start" });
                                    }
                                }}
                                className={`px-3 py-1.5 rounded-lg border-2 border-black text-xs font-black shadow-[1.5px_1.5px_0px_#000] cursor-pointer transition-all active:translate-x-[1px] active:translate-y-[1px] shrink-0 flex items-center gap-1 ${
                                    section.isCompleted
                                        ? "bg-white text-neutral-800 hover:bg-neutral-100"
                                        : "bg-[#FFE566] text-black hover:bg-[#ffd83b]"
                                }`}
                            >
                                {section.isCompleted ? (
                                    <span>Edit</span>
                                ) : (
                                    <>
                                        <span>Add</span>
                                        <Plus className="w-3.5 h-3.5 stroke-[3]" />
                                    </>
                                )}
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* 5-Step Progress Navigation Header */}
            <div className="rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] p-3 sm:p-4">
                {/* Desktop Stepper */}
                <div className="hidden sm:grid grid-cols-5 gap-2">
                    {steps.map((st) => {
                        const isCurrent = currentStep === st.id;
                        const isPast = currentStep > st.id;

                        return (
                            <button
                                key={st.id}
                                type="button"
                                onClick={() => setCurrentStep(st.id)}
                                className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer flex flex-col justify-between ${
                                    isCurrent
                                        ? "bg-[#a2ff86] text-black border-black shadow-[2px_2px_0px_#000]"
                                        : isPast
                                        ? "bg-[#FAF6EE] text-black border-black/40 hover:border-black"
                                        : "bg-white text-neutral-400 border-neutral-200 hover:border-neutral-300"
                                }`}
                            >
                                <div className="flex items-center justify-between mb-1">
                                    <span className="text-[10px] font-mono font-black uppercase">
                                        Step 0{st.id}
                                    </span>
                                    {isPast && <Check className="w-3.5 h-3.5 text-black stroke-[3]" />}
                                </div>
                                <div>
                                    <h4 className="text-xs font-black truncate">{st.title}</h4>
                                    <p
                                        className={`text-[10px] truncate ${
                                            isCurrent ? "text-neutral-800 font-bold" : "text-neutral-500"
                                        }`}
                                    >
                                        {st.subtitle}
                                    </p>
                                </div>
                            </button>
                        );
                    })}
                </div>

                {/* Mobile Stepper: Compact Pill & Progress Tracker */}
                <div className="sm:hidden flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                        <span className="text-[10px] font-mono font-black text-neutral-500 uppercase">
                            Step {currentStep} of 5
                        </span>
                        <h3 className="text-xs font-black text-black">
                            {steps[currentStep - 1]?.title}
                        </h3>
                    </div>
                    <div className="flex items-center gap-1.5">
                        {steps.map((st) => (
                            <button
                                key={st.id}
                                type="button"
                                onClick={() => setCurrentStep(st.id)}
                                className={`w-6 h-6 rounded-lg text-[10px] font-black border flex items-center justify-center cursor-pointer ${
                                    currentStep === st.id
                                        ? "bg-[#a2ff86] text-black border-black"
                                        : currentStep > st.id
                                        ? "bg-[#FFE566] text-black border-black"
                                        : "bg-neutral-100 text-neutral-400 border-neutral-200"
                                }`}
                            >
                                {st.id}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Active Step Canvas Surface */}
            <div id="club-step-content" className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] scroll-mt-6">
                {currentStep === 1 && (
                    <StepIdentity
                        name={name}
                        onNameChange={setName}
                        category={category}
                        onCategoryChange={setCategory}
                        categoryUpdatedAt={club?.categoryUpdatedAt}
                        foundedYear={foundedYear}
                        onFoundedYearChange={setFoundedYear}
                        operatingStatus={operatingStatus}
                        onOperatingStatusChange={setOperatingStatus}
                        collegeName={club?.collegeName || "Your College"}
                        collegeCity={club?.collegeCity}
                        collegeState={club?.collegeState}
                        collegeCountry={club?.collegeCountry}
                        isVerified={Boolean(club?.verifiedAt || club?.collegeName)}
                    />
                )}

                {currentStep === 2 && (
                    <StepBrandStory
                        clubId={club?.id}
                        logoUrl={logoUrl}
                        onLogoChange={setLogoUrl}
                        coverImageUrl={coverImageUrl}
                        onCoverImageChange={setCoverImageUrl}
                        about={about}
                        onAboutChange={setAbout}
                        tagline={tagline}
                        onTaglineChange={setTagline}
                        focusAreas={focusAreas}
                        onFocusAreasChange={setFocusAreas}
                    />
                )}

                {currentStep === 3 && (
                    <StepPeopleContact
                        clubId={club?.id || ""}
                        coordinators={coordinators}
                        canManage={Boolean(permissions?.canManageProfile || permissions?.isOwner || permissions?.isAdmin)}
                        onUpdateCoordinators={() => {
                            if (club?.id) dispatch(fetchClubProfile({ clubId: club.id, force: true }));
                        }}
                        publicEmail={publicEmail}
                        onPublicEmailChange={setPublicEmail}
                        contactPhone={contactPhone}
                        onContactPhoneChange={setContactPhone}
                    />
                )}

                {currentStep === 4 && (
                    <StepLinksAchievements
                        clubId={club?.id || ""}
                        links={links}
                        onLinksChange={setLinks}
                        achievements={achievements}
                        canManage={Boolean(permissions?.canManageProfile || permissions?.isOwner || permissions?.isAdmin)}
                        onUpdateAchievements={() => {
                            if (club?.id) dispatch(fetchClubProfile({ clubId: club.id, force: true }));
                        }}
                    />
                )}

                {currentStep === 5 && (
                    <StepRecruitmentPublishing
                        recruitmentStatus={recruitmentStatus}
                        onRecruitmentStatusChange={setRecruitmentStatus}
                        recruitmentUrl={recruitmentUrl}
                        onRecruitmentUrlChange={setRecruitmentUrl}
                        recruitmentAnnouncement={recruitmentAnnouncement}
                        onRecruitmentAnnouncementChange={setRecruitmentAnnouncement}
                        visibility={visibility}
                        onVisibilityChange={setVisibility}
                        canPublish={canPublishCheck.valid}
                        onTriggerPublishValidation={() => {
                            setValidationMissingItems(canPublishCheck.missing);
                            setIsValidationModalOpen(true);
                        }}
                    />
                )}
            </div>

            {/* Action Bar Just Below the Form */}
            <div className="flex items-center justify-center gap-3 pt-3 pb-2">
                {/* Previous Button (arrow only pointing left, green background, black icon) */}
                <button
                    type="button"
                    onClick={handlePrevStep}
                    disabled={currentStep === 1}
                    className="w-11 h-11 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black shadow-[2px_2px_0px_#000] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                    title="Previous"
                    aria-label="Previous"
                >
                    <ArrowLeft className="w-5 h-5 stroke-[2.5]" />
                </button>

                {/* Save Changes Button (green background, black text - active only when changes occur) */}
                <button
                    type="button"
                    onClick={() => handleSave()}
                    disabled={!isDirty || isSaving}
                    className={`px-6 py-2.5 rounded-xl border-2 text-xs sm:text-sm font-black transition-all flex items-center gap-2 select-none ${
                        !isDirty || isSaving
                            ? "bg-neutral-200 text-neutral-400 border-neutral-300 shadow-none cursor-not-allowed opacity-60"
                            : "bg-[#a2ff86] text-black hover:bg-[#8ee673] border-black shadow-[2px_2px_0px_#000] cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                    }`}
                    title={isDirty ? "Save your changes" : "No changes to save"}
                >
                    {isSaving ? (
                        <>
                            <div className="w-3.5 h-3.5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                            <span>Saving Changes...</span>
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4 stroke-[2.5]" />
                            <span>Save Changes</span>
                            {isDirty && (
                                <span className="w-2 h-2 rounded-full bg-black animate-pulse" title="Unsaved changes" />
                            )}
                        </>
                    )}
                </button>

                {/* Next Button (arrow only pointing right, green background, black icon) */}
                <button
                    type="button"
                    onClick={handleNextStep}
                    disabled={currentStep === 5}
                    className="w-11 h-11 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black shadow-[2px_2px_0px_#000] disabled:opacity-40 disabled:pointer-events-none flex items-center justify-center cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                    title="Next"
                    aria-label="Next"
                >
                    <ArrowRight className="w-5 h-5 stroke-[2.5]" />
                </button>
            </div>

            {/* PREVIEW MODAL */}
            <ProfilePreviewModal
                isOpen={isPreviewOpen}
                onClose={() => setIsPreviewOpen(false)}
                club={previewClubData}
                coordinators={coordinators}
                achievements={achievements}
            />

            {/* PUBLISH VALIDATION MODAL */}
            <PublishValidationModal
                isOpen={isValidationModalOpen}
                onClose={() => setIsValidationModalOpen(false)}
                missingItems={validationMissingItems}
                onGoToStep={(st) => setCurrentStep(st)}
            />
        </div>
    );
};
