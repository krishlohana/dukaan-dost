import {Router} from 'express';
import type {ExpenseCategory, PaymentMethod, ShopProfile} from '../../src/types/shop.ts';
import {
  addCustomer,
  addProduct,
  getCustomers,
  getDashboardSummary,
  getExpenses,
  getProducts,
  getReportsSummary,
  getSales,
  getShopProfile,
  incrementProductStock,
  recordExpense,
  recordPayment,
  recordSale,
  updateProduct,
  updateShopProfile,
} from '../services/firestoreService.ts';

export const shopRouter = Router();

function resolveShopId(reqQueryOrBody: unknown): string {
  if (reqQueryOrBody && typeof reqQueryOrBody === 'object' && 'shopId' in reqQueryOrBody) {
    const val = (reqQueryOrBody as {shopId?: unknown}).shopId;
    if (typeof val === 'string' && val.trim()) {
      return val.trim();
    }
  }
  return 'default_shop';
}

// Dashboard
shopRouter.get('/dashboard', async (req, res) => {
  try {
    const shopId = resolveShopId(req.query);
    const summary = await getDashboardSummary(shopId);
    res.json(summary);
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to load dashboard from Firestore.',
    });
  }
});

// Customers / Khata
shopRouter.get('/customers', async (req, res) => {
  try {
    const shopId = resolveShopId(req.query);
    const customers = await getCustomers(shopId);
    res.json({shopId, customers});
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to load customers.',
    });
  }
});

shopRouter.post('/customers', async (req, res) => {
  try {
    const shopId = resolveShopId(req.body);
    const {name, phone, notes} = req.body as {
      name?: string;
      phone?: string;
      notes?: string;
    };
    if (!name || !name.trim()) {
      res.status(400).json({error: 'Customer name is required.'});
      return;
    }
    const customer = await addCustomer(shopId, {name, phone, notes});
    res.status(201).json({customer});
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to save customer.',
    });
  }
});

// Products / Inventory
shopRouter.get('/products', async (req, res) => {
  try {
    const shopId = resolveShopId(req.query);
    const products = await getProducts(shopId);
    res.json({shopId, products});
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to load products.',
    });
  }
});

shopRouter.post('/products', async (req, res) => {
  try {
    const shopId = resolveShopId(req.body);
    const {
      name,
      category,
      stockQuantity,
      purchasePrice,
      sellingPrice,
      lowStockThreshold,
      expiryDate,
    } = req.body as {
      name?: string;
      category?: string;
      stockQuantity?: number;
      purchasePrice?: number | null;
      sellingPrice?: number;
      lowStockThreshold?: number;
      expiryDate?: string | null;
    };

    if (!name || !name.trim()) {
      res.status(400).json({error: 'Product name is required.'});
      return;
    }

    const product = await addProduct(shopId, {
      name,
      category,
      stockQuantity,
      purchasePrice,
      sellingPrice,
      lowStockThreshold,
      expiryDate,
    });
    res.status(201).json({product});
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to add product.',
    });
  }
});

shopRouter.put('/products/:id', async (req, res) => {
  try {
    const shopId = resolveShopId(req.body);
    const {
      name,
      category,
      stockQuantity,
      purchasePrice,
      sellingPrice,
      lowStockThreshold,
      expiryDate,
    } = req.body as {
      name?: string;
      category?: string;
      stockQuantity?: number;
      purchasePrice?: number | null;
      sellingPrice?: number;
      lowStockThreshold?: number;
      expiryDate?: string | null;
    };

    if (!name || !name.trim()) {
      res.status(400).json({error: 'Product name is required.'});
      return;
    }

    const updated = await updateProduct(shopId, req.params.id, {
      name,
      category,
      stockQuantity,
      purchasePrice,
      sellingPrice,
      lowStockThreshold,
      expiryDate,
    });

    if (!updated) {
      res.status(404).json({error: 'Product not found.'});
      return;
    }
    res.json({product: updated});
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to update product.',
    });
  }
});

