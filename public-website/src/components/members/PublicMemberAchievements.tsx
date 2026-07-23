import { Briefcase, Calendar, FileText, MapPin, Trophy } from "lucide-react";
import { ClientFormattedDate } from "@/components/datetime/ClientDateTime";
import type { PublicMemberCertificate } from "@/lib/api";

function formatCertificateType(type: string): string {
    return type
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

function capitalizeSentence(value: string): string {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
}

interface PublicMemberAchievementsProps {
    certificates: PublicMemberCertificate[];
}

export function PublicMemberAchievements({ certificates }: PublicMemberAchievementsProps) {
    if (certificates.length === 0) {
        return (
            <div className="member-profile-empty">
                <Trophy size={40} strokeWidth={1.5} className="text-purple-700" />
                <p className="member-profile-empty-title">No certificates yet</p>
                <p className="member-profile-empty-sub">
                    Issued certificates and recognitions will appear here.
                </p>
            </div>
        );
    }

    return (
        <div className="member-timeline">
            {certificates.map((cert, index) => {
                const issuedFor = cert.event?.title || cert.project?.title || null;
                const description = capitalizeSentence(cert.description?.trim() || "");
                return (
                    <div key={cert.id} className="member-timeline-item">
                        <div className="member-timeline-marker">
                            <div className="member-timeline-dot" />
                            {index < certificates.length - 1 && <div className="member-timeline-line" />}
                        </div>
                        <div className="member-timeline-content">
                            <div className="member-timeline-header">
                                <span className="member-timeline-badge">
                                    {formatCertificateType(cert.type)}
                                </span>
                                <span className="member-timeline-date">
                                    <Calendar size={14} />
                                    {cert.issuedAt ? (
                                        <ClientFormattedDate value={cert.issuedAt} />
                                    ) : (
                                        "—"
                                    )}
                                </span>
                            </div>
                            <div className="member-timeline-role-row">
                                <Briefcase className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-700" />
                                <span className="member-timeline-role-label">Title:</span>
                                <span>{cert.title}</span>
                            </div>
                            {issuedFor ? (
                                <div className="member-timeline-role-row">
                                    {cert.event?.title ? (
                                        <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-700" />
                                    ) : (
                                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-purple-700" />
                                    )}
                                    <span className="member-timeline-role-label">For:</span>
                                    <span>{issuedFor}</span>
                                </div>
                            ) : null}
                            {description ? (
                                <div className="member-timeline-period">
                                    <FileText size={14} />
                                    <span>{description}</span>
                                </div>
                            ) : null}
                            {/* <Link
                                href={`/verify/${encodeURIComponent(cert.verificationCode)}`}
                                className="btn-secondary member-timeline-verify-btn"
                            >
                                Verify
                            </Link> */}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
