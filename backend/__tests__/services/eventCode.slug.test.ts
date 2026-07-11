import { describe, expect, it, vi, beforeEach } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
    eventFindFirst: vi.fn(),
    projectFindFirst: vi.fn(),
    eventRegistrationFindFirst: vi.fn(),
}))

vi.mock('../../db', () => ({
    prisma: {
        event: { findFirst: prismaMocks.eventFindFirst },
        project: { findFirst: prismaMocks.projectFindFirst },
        eventRegistration: { findFirst: prismaMocks.eventRegistrationFindFirst },
    },
}))

import {
    generateCandidatePublicSlug,
    generateUniqueEventSlug,
    generateUniqueProjectSlug,
    PUBLIC_SLUG_LENGTH,
} from '../../services/eventCode'

describe('public slug generation', () => {
    beforeEach(() => {
        prismaMocks.eventFindFirst.mockReset()
        prismaMocks.projectFindFirst.mockReset()
        prismaMocks.eventRegistrationFindFirst.mockReset()
    })

    it('generates 12-character alphanumeric slugs', () => {
        const slug = generateCandidatePublicSlug()
        expect(slug).toHaveLength(PUBLIC_SLUG_LENGTH)
        expect(slug).toMatch(/^[a-z0-9]+$/)
    })

    it('returns a unique event slug when the first candidate is free', async () => {
        prismaMocks.eventFindFirst.mockResolvedValueOnce(null)
        const slug = await generateUniqueEventSlug()
        expect(slug).toHaveLength(PUBLIC_SLUG_LENGTH)
        expect(prismaMocks.eventFindFirst).toHaveBeenCalled()
    })

    it('returns a unique project slug when the first candidate is free', async () => {
        prismaMocks.projectFindFirst.mockResolvedValueOnce(null)
        const slug = await generateUniqueProjectSlug()
        expect(slug).toHaveLength(PUBLIC_SLUG_LENGTH)
        expect(prismaMocks.projectFindFirst).toHaveBeenCalled()
    })
})
