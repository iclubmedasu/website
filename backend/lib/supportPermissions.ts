import { prisma } from "../db";
import type { RequestUser } from "../types/auth";

/** Team names that qualify for HR forms-editor access (matched case-insensitively). */
export const HR_TEAM_NAME_ALIASES = ["hr", "human resources"] as const;

type TeamMembershipLike = {
    team?: { name?: string | null } | null;
    role?: { roleName?: string | null; systemRoleKey?: number | null } | null;
};

export function isHrTeamName(teamName: string | null | undefined): boolean {
    if (!teamName) return false;
    const normalized = teamName.trim().toLowerCase();
    return (HR_TEAM_NAME_ALIASES as readonly string[]).includes(normalized);
}

export function isHrHeadOrViceFromMemberships(teamMemberships: TeamMembershipLike[] | null | undefined): boolean {
    for (const membership of teamMemberships ?? []) {
        if (!isHrTeamName(membership.team?.name)) continue;
        const systemRoleKey = membership.role?.systemRoleKey != null
            ? Number(membership.role.systemRoleKey)
            : null;
        const roleName = membership.role?.roleName;
        if (systemRoleKey === 1 || systemRoleKey === 2) return true;
        if (roleName === "Head of Team" || roleName === "Vice Head of Team") return true;
    }
    return false;
}

export function canEditSiteContent(user: RequestUser | null | undefined): boolean {
    return !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin);
}

export function computeIsSupportFormsEditor(
    teamMemberships: TeamMembershipLike[] | null | undefined,
    options: { isDeveloper?: boolean; isOfficer?: boolean; isAdmin?: boolean } = {},
): boolean {
    if (options.isDeveloper || options.isOfficer || options.isAdmin) return true;
    return isHrHeadOrViceFromMemberships(teamMemberships);
}

export function canEditSupportForms(user: RequestUser | null | undefined): boolean {
    if (canEditSiteContent(user)) return true;
    return !!user?.isSupportFormsEditor;
}

export async function isHrHeadOrVice(memberId: number): Promise<boolean> {
    const memberships = await prisma.teamMember.findMany({
        where: { memberId, isActive: true },
        select: {
            team: { select: { name: true } },
            role: { select: { roleName: true, systemRoleKey: true } },
        },
    });
    return isHrHeadOrViceFromMemberships(memberships);
}
