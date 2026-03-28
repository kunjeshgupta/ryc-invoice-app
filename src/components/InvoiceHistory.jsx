import { useState } from 'react'
import { getInvoices, deleteInvoice } from '../utils/storage'
import { formatCurrency, calcTotals } from '../utils/calculations'
import { generateInvoicePDF } from '../utils/pdf'

export default function InvoiceHistory({ onNew, onEdit }) {
  const [invoices, setInvoices] = useState(getInvoices)

  function handleDelete(id) {
    if (!confirm('Delete this invoice?')) return
    deleteInvoice(id)
    setInvoices(getInvoices())
  }

  async function handleDownload(inv) {
    await generateInvoicePDF(inv)
  }

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
        <span className="text-6xl">🧾</span>
        <p className="text-gray-500 text-sm">No invoices yet.<br />Tap below to create your first one.</p>
        <button
          onClick={onNew}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-semibold text-sm"
        >
          Create Invoice
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3 p-4">
      <div className="flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-900">Invoices</h1>
        <button
          onClick={onNew}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold"
        >
          + New
        </button>
      </div>

      {invoices.map(inv => {
        const totals = calcTotals(inv.items, inv.gstType)
        return (
          <div key={inv.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="flex justify-between items-start mb-2">
              <div>
                <span className="font-bold text-gray-900 text-base">Invoice #{inv.invoiceNo}</span>
                <p className="text-xs text-gray-400 mt-0.5">{inv.invoiceDate}</p>
              </div>
              <span className="font-bold text-blue-700 text-base">₹ {formatCurrency(totals.total)}</span>
            </div>

            <p className="text-sm text-gray-700 font-medium truncate">{inv.billedTo.name}</p>
            <p className="text-xs text-gray-400 truncate">{inv.billedTo.address}</p>

            <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
              <button
                onClick={() => onEdit(inv)}
                className="flex-1 py-1.5 text-xs font-medium border border-gray-200 rounded-lg text-gray-600"
              >
                Edit
              </button>
              <button
                onClick={() => handleDownload(inv)}
                className="flex-1 py-1.5 text-xs font-medium bg-blue-50 text-blue-600 rounded-lg border border-blue-100"
              >
                ⬇ PDF
              </button>
              <button
                onClick={() => handleDelete(inv.id)}
                className="px-3 py-1.5 text-xs font-medium text-red-400 border border-red-100 rounded-lg"
              >
                🗑
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}
