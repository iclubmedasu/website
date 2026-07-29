'use client';

import { useMemo } from 'react';
import { useAuth } from '@/context/AuthContext';
import type { Id } from '@/types/backend-contracts';

export type DocumentRank = 'ORG_LEADERSHIP' | 'TEAM_LEADERSHIP';

export interface DocumentPermissions {
    rank: DocumentRank | null;
    ledTeamIds: Id[];
    canUpload: boolean;
    /** Org leadership: developer / officer / president / VP — access logs + full visibility. */
    isOrgLeadership: boolean;
    /** @deprecated Use isOrgLeadership */
    isOfficerTier: boolean;
}

/**
 * Derives document upload rank from AuthContext — no backend permissions endpoint.
 * ORG_LEADERSHIP = developer | officer | admin (President/VP).
 * TEAM_LEADERSHIP = Head/Vice on non-Admin teams.
 */
export function useDocumentPermissions(): DocumentPermissions {
    const { user } = useAuth();

    return useMemo(() => {
        const isOrgLeadership = !!(user?.isDeveloper || user?.isOfficer || user?.isAdmin);
        const rank: DocumentRank | null = isOrgLeadership
            ? 'ORG_LEADERSHIP'
            : user?.isLeadership
              ? 'TEAM_LEADERSHIP'
              : null;
        const ledTeamIds = user?.leadershipTeamIds ?? [];
        const canUpload = rank != null;
        return {
            rank,
            ledTeamIds,
            canUpload,
            isOrgLeadership,
            isOfficerTier: isOrgLeadership,
        };
    }, [
        user?.isOfficer,
        user?.isLeadership,
        user?.leadershipTeamIds,
        user?.isDeveloper,
        user?.isAdmin,
    ]);
}
