import { useState, useEffect, useMemo, useRef } from 'react';
import { Eye, Users, ChevronDown } from 'lucide-react';
import { alumniAPI, teamsAPI } from '../../services/api';
import ViewMemberModal from '../Teams/modals/ViewMemberModal';


function FilterDropdown({ options, value, onChange, triggerLabel }) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setIsOpen(false);
        };
        if (isOpen) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    const selected = options.find((o) => String(o.value) === String(value)) || options[0];
    const displayLabel = selected ? selected.label : triggerLabel;

    return (
        <div className="manage-roles-container" ref={dropdownRef}>
            <div className="manage-roles-header">
                <div
                    className="manage-combobox-trigger"
                    onClick={() => setIsOpen(!isOpen)}
                    onKeyDown={(e) => e.key === 'Enter' && setIsOpen(!isOpen)}
                    role="button"
                    tabIndex={0}
                    aria-expanded={isOpen}
                    aria-haspopup="listbox"
                >
                    <span className="manage-combobox-label">{displayLabel}</span>
                    <ChevronDown className={`manage-combobox-chevron ${isOpen ? 'open' : ''}`} size={20} />
                </div>
            </div>
            <div className={`manage-dropdown-menu ${isOpen ? 'open' : ''}`} role="listbox">
                {options.map((opt) => (
                    <div key={opt.value ?? 'all'} className="manage-dropdown-item-wrapper">
                        <button
                            type="button"
                            role="option"
                            aria-selected={String(opt.value) === String(value)}
                            className={`manage-dropdown-item ${String(opt.value) === String(value) ? 'active' : ''}`}
                            onClick={() => {
                                onChange(opt.value);
                                setIsOpen(false);
                            }}
                        >
                            <span className="manage-dropdown-item-label">{opt.label}</span>
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function AlumniPage() {
    const [alumniList, setAlumniList] = useState([]);
    const [teams, setTeams] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterTeamId, setFilterTeamId] = useState('');
    const [showViewModal, setShowViewModal] = useState(false);
    const [viewingMemberId, setViewingMemberId] = useState(null);

    useEffect(() => {
        const loadTeams = async () => {
            try {
                const data = await teamsAPI.getAll(undefined, 'all');
                setTeams(data || []);
            } catch (err) {
                setError(err.message || 'Failed to load teams');
            }
        };
        loadTeams();
    }, []);

    useEffect(() => {
        const loadAlumni = async () => {
            setLoading(true);
            setError(null);
            try {
                const teamId = filterTeamId ? filterTeamId : undefined;
                const data = await alumniAPI.getAll(teamId);
                setAlumniList(Array.isArray(data) ? data : []);
            } catch (err) {
                setError(err.message || 'Failed to load alumni');
                setAlumniList([]);
            } finally {
                setLoading(false);
            }
        };
        loadAlumni();
    }, [filterTeamId]);

    const rows = useMemo(() => {
        return alumniList.map((a) => ({
            id: a.id,
            memberId: a.memberId,
            name: a.member?.fullName || 'Unknown',
            email: a.member?.email || 'N/A',
            teamName: a.team?.name ?? '—',
            role: a.role?.roleName ?? '—',
            subteamName: a.subteam?.name ?? null,
            leaveType: a.leaveType,
            leftDate: a.leftDate,
            avatar: a.member?.profilePhotoUrl || null,
        }));
    }, [alumniList]);

    const formatDate = (d) => {
        if (!d || Number.isNaN(new Date(d).getTime())) return '—';
        return new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
    };

    return (
        <div className="alumni-page members-page">
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">Alumni</h1>
                <div className="page-header-actions">
                    <FilterDropdown
                        triggerLabel="Left from team"
                        options={[{ value: '', label: 'All teams' }, ...teams.map((t) => ({ value: String(t.id), label: t.name }))]}
                        value={filterTeamId}
                        onChange={(v) => setFilterTeamId(v)}
                    />
                </div>
            </div>

            <hr className="title-divider" />

            {error && <div className="error-message">{error}</div>}
            {loading && <div className="loading-message">Loading alumni...</div>}

            <div className="card members-table-card">
                <div className="card-header card-header-with-action">
                    <div className="card-header-left">
                        <h3 className="card-title">Former members</h3>
                        <p className="card-subtitle">{rows.length} alumni</p>
                    </div>
                </div>
                <div className="card-body">
                    {!loading && rows.length === 0 ? (
                        <div className="empty-state">
                            <Users className="empty-state-icon" />
                            <h4 className="empty-state-title">No alumni found</h4>
                            <p className="empty-state-text">
                                {filterTeamId ? 'No one has left this team yet.' : 'No one has left the club yet.'}
                            </p>
                        </div>
                    ) : (
                        <div className="table-container">
                            <table className="members-table">
                                <thead>
                                    <tr>
                                        <th>Member</th>
                                        <th>Left from team</th>
                                        <th>Last role</th>
                                        <th>Last subteam</th>
                                        <th>Email</th>
                                        <th>Leave type</th>
                                        <th>Left date</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((row, index) => (
                                        <tr key={row.id} className={index % 2 === 0 ? 'even-row' : 'odd-row'}>
                                            <td>
                                                <div className="table-member-cell">
                                                    <div className="member-avatar-sm">
                                                        {row.avatar ? (
                                                            <img src={row.avatar} alt={row.name} />
                                                        ) : (
                                                            <div className="avatar-placeholder-sm">
                                                                {(row.name || 'U').split(' ').map((n) => n[0]).join('')}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <span className="member-name-text">{row.name || 'Unknown'}</span>
                                                </div>
                                            </td>
                                            <td>{row.teamName}</td>
                                            <td>{row.role}</td>
                                            <td>{row.subteamName || '—'}</td>
                                            <td className="email-cell">{row.email}</td>
                                            <td>{row.leaveType}</td>
                                            <td>{formatDate(row.leftDate)}</td>
                                            <td>
                                                <div className="action-buttons">
                                                    <button
                                                        type="button"
                                                        className="table-action-btn view-btn"
                                                        onClick={() => {
                                                            setViewingMemberId(row.memberId);
                                                            setShowViewModal(true);
                                                        }}
                                                        title="View Member"
                                                    >
                                                        <Eye />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            <ViewMemberModal
                isOpen={showViewModal}
                onClose={() => { setShowViewModal(false); setViewingMemberId(null); }}
                memberId={viewingMemberId}
            />
        </div>
    );
}

export default AlumniPage;
