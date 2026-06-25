import type { Response } from 'express';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { sendConflictResponse } from './conflictResponse';

export function parseExpectedVersion(body: unknown): number | null {
    if (body === null || typeof body !== 'object') return null;
    const version = (body as { version?: unknown }).version;
    if (version === undefined || version === null) return null;
    const parsed = Number(version);
    return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

type OptimisticUpdateResult<T> =
    | { ok: true; record: T }
    | { ok: false; latest: T | null };

async function runOptimisticUpdate<T>(
    updateMany: () => Promise<{ count: number }>,
    forceUpdate: () => Promise<void>,
    fetchRecord: () => Promise<T | null>,
    expectedVersion: number | null,
): Promise<OptimisticUpdateResult<T>> {
    if (expectedVersion !== null) {
        const result = await updateMany();
        if (result.count === 0) {
            const latest = await fetchRecord();
            return { ok: false, latest };
        }
    } else {
        await forceUpdate();
    }

    const record = await fetchRecord();
    if (!record) {
        throw new Error('Record not found after update');
    }
    return { ok: true, record };
}

export async function updateEventRegistrationOptimistic<
    T extends Prisma.EventRegistrationGetPayload<{ include: Prisma.EventRegistrationInclude }>,
>(
    registrationId: number,
    expectedVersion: number | null,
    data: Prisma.EventRegistrationUpdateInput,
    include: Prisma.EventRegistrationInclude,
): Promise<OptimisticUpdateResult<T>> {
    return runOptimisticUpdate(
        () => prisma.eventRegistration.updateMany({
            where: { id: registrationId, version: expectedVersion ?? undefined },
            data: { ...data, version: { increment: 1 } },
        }),
        () => prisma.eventRegistration.update({
            where: { id: registrationId },
            data: { ...data, version: { increment: 1 } },
        }).then(() => undefined),
        () => prisma.eventRegistration.findFirst({ where: { id: registrationId }, include }) as Promise<T | null>,
        expectedVersion,
    );
}

export async function updateProjectOptimistic<
    T extends Prisma.ProjectGetPayload<{ include: Prisma.ProjectInclude }>,
>(
    projectId: number,
    expectedVersion: number | null,
    data: Prisma.ProjectUpdateInput,
    include: Prisma.ProjectInclude,
): Promise<OptimisticUpdateResult<T>> {
    return runOptimisticUpdate(
        () => prisma.project.updateMany({
            where: { id: projectId, version: expectedVersion ?? undefined },
            data: { ...data, version: { increment: 1 } },
        }),
        () => prisma.project.update({
            where: { id: projectId },
            data: { ...data, version: { increment: 1 } },
        }).then(() => undefined),
        () => prisma.project.findFirst({ where: { id: projectId }, include }) as Promise<T | null>,
        expectedVersion,
    );
}

export async function updateTaskOptimistic<
    T extends Prisma.TaskGetPayload<{ include: Prisma.TaskInclude }>,
>(
    taskId: number,
    expectedVersion: number | null,
    data: Prisma.TaskUpdateInput,
    include: Prisma.TaskInclude,
): Promise<OptimisticUpdateResult<T>> {
    return runOptimisticUpdate(
        () => prisma.task.updateMany({
            where: { id: taskId, version: expectedVersion ?? undefined },
            data: { ...data, version: { increment: 1 } },
        }),
        () => prisma.task.update({
            where: { id: taskId },
            data: { ...data, version: { increment: 1 } },
        }).then(() => undefined),
        () => prisma.task.findFirst({ where: { id: taskId }, include }) as Promise<T | null>,
        expectedVersion,
    );
}

export function respondVersionConflict<T>(
    res: Response,
    latest: T | null,
    message = 'This record was updated by someone else. Refresh and try again.',
): Response {
    return sendConflictResponse(res, 'VERSION_CONFLICT', message, latest ?? undefined);
}
