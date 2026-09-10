import { Router, Request, Response } from 'express';
import { getEmailOutboxBatchStatus } from '../services/emailOutbox';

const router = Router();

router.get('/batches/:batchId', async (req: Request, res: Response) => {
    try {
        const batchId = String(req.params.batchId ?? '').trim();
        if (!batchId) {
            return res.status(400).json({ error: 'Invalid batch id' });
        }

        const status = await getEmailOutboxBatchStatus(batchId);
        if (!status) {
            return res.status(404).json({ error: 'Batch not found' });
        }

        return res.json(status);
    } catch (error) {
        console.error(`GET /email-outbox/batches/${req.params.batchId} error:`, error);
        return res.status(500).json({ error: 'Failed to load email batch status' });
    }
});

export default router;
