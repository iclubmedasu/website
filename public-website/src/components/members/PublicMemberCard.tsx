import type { PublicMemberCard as PublicMemberCardType } from "@iclub/shared";
import Link from "next/link";
import { getPublicProfilePhotoUrl } from "@/lib/api";

interface PublicMemberCardProps {
    member: PublicMemberCardType;
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

export function PublicMemberCard({ member, compact = false }: PublicMemberCardProps) {
    const photoUrl = member.profilePhotoUrl ? getPublicProfilePhotoUrl(member.id) : null;

    return (
        <Link
            href={`/members/${member.id}`}
            className={`member-card${compact ? " member-card--compact" : ""}`}
        >
            <div className="member-card-avatar">
                {photoUrl ? (
                    <img src={photoUrl} alt="" />
                ) : (
                    getInitials(member.fullName || "U")
                )}
            </div>
            <div>
                <p className="member-card-name">{member.fullName}</p>
                <p className="member-card-role">{member.roleLabel}</p>
            </div>
        </Link>
    );
}
