'use client'

import { useEffect, useState, type FormEvent } from 'react'
import {
    Megaphone,
    PauseCircle,
    Pencil,
    Pin,
    PlayCircle,
    Plus,
    Users,
    X,
} from 'lucide-react'
import { useAnnouncements } from '@/hooks/useAnnouncements'
import { announcementsAPI, eventsAPI, projectsAPI } from '@/services/api'
import { FormToggleRow } from '@/components/toggle/FormToggleRow'
import AnnouncementPost from './AnnouncementPost'
import { formatPeriods } from './announcementAvailability'
import '@/components/modal/modal.css'
import '@/components/toggle/toggle.css'
import './AnnouncementsManagementPage.css'

interface AnnouncementCreatedBy {
    id: number
    fullName: string
    profilePhotoUrl?: string | null
}

interface AnnouncementEvent {
    id: number
    title: string
}

interface AnnouncementProject {
    id: number
    title: string
}

interface AnnouncementItem {
    id: number
    title: string
    body: string
    targetType: 'NONE' | 'EVENT' | 'PROJECT'
    eventId?: number | null
    projectId?: number | null
    isPinned: boolean
    isActive: boolean
    createdAt: string
    createdBy: AnnouncementCreatedBy
    event: AnnouncementEvent | null
    project: AnnouncementProject | null
}

interface EntityOption {
    id: number
    title: string
}

interface AnnouncementResponseRow {
    id: number
    status: string
    notes: string | null
    member: { id: number; fullName: string }
    periods: Array<{ start: string; end: string }>
}

type TargetType = 'NONE' | 'EVENT' | 'PROJECT'

function getErrorMessage(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) {
        return error.message
    }
    return fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null
}

function statusLabel(status: string): string {
    if (status === 'AVAILABLE') return 'Available'
    if (status === 'UNAVAILABLE') return 'Not available'
    return status
}

function statusBadgeClass(status: string): string {
    if (status === 'AVAILABLE') return 'badge badge-lifecycle-finalized'
    if (status === 'UNAVAILABLE') return 'badge badge-lifecycle-inactive'
    return 'badge badge-lifecycle-archived'
}

function parseAnnouncement(raw: unknown): AnnouncementItem | null {
    if (!isRecord(raw) || typeof raw.id !== 'number') return null
    if (typeof raw.title !== 'string' || typeof raw.body !== 'string') return null

    const targetType: TargetType =
        raw.targetType === 'EVENT' || raw.targetType === 'PROJECT' || raw.targetType === 'NONE'
            ? raw.targetType
            : 'NONE'

    const createdBy = isRecord(raw.createdBy)
        ? {
              id: typeof raw.createdBy.id === 'number' ? raw.createdBy.id : 0,
              fullName:
                  typeof raw.createdBy.fullName === 'string' ? raw.createdBy.fullName : 'Unknown',
              profilePhotoUrl:
                  typeof raw.createdBy.profilePhotoUrl === 'string'
                      ? raw.createdBy.profilePhotoUrl
                      : null,
          }
        : { id: 0, fullName: 'Unknown' }

    let event: AnnouncementEvent | null = null
    if (isRecord(raw.event) && typeof raw.event.id === 'number' && typeof raw.event.title === 'string') {
        event = { id: raw.event.id, title: raw.event.title }
    }

    let project: AnnouncementProject | null = null
    if (
        isRecord(raw.project) &&
        typeof raw.project.id === 'number' &&
        typeof raw.project.title === 'string'
    ) {
        project = { id: raw.project.id, title: raw.project.title }
    }

    const createdAt =
        typeof raw.createdAt === 'string'
            ? raw.createdAt
            : raw.createdAt instanceof Date
              ? raw.createdAt.toISOString()
              : ''

    return {
        id: raw.id,
        title: raw.title,
        body: raw.body,
        targetType,
        eventId: typeof raw.eventId === 'number' ? raw.eventId : event?.id ?? null,
        projectId: typeof raw.projectId === 'number' ? raw.projectId : project?.id ?? null,
        isPinned: Boolean(raw.isPinned),
        isActive: raw.isActive !== false,
        createdAt,
        createdBy,
        event,
        project,
    }
}

