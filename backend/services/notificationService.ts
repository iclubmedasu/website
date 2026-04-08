import { prisma } from '../db';
import { publishNotificationCreated } from './notificationsRealtime';
import type {
    NotificationAudienceType,
    NotificationEventType,
    NotificationItem,
    NotificationsListResponse,
} from '../types/contracts';

interface EmitNotificationEventInput {
    eventType: NotificationEventType;
    audienceType: NotificationAudienceType;
    actorMemberId?: number | null;
    includeActor?: boolean;
    persistEventWhenNoRecipients?: boolean;
    title: string;
    body: string;
    metadata?: Record<string, unknown> | null;
    audienceData?: Record<string, unknown> | null;
    recipientMemberIds: number[];
}

interface ListNotificationsInput {
    limit?: number;
    cursor?: number;
    unreadOnly?: boolean;
}

function normalizeMemberId(value: unknown): number | null {
    const memberId = Number(value);
    if (!Number.isInteger(memberId) || memberId <= 0) {
        return null;
    }
    return memberId;
}

function uniqueMemberIds(memberIds: number[]): number[] {
    const deduped = new Set<number>();
    for (const rawId of memberIds) {
        const memberId = Number(rawId);
        if (Number.isNaN(memberId) || memberId <= 0) continue;
        deduped.add(memberId);
    }
    return Array.from(deduped);
}

function normalizeMetadata(value: unknown): Record<string, unknown> | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return null;
    }
    return value as Record<string, unknown>;
}

function toNotificationItem(row: any): NotificationItem {
    return {
        id: row.id,
        memberId: row.memberId,
        eventId: row.eventId,
        eventType: row.eventType,
        title: row.title,
        body: row.body,
        metadata: normalizeMetadata(row.metadata),
        isRead: row.isRead,
        readAt: row.readAt ? row.readAt.toISOString() : null,
        createdAt: row.createdAt.toISOString(),
    };
}

async function filterDeliverableMemberIds(memberIds: number[]): Promise<number[]> {
    const ids = uniqueMemberIds(memberIds);
    if (ids.length === 0) return [];

    const rows = await prisma.member.findMany({
        where: {
            id: { in: ids },
            isActive: true,
            user: {
                is: {
                    isActive: true,
                },
            },
        },
        select: { id: true },
    });

    return rows.map((row) => row.id);
}

export async function resolveTeamMemberIds(teamIds: number[]): Promise<number[]> {
    const ids = uniqueMemberIds(teamIds);
    if (ids.length === 0) return [];

    const memberships = await prisma.teamMember.findMany({
        where: {
            teamId: { in: ids },
            isActive: true,
        },
        select: {
            memberId: true,
        },
    });

    return uniqueMemberIds(memberships.map((membership) => membership.memberId));
}

export async function resolveProjectTeamMemberIds(projectId: number): Promise<number[]> {
    const teams = await prisma.projectTeam.findMany({
        where: { projectId },
        select: { teamId: true },
    });

    return resolveTeamMemberIds(teams.map((team) => team.teamId));
}

export async function resolveTaskAssigneeMemberIds(taskId: number): Promise<number[]> {
    const assignments = await prisma.taskAssignment.findMany({
        where: { taskId },
        select: { memberId: true },
    });

    return uniqueMemberIds(assignments.map((assignment) => assignment.memberId));
}

export async function resolveTaskCommenterMemberIds(taskId: number): Promise<number[]> {
    const comments = await prisma.taskComment.findMany({
        where: { taskId },
        distinct: ['memberId'],
        select: { memberId: true },
    });

    return uniqueMemberIds(comments.map((comment) => comment.memberId));
}

