import React from 'react';
import { Link } from 'react-router-dom';
import {
    ArrowRight,
    ShieldCheck,
    Terminal,
    Heart,
} from 'lucide-react';

export const Footer: React.FC = () => {
    return (
        <footer className="relative w-full bg-[#FAF6EE] text-neutral-900 pt-12 sm:pt-16 pb-0 overflow-hidden font-sans select-none flex flex-col items-center">
            {/* Warm dot grid matching Orbix platform canvas */}
            <div className="absolute inset-0 bg-[radial-gradient(#d3cbbe_1.2px,transparent_1.2px)] [background-size:20px_20px] pointer-events-none -z-10 opacity-70" />

            {/* =========================================================================
                1. HERO CTA BANNER: Exact reproduction of user's uploaded banner
            ========================================================================= */}
            <div className="w-[96%] sm:w-[94%] max-w-[1550px] mx-auto relative z-10 mb-16 sm:mb-20">
                <div className="relative rounded-[24px] sm:rounded-[36px] bg-[#FFE566] border-2 border-black shadow-[8px_8px_0px_#000] p-8 sm:p-12 md:p-16 lg:p-20 overflow-hidden text-center flex flex-col items-center justify-center">
                    {/* Decorative subtle background concentric arcs on bottom left */}
                    <div className="absolute -left-16 -bottom-24 w-64 h-64 sm:w-80 sm:h-80 rounded-full border border-black/15 pointer-events-none" />
                    <div className="absolute -left-28 -bottom-36 w-88 h-88 sm:w-[420px] sm:h-[420px] rounded-full border border-dashed border-black/20 pointer-events-none" />
                    <div className="absolute -right-20 -top-24 w-72 h-72 rounded-full border border-dashed border-black/15 pointer-events-none" />

                    {/* Orbix Brand Logo Badge */}
                    <div className="absolute right-4 sm:right-8 md:right-12 lg:right-16 top-4 sm:top-6 md:top-1/2 md:-translate-y-1/2 z-10">
                        <div
                            className="w-20 h-20 sm:w-28 sm:h-28 md:w-36 md:h-36 lg:w-44 lg:h-44 rounded-full border-[3px] border-black bg-white p-3.5 sm:p-5 md:p-7 shadow-[5px_5px_0px_#000] flex items-center justify-center hover:scale-105 hover:rotate-6 transition-all duration-300 cursor-pointer"
                            title="Orbix"
                        >
                            <svg className="w-full h-full text-black" viewBox="0 0 271 270" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" fill="currentColor" />
                                <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" fill="currentColor" />
                                <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" fill="currentColor" />
                                <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" fill="currentColor" />
                                <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" fill="currentColor" />
                                <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" stroke="currentColor" />
                                <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" stroke="currentColor" />
                                <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" stroke="currentColor" />
                                <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" stroke="currentColor" />
                                <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" stroke="currentColor" />
                            </svg>
                        </div>
                    </div>

                    {/* Headline, Subtitle and Pill Button */}
                    <div className="relative z-10 max-w-2xl mx-auto space-y-4 sm:space-y-5 px-2">
                        <h2 className="text-3xl sm:text-5xl md:text-6xl lg:text-7xl font-black text-black tracking-tight leading-[1.08]">
                            Ready to connect
                            <br />
                            your coding world?
                        </h2>

                        <p className="text-neutral-900 font-medium text-sm sm:text-base md:text-lg max-w-md mx-auto leading-relaxed pt-1">
                            Turn scattered stats into one profile that speaks for you. Free to start.
                        </p>

                        <div className="pt-2 sm:pt-4">
                            <Link
                                to="/login"
                                className="inline-flex items-center gap-2.5 px-8 sm:px-10 py-3.5 sm:py-4 rounded-full bg-black text-white hover:bg-neutral-900 font-black text-sm sm:text-base border-2 border-black shadow-[3px_3px_0px_#000] hover:shadow-[5px_5px_0px_#000] hover:-translate-y-0.5 active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer group"
                            >
                                <span>Login / Sign up</span>
                                <ArrowRight className="w-4 h-4 text-white group-hover:translate-x-1.5 transition-transform stroke-[2.5]" />
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

            {/* =========================================================================
                2. MAIN NAVIGATION FOOTER: Comprehensive Neo-Brutalist Layout
            ========================================================================= */}
            <div className="w-[96%] sm:w-[94%] max-w-[1550px] mx-auto relative z-10 pb-12 sm:pb-16 border-t-2 border-black/15 pt-12 sm:pt-16">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
                    {/* Brand Column (Spans 4 cols on Desktop) */}
                    <div className="lg:col-span-4 space-y-6">
                        {/* Logo & Title */}
                        <Link to="/" className="inline-flex items-center gap-3 group">
                            <div className="w-10 h-10 rounded-xl bg-black text-white border-2 border-black shadow-[2px_2px_0px_#000] flex items-center justify-center group-hover:scale-105 transition-transform">
                                <svg className="w-7 h-7 text-white" viewBox="0 0 271 270" fill="none" xmlns="http://www.w3.org/2000/svg">
                                    <path d="M35.7546 229.323C26.0879 240.49 6.65458 262.923 6.25458 263.323L40.7546 233.823L35.7546 229.323Z" fill="currentColor" />
                                    <path d="M53.7546 205.823L48.2546 212.323L57.2546 221.323L65.2546 215.323C74.8231 211.374 80.0947 211.498 89.2546 217.823L150.255 269.323C151.599 269.664 151.792 269.3 151.255 267.823L100.255 208.823C94.2785 197.493 95.4056 191.535 102.255 181.323L166.255 110.323L158.755 102.823L88.7546 167.823C80.219 174.004 75.0339 175.364 64.7546 172.323L1.75458 118.823C0.567752 118.381 0.195533 118.445 0.754584 119.823L55.7546 184.823C57.7904 194.038 57.7027 198.753 53.7546 205.823Z" fill="currentColor" />
                                    <path d="M266.755 1.82346L187.255 76.3234L193.755 82.8234L268.255 3.32346C270.433 -0.184225 269.718 -0.104027 266.755 1.82346Z" fill="currentColor" />
                                    <path d="M14.7546 92.8234C14.1237 92.5691 13.9006 92.6957 13.7546 93.3234L27.2546 129.823L39.2546 108.823C44.2542 102.132 47.5956 98.6552 54.2546 92.8234C63.7668 85.9272 69.7421 82.7129 81.7546 78.3234C93.6331 75.5802 100.206 74.8392 111.755 74.8234C124.18 75.7502 131.191 77.6279 143.755 82.8234C155.92 89.3264 161.853 93.8621 170.755 103.323C177.919 111.853 181.514 116.726 186.255 125.823C191.462 138.675 193.486 145.476 194.255 156.323C194.64 167.269 194.277 173.22 192.255 183.323C188.262 193.355 186.286 197.749 183.255 204.323C178.472 212.881 175.344 217.107 168.755 223.323C157.882 232.721 151.699 237.453 140.255 243.323L145.755 249.823L159.755 243.323L177.255 232.323C185.967 224.954 190.539 220.533 196.755 210.823C201.571 203.377 204.319 197.806 209.255 186.823C212.123 176.505 213.158 170.313 213.755 158.323C214.403 146.976 213.413 140.502 210.255 128.823C206.613 116.388 204.342 109.646 196.755 97.8228C192.573 91.4961 189.255 89.3234 183.255 82.8234C177.255 76.3234 169.064 72.995 162.255 67.8234C152.88 62.2428 141.129 60.1925 129.255 57.3235C119.697 56.1358 114.09 56.2036 103.755 57.3235C89.4772 59.7228 82.1412 62.2062 69.7546 67.8234C59.8735 72.627 53.2546 77.3241 46.2546 84.3234C39.2546 91.3228 34.8186 95.658 28.7546 104.323C27.1776 106.06 26.1099 106.178 23.7546 104.323L14.7546 92.8234Z" fill="currentColor" />
                                    <path d="M22.2546 155.323L15.2546 148.823C15.018 156.006 15.0209 160.057 15.2546 167.323C17.8791 185.587 21.4392 195.175 31.7546 211.323C39.7971 222.376 44.9249 227.657 55.2546 235.323C70.367 245.366 78.9482 249.952 94.7546 253.323C105.628 254.844 111.413 255.025 121.255 254.323L113.255 247.823L95.2546 247.323C79.7836 244.684 71.1464 239.794 55.7546 229.823C46.036 221.441 41.3344 216.182 34.2546 205.823C25.8201 191.444 23.7142 181.22 22.2546 155.323Z" fill="currentColor" />
                                </svg>
                            </div>
                            <span className="text-2xl font-black tracking-tight text-black">
                                Orbix
                            </span>
                        </Link>

                        <p className="text-sm text-neutral-600 font-medium leading-relaxed max-w-sm">
                            The single source of truth for competitive programmers and software engineers. Syncing 16+ platforms, automated ratings, and national league standings.
                        </p>

                        {/* Live Sync Status Pill */}
                        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white border-2 border-black shadow-[2px_2px_0px_#000] text-xs font-black text-black">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 border border-black animate-pulse" />
                            <span>16 Platforms Live Synced</span>
                        </div>

                        {/* Social Buttons */}
                        <div className="flex items-center gap-2.5 pt-1">
                            <a
                                href="https://github.com/vineetchandel/Orbix"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-9 h-9 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 transition-all flex items-center justify-center text-black"
                                title="GitHub"
                            >
                                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                                    <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                                </svg>
                            </a>
                            <a
                                href="https://x.com/orbix_dev"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-9 h-9 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 transition-all flex items-center justify-center text-black"
                                title="Twitter / X"
                            >
                                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                                </svg>
                            </a>
                            <a
                                href="https://linkedin.com"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="w-9 h-9 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 transition-all flex items-center justify-center text-black"
                                title="LinkedIn"
                            >
                                <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
                                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
                                </svg>
                            </a>
                            <Link
                                to="/docs"
                                className="w-9 h-9 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000] hover:shadow-[3px_3px_0px_#000] hover:-translate-y-0.5 transition-all flex items-center justify-center text-black"
                                title="Developer CLI & API"
                            >
                                <Terminal className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>

                    {/* Nav Links Column 1: Product */}
                    <div className="lg:col-span-2 space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-wider text-black bg-[#FFE566] px-2.5 py-1 rounded-md border-2 border-black shadow-[1.5px_1.5px_0px_#000] inline-block">
                            Product
                        </h4>
                        <ul className="space-y-2 text-xs sm:text-sm font-bold text-neutral-700">
                            <li>
                                <Link to="/profile/u/Vineet-Chandel" className="hover:text-black hover:underline transition-colors">
                                    Live Public Profile
                                </Link>
                            </li>
                            <li>
                                <Link to="/auth/profiles" className="hover:text-black hover:underline transition-colors">
                                    Connect Platforms
                                </Link>
                            </li>
                            <li>
                                <Link to="/events" className="hover:text-black hover:underline transition-colors">
                                    Contest Radar
                                </Link>
                            </li>
                            <li>
                                <Link to="/leaderboard" className="hover:text-black hover:underline transition-colors">
                                    National CP League
                                </Link>
                            </li>
                            <li>
                                <Link to="/card" className="hover:text-black hover:underline transition-colors">
                                    Verified Cards
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Nav Links Column 2: Documentation */}
                    <div className="lg:col-span-2 space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-wider text-black bg-[#a2ff86] px-2.5 py-1 rounded-md border-2 border-black shadow-[1.5px_1.5px_0px_#000] inline-block">
                            Documentation
                        </h4>
                        <ul className="space-y-2 text-xs sm:text-sm font-bold text-neutral-700">
                            <li>
                                <Link to="/docs/supported-platform-registry" className="hover:text-black hover:underline transition-colors">
                                    Platform Registry
                                </Link>
                            </li>
                            <li>
                                <Link to="/docs/orbix-score-algorithm" className="hover:text-black hover:underline transition-colors">
                                    Score Algorithm
                                </Link>
                            </li>
                            <li>
                                <Link to="/docs" className="hover:text-black hover:underline transition-colors">
                                    Developer Docs Hub
                                </Link>
                            </li>
                            <li>
                                <Link to="/leaderboard" className="hover:text-black hover:underline transition-colors">
                                    AISHE Directory
                                </Link>
                            </li>
                            <li>
                                <Link to="/docs" className="hover:text-black hover:underline transition-colors">
                                    API & Webhooks
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Nav Links Column 3: Company */}
                    <div className="lg:col-span-2 space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-wider text-black bg-[#c4b5fd] px-2.5 py-1 rounded-md border-2 border-black shadow-[1.5px_1.5px_0px_#000] inline-block">
                            Company
                        </h4>
                        <ul className="space-y-2 text-xs sm:text-sm font-bold text-neutral-700">
                            <li>
                                <Link to="/customers" className="hover:text-black hover:underline transition-colors">
                                    Customers
                                </Link>
                            </li>
                            <li>
                                <Link to="/pricing" className="hover:text-black hover:underline transition-colors">
                                    Pricing Plans
                                </Link>
                            </li>
                            <li>
                                <Link to="/support" className="hover:text-black hover:underline transition-colors">
                                    24/7 Support Hub
                                </Link>
                            </li>
                            <li>
                                <Link to="/blogs" className="hover:text-black hover:underline transition-colors">
                                    Engineering Blog
                                </Link>
                            </li>
                            <li>
                                <Link to="/demo" className="hover:text-black hover:underline transition-colors">
                                    Demo Profile
                                </Link>
                            </li>
                        </ul>
                    </div>

                    {/* Nav Links Column 4: Trust & Security */}
                    <div className="lg:col-span-2 space-y-3">
                        <h4 className="text-xs font-black uppercase tracking-wider text-black bg-white px-2.5 py-1 rounded-md border-2 border-black shadow-[1.5px_1.5px_0px_#000] inline-block">
                            Trust & Security
                        </h4>
                        <ul className="space-y-2 text-xs sm:text-sm font-bold text-neutral-700">
                            <li className="flex items-center gap-1.5 text-neutral-800">
                                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                                <span>Zero Password Sync</span>
                            </li>
                            <li>
                                <Link to="/support" className="hover:text-black hover:underline transition-colors">
                                    Privacy Policy
                                </Link>
                            </li>
                            <li>
                                <Link to="/support" className="hover:text-black hover:underline transition-colors">
                                    Terms of Service
                                </Link>
                            </li>
                            <li>
                                <Link to="/support" className="hover:text-black hover:underline transition-colors">
                                    Security Disclosures
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                {/* Sub-footer Copyright Row */}
                <div className="mt-12 pt-6 border-t-2 border-black/15 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs font-bold text-neutral-600">
                    <p>
                        © 2026 Orbix Inc. All rights reserved. Engineered for high-velocity coders.
                    </p>
                    <div className="flex items-center gap-2">
                        <span>Crafted with</span>
                        <Heart className="w-3.5 h-3.5 text-rose-500 fill-rose-500" />
                        <span>for the global competitive programming community.</span>
                    </div>
                </div>
            </div>

            {/* =========================================================================
                3. FULL SCREEN WIDTH DESK IMAGE AT THE VERY BOTTOM OF THE PAGE
            ========================================================================= */}
            <div className="w-full relative mt-2 sm:mt-4 overflow-hidden bg-transparent select-none pointer-events-none">
                <img
                    src="/image.png"
                    alt="Orbix Developer Desk"
                    className="w-full h-auto min-h-[140px] sm:min-h-[220px] md:min-h-[280px] lg:min-h-[340px] xl:min-h-[400px] object-cover object-bottom block"
                />
            </div>
        </footer>
    );
};

export default Footer;
