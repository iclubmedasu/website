import { expect, type Page, test } from '@playwright/test'

const TEST_EMAIL = process.env.TEST_EMAIL ?? 'dev@iclub.com'
const TEST_PASSWORD = process.env.TEST_PASSWORD ?? 'dev123456'

type MockAuthState = {
    authenticated: boolean
}

function buildMockUser(email: string) {
    return {
        id: 0,
        email,
        fullName: 'Developer',
        isDeveloper: true,
        isOfficer: true,
        isAdmin: false,
        isLeadership: false,
        isSpecial: false,
        teamIds: [],
        leadershipTeamIds: [],
        assignmentStatus: 'ASSIGNED',
        isActive: true
    }
}

function buildCorsHeaders(origin: string | null) {
    return {
        'content-type': 'application/json',
        'access-control-allow-origin': origin ?? 'http://127.0.0.1:3001',
        'access-control-allow-credentials': 'true',
        'access-control-allow-headers': 'content-type,authorization',
        'access-control-allow-methods': 'GET,POST,OPTIONS'
    }
}

async function mockAuthApi(page: Page): Promise<MockAuthState> {
    const state: MockAuthState = { authenticated: false }
    const user = buildMockUser(TEST_EMAIL)

    await page.route('**/api/auth/**', async (route) => {
        const request = route.request()
        const method = request.method()
        const pathname = new URL(request.url()).pathname
        const origin = await request.headerValue('origin')

        if (method === 'OPTIONS') {
            await route.fulfill({
                status: 204,
                headers: buildCorsHeaders(origin),
                body: ''
            })
            return
        }

        if (method === 'POST' && pathname.endsWith('/auth/check-email')) {
            const body = request.postDataJSON() as { email?: string } | null
            const identifier = (body?.email ?? '').trim()

            if (identifier === TEST_EMAIL) {
                await route.fulfill({
                    status: 200,
                    headers: buildCorsHeaders(origin),
                    body: JSON.stringify({
                        exists: true,
                        needsSetup: false,
                        email: TEST_EMAIL,
                        message: 'Account exists. Please login.'
                    })
                })
                return
            }

            await route.fulfill({
                status: 200,
                headers: buildCorsHeaders(origin),
                body: JSON.stringify({
                    exists: false,
                    needsSetup: false,
                    message: 'Email or Student ID not found. Please contact admin.'
                })
            })
            return
        }

        if (method === 'POST' && pathname.endsWith('/auth/login')) {
            const body = request.postDataJSON() as { email?: string; password?: string } | null
            const email = (body?.email ?? '').trim()
            const password = body?.password ?? ''

            if (email === TEST_EMAIL && password === TEST_PASSWORD) {
                state.authenticated = true
                await route.fulfill({
                    status: 200,
                    headers: buildCorsHeaders(origin),
                    body: JSON.stringify({ user })
                })
                return
            }

            await route.fulfill({
                status: 401,
                headers: buildCorsHeaders(origin),
                body: JSON.stringify({ error: 'Invalid credentials' })
            })
            return
        }

        if (method === 'GET' && pathname.endsWith('/auth/me')) {
            if (state.authenticated) {
                await route.fulfill({
                    status: 200,
                    headers: buildCorsHeaders(origin),
                    body: JSON.stringify({ user })
                })
            } else {
                await route.fulfill({
                    status: 401,
                    headers: buildCorsHeaders(origin),
                    body: JSON.stringify({ error: 'No token provided' })
                })
            }
            return
        }

        if (method === 'POST' && pathname.endsWith('/auth/logout')) {
            state.authenticated = false
            await route.fulfill({
                status: 200,
                headers: buildCorsHeaders(origin),
                body: JSON.stringify({ success: true })
            })
            return
        }

        await route.fallback()
    })

    return state
}

async function submitIdentifier(page: Page, identifier: string) {
    await page.getByPlaceholder('e.g. 213256 or name@med.asu.edu.eg').fill(identifier)
    await page.getByRole('button', { name: 'Continue' }).click()
}

async function signIn(page: Page, email: string, password: string) {
    await page.goto('/login')
    await submitIdentifier(page, email)
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible()
    await expect(page.getByPlaceholder('••••••••')).toBeVisible()
    await page.getByPlaceholder('••••••••').fill(password)
    await page.getByRole('button', { name: 'Sign In' }).click()
}

test('anonymous user lands on login surface', async ({ page }) => {
    await mockAuthApi(page)
    await page.goto('/')

    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByPlaceholder('e.g. 213256 or name@med.asu.edu.eg')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
})

test('valid login redirects to dashboard using test credentials', async ({ page }) => {
    await mockAuthApi(page)
    await signIn(page, TEST_EMAIL, TEST_PASSWORD)

    await expect(page).toHaveURL(/\/dashboard/)
    await expect(page.getByRole('button', { name: /logout/i })).toBeVisible()
})

test('invalid login shows error message', async ({ page }) => {
    await mockAuthApi(page)
    await signIn(page, TEST_EMAIL, 'wrong-password')

    await expect(page).toHaveURL(/\/login/)
    await expect(page.locator('.error-message')).toContainText('Invalid credentials')
})

test('protected routes redirect when logged out', async ({ page }) => {
    await mockAuthApi(page)
    await page.goto('/teams')

    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible()
})

test('session invalidation redirects protected routes to login', async ({ page }) => {
    const authState = await mockAuthApi(page)
    await signIn(page, TEST_EMAIL, TEST_PASSWORD)
    await expect(page).toHaveURL(/\/dashboard/)

    authState.authenticated = false

    await page.goto('/projects')
    await expect(page).toHaveURL(/\/login/)
})

test('mobile navigation opens, expands submenu, and auto-closes after route click', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mockAuthApi(page)
    await signIn(page, TEST_EMAIL, TEST_PASSWORD)

    const openMenuButton = page.getByRole('button', { name: 'Open navigation menu' })
    await expect(openMenuButton).toBeVisible()

    await openMenuButton.click()
    await expect(page.getByRole('button', { name: 'Close navigation menu' })).toBeVisible()

    await page.getByRole('button', { name: 'Personnel' }).click()
    await page.getByRole('link', { name: 'Members' }).click()

    await expect(page).toHaveURL(/\/members/)
    await expect(page.getByRole('button', { name: 'Open navigation menu' })).toBeVisible()
})
