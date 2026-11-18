import type {
  AiBusinessInsights,
  Customer,
  DashboardSummary,
  ExpenseCategory,
  ExpenseRecord,
  FirebaseTestResult,
  HealthStatus,
  PaymentMethod,
  PendingConfirmation,
  Product,
  ReportsSummary,
  SaleRecord,
  ShopProfile,
} from '../types/shop';

const DEFAULT_SHOP_ID = 'default_shop';

export class ApiError extends Error {
  status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function requestJson<T>(url: string, options?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    });
  } catch {
    throw new ApiError(
      'Unable to reach backend server. Please verify the Express server is running on port 3000.',
      0,
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // Non-JSON response
  }

  if (!response.ok) {
    const message =
      body &&
      typeof body === 'object' &&
      'error' in body &&
      typeof (body as {error?: unknown}).error === 'string'
        ? (body as {error: string}).error
        : body &&
            typeof body === 'object' &&
            'message' in body &&
            typeof (body as {message?: unknown}).message === 'string'
          ? (body as {message: string}).message
          : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }

  return body as T;
}

export async function fetchHealthStatus(): Promise<HealthStatus> {
  return requestJson<HealthStatus>('/api/health');
}

export async function testFirebaseConnection(): Promise<FirebaseTestResult> {
  return requestJson<FirebaseTestResult>('/api/health/test-firebase', {
    method: 'POST',
  });
}

export async function fetchDashboard(shopId = DEFAULT_SHOP_ID): Promise<DashboardSummary> {
  return requestJson<DashboardSummary>(
    `/api/dashboard?shopId=${encodeURIComponent(shopId)}`,
  );
}

export async function fetchCustomers(shopId = DEFAULT_SHOP_ID): Promise<Customer[]> {
  const data = await requestJson<{customers: Customer[]}>(
    `/api/customers?shopId=${encodeURIComponent(shopId)}`,
  );
  return data.customers;
}

export async function createCustomer(
  payload: {name: string; phone: string; notes: string},
  shopId = DEFAULT_SHOP_ID,
): Promise<Customer> {
  const data = await requestJson<{customer: Customer}>('/api/customers', {
    method: 'POST',
    body: JSON.stringify({...payload, shopId}),
  });
  return data.customer;
}

export async function recordCustomerPayment(
  payload: {customerId: string; amount: number; description: string},
  shopId = DEFAULT_SHOP_ID,
): Promise<Customer> {
  const data = await requestJson<{customer: Customer}>('/api/payments', {
    method: 'POST',
    body: JSON.stringify({...payload, shopId}),
  });
  return data.customer;
}

export async function fetchProducts(shopId = DEFAULT_SHOP_ID): Promise<Product[]> {
  const data = await requestJson<{products: Product[]}>(
    `/api/products?shopId=${encodeURIComponent(shopId)}`,
  );
  return data.products;
}

export async function createProduct(
  payload: {
    name: string;
    category: string;
    stockQuantity: number;
    purchasePrice: number | null;
    sellingPrice: number;
    lowStockThreshold: number;
    expiryDate: string | null;
  },
  shopId = DEFAULT_SHOP_ID,
): Promise<Product> {
  const data = await requestJson<{product: Product}>('/api/products', {
    method: 'POST',
    body: JSON.stringify({...payload, shopId}),
  });
  return data.product;
}

export async function updateProduct(
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
  shopId = DEFAULT_SHOP_ID,
): Promise<Product> {
  const data = await requestJson<{product: Product}>(
    `/api/products/${encodeURIComponent(productId)}`,
    {
      method: 'PUT',
      body: JSON.stringify({...payload, shopId}),
    },
  );
  return data.product;
}

export async function addProductStock(
  productId: string,
  addQuantity: number,
  shopId = DEFAULT_SHOP_ID,
): Promise<Product> {
  const data = await requestJson<{product: Product}>(
    `/api/products/${encodeURIComponent(productId)}/stock`,
    {
      method: 'PATCH',
      body: JSON.stringify({addQuantity, shopId}),
    },
  );
  return data.product;
}

