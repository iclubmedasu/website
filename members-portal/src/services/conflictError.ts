import type { ConflictCode, ConflictErrorResponse } from '@/types/backend-contracts';

export class ConflictError extends Error {
    readonly code: ConflictCode;
    readonly latest?: unknown;

    constructor(payload: ConflictErrorResponse) {
        super(payload.error);
        this.name = 'ConflictError';
        this.code = payload.code;
        this.latest = payload.latest;
    }
}

export function isConflictError(error: unknown): error is ConflictError {
    return error instanceof ConflictError;
}
