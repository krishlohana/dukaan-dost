import {Router} from 'express';
import type {ExpenseCategory, PendingConfirmation, Product} from '../../src/types/shop.ts';
import {
  addCustomer,
  cancelPendingAction,
  claimPendingActionAtomic,
  getCustomers,
  getDashboardSummary,
  getExpenses,
  getProducts,
  getReportsSummary,
  getShopProfile,
  incrementProductStock,
  makeId,
  recordExpense,
  recordPayment,
  recordSale,
  savePendingAction,
} from '../services/firestoreService.ts';
import {
  generateBusinessInsights,
  parseShopkeeperCommand,
  transcribeVoiceAudio,
} from '../services/geminiService.ts';

export const aiRouter = Router();

function formatPKRServer(value: number): string {
  return `Rs. ${Math.round(value).toLocaleString('en-PK')}`;
}

function findBestProductMatch(products: Product[], queryName: string | null): Product | undefined {
  if (!queryName) return undefined;
  const q = queryName.trim().toLowerCase();
  if (!q) return undefined;
  return (
    products.find((p) => p.name.toLowerCase() === q) ??
    products.find((p) => p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase()))
  );
}

aiRouter.post('/command', async (req, res) => {
  const {command, shopId = 'default_shop'} = req.body as {
    command?: string;
    shopId?: string;
  };

  if (!command || !command.trim()) {
    res.status(400).json({error: 'command is required.'});
    return;
  }

  try {
    const [customers, products] = await Promise.all([
      getCustomers(shopId),
      getProducts(shopId),
    ]);

    const parsed = await parseShopkeeperCommand(command.trim(), {
      customerNames: customers.map((c) => c.name),
      products: products.map((p) => ({
        name: p.name,
        sellingPrice: p.sellingPrice,
        stockQuantity: p.stockQuantity,
      })),
    });

    const nowIso = new Date().toISOString();

    // 1. READ QUERIES (strictly grounded in live Firestore totals)
    if (parsed.intent === 'QUERY_SALES') {
      const [dashboard, reports] = await Promise.all([
        getDashboardSummary(shopId),
        getReportsSummary(shopId),
      ]);

      let reply = '';
      if (parsed.timeframe === 'week') {
        reply = `Pichlay 7 din ki kul farokht (Weekly Sales): ${formatPKRServer(reports.weeklySales)}.`;
      } else if (parsed.timeframe === 'month') {
        reply = `Is mahine ki kul farokht (Monthly Sales): ${formatPKRServer(reports.monthlySales)}.`;
      } else if (parsed.timeframe === 'all') {
        reply = `Ab tak ki kul farokht: ${formatPKRServer(reports.totalRevenue)} (Naqad Wasooli: ${formatPKRServer(reports.cashReceived)}, Udhaar: ${formatPKRServer(reports.creditSales)}).`;
      } else if (parsed.metric === 'cash') {
        reply = `Aaj naqad cash receive hua: ${formatPKRServer(dashboard.todayCashReceived)} (Aaj ki kul farokht: ${formatPKRServer(dashboard.todaySales)}).`;
      } else if (parsed.metric === 'credit') {
        reply = `Aaj ka Udhaar (Credit Sales): ${formatPKRServer(dashboard.todayCreditSales)}.`;
      } else {
        reply = `Aaj ki kul farokht: ${formatPKRServer(dashboard.todaySales)} (Naqad Cash: ${formatPKRServer(dashboard.todayCashReceived)}, Udhaar: ${formatPKRServer(dashboard.todayCreditSales)}).`;
      }

      res.json({
        shopId,
        intent: parsed.intent,
        aiConnected: true,
        geminiConfigured: true,
        reply,
        pendingConfirmation: null,
      });
      return;
    }

    if (parsed.intent === 'QUERY_CUSTOMER_CREDIT') {
      const queryName = (parsed.customerName || '').trim();
      if (!queryName) {
        res.json({
          shopId,
          intent: parsed.intent,
          aiConnected: true,
          geminiConfigured: true,
          reply: 'Barah-e-meharbani customer ka naam likhein (maslan: "Rashid ka kitna udhaar hai?").',
          pendingConfirmation: null,
        });
        return;
      }

      const match =
        customers.find((c) => c.name.toLowerCase() === queryName.toLowerCase()) ??
        customers.find((c) => c.name.toLowerCase().includes(queryName.toLowerCase()));

      if (!match) {
        res.json({
          shopId,
          intent: parsed.intent,
          aiConnected: true,
          geminiConfigured: true,
          reply: `"${queryName}" naam ka koi gahak aapke Khata mein mojood nahi hai. Pehle Customers / Khata mein add karein ya pehla udhaar darj karein.`,
          pendingConfirmation: null,
        });
        return;
      }

      res.json({
        shopId,
        intent: parsed.intent,
        aiConnected: true,
        geminiConfigured: true,
        reply: `${match.name} ka baqaya Udhaar ${formatPKRServer(match.remainingBalance)} hai (Kul Udhaar: ${formatPKRServer(match.totalCredit)}, Kul Wasooli: ${formatPKRServer(match.totalPaid)}).`,
        pendingConfirmation: null,
      });
      return;
    }

    if (parsed.intent === 'QUERY_STOCK') {
      if (products.length === 0) {
        res.json({
          shopId,
          intent: parsed.intent,
          aiConnected: true,
          geminiConfigured: true,
          reply: 'Inventory abhi khaali hai (0 products). Pehle Inventory tab mein apni ashya add karein.',
          pendingConfirmation: null,
        });
        return;
      }

      if (parsed.lowStockOnly) {
        const low = products.filter((p) => p.stockQuantity <= p.lowStockThreshold);
        const reply =
          low.length === 0
            ? 'Shabash! Is waqt koi bhi product low-stock limit se kam nahi hai.'
            : `Low-stock products (${low.length}): ${low
                .map((p) => `${p.name} (${p.stockQuantity} baqi, alert <= ${p.lowStockThreshold})`)
                .join(' · ')}.`;

        res.json({
          shopId,
          intent: parsed.intent,
          aiConnected: true,
          geminiConfigured: true,
          reply,
          pendingConfirmation: null,
        });
        return;
      }

      const matched = findBestProductMatch(products, parsed.productName);
      if (!matched) {
        const missingName = parsed.productName ? `"${parsed.productName}"` : 'Yeh item';
        res.json({
          shopId,
          intent: parsed.intent,
          aiConnected: true,
          geminiConfigured: true,
          reply: `${missingName} aapki Inventory mein mojood nahi hai. Aapke paas abhi ${products.length} products darj hain.`,
          pendingConfirmation: null,
        });
        return;
      }

      const estimateNote =
        matched.estimatedDaysRemaining !== null && matched.estimatedDaysRemaining !== undefined
          ? ` (Estimated ~${matched.estimatedDaysRemaining} din ka stock baqi hai — andaza, guarantee nahi)`
          : '';
      const expiryNote = matched.expiryDate ? ` Expiry Date: ${matched.expiryDate}.` : '';
      res.json({
        shopId,
        intent: parsed.intent,
        aiConnected: true,
        geminiConfigured: true,
        reply: `${matched.name} ka mojooda stock ${matched.stockQuantity} units hai. Selling Price: ${formatPKRServer(matched.sellingPrice)}.${expiryNote}${estimateNote}`,
        pendingConfirmation: null,
      });
      return;
    }

    if (parsed.intent === 'QUERY_EXPENSES') {
      const expenses = await getExpenses(shopId);
      const todayPrefix = nowIso.slice(0, 10);
      const monthPrefix = nowIso.slice(0, 7);

      const todayTotal = expenses
        .filter((e) => e.date === todayPrefix)
        .reduce((sum, e) => sum + e.amount, 0);
      const monthTotal = expenses
        .filter((e) => e.date.startsWith(monthPrefix))
        .reduce((sum, e) => sum + e.amount, 0);
      const allTotal = expenses.reduce((sum, e) => sum + e.amount, 0);

      const reply =
        parsed.timeframe === 'today'
          ? `Aaj ke kul akhrajaat: ${formatPKRServer(todayTotal)}.`
          : parsed.timeframe === 'all'
            ? `Ab tak ke kul akhrajaat: ${formatPKRServer(allTotal)} (${expenses.length} entries).`
            : `Is mahine ke kul akhrajaat: ${formatPKRServer(monthTotal)} (Aaj: ${formatPKRServer(todayTotal)}).`;

      res.json({
        shopId,
        intent: parsed.intent,
        aiConnected: true,
        geminiConfigured: true,
        reply,
        pendingConfirmation: null,
      });
      return;
    }

    if (parsed.intent === 'QUERY_PROFIT') {
      const reports = await getReportsSummary(shopId);
      const missingCostNote = reports.hasMissingPurchaseCosts
        ? ' Note: Kuch farokht shuda ashya ki Purchase Price (Khareed Qeemat) Inventory mein darj nahi hai, is liye bilkul durust munafa ke liye Purchase Price zaroor add karein.'
        : '';

      res.json({
        shopId,
        intent: parsed.intent,
        aiConnected: true,
        geminiConfigured: true,
        reply: `Ab tak ki kul farokht: ${formatPKRServer(reports.totalRevenue)}, Gross Profit: ${formatPKRServer(reports.grossProfit)}, Expenses: ${formatPKRServer(reports.totalExpenses)}, aur Net Profit: ${formatPKRServer(reports.netProfit)}.${missingCostNote}`,
        pendingConfirmation: null,
      });
      return;
    }

    // 2. WRITE INTENTS (Mandatory Confirmation Card before saving to Firestore)
    if (
      (parsed.intent === 'RECORD_CREDIT_SALE' ||
        parsed.intent === 'RECORD_CASH_SALE' ||
        parsed.intent === 'UNKNOWN') &&
      parsed.customerName &&
      parsed.paymentType === 'unspecified' &&
      (parsed.amount || parsed.productName)
    ) {
      const existingCustomer = customers.find(
        (c) => c.name.toLowerCase() === parsed.customerName!.trim().toLowerCase(),
      );
      const itemPart = parsed.productName ? parsed.productName : 'samaan';
      const amountPart =
        parsed.amount && parsed.amount > 0 ? `${formatPKRServer(parsed.amount)} ki ` : '';
      const customerNote = !existingCustomer
        ? ` Note: "${parsed.customerName.trim()}" abhi Khata mein mojood nahi hai.`
        : '';

      res.json({
        shopId,
        intent: parsed.intent,
        extracted: {
          customerName: parsed.customerName,
          productName: parsed.productName,
          amount: parsed.amount,
          paymentType: parsed.paymentType,
        },
        aiConnected: true,
        geminiConfigured: true,
        reply:
          parsed.clarificationQuestion ||
          `${parsed.customerName.trim()} ke liye ${amountPart}${itemPart} darj karni hai — barah-e-meharbani batayein yeh Cash (Naqad) sale hai ya Udhaar (Credit)?${customerNote}`,
        pendingConfirmation: null,
      });
      return;
    }

    if (parsed.intent === 'RECORD_CREDIT_SALE') {
      if (!parsed.customerName || !parsed.amount || parsed.amount <= 0) {
        res.json({
          shopId,
          intent: parsed.intent,
          aiConnected: true,
          geminiConfigured: true,
          reply:
            parsed.clarificationQuestion ||
            'Udhaar darj karne ke liye gahak ka naam aur raqam (Rs.) dono batayein (maslan: "Rashid ne 500 rupay ka samaan udhaar liya").',
          pendingConfirmation: null,
        });
        return;
      }

      const matchedProduct = findBestProductMatch(products, parsed.productName);
      const qty = parsed.quantity && parsed.quantity > 0 ? parsed.quantity : 1;
      if (matchedProduct && matchedProduct.stockQuantity < qty) {
        res.json({
          shopId,
          intent: parsed.intent,
          aiConnected: true,
          geminiConfigured: true,
          reply: `Stock kam hai: ${matchedProduct.name} ke sirf ${matchedProduct.stockQuantity} units baqi hain.`,
          pendingConfirmation: null,
        });
        return;
      }

      const pendingActionId = makeId('pending');
      const pendingConfirmation: PendingConfirmation = {
        pendingActionId,
        actionType: 'RECORD_CREDIT_SALE',
        title: 'Record Credit Sale (Udhaar)',
        customerName: parsed.customerName.trim(),
        productId: matchedProduct ? matchedProduct.id : null,
        productName: matchedProduct ? matchedProduct.name : parsed.productName || 'Kiryana Samaan',
        quantity: qty,
        unitPrice: Number((parsed.amount / qty).toFixed(2)),
        amount: parsed.amount,
        description: parsed.description || parsed.productName || 'Kiryana Samaan',
        date: nowIso,
      };
      await savePendingAction(shopId, pendingConfirmation);

      res.json({
        shopId,
        intent: parsed.intent,
        aiConnected: true,
        geminiConfigured: true,
        reply: 'Udhaar ki tafseel tayyar hai. Save karne se pehle Confirm & Save dabayein:',
        pendingConfirmation,
      });
      return;
    }

    if (parsed.intent === 'RECORD_CASH_SALE') {
      const matchedProduct = findBestProductMatch(products, parsed.productName);
      const qty = parsed.quantity && parsed.quantity > 0 ? parsed.quantity : 1;

      let totalAmount = parsed.amount && parsed.amount > 0 ? parsed.amount : 0;
      if (totalAmount <= 0 && matchedProduct && matchedProduct.sellingPrice > 0) {
        totalAmount = qty * matchedProduct.sellingPrice;
      }

      if (!parsed.productName && !parsed.description) {
        res.json({
          shopId,
          intent: parsed.intent,
          aiConnected: true,
          geminiConfigured: true,
          reply: 'Cash sale ke liye item ka naam aur qeemat/tadaad batayein (maslan: "2 kilo cheeni cash par bechi").',
          pendingConfirmation: null,
        });
        return;
      }

      if (matchedProduct && matchedProduct.stockQuantity < qty) {
        res.json({
          shopId,
          intent: parsed.intent,
          aiConnected: true,
          geminiConfigured: true,
          reply: `Stock kam hai: ${matchedProduct.name} ke sirf ${matchedProduct.stockQuantity} units mojood hain.`,
          pendingConfirmation: null,
        });
        return;
      }

      if (totalAmount <= 0) {
        const nameLabel = matchedProduct?.name || parsed.productName || 'item';
        res.json({
          shopId,
          intent: parsed.intent,
          aiConnected: true,
          geminiConfigured: true,
          reply: `"${nameLabel}" ki selling price Inventory mein mojood nahi hai aur aap ne raqam bhi nahi likhi. Barah-e-meharbani qeemat ke saath likhein (maslan: "2 kilo ${nameLabel} 320 rupay cash par bechi").`,
          pendingConfirmation: null,
        });
        return;
      }

      const pendingActionId = makeId('pending');
      const pendingConfirmation: PendingConfirmation = {
        pendingActionId,
        actionType: 'RECORD_CASH_SALE',
        title: 'Record Cash Sale (Naqad Farokht)',
        customerName: parsed.customerName ? parsed.customerName.trim() : null,
        productId: matchedProduct ? matchedProduct.id : null,
        productName: matchedProduct ? matchedProduct.name : parsed.productName || parsed.description || 'Cash Item',
        quantity: qty,
        unitPrice: Number((totalAmount / qty).toFixed(2)),
        amount: totalAmount,
        description: `${qty} × ${matchedProduct?.name || parsed.productName || parsed.description}${
          parsed.customerName ? ` (Customer: ${parsed.customerName.trim()})` : ''
        }`,
        date: nowIso,
      };
      await savePendingAction(shopId, pendingConfirmation);

      res.json({
        shopId,
        intent: parsed.intent,
        aiConnected: true,
        geminiConfigured: true,
        reply: 'Cash sale ki tafseel check karein aur Confirm & Save dabayein:',
        pendingConfirmation,
      });
      return;
    }

    if (parsed.intent === 'RECORD_REPAYMENT') {
      if (!parsed.customerName || !parsed.amount || parsed.amount <= 0) {
        res.json({
          shopId,
          intent: parsed.intent,
          aiConnected: true,
          geminiConfigured: true,
          reply:
            parsed.clarificationQuestion ||
            'Wasooli record karne ke liye customer ka naam aur raqam (Rs.) batayein.',
          pendingConfirmation: null,
        });
        return;
      }

      const pendingActionId = makeId('pending');
      const pendingConfirmation: PendingConfirmation = {
        pendingActionId,
        actionType: 'RECORD_REPAYMENT',
        title: 'Record Repayment (Wasooli)',
        customerName: parsed.customerName.trim(),
        productName: null,
        quantity: null,
        amount: parsed.amount,
        description: parsed.description || 'Cash repayment (Wasooli)',
        date: nowIso,
      };
      await savePendingAction(shopId, pendingConfirmation);

      res.json({
        shopId,
        intent: parsed.intent,
        aiConnected: true,
        geminiConfigured: true,
        reply: 'Wasooli ki tafseel check karein aur Confirm & Save dabayein:',
        pendingConfirmation,
      });
      return;
    }

    if (parsed.intent === 'RECORD_EXPENSE') {
      if (!parsed.amount || parsed.amount <= 0) {
        res.json({
          shopId,
          intent: parsed.intent,
          aiConnected: true,
          geminiConfigured: true,
          reply:
            parsed.clarificationQuestion ||
            'Expense darj karne ke liye tafseel aur raqam (Rs.) batayein (maslan: "Bijli ka bill 3500 rupay add karo").',
          pendingConfirmation: null,
        });
        return;
      }

      const category: ExpenseCategory = parsed.category || 'Other';
      const description = parsed.description || category;

      const pendingActionId = makeId('pending');
      const pendingConfirmation: PendingConfirmation = {
        pendingActionId,
        actionType: 'RECORD_EXPENSE',
        title: 'Record Shop Expense (Kharch)',
        customerName: null,
        productName: null,
        quantity: null,
        amount: parsed.amount,
        category,
        description,
        date: nowIso,
      };
      await savePendingAction(shopId, pendingConfirmation);

      res.json({
        shopId,
        intent: parsed.intent,
        aiConnected: true,
        geminiConfigured: true,
        reply: 'Expense entry tayyar hai. Save karne ke liye Confirm & Save dabayein:',
        pendingConfirmation,
      });
      return;
    }

    if (parsed.intent === 'ADD_STOCK') {
      if (!parsed.productName || !parsed.quantity || parsed.quantity <= 0) {
        res.json({
          shopId,
          intent: parsed.intent,
          aiConnected: true,
          geminiConfigured: true,
          reply:
            parsed.clarificationQuestion ||
            'Stock add karne ke liye product ka naam aur tadaad batayein (maslan: "Cheeni ka 20 kilo stock add karo").',
          pendingConfirmation: null,
        });
        return;
      }

      const matchedProduct = findBestProductMatch(products, parsed.productName);
      if (!matchedProduct) {
        res.json({
          shopId,
          intent: parsed.intent,
          aiConnected: true,
          geminiConfigured: true,
          reply: `"${parsed.productName}" naam ka koi product Inventory mein mojood nahi hai. Pehle Inventory tab mein "${parsed.productName}" add karein phir stock barhayein.`,
          pendingConfirmation: null,
        });
        return;
      }

      const pendingActionId = makeId('pending');
      const pendingConfirmation: PendingConfirmation = {
        pendingActionId,
        actionType: 'ADD_STOCK',
        title: 'Add Inventory Stock (Maal Daakhil)',
        customerName: null,
        productId: matchedProduct.id,
        productName: matchedProduct.name,
        quantity: parsed.quantity,
        amount: 0,
        description: `Add +${parsed.quantity} units to ${matchedProduct.name} (Current: ${matchedProduct.stockQuantity})`,
        date: nowIso,
      };
      await savePendingAction(shopId, pendingConfirmation);

      res.json({
        shopId,
        intent: parsed.intent,
        aiConnected: true,
        geminiConfigured: true,
        reply: 'Stock update ki tafseel check karein aur Confirm & Save dabayein:',
        pendingConfirmation,
      });
      return;
    }

    // UNKNOWN / Clarification
    res.json({
      shopId,
      intent: 'UNKNOWN',
      aiConnected: true,
      geminiConfigured: true,
      reply:
        parsed.clarificationQuestion ||
        'Mujhe aapki baat puri tarah samajh nahi aayi. Aap sales, stock, expenses, udhaar, ya wasooli ke baare mein seedhay alfaaz mein pooch sakte hain.',
      pendingConfirmation: null,
    });
  } catch (err) {
    res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Gemini AI command parsing failed. Please check GEMINI_API_KEY configuration.',
    });
  }
});

