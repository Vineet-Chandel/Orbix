import type {
    StructuredResumeFacts,
    ComprehensiveScoringResult,
    DimensionScoreResult,
    SubcriterionResult,
    ScoringDimensionKey
} from "./resumeTypes.js";

export interface ScoringEngineConfig {
    version: string;
    dimensionWeights: Record<ScoringDimensionKey, number>;
}

export const DEFAULT_SCORING_CONFIG: ScoringEngineConfig = {
    version: "v3.0.0",
    dimensionWeights: {
        impactAndMetrics: 0.25,
        technicalDepth: 0.20,
        targetRoleAlignment: 0.20,
        atsStructure: 0.10,
        clarityAndActionWriting: 0.10,
        verifiedProfiles: 0.10,
        contactAndCompleteness: 0.05
    }
};

/**
 * Deterministic, transparent, and reproducible scoring engine.
 * Implements strict mathematical weighting:
 * Resume Score = Σ (Dimension Score × Dimension Weight) / Σ Assessed Dimension Weights
 */
export class ResumeScoringEngine {
    private config: ScoringEngineConfig;

    constructor(config: Partial<ScoringEngineConfig> = {}) {
        this.config = {
            version: config.version || DEFAULT_SCORING_CONFIG.version,
            dimensionWeights: {
                ...DEFAULT_SCORING_CONFIG.dimensionWeights,
                ...(config.dimensionWeights || {})
            }
        };
    }

    public evaluate(facts: StructuredResumeFacts, targetRole?: string): ComprehensiveScoringResult {
        const dimensions: Record<ScoringDimensionKey, DimensionScoreResult> = {
            impactAndMetrics: this.evaluateImpactAndMetrics(facts),
            technicalDepth: this.evaluateTechnicalDepth(facts),
            targetRoleAlignment: this.evaluateTargetRoleAlignment(facts, targetRole),
            atsStructure: this.evaluateAtsStructure(facts),
            clarityAndActionWriting: this.evaluateClarityAndWriting(facts),
            verifiedProfiles: this.evaluateVerifiedProfiles(facts),
            contactAndCompleteness: this.evaluateContactAndCompleteness(facts)
        };

        // Strict mathematical calculation
        let weightedSum = 0;
        let totalAssessedWeight = 0;

        for (const key of Object.keys(dimensions) as ScoringDimensionKey[]) {
            const dim = dimensions[key];
            if (dim.assessed) {
                weightedSum += dim.score * dim.weight;
                totalAssessedWeight += dim.weight;
            }
        }

        const overallScore = totalAssessedWeight > 0
            ? Math.round(weightedSum / totalAssessedWeight)
            : 0;

        const scoreGrade = this.getScoreGrade(overallScore);

        // Separate confidence ratings
        const extractionConfidence = this.calculateExtractionConfidence(facts);
        const analysisConfidence = this.calculateAnalysisConfidence(facts, totalAssessedWeight);

        const assessedKeys = (Object.keys(dimensions) as ScoringDimensionKey[])
            .filter(k => dimensions[k].assessed);

        const assessedTerms = assessedKeys
            .map(k => `(${dimensions[k].score} × ${dimensions[k].weight.toFixed(2)})`)
            .join(" + ");

        const roundedAssessedWeight = Math.round(totalAssessedWeight * 100) / 100;
        const roundedWeightedSum = Math.round(weightedSum * 10) / 10;

        const formula = totalAssessedWeight > 0
            ? `[ ${assessedTerms} ] / ${roundedAssessedWeight} = ${roundedWeightedSum} / ${roundedAssessedWeight} = ${overallScore}/100`
            : "No assessable dimensions identified = 0/100";

        return {
            overallScore,
            scoreGrade,
            formula,
            scoringVersion: this.config.version,
            dimensions,
            totalAssessedWeight: Math.round(totalAssessedWeight * 100) / 100,
            resumeReadinessScore: overallScore,
            extractionConfidence,
            analysisConfidence,
            confidenceDefinitions: {
                readiness: "Readiness score reflects how competitive, comprehensive, and recruiter-ready the resume is based on 7 weighted quality dimensions.",
                extraction: "Extraction confidence measures the certainty of parsed text, entities, dates, and link patterns directly from the source document.",
                analysis: "Analysis confidence measures whether enough structured data was available to assess all 7 dimensions reliably."
            },
            explanationSummary: this.buildExplanationSummary(overallScore, dimensions)
        };
    }

