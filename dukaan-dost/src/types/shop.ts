export type NavTabId =
  | 'dashboard'
  | 'ai-assistant'
  | 'sales'
  | 'customers'
  | 'inventory'
  | 'expenses'
  | 'reports'
  | 'settings';

export type PaymentMethod = 'cash' | 'credit' | 'partial';

export type ExpenseCategory =
  | 'Electricity Bill'
  | 'Shop Rent'
  | 'Transportation'
  | 'Employee Salary'
  | 'Maintenance'
  | 'Other';

export type AiIntentType =
  | 'QUERY_SALES'
  | 'QUERY_CUSTOMER_CREDIT'
  | 'QUERY_STOCK'
  | 'QUERY_EXPENSES'
  | 'QUERY_PROFIT'
  | 'RECORD_CREDIT_SALE'
  | 'RECORD_CASH_SALE'
  | 'RECORD_REPAYMENT'
  | 'RECORD_EXPENSE'
  | 'ADD_STOCK'
  | 'UNKNOWN';

export type WriteActionType =
  | 'RECORD_CREDIT_SALE'
  | 'RECORD_CASH_SALE'
  | 'RECORD_REPAYMENT'
  | 'RECORD_EXPENSE'
  | 'ADD_STOCK';

export interface ShopProfile {
  shopName: string;
  ownerName: string;
  phone: string;
  cityAddress: string;
  currency: 'PKR';
}

export interface HealthStatus {
  status: string;
  server: 'connected' | 'unreachable';
  firebaseConnected: boolean;
  geminiConfigured: boolean;
  timestamp: string;
}

export interface FirebaseTestResult {
  ok: boolean;
  message: string;
  projectId: string;
  latencyMs: number;
  testedAt: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  stockQuantity: number;
  purchasePrice: number | null;
  sellingPrice: number;
  lowStockThreshold: number;
  expiryDate?: string | null;
  dailySalesVelocity?: number;
  estimatedDaysRemaining?: number | null;
  updatedAt: string;
}

export interface CustomerTransaction {
  id: string;
  type: 'credit' | 'repayment';
  amount: number;
  description: string;
  date: string;
  balanceAfter: number;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  notes: string;
  totalCredit: number;
  totalPaid: number;
  remainingBalance: number;
  transactions: CustomerTransaction[];
  createdAt: string;
}

export interface SaleRecord {
  id: string;
  receiptNumber: string;
  productId: string | null;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  amountPaid: number;
  creditAmount: number;
  customerId: string | null;
  customerName: string | null;
  createdAt: string;
}

export interface ExpenseRecord {
  id: string;
  description: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  createdAt: string;
}

export interface DashboardSummary {
  shopId: string;
  todaySales: number;
  todayCashReceived: number;
  todayCreditSales: number;
  totalOutstandingCredit: number;
  totalExpenses: number;
  lowStockCount: number;
  lowStockProducts: Product[];
  expiringProducts: Product[];
  recentTransactions: SaleRecord[];
  profile: ShopProfile;
}

export interface BestSellingProduct {
  productName: string;
  unitsSold: number;
  revenue: number;
}

export interface ReportsSummary {
  totalRevenue: number;
  dailySales: number;
  weeklySales: number;
  monthlySales: number;
  cashReceived: number;
  creditSales: number;
  totalExpenses: number;
  grossProfit: number;
  netProfit: number;
  hasMissingPurchaseCosts: boolean;
  bestSellingProducts: BestSellingProduct[];
}

export interface AiBusinessInsights {
  headline: string;
  highlights: string[];
  actionableTips: string[];
  stockAdvice: string;
  generatedAt: string;
}

export interface PendingConfirmation {
  pendingActionId: string;
  actionType: WriteActionType;
  title: string;
  customerName: string | null;
  productId?: string | null;
  productName: string | null;
  quantity: number | null;
  unitPrice?: number | null;
  amount: number;
  category?: ExpenseCategory | null;
  description: string;
  date: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
}
