import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { RegistrationForm } from "@/components/registration/RegistrationForm";
import { RegisterPageGuard } from "@/components/registration/RegisterPageGuard";
import { BackLink } from "@/components/navigation/BackLink";
import { PageContainer } from "@/components/ui";
import { publicAPI } from "@/lib/api";

interface RegisterPageProps {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: RegisterPageProps): Promise<Metadata> {
    const { id } = await params;
    const event = await publicAPI.getEvent(Number(id));
    return {
        title: event ? `Register · ${event.title}` : "Register",
    };
}

export default async function RegisterPage({ params }: RegisterPageProps) {
    const { id } = await params;
    const eventId = Number(id);
    if (Number.isNaN(eventId)) {
        notFound();
    }

    const event = await publicAPI.getEvent(eventId);
    if (!event) {
        notFound();
    }

    return (
        <PageContainer className="max-w-3xl space-y-6 py-10 sm:py-14">
            <BackLink href={`/events/${eventId}`} label="Back to event" />
            {!event.registrationOpen ? (
                <div className="registration-error-banner">
                    Registration is closed for this event. It may be full or past the registration deadline.
                </div>
            ) : (
                <RegisterPageGuard eventId={eventId}>
                    <RegistrationForm eventId={eventId} eventTitle={event.title} />
                </RegisterPageGuard>
            )}
        </PageContainer>
    );
}
