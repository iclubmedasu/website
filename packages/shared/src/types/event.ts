import type { Id, ISODateTime, MemberSummary } from "./member";

export type EventStatus = "DRAFT" | "PUBLISHED" | "COMPLETED" | "CANCELLED";

export type EventRegistrationStatus = "REGISTERED" | "CHECKED_IN" | "CANCELLED";

export type EventRegistrationSource = "PORTAL" | "PUBLIC" | "IMPORT" | "WALK_IN";

export type EventCustomFieldType = "text" | "dropdown" | "checkbox" | "number";

export interface EventProjectRef {
    id: Id;
    title: string;
    status?: string | null;
}

export interface EventTierRef {
    id: Id;
    eventId: Id;
    name: string;
    description?: string | null;
    maxCapacity?: number | null;
    price?: number | null;
    order?: number;
    isActive?: boolean;
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
    order?: number;
    isLocked?: boolean;
    isActive?: boolean;
}

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
    createdAt?: ISODateTime;
    updatedAt?: ISODateTime;
    tier?: EventTierRef | null;
    member?: MemberSummary | null;
}

export interface EventSummary {
    id: Id;
    title: string;
    description?: string | null;
    venue?: string | null;
    eventDate: ISODateTime;
    registrationDeadline?: ISODateTime | null;
    capacity?: number | null;
    allowWalkIns?: boolean;
    isCertifiable?: boolean;
    status: EventStatus;
    isActive?: boolean;
    deletedAt?: ISODateTime | null;
    projectId?: Id | null;
    project?: EventProjectRef | null;
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

export interface EventQueryParams {
    status?: EventStatus;
    projectId?: Id | string;
    dateFrom?: ISODateTime | string;
    dateTo?: ISODateTime | string;
    scope?: "all" | "mine" | "published";
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
}

export interface CreateEventPayload {
    title: string;
    description?: string | null;
    venue?: string | null;
    eventDate: ISODateTime | string;
    registrationDeadline?: ISODateTime | string | null;
    capacity?: number | null;
    projectId?: Id | string | null;
    allowWalkIns?: boolean;
    isCertifiable?: boolean;
}

export interface UpdateEventPayload extends Partial<CreateEventPayload> {
    status?: EventStatus;
}

export interface CreateEventTierPayload {
    name: string;
    description?: string | null;
    maxCapacity?: number | null;
    price?: number | null;
    order?: number;
}

export interface UpdateEventTierPayload extends Partial<CreateEventTierPayload> {
    isActive?: boolean;
}

export interface CreateEventCustomFieldPayload {
    label: string;
    type: EventCustomFieldType | string;
    options?: unknown;
    required?: boolean;
    order?: number;
    isLocked?: boolean;
}

export interface UpdateEventCustomFieldPayload extends Partial<CreateEventCustomFieldPayload> {
    isActive?: boolean;
}

export interface ReorderEventCustomFieldsPayload {
    order: Array<{ id: Id | string; order?: number } | Id | string>;
}

export interface CreateEventRegistrationPayload {
    tierId?: Id | string | null;
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
}

export interface EventRegistrationQueryParams {
    tierId?: Id | string;
    checkInStatus?: "CHECKED_IN" | "NOT_CHECKED_IN";
    walkIn?: boolean;
}