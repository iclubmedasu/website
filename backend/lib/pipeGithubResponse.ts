import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { Response } from 'express';

/**
 * Safely pipe a GitHub Contents API fetch body to an Express response.
 * Bare Readable.fromWeb(...).pipe(res) can crash the process on mid-stream
 * socket errors (unhandled 'error' on the Readable after the handler returns).
 */
export async function pipeGithubBodyToResponse(
    ghResponse: globalThis.Response,
    res: Response,
): Promise<void> {
    if (!ghResponse.body) {
        if (!res.headersSent) {
            res.status(502).json({ error: 'Empty upstream response' });
        }
        return;
    }

    const source = Readable.fromWeb(
        ghResponse.body as import('stream/web').ReadableStream,
    );

    try {
        await pipeline(source, res);
    } catch (err) {
        if (!res.headersSent) {
            res.status(502).json({ error: 'Failed to download file' });
        } else if (!res.destroyed) {
            res.destroy();
        }
        console.error('GitHub download stream failed:', err);
    }
}
