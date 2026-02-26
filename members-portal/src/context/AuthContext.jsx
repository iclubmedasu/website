import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

    useEffect(() => {
        checkAuth();
    }, []);

    const checkAuth = async () => {
        const token = localStorage.getItem('token');
        if (token) {
            try {
                const response = await fetch(`${API_URL}/auth/me`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                if (response.ok) {
                    const data = await response.json();
                    setUser(data.user);
                } else {
                    localStorage.removeItem('token');
                }
            } catch (error) {
                console.error('Auth check failed:', error);
                localStorage.removeItem('token');
            }
        }
        setLoading(false);
    };

    const refreshUser = async () => {
        const token = localStorage.getItem('token');
        if (!token) return;
        try {
            const response = await fetch(`${API_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
            }
        } catch (error) {
            console.error('Refresh user failed:', error);
        }
    };

    const checkEmail = async (email) => {
        try {
            const response = await fetch(`${API_URL}/auth/check-email`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email })
            });

            const data = await response.json();
            return { success: true, data };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const checkStudentId = async (studentId) => {
        try {
            const response = await fetch(`${API_URL}/auth/check-student-id`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ studentId: String(studentId).trim() })
            });
            const data = await response.json();
            if (!response.ok) {
                return { success: false, data: { canSetup: false }, error: data.error || 'Failed to check Student ID' };
            }
            return { success: true, data };
        } catch (error) {
            return { success: false, data: { canSetup: false }, error: error.message };
        }
    };

    const completeProfile = async (studentId, fullName, phoneNumber, phoneNumber2, password, email2, email3) => {
        try {
            const response = await fetch(`${API_URL}/auth/complete-profile`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    studentId: String(studentId).trim(),
                    fullName: fullName.trim(),
                    phoneNumber: phoneNumber.trim(),
                    phoneNumber2: phoneNumber2?.trim() || undefined,
                    password,
                    email2: email2?.trim() || undefined,
                    email3: email3?.trim() || undefined
                })
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to complete profile');
            }
            localStorage.setItem('token', data.token);
            setUser(data.user);
            await refreshUser();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const updateInvitedProfile = async (email, fullName, phoneNumber, phoneNumber2, email2, email3) => {
        try {
            const response = await fetch(`${API_URL}/auth/update-invited-profile`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    email: email.trim(),
                    fullName: fullName.trim(),
                    phoneNumber: phoneNumber.trim(),
                    phoneNumber2: phoneNumber2?.trim() || undefined,
                    email2: email2?.trim() || undefined,
                    email3: email3?.trim() || undefined
                })
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'Failed to update profile');
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const setupPassword = async (email, password) => {
        try {
            const response = await fetch(`${API_URL}/auth/setup-password`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Setup failed');
            }

            localStorage.setItem('token', data.token);
            setUser(data.user);
            await refreshUser();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const login = async (email, password) => {
        try {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Login failed');
            }

            localStorage.setItem('token', data.token);
            setUser(data.user);
            await refreshUser();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, login, setupPassword, updateInvitedProfile, checkEmail, checkStudentId, completeProfile, logout, refreshUser, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within AuthProvider');
    }
    return context;
};