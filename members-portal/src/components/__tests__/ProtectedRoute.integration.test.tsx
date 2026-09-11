'use client';

import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '@/context/AuthContext';
import ProtectedRoute from '@/components/ProtectedRoute';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: replaceMock }),
}));

function renderProtectedTree() {
    return render(
        <AuthProvider>
            <ProtectedRoute>
                <div>Dashboard Screen</div>
            </ProtectedRoute>
        </AuthProvider>,
    );
}

describe('ProtectedRoute integration', () => {
    const fetchMock = vi.fn();
    const HF_PORTAL = 'https://iclubmedasu-members-portal.hf.space';
    const HF_BACKEND_API = 'https://iclubmedasu-backend.hf.space/api';

    beforeEach(() => {
        replaceMock.mockReset();
        localStorage.clear();
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
        // Default direct mode on HF: browser → backend, credentials omit.
        vi.stubEnv('NEXT_PUBLIC_API_URL', HF_BACKEND_API);
        Object.defineProperty(window, 'location', {
            configurable: true,
            value: new URL(`${HF_PORTAL}/dashboard`),
        });
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.unstubAllEnvs();
        localStorage.clear();
    });

    it('redirects to login when no token is present', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Authentication required' }),
        });

        renderProtectedTree();

        await waitFor(() => {
            expect(replaceMock).toHaveBeenCalledWith('/login');
        });
        expect(screen.queryByText('Dashboard Screen')).toBeNull();
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining(`${HF_BACKEND_API}/auth/me`),
            expect.objectContaining({ credentials: 'omit' }),
        );
    });

    it('renders protected content for authenticated user', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                user: {
                    id: 7,
                    email: 'auth@med.asu.edu.eg',
                    fullName: 'Authenticated User',
                },
            }),
        });

        renderProtectedTree();

        await waitFor(() => {
            expect(screen.getByText('Dashboard Screen')).toBeTruthy();
        });
        expect(replaceMock).not.toHaveBeenCalled();
    });

    it('redirects to login when boot auth fails with alumni restriction', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 403,
            json: async () => ({
                code: 'ALUMNI_ACCESS',
                error: 'Alumni account cannot access this portal.',
            }),
        });

        renderProtectedTree();

        await waitFor(() => {
            expect(replaceMock).toHaveBeenCalledWith('/login');
        });
    });

    it('does not retry /auth/me when HF returns 429 HTML', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 429,
            headers: {
                get: (name: string) => (name === 'content-type' ? 'text/html' : null),
            },
            text: async () => '<!doctype html><html><body>Rate limited</body></html>',
        });

        renderProtectedTree();

        await waitFor(() => {
            expect(replaceMock).toHaveBeenCalledWith('/login');
        });
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