    private evaluateImpactAndMetrics(facts: StructuredResumeFacts): DimensionScoreResult {
        const weight = this.config.dimensionWeights.impactAndMetrics;
        const subcriteria: SubcriterionResult[] = [];
        const strengths: string[] = [];
        const weaknesses: string[] = [];

        const totalMetrics = facts.quantifiedAchievements.length;
        const totalEntries = facts.experience.length + facts.projects.length;

        // Subcriterion 1: Presence of measurable metrics (40% of dimension)
        let metricScore = 0;
        if (totalMetrics >= 6) metricScore = 100;
        else if (totalMetrics >= 4) metricScore = 85;
        else if (totalMetrics >= 2) metricScore = 65;
        else if (totalMetrics === 1) metricScore = 40;
        else metricScore = 0; // ZERO evidence = 0 marks (previously baseline 10)

        subcriteria.push({
            id: "metrics_presence",
            label: "Measurable Outcomes & Quantified Results",
            score: metricScore,
            maxScore: 100,
            weight: 0.40,
            evidence: totalMetrics > 0
                ? `${totalMetrics} quantified metric(s) identified across resume entries.`
                : "No numerical impact or quantified metrics detected.",
            explanation: totalMetrics >= 3
                ? "Excellent inclusion of concrete metrics demonstrating quantifiable results."
                : totalMetrics > 0
                    ? "Limited metrics found. Recruiters heavily favor resumes with measurable business or technical outcomes."
                    : "Zero quantified achievements found. Add metrics (e.g. % speedup, users served, latency reduction) to earn marks."
        });

        // Subcriterion 2: Metric Distribution Across Entries (30% of dimension)
        const entriesWithMetrics = new Set(facts.quantifiedAchievements.map(m => m.associatedEntry)).size;
        const coverageRatio = totalEntries > 0 ? entriesWithMetrics / totalEntries : 0;
        let coverageScore = 0;
        if (totalEntries > 0 && entriesWithMetrics > 0) {
            coverageScore = Math.min(100, Math.round(coverageRatio * 120));
        } else {
            coverageScore = 0; // ZERO entries or ZERO metrics = 0 marks (previously baseline 20)
        }

        subcriteria.push({
            id: "metric_distribution",
            label: "Impact Distribution Across Experiences & Projects",
            score: coverageScore,
            maxScore: 100,
            weight: 0.30,
            evidence: totalEntries > 0
                ? `${entriesWithMetrics} of ${totalEntries} experience/project entries contain quantified impact.`
                : "No project or experience entries available to assess impact distribution.",
            explanation: coverageRatio >= 0.5
                ? "Impact is well-distributed across most of your projects and professional roles."
                : coverageScore > 0
                    ? "Several projects or roles list duties without clear quantitative impact."
                    : "Distribute measurable outcomes across your projects and roles to earn distribution score."
        });

        // Subcriterion 3: Metric Diversity & Scale (30% of dimension)
        const types = new Set(facts.quantifiedAchievements.map(m => m.metricType));
        let diversityScore = 0; // ZERO types = 0 marks (previously baseline 20)
        if (types.size >= 3) diversityScore = 100;
        else if (types.size === 2) diversityScore = 75;
        else if (types.size === 1) diversityScore = 50;

        subcriteria.push({
            id: "metric_diversity",
            label: "Diversity of Metric Types (Scale, Latency, %, Cost)",
            score: diversityScore,
            maxScore: 100,
            weight: 0.30,
            evidence: types.size > 0
                ? `Found metrics across ${types.size} category types: ${Array.from(types).join(", ")}.`
                : "No metric types detected across entries.",
            explanation: types.size >= 2
                ? "Diverse metrics demonstrated (e.g. latency reduction, scale, throughput, efficiency)."
                : types.size === 1
                    ? "Diversify your metrics by adding scale, throughput, latency, or test coverage numbers."
                    : "Include diverse engineering metrics (e.g. latency drops, user count, test coverage, or cost reductions)."
        });

        const score = Math.round(subcriteria.reduce((sum, s) => sum + s.score * s.weight, 0));

        if (totalMetrics >= 3) strengths.push(`${totalMetrics} quantified achievements prove high business & engineering impact.`);
        if (totalMetrics < 2) weaknesses.push("Missing quantifiable impact metrics (percentages, speedups, scale, user count).");

        return {
            dimensionKey: "impactAndMetrics",
            label: "Impact & Quantified Achievements",
            weight,
            score,
            assessed: true,
            subcriteria,
            explanation: score >= 75
                ? "Strong evidence of data-driven impact with quantifiable outcomes."
                : score > 0
                    ? "Needs more quantifiable evidence showing the measurable results of your contributions."
                    : "No measurable metrics found. Incorporate quantifiable results using Google's XYZ formula to gain marks.",
            strengths,
            weaknesses
        };
    }

