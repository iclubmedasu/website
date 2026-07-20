import type { Id } from '../types/backend-contracts';
import { API_BASE_URL, apiFetch, getAuthHeaders, handleResponse } from './api';

export type CertificateType =
    | 'ATTENDANCE'
    | 'ORGANIZATION'
    | 'CONTRIBUTION'
    | 'LEADERSHIP'
    | 'CUSTOM';

export type CertificateStatus = 'DRAFT' | 'ISSUED' | 'REVOKED';

export interface BackgroundFocus {
    scale: number;
    offsetX: number;
    offsetY: number;
}

export interface CertificateTemplate {
    id: Id;
    name: string;
    backgroundImagePath: string | null;
    backgroundImageSha: string | null;
    backgroundFocus: BackgroundFocus | null;
    canvasWidth: number;
    canvasHeight: number;
    layout: unknown;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    /** Present on list/get responses — count of ISSUED certificates using this template */
    issuedCertificateCount?: number;
    hasIssuedCertificates?: boolean;
}

export interface CertificateListItem {
    id: Id;
    templateId: Id | null;
    type: CertificateType;
    status: CertificateStatus;
    eventId: Id | null;
    projectId: Id | null;
    recipientMemberId: Id | null;
    recipientName: string;
    recipientEmail: string;
    title: string;
    description: string;
    fieldValues: unknown;
    verificationCode: string;
    issuedAt: string | null;
    revokedAt: string | null;
    revokedReason: string | null;
    createdAt: string;
    updatedAt: string;
    template?: { id: Id; name: string } | null;
    event?: { id: Id; title: string } | null;
    project?: { id: Id; title: string } | null;
    recipientMember?: { id: Id; fullName: string } | null;
}

export interface CertificateQueryParams {
    eventId?: Id | string;
    projectId?: Id | string;
    status?: CertificateStatus;
    type?: CertificateType;
    recipientMemberId?: Id | string;
}

export interface CreateCustomCertificatePayload {
    type: CertificateType;
    recipientName: string;
    recipientEmail: string;
    title: string;
    description: string;
    templateId?: Id | null;
    eventId?: Id | null;
    projectId?: Id | null;
    recipientMemberId?: Id | null;
    fieldValues?: Record<string, unknown>;
}

export interface BulkCertificateRecipient {
    memberId?: Id | null;
    type: CertificateType;
    recipientName: string;
    recipientEmail: string;
    fieldValues?: Record<string, unknown>;
}

export interface BulkIssuePayload {
    recipients: BulkCertificateRecipient[];
    templateId?: Id | null;
    issueImmediately?: boolean;
}

export interface BulkIssueResult {
    created: number;
    skipped: number;
    certificateIds: number[];
}

export type EventEligibleCategory = 'ATTENDEE' | 'STAFF';

export interface EventEligibleRecipient {
    memberId: Id | null;
    fullName: string;
    email: string;
    phoneNumber?: string | null;
    type: CertificateType;
    category?: EventEligibleCategory;
    attendanceDaysCount?: number;
    sessionsAttendedCount?: number;
    alreadyIssued: boolean;
}

export interface EventEligibleResponse {
    recipients?: EventEligibleRecipient[];
    attendees: EventEligibleRecipient[];
    staff: EventEligibleRecipient[];
    eventTitle: string;
    projectTypeName: string | null;
}

export interface ProjectEligibleRecipient {
    memberId: Id;
    fullName: string;
    email: string;
    phoneNumber?: string | null;
    type: 'LEADERSHIP' | 'CONTRIBUTION';
    taskCount: number;
    alreadyIssued: boolean;
}

export interface ProjectEligibleResponse {
    contributors: ProjectEligibleRecipient[];
    projectTitle: string;
    projectTypeName: string | null;
}

export interface CreateCertificateTemplatePayload {
    name: string;
    layout: unknown[];
    canvasWidth?: number;
    canvasHeight?: number;
    backgroundImagePath?: string | null;
    backgroundImageSha?: string | null;
    backgroundFocus?: BackgroundFocus | null;
}

export interface UpdateCertificateTemplatePayload {
    name?: string;
    layout?: unknown[];
    canvasWidth?: number;
    canvasHeight?: number;
    backgroundFocus?: BackgroundFocus | null;
    backgroundImagePath?: string | null;
    backgroundImageSha?: string | null;
}

export interface UpdateTemplateBackgroundPayload {
    backgroundImagePath: string;
    backgroundImageSha: string;
}

