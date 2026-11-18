import {
  AlertCircle,
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Package,
  PackagePlus,
  Pencil,
  Plus,
  Search,
  X,
  XCircle,
} from 'lucide-react';
import type {FormEvent} from 'react';
import {useMemo, useState} from 'react';
import type {Product} from '../../types/shop';
import {
  EXPIRY_WARNING_DAYS,
  formatPKR,
  formatShortDate,
  getDaysUntilExpiry,
} from '../../utils/format';
import {EmptyState} from '../EmptyState';

interface InventoryViewProps {
  inventory: Product[];
  onAddProduct: (payload: {
    name: string;
    category: string;
    stockQuantity: number;
    purchasePrice: number | null;
    sellingPrice: number;
    lowStockThreshold: number;
    expiryDate: string | null;
  }) => Promise<void>;
  onUpdateProduct: (
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
  ) => Promise<void>;
  onAddStock: (productId: string, addQuantity: number) => Promise<void>;
}

function getStockStatus(product: Product) {
  if (product.stockQuantity <= 0) {
    return {
      label: 'Out of Stock',
      icon: XCircle,
      classes: 'bg-red-50 text-red-800 border-red-200',
    };
  }
  if (product.stockQuantity <= product.lowStockThreshold) {
    return {
      label: 'Low Stock',
      icon: AlertTriangle,
      classes: 'bg-amber-50 text-amber-800 border-amber-200',
    };
  }
  return {
    label: 'In Stock',
    icon: CheckCircle2,
    classes: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  };
}

function getExpiryStatus(expiryDate?: string | null) {
  if (!expiryDate) return null;
  const days = getDaysUntilExpiry(expiryDate);
  if (days === null) return null;

  if (days < 0) {
    return {
      days,
      isUrgent: true,
      badgeLabel: `Expired (${Math.abs(days)}d ago) · Order New`,
      shortLabel: `Expired ${Math.abs(days)}d ago`,
      badgeClasses: 'bg-red-100 text-red-900 border-red-300',
    };
  }
  if (days === 0) {
    return {
      days,
      isUrgent: true,
      badgeLabel: 'Expires Today · Order New',
      shortLabel: 'Expires today',
      badgeClasses: 'bg-red-100 text-red-900 border-red-300',
    };
  }
  if (days <= EXPIRY_WARNING_DAYS) {
    return {
      days,
      isUrgent: true,
      badgeLabel: `Expiry Near (${days}d) · Order Items`,
      shortLabel: `Expires in ${days} day${days === 1 ? '' : 's'}`,
      badgeClasses: 'bg-red-50 text-red-800 border-red-300',
    };
  }
  return {
    days,
    isUrgent: false,
    badgeLabel: `${days} days left`,
    shortLabel: `${days} days left`,
    badgeClasses: 'bg-slate-50 text-slate-700 border-slate-200',
  };
}

