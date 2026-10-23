import fs from "fs";
import path from "path";
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
    website: string;
    verificationStatus: "verified" | "needs_review" | "unverified" | "inactive";
    verificationBasis: string;
    sourceName: string;
    sourceUrl: string;
    regulator?: string;
    regulatorId?: string;
}

/**
 * Normalizes an institution name for robust prefix & token matching.
 * - Converts to lowercase
 * - Strips commas, periods, hyphens, brackets
 * - Collapses consecutive spaces
 */
export function normalizeInstitutionName(name: string): string {
    return name
        .toLowerCase()
        .replace(/[,.\-()\[\]]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Generates automated acronyms and aliases if not explicitly given.
 * e.g. "Indian Institute of Technology Bombay" -> ["IIT Bombay", "IITB"]
 */
export function generateDerivedAliases(officialName: string, existingAliases: string[]): string[] {
    const aliasSet = new Set<string>(existingAliases.map((a) => a.trim()));

    // Generate acronym from uppercase/title words
    const words = officialName
        .replace(/[,.\-()\[\]]/g, " ")
        .split(/\s+/)
        .filter((w) => !["of", "and", "in", "the", "for", "&"].includes(w.toLowerCase()));

    if (words.length > 1) {
        const acronym = words.map((w) => w[0]?.toUpperCase()).join("");
        if (acronym.length >= 2 && acronym.length <= 8) {
            aliasSet.add(acronym);
        }
    }

    return Array.from(aliasSet);
}

export async function runIngestionPipeline() {
    console.log("=================================================");
    console.log("🇮🇳 Verified Indian Institution Ingestion Pipeline");
    console.log("=================================================");

    const seedFilePath = path.join(__dirname, "institutions_seed.json");
    if (!fs.existsSync(seedFilePath)) {
        throw new Error(`Seed file not found at ${seedFilePath}`);
    }

    const rawData = fs.readFileSync(seedFilePath, "utf-8");
    const records: RawInstitutionRecord[] = JSON.parse(rawData);

    console.log(`📂 Loaded ${records.length} raw institution records from seed dataset.`);

    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const statesCovered = new Set<string>();
    const typesCovered = new Set<string>();

    for (const record of records) {
        try {
            // Strict validation checks
            if (!record.officialName || record.officialName.trim().length < 3) {
                console.warn(`⚠️ Skipping record with invalid name:`, record);
                errorCount++;
                continue;
            }

            if (!record.aisheCode || !/^[UCS]-\d+/i.test(record.aisheCode.trim())) {
                console.warn(`⚠️ Invalid AISHE code for ${record.officialName}: ${record.aisheCode}`);
                errorCount++;
                continue;
            }

            const cleanOfficialName = record.officialName.trim();
            const normalizedName = normalizeInstitutionName(cleanOfficialName);
            const derivedAliases = generateDerivedAliases(cleanOfficialName, record.aliases || []);
            const cleanAishe = record.aisheCode.trim().toUpperCase();
            const cleanState = record.state?.trim() || "India";
            const cleanDistrict = record.district?.trim() || null;
            const cleanCity = record.city?.trim() || null;
            const cleanType = record.institutionType?.trim() || "Higher Education Institution";
            const cleanWebsite = record.website?.trim() || null;
            const verificationStatus = record.verificationStatus || "verified";
            const verificationBasis = record.verificationBasis || "Verified against official AISHE directory";

            statesCovered.add(cleanState);
            typesCovered.add(cleanType);

            // Upsert into institutions table
            const instResult = await query(
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
                    last_verified_at,
                    source_year,
                    updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, CURRENT_TIMESTAMP, '2023-24', CURRENT_TIMESTAMP)
                ON CONFLICT (aishe_code) DO UPDATE SET
                    official_name = EXCLUDED.official_name,
                    normalized_name = EXCLUDED.normalized_name,
                    aliases = EXCLUDED.aliases,
                    state = EXCLUDED.state,
                    district = EXCLUDED.district,
                    city = EXCLUDED.city,
                    institution_type = EXCLUDED.institution_type,
                    website = EXCLUDED.website,
                    verification_status = EXCLUDED.verification_status,
                    verification_basis = EXCLUDED.verification_basis,
                    is_active = true,
                    last_verified_at = CURRENT_TIMESTAMP,
                    source_year = EXCLUDED.source_year,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id, (xmax = 0) AS was_inserted;`,
                [
                    cleanOfficialName,
                    normalizedName,
                    derivedAliases,
                    cleanAishe,
                    cleanState,
                    cleanDistrict,
                    cleanCity,
                    cleanType,
                    cleanWebsite,
                    verificationStatus,
                    verificationBasis,
                ]
            );

            const institutionId = instResult.rows[0]?.id;
            const wasInserted = instResult.rows[0]?.was_inserted;

            if (wasInserted) {
                insertedCount++;
            } else {
                updatedCount++;
            }

            // Insert evidence into institution_sources
            await query(
                `INSERT INTO institution_sources (
                    institution_id,
                    source_name,
                    source_url,
                    source_record_id,
                    source_publication_year,
                    verification_result,
                    notes
                ) VALUES ($1, $2, $3, $4, '2023-24', 'confirmed', $5);`,
                [
                    institutionId,
                    record.sourceName || "AISHE 2023-24",
                    record.sourceUrl || "https://aishe.gov.in",
                    cleanAishe,
                    verificationBasis,
                ]
            );

            // Insert regulatory mapping if regulator is provided
            if (record.regulator && record.regulatorId) {
                await query(
                    `INSERT INTO institution_regulatory_ids (
                        institution_id,
                        regulator,
                        identifier,
                        status
                    ) VALUES ($1, $2, $3, 'recognized')
                    ON CONFLICT (institution_id, regulator, identifier) DO NOTHING;`,
                    [institutionId, record.regulator, record.regulatorId]
                );
            }
        } catch (err: any) {
            console.error(`❌ Error ingesting ${record.officialName}:`, err.message);
            errorCount++;
        }
    }

    console.log("\n=================================================");
    console.log("📊 Ingestion & Validation Summary Report");
    console.log("=================================================");
    console.log(`✅ Successfully inserted: ${insertedCount}`);
    console.log(`🔄 Successfully updated:  ${updatedCount}`);
    console.log(`⚠️ Errors / Skipped:      ${errorCount}`);
    console.log(`🏛️ Total Institutions:    ${insertedCount + updatedCount}`);
    console.log(`📍 States/UTs Covered:    ${statesCovered.size} (${Array.from(statesCovered).sort().join(", ")})`);
    console.log(`🎓 Institution Types:     ${typesCovered.size} (${Array.from(typesCovered).join("; ")})`);
    console.log("=================================================\n");
}

runIngestionPipeline()
    .then(() => process.exit(0))
    .catch((err) => {
        console.error("Fatal ingestion error:", err);
        process.exit(1);
    });
