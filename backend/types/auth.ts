export type RequestUser = {
    userId?: number;
    memberId?: number;
    email?: string;
    isDeveloper?: boolean;
    isOfficer?: boolean;
    isAdmin?: boolean;
    isLeadership?: boolean;
    isSpecial?: boolean;
    teamIds?: number[];
    leadershipTeamIds?: number[];
};
