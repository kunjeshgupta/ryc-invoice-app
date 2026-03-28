import { useState } from 'react'
import InvoiceForm    from './components/InvoiceForm'
import InvoiceHistory from './components/InvoiceHistory'
import Settings       from './components/Settings'

const TABS = [
  { id: 'new',      label: 'New Invoice', icon: '＋' },
  { id: 'history',  label: 'History',     icon: '📋' },
  { id: 'settings', label: 'Settings',    icon: '⚙️' },
]

export default function App() {
  const [tab, setTab]                   = useState('history')
  const [editingInvoice, setEditing]    = useState(null)

  function openNew() {
    setEditing(null)
    setTab('new')
  }

  function openEdit(invoice) {
    setEditing(invoice)
    setTab('new')
  }

  function afterSave() {
    setTab('history')
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50 max-w-lg mx-auto">
      {/* Page content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {tab === 'new'      && <InvoiceForm key={editingInvoice?.id ?? 'new'} initial={editingInvoice} onSave={afterSave} />}
        {tab === 'history'  && <InvoiceHistory onNew={openNew} onEdit={openEdit} />}
        {tab === 'settings' && <Settings />}
      </div>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 max-w-lg mx-auto bg-white border-t border-gray-200 flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => { if (t.id === 'new') openNew(); else setTab(t.id) }}
            className={`flex-1 flex flex-col items-center py-2 text-xs gap-0.5 transition-colors ${
              tab === t.id ? 'text-blue-600' : 'text-gray-400'
            }`}
          >
            <span className="text-xl leading-none">{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
