import type { ProjectItem } from "../../../types/project";
import { demoProjects } from "../../../data/demoProfileData";

/**
 * Standard Mock Projects for Landing Page Showcase
 * Reuses the authoritative production demo projects from demoProfileData
 */
export const MOCK_PROJECTS_DATA: ProjectItem[] = demoProjects;

export interface ExtractionSimulationStage {
    id: string;
    stepNumber: string;
    title: string;
    shortLabel: string;
    description: string;
    badgeText: string;
    badgeColor: string;
}

export const EXTRACTION_SIMULATION_STAGES: ExtractionSimulationStage[] = [
    {
        id: "connect",
        stepNumber: "01",
        title: "Intelligent GitHub Extraction",
        shortLabel: "Connect & Extract",
        description: "Paste any public repository URL. Orbix automatically resolves repository metadata, commit velocity, and language distributions.",
        badgeText: "Phase 1: Input",
        badgeColor: "bg-[#FFE566]",
    },
    {
        id: "scorecard",
        stepNumber: "02",
        title: "AST Parsing & Quality Scorecard",
        shortLabel: "AST Analysis",
        description: "Our syntax tree parser inspects dependency manifests and READMEs, generating a verified 0-100% Quality Completeness Score.",
        badgeText: "Phase 2: Scorecard",
        badgeColor: "bg-[#a2ff86]",
    },
    {
        id: "curate",
        stepNumber: "03",
        title: "Deep Systems Curation Studio",
        shortLabel: "Curate Systems",
        description: "Enrich code with real problem statements, target audiences, architecture diagrams, technical hurdles, and live demo endpoints.",
        badgeText: "Phase 3: Deep Story",
        badgeColor: "bg-[#61DDE1]",
    },
    {
        id: "publish",
        stepNumber: "04",
        title: "Verified Public Portfolio Sync",
        shortLabel: "Publish to Profile",
        description: "Pin to your 4 flagship showcase slots. Visitors and engineering recruiters inspect verifiable architecture modal deep-dives.",
        badgeText: "Phase 4: Verified Sync",
        badgeColor: "bg-[#FFB94D]",
    },
];

export const PROJECT_CATEGORIES = [
    { id: "all", label: "All Projects", count: 4 },
    { id: "Distributed Systems", label: "Distributed Systems", count: 2 },
    { id: "Cloud & DevOps", label: "Cloud & DevOps", count: 1 },
    { id: "Open Source", label: "Open Source", count: 1 },
];
