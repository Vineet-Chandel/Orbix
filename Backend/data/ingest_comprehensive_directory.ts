import fs from "fs";
import path from "path";
import readline from "readline";
import { fileURLToPath } from "url";
import { query } from "../src/database/client.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface RawInstitutionRecord {
    aisheCode: string;
    officialName: string;
    aliases: string[];
    state: string;
    district: string;
    city: string;
    institutionType: string;
    website?: string;
    verificationStatus: "verified" | "needs_review" | "unverified" | "inactive";
    verificationBasis: string;
    sourceName: string;
    sourceUrl: string;
    regulator?: string;
    regulatorId?: string;
}

interface ParsedCollegeRow {
    aisheCode: string;
    officialName: string;
    normalizedName: string;
    aliases: string[];
    state: string;
    district: string;
    city: string;
    institutionType: string;
    parentUniversity: string;
    verificationStatus: string;
    verificationBasis: string;
}

/**
 * Normalizes an institution name for robust search indexing:
 * - lowercase
 * - strips commas, periods, hyphens, brackets
 * - collapses consecutive spaces
 */
export function normalizeInstitutionName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[,.\-()\[\]/]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Preserves standard higher-ed acronyms while converting SHOUTING ALL-CAPS names
 * into readable Title Case.
 */
export function toSmartTitleCase(str: string): string {
    const acronyms = new Set([
        "IIT", "NIT", "IIIT", "IIM", "AIIMS", "BITS", "VIT", "DTU", "NSUT",
        "PSIT", "SRM", "KIIT", "AKTU", "VTU", "GNDU", "JNTU", "RGPV", "COEP",
        "VJTI", "ICT", "MIT", "RVCE", "BMSCE", "MSRIT", "PES", "CBIT",
        "B.ED", "M.ED", "B.SC", "M.SC", "B.A", "M.A", "B.COM", "M.COM",
        "MBA", "MCA", "BBA", "BCA", "B.TECH", "M.TECH", "PH.D", "MBBS",
        "BDS", "MD", "MS", "G.N.M.", "A.N.M.", "PG", "UG", "CET", "COE"
    ]);

    const lowercaseWords = new Set(["and", "of", "in", "for", "the", "&", "on", "at", "to"]);

    return str
        .split(/\s+/)
        .map((word, idx) => {
            const stripped = word.replace(/[^A-Za-z0-9.]/g, "").toUpperCase();
            if (acronyms.has(stripped)) {
                return word.toUpperCase();
            }
            if (idx > 0 && lowercaseWords.has(word.toLowerCase())) {
                return word.toLowerCase();
            }
            if (word.length <= 1) return word.toUpperCase();
            return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
        })
        .join(" ");
}

/**
 * Generates automated acronyms and popular abbreviations:
 * e.g. "Pranveer Singh Institute of Technology" -> ["PSIT"]
 */
export function generateDerivedAliases(officialName: string, existingAliases: string[] = []): string[] {
    const aliasSet = new Set<string>(existingAliases.map((a) => a.trim()).filter(Boolean));

    const words = officialName
        .replace(/[,.\-()\[\]/]/g, " ")
        .split(/\s+/)
        .filter((w) => !["of", "and", "in", "the", "for", "&", "on", "at", "to"].includes(w.toLowerCase()));

    if (words.length > 1) {
        const acronym = words.map((w) => w[0]?.toUpperCase()).join("");
        if (acronym.length >= 2 && acronym.length <= 8) {
            aliasSet.add(acronym);
        }
    }

    // Specific domain heuristics
    const lower = officialName.toLowerCase();
    if (lower.includes("pranveer singh institute of technology")) {
        aliasSet.add("PSIT");
        aliasSet.add("PSIT Kanpur");
        aliasSet.add("Pranveer Singh Institute of Technology");
    } else if (lower.includes("psit college of engineering")) {
        aliasSet.add("PSIT");
        aliasSet.add("PSIT COE");
        aliasSet.add("PSIT Kanpur");
    } else if (lower.includes("galgotias institute of management")) {
        aliasSet.add("Galgotias");
        aliasSet.add("GIMT");
        aliasSet.add("GIMT Greater Noida");
    } else if (lower.includes("galgotia") && lower.includes("engineering")) {
        aliasSet.add("Galgotias");
        aliasSet.add("GCET");
        aliasSet.add("Galgotias College");
    } else if (lower.includes("galgotias university")) {
        aliasSet.add("Galgotias");
        aliasSet.add("Galgotias University");
        aliasSet.add("GU");
    }

    return Array.from(aliasSet);
}

