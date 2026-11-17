import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  ShoppingBag,
  MessageSquare,
  ShieldCheck,
  Truck,
  Star,
  Sparkles,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { Category, Product } from '../types';
import { dataService } from '../services/dataService';
import { formatNaira } from '../lib/utils';
import { getSimilarProducts } from '../lib/productUtils';
import { StockBadge } from '../components/ui/Badge';
import { QuantityStepper } from '../components/ui/QuantityStepper';
import { Button } from '../components/ui/Button';
import { useCartStore } from '../store/cartStore';
import { useToast } from '../components/ui/Toast';
import { ProductImage } from '../components/ui/ProductImage';
import { ProductCard } from '../components/catalog/ProductCard';
import { openWhatsAppChat, buildProductInquiryMessage } from '../lib/whatsapp';
import { useCompanySettings } from '../hooks/useCompanySettings';

export default function ProductDetail() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { addItem } = useCartStore();
  const { success } = useToast();
  const { settings } = useCompanySettings();

  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);

  const { data: allActive = [], isLoading: loadingCatalog } = useQuery<Product[]>({
    queryKey: ['catalog-products'],
    queryFn: () => dataService.getProducts({ activeOnly: true }),
    staleTime: 1000 * 60 * 2,
  });

  const { data: categories = [] } = useQuery<Category[]>({
    queryKey: ['categories', true],
    queryFn: () => dataService.getCategories(true),
    staleTime: 1000 * 60 * 5,
  });

  const cachedProduct = useMemo(
    () => (slug ? allActive.find(p => p.slug === slug) || null : null),
    [allActive, slug]
  );

  const { data: fetchedProduct = null, isLoading: loadingDirect } = useQuery<Product | null>({
    queryKey: ['product-by-slug', slug],
    queryFn: () => (slug ? dataService.getProductBySlug(slug) : Promise.resolve(null)),
    enabled: Boolean(slug) && !cachedProduct && !loadingCatalog,
    staleTime: 1000 * 60 * 2,
  });

  const product = cachedProduct ?? fetchedProduct;
  const isLoading = (!product && (loadingCatalog || loadingDirect));

  const category = useMemo(
    () => (product ? categories.find(c => c.id === product.category_id) || null : null),
    [product, categories]
  );

  const similarProducts = useMemo(
    () => (product ? getSimilarProducts(product, allActive, 4) : []),
    [product, allActive]
  );

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' });
  }, [slug]);

  useEffect(() => {
    if (product) {
      setActiveImageIndex(0);
      setQuantity(product.min_order_qty || 1);
    }
  }, [product?.id]);

  if (isLoading) {
    return (
      <div className="max-w-6xl mx-auto py-8">
        <div className="animate-pulse space-y-6">
          <div className="h-6 bg-slate-200 rounded w-24" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="h-96 bg-slate-200 rounded-2xl" />
            <div className="space-y-4">
              <div className="h-8 bg-slate-200 rounded w-3/4" />
              <div className="h-6 bg-slate-200 rounded w-1/4" />
              <div className="h-24 bg-slate-200 rounded" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
        <h2 className="text-xl font-bold text-slate-800 font-heading">Product Not Found</h2>
        <p className="text-sm text-slate-500 mt-2">
          The product you are looking for may have been moved or is currently unavailable.
        </p>
        <Button
          type="button"
          variant="primary"
          onClick={() => navigate('/catalog')}
          className="mt-6"
        >
          Back to Catalogue
        </Button>
      </div>
    );
  }

  const productImages =
    product.images && product.images.length > 0
      ? product.images.slice(0, 4)
      : ['https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80'];
  const currentImg = productImages[activeImageIndex] || productImages[0];
  const isOutOfStock = product.stock_status === 'out_of_stock';

  const handleAddToCart = () => {
    if (isOutOfStock) return;
    addItem(product, quantity);
    success(`Added ${quantity}x ${product.name} to cart`);
  };

  const handleAskWhatsApp = () => {
    const text = buildProductInquiryMessage(product.name, product.sku);
    openWhatsAppChat(settings.whatsapp_number, text);
  };

  return (
    <div className="space-y-8 sm:space-y-10 max-w-6xl mx-auto">
      {/* Back button & Category/Brand breadcrumb */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          to="/catalog"
          className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-slate-600 hover:text-[#187004] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Catalogue</span>
        </Link>
        {category && (
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
            <Link to={`/catalog/${category.slug}`} className="hover:text-[#187004]">
              {category.name}
            </Link>
            {product.brand && (
              <>
                <span>/</span>
                <span className="text-slate-700 font-bold">{product.brand}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Main Product Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden p-6 sm:p-9">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* Left: Featured + Other Images Gallery */}
          <div className="space-y-4">
            <div className="relative aspect-4/3 sm:aspect-square bg-slate-100 rounded-2xl overflow-hidden border border-slate-100 flex items-center justify-center">
              <ProductImage
                src={currentImg}
                alt={`${product.name} — ${activeImageIndex === 0 ? 'Featured photo' : `View ${activeImageIndex + 1}`}`}
                className="w-full h-full object-cover"
              />
              <div className="absolute top-3 right-3">
                <StockBadge status={product.stock_status} />
              </div>
              {product.is_featured && (
                <div className="absolute top-3 left-3 flex items-center gap-1 bg-[#F5A623] text-slate-950 px-2.5 py-1 rounded-lg text-xs font-extrabold uppercase shadow-sm">
                  <Star className="w-3.5 h-3.5 fill-slate-950" /> Featured
                </div>
              )}

              {productImages.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveImageIndex(prev => (prev - 1 + productImages.length) % productImages.length)
                    }
                    aria-label="Previous product photo"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center cursor-pointer"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setActiveImageIndex(prev => (prev + 1) % productImages.length)
                    }
                    aria-label="Next product photo"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md flex items-center justify-center cursor-pointer"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-slate-900/75 text-white text-[11px] font-bold">
                    {activeImageIndex + 1} / {productImages.length}
                  </div>
                </>
              )}
            </div>

            {/* Thumbnails: Featured Photo + Other Images */}
            {productImages.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-2" data-testid="product-gallery-thumbnails">
                {productImages.map((img, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveImageIndex(idx)}
                    aria-label={idx === 0 ? 'View Featured Image' : `View Other Image ${idx}`}
                    className={`relative w-20 h-20 rounded-xl overflow-hidden border-2 shrink-0 transition-all cursor-pointer ${
                      activeImageIndex === idx
                        ? 'border-[#F5A623] ring-2 ring-[#F5A623]/25 opacity-100'
                        : 'border-slate-200 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <ProductImage src={img} alt="" className="w-full h-full object-cover" />
                    <span
                      className={`absolute bottom-0 inset-x-0 text-[9px] font-bold uppercase text-center py-0.5 ${
                        idx === 0 ? 'bg-[#187004]/90 text-white' : 'bg-slate-900/70 text-white'
                      }`}
                    >
                      {idx === 0 ? 'Featured' : `Photo ${idx + 1}`}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Info and Pricing */}
          <div className="flex flex-col justify-between">
            <div>
              {/* Brand Sub-Category & SKU */}
              <div className="flex items-center justify-between text-xs font-semibold text-slate-500 mb-2">
                <div className="flex items-center gap-1.5 flex-wrap">
                  {category && (
                    <span className="text-slate-500 bg-slate-100 px-2.5 py-1 rounded-md">
                      {category.name}
                    </span>
                  )}
                  <span className="uppercase tracking-wider text-[#187004] bg-emerald-50 border border-emerald-200/70 px-2.5 py-1 rounded-md">
                    {product.brand || 'CEO POWER'}
                  </span>
                </div>
                {product.sku && (
                  <span className="font-mono text-slate-400">SKU: {product.sku}</span>
                )}
              </div>

              {/* Title */}
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading leading-tight">
                {product.name}
              </h1>

              {/* Price */}
              <div className="mt-4 p-4 rounded-xl bg-slate-50 border border-slate-200/60 flex items-baseline justify-between">
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400 block tracking-wider">
                    Wholesale Reseller Price
                  </span>
                  <span className="text-2xl sm:text-3xl font-black text-[#187004] tabular-nums font-heading">
                    {formatNaira(product.price)}
                  </span>
                </div>
                {product.min_order_qty > 1 && (
                  <div className="text-right">
                    <span className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-2.5 py-1 rounded-lg">
                      MOQ: {product.min_order_qty} units
                    </span>
                  </div>
                )}
              </div>

              {/* Short Description */}
              {product.short_description && (
                <div className="mt-5">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
                    Description
                  </h3>
                  <p className="text-sm text-slate-700 leading-relaxed">
                    {product.short_description}
                  </p>
                </div>
              )}

              {/* Partner Benefits */}
              <div className="mt-6 space-y-2 border-t border-b border-slate-100 py-4">
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Direct manufacturer warranty support & tested in Onitsha HQ</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
                  <Truck className="w-4 h-4 text-sky-600 shrink-0" />
                  <span>Immediate dispatch from Onitsha warehouse via nationwide logistics</span>
                </div>
              </div>
            </div>

            {/* Actions: Quantity Stepper & Add to Cart & Ask on WhatsApp */}
            <div className="mt-8 pt-4 space-y-3">
              {!isOutOfStock ? (
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                  <div className="flex items-center justify-between sm:justify-start gap-3">
                    <span className="text-xs font-bold text-slate-700">Quantity:</span>
                    <QuantityStepper
                      value={quantity}
                      min={product.min_order_qty || 1}
                      onChange={setQuantity}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="primary"
                    size="lg"
                    onClick={handleAddToCart}
                    className="flex-1 text-sm font-bold gap-2 shadow-md"
                  >
                    <ShoppingBag className="w-5 h-5" />
                    <span>Add to Cart ({formatNaira(product.price * quantity)})</span>
                  </Button>
                </div>
              ) : (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm font-semibold text-red-700 text-center">
                  This item is currently out of stock. Contact sales for incoming shipment dates.
                </div>
              )}

              {/* Ask on WhatsApp */}
              <Button
                type="button"
                variant="whatsapp"
                size="md"
                onClick={handleAskWhatsApp}
                className="w-full text-sm font-bold gap-2 shadow-xs"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Ask About This Product on WhatsApp</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Specifications Table */}
      {product.specs && Object.keys(product.specs).length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-8">
          <h2 className="text-lg font-bold text-slate-900 font-heading mb-4 pb-3 border-b border-slate-100 flex items-center gap-2">
            Technical Specifications
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
            {Object.entries(product.specs).map(([key, value], idx) => (
              <div
                key={key}
                className={`flex items-center justify-between py-2.5 px-3.5 rounded-xl border border-slate-200/60 text-sm ${
                  idx % 2 === 0 ? 'bg-slate-50/80' : 'bg-white'
                }`}
              >
                <span className="font-semibold text-slate-500 text-xs sm:text-sm">{key}</span>
                <span className="font-bold text-slate-900 text-xs sm:text-sm text-right">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Similar Products Section (Before Footer) */}
      {similarProducts.length > 0 && (
        <section aria-labelledby="similar-products-heading" className="pt-6 border-t border-slate-200/70 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-1">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-1">
                <Sparkles className="w-3.5 h-3.5 text-[#F5A623]" />
                <span>Recommended Alternatives</span>
              </div>
              <h2
                id="similar-products-heading"
                className="text-xl sm:text-2xl font-extrabold text-slate-900 font-heading"
              >
                Similar Products
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                Matched by category, brand, wholesale price tier, technical ratings, and current stock.
              </p>
            </div>
            <Link
              to={`/catalog?category=${product.category_id}`}
              className="text-xs sm:text-sm font-bold text-[#187004] hover:text-[#0e3e03] hover:underline shrink-0"
            >
              Browse Full Category →
            </Link>
          </div>

          <div
            data-testid="similar-products-grid"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5"
          >
            {similarProducts.map(item => (
              <ProductCard key={item.id} product={item} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
