// Frontend/src/app/Club/TeamWorkspace/Recognition/AwardAnalyticsView.tsx
import React, { useEffect, useState } from "react";
import {
    Sparkles,
    Award,
    Flame,
    BarChart3,
    Calendar,
    Trophy,
} from "lucide-react";
import { workspaceApi } from "../../../../api/workspaceApi";

interface AwardAnalyticsViewProps {
    clubId: string;
}

export const AwardAnalyticsView: React.FC<AwardAnalyticsViewProps> = ({ clubId }) => {
    const [analytics, setAnalytics] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);

    const loadAnalytics = async () => {
        try {
            setLoading(true);
            const res = await workspaceApi.getRecognitionAnalytics(clubId);
            if (res.success) {
                setAnalytics(res.analytics);
            }
        } catch (err) {
            console.error("Failed to load recognition analytics:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadAnalytics();
    }, [clubId]);

    if (loading) {
        return (
            <div className="p-12 text-center text-xs font-bold text-neutral-500">
                Loading recognition analytics...
            </div>
        );
    }

    if (!analytics) {
        return (
            <div className="p-8 text-center text-xs font-bold text-neutral-500">
                Analytics data not available yet.
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* 4 Metric Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="p-4 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-1">
                    <div className="flex items-center justify-between text-neutral-500">
                        <span className="text-[11px] font-black uppercase tracking-wider">Total Orbits</span>
                        <Sparkles className="w-4 h-4 text-amber-500 fill-amber-400" />
                    </div>
                    <div className="text-2xl font-black text-black">{analytics.totalOrbitsAwarded}</div>
                    <p className="text-[10px] font-bold text-neutral-500">Total points circulating</p>
                </div>

                <div className="p-4 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-1">
                    <div className="flex items-center justify-between text-neutral-500">
                        <span className="text-[11px] font-black uppercase tracking-wider">This Month</span>
                        <Calendar className="w-4 h-4 text-blue-600" />
                    </div>
                    <div className="text-2xl font-black text-black">+{analytics.monthlyOrbitsAwarded}</div>
                    <p className="text-[10px] font-bold text-neutral-500">Awarded current cycle</p>
                </div>

                <div className="p-4 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-1">
                    <div className="flex items-center justify-between text-neutral-500">
                        <span className="text-[11px] font-black uppercase tracking-wider">Awards Given</span>
                        <Award className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="text-2xl font-black text-black">{analytics.totalAwardsCount}</div>
                    <p className="text-[10px] font-bold text-neutral-500">Successful transactions</p>
                </div>

                <div className="p-4 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-1">
                    <div className="flex items-center justify-between text-neutral-500">
                        <span className="text-[11px] font-black uppercase tracking-wider">Categories</span>
                        <Flame className="w-4 h-4 text-orange-500" />
                    </div>
                    <div className="text-2xl font-black text-black">{analytics.activeCategoriesCount}</div>
                    <p className="text-[10px] font-bold text-neutral-500">Active dimensions</p>
                </div>
            </div>

            {/* Category Breakdown & Top Teammates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Category Distribution */}
                <div className="p-5 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-4">
                    <div className="flex items-center gap-2 border-b-2 border-black pb-3">
                        <BarChart3 className="w-4 h-4 text-black" />
                        <h4 className="text-sm font-black text-black">Points by Category</h4>
                    </div>

                    <div className="space-y-3">
                        {analytics.categoryBreakdown?.length === 0 ? (
                            <p className="text-xs font-bold text-neutral-500 text-center py-4">
                                No categorized awards yet.
                            </p>
                        ) : (
                            analytics.categoryBreakdown?.map((cat: any) => {
                                const total = analytics.totalOrbitsAwarded || 1;
                                const pct = Math.round((cat.totalPoints / total) * 100);
                                return (
                                    <div key={cat.categoryId} className="space-y-1 text-xs">
                                        <div className="flex justify-between font-bold">
                                            <span className="text-neutral-800">{cat.categoryName}</span>
                                            <span className="font-black text-black">
                                                {cat.totalPoints} Orbits ({cat.awardCount} awards)
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-neutral-100 rounded-full border border-black overflow-hidden">
                                            <div
                                                className="h-full bg-[#FFE566] rounded-full"
                                                style={{ width: `${pct}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Top Recognized Members */}
                <div className="p-5 bg-white border-2 border-black rounded-2xl shadow-[4px_4px_0px_#000] space-y-4">
                    <div className="flex items-center gap-2 border-b-2 border-black pb-3">
                        <Trophy className="w-4 h-4 text-amber-500" />
                        <h4 className="text-sm font-black text-black">Top Recognized Teammates</h4>
                    </div>

                    <div className="space-y-2.5">
                        {analytics.topRecipients?.length === 0 ? (
                            <p className="text-xs font-bold text-neutral-500 text-center py-4">
                                No awards issued yet.
                            </p>
                        ) : (
                            analytics.topRecipients?.map((recip: any, idx: number) => (
                                <div
                                    key={recip.userId}
                                    className="p-2.5 bg-[#FAF6EE] border border-black rounded-xl flex items-center justify-between text-xs"
                                >
                                    <div className="flex items-center gap-2.5">
                                        <span className="w-6 h-6 rounded-full bg-white border border-black flex items-center justify-center font-black text-[10px]">
                                            #{idx + 1}
                                        </span>
                                        <div>
                                            <div className="font-black text-black">{recip.name || recip.username}</div>
                                            <div className="text-[10px] text-neutral-500 font-mono">
                                                @{recip.username}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="px-2.5 py-1 bg-[#FFE566] border border-black rounded-lg font-black text-xs shadow-neo-xxs">
                                        +{recip.totalPoints} Orbits
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
