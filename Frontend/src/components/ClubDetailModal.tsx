import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "react-router-dom";
import { ClubMarkdownRenderer } from "../app/Club/Profile/ClubMarkdownRenderer";
import {
    X,
    Users,
    Calendar,
    Trophy,
    Clock,
    MapPin,
    Globe,
    Mail,
    Phone,
    ExternalLink,
    Sparkles,
    Check,
    Target,
    Compass,
    Radio,
    Award,
    Loader2,
} from "lucide-react";
import type { CollegeClubItem, ClubCoordinator } from "../utils/clubProfileApi";
import { getPlatformIcon } from "../utils/platformLinks";
import { useToast } from "../context/ToastContext";
import { useModalDismiss } from "../hooks/useModalDismiss";
import { VerifiedBadge } from "./VerifiedBadge";

interface ClubDetailModalProps {
    club: CollegeClubItem | null;
    isOpen: boolean;
    onClose: () => void;
    onNavigateToEdit?: () => void;
}

export const ClubDetailModal: React.FC<ClubDetailModalProps> = ({
    club,
    isOpen,
    onClose,
}) => {
    const toast = useToast();
    const [copiedLink, setCopiedLink] = useState(false);
    const [loadedCoordinators, setLoadedCoordinators] = useState<ClubCoordinator[]>(club?.coordinators || []);
    const [loadingCoordinators, setLoadingCoordinators] = useState(false);

    useModalDismiss({ isOpen, onClose });

    // Lock body scroll
    useEffect(() => {
        if (!isOpen) return;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    // Ensure coordinators are loaded even if summary item did not provide them
    useEffect(() => {
        if (!club) return;
        setLoadedCoordinators(club.coordinators || []);
        if ((!club.coordinators || club.coordinators.length === 0) && club.slug) {
            setLoadingCoordinators(true);
            fetch(`/api/clubs/${encodeURIComponent(club.slug)}`)
                .then((r) => r.json())
                .then((data) => {
                    if (data.success && Array.isArray(data.coordinators)) {
                        setLoadedCoordinators(data.coordinators);
                    }
                })
                .catch((err) => {
                    console.error("Failed to load coordinators for modal:", err);
                })
                .finally(() => {
                    setLoadingCoordinators(false);
                });
        }
    }, [club]);

    if (!isOpen || !club) return null;

    const handleCopyShareUrl = () => {
        const url = `${window.location.origin}/clubs/${encodeURIComponent(club.slug)}`;
        navigator.clipboard.writeText(url);
        setCopiedLink(true);
        toast.success("Public chapter link copied to clipboard!", { title: "Copied Link" });
        setTimeout(() => setCopiedLink(false), 2200);
    };

    const s = club.socialLinks || {};
    const socialsList = [
        { key: "website", url: club.websiteUrl || (s as any).website, label: "Website", icon: "website" },
        { key: "github", url: s.github, label: "GitHub", icon: "github" },
        { key: "linkedin", url: s.linkedin, label: "LinkedIn", icon: "linkedin" },
        { key: "instagram", url: s.instagram, label: "Instagram", icon: "instagram" },
        { key: "x", url: s.x || (s as any).twitter, label: "X / Twitter", icon: "x" },
        { key: "discord", url: s.discord, label: "Discord", icon: "discord" },
        { key: "youtube", url: s.youtube, label: "YouTube", icon: "youtube" },
    ].filter((item) => Boolean(item.url && item.url.trim()));

    const allLinks = Array.isArray(club.links) && club.links.length > 0
        ? club.links
        : socialsList.map((item) => ({ platform: item.icon, url: item.url!, label: item.label }));

    if (typeof document === "undefined") return null;

    return createPortal(
        <div
            className="fixed inset-0 top-0 left-0 right-0 bottom-0 z-[100] bg-black/70 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 md:p-5 overflow-y-auto animate-in fade-in duration-200"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="club-modal-title"
        >
            <div
                className="relative w-full max-w-[96vw] xl:max-w-[98vw] 2xl:max-w-[1700px] bg-[#FAF6EE] rounded-3xl border-3 border-black shadow-[8px_8px_0px_#000] sm:shadow-[14px_14px_0px_#000] overflow-hidden my-auto max-h-[94vh] flex flex-col animate-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Close Button Floating */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-4 right-4 z-30 p-2.5 rounded-2xl bg-white hover:bg-[#FFE566] text-black border-2 border-black shadow-[3px_3px_0px_#000] transition-all cursor-pointer active:translate-x-[1px] active:translate-y-[1px]"
                    aria-label="Close club details"
                >
                    <X className="w-5 h-5 stroke-[2.5]" />
                </button>

                {/* SCROLLABLE INNER CONTAINER */}
                <div className="overflow-y-auto flex-1 overscroll-contain">
                    {/* Cover Showcase Banner */}
                    <div className="relative h-44 sm:h-56 md:h-64 w-full bg-neutral-900 border-b-3 border-black overflow-hidden flex-shrink-0">
                        {club.coverImageUrl ? (
                            <img
                                src={club.coverImageUrl}
                                alt={`${club.name} banner`}
                                className="w-full h-full object-cover"
                            />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-neutral-950 via-neutral-900 to-black relative flex items-center justify-center">
                                {/* Bespoke Neo Geometric Lattice Texture */}
                                <div
                                    className="absolute inset-0 opacity-20"
                                    style={{
                                        backgroundImage:
                                            "radial-gradient(#a2ff86 1px, transparent 1px), radial-gradient(#FFE566 1px, transparent 1px)",
                                        backgroundSize: "20px 20px",
                                        backgroundPosition: "0 0, 10px 10px",
                                    }}
                                />
                                <span className="text-white/25 text-3xl sm:text-5xl font-black uppercase tracking-widest select-none">
                                    {club.name}
                                </span>
                            </div>
                        )}

                        {/* Top Badges Ribbon */}
                        <div className="absolute top-4 left-4 flex items-center gap-2 flex-wrap max-w-[80%] z-10">
                            {club.isCurrentClub && (
                                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FFE566] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000]">
                                    <Sparkles className="w-3.5 h-3.5 fill-black stroke-none" />
                                    YOUR CLUB
                                </span>
                            )}

                            <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-white/95 text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000]">
                                {club.category || "Student Organization"}
                            </span>

                            {club.recruitmentStatus === "open" && (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#a2ff86] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] animate-pulse">
                                    <Radio className="w-3 h-3 text-black stroke-[3]" />
                                    RECRUITING NOW
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Club Header & Avatar Section */}
                    <div className="px-5 sm:px-8 pt-0 pb-8">
                        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6 relative z-10">
                            <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-5">
                                {/* Overlapping Avatar Box */}
                                <div className="w-24 h-24 sm:w-28 sm:h-28 -mt-12 sm:-mt-16 rounded-2xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] overflow-hidden flex items-center justify-center flex-shrink-0 relative">
                                    {club.logoUrl ? (
                                        <img
                                            src={club.logoUrl}
                                            alt={club.name}
                                            className="w-full h-full object-cover"
                                        />
                                    ) : (
                                        <div className="w-full h-full bg-[#FAF6EE] flex items-center justify-center font-black text-2xl sm:text-3xl text-black">
                                            {club.name.slice(0, 2).toUpperCase()}
                                        </div>
                                    )}
                                    <div className="absolute -bottom-1 -right-1">
                                        <VerifiedBadge size="md" title="Verified Collegiate Club" />
                                    </div>
                                </div>

                                {/* Club Identity & Narrative Info (Positioned safely below banner on solid background) */}
                                <div className="space-y-1.5 pt-2 sm:pt-4 pb-0.5">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2
                                            id="club-modal-title"
                                            className="text-2xl sm:text-3xl font-black text-black tracking-tight"
                                        >
                                            {club.name}
                                        </h2>
                                        <VerifiedBadge size="md" title="Verified Collegiate Club" />
                                    </div>
                                    {club.collegeName && (
                                        <p className="text-xs sm:text-sm font-bold text-neutral-700 flex items-center gap-1.5 flex-wrap">
                                            <MapPin className="w-3.5 h-3.5 text-neutral-600 shrink-0" />
                                            <span className="text-black font-black">{club.collegeName}</span>
                                        </p>
                                    )}
                                </div>
                            </div>

                            {/* Action Buttons Hub: Only Share button kept */}
                            <div className="flex items-center gap-2 flex-wrap sm:pb-1">
                                <button
                                    type="button"
                                    onClick={handleCopyShareUrl}
                                    className="px-4 py-2 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-black text-xs shadow-[2.5px_2.5px_0px_#000] flex items-center gap-1.5 cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                    title="Copy Public Link"
                                >
                                    {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Globe className="w-3.5 h-3.5" />}
                                    <span>{copiedLink ? "Copied Link!" : "Share"}</span>
                                </button>
                            </div>
                        </div>

                        {/* Quick Stats Metric Tiles */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                            <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[2.5px_2.5px_0px_#000]">
                                <div className="flex items-center justify-between text-neutral-500 mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider">Active Members</span>
                                    <Users className="w-3.5 h-3.5 text-black" />
                                </div>
                                <div className="text-xl font-black text-black">
                                    {club.memberCount > 0 ? club.memberCount : "Open"}
                                </div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[2.5px_2.5px_0px_#000]">
                                <div className="flex items-center justify-between text-neutral-500 mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider">Sessions & Events</span>
                                    <Calendar className="w-3.5 h-3.5 text-black" />
                                </div>
                                <div className="text-xl font-black text-black">
                                    {club.eventsCount}
                                </div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[2.5px_2.5px_0px_#000]">
                                <div className="flex items-center justify-between text-neutral-500 mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider">Achievements</span>
                                    <Trophy className="w-3.5 h-3.5 text-amber-600" />
                                </div>
                                <div className="text-xl font-black text-black">
                                    {club.achievementsCount}
                                </div>
                            </div>

                            <div className="p-3.5 rounded-xl bg-white border-2 border-black shadow-[2.5px_2.5px_0px_#000]">
                                <div className="flex items-center justify-between text-neutral-500 mb-1">
                                    <span className="text-[10px] font-black uppercase tracking-wider">Founded</span>
                                    <Clock className="w-3.5 h-3.5 text-black" />
                                </div>
                                <div className="text-xl font-black text-black">
                                    {club.foundedYear || "N/A"}
                                </div>
                            </div>
                        </div>

                        {/* RECRUITMENT CALLOUT BANNER (if active) */}
                        {club.recruitmentStatus === "open" && (
                            <div className="mb-6 p-5 rounded-2xl bg-[#a2ff86] border-2 border-black shadow-[4px_4px_0px_#000] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="px-2 py-0.5 rounded-md bg-white text-black border border-black text-[10px] font-black uppercase tracking-wider">
                                            Recruitment Drive Active
                                        </span>
                                    </div>
                                    <h4 className="text-base font-black text-black">
                                        {club.recruitmentAnnouncement || `${club.name} is actively recruiting new student members!`}
                                    </h4>
                                </div>
                                {club.recruitmentUrl && (
                                    <a
                                        href={club.recruitmentUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="px-4 py-2.5 rounded-xl bg-white hover:bg-neutral-100 text-black border-2 border-black font-black text-xs shadow-[2.5px_2.5px_0px_#000] flex items-center gap-2 whitespace-nowrap cursor-pointer transition-transform active:translate-x-[1px] active:translate-y-[1px]"
                                    >
                                        <span>Apply to Join</span>
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </a>
                                )}
                            </div>
                        )}

                        {/* 50 / 50 SPLIT GRID LAYOUT (GitHub Style) */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                            {/* ========================================================= */}
                            {/* LEFT COLUMN: CHAPTER LEADERSHIP & COORDINATORS (AND ACHIEVEMENTS) */}
                            {/* ========================================================= */}
                            <div className="space-y-6">
                                {/* Coordinators Showcase Box */}
                                <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[3.5px_3.5px_0px_#000] space-y-4">
                                    <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                                        <h3 className="text-sm font-black uppercase tracking-wider text-black flex items-center gap-2">
                                            <Users className="w-4 h-4 text-black" />
                                            <span>Chapter Leadership & Coordinators</span>
                                        </h3>
                                        {loadedCoordinators.length > 0 && (
                                            <span className="px-2.5 py-0.5 rounded-full bg-[#a2ff86] text-black border border-black text-xs font-black shadow-[1px_1px_0px_#000]">
                                                {loadedCoordinators.length}
                                            </span>
                                        )}
                                    </div>

                                    {loadingCoordinators ? (
                                        <div className="p-8 text-center flex flex-col items-center justify-center gap-2">
                                            <Loader2 className="w-6 h-6 animate-spin text-black" />
                                            <span className="text-xs font-bold text-neutral-500">
                                                Loading coordinators...
                                            </span>
                                        </div>
                                    ) : loadedCoordinators.length > 0 ? (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                            {loadedCoordinators.map((coord) => (
                                                <div
                                                    key={coord.id}
                                                    className={`p-3.5 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] flex flex-col justify-between space-y-3 ${
                                                        coord.isPrimary ? "ring-2 ring-[#a2ff86]" : ""
                                                    }`}
                                                >
                                                    <div className="flex items-start gap-3">
                                                        <div className="w-12 h-12 rounded-xl bg-white border-2 border-black shadow-[1.5px_1.5px_0px_#000] overflow-hidden flex items-center justify-center flex-shrink-0">
                                                            {coord.imageUrl ? (
                                                                <img
                                                                    src={coord.imageUrl}
                                                                    alt={coord.name}
                                                                    className="w-full h-full object-cover"
                                                                />
                                                            ) : (
                                                                <span className="font-black text-xs text-neutral-800">
                                                                    {coord.name.slice(0, 2).toUpperCase()}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="min-w-0 flex-1">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                <h5 className="text-xs font-black text-black truncate">
                                                                    {coord.name}
                                                                </h5>
                                                                {coord.isPrimary && (
                                                                    <span className="px-1.5 py-0.2 rounded-md bg-[#a2ff86] border border-black text-[9px] font-black shadow-[1px_1px_0px_#000]">
                                                                        Lead
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <p className="text-[11px] font-bold text-neutral-700 truncate mt-0.5">
                                                                {coord.role}
                                                            </p>
                                                            {coord.department && (
                                                                <p className="text-[10px] text-neutral-500 font-medium truncate">
                                                                    {coord.department}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-black/10">
                                                        {coord.linkedUsername ? (
                                                            <Link
                                                                to={`/@${coord.linkedUsername}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="text-[10px] font-black text-black hover:underline"
                                                            >
                                                                @{coord.linkedUsername}
                                                            </Link>
                                                        ) : (
                                                            <span className="text-[10px] font-bold text-neutral-400">
                                                                Chapter Representative
                                                            </span>
                                                        )}

                                                        <div className="flex items-center gap-1.5">
                                                            {coord.contactEmail && (
                                                                <a
                                                                    href={`mailto:${coord.contactEmail}`}
                                                                    className="p-1 rounded-md bg-white border border-black text-black hover:bg-neutral-100 shadow-[1px_1px_0px_#000]"
                                                                    title={coord.contactEmail}
                                                                >
                                                                    <Mail className="w-3 h-3" />
                                                                </a>
                                                            )}
                                                            {coord.linkedinUrl && (
                                                                <a
                                                                    href={coord.linkedinUrl}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="p-1 rounded-md bg-white border border-black text-black hover:text-blue-600 hover:bg-neutral-100 shadow-[1px_1px_0px_#000]"
                                                                    title="LinkedIn"
                                                                >
                                                                    {getPlatformIcon("linkedin", "w-3 h-3")}
                                                                </a>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="p-8 rounded-xl bg-[#FAF6EE] border-2 border-dashed border-black/30 text-center space-y-1.5">
                                            <Users className="w-8 h-8 text-neutral-400 mx-auto" />
                                            <h4 className="text-xs font-black text-black">No Coordinators Listed</h4>
                                            <p className="text-[11px] text-neutral-500 font-medium">
                                                Chapter coordinators have not been publicly listed yet.
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {/* Recent Achievements & Highlights */}
                                {club.achievements && club.achievements.length > 0 && (
                                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[3.5px_3.5px_0px_#000] space-y-4">
                                        <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                                            <h3 className="text-sm font-black uppercase tracking-wider text-black flex items-center gap-2">
                                                <Award className="w-4 h-4 text-amber-600" />
                                                Recognition & Milestone Highlights
                                            </h3>
                                            <span className="px-2 py-0.5 rounded-full bg-[#FFE566] text-black border border-black text-xs font-black shadow-[1px_1px_0px_#000]">
                                                {club.achievements.length}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {club.achievements.map((ach) => (
                                                <div
                                                    key={ach.id}
                                                    className="p-4 rounded-xl bg-[#FAF6EE] border-2 border-black shadow-[2px_2px_0px_#000] space-y-1.5"
                                                >
                                                    <div className="flex items-start justify-between gap-2">
                                                        <h5 className="text-xs font-black text-black">
                                                            {ach.title}
                                                        </h5>
                                                        {ach.achievementDate && (
                                                            <span className="text-[10px] font-bold text-neutral-500 whitespace-nowrap">
                                                                {ach.achievementDate}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {ach.issuer && (
                                                        <p className="text-[11px] font-bold text-neutral-600">
                                                            Issued by: {ach.issuer}
                                                        </p>
                                                    )}
                                                    {ach.description && (
                                                        <p className="text-xs font-medium text-neutral-700">
                                                            {ach.description}
                                                        </p>
                                                    )}
                                                    {ach.externalLink && (
                                                        <a
                                                            href={ach.externalLink}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 text-[11px] font-black text-blue-600 hover:underline pt-1"
                                                        >
                                                            <span>View Credential</span>
                                                            <ExternalLink className="w-3 h-3" />
                                                        </a>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* ========================================================= */}
                            {/* RIGHT COLUMN: ABOUT SECTION (50% WIDTH, GITHUB STYLE) */}
                            {/* ========================================================= */}
                            <div className="space-y-6">
                                {/* About Narrative Card */}
                                <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[3.5px_3.5px_0px_#000] space-y-4">
                                    <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                                        <h3 className="text-sm font-black uppercase tracking-wider text-black flex items-center gap-2">
                                            <Compass className="w-4 h-4 text-black" />
                                            About {club.name}
                                        </h3>
                                    </div>

                                    {club.shortDescription && (
                                        <p className="text-sm font-bold text-neutral-800 leading-relaxed border-l-4 border-[#a2ff86] bg-[#FAF6EE] p-3 rounded-r-xl border border-black/10">
                                            "{club.shortDescription}"
                                        </p>
                                    )}

                                    {club.about ? (
                                        <div className="prose prose-sm max-w-none text-xs text-neutral-800 leading-relaxed">
                                            <ClubMarkdownRenderer content={club.about} />
                                        </div>
                                    ) : (
                                        <p className="text-xs text-neutral-500 italic">
                                            No extensive chapter biography provided yet.
                                        </p>
                                    )}
                                </div>

                                {/* Dual Mission & Vision Cards */}
                                {(club.mission || club.vision) && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        {club.mission && (
                                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg bg-[#FFE566] border border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
                                                        <Target className="w-3.5 h-3.5 text-black" />
                                                    </div>
                                                    <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                                        Our Mission
                                                    </h4>
                                                </div>
                                                <p className="text-xs font-medium text-neutral-700 leading-relaxed">
                                                    {club.mission}
                                                </p>
                                            </div>
                                        )}

                                        {club.vision && (
                                            <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-7 h-7 rounded-lg bg-[#a2ff86] border border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
                                                        <Sparkles className="w-3.5 h-3.5 text-black" />
                                                    </div>
                                                    <h4 className="text-xs font-black uppercase tracking-wider text-black">
                                                        Our Vision
                                                    </h4>
                                                </div>
                                                <p className="text-xs font-medium text-neutral-700 leading-relaxed">
                                                    {club.vision}
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* Focus Areas & Technical Domains */}
                                {Array.isArray(club.focusAreas) && club.focusAreas.length > 0 && (
                                    <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                                        <h4 className="text-xs font-black uppercase tracking-wider text-neutral-700">
                                            Focus Areas & Technical Domains
                                        </h4>
                                        <div className="flex flex-wrap gap-2">
                                            {club.focusAreas.map((tag, idx) => (
                                                <span
                                                    key={idx}
                                                    className="px-3 py-1 rounded-lg bg-[#FAF6EE] text-black border-2 border-black text-xs font-black shadow-[1.5px_1.5px_0px_#000]"
                                                >
                                                    #{tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Official Channels & Social Links */}
                                <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                                    <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                        Official Channels & Links
                                    </span>

                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 flex-wrap">
                                        <div className="flex items-center gap-3 text-xs font-bold text-neutral-800 flex-wrap">
                                            {club.publicEmail && (
                                                <a
                                                    href={`mailto:${club.publicEmail}`}
                                                    className="inline-flex items-center gap-1.5 hover:text-black underline"
                                                >
                                                    <Mail className="w-3.5 h-3.5 text-neutral-600" />
                                                    <span>{club.publicEmail}</span>
                                                </a>
                                            )}
                                            {club.contactPhone && (
                                                <span className="inline-flex items-center gap-1.5 text-neutral-700">
                                                    <Phone className="w-3.5 h-3.5 text-neutral-600" />
                                                    <span>{club.contactPhone}</span>
                                                </span>
                                            )}
                                        </div>

                                        {/* Social Icons / Dynamic Platform Links */}
                                        {allLinks.length > 0 && (
                                            <div className="flex items-center gap-2 flex-wrap">
                                                {allLinks.map((item, idx) => (
                                                    <a
                                                        key={idx}
                                                        href={item.url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="px-2.5 py-1.5 rounded-lg bg-[#FAF6EE] hover:bg-[#FFE566] text-black border-2 border-black shadow-[1.5px_1.5px_0px_#000] flex items-center gap-1.5 text-xs font-black transition-all cursor-pointer"
                                                        title={item.label || item.platform}
                                                    >
                                                        {getPlatformIcon(item.platform, "w-3.5 h-3.5")}
                                                        <span>
                                                            {item.label || (item.platform === "x" ? "Twitter" : item.platform.charAt(0).toUpperCase() + item.platform.slice(1))}
                                                        </span>
                                                    </a>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>,
        document.body
    );
};
