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

    beforeEach(() => {
        replaceMock.mockReset();
        localStorage.clear();
        fetchMock.mockReset();
        vi.stubGlobal('fetch', fetchMock);
    });

    afterEach(() => {
        vi.unstubAllGlobals();
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
            expect.stringContaining('/auth/me'),
            expect.objectContaining({ credentials: 'include' }),
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
});
