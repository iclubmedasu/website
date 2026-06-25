import type {
    EditorIncidentReportField,
    EditorIncidentReportForm,
    EditorSupportNoticeBlock,
    EditorSupportPage,
    IncidentReportAnswerSnapshot,
    IncidentReportDetail,
    IncidentReportFormSnapshot,
    IncidentReportPayload,
    IncidentReportSummary,
    PublicIncidentReportField,
    PublicIncidentReportForm,
    PublicSupportNoticeBlock,
    PublicSupportPage,
    SitePageHeader,
    SupportLocale,
} from "@iclub/shared";
import type {
    IncidentReport,
    IncidentReportField,
    IncidentReportType,
    SitePage,
    SupportNoticeBlock,
} from "@prisma/client";
import { Prisma } from "@prisma/client";
import {
    buildAnswerSnapshots,
    coerceSubmittedCustomFieldValue,
    CustomFieldRow,
    getCustomFieldValueFromRecord,
    validateRequiredCustomFieldValues,
} from "./customFields";
import { prisma } from "../db";

const SUPPORT_PAGE_ID = "support";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FormWithFields = IncidentReportType & { fields: IncidentReportField[] };

function toHeader(page: SitePage): SitePageHeader {
    return {
        eyebrow: page.eyebrow,
        title: page.title,
        description: page.description,
    };
}

function toPublicField(field: IncidentReportField): PublicIncidentReportField {
    return {
        id: field.id,
        label: field.label,
        type: field.type,
        options: field.options,
        required: field.required,
        order: field.order,
    };
}

function toEditorField(field: IncidentReportField): EditorIncidentReportField {
    return {
        ...toPublicField(field),
        isActive: field.isActive,
    };
}

function toPublicForm(form: FormWithFields, options?: { activeFieldsOnly?: boolean }): PublicIncidentReportForm {
    const fields = options?.activeFieldsOnly
        ? form.fields.filter((field) => field.isActive)
        : form.fields;

    return {
        id: form.id,
        label: form.label,
        sortOrder: form.sortOrder,
        slug: form.slug,
        fields: fields.map(toPublicField),
    };
}

function toEditorForm(form: FormWithFields): EditorIncidentReportForm {
    return {
        id: form.id,
        label: form.label,
        sortOrder: form.sortOrder,
        slug: form.slug,
        isSystem: form.isSystem,
        isActive: form.isActive,
        fields: form.fields.map(toEditorField),
    };
}

function toNotice(block: SupportNoticeBlock): PublicSupportNoticeBlock {
    return {
        id: block.id,
        sortOrder: block.sortOrder,
        locale: block.locale as SupportLocale,
        content: block.content,
    };
}

function isLegacyAnswersArray(value: unknown): value is IncidentReportAnswerSnapshot[] {
    return Array.isArray(value);
}

function parseLegacyAnswers(value: unknown): IncidentReportAnswerSnapshot[] {
    if (!isLegacyAnswersArray(value)) return [];
    return value
        .filter((item): item is IncidentReportAnswerSnapshot => {
            return (
                !!item
                && typeof item === "object"
                && typeof (item as IncidentReportAnswerSnapshot).fieldId === "number"
                && typeof (item as IncidentReportAnswerSnapshot).label === "string"
            );
        })
        .map((item) => ({
            fieldId: item.fieldId,
            label: item.label,
            type: String(item.type ?? "text"),
            value: item.value,
        }));
}

function parseFormSnapshot(record: Record<string, unknown>): IncidentReportFormSnapshot {
    return {
        id: Number(record.id) || 0,
        label: String(record.label ?? "Unknown"),
        slug: record.slug != null ? String(record.slug) : null,
    };
}

