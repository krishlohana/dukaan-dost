import {
  BarChart3,
  BookOpen,
  LayoutDashboard,
  Menu,
  MessageSquareText,
  Package,
  Receipt,
  Settings,
  ShoppingCart,
  Store,
  X,
} from 'lucide-react';
import type {ReactNode} from 'react';
import {useState} from 'react';
import type {NavTabId, ShopProfile} from '../types/shop';

export interface NavItemConfig {
  id: NavTabId;
  label: string;
  urduHint: string;
  icon: typeof LayoutDashboard;
}

export const NAV_ITEMS: NavItemConfig[] = [
  {id: 'dashboard', label: 'Dashboard', urduHint: 'Jaiza', icon: LayoutDashboard},
  {id: 'ai-assistant', label: 'AI Assistant', urduHint: 'Madadgar', icon: MessageSquareText},
  {id: 'sales', label: 'Sales', urduHint: 'Farokht / Bill', icon: ShoppingCart},
  {id: 'customers', label: 'Customers / Khata', urduHint: 'Udhaar Register', icon: BookOpen},
  {id: 'inventory', label: 'Inventory', urduHint: 'Samaan / Stock', icon: Package},
  {id: 'expenses', label: 'Expenses', urduHint: 'Akhrajaat', icon: Receipt},
  {id: 'reports', label: 'Reports', urduHint: 'Nafa / Hisaab', icon: BarChart3},
  {id: 'settings', label: 'Settings', urduHint: 'Dukaan Profile', icon: Settings},
];

const MOBILE_PRIMARY_TABS: NavTabId[] = ['dashboard', 'ai-assistant', 'sales', 'customers'];

interface LayoutProps {
  activeTab: NavTabId;
  onSelectTab: (tab: NavTabId) => void;
  profile: ShopProfile;
  children: ReactNode;
}

export function Layout({activeTab, onSelectTab, profile, children}: LayoutProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleSelect = (tab: NavTabId) => {
    onSelectTab(tab);
    setDrawerOpen(false);
  };

  const activeNav = NAV_ITEMS.find((item) => item.id === activeTab) ?? NAV_ITEMS[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 no-print">
        <div className="px-5 py-5 border-b border-slate-200 flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
            <Store className="w-5 h-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="block text-base font-bold text-slate-900 tracking-tight truncate">
              Dukaan Dost
            </span>
            <span className="block text-xs text-slate-500 truncate">
              Kiryana Store Assistant
            </span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto" aria-label="Main navigation">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelect(item.id)}
                aria-current={isActive ? 'page' : undefined}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-emerald-700 text-white font-semibold'
                    : 'text-slate-700 hover:bg-slate-100 hover:text-slate-900 font-medium'
                }`}
              >
                <Icon
                  className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`}
                  aria-hidden="true"
                />
                <span className="flex-1 min-w-0">
                  <span className="block text-sm leading-tight truncate">{item.label}</span>
                  <span
                    className={`block text-[11px] leading-tight mt-0.5 truncate ${
                      isActive ? 'text-emerald-100' : 'text-slate-500'
                    }`}
                  >
                    {item.urduHint}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50/70">
          <p className="text-xs font-medium text-slate-500">Active Shop</p>
          <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
            {profile.shopName || 'Dukaan Dost — Apni Dukaan'}
          </p>
          <p className="text-xs text-slate-500 mt-0.5">Currency: PKR (Rs.)</p>
        </div>
      </aside>

      {/* Mobile Compact Sticky Header */}
      <header className="lg:hidden sticky top-0 z-30 h-14 bg-white border-b border-slate-200 px-4 flex items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center shrink-0">
            <Store className="w-4 h-4" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <span className="block text-sm font-bold text-slate-900 truncate">Dukaan Dost</span>
            <span className="block text-[11px] text-slate-500 truncate">{activeNav.label}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Open navigation menu"
          className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>
      </header>

      {/* Mobile Collapsible Navigation Drawer */}
      {drawerOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex no-print" role="dialog" aria-modal="true">
          <div
            className="fixed inset-0 bg-slate-900/50"
            onClick={() => setDrawerOpen(false)}
            aria-hidden="true"
          />
          <div className="relative ml-auto w-72 max-w-[85vw] bg-white h-full border-l border-slate-200 flex flex-col">
            <div className="px-4 h-14 border-b border-slate-200 flex items-center justify-between">
              <span className="text-base font-bold text-slate-900">All Menu Options</span>
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Close navigation menu"
                className="min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <nav className="flex-1 p-3 space-y-1 overflow-y-auto" aria-label="Mobile drawer navigation">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleSelect(item.id)}
                    className={`w-full min-h-[48px] flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-left transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-emerald-700 text-white font-semibold'
                        : 'text-slate-700 hover:bg-slate-100 font-medium'
                    }`}
                  >
                    <Icon
                      className={`w-5 h-5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm truncate">{item.label}</span>
                      <span
                        className={`block text-xs truncate ${
                          isActive ? 'text-emerald-100' : 'text-slate-500'
                        }`}
                      >
                        {item.urduHint}
                      </span>
                    </span>
                  </button>
                );
              })}
            </nav>

            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <p className="text-xs text-slate-500">Shop Profile</p>
              <p className="text-sm font-semibold text-slate-900 truncate mt-0.5">
                {profile.shopName || 'Dukaan Dost — Apni Dukaan'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="flex-1 lg:pl-64 pb-20 lg:pb-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">{children}</div>
      </main>

      {/* Mobile Fixed Bottom Navigation Bar */}
      <nav
        aria-label="Quick bottom navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white border-t border-slate-200 grid grid-cols-5 items-center no-print"
      >
        {MOBILE_PRIMARY_TABS.map((tabId) => {
          const item = NAV_ITEMS.find((n) => n.id === tabId)!;
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          const shortLabel =
            item.id === 'ai-assistant'
              ? 'Assistant'
              : item.id === 'customers'
                ? 'Khata'
                : item.label;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelect(item.id)}
              className={`h-full flex flex-col items-center justify-center gap-1 px-1 cursor-pointer ${
                isActive ? 'text-emerald-700 font-semibold' : 'text-slate-600 font-medium'
              }`}
            >
              <Icon className="w-5 h-5" aria-hidden="true" />
              <span className="text-[11px] leading-none whitespace-nowrap">{shortLabel}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className={`h-full flex flex-col items-center justify-center gap-1 px-1 cursor-pointer ${
            !MOBILE_PRIMARY_TABS.includes(activeTab)
              ? 'text-emerald-700 font-semibold'
              : 'text-slate-600 font-medium'
          }`}
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
          <span className="text-[11px] leading-none whitespace-nowrap">More</span>
        </button>
      </nav>
    </div>
  );
}
