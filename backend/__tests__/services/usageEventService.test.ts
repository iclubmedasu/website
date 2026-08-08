import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createMock = vi.fn();

vi.mock("../../db", () => ({
    prisma: {
        usageEvent: {
            create: (...args: unknown[]) => createMock(...args),
        },
    },
}));

import {
    recordUsageEvent,
    USAGE_ACTION_TYPES,
} from "../../services/usageEventService";

describe("usageEventService.recordUsageEvent", () => {
    beforeEach(() => {
        createMock.mockReset();
        createMock.mockResolvedValue({ id: 1 });
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("creates a usage event with sanitized fields", async () => {
        await recordUsageEvent({
            memberId: 7,
            actionType: USAGE_ACTION_TYPES.EVENT_CREATED,
            entityType: "Event",
            entityId: 42,
        });

        expect(createMock).toHaveBeenCalledWith({
            data: {
                memberId: 7,
                actionType: "EVENT_CREATED",
                entityType: "Event",
                entityId: 42,
            },
        });
    });

    it("never throws when prisma fails", async () => {
        createMock.mockRejectedValueOnce(new Error("db down"));
        await expect(
            recordUsageEvent({
                actionType: USAGE_ACTION_TYPES.LOGIN,
                memberId: 1,
            }),
        ).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalled();
    });

    it("skips empty action types", async () => {
        await recordUsageEvent({ actionType: "   " });
        expect(createMock).not.toHaveBeenCalled();
    });
});
