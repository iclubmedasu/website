import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildRouteApp } from './testHarness'

const prismaMocks = vi.hoisted(() => ({
    certificateFindFirst: vi.fn(),
    certificateFindUnique: vi.fn(),
    certificateCreate: vi.fn(),
    certificateUpdate: vi.fn(),
    certificateTemplateFindUnique: vi.fn(),
    eventFindUnique: vi.fn(),
    projectFindUnique: vi.fn(),
}))

const emailMocks = vi.hoisted(() => ({
    queueCertificateEmail: vi.fn(),
    sendCertificateEmail: vi.fn(),
}))

vi.mock('../../db', () => ({
    prisma: {
        certificate: {
            findFirst: prismaMocks.certificateFindFirst,
            findUnique: prismaMocks.certificateFindUnique,
            create: prismaMocks.certificateCreate,
            update: prismaMocks.certificateUpdate,
        },
        certificateTemplate: {
            findUnique: prismaMocks.certificateTemplateFindUnique,
        },
        event: {
            findUnique: prismaMocks.eventFindUnique,
        },
        project: {
            findUnique: prismaMocks.projectFindUnique,
        },
    },
}))

vi.mock('../../services/certificateEmailService', () => emailMocks)
vi.mock('../../services/certificatePdfService', () => ({
    generateCertificatePdfBuffer: vi.fn(),
}))
vi.mock('../../lib/certificateBackgroundCache', () => ({
    loadCertificateBackground: vi.fn(),
}))
vi.mock('../../middleware/rateLimit', () => ({
    certificateEmailResendLimiter: (_req: unknown, _res: unknown, next: () => void) => next(),
}))

import certificatesRouter from '../../routes/certificates'

const manager = { isOfficer: true, memberId: 1 }

const activeTemplate = {
    id: 5,
    isActive: true,
    layout: {
        wording: {
            description: 'For outstanding contribution',
            issuerName: 'iClub',
            hasIssuer: true,
        },
    },
}

function customCreateBody(overrides: Record<string, unknown> = {}) {
    return {
        type: 'CUSTOM',
        recipientName: 'Ada Lovelace',
        recipientEmail: 'ada@example.com',
        title: 'Honorary Certificate',
        description: 'Custom desc',
        templateId: 5,
        ...overrides,
    }
}

