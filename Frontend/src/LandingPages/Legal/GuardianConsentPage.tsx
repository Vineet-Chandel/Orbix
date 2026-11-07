import React, { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import {
  ShieldAlert,
  Calendar,
  MapPin,
  User,
  CheckCircle2,
  XCircle,
  ArrowLeft
} from "lucide-react";
import { OrbixLoader, OrbixButton } from "../../components/ui/loader";
import { useToast } from "../../context/ToastContext";

interface ConsentDetails {
  id: string;
  eventId: string;
  applicantName: string;
  applicantEmail: string;
  isAttendeeUnder18: boolean;
  guardianName: string | null;
  guardianEmail: string | null;
  guardianPhone: string | null;
  guardianRelationship: string | null;
  guardianConsentStatus: "not_required" | "pending_verification" | "verified" | "rejected" | "withdrawn";
  expiresAt: string | null;
  verifiedAt: string | null;
  eventTitle: string;
  eventDescription: string | null;
  startsAt: string;
  venue: string | null;
  clubName: string;
  collegeName: string;
}

export const GuardianConsentPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const registrationId = searchParams.get("registrationId") || "";
  const toast = useToast();

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [details, setDetails] = useState<ConsentDetails | null>(null);

  // Form inputs
  const [guardianName, setGuardianName] = useState("");
  const [relationship, setRelationship] = useState("Parent / Guardian");
  const [isConfirmed, setIsConfirmed] = useState(false);
  const [decisionCompleted, setDecisionCompleted] = useState<"granted" | "rejected" | null>(null);

  useEffect(() => {
    const fetchConsentDetails = async () => {
      if (!token || !registrationId) {
        setErrorMsg("Missing required consent token or registration reference in the link.");
        setIsLoading(false);
        return;
      }

      try {
        setIsLoading(true);
        const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000";
        const res = await fetch(
          `${apiBase}/api/club/events/guardian-consent/verify?token=${encodeURIComponent(token)}&registrationId=${encodeURIComponent(registrationId)}`
        );
        const data = await res.json();

        if (!res.ok || !data.success) {
          setErrorMsg(data.message || "Failed to verify guardian consent link.");
          return;
        }

        setDetails(data.details);
        setGuardianName(data.details.guardianName || "");
        setRelationship(data.details.guardianRelationship || "Parent / Guardian");

        if (data.details.guardianConsentStatus === "verified") {
          setDecisionCompleted("granted");
        } else if (data.details.guardianConsentStatus === "rejected") {
          setDecisionCompleted("rejected");
        }
      } catch (err: any) {
        setErrorMsg(err.message || "Unable to reach verification service. Please try again.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchConsentDetails();
  }, [token, registrationId]);

  const handleDecision = async (action: "grant" | "reject") => {
    if (action === "grant" && !isConfirmed) {
      toast.error("Please check the declaration box confirming you are the parent or legal guardian.");
      return;
    }

    try {
      setIsSubmitting(true);
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3000";
      const res = await fetch(`${apiBase}/api/club/events/guardian-consent/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          registrationId,
          action,
          guardianName: guardianName.trim() || undefined,
          relationshipConfirm: relationship.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        toast.error(data.message || "Failed to record consent decision.");
        return;
      }

      setDecisionCompleted(action === "grant" ? "granted" : "rejected");
      toast.success(data.message);
    } catch (err: any) {
      toast.error(err.message || "Network error submitting consent.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#FAF6EE] flex items-center justify-center p-4">
        <div className="text-center space-y-4">
          <OrbixLoader size="lg" />
          <p className="font-mono text-xs uppercase tracking-wider font-bold text-zinc-600">
            Validating Guardian Consent Proof...
          </p>
        </div>
      </div>
    );
  }

  if (errorMsg || !details) {
    return (
      <div className="min-h-screen bg-[#FAF6EE] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border-2 border-black rounded-lg p-6 sm:p-8 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-[#FF6B6B]/20 border-2 border-black flex items-center justify-center mx-auto text-[#FF6B6B]">
            <ShieldAlert className="w-6 h-6 text-black" />
          </div>
          <h1 className="text-xl font-black uppercase text-black">Verification Unavailable</h1>
          <p className="text-sm text-zinc-600 font-medium">
            {errorMsg || "The verification token has expired or is invalid. Please request a new verification link from the student attendee."}
          </p>
          <div className="pt-2">
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 bg-black text-white text-xs font-black uppercase tracking-wider rounded border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:bg-zinc-800"
            >
              <ArrowLeft className="w-4 h-4" />
              Return to Orbix
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FAF6EE] text-black font-sans antialiased p-4 sm:p-6 lg:p-10 flex items-center justify-center">
      <div className="max-w-2xl w-full bg-white border-3 border-black rounded-xl p-6 sm:p-10 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] space-y-8">
        
        {/* Header Bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b-2 border-black">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-xs uppercase font-black tracking-widest text-zinc-500">ORBIX PLATFORM</span>
              <span className="text-zinc-300">•</span>
              <span className="text-xs font-bold text-zinc-500">MINOR PROTECTION</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-black">
              Parental / Guardian Consent
            </h1>
          </div>
          <span className="px-3 py-1 bg-[#FFE566] border-2 border-black rounded-full font-mono text-xs font-bold shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]">
            Collegiate Event
          </span>
        </div>

        {/* Existing Decision Alert if already granted/rejected */}
        {decisionCompleted === "granted" && (
          <div className="p-5 bg-[#a2ff86]/30 border-2 border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-black shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-sm uppercase text-black">Consent Confirmed & Recorded</p>
              <p className="text-xs text-zinc-700 font-medium mt-1">
                Verifiable parental/guardian consent has been recorded. <strong>{details.applicantName}</strong>'s application is now cleared for event coordinator review.
              </p>
            </div>
          </div>
        )}

        {decisionCompleted === "rejected" && (
          <div className="p-5 bg-[#FF6B6B]/20 border-2 border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] flex items-start gap-3">
            <XCircle className="w-6 h-6 text-black shrink-0 mt-0.5" />
            <div>
              <p className="font-black text-sm uppercase text-black">Participation Declined</p>
              <p className="text-xs text-zinc-700 font-medium mt-1">
                Parental consent was declined. The student's event registration for <strong>{details.eventTitle}</strong> has been cancelled.
              </p>
            </div>
          </div>
        )}

        {/* Event & Attendee Overview Card */}
        <div className="bg-[#FAF6EE] border-2 border-black rounded-lg p-5 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b-2 border-black/10">
            <User className="w-4 h-4 text-black" />
            <h2 className="font-black text-xs uppercase tracking-wider text-black">Student & Event Overview</h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-medium">
            <div>
              <span className="text-zinc-500 font-bold block uppercase text-[10px]">Student Attendee (Under 18):</span>
              <span className="font-black text-sm text-black">{details.applicantName}</span>
              <span className="text-zinc-500 block text-[11px] font-mono">{details.applicantEmail}</span>
            </div>

            <div>
              <span className="text-zinc-500 font-bold block uppercase text-[10px]">Collegiate Event:</span>
              <span className="font-black text-sm text-black">{details.eventTitle}</span>
              <span className="text-zinc-600 block">{details.clubName} • {details.collegeName}</span>
            </div>

            {details.startsAt && (
              <div className="flex items-center gap-1.5 text-zinc-700">
                <Calendar className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span>Starts: {new Date(details.startsAt).toLocaleDateString()}</span>
              </div>
            )}

            {details.venue && (
              <div className="flex items-center gap-1.5 text-zinc-700">
                <MapPin className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <span>Venue: {details.venue}</span>
              </div>
            )}
          </div>
        </div>

        {/* Legal Consent Form (only if decision not yet completed) */}
        {!decisionCompleted && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleDecision("grant");
            }}
            className="space-y-6"
          >
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-black uppercase text-black mb-1">
                  Parent / Legal Guardian Full Name
                </label>
                <input
                  type="text"
                  required
                  value={guardianName}
                  onChange={(e) => setGuardianName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full px-3 py-2 bg-white border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#a2ff86]"
                />
              </div>

              <div>
                <label className="block text-xs font-black uppercase text-black mb-1">
                  Relationship to Attendee
                </label>
                <select
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  className="w-full px-3 py-2 bg-white border-2 border-black rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#a2ff86]"
                >
                  <option value="Mother">Mother</option>
                  <option value="Father">Father</option>
                  <option value="Legal Guardian">Legal Guardian</option>
                  <option value="Parent">Parent</option>
                </select>
              </div>

              {/* Declarative Checkbox */}
              <div className="pt-2">
                <label className="flex items-start gap-3 p-3 bg-zinc-50 border-2 border-black rounded cursor-pointer hover:bg-zinc-100 transition-colors">
                  <input
                    type="checkbox"
                    checked={isConfirmed}
                    onChange={(e) => setIsConfirmed(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded border-2 border-black text-black accent-black focus:ring-0 cursor-pointer"
                  />
                  <span className="text-xs text-zinc-700 leading-relaxed font-medium">
                    I confirm that I am the parent or legally appointed guardian of <strong>{details.applicantName}</strong>. I have reviewed the event information and electronically consent to their registration, event attendance, and necessary collegiate data processing in accordance with the{" "}
                    <Link to="/privacy" target="_blank" className="font-black text-black underline">
                      Orbix Privacy Policy
                    </Link>{" "}
                    and{" "}
                    <Link to="/terms" target="_blank" className="font-black text-black underline">
                      Terms & Conditions
                    </Link>.
                  </span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-4 flex flex-col sm:flex-row items-center gap-3">
              <OrbixButton
                type="submit"
                loading={isSubmitting}
                disabled={isSubmitting || !isConfirmed}
                variant="primary"
                className="w-full sm:w-auto px-6 py-2.5 bg-[#a2ff86] text-black font-black uppercase text-xs tracking-wider border-2 border-black rounded shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-[#86ef6c]"
              >
                Confirm & Grant Consent
              </OrbixButton>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  if (window.confirm("Are you sure you wish to decline consent? This will cancel the student's registration for this event.")) {
                    handleDecision("reject");
                  }
                }}
                className="w-full sm:w-auto px-5 py-2.5 bg-white text-[#FF6B6B] font-black uppercase text-xs tracking-wider border-2 border-black rounded shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] hover:bg-red-50 transition-colors"
              >
                Decline Participation
              </button>
            </div>
          </form>
        )}

        {/* Footer notice */}
        <div className="pt-4 border-t-2 border-black/10 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
          <span>Orbix Minor Protection Framework</span>
          <Link to="/" className="text-black font-bold hover:underline">
            orbix.dev
          </Link>
        </div>

      </div>
    </div>
  );
};

export default GuardianConsentPage;
