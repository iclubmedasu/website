import { describe, expect, it } from 'vitest'
import {
    dedupeRepeatedPhoneDigits,
    normalizePhone,
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
})
