import { describe, expect, it } from "vitest";
import {
    FR_TEAM_NAME_ALIASES,
    computeIsFinanceViewer,
    isFrHeadOrViceFromMemberships,
    isFrTeamName,
} from "../../lib/financePermissions";

describe("financePermissions", () => {
    it("recognizes FR team name aliases", () => {
        for (const alias of FR_TEAM_NAME_ALIASES) {
            expect(isFrTeamName(alias)).toBe(true);
            expect(isFrTeamName(` ${alias.toUpperCase()} `)).toBe(true);
        }
        expect(isFrTeamName("Projects")).toBe(false);
    });

    it("grants finance viewer to FR head or vice", () => {
        const memberships = [
            {
                team: { name: "Finance" },
                role: { roleName: "Head of Team", systemRoleKey: 1 },
            },
        ];
        expect(isFrHeadOrViceFromMemberships(memberships)).toBe(true);
        expect(computeIsFinanceViewer(memberships)).toBe(true);
    });

    it("denies finance viewer for regular FR members", () => {
        const memberships = [
            {
                team: { name: "FR" },
                role: { roleName: "Member", systemRoleKey: 3 },
            },
        ];
        expect(isFrHeadOrViceFromMemberships(memberships)).toBe(false);
        expect(computeIsFinanceViewer(memberships)).toBe(false);
    });

    it("grants finance viewer to officers and admins", () => {
        expect(computeIsFinanceViewer([], { isOfficer: true })).toBe(true);
        expect(computeIsFinanceViewer([], { isAdmin: true })).toBe(true);
        expect(computeIsFinanceViewer([], { isDeveloper: true })).toBe(true);
    });

    it("grants finance viewer to Accounting head but not regular member", () => {
        const headMemberships = [
            {
                team: { name: "Accounting" },
                role: { roleName: "Head of Team", systemRoleKey: 1 },
            },
        ];
        const memberMemberships = [
            {
                team: { name: "Accounting" },
                role: { roleName: "Member", systemRoleKey: 3 },
            },
        ];

        expect(isFrTeamName("Finance Resources")).toBe(true);
        expect(isFrTeamName("Financial Resources")).toBe(true);
        expect(computeIsFinanceViewer(headMemberships)).toBe(true);
        expect(computeIsFinanceViewer(memberMemberships)).toBe(false);
    });
});