function parseReportPayload(value: unknown): IncidentReportPayload {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return {
            form: { id: 0, label: "Unknown" },
            reporter: { email: "" },
            description: "",
            extraAnswers: parseLegacyAnswers(value),
        };
    }

    const record = value as Record<string, unknown>;
    const formRecord = (record.form ?? record.reportType) as Record<string, unknown> | undefined;

    if (formRecord && record.reporter && record.description !== undefined) {
        const form = parseFormSnapshot(formRecord);
        const reporter = record.reporter as Record<string, unknown>;
        return {
            form,
            reportType: form,
            reporter: {
                name: reporter.name != null ? String(reporter.name) : null,
                email: String(reporter.email ?? ""),
                phone: reporter.phone != null ? String(reporter.phone) : null,
                team: reporter.team != null ? String(reporter.team) : null,
            },
            description: String(record.description ?? ""),
            extraAnswers: parseLegacyAnswers(record.extraAnswers),
        };
    }

    const legacy = parseLegacyAnswers(value);
    const reportTypeAnswer = legacy.find((a) => a.label.toLowerCase().includes("report type"));
    const descriptionAnswer = legacy.find((a) => a.label.toLowerCase() === "description");
    const nameAnswer = legacy.find((a) => a.label.toLowerCase().includes("name"));
    const phoneAnswer = legacy.find((a) => a.label.toLowerCase().includes("contact") || a.label.toLowerCase().includes("phone"));
    const emailAnswer = legacy.find((a) => a.label.toLowerCase() === "email");

    const form: IncidentReportFormSnapshot = {
        id: 0,
        label: reportTypeAnswer?.value != null ? String(reportTypeAnswer.value) : "Unknown",
    };

    return {
        form,
        reportType: form,
        reporter: {
            name: nameAnswer?.value != null ? String(nameAnswer.value) : null,
            email: emailAnswer?.value != null ? String(emailAnswer.value) : "",
            phone: phoneAnswer?.value != null ? String(phoneAnswer.value) : null,
        },
        description: descriptionAnswer?.value != null ? String(descriptionAnswer.value) : "",
        extraAnswers: legacy.filter(
            (a) =>
                a !== reportTypeAnswer
                && a !== descriptionAnswer
                && a !== nameAnswer
                && a !== phoneAnswer
                && a !== emailAnswer,
        ),
    };
}

function buildPreview(payload: IncidentReportPayload): string | null {
    const formLabel = payload.form.label;
    if (payload.description.trim()) {
        return `${formLabel}: ${payload.description.trim().slice(0, 80)}`;
    }
    if (payload.reporter.email) {
        return `${formLabel} — ${payload.reporter.email}`;
    }
    return formLabel;
}

function toReportSummary(report: IncidentReport): IncidentReportSummary {
    const payload = parseReportPayload(report.answers);
    return {
        id: report.id,
        source: report.source as IncidentReportSummary["source"],
        submitterMemberId: report.submitterMemberId,
        createdAt: report.createdAt.toISOString(),
        preview: buildPreview(payload),
        formId: payload.form.id > 0 ? payload.form.id : undefined,
        formLabel: payload.form.label,
    };
}

function toReportDetail(report: IncidentReport): IncidentReportDetail {
    const payload = parseReportPayload(report.answers);
    return {
        ...toReportSummary(report),
        payload,
        answers: payload.extraAnswers,
    };
}

async function loadFormsWithFields(options: { includeInactive?: boolean; activeFieldsOnly?: boolean } = {}) {
    const formWhere = options.includeInactive ? {} : { isActive: true };
    const fieldWhere = options.activeFieldsOnly ? { isActive: true } : {};

    return prisma.incidentReportType.findMany({
        where: formWhere,
        orderBy: { sortOrder: "asc" },
        include: {
            fields: {
                where: fieldWhere,
                orderBy: [{ order: "asc" }, { createdAt: "asc" }],
            },
        },
    });
}

export async function getSupportPageData(): Promise<PublicSupportPage | null> {
    const page = await prisma.sitePage.findUnique({ where: { id: SUPPORT_PAGE_ID } });
    if (!page) return null;

    const [notices, forms] = await Promise.all([
        prisma.supportNoticeBlock.findMany({ orderBy: { sortOrder: "asc" } }),
        loadFormsWithFields({ activeFieldsOnly: true }),
    ]);

    return {
        header: toHeader(page),
        notices: notices.map(toNotice),
        forms: forms.map((form) => toPublicForm(form, { activeFieldsOnly: true })),
    };
}

