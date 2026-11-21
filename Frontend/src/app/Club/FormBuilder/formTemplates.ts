import type { FormSection, FormStructure, FormThemeSettings, FormSettings } from "../../../api/clubEventFormApi";

export interface FormTemplateDefinition {
    id: string;
    title: string;
    category: string;
    summary: string;
    description?: string;
    badge: string;
    badgeColor: string;
    cardBg: string;
    iconName: string;
    themeSettings: FormThemeSettings;
    settings?: Partial<FormSettings>;
    structure: FormStructure;
}

function makeId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
}

export const ORBIX_FORM_TEMPLATES: FormTemplateDefinition[] = [
    // 1. Hackathon Registration
    {
        id: "hackathon_registration",
        title: "Hackathon Registration",
        category: "Competition & Hackathon",
        summary: "Track selection, tech stack checklist, team formation status, GitHub profile, and logistics.",
        badge: "Hackathon",
        badgeColor: "bg-[#38BDF8] text-black",
        cardBg: "hover:bg-[#F0F9FF]",
        iconName: "Code2",
        themeSettings: {
            accentColor: "#38BDF8",
            fontFamily: "sans",
        },
        settings: {
            requireLogin: true,
            limitOneResponse: true,
            showProgressBar: true,
            confirmationMessage: "You're in! Prepare your development environment and join the hackathon Discord.",
        },
        structure: {
            sections: [
                {
                    id: "sec_hack_1",
                    title: "Hacker Profile & Track Selection",
                    description: "Select your project theme and let organizers know about your technical strengths.",
                    afterSectionAction: "next_section",
                    questions: [
                        {
                            id: "q_hack_type",
                            type: "multiple_choice",
                            title: "Participation Format",
                            description: "Are you applying solo or with a confirmed squad?",
                            required: true,
                            options: [
                                { id: "opt_h1", text: "Team Lead (Registering an existing team)" },
                                { id: "opt_h2", text: "Team Member (Joining an existing team)" },
                                { id: "opt_h3", text: "Solo Hacker (Seeking a team at the mixer)" },
                                { id: "opt_h4", text: "Solo Hacker (Building independently)" },
                            ],
                        },
                        {
                            id: "q_hack_track",
                            type: "multiple_choice",
                            title: "Preferred Hackathon Track",
                            description: "Choose the theme your project will primarily address.",
                            required: true,
                            options: [
                                { id: "opt_ht1", text: "AI & Autonomous Agentic Workflows" },
                                { id: "opt_ht2", text: "Web3, DeFi & Decentralized Infra" },
                                { id: "opt_ht3", text: "FinTech, Open Banking & Commerce" },
                                { id: "opt_ht4", text: "GreenTech & Climate Intelligence" },
                                { id: "opt_ht5", text: "Open Innovation / Blue Sky" },
                            ],
                        },
                        {
                            id: "q_hack_stack",
                            type: "checkboxes",
                            title: "Primary Frameworks & Languages",
                            description: "Select all technologies you are comfortable using during the 24-hour sprint.",
                            required: true,
                            options: [
                                { id: "opt_hs1", text: "React / Next.js / TypeScript" },
                                { id: "opt_hs2", text: "Python / FastAPI / PyTorch" },
                                { id: "opt_hs3", text: "Node.js / Express / PostgreSQL" },
                                { id: "opt_hs4", text: "Mobile (Flutter / React Native)" },
                                { id: "opt_hs5", text: "Rust / Go / Systems" },
                                { id: "opt_hs6", text: "Docker / Cloud / Serverless" },
                            ],
                        },
                        {
                            id: "q_hack_github",
                            type: "short_answer",
                            title: "GitHub / Devpost / Portfolio URL",
                            description: "Provide a link showcasing your previous projects or repositories.",
                            required: false,
                        },
                    ],
                },
                {
                    id: "sec_hack_2",
                    title: "Logistics & Swag Details",
                    description: "Hardware requirements and hackathon kit fulfillment.",
                    afterSectionAction: "submit_form",
                    questions: [
                        {
                            id: "q_hack_tshirt",
                            type: "dropdown",
                            title: "Official Hackathon T-Shirt Size",
                            description: "Select your unisex tee size for registration swag kit.",
                            required: true,
                            options: [
                                { id: "opt_sz_s", text: "Small (S)" },
                                { id: "opt_sz_m", text: "Medium (M)" },
                                { id: "opt_sz_l", text: "Large (L)" },
                                { id: "opt_sz_xl", text: "Extra Large (XL)" },
                                { id: "opt_sz_xxl", text: "Double Extra Large (XXL)" },
                            ],
                        },
                        {
                            id: "q_hack_hardware",
                            type: "multiple_choice",
                            title: "Hardware / IoT Peripherals",
                            description: "Do you plan to build an IoT project requiring test hardware or breadboards?",
                            required: true,
                            options: [
                                { id: "opt_hw_no", text: "No, purely software application" },
                                { id: "opt_hw_yes", text: "Yes, bringing our own microcontroller" },
                                { id: "opt_hw_need", text: "Yes, hoping to borrow lab sensor kits" },
                            ],
                        },
                    ],
                },
            ],
        },
    },

    // 2. Workshop Registration
    {
        id: "workshop_registration",
        title: "Workshop Registration",
        category: "Learning & Hands-On",
        summary: "Pre-requisite environment setup, skill level scale, learning goals, and TA assistance.",
        badge: "Workshop",
        badgeColor: "bg-[#FFE566] text-black",
        cardBg: "hover:bg-[#FEFCE8]",
        iconName: "BookOpen",
        themeSettings: {
            accentColor: "#FFE566",
            fontFamily: "sans",
        },
        settings: {
            requireLogin: true,
            limitOneResponse: true,
            showProgressBar: false,
            confirmationMessage: "Workshop seat reserved! Please complete the prerequisite installations before class.",
        },
        structure: {
            sections: [
                {
                    id: "sec_ws_1",
                    title: "Attendee Prerequisites & Background",
                    description: "Help instructors tailor code exercises to the class's experience level.",
                    afterSectionAction: "submit_form",
                    questions: [
                        {
                            id: "q_ws_skill",
                            type: "linear_scale",
                            title: "Current Topic Experience",
                            description: "How comfortable are you with the workshop curriculum?",
                            required: true,
                            scaleConfig: { min: 1, max: 5, minLabel: "Total Beginner", maxLabel: "Proficient Builder" },
                        },
                        {
                            id: "q_ws_os",
                            type: "multiple_choice",
                            title: "Primary Laptop Operating System",
                            description: "Ensures we prepare terminal setup commands for your device.",
                            required: true,
                            options: [
                                { id: "opt_os_mac", text: "macOS (Apple Silicon / Intel)" },
                                { id: "opt_os_win", text: "Windows 11 / WSL2" },
                                { id: "opt_os_linux", text: "Linux (Ubuntu / Fedora / Arch)" },
                            ],
                        },
                        {
                            id: "q_ws_prereqs",
                            type: "checkboxes",
                            title: "Prerequisite Tools Installed",
                            description: "Check items already configured on your machine.",
                            required: true,
                            options: [
                                { id: "opt_pr_git", text: "Git & GitHub CLI" },
                                { id: "opt_pr_node", text: "Node.js v20+ or Python 3.11+" },
                                { id: "opt_pr_vscode", text: "VS Code or Cursor" },
                                { id: "opt_pr_docker", text: "Docker Desktop installed" },
                            ],
                        },
                        {
                            id: "q_ws_goals",
                            type: "paragraph",
                            title: "Key Learning Goals",
                            description: "What specific project or concept do you hope to master today?",
                            required: false,
                        },
                    ],
                },
            ],
        },
    },

    // 3. Technical Competition
    {
        id: "technical_competition",
        title: "Technical Competition",
        category: "Coding & Challenges",
        summary: "Contest tier bracket, CP profiles (LeetCode/Codeforces), compiler language, and team handles.",
        badge: "Competition",
        badgeColor: "bg-[#F43F5E] text-white",
        cardBg: "hover:bg-[#FFF1F2]",
        iconName: "Trophy",
        themeSettings: {
            accentColor: "#F43F5E",
            fontFamily: "sans",
        },
        settings: {
            requireLogin: true,
            limitOneResponse: true,
            showProgressBar: false,
            confirmationMessage: "Contest registration locked. Check the scoreboard portal for rulebook & arena login.",
        },
        structure: {
            sections: [
                {
                    id: "sec_comp_1",
                    title: "Competitor Verification",
                    description: "Contest handles and programming languages.",
                    afterSectionAction: "submit_form",
                    questions: [
                        {
                            id: "q_comp_bracket",
                            type: "multiple_choice",
                            title: "Competition Division",
                            description: "Select your competitive division based on your college year.",
                            required: true,
                            options: [
                                { id: "opt_br_novice", text: "Novice Division (1st & 2nd Year Undergrads)" },
                                { id: "opt_br_pro", text: "Pro Division (3rd, 4th Year & Open Masters)" },
                            ],
                        },
                        {
                            id: "q_comp_handle",
                            type: "short_answer",
                            title: "Competitive Handle (Codeforces / LeetCode / CodeChef)",
                            description: "Provide your public username for rating verification.",
                            required: true,
                        },
                        {
                            id: "q_comp_lang",
                            type: "dropdown",
                            title: "Primary Submission Language",
                            description: "Select your default judge compiler.",
                            required: true,
                            options: [
                                { id: "opt_lang_cpp", text: "C++ (GCC 14 / C++20)" },
                                { id: "opt_lang_java", text: "Java (OpenJDK 21 LTS)" },
                                { id: "opt_lang_py", text: "Python (PyPy 3.10)" },
                                { id: "opt_lang_rust", text: "Rust (Edition 2021)" },
                            ],
                        },
                        {
                            id: "q_comp_repo",
                            type: "short_answer",
                            title: "GitHub Profile / Code Repository",
                            description: "Personal GitHub link.",
                            required: false,
                        },
                    ],
                },
            ],
        },
    },

    // 4. Seminar Registration
    {
        id: "seminar_registration",
        title: "Seminar Registration",
        category: "Talks & Keynotes",
        summary: "Attendee academic profile, speaker Q&A questions, topic familiarity, and audience background.",
        badge: "Seminar",
        badgeColor: "bg-[#C084FC] text-black",
        cardBg: "hover:bg-[#FAF5FF]",
        iconName: "Presentation",
        themeSettings: {
            accentColor: "#C084FC",
            fontFamily: "sans",
        },
        settings: {
            requireLogin: false,
            limitOneResponse: true,
            showProgressBar: false,
            confirmationMessage: "Registration confirmed. Auditorium seat pass has been reserved.",
        },
        structure: {
            sections: [
                {
                    id: "sec_sem_1",
                    title: "Seminar Pass & Speaker Q&A",
                    description: "Submit advance questions for the keynote speaker.",
                    afterSectionAction: "submit_form",
                    questions: [
                        {
                            id: "q_sem_acad",
                            type: "dropdown",
                            title: "Current Academic Standing",
                            description: "Select your current status.",
                            required: true,
                            options: [
                                { id: "opt_ac_1", text: "Undergraduate Student (Year 1-2)" },
                                { id: "opt_ac_2", text: "Undergraduate Student (Year 3-4)" },
                                { id: "opt_ac_3", text: "Postgraduate / Master's Student" },
                                { id: "opt_ac_4", text: "Faculty / University Staff" },
                                { id: "opt_ac_5", text: "Industry Guest / Alumni" },
                            ],
                        },
                        {
                            id: "q_sem_familiar",
                            type: "linear_scale",
                            title: "Topic Familiarity",
                            description: "How knowledgeable are you on this seminar's core themes?",
                            required: true,
                            scaleConfig: { min: 1, max: 5, minLabel: "Introductory", maxLabel: "Subject Matter Expert" },
                        },
                        {
                            id: "q_sem_qa",
                            type: "paragraph",
                            title: "Questions for the Keynote Speaker",
                            description: "Questions submitted here will be shortlisted for the live audience Q&A panel.",
                            required: false,
                        },
                    ],
                },
            ],
        },
    },

    // 5. Club Recruitment
    {
        id: "club_recruitment",
        title: "Club Recruitment",
        category: "Team & Inductions",
        summary: "Department preference, motivation statement, portfolio/resume upload, and weekly availability.",
        badge: "Recruitment",
        badgeColor: "bg-[#a2ff86] text-black",
        cardBg: "hover:bg-[#F0FDF4]",
        iconName: "Users",
        themeSettings: {
            accentColor: "#a2ff86",
            fontFamily: "sans",
        },
        settings: {
            requireLogin: true,
            limitOneResponse: true,
            showProgressBar: true,
            confirmationMessage: "Application submitted! Our recruitment team will review your profile and reach out.",
        },
        structure: {
            sections: [
                {
                    id: "sec_rec_1",
                    title: "Department Selection & Motivation",
                    description: "Select the team wing you are most passionate about contributing to.",
                    afterSectionAction: "next_section",
                    questions: [
                        {
                            id: "q_rec_dept",
                            type: "multiple_choice",
                            title: "Primary Wing Preference",
                            description: "Choose your top choice department.",
                            required: true,
                            options: [
                                { id: "opt_dep_tech", text: "Technical & Software Engineering" },
                                { id: "opt_dep_design", text: "UI/UX & Creative Media Design" },
                                { id: "opt_dep_ops", text: "Event Logistics & Operations" },
                                { id: "opt_dep_pr", text: "Corporate Relations, PR & Sponsorship" },
                                { id: "opt_dep_content", text: "Editorial, Content & Social Media" },
                            ],
                        },
                        {
                            id: "q_rec_why",
                            type: "paragraph",
                            title: "Why do you want to join our organization?",
                            description: "What drives you to be part of our core team this season?",
                            required: true,
                        },
                        {
                            id: "q_rec_links",
                            type: "short_answer",
                            title: "Portfolio, GitHub, Behance or LinkedIn URL",
                            description: "Share links to work you are proud of.",
                            required: false,
                        },
                    ],
                },
                {
                    id: "sec_rec_2",
                    title: "Commitment & Resume",
                    description: "Availability and credentials.",
                    afterSectionAction: "submit_form",
                    questions: [
                        {
                            id: "q_rec_hours",
                            type: "multiple_choice",
                            title: "Weekly Time Commitment",
                            description: "How many hours per week can you actively dedicate to club projects?",
                            required: true,
                            options: [
                                { id: "opt_hr_3", text: "3 to 5 hours / week" },
                                { id: "opt_hr_6", text: "6 to 10 hours / week" },
                                { id: "opt_hr_10", text: "10+ hours / week" },
                            ],
                        },
                        {
                            id: "q_rec_resume",
                            type: "file_upload",
                            title: "Resume / CV (PDF Preferred)",
                            description: "Upload your latest academic or technical resume (max 25MB).",
                            required: false,
                        },
                    ],
                },
            ],
        },
    },

    // 6. Project Submission
    {
        id: "project_submission",
        title: "Project Submission",
        category: "Showcase & Evaluators",
        summary: "Project abstract, tech stack breakdown, demo video, deployed URL, and report upload.",
        badge: "Submission",
        badgeColor: "bg-[#FB923C] text-black",
        cardBg: "hover:bg-[#FFF7ED]",
        iconName: "FolderGit2",
        themeSettings: {
            accentColor: "#FB923C",
            fontFamily: "sans",
        },
        settings: {
            requireLogin: true,
            limitOneResponse: true,
            allowEditResponse: true,
            showProgressBar: false,
            confirmationMessage: "Project successfully submitted for evaluation! You can update your links before the deadline.",
        },
        structure: {
            sections: [
                {
                    id: "sec_proj_1",
                    title: "Project Deliverables & Repository",
                    description: "Submit all evaluation links and documentation for jury scoring.",
                    afterSectionAction: "submit_form",
                    questions: [
                        {
                            id: "q_proj_title",
                            type: "short_answer",
                            title: "Official Project Title",
                            description: "Provide the public name of your application.",
                            required: true,
                        },
                        {
                            id: "q_proj_abstract",
                            type: "paragraph",
                            title: "Project Abstract & Problem Statement",
                            description: "Summarize the problem tackled, key features, and user workflow.",
                            required: true,
                        },
                        {
                            id: "q_proj_repo",
                            type: "short_answer",
                            title: "Public GitHub / GitLab Repository",
                            description: "Link to your source code repository with open README.",
                            required: true,
                        },
                        {
                            id: "q_proj_demo",
                            type: "short_answer",
                            title: "Live Deployed Web URL or APK Link",
                            description: "Link to working deployment (Vercel, Render, AWS, Expo).",
                            required: false,
                        },
                        {
                            id: "q_proj_video",
                            type: "short_answer",
                            title: "Demo Video Link (Loom, YouTube, Drive)",
                            description: "2-3 minute walk-through explaining architecture and demo.",
                            required: false,
                        },
                        {
                            id: "q_proj_report",
                            type: "file_upload",
                            title: "Architecture PDF or Final Report",
                            description: "Upload design diagrams, schemas, or research documentation.",
                            required: false,
                        },
                    ],
                },
            ],
        },
    },

    // 7. Internship or Placement Registration
    {
        id: "internship_placement",
        title: "Internship or Placement Registration",
        category: "Career & Placement",
        summary: "Graduation year, CGPA verification, target roles, work eligibility, and resume file upload.",
        badge: "Career",
        badgeColor: "bg-[#34D399] text-black",
        cardBg: "hover:bg-[#ECFDF5]",
        iconName: "Briefcase",
        themeSettings: {
            accentColor: "#34D399",
            fontFamily: "sans",
        },
        settings: {
            requireLogin: true,
            limitOneResponse: true,
            showProgressBar: true,
            confirmationMessage: "Placement drive registration recorded. Check email for interview slots and tests.",
        },
        structure: {
            sections: [
                {
                    id: "sec_place_1",
                    title: "Academic & Professional Qualifications",
                    description: "Verify your credentials for placement recruiter shortlisting.",
                    afterSectionAction: "submit_form",
                    questions: [
                        {
                            id: "q_place_grad",
                            type: "dropdown",
                            title: "Expected Graduation Year",
                            description: "Select your completion cohort.",
                            required: true,
                            options: [
                                { id: "opt_gr_2025", text: "Batch of 2025 (Immediate)" },
                                { id: "opt_gr_2026", text: "Batch of 2026" },
                                { id: "opt_gr_2027", text: "Batch of 2027" },
                                { id: "opt_gr_2028", text: "Batch of 2028" },
                            ],
                        },
                        {
                            id: "q_place_cgpa",
                            type: "short_answer",
                            title: "Cumulative CGPA / Score",
                            description: "Enter your overall CGPA on a 10.0 scale.",
                            required: true,
                        },
                        {
                            id: "q_place_roles",
                            type: "checkboxes",
                            title: "Target Roles & Tracks",
                            description: "Select domains you are applying for.",
                            required: true,
                            options: [
                                { id: "opt_ro_fs", text: "Full Stack Engineer" },
                                { id: "opt_ro_fe", text: "Frontend Engineer (React / TypeScript)" },
                                { id: "opt_ro_be", text: "Backend Engineer (Go / Python / Node)" },
                                { id: "opt_ro_ai", text: "AI / Machine Learning Engineer" },
                                { id: "opt_ro_cloud", text: "DevOps & Cloud Infrastructure" },
                                { id: "opt_ro_pm", text: "Associate Product Manager" },
                            ],
                        },
                        {
                            id: "q_place_resume",
                            type: "file_upload",
                            title: "Official Resume / CV (PDF Only)",
                            description: "Upload your one-page standard technical resume.",
                            required: true,
                        },
                        {
                            id: "q_place_linkedin",
                            type: "short_answer",
                            title: "LinkedIn Profile URL",
                            description: "Link to your updated LinkedIn profile.",
                            required: true,
                        },
                    ],
                },
            ],
        },
    },

    // 8. Team Formation
    {
        id: "team_formation",
        title: "Team Formation",
        category: "Teams & Squads",
        summary: "Team name, roster size, team member names/emails, role distribution, and squad pitch.",
        badge: "Teams",
        badgeColor: "bg-[#818CF8] text-white",
        cardBg: "hover:bg-[#EEF2FF]",
        iconName: "Users2",
        themeSettings: {
            accentColor: "#818CF8",
            fontFamily: "sans",
        },
        settings: {
            requireLogin: true,
            limitOneResponse: true,
            showProgressBar: false,
            confirmationMessage: "Team roster locked! Team code generated for all rostered members.",
        },
        structure: {
            sections: [
                {
                    id: "sec_team_1",
                    title: "Team Roster & Members",
                    description: "Register your squad roster and designate member roles.",
                    afterSectionAction: "submit_form",
                    questions: [
                        {
                            id: "q_team_name",
                            type: "short_answer",
                            title: "Official Team Name",
                            description: "Provide your squad's public display handle.",
                            required: true,
                        },
                        {
                            id: "q_team_size",
                            type: "dropdown",
                            title: "Total Team Roster Size",
                            description: "Including yourself as the team lead.",
                            required: true,
                            options: [
                                { id: "opt_ts_2", text: "2 Members (Pair)" },
                                { id: "opt_ts_3", text: "3 Members" },
                                { id: "opt_ts_4", text: "4 Members (Full Squad)" },
                            ],
                        },
                        {
                            id: "q_team_mem2",
                            type: "short_answer",
                            title: "Member 2: Full Name & Campus Email",
                            description: "e.g. Jane Doe (jane.doe@campus.edu)",
                            required: true,
                        },
                        {
                            id: "q_team_mem3",
                            type: "short_answer",
                            title: "Member 3: Full Name & Campus Email",
                            description: "Leave blank if team has only 2 members.",
                            required: false,
                        },
                        {
                            id: "q_team_mem4",
                            type: "short_answer",
                            title: "Member 4: Full Name & Campus Email",
                            description: "Leave blank if team has 2 or 3 members.",
                            required: false,
                        },
                        {
                            id: "q_team_roles",
                            type: "paragraph",
                            title: "Member Role Distribution",
                            description: "Who is responsible for frontend, backend, design, and presentation?",
                            required: true,
                        },
                    ],
                },
            ],
        },
    },
];

/**
 * Instantiate a template with completely fresh stable IDs so it can be safely edited and customized
 */
export function instantiateTemplate(templateIdOrDef: string | FormTemplateDefinition): {
    title: string;
    description: string;
    structure: FormStructure;
    sections: FormSection[];
    themeSettings: FormThemeSettings;
    settings?: Partial<FormSettings>;
} {
    const tmpl =
        typeof templateIdOrDef === "string"
            ? ORBIX_FORM_TEMPLATES.find((t) => t.id === templateIdOrDef) || ORBIX_FORM_TEMPLATES[0]
            : templateIdOrDef;

    const freshSections: FormSection[] = tmpl.structure.sections.map((sec) => ({
        ...sec,
        id: makeId("sec"),
        questions: sec.questions.map((q) => ({
            ...q,
            id: makeId("q"),
            options: q.options?.map((opt) => ({
                ...opt,
                id: makeId("opt"),
            })),
        })),
    }));

    return {
        title: tmpl.title,
        description: tmpl.description || tmpl.summary,
        structure: { sections: freshSections },
        sections: freshSections,
        themeSettings: { ...tmpl.themeSettings },
        settings: tmpl.settings ? { ...tmpl.settings } : undefined,
    };
}
