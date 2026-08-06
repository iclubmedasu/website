/* eslint-disable no-restricted-globals */

function applyAppBadge(badgeCount) {
    const nav = self.navigator;
    if (!nav) return Promise.resolve();

    if (typeof badgeCount === 'number' && badgeCount > 0 && typeof nav.setAppBadge === 'function') {
        return nav.setAppBadge(badgeCount).catch(() => undefined);
    }
    if (badgeCount === 0 && typeof nav.clearAppBadge === 'function') {
        return nav.clearAppBadge().catch(() => undefined);
    }
    return Promise.resolve();
}

self.addEventListener('push', (event) => {
    const data = event.data ? event.data.json() : {};
    const title = data.title || 'iClub';
    event.waitUntil(
        Promise.all([
            self.registration.showNotification(title, {
                body: data.body || '',
                icon: '/icons/icon-192x192.png',
                badge: '/icons/icon-192x192.png',
                data: { url: data.url || '/dashboard' },
            }),
            applyAppBadge(
                typeof data.badgeCount === 'number' ? data.badgeCount : undefined,
            ),
        ]),
    );
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url || '/dashboard';
    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsList) => {
            for (const client of clientsList) {
                if (client.url.includes(url) && 'focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(url);
            }
            return undefined;
        }),
    );
});
