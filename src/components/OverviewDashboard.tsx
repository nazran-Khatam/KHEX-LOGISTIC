import { useState, useEffect } from 'react';
import { Order } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { motion } from 'motion/react';
import { Package, TrendingUp, AlertCircle, Clock, Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

interface OverviewDashboardProps {
  orders: Order[];
  dateRangeType?: 'all' | 'today' | '7days' | '30days' | 'custom';
  customStartDate?: string;
  customEndDate?: string;
}

export function universalParseDate(date: any): Date | null {
  if (!date) return null;
  // If it's a Firestore Timestamp or object with toDate()
  if (typeof date.toDate === 'function') {
    return date.toDate();
  }
  // If it has seconds / nanoseconds properties (serialized Firestore Timestamp)
  if (typeof date === 'object' && 'seconds' in date && typeof date.seconds === 'number') {
    return new Date(date.seconds * 1000 + Math.floor((date.nanoseconds || 0) / 1000000));
  }
  // If it's already a Date
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : date;
  }
  // If it is a number (milliseconds)
  if (typeof date === 'number') {
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  }
  // If it's a string, let's parse it carefully
  if (typeof date === 'string') {
    const trimmed = date.trim();
    if (!trimmed || trimmed === 'N/A' || trimmed === '-') return null;

    // Try parsing as standard ISO or browser-understood string first
    const nativeDate = new Date(trimmed);
    if (!isNaN(nativeDate.getTime())) {
      return nativeDate;
    }

    // Match DD/MM/YYYY hh:mm:ss with optional AM/PM
    const dmyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s*,\s*|\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i;
    const match = trimmed.match(dmyRegex);
    if (match) {
      const day = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1; // 0-indexed
      const year = parseInt(match[3], 10);
      let hour = parseInt(match[4], 10);
      const minute = parseInt(match[5], 10);
      const second = match[6] ? parseInt(match[6], 10) : 0;
      const ampm = match[7];

      if (ampm) {
        if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
        if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
      }

      const parsed = new Date(year, month, day, hour, minute, second);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    // Try just DD/MM/YYYY without times
    const dmyOnlyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
    const matchOnly = trimmed.match(dmyOnlyRegex);
    if (matchOnly) {
      const day = parseInt(matchOnly[1], 10);
      const month = parseInt(matchOnly[2], 10) - 1;
      const year = parseInt(matchOnly[3], 10);
      const parsed = new Date(year, month, day, 0, 0, 0);
      if (!isNaN(parsed.getTime())) {
        return parsed;
      }
    }
  }

  // Fallback
  const fallback = new Date(date);
  return isNaN(fallback.getTime()) ? null : fallback;
}

// Average Delivery Time Calculation Helper Functions
function getResolvedMovement(order: Order): any[] {
  if (!order) return [];
  const safeGetDate = (date: any): Date => {
    return universalParseDate(date) || new Date();
  };

  const getDeliveryDate = () => {
    if (!order) return null;
    
    // Check movement history first for direct "Delivered" step
    if (order.movement && order.movement.length > 0) {
      const deliveredStep = order.movement.find(m => {
        const statusLower = (m.status || '').toLowerCase();
        return statusLower.includes('deliver') || statusLower.includes('received');
      });
      if (deliveredStep && deliveredStep.timestamp) {
        return safeGetDate(deliveredStep.timestamp);
      }
    }
    
    // Check shippedItems for more precise delivery time
    if (order.shippedItems && Object.keys(order.shippedItems).length > 0) {
      const firstItem = Object.values(order.shippedItems)[0];
      if (firstItem && firstItem.firstSeen) {
        if (typeof firstItem.firstSeen === 'string') {
          // Parse "03:38:10 PM" format
          const timeMatch = firstItem.firstSeen.match(/(\d+):(\d+):(\d+)\s*(AM|PM)/i);
          if (timeMatch) {
            const updatedAt = safeGetDate(order.updatedAt);
            const d = new Date(updatedAt);
            let h = parseInt(timeMatch[1]);
            const m = parseInt(timeMatch[2]);
            const s = parseInt(timeMatch[3]);
            const period = timeMatch[4].toUpperCase();
            
            if (period === 'PM' && h < 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;
            
            d.setHours(h, m, s, 0);
            return d;
          }
        } else if (typeof firstItem.firstSeen === 'object') {
          return safeGetDate(firstItem.firstSeen);
        }
      }
    }
    
    if (order.status === 'delivered') {
      return safeGetDate(order.updatedAt);
    }
    
    return null;
  };

  const resolvedMovement = [...(order.movement || [])];
  const createdTime = safeGetDate(order.orderDate);

  // 1. Ensure "Order Placed" is present
  const hasOrderPlaced = resolvedMovement.some(m => {
    const s = (m.status || '').toLowerCase();
    return s.includes('place') || s.includes('create');
  });
  if (!hasOrderPlaced) {
    resolvedMovement.push({
      status: 'Order Placed',
      timestamp: createdTime,
      location: 'Khex Central Hub',
      description: 'Your order was successfully created and logged.'
    } as any);
  }

  // Get the normalized placement time
  const orderPlacedStep = resolvedMovement.find(m => {
    const s = (m.status || '').toLowerCase();
    return s.includes('place') || s.includes('create');
  });
  const placementTime = orderPlacedStep ? safeGetDate(orderPlacedStep.timestamp) : createdTime;

  // 2. Ensure "Picked up by Driver" or similar pickup step is present for shipped or delivered orders
  if (order.status === 'shipped' || order.status === 'delivered') {
    const hasPickup = resolvedMovement.some(m => {
      const s = (m.status || '').toLowerCase();
      return s.includes('ship') || s.includes('transit') || s.includes('pick');
    });
    if (!hasPickup) {
      const shippedTime = new Date(placementTime.getTime() + 1.5 * 3600 * 1000);
      resolvedMovement.push({
        status: 'Picked up by Driver',
        timestamp: shippedTime,
        location: 'Khex Sorting Facility',
        description: 'Package picked up by dispatch driver for immediate transit.'
      } as any);
    }
  }

  // 3. Ensure "Delivered" or similar delivery step is present for delivered orders
  if (order.status === 'delivered') {
    const hasDelivery = resolvedMovement.some(m => {
      const s = (m.status || '').toLowerCase();
      return s.includes('deliver') || s.includes('received');
    });
    if (!hasDelivery) {
      const deliveryDate = getDeliveryDate();
      const deliveredTime = deliveryDate && !isNaN(deliveryDate.getTime())
        ? deliveryDate
        : new Date(placementTime.getTime() + 4 * 3600 * 1000);

      resolvedMovement.push({
        status: 'Delivered',
        timestamp: deliveredTime,
        location: order.shippingAddress || 'Customer Reception',
        description: 'Package successfully delivered and received.'
      } as any);
    }
  }

  return resolvedMovement.slice().sort((a, b) => {
    const dateA = safeGetDate(a.timestamp);
    const dateB = safeGetDate(b.timestamp);
    const diff = dateA.getTime() - dateB.getTime();
    if (diff !== 0) return diff;
    
    const getPrec = (status: string) => {
      const s = (status || '').toLowerCase();
      if (s.includes('place') || s.includes('create')) return 1;
      if (s.includes('pick') || s.includes('ship') || s.includes('transit')) return 2;
      if (s.includes('deliver') || s.includes('receive')) return 3;
      return 4;
    };
    return getPrec(a.status) - getPrec(b.status);
  });
}

// Format duration helper function representing days in days, hours or minutes
function formatDuration(days: number): string {
  if (days <= 0) return '0d';
  if (days < 0.0417) { // < 1 hour
    const minutes = Math.round(days * 24 * 60);
    return `${minutes}m`;
  }
  if (days < 1) { // < 24 hours
    const hours = Math.round(days * 24);
    return `${hours}h`;
  }
  return `${days.toFixed(1)}d`;
}

export default function OverviewDashboard({ 
  orders,
  dateRangeType: propDateRangeType,
  customStartDate: propCustomStartDate,
  customEndDate: propCustomEndDate
}: OverviewDashboardProps) {
  const dateRangeType = propDateRangeType !== undefined ? propDateRangeType : 'all';
  const customStartDate = propCustomStartDate !== undefined ? propCustomStartDate : '';
  const customEndDate = propCustomEndDate !== undefined ? propCustomEndDate : '';

  const [monthViewType, setMonthViewType] = useState<'both' | 'orders' | 'units'>('both');
  const [locationViewType, setLocationViewType] = useState<'both' | 'orders' | 'units'>('both');

  const getOrderDate = (order: Order): Date | null => {
    return universalParseDate(order.orderDate);
  };

  const displayOrders = orders.filter(order => {
    const oDate = getOrderDate(order);
    if (!oDate) return dateRangeType === 'all';

    const now = new Date();
    
    if (dateRangeType === 'all') {
      return true;
    }
    
    if (dateRangeType === 'today') {
      return oDate.getFullYear() === now.getFullYear() &&
             oDate.getMonth() === now.getMonth() &&
             oDate.getDate() === now.getDate();
    }
    
    if (dateRangeType === '7days') {
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return oDate >= sevenDaysAgo && oDate <= now;
    }
    
    if (dateRangeType === '30days') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return oDate >= thirtyDaysAgo && oDate <= now;
    }
    
    if (dateRangeType === 'custom') {
      if (customStartDate) {
        const start = new Date(customStartDate);
        start.setHours(0, 0, 0, 0);
        if (oDate < start) return false;
      }
      if (customEndDate) {
        const end = new Date(customEndDate);
        end.setHours(23, 59, 59, 999);
        if (oDate > end) return false;
      }
      return true;
    }
    
    return true;
  });

  // Process data for Status Distribution
  const statusData = [
    { name: 'Pending', value: displayOrders.filter(o => o.status === 'pending').length, color: '#94a3b8' },
    { name: 'Shipped', value: displayOrders.filter(o => o.status === 'shipped').length, color: '#3b82f6' },
    { name: 'Delivered', value: displayOrders.filter(o => o.status === 'delivered').length, color: '#10b981' },
  ].filter(d => d.value > 0);

  // Simple daily order aggregation (mock dates if real dates aren't varied enough for a good graph)
  // For now, let's just group by status as a bar chart for volume
  const volumeData = [
    { name: 'Pending', count: displayOrders.filter(o => o.status === 'pending').length },
    { name: 'Shipped', count: displayOrders.filter(o => o.status === 'shipped').length },
    { name: 'Delivered', count: displayOrders.filter(o => o.status === 'delivered').length },
  ];

  // Process data for Total Units By Month
  const unitsByMonthMap = displayOrders.reduce((acc: Record<string, { label: string; units: number; orders: number }>, order) => {
    const oDate = getOrderDate(order);
    if (!oDate) return acc;
    
    const year = oDate.getFullYear();
    const month = oDate.getMonth();
    const key = `${year}-${String(month + 1).padStart(2, '0')}`;
    
    const monthNamesShort = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const label = `${monthNamesShort[month]} ${year}`;
    
    if (!acc[key]) {
      acc[key] = { label, units: 0, orders: 0 };
    }
    
    const orderUnits = order.items ? order.items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0;
    acc[key].units += orderUnits;
    acc[key].orders += 1;
    
    return acc;
  }, {});

  const unitsByMonthData = Object.entries(unitsByMonthMap)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([_, val]) => ({
      name: val.label,
      units: val.units,
      orders: val.orders
    }));

  const totalValue = displayOrders.reduce((acc, order) => 
    acc + order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0), 0
  );

  // Average Delivery Time Calculation (Pickup Time to Received Time)
  const getDate = (date: any) => {
    return universalParseDate(date);
  };

  let totalDays = 0;
  let validCount = 0;

  displayOrders.forEach(order => {
    const resolvedMovement = getResolvedMovement(order);
    
    // Find Pickup step
    const pickupStep = resolvedMovement.find(m => {
      const statusLower = (m.status || '').toLowerCase();
      return statusLower.includes('ship') || statusLower.includes('transit') || statusLower.includes('pick');
    });

    // Find Received step
    const receivedStep = resolvedMovement.find(m => {
      const statusLower = (m.status || '').toLowerCase();
      return statusLower.includes('deliver') || statusLower.includes('received');
    });

    if (pickupStep && receivedStep) {
      const pickupDate = getDate(pickupStep.timestamp);
      const receivedDate = getDate(receivedStep.timestamp);

      if (pickupDate && receivedDate) {
        const diff = Math.max(0, receivedDate.getTime() - pickupDate.getTime());
        totalDays += diff / (1000 * 60 * 60 * 24);
        validCount++;
      }
    }
  });

  const avgDeliveryTimeDays = validCount > 0 ? totalDays / validCount : 0;

  // Location-based Stats
  const locationStatsMap = displayOrders.reduce((acc: Record<string, { orders: number, pending: number, delivered: number, units: number, times: number[] }>, order) => {
    const loc = order.shippingAddress ? (order.shippingAddress.split(',')[0] || 'Unknown') : 'Unknown'; 
    if (!acc[loc]) {
      acc[loc] = { orders: 0, pending: 0, delivered: 0, units: 0, times: [] };
    }
    acc[loc].orders += 1;
    const orderUnits = order.items ? order.items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0;
    acc[loc].units += orderUnits;

    if (order.status === 'pending') acc[loc].pending += 1;
    if (order.status === 'delivered') {
      acc[loc].delivered += 1;

      // Extract delivery transit duration
      const resolvedMovement = getResolvedMovement(order);
      const pickupStep = resolvedMovement.find(m => {
        const s = (m.status || '').toLowerCase();
        return s.includes('ship') || s.includes('transit') || s.includes('pick');
      });
      const receivedStep = resolvedMovement.find(m => {
        const s = (m.status || '').toLowerCase();
        return s.includes('deliver') || s.includes('received');
      });

      if (pickupStep && receivedStep) {
        const pickupDate = getDate(pickupStep.timestamp);
        const receivedDate = getDate(receivedStep.timestamp);
        if (pickupDate && receivedDate) {
          const diff = Math.max(0, receivedDate.getTime() - pickupDate.getTime());
          const diffDays = diff / (1000 * 60 * 60 * 24);
          acc[loc].times.push(diffDays);
        }
      }
    }
    return acc;
  }, {});

  const locationData = Object.entries(locationStatsMap)
    .map(([name, stats]) => {
      const minVal = stats.times.length > 0 ? Math.min(...stats.times) : null;
      const maxVal = stats.times.length > 0 ? Math.max(...stats.times) : null;
      return {
        name,
        orders: stats.orders,
        units: stats.units,
        pending: stats.pending,
        delivered: stats.delivered,
        minTime: minVal !== null ? formatDuration(minVal) : '-',
        maxTime: maxVal !== null ? formatDuration(maxVal) : '-'
      };
    })
    .sort((a, b) => b.orders - a.orders);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard 
          icon={<Package className="w-5 h-5 text-blue-600" />}
          label="Total Orders"
          value={displayOrders.length}
          subValue="Active Lifecycle"
          iconBgClass="bg-blue-50/80 border border-blue-100/30"
        />
        <MetricCard 
          icon={<TrendingUp className="w-5 h-5 text-emerald-600" />}
          label="Total Value"
          value={`$${totalValue.toLocaleString()}`}
          subValue="Revenue Flow"
          iconBgClass="bg-emerald-50/80 border border-emerald-100/30"
        />
        <MetricCard 
          icon={<AlertCircle className="w-5 h-5 text-amber-600" />}
          label="In Transit"
          value={displayOrders.filter(o => o.status === 'shipped').length}
          subValue="Active Shipments"
          iconBgClass="bg-amber-50/80 border border-amber-100/30"
        />
        <MetricCard 
          icon={<Clock className="w-5 h-5 text-indigo-600" />}
          label="Average Time"
          value={`${avgDeliveryTimeDays.toFixed(1)} Days`}
          subValue="Total Lead Time"
          iconBgClass="bg-indigo-50/80 border border-indigo-100/30"
        />
      </div>

      {/* Row 2: Status Distribution & Monthly Volume */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Status Distribution */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 lg:col-span-1 flex flex-col justify-between">
          <div>
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-black/40 mb-6">Status Distribution</h4>
          </div>
          <div className="h-[250px] w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={85}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: 'none', 
                    borderRadius: '12px', 
                    boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                    fontSize: '12px',
                    fontWeight: 'bold'
                  }}
                />
                <Legend 
                  verticalAlign="bottom" 
                  align="center"
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingTop: '10px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly Volume (Orders & Units) */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 lg:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between items-start gap-4 mb-6">
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-black/40">Monthly Volume (Orders & Total Units)</h4>
            
            {/* Filter Pill Buttons */}
            <div className="flex bg-neutral-100 p-0.5 rounded-full border border-neutral-200/50">
              <button 
                onClick={() => setMonthViewType('both')}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-150 flex items-center gap-1.5 ${
                  monthViewType === 'both' 
                    ? 'bg-white text-neutral-800 shadow-[0_2px_4px_rgba(0,0,0,0.04)]' 
                    : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400" />
                Both
              </button>
              <button 
                onClick={() => setMonthViewType('orders')}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-150 flex items-center gap-1.5 ${
                  monthViewType === 'orders' 
                    ? 'bg-white text-blue-600 shadow-[0_2px_4px_rgba(0,0,0,0.04)]' 
                    : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                Orders
              </button>
              <button 
                onClick={() => setMonthViewType('units')}
                className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-wider transition-all duration-150 flex items-center gap-1.5 ${
                  monthViewType === 'units' 
                    ? 'bg-white text-emerald-600 shadow-[0_2px_4px_rgba(0,0,0,0.04)]' 
                    : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                Units
              </button>
            </div>
          </div>
          {unitsByMonthData.length === 0 ? (
            <div className="h-[250px] flex flex-col items-center justify-center border border-dashed border-black/10 rounded-2xl bg-black/[0.01]">
              <span className="text-xs font-mono text-black/30">No transaction records in this time range</span>
            </div>
          ) : (
            <div className="h-[250px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={unitsByMonthData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis 
                    dataKey="name" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                    dy={10}
                  />
                  <YAxis 
                    hide={monthViewType === 'units'}
                    orientation="left"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#3b82f6' }}
                  />
                  <YAxis 
                    hide={monthViewType === 'orders'}
                    yAxisId="right"
                    orientation="right"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#10b981' }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: 'none', 
                      borderRadius: '12px', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="left"
                    height={36} 
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingBottom: '15px' }}
                  />
                  <Bar 
                    name="Quantity Orders"
                    dataKey="orders" 
                    hide={monthViewType === 'units'}
                    radius={[6, 6, 0, 0]}
                    fill="#3b82f6"
                    barSize={24}
                  />
                  <Bar 
                    yAxisId="right"
                    name="Total Units"
                    dataKey="units" 
                    hide={monthViewType === 'orders'}
                    radius={[6, 6, 0, 0]}
                    fill="#10b981"
                    barSize={24}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Row 3: Regional Logistics Table & Volume by Location Vertical Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Units per Location Table */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 lg:col-span-2 overflow-hidden flex flex-col">
          <h4 className="text-xs font-black uppercase tracking-[0.3em] text-black/40 mb-8">Regional Logistics</h4>
          <div className="flex-1 overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-black/5">
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-black/30">Location</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-black/30 text-center">Orders</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-black/30 text-center">Pending</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-black/30 text-center">Delivered</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-black/30 text-center">Total Units</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-black/30 text-center">Min Time</th>
                  <th className="pb-4 text-[10px] font-black uppercase tracking-widest text-black/30 text-center">Max Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {locationData.map((loc) => (
                  <tr key={loc.name} className="group hover:bg-black/[0.02] transition-colors">
                    <td className="py-4 text-xs font-bold text-black">{loc.name}</td>
                    <td className="py-4 text-xs font-mono text-center text-black/60">{loc.orders}</td>
                    <td className="py-4 text-xs font-mono text-center text-amber-600 font-bold">{loc.pending}</td>
                    <td className="py-4 text-xs font-mono text-center text-emerald-600 font-bold">{loc.delivered}</td>
                    <td className="py-4 text-xs font-mono text-center text-emerald-600 font-bold">{loc.units}</td>
                    <td className="py-4 text-xs font-mono text-center text-indigo-600 font-medium">{loc.minTime}</td>
                    <td className="py-4 text-xs font-mono text-center text-violet-600 font-medium">{loc.maxTime}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Volume by Location (Orders & Total Units) */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 lg:col-span-1">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between items-start gap-4 mb-8">
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-black/40">Volume by Location</h4>
            
            {/* Filter Pill Buttons */ }
            <div className="flex bg-neutral-100 p-0.5 rounded-full border border-neutral-200/50" >
              <button 
                onClick={() => setLocationViewType('both')}
                className={`px-3.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all duration-150 flex items-center gap-1 ${
                  locationViewType === 'both' 
                    ? 'bg-white text-neutral-800 shadow-[0_2px_4px_rgba(0,0,0,0.04)]' 
                    : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                Both
              </button>
              <button 
                onClick={() => setLocationViewType('orders')}
                className={`px-3.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all duration-150 flex items-center gap-1 ${
                  locationViewType === 'orders' 
                    ? 'bg-white text-blue-600 shadow-[0_2px_4px_rgba(0,0,0,0.04)]' 
                    : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                Orders
              </button>
              <button 
                onClick={() => setLocationViewType('units')}
                className={`px-3.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider transition-all duration-150 flex items-center gap-1 ${
                  locationViewType === 'units' 
                    ? 'bg-white text-emerald-600 shadow-[0_2px_4px_rgba(0,0,0,0.04)]' 
                    : 'text-neutral-400 hover:text-neutral-600'
                }`}
              >
                Units
              </button>
            </div>
          </div>
          {locationData.length === 0 ? (
            <div className="h-[250px] flex flex-col items-center justify-center border border-dashed border-black/10 rounded-2xl bg-black/[0.01]">
              <span className="text-xs font-mono text-black/30">No location records in this time range</span>
            </div>
          ) : (
            <div className="h-[520px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  layout="vertical"
                  data={locationData}
                  margin={{ left: 5, right: 5, top: 0, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <YAxis 
                    dataKey="name" 
                    type="category"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                    width={80}
                  />
                  <XAxis 
                    type="number"
                    orientation="bottom"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 9, fontWeight: 700, fill: '#64748b' }}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ 
                      backgroundColor: 'white', 
                      border: 'none', 
                      borderRadius: '12px', 
                      boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                      fontSize: '12px',
                      fontWeight: 'bold'
                    }}
                  />
                  <Legend 
                    verticalAlign="top" 
                    align="left"
                    height={40} 
                    iconType="circle"
                    wrapperStyle={{ fontSize: '11px', fontWeight: 'bold', paddingBottom: '15px' }}
                  />
                  <Bar 
                    name="Quantity Orders"
                    dataKey="orders" 
                    hide={locationViewType === 'units'}
                    radius={[0, 6, 6, 0]}
                    fill="#3b82f6"
                    barSize={8}
                  />
                  <Bar 
                    name="Total Units"
                    dataKey="units" 
                    hide={locationViewType === 'orders'}
                    radius={[0, 6, 6, 0]}
                    fill="#10b981"
                    barSize={8}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function MetricCard({ icon, label, value, subValue, iconBgClass }: any) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm hover:shadow-md transition-all duration-200">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-2.5 rounded-xl flex items-center justify-center ${iconBgClass || 'bg-black/5'}`}>
          {icon}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.15em] text-neutral-400 mb-2">{label}</p>
        <p className="text-2xl font-sans font-bold text-black tracking-tight mb-1.5">{value}</p>
        <p className="text-[10px] text-neutral-400 font-medium">{subValue}</p>
      </div>
    </div>
  );
}