function parseResponses(raw: unknown): AnnouncementResponseRow[] {
    if (!Array.isArray(raw)) return []
    return raw.flatMap((entry) => {
        if (!isRecord(entry) || typeof entry.id !== 'number') return []
        const member = isRecord(entry.member)
            ? {
                  id: typeof entry.member.id === 'number' ? entry.member.id : 0,
                  fullName:
                      typeof entry.member.fullName === 'string'
                          ? entry.member.fullName
                          : 'Unknown',
              }
            : { id: 0, fullName: 'Unknown' }
        const periods = Array.isArray(entry.periods)
            ? entry.periods
                  .filter(isRecord)
                  .map((p) => {
                      const startRaw = p.startDate ?? p.start
                      const endRaw = p.endDate ?? p.end
                      const start =
                          typeof startRaw === 'string'
                              ? startRaw
                              : startRaw instanceof Date
                                ? startRaw.toISOString()
                                : ''
                      const end =
                          typeof endRaw === 'string'
                              ? endRaw
                              : endRaw instanceof Date
                                ? endRaw.toISOString()
                                : ''
                      return { start, end }
                  })
                  .filter((p) => p.start && p.end)
            : []
        return [
            {
                id: entry.id,
                status: typeof entry.status === 'string' ? entry.status : '',
                notes: typeof entry.notes === 'string' ? entry.notes : null,
                member,
                periods,
            },
        ]
    })
}

interface AnnouncementFormState {
    title: string
    body: string
    targetType: TargetType
    eventId: string
    projectId: string
    isPinned: boolean
}

const EMPTY_FORM: AnnouncementFormState = {
    title: '',
    body: '',
    targetType: 'NONE',
    eventId: '',
    projectId: '',
    isPinned: false,
}

