'use client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

const replaceMock = vi.fn();

vi.mock('next/navigation', () => ({
    useRouter: () => ({ replace: replaceMock }),
}));

vi.mock('@/context/AuthContext', () => ({
    useAuth: vi.fn(),
}));

import { useAuth } from '@/context/AuthContext';
import AdminProtectedRoute from '@/components/AdminProtectedRoute';
import ProtectedRoute from '@/components/ProtectedRoute';

describe('ProtectedRoute', () => {
    beforeEach(() => {
        replaceMock.mockReset();
    });

    it('shows loading state while auth is loading', () => {
        vi.mocked(useAuth).mockReturnValue({ user: null, loading: true } as never);

        render(
            <ProtectedRoute>
                <div>Secure Content</div>
            </ProtectedRoute>,
        );

        expect(screen.queryByText('Loading...')).not.toBeNull();
    });

    it('redirects unauthenticated users to login', async () => {
        vi.mocked(useAuth).mockReturnValue({ user: null, loading: false } as never);

        render(
            <ProtectedRoute>
                <div>Secure Content</div>
            </ProtectedRoute>,
        );

        await waitFor(() => {
            expect(replaceMock).toHaveBeenCalledWith('/login');
        });
        expect(screen.queryByText('Secure Content')).toBeNull();
    });

    it('renders protected content for authenticated users', async () => {
        vi.mocked(useAuth).mockReturnValue({
            user: { id: 1, isAdmin: false },
            loading: false,
        } as never);

        render(
            <ProtectedRoute>
                <div>Secure Content</div>
            </ProtectedRoute>,
        );

        await waitFor(() => {
            expect(screen.queryByText('Secure Content')).not.toBeNull();
        });
        expect(replaceMock).not.toHaveBeenCalled();
    });
});

describe('AdminProtectedRoute', () => {
    beforeEach(() => {
        replaceMock.mockReset();
    });

    it('redirects to login when user is missing', async () => {
        vi.mocked(useAuth).mockReturnValue({ user: null, loading: false } as never);

        render(
            <AdminProtectedRoute>
                <div>Admin Content</div>
            </AdminProtectedRoute>,
        );

        await waitFor(() => {
            expect(replaceMock).toHaveBeenCalledWith('/login');
        });
    });

    it('redirects non-privileged users to teams', async () => {
        vi.mocked(useAuth).mockReturnValue({
            user: {
                isDeveloper: false,
                isOfficer: false,
                isAdmin: false,
                isLeadership: false,
            },
            loading: false,
        } as never);

        render(
            <AdminProtectedRoute>
                <div>Admin Content</div>
            </AdminProtectedRoute>,
        );

        await waitFor(() => {
            expect(replaceMock).toHaveBeenCalledWith('/teams');
        });
    });

    it('renders admin content for privileged users', async () => {
        vi.mocked(useAuth).mockReturnValue({
            user: {
                isDeveloper: false,
                isOfficer: false,
                isAdmin: true,
                isLeadership: false,
            },
            loading: false,
        } as never);

        render(
            <AdminProtectedRoute>
                <div>Admin Content</div>
            </AdminProtectedRoute>,
        );

        await waitFor(() => {
            expect(screen.queryByText('Admin Content')).not.toBeNull();
        });
        expect(replaceMock).not.toHaveBeenCalled();
    });
});
