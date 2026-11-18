import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import type {
  Customer,
  CustomerTransaction,
  DashboardSummary,
  ExpenseCategory,
  ExpenseRecord,
  FirebaseTestResult,
  PaymentMethod,
  PendingConfirmation,
  Product,
  ReportsSummary,
  SaleRecord,
  ShopProfile,
} from '../../src/types/shop.ts';
import {db, FIREBASE_PROJECT_ID} from './firebaseClient.ts';

const DEFAULT_SHOP_ID = 'default_shop';

const COLLECTIONS = {
  shops: 'shops',
  products: 'products',
  customers: 'customers',
  transactions: 'transactions',
  payments: 'payments',
  expenses: 'expenses',
  stockMovements: 'stock_movements',
  pendingActions: 'pending_actions',
} as const;

export function makeId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function defaultProfile(): ShopProfile {
  return {
    shopName: 'Dukaan Dost — Apni Dukaan',
    ownerName: '',
    phone: '',
    cityAddress: '',
    currency: 'PKR',
  };
}

function isSameDay(isoOrDate: string, targetDate: Date): boolean {
  const parsed = new Date(isoOrDate);
  if (Number.isNaN(parsed.getTime())) return false;
  return (
    parsed.getFullYear() === targetDate.getFullYear() &&
    parsed.getMonth() === targetDate.getMonth() &&
    parsed.getDate() === targetDate.getDate()
  );
}

function isSameMonth(isoOrDate: string, targetDate: Date): boolean {
  const parsed = new Date(isoOrDate);
  if (Number.isNaN(parsed.getTime())) return false;
  return (
    parsed.getFullYear() === targetDate.getFullYear() &&
    parsed.getMonth() === targetDate.getMonth()
  );
}

function isWithinLastDays(isoOrDate: string, days: number, now: Date): boolean {
  const parsed = new Date(isoOrDate);
  if (Number.isNaN(parsed.getTime())) return false;
  const diffMs = now.getTime() - parsed.getTime();
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000;
}

function normalizeExpiryDate(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = new Date(year, month, day);
  if (
    Number.isNaN(d.getTime()) ||
    d.getFullYear() !== year ||
    d.getMonth() !== month ||
    d.getDate() !== day
  ) {
    return null;
  }
  return trimmed;
}

function getDaysUntilExpiryServer(expiryDate?: string | null): number | null {
  const normalized = normalizeExpiryDate(expiryDate);
  if (!normalized) return null;
  const [y, m, d] = normalized.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function sortByDateDesc<T extends {createdAt?: string; updatedAt?: string}>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    const da = new Date(a.createdAt || a.updatedAt || 0).getTime();
    const dbTime = new Date(b.createdAt || b.updatedAt || 0).getTime();
    return dbTime - da;
  });
}

export async function testFirebaseConnection(): Promise<FirebaseTestResult> {
  const start = Date.now();
  const ref = doc(db, COLLECTIONS.shops, '_connection_test');
  const testedAt = new Date().toISOString();

  await setDoc(ref, {
    type: 'health_check',
    testedAt,
    projectId: FIREBASE_PROJECT_ID,
  });

  const snap = await getDoc(ref);
  if (!snap.exists()) {
    throw new Error('Firestore write succeeded but read-back document was missing.');
  }

  return {
    ok: true,
    message: 'Live Firestore read & write verified successfully.',
    projectId: FIREBASE_PROJECT_ID,
    latencyMs: Date.now() - start,
    testedAt,
  };
}

export async function getShopProfile(shopId = DEFAULT_SHOP_ID): Promise<ShopProfile> {
  const snap = await getDoc(doc(db, COLLECTIONS.shops, shopId));
  if (!snap.exists()) {
    return defaultProfile();
  }
  const data = snap.data() as Partial<ShopProfile>;
  return {
    shopName: data.shopName || 'Dukaan Dost — Apni Dukaan',
    ownerName: data.ownerName || '',
    phone: data.phone || '',
    cityAddress: data.cityAddress || '',
    currency: 'PKR',
  };
}