function AnnouncementFormModal({
    mode,
    initial,
    onClose,
    onSaved,
}: {
    mode: 'create' | 'edit'
    initial: AnnouncementItem | null
    onClose: () => void
    onSaved: () => Promise<void>
}) {
    const [form, setForm] = useState<AnnouncementFormState>(() =>
        initial
            ? {
                  title: initial.title,
                  body: initial.body,
                  targetType: initial.targetType,
                  eventId: initial.eventId != null ? String(initial.eventId) : '',
                  projectId: initial.projectId != null ? String(initial.projectId) : '',
                  isPinned: initial.isPinned,
              }
            : EMPTY_FORM,
    )
    const [events, setEvents] = useState<EntityOption[]>([])
    const [projects, setProjects] = useState<EntityOption[]>([])
    const [loadingOptions, setLoadingOptions] = useState(false)
    const [saving, setSaving] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        let active = true
        const load = async () => {
            setLoadingOptions(true)
            try {
                const [eventsResult, projectsResult] = await Promise.all([
                    eventsAPI.getAll({}),
                    projectsAPI.getAll({ isActive: true }),
                ])
                if (!active) return
                setEvents(
                    eventsResult.map((e) => ({ id: Number(e.id), title: e.title })).filter((e) => e.id),
                )
                setProjects(
                    projectsResult
                        .map((p) => ({ id: Number(p.id), title: p.title }))
                        .filter((p) => p.id),
                )
            } catch (err) {
                if (active) {
                    setError(getErrorMessage(err, 'Failed to load event/project options'))
                }
            } finally {
                if (active) setLoadingOptions(false)
            }
        }
        void load()
        return () => {
            active = false
        }
    }, [])

    function validate(): boolean {
        const next: Record<string, string> = {}
        if (!form.title.trim()) next.title = 'Title is required'
        if (!form.body.trim()) next.body = 'Body is required'
        if (form.targetType === 'EVENT' && !form.eventId) {
            next.eventId = 'Event is required'
        }
        if (form.targetType === 'PROJECT' && !form.projectId) {
            next.projectId = 'Project is required'
        }
        setFieldErrors(next)
        return Object.keys(next).length === 0
    }

    async function handleSubmit(e: FormEvent) {
        e.preventDefault()
        if (!validate()) return

        setSaving(true)
        setError(null)
        const payload = {
            title: form.title.trim(),
            body: form.body.trim(),
            targetType: form.targetType,
            eventId: form.targetType === 'EVENT' ? Number(form.eventId) : null,
            projectId: form.targetType === 'PROJECT' ? Number(form.projectId) : null,
            isPinned: form.isPinned,
        }

        try {
            if (mode === 'edit' && initial) {
                await announcementsAPI.update(initial.id, payload)
            } else {
                await announcementsAPI.create(payload)
            }
            await onSaved()
            onClose()
        } catch (err) {
            setError(
                getErrorMessage(
                    err,
                    mode === 'edit' ? 'Failed to update announcement' : 'Failed to create announcement',
                ),
            )
        } finally {
            setSaving(false)
        }
    }

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container">
                <div className="modal-header">
                    <h2 className="modal-title">
                        {mode === 'edit' ? 'Edit Announcement' : 'New Announcement'}
                    </h2>
                    <button className="modal-close-btn" onClick={onClose} type="button">
                        <X />
                    </button>
                </div>

                <form onSubmit={(e) => void handleSubmit(e)}>
                    <div className="modal-body">
                        {error ? <div className="error-message">{error}</div> : null}

                        <div className="form-group">
                            <label htmlFor="announcement-title" className="form-label">
                                Title *
                            </label>
                            <input
                                id="announcement-title"
                                className={`form-input ${fieldErrors.title ? 'error' : ''}`}
                                value={form.title}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, title: e.target.value }))
                                }
                                disabled={saving}
                            />
                            {fieldErrors.title ? (
                                <span className="field-error">{fieldErrors.title}</span>
                            ) : null}
                        </div>

                        <div className="form-group">
                            <label htmlFor="announcement-body" className="form-label">
                                Body *
                            </label>
                            <textarea
                                id="announcement-body"
                                className={`form-input ${fieldErrors.body ? 'error' : ''}`}
                                rows={5}
                                value={form.body}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, body: e.target.value }))
                                }
                                disabled={saving}
                            />
                            {fieldErrors.body ? (
                                <span className="field-error">{fieldErrors.body}</span>
                            ) : null}
                        </div>

                        <div className="form-group">
                            <label htmlFor="announcement-target" className="form-label">
                                Target
                            </label>
                            <select
                                id="announcement-target"
                                className="form-input"
                                value={form.targetType}
                                onChange={(e) => {
                                    const targetType = e.target.value as TargetType
                                    setForm((prev) => ({
                                        ...prev,
                                        targetType,
                                        eventId: targetType === 'EVENT' ? prev.eventId : '',
                                        projectId: targetType === 'PROJECT' ? prev.projectId : '',
                                    }))
                                }}
                                disabled={saving}
                            >
                                <option value="NONE">None</option>
                                <option value="EVENT">Event</option>
                                <option value="PROJECT">Project</option>
                            </select>
                        </div>

                        {form.targetType === 'EVENT' ? (
                            <div className="form-group">
                                <label htmlFor="announcement-event" className="form-label">
                                    Event *
                                </label>
                                <select
                                    id="announcement-event"
                                    className={`form-input ${fieldErrors.eventId ? 'error' : ''}`}
                                    value={form.eventId}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, eventId: e.target.value }))
                                    }
                                    disabled={saving || loadingOptions}
                                >
                                    <option value="">Select an event</option>
                                    {events.map((event) => (
                                        <option key={event.id} value={event.id}>
                                            {event.title}
                                        </option>
                                    ))}
                                </select>
                                {fieldErrors.eventId ? (
                                    <span className="field-error">{fieldErrors.eventId}</span>
                                ) : null}
                            </div>
                        ) : null}

                        {form.targetType === 'PROJECT' ? (
                            <div className="form-group">
                                <label htmlFor="announcement-project" className="form-label">
                                    Project *
                                </label>
                                <select
                                    id="announcement-project"
                                    className={`form-input ${fieldErrors.projectId ? 'error' : ''}`}
                                    value={form.projectId}
                                    onChange={(e) =>
                                        setForm((prev) => ({ ...prev, projectId: e.target.value }))
                                    }
                                    disabled={saving || loadingOptions}
                                >
                                    <option value="">Select a project</option>
                                    {projects.map((project) => (
                                        <option key={project.id} value={project.id}>
                                            {project.title}
                                        </option>
                                    ))}
                                </select>
                                {fieldErrors.projectId ? (
                                    <span className="field-error">{fieldErrors.projectId}</span>
                                ) : null}
                            </div>
                        ) : null}

                        <FormToggleRow
                            label="Pin announcement"
                            checked={form.isPinned}
                            onChange={(checked) =>
                                setForm((prev) => ({ ...prev, isPinned: checked }))
                            }
                            disabled={saving}
                        />
                    </div>

                    <div className="modal-footer">
                        <button
                            type="button"
                            className="btn btn-secondary"
                            onClick={onClose}
                            disabled={saving}
                        >
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving
                                ? mode === 'edit'
                                    ? 'Saving…'
                                    : 'Creating…'
                                : mode === 'edit'
                                  ? 'Save'
                                  : 'Create'}
                        </button>
                    </div>
                </form>
            </div>
        </>
    )
}

