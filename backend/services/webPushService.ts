import webpush from 'web-push';
import { prisma } from '../db';

type PushPayloadInput = {
    title: string;
    body: string;
    eventType: string;
    url?: string;
};

let vapidConfigured = false;

function ensureVapidConfigured(): boolean {
    const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
    const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@example.com';

    if (!publicKey || !privateKey) {
        return false;
    }

    if (!vapidConfigured) {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        vapidConfigured = true;
    }
    return true;
}

export function resolvePushClickUrl(eventType: string): string {
    if (eventType === 'ANNOUNCEMENT') {
        return '/dashboard';
    }
    return '/user#notifications';
}

function isGoneStatus(statusCode: unknown): boolean {
    return statusCode === 404 || statusCode === 410;
}

/** Unread rule matches GET /notifications/unread-count (`isRead: false`). */
async function loadUnreadCountsByMember(memberIds: number[]): Promise<Map<number, number>> {
    const counts = new Map<number, number>();
    if (memberIds.length === 0) return counts;

    const db = prisma as any;
    const rows = await db.notification.groupBy({
        by: ['memberId'],
        where: {
            memberId: { in: memberIds },
            isRead: false,
        },
        _count: { _all: true },
    });

    for (const row of rows as Array<{ memberId: number; _count: { _all: number } }>) {
        counts.set(row.memberId, row._count._all);
    }
    return counts;
}

export async function sendWebPushToMembers(
    memberIds: number[],
    payload: PushPayloadInput,
): Promise<void> {
    if (memberIds.length === 0) return;
    if (!ensureVapidConfigured()) {
        return;
    }

    const db = prisma as any;
    const subscriptions = await db.pushSubscription.findMany({
        where: {
            memberId: { in: memberIds },
        },
        select: {
            id: true,
            memberId: true,
            endpoint: true,
            p256dh: true,
            auth: true,
        },
    });

    if (subscriptions.length === 0) return;

    const uniqueMemberIds = [
        ...new Set(
            (subscriptions as Array<{ memberId: number }>).map((s) => s.memberId),
        ),
    ];
    const unreadByMember = await loadUnreadCountsByMember(uniqueMemberIds);

    const url = payload.url || resolvePushClickUrl(payload.eventType);

    await Promise.all(
        subscriptions.map(async (subscription: {
            id: number;
            memberId: number;
            endpoint: string;
            p256dh: string;
            auth: string;
        }) => {
            const badgeCount = unreadByMember.get(subscription.memberId) ?? 0;
            const body = JSON.stringify({
                title: payload.title,
                body: payload.body,
                eventType: payload.eventType,
                url,
                badgeCount,
            });

            try {
                await webpush.sendNotification(
                    {
                        endpoint: subscription.endpoint,
                        keys: {
                            p256dh: subscription.p256dh,
                            auth: subscription.auth,
                        },
                    },
                    body,
                );
            } catch (error: any) {
                const statusCode = error?.statusCode ?? error?.status;
                if (isGoneStatus(statusCode)) {
                    try {
                        await db.pushSubscription.delete({
                            where: { id: subscription.id },
                        });
                    } catch (deleteError) {
                        console.error('Failed to delete stale push subscription', deleteError);
                    }
                    return;
                }
                console.error('Web push send failed', {
                    subscriptionId: subscription.id,
                    statusCode,
                    message: error?.message,
                });
            }
        }),
    );
}
