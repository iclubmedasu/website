import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { advanceDueDate } from "../../lib/finance";

function formatLocalDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function localDate(year: number, month: number, day: number): Date {
    const date = new Date(year, month - 1, day);
    date.setHours(0, 0, 0, 0);
    return date;
}

describe("advanceDueDate", () => {
    it("advances weekly by 7 days", () => {
        const result = advanceDueDate(localDate(2026, 5, 13), "WEEKLY");
        expect(formatLocalDate(result)).toBe("2026-05-20");
    });

    it("advances monthly on the same day of month", () => {
        const result = advanceDueDate(localDate(2026, 5, 13), "MONTHLY");
        expect(formatLocalDate(result)).toBe("2026-06-13");
    });

    it("clamps monthly overflow to last day of month", () => {
        const result = advanceDueDate(localDate(2026, 1, 31), "MONTHLY");
        expect(formatLocalDate(result)).toBe("2026-02-28");
    });

    it("advances yearly on the same date", () => {
        const result = advanceDueDate(localDate(2026, 5, 13), "YEARLY");
        expect(formatLocalDate(result)).toBe("2027-05-13");
    });
});

const scheduledMocks = vi.hoisted(() => ({
    financeScheduledItemFindMany: vi.fn(),
    financeScheduledItemUpdate: vi.fn(),
    financeTransactionCreate: vi.fn(),
}));

vi.mock("../../db", () => ({
    prisma: {
        financeScheduledItem: {
            findMany: scheduledMocks.financeScheduledItemFindMany,
            update: scheduledMocks.financeScheduledItemUpdate,
        },
        financeTransaction: {
            create: scheduledMocks.financeTransactionCreate,
            findMany: vi.fn(),
            count: vi.fn(),
        },
        financeAccount: {
            findMany: vi.fn(),
            findFirst: vi.fn(),
            findUnique: vi.fn(),
        },
        financeLiability: {
            findMany: vi.fn(),
        },
    },
}));

import { processDueScheduledItems } from "../../lib/finance";

describe("processDueScheduledItems", () => {
    beforeEach(() => {
        scheduledMocks.financeTransactionCreate.mockResolvedValue({});
        scheduledMocks.financeScheduledItemUpdate.mockResolvedValue({});
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    it("posts due one-off items and marks them completed", async () => {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(0, 0, 0, 0);

        scheduledMocks.financeScheduledItemFindMany.mockResolvedValue([
            {
                id: 1,
                title: "Hosting",
                type: "EXPENSE",
                amount: 100,
                dueDate: yesterday,
                recurrence: null,
                accountId: 1,
                isCompleted: false,
                notes: "Monthly bill",
            },
        ]);

        await processDueScheduledItems();

        expect(scheduledMocks.financeTransactionCreate).toHaveBeenCalledWith(
            expect.objectContaining({
                data: expect.objectContaining({
                    accountId: 1,
                    type: "EXPENSE",
                    category: "Scheduled: Hosting",
                }),
            }),
        );
        expect(scheduledMocks.financeScheduledItemUpdate).toHaveBeenCalledWith({
            where: { id: 1 },
            data: { isCompleted: true },
        });
    });

    it("advances recurring monthly items after posting", async () => {
        const dueDate = localDate(2026, 5, 13);

        scheduledMocks.financeScheduledItemFindMany.mockResolvedValue([
            {
                id: 2,
                title: "Rent",
                type: "EXPENSE",
                amount: 500,
                dueDate,
                recurrence: "MONTHLY",
                accountId: 1,
                isCompleted: false,
                notes: null,
            },
        ]);

        await processDueScheduledItems();

        expect(scheduledMocks.financeTransactionCreate).toHaveBeenCalled();
        expect(scheduledMocks.financeScheduledItemUpdate).toHaveBeenCalledWith({
            where: { id: 2 },
            data: { dueDate: advanceDueDate(dueDate, "MONTHLY") },
        });
    });
});
