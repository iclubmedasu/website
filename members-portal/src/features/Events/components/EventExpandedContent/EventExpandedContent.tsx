'use client';

import type { ComponentType } from 'react';
import { useEffect, useState, useCallback } from 'react';
import { useResourceChannel } from '@/hooks/useResourceChannel';
import { ListChecks, Mail, RefreshCw, Settings2, Users } from 'lucide-react';
import type {
    EventCustomFieldRef,
    EventSessionRef,
    EventStatistics,
    EventTierRef,
    Id,
    ImportRegistrationsResult,
} from '@/types/backend-contracts';
import { eventsAPI } from '@/services/api';
import EventRegistrationsSection from './sections/EventRegistrationsSection';
import EventStatisticsSection from './sections/EventStatisticsSection';
import EventTasksSection from './sections/EventTasksSection';
import EventTicketsSection from './sections/EventTicketsSection';
import EventTiersSection from './sections/EventTiersSection';
import EventSessionsSection from './sections/EventSessionsSection';
import type { EventTabKey } from '../eventUtils';
import './EventExpandedContent.css';

const TABS: Array<{ key: EventTabKey; label: string; icon: ComponentType<{ size?: number }> }> = [
    { key: 'statistics', label: 'Statistics', icon: RefreshCw },
    { key: 'tiers', label: 'Setup', icon: Settings2 },
    { key: 'registrations', label: 'Registrations', icon: Users },
    { key: 'tickets', label: 'Tickets', icon: Mail },
    { key: 'tasks', label: 'Tasks', icon: ListChecks },
];

interface EventExpandedContentProps {
    eventId: Id | string;
    eventTitle?: string;
    initialTab?: EventTabKey | null;
    allowWalkIns?: boolean;
    allowDirectCheckIn?: boolean;
    eventDate?: string | null;
    eventEndDate?: string | null;
    isPublished?: boolean;
    canPublishEvent?: boolean;
    canRemoveAttendance?: boolean;
    onPublishedChange?: (eventId: Id, published: boolean) => Promise<void>;
    canManageTiers?: boolean;
    canManageSessions?: boolean;
    canManageTasks?: boolean;
    canManageFields?: boolean;
    tierFieldShowOnPublic?: boolean;
    tierFieldRequired?: boolean;
    sessionFieldShowOnPublic?: boolean;
    sessionFieldRequired?: boolean;
    onReload: () => void;
}

