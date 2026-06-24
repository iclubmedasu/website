import { describe, expect, it } from 'vitest'
import { toMemberProfileView, buildMemberTimeline } from '../../lib/memberProfileVisibility'

describe('memberProfileVisibility', () => {
    it('redacts contact fields when visibility flags are false', () => {
        const view = toMemberProfileView({
            id: 1,
            fullName: 'Test',
            email: 'test@med.asu.edu.eg',
            email2: 'a@b.com',
            phoneNumber: '+201012345678',
            studentId: 123,
            joinDate: '2025-01-01',
            showPhoneNumber: false,
            showEmail2: false,
            showStudentId: false,
        })

        expect(view.phoneNumber).toBeNull()
        expect(view.email2).toBeNull()
        expect(view.studentId).toBeNull()
        expect(view.email).toBe('test@med.asu.edu.eg')
    })

    it('builds timeline entries from role history rows', () => {
        const timeline = buildMemberTimeline([
            {
                id: 9,
                changeType: 'New',
                changeReason: null,
                notes: null,
                startDate: new Date('2025-01-01'),
                endDate: null,
                isActive: true,
                member: { fullName: 'Test' },
                team: { name: 'Events' },
                role: { roleName: 'Member' },
                subteam: null,
            },
        ])

        expect(timeline).toHaveLength(1)
        expect(timeline[0].teamName).toBe('Events')
        expect(timeline[0].period.duration).toBe('Ongoing')
    })
})
