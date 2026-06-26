import type { Id, ISODateTime, MemberPublicProfile } from "./member";
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

export interface PublicEventSession {
    id: Id;
    label?: string | null;
    sessionDate: string;
    startTime?: string | null;
    endTime?: string | null;
    mode: string;
}

export interface PublicEventRegistrationFormConfig {
    tierFieldShowOnPublic: boolean;
    tierFieldRequired: boolean;
    sessionFieldShowOnPublic: boolean;
    sessionFieldRequired: boolean;
}

export interface PublicConfirmationSession {
    id: Id;
    label: string | null;
    sessionDate: string;
    startTime?: string | null;
    endTime?: string | null;
    mode: string;
    joinUrl?: string | null;
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
    sessions: PublicConfirmationSession[];
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

export interface PublicMemberCard {
    id: Id;
    fullName: string;
    roleLabel: string;
    teamId?: Id | null;
    teamName?: string | null;
    profilePhotoUrl?: string | null;
}

export interface PublicMemberFilterTeam {
    id: Id;
    name: string;
}

export interface PublicTeamLeadershipRow {
    teamId: Id;
    teamName: string;
    head: PublicMemberCard | null;
    vice: PublicMemberCard | null;
}

export interface PublicMemberDirectory {
    officer: PublicMemberCard | null;
    president: PublicMemberCard | null;
    vicePresident: PublicMemberCard | null;
    teamLeadership: PublicTeamLeadershipRow[];
    filterTeams: PublicMemberFilterTeam[];
    members: PublicMemberCard[];
}

export type PublicMemberProfile = MemberPublicProfile;

export type {
    AboutSectionType,
    ContactMethodType,
    SocialPlatform,
    SitePageHeader,
    PublicAboutPage,
    PublicAboutSection,
    PublicAboutTwoColumnSection,
    PublicAboutBulletListSection,
    PublicAboutSponsorsSection,
    PublicAboutSponsor,
    PublicContactPage,
    PublicContactMethod,
    PublicSocialLink,
} from "./siteContent";
