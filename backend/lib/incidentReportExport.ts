import * as XLSX from "xlsx";
import type { IncidentReportPayload } from "@iclub/shared";
import { prisma } from "../db";
import { listIncidentReportsForForm } from "./supportContent";

function formatCellValue(value: unknown): string {
    if (value === null || value === undefined || value === "") return "";
    if (typeof value === "boolean") return value ? "Yes" : "No";
    return String(value);
}

function buildExtraValueMap(payload: IncidentReportPayload): Map<number, unknown> {
    const map = new Map<number, unknown>();
    for (const answer of payload.extraAnswers) {
        map.set(answer.fieldId, answer.value);
    }
    return map;
}

export async function exportFormSubmissionsExcel(formId: number): Promise<{ buffer: Buffer; fileName: string }> {
    const form = await prisma.incidentReportType.findUnique({
        where: { id: formId },
        include: {
            fields: {
                orderBy: [{ order: "asc" }, { createdAt: "asc" }],
            },
        },
    });

    if (!form) {
        throw new Error("Form not found");
    }

    const reports = await listIncidentReportsForForm(formId);
    const fieldColumns = form.fields.filter((field) => field.isActive);

    const headers = [
        "Submitted at",
        "Source",
        "Name",
        "Email",
        "Phone",
        "Team",
        "Description",
        ...fieldColumns.map((field) => field.label),
    ];

    const rows = reports.map((report) => {
        const payload = report.payload;
        const extras = buildExtraValueMap(payload);
        return [
            new Date(report.createdAt).toISOString(),
            report.source,
            formatCellValue(payload.reporter.name),
            formatCellValue(payload.reporter.email),
            formatCellValue(payload.reporter.phone),
            formatCellValue(payload.reporter.team),
            formatCellValue(payload.description),
            ...fieldColumns.map((field) => formatCellValue(extras.get(field.id))),
        ];
    });

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Submissions");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "buffer" }) as Buffer;
    const safeLabel = form.label.replace(/[<>:"/\\|?*]/g, "").trim() || "form";
    return {
        buffer,
        fileName: `${safeLabel}-submissions.xlsx`,
    };
}
