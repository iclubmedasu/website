'use client';

import type { ComponentType } from 'react';
import { useEffect, useState, useCallback } from 'react';
import { useResourceChannel } from '@/hooks/useResourceChannel';
import { Award, ListChecks, Mail, RefreshCw, Settings2, Users } from 'lucide-react';
import type {
    EventCustomFieldRef,
    EventSessionRef,
    EventStatistics,
    EventTicketDesignRef,
    EventTierRef,
    Id,
    ImportRegistrationsResult,
} from '@/types/backend-contracts';
import { eventsAPI } from '@/services/api';
import EventCertificatesSection from './sections/EventCertificatesSection';
import EventRegistrationsSection from './sections/EventRegistrationsSection';
import EventStatisticsSection from './sections/EventStatisticsSection';
import EventTasksSection from './sections/EventTasksSection';
import EventTicketsSection from './sections/EventTicketsSection';
import EventTiersSection from './sections/EventTiersSection';
import EventSessionsSection from './sections/EventSessionsSection';
import type { EventTabKey } from '../eventUtils';
import {
    EMPTY_CERTIFICATES_FUNNEL,
    EMPTY_REGISTRATION_TABLE_FUNNEL,
    type CertificatesFunnelState,
    type RegistrationTableFunnelState,
} from './eventExpandedFunnelState';
import './EventExpandedContent.css';

const TABS: Array<{ key: EventTabKey; label: string; icon: ComponentType<{ size?: number }> }> = [
    { key: 'statistics', label: 'Statistics', icon: RefreshCw },
    { key: 'tiers', label: 'Setup', icon: Settings2 },
    { key: 'registrations', label: 'Registrations', icon: Users },
    { key: 'tickets', label: 'Tickets', icon: Mail },
    { key: 'tasks', label: 'Tasks', icon: ListChecks },
    { key: 'certificates', label: 'Certificates', icon: Award },
];

interface EventExpandedContentProps {
    eventId: Id | string;
    eventSlug?: string;
    eventTitle?: string;
    eventDescription?: string | null;
    eventVenue?: string | null;
    initialTab?: EventTabKey | null;
    allowWalkIns?: boolean;
    allowDirectCheckIn?: boolean;
    eventDate?: string | null;
    eventEndDate?: string | null;
    eventTimezone?: string;
    isPublished?: boolean;
    isCertifiable?: boolean;
    isFinalized?: boolean;
    canPublishEvent?: boolean;
    canRemoveAttendance?: boolean;
    onPublishedChange?: (eventId: Id, published: boolean) => Promise<void>;
    canManageTiers?: boolean;
    canManageSessions?: boolean;
    canManageTasks?: boolean;
    canManageFields?: boolean;
    canManageCertificates?: boolean;
    tierFieldShowOnPublic?: boolean;
    tierFieldRequired?: boolean;
    sessionFieldShowOnPublic?: boolean;
    sessionFieldRequired?: boolean;
    phoneFieldRequired?: boolean;
    sessionFieldOrder?: number;
    tierFieldOrder?: number;
    ticketDesign?: EventTicketDesignRef | null;
    onReload: () => void;
}

