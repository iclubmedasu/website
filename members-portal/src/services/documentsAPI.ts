import type { Id } from '../types/backend-contracts';
import { API_BASE_URL, apiFetch, downloadProtectedFile, getAuthHeaders, handleResponse } from './api';

export type DocumentCreatorRank = 'ORG_LEADERSHIP' | 'TEAM_LEADERSHIP';
export type DurationPreset = 'DAY' | 'WEEK' | 'MONTH' | 'INDEFINITE';
export type DocumentGrantTargetType = 'TEAM';
/** Stored grant target; MEMBER may appear on legacy rows (ignored for access). */
export type DocumentGrantStoredTargetType = 'TEAM' | 'MEMBER';
export type DocumentAccessTarget = 'document' | 'category';

export interface DocumentCategory {
    id: Id;
    name: string;
    order: number;
    scopeTeamId: Id | null;
    createdAt: string;
    updatedAt: string;
    canManageAccess?: boolean;
    locked?: false;
}

export interface CategoryLockedStub {
    id: Id;
    name: string;
    locked: true;
}

export type CategoryListItem = DocumentCategory | CategoryLockedStub;

export function isLockedCategory(cat: CategoryListItem): cat is CategoryLockedStub {
    return 'locked' in cat && cat.locked === true;
}

export interface DocumentFull {
    id: Id;
    categoryId: Id | null;
    title: string;
    fileUrl: string;
    fileType: string;
    fileSizeBytes: number | null;
    scopeTeamId: Id | null;
    creatorRank: DocumentCreatorRank;
    uploadedById: Id;
    createdAt: string;
    updatedAt: string;
    canManageAccess?: boolean;
    locked?: false;
}

export interface DocumentLockedStub {
    id: Id;
    title: string;
    categoryId: Id | null;
    locked: true;
}

export type DocumentListItem = DocumentFull | DocumentLockedStub;

export function isLockedDocument(doc: DocumentListItem): doc is DocumentLockedStub {
    return 'locked' in doc && doc.locked === true;
}

export interface DocumentDetail extends DocumentFull {
    category?: { id: Id; name: string } | null;
    uploadedBy?: { id: Id; fullName: string };
    canManageAccess: boolean;
}

export interface DocumentQueryParams {
    categoryId?: Id | string | null;
    scopeTeamId?: Id | string;
    root?: boolean;
}

export interface DocumentAccessRequest {
    id: Id;
    documentId: Id;
    memberId: Id;
    status: string;
    reviewedById: Id | null;
    reviewNote: string | null;
    createdAt: string;
    reviewedAt: string | null;
}

export interface DocumentAccessRequestDetail extends DocumentAccessRequest {
    document?: Pick<DocumentFull, 'id' | 'title' | 'fileType' | 'categoryId' | 'creatorRank'> & {
        title: string;
        fileType: string;
        category?: { id: Id; name: string } | null;
    };
    member?: { id: Id; fullName: string };
}

export interface CategoryAccessRequest {
    id: Id;
    categoryId: Id;
    memberId: Id;
    status: string;
    reviewedById: Id | null;
    reviewNote: string | null;
    createdAt: string;
    reviewedAt: string | null;
}

export interface CategoryAccessRequestDetail extends CategoryAccessRequest {
    category?: Pick<DocumentCategory, 'id' | 'name' | 'scopeTeamId'>;
    member?: { id: Id; fullName: string };
}

export interface RequestAccessPayload {
    note?: string;
}

export interface DocumentAccessGrant {
    id: Id;
    documentId?: Id;
    categoryId?: Id;
    grantedToType: DocumentGrantStoredTargetType;
    memberId: Id | null;
    teamId: Id | null;
    grantedById: Id;
    expiresAt: string | null;
    revokedAt: string | null;
    revokedById: Id | null;
    createdAt: string;
    member?: { id: Id; fullName: string } | null;
    team?: { id: Id; name: string } | null;
    grantedBy?: { id: Id; fullName: string };
    revokedBy?: { id: Id; fullName: string } | null;
}

export interface CreateGrantPayload {
    grantedToType: 'TEAM';
    teamId: Id | string;
    durationPreset: DurationPreset;
}

export interface ApproveAccessRequestPayload {
    durationPreset: DurationPreset;
}

