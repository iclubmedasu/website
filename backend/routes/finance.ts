import express, { Request, Response } from "express";
import {
    createAccount,
    createLiability,
    createScheduledItem,
    createTransaction,
    deleteTransaction,
    FinanceValidationError,
    getFinanceDashboard,
    listAccounts,
    listTransactions,
    updateAccount,
    updateLiability,
    updateScheduledItem,
    updateTransaction,
} from "../lib/finance";
import { getFinanceExportData } from "../lib/financeExport";
import type { FinanceTransactionType } from "@iclub/shared";
import { requireFinanceViewer } from "../middleware/auth";

const router = express.Router();

router.use(requireFinanceViewer);

function parseId(value: unknown): number | null {
    const id = parseInt(String(value ?? ""), 10);
    return Number.isNaN(id) ? null : id;
}

function handleFinanceError(error: unknown, res: Response, context: string, fallback: string) {
    if (error instanceof FinanceValidationError) {
        return res.status(400).json({ error: "Validation failed", fieldErrors: error.fieldErrors });
    }
    if (error instanceof Error && /not found/i.test(error.message)) {
        return res.status(404).json({ error: error.message });
    }
    console.error(context, error);
    return res.status(500).json({ error: fallback });
}

router.get("/dashboard", async (_req: Request, res: Response) => {
    try {
        const dashboard = await getFinanceDashboard();
        return res.json(dashboard);
    } catch (error) {
        return handleFinanceError(error, res, "GET /finance/dashboard error:", "Failed to load finance dashboard");
    }
});

router.get("/export", async (_req: Request, res: Response) => {
    try {
        const payload = await getFinanceExportData();
        return res.json(payload);
    } catch (error) {
        return handleFinanceError(error, res, "GET /finance/export error:", "Failed to export finance data");
    }
});

router.get("/accounts", async (_req: Request, res: Response) => {
    try {
        const accounts = await listAccounts();
        return res.json(accounts);
    } catch (error) {
        return handleFinanceError(error, res, "GET /finance/accounts error:", "Failed to load finance accounts");
    }
});

router.post("/accounts", async (req: Request, res: Response) => {
    try {
        const account = await createAccount(req.body);
        return res.status(201).json(account);
    } catch (error) {
        return handleFinanceError(error, res, "POST /finance/accounts error:", "Failed to create account");
    }
});

router.put("/accounts/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid account id" });

    try {
        const account = await updateAccount(id, req.body);
        return res.json(account);
    } catch (error) {
        return handleFinanceError(error, res, "PUT /finance/accounts/:id error:", "Failed to update account");
    }
});

router.get("/transactions", async (req: Request, res: Response) => {
    try {
        const accountId = parseId(req.query.accountId);
        const type = typeof req.query.type === "string" ? req.query.type as FinanceTransactionType : undefined;
        const category = typeof req.query.category === "string" ? req.query.category : undefined;
        const search = typeof req.query.search === "string" ? req.query.search : undefined;
        const dateFrom = typeof req.query.dateFrom === "string" ? req.query.dateFrom : undefined;
        const dateTo = typeof req.query.dateTo === "string" ? req.query.dateTo : undefined;
        const page = parseId(req.query.page) ?? undefined;
        const pageSize = parseId(req.query.pageSize) ?? undefined;

        const result = await listTransactions({
            accountId: accountId ?? undefined,
            type,
            category,
            search,
            dateFrom,
            dateTo,
            page,
            pageSize,
        });

        return res.json(result);
    } catch (error) {
        return handleFinanceError(error, res, "GET /finance/transactions error:", "Failed to load finance transactions");
    }
});

router.post("/transactions", async (req: Request, res: Response) => {
    try {
        const transaction = await createTransaction(req.body, req.user?.memberId ?? null);
        return res.status(201).json(transaction);
    } catch (error) {
        return handleFinanceError(error, res, "POST /finance/transactions error:", "Failed to create transaction");
    }
});

router.put("/transactions/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid transaction id" });

    try {
        const transaction = await updateTransaction(id, req.body);
        return res.json(transaction);
    } catch (error) {
        return handleFinanceError(error, res, "PUT /finance/transactions/:id error:", "Failed to update transaction");
    }
});

router.delete("/transactions/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid transaction id" });

    try {
        await deleteTransaction(id);
        return res.status(204).send();
    } catch (error) {
        return handleFinanceError(error, res, "DELETE /finance/transactions/:id error:", "Failed to delete transaction");
    }
});

router.post("/liabilities", async (req: Request, res: Response) => {
    try {
        const liability = await createLiability(req.body, req.user?.memberId ?? null);
        return res.status(201).json(liability);
    } catch (error) {
        return handleFinanceError(error, res, "POST /finance/liabilities error:", "Failed to create liability");
    }
});

router.put("/liabilities/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid liability id" });

    try {
        const liability = await updateLiability(id, req.body, req.user?.memberId ?? null);
        return res.json(liability);
    } catch (error) {
        return handleFinanceError(error, res, "PUT /finance/liabilities/:id error:", "Failed to update liability");
    }
});

router.post("/scheduled-items", async (req: Request, res: Response) => {
    try {
        const item = await createScheduledItem(req.body);
        return res.status(201).json(item);
    } catch (error) {
        return handleFinanceError(error, res, "POST /finance/scheduled-items error:", "Failed to create scheduled item");
    }
});

router.put("/scheduled-items/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (id == null) return res.status(400).json({ error: "Invalid scheduled item id" });

    try {
        const item = await updateScheduledItem(id, req.body);
        return res.json(item);
    } catch (error) {
        return handleFinanceError(error, res, "PUT /finance/scheduled-items/:id error:", "Failed to update scheduled item");
    }
});

export default router;
