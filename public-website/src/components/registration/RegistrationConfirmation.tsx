import type { PublicRegistrationConfirmation } from "@iclub/shared";
import { EventTicketDisplay } from "./EventTicketDisplay";

interface RegistrationConfirmationProps {
    confirmation: PublicRegistrationConfirmation;
}

export function RegistrationConfirmation({ confirmation }: RegistrationConfirmationProps) {
    return (
        <div className="space-y-6">
            <section className="confirmation-hero">
                <h1 className="confirmation-hero-title">Registration confirmed</h1>
                <p className="mt-3 text-purple-100">
                    You are registered for {confirmation.event.title}. Save your ticket below or check your email.
                </p>
            </section>

            <EventTicketDisplay confirmation={confirmation} />
        </div>
    );
}
