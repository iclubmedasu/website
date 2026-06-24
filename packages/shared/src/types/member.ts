export type Id = number;
export type ISODateTime = string;

export type MemberAssignmentStatus = "UNASSIGNED" | "ASSIGNED" | "ALUMNI";

export interface MemberContactVisibility {
    showPhoneNumber: boolean;
    showPhoneNumber2: boolean;
    showEmail2: boolean;
    showEmail3: boolean;
    showStudentId: boolean;
}

export interface Member {
    id: Id;
    fullName: string;
    email: string;
    email2: string | null;
    email3: string | null;
    phoneNumber: string;
    phoneNumber2: string | null;
    studentId: number | null;
    profilePhotoUrl: string | null;
    linkedInUrl: string | null;
    isActive: boolean;
    assignmentStatus: MemberAssignmentStatus;
    joinDate: ISODateTime;
    createdAt: ISODateTime;
    updatedAt: ISODateTime;
    showPhoneNumber: boolean;
    showPhoneNumber2: boolean;
    showEmail2: boolean;
    showEmail3: boolean;
    showStudentId: boolean;
}

export interface MemberSummary extends Partial<MemberContactVisibility> {
    id: Id;
    fullName: string;
    email: string;
    email2?: string | null;
    email3?: string | null;
    phoneNumber?: string | null;
    phoneNumber2?: string | null;
    studentId?: number | null;
    profilePhotoUrl?: string | null;
    linkedInUrl?: string | null;
    isActive?: boolean;
    assignmentStatus?: MemberAssignmentStatus;
}

export interface MemberRoleFlags {
    isDeveloper?: boolean;
    isOfficer?: boolean;
    isAdmin?: boolean;
    isLeadership?: boolean;
    isSpecial?: boolean;
}

export interface CreateMemberInput {
    studentId: number;
    fullName?: string;
    phoneNumber?: string;
    phoneNumber2?: string | null;
    profilePhotoUrl?: string | null;
    linkedInUrl?: string | null;
    joinDate?: ISODateTime;
    email2?: string | null;
    email3?: string | null;
}

export interface UpdateMemberInput extends Partial<MemberContactVisibility> {
    fullName?: string;
    phoneNumber?: string;
    phoneNumber2?: string | null;
    profilePhotoUrl?: string | null;
    linkedInUrl?: string | null;
    email2?: string | null;
    email3?: string | null;
    isActive?: boolean;
}

export interface MemberRoleHistoryTimelineEntry {
    id: Id;
    memberName?: string;
    teamName: string;
    roleName: string;
    subteamName?: string | null;
    changeType: string;
    changeReason?: string | null;
    notes?: string | null;
    period: {
        start: ISODateTime;
        end?: ISODateTime | null;
        duration?: number | "Ongoing" | null;
    };
    isActive?: boolean;
}

export interface MemberPublicProfile {
    id: Id;
    fullName: string;
    email: string;
    email2?: string | null;
    email3?: string | null;
    phoneNumber?: string | null;
    phoneNumber2?: string | null;
    studentId?: number | null;
    profilePhotoUrl?: string | null;
    linkedInUrl?: string | null;
    joinDate: ISODateTime;
    roleHistory: MemberRoleHistoryTimelineEntry[];
}

export interface MemberLeaveInput {
    leaveType: "Graduation" | "Resignation" | "Expulsion" | "Retirement";
    changeReason?: string | null;
    notes?: string | null;
}

export interface MemberQueryParams {
    isActive?: boolean;
    unassignedOnly?: boolean;
}

export interface MemberProfilePhotoResponse {
    profilePhotoUrl: string | null;
}
