// Frontend/src/app/Club/TeamWorkspace/Departments/CreateDepartmentModal.tsx
import React, { useState } from "react";
import {
    Folder,
    X,
    Sparkles,
    Check,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";
import { useToast } from "../../../../context/ToastContext";
import { NeoSelect } from "../../../../components/NeoSelect";
import type { WorkspaceMember, WorkspaceDepartment } from "../../../../types/workspace";

interface CreateDepartmentModalProps {
    clubId: string;
    members: WorkspaceMember[];
    onClose: () => void;
    onCreated: (dept: WorkspaceDepartment) => void;
}

const TEMPLATES = [
    { name: "Technical & Development", icon: "Code", color: "#2563eb", desc: "Core software engineering, platform infrastructure, and code reviews." },
    { name: "Design & Branding", icon: "Palette", color: "#ec4899", desc: "UI/UX design, visual branding, social graphics, and event posters." },
    { name: "Content & Communications", icon: "MessageSquare", color: "#8b5cf6", desc: "Community messaging, event articles, and newsletter editorials." },
    { name: "Operations & Coordination", icon: "CheckSquare", color: "#10b981", desc: "Logistics, venue management, and volunteer operations." },
    { name: "Media & Photography", icon: "Camera", color: "#f59e0b", desc: "Event photography, recap reels, and media asset library." },
];

const COLORS = ["#2563eb", "#ec4899", "#8b5cf6", "#10b981", "#f59e0b", "#06b6d4", "#dc2626", "#475569"];
const ICONS = ["Folder", "Code", "Palette", "MessageSquare", "CheckSquare", "Camera"];

export const CreateDepartmentModal: React.FC<CreateDepartmentModalProps> = ({
    clubId,
    members,
    onClose,
    onCreated,
}) => {
    const toast = useToast();
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [icon, setIcon] = useState("Folder");
    const [color, setColor] = useState("#2563eb");
    const [leadUserId, setLeadUserId] = useState("");
    const [submitting, setSubmitting] = useState(false);

    const applyTemplate = (t: typeof TEMPLATES[0]) => {
        setName(t.name);
        setIcon(t.icon);
        setColor(t.color);
        setDescription(t.desc);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) {
            toast.error("Department name is required.");
            return;
        }

        try {
            setSubmitting(true);
            const res = await workspaceApi.createDepartment(
                {
                    name: name.trim(),
                    description: description.trim() || undefined,
                    icon,
                    color,
                    leadUserId: leadUserId || undefined,
                },
                clubId
            );

            if (res.success) {
                toast.success(res.message);
                onCreated(res.department);
                onClose();
            }
        } catch (err: any) {
            toast.error(err.message || "Failed to create department.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
            <div className="bg-white border-2 border-black rounded-2xl max-w-lg w-full p-6 shadow-neo animate-in fade-in zoom-in-95">
                <div className="flex items-center justify-between pb-4 border-b-2 border-black">
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-[#A6FF70] border-2 border-black rounded-lg">
                            <Folder className="w-5 h-5 text-black" />
                        </div>
                        <h3 className="text-lg font-black text-black">Create Department</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1 text-neutral-500 hover:text-black border-2 border-transparent hover:border-black rounded-lg transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Templates Quick-Fill Bar */}
                <div className="mt-4">
                    <div className="flex items-center gap-1.5 text-xs font-black text-neutral-600 uppercase mb-2">
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" /> Suggested Templates
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                        {TEMPLATES.map((t) => (
                            <button
                                key={t.name}
                                type="button"
                                onClick={() => applyTemplate(t)}
                                className="px-2.5 py-1 text-[11px] font-bold bg-neutral-100 hover:bg-neutral-200 border border-black rounded-lg transition"
                            >
                                {t.name}
                            </button>
                        ))}
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                    <div>
                        <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                            Department Name *
                        </label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Technical & Development"
                            className="w-full px-3 py-2 text-xs font-semibold border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                            Description
                        </label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Department mission, responsibilities, and focus areas..."
                            rows={2}
                            className="w-full px-3 py-2 text-xs font-semibold border-2 border-black rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* Color Selector */}
                        <div>
                            <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                                Color Accent
                            </label>
                            <div className="flex items-center gap-1.5 flex-wrap">
                                {COLORS.map((c) => (
                                    <button
                                        key={c}
                                        type="button"
                                        onClick={() => setColor(c)}
                                        style={{ backgroundColor: c }}
                                        className={`w-6 h-6 rounded-full border-2 border-black flex items-center justify-center transition ${
                                            color === c ? "scale-110 ring-2 ring-black ring-offset-1" : "opacity-80"
                                        }`}
                                    >
                                        {color === c && <Check className="w-3.5 h-3.5 text-white stroke-[3]" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Icon Selector */}
                        <div>
                            <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                                Icon
                            </label>
                            <NeoSelect
                                value={icon}
                                onChange={(val) => setIcon(val)}
                                size="sm"
                                triggerClassName="w-full text-xs font-bold"
                                options={ICONS.map((i) => ({ value: i, label: i }))}
                            />
                        </div>
                    </div>

                    {/* Primary Lead */}
                    <div>
                        <label className="block text-xs font-black uppercase text-neutral-700 mb-1">
                            Designated Primary Lead (Optional)
                        </label>
                        <NeoSelect
                            value={leadUserId}
                            onChange={(val) => setLeadUserId(val)}
                            size="sm"
                            triggerClassName="w-full text-xs font-bold"
                            options={[
                                { value: "", label: "No Primary Lead (Assign Later)" },
                                ...members.map((m) => ({
                                    value: m.userId,
                                    label: `${m.user?.firstName || ""} ${m.user?.lastName || ""}`.trim() || m.user?.username || m.userId,
                                    description: m.roleTitle,
                                })),
                            ]}
                        />
                    </div>

                    <div className="flex items-center justify-end gap-2.5 pt-4 border-t-2 border-black">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-black bg-neutral-100 hover:bg-neutral-200 border-2 border-black rounded-xl"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-4 py-2 text-xs font-black bg-[#A6FF70] hover:bg-[#95F55D] text-black border-2 border-black rounded-xl shadow-neo-sm transition-all"
                        >
                            {submitting ? "Creating..." : "Create Department"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CreateDepartmentModal;
