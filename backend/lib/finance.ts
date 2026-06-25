import type { Prisma } from "@prisma/client";
import { prisma } from "../db";
import {
    type CreateFinanceAccountInput,
    type CreateFinanceLiabilityInput,
    type CreateFinanceScheduledItemInput,
    type CreateFinanceTransactionInput,
    FINANCE_TRANSACTION_CATEGORIES,
    type FinanceAccountSummary,
    type FinanceAccountType,
    type FinanceBalancePoint,
    type FinanceCategoryBreakdownPoint,
    type FinanceDashboardResponse,
    type FinanceIncomeExpensePoint,
    type FinanceLiabilityRow,
    type FinanceLiabilityStatus,
    type FinanceScheduledItemRow,
    type FinanceScheduledItemType,
    type FinanceScheduledRecurrence,
    type FinanceTransactionFilters,
    type FinanceTransactionListResponse,
    type FinanceTransactionRow,
    type FinanceTransactionType,
    type UpdateFinanceAccountInput,
    type UpdateFinanceLiabilityInput,
    type UpdateFinanceScheduledItemInput,
    type UpdateFinanceTransactionInput,
} from "@iclub/shared";

function toNumber(value: Prisma.Decimal | number | string | null | undefined): number {
    if (value == null) return 0;
    return Number(value);
}

function toDateString(value: Date): string {
    return value.toISOString().slice(0, 10);
}

function startOfDay(date: Date): Date {
    const copy = new Date(date);
    copy.setHours(0, 0, 0, 0);
    return copy;
}

function computeLiabilityStatus(
    storedStatus: string,
    totalAmount: number,
    paidAmount: number,
    dueDate: Date | null,
): FinanceLiabilityStatus {
    if (storedStatus === "PAID" || paidAmount >= totalAmount) return "PAID";
    if (dueDate && startOfDay(dueDate) < startOfDay(new Date()) && paidAmount < totalAmount) {
        return "OVERDUE";
    }
    return storedStatus === "OVERDUE" ? "OVERDUE" : "ACTIVE";
}

async function computeAccountBalances(): Promise<FinanceAccountSummary[]> {
    const accounts = await prisma.financeAccount.findMany({
        where: { isActive: true },
        orderBy: { name: "asc" },
        include: {
            transactions: {
                select: { type: true, amount: true },
            },
        },
    });

    return accounts.map((account) => {
        let net = toNumber(account.openingBalance);
        for (const tx of account.transactions) {
            const amount = toNumber(tx.amount);
            if (tx.type === "INCOME") net += amount;
            else if (tx.type === "EXPENSE") net -= amount;
        }

        return {
            id: account.id,
            name: account.name,
            accountType: account.accountType as FinanceAccountSummary["accountType"],
            currency: account.currency,
            openingBalance: toNumber(account.openingBalance),
            currentBalance: net,
            isActive: account.isActive,
            description: account.description,
        };
    });
}

function buildBalanceOverTime(
    transactions: Array<{ transactionDate: Date; type: string; amount: Prisma.Decimal }>,
    openingBalanceTotal: number,
): FinanceBalancePoint[] {
    const sorted = [...transactions].sort(
        (a, b) => a.transactionDate.getTime() - b.transactionDate.getTime(),
    );

    const dailyDelta = new Map<string, number>();
    for (const tx of sorted) {
        const key = toDateString(tx.transactionDate);
        const amount = toNumber(tx.amount);
        const delta = tx.type === "INCOME" ? amount : tx.type === "EXPENSE" ? -amount : 0;
        dailyDelta.set(key, (dailyDelta.get(key) ?? 0) + delta);
    }

    const points: FinanceBalancePoint[] = [];
    let running = openingBalanceTotal;
    const dates = [...dailyDelta.keys()].sort();
    for (const date of dates) {
        running += dailyDelta.get(date) ?? 0;
        points.push({ date, balance: Math.round(running * 100) / 100 });
    }

    if (points.length === 0) {
        points.push({ date: toDateString(new Date()), balance: openingBalanceTotal });
    }

    return points;
}

