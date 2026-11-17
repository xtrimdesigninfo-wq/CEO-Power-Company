import React from 'react';
import { useParams, useLocation, Link } from 'react-router-dom';
import { CheckCircle2, MessageSquare, ArrowRight, FileText, ShoppingBag } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { formatNaira } from '../lib/utils';
import { openWhatsAppChat } from '../lib/whatsapp';
import { useCompanySettings } from '../hooks/useCompanySettings';
import { OrderRequest } from '../types';

export default function OrderSuccess() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const { settings } = useCompanySettings();
  const state = location.state as { order?: OrderRequest; whatsappNumber?: string; rawMessage?: string } | undefined;

  const order = state?.order;
  const rawMessage = state?.rawMessage || '';
  const whatsappNumber = state?.whatsappNumber || settings.whatsapp_number;
  const ref = order?.ref || 'CEO-ORDER';

  const handleReopenWhatsApp = () => {
    if (rawMessage) {
      openWhatsAppChat(whatsappNumber, rawMessage);
    } else {
      openWhatsAppChat(whatsappNumber, `Hello CEO Power Company, inquiring about order ${ref}`);
    }
  };

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-md p-6 sm:p-10 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 mx-auto rounded-full bg-green-50 border-4 border-green-100 flex items-center justify-center text-green-600 mb-6 shadow-xs animate-bounce">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <span className="inline-block px-3 py-1 rounded-full bg-green-100 text-green-800 text-xs font-bold uppercase tracking-wider mb-2">
          Order Recorded & Dispatched
        </span>

        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 font-heading">
          Order Reference: <span className="text-[#187004]">{ref}</span>
        </h1>

        <p className="mt-3 text-sm text-slate-600 max-w-md mx-auto leading-relaxed">
          Your order has been officially registered in the CEO Power Portal database and sent to our sales desk.
        </p>

        {/* Order Details Summary Box */}
        {order && (
          <div className="mt-8 p-5 rounded-2xl bg-slate-50 border border-slate-200/60 text-left space-y-3">
            <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider pb-2 border-b border-slate-200">
              <span>Items Ordered</span>
              <span>Total: {formatNaira(order.total)}</span>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {order.items.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="font-semibold text-slate-800 truncate mr-3">
                    {item.qty}x {item.name}
                  </span>
                  <span className="font-bold text-slate-900 tabular-nums shrink-0">
                    {formatNaira(item.line_total)}
                  </span>
                </div>
              ))}
            </div>

            {order.note && (
              <div className="pt-2 border-t border-slate-200 text-xs text-slate-600">
                <span className="font-bold">Note:</span> {order.note}
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="mt-8 space-y-3">
          <Button
            type="button"
            variant="whatsapp"
            size="lg"
            onClick={handleReopenWhatsApp}
            className="w-full text-base font-bold gap-2 py-4 shadow-md"
          >
            <MessageSquare className="w-5 h-5 fill-white/20" />
            <span>Reopen WhatsApp Chat</span>
          </Button>

          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              to="/orders"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-bold transition-colors"
            >
              <FileText className="w-4 h-4 text-slate-500" />
              <span>View Order History</span>
            </Link>

            <Link
              to="/catalog"
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#187004] hover:bg-[#0e3e03] text-white text-sm font-bold transition-colors"
            >
              <ShoppingBag className="w-4 h-4 text-[#F5A623]" />
              <span>Continue Shopping</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
