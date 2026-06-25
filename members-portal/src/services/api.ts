import type {
    AddDependencyPayload,
    AddTaskTagPayload,
    ApiErrorResponse,
    ConflictErrorResponse,
    CreatePhasePayload,
    CreateEventCustomFieldPayload,
    CreateEventPayload,
    CreateEventRegistrationPayload,
    CreateEventTierPayload,
    CreateEventTaskPayload,
    CheckInRegistrationPayload,
    RemoveRegistrationAttendancePayload,
    CreateProjectPayload,
    CreateScheduleSlotPayload,
    CreateTaskPayload,
    Id,
    ImportRegistrationsPayload,
    ImportRegistrationsResult,
    SendRegistrationRemindersPayload,
    SendRegistrationTicketsPayload,
    SendRegistrationTicketsResult,
    EventCustomFieldRef,
    EventDetail,
    EventFileCommentRef,
    EventFileHistoryEntry,
    EventFileRef,
    EventFolderRef,
    EventQueryParams,
    EventRegistrationQueryParams,
    EventRegistrationLookupResult,
    EventRegistrationRef,
    WalkInRegistrationResult,
    EventStatistics,
    EventSummary,
    EventActivityEntry,
    EventTierRef,
    EventTaskRef,
    MemberSummary,
    NotificationMarkAllReadResponse,
    NotificationMarkReadResponse,
    NotificationsListResponse,
    NotificationUnreadCountResponse,
    PhaseSummary,
    Priority,
    ProjectActivityEntry,
    ProjectDetail,
    ProjectFileCommentRef,
    ProjectFileHistoryEntry,
    ProjectFileRef,
    ProjectFolderRef,
    ProjectQueryParams,
    ProjectSummary,
    ProjectTeamRef,
    ProjectTypeRef,
    ScheduleSlot,
    TaskActivityEntry,
    TaskAssignmentRef,
    TaskAssignmentStatus,
    TaskCommentRef,
    TaskTeamRef,
    TaskStatus,
    TaskSummary,
    UpdatePhasePayload,
    UpdateEventCustomFieldPayload,
    UpdateEventPayload,
    UpdateEventRegistrationPayload,
    UpdateEventTierPayload,
    UpdateEventTaskPayload,
    UpdateProjectPayload,
    UpdateScheduleSlotPayload,
    UpdateTaskPayload,
    ReorderEventCustomFieldsPayload,
} from "../types/backend-contracts";
import { ConflictError } from './conflictError';

function isLoopbackHost(hostname: string): boolean {
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

function resolveApiBaseUrl(): string {
    const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;

    if (configuredApiUrl) {
        if (typeof window !== 'undefined') {
            try {
                const parsed = new URL(configuredApiUrl);
                if (isLoopbackHost(parsed.hostname) && !isLoopbackHost(window.location.hostname)) {
                    parsed.hostname = window.location.hostname;
                    return parsed.toString();
                }
            } catch {
                // Keep configured value when it's not an absolute URL.
            }
        }

        return configuredApiUrl;
    }

    if (typeof window !== 'undefined') {
        return `${window.location.protocol}//${window.location.hostname}:3000/api`;
    }

    return 'http://localhost:3000/api';
}

const API_BASE_URL = resolveApiBaseUrl();

export function shouldSendCredentials(): boolean {
    if (typeof window === 'undefined') return false;
    try {
        const api = new URL(API_BASE_URL, window.location.origin);
        const page = new URL(window.location.href);
        if (api.origin === page.origin) return true;
        return isLoopbackHost(api.hostname) && isLoopbackHost(page.hostname);
    } catch {
        return false;
    }
}

export { ConflictError, isConflictError } from './conflictError';

export function getNotificationsWebSocketUrl(): string {
    if (typeof window === 'undefined') {
        return '';
    }

    const parsed = new URL(API_BASE_URL, window.location.origin);
    parsed.protocol = parsed.protocol === 'https:' ? 'wss:' : 'ws:';
    parsed.pathname = `${parsed.pathname.replace(/\/$/, '')}/notifications/ws`;
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
}

type ApiNamespace = Record<string, (...args: any[]) => any>;
type JsonHeaders = Record<string, string>;


// Auth token management
let authToken: string | null = null;

export function getAuthToken(): string | null {
    return authToken;
}

export function setToken(token: string) {
    authToken = token;
    try {
        localStorage.setItem('auth_token', token);
    } catch { }
}

export function clearToken() {
    authToken = null;
    try {
        localStorage.removeItem('auth_token');
    } catch { }
}

export function initToken() {
    try {
        const stored = localStorage.getItem('auth_token');
        if (stored) authToken = stored;
        return stored;
    } catch {
        return null;
    }
}

// Base fetch function that always includes the token
export const apiFetch = (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    const headers: Record<string, string> = {
        ...(init.headers as Record<string, string>),
    };
    if (authToken) {
        headers['Authorization'] = `Bearer ${authToken}`;
    }
    return globalThis.fetch(input, {
        ...init,
        credentials: shouldSendCredentials() ? 'include' : 'omit',
        headers,
    });
};

async function getDownloadFileName(response: Response, fallbackName: string): Promise<string> {
    const contentDisposition = response.headers.get('content-disposition');
    if (!contentDisposition) return fallbackName;

    const utf8Match = /filename\*=UTF-8''([^;]+)/i.exec(contentDisposition);
    if (utf8Match?.[1]) {
        try {
            return decodeURIComponent(utf8Match[1]);
        } catch {
            return utf8Match[1];
        }
    }

    const plainMatch = /filename="?([^";]+)"?/i.exec(contentDisposition);
    if (plainMatch?.[1]) return plainMatch[1];

    return fallbackName;
}

export async function downloadProtectedFile(url: string, fallbackName: string): Promise<void> {
    const response = await apiFetch(url, { method: 'GET' });
    if (!response.ok) {
        const error = (await response.json().catch(() => ({ error: 'Failed to download file' }))) as ApiErrorResponse;
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }

    const fileName = await getDownloadFileName(response, fallbackName);
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);

    try {
        const anchor = document.createElement('a');
        anchor.href = blobUrl;
        anchor.download = fileName;
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
    } finally {
        URL.revokeObjectURL(blobUrl);
    }
}

interface TaskQueryParams {
    projectId?: Id | string;
    memberId?: Id | string;
    status?: TaskStatus;
    priority?: Priority;
    overdue?: boolean;
    topLevelOnly?: boolean;
}

interface ScheduleSlotQueryParams {
    projectId?: Id | string;
    taskId?: Id | string;
    memberId?: Id | string;
    includeInactive?: boolean;
}

interface NotificationQueryParams {
    cursor?: Id | string;
    limit?: number;
    unreadOnly?: boolean;
}

// Helper function to get auth headers
const getAuthHeaders = (): JsonHeaders => {
    return {
        'Content-Type': 'application/json',
    };
};

// Auth-only headers (no Content-Type — used for FormData uploads)
const getAuthOnlyHeaders = (): JsonHeaders => {
    return {};
};