function ResponsesModal({
    announcement,
    onClose,
}: {
    announcement: AnnouncementItem
    onClose: () => void
}) {
    const [responses, setResponses] = useState<AnnouncementResponseRow[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let active = true
        const load = async () => {
            setLoading(true)
            setError(null)
            try {
                const data = await announcementsAPI.getResponses(announcement.id)
                if (!active) return
                setResponses(parseResponses(data))
            } catch (err) {
                if (active) {
                    setError(getErrorMessage(err, 'Failed to load responses'))
                    setResponses([])
                }
            } finally {
                if (active) setLoading(false)
            }
        }
        void load()
        return () => {
            active = false
        }
    }, [announcement.id])

    return (
        <>
            <div className="modal-backdrop" onClick={onClose} />
            <div className="modal-container">
                <div className="modal-header">
                    <h2 className="modal-title">Responses — {announcement.title}</h2>
                    <button className="modal-close-btn" onClick={onClose} type="button">
                        <X />
                    </button>
                </div>
                <div className="modal-body">
                    {loading ? (
                        <div className="empty-message">Loading responses…</div>
                    ) : error ? (
                        <p className="error-message">{error}</p>
                    ) : (
                        <div className="members-table-shell">
                            {responses.length === 0 ? (
                                <div className="empty-state">
                                    <Users className="empty-state-icon" />
                                    <h4 className="empty-state-title">No responses yet</h4>
                                    <p className="empty-state-text">
                                        Responses will appear here when members reply.
                                    </p>
                                </div>
                            ) : (
                                <div className="table-container">
                                    <table className="members-table">
                                        <thead>
                                            <tr>
                                                <th>Member</th>
                                                <th>Status</th>
                                                <th>Availability</th>
                                                <th>Notes</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {responses.map((row, index) => (
                                                <tr
                                                    key={row.id}
                                                    className={index % 2 === 0 ? 'even-row' : 'odd-row'}
                                                >
                                                    <td>{row.member.fullName}</td>
                                                    <td>
                                                        <span className={statusBadgeClass(row.status)}>
                                                            {statusLabel(row.status)}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        {row.periods.length > 0
                                                            ? formatPeriods(row.periods)
                                                            : '—'}
                                                    </td>
                                                    <td>{row.notes?.trim() ? row.notes : '—'}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    )}
                </div>
                <div className="modal-footer">
                    <button type="button" className="btn btn-secondary" onClick={onClose}>
                        Close
                    </button>
                </div>
            </div>
        </>
    )
}

export default function AnnouncementsManagementPage() {
    const { announcements, loading, error, refetch } = useAnnouncements(true)
    const [formOpen, setFormOpen] = useState(false)
    const [editing, setEditing] = useState<AnnouncementItem | null>(null)
    const [responsesFor, setResponsesFor] = useState<AnnouncementItem | null>(null)
    const [actionError, setActionError] = useState<string | null>(null)
    const [busyId, setBusyId] = useState<number | null>(null)

    const items = announcements
        .map(parseAnnouncement)
        .filter((item): item is AnnouncementItem => item !== null)

    async function handlePin(item: AnnouncementItem) {
        setBusyId(item.id)
        setActionError(null)
        try {
            await announcementsAPI.setPinned(item.id, !item.isPinned)
            await refetch()
        } catch (err) {
            setActionError(getErrorMessage(err, 'Failed to update pin'))
        } finally {
            setBusyId(null)
        }
    }

    async function handleDeactivate(item: AnnouncementItem) {
        setBusyId(item.id)
        setActionError(null)
        try {
            await announcementsAPI.deactivate(item.id)
            await refetch()
        } catch (err) {
            setActionError(getErrorMessage(err, 'Failed to deactivate announcement'))
        } finally {
            setBusyId(null)
        }
    }

    async function handleReactivate(item: AnnouncementItem) {
        setBusyId(item.id)
        setActionError(null)
        try {
            await announcementsAPI.reactivate(item.id)
            await refetch()
        } catch (err) {
            setActionError(getErrorMessage(err, 'Failed to reactivate announcement'))
        } finally {
            setBusyId(null)
        }
    }

    function openCreate() {
        setEditing(null)
        setFormOpen(true)
    }

    return (
        <div className="announcements-page">
            <div className="page-header">
                <h1 className="members-page-title members-page-title-inline">Announcements</h1>
            </div>
            <hr className="title-divider" />

            {actionError ? (
                <div className="projects-error" role="alert">
                    {actionError}
                </div>
            ) : null}

            {loading ? (
                <div className="empty-message">Loading announcements…</div>
            ) : error ? (
                <div className="projects-error">{error}</div>
            ) : items.length === 0 ? (
                <div className="empty-state">
                    <Megaphone className="empty-state-icon" />
                    <h4 className="empty-state-title">No announcements yet</h4>
                    <p className="empty-state-text">
                        Create your first announcement to get started.
                    </p>
                    <button type="button" className="empty-state-btn" onClick={openCreate}>
                        <Plus />
                        New Announcement
                    </button>
                </div>
            ) : (
                <div className="announcements-grid">
                    {items.map((item) => (
                        <AnnouncementPost
                            key={item.id}
                            title={item.title}
                            body={item.body}
                            createdAt={item.createdAt}
                            createdBy={item.createdBy}
                            targetType={item.targetType}
                            event={item.event}
                            project={item.project}
                            isPinned={item.isPinned}
                            isActive={item.isActive}
                            footer={
                                <div className="announcement-post-actions">
                                    <button
                                        type="button"
                                        className="announcement-post-action announcement-post-action--edit"
                                        disabled={busyId === item.id}
                                        onClick={() => {
                                            setEditing(item)
                                            setFormOpen(true)
                                        }}
                                    >
                                        <Pencil size={15} aria-hidden />
                                        Edit
                                    </button>
                                    <button
                                        type="button"
                                        className="announcement-post-action announcement-post-action--pin"
                                        disabled={busyId === item.id}
                                        onClick={() => void handlePin(item)}
                                    >
                                        <Pin size={15} aria-hidden />
                                        {item.isPinned ? 'Unpin' : 'Pin'}
                                    </button>
                                    <button
                                        type="button"
                                        className="announcement-post-action announcement-post-action--responses"
                                        disabled={busyId === item.id}
                                        onClick={() => setResponsesFor(item)}
                                    >
                                        <Users size={15} aria-hidden />
                                        Responses
                                    </button>
                                    {item.isActive ? (
                                        <button
                                            type="button"
                                            className="announcement-post-action announcement-post-action--deactivate"
                                            disabled={busyId === item.id}
                                            onClick={() => void handleDeactivate(item)}
                                        >
                                            <PauseCircle size={15} aria-hidden />
                                            Deactivate
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            className="announcement-post-action announcement-post-action--reactivate"
                                            disabled={busyId === item.id}
                                            onClick={() => void handleReactivate(item)}
                                        >
                                            <PlayCircle size={15} aria-hidden />
                                            Reactivate
                                        </button>
                                    )}
                                </div>
                            }
                        />
                    ))}
                    <div
                        className="announcements-add-card"
                        onClick={openCreate}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(event) => event.key === 'Enter' && openCreate()}
                    >
                        <Plus className="announcements-add-card-icon" />
                        <span className="announcements-add-card-text">New Announcement</span>
                    </div>
                </div>
            )}

            {formOpen ? (
                <AnnouncementFormModal
                    mode={editing ? 'edit' : 'create'}
                    initial={editing}
                    onClose={() => {
                        setFormOpen(false)
                        setEditing(null)
                    }}
                    onSaved={refetch}
                />
            ) : null}

            {responsesFor ? (
                <ResponsesModal announcement={responsesFor} onClose={() => setResponsesFor(null)} />
            ) : null}
        </div>
    )
}
