'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Calendar, Link as LinkIcon, Mail, Phone, Trophy } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { membersAPI, getProfilePhotoUrl } from '@/services/api';
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

function formatDate(date: string | null | undefined): string {
    if (!date) return '—';
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return '—';
    return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

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
                                            <span className="user-profile-data-value">{formatDate(profile.joinDate)}</span>
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
                                    <div className="user-tab-empty-state">
                                        <Trophy size={40} strokeWidth={1.5} />
                                        <h3 className="user-tab-empty-title">Achievements</h3>
                                        <p className="user-tab-empty-sub">
                                            Milestones, recognitions, and club contributions will appear here. Coming soon.
                                        </p>
                                    </div>
                                </div>
                            )}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
