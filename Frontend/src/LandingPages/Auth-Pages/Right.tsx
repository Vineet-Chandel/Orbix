import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface itrigger {
    trigger: boolean;
}

/* ─────────────────────────────────────────────
   Pixel Font & Word Grid Generator
   ───────────────────────────────────────────── */
const FONT: Record<string, string[]> = {
    A: ["010", "101", "111", "101", "101"],
    B: ["110", "101", "110", "101", "110"],
    C: ["011", "100", "100", "100", "011"],
    D: ["110", "101", "101", "101", "110"],
    E: ["111", "100", "110", "100", "111"],
    F: ["111", "100", "110", "100", "100"],
    G: ["011", "100", "101", "101", "011"],
    H: ["101", "101", "111", "101", "101"],
    I: ["111", "010", "010", "010", "111"],
    J: ["011", "001", "001", "101", "010"],
    K: ["101", "101", "110", "101", "101"],
    L: ["100", "100", "100", "100", "111"],
    M: ["101", "111", "111", "101", "101"],
    N: ["101", "111", "111", "111", "101"],
    O: ["111", "101", "101", "101", "111"],
    P: ["110", "101", "110", "100", "100"],
    R: ["110", "101", "110", "101", "101"],
    S: ["011", "100", "010", "001", "110"],
    T: ["111", "010", "010", "010", "010"],
    U: ["101", "101", "101", "101", "111"],
    V: ["101", "101", "101", "101", "010"],
    W: ["101", "101", "111", "111", "101"],
    X: ["101", "101", "010", "101", "101"],
    Y: ["101", "101", "010", "010", "010"],
};

const WORDS = [
    "CODE",
    "BUILD",
    "DEBUG",
    "FIX",
    "FLOW",
    "JOBS",
    "TRACK",
    "PULSE",
    "EVOLVE",
    "GROW",
    "LEAD",
] as const;

type Word = (typeof WORDS)[number];

function makeWordGrid(word: Word): number[][] {
    const ROWS = 14;
    const colRepeat = 2;
    const rowRepeat = 2;
    // Tighter spacing for longer words so they fit gracefully
    const letterSpacing = word.length >= 6 ? 1 : 2;
    const charWidth = 3 * colRepeat; // 6 cols per letter

    const wordWidth = word.length * charWidth + (word.length - 1) * letterSpacing;
    const padCols = 2; // 2 padding columns on each side
    const COLS = wordWidth + padCols * 2;

    const grid = Array.from(
        { length: ROWS },
        () => Array<number>(COLS).fill(0)
    );

    const startCol = padCols;
    const startRow = Math.floor((ROWS - 5 * rowRepeat) / 2); // (14 - 10) / 2 = 2

    [...word].forEach((letter, letterIndex) => {
        const glyph = FONT[letter] || ["000", "000", "000", "000", "000"];

        glyph.forEach((line, glyphRow) => {
            for (let rRep = 0; rRep < rowRepeat; rRep++) {
                const row = startRow + glyphRow * rowRepeat + rRep;

                [...line].forEach((pixel, pixelCol) => {
                    if (pixel === "1") {
                        for (let cRep = 0; cRep < colRepeat; cRep++) {
                            const col =
                                startCol +
                                letterIndex * (charWidth + letterSpacing) +
                                pixelCol * colRepeat +
                                cRep;

                            if (row >= 0 && row < ROWS && col >= 0 && col < COLS) {
                                grid[row][col] = 1;
                            }
                        }
                    }
                });
            }
        });
    });

    return grid;
}

const WORD_GRIDS: Record<Word, number[][]> = Object.fromEntries(
    WORDS.map((word) => [word, makeWordGrid(word)])
) as Record<Word, number[][]>;

/* ─────────────────────────────────────────────
   Pixel‑block utility – one responsive row
   Sized using percentages so it seamlessly scales
   with container height and width with zero overflow.
   ───────────────────────────────────────────── */
function PixelRow({
    cells,
    color,
    delay = 0,
}: {
    cells: number[]; // 1 = filled, 0 = empty
    color: string;   // tailwind‑compatible bg class or inline style
    delay?: number;
}) {
    return (
        <motion.div
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.45, delay, ease: "easeOut" }}
            className="flex w-full flex-1 min-h-0"
            style={{ gap: 0 }}
        >
            {cells.map((c, i) => (
                <div
                    key={i}
                    style={{
                        width: `${100 / cells.length}%`,
                        height: "100%",
                        background: c ? undefined : "transparent",
                    }}
                    className={c ? color : ""}
                />
            ))}
        </motion.div>
    );
}

