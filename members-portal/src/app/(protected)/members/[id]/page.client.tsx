'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Link as LinkIcon, Mail, Phone, RefreshCw, Trophy } from 'lucide-react';
import { formatDate } from '@iclub/shared/utils';
import { useAuth } from '@/context/AuthContext';
import { membersAPI, getProfilePhotoUrl } from '@/services/api';
import { certificatesAPI, type CertificateListItem } from '@/services/certificatesAPI';
import { MemberAchievements } from '@/components/MemberAchievements/MemberAchievements';
import { MemberRoleHistory } from '@/components/MemberRoleHistory/MemberRoleHistory';
import { normalizePhoneDisplay } from '@/utils/countryCodes';
import type { MemberPublicProfile } from '@iclub/shared';
import '@/app/(protected)/user/UserPage.css';
import '@/components/modal/modal.css';

type ProfileTab = 'personal' | 'history' | 'achievements';

const TABS: { key: ProfileTab; label: string }[] = [
    { key: 'personal', label: 'Personal Details' },
    { key: 'history', label: 'History' },
    { key: 'achievements', label: 'Achievements' },
];


function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
}

export default function MemberProfilePage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const memberId = Number(params.id);

    const [profile, setProfile] = useState<MemberPublicProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [activeTab, setActiveTab] = useState<ProfileTab>('personal');

    const [achievements, setAchievements] = useState<CertificateListItem[]>([]);
    const [achievementsLoading, setAchievementsLoading] = useState(false);
    const [achievementsError, setAchievementsError] = useState('');
    const [achievementsFetched, setAchievementsFetched] = useState(false);

    const fetchAchievements = async () => {
        if (Number.isNaN(memberId)) return;
        setAchievementsLoading(true);
        setAchievementsError('');
        try {
            const data = await certificatesAPI.getAll({
                recipientMemberId: memberId,
                status: 'ISSUED',
            });
            setAchievements(Array.isArray(data) ? data : []);
            setAchievementsFetched(true);
        } catch {
            setAchievementsError('Failed to load certificates.');
        } finally {
            setAchievementsLoading(false);
        }
    };

    useEffect(() => {
        if (!user?.id || Number.isNaN(memberId)) return;
        if (user.id === memberId) {
            router.replace('/user');
            return;
        }

        let cancelled = false;
        const load = async () => {
            setLoading(true);
            setError('');
            try {
                const data = await membersAPI.getProfile(memberId);
                if (!cancelled) {
                    setProfile(data as MemberPublicProfile);
                    setAchievements([]);
                    setAchievementsFetched(false);
                    setAchievementsError('');
                }
            } catch (err: unknown) {
                if (!cancelled) {
                    setError(getErrorMessage(err, 'Failed to load member profile'));
                }
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        void load();
        return () => {
            cancelled = true;
        };
    }, [memberId, router, user?.id]);

    useEffect(() => {
        if (activeTab === 'achievements' && !achievementsFetched && profile && !Number.isNaN(memberId)) {
            void fetchAchievements();
        }
    }, [activeTab, achievementsFetched, profile, memberId]);

    if (!user || Number.isNaN(memberId)) return null;

    return (
        <div className="user-page members-page">
            <Link href="/members" className="member-profile-back-link">
                <ArrowLeft size={16} aria-hidden />
                Back to members
            </Link>

            {loading ? (
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading profile…</p>
                </div>
            ) : error ? (
                <div className="error-state">
                    <p className="error-message">{error}</p>
                </div>
            ) : profile ? (
                <div className="user-page-card">
                    <div className="user-page-header">
                        <div className="user-page-header-inner">
                            <div className="user-page-avatar-wrap">
                                <div className="user-page-avatar">
                                    {profile.profilePhotoUrl ? (
                                        <img src={getProfilePhotoUrl(profile.id) ?? undefined} alt="" />
                                    ) : (
                                        (profile.fullName || 'U').charAt(0).toUpperCase()
                                    )}
                                </div>
                            </div>
                            <div className="user-page-identity">
                                <h1 className="user-page-name">{profile.fullName}</h1>
                            </div>
                        </div>
                    </div>

                    <div className="user-page-tabs">
                        {TABS.map((tab) => (
                            <button
                                key={tab.key}
                                type="button"
                                className={`user-page-tab-btn${activeTab === tab.key ? ' active' : ''}`}
                                onClick={() => setActiveTab(tab.key)}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="user-page-tab-panel">
                            {activeTab === 'personal' && (
                                <div className="user-page-section-card">
                                    <div className="user-profile-data-grid">
                                        <div className="user-profile-data-item">
                                            <span className="user-profile-data-label">Full Name</span>
                                            <span className="user-profile-data-value">{profile.fullName}</span>
                                        </div>
                                        <div className="user-profile-data-item">
                                            <span className="user-profile-data-label">Official Email</span>
                                            <span className="user-profile-data-value">
                                                <Mail size={14} aria-hidden style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                {profile.email}
                                            </span>
                                        </div>
                                        {profile.email2 && (
                                            <div className="user-profile-data-item">
                                                <span className="user-profile-data-label">Email 2</span>
                                                <span className="user-profile-data-value">{profile.email2}</span>
                                            </div>
                                        )}
                                        {profile.email3 && (
                                            <div className="user-profile-data-item">
                                                <span className="user-profile-data-label">Email 3</span>
                                                <span className="user-profile-data-value">{profile.email3}</span>
                                            </div>
                                        )}
                                        {profile.phoneNumber && (
                                            <div className="user-profile-data-item">
                                                <span className="user-profile-data-label">Phone</span>
                                                <span className="user-profile-data-value">
                                                    <Phone size={14} aria-hidden style={{ marginRight: 6, verticalAlign: 'middle' }} />
                                                    {normalizePhoneDisplay(profile.phoneNumber)}
                                                </span>
                                            </div>
                                        )}
                                        {profile.phoneNumber2 && (
                                            <div className="user-profile-data-item">
                                                <span className="user-profile-data-label">Phone 2</span>
                                                <span className="user-profile-data-value">
                                                    {normalizePhoneDisplay(profile.phoneNumber2)}
                                                </span>
                                            </div>
                                        )}
                                        {profile.studentId != null && (
                                            <div className="user-profile-data-item">
                                                <span className="user-profile-data-label">Student ID</span>
                                                <span className="user-profile-data-value">{profile.studentId}</span>
                                            </div>
                                        )}
                                        <div className="user-profile-data-item">
                                            <span className="user-profile-data-label">LinkedIn</span>
                                            <span className="user-profile-data-value">
                                                {profile.linkedInUrl ? (
                                                    <a
                                                        href={profile.linkedInUrl}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="user-profile-data-link"
                                                    >
                                                        <LinkIcon size={14} aria-hidden />
                                                        View profile
                                                    </a>
                                                ) : (
                                                    '—'
                                                )}
                                            </span>
                                        </div>
                                        <div className="user-profile-data-item">
                                            <span className="user-profile-data-label">Join Date</span>
                                            <span className="user-profile-data-value">{profile.joinDate ? formatDate(profile.joinDate) : '—'}</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'history' && (
                                <div className="user-page-section-card">
                                    <h3 className="user-history-section-title">
                                        <Calendar size={18} aria-hidden />
                                        Role History
                                    </h3>
                                    <MemberRoleHistory entries={profile.roleHistory || []} />
                                </div>
                            )}

                            {activeTab === 'achievements' && (
                                <div className="user-page-section-card">
                                    <h3 className="user-history-section-title">
                                        <Trophy size={18} aria-hidden />
                                        Certificates
                                    </h3>

                                    {achievementsLoading ? (
                                        <div className="loading-state">
                                            <div className="spinner" />
                                            <p>Loading certificates…</p>
                                        </div>
                                    ) : achievementsError ? (
                                        <div className="user-history-error">
                                            <p className="error-message">{achievementsError}</p>
                                            <button type="button" className="btn btn-secondary" onClick={fetchAchievements}>
                                                <RefreshCw size={14} aria-hidden />
                                                Retry
                                            </button>
                                        </div>
                                    ) : (
                                        <MemberAchievements
                                            certificates={achievements}
                                            emptyTitle="No Certificates Yet"
                                            emptySubtitle="Issued certificates and recognitions will appear here."
                                        />
                                    )}
                                </div>
                            )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
