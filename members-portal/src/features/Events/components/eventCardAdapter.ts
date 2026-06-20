import type { EventDetail, EventSummary } from '@/types/backend-contracts';

export interface EventCardViewModel {
    id?: EventSummary['id'];
    title: string;
    description?: string | null;
    status: string;
    priority?: string | null;
    dueDate?: string | null;
    createdAt?: string | null;
    isActive?: boolean;
    isFinalized?: boolean;
    isArchived?: boolean;
    projectType?: EventSummary['projectType'];
    projectTeams?: Array<{
        id?: number;
        teamId?: EventSummary['id'];
        canEdit?: boolean;
        isOwner?: boolean;
        team?: { name?: string | null };
    }>;
    createdBy?: EventSummary['createdBy'];
}

export function normalizeEventDescription(description?: string | null): string | null {
    if (description == null) return null;
    const text = description.trim();
    if (!text || text.toLowerCase() === 'null') return null;
    return text;
}

export function eventToCardViewModel(event: EventSummary | EventDetail): EventCardViewModel {
    return {
        id: event.id,
        title: event.title,
        description: normalizeEventDescription(event.description),
        status: event.status ?? 'NOT_STARTED',
        priority: event.priority,
        dueDate: event.eventDate,
        createdAt: (event as EventDetail & { createdAt?: string }).createdAt ?? null,
        isActive: event.isActive,
        isFinalized: event.isFinalized,
        isArchived: event.isArchived,
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
