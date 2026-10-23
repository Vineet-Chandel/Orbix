import fs from "fs";
import readline from "readline";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rl = readline.createInterface({
    input: fs.createReadStream(path.join(__dirname, "aishe_raw_directory.csv")),
    crlfDelay: Infinity,
});

let lineNum = 0;
let matchedColleges = 0;
let unmatchedColleges = 0;
let matchedUnis = 0;
const uniqueAisheCodes = new Set<string>();
const uniqueUniCodes = new Set<string>();
const states = new Set<string>();
const districts = new Set<string>();
const types = new Set<string>();

function parseCSVLine(text: string): string[] {
    const result: string[] = [];
    let cur = "";
    let inQuotes = false;
    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (c === '"') {
            inQuotes = !inQuotes;
        } else if (c === "," && !inQuotes) {
            result.push(cur);
            cur = "";
        } else {
            cur += c;
        }
    }
    result.push(cur);
    return result;
}

rl.on("line", (line) => {
    lineNum++;
    if (lineNum === 1) return; // Header
    const cols = parseCSVLine(line);
    if (cols.length < 6 || !cols[1] || !cols[2]) return;
    const uniCol = (cols[1] || "").trim();
    const collegeCol = (cols[2] || "").trim();
    const typeCol = (cols[3] || "").trim();
    const stateCol = (cols[4] || "").trim();
    const districtCol = (cols[5] || "").trim();

    if (stateCol) states.add(stateCol);
    if (districtCol) districts.add(districtCol);
    if (typeCol) types.add(typeCol);

    const cMatch = collegeCol.match(/^(.*?)\s*\(Id:\s*([CUS]-\d+)\)$/i);
    if (cMatch && cMatch[2]) {
        matchedColleges++;
        uniqueAisheCodes.add(cMatch[2].toUpperCase());
    } else {
        unmatchedColleges++;
        if (unmatchedColleges <= 5) {
            console.log("Unmatched college line:", lineNum, collegeCol);
        }
    }

    const uMatch = uniCol.match(/^(.*?)\s*\(Id:\s*([CUS]-\d+)\)$/i);
    if (uMatch && uMatch[2]) {
        matchedUnis++;
        uniqueUniCodes.add(uMatch[2].toUpperCase());
    }
});

rl.on("close", () => {
    console.log("--- AISHE Raw Directory Analysis ---");
    console.log("Total data lines processed:", lineNum - 1);
    console.log("Matched colleges with AISHE code:", matchedColleges);
    console.log("Unique college AISHE codes:", uniqueAisheCodes.size);
    console.log("Unmatched college lines:", unmatchedColleges);
    console.log("Unique University AISHE codes:", uniqueUniCodes.size);
    console.log("States & UTs covered:", states.size);
    console.log("Districts covered:", districts.size);
    console.log("College Types:", Array.from(types));
});
