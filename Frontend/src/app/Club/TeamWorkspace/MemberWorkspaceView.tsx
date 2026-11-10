// Frontend/src/app/Club/TeamWorkspace/MemberWorkspaceView.tsx
import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
    Briefcase,
    Building2,
    ChevronDown,
    Check,
    ShieldAlert,
    ArrowLeft,
    Compass,
} from "lucide-react";
import { workspaceApi } from "../../../api/workspaceApi";
import { OrbixLoader } from "../../../components/ui/loader";
import { WorkspaceShell } from "./WorkspaceShell";
import type { UserClubWorkspaceSummary } from "../../../types/workspace";

interface MemberWorkspaceViewProps {
    onOpenMobileSidebar?: () => void;
}

export const MemberWorkspaceView: React.FC<MemberWorkspaceViewProps> = ({
    onOpenMobileSidebar,
}) => {
    const { clubId: paramClubId, section: paramSection } = useParams<{
        clubId?: string;
        section?: string;
    }>();
    const navigate = useNavigate();

    const [workspaces, setWorkspaces] = useState<UserClubWorkspaceSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [isSelectorOpen, setIsSelectorOpen] = useState(false);
    const selectorRef = useRef<HTMLDivElement>(null);

    // Close selector dropdown on outside click
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
                setIsSelectorOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // Load user's valid club workspaces
    const loadUserWorkspaces = useCallback(async () => {
        setLoading(true);
        try {
            const res = await workspaceApi.getMyWorkspaces();
            if (res.success && res.workspaces) {
                setWorkspaces(res.workspaces);

                // Auto-direct: If no clubId specified in URL
                if (!paramClubId && res.workspaces.length > 0) {
                    // Direct access to the first (or only) club workspace
                    navigate(`/workspace/${res.workspaces[0].clubId}`, { replace: true });
                }
            }
        } catch (err: any) {
            console.error("[MemberWorkspaceView] Failed to load workspaces:", err);
        } finally {
            setLoading(false);
        }
    }, [paramClubId, navigate]);

    useEffect(() => {
        loadUserWorkspaces();
    }, [loadUserWorkspaces]);

    // Handle switching club workspace without re-login
    const handleSwitchClub = (targetClubId: string) => {
        setIsSelectorOpen(false);
        if (targetClubId !== paramClubId) {
            navigate(`/workspace/${targetClubId}`);
        }
    };

    if (loading) {
        return (
            <div className="flex-1 w-full min-h-[400px] flex flex-col items-center justify-center gap-3">
                <OrbixLoader size="lg" />
                <p className="text-xs font-black uppercase tracking-wider text-neutral-600">Connecting to your club workspace...</p>
            </div>
        );
    }

    // Zero club memberships state
    if (workspaces.length === 0) {
        return (
            <div className="flex-1 w-full min-h-0 bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] p-6 sm:p-10 flex flex-col items-center justify-center text-center animate-in fade-in duration-200">
                <div className="w-16 h-16 bg-[#FFE566] border-2 border-black rounded-2xl flex items-center justify-center mb-5 shadow-neo-sm">
                    <Briefcase className="w-8 h-8 text-black" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                    No Club Workspaces Found
                </h2>
                <p className="text-sm font-bold text-neutral-700 max-w-md mt-2 leading-relaxed">
                    You are not currently an active member of any campus club team. Join a student club or accept an invitation to collaborate with your department.
                </p>
                <div className="flex items-center gap-3 mt-6 flex-wrap justify-center">
                    <button
                        onClick={() => navigate("/clubs")}
                        className="px-5 py-2.5 bg-[#A6FF70] hover:bg-[#95F55D] text-black font-black text-xs sm:text-sm border-2 border-black rounded-xl shadow-neo-sm transition-all flex items-center gap-2 active:translate-x-[1px] active:translate-y-[1px]"
                    >
                        <Compass className="w-4 h-4 text-black" />
                        Explore Campus Clubs
                    </button>
                    <button
                        onClick={() => navigate("/dashboard")}
                        className="px-5 py-2.5 bg-white hover:bg-neutral-50 text-neutral-800 font-black text-xs sm:text-sm border-2 border-black rounded-xl shadow-neo-xs transition-all flex items-center gap-2"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Back to Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // Find currently active workspace
    const currentWorkspace = workspaces.find((w) => w.clubId === paramClubId);

    // Access Denied / Invalid clubId in URL
    if (paramClubId && !currentWorkspace) {
        return (
            <div className="flex-1 w-full min-h-0 bg-[#FAF6EE] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] p-6 sm:p-10 flex flex-col items-center justify-center text-center animate-in fade-in duration-200">
                <div className="w-16 h-16 bg-rose-100 border-2 border-black rounded-2xl flex items-center justify-center mb-5 shadow-neo-sm">
                    <ShieldAlert className="w-8 h-8 text-rose-600" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-black text-black tracking-tight">
                    Workspace Access Denied
                </h2>
                <p className="text-sm font-bold text-neutral-700 max-w-md mt-2 leading-relaxed">
                    You do not hold active membership in this club's workspace, or your invitation has not been confirmed.
                </p>
                <div className="flex items-center gap-3 mt-6 flex-wrap justify-center">
                    {workspaces.length > 0 && (
                        <button
                            onClick={() => navigate(`/workspace/${workspaces[0].clubId}`)}
                            className="px-5 py-2.5 bg-[#A6FF70] hover:bg-[#95F55D] text-black font-black text-xs sm:text-sm border-2 border-black rounded-xl shadow-neo-sm transition-all flex items-center gap-2"
                        >
                            <Building2 className="w-4 h-4 text-black" />
                            Open {workspaces[0].clubName} Workspace
                        </button>
                    )}
                    <button
                        onClick={() => navigate("/dashboard")}
                        className="px-5 py-2.5 bg-white hover:bg-neutral-50 text-neutral-800 font-black text-xs sm:text-sm border-2 border-black rounded-xl shadow-neo-xs transition-all"
                    >
                        Return to Personal Dashboard
                    </button>
                </div>
            </div>
        );
    }

    // If still resolving auto-redirect to first club
    if (!currentWorkspace) {
        return (
            <div className="flex-1 w-full min-h-[400px] flex flex-col items-center justify-center gap-3">
                <OrbixLoader size="lg" />
                <p className="text-xs font-black uppercase tracking-wider text-neutral-600">Opening workspace...</p>
            </div>
        );
    }

    // Compact Club Selector component (embedded cleanly in header)
    const clubSelectorNode = workspaces.length > 1 ? (
        <div ref={selectorRef} className="relative inline-block text-left">
            <button
                type="button"
                onClick={() => setIsSelectorOpen((prev) => !prev)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#FFE566] hover:bg-[#ffde47] text-black border-2 border-black rounded-xl text-xs font-black shadow-neo-xs transition-all cursor-pointer"
                title="Switch Club Workspace"
                aria-expanded={isSelectorOpen}
            >
                <Building2 className="w-3.5 h-3.5 text-black" />
                <span className="truncate max-w-[140px] sm:max-w-[200px]">
                    Switch Club ({workspaces.length})
                </span>
                <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-150 ${isSelectorOpen ? "rotate-180" : ""}`} />
            </button>

            {isSelectorOpen && (
                <div className="absolute right-0 mt-2 w-72 sm:w-80 bg-white border-2 border-black rounded-2xl shadow-neo p-2 z-[99] animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2 border-b-2 border-black/10 flex items-center justify-between">
                        <span className="text-[11px] font-black uppercase tracking-wider text-neutral-500">
                            Your Club Workspaces
                        </span>
                        <span className="px-2 py-0.5 bg-[#FFE566] border border-black rounded-full text-[10px] font-black text-black">
                            {workspaces.length} Clubs
                        </span>
                    </div>

                    <div className="max-h-64 overflow-y-auto space-y-1.5 py-1.5 scrollbar-thin">
                        {workspaces.map((ws) => {
                            const isCurrent = ws.clubId === currentWorkspace.clubId;
                            const primaryDept = ws.departments?.[0]?.name;

                            return (
                                <button
                                    key={ws.workspaceId}
                                    type="button"
                                    onClick={() => handleSwitchClub(ws.clubId)}
                                    className={`w-full p-2.5 rounded-xl border-2 text-left transition-all flex items-center justify-between gap-3 ${
                                        isCurrent
                                            ? "bg-[#A6FF70]/30 border-black shadow-neo-xs font-black"
                                            : "bg-white hover:bg-neutral-50 border-transparent hover:border-black/30 font-bold"
                                    }`}
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-lg border border-black bg-neutral-100 flex items-center justify-center overflow-hidden flex-shrink-0 font-black text-xs text-black">
                                            {ws.clubLogoUrl ? (
                                                <img src={ws.clubLogoUrl} alt={ws.clubName} className="w-full h-full object-cover" />
                                            ) : (
                                                ws.clubName.slice(0, 2).toUpperCase()
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-xs font-black text-black truncate leading-tight">
                                                {ws.clubName}
                                            </p>
                                            <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-neutral-600 truncate">
                                                <span className="font-bold text-neutral-900">{ws.roleTitle || ws.roleName}</span>
                                                {primaryDept && (
                                                    <>
                                                        <span>•</span>
                                                        <span className="truncate">{primaryDept}</span>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {isCurrent && (
                                        <div className="w-5 h-5 rounded-full bg-[#A6FF70] border border-black flex items-center justify-center flex-shrink-0">
                                            <Check className="w-3 h-3 text-black stroke-[3]" />
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    ) : null;

    const clubMeta = {
        id: currentWorkspace.clubId,
        name: currentWorkspace.clubName,
        slug: currentWorkspace.clubSlug,
        logo_url: currentWorkspace.clubLogoUrl,
        college_name: currentWorkspace.collegeName,
    };

    return (
        <div className="flex-1 w-full min-h-0 flex flex-col animate-in fade-in duration-200">
            <WorkspaceShell
                club={clubMeta}
                clubSelector={clubSelectorNode}
                initialSection={paramSection}
                onOpenMobileSidebar={onOpenMobileSidebar}
            />
        </div>
    );
};
