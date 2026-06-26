import { prisma } from "../db";

const ADMINISTRATION_TEAM_NAME = "Administration";

export interface PublicMemberCardData {
    id: number;
    fullName: string;
    roleLabel: string;
    teamId?: number | null;
    teamName?: string | null;
    profilePhotoUrl?: string | null;
}

export interface PublicTeamLeadershipRowData {
    teamId: number;
    teamName: string;
    head: PublicMemberCardData | null;
    vice: PublicMemberCardData | null;
}

export interface PublicMemberFilterTeamData {
    id: number;
    name: string;
}

export interface PublicMemberDirectoryData {
    officer: PublicMemberCardData | null;
    president: PublicMemberCardData | null;
    vicePresident: PublicMemberCardData | null;
    teamLeadership: PublicTeamLeadershipRowData[];
    filterTeams: PublicMemberFilterTeamData[];
    members: PublicMemberCardData[];
}

type MemberPick = {
    id: number;
    fullName: string;
    profilePhotoUrl: string | null;
};

function isEligibleMember(member: { fullName: string; isActive: boolean; assignmentStatus: string }): boolean {
    return member.isActive && member.assignmentStatus !== "ALUMNI" && member.fullName !== "Pending";
}

function toCard(
    member: MemberPick,
    roleLabel: string,
    teamName?: string | null,
    teamId?: number | null,
): PublicMemberCardData {
    return {
        id: member.id,
        fullName: member.fullName,
        roleLabel,
        teamId: teamId ?? null,
        teamName: teamName ?? null,
        profilePhotoUrl: member.profilePhotoUrl ? "/profile-photo" : null,
    };
}

function shuffleMembers<T>(items: T[]): T[] {
    const result = [...items];
    for (let i = result.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

function findAdminRole(
    members: Array<{
        member: MemberPick & { isActive: boolean; assignmentStatus: string };
        role: { roleName: string };
    }>,
    roleName: string,
    adminTeamId: number | null,
): PublicMemberCardData | null {
    const row = members.find(
        (tm) => tm.role.roleName === roleName && isEligibleMember(tm.member),
    );
    if (!row) return null;
    return toCard(row.member, roleName, ADMINISTRATION_TEAM_NAME, adminTeamId);
}

export async function buildPublicMemberDirectory(): Promise<PublicMemberDirectoryData> {
    const adminTeam = await prisma.team.findFirst({
        where: { name: ADMINISTRATION_TEAM_NAME, isActive: true },
        include: {
            members: {
                where: { isActive: true },
                include: {
                    member: {
                        select: {
                            id: true,
                            fullName: true,
                            profilePhotoUrl: true,
                            isActive: true,
                            assignmentStatus: true,
                        },
                    },
                    role: { select: { roleName: true } },
                },
            },
        },
    });

    const adminMembers = adminTeam?.members ?? [];
    const adminTeamId = adminTeam?.id ?? null;
    const officer = findAdminRole(adminMembers, "Officer", adminTeamId);
    const president = findAdminRole(adminMembers, "President", adminTeamId);
    const vicePresident = findAdminRole(adminMembers, "Vice President", adminTeamId);

    const pyramidMemberIds = new Set<number>();
    for (const card of [officer, president, vicePresident]) {
        if (card) pyramidMemberIds.add(card.id);
    }

    const teams = await prisma.team.findMany({
        where: {
            isActive: true,
            name: { not: ADMINISTRATION_TEAM_NAME },
        },
        orderBy: { name: "asc" },
        include: {
            members: {
                where: { isActive: true },
                include: {
                    member: {
                        select: {
                            id: true,
                            fullName: true,
                            profilePhotoUrl: true,
                            isActive: true,
                            assignmentStatus: true,
                        },
                    },
                    role: { select: { roleName: true, systemRoleKey: true } },
                },
            },
        },
    });

    const teamLeadership: PublicTeamLeadershipRowData[] = [];

    for (const team of teams) {
        let head: PublicMemberCardData | null = null;
        let vice: PublicMemberCardData | null = null;

        for (const tm of team.members) {
            if (!isEligibleMember(tm.member)) continue;

            const roleKey = tm.role.systemRoleKey;
            if (roleKey === 1) {
                head = toCard(tm.member, "Head of Team", team.name, team.id);
                pyramidMemberIds.add(tm.member.id);
            } else if (roleKey === 2) {
                vice = toCard(tm.member, "Vice Head of Team", team.name, team.id);
                pyramidMemberIds.add(tm.member.id);
            }
        }

        if (head || vice) {
            teamLeadership.push({
                teamId: team.id,
                teamName: team.name,
                head,
                vice,
            });
        }
    }

    const eligibleMembers = await prisma.member.findMany({
        where: {
            isActive: true,
            assignmentStatus: { not: "ALUMNI" },
            fullName: { not: "Pending" },
            id: { notIn: [...pyramidMemberIds] },
        },
        select: {
            id: true,
            fullName: true,
            profilePhotoUrl: true,
            teamMemberships: {
                where: { isActive: true },
                include: {
                    team: { select: { id: true, name: true } },
                    role: { select: { roleName: true } },
                },
                orderBy: { joinedDate: "asc" },
            },
        },
        orderBy: { id: "asc" },
    });

    const filterTeams: PublicMemberFilterTeamData[] = teams.map((team) => ({
        id: team.id,
        name: team.name,
    }));

    const members: PublicMemberCardData[] = eligibleMembers.map((member) => {
        const primary = member.teamMemberships?.[0];
        const roleLabel = primary
            ? `${primary.role.roleName} — ${primary.team.name}`
            : "Member";
        const teamName = primary?.team.name ?? null;
        const teamId = primary?.team.id ?? null;

        return toCard(
            { id: member.id, fullName: member.fullName, profilePhotoUrl: member.profilePhotoUrl },
            roleLabel,
            teamName,
            teamId,
        );
    });

    return {
        officer,
        president,
        vicePresident,
        teamLeadership,
        filterTeams,
        members: shuffleMembers(members),
    };
}