    private evaluateTechnicalDepth(facts: StructuredResumeFacts): DimensionScoreResult {
        const weight = this.config.dimensionWeights.technicalDepth;
        const subcriteria: SubcriterionResult[] = [];
        const strengths: string[] = [];
        const weaknesses: string[] = [];

        const comp = facts.competencies;
        const totalLanguages = comp.languages.length;
        const totalFrameworks = comp.frameworks.length;
        const totalDatabases = comp.databasesAndStores.length;
        const totalTools = comp.toolsAndCloud.length;
        const totalConcepts = comp.engineeringConcepts.length;

        // Subcriterion 1: Core Technical Stack Breadth (35% of dimension)
        const categoriesWithSkills = [
            totalLanguages > 0,
            totalFrameworks > 0,
            totalDatabases > 0,
            totalTools > 0
        ].filter(Boolean).length;

        let stackScore = 0; // ZERO categories = 0 marks (previously baseline 30)
        if (categoriesWithSkills === 4 && (totalLanguages + totalFrameworks + totalDatabases) >= 8) stackScore = 100;
        else if (categoriesWithSkills >= 3) stackScore = 80;
        else if (categoriesWithSkills >= 2) stackScore = 60;
        else if (categoriesWithSkills === 1) stackScore = 30;

        subcriteria.push({
            id: "stack_breadth",
            label: "Full-Stack & Systems Competency Coverage",
            score: stackScore,
            maxScore: 100,
            weight: 0.35,
            evidence: categoriesWithSkills > 0
                ? `${totalLanguages} languages, ${totalFrameworks} frameworks, ${totalDatabases} databases, ${totalTools} cloud/tools.`
                : "No technical skills or categories identified.",
            explanation: categoriesWithSkills >= 3
                ? "Well-rounded coverage across frontend, backend, databases, and developer tooling."
                : categoriesWithSkills >= 1
                    ? "Stack appears narrow; ensure you list databases, clouds, and build tools."
                    : "No technical skills categorized. Add programming languages, frameworks, and datastores to earn marks."
        });

        // Subcriterion 2: Architectural & Systems Signals (35% of dimension)
        let archSignalsCount = 0;
        for (const p of facts.projects) archSignalsCount += p.architectureSignals.length;
        for (const e of facts.experience) archSignalsCount += e.ownershipSignals.length;

        let archScore = 0; // ZERO signals & ZERO concepts = 0 marks (previously baseline 25)
        if (archSignalsCount >= 5 || totalConcepts >= 4) archScore = 100;
        else if (archSignalsCount >= 3 || totalConcepts >= 2) archScore = 80;
        else if (archSignalsCount >= 1 || totalConcepts >= 1) archScore = 55;

        subcriteria.push({
            id: "architecture_scale",
            label: "Architecture, Systems & Design Signals",
            score: archScore,
            maxScore: 100,
            weight: 0.35,
            evidence: archSignalsCount > 0 || totalConcepts > 0
                ? `${archSignalsCount} architectural signals and ${totalConcepts} engineering concepts detected.`
                : "No architectural or systems design signals detected.",
            explanation: archScore >= 75
                ? "Resume shows solid architectural depth and engineering complexity beyond simple CRUD."
                : archScore > 0
                    ? "Add more architectural context: discuss distributed caching, database indexing, queue workers, or scalability."
                    : "No architectural signals found. Mention caching, microservices, concurrency, or DB optimization to earn score."
        });

        // Subcriterion 3: Project Technical Context (30% of dimension)
        const projectsWithTech = facts.projects.filter(p => p.technologies.length >= 2).length;
        const projectTechRatio = facts.projects.length > 0 ? projectsWithTech / facts.projects.length : 0;
        const projectDepthScore = facts.projects.length > 0 ? Math.min(100, Math.round(projectTechRatio * 100)) : 0;

        subcriteria.push({
            id: "project_tech_depth",
            label: "Concrete Technical Stack per Project/Experience",
            score: projectDepthScore,
            maxScore: 100,
            weight: 0.30,
            evidence: facts.projects.length > 0
                ? `${projectsWithTech} of ${facts.projects.length} projects explicitly state modern technology stacks.`
                : "No project entries found to evaluate technical stack grounding.",
            explanation: projectTechRatio >= 0.8
                ? "Every project clearly grounds its implementation in specific frameworks and databases."
                : projectDepthScore > 0
                    ? "Ensure every project and work entry explicitly lists the technologies used in its stack."
                    : "List specific technologies (languages, frameworks, DBs) used under each project."
        });

        const score = Math.round(subcriteria.reduce((sum, s) => sum + s.score * s.weight, 0));

        if (totalLanguages >= 2 && totalFrameworks >= 2 && totalDatabases >= 1) {
            strengths.push("Comprehensive technical stack with strong database and modern framework coverage.");
        }
        if (totalDatabases === 0) {
            weaknesses.push("No database or data persistence systems explicitly listed.");
        }

        return {
            dimensionKey: "technicalDepth",
            label: "Technical Depth & Evidence",
            weight,
            score,
            assessed: true,
            subcriteria,
            explanation: score >= 75
                ? "Demonstrates robust engineering capabilities with architectural and full-stack rigor."
                : score > 0
                    ? "Deepen your technical descriptions by mentioning architecture, persistence, and scale."
                    : "Zero technical depth evidence found. List technical stack and architectural signals to earn marks.",
            strengths,
            weaknesses
        };
    }

