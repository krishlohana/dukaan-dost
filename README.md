# dukaan-dost
A modular, shop management &amp; POS web application built for local retail businesses to streamline daily sales, inventory tracking, and khata (customer credit) management.

# 🏪 Dukaan Dost

**Your Digital Companion for Smart Shop Management**

**Dukaan Dost** is a modular, local-first shop management and Point of Sale (POS) application built to help small and medium retail shopkeepers digitize daily operations—tracking inventory, recording sales, and managing customer credit (*khata*) without relying on complex hardware or constant internet connectivity.

---

## 🎯 Problem Statement
Many local retail stores still rely on manual paper ledgers (*khatas*) to track daily sales, stock levels, and customer credit. This leads to:
- Frequent calculation errors and lost credit records.
- Zero real-time visibility into low-stock items or best-selling products.
- Time-consuming end-of-day cash reconciliation.

## 💡 Solution
Dukaan Dost provides an intuitive, lightweight web dashboard that runs directly in the browser with instant local persistence. Shopkeepers can manage products, process quick checkouts, monitor daily revenue, and track pending customer balances from a single interface—designed with a scalable architecture ready for cloud sync and AI-powered business insights.

---

## ✨ Key Features (v1.0 Prototype)

### ✅ Currently Functional
- **Interactive Dashboard:** Real-time overview of total sales, active inventory count, low-stock alerts, and pending customer credit.
- **Inventory Management:** Add, edit, delete, and search products with automatic stock-level status indicators.
- **Quick Billing / POS:** Streamlined cart system to generate bills, apply quantities, and automatically deduct sold items from inventory.
- **Customer Credit (*Khata*) Ledger:** Track customers with outstanding balances, record credit sales, and log partial or full repayments.
- **Offline-First Local Persistence:** All transactions, products, and ledger entries are saved automatically in browser storage (`localStorage`), surviving page reloads with zero latency.

### 🧪 Simulated / Demo Modules
- **Smart Business Insights:** Rule-based mock recommendations simulating AI-driven restock alerts and sales summaries.
- **Receipt Export / Print Preview:** Simulated digital invoice formatting for customer sharing.

---

## 🏗️ Project Architecture & Structure

The application is built with a clean, component-driven architecture separating UI presentation, state management, and storage persistence:

```text
dukaan-dost/
├── server.ts                          # Express server entry point (API routes + Vite/dist serving)
├── package.json                       # Dependencies & scripts (dev, build, start, lint)
├── index.html                         # App title, metadata & fonts (Plus Jakarta Sans, JetBrains Mono)
├── metadata.json                      # App manifest & microphone permission config
├── vite.config.ts                     # Vite + Tailwind CSS build config
├── tsconfig.json                      # TypeScript configuration
│
├── backend/
│   ├── routes/
│   │   ├── healthRoutes.ts            # GET /api/health, POST /api/health/test-firebase
│   │   ├── shopRoutes.ts              # CRUD & ledger APIs: dashboard, sales, customers, payments,
│   │   │                              # products, stock, expenses, reports, settings
│   │   └── aiRoutes.ts                # POST /api/ai/command, /confirm, /cancel, /insights, /transcribe
│   └── services/
│       ├── firebaseClient.ts          # Firebase app & Firestore initialization
│       ├── firestoreService.ts        # All Firestore queries, atomic transactions, stock & profit math
│       └── geminiService.ts           # Structured JSON NLU parser, voice transcription, business advisor
│
└── src/
    ├── main.tsx                       # React entry point
    ├── App.tsx                        # Global state, view routing (8 tabs) & backend data sync
    ├── index.css                      # Tailwind CSS setup
    ├── types/
    │   └── shop.ts                    # Shared TypeScript interfaces (Product, Customer, SaleRecord, etc.)
    ├── lib/
    │   └── api.ts                     # Centralized frontend API client calling /api/*
    ├── utils/
    │   └── format.ts                  # PKR formatting, date/time helpers, expiry day calculations
    └── components/
        ├── Layout.tsx                 # Responsive shell (desktop sidebar + mobile nav drawer)
        ├── EmptyState.tsx             # Clean empty-state cards (no fake/mock data)
        └── views/
            ├── DashboardView.tsx      # Daily summary KPIs, Red Expiry Notice, Low-Stock & Recent Txns
            ├── AiAssistantView.tsx    # WhatsApp-style chat, Voice Mic, Confirmation Cards
            ├── SalesView.tsx          # Inventory-linked POS, inline customer add, PNG Receipt download
            ├── CustomersView.tsx      # Digital Khata ledger, repayments (Wasooli), WhatsApp reminders
            ├── InventoryView.tsx      # Product catalog, Expiry Red Alerts, Stock Prediction, Restock
            ├── ExpensesView.tsx       # Categorized expense tracking & totals
            ├── ReportsView.tsx        # Sales periods, Gross/Net Profit, Top Products, AI Insights
            └── SettingsView.tsx       # Shop profile & live Server/Firebase/Gemini health checks
