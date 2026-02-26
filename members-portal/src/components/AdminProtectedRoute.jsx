import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function AdminProtectedRoute({ children }) {
    const { user } = useAuth();

    if (!user) {
        return <Navigate to="/login" replace />;
    }

    if (!user.isDeveloper && !user.isOfficer && !user.isAdmin && !user.isLeadership) {
        return <Navigate to="/teams" replace />;
    }

    return children;
}

export default AdminProtectedRoute;
