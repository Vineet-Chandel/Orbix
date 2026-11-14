import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    QrCode,
    Camera,
    CameraOff,
    CheckCircle2,
    AlertCircle,
    XCircle,
    Copy,
    User,
    GraduationCap,
    ExternalLink,
    Sparkles,
    ShieldCheck,
    ScanLine,
    Scan,
    FlipHorizontal,
    Globe,
    Check,
    X,
    Zap,
    ZapOff,
    Image as ImageIcon,
    RefreshCw,
} from "lucide-react";
import jsQR from "jsqr";
import {
    verifyEventTicketAndCheckin,
    type VerifiedAttendeeData,
    type CheckinVerifyResponse,
} from "../../api/collegeEventsApi";
import { useToast } from "../../context/ToastContext";
import { OrbixLoader } from "../../components/ui/loader";

interface ClubEventCheckinTerminalProps {
    eventId: string;
    eventTitle?: string;
    onCheckinCompleted?: (attendee: VerifiedAttendeeData) => void;
}

export const ClubEventCheckinTerminal: React.FC<ClubEventCheckinTerminalProps> = ({
    eventId,
    eventTitle,
    onCheckinCompleted,
}) => {
    const toast = useToast();

    // Input & Mode States
    const [ticketInput, setTicketInput] = useState("");
    const [isVerifying, setIsVerifying] = useState(false);
    const [cameraActive, setCameraActive] = useState(false);
    const [isStartingCamera, setIsStartingCamera] = useState(false);
    const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
    const [cameraError, setCameraError] = useState<string | null>(null);
    const [cardFormat, setCardFormat] = useState<"linkedin" | "instagram">("linkedin");

    // Torch / Flashlight state
    const [torchSupported, setTorchSupported] = useState(false);
    const [torchOn, setTorchOn] = useState(false);

    // Visual scan detection feedback
    const [isScanSuccess, setIsScanSuccess] = useState(false);

    // Verified Attendee state
    const [verifiedResult, setVerifiedResult] = useState<CheckinVerifyResponse | null>(null);
    const [history, setHistory] = useState<VerifiedAttendeeData[]>([]);
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    // Camera Video & Canvas Refs
    const videoRef = useRef<HTMLVideoElement | null>(null);
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animFrameRef = useRef<number | null>(null);
    const lastScannedCodeRef = useRef<string | null>(null);
    const scanCooldownRef = useRef<boolean>(false);
    const isScanningFrameRef = useRef<boolean>(false);
    const barcodeDetectorRef = useRef<any>(null);

    // Hardware BarcodeDetector initialization
    useEffect(() => {
        if (typeof window !== "undefined" && "BarcodeDetector" in window) {
            try {
                barcodeDetectorRef.current = new (window as any).BarcodeDetector({
                    formats: ["qr_code"],
                });
            } catch {
                barcodeDetectorRef.current = null;
            }
        }
    }, []);

    // Audio confirmation sound
    const playSound = useCallback((type: "success" | "warn" | "error") => {
        try {
            const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
            if (!AudioCtx) return;
            const ctx = new AudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain);
            gain.connect(ctx.destination);

            if (type === "success") {
                // High-fidelity Paytm / GPay style confirmation chime
                osc.type = "sine";
                osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
                osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.12); // A5
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.24);
                osc.start();
                osc.stop(ctx.currentTime + 0.24);
            } else if (type === "warn") {
                osc.type = "triangle";
                osc.frequency.setValueAtTime(440, ctx.currentTime);
                osc.frequency.setValueAtTime(330, ctx.currentTime + 0.1);
                gain.gain.setValueAtTime(0.18, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.25);
                osc.start();
                osc.stop(ctx.currentTime + 0.25);
            } else {
                osc.type = "sawtooth";
                osc.frequency.setValueAtTime(220, ctx.currentTime);
                osc.frequency.setValueAtTime(160, ctx.currentTime + 0.12);
                gain.gain.setValueAtTime(0.2, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.28);
                osc.start();
                osc.stop(ctx.currentTime + 0.28);
            }
        } catch {
            // Ignore audio context errors
        }
    }, []);

    // Perform Verification & Check-in
    const handleVerify = async (code: string, forceCheckIn: boolean = false) => {
        const clean = code.trim().toUpperCase();
        if (!clean) {
            toast.error("Please enter or scan a valid pass ticket code.");
            return;
        }

        setIsVerifying(true);
        try {
            const data = await verifyEventTicketAndCheckin(eventId, clean, forceCheckIn);
            setVerifiedResult(data);

            if (data.actionTaken === "checked_in") {
                playSound("success");
                toast.success(data.message || "Attendee checked in successfully!");
                setHistory((prev) => [data.attendee, ...prev.filter((p) => p.ticketCode !== clean)]);
                onCheckinCompleted?.(data.attendee);
            } else if (data.actionTaken === "already_checked_in") {
                playSound("warn");
                toast.info("Attendee was already checked in earlier.");
            } else if (data.actionTaken === "pending") {
                playSound("warn");
                toast.info("Registration is pending review.");
            } else {
                playSound("error");
                toast.error(data.message || "Ticket status invalid.");
            }
        } catch (err: any) {
            playSound("error");
            toast.error(err.message || "Failed to verify entry pass.");
        } finally {
            setIsVerifying(false);
        }
    };

    // Camera Lifecycle
    const stopCamera = useCallback(() => {
        if (animFrameRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            animFrameRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => {
                track.stop();
            });
            streamRef.current = null;
        }
        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }
        setTorchOn(false);
        setTorchSupported(false);
        setCameraActive(false);
        setIsStartingCamera(false);
    }, []);

    const startCamera = useCallback(async (targetFacingMode?: "environment" | "user") => {
        const activeFacing = targetFacingMode || facingMode;

        // Insecure context check
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setCameraError(
                "Camera API is not supported on this browser or requires an HTTPS / localhost connection."
            );
            setCameraActive(false);
            return;
        }

        stopCamera();
        setIsStartingCamera(true);
        setCameraError(null);

        try {
            let stream: MediaStream | null = null;

            // Tier 1: Preferred resolution and facingMode
            try {
                const preferredConstraints: MediaStreamConstraints = {
                    video: {
                        facingMode: activeFacing === "environment" ? { ideal: "environment" } : "user",
                        width: { ideal: 1280, min: 640 },
                        height: { ideal: 720, min: 480 },
                    },
                    audio: false,
                };
                stream = await navigator.mediaDevices.getUserMedia(preferredConstraints);
            } catch (err1: any) {
                console.warn("Preferred constraints failed, trying basic facingMode:", err1);
                try {
                    // Tier 2: Basic facing mode
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: { facingMode: activeFacing },
                        audio: false,
                    });
                } catch (err2: any) {
                    console.warn("FacingMode fallback failed, requesting generic video:", err2);
                    // Tier 3: Any video device available
                    stream = await navigator.mediaDevices.getUserMedia({
                        video: true,
                        audio: false,
                    });
                }
            }

            if (!stream) {
                throw new Error("Unable to obtain video media stream.");
            }

            streamRef.current = stream;

            // Check torch / flashlight hardware capability
            const videoTrack = stream.getVideoTracks()[0];
            if (videoTrack) {
                try {
                    const capabilities: any = videoTrack.getCapabilities ? videoTrack.getCapabilities() : {};
                    setTorchSupported(Boolean(capabilities.torch));
                } catch {
                    setTorchSupported(false);
                }
            }

            // Bind stream to video element
            const video = videoRef.current;
            if (video) {
                video.srcObject = stream;
                video.setAttribute("playsinline", "true");
                video.muted = true;

                // Wait for video to begin playback
                await video.play().catch((playErr) => {
                    console.warn("Video playback promise warning:", playErr);
                });
            }

            setCameraActive(true);
            setCameraError(null);
        } catch (err: any) {
            console.error("Camera access error:", err);
            if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
                setCameraError(
                    "Camera permission was denied. Please allow camera permissions in your browser address bar (lock icon) and retry."
                );
            } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
                setCameraError("No camera hardware found on this device. You can paste or upload QR images below.");
            } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
                setCameraError("Camera is currently in use by another application. Please close other camera apps and retry.");
            } else {
                setCameraError(err.message || "Failed to initialize camera. You can paste or upload QR images below.");
            }
            setCameraActive(false);
        } finally {
            setIsStartingCamera(false);
        }
    }, [facingMode, stopCamera]);

    // Torch / Flashlight Toggle (Paytm & GPay feature)
    const toggleTorch = async () => {
        if (!streamRef.current) return;
        const track = streamRef.current.getVideoTracks()[0];
        if (!track) return;

        try {
            const next = !torchOn;
            await (track as any).applyConstraints({
                advanced: [{ torch: next }],
            });
            setTorchOn(next);
        } catch (err) {
            console.warn("Torch constraint error:", err);
            toast.info("Flashlight is not supported by this camera.");
        }
    };

    // Camera Switch (Front/Back)
    const handleFacingModeToggle = () => {
        const next = facingMode === "environment" ? "user" : "environment";
        setFacingMode(next);
        startCamera(next);
    };

    // Robust Ticket Code Parser
    const extractTicketCode = (raw: string): string => {
        let clean = (raw || "").trim();
        if (!clean) return "";

        // 1. JSON payload e.g. {"ticketCode":"ORB-1234"} or {"code":"ORB-1234"}
        if (clean.startsWith("{") && clean.endsWith("}")) {
            try {
                const parsed = JSON.parse(clean);
                if (parsed.ticketCode) return String(parsed.ticketCode).trim().toUpperCase();
                if (parsed.code) return String(parsed.code).trim().toUpperCase();
                if (parsed.id) return String(parsed.id).trim().toUpperCase();
            } catch {
                // Ignore JSON parse error and continue
            }
        }

        // 2. Query param ?code=... or &code=... or ?ticket=...
        const codeParamMatch = clean.match(/[?&](?:code|ticket|pass|ticketCode)=([A-Za-z0-9_-]+)/i);
        if (codeParamMatch && codeParamMatch[1]) {
            return codeParamMatch[1].trim().toUpperCase();
        }

        // 3. URL path like /verify/ORB-1234 or /pass/ORB-1234
        if (clean.startsWith("http://") || clean.startsWith("https://")) {
            try {
                const url = new URL(clean);
                const segments = url.pathname.split("/").filter(Boolean);
                if (segments.length > 0) {
                    const last = segments[segments.length - 1];
                    if (last && last.length >= 3) {
                        return last.trim().toUpperCase();
                    }
                }
            } catch {
                // Continue
            }
        }

        return clean.toUpperCase();
    };

    // Process a successfully decoded QR string
    const handleDetectedCode = (rawValue: string) => {
        if (scanCooldownRef.current) return;

        const candidate = extractTicketCode(rawValue);
        if (!candidate || candidate === lastScannedCodeRef.current) return;

        lastScannedCodeRef.current = candidate;
        scanCooldownRef.current = true;

        // Visual feedback & vibration (Paytm / GPay style)
        setIsScanSuccess(true);
        if (typeof navigator !== "undefined" && navigator.vibrate) {
            try {
                navigator.vibrate([40, 60, 40]);
            } catch {
                // Ignore vibration errors
            }
        }

        setTicketInput(candidate);
        handleVerify(candidate);

        // Turn off success indicator after 800ms
        setTimeout(() => {
            setIsScanSuccess(false);
        }, 800);

        // Cooldown before scanning another pass (2.5s)
        setTimeout(() => {
            scanCooldownRef.current = false;
            lastScannedCodeRef.current = null;
        }, 2500);
    };

    // QR Scanning Animation Loop (High Performance with BarcodeDetector + jsQR fallback)
    useEffect(() => {
        if (!cameraActive) return;

        let active = true;
        let lastScanTime = 0;

        const scanFrame = async (timestamp: number) => {
            if (!active) return;

            const video = videoRef.current;
            const canvas = canvasRef.current;

            // Throttle scanning to every 100ms (10 checks/sec) for optimal 60fps UI and battery longevity
            if (
                video &&
                !scanCooldownRef.current &&
                !isScanningFrameRef.current &&
                timestamp - lastScanTime > 100 &&
                video.readyState >= 2 && // HAVE_CURRENT_DATA or higher
                video.videoWidth > 0 &&
                video.videoHeight > 0
            ) {
                lastScanTime = timestamp;
                isScanningFrameRef.current = true;

                try {
                    let detectedCode: string | null = null;

                    // 1. Hardware accelerated native BarcodeDetector
                    if (barcodeDetectorRef.current) {
                        try {
                            const barcodes = await barcodeDetectorRef.current.detect(video);
                            if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                                detectedCode = barcodes[0].rawValue;
                            }
                        } catch {
                            // Fallback to jsQR
                        }
                    }

                    // 2. High-speed jsQR fallback via canvas
                    if (!detectedCode && canvas) {
                        const ctx = canvas.getContext("2d", { willReadFrequently: true });
                        if (ctx) {
                            // Downscale slightly for instantaneous JS image decoding (max 640px)
                            const scale = Math.min(1, 640 / video.videoWidth);
                            const targetWidth = Math.floor(video.videoWidth * scale);
                            const targetHeight = Math.floor(video.videoHeight * scale);

                            if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
                                canvas.width = targetWidth;
                                canvas.height = targetHeight;
                            }

                            ctx.drawImage(video, 0, 0, targetWidth, targetHeight);
                            const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
                            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                                inversionAttempts: "dontInvert",
                            });

                            if (code && code.data) {
                                detectedCode = code.data;
                            }
                        }
                    }

                    if (detectedCode) {
                        handleDetectedCode(detectedCode);
                    }
                } catch (scanErr) {
                    console.warn("Scan frame error:", scanErr);
                } finally {
                    isScanningFrameRef.current = false;
                }
            }

            if (active) {
                animFrameRef.current = requestAnimationFrame(scanFrame);
            }
        };

        animFrameRef.current = requestAnimationFrame(scanFrame);

        return () => {
            active = false;
            if (animFrameRef.current) {
                cancelAnimationFrame(animFrameRef.current);
                animFrameRef.current = null;
            }
        };
    }, [cameraActive]);

    // Auto-start camera when the component mounts
    useEffect(() => {
        startCamera();
        return () => {
            stopCamera();
        };
    }, []);

    // Upload QR from Photos / Gallery (Paytm / GPay feature)
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = () => {
            const img = new window.Image();
            img.onload = async () => {
                // 1. Try BarcodeDetector first
                if (barcodeDetectorRef.current) {
                    try {
                        const barcodes = await barcodeDetectorRef.current.detect(img);
                        if (barcodes && barcodes.length > 0 && barcodes[0].rawValue) {
                            handleDetectedCode(barcodes[0].rawValue);
                            toast.success("QR code decoded successfully from image!");
                            return;
                        }
                    } catch (e) {
                        console.warn("BarcodeDetector error on file:", e);
                    }
                }

                // 2. Fallback to jsQR
                const tempCanvas = document.createElement("canvas");
                tempCanvas.width = img.width;
                tempCanvas.height = img.height;
                const ctx = tempCanvas.getContext("2d");
                if (ctx) {
                    ctx.drawImage(img, 0, 0);
                    const imageData = ctx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
                    const qr = jsQR(imageData.data, imageData.width, imageData.height);
                    if (qr && qr.data) {
                        handleDetectedCode(qr.data);
                        toast.success("QR code decoded successfully from image!");
                        return;
                    }
                }

                toast.error("No valid QR pass found in this image. Please ensure the QR is clear and well-lit.");
            };
            img.src = reader.result as string;
        };
        reader.readAsDataURL(file);

        // Reset input value
        e.target.value = "";
    };

    const handleCopy = (text: string, key: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(key);
        toast.success("Copied to clipboard!");
        setTimeout(() => setCopiedKey(null), 2000);
    };

    const handlePasteClipboard = async () => {
        try {
            const clip = await navigator.clipboard.readText();
            if (clip) {
                setTicketInput(clip.trim());
                toast.success("Pasted from clipboard!");
            }
        } catch {
            toast.error("Unable to read from clipboard. Please paste manually into the input.");
        }
    };

    const attendee = verifiedResult?.attendee;

    return (
        <div className="space-y-6">
            {/* Embedded styles for authentic Paytm / GPay laser sweep and pulse animations */}
            <style>{`
                @keyframes orbixLaserSweep {
                    0% {
                        top: 2%;
                        opacity: 0.85;
                    }
                    50% {
                        top: 92%;
                        opacity: 1;
                    }
                    100% {
                        top: 2%;
                        opacity: 0.85;
                    }
                }
                .animate-orbix-laser {
                    animation: orbixLaserSweep 2.2s ease-in-out infinite;
                }
                @keyframes orbixRadarPulse {
                    0% {
                        transform: scale(0.96);
                        opacity: 0.9;
                    }
                    50% {
                        transform: scale(1.02);
                        opacity: 0.4;
                    }
                    100% {
                        transform: scale(0.96);
                        opacity: 0.9;
                    }
                }
                .animate-orbix-radar {
                    animation: orbixRadarPulse 2.4s ease-in-out infinite;
                }
            `}</style>

            {/* Hidden file input for gallery/photo upload */}
            <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageUpload}
            />

            {/* Top Terminal Ribbon */}
            <div className="p-5 rounded-3xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#a2ff86] border-2 border-black flex items-center justify-center shadow-[2px_2px_0px_#000] shrink-0">
                        <ScanLine className="w-6 h-6 text-black stroke-[2.5]" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h2 className="text-lg font-black text-black">
                                Live Event Entry &amp; QR Scanner Terminal
                            </h2>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase bg-black text-[#a2ff86] animate-pulse">
                                Live Active
                            </span>
                        </div>
                        <p className="text-xs font-bold text-neutral-600">
                            Scan official entry pass QR code or paste ticket code for instant database identity verification &amp; check-in.
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-3 py-1.5 rounded-xl border-2 border-black bg-[#FAF6EE] text-xs font-black shadow-[2px_2px_0px_#000]">
                        Terminal Session: {eventTitle || "Active Event"}
                    </span>
                    {history.length > 0 && (
                        <span className="px-3 py-1.5 rounded-xl border-2 border-black bg-emerald-300 text-black text-xs font-black shadow-[2px_2px_0px_#000]">
                            Checked-In: {history.length}
                        </span>
                    )}
                </div>
            </div>

            {/* Split Workspace: Left Scanner/Input + Right Verified Identity Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* LEFT: Paytm / GPay Style Scanner & Code Input (5 cols) */}
                <div className="lg:col-span-5 space-y-4">
                    {/* Scanner Container Box */}
                    <div className="p-5 rounded-3xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                <Scan className="w-4 h-4 text-neutral-800" />
                                Live QR Scanner
                            </span>

                            <div className="flex items-center gap-1.5">
                                {cameraActive && (
                                    <>
                                        {torchSupported && (
                                            <button
                                                type="button"
                                                onClick={toggleTorch}
                                                className={`p-1.5 rounded-lg border border-black text-xs font-black transition-colors ${
                                                    torchOn ? "bg-[#FFE566] text-black" : "bg-white hover:bg-neutral-100 text-neutral-800"
                                                }`}
                                                title={torchOn ? "Turn Torch Off" : "Turn Torch On"}
                                            >
                                                {torchOn ? <Zap className="w-3.5 h-3.5 fill-black" /> : <ZapOff className="w-3.5 h-3.5" />}
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={handleFacingModeToggle}
                                            className="p-1.5 rounded-lg border border-black bg-white hover:bg-neutral-100 text-xs font-black"
                                            title="Switch Camera (Front/Back)"
                                        >
                                            <FlipHorizontal className="w-3.5 h-3.5" />
                                        </button>
                                    </>
                                )}

                                <button
                                    type="button"
                                    onClick={cameraActive ? stopCamera : () => startCamera()}
                                    disabled={isStartingCamera}
                                    className={`px-3 py-1.5 rounded-xl border-2 border-black text-xs font-black cursor-pointer shadow-[2px_2px_0px_#000] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5 ${
                                        cameraActive
                                            ? "bg-rose-200 hover:bg-rose-300 text-black"
                                            : "bg-[#a2ff86] hover:bg-[#8cee70] text-black"
                                    }`}
                                >
                                    {isStartingCamera ? (
                                        <>
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            <span>Starting...</span>
                                        </>
                                    ) : cameraActive ? (
                                        <>
                                            <CameraOff className="w-3.5 h-3.5" />
                                            <span>Turn Off</span>
                                        </>
                                    ) : (
                                        <>
                                            <Camera className="w-3.5 h-3.5" />
                                            <span>Start Camera</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>

                        {/* Viewfinder Window (Paytm / GPay Style Viewfinder with Orbix Aesthetics) */}
                        <div className="relative w-full aspect-square sm:aspect-[4/3] bg-neutral-950 rounded-2xl border-3 border-black shadow-[3px_3px_0px_#000] overflow-hidden flex items-center justify-center select-none">
                            {/* Always mounted video element so videoRef is NEVER null */}
                            <video
                                ref={videoRef}
                                className={`w-full h-full object-cover transition-opacity duration-300 ${
                                    cameraActive ? "opacity-100" : "opacity-0 absolute pointer-events-none"
                                }`}
                                playsInline
                                muted
                                autoPlay
                            />
                            {/* Hidden canvas for image analysis */}
                            <canvas ref={canvasRef} className="hidden" />

                            {cameraActive ? (
                                <>
                                    {/* Top Floating Badge Bar */}
                                    <div className="absolute top-3.5 inset-x-3.5 flex items-center justify-between z-20 pointer-events-auto">
                                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-black/80 backdrop-blur-md border border-white/20 shadow-md">
                                            <span className="w-2 h-2 rounded-full bg-[#a2ff86] animate-pulse" />
                                            <span className="text-[10px] font-black uppercase tracking-wider text-[#a2ff86]">
                                                {isScanSuccess ? "QR Verified!" : "Live Scanning"}
                                            </span>
                                        </div>

                                        <div className="flex items-center gap-1.5">
                                            {torchSupported && (
                                                <button
                                                    type="button"
                                                    onClick={toggleTorch}
                                                    className={`p-2 rounded-xl border border-black shadow-[2px_2px_0px_#000] text-xs font-black transition-all cursor-pointer ${
                                                        torchOn
                                                            ? "bg-[#FFE566] text-black shadow-[0_0_12px_#FFE566]"
                                                            : "bg-black/80 hover:bg-black text-white border-white/30"
                                                    }`}
                                                    title={torchOn ? "Torch On" : "Torch Off"}
                                                >
                                                    {torchOn ? <Zap className="w-3.5 h-3.5 fill-black" /> : <ZapOff className="w-3.5 h-3.5" />}
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={handleFacingModeToggle}
                                                className="p-2 rounded-xl border border-black bg-white hover:bg-neutral-100 text-black shadow-[2px_2px_0px_#000] text-xs font-black transition-all cursor-pointer"
                                                title="Switch Camera (Front/Rear)"
                                            >
                                                <FlipHorizontal className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Paytm / GPay Dark Mask & Central Viewfinder Box */}
                                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                        <div className="relative w-52 h-52 sm:w-60 sm:h-60 rounded-3xl shadow-[0_0_0_9999px_rgba(0,0,0,0.58)] transition-all">
                                            {/* 4 Prominent Corner Brackets (Paytm / GPay Style) */}
                                            <div
                                                className={`absolute -top-1 -left-1 w-8 h-8 sm:w-10 sm:h-10 border-t-4 border-l-4 rounded-tl-2xl transition-all duration-200 ${
                                                    isScanSuccess
                                                        ? "border-[#a2ff86] shadow-[0_0_16px_#a2ff86]"
                                                        : "border-[#a2ff86]"
                                                }`}
                                            />
                                            <div
                                                className={`absolute -top-1 -right-1 w-8 h-8 sm:w-10 sm:h-10 border-t-4 border-r-4 rounded-tr-2xl transition-all duration-200 ${
                                                    isScanSuccess
                                                        ? "border-[#a2ff86] shadow-[0_0_16px_#a2ff86]"
                                                        : "border-[#a2ff86]"
                                                }`}
                                            />
                                            <div
                                                className={`absolute -bottom-1 -left-1 w-8 h-8 sm:w-10 sm:h-10 border-b-4 border-l-4 rounded-bl-2xl transition-all duration-200 ${
                                                    isScanSuccess
                                                        ? "border-[#a2ff86] shadow-[0_0_16px_#a2ff86]"
                                                        : "border-[#a2ff86]"
                                                }`}
                                            />
                                            <div
                                                className={`absolute -bottom-1 -right-1 w-8 h-8 sm:w-10 sm:h-10 border-b-4 border-r-4 rounded-br-2xl transition-all duration-200 ${
                                                    isScanSuccess
                                                        ? "border-[#a2ff86] shadow-[0_0_16px_#a2ff86]"
                                                        : "border-[#a2ff86]"
                                                }`}
                                            />

                                            {/* Continuous Laser Sweep Beam (Paytm / GPay style glowing scan line) */}
                                            {!isScanSuccess && (
                                                <div className="absolute inset-0 overflow-hidden rounded-3xl pointer-events-none">
                                                    <div className="absolute inset-x-0 h-16 animate-orbix-laser -mt-8 pointer-events-none">
                                                        <div className="w-full h-full bg-gradient-to-b from-transparent via-[#a2ff86]/15 to-[#a2ff86]/45" />
                                                        <div className="w-full h-1 bg-[#a2ff86] shadow-[0_0_14px_#a2ff86,0_0_4px_#ffffff]" />
                                                    </div>
                                                </div>
                                            )}

                                            {/* Center Crosshair or Success Checkmark */}
                                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                                {isScanSuccess ? (
                                                    <div className="w-16 h-16 rounded-2xl bg-[#a2ff86] border-2 border-black flex items-center justify-center shadow-[0_0_24px_#a2ff86] animate-in zoom-in-75 duration-200">
                                                        <Check className="w-10 h-10 text-black stroke-[3.5]" />
                                                    </div>
                                                ) : (
                                                    <div className="w-6 h-6 border border-white/20 rounded-full flex items-center justify-center animate-orbix-radar">
                                                        <div className="w-1.5 h-1.5 bg-[#a2ff86]/70 rounded-full" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom Floating Control Bar */}
                                    <div className="absolute bottom-3 inset-x-3 flex flex-col items-center gap-2 z-20 pointer-events-auto">
                                        <div className="px-3.5 py-1 rounded-full bg-black/85 backdrop-blur-md border border-white/20 text-white text-[11px] font-bold shadow-md flex items-center gap-1.5">
                                            <Scan className="w-3.5 h-3.5 text-[#a2ff86]" />
                                            <span>Align pass QR code inside bracket</span>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => fileInputRef.current?.click()}
                                                className="px-3 py-1 rounded-xl border-2 border-black bg-white hover:bg-neutral-100 text-black text-xs font-black shadow-[2px_2px_0px_#000] flex items-center gap-1.5 cursor-pointer active:translate-x-0.5 active:translate-y-0.5"
                                                title="Upload QR screenshot or PDF image"
                                            >
                                                <ImageIcon className="w-3.5 h-3.5 text-neutral-800" />
                                                <span>Upload QR Image</span>
                                            </button>
                                        </div>
                                    </div>
                                </>
                            ) : (
                                /* Inactive Camera Screen with Clear Troubleshooting & Options */
                                <div className="text-center p-6 space-y-3 z-10 max-w-sm mx-auto">
                                    <div className="w-14 h-14 rounded-2xl bg-neutral-900 border-2 border-neutral-700 flex items-center justify-center mx-auto text-[#a2ff86] shadow-[2px_2px_0px_#000]">
                                        <QrCode className="w-7 h-7" />
                                    </div>
                                    <div className="space-y-1">
                                        <h4 className="text-sm font-black text-white">Camera is Inactive</h4>
                                        <p className="text-xs text-neutral-300 leading-relaxed">
                                            {cameraError ||
                                                "Click 'Enable Camera' to activate live video barcode scanning, or upload a photo of the entry pass."}
                                        </p>
                                    </div>

                                    <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                                        <button
                                            type="button"
                                            onClick={() => startCamera()}
                                            disabled={isStartingCamera}
                                            className="px-4 py-2 rounded-xl border-2 border-black bg-[#a2ff86] text-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer hover:bg-[#8cee70] flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                        >
                                            {isStartingCamera ? (
                                                <>
                                                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                                    <span>Starting...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <Camera className="w-3.5 h-3.5" />
                                                    <span>Enable Camera</span>
                                                </>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="px-4 py-2 rounded-xl border-2 border-black bg-white text-black font-black text-xs shadow-[2px_2px_0px_#000] cursor-pointer hover:bg-neutral-100 flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                        >
                                            <ImageIcon className="w-3.5 h-3.5" />
                                            <span>Upload QR</span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Ticket Code Input (Manual Paste & Type) */}
                        <div className="space-y-2 pt-2 border-t-2 border-black/10">
                            <div className="flex items-center justify-between">
                                <label className="text-xs font-black uppercase tracking-wider text-black">
                                    Pass Code Entry / Paste:
                                </label>
                                <button
                                    type="button"
                                    onClick={handlePasteClipboard}
                                    className="text-[11px] font-black text-neutral-700 hover:text-black flex items-center gap-1 cursor-pointer hover:underline"
                                >
                                    <Copy className="w-3 h-3" />
                                    Paste from Clipboard
                                </button>
                            </div>

                            <form
                                onSubmit={(e) => {
                                    e.preventDefault();
                                    handleVerify(ticketInput);
                                }}
                                className="space-y-2.5"
                            >
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={ticketInput}
                                        onChange={(e) => setTicketInput(e.target.value)}
                                        placeholder="e.g. ORB-543F5A81, Student ID or Roll No"
                                        className="w-full pl-3 pr-10 py-3 rounded-2xl bg-[#FAF6EE] border-3 border-black text-sm font-mono font-black text-black placeholder:text-neutral-400 focus:outline-hidden focus:bg-white shadow-[2px_2px_0px_#000] tracking-wider"
                                    />
                                    {ticketInput && (
                                        <button
                                            type="button"
                                            onClick={() => setTicketInput("")}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-neutral-400 hover:text-black cursor-pointer"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    )}
                                </div>

                                <button
                                    type="submit"
                                    disabled={isVerifying || !ticketInput.trim()}
                                    className="w-full py-3 rounded-2xl border-3 border-black bg-[#38BDF8] hover:bg-[#2cb1ec] text-black font-black text-xs uppercase tracking-wider shadow-[3px_3px_0px_#000] cursor-pointer transition-transform active:translate-x-0.5 active:translate-y-0.5 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isVerifying ? (
                                        <>
                                            <OrbixLoader size="sm" />
                                            <span>Verifying Identity in Database...</span>
                                        </>
                                    ) : (
                                        <>
                                            <ShieldCheck className="w-4 h-4 stroke-[2.5]" />
                                            <span>Verify Pass &amp; Check-In</span>
                                        </>
                                    )}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Quick Roster Stream */}
                    {history.length > 0 && (
                        <div className="p-4 rounded-3xl bg-white border-3 border-black shadow-[3px_3px_0px_#000] space-y-2">
                            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500 block">
                                Terminal Check-In Stream ({history.length})
                            </span>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {history.map((item) => (
                                    <div
                                        key={item.ticketCode}
                                        onClick={() => handleVerify(item.ticketCode)}
                                        className="p-2 rounded-xl bg-[#FAF6EE] border border-black/20 flex items-center justify-between text-xs font-bold cursor-pointer hover:bg-neutral-100"
                                    >
                                        <div className="flex items-center gap-2 truncate min-w-0">
                                            <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                            <span className="truncate text-black font-black">
                                                {item.firstName} {item.lastName}
                                            </span>
                                            <span className="text-[10px] text-neutral-500 font-mono">
                                                @{item.username}
                                            </span>
                                        </div>
                                        <span className="font-mono text-[11px] font-black shrink-0 text-black">
                                            {item.ticketCode}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT: Verified Attendee Identity & Complete Profile Data (7 cols) */}
                <div className="lg:col-span-7">
                    {!attendee ? (
                        <div className="p-12 sm:p-16 rounded-3xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] text-center space-y-4">
                            <div className="w-16 h-16 rounded-2xl bg-[#FAF6EE] border-2 border-black flex items-center justify-center mx-auto shadow-[3px_3px_0px_#000]">
                                <User className="w-8 h-8 text-neutral-400 stroke-[2]" />
                            </div>
                            <div className="space-y-1 max-w-sm mx-auto">
                                <h3 className="font-black text-base text-black">No Attendee Verified Yet</h3>
                                <p className="text-xs font-bold text-neutral-600 leading-relaxed">
                                    Aim the camera at the attendee's entry pass QR code, upload their ticket image, or paste their pass ticket code on the left to verify their complete identity.
                                </p>
                            </div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-black/20 bg-[#FAF6EE] text-[11px] font-mono text-neutral-600">
                                <span>Waiting for scanner input...</span>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-4 animate-in fade-in zoom-in-95 duration-150">
                            {/* Status Notification Banner */}
                            <div
                                className={`p-4 rounded-2xl border-3 border-black shadow-[3px_3px_0px_#000] flex items-center justify-between gap-3 ${
                                    verifiedResult?.actionTaken === "checked_in"
                                        ? "bg-[#a2ff86] text-black"
                                        : verifiedResult?.actionTaken === "already_checked_in"
                                        ? "bg-amber-300 text-black"
                                        : verifiedResult?.actionTaken === "pending"
                                        ? "bg-sky-200 text-black"
                                        : "bg-rose-200 text-black"
                                }`}
                            >
                                <div className="flex items-center gap-3">
                                    {verifiedResult?.actionTaken === "checked_in" ? (
                                        <CheckCircle2 className="w-6 h-6 text-black shrink-0 stroke-[2.5]" />
                                    ) : verifiedResult?.actionTaken === "already_checked_in" ? (
                                        <AlertCircle className="w-6 h-6 text-black shrink-0 stroke-[2.5]" />
                                    ) : (
                                        <XCircle className="w-6 h-6 text-black shrink-0 stroke-[2.5]" />
                                    )}
                                    <div>
                                        <span className="text-[10px] font-black uppercase tracking-wider block">
                                            {verifiedResult?.actionTaken === "checked_in"
                                                ? "Admission Confirmed"
                                                : verifiedResult?.actionTaken === "already_checked_in"
                                                ? "Already Checked-In"
                                                : verifiedResult?.actionTaken === "pending"
                                                ? "Application Pending"
                                                : "Verification Warning"}
                                        </span>
                                        <h4 className="text-xs sm:text-sm font-black leading-tight">
                                            {verifiedResult?.message}
                                        </h4>
                                    </div>
                                </div>

                                {attendee.status === "pending" && (
                                    <button
                                        type="button"
                                        onClick={() => handleVerify(attendee.ticketCode, true)}
                                        className="px-3 py-1.5 rounded-xl bg-black text-[#a2ff86] text-xs font-black shrink-0 cursor-pointer hover:bg-neutral-800"
                                    >
                                        Admit &amp; Check-In
                                    </button>
                                )}
                            </div>

                            {/* 1. Developer Identity Card (LinkedIn / Instagram Format) */}
                            <div className="p-5 rounded-3xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-black uppercase tracking-wider text-black flex items-center gap-1.5">
                                        <Sparkles className="w-4 h-4 text-amber-500" />
                                        Student Profile Card
                                    </span>
                                    <div className="flex items-center gap-1 p-0.5 rounded-lg border border-black bg-[#FAF6EE]">
                                        <button
                                            type="button"
                                            onClick={() => setCardFormat("linkedin")}
                                            className={`px-2.5 py-0.5 rounded-md text-[10px] font-black transition-all ${
                                                cardFormat === "linkedin"
                                                    ? "bg-black text-white"
                                                    : "text-neutral-600 hover:text-black"
                                            }`}
                                        >
                                            LinkedIn Style
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCardFormat("instagram")}
                                            className={`px-2.5 py-0.5 rounded-md text-[10px] font-black transition-all ${
                                                cardFormat === "instagram"
                                                    ? "bg-black text-white"
                                                    : "text-neutral-600 hover:text-black"
                                            }`}
                                        >
                                            Story Style
                                        </button>
                                    </div>
                                </div>

                                {/* Rendered Card Preview */}
                                <div
                                    className={`relative w-full rounded-2xl border-3 border-black p-5 overflow-hidden shadow-[3px_3px_0px_#000] text-black ${
                                        cardFormat === "linkedin"
                                            ? "bg-gradient-to-br from-amber-100 via-sky-100 to-indigo-100 min-h-[170px]"
                                            : "bg-gradient-to-br from-purple-100 via-pink-100 to-amber-100 min-h-[220px]"
                                    }`}
                                >
                                    <div className="flex items-start gap-4">
                                        {/* Avatar */}
                                        <div className="relative shrink-0">
                                            {attendee.avatarUrl ? (
                                                <img
                                                    src={attendee.avatarUrl}
                                                    alt={attendee.username}
                                                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-3 border-black object-cover shadow-[2px_2px_0px_#000] bg-white"
                                                />
                                            ) : (
                                                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl border-3 border-black bg-[#a2ff86] flex items-center justify-center font-black text-xl shadow-[2px_2px_0px_#000]">
                                                    {attendee.firstName?.[0] || attendee.username?.[0] || "U"}
                                                </div>
                                            )}
                                            <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#a2ff86] border border-black flex items-center justify-center shadow-[1px_1px_0px_#000]">
                                                <Check className="w-3.5 h-3.5 stroke-[3] text-black" />
                                            </div>
                                        </div>

                                        {/* Profile details */}
                                        <div className="space-y-1 min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h3 className="text-base sm:text-lg font-black text-black truncate leading-tight">
                                                    {attendee.firstName} {attendee.middleName ? `${attendee.middleName} ` : ""}{attendee.lastName}
                                                </h3>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-white border border-black shadow-[1px_1px_0px_#000]">
                                                    @{attendee.username}
                                                </span>
                                            </div>

                                            <p className="text-xs font-bold text-neutral-800 leading-snug line-clamp-2">
                                                {attendee.headline || attendee.bio || "Student Developer & Campus Participant"}
                                            </p>

                                            <div className="text-[11px] font-bold text-neutral-700 flex items-center gap-1.5 pt-0.5 truncate">
                                                <GraduationCap className="w-3.5 h-3.5 shrink-0" />
                                                <span className="truncate">
                                                    {attendee.collegeName || "Verified Campus Member"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Social & Portfolio Pills on Card */}
                                    <div className="mt-4 pt-3 border-t-2 border-black/15 flex items-center gap-2 flex-wrap">
                                        {attendee.linkedin && (
                                            <a
                                                href={attendee.linkedin.startsWith("http") ? attendee.linkedin : `https://${attendee.linkedin}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-2.5 py-1 rounded-lg bg-white border border-black text-[11px] font-black flex items-center gap-1 hover:bg-neutral-100 shadow-[1px_1px_0px_#000]"
                                            >
                                                <span>LinkedIn</span>
                                                <ExternalLink className="w-3 h-3 text-neutral-500" />
                                            </a>
                                        )}

                                        {attendee.github && (
                                            <a
                                                href={attendee.github.startsWith("http") ? attendee.github : `https://github.com/${attendee.github}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-2.5 py-1 rounded-lg bg-white border border-black text-[11px] font-black flex items-center gap-1 hover:bg-neutral-100 shadow-[1px_1px_0px_#000]"
                                            >
                                                <span>GitHub</span>
                                                <ExternalLink className="w-3 h-3 text-neutral-500" />
                                            </a>
                                        )}

                                        {attendee.website && (
                                            <a
                                                href={attendee.website.startsWith("http") ? attendee.website : `https://${attendee.website}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="px-2.5 py-1 rounded-lg bg-white border border-black text-[11px] font-black flex items-center gap-1 hover:bg-neutral-100 shadow-[1px_1px_0px_#000]"
                                            >
                                                <Globe className="w-3 h-3" />
                                                <span>Website</span>
                                                <ExternalLink className="w-3 h-3 text-neutral-500" />
                                            </a>
                                        )}

                                        <button
                                            type="button"
                                            onClick={() => handleCopy(attendee.ticketCode, "ticket")}
                                            className="ml-auto text-[10px] font-mono font-black uppercase text-neutral-600 bg-white/80 px-2 py-0.5 rounded border border-black hover:bg-white flex items-center gap-1 cursor-pointer"
                                            title="Copy Ticket Code"
                                        >
                                            <span>Ticket: {attendee.ticketCode}</span>
                                            <Copy className="w-2.5 h-2.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* 2. Full Personal & Academic Database Information */}
                            <div className="p-5 rounded-3xl bg-white border-3 border-black shadow-[4px_4px_0px_#000] space-y-4">
                                <span className="text-xs font-black uppercase tracking-wider text-black block">
                                    All Personal &amp; Academic Information (Database Record)
                                </span>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                                    {/* Full Legal Name */}
                                    <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-0.5">
                                        <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                            Full Name
                                        </span>
                                        <span className="text-black font-black block">
                                            {attendee.firstName} {attendee.middleName || ""} {attendee.lastName}
                                        </span>
                                    </div>

                                    {/* Username */}
                                    <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-0.5">
                                        <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                            Username
                                        </span>
                                        <span className="text-black font-mono font-black block">
                                            @{attendee.username}
                                        </span>
                                    </div>

                                    {/* Primary Email */}
                                    <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-0.5">
                                        <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                            Personal / Account Email
                                        </span>
                                        <span className="text-black font-mono font-bold truncate block">
                                            {attendee.email}
                                        </span>
                                    </div>

                                    {/* Phone */}
                                    <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-0.5">
                                        <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                            Contact Phone Number
                                        </span>
                                        <span className="text-black font-mono font-bold block">
                                            {attendee.phoneNumber || attendee.phone || "—"}
                                            {attendee.isPhoneVerified && (
                                                <span className="ml-1.5 text-[9px] bg-emerald-100 text-emerald-800 px-1 py-0.2 rounded font-black border border-emerald-300">
                                                    Verified
                                                </span>
                                            )}
                                        </span>
                                    </div>

                                    {/* College Name */}
                                    <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-0.5 sm:col-span-2">
                                        <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                            College / Institution
                                        </span>
                                        <span className="text-black font-black block">
                                            {attendee.collegeName || "Campus Affiliate"}
                                        </span>
                                    </div>

                                    {/* Department / Branch */}
                                    <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-0.5">
                                        <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                            Department / Branch
                                        </span>
                                        <span className="text-neutral-900 font-bold block">
                                            {attendee.department || "—"}
                                        </span>
                                    </div>

                                    {/* Year of Study */}
                                    <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-0.5">
                                        <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                            Year of Study
                                        </span>
                                        <span className="text-neutral-900 font-bold block">
                                            {attendee.yearOfStudy || "—"}
                                        </span>
                                    </div>

                                    {/* Roll Number / Student ID */}
                                    <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-0.5">
                                        <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                            Roll Number / Student ID
                                        </span>
                                        <span className="text-black font-mono font-black block">
                                            {attendee.rollNumber || "—"}
                                        </span>
                                    </div>

                                    {/* Ticket Code */}
                                    <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-0.5">
                                        <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                            Entry Pass Ticket Code
                                        </span>
                                        <div className="flex items-center justify-between">
                                            <span className="text-black font-mono font-black block">
                                                {attendee.ticketCode}
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => handleCopy(attendee.ticketCode, "ticket-grid")}
                                                className="p-1 hover:bg-neutral-200 rounded text-neutral-600 cursor-pointer"
                                                title="Copy Code"
                                            >
                                                {copiedKey === "ticket-grid" ? (
                                                    <span className="text-[10px] font-black text-emerald-600">Copied!</span>
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {/* Location / City */}
                                    {attendee.location && (
                                        <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-0.5">
                                            <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                                Location
                                            </span>
                                            <span className="text-neutral-900 font-bold block">
                                                {attendee.location}
                                            </span>
                                        </div>
                                    )}

                                    {/* Registered At */}
                                    <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-0.5">
                                        <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                            RSVP Registered At
                                        </span>
                                        <span className="text-neutral-900 font-bold text-[11px] block">
                                            {new Date(attendee.registeredAt).toLocaleString()}
                                        </span>
                                    </div>

                                    {/* Checked-In Timestamp */}
                                    <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-0.5 sm:col-span-2">
                                        <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                            Check-In Status &amp; Timestamp
                                        </span>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <span
                                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider border border-black ${
                                                    attendee.status === "attended"
                                                        ? "bg-purple-300 text-black shadow-[1px_1px_0px_#000]"
                                                        : "bg-emerald-300 text-black shadow-[1px_1px_0px_#000]"
                                                }`}
                                            >
                                                {attendee.status === "attended" ? "Checked-In (Attended)" : "Confirmed Pass"}
                                            </span>
                                            <span className="text-neutral-700 font-bold text-xs font-mono">
                                                {attendee.checkedInAt
                                                    ? new Date(attendee.checkedInAt).toLocaleString()
                                                    : "Checked in right now"}
                                            </span>
                                        </div>
                                    </div>

                                    {/* RSVP Notes / Speaker Questions */}
                                    {attendee.notes && (
                                        <div className="p-3 rounded-xl bg-[#FAF6EE] border border-black/20 space-y-0.5 sm:col-span-2">
                                            <span className="text-[10px] uppercase font-black text-neutral-500 block">
                                                RSVP Notes / Questions for Organizers
                                            </span>
                                            <p className="text-neutral-900 font-medium italic text-xs leading-relaxed">
                                                "{attendee.notes}"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Bottom Reset Bar */}
                            <div className="p-4 rounded-2xl bg-white border-2 border-black flex items-center justify-between gap-3 shadow-[2px_2px_0px_#000]">
                                <span className="text-xs font-bold text-neutral-600">
                                    Done inspecting {attendee.firstName}? Ready for next student.
                                </span>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setVerifiedResult(null);
                                        setTicketInput("");
                                        if (!cameraActive) startCamera();
                                    }}
                                    className="px-4 py-2 rounded-xl bg-[#a2ff86] hover:bg-[#8cee70] border-2 border-black font-black text-xs text-black shadow-[2px_2px_0px_#000] cursor-pointer flex items-center gap-1.5 transition-transform active:translate-x-0.5 active:translate-y-0.5"
                                >
                                    <ScanLine className="w-3.5 h-3.5" />
                                    <span>Scan Next Attendee</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