    private evaluateTargetRoleAlignment(facts: StructuredResumeFacts, explicitTargetRole?: string): DimensionScoreResult {
        const weight = this.config.dimensionWeights.targetRoleAlignment;
        const subcriteria: SubcriterionResult[] = [];
        const strengths: string[] = [];
        const weaknesses: string[] = [];

        const headline = facts.personal.headline?.value || "";
        const role = explicitTargetRole || headline || "Software Engineer";

        // Subcriterion 1: Professional Headline & Identity (35% of dimension)
        let headlineScore = 0; // ZERO headline & ZERO role = 0 marks (previously baseline 30)
        if (headline.length > 5) headlineScore = 100;
        else if (facts.experience.length > 0 && facts.experience[0].role.value) headlineScore = 75;

        subcriteria.push({
            id: "role_identity",
            label: "Professional Headline & Target Domain Identity",
            score: headlineScore,
            maxScore: 100,
            weight: 0.35,
            evidence: headline
                ? `Headline: "${headline}"`
                : facts.experience.length > 0 && facts.experience[0].role.value
                    ? `Role inferred from recent experience: "${facts.experience[0].role.value}"`
                    : "No explicit professional headline or recent job title detected in header.",
            explanation: headlineScore >= 75
                ? "Clear professional headline immediately informs recruiters of your target role."
                : "Add a crisp 1-line professional headline beneath your name (e.g. 'Full-Stack Software Engineer | TypeScript & Distributed Systems')."
        });

        // Subcriterion 2: Relevant Project & Work Alignment (40% of dimension)
        const relevantEntries = facts.experience.length + facts.projects.length;
        let alignmentScore = 0; // ZERO entries = 0 marks (previously baseline 20)
        if (relevantEntries >= 4) alignmentScore = 100;
        else if (relevantEntries >= 3) alignmentScore = 85;
        else if (relevantEntries >= 2) alignmentScore = 70;
        else if (relevantEntries === 1) alignmentScore = 40;

        subcriteria.push({
            id: "role_entry_alignment",
            label: "Substantive Project & Experience Portfolio",
            score: alignmentScore,
            maxScore: 100,
            weight: 0.40,
            evidence: relevantEntries > 0
                ? `${relevantEntries} total experience & project items supporting role as ${role}.`
                : "No experience or project items found supporting target role.",
            explanation: relevantEntries >= 3
                ? "Substantive project and work portfolio validating your targeted role."
                : relevantEntries > 0
                    ? "Add more end-to-end projects demonstrating production readiness in your target domain."
                    : "Add software projects or internships demonstrating practical execution in your domain."
        });

        // Subcriterion 3: Modern Industry Tooling Currency (25% of dimension)
        const allSkills = [
            ...facts.competencies.languages.map(l => l.value.toLowerCase()),
            ...facts.competencies.frameworks.map(f => f.value.toLowerCase()),
            ...facts.competencies.databasesAndStores.map(d => d.value.toLowerCase()),
            ...facts.competencies.toolsAndCloud.map(t => t.value.toLowerCase())
        ];

        const modernTechList = ["react", "next.js", "typescript", "node.js", "python", "docker", "postgresql", "mongodb", "aws", "tailwind", "fastapi", "go", "graphql"];
        const matchedModern = modernTechList.filter(t => allSkills.some(s => s.includes(t)));
        let currencyScore = matchedModern.length > 0 ? Math.min(100, Math.round((matchedModern.length / 4) * 100)) : 0;

        subcriteria.push({
            id: "tooling_currency",
            label: "Industry Modern Stack Relevance",
            score: currencyScore,
            maxScore: 100,
            weight: 0.25,
            evidence: matchedModern.length > 0
                ? `Matches ${matchedModern.length} high-demand industry technologies (${matchedModern.slice(0, 4).join(", ")}).`
                : "No high-demand modern stack technologies detected.",
            explanation: matchedModern.length >= 3
                ? "Skills align strongly with modern high-growth tech company requirements."
                : "Incorporate modern industry tools (e.g. TypeScript, Docker, Next.js, PostgreSQL) to boost recruiter demand."
        });

        const score = Math.round(subcriteria.reduce((sum, s) => sum + s.score * s.weight, 0));

        if (headlineScore >= 80) strengths.push(`Clear domain targeting: aligned for ${role}.`);
        if (!headline) weaknesses.push("Missing explicit professional headline at top of resume.");

        return {
            dimensionKey: "targetRoleAlignment",
            label: "Target Role Alignment",
            weight,
            score,
            assessed: true,
            subcriteria,
            explanation: score >= 75
                ? `Strong alignment with ${role} expectations and modern technology requirements.`
                : score > 0
                    ? `Align your resume headline and top projects more deliberately around ${role}.`
                    : "No role alignment signals found. Add a professional headline and projects to earn score.",
            strengths,
            weaknesses
        };
    }

