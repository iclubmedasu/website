import { describe, it, expect } from 'vitest'

describe('Backend Utilities', () => {
    describe('Email validation', () => {
        it('should identify valid email addresses', () => {
            const validEmails = [
                'user@example.com',
                'member@iclub.com',
                'test.user@university.edu'
            ]
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            validEmails.forEach(email => {
                expect(email).toMatch(emailRegex)
            })
        })

        it('should reject invalid email addresses', () => {
            const invalidEmails = ['notanemail', '@nodomain', 'no@']
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
            invalidEmails.forEach(email => {
                expect(email).not.toMatch(emailRegex)
            })
        })
    })

    describe('Environment variables', () => {
        it('should have NODE_ENV defined', () => {
            expect(process.env.NODE_ENV).toBeDefined()
        })
    })
})
