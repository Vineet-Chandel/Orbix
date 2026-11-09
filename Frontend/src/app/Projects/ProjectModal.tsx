import React, { useState, useEffect } from "react";
import {
    X,
    Sparkles,
    Globe,
    Trash2,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Clock,
    AlertTriangle,
    Lock,
    Shield,
    EyeOff,
    Eye,
    Plus,
    MoveUp,
    MoveDown,
    Link as LinkIcon,
    BookOpen,
    Users,
    Award,
    Zap,
    Sliders,
    Save,
    Rocket,
    Layout,
    RotateCcw,
    GitCompare,
} from "lucide-react";
import type {
    ProjectItem,
    CreateProjectInput,
    UpdateProjectInput,
    RepoAnalysisResult,
    ProjectType,
    DevelopmentStatus,
    ProjectCategory,
    ProjectGalleryImage,
    TechnologyItem,
} from "../../types/project";
import {
    analyzeGithubRepo,
    createProject,
    updateProject,
    initiateGithubAppInstall,
} from "../../api/projectApi";
import { ExtractionScorecardView } from "../../components/projects/ExtractionScorecardView";
import { InitialReviewScreen } from "../../components/projects/InitialReviewScreen";
import { MediaUploadDropzone } from "../../components/projects/MediaUploadDropzone";
import { TechnologyStackEditor } from "../../components/projects/TechnologyStackEditor";
import { ProjectSyncDiffModal } from "../../components/projects/ProjectSyncDiffModal";
import { ConfirmationModal } from "../../components/ConfirmationModal";
import { NeoSelect } from "../../components/NeoSelect";
import { NeoCheckbox } from "../../components/NeoCheckbox";
import { useToast } from "../../context/ToastContext";
import { useModalDismiss } from "../../hooks/useModalDismiss";

interface ProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSaved: (project: ProjectItem) => void;
    initialProject?: ProjectItem | null;
}

const CATEGORIES: ProjectCategory[] = [
    "Full-Stack",
    "Frontend",
    "Backend",
    "AI / ML",
    "Distributed Systems",
    "Open Source",
    "Mobile",
    "CLI / Developer Tool",
    "Cloud & DevOps",
    "Cybersecurity",
    "Web3",
    "Hardware / IoT",
    "Other",
];

const PROJECT_TYPES: ProjectType[] = [
    "Web application",
    "Mobile application",
    "Desktop application",
    "AI / Machine Learning",
    "Developer tool",
    "Open-source project",
    "API / Backend service",
    "Research project",
    "Hardware / IoT project",
    "Other",
];

const DEV_STATUSES: DevelopmentStatus[] = [
    "In development",
    "Completed",
    "Maintenance",
    "Experimental",
    "Archived",
];

const SUGGESTED_TECH = [
    "TypeScript",
    "React",
    "Next.js",
    "Node.js",
    "Python",
    "Go",
    "Rust",
    "PostgreSQL",
    "Redis",
    "Docker",
    "Kubernetes",
    "GraphQL",
    "Tailwind CSS",
    "FastAPI",
    "PyTorch",
    "WASM",
];

const EXTRACTION_STEPS = [
    { title: "Verifying Repository Provider & Accessibility", desc: "Validating GitHub URL format and checking API connectivity..." },
    { title: "Extracting Repository Metadata & Statistics", desc: "Retrieving stars, forks, watchers, open issues, and latest release..." },
    { title: "Analyzing Programming Languages & Contributors", desc: "Computing language byte distributions and contributor metrics..." },
    { title: "Inspecting Dependency Manifests", desc: "Scanning package.json / manifests for frameworks, databases, and dev tools..." },
    { title: "Parsing README for Architecture & Screenshots", desc: "Analyzing Markdown AST for system design, features, and assets..." },
    { title: "Synthesizing Showcase Intelligence", desc: "Compiling field provenance audit and completeness scorecard..." },
];

type FormTab =
    | "identity"
    | "story"
    | "features"
    | "tech"
    | "links"
    | "media"
    | "contribution"
    | "details"
    | "privacy";

