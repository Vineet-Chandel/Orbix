import React from "react";
import { Globe } from "lucide-react";

export interface PlatformLinkItem {
    id?: string;
    label: string;
    url: string;
    platform?: string;
}

export interface PlatformDefinition {
    id: string;
    name: string;
    domains: string[];
    aliases?: string[];
    color: string;
    icon: (className?: string) => React.ReactNode;
}

// Full Platform Registry with authentic Brand Logos
export const PLATFORM_REGISTRY: PlatformDefinition[] = [
    {
        id: "linkedin",
        name: "LinkedIn",
        domains: ["linkedin.com", "www.linkedin.com"],
        aliases: ["linkedin"],
        color: "#0A66C2",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#0A66C2">
                <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.46 10.9h2.79v8.37H6.46v-8.37M7.86 6.78a1.62 1.62 0 1 0 0 3.24 1.62 1.62 0 0 0 0-3.24z" />
            </svg>
        ),
    },
    {
        id: "github",
        name: "GitHub",
        domains: ["github.com", "www.github.com"],
        aliases: ["github"],
        color: "#ffffff",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2Z" />
            </svg>
        ),
    },
    {
        id: "gitlab",
        name: "GitLab",
        domains: ["gitlab.com"],
        aliases: ["gitlab"],
        color: "#FC6D26",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#FC6D26">
                <path d="m23.6 9.89-1.06-3.28a.87.87 0 0 0-1.65 0L19.83 10H4.17L3.11 6.61a.87.87 0 0 0-1.65 0L.4 9.89a1.73 1.73 0 0 0 .63 1.93l10.45 7.6a.88.88 0 0 0 1 0l10.49-7.6a1.73 1.73 0 0 0 .63-1.93Z" />
            </svg>
        ),
    },
    {
        id: "bitbucket",
        name: "Bitbucket",
        domains: ["bitbucket.org"],
        aliases: ["bitbucket"],
        color: "#0052CC",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#0052CC">
                <path d="M.75 2.5A.75.75 0 0 0 0 3.37l3.6 16.9a2.25 2.25 0 0 0 2.2 1.78h12.4a2.25 2.25 0 0 0 2.2-1.78L24 3.37a.75.75 0 0 0-.75-.87H.75Zm13.2 12.8H10.1l-1.2-6.4h6.2l-1.15 6.4Z" />
            </svg>
        ),
    },
    {
        id: "leetcode",
        name: "LeetCode",
        domains: ["leetcode.com", "leetcode.cn"],
        aliases: ["leetcode"],
        color: "#FFA116",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#FFA116">
                <path d="M13.483 0a1.37 1.37 0 0 0-.961.438L7.116 6.226l-3.854 4.126a5.3 5.3 0 0 0-1.209 2.104a5 5 0 0 0-.125.513a5.5 5.5 0 0 0 .062 2.362a6 6 0 0 0 .349 1.017a5.9 5.9 0 0 0 1.271 1.818l4.277 4.193l.039.038c2.248 2.165 5.852 2.133 8.063-.074l2.396-2.392c.54-.54.54-1.414.003-1.955a1.38 1.38 0 0 0-1.951-.003l-2.396 2.392a3.02 3.02 0 0 1-4.205.038l-.02-.019l-4.276-4.193c-.652-.64-.972-1.469-.948-2.263a2.7 2.7 0 0 1 .066-.523a2.55 2.55 0 0 1 .619-1.164L9.13 8.114c1.058-1.134 3.204-1.27 4.43-.278l3.501 2.831c.593.48 1.461.387 1.94-.207a1.384 1.384 0 0 0-.207-1.943l-3.5-2.831c-.8-.647-1.766-1.045-2.774-1.202l2.015-2.158A1.384 1.384 0 0 0 13.483 0m-2.866 12.815a1.38 1.38 0 0 0-1.38 1.382a1.38 1.38 0 0 0 1.38 1.382H20.79a1.38 1.38 0 0 0 1.38-1.382a1.38 1.38 0 0 0-1.38-1.382z" />
            </svg>
        ),
    },
    {
        id: "codeforces",
        name: "Codeforces",
        domains: ["codeforces.com"],
        aliases: ["codeforces", "cf"],
        color: "#1F8ACB",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 20 18" fill="none">
                <path d="M13 1.5C13 0.672 12.328 0 11.5 0H8.5C7.673 0 7 0.672 7 1.5V16.5C7 17.328 7.673 18 8.5 18H11.5C12.328 18 13 17.328 13 16.5V1.5Z" fill="#00C0E8" />
                <path d="M6 5.5C6 4.672 5.328 4 4.5 4H1.5C0.673 4 0 4.672 0 5.5V16C0 16.828 0.673 17.5 1.5 17.5H4.5C5.328 17.5 6 16.828 6 16V5.5Z" fill="#FFCC00" />
                <path d="M20 9.5C20 8.948 19.328 8.5 18.5 8.5H15.5C14.673 8.5 14 8.948 14 9.5V16.5C14 17.052 14.673 17.5 15.5 17.5H18.5C19.328 17.5 20 17.052 20 16.5V9.5Z" fill="#FF383C" />
            </svg>
        ),
    },
    {
        id: "codechef",
        name: "CodeChef",
        domains: ["codechef.com"],
        aliases: ["codechef"],
        color: "#5B4638",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#5B4638">
                <path d="M11.257.004q-.554.014-1.1.095c-.54.054-1.08.325-1.675.595c-.757.324-1.515.649-2.218.703c-1.19.378-1.568.919-1.892 1.351c0 .054-.054.108-.054.108c-.433.865-.487 1.73-.325 2.595c.162.541.378 1.029.54 1.515c.38 1.028.758 2 .92 3.136c.163.325.324.757.432 1.19c.27.865.542 1.838 1.353 2.595l.006-.003c.017.019.03.04.048.057l.021-.01l-.02-.584c.648-.974 1.566-1.623 2.864-1.893c.52-.11 1.081-.15 1.663-.128a8.8 8.8 0 0 1 1.798.236c1.46.378 2.595 1.136 2.65 1.785c.027.354.04.695.032 1.036q-.001.096-.007.193l.136.068a.64.64 0 0 0 .206-.19l.003-.003l.006-.008c.04-.054.075-.124.11-.194c.02-.037.038-.086.056-.129c.205-.462.362-1.153.538-1.963c.054-.27.11-.487.163-.703c.433-.973 1.027-1.838 1.622-2.65c.973-1.35 1.892-2.595 1.784-4.055c-1.784-3.461-4.272-4.002-5.57-4.272c-.216-.054-.323-.054-.485-.108c-1.338-.244-2.494-.396-3.605-.365" />
            </svg>
        ),
    },
    {
        id: "geeksforgeeks",
        name: "GeeksforGeeks",
        domains: ["geeksforgeeks.org", "practice.geeksforgeeks.org"],
        aliases: ["gfg", "geeksforgeeks"],
        color: "#2F8D46",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#2F8D46">
                <path d="M21.45 14.315c-.143.28-.334.532-.565.745a3.691 3.691 0 0 1-1.104.695 4.51 4.51 0 0 1-3.116-.016 3.79 3.79 0 0 1-2.135-2.078 3.571 3.571 0 0 1-.13-.353h7.418a4.26 4.26 0 0 1-.368 1.008zm-11.99-.654a3.793 3.793 0 0 1-2.134 2.078 4.51 4.51 0 0 1-3.117.016 3.7 3.7 0 0 1-1.104-.695 2.652 2.652 0 0 1-.564-.745 4.221 4.221 0 0 1-.368-1.006H9.59c-.038.12-.08.238-.13.352z" />
            </svg>
        ),
    },
    {
        id: "hackerrank",
        name: "HackerRank",
        domains: ["hackerrank.com"],
        aliases: ["hackerrank"],
        color: "#00EA64",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#00EA64">
                <path d="M0 0v24h24V0zm9.95 8.002h1.805c.061 0 .111.05.111.111v7.767c0 .061-.05.111-.11.111H9.95a.11.11 0 0 1-.111-.11v-2.87H7.894v2.87c0 .06-.05.11-.11.11H5.976a.11.11 0 0 1-.11-.11V8.112c0-.06.05-.11.11-.11h1.806c.061 0 .11.05.11.11v2.869H9.84v-2.87c0-.06.05-.11.11-.11zm2.999 0h5.778c.061 0 .111.05.111.11v7.767a.11.11 0 0 1-.11.112h-5.78a.11.11 0 0 1-.11-.11v-7.77c0-.06.05-.11.11-.11z" />
            </svg>
        ),
    },
    {
        id: "hackerearth",
        name: "HackerEarth",
        domains: ["hackerearth.com"],
        aliases: ["hackerearth"],
        color: "#2C3454",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#3253DC">
                <path d="M2.4 2h4.8v8.4h9.6V2h4.8v20h-4.8v-7.2H7.2V22H2.4V2Z" />
            </svg>
        ),
    },
    {
        id: "atcoder",
        name: "AtCoder",
        domains: ["atcoder.jp"],
        aliases: ["atcoder"],
        color: "#222222",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2 1.5 20.5h21L12 2Zm0 5.4 6 10.6H6l6-10.6Z" />
            </svg>
        ),
    },
    {
        id: "kaggle",
        name: "Kaggle",
        domains: ["kaggle.com"],
        aliases: ["kaggle"],
        color: "#20BEFF",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#20BEFF">
                <path d="M18.825 23.859c-.022.09-.117.141-.281.141h-3.139a.7.7 0 0 1-.58-.291l-4.99-6.425-1.579 1.516v4.739c0 .324-.15.461-.462.461H5.163c-.324 0-.462-.137-.462-.461V.461C4.7.138 4.839 0 5.163 0h2.631c.312 0 .462.138.462.461v14.471l6.236-6.289a.8.8 0 0 1 .58-.242h3.292c.164 0 .258.05.281.14.024.114-.023.208-.14.282l-6.84 6.7 7.056 8.055c.117.07.164.164.14.281Z" />
            </svg>
        ),
    },
    {
        id: "huggingface",
        name: "Hugging Face",
        domains: ["huggingface.co"],
        aliases: ["huggingface", "hf"],
        color: "#FFD21E",
        icon: (className = "w-3.5 h-3.5") => (
            <span className={`inline-flex items-center justify-center leading-none text-[13px] ${className}`}>
                🤗
            </span>
        ),
    },
    {
        id: "stackoverflow",
        name: "Stack Overflow",
        domains: ["stackoverflow.com"],
        aliases: ["stackoverflow"],
        color: "#F48024",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#F48024">
                <path d="M18.986 21.865v-6.404h2.134V24H2.88v-8.539h2.134v6.404h13.972zM6.92 16.516l10.02 2.096.438-2.091-10.02-2.096-.438 2.091zm1.616-5.066l9.141 4.542.92-1.85-9.141-4.543-.92 1.851zm3.177-4.81l7.358 7.028 1.442-1.511-7.358-7.028-1.442 1.511zm5.986-5.594l-1.815 1.127 5.422 8.638 1.815-1.127-5.422-8.638zM6.16 20.73h10.24v-2.134H6.16v2.134z" />
            </svg>
        ),
    },
    {
        id: "x",
        name: "X",
        domains: ["x.com", "twitter.com"],
        aliases: ["x", "twitter"],
        color: "#ffffff",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
            </svg>
        ),
    },
    {
        id: "youtube",
        name: "YouTube",
        domains: ["youtube.com", "youtu.be"],
        aliases: ["youtube"],
        color: "#FF0000",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#FF0000">
                <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
            </svg>
        ),
    },
    {
        id: "instagram",
        name: "Instagram",
        domains: ["instagram.com"],
        aliases: ["instagram"],
        color: "#E4405F",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#E4405F">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zm0 10.162a3.999 3.999 0 1 1 0-7.998 3.999 3.999 0 0 1 0 7.998zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
            </svg>
        ),
    },
    {
        id: "discord",
        name: "Discord",
        domains: ["discord.com", "discord.gg"],
        aliases: ["discord"],
        color: "#5865F2",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#5865F2">
                <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.893.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
        ),
    },
    {
        id: "reddit",
        name: "Reddit",
        domains: ["reddit.com"],
        aliases: ["reddit"],
        color: "#FF4500",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#FF4500">
                <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701z" />
            </svg>
        ),
    },
    {
        id: "telegram",
        name: "Telegram",
        domains: ["t.me", "telegram.org"],
        aliases: ["telegram"],
        color: "#26A5E4",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#26A5E4">
                <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.666 8.35-1.9 8.95c-.14.64-.52.8-.06.8-.75.46-1.39.2-2.15-.35l-3.32-2.45-1.6 1.54c-.18.18-.33.33-.67.33l.24-3.39 6.17-5.57c.27-.24-.06-.37-.42-.13L7.75 12.39l-3.29-1.03c-.72-.22-.73-.72.15-1.07l12.87-4.96c.6-.22 1.12.14.93.99z" />
            </svg>
        ),
    },
    {
        id: "medium",
        name: "Medium",
        domains: ["medium.com"],
        aliases: ["medium"],
        color: "#ffffff",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.54 12a6.8 6.8 0 0 1-6.77 6.82A6.8 6.8 0 0 1 0 12a6.8 6.8 0 0 1 6.77-6.82A6.8 6.8 0 0 1 13.54 12zM20.96 12c0 3.54-1.51 6.42-3.38 6.42-1.87 0-3.39-2.88-3.39-6.42s1.52-6.42 3.39-6.42 3.38 2.88 3.38 6.42M24 12c0 3.17-.53 5.75-1.19 5.75-.66 0-1.19-2.58-1.19-5.75s.53-5.75 1.19-5.75C23.47 6.25 24 8.83 24 12z" />
            </svg>
        ),
    },
    {
        id: "devto",
        name: "Dev.to",
        domains: ["dev.to"],
        aliases: ["devto", "dev.to"],
        color: "#ffffff",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="currentColor">
                <path d="M7.42 10.05c-.18-.16-.46-.23-.84-.23H5.34v4.36h1.24c.38 0 .66-.07.84-.23.19-.16.29-.43.29-.81v-2.28c0-.38-.1-.65-.29-.81zm12.3 0c-.18-.16-.46-.23-.84-.23h-1.24v4.36h1.24c.38 0 .66-.07.84-.23.19-.16.29-.43.29-.81v-2.28c0-.38-.1-.65-.29-.81zM0 0v24h24V0H0zm8.9 13.06c0 .76-.23 1.34-.69 1.73-.46.39-1.12.59-1.99.59H3.77V8.62h2.45c.87 0 1.53.2 1.99.59.46.39.69.97.69 1.73v2.12zm5.72 2.32H11.2V8.62h3.42v1.44H12.8v1.39h1.72v1.44H12.8v1.05h1.82v1.44zm6.65-2.32c0 .76-.23 1.34-.69 1.73-.46.39-1.12.59-1.99.59h-2.45V8.62h2.45c.87 0 1.53.2 1.99.59.46.39.69.97.69 1.73v2.12z" />
            </svg>
        ),
    },
    {
        id: "hashnode",
        name: "Hashnode",
        domains: ["hashnode.com", "hashnode.dev"],
        aliases: ["hashnode"],
        color: "#2962FF",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#2962FF">
                <path d="M22.351 8.019l-6.37-6.37a5.63 5.63 0 0 0-7.962 0l-6.37 6.37a5.63 5.63 0 0 0 0 7.962l6.37 6.37a5.63 5.63 0 0 0 7.962 0l6.37-6.37a5.63 5.63 0 0 0 0-7.962zM12 15.656a3.656 3.656 0 1 1 0-7.312 3.656 3.656 0 0 1 0 7.312z" />
            </svg>
        ),
    },
    {
        id: "substack",
        name: "Substack",
        domains: ["substack.com"],
        aliases: ["substack"],
        color: "#FF6719",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#FF6719">
                <path d="M22.539 8.242H1.46V5.406h21.08v2.836zM1.46 10.812V24L12 18.11 22.54 24V10.812H1.46zM22.54 0H1.46v2.836h21.08V0z" />
            </svg>
        ),
    },
    {
        id: "figma",
        name: "Figma",
        domains: ["figma.com"],
        aliases: ["figma"],
        color: "#F24E1E",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="none">
                <path d="M12 12a4 4 0 1 1 8 0 4 4 0 0 1-8 0z" fill="#1ABCFE" />
                <path d="M4 20a4 4 0 0 1 4-4h4v4a4 4 0 1 1-8 0z" fill="#0ACF83" />
                <path d="M12 4v8H8a4 4 0 1 1 4-8z" fill="#F24E1E" />
                <path d="M12 4h4a4 4 0 1 1 0 8h-4V4z" fill="#FF7262" />
                <path d="M12 12v8H8a4 4 0 1 1 0-8h4z" fill="#A259FF" />
            </svg>
        ),
    },
    {
        id: "dribbble",
        name: "Dribbble",
        domains: ["dribbble.com"],
        aliases: ["dribbble"],
        color: "#EA4C89",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#EA4C89">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12c6.626 0 12-5.373 12-12S18.626 0 12 0zm9.73 10.158c-.378-.02-2.883-.146-5.632.784-.047-.11-.097-.221-.148-.33-1.042-2.22-2.247-4.148-2.39-4.372 3.518.847 6.444 3.197 8.17 6.418z" />
            </svg>
        ),
    },
    {
        id: "behance",
        name: "Behance",
        domains: ["behance.net"],
        aliases: ["behance"],
        color: "#1769FF",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#1769FF">
                <path d="M22 7h-7v2h7V7zm1.726 10c-.442 1.297-2.029 3-4.971 3-3.411 0-5.755-2.158-5.755-5.918 0-3.649 2.37-5.961 5.602-5.961 3.298 0 5.328 2.224 5.328 5.698 0 .54-.07 1.071-.131 1.341H16.02c.071 1.73 1.25 2.58 2.66 2.58 1.45 0 2.221-.711 2.571-1.74H23.726zM8.38 6.545C9.721 6.545 11 7.22 11 8.84c0 1.26-.77 2.07-1.71 2.35 1.21.36 2.05 1.32 2.05 2.82 0 2.05-1.52 3.14-3.37 3.14H0V6.545h8.38z" />
            </svg>
        ),
    },
    {
        id: "notion",
        name: "Notion",
        domains: ["notion.so", "notion.site"],
        aliases: ["notion"],
        color: "#ffffff",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="currentColor">
                <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.84-.046.933-.56.933-1.167V6.354c0-.606-.233-.933-.746-.886l-15.177.886c-.56.047-.747.327-.747.934zm13.498 1.447l.047 10.732c0 .56-.233.747-.7.793l-1.354.093c-.467.047-.653-.14-.653-.653l-.047-6.906-4.572 7.233c-.234.373-.514.466-.98.466l-1.447.094c-.467.046-.653-.14-.653-.653V9.248c0-.513.233-.7.7-.747l1.353-.093c.467-.047.654.14.654.653l.046 6.813 4.526-7.14c.28-.42.56-.513 1.027-.56l1.353-.093c.467-.047.653.186.7.7z" />
            </svg>
        ),
    },
    {
        id: "linktree",
        name: "Linktree",
        domains: ["linktr.ee"],
        aliases: ["linktree"],
        color: "#43E660",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#43E660">
                <path d="m13.736 5.853 4.005-4.117 2.325 2.38-4.2 4.007h5.908v3.305h-5.937l4.229 4.108-2.325 2.38-4.005-4.117v7.975H10.26v-7.975l-4.005 4.117-2.325-2.38 4.229-4.108H2.226v-3.305h5.904l-4.2-4.007 2.325-2.38 4.005 4.117V0h3.476v5.853z" />
            </svg>
        ),
    },
    {
        id: "npm",
        name: "npm",
        domains: ["npmjs.com", "npm.im"],
        aliases: ["npm"],
        color: "#CB3837",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#CB3837">
                <path d="M0 7.334v9.332h24V7.334H0zm4 8H2V9.334h2v6zm5.333 0H6.667V9.334h2.666v6zm6.667 0h-5.333V9.334H16v6zm6 0h-4.667V9.334H22v6z" />
            </svg>
        ),
    },
    {
        id: "docker",
        name: "Docker Hub",
        domains: ["docker.com", "hub.docker.com"],
        aliases: ["docker", "dockerhub"],
        color: "#2496ED",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#2496ED">
                <path d="M13.983 11.078h2.119a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.119a.185.185 0 0 0-.185.185v1.888c0 .102.083.185.185.185m-2.954-5.43h2.118a.186.186 0 0 0 .186-.186V3.574a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m0 2.716h2.118a.187.187 0 0 0 .186-.186V6.29a.186.186 0 0 0-.186-.185h-2.118a.185.185 0 0 0-.185.185v1.887c0 .102.082.186.185.186m-2.93 0h2.12a.186.186 0 0 0 .184-.186V6.29a.185.185 0 0 0-.185-.185H8.1a.185.185 0 0 0-.185.185v1.887c0 .102.083.186.185.186m-2.964 0h2.119a.186.186 0 0 0 .185-.186V6.29a.185.185 0 0 0-.185-.185H5.136a.186.186 0 0 0-.186.185v1.887c0 .102.084.186.186.186m5.893 2.715h2.118a.186.186 0 0 0 .186-.185V9.006a.186.186 0 0 0-.186-.186h-2.118a.185.185 0 0 0-.185.185v1.888c0 .102.082.185.185.185m-2.93 0h2.12a.185.185 0 0 0 .184-.185V9.006a.185.185 0 0 0-.184-.186h-2.12a.185.185 0 0 0-.184.185v1.888c0 .102.083.185.185.185m-2.964 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.185-.186H5.136a.186.186 0 0 0-.186.185v1.888c0 .102.084.185.186.185m-2.928 0h2.119a.185.185 0 0 0 .185-.185V9.006a.185.185 0 0 0-.185-.186H2.208a.186.186 0 0 0-.186.185v1.888c0 .102.084.185.186.185m21.724-.572a5.039 5.039 0 0 0-2.323-.578c-.287 0-.573.023-.854.068a3.66 3.66 0 0 0-2.797-1.348h-.615v3.404c0 .324.088.636.242.909a7.618 7.618 0 0 0-3.327-.768H.19A.186.186 0 0 0 0 14.157c.125 1.15.512 2.22 1.127 3.149 1.196 1.808 3.087 3.013 5.344 3.407 1.547.27 3.23.218 4.966-.153 3.992-.853 6.946-3.411 7.828-6.79.47.054.945.082 1.424.082 1.488 0 2.924-.268 4.243-.761a.186.186 0 0 0 .092-.262 5.094 5.094 0 0 0-1.092-1.594z" />
            </svg>
        ),
    },
    {
        id: "vercel",
        name: "Vercel",
        domains: ["vercel.com", "vercel.app"],
        aliases: ["vercel"],
        color: "#ffffff",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="currentColor">
                <path d="m12 1 12 21H0L12 1z" />
            </svg>
        ),
    },
    {
        id: "supabase",
        name: "Supabase",
        domains: ["supabase.com"],
        aliases: ["supabase"],
        color: "#3ECF8E",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#3ECF8E">
                <path d="M21.362 9.354H12V.396a.396.396 0 0 0-.716-.233L.32 13.916a.396.396 0 0 0 .307.643H12v9.047a.396.396 0 0 0 .716.233l10.963-13.834a.396.396 0 0 0-.317-.651Z" />
            </svg>
        ),
    },
    {
        id: "google",
        name: "Google",
        domains: ["google.com", "google.dev", "developers.google.com"],
        aliases: ["google", "googledev"],
        color: "#4285F4",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z" />
            </svg>
        ),
    },
    {
        id: "googlescholar",
        name: "Google Scholar",
        domains: ["scholar.google.com"],
        aliases: ["googlescholar", "scholar"],
        color: "#4285F4",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#4285F4">
                <path d="M12 24a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm0-24L0 9.5l4.838 3.94A8 8 0 0 1 12 9a8 8 0 0 1 7.162 4.44L24 9.5 12 0z" />
            </svg>
        ),
    },
    {
        id: "producthunt",
        name: "Product Hunt",
        domains: ["producthunt.com"],
        aliases: ["producthunt"],
        color: "#DA552F",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#DA552F">
                <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm0 17.5h-3V6.5h4.25c2.62 0 4.25 1.56 4.25 3.87 0 2.32-1.63 3.88-4.25 3.88H12v3.25zm1.25-5.5h-1.25V8.75h1.25c1.24 0 1.75.69 1.75 1.62s-.51 1.63-1.75 1.63z" />
            </svg>
        ),
    },
    {
        id: "wellfound",
        name: "Wellfound",
        domains: ["wellfound.com", "angel.co"],
        aliases: ["wellfound", "angellist"],
        color: "#ffffff",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 2h4.5l3.5 10L15.5 2H20l-5.5 15.5a3.5 3.5 0 0 1-6.5 0L4 2Z" />
            </svg>
        ),
    },
    {
        id: "codepen",
        name: "CodePen",
        domains: ["codepen.io"],
        aliases: ["codepen"],
        color: "#ffffff",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="currentColor">
                <path d="M23.82 7.74a1.8 1.8 0 0 0-.15-.46l-4.5-9a1.8 1.8 0 0 0-1.67-.98h-11a1.8 1.8 0 0 0-1.67.98l-4.5 9a1.8 1.8 0 0 0-.15.46v8.52a1.8 1.8 0 0 0 .15.46l4.5 9a1.8 1.8 0 0 0 1.67.98h11a1.8 1.8 0 0 0 1.67-.98l4.5-9a1.8 1.8 0 0 0 .15-.46V7.74zM12 2.37l3.87 7.74H8.13L12 2.37zM2.87 9.11L5.5 3.85v5.26H2.87zm9.13 12.52l-3.87-7.74h7.74L12 21.63zm9.13-6.74h-2.63V9.63h2.63v5.26z" />
            </svg>
        ),
    },
    {
        id: "aws",
        name: "AWS",
        domains: ["aws.amazon.com", "amazon.com"],
        aliases: ["aws", "amazonwebservices"],
        color: "#FF9900",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#FF9900">
                <path d="M6.88 12.82c0-1.25.75-1.95 2.1-2.1l2.5-.27v-.63c0-.98-.55-1.5-1.7-1.5-.9 0-1.55.3-2 .88l-.95-1.05C7.6 7.2 8.65 6.7 10 6.7c2.3 0 3.5 1.15 3.5 3.12v5.82h-1.6v-1.12c-.65.8-1.6 1.25-2.7 1.25-1.5 0-2.32-.95-2.32-3zm4.6-.28v-1.2l-2.28.25c-.8.1-.1.18-.8 1.12 0 .68.45 1.12 1.2 1.12.95 0 1.88-.5 1.88-1.3zM21.2 16.5c-4.4 3.2-10.8 4.8-16.3 2.1-.3-.15-.55-.38-.2-.72.35-.35.85-.15 1.25.05 4.9 2.35 10.6.95 14.5-1.85.5-.35 1.05.15.75.42z" />
            </svg>
        ),
    },
    {
        id: "azure",
        name: "Microsoft Azure",
        domains: ["azure.microsoft.com", "portal.azure.com"],
        aliases: ["azure", "microsoftazure"],
        color: "#0089D6",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#0089D6">
                <path d="M13.48 2.66 7.82 12.4H13l-4.7 8.94h5.22l8.48-18.68h-8.52zM2 12.4l4.28 8.94h4.72L5.4 12.4H2z" />
            </svg>
        ),
    },
    {
        id: "cloudflare",
        name: "Cloudflare",
        domains: ["cloudflare.com"],
        aliases: ["cloudflare"],
        color: "#F38020",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#F38020">
                <path d="M18.3 12.2a4.4 4.4 0 0 0-4.2-3.2 4.4 4.4 0 0 0-4.3 3.5A3.5 3.5 0 0 0 7 15.5c0 1.9 1.6 3.5 3.5 3.5h7.8c1.8 0 3.2-1.4 3.2-3.2 0-1.7-1.3-3.1-3.2-3.6z" />
            </svg>
        ),
    },
    {
        id: "digitalocean",
        name: "DigitalOcean",
        domains: ["digitalocean.com"],
        aliases: ["digitalocean"],
        color: "#0080FF",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#0080FF">
                <path d="M12 2A10 10 0 0 0 2 12a10 10 0 0 0 10 10c4.1 0 7.6-2.5 9.1-6.1h-3.4A6.7 6.7 0 0 1 12 18.7a6.7 6.7 0 0 1-6.7-6.7A6.7 6.7 0 0 1 12 5.3v-3.3z" />
            </svg>
        ),
    },
    {
        id: "firebase",
        name: "Firebase",
        domains: ["firebase.google.com"],
        aliases: ["firebase"],
        color: "#FFCA28",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#FFCA28">
                <path d="M4.5 17.5 1.5 6.5l5.5 10.5 4.5-8.5 2.5 4.5L7.5 2.5 4.5 17.5zm15-7.5-3-6-8.5 16 14.5-8.5z" />
            </svg>
        ),
    },
    {
        id: "mongodb",
        name: "MongoDB",
        domains: ["mongodb.com"],
        aliases: ["mongodb", "mongo"],
        color: "#47A248",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#47A248">
                <path d="M12 0c-.3 0-.6.1-.8.3C7.5 3.8 5 8.7 5 13.5 5 18.6 8 23 12 24c4-1 7-5.4 7-10.5 0-4.8-2.5-9.7-6.2-13.2-.2-.2-.5-.3-.8-.3zm0 2.5c2.7 3.2 4.7 7.2 4.7 11 0 4-2.2 7.7-4.7 8.8V2.5z" />
            </svg>
        ),
    },
    {
        id: "postgresql",
        name: "PostgreSQL",
        domains: ["postgresql.org"],
        aliases: ["postgresql", "postgres"],
        color: "#4169E1",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#4169E1">
                <path d="M12 2C6.5 2 2 6.5 2 12c0 4.6 3.1 8.5 7.4 9.6.2-.4.4-.8.7-1.1-2.9-.6-4.9-3.2-4.9-6.2 0-3.5 2.8-6.3 6.3-6.3h1c3.5 0 6.3 2.8 6.3 6.3 0 3-2 5.6-4.9 6.2.3.4.5.8.7 1.1 4.3-1.1 7.4-5 7.4-9.6C22 6.5 17.5 2 12 2z" />
            </svg>
        ),
    },
    {
        id: "redis",
        name: "Redis",
        domains: ["redis.io"],
        aliases: ["redis"],
        color: "#DC382D",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#DC382D">
                <path d="M12 3 2 8l10 5 10-5-10-5zm0 8.5L5 8l7-3.5L19 8l-7 3.5zM2 13l10 5 10-5-2-1-8 4-8-4-2 1zm0 5l10 5 10-5-2-1-8 4-8-4-2 1z" />
            </svg>
        ),
    },
    {
        id: "postman",
        name: "Postman",
        domains: ["postman.com"],
        aliases: ["postman"],
        color: "#FF6C37",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#FF6C37">
                <path d="M12 2A10 10 0 1 0 22 12 10 10 0 0 0 12 2zm1 14.5-4-2.5 4-2.5v5zm0-7-4-2.5 4-2.5v5z" />
            </svg>
        ),
    },
    {
        id: "replit",
        name: "Replit",
        domains: ["replit.com"],
        aliases: ["replit"],
        color: "#F26207",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#F26207">
                <path d="M2 1.5h9v7H2zm0 7h9v7H2zm0 7h9v7H2zm11-7h9v7h-9z" />
            </svg>
        ),
    },
    {
        id: "codesandbox",
        name: "CodeSandbox",
        domains: ["codesandbox.io"],
        aliases: ["codesandbox"],
        color: "#ffffff",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="currentColor">
                <path d="M2 6l10-5 10 5v12l-10 5-10-5V6zm10-2.8L4.2 7.5 12 11.4l7.8-3.9L12 3.2zm-8 6v7.3l7 3.5v-7.3l-7-3.5zm16 0-7 3.5v7.3l7-3.5V9.2z" />
            </svg>
        ),
    },
    {
        id: "stackblitz",
        name: "StackBlitz",
        domains: ["stackblitz.com"],
        aliases: ["stackblitz"],
        color: "#1389FD",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#1389FD">
                <path d="m10.8 1.4-9.3 13h7.7L7.6 22.6l9.3-13h-7.7z" />
            </svg>
        ),
    },
    {
        id: "freecodecamp",
        name: "freeCodeCamp",
        domains: ["freecodecamp.org"],
        aliases: ["freecodecamp", "fcc"],
        color: "#0A0A23",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12s5.37 12 12 12 12-5.37 12-12S18.63 0 12 0zm-1.8 17.5c-2.4 0-3.6-1.6-3.6-3.5s1.2-3.5 3.6-3.5c1.4 0 2.5.6 3.1 1.6l-1.3 1c-.4-.7-1-1-1.8-1-1.3 0-2 .9-2 2s.7 2 2 2c.8 0 1.4-.4 1.8-1l1.3 1c-.6 1-1.7 1.4-3.1 1.4z" />
            </svg>
        ),
    },
    {
        id: "coursera",
        name: "Coursera",
        domains: ["coursera.org"],
        aliases: ["coursera"],
        color: "#0056D2",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#0056D2">
                <path d="M12 2A10 10 0 1 0 22 12 10 10 0 0 0 12 2zm-1 14.5c-2.8 0-4.5-1.9-4.5-4.5s1.7-4.5 4.5-4.5c1.8 0 3.2.9 3.8 2.2l-2 1.1c-.4-.7-1-1.1-1.8-1.1-1.4 0-2.3 1-2.3 2.3s.9 2.3 2.3 2.3c.8 0 1.4-.4 1.8-1.1l2 1.1c-.6 1.3-2 2.2-3.8 2.2z" />
            </svg>
        ),
    },
    {
        id: "udemy",
        name: "Udemy",
        domains: ["udemy.com"],
        aliases: ["udemy"],
        color: "#A435F0",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#A435F0">
                <path d="M12 0 1 6v8c0 6.6 4.7 12.8 11 14 6.3-1.2 11-7.4 11-14V6L12 0zm0 16c-2.8 0-5-2.2-5-5V7h2.5v4c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5V7H17v4c0 2.8-2.2 5-5 5z" />
            </svg>
        ),
    },
    {
        id: "twitch",
        name: "Twitch",
        domains: ["twitch.tv"],
        aliases: ["twitch"],
        color: "#9146FF",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#9146FF">
                <path d="M2.1 0 0 5.25v15h5.25V24l3.75-3.75h4.5L24 9.75V0H2.1zm19.5 8.6-3 3H14l-2.6 2.65V11.6H7.5V2.25h14.1V8.6zM17.25 4.5v4.5h-2.25V4.5h2.25zm-6 0v4.5H9V4.5h2.25z" />
            </svg>
        ),
    },
    {
        id: "slack",
        name: "Slack",
        domains: ["slack.com"],
        aliases: ["slack"],
        color: "#4A154B",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#ECB22E">
                <path d="M5.04 14.5a2.5 2.5 0 1 0-2.5 2.5h2.5v-2.5zm1.26 0a2.5 2.5 0 0 0 5 0V9.46a2.5 2.5 0 0 0-5 0v5.04zM9.5 5.04a2.5 2.5 0 1 0-2.5-2.5v2.5h2.5zm0 1.26a2.5 2.5 0 0 0 0 5h5.04a2.5 2.5 0 0 0 0-5H9.5zm9.46 4.2a2.5 2.5 0 1 0 2.5-2.5h-2.5v2.5zm-1.26 0a2.5 2.5 0 0 0-5 0v5.04a2.5 2.5 0 0 0 5 0V10.5zM14.5 18.96a2.5 2.5 0 1 0 2.5 2.5v-2.5h-2.5zm0-1.26a2.5 2.5 0 0 0 0-5H9.46a2.5 2.5 0 0 0 0 5h5.04z" />
            </svg>
        ),
    },
    {
        id: "facebook",
        name: "Facebook",
        domains: ["facebook.com", "fb.com"],
        aliases: ["facebook", "fb"],
        color: "#1877F2",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#1877F2">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
        ),
    },
    {
        id: "tiktok",
        name: "TikTok",
        domains: ["tiktok.com"],
        aliases: ["tiktok"],
        color: "#FE2C55",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.24 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z" />
            </svg>
        ),
    },
    {
        id: "pypi",
        name: "PyPI",
        domains: ["pypi.org"],
        aliases: ["pypi", "pythonpackage"],
        color: "#3775A9",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#3775A9">
                <path d="M12 2 2 7.8v8.4l10 5.8 10-5.8V7.8L12 2zm0 3.3 6.7 3.9L12 13.1 5.3 9.2 12 5.3zm-7.7 5.7 6.7 3.9v7.7l-6.7-3.9V11zm15.4 7.7-6.7 3.9v-7.7l6.7-3.9v7.7z" />
            </svg>
        ),
    },
    {
        id: "cratesio",
        name: "Crates.io",
        domains: ["crates.io"],
        aliases: ["crates", "cratesio", "rust"],
        color: "#DEA584",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#DEA584">
                <path d="M12 2 2 7.8v8.4l10 5.8 10-5.8V7.8L12 2zm0 2.4 7.8 4.5v7.2L12 20.6 4.2 16.1V8.9L12 4.4z" />
            </svg>
        ),
    },
    {
        id: "netlify",
        name: "Netlify",
        domains: ["netlify.com", "netlify.app"],
        aliases: ["netlify"],
        color: "#00C7B7",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#00C7B7">
                <path d="M12 2 3.5 12 12 22l8.5-10L12 2zm0 4.2 5 5.8-5 5.8-5-5.8 5-5.8z" />
            </svg>
        ),
    },
    {
        id: "railway",
        name: "Railway",
        domains: ["railway.app"],
        aliases: ["railway"],
        color: "#ffffff",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.5 12a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0zm9.5-6.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13z" />
            </svg>
        ),
    },
    {
        id: "render",
        name: "Render",
        domains: ["render.com"],
        aliases: ["render"],
        color: "#46E3B7",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#46E3B7">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm4 11h-3v3h-2v-3H8v-2h3V8h2v3h3z" />
            </svg>
        ),
    },
    {
        id: "topcoder",
        name: "Topcoder",
        domains: ["topcoder.com"],
        aliases: ["topcoder", "tc"],
        color: "#29A8DF",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#29A8DF">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm4.5 11h-3v3h-3v-3h-3v-2h3V8h3v3h3z" />
            </svg>
        ),
    },
    {
        id: "codewars",
        name: "Codewars",
        domains: ["codewars.com"],
        aliases: ["codewars"],
        color: "#BA432C",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#BA432C">
                <path d="m12 0-9 5.2v13.6L12 24l9-5.2V5.2L12 0zm0 4.2 5.5 3.2v9.2L12 19.8l-5.5-3.2V7.4L12 4.2z" />
            </svg>
        ),
    },
    {
        id: "codesignal",
        name: "CodeSignal",
        domains: ["codesignal.com"],
        aliases: ["codesignal"],
        color: "#1877F2",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#1877F2">
                <path d="M12 2 3 7v10l9 5 9-5V7l-9-5zm0 3.3L18 9v6l-6 3.7L6 15V9l6-3.7z" />
            </svg>
        ),
    },
    {
        id: "webflow",
        name: "Webflow",
        domains: ["webflow.com", "webflow.io"],
        aliases: ["webflow"],
        color: "#4353FF",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#4353FF">
                <path d="M17.8 7.3c-.8.1-1.4.5-1.9 1-.5-1.8-2.2-3.1-4.2-3.1-2.4 0-4.4 2-4.4 4.4 0 .3 0 .7.1 1-.4-.1-.8-.2-1.2-.2-2.1 0-3.8 1.7-3.8 3.8s1.7 3.8 3.8 3.8h11.6c2.3 0 4.2-1.9 4.2-4.2 0-2.2-1.8-4-4.2-4.5z" />
            </svg>
        ),
    },
    {
        id: "framer",
        name: "Framer",
        domains: ["framer.com", "framer.website"],
        aliases: ["framer"],
        color: "#0055FF",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 0h16v8h-8zM4 8h8l8 8H4zM4 16h8v8z" />
            </svg>
        ),
    },
    {
        id: "wordpress",
        name: "WordPress",
        domains: ["wordpress.com", "wordpress.org"],
        aliases: ["wordpress", "wp"],
        color: "#21759B",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#21759B">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-5 13.5L10.5 5h3L17 15.5h-2.5l-.8-2.5h-3.4l-.8 2.5H7z" />
            </svg>
        ),
    },
    {
        id: "unstop",
        name: "Unstop",
        domains: ["unstop.com", "dare2compete.com"],
        aliases: ["unstop", "dare2compete"],
        color: "#0038FF",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#0038FF">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.5h-2v-5h2v5zm0-7h-2V7h2v2.5z" />
            </svg>
        ),
    },
    {
        id: "colab",
        name: "Google Colab",
        domains: ["colab.research.google.com"],
        aliases: ["colab", "googlecolab"],
        color: "#F9AB00",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#F9AB00">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm-2.5 13.5L6 12l3.5-3.5 1.4 1.4L8.8 12l2.1 2.1-1.4 1.4zm5 0-1.4-1.4 2.1-2.1-2.1-2.1 1.4-1.4L18 12l-3.5 3.5z" />
            </svg>
        ),
    },
    {
        id: "arxiv",
        name: "arXiv",
        domains: ["arxiv.org"],
        aliases: ["arxiv"],
        color: "#B31B1B",
        icon: (className = "w-3.5 h-3.5") => (
            <svg className={className} viewBox="0 0 24 24" fill="#B31B1B">
                <path d="M12 2 3 7v10l9 5 9-5V7l-9-5zm0 3.3L18 9v6l-6 3.7L6 15V9l6-3.7z" />
            </svg>
        ),
    },
];

