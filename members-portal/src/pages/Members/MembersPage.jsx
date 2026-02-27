import { useState, useEffect, useMemo, useRef } from 'react';
import { Eye, Pencil, Users, ChevronDown, UserPlus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { teamMembersAPI, membersAPI, teamsAPI, teamRolesAPI, teamSubteamsAPI } from '../../services/api';
import ViewMemberModal from '../Teams/modals/ViewMemberModal';
import EditMembersModal from '../Teams/modals/EditMembersModal';
import AssignToTeamModal from './modals/AssignToTeamModal';


// Filter dropdown that matches Manage Roles/Subteams squircle + list styling
function FilterDropdown({ options, value, onChange, triggerLabel }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const selected = options.find((o) => String(o.value) === String(value)) || options[0];
    const displayLabel = selected ? selected.label : triggerLabel;

    return (
        <div className="manage-roles-container" ref={dropdownRef}>
            <div className="manage-roles-header">
                <div
                    className="manage-combobox-trigger"
                    onClick={() => setIsOpen(!isOpen)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsOpen(!isOpen)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                >
                    <span className="manage-combobox-label">{displayLabel}</span>
                    <ChevronDown className={`manage-combobox-chevron ${isOpen ? 'open' : ''}`} size={20} />
                </div>
            </div>
            <div className={`manage-dropdown-menu ${isOpen ? 'open' : ''}`} role="listbox">
                {options.map((opt) => (
                    <div key={opt.value ?? 'all'} className="manage-dropdown-item-wrapper">
                        <button
                            type="button"
                            role="option"
                            aria-selected={String(opt.value) === String(value)}
                            className={`manage-dropdown-item ${String(opt.value) === String(value) ? 'active' : ''}`}
                            onClick={() => {
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                        >
                            <span className="manage-dropdown-item-label">{opt.label}</span>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function MembersPage() {
    const { user } = useAuth();
    const canManageMembersGlobal = !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin);
    const leadershipTeamIds = user?.leadershipTeamIds || [];
    const canEditMemberRow = (row) =>
        canManageMembersGlobal ||
        (row.isUnassigned && user?.isLeadership) ||
        (!row.isUnassigned && row.teamId != null && leadershipTeamIds.includes(row.teamId));
    const [assignments, setAssignments] = useState([]);
    const [teams, setTeams] = useState([]);
    const [allRoles, setAllRoles] = useState([]);
    const [allSubteams, setAllSubteams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Filters
    const [filterTeamId, setFilterTeamId] = useState('');
    const [filterStatus, setFilterStatus] = useState(''); // '' = all, 'active' | 'inactive' | 'unassigned'

    // Modals
    const [showViewModal, setShowViewModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showAssignModal, setShowAssignModal] = useState(false);
    const [viewingMemberId, setViewingMemberId] = useState(null);
    const [editingMember, setEditingMember] = useState(null);
    const [editingMemberAssignment, setEditingMemberAssignment] = useState(null);
    const [assigningMember, setAssigningMember] = useState(null);

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
                setTeams(teamsData || []);
                setAllRoles(rolesData || []);
                setAllSubteams(subteamsData || []);
            } catch (err) {
                setError(err.message || 'Failed to load data');
            }
        };
        loadInitial();
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
                    let list = Array.isArray(data) ? data : [];
                    const needUnassigned = filterStatus === 'inactive' || (!filterTeamId && filterStatus === '');
                    const unassigned = needUnassigned ? await membersAPI.getAll(undefined, true) : [];
                    const unassignedMemberIds = new Set((Array.isArray(unassigned) ? unassigned : []).map((m) => m.id));
                    if (filterStatus === 'inactive') {
                        list = list.filter((a) => !unassignedMemberIds.has(a.memberId));
                    }
                    if (!filterTeamId && filterStatus === '') {
                        const unassignedList = Array.isArray(unassigned) ? unassigned : [];
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
                        const combined = [...assignmentRows, ...unassignedRows];
                        const byMember = new Map();
                        combined.forEach((row) => {
                            const mid = row.memberId;
                            const existing = byMember.get(mid);
                            const rank = (r) => (r.isUnassigned ? 1 : r.isActive ? 3 : 2);
                            if (!existing || rank(row) > rank(existing)) byMember.set(mid, row);
                        });
                        list = Array.from(byMember.values());
                    }
                    setAssignments(list);
                }
            } catch (err) {
                setError(err.message || 'Failed to load members');
                setAssignments([]);
            } finally {
                setLoading(false);
            }
        };
        loadAssignments();
    }, [filterTeamId, filterStatus]);

    const rows = useMemo(() => {
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
            avatar: tm.member?.profilePhotoUrl || null,
            joinedDate: tm.joinedDate,
            isActive: tm.isActive,
            leftDate: tm.leftDate ?? null,
            isUnassigned: !!tm.isUnassigned,
        }));
    }, [assignments]);

    const handleViewMember = (row) => {
        setViewingMemberId(row.memberId);
        setShowViewModal(true);
    };

    const handleEditMember = (row) => {
        if (row.isUnassigned || row.teamMemberId == null) return;
        setEditingMember({
            ...row,
            fullName: row.name,
        });
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

    const handleEditMemberSubmit = async () => {
        if (!editingMemberAssignment) return;
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
                let list = Array.isArray(data) ? data : [];
                const needUnassigned = filterStatus === 'inactive' || (!filterTeamId && filterStatus === '');
                const unassigned = needUnassigned ? await membersAPI.getAll(undefined, true) : [];
                const unassignedMemberIds = new Set((Array.isArray(unassigned) ? unassigned : []).map((m) => m.id));
                if (filterStatus === 'inactive') list = list.filter((a) => !unassignedMemberIds.has(a.memberId));
                if (!filterTeamId && filterStatus === '') {
                    const unassignedList = Array.isArray(unassigned) ? unassigned : [];
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
                    const combined = [...assignmentRows, ...unassignedRows];
                    const byMember = new Map();
                    combined.forEach((row) => {
                        const mid = row.memberId;
                        const existing = byMember.get(mid);
                        const rank = (r) => (r.isUnassigned ? 1 : r.isActive ? 3 : 2);
                        if (!existing || rank(row) > rank(existing)) byMember.set(mid, row);
                    });
                    list = Array.from(byMember.values());
                }
                setAssignments(list);
            }
            setShowEditModal(false);
            setEditingMember(null);
            setEditingMemberAssignment(null);
        } catch (err) {
            setError(err.message || 'Failed to refresh');
        }
    };

    const handleAssignToTeam = (row) => {
        setAssigningMember({
            memberId: row.memberId,
            id: row.memberId,
            fullName: row.name,
            name: row.name,
        });
        setShowAssignModal(true);
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
                let list = Array.isArray(data) ? data : [];
                const needUnassigned = filterStatus === 'inactive' || (!filterTeamId && filterStatus === '');
                const unassigned = needUnassigned ? await membersAPI.getAll(undefined, true) : [];
                const unassignedMemberIds = new Set((Array.isArray(unassigned) ? unassigned : []).map((m) => m.id));
                if (filterStatus === 'inactive') list = list.filter((a) => !unassignedMemberIds.has(a.memberId));
                if (!filterTeamId && filterStatus === '') {
                    const unassignedList = Array.isArray(unassigned) ? unassigned : [];
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
                    const combined = [...assignmentRows, ...unassignedRows];
                    const byMember = new Map();
                    combined.forEach((row) => {
                        const mid = row.memberId;
                        const existing = byMember.get(mid);
                        const rank = (r) => (r.isUnassigned ? 1 : r.isActive ? 3 : 2);
                        if (!existing || rank(row) > rank(existing)) byMember.set(mid, row);
                    });
                    list = Array.from(byMember.values());
                }
                setAssignments(list);
            }
            setShowAssignModal(false);
            setAssigningMember(null);
        } catch (err) {
            setError(err.message || 'Failed to refresh');
        }
    };

    return (
        <div className="members-page">
            {/* Page Header: title on left, filter squircle s on right (same layout as Teams) */}
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">Club Members</h1>
                <div className="page-header-actions">
                    <FilterDropdown
                        triggerLabel="Team"
                        options={[
                            { value: '', label: 'All teams' },
                            ...teams.map((t) => ({ value: String(t.id), label: t.name })),
                        ]}
                        value={filterTeamId}
                        onChange={(v) => setFilterTeamId(v)}
                    />
                    <FilterDropdown
                        triggerLabel="Status"
                        options={[
                            { value: '', label: 'All statuses' },
                            { value: 'active', label: 'Active' },
                            { value: 'inactive', label: 'Inactive' },
                            { value: 'unassigned', label: 'Unassigned' },
                        ]}
                        value={filterStatus}
                        onChange={(v) => setFilterStatus(v)}
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
                                    {rows.map((row, index) => (
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
                                                    {canEditMemberRow(row) && (row.isUnassigned ? (
                                                        <button
                                                            type="button"
                                                            className="table-action-btn edit-btn"
                                                            onClick={() => handleAssignToTeam(row)}
                                                            title="Assign to team"
                                                        >
                                                            <UserPlus />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            type="button"
                                                            className="table-action-btn edit-btn"
                                                            onClick={() => handleEditMember(row)}
                                                            title="Edit Assignment"
                                                        >
                                                            <Pencil />
                                                        </button>
                                                    ))}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <ViewMemberModal
                isOpen={showViewModal}
                onClose={() => { setShowViewModal(false); setViewingMemberId(null); }}
                memberId={viewingMemberId}
            />
            <EditMembersModal
                isOpen={showEditModal}
                onClose={() => {
                    setShowEditModal(false);
                    setEditingMember(null);
                    setEditingMemberAssignment(null);
                }}
                onSubmit={handleEditMemberSubmit}
                member={editingMember}
                currentTeamAssignment={editingMemberAssignment}
                teams={teams}
                roles={allRoles}
                subteams={allSubteams}
            />
            <AssignToTeamModal
                isOpen={showAssignModal}
                onClose={() => { setShowAssignModal(false); setAssigningMember(null); }}
                onSubmit={handleAssignSubmit}
                member={assigningMember}
                teams={teams}
                roles={allRoles}
            />
        </div>
    );
}

export default MembersPage;
