import React, { Suspense, lazy, useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  EyeOff,
  Save,
  CheckSquare,
  Square,
  Star,
  Lock,
  Copy,
  AlertTriangle,
  SlidersHorizontal,
  Download,
  Upload,
} from 'lucide-react';
import { AdminProduct, Brand, Category, Product, StockStatus } from '../../types';
import { dataService } from '../../services/dataService';
import { formatNaira } from '../../lib/utils';
import { downloadCsvFile } from '../../lib/csvParser';
import { generateBulkProductTemplateCsv } from '../../lib/bulkImport';
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  deriveStockStatusFromQuantity,
  inferSeedStockQuantity,
  isProductBelowThreshold,
  isProductOutOfStock,
  normalizeLowStockThreshold,
} from '../../lib/inventory';
import { StockBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { useToast } from '../../components/ui/Toast';
import { ProductImage } from '../../components/ui/ProductImage';
import { usePermissions } from '../../context/PermissionsContext';

const BulkImportModal = lazy(() =>
  import('../../components/admin/BulkImportModal').then(m => ({ default: m.BulkImportModal }))
);

export default function ProductsList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const { can } = usePermissions();
  const canViewPrices = can('products.view_prices');
  const canCreate = can('products.create');
  const canEditPrice = can('products.edit_price');
  const canEditStock = can('products.edit_stock');
  const canToggleVisibility = can('products.toggle_visibility');
  const canBulkEdit = can('products.bulk_edit');
  const canDelete = can('products.delete');
  const canEditThreshold = canEditStock || can('settings.edit');
  const canOpenEditPage =
    can('products.edit') ||
    can('products.edit_images') ||
    canEditPrice ||
    canEditStock ||
    canToggleVisibility;

  const {
    data: products = [],
    isLoading: loadingProducts,
    isError: isProductsError,
    error: productsError,
    refetch: refetchProducts,
  } = useQuery<AdminProduct[]>({
    queryKey: ['admin-products'],
    queryFn: () => dataService.getAdminProducts(),
    staleTime: 1000 * 60,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories', false],
    queryFn: () => dataService.getCategories(false),
    staleTime: 1000 * 60 * 5,
  });

  const { data: brands = [] } = useQuery<Brand[]>({
    queryKey: ['brands', 'all'],
    queryFn: () => dataService.getBrands(),
    staleTime: 1000 * 60 * 5,
  });

  const { data: fetchedThreshold } = useQuery<number>({
    queryKey: ['low-stock-threshold'],
    queryFn: () => dataService.getLowStockThreshold(),
    staleTime: 1000 * 60 * 5,
  });

  const isLoading = loadingProducts && products.length === 0;

  // Low-stock threshold & filtering
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(DEFAULT_LOW_STOCK_THRESHOLD);
  const [thresholdInput, setThresholdInput] = useState<string>(String(DEFAULT_LOW_STOCK_THRESHOLD));
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);
  const [lowStockOnly, setLowStockOnly] = useState<boolean>(searchParams.get('alerts') === '1');

  useEffect(() => {
    if (typeof fetchedThreshold === 'number') {
      setLowStockThreshold(fetchedThreshold);
      setThresholdInput(String(fetchedThreshold));
    }
  }, [fetchedThreshold]);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');

  // Inline editing state
  const [inlineEdits, setInlineEdits] = useState<
    Record<string, { price?: number; stock_quantity?: number; stock_status?: StockStatus }>
  >({});
  const [savingId, setSavingId] = useState<string | null>(null);

  // Bulk Selection & Bulk Price Adjust
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkPriceInput, setBulkPriceInput] = useState('');
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [deleteTargetIds, setDeleteTargetIds] = useState<string[]>([]);
  const [bulkImportOpen, setBulkImportOpen] = useState(false);

  const { success, error: toastError } = useToast();

  useEffect(() => {
    setLowStockOnly(searchParams.get('alerts') === '1');
  }, [searchParams]);

  const loadData = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
      queryClient.invalidateQueries({ queryKey: ['categories', false] }),
      queryClient.invalidateQueries({ queryKey: ['brands', 'all'] }),
      queryClient.invalidateQueries({ queryKey: ['low-stock-threshold'] }),
      queryClient.invalidateQueries({ queryKey: ['catalog-products'] }),
    ]);
  };

  // Available brand names for dropdown (scoped to selected category if filtered)
  const brandNamesSet = new Map<string, string>();
  brands
    .filter(b => categoryFilter === 'all' || b.category_id === categoryFilter)
    .forEach(b => {
      brandNamesSet.set(b.name.toLowerCase(), b.name);
    });
  products
    .filter(p => (categoryFilter === 'all' || p.category_id === categoryFilter) && p.brand)
    .forEach(p => {
      const clean = p.brand!.trim();
      if (clean && !brandNamesSet.has(clean.toLowerCase())) {
        brandNamesSet.set(clean.toLowerCase(), clean);
      }
    });
  const availableBrands = Array.from(brandNamesSet.values()).sort((a, b) => a.localeCompare(b));

  const belowThresholdProducts = products.filter(p =>
    isProductBelowThreshold(p, lowStockThreshold)
  );
  const belowThresholdCount = belowThresholdProducts.length;

  // Filter products in memory (preserving newest-first created_at order)
  const filteredProducts = products.filter(p => {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand && p.brand.toLowerCase().includes(search.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(search.toLowerCase()));

    const matchesCategory = categoryFilter === 'all' || p.category_id === categoryFilter;

    const matchesBrand =
      brandFilter === 'all' || (p.brand && p.brand.toLowerCase() === brandFilter.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && p.is_active) ||
      (statusFilter === 'inactive' && !p.is_active);

    const matchesLowStock = !lowStockOnly || isProductBelowThreshold(p, lowStockThreshold);

    return matchesSearch && matchesCategory && matchesBrand && matchesStatus && matchesLowStock;
  });

  const handleToggleLowStockOnly = () => {
    const next = !lowStockOnly;
    setLowStockOnly(next);
    const nextParams = new URLSearchParams(searchParams);
    if (next) {
      nextParams.set('alerts', '1');
    } else {
      nextParams.delete('alerts');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const handleApplyThreshold = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditThreshold) return;
    const normalized = normalizeLowStockThreshold(thresholdInput, lowStockThreshold);
    setIsSavingThreshold(true);
    try {
      const saved = await dataService.updateLowStockThreshold(normalized);
      setLowStockThreshold(saved);
      setThresholdInput(String(saved));
      queryClient.setQueryData(['low-stock-threshold'], saved);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
        queryClient.invalidateQueries({ queryKey: ['company-settings'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] }),
      ]);
      success(`Low-stock alert threshold updated to below ${saved} units.`);
    } catch (err: any) {
      toastError(err?.message || 'Failed to update threshold.');
    } finally {
      setIsSavingThreshold(false);
    }
  };

  // Handle inline change
  const handleInlineChange = (
    productId: string,
    field: 'price' | 'stock_quantity' | 'stock_status',
    value: any
  ) => {
    if (field === 'price' && !canEditPrice) return;
    if ((field === 'stock_quantity' || field === 'stock_status') && !canEditStock) return;

    const current = inlineEdits[productId] || {};
    if (field === 'stock_quantity') {
      const qty = Math.max(0, Math.floor(Number(value) || 0));
      setInlineEdits({
        ...inlineEdits,
        [productId]: {
          ...current,
          stock_quantity: qty,
          stock_status: deriveStockStatusFromQuantity(qty, lowStockThreshold),
        },
      });
      return;
    }

    setInlineEdits({
      ...inlineEdits,
      [productId]: {
        ...current,
        [field]: field === 'price' ? Math.max(0, parseFloat(value) || 0) : value,
      },
    });
  };

  // Save inline edits (send ONLY columns user can modify)
  const handleSaveInline = async (productId: string) => {
    const edits = inlineEdits[productId];
    const original = products.find(p => p.id === productId);
    if (!edits || !original) return;

    const origQty = original.stock_quantity ?? inferSeedStockQuantity(original.stock_status);
    const updates: Partial<Product> = {};
    if (canEditPrice && edits.price !== undefined && edits.price !== original.price) {
      updates.price = edits.price;
    }
    if (canEditStock && edits.stock_quantity !== undefined && edits.stock_quantity !== origQty) {
      updates.stock_quantity = edits.stock_quantity;
    }
    if (canEditStock && edits.stock_status !== undefined && edits.stock_status !== original.stock_status) {
      updates.stock_status = edits.stock_status;
    }

    if (Object.keys(updates).length === 0) {
      const cleaned = { ...inlineEdits };
      delete cleaned[productId];
      setInlineEdits(cleaned);
      return;
    }

    setSavingId(productId);
    try {
      const updated = await dataService.updateProduct(productId, updates);
      queryClient.setQueryData<AdminProduct[]>(['admin-products'], prev =>
        (prev || []).map(p => (p.id === productId ? updated : p))
      );

      const remaining = { ...inlineEdits };
      delete remaining[productId];
      setInlineEdits(remaining);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] }),
        queryClient.invalidateQueries({ queryKey: ['catalog-products'] }),
      ]);
      success('Product updated successfully.');
    } catch (err: any) {
      toastError(err.message || 'Failed to save changes.');
    } finally {
      setSavingId(null);
    }
  };

  // Selection helpers
  const showSelectionColumn = canBulkEdit && (canToggleVisibility || canDelete || canEditPrice || canEditStock);

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredProducts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredProducts.map(p => p.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));
  };

  // Bulk actions
  const handleBulkActivate = async (isActive: boolean) => {
    if (selectedIds.length === 0 || !canBulkEdit || !canToggleVisibility) return;
    try {
      await dataService.bulkUpdateProducts(selectedIds, { is_active: isActive });
      queryClient.setQueryData<AdminProduct[]>(['admin-products'], prev =>
        (prev || []).map(p => (selectedIds.includes(p.id) ? { ...p, is_active: isActive } : p))
      );
      await queryClient.invalidateQueries({ queryKey: ['catalog-products'] });
      success(`${selectedIds.length} products ${isActive ? 'activated' : 'hidden'}.`);
      setSelectedIds([]);
    } catch (err: any) {
      toastError(err.message || 'Bulk update failed.');
    }
  };

  const handleBulkPriceApply = async () => {
    if (selectedIds.length === 0 || !canBulkEdit || !canEditPrice) return;
    const numericPrice = parseFloat(bulkPriceInput);
    if (isNaN(numericPrice) || numericPrice < 0) {
      toastError('Enter a valid non-negative price.');
      return;
    }
    try {
      await dataService.bulkUpdateProducts(selectedIds, { price: numericPrice });
      queryClient.setQueryData<AdminProduct[]>(['admin-products'], prev =>
        (prev || []).map(p => (selectedIds.includes(p.id) ? { ...p, price: numericPrice } : p))
      );
      await queryClient.invalidateQueries({ queryKey: ['catalog-products'] });
      success(`Updated price to ${formatNaira(numericPrice)} for ${selectedIds.length} product(s).`);
      setBulkPriceInput('');
      setSelectedIds([]);
    } catch (err: any) {
      toastError(err.message || 'Bulk price update failed.');
    }
  };

  const triggerDelete = (ids: string[]) => {
    if (!canDelete) return;
    setDeleteTargetIds(ids);
    setConfirmDeleteOpen(true);
  };

  const handleConfirmDelete = async () => {
    try {
      if (deleteTargetIds.length === 1) {
        await dataService.deleteProduct(deleteTargetIds[0]);
      } else {
        await dataService.bulkDeleteProducts(deleteTargetIds);
      }
      queryClient.setQueryData<AdminProduct[]>(['admin-products'], prev =>
        (prev || []).filter(p => !deleteTargetIds.includes(p.id))
      );
      setSelectedIds(prev => prev.filter(id => !deleteTargetIds.includes(id)));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin-products'] }),
        queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] }),
        queryClient.invalidateQueries({ queryKey: ['catalog-products'] }),
      ]);
      success(`Successfully deleted ${deleteTargetIds.length} product(s).`);
    } catch (err: any) {
      toastError(err.message || 'Failed to delete products.');
    } finally {
      setConfirmDeleteOpen(false);
      setDeleteTargetIds([]);
    }
  };

  const categoryMap = new Map(categories.map(c => [c.id, c.name]));

  return (
    <div className="space-y-6">
      {/* Page Title & Add Action */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
            Catalogue Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage solar equipment wholesale listings, adjust prices, edit stock levels, and upload product photos.
          </p>
        </div>

        {canCreate && (
          <div className="flex flex-wrap items-center gap-2.5 self-start lg:self-auto shrink-0">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() =>
                downloadCsvFile('bulk-products-template.csv', generateBulkProductTemplateCsv())
              }
              className="gap-2 bg-white font-bold text-xs sm:text-sm"
            >
              <Download className="w-4 h-4 text-[#187004]" />
              <span>Download Bulk Template</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => setBulkImportOpen(true)}
              className="gap-2 bg-white border-[#187004]/40 text-[#187004] hover:bg-emerald-50 font-bold text-xs sm:text-sm"
            >
              <Upload className="w-4 h-4" />
              <span>Bulk Import CSV</span>
            </Button>

            <Link
              to="/admin/products/new"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#187004] hover:bg-[#0e3e03] text-white text-xs sm:text-sm font-bold shadow-xs transition-colors"
            >
              <Plus className="w-4 h-4 text-[#F5A623]" />
              <span>Add Product</span>
            </Link>
          </div>
        )}
      </div>

      {/* Search, Filter, and Bulk Actions Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, brand, or SKU..."
              className="w-full min-h-[40px] pl-10 pr-4 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-[#187004]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={e => {
                setCategoryFilter(e.target.value);
                setBrandFilter('all');
              }}
              aria-label="Filter by category"
              className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-white"
            >
              <option value="all">All Allowed Categories</option>
              {categories.map(cat => (
                <option key={cat.id} value={cat.id}>
                  {cat.name}
                </option>
              ))}
            </select>

            <select
              value={brandFilter}
              onChange={e => setBrandFilter(e.target.value)}
              aria-label="Filter by brand"
              className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-white"
            >
              <option value="all">All Brands</option>
              {availableBrands.map(brand => (
                <option key={brand} value={brand}>
                  {brand}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value as any)}
              aria-label="Filter by active status"
              className="min-h-[40px] px-3 py-2 rounded-xl border border-slate-300 text-xs sm:text-sm font-semibold bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active Only</option>
              <option value="inactive">Hidden Only</option>
            </select>
          </div>
        </div>

        {/* Low-Stock Alert Filter & Customizable Threshold Bar */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={handleToggleLowStockOnly}
              aria-pressed={lowStockOnly}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-colors cursor-pointer ${
                lowStockOnly
                  ? 'bg-orange-600 text-white border-orange-700 shadow-xs'
                  : belowThresholdCount > 0
                  ? 'bg-orange-50 text-orange-900 border-orange-300 hover:bg-orange-100'
                  : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <AlertTriangle className={`w-3.5 h-3.5 ${lowStockOnly ? 'text-white' : 'text-orange-600'}`} />
              <span>
                Low-Stock Alerts ({belowThresholdCount})
              </span>
              {lowStockOnly && <span className="text-[10px] uppercase tracking-wider opacity-90">• Filtered</span>}
            </button>

            <span className="text-xs text-slate-500">
              {belowThresholdCount > 0
                ? `${belowThresholdCount} product(s) currently below ${lowStockThreshold} units.`
                : `All products have at least ${lowStockThreshold} units.`}
            </span>
          </div>

          <form onSubmit={handleApplyThreshold} className="flex flex-wrap items-center gap-2">
            <label
              htmlFor="low-stock-threshold-input"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-400" />
              <span>Alert threshold: below</span>
            </label>
            <input
              id="low-stock-threshold-input"
              type="number"
              min="1"
              max="100000"
              step="1"
              disabled={!canEditThreshold}
              value={thresholdInput}
              onChange={e => setThresholdInput(e.target.value)}
              aria-label="Low-stock alert threshold in units"
              className="w-20 px-2.5 py-1.5 rounded-lg border border-slate-300 text-xs font-bold text-slate-900 tabular-nums bg-white focus:outline-none focus:ring-2 focus:ring-[#187004] disabled:bg-slate-100"
            />
            <span className="text-xs text-slate-500 font-medium">units</span>
            {canEditThreshold && (
              <Button
                type="submit"
                size="sm"
                variant="outline"
                isLoading={isSavingThreshold}
                className="text-xs py-1 px-2.5 h-8 font-bold"
              >
                Apply
              </Button>
            )}
          </form>
        </div>

        {/* Bulk Action Controls */}
        {showSelectionColumn && selectedIds.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-amber-50/70 border border-amber-200 text-xs font-semibold animate-in fade-in">
            <span className="text-amber-900 font-bold">
              {selectedIds.length} {selectedIds.length === 1 ? 'item' : 'items'} selected
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {canEditPrice && (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min="0"
                    step="500"
                    placeholder="Set price ₦"
                    value={bulkPriceInput}
                    onChange={e => setBulkPriceInput(e.target.value)}
                    aria-label="Bulk price amount"
                    className="w-28 px-2.5 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-bold"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleBulkPriceApply}
                    className="text-xs py-1"
                  >
                    Apply Price
                  </Button>
                </div>
              )}
              {canToggleVisibility && (
                <>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkActivate(true)}
                    className="text-xs py-1"
                  >
                    <Eye className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                    Activate
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => handleBulkActivate(false)}
                    className="text-xs py-1"
                  >
                    <EyeOff className="w-3.5 h-3.5 mr-1 text-slate-500" />
                    Hide
                  </Button>
                </>
              )}
              {canDelete && (
                <Button
                  type="button"
                  size="sm"
                  variant="danger"
                  onClick={() => triggerDelete(selectedIds)}
                  className="text-xs py-1"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  Delete Selected
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {isLoading ? (
          <div className="p-8 space-y-4">
            {[1, 2, 3, 4, 5].map(n => (
              <div key={n} className="h-14 bg-slate-100 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : isProductsError && products.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-red-50 text-red-600">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <p className="text-sm font-bold text-slate-900">Failed to load products from the server</p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              {(productsError as any)?.message || 'Please check your connection or session and try again.'}
            </p>
            <Button type="button" variant="outline" size="sm" onClick={() => refetchProducts()}>
              Retry Loading Products
            </Button>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="p-12 text-center text-slate-500 text-sm">
            No products match the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider font-bold border-b border-slate-200">
                <tr>
                  {showSelectionColumn && (
                    <th className="px-3 py-3.5 w-9 text-center">
                      <button
                        type="button"
                        onClick={toggleSelectAll}
                        aria-label="Select all products"
                        className="text-slate-400 hover:text-slate-700"
                      >
                        {selectedIds.length === filteredProducts.length && filteredProducts.length > 0 ? (
                          <CheckSquare className="w-4 h-4 text-[#187004]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="px-3 py-3.5">Product</th>
                  <th className="px-3 py-3.5">Category</th>
                  <th className="px-3 py-3.5">Price (₦)</th>
                  <th className="px-3 py-3.5">Qty</th>
                  <th className="px-3 py-3.5">Stock Status</th>
                  <th className="px-3 py-3.5">Active</th>
                  {(canOpenEditPage || canCreate || canDelete || canEditPrice || canEditStock) && (
                    <th className="px-3 py-3.5 text-right">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {filteredProducts.map(product => {
                  const isSelected = selectedIds.includes(product.id);
                  const inline = inlineEdits[product.id];
                  const origQty = product.stock_quantity ?? inferSeedStockQuantity(product.stock_status);
                  const currentPrice = inline?.price !== undefined ? inline.price : product.price;
                  const currentQty = inline?.stock_quantity !== undefined ? inline.stock_quantity : origQty;
                  const currentStock = inline?.stock_status !== undefined ? inline.stock_status : product.stock_status;
                  const isModified = Boolean(
                    inline &&
                      ((canEditPrice && inline.price !== undefined && inline.price !== product.price) ||
                        (canEditStock && inline.stock_quantity !== undefined && inline.stock_quantity !== origQty) ||
                        (canEditStock && inline.stock_status !== undefined && inline.stock_status !== product.stock_status))
                  );
                  const isSaving = savingId === product.id;

                  // Highlight based on live/inline inventory level against customizable threshold
                  const effectiveProduct = {
                    ...product,
                    stock_quantity: currentQty,
                    stock_status: currentStock,
                  };
                  const isOut = isProductOutOfStock(effectiveProduct);
                  const isLowAlert = isProductBelowThreshold(effectiveProduct, lowStockThreshold);

                  const rowHighlightClass = isOut
                    ? 'bg-red-50/80 hover:bg-red-50 border-l-4 border-l-red-500'
                    : isLowAlert
                    ? 'bg-orange-50/80 hover:bg-orange-50 border-l-4 border-l-orange-500'
                    : 'hover:bg-slate-50/70';

                  return (
                    <tr
                      key={product.id}
                      data-low-stock={isLowAlert ? 'true' : 'false'}
                      className={`transition-colors ${rowHighlightClass} ${
                        isSelected ? 'ring-1 ring-inset ring-orange-400' : ''
                      }`}
                    >
                      {showSelectionColumn && (
                        <td className="px-3 py-3.5 text-center">
                          <button
                            type="button"
                            onClick={() => toggleSelectOne(product.id)}
                            aria-label={`Select ${product.name}`}
                            className="text-slate-400 hover:text-slate-700"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-[#187004]" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                      )}

                      <td className="px-3 py-3.5">
                        <div className="flex items-center gap-3">
                          <ProductImage
                            src={product.images[0] || 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80'}
                            alt={product.name}
                            className="w-11 h-11 rounded-xl object-cover bg-slate-100 border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-bold text-slate-900 truncate max-w-[220px] block font-heading">
                                {product.name}
                              </span>
                              {product.is_featured && (
                                <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500 shrink-0" />
                              )}
                            </div>
                            <span className="text-xs text-slate-500 font-mono block">
                              {product.brand || 'CEO POWER'} {product.sku ? `• ${product.sku}` : ''}
                            </span>
                            {isLowAlert && (
                              <span
                                className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-md text-[11px] font-bold border ${
                                  isOut
                                    ? 'bg-red-100 text-red-800 border-red-200'
                                    : 'bg-orange-100 text-orange-900 border-orange-300'
                                }`}
                              >
                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                <span>
                                  {isOut
                                    ? 'Out of stock (0 units)'
                                    : `Low stock alert (${currentQty} < ${lowStockThreshold} units)`}
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-3 py-3.5 text-xs font-semibold text-slate-600 whitespace-nowrap">
                        {categoryMap.get(product.category_id) || 'General'}
                      </td>

                      {/* Trade Price Cell (Hidden when permission missing or price is null) */}
                      <td className="px-3 py-3.5">
                        {!canViewPrices || product.price === null ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 text-xs font-semibold">
                            <Lock className="w-3 h-3" />
                            Hidden
                          </span>
                        ) : canEditPrice ? (
                          <div className="flex items-center gap-1">
                            <span className="text-xs font-bold text-slate-400">₦</span>
                            <input
                              type="number"
                              min="0"
                              step="500"
                              aria-label={`Price for ${product.name}`}
                              value={currentPrice ?? 0}
                              onChange={e => handleInlineChange(product.id, 'price', e.target.value)}
                              className="w-24 px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-bold text-slate-800 tabular-nums focus:outline-none focus:ring-1 focus:ring-[#187004] bg-white"
                            />
                          </div>
                        ) : (
                          <span className="font-bold text-slate-800 tabular-nums">
                            {formatNaira(product.price)}
                          </span>
                        )}
                      </td>

                      {/* Inventory Quantity Cell */}
                      <td className="px-3 py-3.5">
                        {canEditStock ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              aria-label={`Inventory quantity for ${product.name}`}
                              value={currentQty}
                              onChange={e => handleInlineChange(product.id, 'stock_quantity', e.target.value)}
                              className={`w-16 px-2 py-1.5 rounded-lg border text-xs font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-[#187004] bg-white ${
                                isOut
                                  ? 'border-red-300 text-red-800'
                                  : isLowAlert
                                  ? 'border-orange-400 text-orange-900'
                                  : 'border-slate-200 text-slate-800'
                              }`}
                            />
                            <span className="text-[11px] text-slate-500">u</span>
                          </div>
                        ) : (
                          <span
                            className={`font-bold tabular-nums text-xs ${
                              isOut
                                ? 'text-red-700'
                                : isLowAlert
                                ? 'text-orange-800'
                                : 'text-slate-700'
                            }`}
                          >
                            {currentQty} u
                          </span>
                        )}
                      </td>

                      {/* Stock Status Cell */}
                      <td className="px-3 py-3.5">
                        {canEditStock ? (
                          <select
                            aria-label={`Stock status for ${product.name}`}
                            value={currentStock}
                            onChange={e => handleInlineChange(product.id, 'stock_status', e.target.value)}
                            className="px-2 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white focus:outline-none focus:ring-1 focus:ring-[#187004]"
                          >
                            <option value="in_stock">In Stock</option>
                            <option value="low_stock">Low Stock</option>
                            <option value="out_of_stock">Out of Stock</option>
                          </select>
                        ) : (
                          <StockBadge status={product.stock_status} />
                        )}
                      </td>

                      {/* Active Status Badge */}
                      <td className="px-3 py-3.5">
                        {product.is_active ? (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-green-50 text-green-700 border border-green-200">
                            Active
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            Hidden
                          </span>
                        )}
                      </td>

                      {(canOpenEditPage || canCreate || canDelete || canEditPrice || canEditStock) && (
                        <td className="px-3 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {isModified && (
                              <Button
                                type="button"
                                size="sm"
                                variant="primary"
                                isLoading={isSaving}
                                onClick={() => handleSaveInline(product.id)}
                                className="text-xs py-1 px-2.5 h-8 gap-1 font-bold"
                              >
                                <Save className="w-3.5 h-3.5" />
                                <span>Save</span>
                              </Button>
                            )}
                            {canCreate && (
                              <button
                                type="button"
                                onClick={() => navigate(`/admin/products/new?duplicate=${product.id}`)}
                                className="p-1.5 text-slate-400 hover:text-[#187004] hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                                title="Duplicate Product"
                                aria-label={`Duplicate ${product.name}`}
                              >
                                <Copy className="w-4 h-4" />
                              </button>
                            )}
                            {canOpenEditPage && (
                              <Link
                                to={`/admin/products/${product.id}`}
                                className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
                                title="Edit Product Details"
                                aria-label={`Edit ${product.name}`}
                              >
                                <Edit2 className="w-4 h-4" />
                              </Link>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                onClick={() => triggerDelete([product.id])}
                                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                                title="Delete Product"
                                aria-label={`Delete ${product.name}`}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={confirmDeleteOpen}
        title="Delete Product Listing?"
        description={`Are you sure you want to permanently delete ${deleteTargetIds.length} product(s)? This action cannot be undone.`}
        confirmText="Yes, Delete"
        variant="danger"
        onConfirm={handleConfirmDelete}
        onCancel={() => setConfirmDeleteOpen(false)}
      />

      {/* Bulk Product Import Modal (lazy-loaded on open) */}
      {canCreate && bulkImportOpen && (
        <Suspense fallback={null}>
          <BulkImportModal
            isOpen={bulkImportOpen}
            onClose={() => setBulkImportOpen(false)}
            onImportComplete={async () => {
              await loadData();
              await queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
            }}
            categories={categories}
            brands={brands}
            existingProducts={products}
          />
        </Suspense>
      )}
    </div>
  );
}
