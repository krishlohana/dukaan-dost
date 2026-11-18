import {
  AlertCircle,
  BarChart3,
  Bot,
  Info,
  PackageCheck,
  Sparkles,
  TrendingUp,
} from 'lucide-react';
import {useState} from 'react';
import {fetchBusinessInsights} from '../../lib/api';
import type {
  AiBusinessInsights,
  NavTabId,
  Product,
  ReportsSummary,
} from '../../types/shop';
import {formatDateTime, formatPKR} from '../../utils/format';
import {EmptyState} from '../EmptyState';

interface ReportsViewProps {
  reports: ReportsSummary;
  inventory: Product[];
  onNavigate: (tab: NavTabId) => void;
}

export function ReportsView({reports, inventory, onNavigate}: ReportsViewProps) {
  const [insights, setInsights] = useState<AiBusinessInsights | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);

  const predictedProducts = inventory.filter(
    (p) => p.estimatedDaysRemaining !== null && p.estimatedDaysRemaining !== undefined,
  );

  const handleGenerateInsights = async () => {
    setLoadingInsights(true);
    setInsightsError(null);
    try {
      const result = await fetchBusinessInsights('default_shop');
      setInsights(result);
    } catch (err) {
      setInsightsError(
        err instanceof Error ? err.message : 'Unable to generate AI Business Insights.',
      );
    } finally {
      setLoadingInsights(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <h1 className="text-xl font-bold text-slate-900">Reports / Munafa aur Hisaab</h1>
        <p className="text-sm text-slate-600 mt-1">
          Sales, Cash vs. Udhaar, Expenses, aur Net Profit ka mukammal khulasa (Cloud Firestore se)
        </p>
      </div>

      {/* Daily / Weekly / Monthly Sales */}
      <section aria-label="Sales period breakdown" className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-700">Daily Sales</p>
          <p className="text-xs text-slate-500 mt-0.5">Aaj ki Farokht</p>
          <p className="text-2xl font-bold text-emerald-700 tabular-nums mt-3">
            {formatPKR(reports.dailySales)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-700">Weekly Sales</p>
          <p className="text-xs text-slate-500 mt-0.5">Pichlay 7 Din ki Farokht</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-3">
            {formatPKR(reports.weeklySales)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-700">Monthly Sales</p>
          <p className="text-xs text-slate-500 mt-0.5">Is Mahine ki Farokht</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-3">
            {formatPKR(reports.monthlySales)}
          </p>
        </div>
      </section>

      {/* Revenue & Cash vs Credit, Expenses, Gross Profit, Net Profit */}
      <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-700">Revenue Breakdown</p>
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Total Revenue</span>
              <span className="font-bold text-slate-900 tabular-nums">
                {formatPKR(reports.totalRevenue)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Cash Received</span>
              <span className="font-bold text-emerald-700 tabular-nums">
                {formatPKR(reports.cashReceived)}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-slate-600">Credit Sales (Udhaar)</span>
              <span className="font-bold text-amber-700 tabular-nums">
                {formatPKR(reports.creditSales)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-700">Total Expenses</p>
          <p className="text-xs text-slate-500 mt-0.5">Kul Akhrajaat</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-3">
            {formatPKR(reports.totalExpenses)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-700">Gross Profit</p>
          <p className="text-xs text-slate-500 mt-0.5">Akhrajaat se Pehle Munafa</p>
          <p className="text-2xl font-bold text-emerald-700 tabular-nums mt-3">
            {formatPKR(reports.grossProfit)}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-700">Net Profit</p>
          <p className="text-xs text-slate-500 mt-0.5">Khaalis Munafa</p>
          <p className="text-2xl font-bold text-slate-900 tabular-nums mt-3">
            {formatPKR(reports.netProfit)}
          </p>
        </div>
      </section>

      {/* Missing Purchase Cost Note */}
      <div
        className={`flex items-start gap-3 p-4 rounded-xl border ${
          reports.hasMissingPurchaseCosts
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : 'bg-slate-100 border-slate-200 text-slate-700'
        }`}
      >
        <Info className="w-5 h-5 shrink-0 mt-0.5" aria-hidden="true" />
        <p className="text-xs sm:text-sm leading-relaxed">
          <span className="font-semibold">Purchase Cost Note:</span>{' '}
          {reports.hasMissingPurchaseCosts
            ? 'Some recorded sales do not have a linked Purchase Price (Khareed Qeemat). Gross and Net Profit treat missing purchase costs as Rs. 0 until Purchase Price is added in Inventory.'
            : 'Gross Profit and Net Profit calculate margins from your Inventory Purchase Prices. Keep Purchase Prices updated in Inventory for accurate profit figures.'}
        </p>
      </div>

      {/* Best-Selling Products */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Best-Selling Products</h2>
            <p className="text-xs text-slate-500 mt-0.5">Sab Se Zyada Bikne Wala Samaan</p>
          </div>
          <TrendingUp className="w-5 h-5 text-emerald-700" aria-hidden="true" />
        </div>

        {reports.bestSellingProducts.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No sales data yet"
            description="Best-selling products will appear here automatically once sales are recorded."
            actionLabel="Record a Sale"
            onAction={() => onNavigate('sales')}
          />
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-4 text-right">Units Sold</th>
                  <th className="py-3 px-4 text-right">Total Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {reports.bestSellingProducts.map((item) => (
                  <tr key={item.productName}>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {item.productName}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-700">
                      {item.unitsSold}
                    </td>
                    <td className="py-3 px-4 text-right font-bold tabular-nums text-emerald-700">
                      {formatPKR(item.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* AI Business Advisor & Smart Stock Prediction Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                <Bot className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">AI Business Advisor</h2>
                <p className="text-xs text-slate-500">Karobari Mashwara (Gemini 3.8 Flash)</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => void handleGenerateInsights()}
              disabled={loadingInsights}
              className="min-h-[40px] inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-60 text-white text-xs sm:text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" aria-hidden="true" />
              <span>
                {loadingInsights ? 'Analyzing...' : 'Generate AI Business Insights'}
              </span>
            </button>
          </div>

          {insightsError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
              <span>{insightsError}</span>
            </div>
          )}

          {insights ? (
            <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-lg p-4">
              <p className="text-sm font-bold text-slate-900">{insights.headline}</p>

              <div>
                <p className="text-xs font-semibold text-slate-600 mb-1">Key Highlights</p>
                <ul className="list-disc pl-4 space-y-1 text-sm text-slate-700">
                  {insights.highlights.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>

              <div>
                <p className="text-xs font-semibold text-emerald-800 mb-1">Actionable Advice</p>
                <ul className="list-disc pl-4 space-y-1 text-sm text-slate-800">
                  {insights.actionableTips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </div>

              <p className="text-xs text-slate-600 pt-2 border-t border-slate-200">
                <span className="font-semibold text-slate-800">Stock Advice:</span>{' '}
                {insights.stockAdvice}
              </p>
              <p className="text-[11px] text-slate-400">
                Generated at {formatDateTime(insights.generatedAt)}
              </p>
            </div>
          ) : (
            <p className="text-sm text-slate-600 leading-relaxed">
              Click &ldquo;Generate AI Business Insights&rdquo; to send your real Firestore sales,
              credit, expense, and profit totals to Gemini for practical shopkeeper advice in
              English and Roman Urdu.
            </p>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 shrink-0">
                <PackageCheck className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-900">Smart Stock Prediction</h2>
                <p className="text-xs text-slate-500">
                  Estimated prediction, not a guarantee
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="min-h-[38px] px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-xs font-semibold text-slate-800 whitespace-nowrap cursor-pointer"
            >
              Open Inventory
            </button>
          </div>

          {predictedProducts.length === 0 ? (
            <p className="text-sm text-slate-600 leading-relaxed">
              No sales velocity data yet. Once linked Inventory products are sold, daily sales
              velocity will estimate remaining days of stock here (clearly labeled as an estimate,
              not a guarantee).
            </p>
          ) : (
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
              {predictedProducts.slice(0, 5).map((item) => (
                <div
                  key={item.id}
                  className="px-4 py-3 flex items-center justify-between gap-3 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{item.name}</p>
                    <p className="text-xs text-slate-500">
                      Stock: {item.stockQuantity} · Velocity: {item.dailySalesVelocity}/day
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-emerald-700 tabular-nums">
                      ~{item.estimatedDaysRemaining} days
                    </p>
                    <p className="text-[11px] text-slate-500">Estimated only</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
