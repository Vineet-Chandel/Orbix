import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
        Search,
    GraduationCap,
    RefreshCw,
    ExternalLink,
    Lock,
    CheckCircle2,
    XCircle,
    X,
            Eye,
    Mail,
    Phone,
    FileText,
            ArrowLeft,
} from "lucide-react";
import { OrbixButton } from "../../components/OrbixButton";
import { OrbixLogo } from "../../components/OrbixLogo";
import { useToast } from "../../context/ToastContext";
import {
    checkFounderPrivilege,
    fetchFounderQueue,
    fetchApplicationDetails,
    approveApplication,
    rejectApplication,
    type CollegeVerificationRecord,
} from "../../api/collegeVerificationApi";

export default function FounderCollegeVerificationsPage() {
    
    const toast = useToast();

    // Founder Access & Loading States
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isAuthorized, setIsAuthorized] = useState(false);
    const [isLoadingQueue, setIsLoadingQueue] = useState(false);
    const [isActing, setIsActing] = useState(false);

    // Queue & Filter State
    const [applications, setApplications] = useState<CollegeVerificationRecord[]>([]);
    const [selectedStatus, setSelectedStatus] = useState<string>("PENDING");
    const [searchQuery, setSearchQuery] = useState("");
    const [totalCount, setTotalCount] = useState(0);

    // Selected Application for Inspector
    const [selectedApp, setSelectedApp] = useState<CollegeVerificationRecord | null>(null);
    

    // Rejection Dialog State
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectionReason, setRejectionReason] = useState("");

    // Quick common rejection reasons
    const commonReasons = [
        "Document is blurry or unreadable. Please upload a high-resolution photo.",
        "Student name on ID card does not match Orbix account name.",
        "Institution name on document does not match currently selected college.",
        "Student ID card appears expired or validity has lapsed.",
        "Submitted document is not an official student ID card or ERP screenshot.",
    ];

    // Check founder privileges
    useEffect(() => {
        const verifyAccess = async () => {
            setIsCheckingAuth(true);
            try {
                const res = await checkFounderPrivilege();
                if (res.isFounder) {
                    setIsAuthorized(true);
                } else {
                    setIsAuthorized(false);
                }
            } catch {
                setIsAuthorized(false);
            } finally {
                setIsCheckingAuth(false);
            }
        };
        verifyAccess();
    }, []);

    // Load queue whenever filter or search changes
    const loadQueue = async () => {
        if (!isAuthorized) return;
        setIsLoadingQueue(true);
        try {
            const data = await fetchFounderQueue({
                status: selectedStatus,
                search: searchQuery,
                limit: 50,
            });
            setApplications(data.applications || []);
            setTotalCount(data.total || 0);

            // If selected app is in list, update it, or select first if none selected
            if (selectedApp) {
                const match = data.applications.find((a) => a.id === selectedApp.id);
                if (match) setSelectedApp(match);
            } else if (data.applications.length > 0) {
                handleSelectApp(data.applications[0]);
            }
        } catch (err: any) {
            console.error("Queue load error:", err);
            toast.error(err.message || "Failed to load verification applications.");
        } finally {
            setIsLoadingQueue(false);
        }
    };

    useEffect(() => {
        if (isAuthorized) {
            loadQueue();
        }
    }, [isAuthorized, selectedStatus]);

    // Search submit
    const handleSearchSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        loadQueue();
    };

    // Inspector select handler
    const handleSelectApp = async (app: CollegeVerificationRecord) => {
        setSelectedApp(app);
        
        try {
            const details = await fetchApplicationDetails(app.id);
            setSelectedApp(details.application);
        } catch (err: any) {
            console.warn("Failed to load full application details:", err.message);
        } finally {
            
        }
    };

    // Approve handler
    const handleApprove = async () => {
        if (!selectedApp) return;
        setIsActing(true);
        try {
            const res = await approveApplication(selectedApp.id, "Verified by founder");
            toast.success(res.message, { title: "Application Approved" });
            setSelectedApp(res.application);
            loadQueue();
        } catch (err: any) {
            toast.error(err.message || "Failed to approve application.", { title: "Approval Failed" });
        } finally {
            setIsActing(false);
        }
    };

    // Reject handler
    const handleConfirmReject = async () => {
        if (!selectedApp) return;
        if (!rejectionReason.trim()) {
            toast.error("A rejection reason is mandatory to guide the student.", { title: "Reason Required" });
            return;
        }

        setIsActing(true);
        try {
            const res = await rejectApplication(selectedApp.id, rejectionReason.trim());
            toast.success(res.message, { title: "Application Rejected" });
            setIsRejectModalOpen(false);
            setRejectionReason("");
            setSelectedApp(res.application);
            loadQueue();
        } catch (err: any) {
            toast.error(err.message || "Failed to reject application.", { title: "Rejection Failed" });
        } finally {
            setIsActing(false);
        }
    };

    // Render access check loader
    if (isCheckingAuth) {
        return (
            <div className="min-h-screen bg-[#FAF6EE] flex items-center justify-center p-4">
                <div className="text-center space-y-3">
                    <div className="w-10 h-10 border-3 border-black border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs font-black uppercase tracking-wider text-neutral-600">
                        Verifying Founder Authorization...
                    </p>
                </div>
            </div>
        );
    }

    // Render 403 Access Denied
    if (!isAuthorized) {
        return (
            <div className="min-h-screen bg-[#FAF6EE] flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white border-2 border-black rounded-2xl p-6 sm:p-8 shadow-[8px_8px_0px_#000] text-black text-center space-y-4">
                    <div className="w-14 h-14 rounded-2xl bg-rose-400 border-2 border-black flex items-center justify-center shadow-[3px_3px_0px_#000] mx-auto">
                        <Lock className="w-7 h-7 text-black stroke-[2.5]" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-black">
                            Founder Access Restricted
                        </h2>
                        <p className="text-xs text-neutral-600 font-bold mt-1">
                            This internal review console is strictly restricted to authorized Orbix founders.
                        </p>
                    </div>
                    <p className="text-xs text-neutral-700 font-medium leading-relaxed bg-neutral-50 p-3 rounded-xl border border-black/10">
                        If you are an authorized founder, ensure your server-side environment variable (<code className="font-mono text-black font-bold">ORBIX_FOUNDER_USER_IDS</code>) includes your stable account ID.
                    </p>
                    <Link
                        to="/dashboard"
                        className="inline-block px-5 py-2.5 rounded-xl bg-[#FFE566] text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] transition-all cursor-pointer"
                    >
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#FAF6EE] text-black flex flex-col font-sans">
            {/* Header */}
            <header className="bg-white border-b-2 border-black px-4 sm:px-8 py-3.5 sticky top-0 z-40 shadow-sm">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <Link to="/dashboard">
                            <OrbixLogo className="h-7 w-auto" />
                        </Link>
                        <div className="h-5 w-[2px] bg-black/20" />
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 rounded-md bg-[#FFE566] border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_#000]">
                                Founder Console
                            </span>
                            <h1 className="text-sm sm:text-base font-black tracking-tight text-black truncate">
                                College Verifications Queue
                            </h1>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <button
                            onClick={loadQueue}
                            disabled={isLoadingQueue}
                            className="p-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer transition-transform hover:scale-105 active:scale-95 disabled:opacity-50"
                            title="Refresh Queue"
                        >
                            <RefreshCw className={`w-4 h-4 stroke-[2.5] ${isLoadingQueue ? "animate-spin" : ""}`} />
                        </button>
                        <Link
                            to="/dashboard"
                            className="px-3.5 py-1.5 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                        >
                            <ArrowLeft className="w-3.5 h-3.5 mr-1 inline" />
                            Exit
                        </Link>
                    </div>
                </div>
            </header>

            {/* Main Content (2-Column Review Layout) */}
            <main className="max-w-7xl mx-auto w-full p-4 sm:p-6 flex-1 flex flex-col gap-4">
                {/* Search & Filter Bar */}
                <div className="bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row items-center justify-between gap-3">
                    {/* Status Tabs */}
                    <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto pb-1 sm:pb-0">
                        {[
                            { id: "PENDING", label: "Pending Review" },
                            { id: "APPROVED", label: "Approved" },
                            { id: "REJECTED", label: "Rejected" },
                            { id: "all", label: "All Records" },
                        ].map((t) => (
                            <button
                                key={t.id}
                                onClick={() => setSelectedStatus(t.id)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-black uppercase border-2 border-black transition-all cursor-pointer shrink-0 ${
                                    selectedStatus === t.id
                                        ? "bg-[#FFE566] shadow-[2px_2px_0px_#000]"
                                        : "bg-white hover:bg-neutral-100 shadow-[1px_1px_0px_#000]"
                                }`}
                            >
                                {t.label}
                            </button>
                        ))}
                    </div>

                    {/* Search Input */}
                    <form onSubmit={handleSearchSubmit} className="flex gap-2 w-full sm:w-72">
                        <div className="relative flex-1">
                            <Search className="w-4 h-4 absolute left-3 top-2.5 text-neutral-500" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search student, roll, college..."
                                className="w-full pl-9 pr-3 py-2 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_#000]"
                            />
                        </div>
                        <button
                            type="submit"
                            className="px-3 py-2 rounded-xl bg-black text-white text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                        >
                            Go
                        </button>
                    </form>
                </div>

                {/* Applications Grid / Split View */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 flex-1 items-start">
                    {/* Left Column: Applications List (5 Cols) */}
                    <div className="lg:col-span-5 bg-white border-2 border-black rounded-2xl p-4 shadow-[4px_4px_0px_#000] space-y-3 max-h-[78vh] flex flex-col">
                        <div className="flex items-center justify-between pb-2 border-b-2 border-black/10 shrink-0">
                            <h2 className="text-xs font-black uppercase tracking-wider text-black">
                                Applications ({totalCount})
                            </h2>
                            <span className="text-[11px] text-neutral-600 font-bold">
                                Filter: {selectedStatus}
                            </span>
                        </div>

                        <div className="overflow-y-auto space-y-2.5 flex-1 pr-1">
                            {isLoadingQueue ? (
                                <div className="py-12 text-center space-y-2">
                                    <div className="w-6 h-6 border-2 border-black border-t-transparent rounded-full animate-spin mx-auto" />
                                    <p className="text-xs font-black uppercase text-neutral-500">Loading queue...</p>
                                </div>
                            ) : applications.length === 0 ? (
                                <div className="py-12 text-center space-y-2 text-neutral-500">
                                    <GraduationCap className="w-8 h-8 mx-auto stroke-[1.5]" />
                                    <p className="text-xs font-bold">No applications found in this view.</p>
                                </div>
                            ) : (
                                applications.map((app) => {
                                    const isSelected = selectedApp?.id === app.id;
                                    return (
                                        <div
                                            key={app.id}
                                            onClick={() => handleSelectApp(app)}
                                            className={`p-3 rounded-xl border-2 border-black text-left cursor-pointer transition-all ${
                                                isSelected
                                                    ? "bg-[#FFE566] shadow-[3px_3px_0px_#000] translate-x-[-1px] translate-y-[-1px]"
                                                    : "bg-[#FAF6EE] hover:bg-neutral-100 shadow-[1.5px_1.5px_0px_#000]"
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="min-w-0 flex-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <h3 className="text-xs font-black text-black truncate">
                                                            {app.student_name || app.user_display_name || app.user_username || "Student"}
                                                        </h3>
                                                        <span className="text-[10px] text-neutral-600 font-mono font-bold">
                                                            @{app.user_username}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-neutral-700 font-bold truncate mt-0.5">
                                                        {app.college_name || "Institution Name"}
                                                    </p>
                                                </div>

                                                <span
                                                    className={`px-2 py-0.5 rounded-full border border-black text-[9px] font-black uppercase shrink-0 shadow-[1px_1px_0px_#000] ${
                                                        app.status === "APPROVED"
                                                            ? "bg-emerald-300 text-emerald-950"
                                                            : app.status === "REJECTED"
                                                            ? "bg-rose-300 text-rose-950"
                                                            : "bg-amber-300 text-amber-950"
                                                    }`}
                                                >
                                                    {app.status}
                                                </span>
                                            </div>

                                            {/* Indicators Pill Row */}
                                            <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[10px] font-bold">
                                                {app.enrollment_number && (
                                                    <span className="px-1.5 py-0.5 rounded bg-white border border-black/40 text-neutral-800">
                                                        ID: {app.enrollment_number}
                                                    </span>
                                                )}
                                                {app.is_email_verified && (
                                                    <span className="px-1.5 py-0.5 rounded bg-blue-100 border border-black/40 text-blue-900 flex items-center gap-1">
                                                        <Mail className="w-3 h-3" /> Email Verified
                                                    </span>
                                                )}
                                                {app.is_phone_verified && (
                                                    <span className="px-1.5 py-0.5 rounded bg-emerald-100 border border-black/40 text-emerald-900 flex items-center gap-1">
                                                        <Phone className="w-3 h-3" /> Phone Verified
                                                    </span>
                                                )}
                                                <span className="px-1.5 py-0.5 rounded bg-neutral-200 border border-black/40 text-neutral-800">
                                                    OCR: {app.ocr_confidence}%
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right Column: Application Inspector (7 Cols) */}
                    <div className="lg:col-span-7 bg-white border-2 border-black rounded-2xl p-4 sm:p-6 shadow-[4px_4px_0px_#000] space-y-5 max-h-[78vh] overflow-y-auto">
                        {!selectedApp ? (
                            <div className="py-24 text-center space-y-2 text-neutral-500">
                                <FileText className="w-10 h-10 mx-auto stroke-[1.5]" />
                                <p className="text-xs font-black uppercase tracking-wider">
                                    Select an application from the queue to inspect details
                                </p>
                            </div>
                        ) : (
                            <div className="space-y-5">
                                {/* Top Bar: Student Identity & Decision Badges */}
                                <div className="flex items-start justify-between gap-3 pb-3 border-b-2 border-black/10">
                                    <div className="flex items-center gap-3 min-w-0">
                                        <img
                                            src={selectedApp.user_avatar_url || "https://res.cloudinary.com/dj0ivep44/image/upload/v1793017168/avatar_pasprg.png"}
                                            alt="Avatar"
                                            className="w-12 h-12 rounded-xl object-cover border-2 border-black shadow-[2px_2px_0px_#000] shrink-0"
                                        />
                                        <div className="min-w-0">
                                            <h3 className="text-base font-black text-black truncate">
                                                {selectedApp.student_name || selectedApp.user_display_name || selectedApp.user_username}
                                            </h3>
                                            <p className="text-xs text-neutral-600 font-bold">
                                                @{selectedApp.user_username} • {selectedApp.user_email}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-right shrink-0">
                                        <span
                                            className={`inline-block px-3 py-1 rounded-full border-2 border-black text-xs font-black uppercase shadow-[2px_2px_0px_#000] ${
                                                selectedApp.status === "APPROVED"
                                                    ? "bg-emerald-400 text-emerald-950"
                                                    : selectedApp.status === "REJECTED"
                                                    ? "bg-rose-400 text-rose-950"
                                                    : "bg-[#FFE566] text-black"
                                            }`}
                                        >
                                            {selectedApp.status}
                                        </span>
                                        <p className="text-[10px] text-neutral-500 font-bold mt-1">
                                            Submitted {new Date(selectedApp.created_at).toLocaleDateString()}
                                        </p>
                                    </div>
                                </div>

                                {/* Institution Affiliation Banner */}
                                <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-3">
                                    <div className="min-w-0">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600 block">
                                            Affiliated Institution
                                        </span>
                                        <h4 className="text-xs sm:text-sm font-black text-black truncate">
                                            {selectedApp.college_name}
                                        </h4>
                                        <p className="text-[11px] text-neutral-600 font-semibold truncate">
                                            {[selectedApp.college_city, selectedApp.college_state].filter(Boolean).join(", ")}
                                        </p>
                                    </div>
                                    {selectedApp.college_website && (
                                        <a
                                            href={selectedApp.college_website.startsWith("http") ? selectedApp.college_website : `https://${selectedApp.college_website}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="px-2.5 py-1.5 rounded-lg bg-white hover:bg-neutral-100 text-black border border-black text-[11px] font-black uppercase shadow-[1px_1px_0px_#000] shrink-0 inline-flex items-center gap-1"
                                        >
                                            Website <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>

                                {/* Document Previews via Short-Lived Private URLs */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                            Private Document Preview ({selectedApp.document_previews?.length || 0})
                                        </h4>
                                        <span className="text-[10px] font-bold text-neutral-500">
                                            Signed 5-minute URL
                                        </span>
                                    </div>

                                    {selectedApp.document_previews && selectedApp.document_previews.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {selectedApp.document_previews.map((doc, idx) => (
                                                <div
                                                    key={idx}
                                                    className="p-2.5 rounded-xl bg-neutral-50 border-2 border-black shadow-[2px_2px_0px_#000] space-y-2"
                                                >
                                                    <div className="relative group overflow-hidden rounded-lg border border-black bg-black/5 aspect-[4/3] flex items-center justify-center">
                                                        <img
                                                            src={doc.url}
                                                            alt={`Document ${idx + 1}`}
                                                            className="w-full h-full object-contain"
                                                        />
                                                        <a
                                                            href={doc.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity font-black text-xs gap-1.5"
                                                        >
                                                            <Eye className="w-4 h-4" /> View Full Size
                                                        </a>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[11px] font-bold text-neutral-700">
                                                        <span className="truncate">{doc.originalName}</span>
                                                        <span className="shrink-0">{Math.round(doc.size / 1024)} KB</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <p className="text-xs text-neutral-500 font-semibold p-3 bg-neutral-50 rounded-xl border border-black/10">
                                            No document preview available.
                                        </p>
                                    )}
                                </div>

                                {/* OCR Data Comparison Table */}
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                            Extracted Credentials vs Submitted Data
                                        </h4>
                                        <span className="px-2 py-0.5 rounded-full bg-[#FFE566] border border-black text-[10px] font-black uppercase shadow-[1px_1px_0px_#000]">
                                            OCR {selectedApp.ocr_confidence}% Confidence
                                        </span>
                                    </div>

                                    <div className="p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-2 text-xs">
                                        <div className="grid grid-cols-3 gap-2 py-1 border-b border-black/10">
                                            <span className="text-neutral-500 font-bold">Field</span>
                                            <span className="font-bold text-neutral-700">OCR Extracted</span>
                                            <span className="font-black text-black">Submitted Value</span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 py-1 border-b border-black/10">
                                            <span className="text-neutral-600 font-bold">Student Name</span>
                                            <span className="text-neutral-700 truncate">{selectedApp.extracted_data?.studentName || "—"}</span>
                                            <span className="font-black text-black truncate">{selectedApp.student_name || "—"}</span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 py-1 border-b border-black/10">
                                            <span className="text-neutral-600 font-bold">Enrollment / Roll No</span>
                                            <span className="text-neutral-700 truncate">{selectedApp.extracted_data?.enrollmentNumber || "—"}</span>
                                            <span className="font-black text-black truncate">{selectedApp.enrollment_number || "—"}</span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 py-1 border-b border-black/10">
                                            <span className="text-neutral-600 font-bold">Course / Degree</span>
                                            <span className="text-neutral-700 truncate">{selectedApp.extracted_data?.courseName || "—"}</span>
                                            <span className="font-black text-black truncate">{selectedApp.course_name || "—"}</span>
                                        </div>

                                        <div className="grid grid-cols-3 gap-2 py-1">
                                            <span className="text-neutral-600 font-bold">Academic Year</span>
                                            <span className="text-neutral-700 truncate">{selectedApp.extracted_data?.academicYear || "—"}</span>
                                            <span className="font-black text-black truncate">{selectedApp.academic_year || "—"}</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Verified Communication Channels */}
                                <div className="space-y-2">
                                    <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                        Contact Verification Channels
                                    </h4>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                        {/* Email */}
                                        <div className="p-3 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 font-black text-black">
                                                    <Mail className="w-3.5 h-3.5 text-black" />
                                                    <span>Institutional Email</span>
                                                </div>
                                                <p className="text-[11px] text-neutral-600 font-bold truncate mt-0.5">
                                                    {selectedApp.institution_email || "None provided"}
                                                </p>
                                            </div>
                                            {selectedApp.is_email_verified ? (
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-black text-[9px] font-black text-emerald-900 uppercase">
                                                    Verified
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full bg-neutral-100 border border-black/40 text-[9px] font-bold text-neutral-600 uppercase">
                                                    Unverified
                                                </span>
                                            )}
                                        </div>

                                        {/* Phone */}
                                        <div className="p-3 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-between gap-2">
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5 font-black text-black">
                                                    <Phone className="w-3.5 h-3.5 text-black" />
                                                    <span>Mobile Number</span>
                                                </div>
                                                <p className="text-[11px] text-neutral-600 font-bold truncate mt-0.5">
                                                    {selectedApp.phone_number || "None provided"}
                                                </p>
                                            </div>
                                            {selectedApp.is_phone_verified ? (
                                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 border border-black text-[9px] font-black text-emerald-900 uppercase">
                                                    OTP Verified
                                                </span>
                                            ) : (
                                                <span className="px-2 py-0.5 rounded-full bg-neutral-100 border border-black/40 text-[9px] font-bold text-neutral-600 uppercase">
                                                    Unverified
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Review Decision History (if reviewed) */}
                                {selectedApp.reviewed_at && (
                                    <div className="p-3.5 rounded-xl bg-neutral-50 border-2 border-black shadow-[2px_2px_0px_#000] space-y-1.5 text-xs">
                                        <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600 block">
                                            Review Decision Audit
                                        </span>
                                        <p className="font-bold text-black">
                                            Decided by: <span className="font-black">@{selectedApp.reviewer_username || "Founder"}</span> on {new Date(selectedApp.reviewed_at).toLocaleString()}
                                        </p>
                                        {selectedApp.rejection_reason && (
                                            <p className="text-rose-950 font-bold">
                                                Reason: {selectedApp.rejection_reason}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Action Buttons */}
                                <div className="flex items-center justify-end gap-3 pt-3 border-t-2 border-black/10">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setRejectionReason("");
                                            setIsRejectModalOpen(true);
                                        }}
                                        disabled={isActing}
                                        className="px-5 py-2.5 rounded-xl bg-rose-100 hover:bg-rose-200 text-rose-950 text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[1px_1px_0px_#000] cursor-pointer transition-all disabled:opacity-50"
                                    >
                                        <XCircle className="w-4 h-4 mr-1.5 inline stroke-[2.5]" />
                                        Reject Application
                                    </button>

                                    <OrbixButton
                                        onClick={handleApprove}
                                        disabled={isActing}
                                        className="bg-[#FFE566] text-black font-black uppercase text-xs"
                                    >
                                        <CheckCircle2 className="w-4 h-4 mr-1.5 inline stroke-[2.5]" />
                                        Approve Verification
                                    </OrbixButton>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>

            {/* Rejection Modal with Mandatory Reason */}
            {isRejectModalOpen && (
                <div className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[150] flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="w-full max-w-lg bg-white border-2 border-black rounded-2xl p-6 shadow-[8px_8px_0px_#000] text-black space-y-4 animate-in zoom-in-95 duration-150">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl bg-rose-400 border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                                    <XCircle className="w-6 h-6 text-black stroke-[2.5]" />
                                </div>
                                <div>
                                    <h3 className="text-base font-black text-black">
                                        Reject Verification Application
                                    </h3>
                                    <p className="text-xs text-neutral-600 font-bold">
                                        Provide a clear, mandatory reason for the student
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsRejectModalOpen(false)}
                                className="p-1 rounded-lg border-2 border-black hover:bg-neutral-100 cursor-pointer"
                            >
                                <X className="w-4 h-4 stroke-[2.5]" />
                            </button>
                        </div>

                        {/* Quick Reason Chips */}
                        <div className="space-y-1.5">
                            <label className="block text-[11px] font-black uppercase tracking-wider text-neutral-600">
                                Common Rejection Reasons
                            </label>
                            <div className="flex flex-wrap gap-1.5">
                                {commonReasons.map((reason, idx) => (
                                    <button
                                        key={idx}
                                        type="button"
                                        onClick={() => setRejectionReason(reason)}
                                        className="px-2.5 py-1 rounded-lg bg-[#FAF6EE] hover:bg-neutral-200 border border-black text-[11px] font-bold text-black text-left cursor-pointer transition-colors"
                                    >
                                        {reason.slice(0, 45)}...
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Custom Reason Textarea */}
                        <div className="space-y-1">
                            <label className="block text-xs font-black uppercase tracking-wider text-black">
                                Mandatory Rejection Reason
                            </label>
                            <textarea
                                rows={4}
                                value={rejectionReason}
                                onChange={(e) => setRejectionReason(e.target.value)}
                                placeholder="Explain why this student document was rejected and what they need to upload to get verified..."
                                className="w-full px-3.5 py-2.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:bg-white focus:outline-hidden shadow-[2px_2px_0px_#000]"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2.5 pt-2 border-t-2 border-black/10">
                            <button
                                type="button"
                                onClick={() => setIsRejectModalOpen(false)}
                                className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black text-xs font-black uppercase border-2 border-black shadow-[2px_2px_0px_#000] cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmReject}
                                disabled={isActing || !rejectionReason.trim()}
                                className="px-5 py-2 rounded-xl bg-rose-400 hover:bg-rose-500 text-black text-xs font-black uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] cursor-pointer disabled:opacity-50"
                            >
                                Confirm Rejection
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
