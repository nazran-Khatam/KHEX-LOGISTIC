import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Package, Truck, CheckCircle2, ChevronRight } from 'lucide-react';
import { Order } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface OrderCardProps {
  order: Order;
  index: number;
  onClick: () => void;
  onLongPress?: (order: Order) => void;
  key?: string;
}

export default function OrderCard({ order, index, onClick, onLongPress }: OrderCardProps) {
  const statusConfig = {
    pending: { 
      icon: Package, 
      color: 'text-white', 
      bg: 'bg-zinc-400', 
      leftBarBg: 'bg-[#FF9800]', // Update indicator to match orange
      bulletBg: 'bg-[#FF9800]',
      statusLabel: 'PENDING',
      idColor: 'text-[#FF9800]'
    },
    shipped: { 
      icon: Truck, 
      color: 'text-white', 
      bg: 'bg-black', 
      leftBarBg: 'bg-black/80',
      bulletBg: 'bg-black',
      statusLabel: 'SHIPPED',
      idColor: 'text-[#3b82f6]'
    },
    delivered: { 
      icon: CheckCircle2, 
      color: 'text-white', 
      bg: 'bg-[#FF9800]', 
      leftBarBg: 'bg-[#10b981]', // Update indicator to match green
      bulletBg: 'bg-[#10b981]',
      statusLabel: 'DELIVERED',
      idColor: 'text-[#10b981]'
    }
  };

  const config = statusConfig[order.status] || statusConfig.pending;
  const Icon = config.icon;

  const getDisplayDate = () => {
    if (!order) return new Date();
    
    // For delivered orders, try to get delivery time from movement or updatedAt
    if (order.status === 'delivered') {
      if (order.updatedAt) {
        if (typeof order.updatedAt.toDate === 'function') return order.updatedAt.toDate();
        const d = new Date(order.updatedAt);
        if (!isNaN(d.getTime())) return d;
      }
      const deliveryStep = order.movement?.find(m => m.status.toLowerCase() === 'delivered');
      if (deliveryStep && deliveryStep.timestamp) {
        if (typeof deliveryStep.timestamp.toDate === 'function') return deliveryStep.timestamp.toDate();
        const d = new Date(deliveryStep.timestamp);
        if (!isNaN(d.getTime())) return d;
      }
    }

    if (order.orderDate) {
      if (typeof order.orderDate.toDate === 'function') return order.orderDate.toDate();
      const d = new Date(order.orderDate);
      if (!isNaN(d.getTime())) return d;
    }

    return new Date();
  };

  const orderDate = getDisplayDate();
  const formattedId = order.id.startsWith('#') ? order.id : `#${order.id.toUpperCase()}`;
  
  // Use first item name or trackingNumber as the Tracking Node
  const trackingNodeValue = order.items?.[0]?.name || order.trackingNumber || 'N/A';
  const locationValue = order.shippingAddress || 'Awaiting Node...';

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isLongPressRef = useRef(false);

  const startPress = (e: React.MouseEvent | React.TouchEvent) => {
    isLongPressRef.current = false;
    timerRef.current = setTimeout(() => {
      isLongPressRef.current = true;
      if (onLongPress) {
        onLongPress(order);
      }
    }, 600); // 600ms hold time
  };

  const endPress = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const handleTouchMove = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isLongPressRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onClick();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.05 }}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchMove={handleTouchMove}
      onClick={handleClick}
      className="group bg-white rounded-[32px] p-6 flex items-center gap-6 cursor-pointer border border-black/[0.03] hover:shadow-2xl hover:shadow-black/[0.05] transition-all active:scale-[0.99] relative overflow-hidden w-full select-none"
    >
      {/* Visual Indicator Line (Rounded with parent clip) */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", config.leftBarBg)} />

      {/* Hero Badge Icon */}
      <div className={cn(
        "w-16 h-16 rounded-[22px] flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:scale-105 duration-500", 
        config.bg
      )}>
        <Icon className={cn("w-7 h-7", config.color)} />
      </div>

      {/* main content */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Order Identifier */}
        <p className={cn("text-[15px] font-black tracking-tight flex items-center", config.idColor)}>
          {formattedId}
        </p>

        {/* Columns Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
          <div>
            <p className="text-[9px] uppercase tracking-[0.25em] text-black/25 font-black mb-1">Order Number</p>
            <p className="text-[13px] font-black text-black uppercase tracking-tight truncate">
              {trackingNodeValue}
            </p>
          </div>

          <div>
            <p className="text-[9px] uppercase tracking-[0.25em] text-black/25 font-black mb-1">Location</p>
            <p className="text-[13px] font-black text-black uppercase tracking-tight truncate">
              {locationValue}
            </p>
          </div>

          <div>
            <p className="text-[9px] uppercase tracking-[0.25em] text-black/25 font-black mb-1">Current Status</p>
            <div className="flex items-center gap-1.5">
              <span className={cn("w-2 h-2 rounded-full", config.bulletBg)} />
              <span className="text-[13px] font-black uppercase text-black">
                {config.statusLabel}
              </span>
            </div>
          </div>

          <div>
            <p className="text-[9px] uppercase tracking-[0.25em] text-black/25 font-black mb-1">Timestamp</p>
            <div className="flex flex-col">
              <p className="text-xs font-bold text-black/60 leading-tight">
                {format(orderDate, 'MMM d, yyyy')}
              </p>
              <p className="text-[9px] font-mono text-black/30 mt-0.5 leading-none">
                {format(orderDate, 'HH:mm')}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Action Trigger */}
      <div className="w-10 h-10 rounded-full bg-black/[0.02] border border-black/[0.04] flex items-center justify-center text-black/50 group-hover:bg-[#FF9800] group-hover:text-white group-hover:border-transparent transition-all duration-300 shrink-0">
        <ChevronRight className="w-5 h-5 transition-transform group-hover:translate-x-0.5" />
      </div>
    </motion.div>
  );
}