export const certificatesAPI = {
    getAll: async (params: CertificateQueryParams = {}): Promise<CertificateListItem[]> => {
        const search = new URLSearchParams();
        if (params.eventId != null) search.append('eventId', String(params.eventId));
        if (params.projectId != null) search.append('projectId', String(params.projectId));
        if (params.status) search.append('status', params.status);
        if (params.type) search.append('type', params.type);
        if (params.recipientMemberId != null) {
            search.append('recipientMemberId', String(params.recipientMemberId));
        }
        const qs = search.toString();
        const url = qs ? `${API_BASE_URL}/certificates?${qs}` : `${API_BASE_URL}/certificates`;
        const response = await apiFetch(url, { headers: getAuthHeaders() });
        return handleResponse<CertificateListItem[]>(response);
    },

    getById: async (id: Id | string): Promise<CertificateListItem> => {
        const response = await apiFetch(`${API_BASE_URL}/certificates/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<CertificateListItem>(response);
    },

    createCustom: async (payload: CreateCustomCertificatePayload): Promise<CertificateListItem> => {
        const response = await apiFetch(`${API_BASE_URL}/certificates`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse<CertificateListItem>(response);
    },

    issue: async (id: Id | string): Promise<CertificateListItem> => {
        const response = await apiFetch(`${API_BASE_URL}/certificates/${id}/issue`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse<CertificateListItem>(response);
    },

    revoke: async (id: Id | string, reason?: string): Promise<CertificateListItem> => {
        const response = await apiFetch(`${API_BASE_URL}/certificates/${id}/revoke`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(reason ? { reason } : {}),
        });
        return handleResponse<CertificateListItem>(response);
    },

    getEventEligible: async (eventId: Id | string): Promise<EventEligibleResponse> => {
        const response = await apiFetch(`${API_BASE_URL}/certificates/event/${eventId}/eligible`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<EventEligibleResponse>(response);
    },

    issueBulkForEvent: async (
        eventId: Id | string,
        payload: BulkIssuePayload,
    ): Promise<BulkIssueResult> => {
        const response = await apiFetch(`${API_BASE_URL}/certificates/event/${eventId}/issue-bulk`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse<BulkIssueResult>(response);
    },

    getProjectEligible: async (projectId: Id | string): Promise<ProjectEligibleResponse> => {
        const response = await apiFetch(`${API_BASE_URL}/certificates/project/${projectId}/eligible`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<ProjectEligibleResponse>(response);
    },

    issueBulkForProject: async (
        projectId: Id | string,
        payload: BulkIssuePayload,
    ): Promise<BulkIssueResult> => {
        const response = await apiFetch(`${API_BASE_URL}/certificates/project/${projectId}/issue-bulk`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse<BulkIssueResult>(response);
    },

    getTemplates: async (options?: {
        isActive?: boolean | 'all';
    }): Promise<CertificateTemplate[]> => {
        const params = new URLSearchParams();
        if (options?.isActive === true) params.set('isActive', 'true');
        else if (options?.isActive === false) params.set('isActive', 'false');
        else params.set('isActive', 'all');
        const query = params.toString();
        const response = await apiFetch(
            `${API_BASE_URL}/certificate-templates${query ? `?${query}` : ''}`,
            {
                headers: getAuthHeaders(),
            },
        );
        return handleResponse<CertificateTemplate[]>(response);
    },

    getTemplate: async (id: Id | string): Promise<CertificateTemplate> => {
        const response = await apiFetch(`${API_BASE_URL}/certificate-templates/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<CertificateTemplate>(response);
    },

    createTemplate: async (payload: CreateCertificateTemplatePayload): Promise<CertificateTemplate> => {
        const response = await apiFetch(`${API_BASE_URL}/certificate-templates`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse<CertificateTemplate>(response);
    },

    updateTemplate: async (
        id: Id | string,
        payload: UpdateCertificateTemplatePayload,
    ): Promise<CertificateTemplate> => {
        const response = await apiFetch(`${API_BASE_URL}/certificate-templates/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse<CertificateTemplate>(response);
    },

    updateTemplateBackground: async (
        id: Id | string,
        payload: UpdateTemplateBackgroundPayload,
    ): Promise<CertificateTemplate> => {
        const response = await apiFetch(`${API_BASE_URL}/certificate-templates/${id}/background`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse<CertificateTemplate>(response);
    },

    uploadTemplateBackground: async (
        id: Id | string,
        file: File,
    ): Promise<{ backgroundImagePath: string; backgroundImageSha: string }> => {
        const formData = new FormData();
        formData.append('background', file);
        const response = await apiFetch(`${API_BASE_URL}/certificate-templates/${id}/upload-background`, {
            method: 'POST',
            // No Content-Type — browser sets multipart boundary (same as profile photo upload)
            headers: {},
            body: formData,
        });
        return handleResponse<{ backgroundImagePath: string; backgroundImageSha: string }>(response);
    },

    getTemplateBackgroundUrl: (id: Id | string): string =>
        `${API_BASE_URL}/certificate-templates/${id}/background`,

    deactivateTemplate: async (id: Id | string): Promise<{ success: boolean }> => {
        const response = await apiFetch(`${API_BASE_URL}/certificate-templates/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success: boolean }>(response);
    },

    reactivateTemplate: async (id: Id | string): Promise<CertificateTemplate> => {
        const response = await apiFetch(`${API_BASE_URL}/certificate-templates/${id}/reactivate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse<CertificateTemplate>(response);
    },

    deleteTemplate: async (id: Id | string): Promise<{ success: boolean }> => {
        const response = await apiFetch(`${API_BASE_URL}/certificate-templates/${id}/hard`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success: boolean }>(response);
    },
};