function buildIncomeVsExpenseByMonth(
    transactions: Array<{ transactionDate: Date; type: string; amount: Prisma.Decimal }>,
): FinanceIncomeExpensePoint[] {
    const byMonth = new Map<string, { income: number; expense: number }>();

    for (const tx of transactions) {
        const month = tx.transactionDate.toISOString().slice(0, 7);
        const entry = byMonth.get(month) ?? { income: 0, expense: 0 };
        const amount = toNumber(tx.amount);
        if (tx.type === "INCOME") entry.income += amount;
        if (tx.type === "EXPENSE") entry.expense += amount;
        byMonth.set(month, entry);
    }

    return [...byMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, values]) => ({
            month,
            income: Math.round(values.income * 100) / 100,
            expense: Math.round(values.expense * 100) / 100,
        }));
}

function buildExpenseByCategory(
    transactions: Array<{ type: string; category: string; amount: Prisma.Decimal }>,
): FinanceCategoryBreakdownPoint[] {
    const byCategory = new Map<string, number>();
    for (const tx of transactions) {
        if (tx.type !== "EXPENSE") continue;
        const amount = toNumber(tx.amount);
        byCategory.set(tx.category, (byCategory.get(tx.category) ?? 0) + amount);
    }

    return [...byCategory.entries()]
        .map(([category, amount]) => ({
            category,
            amount: Math.round(amount * 100) / 100,
        }))
        .sort((a, b) => b.amount - a.amount);
}

function mergeCategories(dbCategories: string[]): string[] {
    const merged = new Set<string>([...FINANCE_TRANSACTION_CATEGORIES, ...dbCategories]);
    return [...merged].sort((a, b) => a.localeCompare(b));
}

function mapLiabilityRow(liability: {
    id: number;
    creditor: string;
    description: string | null;
    totalAmount: Prisma.Decimal;
    paidAmount: Prisma.Decimal;
    dueDate: Date | null;
    status: string;
    currency: string;
    accountId: number;
    account?: { name: string };
}): FinanceLiabilityRow {
    const totalAmount = toNumber(liability.totalAmount);
    const paidAmount = toNumber(liability.paidAmount);
    const remainingAmount = Math.max(0, totalAmount - paidAmount);
    const progressPercent = totalAmount > 0
        ? Math.round((paidAmount / totalAmount) * 100)
        : 0;

    return {
        id: liability.id,
        creditor: liability.creditor,
        description: liability.description,
        totalAmount,
        paidAmount,
        remainingAmount: Math.round(remainingAmount * 100) / 100,
        dueDate: liability.dueDate ? toDateString(liability.dueDate) : null,
        status: computeLiabilityStatus(liability.status, totalAmount, paidAmount, liability.dueDate),
        currency: liability.currency,
        accountId: liability.accountId,
        accountName: liability.account?.name ?? "",
        progressPercent,
    };
}

