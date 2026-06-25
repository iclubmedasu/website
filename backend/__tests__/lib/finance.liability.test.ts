import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const liabilityMocks = vi.hoisted(() => ({
    financeLiabilityCreate: vi.fn(),
    financeLiabilityUpdate: vi.fn(),
    financeLiabilityFindUnique: vi.fn(),
    financeTransactionCreate: vi.fn(),
    financeTransactionUpdate: vi.fn(),
    financeTransactionFindMany: vi.fn(),
    financeTransactionDeleteMany: vi.fn(),
    financeAccountFindFirst: vi.fn(),
}));

vi.mock("../../db", () => ({
    prisma: {
        financeLiability: {
            create: liabilityMocks.financeLiabilityCreate,
            update: liabilityMocks.financeLiabilityUpdate,
            findUnique: liabilityMocks.financeLiabilityFindUnique,
        },
        financeTransaction: {
            create: liabilityMocks.financeTransactionCreate,
            update: liabilityMocks.financeTransactionUpdate,
            findMany: liabilityMocks.financeTransactionFindMany,
            deleteMany: liabilityMocks.financeTransactionDeleteMany,
        },
        financeAccount: {
            findFirst: liabilityMocks.financeAccountFindFirst,
        },
        $transaction: vi.fn(async (callback: (tx: unknown) => Promise<unknown>) => callback({
            financeLiability: {
                update: liabilityMocks.financeLiabilityUpdate,
            },
            financeTransaction: {
                create: liabilityMocks.financeTransactionCreate,
                update: liabilityMocks.financeTransactionUpdate,
                findMany: liabilityMocks.financeTransactionFindMany,
                deleteMany: liabilityMocks.financeTransactionDeleteMany,
            },
        })),
    },
}));

import { createLiability, updateLiability } from "../../lib/finance";

const mockLiability = {
    id: 1,
    creditor: "Vendor",
    description: "Invoice",
    totalAmount: 1000,
    paidAmount: 0,
    dueDate: null,
    status: "ACTIVE",
    currency: "EGP",
    accountId: 1,
    account: { name: "Main Bank Account" },
};

const mockPaymentTransaction = {
    id: 99,
    accountId: 1,
    type: "EXPENSE",
    amount: 500,
    category: "Liability: Vendor",
    reference: "liability:1",
};

describe("liability payment auto-post", () => {
    beforeEach(() => {
        liabilityMocks.financeAccountFindFirst.mockResolvedValue({
            id: 1,
            name: "Main Bank Account",
            isActive: true,
        });
        liabilityMocks.financeTransactionCreate.mockResolvedValue({});
        liabilityMocks.financeTransactionUpdate.mockResolvedValue({});
        liabilityMocks.financeTransactionFindMany.mockResolvedValue([]);
        liabilityMocks.financeTransactionDeleteMany.mockResolvedValue({ count: 0 });
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("posts EXPENSE when creating liability with paidAmount", async () => {
        liabilityMocks.financeLiabilityCreate.mockResolvedValue({
            ...mockLiability,
            paidAmount: 500,
        });

        await createLiability(
            {
                creditor: "Vendor",
                totalAmount: 1000,
                paidAmount: 500,
                accountId: 1,
            },
            42,
        );

        expect(liabilityMocks.financeTransactionCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    accountId: 1,
                    type: "EXPENSE",
                    amount: 500,
                    category: "Liability: Vendor",
                    reference: "liability:1",
                    createdByMemberId: 42,
                }),
            }),
        );
    });

    it("updates the canonical transaction when paidAmount increases", async () => {
        liabilityMocks.financeLiabilityFindUnique.mockResolvedValue({
            ...mockLiability,
            paidAmount: 500,
        });
        liabilityMocks.financeLiabilityUpdate.mockResolvedValue({
            ...mockLiability,
            paidAmount: 800,
        });
        liabilityMocks.financeTransactionFindMany.mockResolvedValue([mockPaymentTransaction]);

        await updateLiability(1, { paidAmount: 800 }, 7);

        expect(liabilityMocks.financeTransactionCreate).not.toHaveBeenCalled();
        expect(liabilityMocks.financeTransactionUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 99 },
                data: expect.objectContaining({
                    amount: 800,
                    type: "EXPENSE",
                    category: "Liability: Vendor",
                }),
            }),
        );
    });

    it("updates the canonical transaction when paidAmount decreases", async () => {
        liabilityMocks.financeLiabilityFindUnique.mockResolvedValue({
            ...mockLiability,
            paidAmount: 400,
        });
        liabilityMocks.financeLiabilityUpdate.mockResolvedValue({
            ...mockLiability,
            paidAmount: 200,
        });
        liabilityMocks.financeTransactionFindMany.mockResolvedValue([
            { ...mockPaymentTransaction, amount: 400 },
        ]);

        await updateLiability(1, { paidAmount: 200 }, 9);

        expect(liabilityMocks.financeTransactionCreate).not.toHaveBeenCalled();
        expect(liabilityMocks.financeTransactionUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 99 },
                data: expect.objectContaining({
                    amount: 200,
                    type: "EXPENSE",
                }),
            }),
        );
    });

    it("deletes the canonical transaction when paidAmount goes to zero", async () => {
        liabilityMocks.financeLiabilityFindUnique.mockResolvedValue({
            ...mockLiability,
            paidAmount: 200,
        });
        liabilityMocks.financeLiabilityUpdate.mockResolvedValue({
            ...mockLiability,
            paidAmount: 0,
        });
        liabilityMocks.financeTransactionFindMany.mockResolvedValue([
            { ...mockPaymentTransaction, amount: 200 },
        ]);

        await updateLiability(1, { paidAmount: 0 });

        expect(liabilityMocks.financeTransactionDeleteMany).toHaveBeenCalledWith({
            where: { reference: "liability:1" },
        });
    });

    it("updates metadata without creating a new transaction when paidAmount is unchanged", async () => {
        liabilityMocks.financeLiabilityFindUnique.mockResolvedValue({
            ...mockLiability,
            paidAmount: 500,
        });
        liabilityMocks.financeLiabilityUpdate.mockResolvedValue({
            ...mockLiability,
            paidAmount: 500,
            creditor: "Updated Vendor",
        });
        liabilityMocks.financeTransactionFindMany.mockResolvedValue([mockPaymentTransaction]);

        await updateLiability(1, { creditor: "Updated Vendor", paidAmount: 500 });

        expect(liabilityMocks.financeTransactionCreate).not.toHaveBeenCalled();
        expect(liabilityMocks.financeTransactionUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    amount: 500,
                    category: "Liability: Updated Vendor",
                }),
            }),
        );
    });

    it("does not touch transactions when unrelated fields change", async () => {
        liabilityMocks.financeLiabilityFindUnique.mockResolvedValue({
            ...mockLiability,
            paidAmount: 500,
        });
        liabilityMocks.financeLiabilityUpdate.mockResolvedValue({
            ...mockLiability,
            paidAmount: 500,
            totalAmount: 1200,
        });

        await updateLiability(1, { totalAmount: 1200, paidAmount: 500 });

        expect(liabilityMocks.financeTransactionCreate).not.toHaveBeenCalled();
        expect(liabilityMocks.financeTransactionUpdate).not.toHaveBeenCalled();
        expect(liabilityMocks.financeTransactionFindMany).not.toHaveBeenCalled();
    });
});
