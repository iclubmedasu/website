export type ConflictCode =
    | 'VERSION_CONFLICT'
    | 'DUPLICATE'
    | 'ALREADY_CHECKED_IN'
    | 'CAPACITY_REACHED';

export interface ConflictErrorResponse {
    error: string;
    code: ConflictCode;
    latest?: unknown;
}
