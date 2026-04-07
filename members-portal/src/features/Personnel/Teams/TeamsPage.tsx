'use client';

import { useState, useEffect } from 'react';
import { Eye, Pencil, PlayCircle, PauseCircle, Plus, Users } from 'lucide-react';
import Dropdown from '../../../components/dropdown/dropdown';
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
import { useAuth } from '../../../context/AuthContext';
import { teamsAPI, teamRolesAPI, teamSubteamsAPI, teamMembersAPI, getProfilePhotoUrl } from '../../../services/api';
import type { Id } from '../../../types/backend-contracts';

interface TeamItem {
    id: Id;
    name: string;
    isActive?: boolean;
    members?: unknown[];
    establishedDate?: string | null;
}

interface TeamRoleItem {
    id: Id;
    teamId: Id;
    roleName: string;
    roleType?: string | null;
    maxCount?: number | null;
    systemRoleKey?: number | null;
    isActive?: boolean;
}

interface TeamSubteamItem {
    id: Id;
    teamId: Id;
    name: string;
    description?: string | null;
    isActive?: boolean;
}

interface TeamMemberApiItem {
    id: Id;
    memberId: Id;
    roleId: Id | null;
    teamId: Id;
    subteamId?: Id | null;
    joinedDate?: string | null;
    leftDate?: string | null;
    isActive?: boolean;
    member?: {
        fullName?: string | null;
        email?: string | null;
        profilePhotoUrl?: string | null;
    } | null;
    role?: {
        roleName?: string | null;
        roleType?: string | null;
    } | null;
    subteam?: {
        name?: string | null;
    } | null;
}

type MemberRoleType = 'Leadership' | 'Special Roles' | 'Regular';

interface TeamMemberView {
    id: Id;
    name: string;
    email: string;
    role: string;
    status: 'Active' | 'Inactive';
    avatar: string | null;
    teamMemberId: Id;
    memberId: Id;
    roleId: Id | null;
    teamId: Id;
    subteamId: Id | null;
    subteamName: string | null;
    roleType: MemberRoleType;
    joinedDate?: string | null;
    isActive: boolean;
    leftDate: string | null;
}

interface TeamAssignmentState {
    id: Id | string | null;
    memberId: Id;
    teamId: Id | null;
    roleId: Id | null;
    subteamId: Id | null;
    joinedDate?: string | null;
    isActive: boolean;
    leftDate: string | null;
}

interface TeamFormData {
    name: string;
    establishedDate: string;
    isActive?: boolean;
}

interface RoleFormData {
    roleName: string;
    roleType?: string;
    maxCount?: number | string | null;
    isActive?: boolean;
}

interface SubteamFormData {
    name: string;
    description?: string | null;
    isActive?: boolean;
}

interface TeamDropdownItem {
    id: Id;
    label: string;
    badge?: number;
    isActive?: boolean;
}

interface RoleDropdownItem {
    id: Id;
    label: string;
    isActive?: boolean;
    systemRoleKey: number | null;
    roleName: string;
    isSystemRole: boolean;
}

interface SubteamDropdownItem {
    id: Id;
    label: string;
    isActive?: boolean;
}

interface ChevronDownProps {
    className?: string;
}

interface TitleDropdownProps {
    selectedTeam: Id | null;
    teams: TeamDropdownItem[];
    onTeamChange: (teamId: Id) => void;
    onAddTeam: () => void;
    onEditTeam: (team: TeamDropdownItem) => void;
    onToggleTeamActive: (team: TeamDropdownItem) => void;
    canManageTeams?: boolean;
    canEditTeam?: (teamId: Id) => boolean;
}

interface RolesDropdownProps {
    roles: RoleDropdownItem[];
    onAddRole: () => void;
    onEditRole: (role: RoleDropdownItem) => void;
    onDeactivateRole: (role: RoleDropdownItem) => void;
    onActivateRole: (role: RoleDropdownItem) => void;
}

interface SubteamsDropdownProps {
    subteams: SubteamDropdownItem[];
    onAddSubteam: () => void;
    onEditSubteam: (subteam: SubteamDropdownItem) => void;
    onDeactivateSubteam: (subteam: SubteamDropdownItem) => void;
    onActivateSubteam: (subteam: SubteamDropdownItem) => void;
}

