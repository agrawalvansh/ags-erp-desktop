import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { NotoSansDevanagariBase64 } from '../../assets/fonts/NotoSansDevanagari';

// ─── Formatting helpers ───
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
 * Generate a professional B&W Order PDF (works for both Customer & Supplier orders).
 * Returns { pdfBase64, fileName }
 *
 * @param {Object} data
 * @param {string} data.orderType - 'Customer Order' or 'Supplier Order'
 * @param {string} data.orderId
 * @param {string} data.orderDate
 * @param {string} data.partyName - customer/supplier name
 * @param {string} data.mobileNo
 * @param {string} data.address
 * @param {string} data.status
 * @param {string} data.remark
 * @param {Array}  data.orderItems - [{productName, size, quantity, packingType, itemRemark}]
 * @param {boolean} data.printMarathi
 * @param {Object}  data.marathiNames - {code: marathiName}
 */
export function generateOrderPDF(data) {
  const {
    orderType, orderId, orderDate, partyName, mobileNo, address,
    status, remark, orderItems,
    printMarathi, marathiNames
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
  doc.text(orderType.toUpperCase(), pageWidth / 2, y + 3, { align: 'center' });
  y += 12;

  // ─── Two-column layout: Party info (left) + Order details (right) ───
  const leftX = margin;
  const rightValX = pageWidth - margin;
  const rightLabelX = pageWidth - margin - 62;

  // LEFT: Party details
  let leftY = y;
  setDefaultFont('bold');
  doc.setFontSize(8);
  doc.setTextColor(...medGray);
  doc.text(orderType.includes('Customer') ? 'CUSTOMER DETAILS' : 'SUPPLIER DETAILS', leftX, leftY);
  leftY += 5;

  const drawLeftRow = (label, value) => {
    if (!value) return;
    setDefaultFont('normal');
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);
    doc.text(`${label}:`, leftX, leftY);
    setDefaultFont('bold');
    doc.setTextColor(...black);
    doc.text(String(value), leftX + 22, leftY);
    leftY += 4.5;
  };

  drawLeftRow('Name', partyName);
  if (mobileNo) drawLeftRow('Mobile', mobileNo);
  if (address) drawLeftRow('Address', address);

  // RIGHT: Order details
  let rightY = y;
  setDefaultFont('bold');
  doc.setFontSize(8);
  doc.setTextColor(...medGray);
  doc.text('ORDER DETAILS', rightValX, rightY, { align: 'right' });
  rightY += 5;

  const drawRightRow = (label, value) => {
    setDefaultFont('normal');
    doc.setFontSize(9);
    doc.setTextColor(...darkGray);
    doc.text(label, rightLabelX, rightY);
    setDefaultFont('bold');
    doc.setTextColor(...black);
    doc.text(String(value || ''), rightValX, rightY, { align: 'right' });
    rightY += 4.5;
  };

  drawRightRow('Order No:', orderId);
  drawRightRow('Date:', fmtDate(orderDate));
  if (status) drawRightRow('Status:', status);

  y = Math.max(leftY, rightY) + 4;

  // ─── ITEMS TABLE ───
  const tableColumns = [
    { header: '#', dataKey: 'sno' },
    { header: 'Product', dataKey: 'product' },
    { header: 'Size', dataKey: 'size' },
    { header: 'Qty', dataKey: 'qty' },
    { header: 'Unit', dataKey: 'unit' },
    { header: 'Remark', dataKey: 'remark' },
  ];

  const tableRows = orderItems.map((item, index) => {
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
      remark: item.itemRemark || '',
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
    alternateRowStyles: { fillColor: white },
    columnStyles: {
      0: { halign: 'center', cellWidth: 8, font: 'helvetica' },
      1: { halign: 'left', cellWidth: 'auto' },
      2: { halign: 'center', cellWidth: 20, font: 'helvetica' },
      3: { halign: 'center', cellWidth: 16, font: 'helvetica' },
      4: { halign: 'center', cellWidth: 14, font: 'helvetica' },
      5: { halign: 'left', cellWidth: 40, font: 'helvetica' },
    },
    margin: { left: margin, right: margin },
    tableWidth: contentWidth,
    didParseCell: (hookData) => {
      if (hasMarathiRows && hookData.section === 'body' && hookData.column.index === 1) {
        hookData.cell.styles.font = 'NotoSansDevanagari';
      }
      if (hookData.section === 'head') {
        hookData.cell.styles.font = 'helvetica';
      }
      if (hookData.section === 'body' && hookData.column.index !== 1) {
        hookData.cell.styles.font = 'helvetica';
      }
    },
  });

  y = doc.lastAutoTable.finalY + 6;

  // ─── REMARK ───
  if (remark && remark.trim()) {
    setDefaultFont('bold');
    doc.setFontSize(8);
    doc.setTextColor(...medGray);
    doc.text('NOTE:', margin, y);
    setDefaultFont('normal');
    doc.setFontSize(9);
    doc.setTextColor(...black);
    const remarkLines = doc.splitTextToSize(remark.trim(), contentWidth - 15);
    let remarkY = y + 4;
    remarkLines.forEach((line) => {
      doc.text(line, margin, remarkY);
      remarkY += 3.5;
    });
    y = remarkY + 2; // advance y past the remark block
  }

  // ─── Total items count ───
  const totalQty = orderItems.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
  const totalCountX = pageWidth - margin;
  setDefaultFont('bold');
  doc.setFontSize(10);
  doc.setTextColor(...black);
  doc.text(`Total Items: ${orderItems.length}  |  Total Qty: ${fmtQty(totalQty)}`, totalCountX, y + 2, { align: 'right' });

  // ─── Return PDF data ───
  const pdfBase64 = doc.output('datauristring').split(',')[1];
  const safeParty = (partyName || '').replace(/[^a-zA-Z0-9 ]/g, '').trim();
  const fileName = safeParty && orderId
    ? `${safeParty} - ${orderId}`
    : `Order - ${orderId || 'draft'}`;

  return { pdfBase64, fileName };
}
