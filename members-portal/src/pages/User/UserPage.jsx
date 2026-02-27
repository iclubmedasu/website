import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Users, Shield, Pencil, Link as LinkIcon } from 'lucide-react';
import { membersAPI } from '../../services/api';
import { PhoneInput } from '../../components/PhoneInput/PhoneInput';

import './UserPage.css';

function UserPage() {
    const { user, refreshUser } = useAuth();
    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        fullName: '',
        phoneNumber: '',
        phoneNumber2: '',
        profilePhotoUrl: '',
        linkedInUrl: '',
        email2: '',
        email3: '',
    });

    if (!user) {
        return null;
    }

    const isDeveloper = user.isDeveloper === true;
    const isOfficer = user.isOfficer === true;
    const isAdmin = user.isAdmin === true;
    const inAdministration = isOfficer || isAdmin;
    const teamIds = user.teamIds || [];
    const canEdit = !isDeveloper && user.id != null && user.id !== 0;

    const startEditing = () => {
        setFormData({
            fullName: user.fullName || '',
            phoneNumber: user.phoneNumber || '',
            phoneNumber2: user.phoneNumber2 || '',
            profilePhotoUrl: user.profilePhotoUrl || '',
            linkedInUrl: user.linkedInUrl || '',
            email2: user.email2 || '',
            email3: user.email3 || '',
        });
        setError('');
        setEditing(true);
    };

    const cancelEditing = () => {
        setEditing(false);
        setError('');
    };

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
                profilePhotoUrl: formData.profilePhotoUrl.trim() || null,
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

    return (
        <div className="user-page members-page">
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">My Profile</h1>
            </div>

            <hr className="title-divider" />

            <div className="card user-profile-card">
                <div className="card-body user-profile-card-body">
                    {canEdit && !editing && (
                        <div className="user-profile-actions">
                            <button type="button" className="user-profile-edit-btn" onClick={startEditing} aria-label="Edit profile" title="Edit profile">
                                <Pencil size={16} aria-hidden />
                            </button>
                        </div>
                    )}
                    {!editing ? (
                        <>
                            <div className="user-profile-header">
                                <div className="user-profile-avatar">
                                    {user.profilePhotoUrl ? (
                                        <img src={user.profilePhotoUrl} alt="" />
                                    ) : (
                                        (user.fullName || user.email || 'U').charAt(0).toUpperCase()
                                    )}
                                </div>
                                <div className="user-profile-info">
                                    <h2 className="user-profile-name">{user.fullName || user.email}</h2>
                                    {(isDeveloper || inAdministration) && (
                                        <div className="user-profile-badges">
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

                            {/* 1. Personal data */}
                            <h3 className="user-profile-data-section-title">1. Personal data</h3>
                            <dl className="user-profile-data">
                                <div className="user-profile-data-row">
                                    <dt className="user-profile-data-label">Full name</dt>
                                    <dd className="user-profile-data-value">{user.fullName || '—'}</dd>
                                </div>
                                <div className="user-profile-data-row">
                                    <dt className="user-profile-data-label">Student ID</dt>
                                    <dd className="user-profile-data-value">{user.studentId != null ? String(user.studentId) : '—'}</dd>
                                </div>
                            </dl>

                            {/* 2. Contact info */}
                            <h3 className="user-profile-data-section-title">2. Contact info</h3>
                            <dl className="user-profile-data">
                                <div className="user-profile-data-row">
                                    <dt className="user-profile-data-label">Official email</dt>
                                    <dd className="user-profile-data-value">
                                        <span className="user-profile-email-badge-inline">Official</span>
                                        {user.email || '—'}
                                    </dd>
                                </div>
                                <div className="user-profile-data-row">
                                    <dt className="user-profile-data-label">Additional email 2</dt>
                                    <dd className="user-profile-data-value">{user.email2 || '—'}</dd>
                                </div>
                                <div className="user-profile-data-row">
                                    <dt className="user-profile-data-label">Additional email 3</dt>
                                    <dd className="user-profile-data-value">{user.email3 || '—'}</dd>
                                </div>
                                <div className="user-profile-data-row">
                                    <dt className="user-profile-data-label">Phone Number</dt>
                                    <dd className="user-profile-data-value">{user.phoneNumber || '—'}</dd>
                                </div>
                                <div className="user-profile-data-row">
                                    <dt className="user-profile-data-label">Phone Number 2</dt>
                                    <dd className="user-profile-data-value">{user.phoneNumber2 || '—'}</dd>
                                </div>
                            </dl>

                            {/* 3. Social */}
                            <h3 className="user-profile-data-section-title">3. Social</h3>
                            <dl className="user-profile-data">
                                <div className="user-profile-data-row">
                                    <dt className="user-profile-data-label">Profile photo</dt>
                                    <dd className="user-profile-data-value">
                                        {user.profilePhotoUrl ? (
                                            <a href={user.profilePhotoUrl} target="_blank" rel="noopener noreferrer" className="user-profile-data-link" title={user.profilePhotoUrl}>
                                                <LinkIcon size={14} aria-hidden />
                                                View link
                                            </a>
                                        ) : '—'}
                                    </dd>
                                </div>
                                <div className="user-profile-data-row">
                                    <dt className="user-profile-data-label">LinkedIn</dt>
                                    <dd className="user-profile-data-value">
                                        {user.linkedInUrl ? (
                                            <a href={user.linkedInUrl} target="_blank" rel="noopener noreferrer" className="user-profile-data-link" title={user.linkedInUrl}>
                                                <LinkIcon size={14} aria-hidden />
                                                View link
                                            </a>
                                        ) : '—'}
                                    </dd>
                                </div>
                            </dl>

                            <div className="user-profile-section">
                                <h3 className="user-profile-section-title">
                                    <Users size={18} aria-hidden />
                                    Team access
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
                        </>
                    ) : (
                        <form onSubmit={handleSubmit} className="user-profile-form">
                            {error && <div className="error-message">{error}</div>}

                            <h3 className="user-profile-form-section-title">1. Personal data</h3>
                            <div className="form-group">
                                <label htmlFor="user-fullName" className="form-label">Full Name *</label>
                                <input
                                    type="text"
                                    id="user-fullName"
                                    name="fullName"
                                    className="form-input"
                                    value={formData.fullName}
                                    onChange={handleChange}
                                    required
                                    placeholder="Your full name"
                                    minLength={2}
                                    disabled={saving}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="user-studentId" className="form-label">Student ID</label>
                                <input
                                    type="text"
                                    id="user-studentId"
                                    className="form-input form-input-readonly"
                                    value={user.studentId != null ? String(user.studentId) : ''}
                                    disabled
                                    readOnly
                                    aria-readonly="true"
                                />
                                <span className="form-hint-inline">Student ID cannot be changed.</span>
                            </div>

                            <h3 className="user-profile-form-section-title">2. Contact info</h3>
                            <div className="form-group">
                                <label htmlFor="user-officialEmail" className="form-label">Official email</label>
                                <input
                                    type="text"
                                    id="user-officialEmail"
                                    className="form-input form-input-readonly"
                                    value={user.email ?? ''}
                                    disabled
                                    readOnly
                                />
                                <span className="form-hint-inline">Official email (Student ID@med.asu.edu.eg) cannot be changed.</span>
                            </div>
                            <div className="form-group">
                                <label htmlFor="user-email2" className="form-label">Additional email 2</label>
                                <input
                                    type="email"
                                    id="user-email2"
                                    name="email2"
                                    className="form-input"
                                    value={formData.email2}
                                    onChange={handleChange}
                                    placeholder="Optional"
                                    disabled={saving}
                                />
                                <span className="form-hint-inline">Optional. Must be unique if set.</span>
                            </div>
                            <div className="form-group">
                                <label htmlFor="user-email3" className="form-label">Additional email 3</label>
                                <input
                                    type="email"
                                    id="user-email3"
                                    name="email3"
                                    className="form-input"
                                    value={formData.email3}
                                    onChange={handleChange}
                                    placeholder="Optional"
                                    disabled={saving}
                                />
                                <span className="form-hint-inline">Optional. Must be unique if set.</span>
                            </div>
                            <div className="form-group">
                                <PhoneInput
                                    id="user-phoneNumber"
                                    label="Phone Number"
                                    value={formData.phoneNumber}
                                    onChange={(v) => setFormData((prev) => ({ ...prev, phoneNumber: v }))}
                                    placeholder="Phone number"
                                    required
                                    disabled={saving}
                                />
                                <span className="form-hint-inline">Select country and enter number. Must be unique.</span>
                            </div>
                            <div className="form-group">
                                <PhoneInput
                                    id="user-phoneNumber2"
                                    label="Phone Number 2 (optional)"
                                    value={formData.phoneNumber2}
                                    onChange={(v) => setFormData((prev) => ({ ...prev, phoneNumber2: v }))}
                                    placeholder="Optional second number"
                                    disabled={saving}
                                />
                            </div>

                            <h3 className="user-profile-form-section-title">3. Social</h3>
                            <div className="form-group">
                                <label htmlFor="user-profilePhotoUrl" className="form-label">Profile Photo URL</label>
                                <input
                                    type="url"
                                    id="user-profilePhotoUrl"
                                    name="profilePhotoUrl"
                                    className="form-input"
                                    value={formData.profilePhotoUrl}
                                    onChange={handleChange}
                                    placeholder="https://..."
                                    disabled={saving}
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="user-linkedInUrl" className="form-label">LinkedIn URL</label>
                                <input
                                    type="url"
                                    id="user-linkedInUrl"
                                    name="linkedInUrl"
                                    className="form-input"
                                    value={formData.linkedInUrl}
                                    onChange={handleChange}
                                    placeholder="https://linkedin.com/in/..."
                                    disabled={saving}
                                />
                            </div>

                            <div className="user-profile-form-actions">
                                <button type="button" className="btn btn-secondary" onClick={cancelEditing} disabled={saving}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={saving}>
                                    {saving ? 'Saving...' : 'Save changes'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            </div>
        </div>
    );
}

export default UserPage;
