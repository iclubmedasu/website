export function canManageAnnouncements(user: any): boolean {
    if (!user?.memberId) return false;
    return !!(user.isDeveloper || user.isOfficer || user.isAdmin || user.isLeadership || user.isSpecial);
}
