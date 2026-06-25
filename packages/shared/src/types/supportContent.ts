import type { EventCustomFieldType } from "./event";
import type { SitePageHeader } from "./siteContent";

export type SupportLocale = "EN" | "AR";
export type IncidentReportSource = "PUBLIC" | "PORTAL";
export type IncidentReportFieldType = EventCustomFieldType;
export type SystemReportFormSlug = "general" | "personal" | "request";

/** @deprecated Use SystemReportFormSlug */
export type SystemReportTypeSlug = SystemReportFormSlug;

export interface PublicSupportNoticeBlock {
    id: number;
    sortOrder: number;
    locale: SupportLocale;
    content: string;
}

export interface PublicIncidentReportField {
    id: number;
    label: string;
    type: IncidentReportFieldType | string;
    options?: unknown;
    required?: boolean;
    order?: number;
}

export interface PublicIncidentReportForm {
    id: number;
    label: string;
    sortOrder: number;
    slug?: SystemReportFormSlug | string | null;
    fields: PublicIncidentReportField[];
}

/** @deprecated Use PublicIncidentReportForm */
export type PublicIncidentReportType = Omit<PublicIncidentReportForm, "fields">;

export interface PublicSupportPage {
    header: SitePageHeader;
    notices: PublicSupportNoticeBlock[];
    forms: PublicIncidentReportForm[];
}

export interface EditorSupportNoticeBlock extends PublicSupportNoticeBlock {}

export interface EditorIncidentReportField extends PublicIncidentReportField {
    isActive: boolean;
}

export interface EditorIncidentReportForm extends PublicIncidentReportForm {
    isSystem: boolean;
    isActive: boolean;
    fields: EditorIncidentReportField[];
}

/** @deprecated Use EditorIncidentReportForm */
export type EditorIncidentReportType = Omit<EditorIncidentReportForm, "fields">;

export interface EditorSupportPage {
    header: SitePageHeader;
    notices: EditorSupportNoticeBlock[];
    forms: EditorIncidentReportForm[];
}

export interface IncidentReportAnswerSnapshot {
    fieldId: number;
    label: string;
    type: string;
    value: unknown;
}

export interface IncidentReportFormSnapshot {
    id: number;
    label: string;
    slug?: string | null;
}

/** @deprecated Use IncidentReportFormSnapshot */
export type IncidentReportTypeSnapshot = IncidentReportFormSnapshot;

export interface IncidentReportReporterSnapshot {
    name?: string | null;
    email: string;
    phone?: string | null;
    team?: string | null;
}

export interface IncidentReportPayload {
    form: IncidentReportFormSnapshot;
    /** @deprecated Legacy key; use form */
    reportType?: IncidentReportFormSnapshot;
    reporter: IncidentReportReporterSnapshot;
    description: string;
    extraAnswers: IncidentReportAnswerSnapshot[];
}

export interface IncidentReportSummary {
    id: number;
    source: IncidentReportSource;
    submitterMemberId?: number | null;
    createdAt: string;
    preview?: string | null;
    formId?: number;
    formLabel?: string;
}

export interface IncidentReportDetail extends IncidentReportSummary {
    payload: IncidentReportPayload;
    /** @deprecated Legacy flat answers; use payload.extraAnswers */
    answers?: IncidentReportAnswerSnapshot[];
}

export interface IncidentReportListResult {
    reports: IncidentReportSummary[];
    total: number;
}

export interface CreateIncidentReportFormPayload {
    label: string;
}

/** @deprecated Use CreateIncidentReportFormPayload */
export type CreateIncidentReportTypePayload = CreateIncidentReportFormPayload;

export interface UpdateIncidentReportFormPayload {
    label?: string;
    isActive?: boolean;
}

/** @deprecated Use UpdateIncidentReportFormPayload */
export type UpdateIncidentReportTypePayload = UpdateIncidentReportFormPayload;

export interface CreateIncidentReportFieldPayload {
    label: string;
    type: IncidentReportFieldType | string;
    options?: unknown;
    required?: boolean;
    order?: number;
}

export interface UpdateIncidentReportFieldPayload {
    label?: string;
    type?: IncidentReportFieldType | string;
    options?: unknown;
    required?: boolean;
    isActive?: boolean;
    order?: number;
}

export interface ReorderIncidentReportFieldsPayload {
    order: Array<{ id: number; order?: number }>;
}

export interface CreateSupportNoticePayload {
    locale: SupportLocale;
    content: string;
}

export interface UpdateSupportNoticePayload {
    locale?: SupportLocale;
    content?: string;
}

export interface SubmitIncidentReportPayload {
    formId: number;
    name?: string;
    email: string;
    phone?: string;
    description: string;
    team?: string;
    fieldValues?: Record<string, unknown>;
    website?: string;
}
