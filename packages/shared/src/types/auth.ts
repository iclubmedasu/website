import type { Id, MemberRoleFlags, MemberSummary } from "./member";

export interface ApiErrorResponse {
    error: string;
    code?: string;
    needsSetup?: boolean;
    message?: string;
}

export interface AuthUser extends MemberSummary, MemberRoleFlags {
    userId?: Id;
    teamIds: Id[];
    leadershipTeamIds?: Id[];
}

export interface AuthTokenResponse {
    token: string;
    user: AuthUser;
}

export interface AuthMeResponse {
    user: AuthUser;
}

export interface AlumniAccessResponse {
    error: string;
    code: "ALUMNI_ACCESS";
}

export interface CheckEmailResponse {
    exists: boolean;
    needsSetup: boolean;
    isDeveloper?: boolean;
    email?: string;
    studentId?: number | null;
    fullName?: string | null;
    phoneNumber?: string | null;
    phoneNumber2?: string | null;
    email2?: string | null;
    email3?: string | null;
    message?: string;
}

export interface CheckStudentIdResponse {
    canSetup: boolean;
    message?: string;
}

export interface CheckEmailInput {
    email: string;
}

export interface CheckStudentIdInput {
    studentId: string | number;
}

export interface SetupPasswordInput {
    email: string;
    password: string;
}

export interface LoginInput {
    email: string;
    password: string;
}

export interface CompleteProfileInput {
    studentId: string | number;
    fullName: string;
    phoneNumber: string;
    phoneNumber2?: string;
    password?: string;
    email2?: string;
    email3?: string;
}

export interface CompleteOfficerProfileInput {
    identifier: string;
    fullName: string;
    phoneNumber: string;
    phoneNumber2?: string;
    email2?: string;
    email3?: string;
    password?: string;
    confirmPassword?: string;
    officerEmail?: string;
}

export interface UpdateInvitedProfileInput {
    email: string;
    fullName: string;
    phoneNumber: string;
    phoneNumber2?: string;
    email2?: string;
    email3?: string;
}

export interface ChangePasswordInput {
    currentPassword: string;
    newPassword: string;
    confirmPassword: string;
}