// Helper function to handle API responses
const handleResponse = async <T = unknown>(response: Response): Promise<T> => {
    if (!response.ok) {
        const error = (await response.json().catch(() => ({ error: 'An error occurred' }))) as ApiErrorResponse & ConflictErrorResponse;
        if (response.status === 409 && error.code) {
            throw new ConflictError(error);
        }
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return (await response.json()) as T;
};

// ============================================
// TEAMS API
// ============================================

/**
 * Build a public proxy URL for a member's profile photo.
 * Uses the backend proxy (no auth needed) so private-repo images load in <img> tags.
 * Returns null when no memberId is provided.
 *
 * @param {number|string|null} memberId
 * @returns {string|null}
 */
export function getProfilePhotoUrl(memberId: Id | string | null | undefined): string | null {
    if (!memberId) return null;
    return `${API_BASE_URL}/members/${memberId}/profile-photo`;
}

export const teamsAPI: ApiNamespace = {
    // Get all teams. scope='all' returns every team (for Members/Alumni); no scope returns only user's teams for non-admins.
    getAll: async (isActive, scope) => {
        const params = new URLSearchParams();
        if (isActive !== undefined) params.append('isActive', isActive);
        if (scope === 'all') params.append('scope', 'all');
        const qs = params.toString();
        const url = qs ? `${API_BASE_URL}/teams?${qs}` : `${API_BASE_URL}/teams`;

        const response = await apiFetch(url, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Get single team by ID
    getById: async (id) => {
        const response = await apiFetch(`${API_BASE_URL}/teams/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Create new team
    create: async (teamData) => {
        const response = await apiFetch(`${API_BASE_URL}/teams`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(teamData),
        });
        return handleResponse(response);
    },

    // Update team
    update: async (id, teamData) => {
        const response = await apiFetch(`${API_BASE_URL}/teams/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(teamData),
        });
        return handleResponse(response);
    },

    // Deactivate team
    deactivate: async (id) => {
        const response = await apiFetch(`${API_BASE_URL}/teams/${id}/deactivate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Activate team
    activate: async (id) => {
        const response = await apiFetch(`${API_BASE_URL}/teams/${id}/activate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // No delete - teams are only deactivated
};

// ============================================
// TEAM ROLES API
// ============================================

export const teamRolesAPI: ApiNamespace = {
    // Get all roles (optionally filter by team)
    getAll: async (teamId, isActive) => {
        let url = `${API_BASE_URL}/team-roles`;
        const params = new URLSearchParams();

        if (teamId) params.append('teamId', teamId);
        if (isActive !== undefined) params.append('isActive', isActive);

        if (params.toString()) url += `?${params.toString()}`;

        const response = await apiFetch(url, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Get single role
    getById: async (id) => {
        const response = await apiFetch(`${API_BASE_URL}/team-roles/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Create new role
    create: async (roleData) => {
        const response = await apiFetch(`${API_BASE_URL}/team-roles`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(roleData),
        });
        return handleResponse(response);
    },

    // Update role
    update: async (id, roleData) => {
        const response = await apiFetch(`${API_BASE_URL}/team-roles/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(roleData),
        });
        return handleResponse(response);
    },

    // Deactivate role (no permanent delete)
    deactivate: async (id) => {
        const response = await apiFetch(`${API_BASE_URL}/team-roles/${id}/deactivate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Activate role
    activate: async (id) => {
        const response = await apiFetch(`${API_BASE_URL}/team-roles/${id}/activate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },
};

// ============================================
// TEAM SUBTEAMS API
// ============================================

export const teamSubteamsAPI: ApiNamespace = {
    getAll: async (teamId, isActive) => {
        let url = `${API_BASE_URL}/team-subteams`;
        const params = new URLSearchParams();
        if (teamId) params.append('teamId', teamId);
        if (isActive !== undefined) params.append('isActive', isActive);
        if (params.toString()) url += `?${params.toString()}`;
        const response = await apiFetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    getById: async (id) => {
        const response = await apiFetch(`${API_BASE_URL}/team-subteams/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    create: async (data) => {
        const response = await apiFetch(`${API_BASE_URL}/team-subteams`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    update: async (id, data) => {
        const response = await apiFetch(`${API_BASE_URL}/team-subteams/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    // Deactivate subteam (no permanent delete)
    deactivate: async (id) => {
        const response = await apiFetch(`${API_BASE_URL}/team-subteams/${id}/deactivate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Activate subteam
    activate: async (id) => {
        const response = await apiFetch(`${API_BASE_URL}/team-subteams/${id}/activate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },
};

// ============================================
// TEAM MEMBERS API
// ============================================

export const teamMembersAPI: ApiNamespace = {
    // Get all team member assignments
    getAll: async (teamId, memberId, isActive) => {
        let url = `${API_BASE_URL}/team-members`;
        const params = new URLSearchParams();

        if (teamId) params.append('teamId', teamId);
        if (memberId) params.append('memberId', memberId);
        if (isActive !== undefined) params.append('isActive', isActive);

        if (params.toString()) url += `?${params.toString()}`;

        const response = await apiFetch(url, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Get single assignment
    getById: async (id) => {
        const response = await apiFetch(`${API_BASE_URL}/team-members/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Assign member to team
    assign: async (assignmentData) => {
        const response = await apiFetch(`${API_BASE_URL}/team-members/assign`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(assignmentData),
        });
        return handleResponse(response);
    },

    // Change member's role
    changeRole: async (id, roleChangeData) => {
        const response = await apiFetch(`${API_BASE_URL}/team-members/${id}/change-role`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(roleChangeData),
        });
        return handleResponse(response);
    },

    // Transfer member to different team
    transfer: async (id, transferData) => {
        const response = await apiFetch(`${API_BASE_URL}/team-members/${id}/transfer`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(transferData),
        });
        return handleResponse(response);
    },

    // Update assignment status only (active/inactive)
    updateStatus: async (id, statusData) => {
        const response = await apiFetch(`${API_BASE_URL}/team-members/${id}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(statusData),
        });
        return handleResponse(response);
    },

    // Remove member from team
    remove: async (id, removalData) => {
        const response = await apiFetch(`${API_BASE_URL}/team-members/${id}/remove`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(removalData),
        });
        return handleResponse(response);
    },
};

// ============================================
// ALUMNI API (members who left the club – from dedicated Alumni table)
// ============================================

export const alumniAPI: ApiNamespace = {
    getAll: async (teamId) => {
        let url = `${API_BASE_URL}/alumni`;
        if (teamId) url += `?teamId=${teamId}`;
        const response = await apiFetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
    },
};

// ============================================
// ADMINISTRATION API (Administration team: Officer, President, Vice President)
// ============================================

export const administrationAPI: ApiNamespace = {
    // Get the Administration team with roles and members (get-or-create with Officer, President, Vice President)
    getTeam: async () => {
        const response = await apiFetch(`${API_BASE_URL}/administration/team`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Create a placeholder officer member (accepts { identifier })
    createOfficer: async (data) => {
        const response = await apiFetch(`${API_BASE_URL}/administration/officer`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    // Hand over a leadership role to an existing member
    handoverLeadership: async (data) => {
        const response = await apiFetch(`${API_BASE_URL}/administration/leadership-handover`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },
};

// ============================================
// MEMBERS API
// ============================================

export const membersAPI: ApiNamespace = {
    // Get all members
    getAll: async (isActive, unassignedOnly) => {
        const params = new URLSearchParams();
        if (isActive !== undefined) params.append('isActive', isActive);
        if (unassignedOnly) params.append('unassignedOnly', 'true');
        const url = params.toString() ? `${API_BASE_URL}/members?${params.toString()}` : `${API_BASE_URL}/members`;

        const response = await apiFetch(url, {
            headers: getAuthHeaders(),
            ...(unassignedOnly && { cache: 'no-store' }),
        });
        return handleResponse(response);
    },

    // Get single member
    getById: async (id) => {
        const response = await apiFetch(`${API_BASE_URL}/members/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Get filtered member profile for viewing by other members
    getProfile: async (id) => {
        const response = await apiFetch(`${API_BASE_URL}/members/${id}/profile`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Create new member
    create: async (memberData) => {
        const response = await apiFetch(`${API_BASE_URL}/members`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(memberData),
        });
        return handleResponse(response);
    },

    // Update member
    update: async (id, memberData) => {
        const response = await apiFetch(`${API_BASE_URL}/members/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(memberData),
        });
        return handleResponse(response);
    },

    // Deactivate member (no permanent delete)
    deactivate: async (id) => {
        const response = await apiFetch(`${API_BASE_URL}/members/${id}/deactivate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Reactivate member
    activate: async (id) => {
        const response = await apiFetch(`${API_BASE_URL}/members/${id}/activate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Upload profile photo (multipart/form-data)
    uploadProfilePhoto: async (memberId, file) => {
        const formData = new FormData();
        formData.append('photo', file);
        const response = await apiFetch(`${API_BASE_URL}/members/${memberId}/profile-photo`, {
            method: 'POST',
            headers: getAuthOnlyHeaders(),
            body: formData,
        });
        return handleResponse(response);
    },

    // Delete profile photo
    deleteProfilePhoto: async (memberId) => {
        const response = await apiFetch(`${API_BASE_URL}/members/${memberId}/profile-photo`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Mark an unassigned member as alumni (leave: graduation, expulsion, resignation, retirement)
    leave: async (memberId, { leaveType, changeReason, notes }) => {
        const response = await apiFetch(`${API_BASE_URL}/members/${memberId}/leave`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ leaveType, changeReason, notes }),
        });
        return handleResponse(response);
    },
};

// ============================================
// AUTH API
// ============================================

export const authAPI: ApiNamespace = {
    changePassword: async (currentPassword, newPassword, confirmPassword) => {
        const response = await apiFetch(`${API_BASE_URL}/auth/change-password`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        });
        return handleResponse(response);
    },
};

// ============================================
// PROJECT TYPES API
// ============================================

export const projectTypesAPI = {
    getAll: async (): Promise<ProjectTypeRef[]> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/types`, { headers: getAuthHeaders() });
        return handleResponse<ProjectTypeRef[]>(response);
    },
};

// ============================================
// PROJECTS API
// ============================================

export const projectsAPI = {
    getAll: async ({ status, priority, teamId, createdByMe, isActive, archived }: ProjectQueryParams = {}): Promise<ProjectSummary[]> => {
        const params = new URLSearchParams();
        if (status) params.append('status', String(status));
        if (priority) params.append('priority', String(priority));
        if (teamId) params.append('teamId', String(teamId));
        if (createdByMe) params.append('createdByMe', 'true');
        if (isActive !== undefined) params.append('isActive', String(isActive));
        if (archived) params.append('archived', 'true');
        const qs = params.toString();
        const url = qs ? `${API_BASE_URL}/projects?${qs}` : `${API_BASE_URL}/projects`;
        const response = await apiFetch(url, { headers: getAuthHeaders() });
        return handleResponse<ProjectSummary[]>(response);
    },

    getById: async (id: Id | string): Promise<ProjectDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/${id}`, {
            headers: getAuthHeaders(),
            cache: 'no-store',
        });
        return handleResponse<ProjectDetail>(response);
    },

    create: async (data: CreateProjectPayload): Promise<ProjectDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/projects`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse<ProjectDetail>(response);
    },

    update: async (id: Id | string, data: UpdateProjectPayload): Promise<ProjectDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse<ProjectDetail>(response);
    },

    getActivity: async (id: Id | string): Promise<ProjectActivityEntry[]> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/${id}/activity`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<ProjectActivityEntry[]>(response);
    },

    deactivate: async (id: Id | string): Promise<ProjectDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/${id}/deactivate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse<ProjectDetail>(response);
    },

    reactivate: async (id: Id | string): Promise<ProjectDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/${id}/reactivate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse<ProjectDetail>(response);
    },

    abort: async (id: Id | string): Promise<ProjectDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/${id}/abort`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse<ProjectDetail>(response);
    },

    activate: async (id: Id | string): Promise<ProjectDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/${id}/activate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse<ProjectDetail>(response);
    },

    finalize: async (id: Id | string): Promise<ProjectDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/${id}/finalize`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse<ProjectDetail>(response);
    },

    publish: async (id: Id | string): Promise<ProjectDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/${id}/publish`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse<ProjectDetail>(response);
    },

    archive: async (id: Id | string): Promise<ProjectDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/${id}/archive`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse<ProjectDetail>(response);
    },

    setDisclosed: async (id: Id | string, disclosed: boolean): Promise<ProjectDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/${id}/disclose`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ disclosed }),
        });
        return handleResponse<ProjectDetail>(response);
    },

    addTeam: async (projectId: Id | string, teamData: { teamId: Id | string; canEdit?: boolean; isOwner?: boolean }): Promise<ProjectTeamRef> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/teams`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(teamData),
        });
        return handleResponse<ProjectTeamRef>(response);
    },

    updateTeam: async (projectId: Id | string, teamId: Id | string, data: Partial<ProjectTeamRef>): Promise<ProjectTeamRef> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/teams/${teamId}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse<ProjectTeamRef>(response);
    },

    removeTeam: async (projectId: Id | string, teamId: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/teams/${teamId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },

    addTag: async (projectId: Id | string, tagName: string): Promise<{ id: Id; tagName: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/tags`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ tagName }),
        });
        return handleResponse<{ id: Id; tagName: string }>(response);
    },

    removeTag: async (projectId: Id | string, tagId: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/tags/${tagId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },

    setBaseline: async (projectId: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/set-baseline`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },

    clearBaseline: async (projectId: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/projects/${projectId}/clear-baseline`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },
};

// ============================================
// TASKS API
// ============================================

export const tasksAPI = {
    getAll: async ({ projectId, memberId, status, priority, overdue, topLevelOnly }: TaskQueryParams = {}): Promise<TaskSummary[]> => {
        const params = new URLSearchParams();
        if (projectId) params.append('projectId', String(projectId));
        if (memberId) params.append('memberId', String(memberId));
        if (status) params.append('status', String(status));
        if (priority) params.append('priority', String(priority));
        if (overdue) params.append('overdue', 'true');
        if (topLevelOnly) params.append('topLevelOnly', 'true');
        const qs = params.toString();
        const url = qs ? `${API_BASE_URL}/tasks?${qs}` : `${API_BASE_URL}/tasks`;
        const response = await apiFetch(url, { headers: getAuthHeaders() });
        return handleResponse<TaskSummary[]>(response);
    },

    getById: async (id: Id | string): Promise<TaskSummary> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${id}`, { headers: getAuthHeaders() });
        return handleResponse<TaskSummary>(response);
    },

    create: async (data: CreateTaskPayload): Promise<TaskSummary> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse<TaskSummary>(response);
    },

    update: async (id: Id | string, data: UpdateTaskPayload): Promise<TaskSummary> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse<TaskSummary>(response);
    },

    updateStatus: async (id: Id | string, status: TaskStatus): Promise<TaskSummary> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${id}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status }),
        });
        return handleResponse<TaskSummary>(response);
    },

    remove: async (id: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },

    duplicate: async (id: Id | string, data: Record<string, unknown> = {}): Promise<TaskSummary> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${id}/duplicate`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse<TaskSummary>(response);
    },

    addTeam: async (taskId: Id | string, teamData: { teamId: Id | string; canEdit?: boolean }): Promise<TaskTeamRef> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${taskId}/teams`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(teamData),
        });
        return handleResponse<TaskTeamRef>(response);
    },

    removeTeam: async (taskId: Id | string, teamId: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${taskId}/teams/${teamId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },

    assignMember: async (taskId: Id | string, memberId: Id | string): Promise<TaskAssignmentRef> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${taskId}/assign`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ memberId }),
        });
        return handleResponse<TaskAssignmentRef>(response);
    },

    selfAssign: async (taskId: Id | string): Promise<TaskAssignmentRef> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${taskId}/self-assign`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        return handleResponse<TaskAssignmentRef>(response);
    },

    updateAssignment: async (
        taskId: Id | string,
        memberId: Id | string,
        status: TaskAssignmentStatus,
    ): Promise<TaskAssignmentRef> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${taskId}/assign/${memberId}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status }),
        });
        return handleResponse<TaskAssignmentRef>(response);
    },

    unassignMember: async (taskId: Id | string, memberId: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${taskId}/assign/${memberId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },

    getComments: async (taskId: Id | string): Promise<TaskCommentRef[]> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${taskId}/comments`, { headers: getAuthHeaders() });
        return handleResponse<TaskCommentRef[]>(response);
    },

    addComment: async (taskId: Id | string, comment: string): Promise<TaskCommentRef> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${taskId}/comments`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ comment }),
        });
        return handleResponse<TaskCommentRef>(response);
    },

    editComment: async (taskId: Id | string, commentId: Id | string, comment: string): Promise<TaskCommentRef> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${taskId}/comments/${commentId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ comment }),
        });
        return handleResponse<TaskCommentRef>(response);
    },

    deleteComment: async (taskId: Id | string, commentId: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${taskId}/comments/${commentId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },

    getActivity: async (taskId: Id | string): Promise<TaskActivityEntry[]> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${taskId}/activity`, { headers: getAuthHeaders() });
        return handleResponse<TaskActivityEntry[]>(response);
    },

    addTag: async (taskId: Id | string, tagType: string, tagName: string): Promise<AddTaskTagPayload & { id?: Id; taskId?: Id }> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${taskId}/tags`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ tagType, tagName }),
        });
        return handleResponse<AddTaskTagPayload & { id?: Id; taskId?: Id }>(response);
    },

    removeTag: async (taskId: Id | string, tagId: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${taskId}/tags/${tagId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },

    addDependency: async (taskId: Id | string, dependsOnTaskId: Id | string, dependencyType?: string): Promise<AddDependencyPayload> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${taskId}/dependencies`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ dependsOnTaskId, dependencyType }),
        });
        return handleResponse<AddDependencyPayload>(response);
    },

    removeDependency: async (taskId: Id | string, dependsOnTaskId: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/tasks/${taskId}/dependencies/${dependsOnTaskId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },
};

// ============================================
// SCHEDULE SLOTS API
// ============================================

export const scheduleSlotsAPI = {
    getAll: async ({ projectId, taskId, memberId, includeInactive }: ScheduleSlotQueryParams = {}): Promise<ScheduleSlot[]> => {
        const params = new URLSearchParams();
        if (projectId) params.append('projectId', String(projectId));
        if (taskId) params.append('taskId', String(taskId));
        if (memberId) params.append('memberId', String(memberId));
        if (includeInactive) params.append('includeInactive', 'true');
        const qs = params.toString();
        const response = await apiFetch(`${API_BASE_URL}/schedule-slots${qs ? `?${qs}` : ''}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<ScheduleSlot[]>(response);
    },

    create: async (data: CreateScheduleSlotPayload): Promise<ScheduleSlot> => {
        const response = await apiFetch(`${API_BASE_URL}/schedule-slots`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse<ScheduleSlot>(response);
    },

    update: async (id: Id | string, data: UpdateScheduleSlotPayload): Promise<ScheduleSlot> => {
        const response = await apiFetch(`${API_BASE_URL}/schedule-slots/${id}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse<ScheduleSlot>(response);
    },

    remove: async (id: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/schedule-slots/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },
};

// ============================================
// NOTIFICATIONS API
// ============================================

export const notificationsAPI = {
    getAll: async ({ cursor, limit, unreadOnly }: NotificationQueryParams = {}): Promise<NotificationsListResponse> => {
        const params = new URLSearchParams();
        if (cursor) params.append('cursor', String(cursor));
        if (limit) params.append('limit', String(limit));
        if (unreadOnly) params.append('unreadOnly', 'true');

        const qs = params.toString();
        const response = await apiFetch(`${API_BASE_URL}/notifications${qs ? `?${qs}` : ''}`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<NotificationsListResponse>(response);
    },

    getUnreadCount: async (): Promise<NotificationUnreadCountResponse> => {
        const response = await apiFetch(`${API_BASE_URL}/notifications/unread-count`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<NotificationUnreadCountResponse>(response);
    },

    markRead: async (id: Id | string): Promise<NotificationMarkReadResponse> => {
        const response = await apiFetch(`${API_BASE_URL}/notifications/${id}/read`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });

        return handleResponse<NotificationMarkReadResponse>(response);
    },

    markAllRead: async (): Promise<NotificationMarkAllReadResponse> => {
        const response = await apiFetch(`${API_BASE_URL}/notifications/read-all`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });

        return handleResponse<NotificationMarkAllReadResponse>(response);
    },
};

// ============================================
// ROLE HISTORY API
// ============================================

export const roleHistoryAPI: ApiNamespace = {
    getMemberHistory: async (memberId) => {
        const response = await apiFetch(`${API_BASE_URL}/role-history/member/${memberId}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    getMemberTimeline: async (memberId) => {
        const response = await apiFetch(`${API_BASE_URL}/role-history/member/${memberId}/timeline`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    getAll: async (memberId, teamId, changeType, isActive) => {
        let url = `${API_BASE_URL}/role-history`;
        const params = new URLSearchParams();
        if (memberId) params.append('memberId', memberId);
        if (teamId) params.append('teamId', teamId);
        if (changeType) params.append('changeType', changeType);
        if (isActive !== undefined) params.append('isActive', isActive);
        if (params.toString()) url += `?${params.toString()}`;
        const response = await apiFetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    getById: async (id) => {
        const response = await apiFetch(`${API_BASE_URL}/role-history/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },
};

// ============================================
// PHASES API
// ============================================

export const phasesAPI = {
    getAll: async (projectId: Id | string): Promise<PhaseSummary[]> => {
        const response = await apiFetch(`${API_BASE_URL}/phases?projectId=${projectId}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<PhaseSummary[]>(response);
    },

    create: async (data: CreatePhasePayload): Promise<PhaseSummary> => {
        const response = await apiFetch(`${API_BASE_URL}/phases`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse<PhaseSummary>(response);
    },

    update: async (id: Id | string, data: UpdatePhasePayload): Promise<PhaseSummary> => {
        const response = await apiFetch(`${API_BASE_URL}/phases/${id}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse<PhaseSummary>(response);
    },

    remove: async (id: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/phases/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },

    duplicate: async (id: Id | string, data: Record<string, unknown> = {}): Promise<PhaseSummary> => {
        const response = await apiFetch(`${API_BASE_URL}/phases/${id}/duplicate`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse<PhaseSummary>(response);
    },
};

// ============================================
// PROJECT FILES API
// ============================================

export const projectFilesAPI = {
    getAll: async (projectId: Id | string): Promise<ProjectFileRef[]> => {
        const response = await apiFetch(`${API_BASE_URL}/project-files?projectId=${projectId}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<ProjectFileRef[]>(response);
    },

    getFolders: async (projectId: Id | string, includeDeleted = false): Promise<ProjectFolderRef[]> => {
        const response = await apiFetch(`${API_BASE_URL}/project-files/folders?projectId=${projectId}&includeDeleted=${includeDeleted}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<ProjectFolderRef[]>(response);
    },

    createFolder: async (projectId: Id | string, folderName: string, createdByMemberId: Id | string): Promise<ProjectFolderRef> => {
        const response = await apiFetch(`${API_BASE_URL}/project-files/folders`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectId, folderName, createdByMemberId }),
        });
        return handleResponse<ProjectFolderRef>(response);
    },

    removeFolder: async (folderId: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/project-files/folders/${folderId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },

    restoreFolder: async (folderId: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/project-files/folders/${folderId}/restore`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },

    getFolderHistory: async (folderId: Id | string): Promise<ProjectFileHistoryEntry[]> => {
        const response = await apiFetch(`${API_BASE_URL}/project-files/folders/${folderId}/history`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<ProjectFileHistoryEntry[]>(response);
    },

    renameFolder: async (folderId: Id | string, folderName: string): Promise<ProjectFolderRef> => {
        const response = await apiFetch(`${API_BASE_URL}/project-files/folders/${folderId}/rename`, {
            method: 'PATCH',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderName }),
        });
        return handleResponse<ProjectFolderRef>(response);
    },

    /** Build a download URL that relies on cookie-based auth. */
    getDownloadUrl: (fileId: Id | string): string => {
        return `${API_BASE_URL}/project-files/${fileId}/download`;
    },

    download: async (fileId: Id | string, fileName: string): Promise<void> => {
        await downloadProtectedFile(`${API_BASE_URL}/project-files/${fileId}/download`, fileName);
    },

    upload: (
        projectId: Id | string,
        uploadedByMemberId: Id | string,
        file: File,
        onProgress?: (progress: number) => void,
        folderId: Id | string | null = null,
    ): Promise<ProjectFileRef> => {
        return new Promise<ProjectFileRef>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = new FormData();
            formData.append('file', file);
            formData.append('projectId', String(projectId));
            formData.append('uploadedByMemberId', String(uploadedByMemberId));
            if (folderId != null) formData.append('folderId', String(folderId));

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && onProgress) {
                    onProgress(Math.round((e.loaded / e.total) * 100));
                }
            };

            xhr.onload = () => {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(data as ProjectFileRef);
                    } else {
                        reject(new Error(data.error || `Upload failed (${xhr.status})`));
                    }
                } catch {
                    reject(new Error('Failed to parse upload response'));
                }
            };

            xhr.onerror = () => reject(new Error('Network error during upload'));

            xhr.open('POST', `${API_BASE_URL}/project-files/upload`);
            const token = getAuthToken();
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            xhr.withCredentials = true;
            xhr.send(formData);
        });
    },

    remove: async (fileId: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/project-files/${fileId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },

    /** Fetch the commit history for a file (newest first). */
    getHistory: async (fileId: Id | string): Promise<ProjectFileHistoryEntry[]> => {
        const response = await apiFetch(`${API_BASE_URL}/project-files/${fileId}/history`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<ProjectFileHistoryEntry[]>(response);
    },

    getComments: async (fileId: Id | string): Promise<ProjectFileCommentRef[]> => {
        const response = await apiFetch(`${API_BASE_URL}/project-files/${fileId}/comments`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<ProjectFileCommentRef[]>(response);
    },

    addComment: async (fileId: Id | string, comment: string): Promise<ProjectFileCommentRef> => {
        const response = await apiFetch(`${API_BASE_URL}/project-files/${fileId}/comments`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment }),
        });
        return handleResponse<ProjectFileCommentRef>(response);
    },

    editComment: async (fileId: Id | string, commentId: Id | string, comment: string): Promise<ProjectFileCommentRef> => {
        const response = await apiFetch(`${API_BASE_URL}/project-files/${fileId}/comments/${commentId}`, {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment }),
        });
        return handleResponse<ProjectFileCommentRef>(response);
    },

    deleteComment: async (fileId: Id | string, commentId: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/project-files/${fileId}/comments/${commentId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },

    /** Build a URL to download a specific version of a file using cookie auth. */
    getVersionDownloadUrl: (fileId: Id | string, commitSha: string): string => {
        return `${API_BASE_URL}/project-files/${fileId}/version/${commitSha}`;
    },

    downloadVersion: async (fileId: Id | string, commitSha: string, fileName: string): Promise<void> => {
        await downloadProtectedFile(`${API_BASE_URL}/project-files/${fileId}/version/${commitSha}`, fileName);
    },

    /** Rename a file (display name only). */
    rename: async (fileId: Id | string, fileName: string): Promise<ProjectFileRef> => {
        const response = await apiFetch(`${API_BASE_URL}/project-files/${fileId}/rename`, {
            method: 'PATCH',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName }),
        });
        return handleResponse<ProjectFileRef>(response);
    },

    /** Move a file between root and folders (metadata only). */
    move: async (fileId: Id | string, folderId: Id | string | null = null): Promise<ProjectFileRef> => {
        const response = await apiFetch(`${API_BASE_URL}/project-files/${fileId}/move`, {
            method: 'PATCH',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderId }),
        });
        return handleResponse<ProjectFileRef>(response);
    },

    /** Fetch soft-deleted files for a project. */
    getDeleted: async (projectId: Id | string): Promise<ProjectFileRef[]> => {
        const response = await apiFetch(`${API_BASE_URL}/project-files/deleted?projectId=${projectId}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<ProjectFileRef[]>(response);
    },

    /** Restore a soft-deleted file from GitHub history. */
    restore: async (fileId: Id | string): Promise<ProjectFileRef> => {
        const response = await apiFetch(`${API_BASE_URL}/project-files/${fileId}/restore`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        return handleResponse<ProjectFileRef>(response);
    },
};

// ============================================
// EVENT FILES API
// ============================================

export const eventFilesAPI = {
    getAll: async (eventId: Id | string): Promise<EventFileRef[]> => {
        const response = await apiFetch(`${API_BASE_URL}/event-files?eventId=${eventId}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<EventFileRef[]>(response);
    },

    getFolders: async (eventId: Id | string, includeDeleted = false): Promise<EventFolderRef[]> => {
        const response = await apiFetch(`${API_BASE_URL}/event-files/folders?eventId=${eventId}&includeDeleted=${includeDeleted}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<EventFolderRef[]>(response);
    },

    createFolder: async (eventId: Id | string, folderName: string, createdByMemberId: Id | string): Promise<EventFolderRef> => {
        const response = await apiFetch(`${API_BASE_URL}/event-files/folders`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ eventId, folderName, createdByMemberId }),
        });
        return handleResponse<EventFolderRef>(response);
    },

    removeFolder: async (folderId: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/event-files/folders/${folderId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },

    restoreFolder: async (folderId: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/event-files/folders/${folderId}/restore`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },

    getFolderHistory: async (folderId: Id | string): Promise<EventFileHistoryEntry[]> => {
        const response = await apiFetch(`${API_BASE_URL}/event-files/folders/${folderId}/history`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<EventFileHistoryEntry[]>(response);
    },

    renameFolder: async (folderId: Id | string, folderName: string): Promise<EventFolderRef> => {
        const response = await apiFetch(`${API_BASE_URL}/event-files/folders/${folderId}/rename`, {
            method: 'PATCH',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderName }),
        });
        return handleResponse<EventFolderRef>(response);
    },

    getDownloadUrl: (fileId: Id | string): string => {
        return `${API_BASE_URL}/event-files/${fileId}/download`;
    },

    download: async (fileId: Id | string, fileName: string): Promise<void> => {
        await downloadProtectedFile(`${API_BASE_URL}/event-files/${fileId}/download`, fileName);
    },

    upload: (
        eventId: Id | string,
        uploadedByMemberId: Id | string,
        file: File,
        onProgress?: (progress: number) => void,
        folderId: Id | string | null = null,
    ): Promise<EventFileRef> => {
        return new Promise<EventFileRef>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            const formData = new FormData();
            formData.append('file', file);
            formData.append('eventId', String(eventId));
            formData.append('uploadedByMemberId', String(uploadedByMemberId));
            if (folderId != null) formData.append('folderId', String(folderId));

            xhr.upload.onprogress = (e) => {
                if (e.lengthComputable && onProgress) {
                    onProgress(Math.round((e.loaded / e.total) * 100));
                }
            };

            xhr.onload = () => {
                try {
                    const data = JSON.parse(xhr.responseText);
                    if (xhr.status >= 200 && xhr.status < 300) {
                        resolve(data as EventFileRef);
                    } else {
                        reject(new Error(data.error || `Upload failed (${xhr.status})`));
                    }
                } catch {
                    reject(new Error('Failed to parse upload response'));
                }
            };

            xhr.onerror = () => reject(new Error('Network error during upload'));

            xhr.open('POST', `${API_BASE_URL}/event-files/upload`);
            const token = getAuthToken();
            if (token) {
                xhr.setRequestHeader('Authorization', `Bearer ${token}`);
            }
            xhr.withCredentials = true;
            xhr.send(formData);
        });
    },

    remove: async (fileId: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/event-files/${fileId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },

    getHistory: async (fileId: Id | string): Promise<EventFileHistoryEntry[]> => {
        const response = await apiFetch(`${API_BASE_URL}/event-files/${fileId}/history`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<EventFileHistoryEntry[]>(response);
    },

    getComments: async (fileId: Id | string): Promise<EventFileCommentRef[]> => {
        const response = await apiFetch(`${API_BASE_URL}/event-files/${fileId}/comments`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<EventFileCommentRef[]>(response);
    },

    addComment: async (fileId: Id | string, comment: string): Promise<EventFileCommentRef> => {
        const response = await apiFetch(`${API_BASE_URL}/event-files/${fileId}/comments`, {
            method: 'POST',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment }),
        });
        return handleResponse<EventFileCommentRef>(response);
    },

    editComment: async (fileId: Id | string, commentId: Id | string, comment: string): Promise<EventFileCommentRef> => {
        const response = await apiFetch(`${API_BASE_URL}/event-files/${fileId}/comments/${commentId}`, {
            method: 'PUT',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ comment }),
        });
        return handleResponse<EventFileCommentRef>(response);
    },

    deleteComment: async (fileId: Id | string, commentId: Id | string): Promise<{ success?: boolean; message?: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/event-files/${fileId}/comments/${commentId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse<{ success?: boolean; message?: string }>(response);
    },

    getVersionDownloadUrl: (fileId: Id | string, commitSha: string): string => {
        return `${API_BASE_URL}/event-files/${fileId}/version/${commitSha}`;
    },

    downloadVersion: async (fileId: Id | string, commitSha: string, fileName: string): Promise<void> => {
        await downloadProtectedFile(`${API_BASE_URL}/event-files/${fileId}/version/${commitSha}`, fileName);
    },

    rename: async (fileId: Id | string, fileName: string): Promise<EventFileRef> => {
        const response = await apiFetch(`${API_BASE_URL}/event-files/${fileId}/rename`, {
            method: 'PATCH',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ fileName }),
        });
        return handleResponse<EventFileRef>(response);
    },

    move: async (fileId: Id | string, folderId: Id | string | null = null): Promise<EventFileRef> => {
        const response = await apiFetch(`${API_BASE_URL}/event-files/${fileId}/move`, {
            method: 'PATCH',
            headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            body: JSON.stringify({ folderId }),
        });
        return handleResponse<EventFileRef>(response);
    },

    getDeleted: async (eventId: Id | string): Promise<EventFileRef[]> => {
        const response = await apiFetch(`${API_BASE_URL}/event-files/deleted?eventId=${eventId}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<EventFileRef[]>(response);
    },

    restore: async (fileId: Id | string): Promise<EventFileRef> => {
        const response = await apiFetch(`${API_BASE_URL}/event-files/${fileId}/restore`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        return handleResponse<EventFileRef>(response);
    },
};

// ============================================
// EVENTS API
// ============================================

export const eventsAPI = {
    getAll: async (filters: EventQueryParams = {}): Promise<EventSummary[]> => {
        const params = new URLSearchParams();
        if (filters.status) params.append('status', filters.status);
        if (filters.projectId) params.append('projectId', String(filters.projectId));
        if (filters.dateFrom) params.append('dateFrom', String(filters.dateFrom));
        if (filters.dateTo) params.append('dateTo', String(filters.dateTo));
        if (filters.scope) params.append('scope', filters.scope);
        if (filters.archived) params.append('archived', 'true');

        const response = await apiFetch(`${API_BASE_URL}/events${params.toString() ? `?${params.toString()}` : ''}`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<EventSummary[]>(response);
    },

    getById: async (id: Id | string): Promise<EventDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${id}`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<EventDetail>(response);
    },

    getActivity: async (id: Id | string): Promise<EventActivityEntry[]> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${id}/activity`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<EventActivityEntry[]>(response);
    },

    create: async (data: CreateEventPayload): Promise<EventDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/events`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<EventDetail>(response);
    },

    update: async (id: Id | string, data: UpdateEventPayload): Promise<EventDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<EventDetail>(response);
    },

    updateStatus: async (id: Id | string, status: EventQueryParams['status'] | 'DRAFT' | 'PUBLISHED' | 'COMPLETED' | 'CANCELLED'): Promise<EventDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${id}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status }),
        });

        return handleResponse<EventDetail>(response);
    },

    deactivate: async (id: Id | string): Promise<EventDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${id}/deactivate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });

        return handleResponse<EventDetail>(response);
    },

    reactivate: async (id: Id | string): Promise<EventDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${id}/reactivate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });

        return handleResponse<EventDetail>(response);
    },

    abort: async (id: Id | string): Promise<EventDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${id}/abort`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });

        return handleResponse<EventDetail>(response);
    },

    finalize: async (id: Id | string): Promise<EventDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${id}/finalize`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });

        return handleResponse<EventDetail>(response);
    },

    archive: async (id: Id | string): Promise<EventDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${id}/archive`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });

        return handleResponse<EventDetail>(response);
    },

    setDisclosed: async (id: Id | string, disclosed: boolean): Promise<EventDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${id}/disclose`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ disclosed }),
        });

        return handleResponse<EventDetail>(response);
    },

    setPublished: async (id: Id | string, published: boolean): Promise<EventDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${id}/publish`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ published }),
        });

        return handleResponse<EventDetail>(response);
    },

    remove: async (id: Id | string): Promise<EventDetail> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });

        return handleResponse<EventDetail>(response);
    },

    getTiers: async (eventId: Id | string): Promise<EventTierRef[]> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/tiers`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<EventTierRef[]>(response);
    },

    createTier: async (eventId: Id | string, data: CreateEventTierPayload): Promise<EventTierRef> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/tiers`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<EventTierRef>(response);
    },

    updateTier: async (eventId: Id | string, tierId: Id | string, data: UpdateEventTierPayload): Promise<EventTierRef> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/tiers/${tierId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<EventTierRef>(response);
    },

    removeTier: async (eventId: Id | string, tierId: Id | string): Promise<void> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/tiers/${tierId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            await handleResponse(response);
        }
    },

    getCustomFields: async (eventId: Id | string): Promise<EventCustomFieldRef[]> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/custom-fields`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<EventCustomFieldRef[]>(response);
    },

    createCustomField: async (eventId: Id | string, data: CreateEventCustomFieldPayload): Promise<EventCustomFieldRef> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/custom-fields`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<EventCustomFieldRef>(response);
    },

    updateCustomField: async (eventId: Id | string, fieldId: Id | string, data: UpdateEventCustomFieldPayload): Promise<EventCustomFieldRef> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/custom-fields/${fieldId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<EventCustomFieldRef>(response);
    },

    reorderCustomFields: async (eventId: Id | string, data: ReorderEventCustomFieldsPayload): Promise<EventCustomFieldRef[]> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/custom-fields/reorder`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<EventCustomFieldRef[]>(response);
    },

    removeCustomField: async (eventId: Id | string, fieldId: Id | string): Promise<void> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/custom-fields/${fieldId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            await handleResponse(response);
        }
    },

    getRegistrations: async (eventId: Id | string, filters: EventRegistrationQueryParams = {}): Promise<EventRegistrationRef[]> => {
        const params = new URLSearchParams();
        if (filters.tierId) params.append('tierId', String(filters.tierId));
        if (filters.checkInStatus) params.append('checkInStatus', filters.checkInStatus);
        if (filters.walkIn !== undefined) params.append('walkIn', String(filters.walkIn));
        if (filters.source) params.append('source', filters.source);
        if (filters.sourceGroup) params.append('sourceGroup', filters.sourceGroup);
        if (filters.ticketStatus) params.append('ticketStatus', filters.ticketStatus);
        if (filters.reminderStatus) params.append('reminderStatus', filters.reminderStatus);
        if (filters.eventDay) params.append('eventDay', filters.eventDay);

        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/registrations${params.toString() ? `?${params.toString()}` : ''}`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<EventRegistrationRef[]>(response);
    },

    getRegistration: async (eventId: Id | string, registrationId: Id | string): Promise<EventRegistrationRef> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/registrations/${registrationId}`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<EventRegistrationRef>(response);
    },

    lookupRegistrationByCode: async (eventId: Id | string, confirmationCode: string): Promise<EventRegistrationLookupResult> => {
        const params = new URLSearchParams({ confirmationCode: confirmationCode.trim().toUpperCase() });
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/registrations/lookup?${params.toString()}`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<EventRegistrationLookupResult>(response);
    },

    createRegistration: async (eventId: Id | string, data: CreateEventRegistrationPayload): Promise<EventRegistrationRef> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/registrations`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<EventRegistrationRef>(response);
    },

    createWalkInRegistration: async (eventId: Id | string, data: CreateEventRegistrationPayload): Promise<WalkInRegistrationResult> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/registrations/walk-in`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<WalkInRegistrationResult>(response);
    },

    importRegistrations: async (eventId: Id | string, payload: ImportRegistrationsPayload): Promise<ImportRegistrationsResult> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/registrations/import`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });

        return handleResponse<ImportRegistrationsResult>(response);
    },

    sendRegistrationTickets: async (
        eventId: Id | string,
        payload: SendRegistrationTicketsPayload,
    ): Promise<SendRegistrationTicketsResult> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/registrations/send-tickets`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });

        return handleResponse<SendRegistrationTicketsResult>(response);
    },

    sendRegistrationReminders: async (
        eventId: Id | string,
        payload: SendRegistrationRemindersPayload,
    ): Promise<SendRegistrationTicketsResult> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/registrations/send-reminders`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });

        return handleResponse<SendRegistrationTicketsResult>(response);
    },

    checkInRegistration: async (
        eventId: Id | string,
        registrationId: Id | string,
        payload: CheckInRegistrationPayload = {},
    ): Promise<EventRegistrationRef> => {
        const safeRegistrationId = String(registrationId || 'code');
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/registrations/${safeRegistrationId}/check-in`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });

        return handleResponse<EventRegistrationRef>(response);
    },

    removeRegistrationAttendance: async (
        eventId: Id | string,
        registrationId: Id | string,
        payload: RemoveRegistrationAttendancePayload,
    ): Promise<EventRegistrationRef> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/registrations/${registrationId}/attendance`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });

        return handleResponse<EventRegistrationRef>(response);
    },

    updateRegistration: async (eventId: Id | string, registrationId: Id | string, data: UpdateEventRegistrationPayload): Promise<EventRegistrationRef> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/registrations/${registrationId}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<EventRegistrationRef>(response);
    },

    cancelRegistration: async (eventId: Id | string, registrationId: Id | string): Promise<EventRegistrationRef> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/registrations/${registrationId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });

        return handleResponse<EventRegistrationRef>(response);
    },

    resendRegistrationTicket: async (eventId: Id | string, registrationId: Id | string): Promise<{ ok: boolean; message: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/registrations/${registrationId}/resend-ticket`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });

        return handleResponse<{ ok: boolean; message: string }>(response);
    },

    resendRegistrationReminder: async (eventId: Id | string, registrationId: Id | string): Promise<{ ok: boolean; message: string }> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/registrations/${registrationId}/resend-reminder`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });

        return handleResponse<{ ok: boolean; message: string }>(response);
    },

    getStatistics: async (eventId: Id | string): Promise<EventStatistics> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/statistics`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<EventStatistics>(response);
    },

    getAssignableMembers: async (eventId: Id | string): Promise<MemberSummary[]> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/assignable-members`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<MemberSummary[]>(response);
    },

    getTasks: async (eventId: Id | string): Promise<EventTaskRef[]> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/tasks`, {
            headers: getAuthHeaders(),
        });

        return handleResponse<EventTaskRef[]>(response);
    },

    createTask: async (eventId: Id | string, data: CreateEventTaskPayload): Promise<EventTaskRef> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/tasks`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<EventTaskRef>(response);
    },

    updateTask: async (eventId: Id | string, taskId: Id | string, data: UpdateEventTaskPayload): Promise<EventTaskRef> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/tasks/${taskId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });

        return handleResponse<EventTaskRef>(response);
    },

    removeTask: async (eventId: Id | string, taskId: Id | string): Promise<void> => {
        const response = await apiFetch(`${API_BASE_URL}/events/${eventId}/tasks/${taskId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });

        if (!response.ok) {
            await handleResponse(response);
        }
    },

    removeTaskAssignment: async (
        eventId: Id | string,
        taskId: Id | string,
        assignmentId: Id | string,
    ): Promise<void> => {
        const response = await apiFetch(
            `${API_BASE_URL}/events/${eventId}/tasks/${taskId}/assignments/${assignmentId}`,
            {
                method: 'DELETE',
                headers: getAuthHeaders(),
            },
        );

        if (!response.ok) {
            await handleResponse(response);
        }
    },
};

export const siteContentAPI = {
    getAbout: async () => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/about`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    updateAboutHeader: async (payload: { eyebrow: string; title: string; description: string }) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/about/header`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    },

    createAboutSection: async (payload: Record<string, unknown>) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/about/sections`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    },

    updateAboutSection: async (sectionId: number, payload: Record<string, unknown>) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/about/sections/${sectionId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    },

    deleteAboutSection: async (sectionId: number) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/about/sections/${sectionId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    reorderAboutSections: async (orderedIds: number[]) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/about/sections/reorder`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ orderedIds }),
        });
        return handleResponse(response);
    },

    createSponsor: async (sectionId: number, payload: Record<string, unknown>) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/about/sections/${sectionId}/sponsors`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    },

    updateSponsor: async (sectionId: number, sponsorId: number, payload: Record<string, unknown>) => {
        const response = await apiFetch(
            `${API_BASE_URL}/site-content/about/sections/${sectionId}/sponsors/${sponsorId}`,
            {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(payload),
            },
        );
        return handleResponse(response);
    },

    deleteSponsor: async (sectionId: number, sponsorId: number) => {
        const response = await apiFetch(
            `${API_BASE_URL}/site-content/about/sections/${sectionId}/sponsors/${sponsorId}`,
            {
                method: 'DELETE',
                headers: getAuthHeaders(),
            },
        );
        return handleResponse(response);
    },

    getContact: async () => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/contact`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    updateContactHeader: async (payload: { eyebrow: string; title: string; description: string }) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/contact/header`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    },

    createContactMethod: async (payload: Record<string, unknown>) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/contact/methods`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    },

    updateContactMethod: async (methodId: number, payload: Record<string, unknown>) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/contact/methods/${methodId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    },

    deleteContactMethod: async (methodId: number) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/contact/methods/${methodId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    reorderContactMethods: async (orderedIds: number[]) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/contact/methods/reorder`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ orderedIds }),
        });
        return handleResponse(response);
    },

    createSocialLink: async (payload: Record<string, unknown>) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/contact/social-links`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    },

    updateSocialLink: async (linkId: number, payload: Record<string, unknown>) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/contact/social-links/${linkId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    },

    deleteSocialLink: async (linkId: number) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/contact/social-links/${linkId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    reorderSocialLinks: async (orderedIds: number[]) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/contact/social-links/reorder`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ orderedIds }),
        });
        return handleResponse(response);
    },
};

