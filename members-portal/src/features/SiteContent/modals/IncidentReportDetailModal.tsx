'use client';

import type { IncidentReportDetail } from '@iclub/shared';
import { SiteContentModal } from '../components/SiteContentModal';

function formatAnswerValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
}

interface IncidentReportDetailModalProps {
    report: IncidentReportDetail;
    onClose: () => void;
}

export function IncidentReportDetailModal({ report, onClose }: IncidentReportDetailModalProps) {
    const submittedAt = new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(report.createdAt));
    const { payload } = report;

    return (
        <SiteContentModal
            title={`Incident report #${report.id}`}
            subtitle={`${report.source} · ${submittedAt}`}
            onClose={onClose}
            wide
            footer={
                <button type="button" className="btn btn-secondary" onClick={onClose}>
                    Close
                </button>
            }
        >
            <dl className="site-content-report-detail">
                <div className="site-content-report-answer">
                    <dt>Form</dt>
                    <dd>{payload.form?.label ?? payload.reportType?.label}</dd>
                </div>
                <div className="site-content-report-answer">
                    <dt>Name</dt>
                    <dd>{formatAnswerValue(payload.reporter.name)}</dd>
                </div>
                <div className="site-content-report-answer">
                    <dt>Email</dt>
                    <dd>{formatAnswerValue(payload.reporter.email)}</dd>
                </div>
                <div className="site-content-report-answer">
                    <dt>Phone</dt>
                    <dd>{formatAnswerValue(payload.reporter.phone)}</dd>
                </div>
                {payload.reporter.team ? (
                    <div className="site-content-report-answer">
                        <dt>Team</dt>
                        <dd>{payload.reporter.team}</dd>
                    </div>
                ) : null}
                <div className="site-content-report-answer">
                    <dt>Description</dt>
                    <dd>{formatAnswerValue(payload.description)}</dd>
                </div>
                {payload.extraAnswers.map((answer) => (
                    <div key={`${report.id}-${answer.fieldId}`} className="site-content-report-answer">
                        <dt>{answer.label}</dt>
                        <dd>{formatAnswerValue(answer.value)}</dd>
                    </div>
                ))}
            </dl>
        </SiteContentModal>
    );
}
