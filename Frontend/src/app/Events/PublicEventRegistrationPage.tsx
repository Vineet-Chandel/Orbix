import React, { useEffect, useState, Suspense } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";
import {
    fetchPublicEventForm,
    type PublicFormResponse,
} from "../../api/clubEventFormApi";
import { useAppSelector } from "../../store";
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";

// Lazy-load the heavy student renderer for ultra-fast initial page paint (Phase 4.1)
const StudentFormRenderer = React.lazy(() =>
    import("../Club/FormBuilder/StudentFormRenderer").then((m) => ({
        default: m.StudentFormRenderer,
    }))
);

// Minimal Loading Skeleton (Phase 4.1)
function FormRendererSkeleton() {
    return (
        <div
            className="max-w-2xl mx-auto space-y-6 animate-pulse"
            aria-busy="true"
            aria-label="Loading registration form"
        >
            {/* Banner skeleton */}
            <div className="h-36 sm:h-48 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-neutral-200 dark:bg-neutral-800/50" />

            {/* Header card skeleton */}
            <div className="rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 p-6 sm:p-7 space-y-4 shadow-sm">
                <div className="flex items-center gap-2">
                    <div className="h-6 w-24 bg-neutral-100 dark:bg-neutral-800 rounded-lg" />
                    <div className="h-6 w-32 bg-neutral-100 dark:bg-neutral-800 rounded-lg" />
                </div>
                <div className="h-8 w-3/4 bg-neutral-200 dark:bg-neutral-700 rounded-xl" />
                <div className="space-y-2 pt-1">
                    <div className="h-4 w-full bg-neutral-100 dark:bg-neutral-800 rounded-lg" />
                    <div className="h-4 w-5/6 bg-neutral-100 dark:bg-neutral-800 rounded-lg" />
                </div>
                {/* Meta details bar */}
                <div className="pt-3 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap gap-4">
                    <div className="h-5 w-28 bg-neutral-100 dark:bg-neutral-800 rounded-md" />
                    <div className="h-5 w-32 bg-neutral-100 dark:bg-neutral-800 rounded-md" />
                    <div className="h-5 w-24 bg-neutral-100 dark:bg-neutral-800 rounded-md" />
                </div>
            </div>

            {/* Student Identity Card skeleton */}
            <div className="rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 p-4 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                    <div className="h-4 w-36 bg-neutral-200 dark:bg-neutral-700 rounded-md" />
                    <div className="h-5 w-20 bg-neutral-100 dark:bg-neutral-800 rounded-full" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl" />
                    <div className="h-12 bg-neutral-100 dark:bg-neutral-800 rounded-xl" />
                </div>
            </div>

            {/* Question cards skeleton */}
            {[1, 2].map((i) => (
                <div
                    key={i}
                    className="rounded-2xl bg-white dark:bg-[#0A0A0A] border border-neutral-200 dark:border-neutral-800 p-6 space-y-4 shadow-sm"
                >
                    <div className="h-5 w-2/3 bg-neutral-200 dark:bg-neutral-700 rounded-lg" />
                    <div className="h-3 w-1/2 bg-neutral-100 dark:bg-neutral-800 rounded-md" />
                    <div className="h-11 w-full bg-neutral-100 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-800" />
                </div>
            ))}
        </div>
    );
}

export default function PublicEventRegistrationPage() {
    const { eventId } = useParams<{ eventId: string }>();
    const navigate = useNavigate();
    const { user } = useAppSelector((state) => state.user);

    const [loading, setLoading] = useState(true);
    const [data, setData] = useState<PublicFormResponse | null>(null);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);

    useEffect(() => {
        if (!eventId) return;
        setLoading(true);
        fetchPublicEventForm(eventId)
            .then((res) => {
                setData(res);
            })
            .catch((err) => {
                setErrorMsg(err.message || "Failed to load registration form.");
            })
            .finally(() => {
                setLoading(false);
            });
    }, [eventId]);

    return (
        <div className="min-h-screen bg-neutral-50 dark:bg-black text-neutral-900 dark:text-neutral-100 flex flex-col justify-between">
            {/* Top Bar */}
            <div className="border-b border-neutral-200 dark:border-neutral-800 bg-white/80 dark:bg-[#0A0A0A]/80 backdrop-blur-md sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="p-1.5 rounded-lg border border-neutral-200 dark:border-neutral-800 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer text-xs font-semibold flex items-center gap-1.5 text-neutral-700 dark:text-neutral-300 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                    <Link to="/" className="font-semibold text-sm sm:text-base tracking-tight hover:opacity-80">
                        ORBIX EVENTS
                    </Link>
                </div>

                {data?.club && (
                    <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400 truncate max-w-xs">
                        {data.club.name}
                    </span>
                )}
            </div>

            {/* Main Content */}
            <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8">
                {loading ? (
                    <FormRendererSkeleton />
                ) : errorMsg ? (
                    <div className="py-20 text-center space-y-4 max-w-md mx-auto">
                        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
                        <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Form Not Available</h3>
                        <p className="text-xs text-neutral-500 dark:text-neutral-400">{errorMsg}</p>
                        <Link
                            to="/events"
                            className="inline-block px-5 py-2.5 rounded-xl bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-950 font-medium text-xs shadow-sm hover:opacity-90 transition-opacity"
                        >
                            Explore Other Events
                        </Link>
                    </div>
                ) : data?.form ? (
                    <Suspense fallback={<FormRendererSkeleton />}>
                        <StudentFormRenderer
                            form={data.form}
                            event={data.event}
                            club={data.club}
                            user={user}
                            studentProfile={data.studentProfile}
                            userResponse={data.userResponse}
                            draftResponse={data.draftResponse}
                            isClosed={data.isClosed}
                            closedReason={data.closedReason}
                            onSuccess={() => {}}
                            onCancel={() => navigate("/events")}
                        />
                    </Suspense>
                ) : null}
            </main>

            {/* Footer Illustration */}
            <SectionBottomIllustration />
        </div>
    );
}
