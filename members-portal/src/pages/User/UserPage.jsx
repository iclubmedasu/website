import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
    Users, Shield, Pencil, Link as LinkIcon, Camera,
    Lock, Mail, Phone, Settings2, Bell, Trophy,
    Eye, EyeOff,
} from 'lucide-react';
import { membersAPI, authAPI } from '../../services/api';
import { PhoneInput } from '../../components/PhoneInput/PhoneInput';
import UploadPhotoModal from '../../components/UploadPhotoModal/UploadPhotoModal';

import './UserPage.css';

// ── Tab definitions ──────────────────────────────────────
const TABS = [
    { key: 'personal', label: 'Personal Details' },
    { key: 'security', label: 'Sign-in & Security' },
    // { key: 'settings', label: 'Profile Settings' },
    { key: 'notifications', label: 'Notifications' },
    { key: 'achievements', label: 'Achievements' },
];

function UserPage() {
    const { user, refreshUser } = useAuth();

    // ── Tab state ──
    const [activeTab, setActiveTab] = useState('personal');

    // ── Personal Details edit state ──
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        fullName: '',
        phoneNumber: '',
        phoneNumber2: '',
        linkedInUrl: '',
        email2: '',
        email3: '',
    });

    // ── Photo modal state ──
    const [photoModalOpen, setPhotoModalOpen] = useState(false);

    // ── Change password state ──
    const [pwdForm, setPwdForm] = useState({ current: '', newPwd: '', confirm: '' });
    const [pwdSaving, setPwdSaving] = useState(false);
    const [pwdError, setPwdError] = useState('');
    const [pwdSuccess, setPwdSuccess] = useState('');
    const [showCurrentPwd, setShowCurrentPwd] = useState(false);
    const [showNewPwd, setShowNewPwd] = useState(false);
    const [showConfirmPwd, setShowConfirmPwd] = useState(false);

    if (!user) return null;

    const isDeveloper = user.isDeveloper === true;
    const isOfficer = user.isOfficer === true;
    const isAdmin = user.isAdmin === true;
    const inAdministration = isOfficer || isAdmin;
    const teamIds = user.teamIds || [];
    const canEdit = !isDeveloper && user.id != null && user.id !== 0;

    // ── Personal Details helpers ──
    const startEditing = () => {
        setFormData({
            fullName: user.fullName || '',
            phoneNumber: user.phoneNumber || '',
            phoneNumber2: user.phoneNumber2 || '',
            linkedInUrl: user.linkedInUrl || '',
            email2: user.email2 || '',
            email3: user.email3 || '',
        });
        setError('');
        setEditing(true);
    };

    const cancelEditing = () => { setEditing(false); setError(''); };

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (error) setError('');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSaving(true);
        try {
            await membersAPI.update(user.id, {
                fullName: formData.fullName.trim(),
                phoneNumber: formData.phoneNumber.trim(),
                phoneNumber2: formData.phoneNumber2.trim() || null,
                linkedInUrl: formData.linkedInUrl.trim() || null,
                email2: formData.email2.trim() || null,
                email3: formData.email3.trim() || null,
            });
            await refreshUser();
            setEditing(false);
        } catch (err) {
            setError(err?.message || 'Failed to update profile');
        } finally {
            setSaving(false);
        }
    };

    // ── Change password handler ──
    const handleChangePassword = async (e) => {
        e.preventDefault();
        setPwdError('');
        setPwdSuccess('');
        setPwdSaving(true);
        try {
            await authAPI.changePassword(pwdForm.current, pwdForm.newPwd, pwdForm.confirm);
            setPwdSuccess('Password updated successfully.');
            setPwdForm({ current: '', newPwd: '', confirm: '' });
        } catch (err) {
            setPwdError(err?.message || 'Failed to change password.');
        } finally {
            setPwdSaving(false);
        }
    };

    // ── Photo upload success handler ──
    const handlePhotoSuccess = async () => {
        await refreshUser();
        setPhotoModalOpen(false);
    };

    // ── Format date ──
    const formatDate = (d) => {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    // ── Render ──
    return (
        <div className="user-page members-page">
            <div className="user-page-card">
                {/* ── HEADER BAND ── */}
                <div className="user-page-header">
                    <div className="user-page-header-inner">
                        <div className="user-page-avatar-wrap">
                            <div className="user-page-avatar">
                                {user.profilePhotoUrl ? (
                                    <img src={user.profilePhotoUrl} alt="" />
                                ) : (
                                    (user.fullName || user.email || 'U').charAt(0).toUpperCase()
                                )}
                            </div>
                            {canEdit && (
                                <button
                                    type="button"
                                    className="user-page-avatar-edit-btn"
                                    onClick={() => setPhotoModalOpen(true)}
                                    aria-label="Change profile photo"
                                    title="Change profile photo"
                                >
                                    <Camera size={14} />
                                </button>
                            )}
                        </div>
                        <div className="user-page-identity">
                            <h1 className="user-page-name">{user.fullName || user.email}</h1>
                            {(isDeveloper || inAdministration) && (
                                <div className="user-page-badges">
                                    {isDeveloper && (
                                        <span className="user-badge user-badge-developer">Developer</span>
                                    )}
                                    {inAdministration && !isDeveloper && (
                                        <span className="user-badge user-badge-admin">
                                            <Shield size={14} aria-hidden />
                                            Administration
                                        </span>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── TAB BAR ── */}
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

                {/* ── TAB CONTENT ── */}
                <div className="user-page-tab-panel">

                    {/* ═══ PERSONAL DETAILS ═══ */}
                    {activeTab === 'personal' && (
                        <>
                            {!editing ? (
                                <div className="user-page-section-card">
                                    {canEdit && (
                                        <div className="user-page-section-card-actions">
                                            <button type="button" className="user-profile-edit-btn" onClick={startEditing} aria-label="Edit profile" title="Edit profile">
                                                <Pencil size={16} aria-hidden />
                                            </button>
                                        </div>
                                    )}

                                    <div className="user-profile-data-grid">
                                        <div className="user-profile-data-item">
                                            <span className="user-profile-data-label">Full Name</span>
                                            <span className="user-profile-data-value">{user.fullName || '—'}</span>
                                        </div>
                                        <div className="user-profile-data-item">
                                            <span className="user-profile-data-label">Student ID</span>
                                            <span className="user-profile-data-value">{user.studentId != null ? String(user.studentId) : 'Officer'}</span>
                                        </div>
                                        <div className="user-profile-data-item">
                                            <span className="user-profile-data-label">Primary Email</span>
                                            <span className="user-profile-data-value">
                                                <span className="user-profile-email-badge-inline">Official</span>
                                                {user.email || '—'}
                                            </span>
                                        </div>
                                        {user.email2 && (
                                            <div className="user-profile-data-item">
                                                <span className="user-profile-data-label">Email 2</span>
                                                <span className="user-profile-data-value">{user.email2}</span>
                                            </div>
                                        )}
                                        {user.email3 && (
                                            <div className="user-profile-data-item">
                                                <span className="user-profile-data-label">Email 3</span>
                                                <span className="user-profile-data-value">{user.email3}</span>
                                            </div>
                                        )}
                                        <div className="user-profile-data-item">
                                            <span className="user-profile-data-label">Phone</span>
                                            <span className="user-profile-data-value">{user.phoneNumber || '—'}</span>
                                        </div>
                                        {user.phoneNumber2 && (
                                            <div className="user-profile-data-item">
                                                <span className="user-profile-data-label">Phone 2</span>
                                                <span className="user-profile-data-value">{user.phoneNumber2}</span>
                                            </div>
                                        )}
                                        <div className="user-profile-data-item">
                                            <span className="user-profile-data-label">LinkedIn</span>
                                            <span className="user-profile-data-value">
                                                {user.linkedInUrl ? (
                                                    <a href={user.linkedInUrl} target="_blank" rel="noopener noreferrer" className="user-profile-data-link">
                                                        <LinkIcon size={14} aria-hidden />
                                                        View profile
                                                    </a>
                                                ) : '—'}
                                            </span>
                                        </div>
                                        <div className="user-profile-data-item">
                                            <span className="user-profile-data-label">Join Date</span>
                                            <span className="user-profile-data-value">{formatDate(user.joinDate || user.createdAt)}</span>
                                        </div>
                                    </div>

                                    {/* Team access section */}
                                    <div className="user-profile-team-access">
                                        <h3 className="user-profile-team-access-title">
                                            <Users size={18} aria-hidden />
                                            Team Access
                                        </h3>
                                        {teamIds.length === 0 && !isDeveloper ? (
                                            <p className="user-profile-text">You are not assigned to any team yet.</p>
                                        ) : isDeveloper ? (
                                            <p className="user-profile-text">You have access to all teams.</p>
                                        ) : inAdministration ? (
                                            <p className="user-profile-text">As an administration member, you can view and manage all teams.</p>
                                        ) : (
                                            <p className="user-profile-text">
                                                On the <strong>Teams</strong> page you only see your team(s). On <strong>Members</strong>, <strong>Administration</strong>, and <strong>Alumni</strong> you can view all teams.
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <div className="user-page-section-card">
                                    <form onSubmit={handleSubmit} className="user-profile-form">
                                        {error && <div className="error-message">{error}</div>}

                                        <div className="form-group">
                                            <label htmlFor="user-fullName" className="form-label">Full Name <span className="required-star">*</span></label>
                                            <input type="text" id="user-fullName" name="fullName" className="form-input" value={formData.fullName} onChange={handleChange} required placeholder="Your full name" minLength={2} disabled={saving} />
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="user-studentId" className="form-label">Student ID</label>
                                            <input type="text" id="user-studentId" className="form-input form-input-readonly" value={user.studentId != null ? String(user.studentId) : ''} disabled readOnly />
                                            <span className="form-hint-inline">Cannot be changed.</span>
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="user-officialEmail" className="form-label">Official Email</label>
                                            <input type="text" id="user-officialEmail" className="form-input form-input-readonly" value={user.email ?? ''} disabled readOnly />
                                            <span className="form-hint-inline">Cannot be changed.</span>
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="user-email2" className="form-label">Additional Email 2</label>
                                            <input type="email" id="user-email2" name="email2" className="form-input" value={formData.email2} onChange={handleChange} placeholder="Optional" disabled={saving} />
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="user-email3" className="form-label">Additional Email 3</label>
                                            <input type="email" id="user-email3" name="email3" className="form-input" value={formData.email3} onChange={handleChange} placeholder="Optional" disabled={saving} />
                                        </div>

                                        <div className="form-group">
                                            <PhoneInput id="user-phoneNumber" label="Phone Number" value={formData.phoneNumber} onChange={(v) => setFormData((prev) => ({ ...prev, phoneNumber: v }))} placeholder="Phone number" required disabled={saving} />
                                        </div>

                                        <div className="form-group">
                                            <PhoneInput id="user-phoneNumber2" label="Phone Number 2 (optional)" value={formData.phoneNumber2} onChange={(v) => setFormData((prev) => ({ ...prev, phoneNumber2: v }))} placeholder="Optional second number" disabled={saving} />
                                        </div>

                                        <div className="form-group">
                                            <label htmlFor="user-linkedInUrl" className="form-label">LinkedIn URL</label>
                                            <input type="url" id="user-linkedInUrl" name="linkedInUrl" className="form-input" value={formData.linkedInUrl} onChange={handleChange} placeholder="https://linkedin.com/in/..." disabled={saving} />
                                        </div>

                                        <div className="user-profile-form-actions">
                                            <button type="button" className="btn btn-secondary" onClick={cancelEditing} disabled={saving}>Cancel</button>
                                            <button type="submit" className="btn btn-primary" disabled={saving}>{saving ? 'Saving...' : 'Save changes'}</button>
                                        </div>
                                    </form>
                                </div>
                            )}
                        </>
                    )}

                    {/* ═══ SIGN-IN & SECURITY ═══ */}
                    {activeTab === 'security' && (
                        <>
                            {/* Change Password */}
                            <div className="user-page-section-card">
                                <h3 className="user-security-section-title">
                                    <Lock size={18} aria-hidden />
                                    Change Password
                                </h3>

                                {pwdSuccess && <div className="success-message">{pwdSuccess}</div>}
                                {pwdError && <div className="error-message">{pwdError}</div>}

                                <form onSubmit={handleChangePassword} className="user-profile-form">
                                    <div className="form-group">
                                        <label htmlFor="pwd-current" className="form-label">Current Password <span className="required-star">*</span></label>
                                        <div className="password-input-wrap">
                                            <input
                                                type={showCurrentPwd ? 'text' : 'password'}
                                                id="pwd-current"
                                                className="form-input"
                                                value={pwdForm.current}
                                                onChange={(e) => setPwdForm((p) => ({ ...p, current: e.target.value }))}
                                                required
                                                disabled={pwdSaving}
                                            />
                                            <button type="button" className="password-toggle-btn" onClick={() => setShowCurrentPwd(!showCurrentPwd)} aria-label={showCurrentPwd ? 'Hide password' : 'Show password'}>
                                                {showCurrentPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="pwd-new" className="form-label">New Password <span className="required-star">*</span></label>
                                        <div className="password-input-wrap">
                                            <input
                                                type={showNewPwd ? 'text' : 'password'}
                                                id="pwd-new"
                                                className="form-input"
                                                value={pwdForm.newPwd}
                                                onChange={(e) => setPwdForm((p) => ({ ...p, newPwd: e.target.value }))}
                                                required
                                                minLength={8}
                                                disabled={pwdSaving}
                                            />
                                            <button type="button" className="password-toggle-btn" onClick={() => setShowNewPwd(!showNewPwd)} aria-label={showNewPwd ? 'Hide password' : 'Show password'}>
                                                {showNewPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        <span className="form-hint-inline">At least 8 characters, one uppercase, one lowercase, one number, one symbol.</span>
                                    </div>

                                    <div className="form-group">
                                        <label htmlFor="pwd-confirm" className="form-label">Confirm New Password <span className="required-star">*</span></label>
                                        <div className="password-input-wrap">
                                            <input
                                                type={showConfirmPwd ? 'text' : 'password'}
                                                id="pwd-confirm"
                                                className="form-input"
                                                value={pwdForm.confirm}
                                                onChange={(e) => setPwdForm((p) => ({ ...p, confirm: e.target.value }))}
                                                required
                                                disabled={pwdSaving}
                                            />
                                            <button type="button" className="password-toggle-btn" onClick={() => setShowConfirmPwd(!showConfirmPwd)} aria-label={showConfirmPwd ? 'Hide password' : 'Show password'}>
                                                {showConfirmPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                    </div>

                                    <div className="user-profile-form-actions">
                                        <button type="submit" className="btn btn-primary" disabled={pwdSaving}>
                                            {pwdSaving ? 'Changing...' : 'Change Password'}
                                        </button>
                                    </div>
                                </form>
                            </div>

                            {/* Sign-in methods */}
                            <div className="user-page-section-card">
                                <h3 className="user-security-section-title">
                                    <Mail size={18} aria-hidden />
                                    Sign-in Methods
                                </h3>
                                <div className="user-signin-methods">
                                    <div className="user-signin-method-row">
                                        <Mail size={16} className="user-signin-method-icon" />
                                        <div className="user-signin-method-info">
                                            <span className="user-signin-method-label">Primary email</span>
                                            <span className="user-signin-method-value">{user.email || '—'}</span>
                                        </div>
                                        <span className="user-signin-method-badge">Active</span>
                                    </div>
                                    {user.email2 && (
                                        <div className="user-signin-method-row">
                                            <Mail size={16} className="user-signin-method-icon" />
                                            <div className="user-signin-method-info">
                                                <span className="user-signin-method-label">Email 2</span>
                                                <span className="user-signin-method-value">{user.email2}</span>
                                            </div>
                                            <span className="user-signin-method-badge">Active</span>
                                        </div>
                                    )}
                                    {user.email3 && (
                                        <div className="user-signin-method-row">
                                            <Mail size={16} className="user-signin-method-icon" />
                                            <div className="user-signin-method-info">
                                                <span className="user-signin-method-label">Email 3</span>
                                                <span className="user-signin-method-value">{user.email3}</span>
                                            </div>
                                            <span className="user-signin-method-badge">Active</span>
                                        </div>
                                    )}
                                    {user.phoneNumber && (
                                        <div className="user-signin-method-row">
                                            <Phone size={16} className="user-signin-method-icon" />
                                            <div className="user-signin-method-info">
                                                <span className="user-signin-method-label">Phone number</span>
                                                <span className="user-signin-method-value">{user.phoneNumber}</span>
                                            </div>
                                            <span className="user-signin-method-badge">Active</span>
                                        </div>
                                    )}
                                    {user.phoneNumber2 && (
                                        <div className="user-signin-method-row">
                                            <Phone size={16} className="user-signin-method-icon" />
                                            <div className="user-signin-method-info">
                                                <span className="user-signin-method-label">Phone 2</span>
                                                <span className="user-signin-method-value">{user.phoneNumber2}</span>
                                            </div>
                                            <span className="user-signin-method-badge">Active</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </>
                    )}

                    {/* ═══ PROFILE SETTINGS (stub) ═══ */}
                    {activeTab === 'settings' && (
                        <div className="user-page-section-card">
                            <div className="user-tab-empty-state">
                                <Settings2 size={40} strokeWidth={1.5} />
                                <h3 className="user-tab-empty-title">Profile Settings</h3>
                                <p className="user-tab-empty-sub">Customize how your profile appears to other members. More options coming soon.</p>
                            </div>
                        </div>
                    )}

                    {/* ═══ NOTIFICATIONS (stub) ═══ */}
                    {activeTab === 'notifications' && (
                        <div className="user-page-section-card">
                            <div className="user-tab-empty-state">
                                <Bell size={40} strokeWidth={1.5} />
                                <h3 className="user-tab-empty-title">Notifications & Announcements</h3>
                                <p className="user-tab-empty-sub">You'll see club announcements and activity notifications here. This feature is coming soon.</p>
                            </div>
                        </div>
                    )}

                    {/* ═══ ACHIEVEMENTS (stub) ═══ */}
                    {activeTab === 'achievements' && (
                        <div className="user-page-section-card">
                            <div className="user-tab-empty-state">
                                <Trophy size={40} strokeWidth={1.5} />
                                <h3 className="user-tab-empty-title">Achievements</h3>
                                <p className="user-tab-empty-sub">Your milestones, recognitions, and club contributions will appear here. Coming soon.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>{/* end .user-page-card */}

            {/* ── Photo Upload Modal ── */}
            <UploadPhotoModal
                isOpen={photoModalOpen}
                onClose={() => setPhotoModalOpen(false)}
                memberId={user.id}
                currentPhotoUrl={user.profilePhotoUrl}
                onSuccess={handlePhotoSuccess}
            />
        </div>
    );
}

export default UserPage;
