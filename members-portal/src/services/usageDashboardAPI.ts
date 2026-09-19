import type { Id } from '../types/backend-contracts';
import { API_BASE_URL, apiFetch, getAuthHeaders, handleResponse } from './api';

export type UsageDashboardSummary = {
    windowDays: number;
    since: string;
    until: string;
    counts: {
        eventsCreated: number;
        certificatesIssued: number;
        checkInsScanned: number;
        registrationsCreated: number;
        dataExports: number;
        logins: number;
        activeMembers: number;
    };
};

export type UsageDashboardSummaryParams =
    | { days: number }
    | { from: string; to: string };

export type UsageDateRangeParams = {
    from: string;
    to: string;
};

export type UsageEventsOrgSummary = {
    eventsCreated: number;
    eventTasks: number;
    eventTaskAssignments: number;
    tasksPerEvent: number;
    peopleWorked: number;
    totalAssignmentHours: number;
    totalEventDurationHours: number;
    registrations: number;
    ticketsSent: number;
    remindersSent: number;
    certificatesIssued: number;
    sessions: number;
    filesUploaded: number;
    photosUploaded: number;
    checkIns: number;
};

export type UsageEventListItem = {
    id: Id;
    title: string;
    venue: string | null;
    eventDate: string;
    eventEndDate: string | null;
    status: string;
    registrations: number;
    sessions: number;
    ticketsSent: number;
    remindersSent: number;
    certificatesIssued: number;
    files: number;
    photos: number;
    peopleWorked: number;
    assignmentHours: number;
    tasks: number;
};

export type UsageEventsListResponse = {
    windowDays: number;
    since: string;
    until: string;
    summary: UsageEventsOrgSummary;
    events: UsageEventListItem[];
};

export type UsageEventSessionSummary = {
    id: Id;
    label: string | null;
    sessionDate: string;
    startDateTime: string | null;
    endDateTime: string | null;
    mode: string;
    maxCapacity: number | null;
};

export type UsageEventDetailResponse = {
    windowDays: number;
    since: string;
    until: string;
    event: {
        id: Id;
        title: string;
        venue: string | null;
        status: string;
        eventDate: string;
        eventEndDate: string;
        createdAt: string;
        capacity: number | null;
    };
    metrics: {
        durationHours: number;
        sessions: number;
        registrations: number;
        walkInRegistrations: number;
        cancelledRegistrations: number;
        capacityFillPercent: number | null;
        ticketsSent: number;
        remindersSent: number;
        certificatesIssued: number;
        certificateEmailsSent: number;
        files: number;
        photos: number;
        eventTasks: number;
        eventTaskAssignments: number;
        assignmentHours: number;
        peopleWorked: number;
        checkIns: number;
        sessionAttendanceSegments: number;
        sessionAttendanceDwellMinutes: number | null;
    };
    sessions: UsageEventSessionSummary[];
    registrationStatusBreakdown: Record<string, number>;
};

export type UsageProjectsOrgSummary = {
    projectsCreated: number;
    tasks: number;
    subtasks: number;
    phases: number;
    peopleWorked: number;
    totalPlannedDurationDays: number;
    files: number;
    photos: number;
    certificates: number;
};

export type UsageProjectListItem = {
    id: Id;
    title: string;
    status: string;
    startDate: string | null;
    dueDate: string | null;
    completedDate: string | null;
    tasks: number;
    subtasks: number;
    phases: number;
    peopleWorked: number;
    files: number;
    photos: number;
};

export type UsageProjectsListResponse = {
    windowDays: number;
    since: string;
    until: string;
    summary: UsageProjectsOrgSummary;
    projects: UsageProjectListItem[];
};

export type UsageProjectDetailResponse = {
    windowDays: number;
    since: string;
    until: string;
    project: {
        id: Id;
        title: string;
        status: string;
        startDate: string | null;
        dueDate: string | null;
        completedDate: string | null;
        createdAt: string;
        createdBy: { id: Id; fullName: string };
    };
    metrics: {
        tasks: number;
        subtasks: number;
        phases: number;
        peopleWorked: number;
        files: number;
        photos: number;
        certificates: number;
        taskCompletionRate: number | null;
        assignmentCompletionRate: number | null;
        scheduleSlotHours: number;
        estimatedHours: number;
        actualHours: number;
    };
};

export type UsageAnnouncementTargetType = 'NONE' | 'EVENT' | 'PROJECT';

export type UsageAnnouncementsOrgSummary = {
    announcementsCreated: number;
    totalResponses: number;
    availableCount: number;
    unavailableCount: number;
    avgResponsesPerAnnouncement: number;
};