shopRouter.patch('/products/:id/stock', async (req, res) => {
  try {
    const shopId = resolveShopId(req.body);
    const {addQuantity} = req.body as {addQuantity?: number};
    const delta = Number(addQuantity);
    if (!Number.isFinite(delta) || delta <= 0) {
      res.status(400).json({error: 'Quantity to add must be greater than 0.'});
      return;
    }
    const product = await incrementProductStock(shopId, req.params.id, delta);
    if (!product) {
      res.status(404).json({error: 'Product not found.'});
      return;
    }
    res.json({product});
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to update stock.',
    });
  }
});

// Sales
shopRouter.get('/sales', async (req, res) => {
  try {
    const shopId = resolveShopId(req.query);
    const sales = await getSales(shopId);
    res.json({shopId, sales});
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to load sales.',
    });
  }
});

shopRouter.post('/sales', async (req, res) => {
  try {
    const shopId = resolveShopId(req.body);
    const {
      productId,
      productName,
      quantity,
      unitPrice,
      paymentMethod,
      customerId,
      amountPaid,
    } = req.body as {
      productId?: string | null;
      productName?: string;
      quantity?: number;
      unitPrice?: number;
      paymentMethod?: PaymentMethod;
      customerId?: string | null;
      amountPaid?: number;
    };

    const qty = Number(quantity);
    const price = Number(unitPrice);
    if (!productName || !Number.isFinite(qty) || qty <= 0 || !Number.isFinite(price) || price < 0) {
      res.status(400).json({error: 'Valid product name, quantity, and unit price are required.'});
      return;
    }

    const result = await recordSale(shopId, {
      productId,
      productName,
      quantity: qty,
      unitPrice: price,
      paymentMethod,
      customerId,
      amountPaid,
    });

    if (result.error) {
      res.status(result.status ?? 400).json({error: result.error});
      return;
    }

    res.status(201).json({sale: result.sale});
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to record sale.',
    });
  }
});

// Customer Payments / Repayments
shopRouter.post('/payments', async (req, res) => {
  try {
    const shopId = resolveShopId(req.body);
    const {customerId, amount, description} = req.body as {
      customerId?: string;
      amount?: number;
      description?: string;
    };

    if (!customerId) {
      res.status(400).json({error: 'customerId is required.'});
      return;
    }

    const result = await recordPayment(shopId, {
      customerId,
      amount: Number(amount),
      description,
    });

    if (result.error) {
      res.status(result.status ?? 400).json({error: result.error});
      return;
    }

    res.json({customer: result.customer});
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to record repayment.',
    });
  }
});

// Expenses
shopRouter.get('/expenses', async (req, res) => {
  try {
    const shopId = resolveShopId(req.query);
    const expenses = await getExpenses(shopId);
    res.json({shopId, expenses});
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to load expenses.',
    });
  }
});

shopRouter.post('/expenses', async (req, res) => {
  try {
    const shopId = resolveShopId(req.body);
    const {description, category, amount, date} = req.body as {
      description?: string;
      category?: ExpenseCategory;
      amount?: number;
      date?: string;
    };

    const numericAmount = Number(amount);
    if (!description || !description.trim() || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      res.status(400).json({error: 'Expense description and valid amount are required.'});
      return;
    }

    const expense = await recordExpense(shopId, {
      description,
      category,
      amount: numericAmount,
      date,
    });
    res.status(201).json({expense});
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to record expense.',
    });
  }
});

// Reports
shopRouter.get('/reports', async (req, res) => {
  try {
    const shopId = resolveShopId(req.query);
    const reports = await getReportsSummary(shopId);
    res.json({shopId, reports});
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to compute reports.',
    });
  }
});

// Settings / Profile
shopRouter.get('/settings', async (req, res) => {
  try {
    const shopId = resolveShopId(req.query);
    const profile = await getShopProfile(shopId);
    res.json({shopId, profile});
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to load shop profile.',
    });
  }
});

shopRouter.put('/settings', async (req, res) => {
  try {
    const shopId = resolveShopId(req.body);
    const profile = await updateShopProfile(shopId, req.body as Partial<ShopProfile>);
    res.json({shopId, profile});
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to update shop profile.',
    });
  }
});
