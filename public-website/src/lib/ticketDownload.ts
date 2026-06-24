function triggerDownload(href: string, filename: string): void {
    const link = document.createElement("a");
    link.href = href;
    link.download = filename;
    link.click();
}

export function downloadDataUrlAsPng(dataUrl: string, filename: string): void {
    triggerDownload(dataUrl, filename);
}

async function renderElementToCanvas(element: HTMLElement): Promise<HTMLCanvasElement> {
    const html2canvasModule = await import("html2canvas");
    const html2canvas = html2canvasModule.default;
    return html2canvas(element, {
        backgroundColor: "#ffffff",
        scale: Math.min(2, window.devicePixelRatio || 1),
        useCORS: true,
    });
}

export async function downloadTicketAsPng(element: HTMLElement, filename: string): Promise<void> {
    const canvas = await renderElementToCanvas(element);
    const dataUrl = canvas.toDataURL("image/png");
    triggerDownload(dataUrl, filename.endsWith(".png") ? filename : `${filename}.png`);
}

export async function downloadTicketAsPdf(element: HTMLElement, filename: string): Promise<void> {
    const canvas = await renderElementToCanvas(element);
    const imageData = canvas.toDataURL("image/jpeg", 0.95);

    const { jsPDF } = await import("jspdf");
    const orientation = canvas.width >= canvas.height ? "landscape" : "portrait";
    const pdf = new jsPDF({
        orientation,
        unit: "px",
        format: [canvas.width, canvas.height],
    });

    pdf.addImage(imageData, "JPEG", 0, 0, canvas.width, canvas.height);
    pdf.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}