function daysUntilDue(dueDate: Date): number {
    const today = startOfDay(new Date());
    const due = startOfDay(dueDate);
    return Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function mapScheduledItemRow(item: {
    id: number;
    title: string;
    type: string;
    amount: Prisma.Decimal;
    dueDate: Date;
    recurrence: string | null;
    accountId: number;
    isCompleted: boolean;
    notes: string | null;
    account?: { name: string };
}): FinanceScheduledItemRow {
    const recurrence = item.recurrence as FinanceScheduledRecurrence | null;
    return {
        id: item.id,
        title: item.title,
        type: item.type as FinanceScheduledItemRow["type"],
        amount: toNumber(item.amount),
        dueDate: toDateString(item.dueDate),
        recurrence: recurrence && RECURRENCE_TYPES.includes(recurrence) ? recurrence : null,
        accountId: item.accountId,
        accountName: item.account?.name ?? "",
        isCompleted: item.isCompleted,
        notes: item.notes,
        daysUntilDue: daysUntilDue(item.dueDate),
    };
}

const RECURRENCE_TYPES: FinanceScheduledRecurrence[] = ["WEEKLY", "MONTHLY", "YEARLY"];
const MAX_SCHEDULED_CATCHUP = 24;

export function advanceDueDate(date: Date, recurrence: FinanceScheduledRecurrence): Date {
    const result = startOfDay(new Date(date));
    if (recurrence === "WEEKLY") {
        result.setDate(result.getDate() + 7);
        return result;
    }
    if (recurrence === "MONTHLY") {
        const day = result.getDate();
        result.setMonth(result.getMonth() + 1);
        if (result.getDate() !== day) {
            result.setDate(0);
        }
        return startOfDay(result);
    }
    result.setFullYear(result.getFullYear() + 1);
    return startOfDay(result);
}

export async function processDueScheduledItems(): Promise<void> {
    const today = startOfDay(new Date());

    const dueItems = await prisma.financeScheduledItem.findMany({
        where: {
            isCompleted: false,
            dueDate: { lte: today },
        },
    });

    for (const item of dueItems) {
        let dueDate = startOfDay(item.dueDate);
        let iterations = 0;

        while (dueDate <= today && iterations < MAX_SCHEDULED_CATCHUP) {
            await prisma.financeTransaction.create({
                data: {
                    accountId: item.accountId,
                    type: item.type,
                    amount: item.amount,
                    category: `Scheduled: ${item.title}`,
                    transactionDate: dueDate,
                    description: item.notes,
                    reference: null,
                    createdByMemberId: null,
                },
            });

            const recurrence = item.recurrence as FinanceScheduledRecurrence | null;
            if (recurrence && RECURRENCE_TYPES.includes(recurrence)) {
                dueDate = advanceDueDate(dueDate, recurrence);
                await prisma.financeScheduledItem.update({
                    where: { id: item.id },
                    data: { dueDate },
                });
            } else {
                await prisma.financeScheduledItem.update({
                    where: { id: item.id },
                    data: { isCompleted: true },
                });
                break;
            }

            iterations += 1;
        }
    }
}

export async function listAccounts(): Promise<FinanceAccountSummary[]> {
    return computeAccountBalances();
}

export async function listLiabilities(): Promise<FinanceLiabilityRow[]> {
    const liabilities = await prisma.financeLiability.findMany({
        include: { account: { select: { name: true } } },
        orderBy: [{ dueDate: "asc" }, { creditor: "asc" }],
    });
    return liabilities.map(mapLiabilityRow);
}

export async function listUpcomingScheduledItems(withinDays = 60): Promise<FinanceScheduledItemRow[]> {
    const today = startOfDay(new Date());
    const end = new Date(today);
    end.setDate(end.getDate() + withinDays);

    const items = await prisma.financeScheduledItem.findMany({
        where: {
            isCompleted: false,
            dueDate: { lte: end },
        },
        include: { account: { select: { name: true } } },
        orderBy: { dueDate: "asc" },
    });

    return items.map(mapScheduledItemRow);
}

const EXPORT_TRANSACTION_LIMIT = 10000;

export async function listAllTransactions(): Promise<FinanceTransactionRow[]> {
    const rows = await prisma.financeTransaction.findMany({
        include: { account: { select: { name: true } } },
        orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
        take: EXPORT_TRANSACTION_LIMIT,
    });

    return rows.map((row) => ({
        id: row.id,
        accountId: row.accountId,
        accountName: row.account.name,
        type: row.type as FinanceTransactionType,
        amount: toNumber(row.amount),
        category: row.category,
        description: row.description,
        transactionDate: toDateString(row.transactionDate),
        reference: row.reference,
        createdAt: row.createdAt.toISOString(),
    }));
}

export async function listAllScheduledItems(): Promise<FinanceScheduledItemRow[]> {
    const items = await prisma.financeScheduledItem.findMany({
        include: { account: { select: { name: true } } },
        orderBy: [{ dueDate: "asc" }, { title: "asc" }],
    });

    return items.map(mapScheduledItemRow);
}

export async function listTransactions(
    filters: FinanceTransactionFilters = {},
): Promise<FinanceTransactionListResponse> {
    const page = Math.max(1, filters.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, filters.pageSize ?? 25));

    const where: Prisma.FinanceTransactionWhereInput = {};

    if (filters.accountId) where.accountId = filters.accountId;
    if (filters.type) where.type = filters.type;
    if (filters.category) where.category = filters.category;

    if (filters.dateFrom || filters.dateTo) {
        where.transactionDate = {};
        if (filters.dateFrom) where.transactionDate.gte = new Date(filters.dateFrom);
        if (filters.dateTo) where.transactionDate.lte = new Date(filters.dateTo);
    }

    if (filters.search?.trim()) {
        const search = filters.search.trim();
        where.OR = [
            { description: { contains: search, mode: "insensitive" } },
            { category: { contains: search, mode: "insensitive" } },
            { reference: { contains: search, mode: "insensitive" } },
            { account: { name: { contains: search, mode: "insensitive" } } },
        ];
    }

    const [total, rows] = await Promise.all([
        prisma.financeTransaction.count({ where }),
        prisma.financeTransaction.findMany({
            where,
            include: { account: { select: { name: true } } },
            orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
            skip: (page - 1) * pageSize,
            take: pageSize,
        }),
    ]);

    const items: FinanceTransactionRow[] = rows.map((row) => ({
        id: row.id,
        accountId: row.accountId,
        accountName: row.account.name,
        type: row.type as FinanceTransactionType,
        amount: toNumber(row.amount),
        category: row.category,
        description: row.description,
        transactionDate: toDateString(row.transactionDate),
        reference: row.reference,
        createdAt: row.createdAt.toISOString(),
    }));

    return { items, total, page, pageSize };
}

