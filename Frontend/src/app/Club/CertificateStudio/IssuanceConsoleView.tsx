import React, { useState, useEffect, useMemo } from "react";
import {
    Award,
    Calendar,
    Users,
    Search,
    FileSpreadsheet,
    Check,
    Send,
    ArrowLeft,
    ArrowRight,
    ShieldCheck,
    Download,
    AlertTriangle,
    X,
    RefreshCw,
    UserX,
    HelpCircle,
    CheckCircle2,
    Plus,
    Trash2,
    Globe,
    Lock,
    ExternalLink,
    Building2,
    UploadCloud,
    Zap,
    XCircle,
} from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import {
    fetchClubEventsForCertificates,
    fetchClubEligibleRecipients,
    type CertificateEventItem,
    type EligibleRecipient,
} from "../../../api/clubCertificatesApi";
import {
    fetchCertificateTemplates,
    fetchEventEligibilityReport,
    issueCertificateBatch,
    fetchRecipientDirectory,
    fetchTeamRosterForReview,
    fetchBatchProgress,
    retryFailedBatch,
    cancelBatch,
    downloadBatchReportCsv,
    reconcileCsvRoster,
    downloadSampleCsvTemplate,
    type BatchIssuancePayload,
    type EventEligibilityReport,
    type CertificateTemplateRecord,
    type RecipientDirectoryItem,
    type ClubTeamDirectoryItem,
    type BatchProgressInfo,
    type CsvReconciliationResult,
} from "../../../api/certificateStudioApi";
import type { CertificateDesign } from "../../../types/certificateStudio";
import { CertificateThumbnailPreview } from "./TemplateSelectionView";
import { RecipientRosterTable, type RosterRecipientItem } from "./RecipientRosterTable";
import { NeoSelect } from "../../../components/NeoSelect";
import { NeoCheckbox } from "../../../components/NeoCheckbox";
import { NeoDateTimePicker } from "../../../components/NeoDateTimePicker";
import { ConfirmationModal } from "../../../components/ConfirmationModal";

// ============================================================================
// THE 16 STANDARD RECOGNIZED AWARD CATEGORIES (PHASE 10)
// ============================================================================
export const CERTIFICATE_CATEGORIES = [
    {
        value: "participation",
        label: "Event Participation",
        description: "General credential for confirmed registered event participants",
        badge: "GENERAL",
        ruleType: "Valid event registration with accepted status.",
    },
    {
        value: "attendance",
        label: "Verified Attendance",
        description: "Strictly requires confirmed electronic check-in evidence",
        badge: "STRICT ATTENDANCE",
        ruleType: "Confirmed attendance timestamp mandatory. Registration alone is strictly rejected.",
    },
    {
        value: "completion",
        label: "Course / Workshop Completion",
        description: "Requires fulfilled syllabus, turnout, or passing evaluation score",
        badge: "COMPLETION",
        ruleType: "Verified turnout or passing quiz score (≥ 50%) required.",
    },
    {
        value: "winner",
        label: "First Place Winner",
        description: "Premier top-ranking honor for competitions and hackathons",
        badge: "COMPETITIVE",
        ruleType: "Verified event attendee with verified competition result.",
    },
    {
        value: "first_runner_up",
        label: "First Runner-Up",
        description: "Second place competitive achievement honor",
        badge: "COMPETITIVE",
        ruleType: "Verified event attendee with verified competition result.",
    },
    {
        value: "second_runner_up",
        label: "Second Runner-Up",
        description: "Third place competitive achievement honor",
        badge: "COMPETITIVE",
        ruleType: "Verified event attendee with verified competition result.",
    },
    {
        value: "finalist",
        label: "Event Finalist",
        description: "Merit award for shortlisted final-round competitors",
        badge: "COMPETITIVE",
        ruleType: "Shortlisted competitive attendee.",
    },
    {
        value: "best_innovation",
        label: "Best Innovation",
        description: "Special honor for outstanding technical innovation or creative design",
        badge: "COMPETITIVE",
        ruleType: "Verified event attendee with innovation distinction.",
    },
    {
        value: "best_project",
        label: "Best Project",
        description: "Honor for premier team or individual project showcase",
        badge: "COMPETITIVE",
        ruleType: "Verified event attendee with recognized project showcase.",
    },
    {
        value: "best_performer",
        label: "Best Performer",
        description: "Recognizing outstanding individual contributor or presenter",
        badge: "COMPETITIVE",
        ruleType: "Verified individual attendee recognition.",
    },
    {
        value: "speaker",
        label: "Distinguished Speaker",
        description: "Appreciation credential for guest lecturer, panelist, or speaker",
        badge: "RECOGNITION",
        ruleType: "Explicit organizer-assigned guest dignitary or speaker role.",
    },
    {
        value: "mentor",
        label: "Event Mentor",
        description: "Honoring technical advisor, project coach, or hackathon mentor",
        badge: "RECOGNITION",
        ruleType: "Explicit organizer-assigned technical mentor role.",
    },
    {
        value: "judge",
        label: "Evaluation Judge",
        description: "Official appreciation for competition jury, evaluator, or reviewer",
        badge: "RECOGNITION",
        ruleType: "Explicit organizer-assigned jury role.",
    },
    {
        value: "volunteer",
        label: "Student Volunteer",
        description: "Recognizing student organizing crew, logistics, and crew members",
        badge: "RECOGNITION",
        ruleType: "Assigned student logistics or event volunteer member.",
    },
    {
        value: "organizer",
        label: "Lead Organizer",
        description: "Leadership credential for organizing core team leads and coordinators",
        badge: "LEADERSHIP",
        ruleType: "Club officer, core lead, or lead coordinator.",
    },
    {
        value: "custom",
        label: "Custom Achievement",
        description: "Club-defined merit, special recognition, or unique event honor",
        badge: "SPECIAL",
        ruleType: "Explicit club-defined award criteria.",
    },
];

type WizardStep =
    | "category"
    | "eligibility"
    | "recipients"
    | "template"
    | "mapping"
    | "preview"
    | "approve";

interface IssuanceConsoleViewProps {
    design?: CertificateDesign;
    templateId?: string | null;
    templateName?: string;
    preselectedEventId?: string | null;
    preselectedEventTitle?: string;
    onBatchIssued?: (batchId: string) => void;
    onBackToEditor?: () => void;
    onOpenPreview?: () => void;
}