export async function emitNotificationEvent(input: EmitNotificationEventInput): Promise<{ eventId: number; notificationCount: number } | null> {
    const actorMemberId = normalizeMemberId(input.actorMemberId);
    const includeActor = input.includeActor === true;
    const persistEventWhenNoRecipients = input.persistEventWhenNoRecipients === true;

    const dedupedRecipients = uniqueMemberIds(input.recipientMemberIds);
    const baseRecipients = includeActor
        ? dedupedRecipients
        : dedupedRecipients.filter((memberId) => memberId !== actorMemberId);

    if (baseRecipients.length === 0 && !persistEventWhenNoRecipients) {
        console.info(`[notifications] skipped ${input.eventType}: no recipients after actor filtering`);
        return null;
    }

    const recipientMemberIds = await filterDeliverableMemberIds(baseRecipients);
    if (recipientMemberIds.length === 0 && !persistEventWhenNoRecipients) {
        console.info(`[notifications] skipped ${input.eventType}: no deliverable active recipients`);
        return null;
    }

    const db = prisma as any;
    const notificationsCreateInput = recipientMemberIds.map((memberId) => ({
        memberId,
        eventType: input.eventType,
        title: input.title,
        body: input.body,
        metadata: input.metadata ?? null,
    }));

    const createData: Record<string, unknown> = {
        eventType: input.eventType,
        audienceType: input.audienceType,
        actorMemberId,
        title: input.title,
        body: input.body,
        metadata: input.metadata ?? null,
        audienceData: input.audienceData ?? null,
    };

    if (notificationsCreateInput.length > 0) {
        createData.notifications = {
            create: notificationsCreateInput,
        };
    } else {
        console.info(`[notifications] persisted ${input.eventType} event with zero deliverable recipients`);
    }

    const createdEvent = await db.notificationEvent.create({
        data: createData,
        include: {
            notifications: {
                select: {
                    id: true,
                    memberId: true,
                    eventType: true,
                    createdAt: true,
                },
            },
        },
    });

    for (const notification of createdEvent.notifications as Array<{
        id: number;
        memberId: number;
        eventType: NotificationEventType;
        createdAt: Date;
    }>) {
        publishNotificationCreated({
            memberId: notification.memberId,
            notificationId: notification.id,
            eventType: notification.eventType,
            createdAt: notification.createdAt,
        });
    }

    return {
        eventId: createdEvent.id,
        notificationCount: notificationsCreateInput.length,
    };
}

export async function listNotificationsForMember(
    memberId: number,
    input: ListNotificationsInput = {},
): Promise<NotificationsListResponse> {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);

    const where: Record<string, unknown> = {
        memberId,
    };

    if (input.unreadOnly) {
        where.isRead = false;
    }

    if (input.cursor && !Number.isNaN(Number(input.cursor))) {
        where.id = {
            lt: Number(input.cursor),
        };
    }

    const db = prisma as any;
    const rows = await db.notification.findMany({
        where,
        orderBy: {
            id: 'desc',
        },
        take: limit,
        select: {
            id: true,
            memberId: true,
            eventId: true,
            eventType: true,
            title: true,
            body: true,
            metadata: true,
            isRead: true,
            readAt: true,
            createdAt: true,
        },
    });

    const notifications = rows.map(toNotificationItem);
    const nextCursor = notifications.length === limit
        ? notifications[notifications.length - 1]?.id ?? null
        : null;

    return {
        notifications,
        nextCursor,
    };
}

export async function getUnreadNotificationsCount(memberId: number): Promise<number> {
    const db = prisma as any;
    return db.notification.count({
        where: {
            memberId,
            isRead: false,
        },
    });
}

export async function markNotificationAsRead(
    memberId: number,
    notificationId: number,
): Promise<NotificationItem | null> {
    const db = prisma as any;
    const existing = await db.notification.findFirst({
        where: {
            id: notificationId,
            memberId,
        },
        select: {
            id: true,
            memberId: true,
            eventId: true,
            eventType: true,
            title: true,
            body: true,
            metadata: true,
            isRead: true,
            readAt: true,
            createdAt: true,
        },
    });

    if (!existing) {
        return null;
    }

    if (existing.isRead) {
        return toNotificationItem(existing);
    }

    const updated = await db.notification.update({
        where: {
            id: notificationId,
        },
        data: {
            isRead: true,
            readAt: new Date(),
        },
        select: {
            id: true,
            memberId: true,
            eventId: true,
            eventType: true,
            title: true,
            body: true,
            metadata: true,
            isRead: true,
            readAt: true,
            createdAt: true,
        },
    });

    return toNotificationItem(updated);
}

export async function markAllNotificationsAsRead(memberId: number): Promise<number> {
    const db = prisma as any;
    const result = await db.notification.updateMany({
        where: {
            memberId,
            isRead: false,
        },
        data: {
            isRead: true,
            readAt: new Date(),
        },
    });

    return result.count;
}

export async function emitSystemAnnouncement(input: {
    title: string;
    body: string;
    metadata?: Record<string, unknown> | null;
}): Promise<{ eventId: number; notificationCount: number } | null> {
    const activeMembers = await prisma.member.findMany({
        where: {
            isActive: true,
            user: {
                is: {
                    isActive: true,
                },
            },
        },
        select: {
            id: true,
        },
    });

    return emitNotificationEvent({
        eventType: 'ANNOUNCEMENT',
        audienceType: 'SYSTEM',
        title: input.title,
        body: input.body,
        metadata: input.metadata ?? null,
        audienceData: {
            scope: 'all-active-members',
        },
        recipientMemberIds: activeMembers.map((member) => member.id),
    });
}
