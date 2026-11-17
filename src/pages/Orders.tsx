import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, ShoppingBag, RotateCcw, Calendar, FileText, ArrowRight } from 'lucide-react';
import { OrderRequest } from '../types';
import { dataService } from '../services/dataService';
import { useAuthStore } from '../store/authStore';
import { useCartStore } from '../store/cartStore';
import { formatNaira, formatDate } from '../lib/utils';
import { OrderBadge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { useToast } from '../components/ui/Toast';

export default function Orders() {
  const { profile } = useAuthStore();
  const { addItem } = useCartStore();
  const { success, error: toastError } = useToast();

  const [orders, setOrders] = useState<OrderRequest[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function loadOrders() {
      if (!profile) return;
      setIsLoading(true);
      try {
        const data = await dataService.getOrderRequests(profile.id);
        setOrders(data);
      } catch (err) {
        console.error('Failed to load orders:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadOrders();
  }, [profile]);

  const toggleExpand = (id: string) => {
    setExpandedId(prev => (prev === id ? null : id));
  };

  const handleReorder = async (order: OrderRequest) => {
    try {
      const allProducts = await dataService.getProducts({ activeOnly: false });
      const productMap = new Map(allProducts.map(p => [p.id, p]));

      let addedCount = 0;
      for (const item of order.items) {
        const currentProd = productMap.get(item.product_id);
        if (currentProd && currentProd.is_active && currentProd.stock_status !== 'out_of_stock') {
          addItem(currentProd, item.qty);
          addedCount++;
        }
      }

      if (addedCount > 0) {
        success(`Added ${addedCount} items back to your cart at current wholesale prices!`);
      } else {
        toastError('Items from this order are no longer in stock or available.');
      }
    } catch (err) {
      console.error('Failed to reorder:', err);
      toastError('Failed to reorder items. Please try again.');
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

      {!isLoading && orders.length === 0 && (
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

      {!isLoading && orders.length > 0 && (
        <div className="space-y-4">
          {orders.map(order => {
            const isExpanded = expandedId === order.id;
            const itemsCount = order.items.reduce((s, i) => s + i.qty, 0);

            return (
              <div
                key={order.id}
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

                  <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                    <div className="text-left sm:text-right">
                      <span className="text-[10px] uppercase font-bold text-slate-400 block">Total</span>
                      <span className="text-base sm:text-lg font-black text-[#187004] tabular-nums font-heading">
                        {formatNaira(order.total)}
                      </span>
                    </div>

                    <button
                      type="button"
                      aria-label={isExpanded ? 'Collapse order details' : 'Expand order details'}
                      className="p-2 text-slate-400 hover:text-slate-600 rounded-lg"
                    >
                      {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
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
                        variant="secondary"
                        size="md"
                        onClick={() => handleReorder(order)}
                        className="text-xs gap-1.5"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Reorder Items at Current Prices</span>
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
