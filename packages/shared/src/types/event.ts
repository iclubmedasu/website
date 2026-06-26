import type { Id, ISODateTime, MemberSummary } from "./member";
import type { ProjectStatus, ProjectTypeRef } from "./project";
import type { Priority } from "./task";
import type { TeamRef } from "./team";

export type EventStatus = ProjectStatus | "DRAFT" | "PUBLISHED" | "COMPLETED" | "CANCELLED";

export type EventRegistrationStatus = "REGISTERED" | "CHECKED_IN" | "CANCELLED";

export type EventRegistrationSource = "PORTAL" | "PUBLIC" | "IMPORT" | "WALK_IN";

export type EventCustomFieldType = "text" | "dropdown" | "checkbox" | "number";

export interface EventProjectRef {
    id: Id;
    title: string;
    status?: string | null;
}

export interface EventTeamRef {
    eventId?: Id;
    teamId: Id;
    canEdit?: boolean;
    isOwner?: boolean;
    team?: TeamRef;
}

export type EventTierCurrency = 'USD' | 'EUR' | 'EGP';

export interface EventTierRef {
    id: Id;
    eventId: Id;
    name: string;
    description?: string | null;
    maxCapacity?: number | null;
    price?: number | null;
    currency?: EventTierCurrency | string;
    order?: number;
    isActive?: boolean;
    showOnPublic?: boolean;
    registrationCount?: number;
    _count?: {
        registrations: number;
    };
}

export interface EventCustomFieldRef {
    id: Id;
    eventId: Id;
    label: string;
    type: EventCustomFieldType | string;
    options?: unknown;
    required?: boolean;
    showOnPublic?: boolean;
    order?: number;
    isLocked?: boolean;
    isActive?: boolean;
}

export interface EventAttendanceDayRef {
    eventDay: string;
    checkedInAt: ISODateTime;
}

export type EventSessionMode = "ONSITE" | "ONLINE";

export interface EventSessionRef {
    id: Id;
    eventId: Id;
    label: string | null;
    sessionDate: string;
    startTime: string | null;
    endTime: string | null;
    mode: EventSessionMode;
    onlineUrl: string | null;
    order: number;
    isActive: boolean;
    createdAt: ISODateTime;
    updatedAt: ISODateTime;
    _count?: { attendances: number };
}

export interface EventSessionSelectionRef {
    sessionId: Id;
    label?: string | null;
    sessionDate: string;
    startTime?: string | null;
    endTime?: string | null;
    mode?: EventSessionMode | string;
}

export interface EventSessionAttendanceRef {
    id: Id;
    sessionId: Id;
    registrationId: Id;
    mode: "ONSITE" | "ONLINE";
    joinedAt: ISODateTime;
}

export interface CreateEventSessionPayload {
    label?: string | null;
    sessionDate: string;
    startTime?: string | null;
    endTime?: string | null;
    mode: EventSessionMode;
    onlineUrl?: string | null;
    order?: number;
}

export type UpdateEventSessionPayload = Partial<CreateEventSessionPayload>;

export interface EventRegistrationRef {
    id: Id;
    eventId: Id;
    tierId?: Id | null;
    memberId?: Id | null;
    fullName: string;
    email: string;
    phoneNumber?: string | null;
    confirmationCode: string;
    source?: EventRegistrationSource | string;
    status: EventRegistrationStatus | string;
    isWalkIn?: boolean;
    checkedInAt?: ISODateTime | null;
    cancelledAt?: ISODateTime | null;
    notes?: string | null;
    customFieldValues?: Record<string, unknown> | null;
    ticketEmailSentAt?: ISODateTime | null;
    reminderEmailSentAt?: ISODateTime | null;
    createdAt?: ISODateTime;
    updatedAt?: ISODateTime;
    version?: number;
    tier?: EventTierRef | null;
    member?: MemberSummary | null;
    attendanceDays?: EventAttendanceDayRef[];
    sessionAttendances?: EventSessionAttendanceRef[];
    sessionSelections?: EventSessionSelectionRef[];
}

