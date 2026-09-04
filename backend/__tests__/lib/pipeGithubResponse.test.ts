import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Response } from 'express';

const pipelineMock = vi.fn();

vi.mock('stream/promises', () => ({
    pipeline: (...args: unknown[]) => pipelineMock(...args),
}));

vi.mock('stream', async () => {
    const actual = await vi.importActual<typeof import('stream')>('stream');
    return {
        ...actual,
        Readable: {
            ...actual.Readable,
            fromWeb: vi.fn(() => ({ mocked: true })),
        },
    };
});

import {
    isClientAbortStreamError,
    pipeGithubBodyToResponse,
} from '../../lib/pipeGithubResponse';

function mockRes(overrides: Partial<Response> & Record<string, unknown> = {}): Response {
    return {
        headersSent: false,
        destroyed: false,
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
        ...overrides,
    } as unknown as Response;
}

describe('isClientAbortStreamError', () => {
    it('treats ERR_STREAM_PREMATURE_CLOSE as a client abort', () => {
        const err = Object.assign(new Error('premature close'), {
            code: 'ERR_STREAM_PREMATURE_CLOSE',
        });
        expect(isClientAbortStreamError(err, mockRes())).toBe(true);
    });

    it('treats ECONNRESET and EPIPE as client aborts', () => {
        expect(
            isClientAbortStreamError(
                Object.assign(new Error('reset'), { code: 'ECONNRESET' }),
                mockRes(),
            ),
        ).toBe(true);
        expect(
            isClientAbortStreamError(
                Object.assign(new Error('pipe'), { code: 'EPIPE' }),
                mockRes(),
            ),
        ).toBe(true);
    });

    it('treats destroyed or aborted responses as client aborts', () => {
        expect(
            isClientAbortStreamError(new Error('anything'), mockRes({ destroyed: true })),
        ).toBe(true);
        expect(
            isClientAbortStreamError(new Error('anything'), mockRes({ aborted: true })),
        ).toBe(true);
    });

    it('does not treat generic upstream errors as client aborts', () => {
        expect(
            isClientAbortStreamError(
                Object.assign(new TypeError('terminated'), { code: 'UND_ERR_SOCKET' }),
                mockRes(),
            ),
        ).toBe(false);
    });
});

describe('pipeGithubBodyToResponse', () => {
    beforeEach(() => {
        pipelineMock.mockReset();
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('stays quiet on client premature close', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        pipelineMock.mockRejectedValue(
            Object.assign(new Error('Premature close'), {
                code: 'ERR_STREAM_PREMATURE_CLOSE',
            }),
        );

        const res = mockRes();
        await pipeGithubBodyToResponse(
            { body: {} } as globalThis.Response,
            res,
        );

        expect(warn).not.toHaveBeenCalled();
        expect(error).not.toHaveBeenCalled();
        expect(res.status).not.toHaveBeenCalled();
        expect(res.destroy).not.toHaveBeenCalled();
    });

    it('logs a one-line warn for real upstream failures', async () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        const error = vi.spyOn(console, 'error').mockImplementation(() => {});
        pipelineMock.mockRejectedValue(
            Object.assign(new TypeError('terminated'), { code: 'UND_ERR_SOCKET' }),
        );

        const res = mockRes({ headersSent: true });
        await pipeGithubBodyToResponse(
            { body: {} } as globalThis.Response,
            res,
        );

        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0][0]).toBe('GitHub download stream failed (UND_ERR_SOCKET)');
        expect(error).not.toHaveBeenCalled();
        expect(res.destroy).toHaveBeenCalledTimes(1);
    });
});
