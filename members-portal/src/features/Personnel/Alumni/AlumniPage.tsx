'use client';

import { useState, useEffect, useMemo } from 'react';
import { Eye, Search, Users, Filter } from 'lucide-react';
import { alumniAPI, teamsAPI, getProfilePhotoUrl } from '../../../services/api';
import ViewMemberModal from '../Teams/modals/ViewMemberModal';
import AlumniFiltersModal, { type AlumniFiltersState } from './modals/AlumniFiltersModal';
import { isDateWithinRange } from '../../../utils/filterDateRange';
import type { Id } from '../../../types/backend-contracts';
import { buildSearchText, matchesSearchQuery } from '../../../utils/search';
type PageToken = number | '...';

interface TeamOption {
    id: Id;
    name: string;
}

interface AlumniRecord {
    id: Id;
    memberId: Id;
    leaveType: string;
    leftDate?: string | null;
    member?: {
        fullName?: string | null;
        email?: string | null;
        profilePhotoUrl?: string | null;
    } | null;
    team?: {
        name?: string | null;
    } | null;
    role?: {
        roleName?: string | null;
    } | null;
    subteam?: {
        name?: string | null;
    } | null;
}

interface AlumniRow {
    id: Id;
    memberId: Id;
    name: string;
    email: string;
    teamName: string;
    role: string;
    subteamName: string | null;
    leaveType: string;
    leftDate: string | null;
    avatar: string | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

// Pagination helper – produces [1, 2, '...', 5, 6, 7, '...', 10] style array
function getPageNumbers(current: number, total: number): PageToken[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: PageToken[] = [];
    pages.push(1);
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i += 1) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
}

