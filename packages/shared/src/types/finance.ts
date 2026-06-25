import type { Id, ISODateTime } from "./member";

export type FinanceAccountType = "BANK" | "CASH" | "DIGITAL" | "OTHER";
export type FinanceTransactionType = "INCOME" | "EXPENSE" | "TRANSFER";
export type FinanceScheduledItemType = "INCOME" | "EXPENSE";
export type FinanceScheduledRecurrence = "WEEKLY" | "MONTHLY" | "YEARLY";
export type FinanceLiabilityStatus = "ACTIVE" | "PAID" | "OVERDUE";

/** Default transaction categories; merged with distinct DB values on the dashboard. */
export const FINANCE_TRANSACTION_CATEGORIES = [
    "Sponsorship",
    "Event Revenue",
    "Venue",
    "Marketing",
    "Supplies",
    "Membership Fees",
    "Catering",
    "Equipment",
    "Transport",
    "Donations",
] as const;

export interface FinanceAccountSummary {
    id: Id;
    name: string;
    accountType: FinanceAccountType;
    currency: string;
    openingBalance: number;
    currentBalance: number;
    isActive: boolean;
    description: string | null;
}

export interface FinanceTransactionRow {
    id: Id;
    accountId: Id;
    accountName: string;
    type: FinanceTransactionType;
    amount: number;
    category: string;
    description: string | null;
    transactionDate: string;
    reference: string | null;
    createdAt: ISODateTime;
}

export interface FinanceLiabilityRow {
    id: Id;
    creditor: string;
    description: string | null;
    totalAmount: number;
    paidAmount: number;
    remainingAmount: number;
    dueDate: string | null;
    status: FinanceLiabilityStatus;
    currency: string;
    accountId: Id;
    accountName: string;
    progressPercent: number;
}

export interface FinanceScheduledItemRow {
    id: Id;
    title: string;
    type: FinanceScheduledItemType;
    amount: number;
    dueDate: string;
    recurrence: FinanceScheduledRecurrence | null;
    accountId: Id;
    accountName: string;
    isCompleted: boolean;
    notes: string | null;
    daysUntilDue: number;
}

export interface FinanceBalancePoint {
    date: string;
    balance: number;
}

export interface FinanceIncomeExpensePoint {
    month: string;
    income: number;
    expense: number;
}

export interface FinanceCategoryBreakdownPoint {
    category: string;
    amount: number;
}

export interface FinanceDashboardResponse {
    accounts: FinanceAccountSummary[];
    totalBalance: number;
    currency: string;
    balanceOverTime: FinanceBalancePoint[];
    incomeVsExpenseByMonth: FinanceIncomeExpensePoint[];
    expenseByCategory: FinanceCategoryBreakdownPoint[];
    liabilities: FinanceLiabilityRow[];
    upcomingScheduledItems: FinanceScheduledItemRow[];
    categories: string[];
}

export interface FinanceTransactionFilters {
    accountId?: Id;
    type?: FinanceTransactionType;
    category?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    page?: number;
    pageSize?: number;
}

export interface FinanceTransactionListResponse {
    items: FinanceTransactionRow[];
    total: number;
    page: number;
    pageSize: number;
}

export interface FinanceExportResponse {
    exportedAt: string;
    accounts: FinanceAccountSummary[];
    transactions: FinanceTransactionRow[];
    liabilities: FinanceLiabilityRow[];
    scheduledItems: FinanceScheduledItemRow[];
}

export interface CreateFinanceAccountInput {
    name: string;
    accountType: FinanceAccountType;
    currency?: string;
    openingBalance?: number;
    description?: string | null;
}

export interface UpdateFinanceAccountInput {
    name?: string;
    accountType?: FinanceAccountType;
    currency?: string;
    openingBalance?: number;
    description?: string | null;
    isActive?: boolean;
}

export interface CreateFinanceTransactionInput {
    accountId: Id;
    type: "INCOME" | "EXPENSE";
    amount: number;
    category: string;
    transactionDate: string;
    description?: string | null;
    reference?: string | null;
}

export interface UpdateFinanceTransactionInput {
    accountId?: Id;
    type?: "INCOME" | "EXPENSE";
    amount?: number;
    category?: string;
    transactionDate?: string;
    description?: string | null;
    reference?: string | null;
}

export interface CreateFinanceLiabilityInput {
    creditor: string;
    description?: string | null;
    totalAmount: number;
    paidAmount?: number;
    dueDate?: string | null;
    currency?: string;
    status?: FinanceLiabilityStatus;
    accountId: Id;
}

export interface UpdateFinanceLiabilityInput {
    creditor?: string;
    description?: string | null;
    totalAmount?: number;
    paidAmount?: number;
    dueDate?: string | null;
    currency?: string;
    status?: FinanceLiabilityStatus;
    accountId?: Id;
}

export interface CreateFinanceScheduledItemInput {
    title: string;
    type: FinanceScheduledItemType;
    amount: number;
    dueDate: string;
    accountId: Id;
    recurrence?: FinanceScheduledRecurrence | null;
    notes?: string | null;
}

export interface UpdateFinanceScheduledItemInput {
    title?: string;
    type?: FinanceScheduledItemType;
    amount?: number;
    dueDate?: string;
    accountId?: Id;
    recurrence?: FinanceScheduledRecurrence | null;
    notes?: string | null;
    isCompleted?: boolean;
}
