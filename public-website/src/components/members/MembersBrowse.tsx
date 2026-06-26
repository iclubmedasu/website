"use client";

import { useMemo, useState } from "react";
import type { PublicMemberCard as PublicMemberCardType, PublicMemberFilterTeam } from "@iclub/shared";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PublicMemberCard } from "./PublicMemberCard";

const PAGE_SIZE = 10;
const ALL_TEAMS = "all";
const UNASSIGNED = "unassigned";

interface MembersBrowseProps {
    members: PublicMemberCardType[];
    filterTeams: PublicMemberFilterTeam[];
}

export function MembersBrowse({ members, filterTeams }: MembersBrowseProps) {
    const [teamFilter, setTeamFilter] = useState<string>(ALL_TEAMS);
    const [page, setPage] = useState(1);

    const filteredMembers = useMemo(() => {
        if (teamFilter === ALL_TEAMS) return members;
        if (teamFilter === UNASSIGNED) {
            return members.filter((member) => member.teamId == null);
        }
        const teamId = Number(teamFilter);
        return members.filter((member) => member.teamId === teamId);
    }, [members, teamFilter]);

    const totalPages = Math.max(1, Math.ceil(filteredMembers.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);

    const pageMembers = useMemo(() => {
        const start = (currentPage - 1) * PAGE_SIZE;
        return filteredMembers.slice(start, start + PAGE_SIZE);
    }, [filteredMembers, currentPage]);

    const rangeStart = filteredMembers.length === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
    const rangeEnd = Math.min(currentPage * PAGE_SIZE, filteredMembers.length);

    function handleTeamChange(value: string) {
        setTeamFilter(value);
        setPage(1);
    }

    if (members.length === 0) {
        return (
            <div className="member-profile-empty">
                <p className="member-profile-empty-title">No members to display</p>
                <p className="member-profile-empty-sub">Active club members will appear here.</p>
            </div>
        );
    }

    return (
        <div className="members-browse">
            <div className="members-browse-toolbar">
                <label className="members-browse-filter">
                    <span className="members-browse-filter-label">Filter by team</span>
                    <select
                        className="members-browse-select"
                        value={teamFilter}
                        onChange={(event) => handleTeamChange(event.target.value)}
                    >
                        <option value={ALL_TEAMS}>All teams</option>
                        {filterTeams.map((team) => (
                            <option key={team.id} value={String(team.id)}>
                                {team.name}
                            </option>
                        ))}
                        <option value={UNASSIGNED}>Unassigned</option>
                    </select>
                </label>

                {filteredMembers.length > 0 ? (
                    <p className="members-browse-count">
                        Showing {rangeStart}–{rangeEnd} of {filteredMembers.length}
                    </p>
                ) : null}
            </div>

            {filteredMembers.length === 0 ? (
                <div className="member-profile-empty">
                    <p className="member-profile-empty-title">No members in this team</p>
                    <p className="member-profile-empty-sub">Try another team filter to browse members.</p>
                </div>
            ) : (
                <>
                    <div className="members-grid">
                        {pageMembers.map((member) => (
                            <PublicMemberCard key={member.id} member={member} size="compact" />
                        ))}
                    </div>

                    {totalPages > 1 ? (
                        <div className="members-browse-pagination">
                            <button
                                type="button"
                                className="btn-secondary members-browse-page-btn"
                                onClick={() => setPage((value) => Math.max(1, value - 1))}
                                disabled={currentPage <= 1}
                            >
                                <ChevronLeft className="h-4 w-4" />
                                Previous
                            </button>
                            <span className="members-browse-page-indicator">
                                Page {currentPage} of {totalPages}
                            </span>
                            <button
                                type="button"
                                className="btn-secondary members-browse-page-btn"
                                onClick={() => setPage((value) => Math.min(totalPages, value + 1))}
                                disabled={currentPage >= totalPages}
                            >
                                Next
                                <ChevronRight className="h-4 w-4" />
                            </button>
                        </div>
                    ) : null}
                </>
            )}
        </div>
    );
}
