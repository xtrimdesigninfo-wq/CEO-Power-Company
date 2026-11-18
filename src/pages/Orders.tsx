import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, ChevronUp, ShoppingBag, RotateCcw, Calendar, FileText, ArrowRight, AlertTriangle } from 'lucide-react';
import { OrderRequest } from '../types';
import { dataService } from '../services/dataService';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { formatNaira, formatDate } from '../lib/utils';
import { isCompletedOrder, buildReorderCartPlan } from '../lib/orderUtils';
import { OrderBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

export default function Orders() {
  const navigate = useNavigate();
  const { profile } = useAuthStore();
  const { replaceItems } = useCartStore();
  const { success, error: toastError } = useToast();

  const [orders, setOrders] = useState<OrderRequest[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reorderingOrderId, setReorderingOrderId] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    if (!profile) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await dataService.getOrderRequests(profile.id);
      setOrders(data);
    } catch (err: any) {
      console.error('Failed to load orders:', err);
      setLoadError(err?.message || 'Unable to load order history right now.');
    } finally {
      setIsLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleReorder = async (order: OrderRequest) => {
    if (reorderingOrderId) return;
    setReorderingOrderId(order.id);
    try {
      const allProducts = await dataService.getProducts({ activeOnly: false });
      const plan = buildReorderCartPlan(order, allProducts);

      if (plan.itemsToCart.length === 0) {
        toastError('Items from this order are no longer in stock or available.');
        return;
      }

      replaceItems(plan.itemsToCart);

      const addedCount = plan.itemsToCart.length;
      const parts = [
        `Cart repopulated with ${addedCount} ${addedCount === 1 ? 'item' : 'items'} from ${order.ref} at current wholesale prices.`,
      ];
      if (plan.skippedItems.length > 0) {
        parts.push(`${plan.skippedItems.length} unavailable/out-of-stock item(s) were skipped.`);
      }
      if (plan.adjustedMoqNames.length > 0) {
        parts.push(`MOQ applied for ${plan.adjustedMoqNames.join(', ')}.`);
      }

      success(parts.join(' '));
      navigate('/cart');
    } catch (err) {
      console.error('Failed to reorder:', err);
      toastError('Failed to reorder items. Please try again.');
    } finally {
      setReorderingOrderId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 font-heading">
            My Order History
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            View past wholesale requests submitted via WhatsApp and reorder instantly.
          </p>
        </div>
        <Link
          to="/catalog"
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-[#187004] hover:underline"
        >
          <span>Browse Catalog</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3].map(n => (
            <div key={n} className="bg-white rounded-2xl border border-slate-200 p-6 h-24 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && loadError && (
        <div className="text-center py-14 bg-white rounded-2xl border border-red-200 p-8 space-y-3">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-red-50 flex items-center justify-center text-red-600">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h3 className="text-base font-bold text-slate-900 font-heading">Unable to load your orders</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">{loadError}</p>
          <Button type="button" variant="outline" size="sm" onClick={loadOrders}>
            Retry
          </Button>
        </div>
      )}

      {!isLoading && !loadError && orders.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200 p-8">
          <div className="w-14 h-14 mx-auto mb-4 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
            <FileText className="w-7 h-7" />
          </div>
          <h3 className="text-lg font-bold text-slate-800 font-heading">No Orders Placed Yet</h3>
          <p className="text-sm text-slate-500 max-w-sm mx-auto mt-1">
            When you send orders through the portal, your tracking records and WhatsApp references will be listed here.
          </p>
          <Link
            to="/catalog"
            className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#187004] text-white text-xs font-bold hover:bg-[#0e3e03]"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Start an Order</span>
          </Link>
        </div>
      )}

      {!isLoading && !loadError && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map(order => {
            const isExpanded = expandedId === order.id;
            const itemsCount = order.items.reduce((s, i) => s + i.qty, 0);
            const completed = isCompletedOrder(order);
            const isReorderingThis = reorderingOrderId === order.id;

            return (
              <div
                key={order.id}
                data-order-ref={order.ref}
                data-order-status={order.status}
                className="bg-white rounded-2xl border border-slate-200/80 hover:border-slate-300/90 shadow-xs overflow-hidden transition-all"
              >
                {/* Header row */}
                <div
                  onClick={() => toggleExpand(order.id)}
                  className="p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50/50 transition-colors"
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200/70 text-[#187004] flex items-center justify-center font-bold text-sm shrink-0">
                      <FileText className="w-5 h-5 text-[#187004]" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2.5">
                        <span className="font-extrabold text-slate-900 font-heading text-base">
                          {order.ref}
                        </span>
                        <OrderBadge status={order.status} />
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {formatDate(order.created_at)}
                        </span>
                        <span>•</span>
                        <span>{itemsCount} {itemsCount === 1 ? 'item' : 'items'}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
                      <span className="text-base sm:text-lg font-black text-[#187004] tabular-nums font-heading">
                        {formatNaira(order.total)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {completed && (
                        <Button
                          type="button"
                          variant="primary"
                          size="sm"
                          isLoading={isReorderingThis}
                          disabled={reorderingOrderId !== null}
                          onClick={e => {
                            e.stopPropagation();
                            handleReorder(order);
                          }}
                          aria-label={`Reorder items from ${order.ref}`}
                          className="text-xs gap-1.5 font-bold shrink-0"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Reorder</span>
                        </Button>
                      )}

                      <button
                        type="button"
                        aria-label={isExpanded ? 'Collapse order details' : 'Expand order details'}
                        className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                      >
                        {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded Details */}
                {isExpanded && (
                  <div className="px-5 pb-5 pt-3 border-t border-slate-100 bg-slate-50/50 space-y-4 animate-in fade-in duration-150">
                    <div>
                      <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
                        Line Items
                      </h4>
                      <div className="space-y-2">
                        {order.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-3 rounded-xl bg-white border border-slate-100 text-sm"
                          >
                            <div className="flex items-center gap-3">
                              {item.image && (
                                <img
                                  src={item.image}
                                  alt={item.name}
                                  className="w-10 h-10 rounded-lg object-cover bg-slate-100 shrink-0"
                                />
                              )}
                              <div>
                                <p className="font-bold text-slate-800 text-xs sm:text-sm">
                                  {item.name}
                                </p>
                                <p className="text-xs text-slate-500">
                                  Qty: {item.qty} × {formatNaira(item.unit_price)}
                                </p>
                              </div>
                            </div>
                            <span className="font-bold text-slate-900 tabular-nums">
                              {formatNaira(item.line_total)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {order.note && (
                      <div className="p-3.5 rounded-xl bg-sky-50/70 border border-sky-200/70 text-xs">
                        <span className="font-bold text-sky-900">Order Note: </span>
                        <span className="text-sky-800">{order.note}</span>
                      </div>
                    )}

                    {/* Reorder Button */}
                    <div className="flex justify-end pt-2">
                      <Button
                        type="button"
                        variant={completed ? 'primary' : 'secondary'}
                        size="md"
                        isLoading={isReorderingThis}
                        disabled={reorderingOrderId !== null}
                        onClick={() => handleReorder(order)}
                        className="text-xs gap-1.5 font-bold"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>{completed ? 'Reorder' : 'Reorder Items at Current Prices'}</span>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
