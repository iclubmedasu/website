const PLACEHOLDER_PHONE_PREFIX = 'pending-';

export function isPlaceholderPhone(value: unknown): boolean {
    return typeof value === 'string' && value.startsWith(PLACEHOLDER_PHONE_PREFIX);
}

export interface MemberProfileSource {
    id: number;
    fullName: string;
    email: string;
    email2?: string | null;
    email3?: string | null;
    phoneNumber?: string | null;
    phoneNumber2?: string | null;
    studentId?: number | null;
    profilePhotoUrl?: string | null;
    linkedInUrl?: string | null;
    joinDate: Date | string;
    showPhoneNumber?: boolean;
    showPhoneNumber2?: boolean;
    showEmail2?: boolean;
    showEmail3?: boolean;
    showStudentId?: boolean;
}

export interface RoleHistoryEntrySource {
    id: number;
    changeType: string;
    changeReason?: string | null;
    notes?: string | null;
    startDate: Date;
    endDate?: Date | null;
    isActive: boolean;
    member: { fullName: string };
    team?: { name: string } | null;
    role?: { roleName: string } | null;
    subteam?: { name: string } | null;
}

export function buildMemberTimeline(history: RoleHistoryEntrySource[]) {
    return history.map((entry) => ({
        id: entry.id,
        memberName: entry.member.fullName,
        teamName: entry.team?.name || 'Unknown Team',
        roleName: entry.role?.roleName || 'Unknown Role',
        subteamName: entry.subteam?.name || null,
        changeType: entry.changeType,
        changeReason: entry.changeReason,
        notes: entry.notes,
        period: {
            start: entry.startDate,
            end: entry.endDate,
            duration: entry.endDate
                ? Math.floor(
                      (new Date(entry.endDate).getTime() - new Date(entry.startDate).getTime()) /
                          (1000 * 60 * 60 * 24),
                  )
                : 'Ongoing',
        },
        isActive: entry.isActive,
    }));
}

export function toMemberProfileView(member: MemberProfileSource) {
    const phoneNumber =
        member.showPhoneNumber && member.phoneNumber && !isPlaceholderPhone(member.phoneNumber)
            ? member.phoneNumber
            : null;
    const phoneNumber2 =
        member.showPhoneNumber2 && member.phoneNumber2 && !isPlaceholderPhone(member.phoneNumber2)
            ? member.phoneNumber2
            : null;

    return {
        id: member.id,
        fullName: member.fullName,
        email: member.email,
        email2: member.showEmail2 ? member.email2 ?? null : null,
        email3: member.showEmail3 ? member.email3 ?? null : null,
        phoneNumber,
        phoneNumber2,
        studentId: member.showStudentId ? member.studentId ?? null : null,
        profilePhotoUrl: member.profilePhotoUrl ?? null,
        linkedInUrl: member.linkedInUrl ?? null,
        joinDate: member.joinDate,
    };
}

export const MEMBER_VISIBILITY_FIELDS = [
    'showPhoneNumber',
    'showPhoneNumber2',
    'showEmail2',
    'showEmail3',
    'showStudentId',
] as const;

export type MemberVisibilityField = (typeof MEMBER_VISIBILITY_FIELDS)[number];

export function validateVisibilityUpdates(updateData: Record<string, unknown>): string | null {
    for (const field of MEMBER_VISIBILITY_FIELDS) {
        if (updateData[field] !== undefined && typeof updateData[field] !== 'boolean') {
            return `${field} must be a boolean`;
        }
    }
    return null;
}
