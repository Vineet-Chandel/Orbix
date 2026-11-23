import React from "react";
import { OrbixSkeleton } from "./OrbixSkeleton";

export interface DashboardRouteSkeletonProps {
    showSidebar?: boolean;
}

/**
 * DashboardRouteSkeleton
 *
 * Page-appropriate skeleton simulating the dashboard layout:
 * - Content area skeleton by default (for tab switching / nested suspense within mounted dashboard layouts)
 * - Optional full-page layout with left rail placeholder when showSidebar is true (for top-level route loading)
 */
export const DashboardRouteSkeleton: React.FC<DashboardRouteSkeletonProps> = ({ showSidebar = false }) => {
    const content = (
        <div className="flex-1 w-full bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] rounded-2xl border-2 border-black shadow-[6px_6px_0px_#000] p-4 sm:p-6 lg:p-8 overflow-y-auto space-y-6">
            {/* Header Bar */}
            <div className="pb-5 border-b-2 border-black/15 flex items-center justify-between gap-4">
                <div className="space-y-2">
                    <OrbixSkeleton variant="text" width={220} height={28} />
                    <OrbixSkeleton variant="text" width={140} height={18} />
                </div>
                <OrbixSkeleton variant="button" width={120} height={38} rounded="rounded-xl" />
            </div>

            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                    <OrbixSkeleton variant="text" width={90} height={16} />
                    <OrbixSkeleton variant="text" width={60} height={32} />
                </div>
                <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                    <OrbixSkeleton variant="text" width={110} height={16} />
                    <OrbixSkeleton variant="text" width={75} height={32} />
                </div>
                <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                    <OrbixSkeleton variant="text" width={100} height={16} />
                    <OrbixSkeleton variant="text" width={80} height={32} />
                </div>
                <div className="p-5 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                    <OrbixSkeleton variant="text" width={80} height={16} />
                    <OrbixSkeleton variant="text" width={50} height={32} />
                </div>
            </div>

            {/* Table Area */}
            <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-4">
                <div className="flex items-center justify-between pb-3 border-b-2 border-black/10">
                    <OrbixSkeleton variant="text" width={160} height={20} />
                    <OrbixSkeleton variant="button" width={90} height={32} />
                </div>
                <OrbixSkeleton variant="table-row" count={4} />
            </div>
        </div>
    );

    if (showSidebar) {
        return (
            <div className="flex h-screen bg-white text-neutral-900 overflow-hidden font-sans select-none">
                {/* Left Rail Placeholder (mimics Desktop Sidebar) */}
                <div className="hidden lg:block h-screen sticky top-0 flex-shrink-0 w-[84px] sm:w-[88px] p-3">
                    <div className="h-[calc(100vh-1.5rem)] rounded-2xl bg-[#FAF6EE] border-3 border-black p-3 flex flex-col justify-between items-center shadow-[4px_4px_0px_#000]">
                        <OrbixSkeleton variant="avatar" width={40} height={40} />
                        <div className="space-y-4 w-full flex flex-col items-center">
                            <OrbixSkeleton variant="button" width={40} height={40} rounded="rounded-xl" />
                            <OrbixSkeleton variant="button" width={40} height={40} rounded="rounded-xl" />
                            <OrbixSkeleton variant="button" width={40} height={40} rounded="rounded-xl" />
                            <OrbixSkeleton variant="button" width={40} height={40} rounded="rounded-xl" />
                        </div>
                        <OrbixSkeleton variant="avatar" width={40} height={40} />
                    </div>
                </div>

                {/* Main Content Area */}
                <main className="flex-1 min-w-0 h-screen flex flex-col p-2 sm:p-3 overflow-hidden">
                    {content}
                </main>
            </div>
        );
    }

    return (
        <div className="flex-1 w-full h-full min-h-0 flex flex-col overflow-hidden select-none">
            {content}
        </div>
    );
};

/**
 * DocsRouteSkeleton
 *
 * Page skeleton simulating documentation and blogs view.
 */
