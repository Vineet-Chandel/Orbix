import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import {
    X,
    Clock,
    MapPin,
    CheckCircle2,
    Copy,
    Ticket,
    ShieldAlert,
} from "lucide-react";
import { OrbixButton } from "../../components/ui/loader";
import { useToast } from "../../context/ToastContext";
import { applyForEvent, type CollegeEventItem } from "../../api/collegeEventsApi";
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
    const [department, setDepartment] = useState("");
    const [yearOfStudy, setYearOfStudy] = useState("3rd Year");
    const [rollNumber, setRollNumber] = useState("");
    const [phoneNumber, setPhoneNumber] = useState("");
    const [notes, setNotes] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Success State
    const [ticketCode, setTicketCode] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && event) {
            const defaultName = user?.firstName
                ? `${user.firstName} ${user.lastName || ""}`.trim()
                : user?.username || "";
            setApplicantName(defaultName);
            setApplicantEmail(user?.gmail || (user as any)?.email || "");
            setDepartment(user?.college?.city || "");
            setYearOfStudy("3rd Year");
            setRollNumber("");
            setPhoneNumber("");
            setNotes("");
            setTicketCode(event.ticketCode || null);
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

        try {
            setIsSubmitting(true);
            const res = await applyForEvent(event.id, {
                applicantName: applicantName.trim(),
                applicantEmail: applicantEmail.trim(),
                department: department.trim() || undefined,
                yearOfStudy: yearOfStudy || undefined,
                rollNumber: rollNumber.trim() || undefined,
                phoneNumber: phoneNumber.trim() || undefined,
                notes: notes.trim() || undefined,
            });

            const code = res.registration?.ticketCode || "ORB-CONFIRMED";
            setTicketCode(code);
            toast.success(`You are registered for ${event.title}!`, { title: "Registration Confirmed" });

            onSuccess({
                ...event,
                isRegistered: true,
                registrationStatus: "registered",
                ticketCode: code,
                registrationsCount: (event.registrationsCount || 0) + 1,
            });
        } catch (err: any) {
            toast.error(err.message || "Failed to register for this event.");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCopyTicket = () => {
        if (ticketCode) {
            navigator.clipboard.writeText(ticketCode);
            toast.success("Ticket pass code copied to clipboard!");
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
                                {ticketCode ? "Your Event Registration Pass" : "Register for Campus Event"}
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

                {ticketCode ? (
                    /* Ticket Confirmation View */
                    <div className="p-6 space-y-5 text-center">
                        <div className="w-14 h-14 rounded-2xl bg-emerald-300 border-2 border-black flex items-center justify-center mx-auto shadow-[3px_3px_0px_#000]">
                            <CheckCircle2 className="w-8 h-8 text-black stroke-[2.5]" />
                        </div>

                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full border border-black shadow-[1px_1px_0px_#000]">
                                Registration Confirmed
                            </span>
                            <h4 className="text-lg font-black text-black pt-1">
                                You&apos;re officially registered!
                            </h4>
                            <p className="text-xs text-neutral-600 font-medium max-w-sm mx-auto">
                                Show this ticket pass code at the session check-in or keep it for your entry records.
                            </p>
                        </div>

                        {/* Digital Ticket Box */}
                        <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] text-left space-y-3 relative overflow-hidden">
                            <div className="flex items-center justify-between pb-2 border-b-2 border-dashed border-black/20">
                                <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">
                                    Official Ticket Code
                                </span>
                                <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded border border-black/30">
                                    Active Pass
                                </span>
                            </div>

                            <div className="flex items-center justify-between gap-3">
                                <span className="text-lg sm:text-xl font-black font-mono tracking-wider text-black">
                                    {ticketCode}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleCopyTicket}
                                    className="px-3 py-1.5 rounded-xl bg-[#FAF6EE] hover:bg-neutral-100 border-2 border-black text-xs font-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1 cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Copy</span>
                                </button>
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
                                className="w-full py-2.5 rounded-xl bg-black text-[#a2ff86] hover:bg-neutral-900 border-2 border-black text-xs font-black shadow-[3px_3px_0px_#000] cursor-pointer"
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                    Department / Branch
                                </label>
                                <input
                                    type="text"
                                    value={department}
                                    onChange={(e) => setDepartment(e.target.value)}
                                    placeholder="e.g. CSE / IT / ECE"
                                    className="w-full px-3 py-2 rounded-xl bg-white border-2 border-black text-xs font-bold text-black focus:outline-hidden shadow-[1px_1px_0px_#000]"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                    Year of Study
                                </label>
                                <select
                                    value={yearOfStudy}
                                    onChange={(e) => setYearOfStudy(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl bg-white border-2 border-black text-xs font-bold text-black focus:outline-hidden shadow-[1px_1px_0px_#000]"
                                >
                                    <option value="1st Year">1st Year</option>
                                    <option value="2nd Year">2nd Year</option>
                                    <option value="3rd Year">3rd Year</option>
                                    <option value="4th Year / Final">4th Year / Final</option>
                                    <option value="Postgraduate / Masters">Postgraduate / Masters</option>
                                </select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                            <div>
                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                    Roll / Student ID (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={rollNumber}
                                    onChange={(e) => setRollNumber(e.target.value)}
                                    placeholder="e.g. 2110992345"
                                    className="w-full px-3 py-2 rounded-xl bg-white border-2 border-black text-xs font-bold text-black focus:outline-hidden shadow-[1px_1px_0px_#000]"
                                />
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
                                loadingLabel="Registering..."
                                className="px-5 py-2 text-xs font-black"
                            >
                                Confirm Registration
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
