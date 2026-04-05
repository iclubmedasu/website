import React from 'react'
import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AuthProvider, useAuth } from '../AuthContext'

function buildAuthUser(overrides: Record<string, unknown> = {}) {
    return {
        id: 1,
        email: 'member@med.asu.edu.eg',
        fullName: 'Test Member',
        ...overrides
    }
}

const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
)

describe('AuthContext integration', () => {
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

    it('hydrates auth state from cookie session via /auth/me', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: true,
            status: 200,
            json: async () => ({ user: buildAuthUser() })
        })

        const { result } = renderHook(() => useAuth(), { wrapper })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.user?.fullName).toBe('Test Member')
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/auth/me'),
            expect.objectContaining({
                credentials: 'include'
            })
        )
    })

    it('marks alumni and clears token when /auth/me denies with ALUMNI_ACCESS', async () => {
        fetchMock.mockResolvedValueOnce({
            ok: false,
            status: 403,
            json: async () => ({ code: 'ALUMNI_ACCESS', error: 'Your account has alumni-only access.' })
        })

        const { result } = renderHook(() => useAuth(), { wrapper })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        expect(result.current.isAlumni).toBe(true)
        expect(result.current.user).toBeNull()
    })

    it('updates user and refreshes auth state on successful login', async () => {
        fetchMock
            .mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({ error: 'Authentication required' })
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ user: buildAuthUser({ fullName: 'Login User' }) })
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ user: buildAuthUser({ fullName: 'Hydrated User' }) })
            })

        const { result } = renderHook(() => useAuth(), { wrapper })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        let loginResult: { success: boolean; error?: string; code?: string } | undefined
        await act(async () => {
            loginResult = await result.current.login('member@med.asu.edu.eg', 'password123')
        })

        expect(loginResult).toEqual({ success: true })

        await waitFor(() => {
            expect(result.current.user?.fullName).toBe('Hydrated User')
        })
    })

    it('returns alumni login error shape and sets alumni state', async () => {
        fetchMock
            .mockResolvedValueOnce({
                ok: false,
                status: 401,
                json: async () => ({ error: 'Authentication required' })
            })
            .mockResolvedValueOnce({
                ok: false,
                status: 403,
                json: async () => ({ code: 'ALUMNI_ACCESS', error: 'Alumni access blocked.' })
            })

        const { result } = renderHook(() => useAuth(), { wrapper })

        await waitFor(() => {
            expect(result.current.loading).toBe(false)
        })

        let loginResult: { success: boolean; error?: string; code?: string } | undefined
        await act(async () => {
            loginResult = await result.current.login('alumni@med.asu.edu.eg', 'password123')
        })

        expect(loginResult).toEqual({
            success: false,
            error: 'Alumni access blocked.',
            code: 'ALUMNI_ACCESS'
        })
        expect(result.current.isAlumni).toBe(true)
        expect(result.current.user).toBeNull()
    })

    it('logout clears active user and calls logout endpoint', async () => {
        fetchMock
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ user: buildAuthUser({ fullName: 'Before Logout' }) })
            })
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                json: async () => ({ success: true })
            })

        const { result } = renderHook(() => useAuth(), { wrapper })

        await waitFor(() => {
            expect(result.current.user?.fullName).toBe('Before Logout')
        })

        act(() => {
            result.current.logout()
        })

        expect(result.current.user).toBeNull()
        expect(result.current.isAlumni).toBe(false)
        await waitFor(() => {
            expect(fetchMock).toHaveBeenNthCalledWith(
                2,
                expect.stringContaining('/auth/logout'),
                expect.objectContaining({
                    method: 'POST',
                    credentials: 'include'
                })
            )
        })
    })
})