export async function getEditorSupportPageData(): Promise<EditorSupportPage | null> {
    const page = await prisma.sitePage.findUnique({ where: { id: SUPPORT_PAGE_ID } });
    if (!page) return null;

    const [notices, forms] = await Promise.all([
        prisma.supportNoticeBlock.findMany({ orderBy: { sortOrder: "asc" } }),
        loadFormsWithFields({ includeInactive: true }),
    ]);

    return {
        header: toHeader(page),
        notices: notices.map((block) => toNotice(block) as EditorSupportNoticeBlock),
        forms: forms.map(toEditorForm),
    };
}

export async function getActiveIncidentReportForm(formId: number): Promise<FormWithFields | null> {
    return prisma.incidentReportType.findFirst({
        where: { id: formId, isActive: true },
        include: {
            fields: {
                where: { isActive: true },
                orderBy: [{ order: "asc" }, { createdAt: "asc" }],
            },
        },
    });
}

export async function getNextNoticeSortOrder(): Promise<number> {
    const result = await prisma.supportNoticeBlock.aggregate({ _max: { sortOrder: true } });
    return (result._max.sortOrder ?? -1) + 1;
}

export async function getNextFieldOrder(formId: number): Promise<number> {
    const result = await prisma.incidentReportField.aggregate({
        where: { formId },
        _max: { order: true },
    });
    return (result._max.order ?? -1) + 1;
}

export async function getNextFormSortOrder(): Promise<number> {
    const result = await prisma.incidentReportType.aggregate({ _max: { sortOrder: true } });
    return (result._max.sortOrder ?? -1) + 1;
}

/** @deprecated Use getNextFormSortOrder */
export const getNextTypeSortOrder = getNextFormSortOrder;

export function validateSupportLocale(locale: string): locale is SupportLocale {
    return locale === "EN" || locale === "AR";
}

export async function resolveMemberTeamLabel(memberId: number): Promise<string | null> {
    const memberships = await prisma.teamMember.findMany({
        where: { memberId, isActive: true },
        include: { team: { select: { name: true } } },
        orderBy: { teamId: "asc" },
    });
    const names = memberships.map((m) => m.team?.name).filter((name): name is string => Boolean(name));
    return names.length > 0 ? names.join(", ") : null;
}

function trimOptional(value: unknown): string | null {
    if (value === undefined || value === null) return null;
    const trimmed = String(value).trim();
    return trimmed || null;
}