export async function fetchSales(shopId = DEFAULT_SHOP_ID): Promise<SaleRecord[]> {
  const data = await requestJson<{sales: SaleRecord[]}>(
    `/api/sales?shopId=${encodeURIComponent(shopId)}`,
  );
  return data.sales;
}

export async function createSale(
  payload: {
    productId: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    paymentMethod: PaymentMethod;
    customerId: string | null;
    amountPaid: number;
  },
  shopId = DEFAULT_SHOP_ID,
): Promise<SaleRecord> {
  const data = await requestJson<{sale: SaleRecord}>('/api/sales', {
    method: 'POST',
    body: JSON.stringify({...payload, shopId}),
  });
  return data.sale;
}

export async function fetchExpenses(shopId = DEFAULT_SHOP_ID): Promise<ExpenseRecord[]> {
  const data = await requestJson<{expenses: ExpenseRecord[]}>(
    `/api/expenses?shopId=${encodeURIComponent(shopId)}`,
  );
  return data.expenses;
}

export async function createExpense(
  payload: {
    description: string;
    category: ExpenseCategory;
    amount: number;
    date: string;
  },
  shopId = DEFAULT_SHOP_ID,
): Promise<ExpenseRecord> {
  const data = await requestJson<{expense: ExpenseRecord}>('/api/expenses', {
    method: 'POST',
    body: JSON.stringify({...payload, shopId}),
  });
  return data.expense;
}

export async function fetchReports(shopId = DEFAULT_SHOP_ID): Promise<ReportsSummary> {
  const data = await requestJson<{reports: ReportsSummary}>(
    `/api/reports?shopId=${encodeURIComponent(shopId)}`,
  );
  return data.reports;
}

export async function fetchSettings(shopId = DEFAULT_SHOP_ID): Promise<ShopProfile> {
  const data = await requestJson<{profile: ShopProfile}>(
    `/api/settings?shopId=${encodeURIComponent(shopId)}`,
  );
  return data.profile;
}

export async function updateSettings(
  profile: ShopProfile,
  shopId = DEFAULT_SHOP_ID,
): Promise<ShopProfile> {
  const data = await requestJson<{profile: ShopProfile}>('/api/settings', {
    method: 'PUT',
    body: JSON.stringify({...profile, shopId}),
  });
  return data.profile;
}

export async function sendAiCommand(
  command: string,
  shopId = DEFAULT_SHOP_ID,
): Promise<{
  reply: string;
  intent?: string;
  aiConnected: boolean;
  geminiConfigured: boolean;
  pendingConfirmation: PendingConfirmation | null;
}> {
  return requestJson('/api/ai/command', {
    method: 'POST',
    body: JSON.stringify({command, shopId}),
  });
}

export async function confirmAiAction(
  pendingActionId: string,
  shopId = DEFAULT_SHOP_ID,
): Promise<{
  recorded: boolean;
  actionType: string;
  summaryText: string;
}> {
  return requestJson('/api/ai/confirm', {
    method: 'POST',
    body: JSON.stringify({pendingActionId, shopId}),
  });
}

export async function cancelAiAction(
  pendingActionId: string,
  shopId = DEFAULT_SHOP_ID,
): Promise<void> {
  await requestJson('/api/ai/cancel', {
    method: 'POST',
    body: JSON.stringify({pendingActionId, shopId}),
  });
}

export async function fetchBusinessInsights(
  shopId = DEFAULT_SHOP_ID,
): Promise<AiBusinessInsights> {
  const data = await requestJson<{insights: AiBusinessInsights}>('/api/ai/insights', {
    method: 'POST',
    body: JSON.stringify({shopId}),
  });
  return data.insights;
}

export async function transcribeAiVoice(
  audioBase64: string,
  mimeType: string,
): Promise<string> {
  const data = await requestJson<{transcript: string}>('/api/ai/transcribe', {
    method: 'POST',
    body: JSON.stringify({audioBase64, mimeType}),
  });
  return data.transcript ?? '';
}
