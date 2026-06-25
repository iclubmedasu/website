import request from "supertest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const prismaMocks = vi.hoisted(() => ({
    financeAccountFindMany: vi.fn(),
    financeAccountFindFirst: vi.fn(),
    financeAccountFindUnique: vi.fn(),
    financeAccountCreate: vi.fn(),
    financeAccountUpdate: vi.fn(),
    financeAccountCount: vi.fn(),
    financeTransactionFindMany: vi.fn(),
    financeTransactionFindUnique: vi.fn(),
    financeTransactionCreate: vi.fn(),
    financeTransactionUpdate: vi.fn(),
    financeTransactionDelete: vi.fn(),
    financeTransactionCount: vi.fn(),
    financeLiabilityFindMany: vi.fn(),
    financeLiabilityFindUnique: vi.fn(),
    financeLiabilityCreate: vi.fn(),
    financeLiabilityUpdate: vi.fn(),
    financeScheduledItemFindMany: vi.fn(),
    financeScheduledItemFindUnique: vi.fn(),
    financeScheduledItemCreate: vi.fn(),
    financeScheduledItemUpdate: vi.fn(),
    teamMemberFindMany: vi.fn(),
}));

vi.mock("../../db", () => ({
    prisma: {
        financeAccount: {
            findMany: prismaMocks.financeAccountFindMany,
            findFirst: prismaMocks.financeAccountFindFirst,
            findUnique: prismaMocks.financeAccountFindUnique,
            create: prismaMocks.financeAccountCreate,
            update: prismaMocks.financeAccountUpdate,
            count: prismaMocks.financeAccountCount,
        },
        financeTransaction: {
            findMany: prismaMocks.financeTransactionFindMany,
            findUnique: prismaMocks.financeTransactionFindUnique,
            create: prismaMocks.financeTransactionCreate,
            update: prismaMocks.financeTransactionUpdate,
            delete: prismaMocks.financeTransactionDelete,
            count: prismaMocks.financeTransactionCount,
        },
        financeLiability: {
            findMany: prismaMocks.financeLiabilityFindMany,
            findUnique: prismaMocks.financeLiabilityFindUnique,
            create: prismaMocks.financeLiabilityCreate,
            update: prismaMocks.financeLiabilityUpdate,
        },
        financeScheduledItem: {
            findMany: prismaMocks.financeScheduledItemFindMany,
            findUnique: prismaMocks.financeScheduledItemFindUnique,
            create: prismaMocks.financeScheduledItemCreate,
            update: prismaMocks.financeScheduledItemUpdate,
        },
        teamMember: {
            findMany: prismaMocks.teamMemberFindMany,
        },
        $transaction: vi.fn(async (callback: (tx: {
            financeLiability: { update: typeof prismaMocks.financeLiabilityUpdate };
            financeTransaction: { create: typeof prismaMocks.financeTransactionCreate };
        }) => Promise<unknown>) => callback({
            financeLiability: {
                update: prismaMocks.financeLiabilityUpdate,
            },
            financeTransaction: {
                create: prismaMocks.financeTransactionCreate,
            },
        })),
    },
}));

import financeRouter from "../../routes/finance";
import { buildRouteApp } from "./testHarness";

const mockAccount = {
    id: 1,
    name: "Main Bank Account",
    accountType: "BANK",
    currency: "EGP",
    openingBalance: 1000,
    isActive: true,
    description: null,
    transactions: [{ type: "INCOME", amount: 500 }],
};

const mockTransaction = {
    id: 1,
    accountId: 1,
    type: "INCOME",
    amount: 500,
    category: "Sponsorship",
    description: "Seed",
    transactionDate: new Date("2026-06-01"),
    reference: null,
    createdAt: new Date("2026-06-01T10:00:00.000Z"),
    account: { name: "Main Bank Account" },
};

const mockLiability = {
    id: 1,
    creditor: "Vendor",
    description: null,
    totalAmount: 1000,
    paidAmount: 250,
    dueDate: new Date("2026-07-01"),
    status: "ACTIVE",
    currency: "EGP",
    accountId: 1,
    account: { name: "Main Bank Account" },
};

const mockScheduledItem = {
    id: 1,
    title: "Sponsor payment",
    type: "INCOME",
    amount: 2000,
    dueDate: new Date("2026-07-10"),
    recurrence: null,
    accountId: 1,
    isCompleted: false,
    notes: null,
    account: { name: "Main Bank Account" },
};

