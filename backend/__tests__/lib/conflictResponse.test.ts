import { describe, expect, it } from 'vitest';
import { Prisma } from '@prisma/client';
import { mapPrismaErrorToConflict } from '../../lib/conflictResponse';

describe('conflictResponse', () => {
    it('maps duplicate registration email conflicts', () => {
        const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: 'test',
            meta: { target: ['eventId', 'email'] },
        });

        expect(mapPrismaErrorToConflict(error)).toEqual({
            error: 'Already registered for this event',
            code: 'DUPLICATE',
            latest: undefined,
        });
    });

    it('maps duplicate attendance day conflicts', () => {
        const error = new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
            code: 'P2002',
            clientVersion: 'test',
            meta: { target: ['registrationId', 'eventDay'] },
        });

        expect(mapPrismaErrorToConflict(error)).toEqual({
            error: 'Already checked in for this day',
            code: 'ALREADY_CHECKED_IN',
            latest: undefined,
        });
    });
});