function SignInBanner() {
    const [wordIndex, setWordIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setWordIndex((prev) => (prev + 1) % WORDS.length);
        }, 2000);
        return () => clearInterval(timer);
    }, []);

    const currentWord = WORDS[wordIndex];
    const currentGrid = WORD_GRIDS[currentWord];

    const topRows = [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0],
        [0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0],
        [0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0],
        [0, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];
    const topColors = [
        "bg-[#00a2ff]",
        "bg-[#00b0ff]",
        "bg-[#00bfff]",
        "bg-[#00ccee]",
        "bg-[#00d4dd]",
        "bg-[#00ddcc]",
        "bg-[#00e5c0]",
        "bg-[#00e5c0]",
    ];

    const bottomColors = [
        "bg-[#00a2ff]",
        "bg-[#00b0ff]",
        "bg-[#00bfff]",
        "bg-[#00ccee]",
        "bg-[#00d4dd]",
        "bg-[#00ddcc]",
        "bg-[#00a2ff]",
        "bg-[#00b0ff]",
        "bg-[#00bfff]",
        "bg-[#00ccee]",
        "bg-[#00d4dd]",
        "bg-[#00ddcc]",
        "bg-[#00e5c0]",
        "bg-[#00e5c0]",
    ];

    return (
        <div className="relative w-full h-full overflow-hidden bg-[#111118] flex flex-col justify-between select-none border border-white/[0.04]">
            {/* Gradients */}
            <div className="absolute top-0 left-0 w-full h-[50%] bg-gradient-to-b from-[#ff6a33]/8 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-full h-[50%] bg-gradient-to-t from-[#9058e8]/8 to-transparent pointer-events-none" />

            {/* Top pixel blocks – 22% of total height */}
            <div className="relative z-10 w-full h-[22%] flex flex-col justify-stretch min-h-0">
                {topRows.map((row, ri) => (
                    <PixelRow
                        key={ri}
                        cells={row}
                        color={topColors[ri] || topColors[topColors.length - 1]}
                        delay={ri * 0.04}
                    />
                ))}
            </div>

            {/* Top Badges */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="absolute top-2 sm:top-3 left-3 sm:left-4 right-3 sm:right-4 z-20 flex justify-between items-center pointer-events-none"
            >
                <span className="text-[10px] sm:text-xs font-mono text-black font-extrabold tracking-wider uppercase">
                    PSIT
                </span>
                <span className="text-[10px] sm:text-xs font-mono text-black font-extrabold tracking-wider uppercase">
                    AWS SBG
                </span>
            </motion.div>

            {/* Center content – 44% of total height */}
            <div className="relative z-10 w-full h-[44%] flex flex-col items-start justify-center px-4 sm:px-6 lg:px-8 min-h-0">
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.35 }}
                    className="font-bold font-mono text-white tracking-tight leading-[1.15]"
                    style={{ fontSize: "clamp(1.15rem, 2.2vw + 1.2vh, 2.65rem)" }}
                >
                    Build with <span className="text-cyan-400">Codexa</span>,
                    <br />
                    Evolve with  <span className="text-cyan-400">Evolexa</span>,
                    <br />
                    Automate with  <span className="text-cyan-400">Flowexa</span>.
                </motion.h2>
            </div>

            {/* Bottom dynamic word pixel grid – 34% of total height, changing every 2s */}
            <div className="relative z-10 w-full h-[34%] flex flex-col justify-stretch min-h-0 overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentWord}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.35, ease: "easeInOut" }}
                        className="w-full h-full flex flex-col justify-stretch min-h-0"
                    >
                        {currentGrid.map((row, ri) => (
                            <div
                                key={ri}
                                className="flex w-full flex-1 min-h-0"
                                style={{ gap: 0 }}
                            >
                                {row.map((cell, ci) => (
                                    <div
                                        key={ci}
                                        style={{
                                            width: `${100 / row.length}%`,
                                            height: "100%",
                                            background: cell ? undefined : "transparent",
                                        }}
                                        className={`transition-colors duration-200 ${cell
                                            ? bottomColors[ri % bottomColors.length]
                                            : "bg-transparent"
                                            }`}
                                    />
                                ))}
                            </div>
                        ))}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

