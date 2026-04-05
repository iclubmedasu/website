export type Id = number;
export type ISODateTime = string;

export type MemberAssignmentStatus = "UNASSIGNED" | "ASSIGNED" | "ALUMNI";

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
}

export interface MemberSummary {
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

export interface UpdateMemberInput {
    fullName?: string;
    phoneNumber?: string;
    phoneNumber2?: string | null;
    profilePhotoUrl?: string | null;
    linkedInUrl?: string | null;
    email2?: string | null;
    email3?: string | null;
    isActive?: boolean;
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