function AlumniPage() {
    const [alumniList, setAlumniList] = useState<AlumniRecord[]>([]);
    const [teams, setTeams] = useState<TeamOption[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [filterTeamId, setFilterTeamId] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [showFiltersModal, setShowFiltersModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewingMemberId, setViewingMemberId] = useState<Id | null>(null);

    // Pagination
    const ROWS_PER_PAGE = 20;
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const loadTeams = async (): Promise<void> => {
            try {
                const data = await teamsAPI.getAll(undefined, 'all');
                setTeams(Array.isArray(data) ? (data as TeamOption[]) : []);
            } catch (err: unknown) {
                setError(getErrorMessage(err, 'Failed to load teams'));
            }
        };
        void loadTeams();
    }, []);

    useEffect(() => {
        const loadAlumni = async (): Promise<void> => {
            setLoading(true);
            setError(null);
            try {
                const teamId = filterTeamId || undefined;
                const data = await alumniAPI.getAll(teamId);
                setAlumniList(Array.isArray(data) ? (data as AlumniRecord[]) : []);
            } catch (err: unknown) {
                setError(getErrorMessage(err, 'Failed to load alumni'));
                setAlumniList([]);
            } finally {
                setLoading(false);
            }
        };
        void loadAlumni();
    }, [filterTeamId]);

    const rows = useMemo<AlumniRow[]>(() => {
        return alumniList.map((alumni) => ({
            id: alumni.id,
            memberId: alumni.memberId,
            name: alumni.member?.fullName || 'Unknown',
            email: alumni.member?.email || 'N/A',
            teamName: alumni.team?.name ?? '—',
            role: alumni.role?.roleName ?? '—',
            subteamName: alumni.subteam?.name ?? null,
            leaveType: alumni.leaveType,
            leftDate: alumni.leftDate ?? null,
            avatar: alumni.member?.profilePhotoUrl ? getProfilePhotoUrl(alumni.memberId) : null,
        }));
    }, [alumniList]);

    const filteredRows = useMemo(() => {
        return rows.filter((row) => {
            if (!isDateWithinRange(row.leftDate, dateFrom, dateTo)) return false;
            return matchesSearchQuery(
                buildSearchText(row.name, row.email, row.teamName, row.role, row.subteamName, row.leaveType),
                searchQuery,
            );
        });
    }, [rows, searchQuery, dateFrom, dateTo]);

    const hasActiveFilters = filterTeamId !== '' || dateFrom !== '' || dateTo !== '';

    const handleApplyFilters = (filters: AlumniFiltersState) => {
        setFilterTeamId(filters.filterTeamId);
        setDateFrom(filters.dateFrom);
        setDateTo(filters.dateTo);
        setShowFiltersModal(false);
    };

    const handleResetFilters = () => {
        setFilterTeamId('');
        setDateFrom('');
        setDateTo('');
    };

    // Reset to page 1 when filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [filterTeamId, dateFrom, dateTo, searchQuery]);

    // Pagination derived values
    const totalPages = Math.max(1, Math.ceil(filteredRows.length / ROWS_PER_PAGE));
    const paginatedRows = useMemo<AlumniRow[]>(() => {
        const start = (currentPage - 1) * ROWS_PER_PAGE;
        return filteredRows.slice(start, start + ROWS_PER_PAGE);
    }, [filteredRows, currentPage]);

    const formatDate = (d: string | null | undefined): string => {
        if (!d || Number.isNaN(new Date(d).getTime())) return '—';
        return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <div className="alumni-page members-page">
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">Alumni</h1>
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
                        placeholder="Search alumni"
                        aria-label="Search alumni"
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

            {error && <div className="error-message">{error}</div>}
            {loading && <div className="loading-message">Loading alumni...</div>}

            <div className="card members-table-card">
                <div className="card-header card-header-with-action">
                    <div className="card-header-left">
                        <h3 className="card-title">Former members</h3>
                        <p className="card-subtitle">{filteredRows.length} alumni</p>
                    </div>
                </div>
                <div className="card-body">
                    {!loading && filteredRows.length === 0 ? (
                        <div className="empty-state">
                            <Users className="empty-state-icon" />
                            <h4 className="empty-state-title">No alumni found</h4>
                            <p className="empty-state-text">
                                {searchQuery || hasActiveFilters
                                    ? 'Try a different search or adjust the filters.'
                                    : 'No one has left the club yet.'}
                            </p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="members-table">
                                <thead>
                                    <tr>
                                        <th>Member</th>
                                        <th>Left from team</th>
                                        <th>Last role</th>
                                        <th>Last subteam</th>
                                        <th>Email</th>
                                        <th>Leave type</th>
                                        <th>Left date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {paginatedRows.map((row, index) => (
                                        <tr key={row.id} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                                            <td>
                                                <div className="table-member-cell">
                                                    <div className="member-avatar-sm">
                                                        {row.avatar ? (
                                                            <img src={row.avatar} alt={row.name} />
                                                        ) : (
                                                            <div className="avatar-placeholder-sm">
                                                                {(row.name || 'U').split(' ').map((namePart) => namePart[0]).join('')}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="member-name-text">{row.name || 'Unknown'}</span>
                                                </div>
                                            </td>
                                            <td>{row.teamName}</td>
                                            <td>{row.role}</td>
                                            <td>{row.subteamName || '—'}</td>
                                            <td className="email-cell">{row.email}</td>
                                            <td>{row.leaveType}</td>
                                            <td>{formatDate(row.leftDate)}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        type="button"
                                                        className="table-action-btn view-btn"
                                                        onClick={() => {
                                                            setViewingMemberId(row.memberId);
                                                            setShowViewModal(true);
                                                        }}
                                                        title="View Member"
                                                    >
                                                        <Eye />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                {totalPages > 1 && (
                    <div className="pagination-controls">
                        <button
                            className="pagination-btn"
                            disabled={currentPage <= 1}
                            onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                        >
                            Previous
                        </button>
                        <div className="pagination-pages">
                            {getPageNumbers(currentPage, totalPages).map((pageNumber, index) =>
                                pageNumber === '...' ? (
                                    <span key={`ellipsis-${index}`} className="pagination-ellipsis">…</span>
                                ) : (
                                    <button
                                        key={pageNumber}
                                        className={`pagination-page-btn${pageNumber === currentPage ? ' pagination-page-btn--active' : ''}`}
                                        onClick={() => setCurrentPage(pageNumber)}
                                    >
                                        {pageNumber}
                                    </button>
                                ),
                            )}
                        </div>
                        <button
                            className="pagination-btn"
                            disabled={currentPage >= totalPages}
                            onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            <ViewMemberModal
                isOpen={showViewModal}
                onClose={() => {
                    setShowViewModal(false);
                    setViewingMemberId(null);
                }}
                memberId={viewingMemberId}
            />

            {showFiltersModal && (
                <AlumniFiltersModal
                    filterTeamId={filterTeamId}
                    dateFrom={dateFrom}
                    dateTo={dateTo}
                    allTeams={teams}
                    onClose={() => setShowFiltersModal(false)}
                    onApply={handleApplyFilters}
                    onClear={handleResetFilters}
                />
            )}
        </div>
    );
}

export default AlumniPage;