// Helper: Normalize URL to find matching domain
export function extractDomainFromUrl(url: string): string {
    if (!url) return "";
    let clean = url.trim().toLowerCase();
    // remove leading @ or whitespace
    clean = clean.replace(/^@/, "");
    // strip protocol
    clean = clean.replace(/^(https?:\/\/)?(www\.)?/, "");
    // get hostname part
    const slashIdx = clean.indexOf("/");
    if (slashIdx !== -1) {
        clean = clean.substring(0, slashIdx);
    }
    // strip port
    const colonIdx = clean.indexOf(":");
    if (colonIdx !== -1) {
        clean = clean.substring(0, colonIdx);
    }
    return clean;
}

// Auto-detect matching platform by URL or by Name/Label
export function detectPlatform(input: string): PlatformDefinition | null {
    if (!input || !input.trim()) return null;
    const clean = input.trim().toLowerCase();

    // 1. Try URL domain match
    const domain = extractDomainFromUrl(clean);
    if (domain) {
        for (const p of PLATFORM_REGISTRY) {
            if (p.domains.some((d) => domain === d || domain.endsWith("." + d))) {
                return p;
            }
        }
    }

    // 2. Try Name / Alias match
    const cleanWord = clean.replace(/[^a-z0-9]/g, "");
    for (const p of PLATFORM_REGISTRY) {
        if (p.name.toLowerCase() === clean || p.id === cleanWord) {
            return p;
        }
        if (p.aliases && p.aliases.some((a) => a.toLowerCase() === clean || a === cleanWord)) {
            return p;
        }
    }

    return null;
}

// Get the corresponding Icon for a link:
// If from a recognized platform -> platform SVG logo
// Otherwise -> Globe icon for custom / personal domain!
export function getPlatformIcon(
    platformOrUrlOrLabel: string,
    className = "w-3.5 h-3.5 flex-shrink-0"
): React.ReactNode {
    const platform = detectPlatform(platformOrUrlOrLabel);
    if (platform) {
        return platform.icon(className);
    }
    // Default Globe icon for personal/custom domains
    return <Globe className={`${className} text-neutral-400`} strokeWidth={2} />;
}

// Format URL safely (ensure https://)
export function sanitizePlatformUrl(url: string): string {
    if (!url || typeof url !== "string") return "";
    const trimmed = url.trim();
    if (!trimmed) return "";
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        return trimmed;
    }
    return `https://${trimmed.replace(/^\/+/, "")}`;
}
