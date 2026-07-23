'use client';

import { Briefcase, Calendar, FileText, MapPin, Trophy } from 'lucide-react';
import { formatDate } from '@iclub/shared/utils';
import type { CertificateListItem } from '@/services/certificatesAPI';
import '@/components/modal/modal.css';

function formatCertificateType(type: string): string {
    return type
        .toLowerCase()
        .split('_')
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(' ');
}

function capitalizeSentence(value: string): string {
    if (!value) return value;
    return value.charAt(0).toUpperCase() + value.slice(1);
}

interface MemberAchievementsProps {
    certificates: CertificateListItem[];
    emptyTitle?: string;
    emptySubtitle?: string;
}

export function MemberAchievements({
    certificates,
    emptyTitle = 'No Certificates Yet',
    emptySubtitle = 'Issued certificates and recognitions will appear here.',
}: MemberAchievementsProps) {
    const issued = certificates
        .filter((cert) => cert.status === 'ISSUED')
        .slice()
        .sort((a, b) => {
            const aTime = a.issuedAt ? new Date(a.issuedAt).getTime() : 0;
            const bTime = b.issuedAt ? new Date(b.issuedAt).getTime() : 0;
            return bTime - aTime;
        });

    if (issued.length === 0) {
        return (
            <div className="empty-state">
                <Trophy className="empty-state-icon" strokeWidth={1.5} />
                <h4 className="empty-state-title">{emptyTitle}</h4>
                <p className="empty-state-text">{emptySubtitle}</p>
            </div>
        );
    }

    return (
        <div className="vertical-timeline">
            {issued.map((cert, index) => {
                const issuedFor = cert.event?.title || cert.project?.title || null;
                const description = capitalizeSentence(cert.description?.trim() || '');
                return (
                    <div key={cert.id} className="timeline-item">
                        <div className="timeline-marker">
                            <div className="timeline-dot activity-tone-comment" />
                            {index < issued.length - 1 && (
                                <div className="timeline-line timeline-line--descending" />
                            )}
                        </div>

                        <div className="timeline-content">
                            <div className="timeline-header">
                                <span className="change-type-badge activity-tone-comment">
                                    {formatCertificateType(cert.type)}
                                </span>
                                <span className="timeline-date">
                                    <Calendar size={14} />
                                    {cert.issuedAt ? formatDate(cert.issuedAt) : '—'}
                                </span>
                            </div>

                            <div className="role-info">
                                <div className="role-item">
                                    <Briefcase size={14} />
                                    <span className="role-item-label">Title:</span>
                                    <span className="role-name">{cert.title}</span>
                                </div>
                                {issuedFor ? (
                                    <div className="role-item">
                                        {cert.event?.title ? <Calendar size={14} /> : <MapPin size={14} />}
                                        <span className="role-item-label">For:</span>
                                        <span className="team-name">{issuedFor}</span>
                                    </div>
                                ) : null}
                            </div>

                            {description ? (
                                <div className="duration-info">
                                    <FileText size={14} />
                                    <span className="duration-text">{description}</span>
                                </div>
                            ) : null}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
