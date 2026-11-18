import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  PackagePlus,
  Receipt,
  ShoppingCart,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import type {FormEvent} from 'react';
import {useEffect, useMemo, useState} from 'react';
import type {
  Customer,
  NavTabId,
  PaymentMethod,
  Product,
  SaleRecord,
  ShopProfile,
} from '../../types/shop';
import {
  EXPIRY_WARNING_DAYS,
  formatDateTime,
  formatPKR,
  formatShortDate,
  getDaysUntilExpiry,
} from '../../utils/format';
import {EmptyState} from '../EmptyState';

interface SalesViewProps {
  profile: ShopProfile;
  inventory: Product[];
  customers: Customer[];
  sales: SaleRecord[];
  onCreateSale: (payload: {
    productId: string | null;
    productName: string;
    quantity: number;
    unitPrice: number;
    paymentMethod: PaymentMethod;
    customerId: string | null;
    amountPaid: number;
  }) => Promise<SaleRecord>;
  onAddCustomer: (payload: {
    name: string;
    phone: string;
    notes: string;
  }) => Promise<Customer>;
  onNavigate: (tab: NavTabId) => void;
}

export function SalesView({
  profile,
  inventory,
  customers,
  sales,
  onCreateSale,
  onAddCustomer,
  onNavigate,
}: SalesViewProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('1');
  const [unitPrice, setUnitPrice] = useState<string>('0');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('cash');
  const [customerId, setCustomerId] = useState<string>('');
  const [isNewCustomer, setIsNewCustomer] = useState<boolean>(false);
  const [newCustomerName, setNewCustomerName] = useState('');
  const [newCustomerPhone, setNewCustomerPhone] = useState('');
  const [newCustomerNotes, setNewCustomerNotes] = useState('');
  const [amountPaid, setAmountPaid] = useState<string>('0');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [receiptSale, setReceiptSale] = useState<SaleRecord | null>(null);
  const [copiedReceipt, setCopiedReceipt] = useState(false);
  const [downloadedReceipt, setDownloadedReceipt] = useState(false);

  const usingNewCustomer = isNewCustomer || customers.length === 0;

  const duplicateNameMatch = useMemo(() => {
    const q = newCustomerName.trim().toLowerCase();
    if (!q) return null;
    return customers.find((c) => c.name.trim().toLowerCase() === q) ?? null;
  }, [customers, newCustomerName]);

  // Keep selectedProductId synced to a valid product from inventory (prefer first in-stock item)
  useEffect(() => {
    if (inventory.length === 0) {
      setSelectedProductId('');
      setUnitPrice('0');
      return;
    }

    const existing = inventory.find((p) => p.id === selectedProductId);
    if (!existing) {
      const preferred = inventory.find((p) => p.stockQuantity > 0) ?? inventory[0];
      setSelectedProductId(preferred.id);
      setUnitPrice(String(preferred.sellingPrice));
    }
  }, [inventory, selectedProductId]);

  const selectedProduct = useMemo(
    () => inventory.find((p) => p.id === selectedProductId) ?? null,
    [selectedProductId, inventory],
  );

  const isOutOfStock = selectedProduct ? selectedProduct.stockQuantity <= 0 : true;
  const selectedExpiryDays = selectedProduct
    ? getDaysUntilExpiry(selectedProduct.expiryDate)
    : null;
  const isExpiryNear =
    selectedExpiryDays !== null && selectedExpiryDays <= EXPIRY_WARNING_DAYS;

  const numericQty = Math.max(0, Number(quantity) || 0);
  const numericPrice = Math.max(0, Number(unitPrice) || 0);
  const subtotal = numericQty * numericPrice;

  const effectivePaid = useMemo(() => {
    if (paymentMethod === 'cash') return subtotal;
    if (paymentMethod === 'credit') return 0;
    const paid = Number(amountPaid) || 0;
    return Math.min(Math.max(0, paid), subtotal);
  }, [paymentMethod, subtotal, amountPaid]);

  const remainingCredit = Math.max(0, subtotal - effectivePaid);

  const handleProductChange = (value: string) => {
    setSelectedProductId(value);
    setErrorMsg(null);
    const found = inventory.find((p) => p.id === value);
    if (found) {
      setUnitPrice(String(found.sellingPrice));
      setQuantity('1');
    } else {
      setUnitPrice('0');
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (inventory.length === 0 || !selectedProduct) {
      setErrorMsg('Please add products in Inventory first before recording a POS sale.');
      return;
    }
    if (selectedProduct.stockQuantity <= 0) {
      setErrorMsg(
        `"${selectedProduct.name}" is out of stock. Please restock it in Inventory first.`,
      );
      return;
    }
    if (numericQty <= 0) {
      setErrorMsg('Quantity must be greater than 0.');
      return;
    }
    if (numericQty > selectedProduct.stockQuantity) {
      setErrorMsg(
        `Insufficient stock: only ${selectedProduct.stockQuantity} units of "${selectedProduct.name}" available.`,
      );
      return;
    }
    const requiresCustomer = paymentMethod === 'credit' || paymentMethod === 'partial';
    if (requiresCustomer) {
      if (usingNewCustomer && !newCustomerName.trim()) {
        setErrorMsg('Please enter the new customer name for Credit / Partial payment.');
        return;
      }
      if (!usingNewCustomer && !customerId) {
        setErrorMsg('Please select an existing customer or click "+ New Customer" to add one.');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      let resolvedCustomerId: string | null = paymentMethod === 'cash' ? null : customerId;
      if (requiresCustomer && usingNewCustomer) {
        const createdCustomer = await onAddCustomer({
          name: newCustomerName.trim(),
          phone: newCustomerPhone.trim(),
          notes: newCustomerNotes.trim(),
        });
        resolvedCustomerId = createdCustomer.id;
        setCustomerId(createdCustomer.id);
        setIsNewCustomer(false);
        setNewCustomerName('');
        setNewCustomerPhone('');
        setNewCustomerNotes('');
      }

      const created = await onCreateSale({
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        quantity: numericQty,
        unitPrice: numericPrice,
        paymentMethod,
        customerId: resolvedCustomerId,
        amountPaid: effectivePaid,
      });
      setReceiptSale(created);
      setDownloadedReceipt(false);
      setQuantity('1');
      setAmountPaid('0');
      setCustomerId('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to complete sale.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const buildReceiptText = (sale: SaleRecord) =>
    [
      profile.shopName || 'Dukaan Dost — Apni Dukaan',
      profile.cityAddress || null,
      profile.phone || null,
      '--------------------------------',
      `Receipt: ${sale.receiptNumber}`,
      `Date: ${formatDateTime(sale.createdAt)}`,
      `Item: ${sale.productName}`,
      `Qty x Price: ${sale.quantity} x ${formatPKR(sale.unitPrice)}`,
      sale.customerName ? `Customer: ${sale.customerName}` : null,
      '--------------------------------',
      `Total Bill: ${formatPKR(sale.totalAmount)}`,
      `Paid (${sale.paymentMethod}): ${formatPKR(sale.amountPaid)}`,
      sale.creditAmount > 0 ? `Udhaar Balance: ${formatPKR(sale.creditAmount)}` : null,
      '--------------------------------',
      'Shukriya! Dobara tashreef laayein.',
    ]
      .filter(Boolean)
      .join('\n');

  const handleCopyReceipt = async () => {
    if (!receiptSale) return;
    try {
      await navigator.clipboard.writeText(buildReceiptText(receiptSale));
      setCopiedReceipt(true);
      setTimeout(() => setCopiedReceipt(false), 2000);
    } catch {
      // Ignore clipboard failure
    }
  };

  const triggerDownload = (href: string, filename: string, revokeAfter?: () => void) => {
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    if (revokeAfter) {
      setTimeout(revokeAfter, 1500);
    }
  };

  const handleDownloadReceipt = () => {
    if (!receiptSale) return;
    const safeReceiptNo = receiptSale.receiptNumber.replace(/[^a-zA-Z0-9_-]/g, '');
    const shopTitle = profile.shopName || 'Dukaan Dost — Apni Dukaan';
    const scale = 2;
    const width = 460;
    const paddingX = 28;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      // Plain text fallback if canvas is unavailable
      const blob = new Blob([buildReceiptText(receiptSale)], {type: 'text/plain;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      triggerDownload(url, `DukaanDost-Receipt-${safeReceiptNo}.txt`, () => URL.revokeObjectURL(url));
      setDownloadedReceipt(true);
      setTimeout(() => setDownloadedReceipt(false), 2000);
      return;
    }

    // Calculate dynamic height based on optional fields
    let estimatedHeight = 400;
    if (profile.cityAddress) estimatedHeight += 20;
    if (profile.phone) estimatedHeight += 20;
    if (receiptSale.customerName) estimatedHeight += 28;
    if (receiptSale.creditAmount > 0) estimatedHeight += 28;

    canvas.width = width * scale;
    canvas.height = estimatedHeight * scale;
    ctx.scale(scale, scale);

    // Background & outer border
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, estimatedHeight);
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1;
    ctx.strokeRect(12, 12, width - 24, estimatedHeight - 24);

    // Top emerald accent bar
    ctx.fillStyle = '#047857';
    ctx.fillRect(12, 12, width - 24, 6);

    let y = 46;

    // Shop Header
    ctx.fillStyle = '#0f172a';
    ctx.textAlign = 'center';
    ctx.font = 'bold 18px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText(shopTitle, width / 2, y, width - 56);
    y += 22;

    ctx.fillStyle = '#64748b';
    ctx.font = '12px "Plus Jakarta Sans", system-ui, sans-serif';
    if (profile.cityAddress) {
      ctx.fillText(profile.cityAddress, width / 2, y, width - 56);
      y += 18;
    }
    if (profile.phone) {
      ctx.fillText(profile.phone, width / 2, y, width - 56);
      y += 18;
    }

    y += 4;
    ctx.font = '11px "JetBrains Mono", monospace';
    ctx.fillText(
      `Receipt: ${receiptSale.receiptNumber} · ${formatDateTime(receiptSale.createdAt)}`,
      width / 2,
      y,
      width - 56,
    );
    y += 18;

    const drawDashedDivider = (lineY: number) => {
      ctx.save();
      ctx.strokeStyle = '#cbd5e1';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(paddingX, lineY);
      ctx.lineTo(width - paddingX, lineY);
      ctx.stroke();
      ctx.restore();
    };

    const drawRow = (
      label: string,
      value: string,
      opts?: {color?: string; bold?: boolean; size?: number},
    ) => {
      const fontSize = opts?.size ?? 13;
      const weight = opts?.bold ? 'bold ' : '';
      ctx.font = `${weight}${fontSize}px "JetBrains Mono", monospace`;
      ctx.fillStyle = opts?.color ?? '#334155';
      ctx.textAlign = 'left';
      ctx.fillText(label, paddingX, y, (width - paddingX * 2) * 0.55);
      ctx.textAlign = 'right';
      ctx.fillStyle = opts?.color ?? '#0f172a';
      ctx.fillText(value, width - paddingX, y, (width - paddingX * 2) * 0.45);
      y += fontSize + 14;
    };

    drawDashedDivider(y);
    y += 26;

    drawRow('Item', receiptSale.productName, {bold: true});
    drawRow(
      'Qty x Unit Price',
      `${receiptSale.quantity} x ${formatPKR(receiptSale.unitPrice)}`,
    );
    if (receiptSale.customerName) {
      drawRow('Customer', receiptSale.customerName, {bold: true});
    }

    y += 2;
    drawDashedDivider(y);
    y += 28;

    drawRow('Total Bill', formatPKR(receiptSale.totalAmount), {
      bold: true,
      size: 16,
      color: '#0f172a',
    });
    drawRow(`Paid (${receiptSale.paymentMethod})`, formatPKR(receiptSale.amountPaid), {
      bold: true,
      color: '#047857',
    });
    if (receiptSale.creditAmount > 0) {
      drawRow('Udhaar Balance', formatPKR(receiptSale.creditAmount), {
        bold: true,
        color: '#b45309',
      });
    }

    y += 6;
    drawDashedDivider(y);
    y += 26;

    ctx.textAlign = 'center';
    ctx.fillStyle = '#64748b';
    ctx.font = '12px "Plus Jakarta Sans", system-ui, sans-serif';
    ctx.fillText('Shukriya! Dobara tashreef laayein.', width / 2, y);

    const filename = `DukaanDost-Receipt-${safeReceiptNo}.png`;
    if (canvas.toBlob) {
      canvas.toBlob((blob) => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          triggerDownload(url, filename, () => URL.revokeObjectURL(url));
        } else {
          triggerDownload(canvas.toDataURL('image/png'), filename);
        }
      }, 'image/png');
    } else {
      triggerDownload(canvas.toDataURL('image/png'), filename);
    }

    setDownloadedReceipt(true);
    setTimeout(() => setDownloadedReceipt(false), 2000);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <h1 className="text-xl font-bold text-slate-900">Sales / Point of Sale</h1>
        <p className="text-sm text-slate-600 mt-1">
          Nayi farokht darj karein — Inventory se product chunein, stock khud-ba-khud kam ho jayega
        </p>

        {inventory.length === 0 ? (
          <div className="mt-5 p-5 rounded-xl bg-amber-50 border border-amber-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-800 flex items-center justify-center shrink-0">
                <PackagePlus className="w-5 h-5" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  No products in Inventory yet
                </h2>
                <p className="text-sm text-slate-700 mt-0.5">
                  Inventory mein pehle products add karein taa-ke har sale par stock automatic minus aur update ho sake.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('inventory')}
              className="min-h-[44px] px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PackagePlus className="w-4 h-4" aria-hidden="true" />
              <span>Add Products in Inventory</span>
            </button>
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Product Selector (Inventory Only) */}
            <div className="lg:col-span-2">
              <label
                htmlFor="sale-product"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Product / Samaan (From Inventory)
              </label>
              <select
                id="sale-product"
                value={selectedProductId}
                onChange={(e) => handleProductChange(e.target.value)}
                disabled={inventory.length === 0}
                className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                {inventory.length === 0 ? (
                  <option value="">-- No products in Inventory --</option>
                ) : (
                  inventory.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} (
                      {item.stockQuantity > 0
                        ? `${item.stockQuantity} in stock`
                        : 'Out of stock'}{' '}
                      · {formatPKR(item.sellingPrice)})
                    </option>
                  ))
                )}
              </select>
              {selectedProduct && isOutOfStock && (
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                  <span className="inline-flex items-center gap-1 font-medium">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    "{selectedProduct.name}" is out of stock (0 available).
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('inventory')}
                    className="font-semibold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Restock in Inventory
                  </button>
                </div>
              )}
              {selectedProduct && isExpiryNear && selectedExpiryDays !== null && (
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-red-800 bg-red-50 border border-red-200 rounded-md px-2.5 py-1.5">
                  <span className="inline-flex items-center gap-1 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-red-700" aria-hidden="true" />
                    {selectedExpiryDays < 0
                      ? `Expired ${Math.abs(selectedExpiryDays)}d ago (${formatShortDate(selectedProduct.expiryDate || '')}) — Order new stock`
                      : selectedExpiryDays === 0
                        ? `Expires today (${formatShortDate(selectedProduct.expiryDate || '')}) — Order new stock`
                        : `Expiry near: ${selectedExpiryDays} day${selectedExpiryDays === 1 ? '' : 's'} left (${formatShortDate(selectedProduct.expiryDate || '')})`}
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigate('inventory')}
                    className="font-semibold text-red-900 hover:underline whitespace-nowrap cursor-pointer"
                  >
                    Manage in Inventory
                  </button>
                </div>
              )}
            </div>

            {/* Quantity */}
            <div>
              <label
                htmlFor="sale-qty"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Quantity (Tadaad)
              </label>
              <input
                id="sale-qty"
                type="number"
                min="1"
                max={selectedProduct && selectedProduct.stockQuantity > 0 ? selectedProduct.stockQuantity : undefined}
                step="1"
                disabled={inventory.length === 0 || isOutOfStock}
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              {selectedProduct && !isOutOfStock && (
                <p className="text-xs text-slate-500 mt-1 tabular-nums">
                  Available stock: {selectedProduct.stockQuantity}
                </p>
              )}
            </div>

            {/* Unit Price */}
            <div>
              <label
                htmlFor="sale-price"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Unit Price (Rs.)
              </label>
              <input
                id="sale-price"
                type="number"
                min="0"
                step="1"
                disabled={inventory.length === 0 || isOutOfStock}
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
          </div>

          {/* Payment Method */}
          <div>
            <span className="block text-sm font-semibold text-slate-800 mb-2">
              Payment Method (Adaigi ka Tareeqa)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
                  {id: 'cash', label: 'Cash (Naqad)'},
                  {id: 'credit', label: 'Credit / Udhaar'},
                  {id: 'partial', label: 'Partial Payment'},
                ] as const
              ).map((option) => {
                const active = paymentMethod === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setPaymentMethod(option.id)}
                    className={`min-h-[44px] px-4 py-2.5 rounded-lg border text-sm font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-700 text-white border-emerald-700'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customer Selector / Inline New Customer & Amount Paid when Credit / Partial */}
          {(paymentMethod === 'credit' || paymentMethod === 'partial') && (
            <div className="space-y-4 p-4 rounded-xl bg-slate-50 border border-slate-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <label
                      htmlFor={usingNewCustomer ? 'sale-new-cust-name' : 'sale-customer'}
                      className="block text-sm font-semibold text-slate-800"
                    >
                      {usingNewCustomer
                        ? 'New Customer Details (Naya Gahak)'
                        : 'Select Customer (Gahak)'}
                    </label>
                    {customers.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsNewCustomer((prev) => !prev);
                          setErrorMsg(null);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap cursor-pointer"
                      >
                        {usingNewCustomer ? (
                          <>
                            <Users className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>Select Existing</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-3.5 h-3.5" aria-hidden="true" />
                            <span>+ New Customer</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {!usingNewCustomer ? (
                    <select
                      id="sale-customer"
                      value={customerId}
                      onChange={(e) => setCustomerId(e.target.value)}
                      className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                    >
                      <option value="">-- Select customer from Khata --</option>
                      {customers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name} (Balance: {formatPKR(c.remainingBalance)})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-xs text-slate-600 bg-white border border-slate-200 rounded-lg px-3 py-2.5">
                      Saving this sale will automatically add this customer to your Khata ledger.
                    </p>
                  )}
                </div>

                <div>
                  <label
                    htmlFor="sale-paid"
                    className="block text-sm font-semibold text-slate-800 mb-1.5"
                  >
                    Amount Paid Now (Wasool Raqam Rs.)
                  </label>
                  <input
                    id="sale-paid"
                    type="number"
                    min="0"
                    max={subtotal}
                    disabled={paymentMethod === 'credit'}
                    value={paymentMethod === 'credit' ? '0' : amountPaid}
                    onChange={(e) => setAmountPaid(e.target.value)}
                    className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                </div>
              </div>

              {usingNewCustomer && (
                <div className="pt-3 border-t border-slate-200 space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div>
                      <label
                        htmlFor="sale-new-cust-name"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Customer Name *
                      </label>
                      <input
                        id="sale-new-cust-name"
                        type="text"
                        value={newCustomerName}
                        onChange={(e) => setNewCustomerName(e.target.value)}
                        placeholder="e.g., Muhammad Rashid"
                        className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="sale-new-cust-phone"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Phone Number
                      </label>
                      <input
                        id="sale-new-cust-phone"
                        type="tel"
                        value={newCustomerPhone}
                        onChange={(e) => setNewCustomerPhone(e.target.value)}
                        placeholder="0300-1234567"
                        className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="sale-new-cust-notes"
                        className="block text-xs font-semibold text-slate-700 mb-1"
                      >
                        Notes (Pata / Nishani)
                      </label>
                      <input
                        id="sale-new-cust-notes"
                        type="text"
                        value={newCustomerNotes}
                        onChange={(e) => setNewCustomerNotes(e.target.value)}
                        placeholder="e.g., Gali #4, Masjid ke paas"
                        className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
                      />
                    </div>
                  </div>
                  {duplicateNameMatch && (
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                      <span>
                        "{duplicateNameMatch.name}" already exists in Khata (Balance:{' '}
                        {formatPKR(duplicateNameMatch.remainingBalance)}).
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setCustomerId(duplicateNameMatch.id);
                          setIsNewCustomer(false);
                          setNewCustomerName('');
                          setNewCustomerPhone('');
                          setNewCustomerNotes('');
                        }}
                        className="font-semibold text-emerald-700 hover:underline whitespace-nowrap cursor-pointer"
                      >
                        Use Existing Customer
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {errorMsg && (
            <p className="text-sm font-medium text-red-700 bg-red-50 border border-red-200 rounded-lg px-3.5 py-2.5">
              {errorMsg}
            </p>
          )}

          {/* Auto-Calculated Totals & Submit */}
          <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6">
              <div>
                <p className="text-xs text-slate-500">Subtotal / Total Bill</p>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">
                  {formatPKR(subtotal)}
                </p>
              </div>
              {paymentMethod !== 'cash' && (
                <div>
                  <p className="text-xs text-slate-500">Udhaar Added to Khata</p>
                  <p className="text-lg font-bold text-amber-700 tabular-nums">
                    {formatPKR(remainingCredit)}
                  </p>
                </div>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting || inventory.length === 0 || isOutOfStock}
              className="min-h-[48px] px-6 py-3 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ShoppingCart className="w-4 h-4" aria-hidden="true" />
              <span>{isSubmitting ? 'Saving Sale...' : 'Save Sale & View Receipt'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Sales History */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Sales History</h2>
            <p className="text-xs text-slate-500 mt-0.5">Farokht ka Mukammal Record</p>
          </div>
          <span className="text-xs font-medium text-slate-500 tabular-nums">
            {sales.length} {sales.length === 1 ? 'record' : 'records'}
          </span>
        </div>

        {sales.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title="No sales recorded yet"
            description="No records yet. Select a product above and save a sale to generate your first Digital Receipt."
          />
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Receipt</th>
                  <th className="py-3 px-4">Item</th>
                  <th className="py-3 px-4 text-right">Qty</th>
                  <th className="py-3 px-4 text-right">Total</th>
                  <th className="py-3 px-4">Payment</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {sales.map((sale) => (
                  <tr key={sale.id} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-mono text-xs text-slate-700 whitespace-nowrap">
                      {sale.receiptNumber}
                    </td>
                    <td className="py-3 px-4 font-semibold text-slate-900">
                      {sale.productName}
                      {sale.customerName && (
                        <span className="block text-xs font-normal text-slate-500">
                          Customer: {sale.customerName}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right tabular-nums text-slate-700">
                      {sale.quantity}
                    </td>
                    <td className="py-3 px-4 text-right font-semibold tabular-nums text-slate-900">
                      {formatPKR(sale.totalAmount)}
                    </td>
                    <td className="py-3 px-4 text-xs font-medium text-slate-700 capitalize">
                      {sale.paymentMethod}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-500 whitespace-nowrap">
                      {formatDateTime(sale.createdAt)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setReceiptSale(sale);
                          setDownloadedReceipt(false);
                        }}
                        className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 whitespace-nowrap cursor-pointer"
                      >
                        Digital Receipt
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Digital Receipt Modal */}
      {receiptSale && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                Digital Receipt · Digital Raseed
              </h3>
              <button
                type="button"
                onClick={() => setReceiptSale(null)}
                aria-label="Close receipt"
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-6 space-y-4 font-mono text-sm">
              <div className="text-center border-b border-dashed border-slate-300 pb-4">
                <p className="text-base font-bold text-slate-900 font-sans">
                  {profile.shopName || 'Dukaan Dost — Apni Dukaan'}
                </p>
                {profile.cityAddress && (
                  <p className="text-xs text-slate-500 font-sans mt-0.5">{profile.cityAddress}</p>
                )}
                {profile.phone && (
                  <p className="text-xs text-slate-500 mt-0.5">{profile.phone}</p>
                )}
                <p className="text-xs text-slate-500 mt-2">
                  Receipt: {receiptSale.receiptNumber} · {formatDateTime(receiptSale.createdAt)}
                </p>
              </div>

              <div className="space-y-2 border-b border-dashed border-slate-300 pb-4">
                <div className="flex justify-between gap-4">
                  <span className="text-slate-600">Item</span>
                  <span className="font-semibold text-slate-900 text-right">
                    {receiptSale.productName}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-slate-600">Qty × Unit Price</span>
                  <span className="tabular-nums text-slate-900">
                    {receiptSale.quantity} × {formatPKR(receiptSale.unitPrice)}
                  </span>
                </div>
                {receiptSale.customerName && (
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-600">Customer</span>
                    <span className="font-semibold text-slate-900">{receiptSale.customerName}</span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex justify-between gap-4 text-base font-bold text-slate-900">
                  <span>Total Bill</span>
                  <span className="tabular-nums">{formatPKR(receiptSale.totalAmount)}</span>
                </div>
                <div className="flex justify-between gap-4 text-emerald-700">
                  <span>Amount Paid ({receiptSale.paymentMethod})</span>
                  <span className="tabular-nums">{formatPKR(receiptSale.amountPaid)}</span>
                </div>
                {receiptSale.creditAmount > 0 && (
                  <div className="flex justify-between gap-4 text-amber-700 font-semibold">
                    <span>Udhaar Balance</span>
                    <span className="tabular-nums">{formatPKR(receiptSale.creditAmount)}</span>
                  </div>
                )}
              </div>

              <p className="text-center text-xs text-slate-500 pt-2 font-sans">
                Shukriya! Dobara tashreef laayein.
              </p>
            </div>

            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center gap-2.5">
              <button
                type="button"
                onClick={() => void handleCopyReceipt()}
                className="min-h-[44px] inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-800 text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                {copiedReceipt ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-700" aria-hidden="true" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" aria-hidden="true" />
                    <span>Copy Text</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handleDownloadReceipt}
                className="flex-1 min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                {downloadedReceipt ? (
                  <>
                    <Check className="w-4 h-4" aria-hidden="true" />
                    <span>Downloaded</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" aria-hidden="true" />
                    <span>Download Receipt</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setReceiptSale(null)}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-sm font-semibold whitespace-nowrap shrink-0 cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
