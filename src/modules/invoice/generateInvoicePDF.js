import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { NotoSansDevanagariBase64 } from '../../assets/fonts/NotoSansDevanagari';

/**
 * Format a number with Indian comma notation: 12,34,567
 */
const formatIndian = (num) => {
  const n = Number(num);
  if (isNaN(n)) return '0';
  return n.toLocaleString('en-IN');
};

/**
 * Format a number: integer → no decimals, otherwise 2 decimals
 */
const fmtNum = (value) => {
  const num = parseFloat(value) || 0;
  if (Number.isInteger(num)) return num.toString();
  return num.toFixed(2);
};

/**
 * Format quantity: integer → no decimals, otherwise 3 decimals
 */
const fmtQty = (val) => {
  const n = parseFloat(val) || 0;
  if (Number.isInteger(n)) return n.toString();
  return n.toFixed(3);
};

/**
 * Format date to DD/MM/YYYY
 */
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
 * Generate a professional B&W invoice PDF.
 * Returns { pdfBase64, fileName }
 */
export function generateInvoicePDF(data) {
  const {
    invoiceNo, invoiceDate, buyer, customerId, address, mobileNo,
    invoiceItems, total,
    packing, freight, riksha, roundOff, grandTotal,
    remark, paymentAmount, paymentType,
    printMarathi, marathiNames,
    isPrivateNote
  } = data;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth(); // 210mm for A4
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

  // Helper: set font (uses Devanagari for Marathi product names)
  const setDefaultFont = (style = 'normal') => {
    doc.setFont('helvetica', style);
  };
  const setMarathiFont = () => {
    if (hasDevanagari) {
      doc.setFont('NotoSansDevanagari', 'normal');
    } else {
      doc.setFont('helvetica', 'normal');
    }
  };

  // ─── HEADER ───
  y = 12;

  // Title centered
  setDefaultFont('bold');
  doc.setFontSize(16);
  doc.setTextColor(...black);
  doc.text('ESTIMATE', pageWidth / 2, y + 3, { align: 'center' });

  y += 10;

  // ─── Side-by-side: Customer (left) | Invoice Details (extreme right) ───
  const leftColX = margin;
  // Right block: push to extreme right. Values right-align to right margin.
  const rightBlockWidth = 62;
  const rightColX = pageWidth - margin - rightBlockWidth;
  const rightValX = pageWidth - margin; // values right-aligned here
  let leftY = y;
  let rightY = y;

  // LEFT: Bill To
  setDefaultFont('bold');
  doc.setFontSize(8);
  doc.setTextColor(...medGray);
  doc.text('BILL TO', leftColX, leftY);
  leftY += 4;

  setDefaultFont('bold');
  doc.setFontSize(11);
  doc.setTextColor(...black);
  doc.text(buyer || 'Walk-in Customer', leftColX, leftY);
  leftY += 4.5;

  setDefaultFont('normal');
  doc.setFontSize(9);
  doc.setTextColor(...darkGray);

  if (address && address.trim()) {
    const maxAddrWidth = rightColX - leftColX - 5;
    const addressLines = doc.splitTextToSize(address.trim(), maxAddrWidth);
    addressLines.forEach((line) => {
      doc.text(line, leftColX, leftY);
      leftY += 3.5;
    });
  }

  if (mobileNo && mobileNo.trim()) {
    doc.text(`Mobile: ${mobileNo.trim()}`, leftColX, leftY);
    leftY += 3.5;
  }

  // RIGHT: Invoice Details (extreme right, values right-aligned)
  setDefaultFont('bold');
  doc.setFontSize(8);
  doc.setTextColor(...medGray);
  doc.text('INVOICE DETAILS', rightValX, rightY, { align: 'right' });
  rightY += 5;

  const drawDetailRow = (label, value) => {
    setDefaultFont('normal');
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);
    doc.text(label, rightColX, rightY);
    setDefaultFont('bold');
    doc.setTextColor(...black);
    doc.text(String(value || ''), rightValX, rightY, { align: 'right' });
    rightY += 4.5;
  };

  drawDetailRow('Invoice No:', invoiceNo);
  drawDetailRow('Date:', fmtDate(invoiceDate));
  if (customerId) {
    drawDetailRow('Customer ID:', customerId);
  }

  y = Math.max(leftY, rightY) + 4;

  // ─── ITEMS TABLE (B&W grid) ───
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

  // Determine if any row has Marathi text (Devanagari characters)
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
      1: { halign: 'left', cellWidth: 'auto' },   // Product — uses Marathi font if needed
      2: { halign: 'center', cellWidth: 20, font: 'helvetica' },
      3: { halign: 'center', cellWidth: 16, font: 'helvetica' },
      4: { halign: 'center', cellWidth: 14, font: 'helvetica' },
      5: { halign: 'center', cellWidth: 22, font: 'helvetica' },
      6: { halign: 'center', cellWidth: 26, font: 'helvetica' },
    },
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    // Use Marathi font only for the Product column (column index 1)
    didParseCell: (hookData) => {
      if (hasMarathiRows && hookData.section === 'body' && hookData.column.index === 1) {
        hookData.cell.styles.font = 'NotoSansDevanagari';
      }
      // Keep header always in helvetica and center-aligned
      if (hookData.section === 'head') {
        hookData.cell.styles.font = 'helvetica';
        hookData.cell.styles.halign = 'center';
      }
      // Keep number columns in helvetica
      if (hookData.section === 'body' && hookData.column.index !== 1) {
        hookData.cell.styles.font = 'helvetica';
      }
    },
  });

  y = doc.lastAutoTable.finalY + 6;

  // ─── BOTTOM SECTION: Note/Remark (left) + Totals (right) side-by-side ───
  const totalsBlockWidth = 72;
  const totalsLabelX = pageWidth - margin - totalsBlockWidth;
  const totalsValueX = pageWidth - margin;
  let totalsY = y;

  // LEFT SIDE: Note/Remark (skip if private note is checked)
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

  // RIGHT SIDE: Totals
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

  // Subtotal
  drawTotalRow('Subtotal', `Rs. ${fmtNum(total)}`);

  // Conditional charges
  const packingVal = parseFloat(packing || 0);
  const freightVal = parseFloat(freight || 0);
  const rikshaVal = parseFloat(riksha || 0);
  const payAmt = parseFloat(paymentAmount || 0);

  if (packingVal > 0) drawTotalRow('Packing Charges', `Rs. ${fmtNum(packingVal)}`);
  if (freightVal > 0) drawTotalRow('Freight / Delivery', `Rs. ${fmtNum(freightVal)}`);
  if (rikshaVal > 0) drawTotalRow('Riksha Charges', `Rs. ${fmtNum(rikshaVal)}`);

  // Round off
  if (Math.abs(roundOff) >= 0.01) {
    drawTotalRow('Round Off', `Rs. ${roundOff >= 0 ? '+' : ''}${roundOff.toFixed(2)}`);
  }

  // Grand Total
  totalsY += 1;
  drawTotalRow('Grand Total', `Rs. ${formatIndian(grandTotal)}`, { bold: true, large: true });

  // Payment / Balance
  if (payAmt > 0) {
    totalsY += 1;
    drawTotalRow(`Paid (${paymentType})`, `Rs. ${fmtNum(payAmt)}`);
    const balance = grandTotal - payAmt;
    if (balance > 0) {
      drawTotalRow('Balance Due', `Rs. ${formatIndian(balance)}`, { bold: true });
    } else if (balance === 0) {
      setDefaultFont('bold');
      doc.setFontSize(9);
      doc.setTextColor(...black);
      doc.text('PAID IN FULL', totalsValueX, totalsY, { align: 'right' });
      totalsY += 5;
    }
  }

  y = Math.max(y, totalsY) + 5;

  // ─── Return PDF data for caller to handle ───
  const pdfBase64 = doc.output('datauristring').split(',')[1];
  const safeBuyer = (buyer || '').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const fileName = safeBuyer && invoiceNo
    ? `${safeBuyer} - ${invoiceNo}`
    : `Estimate - ${invoiceNo || 'draft'}`;

  return { pdfBase64, fileName };
}
