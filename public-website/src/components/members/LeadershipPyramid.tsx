import type { PublicMemberDirectory } from "@iclub/shared";
import { PublicMemberCard } from "./PublicMemberCard";
import { TeamLeadershipAccord } from "./TeamLeadershipAccord";

interface LeadershipPyramidProps {
    directory: PublicMemberDirectory;
}

export function LeadershipPyramid({ directory }: LeadershipPyramidProps) {
    const { officer, president, vicePresident } = directory;
    const teamLeadership = directory.teamLeadership ?? [];
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
                    <div className="members-pyramid-tier members-pyramid-tier--officer">
                        <PublicMemberCard member={officer} size="xl" />
                    </div>
                    {(president || vicePresident || hasTeams) && <div className="members-pyramid-connector" />}
                </>
            ) : null}

            {president || vicePresident ? (
                <>
                    <div className="members-pyramid-tier members-pyramid-tier--executive">
                        {president ? <PublicMemberCard member={president} size="lg" /> : null}
                        {vicePresident ? <PublicMemberCard member={vicePresident} size="lg" /> : null}
                    </div>
                    {hasTeams && <div className="members-pyramid-connector" />}
                </>
            ) : null}

            {hasTeams ? (
                <div className="members-pyramid-tier members-pyramid-tier--teams">
                    {teamLeadership.map((row) => (
                        <TeamLeadershipAccord
                            key={row.teamId}
                            teamName={row.teamName}
                            head={row.head}
                            vice={row.vice}
                        />
                    ))}
                </div>
            ) : null}
        </div>
    );
}