export async function getFinanceDashboard(): Promise<FinanceDashboardResponse> {
    await processDueScheduledItems();

    const [accounts, liabilities, upcomingScheduledItems, allTransactions, categories] = await Promise.all([
        computeAccountBalances(),
        listLiabilities(),
        listUpcomingScheduledItems(60),
        prisma.financeTransaction.findMany({
            select: {
                transactionDate: true,
                type: true,
                amount: true,
                category: true,
            },
            orderBy: { transactionDate: "asc" },
        }),
        prisma.financeTransaction.findMany({
            distinct: ["category"],
            select: { category: true },
            orderBy: { category: "asc" },
        }),
    ]);

    const totalBalance = accounts.reduce((sum, account) => sum + account.currentBalance, 0);
    const openingBalanceTotal = accounts.reduce((sum, account) => sum + account.openingBalance, 0);

    return {
        accounts,
        totalBalance: Math.round(totalBalance * 100) / 100,
        currency: accounts[0]?.currency ?? "EGP",
        balanceOverTime: buildBalanceOverTime(allTransactions, openingBalanceTotal),
        incomeVsExpenseByMonth: buildIncomeVsExpenseByMonth(allTransactions),
        expenseByCategory: buildExpenseByCategory(allTransactions),
        liabilities: liabilities.filter((item) => item.status !== "PAID"),
        upcomingScheduledItems,
        categories: mergeCategories(categories.map((row) => row.category)),
    };
}

const ACCOUNT_TYPES: FinanceAccountType[] = ["BANK", "CASH", "DIGITAL", "OTHER"];
const TRANSACTION_TYPES = ["INCOME", "EXPENSE"] as const;
const SCHEDULED_TYPES: FinanceScheduledItemType[] = ["INCOME", "EXPENSE"];

export class FinanceValidationError extends Error {
    fieldErrors: Record<string, string>;

    constructor(fieldErrors: Record<string, string>) {
        super("Validation failed");
        this.fieldErrors = fieldErrors;
    }
}

function trimString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

function parsePositiveAmount(value: unknown, field: string, errors: Record<string, string>, allowZero = false): number | null {
    const num = typeof value === "number" ? value : parseFloat(String(value ?? ""));
    if (Number.isNaN(num) || num < 0 || (!allowZero && num <= 0)) {
        errors[field] = allowZero ? "Must be zero or greater" : "Must be greater than zero";
        return null;
    }
    return Math.round(num * 100) / 100;
}

function parseDate(value: unknown, field: string, errors: Record<string, string>): Date | null {
    const str = trimString(value);
    if (!str) {
        errors[field] = "Date is required";
        return null;
    }
    const date = new Date(str);
    if (Number.isNaN(date.getTime())) {
        errors[field] = "Invalid date";
        return null;
    }
    return date;
}

function parseRecurrence(
    value: unknown,
    field: string,
    errors: Record<string, string>,
): FinanceScheduledRecurrence | null {
    const str = trimString(value);
    if (!str) return null;
    if (!RECURRENCE_TYPES.includes(str as FinanceScheduledRecurrence)) {
        errors[field] = "Invalid recurrence";
        return null;
    }
    return str as FinanceScheduledRecurrence;
}

async function getActiveAccount(accountId: number): Promise<{ id: number; name: string; isActive: boolean } | null> {
    return prisma.financeAccount.findFirst({
        where: { id: accountId, isActive: true },
        select: { id: true, name: true, isActive: true },
    });
}

