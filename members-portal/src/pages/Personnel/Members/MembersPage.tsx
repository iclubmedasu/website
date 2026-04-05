import { useState, useEffect, useMemo } from 'react';
import { Eye, Pencil, Users, UserPlus } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { teamMembersAPI, membersAPI, teamsAPI, teamRolesAPI, teamSubteamsAPI, getProfilePhotoUrl } from '../../../services/api';
import ViewMemberModal from '../Teams/modals/ViewMemberModal';
import EditMembersModal from '../Teams/modals/EditMembersModal';
import AssignToTeamModal from './modals/AssignToTeamModal';
import Dropdown from '../../../components/dropdown/dropdown';
import '../../Projects/ProjectsPage.css';
import type { Id } from '../../../types/backend-contracts';

type PageNumberToken = number | '...';

interface TeamItem {
    id: Id;
    name: string;
    isActive?: boolean;
}

interface RoleItem {
    id: Id;
    teamId: Id;
    roleName: string;
    maxCount?: number | null;
    systemRoleKey?: number | null;
    isActive?: boolean;
}

interface SubteamItem {
    id: Id;
    teamId: Id;
    name: string;
    isActive?: boolean;
}

interface MemberItem {
    id: Id;
    fullName?: string | null;
    email?: string | null;
    profilePhotoUrl?: string | null;
}

interface AssignmentItem {
    id: Id | string;
    memberId: Id;
    teamId?: Id | null;
    roleId?: Id | null;
    subteamId?: Id | null;
    member?: MemberItem | null;
    team?: { name?: string | null } | null;
    role?: { roleName?: string | null } | null;
    subteam?: { name?: string | null } | null;
    joinedDate?: string | null;
    leftDate?: string | null;
    isActive?: boolean;
    isUnassigned?: boolean;
}

interface MemberRow {
    id: Id | string;
    teamMemberId: Id | string | null;
    memberId: Id;
    teamId: Id | null;
    roleId: Id | null;
    subteamId: Id | null;
    name: string;
    email: string;
    role: string;
    teamName: string;
    subteamName: string | null;
    status: 'Unassigned' | 'Active' | 'Inactive';
    avatar: string | null;
    joinedDate?: string | null;
    isActive: boolean;
    leftDate: string | null;
    isUnassigned: boolean;
}

interface AssigningMember {
    memberId: Id;
    id: Id;
    fullName: string;
    name: string;
}

interface EditingMember {
    fullName: string;
}

