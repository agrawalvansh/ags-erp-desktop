import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { NotoSansDevanagariBase64 } from '../../assets/fonts/NotoSansDevanagari';

// ─── Formatting helpers ───
const formatIndian = (num) => {
  const n = Number(num);
  if (isNaN(n)) return '0';
  return n.toLocaleString('en-IN');
};

const fmtNum = (value) => {
  const num = parseFloat(value) || 0;
  if (Number.isInteger(num)) return num.toString();
  return num.toFixed(2);
};

const fmtQty = (val) => {
  const n = parseFloat(val) || 0;
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(3);
};

const fmtDate = (dateStr) => {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return dateStr;
  }
};

/**
 * Register Devanagari font with a jsPDF doc instance.
 */
function registerDevanagariFont(doc) {
  try {
    doc.addFileToVFS('NotoSansDevanagari.ttf', NotoSansDevanagariBase64);
    doc.addFont('NotoSansDevanagari.ttf', 'NotoSansDevanagari', 'normal');
    return true;
  } catch (e) {
    console.error('Failed to register Devanagari font:', e);
    return false;
  }
}

/**
 * Generate a professional B&W Quick Sale PDF.
 * Returns { pdfBase64, fileName }
 */
export function generateQuickSalePDF(data) {
  const {
    qsId, saleDate, invoiceItems, total,
    roundOff, grandTotal, remark,
    printMarathi, marathiNames,
    isPrivateNote
  } = data;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  // ─── Colors (B&W only) ───
  const black = [0, 0, 0];
  const darkGray = [60, 60, 60];
  const medGray = [120, 120, 120];
  const borderGray = [180, 180, 180];
  const white = [255, 255, 255];

  // ─── Register Devanagari font if needed ───
  let hasDevanagari = false;
  if (printMarathi) {
    hasDevanagari = registerDevanagariFont(doc);
  }

  const setDefaultFont = (style = 'normal') => {
    doc.setFont('helvetica', style);
  };

  // ─── HEADER ───
  y = 12;

  // Title centered
  setDefaultFont('bold');
  doc.setFontSize(16);
  doc.setTextColor(...black);
  doc.text('QUICK SALE', pageWidth / 2, y + 3, { align: 'center' });

  y += 10;

  // ─── Sale details (right-aligned) ───
  const rightValX = pageWidth - margin;
  const rightLabelX = pageWidth - margin - 62;
  let rightY = y;

  setDefaultFont('bold');
  doc.setFontSize(8);
  doc.setTextColor(...medGray);
  doc.text('QS DETAILS', rightValX, rightY, { align: 'right' });
  rightY += 5;

  const drawDetailRow = (label, value) => {
    setDefaultFont('normal');
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);
    doc.text(label, rightLabelX, rightY);
    setDefaultFont('bold');
    doc.setTextColor(...black);
    doc.text(String(value || ''), rightValX, rightY, { align: 'right' });
    rightY += 4.5;
  };

  drawDetailRow('QS Number:', qsId);
  drawDetailRow('Date:', fmtDate(saleDate));

  y = rightY + 4;

  // ─── ITEMS TABLE ───
  const tableColumns = [
    { header: '#', dataKey: 'sno' },
    { header: 'Product', dataKey: 'product' },
    { header: 'Size', dataKey: 'size' },
    { header: 'Qty', dataKey: 'qty' },
    { header: 'Unit', dataKey: 'unit' },
    { header: 'Rate', dataKey: 'rate' },
    { header: 'Amount', dataKey: 'amount' },
  ];

  const tableRows = invoiceItems.map((item, index) => {
    let productName = item.productName || '';
    if (printMarathi && marathiNames) {
      const code = item.code || item.product_code;
      if (code && marathiNames[code]) {
        productName = marathiNames[code];
      }
    }
    return {
      sno: String(index + 1),
      product: productName,
      size: item.size || '-',
      qty: fmtQty(item.quantity),
      unit: item.packingType || '',
      rate: fmtNum(item.sellingPrice),
      amount: fmtNum(item.amount),
    };
  });

  const hasMarathiRows = printMarathi && hasDevanagari;

  autoTable(doc, {
    startY: y,
    head: [tableColumns.map(c => c.header)],
    body: tableRows.map(r => tableColumns.map(c => r[c.dataKey])),
    theme: 'grid',
    headStyles: {
      fillColor: white,
      textColor: black,
      fontSize: 8,
      fontStyle: 'bold',
      cellPadding: 2.5,
      halign: 'center',
      valign: 'middle',
      lineColor: borderGray,
      lineWidth: 0.2,
      font: 'helvetica',
    },
    styles: {
      fontSize: 9,
      cellPadding: 2,
      overflow: 'linebreak',
      valign: 'middle',
      textColor: black,
      lineColor: borderGray,
      lineWidth: 0.2,
      fillColor: white,
      font: hasMarathiRows ? 'NotoSansDevanagari' : 'helvetica',
    },
    alternateRowStyles: {
      fillColor: white,
    },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8, font: 'helvetica' },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 20, font: 'helvetica' },
      3: { halign: 'center', cellWidth: 16, font: 'helvetica' },
      4: { halign: 'center', cellWidth: 14, font: 'helvetica' },
      5: { halign: 'center', cellWidth: 22, font: 'helvetica' },
      6: { halign: 'center', cellWidth: 26, font: 'helvetica' },
    },
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    didParseCell: (hookData) => {
      if (hasMarathiRows && hookData.section === 'body' && hookData.column.index === 1) {
        hookData.cell.styles.font = 'NotoSansDevanagari';
      }
      if (hookData.section === 'head') {
        hookData.cell.styles.font = 'helvetica';
        hookData.cell.styles.halign = 'center';
      }
      if (hookData.section === 'body' && hookData.column.index !== 1) {
        hookData.cell.styles.font = 'helvetica';
      }
    },
  });

  y = doc.lastAutoTable.finalY + 6;

  // ─── BOTTOM SECTION: Remark (left) + Totals (right) ───
  const totalsBlockWidth = 72;
  const totalsLabelX = pageWidth - margin - totalsBlockWidth;
  const totalsValueX = pageWidth - margin;
  let totalsY = y;

  // LEFT: Remark (skip if private note is checked)
  if (remark && remark.trim() && !isPrivateNote) {
    setDefaultFont('bold');
    doc.setFontSize(8);
    doc.setTextColor(...medGray);
    doc.text('NOTE:', margin, y);
    setDefaultFont('normal');
    doc.setFontSize(9);
    doc.setTextColor(...black);
    const maxRemarkWidth = totalsLabelX - margin - 10;
    const remarkLines = doc.splitTextToSize(remark.trim(), maxRemarkWidth);
    let remarkY = y + 4;
    remarkLines.forEach((line) => {
      doc.text(line, margin, remarkY);
      remarkY += 3.5;
    });
  }

  // RIGHT: Totals
  const drawTotalRow = (label, value, opts = {}) => {
    const { bold, large } = opts;
    setDefaultFont(bold ? 'bold' : 'normal');
    doc.setFontSize(large ? 11 : 9);
    doc.setTextColor(...darkGray);
    doc.text(label, totalsLabelX, totalsY);
    doc.setTextColor(...black);
    setDefaultFont(bold ? 'bold' : 'normal');
    doc.text(value, totalsValueX, totalsY, { align: 'right' });
    totalsY += large ? 6 : 4.5;
  };

  drawTotalRow('Subtotal', `Rs. ${fmtNum(total)}`);

  if (Math.abs(roundOff) >= 0.01) {
    drawTotalRow('Round Off', `Rs. ${roundOff >= 0 ? '+' : ''}${roundOff.toFixed(2)}`);
  }

  totalsY += 1;
  drawTotalRow('Grand Total', `Rs. ${formatIndian(grandTotal)}`, { bold: true, large: true });

  y = Math.max(y, totalsY) + 5;

  // ─── Return PDF data ───
  const pdfBase64 = doc.output('datauristring').split(',')[1];
  const fileName = qsId ? `Quick Sale - ${qsId}` : 'Quick Sale';

  return { pdfBase64, fileName };
}
