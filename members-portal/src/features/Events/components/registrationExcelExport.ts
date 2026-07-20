import { CLUB_TIMEZONE } from '@iclub/shared/utils';
import type { EventCustomFieldRef, EventRegistrationRef, EventSessionRef } from '@/types/backend-contracts';
import { downloadBlob } from '@/utils/downloadBlob';
import {
    XLSX_MIME,
    buildAttendanceLogMatrix,
    buildMemberSummaryMatrix,
    buildOverviewMatrix,
    buildRegistrationMatrix,
    buildSessionAttendanceMatrix,
    buildSessionDateById,
    buildSessionSummaryMatrix,
    buildTierSummaryMatrix,
    computeMemberMetrics,
    computeOverviewKpis,
    computeSessionMetrics,
    computeTierMetrics,
    sanitizeFileName,
} from './registrationExcel/builders';
import {
    addOverviewPieChart,
    addSessionSummaryBarChart,
    addTierSummaryBarChart,
} from './registrationExcel/charts';
import { styleDataSheet, styleOverviewSheet } from './registrationExcel/styling';

export interface ExportEventRegistrationsExcelOptions {
    registrations: EventRegistrationRef[];
    fields: EventCustomFieldRef[];
    sessions?: EventSessionRef[];
    multiDayEvent: boolean;
    fileName: string;
    eventTimezone?: string;
}

export async function exportEventRegistrationsExcel({
    registrations,
    fields,
    sessions = [],
    multiDayEvent,
    fileName,
    eventTimezone = CLUB_TIMEZONE,
}: ExportEventRegistrationsExcelOptions): Promise<void> {
    const ExcelJS = await import('exceljs');
    const workbook = new ExcelJS.Workbook();

    const sessionDateById = buildSessionDateById(sessions, eventTimezone);
    const overviewKpis = computeOverviewKpis(registrations);
    const sessionMetrics = computeSessionMetrics(registrations, sessions);
    const memberMetrics = computeMemberMetrics(registrations, sessions);
    const tierMetrics = computeTierMetrics(registrations);

    const overviewMatrix = buildOverviewMatrix(overviewKpis);
    const registrationMatrix = buildRegistrationMatrix(
        registrations,
        fields,
        multiDayEvent,
        sessionDateById,
    );
    const memberSummaryMatrix = buildMemberSummaryMatrix(memberMetrics);
    const sessionSummaryMatrix = buildSessionSummaryMatrix(sessionMetrics);
    const tierSummaryMatrix = buildTierSummaryMatrix(tierMetrics);
    const sessionAttendanceMatrix = buildSessionAttendanceMatrix(registrations, sessions);
    const attendanceLogMatrix = buildAttendanceLogMatrix(registrations, sessions);

    const overviewSheet = workbook.addWorksheet('Overview');
    styleOverviewSheet(overviewSheet, overviewMatrix);
    addOverviewPieChart(workbook, overviewSheet, overviewKpis);

    const registrationsSheet = workbook.addWorksheet('Registrations');
    styleDataSheet(registrationsSheet, registrationMatrix);

    const memberSummarySheet = workbook.addWorksheet('Member Summary');
    styleDataSheet(memberSummarySheet, memberSummaryMatrix);

    const sessionSummarySheet = workbook.addWorksheet('Session Summary');
    styleDataSheet(sessionSummarySheet, sessionSummaryMatrix);
    addSessionSummaryBarChart(workbook, sessionSummarySheet, sessionMetrics, sessionSummaryMatrix.length);

    const tierSummarySheet = workbook.addWorksheet('Tier Summary');
    styleDataSheet(tierSummarySheet, tierSummaryMatrix);
    if (tierMetrics.length > 0) {
        addTierSummaryBarChart(workbook, tierSummarySheet, tierMetrics, tierSummaryMatrix.length);
    }

    const sessionAttendanceSheet = workbook.addWorksheet('Session Attendance');
    styleDataSheet(sessionAttendanceSheet, sessionAttendanceMatrix);

    const attendanceLogSheet = workbook.addWorksheet('Attendance Log');
    styleDataSheet(attendanceLogSheet, attendanceLogMatrix);

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: XLSX_MIME });
    downloadBlob(blob, `${sanitizeFileName(fileName)}-registrations.xlsx`);
}
