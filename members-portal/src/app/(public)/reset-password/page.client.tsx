'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import '../login/LoginPage.css';
import '@/components/form/form.css';
import logo from '@/assets/iclub_full_colored_transparent_logo.png';

// Password: at least 8 chars, one upper, one lower, one number, one symbol
function validatePassword(pwd: string): string | null {
    if (!pwd || pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter';
    if (!/\d/.test(pwd)) return 'Password must contain at least one number';
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) {
        return 'Password must contain at least one symbol (e.g. !@#$%^&*)';
    }
    return null;
}

const PASSWORD_REQUIREMENTS_HINT =
    'Use at least one uppercase letter, one lowercase letter, one number, and one symbol (e.g. !@#$%^&*). Do not include your email.';

function ResetPasswordPageClient() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { resetPassword } = useAuth();

    const token = searchParams.get('token')?.trim() || '';
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState(() =>
        token ? '' : 'This reset link is missing or invalid. Request a new one from the login page.',
    );
    const [loading, setLoading] = useState(false);

    const logoSrc = typeof logo === 'string' ? logo : logo.src;

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');

        if (!token) {
            setError('This reset link is missing or invalid. Request a new one from the login page.');
            return;
        }

        const pwdErr = validatePassword(password);
        if (pwdErr) {
            setError(pwdErr);
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setLoading(true);
        const result = await resetPassword(token, password, confirmPassword);
        setLoading(false);

        if (result.success) {
            router.replace('/login');
        } else {
            setError(result.error || 'Failed to reset password');
        }
    };

    return (
        <div className="login-container">
            <div className="login-content-wrapper">
                <div className="login-form-section">
                    <div className="login-card">
                        <h1 className="login-title">Reset password</h1>
                        <p className="login-subtitle">Choose a new secure password for your account.</p>

                        {error && <div className="error-message">{error}</div>}

                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label className="form-label">
                                    New Password<span className="required-star"> *</span>
                                </label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                    placeholder="At least 8 characters"
                                    minLength={8}
                                    autoFocus
                                    disabled={!token}
                                />
                                <p className="password-requirements">
                                    {PASSWORD_REQUIREMENTS_HINT}
                                </p>
                            </div>

                            <div className="form-group">
                                <label className="form-label">
                                    Confirm Password<span className="required-star"> *</span>
                                </label>
                                <input
                                    type="password"
                                    className="form-input"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required
                                    placeholder="Re-enter your password"
                                    minLength={8}
                                    disabled={!token}
                                />
                            </div>

                            <button
                                type="submit"
                                className="btn-primary"
                                disabled={loading || !token}
                            >
                                {loading ? 'Saving...' : 'Reset password'}
                            </button>
                        </form>

                        <div className="toggle-form">
                            <button type="button" onClick={() => router.push('/login')}>
                                Back to login
                            </button>
                            {!token && (
                                <button
                                    type="button"
                                    className="toggle-form-button-offset"
                                    onClick={() => router.push('/forgot-password')}
                                >
                                    Request a new link
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                <div className="login-logo-section">
                    <img src={logoSrc} alt="iClub" className="login-logo" />
                </div>
            </div>
        </div>
    );
}

export default ResetPasswordPageClient;
