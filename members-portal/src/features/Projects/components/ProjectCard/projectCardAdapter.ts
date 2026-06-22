import type { ProjectDetail, ProjectSummary } from '@/types/backend-contracts';
import type { CardViewModel } from '@/components/cards/LifecycleCardView/types';

export function projectToCardViewModel(project: ProjectSummary | ProjectDetail | CardViewModel): CardViewModel {
    const source = project as CardViewModel & ProjectDetail;
    return {
        id: source.id,
        title: source.title,
        description: source.description,
        status: source.status,
        priority: source.priority,
        dueDate: source.dueDate,
        createdAt: source.createdAt ?? null,
        startDate: source.startDate,
        isActive: source.isActive,
        isFinalized: source.isFinalized,
        isArchived: source.isArchived,
        projectType: source.projectType,
        projectTeams: source.projectTeams,
        createdBy: source.createdBy ?? null,
    };
}
