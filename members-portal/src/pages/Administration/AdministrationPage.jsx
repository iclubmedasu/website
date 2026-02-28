import { useState, useEffect } from 'react';
import { Eye, Pencil, Shield, UserCog, UserPlus, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { administrationAPI, membersAPI, teamsAPI, teamMembersAPI, teamRolesAPI, teamSubteamsAPI } from '../../services/api';
import ViewMemberModal from '../Teams/modals/ViewMemberModal';
import EditAdminMembersModal from './modals/EditAdminMembersModal';
import AddOfficerModal from './modals/AddOfficerModal';
import OfficerHandoverModal from './modals/OfficerHandoverModal';

import './AdministrationPage.css';

// Administration team role names (hierarchy: Officer highest, then President, then Vice President lowest)
const ADMIN_ROLE_ORDER = ['Officer', 'President', 'Vice President'];

// Change type options for President/Vice President assignment (recorded in member role history)
const ADMIN_CHANGE_TYPE_OPTIONS = [
    { value: 'Promotion', label: 'Promotion' },
    { value: 'Assignment', label: 'Assignment' },
    { value: 'New', label: 'New' },
];

function AssignAdministrationModal({ isOpen, onClose, onSubmit, members, teams, role: adminRole, roleLabel }) {
    const [teamFilterId, setTeamFilterId] = useState('');
    const [memberId, setMemberId] = useState('');
    const [membersInTeam, setMembersInTeam] = useState([]);
    const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);
    const [memberAssignments, setMemberAssignments] = useState([]); // current assignments of selected member (for transfer-from)
    const [currentAssignmentId, setCurrentAssignmentId] = useState('');
    const [loadingAssignments, setLoadingAssignments] = useState(false);
    const [changeType, setChangeType] = useState('Promotion');
    const [changeReason, setChangeReason] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setTeamFilterId('');
            setMemberId('');
            setMembersInTeam([]);
            setMemberAssignments([]);
            setCurrentAssignmentId('');
            setChangeType('Promotion');
            setChangeReason('');
            setNotes('');
            setError('');
        }
    }, [isOpen, adminRole]);

    useEffect(() => {
        if (!isOpen || !teamFilterId) {
            setMembersInTeam([]);
            return;
        }
        let cancelled = false;
        setLoadingTeamMembers(true);
        teamMembersAPI.getAll(teamFilterId, undefined, true)
            .then((data) => {
                if (cancelled) return;
                const list = Array.isArray(data) ? data : [];
                const byId = new Map();
                list.forEach((tm) => {
                    if (tm.member && !byId.has(tm.member.id)) byId.set(tm.member.id, tm.member);
                });
                setMembersInTeam(Array.from(byId.values()));
            })
            .catch(() => {
                if (!cancelled) setMembersInTeam([]);
            })
            .finally(() => {
                if (!cancelled) setLoadingTeamMembers(false);
            });
        return () => { cancelled = true; };
    }, [isOpen, teamFilterId]);

    // When member is selected, fetch their current assignment(s) so we know which one to transfer from
    useEffect(() => {
        if (!isOpen || !memberId) {
            setMemberAssignments([]);
            setCurrentAssignmentId('');
            return;
        }
        let cancelled = false;
        setLoadingAssignments(true);
        teamMembersAPI.getAll(undefined, memberId, true)
            .then((data) => {
                if (cancelled) return;
                const list = Array.isArray(data) ? data : [];
                setMemberAssignments(list);
                if (list.length === 1) setCurrentAssignmentId(String(list[0].id));
                else setCurrentAssignmentId('');
            })
            .catch(() => {
                if (!cancelled) setMemberAssignments([]);
                if (!cancelled) setCurrentAssignmentId('');
            })
            .finally(() => {
                if (!cancelled) setLoadingAssignments(false);
            });
        return () => { cancelled = true; };
    }, [isOpen, memberId]);

    const displayMembers = teamFilterId ? membersInTeam : (members || []);
    const memberOptions = displayMembers;
    const canTransfer = memberAssignments.length > 0 && (memberAssignments.length === 1 ? true : !!currentAssignmentId);

    const handleTeamFilterChange = (value) => {
        setTeamFilterId(value);
        setMemberId('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!memberId) {
            setError('Please select a member.');
            return;
        }
        if (!canTransfer) {
            setError(memberAssignments.length === 0 ? 'Member must be in a team to transfer to Administration.' : 'Please select which team they are transferring from.');
            return;
        }
        setError('');
        setIsSubmitting(true);
        try {
            const assignmentId = memberAssignments.length === 1 ? memberAssignments[0].id : parseInt(currentAssignmentId, 10);
            await onSubmit({
                currentAssignmentId: assignmentId,
                memberId: parseInt(memberId, 10),
                role: adminRole,
                changeType: changeType || 'Transfer',
                changeReason: changeReason.trim() || null,
                notes: notes.trim() || null,
            });
            onClose();
        } catch (err) {
            setError(err.message || 'Failed to assign');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="modal-backdrop administration-assign-modal" onClick={onClose}>
            <div className="modal-container modal-large" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2 className="modal-title">Assign {roleLabel}</h2>
                    <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
                        <X size={24} />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && <div className="error-message">{error}</div>}

                        <div className="form-section info-section">
                            <h3 className="form-section-title">Assignment to Administration</h3>
                            <div className="info-grid">
                                <div className="info-item">
                                    <label className="info-label">Team</label>
                                    <p className="info-value">Administration</p>
                                </div>
                                <div className="info-item">
                                    <label className="info-label">Role</label>
                                    <p className="info-value">{roleLabel}</p>
                                </div>
                            </div>
                        </div>

                        <div className="form-section">
                            <h3 className="form-section-title">Select member to transfer to Administration</h3>
                            <p className="form-hint-text">The member will leave their current team and join Administration as {roleLabel}. Filter by team (optional), then choose the member.</p>
                            <div className="form-group">
                                <label htmlFor="admin-team" className="form-label">Filter by team</label>
                                <select
                                    id="admin-team"
                                    value={teamFilterId}
                                    onChange={(e) => handleTeamFilterChange(e.target.value)}
                                    className="form-input"
                                >
                                    <option value="">All teams</option>
                                    {(teams || []).map((t) => (
                                        <option key={t.id} value={t.id}>{t.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="admin-member" className="form-label">Member *</label>
                                <select
                                    id="admin-member"
                                    value={memberId}
                                    onChange={(e) => setMemberId(e.target.value)}
                                    className="form-input"
                                    disabled={loadingTeamMembers}
                                >
                                    <option value="">
                                        {loadingTeamMembers ? 'Loading...' : 'Select a member'}
                                    </option>
                                    {memberOptions.map((m) => (
                                        <option key={m.id} value={m.id}>{m.fullName}</option>
                                    ))}
                                </select>
                            </div>
                            {memberId && loadingAssignments && (
                                <p className="form-hint-text">Loading current assignment…</p>
                            )}
                            {memberId && !loadingAssignments && memberAssignments.length === 0 && (
                                <p className="form-hint-text" style={{ color: 'var(--error-text)' }}>
                                    This member is not in any team. They must be in a team to transfer to Administration.
                                </p>
                            )}
                            {memberId && !loadingAssignments && memberAssignments.length > 1 && (
                                <div className="form-group">
                                    <label htmlFor="admin-from-assignment" className="form-label">Transfer from team *</label>
                                    <select
                                        id="admin-from-assignment"
                                        value={currentAssignmentId}
                                        onChange={(e) => setCurrentAssignmentId(e.target.value)}
                                        className="form-input"
                                        disabled={isSubmitting}
                                    >
                                        <option value="">Select which team they are leaving</option>
                                        {memberAssignments.map((a) => (
                                            <option key={a.id} value={a.id}>
                                                {a.team?.name ?? 'Team'} • {a.role?.roleName ?? 'Role'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="form-section">
                            <h3 className="form-section-title">Role history</h3>
                            <p className="form-hint-text">This assignment will be recorded in the member&apos;s role history (e.g. Promotion from Head of Team).</p>
                            <div className="form-group">
                                <label htmlFor="admin-changeType" className="form-label">Change type</label>
                                <select
                                    id="admin-changeType"
                                    value={changeType}
                                    onChange={(e) => setChangeType(e.target.value)}
                                    className="form-input"
                                    disabled={isSubmitting}
                                >
                                    {ADMIN_CHANGE_TYPE_OPTIONS.map((opt) => (
                                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="admin-changeReason" className="form-label">Change reason (optional)</label>
                                <input
                                    id="admin-changeReason"
                                    type="text"
                                    value={changeReason}
                                    onChange={(e) => setChangeReason(e.target.value)}
                                    className="form-input"
                                    placeholder="e.g. Promoted from Head of Events"
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="admin-notes" className="form-label">Notes (optional)</label>
                                <textarea
                                    id="admin-notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="form-input form-textarea"
                                    placeholder="Additional notes"
                                    rows={2}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className="btn btn-primary"
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Assigning...' : 'Assign'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

function RoleSection({ roleName, roleLabel, assignee, isOfficer, canEdit, onAssign, onAddOfficer, onView, onEdit, onOfficerManage, onRemove, formatDate }) {
    return (
        <div className="card administration-role-section">
            <div className="card-header card-header-with-action">
                <div className="card-header-left">
                    <h3 className="card-title">{roleLabel}</h3>
                </div>
            </div>
            <div className="card-body">
                {assignee ? (
                    <div className="administration-assignee">
                        <div className="table-member-cell">
                            <div className="member-avatar-sm">
                                {assignee.member?.profilePhotoUrl ? (
                                    <img src={assignee.member.profilePhotoUrl} alt={assignee.member.fullName} />
                                ) : (
                                    <div className="avatar-placeholder-sm">
                                        {(assignee.member?.fullName || 'U').split(' ').map((n) => n[0]).join('')}
                                    </div>
                                )}
                            </div>
                            <div>
                                <span className="member-name-text">{assignee.member?.fullName || 'Unknown'}</span>
                                <span className="administration-start-date">Since {formatDate(assignee.joinedDate)}</span>
                            </div>
                        </div>
                        <div className="action-buttons">
                            <button
                                type="button"
                                className="table-action-btn view-btn"
                                onClick={() => onView(assignee.memberId)}
                                title="View Member"
                            >
                                <Eye />
                            </button>
                            {canEdit && (isOfficer ? (
                                <button
                                    type="button"
                                    className="table-action-btn edit-btn"
                                    onClick={() => onOfficerManage(assignee)}
                                    title="Handover / Retire"
                                >
                                    <UserCog size={18} />
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    className="table-action-btn edit-btn"
                                    onClick={() => onEdit(assignee)}
                                    title="Edit Member"
                                >
                                    <Pencil />
                                </button>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="administration-empty">
                        <p className="administration-empty-text">
                            {isOfficer ? 'No officer assigned' : 'No one assigned'}
                        </p>
                        {canEdit && (
                            <button
                                type="button"
                                className="empty-state-btn"
                                onClick={() => (isOfficer ? onAddOfficer() : onAssign(roleName))}
                            >
                                <UserPlus size={18} />
                                {isOfficer ? 'Add Officer' : 'Assign member'}
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

function AdministrationPage() {
    const { user } = useAuth();
    const canEdit = !!(user?.isDeveloper || user?.isOfficer);
    const [adminTeam, setAdminTeam] = useState(null);
    const [members, setMembers] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [assignModalRole, setAssignModalRole] = useState(null); // { roleName, role: { id, roleName } }
    const [showAddOfficerModal, setShowAddOfficerModal] = useState(false);
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewingMemberId, setViewingMemberId] = useState(null);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [editingMemberAssignment, setEditingMemberAssignment] = useState(null);
    const [allRolesForModal, setAllRolesForModal] = useState([]);
    const [allSubteamsForModal, setAllSubteamsForModal] = useState([]);
    const [showOfficerHandoverModal, setShowOfficerHandoverModal] = useState(false);
    const [officerHandoverAssignee, setOfficerHandoverAssignee] = useState(null);

    const fetchAdminTeam = async () => {
        try {
            const data = await administrationAPI.getTeam();
            setAdminTeam(data);
        } catch (err) {
            setError(err.message || 'Failed to load administration');
            setAdminTeam(null);
        }
    };

    const fetchMembers = async () => {
        try {
            const data = await membersAPI.getAll(true);
            setMembers(Array.isArray(data) ? data : []);
        } catch (err) {
            setMembers([]);
        }
    };

    const fetchTeams = async () => {
        try {
            const data = await teamsAPI.getAll(true);
            setTeams(Array.isArray(data) ? data : []);
        } catch (err) {
            setTeams([]);
        }
    };

    useEffect(() => {
        setLoading(true);
        setError(null);
        Promise.all([fetchAdminTeam(), fetchMembers(), fetchTeams()]).finally(() => setLoading(false));
    }, []);

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
                console.warn('Failed to load all roles/subteams for edit modal:', err?.message);
                setAllRolesForModal([]);
                setAllSubteamsForModal([]);
            }
        };
        loadAllForModal();
    }, []);

    const handleAssignSubmit = async (data) => {
        if (!adminTeam || !data.role) return;
        // If someone already holds this Administration role, remove them first (they become unassigned or keep other teams)
        const current = (adminTeam.members || []).find((m) => m.role?.roleName === data.role.roleName);
        if (current) {
            await teamMembersAPI.remove(current.id, { changeType: 'Resignation', changeReason: 'Replaced' });
        }
        // Transfer member from their current team to Administration (leaves current team, joins Administration)
        await teamMembersAPI.transfer(data.currentAssignmentId, {
            newTeamId: adminTeam.id,
            newRoleId: data.role.id,
            newSubteamId: null,
            changeType: data.changeType || 'Transfer',
            changeReason: data.changeReason || null,
            notes: data.notes || null,
        });
        await fetchAdminTeam();
        setAssignModalRole(null);
    };

    const handleAddOfficerSubmit = async (officerData) => {
        if (!adminTeam) return;
        const officerRole = (adminTeam.roles || []).find((r) => r.roleName === 'Officer');
        if (!officerRole) throw new Error('Officer role not found');
        // Create officer placeholder member via the new administration endpoint
        const newMember = await administrationAPI.createOfficer(officerData);
        const currentOfficer = (adminTeam.members || []).find((m) => m.role?.roleName === 'Officer');
        if (currentOfficer) {
            await teamMembersAPI.remove(currentOfficer.id, { changeType: 'Resignation', changeReason: 'Replaced' });
        }
        await teamMembersAPI.assign({
            teamId: adminTeam.id,
            memberId: newMember.id,
            roleId: officerRole.id,
            changeReason: 'Initial assignment',
        });
        await fetchAdminTeam();
        setShowAddOfficerModal(false);
    };

    const handleRemove = async (assignmentId) => {
        try {
            await teamMembersAPI.remove(assignmentId, {
                changeType: 'Resignation',
                changeReason: 'Removed from administration',
            });
            await fetchAdminTeam();
        } catch (err) {
            setError(err.message || 'Failed to remove assignment');
        }
    };

    const handleOfficerManage = (assignee) => {
        setOfficerHandoverAssignee(assignee);
        setShowOfficerHandoverModal(true);
    };

    const handleOfficerRetire = async (data) => {
        if (!officerHandoverAssignee) return;
        await teamMembersAPI.updateStatus(officerHandoverAssignee.id, {
            isActive: false,
            changeType: data.changeType,
            changeReason: data.changeReason || data.changeType,
            notes: data.notes,
        });
        await fetchAdminTeam();
        setShowOfficerHandoverModal(false);
        setOfficerHandoverAssignee(null);
    };

    const handleOfficerHandover = async (newOfficerData) => {
        if (!adminTeam) return;
        const officerRole = (adminTeam.roles || []).find((r) => r.roleName === 'Officer');
        if (!officerRole) throw new Error('Officer role not found');
        if (officerHandoverAssignee) {
            await teamMembersAPI.updateStatus(officerHandoverAssignee.id, {
                isActive: false,
                changeType: 'Retirement',
                changeReason: 'Handover to new officer',
                notes: null,
            });
        }
        // Create new officer placeholder member via administration endpoint
        const newMember = await administrationAPI.createOfficer(newOfficerData);
        await teamMembersAPI.assign({
            teamId: adminTeam.id,
            memberId: newMember.id,
            roleId: officerRole.id,
            changeReason: 'Handover from previous officer',
        });
        await fetchAdminTeam();
        setShowOfficerHandoverModal(false);
        setOfficerHandoverAssignee(null);
    };

    const handleEditMember = (assignee) => {
        if (!assignee?.member || !adminTeam) return;
        const member = {
            ...assignee.member,
            id: assignee.member.id ?? assignee.memberId,
            memberId: assignee.memberId,
        };
        setEditingMember(member);
        setEditingMemberAssignment({
            id: assignee.id,
            memberId: assignee.memberId,
            teamId: adminTeam.id,
            roleId: assignee.role?.id,
            subteamId: assignee.subteamId ?? null,
            joinedDate: assignee.joinedDate,
            isActive: assignee.isActive !== false,
            leftDate: assignee.leftDate ?? null,
        });
        setShowEditModal(true);
    };

    const handleEditMemberSubmit = async () => {
        try {
            await fetchAdminTeam();
            setShowEditModal(false);
            setEditingMember(null);
            setEditingMemberAssignment(null);
        } catch (err) {
            setError(err.message || 'Failed to refresh');
        }
    };

    const formatDate = (d) => {
        if (!d || Number.isNaN(new Date(d).getTime())) return '—';
        return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    const getAssigneeByRole = (roleName) =>
        (adminTeam?.members || []).find((m) => m.role?.roleName === roleName) || null;

    return (
        <div className="administration-page members-page">
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">Administration</h1>
            </div>

            <hr className="title-divider" />

            {error && <div className="error-message">{error}</div>}
            {loading && <div className="loading-message">Loading administration...</div>}

            {!loading && adminTeam && (
                <div className="administration-sections">
                    {ADMIN_ROLE_ORDER.map((roleName) => (
                        <RoleSection
                            key={roleName}
                            roleName={roleName}
                            roleLabel={roleName}
                            assignee={getAssigneeByRole(roleName)}
                            isOfficer={roleName === 'Officer'}
                            canEdit={canEdit}
                            onAssign={(name) => {
                                const role = (adminTeam.roles || []).find((r) => r.roleName === name);
                                if (role) setAssignModalRole({ roleName: name, role });
                            }}
                            onAddOfficer={() => setShowAddOfficerModal(true)}
                            onView={(memberId) => {
                                setViewingMemberId(memberId);
                                setShowViewModal(true);
                            }}
                            onEdit={handleEditMember}
                            onOfficerManage={handleOfficerManage}
                            onRemove={handleRemove}
                            formatDate={formatDate}
                        />
                    ))}
                </div>
            )}

            {adminTeam && (adminTeam.members?.length ?? 0) === 0 && !loading && (
                <div className="card administration-empty-state">
                    <div className="card-body">
                        <Shield className="empty-state-icon" size={48} />
                        <h4 className="empty-state-title">Administration roles</h4>
                        <p className="empty-state-text">
                            Assign members from any team to Officer, President, or Vice President using the Assign button in each section above.
                        </p>
                    </div>
                </div>
            )}

            <AddOfficerModal
                isOpen={showAddOfficerModal}
                onClose={() => setShowAddOfficerModal(false)}
                onSubmit={handleAddOfficerSubmit}
            />

            <OfficerHandoverModal
                isOpen={showOfficerHandoverModal}
                onClose={() => {
                    setShowOfficerHandoverModal(false);
                    setOfficerHandoverAssignee(null);
                }}
                currentOfficerAssignee={officerHandoverAssignee}
                onRetire={handleOfficerRetire}
                onHandover={handleOfficerHandover}
            />

            <AssignAdministrationModal
                isOpen={assignModalRole != null}
                onClose={() => setAssignModalRole(null)}
                onSubmit={handleAssignSubmit}
                members={members}
                teams={teams}
                role={assignModalRole?.role}
                roleLabel={assignModalRole?.roleName ?? ''}
            />

            <ViewMemberModal
                isOpen={showViewModal}
                onClose={() => { setShowViewModal(false); setViewingMemberId(null); }}
                memberId={viewingMemberId}
            />

            {adminTeam && (
                <EditAdminMembersModal
                    isOpen={showEditModal}
                    onClose={() => {
                        setShowEditModal(false);
                        setEditingMember(null);
                        setEditingMemberAssignment(null);
                    }}
                    onSubmit={handleEditMemberSubmit}
                    member={editingMember}
                    currentTeamAssignment={editingMemberAssignment}
                    teams={teams.some((t) => t.id === adminTeam.id) ? teams : [adminTeam, ...teams]}
                    roles={allRolesForModal}
                    subteams={allSubteamsForModal}
                    occupiedRoleIds={
                        (adminTeam.members || [])
                            .filter((m) => m.memberId !== editingMember?.memberId && m.role?.id)
                            .map((m) => m.role.id)
                    }
                />
            )}
        </div>
    );
}

export default AdministrationPage;
