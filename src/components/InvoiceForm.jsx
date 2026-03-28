import { useState } from 'react'
import dayjs from 'dayjs'
import { DEFAULTS } from '../config'
import { calcItem, calcTotals, formatCurrency } from '../utils/calculations'
import { saveInvoice, bumpCounter, getNextInvoiceNo, getClients, saveClient } from '../utils/storage'
import { generateInvoicePDF } from '../utils/pdf'

const today    = () => dayjs().format('DD/MM/YYYY')
const blankClient = () => ({ name:'', address:'', stateCode:'', gstin:'' })
const blankItem   = () => ({
  id: Date.now() + Math.random(),
  itemCode:'', description:'', hsnSac:DEFAULTS.hsnSac,
  quantity:'', unit:DEFAULTS.units[0], rate:'', amount:0,
})

// Extract state code from first 2 chars of GSTIN
function stateFromGstin(gstin) {
  const g = (gstin || '').trim()
  return g.length >= 2 && /^\d{2}/.test(g) ? g.substring(0, 2) : ''
}

function buildInitial(existing) {
  if (existing) return existing
  return {
    id:                  crypto.randomUUID(),
    invoiceNo:           String(getNextInvoiceNo()).padStart(2, '0'),
    invoiceDate:         today(),
    placeOfSupply:       '',
    poNo:                '',
    poDate:              '',
    dateOfSupply:        today(),
    billedTo:            blankClient(),
    shippedSameAsBilled: true,
    shippedTo:           blankClient(),
    items:               [blankItem()],
    paymentTerms:        DEFAULTS.paymentTerms,
    gstType:             'intra',
  }
}

// ── Small reusable components ─────────────────────────────────
function Field({ label, children }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">{label}</label>
      {children}
    </div>
  )
}

const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

function Input({ value, onChange, placeholder='', type='text' }) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)}
      placeholder={placeholder} className={inputCls} />
  )
}

function Section({ title, children }) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-100">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">{title}</h2>
      </div>
      <div className="p-4 flex flex-col gap-3">{children}</div>
    </div>
  )
}

