import type { Id, ISODateTime, MemberSummary } from "./member";
import type { PhaseSummary } from "./phase";
import type { Priority, ScheduleSlot, TaskSummary } from "./task";
import type { TeamRef } from "./team";

export type ProjectStatus =
    | "NOT_STARTED"
    | "IN_PROGRESS"
    | "COMPLETED"
    | "ON_HOLD"
    | "CANCELLED";

export interface ProjectTypeRef {
    id: Id;
    name: string;
    category?: string | null;
    description?: string | null;
    icon?: string | null;
}

export interface ProjectTag {
    id: Id;
    tagName: string;
}

export interface ProjectTeamRef {
    projectId?: Id;
    teamId: Id;
    canEdit?: boolean;
    isOwner?: boolean;
    team?: TeamRef;
}

export interface ProjectSummary {
    id: Id;
    title: string;
    description?: string | null;
    status: ProjectStatus;
    priority?: Priority;
    projectTypeId?: Id;
    projectType?: ProjectTypeRef;
    startDate?: ISODateTime | null;
    dueDate?: ISODateTime | null;
    isActive?: boolean;
    isFinalized?: boolean;
    isArchived?: boolean;
    projectTeams?: ProjectTeamRef[];
    tags?: ProjectTag[];
}

export interface ProjectDetail extends ProjectSummary {
    createdByMemberId?: Id;
    completedDate?: ISODateTime | null;
    phases?: PhaseSummary[];
    tasks?: TaskSummary[];
    scheduleSlots?: ScheduleSlot[];
}

export interface ProjectActivityEntry {
    id: Id;
    projectId: Id;
    taskId?: Id | null;
    phaseId?: Id | null;
    memberId: Id;
    entityType?: string;
    actionType?: string;
    oldValue?: string | null;
    newValue?: string | null;
    description?: string | null;
    createdAt?: ISODateTime;
    member?: MemberSummary;
}

export interface ProjectQueryParams {
    status?: ProjectStatus;
    priority?: Priority;
    teamId?: Id;
    createdByMe?: boolean;
    isActive?: boolean;
    archived?: boolean;
}

export interface CreateProjectPayload {
    title: string;
    description?: string | null;
    projectTypeId: Id;
    priority?: Priority;
    status?: ProjectStatus;
    startDate?: ISODateTime | null;
    dueDate?: ISODateTime | null;
    teamIds: Array<{
        teamId: Id;
        canEdit?: boolean;
        isOwner?: boolean;
    }>;
}

export interface UpdateProjectPayload {
    title?: string;
    description?: string | null;
    projectTypeId?: Id;
    priority?: Priority;
    status?: ProjectStatus;
    startDate?: ISODateTime | null;
    dueDate?: ISODateTime | null;
    completedDate?: ISODateTime | null;
    isActive?: boolean;
    isFinalized?: boolean;
    isArchived?: boolean;
}

export interface AddProjectTagPayload {
    tagName: string;
}

export interface CreateScheduleSlotPayload {
    projectId?: Id;
    taskId?: Id;
    memberId: Id;
    title?: string | null;
    notes?: string | null;
    startDateTime: ISODateTime;
    endDateTime: ISODateTime;
}

export interface UpdateScheduleSlotPayload {
    title?: string | null;
    notes?: string | null;
    memberId?: Id;
    taskId?: Id | null;
    startDateTime?: ISODateTime;
    endDateTime?: ISODateTime;
    isActive?: boolean;
}

export interface ProjectFolderRef {
    id: Id;
    folderName: string;
    githubPath: string;
    isActive?: boolean;
}

export interface ProjectFileRef {
    id: Id;
    projectId: Id;
    folderId?: Id | null;
    uploadedByMemberId: Id;
    fileName: string;
    githubPath: string;
    githubSha: string;
    fileSize: number;
    mimeType: string;
    isActive?: boolean;
    createdAt?: ISODateTime;
    updatedAt?: ISODateTime;
    uploadedBy?: MemberSummary;
    folder?: ProjectFolderRef;
}

export interface ProjectFileCommentRef {
    id: Id;
    fileId: Id;
    memberId: Id;
    comment: string;
    isEdited?: boolean;
    createdAt?: ISODateTime;
    updatedAt?: ISODateTime;
    member?: MemberSummary;
}

export interface ProjectFileHistoryEntry {
    sha: string;
    message: string;
    date: ISODateTime;
    author: string;
}

export interface CreateFolderPayload {
    projectId: Id;
    folderName: string;
    createdByMemberId?: Id;
}

export interface RenameFolderPayload {
    folderName: string;
}

export interface MoveFilePayload {
    folderId?: Id | null;
}

export interface RenameFilePayload {
    fileName: string;
}

export interface ScheduleSlotQueryParams {
    projectId?: Id | string;
    taskId?: Id | string;
    memberId?: Id | string;
    includeInactive?: boolean;
}
