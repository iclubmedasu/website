'use client';

import { useEffect, useState, type FormEvent, type MouseEvent } from 'react';
import { X } from 'lucide-react';
import { membersAPI, teamMembersAPI, teamRolesAPI, teamsAPI } from '../../../../services/api';
import type { Id } from '../../../../types/backend-contracts';

interface MemberOption {
    id: Id;
    fullName?: string | null;
    email?: string | null;
    profilePhotoUrl?: string | null;
}

interface TeamOption {
    id: Id;
    name: string;
    isActive?: boolean;
}

interface TeamRoleOption {
    id: Id;
    roleName: string;
    teamId?: Id;
    isActive?: boolean;
}

interface TeamMemberAssignment {
    id: Id | string;
    memberId: Id;
    subteamId?: Id | null;
    joinedDate?: string | null;
    leftDate?: string | null;
    isActive?: boolean;
    member?: MemberOption | null;
    team?: {
        id?: Id;
        name?: string | null;
    } | null;
    role?: {
        id?: Id;
        roleName?: string | null;
    } | null;
}

interface LeadershipAssignee {
    id: Id | string;
    memberId: Id;
    isActive?: boolean;
    joinedDate?: string | null;
    member?: {
        id?: Id;
        fullName?: string | null;
    } | null;
    role?: {
        roleName?: string | null;
    } | null;
}

const OUTGOING_CHANGE_TYPE_OPTIONS = ['Retirement', 'Resignation', 'Expulsion', 'Graduation'] as const;
type OutgoingChangeType = (typeof OUTGOING_CHANGE_TYPE_OPTIONS)[number];

interface LeadershipHandoverPayload {
    memberId: number;
    targetAssignmentId?: Id | string | null;
    changeReason?: string | null;
    notes?: string | null;
    outgoingDisposition: 'leave' | 'transfer';
    outgoingChangeType: OutgoingChangeType;
    outgoingTransferTeamId?: Id | string | null;
    outgoingTransferRoleId?: Id | string | null;
    outgoingChangeReason?: string | null;
    outgoingNotes?: string | null;
}

interface LeadershipHandoverModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentLeadershipAssignee?: LeadershipAssignee | null;
    roleLabel: string;
    onSubmit: (payload: LeadershipHandoverPayload) => Promise<void> | void;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

