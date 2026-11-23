import React, { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { GraduationCap, ArrowRight, Building, ShieldCheck } from "lucide-react";
import { AuthLayout } from "../AuthLayout";
import { CollegeAutocomplete } from "../../../components/CollegeAutocomplete";
import { updateProfile, type InstitutionItem } from "../../../utils/profileApi";
import { useToast } from "../../../context/ToastContext";
import { useAppDispatch, useAppSelector, updateUserProfile, fetchUserProfile } from "../../../store";
import { OrbixLoader } from "../../../components/ui/loader";

export default function CollegeOnboardingPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const toast = useToast();
    const dispatch = useAppDispatch();
    const { user, isAuthenticated, loading: userLoading } = useAppSelector((state) => state.user);

    const [selectedCollege, setSelectedCollege] = useState<InstitutionItem | null>(null);
    const [saving, setSaving] = useState(false);

    const rawReturnTo = searchParams.get("redirect") || searchParams.get("returnTo");
    const redirectTarget = (rawReturnTo && rawReturnTo !== "/dashboard") ? rawReturnTo : "/onboarding";

    // Pre-populate if user already has an affiliated college
    useEffect(() => {
        if (user?.collegeId && !selectedCollege) {
            const officialName = typeof user.college === "object" && user.college?.officialName
                ? user.college.officialName
                : (typeof user.college === "string" ? user.college : "Affiliated Institution");
            setSelectedCollege({
                id: user.collegeId,
                officialName,
            });
        }
    }, [user, selectedCollege]);

    // Check if user is authenticated
    useEffect(() => {
        const token = localStorage.getItem("orbix_token");
        if (!userLoading && !isAuthenticated && !token) {
            navigate(`/auth/signin?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`, { replace: true });
        }
    }, [userLoading, isAuthenticated, navigate]);

    const handleSaveAndContinue = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedCollege?.id) {
            toast.error("Please search and select your college/university from the verified directory.", {
                title: "College Required",
            });
            return;
        }

        setSaving(true);
        try {
            await updateProfile({ collegeId: selectedCollege.id });
            dispatch(updateUserProfile({
                collegeId: selectedCollege.id,
                college: selectedCollege,
            }));
            // Also refresh in background to ensure all calculated fields (campus rank, lock dates) are synced
            dispatch(fetchUserProfile({ force: true })).catch(() => {});

            toast.success(`Successfully affiliated with ${selectedCollege.officialName}!`, {
                title: "Campus Linked",
            });

            navigate(redirectTarget, { replace: true });
        } catch (err: any) {
            console.error("Failed to save college affiliation:", err);
            toast.error(err?.message || "Failed to save college selection. Please try again.", {
                title: "Update Failed",
            });
        } finally {
            setSaving(false);
        }
    };

    const handleSkip = () => {
        toast.info("You can link or change your college anytime from your Profile settings.", {
            title: "Affiliation Skipped",
        });
        navigate(redirectTarget, { replace: true });
    };

    return (
        <AuthLayout
            title="Link Your College"
            subtitle="Connect your campus to unlock university leaderboards, official campus chapters, and student hackathons."
            trigger={false}
            switchText="Prefer to do this later?"
            switchLinkText="Skip to developer profiles"
            switchLinkHref={redirectTarget}
            showSocialAuth={false}
        >
            <form onSubmit={handleSaveAndContinue} className="space-y-4">
                {/* Step Indicator Badge */}
                <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#FFE566] border-2 border-black text-[11px] font-black uppercase tracking-wider text-black shadow-[1.5px_1.5px_0px_#000]">
                        <Building className="w-3.5 h-3.5" />
                        Campus Setup
                    </span>
                    <span className="text-xs font-bold text-neutral-500">
                        Fast 1-minute onboarding
                    </span>
                </div>

                {/* College / University Autocomplete Input */}
                <div className="space-y-1.5">
                    <label className="block text-xs font-black uppercase tracking-wider text-black">
                        College / University (Verified Directory)
                    </label>
                    <CollegeAutocomplete
                        value={selectedCollege?.id || null}
                        selectedCollege={selectedCollege}
                        onChange={(college) => setSelectedCollege(college)}
                        disabled={saving}
                        showChangeWarningModal={false}
                    />

                    {/* Selected Institution Card */}
                    {selectedCollege?.id && (
                        <div className="mt-3 p-3.5 rounded-xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2 animate-in fade-in duration-200">
                            <div className="flex items-center gap-2 min-w-0">
                                <div className="w-7 h-7 rounded-lg bg-[#FFE566] border border-black flex items-center justify-center shrink-0 shadow-[1px_1px_0px_#000]">
                                    <GraduationCap className="w-4 h-4 text-black stroke-[2.5]" />
                                </div>
                                <div className="min-w-0">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-600 block">
                                        Selected Institution
                                    </span>
                                    <h4 className="text-xs font-black text-black truncate">
                                        {selectedCollege.officialName}
                                    </h4>
                                </div>
                            </div>
                            <div className="flex items-start gap-1.5 text-[11px] text-neutral-600 font-semibold leading-relaxed">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5 stroke-[2.5]" />
                                <span>
                                    Your Orbix profile will be verified under {selectedCollege.officialName}. You can compete in campus-wide leaderboards and join student clubs.
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Submit and Action Buttons */}
                <div className="space-y-2.5 pt-2">
                    <button
                        type="submit"
                        disabled={saving}
                        className="w-full bg-black text-white hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed font-black rounded-xl py-3 px-4 flex items-center justify-center gap-2 border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none transition-all text-sm cursor-pointer"
                    >
                        {saving ? (
                            <>
                                <OrbixLoader size="sm" variant="inline" />
                                <span>Saving Campus Affiliation...</span>
                            </>
                        ) : (
                            <>
                                <span>Save & Continue</span>
                                <ArrowRight className="w-4 h-4 stroke-[3]" />
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        onClick={handleSkip}
                        disabled={saving}
                        className="w-full bg-transparent hover:bg-black/5 text-neutral-600 hover:text-black font-bold text-xs py-2 px-3 rounded-lg text-center transition-colors cursor-pointer"
                    >
                        Skip for now & continue →
                    </button>
                </div>
            </form>
        </AuthLayout>
    );
}
