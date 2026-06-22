'use client';

import { useState, useEffect, useCallback } from 'react';
import { Archive, Calendar, Paperclip, SquareCheckBig } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { phasesAPI, projectFilesAPI } from '@/services/api';
import FileUploadZone from '@/components/FileUpload/FileUploadZone';
import type { EntityFilesAPI } from '@/components/FileUpload/types';
import LifecycleCardView, {
    fmtDate,
    getArchiveOutcomeBadge,
    getLifecycleBadge,
} from '@/components/cards/LifecycleCardView/LifecycleCardView';
import LifecycleCardActions from '@/components/cards/LifecycleCardView/LifecycleCardActions';
import GanttChart from '../GanttChart/GanttChart';
import AddPhaseModal from '../../modals/AddPhaseModal';
import AddTaskModal from '../../modals/AddTaskModal';
import EditTaskModal from '../../modals/EditTaskModal';
import TaskCommentsModal from '../../modals/TaskCommentsModal';
import TaskScheduleSlotsModal from '../../modals/TaskScheduleSlotsModal';
import TaskActivityModal from '../../modals/TaskActivityModal';
import EditPhaseModal from '../../modals/EditPhaseModal';
import DeletePhaseTaskModal from '../../modals/DeletePhaseTaskModal';
import { projectToCardViewModel } from './projectCardAdapter';
import type { Id, ProjectDetail, ProjectFileRef, ProjectFolderRef, ProjectSummary } from '@/types/backend-contracts';

export interface PastProjectSummary extends ProjectSummary {
    createdAt?: string | null;
    _count?: {
        tasks?: number;
        phases?: number;
    };
}

export interface ProjectActionTarget {
    id: Id;
    title: string;
}

export type ProjectActionPayload = PastProjectSummary | ProjectDetail | ProjectActionTarget;

export interface ProjectCardProps {
    project: any;
    expanded: boolean;
    fullDetail: any;
    detailLoading: boolean;
    onToggle: (project: any) => void;
    onViewActivity: (project: any) => void;
    archivedView?: boolean;
    onReactivate?: (project: any) => void;
    onAbort?: (project: any) => void;
    onFinalize?: (project: any) => void;
    onArchive?: (project: any) => void;
    onEdit?: (project: any) => void;
    onDeactivate?: (project: any) => void;
    onRefreshDetail?: (projectId: Id) => void;
    allMembers?: any[];
    canEdit?: boolean;
    canManage?: boolean;
    canUpload?: boolean;
    canEditStructure?: boolean;
    canEditStatus?: boolean;
}

