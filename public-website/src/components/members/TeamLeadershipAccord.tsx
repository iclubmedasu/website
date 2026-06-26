import type { PublicMemberCard as PublicMemberCardType } from "@iclub/shared";
import Link from "next/link";
import { getPublicProfilePhotoUrl } from "@/lib/api";

interface TeamLeadershipAccordProps {
    teamName: string;
    head: PublicMemberCardType | null;
    vice: PublicMemberCardType | null;
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

function AccordMemberRow({ member }: { member: PublicMemberCardType }) {
    const photoUrl = member.profilePhotoUrl ? getPublicProfilePhotoUrl(member.id) : null;
    const displayName = member.fullName || "Member";

    return (
        <Link
            href={`/members/${member.id}`}
            className="team-accord-member"
            aria-label={`View ${displayName}'s profile`}
        >
            <div className="team-accord-avatar">
                {photoUrl ? <img src={photoUrl} alt="" /> : getInitials(displayName)}
            </div>
            <div className="team-accord-member-text">
                <p className="team-accord-member-name">{member.fullName}</p>
                <p className="team-accord-member-role">{member.roleLabel}</p>
            </div>
        </Link>
    );
}

export function TeamLeadershipAccord({ teamName, head, vice }: TeamLeadershipAccordProps) {
    return (
        <article className="team-accord">
            <p className="team-accord-label">{teamName}</p>
            <div className="team-accord-members">
                {head ? <AccordMemberRow member={head} /> : null}
                {vice ? <AccordMemberRow member={vice} /> : null}
            </div>
        </article>
    );
}
