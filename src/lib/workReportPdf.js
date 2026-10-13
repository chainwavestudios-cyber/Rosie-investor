import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Captures the report element and generates a multi-page A3 portrait PDF.
 * @param {HTMLElement} element — the report content container
 */
export async function downloadWorkReportA3(element) {
  const canvas = await html2canvas(element, {
    scale: 2,
    backgroundColor: '#0a0f1e',
    useCORS: true,
    logging: false,
  });

  const pdf = new jsPDF('p', 'mm', 'a3');
  const pageWidth = pdf.internal.pageSize.getWidth();   // 297mm
  const pageHeight = pdf.internal.pageSize.getHeight(); // 420mm
  const margin = 8;
  const usableWidth = pageWidth - 2 * margin;   // 281mm
  const usableHeight = pageHeight - 2 * margin; // 404mm

  const imgWidth = usableWidth;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;
  const imgData = canvas.toDataURL('image/jpeg', 0.95);

  const totalPages = Math.ceil(imgHeight / usableHeight);

  for (let i = 0; i < totalPages; i++) {
    if (i > 0) pdf.addPage();
    const yOffset = margin - (i * usableHeight);
    pdf.addImage(imgData, 'JPEG', margin, yOffset, imgWidth, imgHeight);
  }

  pdf.save('Settlement_IQ_WorkReport_A3.pdf');
}