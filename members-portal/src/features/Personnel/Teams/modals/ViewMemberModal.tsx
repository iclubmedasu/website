'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { membersAPI, getProfilePhotoUrl } from '../../../../services/api';
import { MemberRoleHistory } from '@/components/MemberRoleHistory/MemberRoleHistory';
import type { MemberPublicProfile } from '@iclub/shared';
import type { Id } from '../../../../types/backend-contracts';

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

function formatDate(date: string | null | undefined): string {
    if (!date) return '—';
    const parsedDate = new Date(date);
    if (Number.isNaN(parsedDate.getTime())) return '—';
    return parsedDate.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    });
}

const ViewMemberModal = ({ isOpen, onClose, memberId }: ViewMemberModalProps) => {
    const router = useRouter();
    const [profile, setProfile] = useState<MemberPublicProfile | null>(null);
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
            const data = await membersAPI.getProfile(memberId);
            setProfile(data as MemberPublicProfile);
        } catch (err: unknown) {
            setError(getErrorMessage(err, 'Failed to load member data'));
            console.error(err);
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewFullProfile = () => {
        if (memberId == null) return;
        onClose();
        router.push(`/members/${memberId}`);
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
                    ) : profile ? (
                        <>
                            <div className="member-info-card">
                                <div className="member-avatar">
                                    {profile.profilePhotoUrl ? (
                                        <img src={getProfilePhotoUrl(profile.id) ?? undefined} alt={profile.fullName} />
                                    ) : (
                                        <div className="avatar-placeholder">
                                            {(profile.fullName || 'U').charAt(0).toUpperCase()}
                                        </div>
                                    )}
                                </div>

                                <div className="member-info-details">
                                    <h3 className="member-name">{profile.fullName}</h3>
                                    <p className="member-email">{profile.email || 'N/A'}</p>
                                    <p className="member-join-date">
                                        Joined: {formatDate(profile.joinDate)}
                                    </p>
                                </div>
                            </div>

                            <div className="timeline-section">
                                <h4 className="timeline-title">Role History</h4>
                                <MemberRoleHistory
                                    entries={profile.roleHistory || []}
                                    emptyTitle="No role history available"
                                    emptySubtitle=""
                                />
                            </div>
                        </>
                    ) : null}
                </div>

                {profile && memberId != null && (
                    <div className="modal-footer">
                        <button type="button" className="btn btn-primary" onClick={handleViewFullProfile}>
                            View full profile
                        </button>
                    </div>
                )}
            </div>
        </>
    );
};

export default ViewMemberModal;
