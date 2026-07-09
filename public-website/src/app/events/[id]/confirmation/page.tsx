import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmationFromCache } from "@/components/registration/ConfirmationFromCache";
import { ConfirmationPageContent } from "@/components/public-data/ConfirmationPageContent";
import { BackLink } from "@/components/navigation/BackLink";
import { PageContainer } from "@/components/ui";

interface ConfirmationPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ code?: string }>;
}

export const metadata: Metadata = {
    title: "Registration Confirmed",
};

export default async function ConfirmationPage({ params, searchParams }: ConfirmationPageProps) {
    const { id } = await params;
    const { code } = await searchParams;
    const eventId = Number(id);

    if (Number.isNaN(eventId)) {
        notFound();
    }

    if (!code?.trim()) {
        return (
            <PageContainer className="max-w-3xl py-10 sm:py-14">
                <BackLink href={`/events/${eventId}`} label="Back to event" />
                <ConfirmationFromCache eventId={eventId} />
            </PageContainer>
        );
    }

    return <ConfirmationPageContent eventId={eventId} code={code.trim()} />;
}
