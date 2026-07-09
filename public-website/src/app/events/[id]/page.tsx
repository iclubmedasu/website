import type { Metadata } from "next";
import { CalendarDays, MapPin, Users } from "lucide-react";
import { notFound } from "next/navigation";
import { EventDetailActions } from "@/components/events/EventDetailActions";
import { EventDetailHeader } from "@/components/events/EventDetailHeader";
import { BackLink } from "@/components/navigation/BackLink";
import { PageContainer } from "@/components/ui";
import { ClientEventDateRange, ClientRegistrationDeadline } from "@/components/datetime/ClientDateTime";
import { publicAPI } from "@/lib/api";
import { formatCapacityLabel, formatTierPrice } from "@/lib/customFieldUtils";

interface EventDetailPageProps {
    params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: EventDetailPageProps): Promise<Metadata> {
    const { id } = await params;
    const event = await publicAPI.getEvent(Number(id));
    return {
        title: event?.title ?? "Event",
        description: event?.description ?? undefined,
    };
}

export default async function EventDetailPage({ params }: EventDetailPageProps) {
    const { id } = await params;
    const eventId = Number(id);
    if (Number.isNaN(eventId)) {
        notFound();
    }

    const [event, tiers] = await Promise.all([
        publicAPI.getEvent(eventId),
        publicAPI.getEventTiers(eventId),
    ]);

    if (!event) {
        notFound();
    }

    const capacityLabel = formatCapacityLabel(event.spotsRemaining, event.capacity);

    return (
        <PageContainer className="space-y-10 py-10 sm:py-14">
            <BackLink href="/events" label="Back to Events" />
            <section className="max-w-3xl space-y-4">
                <EventDetailHeader
                    eventId={event.id}
                    eventTitle={event.title}
                    projectTypeName={event.projectType?.name}
                    description={event.description}
                />
                <div className="flex flex-col gap-3 text-sm text-slate-600">
                    <p className="inline-flex items-start gap-2">
                        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-purple-700" />
                        <ClientEventDateRange
                            eventDate={event.eventDate}
                            eventEndDate={event.eventEndDate}
                        />
                    </p>
                    {event.venue ? (
                        <p className="inline-flex items-start gap-2">
                            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-purple-700" />
                            {event.venue}
                        </p>
                    ) : null}
                    <p className="inline-flex items-center gap-2">
                        <Users className="h-4 w-4 shrink-0 text-purple-700" />
                        {capacityLabel}
                    </p>
                    <ClientRegistrationDeadline value={event.registrationDeadline} />
                </div>
                <div className="pt-2">
                    <EventDetailActions eventId={event.id} registrationOpen={event.registrationOpen} />
                </div>
            </section>

         {/*   {tiers.length > 0 ? (
                 <section className="space-y-4">
                    <h2 className="text-2xl font-semibold text-purple-900">Registration Tiers</h2>
                    <div className="grid gap-4 md:grid-cols-2">
                        {tiers.map((tier) => {
                            const priceLabel = formatTierPrice(tier.price, tier.currency);
                            const tierCapacity = formatCapacityLabel(tier.spotsRemaining, tier.maxCapacity);
                            return (
                                <article key={tier.id} className="tier-card">
                                    <h3 className="tier-card-title">{tier.name}</h3>
                                    {tier.description ? (
                                        <p className="tier-card-description">{tier.description}</p>
                                    ) : null}
                                    <div className="tier-card-meta">
                                        <p>Price: {priceLabel}</p>
                                        <p>{tierCapacity}</p>
                                    </div>
                                </article>
                            );
                        })}
                    </div>
                </section> 
            ) : null} */}
        </PageContainer>
    );
}
