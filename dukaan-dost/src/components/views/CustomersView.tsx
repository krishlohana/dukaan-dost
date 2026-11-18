import {
  Banknote,
  BookOpen,
  Check,
  Copy,
  ExternalLink,
  MessageSquare,
  Plus,
  Search,
  UserPlus,
  X,
} from 'lucide-react';
import type {FormEvent} from 'react';
import {useMemo, useState} from 'react';
import type {Customer} from '../../types/shop';
import {formatDateTime, formatPKR} from '../../utils/format';
import {EmptyState} from '../EmptyState';

interface CustomersViewProps {
  customers: Customer[];
  onAddCustomer: (payload: {name: string; phone: string; notes: string}) => Promise<Customer>;
  onRecordRepayment: (
    customerId: string,
    payload: {amount: number; description: string},
  ) => Promise<void>;
}

function buildWhatsAppLink(phone: string, text: string): string {
  const digits = phone.replace(/\D/g, '');
  const encodedText = encodeURIComponent(text);
  if (!digits) {
    return `https://wa.me/?text=${encodedText}`;
  }
  const normalized = digits.startsWith('0') ? `92${digits.slice(1)}` : digits;
  return `https://wa.me/${normalized}?text=${encodedText}`;
}

export function CustomersView({
  customers,
  onAddCustomer,
  onRecordRepayment,
}: CustomersViewProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [showRepayModal, setShowRepayModal] = useState(false);
  const [repayAmount, setRepayAmount] = useState('');
  const [repayNote, setRepayNote] = useState('');
  const [isRepaying, setIsRepaying] = useState(false);

  const [showReminderModal, setShowReminderModal] = useState(false);
  const [copiedReminder, setCopiedReminder] = useState(false);

  const totalMarketUdhaar = useMemo(
    () => customers.reduce((sum, c) => sum + Math.max(0, c.remainingBalance), 0),
    [customers],
  );

  const filteredCustomers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customers;
    return customers.filter(
      (c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q),
    );
  }, [customers, searchQuery]);

  const selectedCustomer = useMemo(
    () => customers.find((c) => c.id === selectedCustomerId) ?? customers[0] ?? null,
    [customers, selectedCustomerId],
  );

  const handleAddSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError('Customer name is required.');
      return;
    }
    setIsSaving(true);
    try {
      const created = await onAddCustomer({name, phone, notes});
      setSelectedCustomerId(created.id);
      setName('');
      setPhone('');
      setNotes('');
      setShowAddForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to add customer.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRepaySubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer || isRepaying) return;
    const numeric = Number(repayAmount);
    if (!Number.isFinite(numeric) || numeric <= 0) return;

    setIsRepaying(true);
    try {
      await onRecordRepayment(selectedCustomer.id, {
        amount: numeric,
        description: repayNote.trim() || 'Cash repayment (Wasooli)',
      });
      setRepayAmount('');
      setRepayNote('');
      setShowRepayModal(false);
    } finally {
      setIsRepaying(false);
    }
  };

  const reminderMessage = selectedCustomer
    ? `Assalam-o-Alaikum ${selectedCustomer.name} bhai, aapka Dukaan Dost par kul baqaya udhaar ${formatPKR(selectedCustomer.remainingBalance)} hai. Barah-e-meharbani jald ada kar dein. Shukriya!`
    : '';

  const whatsAppHref = selectedCustomer
    ? buildWhatsAppLink(selectedCustomer.phone, reminderMessage)
    : 'https://wa.me/';

  const handleCopyReminder = async () => {
    if (!reminderMessage) return;
    try {
      await navigator.clipboard.writeText(reminderMessage);
      setCopiedReminder(true);
      setTimeout(() => setCopiedReminder(false), 2000);
    } catch {
      // Clipboard fallback ignored
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Market Udhaar Summary */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-slate-500">
            Customers / Khata · Udhaar Register
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            Total Market Udhaar (Outstanding Credit):{' '}
            <span className="text-emerald-700 tabular-nums">{formatPKR(totalMarketUdhaar)}</span>
          </h1>
        </div>

        <button
          type="button"
          onClick={() => setShowAddForm((prev) => !prev)}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>{showAddForm ? 'Close Form' : '+ Add Customer'}</span>
        </button>
      </div>

      {/* Add Customer Form */}
      {showAddForm && (
        <form
          onSubmit={handleAddSubmit}
          className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-emerald-700" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900">Add New Customer to Khata</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="cust-name"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Customer Name *
              </label>
              <input
                id="cust-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Muhammad Rashid"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label
                htmlFor="cust-phone"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Phone Number
              </label>
              <input
                id="cust-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0300-1234567"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label
                htmlFor="cust-notes"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Notes (Pata / Nishani)
              </label>
              <input
                id="cust-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g., Gali #4, Masjid ke paas"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSaving}
              className="min-h-[44px] px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
            >
              {isSaving ? 'Saving...' : 'Save Customer'}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search
          className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search customer by name or phone number..."
          aria-label="Search customers"
          className="w-full min-h-[44px] pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />
      </div>

      {/* Customer List & Ledger Detail Split */}
      {customers.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl p-6">
          <EmptyState
            icon={BookOpen}
            title="No customers in Khata yet"
            description="No records yet. Add your first customer to start tracking Udhaar and repayments in Firestore."
            actionLabel="+ Add Customer"
            onAction={() => setShowAddForm(true)}
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Customer List */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
              <h2 className="text-sm font-bold text-slate-800">
                Customer List ({filteredCustomers.length})
              </h2>
            </div>
            <div className="divide-y divide-slate-100 max-h-[500px] overflow-y-auto">
              {filteredCustomers.length === 0 ? (
                <p className="p-5 text-sm text-slate-500 text-center">
                  No matching customers found.
                </p>
              ) : (
                filteredCustomers.map((customer) => {
                  const isSelected = selectedCustomer?.id === customer.id;
                  return (
                    <button
                      key={customer.id}
                      type="button"
                      onClick={() => setSelectedCustomerId(customer.id)}
                      className={`w-full px-4 py-3.5 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                        isSelected ? 'bg-emerald-50' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">
                          {customer.name}
                        </p>
                        <p className="text-xs text-slate-500 truncate mt-0.5">
                          {customer.phone || 'No phone number'}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p
                          className={`text-sm font-bold tabular-nums ${
                            customer.remainingBalance > 0 ? 'text-amber-700' : 'text-emerald-700'
                          }`}
                        >
                          {formatPKR(customer.remainingBalance)}
                        </p>
                        <p className="text-[11px] text-slate-500">Baqaya</p>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Customer Ledger Detail Panel */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
            {selectedCustomer ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-4 border-b border-slate-200">
                  <div>
                    <h2 className="text-lg font-bold text-slate-900">{selectedCustomer.name}</h2>
                    <p className="text-sm text-slate-600 mt-0.5">
                      {selectedCustomer.phone || 'Phone not added'}
                      {selectedCustomer.notes ? ` · ${selectedCustomer.notes}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setShowRepayModal(true)}
                      className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold whitespace-nowrap cursor-pointer"
                    >
                      <Banknote className="w-4 h-4" aria-hidden="true" />
                      <span>Record Repayment</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowReminderModal(true)}
                      className="min-h-[44px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-semibold whitespace-nowrap cursor-pointer"
                    >
                      <MessageSquare className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                      <span>Send Payment Reminder</span>
                    </button>
                  </div>
                </div>

                {/* Credit / Paid / Balance Metrics */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-xs text-slate-500">Total Credit</p>
                    <p className="text-base sm:text-lg font-bold text-slate-900 tabular-nums mt-1">
                      {formatPKR(selectedCustomer.totalCredit)}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-xs text-slate-500">Total Paid</p>
                    <p className="text-base sm:text-lg font-bold text-emerald-700 tabular-nums mt-1">
                      {formatPKR(selectedCustomer.totalPaid)}
                    </p>
                  </div>
                  <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="text-xs text-slate-500">Remaining Balance</p>
                    <p className="text-base sm:text-lg font-bold text-amber-700 tabular-nums mt-1">
                      {formatPKR(selectedCustomer.remainingBalance)}
                    </p>
                  </div>
                </div>

                {/* Transaction History Table */}
                <div>
                  <h3 className="text-sm font-bold text-slate-900 mb-3">
                    Immutable Transaction History
                  </h3>
                  {selectedCustomer.transactions.length === 0 ? (
                    <p className="text-sm text-slate-500 py-6 text-center bg-slate-50 border border-dashed border-slate-200 rounded-lg">
                      No Khata transactions for this customer yet.
                    </p>
                  ) : (
                    <div className="overflow-x-auto border border-slate-200 rounded-lg">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                            <th className="py-2.5 px-3.5">Date</th>
                            <th className="py-2.5 px-3.5">Type</th>
                            <th className="py-2.5 px-3.5">Details</th>
                            <th className="py-2.5 px-3.5 text-right">Amount</th>
                            <th className="py-2.5 px-3.5 text-right">Balance</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-sm">
                          {selectedCustomer.transactions.map((txn) => (
                            <tr key={txn.id}>
                              <td className="py-2.5 px-3.5 text-xs text-slate-500 whitespace-nowrap">
                                {formatDateTime(txn.date)}
                              </td>
                              <td className="py-2.5 px-3.5 text-xs font-semibold">
                                {txn.type === 'credit' ? (
                                  <span className="text-amber-700">Udhaar</span>
                                ) : (
                                  <span className="text-emerald-700">Wasooli</span>
                                )}
                              </td>
                              <td className="py-2.5 px-3.5 text-slate-700">{txn.description}</td>
                              <td className="py-2.5 px-3.5 text-right font-semibold tabular-nums text-slate-900">
                                {formatPKR(txn.amount)}
                              </td>
                              <td className="py-2.5 px-3.5 text-right tabular-nums text-slate-600">
                                {formatPKR(txn.balanceAfter)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">Select a customer to view their ledger.</p>
            )}
          </div>
        </div>
      )}

      {/* Record Repayment Modal */}
      {showRepayModal && selectedCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleRepaySubmit}
            className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Record Repayment · Wasooli
              </h3>
              <button
                type="button"
                onClick={() => setShowRepayModal(false)}
                aria-label="Close modal"
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Customer: <span className="font-semibold text-slate-900">{selectedCustomer.name}</span>{' '}
              (Current Balance: {formatPKR(selectedCustomer.remainingBalance)})
            </p>
            <div>
              <label
                htmlFor="repay-amount"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Amount Received (Rs.) *
              </label>
              <input
                id="repay-amount"
                type="number"
                min="1"
                required
                value={repayAmount}
                onChange={(e) => setRepayAmount(e.target.value)}
                placeholder="e.g., 500"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div>
              <label
                htmlFor="repay-note"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Note (Optional)
              </label>
              <input
                id="repay-note"
                type="text"
                value={repayNote}
                onChange={(e) => setRepayNote(e.target.value)}
                placeholder="e.g., Cash received at counter"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="submit"
                disabled={isRepaying}
                className="flex-1 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
              >
                {isRepaying ? 'Saving...' : 'Save Repayment'}
              </button>
              <button
                type="button"
                onClick={() => setShowRepayModal(false)}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Payment Reminder Preview Modal with Copy & Open WhatsApp */}
      {showReminderModal && selectedCustomer && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Payment Reminder Message</h3>
              <button
                type="button"
                onClick={() => setShowReminderModal(false)}
                aria-label="Close modal"
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <p className="text-xs text-slate-500 leading-relaxed">
              This reminder does not auto-send or change any customer balance. Review and send
              manually to {selectedCustomer.phone || selectedCustomer.name}:
            </p>
            <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-800 leading-relaxed">
              {reminderMessage}
            </div>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <button
                type="button"
                onClick={() => void handleCopyReminder()}
                className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-semibold cursor-pointer"
              >
                {copiedReminder ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" aria-hidden="true" />
                    <span>Copy Message</span>
                  </>
                )}
              </button>

              <a
                href={whatsAppHref}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4" aria-hidden="true" />
                <span>Open WhatsApp</span>
              </a>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
