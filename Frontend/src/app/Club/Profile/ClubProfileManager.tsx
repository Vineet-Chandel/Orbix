import React, { useState, useEffect, useMemo, useRef } from "react";
import {
    Save,
    Eye,
    Check,
    CheckCircle2,
    ArrowLeft,
    ArrowRight,
    Sparkles,
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
import { OrbixButton } from "../../../components/OrbixButton";

interface ClubProfileManagerProps {
    clubId?: string;
    onProfileUpdated?: () => void;
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
    const [lastSavedTime, setLastSavedTime] = useState<string | null>(null);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [isValidationModalOpen, setIsValidationModalOpen] = useState(false);
    const [validationMissingItems, setValidationMissingItems] = useState<string[]>([]);
    const [showCompletionDetails, setShowCompletionDetails] = useState(false);

    // Snapshot for dirty-state tracking
    const initialSnapshotRef = useRef<string>("");

    // Synchronize form from club data
    const populateForm = (c: ClubProfileData) => {
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
        if (!clubState.isInitialized) {
            dispatch(fetchClubProfile({ clubId }))
                .unwrap()
                .then((data) => {
                    if (data?.club) populateForm(data.club);
                })
                .catch((err) => toast.error(err || "Failed to load club profile."));
        } else if (clubState.club) {
            populateForm(clubState.club);
        }
    }, [clubId, clubState.isInitialized]);

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

            const now = new Date();
            setLastSavedTime(
                now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            );

            if (effectiveVisibility === "public") {
                toast.success("Club profile published to the Orbix Directory!");
            } else if (effectiveVisibility === "unlisted") {
                toast.success("Club profile saved as unlisted (direct link only).");
            } else if (effectiveVisibility === "archived") {
                toast.info("Club profile archived.");
            } else {
                toast.success("Club profile draft saved successfully!");
            }

            if (onProfileUpdated) onProfileUpdated();
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
            {/* Top Bar: Title & Lightweight Profile Completion Indicator */}
            <div className="p-5 sm:p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-5">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-full bg-[#FFE566] border border-black text-[10px] font-black uppercase text-black">
                            Profile Management
                        </span>
                        {isDirty && (
                            <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-100 border border-amber-300 text-[10px] font-bold text-amber-900">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                <span>Unsaved changes</span>
                            </span>
                        )}
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-black tracking-tight mt-1">
                        Manage Club Profile
                    </h1>
                    <p className="text-xs text-neutral-600 font-medium mt-0.5">
                        Create a credible, professional chapter profile in 5 streamlined steps.
                    </p>
                </div>

                {/* Completion & Preview Actions */}
                <div className="flex items-center gap-3 self-start md:self-auto flex-wrap">
                    {/* Completion Pill with Popover */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={() => setShowCompletionDetails(!showCompletionDetails)}
                            className="px-3.5 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-black text-black flex items-center gap-2 hover:bg-neutral-100 cursor-pointer"
                        >
                            <div className="w-5 h-5 rounded-full border border-black bg-white flex items-center justify-center text-[10px] font-mono">
                                {completion.percentage}%
                            </div>
                            <span>Profile Completion</span>
                        </button>

                        {/* Completion Details Popover */}
                        {showCompletionDetails && (
                            <div className="absolute right-0 top-12 z-40 w-80 p-4 rounded-2xl bg-white border-2 border-black shadow-[5px_5px_0px_#000] space-y-3 animate-in fade-in duration-100">
                                <div className="flex items-center justify-between border-b border-black/10 pb-2">
                                    <h4 className="text-xs font-black text-black uppercase tracking-wider">
                                        Completion Score
                                    </h4>
                                    <span className="text-xs font-mono font-black text-black">
                                        {completion.percentage}%
                                    </span>
                                </div>

                                <div className="space-y-2 text-xs">
                                    <div>
                                        <span className="text-[10px] font-black uppercase text-neutral-500 block mb-1">
                                            Essential for Publishing:
                                        </span>
                                        <div className="space-y-1">
                                            {[
                                                { label: "Official Club Name", done: Boolean(name.trim().length >= 2) },
                                                { label: "Primary Category", done: Boolean(category.trim()) },
                                                { label: "About the Club (20+ chars)", done: Boolean(about.trim().length >= 20) },
                                                { label: "Verified Institution Record", done: Boolean(club?.collegeName || club?.collegeId) },
                                            ].map((item, i) => (
                                                <div key={i} className="flex items-center justify-between text-[11px]">
                                                    <span className={item.done ? "text-neutral-800 font-medium" : "text-neutral-500 font-bold"}>
                                                        {item.label}
                                                    </span>
                                                    {item.done ? (
                                                        <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[3]" />
                                                    ) : (
                                                        <span className="text-[10px] font-black text-rose-500">Required</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t border-black/10">
                                        <span className="text-[10px] font-black uppercase text-neutral-500 block mb-1">
                                            Recommended:
                                        </span>
                                        <div className="space-y-1">
                                            {[
                                                { label: "Club Logo", done: Boolean(logoUrl) },
                                                { label: "Header Banner", done: Boolean(coverImageUrl) },
                                                { label: "Coordinators Added", done: coordinators.length > 0 },
                                                { label: "Contact / Links Added", done: Boolean(publicEmail || links.length > 0) },
                                            ].map((item, i) => (
                                                <div key={i} className="flex items-center justify-between text-[11px]">
                                                    <span className="text-neutral-600">{item.label}</span>
                                                    {item.done ? (
                                                        <Check className="w-3 h-3 text-emerald-600" />
                                                    ) : (
                                                        <span className="text-[10px] text-neutral-400">Optional</span>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Preview Button */}
                    <button
                        type="button"
                        onClick={() => setIsPreviewOpen(true)}
                        className="px-3.5 py-2 rounded-xl bg-white border-2 border-black text-xs font-black text-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        <Eye className="w-3.5 h-3.5 text-black" />
                        <span>Preview Profile</span>
                    </button>
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
            <div className="p-6 sm:p-8 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000]">
                {currentStep === 1 && (
                    <StepIdentity
                        name={name}
                        onNameChange={setName}
                        category={category}
                        onCategoryChange={setCategory}
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

            {/* Persistent Bottom Action Bar */}
            <div className="fixed bottom-0 left-0 right-0 z-30 bg-white/95 backdrop-blur-md border-t-2 border-black p-3 sm:p-4 shadow-[0px_-4px_12px_rgba(0,0,0,0.06)]">
                <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
                    {/* Status indicator on the left */}
                    <div className="flex items-center gap-3 text-xs font-bold text-neutral-600 self-start sm:self-auto">
                        {isDirty ? (
                            <span className="flex items-center gap-1.5 text-amber-600">
                                <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                <span>Unsaved changes in profile</span>
                            </span>
                        ) : lastSavedTime ? (
                            <span className="flex items-center gap-1.5 text-emerald-600">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span>Saved at {lastSavedTime}</span>
                            </span>
                        ) : (
                            <span className="text-neutral-400">All data in sync</span>
                        )}
                    </div>

                    {/* Navigation and Save Actions */}
                    <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
                        {/* Previous Button */}
                        <button
                            type="button"
                            onClick={handlePrevStep}
                            disabled={currentStep === 1}
                            className="px-3.5 py-2 rounded-xl bg-white text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 disabled:opacity-30 disabled:pointer-events-none flex items-center gap-1 cursor-pointer"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            <span>Previous</span>
                        </button>

                        {/* Save Draft Button (always available) */}
                        <OrbixButton
                            onClick={() => handleSave()}
                            loading={isSaving}
                            loadingLabel="Saving Draft..."
                            variant="white"
                            icon={<Save className="w-3.5 h-3.5" />}
                        >
                            Save Draft
                        </OrbixButton>

                        {/* Next or Publish Action */}
                        {currentStep < 5 ? (
                            <button
                                type="button"
                                onClick={handleNextStep}
                                className="px-5 py-2 rounded-xl bg-[#a2ff86] text-black hover:bg-[#8ee673] border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                            >
                                <span>Continue</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        ) : (
                            <OrbixButton
                                onClick={() => handleSave()}
                                loading={isSaving}
                                loadingLabel={
                                    visibility === "public"
                                        ? "Publishing..."
                                        : visibility === "unlisted"
                                        ? "Saving..."
                                        : "Saving Changes..."
                                }
                                variant="yellow"
                                icon={<Sparkles className="w-3.5 h-3.5" />}
                            >
                                {visibility === "public"
                                    ? "Publish Profile"
                                    : visibility === "unlisted"
                                    ? "Save Unlisted"
                                    : "Save Changes"}
                            </OrbixButton>
                        )}
                    </div>
                </div>
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
