import { useRef, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { eventsAPI } from '@/services/api';
import type {
    CreateEventCustomFieldPayload,
    EventCustomFieldRef,
    Id,
    ReorderEventCustomFieldsPayload,
    UpdateEventCustomFieldPayload,
} from '@/types/backend-contracts';

const FIELD_TYPES = ['text', 'dropdown', 'checkbox', 'number'] as const;

interface EventFormBuilderSectionProps {
    eventId: Id | string;
    fields: EventCustomFieldRef[];
    onFieldsChange: (fields: EventCustomFieldRef[]) => void;
}

export default function EventFormBuilderSection({ eventId, fields, onFieldsChange }: EventFormBuilderSectionProps) {
    const [fieldLabel, setFieldLabel] = useState('');
    const [fieldType, setFieldType] = useState<(typeof FIELD_TYPES)[number]>('text');
    const [fieldOptions, setFieldOptions] = useState('');
    const [fieldRequired, setFieldRequired] = useState(false);
    const dragFieldId = useRef<number | null>(null);

    const handleCreateField = async () => {
        const payload: CreateEventCustomFieldPayload = {
            label: fieldLabel.trim(),
            type: fieldType,
            options: fieldType === 'dropdown' ? fieldOptions.split('\n').map((option) => option.trim()).filter(Boolean) : undefined,
            required: fieldRequired,
        };
        const created = await eventsAPI.createCustomField(eventId, payload);
        onFieldsChange([...fields, created]);
        setFieldLabel('');
        setFieldType('text');
        setFieldOptions('');
        setFieldRequired(false);
    };

    const handleUpdateField = async (field: EventCustomFieldRef, patch: UpdateEventCustomFieldPayload) => {
        const updated = await eventsAPI.updateCustomField(eventId, field.id, patch);
        onFieldsChange(fields.map((item) => (item.id === updated.id ? updated : item)));
    };

    const handleRemoveField = async (fieldId: number) => {
        await eventsAPI.removeCustomField(eventId, fieldId);
        onFieldsChange(fields.filter((item) => item.id !== fieldId));
    };

    const moveField = async (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= fields.length || fromIndex === toIndex) return;
        const next = [...fields];
        const [moved] = next.splice(fromIndex, 1);
        next.splice(toIndex, 0, moved);
        onFieldsChange(next.map((field, index) => ({ ...field, order: index })));
        const payload: ReorderEventCustomFieldsPayload = {
            order: next.map((field, index) => ({ id: field.id, order: index })),
        };
        await eventsAPI.reorderCustomFields(eventId, payload);
    };

    return (
        <section className="event-expanded-panel">
            <h2 className="expanded-section-title">Registration Form Builder</h2>
            <div className="event-expanded-stack event-expanded-stack--small">
                {['Name', 'Email', 'Phone'].map((label) => (
                    <div key={label} className="event-expanded-list-item event-expanded-list-item--muted">
                        <strong>{label}</strong>
                        <span className="event-expanded-muted">Locked default field</span>
                    </div>
                ))}
            </div>
            <div className="event-expanded-stack event-expanded-stack--spaced">
                {fields.map((field, index) => (
                    <div
                        key={field.id}
                        draggable
                        onDragStart={() => { dragFieldId.current = Number(field.id); }}
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={async () => {
                            const fromIndex = fields.findIndex((item) => Number(item.id) === dragFieldId.current);
                            dragFieldId.current = null;
                            if (fromIndex >= 0) await moveField(fromIndex, index);
                        }}
                        className="event-expanded-list-item"
                    >
                        <div>
                            <strong>{field.label}</strong>
                            <p className="event-expanded-muted">{field.type}{field.required ? ' · Required' : ''}</p>
                        </div>
                        <div className="event-expanded-inline-actions">
                            <button type="button" onClick={() => void moveField(index, Math.max(0, index - 1))} className="btn btn-secondary" aria-label="Move field up"><ChevronUp size={16} /></button>
                            <button type="button" onClick={() => void moveField(index, Math.min(fields.length - 1, index + 1))} className="btn btn-secondary" aria-label="Move field down"><ChevronDown size={16} /></button>
                            <button type="button" onClick={() => void handleUpdateField(field, { required: !field.required })} className="btn btn-secondary">{field.required ? 'Unset required' : 'Required'}</button>
                            <button type="button" onClick={() => void handleRemoveField(Number(field.id))} className="btn btn-danger">Delete</button>
                        </div>
                    </div>
                ))}
            </div>
            <div className="event-expanded-stack event-expanded-stack--spaced">
                <input value={fieldLabel} onChange={(e) => setFieldLabel(e.target.value)} placeholder="Field label" className="form-input" />
                <select aria-label="Field type" value={fieldType} onChange={(e) => setFieldType(e.target.value as typeof fieldType)} className="form-input">
                    {FIELD_TYPES.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                {fieldType === 'dropdown' && (
                    <textarea value={fieldOptions} onChange={(e) => setFieldOptions(e.target.value)} placeholder="One option per line" className="form-input form-textarea" />
                )}
                <label className="event-expanded-checkbox-row">
                    <input type="checkbox" checked={fieldRequired} onChange={(e) => setFieldRequired(e.target.checked)} />
                    Required
                </label>
                <button type="button" onClick={() => void handleCreateField()} className="btn btn-primary">Add field</button>
            </div>
        </section>
    );
}
