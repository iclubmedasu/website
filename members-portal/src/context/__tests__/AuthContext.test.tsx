'use client';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import {
    AuthProvider,
    isPublicAuthPath,
    shouldSkipBootAuthMe,
    useAuth,
} from '@/context/AuthContext';

function BootStatus() {
    const { loading } = useAuth();
    return <div>{loading ? 'boot-loading' : 'boot-ready'}</div>;
}

function AuthActions() {
    const { checkEmail, login, loading } = useAuth();
    const [error, setError] = useState('');

    return (
        <div>
            <div>{loading ? 'boot-loading' : 'boot-ready'}</div>
            {error ? <div>{error}</div> : null}
            <button
                type="button"
                onClick={() => {
                    void checkEmail('member@med.asu.edu.eg').then((result) => {
                        if (!result.success) setError(result.error);
                    });
                }}
            >
                Check email
            </button>
            <button
                type="button"
                onClick={() => {
                    void login('member@med.asu.edu.eg', 'secret').then((result) => {
                        if (!result.success) setError(result.error);
                    });
                }}
            >
                Log in
            </button>
        </div>
    );
}

function jsonResponse(status: number, body: unknown) {
    const payload = JSON.stringify(body);
    return {
        ok: status >= 200 && status < 300,
        status,
        headers: {
            get: (name: string) =>
                name.toLowerCase() === 'content-type' ? 'application/json' : null,
        },
        text: async () => payload,
        json: async () => body,
    };
}

const HF_PORTAL = 'https://iclubmedasu-members-portal.hf.space';
const HF_BACKEND_API = 'https://iclubmedasu-backend.hf.space/api';

function stubHfPortalLocation(pathname = '/login') {
    vi.stubEnv('NEXT_PUBLIC_API_URL', HF_BACKEND_API);
    Object.defineProperty(window, 'location', {
        configurable: true,
        value: new URL(`${HF_PORTAL}${pathname}`),
    });
}

describe('public auth path helpers', () => {
    it('treats login and password routes as public auth paths', () => {
        expect(isPublicAuthPath('/login')).toBe(true);
        expect(isPublicAuthPath('/login/')).toBe(true);
        expect(isPublicAuthPath('/forgot-password')).toBe(true);
        expect(isPublicAuthPath('/reset-password')).toBe(true);
        expect(isPublicAuthPath('/dashboard')).toBe(false);
    });

    it('skips boot /auth/me on public routes unless a PWA bearer exists', () => {
        expect(shouldSkipBootAuthMe('/login', null)).toBe(true);
        expect(shouldSkipBootAuthMe('/forgot-password')).toBe(true);
        expect(shouldSkipBootAuthMe('/login', 'pwa-bearer-token')).toBe(false);
        expect(shouldSkipBootAuthMe('/dashboard', null)).toBe(false);
        expect(shouldSkipBootAuthMe('/dashboard', 'pwa-bearer-token')).toBe(false);
    });
});

