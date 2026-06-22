interface EventStatTileProps {
    label: string;
    value: string;
}

export default function EventStatTile({ label, value }: EventStatTileProps) {
    return (
        <div className="event-stat-tile">
            <p className="event-stat-tile__label">{label}</p>
            <p className="event-stat-tile__value">{value}</p>
        </div>
    );
}
