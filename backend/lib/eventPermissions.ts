import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import type { RequestUser } from '../types/auth';

/** Lifecycle roles: developer, officer, administration, leadership. */
export function isPrivilegedUser(user: RequestUser | null | undefined): boolean {
    return !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin || user?.isLeadership);
}

/** Global visibility: developer, officer, administration (leadership excluded). */
export function canUserViewAllEvents(user: RequestUser | null | undefined): boolean {
    return !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin);
}

export function isLeadershipOrSpecial(user: RequestUser | null | undefined): boolean {
    return !!(user?.isLeadership || user?.isSpecial);
}

export function canUserManageEventTasks(user: RequestUser | null | undefined): boolean {
    return !!user?.memberId && (isPrivilegedUser(user) || !!user?.isSpecial);
}

export function canUserManageEventTiers(user: RequestUser | null | undefined): boolean {
    return canUserManageEventTasks(user);
}

export function canUserManageEventLifecycle(user: RequestUser | null | undefined): boolean {
    return !!user?.memberId && isPrivilegedUser(user);
}

export function canUserPublishEvent(user: RequestUser | null | undefined): boolean {
    return !!user?.memberId && (isPrivilegedUser(user) || !!user?.isSpecial);
}

export function canUserRemoveAttendance(user: RequestUser | null | undefined): boolean {
    return canUserPublishEvent(user);
}

export async function getUserTeamIds(memberId: number): Promise<number[]> {
    const rows = await prisma.teamMember.findMany({
        where: { memberId, isActive: true },
        select: { teamId: true },
    });
    return rows.map((row) => row.teamId);
}

export async function isMemberAssignedToEvent(memberId: number, eventId: number): Promise<boolean> {
    const assignment = await prisma.eventTaskAssignment.findFirst({
        where: {
            memberId,
            eventTask: {
                eventId,
                isActive: true,
            },
        },
        select: { id: true },
    });
    if (assignment) return true;

    const leaderTask = await prisma.eventTask.findFirst({
        where: {
            eventId,
            leaderId: memberId,
            isActive: true,
        },
        select: { id: true },
    });

    return leaderTask !== null;
}

export async function isMemberOnEventTeam(memberId: number, eventId: number): Promise<boolean> {
    const myTeamIds = await getUserTeamIds(memberId);
    if (myTeamIds.length === 0) return false;

    const access = await prisma.eventTeam.findFirst({
        where: {
            eventId,
            teamId: { in: myTeamIds },
        },
        select: { id: true },
    });

    return access !== null;
}

export async function canUserViewEvent(
    user: RequestUser | null | undefined,
    eventId: number,
    isArchived: boolean,
): Promise<boolean> {
    if (!user?.memberId) return false;
    if (isArchived) return true;
    if (canUserViewAllEvents(user)) return true;

    if (isLeadershipOrSpecial(user)) {
        return isMemberOnEventTeam(user.memberId, eventId);
    }

    return isMemberAssignedToEvent(user.memberId, eventId);
}

export async function canUserManageCustomFields(
    user: RequestUser | null | undefined,
    eventId: number,
    isArchived: boolean,
): Promise<boolean> {
    return canUserViewEvent(user, eventId, isArchived);
}

export async function canUserAccessEventOperations(
    user: RequestUser | null | undefined,
    eventId: number,
    isArchived: boolean,
): Promise<boolean> {
    return canUserViewEvent(user, eventId, isArchived);
}

/**
 * Active-event list visibility:
 * - Developer/officer/administration: all active events.
 * - Leadership/special: events linked to their teams via EventTeam.
 * - Regular member: only events with an active task assignment or task leadership.
 */
export async function buildActiveEventVisibilityWhere(
    user: RequestUser | null | undefined,
): Promise<Prisma.EventWhereInput | null> {
    if (!user?.memberId) return { id: -1 };
    if (canUserViewAllEvents(user)) return null;

    if (isLeadershipOrSpecial(user)) {
        const myTeamIds = await getUserTeamIds(user.memberId);
        if (myTeamIds.length === 0) return { id: -1 };

        return {
            eventTeams: {
                some: {
                    teamId: { in: myTeamIds },
                },
            },
        };
    }

    return {
        tasks: {
            some: {
                isActive: true,
                OR: [
                    {
                        assignments: {
                            some: { memberId: user.memberId },
                        },
                    },
                    { leaderId: user.memberId },
                ],
            },
        },
    };
}

export async function canUserEditEvent(
    user: RequestUser | null | undefined,
    eventId: number,
): Promise<boolean> {
    if (!canUserManageEventLifecycle(user)) return false;

    const event = await prisma.event.findUnique({
        where: { id: eventId },
        select: { isActive: true, isFinalized: true, isArchived: true, status: true },
    });
    if (!event || event.isArchived || !event.isActive || event.isFinalized || event.status === 'CANCELLED') {
        return false;
    }

    return true;
}

export async function getEventTeamIds(eventId: number): Promise<number[]> {
    const rows = await prisma.eventTeam.findMany({
        where: { eventId },
        select: { teamId: true },
    });
    return rows.map((row) => row.teamId);
}

export async function assertAssigneesOnEventTeams(
    eventId: number,
    { leaderId, memberIds }: { leaderId?: number | null; memberIds?: number[] },
): Promise<string | null> {
    const eventTeamIds = await getEventTeamIds(eventId);
    if (eventTeamIds.length === 0) {
        return 'Event has no teams assigned; add teams before assigning members';
    }

    const idsToCheck = new Set<number>();
    if (leaderId) idsToCheck.add(leaderId);
    for (const memberId of memberIds ?? []) {
        if (memberId) idsToCheck.add(memberId);
    }

    if (idsToCheck.size === 0) return null;

    const allowedMembers = await prisma.teamMember.findMany({
        where: {
            teamId: { in: eventTeamIds },
            isActive: true,
            memberId: { in: Array.from(idsToCheck) },
        },
        select: { memberId: true },
    });

    const allowedIds = new Set(allowedMembers.map((row) => row.memberId));
    for (const memberId of idsToCheck) {
        if (!allowedIds.has(memberId)) {
            return 'All task assignees must belong to a team linked to this event';
        }
    }

    return null;
}
