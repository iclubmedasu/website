/**
 * Authority flags for JWT / session.
 *
 * roleType vocabulary (DB / UI):
 *   Officer | Administration | Leadership | Special Roles | Regular
 *
 * systemRoleKey:
 *   1=Head, 2=Vice, 3=Member (normal teams)
 *   10=Officer, 11=President, 12=Vice President (Administration only)
 *   null=custom
 *
 * Flags:
 *   isOfficer / isAdmin — Administration team + roleName (primary); keys 10/11/12 as backup
 *   isLeadership — non-Admin Head/Vice (keys 1|2 or role names)
 *   isSpecial — non-Admin roleType === "Special Roles" only
 *
 * Authority levels: 1=Officer/Developer, 2=President/Vice, 3=Heads/Vice heads,
 * 4=Special roles, 5=Regular.
 */

export const ADMINISTRATION_TEAM_NAME = 'Administration';

/** Administration system keys (do not reuse 1/2/3). */
export const ADMIN_SYSTEM_ROLE_KEY = {
    OFFICER: 10,
    PRESIDENT: 11,
    VICE_PRESIDENT: 12,
} as const;

export type AuthorityMembership = {
    team?: { name?: string | null } | null;
    role?: {
        roleName?: string | null;
        roleType?: string | null;
        systemRoleKey?: number | string | null;
    } | null;
};

export function computeAuthorityFlags(
    teamMemberships: AuthorityMembership[] | null | undefined,
    isDeveloper = false,
): {
    isOfficer: boolean;
    isAdmin: boolean;
    isLeadership: boolean;
    isSpecial: boolean;
} {
    const list = teamMemberships || [];
    let isOfficer = isDeveloper;
    let isAdmin = false;
    let isLeadership = false;
    let isSpecial = false;

    for (const tm of list) {
        const teamName = tm.team?.name;
        const roleName = tm.role?.roleName;
        const roleType = tm.role?.roleType ?? null;
        const systemRoleKey = tm.role?.systemRoleKey ?? null;
        const inAdmin = teamName === ADMINISTRATION_TEAM_NAME;
        const keyNum = systemRoleKey != null ? Number(systemRoleKey) : null;

        if (inAdmin && (roleName === 'Officer' || keyNum === ADMIN_SYSTEM_ROLE_KEY.OFFICER)) {
            isOfficer = true;
        }
        if (
            inAdmin
            && (
                roleName === 'President'
                || roleName === 'Vice President'
                || keyNum === ADMIN_SYSTEM_ROLE_KEY.PRESIDENT
                || keyNum === ADMIN_SYSTEM_ROLE_KEY.VICE_PRESIDENT
            )
        ) {
            isAdmin = true;
        }

        // Head (systemRoleKey 1) or Vice Head (2); use Number() so string values from JSON still match
        if (!inAdmin && (keyNum === 1 || keyNum === 2)) isLeadership = true;
        // Fallback: role name indicates leadership even if systemRoleKey missing (e.g. legacy data)
        if (!inAdmin && (roleName === 'Head of Team' || roleName === 'Vice Head of Team')) isLeadership = true;

        // Special Roles category only — custom Regular titles must stay assignment-only
        if (!inAdmin && roleType === 'Special Roles') isSpecial = true;
    }

    return { isOfficer, isAdmin, isLeadership, isSpecial };
}
