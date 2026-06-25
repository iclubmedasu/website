'use client';

import type { EditorIncidentReportForm, IncidentReportDetail } from '@iclub/shared';
import { Eye } from 'lucide-react';

function formatCellValue(value: unknown): string {
    if (value === null || value === undefined || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return String(value);
}

function formatSubmittedAt(value: string): string {
    return new Intl.DateTimeFormat('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
    }).format(new Date(value));
}

function getExtraAnswerValue(report: IncidentReportDetail, fieldId: number): unknown {
    return report.payload.extraAnswers.find((answer) => answer.fieldId === fieldId)?.value;
}

export interface SupportFormSubmissionsTableProps {
    form: EditorIncidentReportForm;
    reports: IncidentReportDetail[];
    busy?: boolean;
    onViewReport: (report: IncidentReportDetail) => void;
    onExport: () => void;
}

export function SupportFormSubmissionsTable({
    form,
    reports,
    busy = false,
    onViewReport,
    onExport,
}: SupportFormSubmissionsTableProps) {
    const fieldColumns = form.fields.filter((field) => field.isActive);

    return (
        <section className="site-content-submissions-form-section">
            <div className="site-content-submissions-form-header">
                <div>
                    <h4 className="site-content-section-title">{form.label}</h4>
                    <p className="site-content-section-meta">
                        {reports.length} submission{reports.length === 1 ? '' : 's'}
                    </p>
                </div>
                <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={onExport}
                    disabled={busy || reports.length === 0}
                >
                    Export Excel
                </button>
            </div>
            <div className="site-content-submissions-table-shell">
                <table className="site-content-submissions-table">
                    <thead>
                        <tr>
                            <th>Submitted</th>
                            <th>Source</th>
                            <th>Name</th>
                            <th>Email</th>
                            <th>Phone</th>
                            <th>Team</th>
                            <th>Description</th>
                            {fieldColumns.map((field) => (
                                <th key={field.id}>{field.label}</th>
                            ))}
                            <th className="site-content-submissions-actions-col">Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {reports.map((report) => {
                            const { payload } = report;
                            return (
                                <tr key={report.id}>
                                    <td>{formatSubmittedAt(report.createdAt)}</td>
                                    <td>{report.source}</td>
                                    <td>{formatCellValue(payload.reporter.name)}</td>
                                    <td>{formatCellValue(payload.reporter.email)}</td>
                                    <td>{formatCellValue(payload.reporter.phone)}</td>
                                    <td>{formatCellValue(payload.reporter.team)}</td>
                                    <td className="site-content-submissions-description-cell">
                                        {formatCellValue(payload.description)}
                                    </td>
                                    {fieldColumns.map((field) => (
                                        <td key={field.id}>
                                            {formatCellValue(getExtraAnswerValue(report, field.id))}
                                        </td>
                                    ))}
                                    <td className="site-content-submissions-actions-col">
                                        <button
                                            type="button"
                                            className="btn btn-secondary btn-icon"
                                            onClick={() => onViewReport(report)}
                                            disabled={busy}
                                            aria-label={`View report #${report.id}`}
                                        >
                                            <Eye size={16} />
                                        </button>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
