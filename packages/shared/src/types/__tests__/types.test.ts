import { describe, it, expect } from 'vitest'
import type { Member } from '../index'

describe('Shared Types', () => {
    describe('Member', () => {
        it('should accept a valid member object', () => {
            const member: Member = {
                id: 1,
                fullName: 'John Doe',
                email: 'john@iclub.com',
                email2: null,
                email3: null,
                phoneNumber: '1234567890',
                phoneNumber2: null,
                studentId: null,
                isActive: true,
                assignmentStatus: 'ASSIGNED',
                profilePhotoUrl: null,
                linkedInUrl: null,
                joinDate: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }
            expect(member.id).toBe(1)
            expect(member.fullName).toBe('John Doe')
            expect(member.isActive).toBe(true)
        })

        it('should preserve nullable optional contact fields', () => {
            const member: Member = {
                id: 2,
                fullName: 'Jane Doe',
                email: 'jane@iclub.com',
                email2: null,
                email3: null,
                phoneNumber: '01000000000',
                phoneNumber2: null,
                studentId: 213256,
                profilePhotoUrl: null,
                linkedInUrl: null,
                isActive: false,
                assignmentStatus: 'UNASSIGNED',
                joinDate: new Date().toISOString(),
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            }

            expect(member.assignmentStatus).toBe('UNASSIGNED')
            expect(member.phoneNumber2).toBeNull()
            expect(member.email3).toBeNull()
        })
    })
})
