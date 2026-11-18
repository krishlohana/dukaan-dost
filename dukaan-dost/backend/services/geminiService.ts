import {GoogleGenAI, Type} from '@google/genai';
import type {
  AiBusinessInsights,
  AiIntentType,
  ExpenseCategory,
  Product,
  ReportsSummary,
} from '../../src/types/shop.ts';

const MODEL_NAME = 'gemini-3.8-flash';

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured in environment secrets.',
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface ParsedShopCommand {
  intent: AiIntentType;
  customerName: string | null;
  productName: string | null;
  quantity: number | null;
  amount: number | null;
  paymentType: 'cash' | 'credit' | 'unspecified';
  category: ExpenseCategory | null;
  description: string | null;
  timeframe: 'today' | 'week' | 'month' | 'all';
  metric: 'total' | 'cash' | 'credit';
  lowStockOnly: boolean;
  clarificationQuestion: string | null;
}

export async function parseShopkeeperCommand(
  command: string,
  context: {
    customerNames: string[];
    products: Pick<Product, 'name' | 'sellingPrice' | 'stockQuantity'>[];
  },
): Promise<ParsedShopCommand> {
  const ai = getAiClient();

  const systemInstruction = `You are Dukaan Dost's strict NLU intent & entity parser for a Pakistani kiryana / grocery shopkeeper.
The user writes in English, Roman Urdu, or Urdu script.
You MUST ONLY classify the intent and extract structured entities from the user's message. NEVER invent numbers, balances, prices, or stock quantities.

Known shop customers: ${context.customerNames.length > 0 ? context.customerNames.join(', ') : 'None yet'}
Known inventory products: ${
    context.products.length > 0
      ? context.products.map((p) => `${p.name} (Rs.${p.sellingPrice}, stock:${p.stockQuantity})`).join(', ')
      : 'None yet'
  }

Allowed intents:
- QUERY_SALES: asking about sales, revenue, cash received, or credit sales (today, last week, this month, all).
- QUERY_CUSTOMER_CREDIT: asking how much udhaar/balance a specific customer owes.
- QUERY_STOCK: asking about stock quantity of a product or asking to list low-stock products.
- QUERY_EXPENSES: asking about shop expenses (today, this month, all).
- QUERY_PROFIT: asking about gross or net profit (today, this month, all).
- RECORD_CREDIT_SALE: recording an udhaar/credit sale to a customer (ONLY when udhaar/credit/khata is stated).
- RECORD_CASH_SALE: recording a cash/naqad sale (ONLY when cash/naqad/paid is stated or no customer udhaar ambiguity exists).
- RECORD_REPAYMENT: recording cash repayment/wasooli from a customer (e.g. "wapas kar diye", "vasool", "paid").
- RECORD_EXPENSE: recording a shop expense (extract description, amount, and category from: Electricity Bill, Shop Rent, Transportation, Employee Salary, Maintenance, Other).
- ADD_STOCK: adding stock quantity for a product (extract productName, quantity).
- UNKNOWN: if ambiguous or payment type (cash vs udhaar) is NOT specified when a customer buys something.

CRITICAL ROMAN URDU SALE & PAYMENT TYPE RULES:
1. If a command mentions a customer name AND a product or amount WITHOUT clearly saying cash/naqad or udhaar/credit (for example: "pawan ne 200 rs kee cheeni lee ha"), ALWAYS extract customerName ("Pawan"), productName ("Cheeni"), amount (200), set paymentType to "unspecified", and set clarificationQuestion in friendly Roman Urdu asking whether it was Cash (Naqad) or Udhaar (Credit) (and mention if the customer is not yet in Khata).
2. Only set paymentType to "credit" when words like udhaar, udhar, khata, or credit are explicitly used.
3. Only set paymentType to "cash" when words like cash, naqad, or direct counter cash sale are used.`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: command,
    config: {
      systemInstruction,
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          intent: {
            type: Type.STRING,
            description:
              'One of: QUERY_SALES, QUERY_CUSTOMER_CREDIT, QUERY_STOCK, QUERY_EXPENSES, QUERY_PROFIT, RECORD_CREDIT_SALE, RECORD_CASH_SALE, RECORD_REPAYMENT, RECORD_EXPENSE, ADD_STOCK, UNKNOWN',
          },
          customerName: {type: Type.STRING, nullable: true},
          productName: {type: Type.STRING, nullable: true},
          quantity: {type: Type.NUMBER, nullable: true},
          amount: {type: Type.NUMBER, nullable: true},
          paymentType: {
            type: Type.STRING,
            description: 'One of: cash, credit, unspecified',
          },
          category: {
            type: Type.STRING,
            nullable: true,
            description:
              'For expenses only: Electricity Bill, Shop Rent, Transportation, Employee Salary, Maintenance, or Other',
          },
          description: {type: Type.STRING, nullable: true},
          timeframe: {
            type: Type.STRING,
            description: 'One of: today, week, month, all',
          },
          metric: {
            type: Type.STRING,
            description: 'For QUERY_SALES: total, cash, or credit',
          },
          lowStockOnly: {type: Type.BOOLEAN},
          clarificationQuestion: {type: Type.STRING, nullable: true},
        },
        required: ['intent', 'paymentType', 'timeframe', 'metric', 'lowStockOnly'],
      },
    },
  });

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText) as Partial<ParsedShopCommand>;

  return {
    intent: (parsed.intent as AiIntentType) || 'UNKNOWN',
    customerName: parsed.customerName ?? null,
    productName: parsed.productName ?? null,
    quantity: typeof parsed.quantity === 'number' ? parsed.quantity : null,
    amount: typeof parsed.amount === 'number' ? parsed.amount : null,
    paymentType:
      parsed.paymentType === 'cash' || parsed.paymentType === 'credit'
        ? parsed.paymentType
        : 'unspecified',
    category: (parsed.category as ExpenseCategory) ?? null,
    description: parsed.description ?? null,
    timeframe: parsed.timeframe || 'today',
    metric: parsed.metric || 'total',
    lowStockOnly: Boolean(parsed.lowStockOnly),
    clarificationQuestion: parsed.clarificationQuestion ?? null,
  };
}