export async function createIncidentReportSubmission(options: {
    formId: number;
    name?: unknown;
    email: unknown;
    phone?: unknown;
    description: unknown;
    team?: unknown;
    fieldValues?: unknown;
    source: "PUBLIC" | "PORTAL";
    submitterMemberId?: number | null;
}): Promise<IncidentReportDetail> {
    const errors: Record<string, string> = {};

    const form = await getActiveIncidentReportForm(options.formId);
    if (!form) {
        errors.formId = "Form is required.";
    }

    const email = trimOptional(options.email);
    if (!email) {
        errors.email = "Email is required.";
    } else if (!EMAIL_PATTERN.test(email)) {
        errors.email = "A valid email address is required.";
    }

    const description = trimOptional(options.description);
    if (!description) {
        errors.description = "Description is required.";
    }

    const name = trimOptional(options.name);
    if (form?.slug === "personal" && !name) {
        errors.name = "Name is required for personal reports.";
    }

    if (options.source === "PUBLIC" && trimOptional(options.team)) {
        errors.team = "Team is not accepted on public submissions.";
    }

    const fieldRows: CustomFieldRow[] = (form?.fields ?? []).map((field) => ({
        id: field.id,
        label: field.label,
        type: field.type,
        required: field.required,
        options: field.options,
    }));

    const fieldErrors = validateRequiredCustomFieldValues(fieldRows, options.fieldValues ?? {});
    Object.assign(errors, fieldErrors);

    for (const field of fieldRows) {
        const rawValue = getCustomFieldValueFromRecord(options.fieldValues, field);
        if (rawValue === undefined || rawValue === null || rawValue === "") continue;
        const coerced = coerceSubmittedCustomFieldValue(field, rawValue);
        if (field.type === "dropdown" && rawValue !== "" && coerced === null) {
            errors[String(field.id)] = `${field.label} has an invalid option.`;
        }
    }

    if (Object.keys(errors).length > 0) {
        const error = new Error("Validation failed") as Error & { fieldErrors?: Record<string, string> };
        error.fieldErrors = errors;
        throw error;
    }

    if (!form || !email || !description) {
        const error = new Error("Validation failed") as Error & { fieldErrors?: Record<string, string> };
        error.fieldErrors = errors;
        throw error;
    }

    let team = options.source === "PORTAL" ? trimOptional(options.team) : null;
    if (options.source === "PORTAL" && !team && options.submitterMemberId) {
        team = await resolveMemberTeamLabel(options.submitterMemberId);
    }

    const extraAnswers = buildAnswerSnapshots(fieldRows, options.fieldValues ?? {});
    const formSnapshot: IncidentReportFormSnapshot = {
        id: form.id,
        label: form.label,
        slug: form.slug,
    };
    const payload: IncidentReportPayload = {
        form: formSnapshot,
        reportType: formSnapshot,
        reporter: {
            name,
            email,
            phone: trimOptional(options.phone),
            team,
        },
        description,
        extraAnswers,
    };

    // Submissions are permanent — never deleted after creation.
    const created = await prisma.incidentReport.create({
        data: {
            answers: payload as unknown as Prisma.InputJsonValue,
            source: options.source,
            submitterMemberId: options.submitterMemberId ?? null,
        },
    });

    return toReportDetail(created);
}

function getReportFormId(report: IncidentReport): number | null {
    const payload = parseReportPayload(report.answers);
    return payload.form.id > 0 ? payload.form.id : null;
}

export async function getSubmissionCountsByForm(): Promise<Record<string, number>> {
    const reports = await prisma.incidentReport.findMany({ select: { answers: true } });
    const counts: Record<string, number> = {};

    for (const report of reports) {
        const formId = getReportFormId(report as IncidentReport);
        if (formId == null) continue;
        const key = String(formId);
        counts[key] = (counts[key] ?? 0) + 1;
    }

    return counts;
}

export async function listIncidentReports(options: {
    limit?: number;
    offset?: number;
    formId?: number;
} = {}): Promise<{ reports: IncidentReportSummary[]; total: number }> {
    const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
    const offset = Math.max(options.offset ?? 0, 0);

    if (options.formId != null) {
        const allReports = await prisma.incidentReport.findMany({
            orderBy: { createdAt: "desc" },
        });
        const filtered = allReports.filter((report) => getReportFormId(report) === options.formId);
        return {
            reports: filtered.slice(offset, offset + limit).map(toReportSummary),
            total: filtered.length,
        };
    }

    const [reports, total] = await Promise.all([
        prisma.incidentReport.findMany({
            orderBy: { createdAt: "desc" },
            take: limit,
            skip: offset,
        }),
        prisma.incidentReport.count(),
    ]);

    return {
        reports: reports.map(toReportSummary),
        total,
    };
}

export async function listIncidentReportsForForm(formId: number): Promise<IncidentReportDetail[]> {
    const reports = await prisma.incidentReport.findMany({
        orderBy: { createdAt: "desc" },
    });

    return reports
        .filter((report) => getReportFormId(report) === formId)
        .map(toReportDetail);
}

export async function getIncidentReportDetail(reportId: number): Promise<IncidentReportDetail | null> {
    const report = await prisma.incidentReport.findUnique({ where: { id: reportId } });
    if (!report) return null;
    return toReportDetail(report);
}

export { reorderRecords } from "./siteContent";
