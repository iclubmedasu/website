import express, { Request, Response } from "express";
import { prisma } from "../db";
import { isValidCustomFieldType, toJsonInput } from "../lib/customFields";
import {
    createIncidentReportSubmission,
    getEditorSupportPageData,
    getIncidentReportDetail,
    getNextFieldOrder,
    getNextFormSortOrder,
    getNextNoticeSortOrder,
    getSubmissionCountsByForm,
    listIncidentReports,
    listIncidentReportsForForm,
    reorderRecords,
    validateSupportLocale,
} from "../lib/supportContent";
import { exportFormSubmissionsExcel } from "../lib/incidentReportExport";
import { canEditSiteContent } from "../lib/supportPermissions";
import {
    requireSupportFormsEditor,
    requireSupportPageEditor,
} from "../middleware/auth";

const router = express.Router();

function parseId(value: string): number | null {
    const id = parseInt(value, 10);
    return Number.isNaN(id) ? null : id;
}

function trimString(value: unknown): string {
    return typeof value === "string" ? value.trim() : "";
}

router.post("/incident-reports", async (req: Request, res: Response) => {
    try {
        const formId = parseId(String(req.body?.formId ?? req.body?.reportTypeId ?? ""));
        if (formId == null) {
            return res.status(400).json({ error: "formId is required" });
        }

        const created = await createIncidentReportSubmission({
            formId,
            name: req.body?.name,
            email: req.body?.email,
            phone: req.body?.phone,
            description: req.body?.description,
            team: req.body?.team,
            fieldValues: req.body?.fieldValues,
            source: "PORTAL",
            submitterMemberId: req.user?.memberId ?? null,
        });
        return res.status(201).json(created);
    } catch (error) {
        const fieldErrors = (error as { fieldErrors?: Record<string, string> }).fieldErrors;
        if (fieldErrors) {
            return res.status(400).json({ error: "Validation failed", fieldErrors });
        }
        console.error("POST /site-content/support/incident-reports error:", error);
        return res.status(500).json({ error: "Failed to submit incident report" });
    }
});

router.get("/", requireSupportFormsEditor, async (req: Request, res: Response) => {
    try {
        const page = await getEditorSupportPageData();
        if (!page) {
            return res.status(404).json({ error: "Support page not found" });
        }

        if (!canEditSiteContent(req.user)) {
            return res.json({
                ...page,
                header: { eyebrow: "", title: "", description: "" },
                notices: [],
            });
        }

        return res.json(page);
    } catch (error) {
        console.error("GET /site-content/support error:", error);
        return res.status(500).json({ error: "Failed to fetch support page" });
    }
});

router.put("/header", requireSupportPageEditor, async (req: Request, res: Response) => {
    try {
        const eyebrow = trimString(req.body?.eyebrow);
        const title = trimString(req.body?.title);
        const description = trimString(req.body?.description);

        if (!eyebrow || !title || !description) {
            return res.status(400).json({ error: "eyebrow, title, and description are required" });
        }

        await prisma.sitePage.update({
            where: { id: "support" },
            data: { eyebrow, title, description },
        });

        const page = await getEditorSupportPageData();
        return res.json(page);
    } catch (error) {
        console.error("PUT /site-content/support/header error:", error);
        return res.status(500).json({ error: "Failed to update support header" });
    }
});

router.post("/notices", requireSupportPageEditor, async (req: Request, res: Response) => {
    try {
        const locale = trimString(req.body?.locale);
        const content = trimString(req.body?.content);
        if (!validateSupportLocale(locale) || !content) {
            return res.status(400).json({ error: "locale and content are required" });
        }

        const sortOrder = await getNextNoticeSortOrder();
        await prisma.supportNoticeBlock.create({
            data: { locale, content, sortOrder },
        });

        const page = await getEditorSupportPageData();
        return res.status(201).json(page);
    } catch (error) {
        console.error("POST /site-content/support/notices error:", error);
        return res.status(500).json({ error: "Failed to create notice block" });
    }
});

