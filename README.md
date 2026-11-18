# dukaan-dost
A modular, offline-first shop management &amp; POS web application built for local retail businesses to streamline daily sales, inventory tracking, and khata (customer credit) management.

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
├── src/
│   ├── components/       # Reusable UI elements (Navbar, StatCards, Modals, Tables)
│   ├── pages/            # Core application views (Dashboard, Inventory, POS, Khata)
│   ├── context/          # Global state & CRUD actions for store data
│   ├── services/         # Browser storage abstraction layer (localStorage helpers)
│   ├── types/            # Data models for Products, Sales, and Customers
│   └── App.tsx           # Main routing and layout shell
├── public/               # Static assets and icons
└── package.json          # Dependencies and build scripts
