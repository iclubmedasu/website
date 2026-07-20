import { CLUB_TIMEZONE, formatDateRange } from '@iclub/shared/utils';

export type AssignmentActivityInput = {
    memberId: number;
    startDateTime: Date;
    endDateTime: Date;
    member?: { fullName?: string | null } | null;
};

export function getAssignmentMemberName(assignment: AssignmentActivityInput): string {
    const name = String(assignment.member?.fullName || '').trim();
    return name || `Member #${assignment.memberId}`;
}

export function formatAssignmentSlot(
    startDateTime: Date,
    endDateTime: Date,
    timeZone: string = CLUB_TIMEZONE,
): string {
    return formatDateRange(startDateTime, endDateTime, { timeZone });
}

export function buildAssignmentActivityValue(assignment: AssignmentActivityInput) {
    return {
        memberId: assignment.memberId,
        memberName: getAssignmentMemberName(assignment),
        startDateTime: assignment.startDateTime,
        endDateTime: assignment.endDateTime,
    };
}

export function buildAssignedDescription(
    taskTitle: string,
    assignment: AssignmentActivityInput,
    timeZone: string = CLUB_TIMEZONE,
): string {
    const memberName = getAssignmentMemberName(assignment);
    const slot = formatAssignmentSlot(assignment.startDateTime, assignment.endDateTime, timeZone);
    return `Assigned ${memberName} to "${taskTitle}" (${slot})`;
}

export function buildUnassignedDescription(taskTitle: string, assignment: AssignmentActivityInput): string {
    const memberName = getAssignmentMemberName(assignment);
    return `Unassigned ${memberName} from "${taskTitle}"`;
}