export const supportContentAPI = {
    getSupport: async () => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/support`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    updateSupportHeader: async (payload: { eyebrow: string; title: string; description: string }) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/support/header`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    },

    createNotice: async (payload: { locale: string; content: string }) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/support/notices`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    },

    updateNotice: async (noticeId: number, payload: Record<string, unknown>) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/support/notices/${noticeId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    },

    deleteNotice: async (noticeId: number) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/support/notices/${noticeId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    reorderNotices: async (orderedIds: number[]) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/support/notices/reorder`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ orderedIds }),
        });
        return handleResponse(response);
    },

    createForm: async (payload: { label: string }) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/support/forms`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    },

    updateForm: async (formId: number, payload: Record<string, unknown>) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/support/forms/${formId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    },

    deleteForm: async (formId: number) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/support/forms/${formId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    reorderForms: async (orderedIds: number[]) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/support/forms/reorder`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ orderedIds }),
        });
        return handleResponse(response);
    },

    createFormField: async (formId: number, payload: Record<string, unknown>) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/support/forms/${formId}/fields`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    },

    updateFormField: async (formId: number, fieldId: number, payload: Record<string, unknown>) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/support/forms/${formId}/fields/${fieldId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    },

    deleteFormField: async (formId: number, fieldId: number) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/support/forms/${formId}/fields/${fieldId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    reorderFormFields: async (formId: number, order: Array<{ id: number; order: number }>) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/support/forms/${formId}/fields/reorder`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ order }),
        });
        return handleResponse(response);
    },

    getReports: async (params?: { limit?: number; offset?: number; formId?: number }) => {
        const search = new URLSearchParams();
        if (params?.limit != null) search.set('limit', String(params.limit));
        if (params?.offset != null) search.set('offset', String(params.offset));
        if (params?.formId != null) search.set('formId', String(params.formId));
        const query = search.toString();
        const response = await apiFetch(
            `${API_BASE_URL}/site-content/support/reports${query ? `?${query}` : ''}`,
            { headers: getAuthHeaders() },
        );
        return handleResponse(response);
    },

    getSubmissionCounts: async () => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/support/reports/counts`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response) as Promise<{ counts: Record<string, number> }>;
    },

    getFormReports: async (formId: number) => {
        const response = await apiFetch(
            `${API_BASE_URL}/site-content/support/forms/${formId}/reports`,
            { headers: getAuthHeaders() },
        );
        return handleResponse(response) as Promise<{ reports: import('@iclub/shared').IncidentReportDetail[]; total: number }>;
    },

    exportFormSubmissions: async (formId: number): Promise<void> => {
        const response = await apiFetch(
            `${API_BASE_URL}/site-content/support/forms/${formId}/reports/export`,
            { headers: getAuthHeaders() },
        );
        if (!response.ok) {
            await handleResponse(response);
            return;
        }
        const blob = await response.blob();
        const disposition = response.headers.get('Content-Disposition') ?? '';
        const match = disposition.match(/filename="?([^"]+)"?/i);
        const filename = match?.[1] ?? `form-${formId}-submissions.xlsx`;
        const { downloadBlob } = await import('@/utils/downloadBlob');
        downloadBlob(blob, filename);
    },

    getReport: async (reportId: number) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/support/reports/${reportId}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    submitIncidentReport: async (payload: {
        formId: number;
        name?: string;
        email: string;
        phone?: string;
        description: string;
        team?: string;
        fieldValues?: Record<string, unknown>;
    }) => {
        const response = await apiFetch(`${API_BASE_URL}/site-content/support/incident-reports`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    },

    getPublicSupportPage: async () => {
        const response = await apiFetch(`${API_BASE_URL}/public/site/support`);
        return handleResponse(response);
    },
};

export const financeAPI = {
    getDashboard: async () => {
        const response = await apiFetch(`${API_BASE_URL}/finance/dashboard`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<import('@iclub/shared').FinanceDashboardResponse>(response);
    },

    getAccounts: async () => {
        const response = await apiFetch(`${API_BASE_URL}/finance/accounts`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<import('@iclub/shared').FinanceAccountSummary[]>(response);
    },

    getTransactions: async (params: import('@iclub/shared').FinanceTransactionFilters = {}) => {
        const searchParams = new URLSearchParams();
        if (params.accountId != null) searchParams.set('accountId', String(params.accountId));
        if (params.type) searchParams.set('type', params.type);
        if (params.category) searchParams.set('category', params.category);
        if (params.search) searchParams.set('search', params.search);
        if (params.dateFrom) searchParams.set('dateFrom', params.dateFrom);
        if (params.dateTo) searchParams.set('dateTo', params.dateTo);
        if (params.page != null) searchParams.set('page', String(params.page));
        if (params.pageSize != null) searchParams.set('pageSize', String(params.pageSize));

        const query = searchParams.toString();
        const response = await apiFetch(
            `${API_BASE_URL}/finance/transactions${query ? `?${query}` : ''}`,
            { headers: getAuthHeaders() },
        );
        return handleResponse<import('@iclub/shared').FinanceTransactionListResponse>(response);
    },

    createAccount: async (payload: import('@iclub/shared').CreateFinanceAccountInput) => {
        const response = await apiFetch(`${API_BASE_URL}/finance/accounts`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse<import('@iclub/shared').FinanceAccountSummary>(response);
    },

    updateAccount: async (id: Id, payload: import('@iclub/shared').UpdateFinanceAccountInput) => {
        const response = await apiFetch(`${API_BASE_URL}/finance/accounts/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse<import('@iclub/shared').FinanceAccountSummary>(response);
    },

    createTransaction: async (payload: import('@iclub/shared').CreateFinanceTransactionInput) => {
        const response = await apiFetch(`${API_BASE_URL}/finance/transactions`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse<import('@iclub/shared').FinanceTransactionRow>(response);
    },

    updateTransaction: async (id: Id, payload: import('@iclub/shared').UpdateFinanceTransactionInput) => {
        const response = await apiFetch(`${API_BASE_URL}/finance/transactions/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse<import('@iclub/shared').FinanceTransactionRow>(response);
    },

    deleteTransaction: async (id: Id) => {
        const response = await apiFetch(`${API_BASE_URL}/finance/transactions/${id}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        if (!response.ok) {
            const error = (await response.json().catch(() => ({ error: 'An error occurred' }))) as ApiErrorResponse;
            throw new Error(error.error || `HTTP error! status: ${response.status}`);
        }
    },

    createLiability: async (payload: import('@iclub/shared').CreateFinanceLiabilityInput) => {
        const response = await apiFetch(`${API_BASE_URL}/finance/liabilities`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse<import('@iclub/shared').FinanceLiabilityRow>(response);
    },

    updateLiability: async (id: Id, payload: import('@iclub/shared').UpdateFinanceLiabilityInput) => {
        const response = await apiFetch(`${API_BASE_URL}/finance/liabilities/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse<import('@iclub/shared').FinanceLiabilityRow>(response);
    },

    createScheduledItem: async (payload: import('@iclub/shared').CreateFinanceScheduledItemInput) => {
        const response = await apiFetch(`${API_BASE_URL}/finance/scheduled-items`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse<import('@iclub/shared').FinanceScheduledItemRow>(response);
    },

    updateScheduledItem: async (id: Id, payload: import('@iclub/shared').UpdateFinanceScheduledItemInput) => {
        const response = await apiFetch(`${API_BASE_URL}/finance/scheduled-items/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(payload),
        });
        return handleResponse<import('@iclub/shared').FinanceScheduledItemRow>(response);
    },

    exportData: async () => {
        const response = await apiFetch(`${API_BASE_URL}/finance/export`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<import('@iclub/shared').FinanceExportResponse>(response);
    },
};
