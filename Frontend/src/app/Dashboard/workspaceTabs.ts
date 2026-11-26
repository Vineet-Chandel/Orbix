import type { SidebarTab } from "./Sidebar";

export function getWorkspaceTab(path: string): SidebarTab {
    if (path.includes("/college-clubs") || path.includes("/campus-clubs") || path === "/clubs" || path.startsWith("/clubs")) return "clubs";
    if (path.includes("/college-events") || path.includes("/college-event")) return "college-events";
    if (
        path.includes("/activity") ||
        path.includes("/applications") ||
        path.includes("/application") ||
        path.includes("/wallet") ||
        path.includes("/certificates") ||
        path.includes("/certificate")
    ) return "activity";
    if (path.includes("/explore")) return "explore";
    if (path.includes("/trends") || path.includes("/reports")) return "trends";
    if (path.includes("/notifications") || path.includes("/inbox")) return "notifications";
    if (path.includes("/profile")) return "profile";
    if (path.includes("/settings")) return "settings";
    if (path.includes("/resume")) return "resume";
    if (path.includes("/projects")) return "projects";
    if (path.includes("/blogs") || path.includes("/blog")) return "blogs";
    if (path.includes("/docs")) return "docs";
    if (path.includes("/onboarding") || path.includes("/connect")) return "connect-platform";
    if (path.includes("/leaderboard")) return "leaderboard";
    if (path.startsWith("/workspace")) return "workspace";
    return "dashboard";
}
