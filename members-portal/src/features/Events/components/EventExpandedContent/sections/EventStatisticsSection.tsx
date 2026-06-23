'use client';

import { useMemo } from 'react';
import type { ApexOptions } from 'apexcharts';
import type { EventStatistics } from '@/types/backend-contracts';
import LineChart from '@/components/charts/LineChart';
import PieChart from '@/components/charts/PieChart';
import EventStatTile from '../EventStatTile';

interface EventStatisticsSectionProps {
    stats: EventStatistics | null;
}

const CHART_COLOR = '#561789';
const ATTENDANCE_COLOR = '#16a34a';

const PIE_COLORS = ['#561789', '#16a34a', '#9ca3af'];

const baseChartOptions: ApexOptions = {
    chart: {
        toolbar: { show: false },
        fontFamily: 'inherit',
    },
    dataLabels: { enabled: false },
    grid: {
        borderColor: '#e8e8e8',
        strokeDashArray: 4,
    },
};

function buildLineChartOptions(categories: string[], color: string): ApexOptions {
    return {
        ...baseChartOptions,
        colors: [color],
        stroke: { curve: 'smooth', width: 2 },
        xaxis: {
            categories,
            labels: { style: { fontFamily: 'inherit', colors: '#6b7280' } },
        },
        yaxis: {
            labels: { style: { fontFamily: 'inherit', colors: '#6b7280' } },
        },
    };
}

export default function EventStatisticsSection({ stats }: EventStatisticsSectionProps) {
    const registered = stats?.totalRegistered ?? 0;
    const checkedIn = stats?.totalCheckedIn ?? 0;
    const walkIns = stats?.walkInCount ?? 0;
    const noShows = stats?.noShowCount ?? 0;
    const totalAttended = checkedIn + walkIns;

    const registrationTimeData = stats?.registrationsOverTime ?? [];
    const attendanceTimeData = useMemo(
        () => [...(stats?.attendanceOverTime ?? [])].sort((a, b) => a.date.localeCompare(b.date)),
        [stats?.attendanceOverTime],
    );

    const registrationLineSeries = useMemo(
        () => [{ name: 'Registrations', data: registrationTimeData.map((entry) => entry.count) }],
        [registrationTimeData],
    );

    const attendanceLineSeries = useMemo(
        () => [{ name: 'Attendance', data: attendanceTimeData.map((entry) => entry.count) }],
        [attendanceTimeData],
    );

    const registrationLineOptions = useMemo(
        () => buildLineChartOptions(registrationTimeData.map((entry) => entry.date), CHART_COLOR),
        [registrationTimeData],
    );

    const attendanceLineOptions = useMemo(
        () => buildLineChartOptions(attendanceTimeData.map((entry) => entry.date), ATTENDANCE_COLOR),
        [attendanceTimeData],
    );

    const pieSeries = useMemo(() => [checkedIn, walkIns, noShows], [checkedIn, walkIns, noShows]);
    const pieHasData = pieSeries.some((value) => value > 0);

    const pieOptions = useMemo<ApexOptions>(
        () => ({
            chart: {
                toolbar: { show: false },
                fontFamily: 'inherit',
            },
            colors: PIE_COLORS,
            labels: ['Check-ins', 'Walk-ins', 'No-shows'],
            legend: {
                position: 'bottom',
                fontFamily: 'inherit',
            },
            dataLabels: {
                enabled: pieHasData,
                formatter: (val: number) => `${Math.round(val)}%`,
            },
        }),
        [pieHasData],
    );

    return (
        <section className="event-expanded-panel">
           <h2 className="expanded-section-title">Statistics</h2>
            <div className="event-expanded-summary-grid event-expanded-summary-grid--stats">
                <EventStatTile label="Registered" value={String(registered)} />
                <EventStatTile label="Check-ins" value={String(checkedIn)} />
                <EventStatTile label="Walk-ins" value={String(walkIns)} />
                <EventStatTile label="No-shows" value={String(noShows)} />
                <EventStatTile label="Total attended" value={String(totalAttended)} />
            </div>

            <div className="event-expanded-charts-row">
                <div className="event-expanded-chart-cell">
                    <h3 className="expanded-section-title expanded-section-title--sm">Registrations over time</h3>
                    <div className="event-expanded-chart-wrap">
                        {registrationTimeData.length > 0 ? (
                            <LineChart series={registrationLineSeries} options={registrationLineOptions} />
                        ) : (
                            <p className="event-expanded-chart-empty">No registration data yet.</p>
                        )}
                    </div>
                </div>

                <div className="event-expanded-chart-cell">
                    <h3 className="expanded-section-title expanded-section-title--sm">Daily attendance</h3>
                    <div className="event-expanded-chart-wrap">
                        {attendanceTimeData.length > 0 ? (
                            <LineChart series={attendanceLineSeries} options={attendanceLineOptions} />
                        ) : (
                            <p className="event-expanded-chart-empty">No attendance data yet.</p>
                        )}
                    </div>
                </div>

                <div className="event-expanded-chart-cell">
                    <h3 className="expanded-section-title expanded-section-title--sm">Attendance breakdown</h3>
                    <div className="event-expanded-chart-wrap">
                        {pieHasData ? (
                            <PieChart series={pieSeries} options={pieOptions} />
                        ) : (
                            <p className="event-expanded-chart-empty">No attendance breakdown yet.</p>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
