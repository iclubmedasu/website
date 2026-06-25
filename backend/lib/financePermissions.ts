import { prisma } from "../db";
import type { RequestUser } from "../types/auth";

/** Team names that qualify for FR finance viewer access (matched case-insensitively). */
export const FR_TEAM_NAME_ALIASES = [
    "fr",
    "finance",
    "financial relations",
    "finance relations",
    "finance resources",
    "financial resources",
    "accounting",
] as const;

type TeamMembershipLike = {
    team?: { name?: string | null } | null;
    role?: { roleName?: string | null; systemRoleKey?: number | null } | null;
};

export function isFrTeamName(teamName: string | null | undefined): boolean {
    if (!teamName) return false;
    const normalized = teamName.trim().toLowerCase();
    return (FR_TEAM_NAME_ALIASES as readonly string[]).includes(normalized);
}

export function isFrHeadOrViceFromMemberships(teamMemberships: TeamMembershipLike[] | null | undefined): boolean {
    for (const membership of teamMemberships ?? []) {
        if (!isFrTeamName(membership.team?.name)) continue;
        const systemRoleKey = membership.role?.systemRoleKey != null
            ? Number(membership.role.systemRoleKey)
            : null;
        const roleName = membership.role?.roleName;
        if (systemRoleKey === 1 || systemRoleKey === 2) return true;
        if (roleName === "Head of Team" || roleName === "Vice Head of Team") return true;
    }
    return false;
}

export function computeIsFinanceViewer(
    teamMemberships: TeamMembershipLike[] | null | undefined,
    options: { isDeveloper?: boolean; isOfficer?: boolean; isAdmin?: boolean } = {},
): boolean {
    if (options.isDeveloper || options.isOfficer || options.isAdmin) return true;
    return isFrHeadOrViceFromMemberships(teamMemberships);
}

export function canViewFinance(user: RequestUser | null | undefined): boolean {
    if (user?.isDeveloper || user?.isOfficer || user?.isAdmin) return true;
    return !!user?.isFinanceViewer;
}

export async function isFrHeadOrVice(memberId: number): Promise<boolean> {
    const memberships = await prisma.teamMember.findMany({
        where: { memberId, isActive: true },
        select: {
            team: { select: { name: true } },
            role: { select: { roleName: true, systemRoleKey: true } },
        },
    });
    return isFrHeadOrViceFromMemberships(memberships);
}
