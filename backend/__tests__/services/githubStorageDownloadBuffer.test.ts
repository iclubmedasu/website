import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('downloadFileBuffer', () => {
    const originalOwner = process.env.GITHUB_STORAGE_OWNER;
    const originalRepo = process.env.GITHUB_STORAGE_REPO;
    const originalToken = process.env.GITHUB_STORAGE_TOKEN;

    beforeEach(() => {
        vi.resetModules();
        process.env.GITHUB_STORAGE_OWNER = 'test-owner';
        process.env.GITHUB_STORAGE_REPO = 'test-repo';
        process.env.GITHUB_STORAGE_TOKEN = 'test-token';
    });

    afterEach(() => {
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        if (originalOwner === undefined) delete process.env.GITHUB_STORAGE_OWNER;
        else process.env.GITHUB_STORAGE_OWNER = originalOwner;
        if (originalRepo === undefined) delete process.env.GITHUB_STORAGE_REPO;
        else process.env.GITHUB_STORAGE_REPO = originalRepo;
        if (originalToken === undefined) delete process.env.GITHUB_STORAGE_TOKEN;
        else process.env.GITHUB_STORAGE_TOKEN = originalToken;
    });

    it('classifies undici socket aborts as retriable', async () => {
        const { isRetriableGithubDownloadError } = await import(
            '../../services/githubStorageService'
        );

        expect(
            isRetriableGithubDownloadError(
                Object.assign(new TypeError('terminated'), {
                    cause: { code: 'UND_ERR_SOCKET', message: 'other side closed' },
                }),
            ),
        ).toBe(true);
        expect(isRetriableGithubDownloadError(new Error('other side closed'))).toBe(true);
        expect(isRetriableGithubDownloadError(new Error('Storage download failed'))).toBe(
            false,
        );
    });

    it('retries once on socket abort, then succeeds', async () => {
        const socketAbort = Object.assign(new TypeError('terminated'), {
            cause: { code: 'UND_ERR_SOCKET', message: 'other side closed' },
        });

        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce({
                ok: true,
                status: 200,
                text: async () => '',
                arrayBuffer: async () => {
                    throw socketAbort;
                },
            })
            .mockResolvedValueOnce(
                new Response(Buffer.from('ticket-bytes'), {
                    status: 200,
                    headers: { 'content-type': 'image/png' },
                }),
            );

        vi.stubGlobal('fetch', fetchMock);

        const { downloadFileBuffer } = await import('../../services/githubStorageService');
        const buffer = await downloadFileBuffer('events/1/ticket-header.png');

        expect(buffer.toString()).toBe('ticket-bytes');
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('does not retry non-retriable failures', async () => {
        const fetchMock = vi.fn().mockResolvedValue({
            ok: false,
            status: 404,
            text: async () => 'missing',
        });
        vi.stubGlobal('fetch', fetchMock);
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const { downloadFileBuffer } = await import('../../services/githubStorageService');

        await expect(downloadFileBuffer('events/1/missing.png')).rejects.toThrow(
            /File not found in storage/i,
        );
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });
});
