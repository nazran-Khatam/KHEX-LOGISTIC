import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Package, Truck, CheckCircle2, ChevronRight, PackageCheck } from 'lucide-react';
import { Order, OrderStatus } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { getPickupDate, getDeliveryDate } from './OrderDetails';
import { universalParseDate } from './OverviewDashboard';

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
    pickup: {
      icon: PackageCheck,
      color: 'text-white',
      bg: 'bg-amber-600',
      leftBarBg: 'bg-amber-500',
      bulletBg: 'bg-amber-500',
      statusLabel: 'PICKUP',
      idColor: 'text-amber-600'
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

  const isPickupStatus = (o: Order) => {
    if (!o) return false;
    const s = (o.status || '').toLowerCase();
    if (s === 'pickup' || s === 'ready') return true;
    if (s === 'pending' && (!!o.pickedAt || (o.movement && o.movement.some(m => (m.status || '').toLowerCase().includes('pick'))))) return true;
    return false;
  };

  const statusLower = (order.status || 'pending').toLowerCase();
  const isPickup = isPickupStatus(order);
  const normalizedStatus = isPickup ? 'pickup' : (statusLower as OrderStatus);
  const config = statusConfig[normalizedStatus as keyof typeof statusConfig] || statusConfig.pending;
  const statusLabelText = statusLower === 'ready' ? 'READY' : config.statusLabel;
  const Icon = config.icon;

  const getDisplayDate = () => {
    if (!order) return new Date();
    
    const safeGetDate = (date: any): Date | null => {
      return universalParseDate(date);
    };

    const statusMatch = (order.status || 'pending').toLowerCase();
    if (statusMatch === 'pickup' || statusMatch === 'ready' || isPickup) {
      const d = getPickupDate(order) || safeGetDate(order.orderDate);
      if (d) return d;
    } else if (statusMatch === 'pending') {
      const d = safeGetDate(order.orderDate);
      if (d) return d;
    } else if (statusMatch === 'shipped') {
      const d = getPickupDate(order);
      if (d) return d;
    } else if (statusMatch === 'delivered') {
      const d = getDeliveryDate(order);
      if (d) return d;
    }

    // Fallback
    const fallback = safeGetDate(order.orderDate) || safeGetDate(order.updatedAt) || new Date();
    return fallback;
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
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onMouseDown={startPress}
      onMouseUp={endPress}
      onMouseLeave={endPress}
      onTouchStart={startPress}
      onTouchEnd={endPress}
      onTouchMove={handleTouchMove}
      onClick={handleClick}
      className="group bg-white rounded-2xl md:rounded-[32px] p-3.5 md:p-6 flex cursor-pointer border border-black/[0.04] hover:shadow-2xl hover:shadow-black/[0.05] transition-all active:scale-[0.99] relative overflow-hidden w-full select-none"
    >
      {/* Visual Indicator Line */}
      <div className={cn("absolute left-0 top-0 bottom-0 w-1.5", config.leftBarBg)} />

      {/* ==================== MOBILE VIEW (< md) ==================== */}
      <div className="md:hidden flex flex-col gap-2.5 w-full">
        {/* Top Header Row: ID + Status Pill */}
        <div className="flex items-center justify-between gap-2 pl-1">
          <p className={cn("text-xs font-extrabold tracking-tight truncate", config.idColor)}>
            {formattedId}
          </p>
          <div className="flex items-center gap-1.5 bg-black/[0.03] px-2.5 py-0.5 rounded-full border border-black/[0.04] shrink-0">
            <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", config.bulletBg)} />
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-black/80">
              {statusLabelText}
            </span>
          </div>
        </div>

        {/* Main Content Body */}
        <div className="flex items-start gap-3 pl-1 relative min-h-[72px]">
          {/* Hero Package Badge Icon */}
          <div className={cn(
            "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm transition-transform group-hover:scale-105 duration-300 mt-0.5", 
            config.bg
          )}>
            <Icon className={cn("w-5 h-5", config.color)} />
          </div>

          {/* Center Details Column: ORDER NUMBER stacked above LOCATION */}
          <div className="flex-1 flex flex-col gap-2 min-w-0 pr-24">
            <div className="min-w-0">
              <p className="text-[8.5px] uppercase tracking-wider text-black/35 font-extrabold mb-0.5 truncate">
                ORDER NUMBER
              </p>
              <p className="text-xs font-black text-black uppercase tracking-tight truncate">
                {trackingNodeValue}
              </p>
            </div>

            <div className="min-w-0">
              <p className="text-[8.5px] uppercase tracking-wider text-black/35 font-extrabold mb-0.5 truncate">
                LOCATION
              </p>
              <p className="text-xs font-black text-black uppercase tracking-tight truncate">
                {locationValue}
              </p>
            </div>
          </div>

          {/* Right Column: Arrow Button at top-right & Timestamp at bottom-right */}
          <div className="absolute right-0 top-0 bottom-0 flex flex-col justify-between items-end">
            {/* Action Arrow */}
            <div className="w-7 h-7 rounded-full bg-black/[0.03] border border-black/[0.04] flex items-center justify-center text-black/30 group-hover:bg-[#FF9800] group-hover:text-white group-hover:border-transparent transition-all duration-300 shrink-0">
              <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </div>

            {/* Timestamp at Bottom Right */}
            <div className="text-right">
              <p className="text-[7.5px] uppercase tracking-wider text-black/30 font-extrabold mb-[1px] truncate">
                TIMESTAMP
              </p>
              <p className="text-[10px] font-semibold text-black/70 flex items-center gap-1 justify-end truncate">
                <span className="text-black/80 font-bold">{format(orderDate, 'MMM d, yyyy')}</span>
                <span className="text-[8.5px] font-mono text-black/35">{format(orderDate, 'HH:mm')}</span>
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ==================== DESKTOP VIEW (>= md) ==================== */}
      <div className="hidden md:flex items-center gap-6 w-full pl-2">
        {/* Hero Package Badge Icon */}
        <div className={cn(
          "w-16 h-16 rounded-[22px] flex items-center justify-center shrink-0 shadow-lg transition-transform group-hover:scale-105 duration-500", 
          config.bg
        )}>
          <Icon className={cn("w-7 h-7", config.color)} />
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          {/* Order Identifier */}
          <p className={cn("text-[15px] font-black tracking-tight flex items-center", config.idColor)}>
            {formattedId}
          </p>

          {/* Columns Grid */}
          <div className="grid grid-cols-4 gap-4 w-full">
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
                  {statusLabelText}
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
      </div>
    </motion.div>
  );
}

