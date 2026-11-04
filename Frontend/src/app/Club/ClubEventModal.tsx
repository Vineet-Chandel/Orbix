import React, { useState, useEffect, useId } from "react";
import { createPortal } from "react-dom";
import {
    X,
    Calendar,
    MapPin,
    AlertCircle,
    CheckCircle2,
    Sparkles,
    ArrowLeft,
    Info,
} from "lucide-react";
import { NeoSelect } from "../../components/NeoSelect";
import { NeoImageDropzone } from "../../components/NeoImageDropzone";
import { NeoDateTimePicker } from "../../components/NeoDateTimePicker";
import { EventLiveListingCard } from "../../components/EventLiveListingCard";
import { OrbixButton } from "../../components/ui/loader";
import { useToast } from "../../context/ToastContext";
import {
    requestClubUploadSignature,
    uploadClubImageToCloudinary,
} from "../../utils/clubProfileApi";
import type { ClubEvent, CreateClubEventPayload, ClubEventStatus } from "../../store/clubEventsSlice";

export interface ClubEventModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (eventData: CreateClubEventPayload, isEditing: boolean, eventId?: string) => void;
    editingEvent?: ClubEvent | null;
    clubId?: string;
    clubName?: string;
    clubLogoUrl?: string | null;
    collegeName?: string;
    collegeId?: string | null;
    initialStatus?: ClubEventStatus;
}

interface FormState {
    title: string;
    summary: string;
    description: string;
    startsAt: string;
    endsAt: string;
    timezone: string;
    locationType: "in_person" | "virtual" | "hybrid";
    venueOrLocation: string;
    registrationUrl: string;
    coverImageUrl: string;
    status: ClubEventStatus;
}

interface FormErrors {
    title?: string;
    startsAt?: string;
    endsAt?: string;
    registrationUrl?: string;
    venueOrLocation?: string;
}

