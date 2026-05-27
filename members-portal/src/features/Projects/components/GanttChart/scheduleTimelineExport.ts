function getDateOrNull(value: any): Date | null {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

function normalizeLabelValue(value: any) {
    return String(value ?? '').trim();
}

function uniqueSlots(slots: any[] = []) {
    const seen = new Set<any>();

    return slots.filter((slot) => {
        const key = slot?.id ?? `${slot?.member?.id ?? 'member'}-${slot?.task?.id ?? 'task'}-${slot?.startDateTime ?? ''}-${slot?.endDateTime ?? ''}-${slot?.title ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
}

export function getScheduleMemberLabel(slot: any) {
    const fullName = normalizeLabelValue(slot?.member?.fullName);
    if (fullName) return fullName;

    return 'Unknown member';
}

export function getScheduleSlotLabel(slot: any) {
    return normalizeLabelValue(slot?.title || slot?.task?.title || 'Time slot');
}

export function collectScheduleTimelineSlots(projectDetail: any, allTaskNodes: any[] = []) {
    const slotSources = [
        ...(projectDetail?.scheduleSlots || []),
        ...allTaskNodes.flatMap((node) => node.data?.scheduleSlots || []),
    ];

    return uniqueSlots(slotSources).filter((slot) => getDateOrNull(slot?.startDateTime) && getDateOrNull(slot?.endDateTime));
}

export function groupScheduleSlotsByMember(slots: any[] = []) {
    const groups = new Map<any, any>();

    for (const slot of slots) {
        const key = slot?.member?.id ?? slot?.memberId ?? slot?.id ?? `slot-${slot?.id}`;
        const label = getScheduleMemberLabel(slot);

        if (!groups.has(key)) {
            groups.set(key, { key, label, slots: [] });
        }

        const group = groups.get(key);
        if (!group.label || group.label === 'Unknown member') {
            group.label = label;
        }

        group.slots.push(slot);
    }

    return [...groups.values()]
        .map((group) => ({
            ...group,
            slots: group.slots.sort((a: any, b: any) => {
                const startA = getDateOrNull(a.startDateTime)?.getTime() ?? 0;
                const startB = getDateOrNull(b.startDateTime)?.getTime() ?? 0;
                return startA - startB;
            }),
        }))
        .sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''));
}