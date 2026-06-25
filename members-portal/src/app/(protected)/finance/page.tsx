import type { Metadata } from 'next'
import FinanceDashboardPage from '@/features/Finance/FinanceDashboardPage'

export const metadata: Metadata = {
    title: 'Finance | iClub Members Portal',
    description: 'Track club accounts, transactions, liabilities, and scheduled items.',
}

export default function FinanceRoute() {
    return <FinanceDashboardPage />
}