describe('AuthProvider boot /auth/me', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        localStorage.clear();
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
        window.history.pushState({}, '', '/');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        localStorage.clear();
        window.history.pushState({}, '', '/');
    });

    it('does not boot-fetch /auth/me on /login', async () => {
        window.history.pushState({}, '', '/login');
        fetchMock.mockResolvedValue(jsonResponse(401, { error: 'Authentication required' }));

        render(
            <AuthProvider>
                <BootStatus />
            </AuthProvider>,
        );

        await waitFor(() => {
            expect(screen.getByText('boot-ready')).toBeTruthy();
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('does not boot-fetch /auth/me on /forgot-password', async () => {
        window.history.pushState({}, '', '/forgot-password');
        fetchMock.mockResolvedValue(jsonResponse(401, { error: 'Authentication required' }));

        render(
            <AuthProvider>
                <BootStatus />
            </AuthProvider>,
        );

        await waitFor(() => {
            expect(screen.getByText('boot-ready')).toBeTruthy();
        });
        expect(fetchMock).not.toHaveBeenCalled();
    });
});

describe('AuthProvider login/check-email 429', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        localStorage.clear();
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
        window.history.pushState({}, '', '/login');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        localStorage.clear();
        window.history.pushState({}, '', '/');
    });

    it('checkEmail uses a single fetch on 429', async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(429, { error: 'Too many requests' }),
        );

        render(
            <AuthProvider>
                <AuthActions />
            </AuthProvider>,
        );

        await waitFor(() => {
            expect(screen.getByText('boot-ready')).toBeTruthy();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Check email' }));

        await waitFor(() => {
            expect(screen.getByText('Too many requests')).toBeTruthy();
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/auth/check-email');
    });

    it('login uses a single fetch on 429', async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(429, { error: 'Too many requests' }),
        );

        render(
            <AuthProvider>
                <AuthActions />
            </AuthProvider>,
        );

        await waitFor(() => {
            expect(screen.getByText('boot-ready')).toBeTruthy();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

        await waitFor(() => {
            expect(screen.getByText('Too many requests')).toBeTruthy();
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(String(fetchMock.mock.calls[0]?.[0])).toContain('/auth/login');
    });
});

describe('AuthProvider direct backend auth POSTs', () => {
    const fetchMock = vi.fn();

    beforeEach(() => {
        localStorage.clear();
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
        stubHfPortalLocation('/login');
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        localStorage.clear();
        window.history.pushState({}, '', '/');
    });

    it('checkEmail posts to backend host, not /backend-api', async () => {
        fetchMock.mockResolvedValue(
            jsonResponse(200, { exists: true, needsSetup: false }),
        );

        render(
            <AuthProvider>
                <AuthActions />
            </AuthProvider>,
        );

        await waitFor(() => {
            expect(screen.getByText('boot-ready')).toBeTruthy();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Check email' }));

        await waitFor(() => {
            expect(fetchMock).toHaveBeenCalled();
        });

        const url = String(fetchMock.mock.calls[0]?.[0]);
        const init = fetchMock.mock.calls[0]?.[1] as RequestInit;
        expect(url).toBe(`${HF_BACKEND_API}/auth/check-email`);
        expect(url).not.toContain('/backend-api');
        expect(init.credentials).toBe('omit');
    });

    it('login posts to backend host and establishes portal session cookie', async () => {
        const token = 'aaa.bbb.ccc';
        fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.includes('/auth/login')) {
                return jsonResponse(200, {
                    user: { id: '1', email: 'member@med.asu.edu.eg', role: 'MEMBER' },
                    token,
                });
            }
            if (url.includes('/api/session')) {
                return jsonResponse(200, { ok: true });
            }
            if (url.includes('/auth/me')) {
                return jsonResponse(200, {
                    user: { id: '1', email: 'member@med.asu.edu.eg', role: 'MEMBER' },
                });
            }
            return jsonResponse(404, { error: 'not found' });
        });

        render(
            <AuthProvider>
                <AuthActions />
            </AuthProvider>,
        );

        await waitFor(() => {
            expect(screen.getByText('boot-ready')).toBeTruthy();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Log in' }));

        await waitFor(() => {
            const urls = fetchMock.mock.calls.map((call) => String(call[0]));
            expect(urls.some((u) => u === `${HF_BACKEND_API}/auth/login`)).toBe(true);
            expect(urls.some((u) => u === '/api/session' || u.endsWith('/api/session'))).toBe(true);
        });

        const loginCall = fetchMock.mock.calls.find(
            (call) => String(call[0]) === `${HF_BACKEND_API}/auth/login`,
        );
        expect(String(loginCall?.[0])).not.toContain('/backend-api');
        expect((loginCall?.[1] as RequestInit).credentials).toBe('omit');

        const sessionCall = fetchMock.mock.calls.find((call) => {
            const url = String(call[0]);
            return url === '/api/session' || url.endsWith('/api/session');
        });
        expect(sessionCall?.[1]).toEqual(
            expect.objectContaining({
                method: 'POST',
                body: JSON.stringify({ token }),
            }),
        );
    });
});