function LeadershipHandoverModal({
    isOpen,
    onClose,
    currentLeadershipAssignee,
    roleLabel,
    onSubmit,
}: LeadershipHandoverModalProps) {
    const [teamFilterId, setTeamFilterId] = useState('');
    const [memberId, setMemberId] = useState('');
    const [membersInTeam, setMembersInTeam] = useState<MemberOption[]>([]);
    const [allMembers, setAllMembers] = useState<MemberOption[]>([]);
    const [teams, setTeams] = useState<TeamOption[]>([]);
    const [roles, setRoles] = useState<TeamRoleOption[]>([]);
    const [memberAssignments, setMemberAssignments] = useState<TeamMemberAssignment[]>([]);
    const [currentAssignmentId, setCurrentAssignmentId] = useState('');
    const [loadingTeamMembers, setLoadingTeamMembers] = useState(false);
    const [loadingAssignments, setLoadingAssignments] = useState(false);
    const [outgoingDisposition, setOutgoingDisposition] = useState<'leave' | 'transfer'>('leave');
    const [outgoingChangeType, setOutgoingChangeType] = useState<OutgoingChangeType>('Retirement');
    const [outgoingTransferTeamId, setOutgoingTransferTeamId] = useState('');
    const [outgoingTransferRoleId, setOutgoingTransferRoleId] = useState('');
    const [outgoingChangeReason, setOutgoingChangeReason] = useState('');
    const [outgoingNotes, setOutgoingNotes] = useState('');
    const [changeReason, setChangeReason] = useState('');
    const [notes, setNotes] = useState('');
    const [error, setError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!isOpen) return;

        let cancelled = false;
        setTeamFilterId('');
        setMemberId('');
        setMembersInTeam([]);
        setAllMembers([]);
        setTeams([]);
        setRoles([]);
        setMemberAssignments([]);
        setCurrentAssignmentId('');
        setOutgoingDisposition('leave');
        setOutgoingChangeType('Retirement');
        setOutgoingTransferTeamId('');
        setOutgoingTransferRoleId('');
        setOutgoingChangeReason('');
        setOutgoingNotes('');
        setChangeReason('');
        setNotes('');
        setError('');

        Promise.all([membersAPI.getAll(true), teamsAPI.getAll(true), teamRolesAPI.getAll()])
            .then(([membersData, teamsData, rolesData]) => {
                if (cancelled) return;
                setAllMembers(Array.isArray(membersData) ? (membersData as MemberOption[]) : []);
                setTeams(Array.isArray(teamsData) ? (teamsData as TeamOption[]) : []);
                setRoles(Array.isArray(rolesData) ? (rolesData as TeamRoleOption[]) : []);
            })
            .catch(() => {
                if (cancelled) return;
                setAllMembers([]);
                setTeams([]);
                setRoles([]);
            });

        return () => { cancelled = true; };
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !teamFilterId) {
            setMembersInTeam([]);
            return;
        }

        let cancelled = false;
        setLoadingTeamMembers(true);
        teamMembersAPI.getAll(teamFilterId, undefined, true)
            .then((data: unknown) => {
                if (cancelled) return;
                const list = Array.isArray(data) ? (data as TeamMemberAssignment[]) : [];
                const byId = new Map<Id, MemberOption>();
                list.forEach((teamMember) => {
                    if (teamMember.member && !byId.has(teamMember.member.id)) {
                        byId.set(teamMember.member.id, teamMember.member);
                    }
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

    useEffect(() => {
        if (!isOpen || !memberId) {
            setMemberAssignments([]);
            setCurrentAssignmentId('');
            return;
        }

        let cancelled = false;
        setLoadingAssignments(true);
        teamMembersAPI.getAll(undefined, memberId, true)
            .then((data: unknown) => {
                if (cancelled) return;
                const list = Array.isArray(data) ? (data as TeamMemberAssignment[]) : [];
                setMemberAssignments(list);
                setCurrentAssignmentId(list.length === 1 ? String(list[0].id) : '');
            })
            .catch(() => {
                if (!cancelled) {
                    setMemberAssignments([]);
                    setCurrentAssignmentId('');
                }
            })
            .finally(() => {
                if (!cancelled) setLoadingAssignments(false);
            });

        return () => { cancelled = true; };
    }, [isOpen, memberId]);

    const displayMembers = teamFilterId ? membersInTeam : allMembers;
    const outgoingTransferRoles = outgoingTransferTeamId
        ? roles.filter((role) => role.teamId != null && String(role.teamId) === outgoingTransferTeamId && role.isActive !== false)
        : [];

    const handleTeamFilterChange = (value: string) => {
        setTeamFilterId(value);
        setMemberId('');
    };

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();

        if (!memberId) {
            setError('Please select a member.');
            return;
        }

        if (outgoingDisposition === 'transfer') {
            if (!outgoingTransferTeamId) {
                setError('Please select the team the outgoing leader will transfer to.');
                return;
            }
            if (!outgoingTransferRoleId) {
                setError('Please select the role the outgoing leader will take in the target team.');
                return;
            }
        }

        if (memberAssignments.length > 1 && !currentAssignmentId) {
            setError('Please select which current assignment the member is transferring from.');
            return;
        }

        setError('');
        setIsSubmitting(true);
        try {
            await onSubmit({
                memberId: parseInt(memberId, 10),
                targetAssignmentId: currentAssignmentId ? parseInt(currentAssignmentId, 10) : null,
                changeReason: changeReason.trim() || null,
                notes: notes.trim() || null,
                outgoingDisposition,
                outgoingChangeType,
                outgoingTransferTeamId: outgoingDisposition === 'transfer' ? parseInt(outgoingTransferTeamId, 10) : null,
                outgoingTransferRoleId: outgoingDisposition === 'transfer' ? parseInt(outgoingTransferRoleId, 10) : null,
                outgoingChangeReason: outgoingChangeReason.trim() || null,
                outgoingNotes: outgoingNotes.trim() || null,
            });
            onClose();
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to complete leadership handover'));
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !currentLeadershipAssignee) return null;

    const currentName = currentLeadershipAssignee.member?.fullName || 'Current holder';

    return (
        <div className="modal-backdrop officer-handover-modal" onClick={onClose}>
            <div className="modal-container" onClick={(e: MouseEvent<HTMLDivElement>) => e.stopPropagation()}>
                <div className="modal-header">
                    <div>
                        <h2 className="modal-title">Hand over {roleLabel}</h2>
                        <p className="modal-subtitle">{currentName}</p>
                    </div>
                    <button type="button" className="modal-close-btn" onClick={onClose} aria-label="Close">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {error && <div className="error-message">{error}</div>}

                        <div className="form-section info-section">
                            <h3 className="form-section-title">Current Role Holder</h3>
                            <div className="info-grid">
                                <div className="info-item">
                                    <label className="info-label">Name</label>
                                    <p className="info-value">{currentName}</p>
                                </div>
                                <div className="info-item">
                                    <label className="info-label">Role</label>
                                    <p className="info-value">{currentLeadershipAssignee.role?.roleName || roleLabel}</p>
                                </div>
                                <div className="info-item">
                                    <label className="info-label">Status</label>
                                    <p className="info-value">{currentLeadershipAssignee.isActive !== false ? 'Active' : 'Inactive'}</p>
                                </div>
                                {currentLeadershipAssignee.joinedDate && (
                                    <div className="info-item">
                                        <label className="info-label">Since</label>
                                        <p className="info-value">
                                            {!Number.isNaN(new Date(currentLeadershipAssignee.joinedDate).getTime())
                                                ? new Date(currentLeadershipAssignee.joinedDate).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
                                                : '—'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-section">
                            <h3 className="form-section-title">Select replacement member</h3>
                            <p className="form-hint-text">
                                Choose an existing member to take over {roleLabel}. If the member already has an active assignment, you may need to select which assignment to move.
                            </p>
                            <div className="form-group">
                                <label htmlFor="leadership-team" className="form-label">Filter by team</label>
                                <select
                                    id="leadership-team"
                                    value={teamFilterId}
                                    onChange={(e) => handleTeamFilterChange(e.target.value)}
                                    className="form-input"
                                >
                                    <option value="">All teams</option>
                                    {teams.map((team) => (
                                        <option key={team.id} value={team.id}>{team.name}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="leadership-member" className="form-label">Member *</label>
                                <select
                                    id="leadership-member"
                                    value={memberId}
                                    onChange={(e) => setMemberId(e.target.value)}
                                    className="form-input"
                                    disabled={loadingTeamMembers}
                                >
                                    <option value="">{loadingTeamMembers ? 'Loading...' : 'Select a member'}</option>
                                    {displayMembers.map((member) => (
                                        <option key={member.id} value={member.id}>{member.fullName || member.email || 'Member'}</option>
                                    ))}
                                </select>
                            </div>
                            {memberId && loadingAssignments && <p className="form-hint-text">Loading current assignment...</p>}
                            {memberId && !loadingAssignments && memberAssignments.length > 1 && (
                                <div className="form-group">
                                    <label htmlFor="leadership-assignment" className="form-label">Current assignment *</label>
                                    <select
                                        id="leadership-assignment"
                                        value={currentAssignmentId}
                                        onChange={(e) => setCurrentAssignmentId(e.target.value)}
                                        className="form-input"
                                        disabled={isSubmitting}
                                    >
                                        <option value="">Select which assignment to transfer</option>
                                        {memberAssignments.map((assignment) => (
                                            <option key={assignment.id} value={assignment.id}>
                                                {assignment.team?.name ?? 'Team'} - {assignment.role?.roleName ?? 'Role'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                        </div>

                        <div className="form-section">
                            <h3 className="form-section-title">What should happen to the current leader?</h3>
                            <div className="radio-group-list">
                                <label className={`radio-option-card ${outgoingDisposition === 'leave' ? 'selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="outgoingDisposition"
                                        value="leave"
                                        checked={outgoingDisposition === 'leave'}
                                        onChange={() => setOutgoingDisposition('leave')}
                                        disabled={isSubmitting}
                                    />
                                    <span className="radio-option-title">1. End their club membership</span>
                                    <span className="radio-option-desc">Retire, resign, expel, or graduate the outgoing President/Vice President.</span>
                                </label>
                                <label className={`radio-option-card ${outgoingDisposition === 'transfer' ? 'selected' : ''}`}>
                                    <input
                                        type="radio"
                                        name="outgoingDisposition"
                                        value="transfer"
                                        checked={outgoingDisposition === 'transfer'}
                                        onChange={() => setOutgoingDisposition('transfer')}
                                        disabled={isSubmitting}
                                    />
                                    <span className="radio-option-title">2. Transfer to another team</span>
                                    <span className="radio-option-desc">Move the outgoing leader to another team and role in the same handover.</span>
                                </label>
                            </div>
                        </div>

                        {outgoingDisposition === 'leave' ? (
                            <div className="form-section">
                                <h3 className="form-section-title">Outgoing leader exit type</h3>
                                <div className="form-group">
                                    <label htmlFor="outgoing-changeType" className="form-label">Type *</label>
                                    <select
                                        id="outgoing-changeType"
                                        className="form-input"
                                        value={outgoingChangeType}
                                        onChange={(e) => setOutgoingChangeType(e.target.value as OutgoingChangeType)}
                                        disabled={isSubmitting}
                                    >
                                        {OUTGOING_CHANGE_TYPE_OPTIONS.map((option) => (
                                            <option key={option} value={option}>{option}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div className="form-section">
                                <h3 className="form-section-title">Outgoing leader transfer target</h3>
                                <div className="form-group">
                                    <label htmlFor="outgoing-team" className="form-label">Team *</label>
                                    <select
                                        id="outgoing-team"
                                        className="form-input"
                                        value={outgoingTransferTeamId}
                                        onChange={(e) => {
                                            setOutgoingTransferTeamId(e.target.value);
                                            setOutgoingTransferRoleId('');
                                        }}
                                        disabled={isSubmitting}
                                    >
                                        <option value="">Select a team</option>
                                        {teams.map((team) => (
                                            <option key={team.id} value={team.id}>{team.name}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="form-group">
                                    <label htmlFor="outgoing-role" className="form-label">Role *</label>
                                    <select
                                        id="outgoing-role"
                                        className="form-input"
                                        value={outgoingTransferRoleId}
                                        onChange={(e) => setOutgoingTransferRoleId(e.target.value)}
                                        disabled={isSubmitting || !outgoingTransferTeamId}
                                    >
                                        <option value="">Select a role</option>
                                        {outgoingTransferRoles.map((role) => (
                                            <option key={role.id} value={role.id}>{role.roleName}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        )}

                        <div className="form-section">
                            <h3 className="form-section-title">Change details</h3>
                            <div className="form-group">
                                <label htmlFor="leadership-changeReason" className="form-label">Reason (optional)</label>
                                <input
                                    id="leadership-changeReason"
                                    type="text"
                                    value={changeReason}
                                    onChange={(e) => setChangeReason(e.target.value)}
                                    className="form-input"
                                    placeholder="e.g. Leadership handover"
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="leadership-notes" className="form-label">Notes (optional)</label>
                                <textarea
                                    id="leadership-notes"
                                    value={notes}
                                    onChange={(e) => setNotes(e.target.value)}
                                    className="form-input form-textarea"
                                    placeholder="Additional notes"
                                    rows={2}
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="outgoing-changeReason" className="form-label">Outgoing leader note (optional)</label>
                                <input
                                    id="outgoing-changeReason"
                                    type="text"
                                    value={outgoingChangeReason}
                                    onChange={(e) => setOutgoingChangeReason(e.target.value)}
                                    className="form-input"
                                    placeholder="Optional note for the outgoing leader action"
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="outgoing-notes" className="form-label">Outgoing leader notes (optional)</label>
                                <textarea
                                    id="outgoing-notes"
                                    value={outgoingNotes}
                                    onChange={(e) => setOutgoingNotes(e.target.value)}
                                    className="form-input form-textarea"
                                    placeholder="Additional notes for the outgoing leader"
                                    rows={2}
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>Cancel</button>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? 'Handing over...' : `Hand over ${roleLabel}`}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export default LeadershipHandoverModal;