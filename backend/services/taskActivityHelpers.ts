export type MemberLike = { fullName?: string | null } | null | undefined;

export function getTaskMemberName(memberId: number, member?: MemberLike): string {
    const name = String(member?.fullName || '').trim();
    return name || `Member #${memberId}`;
}

export function formatTaskAssignmentStatus(status: string): string {
    const labels: Record<string, string> = {
        ASSIGNED: 'Assigned',
        ACCEPTED: 'Accepted',
        IN_PROGRESS: 'In Progress',
        COMPLETED: 'Completed',
    };
    return labels[String(status || '').toUpperCase()] || status;
}

export function buildTaskAssignedActivityValue(input: {
    memberId: number;
    member?: MemberLike;
    taskTitle: string;
}) {
    return {
        memberId: input.memberId,
        memberName: getTaskMemberName(input.memberId, input.member),
        taskTitle: input.taskTitle,
    };
}

export function buildTaskAssignedDescription(taskTitle: string, memberId: number, member?: MemberLike): string {
    const memberName = getTaskMemberName(memberId, member);
    return `Assigned ${memberName} to "${taskTitle}"`;
}

export function buildTaskSelfAssignedDescription(taskTitle: string, memberId: number, member?: MemberLike): string {
    const memberName = getTaskMemberName(memberId, member);
    return `${memberName} self-assigned to "${taskTitle}"`;
}

export function buildTaskUnassignedActivityValue(memberId: number, member?: MemberLike, taskTitle?: string) {
    return {
        memberId,
        memberName: getTaskMemberName(memberId, member),
        ...(taskTitle ? { taskTitle } : {}),
    };
}

export function buildTaskUnassignedDescription(taskTitle: string, memberId: number, member?: MemberLike): string {
    const memberName = getTaskMemberName(memberId, member);
    return `Unassigned ${memberName} from "${taskTitle}"`;
}

export function buildAssignmentStatusChangedValue(
    memberId: number,
    member: MemberLike,
    oldStatus: string,
    newStatus: string,
) {
    return {
        memberId,
        memberName: getTaskMemberName(memberId, member),
        status: newStatus,
        previousStatus: oldStatus,
    };
}

export function buildAssignmentStatusChangedDescription(
    memberId: number,
    member: MemberLike,
    oldStatus: string,
    newStatus: string,
): string {
    const memberName = getTaskMemberName(memberId, member);
    return `${memberName} assignment status changed from ${formatTaskAssignmentStatus(oldStatus)} to ${formatTaskAssignmentStatus(newStatus)}`;
}

export function buildCommentedDescription(memberId: number, member?: MemberLike): string {
    const memberName = getTaskMemberName(memberId, member);
    return `Comment added by ${memberName}`;
}

export function buildDependencyAddedValue(
    dependsOnTaskId: number,
    dependsOnTaskTitle: string,
    dependencyType: string,
) {
    return { dependsOnTaskId, dependsOnTaskTitle, dependencyType };
}

export function buildDependencyAddedDescription(dependsOnTaskTitle: string): string {
    return `Dependency added on "${dependsOnTaskTitle}"`;
}

export function buildDependencyRemovedValue(dependsOnTaskId: number, dependsOnTaskTitle: string) {
    return { dependsOnTaskId, dependsOnTaskTitle };
}

export function buildDependencyRemovedDescription(dependsOnTaskTitle: string): string {
    return `Dependency removed from "${dependsOnTaskTitle}"`;
}

export function buildScheduleSlotActivityValue(slot: {
    memberId: number;
    member?: MemberLike;
    taskId?: number | null;
    task?: { title?: string | null } | null;
    title?: string | null;
    startDateTime?: Date;
    endDateTime?: Date;
    notes?: string | null;
}) {
    return {
        memberId: slot.memberId,
        memberName: getTaskMemberName(slot.memberId, slot.member),
        ...(slot.taskId != null ? { taskId: slot.taskId } : {}),
        ...(slot.task?.title ? { taskTitle: slot.task.title } : {}),
        ...(slot.title ? { title: slot.title } : {}),
        ...(slot.startDateTime ? { startDateTime: slot.startDateTime } : {}),
        ...(slot.endDateTime ? { endDateTime: slot.endDateTime } : {}),
        ...(slot.notes ? { notes: slot.notes } : {}),
    };
}

export function enrichScheduleSlotChangePayload(
    payload: Record<string, unknown> | null | undefined,
    memberId: number,
    member?: MemberLike,
    taskTitle?: string | null,
): Record<string, unknown> | null | undefined {
    if (!payload || typeof payload !== 'object') return payload;

    return {
        ...payload,
        memberName: getTaskMemberName(Number(payload.memberId ?? memberId), member),
        ...(taskTitle ? { taskTitle } : {}),
    };
}
