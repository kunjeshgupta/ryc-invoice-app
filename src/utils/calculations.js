import { DEFAULTS } from '../config'

export function calcItem(quantity, rate) {
  const qty = parseFloat(quantity) || 0
  const rt  = parseFloat(rate)    || 0
  return parseFloat((qty * rt).toFixed(2))
}

export function calcTotals(items, gstType) {
  const taxable = items.reduce((s, it) => s + (it.amount || 0), 0)
  const rate    = DEFAULTS.gstRate / 100

  const cgst  = gstType === 'intra' ? parseFloat((taxable * rate / 2).toFixed(2)) : 0
  const sgst  = gstType === 'intra' ? parseFloat((taxable * rate / 2).toFixed(2)) : 0
  const igst  = gstType === 'inter' ? parseFloat((taxable * rate).toFixed(2))     : 0
  const total = parseFloat((taxable + cgst + sgst + igst).toFixed(2))

  return { taxable, cgst, sgst, igst, total }
}

export function formatCurrency(n) {
  if (n === '' || n === null || n === undefined) return ''
  return parseFloat(n).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

// Convert number to Indian words for invoice
export function numberToWords(amount) {
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven',
    'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen',
    'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty',
    'Sixty', 'Seventy', 'Eighty', 'Ninety']

  function toWords(n) {
    if (n === 0) return ''
    if (n < 20) return ones[n] + ' '
    if (n < 100) return tens[Math.floor(n / 10)] + ' ' + ones[n % 10] + ' '
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred ' + toWords(n % 100)
    if (n < 100000) return toWords(Math.floor(n / 1000)) + 'Thousand ' + toWords(n % 1000)
    if (n < 10000000) return toWords(Math.floor(n / 100000)) + 'Lakh ' + toWords(n % 100000)
    return toWords(Math.floor(n / 10000000)) + 'Crore ' + toWords(n % 10000000)
  }

  const rupees = Math.floor(amount)
  const paise  = Math.round((amount - rupees) * 100)
  let words = toWords(rupees).trim()
  if (!words) words = 'Zero'
  words += ' Rupees'
  if (paise > 0) words += ' and ' + toWords(paise).trim() + ' Paise'
  words += ' Only'
  return words
}