aiRouter.post('/confirm', async (req, res) => {
  const {pendingActionId, shopId = 'default_shop'} = req.body as {
    pendingActionId?: string;
    shopId?: string;
  };

  if (!pendingActionId) {
    res.status(400).json({error: 'pendingActionId is required.'});
    return;
  }

  try {
    const claimed = await claimPendingActionAtomic(shopId, pendingActionId);
    if (claimed.error || !claimed.action) {
      res.status(claimed.status ?? 404).json({error: claimed.error || 'Pending action not found.'});
      return;
    }

    const action = claimed.action;

    if (action.actionType === 'RECORD_CREDIT_SALE') {
      const customers = await getCustomers(shopId);
      let customer = customers.find(
        (c) => c.name.toLowerCase() === (action.customerName || '').trim().toLowerCase(),
      );
      if (!customer) {
        customer = await addCustomer(shopId, {
          name: (action.customerName || 'Customer').trim(),
          phone: '',
          notes: 'Added via AI Assistant confirmation',
        });
      }

      const qty = action.quantity && action.quantity > 0 ? action.quantity : 1;
      const unitPrice = action.unitPrice ?? action.amount / qty;
      const saleRes = await recordSale(shopId, {
        productId: action.productId ?? null,
        productName: action.productName || action.description || 'Kiryana Samaan',
        quantity: qty,
        unitPrice,
        paymentMethod: 'credit',
        customerId: customer.id,
        amountPaid: 0,
      });

      if (saleRes.error) {
        res.status(saleRes.status ?? 400).json({error: saleRes.error});
        return;
      }

      res.json({
        recorded: true,
        actionType: action.actionType,
        summaryText: `Confirmed & Saved: ${customer.name} ke Khata mein ${formatPKRServer(action.amount)} Udhaar darj ho gaya.`,
        sale: saleRes.sale,
      });
      return;
    }

    if (action.actionType === 'RECORD_CASH_SALE') {
      const qty = action.quantity && action.quantity > 0 ? action.quantity : 1;
      const unitPrice = action.unitPrice ?? action.amount / qty;
      const saleRes = await recordSale(shopId, {
        productId: action.productId ?? null,
        productName: action.productName || action.description || 'Cash Sale',
        quantity: qty,
        unitPrice,
        paymentMethod: 'cash',
        customerId: null,
        amountPaid: action.amount,
      });

      if (saleRes.error) {
        res.status(saleRes.status ?? 400).json({error: saleRes.error});
        return;
      }

      res.json({
        recorded: true,
        actionType: action.actionType,
        summaryText: `Confirmed & Saved: ${action.productName} (${qty}) cash par ${formatPKRServer(action.amount)} mein darj ho gayi.`,
        sale: saleRes.sale,
      });
      return;
    }

    if (action.actionType === 'RECORD_REPAYMENT') {
      const customers = await getCustomers(shopId);
      const customer = customers.find(
        (c) => c.name.toLowerCase() === (action.customerName || '').trim().toLowerCase(),
      );
      if (!customer) {
        res.status(404).json({
          error: `"${action.customerName}" naam ka customer Khata mein nahi mila. Pehle Khata mein gahak add karein.`,
        });
        return;
      }

      const payRes = await recordPayment(shopId, {
        customerId: customer.id,
        amount: action.amount,
        description: action.description || 'Repayment via AI Assistant',
      });

      if (payRes.error) {
        res.status(payRes.status ?? 400).json({error: payRes.error});
        return;
      }

      res.json({
        recorded: true,
        actionType: action.actionType,
        summaryText: `Confirmed & Saved: ${customer.name} se ${formatPKRServer(action.amount)} Wasooli record ho gayi. Naya Baqaya: ${formatPKRServer(payRes.customer?.remainingBalance ?? 0)}.`,
        customer: payRes.customer,
      });
      return;
    }

    if (action.actionType === 'RECORD_EXPENSE') {
      const expense = await recordExpense(shopId, {
        description: action.description,
        category: action.category || 'Other',
        amount: action.amount,
        date: new Date().toISOString().slice(0, 10),
      });

      res.json({
        recorded: true,
        actionType: action.actionType,
        summaryText: `Confirmed & Saved: ${expense.description} (${expense.category}) ${formatPKRServer(expense.amount)} expense mein darj ho gaya.`,
        expense,
      });
      return;
    }

    if (action.actionType === 'ADD_STOCK') {
      if (!action.productId || !action.quantity) {
        res.status(400).json({error: 'Missing productId or quantity for ADD_STOCK.'});
        return;
      }

      const updated = await incrementProductStock(shopId, action.productId, action.quantity);
      if (!updated) {
        res.status(404).json({error: 'Product not found in Inventory.'});
        return;
      }

      res.json({
        recorded: true,
        actionType: action.actionType,
        summaryText: `Confirmed & Saved: ${updated.name} mein +${action.quantity} units add ho gaye. Naya stock: ${updated.stockQuantity}.`,
        product: updated,
      });
      return;
    }

    res.status(400).json({error: 'Unsupported pending action type.'});
  } catch (err) {
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to execute confirmed action.',
    });
  }
});