    private evaluateAtsStructure(facts: StructuredResumeFacts): DimensionScoreResult {
        const weight = this.config.dimensionWeights.atsStructure;
        const subcriteria: SubcriterionResult[] = [];
        const strengths: string[] = [];
        const weaknesses: string[] = [];

        const pq = facts.parsingQuality;

        // Subcriterion 1: Standard ATS Sections Detected (40% of dimension)
        const requiredSections = ["experience", "education", "projects", "skills"];
        const detectedLower = pq.detectedSections.map(s => s.toLowerCase());
        const presentCount = requiredSections.filter(s => detectedLower.some(d => d.includes(s))).length;
        const sectionScore = Math.round((presentCount / requiredSections.length) * 100);

        subcriteria.push({
            id: "standard_sections",
            label: "Standard ATS Section Headings",
            score: sectionScore,
            maxScore: 100,
            weight: 0.40,
            evidence: presentCount > 0
                ? `${presentCount} of 4 core ATS sections identified: ${detectedLower.join(", ")}.`
                : "No standard ATS section headers detected.",
            explanation: presentCount === 4
                ? "All four canonical ATS sections (Experience, Education, Projects, Skills) detected."
                : "Ensure standard section titles are used: 'Experience', 'Projects', 'Education', 'Technical Skills'."
        });

        // Subcriterion 2: Document Parseability & Text Quality (35% of dimension)
        let parseScore = pq.hasSelectableText ? pq.qualityScore : 0;
        if (pq.isScanned) parseScore = Math.min(parseScore, 20);
        if (pq.wordCount === 0) parseScore = 0; // ZERO words = 0 marks

        subcriteria.push({
            id: "parseability_quality",
            label: "Machine Parseability & OCR Quality",
            score: parseScore,
            maxScore: 100,
            weight: 0.35,
            evidence: `Document quality score ${pq.qualityScore}/100. Selectable text: ${pq.hasSelectableText ? "Yes" : "No"}. Word count: ${pq.wordCount}.`,
            explanation: pq.hasSelectableText && !pq.isScanned && pq.wordCount > 0
                ? "Document parsed cleanly with standard text encoding and zero OCR degradation."
                : "Document has formatting, text encoding, or OCR issues that may confuse Applicant Tracking Systems."
        });

        // Subcriterion 3: Content Density & Page Economy (25% of dimension)
        let densityScore = 0; // ZERO words = 0 marks (previously baseline 40 or 70)
        if (pq.wordCount >= 300 && pq.wordCount <= 850) densityScore = 100;
        else if (pq.wordCount > 850 && pq.wordCount <= 1200) densityScore = 80;
        else if (pq.wordCount >= 150) densityScore = 50;
        else if (pq.wordCount >= 50) densityScore = 25;
        else densityScore = 0;

        subcriteria.push({
            id: "content_density",
            label: "Content Density & Word Count Economy",
            score: densityScore,
            maxScore: 100,
            weight: 0.25,
            evidence: `Total word count: ${pq.wordCount} words across ${pq.pageCount || 1} page(s).`,
            explanation: pq.wordCount >= 300 && pq.wordCount <= 850
                ? "Optimal word density for a 1-page modern technical resume."
                : densityScore > 0
                    ? "Resume word count should ideally be between 350-800 words for maximum recruiter readability."
                    : "Document contains insufficient text (< 50 words). Provide a complete resume to earn density marks."
        });

        const score = Math.round(subcriteria.reduce((sum, s) => sum + s.score * s.weight, 0));

        if (presentCount >= 3) strengths.push("Clean ATS layout with standard, machine-readable section headings.");
        if (pq.wordCount < 250 && pq.wordCount > 0) weaknesses.push("Resume content is sparse (< 250 words); expand on project architecture.");

        return {
            dimensionKey: "atsStructure",
            label: "ATS Structure & Parseability",
            weight,
            score,
            assessed: true,
            subcriteria,
            explanation: score >= 80
                ? "Document is structured cleanly for Applicant Tracking Systems (ATS) and human recruiters alike."
                : score > 0
                    ? "Improve ATS compliance by standardizing section names and maintaining single-column clarity."
                    : "No ATS structure detected. Use standard headings and single-column layout.",
            strengths,
            weaknesses
        };
    }

    private evaluateClarityAndWriting(facts: StructuredResumeFacts): DimensionScoreResult {
        const weight = this.config.dimensionWeights.clarityAndActionWriting;
        const subcriteria: SubcriterionResult[] = [];
        const strengths: string[] = [];
        const weaknesses: string[] = [];

        // Collect all bullet points
        const allBullets: string[] = [];
        for (const e of facts.experience) allBullets.push(...e.responsibilities);
        for (const p of facts.projects) {
            allBullets.push(...p.description.split(/\n|(?<=\.) /).filter(b => b.trim().length > 15));
        }

        const actionVerbRegex = /^(engineered|architected|built|developed|designed|implemented|optimized|spearheaded|created|integrated|streamlined|refactored|automated|deployed|configured|orchestrated|scaled|reduced|increased|accelerated|maintained|led)/i;
        const passiveRegex = /^(responsible for|helped with|assisted in|worked on|tasked with|involved in)/i;

        const actionBullets = allBullets.filter(b => actionVerbRegex.test(b.trim()));
        const passiveBullets = allBullets.filter(b => passiveRegex.test(b.trim()));

        // Subcriterion 1: Strong Action-Verb Initiations (45% of dimension)
        let actionScore = 0; // ZERO bullets = 0 marks (previously default 0.5 ratio gave 65)
        if (allBullets.length > 0) {
            const actionRatio = actionBullets.length / allBullets.length;
            actionScore = Math.min(100, Math.round(actionRatio * 130));
            if (passiveBullets.length > 0) actionScore = Math.max(0, actionScore - (passiveBullets.length * 15));
        }

        subcriteria.push({
            id: "action_verbs",
            label: "Action-Oriented Verbs (XYZ & CAR Formula)",
            score: actionScore,
            maxScore: 100,
            weight: 0.45,
            evidence: allBullets.length > 0
                ? `${actionBullets.length} of ${allBullets.length} bullets begin with strong engineering action verbs. ${passiveBullets.length} passive phrases found.`
                : "No project or experience bullet points found to evaluate action verbs.",
            explanation: allBullets.length > 0 && actionScore >= 60
                ? "Bullets consistently lead with powerful technical action verbs (Engineered, Architected, Optimized)."
                : allBullets.length > 0
                    ? "Avoid passive phrases like 'Responsible for' or 'Worked on'; start every bullet with an assertive verb."
                    : "Add bullet points describing project accomplishments and lead each with an action verb."
        });

        // Subcriterion 2: Bullet Length & Conciseness (35% of dimension)
        const wellSizedBullets = allBullets.filter(b => {
            const words = b.trim().split(/\s+/).length;
            return words >= 8 && words <= 35;
        }).length;

        let brevityScore = 0; // ZERO bullets = 0 marks (previously default 0.7 ratio gave 70)
        if (allBullets.length > 0) {
            const concisenessRatio = wellSizedBullets / allBullets.length;
            brevityScore = Math.min(100, Math.round(concisenessRatio * 100));
        }

        subcriteria.push({
            id: "bullet_conciseness",
            label: "Bullet Length, Density & Readability",
            score: brevityScore,
            maxScore: 100,
            weight: 0.35,
            evidence: allBullets.length > 0
                ? `${wellSizedBullets} of ${allBullets.length} statements are well-proportioned (8-35 words).`
                : "No bullet statements detected.",
            explanation: brevityScore >= 70
                ? "Bullets are concise, focused, and avoid rambling or one-line fragments."
                : brevityScore > 0
                    ? "Keep bullets between 10-30 words: clear, punchy, and result-oriented."
                    : "Write descriptive bullets (10-30 words) detailing your technical contributions."
        });

        // Subcriterion 3: Technical Term Capitalization & Consistency (20% of dimension)
        let consistencyScore = 0; // ZERO bullets = 0 marks (previously default 90)
        if (allBullets.length > 0) {
            consistencyScore = 90;
        }

        subcriteria.push({
            id: "writing_consistency",
            label: "Technical Terminology & Capitalization Hygiene",
            score: consistencyScore,
            maxScore: 100,
            weight: 0.20,
            evidence: allBullets.length > 0
                ? "Consistent capitalization and industry-standard technical phrasing observed."
                : "No technical bullet text available to assess terminology hygiene.",
            explanation: consistencyScore > 0
                ? "Technical names (JavaScript, Node.js, GraphQL) are properly formatted without spelling noise."
                : "Include technical descriptions to evaluate technical formatting and consistency."
        });

        const score = Math.round(subcriteria.reduce((sum, s) => sum + s.score * s.weight, 0));

        if (actionBullets.length >= 4 && passiveBullets.length === 0) {
            strengths.push("Direct, action-driven writing style using strong technical impact verbs.");
        }
        if (passiveBullets.length > 0) {
            weaknesses.push(`Found ${passiveBullets.length} passive sentence starter(s) (e.g. 'Responsible for'); rewrite with active engineering verbs.`);
        }

        return {
            dimensionKey: "clarityAndActionWriting",
            label: "Clarity & Action-Oriented Writing",
            weight,
            score,
            assessed: true,
            subcriteria,
            explanation: score >= 75
                ? "Crisp, assertive writing style that clearly attributes technical ownership."
                : score > 0
                    ? "Replace passive statements with authoritative engineering verbs and direct outcomes."
                    : "Zero action-oriented writing evidence found. Formulate accomplishment bullets using active verbs.",
            strengths,
            weaknesses
        };
    }

