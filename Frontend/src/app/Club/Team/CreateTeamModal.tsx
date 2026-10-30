import React, { useState } from "react";
import { X, Plus, Sparkles, Loader2 } from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import { NeoSelect } from "../../../components/NeoSelect";
import type { ClubMember, ClubTeam } from "./types";

interface CreateTeamModalProps {
    isOpen: boolean;
    onClose: () => void;
    members: ClubMember[];
    onTeamCreated: (team: ClubTeam) => void;
}

export const SUGGESTED_TEMPLATES = [
    {
        name: "Technical Team",
        description: "Core software engineering, open-source initiatives, hackathons, and platform architecture.",
        responsibilities: "Maintain codebase, build club projects, organize tech workshops and coding competitions.",
    },
    {
        name: "Design Team",
        description: "UI/UX, visual identity, branding, product design, and creative media.",
        responsibilities: "Craft promotional posters, design interfaces, brand guidelines, and visual presentations.",
    },
    {
        name: "Events and Operations",
        description: "Logistics, campus coordination, venue management, and event execution.",
        responsibilities: "Plan event timelines, manage stage operations, coordinate campus permissions, and run live events.",
    },
    {
        name: "Marketing and Public Relations",
        description: "Social media reach, campus outreach, student engagement, and brand storytelling.",
        responsibilities: "Run social channels, campaign promotion, announcements, and campus networking.",
    },
    {
        name: "Sponsorship and Partnerships",
        description: "Corporate outreach, industry sponsors, grant applications, and partner relationships.",
        responsibilities: "Draft sponsorship decks, negotiate event partnerships, and connect with tech companies.",
    },
    {
        name: "Media and Content",
        description: "Photography, videography, newsletters, blog posts, and podcasts.",
        responsibilities: "Document club activities, create after-movies, publish technical articles and newsletters.",
    },
    {
        name: "Research and Development",
        description: "Advanced engineering, AI/ML exploration, scientific papers, and deep tech prototypes.",
        responsibilities: "Conduct research sprints, mentor juniors on advanced tech, and submit research papers.",
    },
    {
        name: "Core Team / Executive Board",
        description: "Strategic leadership, budgeting, decision-making, and organizational governance.",
        responsibilities: "Set club vision, liaise with college authorities, oversee all departments, and manage finances.",
    },
];

