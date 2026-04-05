import { describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { render, screen } from '@testing-library/react'

vi.mock('../../context/AuthContext', () => ({
    useAuth: vi.fn()
}))

import { useAuth } from '../../context/AuthContext'
import AdminProtectedRoute from '../AdminProtectedRoute'
import ProtectedRoute from '../ProtectedRoute'

function renderWithRouting(element: React.ReactNode, initialPath: string): void {
    render(
        <MemoryRouter initialEntries={[initialPath]}>
            <Routes>
                <Route path="/protected" element={element} />
                <Route path="/login" element={<div>Login Screen</div>} />
                <Route path="/teams" element={<div>Teams Screen</div>} />
            </Routes>
        </MemoryRouter>
    )
}

describe('ProtectedRoute', () => {
    it('shows loading state while auth is loading', () => {
        vi.mocked(useAuth).mockReturnValue({ user: null, loading: true } as never)

        renderWithRouting(
            <ProtectedRoute>
                <div>Secure Content</div>
            </ProtectedRoute>,
            '/protected'
        )

        expect(screen.queryByText('Loading...')).not.toBeNull()
    })

    it('redirects unauthenticated users to login', () => {
        vi.mocked(useAuth).mockReturnValue({ user: null, loading: false } as never)

        renderWithRouting(
            <ProtectedRoute>
                <div>Secure Content</div>
            </ProtectedRoute>,
            '/protected'
        )

        expect(screen.queryByText('Login Screen')).not.toBeNull()
    })

    it('renders protected content for authenticated users', () => {
        vi.mocked(useAuth).mockReturnValue({
            user: { id: 1, isAdmin: false },
            loading: false
        } as never)

        renderWithRouting(
            <ProtectedRoute>
                <div>Secure Content</div>
            </ProtectedRoute>,
            '/protected'
        )

        expect(screen.queryByText('Secure Content')).not.toBeNull()
    })
})

describe('AdminProtectedRoute', () => {
    it('redirects to login when user is missing', () => {
        vi.mocked(useAuth).mockReturnValue({ user: null } as never)

        renderWithRouting(
            <AdminProtectedRoute>
                <div>Admin Content</div>
            </AdminProtectedRoute>,
            '/protected'
        )

        expect(screen.queryByText('Login Screen')).not.toBeNull()
    })

    it('redirects non-privileged users to teams', () => {
        vi.mocked(useAuth).mockReturnValue({
            user: {
                isDeveloper: false,
                isOfficer: false,
                isAdmin: false,
                isLeadership: false
            }
        } as never)

        renderWithRouting(
            <AdminProtectedRoute>
                <div>Admin Content</div>
            </AdminProtectedRoute>,
            '/protected'
        )

        expect(screen.queryByText('Teams Screen')).not.toBeNull()
    })

    it('renders admin content for privileged users', () => {
        vi.mocked(useAuth).mockReturnValue({
            user: {
                isDeveloper: false,
                isOfficer: false,
                isAdmin: true,
                isLeadership: false
            }
        } as never)

        renderWithRouting(
            <AdminProtectedRoute>
                <div>Admin Content</div>
            </AdminProtectedRoute>,
            '/protected'
        )

        expect(screen.queryByText('Admin Content')).not.toBeNull()
    })
})
