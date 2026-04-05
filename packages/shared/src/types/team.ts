import type { Id, ISODateTime, MemberSummary } from "./member";

export type TeamRoleType =
    | "Leadership"
    | "Regular"
    | "Officer"
    | "President"
    | "Vice President"
    | (string & {});

export interface TeamRef {
    id: Id;
    name: string;
    isActive?: boolean;
}

export interface Team {
    id: Id;
    name: string;
    isActive: boolean;
    establishedDate: ISODateTime;
    createdAt: ISODateTime;
    updatedAt: ISODateTime;
}

export interface TeamRoleRef {
    id: Id;
    roleName: string;
    roleType?: TeamRoleType;
    maxCount?: number | null;
    systemRoleKey?: number | null;
    isActive?: boolean;
}

export interface TeamRole {
    id: Id;
    teamId: Id;
    roleName: string;
    roleType: TeamRoleType;
    maxCount: number | null;
    systemRoleKey: number | null;
    isActive: boolean;
    createdAt: ISODateTime;
    updatedAt: ISODateTime;
}

export interface Subteam {
    id: Id;
    teamId: Id;
    name: string;
    description: string | null;
    isActive: boolean;
    createdAt: ISODateTime;
    updatedAt: ISODateTime;
}

export interface TeamMemberRef {
    id?: Id;
    teamId: Id;
    memberId: Id;
    roleId?: Id;
    subteamId?: Id | null;
    isActive?: boolean;
    team?: TeamRef;
    role?: TeamRoleRef;
    member?: MemberSummary;
}

export interface TeamMember {
    id: Id;
    teamId: Id;
    memberId: Id;
    roleId: Id;
    subteamId: Id | null;
    joinedDate: ISODateTime;
    leftDate: ISODateTime | null;
    isActive: boolean;
    createdAt: ISODateTime;
    updatedAt: ISODateTime;
}

export interface TeamRefWithMembers extends TeamRef {
    members?: TeamMemberRef[];
    roles?: TeamRoleRef[];
}

export interface CreateTeamInput {
    name: string;
    establishedDate?: ISODateTime;
}

export interface UpdateTeamInput {
    name?: string;
    establishedDate?: ISODateTime;
    isActive?: boolean;
}

export interface CreateTeamRoleInput {
    teamId: Id;
    roleName: string;
    roleType?: TeamRoleType;
    maxCount?: number | null;
}

export interface UpdateTeamRoleInput {
    roleName?: string;
    roleType?: TeamRoleType;
    maxCount?: number | null;
    isActive?: boolean;
}

export interface CreateSubteamInput {
    teamId: Id;
    name: string;
    description?: string | null;
}

export interface UpdateSubteamInput {
    name?: string;
    description?: string | null;
    isActive?: boolean;
}

export interface AssignMemberToTeamInput {
    memberId: Id;
    teamId: Id;
    roleId: Id;
    changeType?: string;
    changeReason?: string;
    notes?: string;
}

export interface ChangeTeamMemberRoleInput {
    newRoleId: Id;
    newSubteamId?: Id | null;
    changeType?: string;
    changeReason?: string;
    notes?: string;
}

export interface TransferTeamMemberInput {
    newTeamId: Id;
    newRoleId: Id;
    newSubteamId?: Id | null;
    changeType?: string;
    changeReason?: string;
    notes?: string;
}

export interface UpdateTeamMemberStatusInput {
    isActive: boolean;
    changeType?: string;
    changeReason?: string;
    notes?: string;
}