router.put("/notices/:id", requireSupportPageEditor, async (req: Request, res: Response) => {
    try {
        const noticeId = parseId(String(req.params.id));
        if (noticeId == null) {
            return res.status(400).json({ error: "Invalid notice ID" });
        }

        const existing = await prisma.supportNoticeBlock.findUnique({ where: { id: noticeId } });
        if (!existing) {
            return res.status(404).json({ error: "Notice block not found" });
        }

        const data: Record<string, unknown> = {};
        if (req.body?.locale !== undefined) {
            const locale = trimString(req.body.locale);
            if (!validateSupportLocale(locale)) {
                return res.status(400).json({ error: "Invalid locale" });
            }
            data.locale = locale;
        }
        if (req.body?.content !== undefined) {
            const content = trimString(req.body.content);
            if (!content) {
                return res.status(400).json({ error: "content is required" });
            }
            data.content = content;
        }

        await prisma.supportNoticeBlock.update({ where: { id: noticeId }, data: data as never });
        const page = await getEditorSupportPageData();
        return res.json(page);
    } catch (error) {
        console.error("PUT /site-content/support/notices/:id error:", error);
        return res.status(500).json({ error: "Failed to update notice block" });
    }
});

router.delete("/notices/:id", requireSupportPageEditor, async (req: Request, res: Response) => {
    try {
        const noticeId = parseId(String(req.params.id));
        if (noticeId == null) {
            return res.status(400).json({ error: "Invalid notice ID" });
        }

        const existing = await prisma.supportNoticeBlock.findUnique({ where: { id: noticeId } });
        if (!existing) {
            return res.status(404).json({ error: "Notice block not found" });
        }

        await prisma.supportNoticeBlock.delete({ where: { id: noticeId } });
        const page = await getEditorSupportPageData();
        return res.json(page);
    } catch (error) {
        console.error("DELETE /site-content/support/notices/:id error:", error);
        return res.status(500).json({ error: "Failed to delete notice block" });
    }
});

router.put("/notices/reorder", requireSupportPageEditor, async (req: Request, res: Response) => {
    try {
        const orderedIds = req.body?.orderedIds;
        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ error: "orderedIds must be an array" });
        }

        const notices = await prisma.supportNoticeBlock.findMany({ select: { id: true } });
        await reorderRecords(notices, orderedIds.map((id: unknown) => Number(id)), (id, sortOrder) =>
            prisma.supportNoticeBlock.update({ where: { id }, data: { sortOrder } }),
        );

        const page = await getEditorSupportPageData();
        return res.json(page);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to reorder notice blocks";
        console.error("PUT /site-content/support/notices/reorder error:", error);
        return res.status(400).json({ error: message });
    }
});

router.post("/forms", requireSupportFormsEditor, async (req: Request, res: Response) => {
    try {
        const label = trimString(req.body?.label);
        if (!label) {
            return res.status(400).json({ error: "label is required" });
        }

        const sortOrder = await getNextFormSortOrder();
        await prisma.incidentReportType.create({
            data: { label, sortOrder, isSystem: false, isActive: true },
        });

        const page = await getEditorSupportPageData();
        return res.status(201).json(page);
    } catch (error) {
        console.error("POST /site-content/support/forms error:", error);
        return res.status(500).json({ error: "Failed to create form" });
    }
});

router.put("/forms/:id", requireSupportFormsEditor, async (req: Request, res: Response) => {
    try {
        const formId = parseId(String(req.params.id));
        if (formId == null) {
            return res.status(400).json({ error: "Invalid form ID" });
        }

        const existing = await prisma.incidentReportType.findUnique({ where: { id: formId } });
        if (!existing) {
            return res.status(404).json({ error: "Form not found" });
        }

        const data: Record<string, unknown> = {};
        if (req.body?.label !== undefined) {
            const label = trimString(req.body.label);
            if (!label) {
                return res.status(400).json({ error: "label is required" });
            }
            data.label = label;
        }
        if (req.body?.isActive !== undefined) data.isActive = Boolean(req.body.isActive);

        await prisma.incidentReportType.update({ where: { id: formId }, data: data as never });
        const page = await getEditorSupportPageData();
        return res.json(page);
    } catch (error) {
        console.error("PUT /site-content/support/forms/:id error:", error);
        return res.status(500).json({ error: "Failed to update form" });
    }
});

router.delete("/forms/:id", requireSupportFormsEditor, async (req: Request, res: Response) => {
    try {
        const formId = parseId(String(req.params.id));
        if (formId == null) {
            return res.status(400).json({ error: "Invalid form ID" });
        }

        const existing = await prisma.incidentReportType.findUnique({ where: { id: formId } });
        if (!existing) {
            return res.status(404).json({ error: "Form not found" });
        }
        if (existing.isSystem) {
            return res.status(409).json({ error: "System forms cannot be deleted" });
        }

        await prisma.incidentReportType.delete({ where: { id: formId } });
        const page = await getEditorSupportPageData();
        return res.json(page);
    } catch (error) {
        console.error("DELETE /site-content/support/forms/:id error:", error);
        return res.status(500).json({ error: "Failed to delete form" });
    }
});

