import { Prisma } from '@prisma/client';
import { prisma } from '../db';

function normalizePatch(patch: unknown): Record<string, unknown> {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) {
        return {};
    }
    return patch as Record<string, unknown>;
}

export async function mergeRegistrationCustomFieldValues(
    registrationId: number,
    patch: unknown,
    options?: {
        tx?: Prisma.TransactionClient;
        incrementVersion?: boolean;
    },
): Promise<void> {
    const normalizedPatch = normalizePatch(patch);
    if (Object.keys(normalizedPatch).length === 0) {
        return;
    }

    const tx = options?.tx ?? prisma;
    const incrementVersion = options?.incrementVersion !== false;

    if (incrementVersion) {
        await tx.$executeRaw`
            UPDATE "EventRegistration"
            SET
                "customFieldValues" = COALESCE("customFieldValues", '{}'::jsonb) || ${JSON.stringify(normalizedPatch)}::jsonb,
                "version" = "version" + 1,
                "updatedAt" = NOW()
            WHERE "id" = ${registrationId}
        `;
        return;
    }

    await tx.$executeRaw`
        UPDATE "EventRegistration"
        SET
            "customFieldValues" = COALESCE("customFieldValues", '{}'::jsonb) || ${JSON.stringify(normalizedPatch)}::jsonb,
            "updatedAt" = NOW()
        WHERE "id" = ${registrationId}
    `;
}

export async function incrementRegistrationVersion(registrationId: number): Promise<void> {
    await prisma.eventRegistration.update({
        where: { id: registrationId },
        data: { version: { increment: 1 } },
    });
}
