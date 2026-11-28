import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link, matchPath, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Check } from "lucide-react";

export interface DockItem {
    id: string;
    label: string;
    icon: ReactNode;
    path?: string;
    action?: () => void;
    badge?: string | number;
    badgeVariant?: "danger" | "default";
    color: string;
    current?: boolean;
}

export interface DockTab {
    id: string;
    label: string;
    icon: ReactNode;
    shaderColor: string;
    path?: string;
    items?: DockItem[];
    badge?: number | string;
}

interface MobileNavigationDockProps {
    tabs: DockTab[];
    currentTab: string;
    onItemSelect?: (item: { id: string; path?: string }) => void;
    layerClassName?: string;
}

export function MobileNavigationDock({
    tabs,
    currentTab,
    onItemSelect,
    layerClassName = "z-[9991]",
}: MobileNavigationDockProps) {
    const { pathname, search } = useLocation();
    const navigate = useNavigate();
    const route = pathname + search;
    const [menu, setMenu] = useState<{ route: string; tabId: string | null }>({ route, tabId: null });
    const openMenu = menu.route === route ? menu.tabId : null;
    if (menu.route !== route) setMenu({ route, tabId: null });
    const menuTrigger = useRef<HTMLButtonElement | null>(null);
    const focusMenuOnOpen = useRef(false);
    const activeTab = tabs.find((tab) => tab.id === openMenu && tab.items);
    const activeMenu = activeTab?.id;
    const highlightedTab = activeMenu ?? currentTab;

    useEffect(() => {
        const desktop = window.matchMedia("(min-width: 1024px)");
        const handleResize = () => {
            if (desktop.matches) setMenu((current) => ({ ...current, tabId: null }));
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key !== "Escape" || !menuTrigger.current) return;
            const trigger = menuTrigger.current;
            if (trigger.closest("nav")?.contains(document.activeElement)) trigger.focus();
            menuTrigger.current = null;
            setMenu((current) => ({ ...current, tabId: null }));
        };
        desktop.addEventListener("change", handleResize);
        window.addEventListener("keydown", handleKeyDown);
        return () => {
            desktop.removeEventListener("change", handleResize);
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, []);

    useEffect(() => {
        if (!openMenu) menuTrigger.current = null;
    }, [openMenu]);

    const handleTabClick = (tab: DockTab, trigger: HTMLButtonElement, fromKeyboard: boolean) => {
        if (tab.items) {
            menuTrigger.current = trigger;
            focusMenuOnOpen.current = fromKeyboard && openMenu !== tab.id;
            setMenu({ route, tabId: openMenu === tab.id ? null : tab.id });
        } else if (tab.path) {
            setMenu((current) => ({ ...current, tabId: null }));
            navigate(tab.path);
            onItemSelect?.(tab);
        }
    };

    if (typeof document === "undefined") return null;

    return createPortal(
        <div className={`pointer-events-none fixed inset-0 lg:hidden ${layerClassName}`}>
            <AnimatePresence>
                {activeMenu && (
                    <motion.div
                        key="navigation-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={() => setMenu((current) => ({ ...current, tabId: null }))}
                        className="pointer-events-auto absolute inset-0 bg-black/50"
                    />
                )}
            </AnimatePresence>

            <nav
                id="orbix-mobile-bottom-nav"
                aria-label="Mobile navigation"
                className="pointer-events-auto absolute bottom-[var(--mobile-dock-bottom)] inset-x-0 mx-auto w-[calc(100%-1.5rem)] max-w-md"
            >
                <AnimatePresence>
                    {activeMenu && (
                        <motion.div
                            key={activeMenu}
                            id={`orbix-mobile-navigation-menu-${activeMenu}`}
                            ref={(menu) => {
                                if (!menu || !focusMenuOnOpen.current) return;
                                focusMenuOnOpen.current = false;
                                menu.querySelector<HTMLElement>("a, button")?.focus();
                            }}
                            initial={{ opacity: 0, scale: 0.97 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.97 }}
                            transition={{ duration: 0.15 }}
                            className="absolute bottom-[calc(100%+0.75rem)] inset-x-0 grid max-h-[50dvh] grid-cols-2 gap-2 overflow-y-auto rounded-2xl border-2 border-black bg-[#FAF6EE] p-2.5 shadow-[4px_4px_0px_#000]"
                        >
                            {(activeTab?.items ?? []).map((item) => {
                                const isCurrent = item.current ?? (item.path && matchPath({ path: item.path, end: false }, pathname));
                                const itemProps = {
                                    className: "flex min-h-12 min-w-0 items-center gap-2 rounded-xl border-2 border-black bg-white px-2 py-1.5 text-left text-xs font-black text-black shadow-[2px_2px_0px_#000] hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black aria-[current=page]:bg-[#a2ff86]",
                                    "aria-current": isCurrent ? "page" as const : undefined,
                                    onClick: () => {
                                        setMenu((current) => ({ ...current, tabId: null }));
                                        item.action?.();
                                        onItemSelect?.(item);
                                    },
                                };
                                const content = (
                                    <>
                                        <span
                                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-black"
                                            style={{ backgroundColor: item.color }}
                                        >
                                            {item.icon}
                                        </span>
                                        <span className="min-w-0 flex-1 break-words">{item.label}</span>
                                        {item.badge !== undefined && (
                                            <span className={`shrink-0 rounded-full border border-black px-1 text-[10px] ${item.badgeVariant === "danger" ? "bg-[#FF6B6B]" : "bg-[#FFE566]"}`}>
                                                {item.badge}
                                            </span>
                                        )}
                                        {isCurrent && <Check aria-hidden="true" className="h-4 w-4 shrink-0 stroke-[3]" />}
                                    </>
                                );
                                return item.path ? (
                                    <Link key={item.id} to={item.path} {...itemProps}>{content}</Link>
                                ) : (
                                    <button key={item.id} type="button" {...itemProps}>{content}</button>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Main 5-Option Toggle Dock Bar with Moving Shader */}
                <div className="grid h-[var(--mobile-dock-height)] grid-cols-5 gap-1 rounded-2xl border-2 border-black bg-[#FAF6EE] p-1.5 shadow-[4px_4px_0px_#000]">
                    {tabs.map((tab) => {
                        const isActive = highlightedTab === tab.id;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={(event) => handleTabClick(tab, event.currentTarget, event.detail === 0)}
                                className="relative flex min-w-0 flex-col items-center justify-center rounded-xl border border-black bg-white text-black shadow-[2px_2px_0px_#000] transition-transform active:scale-95 focus-visible:z-20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                                aria-label={tab.label}
                                aria-controls={activeMenu === tab.id ? `orbix-mobile-navigation-menu-${tab.id}` : undefined}
                                aria-current={isActive && !activeMenu && !tab.items ? "page" : undefined}
                                aria-expanded={tab.items ? activeMenu === tab.id : undefined}
                            >
                                {/* Moving Shader / Active Pill Indicator */}
                                {isActive && (
                                    <motion.div
                                        layoutId="mobileNavShader"
                                        className="absolute inset-0 rounded-[inherit] pointer-events-none"
                                        style={{ backgroundColor: tab.shaderColor }}
                                        transition={{
                                            type: "spring",
                                            stiffness: 480,
                                            damping: 32,
                                        }}
                                    />
                                )}

                                {/* Icon and Text Content */}
                                <div
                                    className={`relative z-10 flex flex-col items-center justify-center transition-colors duration-150 ${
                                        isActive
                                            ? "text-black font-black"
                                            : "text-neutral-700 hover:text-black font-bold"
                                    }`}
                                >
                                    <div className="relative flex items-center justify-center">
                                        {tab.icon}
                                        {tab.badge !== undefined && (
                                            <span className="absolute -top-1 -right-2 z-20 px-1 h-3.5 min-w-[14px] flex items-center justify-center rounded-full text-[8.5px] font-black bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000] leading-none pointer-events-none">
                                                {tab.badge}
                                            </span>
                                        )}
                                    </div>
                                    <span className="text-[10px] tracking-tight mt-0.5 leading-none">
                                        {tab.label}
                                    </span>
                                </div>
                            </button>
                        );
                    })}
                </div>
            </nav>
        </div>,
        document.body
    );
}
