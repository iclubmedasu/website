import type { EventDetail, EventSummary } from '@/types/backend-contracts';
import type { CardViewModel } from '@/components/cards/LifecycleCardView/types';

export function normalizeEventDescription(description?: string | null): string | null {
    if (description == null) return null;
    const text = description.trim();
    if (!text || text.toLowerCase() === 'null') return null;
    return text;
}

export function eventToCardViewModel(event: EventSummary | EventDetail): CardViewModel {
    return {
        id: event.id,
        title: event.title,
        description: normalizeEventDescription(event.description),
        status: event.status ?? 'NOT_STARTED',
        priority: event.priority,
        dueDate: event.eventEndDate ?? event.eventDate,
        createdAt: (event as EventDetail & { createdAt?: string }).createdAt ?? null,
        isActive: event.isActive,
        isFinalized: event.isFinalized,
        isArchived: event.isArchived,
        isDisclosed: event.isDisclosed,
        projectType: event.projectType,
        projectTeams: event.eventTeams?.map((eventTeam, index) => ({
            id: index,
            teamId: eventTeam.teamId,
            canEdit: eventTeam.canEdit,
            isOwner: eventTeam.isOwner,
            team: eventTeam.team,
        })),
        createdBy: event.createdBy,
    };
}
