import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";
import {
    Type,
    Layers,
    Sparkles,
    Sliders,
    Save,
    RotateCcw,
    RotateCw,
    Trash2,
    Copy,
    Move,
    ZoomIn,
    ZoomOut,
    QrCode,
    Award,
    Square,
    Palette,
    ArrowLeft,
    FileDown,
    Image as ImageIcon,
    PenTool,
    Minus,
    ArrowUp,
    ArrowDown,
    Upload,
    Lock,
    Unlock,
    Eye,
    EyeOff,
    Grid,
    Maximize,
    HelpCircle,
    AlignLeft,
    AlignCenter,
    AlignRight,
    AlignJustify,
    X,
    Search,
    Plus,
    AlertTriangle,
    CheckCircle2,
    Tag,
    ShieldCheck,
} from "lucide-react";
import { useToast } from "../../../context/ToastContext";
import {
    type CertificateDesign,
    type CertificateElement,
    type CustomAttributeDefinition,
    type DynamicFieldDefinition,
    AVAILABLE_DYNAMIC_FIELDS,
} from "../../../types/certificateStudio";
import { previewSampleCertificate } from "../../../api/certificateStudioApi";

interface CertificateDesignEditorProps {
    initialDesign: CertificateDesign;
    templateName: string;
    onSave: (design: CertificateDesign, name: string) => Promise<void>;
    onProceedToIssuance: (design: CertificateDesign) => void;
    onBack: () => void;
}

type ResizeHandleType = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