/**
 * Parses standard CSV line handling quotes and commas
 */
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

export async function runComprehensiveIngestion() {
    console.log("================================================================================");
    console.log("🏛️  COMPREHENSIVE INDIAN HIGHER-EDUCATION DIRECTORY INGESTION PIPELINE");
    console.log("================================================================================");
    const startTime = Date.now();

    // -------------------------------------------------------------------------
    // STEP 1: Ingest Curated Universities & Institutes of National Importance
    // -------------------------------------------------------------------------
    console.log("\n📦 Step 1: Ingesting Curated National Institutions (Universities, IITs, NITs, INIs)...");
    const seedFilePath = path.join(__dirname, "institutions_seed.json");
    const rawSeed = fs.readFileSync(seedFilePath, "utf-8");
    const seedRecords: RawInstitutionRecord[] = JSON.parse(rawSeed);

    let seedInserted = 0;
    for (const record of seedRecords) {
        const cleanName = record.officialName.trim();
        const normName = normalizeInstitutionName(cleanName);
        const aliases = generateDerivedAliases(cleanName, record.aliases || []);

        const res = await query(
            `INSERT INTO institutions (
                official_name,
                normalized_name,
                aliases,
                aishe_code,
                state,
                district,
                city,
                institution_type,
                website,
                verification_status,
                verification_basis,
                is_active,
                source_year,
                last_verified_at,
                updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, '2023-24', NOW(), NOW())
            ON CONFLICT (aishe_code) DO UPDATE SET
                official_name = EXCLUDED.official_name,
                normalized_name = EXCLUDED.normalized_name,
                aliases = ARRAY(SELECT DISTINCT unnest(institutions.aliases || EXCLUDED.aliases)),
                state = COALESCE(institutions.state, EXCLUDED.state),
                district = COALESCE(institutions.district, EXCLUDED.district),
                city = COALESCE(institutions.city, EXCLUDED.city),
                institution_type = COALESCE(institutions.institution_type, EXCLUDED.institution_type),
                website = COALESCE(institutions.website, EXCLUDED.website),
                verification_status = EXCLUDED.verification_status,
                verification_basis = EXCLUDED.verification_basis,
                is_active = true,
                last_verified_at = NOW(),
                updated_at = NOW()
            RETURNING id;`,
            [
                cleanName,
                normName,
                aliases,
                record.aisheCode.toUpperCase(),
                record.state || "India",
                record.district || null,
                record.city || null,
                record.institutionType || "Higher Education Institution",
                record.website || null,
                record.verificationStatus || "verified",
                record.verificationBasis || "Verified from AISHE / UGC / Regulatory directories",
            ]
        );

        if (res.rows[0]?.id) {
            const instId = res.rows[0].id;
            // Record source evidence
            await query(
                `INSERT INTO institution_sources (
                    institution_id, source_name, source_url, source_record_id, source_publication_year, verification_result, notes
                ) VALUES ($1, $2, $3, $4, '2023-24', 'confirmed', $5)
                ON CONFLICT DO NOTHING;`,
                [
                    instId,
                    record.sourceName || "AISHE 2023-24 Official Directory",
                    record.sourceUrl || "https://aishe.gov.in",
                    record.aisheCode,
                    record.verificationBasis || "AISHE Directory official entry",
                ]
            );

            // Record relational aliases
            for (const alias of aliases) {
                await query(
                    `INSERT INTO institution_aliases (institution_id, alias, alias_type)
                     VALUES ($1, $2, 'popular')
                     ON CONFLICT (institution_id, alias) DO NOTHING;`,
                    [instId, alias]
                );
            }
            seedInserted++;
        }
    }
    console.log(`✅ Step 1 Finished: Ingested/updated ${seedInserted} core universities and institutes.`);

    // -------------------------------------------------------------------------
    // STEP 2: Process & Batch Ingest 38,000+ Colleges from Official AISHE CSV
    // -------------------------------------------------------------------------
    console.log("\n📦 Step 2: Streaming and batch ingesting AISHE nationwide directory (38,376 colleges)...");
    const csvFilePath = path.join(__dirname, "aishe_raw_directory.csv");
    if (!fs.existsSync(csvFilePath)) {
        throw new Error(`AISHE CSV not found at: ${csvFilePath}`);
    }

    const rl = readline.createInterface({
        input: fs.createReadStream(csvFilePath),
        crlfDelay: Infinity,
    });

    const parsedColleges: ParsedCollegeRow[] = [];
    const seenAishe = new Set<string>();
    let lineIdx = 0;

    for await (const line of rl) {
        lineIdx++;
        if (lineIdx === 1) continue; // Skip header

        const cols = parseCSVLine(line);
        if (cols.length < 6 || !cols[1] || !cols[2]) continue;

        const uniCol = (cols[1] || "").trim();
        const collegeCol = (cols[2] || "").trim();
        const typeCol = (cols[3] || "").trim();
        const stateCol = (cols[4] || "").trim();
        const districtCol = (cols[5] || "").trim();

        // Extract college AISHE code: e.g. "PRANVEER SINGH INSTITUTE OF TECHNOLOGY, KANPUR (Id: C-46844)"
        const cMatch = collegeCol.match(/^(.*?)\s*\(Id:\s*([CUS]-\d+)\)$/i);
        if (!cMatch || !cMatch[1] || !cMatch[2]) continue;

        const rawCollegeName = (cMatch[1] || "").trim();
        const aisheCode = (cMatch[2] || "").toUpperCase().trim();

        if (seenAishe.has(aisheCode)) continue; // Deduplicate within file
        seenAishe.add(aisheCode);

        // Extract university clean name
        const uMatch = uniCol.match(/^(.*?)\s*\(Id:\s*([CUS]-\d+)\)$/i);
        const parentUniversity = uMatch && uMatch[1] ? uMatch[1].trim() : uniCol;

        // Clean & Title Case official name
        const officialName = toSmartTitleCase(rawCollegeName);
        const normalizedName = normalizeInstitutionName(officialName);

        // Derive city from college name or district
        let city = districtCol;
        const commaIdx = officialName.lastIndexOf(",");
        if (commaIdx !== -1 && commaIdx < officialName.length - 2) {
            const possibleCity = officialName.slice(commaIdx + 1).trim();
            if (possibleCity.length >= 3 && possibleCity.length <= 40) {
                city = possibleCity;
            }
        }

        const aliases = generateDerivedAliases(officialName, []);

        parsedColleges.push({
            aisheCode,
            officialName,
            normalizedName,
            aliases,
            state: stateCol || "India",
            district: districtCol || null as any,
            city: city || districtCol || null as any,
            institutionType: typeCol || "Affiliated College",
            parentUniversity,
            verificationStatus: "verified",
            verificationBasis: `AISHE Directory 2023-24 official regulatory submission (Affiliated to ${parentUniversity})`,
        });
    }

    console.log(`📋 Parsed ${parsedColleges.length} unique, valid colleges from AISHE directory.`);

    // Batch Insert into Database (Chunks of 100 rows)
    const BATCH_SIZE = 100;
    let totalImported = 0;
    const totalBatches = Math.ceil(parsedColleges.length / BATCH_SIZE);

    for (let b = 0; b < totalBatches; b++) {
        const batch = parsedColleges.slice(b * BATCH_SIZE, (b + 1) * BATCH_SIZE);

        // Construct multi-row parameterized query
        const valuePlaceholders: string[] = [];
        const params: any[] = [];
        let pIdx = 1;

        for (const c of batch) {
            valuePlaceholders.push(
                `($${pIdx}, $${pIdx + 1}, $${pIdx + 2}, $${pIdx + 3}, $${pIdx + 4}, $${pIdx + 5}, $${pIdx + 6}, $${pIdx + 7}, $${pIdx + 8}, $${pIdx + 9}, $${pIdx + 10}, true, '2023-24', NOW(), NOW())`
            );
            params.push(
                c.officialName,
                c.normalizedName,
                c.aliases,
                c.aisheCode,
                c.state,
                c.district,
                c.city,
                c.institutionType,
                c.parentUniversity,
                c.verificationStatus,
                c.verificationBasis
            );
            pIdx += 11;
        }

        const sql = `
            INSERT INTO institutions (
                official_name,
                normalized_name,
                aliases,
                aishe_code,
                state,
                district,
                city,
                institution_type,
                parent_university,
                verification_status,
                verification_basis,
                is_active,
                source_year,
                last_verified_at,
                updated_at
            ) VALUES ${valuePlaceholders.join(", ")}
            ON CONFLICT (aishe_code) DO UPDATE SET
                official_name = EXCLUDED.official_name,
                normalized_name = EXCLUDED.normalized_name,
                aliases = CASE WHEN EXCLUDED.aliases IS NOT NULL AND array_length(EXCLUDED.aliases, 1) > 0 THEN EXCLUDED.aliases ELSE institutions.aliases END,
                state = COALESCE(institutions.state, EXCLUDED.state),
                district = COALESCE(institutions.district, EXCLUDED.district),
                city = COALESCE(institutions.city, EXCLUDED.city),
                institution_type = COALESCE(institutions.institution_type, EXCLUDED.institution_type),
                parent_university = COALESCE(institutions.parent_university, EXCLUDED.parent_university),
                verification_status = EXCLUDED.verification_status,
                verification_basis = EXCLUDED.verification_basis,
                is_active = true,
                last_verified_at = NOW(),
                updated_at = NOW();
        `;

        await query(sql, params);
        totalImported += batch.length;

        if ((b + 1) % 10 === 0 || b + 1 === totalBatches) {
            const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
            console.log(`   ↳ Ingested batch ${b + 1} / ${totalBatches} (${totalImported} rows total) [${elapsedSec}s elapsed]`);
        }
    }

    // -------------------------------------------------------------------------
    // STEP 3: Populate High-Priority Verified Aliases
    // -------------------------------------------------------------------------
    console.log("\n📦 Step 3: Indexing verified aliases into relational aliases table...");
    await query(`
        INSERT INTO institution_aliases (institution_id, alias, alias_type)
        SELECT i.id, unnest(i.aliases), 'popular'
        FROM institutions i
        WHERE i.aliases IS NOT NULL AND array_length(i.aliases, 1) > 0
        ON CONFLICT (institution_id, alias) DO NOTHING;
    `);

    // -------------------------------------------------------------------------
    // STEP 4: Comprehensive Ingestion & Coverage Verification
    // -------------------------------------------------------------------------
    const countRes = await query(`SELECT count(*) as total FROM institutions WHERE verification_status = 'verified' AND is_active = true;`);
    const statesRes = await query(`SELECT count(DISTINCT state) as states, count(DISTINCT district) as districts FROM institutions;`);
    const typeRes = await query(`SELECT institution_type, count(*) as count FROM institutions GROUP BY institution_type ORDER BY count DESC LIMIT 10;`);

    const elapsedTotal = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log("\n================================================================================");
    console.log("📊 COMPREHENSIVE INGESTION REPORT");
    console.log("================================================================================");
    console.log(`⏱️  Total Ingestion Duration: ${elapsedTotal} seconds`);
    console.log(`🏫 Total Verified Institutions: ${countRes.rows[0].total}`);
    console.log(`🗺️  Geographic Reach: ${statesRes.rows[0].states} States & UTs | ${statesRes.rows[0].districts} Districts`);
    console.log("\nTop Institution Categories in Directory:");
    for (const r of typeRes.rows) {
        console.log(`   - ${r.institution_type}: ${r.count}`);
    }
    console.log("================================================================================");
}

// Execute when run as main script
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runComprehensiveIngestion()
        .then(() => process.exit(0))
        .catch((err) => {
            console.error("❌ Fatal Ingestion Error:", err);
            process.exit(1);
        });
}
