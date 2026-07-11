import { describe, expect, it } from 'vitest'
import { computeAuthorityFlags } from '../../lib/authorityFlags'

describe('computeAuthorityFlags', () => {
    it('marks Administration Officer as isOfficer, not leadership or special', () => {
        const flags = computeAuthorityFlags([
            {
                team: { name: 'Administration' },
                role: { roleName: 'Officer', roleType: 'Officer', systemRoleKey: 10 },
            },
        ])

        expect(flags).toEqual({
            isOfficer: true,
            isAdmin: false,
            isLeadership: false,
            isSpecial: false,
        })
    })

    it('marks Administration President as isAdmin, not leadership or special', () => {
        const flags = computeAuthorityFlags([
            {
                team: { name: 'Administration' },
                role: { roleName: 'President', roleType: 'Administration', systemRoleKey: 11 },
            },
        ])

        expect(flags).toEqual({
            isOfficer: false,
            isAdmin: true,
            isLeadership: false,
            isSpecial: false,
        })
    })

    it('marks Administration Vice President as isAdmin, not leadership or special', () => {
        const flags = computeAuthorityFlags([
            {
                team: { name: 'Administration' },
                role: { roleName: 'Vice President', roleType: 'Administration', systemRoleKey: 12 },
            },
        ])

        expect(flags).toEqual({
            isOfficer: false,
            isAdmin: true,
            isLeadership: false,
            isSpecial: false,
        })
    })

    it('marks Officer via systemRoleKey 10 when on Administration team', () => {
        const flags = computeAuthorityFlags([
            {
                team: { name: 'Administration' },
                role: { roleName: 'Officer', roleType: 'Officer', systemRoleKey: 10 },
            },
        ])

        expect(flags.isOfficer).toBe(true)
        expect(flags.isLeadership).toBe(false)
    })

    it('marks default Member (systemRoleKey 3) as regular — no special/leadership flags', () => {
        const flags = computeAuthorityFlags([
            {
                team: { name: 'Events' },
                role: { roleName: 'Member', roleType: 'Regular', systemRoleKey: 3 },
            },
        ])

        expect(flags).toEqual({
            isOfficer: false,
            isAdmin: false,
            isLeadership: false,
            isSpecial: false,
        })
    })

    it('marks custom Regular role as regular — not special despite null systemRoleKey', () => {
        const flags = computeAuthorityFlags([
            {
                team: { name: 'Events' },
                role: { roleName: 'Photographer', roleType: 'Regular', systemRoleKey: null },
            },
        ])

        expect(flags).toEqual({
            isOfficer: false,
            isAdmin: false,
            isLeadership: false,
            isSpecial: false,
        })
    })

    it('marks Special Roles category as isSpecial', () => {
        const flags = computeAuthorityFlags([
            {
                team: { name: 'Events' },
                role: { roleName: 'Media Lead', roleType: 'Special Roles', systemRoleKey: null },
            },
        ])

        expect(flags).toEqual({
            isOfficer: false,
            isAdmin: false,
            isLeadership: false,
            isSpecial: true,
        })
    })

    it('marks Head of Team as isLeadership via systemRoleKey', () => {
        const flags = computeAuthorityFlags([
            {
                team: { name: 'Events' },
                role: { roleName: 'Head of Team', roleType: 'Leadership', systemRoleKey: 1 },
            },
        ])

        expect(flags).toEqual({
            isOfficer: false,
            isAdmin: false,
            isLeadership: true,
            isSpecial: false,
        })
    })

    it('marks Vice Head of Team as isLeadership via role name fallback, not special', () => {
        const flags = computeAuthorityFlags([
            {
                team: { name: 'Events' },
                role: { roleName: 'Vice Head of Team', roleType: 'Leadership', systemRoleKey: null },
            },
        ])

        expect(flags).toEqual({
            isOfficer: false,
            isAdmin: false,
            isLeadership: true,
            isSpecial: false,
        })
    })

    it('does not treat Admin system keys as leadership on Administration team', () => {
        const flags = computeAuthorityFlags([
            {
                team: { name: 'Administration' },
                role: { roleName: 'President', roleType: 'Administration', systemRoleKey: 11 },
            },
        ])

        expect(flags.isAdmin).toBe(true)
        expect(flags.isLeadership).toBe(false)
    })

    it('sets isOfficer when isDeveloper is true even without memberships', () => {
        const flags = computeAuthorityFlags([], true)

        expect(flags.isOfficer).toBe(true)
        expect(flags.isAdmin).toBe(false)
        expect(flags.isLeadership).toBe(false)
        expect(flags.isSpecial).toBe(false)
    })
})