async function mapAccountSummary(accountId: number): Promise<FinanceAccountSummary | null> {
    const account = await prisma.financeAccount.findUnique({
        where: { id: accountId },
        include: {
            transactions: { select: { type: true, amount: true } },
        },
    });
    if (!account) return null;

    let net = toNumber(account.openingBalance);
    for (const tx of account.transactions) {
        const amount = toNumber(tx.amount);
        if (tx.type === "INCOME") net += amount;
        else if (tx.type === "EXPENSE") net -= amount;
    }

    return {
        id: account.id,
        name: account.name,
        accountType: account.accountType as FinanceAccountSummary["accountType"],
        currency: account.currency,
        openingBalance: toNumber(account.openingBalance),
        currentBalance: Math.round(net * 100) / 100,
        isActive: account.isActive,
        description: account.description,
    };
}

function mapTransactionRow(row: {
    id: number;
    accountId: number;
    type: string;
    amount: Prisma.Decimal;
    category: string;
    description: string | null;
    transactionDate: Date;
    reference: string | null;
    createdAt: Date;
    account: { name: string };
}): FinanceTransactionRow {
    return {
        id: row.id,
        accountId: row.accountId,
        accountName: row.account.name,
        type: row.type as FinanceTransactionType,
        amount: toNumber(row.amount),
        category: row.category,
        description: row.description,
        transactionDate: toDateString(row.transactionDate),
        reference: row.reference,
        createdAt: row.createdAt.toISOString(),
    };
}

function resolveLiabilityStoredStatus(
    totalAmount: number,
    paidAmount: number,
    dueDate: Date | null,
    requestedStatus?: FinanceLiabilityStatus,
): string {
    if (requestedStatus === "PAID" || paidAmount >= totalAmount) return "PAID";
    const computed = computeLiabilityStatus("ACTIVE", totalAmount, paidAmount, dueDate);
    if (computed === "OVERDUE") return "OVERDUE";
    return requestedStatus === "OVERDUE" ? "OVERDUE" : "ACTIVE";
}

export async function createAccount(input: CreateFinanceAccountInput): Promise<FinanceAccountSummary> {
    const errors: Record<string, string> = {};
    const name = trimString(input.name);
    if (!name) errors.name = "Name is required";

    const accountType = input.accountType;
    if (!ACCOUNT_TYPES.includes(accountType)) errors.accountType = "Invalid account type";

    const openingBalance = parsePositiveAmount(input.openingBalance ?? 0, "openingBalance", errors, true);
    if (Object.keys(errors).length > 0) throw new FinanceValidationError(errors);

    const created = await prisma.financeAccount.create({
        data: {
            name,
            accountType,
            currency: trimString(input.currency) || "EGP",
            openingBalance: openingBalance ?? 0,
            description: trimString(input.description) || null,
        },
    });

    const summary = await mapAccountSummary(created.id);
    if (!summary) throw new Error("Failed to load created account");
    return summary;
}

export async function updateAccount(id: number, input: UpdateFinanceAccountInput): Promise<FinanceAccountSummary> {
    const existing = await prisma.financeAccount.findUnique({ where: { id } });
    if (!existing) throw new Error("Account not found");

    const errors: Record<string, string> = {};
    const data: Prisma.FinanceAccountUpdateInput = {};

    if (input.name !== undefined) {
        const name = trimString(input.name);
        if (!name) errors.name = "Name is required";
        else data.name = name;
    }
    if (input.accountType !== undefined) {
        if (!ACCOUNT_TYPES.includes(input.accountType)) errors.accountType = "Invalid account type";
        else data.accountType = input.accountType;
    }
    if (input.currency !== undefined) data.currency = trimString(input.currency) || "EGP";
    if (input.openingBalance !== undefined) {
        const openingBalance = parsePositiveAmount(input.openingBalance, "openingBalance", errors, true);
        if (openingBalance != null) data.openingBalance = openingBalance;
    }
    if (input.description !== undefined) data.description = trimString(input.description) || null;
    if (input.isActive !== undefined) data.isActive = !!input.isActive;

    if (Object.keys(errors).length > 0) throw new FinanceValidationError(errors);

    await prisma.financeAccount.update({ where: { id }, data });
    const summary = await mapAccountSummary(id);
    if (!summary) throw new Error("Failed to load updated account");
    return summary;
}

