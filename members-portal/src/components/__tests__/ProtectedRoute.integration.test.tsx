import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '../../context/AuthContext'
import ProtectedRoute from '../ProtectedRoute'

function renderProtectedTree(initialPath: string) {
    return render(
        <AuthProvider>
            <MemoryRouter initialEntries={[initialPath]}>
                <Routes>
                    <Route path="/login" element={<div>Login Screen</div>} />
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute>
                                <div>Dashboard Screen</div>
                            </ProtectedRoute>
                        }
                    />
                </Routes>
            </MemoryRouter>
        </AuthProvider>
    )
}

describe('ProtectedRoute integration', () => {
    const fetchMock = vi.fn()

    beforeEach(() => {
        localStorage.clear()
        fetchMock.mockReset()
        vi.stubGlobal('fetch', fetchMock)
    })

    afterEach(() => {
        vi.unstubAllGlobals()
        localStorage.clear()
    })

    it('redirects to login when no token is present', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 401,
            json: async () => ({ error: 'Authentication required' })
        })

        renderProtectedTree('/dashboard')

        await waitFor(() => {
            expect(screen.getByText('Login Screen')).toBeTruthy()
        })
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/auth/me'),
            expect.objectContaining({ credentials: 'include' })
        )
    })

    it('renders protected content for authenticated user', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({
                user: {
                    id: 7,
                    email: 'auth@med.asu.edu.eg',
                    fullName: 'Authenticated User'
                }
            })
        })

        renderProtectedTree('/dashboard')

        await waitFor(() => {
            expect(screen.getByText('Dashboard Screen')).toBeTruthy()
        })
    })

    it('redirects to login when boot auth fails with alumni restriction', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 403,
            json: async () => ({
                code: 'ALUMNI_ACCESS',
                error: 'Alumni account cannot access this portal.'
            })
        })

        renderProtectedTree('/dashboard')

        await waitFor(() => {
            expect(screen.getByText('Login Screen')).toBeTruthy()
        })
    })
})
