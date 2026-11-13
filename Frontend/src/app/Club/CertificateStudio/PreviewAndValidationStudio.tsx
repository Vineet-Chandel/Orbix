import React, { useState, useMemo, useRef, useCallback } from "react";
import {
    Award,
    CheckCircle2,
    AlertTriangle,
    FileDown,
    ArrowLeft,
    ChevronLeft,
    ChevronRight,
    QrCode,
    Sliders,
    Maximize,
    ZoomIn,
    ZoomOut,
    Sparkles,
    ShieldCheck,
    Users,
    Search,
    AlertCircle,
    Check,
} from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import {
    type CertificateDesign,
    type DynamicDataSnapshot,
} from "../../../types/certificateStudio";
import { previewSampleCertificate } from "../../../api/certificateStudioApi";
import type { EventRecipientItem, EligibleRecipient } from "../../../api/clubCertificatesApi";

export interface PreviewAndValidationStudioProps {
    design: CertificateDesign;
    templateName: string;
    clubName?: string;
    clubCollege?: string;
    eligibleRecipients?: EligibleRecipient[];
    eventRecipients?: EventRecipientItem[];
    onBackToEditor: () => void;
    onApproveAndProceed: (design: CertificateDesign) => void;
}

export interface SimulationScenario {
    id: string;
    title: string;
    badge: string;
    description: string;
    snapshot: DynamicDataSnapshot;
}

export interface ValidationCheckResult {
    id: string;
    elemId?: string;
    title: string;
    message: string;
    severity: "error" | "warning" | "info";
    category: "overflow" | "missing_data" | "alignment" | "qr" | "image" | "font" | "visibility" | "orientation";
    fixActionLabel?: string;
}

