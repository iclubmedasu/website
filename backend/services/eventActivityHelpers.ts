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

export function formatAssignmentSlot(startDateTime: Date, endDateTime: Date): string {
    const dateOptions: Intl.DateTimeFormatOptions = { year: 'numeric', month: 'short', day: 'numeric' };
    const timeOptions: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
    const startDate = startDateTime.toLocaleDateString([], dateOptions);
    const endDate = endDateTime.toLocaleDateString([], dateOptions);
    const startTime = startDateTime.toLocaleTimeString([], timeOptions);
    const endTime = endDateTime.toLocaleTimeString([], timeOptions);

    if (startDate === endDate) {
        return `${startDate}, ${startTime} – ${endTime}`;
    }

    return `${startDate}, ${startTime} – ${endDate}, ${endTime}`;
}

export function buildAssignmentActivityValue(assignment: AssignmentActivityInput) {
    return {
        memberId: assignment.memberId,
        memberName: getAssignmentMemberName(assignment),
        startDateTime: assignment.startDateTime,
        endDateTime: assignment.endDateTime,
    };
}

export function buildAssignedDescription(taskTitle: string, assignment: AssignmentActivityInput): string {
    const memberName = getAssignmentMemberName(assignment);
    const slot = formatAssignmentSlot(assignment.startDateTime, assignment.endDateTime);
    return `Assigned ${memberName} to "${taskTitle}" (${slot})`;
}

export function buildUnassignedDescription(taskTitle: string, assignment: AssignmentActivityInput): string {
    const memberName = getAssignmentMemberName(assignment);
    return `Unassigned ${memberName} from "${taskTitle}"`;
}
