import type { Metadata } from 'next';
import { Suspense } from 'react';
import EmployeeKPIsPage from '@/features/EmployeeKPIs/EmployeeKPIsPage';

export const metadata: Metadata = {
    title: 'Employee KPIs | iClub Members Portal',
    description: 'View employee project and event task KPIs.',
};

export default function EmployeeKpisRoute() {
    return (
        <Suspense
            fallback={
                <main className="members-page kpi-page">
                    <div className="loading-message">Loading employee KPIs…</div>
                </main>
            }
        >
            <EmployeeKPIsPage />
        </Suspense>
    );
}