export function InventoryView({
  inventory,
  onAddProduct,
  onUpdateProduct,
  onAddStock,
}: InventoryViewProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('Grains & Flour');
  const [stockQuantity, setStockQuantity] = useState('0');
  const [purchasePrice, setPurchasePrice] = useState('');
  const [sellingPrice, setSellingPrice] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [expiryDate, setExpiryDate] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [restockProduct, setRestockProduct] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState('10');
  const [isRestocking, setIsRestocking] = useState(false);

  const expiringAlerts = useMemo(() => {
    return inventory
      .map((product) => ({
        product,
        expiry: getExpiryStatus(product.expiryDate),
      }))
      .filter(
        (entry): entry is {product: Product; expiry: NonNullable<ReturnType<typeof getExpiryStatus>>} =>
          Boolean(entry.expiry && entry.expiry.isUrgent),
      )
      .sort((a, b) => a.expiry.days - b.expiry.days);
  }, [inventory]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return inventory;
    return inventory.filter(
      (p) =>
        p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q),
    );
  }, [inventory, searchQuery]);

  const resetForm = () => {
    setEditingProductId(null);
    setName('');
    setCategory('Grains & Flour');
    setStockQuantity('0');
    setPurchasePrice('');
    setSellingPrice('0');
    setLowStockThreshold('5');
    setExpiryDate('');
    setFormError(null);
  };

  const openAddForm = () => {
    resetForm();
    setShowAddForm(true);
  };

  const openEditForm = (product: Product) => {
    setEditingProductId(product.id);
    setName(product.name);
    setCategory(product.category);
    setStockQuantity(String(product.stockQuantity));
    setPurchasePrice(product.purchasePrice !== null ? String(product.purchasePrice) : '');
    setSellingPrice(String(product.sellingPrice));
    setLowStockThreshold(String(product.lowStockThreshold));
    setExpiryDate(product.expiryDate ?? '');
    setFormError(null);
    setShowAddForm(true);
  };

  const handleFormSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError(null);
    if (!name.trim()) {
      setFormError('Product name is required.');
      return;
    }

    const payload = {
      name: name.trim(),
      category: category.trim() || 'General Kiryana',
      stockQuantity: Math.max(0, Number(stockQuantity) || 0),
      purchasePrice: purchasePrice.trim() === '' ? null : Math.max(0, Number(purchasePrice) || 0),
      sellingPrice: Math.max(0, Number(sellingPrice) || 0),
      lowStockThreshold: Math.max(0, Number(lowStockThreshold) || 5),
      expiryDate: expiryDate.trim() === '' ? null : expiryDate.trim(),
    };

    setIsSubmitting(true);
    try {
      if (editingProductId) {
        await onUpdateProduct(editingProductId, payload);
      } else {
        await onAddProduct(payload);
      }
      resetForm();
      setShowAddForm(false);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to save product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRestockSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!restockProduct) return;
    const qty = Number(restockQty);
    if (!Number.isFinite(qty) || qty <= 0) return;

    setIsRestocking(true);
    try {
      await onAddStock(restockProduct.id, qty);
      setRestockProduct(null);
      setRestockQty('10');
    } finally {
      setIsRestocking(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Inventory / Stock</h1>
          <p className="text-sm text-slate-600 mt-1">
            Dukaan ka samaan, khareed o farokht ki qeemat, expiry dates, aur Smart Stock Prediction
          </p>
        </div>

        <button
          type="button"
          onClick={() => (showAddForm ? setShowAddForm(false) : openAddForm())}
          className="min-h-[44px] inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" aria-hidden="true" />
          <span>{showAddForm ? 'Close Form' : '+ Add Product'}</span>
        </button>
      </div>

      {/* Red Expiry Alert Notice */}
      {expiringAlerts.length > 0 && (
        <div
          role="alert"
          className="bg-red-50 border border-red-300 rounded-xl p-4 sm:p-5 text-red-950 space-y-3"
        >
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-100 border border-red-200 text-red-700 flex items-center justify-center shrink-0">
              <AlertCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-sm sm:text-base font-bold text-red-900">
                Red Expiry Notice · Expiry Date Qareeb Hai ({expiringAlerts.length}{' '}
                {expiringAlerts.length === 1 ? 'item' : 'items'})
              </h2>
              <p className="text-xs sm:text-sm text-red-800 mt-0.5">
                In ashya ki expiry date {EXPIRY_WARNING_DAYS} din ke andar hai ya guzar chuki hai — naya stock jald order karein.
              </p>
            </div>
          </div>

          <div className="divide-y divide-red-200 bg-white border border-red-200 rounded-lg overflow-hidden">
            {expiringAlerts.map(({product, expiry}) => (
              <div
                key={product.id}
                className="px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-3 text-sm"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900">{product.name}</p>
                  <p className="text-xs text-red-800">
                    Expiry: {formatShortDate(product.expiryDate || '')} ({expiry.shortLabel}) · Stock:{' '}
                    <span className="tabular-nums font-semibold">{product.stockQuantity}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => openEditForm(product)}
                    className="min-h-[34px] px-3 py-1 rounded-md bg-red-50 hover:bg-red-100 text-red-900 border border-red-300 text-xs font-semibold whitespace-nowrap cursor-pointer"
                  >
                    Update / New Batch
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Product Form */}
      {showAddForm && (
        <form
          onSubmit={handleFormSubmit}
          className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4"
        >
          <div className="flex items-center gap-2">
            <PackagePlus className="w-5 h-5 text-emerald-700" aria-hidden="true" />
            <h2 className="text-base font-bold text-slate-900">
              {editingProductId ? 'Edit Product Details' : 'Add New Product'}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="prod-name"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Product Name *
              </label>
              <input
                id="prod-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Cheeni (Sugar) 1kg"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="prod-cat"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Category
              </label>
              <select
                id="prod-cat"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              >
                <option value="Grains & Flour">Grains &amp; Flour (Atta / Chawal)</option>
                <option value="Sugar & Tea">Sugar &amp; Tea (Cheeni / Chai)</option>
                <option value="Cooking Oil & Ghee">Cooking Oil &amp; Ghee</option>
                <option value="Dairy & Beverages">Dairy &amp; Beverages</option>
                <option value="Spices & Pulses">Spices &amp; Pulses (Masale / Daalein)</option>
                <option value="Household & Soap">Household &amp; Soap</option>
                <option value="General Kiryana">General Kiryana</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="prod-qty"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Stock Quantity
              </label>
              <input
                id="prod-qty"
                type="number"
                min="0"
                value={stockQuantity}
                onChange={(e) => setStockQuantity(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="prod-purchase"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Purchase Price (Rs. Khareed)
              </label>
              <input
                id="prod-purchase"
                type="number"
                min="0"
                value={purchasePrice}
                onChange={(e) => setPurchasePrice(e.target.value)}
                placeholder="Optional for profit calculation"
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="prod-selling"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Selling Price (Rs. Farokht) *
              </label>
              <input
                id="prod-selling"
                type="number"
                min="0"
                required
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div>
              <label
                htmlFor="prod-threshold"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Low-Stock Threshold
              </label>
              <input
                id="prod-threshold"
                type="number"
                min="0"
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-3">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label
                  htmlFor="prod-expiry"
                  className="block text-sm font-semibold text-slate-800"
                >
                  Expiry Date (Optional · Red alert within {EXPIRY_WARNING_DAYS} days)
                </label>
                {expiryDate && (
                  <button
                    type="button"
                    onClick={() => setExpiryDate('')}
                    className="text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Clear Date
                  </button>
                )}
              </div>
              <input
                id="prod-expiry"
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full sm:max-w-xs min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
              <p className="text-xs text-slate-500 mt-1">
                Doodh, bread, biscuits, masalay waghera ki expiry date darj karein taa-ke waqt par naya maal order ho sake.
              </p>
            </div>
          </div>

          {formError && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {formError}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={isSubmitting}
              className="min-h-[44px] px-5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
            >
              {isSubmitting
                ? 'Saving...'
                : editingProductId
                  ? 'Update Product'
                  : 'Save Product'}
            </button>
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowAddForm(false);
              }}
              className="min-h-[44px] px-4 py-2 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-semibold cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search
          className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2"
          aria-hidden="true"
        />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search products by name or category..."
          aria-label="Search inventory products"
          className="w-full min-h-[44px] pl-10 pr-4 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
        />
      </div>

      {/* Searchable Product Table */}
      <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6">
        {inventory.length === 0 ? (
          <EmptyState
            icon={Package}
            title="No inventory items yet"
            description="No records yet. Add your first Kiryana product above to save it to Cloud Firestore."
            actionLabel="+ Add Product"
            onAction={openAddForm}
          />
        ) : (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4">Product Name</th>
                  <th className="py-3 px-4">Category</th>
                  <th className="py-3 px-4 text-right">Stock Qty</th>
                  <th className="py-3 px-4 text-right">Purchase Price</th>
                  <th className="py-3 px-4 text-right">Selling Price</th>
                  <th className="py-3 px-4">Expiry Date</th>
                  <th className="py-3 px-4">Stock Status</th>
                  <th className="py-3 px-4">Smart Stock Prediction</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-500">
                      No products match your search.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((product) => {
                    const status = getStockStatus(product);
                    const StatusIcon = status.icon;
                    const expiry = getExpiryStatus(product.expiryDate);
                    return (
                      <tr
                        key={product.id}
                        className={expiry?.isUrgent ? 'bg-red-50/40 hover:bg-red-50/70' : 'hover:bg-slate-50/70'}
                      >
                        <td className="py-3 px-4 font-semibold text-slate-900">
                          {product.name}
                        </td>
                        <td className="py-3 px-4 text-slate-600">{product.category}</td>
                        <td className="py-3 px-4 text-right font-semibold tabular-nums text-slate-900">
                          {product.stockQuantity}
                        </td>
                        <td className="py-3 px-4 text-right tabular-nums text-slate-600">
                          {product.purchasePrice !== null
                            ? formatPKR(product.purchasePrice)
                            : 'Not set'}
                        </td>
                        <td className="py-3 px-4 text-right font-semibold tabular-nums text-slate-900">
                          {formatPKR(product.sellingPrice)}
                        </td>
                        <td className="py-3 px-4">
                          {product.expiryDate && expiry ? (
                            <div className="space-y-1">
                              {expiry.isUrgent ? (
                                <span
                                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-semibold whitespace-nowrap ${expiry.badgeClasses}`}
                                >
                                  <CalendarClock className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                                  <span>{expiry.badgeLabel}</span>
                                </span>
                              ) : (
                                <span className="text-xs font-medium text-slate-800 whitespace-nowrap block">
                                  {formatShortDate(product.expiryDate)}
                                </span>
                              )}
                              {expiry.isUrgent && (
                                <span className="block text-[11px] text-red-700 font-medium whitespace-nowrap">
                                  {formatShortDate(product.expiryDate)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-xs text-slate-400">Not set</span>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold whitespace-nowrap ${status.classes}`}
                          >
                            <StatusIcon className="w-3.5 h-3.5" aria-hidden="true" />
                            {status.label}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-600">
                          {product.estimatedDaysRemaining !== null &&
                          product.estimatedDaysRemaining !== undefined ? (
                            <div>
                              <span className="font-semibold text-slate-900 tabular-nums">
                                ~{product.estimatedDaysRemaining} days left
                              </span>
                              <span className="block text-[11px] text-slate-500">
                                {product.dailySalesVelocity}/day · Estimated prediction, not a guarantee
                              </span>
                            </div>
                          ) : (
                            <span className="text-slate-400">No sales velocity yet</span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => openEditForm(product)}
                              className="min-h-[36px] px-2.5 py-1 rounded-md bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" aria-hidden="true" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setRestockProduct(product);
                                setRestockQty('10');
                              }}
                              className="min-h-[36px] px-3 py-1 rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold whitespace-nowrap cursor-pointer"
                            >
                              Add Stock
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Add Stock Modal */}
      {restockProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleRestockSubmit}
            className="w-full max-w-sm bg-white border border-slate-200 rounded-xl p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Add Stock</h3>
              <button
                type="button"
                onClick={() => setRestockProduct(null)}
                aria-label="Close modal"
                className="min-h-[40px] min-w-[40px] inline-flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            </div>
            <p className="text-sm text-slate-600">
              Product: <span className="font-semibold text-slate-900">{restockProduct.name}</span>
              <br />
              Current stock:{' '}
              <span className="tabular-nums font-semibold">{restockProduct.stockQuantity}</span>
            </p>
            <div>
              <label
                htmlFor="restock-qty"
                className="block text-sm font-semibold text-slate-800 mb-1.5"
              >
                Quantity to Add
              </label>
              <input
                id="restock-qty"
                type="number"
                min="1"
                required
                value={restockQty}
                onChange={(e) => setRestockQty(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 text-sm bg-white border border-slate-300 rounded-lg tabular-nums focus:outline-none focus:ring-2 focus:ring-emerald-600"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={isRestocking}
                className="flex-1 min-h-[44px] px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold cursor-pointer"
              >
                {isRestocking ? 'Updating...' : 'Confirm Add Stock'}
              </button>
              <button
                type="button"
                onClick={() => setRestockProduct(null)}
                className="min-h-[44px] px-4 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 text-sm font-semibold cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
