interface EventProgressBarProps {
    value: number;
    total: number;
    label?: string;
}

export default function EventProgressBar({ value, total, label }: EventProgressBarProps) {
    const safeTotal = total > 0 ? total : 1;
    const safeValue = Math.min(value, safeTotal);

    return (
        <progress className="event-expanded-progress" value={safeValue} max={safeTotal} aria-label={label} />
    );
}
