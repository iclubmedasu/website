import express, { Request, Response } from "express";
import { CertificateStatus, CertificateType, Prisma } from "@prisma/client";
import { parseTemplateLayoutWording } from "@iclub/shared/utils";
import { prisma } from "../db";
import {
    buildAlreadyIssuedSet,
    certRecipientKey,
    normalizeRecipientEmail,
} from "../lib/certificateRecipientKey";
import { loadCertificateBackground } from "../lib/certificateBackgroundCache";
import type { RequestUser } from "../types/auth";

const router = express.Router();

const CERT_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const VALID_CERTIFICATE_TYPES = new Set<string>([
    "ATTENDANCE",
    "ORGANIZATION",
    "CONTRIBUTION",
    "LEADERSHIP",
    "CUSTOM",
]);

const VALID_CERTIFICATE_STATUSES = new Set<string>(["DRAFT", "ISSUED", "REVOKED"]);

async function generateUniqueCertificationCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
        let code = "";
        for (let i = 0; i < 8; i++) {
            code += CERT_CODE_ALPHABET[Math.floor(Math.random() * CERT_CODE_ALPHABET.length)];
        }
        const existing = await prisma.certificate.findFirst({
            where: { verificationCode: code },
            select: { id: true },
        });
        if (!existing) return code;
    }
    throw new Error("Unable to generate unique verification code");
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return !!value && typeof value === "object" && !Array.isArray(value);
}

/** Batch issue: description + issuer from template; title is event/project title. */
async function loadTemplateIssueDefaults(templateId: number | null): Promise<{
    description: string;
    fieldValues: Record<string, unknown>;
}> {
    if (templateId == null) {
        return { description: "", fieldValues: {} };
    }
    const template = await prisma.certificateTemplate.findUnique({
        where: { id: templateId },
        select: { layout: true },
    });
    const wording = parseTemplateLayoutWording(template?.layout);
    const fieldValues: Record<string, unknown> = {};
    if (wording.hasIssuer || wording.issuerName) {
        fieldValues.issuerName = wording.issuerName;
    }
    return { description: wording.description, fieldValues };
}

function mergeCertificateFieldValues(
    base: Record<string, unknown>,
    overrides: unknown,
): Record<string, unknown> {
    if (!isPlainObject(overrides)) return { ...base };

    const merged: Record<string, unknown> = { ...base, ...overrides };
    const baseStatic = base.staticTexts;
    const overrideStatic = overrides.staticTexts;
    if (isPlainObject(baseStatic) && isPlainObject(overrideStatic)) {
        merged.staticTexts = { ...baseStatic, ...overrideStatic };
    }
    return merged;
}

function canManageCertificates(user: RequestUser | undefined): boolean {
    return !!(user?.isDeveloper || user?.isAdmin || user?.isOfficer || user?.isLeadership);
}