export default function EventExpandedContent({
    eventId,
    eventSlug,
    eventTitle,
    eventDescription,
    eventVenue,
    initialTab,
    allowWalkIns = false,
    allowDirectCheckIn = false,
    eventDate,
    eventEndDate,
    eventTimezone,
    isPublished = false,
    isCertifiable = false,
    isFinalized = false,
    canPublishEvent = false,
    canRemoveAttendance = false,
    onPublishedChange,
    canManageTiers = false,
    canManageSessions = false,
    canManageTasks = false,
    canManageFields = false,
    canManageCertificates = false,
    tierFieldShowOnPublic: initialTierFieldShowOnPublic = true,
    tierFieldRequired: initialTierFieldRequired = true,
    sessionFieldShowOnPublic: initialSessionFieldShowOnPublic = false,
    sessionFieldRequired: initialSessionFieldRequired = false,
    phoneFieldRequired: initialPhoneFieldRequired = false,
    sessionFieldOrder: initialSessionFieldOrder = 0,
    tierFieldOrder: initialTierFieldOrder = 1,
    ticketDesign,
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
    const [phoneFieldRequired, setPhoneFieldRequired] = useState(initialPhoneFieldRequired);
    const [sessionFieldOrder, setSessionFieldOrder] = useState(initialSessionFieldOrder);
    const [tierFieldOrder, setTierFieldOrder] = useState(initialTierFieldOrder);
    const [activeTab, setActiveTab] = useState<EventTabKey>(() => initialTab ?? 'statistics');
    const [registrationsFunnel, setRegistrationsFunnel] = useState<RegistrationTableFunnelState>(
        EMPTY_REGISTRATION_TABLE_FUNNEL,
    );
    const [ticketsFunnel, setTicketsFunnel] = useState<RegistrationTableFunnelState>(
        EMPTY_REGISTRATION_TABLE_FUNNEL,
    );
    const [certificatesFunnel, setCertificatesFunnel] = useState<CertificatesFunnelState>(
        EMPTY_CERTIFICATES_FUNNEL,
    );

    useEffect(() => {
        setRegistrationsFunnel(EMPTY_REGISTRATION_TABLE_FUNNEL);
        setTicketsFunnel(EMPTY_REGISTRATION_TABLE_FUNNEL);
        setCertificatesFunnel(EMPTY_CERTIFICATES_FUNNEL);
    }, [eventId]);

    useEffect(() => {
        setTierFieldShowOnPublic(initialTierFieldShowOnPublic);
        setTierFieldRequired(initialTierFieldRequired);
        setSessionFieldShowOnPublic(initialSessionFieldShowOnPublic);
        setSessionFieldRequired(initialSessionFieldRequired);
        setPhoneFieldRequired(initialPhoneFieldRequired);
        setSessionFieldOrder(initialSessionFieldOrder);
        setTierFieldOrder(initialTierFieldOrder);
    }, [
        initialTierFieldShowOnPublic,
        initialTierFieldRequired,
        initialSessionFieldShowOnPublic,
        initialSessionFieldRequired,
        initialPhoneFieldRequired,
        initialSessionFieldOrder,
        initialTierFieldOrder,
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
                        eventTimezone={eventTimezone}
                        canManage={canManageSessions}
                    />
                </div>
            )}
            {activeTab === 'registrations' && (
                <div className="event-expanded-tab-panel">
                    <EventRegistrationsSection
                        eventId={eventId}
                        eventSlug={eventSlug}
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
                        eventTimezone={eventTimezone}
                        isPublished={isPublished}
                        canPublishEvent={canPublishEvent}
                        canRemoveAttendance={canRemoveAttendance}
                        onPublishedChange={onPublishedChange}
                        canManageFields={canManageFields}
                        tierFieldShowOnPublic={tierFieldShowOnPublic}
                        tierFieldRequired={tierFieldRequired}
                        sessionFieldShowOnPublic={sessionFieldShowOnPublic}
                        sessionFieldRequired={sessionFieldRequired}
                        phoneFieldRequired={phoneFieldRequired}
                        sessionFieldOrder={sessionFieldOrder}
                        tierFieldOrder={tierFieldOrder}
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
                            if (columns.phoneFieldRequired !== undefined) {
                                setPhoneFieldRequired(columns.phoneFieldRequired);
                            }
                            if (columns.sessionFieldOrder !== undefined) {
                                setSessionFieldOrder(columns.sessionFieldOrder);
                            }
                            if (columns.tierFieldOrder !== undefined) {
                                setTierFieldOrder(columns.tierFieldOrder);
                            }
                        }}
                        onRegistrationAdded={() => void reloadAll()}
                        onCheckIn={() => void reloadAll()}
                        onImportComplete={handleImportComplete}
                        funnel={registrationsFunnel}
                        onFunnelChange={setRegistrationsFunnel}
                    />
                </div>
            )}
            {activeTab === 'tickets' && (
                <div className="event-expanded-tab-panel">
                    <EventTicketsSection
                        eventId={eventId}
                        eventTitle={eventTitle}
                        eventDescription={eventDescription}
                        eventVenue={eventVenue}
                        eventDate={eventDate}
                        eventEndDate={eventEndDate}
                        eventTimezone={eventTimezone}
                        sessions={sessions}
                        tiers={tiers}
                        fields={fields}
                        ticketDesign={ticketDesign}
                        canRemoveAttendance={canRemoveAttendance}
                        funnel={ticketsFunnel}
                        onFunnelChange={setTicketsFunnel}
                        onReload={onReload}
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
            {activeTab === 'certificates' && (
                <div className="event-expanded-tab-panel">
                    <EventCertificatesSection
                        eventId={eventId}
                        isFinalized={isFinalized}
                        isCertifiable={isCertifiable}
                        canManage={canManageCertificates}
                        funnel={certificatesFunnel}
                        onFunnelChange={setCertificatesFunnel}
                    />
                </div>
            )}
        </div>
    );
}
