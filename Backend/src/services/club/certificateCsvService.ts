import { query } from "../../database/client.js";
import XLSX from "xlsx";

export interface ReconciledCsvRow {
    index: number;
    name: string;
    email: string;
    role?: string | undefined;
    position?: string | undefined;
    team?: string | undefined;
    notes?: string | undefined;
    status: "matched_student" | "external_recipient" | "invalid";
    matchedUser?: {
        id: string;
        name: string;
        username: string;
        email: string;
        collegeName?: string | undefined;
        eventAttendance?: "attended" | "registered" | "none" | undefined;
        checkedInAt?: string | null | undefined;
    } | undefined;
    validationErrors?: string[] | undefined;
}

export interface CsvReconciliationResult {
    totalRows: number;
    matchedStudentsCount: number;
    externalCount: number;
    invalidCount: number;
    duplicateCount: number;
    detectedColumns: Record<string, string>;
    rows: ReconciledCsvRow[];
}

export class CertificateCsvService {
    /**
     * Sanitizes a string field against Formula Injection (CWE-1236 / CSV Injection).
     * If a cell starts with =, +, -, @, tab, or carriage return, it prepends a single quote
     * to ensure spreadsheet engines treat it as plain text.
     */
    static sanitizeCsvField(val: string): string {
        if (!val || typeof val !== "string") return "";
        const cleaned = val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, "");

