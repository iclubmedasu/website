import type { Id } from '../types/backend-contracts';
import { API_BASE_URL, apiFetch, getAuthHeaders, handleResponse } from './api';

export type KpiDateRangeParams = {
    startDate: string;
    endDate: string;
};

export type EmployeeKpiProjectMetrics = {
    assignedCount: number;
    completedCount: number;
    overdueCount: number;
    completionRate: number;
    avgCompletionDays: number | null;
};

export type EmployeeKpiEventMetrics = {
    assignedCount: number;
};

export type EmployeeKpiListItem = {
    memberId: Id;
    fullName: string;
    profilePhotoUrl: string | null;
    projectTasks: EmployeeKpiProjectMetrics;
    eventTasks: EmployeeKpiEventMetrics;
};

export type EmployeeKpiOrgSummary = {
    totalMembers: number;
    totalProjectTasksAssigned: number;
    totalProjectTasksCompleted: number;
    totalEventTaskAssignments: number;
};

export type EmployeeKpisListResponse = {
    summary: EmployeeKpiOrgSummary;
    employees: EmployeeKpiListItem[];
};

export type EmployeeKpiProjectTaskRow = {
    assignmentId: number;
    taskId: number;
    title: string;
    status: string;
    dueDate: string | null;
    completedDate: string | null;
    assignedDate: string;
    project: { id: number; title: string };
};

export type EmployeeKpiEventTaskRow = {
    assignmentId: number;
    eventTaskId: number;
    title: string;
    taskDate: string;
    startDateTime: string;
    endDateTime: string;
    event: { id: number; title: string };
};

export type EmployeeKpiDetailResponse = {
    memberId: Id;
    fullName: string;
    profilePhotoUrl: string | null;
    projectTasks: EmployeeKpiProjectMetrics & {
        tasks: EmployeeKpiProjectTaskRow[];
    };
    eventTasks: EmployeeKpiEventMetrics & {
        tasks: EmployeeKpiEventTaskRow[];
    };
};

function buildRangeQuery(params: KpiDateRangeParams): string {
    const searchParams = new URLSearchParams();
    searchParams.set('startDate', params.startDate);
    searchParams.set('endDate', params.endDate);
    return searchParams.toString();
}

export const kpisAPI = {
    getEmployees: async (params: KpiDateRangeParams): Promise<EmployeeKpisListResponse> => {
        const query = buildRangeQuery(params);
        const response = await apiFetch(`${API_BASE_URL}/kpis/employees?${query}`, {
            headers: getAuthHeaders(),
        });
        return handleResponse<EmployeeKpisListResponse>(response);
    },

    getEmployee: async (
        memberId: Id | string,
        params: KpiDateRangeParams,
    ): Promise<EmployeeKpiDetailResponse> => {
        const query = buildRangeQuery(params);
        const response = await apiFetch(
            `${API_BASE_URL}/kpis/employees/${encodeURIComponent(String(memberId))}?${query}`,
            { headers: getAuthHeaders() },
        );
        return handleResponse<EmployeeKpiDetailResponse>(response);
    },
};
