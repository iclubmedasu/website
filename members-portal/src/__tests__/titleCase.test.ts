import { describe, it, expect } from 'vitest'
import { toTitleCase } from '../utils/titleCase'

describe('toTitleCase', () => {
    it('should capitalize the first letter of each word', () => {
        expect(toTitleCase('hello world')).toBe('Hello World')
    })

    it('should handle already capitalized text', () => {
        expect(toTitleCase('Hello World')).toBe('Hello World')
    })

    it('should handle empty string', () => {
        expect(toTitleCase('')).toBe('')
    })

    it('should handle single word', () => {
        expect(toTitleCase('hello')).toBe('Hello')
    })

    it('should preserve all-caps abbreviations', () => {
        expect(toTitleCase('build an AI UI toolkit')).toBe('Build an AI UI Toolkit')
    })

    it('should keep small words lowercase in the middle', () => {
        expect(toTitleCase('head of the team in cairo')).toBe('Head of the Team in Cairo')
    })

    it('should capitalize parts of hyphenated words', () => {
        expect(toTitleCase('follow-up on post-launch tasks')).toBe('Follow-Up on Post-Launch Tasks')
    })

    it('should return non-string values unchanged', () => {
        expect(toTitleCase(123 as unknown as string)).toBe(123)
    })
})