function parseId(value: unknown): number | null {
    const parsed = Number.parseInt(String(value), 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

async function findExistingCertificate(args: {
    eventId?: number;
    projectId?: number;
    memberId: number | null;
    type: CertificateType;
    recipientEmail: string;
}): Promise<{ id: number } | null> {
    const { eventId, projectId, memberId, type, recipientEmail } = args;
    const scope =
        eventId != null ? { eventId } : projectId != null ? { projectId } : null;
    if (!scope) return null;

    if (memberId != null) {
        return prisma.certificate.findFirst({
            where: {
                ...scope,
                recipientMemberId: memberId,
                type,
                status: { not: "REVOKED" },
            },
            select: { id: true },
        });
    }

    const normalizedEmail = normalizeRecipientEmail(recipientEmail);
    if (!normalizedEmail) return null;

    return prisma.certificate.findFirst({
        where: {
            ...scope,
            recipientMemberId: null,
            type,
            status: { not: "REVOKED" },
            recipientEmail: { equals: normalizedEmail, mode: "insensitive" },
        },
        select: { id: true },
    });
}

const listInclude = {
    template: { select: { id: true, name: true } },
    event: { select: { id: true, title: true } },
    project: { select: { id: true, title: true } },
    recipientMember: { select: { id: true, fullName: true } },
} satisfies Prisma.CertificateInclude;

router.get("/verify/:code", async (req: Request, res: Response) => {
    const code = String(req.params.code ?? "").trim();
    if (!code) return res.status(400).json({ error: "Invalid verification code" });

    try {
        const certificate = await prisma.certificate.findFirst({
            where: { verificationCode: code, status: "ISSUED" },
            select: {
                id: true,
                verificationCode: true,
                recipientName: true,
                title: true,
                description: true,
                type: true,
                issuedAt: true,
                eventId: true,
                projectId: true,
                templateId: true,
                fieldValues: true,
                template: {
                    select: {
                        canvasWidth: true,
                        canvasHeight: true,
                        layout: true,
                        backgroundFocus: true,
                        backgroundImagePath: true,
                    },
                },
                event: {
                    select: {
                        id: true,
                        title: true,
                        eventDate: true,
                        eventEndDate: true,
                        projectType: { select: { name: true, category: true } },
                    },
                },
                project: {
                    select: {
                        id: true,
                        title: true,
                        projectType: { select: { name: true, category: true } },
                    },
                },
            },
        });

        if (!certificate) {
            return res.status(404).json({ error: "Certificate not found or not yet issued" });
        }

        const response: Record<string, unknown> = {
            id: certificate.id,
            verificationCode: certificate.verificationCode,
            recipientName: certificate.recipientName,
            title: certificate.title,
            description: certificate.description,
            type: certificate.type,
            issuedAt: certificate.issuedAt,
            fieldValues: certificate.fieldValues,
            templateId: certificate.templateId,
        };

        if (certificate.templateId && certificate.template) {
            response.template = {
                canvasWidth: certificate.template.canvasWidth,
                canvasHeight: certificate.template.canvasHeight,
                layout: certificate.template.layout,
                backgroundFocus: certificate.template.backgroundFocus,
                hasBackground: !!certificate.template.backgroundImagePath,
            };
        }

        if (certificate.eventId && certificate.event) {
            response.event = certificate.event;
        }
        if (certificate.projectId && certificate.project) {
            response.project = certificate.project;
        }

        return res.json(response);
    } catch (error) {
        console.error("GET /certificates/verify/:code error:", error);
        return res.status(500).json({ error: "Failed to verify certificate" });
    }
});

router.get("/verify/:code/background", async (req: Request, res: Response) => {
    const code = String(req.params.code ?? "").trim();
    if (!code) return res.status(400).json({ error: "Invalid verification code" });

    try {
        const certificate = await prisma.certificate.findFirst({
            where: { verificationCode: code, status: "ISSUED" },
            select: {
                template: {
                    select: {
                        backgroundImagePath: true,
                        backgroundImageSha: true,
                    },
                },
            },
        });

        if (!certificate) {
            return res.status(404).json({ error: "Certificate not found or not yet issued" });
        }

        const backgroundImagePath = certificate.template?.backgroundImagePath;
        if (!backgroundImagePath) {
            return res.status(404).json({ error: "Certificate has no background image" });
        }

        const { buffer, contentType } = await loadCertificateBackground(
            backgroundImagePath,
            certificate.template?.backgroundImageSha,
        );

        res.setHeader("Content-Type", contentType);
        res.setHeader("Cache-Control", "public, max-age=86400");
        return res.send(buffer);
    } catch (error) {
        console.error("GET /certificates/verify/:code/background error:", error);
        return res.status(500).json({ error: "Failed to load certificate background" });
    }
});

router.get("/event/:eventId/eligible", async (req: Request, res: Response) => {
    if (!canManageCertificates(req.user)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const eventId = parseId(req.params.eventId);
    if (!eventId) return res.status(400).json({ error: "Invalid event id" });

    try {
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            include: { projectType: { select: { name: true } } },
        });
        if (!event) return res.status(404).json({ error: "Event not found" });

        const [registrations, taskAssignments, existingCerts] = await Promise.all([
            prisma.eventRegistration.findMany({
                where: { eventId, status: "CHECKED_IN" },
                include: {
                    member: { select: { id: true, fullName: true, email: true, phoneNumber: true } },
                    attendanceDays: { select: { id: true } },
                    _count: { select: { sessionAttendances: true } },
                },
            }),
            prisma.eventTaskAssignment.findMany({
                where: { eventTask: { eventId } },
                include: {
                    eventTask: { select: { leaderId: true } },
                    member: {
                        select: { id: true, fullName: true, email: true, phoneNumber: true },
                    },
                },
            }),
            prisma.certificate.findMany({
                where: { eventId, status: { not: "REVOKED" } },
                select: { recipientMemberId: true, type: true, recipientEmail: true },
            }),
        ]);

        const alreadyIssued = buildAlreadyIssuedSet(existingCerts);

        const attendees = registrations.map((registration) => {
            const memberId = registration.memberId ?? registration.member?.id ?? null;
            const type = "ATTENDANCE" as const;
            const email = registration.member?.email ?? registration.email;
            const phoneNumber =
                registration.phoneNumber?.trim() ||
                registration.member?.phoneNumber?.trim() ||
                null;
            return {
                memberId,
                fullName: registration.member?.fullName ?? registration.fullName,
                email,
                phoneNumber,
                type,
                category: "ATTENDEE" as const,
                attendanceDaysCount: registration.attendanceDays.length,
                sessionsAttendedCount: registration._count.sessionAttendances,
                alreadyIssued: alreadyIssued.has(certRecipientKey(memberId, type, email)),
            };
        });

        const leaderMemberIds = new Set<number>();
        for (const assignment of taskAssignments) {
            const leaderId = assignment.eventTask.leaderId;
            if (leaderId) leaderMemberIds.add(leaderId);
        }

        const staffByMember = new Map<
            number,
            {
                memberId: number;
                fullName: string;
                email: string;
                phoneNumber: string | null;
                type: "LEADERSHIP" | "ORGANIZATION";
            }
        >();

        for (const assignment of taskAssignments) {
            const member = assignment.member;
            const memberId = member.id;
            const type = leaderMemberIds.has(memberId) ? ("LEADERSHIP" as const) : ("ORGANIZATION" as const);
            staffByMember.set(memberId, {
                memberId,
                fullName: member.fullName,
                email: member.email,
                phoneNumber: member.phoneNumber?.trim() || null,
                type,
            });
        }

        const staff = Array.from(staffByMember.values()).map((entry) => ({
            ...entry,
            category: "STAFF" as const,
            alreadyIssued: alreadyIssued.has(certRecipientKey(entry.memberId, entry.type, entry.email)),
        }));

        const recipients = [...attendees, ...staff];

        return res.json({
            recipients,
            attendees,
            staff,
            eventTitle: event.title,
            projectTypeName: event.projectType?.name ?? null,
        });
    } catch (error) {
        console.error("GET /certificates/event/:eventId/eligible error:", error);
        return res.status(500).json({ error: "Failed to load eligible recipients" });
    }
});

router.post("/event/:eventId/issue-bulk", async (req: Request, res: Response) => {
    if (!canManageCertificates(req.user)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const eventId = parseId(req.params.eventId);
    if (!eventId) return res.status(400).json({ error: "Invalid event id" });

    const recipients = req.body?.recipients;
    if (!Array.isArray(recipients)) {
        return res.status(400).json({ error: "recipients must be an array" });
    }

    const templateId = parseId(req.body?.templateId) ?? null;
    const issueImmediately = req.body?.issueImmediately === true;

    try {
        const event = await prisma.event.findUnique({
            where: { id: eventId },
            select: { id: true, title: true },
        });
        if (!event) return res.status(404).json({ error: "Event not found" });

        const templateDefaults = await loadTemplateIssueDefaults(templateId);

        let created = 0;
        let skipped = 0;
        const certificateIds: number[] = [];

        for (const recipient of recipients) {
            const memberId = parseId(recipient?.memberId) ?? null;
            const type = String(recipient?.type ?? "").trim();
            const recipientName = String(recipient?.recipientName ?? "").trim();
            const recipientEmail = String(recipient?.recipientEmail ?? "").trim();

            if (!VALID_CERTIFICATE_TYPES.has(type) || !recipientName || !recipientEmail) {
                skipped += 1;
                continue;
            }

            const existing = await findExistingCertificate({
                eventId,
                memberId,
                type: type as CertificateType,
                recipientEmail,
            });
            if (existing) {
                skipped += 1;
                continue;
            }

            const verificationCode = await generateUniqueCertificationCode();
            const fieldValues = mergeCertificateFieldValues(
                templateDefaults.fieldValues,
                recipient?.fieldValues,
            );
            // Batch always keeps template issuer; recipient fieldValues must not wipe it with "".
            if (
                typeof templateDefaults.fieldValues.issuerName === "string"
                && (typeof fieldValues.issuerName !== "string" || !fieldValues.issuerName.trim())
            ) {
                fieldValues.issuerName = templateDefaults.fieldValues.issuerName;
            }

            const certificate = await prisma.certificate.create({
                data: {
                    templateId,
                    type: type as CertificateType,
                    status: issueImmediately ? "ISSUED" : "DRAFT",
                    eventId,
                    recipientMemberId: memberId,
                    recipientName,
                    recipientEmail,
                    title: event.title,
                    description: templateDefaults.description,
                    fieldValues: fieldValues as Prisma.InputJsonValue,
                    verificationCode,
                    issuedAt: issueImmediately ? new Date() : null,
                },
            });

            created += 1;
            certificateIds.push(certificate.id);
        }

        return res.json({ created, skipped, certificateIds });
    } catch (error) {
        console.error("POST /certificates/event/:eventId/issue-bulk error:", error);
        return res.status(500).json({ error: "Failed to bulk issue certificates" });
    }
});

router.get("/project/:projectId/eligible", async (req: Request, res: Response) => {
    if (!canManageCertificates(req.user)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const projectId = parseId(req.params.projectId);
    if (!projectId) return res.status(400).json({ error: "Invalid project id" });

    try {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            include: { projectType: { select: { name: true } } },
        });
        if (!project) return res.status(404).json({ error: "Project not found" });
        if (project.isFinalized !== true) {
            return res.status(400).json({ error: "Project must be finalized before issuing certificates" });
        }

        const [assignments, existingCerts] = await Promise.all([
            prisma.taskAssignment.findMany({
                where: { task: { projectId } },
                include: {
                    member: {
                        select: { id: true, fullName: true, email: true, phoneNumber: true },
                    },
                    task: { select: { leaderId: true } },
                },
            }),
            prisma.certificate.findMany({
                where: { projectId, status: { not: "REVOKED" } },
                select: { recipientMemberId: true, type: true, recipientEmail: true },
            }),
        ]);

        const alreadyIssued = buildAlreadyIssuedSet(existingCerts);
        const leaderMemberIds = new Set<number>();
        for (const assignment of assignments) {
            const leaderId = assignment.task.leaderId;
            if (leaderId) leaderMemberIds.add(leaderId);
        }

        const contributorsByMember = new Map<
            number,
            {
                memberId: number;
                fullName: string;
                email: string;
                phoneNumber: string | null;
                type: "LEADERSHIP" | "CONTRIBUTION";
                taskCount: number;
            }
        >();

        for (const assignment of assignments) {
            const member = assignment.member;
            const memberId = member.id;
            const existing = contributorsByMember.get(memberId);
            const type = leaderMemberIds.has(memberId) ? ("LEADERSHIP" as const) : ("CONTRIBUTION" as const);

            if (existing) {
                existing.taskCount += 1;
                existing.type = leaderMemberIds.has(memberId) ? "LEADERSHIP" : existing.type;
            } else {
                contributorsByMember.set(memberId, {
                    memberId,
                    fullName: member.fullName,
                    email: member.email,
                    phoneNumber: member.phoneNumber?.trim() || null,
                    type,
                    taskCount: 1,
                });
            }
        }

        const contributors = Array.from(contributorsByMember.values()).map((entry) => ({
            ...entry,
            alreadyIssued: alreadyIssued.has(certRecipientKey(entry.memberId, entry.type, entry.email)),
        }));

        return res.json({
            contributors,
            projectTitle: project.title,
            projectTypeName: project.projectType?.name ?? null,
        });
    } catch (error) {
        console.error("GET /certificates/project/:projectId/eligible error:", error);
        return res.status(500).json({ error: "Failed to load eligible contributors" });
    }
});

router.post("/project/:projectId/issue-bulk", async (req: Request, res: Response) => {
    if (!canManageCertificates(req.user)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const projectId = parseId(req.params.projectId);
    if (!projectId) return res.status(400).json({ error: "Invalid project id" });

    const recipients = req.body?.recipients;
    if (!Array.isArray(recipients)) {
        return res.status(400).json({ error: "recipients must be an array" });
    }

    const templateId = parseId(req.body?.templateId) ?? null;
    const issueImmediately = req.body?.issueImmediately === true;

    try {
        const project = await prisma.project.findUnique({
            where: { id: projectId },
            select: { id: true, title: true, isFinalized: true },
        });
        if (!project) return res.status(404).json({ error: "Project not found" });
        if (project.isFinalized !== true) {
            return res.status(400).json({ error: "Project must be finalized before issuing certificates" });
        }

        const templateDefaults = await loadTemplateIssueDefaults(templateId);

        let created = 0;
        let skipped = 0;
        const certificateIds: number[] = [];

        for (const recipient of recipients) {
            const memberId = parseId(recipient?.memberId) ?? null;
            const type = String(recipient?.type ?? "").trim();
            const recipientName = String(recipient?.recipientName ?? "").trim();
            const recipientEmail = String(recipient?.recipientEmail ?? "").trim();

            if (!VALID_CERTIFICATE_TYPES.has(type) || !recipientName || !recipientEmail) {
                skipped += 1;
                continue;
            }

            const existing = await findExistingCertificate({
                projectId,
                memberId,
                type: type as CertificateType,
                recipientEmail,
            });
            if (existing) {
                skipped += 1;
                continue;
            }

            const verificationCode = await generateUniqueCertificationCode();
            const fieldValues = mergeCertificateFieldValues(
                templateDefaults.fieldValues,
                recipient?.fieldValues,
            );
            // Batch always keeps template issuer; recipient fieldValues must not wipe it with "".
            if (
                typeof templateDefaults.fieldValues.issuerName === "string"
                && (typeof fieldValues.issuerName !== "string" || !fieldValues.issuerName.trim())
            ) {
                fieldValues.issuerName = templateDefaults.fieldValues.issuerName;
            }

            const certificate = await prisma.certificate.create({
                data: {
                    templateId,
                    type: type as CertificateType,
                    status: issueImmediately ? "ISSUED" : "DRAFT",
                    projectId,
                    recipientMemberId: memberId,
                    recipientName,
                    recipientEmail,
                    title: project.title,
                    description: templateDefaults.description,
                    fieldValues: fieldValues as Prisma.InputJsonValue,
                    verificationCode,
                    issuedAt: issueImmediately ? new Date() : null,
                },
            });

            created += 1;
            certificateIds.push(certificate.id);
        }

        return res.json({ created, skipped, certificateIds });
    } catch (error) {
        console.error("POST /certificates/project/:projectId/issue-bulk error:", error);
        return res.status(500).json({ error: "Failed to bulk issue certificates" });
    }
});

router.get("/", async (req: Request, res: Response) => {
    try {
        const status = typeof req.query.status === "string" ? req.query.status.trim() : undefined;
        const recipientMemberId = parseId(req.query.recipientMemberId);
        const isPublicList =
            !req.headers.authorization
            && status === "ISSUED"
            && recipientMemberId !== null;

        if (isPublicList) {
            const member = await prisma.member.findUnique({
                where: { id: recipientMemberId },
                select: { fullName: true, isActive: true, assignmentStatus: true },
            });
            const publiclyVisible =
                !!member
                && member.isActive
                && member.assignmentStatus !== "ALUMNI"
                && member.fullName !== "Pending";
            if (!publiclyVisible) {
                return res.status(404).json({ error: "Not found" });
            }

            const certificates = await prisma.certificate.findMany({
                where: { recipientMemberId, status: "ISSUED" },
                orderBy: { createdAt: "desc" },
                take: 200,
                select: {
                    id: true,
                    title: true,
                    description: true,
                    type: true,
                    issuedAt: true,
                    // verificationCode omitted from public list — use GET /verify/:code
                    event: { select: { id: true, title: true } },
                    project: { select: { id: true, title: true } },
                },
            });
            return res.json(certificates);
        }

        const where: Prisma.CertificateWhereInput = {};

        const eventId = parseId(req.query.eventId);
        const projectId = parseId(req.query.projectId);
        const type = typeof req.query.type === "string" ? req.query.type.trim() : undefined;

        if (eventId) where.eventId = eventId;
        if (projectId) where.projectId = projectId;
        if (status && VALID_CERTIFICATE_STATUSES.has(status)) {
            where.status = status as CertificateStatus;
        }
        if (type && VALID_CERTIFICATE_TYPES.has(type)) {
            where.type = type as CertificateType;
        }

        if (canManageCertificates(req.user)) {
            if (recipientMemberId) where.recipientMemberId = recipientMemberId;
        } else {
            where.recipientMemberId = req.user?.memberId ?? -1;
        }

        const certificates = await prisma.certificate.findMany({
            where,
            orderBy: { createdAt: "desc" },
            take: 200,
            include: listInclude,
        });

        return res.json(certificates);
    } catch (error) {
        console.error("GET /certificates error:", error);
        return res.status(500).json({ error: "Failed to load certificates" });
    }
});

router.post("/", async (req: Request, res: Response) => {
    if (!canManageCertificates(req.user)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const type = String(req.body?.type ?? "").trim();
    const recipientName = String(req.body?.recipientName ?? "").trim();
    const recipientEmail = String(req.body?.recipientEmail ?? "").trim();
    const title = String(req.body?.title ?? "").trim();
    // Description may be empty when the template has no Description element (or no template).
    const description = String(req.body?.description ?? "").trim();
    const templateId = parseId(req.body?.templateId) ?? null;

    if (!VALID_CERTIFICATE_TYPES.has(type)) {
        return res.status(400).json({ error: "Valid type is required" });
    }
    if (!recipientName || !recipientEmail || !title) {
        return res.status(400).json({ error: "recipientName, recipientEmail, and title are required" });
    }

    try {
        const templateDefaults = await loadTemplateIssueDefaults(templateId);
        const fieldValues = mergeCertificateFieldValues(
            templateDefaults.fieldValues,
            req.body?.fieldValues,
        );

        const verificationCode = await generateUniqueCertificationCode();
        const certificate = await prisma.certificate.create({
            data: {
                templateId,
                type: type as CertificateType,
                status: "DRAFT",
                eventId: parseId(req.body?.eventId) ?? null,
                projectId: parseId(req.body?.projectId) ?? null,
                recipientMemberId: parseId(req.body?.recipientMemberId) ?? null,
                recipientName,
                recipientEmail,
                title,
                description,
                fieldValues: fieldValues as Prisma.InputJsonValue,
                verificationCode,
            },
        });
        return res.status(201).json(certificate);
    } catch (error) {
        console.error("POST /certificates error:", error);
        return res.status(500).json({ error: "Failed to create certificate" });
    }
});

router.get("/:id", async (req: Request, res: Response) => {
    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid certificate id" });

    try {
        const certificate = await prisma.certificate.findUnique({ where: { id } });
        if (!certificate) return res.status(404).json({ error: "Certificate not found" });

        if (
            !canManageCertificates(req.user) &&
            certificate.recipientMemberId !== req.user?.memberId
        ) {
            return res.status(403).json({ error: "Forbidden" });
        }

        return res.json(certificate);
    } catch (error) {
        console.error("GET /certificates/:id error:", error);
        return res.status(500).json({ error: "Failed to load certificate" });
    }
});

router.patch("/:id/issue", async (req: Request, res: Response) => {
    if (!canManageCertificates(req.user)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid certificate id" });

    try {
        const certificate = await prisma.certificate.findUnique({ where: { id } });
        if (!certificate) return res.status(404).json({ error: "Certificate not found" });
        if (certificate.status !== "DRAFT") {
            return res.status(409).json({ error: "Certificate is not in DRAFT status" });
        }

        const updated = await prisma.certificate.update({
            where: { id },
            data: {
                status: "ISSUED",
                issuedAt: new Date(),
            },
        });
        return res.json(updated);
    } catch (error) {
        console.error("PATCH /certificates/:id/issue error:", error);
        return res.status(500).json({ error: "Failed to issue certificate" });
    }
});

router.patch("/:id/revoke", async (req: Request, res: Response) => {
    if (!canManageCertificates(req.user)) {
        return res.status(403).json({ error: "Forbidden" });
    }

    const id = parseId(req.params.id);
    if (!id) return res.status(400).json({ error: "Invalid certificate id" });

    try {
        const certificate = await prisma.certificate.findUnique({ where: { id } });
        if (!certificate) return res.status(404).json({ error: "Certificate not found" });
        if (certificate.status !== "ISSUED") {
            return res.status(409).json({ error: "Certificate is not in ISSUED status" });
        }

        const revokedReason =
            typeof req.body?.reason === "string" && req.body.reason.trim()
                ? req.body.reason.trim()
                : null;

        const updated = await prisma.certificate.update({
            where: { id },
            data: {
                status: "REVOKED",
                revokedAt: new Date(),
                revokedReason,
            },
        });
        return res.json(updated);
    } catch (error) {
        console.error("PATCH /certificates/:id/revoke error:", error);
        return res.status(500).json({ error: "Failed to revoke certificate" });
    }
});

export default router;
