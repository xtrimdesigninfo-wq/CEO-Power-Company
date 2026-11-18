import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Sparkles, Filter, X, ShieldCheck, AlertTriangle } from 'lucide-react';
import { Product, Category, Brand } from '../types';
import { dataService } from '../services/dataService';
import { useAuthStore } from '../store/authStore';
import { ProductCard } from '../components/catalog/ProductCard';
import { CategoryChips } from '../components/catalog/CategoryChips';

export default function Catalog() {
  const { categorySlug } = useParams<{ categorySlug?: string }>();
  const navigate = useNavigate();
  const { profile } = useAuthStore();

  // Filters
  const [search, setSearch] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('all');
  const [sortBy, setSortBy] = useState<'newest' | 'featured' | 'price_asc' | 'price_desc'>('newest');
  const [showFilters, setShowFilters] = useState(false);

  // Reset brand sub-category filter when switching parent categories
  useEffect(() => {
    setSelectedBrand('all');
  }, [categorySlug]);

  const { data: categories = [], isLoading: loadingCats } = useQuery<Category[]>({
    queryKey: ['categories', true],
    queryFn: () => dataService.getCategories(true),
    staleTime: 1000 * 60 * 5,
  });

  const { data: allCategoryBrands = [] } = useQuery<Brand[]>({
    queryKey: ['brands', 'all'],
    queryFn: () => dataService.getBrands(),
    staleTime: 1000 * 60 * 5,
  });

  const {
    data: allActiveProducts = [],
    isLoading: loadingProducts,
    isError: isProductsError,
    refetch: refetchProducts,
  } = useQuery<Product[]>({
    queryKey: ['catalog-products'],
    queryFn: () => dataService.getProducts({ activeOnly: true }),
    staleTime: 1000 * 60 * 2,
  });

  const isLoading = (loadingCats || loadingProducts) && allActiveProducts.length === 0;

  const activeCategory = useMemo(
    () => (categorySlug ? categories.find(c => c.slug === categorySlug) : undefined),
    [categories, categorySlug]
  );

  const categoryScopedProducts = useMemo(() => {
    if (!categorySlug) return allActiveProducts;
    if (!activeCategory) return [];
    return allActiveProducts.filter(p => p.category_id === activeCategory.id);
  }, [allActiveProducts, categorySlug, activeCategory]);

  const products = useMemo(() => {
    let list = categoryScopedProducts;

    if (selectedBrand !== 'all') {
      const targetBrand = selectedBrand.toLowerCase();
      list = list.filter(p => p.brand?.toLowerCase() === targetBrand);
    }

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.sku && p.sku.toLowerCase().includes(q)) ||
          (p.short_description && p.short_description.toLowerCase().includes(q))
      );
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      if (sortBy === 'featured') {
        if (a.is_featured && !b.is_featured) return -1;
        if (!a.is_featured && b.is_featured) return 1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (sortBy === 'price_asc') return a.price - b.price;
      if (sortBy === 'price_desc') return b.price - a.price;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    return sorted;
  }, [categoryScopedProducts, selectedBrand, search, sortBy]);

  // Handle Category selection
  const handleCategorySelect = (slug: string) => {
    if (slug === 'all') {
      navigate('/catalog');
    } else {
      navigate(`/catalog/${slug}`);
    }
  };

  // Combine managed brands with any product brand labels, deduplicated alphabetically
  const allBrands = useMemo(() => {
    const scopedBrands = activeCategory
      ? allCategoryBrands.filter(b => b.category_id === activeCategory.id)
      : allCategoryBrands;
    return Array.from(
      new Set(
        [
          ...scopedBrands.map(b => b.name.trim()),
          ...categoryScopedProducts.map(p => (p.brand || '').trim()),
        ].filter(Boolean)
      )
    ).sort((a, b) => a.localeCompare(b));
  }, [allCategoryBrands, activeCategory, categoryScopedProducts]);

  // Featured products (top row if on "all" categories and no search)
  const isDefaultView = !categorySlug && !search && selectedBrand === 'all';
  const featuredProducts = useMemo(
    () => (isDefaultView ? products.filter(p => p.is_featured) : []),
    [isDefaultView, products]
  );

  return (
    <div className="space-y-8 sm:space-y-10">
      {/* Reseller Greeting & Header */}
      <div className="relative overflow-hidden bg-white rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="h-1 bg-gradient-to-r from-[#187004] via-[#22c55e] to-[#F5A623]" aria-hidden="true" />
        <div className="p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-5">
          <div>
            <span className="text-[11px] font-extrabold uppercase tracking-widest text-[#187004] block mb-1">
              Authorized B2B Partner Portal
            </span>
            <h1 className="text-2xl sm:text-[28px] font-extrabold text-slate-900 font-heading leading-tight">
              Welcome back, {profile?.business_name || profile?.full_name || 'Partner'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1.5 max-w-2xl">
              Browse verified wholesale trade pricing across solar panels, inverters, and storage systems. Orders dispatch directly to WhatsApp.
            </p>
          </div>
          <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
            <span className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-amber-50 text-amber-900 text-xs font-bold border border-amber-200/80">
              <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0" />
              Reseller Partner Tier
            </span>
          </div>
        </div>
      </div>

      {/* Anchored Search, Filter & Category Controls */}
      <div className="space-y-4">
        <div className="bg-white p-3.5 sm:p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search panels, inverters, batteries, cables, or SKU..."
              className="w-full min-h-[42px] pl-10 pr-9 py-2 rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#187004] transition-colors"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                aria-label="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Sort & Brand Select */}
          <div className="flex items-center gap-2.5 shrink-0">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              aria-label="Sort products"
              className="min-h-[42px] px-3.5 py-2 rounded-xl border border-slate-200 bg-white text-xs sm:text-sm font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#187004]"
            >
              <option value="newest">Newest Arrivals</option>
              <option value="featured">Featured First</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>

            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={`min-h-[42px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                selectedBrand !== 'all'
                  ? 'bg-[#187004] text-white border-[#187004]'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <Filter className="w-4 h-4" />
              <span>Brand {selectedBrand !== 'all' ? `(${selectedBrand})` : ''}</span>
            </button>
          </div>
        </div>

        {/* Brand Selector Drawer / Row when active */}
        {showFilters && (
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-wrap items-center gap-2 animate-in fade-in duration-150">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mr-2">
              Filter by Brand:
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedBrand('all');
                setShowFilters(false);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                selectedBrand === 'all'
                  ? 'bg-[#187004] text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              All Brands
            </button>
            {allBrands.map(brand => (
              <button
                key={brand}
                type="button"
                onClick={() => {
                  setSelectedBrand(brand);
                  setShowFilters(false);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer ${
                  selectedBrand.toLowerCase() === brand.toLowerCase()
                    ? 'bg-[#187004] text-white'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {brand}
              </button>
            ))}
          </div>
        )}

        {/* Category Horizontal Chips */}
        <CategoryChips
          categories={categories}
          selectedSlug={categorySlug || 'all'}
          onSelect={handleCategorySelect}
        />
      </div>

      {/* Featured Row (Only shown when not specifically searching or filtering) */}
      {featuredProducts.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-end justify-between border-b border-slate-200/70 pb-3">
            <div>
              <div className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-0.5">
                <Sparkles className="w-3.5 h-3.5 text-[#F5A623]" />
                <span>Priority Allocations</span>
              </div>
              <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 font-heading">
                Featured Wholesale Deals
              </h2>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
            {featuredProducts.slice(0, 4).map(product => (
              <ProductCard key={`feat-${product.id}`} product={product} />
            ))}
          </div>
        </section>
      )}

      {/* Main Product Grid */}
      <section className="space-y-5">
        <div className="flex items-baseline justify-between border-b border-slate-200/70 pb-3">
          <div>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 font-heading">
              {categorySlug
                ? categories.find(c => c.slug === categorySlug)?.name || 'Products'
                : 'All Wholesale Products'}
            </h2>
          </div>
          <span className="text-xs font-semibold text-slate-500 tabular-nums">
            {products.length} {products.length === 1 ? 'item' : 'items'}
          </span>
        </div>

        {/* Loading Skeletons */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(n => (
              <div key={n} className="bg-white rounded-2xl border border-slate-200 p-4 h-80 animate-pulse flex flex-col justify-between">
                <div className="w-full h-40 bg-slate-200 rounded-xl mb-3" />
                <div className="space-y-2">
                  <div className="h-4 bg-slate-200 rounded w-1/3" />
                  <div className="h-5 bg-slate-200 rounded w-3/4" />
                </div>
                <div className="h-10 bg-slate-200 rounded-xl" />
              </div>
            ))}
          </div>
        )}

        {/* Error State */}
        {!isLoading && isProductsError && allActiveProducts.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-red-200 p-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
              <AlertTriangle className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 font-heading">
              Unable to load products right now
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
              We had trouble reaching the live product catalogue. Please retry to fetch the latest items.
            </p>
            <button
              type="button"
              onClick={() => refetchProducts()}
              className="mt-4 px-4 py-2 rounded-xl bg-[#187004] text-white text-xs font-bold hover:bg-[#0e3e03] cursor-pointer"
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && !(isProductsError && allActiveProducts.length === 0) && products.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 p-8">
            <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
              <Search className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 font-heading">
              No products found
            </h3>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
              We couldn't find any products matching your search or filters. Try resetting the filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setSearch('');
                setSelectedBrand('all');
                navigate('/catalog');
              }}
              className="mt-4 px-4 py-2 rounded-xl bg-[#187004] text-white text-xs font-bold hover:bg-[#0e3e03]"
            >
              Reset Filters
            </button>
          </div>
        )}

        {/* Product Grid */}
        {!isLoading && products.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 sm:gap-6">
            {products.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
