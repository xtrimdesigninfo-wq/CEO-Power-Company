import React, { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowLeft,
  Save,
  Sparkles,
  Package,
  Lock,
  Copy,
  Plus,
  Trash2,
  FileSpreadsheet,
  Upload,
  Download,
  Image as ImageIcon,
  Images,
  X,
} from 'lucide-react';
import { AdminProduct, Brand, Category, Product } from '../../types';
import { dataService } from '../../services/dataService';
import { slugify } from '../../lib/utils';
import { buildDuplicateProductDraft } from '../../lib/productUtils';
import { parseProductCsv, generateSampleProductCsv, downloadCsvFile } from '../../lib/csvParser';
import {
  DEFAULT_LOW_STOCK_THRESHOLD,
  deriveStockStatusFromQuantity,
  inferSeedStockQuantity,
} from '../../lib/inventory';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { ImageUploader } from '../../components/admin/ImageUploader';
import { SpecsEditor } from '../../components/admin/SpecsEditor';
import { useToast } from '../../components/ui/Toast';
import { usePermissions } from '../../context/PermissionsContext';

const productSchema = z.object({
  category_id: z.string().min(1, 'Please select a category'),
  name: z.string().min(2, 'Product name is required'),
  slug: z.string().min(2, 'Slug is required'),
  brand: z.string().optional(),
  sku: z.string().optional(),
  short_description: z.string().optional(),
  price: z.number().min(0, 'Price must be 0 or higher'),
  min_order_qty: z.number().min(1, 'Minimum order quantity must be at least 1'),
  stock_quantity: z.number().int('Must be a whole number').min(0, 'Quantity must be 0 or higher'),
  stock_status: z.enum(['in_stock', 'low_stock', 'out_of_stock']),
  is_active: z.boolean(),
  is_featured: z.boolean(),
});

type ProductFormData = z.infer<typeof productSchema>;

