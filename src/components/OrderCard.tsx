import { motion } from 'motion/react';
import { Package, Truck, CheckCircle2, ChevronRight, Clock } from 'lucide-react';
import { Order } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface OrderCardProps {
  order: Order;
  index: number;
  onClick: () => void;
  key?: string;
}

export default function OrderCard({ order, index, onClick }: OrderCardProps) {
  const statusConfig = {
    pending: { icon: Package, color: 'text-black/40', bg: 'bg-black/5', label: 'Processing' },
    shipped: { icon: Truck, color: 'text-white', bg: 'bg-black', label: 'In Transit' },
    delivered: { icon: CheckCircle2, color: 'text-white', bg: 'bg-[#FF9800]', label: 'Delivered' }
  };

  const config = statusConfig[order.status];
  const Icon = config.icon;

  const orderDate = order.orderDate?.toDate() || new Date();

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onClick={onClick}
      className="group bg-white rounded-[32px] p-8 flex flex-col md:flex-row items-center gap-8 cursor-pointer border border-black/[0.03] hover:shadow-2xl hover:shadow-black/[0.05] transition-all active:scale-[0.99] relative overflow-hidden"
    >
      {/* Visual Indicator Line */}
      <div className={cn(
        "absolute left-0 top-0 bottom-0 w-2 transition-all duration-700",
        order.status === 'pending' ? "bg-black/10" :
        order.status === 'shipped' ? "bg-black" :
        "bg-[#FF9800]"
      )} />

      <div className={cn("w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:scale-105 duration-500", config.bg)}>
        <Icon className={cn("w-8 h-8", config.color)} />
      </div>

      <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-8 w-full">
        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-black/20 font-black mb-2">Tracking Node</p>
          <p className="font-mono text-xs font-bold text-black">#{order.id.slice(0, 8).toUpperCase()}</p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-black/20 font-black mb-2">Location</p>
          <p className="text-sm font-black text-black uppercase tracking-tight truncate max-w-[200px]">
            {order.shippingAddress || 'Awaiting Node...'}
          </p>
        </div>

        <div>
          <p className="text-[10px] uppercase tracking-[0.3em] text-black/20 font-black mb-2">Current State</p>
          <div className="flex items-center gap-2">
            <span className={cn(
              "w-2 h-2 rounded-full", 
              order.status === 'pending' ? "bg-black/20" :
              order.status === 'shipped' ? "bg-black" :
              "bg-[#FF9800]"
            )} />
            <span className="text-xs font-black uppercase tracking-widest">{config.label}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-6 shrink-0 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-6 md:pt-0 mt-2 md:mt-0">
        <div className="text-right">
          <p className="text-[10px] font-black text-black/30 uppercase tracking-widest mb-1">Timestamp</p>
          <div className="flex flex-col items-end">
            <p className="text-xs font-bold text-black/60">{format(orderDate, 'MMM d, yyyy')}</p>
            <p className="text-[9px] font-mono text-black/30">{format(orderDate, 'HH:mm')}</p>
          </div>
        </div>
        <div className="w-10 h-10 rounded-full bg-black/[0.02] flex items-center justify-center group-hover:bg-[#FF9800] group-hover:text-white transition-all duration-300">
          <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
    </motion.div>
  );
}
