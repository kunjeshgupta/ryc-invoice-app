const KEYS = {
  invoices: 'ryc_invoices',
  counter:  'ryc_counter',
  logo:     'ryc_logo',
}

export function getInvoices() {
  try { return JSON.parse(localStorage.getItem(KEYS.invoices) || '[]') }
  catch { return [] }
}

export function saveInvoice(invoice) {
  const list = getInvoices().filter(i => i.id !== invoice.id)
  list.unshift(invoice)
  localStorage.setItem(KEYS.invoices, JSON.stringify(list))
}

export function deleteInvoice(id) {
  const list = getInvoices().filter(i => i.id !== id)
  localStorage.setItem(KEYS.invoices, JSON.stringify(list))
}

export function getNextInvoiceNo() {
  const current = parseInt(localStorage.getItem(KEYS.counter) || '3', 10)
  return current + 1
}

export function bumpCounter(no) {
  const n = parseInt(no, 10)
  const stored = parseInt(localStorage.getItem(KEYS.counter) || '0', 10)
  if (n > stored) localStorage.setItem(KEYS.counter, String(n))
}

export function getLogo() {
  return localStorage.getItem(KEYS.logo) || null
}

export function saveLogo(base64) {
  localStorage.setItem(KEYS.logo, base64)
}

export function removeLogo() {
  localStorage.removeItem(KEYS.logo)
}
