import type JSZip from 'jszip';

export const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

export async function generateXlsxBlob(workbookZip: JSZip): Promise<Blob> {
    return workbookZip.generateAsync({
        type: 'blob',
        mimeType: XLSX_MIME,
        compression: 'DEFLATE',
    });
}
