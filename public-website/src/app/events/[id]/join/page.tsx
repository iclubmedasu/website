import { notFound, redirect } from "next/navigation";
import { resolveApiBaseUrl } from "@/lib/api";

interface JoinPageProps {
    params: Promise<{ id: string }>;
    searchParams: Promise<{ token?: string }>;
}

export default async function JoinPage({ params, searchParams }: JoinPageProps) {
    const { id } = await params;
    const { token } = await searchParams;
    const eventId = Number(id);
    const trimmedToken = token?.trim();

    if (!Number.isInteger(eventId) || eventId <= 0 || !trimmedToken) {
        notFound();
    }

    const apiBase = resolveApiBaseUrl().replace(/\/$/, "");
    const joinUrl = `${apiBase}/events/${eventId}/join?token=${encodeURIComponent(trimmedToken)}`;
    redirect(joinUrl);
}
