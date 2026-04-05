import type { Id, ISODateTime } from "./member";
import type { TaskSummary } from "./task";

export interface PhaseSummary {
    id: Id;
    projectId: Id;
    title: string;
    description?: string | null;
    order?: number;
    wbs?: string;
    isActive?: boolean;
    tasks?: TaskSummary[];
    _count?: {
        tasks: number;
    };
}

export interface Phase {
    id: Id;
    projectId: Id;
    title: string;
    description: string | null;
    order: number;
    wbs: string;
    isActive: boolean;
    createdAt: ISODateTime;
    updatedAt: ISODateTime;
}

export interface CreatePhasePayload {
    projectId: Id;
    title: string;
    description?: string | null;
    order?: number;
}

export interface UpdatePhasePayload {
    title?: string;
    description?: string | null;
    order?: number;
    isActive?: boolean;
}

export interface DuplicatePhaseInput {
    afterOrder?: number;
}
