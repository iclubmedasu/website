import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RegisterPageContent } from "@/components/public-data/RegisterPageContent";

interface RegisterPageProps {
    params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
    title: "Register",
};

export default async function RegisterPage({ params }: RegisterPageProps) {
    const { id } = await params;
    const eventId = Number(id);
    if (Number.isNaN(eventId)) {
        notFound();
    }

    return <RegisterPageContent eventId={eventId} />;
}
