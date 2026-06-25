import type { Response } from 'express';
import { Prisma } from '@prisma/client';

export type ConflictCode =
    | 'VERSION_CONFLICT'
    | 'DUPLICATE'
    | 'ALREADY_CHECKED_IN'
    | 'CAPACITY_REACHED';

export interface ConflictPayload {
    error: string;
    code: ConflictCode;
    latest?: unknown;
}

export function sendConflictResponse(
    res: Response,
    code: ConflictCode,
    error: string,
    latest?: unknown,
): Response {
    const body: ConflictPayload = { error, code };
    if (latest !== undefined) {
        body.latest = latest;
    }
    return res.status(409).json(body);
}

function isPrismaUniqueViolation(error: unknown): boolean {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

function uniqueTargetIncludes(error: unknown, fragment: string): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') {
        return false;
    }
    const target = error.meta?.target;
    if (Array.isArray(target)) {
        return target.some((entry) => String(entry).includes(fragment));
    }
    return String(target ?? '').includes(fragment);
}

export function mapPrismaErrorToConflict(error: unknown, latest?: unknown): ConflictPayload | null {
    if (!isPrismaUniqueViolation(error)) {
        return null;
    }

    if (uniqueTargetIncludes(error, 'registrationId') && uniqueTargetIncludes(error, 'eventDay')) {
        return {
            error: 'Already checked in for this day',
            code: 'ALREADY_CHECKED_IN',
            latest,
        };
    }

    if (uniqueTargetIncludes(error, 'eventId') && uniqueTargetIncludes(error, 'email')) {
        return {
            error: 'Already registered for this event',
            code: 'DUPLICATE',
            latest,
        };
    }

    if (uniqueTargetIncludes(error, 'eventId') && uniqueTargetIncludes(error, 'memberId')) {
        return {
            error: 'Already registered for this event',
            code: 'DUPLICATE',
            latest,
        };
    }

    return {
        error: 'A conflicting record already exists',
        code: 'DUPLICATE',
        latest,
    };
}

export function respondWithPrismaConflict(
    res: Response,
    error: unknown,
    latest?: unknown,
): Response | null {
    const mapped = mapPrismaErrorToConflict(error, latest);
    if (!mapped) return null;
    return sendConflictResponse(res, mapped.code, mapped.error, mapped.latest);
}
