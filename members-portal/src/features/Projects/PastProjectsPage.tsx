'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Archive,
    Search,
    Filter,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { projectsAPI, teamsAPI, membersAPI, projectTypesAPI } from '../../services/api';
import { buildSearchText, matchesSearchQuery } from '../../utils/search';
import './ProjectsPage.css';
import ProjectCard, { type PastProjectSummary, type ProjectActionPayload } from './components/ProjectCard/ProjectCard';
import ReactivateProjectModal from './modals/ReactivateProjectModal';
import FinalizeProjectModal from './modals/FinalizeProjectModal';
import ArchiveProjectModal from './modals/ArchiveProjectModal';
import AbortProjectModal from './modals/AbortProjectModal';
import ProjectActivityModal from './modals/ProjectActivityModal';
import ProjectFiltersModal, { type ProjectFiltersState } from './modals/ProjectFiltersModal';
import { isDateWithinRange } from '../../utils/filterDateRange';
import type {
    Id,
    MemberSummary,
    ProjectDetail,
    ProjectTypeRef,
    TeamRef,
} from '../../types/backend-contracts';

// ─────────────────────────────────────────────────────────
//  Small helpers
// ─────────────────────────────────────────────────────────
type PriorityKey = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

type ProjectActionType = 'reactivate' | 'abort' | 'finalize' | 'publish' | 'archive' | 'activity';

const PRIORITY_ORDER: Record<PriorityKey, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };

function getPageNumbers(current: number, total: number): Array<number | '...'> {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: Array<number | '...'> = [];
    pages.push(1);
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
}

