import { describe, expect, it } from 'vitest';
import {
    RATE_LIMIT_FALLBACK_MESSAGE,
    safeParseJsonResponse,
} from '../api';

function mockResponse(
    status: number,
    body: string,
    headers: Record<string, string> = {},
): Response {
    return {
        status,
        ok: status >= 200 && status < 300,
        headers: {
            get: (name: string) => headers[name.toLowerCase()] ?? headers[name] ?? null,
        },
        text: async () => body,
    } as Response;
}

describe('safeParseJsonResponse', () => {
    it('maps 429 HTML to rate-limit copy, not starting-up', async () => {
        const response = mockResponse(
            429,
            '<!doctype html><html><body>Rate limited</body></html>',
            { 'content-type': 'text/html' },
        );

        const parsed = await safeParseJsonResponse(response);

        expect(parsed.ok).toBe(false);
        if (!parsed.ok) {
            expect(parsed.error).toBe(RATE_LIMIT_FALLBACK_MESSAGE);
            expect(parsed.error).not.toContain('starting up');
        }
    });

    it('uses Retry-After seconds on 429 HTML', async () => {
        const response = mockResponse(
            429,
            '<html>blocked</html>',
            { 'Retry-After': '45' },
        );

        const parsed = await safeParseJsonResponse(response);

        expect(parsed.ok).toBe(false);
        if (!parsed.ok) {
            expect(parsed.error).toBe('Too many requests — try again in 45s');
        }
    });

    it('keeps starting-up copy for 503 HTML cold-start pages', async () => {
        const response = mockResponse(
            503,
            '<!doctype html><html><body>Starting</body></html>',
            { 'content-type': 'text/html' },
        );

        const parsed = await safeParseJsonResponse(response);

        expect(parsed.ok).toBe(false);
        if (!parsed.ok) {
            expect(parsed.error).toContain('starting up');
        }
    });

    it('parses valid JSON bodies', async () => {
        const response = mockResponse(200, '{"exists":true}', {
            'content-type': 'application/json',
        });

        const parsed = await safeParseJsonResponse<{ exists: boolean }>(response);

        expect(parsed.ok).toBe(true);
        if (parsed.ok) {
            expect(parsed.data.exists).toBe(true);
        }
    });
});
