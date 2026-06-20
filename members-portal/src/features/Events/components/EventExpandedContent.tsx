'use client';

import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import { CheckCircle2, ClipboardList, Layers3, RefreshCw, Users } from 'lucide-react';
import type {
    EventCustomFieldRef,
    EventStatistics,
    EventTierRef,
    Id,
} from '@/types/backend-contracts';
import { eventsAPI } from '@/services/api';
import EventCheckInSection from './sections/EventCheckInSection';
import EventFormBuilderSection from './sections/EventFormBuilderSection';
import EventRegistrationsSection from './sections/EventRegistrationsSection';
import EventStatisticsSection from './sections/EventStatisticsSection';
import EventTiersSection from './sections/EventTiersSection';
import type { EventTabKey } from './eventUtils';

const TABS: Array<{ key: EventTabKey; label: string; icon: ComponentType<{ size?: number }> }> = [
    { key: 'statistics', label: 'Statistics', icon: RefreshCw },
    { key: 'tiers', label: 'Tiers', icon: Layers3 },
    { key: 'builder', label: 'Form Builder', icon: ClipboardList },
    { key: 'registrations', label: 'Registrations', icon: Users },
    { key: 'checkin', label: 'Check-in', icon: CheckCircle2 },
];

interface EventExpandedContentProps {
    eventId: Id | string;
    initialTab?: EventTabKey | null;
    onReload: () => void;
}

export default function EventExpandedContent({ eventId, initialTab, onReload }: EventExpandedContentProps) {
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
            {activeTab === 'builder' && (
                <EventFormBuilderSection eventId={eventId} fields={fields} onFieldsChange={setFields} />
            )}
            {activeTab === 'registrations' && (
                <EventRegistrationsSection eventId={eventId} tiers={tiers} />
            )}
            {activeTab === 'checkin' && (
                <EventCheckInSection eventId={eventId} tiers={tiers} onCheckIn={() => void reloadAll()} />
            )}
        </div>
    );
}
