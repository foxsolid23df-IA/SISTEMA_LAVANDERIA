import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

export async function generateRemisionPDF(element, fileName = 'nota-remision') {
  const canvas = await html2canvas(element, {
    scale: 3,
    useCORS: true,
    allowTaint: true,
    backgroundColor: '#ffffff',
    width: 408,
    height: 529,
  });

  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'cm',
    format: [10.8, 14],
  });

  const imgData = canvas.toDataURL('image/png');
  pdf.addImage(imgData, 'PNG', 0, 0, 10.8, 14);
  pdf.save(`${fileName}.pdf`);
}
