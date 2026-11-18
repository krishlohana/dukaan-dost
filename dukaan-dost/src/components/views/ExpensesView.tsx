import {Plus, Receipt} from 'lucide-react';
import type {FormEvent} from 'react';
import {useMemo, useState} from 'react';
import type {ExpenseCategory, ExpenseRecord} from '../../types/shop';
import {formatPKR, formatShortDate, getTodayInputDate} from '../../utils/format';
import {EmptyState} from '../EmptyState';

const EXPENSE_CATEGORIES: ExpenseCategory[] = [
  'Electricity Bill',
  'Shop Rent',
  'Transportation',
  'Employee Salary',
  'Maintenance',
  'Other',
];

interface ExpensesViewProps {
  expenses: ExpenseRecord[];
  onRecordExpense: (payload: {
    description: string;
    category: ExpenseCategory;
    amount: number;
    date: string;
  }) => Promise<void>;
}

export function ExpensesView({expenses, onRecordExpense}: ExpensesViewProps) {
  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState<ExpenseCategory>('Electricity Bill');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getTodayInputDate());
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const todayStr = getTodayInputDate();
  const currentMonthPrefix = todayStr.slice(0, 7);

  const todayExpenses = useMemo(
    () =>
      expenses
        .filter((e) => e.date === todayStr)
        .reduce((sum, e) => sum + e.amount, 0),
    [expenses, todayStr],
  );

  const monthExpenses = useMemo(
    () =>
      expenses
        .filter((e) => e.date.startsWith(currentMonthPrefix))
        .reduce((sum, e) => sum + e.amount, 0),
    [expenses, currentMonthPrefix],
  );

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const numericAmount = Number(amount);
    if (!description.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFormError('Please enter a description and valid amount in Rs.');
      return;
    }

    setIsSaving(true);
    try {
      await onRecordExpense({
        description: description.trim(),
        category,
        amount: numericAmount,
        date,
      });
      setDescription('');
      setAmount('');
      setDate(getTodayInputDate());
      setShowForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to record expense.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Expenses / Akhrajaat</h1>
          <p className="text-sm text-slate-600 mt-1">
            Bijli ka bill, kiraya, mazdoori, aur rozana ke akhrajaat record karein
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowForm((prev) => !prev)}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>{showForm ? 'Close Form' : '+ Record Expense'}</span>
        </button>
      </div>

      {/* Summary Cards: Today & This Month */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-700">Today&apos;s Expenses</p>
          <p className="text-xs text-slate-500 mt-0.5">Aaj ke Akhrajaat</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums mt-3">
            {formatPKR(todayExpenses)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-700">This Month&apos;s Expenses</p>
          <p className="text-xs text-slate-500 mt-0.5">Is Mahine ke Akhrajaat</p>
          <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums mt-3">
            {formatPKR(monthExpenses)}
          </p>
        </div>
      </div>

      {/* Record Expense Form */}
      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
        >
          <h2 className="text-base font-bold text-slate-900">Record New Expense</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="lg:col-span-2">
              <label
                htmlFor="exp-desc"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Description *
              </label>
              <input
                id="exp-desc"
                type="text"
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., WAPDA Bijli Bill, Dukaan Kiraya"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="exp-cat"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Category
              </label>
              <select
                id="exp-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
                className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {EXPENSE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="exp-amount"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Amount (Rs.) *
              </label>
              <input
                id="exp-amount"
                type="number"
                min="1"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="exp-date"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Date
              </label>
              <input
                id="exp-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
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
              {isSaving ? 'Saving...' : 'Save Expense'}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Expense History */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Expense History</h2>
            <p className="text-xs text-slate-500 mt-0.5">Akhrajaat ki Tafseel</p>
          </div>
          <span className="text-xs text-slate-500 tabular-nums">
            {expenses.length} {expenses.length === 1 ? 'entry' : 'entries'}
          </span>
        </div>

        {expenses.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No expenses recorded yet"
            description="No records yet. Connect database to load records or record an expense using the button above."
            actionLabel="+ Record Expense"
            onAction={() => setShowForm(true)}
          />
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {expenses.map((exp) => (
                  <tr key={exp.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatShortDate(exp.date)}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {exp.description}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{exp.category}</td>
                    <td className="py-3 px-4 text-right font-bold tabular-nums text-slate-900">
                      {formatPKR(exp.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
