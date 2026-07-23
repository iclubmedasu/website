export type DashboardTaskUrgency = 'OVERDUE' | 'DUE_SOON' | 'DUE_THIS_WEEK' | 'LATER';
export type DashboardTaskKind = 'PROJECT_TASK' | 'EVENT_TASK';

export interface DashboardMyTaskItem {
  id: string;
  kind: DashboardTaskKind;
  title: string;
  dueDate: string | null;
  parentTitle: string;
  parentId: number;
  parentType: 'project' | 'event';
  urgency: DashboardTaskUrgency;
}

export interface DashboardMyTasksResponse {
  items: DashboardMyTaskItem[];
  totalCount: number;
  overdueCount: number;
}

export type DashboardActivityKind = 'event' | 'project';

export interface DashboardMyActivityItem {
  kind: DashboardActivityKind;
  id: number;
  title: string;
  date: string | null;
  endDate?: string | null;
  hrefMeta?: { slug?: string };
  venue?: string | null;
  viaRegistration: boolean;
  viaTaskAssignment: boolean;
  viaCreated: boolean;
  viaTeam: boolean;
}

export interface DashboardMyActivitiesResponse {
  items: DashboardMyActivityItem[];
  totalCount: number;
}