export const CreateTeamModal: React.FC<CreateTeamModalProps> = ({
    isOpen,
    onClose,
    members,
    onTeamCreated,
}) => {
    const toast = useToast();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [responsibilities, setResponsibilities] = useState("");
    const [leadUserId, setLeadUserId] = useState("");
    const [coLeadUserId, setCoLeadUserId] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    if (!isOpen) return null;

    const handleApplyTemplate = (tmpl: typeof SUGGESTED_TEMPLATES[0]) => {
        setName(tmpl.name);
        setDescription(tmpl.description);
        setResponsibilities(tmpl.responsibilities);
        toast.info(`Pre-filled "${tmpl.name}" template.`, { title: "Template Applied" });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const trimmedName = name.trim();
        if (trimmedName.length < 2) {
            toast.error("Team name must be at least 2 characters.", { title: "Validation Error" });
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await fetch("/api/club/team/teams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    name: trimmedName,
                    description: description.trim() || undefined,
                    responsibilities: responsibilities.trim() || undefined,
                    leadUserId: leadUserId || undefined,
                    coLeadUserId: coLeadUserId || undefined,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                toast.error(data.message || "Failed to create team.", { title: "Error" });
                return;
            }

            toast.success(`Team "${trimmedName}" created successfully!`, { title: "Team Created" });
            onTeamCreated(data.team);
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Network error. Please try again.", { title: "Error" });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn overflow-y-auto">
            <div className="w-full max-w-xl bg-white border-2 border-black rounded-2xl shadow-[6px_6px_0px_#000] p-5 sm:p-6 space-y-5 my-auto max-h-[92vh] overflow-y-auto no-scrollbar">
                {/* Header */}
                <div className="flex items-start justify-between gap-3 pb-3 border-b-2 border-black/15">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[#a2ff86] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                            <Plus className="w-5 h-5 text-black stroke-[3]" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-black">
                                Create New Department / Team
                            </h3>
                            <p className="text-xs text-neutral-600 font-medium">
                                Build an organizational division, define responsibilities, and assign leads.
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 shadow-[1px_1px_0px_#000] cursor-pointer"
                    >
                        <X className="w-4 h-4 text-black stroke-[2.5]" />
                    </button>
                </div>

                {/* Optional Templates Pill Bar */}
                <div className="space-y-1.5">
                    <span className="text-[11px] font-black uppercase tracking-wider text-neutral-600 flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" />
                        <span>Optional Quick Templates:</span>
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {SUGGESTED_TEMPLATES.slice(0, 5).map((tmpl) => (
                            <button
                                key={tmpl.name}
                                type="button"
                                onClick={() => handleApplyTemplate(tmpl)}
                                className="px-2.5 py-1 rounded-lg bg-[#FAF6EE] hover:bg-[#FFE566] text-black border border-black text-[11px] font-bold shadow-[1px_1px_0px_#000] hover:shadow-[2px_2px_0px_#000] transition-all cursor-pointer"
                            >
                                + {tmpl.name}
                            </button>
                        ))}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Team Name */}
                    <div className="space-y-1">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            Department / Team Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Technical Team, Design & UI, Events..."
                            className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-black text-xs font-bold text-black shadow-[2px_2px_0px_#000] focus:outline-none focus:shadow-[4px_4px_0px_#000] transition-all"
                            required
                            autoFocus
                        />
                    </div>

                    {/* Description */}
                    <div className="space-y-1">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            Description & Purpose
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Briefly describe what this team focuses on within the club..."
                            rows={2}
                            className="w-full px-3.5 py-2 rounded-xl bg-white border-2 border-black text-xs font-medium text-black shadow-[2px_2px_0px_#000] focus:outline-none"
                        />
                    </div>

                    {/* Responsibilities */}
                    <div className="space-y-1">
                        <label className="block text-xs font-black uppercase tracking-wider text-black">
                            Key Responsibilities & Deliverables
                        </label>
                        <textarea
                            value={responsibilities}
                            onChange={(e) => setResponsibilities(e.target.value)}
                            placeholder="e.g. Maintain git repos, build projects, conduct weekly workshops..."
                            rows={2}
                            className="w-full px-3.5 py-2 rounded-xl bg-white border-2 border-black text-xs font-medium text-black shadow-[2px_2px_0px_#000] focus:outline-none"
                        />
                    </div>

                    {/* Team Lead Selection (Optional) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1">
                            <label className="block text-xs font-black uppercase tracking-wider text-black">
                                Department Lead <span className="text-neutral-500 font-normal lowercase">(optional)</span>
                            </label>
                            <NeoSelect
                                value={leadUserId}
                                onChange={(val) => setLeadUserId(val)}
                                options={[
                                    { value: "", label: "Assign later" },
                                    ...members.map((m) => ({
                                        value: m.userId,
                                        label: `${m.displayName} (@${m.username})`,
                                    })),
                                ]}
                                size="sm"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="block text-xs font-black uppercase tracking-wider text-black">
                                Co-Lead / Deputy <span className="text-neutral-500 font-normal lowercase">(optional)</span>
                            </label>
                            <NeoSelect
                                value={coLeadUserId}
                                onChange={(val) => setCoLeadUserId(val)}
                                options={[
                                    { value: "", label: "Assign later" },
                                    ...members
                                        .filter((m) => m.userId !== leadUserId)
                                        .map((m) => ({
                                            value: m.userId,
                                            label: `${m.displayName} (@${m.username})`,
                                        })),
                                ]}
                                size="sm"
                            />
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end gap-2.5 pt-3 border-t-2 border-black/10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl bg-white border-2 border-black text-black font-black text-xs uppercase tracking-wider shadow-[2px_2px_0px_#000] hover:bg-neutral-100 transition-all cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || name.trim().length < 2}
                            className="px-5 py-2.5 rounded-xl bg-[#a2ff86] border-2 border-black text-black font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_#000] hover:bg-[#8ee673] transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Creating Department...</span>
                                </>
                            ) : (
                                <span>Create Team</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
