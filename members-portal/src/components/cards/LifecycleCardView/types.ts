import type {
    Difficulty,
    Id,
    MemberSummary,
    Priority,
    ProjectStatus,
    ProjectTypeRef,
    TaskStatus,
} from '@/types/backend-contracts';

export type CardStatusValue = ProjectStatus | TaskStatus | string;
export type CardPriorityValue = Priority | 'URGENT' | string;

export interface CardTeamView {
    id?: Id | number;
    teamId?: Id;
    canEdit?: boolean;
    isOwner?: boolean;
    team?: {
        name?: string | null;
    };
}

export interface CardViewModel {
    id?: Id;
    title: string;
    name?: string | null;
    description?: string | null;
    status: CardStatusValue;
    priority?: CardPriorityValue | null;
    dueDate?: string | null;
    createdAt?: string | null;
    startDate?: string | null;
    isActive?: boolean;
    isFinalized?: boolean;
    isArchived?: boolean;
    projectType?: ProjectTypeRef | null;
    projectTeams?: CardTeamView[];
    createdBy?: MemberSummary | null;
    difficulty?: Difficulty;
}

/** @deprecated Use CardViewModel */
export type ProjectCardViewModel = CardViewModel;

export interface LifecycleItemTarget {
    id?: Id;
    title: string;
    status?: CardStatusValue;
    isActive?: boolean;
    isFinalized?: boolean;
    isArchived?: boolean;
}
