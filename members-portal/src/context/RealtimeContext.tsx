'use client';

import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from 'react';
import { getAuthToken, getNotificationsWebSocketUrl } from '@/services/api';
import type { NotificationRealtimeMessage, RealtimeSubscribeMessage } from '@/types/backend-contracts';

type RealtimeListener = (message: NotificationRealtimeMessage) => void;

interface RealtimeContextValue {
    subscribe: (topic: string, listener: RealtimeListener) => () => void;
    isConnected: boolean;
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null);

export function RealtimeProvider({ children }: { children: ReactNode }) {
    const [isConnected, setIsConnected] = useState(false);
    const socketRef = useRef<WebSocket | null>(null);
    const listenersRef = useRef<Map<string, Set<RealtimeListener>>>(new Map());
    const subscribedTopicsRef = useRef<Set<string>>(new Set());

    const dispatchMessage = useCallback((message: NotificationRealtimeMessage) => {
        if (message.type === 'resource.changed' && message.resource && message.id != null) {
            const topic = `${message.resource}:${message.id}`;
            const listeners = listenersRef.current.get(topic);
            listeners?.forEach((listener) => listener(message));
        }

        if (message.type === 'notification.created') {
            const memberListeners = listenersRef.current.get('__notifications__');
            memberListeners?.forEach((listener) => listener(message));
        }
    }, []);

    const sendSocketMessage = useCallback((payload: RealtimeSubscribeMessage) => {
        const socket = socketRef.current;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify(payload));
    }, []);

    const resubscribeAllTopics = useCallback(() => {
        for (const topic of subscribedTopicsRef.current) {
            sendSocketMessage({ action: 'subscribe', topic });
        }
    }, [sendSocketMessage]);

    useEffect(() => {
        let disposed = false;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

        const connect = () => {
            if (disposed) return;

            const token = getAuthToken();
            const baseUrl = getNotificationsWebSocketUrl();
            if (!token || !baseUrl) return;

            const url = new URL(baseUrl);
            url.searchParams.set('token', token);

            const socket = new WebSocket(url.toString());
            socketRef.current = socket;

            socket.onopen = () => {
                if (disposed) return;
                setIsConnected(true);
                resubscribeAllTopics();
            };

            socket.onmessage = (event) => {
                try {
                    const payload = JSON.parse(String(event.data)) as NotificationRealtimeMessage;
                    dispatchMessage(payload);
                } catch {
                    // Ignore malformed payloads.
                }
            };

            socket.onerror = () => {
                socket.close();
            };

            socket.onclose = () => {
                setIsConnected(false);
                socketRef.current = null;
                if (disposed) return;
                reconnectTimer = setTimeout(connect, 2000);
            };
        };

        connect();

        return () => {
            disposed = true;
            if (reconnectTimer) clearTimeout(reconnectTimer);
            socketRef.current?.close();
            socketRef.current = null;
        };
    }, [dispatchMessage, resubscribeAllTopics]);

    const subscribe = useCallback((topic: string, listener: RealtimeListener) => {
        const current = listenersRef.current.get(topic) ?? new Set<RealtimeListener>();
        current.add(listener);
        listenersRef.current.set(topic, current);

        if (!subscribedTopicsRef.current.has(topic)) {
            subscribedTopicsRef.current.add(topic);
            sendSocketMessage({ action: 'subscribe', topic });
        }

        return () => {
            const listeners = listenersRef.current.get(topic);
            if (!listeners) return;
            listeners.delete(listener);
            if (listeners.size === 0) {
                listenersRef.current.delete(topic);
                subscribedTopicsRef.current.delete(topic);
                sendSocketMessage({ action: 'unsubscribe', topic });
            }
        };
    }, [sendSocketMessage]);

    const value = useMemo(() => ({ subscribe, isConnected }), [isConnected, subscribe]);

    return (
        <RealtimeContext.Provider value={value}>
            {children}
        </RealtimeContext.Provider>
    );
}

export function useRealtimeContext(): RealtimeContextValue {
    const context = useContext(RealtimeContext);
    if (!context) {
        throw new Error('useRealtimeContext must be used within RealtimeProvider');
    }
    return context;
}

export function useOptionalRealtimeContext(): RealtimeContextValue | null {
    return useContext(RealtimeContext);
}
