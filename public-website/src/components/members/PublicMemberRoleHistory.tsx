import type { MemberRoleHistoryTimelineEntry } from "@iclub/shared";
import { Briefcase, MapPin, MessageCircle } from "lucide-react";

function formatDate(date: string | null | undefined): string {
    if (!date) return "—";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "—";
    return parsed.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function getDurationText(duration: number | string | null | undefined): string {
    if (duration === "Ongoing") return "Ongoing";
    if (duration === 0) return "Less than a day";
    if (duration === 1) return "1 day";
    if (typeof duration === "number") return `${duration} days`;
    return "—";
}

interface PublicMemberRoleHistoryProps {
    entries: MemberRoleHistoryTimelineEntry[];
}

export function PublicMemberRoleHistory({ entries }: PublicMemberRoleHistoryProps) {
    if (entries.length === 0) {
        return (
            <div className="member-profile-empty">
                <Briefcase size={40} strokeWidth={1.5} className="text-purple-700" />
                <p className="member-profile-empty-title">No role history yet</p>
                <p className="member-profile-empty-sub">
                    Role changes and team assignments will appear here over time.
                </p>
            </div>
        );
    }

    return (
        <div className="member-timeline">
            {entries.map((entry, index) => (
                <div key={entry.id} className="member-timeline-item">
                    <div className="member-timeline-marker">
                        <div className="member-timeline-dot" />
                        {index < entries.length - 1 && <div className="member-timeline-line" />}
                    </div>
                    <div className="member-timeline-content">
                        <div className="member-timeline-header">
                            <span className="member-timeline-badge">{entry.changeType}</span>
                            <span className="member-timeline-date">{formatDate(entry.period.start)}</span>
                        </div>
                        <div className="member-timeline-role-row">
                            <Briefcase className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-700" />
                            <span className="member-timeline-role-label">Role:</span>
                            <span>{entry.roleName || "N/A"}</span>
                        </div>
                        <div className="member-timeline-role-row">
                            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-700" />
                            <span className="member-timeline-role-label">Team:</span>
                            <span>{entry.teamName || "N/A"}</span>
                        </div>
                        {entry.subteamName ? (
                            <div className="member-timeline-role-row">
                                <Briefcase className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-700" />
                                <span className="member-timeline-role-label">Subteam:</span>
                                <span>{entry.subteamName}</span>
                            </div>
                        ) : null}
                        <p className="member-timeline-period">
                            {entry.period.end
                                ? `${formatDate(entry.period.start)} – ${formatDate(entry.period.end)} (${getDurationText(entry.period.duration)})`
                                : `${formatDate(entry.period.start)} – Present (${getDurationText(entry.period.duration)})`}
                        </p>
                        {entry.changeReason ? (
                            <p className="member-timeline-notes">
                                <MessageCircle className="mr-1 inline h-3.5 w-3.5" />
                                {entry.changeReason}
                            </p>
                        ) : null}
                        {entry.notes ? (
                            <p className="member-timeline-notes">{entry.notes}</p>
                        ) : null}
                    </div>
                </div>
            ))}
        </div>
    );
}
