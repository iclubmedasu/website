import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import jwt from 'jsonwebtoken';
import { WebSocketServer, WebSocket } from 'ws';
import { JWT_SECRET } from '../middleware/auth';
import type { NotificationEventType, NotificationRealtimeMessage } from '../types/contracts';
import type { RequestUser } from '../types/auth';

const AUTH_COOKIE_NAME = 'token';
const WS_PATH = '/api/notifications/ws';

const socketsByMember = new Map<number, Set<WebSocket>>();

function addSocket(memberId: number, socket: WebSocket): void {
    const current = socketsByMember.get(memberId) ?? new Set<WebSocket>();
    current.add(socket);
    socketsByMember.set(memberId, current);
}

function removeSocket(memberId: number, socket: WebSocket): void {
    const current = socketsByMember.get(memberId);
    if (!current) return;

    current.delete(socket);
    if (current.size === 0) {
        socketsByMember.delete(memberId);
    }
}

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
    if (!cookieHeader) return {};

    return cookieHeader
        .split(';')
        .map((entry) => entry.trim())
        .filter(Boolean)
        .reduce<Record<string, string>>((acc, entry) => {
            const index = entry.indexOf('=');
            if (index <= 0) return acc;
            const key = entry.slice(0, index).trim();
            const value = entry.slice(index + 1).trim();
            if (!key) return acc;
            acc[key] = decodeURIComponent(value);
            return acc;
        }, {});
}

function getMemberIdFromRequest(req: IncomingMessage): number | null {
    try {
        const origin = req.headers.origin ?? 'http://localhost';
        const url = new URL(req.url ?? '', origin);

        const tokenFromQuery = url.searchParams.get('token');
        const cookieToken = parseCookies(req.headers.cookie)[AUTH_COOKIE_NAME];
        const token = tokenFromQuery || cookieToken;
        if (!token) return null;

        const decoded = jwt.verify(token, JWT_SECRET) as RequestUser;
        if (!decoded?.memberId || Number.isNaN(Number(decoded.memberId))) {
            return null;
        }

        return Number(decoded.memberId);
    } catch {
        return null;
    }
}

function rejectUpgrade(socket: Duplex): void {
    socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
    socket.destroy();
}

export function attachNotificationsWebSocketServer(server: import('http').Server): void {
    const wss = new WebSocketServer({ noServer: true });

    server.on('upgrade', (req, socket, head) => {
        try {
            const origin = req.headers.origin ?? 'http://localhost';
            const url = new URL(req.url ?? '', origin);

            if (url.pathname !== WS_PATH) {
                return;
            }

            const memberId = getMemberIdFromRequest(req);
            if (!memberId) {
                rejectUpgrade(socket);
                return;
            }

            wss.handleUpgrade(req, socket, head, (ws) => {
                addSocket(memberId, ws);

                ws.on('close', () => {
                    removeSocket(memberId, ws);
                });

                ws.on('error', () => {
                    removeSocket(memberId, ws);
                });

                const pingMessage: NotificationRealtimeMessage = {
                    type: 'notification.ping',
                };
                ws.send(JSON.stringify(pingMessage));
            });
        } catch {
            rejectUpgrade(socket);
        }
    });
}

export function publishNotificationCreated(payload: {
    memberId: number;
    notificationId: number;
    eventType: NotificationEventType;
    createdAt: Date;
}): void {
    const sockets = socketsByMember.get(payload.memberId);
    if (!sockets || sockets.size === 0) return;

    const message: NotificationRealtimeMessage = {
        type: 'notification.created',
        notificationId: payload.notificationId,
        eventType: payload.eventType,
        createdAt: payload.createdAt.toISOString(),
    };
    const serialized = JSON.stringify(message);

    for (const socket of sockets) {
        if (socket.readyState !== WebSocket.OPEN) continue;
        socket.send(serialized);
    }
}