export interface DenyAccessRequestPayload {
    reviewNote?: string;
}

export interface ListAccessRequestsParams {
    status?: string;
}

export type DocumentAccessLogAction = 'VIEW' | 'DOWNLOAD';

export interface DocumentAccessLogEntry {
    id: Id;
    documentId?: Id;
    categoryId?: Id;
    memberId: Id;
    action: DocumentAccessLogAction;
    createdAt: string;
    member?: { id: Id; fullName: string };
}

export interface GetAccessLogParams {
    cursor?: Id | string;
    limit?: number;
}

export interface AccessLogResponse {
    accessLogs: DocumentAccessLogEntry[];
    nextCursor: Id | null;
}

export interface CreateCategoryPayload {
    name: string;
    order?: number;
    scopeTeamId?: Id | string | null;
}

export interface UpdateCategoryPayload {
    name?: string;
    order?: number;
}

export interface UpdateDocumentPayload {
    title?: string;
    categoryId?: Id | string | null;
}

export const documentsAPI = {
    getCategories: async (): Promise<CategoryListItem[]> => {
        const response = await apiFetch(`${API_BASE_URL}/document-categories`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<CategoryListItem[]>(response);
    },

    createCategory: async (payload: CreateCategoryPayload): Promise<DocumentCategory> => {
        const body: Record<string, string | number> = {
            name: payload.name.trim(),
        };
        if (payload.order != null) {
            body.order = payload.order;
        }
        if (payload.scopeTeamId != null && payload.scopeTeamId !== '') {
            body.scopeTeamId = Number(payload.scopeTeamId);
        }
        const response = await apiFetch(`${API_BASE_URL}/document-categories`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse<DocumentCategory>(response);
    },

    updateCategory: async (
        id: Id | string,
        payload: UpdateCategoryPayload,
    ): Promise<DocumentCategory> => {
        const body: Record<string, string | number> = {};
        if (payload.name !== undefined) {
            body.name = payload.name.trim();
        }
        if (payload.order != null) {
            body.order = payload.order;
        }
        const response = await apiFetch(`${API_BASE_URL}/document-categories/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse<DocumentCategory>(response);
    },

    deleteCategory: async (id: Id | string): Promise<{ success: boolean }> => {
        const response = await apiFetch(`${API_BASE_URL}/document-categories/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success: boolean }>(response);
    },

    getDocuments: async (params: DocumentQueryParams = {}): Promise<DocumentListItem[]> => {
        const search = new URLSearchParams();
        if (params.root) {
            search.append('root', 'true');
        } else if (params.categoryId === null) {
            search.append('categoryId', 'null');
        } else if (params.categoryId != null && params.categoryId !== '') {
            search.append('categoryId', String(params.categoryId));
        }
        if (params.scopeTeamId != null && params.scopeTeamId !== '') {
            search.append('scopeTeamId', String(params.scopeTeamId));
        }
        const qs = search.toString();
        const url = qs ? `${API_BASE_URL}/documents?${qs}` : `${API_BASE_URL}/documents`;
        const response = await apiFetch(url, { headers: getAuthHeaders() });
        return handleResponse<DocumentListItem[]>(response);
    },

    updateDocument: async (
        id: Id | string,
        payload: UpdateDocumentPayload,
    ): Promise<DocumentFull> => {
        const body: Record<string, string | number | null> = {};
        if (payload.title !== undefined) {
            body.title = payload.title.trim();
        }
        if (payload.categoryId !== undefined) {
            body.categoryId =
                payload.categoryId === null || payload.categoryId === ''
                    ? null
                    : Number(payload.categoryId);
        }
        const response = await apiFetch(`${API_BASE_URL}/documents/${id}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse<DocumentFull>(response);
    },

    deleteDocument: async (id: Id | string): Promise<{ success: boolean }> => {
        const response = await apiFetch(`${API_BASE_URL}/documents/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success: boolean }>(response);
    },

    getDocument: async (id: Id | string): Promise<DocumentDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/documents/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<DocumentDetail>(response);
    },

    requestAccess: async (
        id: Id | string,
        payload: RequestAccessPayload = {},
    ): Promise<DocumentAccessRequest> => {
        const body: Record<string, string> = {};
        if (payload.note != null && payload.note.trim()) {
            body.note = payload.note.trim();
        }
        const response = await apiFetch(`${API_BASE_URL}/documents/${id}/access-requests`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse<DocumentAccessRequest>(response);
    },

    listGrants: async (id: Id | string): Promise<DocumentAccessGrant[]> => {
        const response = await apiFetch(`${API_BASE_URL}/documents/${id}/grants`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<DocumentAccessGrant[]>(response);
    },

    createGrant: async (
        id: Id | string,
        payload: CreateGrantPayload,
    ): Promise<DocumentAccessGrant> => {
        const body: Record<string, string | number> = {
            grantedToType: 'TEAM',
            teamId: Number(payload.teamId),
            durationPreset: payload.durationPreset,
        };
        const response = await apiFetch(`${API_BASE_URL}/documents/${id}/grants`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse<DocumentAccessGrant>(response);
    },

    revokeGrant: async (
        id: Id | string,
        grantId: Id | string,
    ): Promise<DocumentAccessGrant> => {
        const response = await apiFetch(
            `${API_BASE_URL}/documents/${id}/grants/${grantId}/revoke`,
            {
                method: 'PATCH',
                headers: getAuthHeaders(),
            },
        );
        return handleResponse<DocumentAccessGrant>(response);
    },

    listAccessRequests: async (
        params: ListAccessRequestsParams = {},
    ): Promise<DocumentAccessRequestDetail[]> => {
        const search = new URLSearchParams();
        if (params.status) search.append('status', params.status);
        const qs = search.toString();
        const url = qs
            ? `${API_BASE_URL}/documents/access-requests?${qs}`
            : `${API_BASE_URL}/documents/access-requests`;
        const response = await apiFetch(url, { headers: getAuthHeaders() });
        return handleResponse<DocumentAccessRequestDetail[]>(response);
    },

    approveAccessRequest: async (
        id: Id | string,
        payload: ApproveAccessRequestPayload,
    ): Promise<{ grant: DocumentAccessGrant; request: DocumentAccessRequest }> => {
        const response = await apiFetch(
            `${API_BASE_URL}/documents/access-requests/${id}/approve`,
            {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ durationPreset: payload.durationPreset }),
            },
        );
        return handleResponse<{ grant: DocumentAccessGrant; request: DocumentAccessRequest }>(
            response,
        );
    },

    denyAccessRequest: async (
        id: Id | string,
        payload: DenyAccessRequestPayload = {},
    ): Promise<DocumentAccessRequest> => {
        const body: Record<string, string> = {};
        if (payload.reviewNote != null && payload.reviewNote.trim()) {
            body.reviewNote = payload.reviewNote.trim();
        }
        const response = await apiFetch(`${API_BASE_URL}/documents/access-requests/${id}/deny`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse<DocumentAccessRequest>(response);
    },

    uploadDocument: async (formData: FormData): Promise<DocumentFull> => {
        const response = await apiFetch(`${API_BASE_URL}/documents`, {
            method: 'POST',
            // No Content-Type — browser sets multipart boundary
            headers: {},
            body: formData,
        });
        return handleResponse<DocumentFull>(response);
    },

    uploadDocumentsBatch: async (formData: FormData): Promise<DocumentFull[]> => {
        const response = await apiFetch(`${API_BASE_URL}/documents/batch`, {
            method: 'POST',
            headers: {},
            body: formData,
        });
        return handleResponse<DocumentFull[]>(response);
    },

    downloadDocument: async (id: Id | string, fallbackName = 'document'): Promise<void> => {
        await downloadProtectedFile(`${API_BASE_URL}/documents/${id}/download`, fallbackName);
    },

    getAccessLog: async (
        id: Id | string,
        params: GetAccessLogParams = {},
    ): Promise<AccessLogResponse> => {
        const search = new URLSearchParams();
        if (params.cursor != null && params.cursor !== '') {
            search.append('cursor', String(params.cursor));
        }
        if (params.limit != null) {
            search.append('limit', String(params.limit));
        }
        const qs = search.toString();
        const url = qs
            ? `${API_BASE_URL}/documents/${id}/access-log?${qs}`
            : `${API_BASE_URL}/documents/${id}/access-log`;
        const response = await apiFetch(url, { headers: getAuthHeaders() });
        return handleResponse<AccessLogResponse>(response);
    },

    listCategoryGrants: async (id: Id | string): Promise<DocumentAccessGrant[]> => {
        const response = await apiFetch(`${API_BASE_URL}/document-categories/${id}/grants`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<DocumentAccessGrant[]>(response);
    },

    createCategoryGrant: async (
        id: Id | string,
        payload: CreateGrantPayload,
    ): Promise<DocumentAccessGrant> => {
        const body: Record<string, string | number> = {
            grantedToType: 'TEAM',
            teamId: Number(payload.teamId),
            durationPreset: payload.durationPreset,
        };
        const response = await apiFetch(`${API_BASE_URL}/document-categories/${id}/grants`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(body),
        });
        return handleResponse<DocumentAccessGrant>(response);
    },

    revokeCategoryGrant: async (
        id: Id | string,
        grantId: Id | string,
    ): Promise<DocumentAccessGrant> => {
        const response = await apiFetch(
            `${API_BASE_URL}/document-categories/${id}/grants/${grantId}/revoke`,
            {
                method: 'PATCH',
                headers: getAuthHeaders(),
            },
        );
        return handleResponse<DocumentAccessGrant>(response);
    },

    getCategoryAccessLog: async (
        id: Id | string,
        params: GetAccessLogParams = {},
    ): Promise<AccessLogResponse> => {
        const search = new URLSearchParams();
        if (params.cursor != null && params.cursor !== '') {
            search.append('cursor', String(params.cursor));
        }
        if (params.limit != null) {
            search.append('limit', String(params.limit));
        }
        const qs = search.toString();
        const url = qs
            ? `${API_BASE_URL}/document-categories/${id}/access-log?${qs}`
            : `${API_BASE_URL}/document-categories/${id}/access-log`;
        const response = await apiFetch(url, { headers: getAuthHeaders() });
        return handleResponse<AccessLogResponse>(response);
    },

    logCategoryView: async (id: Id | string): Promise<DocumentAccessLogEntry> => {
        const response = await apiFetch(`${API_BASE_URL}/document-categories/${id}/view-log`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({}),
        });
        return handleResponse<DocumentAccessLogEntry>(response);
    },

    requestCategoryAccess: async (
        id: Id | string,
        payload: RequestAccessPayload = {},
    ): Promise<CategoryAccessRequest> => {
        const body: Record<string, string> = {};
        if (payload.note != null && payload.note.trim()) {
            body.note = payload.note.trim();
        }
        const response = await apiFetch(
            `${API_BASE_URL}/document-categories/${id}/access-requests`,
            {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(body),
            },
        );
        return handleResponse<CategoryAccessRequest>(response);
    },

    listCategoryAccessRequests: async (
        params: ListAccessRequestsParams = {},
    ): Promise<CategoryAccessRequestDetail[]> => {
        const search = new URLSearchParams();
        if (params.status) search.append('status', params.status);
        const qs = search.toString();
        const url = qs
            ? `${API_BASE_URL}/document-categories/access-requests?${qs}`
            : `${API_BASE_URL}/document-categories/access-requests`;
        const response = await apiFetch(url, { headers: getAuthHeaders() });
        return handleResponse<CategoryAccessRequestDetail[]>(response);
    },

    approveCategoryAccessRequest: async (
        id: Id | string,
        payload: ApproveAccessRequestPayload,
    ): Promise<{ grant: DocumentAccessGrant; request: CategoryAccessRequest }> => {
        const response = await apiFetch(
            `${API_BASE_URL}/document-categories/access-requests/${id}/approve`,
            {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify({ durationPreset: payload.durationPreset }),
            },
        );
        return handleResponse<{ grant: DocumentAccessGrant; request: CategoryAccessRequest }>(
            response,
        );
    },

    denyCategoryAccessRequest: async (
        id: Id | string,
        payload: DenyAccessRequestPayload = {},
    ): Promise<CategoryAccessRequest> => {
        const body: Record<string, string> = {};
        if (payload.reviewNote != null && payload.reviewNote.trim()) {
            body.reviewNote = payload.reviewNote.trim();
        }
        const response = await apiFetch(
            `${API_BASE_URL}/document-categories/access-requests/${id}/deny`,
            {
                method: 'PATCH',
                headers: getAuthHeaders(),
                body: JSON.stringify(body),
            },
        );
        return handleResponse<CategoryAccessRequest>(response);
    },
};