export const DocsRouteSkeleton: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] text-black p-4 sm:p-6 lg:p-8 select-none">
            <div className="max-w-6xl mx-auto space-y-6">
                {/* Top Nav Mock */}
                <div className="flex items-center justify-between pb-4 border-b-2 border-black/15">
                    <div className="flex items-center gap-3">
                        <OrbixSkeleton variant="avatar" width={36} height={36} rounded="rounded-xl" />
                        <OrbixSkeleton variant="text" width={120} height={22} />
                    </div>
                    <OrbixSkeleton variant="button" width={100} height={36} rounded="rounded-xl" />
                </div>

                {/* Docs Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    {/* Left Sidebar Mock */}
                    <div className="p-4 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-4 h-fit">
                        <OrbixSkeleton variant="text" width={100} height={18} />
                        <div className="space-y-2 pt-1">
                            <OrbixSkeleton variant="text" width="90%" height={14} />
                            <OrbixSkeleton variant="text" width="80%" height={14} />
                            <OrbixSkeleton variant="text" width="85%" height={14} />
                            <OrbixSkeleton variant="text" width="70%" height={14} />
                        </div>
                    </div>

                    {/* Main Reading Canvas Mock */}
                    <div className="md:col-span-3 p-6 sm:p-8 rounded-2xl bg-white border-2 border-black shadow-[4px_4px_0px_#000] space-y-6">
                        <OrbixSkeleton variant="text" width={260} height={32} />
                        <OrbixSkeleton variant="text" count={3} />
                        <OrbixSkeleton variant="card" height={180} />
                        <OrbixSkeleton variant="text" count={2} />
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * ContentRouteSkeleton
 *
 * Generic page skeleton for marketing, legal, showcases, and landing routes.
 */
export const ContentRouteSkeleton: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] text-black p-4 sm:p-6 lg:p-10 select-none">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header Skeleton */}
                <div className="flex items-center justify-between pb-4 border-b-2 border-black/15">
                    <div className="flex items-center gap-3">
                        <OrbixSkeleton variant="avatar" width={36} height={36} rounded="rounded-xl" />
                        <OrbixSkeleton variant="text" width={110} height={24} />
                    </div>
                    <div className="flex items-center gap-2">
                        <OrbixSkeleton variant="button" width={80} height={36} rounded="rounded-xl" />
                        <OrbixSkeleton variant="button" width={90} height={36} rounded="rounded-xl" />
                    </div>
                </div>

                {/* Hero Mock */}
                <div className="p-8 sm:p-12 rounded-3xl bg-white border-3 border-black shadow-[6px_6px_0px_#000] text-center space-y-4">
                    <OrbixSkeleton variant="text" width="60%" height={36} className="mx-auto" />
                    <OrbixSkeleton variant="text" count={2} className="max-w-md mx-auto" />
                    <div className="pt-2 flex justify-center gap-3">
                        <OrbixSkeleton variant="button" width={130} height={42} rounded="rounded-xl" />
                    </div>
                </div>

                {/* Cards Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                        <OrbixSkeleton variant="text" width="50%" height={18} />
                        <OrbixSkeleton variant="text" count={2} />
                    </div>
                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                        <OrbixSkeleton variant="text" width="50%" height={18} />
                        <OrbixSkeleton variant="text" count={2} />
                    </div>
                    <div className="p-6 rounded-2xl bg-white border-2 border-black shadow-[3px_3px_0px_#000] space-y-3">
                        <OrbixSkeleton variant="text" width="50%" height={18} />
                        <OrbixSkeleton variant="text" count={2} />
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * AuthRouteSkeleton
 *
 * Page skeleton simulating signin and signup dialogs.
 */
export const AuthRouteSkeleton: React.FC = () => {
    return (
        <div className="min-h-screen bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] flex items-center justify-center p-4 select-none">
            <div className="max-w-md w-full rounded-3xl bg-white border-3 border-black shadow-[8px_8px_0px_#000] p-6 sm:p-8 space-y-6">
                <div className="flex flex-col items-center space-y-2 text-center">
                    <OrbixSkeleton variant="avatar" width={48} height={48} rounded="rounded-2xl" />
                    <OrbixSkeleton variant="text" width={160} height={26} />
                    <OrbixSkeleton variant="text" width={200} height={16} />
                </div>
                <div className="space-y-4">
                    <OrbixSkeleton variant="text" width="100%" height={44} rounded="rounded-xl" />
                    <OrbixSkeleton variant="text" width="100%" height={44} rounded="rounded-xl" />
                    <OrbixSkeleton variant="button" width="100%" height={46} rounded="rounded-xl" />
                </div>
            </div>
        </div>
    );
};
