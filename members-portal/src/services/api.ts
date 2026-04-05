import type {
    AddDependencyPayload,
    AddTaskTagPayload,
    ApiErrorResponse,
    CreatePhasePayload,
    CreateProjectPayload,
    CreateScheduleSlotPayload,
    CreateTaskPayload,
    Id,
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
    UpdateProjectPayload,
    UpdateScheduleSlotPayload,
    UpdateTaskPayload,
} from "../types/backend-contracts";

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

type ApiNamespace = Record<string, (...args: any[]) => any>;
type JsonHeaders = Record<string, string>;

const apiFetch = (input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> => {
    return globalThis.fetch(input, {
        ...init,
        credentials: 'include',
    });
};

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
        const error = (await response.json().catch(() => ({ error: 'An error occurred' }))) as ApiErrorResponse;
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
        const response = await apiFetch(`${API_BASE_URL}/projects/${id}`, { headers: getAuthHeaders() });
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
