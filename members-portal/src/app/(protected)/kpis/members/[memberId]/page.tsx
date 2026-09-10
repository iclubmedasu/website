import type { Metadata } from 'next';
import { Suspense } from 'react';
import EmployeeKPIDetailPage from '@/features/EmployeeKPIs/EmployeeKPIDetailPage';

export const metadata: Metadata = {
    title: 'Employee KPI Detail | iClub Members Portal',
    description: 'View detailed employee KPI metrics and tasks.',
};

export default function EmployeeKpiDetailRoute() {
    return (
        <Suspense
            fallback={
                <main className="members-page kpi-page">
                    <div className="loading-message">Loading employee KPI detail…</div>
                </main>
            }
        >
            <EmployeeKPIDetailPage />
        </Suspense>
    );
}
