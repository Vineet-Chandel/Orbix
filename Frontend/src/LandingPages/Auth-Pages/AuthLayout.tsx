import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { useToast } from "../../context/ToastContext";
import Right from "./Right";

interface AuthLayoutProps {
    title: string;
    subtitle: string;
    trigger: boolean; // true for SignInBanner, false for SignUpBanner
    children: ReactNode;
    switchText: string;
    switchLinkText: string;
    switchLinkHref: string;
    showSocialAuth?: boolean;
    wide?: boolean;
}

export const AuthLayout = ({
    title,
    subtitle,
    trigger,
    children,
    switchText,
    switchLinkText,
    switchLinkHref,
    showSocialAuth = true,
    wide = false,
}: AuthLayoutProps) => {
    const toast = useToast();
    return (
        <div className="min-h-screen w-full bg-[#FAF6EE] flex flex-col lg:flex-row overflow-hidden text-neutral-900 font-sans selection:bg-black selection:text-white relative">
            {/* Eye-friendly subtle canvas dot grid across the entire page flow */}
            <div className="fixed inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

            {/* Left Column: Neo-Brutalist Form Panel */}
            <div className={`w-full ${wide ? "lg:w-[60%] xl:w-[58%]" : "lg:w-[55%] xl:w-[52%]"} min-h-[100svh] lg:h-screen overflow-y-auto relative flex flex-col justify-between p-4 sm:p-7 lg:p-10 order-1 scrollbar-none transition-all duration-200`}>
                {/* Top Nav: Back to Home */}
                <div className="flex items-center mb-4 sm:mb-6">
                    <Link
                        to="/"
                        className="group inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white text-black font-black text-xs sm:text-sm border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                        title="Back to Homepage"
                    >
                        <svg className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-0.5 stroke-[2.5]" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        <span>Home</span>
                    </Link>
                </div>

                {/* Center Form Container */}
                <div className={`w-full ${wide ? "max-w-2xl xl:max-w-3xl" : "max-w-[490px]"} mx-auto my-auto py-2 transition-all duration-200`}>
                    {/* Header Heading matching landing page neo-brutalist theme */}
                    <div className="mb-7 text-center">
                        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] mb-3.5 select-none bg-white text-black">
                            <span className="w-2 h-2 rounded-full bg-[#FFE566] border border-black" />
                            <span>{trigger ? "Welcome Back" : "Get Started Free"}</span>
                        </div>

                        <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-black tracking-tight text-black leading-tight">
                            {title}
                        </h1>
                        <p className={`mt-2.5 text-xs sm:text-sm text-neutral-700 font-medium leading-relaxed ${wide ? "max-w-xl" : "max-w-sm"} mx-auto`}>
                            {subtitle}
                        </p>
                    </div>

                    {/* Main Form Fields */}
                    <div className="space-y-4">
                        {children}
                    </div>

                    {/* Divider 'or continue with' and Social Media Login Circles (Personal mode only) */}
                    {showSocialAuth && (
                        <>
                            <div className="relative my-6 text-center">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t-2 border-black/15" />
                                </div>
                                <span className="relative bg-[#FAF6EE] px-4 text-xs font-black uppercase tracking-wider text-neutral-600">
                                    or continue with
                                </span>
                            </div>

                            <div className="flex items-center justify-center gap-4">
                                {/* Google */}
                                <button
                                    type="button"
                                    onClick={() => toast.info("Google sign-in will be available soon.", { title: "Coming Soon" })}
                                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                                    aria-label="Continue with Google"
                                    title="Continue with Google"
                                >
                                    <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
                                        <path
                                            fill="#4285F4"
                                            d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.66v3.05h3.87c2.26-2.09 3.675-5.17 3.675-9.15z"
                                        />
                                        <path
                                            fill="#34A853"
                                            d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3.05c-1.08.72-2.45 1.16-4.06 1.16-3.13 0-5.78-2.11-6.73-4.96H1.24v3.15C3.26 21.36 7.34 24 12 24z"
                                        />
                                        <path
                                            fill="#FBBC05"
                                            d="M5.27 14.24c-.25-.72-.38-1.49-.38-2.24s.13-1.52.38-2.24V6.61H1.24C.45 8.18 0 9.99 0 12s.45 3.82 1.24 5.39l4.03-3.15z"
                                        />
                                        <path
                                            fill="#EA4335"
                                            d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.24 6.61l4.03 3.15c.95-2.85 3.6-4.96 6.73-4.96z"
                                        />
                                    </svg>
                                </button>

                                {/* GitHub */}
                                <button
                                    type="button"
                                    onClick={() => toast.info("GitHub sign-in will be available soon.", { title: "Coming Soon" })}
                                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                                    aria-label="Continue with GitHub"
                                    title="Continue with GitHub"
                                >
                                    <svg className="w-5 h-5 fill-black flex-shrink-0" viewBox="0 0 24 24">
                                        <path
                                            fillRule="evenodd"
                                            clipRule="evenodd"
                                            d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z"
                                        />
                                    </svg>
                                </button>

                                {/* Apple */}
                                <button
                                    type="button"
                                    onClick={() => toast.info("Apple sign-in will be available soon.", { title: "Coming Soon" })}
                                    className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-black border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[4px_4px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                                    aria-label="Continue with Apple"
                                    title="Continue with Apple"
                                >
                                    <svg className="w-5 h-5 fill-black flex-shrink-0" viewBox="0 0 24 24">
                                        <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.8c.67-.82 1.13-1.96 1.01-3.1-.98.04-2.16.65-2.86 1.47-.61.71-1.15 1.87-1.01 2.98 1.1.09 2.2-.54 2.86-1.35z" />
                                    </svg>
                                </button>
                            </div>
                        </>
                    )}

                    {/* Switch Link matching landing page neo-brutalist theme */}
                    <div className="mt-7 text-center text-xs sm:text-sm font-bold text-neutral-800">
                        <span>{switchText}</span>{" "}
                        <Link
                            to={switchLinkHref}
                            className="font-black text-black underline underline-offset-2 hover:text-emerald-700 transition-colors ml-1"
                        >
                            {switchLinkText}
                        </Link>
                    </div>
                </div>

                {/* Footer copyright */}
                <div className="mt-6 pt-4 border-t-2 border-black/10 flex flex-col sm:flex-row items-center justify-between text-xs font-semibold text-neutral-600 gap-2">
                    <p>© {new Date().getFullYear()} Orbix Inc. All rights reserved.</p>
                    <div className="flex gap-3 text-neutral-800 font-bold">
                        <a href="#privacy" className="hover:text-black hover:underline transition-colors">Privacy</a>
                        <span>•</span>
                        <a href="#terms" className="hover:text-black hover:underline transition-colors">Terms</a>
                    </div>
                </div>
            </div>

            {/* Right Column: Visual Pixel Banner */}
            <div className={`hidden lg:block ${wide ? "lg:w-[40%] xl:w-[42%]" : "lg:w-[45%] xl:w-[48%]"} h-screen border-[15px] border-black order-2 relative overflow-hidden bg-black shadow-[-6px_0px_0px_#000] transition-all duration-200`}>
                <div className="w-full h-full relative">
                    <Right trigger={trigger} />
                </div>
            </div>
        </div>
    );
};
