import type { Metadata } from 'next';

import TeamsPage from "@/features/Personnel/Teams/TeamsPage";

export const metadata: Metadata = {
    title: 'Teams | iClub Members Portal',
    description: 'Organize teams, roles, and assignments.',
};

export default function TeamsRoutePage() {
    return <TeamsPage />;
}