router.put("/forms/reorder", requireSupportFormsEditor, async (req: Request, res: Response) => {
    try {
        const orderedIds = req.body?.orderedIds;
        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ error: "orderedIds must be an array" });
        }

        const forms = await prisma.incidentReportType.findMany({ select: { id: true } });
        await reorderRecords(forms, orderedIds.map((id: unknown) => Number(id)), (id, sortOrder) =>
            prisma.incidentReportType.update({ where: { id }, data: { sortOrder } }),
        );

        const page = await getEditorSupportPageData();
        return res.json(page);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to reorder forms";
        console.error("PUT /site-content/support/forms/reorder error:", error);
        return res.status(400).json({ error: message });
    }
});

router.post("/forms/:formId/fields", requireSupportFormsEditor, async (req: Request, res: Response) => {
    try {
        const formId = parseId(String(req.params.formId));
        if (formId == null) {
            return res.status(400).json({ error: "Invalid form ID" });
        }

        const form = await prisma.incidentReportType.findUnique({ where: { id: formId } });
        if (!form) {
            return res.status(404).json({ error: "Form not found" });
        }

        const label = trimString(req.body?.label);
        const type = trimString(req.body?.type);
        if (!label || !type) {
            return res.status(400).json({ error: "label and type are required" });
        }
        if (!isValidCustomFieldType(type)) {
            return res.status(400).json({ error: "Invalid field type" });
        }

        const order = await getNextFieldOrder(formId);
        await prisma.incidentReportField.create({
            data: {
                formId,
                label,
                type,
                options: toJsonInput(req.body?.options),
                required: Boolean(req.body?.required),
                order: Number.isInteger(Number(req.body?.order)) ? Number(req.body.order) : order,
            },
        });

        const page = await getEditorSupportPageData();
        return res.status(201).json(page);
    } catch (error) {
        console.error("POST /site-content/support/forms/:formId/fields error:", error);
        return res.status(500).json({ error: "Failed to create field" });
    }
});

router.put("/forms/:formId/fields/:id", requireSupportFormsEditor, async (req: Request, res: Response) => {
    try {
        const formId = parseId(String(req.params.formId));
        const fieldId = parseId(String(req.params.id));
        if (formId == null || fieldId == null) {
            return res.status(400).json({ error: "Invalid form or field ID" });
        }

        const existing = await prisma.incidentReportField.findFirst({
            where: { id: fieldId, formId },
        });
        if (!existing) {
            return res.status(404).json({ error: "Field not found" });
        }

        const data: Record<string, unknown> = {};
        if (req.body?.label !== undefined) data.label = trimString(req.body.label);
        if (req.body?.type !== undefined) {
            const type = trimString(req.body.type);
            if (!isValidCustomFieldType(type)) {
                return res.status(400).json({ error: "Invalid field type" });
            }
            data.type = type;
        }
        if (req.body?.options !== undefined) data.options = toJsonInput(req.body.options);
        if (req.body?.required !== undefined) data.required = Boolean(req.body.required);
        if (req.body?.isActive !== undefined) data.isActive = Boolean(req.body.isActive);
        if (req.body?.order !== undefined && Number.isInteger(Number(req.body.order))) {
            data.order = Number(req.body.order);
        }

        await prisma.incidentReportField.update({ where: { id: fieldId }, data: data as never });
        const page = await getEditorSupportPageData();
        return res.json(page);
    } catch (error) {
        console.error("PUT /site-content/support/forms/:formId/fields/:id error:", error);
        return res.status(500).json({ error: "Failed to update field" });
    }
});

