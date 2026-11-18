import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarClock,
  MessageSquareText,
  Package,
  Plus,
  Receipt,
  RefreshCw,
  ShoppingCart,
} from 'lucide-react';
import type {DashboardSummary, NavTabId} from '../../types/shop';
import {
  formatDateTime,
  formatPKR,
  formatShortDate,
  formatTodayDate,
  getDaysUntilExpiry,
} from '../../utils/format';
import {EmptyState} from '../EmptyState';

interface DashboardViewProps {
  dashboard: DashboardSummary;
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  onNavigate: (tab: NavTabId) => void;
}

export function DashboardView({
  dashboard,
  isLoading,
  error,
  onRetry,
  onNavigate,
}: DashboardViewProps) {
  const {lowStockProducts, expiringProducts = [], recentTransactions, profile} = dashboard;

  const summaryCards = [
    {
      label: "Today's Total Sales",
      sublabel: 'Aaj ki Kul Farokht',
      value: formatPKR(dashboard.todaySales),
      tone: 'text-emerald-700',
    },
    {
      label: "Today's Cash Received",
      sublabel: 'Naqad Wasooli',
      value: formatPKR(dashboard.todayCashReceived),
      tone: 'text-slate-900',
    },
    {
      label: "Today's Credit Sales (Udhaar)",
      sublabel: 'Aaj ka Udhaar',
      value: formatPKR(dashboard.todayCreditSales),
      tone: 'text-amber-700',
    },
    {
      label: 'Total Outstanding Customer Credit',
      sublabel: 'Kul Market Udhaar',
      value: formatPKR(dashboard.totalOutstandingCredit),
      tone: 'text-slate-900',
    },
    {
      label: 'Total Expenses',
      sublabel: 'Kul Akhrajaat',
      value: formatPKR(dashboard.totalExpenses),
      tone: 'text-slate-900',
    },
    {
      label: 'Low-Stock Alert Count',
      sublabel: 'Kam Stock Ashya',
      value: `${dashboard.lowStockCount} ${dashboard.lowStockCount === 1 ? 'item' : 'items'}`,
      tone: dashboard.lowStockCount > 0 ? 'text-amber-700' : 'text-slate-900',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-emerald-700">
            Digital Kiryana Overview · Aaj ka Hisaab
          </p>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">
            {profile.shopName || 'Dukaan Dost — Apni Dukaan'}
          </h1>
          <p className="text-sm text-slate-600 mt-1">{formatTodayDate()}</p>
        </div>

        {/* Quick Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('sales')}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span>New Sale</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('customers')}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BookOpen className="w-4 h-4 text-emerald-700" aria-hidden="true" />
            <span>Add Udhaar / Repayment</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('ai-assistant')}
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200 hover:bg-emerald-100 text-emerald-800 text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <MessageSquareText className="w-4 h-4" aria-hidden="true" />
            <span>Ask AI Assistant</span>
          </button>
        </div>
      </div>

      {/* Red Expiry Notice */}
      {expiringProducts.length > 0 && (
        <div
          role="alert"
          className="bg-red-50 border border-red-300 rounded-xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-red-950"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 border border-red-200 flex items-center justify-center text-red-700 shrink-0">
              <CalendarClock className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-bold text-red-900">
                Expiry Notice: {expiringProducts.length}{' '}
                {expiringProducts.length === 1 ? 'product is' : 'products are'} near expiry or expired — Order new items
              </p>
              <p className="text-xs sm:text-sm text-red-800 mt-1">
                {expiringProducts
                  .slice(0, 4)
                  .map((item) => {
                    const days = getDaysUntilExpiry(item.expiryDate);
                    const status =
                      days === null
                        ? ''
                        : days < 0
                          ? 'Expired'
                          : days === 0
                            ? 'Expires today'
                            : `${days}d left (${formatShortDate(item.expiryDate || '')})`;
                    return `${item.name} (${status})`;
                  })
                  .join(' · ')}
                {expiringProducts.length > 4
                  ? ` +${expiringProducts.length - 4} more`
                  : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('inventory')}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-red-700 hover:bg-red-800 text-white text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Order / Check Inventory</span>
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Backend Error State */}
      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 rounded-xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-red-900"
        >
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-5 h-5 text-red-700 shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold">Backend Connection Issue</p>
              <p className="text-xs text-red-800 mt-0.5">{error}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onRetry}
            className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-red-300 hover:bg-red-100 text-red-900 text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Retry Connection</span>
          </button>
        </div>
      )}

      {/* 6 Summary Metric Cards */}
      <section aria-label="Shop summary metrics">
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 animate-pulse"
              >
                <div>
                  <div className="h-4 w-40 bg-slate-200 rounded" />
                  <div className="h-3 w-28 bg-slate-100 rounded mt-2" />
                </div>
                <div className="h-8 w-24 bg-slate-200 rounded" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {summaryCards.map((card) => (
              <div
                key={card.label}
                className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col justify-between"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-800">{card.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{card.sublabel}</p>
                </div>
                <p className={`text-2xl sm:text-3xl font-bold tabular-nums mt-4 ${card.tone}`}>
                  {card.value}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Two Sections: Low-Stock Alerts & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low-Stock Alerts */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Low-Stock Alerts</h2>
              <p className="text-xs text-slate-500 mt-0.5">Kam Stock ki Fehrist</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Open Inventory</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {lowStockProducts.length === 0 ? (
            <EmptyState
              icon={Package}
              title="No low-stock alerts"
              description="No records yet. Add products in Inventory or connect database to monitor low-stock thresholds."
              actionLabel="Go to Inventory"
              onAction={() => onNavigate('inventory')}
            />
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {lowStockProducts.map((item) => (
                <div
                  key={item.id}
                  className="px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      {item.category} · Alert below {item.lowStockThreshold}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-md tabular-nums whitespace-nowrap shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
                    {item.stockQuantity} left
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Recent Transactions */}
        <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Recent Transactions</h2>
              <p className="text-xs text-slate-500 mt-0.5">Haaliya Farokht aur Lain Dain</p>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('sales')}
              className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>View All Sales</span>
              <ArrowRight className="w-4 h-4" aria-hidden="true" />
            </button>
          </div>

          {recentTransactions.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No transactions yet"
              description="Connect database to load records or record your first cash or udhaar sale."
              actionLabel="Record First Sale"
              onAction={() => onNavigate('sales')}
            />
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {recentTransactions.map((sale) => (
                <div
                  key={sale.id}
                  className="px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      {sale.productName} × {sale.quantity}
                    </p>
                    <p className="text-xs text-slate-500 truncate">
                      {sale.receiptNumber} · {formatDateTime(sale.createdAt)}
                      {sale.customerName ? ` · ${sale.customerName}` : ''}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-slate-900 tabular-nums">
                      {formatPKR(sale.totalAmount)}
                    </p>
                    <p className="text-xs text-slate-500 capitalize">{sale.paymentMethod}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Helpful Footer Strip for First-Time Shopkeeper */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
            <ShoppingCart className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900">
              Ready to digitize your Kiryana Khata
            </h3>
            <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">
              Start by adding your regular items in Inventory, recording customers in Khata, or
              testing Roman Urdu commands in the AI Assistant.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('settings')}
          className="min-h-[44px] px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          Check Connections
        </button>
      </section>
    </div>
  );
}