export async function updateShopProfile(
  shopId: string,
  input: Partial<ShopProfile>,
): Promise<ShopProfile> {
  const nextProfile: ShopProfile = {
    shopName: (input.shopName ?? '').trim() || 'Dukaan Dost — Apni Dukaan',
    ownerName: (input.ownerName ?? '').trim(),
    phone: (input.phone ?? '').trim(),
    cityAddress: (input.cityAddress ?? '').trim(),
    currency: 'PKR',
  };

  await setDoc(
    doc(db, COLLECTIONS.shops, shopId),
    {
      ...nextProfile,
      shopId,
      updatedAt: new Date().toISOString(),
    },
    {merge: true},
  );

  return nextProfile;
}

export async function getSales(shopId = DEFAULT_SHOP_ID): Promise<SaleRecord[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.transactions), where('shopId', '==', shopId)),
  );
  const items = snap.docs.map((d) => d.data() as SaleRecord);
  return sortByDateDesc(items);
}

export async function getExpenses(shopId = DEFAULT_SHOP_ID): Promise<ExpenseRecord[]> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.expenses), where('shopId', '==', shopId)),
  );
  const items = snap.docs.map((d) => d.data() as ExpenseRecord);
  return sortByDateDesc(items);
}

export async function getProducts(shopId = DEFAULT_SHOP_ID): Promise<Product[]> {
  const [prodSnap, txSnap] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.products), where('shopId', '==', shopId))),
    getDocs(query(collection(db, COLLECTIONS.transactions), where('shopId', '==', shopId))),
  ]);

  const now = new Date();
  const salesLast7Days = txSnap.docs
    .map((d) => d.data() as SaleRecord)
    .filter((s) => isWithinLastDays(s.createdAt, 7, now));

  const velocityMap = new Map<string, number>();
  for (const sale of salesLast7Days) {
    if (!sale.productId) continue;
    velocityMap.set(sale.productId, (velocityMap.get(sale.productId) ?? 0) + sale.quantity);
  }

  const products = prodSnap.docs.map((d) => {
    const p = d.data() as Product;
    const units7d = velocityMap.get(p.id) ?? 0;
    const dailyVelocity = Number((units7d / 7).toFixed(2));
    const estimatedDaysRemaining =
      dailyVelocity > 0 ? Math.max(0, Math.floor(p.stockQuantity / dailyVelocity)) : null;

    return {
      ...p,
      expiryDate: normalizeExpiryDate(p.expiryDate),
      dailySalesVelocity: dailyVelocity,
      estimatedDaysRemaining,
    };
  });

  return sortByDateDesc(products);
}

export async function getCustomers(shopId = DEFAULT_SHOP_ID): Promise<Customer[]> {
  const [custSnap, txSnap, paySnap] = await Promise.all([
    getDocs(query(collection(db, COLLECTIONS.customers), where('shopId', '==', shopId))),
    getDocs(query(collection(db, COLLECTIONS.transactions), where('shopId', '==', shopId))),
    getDocs(query(collection(db, COLLECTIONS.payments), where('shopId', '==', shopId))),
  ]);

  const creditTxDocs = txSnap.docs
    .map((d) => d.data() as SaleRecord & {balanceAfter?: number})
    .filter((t) => t.customerId && t.creditAmount > 0);

  const paymentDocs = paySnap.docs.map(
    (d) =>
      d.data() as {
        id: string;
        customerId: string;
        amount: number;
        description: string;
        balanceAfter: number;
        createdAt: string;
      },
  );

  const customers = custSnap.docs.map((d) => {
    const cust = d.data() as Customer;
    const ledgerEntries: CustomerTransaction[] = [];

    for (const tx of creditTxDocs) {
      if (tx.customerId === cust.id) {
        ledgerEntries.push({
          id: tx.id,
          type: 'credit',
          amount: tx.creditAmount,
          description: `Sale ${tx.receiptNumber}: ${tx.productName} × ${tx.quantity}`,
          date: tx.createdAt,
          balanceAfter: tx.balanceAfter ?? cust.remainingBalance,
        });
      }
    }

    for (const pay of paymentDocs) {
      if (pay.customerId === cust.id) {
        ledgerEntries.push({
          id: pay.id,
          type: 'repayment',
          amount: pay.amount,
          description: pay.description,
          date: pay.createdAt,
          balanceAfter: pay.balanceAfter,
        });
      }
    }

    ledgerEntries.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    return {
      ...cust,
      transactions: ledgerEntries,
    };
  });

  return sortByDateDesc(customers);
}