export async function generateBusinessInsights(input: {
  shopName: string;
  reports: ReportsSummary;
  outstandingCredit: number;
  lowStockProducts: Product[];
}): Promise<AiBusinessInsights> {
  const ai = getAiClient();

  const prompt = `Analyze these REAL shop figures for Pakistani kiryana store "${input.shopName}":
- Daily Sales: Rs. ${input.reports.dailySales}
- Weekly Sales: Rs. ${input.reports.weeklySales}
- Monthly Sales: Rs. ${input.reports.monthlySales}
- Total Revenue (All Time): Rs. ${input.reports.totalRevenue}
- Cash Received: Rs. ${input.reports.cashReceived}
- Credit Sales (Udhaar): Rs. ${input.reports.creditSales}
- Total Outstanding Customer Udhaar: Rs. ${input.outstandingCredit}
- Total Expenses: Rs. ${input.reports.totalExpenses}
- Gross Profit: Rs. ${input.reports.grossProfit}
- Net Profit: Rs. ${input.reports.netProfit}
- Missing Purchase Prices Warning: ${input.reports.hasMissingPurchaseCosts ? 'YES (some sold items lack purchase price)' : 'NO'}
- Best Selling Products: ${
    input.reports.bestSellingProducts.length > 0
      ? input.reports.bestSellingProducts
          .map((p) => `${p.productName} (${p.unitsSold} units, Rs. ${p.revenue})`)
          .join('; ')
      : 'None recorded yet'
  }
- Low-Stock Products: ${
    input.lowStockProducts.length > 0
      ? input.lowStockProducts.map((p) => `${p.name} (${p.stockQuantity} left)`).join('; ')
      : 'None'
  }

STRICT RULES:
- Never invent or estimate missing sales, expenses, or profits. Only reference the exact numbers provided above.
- Keep language clear, practical, and friendly for a Pakistani shopkeeper (mix simple English & Roman Urdu cleanly).`;

  const response = await ai.models.generateContent({
    model: MODEL_NAME,
    contents: prompt,
    config: {
      systemInstruction:
        'You are Dukaan Dost Business Advisor. Give concise, practical, accurate financial and inventory advice strictly grounded in the real figures provided.',
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          headline: {
            type: Type.STRING,
            description: 'Short 1-line summary headline of the shop status.',
          },
          highlights: {
            type: Type.ARRAY,
            items: {type: Type.STRING},
            description: '2-3 factual observations based strictly on the provided numbers.',
          },
          actionableTips: {
            type: Type.ARRAY,
            items: {type: Type.STRING},
            description: '2-3 practical next steps for cash flow, udhaar recovery, or expenses.',
          },
          stockAdvice: {
            type: Type.STRING,
            description: '1 concise sentence regarding low-stock products or inventory setup.',
          },
        },
        required: ['headline', 'highlights', 'actionableTips', 'stockAdvice'],
      },
    },
  });

  const rawText = (response.text ?? '{}').trim();
  const parsed = JSON.parse(rawText) as Omit<AiBusinessInsights, 'generatedAt'>;

  return {
    headline: parsed.headline || 'Shop Financial Summary',
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
    actionableTips: Array.isArray(parsed.actionableTips) ? parsed.actionableTips : [],
    stockAdvice: parsed.stockAdvice || 'Monitor low-stock items regularly in Inventory.',
    generatedAt: new Date().toISOString(),
  };
}

export async function transcribeVoiceAudio(
  audioBase64: string,
  rawMimeType = 'audio/webm',
): Promise<string> {
  const ai = getAiClient();
  // Strip optional codec parameters (e.g. "audio/webm;codecs=opus" -> "audio/webm")
  const mimeType = rawMimeType.split(';')[0]?.trim() || 'audio/webm';

  const audioPart = {
    inlineData: {
      mimeType,
      data: audioBase64,
    },
  };
  const instructionPart = {
    text: 'Transcribe the spoken words in this audio accurately (in English or Roman Urdu). Output only the exact spoken words. If no speech is heard or the audio is silent, output nothing.',
  };

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-transcribe',
      contents: {parts: [audioPart, instructionPart]},
    });
    return (response.text ?? '').trim();
  } catch {
    const fallbackResponse = await ai.models.generateContent({
      model: MODEL_NAME,
      contents: {parts: [audioPart, instructionPart]},
    });
    return (fallbackResponse.text ?? '').trim();
  }
}
