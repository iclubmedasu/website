import { useState, useEffect, useMemo } from 'react';
import { Eye, Users } from 'lucide-react';
import { alumniAPI, teamsAPI, getProfilePhotoUrl } from '../../../services/api';
import ViewMemberModal from '../Teams/modals/ViewMemberModal';
import Dropdown from '../../../components/dropdown/dropdown';
import '../../Projects/ProjectsPage.css';

// Pagination helper – produces [1, 2, '...', 5, 6, 7, '...', 10] style array
function getPageNumbers(current, total) {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages = [];
    pages.push(1);
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
}


function AlumniPage() {
    const [alumniList, setAlumniList] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterTeamId, setFilterTeamId] = useState('');
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewingMemberId, setViewingMemberId] = useState(null);

    // Pagination
    const ROWS_PER_PAGE = 20;
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const loadTeams = async () => {
            try {
                const data = await teamsAPI.getAll(undefined, 'all');
                setTeams(data || []);
            } catch (err) {
                setError(err.message || 'Failed to load teams');
            }
        };
        loadTeams();
    }, []);

    useEffect(() => {
        const loadAlumni = async () => {
            setLoading(true);
            setError(null);
            try {
                const teamId = filterTeamId ? filterTeamId : undefined;
                const data = await alumniAPI.getAll(teamId);
                setAlumniList(Array.isArray(data) ? data : []);
            } catch (err) {
                setError(err.message || 'Failed to load alumni');
                setAlumniList([]);
            } finally {
                setLoading(false);
            }
        };
        loadAlumni();
    }, [filterTeamId]);

    const rows = useMemo(() => {
        return alumniList.map((a) => ({
            id: a.id,
            memberId: a.memberId,
            name: a.member?.fullName || 'Unknown',
            email: a.member?.email || 'N/A',
            teamName: a.team?.name ?? '—',
            role: a.role?.roleName ?? '—',
            subteamName: a.subteam?.name ?? null,
            leaveType: a.leaveType,
            leftDate: a.leftDate,
            avatar: a.member?.profilePhotoUrl ? getProfilePhotoUrl(a.memberId) : null,
        }));
    }, [alumniList]);

    // Reset to page 1 when filters change
    useEffect(() => { setCurrentPage(1); }, [filterTeamId]);

    // Pagination derived values
    const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
    const paginatedRows = useMemo(() => {
        const start = (currentPage - 1) * ROWS_PER_PAGE;
        return rows.slice(start, start + ROWS_PER_PAGE);
    }, [rows, currentPage]);

    const formatDate = (d) => {
        if (!d || Number.isNaN(new Date(d).getTime())) return '—';
        return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <div className="alumni-page members-page">
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">Alumni</h1>
                <div className="page-header-actions">
                    <Dropdown
                        triggerLabel="Left from team"
                        options={[{ value: '', label: 'All teams' }, ...teams.map((t) => ({ value: String(t.id), label: t.name }))]}
                        value={filterTeamId}
                        onChange={(v) => setFilterTeamId(v)}
                    />
                </div>
            </div>

            <hr className="title-divider" />

            {error && <div className="error-message">{error}</div>}
            {loading && <div className="loading-message">Loading alumni...</div>}

            <div className="card members-table-card">
                <div className="card-header card-header-with-action">
                    <div className="card-header-left">
                        <h3 className="card-title">Former members</h3>
                        <p className="card-subtitle">{rows.length} alumni</p>
                    </div>
                </div>
                <div className="card-body">
                    {!loading && rows.length === 0 ? (
                        <div className="empty-state">
                            <Users className="empty-state-icon" />
                            <h4 className="empty-state-title">No alumni found</h4>
                            <p className="empty-state-text">
                                {filterTeamId ? 'No one has left this team yet.' : 'No one has left the club yet.'}
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
                                                                {(row.name || 'U').split(' ').map((n) => n[0]).join('')}
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
                            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        >
                            Previous
                        </button>
                        <div className="pagination-pages">
                            {getPageNumbers(currentPage, totalPages).map((p, i) =>
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
            </div>

            <ViewMemberModal
                isOpen={showViewModal}
                onClose={() => { setShowViewModal(false); setViewingMemberId(null); }}
                memberId={viewingMemberId}
            />
        </div>
    );
}

export default AlumniPage;