describe('certificates routes — template requirement & auto-issue', () => {
    beforeEach(() => {
        prismaMocks.certificateFindFirst.mockResolvedValue(null)
        prismaMocks.certificateTemplateFindUnique.mockResolvedValue(activeTemplate)
        emailMocks.queueCertificateEmail.mockReset()
    })

    afterEach(() => {
        vi.clearAllMocks()
    })

    describe('POST /', () => {
        it('returns 400 when templateId is missing', async () => {
            const response = await request(buildRouteApp(certificatesRouter, manager))
                .post('/')
                .send(customCreateBody({ templateId: undefined }))

            expect(response.status).toBe(400)
            expect(response.body.error).toBe('templateId is required')
            expect(prismaMocks.certificateCreate).not.toHaveBeenCalled()
        })

        it('returns 404 when template is missing', async () => {
            prismaMocks.certificateTemplateFindUnique.mockResolvedValueOnce(null)

            const response = await request(buildRouteApp(certificatesRouter, manager))
                .post('/')
                .send(customCreateBody({ templateId: 999 }))

            expect(response.status).toBe(404)
            expect(response.body.error).toBe('Template not found')
        })

        it('returns 400 when template is inactive', async () => {
            prismaMocks.certificateTemplateFindUnique.mockResolvedValueOnce({
                ...activeTemplate,
                isActive: false,
            })

            const response = await request(buildRouteApp(certificatesRouter, manager))
                .post('/')
                .send(customCreateBody())

            expect(response.status).toBe(400)
            expect(response.body.error).toBe('Template is inactive')
        })

        it('creates ISSUED certificate and queues email', async () => {
            const created = {
                id: 42,
                templateId: 5,
                type: 'CUSTOM',
                status: 'ISSUED',
                recipientName: 'Ada Lovelace',
                recipientEmail: 'ada@example.com',
                title: 'Honorary Certificate',
                description: 'Custom desc',
                issuedAt: new Date('2026-07-23T12:00:00.000Z'),
            }
            prismaMocks.certificateCreate.mockResolvedValueOnce(created)

            const response = await request(buildRouteApp(certificatesRouter, manager))
                .post('/')
                .send(customCreateBody())

            expect(response.status).toBe(201)
            expect(response.body.status).toBe('ISSUED')
            expect(prismaMocks.certificateCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        templateId: 5,
                        status: 'ISSUED',
                        issuedAt: expect.any(Date),
                    }),
                }),
            )
            expect(emailMocks.queueCertificateEmail).toHaveBeenCalledWith(42, 'custom-create')
        })
    })

    describe('PATCH /:id/issue', () => {
        it('rejects DRAFT certificates with null templateId', async () => {
            prismaMocks.certificateFindUnique.mockResolvedValueOnce({
                id: 7,
                status: 'DRAFT',
                templateId: null,
            })

            const response = await request(buildRouteApp(certificatesRouter, manager))
                .patch('/7/issue')

            expect(response.status).toBe(400)
            expect(response.body.error).toBe('templateId is required')
            expect(prismaMocks.certificateUpdate).not.toHaveBeenCalled()
            expect(emailMocks.queueCertificateEmail).not.toHaveBeenCalled()
        })

        it('issues DRAFT with active template and queues email', async () => {
            prismaMocks.certificateFindUnique.mockResolvedValueOnce({
                id: 8,
                status: 'DRAFT',
                templateId: 5,
            })
            prismaMocks.certificateUpdate.mockResolvedValueOnce({
                id: 8,
                status: 'ISSUED',
                templateId: 5,
                issuedAt: new Date(),
            })

            const response = await request(buildRouteApp(certificatesRouter, manager))
                .patch('/8/issue')

            expect(response.status).toBe(200)
            expect(response.body.status).toBe('ISSUED')
            expect(emailMocks.queueCertificateEmail).toHaveBeenCalledWith(8, 'issue')
        })
    })

    describe('POST /event/:eventId/issue-bulk', () => {
        it('returns 400 when templateId is missing', async () => {
            const response = await request(buildRouteApp(certificatesRouter, manager))
                .post('/event/10/issue-bulk')
                .send({
                    recipients: [
                        {
                            type: 'ATTENDANCE',
                            recipientName: 'Bob',
                            recipientEmail: 'bob@example.com',
                        },
                    ],
                    issueImmediately: true,
                })

            expect(response.status).toBe(400)
            expect(response.body.error).toBe('templateId is required')
            expect(prismaMocks.eventFindUnique).not.toHaveBeenCalled()
        })

        it('creates certificates when template is active', async () => {
            prismaMocks.eventFindUnique.mockResolvedValueOnce({ id: 10, title: 'Summit' })
            prismaMocks.certificateCreate.mockResolvedValueOnce({ id: 100 })

            const response = await request(buildRouteApp(certificatesRouter, manager))
                .post('/event/10/issue-bulk')
                .send({
                    templateId: 5,
                    issueImmediately: true,
                    recipients: [
                        {
                            type: 'ATTENDANCE',
                            recipientName: 'Bob',
                            recipientEmail: 'bob@example.com',
                        },
                    ],
                })

            expect(response.status).toBe(200)
            expect(response.body.created).toBe(1)
            expect(prismaMocks.certificateCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({
                        templateId: 5,
                        status: 'ISSUED',
                    }),
                }),
            )
            expect(emailMocks.queueCertificateEmail).toHaveBeenCalledWith(100, 'event-bulk-issue')
        })
    })

    describe('POST /project/:projectId/issue-bulk', () => {
        it('returns 400 when templateId is missing', async () => {
            const response = await request(buildRouteApp(certificatesRouter, manager))
                .post('/project/20/issue-bulk')
                .send({
                    recipients: [
                        {
                            type: 'CONTRIBUTION',
                            recipientName: 'Carol',
                            recipientEmail: 'carol@example.com',
                        },
                    ],
                })

            expect(response.status).toBe(400)
            expect(response.body.error).toBe('templateId is required')
            expect(prismaMocks.projectFindUnique).not.toHaveBeenCalled()
        })
    })

    describe('PATCH /:id/reissue', () => {
        it('reissues REVOKED certificate and queues email', async () => {
            prismaMocks.certificateFindUnique.mockResolvedValueOnce({
                id: 9,
                status: 'REVOKED',
                templateId: 5,
                revokedAt: new Date('2026-07-01T00:00:00.000Z'),
                revokedReason: 'Issued in error',
            })
            prismaMocks.certificateUpdate.mockResolvedValueOnce({
                id: 9,
                status: 'ISSUED',
                templateId: 5,
                issuedAt: new Date('2026-07-23T12:00:00.000Z'),
                revokedAt: null,
                revokedReason: null,
            })

            const response = await request(buildRouteApp(certificatesRouter, manager))
                .patch('/9/reissue')

            expect(response.status).toBe(200)
            expect(response.body.status).toBe('ISSUED')
            expect(response.body.revokedAt).toBeNull()
            expect(response.body.revokedReason).toBeNull()
            expect(prismaMocks.certificateUpdate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { id: 9 },
                    data: expect.objectContaining({
                        status: 'ISSUED',
                        issuedAt: expect.any(Date),
                        revokedAt: null,
                        revokedReason: null,
                    }),
                }),
            )
            expect(emailMocks.queueCertificateEmail).toHaveBeenCalledWith(9, 'reissue')
        })

        it('rejects ISSUED certificates', async () => {
            prismaMocks.certificateFindUnique.mockResolvedValueOnce({
                id: 10,
                status: 'ISSUED',
                templateId: 5,
            })

            const response = await request(buildRouteApp(certificatesRouter, manager))
                .patch('/10/reissue')

            expect(response.status).toBe(409)
            expect(response.body.error).toBe('Certificate is not in REVOKED status')
            expect(prismaMocks.certificateUpdate).not.toHaveBeenCalled()
            expect(emailMocks.queueCertificateEmail).not.toHaveBeenCalled()
        })

        it('rejects DRAFT certificates', async () => {
            prismaMocks.certificateFindUnique.mockResolvedValueOnce({
                id: 11,
                status: 'DRAFT',
                templateId: 5,
            })

            const response = await request(buildRouteApp(certificatesRouter, manager))
                .patch('/11/reissue')

            expect(response.status).toBe(409)
            expect(response.body.error).toBe('Certificate is not in REVOKED status')
            expect(prismaMocks.certificateUpdate).not.toHaveBeenCalled()
            expect(emailMocks.queueCertificateEmail).not.toHaveBeenCalled()
        })

        it('rejects when template is missing', async () => {
            prismaMocks.certificateFindUnique.mockResolvedValueOnce({
                id: 12,
                status: 'REVOKED',
                templateId: 999,
            })
            prismaMocks.certificateTemplateFindUnique.mockResolvedValueOnce(null)

            const response = await request(buildRouteApp(certificatesRouter, manager))
                .patch('/12/reissue')

            expect(response.status).toBe(404)
            expect(response.body.error).toBe('Template not found')
            expect(prismaMocks.certificateUpdate).not.toHaveBeenCalled()
            expect(emailMocks.queueCertificateEmail).not.toHaveBeenCalled()
        })
    })
})
