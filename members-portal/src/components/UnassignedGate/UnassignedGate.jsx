import { useAuth } from '../../context/AuthContext';
import { UserX } from 'lucide-react';
import './UnassignedGate.css';

function UnassignedGate({ children }) {
    const { user, logout } = useAuth();

    // Pass-through for privileged users or assigned members
    if (
        user?.isDeveloper ||
        user?.isOfficer ||
        user?.isAdmin ||
        user?.isLeadership ||
        user?.assignmentStatus === 'ASSIGNED'
    ) {
        return children;
    }

    return (
        <div className="gate-container">
            <div className="gate-card">
                <div className="gate-icon-wrapper gate-icon-warning">
                    <UserX size={48} />
                </div>
                <h1 className="gate-title">Not Assigned to a Team</h1>
                <p className="gate-text">
                    You haven't been assigned to a team yet. Please wait for an officer or team leader to assign you.
                </p>
                <p className="gate-text-secondary">
                    You can still access your profile settings from the sidebar.
                </p>
                <button type="button" className="btn btn-secondary gate-sign-out-btn" onClick={logout}>
                    Sign Out
                </button>
            </div>
        </div>
    );
}

export default UnassignedGate;
