// API Base URL - Update this based on your environment
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Helper function to get auth headers
const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    const headers = {
        'Content-Type': 'application/json',
    };
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
};

// Helper function to handle API responses
const handleResponse = async (response) => {
    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'An error occurred' }));
        throw new Error(error.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
};

// ============================================
// TEAMS API
// ============================================

export const teamsAPI = {
    // Get all teams. scope='all' returns every team (for Members/Alumni); no scope returns only user's teams for non-admins.
    getAll: async (isActive, scope) => {
        const params = new URLSearchParams();
        if (isActive !== undefined) params.append('isActive', isActive);
        if (scope === 'all') params.append('scope', 'all');
        const qs = params.toString();
        const url = qs ? `${API_BASE_URL}/teams?${qs}` : `${API_BASE_URL}/teams`;

        const response = await fetch(url, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Get single team by ID
    getById: async (id) => {
        const response = await fetch(`${API_BASE_URL}/teams/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Create new team
    create: async (teamData) => {
        const response = await fetch(`${API_BASE_URL}/teams`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(teamData),
        });
        return handleResponse(response);
    },

    // Update team
    update: async (id, teamData) => {
        const response = await fetch(`${API_BASE_URL}/teams/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(teamData),
        });
        return handleResponse(response);
    },

    // Deactivate team
    deactivate: async (id) => {
        const response = await fetch(`${API_BASE_URL}/teams/${id}/deactivate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Activate team
    activate: async (id) => {
        const response = await fetch(`${API_BASE_URL}/teams/${id}/activate`, {
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

export const teamRolesAPI = {
    // Get all roles (optionally filter by team)
    getAll: async (teamId, isActive) => {
        let url = `${API_BASE_URL}/team-roles`;
        const params = new URLSearchParams();

        if (teamId) params.append('teamId', teamId);
        if (isActive !== undefined) params.append('isActive', isActive);

        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Get single role
    getById: async (id) => {
        const response = await fetch(`${API_BASE_URL}/team-roles/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Create new role
    create: async (roleData) => {
        const response = await fetch(`${API_BASE_URL}/team-roles`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(roleData),
        });
        return handleResponse(response);
    },

    // Update role
    update: async (id, roleData) => {
        const response = await fetch(`${API_BASE_URL}/team-roles/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(roleData),
        });
        return handleResponse(response);
    },

    // Deactivate role (no permanent delete)
    deactivate: async (id) => {
        const response = await fetch(`${API_BASE_URL}/team-roles/${id}/deactivate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Activate role
    activate: async (id) => {
        const response = await fetch(`${API_BASE_URL}/team-roles/${id}/activate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },
};

// ============================================
// TEAM SUBTEAMS API
// ============================================

export const teamSubteamsAPI = {
    getAll: async (teamId, isActive) => {
        let url = `${API_BASE_URL}/team-subteams`;
        const params = new URLSearchParams();
        if (teamId) params.append('teamId', teamId);
        if (isActive !== undefined) params.append('isActive', isActive);
        if (params.toString()) url += `?${params.toString()}`;
        const response = await fetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    getById: async (id) => {
        const response = await fetch(`${API_BASE_URL}/team-subteams/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    create: async (data) => {
        const response = await fetch(`${API_BASE_URL}/team-subteams`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    update: async (id, data) => {
        const response = await fetch(`${API_BASE_URL}/team-subteams/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    // Deactivate subteam (no permanent delete)
    deactivate: async (id) => {
        const response = await fetch(`${API_BASE_URL}/team-subteams/${id}/deactivate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Activate subteam
    activate: async (id) => {
        const response = await fetch(`${API_BASE_URL}/team-subteams/${id}/activate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },
};

// ============================================
// TEAM MEMBERS API
// ============================================

export const teamMembersAPI = {
    // Get all team member assignments
    getAll: async (teamId, memberId, isActive) => {
        let url = `${API_BASE_URL}/team-members`;
        const params = new URLSearchParams();

        if (teamId) params.append('teamId', teamId);
        if (memberId) params.append('memberId', memberId);
        if (isActive !== undefined) params.append('isActive', isActive);

        if (params.toString()) url += `?${params.toString()}`;

        const response = await fetch(url, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Get single assignment
    getById: async (id) => {
        const response = await fetch(`${API_BASE_URL}/team-members/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Assign member to team
    assign: async (assignmentData) => {
        const response = await fetch(`${API_BASE_URL}/team-members/assign`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(assignmentData),
        });
        return handleResponse(response);
    },

    // Change member's role
    changeRole: async (id, roleChangeData) => {
        const response = await fetch(`${API_BASE_URL}/team-members/${id}/change-role`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(roleChangeData),
        });
        return handleResponse(response);
    },

    // Transfer member to different team
    transfer: async (id, transferData) => {
        const response = await fetch(`${API_BASE_URL}/team-members/${id}/transfer`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(transferData),
        });
        return handleResponse(response);
    },

    // Update assignment status only (active/inactive)
    updateStatus: async (id, statusData) => {
        const response = await fetch(`${API_BASE_URL}/team-members/${id}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(statusData),
        });
        return handleResponse(response);
    },

    // Remove member from team
    remove: async (id, removalData) => {
        const response = await fetch(`${API_BASE_URL}/team-members/${id}/remove`, {
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

export const alumniAPI = {
    getAll: async (teamId) => {
        let url = `${API_BASE_URL}/alumni`;
        if (teamId) url += `?teamId=${teamId}`;
        const response = await fetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
    },
};

// ============================================
// ADMINISTRATION API (Administration team: Officer, President, Vice President)
// ============================================

export const administrationAPI = {
    // Get the Administration team with roles and members (get-or-create with Officer, President, Vice President)
    getTeam: async () => {
        const response = await fetch(`${API_BASE_URL}/administration/team`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },
};

// ============================================
// MEMBERS API
// ============================================

export const membersAPI = {
    // Get all members
    getAll: async (isActive, unassignedOnly) => {
        const params = new URLSearchParams();
        if (isActive !== undefined) params.append('isActive', isActive);
        if (unassignedOnly) params.append('unassignedOnly', 'true');
        const url = params.toString() ? `${API_BASE_URL}/members?${params.toString()}` : `${API_BASE_URL}/members`;

        const response = await fetch(url, {
            headers: getAuthHeaders(),
            ...(unassignedOnly && { cache: 'no-store' }),
        });
        return handleResponse(response);
    },

    // Get single member
    getById: async (id) => {
        const response = await fetch(`${API_BASE_URL}/members/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Create new member
    create: async (memberData) => {
        const response = await fetch(`${API_BASE_URL}/members`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(memberData),
        });
        return handleResponse(response);
    },

    // Update member
    update: async (id, memberData) => {
        const response = await fetch(`${API_BASE_URL}/members/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(memberData),
        });
        return handleResponse(response);
    },

    // Deactivate member (no permanent delete)
    deactivate: async (id) => {
        const response = await fetch(`${API_BASE_URL}/members/${id}/deactivate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    // Reactivate member
    activate: async (id) => {
        const response = await fetch(`${API_BASE_URL}/members/${id}/activate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },
};

// ============================================
// PROJECT TYPES API
// ============================================

export const projectTypesAPI = {
    getAll: async () => {
        const response = await fetch(`${API_BASE_URL}/projects/types`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },
};

// ============================================
// PROJECTS API
// ============================================

export const projectsAPI = {
    getAll: async ({ status, priority, teamId, createdByMe, isActive } = {}) => {
        const params = new URLSearchParams();
        if (status) params.append('status', status);
        if (priority) params.append('priority', priority);
        if (teamId) params.append('teamId', teamId);
        if (createdByMe) params.append('createdByMe', 'true');
        if (isActive !== undefined) params.append('isActive', isActive);
        const qs = params.toString();
        const url = qs ? `${API_BASE_URL}/projects?${qs}` : `${API_BASE_URL}/projects`;
        const response = await fetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    getById: async (id) => {
        const response = await fetch(`${API_BASE_URL}/projects/${id}`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    create: async (data) => {
        const response = await fetch(`${API_BASE_URL}/projects`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    update: async (id, data) => {
        const response = await fetch(`${API_BASE_URL}/projects/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    deactivate: async (id) => {
        const response = await fetch(`${API_BASE_URL}/projects/${id}/deactivate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    activate: async (id) => {
        const response = await fetch(`${API_BASE_URL}/projects/${id}/activate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    addTeam: async (projectId, teamData) => {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/teams`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(teamData),
        });
        return handleResponse(response);
    },

    updateTeam: async (projectId, teamId, data) => {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/teams/${teamId}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    removeTeam: async (projectId, teamId) => {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/teams/${teamId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    addTag: async (projectId, tagName) => {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/tags`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ tagName }),
        });
        return handleResponse(response);
    },

    removeTag: async (projectId, tagId) => {
        const response = await fetch(`${API_BASE_URL}/projects/${projectId}/tags/${tagId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },
};

// ============================================
// TASKS API
// ============================================

export const tasksAPI = {
    getAll: async ({ projectId, memberId, status, priority, overdue, topLevelOnly } = {}) => {
        const params = new URLSearchParams();
        if (projectId) params.append('projectId', projectId);
        if (memberId) params.append('memberId', memberId);
        if (status) params.append('status', status);
        if (priority) params.append('priority', priority);
        if (overdue) params.append('overdue', 'true');
        if (topLevelOnly) params.append('topLevelOnly', 'true');
        const qs = params.toString();
        const url = qs ? `${API_BASE_URL}/tasks?${qs}` : `${API_BASE_URL}/tasks`;
        const response = await fetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    getById: async (id) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${id}`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    create: async (data) => {
        const response = await fetch(`${API_BASE_URL}/tasks`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    update: async (id, data) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${id}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data),
        });
        return handleResponse(response);
    },

    updateStatus: async (id, status) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${id}/status`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status }),
        });
        return handleResponse(response);
    },

    deactivate: async (id) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${id}/deactivate`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    addTeam: async (taskId, teamData) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/teams`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(teamData),
        });
        return handleResponse(response);
    },

    removeTeam: async (taskId, teamId) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/teams/${teamId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    assignMember: async (taskId, memberId) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/assign`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ memberId }),
        });
        return handleResponse(response);
    },

    selfAssign: async (taskId) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/self-assign`, {
            method: 'POST',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    updateAssignment: async (taskId, memberId, status) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/assign/${memberId}`, {
            method: 'PATCH',
            headers: getAuthHeaders(),
            body: JSON.stringify({ status }),
        });
        return handleResponse(response);
    },

    unassignMember: async (taskId, memberId) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/assign/${memberId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    getComments: async (taskId) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/comments`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    addComment: async (taskId, comment) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/comments`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ comment }),
        });
        return handleResponse(response);
    },

    editComment: async (taskId, commentId, comment) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/comments/${commentId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({ comment }),
        });
        return handleResponse(response);
    },

    deleteComment: async (taskId, commentId) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/comments/${commentId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    getActivity: async (taskId) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/activity`, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    addTag: async (taskId, tagType, tagName) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/tags`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ tagType, tagName }),
        });
        return handleResponse(response);
    },

    removeTag: async (taskId, tagId) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/tags/${tagId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    addDependency: async (taskId, dependsOnTaskId, dependencyType) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/dependencies`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ dependsOnTaskId, dependencyType }),
        });
        return handleResponse(response);
    },

    removeDependency: async (taskId, dependsOnTaskId) => {
        const response = await fetch(`${API_BASE_URL}/tasks/${taskId}/dependencies/${dependsOnTaskId}`, {
            method: 'DELETE',
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },
};

// ============================================
// ROLE HISTORY API
// ============================================

export const roleHistoryAPI = {
    getMemberHistory: async (memberId) => {
        const response = await fetch(`${API_BASE_URL}/role-history/member/${memberId}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },

    getMemberTimeline: async (memberId) => {
        const response = await fetch(`${API_BASE_URL}/role-history/member/${memberId}/timeline`, {
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
        const response = await fetch(url, { headers: getAuthHeaders() });
        return handleResponse(response);
    },

    getById: async (id) => {
        const response = await fetch(`${API_BASE_URL}/role-history/${id}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse(response);
    },
};