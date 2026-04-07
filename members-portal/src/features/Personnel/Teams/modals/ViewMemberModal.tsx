'use client';

import { useEffect, useState } from 'react';
import { X, Calendar, Briefcase, MapPin, MessageCircle } from 'lucide-react';
import { roleHistoryAPI, membersAPI, getProfilePhotoUrl } from '../../../../services/api';
import type { Id } from '../../../../types/backend-contracts';

interface MemberDetails {
    id: Id;
    fullName: string;
    email?: string | null;
    phoneNumber?: string | null;
    phoneNumber2?: string | null;
    studentId?: number | null;
    joinDate?: string | null;
    profilePhotoUrl?: string | null;
}

interface RoleHistoryPeriod {
    start: string;
    end?: string | null;
    duration?: number | 'Ongoing' | null;
}

interface RoleHistoryEntry {
    id: Id;
    changeType: string;
    roleName?: string | null;
    teamName?: string | null;
    subteamName?: string | null;
    changeReason?: string | null;
    notes?: string | null;
    period: RoleHistoryPeriod;
}

interface ViewMemberModalProps {
    isOpen: boolean;
    onClose: () => void;
    memberId?: Id | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }
    return fallback;
}

const ViewMemberModal = ({ isOpen, onClose, memberId }: ViewMemberModalProps) => {
    const [member, setMember] = useState<MemberDetails | null>(null);
    const [roleHistory, setRoleHistory] = useState<RoleHistoryEntry[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && memberId != null) {
            void fetchMemberData();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isOpen, memberId]);

    const fetchMemberData = async () => {
        if (memberId == null) return;

        try {
            setIsLoading(true);
            setError('');

            const memberData = await membersAPI.getById(memberId);
            setMember(memberData as MemberDetails);

            const historyData = await roleHistoryAPI.getMemberTimeline(memberId);
            setRoleHistory(Array.isArray(historyData) ? (historyData as RoleHistoryEntry[]) : []);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load member data'));
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const getChangeTypeColor = (changeType: string): string => {
        const colors: Record<string, string> = {
            New: 'change-type-new',
            Promotion: 'change-type-promotion',
            Demotion: 'change-type-demotion',
            Transfer: 'change-type-transfer',
            Resignation: 'change-type-resignation',
            Expelled: 'change-type-expelled',
            Graduated: 'change-type-graduated',
        };
        return colors[changeType] || 'change-type-default';
    };

    const formatDate = (date: string | null | undefined): string => {
        if (!date) return '—';

        const parsedDate = new Date(date);
        if (Number.isNaN(parsedDate.getTime())) {
            return '—';
        }

        return parsedDate.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
        });
    };

    const getTimelineLineClass = (items: RoleHistoryEntry[]): string => {
        if (!Array.isArray(items) || items.length < 2) return 'timeline-line--ascending';

        const firstStart = new Date(items[0]?.period?.start).getTime();
        const lastStart = new Date(items[items.length - 1]?.period?.start).getTime();

        if (Number.isNaN(firstStart) || Number.isNaN(lastStart)) return 'timeline-line--ascending';
        return firstStart <= lastStart ? 'timeline-line--ascending' : 'timeline-line--descending';
    };

    const getDurationText = (duration: RoleHistoryPeriod['duration']): string => {
        if (duration === 'Ongoing') return 'Ongoing';
        if (duration === 0) return 'Less than a day';
        if (duration === 1) return '1 day';
        if (typeof duration === 'number') return `${duration} days`;
        return '—';
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container view-member-modal">
                <div className="modal-header">
                    <h2 className="modal-title">Member Journey</h2>
                    <button className="modal-close-btn" onClick={onClose} type="button" title="Close" aria-label="Close">
                        <X size={24} />
                    </button>
                </div>

                <div className="modal-content">
                    {isLoading ? (
                        <div className="loading-state">
                            <div className="spinner" />
                            <p>Loading member data...</p>
                        </div>
                    ) : error ? (
                        <div className="error-state">
                            <p className="error-message">{error}</p>
                        </div>
                    ) : member ? (
                        <>
                            <div className="member-info-card">
                                <div className="member-avatar">
                                    {member.profilePhotoUrl ? (
                                        <img src={getProfilePhotoUrl(member.id) ?? undefined} alt={member.fullName} />
                                    ) : (
                                        <div className="avatar-placeholder">
                                            {(member.fullName || 'U').charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>

                                <div className="member-info-details">
                                    <h3 className="member-name">{member.fullName}</h3>
                                    <p className="member-email">{member.email || 'N/A'}</p>
                                    <p className="member-phone">{member.phoneNumber || 'N/A'}</p>
                                    {member.phoneNumber2 && <p className="member-phone">{member.phoneNumber2}</p>}
                                    <p className="member-student-id">ID: {member.studentId ?? 'N/A'}</p>
                                    <p className="member-join-date">
                                        Joined: {formatDate(member.joinDate)}
                                    </p>
                                </div>
                            </div>

                            <div className="timeline-section">
                                <h4 className="timeline-title">Role History</h4>

                                {roleHistory.length > 0 ? (
                                    (() => {
                                        const timelineLineClass = getTimelineLineClass(roleHistory);
                                        return (
                                            <div className="vertical-timeline">
                                                {roleHistory.map((entry, index) => (
                                                    <div key={entry.id} className="timeline-item">
                                                        <div className="timeline-marker">
                                                            <div className={`timeline-dot ${getChangeTypeColor(entry.changeType)}`} />
                                                            {index < roleHistory.length - 1 && (
                                                                <div className={`timeline-line ${timelineLineClass}`} />
                                                            )}
                                                        </div>

                                                        <div className="timeline-content">
                                                            <div className="timeline-header">
                                                                <span className={`change-type-badge ${getChangeTypeColor(entry.changeType)}`}>
                                                                    {entry.changeType}
                                                                </span>
                                                                <span className="timeline-date">
                                                                    {formatDate(entry.period.start)}
                                                                </span>
                                                            </div>

                                                            <div className="role-info">
                                                                <div className="role-item">
                                                                    <Briefcase size={14} />
                                                                    <span className="role-item-label">Role:</span>
                                                                    <span className="role-name">{entry.roleName || 'N/A'}</span>
                                                                </div>
                                                                <div className="role-item">
                                                                    <MapPin size={14} />
                                                                    <span className="role-item-label">Team:</span>
                                                                    <span className="team-name">{entry.teamName || 'N/A'}</span>
                                                                </div>
                                                                {entry.subteamName && (
                                                                    <div className="role-item">
                                                                        <Briefcase size={14} />
                                                                        <span className="role-item-label">Subteam:</span>
                                                                        <span className="subteam-name">{entry.subteamName}</span>
                                                                    </div>
                                                                )}
                                                            </div>

                                                            <div className="duration-info">
                                                                <Calendar size={14} />
                                                                <span className="duration-text">
                                                                    {entry.period.end
                                                                        ? `${formatDate(entry.period.start)} - ${formatDate(entry.period.end)} (${getDurationText(entry.period.duration)})`
                                                                        : `${formatDate(entry.period.start)} - Ongoing`
                                                                    }
                                                                </span>
                                                            </div>

                                                            {entry.changeReason && (
                                                                <div className="reason-info">
                                                                    <MessageCircle size={14} />
                                                                    <span className="reason-text">{entry.changeReason}</span>
                                                                </div>
                                                            )}

                                                            {entry.notes && (
                                                                <div className="notes-info">
                                                                    <p className="notes-label">Notes:</p>
                                                                    <p className="notes-text">{entry.notes}</p>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })()
                                ) : (
                                    <div className="empty-state">
                                        <p>No role history available</p>
                                    </div>
                                )}
                            </div>
                        </>
                    ) : null}
                </div>
            </div>
        </>
    );
};

export default ViewMemberModal;
