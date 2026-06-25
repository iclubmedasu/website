import type { IncomingMessage } from 'http';
import type { Duplex } from 'stream';
import jwt from 'jsonwebtoken';
import { WebSocketServer, WebSocket } from 'ws';
import { JWT_SECRET, extractAuthToken } from '../middleware/auth';
import type { NotificationEventType, NotificationRealtimeMessage, RealtimeSubscribeMessage } from '../types/contracts';
import type { RequestUser } from '../types/auth';

const WS_PATH = '/api/notifications/ws';

const socketsByMember = new Map<number, Set<WebSocket>>();
const socketsByTopic = new Map<string, Set<WebSocket>>();
const topicsBySocket = new WeakMap<WebSocket, Set<string>>();

function getSocketTopics(socket: WebSocket): Set<string> {
    const existing = topicsBySocket.get(socket);
    if (existing) return existing;
    const created = new Set<string>();
    topicsBySocket.set(socket, created);
    return created;
}

function addSocketToTopic(topic: string, socket: WebSocket): void {
    const current = socketsByTopic.get(topic) ?? new Set<WebSocket>();
    current.add(socket);
    socketsByTopic.set(topic, current);
    getSocketTopics(socket).add(topic);
}

function removeSocketFromTopic(topic: string, socket: WebSocket): void {
    const current = socketsByTopic.get(topic);
    if (!current) return;
    current.delete(socket);
    if (current.size === 0) {
        socketsByTopic.delete(topic);
    }
    getSocketTopics(socket).delete(topic);
}

function addMemberSocket(memberId: number, socket: WebSocket): void {
    const current = socketsByMember.get(memberId) ?? new Set<WebSocket>();
    current.add(socket);
    socketsByMember.set(memberId, current);
}

function removeMemberSocket(memberId: number, socket: WebSocket): void {
    const current = socketsByMember.get(memberId);
    if (!current) return;
    current.delete(socket);
    if (current.size === 0) {
        socketsByMember.delete(memberId);
    }
}

function cleanupSocket(memberId: number, socket: WebSocket): void {
    removeMemberSocket(memberId, socket);
    const topics = getSocketTopics(socket);
    for (const topic of topics) {
        removeSocketFromTopic(topic, socket);
    }
    topics.clear();
}

function subscribeSocket(socket: WebSocket, topic: string): void {
    if (!topic.trim()) return;
    addSocketToTopic(topic, socket);
}

function unsubscribeSocket(socket: WebSocket, topic: string): void {
    if (!topic.trim()) return;
    removeSocketFromTopic(topic, socket);
}

function getMemberIdFromRequest(req: IncomingMessage): number | null {
    try {
        const token = extractAuthToken(req, { allowQueryToken: true });
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

function sendSerialized(socket: WebSocket, serialized: string): void {
    if (socket.readyState !== WebSocket.OPEN) return;
    socket.send(serialized);
}

export function publishToTopic(topic: string, message: NotificationRealtimeMessage | Record<string, unknown>): void {
    const sockets = socketsByTopic.get(topic);
    if (!sockets || sockets.size === 0) return;

    const serialized = JSON.stringify(message);
    for (const socket of sockets) {
        sendSerialized(socket, serialized);
    }
}

function handleSocketMessage(socket: WebSocket, raw: WebSocket.RawData): void {
    try {
        const payload = JSON.parse(String(raw)) as RealtimeSubscribeMessage;
        if (payload.action === 'subscribe') {
            subscribeSocket(socket, payload.topic);
            return;
        }
        if (payload.action === 'unsubscribe') {
            unsubscribeSocket(socket, payload.topic);
        }
    } catch {
        // Ignore malformed client messages.
    }
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
                addMemberSocket(memberId, ws);
                subscribeSocket(ws, `member:${memberId}`);

                ws.on('message', (raw) => {
                    handleSocketMessage(ws, raw);
                });

                ws.on('close', () => {
                    cleanupSocket(memberId, ws);
                });

                ws.on('error', () => {
                    cleanupSocket(memberId, ws);
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
    const message: NotificationRealtimeMessage = {
        type: 'notification.created',
        notificationId: payload.notificationId,
        eventType: payload.eventType,
        createdAt: payload.createdAt.toISOString(),
    };

    publishToTopic(`member:${payload.memberId}`, message);

    const sockets = socketsByMember.get(payload.memberId);
    if (!sockets || sockets.size === 0) return;

    const serialized = JSON.stringify(message);
    for (const socket of sockets) {
        sendSerialized(socket, serialized);
    }
}