function SignUpBanner() {
    const [wordIndex, setWordIndex] = useState(0);

    useEffect(() => {
        const timer = setInterval(() => {
            setWordIndex((prev) => (prev + 1) % WORDS.length);
        }, 2000);
        return () => clearInterval(timer);
    }, []);

    const currentWord = WORDS[wordIndex];
    const currentGrid = WORD_GRIDS[currentWord];

    const topRows = [
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0],
        [0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0],
        [0, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 0],
        [0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0, 1, 0, 0, 0],
        [0, 0, 1, 1, 1, 0, 1, 0, 1, 0, 1, 1, 1, 0, 1, 1, 1, 0, 1, 0, 1, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    ];

    const topColors = [
        "bg-[#ff6a33]",
        "bg-[#ff5c45]",
        "bg-[#ff4e5a]",
        "bg-[#ff4070]",
        "bg-[#f53888]",
        "bg-[#e830a0]",
        "bg-[#d828b8]",
    ];

    const bottomColors = [
        "bg-[#d828b8]",
        "bg-[#cc30c0]",
        "bg-[#c038c8]",
        "bg-[#b440d0]",
        "bg-[#a848d8]",
        "bg-[#9c50e0]",
        "bg-[#9058e8]",
        "bg-[#8460f0]",
        "bg-[#7868f8]",
        "bg-[#6c70ff]",
        "bg-[#8460f0]",
        "bg-[#9058e8]",
        "bg-[#9c50e0]",
        "bg-[#a848d8]",
    ];

    return (
        <div className="relative w-full h-full overflow-hidden bg-[#111118] flex flex-col justify-between select-none border border-white/[0.04]">
            {/* Gradients */}
            <div className="absolute top-0 left-0 w-full h-[50%] bg-gradient-to-b from-[#ff6a33]/8 to-transparent pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-full h-[50%] bg-gradient-to-t from-[#9058e8]/8 to-transparent pointer-events-none" />

            {/* Top pixel blocks – 22% of total height */}
            <div className="relative z-10 w-full h-[22%] flex flex-col justify-stretch min-h-0">
                {topRows.map((row, ri) => (
                    <PixelRow
                        key={ri}
                        cells={row}
                        color={topColors[ri] || topColors[topColors.length - 1]}
                        delay={ri * 0.04}
                    />
                ))}
            </div>

            {/* Top Badges */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.6, delay: 0.3 }}
                className="absolute top-2 sm:top-3 left-3 sm:left-4 right-3 sm:right-4 z-20 flex justify-between items-center pointer-events-none"
            >
                <span className="text-[10px] sm:text-xs font-mono text-black font-extrabold tracking-wider uppercase">
                    PSIT
                </span>
                <span className="text-[10px] sm:text-xs font-mono text-black font-extrabold tracking-wider uppercase">
                    AWS SBG
                </span>
            </motion.div>

            {/* Center content – 44% of total height */}
            <div className="relative z-10 w-full h-[44%] flex flex-col items-start justify-center px-4 sm:px-6 lg:px-8 min-h-0">
                <motion.h2
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.35 }}
                    className="font-bold font-mono text-white tracking-tight leading-[1.15]"
                    style={{ fontSize: "clamp(1.15rem, 2.2vw + 1.2vh, 2.65rem)" }}
                >
                    Build with <span className="text-pink-400">Codexa</span>,
                    <br />
                    Evolve with  <span className="text-pink-400">Evolexa</span>,
                    <br />
                    Automate with  <span className="text-pink-400">Flowexa</span>.
                </motion.h2>
            </div>

            {/* Bottom dynamic word pixel grid – 34% of total height, changing every 2s */}
            <div className="relative z-10 w-full h-[34%] flex flex-col justify-stretch min-h-0 overflow-hidden">
                <AnimatePresence mode="wait">
                    <motion.div
                        key={currentWord}
                        initial={{ opacity: 0, scale: 0.96 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.35, ease: "easeInOut" }}
                        className="w-full h-full flex flex-col justify-stretch min-h-0"
                    >
                        {currentGrid.map((row, ri) => (
                            <div
                                key={ri}
                                className="flex w-full flex-1 min-h-0"
                                style={{ gap: 0 }}
                            >
                                {row.map((cell, ci) => (
                                    <div
                                        key={ci}
                                        style={{
                                            width: `${100 / row.length}%`,
                                            height: "100%",
                                            background: cell ? undefined : "transparent",
                                        }}
                                        className={`transition-colors duration-200 ${cell
                                            ? bottomColors[ri % bottomColors.length]
                                            : "bg-transparent"
                                            }`}
                                    />
                                ))}
                            </div>
                        ))}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}

export default function Right({ trigger }: itrigger) {
    if (trigger) {
        return <SignInBanner />;
    } else {
        return <SignUpBanner />;
    }
}