import { useState, useEffect } from 'react';
import { X, Calendar, Briefcase, MapPin, MessageCircle } from 'lucide-react';
import { roleHistoryAPI, membersAPI } from '../../../services/api';
import './ViewMemberModal.css';

const ViewMemberModal = ({ isOpen, onClose, memberId }) => {
    const [member, setMember] = useState(null);
    const [roleHistory, setRoleHistory] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && memberId) {
            fetchMemberData();
        }
    }, [isOpen, memberId]);

    const fetchMemberData = async () => {
        try {
            setIsLoading(true);
            setError('');

            // Fetch member details
            const memberData = await membersAPI.getById(memberId);
            setMember(memberData);

            // Fetch role history timeline
            const historyData = await roleHistoryAPI.getMemberTimeline(memberId);
            setRoleHistory(historyData);
        } catch (err) {
            setError('Failed to load member data');
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const getChangeTypeColor = (changeType) => {
        const colors = {
            'New': 'change-type-new',
            'Promotion': 'change-type-promotion',
            'Demotion': 'change-type-demotion',
            'Transfer': 'change-type-transfer',
            'Resignation': 'change-type-resignation',
            'Expelled': 'change-type-expelled',
            'Graduated': 'change-type-graduated'
        };
        return colors[changeType] || 'change-type-default';
    };

    const formatDate = (date) => {
        return new Date(date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const getDurationText = (duration) => {
        if (duration === 'Ongoing') return 'Ongoing';
        if (duration === 0) return 'Less than a day';
        if (duration === 1) return '1 day';
        return `${duration} days`;
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container view-member-modal">
                {/* Header */}
                <div className="modal-header">
                    <h2 className="modal-title">Member Journey</h2>
                    <button className="modal-close-btn" onClick={onClose}>
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
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
                            {/* Member Info Card */}
                            <div className="member-info-card">
                                <div className="member-avatar">
                                    {member.profilePhotoUrl ? (
                                        <img src={member.profilePhotoUrl} alt={member.fullName} />
                                    ) : (
                                        <div className="avatar-placeholder">
                                            {member.fullName.charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>

                                <div className="member-info-details">
                                    <h3 className="member-name">{member.fullName}</h3>
                                    <p className="member-email">{member.email}</p>
                                    <p className="member-phone">{member.phoneNumber}</p>
                                    {member.phoneNumber2 && <p className="member-phone">{member.phoneNumber2}</p>}
                                    <p className="member-student-id">ID: {member.studentId}</p>
                                    <p className="member-join-date">
                                        Joined: {formatDate(member.joinDate)}
                                    </p>
                                </div>
                            </div>

                            {/* Timeline Section */}
                            <div className="timeline-section">
                                <h4 className="timeline-title">Role History</h4>

                                {roleHistory.length > 0 ? (
                                    <div className="vertical-timeline">
                                        {roleHistory.map((entry, index) => (
                                            <div key={entry.id} className="timeline-item">
                                                {/* Timeline Dot and Line */}
                                                <div className="timeline-marker">
                                                    <div className={`timeline-dot ${getChangeTypeColor(entry.changeType)}`} />
                                                    {index < roleHistory.length - 1 && (
                                                        <div className="timeline-line" />
                                                    )}
                                                </div>

                                                {/* Timeline Content */}
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
                                                            <Briefcase size={16} />
                                                            <span className="role-name">{entry.roleName}</span>
                                                        </div>
                                                        <div className="role-item">
                                                            <MapPin size={16} />
                                                            <span className="team-name">{entry.teamName}</span>
                                                        </div>
                                                        {entry.subteamName && (
                                                            <div className="role-item">
                                                                <Briefcase size={16} />
                                                                <span className="subteam-name">Subteam: {entry.subteamName}</span>
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
