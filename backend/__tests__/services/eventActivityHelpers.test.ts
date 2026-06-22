import { describe, expect, it } from 'vitest'
import {
    buildAssignedDescription,
    buildAssignmentActivityValue,
    buildUnassignedDescription,
} from '../../services/eventActivityHelpers'

describe('eventActivityHelpers', () => {
    const assignment = {
        memberId: 7,
        member: { fullName: 'Jane Doe' },
        startDateTime: new Date('2026-06-30T10:00:00.000Z'),
        endDateTime: new Date('2026-06-30T12:00:00.000Z'),
    }

    it('builds assignment activity value with member name', () => {
        expect(buildAssignmentActivityValue(assignment)).toEqual({
            memberId: 7,
            memberName: 'Jane Doe',
            startDateTime: assignment.startDateTime,
            endDateTime: assignment.endDateTime,
        })
    })

    it('builds readable assigned and unassigned descriptions', () => {
        expect(buildAssignedDescription('Registration desk', assignment)).toContain('Assigned Jane Doe to "Registration desk"');
        expect(buildUnassignedDescription('Registration desk', assignment)).toBe('Unassigned Jane Doe from "Registration desk"');
    })
})
