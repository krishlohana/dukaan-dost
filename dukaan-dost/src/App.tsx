/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {useCallback, useEffect, useState} from 'react';
import {Layout} from './components/Layout';
import {AiAssistantView} from './components/views/AiAssistantView';
import {CustomersView} from './components/views/CustomersView';
import {DashboardView} from './components/views/DashboardView';
import {ExpensesView} from './components/views/ExpensesView';
import {InventoryView} from './components/views/InventoryView';
import {ReportsView} from './components/views/ReportsView';
import {SalesView} from './components/views/SalesView';
import {SettingsView} from './components/views/SettingsView';
import {
  addProductStock,
  confirmAiAction,
  createCustomer,
  createExpense,
  createProduct,
  createSale,
  fetchCustomers,
  fetchDashboard,
  fetchExpenses,
  fetchHealthStatus,
  fetchProducts,
  fetchReports,
  fetchSales,
  recordCustomerPayment,
  updateProduct,
  updateSettings,
} from './lib/api';
import type {
  Customer,
  DashboardSummary,
  ExpenseCategory,
  ExpenseRecord,
  HealthStatus,
  NavTabId,
  PaymentMethod,
  Product,
  ReportsSummary,
  SaleRecord,
  ShopProfile,
} from './types/shop';

const INITIAL_PROFILE: ShopProfile = {
  shopName: 'Dukaan Dost — Apni Dukaan',
  ownerName: '',
  phone: '',
  cityAddress: '',
  currency: 'PKR',
};

const INITIAL_DASHBOARD: DashboardSummary = {
  shopId: 'default_shop',
  todaySales: 0,
  todayCashReceived: 0,
  todayCreditSales: 0,
  totalOutstandingCredit: 0,
  totalExpenses: 0,
  lowStockCount: 0,
  lowStockProducts: [],
  expiringProducts: [],
  recentTransactions: [],
  profile: INITIAL_PROFILE,
};

const INITIAL_REPORTS: ReportsSummary = {
  totalRevenue: 0,
  dailySales: 0,
  weeklySales: 0,
  monthlySales: 0,
  cashReceived: 0,
  creditSales: 0,
  totalExpenses: 0,
  grossProfit: 0,
  netProfit: 0,
  hasMissingPurchaseCosts: false,
  bestSellingProducts: [],
};

