import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { teamMembersAPI, teamRolesAPI } from '../../services/api';
import '../Teams/modals/EditMembersModal.css';
import './AssignToTeamModal.css';

const AssignToTeamModal = ({ isOpen, onClose, onSubmit, member, teams, roles: rolesProp }) => {
    const [formData, setFormData] = useState({ teamId: '', roleId: '', changeReason: '' });
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [rolesForTeam, setRolesForTeam] = useState([]);

    const teamIdNum = formData.teamId ? parseInt(formData.teamId, 10) : null;

    useEffect(() => {
        if (isOpen) {
            setFormData({ teamId: '', roleId: '', changeReason: '' });
            setErrors({});
            setRolesForTeam([]);
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen || !teamIdNum) {
            setRolesForTeam([]);
            return;
        }
        let cancelled = false;
        teamRolesAPI.getAll(teamIdNum, true)
            .then((data) => {
                if (!cancelled) setRolesForTeam(Array.isArray(data) ? data : []);
            })
            .catch(() => {
                if (!cancelled) setRolesForTeam([]);
            });
        return () => { cancelled = true; };
    }, [isOpen, teamIdNum]);

    const availableRoles = rolesForTeam;

    useEffect(() => {
        if (formData.teamId && !availableRoles.some((r) => r.id === parseInt(formData.roleId, 10))) {
            setFormData((prev) => ({ ...prev, roleId: '' }));
        }
    }, [formData.teamId, availableRoles, formData.roleId]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData((prev) => ({ ...prev, [name]: value }));
        if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!member?.memberId && !member?.id) return;

        const newErrors = {};
        if (!formData.teamId) newErrors.teamId = 'Team is required';
        if (!formData.roleId) newErrors.roleId = 'Role is required';
        setErrors(newErrors);
        if (Object.keys(newErrors).length > 0) return;

        setIsSubmitting(true);
        try {
            await teamMembersAPI.assign({
                memberId: member.memberId ?? member.id,
                teamId: parseInt(formData.teamId, 10),
                roleId: parseInt(formData.roleId, 10),
                changeReason: formData.changeReason?.trim() || 'Reassigned after team deactivation',
            });
            await onSubmit?.();
            onClose();
        } catch (err) {
            setErrors({
                submit: err?.message || 'Failed to assign member to team',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container assign-to-team-modal">
                <div className="modal-header">
                    <h2 className="modal-title">Assign to team</h2>
                    <button type="button" className="modal-close-btn" onClick={onClose}>
                        <X />
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="modal-body">
                        {member && (
                            <p className="modal-subtitle" style={{ marginBottom: '1rem' }}>
                                {member.fullName || member.name} will be assigned to the selected team.
                            </p>
                        )}
                        {errors.submit && <div className="error-message">{errors.submit}</div>}
                        <div className="form-group">
                            <label htmlFor="assign-teamId" className="form-label">Team *</label>
                            <select
                                id="assign-teamId"
                                name="teamId"
                                className={`form-input ${errors.teamId ? 'error' : ''}`}
                                value={formData.teamId}
                                onChange={handleChange}
                                disabled={isSubmitting}
                            >
                                <option value="">— Select team —</option>
                                {(teams || []).map((t) => (
                                    <option key={t.id} value={String(t.id)}>
                                        {t.name}
                                    </option>
                                ))}
                            </select>
                            {errors.teamId && <span className="field-error">{errors.teamId}</span>}
                        </div>
                        <div className="form-group">
                            <label htmlFor="assign-roleId" className="form-label">Role *</label>
                            <select
                                id="assign-roleId"
                                name="roleId"
                                className={`form-input ${errors.roleId ? 'error' : ''}`}
                                value={formData.roleId}
                                onChange={handleChange}
                                disabled={isSubmitting || !formData.teamId}
                            >
                                <option value="">— Select role —</option>
                                {availableRoles.map((r) => (
                                    <option key={r.id} value={String(r.id)}>
                                        {r.roleName}
                                    </option>
                                ))}
                            </select>
                            {errors.roleId && <span className="field-error">{errors.roleId}</span>}
                        </div>
                        <div className="form-group">
                            <label htmlFor="assign-reason" className="form-label">Reason (optional)</label>
                            <input
                                id="assign-reason"
                                name="changeReason"
                                type="text"
                                className="form-input"
                                value={formData.changeReason}
                                onChange={handleChange}
                                placeholder="e.g. Reassigned after team deactivation"
                                disabled={isSubmitting}
                            />
                        </div>
                    </div>
                    <div className="modal-footer">
                        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
                            {isSubmitting ? 'Assigning...' : 'Assign to team'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    );
};

export default AssignToTeamModal;