        // Formula injection prefixes: =, +, -, @, tab, \r, %
        if (/^[=+\-@\t\r%]/.test(cleaned)) {
            return "'" + cleaned.trimStart();
        }
        return cleaned.trim();
    }

    /**
     * Robust CSV/TSV Parser that handles quoted values, escaped quotes (""),
     * commas inside quotes, and multi-line cells.
     */
    static parseCsv(csvContent: string): { headers: string[]; rows: Record<string, string>[] } {
        if (!csvContent || typeof csvContent !== "string") {
            return { headers: [], rows: [] };
        }

        // Strip UTF-8 BOM if present
        let cleaned = csvContent.replace(/^\uFEFF/, "");

        // Auto-detect delimiter from first non-empty line
        const firstLineText = cleaned.split(/\r?\n/).find((l) => l.trim().length > 0) || "";
        const commaCount = (firstLineText.match(/,/g) || []).length;
        const semiCount = (firstLineText.match(/;/g) || []).length;
        const tabCount = (firstLineText.match(/\t/g) || []).length;

        let delimiter = ",";
        if (tabCount > commaCount && tabCount > semiCount) delimiter = "\t";
        else if (semiCount > commaCount) delimiter = ";";

        // Parse CSV state machine
        const lines: string[][] = [];
        let currentRow: string[] = [];
        let currentField = "";
        let inQuotes = false;

        for (let i = 0; i < cleaned.length; i++) {
            const char = cleaned[i];
            const nextChar = cleaned[i + 1];

            if (inQuotes) {
                if (char === '"') {
                    if (nextChar === '"') {
                        // Escaped quote: "" -> "
                        currentField += '"';
                        i++; // skip next quote
                    } else {
                        // End of quoted field
                        inQuotes = false;
                    }
                } else {
                    currentField += char;
                }
            } else {
                if (char === '"') {
                    inQuotes = true;
                } else if (char === delimiter) {
                    currentRow.push(currentField.trim());
                    currentField = "";
                } else if (char === "\r") {
                    if (nextChar === "\n") i++; // handle CRLF
                    currentRow.push(currentField.trim());
                    lines.push(currentRow);
                    currentRow = [];
                    currentField = "";
                } else if (char === "\n") {
                    currentRow.push(currentField.trim());
                    lines.push(currentRow);
                    currentRow = [];
                    currentField = "";
                } else {
                    currentField += char;
                }
            }
        }

        // Push remaining field & row
        if (currentField.length > 0 || currentRow.length > 0) {
            currentRow.push(currentField.trim());
            lines.push(currentRow);
        }

        // Filter out empty lines
        const nonEmptyLines = lines.filter((row) => row.some((c) => c.length > 0));
        if (nonEmptyLines.length === 0) {
            return { headers: [], rows: [] };
        }

        const firstLine = nonEmptyLines[0];
        if (!firstLine) {
            return { headers: [], rows: [] };
        }

        const rawHeaders = firstLine.map((h) => h.replace(/^["']|["']$/g, "").trim());
        const headers = rawHeaders.map((h) => h.toLowerCase());

        const rows: Record<string, string>[] = [];
        for (let r = 1; r < nonEmptyLines.length; r++) {
            const rowArr = nonEmptyLines[r];
            if (!rowArr) continue;
            const rowObj: Record<string, string> = {};
            for (let c = 0; c < headers.length; c++) {
                const headerKey = headers[c];
                if (headerKey) {
                    rowObj[headerKey] = rowArr[c] !== undefined ? String(rowArr[c]) : "";
                }
            }
            rows.push(rowObj);
        }

        return { headers: rawHeaders, rows };
    }

    /**
     * Parses spreadsheet content from either a CSV string, TSV string, or XLSX/XLS buffer.
     * Automatically extracts the first active sheet from workbooks and runs CSV sanitation.
     */
    static parseSpreadsheet(
        contentOrBuffer: string | Buffer,
        filename?: string
    ): { headers: string[]; rows: Record<string, string>[] } {
        if (!contentOrBuffer) {
            return { headers: [], rows: [] };
        }

        if (Buffer.isBuffer(contentOrBuffer)) {
            const isXlsx =
                (filename && /\.(xlsx|xls)$/i.test(filename)) ||
                (contentOrBuffer.length > 4 &&
                    ((contentOrBuffer[0] === 0x50 && contentOrBuffer[1] === 0x4b) || // ZIP/XLSX
                        (contentOrBuffer[0] === 0xd0 && contentOrBuffer[1] === 0xcf))); // OLE/XLS

            if (isXlsx) {
                try {
                    const workbook = XLSX.read(contentOrBuffer, { type: "buffer" });
                    const sheetName = workbook.SheetNames[0];
                    if (!sheetName) return { headers: [], rows: [] };
                    const sheet = workbook.Sheets[sheetName];
                    if (!sheet) return { headers: [], rows: [] };
                    const csvText = XLSX.utils.sheet_to_csv(sheet);
                    return this.parseCsv(csvText);
                } catch (err) {
                    console.error("XLSX parsing error, falling back to text:", err);
                    return this.parseCsv(contentOrBuffer.toString("utf-8"));
                }
            }
            return this.parseCsv(contentOrBuffer.toString("utf-8"));
        }

        return this.parseCsv(String(contentOrBuffer));
    }

    /**
     * Intelligently detects and maps standard column names from CSV headers
     */
    static detectColumns(headers: string[]): {
        nameCol?: string | undefined;
        emailCol?: string | undefined;
        roleCol?: string | undefined;
        positionCol?: string | undefined;
        teamCol?: string | undefined;
        notesCol?: string | undefined;
    } {
        const detected: {
            nameCol?: string | undefined;
            emailCol?: string | undefined;
            roleCol?: string | undefined;
            positionCol?: string | undefined;
            teamCol?: string | undefined;
            notesCol?: string | undefined;
        } = {};

        for (const rawHeader of headers) {
            const h = rawHeader.toLowerCase().trim();
            if (!detected.emailCol && (h.includes("email") || h.includes("e-mail") || h === "mail")) {
                detected.emailCol = rawHeader;
            } else if (
                !detected.nameCol &&
                (h.includes("name") || h.includes("recipient") || h.includes("participant") || h.includes("student"))
            ) {
                detected.nameCol = rawHeader;
            } else if (
                !detected.positionCol &&
                (h.includes("position") || h.includes("rank") || h.includes("place") || h.includes("standing") || h === "award")
            ) {
                detected.positionCol = rawHeader;
            } else if (!detected.roleCol && (h.includes("role") || h.includes("track") || h.includes("designation") || h.includes("category"))) {
                detected.roleCol = rawHeader;
            } else if (!detected.teamCol && (h.includes("team") || h.includes("group") || h.includes("squad"))) {
                detected.teamCol = rawHeader;
            } else if (!detected.notesCol && (h.includes("note") || h.includes("desc") || h.includes("comment"))) {
                detected.notesCol = rawHeader;
            }
        }

        // Fallback for name / email if not matched by substring
        if (!detected.nameCol && headers.length > 0) detected.nameCol = headers[0];
        if (!detected.emailCol && headers.length > 1) detected.emailCol = headers[1];

        return detected;
    }

    /**
     * Validates RFC email format
     */
    static isValidEmail(email: string): boolean {
        if (!email || typeof email !== "string") return false;
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
        return emailRegex.test(email.trim());
    }

    /**
     * Reconciles CSV/XLSX recipient rows against Orbix database and event registrations
     */
    static async reconcileCsv(params: {
        clubId: string;
        csvContent?: string | undefined;
        fileBuffer?: Buffer | undefined;
        filename?: string | undefined;
        eventId?: string | undefined;
        customColumnMapping?: Record<string, string> | undefined;
    }): Promise<CsvReconciliationResult> {
        const { csvContent, fileBuffer, filename, eventId, customColumnMapping = {} } = params;

        const { headers, rows } = this.parseSpreadsheet(fileBuffer || csvContent || "", filename);
        if (rows.length === 0) {
            return {
                totalRows: 0,
                matchedStudentsCount: 0,
                externalCount: 0,
                invalidCount: 0,
                duplicateCount: 0,
                detectedColumns: {},
                rows: [],
            };
        }

        const autoCols = this.detectColumns(headers);
        const nameCol = customColumnMapping.name || autoCols.nameCol || "name";
        const emailCol = customColumnMapping.email || autoCols.emailCol || "email";
        const roleCol = customColumnMapping.role || autoCols.roleCol;
        const positionCol = customColumnMapping.position || autoCols.positionCol;
        const teamCol = customColumnMapping.team || autoCols.teamCol;
        const notesCol = customColumnMapping.notes || autoCols.notesCol;

        const detectedColumnsMap: Record<string, string> = {
            name: nameCol,
            email: emailCol,
            ...(roleCol ? { role: roleCol } : {}),
            ...(positionCol ? { position: positionCol } : {}),
            ...(teamCol ? { team: teamCol } : {}),
            ...(notesCol ? { notes: notesCol } : {}),
        };

        // Extract raw candidate fields with formula injection sanitization
        const rawRecipients: Array<{
            index: number;
            name: string;
            email: string;
            role?: string | undefined;
            position?: string | undefined;
            team?: string | undefined;
            notes?: string | undefined;
        }> = [];

        for (let i = 0; i < rows.length; i++) {
            const r = rows[i];
            if (!r) continue;

            const rawName = (nameCol ? r[nameCol] || r[nameCol.toLowerCase()] : "") || "";
            const rawEmail = (emailCol ? r[emailCol] || r[emailCol.toLowerCase()] : "") || "";
            const rawRole = roleCol ? r[roleCol] || r[roleCol.toLowerCase()] : undefined;
            const rawPos = positionCol ? r[positionCol] || r[positionCol.toLowerCase()] : undefined;
            const rawTeam = teamCol ? r[teamCol] || r[teamCol.toLowerCase()] : undefined;
            const rawNotes = notesCol ? r[notesCol] || r[notesCol.toLowerCase()] : undefined;

            rawRecipients.push({
                index: i + 1,
                name: this.sanitizeCsvField(rawName),
                email: this.sanitizeCsvField(rawEmail).toLowerCase(),
                role: rawRole ? this.sanitizeCsvField(rawRole) : undefined,
                position: rawPos ? this.sanitizeCsvField(rawPos) : undefined,
                team: rawTeam ? this.sanitizeCsvField(rawTeam) : undefined,
                notes: rawNotes ? this.sanitizeCsvField(rawNotes) : undefined,
            });
        }

        // Collect unique valid emails to query in bulk
        const validEmails = Array.from(
            new Set(
                rawRecipients
                    .map((r) => r.email)
                    .filter((e) => this.isValidEmail(e))
            )
        );

        // Bulk query users
        const matchedUsersMap = new Map<string, any>();
        if (validEmails.length > 0) {
            const usersRes = await query(
                `SELECT
                    u.id,
                    u.email,
                    u.username,
                    COALESCE(TRIM(CONCAT(u.firstname, ' ', COALESCE(u.lastname, ''))), u.username) AS name,
                    COALESCE(inst.official_name, u.college) AS "collegeName"
                 FROM users u
                 LEFT JOIN institutions inst ON u.college_id = inst.id
                 WHERE LOWER(u.email) = ANY($1::text[])
                    OR LOWER(u.username) = ANY($1::text[]);`,
                [validEmails]
            );

            for (const u of usersRes.rows) {
                if (u.email) matchedUsersMap.set(u.email.toLowerCase(), u);
                if (u.username) matchedUsersMap.set(u.username.toLowerCase(), u);
            }
        }

        // If eventId provided, bulk query event registrations for matched users
        const eventAttendanceMap = new Map<string, { status: string; checkedInAt: string | null }>();
        const matchedUserIds = Array.from(
            new Set(Array.from(matchedUsersMap.values()).map((u) => u.id))
        );

        if (eventId && matchedUserIds.length > 0) {
            const regRes = await query(
                `SELECT user_id, status, checked_in_at
                 FROM club_event_registrations
                 WHERE event_id = $1 AND user_id = ANY($2::uuid[]);`,
                [eventId, matchedUserIds]
            );

            for (const r of regRes.rows) {
                eventAttendanceMap.set(r.user_id, {
                    status: r.status,
                    checkedInAt: r.checked_in_at,
                });
            }
        }

        // Reconcile and classify each row
        const seenEmails = new Set<string>();
        let matchedStudentsCount = 0;
        let externalCount = 0;
        let invalidCount = 0;
        let duplicateCount = 0;

        const reconciledRows: ReconciledCsvRow[] = [];

        for (const cand of rawRecipients) {
            const errors: string[] = [];

            if (!cand.name && !cand.email) {
                errors.push("Row contains no name or email.");
            }

            if (!cand.email) {
                errors.push("Missing email address.");
            } else if (!this.isValidEmail(cand.email)) {
                errors.push(`Invalid email format: "${cand.email}".`);
            }

            // Internal duplicate check
            if (cand.email && seenEmails.has(cand.email)) {
                duplicateCount++;
                errors.push("Duplicate email entry in CSV (already listed above).");
            } else if (cand.email) {
                seenEmails.add(cand.email);
            }

            if (errors.length > 0) {
                invalidCount++;
                reconciledRows.push({
                    index: cand.index,
                    name: cand.name || "Missing Name",
                    email: cand.email,
                    role: cand.role,
                    position: cand.position,
                    team: cand.team,
                    notes: cand.notes,
                    status: "invalid",
                    validationErrors: errors,
                });
                continue;
            }

            // Check if matches an existing Orbix user
            const matchedUser = matchedUsersMap.get(cand.email);

            if (matchedUser) {
                matchedStudentsCount++;
                const attInfo = eventAttendanceMap.get(matchedUser.id);
                let attendanceState: "attended" | "registered" | "none" = "none";
                if (attInfo) {
                    if (attInfo.status === "attended" && attInfo.checkedInAt) {
                        attendanceState = "attended";
                    } else {
                        attendanceState = "registered";
                    }
                }

                reconciledRows.push({
                    index: cand.index,
                    name: cand.name || matchedUser.name,
                    email: cand.email,
                    role: cand.role,
                    position: cand.position,
                    team: cand.team,
                    notes: cand.notes,
                    status: "matched_student",
                    matchedUser: {
                        id: matchedUser.id,
                        name: matchedUser.name,
                        username: matchedUser.username,
                        email: matchedUser.email,
                        collegeName: matchedUser.collegeName || undefined,
                        eventAttendance: attendanceState,
                        checkedInAt: attInfo?.checkedInAt || null,
                    },
                });
            } else {
                // External valid recipient
                externalCount++;
                reconciledRows.push({
                    index: cand.index,
                    name: cand.name || "External Participant",
                    email: cand.email,
                    role: cand.role,
                    position: cand.position,
                    team: cand.team,
                    notes: cand.notes,
                    status: "external_recipient",
                });
            }
        }

        return {
            totalRows: rawRecipients.length,
            matchedStudentsCount,
            externalCount,
            invalidCount,
            duplicateCount,
            detectedColumns: detectedColumnsMap,
            rows: reconciledRows,
        };
    }

    /**
     * Generates a sample CSV template for organizers to download
     */
    static generateSampleCsv(): string {
        const headers = ["full_name", "email", "role", "position", "team", "notes"];
        const sampleRows = [
            ["Aarav Sharma", "aarav.sharma@campus.edu", "Participant", "First Place", "Orbix AI Labs", "Outstanding performance"],
            ["Priya Patel", "priya.patel@campus.edu", "Volunteer", "Best Organizer", "Core Logistics", "Flawless stage coordination"],
            ["Rohan Gupta", "rohan.gupta@external.org", "Speaker", "Keynote Speaker", "", "Guest session on Distributed Systems"],
            ["Ananya Verma", "ananya.verma@campus.edu", "Contender", "Runner Up", "Orbix AI Labs", "High impact hackathon build"],
        ];

        const lines = [
            headers.join(","),
            ...sampleRows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")),
        ];

        return lines.join("\n");
    }

    /**
     * Generates a sample XLSX workbook template for organizers to download (Phase 13)
     */
    static generateSampleXlsx(): Buffer {
        const wb = XLSX.utils.book_new();
        const data = [
            ["full_name", "email", "role", "position", "team", "notes"],
            ["Aarav Sharma", "aarav.sharma@campus.edu", "Participant", "First Place", "Orbix AI Labs", "Outstanding performance"],
            ["Priya Patel", "priya.patel@campus.edu", "Volunteer", "Best Organizer", "Core Logistics", "Flawless stage coordination"],
            ["Rohan Gupta", "rohan.gupta@external.org", "Speaker", "Keynote Speaker", "", "Guest session on Distributed Systems"],
            ["Ananya Verma", "ananya.verma@campus.edu", "Contender", "Runner Up", "Orbix AI Labs", "High impact hackathon build"],
        ];
        const ws = XLSX.utils.aoa_to_sheet(data);
        XLSX.utils.book_append_sheet(wb, ws, "Recipients");
        return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
    }
}