export interface EventSummary {
    id: Id;
    title: string;
    description?: string | null;
    venue?: string | null;
    eventDate: ISODateTime;
    eventEndDate: ISODateTime;
    registrationDeadline?: ISODateTime | null;
    capacity?: number | null;
    allowWalkIns?: boolean;
    isCertifiable?: boolean;
    status: EventStatus;
    priority?: Priority | string;
    progressStatus?: ProjectStatus | string;
    projectTypeId?: Id | null;
    projectType?: ProjectTypeRef | null;
    isActive?: boolean;
    isFinalized?: boolean;
    isArchived?: boolean;
    isPublished?: boolean;
    isDisclosed?: boolean;
    tierFieldShowOnPublic?: boolean;
    tierFieldRequired?: boolean;
    sessionFieldShowOnPublic?: boolean;
    sessionFieldRequired?: boolean;
    deletedAt?: ISODateTime | null;
    createdAt?: ISODateTime;
    updatedAt?: ISODateTime;
    projectId?: Id | null;
    project?: EventProjectRef | null;
    eventTeams?: EventTeamRef[];
    createdByMemberId?: Id;
    createdBy?: MemberSummary;
    tiers?: EventTierRef[];
    customFields?: EventCustomFieldRef[];
    registrationCount?: number;
    _count?: {
        registrations: number;
    };
}

export interface EventDetail extends EventSummary {
    registrations?: EventRegistrationRef[];
}

export interface EventActivityEntry {
    id: Id;
    eventId: Id;
    eventTaskId?: Id | null;
    memberId?: Id | null;
    entityType?: string;
    actionType?: string;
    oldValue?: string | null;
    newValue?: string | null;
    description?: string | null;
    createdAt?: ISODateTime;
    member?: MemberSummary | null;
    eventTask?: { id: Id; title: string } | null;
}

export interface EventQueryParams {
    status?: EventStatus;
    projectId?: Id | string;
    dateFrom?: ISODateTime | string;
    dateTo?: ISODateTime | string;
    scope?: "all" | "mine" | "published";
    archived?: boolean;
}

export interface EventStatistics {
    eventId: Id;
    capacity?: number | null;
    totalRegistered: number;
    totalCheckedIn: number;
    walkInCount: number;
    noShowCount: number;
    byTier: Array<{
        tierId: Id;
        name: string;
        registrations: number;
    }>;
    registrationsOverTime: Array<{
        date: string;
        count: number;
    }>;
    attendanceOverTime: Array<{
        date: string;
        count: number;
    }>;
    sessionAttendance?: Array<{
        id: Id;
        label: string | null;
        sessionDate: string;
        mode: EventSessionMode;
        attendances: number;
    }>;
}

export interface CreateEventPayload {
    title: string;
    description?: string | null;
    venue?: string | null;
    eventDate: ISODateTime | string;
    eventEndDate?: ISODateTime | string;
    registrationDeadline?: ISODateTime | string | null;
    capacity?: number | null;
    projectId?: Id | string | null;
    projectTypeId?: Id | string;
    priority?: Priority | string;
    progressStatus?: ProjectStatus | string;
    teamIds?: Array<{ teamId: Id | string; canEdit?: boolean; isOwner?: boolean }>;
    allowWalkIns?: boolean;
    isCertifiable?: boolean;
    status?: EventStatus;
}

export interface UpdateEventPayload extends Partial<CreateEventPayload> {
    status?: EventStatus;
}

export interface CreateEventTierPayload {
    name: string;
    description?: string | null;
    maxCapacity?: number | null;
    price?: number | null;
    currency?: EventTierCurrency | string;
    order?: number;
}

export interface UpdateEventTierPayload extends Partial<CreateEventTierPayload> {
    isActive?: boolean;
    showOnPublic?: boolean;
}

export interface CreateEventCustomFieldPayload {
    label: string;
    type: EventCustomFieldType | string;
    options?: unknown;
    required?: boolean;
    showOnPublic?: boolean;
    order?: number;
    isLocked?: boolean;
}

export interface UpdateEventCustomFieldPayload extends Partial<CreateEventCustomFieldPayload> {
    isActive?: boolean;
}

export interface ReorderEventCustomFieldsPayload {
    order: Array<{ id: Id | string; order?: number } | Id | string>;
}

export interface UpdateEventRegistrationColumnsPayload {
    tierFieldShowOnPublic?: boolean;
    tierFieldRequired?: boolean;
    sessionFieldShowOnPublic?: boolean;
    sessionFieldRequired?: boolean;
}

export interface CreateEventRegistrationPayload {
    tierId?: Id | string | null;
    sessionIds?: Array<Id | string>;
    fullName: string;
    email: string;
    phoneNumber?: string | null;
    notes?: string | null;
    customFieldValues?: Record<string, unknown> | unknown;
    isWalkIn?: boolean;
    memberId?: Id | string | null;
}

export interface UpdateEventRegistrationPayload {
    fullName?: string;
    email?: string;
    phoneNumber?: string | null;
    tierId?: Id | string | null;
    notes?: string | null;
    customFieldValues?: Record<string, unknown> | unknown;
    version?: number;
}

export interface UpdateRegistrationSessionsPayload {
    sessionIds: Array<Id | string>;
}

export interface WalkInRegistrationResult extends EventRegistrationRef {
    action?: 'created' | 'checked_in_existing';
}