interface EditingMemberAssignment {
    id: Id | string | null;
    memberId: Id;
    teamId: Id | null;
    roleId: Id | null;
    subteamId: Id | null;
    joinedDate?: string | null;
    isActive: boolean;
    leftDate: string | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

// Pagination helper – produces [1, 2, '...', 5, 6, 7, '...', 10] style array
function getPageNumbers(current: number, total: number): PageNumberToken[] {
    if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
    const pages: PageNumberToken[] = [];
    pages.push(1);
    if (current > 3) pages.push('...');
    const start = Math.max(2, current - 1);
    const end = Math.min(total - 1, current + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (current < total - 2) pages.push('...');
    pages.push(total);
    return pages;
}


function MembersPage() {
    const { user } = useAuth();
    const canManageMembersGlobal = !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin);
    const leadershipTeamIds = user?.leadershipTeamIds || [];
    const canEditMemberRow = (row: MemberRow): boolean =>
        canManageMembersGlobal ||
        (row.isUnassigned && user?.isLeadership) ||
        (!row.isUnassigned && row.teamId != null && leadershipTeamIds.includes(row.teamId));
    const [assignments, setAssignments] = useState<AssignmentItem[]>([]);
    const [teams, setTeams] = useState<TeamItem[]>([]);
    const [allRoles, setAllRoles] = useState<RoleItem[]>([]);
    const [allSubteams, setAllSubteams] = useState<SubteamItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filters
    const [filterTeamId, setFilterTeamId] = useState('');
    const [filterStatus, setFilterStatus] = useState(''); // '' = all, 'active' | 'inactive' | 'unassigned'

    // Pagination
    const ROWS_PER_PAGE = 20;
    const [currentPage, setCurrentPage] = useState(1);

    // Modals
    const [showViewModal, setShowViewModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [viewingMemberId, setViewingMemberId] = useState<Id | null>(null);
    const [assigningMember, setAssigningMember] = useState<AssigningMember | null>(null);
    const [editingMember, setEditingMember] = useState<EditingMember | null>(null);
    const [editingMemberAssignment, setEditingMemberAssignment] = useState<EditingMemberAssignment | null>(null);

    // Fetch initial data: teams, all roles, all subteams
    useEffect(() => {
        const loadInitial = async () => {
            setError(null);
            try {
                const [teamsData, rolesData, subteamsData] = await Promise.all([
                    teamsAPI.getAll(true, 'all'),
                    teamRolesAPI.getAll(undefined, true),
                    teamSubteamsAPI.getAll(),
                ]);
                setTeams(Array.isArray(teamsData) ? (teamsData as TeamItem[]) : []);
                setAllRoles(Array.isArray(rolesData) ? (rolesData as RoleItem[]) : []);
                setAllSubteams(Array.isArray(subteamsData) ? (subteamsData as SubteamItem[]) : []);
            } catch (err: unknown) {
                setError(getErrorMessage(err, 'Failed to load data'));
            }
        };
        void loadInitial();
    }, []);

    // Fetch by status: Unassigned = members API only; Active/Inactive/All = team members API; "All teams" + "All statuses" = assignments + unassigned
    useEffect(() => {
        const loadAssignments = async () => {
            setLoading(true);
            setError(null);
            try {
                if (filterStatus === 'unassigned') {
                    const members = await membersAPI.getAll(undefined, true);
                    const list = Array.isArray(members) ? members : [];
                    setAssignments(
                        list.map((m) => ({
                            id: `member-${m.id}`,
                            memberId: m.id,
                            member: m,
                            team: null,
                            role: null,
                            subteam: null,
                            isActive: false,
                            isUnassigned: true,
                        }))
                    );
                } else {
                    const teamId = filterTeamId ? parseInt(filterTeamId, 10) : undefined;
                    const isActive = filterStatus === 'inactive' ? false : filterStatus === 'active' ? true : undefined;
                    const data = await teamMembersAPI.getAll(teamId, undefined, isActive);
                    let list: AssignmentItem[] = Array.isArray(data) ? (data as AssignmentItem[]) : [];
                    const needUnassigned = filterStatus === 'inactive' || (!filterTeamId && filterStatus === '');
                    const unassigned = needUnassigned ? await membersAPI.getAll(undefined, true) : ([] as MemberItem[]);
                    const unassignedList = Array.isArray(unassigned) ? (unassigned as MemberItem[]) : [];
                    const unassignedMemberIds = new Set(unassignedList.map((m) => m.id));
                    if (filterStatus === 'inactive') {
                        list = list.filter((a) => !unassignedMemberIds.has(a.memberId));
                    }
                    if (!filterTeamId && filterStatus === '') {
                        const assignmentRows = list.filter((a) => !unassignedMemberIds.has(a.memberId));
                        const unassignedRows = unassignedList.map((m) => ({
                            id: `member-${m.id}`,
                            memberId: m.id,
                            member: m,
                            team: null,
                            role: null,
                            subteam: null,
                            isActive: false,
                            isUnassigned: true,
                        }));
                        const combined: AssignmentItem[] = [...assignmentRows, ...unassignedRows];
                        const byMember = new Map<Id, AssignmentItem>();
                        combined.forEach((row) => {
                            const mid = row.memberId;
                            const existing = byMember.get(mid);
                            const rank = (r: AssignmentItem) => (r.isUnassigned ? 1 : r.isActive ? 3 : 2);
                            if (!existing || rank(row) > rank(existing)) byMember.set(mid, row);
                        });
                        list = Array.from(byMember.values());
                    }
                    setAssignments(list);
                }
            } catch (err: unknown) {
                setError(getErrorMessage(err, 'Failed to load members'));
                setAssignments([]);
            } finally {
                setLoading(false);
            }
        };
        void loadAssignments();
    }, [filterTeamId, filterStatus]);

    const rows = useMemo<MemberRow[]>(() => {
        return assignments.map((tm) => ({
            id: tm.id,
            teamMemberId: tm.isUnassigned ? null : tm.id,
            memberId: tm.memberId,
            teamId: tm.teamId ?? null,
            roleId: tm.roleId ?? null,
            subteamId: tm.subteamId ?? null,
            name: tm.member?.fullName || 'Unknown',
            email: tm.member?.email || 'N/A',
            role: tm.isUnassigned ? '—' : (tm.role?.roleName || 'N/A'),
            teamName: tm.isUnassigned ? '—' : (tm.team?.name || 'N/A'),
            subteamName: tm.isUnassigned ? null : (tm.subteam?.name ?? null),
            status: tm.isUnassigned ? 'Unassigned' : (tm.isActive ? 'Active' : 'Inactive'),
            avatar: tm.member?.profilePhotoUrl ? getProfilePhotoUrl(tm.memberId) : null,
            joinedDate: tm.joinedDate,
            isActive: !!tm.isActive,
            leftDate: tm.leftDate ?? null,
            isUnassigned: !!tm.isUnassigned,
        }));
    }, [assignments]);

    // Reset to page 1 when filters change
    useEffect(() => { setCurrentPage(1); }, [filterTeamId, filterStatus]);

    // Pagination derived values
    const totalPages = Math.max(1, Math.ceil(rows.length / ROWS_PER_PAGE));
    const paginatedRows = useMemo(() => {
        const start = (currentPage - 1) * ROWS_PER_PAGE;
        return rows.slice(start, start + ROWS_PER_PAGE);
    }, [rows, currentPage]);

    const handleViewMember = (row: MemberRow) => {
        setViewingMemberId(row.memberId);
        setShowViewModal(true);
    };

    const handleAssignToTeam = (row: MemberRow) => {
        setAssigningMember({
            memberId: row.memberId,
            id: row.memberId,
            fullName: row.name,
            name: row.name,
        });
        setShowAssignModal(true);
    };

    const handleEditMember = (row: MemberRow) => {
        setEditingMember({ fullName: row.name });
        setEditingMemberAssignment({
            id: row.teamMemberId,
            memberId: row.memberId,
            teamId: row.teamId,
            roleId: row.roleId,
            subteamId: row.subteamId,
            joinedDate: row.joinedDate,
            isActive: row.isActive,
            leftDate: row.leftDate,
        });
        setShowEditModal(true);
    };

    const handleAssignSubmit = async () => {
        setError(null);
        try {
            if (filterStatus === 'unassigned') {
                const members = await membersAPI.getAll(undefined, true);
                const list = Array.isArray(members) ? members : [];
                setAssignments(
                    list.map((m) => ({
                        id: `member-${m.id}`,
                        memberId: m.id,
                        member: m,
                        team: null,
                        role: null,
                        subteam: null,
                        isActive: false,
                        isUnassigned: true,
                    }))
                );
            } else {
                const teamId = filterTeamId ? parseInt(filterTeamId, 10) : undefined;
                const isActive = filterStatus === 'inactive' ? false : filterStatus === 'active' ? true : undefined;
                const data = await teamMembersAPI.getAll(teamId, undefined, isActive);
                let list: AssignmentItem[] = Array.isArray(data) ? (data as AssignmentItem[]) : [];
                const needUnassigned = filterStatus === 'inactive' || (!filterTeamId && filterStatus === '');
                const unassigned = needUnassigned ? await membersAPI.getAll(undefined, true) : ([] as MemberItem[]);
                const unassignedList = Array.isArray(unassigned) ? (unassigned as MemberItem[]) : [];
                const unassignedMemberIds = new Set(unassignedList.map((m) => m.id));
                if (filterStatus === 'inactive') list = list.filter((a) => !unassignedMemberIds.has(a.memberId));
                if (!filterTeamId && filterStatus === '') {
                    const assignmentRows = list.filter((a) => !unassignedMemberIds.has(a.memberId));
                    const unassignedRows = unassignedList.map((m) => ({
                        id: `member-${m.id}`,
                        memberId: m.id,
                        member: m,
                        team: null,
                        role: null,
                        subteam: null,
                        isActive: false,
                        isUnassigned: true,
                    }));
                    const combined: AssignmentItem[] = [...assignmentRows, ...unassignedRows];
                    const byMember = new Map<Id, AssignmentItem>();
                    combined.forEach((row) => {
                        const mid = row.memberId;
                        const existing = byMember.get(mid);
                        const rank = (r: AssignmentItem) => (r.isUnassigned ? 1 : r.isActive ? 3 : 2);
                        if (!existing || rank(row) > rank(existing)) byMember.set(mid, row);
                    });
                    list = Array.from(byMember.values());
                }
                setAssignments(list);
            }
            setShowAssignModal(false);
            setAssigningMember(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to refresh'));
        }
    };

    return (
        <div className="members-page">
            {/* Page Header: title on left, filter squircle s on right (same layout as Teams) */}
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">Club Members</h1>
                <div className="page-header-actions">
                    <Dropdown
                        triggerLabel="Team"
                        options={[
                            { value: '', label: 'All teams' },
                            ...teams.map((t) => ({ value: String(t.id), label: t.name })),
                        ]}
                        value={filterTeamId}
                        onChange={(v) => setFilterTeamId(String(v ?? ''))}
                    />
                    <Dropdown
                        triggerLabel="Status"
                        options={[
                            { value: '', label: 'All statuses' },
                            { value: 'active', label: 'Active' },
                            { value: 'inactive', label: 'Inactive' },
                            { value: 'unassigned', label: 'Unassigned' },
                        ]}
                        value={filterStatus}
                        onChange={(v) => setFilterStatus(String(v ?? ''))}
                    />
                </div>
            </div>

            {/* Divider (same as Teams page) */}
            <hr className="title-divider" />

            {error && <div className="error-message">{error}</div>}
            {loading && <div className="loading-message">Loading members...</div>}

            {/* Table */}
            <div className="card members-table-card">
                <div className="card-header card-header-with-action">
                    <div className="card-header-left">
                        <h3 className="card-title">Members</h3>
                        <p className="card-subtitle">{rows.length} total</p>
                    </div>
                </div>
                <div className="card-body">
                    {!loading && rows.length === 0 ? (
                        <div className="empty-state">
                            <Users className="empty-state-icon" />
                            <h4 className="empty-state-title">No members found</h4>
                            <p className="empty-state-text">
                                {filterStatus === 'unassigned' ? 'No unassigned members.' : filterTeamId || filterStatus ? 'Try changing the filters above.' : 'No club members yet.'}
                            </p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="members-table">
                                <thead>
                                    <tr>
                                        <th>Member</th>
                                        <th>Team</th>
                                        <th>Role</th>
                                        <th>Subteam</th>
                                        <th>Email</th>
                                        <th>Status</th>
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
                                            <td>
                                                <span className={`status-badge ${(row.status || 'Unknown').toLowerCase()}`}>
                                                    {row.status || 'Unknown'}
                                                </span>
                                            </td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        type="button"
                                                        className="table-action-btn view-btn"
                                                        onClick={() => handleViewMember(row)}
                                                        title="View Member"
                                                    >
                                                        <Eye />
                                                    </button>
                                                    {canEditMemberRow(row) && row.isUnassigned && (
                                                        <button
                                                            type="button"
                                                            className="table-action-btn edit-btn"
                                                            onClick={() => handleAssignToTeam(row)}
                                                            title="Assign to team"
                                                        >
                                                            <UserPlus />
                                                        </button>
                                                    )}
                                                    {canEditMemberRow(row) && !row.isUnassigned && (
                                                        <button
                                                            type="button"
                                                            className="table-action-btn edit-btn"
                                                            onClick={() => handleEditMember(row)}
                                                            title="Edit member"
                                                        >
                                                            <Pencil />
                                                        </button>
                                                    )}
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
            <AssignToTeamModal
                isOpen={showAssignModal}
                onClose={() => { setShowAssignModal(false); setAssigningMember(null); }}
                onSubmit={handleAssignSubmit}
                member={assigningMember}
                teams={teams}
                roles={allRoles}
            />
            <EditMembersModal
                isOpen={showEditModal}
                onClose={() => { setShowEditModal(false); setEditingMember(null); setEditingMemberAssignment(null); }}
                onSubmit={handleAssignSubmit}
                member={editingMember}
                currentTeamAssignment={editingMemberAssignment}
                teams={teams}
                roles={allRoles}
                subteams={allSubteams}
            />
        </div>
    );
}

export default MembersPage;
