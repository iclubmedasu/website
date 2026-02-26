import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PhoneInput } from '../components/PhoneInput/PhoneInput';
import './LoginPage.css';
import '../components/form/form.css';
import logo from '../assets/iclub_full_colored_transparent_logo.png';

// Password: at least 8 chars, one upper, one lower, one number, one symbol
function validatePassword(pwd) {
    if (!pwd || pwd.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Z]/.test(pwd)) return 'Password must contain at least one uppercase letter';
    if (!/[a-z]/.test(pwd)) return 'Password must contain at least one lowercase letter';
    if (!/\d/.test(pwd)) return 'Password must contain at least one number';
    if (!/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd)) return 'Password must contain at least one symbol (e.g. !@#$%^&*)';
    return null;
}

const EMAIL_FORMAT = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isValidEmailFormat(value) {
    return !value || (typeof value === 'string' && EMAIL_FORMAT.test(value.trim()));
}

function LoginPage() {
    const [step, setStep] = useState('email'); // 'email' | 'login' | 'setup' | 'setupProfile' | 'studentId' | 'completeProfileDetails' | 'completeProfilePassword'
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [memberName, setMemberName] = useState('');
    const [setupFullName, setSetupFullName] = useState('');
    const [setupPhone, setSetupPhone] = useState('');
    const [setupPhone2, setSetupPhone2] = useState('');
    const [setupEmail2, setSetupEmail2] = useState('');
    const [setupEmail3, setSetupEmail3] = useState('');
    const [studentId, setStudentId] = useState('');
    const [profileFullName, setProfileFullName] = useState('');
    const [profilePhone, setProfilePhone] = useState('');
    const [profilePhone2, setProfilePhone2] = useState('');
    const [profileEmail2, setProfileEmail2] = useState('');
    const [profileEmail3, setProfileEmail3] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const { login, setupPassword, updateInvitedProfile, checkEmail, checkStudentId, completeProfile } = useAuth();
    const navigate = useNavigate();

    const handleEmailSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await checkEmail(email);

        if (result.success) {
            if (!result.data.exists) {
                setError(result.data.message || 'Email or Student ID not found. Please contact your administrator.');
            } else {
                if (result.data.email) {
                    setEmail(result.data.email);
                }
                if (result.data.needsSetup) {
                    setMemberName(result.data.fullName || '');
                    setSetupFullName(result.data.fullName || '');
                    setSetupPhone(result.data.phoneNumber || '');
                    setSetupPhone2(result.data.phoneNumber2 || '');
                    setSetupEmail2(result.data.email2 || '');
                    setSetupEmail3(result.data.email3 || '');
                    setStep('setupProfile');
                } else {
                    setStep('login');
                }
            }
        } else {
            setError(result.error || 'Failed to check email');
        }

        setLoading(false);
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(email, password);

        if (result.success) {
            navigate('/teams');
        } else {
            setError(result.error);
        }

        setLoading(false);
    };

    const handleSetupProfileSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!setupFullName.trim()) {
            setError('Full name is required');
            return;
        }
        if (!setupPhone.trim()) {
            setError('Phone number is required');
            return;
        }
        if (!isValidEmailFormat(setupEmail2)) {
            setError('Additional email 2 must be a valid email (e.g. name@domain.com)');
            return;
        }
        if (!isValidEmailFormat(setupEmail3)) {
            setError('Additional email 3 must be a valid email (e.g. name@domain.com)');
            return;
        }
        setLoading(true);
        const result = await updateInvitedProfile(email, setupFullName, setupPhone, setupPhone2, setupEmail2, setupEmail3);
        setLoading(false);
        if (result.success) {
            setStep('setup');
        } else {
            setError(result.error);
        }
    };

    const handleSetupPassword = async (e) => {
        e.preventDefault();
        setError('');
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
        const result = await setupPassword(email, password);
        if (result.success) {
            navigate('/teams');
        } else {
            setError(result.error);
        }
        setLoading(false);
    };

    const resetToEmail = () => {
        setStep('email');
        setPassword('');
        setConfirmPassword('');
        setSetupFullName('');
        setSetupPhone('');
        setSetupPhone2('');
        setSetupEmail2('');
        setSetupEmail3('');
        setError('');
    };

    const handleStudentIdSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        const result = await checkStudentId(studentId);
        setLoading(false);
        if (result.success && result.data.canSetup) {
            setStep('completeProfileDetails');
        } else {
            setError(result.error || result.data?.message || 'Cannot set up with this Student ID. Use "Enter your email" if you already have an account.');
        }
    };

    const handleCompleteProfileDetailsContinue = (e) => {
        e.preventDefault();
        setError('');
        if (!profileFullName.trim()) {
            setError('Full name is required');
            return;
        }
        if (!profilePhone.trim()) {
            setError('Phone number is required');
            return;
        }
        if (!isValidEmailFormat(profileEmail2)) {
            setError('Additional email 2 must be a valid email (e.g. name@domain.com)');
            return;
        }
        if (!isValidEmailFormat(profileEmail3)) {
            setError('Additional email 3 must be a valid email (e.g. name@domain.com)');
            return;
        }
        setStep('completeProfilePassword');
    };

    const handleCompleteProfileSubmit = async (e) => {
        e.preventDefault();
        setError('');
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
        const result = await completeProfile(studentId, profileFullName, profilePhone, profilePhone2, password, profileEmail2, profileEmail3);
        setLoading(false);
        if (result.success) {
            navigate('/teams');
        } else {
            setError(result.error);
        }
    };

    const resetToEmailFromStudentFlow = () => {
        setStep('email');
        setStudentId('');
        setProfileFullName('');
        setProfilePhone('');
        setProfilePhone2('');
        setProfileEmail2('');
        setProfileEmail3('');
        setPassword('');
        setConfirmPassword('');
        setError('');
    };

    return (
        <div className="login-container">
            <div className="login-content-wrapper">
                <div className="login-form-section">
                    <div className="login-card">
                        {step === 'email' && (
                            <>
                                <h1 className="login-title">Welcome</h1>
                                <p className="login-subtitle">Enter your email or Student ID to continue</p>

                                {error && <div className="error-message">{error}</div>}

                                <form onSubmit={handleEmailSubmit}>
                                    <div className="form-group">
                                        <label className="form-label">Email or Student ID</label>
                                        <input
                                            type="text"
                                            inputMode="text"
                                            className="form-input"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                            placeholder="e.g. 213256 or 213256@med.asu.edu.eg"
                                            autoFocus
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn-primary"
                                        disabled={loading}
                                    >
                                        {loading ? 'Checking...' : 'Continue'}
                                    </button>
                                </form>

                                <div className="login-divider">or</div>
                                <div className="toggle-form">
                                    <button type="button" onClick={() => { setStep('studentId'); setError(''); }}>
                                        First time here? Set up with your Student ID
                                    </button>
                                </div>
                            </>
                        )}

                        {step === 'studentId' && (
                            <>
                                <h1 className="login-title">First time here?</h1>
                                <p className="login-subtitle">Enter your Student ID to complete your profile and create your account</p>

                                {error && <div className="error-message">{error}</div>}

                                <form onSubmit={handleStudentIdSubmit}>
                                    <div className="form-group">
                                        <label className="form-label">Student ID</label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            className="form-input"
                                            value={studentId}
                                            onChange={(e) => setStudentId(e.target.value.replace(/\D/g, ''))}
                                            required
                                            placeholder="e.g., 12345"
                                            autoFocus
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn-primary"
                                        disabled={loading}
                                    >
                                        {loading ? 'Checking...' : 'Continue'}
                                    </button>
                                </form>

                                <div className="toggle-form">
                                    <button type="button" onClick={resetToEmailFromStudentFlow}>
                                        Back to email
                                    </button>
                                </div>
                            </>
                        )}

                        {step === 'completeProfileDetails' && (
                            <>
                                <h1 className="login-title">Complete your profile</h1>
                                <p className="login-subtitle">Enter your name and phone first</p>

                                {error && <div className="error-message">{error}</div>}

                                <form onSubmit={handleCompleteProfileDetailsContinue}>
                                    <div className="form-group">
                                        <label className="form-label">Student ID</label>
                                        <input type="text" className="form-input" value={studentId} disabled />
                                    </div>
                                    <p className="login-subtitle" style={{ marginBottom: '0.5rem', fontSize: '0.8rem' }}>
                                        Official email will be {studentId}@med.asu.edu.eg (cannot be changed).
                                    </p>
                                    <div className="form-group">
                                        <label className="form-label">Full Name *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={profileFullName}
                                            onChange={(e) => setProfileFullName(e.target.value)}
                                            required
                                            placeholder="Your full name"
                                            minLength={2}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <PhoneInput
                                            label="Phone Number *"
                                            value={profilePhone}
                                            onChange={setProfilePhone}
                                            placeholder="Phone number"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <PhoneInput
                                            label="Phone 2 (optional)"
                                            value={profilePhone2}
                                            onChange={setProfilePhone2}
                                            placeholder="Optional second number"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Additional email 2 (optional)</label>
                                        <input
                                            type="email"
                                            className="form-input"
                                            value={profileEmail2}
                                            onChange={(e) => setProfileEmail2(e.target.value)}
                                            placeholder="e.g. name@domain.com"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Additional email 3 (optional)</label>
                                        <input
                                            type="email"
                                            className="form-input"
                                            value={profileEmail3}
                                            onChange={(e) => setProfileEmail3(e.target.value)}
                                            placeholder="e.g. name@domain.com"
                                        />
                                    </div>
                                    <button type="submit" className="btn-primary">
                                        Continue
                                    </button>
                                </form>

                                <div className="toggle-form">
                                    <button type="button" onClick={() => { setStep('studentId'); setError(''); }}>
                                        Back to Student ID
                                    </button>
                                </div>
                            </>
                        )}

                        {step === 'completeProfilePassword' && (
                            <>
                                <h1 className="login-title">Set your password</h1>
                                <p className="login-subtitle">Almost there! Choose a secure password.</p>

                                {error && <div className="error-message">{error}</div>}

                                <form onSubmit={handleCompleteProfileSubmit}>
                                    <div className="form-group">
                                        <label className="form-label">Password *</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            placeholder="At least 8 characters"
                                            minLength={8}
                                            autoFocus
                                        />
                                        <p className="password-requirements">
                                            Use at least one uppercase letter, one lowercase letter, one number, and one symbol (e.g. !@#$%^&*).
                                        </p>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Confirm Password *</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            placeholder="Re-enter your password"
                                            minLength={8}
                                        />
                                    </div>
                                    <button type="submit" className="btn-primary" disabled={loading}>
                                        {loading ? 'Creating account...' : 'Create account'}
                                    </button>
                                </form>

                                <div className="toggle-form">
                                    <button type="button" onClick={() => { setStep('completeProfileDetails'); setError(''); }}>
                                        Back to profile details
                                    </button>
                                </div>
                            </>
                        )}

                        {step === 'login' && (
                            <>
                                <h1 className="login-title">Welcome Back</h1>
                                <p className="login-subtitle">Sign in to your account</p>

                                {error && <div className="error-message">{error}</div>}

                                <form onSubmit={handleLogin}>
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input
                                            type="email"
                                            className="form-input"
                                            value={email}
                                            disabled
                                        />
                                    </div>

                                    <div className="form-group">
                                        <label className="form-label">Password</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            placeholder="••••••••"
                                            autoFocus
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        className="btn-primary"
                                        disabled={loading}
                                    >
                                        {loading ? 'Signing in...' : 'Sign In'}
                                    </button>
                                </form>

                                <div className="toggle-form">
                                    <button type="button" onClick={resetToEmail}>
                                        Use different email
                                    </button>
                                </div>
                            </>
                        )}

                        {step === 'setupProfile' && (
                            <>
                                <h1 className="login-title">Complete your profile</h1>
                                <p className="login-subtitle">Enter your name and phone, then you’ll set your password.</p>

                                {error && <div className="error-message">{error}</div>}

                                <form onSubmit={handleSetupProfileSubmit}>
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input type="email" className="form-input" value={email} disabled />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Full Name *</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            value={setupFullName}
                                            onChange={(e) => setSetupFullName(e.target.value)}
                                            required
                                            placeholder="Your full name"
                                            minLength={2}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <PhoneInput
                                            label="Phone Number *"
                                            value={setupPhone}
                                            onChange={setSetupPhone}
                                            placeholder="Phone number"
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <PhoneInput
                                            label="Phone 2 (optional)"
                                            value={setupPhone2}
                                            onChange={setSetupPhone2}
                                            placeholder="Optional second number"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Additional email 2 (optional)</label>
                                        <input
                                            type="email"
                                            className="form-input"
                                            value={setupEmail2}
                                            onChange={(e) => setSetupEmail2(e.target.value)}
                                            placeholder="e.g. name@domain.com"
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Additional email 3 (optional)</label>
                                        <input
                                            type="email"
                                            className="form-input"
                                            value={setupEmail3}
                                            onChange={(e) => setSetupEmail3(e.target.value)}
                                            placeholder="e.g. name@domain.com"
                                        />
                                    </div>
                                    <button type="submit" className="btn-primary" disabled={loading}>
                                        {loading ? 'Saving...' : 'Continue'}
                                    </button>
                                </form>

                                <div className="toggle-form">
                                    <button type="button" onClick={resetToEmail}>
                                        Use different email
                                    </button>
                                </div>
                            </>
                        )}

                        {step === 'setup' && (
                            <>
                                <h1 className="login-title">Set your password</h1>
                                <p className="login-subtitle">Welcome, {setupFullName || memberName}!</p>

                                {error && <div className="error-message">{error}</div>}

                                <form onSubmit={handleSetupPassword}>
                                    <div className="form-group">
                                        <label className="form-label">Email</label>
                                        <input type="email" className="form-input" value={email} disabled />
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Password *</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                            placeholder="At least 8 characters"
                                            minLength={8}
                                            autoFocus
                                        />
                                        <p className="password-requirements">
                                            Use at least one uppercase letter, one lowercase letter, one number, and one symbol (e.g. !@#$%^&*).
                                        </p>
                                    </div>
                                    <div className="form-group">
                                        <label className="form-label">Confirm Password *</label>
                                        <input
                                            type="password"
                                            className="form-input"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                            placeholder="Re-enter your password"
                                            minLength={8}
                                        />
                                    </div>
                                    <button type="submit" className="btn-primary" disabled={loading}>
                                        {loading ? 'Setting up...' : 'Setup Password'}
                                    </button>
                                </form>

                                <div className="toggle-form">
                                    <button type="button" onClick={() => { setStep('setupProfile'); setError(''); }}>
                                        Back to profile
                                    </button>
                                    <button type="button" onClick={resetToEmail} style={{ marginLeft: 8 }}>
                                        Use different email
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>

                <div className="login-logo-section">
                    <img src={logo} alt="iClub" className="login-logo" />
                </div>
            </div>
        </div>
    );
}

export default LoginPage;