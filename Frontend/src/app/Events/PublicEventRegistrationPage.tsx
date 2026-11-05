import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, AlertCircle } from "lucide-react";
import {
    fetchPublicEventForm,
    type PublicFormResponse,
} from "../../api/clubEventFormApi";
import { StudentFormRenderer } from "../Club/FormBuilder/StudentFormRenderer";
import { OrbixLoader } from "../../components/ui/loader";
import { useAppSelector } from "../../store";
import { SectionBottomIllustration } from "../common/SectionBottomIllustration";

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
        <div className="min-h-screen bg-[#FAF6EE] text-black flex flex-col justify-between">
            {/* Top Bar */}
            <div className="border-b-2 border-black/10 bg-white/70 backdrop-blur-sm sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={() => navigate(-1)}
                        className="p-1.5 rounded-xl border border-black hover:bg-neutral-100 cursor-pointer text-xs font-black flex items-center gap-1"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="hidden sm:inline">Back</span>
                    </button>
                    <Link to="/" className="font-black text-sm sm:text-base tracking-tight hover:underline">
                        ORBIX EVENTS
                    </Link>
                </div>

                {data?.club && (
                    <span className="text-xs font-black text-neutral-600 truncate max-w-xs">
                        {data.club.name}
                    </span>
                )}
            </div>

            {/* Main Content */}
            <main className="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 lg:p-8">
                {loading ? (
                    <div className="py-24 flex flex-col items-center justify-center space-y-3">
                        <OrbixLoader size="lg" />
                        <span className="text-xs font-black text-neutral-600">
                            Loading event registration form...
                        </span>
                    </div>
                ) : errorMsg ? (
                    <div className="py-20 text-center space-y-4 max-w-md mx-auto">
                        <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
                        <h3 className="text-lg font-black text-black">Form Not Available</h3>
                        <p className="text-xs text-neutral-600 font-medium">{errorMsg}</p>
                        <Link
                            to="/events"
                            className="inline-block px-5 py-2 rounded-xl bg-black text-white font-black text-xs shadow-[2px_2px_0px_#000]"
                        >
                            Explore Other Events
                        </Link>
                    </div>
                ) : data?.form ? (
                    <StudentFormRenderer
                        form={data.form}
                        event={data.event}
                        club={data.club}
                        user={user}
                        studentProfile={data.studentProfile}
                        userResponse={data.userResponse}
                        isClosed={data.isClosed}
                        closedReason={data.closedReason}
                        onSuccess={() => {}}
                        onCancel={() => navigate("/events")}
                    />
                ) : null}
            </main>

            {/* Footer Illustration */}
            <SectionBottomIllustration />
        </div>
    );
}