describe("finance routes", () => {
    beforeEach(() => {
        prismaMocks.financeAccountFindMany.mockResolvedValue([mockAccount]);
        prismaMocks.financeAccountFindFirst.mockResolvedValue({ id: 1, name: "Main Bank Account", isActive: true });
        prismaMocks.financeAccountFindUnique.mockImplementation(({ where }: { where: { id: number } }) => {
            if (where.id === 999) return Promise.resolve(null);
            if (where.id === 2) {
                return Promise.resolve({
                    ...mockAccount,
                    id: 2,
                    name: "Petty Cash",
                    openingBalance: 100,
                    transactions: [],
                });
            }
            return Promise.resolve({
                ...mockAccount,
                id: where.id,
                name: "Updated Account",
                transactions: mockAccount.transactions,
            });
        });
        prismaMocks.financeAccountCreate.mockResolvedValue({ ...mockAccount, id: 2, name: "Petty Cash" });
        prismaMocks.financeAccountUpdate.mockResolvedValue({ ...mockAccount, name: "Updated Account" });

        prismaMocks.financeLiabilityFindMany.mockResolvedValue([mockLiability]);
        prismaMocks.financeLiabilityFindUnique.mockImplementation(({ where }: { where: { id: number } }) => {
            if (where.id === 999) return Promise.resolve(null);
            return Promise.resolve(mockLiability);
        });
        prismaMocks.financeLiabilityCreate.mockResolvedValue({ ...mockLiability, id: 2, creditor: "New Vendor" });
        prismaMocks.financeLiabilityUpdate.mockResolvedValue({ ...mockLiability, creditor: "Updated Vendor" });

        prismaMocks.financeLiabilityCreate.mockResolvedValue({ ...mockLiability, id: 2, creditor: "New Vendor" });
        prismaMocks.financeLiabilityUpdate.mockResolvedValue({ ...mockLiability, creditor: "Updated Vendor" });

        prismaMocks.financeScheduledItemFindMany.mockImplementation((args?: {
            where?: { isCompleted?: boolean; dueDate?: { lte?: Date } };
        }) => {
            if (!args?.where?.dueDate) {
                return Promise.resolve([mockScheduledItem]);
            }
            const lte = args.where.dueDate.lte;
            if (lte instanceof Date) {
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const daysAhead = Math.round((lte.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                if (daysAhead <= 1) {
                    return Promise.resolve([]);
                }
            }
            return Promise.resolve([mockScheduledItem]);
        });
        prismaMocks.financeScheduledItemFindUnique.mockImplementation(({ where }: { where: { id: number } }) => {
            if (where.id === 999) return Promise.resolve(null);
            return Promise.resolve(mockScheduledItem);
        });
        prismaMocks.financeScheduledItemCreate.mockResolvedValue({ ...mockScheduledItem, id: 2, title: "New item" });
        prismaMocks.financeScheduledItemUpdate.mockResolvedValue({ ...mockScheduledItem, title: "Updated item" });

        prismaMocks.financeTransactionFindMany.mockImplementation((args: {
            include?: unknown;
            distinct?: unknown;
            take?: number;
        }) => {
            if (args?.include && args?.take) {
                return Promise.resolve([mockTransaction]);
            }

            if (args?.include) {
                return Promise.resolve([mockTransaction]);
            }

            if (args?.distinct) {
                return Promise.resolve([{ category: "Sponsorship" }]);
            }

            return Promise.resolve([
                {
                    transactionDate: new Date("2026-06-01"),
                    type: "INCOME",
                    amount: 500,
                    category: "Sponsorship",
                },
            ]);
        });
        prismaMocks.financeTransactionFindUnique.mockImplementation(({ where }: { where: { id: number } }) => {
            if (where.id === 999) return Promise.resolve(null);
            return Promise.resolve(mockTransaction);
        });
        prismaMocks.financeTransactionCreate.mockResolvedValue({ ...mockTransaction, id: 2 });
        prismaMocks.financeTransactionUpdate.mockResolvedValue({ ...mockTransaction, category: "Updated" });
        prismaMocks.financeTransactionDelete.mockResolvedValue(mockTransaction);
        prismaMocks.financeTransactionCount.mockResolvedValue(1);
        prismaMocks.teamMemberFindMany.mockResolvedValue([]);
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("returns 403 for users without finance access", async () => {
        const app = buildRouteApp(financeRouter, { isFinanceViewer: false });
        const response = await request(app).get("/dashboard");
        expect(response.status).toBe(403);
    });

    it("returns 403 for mutation without finance access", async () => {
        const app = buildRouteApp(financeRouter, { isFinanceViewer: false });
        const response = await request(app).post("/accounts").send({ name: "Test", accountType: "CASH" });
        expect(response.status).toBe(403);
    });

    it("returns dashboard payload for finance viewers", async () => {
        const app = buildRouteApp(financeRouter, { isFinanceViewer: true });
        const response = await request(app).get("/dashboard");

        expect(response.status).toBe(200);
        expect(response.body.accounts).toHaveLength(1);
        expect(response.body.totalBalance).toBe(1500);
        expect(response.body.liabilities).toHaveLength(1);
        expect(response.body.upcomingScheduledItems).toHaveLength(1);
        expect(response.body.balanceOverTime).toBeInstanceOf(Array);
    });

    it("returns paginated transactions", async () => {
        const app = buildRouteApp(financeRouter, { isFinanceViewer: true });
        const response = await request(app).get("/transactions?page=1&pageSize=10");

        expect(response.status).toBe(200);
        expect(response.body.items).toHaveLength(1);
        expect(response.body.total).toBe(1);
        expect(response.body.page).toBe(1);
        expect(response.body.pageSize).toBe(10);
    });

    it("creates an account", async () => {
        const app = buildRouteApp(financeRouter, { isFinanceViewer: true });
        const response = await request(app)
            .post("/accounts")
            .send({ name: "Petty Cash", accountType: "CASH", currency: "EGP", openingBalance: 100 });

        expect(response.status).toBe(201);
        expect(response.body.name).toBe("Petty Cash");
        expect(prismaMocks.financeAccountCreate).toHaveBeenCalled();
    });

    it("updates an account", async () => {
        const app = buildRouteApp(financeRouter, { isFinanceViewer: true });
        const response = await request(app)
            .put("/accounts/1")
            .send({ name: "Updated Account" });

        expect(response.status).toBe(200);
        expect(response.body.name).toBe("Updated Account");
        expect(prismaMocks.financeAccountUpdate).toHaveBeenCalled();
    });

    it("creates a transaction", async () => {
        const app = buildRouteApp(financeRouter, { isFinanceViewer: true, memberId: 42 });
        const response = await request(app)
            .post("/transactions")
            .send({
                accountId: 1,
                type: "INCOME",
                amount: 100,
                category: "Donation",
                transactionDate: "2026-06-15",
            });

        expect(response.status).toBe(201);
        expect(response.body.category).toBe("Sponsorship");
        expect(prismaMocks.financeTransactionCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({ createdByMemberId: 42 }),
            }),
        );
    });

    it("updates and deletes a transaction", async () => {
        const app = buildRouteApp(financeRouter, { isFinanceViewer: true });

        const updateResponse = await request(app)
            .put("/transactions/1")
            .send({ category: "Updated" });
        expect(updateResponse.status).toBe(200);
        expect(prismaMocks.financeTransactionUpdate).toHaveBeenCalled();

        const deleteResponse = await request(app).delete("/transactions/1");
        expect(deleteResponse.status).toBe(204);
        expect(prismaMocks.financeTransactionDelete).toHaveBeenCalled();
    });

    it("creates and updates a liability", async () => {
        const app = buildRouteApp(financeRouter, { isFinanceViewer: true });

        const createResponse = await request(app)
            .post("/liabilities")
            .send({
                creditor: "New Vendor",
                totalAmount: 500,
                paidAmount: 0,
                currency: "EGP",
                accountId: 1,
            });
        expect(createResponse.status).toBe(201);
        expect(prismaMocks.financeLiabilityCreate).toHaveBeenCalled();

        const updateResponse = await request(app)
            .put("/liabilities/1")
            .send({ creditor: "Updated Vendor" });
        expect(updateResponse.status).toBe(200);
        expect(prismaMocks.financeLiabilityUpdate).toHaveBeenCalled();
    });

    it("creates and updates a scheduled item", async () => {
        const app = buildRouteApp(financeRouter, { isFinanceViewer: true });

        const createResponse = await request(app)
            .post("/scheduled-items")
            .send({
                title: "New item",
                type: "EXPENSE",
                amount: 300,
                dueDate: "2026-08-01",
                accountId: 1,
            });
        expect(createResponse.status).toBe(201);
        expect(prismaMocks.financeScheduledItemCreate).toHaveBeenCalled();

        const updateResponse = await request(app)
            .put("/scheduled-items/1")
            .send({ title: "Updated item" });
        expect(updateResponse.status).toBe(200);
        expect(prismaMocks.financeScheduledItemUpdate).toHaveBeenCalled();
    });

    it("returns 400 for invalid account payload", async () => {
        const app = buildRouteApp(financeRouter, { isFinanceViewer: true });
        const response = await request(app)
            .post("/accounts")
            .send({ name: "", accountType: "INVALID" });

        expect(response.status).toBe(400);
        expect(response.body.fieldErrors).toBeDefined();
    });

    it("returns 400 when liability is missing accountId", async () => {
        const app = buildRouteApp(financeRouter, { isFinanceViewer: true });
        const response = await request(app)
            .post("/liabilities")
            .send({ creditor: "Vendor", totalAmount: 100 });

        expect(response.status).toBe(400);
        expect(response.body.fieldErrors?.accountId).toBeDefined();
    });

    it("returns 400 when scheduled item is missing accountId", async () => {
        const app = buildRouteApp(financeRouter, { isFinanceViewer: true });
        const response = await request(app)
            .post("/scheduled-items")
            .send({ title: "Rent", type: "EXPENSE", amount: 100, dueDate: "2026-08-01" });

        expect(response.status).toBe(400);
        expect(response.body.fieldErrors?.accountId).toBeDefined();
    });

    it("returns export payload for finance viewers", async () => {
        const app = buildRouteApp(financeRouter, { isFinanceViewer: true });
        const response = await request(app).get("/export");

        expect(response.status).toBe(200);
        expect(response.body.exportedAt).toBeDefined();
        expect(response.body.accounts).toBeInstanceOf(Array);
        expect(response.body.transactions).toBeInstanceOf(Array);
        expect(response.body.liabilities).toBeInstanceOf(Array);
        expect(response.body.scheduledItems).toBeInstanceOf(Array);
    });
});
