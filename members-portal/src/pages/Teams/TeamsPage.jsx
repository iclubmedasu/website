import { useState, useRef, useEffect } from 'react';
import { Eye, Pencil, PlayCircle, PauseCircle, Plus, Users } from 'lucide-react';
import AddTeamModal from './modals/AddTeamModal';
import EditTeamModal from './modals/EditTeamModal';
import DeactivateTeamModal from './modals/DeactivateTeamModal';
import ActivateTeamModal from './modals/ActivateTeamModal';
import ActivateRoleModal from './modals/ActivateRoleModal';
import ActivateSubteamModal from './modals/ActivateSubteamModal';
import AddRoleModal from './modals/AddRoleModal';
import EditRoleModal from './modals/EditRoleModal';
import DeactivateRoleModal from './modals/DeactivateRoleModal';
import AddSubteamModal from './modals/AddSubteamModal';
import EditSubteamModal from './modals/EditSubteamModal';
import DeactivateSubteamModal from './modals/DeactivateSubteamModal';
import AddMembersModal from './modals/AddMembersModal';
import EditMembersModal from './modals/EditMembersModal';
import ViewMemberModal from './modals/ViewMemberModal';
import { useAuth } from '../../context/AuthContext';
import { teamsAPI, teamRolesAPI, teamSubteamsAPI, teamMembersAPI, getProfilePhotoUrl } from '../../services/api';


// Simple SVG Chevron Icon
const ChevronDown = ({ className }) => (
    <svg
        className={className}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
    >
        <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2.5}
            d="M19 9l-7 7-7-7"
        />
    </svg>
);

