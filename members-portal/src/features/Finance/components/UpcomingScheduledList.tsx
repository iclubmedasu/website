'use client';

import { format, isPast, parseISO } from 'date-fns';
import { ArrowDownLeft, ArrowUpRight, Pencil } from 'lucide-react';
import type { FinanceScheduledItemRow } from '@iclub/shared';

interface UpcomingScheduledListProps {
    items: FinanceScheduledItemRow[];
    currency: string;
    onAdd?: () => void;
    onEdit?: (item: FinanceScheduledItemRow) => void;
}

function formatMoney(amount: number, currency: string): string {
    return new Intl.NumberFormat('en-EG', {
        style: 'currency',
        currency,
        maximumFractionDigits: 2,
    }).format(amount);
}

function dueLabel(item: FinanceScheduledItemRow): string {
    if (item.daysUntilDue < 0) {
        return `Overdue by ${Math.abs(item.daysUntilDue)} day${Math.abs(item.daysUntilDue) === 1 ? '' : 's'}`;
    }
    if (item.daysUntilDue === 0) return 'Due today';
    return `Due in ${item.daysUntilDue} day${item.daysUntilDue === 1 ? '' : 's'}`;
}

export default function UpcomingScheduledList({
    items,
    currency,
    onAdd,
    onEdit,
}: UpcomingScheduledListProps) {
    return (
        <div className="card finance-side-card">
            <div className="card-header card-header-with-action">
                <div className="card-header-left">
                    <h3 className="card-title">Upcoming Scheduled Items</h3>
                    <p className="card-subtitle">Expected income and expenses in the next 60 days</p>
                </div>
                {onAdd ? (
                    <button type="button" className="btn btn-secondary finance-card-action" onClick={onAdd}>
                        Add item
                    </button>
                ) : null}
            </div>
            <div className="card-body finance-scheduled-list">
                {items.length === 0 ? (
                    <p className="empty-message">No upcoming scheduled items.</p>
                ) : (
                    items.map((item) => {
                        const overdue = isPast(parseISO(item.dueDate)) && item.daysUntilDue < 0;
                        return (
                            <div
                                key={item.id}
                                className={`finance-scheduled-row finance-list-row--clickable${overdue ? ' finance-scheduled-overdue' : ''}`}
                                onClick={onEdit ? () => onEdit(item) : undefined}
                                onKeyDown={
                                    onEdit
                                        ? (event) => {
                                            if (event.key === 'Enter' || event.key === ' ') {
                                                event.preventDefault();
                                                onEdit(item);
                                            }
                                        }
                                        : undefined
                                }
                                role={onEdit ? 'button' : undefined}
                                tabIndex={onEdit ? 0 : undefined}
                            >
                                <div className={`finance-scheduled-icon finance-scheduled-icon-${item.type.toLowerCase()}`}>
                                    {item.type === 'INCOME' ? <ArrowDownLeft size={18} /> : <ArrowUpRight size={18} />}
                                </div>
                                <div className="finance-scheduled-content">
                                    <h4 className="finance-scheduled-title">{item.title}</h4>
                                    <p className="finance-scheduled-meta">
                                        {format(parseISO(item.dueDate), 'MMM d, yyyy')}
                                        {item.accountName ? ` · ${item.accountName}` : ''}
                                        {item.recurrence ? ` · ${item.recurrence}` : ''}
                                    </p>
                                    <p className={`finance-scheduled-due${overdue ? ' finance-scheduled-due-overdue' : ''}`}>
                                        {dueLabel(item)}
                                    </p>
                                </div>
                                <div className="finance-scheduled-end">
                                    <p className={`finance-scheduled-amount finance-scheduled-amount-${item.type.toLowerCase()}`}>
                                        {formatMoney(item.amount, currency)}
                                    </p>
                                    {onEdit ? (
                                        <button
                                            type="button"
                                            className="table-action-btn edit-btn"
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onEdit(item);
                                            }}
                                            aria-label={`Edit ${item.title}`}
                                        >
                                            <Pencil size={16} />
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
}
