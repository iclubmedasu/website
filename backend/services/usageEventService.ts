import { prisma } from "../db";

/** Canonical action types for product usage analytics (IDs only — no PII). */
export const USAGE_ACTION_TYPES = {
    EVENT_CREATED: "EVENT_CREATED",
    CERTIFICATE_ISSUED: "CERTIFICATE_ISSUED",
    CHECK_IN_SCANNED: "CHECK_IN_SCANNED",
    REGISTRATION_CREATED: "REGISTRATION_CREATED",
    DATA_EXPORTED: "DATA_EXPORTED",
    LOGIN: "LOGIN",
} as const;

export type UsageActionType = (typeof USAGE_ACTION_TYPES)[keyof typeof USAGE_ACTION_TYPES];

export type RecordUsageEventInput = {
    memberId?: number | null;
    actionType: UsageActionType | string;
    entityType?: string | null;
    entityId?: number | null;
};

/**
 * Records a usage event for product analytics.
 * Never throws — logging failures must not break the feature that called this.
 */
export async function recordUsageEvent(input: RecordUsageEventInput): Promise<void> {
    try {
        const actionType = String(input.actionType ?? "").trim();
        if (!actionType) return;

        const memberId =
            typeof input.memberId === "number" && Number.isInteger(input.memberId) && input.memberId > 0
                ? input.memberId
                : null;
        const entityId =
            typeof input.entityId === "number" && Number.isInteger(input.entityId) && input.entityId > 0
                ? input.entityId
                : null;
        const entityType =
            typeof input.entityType === "string" && input.entityType.trim()
                ? input.entityType.trim()
                : null;

        await prisma.usageEvent.create({
            data: {
                memberId,
                actionType,
                entityType,
                entityId,
            },
        });
    } catch (error) {
        console.error("recordUsageEvent failed:", error);
    }
}
