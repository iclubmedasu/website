'use client';

import { useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import '../login/LoginPage.css';
import '@/components/form/form.css';
import logo from '@/assets/iclub_full_colored_transparent_logo.png';

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function ForgotPasswordPageClient() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const { forgotPassword } = useAuth();

    const [email, setEmail] = useState(() => searchParams.get('email')?.trim() || '');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const logoSrc = typeof logo === 'string' ? logo : logo.src;

    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError('');

        const trimmed = email.trim();
        if (!trimmed) {
            setError('Please enter your email address.');
            return;
        }
        if (!EMAIL_FORMAT.test(trimmed)) {
            setError('Please enter a valid email address.');
            return;
        }

        setLoading(true);
        const result = await forgotPassword(trimmed);
        setLoading(false);

        if (result.success) {
            setSubmitted(true);
        } else {
            setError(result.error || 'Failed to send reset email');
        }
    };

    return (
        <div className="login-container">
            <div className="login-content-wrapper">
                <div className="login-form-section">
                    <div className="login-card">
                        {submitted ? (
                            <>
                                <h1 className="login-title">Check your email</h1>
                                <p className="login-subtitle">
                                    If an account exists for that email, we&apos;ve sent a link to reset your password.
                                    Check your inbox and spam folder.
                                </p>
                                <div className="toggle-form">
                                    <button type="button" onClick={() => router.push('/login')}>
                                        Back to login
                                    </button>
                                </div>
                            </>
                        ) : (
                            <>
                                <h1 className="login-title">Forgot password</h1>
                                <p className="login-subtitle">
                                    Enter your email and we&apos;ll send you a link to reset your password.
                                </p>

                                {error && <div className="error-message">{error}</div>}

                                <form onSubmit={handleSubmit}>
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input
                                            type="email"
                                            className="form-input"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            placeholder="name@med.asu.edu.eg"
                                            autoFocus
                                            required
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn-primary"
                                        disabled={loading}
                                    >
                                        {loading ? 'Sending...' : 'Send reset link'}
                                    </button>
                                </form>

                                <div className="toggle-form">
                                    <button type="button" onClick={() => router.push('/login')}>
                                        Back to login
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="login-logo-section">
                    <img src={logoSrc} alt="iClub" className="login-logo" />
                </div>
            </div>
        </div>
    );
}

export default ForgotPasswordPageClient;
