import express from 'express';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const batchStatusMocks = vi.hoisted(() => ({
    getEmailOutboxBatchStatus: vi.fn(),
}));

vi.mock('../../services/emailOutbox', () => batchStatusMocks);

import { JWT_SECRET } from '../../middleware/auth';
import emailOutboxRouter from '../../routes/emailOutbox';
import { authenticateToken } from '../../middleware/auth';

function createApp() {
    const app = express();
    app.use(express.json());
    app.use('/email-outbox', authenticateToken, emailOutboxRouter);
    return app;
}

function createToken() {
    return jwt.sign({
        memberId: 12,
        isDeveloper: true,
        isOfficer: false,
        isAdmin: false,
        isLeadership: false,
    }, JWT_SECRET);
}

describe('email-outbox batch status routes', () => {
    beforeEach(() => {
        batchStatusMocks.getEmailOutboxBatchStatus.mockResolvedValue({
            batchId: 'batch-1',
            total: 5,
            sent: 3,
            failed: 0,
            pending: 1,
            processing: 1,
        });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it('requires auth', async () => {
        const response = await request(createApp()).get('/email-outbox/batches/batch-1');
        expect(response.status).toBe(401);
    });

    it('returns batch status for authenticated users', async () => {
        const response = await request(createApp())
            .get('/email-outbox/batches/batch-1')
            .set('Authorization', `Bearer ${createToken()}`);

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
            batchId: 'batch-1',
            total: 5,
            sent: 3,
            failed: 0,
            pending: 1,
            processing: 1,
        });
        expect(batchStatusMocks.getEmailOutboxBatchStatus).toHaveBeenCalledWith('batch-1');
    });

    it('returns 404 when batch is missing', async () => {
        batchStatusMocks.getEmailOutboxBatchStatus.mockResolvedValueOnce(null);

        const response = await request(createApp())
            .get('/email-outbox/batches/missing')
            .set('Authorization', `Bearer ${createToken()}`);

        expect(response.status).toBe(404);
    });
});