// Title Dropdown: Add/Activate/Deactivate require canManageTeams (dev/admin/officer only).
// Edit team requires canManageTeams OR leadership of that team (canEditTeam(teamId)).
const TitleDropdown = ({ selectedTeam, teams, onTeamChange, onAddTeam, onEditTeam, onToggleTeamActive, canManageTeams = false, canEditTeam = () => false }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const currentTeam = teams.find(t => t.id === selectedTeam);

    const handleTeamSelect = (teamId) => {
        onTeamChange(teamId);
        setIsOpen(false);
    };

    const handleEditClick = (e, team) => {
        e.stopPropagation();
        onEditTeam(team);
        setIsOpen(false);
    };

    const handleToggleActiveClick = (e, team) => {
        e.stopPropagation();
        onToggleTeamActive(team);
        setIsOpen(false);
    };

    const handleAddClick = () => {
        onAddTeam();
        setIsOpen(false);
    };

    return (
        <>
            <div className="title-dropdown-container" ref={dropdownRef}>
                <h1
                    className="page-title-dropdown"
                    onClick={() => setIsOpen(!isOpen)}
                >
                    {currentTeam?.label}
                    <ChevronDown className={`dropdown-icon ${isOpen ? 'open' : ''}`} />
                </h1>

                <div className={`dropdown-menu ${isOpen ? 'open' : ''}`}>
                    {teams.map((team) => (
                        <div
                            key={team.id}
                            className={`dropdown-item-wrapper ${selectedTeam === team.id ? 'active' : ''}`}
                        >
                            <button
                                className={`dropdown-item ${selectedTeam === team.id ? 'active' : ''}`}
                                onClick={() => handleTeamSelect(team.id)}
                            >
                                <span className="dropdown-item-label">
                                    {team.label}
                                </span>
                                <div className="dropdown-item-right">
                                    {team.badge && (
                                        <span className="dropdown-badge">{team.badge}</span>
                                    )}
                                    {(canEditTeam(team.id) || canManageTeams) && (
                                        <div className="dropdown-item-actions">
                                            {canEditTeam(team.id) && (
                                                <button
                                                    className="dropdown-action-btn edit-btn"
                                                    onClick={(e) => handleEditClick(e, team)}
                                                    title="Edit Team"
                                                >
                                                    <Pencil />
                                                </button>
                                            )}
                                            {canManageTeams && (
                                                <button
                                                    className={`dropdown-action-btn toggle-active-btn ${team.isActive !== false ? 'deactivate' : 'activate'}`}
                                                    onClick={(e) => handleToggleActiveClick(e, team)}
                                                    title={team.isActive !== false ? 'Deactivate Team' : 'Activate Team'}
                                                >
                                                    {team.isActive !== false ? <PauseCircle /> : <PlayCircle />}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </button>
                        </div>
                    ))}

                    {canManageTeams && (
                        <button
                            className="dropdown-item add-team-item"
                            onClick={handleAddClick}
                        >
                            <span className="dropdown-item-label">
                                <Plus style={{ width: '18px', height: '18px' }} />
                                Add New Team
                            </span>
                        </button>
                    )}
                </div>
            </div>
        </>
    );
};

// Roles Dropdown (inside bordered squircle, like Teams dropdown – no selection, just list + actions)
const RolesDropdown = ({ roles, onAddRole, onEditRole, onDeactivateRole, onActivateRole }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const leaveTimeoutRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleMouseEnter = () => {
        if (leaveTimeoutRef.current) {
            clearTimeout(leaveTimeoutRef.current);
            leaveTimeoutRef.current = null;
        }
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        leaveTimeoutRef.current = setTimeout(() => setIsOpen(false), 150);
    };

    const handleRowClick = () => setIsOpen(false);

    const handleEditClick = (e, role) => {
        e.stopPropagation();
        onEditRole(role);
        setIsOpen(false);
    };

    const handleToggleActiveClick = (e, role) => {
        e.stopPropagation();
        if (role.isActive !== false) {
            onDeactivateRole(role);
        } else {
            onActivateRole(role);
        }
        setIsOpen(false);
    };

    const handleAddClick = () => {
        onAddRole();
        setIsOpen(false);
    };

    return (
        <div
            className="manage-roles-container"
            ref={dropdownRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className="manage-roles-header">
                <div className="manage-combobox-trigger" onClick={() => setIsOpen(!isOpen)}>
                    <span className="manage-combobox-label">Manage Roles</span>
                    <ChevronDown className={`manage-combobox-chevron ${isOpen ? 'open' : ''}`} />
                </div>
            </div>
            <div className={`manage-dropdown-menu ${isOpen ? 'open' : ''}`}>
                {roles.map((role) => (
                    <div key={role.id} className="manage-dropdown-item-wrapper">
                        <button
                            type="button"
                            className="manage-dropdown-item"
                            onClick={handleRowClick}
                        >
                            <span className="manage-dropdown-item-label">{role.label}</span>
                            <div className="manage-dropdown-item-actions">
                                {!role.isSystemRole && (
                                    <button
                                        type="button"
                                        className="manage-dropdown-action-btn edit-btn"
                                        onClick={(e) => handleEditClick(e, role)}
                                        title="Edit Role"
                                    >
                                        <Pencil />
                                    </button>
                                )}
                                {!role.isSystemRole && (
                                    <button
                                        type="button"
                                        className={`manage-dropdown-action-btn toggle-active-btn ${role.isActive !== false ? 'deactivate' : 'activate'}`}
                                        onClick={(e) => handleToggleActiveClick(e, role)}
                                        title={role.isActive !== false ? 'Deactivate Role' : 'Activate Role'}
                                    >
                                        {role.isActive !== false ? <PauseCircle /> : <PlayCircle />}
                                    </button>
                                )}
                            </div>
                        </button>
                    </div>
                ))}
                <button type="button" className="manage-dropdown-item add-new-item" onClick={handleAddClick}>
                    <span className="manage-dropdown-item-label">
                        <Plus style={{ width: '18px', height: '18px' }} />
                        Add New Role
                    </span>
                </button>
            </div>
        </div>
    );
};

// Subteams Dropdown (inside bordered squircle, like Teams dropdown – no selection, just list + actions)
const SubteamsDropdown = ({ subteams, onAddSubteam, onEditSubteam, onDeactivateSubteam, onActivateSubteam }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);
    const leaveTimeoutRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const handleMouseEnter = () => {
        if (leaveTimeoutRef.current) {
            clearTimeout(leaveTimeoutRef.current);
            leaveTimeoutRef.current = null;
        }
        setIsOpen(true);
    };

    const handleMouseLeave = () => {
        leaveTimeoutRef.current = setTimeout(() => setIsOpen(false), 150);
    };

    const handleRowClick = () => setIsOpen(false);

    const handleEditClick = (e, subteam) => {
        e.stopPropagation();
        onEditSubteam(subteam);
        setIsOpen(false);
    };

    const handleToggleActiveClick = (e, subteam) => {
        e.stopPropagation();
        if (subteam.isActive !== false) {
            onDeactivateSubteam(subteam);
        } else {
            onActivateSubteam(subteam);
        }
        setIsOpen(false);
    };

    const handleAddClick = () => {
        onAddSubteam();
        setIsOpen(false);
    };

    return (
        <div
            className="manage-subteams-container"
            ref={dropdownRef}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
        >
            <div className="manage-subteams-header">
                <div className="manage-combobox-trigger" onClick={() => setIsOpen(!isOpen)}>
                    <span className="manage-combobox-label">Manage Subteams</span>
                    <ChevronDown className={`manage-combobox-chevron ${isOpen ? 'open' : ''}`} />
                </div>
            </div>
            <div className={`manage-dropdown-menu ${isOpen ? 'open' : ''}`}>
                {subteams.map((subteam) => (
                    <div key={subteam.id} className="manage-dropdown-item-wrapper">
                        <button
                            type="button"
                            className="manage-dropdown-item"
                            onClick={handleRowClick}
                        >
                            <span className="manage-dropdown-item-label">{subteam.label}</span>
                            <div className="manage-dropdown-item-actions">
                                <button
                                    type="button"
                                    className="manage-dropdown-action-btn edit-btn"
                                    onClick={(e) => handleEditClick(e, subteam)}
                                    title="Edit Subteam"
                                >
                                    <Pencil />
                                </button>
                                <button
                                    type="button"
                                    className={`manage-dropdown-action-btn toggle-active-btn ${subteam.isActive !== false ? 'deactivate' : 'activate'}`}
                                    onClick={(e) => handleToggleActiveClick(e, subteam)}
                                    title={subteam.isActive !== false ? 'Deactivate Subteam' : 'Activate Subteam'}
                                >
                                    {subteam.isActive !== false ? <PauseCircle /> : <PlayCircle />}
                                </button>
                            </div>
                        </button>
                    </div>
                ))}
                <button type="button" className="manage-dropdown-item add-new-item" onClick={handleAddClick}>
                    <span className="manage-dropdown-item-label">
                        <Plus style={{ width: '18px', height: '18px' }} />
                        Add New Subteam
                    </span>
                </button>
            </div>
        </div>
    );
};

// Special Members Card Component. When canManageMembers is false, Add/Edit are hidden (view-only).
const SpecialMembersCard = ({ title, members, onViewMember, onEditMember, onAddMember, canManageMembers = true }) => {
    return (
        <div className="card special-members-card">
            <div className="card-header card-header-with-action">
                <div className="card-header-left">
                    <h3 className="card-title">{title}</h3>
                </div>
                {canManageMembers && (
                    <button
                        className="card-add-btn"
                        onClick={onAddMember}
                        title={`Add to ${title}`}
                    >
                        <Plus />
                    </button>
                )}
            </div>
            <div className="card-body">
                {members.length === 0 ? (
                    <div className="empty-state">
                        <Users className="empty-state-icon" />
                        <h4 className="empty-state-title">No members yet</h4>
                        <p className="empty-state-text">
                            Add members to this group to get started
                        </p>
                        {canManageMembers && (
                            <button className="empty-state-btn" onClick={onAddMember}>
                                <Plus />
                                Add Member
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="members-grid">
                        {members.map((member) => (
                            <div key={member.id} className="member-item">
                                <div className="member-avatar">
                                    {member.avatar ? (
                                        <img src={member.avatar} alt={member.name} />
                                    ) : (
                                        <div className="avatar-placeholder">
                                            {member.name.split(' ').map(n => n[0]).join('')}
                                        </div>
                                    )}
                                </div>
                                <div className="member-info">
                                    <h4 className="member-name">{member.name}</h4>
                                    <p className="member-role">{member.role}</p>
                                    <p className="member-email">{member.email}</p>
                                </div>
                                <div className="member-actions">
                                    <button
                                        className="member-action-btn view-btn"
                                        onClick={() => onViewMember(member)}
                                        title="View Member"
                                    >
                                        <Eye />
                                    </button>
                                    {canManageMembers && (
                                        <button
                                            className="member-action-btn edit-btn"
                                            onClick={() => onEditMember(member)}
                                            title="Edit Member"
                                        >
                                            <Pencil />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

// Members Table Component. When canManageMembers is false, Add/Edit are hidden (view-only).
const MembersTable = ({ members, onViewMember, onEditMember, onAddMember, canManageMembers = true }) => {
    return (
        <div className="card members-table-card">
            <div className="card-header card-header-with-action">
                <div className="card-header-left">
                    <h3 className="card-title">Team Members</h3>
                    <p className="card-subtitle">{members.length} total members</p>
                </div>
                {canManageMembers && (
                    <button
                        className="card-add-btn"
                        onClick={onAddMember}
                        title="Add Team Member"
                    >
                        <Plus />
                    </button>
                )}
            </div>
            <div className="card-body">
                {members.length === 0 ? (
                    <div className="empty-state">
                        <Users className="empty-state-icon" />
                        <h4 className="empty-state-title">No team members yet</h4>
                        <p className="empty-state-text">
                            Start building your team by adding members
                        </p>
                        {canManageMembers && (
                            <button className="empty-state-btn" onClick={onAddMember}>
                                <Plus />
                                Add Member
                            </button>
                        )}
                    </div>
                ) : (
                    <div className="table-container">
                        <table className="members-table">
                            <thead>
                                <tr>
                                    <th>Member</th>
                                    <th>Role</th>
                                    <th>Subteam</th>
                                    <th>Email</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {members.map((member, index) => (
                                    <tr key={member.id} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                                        <td>
                                            <div className="table-member-cell">
                                                <div className="member-avatar-sm">
                                                    {member.avatar ? (
                                                        <img src={member.avatar} alt={member.name} />
                                                    ) : (
                                                        <div className="avatar-placeholder-sm">
                                                            {(member.name || 'U').split(' ').map(n => n[0]).join('')}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="member-name-text">{member.name || 'Unknown Member'}</span>
                                            </div>
                                        </td>
                                        <td>{member.role || 'N/A'}</td>
                                        <td>{member.subteamName || '—'}</td>
                                        <td className="email-cell">{member.email || 'N/A'}</td>
                                        <td>
                                            <span className={`status-badge ${(member.status || 'Unknown').toLowerCase()}`}>
                                                {member.status || 'Unknown'}

                                            </span>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    className="table-action-btn view-btn"
                                                    onClick={() => onViewMember(member)}
                                                    title="View Member"
                                                >
                                                    <Eye />
                                                </button>
                                                {canManageMembers && (
                                                    <button
                                                        className="table-action-btn edit-btn"
                                                        onClick={() => onEditMember(member)}
                                                        title="Edit Member"
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
        </div>
    );
};

function TeamsPage() {
    const { user } = useAuth();
    const canManage = !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin || user?.isLeadership);
    const canManageTeams = !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin);
    const leadershipTeamIds = user?.leadershipTeamIds || [];
    const canEditTeam = (teamId) => canManageTeams || leadershipTeamIds.includes(teamId);

    // Teams state
    const [teams, setTeams] = useState([]);
    const [selectedTeamId, setSelectedTeamId] = useState(null);
    const [isTeamActive, setIsTeamActive] = useState(true);

    const canManageMembersInSelectedTeam = canManageTeams || (selectedTeamId != null && leadershipTeamIds.includes(selectedTeamId));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // Modal state
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [showActivateModal, setShowActivateModal] = useState(false);
    const [editTeam, setEditTeam] = useState(null);
    const [deactivateTeam, setDeactivateTeam] = useState(null);
    const [activateTeam, setActivateTeam] = useState(null);

    // Role modal state (simplified - no pre-selection needed)
    const [showAddRoleModal, setShowAddRoleModal] = useState(false);
    const [showEditRoleModal, setShowEditRoleModal] = useState(false);
    const [showDeactivateRoleModal, setShowDeactivateRoleModal] = useState(false);
    const [showActivateRoleModal, setShowActivateRoleModal] = useState(false);
    const [teamRoles, setTeamRoles] = useState([]);
    const [allRolesForModal, setAllRolesForModal] = useState([]);
    const [allSubteamsForModal, setAllSubteamsForModal] = useState([]);
    const [editRoleInitialId, setEditRoleInitialId] = useState(null);
    const [deactivateRoleInitialId, setDeactivateRoleInitialId] = useState(null);
    const [activateRoleInitialId, setActivateRoleInitialId] = useState(null);

    // Subteam modal state
    const [showAddSubteamModal, setShowAddSubteamModal] = useState(false);
    const [showEditSubteamModal, setShowEditSubteamModal] = useState(false);
    const [showDeactivateSubteamModal, setShowDeactivateSubteamModal] = useState(false);
    const [showActivateSubteamModal, setShowActivateSubteamModal] = useState(false);
    const [teamSubteams, setTeamSubteams] = useState([]);
    const [editSubteamInitialId, setEditSubteamInitialId] = useState(null);
    const [deactivateSubteamInitialId, setDeactivateSubteamInitialId] = useState(null);
    const [activateSubteamInitialId, setActivateSubteamInitialId] = useState(null);

    // Members modal state
    const [showAddMembersModal, setShowAddMembersModal] = useState(false);
    const [showEditMembersModal, setShowEditMembersModal] = useState(false);
    const [showViewMemberModal, setShowViewMemberModal] = useState(false);
    const [viewingMemberId, setViewingMemberId] = useState(null);
    const [editingMember, setEditingMember] = useState(null);
    const [editingMemberAssignment, setEditingMemberAssignment] = useState(null);

    // Members state (to be implemented)
    const [leadershipMembers, setLeadershipMembers] = useState([]);
    const [specialMembers, setSpecialMembers] = useState([]);
    const [regularMembers, setRegularMembers] = useState([]);

    // Fetch teams from backend
    const fetchTeams = async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await teamsAPI.getAll();
            setTeams(data || []);
            if ((data || []).length > 0) {
                if (!selectedTeamId || !(data || []).some(t => t.id === selectedTeamId)) {
                    setSelectedTeamId(data[0].id);
                    setIsTeamActive(data[0].isActive);
                }
            } else {
                setSelectedTeamId(null);
            }
        } catch (err) {
            setError(err.message || 'Failed to fetch teams');
        } finally {
            setLoading(false);
        }
    };

    // Fetch teams only on mount (re-fetches are done explicitly after add/edit/remove)
    useEffect(() => {
        fetchTeams();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Fetch all roles and subteams for Edit Member modal (transfer needs default Member role for any target team)
    useEffect(() => {
        const loadAllForModal = async () => {
            try {
                const [rolesData, subteamsData] = await Promise.all([
                    teamRolesAPI.getAll(),
                    teamSubteamsAPI.getAll(),
                ]);
                setAllRolesForModal(Array.isArray(rolesData) ? rolesData : []);
                setAllSubteamsForModal(Array.isArray(subteamsData) ? subteamsData : []);
            } catch (err) {
                console.warn('Failed to load all roles/subteams for modal:', err?.message);
                setAllRolesForModal([]);
                setAllSubteamsForModal([]);
            }
        };
        loadAllForModal();
    }, []);

    // Listen for sidebar events to open modals (needs current teams/selectedTeamId)
    useEffect(() => {
        const openAdd = () => setShowAddModal(true);
        const openEdit = () => {
            const team = teams.find(t => t.id === selectedTeamId);
            setEditTeam(team);
            setShowEditModal(true);
        };
        const openRemove = () => {
            const team = teams.find(t => t.id === selectedTeamId);
            setDeactivateTeam(team);
            setShowDeactivateModal(true);
        };
        window.addEventListener('openAddTeamModal', openAdd);
        window.addEventListener('openEditTeamModal', openEdit);
        window.addEventListener('openRemoveTeamModal', openRemove);
        return () => {
            window.removeEventListener('openAddTeamModal', openAdd);
            window.removeEventListener('openEditTeamModal', openEdit);
            window.removeEventListener('openRemoveTeamModal', openRemove);
        };
    }, [teams, selectedTeamId]);

    // Handle team selection
    const handleTeamChange = (teamId) => {
        setSelectedTeamId(teamId);
        const team = teams.find(t => t.id === teamId);
        setIsTeamActive(team?.isActive ?? true);
    };

    // When selected team changes, load its roles, subteams, and members
    useEffect(() => {
        if (!selectedTeamId) return;
        fetchRoles(selectedTeamId);
        fetchSubteams(selectedTeamId);
        fetchTeamMembers(selectedTeamId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTeamId]);

    // Fetch subteams for selected team (never show page error for this; treat failure as empty)
    const fetchSubteams = async (teamId) => {
        try {
            const data = await teamSubteamsAPI.getAll(teamId);
            setTeamSubteams(Array.isArray(data) ? data : []);
        } catch (err) {
            console.warn('Subteams fetch failed, using empty list:', err?.message);
            setTeamSubteams([]);
        }
    };

    // Fetch roles for selected team
    const fetchRoles = async (teamId) => {
        setError(null);
        try {
            const data = await teamRolesAPI.getAll(teamId);
            setTeamRoles(data);
        } catch (err) {
            setError(err.message || 'Failed to fetch roles');
        }
    };

    // Fetch team members for selected team (only active – transferred/left members are not shown)
    const fetchTeamMembers = async (teamId) => {
        setError(null);
        try {
            const data = await teamMembersAPI.getAll(teamId, undefined, true);

            // Transform the API response to match the table structure
            const transformedMembers = Array.isArray(data) ? data.map(tm => {
                const roleType = tm.role?.roleType || 'Regular';
                return {
                    id: tm.id,
                    name: tm.member?.fullName || 'Unknown',
                    email: tm.member?.email || 'N/A',
                    role: tm.role?.roleName || 'N/A',
                    status: tm.isActive ? 'Active' : 'Inactive',
                    avatar: tm.member?.profilePhotoUrl ? getProfilePhotoUrl(tm.memberId) : null,
                    teamMemberId: tm.id,
                    memberId: tm.memberId,
                    roleId: tm.roleId,
                    teamId: tm.teamId,
                    subteamId: tm.subteamId ?? null,
                    subteamName: tm.subteam?.name ?? null,
                    roleType: roleType === 'Leader' ? 'Leadership' : roleType,
                    joinedDate: tm.joinedDate,
                    isActive: tm.isActive,
                    leftDate: tm.leftDate ?? null,
                };
            }) : [];

            // Split by role type: Leadership → Leadership card, Special Roles → Special card, else → Team Members table
            setLeadershipMembers(transformedMembers.filter(m => m.roleType === 'Leadership'));
            setSpecialMembers(transformedMembers.filter(m => m.roleType === 'Special Roles'));
            setRegularMembers(transformedMembers.filter(m => m.roleType !== 'Leadership' && m.roleType !== 'Special Roles'));
        } catch (err) {
            console.error('Error fetching team members:', err);
            setError(err.message || 'Failed to fetch team members');
            setRegularMembers([]);
            setLeadershipMembers([]);
            setSpecialMembers([]);
        }
    };

    // Add team
    const handleAddTeam = async (formData) => {
        setError(null);
        try {
            await teamsAPI.create(formData);
            setShowAddModal(false);
            fetchTeams();
        } catch (err) {
            throw err;
        }
    };

    // Add role
    const handleAddRole = async (formData) => {
        setError(null);
        try {
            await teamRolesAPI.create({
                teamId: selectedTeamId,
                roleName: formData.roleName,
                roleType: formData.roleType || 'Regular',
                maxCount: formData.maxCount || null
            });
            setShowAddRoleModal(false);
            fetchRoles(selectedTeamId);
        } catch (err) {
            throw err;
        }
    };

    // Edit role - now receives roleId and formData from modal
    const handleEditRole = async (roleId, formData) => {
        setError(null);
        try {
            await teamRolesAPI.update(roleId, {
                roleName: formData.roleName,
                roleType: formData.roleType || 'Regular',
                maxCount: formData.maxCount != null ? parseInt(formData.maxCount, 10) : null,
                isActive: formData.isActive
            });
            setShowEditRoleModal(false);
            fetchRoles(selectedTeamId);
        } catch (err) {
            throw err;
        }
    };

    // Deactivate role (no permanent delete)
    const handleDeactivateRole = async (roleId) => {
        setError(null);
        try {
            await teamRolesAPI.deactivate(roleId);
            setShowDeactivateRoleModal(false);
            fetchRoles(selectedTeamId);
        } catch (err) {
            throw err;
        }
    };

    // Activate role
    const handleActivateRole = async (roleId) => {
        setError(null);
        try {
            await teamRolesAPI.activate(roleId);
            setShowActivateRoleModal(false);
            fetchRoles(selectedTeamId);
        } catch (err) {
            throw err;
        }
    };

    // Add subteam
    const handleAddSubteam = async (formData) => {
        setError(null);
        try {
            await teamSubteamsAPI.create({
                teamId: selectedTeamId,
                name: formData.name.trim(),
                description: formData.description?.trim() || null
            });
            setShowAddSubteamModal(false);
            fetchSubteams(selectedTeamId);
        } catch (err) {
            throw err;
        }
    };

    // Edit subteam
    const handleEditSubteam = async (subteamId, formData) => {
        setError(null);
        try {
            await teamSubteamsAPI.update(subteamId, {
                name: formData.name.trim(),
                description: formData.description?.trim() || null,
                isActive: formData.isActive
            });
            setShowEditSubteamModal(false);
            fetchSubteams(selectedTeamId);
        } catch (err) {
            throw err;
        }
    };

    // Deactivate subteam (no permanent delete)
    const handleDeactivateSubteam = async (subteamId) => {
        setError(null);
        try {
            await teamSubteamsAPI.deactivate(subteamId);
            setShowDeactivateSubteamModal(false);
            fetchSubteams(selectedTeamId);
        } catch (err) {
            throw err;
        }
    };

    // Activate subteam
    const handleActivateSubteam = async (subteamId) => {
        setError(null);
        try {
            await teamSubteamsAPI.activate(subteamId);
            setShowActivateSubteamModal(false);
            fetchSubteams(selectedTeamId);
        } catch (err) {
            throw err;
        }
    };

    // Edit team (modal passes teamId, formData)
    const handleEditTeam = async (teamId, formData) => {
        setError(null);
        try {
            const id = teamId ?? editTeam?.id;
            if (!id) return;
            await teamsAPI.update(id, formData);
            setShowEditModal(false);
            setEditTeam(null);
            fetchTeams();
        } catch (err) {
            throw err;
        }
    };

    // Deactivate team (no permanent delete) - called after confirmation
    const handleDeactivateTeam = async (teamId) => {
        setError(null);
        try {
            await teamsAPI.deactivate(teamId);
            setShowDeactivateModal(false);
            setDeactivateTeam(null);
            if (selectedTeamId === teamId) {
                setSelectedTeamId(teams.length > 1 ? teams.find(t => t.id !== teamId)?.id : null);
            }
            fetchTeams();
        } catch (err) {
            throw err;
        }
    };

    // Activate team - called after confirmation
    const handleActivateTeam = async (teamId) => {
        setError(null);
        try {
            await teamsAPI.activate(teamId);
            setShowActivateModal(false);
            setActivateTeam(null);
            fetchTeams();
        } catch (err) {
            throw err;
        }
    };

    // Toggle team activation
    const handleTeamActivationToggle = async (isActive) => {
        setIsTeamActive(isActive);
        setError(null);
        try {
            if (!selectedTeamId) return;
            if (isActive) {
                await teamsAPI.activate(selectedTeamId);
            } else {
                await teamsAPI.deactivate(selectedTeamId);
            }
            fetchTeams();
        } catch (err) {
            setError(err.message || 'Failed to update team status');
        }
    };

    // Placeholder handlers for members
    const handleViewMember = (member) => {
        setViewingMemberId(member.memberId || member.id);
        setShowViewMemberModal(true);
    };
    const handleEditMember = (member) => {
        // Member is from Leadership card, Special Roles card, or Team Members table; all have same shape
        setEditingMember(member);
        setEditingMemberAssignment({
            id: member.teamMemberId,
            memberId: member.memberId,
            teamId: member.teamId,
            roleId: member.roleId,
            subteamId: member.subteamId ?? null,
            joinedDate: member.joinedDate,
            isActive: member.isActive ?? (member.status === 'Active'),
            leftDate: member.leftDate ?? null,
        });
        setShowEditMembersModal(true);
    };

    // Handler to open add members modal for leadership
    const handleAddLeadership = () => {
        setShowAddMembersModal(true);
    };

    // Handler to open add members modal for special roles
    const handleAddSpecialRole = () => {
        setShowAddMembersModal(true);
    };

    // Handler to open add members modal for team members
    const handleAddTeamMember = () => {
        setShowAddMembersModal(true);
    };

    // Handler for adding member
    const handleAddMember = async (memberData) => {
        setError(null);
        try {
            // The member was already created and assigned in the modal
            // Fetch the updated team members to show the new member
            if (selectedTeamId) {
                await fetchTeamMembers(selectedTeamId);
            }
            // Close the modal after successful addition
            setShowAddMembersModal(false);
        } catch (err) {
            setError(err.message || 'Failed to add member');
            console.error('Error adding member:', err);
        }
    };

    // Handler for editing member
    const handleEditMemberSubmit = async (editData) => {
        setError(null);
        try {
            // The member assignment was already updated in the modal
            // Fetch the updated team members to show the changes
            if (selectedTeamId) {
                await fetchTeamMembers(selectedTeamId);
            }
            // Close the modal after successful edit
            setShowEditMembersModal(false);
            setEditingMember(null);
            setEditingMemberAssignment(null);
        } catch (err) {
            setError(err.message || 'Failed to update member');
            console.error('Error updating member:', err);
        }
    };

    const handleOpenAddRoleModal = () => {
        setShowAddRoleModal(true);
    };

    // Prepare dropdown teams for TitleDropdown (include inactive so they can be edited and reactivated)
    const dropdownTeams = teams.map(t => ({
        id: t.id,
        label: t.isActive === false ? `${t.name} (Inactive)` : t.name,
        badge: t.members?.length || undefined,
        isActive: t.isActive
    }));

    // Default roles (systemRoleKey 1,2,3 or these names) cannot be deactivated
    const SYSTEM_ROLE_NAMES = ['Head of Team', 'Vice Head of Team', 'Member'];
    const dropdownRoles = teamRoles.map(r => {
        const isSystemRole = (r.systemRoleKey != null && r.systemRoleKey !== undefined)
            || SYSTEM_ROLE_NAMES.includes(r.roleName);
        return {
            id: r.id,
            label: r.isActive === false ? `${r.roleName} (Inactive)` : r.roleName,
            isActive: r.isActive,
            systemRoleKey: r.systemRoleKey ?? null,
            roleName: r.roleName,
            isSystemRole
        };
    });

    const dropdownSubteams = teamSubteams.map(s => ({
        id: s.id,
        label: s.isActive === false ? `${s.name} (Inactive)` : s.name,
        isActive: s.isActive
    }));

    return (
        <div className="teams-page">
            {/* Page Header with Dropdown, Manage Roles, and Manage Subteams */}
            <div className="page-header">
                <TitleDropdown
                    selectedTeam={selectedTeamId}
                    teams={dropdownTeams}
                    onTeamChange={handleTeamChange}
                    onAddTeam={() => setShowAddModal(true)}
                    onEditTeam={(team) => {
                        setEditTeam(teams.find(t => t.id === team.id));
                        setShowEditModal(true);
                    }}
                    onToggleTeamActive={(team) => {
                        if (team.isActive !== false) {
                            setDeactivateTeam(teams.find(t => t.id === team.id));
                            setShowDeactivateModal(true);
                        } else {
                            setActivateTeam(teams.find(t => t.id === team.id));
                            setShowActivateModal(true);
                        }
                    }}
                    canManageTeams={canManageTeams}
                    canEditTeam={canEditTeam}
                />
                {canManage && (
                    <div className="page-header-actions">
                        <RolesDropdown
                            roles={dropdownRoles}
                            onAddRole={handleOpenAddRoleModal}
                            onEditRole={(role) => {
                                setEditRoleInitialId(role.id);
                                setShowEditRoleModal(true);
                            }}
                            onDeactivateRole={(role) => {
                                setDeactivateRoleInitialId(role.id);
                                setShowDeactivateRoleModal(true);
                            }}
                            onActivateRole={(role) => {
                                setActivateRoleInitialId(role.id);
                                setShowActivateRoleModal(true);
                            }}
                        />
                        <SubteamsDropdown
                            subteams={dropdownSubteams}
                            onAddSubteam={() => setShowAddSubteamModal(true)}
                            onEditSubteam={(subteam) => {
                                setEditSubteamInitialId(subteam.id);
                                setShowEditSubteamModal(true);
                            }}
                            onDeactivateSubteam={(subteam) => {
                                setDeactivateSubteamInitialId(subteam.id);
                                setShowDeactivateSubteamModal(true);
                            }}
                            onActivateSubteam={(subteam) => {
                                setActivateSubteamInitialId(subteam.id);
                                setShowActivateSubteamModal(true);
                            }}
                        />
                    </div>
                )}
            </div>

            {/* Error/Loading */}
            {error && <div className="error-message">{error}</div>}
            {loading && <div className="loading-message">Loading teams...</div>}
            {!loading && !error && teams.length === 0 && !canManage && (
                <div className="empty-message">
                    You are not assigned to any team. Contact your administrator for access.
                </div>
            )}

            {/* Divider */}
            <hr className="title-divider" />

            {/* Leadership Card */}
            <SpecialMembersCard
                title="Leadership"
                members={leadershipMembers}
                onViewMember={handleViewMember}
                onEditMember={handleEditMember}
                onAddMember={handleAddLeadership}
                canManageMembers={canManageMembersInSelectedTeam}
            />

            {/* Special Members Card */}
            <SpecialMembersCard
                title="Special Roles"
                members={specialMembers}
                onViewMember={handleViewMember}
                onEditMember={handleEditMember}
                onAddMember={handleAddSpecialRole}
                canManageMembers={canManageMembersInSelectedTeam}
            />

            {/* Members Table */}
            <MembersTable
                members={regularMembers}
                onViewMember={handleViewMember}
                onEditMember={handleEditMember}
                onAddMember={handleAddTeamMember}
                canManageMembers={canManageMembersInSelectedTeam}
            />

            {/* Modals */}
            <AddTeamModal
                isOpen={showAddModal}
                onClose={() => setShowAddModal(false)}
                onSubmit={handleAddTeam}
            />
            <EditTeamModal
                isOpen={showEditModal}
                onClose={() => { setShowEditModal(false); setEditTeam(null); }}
                onSubmit={handleEditTeam}
                team={editTeam}
            />
            <DeactivateTeamModal
                isOpen={showDeactivateModal}
                onClose={() => { setShowDeactivateModal(false); setDeactivateTeam(null); }}
                onConfirm={handleDeactivateTeam}
                team={deactivateTeam}
            />
            <ActivateTeamModal
                isOpen={showActivateModal}
                onClose={() => { setShowActivateModal(false); setActivateTeam(null); }}
                onConfirm={handleActivateTeam}
                team={activateTeam}
            />
            <AddRoleModal
                isOpen={showAddRoleModal}
                onClose={() => setShowAddRoleModal(false)}
                onSubmit={handleAddRole}
                teamId={selectedTeamId}
            />
            <EditRoleModal
                isOpen={showEditRoleModal}
                onClose={() => { setShowEditRoleModal(false); setEditRoleInitialId(null); }}
                onSubmit={handleEditRole}
                teamId={selectedTeamId}
                initialRoleId={editRoleInitialId}
            />
            <DeactivateRoleModal
                isOpen={showDeactivateRoleModal}
                onClose={() => { setShowDeactivateRoleModal(false); setDeactivateRoleInitialId(null); }}
                onSubmit={handleDeactivateRole}
                teamId={selectedTeamId}
                initialRoleId={deactivateRoleInitialId}
            />
            <ActivateRoleModal
                isOpen={showActivateRoleModal}
                onClose={() => { setShowActivateRoleModal(false); setActivateRoleInitialId(null); }}
                onSubmit={handleActivateRole}
                teamId={selectedTeamId}
                initialRoleId={activateRoleInitialId}
            />
            <AddSubteamModal
                isOpen={showAddSubteamModal}
                onClose={() => setShowAddSubteamModal(false)}
                onSubmit={handleAddSubteam}
                teamId={selectedTeamId}
            />
            <EditSubteamModal
                isOpen={showEditSubteamModal}
                onClose={() => { setShowEditSubteamModal(false); setEditSubteamInitialId(null); }}
                onSubmit={handleEditSubteam}
                teamId={selectedTeamId}
                initialSubteamId={editSubteamInitialId}
            />
            <DeactivateSubteamModal
                isOpen={showDeactivateSubteamModal}
                onClose={() => { setShowDeactivateSubteamModal(false); setDeactivateSubteamInitialId(null); }}
                onSubmit={handleDeactivateSubteam}
                teamId={selectedTeamId}
                initialSubteamId={deactivateSubteamInitialId}
            />
            <ActivateSubteamModal
                isOpen={showActivateSubteamModal}
                onClose={() => { setShowActivateSubteamModal(false); setActivateSubteamInitialId(null); }}
                onSubmit={handleActivateSubteam}
                teamId={selectedTeamId}
                initialSubteamId={activateSubteamInitialId}
            />
            <AddMembersModal
                isOpen={showAddMembersModal}
                onClose={() => setShowAddMembersModal(false)}
                onSubmit={handleAddMember}
                selectedTeamId={selectedTeamId}
                teams={teams.filter((t) => t.isActive !== false)}
                roles={teamRoles}
            />
            <EditMembersModal
                isOpen={showEditMembersModal}
                onClose={() => {
                    setShowEditMembersModal(false);
                    setEditingMember(null);
                    setEditingMemberAssignment(null);
                }}
                onSubmit={handleEditMemberSubmit}
                member={editingMember}
                currentTeamAssignment={editingMemberAssignment}
                teams={teams}
                roles={allRolesForModal}
                subteams={allSubteamsForModal}
                occupiedRoleIds={[
                    ...leadershipMembers,
                    ...specialMembers,
                    ...regularMembers,
                ]
                    .filter((m) => m.memberId !== editingMember?.memberId && m.roleId != null)
                    .map((m) => m.roleId)}
            />
            <ViewMemberModal
                isOpen={showViewMemberModal}
                onClose={() => {
                    setShowViewMemberModal(false);
                    setViewingMemberId(null);
                }}
                memberId={viewingMemberId}
            />
        </div>
    );
}

export default TeamsPage;