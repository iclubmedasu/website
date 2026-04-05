import type { Metadata } from 'next';

import AlumniPage from "@/features/Personnel/Alumni/AlumniPage";

export const metadata: Metadata = {
    title: 'Alumni | iClub Members Portal',
    description: 'Review alumni records and profiles.',
};

export default function AlumniRoutePage() {
    return <AlumniPage />;
}