export async function createTransaction(
    input: CreateFinanceTransactionInput,
    createdByMemberId?: number | null,
): Promise<FinanceTransactionRow> {
    const errors: Record<string, string> = {};
    const accountId = Number(input.accountId);
    if (!accountId) errors.accountId = "Account is required";

    if (!TRANSACTION_TYPES.includes(input.type)) errors.type = "Invalid transaction type";

    const amount = parsePositiveAmount(input.amount, "amount", errors);
    const category = trimString(input.category);
    if (!category) errors.category = "Category is required";

    const transactionDate = parseDate(input.transactionDate, "transactionDate", errors);

    if (Object.keys(errors).length > 0) throw new FinanceValidationError(errors);

    const account = await getActiveAccount(accountId);
    if (!account) errors.accountId = "Account not found or inactive";
    if (Object.keys(errors).length > 0) throw new FinanceValidationError(errors);

    const created = await prisma.financeTransaction.create({
        data: {
            accountId,
            type: input.type,
            amount: amount!,
            category,
            transactionDate: transactionDate!,
            description: trimString(input.description) || null,
            reference: trimString(input.reference) || null,
            createdByMemberId: createdByMemberId ?? null,
        },
        include: { account: { select: { name: true } } },
    });

    return mapTransactionRow(created);
}

export async function updateTransaction(id: number, input: UpdateFinanceTransactionInput): Promise<FinanceTransactionRow> {
    const existing = await prisma.financeTransaction.findUnique({ where: { id } });
    if (!existing) throw new Error("Transaction not found");

    const errors: Record<string, string> = {};
    const data: Prisma.FinanceTransactionUpdateInput = {};

    if (input.accountId !== undefined) {
        const accountId = Number(input.accountId);
        const account = await getActiveAccount(accountId);
        if (!account) errors.accountId = "Account not found or inactive";
        else data.account = { connect: { id: accountId } };
    }
    if (input.type !== undefined) {
        if (!TRANSACTION_TYPES.includes(input.type)) errors.type = "Invalid transaction type";
        else data.type = input.type;
    }
    if (input.amount !== undefined) {
        const amount = parsePositiveAmount(input.amount, "amount", errors);
        if (amount != null) data.amount = amount;
    }
    if (input.category !== undefined) {
        const category = trimString(input.category);
        if (!category) errors.category = "Category is required";
        else data.category = category;
    }
    if (input.transactionDate !== undefined) {
        const transactionDate = parseDate(input.transactionDate, "transactionDate", errors);
        if (transactionDate) data.transactionDate = transactionDate;
    }
    if (input.description !== undefined) data.description = trimString(input.description) || null;
    if (input.reference !== undefined) data.reference = trimString(input.reference) || null;

    if (Object.keys(errors).length > 0) throw new FinanceValidationError(errors);

    const updated = await prisma.financeTransaction.update({
        where: { id },
        data,
        include: { account: { select: { name: true } } },
    });

    return mapTransactionRow(updated);
}

export async function deleteTransaction(id: number): Promise<void> {
    const existing = await prisma.financeTransaction.findUnique({ where: { id } });
    if (!existing) throw new Error("Transaction not found");
    await prisma.financeTransaction.delete({ where: { id } });
}

const liabilityPaymentReference = (liabilityId: number) => `liability:${liabilityId}`;

type LiabilityTransactionDb = Pick<
    typeof prisma,
    "financeTransaction"
>;

async function syncLiabilityPaymentTransaction(
    liabilityId: number,
    accountId: number,
    creditor: string,
    paidAmount: number,
    description: string | null,
    createdByMemberId?: number | null,
    db: LiabilityTransactionDb = prisma,
): Promise<void> {
    const roundedPaid = Math.round(paidAmount * 100) / 100;
    const reference = liabilityPaymentReference(liabilityId);
    const existing = await db.financeTransaction.findMany({
        where: { reference },
        orderBy: { id: "asc" },
    });

    if (roundedPaid <= 0) {
        if (existing.length > 0) {
            await db.financeTransaction.deleteMany({ where: { reference } });
        }
        return;
    }

    const paymentDescription = description || `Payment to ${creditor}`;
    const paymentData = {
        accountId,
        type: "EXPENSE",
        amount: roundedPaid,
        category: `Liability: ${creditor}`,
        description: paymentDescription,
    };

    if (existing.length === 0) {
        await db.financeTransaction.create({
            data: {
                ...paymentData,
                transactionDate: startOfDay(new Date()),
                reference,
                createdByMemberId: createdByMemberId ?? null,
            },
        });
        return;
    }

    const [canonical, ...legacyExtras] = existing;
    await db.financeTransaction.update({
        where: { id: canonical.id },
        data: paymentData,
    });

    if (legacyExtras.length > 0) {
        await db.financeTransaction.deleteMany({
            where: { id: { in: legacyExtras.map((row) => row.id) } },
        });
    }
}