export default function ProjectCard({
    project,
    expanded,
    fullDetail,
    detailLoading,
    onToggle,
    onViewActivity,
    archivedView = false,
    onReactivate,
    onAbort,
    onFinalize,
    onArchive,
    onEdit,
    onDeactivate,
    onRefreshDetail,
    allMembers = [],
    canEdit = false,
    canManage = false,
    canUpload = false,
    canEditStructure = false,
    canEditStatus = false,
}: ProjectCardProps) {
    const { user } = useAuth();
    const [localDetail, setLocalDetail] = useState<any>(fullDetail);
    useEffect(() => {
        if (!archivedView) setLocalDetail(fullDetail);
    }, [fullDetail, archivedView]);

    const handleTaskFieldUpdate = useCallback((phaseId: Id, taskId: Id, field: string, value: unknown) => {
        if (field === '__delete') {
            onRefreshDetail?.(localDetail?.id);
            return;
        }
        setLocalDetail((prev: any) => {
            if (!prev?.phases) return prev;
            return {
                ...prev,
                phases: (prev.phases as any[]).map((phase: any) => {
                    if (phase.id !== phaseId) return phase;
                    return {
                        ...phase,
                        tasks: ((phase.tasks as any[]) || []).map((task: any) => {
                            if (task.id === taskId) return { ...task, [field]: value };
                            if (task.subtasks?.length) {
                                return {
                                    ...task,
                                    subtasks: task.subtasks.map((s: any) =>
                                        s.id === taskId ? { ...s, [field]: value } : s
                                    ),
                                };
                            }
                            return task;
                        }),
                    };
                }),
            };
        });
    }, [localDetail?.id, onRefreshDetail]);
    void handleTaskFieldUpdate;

    const [projectFiles, setProjectFiles] = useState<ProjectFileRef[]>([]);
    const [projectFolders, setProjectFolders] = useState<ProjectFolderRef[]>([]);
    const detail = archivedView ? fullDetail : localDetail;
    const detailId = detail?.id as Id | undefined;

    useEffect(() => {
        if (expanded && detailId) {
            projectFilesAPI.getAll(detailId).then(setProjectFiles).catch(() => setProjectFiles([]));
            projectFilesAPI.getFolders(detailId, true).then(setProjectFolders).catch(() => setProjectFolders([]));
        }
    }, [expanded, detailId]);

    const [showAddPhase, setShowAddPhase] = useState(false);
    const [addTaskTarget, setAddTaskTarget] = useState<{ phaseId: Id; parentTask?: any } | null>(null);
    const [editTaskTarget, setEditTaskTarget] = useState<any>(null);
    const [taskCommentsTarget, setTaskCommentsTarget] = useState<any>(null);
    const [taskScheduleTarget, setTaskScheduleTarget] = useState<any>(null);
    const [taskActivityTarget, setTaskActivityTarget] = useState<any>(null);
    const [editPhaseTarget, setEditPhaseTarget] = useState<any>(null);
    const [confirmDeletePhase, setConfirmDeletePhase] = useState<any>(null);

    const cardItem = projectToCardViewModel(project);
    const detailCard = detail ? projectToCardViewModel(detail) : null;
    const lifecycleBadge = getLifecycleBadge(cardItem);
    const LifecycleIcon = lifecycleBadge.icon;
    const archiveOutcomeBadge = archivedView ? getArchiveOutcomeBadge(cardItem) : null;
    const ArchiveOutcomeIcon = archiveOutcomeBadge?.icon ?? Archive;
    const lifecycleMode = archivedView ? 'archived' as const : 'active' as const;

    const detailTarget = detail
        ? { id: detail.id, title: detail.title }
        : { id: project.id, title: project.title };

    const collapsedLifecycleHandlers = archivedView ? {
        onReactivate: () => onReactivate?.({ id: project.id, title: project.title }),
        onAbort: () => onAbort?.({ id: project.id, title: project.title }),
        onFinalize: () => onFinalize?.({ id: project.id, title: project.title }),
        onArchive: () => onArchive?.({ id: project.id, title: project.title }),
        onViewActivity: () => onViewActivity(project),
    } : {
        onEdit,
        onDeactivate,
        onFinalize,
        onArchive,
        onReactivate,
        onAbort,
        onViewActivity,
    };

    const expandedLifecycleHandlers = archivedView ? {
        onReactivate: () => onReactivate?.(detailTarget),
        onAbort: () => onAbort?.(detailTarget),
        onFinalize: () => onFinalize?.(detailTarget),
        onArchive: () => onArchive?.(detailTarget),
        onViewActivity: () => onViewActivity(detail || project),
    } : collapsedLifecycleHandlers;

    const effectiveCanEdit = archivedView ? false : canEdit;
    const effectiveCanManage = canManage;

    return (
        <LifecycleCardView
            item={cardItem}
            expanded={expanded}
            detail={detailCard}
            detailLoading={detailLoading}
            onToggle={onToggle}
            loadingTitle="Loading project details…"
            loadingText="Fetching phases, tasks, and activity history."
            accessDeniedTitle="You do not have access to this project"
            accessDeniedText="This project can't be opened with your current permissions."
            collapsedMeta={(
                <>
                    {archiveOutcomeBadge && (
                        <span className={`badge ${archiveOutcomeBadge.className}`} title={archiveOutcomeBadge.title}>
                            <ArchiveOutcomeIcon size={12} />
                            {archiveOutcomeBadge.label}
                        </span>
                    )}
                    <span className={`badge ${lifecycleBadge.className}`} title={lifecycleBadge.title}>
                        <LifecycleIcon size={12} />
                        {lifecycleBadge.label}
                    </span>
                </>
            )}
            collapsedActions={(
                <LifecycleCardActions
                    item={cardItem}
                    mode={lifecycleMode}
                    variant="collapsed"
                    canEdit={effectiveCanEdit}
                    canManage={effectiveCanManage}
                    entityLabel="project"
                    {...collapsedLifecycleHandlers}
                />
            )}
            collapsedFooterTrailing={(
                <div className="project-card-footer-trailing">
                    {archivedView ? (
                        project.dueDate && (
                            <div className="project-card-due">
                                <Calendar size={11} />
                                {fmtDate(project.dueDate)}
                            </div>
                        )
                    ) : (
                        <div className="project-card-due project-card-date-range">
                            <Calendar size={11} />
                            {fmtDate(project.startDate)} → {fmtDate(project.dueDate)}
                        </div>
                    )}
                    <div className="project-card-task-count">
                        <SquareCheckBig size={11} />
                        {project._count?.tasks ?? 0} task{project._count?.tasks !== 1 ? 's' : ''}
                        {' · '}
                        {project._count?.phases ?? 0} phase{project._count?.phases !== 1 ? 's' : ''}
                    </div>
                </div>
            )}
            expandedMeta={(
                <>
                    {archiveOutcomeBadge && (
                        <span className={`badge badge--compact ${archiveOutcomeBadge.className}`} title={archiveOutcomeBadge.title}>
                            <ArchiveOutcomeIcon size={14} />
                            {archiveOutcomeBadge.label}
                        </span>
                    )}
                    <span className={`badge badge--compact ${lifecycleBadge.className}`}>
                        <LifecycleIcon size={14} />
                        {lifecycleBadge.label}
                    </span>
                </>
            )}
            expandedActions={detail ? (
                <div className="expanded-title-actions">
                    <LifecycleCardActions
                        item={cardItem}
                        detail={archivedView ? detailTarget : detail}
                        mode={lifecycleMode}
                        variant="expanded"
                        canEdit={effectiveCanEdit}
                        canManage={effectiveCanManage}
                        entityLabel="project"
                        {...expandedLifecycleHandlers}
                    />
                </div>
            ) : null}
            teamEmptyMessage={archivedView ? undefined : 'No teams assigned'}
            formatAssignedTeamSuffix={(pt) => archivedView
                ? `${pt.isOwner ? ' ★' : ''}`
                : `${pt.isOwner ? ' ★' : ''}${!pt.canEdit ? ' (view)' : ''}`}
            detailExtra={archivedView && detail?.completedDate ? (
                <div className="exp-date-item">
                    <span className="exp-date-label">Completed</span>
                    <span className="exp-date-value">{fmtDate(detail.completedDate)}</span>
                </div>
            ) : null}
            afterSections={detail ? (
                <>
                    <div className="exp-card-section exp-card-section--flush">
                        <GanttChart
                            phases={detail.phases || []}
                            projectId={detail.id}
                            projectTitle={detail.title}
                            projectDetail={detail}
                            projectStartDate={detail.startDate}
                            projectDueDate={detail.dueDate}
                            currentMemberId={archivedView ? undefined : user?.id}
                            canEdit={archivedView ? false : canEditStructure}
                            canEditStatus={archivedView ? false : canEditStatus}
                            onAddPhase={archivedView ? () => { } : () => setShowAddPhase(true)}
                            onAddTask={archivedView ? () => { } : (phase: any) => setAddTaskTarget({ phaseId: phase.id })}
                            onAddSubtask={archivedView ? () => { } : (phase: any, parentTask: any) => setAddTaskTarget({ phaseId: phase.id, parentTask })}
                            onEditPhase={archivedView ? () => { } : (phase: any) => setEditPhaseTarget(phase)}
                            onEditTask={archivedView ? () => { } : (task: any) => setEditTaskTarget(task)}
                            onOpenTaskComments={archivedView ? () => { } : (task: any) => setTaskCommentsTarget(task)}
                            onOpenTaskScheduleSlots={archivedView ? () => { } : (task: any) => setTaskScheduleTarget(task)}
                            onOpenTaskActivity={archivedView ? () => { } : (task: any) => setTaskActivityTarget(task)}
                            onDeletePhase={archivedView ? () => { } : (phase: any) => setConfirmDeletePhase(phase)}
                            onRefresh={archivedView ? () => { } : () => onRefreshDetail?.(detail.id as Id)}
                        />
                    </div>
                    <div className="exp-card-section">
                        <div className="exp-card-section-header">
                            <Paperclip size={14} className="exp-card-section-icon" />
                            Project Files
                        </div>
                        <FileUploadZone
                            entityId={detail.id}
                            filesAPI={projectFilesAPI as EntityFilesAPI}
                            memberId={user?.id}
                            existingFiles={projectFiles}
                            existingFolders={projectFolders}
                            onFileUploaded={archivedView ? () => { } : (newFile, replaced) => setProjectFiles((prev) =>
                                replaced
                                    ? prev.map((f) => f.id === newFile.id ? newFile as ProjectFileRef : f)
                                    : [newFile as ProjectFileRef, ...prev]
                            )}
                            onFileRemoved={archivedView ? () => { } : (fileId) => setProjectFiles((prev) => prev.filter((f) => f.id !== fileId))}
                            onFileRenamed={archivedView ? () => { } : (updated) => setProjectFiles((prev) =>
                                prev.map((f) => f.id === updated.id ? { ...f, fileName: updated.fileName } : f)
                            )}
                            disabled={archivedView || !canUpload}
                        />
                    </div>
                    {!archivedView && editPhaseTarget && (
                        <EditPhaseModal
                            phase={editPhaseTarget}
                            onClose={() => setEditPhaseTarget(null)}
                            onPhaseUpdated={() => { setEditPhaseTarget(null); onRefreshDetail?.(detail.id as Id); }}
                        />
                    )}
                    {!archivedView && confirmDeletePhase && (
                        <DeletePhaseTaskModal
                            title="Delete Phase"
                            itemName={confirmDeletePhase.title as string}
                            message="All tasks, subtasks, and assignees in this phase will be permanently removed. This action cannot be undone."
                            confirmLabel="Delete Phase"
                            onConfirm={async () => {
                                await phasesAPI.remove(confirmDeletePhase.id as Id);
                                onRefreshDetail?.(detail.id as Id);
                            }}
                            onClose={() => setConfirmDeletePhase(null)}
                        />
                    )}
                    {!archivedView && showAddPhase && (
                        <AddPhaseModal
                            projectId={detail.id}
                            existingPhasesCount={(detail.phases as unknown[])?.length ?? 0}
                            onClose={() => setShowAddPhase(false)}
                            onPhaseCreated={() => { setShowAddPhase(false); onRefreshDetail?.(detail.id as Id); }}
                        />
                    )}
                    {!archivedView && addTaskTarget && (
                        <AddTaskModal
                            projectId={detail.id}
                            phaseId={addTaskTarget.phaseId}
                            parentTask={addTaskTarget.parentTask || null}
                            allMembers={allMembers}
                            onClose={() => setAddTaskTarget(null)}
                            onTaskCreated={() => { setAddTaskTarget(null); onRefreshDetail?.(detail.id as Id); }}
                        />
                    )}
                    {!archivedView && editTaskTarget && (
                        <EditTaskModal
                            task={editTaskTarget}
                            projectDetail={detail}
                            allMembers={allMembers}
                            onClose={() => setEditTaskTarget(null)}
                            onTaskUpdated={() => { setEditTaskTarget(null); onRefreshDetail?.(detail.id as Id); }}
                            onDependenciesChanged={() => onRefreshDetail?.(detail.id as Id)}
                        />
                    )}
                    {!archivedView && taskCommentsTarget && (
                        <TaskCommentsModal
                            task={taskCommentsTarget}
                            onClose={() => setTaskCommentsTarget(null)}
                        />
                    )}
                    {!archivedView && taskScheduleTarget && (
                        <TaskScheduleSlotsModal
                            task={taskScheduleTarget}
                            allMembers={allMembers}
                            currentMemberId={user?.id}
                            onClose={() => setTaskScheduleTarget(null)}
                        />
                    )}
                    {!archivedView && taskActivityTarget && (
                        <TaskActivityModal
                            task={taskActivityTarget}
                            onClose={() => setTaskActivityTarget(null)}
                        />
                    )}
                </>
            ) : null}
        />
    );
}