    private evaluateVerifiedProfiles(facts: StructuredResumeFacts): DimensionScoreResult {
        const weight = this.config.dimensionWeights.verifiedProfiles;
        const subcriteria: SubcriterionResult[] = [];
        const strengths: string[] = [];
        const weaknesses: string[] = [];

        const links = facts.personal.links;
        const hasGithub = links.some(l => l.platform.toLowerCase() === "github");
        const hasLinkedin = links.some(l => l.platform.toLowerCase() === "linkedin");
        const hasPortfolio = links.some(l => l.platform.toLowerCase() === "portfolio" || l.platform.toLowerCase() === "website");
        const hasCodingProfile = links.some(l => ["leetcode", "codeforces", "codechef"].includes(l.platform.toLowerCase()));

        // Subcriterion 1: GitHub / Code Repository Presence (40% of dimension)
        const githubScore = hasGithub ? 100 : 0; // ZERO evidence = 0 marks (previously baseline 20)
        subcriteria.push({
            id: "github_profile",
            label: "Public Code Repository (GitHub / GitLab)",
            score: githubScore,
            maxScore: 100,
            weight: 0.40,
            evidence: hasGithub ? "GitHub profile link detected." : "No GitHub profile link detected.",
            explanation: hasGithub
                ? "Public code repository allows technical recruiters and interviewers to verify code quality."
                : "Adding an active GitHub profile link is essential for modern software engineering verification."
        });

        // Subcriterion 2: Professional Network & Portfolio (35% of dimension)
        let networkScore = 0; // ZERO evidence = 0 marks (previously baseline 20)
        if (hasLinkedin && hasPortfolio) networkScore = 100;
        else if (hasLinkedin || hasPortfolio) networkScore = 70;

        subcriteria.push({
            id: "professional_links",
            label: "Professional Presence (LinkedIn & Portfolio)",
            score: networkScore,
            maxScore: 100,
            weight: 0.35,
            evidence: `LinkedIn: ${hasLinkedin ? "Present" : "Missing"}, Portfolio: ${hasPortfolio ? "Present" : "Missing"}.`,
            explanation: hasLinkedin
                ? "LinkedIn presence facilitates background and social proof verification."
                : "Include your LinkedIn profile and personal portfolio link."
        });

        // Subcriterion 3: Project Live Demos / Competitive Coding (25% of dimension)
        const projectsWithUrls = facts.projects.filter(p => p.liveUrl || p.githubUrl).length;
        let demoScore = 0; // ZERO evidence = 0 marks (previously baseline 30)
        if (projectsWithUrls >= 2 || hasCodingProfile) demoScore = 100;
        else if (projectsWithUrls >= 1) demoScore = 65;

        subcriteria.push({
            id: "live_work_evidence",
            label: "Live Demos & Competitive Coding Evidence",
            score: demoScore,
            maxScore: 100,
            weight: 0.25,
            evidence: projectsWithUrls > 0 || hasCodingProfile
                ? `${projectsWithUrls} projects have direct repository or deployment links. Competitive profiles: ${hasCodingProfile ? "Yes" : "No"}.`
                : "No live project URLs or competitive programming links detected.",
            explanation: demoScore >= 65
                ? "Live project deployments or repository links provide immediate proof of work."
                : "Add live demo links or repository URLs to your projects so evaluators can inspect working software."
        });

        const score = Math.round(subcriteria.reduce((sum, s) => sum + s.score * s.weight, 0));

        if (hasGithub && hasLinkedin) strengths.push("Public code repository and LinkedIn links enable seamless candidate verification.");
        if (!hasGithub) weaknesses.push("No GitHub link detected; tech companies prioritize candidates with inspectable code.");

        return {
            dimensionKey: "verifiedProfiles",
            label: "Verified Profiles & Work Evidence",
            weight,
            score,
            assessed: true,
            subcriteria,
            explanation: score >= 75
                ? "Verified profiles and portfolio links back up your resume with concrete evidence."
                : score > 0
                    ? "Strengthen recruiter trust by providing working GitHub and live deployment links."
                    : "No public code repository or portfolio links found. Add your GitHub and LinkedIn profiles to earn marks.",
            strengths,
            weaknesses
        };
    }

