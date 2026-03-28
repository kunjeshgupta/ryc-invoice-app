import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { COMPANY, BANK } from '../config'
import { calcTotals, formatCurrency, numberToWords } from './calculations'
import { getLogo } from './storage'

const PW  = 210   // A4 width  mm
const PH  = 297   // A4 height mm
const M   = 10    // margin
const CW  = PW - 2 * M  // 190

// Column widths for the items table (must sum to CW = 190)
const COLS = {
  srno:   12,
  code:   18,
  desc:   68,
  hsn:    18,
  qty:    22,
  rate:   22,
  amount: 30,
}

function line(doc, x1, y1, x2, y2, width = 0.3) {
  doc.setLineWidth(width)
  doc.line(x1, y1, x2, y2)
}

function txt(doc, text, x, y, opts = {}) {
  doc.text(String(text ?? ''), x, y, opts)
}

function setFont(doc, style = 'normal', size = 8.5) {
  doc.setFont('helvetica', style)
  doc.setFontSize(size)
}

export async function generateInvoicePDF(invoice) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const logo = getLogo()

  // ── OUTER BORDER ──────────────────────────────────────────────
  doc.setDrawColor(0)
  doc.setLineWidth(0.6)
  doc.rect(M, M, CW, PH - 2 * M)

  // ── HEADER ────────────────────────────────────────────────────
  if (logo) {
    doc.addImage(logo, 'PNG', M + 2, M + 2, 26, 22)
  }

  // Company name — large bold, right of logo (or centered if no logo)
  setFont(doc, 'bold', 20)
  if (logo) {
    txt(doc, COMPANY.name.toUpperCase(), M + 32, M + 16)
  } else {
    txt(doc, COMPANY.name.toUpperCase(), PW / 2, M + 16, { align: 'center' })
  }

  // Tagline / address lines — centered
  setFont(doc, 'normal', 8.5)
  txt(doc, COMPANY.tagline, PW / 2, M + 27, { align: 'center' })
  txt(doc, COMPANY.address,  PW / 2, M + 32, { align: 'center' })
  txt(doc, COMPANY.city,     PW / 2, M + 37, { align: 'center' })

  // GSTIN — bold, centered
  setFont(doc, 'bold', 9)
  txt(doc, `GSTIN NO.: ${COMPANY.gstin}`, PW / 2, M + 43, { align: 'center' })

  // MOB | EMAIL on same line
  setFont(doc, 'normal', 8.5)
  txt(doc, `MOB: ${COMPANY.phone}`,   M + 3,       M + 49)
  txt(doc, `EMAIL: ${COMPANY.email}`, PW - M - 3,  M + 49, { align: 'right' })

  const SEP1 = M + 52
  line(doc, M, SEP1, M + CW, SEP1, 0.4)

  // ── INFO SECTION (3-column grid) ──────────────────────────────
  const INFO_Y = SEP1
  const INFO_H = 46
  const C1 = 55, C2 = 75 // col widths; C3 = CW - C1 - C2 = 60

  // vertical dividers
  line(doc, M + C1,      INFO_Y, M + C1,      INFO_Y + INFO_H)
  line(doc, M + C1 + C2, INFO_Y, M + C1 + C2, INFO_Y + INFO_H)
  // bottom border
  line(doc, M, INFO_Y + INFO_H, M + CW, INFO_Y + INFO_H)

  // LEFT: invoice meta
  const lx = M + 2, vx = M + 27
  setFont(doc, 'normal', 8.5)
  const meta = [
    ['Invoice No.:',    invoice.invoiceNo],
    ['Invoice Date:',   invoice.invoiceDate],
    ['Place of Supply:', invoice.placeOfSupply],
    ['PO No.:',         invoice.poNo],
    ['PO Date:',        invoice.poDate],
    ['Date of Supply:', invoice.dateOfSupply],
  ]
  meta.forEach(([label, val], i) => {
    const ry = INFO_Y + 7 + i * 6.5
    setFont(doc, 'normal', 8.5)
    txt(doc, label, lx, ry)
    txt(doc, val || '', vx, ry)
  })

  // MIDDLE: Billed To
  const mx = M + C1 + 2
  setFont(doc, 'bold', 8.5)
  txt(doc, 'Billed To-', mx, INFO_Y + 7)
  txt(doc, invoice.billedTo.name, mx, INFO_Y + 13)
  setFont(doc, 'normal', 8)
  const bLines = doc.splitTextToSize(invoice.billedTo.address, C2 - 4)
  bLines.forEach((l, i) => txt(doc, l, mx, INFO_Y + 19 + i * 5))
  const bY = INFO_Y + 19 + bLines.length * 5
  txt(doc, `STATE CODE: ${invoice.billedTo.stateCode}`, mx, bY)
  setFont(doc, 'bold', 8)
  txt(doc, `GSTIN NO: ${invoice.billedTo.gstin}`, mx, bY + 5)

  // RIGHT: Shipped To
  const rx = M + C1 + C2 + 2
  const shipped = invoice.shippedSameAsBilled ? invoice.billedTo : invoice.shippedTo
  setFont(doc, 'bold', 8.5)
  txt(doc, 'Shipped To-', rx, INFO_Y + 7)
  txt(doc, shipped.name, rx, INFO_Y + 13)
  setFont(doc, 'normal', 8)
  const sLines = doc.splitTextToSize(shipped.address, CW - C1 - C2 - 4)
  sLines.forEach((l, i) => txt(doc, l, rx, INFO_Y + 19 + i * 5))
  const sY = INFO_Y + 19 + sLines.length * 5
  txt(doc, `STATE CODE: ${shipped.stateCode}`, rx, sY)
  setFont(doc, 'bold', 8)
  txt(doc, `GSTIN NO: ${shipped.gstin}`, rx, sY + 5)

  // ── ITEMS TABLE ───────────────────────────────────────────────
  const { taxable, cgst, sgst, igst, total } = calcTotals(invoice.items, invoice.gstType)

  const itemRows = invoice.items.map((it, i) => [
    `${i + 1}.`,
    it.itemCode || '',
    it.description,
    it.hsnSac,
    `${it.quantity} ${it.unit}`,
    formatCurrency(it.rate),
    formatCurrency(it.amount),
  ])

  const cs = { fontStyle: 'normal', fillColor: [255, 255, 255], textColor: [0, 0, 0] }
  const bold = { ...cs, fontStyle: 'bold' }

  const taxRows = [
    [{ content: `Payment Terms: ${invoice.paymentTerms}`, colSpan: 7, styles: { ...bold, cellPadding: 2 } }],
    [
      { content: 'Taxable Value', colSpan: 6, styles: bold },
      { content: formatCurrency(taxable), styles: { ...cs, halign: 'right' } },
    ],
    [
      { content: 'Central Tax (CGST)@9%', colSpan: 6, styles: cs },
      { content: invoice.gstType === 'intra' ? formatCurrency(cgst) : '', styles: { ...cs, halign: 'right' } },
    ],
    [
      { content: 'State/Union Territory Tax (SGST)@9%', colSpan: 6, styles: cs },
      { content: invoice.gstType === 'intra' ? formatCurrency(sgst) : '', styles: { ...cs, halign: 'right' } },
    ],
    [
      { content: 'Integrated Tax (IGST)@18%', colSpan: 6, styles: cs },
      { content: invoice.gstType === 'inter' ? formatCurrency(igst) : '', styles: { ...cs, halign: 'right' } },
    ],
    [
      { content: 'Total Invoice Value', colSpan: 6, styles: bold },
      { content: formatCurrency(total), styles: { ...bold, halign: 'right' } },
    ],
  ]

  autoTable(doc, {
    startY: INFO_Y + INFO_H,
    margin: { left: M, right: M },
    tableWidth: CW,
    head: [[
      { content: 'Sr.No.',        styles: { halign: 'center' } },
      { content: 'Item\nCode',    styles: { halign: 'center' } },
      { content: 'Item Description' },
      { content: 'HSN/SAC',       styles: { halign: 'center' } },
      { content: 'Quantity',      styles: { halign: 'center' } },
      { content: 'List of Rate',  styles: { halign: 'center' } },
      { content: 'Amount',        styles: { halign: 'center' } },
    ]],
    body: [...itemRows, ...taxRows],
    columnStyles: {
      0: { cellWidth: COLS.srno,   halign: 'center' },
      1: { cellWidth: COLS.code },
      2: { cellWidth: COLS.desc },
      3: { cellWidth: COLS.hsn,    halign: 'center' },
      4: { cellWidth: COLS.qty,    halign: 'center' },
      5: { cellWidth: COLS.rate,   halign: 'right' },
      6: { cellWidth: COLS.amount, halign: 'right' },
    },
    styles: {
      font: 'helvetica',
      fontSize: 8.5,
      cellPadding: { top: 2, bottom: 2, left: 2, right: 2 },
      lineColor: [0, 0, 0],
      lineWidth: 0.2,
      fillColor: [255, 255, 255],
      textColor: [0, 0, 0],
    },
    headStyles: { fontStyle: 'bold', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0] },
    theme: 'grid',
    didDrawPage: () => {
      doc.setDrawColor(0)
      doc.setLineWidth(0.6)
      doc.rect(M, M, CW, PH - 2 * M)
    },
  })

  // TOTAL AMOUNT row (bold, prominent, manually after table)
  const tY = doc.lastAutoTable.finalY
  const TA_H = 8
  doc.setDrawColor(0)
  doc.setLineWidth(0.2)
  doc.rect(M, tY, CW, TA_H)

  // "TOTAL AMOUNT" label spanning left, value right
  setFont(doc, 'bold', 9.5)
  txt(doc, 'TOTAL AMOUNT', M + CW - COLS.amount - 30, tY + 5.5, { align: 'right' })
  txt(doc, formatCurrency(total), M + CW - 2, tY + 5.5, { align: 'right' })

  // Amount in words below TOTAL AMOUNT
  const wordsY = tY + TA_H + 5
  setFont(doc, 'normal', 8)
  txt(doc, `Rupees: ${numberToWords(total)}`, M + 3, wordsY)

  // ── ACCOUNT DETAILS FOOTER ────────────────────────────────────
  const FOOTER_Y = PH - M - 30  // 30mm footer from bottom (inside border)
  line(doc, M, FOOTER_Y, M + CW, FOOTER_Y, 0.4)

  const FC1 = 65, FC2 = 65  // footer col widths; FC3 = CW - FC1 - FC2 = 60
  line(doc, M + FC1,       FOOTER_Y, M + FC1,       PH - M)
  line(doc, M + FC1 + FC2, FOOTER_Y, M + FC1 + FC2, PH - M)

  // Account details
  setFont(doc, 'bold', 8.5)
  txt(doc, 'ACCOUNT DETAILS', M + 2, FOOTER_Y + 6)
  setFont(doc, 'normal', 8.5)
  txt(doc, `Account Name: ${BANK.accountName}`, M + 2, FOOTER_Y + 12)
  txt(doc, `Account No.  : ${BANK.accountNo}`,  M + 2, FOOTER_Y + 17)
  txt(doc, `IFSC Code    : ${BANK.ifsc}`,        M + 2, FOOTER_Y + 22)
  txt(doc, `Bank Branch  : ${BANK.branch}`,      M + 2, FOOTER_Y + 27)

  // Receiver's signature
  setFont(doc, 'normal', 8.5)
  txt(doc, "Receiver's Signature", M + FC1 + FC2 / 2, PH - M - 3, { align: 'center' })

  // Company signature
  setFont(doc, 'bold', 8.5)
  txt(doc, `FOR ${COMPANY.name.toUpperCase()}`, M + FC1 + FC2 + (CW - FC1 - FC2) / 2, FOOTER_Y + 6, { align: 'center' })

  doc.save(`Invoice-${invoice.invoiceNo}.pdf`)
}
