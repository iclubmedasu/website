import type { PublicMemberCard as PublicMemberCardType } from "@iclub/shared";
import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { getPublicProfilePhotoUrl } from "@/lib/api";

type MemberCardSize = "xl" | "lg" | "md" | "compact";

interface PublicMemberCardProps {
    member: PublicMemberCardType;
    size?: MemberCardSize;
    /** @deprecated use size="compact" */
    compact?: boolean;
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}

export function PublicMemberCard({ member, size, compact = false }: PublicMemberCardProps) {
    const resolvedSize: MemberCardSize = size ?? (compact ? "compact" : "md");
    const photoUrl = member.profilePhotoUrl ? getPublicProfilePhotoUrl(member.id) : null;
    const displayName = member.fullName || "Member";
    const showHint = resolvedSize === "xl" || resolvedSize === "lg";

    return (
        <Link
            href={`/members/${member.id}`}
            className={`member-card member-card--${resolvedSize}`}
            aria-label={`View ${displayName}'s profile and role history`}
        >
            <div className="member-card-avatar">
                {photoUrl ? (
                    <img src={photoUrl} alt="" />
                ) : (
                    getInitials(displayName)
                )}
            </div>
            <div>
                <p className="member-card-name">{member.fullName}</p>
                <p className="member-card-role">{member.roleLabel}</p>
            </div>
            {showHint ? (
                <span className="member-card-hint" aria-hidden="true">
                    View profile &amp; history
                    <ChevronRight className="member-card-hint-icon" />
                </span>
            ) : null}
        </Link>
    );
}
