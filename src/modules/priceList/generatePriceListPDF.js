import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { getLocalDateString } from '../../utils/dateUtils';

/**
 * Format a number with Indian comma notation: 12,34,567.00
 */
const formatIndian = (num, decimals = 2) => {
  const n = Number(num);
  if (isNaN(n)) return '0';
  return n.toLocaleString('en-IN', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
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
 * Format ISO date to short readable: "13 Jun 25"
 */
const fmtShortDate = (isoStr) => {
  if (!isoStr) return '—';
  try {
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' });
  } catch {
    return '—';
  }
};

/**
 * Generate a professional B&W Price List PDF.
 * Returns { pdfBase64, fileName }
 *
 * @param {Object} data
 * @param {Array}  data.products       - [{productName, code, size, costPrice, sellingPrice, packingType, updatedAt}]
 * @param {boolean} data.includeCostPrice - Whether to include cost price column
 */
export function generatePriceListPDF(data) {
  const { products, includeCostPrice = false } = data;

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

  const setDefaultFont = (style = 'normal') => {
    doc.setFont('helvetica', style);
  };

  // ─── HEADER ───
  y = 12;

  // Title centered
  setDefaultFont('bold');
  doc.setFontSize(16);
  doc.setTextColor(...black);
  doc.text('PRICE LIST', pageWidth / 2, y + 3, { align: 'center' });

  y += 10;

  // ─── Subtitle: date + product count ───
  const rightValX = pageWidth - margin;
  const rightLabelX = pageWidth - margin - 62;
  let rightY = y;

  setDefaultFont('bold');
  doc.setFontSize(8);
  doc.setTextColor(...medGray);
  doc.text('CATALOG DETAILS', rightValX, rightY, { align: 'right' });
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

  drawDetailRow('Date:', fmtDate(getLocalDateString()));
  drawDetailRow('Total Products:', String(products.length));

  y = rightY + 4;

  // ─── ITEMS TABLE ───
  const tableColumns = [
    { header: '#', dataKey: 'sno' },
    { header: 'Product', dataKey: 'product' },
    { header: 'Size', dataKey: 'size' },
    { header: 'Unit', dataKey: 'unit' },
    ...(includeCostPrice ? [{ header: 'Cost Price', dataKey: 'costPrice' }] : []),
    { header: 'Selling Price', dataKey: 'sellingPrice' },
    { header: 'Price Updated', dataKey: 'updatedAt' },
  ];

  const tableRows = products.map((item, index) => ({
    sno: String(index + 1),
    product: item.productName || '',
    size: item.size || '-',
    unit: item.packingType || '',
    costPrice: formatIndian(item.costPrice),
    sellingPrice: formatIndian(item.sellingPrice, 0),
    updatedAt: fmtShortDate(item.updatedAt),
  }));

  const columnStyles = {
    0: { halign: 'center', cellWidth: 10, font: 'helvetica' },  // #
    1: { halign: 'left', cellWidth: 'auto', font: 'helvetica' },  // Product
    2: { halign: 'center', cellWidth: 20, font: 'helvetica' },  // Size
    3: { halign: 'center', cellWidth: 16, font: 'helvetica' },  // Unit
  };

  if (includeCostPrice) {
    columnStyles[4] = { halign: 'right', cellWidth: 28, font: 'helvetica' }; // Cost Price
    columnStyles[5] = { halign: 'center', cellWidth: 28, font: 'helvetica' }; // Selling Price
    columnStyles[6] = { halign: 'center', cellWidth: 24, font: 'helvetica' }; // Price Updated
  } else {
    columnStyles[4] = { halign: 'center', cellWidth: 30, font: 'helvetica' }; // Selling Price
    columnStyles[5] = { halign: 'center', cellWidth: 24, font: 'helvetica' }; // Price Updated
  }

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
      font: 'helvetica',
    },
    alternateRowStyles: {
      fillColor: white,
    },
    columnStyles,
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    didParseCell: (hookData) => {
      if (hookData.section === 'head') {
        hookData.cell.styles.font = 'helvetica';
        hookData.cell.styles.halign = 'center';
      }
    },
  });

  // ─── Footer summary ───
  y = doc.lastAutoTable.finalY + 8;
  setDefaultFont('bold');
  doc.setFontSize(9);
  doc.setTextColor(...darkGray);
  doc.text(`Total Products: ${products.length}`, margin, y);

  setDefaultFont('normal');
  doc.setFontSize(8);
  doc.setTextColor(...medGray);
  doc.text(`Generated on ${new Date().toLocaleDateString('en-IN')}`, rightValX, y, { align: 'right' });

  // ─── Return PDF data ───
  const pdfBase64 = doc.output('datauristring').split(',')[1];
  const fileName = `Price_List_${getLocalDateString()}`;

  return { pdfBase64, fileName };
}
