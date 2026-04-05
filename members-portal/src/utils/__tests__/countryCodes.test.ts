import { describe, expect, it } from 'vitest'
import { formatPhoneValue, parsePhoneValue } from '../countryCodes'

describe('countryCodes utilities', () => {
    describe('parsePhoneValue', () => {
        it('parses egyptian international numbers correctly', () => {
            expect(parsePhoneValue('+201012345678')).toEqual({
                countryCode: '+20',
                nationalNumber: '1012345678'
            })
        })

        it('defaults to egypt code for local-style numbers without plus', () => {
            expect(parsePhoneValue('010-123 45678')).toEqual({
                countryCode: '+20',
                nationalNumber: '01012345678'
            })
        })

        it('uses longest matching dial code when multiple prefixes are possible', () => {
            expect(parsePhoneValue('+358401234567')).toEqual({
                countryCode: '+358',
                nationalNumber: '401234567'
            })
        })

        it('falls back to default code for unknown international prefix', () => {
            expect(parsePhoneValue('+99912345')).toEqual({
                countryCode: '+20',
                nationalNumber: '99912345'
            })
        })

        it('handles nullish values defensively', () => {
            expect(parsePhoneValue(undefined)).toEqual({
                countryCode: '+20',
                nationalNumber: ''
            })
            expect(parsePhoneValue(null)).toEqual({
                countryCode: '+20',
                nationalNumber: ''
            })
        })
    })

    describe('formatPhoneValue', () => {
        it('formats with explicit country code and digits-only national number', () => {
            expect(formatPhoneValue('+20', '010-123 45678')).toBe('+2001012345678')
        })

        it('falls back to egypt code when country code is missing', () => {
            expect(formatPhoneValue(undefined, '12345')).toBe('+2012345')
        })

        it('returns empty string when there are no national digits', () => {
            expect(formatPhoneValue('+20', '')).toBe('')
            expect(formatPhoneValue('+20', null)).toBe('')
        })
    })
})