export const ProjectModal: React.FC<ProjectModalProps> = ({
    isOpen,
    onClose,
    onSaved,
    initialProject,
}) => {
    const toast = useToast();

    const isEditMode = Boolean(initialProject);

    // Lifecycle state: input_repo -> analyzing -> private_detected -> initial_review -> reviewed_and_editing -> saving -> error
    const [lifecycleStage, setLifecycleStage] = useState<
        "input_repo" | "analyzing" | "private_detected" | "initial_review" | "reviewed_and_editing" | "saving" | "error"
    >(isEditMode ? "reviewed_and_editing" : "input_repo");

    const [activeTab, setActiveTab] = useState<FormTab>("identity");
    const [showUnsavedWarning, setShowUnsavedWarning] = useState(false);

    const [repoInput, setRepoInput] = useState("");
    const [providerWarning, setProviderWarning] = useState<string | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [isIncompleteAnalysis, setIsIncompleteAnalysis] = useState(false);
    const [analysisResult, setAnalysisResult] = useState<RepoAnalysisResult | null>(null);
    const [activeStepIndex, setActiveStepIndex] = useState(0);

    // Phase 3: Private Repository Handling & Security States
    const [isRepoPrivate, setIsRepoPrivate] = useState(false);
    const [hideRepoUrl, setHideRepoUrl] = useState(false);
    const [isConnectingGithub, setIsConnectingGithub] = useState(false);
    const [privateRepoInfo, setPrivateRepoInfo] = useState<{
        owner: string;
        repo: string;
        repoUrl: string;
    } | null>(null);

    // Section A — Project Identity
    const [title, setTitle] = useState("");
    const [tagline, setTagline] = useState("");
    const [description, setDescription] = useState("");
    const [fullOverview, setFullOverview] = useState("");
    const [category, setCategory] = useState<string>("Full-Stack");
    const [projectType, setProjectType] = useState<ProjectType>("Web application");
    const [developmentStatus, setDevelopmentStatus] = useState<DevelopmentStatus>("Completed");
    const [isPinned, setIsPinned] = useState(false);
    const [showOnProfile, setShowOnProfile] = useState(true);

    // Section B — Project Story
    const [problemStatement, setProblemStatement] = useState("");
    const [motivation, setMotivation] = useState("");
    const [solution, setSolution] = useState("");
    const [targetAudience, setTargetAudience] = useState("");
    const [differentiation, setDifferentiation] = useState("");
    const [challenges, setChallenges] = useState("");
    const [learnings, setLearnings] = useState("");

    // Section C — Features
    const [features, setFeatures] = useState<Array<{ id?: string; title: string; description?: string; iconOrImage?: string }>>([]);
    const [newFeatureTitle, setNewFeatureTitle] = useState("");
    const [newFeatureDesc, setNewFeatureDesc] = useState("");

    // Section D — Technology Stack (Categorized)
    const [categorizedTech, setCategorizedTech] = useState<Record<string, TechnologyItem[]>>({});

    // Section E — Project Links
    const [repoUrl, setRepoUrl] = useState("");
    const [repoName, setRepoName] = useState("");
    const [repoStars, setRepoStars] = useState(0);
    const [repoForks, setRepoForks] = useState(0);
    const [repoLanguage, setRepoLanguage] = useState("");
    const [liveUrl, setLiveUrl] = useState("");
    const [demoVideoUrl, setDemoVideoUrl] = useState("");
    const [documentationUrl, setDocumentationUrl] = useState("");
    const [apiDocUrl, setApiDocUrl] = useState("");
    const [figmaUrl, setFigmaUrl] = useState("");
    const [customLinks, setCustomLinks] = useState<Array<{ id: string; label: string; url: string; isHidden?: boolean }>>([]);
    const [newCustomLinkLabel, setNewCustomLinkLabel] = useState("");
    const [newCustomLinkUrl, setNewCustomLinkUrl] = useState("");

    // Section F — Images and Media
    const [imageUrl, setImageUrl] = useState("");
    const [galleryImages, setGalleryImages] = useState<ProjectGalleryImage[]>([]);

    // Section G — Contributor Information
    const [myRole, setMyRole] = useState("");
    const [myResponsibilities, setMyResponsibilities] = useState("");
    const [isTeamProject, setIsTeamProject] = useState(false);
    const [teamMembers, setTeamMembers] = useState<string[]>([]);
    const [newTeamMemberInput, setNewTeamMemberInput] = useState("");
    const [contributionDescription, setContributionDescription] = useState("");

    // Section H — Additional Details
    const [achievements, setAchievements] = useState<string[]>([]);
    const [newAchievementInput, setNewAchievementInput] = useState("");
    const [performanceMetrics, setPerformanceMetrics] = useState<Array<{ id: string; label: string; value: string }>>([]);
    const [newMetricLabel, setNewMetricLabel] = useState("");
    const [newMetricValue, setNewMetricValue] = useState("");
    const [futureImprovements, setFutureImprovements] = useState<string[]>([]);
    const [newFutureImprovementInput, setNewFutureImprovementInput] = useState("");
    const [deploymentInfo, setDeploymentInfo] = useState("");
    const [customFields, setCustomFields] = useState<Array<{ id: string; key: string; value: string }>>([]);
    const [newFieldKey, setNewFieldKey] = useState("");
    const [newFieldValue, setNewFieldValue] = useState("");
    const [additionalNotes, setAdditionalNotes] = useState("");
    const [architectureNotes, setArchitectureNotes] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Phase 5: Provenance & Override State
    const [fieldOverrides, setFieldOverrides] = useState<Record<string, boolean>>({});
    const [rawExtractedData, setRawExtractedData] = useState<Record<string, any>>({});
    const [isSyncModalOpen, setIsSyncModalOpen] = useState(false);

    const handleAttemptClose = () => {
        const isDirty =
            (title.trim().length > 0 && title !== (initialProject?.title || "")) ||
            (tagline.trim().length > 0 && tagline !== (initialProject?.tagline || "")) ||
            (description.trim().length > 0 && description !== (initialProject?.description || "")) ||
            (repoInput.trim().length > 0 && !isEditMode);
        if (isDirty) {
            setShowUnsavedWarning(true);
        } else {
            onClose();
        }
    };

    useModalDismiss({ isOpen, onClose: handleAttemptClose });

    const markFieldOverridden = (field: string) => {
        setFieldOverrides((prev) => {
            if (prev[field]) return prev;
            return { ...prev, [field]: true };
        });
    };

    const handleResetField = (field: string) => {
        if (!rawExtractedData || rawExtractedData[field] === undefined) {
            toast.error(`No original extracted repository data found for ${field}.`);
            return;
        }
        const val = rawExtractedData[field];
        switch (field) {
            case "title":
                setTitle(val || "");
                break;
            case "tagline":
                setTagline(val || "");
                break;
            case "description":
                setDescription(val || "");
                break;
            case "fullOverview":
                setFullOverview(val || "");
                break;
            case "category":
                setCategory(val || "Full-Stack");
                break;
            case "liveUrl":
                setLiveUrl(val || "");
                break;
            case "documentationUrl":
                setDocumentationUrl(val || "");
                break;
            case "architectureNotes":
                setArchitectureNotes(val || "");
                break;
            case "features":
                if (Array.isArray(val)) {
                    setFeatures(
                        val.map((f: any) =>
                            typeof f === "string"
                                ? { title: f }
                                : { title: f.title, description: f.description, iconOrImage: f.iconOrImage }
                        )
                    );
                }
                break;
            case "technologies":
                if (Array.isArray(val)) {
                    const techMap: Record<string, TechnologyItem[]> = {};
                    val.forEach((t: string) => {
                        const cat = "Other";
                        if (!techMap[cat]) techMap[cat] = [];
                        techMap[cat].push({ name: t, category: cat, verified: true });
                    });
                    setCategorizedTech(techMap);
                }
                break;
            default:
                break;
        }
        setFieldOverrides((prev) => ({ ...prev, [field]: false }));
        toast.success(`Field '${field}' reset to repository extracted value.`);
    };

    const renderFieldProvenanceBadge = (field: string, label: string) => {
        if (!rawExtractedData || rawExtractedData[field] === undefined) {
            return null;
        }
        const isOverridden = fieldOverrides[field] === true;

        return (
            <div className="flex items-center gap-1.5 ml-auto">
                {isOverridden ? (
                    <>
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-[#FFE566] text-black border border-black shadow-[1px_1px_0px_#000]">
                            <Shield className="w-2.5 h-2.5 text-amber-900" />
                            Custom Edit
                        </span>
                        <button
                            type="button"
                            onClick={() => handleResetField(field)}
                            className="inline-flex items-center gap-0.5 text-[10px] font-black text-neutral-600 hover:text-black hover:underline cursor-pointer"
                            title={`Reset ${label} back to GitHub extracted value`}
                        >
                            <RotateCcw className="w-2.5 h-2.5 text-neutral-500" />
                            Reset
                        </button>
                    </>
                ) : (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black bg-[#a2ff86]/30 text-emerald-900 border border-emerald-400">
                        <Sparkles className="w-2.5 h-2.5 text-emerald-700" />
                        GitHub Synced
                    </span>
                )}
            </div>
        );
    };

    // Initialize or reset form state
    useEffect(() => {
        if (!isOpen) return;

        if (initialProject) {
            setTitle(initialProject.title || "");
            setTagline(initialProject.tagline || "");
            setDescription(initialProject.description || "");
            setFullOverview(initialProject.fullOverview || "");
            setCategory(initialProject.category || "Full-Stack");
            setProjectType((initialProject.projectType as ProjectType) || "Web application");
            setDevelopmentStatus((initialProject.developmentStatus as DevelopmentStatus) || "Completed");
            setIsPinned(Boolean(initialProject.isPinned));
            setShowOnProfile(initialProject.showOnProfile !== undefined ? Boolean(initialProject.showOnProfile) : true);
            setIsRepoPrivate(Boolean(initialProject.isRepoPrivate));
            setHideRepoUrl(Boolean(initialProject.hideRepoUrl));

            // Provenance
            setFieldOverrides(initialProject.fieldOverrides || {});
            setRawExtractedData(initialProject.rawExtractedData || {});

            // Story
            if (initialProject.story) {
                setProblemStatement(initialProject.story.problemStatement || "");
                setMotivation(initialProject.story.motivation || "");
                setSolution(initialProject.story.solution || "");
                setTargetAudience(initialProject.story.targetAudience || "");
                setDifferentiation(initialProject.story.differentiation || "");
                setChallenges(initialProject.story.challenges || "");
                setLearnings(initialProject.story.learnings || "");
            } else {
                setProblemStatement("");
                setMotivation("");
                setSolution("");
                setTargetAudience("");
                setDifferentiation("");
                setChallenges("");
                setLearnings("");
            }

            // Features
            setFeatures(
                (initialProject.features || []).map((f) =>
                    typeof f === "string" ? { title: f } : { title: f.title, description: f.description, iconOrImage: f.iconOrImage }
                )
            );

            // Categorized Tech
            if (initialProject.categorizedTechnologies && Object.keys(initialProject.categorizedTechnologies).length > 0) {
                setCategorizedTech(initialProject.categorizedTechnologies);
            } else {
                // Populate from flat technologies
                const initialTechMap: Record<string, TechnologyItem[]> = {};
                (initialProject.technologies || []).forEach((t) => {
                    const defaultCat = "Other";
                    if (!initialTechMap[defaultCat]) initialTechMap[defaultCat] = [];
                    initialTechMap[defaultCat].push({ name: t, category: defaultCat, verified: false });
                });
                setCategorizedTech(initialTechMap);
            }

            // Links
            setImageUrl(initialProject.imageUrl || "");
            setRepoUrl(initialProject.repoUrl || "");
            setRepoName(initialProject.repoName || "");
            setRepoStars(initialProject.repoStars || 0);
            setRepoForks(initialProject.repoForks || 0);
            setRepoLanguage(initialProject.repoLanguage || "");
            setLiveUrl(initialProject.liveUrl || "");
            setDemoVideoUrl(initialProject.demoVideoUrl || "");
            setDocumentationUrl(initialProject.documentationUrl || "");
            setApiDocUrl(initialProject.apiDocUrl || "");
            setFigmaUrl(initialProject.figmaUrl || "");
            setCustomLinks(
                (initialProject.externalLinks || []).map((l, i) => ({
                    id: l.id || `link_${i}`,
                    label: l.label,
                    url: l.url,
                    isHidden: l.isHidden,
                }))
            );

            // Gallery
            setGalleryImages(
                (initialProject.galleryImages || []).map((img, i) =>
                    typeof img === "string"
                        ? { id: `gal_${i}`, url: img, type: "screenshot" as const }
                        : img
                )
            );

            // Contribution
            if (initialProject.contribution) {
                setMyRole(initialProject.contribution.myRole || "");
                setMyResponsibilities(initialProject.contribution.myResponsibilities || "");
                setIsTeamProject(Boolean(initialProject.contribution.isTeamProject));
                setTeamMembers(initialProject.contribution.teamMembers || []);
                setContributionDescription(initialProject.contribution.contributionDescription || "");
            } else {
                setMyRole("");
                setMyResponsibilities("");
                setIsTeamProject(false);
                setTeamMembers([]);
                setContributionDescription("");
            }

            // Additional Details
            if (initialProject.additionalDetails) {
                setAchievements(initialProject.additionalDetails.achievements || []);
                setPerformanceMetrics(
                    (initialProject.additionalDetails.performanceMetrics || []).map((m, i) => ({
                        id: `m_${i}`,
                        label: m.label,
                        value: m.value,
                    }))
                );
                setFutureImprovements(initialProject.additionalDetails.futureImprovements || []);
                setDeploymentInfo(initialProject.additionalDetails.deploymentInfo || "");
                setCustomFields(
                    (initialProject.additionalDetails.customFields || []).map((f, i) => ({
                        id: `f_${i}`,
                        key: f.key,
                        value: f.value,
                    }))
                );
                setAdditionalNotes(initialProject.additionalDetails.notes || "");
            } else {
                setAchievements([]);
                setPerformanceMetrics([]);
                setFutureImprovements([]);
                setDeploymentInfo("");
                setCustomFields([]);
                setAdditionalNotes("");
            }

            setAnalysisResult(null);
            setPrivateRepoInfo(null);
            setProviderWarning(null);
            setActiveTab("identity");
            setLifecycleStage("reviewed_and_editing");
        } else {
            // Reset for new creation
            setRepoInput("");
            setAnalysisError(null);
            setProviderWarning(null);
            setIsIncompleteAnalysis(false);
            setAnalysisResult(null);
            setPrivateRepoInfo(null);
            setIsConnectingGithub(false);
            setActiveStepIndex(0);
            setActiveTab("identity");

            setFieldOverrides({});
            setRawExtractedData({});

            setTitle("");
            setTagline("");
            setDescription("");
            setFullOverview("");
            setCategory("Full-Stack");
            setProjectType("Web application");
            setDevelopmentStatus("Completed");
            setIsPinned(false);
            setShowOnProfile(true);
            setIsRepoPrivate(false);
            setHideRepoUrl(false);

            setProblemStatement("");
            setMotivation("");
            setSolution("");
            setTargetAudience("");
            setDifferentiation("");
            setChallenges("");
            setLearnings("");

            setFeatures([]);
            setCategorizedTech({});

            setImageUrl("");
            setRepoUrl("");
            setRepoName("");
            setRepoStars(0);
            setRepoForks(0);
            setRepoLanguage("");
            setLiveUrl("");
            setDemoVideoUrl("");
            setDocumentationUrl("");
            setApiDocUrl("");
            setFigmaUrl("");
            setCustomLinks([]);
            setGalleryImages([]);

            setMyRole("");
            setMyResponsibilities("");
            setIsTeamProject(false);
            setTeamMembers([]);
            setContributionDescription("");

            setAchievements([]);
            setPerformanceMetrics([]);
            setFutureImprovements([]);
            setDeploymentInfo("");
            setCustomFields([]);
            setAdditionalNotes("");

            setLifecycleStage("input_repo");
        }
    }, [isOpen, initialProject]);

    // Animate multi-stage progress during analysis
    useEffect(() => {
        if (lifecycleStage !== "analyzing") return;
        setActiveStepIndex(0);
        const interval = setInterval(() => {
            setActiveStepIndex((prev) => Math.min(prev + 1, EXTRACTION_STEPS.length - 1));
        }, 650);
        return () => clearInterval(interval);
    }, [lifecycleStage]);

    // Handle input change with provider checking
    const handleRepoInputChange = (val: string) => {
        setRepoInput(val);
        setAnalysisError(null);
        const lower = val.toLowerCase();
        if (
            lower.includes("gitlab.com") ||
            lower.includes("bitbucket.org") ||
            lower.includes("sourceforge.net") ||
            lower.includes("codeberg.org")
        ) {
            setProviderWarning(
                "Only GitHub repositories are currently supported for automated intelligent extraction. You can still add your project using manual entry."
            );
        } else {
            setProviderWarning(null);
        }
    };

    // Helper: Map extracted intelligence into categorized technologies
    const mapExtractedTechToCategories = (a: RepoAnalysisResult): Record<string, TechnologyItem[]> => {
        const result: Record<string, TechnologyItem[]> = {};

        // Languages
        const langs = a.languages || [];
        if (langs.length > 0) {
            result["Languages"] = langs.map((l) => ({
                name: l.name,
                category: "Languages",
                verified: true,
                confidence: 1.0,
            }));
        } else if (a.primaryLanguage || a.repoLanguage) {
            const lang = a.primaryLanguage || a.repoLanguage || "";
            result["Languages"] = [{ name: lang, category: "Languages", verified: true, confidence: 1.0 }];
        }

        // Frameworks -> Frontend/Backend
        const frameworks = a.technicalFacts?.frameworks || [];
        frameworks.forEach((f) => {
            const isFe = ["React", "Next.js", "Vue", "Angular", "Svelte", "Tailwind CSS", "Vite"].some((x) =>
                f.toLowerCase().includes(x.toLowerCase())
            );
            const cat = isFe ? "Frontend" : "Backend";
            if (!result[cat]) result[cat] = [];
            result[cat].push({ name: f, category: cat, verified: true, confidence: 1.0 });
        });

        // Databases
        const dbs = a.technicalFacts?.databases || [];
        if (dbs.length > 0) {
            result["Database"] = dbs.map((d) => ({
                name: d,
                category: "Database",
                verified: true,
                confidence: 1.0,
            }));
        }

        // Dev Tools & Package Managers
        const tools = [
            ...(a.technicalFacts?.devTools || []),
            ...(a.technicalFacts?.packageManagers || []),
        ];
        if (tools.length > 0) {
            result["Development tools"] = tools.map((t) => ({
                name: t,
                category: "Development tools",
                verified: true,
                confidence: 1.0,
            }));
        }

        // Inferred technologies
        const inferred = a.inferredMetadata?.technologies || [];
        inferred.forEach((inf) => {
            const alreadyExists = Object.values(result).some((list) =>
                list.some((item) => item.name.toLowerCase() === inf.toLowerCase())
            );
            if (!alreadyExists) {
                if (!result["Other"]) result["Other"] = [];
                result["Other"].push({ name: inf, category: "Other", verified: false, confidence: 0.7 });
            }
        });

        return result;
    };

    // Handle Repository Intelligence Extraction
    const handleAnalyzeRepo = async (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const clean = repoInput.trim();
        if (!clean) {
            setAnalysisError("Please enter a GitHub repository URL or handle (e.g. facebook/react).");
            return;
        }

        setLifecycleStage("analyzing");
        setActiveStepIndex(0);
        setAnalysisError(null);
        setProviderWarning(null);
        setIsIncompleteAnalysis(false);

        try {
            const res = await analyzeGithubRepo(clean);

            // Phase 3.1: Private repository detection
            if (res.isLikelyPrivate) {
                setPrivateRepoInfo({
                    owner: res.owner || "",
                    repo: res.repo || "",
                    repoUrl: res.repoUrl || clean,
                });
                setIsRepoPrivate(true);
                setLifecycleStage("private_detected");
                return;
            }

            if (res.success && res.analysis) {
                const a = res.analysis;
                setAnalysisResult(a);
                setTitle(a.title || "");
                setTagline(a.tagline || "");
                setDescription(a.description || "");
                setFullOverview(a.description || "");
                setCategory(a.category || "Full-Stack");
                setRepoUrl(a.repoUrl || "");
                setRepoName(a.repoName || "");
                setRepoStars(a.repoStars || a.stars || 0);
                setRepoForks(a.repoForks || a.forks || 0);
                setRepoLanguage(a.repoLanguage || a.primaryLanguage || "");
                setLiveUrl(a.liveUrl || "");
                setDocumentationUrl(a.documentationUrl || "");
                setArchitectureNotes(a.architectureNotes || "");

                // Suggest Project Type
                if (a.category?.toLowerCase().includes("mobile")) {
                    setProjectType("Mobile application");
                } else if (a.category?.toLowerCase().includes("cli") || a.category?.toLowerCase().includes("tool")) {
                    setProjectType("Developer tool");
                } else if (a.category?.toLowerCase().includes("ai") || a.category?.toLowerCase().includes("ml")) {
                    setProjectType("AI / Machine Learning");
                } else {
                    setProjectType("Web application");
                }

                if (a.screenshots && a.screenshots.length > 0) {
                    setImageUrl(a.screenshots[0].url);
                }

                // Categorized technologies
                const mappedTech = mapExtractedTechToCategories(a);
                setCategorizedTech(mappedTech);

                // Features
                setFeatures(
                    (a.features || []).map((f) => ({
                        title: f.title,
                        description: f.description,
                    }))
                );

                // Populate raw extracted provenance snapshot
                setRawExtractedData({
                    title: a.title,
                    tagline: a.tagline,
                    description: a.description,
                    fullOverview: a.description,
                    category: a.category,
                    repoUrl: a.repoUrl,
                    repoName: a.repoName,
                    repoStars: a.repoStars || a.stars || 0,
                    repoForks: a.repoForks || a.forks || 0,
                    repoLanguage: a.repoLanguage || a.primaryLanguage || null,
                    repoLicense: a.repoLicense || a.license || null,
                    liveUrl: a.liveUrl || null,
                    documentationUrl: a.documentationUrl || null,
                    technologies: a.technologies || [],
                    features: a.features || [],
                    architectureNotes: a.architectureNotes || null,
                });
                setFieldOverrides({});

                if (!a.description || a.features.length === 0 || !a.liveUrl) {
                    setIsIncompleteAnalysis(true);
                }

                // Phase 4.1: Transition to Initial Review Screen
                setLifecycleStage("initial_review");
                toast.success("Repository analyzed! You can use as is or review & edit.");
            } else {
                throw new Error(res.message || "Could not analyze repository.");
            }
        } catch (err: any) {
            setAnalysisError(err.message || "Failed to analyze repository. Check URL or enter manually.");
            setLifecycleStage("error");
        }
    };

    // Phase 3.1 Handlers
    const handleConnectGithubApp = async () => {
        setIsConnectingGithub(true);
        try {
            const repoHint = privateRepoInfo?.repoUrl || repoInput.trim();
            const res = await initiateGithubAppInstall(repoHint);
            if (res.success && res.installUrl) {
                window.location.href = res.installUrl;
            } else {
                toast.error("Failed to generate GitHub authorization link.");
            }
        } catch (err: any) {
            toast.error(err.message || "Could not initiate GitHub authorization.");
        } finally {
            setIsConnectingGithub(false);
        }
    };

    const handleManualEntryFallback = () => {
        if (privateRepoInfo) {
            setRepoName(`${privateRepoInfo.owner}/${privateRepoInfo.repo}`);
            setRepoUrl(privateRepoInfo.repoUrl);
            setTitle(privateRepoInfo.repo);
        }
        setLifecycleStage("reviewed_and_editing");
        setActiveTab("identity");
    };

    // Dynamic Lists Manipulators (Features, Links, Team, Metrics, Fields)
    const handleAddFeature = () => {
        const titleClean = newFeatureTitle.trim();
        if (!titleClean) return;
        setFeatures([
            ...features,
            {
                id: `feat_${Date.now()}`,
                title: titleClean,
                description: newFeatureDesc.trim() || undefined,
            },
        ]);
        markFieldOverridden("features");
        setNewFeatureTitle("");
        setNewFeatureDesc("");
    };

    const handleRemoveFeature = (index: number) => {
        setFeatures(features.filter((_, i) => i !== index));
        markFieldOverridden("features");
    };

    const handleMoveFeature = (index: number, direction: "up" | "down") => {
        const target = direction === "up" ? index - 1 : index + 1;
        if (target < 0 || target >= features.length) return;
        const copy = [...features];
        const [moved] = copy.splice(index, 1);
        copy.splice(target, 0, moved);
        setFeatures(copy);
        markFieldOverridden("features");
    };

    const handleAddCustomLink = () => {
        const labelClean = newCustomLinkLabel.trim();
        const urlClean = newCustomLinkUrl.trim();
        if (!labelClean || !urlClean) return;

        if (!/^https?:\/\//i.test(urlClean)) {
            toast.error("Links must begin with http:// or https://");
            return;
        }

        setCustomLinks([
            ...customLinks,
            {
                id: `link_${Date.now()}`,
                label: labelClean,
                url: urlClean,
                isHidden: false,
            },
        ]);
        setNewCustomLinkLabel("");
        setNewCustomLinkUrl("");
    };

    const handleRemoveCustomLink = (id: string) => {
        setCustomLinks(customLinks.filter((l) => l.id !== id));
    };

    const handleToggleLinkVisibility = (id: string) => {
        setCustomLinks(
            customLinks.map((l) => (l.id === id ? { ...l, isHidden: !l.isHidden } : l))
        );
    };

    const handleAddTeamMember = () => {
        const clean = newTeamMemberInput.trim();
        if (!clean || teamMembers.includes(clean)) return;
        setTeamMembers([...teamMembers, clean]);
        setNewTeamMemberInput("");
    };

    const handleRemoveTeamMember = (index: number) => {
        setTeamMembers(teamMembers.filter((_, i) => i !== index));
    };

    const handleAddAchievement = () => {
        const clean = newAchievementInput.trim();
        if (!clean || achievements.includes(clean)) return;
        setAchievements([...achievements, clean]);
        setNewAchievementInput("");
    };

    const handleRemoveAchievement = (index: number) => {
        setAchievements(achievements.filter((_, i) => i !== index));
    };

    const handleAddMetric = () => {
        const lClean = newMetricLabel.trim();
        const vClean = newMetricValue.trim();
        if (!lClean || !vClean) return;
        setPerformanceMetrics([
            ...performanceMetrics,
            { id: `metric_${Date.now()}`, label: lClean, value: vClean },
        ]);
        setNewMetricLabel("");
        setNewMetricValue("");
    };

    const handleRemoveMetric = (id: string) => {
        setPerformanceMetrics(performanceMetrics.filter((m) => m.id !== id));
    };

    const handleAddFutureImprovement = () => {
        const clean = newFutureImprovementInput.trim();
        if (!clean || futureImprovements.includes(clean)) return;
        setFutureImprovements([...futureImprovements, clean]);
        setNewFutureImprovementInput("");
    };

    const handleRemoveFutureImprovement = (index: number) => {
        setFutureImprovements(futureImprovements.filter((_, i) => i !== index));
    };

    const handleAddCustomField = () => {
        const kClean = newFieldKey.trim();
        const vClean = newFieldValue.trim();
        if (!kClean || !vClean) return;
        setCustomFields([
            ...customFields,
            { id: `cf_${Date.now()}`, key: kClean, value: vClean },
        ]);
        setNewFieldKey("");
        setNewFieldValue("");
    };

    const handleRemoveCustomField = (id: string) => {
        setCustomFields(customFields.filter((f) => f.id !== id));
    };

    // Form Submission (Save as Draft or Publish)
    const handleSave = async (targetStatus: "published" | "draft") => {
        if (!title.trim()) {
            toast.error("Project title is required.");
            setActiveTab("identity");
            return;
        }

        setIsSaving(true);
        setLifecycleStage("saving");

        // Compute flat technologies array from categorized technologies
        const flatTechnologies: string[] = [];
        Object.values(categorizedTech).forEach((list) => {
            list.forEach((t) => {
                if (!flatTechnologies.includes(t.name)) {
                    flatTechnologies.push(t.name);
                }
            });
        });

        // Assemble comprehensive Phase 4 payload
        const payload: CreateProjectInput | UpdateProjectInput = {
            title: title.trim(),
            tagline: tagline.trim() || undefined,
            description: description.trim() || undefined,
            shortDescription: description ? description.slice(0, 300) : undefined,
            fullOverview: fullOverview.trim() || undefined,
            category,
            projectType,
            developmentStatus,
            status: targetStatus,
            isPublished: targetStatus === "published",
            isPinned,
            showOnProfile,
            isRepoPrivate,
            hideRepoUrl,
            imageUrl: imageUrl.trim() || undefined,
            galleryImages,
            repoUrl: repoUrl.trim() || undefined,
            repoName: repoName.trim() || undefined,
            repoStars,
            repoForks,
            repoLanguage: repoLanguage.trim() || undefined,
            liveUrl: liveUrl.trim() || undefined,
            demoVideoUrl: demoVideoUrl.trim() || undefined,
            documentationUrl: documentationUrl.trim() || undefined,
            apiDocUrl: apiDocUrl.trim() || undefined,
            figmaUrl: figmaUrl.trim() || undefined,
            externalLinks: customLinks,
            technologies: flatTechnologies,
            categorizedTechnologies: categorizedTech,
            features,
            architectureNotes: architectureNotes.trim() || undefined,
            story: {
                problemStatement: problemStatement.trim() || undefined,
                motivation: motivation.trim() || undefined,
                solution: solution.trim() || undefined,
                targetAudience: targetAudience.trim() || undefined,
                differentiation: differentiation.trim() || undefined,
                challenges: challenges.trim() || undefined,
                learnings: learnings.trim() || undefined,
            },
            contribution: {
                myRole: myRole.trim() || undefined,
                myResponsibilities: myResponsibilities.trim() || undefined,
                isTeamProject,
                teamMembers: isTeamProject && teamMembers.length > 0 ? teamMembers : undefined,
                contributionDescription: contributionDescription.trim() || undefined,
            },
            additionalDetails: {
                achievements: achievements.length > 0 ? achievements : undefined,
                performanceMetrics: performanceMetrics.length > 0 ? performanceMetrics : undefined,
                futureImprovements: futureImprovements.length > 0 ? futureImprovements : undefined,
                deploymentInfo: deploymentInfo.trim() || undefined,
                customFields: customFields.length > 0 ? customFields : undefined,
                notes: additionalNotes.trim() || undefined,
            },
            rawExtractedData: Object.keys(rawExtractedData).length > 0 ? rawExtractedData : undefined,
            fieldOverrides: Object.keys(fieldOverrides).length > 0 ? fieldOverrides : undefined,
        };

        try {
            if (isEditMode && initialProject) {
                const res = await updateProject(initialProject.id, payload);
                toast.success("Project updated successfully!");
                onSaved(res.project);
            } else {
                const res = await createProject(payload as CreateProjectInput);
                toast.success(
                    targetStatus === "published"
                        ? "Project published to your showcase!"
                        : "Project saved as draft."
                );
                onSaved(res.project);
            }
            onClose();
        } catch (err: any) {
            toast.error(err.message || "Failed to save project.");
            setLifecycleStage("reviewed_and_editing");
        } finally {
            setIsSaving(false);
        }
    };

    if (!isOpen) return null;

    // Badges calculation for navigation tabs
    const totalTechCount = Object.values(categorizedTech).reduce((s, l) => s + l.length, 0);
    const totalMediaCount = (imageUrl ? 1 : 0) + galleryImages.length;
    const totalLinksCount = [repoUrl, liveUrl, documentationUrl, apiDocUrl, demoVideoUrl, figmaUrl].filter(Boolean).length + customLinks.length;

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm animate-fadeIn"
            role="dialog"
            aria-modal="true"
        >
            <div className="relative w-full max-w-4xl max-h-[92vh] bg-[#FAF6EE] border-[3px] border-black rounded-3xl shadow-[8px_8px_0px_#000] flex flex-col overflow-hidden">
                {/* Modal Header */}
                <div className="flex items-center justify-between p-5 sm:p-6 bg-white border-b-2 border-black shrink-0">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-black uppercase tracking-wider bg-black text-[#a2ff86] px-2 py-0.5">
                                {isEditMode ? "Edit Project" : "Project Showcase Studio"}
                            </span>
                            {developmentStatus && (
                                <span className="text-xs font-bold bg-[#FAF6EE] text-black border border-black px-2 py-0.5 hidden sm:inline-block">
                                    {developmentStatus}
                                </span>
                            )}
                        </div>
                        <h2 className="text-xl sm:text-2xl font-black text-black tracking-tight">
                            {isEditMode ? `Edit "${title || initialProject?.title}"` : "Add Project to Showcase"}
                        </h2>
                    </div>

                    <div className="flex items-center gap-2">
                        {isEditMode && initialProject?.repoUrl && (
                            <button
                                type="button"
                                onClick={() => setIsSyncModalOpen(true)}
                                className="px-3 py-1.5 rounded-xl bg-white hover:bg-[#FAF6EE] text-black border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] active:translate-y-0.5 transition-all flex items-center gap-1.5 cursor-pointer"
                                title="Inspect upstream GitHub changes & merge with non-destructive diff engine"
                            >
                                <GitCompare className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Sync Repo</span>
                            </button>
                        )}

                        <button
                            onClick={handleAttemptClose}
                            className="p-2 border-2 border-black bg-white hover:bg-[#a2ff86] text-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer"
                            aria-label="Close modal"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Sub-Header Tabs (Active when in reviewed_and_editing) */}
                {lifecycleStage === "reviewed_and_editing" && (
                    <div className="bg-[#FAF6EE] border-b-2 border-black px-4 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0 scrollbar-none">
                        <button
                            type="button"
                            onClick={() => setActiveTab("identity")}
                            className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-2 border-black transition-all shrink-0 ${
                                activeTab === "identity"
                                    ? "bg-black text-white shadow-[2px_2px_0px_#a2ff86]"
                                    : "bg-white text-black hover:bg-neutral-100 shadow-[2px_2px_0px_#000]"
                            }`}
                        >
                            A. Identity
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("story")}
                            className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-2 border-black transition-all shrink-0 ${
                                activeTab === "story"
                                    ? "bg-black text-white shadow-[2px_2px_0px_#a2ff86]"
                                    : "bg-white text-black hover:bg-neutral-100 shadow-[2px_2px_0px_#000]"
                            }`}
                        >
                            B. Story
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("features")}
                            className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-2 border-black transition-all shrink-0 ${
                                activeTab === "features"
                                    ? "bg-black text-white shadow-[2px_2px_0px_#a2ff86]"
                                    : "bg-white text-black hover:bg-neutral-100 shadow-[2px_2px_0px_#000]"
                            }`}
                        >
                            C. Features ({features.length})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("tech")}
                            className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-2 border-black transition-all shrink-0 ${
                                activeTab === "tech"
                                    ? "bg-black text-white shadow-[2px_2px_0px_#a2ff86]"
                                    : "bg-white text-black hover:bg-neutral-100 shadow-[2px_2px_0px_#000]"
                            }`}
                        >
                            D. Tech Stack ({totalTechCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("links")}
                            className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-2 border-black transition-all shrink-0 ${
                                activeTab === "links"
                                    ? "bg-black text-white shadow-[2px_2px_0px_#a2ff86]"
                                    : "bg-white text-black hover:bg-neutral-100 shadow-[2px_2px_0px_#000]"
                            }`}
                        >
                            E. Links ({totalLinksCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("media")}
                            className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-2 border-black transition-all shrink-0 ${
                                activeTab === "media"
                                    ? "bg-black text-white shadow-[2px_2px_0px_#a2ff86]"
                                    : "bg-white text-black hover:bg-neutral-100 shadow-[2px_2px_0px_#000]"
                            }`}
                        >
                            F. Media ({totalMediaCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("contribution")}
                            className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-2 border-black transition-all shrink-0 ${
                                activeTab === "contribution"
                                    ? "bg-black text-white shadow-[2px_2px_0px_#a2ff86]"
                                    : "bg-white text-black hover:bg-neutral-100 shadow-[2px_2px_0px_#000]"
                            }`}
                        >
                            G. Contributor
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("details")}
                            className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-2 border-black transition-all shrink-0 ${
                                activeTab === "details"
                                    ? "bg-black text-white shadow-[2px_2px_0px_#a2ff86]"
                                    : "bg-white text-black hover:bg-neutral-100 shadow-[2px_2px_0px_#000]"
                            }`}
                        >
                            H. Details
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab("privacy")}
                            className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider border-2 border-black transition-all shrink-0 ${
                                activeTab === "privacy"
                                    ? "bg-black text-white shadow-[2px_2px_0px_#a2ff86]"
                                    : "bg-[#a2ff86] text-black hover:bg-[#8ee673] shadow-[2px_2px_0px_#000]"
                            }`}
                        >
                            Privacy & Audit
                        </button>
                    </div>
                )}

                {/* Modal Body Container */}
                <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
                    {/* STAGE 1: Input Repository */}
                    {lifecycleStage === "input_repo" && (
                        <div className="space-y-6">
                            <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_#000]">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-5 h-5 text-black" />
                                    <h3 className="text-base font-black uppercase tracking-wide text-black">
                                        Intelligent GitHub Extraction
                                    </h3>
                                </div>
                                <p className="text-xs font-medium text-neutral-600 mb-4 leading-relaxed">
                                    Provide a GitHub repository link to automatically discover repository metadata,
                                    language distributions, dependency frameworks from manifests, and architecture details from README.
                                </p>

                                <form onSubmit={handleAnalyzeRepo} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-black uppercase tracking-wider text-black mb-1.5">
                                            GitHub Repository URL
                                        </label>
                                        <div className="relative">
                                            <input
                                                type="text"
                                                value={repoInput}
                                                onChange={(e) => handleRepoInputChange(e.target.value)}
                                                placeholder="https://github.com/username/repository or owner/repo"
                                                className="w-full pl-3 pr-10 py-3 bg-[#FAF6EE] text-black font-mono text-sm border-2 border-black focus:bg-white focus:outline-none shadow-[2px_2px_0px_#000]"
                                                autoFocus
                                            />
                                            <Globe className="absolute right-3 top-3.5 w-4 h-4 text-neutral-500" />
                                        </div>
                                    </div>

                                    {providerWarning && (
                                        <div className="bg-amber-100 border-2 border-black p-3.5 shadow-[2px_2px_0px_#000] flex items-start gap-2.5">
                                            <AlertTriangle className="w-5 h-5 text-amber-900 shrink-0 mt-0.5" />
                                            <div className="space-y-1">
                                                <p className="text-xs font-bold text-amber-950">
                                                    Provider Notice
                                                </p>
                                                <p className="text-xs font-medium text-amber-900">
                                                    {providerWarning}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {analysisError && (
                                        <div className="bg-red-100 border-2 border-black p-3.5 shadow-[2px_2px_0px_#000] flex items-start gap-2.5">
                                            <AlertCircle className="w-5 h-5 text-red-900 shrink-0 mt-0.5" />
                                            <div className="space-y-1">
                                                <p className="text-xs font-bold text-red-950">
                                                    Extraction Issue
                                                </p>
                                                <p className="text-xs font-medium text-red-900">
                                                    {analysisError}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
                                        <button
                                            type="submit"
                                            disabled={!repoInput.trim()}
                                            className="w-full sm:w-auto px-6 py-3 bg-[#a2ff86] hover:bg-[#8ee673] disabled:opacity-50 text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 transition-all"
                                        >
                                            <Sparkles className="w-4 h-4" />
                                            Extract Repository Intelligence
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleManualEntryFallback}
                                            className="w-full sm:w-auto px-5 py-3 bg-white hover:bg-neutral-100 text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[3px_3px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] transition-all"
                                        >
                                            Create Project Manually
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* STAGE 2: Analyzing (Animated 6-Step Visualizer) */}
                    {lifecycleStage === "analyzing" && (
                        <div className="py-8 space-y-6 text-center">
                            <div className="w-16 h-16 bg-[#a2ff86] border-2 border-black rounded-full flex items-center justify-center mx-auto shadow-[4px_4px_0px_#000] animate-bounce">
                                <Loader2 className="w-8 h-8 text-black animate-spin" />
                            </div>

                            <div>
                                <h3 className="text-xl font-black text-black">
                                    Analyzing Repository Intelligence...
                                </h3>
                                <p className="text-xs font-mono text-neutral-600 mt-1">
                                    {repoInput}
                                </p>
                            </div>

                            <div className="max-w-md mx-auto text-left space-y-2.5 bg-white border-2 border-black p-4 shadow-[4px_4px_0px_#000]">
                                {EXTRACTION_STEPS.map((step, idx) => {
                                    const isDone = idx < activeStepIndex;
                                    const isCurrent = idx === activeStepIndex;
                                    return (
                                        <div
                                            key={idx}
                                            className={`flex items-start gap-3 p-2 transition-all ${
                                                isCurrent
                                                    ? "bg-[#FAF6EE] border border-black"
                                                    : "opacity-70"
                                            }`}
                                        >
                                            {isDone ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                                            ) : isCurrent ? (
                                                <Loader2 className="w-4 h-4 text-black animate-spin shrink-0 mt-0.5" />
                                            ) : (
                                                <Clock className="w-4 h-4 text-neutral-400 shrink-0 mt-0.5" />
                                            )}
                                            <div>
                                                <p className="text-xs font-bold text-black">{step.title}</p>
                                                <p className="text-[11px] text-neutral-500">{step.desc}</p>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* STAGE 3: Private Repository Detected (Phase 3.1) */}
                    {lifecycleStage === "private_detected" && (
                        <div className="space-y-6">
                            <div className="bg-amber-50 border-2 border-black p-5 shadow-[4px_4px_0px_#000] space-y-3">
                                <div className="flex items-start gap-3">
                                    <div className="p-2.5 bg-amber-300 border-2 border-black text-black shrink-0 shadow-[2px_2px_0px_#000]">
                                        <Lock className="w-6 h-6" />
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] font-black uppercase tracking-wider bg-black text-amber-300 px-2 py-0.5">
                                            Private / Restricted Access
                                        </span>
                                        <h3 className="text-lg font-black text-black">
                                            We couldn't access the complete repository information.
                                        </h3>
                                        <p className="text-xs font-semibold text-neutral-700 leading-relaxed">
                                            This repository may be private, or Orbix may not have the required permissions.
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
                                    <div>
                                        <span className="text-xs font-black uppercase tracking-wider text-black bg-[#FAF6EE] px-2 py-0.5 border border-black">
                                            Option A (Recommended)
                                        </span>
                                        <h4 className="text-base font-black text-black mt-2">
                                            Connect GitHub App
                                        </h4>
                                        <p className="text-xs font-medium text-neutral-600 mt-1 leading-relaxed">
                                            Grant repository-specific, read-only permissions (Metadata & Contents).
                                        </p>
                                    </div>
                                    <div className="pt-4 border-t border-black/10 mt-4">
                                        <button
                                            type="button"
                                            onClick={handleConnectGithubApp}
                                            disabled={isConnectingGithub}
                                            className="w-full py-2.5 px-4 bg-[#a2ff86] hover:bg-[#8ee673] disabled:opacity-50 text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 transition-all"
                                        >
                                            {isConnectingGithub ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Shield className="w-4 h-4" />
                                            )}
                                            Grant Repository Access
                                        </button>
                                    </div>
                                </div>

                                <div className="bg-white border-2 border-black p-5 shadow-[4px_4px_0px_#000] flex flex-col justify-between">
                                    <div>
                                        <span className="text-xs font-black uppercase tracking-wider text-black bg-[#FAF6EE] px-2 py-0.5 border border-black">
                                            Option B
                                        </span>
                                        <h4 className="text-base font-black text-black mt-2">
                                            Add Information Manually
                                        </h4>
                                        <p className="text-xs font-medium text-neutral-600 mt-1 leading-relaxed">
                                            Orbix couldn't retrieve the repository details. You can provide the project information manually.
                                        </p>
                                    </div>
                                    <div className="pt-4 border-t border-black/10 mt-4">
                                        <button
                                            type="button"
                                            onClick={handleManualEntryFallback}
                                            className="w-full py-2.5 px-4 bg-white hover:bg-neutral-100 text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 transition-all"
                                        >
                                            Proceed Manually
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STAGE 4: Initial Review Screen (Phase 4.1) */}
                    {lifecycleStage === "initial_review" && analysisResult && (
                        <InitialReviewScreen
                            analysis={analysisResult}
                            scorecard={analysisResult.scorecard}
                            onUseAsIs={() => {
                                // "Use as is" switches to review tab to preview & save
                                setLifecycleStage("reviewed_and_editing");
                                setActiveTab("identity");
                            }}
                            onReviewAndEdit={() => {
                                setLifecycleStage("reviewed_and_editing");
                                setActiveTab("identity");
                            }}
                            onSaveDraft={() => handleSave("draft")}
                            onPublish={() => handleSave("published")}
                            isSaving={isSaving}
                        />
                    )}

                    {/* STAGE 5: Dynamic Form (Sections A through H) */}
                    {lifecycleStage === "reviewed_and_editing" && (
                        <div className="space-y-6">
                            {isIncompleteAnalysis && (
                                <div className="bg-amber-100 border-2 border-black p-3.5 shadow-[2px_2px_0px_#000] flex items-start gap-2.5">
                                    <AlertTriangle className="w-5 h-5 text-amber-900 shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-bold text-amber-950">Incomplete Extraction Notice</p>
                                        <p className="text-xs font-medium text-amber-900">
                                            Some project details (such as live demo URL or descriptive features) were not found in the repository. Please review and complement missing information below.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* TAB A: Project Identity */}
                            {activeTab === "identity" && (
                                <div className="space-y-4">
                                    <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_#000] space-y-4">
                                        <div className="flex items-center justify-between border-b border-black/10 pb-3">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                                                <Layout className="w-4 h-4" />
                                                Section A — Project Identity
                                            </h3>
                                            <span className="text-[11px] font-bold text-neutral-500">
                                                Core branding & categorization
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-xs font-black uppercase tracking-wider text-black">
                                                        Project Title <span className="text-red-500">*</span>
                                                    </label>
                                                    {renderFieldProvenanceBadge("title", "Project Title")}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={title}
                                                    onChange={(e) => {
                                                        setTitle(e.target.value);
                                                        markFieldOverridden("title");
                                                    }}
                                                    placeholder="Project title (e.g. Orbix Protocol)"
                                                    className="w-full px-3 py-2 bg-[#FAF6EE] text-sm font-bold text-black border-2 border-black focus:bg-white focus:outline-none"
                                                    required
                                                />
                                            </div>

                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-xs font-black uppercase tracking-wider text-black">
                                                        Project Tagline
                                                    </label>
                                                    {renderFieldProvenanceBadge("tagline", "Tagline")}
                                                </div>
                                                <input
                                                    type="text"
                                                    value={tagline}
                                                    onChange={(e) => {
                                                        setTagline(e.target.value);
                                                        markFieldOverridden("tagline");
                                                    }}
                                                    placeholder="One punchy line summarizing what it does"
                                                    className="w-full px-3 py-2 bg-[#FAF6EE] text-sm font-semibold text-black border-2 border-black focus:bg-white focus:outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-xs font-black uppercase tracking-wider text-black">
                                                        Project Category
                                                    </label>
                                                    {renderFieldProvenanceBadge("category", "Category")}
                                                </div>
                                                <NeoSelect
                                                    value={category}
                                                    onChange={(val) => {
                                                        setCategory(val);
                                                        markFieldOverridden("category");
                                                    }}
                                                    size="sm"
                                                    options={CATEGORIES.map((c) => ({ value: c, label: c }))}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                                    Project Type
                                                </label>
                                                <NeoSelect
                                                    value={projectType}
                                                    onChange={(val) => setProjectType(val as ProjectType)}
                                                    size="sm"
                                                    options={PROJECT_TYPES.map((pt) => ({ value: pt, label: pt }))}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                                    Development Status
                                                </label>
                                                <NeoSelect
                                                    value={developmentStatus}
                                                    onChange={(val) => setDevelopmentStatus(val as DevelopmentStatus)}
                                                    size="sm"
                                                    options={DEV_STATUSES.map((ds) => ({ value: ds, label: ds }))}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs font-black uppercase tracking-wider text-black">
                                                    Short Description
                                                </label>
                                                {renderFieldProvenanceBadge("description", "Description")}
                                            </div>
                                            <textarea
                                                rows={3}
                                                value={description}
                                                onChange={(e) => {
                                                    setDescription(e.target.value);
                                                    markFieldOverridden("description");
                                                }}
                                                placeholder="Concise 2-3 sentence summary of the project..."
                                                className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-medium text-black border-2 border-black focus:bg-white focus:outline-none leading-relaxed"
                                            />
                                        </div>

                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-xs font-black uppercase tracking-wider text-black">
                                                    Full Project Overview (Markdown / Extended Details)
                                                </label>
                                                {renderFieldProvenanceBadge("fullOverview", "Full Overview")}
                                            </div>
                                            <textarea
                                                rows={5}
                                                value={fullOverview}
                                                onChange={(e) => {
                                                    setFullOverview(e.target.value);
                                                    markFieldOverridden("fullOverview");
                                                }}
                                                placeholder="Deep-dive into the architectural scope, technical highlights, and system workflow..."
                                                className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-mono text-black border-2 border-black focus:bg-white focus:outline-none leading-relaxed"
                                            />
                                        </div>

                                        <div className="pt-2 border-t border-black/10 flex items-center justify-between">
                                            <div>
                                                <label className="text-xs font-black uppercase text-black cursor-pointer select-none">
                                                    Pin to Showcase Top
                                                </label>
                                                <p className="text-[11px] font-medium text-neutral-500">
                                                    Featured at the very top of your public portfolio.
                                                </p>
                                            </div>
                                            <NeoCheckbox
                                                checked={isPinned}
                                                onCheckedChange={(checked) => setIsPinned(checked)}
                                                size="md"
                                                colorScheme="yellow"
                                            />
                                        </div>

                                        <div className="pt-2 border-t border-black/10 flex items-center justify-between">
                                            <div>
                                                <label className="text-xs font-black uppercase text-black cursor-pointer select-none">
                                                    Show on Public Profile
                                                </label>
                                                <p className="text-[11px] font-medium text-neutral-500">
                                                    When enabled, recruiters and visitors can discover this project on your profile.
                                                </p>
                                            </div>
                                            <NeoCheckbox
                                                checked={showOnProfile}
                                                onCheckedChange={(checked) => setShowOnProfile(checked)}
                                                size="md"
                                                colorScheme="green"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB B: Project Story */}
                            {activeTab === "story" && (
                                <div className="space-y-4">
                                    <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_#000] space-y-4">
                                        <div className="flex items-center justify-between border-b border-black/10 pb-3">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                                                <BookOpen className="w-4 h-4" />
                                                Section B — Project Story & Motivation
                                            </h3>
                                            <span className="text-[11px] font-bold text-neutral-500">
                                                Optional narrative & problem-solving insights
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                                    Problem Statement
                                                </label>
                                                <textarea
                                                    rows={3}
                                                    value={problemStatement}
                                                    onChange={(e) => setProblemStatement(e.target.value)}
                                                    placeholder="What pain point or gap does this project address?"
                                                    className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-medium text-black border-2 border-black focus:bg-white focus:outline-none"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                                    Motivation & Background
                                                </label>
                                                <textarea
                                                    rows={3}
                                                    value={motivation}
                                                    onChange={(e) => setMotivation(e.target.value)}
                                                    placeholder="Why did you build this? What was the spark?"
                                                    className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-medium text-black border-2 border-black focus:bg-white focus:outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                                    What Does It Solve? (Solution)
                                                </label>
                                                <textarea
                                                    rows={3}
                                                    value={solution}
                                                    onChange={(e) => setSolution(e.target.value)}
                                                    placeholder="How does your architecture solve the problem?"
                                                    className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-medium text-black border-2 border-black focus:bg-white focus:outline-none"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                                    Target Audience
                                                </label>
                                                <textarea
                                                    rows={3}
                                                    value={targetAudience}
                                                    onChange={(e) => setTargetAudience(e.target.value)}
                                                    placeholder="Who uses this? (e.g. DevOps engineers, students, crypto devs)"
                                                    className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-medium text-black border-2 border-black focus:bg-white focus:outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                                Why is this Project Different? (Differentiation)
                                            </label>
                                            <input
                                                type="text"
                                                value={differentiation}
                                                onChange={(e) => setDifferentiation(e.target.value)}
                                                placeholder="Unique value proposition or technical advantage..."
                                                className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-medium text-black border-2 border-black focus:bg-white focus:outline-none"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                                    Challenges Faced
                                                </label>
                                                <textarea
                                                    rows={3}
                                                    value={challenges}
                                                    onChange={(e) => setChallenges(e.target.value)}
                                                    placeholder="Technical bottlenecks, scaling hurdles, or debugging war stories..."
                                                    className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-medium text-black border-2 border-black focus:bg-white focus:outline-none"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                                    Learning Outcomes
                                                </label>
                                                <textarea
                                                    rows={3}
                                                    value={learnings}
                                                    onChange={(e) => setLearnings(e.target.value)}
                                                    placeholder="Key takeaways, skills mastered, or design patterns adopted..."
                                                    className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-medium text-black border-2 border-black focus:bg-white focus:outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB C: Features */}
                            {activeTab === "features" && (
                                <div className="space-y-4">
                                    <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_#000] space-y-4">
                                        <div className="flex items-center justify-between border-b border-black/10 pb-3">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                                                <CheckCircle2 className="w-4 h-4" />
                                                Section C — Key Features ({features.length})
                                            </h3>
                                            <div className="flex items-center gap-2">
                                                {renderFieldProvenanceBadge("features", "Features")}
                                                <span className="text-[11px] font-bold text-neutral-500 hidden sm:inline">
                                                    Reorderable highlights
                                                </span>
                                            </div>
                                        </div>

                                        {/* Add Feature Form */}
                                        <div className="p-3 bg-[#FAF6EE] border border-black/30 space-y-2">
                                            <span className="text-[10px] font-black uppercase text-neutral-600 block">
                                                Add New Feature
                                            </span>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <input
                                                    type="text"
                                                    value={newFeatureTitle}
                                                    onChange={(e) => setNewFeatureTitle(e.target.value)}
                                                    placeholder="Feature headline (e.g. Distributed Cache Invalidation)..."
                                                    className="flex-1 px-3 py-1.5 text-xs font-bold border border-black bg-white focus:outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddFeature}
                                                    disabled={!newFeatureTitle.trim()}
                                                    className="px-4 py-1.5 bg-[#a2ff86] hover:bg-[#8ee673] disabled:opacity-40 text-black text-xs font-black uppercase border border-black flex items-center justify-center gap-1"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    Add Feature
                                                </button>
                                            </div>
                                            <textarea
                                                rows={2}
                                                value={newFeatureDesc}
                                                onChange={(e) => setNewFeatureDesc(e.target.value)}
                                                placeholder="Optional feature description / how it works..."
                                                className="w-full px-3 py-1.5 text-xs font-medium border border-black bg-white focus:outline-none"
                                            />
                                        </div>

                                        {/* Feature List */}
                                        {features.length === 0 ? (
                                            <div className="text-center py-6 text-neutral-400 text-xs font-medium border border-dashed border-neutral-300">
                                                No features added yet. Add feature highlights using the box above.
                                            </div>
                                        ) : (
                                            <div className="space-y-2.5">
                                                {features.map((feat, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="p-3 bg-[#FAF6EE] border-2 border-black flex items-start justify-between gap-3 shadow-[2px_2px_0px_#000]"
                                                    >
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-[10px] font-mono font-bold bg-black text-white px-1.5 py-0.2">
                                                                    #{idx + 1}
                                                                </span>
                                                                <p className="text-xs font-bold text-black truncate">
                                                                    {feat.title}
                                                                </p>
                                                            </div>
                                                            {feat.description && (
                                                                <p className="text-[11px] font-medium text-neutral-700 mt-1 leading-relaxed">
                                                                    {feat.description}
                                                                </p>
                                                            )}
                                                        </div>

                                                        <div className="flex items-center gap-1 shrink-0 mt-0.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMoveFeature(idx, "up")}
                                                                disabled={idx === 0}
                                                                className="p-1 border border-black bg-white hover:bg-neutral-100 disabled:opacity-30"
                                                                title="Move Up"
                                                            >
                                                                <MoveUp className="w-3.5 h-3.5 text-black" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleMoveFeature(idx, "down")}
                                                                disabled={idx === features.length - 1}
                                                                className="p-1 border border-black bg-white hover:bg-neutral-100 disabled:opacity-30"
                                                                title="Move Down"
                                                            >
                                                                <MoveDown className="w-3.5 h-3.5 text-black" />
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveFeature(idx)}
                                                                className="p-1 border border-black bg-white hover:bg-red-50 text-red-600"
                                                                title="Remove"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* TAB D: Technology Stack */}
                            {activeTab === "tech" && (
                                <div className="space-y-3">
                                    {rawExtractedData?.technologies && (
                                        <div className="flex items-center justify-between p-3 rounded-xl bg-white border-2 border-black shadow-[2px_2px_0px_#000]">
                                            <span className="text-xs font-black text-black">
                                                Technologies Provenance Status
                                            </span>
                                            {renderFieldProvenanceBadge("technologies", "Technologies")}
                                        </div>
                                    )}
                                    <TechnologyStackEditor
                                        categorizedTech={categorizedTech}
                                        onChange={(newTech) => {
                                            setCategorizedTech(newTech);
                                            markFieldOverridden("technologies");
                                        }}
                                        suggestedTech={SUGGESTED_TECH}
                                    />
                                </div>
                            )}

                            {/* TAB E: Project Links */}
                            {activeTab === "links" && (
                                <div className="space-y-4">
                                    <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_#000] space-y-4">
                                        <div className="flex items-center justify-between border-b border-black/10 pb-3">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                                                <LinkIcon className="w-4 h-4" />
                                                Section E — Project Links
                                            </h3>
                                            <span className="text-[11px] font-bold text-neutral-500">
                                                Live demo, documentation & custom URLs
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                                    GitHub Repository URL
                                                </label>
                                                <input
                                                    type="url"
                                                    value={repoUrl}
                                                    onChange={(e) => setRepoUrl(e.target.value)}
                                                    placeholder="https://github.com/..."
                                                    className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-mono text-black border-2 border-black focus:bg-white focus:outline-none"
                                                />
                                            </div>

                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-xs font-black uppercase tracking-wider text-black">
                                                        Live Application Demo
                                                    </label>
                                                    {renderFieldProvenanceBadge("liveUrl", "Live URL")}
                                                </div>
                                                <input
                                                    type="url"
                                                    value={liveUrl}
                                                    onChange={(e) => {
                                                        setLiveUrl(e.target.value);
                                                        markFieldOverridden("liveUrl");
                                                    }}
                                                    placeholder="https://myproject.app"
                                                    className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-mono text-black border-2 border-black focus:bg-white focus:outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <div className="flex items-center justify-between mb-1">
                                                    <label className="text-xs font-black uppercase tracking-wider text-black">
                                                        Documentation URL
                                                    </label>
                                                    {renderFieldProvenanceBadge("documentationUrl", "Documentation URL")}
                                                </div>
                                                <input
                                                    type="url"
                                                    value={documentationUrl}
                                                    onChange={(e) => {
                                                        setDocumentationUrl(e.target.value);
                                                        markFieldOverridden("documentationUrl");
                                                    }}
                                                    placeholder="https://docs.myproject.app"
                                                    className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-mono text-black border-2 border-black focus:bg-white focus:outline-none"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                                    API Documentation URL
                                                </label>
                                                <input
                                                    type="url"
                                                    value={apiDocUrl}
                                                    onChange={(e) => setApiDocUrl(e.target.value)}
                                                    placeholder="https://api.myproject.app/docs or Swagger"
                                                    className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-mono text-black border-2 border-black focus:bg-white focus:outline-none"
                                                />
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                                    Demo Video URL (YouTube / Loom)
                                                </label>
                                                <input
                                                    type="url"
                                                    value={demoVideoUrl}
                                                    onChange={(e) => setDemoVideoUrl(e.target.value)}
                                                    placeholder="https://youtube.com/watch?v=..."
                                                    className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-mono text-black border-2 border-black focus:bg-white focus:outline-none"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                                    Figma / Design Preview URL
                                                </label>
                                                <input
                                                    type="url"
                                                    value={figmaUrl}
                                                    onChange={(e) => setFigmaUrl(e.target.value)}
                                                    placeholder="https://figma.com/file/..."
                                                    className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-mono text-black border-2 border-black focus:bg-white focus:outline-none"
                                                />
                                            </div>
                                        </div>

                                        {/* Additional Custom Links */}
                                        <div className="pt-3 border-t border-black/10 space-y-3">
                                            <span className="text-xs font-black uppercase text-black block">
                                                Additional Custom Links ({customLinks.length})
                                            </span>

                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <input
                                                    type="text"
                                                    value={newCustomLinkLabel}
                                                    onChange={(e) => setNewCustomLinkLabel(e.target.value)}
                                                    placeholder="Link Label (e.g. Substack Post, Pitch Deck)..."
                                                    className="w-full sm:w-1/3 px-3 py-1.5 text-xs font-bold border border-black bg-white focus:outline-none"
                                                />
                                                <input
                                                    type="url"
                                                    value={newCustomLinkUrl}
                                                    onChange={(e) => setNewCustomLinkUrl(e.target.value)}
                                                    placeholder="URL https://..."
                                                    className="flex-1 px-3 py-1.5 text-xs font-mono border border-black bg-white focus:outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddCustomLink}
                                                    disabled={!newCustomLinkLabel.trim() || !newCustomLinkUrl.trim()}
                                                    className="px-4 py-1.5 bg-[#a2ff86] hover:bg-[#8ee673] disabled:opacity-40 text-black text-xs font-black uppercase border border-black flex items-center justify-center gap-1"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                    Add Link
                                                </button>
                                            </div>

                                            {customLinks.length > 0 && (
                                                <div className="space-y-2 pt-1">
                                                    {customLinks.map((link) => (
                                                        <div
                                                            key={link.id}
                                                            className="p-2.5 bg-[#FAF6EE] border border-black flex items-center justify-between gap-3 text-xs"
                                                        >
                                                            <div className="min-w-0">
                                                                <span className="font-bold text-black">{link.label}</span>
                                                                <span className="text-neutral-500 font-mono text-[11px] truncate block">
                                                                    {link.url}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleToggleLinkVisibility(link.id)}
                                                                    className={`px-2 py-0.5 text-[10px] font-black uppercase border border-black flex items-center gap-1 ${
                                                                        link.isHidden
                                                                            ? "bg-neutral-200 text-neutral-700"
                                                                            : "bg-[#a2ff86] text-black"
                                                                    }`}
                                                                    title="Toggle public visibility"
                                                                >
                                                                    {link.isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                                    {link.isHidden ? "Hidden" : "Public"}
                                                                </button>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveCustomLink(link.id)}
                                                                    className="p-1 text-red-600 hover:bg-red-50"
                                                                    title="Delete link"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB F: Images and Media */}
                            {activeTab === "media" && (
                                <MediaUploadDropzone
                                    coverImageUrl={imageUrl}
                                    onCoverImageChange={setImageUrl}
                                    galleryImages={galleryImages}
                                    onGalleryImagesChange={setGalleryImages}
                                    discoveredScreenshots={analysisResult?.screenshots}
                                />
                            )}

                            {/* TAB G: Contributor Information */}
                            {activeTab === "contribution" && (
                                <div className="space-y-4">
                                    <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_#000] space-y-4">
                                        <div className="flex items-center justify-between border-b border-black/10 pb-3">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                                                <Users className="w-4 h-4" />
                                                Section G — Contributor Information
                                            </h3>
                                            <span className="text-[11px] font-bold text-neutral-500">
                                                User-controlled authorship details
                                            </span>
                                        </div>

                                        {/* Project Scope: Solo vs Team */}
                                        <div className="p-3 bg-[#FAF6EE] border border-black/30 flex items-center justify-between">
                                            <div>
                                                <span className="text-xs font-black uppercase text-black block">
                                                    Project Scope
                                                </span>
                                                <p className="text-[11px] font-medium text-neutral-600">
                                                    Did you build this alone or collaboratively?
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => setIsTeamProject(false)}
                                                    className={`px-3 py-1 text-xs font-black uppercase border border-black transition-all ${
                                                        !isTeamProject ? "bg-black text-white" : "bg-white text-black"
                                                    }`}
                                                >
                                                    Solo Project
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setIsTeamProject(true)}
                                                    className={`px-3 py-1 text-xs font-black uppercase border border-black transition-all ${
                                                        isTeamProject ? "bg-black text-white" : "bg-white text-black"
                                                    }`}
                                                >
                                                    Team Project
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                                    My Role
                                                </label>
                                                <input
                                                    type="text"
                                                    value={myRole}
                                                    onChange={(e) => setMyRole(e.target.value)}
                                                    placeholder="e.g. Lead Architect, Full-Stack Developer"
                                                    className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-bold text-black border-2 border-black focus:bg-white focus:outline-none"
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                                    My Key Responsibilities
                                                </label>
                                                <input
                                                    type="text"
                                                    value={myResponsibilities}
                                                    onChange={(e) => setMyResponsibilities(e.target.value)}
                                                    placeholder="e.g. Designed DB schema & API routes"
                                                    className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-semibold text-black border-2 border-black focus:bg-white focus:outline-none"
                                                />
                                            </div>
                                        </div>

                                        {/* Team Members List (If team project) */}
                                        {isTeamProject && (
                                            <div className="space-y-2 pt-1">
                                                <label className="block text-xs font-black uppercase tracking-wider text-black">
                                                    Collaborators / Team Members
                                                </label>
                                                <div className="flex gap-2">
                                                    <input
                                                        type="text"
                                                        value={newTeamMemberInput}
                                                        onChange={(e) => setNewTeamMemberInput(e.target.value)}
                                                        placeholder="Team member name or @username..."
                                                        className="flex-1 px-3 py-1.5 text-xs border border-black bg-white focus:outline-none"
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={handleAddTeamMember}
                                                        className="px-3 py-1.5 bg-[#a2ff86] text-black text-xs font-black uppercase border border-black"
                                                    >
                                                        Add Member
                                                    </button>
                                                </div>

                                                {teamMembers.length > 0 && (
                                                    <div className="flex flex-wrap gap-1.5 pt-1">
                                                        {teamMembers.map((member, i) => (
                                                            <span
                                                                key={i}
                                                                className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#FAF6EE] border border-black text-xs font-bold text-black"
                                                            >
                                                                {member}
                                                                <button
                                                                    type="button"
                                                                    onClick={() => handleRemoveTeamMember(i)}
                                                                    className="text-neutral-400 hover:text-red-600"
                                                                >
                                                                    ×
                                                                </button>
                                                            </span>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                                Contribution Narrative
                                            </label>
                                            <textarea
                                                rows={3}
                                                value={contributionDescription}
                                                onChange={(e) => setContributionDescription(e.target.value)}
                                                placeholder="Explain exactly what you contributed to this codebase..."
                                                className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-medium text-black border-2 border-black focus:bg-white focus:outline-none leading-relaxed"
                                            />
                                        </div>

                                        <p className="text-[11px] font-medium text-neutral-500 italic">
                                            Note: Linking a repository does not claim solo authorship. Orbix ensures contribution credit is transparent and accurate.
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* TAB H: Additional Details */}
                            {activeTab === "details" && (
                                <div className="space-y-4">
                                    <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_#000] space-y-4">
                                        <div className="flex items-center justify-between border-b border-black/10 pb-3">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                                                <Zap className="w-4 h-4" />
                                                Section H — Additional Project Details
                                            </h3>
                                            <span className="text-[11px] font-bold text-neutral-500">
                                                Metrics, achievements, and roadmap
                                            </span>
                                        </div>

                                        {/* Performance Metrics */}
                                        <div className="space-y-2">
                                            <span className="text-xs font-black uppercase text-black block">
                                                Performance Metrics & Stats
                                            </span>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <input
                                                    type="text"
                                                    value={newMetricLabel}
                                                    onChange={(e) => setNewMetricLabel(e.target.value)}
                                                    placeholder="Metric (e.g. Throughput, Lighthouse)..."
                                                    className="w-full sm:w-1/2 px-3 py-1.5 text-xs font-bold border border-black bg-white focus:outline-none"
                                                />
                                                <input
                                                    type="text"
                                                    value={newMetricValue}
                                                    onChange={(e) => setNewMetricValue(e.target.value)}
                                                    placeholder="Value (e.g. 50k req/s, 99/100)..."
                                                    className="flex-1 px-3 py-1.5 text-xs font-bold border border-black bg-white focus:outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddMetric}
                                                    className="px-4 py-1.5 bg-[#a2ff86] text-black text-xs font-black uppercase border border-black"
                                                >
                                                    Add Metric
                                                </button>
                                            </div>

                                            {performanceMetrics.length > 0 && (
                                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                                                    {performanceMetrics.map((m) => (
                                                        <div
                                                            key={m.id}
                                                            className="p-2 bg-[#FAF6EE] border border-black flex items-center justify-between"
                                                        >
                                                            <div>
                                                                <span className="text-[10px] uppercase font-bold text-neutral-500 block">
                                                                    {m.label}
                                                                </span>
                                                                <span className="text-xs font-black text-black">
                                                                    {m.value}
                                                                </span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveMetric(m.id)}
                                                                className="text-red-600 p-0.5"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Project Achievements */}
                                        <div className="space-y-2 pt-2 border-t border-black/10">
                                            <span className="text-xs font-black uppercase text-black block">
                                                Achievements & Recognition
                                            </span>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={newAchievementInput}
                                                    onChange={(e) => setNewAchievementInput(e.target.value)}
                                                    placeholder="e.g. #1 on Product Hunt, Winner at ETHIndia..."
                                                    className="flex-1 px-3 py-1.5 text-xs border border-black bg-white focus:outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddAchievement}
                                                    className="px-4 py-1.5 bg-[#a2ff86] text-black text-xs font-black uppercase border border-black"
                                                >
                                                    Add Achievement
                                                </button>
                                            </div>

                                            {achievements.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {achievements.map((ach, i) => (
                                                        <span
                                                            key={i}
                                                            className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#FAF6EE] border border-black text-xs font-bold text-black"
                                                        >
                                                            <Award className="w-3 h-3 text-amber-600" />
                                                            {ach}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveAchievement(i)}
                                                                className="text-neutral-400 hover:text-red-600"
                                                            >
                                                                ×
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Future Improvements */}
                                        <div className="space-y-2 pt-2 border-t border-black/10">
                                            <span className="text-xs font-black uppercase text-black block">
                                                Future Roadmap & Planned Improvements
                                            </span>
                                            <div className="flex gap-2">
                                                <input
                                                    type="text"
                                                    value={newFutureImprovementInput}
                                                    onChange={(e) => setNewFutureImprovementInput(e.target.value)}
                                                    placeholder="e.g. Migrate to WebAssembly, Add multi-region failover..."
                                                    className="flex-1 px-3 py-1.5 text-xs border border-black bg-white focus:outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddFutureImprovement}
                                                    className="px-4 py-1.5 bg-[#a2ff86] text-black text-xs font-black uppercase border border-black"
                                                >
                                                    Add Roadmap
                                                </button>
                                            </div>

                                            {futureImprovements.length > 0 && (
                                                <div className="flex flex-wrap gap-1.5 pt-1">
                                                    {futureImprovements.map((imp, i) => (
                                                        <span
                                                            key={i}
                                                            className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-[#FAF6EE] border border-black text-xs font-bold text-black"
                                                        >
                                                            {imp}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveFutureImprovement(i)}
                                                                className="text-neutral-400 hover:text-red-600"
                                                            >
                                                                ×
                                                            </button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>

                                        {/* Deployment Info */}
                                        <div>
                                            <label className="block text-xs font-black uppercase tracking-wider text-black mb-1">
                                                Deployment & Infrastructure
                                            </label>
                                            <input
                                                type="text"
                                                value={deploymentInfo}
                                                onChange={(e) => setDeploymentInfo(e.target.value)}
                                                placeholder="e.g. Dockerized container deployed on AWS ECS with Cloudflare CDN"
                                                className="w-full px-3 py-2 bg-[#FAF6EE] text-xs font-medium text-black border-2 border-black focus:bg-white focus:outline-none"
                                            />
                                        </div>

                                        {/* Custom Key-Value Fields */}
                                        <div className="space-y-2 pt-2 border-t border-black/10">
                                            <span className="text-xs font-black uppercase text-black block">
                                                Custom Fields & Attributes
                                            </span>
                                            <div className="flex flex-col sm:flex-row gap-2">
                                                <input
                                                    type="text"
                                                    value={newFieldKey}
                                                    onChange={(e) => setNewFieldKey(e.target.value)}
                                                    placeholder="Custom Key (e.g. Audit Firm)..."
                                                    className="w-full sm:w-1/3 px-3 py-1.5 text-xs font-bold border border-black bg-white focus:outline-none"
                                                />
                                                <input
                                                    type="text"
                                                    value={newFieldValue}
                                                    onChange={(e) => setNewFieldValue(e.target.value)}
                                                    placeholder="Value (e.g. OpenZeppelin Certified)..."
                                                    className="flex-1 px-3 py-1.5 text-xs border border-black bg-white focus:outline-none"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddCustomField}
                                                    className="px-4 py-1.5 bg-[#a2ff86] text-black text-xs font-black uppercase border border-black"
                                                >
                                                    Add Field
                                                </button>
                                            </div>

                                            {customFields.length > 0 && (
                                                <div className="space-y-1.5 pt-1">
                                                    {customFields.map((cf) => (
                                                        <div
                                                            key={cf.id}
                                                            className="p-2 bg-[#FAF6EE] border border-black flex items-center justify-between text-xs"
                                                        >
                                                            <span>
                                                                <strong className="text-black font-black">{cf.key}:</strong>{" "}
                                                                <span className="text-neutral-700 font-medium">{cf.value}</span>
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleRemoveCustomField(cf.id)}
                                                                className="text-red-600 p-0.5"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* TAB: Privacy & Audit (Scorecard + Visibility Inspector) */}
                            {activeTab === "privacy" && (
                                <div className="space-y-5">
                                    {/* Phase 3.2: Privacy Inspector */}
                                    <div className="bg-white border-2 border-black p-4 shadow-[4px_4px_0px_#000] space-y-4">
                                        <div className="flex items-center justify-between border-b border-black/10 pb-3">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-2">
                                                <Shield className="w-4 h-4 text-black" />
                                                Public Visibility & Privacy Inspector
                                            </h3>
                                            <span className="text-[11px] font-bold text-neutral-500">
                                                Zero credential or proprietary code leakage
                                            </span>
                                        </div>

                                        <div className="p-3 bg-[#FAF6EE] border border-black flex items-center justify-between">
                                            <div>
                                                <span className="text-xs font-black uppercase text-black block">
                                                    Mark as Private Codebase
                                                </span>
                                                <p className="text-[11px] font-medium text-neutral-600">
                                                    Flags this project as a proprietary codebase with a lock badge.
                                                </p>
                                            </div>
                                            <NeoCheckbox
                                                checked={isRepoPrivate}
                                                onCheckedChange={(checked) => setIsRepoPrivate(checked)}
                                                size="md"
                                                colorScheme="pink"
                                            />
                                        </div>

                                        <div className="p-3 bg-[#FAF6EE] border border-black flex items-center justify-between">
                                            <div>
                                                <span className="text-xs font-black uppercase text-black block">
                                                    Hide Repository Link From Visitors
                                                </span>
                                                <p className="text-[11px] font-medium text-neutral-600">
                                                    Conceals the GitHub URL on public profiles while showcasing features & stack.
                                                </p>
                                            </div>
                                            <NeoCheckbox
                                                checked={hideRepoUrl}
                                                onCheckedChange={(checked) => setHideRepoUrl(checked)}
                                                size="md"
                                                colorScheme="yellow"
                                            />
                                        </div>

                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-black/10 text-xs">
                                            <div className="p-3 bg-neutral-50 border border-black/20">
                                                <span className="font-black text-black uppercase text-[10px] block mb-1">
                                                    Visitor View (Public)
                                                </span>
                                                <ul className="space-y-1 text-neutral-600 text-[11px]">
                                                    <li>• Title: {title || "(Empty)"}</li>
                                                    <li>• Tagline: {tagline || "(Empty)"}</li>
                                                    <li>
                                                        • Repo Link:{" "}
                                                        {hideRepoUrl || isRepoPrivate ? (
                                                            <span className="text-red-600 font-bold">REDACTED (Hidden)</span>
                                                        ) : (
                                                            <span className="text-emerald-700 font-mono">{repoUrl || "None"}</span>
                                                        )}
                                                    </li>
                                                    <li>• Technologies: {totalTechCount} displayed</li>
                                                    <li>• Features: {features.length} listed</li>
                                                </ul>
                                            </div>

                                            <div className="p-3 bg-neutral-50 border border-black/20">
                                                <span className="font-black text-black uppercase text-[10px] block mb-1">
                                                    Owner View (Your Dashboard)
                                                </span>
                                                <ul className="space-y-1 text-neutral-600 text-[11px]">
                                                    <li>• Full editing access to all 8 sections</li>
                                                    <li>• Unredacted repository link for testing</li>
                                                    <li>• Provenance audit & quality scorecard</li>
                                                    <li>• Direct publish & draft controls</li>
                                                </ul>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Phase 2: Extraction Scorecard */}
                                    {analysisResult?.scorecard && (
                                        <ExtractionScorecardView
                                            scorecard={analysisResult.scorecard}
                                            screenshots={analysisResult.screenshots}
                                            selectedImageUrl={imageUrl}
                                            onSelectCoverImage={(url) => setImageUrl(url)}
                                            technicalFacts={analysisResult.technicalFacts}
                                        />
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Modal Footer / Action Bar */}
                {lifecycleStage === "reviewed_and_editing" && (
                    <div className="flex flex-col sm:flex-row items-center justify-between p-4 bg-white border-t-2 border-black gap-3 shrink-0">
                        <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-start">
                            {analysisResult && (
                                <button
                                    type="button"
                                    onClick={() => setLifecycleStage("initial_review")}
                                    className="px-3 py-1.5 bg-[#FAF6EE] hover:bg-neutral-200 text-black text-xs font-black uppercase border border-black flex items-center gap-1.5 transition-colors"
                                >
                                    <Sliders className="w-3.5 h-3.5" />
                                    Review Summary
                                </button>
                            )}
                            <span className="text-xs font-bold text-neutral-500">
                                All changes autosaved to draft
                            </span>
                        </div>

                        <div className="flex items-center gap-2 w-full sm:w-auto">
                            <button
                                type="button"
                                onClick={() => handleSave("draft")}
                                className="flex-1 sm:flex-none px-4 py-2 bg-white hover:bg-neutral-100 text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-1.5 transition-all"
                            >
                                <Save className="w-4 h-4" />
                                Save Draft
                            </button>
                            <button
                                type="button"
                                onClick={() => handleSave("published")}
                                className="flex-1 sm:flex-none px-5 py-2 bg-[#a2ff86] hover:bg-[#8ee673] text-black font-black text-xs uppercase tracking-wider border-2 border-black shadow-[2px_2px_0px_#000] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-1.5 transition-all"
                            >
                                <Rocket className="w-4 h-4" />
                                Publish Showcase
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* In-Modal GitHub Repository Synchronization */}
            {isSyncModalOpen && initialProject && (
                <ProjectSyncDiffModal
                    isOpen={isSyncModalOpen}
                    onClose={() => setIsSyncModalOpen(false)}
                    projectId={initialProject.id}
                    projectTitle={initialProject.title}
                    onMergeSuccess={(updated) => {
                        setTitle(updated.title || "");
                        setTagline(updated.tagline || "");
                        setDescription(updated.description || "");
                        setFullOverview(updated.fullOverview || "");
                        setCategory(updated.category || "Full-Stack");
                        setRepoStars(updated.repoStars || 0);
                        setRepoForks(updated.repoForks || 0);
                        setRepoLanguage(updated.repoLanguage || "");
                        setLiveUrl(updated.liveUrl || "");
                        setDocumentationUrl(updated.documentationUrl || "");
                        setFieldOverrides(updated.fieldOverrides || {});
                        setRawExtractedData(updated.rawExtractedData || {});
                        onSaved(updated);
                    }}
                />
            )}

            {/* Unsaved Changes Confirmation Dialog */}
            <ConfirmationModal
                isOpen={showUnsavedWarning}
                onClose={() => setShowUnsavedWarning(false)}
                onConfirm={() => {
                    setShowUnsavedWarning(false);
                    onClose();
                }}
                title="Discard Unsaved Changes?"
                description="You have entered changes in this project showcase form. Are you sure you want to discard them? Any unsaved edits will be lost."
                confirmText="Discard Changes"
                cancelText="Keep Editing"
                variant="warning"
            />
        </div>
    );
};
