import { describe, expect, it } from 'vitest'
import {
    dedupeRepeatedPhoneDigits,
    normalizePhone,
    phoneLookupCandidates,
    sanitizePhoneForStorage,
    validateStoredPhone,
} from '../../lib/phoneUtils'

describe('phoneUtils', () => {
    it('dedupes tripled Egyptian national numbers', () => {
        expect(dedupeRepeatedPhoneDigits('015010999180150109991801501099918')).toBe('01501099918')
    })

    it('leaves normal phone numbers unchanged', () => {
        expect(dedupeRepeatedPhoneDigits('+201501099918')).toBe('+201501099918')
        expect(dedupeRepeatedPhoneDigits('01501099918')).toBe('01501099918')
    })

    it('sanitizes tripled input to canonical Egyptian storage form', () => {
        expect(sanitizePhoneForStorage('015010999180150109991801501099918')).toBe('+201501099918')
    })

    it('normalizes Egyptian local numbers', () => {
        expect(normalizePhone('01501099918')).toBe('+201501099918')
        expect(normalizePhone('1501099918')).toBe('+201501099918')
    })

    it('preserves placeholder phones', () => {
        expect(sanitizePhoneForStorage('pending-213256')).toBe('pending-213256')
    })

    it('rejects invalid phone lengths after sanitization', () => {
        expect(validateStoredPhone('+201501099918').valid).toBe(true)
        expect(validateStoredPhone('pending-1').valid).toBe(true)
        expect(validateStoredPhone('123').valid).toBe(false)
    })

    describe('phoneLookupCandidates', () => {
        const canonical = '+201501099918'
        const withZero = '01501099918'
        const bareNational = '1501099918'
        const withoutPlus = '201501099918'

        it('includes canonical +20 form for local 01… input', () => {
            const candidates = phoneLookupCandidates(withZero)
            expect(candidates).toContain(canonical)
            expect(candidates).toContain(withZero)
            expect(candidates).toContain(bareNational)
            expect(candidates).toContain(withoutPlus)
        })

        it('includes legacy 01… form for +20… input', () => {
            const candidates = phoneLookupCandidates(canonical)
            expect(candidates).toContain(canonical)
            expect(candidates).toContain(withZero)
            expect(candidates).toContain(bareNational)
            expect(candidates).toContain(withoutPlus)
        })

        it('includes canonical form for bare national 1… input', () => {
            const candidates = phoneLookupCandidates(bareNational)
            expect(candidates).toContain(canonical)
            expect(candidates).toContain(withZero)
            expect(candidates).toContain(bareNational)
        })

        it('treats spaced/dashed Egyptian numbers the same', () => {
            const candidates = phoneLookupCandidates('0150 109 9918')
            expect(candidates).toContain(canonical)
            expect(candidates).toContain(withZero)
        })

        it('returns empty for blank or placeholder phones', () => {
            expect(phoneLookupCandidates('')).toEqual([])
            expect(phoneLookupCandidates('pending-213256')).toEqual([])
        })

        it('shares the same Egyptian candidate set across formats', () => {
            const fromLocal = new Set(phoneLookupCandidates(withZero))
            const fromE164 = new Set(phoneLookupCandidates(canonical))
            const fromBare = new Set(phoneLookupCandidates(bareNational))

            for (const form of [canonical, withZero, bareNational, withoutPlus]) {
                expect(fromLocal.has(form)).toBe(true)
                expect(fromE164.has(form)).toBe(true)
                expect(fromBare.has(form)).toBe(true)
            }
        })
    })
})