export async function createLiability(
    input: CreateFinanceLiabilityInput,
    createdByMemberId?: number | null,
): Promise<FinanceLiabilityRow> {
    const errors: Record<string, string> = {};
    const creditor = trimString(input.creditor);
    if (!creditor) errors.creditor = "Creditor is required";

    const accountId = Number(input.accountId);
    if (!accountId) errors.accountId = "Account is required";

    const totalAmount = parsePositiveAmount(input.totalAmount, "totalAmount", errors);
    const paidAmount = parsePositiveAmount(input.paidAmount ?? 0, "paidAmount", errors, true);

    let dueDate: Date | null = null;
    if (input.dueDate) {
        dueDate = parseDate(input.dueDate, "dueDate", errors);
    }

    if (totalAmount != null && paidAmount != null && paidAmount > totalAmount) {
        errors.paidAmount = "Paid amount cannot exceed total";
    }

    if (Object.keys(errors).length > 0) throw new FinanceValidationError(errors);

    const account = await getActiveAccount(accountId);
    if (!account) throw new FinanceValidationError({ accountId: "Account not found or inactive" });

    const status = resolveLiabilityStoredStatus(totalAmount!, paidAmount!, dueDate, input.status);

    const created = await prisma.financeLiability.create({
        data: {
            creditor,
            description: trimString(input.description) || null,
            totalAmount: totalAmount!,
            paidAmount: paidAmount!,
            dueDate,
            currency: trimString(input.currency) || "EGP",
            status,
            accountId,
        },
        include: { account: { select: { name: true } } },
    });

    if (paidAmount! > 0) {
        await syncLiabilityPaymentTransaction(
            created.id,
            accountId,
            creditor,
            paidAmount!,
            created.description,
            createdByMemberId,
        );
    }

    return mapLiabilityRow(created);
}

export async function updateLiability(
    id: number,
    input: UpdateFinanceLiabilityInput,
    createdByMemberId?: number | null,
): Promise<FinanceLiabilityRow> {
    const existing = await prisma.financeLiability.findUnique({ where: { id } });
    if (!existing) throw new Error("Liability not found");

    const errors: Record<string, string> = {};
    const data: Prisma.FinanceLiabilityUpdateInput = {};

    let totalAmount = toNumber(existing.totalAmount);
    let paidAmount = toNumber(existing.paidAmount);
    let dueDate = existing.dueDate;

    if (input.creditor !== undefined) {
        const creditor = trimString(input.creditor);
        if (!creditor) errors.creditor = "Creditor is required";
        else data.creditor = creditor;
    }
    if (input.description !== undefined) data.description = trimString(input.description) || null;
    if (input.totalAmount !== undefined) {
        const parsed = parsePositiveAmount(input.totalAmount, "totalAmount", errors);
        if (parsed != null) {
            totalAmount = parsed;
            data.totalAmount = parsed;
        }
    }
    if (input.paidAmount !== undefined) {
        const parsed = parsePositiveAmount(input.paidAmount, "paidAmount", errors, true);
        if (parsed != null) {
            paidAmount = parsed;
            data.paidAmount = parsed;
        }
    }
    if (input.dueDate !== undefined) {
        if (input.dueDate === null || input.dueDate === "") {
            dueDate = null;
            data.dueDate = null;
        } else {
            dueDate = parseDate(input.dueDate, "dueDate", errors);
            if (dueDate) data.dueDate = dueDate;
        }
    }
    if (input.currency !== undefined) data.currency = trimString(input.currency) || "EGP";
    if (input.accountId !== undefined) {
        const accountId = Number(input.accountId);
        const account = await getActiveAccount(accountId);
        if (!account) errors.accountId = "Account not found or inactive";
        else data.account = { connect: { id: accountId } };
    }

    if (paidAmount > totalAmount) errors.paidAmount = "Paid amount cannot exceed total";
    if (Object.keys(errors).length > 0) throw new FinanceValidationError(errors);

    data.status = resolveLiabilityStoredStatus(totalAmount, paidAmount, dueDate, input.status);

    const creditorName = input.creditor !== undefined ? trimString(input.creditor) : existing.creditor;
    const liabilityAccountId = input.accountId !== undefined ? Number(input.accountId) : existing.accountId;
    const liabilityDescription = input.description !== undefined
        ? trimString(input.description) || null
        : existing.description;
    const shouldSyncPayment = (input.paidAmount !== undefined && paidAmount !== toNumber(existing.paidAmount))
        || (input.accountId !== undefined && liabilityAccountId !== existing.accountId)
        || (input.creditor !== undefined && creditorName !== existing.creditor)
        || (input.description !== undefined && liabilityDescription !== existing.description);

    const updated = await prisma.$transaction(async (tx) => {
        const row = await tx.financeLiability.update({
            where: { id },
            data,
            include: { account: { select: { name: true } } },
        });

        if (shouldSyncPayment) {
            await syncLiabilityPaymentTransaction(
                id,
                liabilityAccountId,
                creditorName,
                paidAmount,
                liabilityDescription,
                createdByMemberId,
                tx,
            );
        }

        return row;
    });

    return mapLiabilityRow(updated);
}

