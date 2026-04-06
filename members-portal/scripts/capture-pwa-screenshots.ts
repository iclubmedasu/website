/**
 * Captures PWA screenshots for manifest.json
 * Run with: npx tsx scripts/capture-pwa-screenshots.ts
 *
 * Requires the members portal to be running on port 3001
 * and a valid test account set in environment variables.
 *
 * Screenshots are saved to public/screenshots/
 */

import { chromium, type BrowserContext, type Page } from '@playwright/test'
import path from 'path'
import fs from 'fs'

const PORTAL_URL = process.env.PORTAL_URL || 'http://localhost:3001'
const TEST_EMAIL = process.env.TEST_EMAIL || 'dev@iclub.com'
const TEST_PASSWORD = process.env.TEST_PASSWORD || ''
const SCREENSHOTS_DIR = path.join(__dirname, '../public/screenshots')

async function performLogin(page: Page) {
    await page.goto(`${PORTAL_URL}/login`, { waitUntil: 'networkidle' })

    // Step 1: identifier input + continue
    await page.getByPlaceholder('e.g. 213256 or name@med.asu.edu.eg').fill(TEST_EMAIL)
    await page.getByRole('button', { name: 'Continue' }).click()

    // Step 2: password + sign in
    await page.waitForURL(/\/login$/, { timeout: 10000 })
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD)
    await page.getByRole('button', { name: /^Sign In$/ }).click()

    await page.waitForURL('**/dashboard', { timeout: 10000 })
    await page.waitForTimeout(1000) // Wait for animations
}

async function captureViewportScreenshot(context: BrowserContext, filename: string) {
    const page = await context.newPage()
    await performLogin(page)

    await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, filename),
        fullPage: false
    })

    await context.close()
}

async function captureScreenshots() {
    // Ensure screenshots directory exists
    if (!fs.existsSync(SCREENSHOTS_DIR)) {
        fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true })
    }

    const browser = await chromium.launch()

    try {
        // Desktop screenshot (1280x720)
        console.log('Capturing desktop screenshot...')
        const desktopContext = await browser.newContext({
            viewport: { width: 1280, height: 720 }
        })

        await captureViewportScreenshot(desktopContext, 'desktop.png')
        console.log('✓ Desktop screenshot saved')

        // Mobile screenshot (390x844 — iPhone 14)
        console.log('Capturing mobile screenshot...')
        const mobileContext = await browser.newContext({
            viewport: { width: 390, height: 844 },
            deviceScaleFactor: 3,
            isMobile: true,
            userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'
        })

        await captureViewportScreenshot(mobileContext, 'mobile.png')
        console.log('✓ Mobile screenshot saved')

        console.log('\nAll screenshots captured successfully.')
        console.log(`Saved to: ${SCREENSHOTS_DIR}`)
    } catch (error) {
        console.error('Screenshot capture failed:', error)
        console.log('\nMake sure:')
        console.log('1. The portal is running: pnpm dev:portal')
        console.log('2. TEST_EMAIL and TEST_PASSWORD are set in .env')
    } finally {
        await browser.close()
    }
}

captureScreenshots()
