import type { Id, ISODateTime, MemberSummary } from "./member";
import type { TeamRef } from "./team";

export type Priority = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export type TaskStatus =
    | "NOT_STARTED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "DELAYED"
    | "BLOCKED"
    | "ON_HOLD"
    | "CANCELLED";

export type TaskAssignmentStatus = "ASSIGNED" | "ACCEPTED" | "IN_PROGRESS" | "COMPLETED";

export interface TaskDependencyRef {
    taskId: Id;
    dependsOnTaskId: Id;
    dependencyType?: string;
}

export interface TaskTeamRef {
    id?: Id;
    taskId?: Id;
    teamId: Id;
    canEdit?: boolean;
    team?: TeamRef;
}

export interface TaskTagRef {
    id: Id;
    taskId: Id;
    tagType?: string;
    tagName: string;
}

export interface TaskAssignmentRef {
    id?: Id;
    taskId: Id;
    memberId: Id;
    status?: TaskAssignmentStatus;
    assignedBy?: Id;
    isSelfAssigned?: boolean;
    member?: MemberSummary;
}

export interface TaskCommentRef {
    id: Id;
    taskId: Id;
    memberId: Id;
    comment: string;
    isEdited?: boolean;
    createdAt?: ISODateTime;
    updatedAt?: ISODateTime;
    member?: MemberSummary;
}

export interface TaskActivityEntry {
    id: Id;
    taskId: Id;
    memberId: Id;
    actionType?: string;
    oldValue?: string | null;
    newValue?: string | null;
    description?: string | null;
    createdAt?: ISODateTime;
    member?: MemberSummary;
}

export interface ScheduleSlot {
    id: Id;
    projectId: Id;
    taskId?: Id | null;
    memberId: Id;
    createdByMemberId?: Id;
    title?: string | null;
    notes?: string | null;
    startDateTime: ISODateTime;
    endDateTime: ISODateTime;
    isActive?: boolean;
    member?: MemberSummary;
}

export interface TaskSummary {
    id: Id;
    projectId: Id;
    phaseId?: Id | null;
    parentTaskId?: Id | null;
    title: string;
    description?: string | null;
    status: TaskStatus;
    priority?: Priority;
    difficulty?: Difficulty;
    type?: string;
    order?: number;
    startDate?: ISODateTime | null;
    dueDate?: ISODateTime | null;
    completedDate?: ISODateTime | null;
    estimatedHours?: number | null;
    actualHours?: number | null;
    assignments?: Array<{
        memberId: Id;
        status?: TaskAssignmentStatus;
        member?: MemberSummary;
    }>;
    subtasks?: TaskSummary[];
    dependencies?: TaskDependencyRef[];
    dependsOn?: TaskDependencyRef[];
    scheduleSlots?: ScheduleSlot[];
}

export interface Task {
    id: Id;
    projectId: Id;
    parentTaskId: Id | null;
    phaseId: Id | null;
    type: string;
    title: string;
    description: string | null;
    status: TaskStatus;
    difficulty: Difficulty;
    priority: Priority;
    order: number;
    wbs: string;
    startDate: ISODateTime | null;
    dueDate: ISODateTime | null;
    completedDate: ISODateTime | null;
    baselineStartDate: ISODateTime | null;
    baselineDueDate: ISODateTime | null;
    estimatedHours: number | null;
    actualHours: number | null;
    isActive: boolean;
    createdAt: ISODateTime;
    updatedAt: ISODateTime;
}

export interface CreateTaskPayload {
    projectId: Id;
    parentTaskId?: Id | null;
    phaseId?: Id | null;
    title: string;
    description?: string | null;
    type?: string;
    priority?: Priority;
    status?: TaskStatus;
    difficulty?: Difficulty;
    startDate?: ISODateTime | null;
    dueDate?: ISODateTime | null;
    estimatedHours?: number | null;
    teamIds?: Id[];
    assigneeIds?: Id[];
}

export interface UpdateTaskPayload {
    title?: string;
    description?: string | null;
    type?: string;
    priority?: Priority;
    status?: TaskStatus;
    difficulty?: Difficulty;
    startDate?: ISODateTime | null;
    dueDate?: ISODateTime | null;
    completedDate?: ISODateTime | null;
    estimatedHours?: number | null;
    actualHours?: number | null;
    phaseId?: Id | null;
    parentTaskId?: Id | null;
    order?: number;
    assigneeIds?: Id[];
}

export interface TaskQueryParams {
    projectId?: Id | string;
    memberId?: Id | string;
    status?: TaskStatus;
    priority?: Priority;
    overdue?: boolean;
    topLevelOnly?: boolean;
}

export interface AddTaskTagPayload {
    tagType?: string;
    tagName: string;
}

export interface AddDependencyPayload {
    dependsOnTaskId: Id;
    dependencyType?: string;
}

export interface AssignTaskMemberInput {
    memberId: Id;
}

export interface UpdateTaskAssignmentStatusInput {
    status: TaskAssignmentStatus;
}

export interface CreateTaskCommentInput {
    comment: string;
}

export interface UpdateTaskCommentInput {
    comment: string;
}