export async function getPayments(shopId = DEFAULT_SHOP_ID): Promise<
  Array<{
    id: string;
    customerId: string;
    customerName: string;
    amount: number;
    description: string;
    balanceAfter: number;
    createdAt: string;
  }>
> {
  const snap = await getDocs(
    query(collection(db, COLLECTIONS.payments), where('shopId', '==', shopId)),
  );
  const items = snap.docs.map(
    (d) =>
      d.data() as {
        id: string;
        customerId: string;
        customerName: string;
        amount: number;
        description: string;
        balanceAfter: number;
        createdAt: string;
      },
  );
  return sortByDateDesc(items);
}

export async function getDashboardSummary(shopId = DEFAULT_SHOP_ID): Promise<DashboardSummary> {
  const [profile, products, customers, sales, expenses, payments] = await Promise.all([
    getShopProfile(shopId),
    getProducts(shopId),
    getCustomers(shopId),
    getSales(shopId),
    getExpenses(shopId),
    getPayments(shopId),
  ]);

  const now = new Date();
  const todaySalesList = sales.filter((s) => isSameDay(s.createdAt, now));
  const todayPaymentsList = payments.filter((p) => isSameDay(p.createdAt, now));

  const todaySales = todaySalesList.reduce((sum, s) => sum + s.totalAmount, 0);
  const todayRepaymentsTotal = todayPaymentsList.reduce((sum, p) => sum + p.amount, 0);
  const todayCashReceived =
    todaySalesList.reduce((sum, s) => sum + s.amountPaid, 0) + todayRepaymentsTotal;

  // Net today's credit sales after accounting for udhaar repayments made today
  const todayCreditByCustomer = new Map<string, number>();
  let unassignedTodayCredit = 0;
  for (const sale of todaySalesList) {
    if (sale.creditAmount <= 0) continue;
    if (sale.customerId) {
      todayCreditByCustomer.set(
        sale.customerId,
        (todayCreditByCustomer.get(sale.customerId) ?? 0) + sale.creditAmount,
      );
    } else {
      unassignedTodayCredit += sale.creditAmount;
    }
  }

  const todayRepaidByCustomer = new Map<string, number>();
  for (const pay of todayPaymentsList) {
    if (!pay.customerId || pay.amount <= 0) continue;
    todayRepaidByCustomer.set(
      pay.customerId,
      (todayRepaidByCustomer.get(pay.customerId) ?? 0) + pay.amount,
    );
  }

  let todayCreditSales = unassignedTodayCredit;
  for (const [custId, rawTodayCredit] of todayCreditByCustomer.entries()) {
    const repaidToday = todayRepaidByCustomer.get(custId) ?? 0;
    const customer = customers.find((c) => c.id === custId);
    const netAfterTodayPayment = Math.max(0, rawTodayCredit - repaidToday);
    const cappedByBalance = customer
      ? Math.min(netAfterTodayPayment, Math.max(0, customer.remainingBalance))
      : netAfterTodayPayment;
    todayCreditSales += cappedByBalance;
  }

  const totalOutstandingCredit = customers.reduce(
    (sum, c) => sum + Math.max(0, c.remainingBalance),
    0,
  );
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const lowStockProducts = products.filter(
    (item) => item.stockQuantity <= item.lowStockThreshold,
  );
  const expiringProducts = products
    .filter((item) => {
      const days = getDaysUntilExpiryServer(item.expiryDate);
      return days !== null && days <= 14;
    })
    .sort((a, b) => {
      const da = getDaysUntilExpiryServer(a.expiryDate) ?? 9999;
      const dbDays = getDaysUntilExpiryServer(b.expiryDate) ?? 9999;
      return da - dbDays;
    });

  return {
    shopId,
    todaySales,
    todayCashReceived,
    todayCreditSales,
    totalOutstandingCredit,
    totalExpenses,
    lowStockCount: lowStockProducts.length,
    lowStockProducts,
    expiringProducts,
    recentTransactions: sales.slice(0, 5),
    profile,
  };
}

