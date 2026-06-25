import type { FinanceExportResponse } from "@iclub/shared";
import {
    listAccounts,
    listAllScheduledItems,
    listAllTransactions,
    listLiabilities,
} from "./finance";

export async function getFinanceExportData(): Promise<FinanceExportResponse> {
    const [accounts, transactions, liabilities, scheduledItems] = await Promise.all([
        listAccounts(),
        listAllTransactions(),
        listLiabilities(),
        listAllScheduledItems(),
    ]);

    return {
        exportedAt: new Date().toISOString(),
        accounts,
        transactions,
        liabilities,
        scheduledItems,
    };
}