interface SpecialMembersCardProps {
    title: string;
    members: TeamMemberView[];
    onViewMember: (member: TeamMemberView) => void;
    onEditMember: (member: TeamMemberView) => void;
    onAddMember: () => void;
    canManageMembers?: boolean;
}

interface MembersTableProps {
    members: TeamMemberView[];
    onViewMember: (member: TeamMemberView) => void;
    onEditMember: (member: TeamMemberView) => void;
    onAddMember: () => void;
    canManageMembers?: boolean;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

const ChevronDown = ({ className }: ChevronDownProps) => (
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

const TitleDropdown = ({
    selectedTeam,
    teams,
    onTeamChange,
    onAddTeam,
    onEditTeam,
    onToggleTeamActive,
    canManageTeams = false,
    canEditTeam = () => false,
}: TitleDropdownProps) => {
    const currentTeam = teams.find((team) => team.id === selectedTeam);

    return (
        <Dropdown
            wrapperClassName="title-dropdown-container"
            headerClassName=""
            menuClassName="dropdown-menu"
            hoverOpen={false}
            button={(
                <h1 className="page-title-dropdown">
                    {currentTeam?.label}
                    <ChevronDown className="dropdown-icon" />
                </h1>
            )}
        >
            {({ closeMenu }) => (
                <>
                    {teams.map((team) => (
                        <div
                            key={team.id}
                            className={`dropdown-item-wrapper ${selectedTeam === team.id ? 'active' : ''}`}
                        >
                            <div
                                className={`dropdown-item ${selectedTeam === team.id ? 'active' : ''}`}
                            >
                                <button
                                    type="button"
                                    className="dropdown-item-main"
                                    onClick={() => {
                                        onTeamChange(team.id);
                                        closeMenu();
                                    }}
                                >
                                    <span className="dropdown-item-label">
                                        {team.label}
                                    </span>
                                </button>
                                <div className="dropdown-item-right">
                                    {team.badge && (
                                        <span className="dropdown-badge">{team.badge}</span>
                                    )}
                                    {(canEditTeam(team.id) || canManageTeams) && (
                                        <div className="dropdown-item-actions">
                                            {canEditTeam(team.id) && (
                                                <button
                                                    className="dropdown-action-btn edit-btn"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onEditTeam(team);
                                                        closeMenu();
                                                    }}
                                                    title="Edit Team"
                                                >
                                                    <Pencil />
                                                </button>
                                            )}
                                            {canManageTeams && (
                                                <button
                                                    className={`dropdown-action-btn toggle-active-btn ${team.isActive !== false ? 'deactivate' : 'activate'}`}
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onToggleTeamActive(team);
                                                        closeMenu();
                                                    }}
                                                    title={team.isActive !== false ? 'Deactivate Team' : 'Activate Team'}
                                                >
                                                    {team.isActive !== false ? <PauseCircle /> : <PlayCircle />}
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {canManageTeams && (
                        <button
                            className="dropdown-item add-team-item"
                            onClick={() => {
                                onAddTeam();
                                closeMenu();
                            }}
                        >
                            <span className="dropdown-item-label">
                                <Plus style={{ width: '18px', height: '18px' }} />
                                Add New Team
                            </span>
                        </button>
                    )}
                </>
            )}
        </Dropdown>
    );
};

const RolesDropdown = ({ roles, onAddRole, onEditRole, onDeactivateRole, onActivateRole }: RolesDropdownProps) => {
    return (
        <Dropdown
            wrapperClassName="manage-roles-container"
            headerClassName="manage-roles-header"
            menuClassName="manage-dropdown-menu"
            hoverOpen
            closeDelay={150}
            button={(
                <div className="manage-combobox-trigger">
                    <span className="manage-combobox-label">Manage Roles</span>
                    <ChevronDown className="manage-combobox-chevron" />
                </div>
            )}
        >
            {({ closeMenu }) => (
                <>
                    {roles.map((role) => (
                        <div key={role.id} className="manage-dropdown-item-wrapper">
                            <div
                                className="manage-dropdown-item"
                            >
                                <button
                                    type="button"
                                    className="manage-dropdown-item-main"
                                    onClick={() => closeMenu()}
                                >
                                    <span className="manage-dropdown-item-label">{role.label}</span>
                                </button>
                                <div className="manage-dropdown-item-actions">
                                    {!role.isSystemRole && (
                                        <button
                                            type="button"
                                            className="manage-dropdown-action-btn edit-btn"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEditRole(role);
                                                closeMenu();
                                            }}
                                            title="Edit Role"
                                        >
                                            <Pencil />
                                        </button>
                                    )}
                                    {!role.isSystemRole && (
                                        <button
                                            type="button"
                                            className={`manage-dropdown-action-btn toggle-active-btn ${role.isActive !== false ? 'deactivate' : 'activate'}`}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (role.isActive !== false) {
                                                    onDeactivateRole(role);
                                                } else {
                                                    onActivateRole(role);
                                                }
                                                closeMenu();
                                            }}
                                            title={role.isActive !== false ? 'Deactivate Role' : 'Activate Role'}
                                        >
                                            {role.isActive !== false ? <PauseCircle /> : <PlayCircle />}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                    <button
                        type="button"
                        className="manage-dropdown-item add-new-item"
                        onClick={() => {
                            onAddRole();
                            closeMenu();
                        }}
                    >
                        <span className="manage-dropdown-item-label">
                            <Plus style={{ width: '18px', height: '18px' }} />
                            Add New Role
                        </span>
                    </button>
                </>
            )}
        </Dropdown>
    );
};

const SubteamsDropdown = ({ subteams, onAddSubteam, onEditSubteam, onDeactivateSubteam, onActivateSubteam }: SubteamsDropdownProps) => {
    return (
        <Dropdown
            wrapperClassName="manage-subteams-container"
            headerClassName="manage-subteams-header"
            menuClassName="manage-dropdown-menu"
            hoverOpen
            closeDelay={150}
            button={(
                <div className="manage-combobox-trigger">
                    <span className="manage-combobox-label">Manage Subteams</span>
                    <ChevronDown className="manage-combobox-chevron" />
                </div>
            )}
        >
            {({ closeMenu }) => (
                <>
                    {subteams.map((subteam) => (
                        <div key={subteam.id} className="manage-dropdown-item-wrapper">
                            <div
                                className="manage-dropdown-item"
                            >
                                <button
                                    type="button"
                                    className="manage-dropdown-item-main"
                                    onClick={() => closeMenu()}
                                >
                                    <span className="manage-dropdown-item-label">{subteam.label}</span>
                                </button>
                                <div className="manage-dropdown-item-actions">
                                    <button
                                        type="button"
                                        className="manage-dropdown-action-btn edit-btn"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            onEditSubteam(subteam);
                                            closeMenu();
                                        }}
                                        title="Edit Subteam"
                                    >
                                        <Pencil />
                                    </button>
                                    <button
                                        type="button"
                                        className={`manage-dropdown-action-btn toggle-active-btn ${subteam.isActive !== false ? 'deactivate' : 'activate'}`}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (subteam.isActive !== false) {
                                                onDeactivateSubteam(subteam);
                                            } else {
                                                onActivateSubteam(subteam);
                                            }
                                            closeMenu();
                                        }}
                                        title={subteam.isActive !== false ? 'Deactivate Subteam' : 'Activate Subteam'}
                                    >
                                        {subteam.isActive !== false ? <PauseCircle /> : <PlayCircle />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                    <button
                        type="button"
                        className="manage-dropdown-item add-new-item"
                        onClick={() => {
                            onAddSubteam();
                            closeMenu();
                        }}
                    >
                        <span className="manage-dropdown-item-label">
                            <Plus style={{ width: '18px', height: '18px' }} />
                            Add New Subteam
                        </span>
                    </button>
                </>
            )}
        </Dropdown>
    );
};

const SpecialMembersCard = ({ title, members, onViewMember, onEditMember, onAddMember, canManageMembers = true }: SpecialMembersCardProps) => {
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
                                            {member.name.split(' ').map((n) => n[0]).join('')}
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

const MembersTable = ({ members, onViewMember, onEditMember, onAddMember, canManageMembers = true }: MembersTableProps) => {
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
                                                            {(member.name || 'U').split(' ').map((n) => n[0]).join('')}
                                                        </div>
                                                    )}
                                                </div>
                                                <span className="member-name-text">{member.name || 'Unknown Member'}</span>
                                            </div>
                                        </td>
                                        <td>{member.role || 'N/A'}</td>
                                        <td>{member.subteamName || '\u2014'}</td>
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
    const leadershipTeamIds: Id[] = user?.leadershipTeamIds || [];
    const canEditTeam = (teamId: Id): boolean => canManageTeams || leadershipTeamIds.includes(teamId);

    const [teams, setTeams] = useState<TeamItem[]>([]);
    const [selectedTeamId, setSelectedTeamId] = useState<Id | null>(null);

    const canManageMembersInSelectedTeam = canManageTeams || (selectedTeamId != null && leadershipTeamIds.includes(selectedTeamId));
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [showDeactivateModal, setShowDeactivateModal] = useState(false);
    const [showActivateModal, setShowActivateModal] = useState(false);
    const [editTeam, setEditTeam] = useState<TeamItem | null>(null);
    const [deactivateTeam, setDeactivateTeam] = useState<TeamItem | null>(null);
    const [activateTeam, setActivateTeam] = useState<TeamItem | null>(null);

    const [showAddRoleModal, setShowAddRoleModal] = useState(false);
    const [showEditRoleModal, setShowEditRoleModal] = useState(false);
    const [showDeactivateRoleModal, setShowDeactivateRoleModal] = useState(false);
    const [showActivateRoleModal, setShowActivateRoleModal] = useState(false);
    const [teamRoles, setTeamRoles] = useState<TeamRoleItem[]>([]);
    const [allRolesForModal, setAllRolesForModal] = useState<TeamRoleItem[]>([]);
    const [allSubteamsForModal, setAllSubteamsForModal] = useState<TeamSubteamItem[]>([]);
    const [editRoleInitialId, setEditRoleInitialId] = useState<Id | null>(null);
    const [deactivateRoleInitialId, setDeactivateRoleInitialId] = useState<Id | null>(null);
    const [activateRoleInitialId, setActivateRoleInitialId] = useState<Id | null>(null);

    const [showAddSubteamModal, setShowAddSubteamModal] = useState(false);
    const [showEditSubteamModal, setShowEditSubteamModal] = useState(false);
    const [showDeactivateSubteamModal, setShowDeactivateSubteamModal] = useState(false);
    const [showActivateSubteamModal, setShowActivateSubteamModal] = useState(false);
    const [teamSubteams, setTeamSubteams] = useState<TeamSubteamItem[]>([]);
    const [editSubteamInitialId, setEditSubteamInitialId] = useState<Id | null>(null);
    const [deactivateSubteamInitialId, setDeactivateSubteamInitialId] = useState<Id | null>(null);
    const [activateSubteamInitialId, setActivateSubteamInitialId] = useState<Id | null>(null);

    const [showAddMembersModal, setShowAddMembersModal] = useState(false);
    const [showEditMembersModal, setShowEditMembersModal] = useState(false);
    const [showViewMemberModal, setShowViewMemberModal] = useState(false);
    const [viewingMemberId, setViewingMemberId] = useState<Id | null>(null);
    const [editingMember, setEditingMember] = useState<TeamMemberView | null>(null);
    const [editingMemberAssignment, setEditingMemberAssignment] = useState<TeamAssignmentState | null>(null);

    const [leadershipMembers, setLeadershipMembers] = useState<TeamMemberView[]>([]);
    const [specialMembers, setSpecialMembers] = useState<TeamMemberView[]>([]);
    const [regularMembers, setRegularMembers] = useState<TeamMemberView[]>([]);

    const fetchTeams = async (): Promise<void> => {
        setLoading(true);
        setError(null);
        try {
            const data = await teamsAPI.getAll();
            const nextTeams = Array.isArray(data) ? (data as TeamItem[]) : [];
            setTeams(nextTeams);

            if (nextTeams.length > 0) {
                if (selectedTeamId == null || !nextTeams.some((team) => team.id === selectedTeamId)) {
                    setSelectedTeamId(nextTeams[0].id);
                }
            } else {
                setSelectedTeamId(null);
            }
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to fetch teams'));
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void fetchTeams();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        const loadAllForModal = async (): Promise<void> => {
            try {
                const [rolesData, subteamsData] = await Promise.all([
                    teamRolesAPI.getAll(),
                    teamSubteamsAPI.getAll(),
                ]);
                setAllRolesForModal(Array.isArray(rolesData) ? (rolesData as TeamRoleItem[]) : []);
                setAllSubteamsForModal(Array.isArray(subteamsData) ? (subteamsData as TeamSubteamItem[]) : []);
            } catch (err: unknown) {
                console.warn('Failed to load all roles/subteams for modal:', getErrorMessage(err, 'Unknown error'));
                setAllRolesForModal([]);
                setAllSubteamsForModal([]);
            }
        };
        void loadAllForModal();
    }, []);

    useEffect(() => {
        const openAdd = () => setShowAddModal(true);
        const openEdit = () => {
            const team = selectedTeamId != null ? teams.find((item) => item.id === selectedTeamId) ?? null : null;
            setEditTeam(team);
            setShowEditModal(true);
        };
        const openRemove = () => {
            const team = selectedTeamId != null ? teams.find((item) => item.id === selectedTeamId) ?? null : null;
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

    const handleTeamChange = (teamId: Id): void => {
        setSelectedTeamId(teamId);
    };

    useEffect(() => {
        if (selectedTeamId == null) return;
        void fetchRoles(selectedTeamId);
        void fetchSubteams(selectedTeamId);
        void fetchTeamMembers(selectedTeamId);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedTeamId]);

    const fetchSubteams = async (teamId: Id): Promise<void> => {
        try {
            const data = await teamSubteamsAPI.getAll(teamId);
            setTeamSubteams(Array.isArray(data) ? (data as TeamSubteamItem[]) : []);
        } catch (err: unknown) {
            console.warn('Subteams fetch failed, using empty list:', getErrorMessage(err, 'Unknown error'));
            setTeamSubteams([]);
        }
    };

    const fetchRoles = async (teamId: Id): Promise<void> => {
        setError(null);
        try {
            const data = await teamRolesAPI.getAll(teamId);
            setTeamRoles(Array.isArray(data) ? (data as TeamRoleItem[]) : []);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to fetch roles'));
        }
    };

    const fetchTeamMembers = async (teamId: Id): Promise<void> => {
        setError(null);
        try {
            const data = await teamMembersAPI.getAll(teamId, undefined, true);
            const source = Array.isArray(data) ? (data as TeamMemberApiItem[]) : [];

            const transformedMembers: TeamMemberView[] = source.map((teamMember) => {
                const rawRoleType = teamMember.role?.roleType || 'Regular';
                const roleType: MemberRoleType = rawRoleType === 'Leadership' || rawRoleType === 'Special Roles' || rawRoleType === 'Regular'
                    ? rawRoleType
                    : rawRoleType === 'Leader'
                        ? 'Leadership'
                        : 'Regular';

                return {
                    id: teamMember.id,
                    name: teamMember.member?.fullName || 'Unknown',
                    email: teamMember.member?.email || 'N/A',
                    role: teamMember.role?.roleName || 'N/A',
                    status: teamMember.isActive ? 'Active' : 'Inactive',
                    avatar: teamMember.member?.profilePhotoUrl ? getProfilePhotoUrl(teamMember.memberId) : null,
                    teamMemberId: teamMember.id,
                    memberId: teamMember.memberId,
                    roleId: teamMember.roleId ?? null,
                    teamId: teamMember.teamId,
                    subteamId: teamMember.subteamId ?? null,
                    subteamName: teamMember.subteam?.name ?? null,
                    roleType,
                    joinedDate: teamMember.joinedDate,
                    isActive: teamMember.isActive === true,
                    leftDate: teamMember.leftDate ?? null,
                };
            });

            setLeadershipMembers(transformedMembers.filter((member) => member.roleType === 'Leadership'));
            setSpecialMembers(transformedMembers.filter((member) => member.roleType === 'Special Roles'));
            setRegularMembers(transformedMembers.filter((member) => member.roleType !== 'Leadership' && member.roleType !== 'Special Roles'));
        } catch (err: unknown) {
            console.error('Error fetching team members:', err);
            setError(getErrorMessage(err, 'Failed to fetch team members'));
            setRegularMembers([]);
            setLeadershipMembers([]);
            setSpecialMembers([]);
        }
    };

    const handleAddTeam = async (formData: TeamFormData): Promise<void> => {
        setError(null);
        await teamsAPI.create(formData);
        setShowAddModal(false);
        await fetchTeams();
    };

    const handleAddRole = async (formData: RoleFormData): Promise<void> => {
        if (selectedTeamId == null) return;
        setError(null);
        const parsedMaxCount = formData.maxCount == null || formData.maxCount === ''
            ? null
            : typeof formData.maxCount === 'string'
                ? parseInt(formData.maxCount, 10)
                : formData.maxCount;

        await teamRolesAPI.create({
            teamId: selectedTeamId,
            roleName: formData.roleName,
            roleType: formData.roleType || 'Regular',
            maxCount: parsedMaxCount,
        });
        setShowAddRoleModal(false);
        await fetchRoles(selectedTeamId);
    };

    const handleEditRole = async (roleId: Id | string, formData: RoleFormData): Promise<void> => {
        if (selectedTeamId == null) return;
        setError(null);
        const parsedMaxCount = formData.maxCount == null || formData.maxCount === ''
            ? null
            : typeof formData.maxCount === 'string'
                ? parseInt(formData.maxCount, 10)
                : formData.maxCount;

        await teamRolesAPI.update(roleId, {
            roleName: formData.roleName,
            roleType: formData.roleType || 'Regular',
            maxCount: parsedMaxCount,
            isActive: formData.isActive,
        });
        setShowEditRoleModal(false);
        await fetchRoles(selectedTeamId);
    };

    const handleDeactivateRole = async (roleId: Id): Promise<void> => {
        if (selectedTeamId == null) return;
        setError(null);
        await teamRolesAPI.deactivate(roleId);
        setShowDeactivateRoleModal(false);
        await fetchRoles(selectedTeamId);
    };

    const handleActivateRole = async (roleId: Id): Promise<void> => {
        if (selectedTeamId == null) return;
        setError(null);
        await teamRolesAPI.activate(roleId);
        setShowActivateRoleModal(false);
        await fetchRoles(selectedTeamId);
    };

    const handleAddSubteam = async (formData: SubteamFormData): Promise<void> => {
        if (selectedTeamId == null) return;
        setError(null);
        await teamSubteamsAPI.create({
            teamId: selectedTeamId,
            name: formData.name.trim(),
            description: formData.description?.trim() || null,
        });
        setShowAddSubteamModal(false);
        await fetchSubteams(selectedTeamId);
    };

    const handleEditSubteam = async (subteamId: Id, formData: SubteamFormData): Promise<void> => {
        if (selectedTeamId == null) return;
        setError(null);
        await teamSubteamsAPI.update(subteamId, {
            name: formData.name.trim(),
            description: formData.description?.trim() || null,
            isActive: formData.isActive,
        });
        setShowEditSubteamModal(false);
        await fetchSubteams(selectedTeamId);
    };

    const handleDeactivateSubteam = async (subteamId: Id): Promise<void> => {
        if (selectedTeamId == null) return;
        setError(null);
        await teamSubteamsAPI.deactivate(subteamId);
        setShowDeactivateSubteamModal(false);
        await fetchSubteams(selectedTeamId);
    };

    const handleActivateSubteam = async (subteamId: Id): Promise<void> => {
        if (selectedTeamId == null) return;
        setError(null);
        await teamSubteamsAPI.activate(subteamId);
        setShowActivateSubteamModal(false);
        await fetchSubteams(selectedTeamId);
    };

    const handleEditTeam = async (teamId: Id | string | null, formData: TeamFormData): Promise<void> => {
        setError(null);
        const id = teamId ?? editTeam?.id;
        if (id == null) return;
        await teamsAPI.update(id, formData);
        setShowEditModal(false);
        setEditTeam(null);
        await fetchTeams();
    };

    const handleDeactivateTeam = async (teamId: Id): Promise<void> => {
        setError(null);
        await teamsAPI.deactivate(teamId);
        setShowDeactivateModal(false);
        setDeactivateTeam(null);
        if (selectedTeamId === teamId) {
            setSelectedTeamId(teams.length > 1 ? teams.find((team) => team.id !== teamId)?.id ?? null : null);
        }
        await fetchTeams();
    };

    const handleActivateTeam = async (teamId: Id): Promise<void> => {
        setError(null);
        await teamsAPI.activate(teamId);
        setShowActivateModal(false);
        setActivateTeam(null);
        await fetchTeams();
    };

    const handleViewMember = (member: TeamMemberView): void => {
        setViewingMemberId(member.memberId || member.id);
        setShowViewMemberModal(true);
    };

    const handleEditMember = (member: TeamMemberView): void => {
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

    const handleAddLeadership = (): void => {
        setShowAddMembersModal(true);
    };

    const handleAddSpecialRole = (): void => {
        setShowAddMembersModal(true);
    };

    const handleAddTeamMember = (): void => {
        setShowAddMembersModal(true);
    };

    const handleAddMember = async (): Promise<void> => {
        setError(null);
        try {
            if (selectedTeamId != null) {
                await fetchTeamMembers(selectedTeamId);
            }
            setShowAddMembersModal(false);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to add member'));
            console.error('Error adding member:', err);
        }
    };

    const handleEditMemberSubmit = async (): Promise<void> => {
        setError(null);
        try {
            if (selectedTeamId != null) {
                await fetchTeamMembers(selectedTeamId);
            }
            setShowEditMembersModal(false);
            setEditingMember(null);
            setEditingMemberAssignment(null);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to update member'));
            console.error('Error updating member:', err);
        }
    };

    const handleOpenAddRoleModal = (): void => {
        setShowAddRoleModal(true);
    };

    const dropdownTeams: TeamDropdownItem[] = teams.map((team) => ({
        id: team.id,
        label: team.isActive === false ? `${team.name} (Inactive)` : team.name,
        badge: Array.isArray(team.members) ? team.members.length : undefined,
        isActive: team.isActive,
    }));

    const SYSTEM_ROLE_NAMES = ['Head of Team', 'Vice Head of Team', 'Member'];
    const dropdownRoles: RoleDropdownItem[] = teamRoles.map((role) => {
        const isSystemRole = role.systemRoleKey != null || SYSTEM_ROLE_NAMES.includes(role.roleName);
        return {
            id: role.id,
            label: role.isActive === false ? `${role.roleName} (Inactive)` : role.roleName,
            isActive: role.isActive,
            systemRoleKey: role.systemRoleKey ?? null,
            roleName: role.roleName,
            isSystemRole,
        };
    });

    const dropdownSubteams: SubteamDropdownItem[] = teamSubteams.map((subteam) => ({
        id: subteam.id,
        label: subteam.isActive === false ? `${subteam.name} (Inactive)` : subteam.name,
        isActive: subteam.isActive,
    }));

    return (
        <div className="teams-page">
            <div className="page-header">
                <TitleDropdown
                    selectedTeam={selectedTeamId}
                    teams={dropdownTeams}
                    onTeamChange={handleTeamChange}
                    onAddTeam={() => setShowAddModal(true)}
                    onEditTeam={(team) => {
                        setEditTeam(teams.find((item) => item.id === team.id) ?? null);
                        setShowEditModal(true);
                    }}
                    onToggleTeamActive={(team) => {
                        if (team.isActive !== false) {
                            setDeactivateTeam(teams.find((item) => item.id === team.id) ?? null);
                            setShowDeactivateModal(true);
                        } else {
                            setActivateTeam(teams.find((item) => item.id === team.id) ?? null);
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

            {error && <div className="error-message">{error}</div>}
            {loading && <div className="loading-message">Loading teams...</div>}
            {!loading && !error && teams.length === 0 && !canManage && (
                <div className="empty-message">
                    You are not assigned to any team. Contact your administrator for access.
                </div>
            )}

            <hr className="title-divider" />

            <SpecialMembersCard
                title="Leadership"
                members={leadershipMembers}
                onViewMember={handleViewMember}
                onEditMember={handleEditMember}
                onAddMember={handleAddLeadership}
                canManageMembers={canManageMembersInSelectedTeam}
            />

            <SpecialMembersCard
                title="Special Roles"
                members={specialMembers}
                onViewMember={handleViewMember}
                onEditMember={handleEditMember}
                onAddMember={handleAddSpecialRole}
                canManageMembers={canManageMembersInSelectedTeam}
            />

            <MembersTable
                members={regularMembers}
                onViewMember={handleViewMember}
                onEditMember={handleEditMember}
                onAddMember={handleAddTeamMember}
                canManageMembers={canManageMembersInSelectedTeam}
            />

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
                teams={teams.filter((team) => team.isActive !== false)}
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
                    .filter((member) => member.memberId !== editingMember?.memberId && member.roleId != null)
                    .map((member) => member.roleId as Id)}
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