export async function getReportsSummary(shopId = DEFAULT_SHOP_ID): Promise<ReportsSummary> {
  const [products, customers, sales, expenses, payments] = await Promise.all([
    getProducts(shopId),
    getCustomers(shopId),
    getSales(shopId),
    getExpenses(shopId),
    getPayments(shopId),
  ]);

  const now = new Date();
  const dailySales = sales
    .filter((s) => isSameDay(s.createdAt, now))
    .reduce((sum, s) => sum + s.totalAmount, 0);
  const weeklySales = sales
    .filter((s) => isWithinLastDays(s.createdAt, 7, now))
    .reduce((sum, s) => sum + s.totalAmount, 0);
  const monthlySales = sales
    .filter((s) => isSameMonth(s.createdAt, now))
    .reduce((sum, s) => sum + s.totalAmount, 0);

  const totalRepayments = payments.reduce((sum, p) => sum + p.amount, 0);
  const cashReceived = sales.reduce((sum, s) => sum + s.amountPaid, 0) + totalRepayments;
  const creditSales = customers.reduce((sum, c) => sum + Math.max(0, c.remainingBalance), 0);
  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);

  let totalCostOfGoods = 0;
  let hasMissingPurchaseCosts = false;

  for (const sale of sales) {
    if (!sale.productId) {
      hasMissingPurchaseCosts = true;
      continue;
    }
    const product = products.find((p) => p.id === sale.productId);
    if (!product || product.purchasePrice === null || product.purchasePrice <= 0) {
      hasMissingPurchaseCosts = true;
    } else {
      totalCostOfGoods += product.purchasePrice * sale.quantity;
    }
  }

  const totalRevenue = sales.reduce((sum, s) => sum + s.totalAmount, 0);
  const grossProfit = totalRevenue - totalCostOfGoods;
  const netProfit = grossProfit - totalExpenses;

  const productMap = new Map<string, {unitsSold: number; revenue: number}>();
  for (const sale of sales) {
    const existing = productMap.get(sale.productName) ?? {unitsSold: 0, revenue: 0};
    existing.unitsSold += sale.quantity;
    existing.revenue += sale.totalAmount;
    productMap.set(sale.productName, existing);
  }

  const bestSellingProducts = Array.from(productMap.entries())
    .map(([productName, stats]) => ({
      productName,
      unitsSold: stats.unitsSold,
      revenue: stats.revenue,
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);

  return {
    totalRevenue,
    dailySales,
    weeklySales,
    monthlySales,
    cashReceived,
    creditSales,
    totalExpenses,
    grossProfit,
    netProfit,
    hasMissingPurchaseCosts,
    bestSellingProducts,
  };
}

export async function addCustomer(
  shopId: string,
  input: {name: string; phone?: string; notes?: string},
): Promise<Customer> {
  const id = makeId('cust');
  const nowIso = new Date().toISOString();
  const customerDoc = {
    id,
    shopId,
    name: input.name.trim(),
    phone: (input.phone ?? '').trim(),
    notes: (input.notes ?? '').trim(),
    totalCredit: 0,
    totalPaid: 0,
    remainingBalance: 0,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await setDoc(doc(db, COLLECTIONS.customers, id), customerDoc);
  return {
    ...customerDoc,
    transactions: [],
  };
}

async function logStockMovement(params: {
  shopId: string;
  productId: string;
  productName: string;
  changeQuantity: number;
  previousStock: number;
  newStock: number;
  reason: 'initial' | 'restock' | 'sale' | 'edit';
  referenceId: string;
}) {
  const id = makeId('stk');
  await setDoc(doc(db, COLLECTIONS.stockMovements, id), {
    id,
    ...params,
    createdAt: new Date().toISOString(),
  });
}

export async function addProduct(
  shopId: string,
  input: {
    name: string;
    category?: string;
    stockQuantity?: number;
    purchasePrice?: number | null;
    sellingPrice?: number;
    lowStockThreshold?: number;
    expiryDate?: string | null;
  },
): Promise<Product> {
  const id = makeId('prod');
  const nowIso = new Date().toISOString();
  const qty = Math.max(0, Number(input.stockQuantity ?? 0) || 0);
  const sell = Math.max(0, Number(input.sellingPrice ?? 0) || 0);
  const purchase =
    input.purchasePrice === null ||
    input.purchasePrice === undefined ||
    Number.isNaN(Number(input.purchasePrice))
      ? null
      : Math.max(0, Number(input.purchasePrice));
  const threshold = Math.max(0, Number(input.lowStockThreshold ?? 5) || 0);
  const expiryDate = normalizeExpiryDate(input.expiryDate);

  const product: Product & {shopId: string; createdAt: string} = {
    id,
    shopId,
    name: input.name.trim(),
    category: (input.category ?? 'General Kiryana').trim() || 'General Kiryana',
    stockQuantity: qty,
    purchasePrice: purchase,
    sellingPrice: sell,
    lowStockThreshold: threshold,
    expiryDate,
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  await setDoc(doc(db, COLLECTIONS.products, id), product);

  if (qty > 0) {
    await logStockMovement({
      shopId,
      productId: id,
      productName: product.name,
      changeQuantity: qty,
      previousStock: 0,
      newStock: qty,
      reason: 'initial',
      referenceId: id,
    });
  }

  return {
    ...product,
    dailySalesVelocity: 0,
    estimatedDaysRemaining: null,
  };
}

export async function updateProduct(
  shopId: string,
  productId: string,
  input: {
    name: string;
    category?: string;
    stockQuantity?: number;
    purchasePrice?: number | null;
    sellingPrice?: number;
    lowStockThreshold?: number;
    expiryDate?: string | null;
  },
): Promise<Product | null> {
  const ref = doc(db, COLLECTIONS.products, productId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const existing = snap.data() as Product & {shopId: string};
  if (existing.shopId !== shopId) return null;

  const nextQty = Math.max(0, Number(input.stockQuantity ?? existing.stockQuantity) || 0);
  const nextSelling = Math.max(0, Number(input.sellingPrice ?? existing.sellingPrice) || 0);
  const nextPurchase =
    input.purchasePrice === null ||
    input.purchasePrice === undefined ||
    Number.isNaN(Number(input.purchasePrice))
      ? null
      : Math.max(0, Number(input.purchasePrice));
  const nextThreshold = Math.max(
    0,
    Number(input.lowStockThreshold ?? existing.lowStockThreshold) || 0,
  );
  const nextExpiry =
    input.expiryDate !== undefined
      ? normalizeExpiryDate(input.expiryDate)
      : normalizeExpiryDate(existing.expiryDate);

  const updatedFields = {
    name: input.name.trim() || existing.name,
    category: (input.category ?? existing.category).trim() || 'General Kiryana',
    stockQuantity: nextQty,
    purchasePrice: nextPurchase,
    sellingPrice: nextSelling,
    lowStockThreshold: nextThreshold,
    expiryDate: nextExpiry,
    updatedAt: new Date().toISOString(),
  };

  await updateDoc(ref, updatedFields);

  if (nextQty !== existing.stockQuantity) {
    await logStockMovement({
      shopId,
      productId,
      productName: updatedFields.name,
      changeQuantity: nextQty - existing.stockQuantity,
      previousStock: existing.stockQuantity,
      newStock: nextQty,
      reason: 'edit',
      referenceId: productId,
    });
  }

  return {
    ...existing,
    ...updatedFields,
  };
}

export async function incrementProductStock(
  shopId: string,
  productId: string,
  addQuantity: number,
): Promise<Product | null> {
  const ref = doc(db, COLLECTIONS.products, productId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;

  const existing = snap.data() as Product & {shopId: string};
  if (existing.shopId !== shopId) return null;

  const previousStock = existing.stockQuantity;
  const newStock = previousStock + addQuantity;
  const updatedAt = new Date().toISOString();

  await updateDoc(ref, {
    stockQuantity: newStock,
    updatedAt,
  });

  await logStockMovement({
    shopId,
    productId,
    productName: existing.name,
    changeQuantity: addQuantity,
    previousStock,
    newStock,
    reason: 'restock',
    referenceId: productId,
  });

  return {
    ...existing,
    stockQuantity: newStock,
    updatedAt,
  };
}

export async function recordSale(
  shopId: string,
  input: {
    productId?: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    paymentMethod?: PaymentMethod;
    customerId?: string | null;
    amountPaid?: number;
  },
): Promise<{sale?: SaleRecord; error?: string; status?: number}> {
  const qty = Number(input.quantity);
  const price = Number(input.unitPrice);
  const totalAmount = qty * price;
  const method: PaymentMethod = input.paymentMethod || 'cash';

  let paid = totalAmount;
  if (method === 'credit') {
    paid = 0;
  } else if (method === 'partial') {
    const requestedPaid = Number(input.amountPaid ?? 0);
    paid = Math.min(Math.max(0, Number.isFinite(requestedPaid) ? requestedPaid : 0), totalAmount);
  }
  const creditAmount = Math.max(0, totalAmount - paid);

  if (creditAmount > 0 && !input.customerId) {
    return {
      error: 'Please select a customer for Credit or Partial payment.',
      status: 400,
    };
  }

  // Validate product stock before recording sale (prevents negative stock)
  let productData: (Product & {shopId: string}) | null = null;
  if (input.productId) {
    const prodSnap = await getDoc(doc(db, COLLECTIONS.products, input.productId));
    if (!prodSnap.exists()) {
      return {error: 'Selected product not found.', status: 404};
    }
    productData = prodSnap.data() as Product & {shopId: string};
    if (productData.stockQuantity < qty) {
      return {
        error: `Insufficient stock: only ${productData.stockQuantity} units of "${productData.name}" remaining.`,
        status: 400,
      };
    }
  }

  let customerData: (Customer & {shopId: string}) | null = null;
  if (creditAmount > 0 && input.customerId) {
    const custSnap = await getDoc(doc(db, COLLECTIONS.customers, input.customerId));
    if (!custSnap.exists()) {
      return {error: 'Selected customer was not found.', status: 404};
    }
    customerData = custSnap.data() as Customer & {shopId: string};
  }

  const existingSales = await getSales(shopId);
  const saleId = makeId('sale');
  const nowIso = new Date().toISOString();
  const nextCustomerBalance = customerData
    ? customerData.remainingBalance + creditAmount
    : 0;

  const saleRecord: SaleRecord & {shopId: string; balanceAfter?: number} = {
    id: saleId,
    shopId,
    receiptNumber: `DD-${String(existingSales.length + 1).padStart(4, '0')}`,
    productId: input.productId ?? null,
    productName: input.productName.trim(),
    quantity: qty,
    unitPrice: price,
    totalAmount,
    paymentMethod: method,
    amountPaid: paid,
    creditAmount,
    customerId: customerData ? customerData.id : null,
    customerName: customerData ? customerData.name : null,
    ...(customerData ? {balanceAfter: nextCustomerBalance} : {}),
    createdAt: nowIso,
  };

  await setDoc(doc(db, COLLECTIONS.transactions, saleId), saleRecord);

  if (productData && input.productId) {
    const previousStock = productData.stockQuantity;
    const newStock = Math.max(0, previousStock - qty);
    await updateDoc(doc(db, COLLECTIONS.products, input.productId), {
      stockQuantity: newStock,
      updatedAt: nowIso,
    });
    await logStockMovement({
      shopId,
      productId: input.productId,
      productName: productData.name,
      changeQuantity: -qty,
      previousStock,
      newStock,
      reason: 'sale',
      referenceId: saleId,
    });
  }

  if (customerData && creditAmount > 0) {
    await updateDoc(doc(db, COLLECTIONS.customers, customerData.id), {
      totalCredit: customerData.totalCredit + creditAmount,
      remainingBalance: nextCustomerBalance,
      updatedAt: nowIso,
    });
  }

  return {sale: saleRecord};
}

export async function recordPayment(
  shopId: string,
  input: {customerId: string; amount: number; description?: string},
): Promise<{customer?: Customer; error?: string; status?: number}> {
  const numericAmount = Number(input.amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
    return {error: 'Repayment amount must be greater than Rs. 0.', status: 400};
  }

  const custRef = doc(db, COLLECTIONS.customers, input.customerId);
  const custSnap = await getDoc(custRef);
  if (!custSnap.exists()) {
    return {error: 'Customer not found.', status: 404};
  }

  const existing = custSnap.data() as Customer & {shopId: string};
  if (existing.shopId !== shopId) {
    return {error: 'Customer not found.', status: 404};
  }

  const nowIso = new Date().toISOString();
  const nextBalance = Math.max(0, existing.remainingBalance - numericAmount);
  const nextPaid = existing.totalPaid + numericAmount;

  const paymentId = makeId('pay');
  await setDoc(doc(db, COLLECTIONS.payments, paymentId), {
    id: paymentId,
    shopId,
    customerId: existing.id,
    customerName: existing.name,
    amount: numericAmount,
    description: (input.description ?? '').trim() || 'Cash repayment (Wasooli)',
    balanceAfter: nextBalance,
    createdAt: nowIso,
  });

  await updateDoc(custRef, {
    totalPaid: nextPaid,
    remainingBalance: nextBalance,
    updatedAt: nowIso,
  });

  const allCustomers = await getCustomers(shopId);
  const updated = allCustomers.find((c) => c.id === existing.id);
  return {customer: updated};
}

export async function recordExpense(
  shopId: string,
  input: {description: string; category?: ExpenseCategory; amount: number; date?: string},
): Promise<ExpenseRecord> {
  const id = makeId('exp');
  const expense: ExpenseRecord & {shopId: string} = {
    id,
    shopId,
    description: input.description.trim(),
    category: input.category || 'Other',
    amount: Number(input.amount),
    date: input.date || new Date().toISOString().slice(0, 10),
    createdAt: new Date().toISOString(),
  };

  await setDoc(doc(db, COLLECTIONS.expenses, id), expense);
  return expense;
}

export async function savePendingAction(
  shopId: string,
  action: PendingConfirmation,
): Promise<void> {
  await setDoc(doc(db, COLLECTIONS.pendingActions, action.pendingActionId), {
    ...action,
    shopId,
    status: 'pending',
    createdAt: new Date().toISOString(),
  });
}

export async function cancelPendingAction(
  shopId: string,
  pendingActionId: string,
): Promise<void> {
  const ref = doc(db, COLLECTIONS.pendingActions, pendingActionId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data() as {shopId?: string; status?: string};
  if (data.shopId === shopId && data.status === 'pending') {
    await updateDoc(ref, {
      status: 'cancelled',
      updatedAt: new Date().toISOString(),
    });
  }
}

export async function claimPendingActionAtomic(
  shopId: string,
  pendingActionId: string,
): Promise<{action?: PendingConfirmation; error?: string; status?: number}> {
  const ref = doc(db, COLLECTIONS.pendingActions, pendingActionId);

  try {
    const claimed = await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref);
      if (!snap.exists()) {
        throw new Error('NOT_FOUND');
      }
      const data = snap.data() as PendingConfirmation & {shopId: string; status: string};
      if (data.shopId !== shopId) {
        throw new Error('NOT_FOUND');
      }
      if (data.status !== 'pending') {
        throw new Error('ALREADY_PROCESSED');
      }
      tx.update(ref, {
        status: 'confirmed',
        confirmedAt: new Date().toISOString(),
      });
      return data;
    });

    return {action: claimed};
  } catch (err) {
    if (err instanceof Error && err.message === 'ALREADY_PROCESSED') {
      return {
        error: 'This confirmation has already been processed.',
        status: 409,
      };
    }
    return {
      error: 'Pending confirmation not found or expired.',
      status: 404,
    };
  }
}
