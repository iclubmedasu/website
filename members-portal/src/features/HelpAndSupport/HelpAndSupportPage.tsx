'use client';

import { useEffect, useState } from 'react';
import type { PublicSupportPage, PublicSupportNoticeBlock } from '@iclub/shared';
import { supportContentAPI } from '@/services/api';
import { PortalIncidentReportForm } from './PortalIncidentReportForm';
import './HelpAndSupportPage.css';

function NoticeBlock({ notice }: { notice: PublicSupportNoticeBlock }) {
    const isArabic = notice.locale === 'AR';

    return (
        <div
            className={`help-support-description${isArabic ? '' : ' help-support-en'}`}
            dir={isArabic ? 'rtl' : undefined}
            lang={isArabic ? 'ar' : 'en'}
        >
            <div className="help-support-notice-content">{notice.content}</div>
        </div>
    );
}

function HelpAndSupportPage() {
    const [page, setPage] = useState<PublicSupportPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        void supportContentAPI
            .getPublicSupportPage()
            .then((data) => setPage(data as PublicSupportPage))
            .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load support page'))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="help-support-page members-page">
                <p>Loading help and support…</p>
            </div>
        );
    }

    if (error || !page) {
        return (
            <div className="help-support-page members-page">
                <p className="site-content-error">{error || 'Support page is unavailable.'}</p>
            </div>
        );
    }

    const englishNotices = page.notices.filter((notice) => notice.locale === 'EN');
    const arabicNotices = page.notices.filter((notice) => notice.locale === 'AR');

    return (
        <div className="help-support-page members-page">
            <div className="page-header">
                <p className="help-support-eyebrow">{page.header.eyebrow}</p>
                <h1 className="members-page-title members-page-title-inline">{page.header.title}</h1>
                {page.header.description ? <p className="help-support-lead">{page.header.description}</p> : null}
            </div>

            <hr className="title-divider" />

            <div className="card help-support-card">
                <div className="card-header">
                    <div className="card-header-left">
                        <h3 className="card-title">Incident Report</h3>
                        <p className="card-subtitle">Submit a report or request through the official channel</p>
                    </div>
                </div>
                <div className="card-body">
                    {englishNotices.map((notice) => (
                        <NoticeBlock key={notice.id} notice={notice} />
                    ))}

                    {englishNotices.length > 0 && arabicNotices.length > 0 ? (
                        <hr className="help-support-divider" />
                    ) : null}

                    {arabicNotices.map((notice) => (
                        <NoticeBlock key={notice.id} notice={notice} />
                    ))}

                    <hr className="help-support-divider" />

                    <PortalIncidentReportForm forms={page.forms} />
                </div>
            </div>
        </div>
    );
}

export default HelpAndSupportPage;