const INITIAL_HEALTH: HealthStatus = {
  status: 'unknown',
  server: 'unreachable',
  firebaseConnected: false,
  geminiConfigured: false,
  timestamp: new Date().toISOString(),
};

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTabId>('dashboard');
  const [dashboard, setDashboard] = useState<DashboardSummary>(INITIAL_DASHBOARD);
  const [sales, setSales] = useState<SaleRecord[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [expenses, setExpenses] = useState<ExpenseRecord[]>([]);
  const [reports, setReports] = useState<ReportsSummary>(INITIAL_REPORTS);

  const [dashboardLoading, setDashboardLoading] = useState<boolean>(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [healthStatus, setHealthStatus] = useState<HealthStatus>(INITIAL_HEALTH);
  const [healthLoading, setHealthLoading] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);

  const refreshHealth = useCallback(async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const status = await fetchHealthStatus();
      setHealthStatus(status);
    } catch (err) {
      setHealthStatus({
        status: 'error',
        server: 'unreachable',
        firebaseConnected: false,
        geminiConfigured: false,
        timestamp: new Date().toISOString(),
      });
      setHealthError(
        err instanceof Error ? err.message : 'Unable to reach backend /api/health endpoint.',
      );
    } finally {
      setHealthLoading(false);
    }
  }, []);

  const refreshAllData = useCallback(async () => {
    setDashboardLoading(true);
    setDashboardError(null);
    try {
      const [dashData, salesData, customersData, productsData, expensesData, reportsData] =
        await Promise.all([
          fetchDashboard('default_shop'),
          fetchSales('default_shop'),
          fetchCustomers('default_shop'),
          fetchProducts('default_shop'),
          fetchExpenses('default_shop'),
          fetchReports('default_shop'),
        ]);
      setDashboard(dashData);
      setSales(salesData);
      setCustomers(customersData);
      setInventory(productsData);
      setExpenses(expensesData);
      setReports(reportsData);
    } catch (err) {
      setDashboardError(
        err instanceof Error ? err.message : 'Failed to load shop data from Firestore.',
      );
    } finally {
      setDashboardLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshHealth();
    void refreshAllData();
  }, [refreshHealth, refreshAllData]);

  const handleCreateSale = async (payload: {
    productId: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    paymentMethod: PaymentMethod;
    customerId: string | null;
    amountPaid: number;
  }): Promise<SaleRecord> => {
    const created = await createSale(payload, 'default_shop');
    await refreshAllData();
    return created;
  };

  const handleAddCustomer = async (payload: {
    name: string;
    phone: string;
    notes: string;
  }): Promise<Customer> => {
    const created = await createCustomer(payload, 'default_shop');
    await refreshAllData();
    return created;
  };

  const handleRecordRepayment = async (
    customerId: string,
    payload: {amount: number; description: string},
  ) => {
    await recordCustomerPayment({customerId, ...payload}, 'default_shop');
    await refreshAllData();
  };

  const handleAddProduct = async (payload: {
    name: string;
    category: string;
    stockQuantity: number;
    purchasePrice: number | null;
    sellingPrice: number;
    lowStockThreshold: number;
    expiryDate: string | null;
  }) => {
    await createProduct(payload, 'default_shop');
    await refreshAllData();
  };

  const handleUpdateProduct = async (
    productId: string,
    payload: {
      name: string;
      category: string;
      stockQuantity: number;
      purchasePrice: number | null;
      sellingPrice: number;
      lowStockThreshold: number;
      expiryDate: string | null;
    },
  ) => {
    await updateProduct(productId, payload, 'default_shop');
    await refreshAllData();
  };

  const handleAddStock = async (productId: string, addQuantity: number) => {
    await addProductStock(productId, addQuantity, 'default_shop');
    await refreshAllData();
  };

  const handleRecordExpense = async (payload: {
    description: string;
    category: ExpenseCategory;
    amount: number;
    date: string;
  }) => {
    await createExpense(payload, 'default_shop');
    await refreshAllData();
  };

  const handleSaveProfile = async (profile: ShopProfile) => {
    await updateSettings(profile, 'default_shop');
    await refreshAllData();
  };

  const handleConfirmAiTransaction = async (pendingActionId: string) => {
    const result = await confirmAiAction(pendingActionId, 'default_shop');
    await refreshAllData();
    return result;
  };

  return (
    <Layout activeTab={activeTab} onSelectTab={setActiveTab} profile={dashboard.profile}>
      {activeTab === 'dashboard' && (
        <DashboardView
          dashboard={dashboard}
          isLoading={dashboardLoading}
          error={dashboardError}
          onRetry={() => {
            void refreshHealth();
            void refreshAllData();
          }}
          onNavigate={setActiveTab}
        />
      )}

      {activeTab === 'ai-assistant' && (
        <AiAssistantView onConfirmTransaction={handleConfirmAiTransaction} />
      )}

      {activeTab === 'sales' && (
        <SalesView
          profile={dashboard.profile}
          inventory={inventory}
          customers={customers}
          sales={sales}
          onCreateSale={handleCreateSale}
          onAddCustomer={handleAddCustomer}
          onNavigate={setActiveTab}
        />
      )}

      {activeTab === 'customers' && (
        <CustomersView
          customers={customers}
          onAddCustomer={handleAddCustomer}
          onRecordRepayment={handleRecordRepayment}
        />
      )}

      {activeTab === 'inventory' && (
        <InventoryView
          inventory={inventory}
          onAddProduct={handleAddProduct}
          onUpdateProduct={handleUpdateProduct}
          onAddStock={handleAddStock}
        />
      )}

      {activeTab === 'expenses' && (
        <ExpensesView expenses={expenses} onRecordExpense={handleRecordExpense} />
      )}

      {activeTab === 'reports' && (
        <ReportsView
          reports={reports}
          inventory={inventory}
          onNavigate={setActiveTab}
        />
      )}

      {activeTab === 'settings' && (
        <SettingsView
          profile={dashboard.profile}
          healthStatus={healthStatus}
          healthLoading={healthLoading}
          healthError={healthError}
          onSaveProfile={handleSaveProfile}
          onRefreshStatus={refreshHealth}
        />
      )}
    </Layout>
  );
}
