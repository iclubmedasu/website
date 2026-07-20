"use client";

import Link from "next/link";
import { useState } from "react";
import { Calendar, Link as LinkIcon, Mail, Phone, Trophy } from "lucide-react";
import type { PublicMemberProfile } from "@iclub/shared";
import { ClientFormattedDate } from "@/components/datetime/ClientDateTime";
import { Badge } from "@/components/ui";
import { getPublicProfilePhotoUrl, type PublicMemberCertificate } from "@/lib/api";
import { PublicMemberRoleHistory } from "./PublicMemberRoleHistory";

type ProfileTab = "personal" | "history" | "achievements";

const TABS: { key: ProfileTab; label: string }[] = [
    { key: "personal", label: "Personal Details" },
    { key: "history", label: "History" },
    { key: "achievements", label: "Achievements" },
];

function formatCertificateType(type: string): string {
    return type
        .toLowerCase()
        .split("_")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

interface MemberProfileViewProps {
    profile: PublicMemberProfile;
    certificates?: PublicMemberCertificate[];
}

export function MemberProfileView({ profile, certificates }: MemberProfileViewProps) {
    const [activeTab, setActiveTab] = useState<ProfileTab>("personal");
    const photoUrl = profile.profilePhotoUrl ? getPublicProfilePhotoUrl(profile.id) : null;
    const issuedCertificates = certificates ?? [];

    return (
        <div className="member-profile-card">
            <div className="member-profile-header">
                <div className="member-profile-avatar">
                    {photoUrl ? (
                        <img src={photoUrl} alt="" />
                    ) : (
                        (profile.fullName || "U").charAt(0).toUpperCase()
                    )}
                </div>
                <h1 className="member-profile-name">{profile.fullName}</h1>
            </div>

            <div className="member-profile-tabs" role="tablist">
                {TABS.map((tab) => (
                    <button
                        key={tab.key}
                        type="button"
                        role="tab"
                        aria-selected={activeTab === tab.key}
                        className={`member-profile-tab${activeTab === tab.key ? " member-profile-tab--active" : ""}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            <div className="member-profile-panel" role="tabpanel">
                {activeTab === "personal" && (
                    <div className="member-profile-data-grid">
                        <div className="member-profile-data-item">
                            <span className="member-profile-data-label">Full Name</span>
                            <span className="member-profile-data-value">{profile.fullName}</span>
                        </div>
                        <div className="member-profile-data-item">
                            <span className="member-profile-data-label">Official Email</span>
                            <span className="member-profile-data-value">
                                <Mail className="h-3.5 w-3.5 shrink-0 text-purple-700" />
                                {profile.email}
                            </span>
                        </div>
                        {profile.email2 ? (
                            <div className="member-profile-data-item">
                                <span className="member-profile-data-label">Email 2</span>
                                <span className="member-profile-data-value">{profile.email2}</span>
                            </div>
                        ) : null}
                        {profile.email3 ? (
                            <div className="member-profile-data-item">
                                <span className="member-profile-data-label">Email 3</span>
                                <span className="member-profile-data-value">{profile.email3}</span>
                            </div>
                        ) : null}
                        {profile.phoneNumber ? (
                            <div className="member-profile-data-item">
                                <span className="member-profile-data-label">Phone</span>
                                <span className="member-profile-data-value">
                                    <Phone className="h-3.5 w-3.5 shrink-0 text-purple-700" />
                                    {profile.phoneNumber}
                                </span>
                            </div>
                        ) : null}
                        {profile.phoneNumber2 ? (
                            <div className="member-profile-data-item">
                                <span className="member-profile-data-label">Phone 2</span>
                                <span className="member-profile-data-value">{profile.phoneNumber2}</span>
                            </div>
                        ) : null}
                        {profile.studentId != null ? (
                            <div className="member-profile-data-item">
                                <span className="member-profile-data-label">Student ID</span>
                                <span className="member-profile-data-value">{profile.studentId}</span>
                            </div>
                        ) : null}
                        <div className="member-profile-data-item">
                            <span className="member-profile-data-label">LinkedIn</span>
                            <span className="member-profile-data-value">
                                {profile.linkedInUrl ? (
                                    <a
                                        href={profile.linkedInUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="member-profile-data-link"
                                    >
                                        <LinkIcon className="h-3.5 w-3.5" />
                                        View profile
                                    </a>
                                ) : (
                                    "—"
                                )}
                            </span>
                        </div>
                        <div className="member-profile-data-item">
                            <span className="member-profile-data-label">Join Date</span>
                            <span className="member-profile-data-value">
                                {profile.joinDate ? (
                                    <ClientFormattedDate value={profile.joinDate} />
                                ) : (
                                    "—"
                                )}
                            </span>
                        </div>
                    </div>
                )}

                {activeTab === "history" && (
                    <>
                        <h2 className="member-profile-section-title">
                            <Calendar className="h-5 w-5 text-purple-700" />
                            Role History
                        </h2>
                        <PublicMemberRoleHistory entries={profile.roleHistory || []} />
                    </>
                )}

                {activeTab === "achievements" && (
                    issuedCertificates.length > 0 ? (
                        <section className="member-profile-certificates">
                            <h2 className="member-profile-section-title">
                                <Trophy className="h-5 w-5 text-purple-700" />
                                Certificates
                            </h2>
                            <div className="member-profile-cert-grid">
                                {issuedCertificates.map((cert) => {
                                    const issuedFor = cert.event?.title || cert.project?.title || null;
                                    return (
                                        <article key={cert.id} className="member-profile-cert-card">
                                            <div className="member-profile-cert-card-top">
                                                <h3 className="member-profile-cert-title">{cert.title}</h3>
                                                <Badge variant="purple">{formatCertificateType(cert.type)}</Badge>
                                            </div>
                                            {issuedFor ? (
                                                <p className="member-profile-cert-meta">{issuedFor}</p>
                                            ) : null}
                                            {cert.issuedAt ? (
                                                <p className="member-profile-cert-date">
                                                    <ClientFormattedDate value={cert.issuedAt} />
                                                </p>
                                            ) : null}
                                            <Link
                                                href={`/verify/${encodeURIComponent(cert.verificationCode)}`}
                                                className="member-profile-cert-verify"
                                            >
                                                Verify
                                            </Link>
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    ) : (
                        <div className="member-profile-empty">
                            <Trophy size={40} strokeWidth={1.5} className="text-purple-700" />
                            <p className="member-profile-empty-title">Achievements</p>
                            <p className="member-profile-empty-sub">
                                Milestones, recognitions, and club contributions will appear here. Coming soon.
                            </p>
                        </div>
                    )
                )}
            </div>
        </div>
    );
}
