import type { PublicMemberCard as PublicMemberCardType } from "@iclub/shared";
import { PublicMemberCard } from "./PublicMemberCard";

interface MembersGridProps {
    members: PublicMemberCardType[];
    emptyTitle?: string;
    emptyDescription?: string;
}

export function MembersGrid({
    members,
    emptyTitle = "No members to display",
    emptyDescription = "Active club members will appear here.",
}: MembersGridProps) {
    if (members.length === 0) {
        return (
            <div className="member-profile-empty">
                <p className="member-profile-empty-title">{emptyTitle}</p>
                <p className="member-profile-empty-sub">{emptyDescription}</p>
            </div>
        );
    }

    return (
        <div className="members-grid">
            {members.map((member) => (
                <PublicMemberCard key={member.id} member={member} compact />
            ))}
        </div>
    );
}
