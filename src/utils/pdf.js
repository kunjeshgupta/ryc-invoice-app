import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { COMPANY, BANK } from '../config'
import { calcTotals, formatCurrency } from './calculations'
import { getLogo } from './storage'
import bundledLogo from '../assets/ryc-logo.png'

const PW = 210
const PH = 297
const M  = 10       // outer border margin
const CW = PW - 2*M // 190 — content width

// Items table column widths (must sum to CW=190)
const C = { srno:12, code:18, desc:68, hsn:18, qty:22, rate:22, amt:30 }

const AMT_X = M + CW - C.amt  // x where amount column starts in tax section

// ── Helpers ───────────────────────────────────────────────────
const sf = (doc, style='normal', size=9.5) => { doc.setFont('helvetica', style); doc.setFontSize(size) }
const T  = (doc, text, x, y, opts={}) => doc.text(String(text ?? ''), x, y, opts)

// Get natural image dimensions from a base64/url src
function imgDimensions(src) {
  return new Promise(resolve => {
    const img = new Image()
    img.onload  = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Load logo: user-uploaded (localStorage) → bundled default
async function loadLogo() {
  return getLogo() || bundledLogo || null
}

function drawOuterBorder(doc) {
  doc.setDrawColor(0); doc.setLineWidth(0.7)
  doc.rect(M, M, CW, PH - 2*M)
}

// ── Main export ───────────────────────────────────────────────
export async function generateInvoicePDF(invoice) {
  const doc  = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' })
  const logo = await loadLogo()

  // ── HEADER ────────────────────────────────────────────────────
  const LOGO_TARGET_H = 24  // fixed logo height in mm
  let   LOGO_W        = LOGO_TARGET_H  // will be corrected if logo loaded

  if (logo) {
    const dims = await imgDimensions(logo)
    if (dims) LOGO_W = (dims.w / dims.h) * LOGO_TARGET_H
    doc.addImage(logo, 'PNG', M+2, M+2, LOGO_W, LOGO_TARGET_H)
  }

  const NAME_Y  = M + 18
  const LINE1_Y = M + 32
  const LINE2_Y = M + 37
  const LINE3_Y = M + 42
  const GSTIN_Y = M + 48
  const MOB_Y   = M + 54
  const SEP1_Y  = M + 58

  sf(doc, 'bold', 22)
  if (logo) {
    T(doc, COMPANY.name.toUpperCase(), M + LOGO_W + 5, NAME_Y)
  } else {
    T(doc, COMPANY.name.toUpperCase(), PW/2, NAME_Y, { align:'center' })
  }

  sf(doc, 'normal', 8.5)
  T(doc, COMPANY.tagline, PW/2, LINE1_Y, { align:'center' })
  T(doc, COMPANY.address,  PW/2, LINE2_Y, { align:'center' })
  T(doc, COMPANY.city,     PW/2, LINE3_Y, { align:'center' })

  sf(doc, 'bold', 9)
  T(doc, `GSTIN NO.: ${COMPANY.gstin}`, PW/2, GSTIN_Y, { align:'center' })
  T(doc, `MOB: ${COMPANY.phone}`,   M+3,       MOB_Y)
  T(doc, `EMAIL: ${COMPANY.email}`, PW-M-3,    MOB_Y, { align:'right' })

  doc.setDrawColor(0); doc.setLineWidth(0.4)
  doc.line(M, SEP1_Y, M+CW, SEP1_Y)

  // ── INFO SECTION (3-col grid) ─────────────────────────────────
  const INFO_Y = SEP1_Y
  const INFO_H = 46
  const IC1=55, IC2=75  // col widths; IC3 = CW-IC1-IC2 = 60

  doc.setLineWidth(0.3)
  doc.line(M+IC1,     INFO_Y, M+IC1,     INFO_Y+INFO_H)
  doc.line(M+IC1+IC2, INFO_Y, M+IC1+IC2, INFO_Y+INFO_H)
  doc.line(M, INFO_Y+INFO_H, M+CW, INFO_Y+INFO_H)

  // Left — invoice meta
  const metaFields = [
    ['Invoice No.:',     invoice.invoiceNo],
    ['Invoice Date:',    invoice.invoiceDate],
    ['Place of Supply:', invoice.placeOfSupply],
    ['PO No.:',         invoice.poNo],
    ['PO Date:',        invoice.poDate],
    ['Date of Supply:', invoice.dateOfSupply],
  ]
  metaFields.forEach(([label, val], i) => {
    const ry = INFO_Y + 6.5 + i * 6.2
    sf(doc, 'normal', 8.5)
    T(doc, label,      M+2,  ry)
    T(doc, val || '',  M+28, ry)
  })

  // Middle — Billed To (with text wrapping)
  const mx = M+IC1+2
  const mMaxW = IC2 - 4

  function drawClient(xOrig, maxW, client, label) {
    let cy = INFO_Y + 6.5

    sf(doc, 'bold', 8.5)
    T(doc, label, xOrig, cy); cy += 5.5

    // Name — wrapped, max 2 lines
    sf(doc, 'bold', 8.5)
    doc.splitTextToSize(client.name, maxW).slice(0, 2).forEach(l => {
      T(doc, l, xOrig, cy); cy += 5
    })

    // Address — wrapped, max 2 lines
    sf(doc, 'normal', 8)
    doc.splitTextToSize(client.address, maxW).slice(0, 2).forEach(l => {
      T(doc, l, xOrig, cy); cy += 4.5
    })

    // State Code
    sf(doc, 'normal', 8.5)
    T(doc, `STATE CODE: ${client.stateCode}`, xOrig, Math.min(cy, INFO_Y+INFO_H-8))
    cy = Math.min(cy, INFO_Y+INFO_H-8) + 5

    // GSTIN
    sf(doc, 'bold', 8.5)
    T(doc, `GSTIN NO: ${client.gstin}`, xOrig, Math.min(cy, INFO_Y+INFO_H-3))
  }

  drawClient(mx, mMaxW, invoice.billedTo, 'Billed To-')

  const shipped = invoice.shippedSameAsBilled ? invoice.billedTo : invoice.shippedTo
  drawClient(M+IC1+IC2+2, CW-IC1-IC2-4, shipped, 'Shipped To-')

  // ── ITEMS TABLE (autoTable — items only) ──────────────────────
  const itemRows = invoice.items.map((it, i) => [
    `${i+1}.`,
    it.itemCode || '',
    it.description,
    it.hsnSac,
    `${it.quantity} ${it.unit}`,
    formatCurrency(it.rate),
    formatCurrency(it.amount),
  ])

  autoTable(doc, {
    startY: INFO_Y + INFO_H,
    margin: { left:M, right:M },
    tableWidth: CW,
    head: [[
      { content:'Sr.No.',       styles:{ halign:'center' } },
      { content:'Item\nCode',   styles:{ halign:'center' } },
      { content:'Item Description' },
      { content:'HSN/SAC',      styles:{ halign:'center' } },
      { content:'Quantity',     styles:{ halign:'center' } },
      { content:'List of Rate', styles:{ halign:'center' } },
      { content:'Amount',       styles:{ halign:'center' } },
    ]],
    body: itemRows,
    columnStyles: {
      0: { cellWidth:C.srno, halign:'center' },
      1: { cellWidth:C.code },
      2: { cellWidth:C.desc },
      3: { cellWidth:C.hsn,  halign:'center' },
      4: { cellWidth:C.qty,  halign:'center' },
      5: { cellWidth:C.rate, halign:'right' },
      6: { cellWidth:C.amt,  halign:'right' },
    },
    styles: {
      font:'helvetica', fontSize:9.5,
      cellPadding:{ top:2.5, bottom:2.5, left:2, right:2 },
      lineColor:[0,0,0], lineWidth:0.2,
      fillColor:[255,255,255], textColor:[0,0,0],
    },
    headStyles:{ fontStyle:'bold', halign:'center', fillColor:[255,255,255], textColor:[0,0,0] },
    theme:'grid',
    tableLineWidth: 0,
  })

  // ── TAX SECTION — drawn as ONE box ────────────────────────────
  const { taxable, cgst, sgst, igst, total } = calcTotals(invoice.items, invoice.gstType)
  const taxStart = doc.lastAutoTable.finalY

  const ROW_H  = 7    // height per row
  const N_ROWS = 6    // Payment Terms, Taxable Value, CGST, SGST, IGST, Total Invoice Value
  const TAX_H  = ROW_H * N_ROWS

  // ── TOTAL AMOUNT row dimensions (needed for vertical line extent) ──
  const TA_Y = taxStart + TAX_H
  const TA_H = 9

  // Outer rectangle for the entire tax block
  doc.setDrawColor(0); doc.setLineWidth(0.2)
  doc.rect(M, taxStart, CW, TAX_H)

  // Vertical line separating label area from amount column —
  // runs from top of tax section all the way through TOTAL AMOUNT row
  doc.line(AMT_X, taxStart, AMT_X, TA_Y + TA_H)

  // All rows — no internal horizontal borders, just text stacked inside the outer box
  const allTaxRows = [
    { label:`Payment Terms: ${invoice.paymentTerms}`, val: '',                                                        bold: true  },
    { label:'Taxable Value',                           val: formatCurrency(taxable),                                   bold: true  },
    { label:'Central Tax (CGST)@9%',                  val: invoice.gstType==='intra' ? formatCurrency(cgst)  : '',    bold: false },
    { label:'State/Union Territory Tax (SGST)@9%',    val: invoice.gstType==='intra' ? formatCurrency(sgst)  : '',    bold: false },
    { label:'Integrated Tax (IGST)@18%',              val: invoice.gstType==='inter' ? formatCurrency(igst)  : '',    bold: false },
    { label:'Total Invoice Value',                    val: formatCurrency(total),                                      bold: true  },
  ]

  allTaxRows.forEach((row, i) => {
    const textY = taxStart + ROW_H * i + ROW_H - 2
    sf(doc, row.bold ? 'bold' : 'normal', 9.5)
    T(doc, row.label, M+2,    textY)
    T(doc, row.val,   M+CW-2, textY, { align:'right' })
  })

  // ── TOTAL AMOUNT row (separate box below tax) ─────────────────
  doc.setLineWidth(0.2)
  doc.rect(M, TA_Y, CW, TA_H)
  sf(doc, 'bold', 10.5)
  T(doc, 'TOTAL AMOUNT', AMT_X - 4, TA_Y + 6.2, { align:'right' })
  T(doc, formatCurrency(total), M+CW-2, TA_Y+6.2, { align:'right' })


  // ── ACCOUNT DETAILS FOOTER ────────────────────────────────────
  const FOOTER_Y  = PH - M - 32
  const FC1=65, FC2=65  // footer col widths; FC3 = CW-FC1-FC2 = 60

  doc.setLineWidth(0.3)
  doc.line(M, FOOTER_Y, M+CW, FOOTER_Y)
  doc.line(M+FC1,       FOOTER_Y, M+FC1,       PH-M)
  doc.line(M+FC1+FC2,   FOOTER_Y, M+FC1+FC2,   PH-M)

  // Account details (left col)
  sf(doc, 'bold', 9.5)
  T(doc, 'ACCOUNT DETAILS', M+2, FOOTER_Y+7)
  sf(doc, 'normal', 9.5)
  T(doc, `Account Name: ${BANK.accountName}`, M+2, FOOTER_Y+13)
  T(doc, `Account No.  : ${BANK.accountNo}`,  M+2, FOOTER_Y+18)
  T(doc, `IFSC Code    : ${BANK.ifsc}`,        M+2, FOOTER_Y+23)
  T(doc, `Bank Branch  : ${BANK.branch}`,      M+2, FOOTER_Y+28)

  // Receiver's signature — bottom of middle col
  sf(doc, 'normal', 9.5)
  T(doc, "Receiver's Signature", M+FC1+FC2/2, PH-M-5, { align:'center' })

  // "FOR ROMINDER YADAV CRANES" — bottom-aligned in right col
  sf(doc, 'bold', 9.5)
  T(doc, `FOR ${COMPANY.name.toUpperCase()}`, M+FC1+FC2+(CW-FC1-FC2)/2, PH-M-5, { align:'center' })

  // ── OUTER BORDER — drawn last so it sits on top ───────────────
  drawOuterBorder(doc)

  doc.save(`Invoice-${invoice.invoiceNo}.pdf`)
}
