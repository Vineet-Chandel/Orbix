import { memo, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from "react";
import { animate, motion, useInView, useMotionValue, useMotionValueEvent, useReducedMotion, useTransform } from "framer-motion";
import { CircleDot, Cuboid } from "lucide-react";
import type { DaySubmissionCell } from "../../utils/submissionsAggregator";
import "./InteractiveActivityHeatmap.css";

interface InteractiveActivityHeatmapProps {
    weeks: DaySubmissionCell[][];
    monthNames: string[];
    colors: readonly string[];
    activity: "submissions" | "contributions";
    onHoverDay: (day: DaySubmissionCell | null) => void;
}

const WIDTH = 1100;
const FLAT_HEIGHT = 220;
const RAISED_HEIGHT = 640;
const RAISED_RADIUS = 5.4;
const ROW_GAP = 70;
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const RADIUS = 7.8;
const EASE = [0.22, 1, 0.36, 1] as const;
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const mix = (from: number, to: number, progress: number) => from + (to - from) * progress;

/** Presentation only: consumes the same days, intensities and palette as the flat heatmap. */
export const InteractiveActivityHeatmap = memo(function InteractiveActivityHeatmap({
    weeks, monthNames, colors, activity, onHoverDay,
}: InteractiveActivityHeatmapProps) {
    const id = useId().replace(/:/g, "");
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const hostRef = useRef<HTMLDivElement>(null);
    const contextRef = useRef<CanvasRenderingContext2D | null>(null);
    const scaleRef = useRef(1);
    const hitsRef = useRef<Array<{ index: number; x: number; top: number; bottom: number; ry: number; radius: number }>>([]);
    const keyboardFocus = useRef(false);
    const statusRef = useRef<HTMLSpanElement>(null);
    const focusedIndex = useRef(0);
    const hoveredIndex = useRef<number | null>(null);
    const gesture = useRef({ x: 0, y: 0, moved: false });
    const [raised, setRaised] = useState(false);
    const [focusedDay, setFocusedDay] = useState<number | null>(null);
    const reduceMotion = useReducedMotion();
    const inView = useInView(hostRef, { margin: "100px" });

    // One finite animation drives every cylinder; there are no per-day animation loops.
    const progress = useMotionValue(0);
    const measuredWidth = useMotionValue(WIDTH);
    const canvasHeight = useTransform(() => measuredWidth.get() / WIDTH * mix(FLAT_HEIGHT, RAISED_HEIGHT, progress.get()));

    const days = useMemo(() => {
        const peak = Math.max(1, ...weeks.flat().map(day => day.count));
        return weeks.flatMap((week, w) => week.map((day, d) => ({
            day, w, d,
            flatX: 42 + (w + 0.5) * (1044 / Math.max(weeks.length, 1)),
            flatY: 62 + d * 22,
            raisedX: 72 + w * (948 / Math.max(weeks.length - 1, 1)) + d * 9.5,
            raisedY: 92 + w * (54 / Math.max(weeks.length - 1, 1)) + d * ROW_GAP,
            // A visual height scale over unchanged daily counts; no activity is invented.
            height: day.count > 0 ? 7 + 49 * Math.pow(day.count / peak, 0.7) : 0,
        })));
    }, [weeks]);

    // Paint distant columns first so nearby cylinders naturally occlude them.
    const paintOrder = useMemo(() => days.map((day, index) => ({ ...day, index }))
        .sort((a, b) => a.raisedY - b.raisedY || a.raisedX - b.raisedX), [days]);

    const draw = useCallback((p: number) => {
        const ctx = contextRef.current;
        const canvas = canvasRef.current;
        if (!ctx || !canvas) return;
        const scale = scaleRef.current;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // A fixed-size backing store avoids reallocating a bitmap on every animation frame.
        ctx.setTransform(scale, 0, 0, scale * RAISED_HEIGHT / mix(FLAT_HEIGHT, RAISED_HEIGHT, p), 0, 0);
        const radius = mix(RADIUS, RAISED_RADIUS, p);
        const ry = mix(RADIUS, 3.2, p);
        // Each weekday has its own lane. Even the tallest column stays below
        // the next lane, so the annual overview has no hidden cylinders.
        ctx.globalAlpha = p;
        ctx.strokeStyle = '#00000012';
        ctx.lineWidth = 0.65;
        for (let row = 0; row < 7; row++) {
            ctx.beginPath();
            ctx.moveTo(72 + row * 9.5, 92 + row * ROW_GAP);
            ctx.lineTo(1020 + row * 9.5, 146 + row * ROW_GAP);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
        const hits = hitsRef.current;
        hits.length = paintOrder.length;
        let paintIndex = 0;
        for (const model of paintOrder) {
            const x = mix(model.flatX, model.raisedX, p);
            const y = mix(model.flatY, model.raisedY, p);
            const wave = model.w / Math.max(weeks.length - 1, 1) * 0.13;
            const height = model.height * clamp((p - wave) / (1 - wave));
            const inFocusedRow = focusedDay === null || model.d === focusedDay;
            ctx.globalAlpha = inFocusedRow ? 1 : mix(1, 0.12, p);
            const color = colors[model.day.level] || colors[0];
            if (height > 0.01) {
                ctx.beginPath();
                ctx.moveTo(x - radius, y - height);
                ctx.lineTo(x - radius, y);
                ctx.bezierCurveTo(x - radius, y + ry * 1.34, x + radius, y + ry * 1.34, x + radius, y);
                ctx.lineTo(x + radius, y - height);
                ctx.closePath();
                ctx.fillStyle = color;
                ctx.fill();
                // A small shaded edge gives each column depth, without filters or 3D meshes.
                ctx.fillStyle = '#00000024';
                ctx.fillRect(x + radius * 0.25, y - height, radius * 0.75, height);
                ctx.fillStyle = '#ffffff26';
                ctx.fillRect(x - radius * 0.8, y - height, radius * 0.25, height);
            }
            ctx.beginPath();
            ctx.ellipse(x, y - height, radius, ry, 0, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
            const highlighted = hoveredIndex.current === model.index || (keyboardFocus.current && focusedIndex.current === model.index);
            ctx.strokeStyle = model.day.level === 0 && !highlighted ? '#00000040' : '#000';
            ctx.lineWidth = highlighted ? 2 : 0.85;
            ctx.stroke();
            if (!inFocusedRow && p > 0.5) continue;
            const hit = hits[paintIndex] || (hits[paintIndex] = { index: model.index, x, top: y - height, bottom: y, ry, radius });
            hit.index = model.index;
            hit.x = x;
            hit.top = y - height;
            hit.bottom = y;
            hit.ry = ry;
            hit.radius = radius;
            paintIndex++;
        }
        hits.length = paintIndex;
        hitsRef.current = hits;
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#404040';
        ctx.font = '700 11px ui-monospace, SFMono-Regular, Menlo, monospace';
        monthNames.forEach((month, index) => {
            const fraction = index / Math.max(monthNames.length, 1);
            ctx.save();
            ctx.translate(mix(42 + fraction * 1044, 138 + fraction * 948, p), mix(29, 92 + 6 * ROW_GAP + 28 + fraction * 54, p));
            ctx.rotate(p * 3.3 * Math.PI / 180);
            ctx.fillText(month, 0, 0);
            ctx.restore();
        });
        ctx.globalAlpha = 1 - p;
        ctx.font = '700 10px ui-monospace, SFMono-Regular, Menlo, monospace';
        ['Mon', 'Wed', 'Fri'].forEach((day, index) => ctx.fillText(day, 1, 88 + index * 44));
        ctx.globalAlpha = p;
        WEEKDAYS.forEach((day, row) => {
            ctx.fillStyle = focusedDay === null || focusedDay === row ? '#404040' : '#a3a3a3';
            ctx.fillText(day, 42 + row * 9.5, 95 + row * ROW_GAP);
        });
        ctx.globalAlpha = 1;
    }, [paintOrder, weeks.length, monthNames, colors, focusedDay]);

    useMotionValueEvent(progress, 'change', draw);
    useLayoutEffect(() => {
        const host = hostRef.current;
        const canvas = canvasRef.current;
        if (!host || !canvas) return;
        contextRef.current = canvas.getContext('2d');
        let lastWidth = -1;
        let lastDpr = -1;
        const resize = () => {
            const width = host.getBoundingClientRect().width;
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            if (width === lastWidth && dpr === lastDpr) return;
            lastWidth = width;
            lastDpr = dpr;
            const scale = width / WIDTH * dpr;
            scaleRef.current = scale;
            canvas.width = Math.ceil(WIDTH * scale);
            canvas.height = Math.ceil(RAISED_HEIGHT * scale);
            measuredWidth.set(width);
            draw(progress.get());
        };
        resize();
        const observer = new ResizeObserver(resize);
        observer.observe(host);
        return () => observer.disconnect();
    }, [draw, measuredWidth, progress]);

    useEffect(() => {
        const target = raised ? 1 : 0;
        const canvas = canvasRef.current;
        if (reduceMotion || !inView || progress.get() === target) {
            progress.jump(target);
            if (canvas) canvas.dataset.animation = 'idle';
            return;
        }
        if (canvas) canvas.dataset.animation = 'running';
        const playback = animate(progress, target, {
            duration: 0.85, ease: EASE,
            onComplete: () => { if (canvas) canvas.dataset.animation = 'idle'; },
        });
        return () => playback.stop();
    }, [raised, reduceMotion, inView, progress]);

    const inspectDay = (index: number, announce = false) => {
        const model = days[index];
        if (!model) return;
        focusedIndex.current = index;
        if (announce) { keyboardFocus.current = true; hoveredIndex.current = null; }
        if (canvasRef.current) canvasRef.current.title = `${model.day.count} ${activity} on ${model.day.displayDate}`;
        draw(progress.get());
        onHoverDay(model.day);
        if (announce && statusRef.current) {
            statusRef.current.textContent = `${model.day.count} ${activity} on ${model.day.displayDate}${model.day.platforms.length ? ` via ${model.day.platforms.join(", ")}` : ""}`;
        }
    };

    const inspectPointer = (clientX: number, clientY: number, canvas: HTMLCanvasElement) => {
        keyboardFocus.current = false;
        const rect = canvas.getBoundingClientRect();
        const x = (clientX - rect.left) / rect.width * WIDTH;
        const y = (clientY - rect.top) / rect.height * mix(FLAT_HEIGHT, RAISED_HEIGHT, progress.get());
        // Reverse paint order picks the visible cylinder, including its side wall.
        const hit = hitsRef.current.findLast(cell => Math.abs(x - cell.x) <= cell.radius && y >= cell.top - cell.ry && y <= cell.bottom + cell.ry);
        const index = hit?.index ?? null;
        if (index !== hoveredIndex.current) {
            hoveredIndex.current = index;
            if (index !== null) inspectDay(index);
            else { canvas.title = ""; onHoverDay(null); draw(progress.get()); }
        }
    };

    return (
        <div className="activity-heatmap py-3 relative z-10">
            <div className="flex items-center justify-between gap-3 mb-2 px-0.5">
                <span className="text-[11px] font-medium text-neutral-500">Tap the chart to {raised ? "return to dots" : "explore in 3D"}</span>
                <button
                    type="button"
                    aria-label={`${raised ? "Flatten" : "Raise"} ${activity} chart`}
                    aria-pressed={raised}
                    onClick={() => setRaised(value => !value)}
                    className="activity-heatmap-toggle inline-flex items-center gap-1.5 shrink-0 rounded-lg border border-black bg-[#FAF6EE] px-2.5 py-1.5 text-[11px] font-black text-black shadow-[1px_1px_0px_#000] hover:bg-neutral-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
                >
                    {raised ? <CircleDot size={13} /> : <Cuboid size={13} />}
                    {raised ? "Flat view" : "3D view"}
                </button>
            </div>
            {raised && (
                <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Highlight a weekday row">
                    <span className="mr-1 text-[10px] font-bold text-neutral-500">Inspect row</span>
                    {[null, 0, 1, 2, 3, 4, 5, 6].map(day => (
                        <button
                            key={day ?? "all"}
                            type="button"
                            aria-pressed={focusedDay === day}
                            aria-label={day === null ? "Show all weekday rows" : `Highlight ${WEEKDAYS[day]} row`}
                            onClick={() => {
                                setFocusedDay(day);
                                hoveredIndex.current = null;
                                if (canvasRef.current) canvasRef.current.title = "";
                                onHoverDay(null);
                                if (day !== null) focusedIndex.current = Math.min(days.length - 1, Math.floor(focusedIndex.current / 7) * 7 + day);
                            }}
                            className={`rounded-md border px-2 py-1 text-[10px] font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black ${focusedDay === day ? "border-black bg-black text-white" : "border-black/15 bg-white text-neutral-600 hover:border-black hover:text-black"}`}
                        >
                            {day === null ? "All" : WEEKDAYS[day]}
                        </button>
                    ))}
                    <span className="ml-auto text-[10px] text-neutral-500">Separated rows · height shows daily activity</span>
                </div>
            )}
            <div className="overflow-x-auto overscroll-x-contain scrollbar-none" style={{ WebkitOverflowScrolling: "touch" }}>
                <div ref={hostRef} className="min-w-[700px] w-full">
                    <motion.canvas
                        ref={canvasRef}
                        className="activity-heatmap-scene block w-full rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-black"
                        style={{ height: canvasHeight }}
                        role="button"
                        tabIndex={0}
                        aria-label={`${activity === "submissions" ? "Practice submissions" : "Development contributions"} activity chart`}
                        aria-pressed={raised}
                        aria-describedby={`${id}-instructions ${id}-status`}
                        data-view={raised ? "raised" : "flat"}
                        onClick={event => { if (event.detail === 0 || !gesture.current.moved) setRaised(value => !value); }}
                        onPointerDown={event => {
                            gesture.current = { x: event.clientX, y: event.clientY, moved: false };
                            inspectPointer(event.clientX, event.clientY, event.currentTarget);
                        }}
                        onPointerMove={event => {
                            if (Math.hypot(event.clientX - gesture.current.x, event.clientY - gesture.current.y) > 8) gesture.current.moved = true;
                            inspectPointer(event.clientX, event.clientY, event.currentTarget);
                        }}
                        onPointerCancel={() => { gesture.current.moved = true; }}
                        onPointerLeave={() => { hoveredIndex.current = null; if (canvasRef.current) canvasRef.current.title = ""; onHoverDay(null); draw(progress.get()); }}
                        onFocus={() => inspectDay(focusedIndex.current, true)}
                        onBlur={() => { keyboardFocus.current = false; if (canvasRef.current) canvasRef.current.title = ""; onHoverDay(null); draw(progress.get()); }}
                        onKeyDown={event => {
                            if (event.key === "Enter" || event.key === " ") {
                                event.preventDefault();
                                setRaised(value => !value);
                            } else if (event.key === "Escape") {
                                setRaised(false);
                            } else {
                                const delta = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: !raised || focusedDay === null ? -1 : -7, ArrowDown: !raised || focusedDay === null ? 1 : 7 }[event.key];
                                if (delta !== undefined) {
                                    event.preventDefault();
                                    inspectDay(Math.max(0, Math.min(days.length - 1, focusedIndex.current + delta)), true);
                                }
                            }
                        }}
                    >
                        {days.map(({day}) => `${day.dateStr}: ${day.count} ${activity}`).join('; ')}
                    </motion.canvas>
                </div>
            </div>
            <span id={`${id}-instructions`} className="sr-only">Press Enter or Space to toggle the raised view. Use arrow keys to inspect days. Escape returns to the flat view. In the raised view, separated weekday rows keep all cylinders visible. Weekday buttons highlight one row without changing the data.</span>
            <span id={`${id}-status`} ref={statusRef} role="status" aria-live="polite" className="sr-only" />
        </div>
    );
});
