import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import Right from "./Right";

interface AuthLayoutProps {
    title: string;
    subtitle: string;
    trigger: boolean; // true for SignInBanner, false for SignUpBanner
    children: ReactNode;
    switchText: string;
    switchLinkText: string;
    switchLinkHref: string;
}

export const AuthLayout = ({
    title,
    subtitle,
    trigger,
    children,
    switchText,
    switchLinkText,
    switchLinkHref,
}: AuthLayoutProps) => {
    return (
        <div className="min-h-screen w-full bg-white flex flex-col lg:flex-row overflow-hidden text-neutral-900 font-sans selection:bg-neutral-900 selection:text-white">
            {/* Left Column: Clean White Form Panel */}
            <div className="w-full lg:w-[55%] xl:w-[52%] min-h-[100svh] lg:h-screen overflow-y-auto relative flex flex-col justify-between p-6 sm:p-10 lg:p-14 order-1 custom-scrollbar bg-white">
                {/* Top Nav: Back to Home on the left side */}
                <div className="flex items-center mb-4 sm:mb-6">
                    <Link
                        to="/"
                        className="group inline-flex items-center gap-1.5 text-xs font-medium text-neutral-500 hover:text-neutral-950 transition-colors py-1.5 px-3 rounded-full hover:bg-neutral-100"
                    >
                        <svg className="w-3.5 h-3.5 transition-transform duration-200 group-hover:-translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="19" y1="12" x2="5" y2="12" />
                            <polyline points="12 19 5 12 12 5" />
                        </svg>
                        <span>Home</span>
                    </Link>
                </div>

                {/* Center Form Container */}
                <div className="w-full max-w-[490px] mx-auto my-auto py-2">
                    {/* Header Heading matching user screenshot */}
                    <div className="mb-8 text-center">
                        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-neutral-950">
                            {title}
                        </h1>
                        <p className="mt-2.5 text-xs sm:text-sm text-neutral-500 leading-relaxed max-w-sm mx-auto">
                            {subtitle}
                        </p>
                    </div>

                    {/* Main Form Fields */}
                    <div className="space-y-4">
                        {children}
                    </div>

                    {/* Divider 'or continue with' matching user screenshot */}
                    <div className="relative my-6 text-center">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-neutral-200" />
                        </div>
                        <span className="relative bg-white px-3 text-xs text-neutral-500 font-medium">
                            or continue with
                        </span>
                    </div>

                    {/* Social Media Login Circles matching user screenshot: Google, Apple, Facebook */}
                    <div className="flex items-center justify-center gap-4">
                        {/* Google */}
                        <button
                            type="button"
                            onClick={() => alert("Google sign-in will be available soon.")}
                            className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white hover:bg-neutral-800 transition-transform hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
                            aria-label="Continue with Google"
                        >
                            <span className="font-bold text-lg leading-none font-serif">G</span>
                        </button>

                        {/* Apple */}
                        <button
                            type="button"
                            onClick={() => alert("Apple sign-in will be available soon.")}
                            className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white hover:bg-neutral-800 transition-transform hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
                            aria-label="Continue with Apple"
                        >
                            <svg className="h-5 w-5 fill-current" viewBox="0 0 170 170">
                                <path d="M150.37 130.25c-2.45 5.66-5.35 10.87-8.71 15.66-4.58 6.53-8.33 11.05-11.22 13.56-4.48 4.12-9.28 6.23-14.42 6.35-3.69 0-8.14-1.05-13.32-3.18-5.19-2.12-9.97-3.17-14.34-3.17-4.58 0-9.49 1.05-14.75 3.17-5.26 2.13-9.5 3.24-12.74 3.35-4.35.13-9.16-1.9-14.42-6.08-3.69-3.04-7.69-7.85-12.01-14.42-6.53-9.9-11.75-21.11-15.66-33.64-3.92-12.53-5.88-24.16-5.88-34.9 0-14.58 3.69-26.77 11.07-36.56 7.38-9.79 16.75-14.78 28.11-14.98 5.66 0 11.45 1.52 17.37 4.56 5.92 3.04 9.94 4.62 12.06 4.75 1.76-.24 5.96-1.92 12.61-5.04 6.65-3.12 12.62-4.52 17.91-4.2 13.43.95 24.08 5.93 31.94 14.94-11.73 7.15-17.47 16.94-17.21 29.37.26 9.87 4.16 18.06 11.7 24.58 7.54 6.52 16.51 10.15 26.92 10.89-2.22 6.69-4.87 13.58-7.95 20.67zM119.22 31.81c0-7.39 2.67-14.37 8-20.93 5.33-6.56 12.03-10.88 20.1-12.96.48 1.44.72 2.96.72 4.56 0 7.39-2.73 14.54-8.19 21.45-5.46 6.91-12.33 11.23-20.63 12.96V31.81z" />
                            </svg>
                        </button>

                        {/* Facebook */}
                        <button
                            type="button"
                            onClick={() => alert("Facebook sign-in will be available soon.")}
                            className="flex h-12 w-12 items-center justify-center rounded-full bg-black text-white hover:bg-neutral-800 transition-transform hover:scale-105 active:scale-95 shadow-sm cursor-pointer"
                            aria-label="Continue with Facebook"
                        >
                            <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
                                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
                            </svg>
                        </button>
                    </div>

                    {/* Switch Link matching screenshot styling (green accent) */}
                    <div className="mt-8 text-center text-sm text-neutral-800">
                        <span>{switchText}</span>{" "}
                        <Link
                            to={switchLinkHref}
                            className="font-semibold text-[#3b7a57] hover:text-emerald-700 hover:underline transition-colors ml-1"
                        >
                            {switchLinkText}
                        </Link>
                    </div>
                </div>

                {/* Footer copyright */}
                <div className="mt-6 pt-4 border-t border-neutral-100 flex flex-col sm:flex-row items-center justify-between text-xs text-neutral-400 gap-2">
                    <p>© {new Date().getFullYear()} Orbix Inc. All rights reserved.</p>
                    <div className="flex gap-3 text-neutral-500">
                        <a href="#privacy" className="hover:text-neutral-900 transition-colors">Privacy</a>
                        <span>•</span>
                        <a href="#terms" className="hover:text-neutral-900 transition-colors">Terms</a>
                    </div>
                </div>
            </div>

            {/* Right Column: Visual Pixel Banner */}
            <div className="hidden lg:block lg:w-[45%] xl:w-[48%] h-screen border-[15px] border-black order-2 relative overflow-hidden bg-black">
                <div className="w-full h-full relative">
                    <Right trigger={trigger} />
                </div>
            </div>
        </div>
    );
};
