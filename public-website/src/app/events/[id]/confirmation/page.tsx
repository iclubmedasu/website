import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ConfirmationFromCache } from "@/components/registration/ConfirmationFromCache";
import { RegistrationConfirmation } from "@/components/registration/RegistrationConfirmation";
import { BackLink } from "@/components/navigation/BackLink";
import { PageContainer } from "@/components/ui";
import { publicAPI } from "@/lib/api";

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

    const confirmation = await publicAPI.getRegistrationConfirmation(eventId, code);
    if (!confirmation) {
        notFound();
    }

    return (
        <PageContainer className="max-w-3xl py-10 sm:py-14">
            <BackLink href={`/events/${eventId}`} label="Back to event" />
            <RegistrationConfirmation confirmation={confirmation} />
        </PageContainer>
    );
}
