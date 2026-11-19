import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
    X,
    Clock,
    MapPin,
    Ticket,
    ShieldAlert,
    Users,
    Crown,
    KeyRound,
    Info,
} from "lucide-react";
import { OrbixButton } from "../../components/ui/loader";
import { NeoSelect } from "../../components/NeoSelect";
import { NeoCheckbox } from "../../components/NeoCheckbox";
import { useToast } from "../../context/ToastContext";
import { applyForEvent, type CollegeEventItem } from "../../api/collegeEventsApi";
import { clubEventTeamApi } from "../../api/clubEventTeamApi";
import { useAppSelector } from "../../store";

export interface EventRegistrationModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: CollegeEventItem | null;
    onSuccess: (updatedEvent: CollegeEventItem) => void;
}

export const EventRegistrationModal: React.FC<EventRegistrationModalProps> = ({
    isOpen,
    onClose,
    event,
    onSuccess,
}) => {
    const toast = useToast();
    const { user } = useAppSelector((state) => state.user);

    const [applicantName, setApplicantName] = useState("");
    const [applicantEmail, setApplicantEmail] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isAttendeeUnder18, setIsAttendeeUnder18] = useState(false);
    const [guardianName, setGuardianName] = useState("");
    const [guardianEmail, setGuardianEmail] = useState("");
    const [guardianPhone, setGuardianPhone] = useState("");
    const [guardianRelationship, setGuardianRelationship] = useState("Parent");

    // Team states for team registration events
    const [teamAction, setTeamAction] = useState<"create" | "join">("create");
    const [teamName, setTeamName] = useState("");
    const [teamCode, setTeamCode] = useState("");

    // Submission Status
    const [submittedSuccess, setSubmittedSuccess] = useState(false);

    useEffect(() => {
        if (isOpen && event) {
            const defaultName = user?.firstName
                ? `${user.firstName} ${user.lastName || ""}`.trim()
                : user?.username || "";
            setApplicantName(defaultName);
            setApplicantEmail(user?.gmail || (user as any)?.email || "");
            setPhoneNumber("");
            setNotes("");
            setIsAttendeeUnder18(false);
            setGuardianName("");
            setGuardianEmail("");
            setGuardianPhone("");
            setGuardianRelationship("Parent");
            setTeamAction("create");
            setTeamName("");
            setTeamCode("");
            setSubmittedSuccess(false);
        }
    }, [isOpen, event, user]);

    if (!isOpen || !event || typeof document === "undefined") return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!applicantName.trim()) {
            toast.error("Please enter your full name.");
            return;
        }
        if (!applicantEmail.trim()) {
            toast.error("Please enter your email address.");
            return;
        }

        if (event.isTeamEvent) {
            if (teamAction === "create") {
                if (!teamName.trim() || teamName.trim().length < 2) {
                    toast.error("Please enter a team name (at least 2 characters).");
                    return;
                }
            } else {
                if (!teamCode.trim() || teamCode.trim().length < 4) {
                    toast.error("Please enter the team join code provided by your leader.");
                    return;
                }
            }
        }

        try {
            setIsSubmitting(true);
            if (isAttendeeUnder18) {
                if (!guardianName.trim() || guardianName.trim().length < 2) {
                    toast.error("Please provide your parent or legal guardian's full name.");
                    return;
                }
                if (!guardianEmail.trim() || !guardianEmail.includes("@")) {
                    toast.error("Please provide a valid email address for your parent or legal guardian.");
                    return;
                }
                if (guardianEmail.trim().toLowerCase() === applicantEmail.trim().toLowerCase()) {
                    toast.error("Guardian email address must be different from your personal email address.");
                    return;
                }
                if (!guardianPhone.trim() || guardianPhone.trim().length < 7) {
                    toast.error("Please provide your parent or legal guardian's phone number.");
                    return;
                }
            }

            await applyForEvent(event.id, {
                applicantName: applicantName.trim(),
                applicantEmail: applicantEmail.trim(),
                phoneNumber: phoneNumber.trim() || undefined,
                notes: notes.trim() || undefined,
                isAttendeeUnder18,
                guardianName: isAttendeeUnder18 ? guardianName.trim() : undefined,
                guardianEmail: isAttendeeUnder18 ? guardianEmail.trim().toLowerCase() : undefined,
                guardianPhone: isAttendeeUnder18 ? guardianPhone.trim() : undefined,
                guardianRelationship: isAttendeeUnder18 ? guardianRelationship.trim() : undefined,
            });

            // Process team creation or joining if this is a team event
            let teamCreatedOrJoined: any = null;
            if (event.isTeamEvent) {
                if (teamAction === "create") {
                    const teamRes = await clubEventTeamApi.createTeam(event.id, teamName.trim());
                    teamCreatedOrJoined = teamRes.team;
                } else {
                    const teamRes = await clubEventTeamApi.joinTeamByCode(event.id, teamCode.trim().toUpperCase());
                    teamCreatedOrJoined = teamRes.team;
                }
            }

            setSubmittedSuccess(true);
            toast.success(
                event.isTeamEvent && teamCreatedOrJoined
                    ? `Registered in team "${teamCreatedOrJoined.name}" for ${event.title}!`
                    : `Application submitted for ${event.title}!`,
                { title: "Registration Received" }
            );

            onSuccess({
                ...event,
                isRegistered: false,
                isPending: true,
                registrationStatus: "pending",
                ticketCode: null,
                totalApplicationsCount: (event.totalApplicationsCount || 0) + 1,
                teamId: teamCreatedOrJoined?.id || null,
                teamRole: teamAction === "create" ? "leader" : "member",
            });
        } catch (err: any) {
            toast.error(err.message || "Failed to submit application for this event.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const userCollegeId = user?.collegeId || user?.college?.id;
    const userCollegeName = user?.college?.officialName || (typeof user?.college === "string" ? user.college : "");

    const isDifferentCollege =
        event &&
        Boolean(
            (event.collegeId && userCollegeId && String(event.collegeId).trim().toLowerCase() !== String(userCollegeId).trim().toLowerCase()) ||
            (event.collegeName && userCollegeName && event.collegeName.trim().toLowerCase() !== userCollegeName.trim().toLowerCase())
        );

    return createPortal(
        <div
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[110] bg-black/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg bg-[#FAF6EE] rounded-3xl border-2 border-black shadow-[8px_8px_0px_#000] overflow-hidden flex flex-col my-6 animate-in fade-in zoom-in-95 duration-150"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 sm:p-5 bg-white border-b-2 border-black flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000]">
                            <Ticket className="w-4 h-4 text-black" />
                        </div>
                        <div>
                            <h3 className="text-base font-black text-black">
                                {submittedSuccess ? "Your Event Registration Application" : "Register for Campus Event"}
                            </h3>
                            <p className="text-[11px] font-bold text-neutral-500">
                                Organized by {event.clubName}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-xl border-2 border-black bg-[#FAF6EE] hover:bg-neutral-100 cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {/* Event Summary Ribbon */}
                <div className="p-4 bg-white/70 border-b-2 border-black/10 flex items-start gap-3">
                    {event.coverImageUrl ? (
                        <div className="w-16 h-16 rounded-xl border-2 border-black overflow-hidden shrink-0 bg-neutral-100 shadow-[1.5px_1.5px_0px_#000]">
                            <img src={event.coverImageUrl} alt={event.title} className="w-full h-full object-cover" />
                        </div>
                    ) : (
                        <div className="w-14 h-14 rounded-xl border-2 border-black bg-[#a2ff86] flex items-center justify-center shrink-0 font-black text-base shadow-[1.5px_1.5px_0px_#000]">
                            {event.clubName.slice(0, 2).toUpperCase()}
                        </div>
                    )}
                    <div className="min-w-0 flex-1">
                        <h4 className="text-sm font-black text-black truncate">{event.title}</h4>
                        <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] font-bold text-neutral-600">
                            <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3 text-neutral-500" />
                                {new Date(event.startsAt).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                })}
                            </span>
                            <span className="flex items-center gap-1">
                                <MapPin className="w-3 h-3 text-neutral-500" />
                                {event.venueOrLocation || (event.locationType === "virtual" ? "Virtual" : "Campus")}
                            </span>
                        </div>
                    </div>
                </div>

                {submittedSuccess ? (
                    /* Application Forwarded to Club View */
                    <div className="p-6 space-y-5 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-[#FFE566] border-2 border-black flex items-center justify-center mx-auto shadow-[3px_3px_0px_#000]">
                            <Clock className="w-8 h-8 text-black stroke-[2.5]" />
                        </div>

                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-amber-950 bg-amber-100 px-2.5 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_#000]">
                                Application Forwarded · Under Review
                            </span>
                            <h4 className="text-lg font-black text-black pt-1">
                                Application Sent to {event.clubName}!
                            </h4>
                            <p className="text-xs text-neutral-600 font-medium max-w-sm mx-auto leading-relaxed">
                                Your application has been routed to the host club coordinators. Once they verify your details and approve your entry, your session pass will be activated.
                            </p>
                        </div>

                        {/* Application Summary Box */}
                        <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[4px_4px_0px_#000] text-left space-y-3 relative overflow-hidden">
                            <div className="flex items-center justify-between pb-2 border-b-2 border-dashed border-black/20">
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                    Current Status
                                </span>
                                <span className="text-[10px] font-black text-amber-950 bg-[#FFE566] px-2 py-0.5 rounded border border-black/30">
                                    Pending Club Review
                                </span>
                            </div>

                            <div className="space-y-1">
                                <div className="text-sm font-black text-black">
                                    {applicantName}
                                </div>
                                <div className="text-[11px] font-bold text-neutral-600 flex items-center justify-between">
                                    <span>Verified Student</span>
                                    <span>{applicantEmail}</span>
                                </div>
                            </div>

                            <div className="pt-2 border-t border-black/10 flex items-center justify-between text-[11px] font-bold text-neutral-600">
                                <span>{event.collegeName}</span>
                                <span>{event.clubName}</span>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full py-2.5 rounded-xl bg-black text-[#FFE566] hover:bg-neutral-900 border-2 border-black text-xs font-black shadow-[3px_3px_0px_#000] cursor-pointer"
                            >
                                Done & Return to Events
                            </button>
                        </div>
                    </div>
                ) : isDifferentCollege ? (
                    /* Campus Restriction View */
                    <div className="p-6 space-y-4 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-rose-200 border-2 border-black flex items-center justify-center mx-auto shadow-[3px_3px_0px_#000]">
                            <ShieldAlert className="w-8 h-8 text-rose-700 stroke-[2.5]" />
                        </div>

                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-rose-800 bg-rose-100 px-2.5 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_#000]">
                                Host Campus Exclusive
                            </span>
                            <h4 className="text-lg font-black text-black pt-1">
                                You Can't Register for this College Event
                            </h4>
                            <p className="text-xs text-neutral-600 font-medium max-w-sm mx-auto leading-relaxed">
                                This event is strictly organized for students enrolled at <strong className="text-black">{event.collegeName}</strong>. Because you are affiliated with <strong className="text-black">{userCollegeName || "a different institution"}</strong>, you are not eligible to register.
                            </p>
                        </div>

                        <div className="pt-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="w-full py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] cursor-pointer"
                            >
                                Close & Explore My Events
                            </button>
                        </div>
                    </div>
                ) : (
                    /* Registration Form */
                    <form onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4 overflow-y-auto max-h-[65vh]">
                        {event.isTeamEvent && (
                            <div className="p-4 rounded-2xl bg-[#FAF6EE] border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                                <div className="flex items-center justify-between pb-2 border-b border-black/10">
                                    <div className="flex items-center gap-2">
                                        <Users className="w-4 h-4 text-black" />
                                        <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                            Team Registration ({event.minTeamSize || 1} to {event.maxTeamSize || 4} Members)
                                        </h4>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#a2ff86] border border-black shadow-[1px_1px_0px_#000] text-black">
                                        Required
                                    </span>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setTeamAction("create")}
                                        className={`p-2.5 rounded-xl border-2 text-left cursor-pointer transition-all flex flex-col gap-0.5 ${
                                            teamAction === "create"
                                                ? "bg-[#a2ff86] border-black shadow-[2px_2px_0px_#000]"
                                                : "bg-white border-black/30 hover:border-black text-neutral-600"
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <Crown className="w-3.5 h-3.5 text-black" />
                                            <span className="text-xs font-black text-black">Create a Team</span>
                                        </div>
                                        <span className="text-[10px] text-neutral-600 font-medium">
                                            Become the Team Leader
                                        </span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setTeamAction("join")}
                                        className={`p-2.5 rounded-xl border-2 text-left cursor-pointer transition-all flex flex-col gap-0.5 ${
                                            teamAction === "join"
                                                ? "bg-[#a2ff86] border-black shadow-[2px_2px_0px_#000]"
                                                : "bg-white border-black/30 hover:border-black text-neutral-600"
                                        }`}
                                    >
                                        <div className="flex items-center gap-1.5">
                                            <KeyRound className="w-3.5 h-3.5 text-black" />
                                            <span className="text-xs font-black text-black">Join with Code</span>
                                        </div>
                                        <span className="text-[10px] text-neutral-600 font-medium">
                                            Enter 6-char team code
                                        </span>
                                    </button>
                                </div>

                                {teamAction === "create" ? (
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                            Team Name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={teamName}
                                            onChange={(e) => setTeamName(e.target.value)}
                                            placeholder="e.g. Code Ninjas, Cloud Titans..."
                                            maxLength={60}
                                            className="w-full px-3 py-2 rounded-xl bg-white border-2 border-black text-xs font-bold text-black focus:outline-hidden shadow-[1px_1px_0px_#000]"
                                        />
                                        <p className="text-[10px] text-neutral-600 font-medium mt-1 flex items-center gap-1">
                                            <Info className="w-3 h-3 text-neutral-500 shrink-0" />
                                            <span>As Team Leader, you can invite members via <span className="font-mono font-bold">@username</span> or share your join code.</span>
                                        </p>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                            Team Join Code *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={teamCode}
                                            onChange={(e) => setTeamCode(e.target.value.toUpperCase())}
                                            placeholder="e.g. X9K2B4"
                                            maxLength={10}
                                            className="w-full px-3 py-2 rounded-xl bg-white border-2 border-black text-xs font-mono font-black text-black uppercase tracking-wider focus:outline-hidden shadow-[1px_1px_0px_#000]"
                                        />
                                        <p className="text-[10px] text-neutral-600 font-medium mt-1 flex items-center gap-1">
                                            <Info className="w-3 h-3 text-neutral-500 shrink-0" />
                                            <span>Enter the 6-character code provided by your team leader.</span>
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                    Full Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={applicantName}
                                    onChange={(e) => setApplicantName(e.target.value)}
                                    placeholder="e.g. Rahul Sharma"
                                    className="w-full px-3 py-2 rounded-xl bg-white border-2 border-black text-xs font-bold text-black focus:outline-hidden shadow-[1px_1px_0px_#000]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                    College Email *
                                </label>
                                <input
                                    type="email"
                                    required
                                    value={applicantEmail}
                                    onChange={(e) => setApplicantEmail(e.target.value)}
                                    placeholder="student@college.edu"
                                    className="w-full px-3 py-2 rounded-xl bg-white border-2 border-black text-xs font-bold text-black focus:outline-hidden shadow-[1px_1px_0px_#000]"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                Phone Number (Optional)
                            </label>
                            <input
                                type="tel"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="+91 98765 43210"
                                className="w-full px-3 py-2 rounded-xl bg-white border-2 border-black text-xs font-bold text-black focus:outline-hidden shadow-[1px_1px_0px_#000]"
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                Note or Questions for Club Organizers
                            </label>
                            <textarea
                                rows={2}
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Any specific topics you want covered or questions for the speakers..."
                                className="w-full p-2.5 rounded-xl bg-white border-2 border-black text-xs font-medium text-black focus:outline-hidden shadow-[1px_1px_0px_#000]"
                            />
                        </div>

                        {/* Minor Attendee & Guardian Verification Section */}
                        <div className="p-3.5 rounded-2xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] space-y-3">
                            <div className="flex items-start gap-2.5">
                                <NeoCheckbox
                                    checked={isAttendeeUnder18}
                                    onCheckedChange={(checked) => setIsAttendeeUnder18(checked)}
                                    size="sm"
                                    colorScheme="yellow"
                                />
                                <div>
                                    <span
                                        onClick={() => setIsAttendeeUnder18(!isAttendeeUnder18)}
                                        className="text-xs font-black uppercase tracking-wider text-black block cursor-pointer select-none"
                                    >
                                        I am under 18 years of age (e.g. 17-year-old first-year student)
                                    </span>
                                    <span className="text-[11px] text-neutral-600 block leading-tight mt-0.5">
                                        In compliance with minor protection laws, verifiable parental/guardian consent is required before registration can be finalized.
                                    </span>
                                </div>
                            </div>

                            {isAttendeeUnder18 && (
                                <div className="pt-2 border-t-2 border-black/10 space-y-3 animate-in fade-in duration-200">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                                                Parent / Guardian Name *
                                            </label>
                                            <input
                                                type="text"
                                                required={isAttendeeUnder18}
                                                value={guardianName}
                                                onChange={(e) => setGuardianName(e.target.value)}
                                                placeholder="Parent's full name"
                                                className="w-full px-2.5 py-1.5 rounded-lg bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:outline-hidden shadow-[1px_1px_0px_#000]"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                                                Relationship *
                                            </label>
                                            <NeoSelect
                                                value={guardianRelationship}
                                                onChange={(val) => setGuardianRelationship(val)}
                                                size="sm"
                                                options={[
                                                    { value: "Mother", label: "Mother" },
                                                    { value: "Father", label: "Father" },
                                                    { value: "Legal Guardian", label: "Legal Guardian" },
                                                    { value: "Parent", label: "Parent" },
                                                ]}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                                                Guardian Email *
                                            </label>
                                            <input
                                                type="email"
                                                required={isAttendeeUnder18}
                                                value={guardianEmail}
                                                onChange={(e) => setGuardianEmail(e.target.value)}
                                                placeholder="parent@example.com"
                                                className="w-full px-2.5 py-1.5 rounded-lg bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:outline-hidden shadow-[1px_1px_0px_#000]"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-[11px] font-black uppercase tracking-wider text-black mb-1">
                                                Guardian Phone *
                                            </label>
                                            <input
                                                type="tel"
                                                required={isAttendeeUnder18}
                                                value={guardianPhone}
                                                onChange={(e) => setGuardianPhone(e.target.value)}
                                                placeholder="+91 98765 43210"
                                                className="w-full px-2.5 py-1.5 rounded-lg bg-[#FAF6EE] border-2 border-black text-xs font-bold text-black focus:outline-hidden shadow-[1px_1px_0px_#000]"
                                            />
                                        </div>
                                    </div>

                                    <p className="text-[10px] text-zinc-500 font-medium">
                                        An electronic verification link will be emailed to your guardian. Your registration will remain pending until guardian confirmation is received.
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="pt-2 border-t-2 border-black/10 flex items-center justify-end gap-2.5">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 rounded-xl bg-white border-2 border-black text-xs font-black hover:bg-neutral-100 cursor-pointer"
                            >
                                Cancel
                            </button>
                            <OrbixButton
                                type="submit"
                                variant="lime"
                                loading={isSubmitting}
                                loadingLabel="Submitting Application..."
                                className="px-5 py-2 text-xs font-black"
                            >
                                Submit Application
                            </OrbixButton>
                        </div>
                    </form>
                )}
            </div>
        </div>,
        document.body
    );
};

export default EventRegistrationModal;