router.delete("/forms/:formId/fields/:id", requireSupportFormsEditor, async (req: Request, res: Response) => {
    try {
        const formId = parseId(String(req.params.formId));
        const fieldId = parseId(String(req.params.id));
        if (formId == null || fieldId == null) {
            return res.status(400).json({ error: "Invalid form or field ID" });
        }

        const existing = await prisma.incidentReportField.findFirst({
            where: { id: fieldId, formId },
        });
        if (!existing) {
            return res.status(404).json({ error: "Field not found" });
        }

        await prisma.incidentReportField.delete({ where: { id: fieldId } });
        const page = await getEditorSupportPageData();
        return res.json(page);
    } catch (error) {
        console.error("DELETE /site-content/support/forms/:formId/fields/:id error:", error);
        return res.status(500).json({ error: "Failed to delete field" });
    }
});

router.patch("/forms/:formId/fields/reorder", requireSupportFormsEditor, async (req: Request, res: Response) => {
    try {
        const formId = parseId(String(req.params.formId));
        if (formId == null) {
            return res.status(400).json({ error: "Invalid form ID" });
        }

        const order = Array.isArray(req.body?.order) ? req.body.order : [];
        if (order.length === 0) {
            return res.status(400).json({ error: "order array is required" });
        }

        await prisma.$transaction(
            order.map((entry: { id?: unknown; order?: unknown }, index: number) => {
                const fieldId = parseId(String(entry?.id ?? ""));
                if (!fieldId) {
                    throw new Error("Invalid field order payload");
                }
                return prisma.incidentReportField.update({
                    where: { id: fieldId },
                    data: {
                        order: Number.isInteger(Number(entry?.order)) ? Number(entry.order) : index,
                    },
                });
            }),
        );

        const page = await getEditorSupportPageData();
        return res.json(page);
    } catch (error) {
        console.error("PATCH /site-content/support/forms/:formId/fields/reorder error:", error);
        return res.status(500).json({ error: "Failed to reorder fields" });
    }
});

router.get("/reports/counts", requireSupportFormsEditor, async (_req: Request, res: Response) => {
    try {
        const counts = await getSubmissionCountsByForm();
        return res.json({ counts });
    } catch (error) {
        console.error("GET /site-content/support/reports/counts error:", error);
        return res.status(500).json({ error: "Failed to fetch submission counts" });
    }
});

router.get("/forms/:formId/reports", requireSupportFormsEditor, async (req: Request, res: Response) => {
    try {
        const formId = parseId(String(req.params.formId));
        if (formId == null) {
            return res.status(400).json({ error: "Invalid form ID" });
        }

        const reports = await listIncidentReportsForForm(formId);
        return res.json({ reports, total: reports.length });
    } catch (error) {
        console.error("GET /site-content/support/forms/:formId/reports error:", error);
        return res.status(500).json({ error: "Failed to fetch form submissions" });
    }
});

router.get("/forms/:formId/reports/export", requireSupportFormsEditor, async (req: Request, res: Response) => {
    try {
        const formId = parseId(String(req.params.formId));
        if (formId == null) {
            return res.status(400).json({ error: "Invalid form ID" });
        }

        const { buffer, fileName } = await exportFormSubmissionsExcel(formId);
        res.setHeader(
            "Content-Type",
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        );
        res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
        return res.send(buffer);
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to export submissions";
        if (message === "Form not found") {
            return res.status(404).json({ error: message });
        }
        console.error("GET /site-content/support/forms/:formId/reports/export error:", error);
        return res.status(500).json({ error: "Failed to export submissions" });
    }
});

router.get("/reports", requireSupportFormsEditor, async (req: Request, res: Response) => {
    try {
        const limit = Number(req.query.limit);
        const offset = Number(req.query.offset);
        const formId = parseId(String(req.query.formId ?? ""));
        const result = await listIncidentReports({
            limit: Number.isFinite(limit) ? limit : undefined,
            offset: Number.isFinite(offset) ? offset : undefined,
            formId: formId ?? undefined,
        });
        return res.json(result);
    } catch (error) {
        console.error("GET /site-content/support/reports error:", error);
        return res.status(500).json({ error: "Failed to fetch incident reports" });
    }
});

router.get("/reports/:id", requireSupportFormsEditor, async (req: Request, res: Response) => {
    try {
        const reportId = parseId(String(req.params.id));
        if (reportId == null) {
            return res.status(400).json({ error: "Invalid report ID" });
        }

        const report = await getIncidentReportDetail(reportId);
        if (!report) {
            return res.status(404).json({ error: "Incident report not found" });
        }

        return res.json(report);
    } catch (error) {
        console.error("GET /site-content/support/reports/:id error:", error);
        return res.status(500).json({ error: "Failed to fetch incident report" });
    }
});

export default router;
