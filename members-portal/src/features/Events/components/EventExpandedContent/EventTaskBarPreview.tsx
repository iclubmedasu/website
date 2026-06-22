'use client';

import { Trash2, X } from 'lucide-react';
import { getProfilePhotoUrl } from '@/services/api';
import type { EventTaskRef } from '@/types/backend-contracts';
import type { PreviewPosition } from '@/features/Events/components/eventTaskTimeUtils';
import type { RemoveAssignmentTarget, TimetableBar } from './EventTasksTimetable';

interface EventTaskBarPreviewProps {
    task: EventTaskRef;
    bar: TimetableBar;
    position: PreviewPosition;
    canManage: boolean;
    onClose: () => void;
    onRemoveAssignment: (target: RemoveAssignmentTarget) => void;
}

export default function EventTaskBarPreview({
    task,
    bar,
    position,
    canManage,
    onClose,
    onRemoveAssignment,
}: EventTaskBarPreviewProps) {
    const assigneeLabel = `${bar.members.length} assignee${bar.members.length === 1 ? '' : 's'} in this slot`;

    return (
        <div
            className={`ett-preview-popover ett-preview-popover--${position.placement}`}
            style={{
                left: `${position.left}px`,
                top: `${position.top}px`,
                width: `${position.width}px`,
            }}
            onClick={(event) => event.stopPropagation()}
        >
            <div className="ett-preview-body">
                <div className="ett-preview-header">
                    <div className="ett-preview-heading">
                        <span className="ett-preview-kind">Event task</span>
                        <h4 className="ett-preview-title">{bar.title}</h4>
                    </div>
                    <button
                        type="button"
                        className="ett-preview-close"
                        onClick={onClose}
                        aria-label="Close task preview"
                    >
                        <X size={12} />
                    </button>
                </div>

                <div className="ett-preview-meta">
                    <span className="ett-preview-pill">{task.location}</span>
                </div>

                <div className="ett-preview-range">
                    <span className="ett-preview-range-label">Time</span>
                    <strong className="ett-preview-range-value">{bar.timeLabel}</strong>
                </div>

                {task.description?.trim() && (
                    <div className="ett-preview-description">
                        <span className="ett-preview-description-label">Description</span>
                        <p className="ett-preview-description-text">{task.description.trim()}</p>
                    </div>
                )}

                <div className="ett-preview-summary">{assigneeLabel}</div>
            </div>

            <div className="ett-preview-schedule">
                <ul className="ett-preview-assignees-list">
                    {bar.members.map((member) => {
                        const assignmentMember = task.assignments?.find(
                            (assignment) => Number(assignment.id) === member.assignmentId,
                        )?.member;
                        const memberName = assignmentMember?.fullName ?? member.memberName;
                        const photoUrl = assignmentMember?.profilePhotoUrl
                            ? getProfilePhotoUrl(assignmentMember.id)
                            : null;

                        return (
                            <li key={member.assignmentId} className="ett-preview-assignee-item">
                                <div className="ett-preview-assignee-main">
                                    <span
                                        className={`ett-preview-assignee-avatar${photoUrl ? '' : ' ett-preview-assignee-avatar--solid'}`}
                                    >
                                        {photoUrl ? (
                                            <img src={photoUrl} alt="" />
                                        ) : (
                                            memberName.charAt(0).toUpperCase()
                                        )}
                                    </span>
                                    <span className="ett-preview-assignee-name" title={memberName}>
                                        {member.isLeader ? '★ ' : ''}{memberName}
                                    </span>
                                </div>
                                {canManage && (
                                    <button
                                        type="button"
                                        className="ett-preview-assignee-remove"
                                        onClick={() => onRemoveAssignment({
                                            taskId: bar.taskId,
                                            assignmentId: member.assignmentId,
                                            taskTitle: bar.title,
                                            memberName,
                                        })}
                                        aria-label={`Remove ${memberName} from ${bar.title}`}
                                    >
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </li>
                        );
                    })}
                </ul>
            </div>
        </div>
    );
}