export type UsageAnnouncementListItem = {
    id: Id;
    title: string;
    createdAt: string;
    isPinned: boolean;
    isActive: boolean;
    targetType: UsageAnnouncementTargetType;
    eventId: Id | null;
    projectId: Id | null;
    eventTitle: string | null;
    projectTitle: string | null;
    responseCount: number;
    availableCount: number;
    unavailableCount: number;
    createdByMemberId: Id;
    createdByName: string;
};

export type UsageAnnouncementsListResponse = {
    windowDays: number;
    since: string;
    until: string;
    summary: UsageAnnouncementsOrgSummary;
    announcements: UsageAnnouncementListItem[];
};

export type UsageAnnouncementDetailResponse = {
    windowDays: number;
    since: string;
    until: string;
    announcement: {
        id: Id;
        title: string;
        bodyPreview: string;
        createdAt: string;
        isPinned: boolean;
        isActive: boolean;
        targetType: UsageAnnouncementTargetType;
        eventId: Id | null;
        projectId: Id | null;
        eventTitle: string | null;
        projectTitle: string | null;
        createdByMemberId: Id;
        createdByName: string;
    };
    metrics: {
        responseCount: number;
        availableCount: number;
        unavailableCount: number;
        availablePercent: number | null;
        periodsCount: number;
    };
    statusBreakdown: Record<string, number>;
};

function buildFromToQuery(params: UsageDateRangeParams): string {
    const searchParams = new URLSearchParams();
    searchParams.set('from', params.from);
    searchParams.set('to', params.to);
    return searchParams.toString();
}

function buildSummaryQuery(params?: UsageDashboardSummaryParams): string {
    const searchParams = new URLSearchParams();
    if (params && 'from' in params) {
        searchParams.set('from', params.from);
        searchParams.set('to', params.to);
    } else if (params && 'days' in params) {
        searchParams.set('days', String(params.days));
    }
    return searchParams.toString();
}

export const usageDashboardAPI = {
    getSummary: async (params?: UsageDashboardSummaryParams) => {
        const query = buildSummaryQuery(params);
        const response = await apiFetch(
            `${API_BASE_URL}/usage-dashboard/summary${query ? `?${query}` : ''}`,
            { headers: getAuthHeaders() },
        );
        return handleResponse<UsageDashboardSummary>(response);
    },

    getEvents: async (params: UsageDateRangeParams): Promise<UsageEventsListResponse> => {
        const query = buildFromToQuery(params);
        const response = await apiFetch(`${API_BASE_URL}/usage-dashboard/events?${query}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<UsageEventsListResponse>(response);
    },

    getEvent: async (
        eventId: Id | string,
        params: UsageDateRangeParams,
    ): Promise<UsageEventDetailResponse> => {
        const query = buildFromToQuery(params);
        const response = await apiFetch(
            `${API_BASE_URL}/usage-dashboard/events/${encodeURIComponent(String(eventId))}?${query}`,
            { headers: getAuthHeaders() },
        );
        return handleResponse<UsageEventDetailResponse>(response);
    },

    getProjects: async (params: UsageDateRangeParams): Promise<UsageProjectsListResponse> => {
        const query = buildFromToQuery(params);
        const response = await apiFetch(`${API_BASE_URL}/usage-dashboard/projects?${query}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<UsageProjectsListResponse>(response);
    },

    getProject: async (
        projectId: Id | string,
        params: UsageDateRangeParams,
    ): Promise<UsageProjectDetailResponse> => {
        const query = buildFromToQuery(params);
        const response = await apiFetch(
            `${API_BASE_URL}/usage-dashboard/projects/${encodeURIComponent(String(projectId))}?${query}`,
            { headers: getAuthHeaders() },
        );
        return handleResponse<UsageProjectDetailResponse>(response);
    },

    getAnnouncements: async (
        params: UsageDateRangeParams,
    ): Promise<UsageAnnouncementsListResponse> => {
        const query = buildFromToQuery(params);
        const response = await apiFetch(
            `${API_BASE_URL}/usage-dashboard/announcements?${query}`,
            { headers: getAuthHeaders() },
        );
        return handleResponse<UsageAnnouncementsListResponse>(response);
    },

    getAnnouncement: async (
        announcementId: Id | string,
        params: UsageDateRangeParams,
    ): Promise<UsageAnnouncementDetailResponse> => {
        const query = buildFromToQuery(params);
        const response = await apiFetch(
            `${API_BASE_URL}/usage-dashboard/announcements/${encodeURIComponent(String(announcementId))}?${query}`,
            { headers: getAuthHeaders() },
        );
        return handleResponse<UsageAnnouncementDetailResponse>(response);
    },
};
