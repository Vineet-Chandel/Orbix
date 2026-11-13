import type { ClubEventApplicantRow } from "../../../api/collegeEventsApi";
import type { DynamicQuestionMeta } from "./types";

/**
 * Escapes a cell value according to RFC-4180 and protects against CSV formula injection.
 */
function escapeCsvValue(val: unknown): string {
    if (val === null || val === undefined) {
        return '""';
    }

    let str = "";
    if (Array.isArray(val)) {
        str = val.join(", ");
    } else if (typeof val === "object") {
        str = JSON.stringify(val);
    } else {
        str = String(val).trim();
    }

    // CSV Formula Injection Protection (prevent execution of =, +, -, @, \t, \r in Excel/Sheets)
    if (/^[=+\-@\t\r]/.test(str)) {
        str = `'${str}`;
    }

    // Escape double quotes by doubling them
    str = str.replace(/"/g, '""');
    return `"${str}"`;
}

/**
 * Exports the applications list to an RFC-4180 compliant CSV file in the exact required column sequence:
 * Group B (Status) -> Group C (Personal Info) -> Group D (Form Responses) -> Group E (Registered At)
 */
export function exportApplicationsToCsv(
    applications: ClubEventApplicantRow[],
    dynamicQuestions: DynamicQuestionMeta[],
    eventTitle?: string
) {
    const headers: string[] = [
        "Status",
        "Student Name",
        "Username",
        "Email Address",
        "Phone Number",
        "Institution / College",
        "City",
        "State",
        "Roll / Student ID",
        "Department",
        ...dynamicQuestions.map((q) => q.label),
        "Registered At",
    ];

    const rows = applications.map((app) => {
        const answersObj = { ...(app.answers || {}), ...(app.formResponse || {}) };
        const fileAttachments = app.fileAttachments || [];

        const statusLabel =
            app.status === "registered"
                ? "Accepted / Active"
                : app.status === "pending"
                    ? "Pending Review"
                    : app.status === "attended"
                        ? "Checked-In"
                        : app.status === "rejected"
                            ? "Rejected"
                            : app.status === "waitlisted"
                                ? "Waitlisted"
                                : app.status;

        const rowValues: string[] = [
            escapeCsvValue(statusLabel),
            escapeCsvValue(app.applicantName || ""),
            escapeCsvValue(app.username ? `@${app.username}` : ""),
            escapeCsvValue(app.applicantEmail || ""),
            escapeCsvValue(app.phoneNumber || ""),
            escapeCsvValue(app.institutionName || app.campusName || ""),
            escapeCsvValue(app.institutionCity || ""),
            escapeCsvValue(app.institutionState || ""),
            escapeCsvValue(app.rollNumber || answersObj["q_roll_number"] || answersObj["roll_number"] || ""),
            escapeCsvValue(app.department || answersObj["q_department"] || answersObj["department"] || ""),
        ];

        // Group D: Dynamic form questions
        dynamicQuestions.forEach((q) => {
            // Check file attachments first
            const matchedFiles = fileAttachments.filter((f) => f.questionId === q.id);
            if (matchedFiles.length > 0) {
                rowValues.push(escapeCsvValue(matchedFiles.map((f) => f.fileUrl).join(" ; ")));
                return;
            }

            let val = answersObj[q.id];
            if (val === undefined && q.id.startsWith("q_")) {
                val = answersObj[q.id.replace(/^q_/, "")];
            } else if (val === undefined) {
                val = answersObj[`q_${q.id}`];
            }

            rowValues.push(escapeCsvValue(val));
        });

        // Group E: Registered At (Final Column)
        const registeredAtStr = app.registeredAt ? new Date(app.registeredAt).toLocaleString() : "";
        rowValues.push(escapeCsvValue(registeredAtStr));

        return rowValues.join(",");
    });

    const csvContent = "\uFEFF" + [headers.map(escapeCsvValue).join(","), ...rows].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);

    const safeSlug = (eventTitle || "event")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `orbix-${safeSlug}-roster-${dateStr}.csv`;

    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