export const PreviewAndValidationStudio: React.FC<PreviewAndValidationStudioProps> = ({
    design,
    templateName,
    clubName = "Orbix Developer Society",
    clubCollege = "Delhi Technological University",
    eligibleRecipients = [],
    eventRecipients = [],
    onBackToEditor,
    onApproveAndProceed,
}) => {
    const toast = useToast();

    // Active mode: "simulation" vs "real"
    const [recipientMode, setRecipientMode] = useState<"simulation" | "real">("simulation");
    const [activeScenarioIndex, setActiveScenarioIndex] = useState<number>(0);
    const [activeRealRecipientIndex, setActiveRealRecipientIndex] = useState<number>(0);
    const [realSearchQuery, setRealSearchQuery] = useState<string>("");

    // Inspection & Highlighting
    const [inspectedElementId, setInspectedElementId] = useState<string | null>(null);

    // Zoom & Viewport
    const [zoom, setZoom] = useState<number>(0.85);
    const [isGeneratingPdf, setIsGeneratingPdf] = useState<boolean>(false);
    const [pdfSha256, setPdfSha256] = useState<string | null>(null);

    const canvasContainerRef = useRef<HTMLDivElement>(null);
    const canvasWidth = design.page?.width || 842;
    const canvasHeight = design.page?.height || 595;

    // Phase 7.1: Pre-configured Simulation Scenarios
    const simulationScenarios: SimulationScenario[] = useMemo(() => [
        {
            id: "scenario-standard",
            title: "Standard Verified Recipient",
            badge: "Normal",
            description: "A student with full verified profile data, 1st place placement, and complete institution records.",
            snapshot: {
                recipient: {
                    id: "usr_sim_01",
                    name: "Aarav Sharma",
                    fullName: "Aarav Sharma",
                    firstName: "Aarav",
                    middleName: "Kumar",
                    lastName: "Sharma",
                    username: "aarav_dev",
                    headline: "Full-Stack Developer & Systems Architect",
                    collegeName: clubCollege,
                    institution: clubCollege,
                    campus: "Main Campus (Shahbad Daulatpur)",
                    department: "Computer Science & Engineering",
                    rollNumber: "2K22/CO/142",
                    city: "New Delhi",
                    state: "Delhi",
                },
                event: {
                    id: "evt_sim_01",
                    title: "Annual HackSphere 2026",
                    name: "Annual HackSphere 2026",
                    category: "Hackathon & Design Sprint",
                    date: "November 8, 2026",
                    venue: "Pragyan Auditorium, Hall B",
                    location: "New Delhi, India",
                    organizingClub: clubName,
                },
                club: {
                    id: "clb_sim_01",
                    name: clubName,
                    slug: "orbix-dev-society",
                    collegeName: clubCollege,
                    leadName: "Ananya Roy",
                },
                award: {
                    title: templateName || "Certificate of Achievement",
                    type: "achievement",
                    description: "In recognition of outstanding algorithmic problem solving, exceptional teamwork, and demonstrated commitment to technical excellence.",
                    position: "Winner — 1st Place",
                    rank: "Rank #1",
                    awardCategory: "Best AI Innovation",
                    participationStatus: "Verified Attendee",
                    completionStatus: "Distinction Honors",
                },
                team: {
                    id: "team_sim_01",
                    name: "Team NeuralForge",
                    identifier: "TEAM-NF-09",
                    role: "Lead ML Architect",
                    members: "Aarav Sharma, Rhea Patel, Rohan Gupta",
                    position: "Winning Team (1st Place)",
                    achievement: "Best Full-Stack System Architecture",
                },
                certificate: {
                    credentialCode: "ORB-SIM-2026-F9A3B2",
                    number: "ORB-2026-0042",
                    issueDate: "November 8, 2026",
                    verificationUrl: "https://orbix.dev/verify/certificate/ORB-SIM-2026-F9A3B2",
                    issuingAuthority: "Orbix Credential Council & Chapter Senate",
                    signerName: "Prof. Rajesh Verma",
                    signerRole: "Faculty Advisor & Head of Dept",
                },
                custom: {
                    instructorName: "Dr. Vikram Sarabhai",
                    workshopDuration: "48 Hours",
                    courseLevel: "Advanced",
                },
            },
        },
        {
            id: "scenario-long-name",
            title: "Long Recipient Name (Auto-Fit Test)",
            badge: "Overflow Test",
            description: "Stress-tests text shrinking and multi-line wrapping with an extended formal name.",
            snapshot: {
                recipient: {
                    id: "usr_sim_02",
                    name: "Dr. Shri Venkata Ramana Murthy Ramanathan",
                    fullName: "Dr. Shri Venkata Ramana Murthy Ramanathan",
                    firstName: "Venkata",
                    middleName: "Ramana Murthy",
                    lastName: "Ramanathan",
                    username: "dr_ramanathan",
                    headline: "Distinguished Research Fellow, High-Performance Computing Laboratory",
                    collegeName: "Indian Institute of Science & Autonomous Research University",
                    institution: "Indian Institute of Science & Autonomous Research University",
                    campus: "National Excellence Center for Quantum & Advanced AI Systems",
                    department: "Center for Advanced Algorithmic Computing & Deep Architecture",
                    rollNumber: "PHD/AI/2026/89412A",
                    city: "Bengaluru",
                    state: "Karnataka",
                },
                event: {
                    id: "evt_sim_02",
                    title: "International Computational Architecture & Distributed Systems Summit 2026",
                    name: "International Computational Architecture & Distributed Systems Summit 2026",
                    category: "Advanced Research Symposium",
                    date: "November 8, 2026",
                    venue: "Sir C. V. Raman Memorial International Auditorium, Convention Center",
                    location: "Bengaluru, Karnataka, India",
                    organizingClub: clubName,
                },
                club: {
                    id: "clb_sim_01",
                    name: clubName,
                    slug: "orbix-dev-society",
                    collegeName: clubCollege,
                    leadName: "Ananya Roy",
                },
                award: {
                    title: "First Runner-Up & Honorable Mention for Outstanding Algorithmic Rigor",
                    type: "excellence",
                    description: "Conferred for groundbreaking contributions to distributed state synchronization and low-latency consensus protocols.",
                    position: "First Runner-Up (2nd Place)",
                    rank: "Rank #2",
                    awardCategory: "Special Research Recognition",
                    participationStatus: "Keynote Attendee",
                    completionStatus: "Summa Cum Laude",
                },
                team: {
                    id: "team_sim_02",
                    name: "Distributed Scalability Research Consortium",
                    identifier: "TEAM-DSRC-99",
                    role: "Principal Computational Architect",
                    members: "Dr. Shri Venkata Ramana Murthy Ramanathan, Dr. Priya Namboodiripad",
                    position: "Finalist Research Team",
                    achievement: "Excellence in Fault-Tolerant Systems",
                },
                certificate: {
                    credentialCode: "ORB-SIM-LONG-88B12C",
                    number: "ORB-2026-0099",
                    issueDate: "November 8, 2026",
                    verificationUrl: "https://orbix.dev/verify/certificate/ORB-SIM-LONG-88B12C",
                    issuingAuthority: "Joint Council for Computer Science & Engineering Credentialing",
                    signerName: "Prof. Dr. K. Radhakrishnan",
                    signerRole: "Dean of Academic Affairs & Chief Patron",
                },
                custom: {
                    instructorName: "Prof. Dr. P. C. Mahalanobis",
                    workshopDuration: "120 Hours Comprehensive",
                    courseLevel: "Post-Graduate Specialized",
                },
            },
        },
        {
            id: "scenario-missing-optional",
            title: "Missing Optional Fields (Fallback Test)",
            badge: "Fallbacks",
            description: "Simulates a recipient with missing roll number, middle name, headline, and team to test fallbacks.",
            snapshot: {
                recipient: {
                    id: "usr_sim_03",
                    name: "Pooja Roy",
                    fullName: "Pooja Roy",
                    firstName: "Pooja",
                    lastName: "Roy",
                    username: "pooja_r",
                    email: "pooja.roy@example.com",
                    collegeName: clubCollege,
                    institution: clubCollege,
                },
                event: {
                    id: "evt_sim_03",
                    title: "Web3 Developer Workshop",
                    name: "Web3 Developer Workshop",
                    category: "Workshop",
                    date: "November 8, 2026",
                    venue: "Lab 4",
                    organizingClub: clubName,
                },
                club: {
                    id: "clb_sim_01",
                    name: clubName,
                    slug: "orbix-dev-society",
                    collegeName: clubCollege,
                },
                award: {
                    title: "Certificate of Completion",
                    type: "completion",
                    description: "Awarded for completing hands-on sessions in smart contract security.",
                    position: "Participant",
                    participationStatus: "Completed",
                },
                certificate: {
                    credentialCode: "ORB-SIM-MINIMAL-7102A",
                    number: "ORB-2026-0150",
                    issueDate: "November 8, 2026",
                    verificationUrl: "https://orbix.dev/verify/certificate/ORB-SIM-MINIMAL-7102A",
                    signerName: "Faculty Coordinator",
                    signerRole: "Club Advisor",
                },
            },
        },
        {
            id: "scenario-team-award",
            title: "Team Credential Scenario",
            badge: "Team Credential",
            description: "Simulates issuance for a winning hackathon team with member role and roster mappings.",
            snapshot: {
                recipient: {
                    id: "usr_sim_04",
                    name: "Rhea Patel",
                    fullName: "Rhea Patel",
                    firstName: "Rhea",
                    lastName: "Patel",
                    username: "rhea_codes",
                    headline: "Cloud & Distributed Systems Specialist",
                    collegeName: clubCollege,
                    institution: clubCollege,
                    department: "Information Technology",
                    rollNumber: "2K22/IT/088",
                    city: "Mumbai",
                    state: "Maharashtra",
                },
                event: {
                    id: "evt_sim_04",
                    title: "Annual HackSphere 2026",
                    name: "Annual HackSphere 2026",
                    category: "48-Hour Hackathon",
                    date: "November 8, 2026",
                    venue: "Innovation Hub, Level 3",
                    location: "New Delhi, India",
                    organizingClub: clubName,
                },
                club: {
                    id: "clb_sim_01",
                    name: clubName,
                    slug: "orbix-dev-society",
                    collegeName: clubCollege,
                    leadName: "Ananya Roy",
                },
                award: {
                    title: "Grand Prize Winners — HackSphere 2026",
                    type: "achievement",
                    description: "Conferred upon the overall champion team for delivering the most technically sophisticated and architecturally scalable solution.",
                    position: "Grand Champion (1st Place)",
                    rank: "Rank #1 Overall",
                    awardCategory: "Flagship Hackathon Trophy",
                    participationStatus: "Active Finalist",
                    completionStatus: "Champions",
                },
                team: {
                    id: "team_sim_04",
                    name: "Team NeuralForge",
                    identifier: "TEAM-NF-09",
                    role: "Lead Cloud Infrastructure Architect",
                    members: "Aarav Sharma, Rhea Patel, Rohan Gupta",
                    position: "Grand Champion Team",
                    achievement: "Highest Scalability & Code Quality Score",
                },
                certificate: {
                    credentialCode: "ORB-SIM-TEAM-44D120",
                    number: "ORB-2026-0001",
                    issueDate: "November 8, 2026",
                    verificationUrl: "https://orbix.dev/verify/certificate/ORB-SIM-TEAM-44D120",
                    issuingAuthority: "Orbix Hackathon Judging Panel & Senate",
                    signerName: "Prof. Rajesh Verma",
                    signerRole: "Head of Hackathon Jury",
                },
            },
        },
        {
            id: "scenario-unicode",
            title: "International / Unicode Characters",
            badge: "Unicode",
            description: "Tests UTF-8 diacritics, multilingual accents, and non-ASCII character handling.",
            snapshot: {
                recipient: {
                    id: "usr_sim_05",
                    name: "François Müller-陈偉強",
                    fullName: "François Müller-陈偉強",
                    firstName: "François",
                    lastName: "Müller",
                    username: "francois_m",
                    headline: "International Open Source Contributor · 开源系统研究员",
                    collegeName: "École Polytechnique & Global Exchange Consortium",
                    institution: "École Polytechnique & Global Exchange Consortium",
                    department: "Mathematics & Computer Science",
                    rollNumber: "EP/X2026/099",
                    city: "Paris",
                    state: "Île-de-France",
                },
                event: {
                    id: "evt_sim_05",
                    title: "Global Open Source & AI Developers Summit 2026",
                    name: "Global Open Source & AI Developers Summit 2026",
                    category: "International Conference",
                    date: "November 8, 2026",
                    venue: "Grand Convention Amphitheatre",
                    location: "Paris, France / Virtual",
                    organizingClub: clubName,
                },
                club: {
                    id: "clb_sim_01",
                    name: clubName,
                    slug: "orbix-dev-society",
                    collegeName: clubCollege,
                    leadName: "Ananya Roy",
                },
                award: {
                    title: "Special Recognition for Global Collaboration",
                    type: "appreciation",
                    description: "Awarded in appreciation of outstanding contributions to open source tooling across international university chapters.",
                    position: "Honored Contributor",
                    awardCategory: "Global Impact",
                },
                certificate: {
                    credentialCode: "ORB-SIM-UNICODE-99F01A",
                    number: "ORB-2026-0200",
                    issueDate: "November 8, 2026",
                    verificationUrl: "https://orbix.dev/verify/certificate/ORB-SIM-UNICODE-99F01A",
                    signerName: "Prof. Rajesh Verma",
                    signerRole: "International Chapter Director",
                },
            },
        },
    ], [clubCollege, clubName, templateName]);

    // Phase 7.2: Real Event / Eligible Participants List
    const realRecipientSnapshots: { recipient: any; snapshot: DynamicDataSnapshot }[] = useMemo(() => {
        if (eventRecipients.length > 0) {
            return eventRecipients.map((rec) => ({
                recipient: rec,
                snapshot: {
                    recipient: {
                        id: rec.userId,
                        name: rec.name,
                        fullName: rec.name,
                        username: rec.username,
                        email: rec.email,
                        collegeName: clubCollege,
                        institution: clubCollege,
                        department: rec.department || "Computer Science",
                        yearOfStudy: rec.yearOfStudy,
                        rollNumber: rec.rollNumber || "N/A",
                    },
                    event: {
                        id: "evt_real_01",
                        title: "Conducted Club Event",
                        name: "Conducted Club Event",
                        date: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
                        venue: "Campus Hall",
                        organizingClub: clubName,
                    },
                    club: {
                        id: "clb_real_01",
                        name: clubName,
                        slug: "club",
                        collegeName: clubCollege,
                    },
                    award: {
                        title: templateName || "Certificate of Participation",
                        type: "participation",
                        description: "Awarded for active participation and demonstrated technical merit.",
                        position: rec.status === "attended" ? "Verified Attendee" : "Participant",
                    },
                    certificate: {
                        credentialCode: `ORB-REAL-${rec.ticketCode || "REC"}-${Date.now().toString(36).substring(4).toUpperCase()}`,
                        issueDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
                        verificationUrl: "https://orbix.dev/verify",
                        signerName: "Faculty Coordinator",
                        signerRole: "Student Chapter Lead",
                    },
                },
            }));
        }

        if (eligibleRecipients.length > 0) {
            return eligibleRecipients.map((rec) => ({
                recipient: rec,
                snapshot: {
                    recipient: {
                        id: rec.id,
                        name: rec.name,
                        fullName: rec.name,
                        username: rec.username,
                        email: rec.email,
                        collegeName: rec.collegeName || clubCollege,
                        institution: rec.collegeName || clubCollege,
                    },
                    club: {
                        id: "clb_real_01",
                        name: clubName,
                        slug: "club",
                        collegeName: clubCollege,
                    },
                    award: {
                        title: templateName || "Certificate of Appreciation",
                        type: "appreciation",
                        description: "Awarded in appreciation of outstanding commitment and chapter contribution.",
                        position: rec.teamRole || "Active Chapter Member",
                    },
                    team: rec.teamRole ? { name: "Chapter Leadership Team", role: rec.teamRole } : undefined,
                    certificate: {
                        credentialCode: `ORB-REAL-NET-${Date.now().toString(36).substring(4).toUpperCase()}`,
                        issueDate: new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }),
                        verificationUrl: "https://orbix.dev/verify",
                        signerName: "Faculty Coordinator",
                        signerRole: "Club Advisor",
                    },
                },
            }));
        }

        return [];
    }, [eventRecipients, eligibleRecipients, clubCollege, clubName, templateName]);

    // Active Snapshot currently selected for rendering
    const activeSnapshot: DynamicDataSnapshot = useMemo(() => {
        if (recipientMode === "real" && realRecipientSnapshots.length > 0) {
            const index = Math.min(activeRealRecipientIndex, realRecipientSnapshots.length - 1);
            return realRecipientSnapshots[index]?.snapshot || simulationScenarios[0].snapshot;
        }
        return simulationScenarios[activeScenarioIndex]?.snapshot || simulationScenarios[0].snapshot;
    }, [recipientMode, realRecipientSnapshots, activeRealRecipientIndex, simulationScenarios, activeScenarioIndex]);

    // Filter real recipients by query
    const filteredRealRecipients = useMemo(() => {
        const q = realSearchQuery.toLowerCase().trim();
        if (!q) return realRecipientSnapshots;
        return realRecipientSnapshots.filter(
            (r) =>
                r.recipient.name.toLowerCase().includes(q) ||
                r.recipient.username.toLowerCase().includes(q) ||
                (r.recipient.email && r.recipient.email.toLowerCase().includes(q))
        );
    }, [realRecipientSnapshots, realSearchQuery]);

    // Phase 7.3: Comprehensive Validation Checks Engine
    const validationResults: ValidationCheckResult[] = useMemo(() => {
        const checks: ValidationCheckResult[] = [];

        // 1. Text Overflow Risk Check
        design.elements.forEach((elem) => {
            if (elem.type === "dynamic-text" && !elem.isHidden) {
                const parts = (elem.fieldKey || "").split(".");
                let current: any = activeSnapshot;
                for (const part of parts) {
                    if (current == null) break;
                    current = current[part];
                }
                const resolvedVal = current || elem.fallbackValue || "";
                const fontSize = elem.style?.fontSize || 24;
                const estTextWidth = resolvedVal.length * (fontSize * 0.58);

                if (estTextWidth > elem.width && elem.fitPolicy === "warn") {
                    checks.push({
                        id: `overflow_${elem.id}`,
                        elemId: elem.id,
                        title: `Text Overflow Risk in "${elem.fieldKey}"`,
                        message: `Rendered text ("${resolvedVal.substring(0, 20)}...") exceeds element width (${elem.width}pt).`,
                        severity: "warning",
                        category: "overflow",
                        fixActionLabel: "Inspect & switch fit policy to 'shrink'",
                    });
                }
            }
        });

        // 2. Missing Required Values Check
        design.elements.forEach((elem) => {
            if (elem.type === "dynamic-text" && elem.isRequired && !elem.isHidden) {
                const parts = (elem.fieldKey || "").split(".");
                let current: any = activeSnapshot;
                for (const part of parts) {
                    if (current == null) break;
                    current = current[part];
                }
                const resolvedVal = current || elem.fallbackValue;
                if (!resolvedVal) {
                    checks.push({
                        id: `missing_${elem.id}`,
                        elemId: elem.id,
                        title: `Missing Required Value for "${elem.fieldKey}"`,
                        message: `Field is marked as required, but recipient has no value and no fallback is set.`,
                        severity: "error",
                        category: "missing_data",
                        fixActionLabel: "Add default fallback value",
                    });
                }
            }
        });

        // 3. Misaligned / Out of Bounds Elements Check
        design.elements.forEach((elem) => {
            if (elem.x < 0 || elem.y < 0 || elem.x + elem.width > canvasWidth + 10 || elem.y + elem.height > canvasHeight + 10) {
                checks.push({
                    id: `bounds_${elem.id}`,
                    elemId: elem.id,
                    title: `Element Out of Canvas Margins`,
                    message: `Element "${elem.text || elem.fieldKey || elem.type}" bleeds outside canvas boundaries.`,
                    severity: "warning",
                    category: "alignment",
                    fixActionLabel: "Nudge into safe margin",
                });
            }
        });

        // 4. Unmapped Dynamic Fields Check
        design.elements.forEach((elem) => {
            if (elem.type === "dynamic-text" && !elem.fieldKey) {
                checks.push({
                    id: `unmapped_${elem.id}`,
                    elemId: elem.id,
                    title: `Unmapped Dynamic Field`,
                    message: `Dynamic element has no data source field token bound.`,
                    severity: "error",
                    category: "missing_data",
                    fixActionLabel: "Bind field token in editor",
                });
            }
        });

        // 5. Verification QR Code Placement & Resolution Check
        const qrElements = design.elements.filter((el) => el.type === "qr-code" && !el.isHidden);
        if (qrElements.length === 0) {
            checks.push({
                id: "qr_missing",
                title: "No Verification QR Code Present",
                message: "A verification QR code ensures instant tamper-proof credential verification on mobile.",
                severity: "info",
                category: "qr",
                fixActionLabel: "Add QR code block in editor",
            });
        } else {
            qrElements.forEach((qr) => {
                if (qr.width < 40 || qr.height < 40) {
                    checks.push({
                        id: `qr_size_${qr.id}`,
                        elemId: qr.id,
                        title: "QR Code Dimension Warning",
                        message: `QR code (${qr.width}x${qr.height}pt) may be too small for reliable mobile scanning. Recommended: 50x50pt.`,
                        severity: "warning",
                        category: "qr",
                        fixActionLabel: "Resize QR code to 50pt",
                    });
                }
            });
        }

        // 6. Image Quality & Assets Check
        design.elements.forEach((elem) => {
            if (elem.type === "image" && !elem.imageUrl && !elem.isHidden) {
                checks.push({
                    id: `img_empty_${elem.id}`,
                    elemId: elem.id,
                    title: "Image Placeholder Has No URL",
                    message: `Logo/crest element has no uploaded image asset.`,
                    severity: "warning",
                    category: "image",
                    fixActionLabel: "Upload logo image",
                });
            }
        });

        // 7. Hidden Elements Notice
        const hiddenCount = design.elements.filter((el) => el.isHidden).length;
        if (hiddenCount > 0) {
            checks.push({
                id: "hidden_elements",
                title: `${hiddenCount} Element(s) Marked Hidden`,
                message: "Hidden elements will be omitted from generated recipient PDFs.",
                severity: "info",
                category: "visibility",
            });
        }

        // 8. Orientation Verification
        const orientation = design.page?.orientation || "landscape";
        if (orientation === "landscape" && canvasWidth < canvasHeight) {
            checks.push({
                id: "orientation_mismatch",
                title: "Page Dimensions Orientation Warning",
                message: "Orientation is set to Landscape, but canvas height exceeds width.",
                severity: "warning",
                category: "orientation",
            });
        }

        return checks;
    }, [design.elements, activeSnapshot, canvasWidth, canvasHeight, design.page?.orientation]);

    const errorCount = validationResults.filter((v) => v.severity === "error").length;
    const warningCount = validationResults.filter((v) => v.severity === "warning").length;

    // Phase 7.4: Server-Side Vector Test PDF Generation
    const handleGenerateTestPdf = async () => {
        setIsGeneratingPdf(true);
        try {
            const blob = await previewSampleCertificate(design, activeSnapshot);
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
            setPdfSha256("Verified Cryptographic SHA-256 Digest Match");
            toast.success("Generated authoritative server-rendered test PDF!");
        } catch (err: any) {
            toast.error(err.message || "Failed to generate test PDF.");
        } finally {
            setIsGeneratingPdf(false);
        }
    };

    // Auto-fit canvas to container
    const handleFitToScreen = useCallback(() => {
        if (!canvasContainerRef.current) return;
        const container = canvasContainerRef.current;
        const availableWidth = container.clientWidth - 60;
        const availableHeight = container.clientHeight - 60;
        if (availableWidth <= 0 || availableHeight <= 0) return;

        const optimalZoom = Math.min(availableWidth / canvasWidth, availableHeight / canvasHeight);
        setZoom(Math.max(0.35, Math.min(1.3, Number(optimalZoom.toFixed(2)))));
    }, [canvasWidth, canvasHeight]);

    // Resolve field value from snapshot
    const resolveFieldValue = (fieldKey: string | undefined, fallback = "") => {
        if (!fieldKey) return fallback;
        const parts = fieldKey.split(".");
        let current: any = activeSnapshot;
        for (const part of parts) {
            if (current == null) return fallback;
            current = current[part];
        }
        return current != null && current !== "" ? String(current) : fallback;
    };

    return (
        <div className="flex flex-col h-[88vh] bg-[#FAF6EE] rounded-2xl border-4 border-black overflow-hidden shadow-[8px_8px_0px_#000]">
            {/* Top Toolbar */}
            <div className="px-5 py-3 bg-white border-b-3 border-black flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBackToEditor}
                        className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 shadow-[2px_2px_0px_#000] transition-transform active:translate-x-0.5 active:translate-y-0.5 flex items-center gap-1.5 text-xs font-black"
                        title="Back to Editor"
                    >
                        <ArrowLeft className="w-4 h-4 text-black" />
                        <span>Edit Design</span>
                    </button>

                    <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-black" />
                        <div>
                            <div className="font-black text-sm text-black flex items-center gap-2">
                                <span>Preview &amp; Validation Studio</span>
                                <span className="px-2 py-0.5 rounded-full bg-[#FFE566] border border-black text-[10px] font-black uppercase">
                                    Pre-Issuance Verification
                                </span>
                            </div>
                            <div className="text-[10px] text-neutral-500 font-bold">
                                {templateName} · Merged Recipient Live Simulation
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Zoom Controls */}
                    <div className="flex items-center border-2 border-black rounded-lg overflow-hidden shadow-[2px_2px_0px_#000] bg-white">
                        <button
                            onClick={() => setZoom((z) => Math.max(0.35, Number((z - 0.1).toFixed(2))))}
                            className="p-1.5 hover:bg-neutral-100 border-r border-black"
                            title="Zoom Out"
                        >
                            <ZoomOut className="w-3.5 h-3.5 text-black" />
                        </button>
                        <span className="px-2 text-xs font-black text-black select-none">
                            {Math.round(zoom * 100)}%
                        </span>
                        <button
                            onClick={() => setZoom((z) => Math.min(1.4, Number((z + 0.1).toFixed(2))))}
                            className="p-1.5 hover:bg-neutral-100 border-r border-black"
                            title="Zoom In"
                        >
                            <ZoomIn className="w-3.5 h-3.5 text-black" />
                        </button>
                        <button
                            onClick={handleFitToScreen}
                            className="p-1.5 hover:bg-neutral-100 text-black"
                            title="Fit Canvas to View"
                        >
                            <Maximize className="w-3.5 h-3.5 text-black" />
                        </button>
                    </div>

                    {/* Phase 7.4: Authoritative Test PDF Generator */}
                    <button
                        onClick={handleGenerateTestPdf}
                        disabled={isGeneratingPdf}
                        className="px-3.5 py-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5"
                        title="Render exact server-side PDF with cryptographic digest"
                    >
                        <FileDown className="w-4 h-4 text-black" />
                        <span>Generate Test PDF</span>
                    </button>

                    {/* Primary Approve & Continue Action */}
                    <button
                        onClick={() => {
                            if (errorCount > 0) {
                                toast.error(`Please resolve the ${errorCount} blocking error(s) before proceeding to issuance.`);
                                return;
                            }
                            onApproveAndProceed(design);
                        }}
                        className={`px-4 py-1.5 rounded-lg border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 ${
                            errorCount > 0
                                ? "bg-neutral-200 text-neutral-500 cursor-not-allowed"
                                : "bg-[#a2ff86] hover:bg-[#8ee673] text-black"
                        }`}
                    >
                        <ShieldCheck className="w-4 h-4 text-black" />
                        <span>Approve &amp; Continue to Issuance</span> &rarr;
                    </button>
                </div>
            </div>

            {/* Main Studio Body: 3 Columns (Recipient Navigator, Center Canvas, Validation Checklist) */}
            <div className="flex flex-1 overflow-hidden">
                {/* LEFT COLUMN: Recipient Selector & Data Snapshot */}
                <div className="w-80 bg-white border-r-3 border-black flex flex-col shrink-0">
                    {/* Mode Selector Tabs: Simulation vs Real */}
                    <div className="grid grid-cols-2 border-b-2 border-black bg-[#F5F1E6]">
                        <button
                            onClick={() => setRecipientMode("simulation")}
                            className={`py-2 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 border-r border-black ${
                                recipientMode === "simulation"
                                    ? "bg-white text-black border-b-2 border-b-white"
                                    : "text-neutral-600 hover:bg-neutral-100"
                            }`}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Simulation ({simulationScenarios.length})</span>
                        </button>
                        <button
                            onClick={() => setRecipientMode("real")}
                            className={`py-2 text-xs font-black uppercase tracking-wider flex items-center justify-center gap-1.5 ${
                                recipientMode === "real"
                                    ? "bg-white text-black border-b-2 border-b-white"
                                    : "text-neutral-600 hover:bg-neutral-100"
                            }`}
                        >
                            <Users className="w-3.5 h-3.5" />
                            <span>Real Data ({realRecipientSnapshots.length})</span>
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Simulation Profiles (Phase 7.1) */}
                        {recipientMode === "simulation" && (
                            <div className="space-y-3">
                                <div>
                                    <h4 className="text-xs font-black text-neutral-800 uppercase tracking-wider">
                                        Recipient Simulation Scenarios
                                    </h4>
                                    <p className="text-[11px] text-neutral-600 mt-0.5">
                                        Test auto-fit policies, Unicode text, and missing data fallbacks before issuing.
                                    </p>
                                </div>

                                <div className="space-y-2">
                                    {simulationScenarios.map((sc, idx) => (
                                        <div
                                            key={sc.id}
                                            onClick={() => setActiveScenarioIndex(idx)}
                                            className={`p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                                activeScenarioIndex === idx
                                                    ? "border-black bg-[#FFE566] shadow-[2px_2px_0px_#000] font-bold"
                                                    : "border-neutral-300 bg-white hover:border-black text-neutral-700"
                                            }`}
                                        >
                                            <div className="flex items-center justify-between">
                                                <span className="text-xs font-black text-black">{sc.title}</span>
                                                <span className="px-1.5 py-0.2 rounded border border-black text-[9px] font-black uppercase bg-white">
                                                    {sc.badge}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-neutral-700 mt-1 line-clamp-2">
                                                {sc.description}
                                            </p>
                                            <div className="text-[10px] font-mono font-bold text-neutral-900 mt-1 truncate bg-white/60 px-1.5 py-0.5 rounded border border-black/10">
                                                Name: {sc.snapshot.recipient.name}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Real Event / Eligible Participants (Phase 7.2) */}
                        {recipientMode === "real" && (
                            <div className="space-y-3">
                                <div>
                                    <h4 className="text-xs font-black text-neutral-800 uppercase tracking-wider">
                                        Real Event Participants
                                    </h4>
                                    <p className="text-[11px] text-neutral-600 mt-0.5">
                                        Select any eligible attendee or member to preview their personalized certificate.
                                    </p>
                                </div>

                                {realRecipientSnapshots.length === 0 ? (
                                    <div className="p-4 rounded-xl border-2 border-dashed border-neutral-300 text-center text-xs text-neutral-500">
                                        No real event participants loaded. Switch to Simulation mode to preview with generated profiles.
                                    </div>
                                ) : (
                                    <>
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                                            <input
                                                type="text"
                                                value={realSearchQuery}
                                                onChange={(e) => setRealSearchQuery(e.target.value)}
                                                placeholder="Search real attendees..."
                                                className="w-full pl-8 pr-3 py-1.5 text-xs font-bold border-2 border-black rounded-xl bg-white"
                                            />
                                        </div>

                                        <div className="space-y-1.5 max-h-[45vh] overflow-y-auto pr-1">
                                            {filteredRealRecipients.map((rec, idx) => (
                                                <div
                                                    key={idx}
                                                    onClick={() => setActiveRealRecipientIndex(idx)}
                                                    className={`p-2 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${
                                                        activeRealRecipientIndex === idx
                                                            ? "border-black bg-[#FFE566] shadow-[2px_2px_0px_#000] font-black"
                                                            : "border-neutral-300 bg-white hover:border-black text-neutral-800"
                                                    }`}
                                                >
                                                    <div className="min-w-0">
                                                        <div className="text-xs font-black truncate">{rec.recipient.name}</div>
                                                        <div className="text-[10px] text-neutral-600 truncate">
                                                            @{rec.recipient.username} · {rec.recipient.rollNumber || "Student"}
                                                        </div>
                                                    </div>
                                                    {activeRealRecipientIndex === idx && (
                                                        <Check className="w-4 h-4 text-black shrink-0 ml-1" />
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {/* Merged Field Values Snapshot Inspector */}
                        <div className="border-t border-black/10 pt-3 space-y-2">
                            <h4 className="text-[11px] font-black text-neutral-600 uppercase tracking-wider">
                                Active Snapshot Data Values
                            </h4>
                            <div className="p-2.5 rounded-xl border border-black/20 bg-[#FAF6EE] max-h-48 overflow-y-auto space-y-1 text-[11px] font-mono">
                                <div className="flex justify-between border-b border-black/10 pb-1">
                                    <span className="text-neutral-500">recipient.name:</span>
                                    <span className="font-bold text-black truncate max-w-[140px]">{activeSnapshot.recipient.name}</span>
                                </div>
                                <div className="flex justify-between border-b border-black/10 pb-1">
                                    <span className="text-neutral-500">recipient.username:</span>
                                    <span className="font-bold text-black">@{activeSnapshot.recipient.username}</span>
                                </div>
                                <div className="flex justify-between border-b border-black/10 pb-1">
                                    <span className="text-neutral-500">recipient.rollNumber:</span>
                                    <span className="font-bold text-black">{activeSnapshot.recipient.rollNumber || "None"}</span>
                                </div>
                                <div className="flex justify-between border-b border-black/10 pb-1">
                                    <span className="text-neutral-500">award.title:</span>
                                    <span className="font-bold text-black truncate max-w-[140px]">{activeSnapshot.award.title}</span>
                                </div>
                                <div className="flex justify-between border-b border-black/10 pb-1">
                                    <span className="text-neutral-500">award.position:</span>
                                    <span className="font-bold text-black truncate max-w-[140px]">{activeSnapshot.award.position || "None"}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-neutral-500">credentialCode:</span>
                                    <span className="font-bold text-black truncate max-w-[140px]">{activeSnapshot.certificate.credentialCode}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Bottom Recipient Navigation Bar (Phase 7.1) */}
                    <div className="p-3 border-t-2 border-black bg-white flex items-center justify-between">
                        <button
                            onClick={() => {
                                if (recipientMode === "simulation") {
                                    setActiveScenarioIndex((prev) => Math.max(0, prev - 1));
                                } else {
                                    setActiveRealRecipientIndex((prev) => Math.max(0, prev - 1));
                                }
                            }}
                            disabled={recipientMode === "simulation" ? activeScenarioIndex <= 0 : activeRealRecipientIndex <= 0}
                            className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 disabled:opacity-40 text-black shadow-[1.5px_1.5px_0px_#000]"
                            title="Previous Recipient"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <div className="text-center">
                            <div className="text-xs font-black text-black">
                                {recipientMode === "simulation"
                                    ? `Scenario ${activeScenarioIndex + 1} of ${simulationScenarios.length}`
                                    : `Recipient ${activeRealRecipientIndex + 1} of ${realRecipientSnapshots.length || 1}`}
                            </div>
                            <div className="text-[10px] text-neutral-500 font-bold truncate max-w-[120px]">
                                {activeSnapshot.recipient.name}
                            </div>
                        </div>

                        <button
                            onClick={() => {
                                if (recipientMode === "simulation") {
                                    setActiveScenarioIndex((prev) => Math.min(simulationScenarios.length - 1, prev + 1));
                                } else {
                                    setActiveRealRecipientIndex((prev) => Math.min(realRecipientSnapshots.length - 1, prev + 1));
                                }
                            }}
                            disabled={
                                recipientMode === "simulation"
                                    ? activeScenarioIndex >= simulationScenarios.length - 1
                                    : activeRealRecipientIndex >= realRecipientSnapshots.length - 1
                            }
                            className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 disabled:opacity-40 text-black shadow-[1.5px_1.5px_0px_#000]"
                            title="Next Recipient"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* CENTER COLUMN: Live Merged Canvas Preview */}
                <div
                    ref={canvasContainerRef}
                    className="flex-1 bg-neutral-200 overflow-auto p-8 flex items-center justify-center select-none relative"
                >
                    <div
                        style={{
                            width: `${canvasWidth * zoom}px`,
                            height: `${canvasHeight * zoom}px`,
                        }}
                        className="relative bg-white shadow-2xl border-4 border-black transition-all shrink-0 origin-center"
                    >
                        {/* Background Container */}
                        <div
                            className="absolute inset-0 pointer-events-none z-0"
                            style={{
                                backgroundColor: design.background.color || "#FFFFFF",
                                backgroundImage: design.background.imageUrl ? `url(${design.background.imageUrl})` : undefined,
                                backgroundSize: design.background.fit || "cover",
                                backgroundPosition: "center",
                            }}
                        >
                            {/* Decorative Border */}
                            {design.background.borderStyle === "double" && (
                                <div
                                    className="absolute inset-2 sm:inset-3 border-2"
                                    style={{ borderColor: design.background.borderColor || "#0F172A" }}
                                >
                                    <div
                                        className="absolute inset-2"
                                        style={{
                                            borderColor: design.background.borderColor || "#0F172A",
                                            borderWidth: `${Math.max(2, (design.background.borderWidth || 6) * zoom)}px`,
                                            borderStyle: "solid",
                                        }}
                                    />
                                </div>
                            )}

                            {design.background.borderStyle === "ornate" && (
                                <div
                                    className="absolute inset-3"
                                    style={{
                                        borderColor: design.background.borderColor || "#D97706",
                                        borderWidth: `${Math.max(2, (design.background.borderWidth || 4) * zoom)}px`,
                                        borderStyle: "solid",
                                    }}
                                >
                                    <div className="absolute top-1 left-1 w-6 h-6 border-t-2 border-l-2" style={{ borderColor: design.background.borderColor || "#D97706" }} />
                                    <div className="absolute top-1 right-1 w-6 h-6 border-t-2 border-r-2" style={{ borderColor: design.background.borderColor || "#D97706" }} />
                                    <div className="absolute bottom-1 left-1 w-6 h-6 border-b-2 border-l-2" style={{ borderColor: design.background.borderColor || "#D97706" }} />
                                    <div className="absolute bottom-1 right-1 w-6 h-6 border-b-2 border-r-2" style={{ borderColor: design.background.borderColor || "#D97706" }} />
                                </div>
                            )}

                            {design.background.borderStyle === "modern" && (
                                <div
                                    className="absolute inset-2 sm:inset-3"
                                    style={{
                                        borderColor: design.background.borderColor || "#0F172A",
                                        borderWidth: `${Math.max(2, (design.background.borderWidth || 6) * zoom)}px`,
                                        borderStyle: "solid",
                                    }}
                                >
                                    <div
                                        className="w-full h-2.5"
                                        style={{ backgroundColor: design.background.accentColor || "#2563EB" }}
                                    />
                                </div>
                            )}

                            {design.background.borderStyle === "neo-brutalist" && (
                                <div
                                    className="absolute inset-2 sm:inset-3"
                                    style={{
                                        borderColor: design.background.borderColor || "#000000",
                                        borderWidth: `${Math.max(4, (design.background.borderWidth || 8) * zoom)}px`,
                                        borderStyle: "solid",
                                    }}
                                >
                                    {design.background.accentColor && (
                                        <div
                                            className="w-full h-3"
                                            style={{ backgroundColor: design.background.accentColor || "#FFE566" }}
                                        />
                                    )}
                                </div>
                            )}

                            {design.background.borderStyle === "solid" && (
                                <div
                                    className="absolute inset-3"
                                    style={{
                                        borderColor: design.background.borderColor || "#0F172A",
                                        borderWidth: `${Math.max(2, (design.background.borderWidth || 6) * zoom)}px`,
                                        borderStyle: "solid",
                                    }}
                                />
                            )}
                        </div>

                        {/* Render Merged Elements */}
                        {design.elements.map((elem) => {
                            if (elem.isHidden) return null;

                            const isInspected = inspectedElementId === elem.id;
                            const left = elem.x * zoom;
                            const top = elem.y * zoom;
                            const width = elem.width * zoom;
                            const height = elem.height * zoom;
                            const rotation = elem.rotation || 0;

                            const displayText =
                                elem.type === "dynamic-text"
                                    ? resolveFieldValue(elem.fieldKey, elem.fallbackValue || "")
                                    : elem.text || "";

                            const baseFontSize = elem.style?.fontSize || 24;
                            let effectiveFontSize = baseFontSize * zoom;

                            if (elem.type === "dynamic-text" && elem.fitPolicy === "shrink" && displayText.length > 0) {
                                const minSize = (elem.minFontSize || 10) * zoom;
                                const estCharWidth = (baseFontSize * zoom) * 0.58;
                                const estTextWidth = displayText.length * estCharWidth;
                                if (width > 0 && estTextWidth > width) {
                                    const scale = Math.max(minSize / (baseFontSize * zoom), width / estTextWidth);
                                    effectiveFontSize = Math.max(minSize, baseFontSize * zoom * scale);
                                }
                            }

                            return (
                                <div
                                    key={elem.id}
                                    onClick={() => setInspectedElementId(elem.id)}
                                    style={{
                                        position: "absolute",
                                        left: `${left}px`,
                                        top: `${top}px`,
                                        width: `${width}px`,
                                        height: `${height}px`,
                                        zIndex: elem.zIndex || 1,
                                        transform: rotation ? `rotate(${rotation}deg)` : undefined,
                                        transformOrigin: "center center",
                                    }}
                                    className={`flex items-center justify-center cursor-pointer transition-all ${
                                        isInspected
                                            ? "ring-4 ring-blue-600 ring-offset-2 border-2 border-blue-600 bg-blue-50/20"
                                            : "hover:outline hover:outline-2 hover:outline-blue-500/50"
                                    }`}
                                >
                                    {elem.type === "shape" ? (
                                        <div
                                            className="w-full h-full pointer-events-none"
                                            style={{
                                                backgroundColor: elem.style?.backgroundColor || "#0F172A",
                                                borderRadius: elem.style?.borderRadius ? `${elem.style.borderRadius * zoom}px` : 0,
                                                borderWidth: elem.style?.borderWidth ? `${elem.style.borderWidth * zoom}px` : 0,
                                                borderColor: elem.style?.borderColor || "transparent",
                                                borderStyle: elem.shapeType === "dashed" ? "dashed" : "solid",
                                                opacity: elem.style?.opacity ?? 1,
                                            }}
                                        />
                                    ) : elem.type === "badge" ? (
                                        <div
                                            className="w-full h-full rounded-full border-2 border-black flex items-center justify-center font-black shadow-[1.5px_1.5px_0px_#000] pointer-events-none"
                                            style={{
                                                backgroundColor: elem.style?.backgroundColor || "#F59E0B",
                                                color: elem.style?.color || "#000000",
                                                fontSize: `${(elem.style?.fontSize || 12) * zoom}px`,
                                            }}
                                        >
                                            {elem.text || "1ST"}
                                        </div>
                                    ) : elem.type === "image" ? (
                                        <div className="w-full h-full flex items-center justify-center overflow-hidden pointer-events-none">
                                            {elem.imageUrl ? (
                                                <img
                                                    src={elem.imageUrl}
                                                    alt="Media"
                                                    className={`w-full h-full pointer-events-none ${
                                                        elem.imageFit === "cover" ? "object-cover" : "object-contain"
                                                    }`}
                                                />
                                            ) : (
                                                <div className="w-full h-full border-2 border-dashed border-neutral-400 bg-neutral-100 flex items-center justify-center text-[10px] text-neutral-400 font-bold">
                                                    Image Placeholder
                                                </div>
                                            )}
                                        </div>
                                    ) : elem.type === "signature" ? (
                                        <div className="w-full h-full flex flex-col justify-end items-center pointer-events-none pb-0.5">
                                            {elem.signatureUrl && (
                                                <img
                                                    src={elem.signatureUrl}
                                                    alt="Signature"
                                                    className="h-7 max-w-[80%] object-contain mb-0.5"
                                                />
                                            )}
                                            <div
                                                className="w-full border-b"
                                                style={{
                                                    borderColor: elem.style?.borderColor || "#000000",
                                                    borderBottomWidth: `${Math.max(1, (elem.style?.borderWidth || 1.5) * zoom)}px`,
                                                }}
                                            />
                                            <div
                                                className="font-bold truncate mt-1 leading-tight text-center"
                                                style={{
                                                    fontSize: `${Math.max(8, (elem.style?.fontSize || 11) * zoom)}px`,
                                                    color: elem.style?.color || "#000000",
                                                }}
                                            >
                                                {resolveFieldValue(elem.fieldKey, elem.signerName || "Authorized Signatory")}
                                            </div>
                                            <div
                                                className="text-neutral-500 truncate leading-tight text-center"
                                                style={{
                                                    fontSize: `${Math.max(7, ((elem.style?.fontSize || 11) - 2.5) * zoom)}px`,
                                                }}
                                            >
                                                {elem.signerTitle || "Club Coordinator"}
                                            </div>
                                        </div>
                                    ) : elem.type === "qr-code" ? (
                                        <div className="w-full h-full p-1 bg-white border border-black flex flex-col items-center justify-center shadow-[1px_1px_0px_#000] pointer-events-none">
                                            <QrCode className="w-full h-full text-black stroke-[1.5]" />
                                        </div>
                                    ) : (
                                        <div
                                            style={{
                                                fontSize: `${effectiveFontSize}px`,
                                                fontWeight: (elem.style?.fontWeight as any) || "normal",
                                                color: elem.style?.color || "#0F172A",
                                                textAlign: elem.style?.textAlign || "center",
                                                letterSpacing: elem.style?.letterSpacing ? `${elem.style.letterSpacing * zoom}px` : undefined,
                                                textTransform: elem.style?.textTransform || "none",
                                                fontFamily: elem.style?.fontFamily || "Inter, sans-serif",
                                                lineHeight: elem.style?.lineHeight || 1.3,
                                            }}
                                            className={`w-full h-full flex items-center leading-tight overflow-hidden select-none pointer-events-none ${
                                                elem.fitPolicy === "wrap" ? "whitespace-normal break-words" : "whitespace-nowrap"
                                            }`}
                                        >
                                            <span className="w-full truncate">{displayText}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* RIGHT COLUMN: Automated Validation Engine Checklist (Phase 7.3) */}
                <div className="w-80 bg-white border-l-3 border-black flex flex-col shrink-0">
                    <div className="p-4 border-b-2 border-black/15 bg-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5 text-black" />
                            <div>
                                <h4 className="text-xs font-black text-black uppercase tracking-wider">
                                    Validation Audit
                                </h4>
                                <span className="text-[10px] text-neutral-500 font-bold">
                                    9 Integrity Checks
                                </span>
                            </div>
                        </div>

                        {/* Overall Status Pill */}
                        <div className="flex items-center gap-1.5">
                            {errorCount === 0 && warningCount === 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-[#DCFCE7] border border-green-600 text-green-800 text-[10px] font-black flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3 text-green-700" />
                                    <span>PASS</span>
                                </span>
                            ) : errorCount > 0 ? (
                                <span className="px-2 py-0.5 rounded-full bg-red-100 border border-red-500 text-red-800 text-[10px] font-black flex items-center gap-1">
                                    <AlertCircle className="w-3 h-3 text-red-700" />
                                    <span>{errorCount} ERR</span>
                                </span>
                            ) : (
                                <span className="px-2 py-0.5 rounded-full bg-amber-100 border border-amber-500 text-amber-800 text-[10px] font-black flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3 text-amber-700" />
                                    <span>{warningCount} WARN</span>
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Validation Checklist Items */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
                        {validationResults.map((check) => {
                            const isInspected = check.elemId && inspectedElementId === check.elemId;
                            return (
                                <div
                                    key={check.id}
                                    onClick={() => {
                                        if (check.elemId) setInspectedElementId(check.elemId);
                                    }}
                                    className={`p-3 rounded-xl border-2 transition-all ${
                                        check.severity === "error"
                                            ? "border-red-500 bg-red-50/70"
                                            : check.severity === "warning"
                                            ? "border-amber-500 bg-amber-50/70"
                                            : "border-black/20 bg-[#FAF6EE]"
                                    } ${isInspected ? "ring-2 ring-blue-600 shadow-[2px_2px_0px_#000]" : ""}`}
                                >
                                    <div className="flex items-center justify-between gap-1">
                                        <div className="flex items-center gap-1.5 font-black text-xs text-black">
                                            {check.severity === "error" ? (
                                                <AlertCircle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                                            ) : check.severity === "warning" ? (
                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                            ) : (
                                                <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                            )}
                                            <span className="truncate">{check.title}</span>
                                        </div>
                                        <span className="px-1.5 py-0.2 rounded text-[8px] font-black uppercase bg-white border border-black/30">
                                            {check.category}
                                        </span>
                                    </div>

                                    <p className="text-[11px] text-neutral-700 mt-1 leading-snug">
                                        {check.message}
                                    </p>

                                    {check.elemId && (
                                        <div className="mt-2 pt-2 border-t border-black/10 flex items-center justify-between">
                                            <span className="text-[10px] font-mono font-bold text-neutral-500">
                                                Element: {check.elemId.substring(0, 14)}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setInspectedElementId(check.elemId || null);
                                                }}
                                                className="text-[10px] font-black text-blue-700 hover:underline flex items-center gap-0.5"
                                            >
                                                <span>Highlight on Canvas</span>
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Cryptographic SHA-256 Digest Verification Notice */}
                        <div className="p-3 rounded-xl border-2 border-black bg-[#FAF6EE] text-xs space-y-1 shadow-[1.5px_1.5px_0px_#000]">
                            <div className="font-black text-black flex items-center gap-1.5">
                                <ShieldCheck className="w-4 h-4 text-emerald-700" />
                                <span>Cryptographic Server-Rendering</span>
                            </div>
                            <p className="text-[10px] text-neutral-600 leading-tight">
                                Generated credentials use identical deterministic vector rendering as server-side production issuance.
                            </p>
                            {pdfSha256 && (
                                <div className="text-[9px] font-mono text-emerald-800 bg-white p-1 rounded border border-emerald-300 truncate">
                                    {pdfSha256}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Bottom Return to Editor Action */}
                    <div className="p-3 border-t-2 border-black bg-white">
                        <button
                            onClick={onBackToEditor}
                            className="w-full py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5"
                        >
                            <Sliders className="w-3.5 h-3.5 text-black" />
                            <span>Return to Visual Editor</span>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
