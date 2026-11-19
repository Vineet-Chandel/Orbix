import React from "react";
import { DynamicLinksManager } from "./DynamicLinksManager";
import { ClubAchievementsManager } from "./ClubAchievementsManager";
import type { ClubLink, ClubAchievement } from "../../../utils/clubProfileApi";

interface StepLinksAchievementsProps {
    clubId: string;
    links: ClubLink[];
    onLinksChange: (updatedLinks: ClubLink[]) => void;
    achievements: ClubAchievement[];
    canManage: boolean;
    onUpdateAchievements: () => void;
}

export const StepLinksAchievements: React.FC<StepLinksAchievementsProps> = ({
    clubId,
    links,
    onLinksChange,
    achievements,
    canManage,
    onUpdateAchievements,
}) => {
    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="border-b border-black/10 pb-4">
                <h2 className="text-lg font-black text-black tracking-tight">Links & Achievements</h2>
                <p className="text-xs text-neutral-600 font-medium mt-1">
                    Connect your external platforms and celebrate the competitions, milestones, and awards your club has won.
                </p>
            </div>

            {/* Section A: Dynamic Links */}
            <div>
                <DynamicLinksManager links={links} onChange={onLinksChange} />
            </div>

            {/* Section B: Achievements & Highlights */}
            <div className="pt-6 border-t-2 border-black/10">
                <ClubAchievementsManager
                    clubId={clubId}
                    achievements={achievements}
                    canManage={canManage}
                    onUpdate={onUpdateAchievements}
                />
            </div>
        </div>
    );
};
