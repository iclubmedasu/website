import type { EventStatistics } from '@/types/backend-contracts';
import EventProgressBar from '../EventProgressBar';
import EventSummaryCard from '../EventSummaryCard';

interface EventStatisticsSectionProps {
    stats: EventStatistics | null;
}

export default function EventStatisticsSection({ stats }: EventStatisticsSectionProps) {
    const checkedIn = stats?.totalCheckedIn ?? 0;
    const registered = stats?.totalRegistered ?? 0;
    const walkIns = stats?.walkInCount ?? 0;
    const noShows = stats?.noShowCount ?? 0;
    const totalAttended = checkedIn + walkIns;

    return (
        <section className="event-expanded-panel">
            <h2 className="expanded-section-title">Statistics</h2>
            <div className="event-expanded-summary-grid">
                <EventSummaryCard label="Check-ins / Registered" value={`${checkedIn} / ${registered}`} />
                <EventSummaryCard label="Walk-ins" value={String(walkIns)} />
                <EventSummaryCard label="No-shows" value={String(noShows)} />
                <EventSummaryCard label="Total attended" value={String(totalAttended)} />
            </div>
            <div className="event-expanded-stack event-expanded-stack--spaced">
                {(stats?.byTier ?? []).map((entry) => (
                    <div key={entry.tierId}>
                        <div className="event-expanded-progress-row-header">
                            <strong>{entry.name}</strong>
                            <span>{entry.registrations}</span>
                        </div>
                        <EventProgressBar value={entry.registrations} total={Math.max(stats?.totalRegistered ?? 0, 1)} />
                    </div>
                ))}
            </div>
            <div className="event-expanded-stack event-expanded-stack--spaced event-expanded-stack--top">
                <h3 className="expanded-section-title expanded-section-title--sm">Registrations over time</h3>
                <div className="event-expanded-stack event-expanded-stack--tiny">
                    {(stats?.registrationsOverTime ?? []).map((entry) => (
                        <div key={entry.date} className="event-expanded-timeline-row">
                            <span>{entry.date}</span>
                            <EventProgressBar value={entry.count} total={Math.max(stats?.totalRegistered ?? 0, 1)} />
                            <strong>{entry.count}</strong>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
