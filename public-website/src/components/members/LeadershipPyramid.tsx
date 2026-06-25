import type { PublicMemberDirectory } from "@iclub/shared";
import { PublicMemberCard } from "./PublicMemberCard";

interface LeadershipPyramidProps {
    directory: PublicMemberDirectory;
}

export function LeadershipPyramid({ directory }: LeadershipPyramidProps) {
    const { officer, president, vicePresident, teamLeadership } = directory;
    const hasAdmin = officer || president || vicePresident;
    const hasTeams = teamLeadership.length > 0;

    if (!hasAdmin && !hasTeams) {
        return (
            <div className="member-profile-empty">
                <p className="member-profile-empty-title">Leadership roster coming soon</p>
                <p className="member-profile-empty-sub">
                    Officer and team leadership assignments will appear here once configured.
                </p>
            </div>
        );
    }

    return (
        <div className="members-pyramid">
            {officer ? (
                <>
                    <div className="members-pyramid-tier">
                        <PublicMemberCard member={officer} />
                    </div>
                    {(president || vicePresident || hasTeams) && <div className="members-pyramid-connector" />}
                </>
            ) : null}

            {president || vicePresident ? (
                <>
                    <div className="members-pyramid-tier members-pyramid-tier--duo">
                        {president ? <PublicMemberCard member={president} /> : <div />}
                        {vicePresident ? <PublicMemberCard member={vicePresident} /> : <div />}
                    </div>
                    {hasTeams && <div className="members-pyramid-connector" />}
                </>
            ) : null}

            {teamLeadership.map((row) => (
                <div key={row.teamId} className="members-pyramid-team-row">
                    <p className="members-pyramid-team-label">{row.teamName}</p>
                    <div className="members-pyramid-team-pair">
                        {row.head ? <PublicMemberCard member={row.head} compact /> : <div />}
                        {row.vice ? <PublicMemberCard member={row.vice} compact /> : <div />}
                    </div>
                </div>
            ))}
        </div>
    );
}
