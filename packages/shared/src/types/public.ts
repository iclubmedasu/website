import type { Id, ISODateTime } from "./member";
import type { EventCustomFieldType } from "./event";

export interface PublicEventTypeRef {
    name: string;
}

export interface PublicEventSummary {
    id: Id;
    title: string;
    description?: string | null;
    eventDate: ISODateTime;
    eventEndDate: ISODateTime;
    venue?: string | null;
    registrationDeadline?: ISODateTime | null;
    projectType?: PublicEventTypeRef | null;
}

export interface PublicEventCapacityFields {
    capacity?: number | null;
    registeredCount: number;
    spotsRemaining: number | null;
    registrationOpen: boolean;
}

export interface PublicEventListItem extends PublicEventSummary, PublicEventCapacityFields {}

export interface PublicEventDetail extends PublicEventListItem {}

export interface PublicEventTier {
    id: Id;
    name: string;
    description?: string | null;
    price?: number | null;
    currency?: string | null;
    maxCapacity?: number | null;
    registeredCount: number;
    spotsRemaining: number | null;
    isActive: boolean;
    showOnPublic?: boolean;
}

export interface PublicEventCustomField {
    id: Id;
    label: string;
    type: EventCustomFieldType | string;
    options?: unknown;
    required?: boolean;
    order?: number;
}

export interface PublicRegistrationConfirmation {
    confirmationCode: string;
    fullName: string;
    email: string;
    event: {
        id: Id;
        title: string;
        eventDate: ISODateTime;
        eventEndDate: ISODateTime;
        venue?: string | null;
    };
    tier: { name: string } | null;
}

export interface PublicProjectTag {
    tagName: string;
}

export interface PublicProjectTypeRef {
    name: string;
    category?: string | null;
}

export interface PublicProjectSummary {
    id: Id;
    title: string;
    description?: string | null;
    completedDate?: ISODateTime | null;
    projectType?: PublicProjectTypeRef | null;
    tags?: PublicProjectTag[];
}

export interface PublicProjectDetail extends PublicProjectSummary {}

export interface PublicContactRequest {
    name: string;
    email: string;
    subject: string;
    message: string;
    website?: string;
}

export interface PublicContactResponse {
    success: boolean;
}
