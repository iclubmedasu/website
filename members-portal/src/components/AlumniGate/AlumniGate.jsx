import { useAuth } from '../../context/AuthContext';
import { GraduationCap } from 'lucide-react';
import '../UnassignedGate/UnassignedGate.css';

function AlumniGate({ children }) {
    const { isAlumni, logout } = useAuth();

    if (!isAlumni) {
        return children;
    }

    return (
        <div className="gate-container">
            <div className="gate-card">
                <div className="gate-icon-wrapper gate-icon-info">
                    <GraduationCap size={48} />
                </div>
                <h1 className="gate-title">Alumni Account</h1>
                <p className="gate-text">
                    Your account has been moved to alumni status. You no longer have access to the members portal.
                </p>
                <p className="gate-text-secondary">
                    Thank you for your contributions to the club. If you believe this is an error, please contact an officer.
                </p>
                <button type="button" className="btn btn-secondary gate-sign-out-btn" onClick={logout}>
                    Sign Out
                </button>
            </div>
        </div>
    );
}

export default AlumniGate;
