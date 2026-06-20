interface EventSummaryCardProps {
    label: string;
    value: string;
}

export default function EventSummaryCard({ label, value }: EventSummaryCardProps) {
    return (
        <div className="event-expanded-summary-card">
            <span className="info-label">{label}</span>
            <strong className="event-expanded-summary-value">{value}</strong>
        </div>
    );
}