// ── Client fields with saved-client picker ────────────────────
function ClientFields({ value, onChange, showSave }) {
  const [clients]    = useState(getClients)
  const [saved, setSaved] = useState(false)

  function set(k, v) {
    const updated = { ...value, [k]: v }
    // Auto-derive state code when GSTIN changes
    if (k === 'gstin') updated.stateCode = stateFromGstin(v)
    onChange(updated)
  }

  function handleSelect(e) {
    const key = e.target.value
    if (!key) return
    const client = clients.find(c => (c.gstin || c.name) === key)
    if (client) onChange(client)
  }

  function handleSave() {
    if (!value.name) return
    saveClient(value)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <>
      {clients.length > 0 && (
        <Field label="Load Saved Client">
          <select onChange={handleSelect} defaultValue="" className={inputCls}>
            <option value="">— select a saved client —</option>
            {clients.map(c => (
              <option key={c.gstin || c.name} value={c.gstin || c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}

      <Field label="Company Name">
        <Input value={value.name} onChange={v => set('name', v)}
          placeholder="e.g. Bellsonica Auto Component India Pvt. Ltd." />
      </Field>

      <Field label="Address">
        <textarea value={value.address} onChange={e => set('address', e.target.value)}
          rows={2} placeholder="Plot No-1, Phase 3A, IMT Manesar, Gurgaon (122051)"
          className={`${inputCls} resize-none`} />
      </Field>

      <Field label="GSTIN">
        <Input value={value.gstin} onChange={v => set('gstin', v.toUpperCase())}
          placeholder="06XXXXXXXXXXXXXX" />
      </Field>

      <div className="flex items-center gap-3">
        <div className="flex-1">
          <Field label="State Code (auto from GSTIN)">
            <Input value={value.stateCode} onChange={v => set('stateCode', v)}
              placeholder="06" />
          </Field>
        </div>
        {showSave && (
          <button onClick={handleSave}
            className="mt-5 px-4 py-2.5 text-xs font-semibold bg-green-50 border border-green-200 text-green-700 rounded-lg whitespace-nowrap">
            {saved ? '✓ Saved' : 'Save Client'}
          </button>
        )}
      </div>
    </>
  )
}

// ── Line item row ─────────────────────────────────────────────
function LineItem({ item, onChange, onRemove, showRemove }) {
  function set(k, v) {
    const updated = { ...item, [k]: v }
    if (k === 'quantity' || k === 'rate') {
      updated.amount = calcItem(
        k === 'quantity' ? v : item.quantity,
        k === 'rate'     ? v : item.rate,
      )
    }
    onChange(updated)
  }

  return (
    <div className="border border-gray-200 rounded-xl p-3 flex flex-col gap-2.5 bg-gray-50">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-gray-500 uppercase">Line Item</span>
        {showRemove && (
          <button onClick={onRemove} className="text-red-400 text-xs font-medium">Remove</button>
        )}
      </div>

      <Field label="Description">
        <Input value={item.description} onChange={v => set('description', v)}
          placeholder="Hydra F-17 Charges for..." />
      </Field>

      <div className="grid grid-cols-2 gap-2">
        <Field label="Item Code (optional)">
          <Input value={item.itemCode} onChange={v => set('itemCode', v)} />
        </Field>
        <Field label="HSN / SAC">
          <Input value={item.hsnSac} onChange={v => set('hsnSac', v)}
            placeholder={DEFAULTS.hsnSac} />
        </Field>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Field label="Quantity">
          <Input value={item.quantity} onChange={v => set('quantity', v)}
            type="number" placeholder="30.5" />
        </Field>
        <Field label="Unit">
          <select value={item.unit} onChange={e => set('unit', e.target.value)}
            className={inputCls}>
            {DEFAULTS.units.map(u => <option key={u}>{u}</option>)}
          </select>
        </Field>
        <Field label="Rate (₹)">
          <Input value={item.rate} onChange={v => set('rate', v)}
            type="number" placeholder="1875" />
        </Field>
      </div>

      <div className="flex justify-between items-center pt-1 border-t border-gray-200">
        <span className="text-xs text-gray-400">Amount</span>
        <span className="text-base font-bold text-blue-700">₹ {formatCurrency(item.amount)}</span>
      </div>
    </div>
  )
}

// ── Main form ─────────────────────────────────────────────────
export default function InvoiceForm({ initial, onSave }) {
  const [inv, setInv] = useState(() => buildInitial(initial))
  const [saving, setSaving] = useState(false)

  const set = (k, v) => setInv(p => ({ ...p, [k]: v }))

  function updateItem(id, updated) { set('items', inv.items.map(it => it.id === id ? updated : it)) }
  function addItem()               { set('items', [...inv.items, blankItem()]) }
  function removeItem(id)          { set('items', inv.items.filter(it => it.id !== id)) }

  const totals = calcTotals(inv.items, inv.gstType)

  async function handleDownload() {
    setSaving(true)
    try {
      saveInvoice(inv)
      bumpCounter(inv.invoiceNo)
      await generateInvoicePDF(inv)
    } finally { setSaving(false) }
  }

  function handleSave() {
    saveInvoice(inv)
    bumpCounter(inv.invoiceNo)
    onSave()
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <h1 className="text-xl font-bold text-gray-900">New Invoice</h1>

      {/* Invoice Details */}
      <Section title="Invoice Details">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Invoice No.">
            <Input value={inv.invoiceNo} onChange={v => set('invoiceNo', v)} />
          </Field>
          <Field label="Invoice Date">
            <Input value={inv.invoiceDate} onChange={v => set('invoiceDate', v)}
              placeholder="DD/MM/YYYY" />
          </Field>
        </div>
        <Field label="Place of Supply">
          <Input value={inv.placeOfSupply} onChange={v => set('placeOfSupply', v.toUpperCase())}
            placeholder="GURGAON" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="PO No.">
            <Input value={inv.poNo} onChange={v => set('poNo', v)} placeholder="3800002200" />
          </Field>
          <Field label="PO Date">
            <Input value={inv.poDate} onChange={v => set('poDate', v)} placeholder="DD/MM/YYYY" />
          </Field>
        </div>
        <Field label="Date of Supply">
          <Input value={inv.dateOfSupply} onChange={v => set('dateOfSupply', v)} placeholder="DD/MM/YYYY" />
        </Field>
      </Section>

      {/* Billed To */}
      <Section title="Billed To">
        <ClientFields value={inv.billedTo} onChange={v => set('billedTo', v)} showSave />
      </Section>

      {/* Shipped To */}
      <Section title="Shipped To">
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
          <input type="checkbox" checked={inv.shippedSameAsBilled}
            onChange={e => set('shippedSameAsBilled', e.target.checked)}
            className="w-4 h-4 accent-blue-600" />
          Same as Billed To
        </label>
        {!inv.shippedSameAsBilled && (
          <ClientFields value={inv.shippedTo} onChange={v => set('shippedTo', v)} showSave={false} />
        )}
      </Section>

      {/* Line Items */}
      <Section title="Line Items">
        <div className="flex flex-col gap-3">
          {inv.items.map(it => (
            <LineItem key={it.id} item={it}
              onChange={updated => updateItem(it.id, updated)}
              onRemove={() => removeItem(it.id)}
              showRemove={inv.items.length > 1} />
          ))}
        </div>
        <button onClick={addItem}
          className="w-full py-2.5 border-2 border-dashed border-blue-300 rounded-xl text-blue-600 text-sm font-medium">
          + Add Another Item
        </button>
      </Section>

      {/* Payment & Tax */}
      <Section title="Payment & Tax">
        <Field label="Payment Terms">
          <Input value={inv.paymentTerms} onChange={v => set('paymentTerms', v)}
            placeholder="Within 30 Days" />
        </Field>
        <Field label="GST Type">
          <div className="flex gap-4">
            {[['intra','CGST + SGST (Same State)'],['inter','IGST (Different State)']].map(([val,label]) => (
              <label key={val} className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="radio" name="gstType" value={val}
                  checked={inv.gstType===val} onChange={() => set('gstType', val)}
                  className="accent-blue-600" />
                {label}
              </label>
            ))}
          </div>
        </Field>
      </Section>

      {/* Summary */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex flex-col gap-2 text-sm">
        <div className="flex justify-between text-gray-600">
          <span>Taxable Value</span>
          <span>₹ {formatCurrency(totals.taxable)}</span>
        </div>
        {inv.gstType==='intra' && <>
          <div className="flex justify-between text-gray-600">
            <span>CGST @9%</span><span>₹ {formatCurrency(totals.cgst)}</span>
          </div>
          <div className="flex justify-between text-gray-600">
            <span>SGST @9%</span><span>₹ {formatCurrency(totals.sgst)}</span>
          </div>
        </>}
        {inv.gstType==='inter' && (
          <div className="flex justify-between text-gray-600">
            <span>IGST @18%</span><span>₹ {formatCurrency(totals.igst)}</span>
          </div>
        )}
        <div className="flex justify-between font-bold text-blue-800 text-base border-t border-blue-200 pt-2 mt-1">
          <span>TOTAL AMOUNT</span>
          <span>₹ {formatCurrency(totals.total)}</span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3 pb-4">
        <button onClick={handleSave}
          className="flex-1 py-3 border border-blue-600 text-blue-600 rounded-xl font-semibold text-sm">
          Save
        </button>
        <button onClick={handleDownload} disabled={saving}
          className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm disabled:opacity-50">
          {saving ? 'Generating…' : '⬇ Download PDF'}
        </button>
      </div>
    </div>
  )
}