export async function createScheduledItem(input: CreateFinanceScheduledItemInput): Promise<FinanceScheduledItemRow> {
    const errors: Record<string, string> = {};
    const title = trimString(input.title);
    if (!title) errors.title = "Title is required";

    if (!SCHEDULED_TYPES.includes(input.type)) errors.type = "Invalid type";

    const amount = parsePositiveAmount(input.amount, "amount", errors);
    const dueDate = parseDate(input.dueDate, "dueDate", errors);
    const recurrence = input.recurrence !== undefined
        ? parseRecurrence(input.recurrence, "recurrence", errors)
        : null;

    const accountId = Number(input.accountId);
    if (!accountId) errors.accountId = "Account is required";

    if (Object.keys(errors).length > 0) throw new FinanceValidationError(errors);

    const account = await getActiveAccount(accountId);
    if (!account) throw new FinanceValidationError({ accountId: "Account not found or inactive" });

    const created = await prisma.financeScheduledItem.create({
        data: {
            title,
            type: input.type,
            amount: amount!,
            dueDate: dueDate!,
            accountId,
            recurrence,
            notes: trimString(input.notes) || null,
        },
        include: { account: { select: { name: true } } },
    });

    return mapScheduledItemRow(created);
}

export async function updateScheduledItem(
    id: number,
    input: UpdateFinanceScheduledItemInput,
): Promise<FinanceScheduledItemRow> {
    const existing = await prisma.financeScheduledItem.findUnique({ where: { id } });
    if (!existing) throw new Error("Scheduled item not found");

    const errors: Record<string, string> = {};
    const data: Prisma.FinanceScheduledItemUpdateInput = {};

    if (input.title !== undefined) {
        const title = trimString(input.title);
        if (!title) errors.title = "Title is required";
        else data.title = title;
    }
    if (input.type !== undefined) {
        if (!SCHEDULED_TYPES.includes(input.type)) errors.type = "Invalid type";
        else data.type = input.type;
    }
    if (input.amount !== undefined) {
        const amount = parsePositiveAmount(input.amount, "amount", errors);
        if (amount != null) data.amount = amount;
    }
    if (input.dueDate !== undefined) {
        const dueDate = parseDate(input.dueDate, "dueDate", errors);
        if (dueDate) data.dueDate = dueDate;
    }
    if (input.accountId !== undefined) {
        const accountId = Number(input.accountId);
        if (!accountId) {
            errors.accountId = "Account is required";
        } else {
            const account = await getActiveAccount(accountId);
            if (!account) errors.accountId = "Account not found or inactive";
            else data.account = { connect: { id: accountId } };
        }
    }
    if (input.recurrence !== undefined) {
        data.recurrence = parseRecurrence(input.recurrence, "recurrence", errors);
    }
    if (input.notes !== undefined) data.notes = trimString(input.notes) || null;
    if (input.isCompleted !== undefined) data.isCompleted = !!input.isCompleted;

    if (Object.keys(errors).length > 0) throw new FinanceValidationError(errors);

    const updated = await prisma.financeScheduledItem.update({
        where: { id },
        data,
        include: { account: { select: { name: true } } },
    });

    return mapScheduledItemRow(updated);
}
