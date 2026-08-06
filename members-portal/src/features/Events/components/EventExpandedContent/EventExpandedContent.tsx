'use client';



import type { ComponentType } from 'react';

import { useEffect, useState, useCallback, useRef } from 'react';

import { useResourceChannel } from '@/hooks/useResourceChannel';

import { Award, ListChecks, Mail, RefreshCw, Settings2, Users } from 'lucide-react';

import type {
    EventCustomFieldRef,
    EventIdCardDesignRef,
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



type TabReloadFn = () => void | Promise<void>;



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

    idCardDesign?: EventIdCardDesignRef | null;

    onReload: () => void;

}



function seedVisited(tab: EventTabKey): Set<EventTabKey> {

    return new Set<EventTabKey>([tab]);

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

    idCardDesign,

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

    const defaultTab = initialTab ?? 'statistics';

    const [activeTab, setActiveTab] = useState<EventTabKey>(() => defaultTab);

    const [visitedTabs, setVisitedTabs] = useState<Set<EventTabKey>>(() => seedVisited(defaultTab));

    const [registrationsFunnel, setRegistrationsFunnel] = useState<RegistrationTableFunnelState>(

        EMPTY_REGISTRATION_TABLE_FUNNEL,

    );

    const [ticketsFunnel, setTicketsFunnel] = useState<RegistrationTableFunnelState>(

        EMPTY_REGISTRATION_TABLE_FUNNEL,

    );

    const [certificatesFunnel, setCertificatesFunnel] = useState<CertificatesFunnelState>(

        EMPTY_CERTIFICATES_FUNNEL,

    );



    const setupSessionsReloadRef = useRef<TabReloadFn | null>(null);



    const registerSetupSessionsReload = useCallback((fn: TabReloadFn | null) => {

        setupSessionsReloadRef.current = fn;

    }, []);



    useEffect(() => {

        setVisitedTabs((prev) => {

            if (prev.has(activeTab)) return prev;

            const next = new Set(prev);

            next.add(activeTab);

            return next;

        });

    }, [activeTab]);



    useEffect(() => {

        const tab = initialTab ?? 'statistics';

        setActiveTab(tab);

        setVisitedTabs(seedVisited(tab));

        setRegistrationsFunnel(EMPTY_REGISTRATION_TABLE_FUNNEL);

        setTicketsFunnel(EMPTY_REGISTRATION_TABLE_FUNNEL);

        setCertificatesFunnel(EMPTY_CERTIFICATES_FUNNEL);

        setupSessionsReloadRef.current = null;

        // Only reset keep-alive state when the expanded event changes.

        // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional: initialTab applies on expand/eventId

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



    const reloadStatistics = useCallback(async () => {

        try {

            const statsResult = await eventsAPI.getStatistics(eventId);

            setStats(statsResult);

        } catch {

            setStats(null);

        }

    }, [eventId]);



    const reloadSetup = useCallback(async () => {

        try {

            const [tiersResult, fieldsResult, sessionsResult] = await Promise.all([

                eventsAPI.getTiers(eventId),

                eventsAPI.getCustomFields(eventId),

                eventsAPI.getSessions(eventId),

            ]);

            setTiers(tiersResult);

            setFields(fieldsResult);

            setSessions(sessionsResult);

            await setupSessionsReloadRef.current?.();

        } catch {

            setTiers([]);

            setFields([]);

            setSessions([]);

        }

    }, [eventId]);



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



    const panelClassName = (tab: EventTabKey, extra?: string) => {

        const parts = ['event-expanded-tab-panel'];

        if (activeTab !== tab) parts.push('event-expanded-tab-panel--inactive');

        if (extra) parts.push(extra);

        return parts.join(' ');

    };



    const hasVisited = (tab: EventTabKey) => visitedTabs.has(tab);



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



            {hasVisited('statistics') && (

                <div

                    className={panelClassName('statistics')}

                    hidden={activeTab !== 'statistics'}

                >

                    <EventStatisticsSection stats={stats} onReload={reloadStatistics} />

                </div>

            )}

            {hasVisited('tiers') && (

                <div

                    className={panelClassName('tiers', 'event-expanded-tab-panel--setup')}

                    hidden={activeTab !== 'tiers'}

                >

                    <EventTiersSection

                        eventId={eventId}

                        tiers={tiers}

                        onTiersChange={setTiers}

                        canManage={canManageTiers}

                        onReload={reloadSetup}

                    />

                    <hr className="event-setup-divider" />

                    <EventSessionsSection

                        eventId={eventId}

                        eventTimezone={eventTimezone}

                        canManage={canManageSessions}

                        registerReload={registerSetupSessionsReload}

                    />

                </div>

            )}

            {hasVisited('registrations') && (

                <div

                    className={panelClassName('registrations')}

                    hidden={activeTab !== 'registrations'}

                >

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

                        idCardDesign={idCardDesign}

                    />

                </div>

            )}

            {hasVisited('tickets') && (

                <div

                    className={panelClassName('tickets')}

                    hidden={activeTab !== 'tickets'}

                >

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

                        idCardDesign={idCardDesign}

                        canRemoveAttendance={canRemoveAttendance}

                        funnel={ticketsFunnel}

                        onFunnelChange={setTicketsFunnel}

                        onReload={onReload}

                    />

                </div>

            )}

            {hasVisited('tasks') && (

                <div

                    className={panelClassName('tasks')}

                    hidden={activeTab !== 'tasks'}

                >

                    <EventTasksSection

                        eventId={eventId}

                        eventTitle={eventTitle}

                        eventDate={eventDate}

                        eventEndDate={eventEndDate}

                        canManage={canManageTasks}

                    />

                </div>

            )}

            {hasVisited('certificates') && (

                <div

                    className={panelClassName('certificates')}

                    hidden={activeTab !== 'certificates'}

                >

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

