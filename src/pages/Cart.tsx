import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShoppingBag, Trash2, ArrowLeft, Send, AlertTriangle, AlertCircle, Truck } from 'lucide-react';
import { useCartStore } from '../store/cartStore';
import { useAuthStore } from '../store/authStore';
import { formatNaira } from '../lib/utils';
import { QuantityStepper } from '../components/ui/QuantityStepper';
import { Button } from '../components/ui/Button';
import { dataService } from '../services/dataService';
import { buildWhatsAppOrderMessage, openWhatsAppChat } from '../lib/whatsapp';
import { useToast } from '../components/ui/Toast';

export default function Cart() {
  const { items, note, updateQuantity, removeItem, clearCart, setNote, getSubtotal } = useCartStore();
  const { profile } = useAuthStore();
  const { error: toastError } = useToast();
  const navigate = useNavigate();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [priceChangesAlert, setPriceChangesAlert] = useState<string[] | null>(null);

  const subtotal = getSubtotal();

  // Check if any items are out of stock
  const outOfStockItems = items.filter(item => item.product.stock_status === 'out_of_stock');
  const hasOutOfStock = outOfStockItems.length > 0;

  const handleSendOrder = async () => {
    if (!profile) {
      toastError('Please log in to submit your order.');
      navigate('/login');
      return;
    }

    if (items.length === 0) {
      toastError('Your cart is empty.');
      return;
    }

    if (hasOutOfStock) {
      toastError('Please remove out of stock items before proceeding.');
      return;
    }

    setIsSubmitting(true);
    setPriceChangesAlert(null);

    try {
      // Step 1: Re-fetch current prices and stock for every cart item from the database
      const verification = await dataService.verifyCartItems(
        items.map(i => ({
          product_id: i.product.id,
          qty: i.quantity,
          unit_price: i.product.price,
        }))
      );

      if (verification.hasChanges) {
        // Update cart store items to match current database state
        for (const updatedItem of verification.updatedItems) {
          const product = await dataService.getProductById(updatedItem.product_id);
          if (product) {
            useCartStore.getState().addItem(product, 0); // updates price & MOQ
            useCartStore.getState().updateQuantity(product.id, updatedItem.qty);
          }
        }
        setPriceChangesAlert(verification.changesList);
        setIsSubmitting(false);
        return;
      }

      // Calculate validated total and items
      const orderItems = items.map(item => ({
        product_id: item.product.id,
        name: item.product.name,
        qty: item.quantity,
        unit_price: item.product.price,
        line_total: item.product.price * item.quantity,
        image: item.product.images[0],
      }));

      const grandTotal = orderItems.reduce((sum, item) => sum + item.line_total, 0);

      // Step 2: Insert order_requests row and get its ref
      const newOrder = await dataService.createOrderRequest({
        reseller_id: profile.id,
        items: orderItems,
        total: grandTotal,
        note: note.trim() || undefined,
      });

      // Get settings for whatsapp_number
      const settings = await dataService.getSettings();

      // Step 3: Build required WhatsApp message
      const message = buildWhatsAppOrderMessage({
        ref: newOrder.ref,
        reseller: profile,
        items: orderItems,
        total: grandTotal,
        note: note.trim() || null,
      });

      // Open WhatsApp
      openWhatsAppChat(settings.whatsapp_number, message);

      // Step 4: Clear the cart and navigate to confirmation page
      clearCart();
      navigate(`/order-success/${newOrder.id}`, {
        state: { order: newOrder, whatsappNumber: settings.whatsapp_number, rawMessage: message },
      });
    } catch (err: any) {
      console.error('Order dispatch failed:', err);
      toastError(err.message || 'Failed to dispatch order. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto py-16 text-center bg-white rounded-2xl border border-slate-200/80 p-8">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-800 font-heading">Your Cart is Empty</h2>
        <p className="text-sm text-slate-500 max-w-sm mx-auto mt-2">
          Explore our wholesale catalog to add Tier-1 solar panels, inverters, and lithium energy storage systems.
        </p>
        <Link
          to="/catalog"
          className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#187004] text-white font-bold text-sm hover:bg-[#0e3e03] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Browse Wholesale Catalog</span>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-heading">
            Your Order Cart
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Review wholesale trade items before dispatching to WhatsApp.
          </p>
        </div>
        <Link
          to="/catalog"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-[#187004]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Continue Shopping</span>
        </Link>
      </div>

      {/* Price Changes Alert Banner */}
      {priceChangesAlert && (
        <div className="p-4 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 animate-in fade-in">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-bold">Catalog Prices or Quantities Were Updated</h3>
              <p className="text-xs text-amber-800 mt-1">
                The database reflects updated pricing or availability for your cart items:
              </p>
              <ul className="mt-2 text-xs list-disc list-inside space-y-1 font-medium">
                {priceChangesAlert.map((change, i) => (
                  <li key={i}>{change}</li>
                ))}
              </ul>
              <p className="mt-3 text-xs font-semibold text-amber-900">
                Please review your updated order total below and click "Send order on WhatsApp" to confirm.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Out of Stock Warning */}
      {hasOutOfStock && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-bold">Out of stock items detected</h3>
            <p className="text-xs text-red-700 mt-0.5">
              One or more items in your cart are currently out of stock. Please remove them to proceed with your order.
            </p>
          </div>
        </div>
      )}

      {/* Cart Layout: Items on Left, Summary on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Line Items */}
        <div className="lg:col-span-8 space-y-3">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs divide-y divide-slate-100 overflow-hidden">
            {items.map(item => {
              const isItemOutOfStock = item.product.stock_status === 'out_of_stock';
              const lineTotal = item.product.price * item.quantity;
              const mainImg = item.product.images[0] || 'https://images.unsplash.com/photo-1509391365360-2e959784a276?auto=format&fit=crop&w=800&q=80';

              return (
                <div
                  key={item.product.id}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors ${
                    isItemOutOfStock ? 'bg-red-50/40' : ''
                  }`}
                >
                  {/* Image & Info */}
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <img
                      src={mainImg}
                      alt={item.product.name}
                      className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl object-cover border border-slate-200 bg-slate-100 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">
                        {item.product.brand || 'CEO POWER'}
                      </span>
                      <Link
                        to={`/product/${item.product.slug}`}
                        className="text-sm sm:text-base font-bold text-slate-900 hover:text-[#187004] line-clamp-1 font-heading"
                      >
                        {item.product.name}
                      </Link>
                      <p className="text-xs text-slate-500 mt-0.5 font-medium">
                        Unit Price: <span className="font-bold text-slate-800 tabular-nums">{formatNaira(item.product.price)}</span>
                      </p>
                      {item.product.min_order_qty > 1 && (
                        <span className="mt-1 inline-flex items-center text-[10px] font-bold text-amber-800 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md">
                          MOQ: {item.product.min_order_qty}
                        </span>
                      )}
                      {isItemOutOfStock && (
                        <p className="text-xs font-bold text-red-600 mt-1">
                          Currently Out of Stock
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stepper, Line Total, Remove */}
                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <QuantityStepper
                      value={item.quantity}
                      min={item.product.min_order_qty || 1}
                      disabled={isItemOutOfStock}
                      onChange={qty => updateQuantity(item.product.id, qty)}
                      size="sm"
                    />

                    <div className="text-right min-w-[100px]">
                      <span className="text-[10px] text-slate-400 block uppercase font-bold">
                        Line Total
                      </span>
                      <span className="text-base font-extrabold text-[#187004] tabular-nums font-heading">
                        {formatNaira(lineTotal)}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeItem(item.product.id)}
                      aria-label={`Remove ${item.product.name} from cart`}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Order Note Field */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-4 sm:p-5">
            <label htmlFor="order-note" className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-2">
              Order Note / Site Delivery Instructions (Optional)
            </label>
            <textarea
              id="order-note"
              rows={3}
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Please arrange delivery to our warehouse at Bridgehead Onitsha, or specify required inverter firmware version..."
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#187004]"
            />
          </div>
        </div>

        {/* Order Summary on Right */}
        <div className="lg:col-span-4 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 sm:p-7 sticky top-24">
            <h2 className="text-lg font-bold text-slate-900 font-heading pb-3 border-b border-slate-100">
              Order Summary
            </h2>

            <div className="py-4 space-y-3 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Total Items</span>
                <span className="font-bold text-slate-900 tabular-nums">{items.reduce((s, i) => s + i.quantity, 0)} units</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Wholesale Subtotal</span>
                <span className="font-bold text-slate-900 tabular-nums">{formatNaira(subtotal)}</span>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Shipping / Logistics</span>
                <span className="text-xs text-sky-700 font-semibold">Coordinated via WhatsApp</span>
              </div>

              <div className="pt-3 border-t border-slate-200 flex justify-between items-baseline">
                <div>
                  <span className="text-xs uppercase font-bold text-slate-400 block">Grand Total</span>
                  <span className="text-2xl font-black text-[#187004] tabular-nums font-heading">
                    {formatNaira(subtotal)}
                  </span>
                </div>
              </div>
            </div>

            <div className="mb-4 p-3 rounded-xl bg-sky-50/80 border border-sky-200/70 flex items-start gap-2.5 text-xs text-sky-900">
              <Truck className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
              <span>Direct Onitsha HQ dispatch &amp; nationwide waybill scheduling confirmed upon WhatsApp submission.</span>
            </div>

            {/* Send on WhatsApp Button */}
            <div className="mt-4 space-y-3">
              <Button
                type="button"
                variant="whatsapp"
                size="lg"
                disabled={hasOutOfStock || isSubmitting}
                isLoading={isSubmitting}
                onClick={handleSendOrder}
                className="w-full text-base font-bold gap-2 py-4 shadow-md"
              >
                <Send className="w-5 h-5 fill-white/20" />
                <span>Send order on WhatsApp</span>
              </Button>

              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                By tapping send, your order will be recorded in your portal account and transferred directly into a verified WhatsApp message to CEO Power Company sales.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