    private evaluateContactAndCompleteness(facts: StructuredResumeFacts): DimensionScoreResult {
        const weight = this.config.dimensionWeights.contactAndCompleteness;
        const subcriteria: SubcriterionResult[] = [];
        const strengths: string[] = [];
        const weaknesses: string[] = [];

        const hasName = Boolean(facts.personal.fullName?.value && facts.personal.fullName.value.length > 2);
        const hasEmail = Boolean(facts.personal.email?.value);
        const hasPhone = Boolean(facts.personal.phone?.value);
        const hasEducation = facts.education.length > 0;
        const hasGradYear = facts.education.some(e => e.graduationYear && e.graduationYear > 2000);

        // Doc Specification v3.0: If contact channels (email and phone) are completely missing,
        // this dimension is unassessable and its weight is dynamically removed from the denominator
        // to prevent unfair score distortion (e.g. blind/anonymized resumes).
        const isUnassessable = !hasEmail && !hasPhone;

        if (isUnassessable) {
            subcriteria.push({
                id: "contact_methods",
                label: "Direct Reachability (Email & Phone)",
                score: 0,
                maxScore: 100,
                weight: 0.40,
                evidence: "Neither email nor phone number detected in document.",
                explanation: "Contact info omitted or unextractable. Dimension marked unassessable per Orbix v3.0 model."
            });
            subcriteria.push({
                id: "identity_header",
                label: "Candidate Full Name & Location",
                score: hasName ? 100 : 0,
                maxScore: 100,
                weight: 0.30,
                evidence: hasName ? `Candidate Name: "${facts.personal.fullName?.value}"` : "Candidate name not detected.",
                explanation: hasName ? "Name detected in header." : "Candidate name not found."
            });
            subcriteria.push({
                id: "academic_records",
                label: "Education Credentials & Graduation Timeline",
                score: hasEducation ? (hasGradYear ? 100 : 75) : 0,
                maxScore: 100,
                weight: 0.30,
                evidence: hasEducation ? `${facts.education.length} degree program(s) identified.` : "No education records detected.",
                explanation: hasEducation ? "Academic background stated." : "Education records missing."
            });

            return {
                dimensionKey: "contactAndCompleteness",
                label: "Contact & Resume Completeness",
                weight,
                score: 0,
                assessed: false, // DYNAMICALLY EXCLUDED FROM DENOMINATOR!
                subcriteria,
                explanation: "Contact channels (email/phone) are missing or omitted from this document. In accordance with the Orbix Intelligence v3.0 mathematical model, this dimension is unassessable and dynamically removed from the denominator, re-normalizing the remaining 6 dimensions so the candidate is not penalized.",
                strengths: [],
                weaknesses: ["Document lacks direct recruiter contact channels (email / phone)."]
            };
        }

        // Subcriterion 1: Contact Information (40% of dimension)
        let contactScore = 0; // ZERO evidence = 0 marks (previously baseline 20)
        if (hasEmail && hasPhone) contactScore = 100;
        else if (hasEmail) contactScore = 80;
        else if (hasPhone) contactScore = 40;

        subcriteria.push({
            id: "contact_methods",
            label: "Direct Reachability (Email & Phone)",
            score: contactScore,
            maxScore: 100,
            weight: 0.40,
            evidence: `Email: ${hasEmail ? "Present" : "Missing"}, Phone: ${hasPhone ? "Present" : "Missing"}.`,
            explanation: hasEmail
                ? "Contact information is accessible for recruiters."
                : "Crucial contact methods (email) are missing."
        });

        // Subcriterion 2: Candidate Identification (30% of dimension)
        const idScore = hasName ? 100 : 0; // ZERO evidence = 0 marks (previously baseline 30)
        subcriteria.push({
            id: "identity_header",
            label: "Candidate Full Name & Location",
            score: idScore,
            maxScore: 100,
            weight: 0.30,
            evidence: hasName
                ? `Candidate Name: "${facts.personal.fullName?.value}", Location: "${facts.personal.location?.value || "Not stated"}".`
                : "Candidate name could not be reliably extracted from header.",
            explanation: hasName
                ? "Candidate name clearly anchored at top of resume."
                : "Candidate name could not be reliably extracted from header."
        });

        // Subcriterion 3: Academic Credentials (30% of dimension)
        let eduScore = 0; // ZERO evidence = 0 marks (previously baseline 20)
        if (hasEducation && hasGradYear) eduScore = 100;
        else if (hasEducation) eduScore = 75;

        subcriteria.push({
            id: "academic_records",
            label: "Education Credentials & Graduation Timeline",
            score: eduScore,
            maxScore: 100,
            weight: 0.30,
            evidence: hasEducation
                ? `${facts.education.length} degree program(s) identified. Timeline stated: ${hasGradYear ? "Yes" : "No"}.`
                : "No degree or academic credentials identified.",
            explanation: hasEducation
                ? "Education and academic timeline clearly documented."
                : "Add degree, university name, and graduation year."
        });

        const score = Math.round(subcriteria.reduce((sum, s) => sum + s.score * s.weight, 0));

        if (hasName && hasEmail && hasEducation) strengths.push("Complete contact information and academic history.");
        if (!hasEmail) weaknesses.push("Missing email address; recruiters cannot contact you.");

        return {
            dimensionKey: "contactAndCompleteness",
            label: "Contact & Resume Completeness",
            weight,
            score,
            assessed: true,
            subcriteria,
            explanation: score >= 80
                ? "Resume contact info and core metadata are complete."
                : "Ensure your email, phone, location, and graduation year are explicitly listed.",
            strengths,
            weaknesses
        };
    }

