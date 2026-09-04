import { Readable } from 'stream';
import { pipeline } from 'stream/promises';
import type { Response } from 'express';

/**
 * Client disconnected (navigation, HMR, process kill) while we were still piping.
 * These are expected; logging stacks makes them look like crashes.
 */
export function isClientAbortStreamError(err: unknown, res: Response): boolean {
    if (res.destroyed || (res as { aborted?: boolean }).aborted) {
        return true;
    }

    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (
        code === 'ERR_STREAM_PREMATURE_CLOSE' ||
        code === 'ECONNRESET' ||
        code === 'EPIPE'
    ) {
        return true;
    }

    if (err instanceof Error && err.name === 'AbortError') {
        return true;
    }

    return false;
}

function streamFailureLabel(err: unknown): string {
    const code = (err as NodeJS.ErrnoException | undefined)?.code;
    if (code) return code;
    if (err instanceof Error) return err.name || err.message;
    return String(err);
}

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
        if (isClientAbortStreamError(err, res)) {
            return;
        }

        if (!res.headersSent) {
            res.status(502).json({ error: 'Failed to download file' });
        } else if (!res.destroyed) {
            res.destroy();
        }
        console.warn(`GitHub download stream failed (${streamFailureLabel(err)})`);
    }
}