export type RegistrationImportStandardField =
    | 'fullName'
    | 'email'
    | 'phoneNumber'
    | 'tier'
    | 'notes';

export interface RegistrationImportNewFieldSpec {
    excelColumn: string;
    label: string;
    type: EventCustomFieldType;
    options?: string[];
    required?: boolean;
}

export interface RegistrationImportColumnMapping {
    fullName: string | null;
    email: string | null;
    phoneNumber: string | null;
    tier: string | null;
    notes: string | null;
    customFields: Record<string, string | null>;
}

export interface RegistrationImportRow {
    fullName: string;
    email?: string;
    phoneNumber?: string | null;
    tierName?: string | null;
    notes?: string | null;
    customFieldValues?: Record<string, unknown>;
}

export interface ImportRegistrationsPayload {
    newCustomFields?: RegistrationImportNewFieldSpec[];
    rows: RegistrationImportRow[];
}

export interface ImportRegistrationsResult {
    created: number;
    updated: number;
    skipped: number;
    errors: Array<{ row: number; email?: string; message: string }>;
    createdRegistrationIds: number[];
}

export interface SendRegistrationTicketsPayload {
    registrationIds: number[];
}

export interface SendRegistrationRemindersPayload {
    registrationIds: number[];
}

export interface SendRegistrationTicketsResult {
    sent: number;
    skipped: number;
    failed: number;
    errors: Array<{ registrationId: number; message: string }>;
}

export type EventRegistrationSourceGroup = "PRE_REGISTERED" | "WALK_IN" | "IMPORT";

export interface EventRegistrationQueryParams {
    tierId?: Id | string;
    checkInStatus?: "CHECKED_IN" | "NOT_CHECKED_IN" | "CHECKED_IN_TODAY";
    walkIn?: boolean;
    source?: EventRegistrationSource;
    sourceGroup?: EventRegistrationSourceGroup;
    ticketStatus?: "SENT" | "NOT_SENT";
    reminderStatus?: "SENT" | "NOT_SENT";
    eventDay?: string;
}

export interface CheckInRegistrationPayload {
    confirmationCode?: string;
    eventDay?: string;
    customFieldValues?: Record<string, unknown> | unknown;
}

export interface RemoveRegistrationAttendancePayload {
    eventDay: string;
}

export interface EventRegistrationLookupResult {
    registration: EventRegistrationRef;
    missingRequiredFields: EventCustomFieldRef[];
    eventDay: string;
    checkedInToday: boolean;
}

export interface EventTaskAssignmentRef {
    id: Id;
    eventTaskId: Id;
    memberId: Id;
    startDateTime: ISODateTime;
    endDateTime: ISODateTime;
    createdAt?: ISODateTime;
    updatedAt?: ISODateTime;
    member?: MemberSummary | null;
}

export interface EventTaskRef {
    id: Id;
    eventId: Id;
    leaderId?: Id | null;
    createdByMemberId?: Id | null;
    title: string;
    description?: string | null;
    location: string;
    taskDate: ISODateTime;
    isActive?: boolean;
    createdAt?: ISODateTime;
    updatedAt?: ISODateTime;
    leader?: MemberSummary | null;
    createdBy?: MemberSummary | null;
    assignments?: EventTaskAssignmentRef[];
}

export interface EventTaskAssignmentInput {
    memberId: Id | string;
    startDateTime: ISODateTime | string;
    endDateTime: ISODateTime | string;
}

export interface CreateEventTaskPayload {
    title: string;
    description?: string | null;
    location: string;
    taskDate: ISODateTime | string;
    leaderId?: Id | string | null;
    assignments?: EventTaskAssignmentInput[];
}

export interface UpdateEventTaskPayload extends Partial<CreateEventTaskPayload> {}

export interface EventFolderRef {
    id: Id;
    folderName: string;
    githubPath: string;
    isActive?: boolean;
}

export interface EventFileRef {
    id: Id;
    eventId: Id;
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
    folder?: EventFolderRef;
}

export interface EventFileCommentRef {
    id: Id;
    fileId: Id;
    memberId: Id;
    comment: string;
    isEdited?: boolean;
    createdAt?: ISODateTime;
    updatedAt?: ISODateTime;
    member?: MemberSummary;
}

export interface EventFileHistoryEntry {
    sha: string;
    message: string;
    date: ISODateTime;
    author: string;
}

export interface CreateEventFolderPayload {
    eventId: Id;
    folderName: string;
    createdByMemberId?: Id;
}

export interface RenameEventFolderPayload {
    folderName: string;
}

export interface MoveEventFilePayload {
    folderId?: Id | null;
}

export interface RenameEventFilePayload {
    fileName: string;
}