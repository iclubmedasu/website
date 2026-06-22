'use client';

import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { Layers3, ListChecks, RefreshCw, Users } from 'lucide-react';
import type {
    EventCustomFieldRef,
    EventStatistics,
    EventTierRef,
    Id,
} from '@/types/backend-contracts';
import { eventsAPI } from '@/services/api';
import EventRegistrationsSection from './sections/EventRegistrationsSection';
import EventStatisticsSection from './sections/EventStatisticsSection';
import EventTasksSection from './sections/EventTasksSection';
import EventTiersSection from './sections/EventTiersSection';
import type { EventTabKey } from '../eventUtils';
import './EventExpandedContent.css';

const TABS: Array<{ key: EventTabKey; label: string; icon: ComponentType<{ size?: number }> }> = [
    { key: 'statistics', label: 'Statistics', icon: RefreshCw },
    { key: 'tiers', label: 'Tiers', icon: Layers3 },
    { key: 'registrations', label: 'Registrations', icon: Users },
    { key: 'tasks', label: 'Tasks', icon: ListChecks },
];

interface EventExpandedContentProps {
    eventId: Id | string;
    initialTab?: EventTabKey | null;
    allowWalkIns?: boolean;
    eventDate?: string | null;
    eventEndDate?: string | null;
    onReload: () => void;
}

export default function EventExpandedContent({
    eventId,
    initialTab,
    allowWalkIns = false,
    eventDate,
    eventEndDate,
    onReload,
}: EventExpandedContentProps) {
    const [stats, setStats] = useState<EventStatistics | null>(null);
    const [tiers, setTiers] = useState<EventTierRef[]>([]);
    const [fields, setFields] = useState<EventCustomFieldRef[]>([]);
    const [activeTab, setActiveTab] = useState<EventTabKey>(initialTab ?? 'statistics');

    useEffect(() => {
        if (initialTab) setActiveTab(initialTab);
    }, [initialTab]);

    useEffect(() => {
        let active = true;

        const load = async () => {
            try {
                const [tiersResult, fieldsResult, statsResult] = await Promise.all([
                    eventsAPI.getTiers(eventId),
                    eventsAPI.getCustomFields(eventId),
                    eventsAPI.getStatistics(eventId),
                ]);
                if (!active) return;
                setTiers(tiersResult);
                setFields(fieldsResult);
                setStats(statsResult);
            } catch {
                if (!active) return;
                setTiers([]);
                setFields([]);
                setStats(null);
            }
        };

        void load();
        return () => { active = false; };
    }, [eventId]);

    const reloadAll = async () => {
        const [tiersResult, fieldsResult, statsResult] = await Promise.all([
            eventsAPI.getTiers(eventId),
            eventsAPI.getCustomFields(eventId),
            eventsAPI.getStatistics(eventId),
        ]);
        setTiers(tiersResult);
        setFields(fieldsResult);
        setStats(statsResult);
        onReload();
    };

    return (
        <div className="event-expanded-content">
            <nav className="event-expanded-tab-nav" aria-label="Event tabs">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setActiveTab(tab.key)}
                            className={`event-expanded-tab-button${activeTab === tab.key ? ' event-expanded-tab-button--active' : ''}`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </nav>

            {activeTab === 'statistics' && <EventStatisticsSection stats={stats} />}
            {activeTab === 'tiers' && (
                <EventTiersSection eventId={eventId} tiers={tiers} onTiersChange={setTiers} />
            )}
            {activeTab === 'registrations' && (
                <EventRegistrationsSection
                    eventId={eventId}
                    tiers={tiers}
                    fields={fields}
                    onFieldsChange={setFields}
                    totalRegistered={(stats?.totalRegistered ?? 0) + (stats?.walkInCount ?? 0)}
                    allowWalkIns={allowWalkIns}
                    eventDate={eventDate}
                    eventEndDate={eventEndDate}
                    onRegistrationAdded={() => void reloadAll()}
                    onCheckIn={() => void reloadAll()}
                />
            )}
            {activeTab === 'tasks' && (
                <EventTasksSection
                    eventId={eventId}
                    eventDate={eventDate}
                    eventEndDate={eventEndDate}
                />
            )}
        </div>
    );
}