    private getScoreGrade(score: number): "Top Tier" | "Competitive" | "Strong Foundation" | "Needs Improvement" {
        if (score >= 88) return "Top Tier";
        if (score >= 75) return "Competitive";
        if (score >= 60) return "Strong Foundation";
        return "Needs Improvement";
    }

    private calculateExtractionConfidence(facts: StructuredResumeFacts): number {
        const confidences: number[] = [];
        if (facts.personal.fullName?.extractionConfidence) confidences.push(facts.personal.fullName.extractionConfidence);
        if (facts.personal.email?.extractionConfidence) confidences.push(facts.personal.email.extractionConfidence);
        if (facts.personal.headline?.extractionConfidence) confidences.push(facts.personal.headline.extractionConfidence);

        for (const e of facts.education) {
            if (e.institution?.extractionConfidence) confidences.push(e.institution.extractionConfidence);
        }
        for (const exp of facts.experience) {
            if (exp.role?.extractionConfidence) confidences.push(exp.role.extractionConfidence);
            if (exp.company?.extractionConfidence) confidences.push(exp.company.extractionConfidence);
        }
        for (const p of facts.projects) {
            if (p.title?.extractionConfidence) confidences.push(p.title.extractionConfidence);
        }

        const avgFactConfidence = confidences.length > 0
            ? (confidences.reduce((a, b) => a + b, 0) / confidences.length) * 100
            : 70;

        const parsingQualityScore = facts.parsingQuality?.qualityScore || 80;

        return Math.round((avgFactConfidence * 0.6) + (parsingQualityScore * 0.4));
    }

    private calculateAnalysisConfidence(facts: StructuredResumeFacts, totalAssessedWeight: number): number {
        let confidence = 85;

        // Penalty if assessed dimensions weight is incomplete
        if (totalAssessedWeight < 0.95) {
            confidence -= Math.round((1.0 - totalAssessedWeight) * 40);
        }

        // Penalty if document text is too short or has warnings
        if (facts.parsingQuality.wordCount < 150) {
            confidence -= 30;
        } else if (facts.parsingQuality.wordCount < 300) {
            confidence -= 15;
        }

        if (facts.parsingQuality.isScanned) {
            confidence -= 20;
        }

        if (facts.experience.length === 0 && facts.projects.length === 0) {
            confidence -= 25;
        }

        return Math.max(10, Math.min(98, confidence));
    }

    private buildExplanationSummary(score: number, dims: Record<ScoringDimensionKey, DimensionScoreResult>): string {
        const assessedList = Object.values(dims).filter(d => d.assessed);
        const unassessedList = Object.values(dims).filter(d => !d.assessed);

        if (assessedList.length === 0) {
            return `Score: ${score}/100. No assessable dimensions could be evaluated from the document.`;
        }

        const highestDim = [...assessedList].sort((a, b) => b.score - a.score)[0];
        const lowestDim = [...assessedList].sort((a, b) => a.score - b.score)[0];

        let summary = `Your overall score of ${score}/100 was deterministically calculated using Orbix Intelligence Model v3.0 across ${assessedList.length} assessed dimensions. ` +
            `Strongest area: ${highestDim.label} (${highestDim.score}/100). ` +
            `Primary area for growth: ${lowestDim.label} (${lowestDim.score}/100).`;

        if (unassessedList.length > 0) {
            const names = unassessedList.map(u => u.label).join(", ");
            summary += ` Note: ${names} was not present in the document and was excluded from the denominator to maintain fair evaluation.`;
        }

        return summary;
    }
}