export const CertificateDesignEditor: React.FC<CertificateDesignEditorProps> = ({
    initialDesign,
    templateName: initialName,
    onSave,
    onProceedToIssuance,
    onBack,
}) => {
    const toast = useToast();

    const [templateName, setTemplateName] = useState(initialName || "Untitled Certificate");
    const [design, setDesign] = useState<CertificateDesign>(initialDesign);

    // Multi-element selection support (Phase 5.2)
    const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
    const selectedElementId = selectedElementIds[0] || null;

    // Undo / Redo history
    const [history, setHistory] = useState<CertificateDesign[]>([initialDesign]);
    const [historyIndex, setHistoryIndex] = useState(0);

    // UI state
    const [activeLeftTab, setActiveLeftTab] = useState<"elements" | "fields" | "layers" | "background">("elements");
    const [zoom, setZoom] = useState<number>(0.85);
    const [isSaving, setIsSaving] = useState(false);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);

    // Phase 6.2: Canvas Token Display Mode
    const [tokenDisplayMode, setTokenDisplayMode] = useState<"sample" | "friendly" | "raw">("sample");

    // Phase 6.1 & 6.5: Dynamic Fields Library Search & Filter State
    const [fieldsSearch, setFieldsSearch] = useState<string>("");
    const [fieldsCategoryFilter, setFieldsCategoryFilter] = useState<string>("all");

    // Phase 6.5: Custom Attribute Creator Modal State
    const [showCustomAttrModal, setShowCustomAttrModal] = useState<boolean>(false);
    const [customLabel, setCustomLabel] = useState<string>("");
    const [customKey, setCustomKey] = useState<string>("");
    const [customDataType, setCustomDataType] = useState<"text" | "number" | "date" | "url">("text");
    const [customScope, setCustomScope] = useState<"all" | "individual" | "team">("all");
    const [customRequired, setCustomRequired] = useState<boolean>(false);
    const [customSampleValue, setCustomSampleValue] = useState<string>("");

    // Phase 6.4: Missing Data & Audit Diagnostics Modal State
    const [showAuditModal, setShowAuditModal] = useState<boolean>(false);

    // Canvas Snap-to-Grid & Alignment Guides
    const [snapToGrid, setSnapToGrid] = useState<boolean>(false);
    const [showGrid, setShowGrid] = useState<boolean>(false);
    const [showGuides, setShowGuides] = useState<boolean>(true);
    const [activeGuides, setActiveGuides] = useState<{ x?: number; y?: number } | null>(null);

    // Shortcuts modal
    const [showShortcutsModal, setShowShortcutsModal] = useState<boolean>(false);

    // Dragging state (supports single & multi-element drag)
    const [draggingState, setDraggingState] = useState<{
        mouseX: number;
        mouseY: number;
        initialPositions: { id: string; x: number; y: number }[];
    } | null>(null);

    // Resizing state (supports 8 handles: nw, n, ne, e, se, s, sw, w)
    const [resizingInfo, setResizingInfo] = useState<{
        elemId: string;
        handle: ResizeHandleType;
        mouseX: number;
        mouseY: number;
        elemX: number;
        elemY: number;
        w: number;
        h: number;
    } | null>(null);

    // Rotation state (Phase 5.2)
    const [rotatingInfo, setRotatingInfo] = useState<{
        elemId: string;
        centerX: number;
        centerY: number;
        currentAngle: number;
    } | null>(null);

    // Marquee / Box drag selection state
    const [marquee, setMarquee] = useState<{
        startX: number;
        startY: number;
        currentX: number;
        currentY: number;
    } | null>(null);

    const canvasRef = useRef<HTMLDivElement>(null);
    const canvasContainerRef = useRef<HTMLDivElement>(null);

    const canvasWidth = design.page?.width || 842;
    const canvasHeight = design.page?.height || 595;

    // Push new state to history
    const updateDesignWithHistory = useCallback((newDesign: CertificateDesign) => {
        setDesign(newDesign);
        setHistory((prev) => {
            const next = prev.slice(0, historyIndex + 1);
            return [...next, newDesign];
        });
        setHistoryIndex((prev) => prev + 1);
    }, [historyIndex]);

    const handleUndo = useCallback(() => {
        if (historyIndex > 0) {
            setHistoryIndex((prev) => prev - 1);
            setDesign(history[historyIndex - 1]);
        }
    }, [history, historyIndex]);

    const handleRedo = useCallback(() => {
        if (historyIndex < history.length - 1) {
            setHistoryIndex((prev) => prev + 1);
            setDesign(history[historyIndex + 1]);
        }
    }, [history, historyIndex]);

    const selectedElement = useMemo(() => {
        return design.elements.find((el) => el.id === selectedElementId) || null;
    }, [design.elements, selectedElementId]);

    const selectedElements = useMemo(() => {
        return design.elements.filter((el) => selectedElementIds.includes(el.id));
    }, [design.elements, selectedElementIds]);

    // Combined allowlisted dynamic fields + club custom attributes (Phase 6.1 & 6.5)
    const allDynamicFields = useMemo<DynamicFieldDefinition[]>(() => {
        const customFields: DynamicFieldDefinition[] = (design.customAttributes || []).map((attr) => ({
            key: attr.key,
            label: attr.label,
            category: "custom" as const,
            description: attr.description || `Custom ${attr.scope} attribute`,
            sampleValue: attr.sampleValue || "Custom Attribute Value",
            dataType: attr.dataType || "text",
            isCustom: true,
        }));
        return [...AVAILABLE_DYNAMIC_FIELDS, ...customFields];
    }, [design.customAttributes]);

    // Filtered fields based on search & category pill
    const filteredDynamicFields = useMemo(() => {
        return allDynamicFields.filter((f) => {
            const matchesCategory = fieldsCategoryFilter === "all" || f.category === fieldsCategoryFilter;
            const q = fieldsSearch.toLowerCase().trim();
            const matchesQuery =
                !q ||
                f.label.toLowerCase().includes(q) ||
                f.key.toLowerCase().includes(q) ||
                f.description.toLowerCase().includes(q) ||
                f.sampleValue.toLowerCase().includes(q);
            return matchesCategory && matchesQuery;
        });
    }, [allDynamicFields, fieldsCategoryFilter, fieldsSearch]);

    // Phase 6.4: Data Audit & Missing Data Diagnostic Report
    const auditReport = useMemo(() => {
        const dynamicElements = design.elements.filter((el) => el.type === "dynamic-text");
        const issues: {
            elemId: string;
            fieldKey: string;
            label: string;
            issueType: "missing_fallback" | "unmapped" | "overflow_risk";
            severity: "error" | "warning";
            message: string;
        }[] = [];

        dynamicElements.forEach((el) => {
            const key = el.fieldKey || "";
            const def = allDynamicFields.find((f) => f.key === key);
            if (!key) {
                issues.push({
                    elemId: el.id,
                    fieldKey: "unmapped",
                    label: "Unmapped Field",
                    issueType: "unmapped",
                    severity: "error",
                    message: "Dynamic text element has no data token mapped.",
                });
            } else if (!el.fallbackValue && el.isRequired) {
                issues.push({
                    elemId: el.id,
                    fieldKey: key,
                    label: def?.label || key,
                    issueType: "missing_fallback",
                    severity: "warning",
                    message: "Required field has no fallback value if recipient data is blank.",
                });
            }
        });

        return {
            totalDynamic: dynamicElements.length,
            hasIssues: issues.length > 0,
            hasErrors: issues.some((i) => i.severity === "error"),
            issues,
        };
    }, [design.elements, allDynamicFields]);

    // 1-Click Fix for Missing Fallbacks (Phase 6.4)
    const handleApplyDefaultFallbacks = () => {
        let count = 0;
        const next = design.elements.map((el) => {
            if (el.type !== "dynamic-text" || el.fallbackValue) return el;
            const def = allDynamicFields.find((f) => f.key === el.fieldKey);
            if (def?.sampleValue) {
                count++;
                return { ...el, fallbackValue: def.sampleValue };
            }
            return el;
        });
        updateDesignWithHistory({ ...design, elements: next });
        toast.success(`Applied default fallbacks to ${count} element(s).`);
    };

    // Phase 6.5: Custom Attribute Manager
    const handleAddCustomAttribute = () => {
        const cleanLabel = customLabel.trim();
        if (!cleanLabel) {
            toast.error("Please enter a friendly attribute label.");
            return;
        }

        let cleanKey = customKey.trim().toLowerCase();
        if (!cleanKey) {
            cleanKey = `custom.${cleanLabel.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
        }
        if (!cleanKey.startsWith("custom.")) {
            cleanKey = `custom.${cleanKey.replace(/^custom_?/, "")}`;
        }

        // Strict validation: prevent code expressions or arbitrary DB paths
        if (!/^custom\.[a-z0-9_]+$/.test(cleanKey)) {
            toast.error("Internal key must follow 'custom.variable_name' using alphanumeric characters & underscores only.");
            return;
        }

        if (allDynamicFields.some((f) => f.key === cleanKey)) {
            toast.error(`Attribute key "${cleanKey}" already exists.`);
            return;
        }

        const newAttr: CustomAttributeDefinition = {
            key: cleanKey,
            label: cleanLabel,
            dataType: customDataType,
            scope: customScope,
            isRequired: customRequired,
            sampleValue: customSampleValue.trim() || `Sample ${cleanLabel}`,
            description: `Custom ${customScope} attribute defined by club organizers`,
        };

        const nextCustom = [...(design.customAttributes || []), newAttr];
        updateDesignWithHistory({ ...design, customAttributes: nextCustom });
        setShowCustomAttrModal(false);
        setCustomLabel("");
        setCustomKey("");
        setCustomSampleValue("");
        setCustomRequired(false);
        toast.success(`Created custom attribute "${newAttr.label}" ({{${newAttr.key}}})!`);
    };

    const handleDeleteCustomAttribute = (key: string) => {
        const nextCustom = (design.customAttributes || []).filter((a) => a.key !== key);
        updateDesignWithHistory({ ...design, customAttributes: nextCustom });
        toast.info(`Deleted custom attribute {{${key}}}.`);
    };

    // Update single element property
    const updateElement = useCallback((id: string, updates: Partial<CertificateElement>) => {
        const nextElements = design.elements.map((el) => {
            if (el.id !== id) return el;
            return {
                ...el,
                ...updates,
                style: {
                    ...(el.style || {}),
                    ...(updates.style || {}),
                },
            };
        });
        updateDesignWithHistory({ ...design, elements: nextElements });
    }, [design, updateDesignWithHistory]);

    // Layer reordering
    const bringElementToFront = (id: string) => {
        const maxZ = design.elements.reduce((max, el) => Math.max(max, el.zIndex || 0), 0);
        updateElement(id, { zIndex: maxZ + 1 });
        toast.info("Brought element to front.");
    };

    const sendElementToBack = (id: string) => {
        const minZ = design.elements.reduce((min, el) => Math.min(min, el.zIndex || 0), 1);
        updateElement(id, { zIndex: Math.max(0, minZ - 1) });
        toast.info("Sent element to back.");
    };

    const moveLayerUp = (id: string) => {
        const sorted = [...design.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
        const index = sorted.findIndex((e) => e.id === id);
        if (index < sorted.length - 1) {
            const currentZ = sorted[index].zIndex || 0;
            const nextZ = sorted[index + 1].zIndex || 0;
            const targetZ = currentZ === nextZ ? currentZ + 1 : nextZ;
            updateElement(id, { zIndex: targetZ + 1 });
        }
    };

    const moveLayerDown = (id: string) => {
        const sorted = [...design.elements].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
        const index = sorted.findIndex((e) => e.id === id);
        if (index > 0) {
            const currentZ = sorted[index].zIndex || 0;
            const prevZ = sorted[index - 1].zIndex || 0;
            const targetZ = currentZ === prevZ ? Math.max(0, currentZ - 1) : prevZ;
            updateElement(id, { zIndex: Math.max(0, targetZ - 1) });
        }
    };

    // Auto-fit canvas to container
    const handleFitToScreen = useCallback(() => {
        if (!canvasContainerRef.current) return;
        const container = canvasContainerRef.current;
        const availableWidth = container.clientWidth - 80;
        const availableHeight = container.clientHeight - 80;
        if (availableWidth <= 0 || availableHeight <= 0) return;

        const scaleX = availableWidth / canvasWidth;
        const scaleY = availableHeight / canvasHeight;
        const optimalZoom = Math.min(scaleX, scaleY);
        const clampedZoom = Math.max(0.35, Math.min(1.4, Number(optimalZoom.toFixed(2))));
        setZoom(clampedZoom);
        toast.info(`Fitted canvas to view (${Math.round(clampedZoom * 100)}%)`);
    }, [canvasWidth, canvasHeight, toast]);

    // Add new element
    const addElement = (type: CertificateElement["type"], options?: Partial<CertificateElement>) => {
        const id = `elem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
        const maxZ = design.elements.reduce((max, el) => Math.max(max, el.zIndex || 0), 0);

        let newElem: CertificateElement;

        switch (type) {
            case "static-text":
                newElem = {
                    id,
                    type: "static-text",
                    x: Math.round((canvasWidth - 360) / 2),
                    y: 150,
                    width: 360,
                    height: 44,
                    zIndex: maxZ + 1,
                    text: "Static Header or Text",
                    style: { fontSize: 16, fontWeight: "bold", color: "#0F172A", textAlign: "center", fontFamily: "Inter" },
                };
                break;
            case "dynamic-text":
                newElem = {
                    id,
                    type: "dynamic-text",
                    fieldKey: options?.fieldKey || "recipient.name",
                    fallbackValue: options?.fallbackValue || "Recipient Full Name",
                    x: Math.round((canvasWidth - 440) / 2),
                    y: 200,
                    width: 440,
                    height: 52,
                    zIndex: maxZ + 1,
                    style: { fontSize: 28, fontWeight: "black", color: "#0F172A", textAlign: "center", fontFamily: "Playfair Display" },
                    fitPolicy: "shrink",
                    minFontSize: 12,
                    maxFontSize: 40,
                    maxLines: 1,
                };
                break;
            case "shape":
                newElem = {
                    id,
                    type: "shape",
                    x: Math.round((canvasWidth - 220) / 2),
                    y: 260,
                    width: 220,
                    height: 3,
                    zIndex: maxZ + 1,
                    style: { backgroundColor: "#0F172A" },
                };
                break;
            case "badge":
                newElem = {
                    id,
                    type: "badge",
                    text: "AWARD",
                    x: Math.round((canvasWidth - 60) / 2),
                    y: 50,
                    width: 60,
                    height: 60,
                    zIndex: maxZ + 1,
                    style: { backgroundColor: "#F59E0B", color: "#000000", fontSize: 11, fontWeight: "black", borderRadius: 30 },
                };
                break;
            case "image":
                newElem = {
                    id,
                    type: "image",
                    x: Math.round((canvasWidth - 100) / 2),
                    y: 60,
                    width: 100,
                    height: 100,
                    zIndex: maxZ + 1,
                    imageUrl: "",
                    imageFit: "contain",
                    style: { borderRadius: 0 },
                };
                break;
            case "signature":
                newElem = {
                    id,
                    type: "signature",
                    x: Math.round(canvasWidth - 240),
                    y: Math.round(canvasHeight - 95),
                    width: 180,
                    height: 54,
                    zIndex: maxZ + 1,
                    signerName: "Prof. Rajesh Verma",
                    signerTitle: "Faculty Coordinator & Club Advisor",
                    style: { borderColor: "#000000", color: "#000000", borderWidth: 1.5, fontSize: 11 },
                };
                break;
            case "qr-code":
                newElem = {
                    id,
                    type: "qr-code",
                    fieldKey: "certificate.credentialCode",
                    x: 60,
                    y: Math.round(canvasHeight - 95),
                    width: 55,
                    height: 55,
                    zIndex: maxZ + 1,
                };
                break;
            default:
                newElem = {
                    id,
                    type: "static-text",
                    x: 100,
                    y: 100,
                    width: 200,
                    height: 40,
                    zIndex: maxZ + 1,
                    text: "New Element",
                };
        }

        if (options) {
            newElem = {
                ...newElem,
                ...options,
                style: { ...(newElem.style || {}), ...(options.style || {}) },
            };
        }

        updateDesignWithHistory({ ...design, elements: [...design.elements, newElem] });
        setSelectedElementIds([id]);
        toast.success(`Added ${newElem.type} element.`);
    };

    // Phase 6.2: Drop Handler for Drag-and-Drop Dynamic Fields onto Canvas
    const handleDropCanvas = (e: React.DragEvent) => {
        e.preventDefault();
        if (!canvasRef.current) return;
        const dataStr = e.dataTransfer.getData("application/json");
        if (!dataStr) return;

        try {
            const fieldDef: DynamicFieldDefinition = JSON.parse(dataStr);
            const rect = canvasRef.current.getBoundingClientRect();
            const dropX = Math.round((e.clientX - rect.left) / zoom - 200);
            const dropY = Math.round((e.clientY - rect.top) / zoom - 25);

            addElement("dynamic-text", {
                fieldKey: fieldDef.key,
                fallbackValue: fieldDef.sampleValue,
                x: Math.max(20, Math.min(canvasWidth - 420, dropX)),
                y: Math.max(20, Math.min(canvasHeight - 60, dropY)),
                width: 400,
                height: 50,
                dataType: fieldDef.dataType || "text",
            });
            toast.success(`Dropped "${fieldDef.label}" token onto canvas!`);
        } catch (err) {
            console.error("Drop token parsing error:", err);
        }
    };

    // Add Masking Patch for covering flattened text on uploaded backgrounds
    const addMaskPatch = () => {
        const id = `elem_${Date.now()}_patch`;
        const maxZ = design.elements.reduce((max, el) => Math.max(max, el.zIndex || 0), 0);
        const newPatch: CertificateElement = {
            id,
            type: "shape",
            x: Math.round((canvasWidth - 320) / 2),
            y: Math.round(canvasHeight * 0.4),
            width: 320,
            height: 60,
            zIndex: maxZ + 1,
            style: {
                backgroundColor: "#FFFFFF",
                borderColor: "#000000",
                borderWidth: 0,
                borderRadius: 4,
                opacity: 1,
            },
        };
        updateDesignWithHistory({ ...design, elements: [...design.elements, newPatch] });
        setSelectedElementIds([id]);
        toast.info("Added Masking Patch. Adjust this cover box over flattened text to hide it, then overlay dynamic tokens.");
    };

    // Duplicate element(s)
    const duplicateElements = useCallback((ids: string[]) => {
        if (!ids.length) return;
        const newSelected: string[] = [];
        let clonedElements = [...design.elements];

        ids.forEach((id) => {
            const el = design.elements.find((e) => e.id === id);
            if (!el) return;
            const newId = `elem_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
            const clone: CertificateElement = {
                ...el,
                id: newId,
                x: el.x + 16,
                y: el.y + 16,
                zIndex: (el.zIndex || 1) + 1,
            };
            clonedElements.push(clone);
            newSelected.push(newId);
        });

        updateDesignWithHistory({ ...design, elements: clonedElements });
        setSelectedElementIds(newSelected);
        toast.success(`Duplicated ${ids.length} element(s).`);
    }, [design, updateDesignWithHistory, toast]);

    // Delete element(s)
    const deleteElements = useCallback((ids: string[]) => {
        if (!ids.length) return;
        const next = design.elements.filter((e) => !ids.includes(e.id));
        updateDesignWithHistory({ ...design, elements: next });
        setSelectedElementIds([]);
        toast.info(`Deleted ${ids.length} element(s).`);
    }, [design, updateDesignWithHistory, toast]);

    // Toggle Lock
    const toggleLock = useCallback((ids: string[]) => {
        if (!ids.length) return;
        const shouldLock = ids.some((id) => !design.elements.find((e) => e.id === id)?.isLocked);
        const next = design.elements.map((el) => {
            if (!ids.includes(el.id)) return el;
            return { ...el, isLocked: shouldLock };
        });
        updateDesignWithHistory({ ...design, elements: next });
        toast.info(shouldLock ? "Locked element(s)." : "Unlocked element(s).");
    }, [design, updateDesignWithHistory, toast]);

    // Toggle Visibility
    const toggleHide = useCallback((ids: string[]) => {
        if (!ids.length) return;
        const shouldHide = ids.some((id) => !design.elements.find((e) => e.id === id)?.isHidden);
        const next = design.elements.map((el) => {
            if (!ids.includes(el.id)) return el;
            return { ...el, isHidden: shouldHide };
        });
        updateDesignWithHistory({ ...design, elements: next });
        toast.info(shouldHide ? "Hidden element(s)." : "Revealed element(s).");
    }, [design, updateDesignWithHistory, toast]);

    // Align elements
    const alignElements = useCallback((alignment: "left" | "center-h" | "right" | "top" | "center-v" | "bottom") => {
        if (!selectedElementIds.length) return;

        if (selectedElementIds.length === 1) {
            const el = design.elements.find((e) => e.id === selectedElementIds[0]);
            if (!el) return;
            let nextX = el.x;
            let nextY = el.y;

            if (alignment === "left") nextX = 40;
            if (alignment === "center-h") nextX = Math.round((canvasWidth - el.width) / 2);
            if (alignment === "right") nextX = canvasWidth - el.width - 40;
            if (alignment === "top") nextY = 40;
            if (alignment === "center-v") nextY = Math.round((canvasHeight - el.height) / 2);
            if (alignment === "bottom") nextY = canvasHeight - el.height - 40;

            updateElement(el.id, { x: nextX, y: nextY });
            return;
        }

        const targets = design.elements.filter((e) => selectedElementIds.includes(e.id));
        const minX = Math.min(...targets.map((t) => t.x));
        const maxX = Math.max(...targets.map((t) => t.x + t.width));
        const minY = Math.min(...targets.map((t) => t.y));
        const maxY = Math.max(...targets.map((t) => t.y + t.height));
        const centerH = (minX + maxX) / 2;
        const centerV = (minY + maxY) / 2;

        const nextElements = design.elements.map((el) => {
            if (!selectedElementIds.includes(el.id)) return el;
            let newX = el.x;
            let newY = el.y;
            if (alignment === "left") newX = minX;
            if (alignment === "center-h") newX = Math.round(centerH - el.width / 2);
            if (alignment === "right") newX = maxX - el.width;
            if (alignment === "top") newY = minY;
            if (alignment === "center-v") newY = Math.round(centerV - el.height / 2);
            if (alignment === "bottom") newY = maxY - el.height;
            return { ...el, x: newX, y: newY };
        });

        updateDesignWithHistory({ ...design, elements: nextElements });
    }, [selectedElementIds, design, canvasWidth, canvasHeight, updateElement, updateDesignWithHistory]);

    // Mouse handlers for dragging elements
    const handleMouseDownElement = (e: React.MouseEvent, elem: CertificateElement) => {
        e.stopPropagation();

        if (elem.isLocked) {
            setSelectedElementIds([elem.id]);
            return;
        }

        let newSelected = [...selectedElementIds];
        if (e.shiftKey) {
            if (newSelected.includes(elem.id)) {
                newSelected = newSelected.filter((id) => id !== elem.id);
            } else {
                newSelected.push(elem.id);
            }
        } else if (!newSelected.includes(elem.id)) {
            newSelected = [elem.id];
        }

        setSelectedElementIds(newSelected);

        const initialPositions = design.elements
            .filter((el) => newSelected.includes(el.id) && !el.isLocked)
            .map((el) => ({ id: el.id, x: el.x, y: el.y }));

        setDraggingState({
            mouseX: e.clientX,
            mouseY: e.clientY,
            initialPositions,
        });
    };

    // Mouse handler for 8-way resize
    const handleMouseDownResize = (e: React.MouseEvent, elem: CertificateElement, handle: ResizeHandleType) => {
        e.stopPropagation();
        if (elem.isLocked) return;

        setResizingInfo({
            elemId: elem.id,
            handle,
            mouseX: e.clientX,
            mouseY: e.clientY,
            elemX: elem.x,
            elemY: elem.y,
            w: elem.width,
            h: elem.height,
        });
    };

    // Mouse handler for rotation
    const handleMouseDownRotate = (e: React.MouseEvent, elem: CertificateElement) => {
        e.stopPropagation();
        if (elem.isLocked || !canvasRef.current) return;

        const canvasRect = canvasRef.current.getBoundingClientRect();
        const elemCenterX = canvasRect.left + (elem.x + elem.width / 2) * zoom;
        const elemCenterY = canvasRect.top + (elem.y + elem.height / 2) * zoom;

        setRotatingInfo({
            elemId: elem.id,
            centerX: elemCenterX,
            centerY: elemCenterY,
            currentAngle: elem.rotation || 0,
        });
    };

    // Mouse handler for canvas backdrop (marquee selection)
    const handleMouseDownCanvas = (e: React.MouseEvent) => {
        if (!canvasRef.current) return;
        const rect = canvasRef.current.getBoundingClientRect();
        const clickX = (e.clientX - rect.left) / zoom;
        const clickY = (e.clientY - rect.top) / zoom;

        if (!e.shiftKey) {
            setSelectedElementIds([]);
        }

        setMarquee({
            startX: clickX,
            startY: clickY,
            currentX: clickX,
            currentY: clickY,
        });
    };

    // Global Mousemove and Mouseup event listeners
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            // Dragging Elements
            if (draggingState && draggingState.initialPositions.length > 0) {
                const deltaX = (e.clientX - draggingState.mouseX) / zoom;
                const deltaY = (e.clientY - draggingState.mouseY) / zoom;

                let guides: { x?: number; y?: number } | null = null;

                const nextElements = design.elements.map((el) => {
                    const match = draggingState.initialPositions.find((p) => p.id === el.id);
                    if (!match) return el;

                    let rawX = match.x + deltaX;
                    let rawY = match.y + deltaY;

                    if (snapToGrid) {
                        rawX = Math.round(rawX / 10) * 10;
                        rawY = Math.round(rawY / 10) * 10;
                    }

                    if (showGuides && match.id === selectedElementId) {
                        const centerX = rawX + el.width / 2;
                        const canvasCenterX = canvasWidth / 2;
                        if (Math.abs(centerX - canvasCenterX) <= 5) {
                            rawX = Math.round(canvasCenterX - el.width / 2);
                            guides = { ...(guides || {}), x: canvasCenterX };
                        }

                        const centerY = rawY + el.height / 2;
                        const canvasCenterY = canvasHeight / 2;
                        if (Math.abs(centerY - canvasCenterY) <= 5) {
                            rawY = Math.round(canvasCenterY - el.height / 2);
                            guides = { ...(guides || {}), y: canvasCenterY };
                        }
                    }

                    const clampedX = Math.max(-100, Math.min(canvasWidth + 100, Math.round(rawX)));
                    const clampedY = Math.max(-100, Math.min(canvasHeight + 100, Math.round(rawY)));

                    return { ...el, x: clampedX, y: clampedY };
                });

                setActiveGuides(guides);
                setDesign((prev) => ({ ...prev, elements: nextElements }));
            }

            // 8-way Resizing
            else if (resizingInfo) {
                const deltaX = (e.clientX - resizingInfo.mouseX) / zoom;
                const deltaY = (e.clientY - resizingInfo.mouseY) / zoom;
                const handle = resizingInfo.handle;

                let nextX = resizingInfo.elemX;
                let nextY = resizingInfo.elemY;
                let nextW = resizingInfo.w;
                let nextH = resizingInfo.h;

                if (handle.includes("e")) {
                    nextW = Math.max(20, Math.round(resizingInfo.w + deltaX));
                }
                if (handle.includes("s")) {
                    nextH = Math.max(10, Math.round(resizingInfo.h + deltaY));
                }
                if (handle.includes("w")) {
                    const candidateW = Math.max(20, Math.round(resizingInfo.w - deltaX));
                    nextX = resizingInfo.elemX + (resizingInfo.w - candidateW);
                    nextW = candidateW;
                }
                if (handle.includes("n")) {
                    const candidateH = Math.max(10, Math.round(resizingInfo.h - deltaY));
                    nextY = resizingInfo.elemY + (resizingInfo.h - candidateH);
                    nextH = candidateH;
                }

                if (snapToGrid) {
                    nextW = Math.round(nextW / 10) * 10;
                    nextH = Math.round(nextH / 10) * 10;
                    nextX = Math.round(nextX / 10) * 10;
                    nextY = Math.round(nextY / 10) * 10;
                }

                setDesign((prev) => ({
                    ...prev,
                    elements: prev.elements.map((el) =>
                        el.id === resizingInfo.elemId
                            ? { ...el, x: nextX, y: nextY, width: nextW, height: nextH }
                            : el
                    ),
                }));
            }

            // Rotating
            else if (rotatingInfo) {
                const rad = Math.atan2(e.clientY - rotatingInfo.centerY, e.clientX - rotatingInfo.centerX);
                let deg = Math.round((rad * 180) / Math.PI + 90);
                if (deg < 0) deg += 360;
                if (deg >= 360) deg -= 360;

                if (e.shiftKey) {
                    deg = Math.round(deg / 15) * 15;
                    if (deg === 360) deg = 0;
                }

                setRotatingInfo((prev) => (prev ? { ...prev, currentAngle: deg } : null));

                setDesign((prev) => ({
                    ...prev,
                    elements: prev.elements.map((el) =>
                        el.id === rotatingInfo.elemId ? { ...el, rotation: deg } : el
                    ),
                }));
            }

            // Marquee selection box
            else if (marquee && canvasRef.current) {
                const rect = canvasRef.current.getBoundingClientRect();
                const curX = (e.clientX - rect.left) / zoom;
                const curY = (e.clientY - rect.top) / zoom;

                setMarquee((prev) => (prev ? { ...prev, currentX: curX, currentY: curY } : null));

                const boxLeft = Math.min(marquee.startX, curX);
                const boxRight = Math.max(marquee.startX, curX);
                const boxTop = Math.min(marquee.startY, curY);
                const boxBottom = Math.max(marquee.startY, curY);

                const matchedIds = design.elements
                    .filter((el) => {
                        if (el.isHidden) return false;
                        const elLeft = el.x;
                        const elRight = el.x + el.width;
                        const elTop = el.y;
                        const elBottom = el.y + el.height;
                        return !(
                            elRight < boxLeft ||
                            elLeft > boxRight ||
                            elBottom < boxTop ||
                            elTop > boxBottom
                        );
                    })
                    .map((el) => el.id);

                setSelectedElementIds(matchedIds);
            }
        };

        const handleMouseUp = () => {
            if (draggingState || resizingInfo || rotatingInfo) {
                updateDesignWithHistory(design);
                setDraggingState(null);
                setResizingInfo(null);
                setRotatingInfo(null);
                setActiveGuides(null);
            }
            if (marquee) {
                setMarquee(null);
            }
        };

        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", handleMouseUp);
        };
    }, [
        draggingState,
        resizingInfo,
        rotatingInfo,
        marquee,
        zoom,
        design,
        snapToGrid,
        showGuides,
        selectedElementId,
        canvasWidth,
        canvasHeight,
        updateDesignWithHistory,
    ]);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            const isInput =
                e.target instanceof HTMLInputElement ||
                e.target instanceof HTMLTextAreaElement ||
                e.target instanceof HTMLSelectElement;

            if (isInput) {
                if (e.key === "Escape") {
                    (e.target as HTMLElement).blur();
                }
                return;
            }

            const isMac = navigator.platform.toUpperCase().indexOf("MAC") >= 0;
            const cmd = isMac ? e.metaKey : e.ctrlKey;

            if (cmd && (e.key === "s" || e.key === "S")) {
                e.preventDefault();
                handleSave();
                return;
            }

            if (cmd && !e.shiftKey && (e.key === "z" || e.key === "Z")) {
                e.preventDefault();
                handleUndo();
                return;
            }

            if ((cmd && (e.key === "y" || e.key === "Y")) || (cmd && e.shiftKey && (e.key === "z" || e.key === "Z"))) {
                e.preventDefault();
                handleRedo();
                return;
            }

            if (cmd && (e.key === "a" || e.key === "A")) {
                e.preventDefault();
                setSelectedElementIds(design.elements.filter((el) => !el.isHidden).map((el) => el.id));
                toast.info("Selected all elements.");
                return;
            }

            if (cmd && (e.key === "d" || e.key === "D")) {
                e.preventDefault();
                duplicateElements(selectedElementIds);
                return;
            }

            if (e.key === "Delete" || e.key === "Backspace") {
                if (selectedElementIds.length > 0) {
                    e.preventDefault();
                    deleteElements(selectedElementIds);
                }
                return;
            }

            if (e.key === "Escape") {
                setSelectedElementIds([]);
                setShowShortcutsModal(false);
                setShowAuditModal(false);
                setShowCustomAttrModal(false);
                return;
            }

            if (e.key === "?" && !cmd) {
                e.preventDefault();
                setShowShortcutsModal((prev) => !prev);
                return;
            }

            if ((e.key === "l" || e.key === "L") && !cmd) {
                if (selectedElementIds.length > 0) {
                    e.preventDefault();
                    toggleLock(selectedElementIds);
                }
                return;
            }

            if ((e.key === "h" || e.key === "H") && !cmd) {
                if (selectedElementIds.length > 0) {
                    e.preventDefault();
                    toggleHide(selectedElementIds);
                }
                return;
            }

            if (
                ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key) &&
                selectedElementIds.length > 0
            ) {
                e.preventDefault();
                const step = e.shiftKey ? 10 : 1;
                let dx = 0;
                let dy = 0;
                if (e.key === "ArrowLeft") dx = -step;
                if (e.key === "ArrowRight") dx = step;
                if (e.key === "ArrowUp") dy = -step;
                if (e.key === "ArrowDown") dy = step;

                const next = design.elements.map((el) => {
                    if (!selectedElementIds.includes(el.id) || el.isLocked) return el;
                    return { ...el, x: el.x + dx, y: el.y + dy };
                });
                updateDesignWithHistory({ ...design, elements: next });
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [
        selectedElementIds,
        design,
        handleUndo,
        handleRedo,
        duplicateElements,
        deleteElements,
        toggleLock,
        toggleHide,
        updateDesignWithHistory,
        toast,
    ]);

    // Test PDF preview
    const handlePreviewPdf = async () => {
        setIsPreviewLoading(true);
        try {
            const blob = await previewSampleCertificate(design);
            const url = URL.createObjectURL(blob);
            window.open(url, "_blank");
            toast.success("Generated test PDF preview!");
        } catch (err: any) {
            toast.error(err.message || "Failed to generate test preview.");
        } finally {
            setIsPreviewLoading(false);
        }
    };

    // Save template
    const handleSave = async () => {
        if (!templateName.trim()) {
            toast.error("Please enter a valid template name.");
            return;
        }
        setIsSaving(true);
        try {
            await onSave(design, templateName.trim());
            toast.success(`Template "${templateName}" saved to your club library!`);
        } catch (err: any) {
            toast.error(err.message || "Failed to save template.");
        } finally {
            setIsSaving(false);
        }
    };

    // Phase 6.2: Calculate rendered display text on canvas based on active Display Mode
    const getRenderedDisplayText = (elem: CertificateElement) => {
        if (elem.type !== "dynamic-text") {
            return elem.text || "";
        }
        const def = allDynamicFields.find((f) => f.key === elem.fieldKey);
        if (tokenDisplayMode === "raw") {
            return `{{${elem.fieldKey || "field"}}}`;
        }
        if (tokenDisplayMode === "friendly") {
            const label = def?.label || elem.fieldKey || "DYNAMIC FIELD";
            return `[${label.toUpperCase()}]`;
        }
        return elem.fallbackValue || def?.sampleValue || `[${(elem.fieldKey || "FIELD").toUpperCase()}]`;
    };

    return (
        <div className="flex flex-col h-[88vh] bg-[#FAF6EE] rounded-2xl border-4 border-black overflow-hidden shadow-[8px_8px_0px_#000]">
            {/* Top Toolbar */}
            <div className="px-5 py-3 bg-white border-b-3 border-black flex flex-wrap items-center justify-between gap-3 shrink-0">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 shadow-[2px_2px_0px_#000] transition-transform active:translate-x-0.5 active:translate-y-0.5"
                        title="Back to Templates"
                    >
                        <ArrowLeft className="w-4 h-4 text-black" />
                    </button>

                    <div className="flex items-center gap-2">
                        <Award className="w-5 h-5 text-black" />
                        <input
                            type="text"
                            value={templateName}
                            onChange={(e) => setTemplateName(e.target.value)}
                            className="font-black text-sm sm:text-base text-black bg-transparent border-b-2 border-transparent hover:border-black/30 focus:border-black focus:outline-none px-1 py-0.5"
                            placeholder="Certificate Template Name"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    {/* Undo / Redo */}
                    <div className="flex items-center border-2 border-black rounded-lg overflow-hidden shadow-[2px_2px_0px_#000] bg-white">
                        <button
                            onClick={handleUndo}
                            disabled={historyIndex <= 0}
                            className="p-1.5 hover:bg-neutral-100 disabled:opacity-40 border-r border-black"
                            title="Undo (Ctrl+Z)"
                        >
                            <RotateCcw className="w-3.5 h-3.5 text-black" />
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={historyIndex >= history.length - 1}
                            className="p-1.5 hover:bg-neutral-100 disabled:opacity-40"
                            title="Redo (Ctrl+Y)"
                        >
                            <RotateCw className="w-3.5 h-3.5 text-black" />
                        </button>
                    </div>

                    {/* Phase 6.2: Token Display Mode Toggle */}
                    <div className="flex items-center border-2 border-black rounded-lg overflow-hidden shadow-[2px_2px_0px_#000] bg-white text-xs">
                        <button
                            onClick={() => setTokenDisplayMode("sample")}
                            className={`px-2 py-1 font-black border-r border-black ${
                                tokenDisplayMode === "sample" ? "bg-[#FFE566] text-black" : "text-neutral-700 hover:bg-neutral-100"
                            }`}
                            title="Display sample recipient values"
                        >
                            Sample
                        </button>
                        <button
                            onClick={() => setTokenDisplayMode("friendly")}
                            className={`px-2 py-1 font-black border-r border-black ${
                                tokenDisplayMode === "friendly" ? "bg-[#FFE566] text-black" : "text-neutral-700 hover:bg-neutral-100"
                            }`}
                            title="Display friendly field labels [NAME]"
                        >
                            Labels
                        </button>
                        <button
                            onClick={() => setTokenDisplayMode("raw")}
                            className={`px-2 py-1 font-black font-mono ${
                                tokenDisplayMode === "raw" ? "bg-[#FFE566] text-black" : "text-neutral-700 hover:bg-neutral-100"
                            }`}
                            title="Display raw syntax {{recipient.name}}"
                        >
                            {"{ }"}
                        </button>
                    </div>

                    {/* Snap to grid, guides & visual grid */}
                    <div className="flex items-center border-2 border-black rounded-lg overflow-hidden shadow-[2px_2px_0px_#000] bg-white">
                        <button
                            onClick={() => {
                                setSnapToGrid((prev) => !prev);
                                toast.info(snapToGrid ? "Snap-to-Grid Disabled" : "Snap-to-Grid Enabled (10pt)");
                            }}
                            className={`px-2 py-1 text-xs font-bold flex items-center gap-1 border-r border-black ${
                                snapToGrid ? "bg-[#FFE566] text-black" : "text-neutral-700 hover:bg-neutral-100"
                            }`}
                            title="Toggle Snap-to-Grid (10pt)"
                        >
                            <span>Snap</span>
                        </button>
                        <button
                            onClick={() => {
                                setShowGuides((prev) => !prev);
                                toast.info(showGuides ? "Smart Alignment Guides Disabled" : "Smart Alignment Guides Enabled");
                            }}
                            className={`px-2 py-1 text-xs font-bold flex items-center gap-1 border-r border-black ${
                                showGuides ? "bg-[#FFE566] text-black" : "text-neutral-700 hover:bg-neutral-100"
                            }`}
                            title="Toggle Smart Alignment Guides"
                        >
                            <span>Guides</span>
                        </button>
                        <button
                            onClick={() => setShowGrid((prev) => !prev)}
                            className={`p-1.5 ${
                                showGrid ? "bg-[#FFE566] text-black" : "text-neutral-700 hover:bg-neutral-100"
                            }`}
                            title="Toggle Grid Dots"
                        >
                            <Grid className="w-3.5 h-3.5" />
                        </button>
                    </div>

                    {/* Zoom & Fit-to-Screen Controls */}
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
                            title="Fit Canvas to Screen"
                        >
                            <Maximize className="w-3.5 h-3.5 text-black" />
                        </button>
                    </div>

                    {/* Phase 6.4: Data Audit & Verification Button */}
                    <button
                        onClick={() => setShowAuditModal(true)}
                        className={`px-2.5 py-1.5 rounded-lg border-2 border-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 ${
                            auditReport.hasIssues
                                ? "bg-[#FFE566] hover:bg-[#FDD835] text-black"
                                : "bg-white hover:bg-neutral-100 text-black"
                        }`}
                        title="Audit Dynamic Field Mapping & Fallbacks"
                    >
                        {auditReport.hasIssues ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                        ) : (
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-700" />
                        )}
                        <span>Audit Fields</span>
                    </button>

                    {/* Shortcuts Modal Trigger */}
                    <button
                        onClick={() => setShowShortcutsModal(true)}
                        className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000]"
                        title="Keyboard Shortcuts (?)"
                    >
                        <HelpCircle className="w-4 h-4 text-black" />
                    </button>

                    {/* Test PDF Preview */}
                    <button
                        onClick={handlePreviewPdf}
                        disabled={isPreviewLoading}
                        className="px-3 py-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5"
                    >
                        <FileDown className="w-3.5 h-3.5 text-black" />
                        <span className="hidden sm:inline">Test PDF</span>
                    </button>

                    {/* Phase 7: Dedicated Preview & Validation Studio */}
                    <button
                        onClick={() => onProceedToIssuance(design)}
                        className="px-3 py-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5"
                        title="Mandatory Pre-Issuance Preview & Validation Studio"
                    >
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="hidden sm:inline">Preview Studio</span>
                    </button>

                    {/* Save Template */}
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-3.5 py-1.5 rounded-lg border-2 border-black bg-[#FFE566] hover:bg-[#FDD835] text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5"
                    >
                        <Save className="w-3.5 h-3.5 text-black" />
                        <span>Save Template</span>
                    </button>

                    {/* Proceed to Issuance (Navigates to Preview & Validation Studio) */}
                    <button
                        onClick={() => onProceedToIssuance(design)}
                        className="px-4 py-1.5 rounded-lg border-2 border-black bg-[#a2ff86] hover:bg-[#8ee673] text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                    >
                        <span>Preview & Issue</span> &rarr;
                    </button>
                </div>
            </div>

            {/* Main 3-Column Workspace */}
            <div className="flex flex-1 overflow-hidden">
                {/* LEFT PANEL: Elements & Layers */}
                <div className="w-80 bg-white border-r-3 border-black flex flex-col shrink-0">
                    {/* Left Sub-tabs */}
                    <div className="grid grid-cols-4 border-b-2 border-black bg-[#F5F1E6]">
                        <button
                            onClick={() => setActiveLeftTab("elements")}
                            className={`py-2 text-[11px] font-black uppercase tracking-wider flex flex-col items-center gap-1 border-r border-black ${
                                activeLeftTab === "elements" ? "bg-white text-black border-b-2 border-b-white" : "text-neutral-600 hover:bg-neutral-100"
                            }`}
                        >
                            <Type className="w-3.5 h-3.5" />
                            <span>Add</span>
                        </button>
                        <button
                            onClick={() => setActiveLeftTab("fields")}
                            className={`py-2 text-[11px] font-black uppercase tracking-wider flex flex-col items-center gap-1 border-r border-black ${
                                activeLeftTab === "fields" ? "bg-white text-black border-b-2 border-b-white" : "text-neutral-600 hover:bg-neutral-100"
                            }`}
                        >
                            <Sparkles className="w-3.5 h-3.5" />
                            <span>Fields</span>
                        </button>
                        <button
                            onClick={() => setActiveLeftTab("layers")}
                            className={`py-2 text-[11px] font-black uppercase tracking-wider flex flex-col items-center gap-1 border-r border-black ${
                                activeLeftTab === "layers" ? "bg-white text-black border-b-2 border-b-white" : "text-neutral-600 hover:bg-neutral-100"
                            }`}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            <span>Layers</span>
                        </button>
                        <button
                            onClick={() => setActiveLeftTab("background")}
                            className={`py-2 text-[11px] font-black uppercase tracking-wider flex flex-col items-center gap-1 ${
                                activeLeftTab === "background" ? "bg-white text-black border-b-2 border-b-white" : "text-neutral-600 hover:bg-neutral-100"
                            }`}
                        >
                            <Palette className="w-3.5 h-3.5" />
                            <span>Frame</span>
                        </button>
                    </div>

                    {/* Left Panel Contents */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                        {activeLeftTab === "elements" && (
                            <div className="space-y-4">
                                {/* Section 1: Typography */}
                                <div className="space-y-2">
                                    <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Type className="w-3.5 h-3.5 text-black" />
                                        <span>Typography &amp; Headers</span>
                                    </h4>

                                    <button
                                        onClick={() =>
                                            addElement("static-text", {
                                                text: "CERTIFICATE OF ACHIEVEMENT",
                                                width: 480,
                                                height: 48,
                                                style: { fontSize: 26, fontWeight: "black", fontFamily: "Space Grotesk", color: "#0F172A", textAlign: "center", letterSpacing: 2 },
                                            })
                                        }
                                        className="w-full p-2.5 rounded-xl border-2 border-black bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000] flex items-center gap-3 text-left transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-[#FFE566] border border-black flex items-center justify-center font-black text-sm">
                                            H1
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-black">Main Title / Heading</div>
                                            <div className="text-[10px] text-neutral-500">Bold 26pt display title</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() =>
                                            addElement("static-text", {
                                                text: "THIS HONOR IS PROUDLY CONFERRED UPON",
                                                width: 420,
                                                height: 24,
                                                style: { fontSize: 11, fontWeight: "bold", fontFamily: "Inter", color: "#64748B", textAlign: "center", letterSpacing: 2 },
                                            })
                                        }
                                        className="w-full p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000] flex items-center gap-3 text-left transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-white border border-black flex items-center justify-center font-black text-xs text-neutral-700">
                                            H2
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-black">Subtitle / Preheader</div>
                                            <div className="text-[10px] text-neutral-500">Tracking citation lead-in</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() =>
                                            addElement("static-text", {
                                                text: "In recognition of outstanding algorithmic merit, exceptional teamwork, and demonstrated commitment to technical excellence.",
                                                width: 500,
                                                height: 48,
                                                style: { fontSize: 13, fontWeight: "normal", fontFamily: "Inter", color: "#334155", textAlign: "center", lineHeight: 1.5 },
                                            })
                                        }
                                        className="w-full p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000] flex items-center gap-3 text-left transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-[#FAF6EE] border border-black flex items-center justify-center font-bold text-xs text-neutral-700">
                                            &para;
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-black">Citation Paragraph</div>
                                            <div className="text-[10px] text-neutral-500">Multi-line descriptive body</div>
                                        </div>
                                    </button>
                                </div>

                                {/* Section 2: Shapes & Lines */}
                                <div className="space-y-2 border-t border-black/10 pt-3">
                                    <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <Square className="w-3.5 h-3.5 text-black" />
                                        <span>Shapes &amp; Lines</span>
                                    </h4>

                                    <button
                                        onClick={() =>
                                            addElement("shape", {
                                                width: 280,
                                                height: 70,
                                                shapeType: "box",
                                                style: { backgroundColor: "#FAF6EE", borderColor: "#000000", borderWidth: 2, borderRadius: 8, opacity: 1 },
                                            })
                                        }
                                        className="w-full p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000] flex items-center gap-3 text-left transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-[#A6E3E9] border border-black flex items-center justify-center">
                                            <Square className="w-4 h-4 text-black" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-black">Box / Container</div>
                                            <div className="text-[10px] text-neutral-500">Background panel or border</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() =>
                                            addElement("shape", {
                                                width: 320,
                                                height: 2,
                                                shapeType: "line",
                                                style: { backgroundColor: "#0F172A", borderWidth: 0 },
                                            })
                                        }
                                        className="w-full p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000] flex items-center gap-3 text-left transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-neutral-100 border border-black flex items-center justify-center">
                                            <Minus className="w-4 h-4 text-black stroke-[3]" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-black">Accent Divider Rule</div>
                                            <div className="text-[10px] text-neutral-500">Horizontal separation line</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() =>
                                            addElement("badge", {
                                                width: 55,
                                                height: 55,
                                                text: "1ST",
                                                style: { backgroundColor: "#F59E0B", color: "#000000", fontSize: 13, fontWeight: "black", borderRadius: 28 },
                                            })
                                        }
                                        className="w-full p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000] flex items-center gap-3 text-left transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-[#FFDE59] border border-black flex items-center justify-center">
                                            <Award className="w-4 h-4 text-black" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-black">Merit Medal / Badge</div>
                                            <div className="text-[10px] text-neutral-500">Gold circular placement seal</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={addMaskPatch}
                                        className="w-full p-2 rounded-xl border-2 border-black bg-[#FAF6EE] hover:bg-neutral-100 shadow-[2px_2px_0px_#000] flex items-center gap-3 text-left transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                        title="Cover old flattened text on uploaded backgrounds"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-black text-[#FFE566] border border-black flex items-center justify-center">
                                            <Layers className="w-4 h-4 stroke-[2.5]" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-black">Masking Patch / Cover Box</div>
                                            <div className="text-[10px] text-neutral-600">Cover old flattened text</div>
                                        </div>
                                    </button>
                                </div>

                                {/* Section 3: Signatures, Media & Verification */}
                                <div className="space-y-2 border-t border-black/10 pt-3">
                                    <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-wider flex items-center gap-1.5">
                                        <PenTool className="w-3.5 h-3.5 text-black" />
                                        <span>Signatures &amp; Verification</span>
                                    </h4>

                                    <button
                                        onClick={() => addElement("signature")}
                                        className="w-full p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000] flex items-center gap-3 text-left transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-[#DCFCE7] border border-black flex items-center justify-center">
                                            <PenTool className="w-4 h-4 text-black" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-black">Signature Block</div>
                                            <div className="text-[10px] text-neutral-500">Signer line, name &amp; title</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => addElement("image")}
                                        className="w-full p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000] flex items-center gap-3 text-left transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-[#E0E7FF] border border-black flex items-center justify-center">
                                            <ImageIcon className="w-4 h-4 text-black" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-black">Image / Club Logo</div>
                                            <div className="text-[10px] text-neutral-500">Upload crest or static image</div>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => addElement("qr-code")}
                                        className="w-full p-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-50 shadow-[2px_2px_0px_#000] flex items-center gap-3 text-left transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-[#a2ff86] border border-black flex items-center justify-center">
                                            <QrCode className="w-4 h-4 text-black" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-black text-black">Verification QR Code</div>
                                            <div className="text-[10px] text-neutral-500">Public registry verification link</div>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Phase 6: Dynamic Fields Library (with Search, Drag-and-Drop, Categories & Custom Attributes) */}
                        {activeLeftTab === "fields" && (
                            <div className="space-y-3">
                                <div>
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-xs font-black text-neutral-800 uppercase tracking-wider flex items-center gap-1.5">
                                            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                                            <span>Dynamic Fields Library</span>
                                        </h4>
                                        <button
                                            onClick={() => setShowCustomAttrModal(true)}
                                            className="px-2 py-1 rounded-md border border-black bg-[#FFE566] text-[10px] font-black shadow-[1px_1px_0px_#000] flex items-center gap-1 hover:bg-[#FDD835]"
                                            title="Define a new custom attribute"
                                        >
                                            <Plus className="w-3 h-3 text-black" />
                                            <span>Custom</span>
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-neutral-600 mt-1">
                                        Drag &amp; drop onto canvas or click to place. Long recipient names auto-scale.
                                    </p>
                                </div>

                                {/* Search Bar */}
                                <div className="relative">
                                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                                    <input
                                        type="text"
                                        value={fieldsSearch}
                                        onChange={(e) => setFieldsSearch(e.target.value)}
                                        placeholder="Search tokens, labels, or keys..."
                                        className="w-full pl-8 pr-3 py-1.5 text-xs font-bold border-2 border-black rounded-xl bg-white focus:outline-none focus:ring-1 focus:ring-black"
                                    />
                                    {fieldsSearch && (
                                        <button
                                            onClick={() => setFieldsSearch("")}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-black"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    )}
                                </div>

                                {/* Category Filter Pills */}
                                <div className="flex items-center gap-1 overflow-x-auto pb-1 no-scrollbar text-[10px] font-bold">
                                    {[
                                        { id: "all", label: "All" },
                                        { id: "recipient", label: "Recipient" },
                                        { id: "event", label: "Event" },
                                        { id: "achievement", label: "Award" },
                                        { id: "team", label: "Team" },
                                        { id: "issuance", label: "Issuance" },
                                        { id: "club", label: "Club" },
                                        { id: "custom", label: "Custom" },
                                    ].map((cat) => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setFieldsCategoryFilter(cat.id)}
                                            className={`px-2 py-0.5 rounded-full border border-black shrink-0 transition-colors ${
                                                fieldsCategoryFilter === cat.id
                                                    ? "bg-black text-white font-black"
                                                    : "bg-white text-neutral-700 hover:bg-neutral-100"
                                            }`}
                                        >
                                            {cat.label}
                                        </button>
                                    ))}
                                </div>

                                {/* Draggable Field Cards List */}
                                <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
                                    {filteredDynamicFields.length === 0 ? (
                                        <div className="p-4 rounded-xl border-2 border-dashed border-neutral-300 text-center text-xs text-neutral-500">
                                            No fields match your search.
                                        </div>
                                    ) : (
                                        filteredDynamicFields.map((f) => (
                                            <div
                                                key={f.key}
                                                draggable
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData("application/json", JSON.stringify(f));
                                                    e.dataTransfer.effectAllowed = "copy";
                                                }}
                                                onClick={() =>
                                                    addElement("dynamic-text", {
                                                        fieldKey: f.key,
                                                        fallbackValue: f.sampleValue,
                                                        dataType: f.dataType || "text",
                                                        text: `[${f.label.toUpperCase()}]`,
                                                    })
                                                }
                                                className="w-full p-2.5 rounded-xl border-2 border-black bg-[#FAF6EE] hover:bg-[#FFE566] text-left transition-all group shadow-[1.5px_1.5px_0px_#000] cursor-grab active:cursor-grabbing relative"
                                                title="Drag onto canvas or click to place"
                                            >
                                                <div className="flex items-center justify-between gap-1">
                                                    <span className="text-xs font-black text-black truncate">
                                                        {f.label}
                                                    </span>
                                                    <div className="flex items-center gap-1 shrink-0">
                                                        {f.isCustom && (
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleDeleteCustomAttribute(f.key);
                                                                }}
                                                                className="text-neutral-400 hover:text-red-600 p-0.5"
                                                                title="Delete custom attribute"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        )}
                                                        <span className="px-1.5 py-0.2 rounded border border-black/40 text-[9px] font-black uppercase bg-white">
                                                            {f.category}
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between text-[10px] text-neutral-600 mt-0.5">
                                                    <span className="font-mono text-neutral-500">
                                                        {"{{"}{f.key}{"}}"}
                                                    </span>
                                                    <span className="uppercase text-[8px] font-mono text-neutral-400">
                                                        {f.dataType || "TEXT"}
                                                    </span>
                                                </div>

                                                <div className="text-[10px] text-neutral-700 mt-1 truncate bg-white/60 px-1.5 py-0.5 rounded border border-black/10">
                                                    Sample: <span className="font-semibold">{f.sampleValue}</span>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Phase 5.5: Layer Manager */}
                        {activeLeftTab === "layers" && (
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-black text-neutral-500 uppercase tracking-wider">
                                        Layers ({design.elements.length})
                                    </h4>
                                    <span className="text-[10px] text-neutral-500 font-bold">Top to Bottom</span>
                                </div>

                                {design.elements.length === 0 ? (
                                    <div className="p-4 rounded-xl border-2 border-dashed border-neutral-300 text-center text-xs text-neutral-500">
                                        No elements on canvas. Add text, shapes, or badges to start.
                                    </div>
                                ) : (
                                    <div className="space-y-1.5 max-h-[65vh] overflow-y-auto pr-1">
                                        {[...design.elements]
                                            .sort((a, b) => (b.zIndex || 0) - (a.zIndex || 0))
                                            .map((elem) => {
                                                const isSelected = selectedElementIds.includes(elem.id);
                                                return (
                                                    <div
                                                        key={elem.id}
                                                        onClick={(e) => {
                                                            if (e.shiftKey) {
                                                                if (selectedElementIds.includes(elem.id)) {
                                                                    setSelectedElementIds(selectedElementIds.filter((id) => id !== elem.id));
                                                                } else {
                                                                    setSelectedElementIds([...selectedElementIds, elem.id]);
                                                                }
                                                            } else {
                                                                setSelectedElementIds([elem.id]);
                                                            }
                                                        }}
                                                        className={`p-2 rounded-xl border-2 flex items-center justify-between gap-1.5 text-xs cursor-pointer transition-all ${
                                                            isSelected
                                                                ? "border-black bg-[#FFE566] font-black shadow-[2px_2px_0px_#000]"
                                                                : "border-neutral-300 bg-white hover:border-black text-neutral-800"
                                                        } ${elem.isHidden ? "opacity-40" : ""}`}
                                                    >
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            {elem.type === "dynamic-text" ? (
                                                                <Sparkles className="w-3.5 h-3.5 shrink-0 text-blue-600" />
                                                            ) : elem.type === "static-text" ? (
                                                                <Type className="w-3.5 h-3.5 shrink-0 text-neutral-700" />
                                                            ) : elem.type === "signature" ? (
                                                                <PenTool className="w-3.5 h-3.5 shrink-0 text-green-700" />
                                                            ) : elem.type === "qr-code" ? (
                                                                <QrCode className="w-3.5 h-3.5 shrink-0 text-purple-700" />
                                                            ) : (
                                                                <Square className="w-3.5 h-3.5 shrink-0 text-neutral-700" />
                                                            )}
                                                            <span className="truncate max-w-[110px] text-xs">
                                                                {elem.fieldKey || elem.text || elem.type}
                                                            </span>
                                                        </div>

                                                        {/* Layer Quick Controls */}
                                                        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                                                            <button
                                                                onClick={() => toggleLock([elem.id])}
                                                                className={`p-1 rounded hover:bg-black/10 ${elem.isLocked ? "text-amber-700 font-bold" : "text-neutral-400"}`}
                                                                title={elem.isLocked ? "Unlock Layer" : "Lock Layer"}
                                                            >
                                                                {elem.isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                                                            </button>

                                                            <button
                                                                onClick={() => toggleHide([elem.id])}
                                                                className={`p-1 rounded hover:bg-black/10 ${elem.isHidden ? "text-neutral-400" : "text-black"}`}
                                                                title={elem.isHidden ? "Show Layer" : "Hide Layer"}
                                                            >
                                                                {elem.isHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                            </button>

                                                            <button
                                                                onClick={() => moveLayerUp(elem.id)}
                                                                className="p-1 rounded hover:bg-black/10 text-neutral-600"
                                                                title="Move Layer Up"
                                                            >
                                                                <ArrowUp className="w-3 h-3" />
                                                            </button>

                                                            <button
                                                                onClick={() => moveLayerDown(elem.id)}
                                                                className="p-1 rounded hover:bg-black/10 text-neutral-600"
                                                                title="Move Layer Down"
                                                            >
                                                                <ArrowDown className="w-3 h-3" />
                                                            </button>

                                                            <button
                                                                onClick={() => deleteElements([elem.id])}
                                                                className="p-1 rounded hover:bg-red-100 text-red-600"
                                                                title="Delete Layer"
                                                            >
                                                                <Trash2 className="w-3 h-3" />
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                    </div>
                                )}
                            </div>
                        )}

                        {activeLeftTab === "background" && (
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-xs font-black text-neutral-500 uppercase tracking-wider">
                                        Canvas &amp; Paper Geometry
                                    </h4>
                                    <p className="text-[11px] text-neutral-600 mt-0.5">
                                        Configure physical paper dimensions and borders.
                                    </p>
                                </div>

                                {/* Predefined Paper Size Selector */}
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 block mb-1">
                                        Paper Size Preset
                                    </label>
                                    <select
                                        value={
                                            canvasWidth === 842 && canvasHeight === 595
                                                ? "a4-landscape"
                                                : canvasWidth === 595 && canvasHeight === 842
                                                ? "a4-portrait"
                                                : canvasWidth === 792 && canvasHeight === 612
                                                ? "letter-landscape"
                                                : canvasWidth === 612 && canvasHeight === 792
                                                ? "letter-portrait"
                                                : canvasWidth === 600 && canvasHeight === 600
                                                ? "square"
                                                : "custom"
                                        }
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === "a4-landscape") {
                                                updateDesignWithHistory({ ...design, page: { width: 842, height: 595, orientation: "landscape", unit: "pt" } });
                                            } else if (val === "a4-portrait") {
                                                updateDesignWithHistory({ ...design, page: { width: 595, height: 842, orientation: "portrait", unit: "pt" } });
                                            } else if (val === "letter-landscape") {
                                                updateDesignWithHistory({ ...design, page: { width: 792, height: 612, orientation: "landscape", unit: "pt" } });
                                            } else if (val === "letter-portrait") {
                                                updateDesignWithHistory({ ...design, page: { width: 612, height: 792, orientation: "portrait", unit: "pt" } });
                                            } else if (val === "square") {
                                                updateDesignWithHistory({ ...design, page: { width: 600, height: 600, orientation: "landscape", unit: "pt" } });
                                            }
                                        }}
                                        className="w-full p-2 text-xs font-bold border-2 border-black rounded-lg bg-white"
                                    >
                                        <option value="a4-landscape">A4 Landscape (842 &times; 595 pt)</option>
                                        <option value="a4-portrait">A4 Portrait (595 &times; 842 pt)</option>
                                        <option value="letter-landscape">US Letter Landscape (792 &times; 612 pt)</option>
                                        <option value="letter-portrait">US Letter Portrait (612 &times; 792 pt)</option>
                                        <option value="square">Square Credential (600 &times; 600 pt)</option>
                                        <option value="custom">Custom Dimensions</option>
                                    </select>
                                </div>

                                {/* Custom width/height */}
                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                                            Width (pt)
                                        </label>
                                        <input
                                            type="number"
                                            min={400}
                                            max={2000}
                                            value={canvasWidth}
                                            onChange={(e) => {
                                                const w = Number(e.target.value) || 842;
                                                updateDesignWithHistory({
                                                    ...design,
                                                    page: {
                                                        width: w,
                                                        height: canvasHeight,
                                                        orientation: w >= canvasHeight ? "landscape" : "portrait",
                                                        unit: "pt",
                                                    },
                                                });
                                            }}
                                            className="w-full p-1.5 text-xs font-bold border-2 border-black rounded-lg"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                                            Height (pt)
                                        </label>
                                        <input
                                            type="number"
                                            min={400}
                                            max={2000}
                                            value={canvasHeight}
                                            onChange={(e) => {
                                                const h = Number(e.target.value) || 595;
                                                updateDesignWithHistory({
                                                    ...design,
                                                    page: {
                                                        width: canvasWidth,
                                                        height: h,
                                                        orientation: canvasWidth >= h ? "landscape" : "portrait",
                                                        unit: "pt",
                                                    },
                                                });
                                            }}
                                            className="w-full p-1.5 text-xs font-bold border-2 border-black rounded-lg"
                                        />
                                    </div>
                                </div>

                                {/* Background Color Swatches */}
                                <div className="space-y-2 border-t border-black/10 pt-3">
                                    <label className="text-xs font-bold text-neutral-700 block mb-1">
                                        Background Color
                                    </label>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        {[
                                            { label: "Pure White", color: "#FFFFFF" },
                                            { label: "Ivory", color: "#FAF6EE" },
                                            { label: "Soft Cloud", color: "#F8FAFC" },
                                            { label: "Canary", color: "#FFE566" },
                                            { label: "Mint", color: "#DCFCE7" },
                                            { label: "Lavender", color: "#F3E8FF" },
                                            { label: "Obsidian", color: "#0F172A" },
                                        ].map((swatch) => (
                                            <button
                                                key={swatch.color}
                                                type="button"
                                                onClick={() =>
                                                    updateDesignWithHistory({
                                                        ...design,
                                                        background: { ...design.background, color: swatch.color },
                                                    })
                                                }
                                                className={`w-6 h-6 rounded-md border-2 border-black ${
                                                    (design.background.color || "#FFFFFF") === swatch.color
                                                        ? "ring-2 ring-blue-600 scale-110 shadow-sm"
                                                        : ""
                                                }`}
                                                style={{ backgroundColor: swatch.color }}
                                                title={swatch.label}
                                            />
                                        ))}

                                        <input
                                            type="color"
                                            value={design.background.color || "#FFFFFF"}
                                            onChange={(e) =>
                                                updateDesignWithHistory({
                                                    ...design,
                                                    background: { ...design.background, color: e.target.value },
                                                })
                                            }
                                            className="w-7 h-6 rounded border-2 border-black cursor-pointer ml-1"
                                        />
                                    </div>
                                </div>

                                {/* Decorative Border Style */}
                                <div className="space-y-3 border-t border-black/10 pt-3">
                                    <div>
                                        <label className="text-xs font-bold text-neutral-700 block mb-1">
                                            Decorative Border Style
                                        </label>
                                        <select
                                            value={design.background.borderStyle || "double"}
                                            onChange={(e) =>
                                                updateDesignWithHistory({
                                                    ...design,
                                                    background: { ...design.background, borderStyle: e.target.value as any },
                                                })
                                            }
                                            className="w-full p-2 text-xs font-bold border-2 border-black rounded-lg bg-white"
                                        >
                                            <option value="double">Classic Double Frame</option>
                                            <option value="solid">Bold Solid Frame</option>
                                            <option value="ornate">Gold / Ornate Corners Frame</option>
                                            <option value="modern">Modern Top Accent Bar</option>
                                            <option value="neo-brutalist">Neo-Brutalist High-Contrast</option>
                                            <option value="none">No Border (Full Bleed)</option>
                                        </select>
                                    </div>

                                    {/* Border Width Slider */}
                                    {design.background.borderStyle !== "none" && (
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[11px] font-bold text-neutral-600">
                                                    Border Width
                                                </label>
                                                <span className="text-xs font-mono font-bold text-black">
                                                    {design.background.borderWidth || 6} pt
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min={1}
                                                max={20}
                                                value={design.background.borderWidth || 6}
                                                onChange={(e) =>
                                                    updateDesignWithHistory({
                                                        ...design,
                                                        background: { ...design.background, borderWidth: Number(e.target.value) },
                                                    })
                                                }
                                                className="w-full accent-black cursor-pointer"
                                            />
                                        </div>
                                    )}

                                    {/* Border Color */}
                                    <div>
                                        <label className="text-xs font-bold text-neutral-700 block mb-1">
                                            Border Color
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={design.background.borderColor || "#0F172A"}
                                                onChange={(e) =>
                                                    updateDesignWithHistory({
                                                        ...design,
                                                        background: { ...design.background, borderColor: e.target.value },
                                                    })
                                                }
                                                className="w-8 h-8 rounded-lg border-2 border-black cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={design.background.borderColor || "#0F172A"}
                                                onChange={(e) =>
                                                    updateDesignWithHistory({
                                                        ...design,
                                                        background: { ...design.background, borderColor: e.target.value },
                                                    })
                                                }
                                                className="flex-1 p-1.5 text-xs font-mono font-bold border-2 border-black rounded-lg uppercase"
                                            />
                                        </div>
                                    </div>

                                    {/* Accent Color */}
                                    <div>
                                        <label className="text-xs font-bold text-neutral-700 block mb-1">
                                            Accent Color
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={design.background.accentColor || "#FFE566"}
                                                onChange={(e) =>
                                                    updateDesignWithHistory({
                                                        ...design,
                                                        background: { ...design.background, accentColor: e.target.value },
                                                    })
                                                }
                                                className="w-8 h-8 rounded-lg border-2 border-black cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={design.background.accentColor || "#FFE566"}
                                                onChange={(e) =>
                                                    updateDesignWithHistory({
                                                        ...design,
                                                        background: { ...design.background, accentColor: e.target.value },
                                                    })
                                                }
                                                className="flex-1 p-1.5 text-xs font-mono font-bold border-2 border-black rounded-lg uppercase"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* CENTER PANEL: Interactive Canvas Workspace with Drag & Drop */}
                <div
                    ref={canvasContainerRef}
                    className="flex-1 bg-neutral-200 overflow-auto p-8 flex items-center justify-center select-none relative"
                    onMouseDown={handleMouseDownCanvas}
                    onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "copy";
                    }}
                    onDrop={handleDropCanvas}
                >
                    <div
                        ref={canvasRef}
                        style={{
                            width: `${canvasWidth * zoom}px`,
                            height: `${canvasHeight * zoom}px`,
                        }}
                        className="relative bg-white shadow-2xl border-4 border-black transition-all shrink-0 origin-center"
                    >
                        {/* Dot Grid Pattern Layer */}
                        {showGrid && (
                            <div
                                className="absolute inset-0 pointer-events-none z-0"
                                style={{
                                    backgroundImage: "radial-gradient(#000000 1px, transparent 1px)",
                                    backgroundSize: `${20 * zoom}px ${20 * zoom}px`,
                                    opacity: 0.18,
                                }}
                            />
                        )}

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
                            {/* Visual decorative border */}
                            {design.background.borderStyle === "double" && (
                                <div
                                    className="absolute inset-2 sm:inset-3 border-2"
                                    style={{
                                        borderColor: design.background.borderColor || "#0F172A",
                                    }}
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
                                        style={{
                                            backgroundColor: design.background.accentColor || "#2563EB",
                                        }}
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
                                            style={{
                                                backgroundColor: design.background.accentColor || "#FFE566",
                                            }}
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

                        {/* Alignment Guides Lines */}
                        {activeGuides?.x !== undefined && (
                            <div
                                className="absolute top-0 bottom-0 pointer-events-none z-40 border-l-2 border-dashed border-pink-500"
                                style={{ left: `${activeGuides.x * zoom}px` }}
                            />
                        )}
                        {activeGuides?.y !== undefined && (
                            <div
                                className="absolute left-0 right-0 pointer-events-none z-40 border-t-2 border-dashed border-pink-500"
                                style={{ top: `${activeGuides.y * zoom}px` }}
                            />
                        )}

                        {/* Rendered Elements */}
                        {design.elements.map((elem) => {
                            if (elem.isHidden) return null;

                            const isSelected = selectedElementIds.includes(elem.id);
                            const isSingleSelected = isSelected && selectedElementIds.length === 1;
                            const left = elem.x * zoom;
                            const top = elem.y * zoom;
                            const width = elem.width * zoom;
                            const height = elem.height * zoom;
                            const rotation = elem.rotation || 0;

                            const displayText = getRenderedDisplayText(elem);

                            // Dynamic auto-scaling font calculation for shrink fitPolicy
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
                                    onMouseDown={(e) => handleMouseDownElement(e, elem)}
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
                                    className={`cursor-move flex items-center justify-center select-none ${
                                        isSelected
                                            ? "ring-2 ring-blue-600 ring-offset-2 ring-offset-white border-2 border-blue-600 bg-blue-50/10"
                                            : "hover:outline hover:outline-1 hover:outline-black/40 hover:outline-dashed"
                                    }`}
                                >
                                    {/* Lock badge */}
                                    {elem.isLocked && (
                                        <div className="absolute top-0.5 right-0.5 p-0.5 bg-black text-[#FFE566] rounded pointer-events-none z-30">
                                            <Lock className="w-2.5 h-2.5" />
                                        </div>
                                    )}

                                    {/* Content based on element type */}
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
                                                    alt="Certificate media"
                                                    className={`w-full h-full pointer-events-none ${
                                                        elem.imageFit === "cover" ? "object-cover" : "object-contain"
                                                    }`}
                                                    style={{ borderRadius: elem.style?.borderRadius ? `${elem.style.borderRadius * zoom}px` : 0 }}
                                                />
                                            ) : (
                                                <div className="w-full h-full border-2 border-dashed border-neutral-400 bg-neutral-100/90 flex flex-col items-center justify-center text-neutral-500 p-1 pointer-events-none select-none">
                                                    <ImageIcon className="w-5 h-5 mb-0.5 opacity-60" />
                                                    <span className="text-[9px] font-bold">Image / Logo</span>
                                                </div>
                                            )}
                                        </div>
                                    ) : elem.type === "signature" ? (
                                        <div className="w-full h-full flex flex-col justify-end items-center pointer-events-none select-none pb-0.5">
                                            {elem.signatureUrl && (
                                                <img
                                                    src={elem.signatureUrl}
                                                    alt="signature"
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
                                                {elem.signerName || "Authorized Signatory"}
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

                                    {/* 8 Resize Handles & Rotation Handle */}
                                    {isSingleSelected && !elem.isLocked && (
                                        <>
                                            {/* Rotation Stalk and Handle */}
                                            <div
                                                className="absolute -top-7 left-1/2 -translate-x-1/2 flex flex-col items-center z-50 cursor-grab active:cursor-grabbing"
                                                onMouseDown={(e) => handleMouseDownRotate(e, elem)}
                                                title="Drag to Rotate (Hold Shift for 15° snap)"
                                            >
                                                <div className="w-5 h-5 rounded-full bg-white border-2 border-blue-600 flex items-center justify-center shadow-md hover:bg-blue-50">
                                                    <RotateCw className="w-3 h-3 text-blue-600" />
                                                </div>
                                                <div className="w-0.5 h-2 bg-blue-600" />
                                                {rotatingInfo?.elemId === elem.id && (
                                                    <div className="absolute -top-6 px-1.5 py-0.5 bg-black text-white text-[10px] font-mono font-bold rounded shadow pointer-events-none">
                                                        {rotatingInfo.currentAngle}°
                                                    </div>
                                                )}
                                            </div>

                                            {/* 8 Handles */}
                                            <div
                                                onMouseDown={(e) => handleMouseDownResize(e, elem, "nw")}
                                                className="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 cursor-nwse-resize z-50 rounded-xs shadow-sm hover:scale-125"
                                            />
                                            <div
                                                onMouseDown={(e) => handleMouseDownResize(e, elem, "n")}
                                                className="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-blue-600 cursor-ns-resize z-50 rounded-xs shadow-sm hover:scale-125"
                                            />
                                            <div
                                                onMouseDown={(e) => handleMouseDownResize(e, elem, "ne")}
                                                className="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 cursor-nesw-resize z-50 rounded-xs shadow-sm hover:scale-125"
                                            />
                                            <div
                                                onMouseDown={(e) => handleMouseDownResize(e, elem, "e")}
                                                className="absolute top-1/2 -translate-y-1/2 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 cursor-ew-resize z-50 rounded-xs shadow-sm hover:scale-125"
                                            />
                                            <div
                                                onMouseDown={(e) => handleMouseDownResize(e, elem, "se")}
                                                className="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border-2 border-blue-600 cursor-nwse-resize z-50 rounded-xs shadow-sm hover:scale-125"
                                            />
                                            <div
                                                onMouseDown={(e) => handleMouseDownResize(e, elem, "s")}
                                                className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white border-2 border-blue-600 cursor-ns-resize z-50 rounded-xs shadow-sm hover:scale-125"
                                            />
                                            <div
                                                onMouseDown={(e) => handleMouseDownResize(e, elem, "sw")}
                                                className="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 cursor-nesw-resize z-50 rounded-xs shadow-sm hover:scale-125"
                                            />
                                            <div
                                                onMouseDown={(e) => handleMouseDownResize(e, elem, "w")}
                                                className="absolute top-1/2 -translate-y-1/2 -left-1.5 w-3 h-3 bg-white border-2 border-blue-600 cursor-ew-resize z-50 rounded-xs shadow-sm hover:scale-125"
                                            />
                                        </>
                                    )}
                                </div>
                            );
                        })}

                        {/* Marquee Selection Rectangle */}
                        {marquee && (
                            <div
                                className="absolute pointer-events-none border-2 border-blue-600 bg-blue-500/15 z-50"
                                style={{
                                    left: `${Math.min(marquee.startX, marquee.currentX) * zoom}px`,
                                    top: `${Math.min(marquee.startY, marquee.currentY) * zoom}px`,
                                    width: `${Math.abs(marquee.currentX - marquee.startX) * zoom}px`,
                                    height: `${Math.abs(marquee.currentY - marquee.startY) * zoom}px`,
                                }}
                            />
                        )}
                    </div>
                </div>

                {/* RIGHT PANEL: Property Inspector */}
                <div className="w-80 bg-white border-l-3 border-black flex flex-col shrink-0 overflow-y-auto p-4 space-y-4">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b-2 border-black/15 pb-2">
                        <h4 className="text-xs font-black text-black uppercase tracking-wider flex items-center gap-1.5">
                            <Sliders className="w-4 h-4 text-black" />
                            <span>Properties</span>
                        </h4>

                        {selectedElements.length > 0 && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => toggleLock(selectedElementIds)}
                                    className="p-1 rounded-md border border-black hover:bg-neutral-100"
                                    title={selectedElements.some((e) => e.isLocked) ? "Unlock" : "Lock"}
                                >
                                    {selectedElements.some((e) => e.isLocked) ? <Unlock className="w-3.5 h-3.5 text-black" /> : <Lock className="w-3.5 h-3.5 text-black" />}
                                </button>
                                <button
                                    onClick={() => toggleHide(selectedElementIds)}
                                    className="p-1 rounded-md border border-black hover:bg-neutral-100"
                                    title="Hide / Show"
                                >
                                    <Eye className="w-3.5 h-3.5 text-black" />
                                </button>
                                <button
                                    onClick={() => duplicateElements(selectedElementIds)}
                                    className="p-1 rounded-md border border-black hover:bg-neutral-100"
                                    title="Duplicate (Ctrl+D)"
                                >
                                    <Copy className="w-3.5 h-3.5 text-black" />
                                </button>
                                <button
                                    onClick={() => deleteElements(selectedElementIds)}
                                    className="p-1 rounded-md border border-black hover:bg-red-50 text-red-600"
                                    title="Delete (Delete / Backspace)"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* MULTI-ELEMENT SELECTION INSPECTOR */}
                    {selectedElements.length > 1 ? (
                        <div className="space-y-4">
                            <div className="p-3 bg-[#FFE566] border-2 border-black rounded-xl shadow-[2px_2px_0px_#000]">
                                <div className="text-xs font-black text-black">
                                    {selectedElements.length} Elements Selected
                                </div>
                                <div className="text-[11px] text-neutral-800 mt-0.5">
                                    Perform batch alignment, movement, locking, or duplicate operations.
                                </div>
                            </div>

                            {/* Batch Alignment Tools */}
                            <div className="space-y-2 border-t border-black/10 pt-3">
                                <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                                    Batch Alignment
                                </label>
                                <div className="grid grid-cols-3 gap-1.5">
                                    <button
                                        onClick={() => alignElements("left")}
                                        className="py-1 px-2 border-2 border-black rounded-lg text-xs font-bold hover:bg-neutral-100 flex items-center justify-center gap-1"
                                    >
                                        <AlignLeft className="w-3.5 h-3.5" />
                                        <span>Lefts</span>
                                    </button>
                                    <button
                                        onClick={() => alignElements("center-h")}
                                        className="py-1 px-2 border-2 border-black rounded-lg text-xs font-bold hover:bg-neutral-100 flex items-center justify-center gap-1"
                                    >
                                        <AlignCenter className="w-3.5 h-3.5" />
                                        <span>Center</span>
                                    </button>
                                    <button
                                        onClick={() => alignElements("right")}
                                        className="py-1 px-2 border-2 border-black rounded-lg text-xs font-bold hover:bg-neutral-100 flex items-center justify-center gap-1"
                                    >
                                        <AlignRight className="w-3.5 h-3.5" />
                                        <span>Rights</span>
                                    </button>
                                    <button
                                        onClick={() => alignElements("top")}
                                        className="py-1 px-2 border-2 border-black rounded-lg text-xs font-bold hover:bg-neutral-100 flex items-center justify-center gap-1"
                                    >
                                        <span>Top</span>
                                    </button>
                                    <button
                                        onClick={() => alignElements("center-v")}
                                        className="py-1 px-2 border-2 border-black rounded-lg text-xs font-bold hover:bg-neutral-100 flex items-center justify-center gap-1"
                                    >
                                        <span>Middle</span>
                                    </button>
                                    <button
                                        onClick={() => alignElements("bottom")}
                                        className="py-1 px-2 border-2 border-black rounded-lg text-xs font-bold hover:bg-neutral-100 flex items-center justify-center gap-1"
                                    >
                                        <span>Bottom</span>
                                    </button>
                                </div>
                            </div>

                            {/* Batch Actions */}
                            <div className="space-y-2 border-t border-black/10 pt-3">
                                <button
                                    onClick={() => duplicateElements(selectedElementIds)}
                                    className="w-full py-2 rounded-xl border-2 border-black bg-white hover:bg-neutral-50 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-2"
                                >
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>Duplicate All Selected</span>
                                </button>
                                <button
                                    onClick={() => deleteElements(selectedElementIds)}
                                    className="w-full py-2 rounded-xl border-2 border-black bg-red-50 hover:bg-red-100 text-red-700 text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-2"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete All Selected</span>
                                </button>
                            </div>
                        </div>
                    ) : selectedElement ? (
                        /* SINGLE ELEMENT INSPECTOR */
                        <div className="space-y-4">
                            {/* Type badge & Layer Ordering */}
                            <div className="flex items-center justify-between gap-2">
                                <div className="px-2.5 py-1.5 rounded-xl bg-[#FAF6EE] border-2 border-black text-xs font-bold text-neutral-700 flex items-center justify-between flex-1">
                                    <span>Element Type</span>
                                    <span className="font-black text-black uppercase">{selectedElement.type}</span>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => bringElementToFront(selectedElement.id)}
                                        className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 shadow-[1.5px_1.5px_0px_#000]"
                                        title="Bring to Front"
                                    >
                                        <ArrowUp className="w-3.5 h-3.5 text-black" />
                                    </button>
                                    <button
                                        onClick={() => sendElementToBack(selectedElement.id)}
                                        className="p-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 shadow-[1.5px_1.5px_0px_#000]"
                                        title="Send to Back"
                                    >
                                        <ArrowDown className="w-3.5 h-3.5 text-black" />
                                    </button>
                                </div>
                            </div>

                            {/* Canvas Alignment Quick Actions */}
                            <div>
                                <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                                    Align to Canvas
                                </label>
                                <div className="grid grid-cols-3 gap-1">
                                    <button
                                        onClick={() => alignElements("left")}
                                        className="py-1 text-[11px] font-bold border border-black rounded hover:bg-neutral-100"
                                        title="Align Left"
                                    >
                                        Left
                                    </button>
                                    <button
                                        onClick={() => alignElements("center-h")}
                                        className="py-1 text-[11px] font-bold border border-black rounded hover:bg-neutral-100"
                                        title="Center Horizontally"
                                    >
                                        Center X
                                    </button>
                                    <button
                                        onClick={() => alignElements("right")}
                                        className="py-1 text-[11px] font-bold border border-black rounded hover:bg-neutral-100"
                                        title="Align Right"
                                    >
                                        Right
                                    </button>
                                    <button
                                        onClick={() => alignElements("top")}
                                        className="py-1 text-[11px] font-bold border border-black rounded hover:bg-neutral-100"
                                        title="Align Top"
                                    >
                                        Top
                                    </button>
                                    <button
                                        onClick={() => alignElements("center-v")}
                                        className="py-1 text-[11px] font-bold border border-black rounded hover:bg-neutral-100"
                                        title="Center Vertically"
                                    >
                                        Center Y
                                    </button>
                                    <button
                                        onClick={() => alignElements("bottom")}
                                        className="py-1 text-[11px] font-bold border border-black rounded hover:bg-neutral-100"
                                        title="Align Bottom"
                                    >
                                        Bottom
                                    </button>
                                </div>
                            </div>

                            {/* Phase 6.3: Advanced Dynamic Field Properties & Data Mapping */}
                            {selectedElement.type === "dynamic-text" && (
                                <div className="space-y-3 border-t border-black/10 pt-3">
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-xs font-bold text-neutral-700">
                                                Data Field Token
                                            </label>
                                            <span className="text-[10px] font-mono text-neutral-500">
                                                {"{{"}{selectedElement.fieldKey}{"}}"}
                                            </span>
                                        </div>
                                        <select
                                            value={selectedElement.fieldKey || "recipient.name"}
                                            onChange={(e) => {
                                                const key = e.target.value;
                                                const def = allDynamicFields.find((f) => f.key === key);
                                                updateElement(selectedElement.id, {
                                                    fieldKey: key,
                                                    fallbackValue: def?.sampleValue || "Sample",
                                                    dataType: def?.dataType || "text",
                                                });
                                            }}
                                            className="w-full p-2 text-xs font-bold border-2 border-black rounded-lg bg-white"
                                        >
                                            <optgroup label="Recipient Data">
                                                {allDynamicFields.filter((f) => f.category === "recipient").map((f) => (
                                                    <option key={f.key} value={f.key}>{f.label} ({f.key})</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Event Data">
                                                {allDynamicFields.filter((f) => f.category === "event").map((f) => (
                                                    <option key={f.key} value={f.key}>{f.label} ({f.key})</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Achievement & Award">
                                                {allDynamicFields.filter((f) => f.category === "achievement").map((f) => (
                                                    <option key={f.key} value={f.key}>{f.label} ({f.key})</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Team Data">
                                                {allDynamicFields.filter((f) => f.category === "team").map((f) => (
                                                    <option key={f.key} value={f.key}>{f.label} ({f.key})</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Issuance & Credentials">
                                                {allDynamicFields.filter((f) => f.category === "issuance").map((f) => (
                                                    <option key={f.key} value={f.key}>{f.label} ({f.key})</option>
                                                ))}
                                            </optgroup>
                                            <optgroup label="Club Data">
                                                {allDynamicFields.filter((f) => f.category === "club").map((f) => (
                                                    <option key={f.key} value={f.key}>{f.label} ({f.key})</option>
                                                ))}
                                            </optgroup>
                                            {(design.customAttributes || []).length > 0 && (
                                                <optgroup label="Club Custom Attributes">
                                                    {(design.customAttributes || []).map((f) => (
                                                        <option key={f.key} value={f.key}>{f.label} ({f.key})</option>
                                                    ))}
                                                </optgroup>
                                            )}
                                        </select>
                                    </div>

                                    {/* Fallback Preview Value */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-[11px] font-bold text-neutral-600">
                                                Fallback Value
                                            </label>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const def = allDynamicFields.find((f) => f.key === selectedElement.fieldKey);
                                                    if (def?.sampleValue) {
                                                        updateElement(selectedElement.id, { fallbackValue: def.sampleValue });
                                                    }
                                                }}
                                                className="text-[10px] text-blue-600 hover:underline font-bold"
                                            >
                                                Reset to Default
                                            </button>
                                        </div>
                                        <input
                                            type="text"
                                            value={selectedElement.fallbackValue || ""}
                                            onChange={(e) => updateElement(selectedElement.id, { fallbackValue: e.target.value })}
                                            className="w-full p-2 text-xs font-bold border-2 border-black rounded-lg bg-white"
                                            placeholder="Sample text when recipient data missing"
                                        />
                                    </div>

                                    {/* Required Field Checkbox (Phase 6.4) */}
                                    <label className="flex items-center gap-2 p-2 rounded-lg border border-black/20 bg-[#FAF6EE] cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={!!selectedElement.isRequired}
                                            onChange={(e) => updateElement(selectedElement.id, { isRequired: e.target.checked })}
                                            className="accent-black w-4 h-4 cursor-pointer rounded"
                                        />
                                        <div>
                                            <div className="text-xs font-black text-black">Required for Issuance</div>
                                            <div className="text-[10px] text-neutral-600">Flag error if recipient record lacks this field</div>
                                        </div>
                                    </label>

                                    {/* Auto-fit and Overflow Policy (Phase 6.3) */}
                                    <div>
                                        <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                                            Overflow &amp; Auto-fit Policy
                                        </label>
                                        <div className="grid grid-cols-3 border-2 border-black rounded-lg overflow-hidden bg-white">
                                            {(["shrink", "wrap", "warn"] as const).map((policy) => (
                                                <button
                                                    key={policy}
                                                    type="button"
                                                    onClick={() => updateElement(selectedElement.id, { fitPolicy: policy })}
                                                    className={`py-1 text-xs font-black capitalize ${
                                                        (selectedElement.fitPolicy || "shrink") === policy
                                                            ? "bg-[#FFE566] text-black"
                                                            : "hover:bg-neutral-100 text-neutral-600"
                                                    }`}
                                                >
                                                    {policy}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Min font size slider for shrink policy */}
                                    {(selectedElement.fitPolicy || "shrink") === "shrink" && (
                                        <div>
                                            <div className="flex items-center justify-between mb-1">
                                                <label className="text-[11px] font-bold text-neutral-600">
                                                    Minimum Auto-scale Font Size
                                                </label>
                                                <span className="text-xs font-mono font-bold text-black">
                                                    {selectedElement.minFontSize || 10} pt
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min={8}
                                                max={24}
                                                value={selectedElement.minFontSize || 10}
                                                onChange={(e) =>
                                                    updateElement(selectedElement.id, { minFontSize: Number(e.target.value) })
                                                }
                                                className="w-full accent-black cursor-pointer"
                                            />
                                        </div>
                                    )}

                                    {/* Test with Indian / Long names (Phase 6.3) */}
                                    <div className="p-2 rounded-lg border border-black/20 bg-white space-y-1.5">
                                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider block">
                                            Quick Auto-Fit Testing
                                        </span>
                                        <div className="flex items-center gap-1.5">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    updateElement(selectedElement.id, {
                                                        fallbackValue: "Shri Venkata Ramana Murthy Ramanathan",
                                                    })
                                                }
                                                className="flex-1 py-1 px-1.5 rounded border border-black text-[10px] font-bold bg-[#FAF6EE] hover:bg-[#FFE566] truncate text-center"
                                                title="Test with long Indian name"
                                            >
                                                Test Long Name
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    updateElement(selectedElement.id, {
                                                        fallbackValue: "Aarav Sharma",
                                                    })
                                                }
                                                className="py-1 px-2 rounded border border-black text-[10px] font-bold bg-white hover:bg-neutral-100"
                                                title="Reset to standard name"
                                            >
                                                Standard
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Static Text Content */}
                            {selectedElement.type === "static-text" && (
                                <div>
                                    <label className="text-xs font-bold text-neutral-700 block mb-1">
                                        Text Content
                                    </label>
                                    <textarea
                                        value={selectedElement.text || ""}
                                        onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })}
                                        rows={3}
                                        className="w-full p-2 text-xs font-bold border-2 border-black rounded-lg bg-white resize-none"
                                    />
                                </div>
                            )}

                            {/* Typography Controls for Text Elements */}
                            {(selectedElement.type === "static-text" || selectedElement.type === "dynamic-text") && (
                                <div className="space-y-3 border-t border-black/10 pt-3">
                                    {/* Font Family Selector */}
                                    <div>
                                        <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                                            Font Family
                                        </label>
                                        <select
                                            value={selectedElement.style?.fontFamily || "Inter"}
                                            onChange={(e) =>
                                                updateElement(selectedElement.id, {
                                                    style: { ...selectedElement.style, fontFamily: e.target.value },
                                                })
                                            }
                                            className="w-full p-1.5 text-xs font-bold border-2 border-black rounded-lg bg-white"
                                        >
                                            <option value="Inter">Inter (Clean Sans)</option>
                                            <option value="Playfair Display">Playfair Display (Formal Serif)</option>
                                            <option value="Space Grotesk">Space Grotesk (Neo-Brutalist Display)</option>
                                            <option value="Courier Prime">Courier Prime (Monospace)</option>
                                        </select>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2">
                                        <div>
                                            <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                                                Font Size
                                            </label>
                                            <input
                                                type="number"
                                                min={8}
                                                max={80}
                                                value={selectedElement.style?.fontSize || 14}
                                                onChange={(e) =>
                                                    updateElement(selectedElement.id, {
                                                        style: { ...selectedElement.style, fontSize: Number(e.target.value) },
                                                    })
                                                }
                                                className="w-full p-1.5 text-xs font-bold border-2 border-black rounded-lg"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                                                Weight
                                            </label>
                                            <select
                                                value={selectedElement.style?.fontWeight || "normal"}
                                                onChange={(e) =>
                                                    updateElement(selectedElement.id, {
                                                        style: { ...selectedElement.style, fontWeight: e.target.value as any },
                                                    })
                                                }
                                                className="w-full p-1.5 text-xs font-bold border-2 border-black rounded-lg bg-white"
                                            >
                                                <option value="normal">Normal (400)</option>
                                                <option value="bold">Bold (700)</option>
                                                <option value="black">Black (900)</option>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Text Alignment */}
                                    <div>
                                        <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                                            Text Alignment
                                        </label>
                                        <div className="grid grid-cols-4 border-2 border-black rounded-lg overflow-hidden bg-white">
                                            {(["left", "center", "right", "justify"] as const).map((align) => (
                                                <button
                                                    key={align}
                                                    type="button"
                                                    onClick={() =>
                                                        updateElement(selectedElement.id, {
                                                            style: { ...selectedElement.style, textAlign: align as any },
                                                        })
                                                    }
                                                    className={`py-1 text-xs font-black capitalize flex items-center justify-center ${
                                                        (selectedElement.style?.textAlign || "center") === align
                                                            ? "bg-[#FFE566] text-black"
                                                            : "hover:bg-neutral-100 text-neutral-600"
                                                    }`}
                                                >
                                                    {align === "left" && <AlignLeft className="w-3.5 h-3.5" />}
                                                    {align === "center" && <AlignCenter className="w-3.5 h-3.5" />}
                                                    {align === "right" && <AlignRight className="w-3.5 h-3.5" />}
                                                    {align === "justify" && <AlignJustify className="w-3.5 h-3.5" />}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Letter Spacing */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-[11px] font-bold text-neutral-600">
                                                Letter Spacing
                                            </label>
                                            <span className="text-xs font-mono font-bold text-black">
                                                {selectedElement.style?.letterSpacing || 0} pt
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={-2}
                                            max={12}
                                            value={selectedElement.style?.letterSpacing || 0}
                                            onChange={(e) =>
                                                updateElement(selectedElement.id, {
                                                    style: { ...selectedElement.style, letterSpacing: Number(e.target.value) },
                                                })
                                            }
                                            className="w-full accent-black cursor-pointer"
                                        />
                                    </div>

                                    {/* Line Height */}
                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-[11px] font-bold text-neutral-600">
                                                Line Height
                                            </label>
                                            <span className="text-xs font-mono font-bold text-black">
                                                {selectedElement.style?.lineHeight || 1.3}
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={1.0}
                                            max={2.4}
                                            step={0.1}
                                            value={selectedElement.style?.lineHeight || 1.3}
                                            onChange={(e) =>
                                                updateElement(selectedElement.id, {
                                                    style: { ...selectedElement.style, lineHeight: Number(e.target.value) },
                                                })
                                            }
                                            className="w-full accent-black cursor-pointer"
                                        />
                                    </div>

                                    {/* Text Color */}
                                    <div>
                                        <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                                            Text Color
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={selectedElement.style?.color || "#0F172A"}
                                                onChange={(e) =>
                                                    updateElement(selectedElement.id, {
                                                        style: { ...selectedElement.style, color: e.target.value },
                                                    })
                                                }
                                                className="w-9 h-8 border-2 border-black rounded-lg cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={selectedElement.style?.color || "#0F172A"}
                                                onChange={(e) =>
                                                    updateElement(selectedElement.id, {
                                                        style: { ...selectedElement.style, color: e.target.value },
                                                    })
                                                }
                                                className="flex-1 p-1.5 text-xs font-mono font-bold border-2 border-black rounded-lg uppercase"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Shape Styling Controls */}
                            {selectedElement.type === "shape" && (
                                <div className="space-y-3 border-t border-black/10 pt-3">
                                    <div>
                                        <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                                            Fill Color
                                        </label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="color"
                                                value={selectedElement.style?.backgroundColor || "#0F172A"}
                                                onChange={(e) =>
                                                    updateElement(selectedElement.id, {
                                                        style: { ...selectedElement.style, backgroundColor: e.target.value },
                                                    })
                                                }
                                                className="w-8 h-8 rounded-lg border-2 border-black cursor-pointer"
                                            />
                                            <input
                                                type="text"
                                                value={selectedElement.style?.backgroundColor || "#0F172A"}
                                                onChange={(e) =>
                                                    updateElement(selectedElement.id, {
                                                        style: { ...selectedElement.style, backgroundColor: e.target.value },
                                                    })
                                                }
                                                className="flex-1 p-1.5 text-xs font-mono font-bold border-2 border-black rounded-lg uppercase"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-[11px] font-bold text-neutral-600">
                                                Border Width
                                            </label>
                                            <span className="text-xs font-mono font-bold text-black">
                                                {selectedElement.style?.borderWidth || 0} pt
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={12}
                                            value={selectedElement.style?.borderWidth || 0}
                                            onChange={(e) =>
                                                updateElement(selectedElement.id, {
                                                    style: { ...selectedElement.style, borderWidth: Number(e.target.value) },
                                                })
                                            }
                                            className="w-full accent-black cursor-pointer"
                                        />
                                    </div>

                                    {(selectedElement.style?.borderWidth || 0) > 0 && (
                                        <div>
                                            <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                                                Border Color
                                            </label>
                                            <input
                                                type="color"
                                                value={selectedElement.style?.borderColor || "#000000"}
                                                onChange={(e) =>
                                                    updateElement(selectedElement.id, {
                                                        style: { ...selectedElement.style, borderColor: e.target.value },
                                                    })
                                                }
                                                className="w-full h-8 rounded-lg border-2 border-black cursor-pointer"
                                            />
                                        </div>
                                    )}

                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-[11px] font-bold text-neutral-600">
                                                Corner Radius
                                            </label>
                                            <span className="text-xs font-mono font-bold text-black">
                                                {selectedElement.style?.borderRadius || 0} px
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={0}
                                            max={50}
                                            value={selectedElement.style?.borderRadius || 0}
                                            onChange={(e) =>
                                                updateElement(selectedElement.id, {
                                                    style: { ...selectedElement.style, borderRadius: Number(e.target.value) },
                                                })
                                            }
                                            className="w-full accent-black cursor-pointer"
                                        />
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-1">
                                            <label className="text-[11px] font-bold text-neutral-600">
                                                Opacity
                                            </label>
                                            <span className="text-xs font-mono font-bold text-black">
                                                {Math.round((selectedElement.style?.opacity ?? 1) * 100)}%
                                            </span>
                                        </div>
                                        <input
                                            type="range"
                                            min={10}
                                            max={100}
                                            value={Math.round((selectedElement.style?.opacity ?? 1) * 100)}
                                            onChange={(e) =>
                                                updateElement(selectedElement.id, {
                                                    style: { ...selectedElement.style, opacity: Number(e.target.value) / 100 },
                                                })
                                            }
                                            className="w-full accent-black cursor-pointer"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Badge Controls */}
                            {selectedElement.type === "badge" && (
                                <div className="space-y-3 border-t border-black/10 pt-3">
                                    <div>
                                        <label className="text-xs font-bold text-neutral-700 block mb-1">
                                            Badge Label
                                        </label>
                                        <input
                                            type="text"
                                            value={selectedElement.text || "1ST"}
                                            onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })}
                                            className="w-full p-2 text-xs font-bold border-2 border-black rounded-lg bg-white"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                                            Badge Color
                                        </label>
                                        <input
                                            type="color"
                                            value={selectedElement.style?.backgroundColor || "#F59E0B"}
                                            onChange={(e) =>
                                                updateElement(selectedElement.id, {
                                                    style: { ...selectedElement.style, backgroundColor: e.target.value },
                                                })
                                            }
                                            className="w-full h-8 rounded-lg border-2 border-black cursor-pointer"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Image Controls */}
                            {selectedElement.type === "image" && (
                                <div className="space-y-3 border-t border-black/10 pt-3">
                                    <div>
                                        <label className="text-xs font-bold text-neutral-700 block mb-1">
                                            Image URL
                                        </label>
                                        <input
                                            type="text"
                                            value={selectedElement.imageUrl || ""}
                                            onChange={(e) => updateElement(selectedElement.id, { imageUrl: e.target.value })}
                                            className="w-full p-2 text-xs font-mono font-bold border-2 border-black rounded-lg bg-white"
                                            placeholder="https://... or upload below"
                                        />
                                    </div>

                                    <div>
                                        <label className="w-full py-2 px-3 rounded-lg border-2 border-black bg-[#FFE566] hover:bg-[#FDD835] text-xs font-black shadow-[2px_2px_0px_#000] flex items-center justify-center gap-1.5 cursor-pointer">
                                            <Upload className="w-3.5 h-3.5 text-black" />
                                            <span>Upload Logo / Crest</span>
                                            <input
                                                type="file"
                                                accept="image/png,image/jpeg,image/svg+xml"
                                                className="hidden"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (!file) return;
                                                    const reader = new FileReader();
                                                    reader.onload = (evt) => {
                                                        const result = evt.target?.result as string;
                                                        if (result) {
                                                            updateElement(selectedElement.id, { imageUrl: result });
                                                            toast.success(`Loaded image "${file.name}"`);
                                                        }
                                                    };
                                                    reader.readAsDataURL(file);
                                                }}
                                            />
                                        </label>
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                                            Object Fit
                                        </label>
                                        <div className="grid grid-cols-2 border-2 border-black rounded-lg overflow-hidden bg-white">
                                            {(["contain", "cover"] as const).map((fit) => (
                                                <button
                                                    key={fit}
                                                    type="button"
                                                    onClick={() => updateElement(selectedElement.id, { imageFit: fit })}
                                                    className={`py-1 text-xs font-black capitalize ${
                                                        (selectedElement.imageFit || "contain") === fit
                                                            ? "bg-[#FFE566] text-black"
                                                            : "hover:bg-neutral-100 text-neutral-600"
                                                    }`}
                                                >
                                                    {fit}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Signature Controls */}
                            {selectedElement.type === "signature" && (
                                <div className="space-y-3 border-t border-black/10 pt-3">
                                    <div>
                                        <label className="text-xs font-bold text-neutral-700 block mb-1">
                                            Signer Full Name
                                        </label>
                                        <input
                                            type="text"
                                            value={selectedElement.signerName || "Prof. Rajesh Verma"}
                                            onChange={(e) => updateElement(selectedElement.id, { signerName: e.target.value })}
                                            className="w-full p-2 text-xs font-bold border-2 border-black rounded-lg bg-white"
                                            placeholder="e.g. Prof. Rajesh Verma"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-xs font-bold text-neutral-700 block mb-1">
                                            Signer Title / Role
                                        </label>
                                        <input
                                            type="text"
                                            value={selectedElement.signerTitle || "Faculty Coordinator"}
                                            onChange={(e) => updateElement(selectedElement.id, { signerTitle: e.target.value })}
                                            className="w-full p-2 text-xs font-bold border-2 border-black rounded-lg bg-white"
                                            placeholder="e.g. Head of Department"
                                        />
                                    </div>

                                    <div>
                                        <label className="text-[11px] font-bold text-neutral-600 block mb-1">
                                            Line Color
                                        </label>
                                        <input
                                            type="color"
                                            value={selectedElement.style?.borderColor || "#000000"}
                                            onChange={(e) =>
                                                updateElement(selectedElement.id, {
                                                    style: { ...selectedElement.style, borderColor: e.target.value },
                                                })
                                            }
                                            className="w-full h-8 rounded-lg border-2 border-black cursor-pointer"
                                        />
                                    </div>
                                </div>
                            )}

                            {/* Position, Geometry & Rotation */}
                            <div className="border-t border-black/10 pt-3 space-y-3">
                                <label className="text-xs font-bold text-neutral-700 block">
                                    Position &amp; Dimensions (pt)
                                </label>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                    <div className="flex items-center gap-1 border-2 border-black rounded-lg p-1.5 bg-white">
                                        <span className="font-bold text-neutral-500">X:</span>
                                        <input
                                            type="number"
                                            value={selectedElement.x}
                                            onChange={(e) => updateElement(selectedElement.id, { x: Number(e.target.value) })}
                                            className="w-full font-bold focus:outline-none"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1 border-2 border-black rounded-lg p-1.5 bg-white">
                                        <span className="font-bold text-neutral-500">Y:</span>
                                        <input
                                            type="number"
                                            value={selectedElement.y}
                                            onChange={(e) => updateElement(selectedElement.id, { y: Number(e.target.value) })}
                                            className="w-full font-bold focus:outline-none"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1 border-2 border-black rounded-lg p-1.5 bg-white">
                                        <span className="font-bold text-neutral-500">W:</span>
                                        <input
                                            type="number"
                                            value={selectedElement.width}
                                            onChange={(e) => updateElement(selectedElement.id, { width: Number(e.target.value) })}
                                            className="w-full font-bold focus:outline-none"
                                        />
                                    </div>
                                    <div className="flex items-center gap-1 border-2 border-black rounded-lg p-1.5 bg-white">
                                        <span className="font-bold text-neutral-500">H:</span>
                                        <input
                                            type="number"
                                            value={selectedElement.height}
                                            onChange={(e) => updateElement(selectedElement.id, { height: Number(e.target.value) })}
                                            className="w-full font-bold focus:outline-none"
                                        />
                                    </div>
                                </div>

                                {/* Rotation Angle Input & Slider */}
                                <div>
                                    <div className="flex items-center justify-between mb-1">
                                        <label className="text-[11px] font-bold text-neutral-600">
                                            Rotation Angle
                                        </label>
                                        <span className="text-xs font-mono font-bold text-black">
                                            {selectedElement.rotation || 0}&deg;
                                        </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="range"
                                            min={0}
                                            max={360}
                                            value={selectedElement.rotation || 0}
                                            onChange={(e) => updateElement(selectedElement.id, { rotation: Number(e.target.value) })}
                                            className="flex-1 accent-black cursor-pointer"
                                        />
                                        <button
                                            onClick={() => updateElement(selectedElement.id, { rotation: 0 })}
                                            className="px-2 py-0.5 text-[10px] font-black border border-black rounded hover:bg-neutral-100"
                                            title="Reset rotation to 0°"
                                        >
                                            Reset
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ZERO SELECTION OVERVIEW */
                        <div className="flex flex-col items-center justify-center h-80 text-center text-neutral-400 p-4 space-y-3">
                            <Move className="w-10 h-10 opacity-40 stroke-[1.5] text-black" />
                            <div>
                                <div className="text-xs font-black text-neutral-700">No Element Selected</div>
                                <div className="text-[11px] text-neutral-500 mt-1 max-w-[200px]">
                                    Click any text, shape, or badge on the canvas to inspect properties, or drag across canvas to marquee select.
                                </div>
                            </div>

                            <div className="w-full border-t border-black/10 pt-3 text-left space-y-1.5">
                                <div className="text-[10px] font-black uppercase text-neutral-500 tracking-wider">
                                    Canvas Overview
                                </div>
                                <div className="text-xs font-bold text-neutral-700 flex justify-between">
                                    <span>Dimensions:</span>
                                    <span className="font-mono text-black">{canvasWidth} &times; {canvasHeight} pt</span>
                                </div>
                                <div className="text-xs font-bold text-neutral-700 flex justify-between">
                                    <span>Elements:</span>
                                    <span className="font-mono text-black">{design.elements.length} total</span>
                                </div>
                                <div className="text-xs font-bold text-neutral-700 flex justify-between">
                                    <span>Border:</span>
                                    <span className="capitalize text-black">{design.background.borderStyle || "none"}</span>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Phase 6.4: Certificate Data Audit & Fallback Diagnostics Modal */}
            {showAuditModal && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
                    onClick={() => setShowAuditModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl border-4 border-black p-6 max-w-2xl w-full shadow-[8px_8px_0px_#000] space-y-4 max-h-[85vh] flex flex-col"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b-2 border-black pb-3 shrink-0">
                            <div className="flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-blue-600" />
                                <h3 className="text-base font-black text-black">
                                    Certificate Data Mapping &amp; Diagnostics Audit
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowAuditModal(false)}
                                className="p-1 rounded-lg hover:bg-neutral-100 border border-black"
                            >
                                <X className="w-4 h-4 text-black" />
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                            {auditReport.issues.length === 0 ? (
                                <div className="p-5 rounded-xl border-2 border-black bg-[#DCFCE7] text-center space-y-2 shadow-[2px_2px_0px_#000]">
                                    <CheckCircle2 className="w-8 h-8 text-green-700 mx-auto" />
                                    <div className="text-sm font-black text-green-900">
                                        All Dynamic Data Fields Are Validated
                                    </div>
                                    <div className="text-xs text-green-800 max-w-md mx-auto">
                                        All {auditReport.totalDynamic} mapped dynamic fields on your canvas have valid tokens and fallbacks configured. This certificate is ready for automatic and manual bulk issuance.
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="p-3 bg-[#FFE566] border-2 border-black rounded-xl text-xs font-black text-black flex items-center justify-between shadow-[2px_2px_0px_#000]">
                                        <div className="flex items-center gap-2">
                                            <AlertTriangle className="w-4 h-4 text-amber-800" />
                                            <span>
                                                {auditReport.issues.length} Potential Data Issue(s) Detected
                                            </span>
                                        </div>
                                        <button
                                            onClick={handleApplyDefaultFallbacks}
                                            className="px-2.5 py-1 rounded-lg bg-white border border-black hover:bg-neutral-100 text-[11px] font-black shadow-[1px_1px_0px_#000]"
                                        >
                                            Auto-Apply Default Fallbacks
                                        </button>
                                    </div>

                                    <div className="space-y-2">
                                        {auditReport.issues.map((issue, idx) => (
                                            <div
                                                key={idx}
                                                className="p-3 rounded-xl border-2 border-black bg-[#FAF6EE] text-xs flex items-center justify-between gap-3 shadow-[1.5px_1.5px_0px_#000]"
                                            >
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-black text-black">{issue.label}</span>
                                                        <span className="font-mono text-[10px] text-neutral-500">
                                                            {"{{"}{issue.fieldKey}{"}}"}
                                                        </span>
                                                        <span
                                                            className={`px-1.5 py-0.2 rounded text-[9px] font-black uppercase ${
                                                                issue.severity === "error"
                                                                    ? "bg-red-100 text-red-800 border border-red-300"
                                                                    : "bg-amber-100 text-amber-800 border border-amber-300"
                                                            }`}
                                                        >
                                                            {issue.severity}
                                                        </span>
                                                    </div>
                                                    <div className="text-[11px] text-neutral-600 mt-1">
                                                        {issue.message}
                                                    </div>
                                                </div>

                                                <button
                                                    onClick={() => {
                                                        setSelectedElementIds([issue.elemId]);
                                                        setShowAuditModal(false);
                                                    }}
                                                    className="px-2.5 py-1 rounded-lg border border-black bg-white hover:bg-neutral-100 text-xs font-bold shrink-0 shadow-[1px_1px_0px_#000]"
                                                >
                                                    Inspect
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Mapped Elements Roster */}
                            <div className="border-t border-black/10 pt-3">
                                <h4 className="text-xs font-black text-neutral-700 uppercase tracking-wider mb-2">
                                    All Mapped Dynamic Tokens ({auditReport.totalDynamic})
                                </h4>
                                <div className="space-y-1.5">
                                    {design.elements
                                        .filter((el) => el.type === "dynamic-text")
                                        .map((el) => {
                                            const def = allDynamicFields.find((f) => f.key === el.fieldKey);
                                            return (
                                                <div
                                                    key={el.id}
                                                    className="p-2 rounded-lg border border-neutral-300 bg-white text-xs flex items-center justify-between"
                                                >
                                                    <div className="flex items-center gap-2">
                                                        <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                                                        <span className="font-bold text-black">{def?.label || el.fieldKey}</span>
                                                        <span className="font-mono text-[10px] text-neutral-500">
                                                            {"{{"}{el.fieldKey}{"}}"}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[10px] text-neutral-500">
                                                            Fallback: <span className="font-semibold">{el.fallbackValue || "None"}</span>
                                                        </span>
                                                        {el.isRequired && (
                                                            <span className="px-1.5 py-0.5 rounded bg-black text-[#FFE566] text-[9px] font-bold">
                                                                REQUIRED
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            );
                                        })}
                                </div>
                            </div>
                        </div>

                        <div className="text-right border-t border-black/10 pt-3 shrink-0">
                            <button
                                onClick={() => setShowAuditModal(false)}
                                className="px-4 py-1.5 rounded-lg border-2 border-black bg-[#FFE566] text-xs font-black shadow-[2px_2px_0px_#000]"
                            >
                                Done
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Phase 6.5: Custom Attribute Creator Modal */}
            {showCustomAttrModal && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
                    onClick={() => setShowCustomAttrModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl border-4 border-black p-6 max-w-md w-full shadow-[8px_8px_0px_#000] space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b-2 border-black pb-3">
                            <div className="flex items-center gap-2">
                                <Tag className="w-5 h-5 text-black" />
                                <h3 className="text-base font-black text-black">Define Custom Attribute</h3>
                            </div>
                            <button
                                onClick={() => setShowCustomAttrModal(false)}
                                className="p-1 rounded-lg hover:bg-neutral-100 border border-black"
                            >
                                <X className="w-4 h-4 text-black" />
                            </button>
                        </div>

                        <div className="space-y-3 text-xs">
                            <div>
                                <label className="font-bold text-neutral-700 block mb-1">
                                    Attribute Label (e.g. Instructor Name, Workshop Duration)
                                </label>
                                <input
                                    type="text"
                                    value={customLabel}
                                    onChange={(e) => {
                                        setCustomLabel(e.target.value);
                                        if (!customKey) {
                                            setCustomKey(`custom.${e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "_")}`);
                                        }
                                    }}
                                    className="w-full p-2 font-bold border-2 border-black rounded-lg bg-white"
                                    placeholder="e.g. Instructor Name"
                                />
                            </div>

                            <div>
                                <label className="font-bold text-neutral-700 block mb-1">
                                    Internal Key Token
                                </label>
                                <input
                                    type="text"
                                    value={customKey}
                                    onChange={(e) => setCustomKey(e.target.value)}
                                    className="w-full p-2 font-mono font-bold border-2 border-black rounded-lg bg-[#FAF6EE]"
                                    placeholder="custom.instructor_name"
                                />
                                <span className="text-[10px] text-neutral-500 mt-0.5 block">
                                    Internal reference token: {"{{"}{customKey || "custom.key"}{"}}"}
                                </span>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="font-bold text-neutral-700 block mb-1">
                                        Data Type
                                    </label>
                                    <select
                                        value={customDataType}
                                        onChange={(e) => setCustomDataType(e.target.value as any)}
                                        className="w-full p-2 font-bold border-2 border-black rounded-lg bg-white"
                                    >
                                        <option value="text">Text / String</option>
                                        <option value="number">Number</option>
                                        <option value="date">Date</option>
                                        <option value="url">URL Link</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="font-bold text-neutral-700 block mb-1">
                                        Recipient Scope
                                    </label>
                                    <select
                                        value={customScope}
                                        onChange={(e) => setCustomScope(e.target.value as any)}
                                        className="w-full p-2 font-bold border-2 border-black rounded-lg bg-white"
                                    >
                                        <option value="all">All Recipients</option>
                                        <option value="individual">Individual Only</option>
                                        <option value="team">Team Only</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="font-bold text-neutral-700 block mb-1">
                                    Default Sample / Fallback Value
                                </label>
                                <input
                                    type="text"
                                    value={customSampleValue}
                                    onChange={(e) => setCustomSampleValue(e.target.value)}
                                    className="w-full p-2 font-bold border-2 border-black rounded-lg bg-white"
                                    placeholder="e.g. Dr. Vikram Sarabhai"
                                />
                            </div>

                            <label className="flex items-center gap-2 p-2 rounded-lg border border-black/20 bg-[#FAF6EE] cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={customRequired}
                                    onChange={(e) => setCustomRequired(e.target.checked)}
                                    className="accent-black w-4 h-4 cursor-pointer rounded"
                                />
                                <div>
                                    <div className="font-black text-black">Required for Issuance</div>
                                    <div className="text-[10px] text-neutral-600">Block certificate generation if missing for recipient</div>
                                </div>
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-2 border-t border-black/10 pt-3">
                            <button
                                onClick={() => setShowCustomAttrModal(false)}
                                className="px-3.5 py-1.5 rounded-lg border-2 border-black bg-white hover:bg-neutral-100 text-xs font-black shadow-[2px_2px_0px_#000]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddCustomAttribute}
                                className="px-4 py-1.5 rounded-lg border-2 border-black bg-[#FFE566] hover:bg-[#FDD835] text-xs font-black shadow-[2px_2px_0px_#000]"
                            >
                                Create Attribute
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Keyboard Shortcuts Modal */}
            {showShortcutsModal && (
                <div
                    className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
                    onClick={() => setShowShortcutsModal(false)}
                >
                    <div
                        className="bg-white rounded-2xl border-4 border-black p-6 max-w-lg w-full shadow-[8px_8px_0px_#000] space-y-4"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between border-b-2 border-black pb-3">
                            <div className="flex items-center gap-2">
                                <HelpCircle className="w-5 h-5 text-black" />
                                <h3 className="text-base font-black text-black">Keyboard Shortcuts</h3>
                            </div>
                            <button
                                onClick={() => setShowShortcutsModal(false)}
                                className="p-1 rounded-lg hover:bg-neutral-100 border border-black"
                            >
                                <X className="w-4 h-4 text-black" />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                            <div className="p-2.5 rounded-xl border-2 border-black bg-[#FAF6EE]">
                                <div className="font-black text-black mb-1">Canvas &amp; History</div>
                                <div className="space-y-1 text-neutral-700">
                                    <div className="flex justify-between"><span>Undo</span><kbd className="px-1.5 py-0.5 bg-white border border-black rounded text-[10px] font-mono font-bold">Ctrl+Z</kbd></div>
                                    <div className="flex justify-between"><span>Redo</span><kbd className="px-1.5 py-0.5 bg-white border border-black rounded text-[10px] font-mono font-bold">Ctrl+Y</kbd></div>
                                    <div className="flex justify-between"><span>Save</span><kbd className="px-1.5 py-0.5 bg-white border border-black rounded text-[10px] font-mono font-bold">Ctrl+S</kbd></div>
                                    <div className="flex justify-between"><span>Select All</span><kbd className="px-1.5 py-0.5 bg-white border border-black rounded text-[10px] font-mono font-bold">Ctrl+A</kbd></div>
                                    <div className="flex justify-between"><span>Deselect</span><kbd className="px-1.5 py-0.5 bg-white border border-black rounded text-[10px] font-mono font-bold">Esc</kbd></div>
                                </div>
                            </div>

                            <div className="p-2.5 rounded-xl border-2 border-black bg-[#FAF6EE]">
                                <div className="font-black text-black mb-1">Element Actions</div>
                                <div className="space-y-1 text-neutral-700">
                                    <div className="flex justify-between"><span>Duplicate</span><kbd className="px-1.5 py-0.5 bg-white border border-black rounded text-[10px] font-mono font-bold">Ctrl+D</kbd></div>
                                    <div className="flex justify-between"><span>Delete</span><kbd className="px-1.5 py-0.5 bg-white border border-black rounded text-[10px] font-mono font-bold">Del / Backspace</kbd></div>
                                    <div className="flex justify-between"><span>Lock / Unlock</span><kbd className="px-1.5 py-0.5 bg-white border border-black rounded text-[10px] font-mono font-bold">L</kbd></div>
                                    <div className="flex justify-between"><span>Hide / Reveal</span><kbd className="px-1.5 py-0.5 bg-white border border-black rounded text-[10px] font-mono font-bold">H</kbd></div>
                                    <div className="flex justify-between"><span>15&deg; Rotate Snap</span><kbd className="px-1.5 py-0.5 bg-white border border-black rounded text-[10px] font-mono font-bold">Shift+Rotate</kbd></div>
                                </div>
                            </div>

                            <div className="col-span-2 p-2.5 rounded-xl border-2 border-black bg-[#FAF6EE]">
                                <div className="font-black text-black mb-1">Precision Nudging &amp; Multi-Select</div>
                                <div className="space-y-1 text-neutral-700">
                                    <div className="flex justify-between"><span>Nudge 1 pt</span><kbd className="px-1.5 py-0.5 bg-white border border-black rounded text-[10px] font-mono font-bold">&uarr; &darr; &larr; &rarr;</kbd></div>
                                    <div className="flex justify-between"><span>Nudge 10 pt</span><kbd className="px-1.5 py-0.5 bg-white border border-black rounded text-[10px] font-mono font-bold">Shift + Arrows</kbd></div>
                                    <div className="flex justify-between"><span>Multi-select elements</span><kbd className="px-1.5 py-0.5 bg-white border border-black rounded text-[10px] font-mono font-bold">Shift + Click</kbd></div>
                                    <div className="flex justify-between"><span>Marquee drag select</span><kbd className="px-1.5 py-0.5 bg-white border border-black rounded text-[10px] font-mono font-bold">Drag on Canvas</kbd></div>
                                </div>
                            </div>
                        </div>

                        <div className="text-right">
                            <button
                                onClick={() => setShowShortcutsModal(false)}
                                className="px-4 py-1.5 rounded-lg border-2 border-black bg-[#FFE566] text-xs font-black shadow-[2px_2px_0px_#000]"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