const URL_REGEX = /^(https?:\/\/)([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?(\?.*)?$/i;

export const ClubEventModal: React.FC<ClubEventModalProps> = ({
    isOpen,
    onClose,
    onSubmit,
    editingEvent,
    clubId,
    clubName = "Club",
    clubLogoUrl,
    collegeName = "Pranveer Singh Institute of Technology, Kanpur",
    initialStatus = "published",
}) => {
    const toast = useToast();
    const modalId = useId();

    const formatForInput = (isoStr: string | null | undefined): string => {
        if (!isoStr) return "";
        try {
            const d = new Date(isoStr);
            if (isNaN(d.getTime())) return "";
            const pad = (n: number) => (n < 10 ? `0${n}` : n);
            return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        } catch {
            return "";
        }
    };

    const [form, setForm] = useState<FormState>({
        title: "",
        summary: "",
        description: "",
        startsAt: "",
        endsAt: "",
        timezone: "Asia/Kolkata",
        locationType: "in_person",
        venueOrLocation: "",
        registrationUrl: "",
        coverImageUrl: "",
        status: initialStatus,
    });

    const [errors, setErrors] = useState<FormErrors>({});
    const [touched, setTouched] = useState<Record<string, boolean>>({});

    // Banner upload states
    const [isUploadingBanner, setIsUploadingBanner] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    // Initialize or reset form when modal opens or editingEvent changes
    useEffect(() => {
        if (isOpen) {
            if (editingEvent) {
                setForm({
                    title: editingEvent.title || "",
                    summary: editingEvent.summary || "",
                    description: editingEvent.description || "",
                    startsAt: formatForInput(editingEvent.startsAt),
                    endsAt: formatForInput(editingEvent.endsAt),
                    timezone: editingEvent.timezone || "Asia/Kolkata",
                    locationType: editingEvent.locationType || "in_person",
                    venueOrLocation: editingEvent.venueOrLocation || "",
                    registrationUrl: editingEvent.registrationUrl || "",
                    coverImageUrl: editingEvent.coverImageUrl || "",
                    status: editingEvent.status || "published",
                });
            } else {
                setForm({
                    title: "",
                    summary: "",
                    description: "",
                    startsAt: "",
                    endsAt: "",
                    timezone: "Asia/Kolkata",
                    locationType: "in_person",
                    venueOrLocation: "",
                    registrationUrl: "",
                    coverImageUrl: "",
                    status: initialStatus,
                });
            }
            setErrors({});
            setTouched({});
            setIsUploadingBanner(false);
            setUploadProgress(null);
        }
    }, [isOpen, editingEvent, initialStatus]);

    // Close on Escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen && !isUploadingBanner) {
                onClose();
            }
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, isUploadingBanner, onClose]);

    // Validation logic for valid details only
    const validate = (currentForm: FormState): FormErrors => {
        const errs: FormErrors = {};

        // 1. Title validation
        const trimmedTitle = currentForm.title.trim();
        if (!trimmedTitle) {
            errs.title = "Event title is required.";
        } else if (trimmedTitle.length < 3) {
            errs.title = "Title must be at least 3 characters.";
        } else if (trimmedTitle.length > 120) {
            errs.title = "Title cannot exceed 120 characters.";
        }

        // 2. Starts At validation
        if (!currentForm.startsAt) {
            errs.startsAt = "Event start date and time is required.";
        } else {
            const startDate = new Date(currentForm.startsAt);
            if (isNaN(startDate.getTime())) {
                errs.startsAt = "Please enter a valid start date and time.";
            }
        }

        // 3. Ends At validation
        if (currentForm.endsAt) {
            const endDate = new Date(currentForm.endsAt);
            if (isNaN(endDate.getTime())) {
                errs.endsAt = "Please enter a valid end date and time.";
            } else if (currentForm.startsAt) {
                const startDate = new Date(currentForm.startsAt);
                if (endDate.getTime() <= startDate.getTime()) {
                    errs.endsAt = "End date and time must be strictly after the start date and time.";
                }
            }
        }

        // 4. Registration URL validation
        if (currentForm.registrationUrl.trim()) {
            const regUrl = currentForm.registrationUrl.trim();
            if (!URL_REGEX.test(regUrl)) {
                errs.registrationUrl = "Must be a valid URL starting with http:// or https:// (e.g. https://forms.gle/...)";
            }
        }

        // 5. Venue or Location details validation for in_person / hybrid when published
        if (currentForm.status === "published" && (currentForm.locationType === "in_person" || currentForm.locationType === "hybrid")) {
            if (!currentForm.venueOrLocation.trim()) {
                errs.venueOrLocation = "Venue / campus room is recommended for published in-person sessions.";
            }
        }

        return errs;
    };

    const handleBlur = (field: string) => {
        setTouched((prev) => ({ ...prev, [field]: true }));
        setErrors(validate(form));
    };

    const handleBannerFileSelect = async (file: File) => {
        try {
            setIsUploadingBanner(true);
            setUploadProgress(0);

            // Fetch signed upload params for banner
            const uploadConfig = await requestClubUploadSignature("banner", clubId);

            // Upload directly to Cloudinary with real-time progress
            const result = await uploadClubImageToCloudinary(uploadConfig, file, (percent) => {
                setUploadProgress(percent);
            });

            setForm((prev) => ({ ...prev, coverImageUrl: result.secureUrl }));
            toast.success("Event banner uploaded successfully!", { title: "Media Uploaded" });
        } catch (err: any) {
            console.error("Banner upload failed:", err);
            toast.error(err.message || "Failed to upload banner image. Please try again.", {
                title: "Upload Failed",
            });
        } finally {
            setIsUploadingBanner(false);
            setUploadProgress(null);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Mark all fields as touched
        setTouched({
            title: true,
            startsAt: true,
            endsAt: true,
            registrationUrl: true,
            venueOrLocation: true,
        });

        const validationErrors = validate(form);
        setErrors(validationErrors);

        // Check for fatal errors
        if (
            validationErrors.title ||
            validationErrors.startsAt ||
            validationErrors.endsAt ||
            validationErrors.registrationUrl
        ) {
            const firstError =
                validationErrors.title ||
                validationErrors.startsAt ||
                validationErrors.endsAt ||
                validationErrors.registrationUrl;
            toast.error(firstError || "Please correct the highlighted fields before submitting.", {
                title: "Validation Error",
            });
            return;
        }

        // Construct clean payload with valid details only
        const payload: CreateClubEventPayload = {
            title: form.title.trim(),
            summary: form.summary.trim() || null,
            description: form.description.trim() || null,
            startsAt: new Date(form.startsAt).toISOString(),
            endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
            timezone: form.timezone,
            locationType: form.locationType,
            venueOrLocation: form.venueOrLocation.trim() || null,
            registrationUrl: form.registrationUrl.trim() || null,
            coverImageUrl: form.coverImageUrl.trim() || null,
            status: form.status,
        };

        // Fire callback immediately for optimistic update
        onSubmit(payload, Boolean(editingEvent), editingEvent?.id);
    };

    if (!isOpen || typeof document === "undefined") return null;

    return createPortal(
        <div
            id={modalId}
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] bg-[#FAF6EE] flex flex-col w-screen h-screen overflow-hidden text-black animate-in fade-in duration-150"
            role="dialog"
            aria-modal="true"
        >
            {/* Top Fullscreen Header */}
            <header className="h-16 sm:h-20 bg-[#FAF6EE] border-b-2 border-black px-4 sm:px-8 flex items-center justify-between shrink-0 shadow-[0_2px_0px_#000]">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isUploadingBanner}
                        className="p-2 sm:px-3 sm:py-2 rounded-xl bg-white hover:bg-neutral-100 border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                        title="Back to Events"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Back to Events</span>
                    </button>

                    <div className="h-6 w-[2px] bg-black/20 hidden sm:block" />

                    <div className="truncate">
                        <div className="flex items-center gap-2">
                            <h2 className="text-base sm:text-lg font-black text-black truncate">
                                {editingEvent ? "Edit Club Event" : "Create New Club Event"}
                            </h2>
                            <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border-2 border-black shrink-0 ${
                                    form.status === "published"
                                        ? "bg-emerald-300 text-black shadow-[1px_1px_0px_#000]"
                                        : form.status === "draft"
                                        ? "bg-amber-300 text-black shadow-[1px_1px_0px_#000]"
                                        : "bg-rose-300 text-black shadow-[1px_1px_0px_#000]"
                                }`}
                            >
                                {form.status === "published"
                                    ? "Live Stage"
                                    : form.status === "draft"
                                    ? "Draft Stage"
                                    : "Cancelled Stage"}
                            </span>
                        </div>
                        <p className="text-[11px] sm:text-xs text-neutral-600 font-medium truncate">
                            Organize workshops, hackathons, and chapter meetups with strictly verified details.
                        </p>
                    </div>
                </div>

                {/* Right Header Actions */}
                <div className="flex items-center gap-2.5 shrink-0">
                    <OrbixButton
                        type="button"
                        onClick={handleSubmit}
                        variant="lime"
                        disabled={isUploadingBanner}
                        className="px-4 sm:px-6 py-2 text-xs font-black"
                    >
                        {editingEvent ? "Save Changes" : "Create Event"}
                    </OrbixButton>
                </div>
            </header>

            {/* Modal Body: 50% Left Form / 50% Right Banner & Live Preview */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
                {/* 50% LEFT COLUMN: Input Form with Valid Details Validation */}
                <div className="w-full lg:w-1/2 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 border-b-2 lg:border-b-0 lg:border-r-2 border-black bg-[#FAF6EE]/40">
                    <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                Step 1 of 2
                            </span>
                            <h3 className="text-base font-black text-black">Event Information</h3>
                        </div>
                        <span className="text-[11px] font-bold text-neutral-500 bg-white px-2.5 py-1 rounded-lg border border-black/30 shadow-[1px_1px_0px_#000]">
                            * Required Fields
                        </span>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* 1. Title */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-black uppercase tracking-wider text-black">
                                    Event Title *
                                </label>
                                <span
                                    className={`text-[10px] font-mono font-bold ${
                                        form.title.length > 120
                                            ? "text-rose-600"
                                            : form.title.length >= 3
                                            ? "text-emerald-700"
                                            : "text-neutral-500"
                                    }`}
                                >
                                    {form.title.length}/120
                                </span>
                            </div>
                            <input
                                type="text"
                                required
                                value={form.title}
                                onChange={(e) => setForm({ ...form, title: e.target.value })}
                                onBlur={() => handleBlur("title")}
                                maxLength={120}
                                placeholder="e.g. Masterclass: System Design & Microservices Architecture"
                                className={`w-full px-3.5 py-2.5 rounded-xl bg-white border-2 text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-hidden transition-all ${
                                    touched.title && errors.title
                                        ? "border-rose-500 bg-rose-50/50"
                                        : "border-black focus:ring-2 focus:ring-[#a2ff86]"
                                }`}
                            />
                            {touched.title && errors.title && (
                                <p className="text-[11px] font-bold text-rose-600 mt-1.5 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>{errors.title}</span>
                                </p>
                            )}
                        </div>

                        {/* 2. Schedule Row: Starts At & Ends At */}
                        <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3.5">
                            <div className="flex items-center gap-2 pb-2 border-b border-black/10">
                                <Calendar className="w-4 h-4 text-neutral-700" />
                                <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                    Schedule & Timings
                                </h4>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <NeoDateTimePicker
                                        label="Starts At"
                                        required
                                        value={form.startsAt}
                                        onChange={(val) => {
                                            setForm({ ...form, startsAt: val });
                                            if (errors.startsAt) {
                                                setErrors({ ...errors, startsAt: undefined });
                                            }
                                        }}
                                        onBlur={() => handleBlur("startsAt")}
                                        error={touched.startsAt ? errors.startsAt : undefined}
                                        placeholder="Pick event start date & time"
                                        mode="datetime"
                                    />
                                    {touched.startsAt && errors.startsAt && (
                                        <p className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3 shrink-0" />
                                            <span>{errors.startsAt}</span>
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <NeoDateTimePicker
                                        label="Ends At (Optional)"
                                        value={form.endsAt}
                                        onChange={(val) => {
                                            setForm({ ...form, endsAt: val });
                                            if (errors.endsAt) {
                                                setErrors({ ...errors, endsAt: undefined });
                                            }
                                        }}
                                        onBlur={() => handleBlur("endsAt")}
                                        error={touched.endsAt ? errors.endsAt : undefined}
                                        placeholder="Pick event end date & time"
                                        mode="datetime"
                                    />
                                    {touched.endsAt && errors.endsAt && (
                                        <p className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3 shrink-0" />
                                            <span>{errors.endsAt}</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            <p className="text-[10px] text-neutral-500 font-medium">
                                * Times are formatted according to Indian Standard Time (Asia/Kolkata).
                            </p>
                        </div>

                        {/* 3. Location Row */}
                        <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3.5">
                            <div className="flex items-center gap-2 pb-2 border-b border-black/10">
                                <MapPin className="w-4 h-4 text-neutral-700" />
                                <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                    Location & Venue
                                </h4>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                        Location Type *
                                    </label>
                                    <NeoSelect
                                        value={form.locationType}
                                        onChange={(val) =>
                                            setForm({ ...form, locationType: val as any })
                                        }
                                        options={[
                                            { value: "in_person", label: "In-Person (Campus)" },
                                            { value: "virtual", label: "Virtual (Online / Zoom / Meet)" },
                                            { value: "hybrid", label: "Hybrid (Campus + Stream)" },
                                        ]}
                                        size="sm"
                                        className="w-full"
                                        triggerClassName="h-9 font-bold bg-[#FAF6EE] text-xs border-2 border-black"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                        Venue or Location Details
                                    </label>
                                    <input
                                        type="text"
                                        value={form.venueOrLocation}
                                        onChange={(e) =>
                                            setForm({ ...form, venueOrLocation: e.target.value })
                                        }
                                        onBlur={() => handleBlur("venueOrLocation")}
                                        placeholder={
                                            form.locationType === "virtual"
                                                ? "e.g. Google Meet link / Zoom room"
                                                : "e.g. Main Auditorium, Block C"
                                        }
                                        className="w-full px-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* 4. Registration / RSVP URL */}
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                Registration / RSVP URL (Optional)
                            </label>
                            <input
                                type="url"
                                value={form.registrationUrl}
                                onChange={(e) =>
                                    setForm({ ...form, registrationUrl: e.target.value })
                                }
                                onBlur={() => handleBlur("registrationUrl")}
                                placeholder="https://forms.gle/... or https://unstop.com/..."
                                className={`w-full px-3.5 py-2.5 rounded-xl bg-white border-2 text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-hidden transition-all ${
                                    touched.registrationUrl && errors.registrationUrl
                                        ? "border-rose-500 bg-rose-50/50"
                                        : "border-black focus:ring-2 focus:ring-[#a2ff86]"
                                }`}
                            />
                            {touched.registrationUrl && errors.registrationUrl ? (
                                <p className="text-[11px] font-bold text-rose-600 mt-1 flex items-center gap-1">
                                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                                    <span>{errors.registrationUrl}</span>
                                </p>
                            ) : (
                                <p className="text-[10px] text-neutral-500 font-medium mt-1">
                                    Provide an external Google Form, Unstop, Luma, or ticketing link for participants.
                                </p>
                            )}
                        </div>

                        {/* 5. Brief Summary */}
                        <div>
                            <div className="flex items-center justify-between mb-1">
                                <label className="block text-xs font-black uppercase tracking-wider text-black">
                                    Brief Summary (1-2 Sentences)
                                </label>
                                <span className="text-[10px] font-mono font-bold text-neutral-500">
                                    {form.summary.length}/200
                                </span>
                            </div>
                            <input
                                type="text"
                                maxLength={200}
                                value={form.summary}
                                onChange={(e) => setForm({ ...form, summary: e.target.value })}
                                placeholder="A hands-on session exploring smart contracts, decentralized apps, and tooling..."
                                className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-hidden focus:ring-2 focus:ring-[#a2ff86]"
                            />
                        </div>

                        {/* 6. Full Description & Agenda */}
                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                Full Description & Agenda
                            </label>
                            <textarea
                                rows={4}
                                value={form.description}
                                onChange={(e) => setForm({ ...form, description: e.target.value })}
                                placeholder="Prerequisites, schedule, guest speaker details, certifications, and prizes..."
                                className="w-full p-3.5 rounded-xl bg-white border-2 border-black text-xs font-medium text-black shadow-[2px_2px_0px_#000] focus:outline-hidden focus:ring-2 focus:ring-[#a2ff86]"
                            />
                        </div>

                        {/* 7. Publish Status Selector */}
                        <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                            <label className="block text-xs font-black uppercase tracking-wider text-black">
                                Publication Stage
                            </label>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, status: "published" })}
                                    className={`p-3 rounded-xl border-2 text-left cursor-pointer transition-all ${
                                        form.status === "published"
                                            ? "bg-emerald-300 border-black shadow-[2px_2px_0px_#000] font-black"
                                            : "bg-[#FAF6EE] hover:bg-neutral-100 border-black/40 text-neutral-700"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black">Published</span>
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-800" />
                                    </div>
                                    <p className="text-[10px] text-neutral-700 mt-1 leading-snug">
                                        Live in directory & open for RSVPs
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, status: "draft" })}
                                    className={`p-3 rounded-xl border-2 text-left cursor-pointer transition-all ${
                                        form.status === "draft"
                                            ? "bg-amber-300 border-black shadow-[2px_2px_0px_#000] font-black"
                                            : "bg-[#FAF6EE] hover:bg-neutral-100 border-black/40 text-neutral-700"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black">Draft</span>
                                        <Info className="w-3.5 h-3.5 text-amber-800" />
                                    </div>
                                    <p className="text-[10px] text-neutral-700 mt-1 leading-snug">
                                        Saved internally for club team review
                                    </p>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setForm({ ...form, status: "cancelled" })}
                                    className={`p-3 rounded-xl border-2 text-left cursor-pointer transition-all ${
                                        form.status === "cancelled"
                                            ? "bg-rose-300 border-black shadow-[2px_2px_0px_#000] font-black"
                                            : "bg-[#FAF6EE] hover:bg-neutral-100 border-black/40 text-neutral-700"
                                    }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs font-black">Cancelled</span>
                                        <X className="w-3.5 h-3.5 text-rose-800" />
                                    </div>
                                    <p className="text-[10px] text-neutral-700 mt-1 leading-snug">
                                        Marked as cancelled for records
                                    </p>
                                </button>
                            </div>
                        </div>
                    </form>
                </div>

                {/* 50% RIGHT COLUMN: Banner Upload & Live Catalog Card Preview */}
                <div className="w-full lg:w-1/2 h-full overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 bg-white">
                    <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                        <div>
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                Step 2 of 2
                            </span>
                            <h3 className="text-base font-black text-black">Event Banner & Live Preview</h3>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-neutral-600">
                            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                            <span>Real-Time Catalog Rendering</span>
                        </div>
                    </div>

                    {/* Banner Upload Section */}
                    <div className="space-y-3">
                        <div>
                            <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                Event Cover Banner
                            </h4>
                            <p className="text-xs text-neutral-600 font-medium mt-0.5">
                                Import a cover image for your event, identical to coordinator and profile media.
                            </p>
                        </div>

                        {/* NeoImageDropzone with banner aspect ratio */}
                        <NeoImageDropzone
                            headline="Drag and drop your event banner here"
                            subtext="or click anywhere in this block to browse your device"
                            value={form.coverImageUrl}
                            onChange={handleBannerFileSelect}
                            onRemove={() => setForm({ ...form, coverImageUrl: "" })}
                            isUploading={isUploadingBanner}
                            uploadProgress={uploadProgress}
                            aspectRatio="banner"
                            maxSizeMB={5}
                            recommendedNote="Recommended 16:9 ratio (e.g. 1200x675px). PNG, JPG, or WEBP up to 5MB."
                        />
                    </div>

                    {/* Live Event Card Preview */}
                    <div className="space-y-3 pt-2">
                        <div className="flex items-center justify-between">
                            <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                Live Listing Card Preview
                            </h4>
                        </div>

                        <EventLiveListingCard
                            title={form.title}
                            summary={form.summary}
                            description={form.description}
                            startsAt={form.startsAt}
                            endsAt={form.endsAt}
                            venueOrLocation={form.venueOrLocation}
                            locationType={form.locationType}
                            registrationUrl={form.registrationUrl}
                            coverImageUrl={form.coverImageUrl}
                            status={form.status}
                            clubName={clubName || "Your Club Chapter"}
                            clubLogoUrl={clubLogoUrl}
                            collegeName={collegeName || "Your College Campus"}
                            eventId={editingEvent?.id}
                            slug={editingEvent?.slug}
                        />
                    </div>

                    {/* Banner Guidelines Callout Card */}
                    <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                        <div className="flex items-center gap-2">
                            <Info className="w-4 h-4 text-neutral-800" />
                            <h5 className="text-xs font-black uppercase tracking-wider text-black">
                                Banner Specifications
                            </h5>
                        </div>
                        <ul className="text-xs text-neutral-700 space-y-1 pl-5 list-disc font-medium">
                            <li>Supported formats: PNG, JPG, or WEBP</li>
                            <li>Maximum file size: 5 MB</li>
                            <li>Ideal dimensions: 1200 x 675 pixels (16:9 landscape aspect ratio)</li>
                            <li>High contrast and legible text work best for thumbnail cards</li>
                        </ul>
                    </div>
                </div>
            </div>

            {/* Bottom Floating Bar on Mobile */}
            <div className="p-3 bg-[#FAF6EE] border-t-2 border-black flex sm:hidden items-center justify-end gap-2 shrink-0">
                <button
                    type="button"
                    onClick={onClose}
                    disabled={isUploadingBanner}
                    className="px-4 py-2 rounded-xl bg-white border-2 border-black text-xs font-bold"
                >
                    Cancel
                </button>
                <OrbixButton
                    type="button"
                    onClick={handleSubmit}
                    variant="lime"
                    disabled={isUploadingBanner}
                    className="px-5 py-2 text-xs font-black"
                >
                    {editingEvent ? "Update Event" : "Create Event"}
                </OrbixButton>
            </div>
        </div>,
        document.body
    );
};

export default ClubEventModal;
