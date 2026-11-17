import React, { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ShoppingBag, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import { Product } from '../../types';
import { formatNaira } from '../../lib/utils';
import {
  getProductCardImages,
  getWrappedCarouselIndex,
  getCarouselIndexFromScroll,
} from '../../lib/productUtils';
import { StockBadge } from '../ui/Badge';
import { QuantityStepper } from '../ui/QuantityStepper';
import { Button } from '../ui/Button';
import { useCartStore } from '../../store/cartStore';
import { useToast } from '../ui/Toast';

import { ProductImage } from '../ui/ProductImage';

export const ProductCard = React.memo(function ProductCard({ product }: { product: Product }) {
  const [qty, setQty] = useState(product.min_order_qty || 1);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement | null>(null);
  const { addItem } = useCartStore();
  const { success } = useToast();

  const isOutOfStock = product.stock_status === 'out_of_stock';
  const cardImages = useMemo(() => getProductCardImages(product.images, 4), [product.images]);
  const hasMultipleImages = cardImages.length > 1;

  const scrollToSlide = (targetIndex: number) => {
    const safeIndex = getWrappedCarouselIndex(targetIndex, 0, cardImages.length);
    setActiveImageIndex(safeIndex);
    const track = trackRef.current;
    if (track) {
      track.scrollTo({
        left: safeIndex * track.clientWidth,
        behavior: 'smooth',
      });
    }
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const prevIndex = getWrappedCarouselIndex(activeImageIndex, -1, cardImages.length);
    scrollToSlide(prevIndex);
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const nextIndex = getWrappedCarouselIndex(activeImageIndex, 1, cardImages.length);
    scrollToSlide(nextIndex);
  };

  const handleTrackScroll = () => {
    const track = trackRef.current;
    if (!track || !hasMultipleImages) return;
    const nextIdx = getCarouselIndexFromScroll(track.scrollLeft, track.clientWidth, cardImages.length);
    if (nextIdx !== activeImageIndex) {
      setActiveImageIndex(nextIdx);
    }
  };

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isOutOfStock) return;
    addItem(product, qty);
    success(`Added ${qty}x ${product.name} to cart`);
  };

  return (
    <div className="group flex flex-col bg-white rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-lg hover:-translate-y-0.5 hover:border-slate-300/90 transition-all duration-200 overflow-hidden relative">
      {/* Featured Badge */}
      {product.is_featured && (
        <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-1 bg-[#F5A623] text-slate-950 px-2.5 py-1 rounded-lg text-[10px] font-extrabold uppercase tracking-wider shadow-sm">
          <Star className="w-3 h-3 fill-slate-950" />
          Featured
        </div>
      )}

      {/* Stock Status Badge */}
      <div className="pointer-events-none absolute top-3 right-3 z-10">
        <StockBadge status={product.stock_status} />
      </div>

      {/* Scrollable Image Carousel */}
      <div className="relative aspect-4/3 bg-slate-100 overflow-hidden">
        <div
          ref={trackRef}
          onScroll={handleTrackScroll}
          data-testid={`product-carousel-track-${product.slug}`}
          aria-label={`${product.name} images`}
          tabIndex={hasMultipleImages ? 0 : undefined}
          onKeyDown={(e) => {
            if (!hasMultipleImages) return;
            if (e.key === 'ArrowLeft') {
              e.preventDefault();
              scrollToSlide(getWrappedCarouselIndex(activeImageIndex, -1, cardImages.length));
            } else if (e.key === 'ArrowRight') {
              e.preventDefault();
              scrollToSlide(getWrappedCarouselIndex(activeImageIndex, 1, cardImages.length));
            }
          }}
          className="w-full h-full flex overflow-x-auto snap-x snap-mandatory scroll-smooth no-scrollbar focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#187004]"
        >
          {cardImages.map((imgUrl, idx) => (
            <Link
              key={`${product.id}-img-${idx}`}
              to={`/product/${product.slug}`}
              className="w-full h-full shrink-0 snap-start snap-always block relative"
              aria-label={`View ${product.name} — ${idx === 0 ? 'Featured photo' : `Photo ${idx + 1}`}`}
            >
              <ProductImage
                src={imgUrl}
                alt={`${product.name}${cardImages.length > 1 ? ` (${idx === 0 ? 'Featured' : `Photo ${idx + 1}`})` : ''}`}
                className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
              />
            </Link>
          ))}
        </div>

        {/* Carousel Prev / Next Controls & Pagination Dots */}
        {hasMultipleImages && (
          <>
            <button
              type="button"
              onClick={handlePrevImage}
              aria-label={`Previous image for ${product.name}`}
              className="absolute left-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-800 border border-slate-200/80 shadow-sm flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#187004]"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={handleNextImage}
              aria-label={`Next image for ${product.name}`}
              className="absolute right-2 top-1/2 -translate-y-1/2 z-10 w-7 h-7 rounded-full bg-white/90 hover:bg-white text-slate-800 border border-slate-200/80 shadow-sm flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 focus-visible:opacity-100 transition-opacity cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#187004]"
            >
              <ChevronRight className="w-4 h-4" />
            </button>

            <div className="pointer-events-none absolute bottom-2.5 inset-x-2.5 z-10 flex items-center justify-between gap-2">
              <div className="pointer-events-auto inline-flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900/65 backdrop-blur-xs">
                {cardImages.map((_, idx) => {
                  const isActive = idx === activeImageIndex;
                  return (
                    <button
                      key={idx}
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        scrollToSlide(idx);
                      }}
                      aria-label={`Show image ${idx + 1} of ${cardImages.length} for ${product.name}`}
                      aria-current={isActive ? 'true' : undefined}
                      className={`h-1.5 rounded-full transition-all cursor-pointer ${
                        isActive ? 'w-3.5 bg-[#F5A623]' : 'w-1.5 bg-white/60 hover:bg-white/90'
                      }`}
                    />
                  );
                })}
              </div>

              <span className="px-2 py-0.5 rounded-full bg-slate-900/65 backdrop-blur-xs text-white text-[10px] font-bold tabular-nums">
                {activeImageIndex + 1} / {cardImages.length}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Details */}
      <div className="p-5 flex-1 flex flex-col justify-between">
        <div>
          {/* Brand & SKU */}
          <div className="flex items-center justify-between gap-2 text-[11px] text-slate-500 mb-1.5">
            <span className="font-bold text-slate-600 uppercase tracking-wider truncate">
              {product.brand || 'CEO POWER'}
            </span>
            {product.sku && (
              <span className="font-mono text-slate-400 shrink-0">
                {product.sku}
              </span>
            )}
          </div>

          {/* Title */}
          <Link
            to={`/product/${product.slug}`}
            className="block text-[15px] sm:text-base font-bold text-slate-900 hover:text-[#187004] line-clamp-2 leading-snug min-h-[2.6rem] font-heading transition-colors"
          >
            {product.name}
          </Link>

          {/* MOQ Indicator if > 1 */}
          {product.min_order_qty > 1 && (
            <p className="mt-1.5 inline-flex items-center px-2 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200/80 text-[11px] font-semibold">
              Min. Order: {product.min_order_qty} units
            </p>
          )}
        </div>

        {/* Pricing & Add to Cart Action */}
        <div className="mt-5 pt-3.5 border-t border-slate-100">
          <div className="flex items-baseline justify-between mb-3.5">
            <div>
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                Trade Price
              </span>
              <span className="text-lg sm:text-xl font-extrabold text-[#187004] tabular-nums font-heading">
                {formatNaira(product.price)}
              </span>
            </div>
            {isOutOfStock && (
              <span className="text-xs font-bold text-red-600">Unavailable</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {!isOutOfStock ? (
              <>
                <QuantityStepper
                  value={qty}
                  min={product.min_order_qty || 1}
                  onChange={setQty}
                  size="sm"
                  className="shrink-0"
                />
                <Button
                  type="button"
                  size="sm"
                  variant="primary"
                  onClick={handleAddToCart}
                  className="flex-1 min-h-[38px] text-xs gap-1.5"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Add to Cart</span>
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled
                className="w-full min-h-[38px] text-xs opacity-60 text-slate-400"
              >
                Out of Stock
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});