// ─────────────────────────────────────────────────────────
//  Main Page
// ─────────────────────────────────────────────────────────
export default function PastProjectsPage() {
    const { user } = useAuth();
    const [projects, setProjects] = useState<PastProjectSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [allTeams, setAllTeams] = useState<TeamRef[]>([]);
    const [, setAllMembers] = useState<MemberSummary[]>([]);
    const [allCategories, setAllCategories] = useState<string[]>([]);

    // Filters
    const [filterTeam, setFilterTeam] = useState('');
    const [filterCategory, setFilterCategory] = useState('');
    const [filterPriority, setFilterPriority] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showFiltersModal, setShowFiltersModal] = useState(false);

    // Pagination
    const PROJECTS_PER_PAGE = 10;
    const [currentPage, setCurrentPage] = useState(1);

    // Expanded card state
    const [expandedProjectId, setExpandedProjectId] = useState<Id | null>(null);
    const [expandedProjectDetail, setExpandedProjectDetail] = useState<ProjectDetail | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [actionProject, setActionProject] = useState<{ type: ProjectActionType; project: ProjectActionPayload } | null>(null);
    const canManageProjectLifecycle = !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin || user?.isLeadership);
    const hasActiveFilters = filterTeam !== '' || filterCategory !== '' || filterPriority !== ''
        || filterStatus !== '' || dateFrom !== '' || dateTo !== '';

    const handleApplyFilters = (filters: ProjectFiltersState) => {
        setFilterTeam(filters.filterTeam);
        setFilterCategory(filters.filterCategory);
        setFilterPriority(filters.filterPriority);
        setFilterStatus(filters.filterStatus);
        setDateFrom(filters.dateFrom);
        setDateTo(filters.dateTo);
        setShowFiltersModal(false);
    };

    const handleResetFilters = () => {
        setFilterTeam('');
        setFilterCategory('');
        setFilterPriority('');
        setFilterStatus('');
        setDateFrom('');
        setDateTo('');
    };

    // Load supporting data
    useEffect(() => {
        Promise.all([
            teamsAPI.getAll(undefined, 'all').catch(() => [] as TeamRef[]),
            membersAPI.getAll(true).catch(() => [] as MemberSummary[]),
            projectTypesAPI.getAll().catch(() => [] as ProjectTypeRef[]),
        ]).then(([teams, members, types]) => {
            const teamsList = Array.isArray(teams) ? (teams as TeamRef[]) : [];
            const membersList = Array.isArray(members) ? (members as MemberSummary[]) : [];
            const typeList = Array.isArray(types) ? (types as ProjectTypeRef[]) : [];
            setAllTeams(teamsList);
            setAllMembers(membersList);
            const cats = [...new Set(typeList.map((t) => t.category).filter((category): category is string => Boolean(category)))];
            setAllCategories(cats);
        });
    }, []);

    // Load archived projects
    const loadProjects = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const data = await projectsAPI.getAll({
                archived: true,
                teamId: filterTeam ? Number(filterTeam) : undefined,
                priority: (filterPriority || undefined) as any,
                status: (filterStatus || undefined) as any,
            }) as PastProjectSummary[];

            let filtered = data;
            if (filterCategory) {
                filtered = data.filter((p: PastProjectSummary) => p.projectType?.category === filterCategory);
            }
            filtered.sort((a: PastProjectSummary, b: PastProjectSummary) => {
                const priorityA = PRIORITY_ORDER[(a.priority as PriorityKey) || 'LOW'] ?? 99;
                const priorityB = PRIORITY_ORDER[(b.priority as PriorityKey) || 'LOW'] ?? 99;
                if (priorityA !== priorityB) return priorityA - priorityB;
                const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return createdB - createdA;
            });
            setProjects(filtered);
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : 'Failed to load past projects');
        } finally {
            setLoading(false);
        }
    }, [filterTeam, filterCategory, filterPriority, filterStatus]);

    const handleLifecycleRefresh = useCallback(() => {
        loadProjects();
        if (expandedProjectId) {
            projectsAPI.getById(expandedProjectId).then(setExpandedProjectDetail).catch(() => { });
        }
    }, [expandedProjectId, loadProjects]);

    useEffect(() => { loadProjects(); }, [loadProjects]);
    useEffect(() => { setCurrentPage(1); }, [filterTeam, filterCategory, filterPriority, filterStatus, dateFrom, dateTo, searchQuery]);

    const filteredProjects = useMemo(() => {
        return projects.filter((project) => {
            if (!isDateWithinRange(project.dueDate, dateFrom, dateTo)) return false;
            return matchesSearchQuery(
                buildSearchText(project.title, project.description, project.status, project.priority, project.projectType?.name, project.projectType?.category),
                searchQuery,
            );
        });
    }, [projects, searchQuery, dateFrom, dateTo]);

    const totalPages = Math.max(1, Math.ceil(filteredProjects.length / PROJECTS_PER_PAGE));
    const paginatedProjects = useMemo(() => {
        const start = (currentPage - 1) * PROJECTS_PER_PAGE;
        return filteredProjects.slice(start, start + PROJECTS_PER_PAGE);
    }, [filteredProjects, currentPage]);

    const handleToggleExpand = async (project: any) => {
        if (!project || !project.id) {
            setExpandedProjectId(null);
            setExpandedProjectDetail(null);
            return;
        }
        if (expandedProjectId === project.id) {
            setExpandedProjectId(null);
            setExpandedProjectDetail(null);
            return;
        }
        setExpandedProjectId(project.id);
        setDetailLoading(true);
        try {
            const detail = await projectsAPI.getById(project.id);
            setExpandedProjectDetail(detail);
        } catch {
            setExpandedProjectDetail(null);
        } finally {
            setDetailLoading(false);
        }
    };

    return (
        <div className="projects-page">
            {/* Header */}
            <div className="page-header">
                <h1 className="projects-title">Past Projects</h1>
            </div>
            <hr className="title-divider" />

            <div className="page-search-row">
                <div className="page-search-field page-search-field--full">
                    <Search className="page-search-icon" size={16} />
                    <input
                        type="search"
                        className="page-search-input"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search archived projects"
                        aria-label="Search archived projects"
                    />
                    <button
                        type="button"
                        className={`page-search-filter-btn${hasActiveFilters ? ' page-search-filter-btn--active' : ''}`}
                        onClick={() => setShowFiltersModal(true)}
                        aria-label="Open advanced filters"
                    >
                        <Filter size={16} />
                        <span className="page-search-filter-label">Advanced Filters</span>
                    </button>
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="projects-loading">Loading past projects…</div>
            ) : error ? (
                <div className="projects-error">{error}</div>
            ) : filteredProjects.length === 0 ? (
                <div className="empty-state">
                    <Archive className="empty-state-icon" />
                    <h4 className="empty-state-title">{searchQuery || hasActiveFilters ? 'No archived projects found' : 'No archived projects'}</h4>
                    <p className="empty-state-text">
                        {searchQuery || hasActiveFilters ? 'Try a different search or adjust the filters.' : 'Projects that have been archived will appear here.'}
                    </p>
                </div>
            ) : (
                <>
                    <div className="projects-grid">
                        {paginatedProjects.map((p: PastProjectSummary) => (
                            <ProjectCard
                                key={p.id}
                                archivedView
                                project={p}
                                expanded={expandedProjectId === p.id}
                                fullDetail={expandedProjectId === p.id ? expandedProjectDetail : null}
                                detailLoading={expandedProjectId === p.id && detailLoading}
                                canManage={canManageProjectLifecycle}
                                onToggle={handleToggleExpand}
                                onReactivate={(proj) => setActionProject({ type: 'reactivate', project: proj })}
                                onAbort={(proj) => setActionProject({ type: 'abort', project: proj })}
                                onFinalize={(proj) => setActionProject({ type: 'finalize', project: proj })}
                                onArchive={(proj) => setActionProject({ type: 'archive', project: proj })}
                                onViewActivity={(proj) => setActionProject({ type: 'activity', project: proj })}
                            />
                        ))}
                    </div>
                    {totalPages > 1 && (
                        <div className="pagination-controls">
                            <button
                                className="pagination-btn"
                                disabled={currentPage <= 1}
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                            >
                                Previous
                            </button>
                            <div className="pagination-pages">
                                {getPageNumbers(currentPage, totalPages).map((p: number | '...', i: number) =>
                                    p === '...' ? (
                                        <span key={`ellipsis-${i}`} className="pagination-ellipsis">…</span>
                                    ) : (
                                        <button
                                            key={p}
                                            className={`pagination-page-btn${p === currentPage ? ' pagination-page-btn--active' : ''}`}
                                            onClick={() => setCurrentPage(p)}
                                        >
                                            {p}
                                        </button>
                                    )
                                )}
                            </div>
                            <button
                                className="pagination-btn"
                                disabled={currentPage >= totalPages}
                                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* Loading indicator for expanded card */}
            {expandedProjectId && detailLoading && !expandedProjectDetail && (
                <div className="project-detail-loading-indicator">
                    Loading details…
                </div>
            )}

            {canManageProjectLifecycle && actionProject?.type === 'reactivate' && (
                <ReactivateProjectModal
                    project={actionProject.project}
                    onClose={() => setActionProject(null)}
                    onReactivated={() => {
                        setActionProject(null);
                        handleLifecycleRefresh();
                    }}
                />
            )}

            {canManageProjectLifecycle && actionProject?.type === 'finalize' && (
                <FinalizeProjectModal
                    project={actionProject.project}
                    onClose={() => setActionProject(null)}
                    onFinalized={() => {
                        setActionProject(null);
                        handleLifecycleRefresh();
                    }}
                />
            )}

            {canManageProjectLifecycle && actionProject?.type === 'archive' && (
                <ArchiveProjectModal
                    project={actionProject.project}
                    onClose={() => setActionProject(null)}
                    onArchived={() => {
                        setActionProject(null);
                        handleLifecycleRefresh();
                    }}
                />
            )}

            {actionProject?.type === 'activity' && (
                <ProjectActivityModal
                    project={actionProject.project as any}
                    onClose={() => setActionProject(null)}
                />
            )}

            {canManageProjectLifecycle && actionProject?.type === 'abort' && (
                <AbortProjectModal
                    project={actionProject.project}
                    onClose={() => setActionProject(null)}
                    onAborted={() => {
                        setActionProject(null);
                        handleLifecycleRefresh();
                    }}
                />
            )}

            {showFiltersModal && (
                <ProjectFiltersModal
                    filterTeam={filterTeam}
                    filterCategory={filterCategory}
                    filterPriority={filterPriority}
                    filterStatus={filterStatus}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    allTeams={allTeams}
                    allCategories={allCategories}
                    dateRangeLabel="Filters by due date."
                    onClose={() => setShowFiltersModal(false)}
                    onApply={handleApplyFilters}
                    onClear={handleResetFilters}
                />
            )}
        </div>
    );
}