export const IssuanceConsoleView: React.FC<IssuanceConsoleViewProps> = ({
    design: propDesign,
    templateId: propTemplateId,
    templateName: propTemplateName,
    preselectedEventId = null,
    preselectedEventTitle,
    onBatchIssued,
    onBackToEditor,
    onOpenPreview,
}) => {
    const toast = useToast();

    // Perspective Tab: "event" | "team" | "manual" | "csv"
    const [sourceTab, setSourceTab] = useState<"event" | "team" | "manual" | "csv">("event");

    // Wizard Step State for the Event-Integrated Issuance Lifecycle
    const [wizardStep, setWizardStep] = useState<WizardStep>("category");

    // View Mode: "wizard" (step-by-step guided flow) vs "compact" (fast all-in-one console)
    const [viewMode, setViewMode] = useState<"wizard" | "compact">("wizard");

    // Template state
    const [activeDesign, setActiveDesign] = useState<CertificateDesign | null>(propDesign || null);
    const [activeTemplateId, setActiveTemplateId] = useState<string | null>(propTemplateId || null);
    const [activeTemplateName, setActiveTemplateName] = useState<string>(propTemplateName || "Default Credential");
    const [availableTemplates, setAvailableTemplates] = useState<CertificateTemplateRecord[]>([]);
    const [isTemplatePickerOpen, setIsTemplatePickerOpen] = useState(false);

    // Events State
    const [events, setEvents] = useState<CertificateEventItem[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>(preselectedEventId || "");

    // Phase 10: Event Eligibility Engine State
    const [eligibilityReport, setEligibilityReport] = useState<EventEligibilityReport | null>(null);
    const [loadingEligibility, setLoadingEligibility] = useState(false);
    const [showExclusionsModal, setShowExclusionsModal] = useState(false);
    const [showManualReviewModal, setShowManualReviewModal] = useState(false);

    // Manual Attendance Override Flow
    const [showOverrideConfirmModal, setShowOverrideConfirmModal] = useState(false);
    const [overrideReason, setOverrideReason] = useState("");
    const [pendingUnverifiedUsers, setPendingUnverifiedUsers] = useState<any[]>([]);

    // Network / Manual State
    const [eligibleRecipients, setEligibleRecipients] = useState<EligibleRecipient[]>([]);
    const [customOverrides, setCustomOverrides] = useState<
        Record<string, { customPosition?: string; customName?: string }>
    >({});

    // Selected Recipient User IDs
    const [selectedUserIds, setSelectedUserIds] = useState<Set<string>>(new Set());

    // Phase 11: Manual & Team Recipient Directory State
    const [directorySource, setDirectorySource] = useState<
        "all" | "club_members" | "event_participants" | "team_members" | "teams" | "orbix_user"
    >("all");
    const [directorySearch, setDirectorySearch] = useState("");
    const [directoryRecipients, setDirectoryRecipients] = useState<RecipientDirectoryItem[]>([]);
    const [directoryTeams, setDirectoryTeams] = useState<ClubTeamDirectoryItem[]>([]);
    const [loadingDirectory, setLoadingDirectory] = useState(false);

    // Phase 11: External Recipients (Verified claim link workflow)
    const [externalRecipients, setExternalRecipients] = useState<
        Array<{
            id: string;
            name: string;
            email: string;
            customPosition?: string;
        }>
    >([]);
    const [showAddExternalModal, setShowAddExternalModal] = useState(false);
    const [extFormName, setExtFormName] = useState("");
    const [extFormEmail, setExtFormEmail] = useState("");
    const [extFormPosition, setExtFormPosition] = useState("");

    // Phase 12: Team & Individual Issuance Modes & Frozen Roster Snapshot
    const [teamIssuanceMode, setTeamIssuanceMode] = useState<"individual_only" | "team_only" | "both">("both");
    const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
    const [reviewingTeamId, setReviewingTeamId] = useState<string | null>(null);
    const [loadingTeamRoster, setLoadingTeamRoster] = useState(false);
    const [teamSnapshots, setTeamSnapshots] = useState<
        Record<
            string,
            {
                teamId: string;
                teamName: string;
                teamSlug?: string;
                members: Array<{
                    id: string;
                    userId?: string | null;
                    isExternal?: boolean;
                    name: string;
                    username?: string;
                    email?: string;
                    role: string;
                    customPosition?: string;
                    included: boolean;
                }>;
            }
        >
    >({});
    const [guestName, setGuestName] = useState("");
    const [guestRole, setGuestRole] = useState("Guest Contributor");
    const [guestEmail, setGuestEmail] = useState("");

    // Phase 11: Custom Issue Date & Supporting Metadata
    const [issueDateOverride, setIssueDateOverride] = useState<string>(
        new Date().toISOString().split("T")[0]
    );
    const [metadataTags, setMetadataTags] = useState<string>("");

    // Certificate metadata form
    const [title, setTitle] = useState(propTemplateName || "Certificate of Participation");
    const [certType, setCertType] = useState<string>("participation");
    const [description, setDescription] = useState("");
    const [signerName, setSignerName] = useState("");
    const [signerRole, setSignerRole] = useState("Lead Club Coordinator");
    const [awardPosition, setAwardPosition] = useState("");

    // Preview selection state (Step 6)
    const [previewScenario, setPreviewScenario] = useState<"first" | "longest" | "missing">("first");

    // Loading & progress
    const [csvRows, setCsvRows] = useState<Array<{ name: string; email: string; role?: string; matchedUserId?: string }>>([]);
    const [loadingEvents, setLoadingEvents] = useState(false);
    const [isIssuing, setIsIssuing] = useState(false);
    const [issuedBatchId, setIssuedBatchId] = useState<string | null>(null);

    // Phase 14: CSV Reconciliation State
    const [reconciledCsvResult, setReconciledCsvResult] = useState<CsvReconciliationResult | null>(null);
    const [csvFilterStatus, setCsvFilterStatus] = useState<"all" | "matched_student" | "external_recipient" | "invalid">("all");
    const [csvSearchQuery, setCsvSearchQuery] = useState("");
    const [isReconcilingCsv, setIsReconcilingCsv] = useState(false);
    const [selectedCsvIndices, setSelectedCsvIndices] = useState<Set<number>>(new Set());

    // Phase 13: Async Generation & Real-time Progress State
    const [activeBatchProgressId, setActiveBatchProgressId] = useState<string | null>(null);
    const [showProgressModal, setShowProgressModal] = useState(false);
    const [batchProgress, setBatchProgress] = useState<BatchProgressInfo | null>(null);
    const [isRetryingBatch, setIsRetryingBatch] = useState(false);

    // Load available templates if design is not provided
    useEffect(() => {
        const loadTemplates = async () => {
            try {
                const data = await fetchCertificateTemplates();
                const all = [...(data.systemTemplates || []), ...(data.clubTemplates || [])];
                setAvailableTemplates(all);
                if (!activeDesign && all.length > 0) {
                    setActiveDesign(all[0].design);
                    setActiveTemplateId(all[0].id);
                    setActiveTemplateName(all[0].name);
                }
            } catch (err) {
                console.error("Failed to load templates for issuance:", err);
            }
        };
        loadTemplates();
    }, [activeDesign]);

    // Load initial events
    useEffect(() => {
        const loadEvents = async () => {
            setLoadingEvents(true);
            try {
                const list = await fetchClubEventsForCertificates();
                setEvents(list);
                if (!selectedEventId && list.length > 0) {
                    setSelectedEventId(preselectedEventId || list[0].id);
                }
            } catch (err: any) {
                console.error("Failed to load events:", err);
            } finally {
                setLoadingEvents(false);
            }
        };
        loadEvents();
    }, [preselectedEventId, selectedEventId]);

    // Load Event Eligibility Report (Phase 10)
    useEffect(() => {
        if (!selectedEventId || sourceTab !== "event") return;

        const loadReport = async () => {
            setLoadingEligibility(true);
            try {
                const report = await fetchEventEligibilityReport(selectedEventId, certType);
                setEligibilityReport(report);

                // Default auto-selection
                if (certType === "attendance") {
                    const verified = report.eligibleRecipients
                        .filter((r) => !r.alreadyHasCert && r.status === "attended" && r.checkedInAt)
                        .map((r) => r.userId);
                    setSelectedUserIds(new Set(verified));
                } else {
                    const eligible = report.eligibleRecipients
                        .filter((r) => !r.alreadyHasCert)
                        .map((r) => r.userId);
                    setSelectedUserIds(new Set(eligible));
                }

                const cur = events.find((e) => e.id === selectedEventId);
                const eventName = preselectedEventTitle || cur?.title || report.eventTitle;
                if (eventName && (!title || title === "Certificate of Participation")) {
                    const catLabel = CERTIFICATE_CATEGORIES.find((c) => c.value === certType)?.label || "Certificate";
                    setTitle(`${catLabel} — ${eventName}`);
                }
            } catch (err: any) {
                console.error("Failed to load eligibility report:", err);
                toast.error(err.message || "Failed to load event eligibility report.");
            } finally {
                setLoadingEligibility(false);
            }
        };

        loadReport();
    }, [selectedEventId, certType, sourceTab, events, preselectedEventTitle, title]);

    // Load manual/network recipients
    useEffect(() => {
        if (sourceTab !== "manual") return;
        const loadNetwork = async () => {
            try {
                const list = await fetchClubEligibleRecipients("all", "");
                setEligibleRecipients(list);
            } catch (err: any) {
                toast.error(err.message || "Failed to load campus students.");
            }
        };
        loadNetwork();
    }, [sourceTab]);

    // Phase 11: Load Recipient Directory for Manual / Team issuance
    useEffect(() => {
        if (sourceTab !== "manual" && sourceTab !== "team") return;

        let isMounted = true;
        const loadDir = async () => {
            setLoadingDirectory(true);
            try {
                const targetSrc = sourceTab === "team" ? "teams" : directorySource;
                const res = await fetchRecipientDirectory(targetSrc, directorySearch);
                if (!isMounted) return;
                setDirectoryRecipients(res.recipients || []);
                setDirectoryTeams(res.teams || []);
            } catch (err: any) {
                if (!isMounted) return;
                console.error("Failed to load recipient directory:", err);
            } finally {
                if (isMounted) setLoadingDirectory(false);
            }
        };

        const timer = setTimeout(loadDir, 250);
        return () => {
            isMounted = false;
            clearTimeout(timer);
        };
    }, [sourceTab, directorySource, directorySearch]);

    // Filtered event recipients list
    const displayedRecipients = useMemo(() => {
        if (!eligibilityReport) return [];
        return eligibilityReport.eligibleRecipients || [];
    }, [eligibilityReport]);

    // Phase 13: Full Roster Items for Modern Multi-Select Table
    const eventRosterItems = useMemo<RosterRecipientItem[]>(() => {
        if (!eligibilityReport) return [];

        const eligibleList: RosterRecipientItem[] = (eligibilityReport.eligibleRecipients || []).map((r) => ({
            id: r.userId || r.registrationId,
            userId: r.userId,
            name: r.name,
            username: r.username,
            email: r.email,
            collegeName: r.collegeName,
            department: r.department,
            teamName: r.teamName,
            status: r.status,
            checkedInAt: r.checkedInAt,
            alreadyHasCert: r.alreadyHasCert,
            isEligible: true,
            customPosition: customOverrides[r.userId]?.customPosition,
            customName: customOverrides[r.userId]?.customName,
        }));

        const ineligibleList: RosterRecipientItem[] = (eligibilityReport.ineligibleRecipients || []).map((r: any) => ({
            id: r.userId || r.registrationId,
            userId: r.userId,
            name: r.name,
            username: r.username,
            email: r.email,
            collegeName: r.collegeName || "",
            department: r.department || "",
            teamName: r.teamName || "",
            status: r.status,
            checkedInAt: r.checkedInAt,
            alreadyHasCert: false,
            isEligible: false,
            exclusionReason: r.exclusionReason,
        }));

        return [...eligibleList, ...ineligibleList];
    }, [eligibilityReport, customOverrides]);

    const handleSelectMultipleUserIds = (ids: string[]) => {
        setSelectedUserIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.add(id));
            return next;
        });
    };

    const handleDeselectMultipleUserIds = (ids: string[]) => {
        setSelectedUserIds((prev) => {
            const next = new Set(prev);
            ids.forEach((id) => next.delete(id));
            return next;
        });
    };

    const handleUpdateCustomPosition = (id: string, position: string) => {
        setCustomOverrides((prev) => ({
            ...prev,
            [id]: {
                ...(prev[id] || {}),
                customPosition: position.trim() || undefined,
            },
        }));
    };

    // Phase 14: Filtered CSV rows based on search and status tabs
    const filteredCsvRows = useMemo(() => {
        if (!reconciledCsvResult) return [];
        return reconciledCsvResult.rows.filter((row) => {
            if (csvFilterStatus !== "all" && row.status !== csvFilterStatus) return false;
            if (csvSearchQuery.trim()) {
                const q = csvSearchQuery.toLowerCase();
                const matchName = row.name.toLowerCase().includes(q);
                const matchEmail = row.email.toLowerCase().includes(q);
                const matchRole = (row.role || "").toLowerCase().includes(q);
                const matchPos = (row.position || "").toLowerCase().includes(q);
                return matchName || matchEmail || matchRole || matchPos;
            }
            return true;
        });
    }, [reconciledCsvResult, csvFilterStatus, csvSearchQuery]);

    // Phase 14: CSV Selection helpers
    const toggleCsvIndex = (idx: number) => {
        setSelectedCsvIndices((prev) => {
            const next = new Set(prev);
            if (next.has(idx)) next.delete(idx);
            else next.add(idx);
            return next;
        });
    };

    const selectAllValidCsv = () => {
        if (!reconciledCsvResult) return;
        const valid = new Set<number>();
        reconciledCsvResult.rows.forEach((r) => {
            if (r.status !== "invalid") valid.add(r.index);
        });
        setSelectedCsvIndices(valid);
    };

    const deselectAllCsv = () => {
        setSelectedCsvIndices(new Set());
    };

    // Selection helpers
    const toggleUserId = (id: string) => {
        setSelectedUserIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAllCurrent = () => {
        if (sourceTab === "event") {
            const ids = displayedRecipients.filter((r) => !r.alreadyHasCert).map((r) => r.userId);
            setSelectedUserIds(new Set(ids));
        } else if (sourceTab === "manual" || sourceTab === "team") {
            if (sourceTab === "team" || directorySource === "teams") {
                const memberIds: string[] = [];
                directoryTeams.forEach((t) => {
                    t.members?.forEach((m) => {
                        if (m.userId) memberIds.push(m.userId);
                    });
                });
                setSelectedUserIds(new Set(memberIds));
            } else {
                const ids = directoryRecipients.map((r) => r.id);
                setSelectedUserIds(new Set(ids));
            }
        } else {
            const ids = eligibleRecipients.map((r) => r.id);
            setSelectedUserIds(new Set(ids));
        }
    };

    const deselectAll = () => setSelectedUserIds(new Set());

    // Phase 13 & 14: Sample CSV / XLSX Template Download
    const handleDownloadSampleFormat = async (format: "csv" | "xlsx" = "csv") => {
        try {
            const blob = await downloadSampleCsvTemplate(format);
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `orbix_recipients_template.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            window.URL.revokeObjectURL(url);
            toast.success(`Downloaded official sanitized ${format.toUpperCase()} template.`);
        } catch {
            toast.error(`Failed to download ${format.toUpperCase()} template.`);
        }
    };

    // Phase 14: CSV Roster Upload & Campus Reconciliation Handler
    const handleCsvUpload = async (file: File) => {
        if (!file.name.endsWith(".csv") && !file.name.endsWith(".tsv")) {
            toast.error("Please upload a valid .csv or .tsv file.");
            return;
        }

        setIsReconcilingCsv(true);
        try {
            const result = await reconcileCsvRoster({
                file,
                eventId: selectedEventId || undefined,
            });
            setReconciledCsvResult(result);

            // Auto-select valid rows
            const validIndices = new Set<number>();
            result.rows.forEach((r) => {
                if (r.status !== "invalid") {
                    validIndices.add(r.index);
                }
            });
            setSelectedCsvIndices(validIndices);

            // Populate fallback csvRows for compatibility
            setCsvRows(
                result.rows.map((r) => ({
                    name: r.name,
                    email: r.email,
                    role: r.role,
                    matchedUserId: r.matchedUser?.id,
                }))
            );

            toast.success(
                `Reconciled ${result.totalRows} rows: ${result.matchedStudentsCount} campus students, ${result.externalCount} external recipients.`
            );
        } catch (err: any) {
            toast.error(err.message || "Failed to reconcile CSV recipients.");
        } finally {
            setIsReconcilingCsv(false);
        }
    };

    // Phase 13: Poll batch progress in real-time
    useEffect(() => {
        if (!activeBatchProgressId || !showProgressModal) return;

        let isMounted = true;
        const poll = async () => {
            try {
                const prog = await fetchBatchProgress(activeBatchProgressId);
                if (!isMounted) return;
                setBatchProgress(prog);

                if (prog.status === "completed" || prog.status === "partially_failed" || prog.status === "failed") {
                    if (prog.status === "completed") {
                        toast.success("🎉 Background certificate generation completed successfully!");
                        if (onBatchIssued) onBatchIssued(activeBatchProgressId);
                    } else if (prog.status === "partially_failed") {
                        toast.warning("Batch completed with some render errors. You can retry failed items.");
                    } else if (prog.status === "failed") {
                        toast.error("Batch processing failed. Inspect error log.");
                    }
                }
            } catch (err) {
                console.error("Progress polling error:", err);
            }
        };

        poll();
        const interval = setInterval(poll, 1200);

        return () => {
            isMounted = false;
            clearInterval(interval);
        };
    }, [activeBatchProgressId, showProgressModal, onBatchIssued]);

    // Phase 13 & 14: Retry failed items in batch
    const handleRetryFailedBatch = async () => {
        if (!activeBatchProgressId) return;
        setIsRetryingBatch(true);
        try {
            const res = await retryFailedBatch(activeBatchProgressId);
            toast.success(res.message || "Failed recipients re-queued for background generation.");
            setBatchProgress((prev) => (prev ? { ...prev, status: "queued", failedCount: 0 } : null));
        } catch (err: any) {
            toast.error(err.message || "Failed to retry batch.");
        } finally {
            setIsRetryingBatch(false);
        }
    };

    // Phase 14: Cancel in-progress or queued batch
    const [isCancellingBatch, setIsCancellingBatch] = useState(false);
    const [isCancelModalOpen, setIsCancelModalOpen] = useState(false);

    const handleCancelBatch = () => {
        if (!activeBatchProgressId) return;
        setIsCancelModalOpen(true);
    };

    const handleConfirmCancelBatch = async () => {
        if (!activeBatchProgressId) return;
        setIsCancellingBatch(true);
        try {
            const res = await cancelBatch(activeBatchProgressId);
            toast.warning(res.message);
            setBatchProgress((prev) => (prev ? { ...prev, status: "cancelled" } : null));
            setIsCancelModalOpen(false);
        } catch (err: any) {
            toast.error(err.message || "Failed to cancel batch.");
        } finally {
            setIsCancellingBatch(false);
        }
    };

    // Phase 14: Download generation audit report (CSV)
    const handleDownloadReport = async () => {
        if (!activeBatchProgressId) return;
        try {
            await downloadBatchReportCsv(activeBatchProgressId);
            toast.success("Generation audit report downloaded!");
        } catch (err: any) {
            toast.error(err.message || "Failed to download report.");
        }
    };

    // Phase 12: Open Team Roster Review & initialize frozen membership snapshot
    const handleOpenTeamReview = async (team: ClubTeamDirectoryItem) => {
        setReviewingTeamId(team.teamId);
        if (!teamSnapshots[team.teamId]) {
            setLoadingTeamRoster(true);
            try {
                const roster = await fetchTeamRosterForReview(team.teamId, selectedEventId);
                setTeamSnapshots((prev) => ({
                    ...prev,
                    [team.teamId]: {
                        teamId: roster.teamId,
                        teamName: roster.teamName,
                        teamSlug: roster.teamSlug,
                        members: roster.members.map((m) => ({
                            id: m.id || m.userId || `m-${Math.random()}`,
                            userId: m.userId || null,
                            isExternal: Boolean(m.isExternal),
                            name: m.name,
                            username: m.username || "",
                            email: m.email || "",
                            role: m.role || "Member",
                            customPosition: m.customPosition || awardPosition || "",
                            included: true,
                        })),
                    },
                }));
            } catch {
                setTeamSnapshots((prev) => ({
                    ...prev,
                    [team.teamId]: {
                        teamId: team.teamId,
                        teamName: team.teamName,
                        teamSlug: (team as any).teamSlug,
                        members: (team.members || []).map((m) => ({
                            id: m.userId || `m-${Math.random()}`,
                            userId: m.userId || null,
                            isExternal: false,
                            name: m.name,
                            username: m.username || "",
                            email: (m as any).email || "",
                            role: m.role || "Member",
                            customPosition: awardPosition || "",
                            included: true,
                        })),
                    },
                }));
            } finally {
                setLoadingTeamRoster(false);
            }
        }
        setSelectedTeamIds((prev) => new Set([...prev, team.teamId]));
    };

    // Phase 12: Deduplication calculation across teams & recipients
    const deduplicationStats = useMemo(() => {
        const seenUserKeys = new Map<string, number>();
        let dupCount = 0;

        selectedTeamIds.forEach((tId) => {
            const snap = teamSnapshots[tId];
            const members = snap?.members || directoryTeams.find((t) => t.teamId === tId)?.members || [];
            members.forEach((m: any) => {
                if (m.included !== false) {
                    const key = m.userId ? `u:${m.userId}` : `e:${(m.email || m.name || "").toLowerCase().trim()}`;
                    if (key && key !== "e:") {
                        seenUserKeys.set(key, (seenUserKeys.get(key) || 0) + 1);
                    }
                }
            });
        });

        selectedUserIds.forEach((uId) => {
            const key = `u:${uId}`;
            seenUserKeys.set(key, (seenUserKeys.get(key) || 0) + 1);
        });

        externalRecipients.forEach((ext) => {
            const key = `e:${(ext.email || "").toLowerCase().trim()}`;
            if (key !== "e:") {
                seenUserKeys.set(key, (seenUserKeys.get(key) || 0) + 1);
            }
        });

        seenUserKeys.forEach((count) => {
            if (count > 1) dupCount += count - 1;
        });

        return {
            hasDuplicates: dupCount > 0,
            duplicateCount: dupCount,
            uniqueIndividuals: seenUserKeys.size,
        };
    }, [selectedTeamIds, teamSnapshots, directoryTeams, selectedUserIds, externalRecipients]);

    // Pre-dispatch validation & manual override trigger
    const handleInitiateDispatch = () => {
        const hasRecipients = selectedUserIds.size > 0 || externalRecipients.length > 0;
        const hasTeams = selectedTeamIds.size > 0;

        if (!hasRecipients && !hasTeams) {
            toast.error("Please select at least one recipient or team to receive a certificate.");
            return;
        }

        if (sourceTab === "event" && certType === "attendance" && eligibilityReport) {
            const unverifiedSelected = eligibilityReport.eligibleRecipients.filter(
                (r) => selectedUserIds.has(r.userId) && (r.status !== "attended" || !r.checkedInAt)
            );

            if (unverifiedSelected.length > 0) {
                setPendingUnverifiedUsers(unverifiedSelected);
                setOverrideReason("");
                setShowOverrideConfirmModal(true);
                return;
            }
        }

        executeBatchDispatch(false, undefined);
    };

    // Authoritative batch dispatch execution
    const executeBatchDispatch = async (allowManualOverride = false, reason?: string) => {
        try {
            setIsIssuing(true);

            let recipientsPayload: Array<{
                userId?: string;
                isExternal?: boolean;
                email?: string;
                name?: string;
                customName?: string;
                customRole?: string;
                customPosition?: string;
            }> = [];

            if (sourceTab === "event" && eligibilityReport) {
                recipientsPayload = eligibilityReport.eligibleRecipients
                    .filter((r) => selectedUserIds.has(r.userId))
                    .map((r) => ({
                        userId: r.userId,
                        customName: r.name,
                        customPosition: awardPosition || undefined,
                    }));
            } else if (sourceTab === "manual" || sourceTab === "team") {
                // Registered users from directory
                const registeredSelected = directoryRecipients
                    .filter((r) => selectedUserIds.has(r.id))
                    .map((r) => ({
                        userId: r.id,
                        customName: r.name,
                        customPosition: awardPosition || undefined,
                    }));

                // Fallback from eligibleRecipients
                const fallbackSelected = eligibleRecipients
                    .filter((r) => selectedUserIds.has(r.id) && !registeredSelected.some((reg) => reg.userId === r.id))
                    .map((r) => ({
                        userId: r.id,
                        customName: r.name,
                        customPosition: awardPosition || undefined,
                    }));

                // Team members if teams were expanded directly into selectedUserIds
                const teamMemberSelected: Array<{ userId: string; customName: string; customPosition?: string }> = [];
                directoryTeams.forEach((t) => {
                    t.members?.forEach((m) => {
                        if (
                            m.userId &&
                            selectedUserIds.has(m.userId) &&
                            !registeredSelected.some((reg) => reg.userId === m.userId) &&
                            !fallbackSelected.some((f) => f.userId === m.userId)
                        ) {
                            teamMemberSelected.push({
                                userId: m.userId,
                                customName: m.name,
                                customPosition: m.role || awardPosition || undefined,
                            });
                        }
                    });
                });

                // External claim recipients
                const externalSelected = externalRecipients.map((ext) => ({
                    isExternal: true,
                    name: ext.name,
                    email: ext.email,
                    customName: ext.name,
                    customPosition: ext.customPosition || awardPosition || undefined,
                }));

                recipientsPayload = [
                    ...registeredSelected,
                    ...fallbackSelected,
                    ...teamMemberSelected,
                    ...externalSelected,
                ];
            } else if (sourceTab === "csv") {
                if (reconciledCsvResult && reconciledCsvResult.rows.length > 0) {
                    recipientsPayload = reconciledCsvResult.rows
                        .filter((r) => selectedCsvIndices.has(r.index) && r.status !== "invalid")
                        .map((r) => ({
                            userId: r.matchedUser?.id,
                            isExternal: r.status === "external_recipient",
                            name: r.name,
                            email: r.email,
                            customName: r.name,
                            customPosition: r.position || awardPosition || undefined,
                            customRole: r.role || undefined,
                        }));
                } else {
                    recipientsPayload = csvRows.map((r) => ({
                        userId: r.matchedUserId,
                        isExternal: !r.matchedUserId,
                        name: r.name,
                        email: r.email,
                        customName: r.name,
                        customPosition: r.role || awardPosition || undefined,
                    }));
                }
            } else {
                recipientsPayload = Array.from(selectedUserIds).map((uid) => ({
                    userId: uid,
                    customPosition: awardPosition || undefined,
                }));
            }

            // Phase 12: Assemble team roster snapshots
            const finalTeamSnapshotsPayload = Array.from(selectedTeamIds).map((tId) => {
                const snap = teamSnapshots[tId];
                if (snap) {
                    return {
                        teamId: snap.teamId,
                        teamName: snap.teamName,
                        teamSlug: snap.teamSlug,
                        members: snap.members.filter((m) => m.included).map((m) => ({
                            userId: m.userId || null,
                            isExternal: Boolean(m.isExternal),
                            name: m.name,
                            username: m.username,
                            email: m.email,
                            role: m.role,
                            customPosition: m.customPosition || awardPosition || undefined,
                        })),
                    };
                }
                const dirTeam = directoryTeams.find((t) => t.teamId === tId);
                return {
                    teamId: tId,
                    teamName: dirTeam?.teamName || "Team",
                    teamSlug: (dirTeam as any)?.teamSlug,
                    members: (dirTeam?.members || []).map((m) => ({
                        userId: m.userId || null,
                        isExternal: false,
                        name: m.name,
                        username: m.username,
                        email: (m as any).email,
                        role: m.role || "Member",
                        customPosition: awardPosition || undefined,
                    })),
                };
            });

            const isAsync = recipientsPayload.length > 15;
            const payload: BatchIssuancePayload = {
                templateId: activeTemplateId || undefined,
                customDesign: !activeTemplateId ? activeDesign : undefined,
                title: title.trim() || "Certificate of Participation",
                certificateType: certType,
                issuanceSource: sourceTab,
                eventId: sourceTab === "event" ? selectedEventId : undefined,
                awardPosition: awardPosition.trim() || undefined,
                description: description.trim() || undefined,
                signerName: signerName.trim() || undefined,
                signerRole: signerRole.trim() || undefined,
                issueDate: issueDateOverride || undefined,
                teamIssuanceMode: (sourceTab === "team" || selectedTeamIds.size > 0) ? teamIssuanceMode : undefined,
                teamSnapshots: finalTeamSnapshotsPayload.length > 0 ? finalTeamSnapshotsPayload : undefined,
                metadata: metadataTags.trim()
                    ? { tags: metadataTags.split(",").map((s) => s.trim()).filter(Boolean) }
                    : undefined,
                recipients: recipientsPayload,
                allowManualOverride,
                overrideReason: reason,
                asyncMode: isAsync || undefined,
                idempotencyKey: `batch-${selectedEventId || "m"}-${Date.now()}`,
            };

            const res = await issueCertificateBatch(payload);
            if (res.isAsync) {
                setActiveBatchProgressId(res.batchId);
                setShowProgressModal(true);
                setShowOverrideConfirmModal(false);
                setIssuedBatchId(res.batchId);
                toast.info(`⚡ Batch queued in worker pool with bounded concurrency.`);
            } else {
                toast.success(res.message || `Successfully issued ${res.successfulCount} credentials!`);
                if (res.deduplicatedCount && res.deduplicatedCount > 0) {
                    toast.info(`⚡ Deduplication: ${res.deduplicatedCount} duplicate recipient overlap(s) consolidated.`);
                }
                setShowOverrideConfirmModal(false);
                setIssuedBatchId(res.batchId);
                if (onBatchIssued) onBatchIssued(res.batchId);
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to dispatch certificate batch.");
        } finally {
            setIsIssuing(false);
        }
    };

    // Active event title for displays
    const activeEventObj = useMemo(() => {
        return events.find((e) => e.id === selectedEventId);
    }, [events, selectedEventId]);

    // Step 4 Template Priority Sorting: Always place the currently selected template first (index 0)
    const sortedTemplatesForStep4 = useMemo(() => {
        return [...availableTemplates].sort((a, b) => {
            const aSelected = a.id === activeTemplateId || a.name === activeTemplateName;
            const bSelected = b.id === activeTemplateId || b.name === activeTemplateName;
            if (aSelected && !bSelected) return -1;
            if (!aSelected && bSelected) return 1;
            return 0;
        });
    }, [availableTemplates, activeTemplateId, activeTemplateName]);

    const activeEventTitle = preselectedEventTitle || activeEventObj?.title || eligibilityReport?.eventTitle || "Selected Event";

    // Preview recipient calculation (Step 6)
    const previewRecipient = useMemo(() => {
        if (!eligibilityReport || eligibilityReport.eligibleRecipients.length === 0) {
            return {
                name: "Venkata Ramanatha Swamy",
                college: "Delhi Technological University",
            };
        }
        const selectedList = eligibilityReport.eligibleRecipients.filter((r) => selectedUserIds.has(r.userId));
        const listToUse = selectedList.length > 0 ? selectedList : eligibilityReport.eligibleRecipients;

        if (previewScenario === "longest") {
            const sortedByLen = [...listToUse].sort((a, b) => b.name.length - a.name.length);
            return {
                name: sortedByLen[0].name,
                college: sortedByLen[0].collegeName || "Engineering Campus",
            };
        }

        if (previewScenario === "missing") {
            return {
                name: "Alex",
                college: "Campus Member",
            };
        }

        return {
            name: listToUse[0].name,
            college: listToUse[0].collegeName || "Delhi Technological University",
        };
    }, [eligibilityReport, selectedUserIds, previewScenario]);

    // Validation Report checks (Step 6)
    const validationStatus = useMemo(() => {
        const hasTitle = Boolean(title.trim());
        const hasTemplate = Boolean(activeDesign);
        const hasRecipients = (selectedUserIds.size + externalRecipients.length) > 0;
        const hasSigners = Boolean(signerName.trim() || signerRole.trim());
        const hasAttendanceDiscrepancy = Boolean(
            sourceTab === "event" &&
            certType === "attendance" &&
            eligibilityReport &&
            eligibilityReport.eligibleRecipients.some(
                (r) => selectedUserIds.has(r.userId) && (r.status !== "attended" || !r.checkedInAt)
            )
        );

        return {
            hasTitle,
            hasTemplate,
            hasRecipients,
            hasSigners,
            hasAttendanceDiscrepancy,
            isAllClear: hasTitle && hasTemplate && hasRecipients,
        };
    }, [title, activeDesign, selectedUserIds, signerName, signerRole, sourceTab, certType, eligibilityReport]);

    // ============================================================================
    // STEP DEFINITIONS FOR EVENT-INTEGRATED ISSUANCE FLOW
    // ============================================================================
    const WIZARD_STEPS: Array<{ id: WizardStep; label: string; number: number }> = [
        { id: "category", label: "Award Category", number: 1 },
        { id: "eligibility", label: "Eligibility & Audit", number: 2 },
        { id: "recipients", label: "Select Recipients", number: 3 },
        { id: "template", label: "Certificate Template", number: 4 },
        { id: "mapping", label: "Field Mapping", number: 5 },
        { id: "preview", label: "Live Preview", number: 6 },
        { id: "approve", label: "Approve & Issue", number: 7 },
    ];

    const currentStepIndex = WIZARD_STEPS.findIndex((s) => s.id === wizardStep);

    return (
        <div className="space-y-6">
            {/* Top Bar with Mode Switcher & Primary Actions */}
            <div className="p-4 bg-white rounded-2xl border-3 border-black shadow-[3px_3px_0px_#000] flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                    {onBackToEditor && (
                        <button
                            type="button"
                            onClick={onBackToEditor}
                            className="p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 shadow-[2px_2px_0px_#000] cursor-pointer"
                            title="Back to Visual Editor"
                        >
                            <ArrowLeft className="w-4 h-4 text-black" />
                        </button>
                    )}
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-black text-lg text-black">
                                Certificate Studio & Credential Issuance
                            </h3>
                            <span className="px-2 py-0.5 rounded-full bg-[#FFE566] border border-black text-[10px] font-black uppercase">
                                Event Integrated
                            </span>
                        </div>
                        <p className="text-xs text-neutral-600 font-bold flex items-center gap-1.5 mt-0.5">
                            <span>Event:</span>
                            <span className="text-black bg-[#FAF6EE] px-2 py-0.5 rounded border border-black/20 font-black">
                                {activeEventTitle}
                            </span>
                            <span>·</span>
                            <span>Template:</span>
                            <span className="text-black bg-neutral-100 px-2 py-0.5 rounded border border-black/20">
                                {activeTemplateName}
                            </span>
                            <button
                                type="button"
                                onClick={() => setIsTemplatePickerOpen(true)}
                                className="text-blue-700 hover:text-blue-900 underline font-black ml-1 cursor-pointer"
                            >
                                Change
                            </button>
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {/* View Mode Toggle */}
                    <div className="flex items-center bg-[#FAF6EE] p-1 rounded-xl border-2 border-black">
                        <button
                            type="button"
                            onClick={() => setViewMode("wizard")}
                            className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                viewMode === "wizard"
                                    ? "bg-black text-[#FFE566] shadow-[1px_1px_0px_#000]"
                                    : "text-neutral-700 hover:bg-neutral-200"
                            }`}
                        >
                            Guided Flow
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode("compact")}
                            className={`px-2.5 py-1 rounded-lg text-xs font-black transition-all cursor-pointer ${
                                viewMode === "compact"
                                    ? "bg-black text-[#FFE566] shadow-[1px_1px_0px_#000]"
                                    : "text-neutral-700 hover:bg-neutral-200"
                            }`}
                        >
                            All-in-One Console
                        </button>
                    </div>

                    <span className="px-3 py-1.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-black text-black">
                        {selectedUserIds.size + externalRecipients.length + selectedTeamIds.size} Target(s) Selected
                    </span>

                    {onOpenPreview && (
                        <button
                            type="button"
                            onClick={onOpenPreview}
                            className="px-3.5 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                        >
                            <ShieldCheck className="w-4 h-4 text-emerald-600" />
                            <span>Preview Canvas</span>
                        </button>
                    )}

                    <button
                        type="button"
                        onClick={handleInitiateDispatch}
                        disabled={isIssuing || (selectedUserIds.size === 0 && externalRecipients.length === 0 && selectedTeamIds.size === 0)}
                        className="px-5 py-2 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8ee673] disabled:opacity-40 text-xs sm:text-sm font-black shadow-[3px_3px_0px_#000] flex items-center gap-2 transition-transform active:translate-x-0.5 active:translate-y-0.5 cursor-pointer"
                    >
                        {isIssuing ? (
                            <>
                                <RefreshCw className="w-4 h-4 animate-spin" />
                                <span>Generating & Signing...</span>
                            </>
                        ) : (
                            <>
                                <Send className="w-4 h-4" />
                                <span>Issue Credentials</span>
                            </>
                        )}
                    </button>
                </div>
            </div>

            {/* Source Selection Tabs (Event / Network / Team / CSV) */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <button
                    type="button"
                    onClick={() => {
                        setSourceTab("event");
                        setWizardStep("category");
                    }}
                    className={`p-3.5 rounded-2xl border-3 border-black text-left transition-all cursor-pointer ${
                        sourceTab === "event"
                            ? "bg-[#FFE566] shadow-[3px_3px_0px_#000] font-black"
                            : "bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000]"
                    }`}
                >
                    <Calendar className="w-5 h-5 text-black mb-1.5" />
                    <div className="text-xs sm:text-sm font-black text-black">1. Event Integrated</div>
                    <div className="text-[11px] text-neutral-600 font-normal">Attendance & registered roster</div>
                </button>

                <button
                    type="button"
                    onClick={() => setSourceTab("manual")}
                    className={`p-3.5 rounded-2xl border-3 border-black text-left transition-all cursor-pointer ${
                        sourceTab === "manual"
                            ? "bg-[#FFE566] shadow-[3px_3px_0px_#000] font-black"
                            : "bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000]"
                    }`}
                >
                    <Users className="w-5 h-5 text-black mb-1.5" />
                    <div className="text-xs sm:text-sm font-black text-black">2. Campus Directory</div>
                    <div className="text-[11px] text-neutral-600 font-normal">Direct student directory</div>
                </button>

                <button
                    type="button"
                    onClick={() => setSourceTab("team")}
                    className={`p-3.5 rounded-2xl border-3 border-black text-left transition-all cursor-pointer ${
                        sourceTab === "team"
                            ? "bg-[#FFE566] shadow-[3px_3px_0px_#000] font-black"
                            : "bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000]"
                    }`}
                >
                    <Award className="w-5 h-5 text-black mb-1.5" />
                    <div className="text-xs sm:text-sm font-black text-black">3. Team Credential</div>
                    <div className="text-[11px] text-neutral-600 font-normal">Hackathon & club teams</div>
                </button>

                <button
                    type="button"
                    onClick={() => setSourceTab("csv")}
                    className={`p-3.5 rounded-2xl border-3 border-black text-left transition-all cursor-pointer ${
                        sourceTab === "csv"
                            ? "bg-[#FFE566] shadow-[3px_3px_0px_#000] font-black"
                            : "bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000]"
                    }`}
                >
                    <FileSpreadsheet className="w-5 h-5 text-black mb-1.5" />
                    <div className="text-xs sm:text-sm font-black text-black">4. CSV Roster</div>
                    <div className="text-[11px] text-neutral-600 font-normal">Spreadsheet bulk import</div>
                </button>
            </div>

            {/* ================================================================ */}
            {/* EVENT-INTEGRATED ISSUANCE WORKFLOW (PHASE 10 PRIMARY FLOW) */}
            {/* ================================================================ */}
            {sourceTab === "event" && viewMode === "wizard" && (
                <div className="space-y-6">
                    {/* Interactive Horizontal Flow Stepper */}
                    <div className="p-3 bg-white rounded-2xl border-3 border-black shadow-[3px_3px_0px_#000] overflow-x-auto">
                        <div className="flex items-center gap-2 min-w-max">
                            {WIZARD_STEPS.map((step, idx) => {
                                const isCurrent = wizardStep === step.id;
                                const isPassed = currentStepIndex > idx;
                                return (
                                    <React.Fragment key={step.id}>
                                        <button
                                            type="button"
                                            onClick={() => setWizardStep(step.id)}
                                            className={`px-3 py-1.5 rounded-xl border-2 border-black text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                                                isCurrent
                                                    ? "bg-[#FFE566] text-black shadow-[2px_2px_0px_#000]"
                                                    : isPassed
                                                    ? "bg-[#a2ff86] text-black"
                                                    : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                                            }`}
                                        >
                                            <span
                                                className={`w-4 h-4 rounded-full text-[10px] font-black flex items-center justify-center border border-black ${
                                                    isPassed ? "bg-black text-[#a2ff86]" : isCurrent ? "bg-black text-[#FFE566]" : "bg-white text-black"
                                                }`}
                                            >
                                                {isPassed ? "✓" : step.number}
                                            </span>
                                            <span>{step.label}</span>
                                        </button>
                                        {idx < WIZARD_STEPS.length - 1 && (
                                            <span className="text-neutral-400 font-black text-xs">→</span>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </div>
                    </div>

                    {/* STEP 1: SELECT AWARD CATEGORY */}
                    {wizardStep === "category" && (
                        <div className="p-6 bg-white rounded-3xl border-3 border-black shadow-[5px_5px_0px_#000] space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black/10 pb-4">
                                <div>
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black text-[#FFE566]">
                                        STEP 1 OF 7
                                    </span>
                                    <h4 className="text-lg font-black text-black mt-1">
                                        Select Award Category
                                    </h4>
                                    <p className="text-xs text-neutral-600 font-medium">
                                        Choose the type of credential you wish to grant. Specific eligibility rules are evaluated against event records.
                                    </p>
                                </div>
                                <span className="text-xs font-black bg-[#FAF6EE] border border-black px-3 py-1.5 rounded-xl">
                                    16 Categories Available
                                </span>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
                                {CERTIFICATE_CATEGORIES.map((cat) => {
                                    const isSelected = certType === cat.value;
                                    return (
                                        <div
                                            key={cat.value}
                                            onClick={() => {
                                                setCertType(cat.value);
                                                const catLabel = cat.label;
                                                setTitle(`${catLabel} — ${activeEventTitle}`);
                                            }}
                                            className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                                                isSelected
                                                    ? "border-black bg-[#FFE566]/25 shadow-[4px_4px_0px_#000]"
                                                    : "border-black/20 hover:border-black bg-white hover:shadow-[3px_3px_0px_#000]"
                                            }`}
                                        >
                                            <div className="space-y-1.5">
                                                <div className="flex items-center justify-between">
                                                    <span
                                                        className={`text-[9px] font-black px-2 py-0.5 rounded-full border border-black ${
                                                            cat.badge === "STRICT ATTENDANCE"
                                                                ? "bg-rose-200 text-rose-900"
                                                                : cat.badge === "COMPETITIVE"
                                                                ? "bg-amber-200 text-amber-900"
                                                                : cat.badge === "COMPLETION"
                                                                ? "bg-purple-200 text-purple-900"
                                                                : "bg-neutral-100 text-neutral-800"
                                                        }`}
                                                    >
                                                        {cat.badge}
                                                    </span>
                                                    <div
                                                        className={`w-4 h-4 rounded-full border-2 border-black flex items-center justify-center ${
                                                            isSelected ? "bg-black" : "bg-white"
                                                        }`}
                                                    >
                                                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-[#FFE566]" />}
                                                    </div>
                                                </div>
                                                <h5 className="font-black text-sm text-black leading-tight">
                                                    {cat.label}
                                                </h5>
                                                <p className="text-[11px] text-neutral-600 font-medium leading-relaxed">
                                                    {cat.description}
                                                </p>
                                            </div>

                                            <div className="p-2 rounded-xl bg-[#FAF6EE] border border-black/10 text-[10px] text-neutral-700 font-bold">
                                                Rule: {cat.ruleType}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between">
                                <div className="text-xs font-black text-neutral-600">
                                    Selected Category: <span className="text-black uppercase">{certType}</span>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setWizardStep("eligibility")}
                                    className="px-6 py-2.5 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ebd04e] text-xs sm:text-sm font-black shadow-[3px_3px_0px_#000] flex items-center gap-2 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    <span>Evaluate Eligibility</span>
                                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 2: EVALUATE ELIGIBILITY & AUTHORITATIVE 7-METRIC AUDIT */}
                    {wizardStep === "eligibility" && (
                        <div className="p-6 bg-white rounded-3xl border-3 border-black shadow-[5px_5px_0px_#000] space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black/10 pb-4">
                                <div>
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black text-[#FFE566]">
                                        STEP 2 OF 7
                                    </span>
                                    <h4 className="text-lg font-black text-black mt-1">
                                        Authoritative Eligibility Audit
                                    </h4>
                                    <p className="text-xs text-neutral-600 font-medium">
                                        Evaluating registrations against rules for &ldquo;{certType}&rdquo;. Registration alone is never treated as verified attendance.
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowExclusionsModal(true)}
                                    className="px-3.5 py-1.5 rounded-xl border-2 border-black bg-rose-50 hover:bg-rose-100 text-xs font-black text-rose-900 shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer"
                                >
                                    <UserX className="w-4 h-4 text-rose-700" />
                                    <span>Inspect Exclusion Reasons</span>
                                </button>
                            </div>

                            {/* 7-Metric Authoritative Cards */}
                            {loadingEligibility ? (
                                <div className="p-12 text-center space-y-3">
                                    <RefreshCw className="w-8 h-8 animate-spin mx-auto text-black" />
                                    <p className="text-xs font-black text-neutral-600">
                                        Evaluating applicant registrations & attendance records...
                                    </p>
                                </div>
                            ) : eligibilityReport ? (
                                <div className="space-y-6">
                                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
                                        <div className="p-3 bg-[#FAF6EE] rounded-2xl border-2 border-black text-center">
                                            <div className="text-[10px] font-black uppercase text-neutral-500">1. Total Signups</div>
                                            <div className="text-2xl font-black text-black mt-1">
                                                {eligibilityReport.summary.totalRegistrations}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-emerald-50 rounded-2xl border-2 border-black text-center">
                                            <div className="text-[10px] font-black uppercase text-emerald-800">2. Eligible</div>
                                            <div className="text-2xl font-black text-emerald-700 mt-1">
                                                {eligibilityReport.summary.eligibleCount}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-sky-50 rounded-2xl border-2 border-black text-center">
                                            <div className="text-[10px] font-black uppercase text-sky-800">3. Attended</div>
                                            <div className="text-2xl font-black text-sky-700 mt-1">
                                                {eligibilityReport.summary.verifiedAttendeesCount}
                                            </div>
                                        </div>
                                        <div
                                            onClick={() => setShowExclusionsModal(true)}
                                            className="p-3 bg-rose-50 rounded-2xl border-2 border-black text-center cursor-pointer hover:bg-rose-100 transition-colors"
                                        >
                                            <div className="text-[10px] font-black uppercase text-rose-800 flex items-center justify-center gap-1">
                                                <span>4. Excluded</span>
                                                <span className="text-[9px] underline">Inspect</span>
                                            </div>
                                            <div className="text-2xl font-black text-rose-700 mt-1">
                                                {eligibilityReport.summary.ineligibleCount}
                                            </div>
                                        </div>
                                        <div
                                            onClick={() => setShowManualReviewModal(true)}
                                            className="p-3 bg-amber-50 rounded-2xl border-2 border-black text-center cursor-pointer hover:bg-amber-100 transition-colors"
                                        >
                                            <div className="text-[10px] font-black uppercase text-amber-800 flex items-center justify-center gap-1">
                                                <span>5. Review</span>
                                                <span className="text-[9px] underline">Inspect</span>
                                            </div>
                                            <div className="text-2xl font-black text-amber-700 mt-1">
                                                {eligibilityReport.summary.manualReviewCount}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-neutral-100 rounded-2xl border-2 border-black text-center">
                                            <div className="text-[10px] font-black uppercase text-neutral-600">6. Missing Info</div>
                                            <div className="text-2xl font-black text-neutral-800 mt-1">
                                                {eligibilityReport.summary.missingInfoCount}
                                            </div>
                                        </div>
                                        <div className="p-3 bg-purple-50 rounded-2xl border-2 border-black text-center">
                                            <div className="text-[10px] font-black uppercase text-purple-800">7. Team Eligible</div>
                                            <div className="text-2xl font-black text-purple-700 mt-1">
                                                {eligibilityReport.summary.teamEligibilityCount}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Inline Exclusions Breakdown */}
                                    <div className="p-4 bg-[#FAF6EE] rounded-2xl border-2 border-black space-y-3">
                                        <div className="flex items-center justify-between text-xs font-black">
                                            <span className="flex items-center gap-1.5">
                                                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                                                <span>Exclusion Reason Inspection</span>
                                            </span>
                                            <span className="text-[11px] text-neutral-500 font-bold">
                                                {eligibilityReport.ineligibleRecipients.length} Disqualified / Excluded
                                            </span>
                                        </div>

                                        {eligibilityReport.ineligibleRecipients.length === 0 ? (
                                            <p className="text-xs text-neutral-500 py-3 text-center font-bold">
                                                ✓ All registered applicants qualify for &ldquo;{certType}&rdquo; credentials.
                                            </p>
                                        ) : (
                                            <div className="max-h-52 overflow-y-auto divide-y divide-neutral-200 text-xs">
                                                {eligibilityReport.ineligibleRecipients.slice(0, 10).map((inelig) => (
                                                    <div key={inelig.registrationId} className="py-2 flex items-center justify-between gap-3">
                                                        <div>
                                                            <span className="font-black text-black">{inelig.name}</span>
                                                            <span className="text-[10px] text-neutral-500 ml-2 font-mono">@{inelig.username}</span>
                                                        </div>
                                                        <div className="text-right">
                                                            <span className="text-[10px] font-black text-rose-800 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                                                                {inelig.exclusionReason}
                                                            </span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ) : null}

                            <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setWizardStep("category")}
                                    className="px-5 py-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-bold flex items-center gap-2 cursor-pointer"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span>Change Category</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setWizardStep("recipients")}
                                    className="px-6 py-2.5 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ebd04e] text-xs sm:text-sm font-black shadow-[3px_3px_0px_#000] flex items-center gap-2 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    <span>Select Recipients ({eligibilityReport?.summary.eligibleCount || 0} Eligible)</span>
                                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: SELECT RECIPIENTS (PHASE 13 BULK RECIPIENT MANAGEMENT) */}
                    {wizardStep === "recipients" && (
                        <div className="p-6 bg-white rounded-3xl border-3 border-black shadow-[5px_5px_0px_#000] space-y-6">
                            <div className="border-b-2 border-black/10 pb-4">
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black text-[#FFE566]">
                                    STEP 3 OF 7 · PHASE 13
                                </span>
                                <h4 className="text-lg font-black text-black mt-1">
                                    Multi-Select Recipient Management
                                </h4>
                                <p className="text-xs text-neutral-600 font-medium">
                                    Filter by attendance, select by team, detect duplicates, inspect missing data, and bulk-select candidates for &ldquo;{certType}&rdquo; credentials.
                                </p>
                            </div>

                            <RecipientRosterTable
                                recipients={eventRosterItems}
                                selectedIds={selectedUserIds}
                                onToggleSelect={toggleUserId}
                                onSelectMultiple={handleSelectMultipleUserIds}
                                onDeselectMultiple={handleDeselectMultipleUserIds}
                                onDeselectAll={deselectAll}
                                certType={certType}
                                requireAttendance={certType === "attendance"}
                                onUpdateCustomPosition={handleUpdateCustomPosition}
                                title={activeEventTitle ? `Event Roster: ${activeEventTitle}` : "Event Roster"}
                            />

                            <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setWizardStep("eligibility")}
                                    className="px-5 py-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-bold flex items-center gap-2 cursor-pointer"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span>Back to Eligibility</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setWizardStep("template")}
                                    className="px-6 py-2.5 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ebd04e] text-xs sm:text-sm font-black shadow-[3px_3px_0px_#000] flex items-center gap-2 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    <span>Select Certificate Template ({selectedUserIds.size} Selected)</span>
                                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: SELECT CERTIFICATE TEMPLATE */}
                    {wizardStep === "template" && (
                        <div className="p-6 bg-white rounded-3xl border-3 border-black shadow-[5px_5px_0px_#000] space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black/10 pb-4">
                                <div>
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black text-[#FFE566]">
                                        STEP 4 OF 7
                                    </span>
                                    <h4 className="text-lg font-black text-black mt-1">
                                        Select Certificate Template
                                    </h4>
                                    <p className="text-xs text-neutral-600 font-medium">
                                        Choose an Orbix official design or your club-saved custom template.
                                    </p>
                                </div>
                                <span className="text-xs font-black bg-[#FAF6EE] border border-black px-3 py-1.5 rounded-xl">
                                    Current: {activeTemplateName}
                                </span>
                            </div>

                            {/* Template Grid (Selected template prioritized at first position) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                                {sortedTemplatesForStep4.map((tmpl, idx) => {
                                    const isSelected = activeTemplateId === tmpl.id || activeTemplateName === tmpl.name;
                                    return (
                                        <div
                                            key={tmpl.id}
                                            onClick={() => {
                                                setActiveDesign(tmpl.design);
                                                setActiveTemplateId(tmpl.id);
                                                setActiveTemplateName(tmpl.name);
                                                toast.success(`Selected template: "${tmpl.name}".`);
                                            }}
                                            className={`p-3.5 rounded-2xl border-3 transition-all cursor-pointer flex flex-col justify-between space-y-3 relative ${
                                                isSelected
                                                    ? "border-black bg-[#FFE566]/20 shadow-[4px_4px_0px_#000]"
                                                    : "border-black/20 hover:border-black bg-white hover:shadow-[3px_3px_0px_#000]"
                                            }`}
                                        >
                                            {/* Priority Badge for Currently Selected Template */}
                                            {isSelected && idx === 0 && (
                                                <div className="absolute -top-3 left-4 z-10 px-2.5 py-0.5 rounded-full bg-black text-[#FFE566] text-[10px] font-black uppercase tracking-wider border border-black shadow-[1px_1px_0px_#000] flex items-center gap-1">
                                                    <Check className="w-3 h-3 stroke-[3]" />
                                                    <span>Currently Selected</span>
                                                </div>
                                            )}

                                            <div className="w-full rounded-xl overflow-hidden border-2 border-black/20 bg-white">
                                                <CertificateThumbnailPreview
                                                    design={tmpl.design}
                                                    sampleRecipientName="Venkata Ramanatha Swamy"
                                                />
                                            </div>

                                            <div>
                                                <div className="flex items-center justify-between text-[10px]">
                                                    <span className="font-black uppercase px-2 py-0.5 rounded bg-[#FFE566] border border-black/30">
                                                        {tmpl.category}
                                                    </span>
                                                    <span className="font-bold text-neutral-500">
                                                        {tmpl.isSystem ? "Orbix Official" : "Club Custom"}
                                                    </span>
                                                </div>
                                                <div className="font-black text-sm text-black mt-1 truncate">
                                                    {tmpl.name}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setWizardStep("recipients")}
                                    className="px-5 py-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-bold flex items-center gap-2 cursor-pointer"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span>Back to Recipients</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setWizardStep("mapping")}
                                    className="px-6 py-2.5 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ebd04e] text-xs sm:text-sm font-black shadow-[3px_3px_0px_#000] flex items-center gap-2 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    <span>Map Event & Recipient Fields</span>
                                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 5: MAP EVENT & RECIPIENT FIELDS */}
                    {wizardStep === "mapping" && (
                        <div className="p-6 bg-white rounded-3xl border-3 border-black shadow-[5px_5px_0px_#000] space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black/10 pb-4">
                                <div>
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black text-[#FFE566]">
                                        STEP 5 OF 7
                                    </span>
                                    <h4 className="text-lg font-black text-black mt-1">
                                        Map Dynamic Event & Recipient Fields
                                    </h4>
                                    <p className="text-xs text-neutral-600 font-medium">
                                        Verify how dynamic template placeholders map to live event data and configure customized titles or signatories.
                                    </p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Left: Attribute Customization Form */}
                                <div className="space-y-4">
                                    <h5 className="text-xs font-black uppercase tracking-wider text-black border-b-2 border-black/10 pb-1">
                                        Editable Credential Attributes
                                    </h5>

                                    <div>
                                        <label className="text-xs font-black text-black block mb-1">
                                            Certificate Title <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={title}
                                            onChange={(e) => setTitle(e.target.value)}
                                            placeholder="e.g. Certificate of Participation"
                                            className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-black text-black block mb-1">
                                            Achievement Description (Auto-Wrap Supported)
                                        </label>
                                        <textarea
                                            value={description}
                                            onChange={(e) => setDescription(e.target.value)}
                                            rows={2}
                                            placeholder="For active participation in the annual workshop..."
                                            className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:outline-none"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-black text-black block mb-1">
                                            Award Position / Rank (Optional)
                                        </label>
                                        <input
                                            type="text"
                                            value={awardPosition}
                                            onChange={(e) => setAwardPosition(e.target.value)}
                                            placeholder="e.g. 1st Place / Winner / Finalist"
                                            className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:outline-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-xs font-black text-black block mb-1">
                                                Signatory Name
                                            </label>
                                            <input
                                                type="text"
                                                value={signerName}
                                                onChange={(e) => setSignerName(e.target.value)}
                                                placeholder="e.g. Dr. A. Sharma"
                                                className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:outline-none"
                                            />
                                        </div>
                                        <div>
                                            <label className="text-xs font-black text-black block mb-1">
                                                Signatory Title
                                            </label>
                                            <input
                                                type="text"
                                                value={signerRole}
                                                onChange={(e) => setSignerRole(e.target.value)}
                                                placeholder="e.g. Faculty Coordinator"
                                                className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Right: Live Dynamic Mapping Matrix */}
                                <div className="space-y-4">
                                    <h5 className="text-xs font-black uppercase tracking-wider text-black border-b-2 border-black/10 pb-1">
                                        Automated Dynamic Field Matrix
                                    </h5>

                                    <div className="space-y-2 text-xs">
                                        <div className="p-3 bg-[#FAF6EE] rounded-xl border-2 border-black flex items-center justify-between">
                                            <span className="font-mono text-[11px] text-blue-700 font-bold">{`{{recipient.name}}`}</span>
                                            <span className="font-black text-black">Verified Student Full Name</span>
                                        </div>
                                        <div className="p-3 bg-[#FAF6EE] rounded-xl border-2 border-black flex items-center justify-between">
                                            <span className="font-mono text-[11px] text-blue-700 font-bold">{`{{event.name}}`}</span>
                                            <span className="font-black text-black truncate max-w-[200px]">{activeEventTitle}</span>
                                        </div>
                                        <div className="p-3 bg-[#FAF6EE] rounded-xl border-2 border-black flex items-center justify-between">
                                            <span className="font-mono text-[11px] text-blue-700 font-bold">{`{{event.date}}`}</span>
                                            <span className="font-black text-black">Live Event Date</span>
                                        </div>
                                        <div className="p-3 bg-[#FAF6EE] rounded-xl border-2 border-black flex items-center justify-between">
                                            <span className="font-mono text-[11px] text-blue-700 font-bold">{`{{certificate.credentialCode}}`}</span>
                                            <span className="font-black text-emerald-700 font-mono">ORB-YYYY-XXXX (Signed)</span>
                                        </div>
                                        <div className="p-3 bg-[#FAF6EE] rounded-xl border-2 border-black flex items-center justify-between">
                                            <span className="font-mono text-[11px] text-blue-700 font-bold">{`{{certificate.verificationUrl}}`}</span>
                                            <span className="font-black text-emerald-700">ECC-H QR Code Embedded</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setWizardStep("template")}
                                    className="px-5 py-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-bold flex items-center gap-2 cursor-pointer"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span>Back to Template</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setWizardStep("preview")}
                                    className="px-6 py-2.5 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ebd04e] text-xs sm:text-sm font-black shadow-[3px_3px_0px_#000] flex items-center gap-2 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    <span>Live Preview & Validation</span>
                                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 6: LIVE PREVIEW & VALIDATION */}
                    {wizardStep === "preview" && (
                        <div className="p-6 bg-white rounded-3xl border-3 border-black shadow-[5px_5px_0px_#000] space-y-6">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-black/10 pb-4">
                                <div>
                                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black text-[#FFE566]">
                                        STEP 6 OF 7
                                    </span>
                                    <h4 className="text-lg font-black text-black mt-1">
                                        Real-Recipient Preview & Verification
                                    </h4>
                                    <p className="text-xs text-neutral-600 font-medium">
                                        Test certificate typography auto-fitting and QR positioning against real participant records.
                                    </p>
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setPreviewScenario("first")}
                                        className={`px-3 py-1.5 rounded-xl border-2 border-black text-xs font-black cursor-pointer ${
                                            previewScenario === "first" ? "bg-[#FFE566]" : "bg-white"
                                        }`}
                                    >
                                        Standard Recipient
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setPreviewScenario("longest")}
                                        className={`px-3 py-1.5 rounded-xl border-2 border-black text-xs font-black cursor-pointer ${
                                            previewScenario === "longest" ? "bg-[#FFE566]" : "bg-white"
                                        }`}
                                    >
                                        Longest Name (Stress Test)
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                                {/* Left: Canvas Preview */}
                                <div className="lg:col-span-8 p-4 bg-[#FAF6EE] rounded-2xl border-3 border-black space-y-3">
                                    <div className="flex items-center justify-between text-xs font-black">
                                        <span>Live Merged Certificate Rendering</span>
                                        <span className="text-neutral-500 font-mono">
                                            Previewing: {previewRecipient.name}
                                        </span>
                                    </div>

                                    {activeDesign && (
                                        <div className="w-full rounded-xl overflow-hidden border-2 border-black bg-white shadow-[3px_3px_0px_#000]">
                                            <CertificateThumbnailPreview
                                                design={activeDesign}
                                                sampleRecipientName={previewRecipient.name}
                                                sampleCollege={previewRecipient.college}
                                                sampleEventTitle={activeEventTitle}
                                            />
                                        </div>
                                    )}
                                </div>

                                {/* Right: Validation Checklist */}
                                <div className="lg:col-span-4 p-5 bg-white rounded-2xl border-3 border-black space-y-4">
                                    <h5 className="text-xs font-black uppercase tracking-wider text-black border-b-2 border-black/10 pb-1">
                                        Pre-Flight Validation Report
                                    </h5>

                                    <div className="space-y-3 text-xs">
                                        <div className="flex items-start gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                            <div>
                                                <div className="font-black text-black">Recipient Name Auto-Fit</div>
                                                <div className="text-[11px] text-neutral-500">
                                                    Progressive font-shrinking active (down to 7pt).
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                            <div>
                                                <div className="font-black text-black">High-ECC QR Placement</div>
                                                <div className="text-[11px] text-neutral-500">
                                                    Level H Error Correction embedded with signed URL.
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-start gap-2">
                                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                            <div>
                                                <div className="font-black text-black">Server PDF-Lib Vector Engine</div>
                                                <div className="text-[11px] text-neutral-500">
                                                    SHA-256 cryptographic digest calculated on final bytes.
                                                </div>
                                            </div>
                                        </div>

                                        {validationStatus.hasAttendanceDiscrepancy && (
                                            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1">
                                                <div className="font-black text-amber-900 flex items-center gap-1">
                                                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                                    <span>Unverified Attendance Detected</span>
                                                </div>
                                                <div className="text-[10px] text-amber-800">
                                                    Step 7 will require authorized coordinator justification.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setWizardStep("mapping")}
                                    className="px-5 py-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-bold flex items-center gap-2 cursor-pointer"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span>Back to Field Mapping</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setWizardStep("approve")}
                                    className="px-6 py-2.5 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ebd04e] text-xs sm:text-sm font-black shadow-[3px_3px_0px_#000] flex items-center gap-2 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    <span>Approve & Final Issuance</span>
                                    <ArrowRight className="w-4 h-4 stroke-[3]" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* STEP 7: APPROVE & ISSUE BATCH */}
                    {wizardStep === "approve" && (
                        <div className="p-6 bg-white rounded-3xl border-3 border-black shadow-[5px_5px_0px_#000] space-y-6">
                            <div className="border-b-2 border-black/10 pb-4">
                                <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-black text-[#FFE566]">
                                    STEP 7 OF 7
                                </span>
                                <h4 className="text-lg font-black text-black mt-1">
                                    Approve & Issue Certificate Batch
                                </h4>
                                <p className="text-xs text-neutral-600 font-medium">
                                    Final review before cryptographic generation, signing, and Activity portfolio distribution.
                                </p>
                            </div>

                            {/* Issuance Summary Card */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="p-4 bg-[#FAF6EE] rounded-2xl border-2 border-black">
                                    <div className="text-[10px] font-black uppercase text-neutral-500">Event</div>
                                    <div className="text-sm font-black text-black mt-1 truncate">
                                        {activeEventTitle}
                                    </div>
                                </div>
                                <div className="p-4 bg-[#FAF6EE] rounded-2xl border-2 border-black">
                                    <div className="text-[10px] font-black uppercase text-neutral-500">Category</div>
                                    <div className="text-sm font-black text-black mt-1 capitalize">
                                        {certType.replace(/_/g, " ")}
                                    </div>
                                </div>
                                <div className="p-4 bg-[#FAF6EE] rounded-2xl border-2 border-black">
                                    <div className="text-[10px] font-black uppercase text-neutral-500">Recipients</div>
                                    <div className="text-sm font-black text-emerald-700 mt-1">
                                        {selectedUserIds.size} Selected Students
                                    </div>
                                </div>
                                <div className="p-4 bg-[#FAF6EE] rounded-2xl border-2 border-black">
                                    <div className="text-[10px] font-black uppercase text-neutral-500">Template</div>
                                    <div className="text-sm font-black text-black mt-1 truncate">
                                        {activeTemplateName}
                                    </div>
                                </div>
                            </div>

                            {/* Anti-Tampering Override Box if needed */}
                            {validationStatus.hasAttendanceDiscrepancy && (
                                <div className="p-4 bg-amber-50 rounded-2xl border-2 border-black space-y-3">
                                    <div className="flex items-center gap-2">
                                        <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0" />
                                        <h5 className="font-black text-sm text-black">
                                            Authorized Coordinator Attendance Override Required
                                        </h5>
                                    </div>
                                    <p className="text-xs text-neutral-600">
                                        Some selected recipients do not have recorded electronic check-ins. Provide an authorized justification to proceed. This reason will be logged into the permanent audit log.
                                    </p>
                                    <textarea
                                        value={overrideReason}
                                        onChange={(e) => setOverrideReason(e.target.value)}
                                        rows={2}
                                        placeholder="e.g. Verified physical attendance on paper sign-in sheet at main gate..."
                                        className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-white focus:outline-none"
                                    />
                                </div>
                            )}

                            {/* Security Notice */}
                            <div className="p-4 bg-[#FAF6EE] rounded-2xl border-2 border-black text-xs text-neutral-600 space-y-1">
                                <div className="font-black text-black flex items-center gap-1.5">
                                    <ShieldCheck className="w-4 h-4 text-emerald-700" />
                                    <span>Authoritative Server Re-Evaluation</span>
                                </div>
                                <p className="leading-relaxed">
                                    All participant records and attendance timestamps will be re-evaluated on the backend during batch execution. Any ineligible requests will be isolated, and valid credentials will receive SHA-256 integrity digests.
                                </p>
                            </div>

                            {issuedBatchId && (
                                <div className="p-4 bg-[#a2ff86]/30 border-2 border-black rounded-2xl space-y-1">
                                    <div className="text-xs font-black text-black flex items-center gap-1.5">
                                        <CheckCircle2 className="w-4 h-4 text-emerald-700" />
                                        <span>Batch Successfully Created!</span>
                                    </div>
                                    <p className="text-xs text-neutral-700 font-mono">
                                        Batch ID: {issuedBatchId}
                                    </p>
                                </div>
                            )}

                            <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between">
                                <button
                                    type="button"
                                    onClick={() => setWizardStep("preview")}
                                    className="px-5 py-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-bold flex items-center gap-2 cursor-pointer"
                                >
                                    <ArrowLeft className="w-4 h-4" />
                                    <span>Back to Preview</span>
                                </button>

                                <button
                                    type="button"
                                    disabled={
                                        isIssuing ||
                                        (selectedUserIds.size === 0 && selectedTeamIds.size === 0 && externalRecipients.length === 0) ||
                                        (validationStatus.hasAttendanceDiscrepancy && !overrideReason.trim())
                                    }
                                    onClick={() => {
                                        if (validationStatus.hasAttendanceDiscrepancy) {
                                            executeBatchDispatch(true, overrideReason.trim());
                                        } else {
                                            executeBatchDispatch(false, undefined);
                                        }
                                    }}
                                    className="px-8 py-3 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8ee673] text-sm font-black shadow-[4px_4px_0px_#000] disabled:opacity-40 flex items-center gap-2 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    {isIssuing ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            <span>Issuing Batch...</span>
                                        </>
                                    ) : (
                                        <>
                                            <Send className="w-4 h-4" />
                                            <span>Approve & Issue Certificate Batch</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ================================================================ */}
            {/* ALL-IN-ONE COMPACT CONSOLE MODE (FOR ADVANCED USERS) */}
            {/* ================================================================ */}
            {(sourceTab !== "event" || viewMode === "compact") && (
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                    {/* Left: Metadata form */}
                    <div className="lg:col-span-4 p-5 sm:p-6 bg-white rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000] space-y-4 h-fit">
                        <div className="flex items-center justify-between border-b-2 border-black/10 pb-2">
                            <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                Award Specification
                            </h4>
                            <span className="text-[10px] font-bold text-neutral-500">16 Categories</span>
                        </div>

                        <div>
                            <label className="text-xs font-black text-black block mb-1">
                                Award Category <span className="text-red-500">*</span>
                            </label>
                            <NeoSelect
                                value={certType}
                                onChange={(val) => setCertType(val)}
                                className="w-full"
                                triggerClassName="bg-[#FAF6EE] text-xs font-bold"
                            >
                                {CERTIFICATE_CATEGORIES.map((cat) => (
                                    <option key={cat.value} value={cat.value}>
                                        {cat.label}
                                    </option>
                                ))}
                            </NeoSelect>
                            <p className="text-[11px] text-neutral-500 mt-1 leading-snug">
                                {CERTIFICATE_CATEGORIES.find((c) => c.value === certType)?.description}
                            </p>
                        </div>

                        <div>
                            <label className="text-xs font-black text-black block mb-1">
                                Certificate Title <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Certificate of Participation"
                                className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-black text-black block mb-1">
                                Achievement Description
                            </label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                rows={2}
                                placeholder="e.g. Recognizing dedicated participation..."
                                className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-black text-black block mb-1">
                                Award Position / Rank (Optional)
                            </label>
                            <input
                                type="text"
                                value={awardPosition}
                                onChange={(e) => setAwardPosition(e.target.value)}
                                placeholder="e.g. 1st Place Winner or Lead Coordinator"
                                className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:outline-none"
                            />
                        </div>

                        <div>
                            <label className="text-xs font-black text-black block mb-1">
                                Issue Date
                            </label>
                            <NeoDateTimePicker
                                mode="date"
                                value={issueDateOverride}
                                onChange={(val) => setIssueDateOverride(val)}
                                placeholder="Select issue date"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="text-xs font-black text-black block mb-1">Signatory</label>
                                <input
                                    type="text"
                                    value={signerName}
                                    onChange={(e) => setSignerName(e.target.value)}
                                    placeholder="Coordinator Name"
                                    className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE]"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-black text-black block mb-1">Signatory Title</label>
                                <input
                                    type="text"
                                    value={signerRole}
                                    onChange={(e) => setSignerRole(e.target.value)}
                                    placeholder="Title / Role"
                                    className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE]"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="text-xs font-black text-black block mb-1">
                                Supporting Metadata / Tags (Optional)
                            </label>
                            <input
                                type="text"
                                value={metadataTags}
                                onChange={(e) => setMetadataTags(e.target.value)}
                                placeholder="e.g. Hackathon, Merit, 2026, Core Lead"
                                className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:outline-none"
                            />
                        </div>

                        <div className="pt-2 border-t border-black/10 space-y-2">
                            <label className="text-xs font-black text-black block">Certificate Template</label>
                            <div className="flex items-center justify-between p-2.5 bg-[#FAF6EE] border-2 border-black rounded-xl">
                                <span className="text-xs font-black text-black truncate">{activeTemplateName}</span>
                                <button
                                    type="button"
                                    onClick={() => setIsTemplatePickerOpen(true)}
                                    className="px-2.5 py-1 bg-white border border-black rounded-lg text-[10px] font-black uppercase hover:bg-neutral-100 cursor-pointer"
                                >
                                    Change
                                </button>
                            </div>
                        </div>

                        <button
                            type="button"
                            disabled={isIssuing || (selectedUserIds.size === 0 && externalRecipients.length === 0 && selectedTeamIds.size === 0)}
                            onClick={handleInitiateDispatch}
                            className="w-full mt-2 py-3 px-4 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8ee673] text-xs font-black shadow-[3px_3px_0px_#000] disabled:opacity-40 flex items-center justify-center gap-2 cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        >
                            {isIssuing ? (
                                <>
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                    <span>Issuing Batch...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    <span>Issue Credentials ({selectedUserIds.size + externalRecipients.length + selectedTeamIds.size})</span>
                                </>
                            )}
                        </button>
                    </div>

                    {/* Right: Roster & Source Perspective */}
                    <div className="lg:col-span-8 p-5 sm:p-6 bg-white rounded-2xl border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                        {sourceTab === "event" && (
                            <div className="space-y-4">
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b-2 border-black/10">
                                    <div className="w-full sm:w-80">
                                        <label className="text-xs font-black text-black block mb-1">Select Event</label>
                                        {preselectedEventId ? (
                                            <div className="p-2.5 bg-[#FAF6EE] border-2 border-black rounded-xl text-xs font-black text-black flex items-center justify-between">
                                                <span className="truncate">{activeEventTitle}</span>
                                                <span className="px-2 py-0.5 rounded bg-black text-white text-[9px] uppercase">LOCKED</span>
                                            </div>
                                        ) : loadingEvents ? (
                                            <div className="p-2.5 bg-[#FAF6EE] border-2 border-black rounded-xl text-xs font-bold text-neutral-500 flex items-center gap-2">
                                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                <span>Loading events...</span>
                                            </div>
                                        ) : (
                                            <NeoSelect
                                                value={selectedEventId}
                                                onChange={(val) => setSelectedEventId(val)}
                                                className="w-full"
                                                triggerClassName="bg-[#FAF6EE] text-xs font-bold"
                                            >
                                                {events.map((ev) => (
                                                    <option key={ev.id} value={ev.id}>
                                                        {ev.title} ({ev.attendeesCount} Attended)
                                                    </option>
                                                ))}
                                            </NeoSelect>
                                        )}
                                    </div>
                                </div>

                                <RecipientRosterTable
                                    recipients={eventRosterItems}
                                    selectedIds={selectedUserIds}
                                    onToggleSelect={toggleUserId}
                                    onSelectMultiple={handleSelectMultipleUserIds}
                                    onDeselectMultiple={handleDeselectMultipleUserIds}
                                    onDeselectAll={deselectAll}
                                    certType={certType}
                                    requireAttendance={certType === "attendance"}
                                    onUpdateCustomPosition={handleUpdateCustomPosition}
                                    title={activeEventTitle ? `Event Roster: ${activeEventTitle}` : "Event Roster"}
                                />
                            </div>
                        )}

                        {sourceTab === "csv" && (
                            <div className="space-y-4">
                                {/* Header Card & Template Download */}
                                <div className="p-4 bg-[#FAF6EE] rounded-2xl border-3 border-black shadow-[3px_3px_0px_#000] flex flex-wrap items-center justify-between gap-3">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 rounded-md bg-[#FFE566] border-2 border-black font-black text-[10px] uppercase tracking-wider">
                                                Phase 14
                                            </span>
                                            <h5 className="text-sm font-black text-black flex items-center gap-1.5">
                                                <FileSpreadsheet className="w-4 h-4 text-black" />
                                                CSV Roster Import & Campus Reconciliation
                                            </h5>
                                        </div>
                                        <p className="text-xs text-neutral-600 font-medium max-w-xl">
                                            Import recipient rosters via CSV. Automatic formula injection protection (CWE-1236)
                                            and authoritative matching against campus student profiles.
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadSampleFormat("csv")}
                                            className="px-3.5 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black flex items-center gap-1.5 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
                                        >
                                            <Download className="w-3.5 h-3.5 text-black" />
                                            <span>Template (.csv)</span>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => handleDownloadSampleFormat("xlsx")}
                                            className="px-3.5 py-2 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8ee673] text-black text-xs font-black flex items-center gap-1.5 shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer"
                                        >
                                            <FileSpreadsheet className="w-3.5 h-3.5 text-black" />
                                            <span>Excel (.xlsx)</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Drag & Drop CSV/XLSX Dropzone */}
                                {!reconciledCsvResult ? (
                                    <label className="block cursor-pointer">
                                        <input
                                            type="file"
                                            accept=".csv,.tsv,.xlsx,.xls"
                                            disabled={isReconcilingCsv}
                                            onChange={(e) => {
                                                if (e.target.files?.[0]) handleCsvUpload(e.target.files[0]);
                                            }}
                                            className="hidden"
                                        />
                                        <div className="p-8 rounded-2xl border-3 border-dashed border-black bg-white hover:bg-[#FFE566]/10 transition-all flex flex-col items-center justify-center text-center gap-3 shadow-[3px_3px_0px_#000]">
                                            {isReconcilingCsv ? (
                                                <div className="flex flex-col items-center gap-2">
                                                    <RefreshCw className="w-8 h-8 text-black animate-spin" />
                                                    <span className="text-sm font-black text-black">
                                                        Reconciling recipients with campus registry...
                                                    </span>
                                                    <span className="text-xs text-neutral-500">
                                                        Sanitizing formulas (CWE-1236) and matching student profiles
                                                    </span>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="w-14 h-14 rounded-2xl bg-[#FFE566] border-3 border-black flex items-center justify-center shadow-[3px_3px_0px_#000]">
                                                        <UploadCloud className="w-7 h-7 text-black" />
                                                    </div>
                                                    <div>
                                                        <h4 className="text-sm font-black text-black">
                                                            Drag & Drop CSV, TSV, or Excel (.xlsx) Here
                                                        </h4>
                                                        <p className="text-xs text-neutral-500 mt-0.5">
                                                            or click to browse from your computer (max 10 MB)
                                                        </p>
                                                    </div>
                                                    <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
                                                        <span className="px-2.5 py-1 rounded-lg bg-neutral-100 border-2 border-black text-[10px] font-black text-neutral-700">
                                                            🛡️ Formula Injection Neutralization
                                                        </span>
                                                        <span className="px-2.5 py-1 rounded-lg bg-[#a2ff86]/30 border-2 border-black text-[10px] font-black text-neutral-800">
                                                            🎓 Direct Campus Matching
                                                        </span>
                                                    </div>
                                                </>
                                            )}
                                        </div>
                                    </label>
                                ) : (
                                    /* Reconciled Results Console */
                                    <div className="space-y-4">
                                        {/* Reconciliation Summary Cards */}
                                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <div className="p-3 bg-white border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
                                                <div className="text-[10px] font-black text-neutral-500 uppercase tracking-wider">
                                                    Total Rows
                                                </div>
                                                <div className="text-xl font-black text-black mt-0.5">
                                                    {reconciledCsvResult.totalRows}
                                                </div>
                                                <div className="text-[10px] text-neutral-600 font-bold mt-1">
                                                    Parsed from CSV
                                                </div>
                                            </div>

                                            <div className="p-3 bg-[#a2ff86] border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
                                                <div className="text-[10px] font-black text-black uppercase tracking-wider">
                                                    Orbix Students
                                                </div>
                                                <div className="text-xl font-black text-black mt-0.5">
                                                    {reconciledCsvResult.matchedStudentsCount}
                                                </div>
                                                <div className="text-[10px] text-black/80 font-bold mt-1">
                                                    Direct Account Issuance
                                                </div>
                                            </div>

                                            <div className="p-3 bg-[#FFE566] border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
                                                <div className="text-[10px] font-black text-black uppercase tracking-wider">
                                                    External Claim
                                                </div>
                                                <div className="text-xl font-black text-black mt-0.5">
                                                    {reconciledCsvResult.externalCount}
                                                </div>
                                                <div className="text-[10px] text-black/80 font-bold mt-1">
                                                    Verified Claim Link
                                                </div>
                                            </div>

                                            <div className="p-3 bg-red-50 border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
                                                <div className="text-[10px] font-black text-red-800 uppercase tracking-wider">
                                                    Invalid / Skipped
                                                </div>
                                                <div className="text-xl font-black text-red-600 mt-0.5">
                                                    {reconciledCsvResult.invalidCount}
                                                </div>
                                                <div className="text-[10px] text-red-700 font-bold mt-1">
                                                    {reconciledCsvResult.duplicateCount} duplicate(s)
                                                </div>
                                            </div>
                                        </div>

                                        {/* Detected Columns & Re-upload Bar */}
                                        <div className="p-3 bg-white rounded-xl border-2 border-black flex flex-wrap items-center justify-between gap-2 text-xs">
                                            <div className="flex flex-wrap items-center gap-1.5 font-bold text-neutral-700">
                                                <span className="font-black text-black">Auto-Detected Columns:</span>
                                                {Object.entries(reconciledCsvResult.detectedColumns).map(([k, v]) => (
                                                    <span key={k} className="px-2 py-0.5 rounded bg-neutral-100 border border-neutral-300 font-mono text-[10px]">
                                                        {k}: <strong className="text-black">{v}</strong>
                                                    </span>
                                                ))}
                                            </div>
                                            <label className="text-xs font-black text-black hover:underline cursor-pointer flex items-center gap-1">
                                                <RefreshCw className="w-3.5 h-3.5 text-black" />
                                                <span>Upload Different CSV</span>
                                                <input
                                                    type="file"
                                                    accept=".csv,.tsv"
                                                    onChange={(e) => {
                                                        if (e.target.files?.[0]) handleCsvUpload(e.target.files[0]);
                                                    }}
                                                    className="hidden"
                                                />
                                            </label>
                                        </div>

                                        {/* Filter, Search & Bulk Actions Bar */}
                                        <div className="space-y-2">
                                            <div className="flex flex-wrap items-center justify-between gap-2">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    {[
                                                        { id: "all", label: `All (${reconciledCsvResult.rows.length})` },
                                                        { id: "matched_student", label: `🟢 Students (${reconciledCsvResult.matchedStudentsCount})` },
                                                        { id: "external_recipient", label: `🟡 External (${reconciledCsvResult.externalCount})` },
                                                        { id: "invalid", label: `🔴 Invalid (${reconciledCsvResult.invalidCount})` },
                                                    ].map((tab) => (
                                                        <button
                                                            key={tab.id}
                                                            type="button"
                                                            onClick={() => setCsvFilterStatus(tab.id as any)}
                                                            className={`px-3 py-1 rounded-lg text-xs font-black border-2 border-black transition-all cursor-pointer ${
                                                                csvFilterStatus === tab.id
                                                                    ? "bg-black text-[#FFE566] shadow-[2px_2px_0px_#000]"
                                                                    : "bg-white text-black hover:bg-neutral-100"
                                                            }`}
                                                        >
                                                            {tab.label}
                                                        </button>
                                                    ))}
                                                </div>

                                                <div className="flex items-center gap-2">
                                                    <button
                                                        type="button"
                                                        onClick={selectAllValidCsv}
                                                        className="px-2.5 py-1 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-[11px] font-black cursor-pointer"
                                                    >
                                                        Select All Valid
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={deselectAllCsv}
                                                        className="px-2.5 py-1 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-[11px] font-black cursor-pointer"
                                                    >
                                                        Deselect All
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Search Bar */}
                                            <div className="relative">
                                                <Search className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                                                <input
                                                    type="text"
                                                    value={csvSearchQuery}
                                                    onChange={(e) => setCsvSearchQuery(e.target.value)}
                                                    placeholder="Search CSV roster by name, email, role, or position..."
                                                    className="w-full pl-9 pr-3 py-2 text-xs font-bold border-2 border-black rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-[#FFE566]"
                                                />
                                            </div>
                                        </div>

                                        {/* Reconciliation Table */}
                                        <div className="rounded-xl border-2 border-black overflow-hidden bg-white shadow-[2px_2px_0px_#000]">
                                            <div className="max-h-72 overflow-y-auto">
                                                <table className="w-full text-left text-xs border-collapse">
                                                    <thead className="sticky top-0 bg-[#FAF6EE] border-b-2 border-black z-10">
                                                        <tr className="font-black text-[11px] text-neutral-700">
                                                            <th className="p-2.5 w-10 text-center">
                                                                <div className="flex items-center justify-center">
                                                                    <NeoCheckbox
                                                                        size="sm"
                                                                        colorScheme="yellow"
                                                                        checked={
                                                                            filteredCsvRows.length > 0 &&
                                                                            filteredCsvRows
                                                                                .filter((r) => r.status !== "invalid")
                                                                                .every((r) => selectedCsvIndices.has(r.index))
                                                                        }
                                                                        onCheckedChange={(checked) => {
                                                                            if (checked) selectAllValidCsv();
                                                                            else deselectAllCsv();
                                                                        }}
                                                                    />
                                                                </div>
                                                            </th>
                                                            <th className="p-2.5 w-12 text-center">#</th>
                                                            <th className="p-2.5">Recipient Name</th>
                                                            <th className="p-2.5">Email Address</th>
                                                            <th className="p-2.5">Role / Position</th>
                                                            <th className="p-2.5">Reconciliation Match</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="divide-y divide-neutral-200">
                                                        {filteredCsvRows.map((row) => {
                                                            const isSelected = selectedCsvIndices.has(row.index);
                                                            const isInvalid = row.status === "invalid";

                                                            return (
                                                                <tr
                                                                    key={row.index}
                                                                    onClick={() => {
                                                                        if (!isInvalid) toggleCsvIndex(row.index);
                                                                    }}
                                                                    className={`hover:bg-neutral-50 transition-colors cursor-pointer ${
                                                                        isSelected ? "bg-[#FFE566]/15" : isInvalid ? "bg-red-50/50" : ""
                                                                    }`}
                                                                >
                                                                    <td className="p-2.5 text-center" onClick={(e) => e.stopPropagation()}>
                                                                        <div className="flex items-center justify-center">
                                                                            <NeoCheckbox
                                                                                size="sm"
                                                                                colorScheme="yellow"
                                                                                disabled={isInvalid}
                                                                                checked={isSelected}
                                                                                onCheckedChange={() => toggleCsvIndex(row.index)}
                                                                            />
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-2.5 text-center font-mono text-[10px] text-neutral-500">
                                                                        {row.index}
                                                                    </td>
                                                                    <td className="p-2.5">
                                                                        <div className="font-black text-black flex items-center gap-1.5">
                                                                            <span>{row.name}</span>
                                                                            {row.status === "matched_student" && (
                                                                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                                                                            )}
                                                                        </div>
                                                                    </td>
                                                                    <td className="p-2.5 font-mono text-[11px] text-neutral-600">
                                                                        {row.email}
                                                                    </td>
                                                                    <td className="p-2.5">
                                                                        <span className="text-[11px] font-bold text-neutral-800">
                                                                            {row.position || row.role || awardPosition || "—"}
                                                                        </span>
                                                                    </td>
                                                                    <td className="p-2.5">
                                                                        {row.status === "matched_student" ? (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#a2ff86] border border-black font-black text-[10px] text-black">
                                                                                <CheckCircle2 className="w-3 h-3 text-emerald-800" />
                                                                                <span>@{row.matchedUser?.username}</span>
                                                                                {row.matchedUser?.eventAttendance === "attended" && (
                                                                                    <span className="ml-1 text-[9px] bg-black text-[#a2ff86] px-1 rounded">
                                                                                        Attended
                                                                                    </span>
                                                                                )}
                                                                            </span>
                                                                        ) : row.status === "external_recipient" ? (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FFE566] border border-black font-black text-[10px] text-black">
                                                                                <Globe className="w-3 h-3 text-neutral-800" />
                                                                                <span>External Claim</span>
                                                                            </span>
                                                                        ) : (
                                                                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-red-100 border border-red-300 font-bold text-[10px] text-red-800" title={row.validationErrors?.join(", ")}>
                                                                                <AlertTriangle className="w-3 h-3 text-red-600 flex-shrink-0" />
                                                                                <span className="truncate max-w-[160px]">
                                                                                    {row.validationErrors?.[0] || "Invalid Row"}
                                                                                </span>
                                                                            </span>
                                                                        )}
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Staging Summary Footer */}
                                        <div className="p-3 bg-[#FAF6EE] rounded-xl border-2 border-black flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                                                <span className="text-xs font-black text-black">
                                                    {selectedCsvIndices.size} recipient(s) staged for issuance
                                                </span>
                                            </div>
                                            <span className="text-[11px] font-bold text-neutral-500">
                                                Click 'Issue Certificates' to launch bounded generation.
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Phase 11: Campus Directory & Team Recipient Console */}
                        {(sourceTab === "manual" || sourceTab === "team") && (
                            <div className="space-y-4">
                                {/* Header: Directory Source Filter Pills & Add External Button */}
                                <div className="space-y-3 pb-3 border-b-2 border-black/10">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {[
                                                { id: "all", label: "All Directory", icon: Globe },
                                                { id: "club_members", label: "Club Members", icon: Users },
                                                { id: "event_participants", label: "Event Attendees", icon: Calendar },
                                                { id: "team_members", label: "Team Members", icon: Award },
                                                { id: "teams", label: "Entire Teams", icon: Building2 },
                                                { id: "orbix_user", label: "Global Users", icon: Search },
                                            ].map((src) => {
                                                const Icon = src.icon;
                                                const isActive =
                                                    (sourceTab === "team" && src.id === "teams") ||
                                                    (sourceTab !== "team" && directorySource === src.id);
                                                return (
                                                    <button
                                                        key={src.id}
                                                        type="button"
                                                        onClick={() => {
                                                            if (src.id === "teams") {
                                                                setSourceTab("team");
                                                            } else if (sourceTab === "team") {
                                                                setSourceTab("manual");
                                                            }
                                                            setDirectorySource(src.id as any);
                                                        }}
                                                        className={`px-2.5 py-1.5 rounded-xl border-2 text-[11px] font-black flex items-center gap-1.5 transition-all cursor-pointer ${
                                                            isActive
                                                                ? "border-black bg-[#FFE566] shadow-[2px_2px_0px_#000]"
                                                                : "border-neutral-300 bg-white text-neutral-700 hover:border-black"
                                                        }`}
                                                    >
                                                        <Icon className="w-3.5 h-3.5" />
                                                        <span>{src.label}</span>
                                                    </button>
                                                );
                                            })}
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setExtFormName("");
                                                setExtFormEmail("");
                                                setExtFormPosition(awardPosition || "");
                                                setShowAddExternalModal(true);
                                            }}
                                            className="px-3 py-1.5 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8ee673] text-[11px] font-black flex items-center gap-1.5 shadow-[2px_2px_0px_#000] cursor-pointer"
                                        >
                                            <Plus className="w-3.5 h-3.5" />
                                            <span>External Recipient</span>
                                        </button>
                                    </div>

                                    {/* Privacy Guard Notice */}
                                    <div className="p-2.5 bg-[#FAF6EE] rounded-xl border-2 border-black flex items-center justify-between text-xs text-neutral-700">
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-lg bg-emerald-100 border border-black flex items-center justify-center text-emerald-800 shrink-0">
                                                <Lock className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-[11px] font-bold">
                                                <span className="text-black font-black">Privacy Protected:</span> Emails are masked in global search. Phone numbers and private responses are strictly hidden.
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-black text-white font-black shrink-0">
                                            ZERO PII EXPOSURE
                                        </span>
                                    </div>

                                    {/* Search Query & Selection Actions */}
                                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                                        <div className="relative w-full sm:w-80">
                                            <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-3" />
                                            <input
                                                type="text"
                                                value={directorySearch}
                                                onChange={(e) => setDirectorySearch(e.target.value)}
                                                placeholder={
                                                    directorySource === "teams" || sourceTab === "team"
                                                        ? "Search club teams..."
                                                        : "Search campus by name or @username..."
                                                }
                                                className="w-full pl-9 pr-8 py-2 text-xs font-bold border-2 border-black rounded-xl bg-white focus:outline-none"
                                            />
                                            {directorySearch && (
                                                <button
                                                    type="button"
                                                    onClick={() => setDirectorySearch("")}
                                                    className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-black cursor-pointer"
                                                >
                                                    <X className="w-3.5 h-3.5" />
                                                </button>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                                            <span className="text-xs font-black text-black mr-1">
                                                {selectedUserIds.size + externalRecipients.length} Selected
                                            </span>
                                            <button
                                                type="button"
                                                onClick={selectAllCurrent}
                                                className="px-3 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black cursor-pointer"
                                            >
                                                Select All
                                            </button>
                                            <button
                                                type="button"
                                                onClick={deselectAll}
                                                className="px-3 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black cursor-pointer"
                                            >
                                                Deselect
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Results View */}
                                {loadingDirectory ? (
                                    <div className="p-8 text-center bg-[#FAF6EE] rounded-2xl border-2 border-black flex flex-col items-center justify-center gap-2">
                                        <RefreshCw className="w-5 h-5 text-black animate-spin" />
                                        <span className="text-xs font-bold text-neutral-600">
                                            Searching authorized recipient directory...
                                        </span>
                                    </div>
                                ) : (sourceTab === "team" || directorySource === "teams") ? (
                                    /* Teams Listing (Phase 12 Team Issuance & Frozen Roster) */
                                    <div className="space-y-4">
                                        {/* Team Issuance Mode Selector */}
                                        <div className="p-3.5 bg-[#FAF6EE] rounded-2xl border-2 border-black space-y-2">
                                            <div className="flex items-center justify-between text-xs font-black text-black">
                                                <span className="flex items-center gap-1.5">
                                                    <Award className="w-4 h-4 text-black" />
                                                    <span>Team Issuance Mode:</span>
                                                </span>
                                                <span className="text-[10px] text-neutral-500 font-bold uppercase font-mono">
                                                    {teamIssuanceMode.replace("_", " ")}
                                                </span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                {[
                                                    {
                                                        id: "both" as const,
                                                        label: "🌟 Both Team & Members",
                                                        desc: "1 team cert + 1 cert per member",
                                                    },
                                                    {
                                                        id: "team_only" as const,
                                                        label: "🏆 Team Certificate Only",
                                                        desc: "Single credential for entire team",
                                                    },
                                                    {
                                                        id: "individual_only" as const,
                                                        label: "👤 Members Only",
                                                        desc: "1 cert per individual member",
                                                    },
                                                ].map((mode) => (
                                                    <button
                                                        key={mode.id}
                                                        type="button"
                                                        onClick={() => setTeamIssuanceMode(mode.id)}
                                                        className={`p-2.5 rounded-xl border-2 text-left transition-all cursor-pointer ${
                                                            teamIssuanceMode === mode.id
                                                                ? "border-black bg-[#FFE566] shadow-[2px_2px_0px_#000] font-black"
                                                                : "border-black/20 bg-white hover:border-black font-bold"
                                                        }`}
                                                    >
                                                        <div className="text-xs font-black text-black">{mode.label}</div>
                                                        <div className="text-[10px] text-neutral-600 font-medium leading-tight mt-0.5">
                                                            {mode.desc}
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Deduplication Alert Banner */}
                                        {deduplicationStats.hasDuplicates && (
                                            <div className="p-3 bg-amber-50 rounded-2xl border-2 border-black flex items-center justify-between text-xs text-amber-900 shadow-[2px_2px_0px_#000]">
                                                <div className="flex items-center gap-2">
                                                    <ShieldCheck className="w-4 h-4 text-amber-700 shrink-0" />
                                                    <span className="font-bold">
                                                        <span className="font-black">Deduplication Engine Active:</span> {deduplicationStats.duplicateCount} duplicate recipient overlap(s) detected. Individuals appearing across multiple teams will receive exactly 1 individual credential.
                                                    </span>
                                                </div>
                                                <span className="px-2 py-0.5 rounded bg-black text-[#FFE566] text-[10px] font-black shrink-0 font-mono">
                                                    AUTO-DEDUP
                                                </span>
                                            </div>
                                        )}

                                        <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                                            {directoryTeams.length === 0 ? (
                                                <div className="p-6 text-center text-xs font-bold text-neutral-500 bg-[#FAF6EE] rounded-xl border-2 border-dashed border-neutral-300">
                                                    No club teams found matching your query.
                                                </div>
                                            ) : (
                                                directoryTeams.map((team) => {
                                                    const isTeamSelected = selectedTeamIds.has(team.teamId);
                                                    const snap = teamSnapshots[team.teamId];
                                                    const memberCount = snap
                                                        ? snap.members.filter((m) => m.included).length
                                                        : team.memberCount;

                                                    return (
                                                        <div
                                                            key={team.teamId}
                                                            className={`p-4 rounded-2xl border-2 transition-all ${
                                                                isTeamSelected
                                                                    ? "border-black bg-[#FFE566]/20 shadow-[3px_3px_0px_#000]"
                                                                    : "border-neutral-300 bg-white"
                                                            }`}
                                                        >
                                                            <div className="flex items-start justify-between gap-3 mb-2">
                                                                <div>
                                                                    <div className="flex items-center gap-2">
                                                                        <Building2 className="w-4 h-4 text-black" />
                                                                        <span className="text-sm font-black text-black">{team.teamName}</span>
                                                                        <span className="px-2 py-0.5 rounded bg-black text-white text-[10px] font-black font-mono">
                                                                            {memberCount} Members
                                                                        </span>
                                                                        {snap && (
                                                                            <span className="px-2 py-0.5 rounded bg-emerald-100 border border-emerald-300 text-emerald-800 text-[9px] font-black uppercase">
                                                                                Roster Reviewed
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    {team.description && (
                                                                        <p className="text-xs text-neutral-600 mt-1">{team.description}</p>
                                                                    )}
                                                                </div>

                                                                <div className="flex items-center gap-2">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => handleOpenTeamReview(team)}
                                                                        disabled={loadingTeamRoster}
                                                                        className="px-3 py-1.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                                                                    >
                                                                        {loadingTeamRoster && reviewingTeamId === team.teamId ? (
                                                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                                        ) : (
                                                                            <Users className="w-3.5 h-3.5" />
                                                                        )}
                                                                        <span>Review Roster</span>
                                                                    </button>

                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            setSelectedTeamIds((prev) => {
                                                                                const next = new Set(prev);
                                                                                if (next.has(team.teamId)) next.delete(team.teamId);
                                                                                else next.add(team.teamId);
                                                                                return next;
                                                                            });
                                                                        }}
                                                                        className={`px-3 py-1.5 rounded-xl border-2 text-xs font-black transition-all cursor-pointer ${
                                                                            isTeamSelected
                                                                                ? "border-black bg-black text-white"
                                                                                : "border-black bg-[#FFE566] text-black shadow-[2px_2px_0px_#000]"
                                                                        }`}
                                                                    >
                                                                        {isTeamSelected ? "Selected" : "Select Team"}
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Team Members Chips Preview */}
                                                            {team.members && team.members.length > 0 && (
                                                                <div className="flex flex-wrap gap-1.5 pt-2 border-t border-black/10">
                                                                    {team.members.map((m) => (
                                                                        <span
                                                                            key={m.userId || m.name}
                                                                            className="px-2 py-0.5 rounded-lg border border-neutral-300 bg-neutral-50 text-[11px] font-bold text-neutral-700 flex items-center gap-1"
                                                                        >
                                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                                                            <span>{m.name}</span>
                                                                            <span className="text-[9px] opacity-70 font-normal">({m.role})</span>
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            )}
                                                        </div>
                                                    );
                                                })
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    /* Individual Recipients Listing */
                                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                                        {directoryRecipients.length === 0 ? (
                                            <div className="p-6 text-center text-xs font-bold text-neutral-500 bg-[#FAF6EE] rounded-xl border-2 border-dashed border-neutral-300">
                                                No recipients found matching query in selected directory source.
                                            </div>
                                        ) : (
                                            directoryRecipients.map((rec) => {
                                                const isSelected = selectedUserIds.has(rec.id);
                                                return (
                                                    <div
                                                        key={rec.id}
                                                        onClick={() => toggleUserId(rec.id)}
                                                        className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                                                            isSelected
                                                                ? "border-black bg-[#FFE566]/20 shadow-[2px_2px_0px_#000]"
                                                                : "border-neutral-200 bg-white hover:border-neutral-400"
                                                        }`}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div
                                                                className={`w-4 h-4 rounded border-2 border-black flex items-center justify-center shrink-0 ${
                                                                    isSelected ? "bg-black" : "bg-white"
                                                                }`}
                                                            >
                                                                {isSelected && <Check className="w-3 h-3 text-[#FFE566]" />}
                                                            </div>

                                                            <div className="w-8 h-8 rounded-full bg-neutral-200 border border-black flex items-center justify-center text-xs font-black text-black shrink-0 uppercase overflow-hidden">
                                                                {rec.avatarUrl ? (
                                                                    <img src={rec.avatarUrl} alt={rec.name} className="w-full h-full object-cover" />
                                                                ) : (
                                                                    rec.name.slice(0, 2)
                                                                )}
                                                            </div>

                                                            <div>
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-black text-black">{rec.name}</span>
                                                                    <span className="text-[10px] font-mono text-neutral-500">@{rec.username}</span>
                                                                </div>
                                                                <div className="text-[11px] text-neutral-500 flex items-center gap-2">
                                                                    {rec.email && <span>{rec.email}</span>}
                                                                    {rec.collegeName && <span>· {rec.collegeName}</span>}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-2 shrink-0">
                                                            {rec.roleBadge && (
                                                                <span className="text-[10px] font-black px-2 py-0.5 rounded-lg bg-neutral-100 border border-neutral-300 text-neutral-700">
                                                                    {rec.roleBadge}
                                                                </span>
                                                            )}
                                                            <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-black text-white font-mono">
                                                                {rec.sourceCategory.replace(/_/g, " ")}
                                                            </span>
                                                        </div>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                )}

                                {/* External Claimable Recipients Roster */}
                                {externalRecipients.length > 0 && (
                                    <div className="p-4 bg-[#FAF6EE] rounded-2xl border-2 border-black space-y-2">
                                        <div className="flex items-center justify-between border-b border-black/10 pb-2">
                                            <div className="flex items-center gap-2">
                                                <ExternalLink className="w-4 h-4 text-black" />
                                                <span className="text-xs font-black text-black">
                                                    External Claimable Recipients ({externalRecipients.length})
                                                </span>
                                            </div>
                                            <span className="text-[10px] font-bold text-neutral-600">60-Day Claim Links</span>
                                        </div>

                                        <div className="space-y-1.5 max-h-40 overflow-y-auto">
                                            {externalRecipients.map((ext) => (
                                                <div
                                                    key={ext.id}
                                                    className="p-2.5 bg-white rounded-xl border border-black flex items-center justify-between text-xs"
                                                >
                                                    <div>
                                                        <div className="font-black text-black">{ext.name}</div>
                                                        <div className="text-[11px] text-neutral-500 font-mono">{ext.email}</div>
                                                        {ext.customPosition && (
                                                            <div className="text-[10px] text-emerald-700 font-bold">Role: {ext.customPosition}</div>
                                                        )}
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-black px-2 py-0.5 rounded bg-[#FFE566] border border-black">
                                                            PENDING CLAIM
                                                        </span>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setExternalRecipients((prev) => prev.filter((item) => item.id !== ext.id));
                                                            }}
                                                            className="p-1 hover:bg-red-50 text-red-600 rounded transition-colors cursor-pointer"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* INELIGIBLE EXCLUSIONS INSPECTION MODAL */}
            {/* ================================================================ */}
            {showExclusionsModal && eligibilityReport && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setShowExclusionsModal(false)}
                >
                    <div
                        className="bg-white rounded-3xl border-4 border-black shadow-[8px_8px_0px_#000] w-full max-w-2xl p-6 space-y-4 max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b-2 border-black/10 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-red-100 border-2 border-black flex items-center justify-center text-red-700">
                                    <UserX className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="font-black text-base text-black">Ineligible Exclusions Audit</h4>
                                    <p className="text-xs text-neutral-500">
                                        {eligibilityReport.ineligibleRecipients.length} participant(s) excluded under &ldquo;{eligibilityReport.category}&rdquo; rules
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowExclusionsModal(false)}
                                className="w-8 h-8 rounded-lg border-2 border-black bg-[#FAF6EE] hover:bg-neutral-200 flex items-center justify-center font-black cursor-pointer"
                            >
                                <X className="w-4 h-4 text-black" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
                            {eligibilityReport.ineligibleRecipients.length === 0 ? (
                                <p className="text-xs text-neutral-500 text-center py-8">
                                    No excluded participants found. All registered students satisfy current eligibility requirements.
                                </p>
                            ) : (
                                eligibilityReport.ineligibleRecipients.map((inelig) => (
                                    <div
                                        key={inelig.registrationId}
                                        className="p-3 bg-red-50 border border-red-300 rounded-xl space-y-1"
                                    >
                                        <div className="flex items-center justify-between text-xs">
                                            <span className="font-black text-black">{inelig.name}</span>
                                            <span className="text-[10px] font-bold text-neutral-500">
                                                Status: {inelig.status.toUpperCase()}
                                            </span>
                                        </div>
                                        <div className="text-[11px] text-neutral-600">
                                            @{inelig.username} · {inelig.email}
                                        </div>
                                        <div className="text-[11px] font-bold text-red-900 pt-1 flex items-start gap-1">
                                            <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" />
                                            <span>Exclusion Reason: {inelig.exclusionReason}</span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-2 border-t-2 border-black/10 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowExclusionsModal(false)}
                                className="px-5 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-bold cursor-pointer"
                            >
                                Close Audit
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* MANUAL REVIEW CASES MODAL */}
            {/* ================================================================ */}
            {showManualReviewModal && eligibilityReport && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setShowManualReviewModal(false)}
                >
                    <div
                        className="bg-white rounded-3xl border-4 border-black shadow-[8px_8px_0px_#000] w-full max-w-xl p-6 space-y-4 max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b-2 border-black/10 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-amber-100 border-2 border-black flex items-center justify-center text-amber-800">
                                    <HelpCircle className="w-4 h-4" />
                                </div>
                                <div>
                                    <h4 className="font-black text-base text-black">Manual Review Cases</h4>
                                    <p className="text-xs text-neutral-500">
                                        Participants with missing institutional details
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowManualReviewModal(false)}
                                className="w-8 h-8 rounded-lg border-2 border-black bg-[#FAF6EE] hover:bg-neutral-200 flex items-center justify-center font-black cursor-pointer"
                            >
                                <X className="w-4 h-4 text-black" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 space-y-2 pr-1">
                            {eligibilityReport.manualReviewCases.length === 0 ? (
                                <p className="text-xs text-neutral-500 text-center py-8">
                                    All participant profiles contain verified names and campus affiliations.
                                </p>
                            ) : (
                                eligibilityReport.manualReviewCases.map((c, i) => (
                                    <div key={i} className="p-3 bg-amber-50 border border-amber-300 rounded-xl space-y-1 text-xs">
                                        <div className="font-black text-black">{c.name}</div>
                                        <div className="text-[11px] text-neutral-600">{c.email}</div>
                                        <div className="text-[11px] font-bold text-amber-900 pt-1">
                                            Issue: {c.issue}
                                        </div>
                                        <div className="text-[10px] text-neutral-700">
                                            Action: {c.suggestedAction}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        <div className="pt-2 border-t-2 border-black/10 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setShowManualReviewModal(false)}
                                className="px-5 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-bold cursor-pointer"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* MANUAL ATTENDANCE OVERRIDE CONFIRMATION MODAL */}
            {/* ================================================================ */}
            {showOverrideConfirmModal && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setShowOverrideConfirmModal(false)}
                >
                    <div
                        className="bg-white rounded-3xl border-4 border-black shadow-[8px_8px_0px_#000] w-full max-w-lg p-6 space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b-2 border-black/10 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-amber-400 border-2 border-black flex items-center justify-center text-black">
                                    <AlertTriangle className="w-4 h-4" />
                                </div>
                                <h4 className="font-black text-base text-black">
                                    Authorize Attendance Override
                                </h4>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowOverrideConfirmModal(false)}
                                className="w-8 h-8 rounded-lg border-2 border-black bg-[#FAF6EE] hover:bg-neutral-200 flex items-center justify-center font-black cursor-pointer"
                            >
                                <X className="w-4 h-4 text-black" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-xs space-y-1.5 text-amber-950 font-medium">
                                <p className="font-bold">
                                    {pendingUnverifiedUsers.length} selected student(s) do not have recorded check-in timestamps.
                                </p>
                                <p className="text-[11px] leading-relaxed">
                                    Registration alone is never interpreted as verified attendance. Issuing attendance credentials requires an authorized organizer justification, which will be permanently recorded in the immutable audit log.
                                </p>
                            </div>

                            <div>
                                <label className="text-[11px] font-black uppercase tracking-wider text-black block mb-1">
                                    Authorized Coordinator Override Justification <span className="text-red-500">*</span>
                                </label>
                                <textarea
                                    value={overrideReason}
                                    onChange={(e) => setOverrideReason(e.target.value)}
                                    rows={2}
                                    placeholder="e.g. Verified physical attendance on paper sign-in sheet at main gate..."
                                    className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:outline-none"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t-2 border-black/10">
                            <button
                                type="button"
                                onClick={() => setShowOverrideConfirmModal(false)}
                                className="px-4 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-bold cursor-pointer"
                            >
                                Cancel
                            </button>

                            <button
                                type="button"
                                disabled={isIssuing || !overrideReason.trim()}
                                onClick={() => executeBatchDispatch(true, overrideReason.trim())}
                                className="px-5 py-2 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ebd04e] text-xs font-black shadow-[2px_2px_0px_#000] disabled:opacity-40 cursor-pointer"
                            >
                                Authorize & Issue Batch
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* TEMPLATE PICKER MODAL */}
            {/* ================================================================ */}
            {isTemplatePickerOpen && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setIsTemplatePickerOpen(false)}
                >
                    <div
                        className="bg-white rounded-3xl border-4 border-black shadow-[8px_8px_0px_#000] w-full max-w-4xl p-6 sm:p-8 space-y-4 max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b-2 border-black/10 pb-3">
                            <div>
                                <h4 className="font-black text-lg text-black">
                                    Select Certificate Design Template
                                </h4>
                                <p className="text-xs text-neutral-500">
                                    Choose an Orbix official design or your club-saved template for this issuance.
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsTemplatePickerOpen(false)}
                                className="w-8 h-8 rounded-lg border-2 border-black bg-[#FAF6EE] hover:bg-neutral-200 flex items-center justify-center font-black cursor-pointer"
                            >
                                <X className="w-4 h-4 text-black" />
                            </button>
                        </div>

                        <div className="overflow-y-auto flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pr-1">
                            {availableTemplates.map((tmpl) => (
                                <div
                                    key={tmpl.id}
                                    onClick={() => {
                                        setActiveDesign(tmpl.design);
                                        setActiveTemplateId(tmpl.id);
                                        setActiveTemplateName(tmpl.name);
                                        setIsTemplatePickerOpen(false);
                                        toast.success(`Selected template: "${tmpl.name}".`);
                                    }}
                                    className={`p-3 rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between space-y-2 ${
                                        activeTemplateId === tmpl.id
                                            ? "border-black bg-[#FFE566]/20 shadow-[3px_3px_0px_#000]"
                                            : "border-neutral-200 hover:border-black bg-white hover:shadow-[3px_3px_0px_#000]"
                                    }`}
                                >
                                    <div className="w-full rounded-lg overflow-hidden border border-black/20">
                                        <CertificateThumbnailPreview
                                            design={tmpl.design}
                                            sampleRecipientName="Recipient Full Name"
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between text-[10px]">
                                            <span className="font-black uppercase px-1.5 py-0.5 rounded bg-[#FFE566] border border-black/30">
                                                {tmpl.category}
                                            </span>
                                            <span className="font-bold text-neutral-500">
                                                v{tmpl.version}
                                            </span>
                                        </div>
                                        <div className="font-black text-xs text-black mt-1 truncate" title={tmpl.name}>
                                            {tmpl.name}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="pt-2 border-t-2 border-black/10 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setIsTemplatePickerOpen(false)}
                                className="px-5 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-bold cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* ADD EXTERNAL RECIPIENT MODAL (PHASE 11 VERIFIED CLAIM) */}
            {/* ================================================================ */}
            {showAddExternalModal && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setShowAddExternalModal(false)}
                >
                    <div
                        className="bg-white rounded-3xl border-4 border-black shadow-[8px_8px_0px_#000] w-full max-w-md p-6 space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b-2 border-black/10 pb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-[#FFE566] border-2 border-black flex items-center justify-center text-black">
                                    <ExternalLink className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black text-black uppercase">Add External Recipient</h3>
                                    <p className="text-[10px] font-bold text-neutral-500">Generates 60-Day Verifiable Claim Link</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setShowAddExternalModal(false)}
                                className="p-1.5 rounded-lg border-2 border-black hover:bg-neutral-100 cursor-pointer"
                            >
                                <X className="w-4 h-4 text-black" />
                            </button>
                        </div>

                        <div className="space-y-3">
                            <div>
                                <label className="text-xs font-black text-black block mb-1">
                                    Recipient Full Name <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={extFormName}
                                    onChange={(e) => setExtFormName(e.target.value)}
                                    placeholder="e.g. Dr. Jane Doe or Ananya Verma"
                                    className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-black text-black block mb-1">
                                    Recipient Email <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="email"
                                    value={extFormEmail}
                                    onChange={(e) => setExtFormEmail(e.target.value)}
                                    placeholder="e.g. jane.doe@university.edu"
                                    className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:outline-none"
                                />
                            </div>

                            <div>
                                <label className="text-xs font-black text-black block mb-1">
                                    Custom Award Position / Role (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={extFormPosition}
                                    onChange={(e) => setExtFormPosition(e.target.value)}
                                    placeholder="e.g. Guest Keynote Speaker or Winning Team Lead"
                                    className="w-full p-2.5 text-xs font-bold border-2 border-black rounded-xl bg-[#FAF6EE] focus:outline-none"
                                />
                            </div>

                            <div className="p-3 bg-[#FAF6EE] rounded-xl border border-black text-[11px] text-neutral-600 leading-snug">
                                <span className="font-black text-black">Verified Claim Workflow:</span> External recipients do not need an existing Orbix account. They will receive a unique cryptographic claim token (`https://orbix.dev/verify/certificate/claim/:token`) valid for 60 days to bind to their profile upon signing up.
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-3 border-t-2 border-black/10">
                            <button
                                type="button"
                                onClick={() => setShowAddExternalModal(false)}
                                className="px-4 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    if (!extFormName.trim()) {
                                        toast.error("Recipient full name is required.");
                                        return;
                                    }
                                    if (!extFormEmail.trim() || !extFormEmail.includes("@")) {
                                        toast.error("Valid recipient email is required.");
                                        return;
                                    }
                                    setExternalRecipients((prev) => [
                                        ...prev,
                                        {
                                            id: `ext-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                                            name: extFormName.trim(),
                                            email: extFormEmail.trim(),
                                            customPosition: extFormPosition.trim() || undefined,
                                        },
                                    ]);
                                    toast.success(`Added external recipient: ${extFormName.trim()}`);
                                    setShowAddExternalModal(false);
                                }}
                                className="px-5 py-2 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8ee673] text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer"
                            >
                                Add Recipient
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ================================================================ */}
            {/* TEAM ROSTER REVIEW MODAL (PHASE 12 FROZEN SNAPSHOT REVIEW) */}
            {/* ================================================================ */}
            {reviewingTeamId && teamSnapshots[reviewingTeamId] && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4"
                    onClick={() => setReviewingTeamId(null)}
                >
                    <div
                        className="bg-white rounded-3xl border-4 border-black shadow-[8px_8px_0px_#000] w-full max-w-2xl p-6 sm:p-7 space-y-5 max-h-[88vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between border-b-2 border-black/10 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-[#FFE566] border-2 border-black flex items-center justify-center text-black">
                                    <Building2 className="w-5 h-5" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-black">
                                        Review Team Roster: {teamSnapshots[reviewingTeamId].teamName}
                                    </h3>
                                    <p className="text-[11px] font-bold text-neutral-500">
                                        Authoritative Membership Snapshot · Captured at issuance
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setReviewingTeamId(null)}
                                className="p-1.5 rounded-lg border-2 border-black hover:bg-neutral-100 cursor-pointer"
                            >
                                <X className="w-4 h-4 text-black" />
                            </button>
                        </div>

                        {/* Mode Selector for this Team */}
                        <div className="p-3 bg-[#FAF6EE] rounded-2xl border-2 border-black space-y-2">
                            <div className="text-xs font-black text-black flex items-center justify-between">
                                <span>Issuance Mode for this Team:</span>
                                <span className="font-mono text-[10px] uppercase font-bold text-neutral-600">
                                    {teamIssuanceMode.replace("_", " ")}
                                </span>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {[
                                    { id: "both" as const, label: "🌟 Both (Team + Members)" },
                                    { id: "team_only" as const, label: "🏆 Team Cert Only" },
                                    { id: "individual_only" as const, label: "👤 Members Only" },
                                ].map((m) => (
                                    <button
                                        key={m.id}
                                        type="button"
                                        onClick={() => setTeamIssuanceMode(m.id)}
                                        className={`p-2 rounded-xl border-2 text-[11px] font-black transition-all cursor-pointer text-center ${
                                            teamIssuanceMode === m.id
                                                ? "border-black bg-[#FFE566] shadow-[2px_2px_0px_#000]"
                                                : "border-black/20 bg-white hover:border-black"
                                        }`}
                                    >
                                        {m.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Members Roster List */}
                        <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                            <div className="flex items-center justify-between text-xs font-black text-black">
                                <span>Team Members ({teamSnapshots[reviewingTeamId].members.filter((m) => m.included).length} Included)</span>
                                <span className="text-[10px] text-neutral-500 font-bold">
                                    Toggle checkboxes to include or exclude from snapshot
                                </span>
                            </div>

                            {teamSnapshots[reviewingTeamId].members.map((member, idx) => (
                                <div
                                    key={member.id}
                                    className={`p-3 rounded-xl border-2 transition-all flex items-center justify-between gap-3 ${
                                        member.included
                                            ? "border-black bg-white shadow-[2px_2px_0px_#000]"
                                            : "border-neutral-200 bg-neutral-100 opacity-60"
                                    }`}
                                >
                                    <div className="flex items-center gap-3 flex-1 min-w-0">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTeamSnapshots((prev) => {
                                                    const cur = prev[reviewingTeamId];
                                                    const updated = [...cur.members];
                                                    updated[idx] = { ...updated[idx], included: !updated[idx].included };
                                                    return { ...prev, [reviewingTeamId]: { ...cur, members: updated } };
                                                });
                                            }}
                                            className={`w-5 h-5 rounded-md border-2 border-black flex items-center justify-center shrink-0 cursor-pointer ${
                                                member.included ? "bg-[#FFE566]" : "bg-white"
                                            }`}
                                        >
                                            {member.included && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                                        </button>

                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-black text-black truncate">
                                                    {member.name}
                                                </span>
                                                {member.isExternal && (
                                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-blue-100 border border-blue-300 text-blue-800">
                                                        Guest
                                                    </span>
                                                )}
                                                {member.username && (
                                                    <span className="text-[10px] font-mono text-neutral-400">
                                                        @{member.username}
                                                    </span>
                                                )}
                                            </div>
                                            {member.email && (
                                                <div className="text-[10px] text-neutral-500 font-mono truncate">
                                                    {member.email}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Editable Role and Position */}
                                    <div className="flex items-center gap-2 shrink-0">
                                        <div className="w-28">
                                            <input
                                                type="text"
                                                value={member.role}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setTeamSnapshots((prev) => {
                                                        const cur = prev[reviewingTeamId];
                                                        const updated = [...cur.members];
                                                        updated[idx] = { ...updated[idx], role: val };
                                                        return { ...prev, [reviewingTeamId]: { ...cur, members: updated } };
                                                    });
                                                }}
                                                placeholder="Role"
                                                className="w-full p-1.5 text-xs font-bold border-2 border-black rounded-lg bg-[#FAF6EE] focus:outline-none"
                                            />
                                        </div>

                                        <div className="w-32">
                                            <input
                                                type="text"
                                                value={member.customPosition || ""}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setTeamSnapshots((prev) => {
                                                        const cur = prev[reviewingTeamId];
                                                        const updated = [...cur.members];
                                                        updated[idx] = { ...updated[idx], customPosition: val };
                                                        return { ...prev, [reviewingTeamId]: { ...cur, members: updated } };
                                                    });
                                                }}
                                                placeholder="Award Position"
                                                className="w-full p-1.5 text-xs font-bold border-2 border-black rounded-lg bg-[#FAF6EE] focus:outline-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            ))}

                            {/* Add Guest / External Member to Team Snapshot */}
                            <div className="p-3 bg-[#FAF6EE] rounded-xl border-2 border-dashed border-black/30 space-y-2 mt-3">
                                <span className="text-[11px] font-black uppercase text-black block">
                                    + Add Temporary Guest or Contributor to Snapshot
                                </span>
                                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    <input
                                        type="text"
                                        value={guestName}
                                        onChange={(e) => setGuestName(e.target.value)}
                                        placeholder="Guest Full Name"
                                        className="p-1.5 text-xs font-bold border-2 border-black rounded-lg bg-white"
                                    />
                                    <input
                                        type="text"
                                        value={guestRole}
                                        onChange={(e) => setGuestRole(e.target.value)}
                                        placeholder="Role (e.g. Lead Dev)"
                                        className="p-1.5 text-xs font-bold border-2 border-black rounded-lg bg-white"
                                    />
                                    <input
                                        type="email"
                                        value={guestEmail}
                                        onChange={(e) => setGuestEmail(e.target.value)}
                                        placeholder="Email (optional)"
                                        className="p-1.5 text-xs font-bold border-2 border-black rounded-lg bg-white"
                                    />
                                </div>
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (!guestName.trim()) {
                                                toast.error("Guest name is required.");
                                                return;
                                            }
                                            setTeamSnapshots((prev) => {
                                                const cur = prev[reviewingTeamId];
                                                return {
                                                    ...prev,
                                                    [reviewingTeamId]: {
                                                        ...cur,
                                                        members: [
                                                            ...cur.members,
                                                            {
                                                                id: `guest-${Date.now()}`,
                                                                userId: null,
                                                                isExternal: true,
                                                                name: guestName.trim(),
                                                                role: guestRole.trim() || "Guest Contributor",
                                                                email: guestEmail.trim() || "",
                                                                customPosition: awardPosition || "",
                                                                included: true,
                                                            },
                                                        ],
                                                    },
                                                };
                                            });
                                            setGuestName("");
                                            setGuestEmail("");
                                            toast.success(`Added guest member to ${teamSnapshots[reviewingTeamId].teamName}.`);
                                        }}
                                        className="px-3 py-1 bg-[#a2ff86] hover:bg-[#8ee673] border-2 border-black rounded-lg text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                    >
                                        Add to Roster
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between pt-3 border-t-2 border-black/10">
                            <span className="text-[11px] font-bold text-neutral-500">
                                Changes are saved to this batch run snapshot.
                            </span>
                            <button
                                type="button"
                                onClick={() => {
                                    setReviewingTeamId(null);
                                    toast.success("Team roster snapshot confirmed.");
                                }}
                                className="px-5 py-2 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ebd04e] text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer"
                            >
                                Done & Confirm Roster
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Phase 13: Live Asynchronous Batch Generation & Progress Monitor Modal */}
            {showProgressModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
                    <div
                        className="fixed inset-0"
                        onClick={() => {
                            if (batchProgress?.status === "completed" || batchProgress?.status === "failed" || batchProgress?.status === "partially_failed") {
                                setShowProgressModal(false);
                            }
                        }}
                    />
                    <div className="relative w-full max-w-xl bg-white border-4 border-black rounded-3xl p-6 shadow-[8px_8px_0px_#000] space-y-5 z-10 animate-in zoom-in-95">
                        {/* Header */}
                        <div className="flex items-start justify-between gap-3 pb-3 border-b-2 border-black/10">
                            <div>
                                <div className="flex items-center gap-2">
                                    <span className="px-2 py-0.5 rounded-md bg-[#FFE566] border-2 border-black font-black text-[10px] uppercase tracking-wider">
                                        Phase 13
                                    </span>
                                    <h4 className="text-base font-black text-black flex items-center gap-1.5">
                                        <Zap className="w-5 h-5 text-black" />
                                        Async Batch Issuance Engine
                                    </h4>
                                </div>
                                <p className="text-xs text-neutral-600 mt-1 font-medium">
                                    Generating authoritative PDF credentials with bounded worker concurrency and cryptographic SHA-256 digests.
                                </p>
                            </div>

                            {(batchProgress?.status === "completed" ||
                                batchProgress?.status === "failed" ||
                                batchProgress?.status === "partially_failed") && (
                                <button
                                    type="button"
                                    onClick={() => setShowProgressModal(false)}
                                    className="p-1 rounded-lg border-2 border-black hover:bg-neutral-100 cursor-pointer"
                                >
                                    <X className="w-4 h-4 text-black" />
                                </button>
                            )}
                        </div>

                        {/* Status Indicator */}
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-black">
                                Status:{" "}
                                <strong
                                    className={`px-2 py-0.5 rounded-md border-2 border-black ${
                                        batchProgress?.status === "completed"
                                            ? "bg-[#a2ff86] text-black"
                                            : batchProgress?.status === "partially_failed"
                                            ? "bg-amber-200 text-black"
                                            : batchProgress?.status === "failed"
                                            ? "bg-red-200 text-red-900"
                                            : "bg-[#FFE566] text-black animate-pulse"
                                    }`}
                                >
                                    {batchProgress?.status === "completed"
                                        ? "🎉 All Certificates Generated"
                                        : batchProgress?.status === "partially_failed"
                                        ? "⚠️ Partially Completed with Failures"
                                        : batchProgress?.status === "failed"
                                        ? "❌ Batch Processing Failed"
                                        : batchProgress?.status === "processing"
                                        ? "⚡ Rendering & Verifying Credentials..."
                                        : "⏳ Queued in Worker Pool..."}
                                </strong>
                            </span>
                            <span className="text-xs font-mono font-black text-black">
                                {batchProgress?.progressPercentage || 0}%
                            </span>
                        </div>

                        {/* Animated Neo-Brutalist Progress Bar */}
                        <div className="w-full h-8 bg-neutral-100 border-3 border-black rounded-xl p-1 shadow-[2px_2px_0px_#000] overflow-hidden">
                            <div
                                style={{ width: `${Math.max(5, batchProgress?.progressPercentage || 0)}%` }}
                                className={`h-full border-r-2 border-black rounded-lg transition-all duration-500 font-black text-[11px] flex items-center justify-end pr-2 text-black ${
                                    batchProgress?.status === "completed"
                                        ? "bg-[#a2ff86]"
                                        : batchProgress?.status === "partially_failed"
                                        ? "bg-amber-300"
                                        : batchProgress?.status === "failed"
                                        ? "bg-red-300"
                                        : "bg-[#FFE566]"
                                }`}
                            >
                                {(batchProgress?.progressPercentage || 0) > 15 && `${batchProgress?.progressPercentage || 0}%`}
                            </div>
                        </div>

                        {/* Metrics Grid */}
                        <div className="grid grid-cols-4 gap-2 text-center">
                            <div className="p-2.5 bg-[#FAF6EE] border-2 border-black rounded-xl">
                                <div className="text-[10px] font-black text-neutral-500 uppercase">Total</div>
                                <div className="text-base font-black text-black">{batchProgress?.totalRecipients || 0}</div>
                            </div>
                            <div className="p-2.5 bg-[#a2ff86]/30 border-2 border-black rounded-xl">
                                <div className="text-[10px] font-black text-emerald-900 uppercase">Success</div>
                                <div className="text-base font-black text-emerald-900">{batchProgress?.successfulCount || 0}</div>
                            </div>
                            <div className="p-2.5 bg-red-50 border-2 border-black rounded-xl">
                                <div className="text-[10px] font-black text-red-800 uppercase">Failed</div>
                                <div className="text-base font-black text-red-700">{batchProgress?.failedCount || 0}</div>
                            </div>
                            <div className="p-2.5 bg-white border-2 border-black rounded-xl">
                                <div className="text-[10px] font-black text-neutral-500 uppercase">Throughput</div>
                                <div className="text-base font-black text-black">
                                    {batchProgress?.currentThroughput || 0} <span className="text-[9px]">c/s</span>
                                </div>
                            </div>
                        </div>

                        {/* Error Log Drawer (if failed items exist) */}
                        {batchProgress && (batchProgress.failedCount > 0 || batchProgress.errorLog.length > 0) && (
                            <div className="p-3 bg-red-50 rounded-xl border-2 border-black space-y-2">
                                <div className="flex items-center justify-between text-xs font-black text-red-900">
                                    <span className="flex items-center gap-1.5">
                                        <AlertTriangle className="w-4 h-4 text-red-600" />
                                        <span>Render & Issuance Failures ({batchProgress.errorLog.length})</span>
                                    </span>
                                    {batchProgress.canRetry && (
                                        <button
                                            type="button"
                                            disabled={isRetryingBatch}
                                            onClick={handleRetryFailedBatch}
                                            className="px-3 py-1 bg-[#FFE566] text-black border-2 border-black rounded-lg text-xs font-black shadow-[2px_2px_0px_#000] hover:bg-[#ebd04e] active:translate-x-[1px] active:translate-y-[1px] active:shadow-none cursor-pointer flex items-center gap-1"
                                        >
                                            <RefreshCw className={`w-3.5 h-3.5 ${isRetryingBatch ? "animate-spin" : ""}`} />
                                            <span>Retry Failed Recipients</span>
                                        </button>
                                    )}
                                </div>
                                <div className="max-h-32 overflow-y-auto space-y-1 text-[11px] font-mono text-red-800 divide-y divide-red-200">
                                    {batchProgress.errorLog.map((err, i) => (
                                        <div key={i} className="pt-1 flex items-start justify-between gap-2">
                                            <span>{err.recipientName || err.email || "Unknown"}: {err.error}</span>
                                            <span className="text-[9px] text-neutral-500 flex-shrink-0">
                                                {new Date(err.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Modal Footer */}
                        <div className="flex items-center justify-between pt-3 border-t-2 border-black/10">
                            <span className="text-[11px] font-bold text-neutral-500">
                                {batchProgress?.status === "completed"
                                    ? "All credentials conferred and notifications dispatched."
                                    : "You can safely close this modal; generation runs in the background."}
                            </span>
                            <div className="flex items-center gap-2">
                                {(batchProgress?.status === "processing" || batchProgress?.status === "queued") && (
                                    <button
                                        type="button"
                                        disabled={isCancellingBatch}
                                        onClick={handleCancelBatch}
                                        className="px-3 py-2 rounded-xl border-2 border-black bg-red-100 hover:bg-red-200 text-red-900 text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5"
                                    >
                                        <XCircle className="w-3.5 h-3.5 text-red-700" />
                                        <span>{isCancellingBatch ? "Cancelling..." : "Cancel Batch"}</span>
                                    </button>
                                )}
                                {batchProgress && (batchProgress.status === "completed" || batchProgress.status === "partially_failed" || batchProgress.status === "failed" || batchProgress.status === "cancelled") && (
                                    <button
                                        type="button"
                                        onClick={handleDownloadReport}
                                        className="px-3 py-2 rounded-xl border-2 border-black bg-[#a2ff86] hover:bg-[#8ee875] text-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5"
                                    >
                                        <Download className="w-3.5 h-3.5 text-black" />
                                        <span>Report (CSV)</span>
                                    </button>
                                )}
                                {batchProgress?.isRecoverable && batchProgress.canRetry && (
                                    <button
                                        type="button"
                                        disabled={isRetryingBatch}
                                        onClick={handleRetryFailedBatch}
                                        className="px-4 py-2 rounded-xl border-2 border-black bg-[#FFE566] hover:bg-[#ebd04e] text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5"
                                    >
                                        <Zap className="w-3.5 h-3.5 text-black" />
                                        <span>Retry Failed</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setShowProgressModal(false)}
                                    className="px-5 py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer"
                                >
                                    Close Monitor
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* Cancel Batch Confirmation Modal */}
            <ConfirmationModal
                isOpen={isCancelModalOpen}
                onClose={() => setIsCancelModalOpen(false)}
                onConfirm={handleConfirmCancelBatch}
                title="Cancel Issuance Batch"
                description="Are you sure you want to cancel this certificate issuance batch? Any pending or unprocessed recipients will be immediately aborted."
                confirmText="Cancel Batch"
                confirmLabel="Abort Batch"
                variant="danger"
                isLoading={isCancellingBatch}
            />
        </div>
    );
};
