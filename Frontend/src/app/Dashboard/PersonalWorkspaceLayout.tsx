import { Suspense, useState } from "react";
import { preload } from "react-dom";
import { Outlet, useLocation } from "react-router-dom";
import { WorkspacePanelLoader } from "../../components/ui/loader/WorkspacePanelLoader";
import { Sidebar } from "./Sidebar";
import { getWorkspaceTab } from "./workspaceTabs";

export default function PersonalWorkspaceLayout() {
    const { pathname } = useLocation();
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    preload("/orbix-pixel-loader.svg", { as: "image" });

    return (
        <div className="flex h-screen w-full max-w-full min-w-0 bg-white text-neutral-900 overflow-hidden font-sans">
            <Sidebar
                activeTab={getWorkspaceTab(pathname)}
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden min-w-0">
                <Suspense fallback={
                    <div className="flex min-h-0 min-w-0 flex-1 p-2 sm:p-3">
                        <div className="flex min-w-0 flex-1 rounded-2xl border-2 border-black bg-[#FAF6EE] bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:18px_18px] shadow-[6px_6px_0px_#000]">
                            <WorkspacePanelLoader />
                        </div>
                    </div>
                }>
                    <Outlet context={() => setIsMobileSidebarOpen(true)} />
                </Suspense>
            </div>
        </div>
    );
}