aiRouter.post('/cancel', async (req, res) => {
  const {pendingActionId, shopId = 'default_shop'} = req.body as {
    pendingActionId?: string;
    shopId?: string;
  };
  if (pendingActionId) {
    await cancelPendingAction(shopId, pendingActionId).catch(() => undefined);
  }
  res.json({cancelled: true});
});

aiRouter.post('/insights', async (req, res) => {
  const {shopId = 'default_shop'} = req.body as {shopId?: string};
  try {
    const [profile, dashboard, reports] = await Promise.all([
      getShopProfile(shopId),
      getDashboardSummary(shopId),
      getReportsSummary(shopId),
    ]);

    const insights = await generateBusinessInsights({
      shopName: profile.shopName,
      reports,
      outstandingCredit: dashboard.totalOutstandingCredit,
      lowStockProducts: dashboard.lowStockProducts,
    });

    res.json({insights});
  } catch (err) {
    res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Failed to generate AI Business Insights.',
    });
  }
});

aiRouter.post('/transcribe', async (req, res) => {
  const {audioBase64, mimeType} = req.body as {
    audioBase64?: string;
    mimeType?: string;
  };

  if (!audioBase64 || typeof audioBase64 !== 'string') {
    res.status(400).json({error: 'audioBase64 is required for transcription.'});
    return;
  }

  try {
    const transcript = await transcribeVoiceAudio(audioBase64, mimeType || 'audio/webm');
    res.json({transcript});
  } catch (err) {
    res.status(500).json({
      error:
        err instanceof Error
          ? err.message
          : 'Unable to transcribe voice audio. Please type your command instead.',
    });
  }
});