export default function EventExpandedContent({
    eventId,
    eventTitle,
    initialTab,
    allowWalkIns = false,
    allowDirectCheckIn = false,
    eventDate,
    eventEndDate,
    isPublished = false,
    canPublishEvent = false,
    canRemoveAttendance = false,
    onPublishedChange,
    canManageTiers = false,
    canManageSessions = false,
    canManageTasks = false,
    canManageFields = false,
    tierFieldShowOnPublic: initialTierFieldShowOnPublic = true,
    tierFieldRequired: initialTierFieldRequired = true,
    sessionFieldShowOnPublic: initialSessionFieldShowOnPublic = false,
    sessionFieldRequired: initialSessionFieldRequired = false,
    onReload,
}: EventExpandedContentProps) {
    const [stats, setStats] = useState<EventStatistics | null>(null);
    const [tiers, setTiers] = useState<EventTierRef[]>([]);
    const [fields, setFields] = useState<EventCustomFieldRef[]>([]);
    const [sessions, setSessions] = useState<EventSessionRef[]>([]);
    const [tierFieldShowOnPublic, setTierFieldShowOnPublic] = useState(initialTierFieldShowOnPublic);
    const [tierFieldRequired, setTierFieldRequired] = useState(initialTierFieldRequired);
    const [sessionFieldShowOnPublic, setSessionFieldShowOnPublic] = useState(initialSessionFieldShowOnPublic);
    const [sessionFieldRequired, setSessionFieldRequired] = useState(initialSessionFieldRequired);
    const [activeTab, setActiveTab] = useState<EventTabKey>(() => initialTab ?? 'statistics');

    useEffect(() => {
        setTierFieldShowOnPublic(initialTierFieldShowOnPublic);
        setTierFieldRequired(initialTierFieldRequired);
        setSessionFieldShowOnPublic(initialSessionFieldShowOnPublic);
        setSessionFieldRequired(initialSessionFieldRequired);
    }, [
        initialTierFieldShowOnPublic,
        initialTierFieldRequired,
        initialSessionFieldShowOnPublic,
        initialSessionFieldRequired,
    ]);

    useEffect(() => {
        let active = true;

        const load = async () => {
            try {
                const [tiersResult, fieldsResult, statsResult, sessionsResult] = await Promise.all([
                    eventsAPI.getTiers(eventId),
                    eventsAPI.getCustomFields(eventId),
                    eventsAPI.getStatistics(eventId),
                    eventsAPI.getSessions(eventId),
                ]);
                if (!active) return;
                setTiers(tiersResult);
                setFields(fieldsResult);
                setStats(statsResult);
                setSessions(sessionsResult);
            } catch {
                if (!active) return;
                setTiers([]);
                setFields([]);
                setStats(null);
                setSessions([]);
            }
        };

        void load();
        return () => { active = false; };
    }, [eventId]);

    const reloadAll = useCallback(async () => {
        const [tiersResult, fieldsResult, statsResult, sessionsResult] = await Promise.all([
            eventsAPI.getTiers(eventId),
            eventsAPI.getCustomFields(eventId),
            eventsAPI.getStatistics(eventId),
            eventsAPI.getSessions(eventId),
        ]);
        setTiers(tiersResult);
        setFields(fieldsResult);
        setStats(statsResult);
        setSessions(sessionsResult);
        onReload();
    }, [eventId, onReload]);

    useResourceChannel({
        resource: 'event',
        resourceId: eventId,
        onRefresh: () => { void reloadAll(); },
    });

    const handleImportComplete = (result: ImportRegistrationsResult) => {
        if (result.created > 0) {
            setActiveTab('tickets');
        }
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

            {activeTab === 'statistics' && (
                <div className="event-expanded-tab-panel">
                    <EventStatisticsSection stats={stats} />
                </div>
            )}
            {activeTab === 'tiers' && (
                <div className="event-expanded-tab-panel event-expanded-tab-panel--setup">
                    <EventTiersSection
                        eventId={eventId}
                        tiers={tiers}
                        onTiersChange={setTiers}
                        canManage={canManageTiers}
                    />
                    <hr className="event-setup-divider" />
                    <EventSessionsSection
                        eventId={eventId}
                        canManage={canManageSessions}
                    />
                </div>
            )}
            {activeTab === 'registrations' && (
                <div className="event-expanded-tab-panel">
                    <EventRegistrationsSection
                        eventId={eventId}
                        eventTitle={eventTitle}
                        tiers={tiers}
                        sessions={sessions}
                        fields={fields}
                        onFieldsChange={setFields}
                        totalRegistered={(stats?.totalRegistered ?? 0) + (stats?.walkInCount ?? 0)}
                        allowWalkIns={allowWalkIns}
                        allowDirectCheckIn={allowDirectCheckIn}
                        eventDate={eventDate}
                        eventEndDate={eventEndDate}
                        isPublished={isPublished}
                        canPublishEvent={canPublishEvent}
                        canRemoveAttendance={canRemoveAttendance}
                        onPublishedChange={onPublishedChange}
                        canManageFields={canManageFields}
                        tierFieldShowOnPublic={tierFieldShowOnPublic}
                        tierFieldRequired={tierFieldRequired}
                        sessionFieldShowOnPublic={sessionFieldShowOnPublic}
                        sessionFieldRequired={sessionFieldRequired}
                        onRegistrationColumnsChange={(columns) => {
                            if (columns.tierFieldShowOnPublic !== undefined) {
                                setTierFieldShowOnPublic(columns.tierFieldShowOnPublic);
                            }
                            if (columns.tierFieldRequired !== undefined) {
                                setTierFieldRequired(columns.tierFieldRequired);
                            }
                            if (columns.sessionFieldShowOnPublic !== undefined) {
                                setSessionFieldShowOnPublic(columns.sessionFieldShowOnPublic);
                            }
                            if (columns.sessionFieldRequired !== undefined) {
                                setSessionFieldRequired(columns.sessionFieldRequired);
                            }
                        }}
                        onRegistrationAdded={() => void reloadAll()}
                        onCheckIn={() => void reloadAll()}
                        onImportComplete={handleImportComplete}
                    />
                </div>
            )}
            {activeTab === 'tickets' && (
                <div className="event-expanded-tab-panel">
                    <EventTicketsSection
                        eventId={eventId}
                        eventDate={eventDate}
                        eventEndDate={eventEndDate}
                    />
                </div>
            )}
            {activeTab === 'tasks' && (
                <div className="event-expanded-tab-panel">
                    <EventTasksSection
                        eventId={eventId}
                        eventTitle={eventTitle}
                        eventDate={eventDate}
                        eventEndDate={eventEndDate}
                        canManage={canManageTasks}
                    />
                </div>
            )}
        </div>
    );
}