export default function ProductForm() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const duplicateId = searchParams.get('duplicate');
  const isEditing = Boolean(id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { success, error: toastError } = useToast();
  const { can, canAccessCategory } = usePermissions();

  const canViewPrices = can('products.view_prices');
  const canCreate = can('products.create');
  const canEditDetails = !isEditing ? canCreate : can('products.edit');
  const canEditPrice = !isEditing ? canCreate : can('products.edit_price');
  const canEditStock = !isEditing ? canCreate : can('products.edit_stock');
  const canToggleVisibility = !isEditing ? canCreate : can('products.toggle_visibility');
  const canEditImages = !isEditing ? canCreate : can('products.edit_images');
  const canManageBrands = canEditDetails && (can('categories.create_edit') || canCreate);
  const canDeleteBrand = canEditDetails && (can('categories.delete') || can('categories.create_edit'));
  const canSubmitAnyChange =
    !isEditing ||
    canEditDetails ||
    canEditPrice ||
    canEditStock ||
    canToggleVisibility ||
    canEditImages;

  const [categories, setCategories] = useState<Category[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [originalProduct, setOriginalProduct] = useState<AdminProduct | null>(null);
  const [duplicatedFromName, setDuplicatedFromName] = useState<string | null>(null);
  const [duplicateHasHiddenPrice, setDuplicateHasHiddenPrice] = useState(false);

  // Split photos: 1 Featured Image + up to 3 Other Images
  const [featuredImages, setFeaturedImages] = useState<string[]>([]);
  const [otherImages, setOtherImages] = useState<string[]>([]);
  const [specs, setSpecs] = useState<Record<string, string>>({});

  // Inline brand sub-category add state
  const [showAddBrand, setShowAddBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');
  const [isSavingBrand, setIsSavingBrand] = useState(false);
  const [deletingBrandId, setDeletingBrandId] = useState<string | null>(null);

  // Product CSV import state
  const productCsvInputRef = useRef<HTMLInputElement | null>(null);
  const [csvImportSummary, setCsvImportSummary] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(isEditing || Boolean(duplicateId));
  const [lowStockThreshold, setLowStockThreshold] = useState<number>(DEFAULT_LOW_STOCK_THRESHOLD);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      category_id: '',
      name: '',
      slug: '',
      brand: '',
      sku: '',
      short_description: '',
      price: 0,
      min_order_qty: 1,
      stock_quantity: 25,
      stock_status: 'in_stock',
      is_active: true,
      is_featured: false,
    },
  });

  const nameValue = watch('name');
  const selectedCategoryId = watch('category_id');
  const selectedBrandValue = watch('brand') || '';

  const categoryBrands = brands.filter(b => b.category_id === selectedCategoryId);
  const selectedBrandRecord = categoryBrands.find(
    b => b.name.toLowerCase() === selectedBrandValue.trim().toLowerCase()
  );

  useEffect(() => {
    if (!isEditing && nameValue) {
      setValue('slug', slugify(nameValue), { shouldValidate: true });
    }
  }, [nameValue, isEditing, setValue]);

  useEffect(() => {
    async function init() {
      try {
        const [allCats, allBrands, threshold] = await Promise.all([
          dataService.getCategories(false),
          dataService.getBrands(),
          dataService.getLowStockThreshold(),
        ]);
        const cats = allCats.filter(c => canAccessCategory(c.id));
        setCategories(cats);
        setBrands(allBrands);
        setLowStockThreshold(threshold);

        if (isEditing && id) {
          const product = await dataService.getAdminProductById(id);
          if (product) {
            setOriginalProduct(product);
            setDuplicatedFromName(null);
            setDuplicateHasHiddenPrice(false);
            const qty = product.stock_quantity ?? inferSeedStockQuantity(product.stock_status);
            reset({
              category_id: product.category_id,
              name: product.name,
              slug: product.slug,
              brand: product.brand || '',
              sku: product.sku || '',
              short_description: product.short_description || '',
              price: product.price ?? 0,
              min_order_qty: product.min_order_qty || 1,
              stock_quantity: qty,
              stock_status: product.stock_status,
              is_active: product.is_active,
              is_featured: product.is_featured,
            });
            const imgs = product.images || [];
            setFeaturedImages(imgs.slice(0, 1));
            setOtherImages(imgs.slice(1, 4));
            setSpecs(product.specs || {});
          } else {
            toastError('Product not found or outside your category scope.');
            navigate('/admin/products');
          }
        } else if (!isEditing && duplicateId) {
          const [source, existing] = await Promise.all([
            dataService.getAdminProductById(duplicateId),
            dataService.getAdminProducts(),
          ]);
          if (source) {
            const draft = buildDuplicateProductDraft(source, existing);
            const allowedCategoryId =
              cats.find(c => c.id === draft.category_id)?.id || cats[0]?.id || '';
            setDuplicatedFromName(source.name);
            setDuplicateHasHiddenPrice(source.price === null);
            const qty = source.stock_quantity ?? inferSeedStockQuantity(draft.stock_status);
            reset({
              category_id: allowedCategoryId,
              name: draft.name,
              slug: draft.slug,
              brand: draft.brand,
              sku: draft.sku,
              short_description: draft.short_description,
              price: draft.price,
              min_order_qty: draft.min_order_qty,
              stock_quantity: qty,
              stock_status: draft.stock_status,
              is_active: draft.is_active,
              is_featured: draft.is_featured,
            });
            const imgs = draft.images || [];
            setFeaturedImages(imgs.slice(0, 1));
            setOtherImages(imgs.slice(1, 4));
            setSpecs(draft.specs);
          } else {
            toastError('Source product not found or outside your category scope.');
            if (cats.length > 0) {
              setValue('category_id', cats[0].id);
            }
          }
        } else if (cats.length > 0) {
          setDuplicatedFromName(null);
          setDuplicateHasHiddenPrice(false);
          setValue('category_id', cats[0].id);
        }
      } catch (err: any) {
        console.error('Failed to load product form:', err);
        toastError(err?.message || 'Failed to load product.');
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [id, duplicateId, isEditing, navigate, reset, setValue, toastError]);

  const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newCatId = e.target.value;
    setValue('category_id', newCatId, { shouldValidate: true });
    // Clear selected brand if it does not belong to the newly chosen category
    if (selectedBrandValue) {
      const existsInNewCategory = brands.some(
        b => b.category_id === newCatId && b.name.toLowerCase() === selectedBrandValue.trim().toLowerCase()
      );
      if (!existsInNewCategory) {
        setValue('brand', '');
      }
    }
    setShowAddBrand(false);
    setNewBrandName('');
  };

  const handleCreateInlineBrand = async () => {
    if (!selectedCategoryId) {
      toastError('Select a parent category first.');
      return;
    }
    const clean = newBrandName.trim();
    if (!clean) {
      toastError('Enter a brand name.');
      return;
    }
    setIsSavingBrand(true);
    try {
      const created = await dataService.createBrand({
        category_id: selectedCategoryId,
        name: clean,
      });
      setBrands(prev => [...prev, created]);
      setValue('brand', created.name, { shouldValidate: true });
      setNewBrandName('');
      setShowAddBrand(false);
      success(`Brand "${created.name}" added.`);
    } catch (err: any) {
      toastError(err?.message || 'Failed to add brand.');
    } finally {
      setIsSavingBrand(false);
    }
  };

  const handleDeleteSelectedBrand = async () => {
    if (!selectedBrandRecord) return;
    setDeletingBrandId(selectedBrandRecord.id);
    try {
      await dataService.deleteBrand(selectedBrandRecord.id);
      setBrands(prev => prev.filter(b => b.id !== selectedBrandRecord.id));
      setValue('brand', '');
      success(`Brand "${selectedBrandRecord.name}" deleted.`);
    } catch (err: any) {
      toastError(err?.message || 'Cannot delete brand.');
    } finally {
      setDeletingBrandId(null);
    }
  };

  const handleProductCsvUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = parseProductCsv(text, categories, brands);

      const targetCategoryId =
        parsed.category_id && categories.some(c => c.id === parsed.category_id)
          ? parsed.category_id
          : selectedCategoryId || categories[0]?.id || '';

      if (targetCategoryId) {
        setValue('category_id', targetCategoryId, { shouldValidate: true });
      }

      if (parsed.brand && targetCategoryId) {
        const existingInCat = brands.find(
          b =>
            b.category_id === targetCategoryId &&
            b.name.toLowerCase() === parsed.brand!.trim().toLowerCase()
        );
        if (existingInCat) {
          setValue('brand', existingInCat.name);
        } else {
          try {
            const createdBrand = await dataService.createBrand({
              category_id: targetCategoryId,
              name: parsed.brand,
            });
            setBrands(prev => [...prev, createdBrand]);
            setValue('brand', createdBrand.name);
          } catch {
            // Still set value even if brand table creation is restricted for user role
            setValue('brand', parsed.brand);
          }
        }
      }

      if (parsed.name !== undefined) {
        setValue('name', parsed.name, { shouldValidate: true });
        setValue('slug', parsed.slug || slugify(parsed.name), { shouldValidate: true });
      } else if (parsed.slug !== undefined) {
        setValue('slug', parsed.slug, { shouldValidate: true });
      }

      if (parsed.sku !== undefined) setValue('sku', parsed.sku);
      if (parsed.short_description !== undefined) {
        setValue('short_description', parsed.short_description);
      }
      if (parsed.price !== undefined && canEditPrice) {
        setValue('price', parsed.price, { shouldValidate: true });
      }
      if (parsed.min_order_qty !== undefined) {
        setValue('min_order_qty', parsed.min_order_qty, { shouldValidate: true });
      }
      if (parsed.stock_quantity !== undefined && canEditStock) {
        setValue('stock_quantity', parsed.stock_quantity, { shouldValidate: true });
        if (parsed.stock_status === undefined) {
          setValue(
            'stock_status',
            deriveStockStatusFromQuantity(parsed.stock_quantity, lowStockThreshold)
          );
        }
      }
      if (parsed.stock_status !== undefined && canEditStock) {
        setValue('stock_status', parsed.stock_status);
      }
      if (parsed.is_active !== undefined && canToggleVisibility) {
        setValue('is_active', parsed.is_active);
      }
      if (parsed.is_featured !== undefined) {
        setValue('is_featured', parsed.is_featured);
      }
      if (parsed.featured_image && canEditImages) {
        setFeaturedImages([parsed.featured_image]);
      }
      if (parsed.other_images && parsed.other_images.length > 0 && canEditImages) {
        setOtherImages(parsed.other_images.slice(0, 3));
      }

      const specCount = Object.keys(parsed.specs).length;
      if (specCount > 0) {
        setSpecs(prev => ({ ...prev, ...parsed.specs }));
      }

      const summary = `Populated ${parsed.populatedFieldsCount} field(s)${specCount > 0 ? ` and ${specCount} technical spec(s)` : ''} from "${file.name}".`;
      setCsvImportSummary(summary);
      success(summary);
    } catch (err: any) {
      toastError(err?.message || 'Could not parse product CSV file.');
    } finally {
      if (productCsvInputRef.current) {
        productCsvInputRef.current.value = '';
      }
    }
  };

  const onSubmit = async (data: ProductFormData) => {
    const combinedImages = [...featuredImages.slice(0, 1), ...otherImages.slice(0, 3)];

    if (!isEditing && featuredImages.length === 0) {
      toastError('Please upload a Featured Image (main photo).');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isEditing && id && originalProduct) {
        // Send ONLY fields this staff admin is permitted to modify so column triggers succeed
        const partialUpdates: Partial<Product> = {};

        if (canEditDetails) {
          partialUpdates.category_id = data.category_id;
          partialUpdates.name = data.name;
          partialUpdates.slug = data.slug;
          partialUpdates.brand = data.brand;
          partialUpdates.sku = data.sku;
          partialUpdates.short_description = data.short_description;
          partialUpdates.min_order_qty = data.min_order_qty;
          partialUpdates.is_featured = data.is_featured;
          partialUpdates.specs = specs;
        }
        if (canEditPrice && originalProduct.price !== data.price) {
          partialUpdates.price = data.price;
        }
        const origQty =
          originalProduct.stock_quantity ?? inferSeedStockQuantity(originalProduct.stock_status);
        if (canEditStock && origQty !== data.stock_quantity) {
          partialUpdates.stock_quantity = data.stock_quantity;
        }
        if (canEditStock && originalProduct.stock_status !== data.stock_status) {
          partialUpdates.stock_status = data.stock_status;
        }
        if (canToggleVisibility && originalProduct.is_active !== data.is_active) {
          partialUpdates.is_active = data.is_active;
        }
        if (canEditImages && JSON.stringify(originalProduct.images) !== JSON.stringify(combinedImages)) {
          partialUpdates.images = combinedImages;
        }

        if (Object.keys(partialUpdates).length === 0) {
          toastError('No permitted changes to save.');
          setIsSubmitting(false);
          return;
        }

        await dataService.updateProduct(id, partialUpdates);
        await queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
        success('Product updated successfully.');
      } else {
        await dataService.createProduct({
          ...data,
          images: combinedImages,
          specs,
        });
        await queryClient.invalidateQueries({ queryKey: ['inventory-alerts'] });
        success('New product created successfully.');
      }
      navigate('/admin/products');
    } catch (err: any) {
      console.error('Save failed:', err);
      toastError(err.message || 'Failed to save product.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-48" />
          <div className="h-96 bg-slate-200 rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <Link
          to="/admin/products"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-500 hover:text-[#187004]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Products</span>
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
            {isEditing ? 'Edit Product' : duplicatedFromName ? 'Duplicate Product' : 'Add New Product'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Specify technical details, brand sub-category, pricing, MOQ, and upload featured + gallery photos.
          </p>
        </div>

        {isEditing && id && canCreate && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => navigate(`/admin/products/new?duplicate=${id}`)}
            className="gap-1.5 self-start sm:self-auto"
          >
            <Copy className="w-4 h-4 text-[#187004]" />
            <span>Duplicate Product</span>
          </Button>
        )}
      </div>

      {!isEditing && duplicatedFromName && (
        <div
          role="status"
          className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 flex items-start gap-3 text-xs sm:text-sm text-emerald-900"
        >
          <Copy className="w-4 h-4 text-[#187004] shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">Duplicating "{duplicatedFromName}"</p>
            <p className="text-emerald-800/90 mt-0.5">
              Review the product name, SKU, URL slug, and pricing before creating the new listing.
              {duplicateHasHiddenPrice
                ? ' Because existing wholesale prices are hidden for your role, enter the trade price for this new product.'
                : ''}
            </p>
          </div>
        </div>
      )}

      {/* CSV Auto-Fill Card when Creating a New Product */}
      {!isEditing && canCreate && (
        <div className="bg-emerald-50/60 border border-emerald-200 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#187004] text-white flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 font-heading">
                Create Product from CSV (Auto-Fill)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Upload a CSV file containing product fields and technical specs to automatically populate this form. Upload your Featured Image below before saving.
              </p>
              {csvImportSummary && (
                <p className="text-xs font-semibold text-[#187004] mt-1.5" role="status">
                  {csvImportSummary}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => downloadCsvFile('product-template.csv', generateSampleProductCsv())}
              className="gap-1.5 bg-white text-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Template CSV</span>
            </Button>
            <input
              ref={productCsvInputRef}
              id="product-csv-upload"
              type="file"
              accept=".csv,text/csv"
              onChange={handleProductCsvUpload}
              className="hidden"
              aria-label="Upload Product CSV"
            />
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={() => productCsvInputRef.current?.click()}
              className="gap-1.5 text-xs font-bold"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload Product CSV</span>
            </Button>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <fieldset
          disabled={!canEditDetails}
          className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4 disabled:opacity-80"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 font-heading flex items-center gap-2">
              <Package className="w-4 h-4 text-[#187004]" />
              <span>General Details</span>
            </h2>
            {!canEditDetails && (
              <span className="text-[11px] font-semibold text-slate-400 flex items-center gap-1">
                <Lock className="w-3 h-3" /> Read-only
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="category_id" className="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">
                Category *
              </label>
              <select
                id="category_id"
                value={selectedCategoryId}
                onChange={handleCategoryChange}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#187004] disabled:bg-slate-100"
              >
                {categories.map(cat => (
                  <option key={cat.id} value={cat.id}>
                    {cat.name}
                  </option>
                ))}
              </select>
              {errors.category_id && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errors.category_id.message}</p>
              )}
            </div>

            {/* Brand as a Sub-Category Select + Inline Add & Delete */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="brand" className="block text-xs font-semibold text-slate-700 tracking-wide">
                  Brand (Sub-Category)
                </label>
                {canManageBrands && (
                  <button
                    type="button"
                    onClick={() => setShowAddBrand(v => !v)}
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#187004] hover:text-[#0e3e03] cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>{showAddBrand ? 'Close' : 'Add New Brand'}</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <select
                  id="brand"
                  {...register('brand')}
                  className="flex-1 min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#187004] disabled:bg-slate-100"
                >
                  <option value="">— Select Brand (Sub-Category) —</option>
                  {categoryBrands.map(brand => (
                    <option key={brand.id} value={brand.name}>
                      {brand.name}
                    </option>
                  ))}
                  {selectedBrandValue &&
                    !categoryBrands.some(b => b.name.toLowerCase() === selectedBrandValue.trim().toLowerCase()) && (
                      <option value={selectedBrandValue}>{selectedBrandValue} (Custom)</option>
                    )}
                </select>

                {canDeleteBrand && selectedBrandRecord && (
                  <button
                    type="button"
                    onClick={handleDeleteSelectedBrand}
                    disabled={deletingBrandId === selectedBrandRecord.id}
                    title={`Delete brand "${selectedBrandRecord.name}"`}
                    aria-label={`Delete brand ${selectedBrandRecord.name}`}
                    className="min-h-[44px] px-3 rounded-xl border border-slate-300 text-slate-500 hover:text-red-600 hover:border-red-300 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {showAddBrand && canManageBrands && (
                <div className="mt-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 flex items-center gap-2">
                  <input
                    type="text"
                    value={newBrandName}
                    onChange={e => setNewBrandName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleCreateInlineBrand();
                      }
                    }}
                    placeholder="New brand name (e.g. Canadian Solar)"
                    aria-label="New brand name"
                    className="flex-1 min-w-0 px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#187004]"
                  />
                  <Button
                    type="button"
                    size="sm"
                    variant="primary"
                    isLoading={isSavingBrand}
                    onClick={handleCreateInlineBrand}
                    className="text-xs px-3 py-1.5 h-auto"
                  >
                    Add
                  </Button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddBrand(false);
                      setNewBrandName('');
                    }}
                    aria-label="Cancel add brand"
                    className="p-1 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              {errors.brand && (
                <p className="mt-1 text-xs text-red-600 font-medium">{errors.brand.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <Input
                label="Product Name *"
                placeholder="e.g. ZN Shine 600W Solar Panel"
                error={errors.name?.message}
                {...register('name')}
              />
            </div>

            <div>
              <Input
                label="SKU Code"
                placeholder="e.g. ZNS-600W-MONO"
                error={errors.sku?.message}
                {...register('sku')}
              />
            </div>
          </div>

          <div>
            <Input
              label="URL Slug *"
              placeholder="e.g. zn-shine-600w-solar-panel"
              error={errors.slug?.message}
              {...register('slug')}
            />
          </div>

          <div>
            <label htmlFor="short_description" className="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">
              Short Description
            </label>
            <textarea
              id="short_description"
              rows={3}
              placeholder="Key sales points, tier classification, or installation recommendation..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#187004] disabled:bg-slate-100"
              {...register('short_description')}
            />
          </div>
        </fieldset>

        {/* Pricing, MOQ & Stock Availability */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4">
          <h2 className="text-base font-bold text-slate-900 font-heading pb-3 border-b border-slate-100">
            Wholesale Pricing & Inventory
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Price */}
            <div>
              {!canViewPrices && isEditing ? (
                <div>
                  <span className="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">
                    Trade Price (₦ Naira)
                  </span>
                  <div className="min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-200 bg-slate-100 text-sm font-bold text-slate-500 flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5" />
                    <span>Hidden</span>
                  </div>
                </div>
              ) : (
                <Input
                  label="Trade Price (₦ Naira) *"
                  type="number"
                  step="100"
                  min="0"
                  disabled={!canEditPrice}
                  error={errors.price?.message}
                  {...register('price', { valueAsNumber: true })}
                />
              )}
            </div>

            {/* Minimum Order Quantity */}
            <div>
              <Input
                label="Min. Order Qty (MOQ) *"
                type="number"
                min="1"
                disabled={!canEditDetails}
                error={errors.min_order_qty?.message}
                {...register('min_order_qty', { valueAsNumber: true })}
              />
            </div>

            {/* Stock Quantity (Units) */}
            <div>
              <Input
                label="Stock Quantity (Units) *"
                type="number"
                min="0"
                step="1"
                disabled={!canEditStock}
                error={errors.stock_quantity?.message}
                helperText={`Low-stock alerts trigger below ${lowStockThreshold} units.`}
                {...register('stock_quantity', {
                  valueAsNumber: true,
                  onChange: e => {
                    const qty = Math.max(0, Math.floor(Number(e.target.value) || 0));
                    setValue(
                      'stock_status',
                      deriveStockStatusFromQuantity(qty, lowStockThreshold),
                      { shouldValidate: true }
                    );
                  },
                })}
              />
            </div>

            {/* Stock Status */}
            <div>
              <label htmlFor="stock_status" className="block text-xs font-semibold text-slate-700 tracking-wide mb-1.5">
                Stock Status *
              </label>
              <select
                id="stock_status"
                disabled={!canEditStock}
                {...register('stock_status')}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#187004] disabled:bg-slate-100"
              >
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
              </select>
            </div>
          </div>

          {/* Visibility & Featured Toggles */}
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-6">
            <label className={`flex items-center gap-2 ${canToggleVisibility ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}>
              <input
                type="checkbox"
                disabled={!canToggleVisibility}
                {...register('is_active')}
                className="w-4 h-4 rounded text-[#187004] focus:ring-[#187004]"
              />
              <span className="text-sm font-semibold text-slate-800">
                Active in Reseller Catalogue
              </span>
            </label>

            <label className={`flex items-center gap-2 ${canEditDetails ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`}>
              <input
                type="checkbox"
                disabled={!canEditDetails}
                {...register('is_featured')}
                className="w-4 h-4 rounded text-[#F5A623] focus:ring-[#F5A623]"
              />
              <span className="text-sm font-semibold text-slate-800 flex items-center gap-1">
                <Sparkles className="w-4 h-4 text-amber-500" />
                Featured Deal (Top Row)
              </span>
            </label>
          </div>
        </div>

        {/* Split Product Photos: 1 Featured Image + Up to 3 Other Images */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-base font-bold text-slate-900 font-heading">
                Product Photos
              </h2>
              <p className="text-xs text-slate-500">
                Upload 1 Featured Image (main photo) and up to 3 Other Images for the reseller gallery.
              </p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              {featuredImages.length + otherImages.length} / 4 total
            </span>
          </div>

          {/* Featured Image (Max 1) */}
          <div className="space-y-2.5 p-4 rounded-xl bg-emerald-50/40 border border-emerald-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-[#187004]" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Featured Image (Main Photo) *
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Maximum 1 image. Displayed first on product listings and catalogue cards.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white border border-emerald-200 text-[#187004]">
                {featuredImages.length} / 1
              </span>
            </div>

            {canEditImages ? (
              <ImageUploader
                inputId="featured-image-input"
                images={featuredImages}
                onChange={setFeaturedImages}
                maxImages={1}
                mainBadgeLabel="Featured"
                showSetMain={false}
                dropzoneTitle="Upload Featured Image (Main Photo)"
                dropzoneSubtitle="1 image maximum. JPG, PNG, or WebP (compressed automatically)."
              />
            ) : (
              <div className="flex flex-wrap gap-3">
                {featuredImages.map((src, idx) => (
                  <img
                    key={idx}
                    src={src}
                    alt="Featured product"
                    className="w-24 h-24 rounded-xl object-cover border border-slate-200"
                  />
                ))}
                {featuredImages.length === 0 && (
                  <p className="text-xs text-slate-400">No featured photo uploaded (read-only).</p>
                )}
              </div>
            )}
          </div>

          {/* Other Product Images (Max 3) */}
          <div className="space-y-2.5 p-4 rounded-xl bg-slate-50/70 border border-slate-200/80">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Images className="w-4 h-4 text-slate-600" />
                <div>
                  <h3 className="text-sm font-bold text-slate-900">
                    Other Images (Additional Views)
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Maximum 3 images. Displayed alongside the featured photo when resellers view this product.
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-white border border-slate-200 text-slate-600">
                {otherImages.length} / 3
              </span>
            </div>

            {canEditImages ? (
              <ImageUploader
                inputId="other-images-input"
                images={otherImages}
                onChange={setOtherImages}
                maxImages={3}
                mainBadgeLabel={null}
                showSetMain={false}
                dropzoneTitle="Upload Other Product Images (Max 3)"
                dropzoneSubtitle="Add extra angles, spec sheets, or packaging photos (up to 3 images)."
              />
            ) : (
              <div className="flex flex-wrap gap-3">
                {otherImages.map((src, idx) => (
                  <img
                    key={idx}
                    src={src}
                    alt={`Other product view ${idx + 1}`}
                    className="w-24 h-24 rounded-xl object-cover border border-slate-200"
                  />
                ))}
                {otherImages.length === 0 && (
                  <p className="text-xs text-slate-400">No additional photos uploaded (read-only).</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Technical Specifications Key/Value Editor (with CSV Upload) */}
        <fieldset disabled={!canEditDetails} className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-4 disabled:opacity-80">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-base font-bold text-slate-900 font-heading">
              Technical Specifications
            </h2>
            <p className="text-xs text-slate-500">
              Add key/value rows manually or upload a CSV file of specifications (Wattage, Voltage, Dimensions, Warranty, etc.).
            </p>
          </div>

          <SpecsEditor specs={specs} onChange={setSpecs} disabled={!canEditDetails} />
        </fieldset>

        {/* Submit Actions */}
        <div className="flex items-center justify-end gap-3 pt-4">
          <Button
            type="button"
            variant="outline"
            size="md"
            onClick={() => navigate('/admin/products')}
          >
            {canSubmitAnyChange ? 'Cancel' : 'Back'}
          </Button>
          {canSubmitAnyChange && (
            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              className="font-bold shadow-md min-w-[160px]"
            >
              <Save className="w-4 h-4 mr-2" />
              <span>{isEditing ? 'Save Changes' : 'Create Product'}</span>
            </Button>
          )}
        </div>
      </form>
    </div>
  );
}
