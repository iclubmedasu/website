import { prisma } from '../db';
import type { RequestUser } from '../types/auth';

/** Global visibility: developer, officer, administration (leadership excluded). */
export function canUserViewAllProjects(user: RequestUser | null | undefined): boolean {
    return !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin);
}

export function isLeadershipOrSpecial(user: RequestUser | null | undefined): boolean {
    return !!(user?.isLeadership || user?.isSpecial);
}

export async function getUserTeamIds(memberId: number): Promise<number[]> {
    const rows = await prisma.teamMember.findMany({
        where: { memberId, isActive: true },
        select: { teamId: true },
    });
    return rows.map((row) => row.teamId);
}

/**
 * Project detail visibility:
 * - Archived projects: all authenticated members.
 * - Developer/officer/administration: all active projects.
 * - Leadership/special: projects linked to their teams (fallback: all if no team membership).
 * - Regular member: only projects with a non-cancelled task assignment.
 */
export async function canUserViewProject(
    user: RequestUser | null | undefined,
    projectId: number,
    isArchived: boolean,
): Promise<boolean> {
    if (!user?.memberId) return false;
    if (isArchived) return true;
    if (canUserViewAllProjects(user)) return true;

    if (isLeadershipOrSpecial(user)) {
        const myTeamIds = await getUserTeamIds(user.memberId);
        if (myTeamIds.length === 0) return true;

        const access = await prisma.projectTeam.findFirst({
            where: {
                projectId,
                teamId: { in: myTeamIds },
            },
            select: { id: true },
        });

        return access !== null;
    }

    const assignment = await prisma.taskAssignment.findFirst({
        where: {
            memberId: user.memberId,
            status: { not: 'CANCELLED' },
            task: {
                projectId,
                isActive: true,
            },
        },
        select: { id: true },
    });

    return assignment !== null;
}

/** Anyone who can view a project can manage its certificates. */
export async function canUserManageProjectCertificates(
    user: RequestUser | null | undefined,
    projectId: number,
): Promise<boolean> {
    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { isArchived: true },
    });
    if (!project) return false;
    return canUserViewProject(user, projectId, project.isArchived);
}
