import { AlertCircle, Archive, CheckCircle, CheckSquare, Globe, PauseCircle } from 'lucide-react';
import type { CardViewModel } from './types';

export function isProjectAborted(project: CardViewModel | null | undefined): boolean {
    return project?.status === 'CANCELLED' && !project?.isArchived;
}

export function isProjectInactive(project: CardViewModel | null | undefined): boolean {
    return !!project && !project.isActive && !project.isFinalized && !project.isArchived && project.status !== 'CANCELLED';
}

export function getLifecycleBadge(project: CardViewModel | null | undefined): {
    className: string;
    label: string;
    icon: typeof Archive;
    title: string;
} {
    if (project?.isArchived) {
        return { className: 'badge-lifecycle-archived', label: 'Archived', icon: Archive, title: 'Archived' };
    }
    if (project?.isFinalized) {
        return { className: 'badge-lifecycle-finalized', label: 'Finalized', icon: CheckCircle, title: 'Finalized' };
    }
    if (project?.status === 'CANCELLED') {
        return { className: 'badge-lifecycle-aborted', label: 'Aborted', icon: AlertCircle, title: 'Aborted' };
    }
    if (project && !project.isActive) {
        return { className: 'badge-lifecycle-hold', label: 'On Hold', icon: PauseCircle, title: 'On Hold' };
    }
    return { className: 'badge-lifecycle-active', label: 'Active', icon: CheckSquare, title: 'Active' };
}

export function getArchiveOutcomeBadge(project: CardViewModel | null | undefined): {
    className: string;
    label: string;
    icon: typeof Archive;
    title: string;
} | null {
    if (!project?.isArchived) return null;
    if (project.isFinalized) {
        return { className: 'badge-lifecycle-finalized', label: 'Finalized', icon: CheckCircle, title: 'Archived after finalizing' };
    }
    if (project.status === 'CANCELLED') {
        return { className: 'badge-lifecycle-aborted', label: 'Aborted', icon: AlertCircle, title: 'Archived after being aborted' };
    }
    return null;
}

export function getWebsiteDisclosedBadge(item: CardViewModel | null | undefined): {
    className: string;
    label: string;
    icon: typeof Globe;
    title: string;
} | null {
    if (!item?.isArchived || !item?.isDisclosed) return null;
    return {
        className: 'badge-website-disclosed',
        label: 'On website',
        icon: Globe,
        title: 'Visible on the public website',
    };
}
