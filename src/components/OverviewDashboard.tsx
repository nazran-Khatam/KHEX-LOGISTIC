import { useState, useEffect } from 'react';
import { Order } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend
} from 'recharts';
import { motion } from 'motion/react';
import { Package, TrendingUp, AlertCircle, Clock, Calendar, ChevronLeft, ChevronRight, List, Truck } from 'lucide-react';
import { universalParseDate } from '../lib/utils';
export { universalParseDate };

interface OverviewDashboardProps {
  orders: Order[];
  dateRangeType?: 'all' | 'today' | '7days' | '30days' | 'custom';
  customStartDate?: string;
  customEndDate?: string;
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

// Extract pickup date of an order
function getPickupDate(order: Order | undefined, strict = false): Date | null {
  if (!order) return null;
  if (order.pickedAt && (typeof order.pickedAt !== 'string' || order.pickedAt.trim() !== '')) {
    const d = universalParseDate(order.pickedAt);
    if (d && !isNaN(d.getTime())) return d;
  }
  
  if (order.movement && order.movement.length > 0) {
    const shippedStep = order.movement.find(m => {
      const statusLower = (m.status || '').toLowerCase();
      return statusLower.includes('ship') || statusLower.includes('transit') || statusLower.includes('pick');
    });
    if (shippedStep && shippedStep.timestamp) {
      const d = universalParseDate(shippedStep.timestamp);
      if (d && !isNaN(d.getTime())) return d;
    }
  }

  if (strict) return null;

  if (order.status === 'shipped' || order.status === 'delivered') {
    const createdTime = universalParseDate(order.orderDate) || new Date();
    return new Date(createdTime.getTime() + 1.5 * 3600 * 1000);
  }
  
  return null;
}

// Extract delivery date of an order
function getDeliveryDate(order: Order | undefined, strict = false): Date | null {
  if (!order) return null;
  if (order.deliveredAt && (typeof order.deliveredAt !== 'string' || order.deliveredAt.trim() !== '')) {
    const d = universalParseDate(order.deliveredAt);
    if (d && !isNaN(d.getTime())) return d;
  }

  // Check movement history first for direct "Delivered" step
  if (order.movement && order.movement.length > 0) {
    const deliveredStep = order.movement.find(m => {
      const statusLower = (m.status || '').toLowerCase();
      return statusLower.includes('deliver') || statusLower.includes('received');
    });
    if (deliveredStep && deliveredStep.timestamp) {
      const d = universalParseDate(deliveredStep.timestamp);
      if (d && !isNaN(d.getTime())) return d;
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
          const updatedAt = universalParseDate(order.updatedAt) || new Date();
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
        const d = universalParseDate(firstItem.firstSeen);
        if (d && !isNaN(d.getTime())) return d;
      }
    }
  }
  
  if (strict) return null;

  if (order.status === 'delivered') {
    return universalParseDate(order.updatedAt) || new Date();
  }
  
  return null;
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
  const [sortField, setSortField] = useState<'name' | 'orders' | 'pending' | 'delivered' | 'units' | 'minTime' | 'maxTime' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const handleSort = (field: 'name' | 'orders' | 'pending' | 'delivered' | 'units' | 'minTime' | 'maxTime') => {
    if (sortField === field) {
      if (sortDirection === 'desc') {
        setSortDirection('asc');
      } else {
        setSortField(null);
        setSortDirection('desc');
      }
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const renderSortIndicator = (field: 'name' | 'orders' | 'pending' | 'delivered' | 'units' | 'minTime' | 'maxTime') => {
    if (sortField !== field) {
      return <span className="opacity-0 group-hover:opacity-40 transition-opacity ml-1 inline-block select-none">↕</span>;
    }
    return (
      <span className="ml-1 text-slate-800 font-extrabold inline-block select-none text-[11px]">
        {sortDirection === 'asc' ? '↑' : '↓'}
      </span>
    );
  };

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

  const totalUnits = displayOrders.reduce((acc, order) => 
    acc + (order.items ? order.items.reduce((sum, item) => sum + (item.quantity || 0), 0) : 0), 0
  );

  // Average Delivery Time Calculation (Pickup Time to Received Time)
  let totalDays = 0;
  let validCount = 0;

  displayOrders.forEach(order => {
    const pickupDate = getPickupDate(order, true);
    const receivedDate = getDeliveryDate(order, true);

    if (pickupDate && receivedDate) {
      const diff = Math.max(0, receivedDate.getTime() - pickupDate.getTime());
      totalDays += diff / (1000 * 60 * 60 * 24);
      validCount++;
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
      const pickupDate = getPickupDate(order, true);
      const receivedDate = getDeliveryDate(order, true);
      if (pickupDate && receivedDate) {
        const diff = Math.max(0, receivedDate.getTime() - pickupDate.getTime());
        const diffDays = diff / (1000 * 60 * 60 * 24);
        acc[loc].times.push(diffDays);
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
        minVal,
        maxVal,
        minTime: minVal !== null ? formatDuration(minVal) : '-',
        maxTime: maxVal !== null ? formatDuration(maxVal) : '-'
      };
    });

  if (sortField) {
    locationData.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortField === 'orders') {
        comparison = a.orders - b.orders;
      } else if (sortField === 'pending') {
        comparison = a.pending - b.pending;
      } else if (sortField === 'delivered') {
        comparison = a.delivered - b.delivered;
      } else if (sortField === 'units') {
        comparison = a.units - b.units;
      } else if (sortField === 'minTime') {
        const valA = a.minVal === null ? (sortDirection === 'asc' ? Infinity : -Infinity) : a.minVal;
        const valB = b.minVal === null ? (sortDirection === 'asc' ? Infinity : -Infinity) : b.minVal;
        comparison = valA - valB;
      } else if (sortField === 'maxTime') {
        const valA = a.maxVal === null ? (sortDirection === 'asc' ? Infinity : -Infinity) : a.maxVal;
        const valB = b.maxVal === null ? (sortDirection === 'asc' ? Infinity : -Infinity) : b.maxVal;
        comparison = valA - valB;
      }
      return sortDirection === 'asc' ? comparison : -comparison;
    });
  } else {
    locationData.sort((a, b) => b.orders - a.orders);
  }

  // Dynamic axis scaling & ticks matching the target image (0, 9, 18, 27, 36)
  const activeMax = locationData.length > 0
    ? Math.max(
        ...locationData.map(d => {
          if (locationViewType === 'orders') return d.orders || 0;
          if (locationViewType === 'units') return d.units || 0;
          return Math.max(d.units || 0, d.orders || 0);
        })
      )
    : 36;

  const getNiceTicks = (max: number, viewType: string) => {
    if (viewType === 'units' || viewType === 'both') {
      if (max <= 36) {
        return [0, 9, 18, 27, 36];
      }
      const roundedMax = Math.ceil(max / 8) * 8;
      const step = roundedMax / 4;
      return [0, Math.round(step), Math.round(step * 2), Math.round(step * 3), roundedMax];
    } else {
      const roundedMax = Math.max(4, Math.ceil(max / 4) * 4);
      const step = roundedMax / 4;
      return [0, step, step * 2, step * 3, roundedMax];
    }
  };

  const chartTicks = getNiceTicks(activeMax, locationViewType);
  const chartDomain = [0, chartTicks[chartTicks.length - 1]];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard 
          icon={<List className="w-5 h-5 text-blue-600" />}
          label="Total Orders"
          value={displayOrders.length}
          subValue="Active Lifecycle"
          iconBgClass="bg-blue-50/80 border border-blue-100/30"
        />
        <MetricCard 
          icon={<Package className="w-5 h-5 text-emerald-600" />}
          label="Total Units"
          value={totalUnits.toLocaleString()}
          subValue="Unit of Bag"
          iconBgClass="bg-emerald-50/80 border border-emerald-100/30"
        />
        <MetricCard 
          icon={<Truck className="w-5 h-5 text-amber-600" />}
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
                  <th 
                    onClick={() => handleSort('name')}
                    className="pb-4 text-[10px] font-black uppercase tracking-widest text-black/30 hover:text-black/70 cursor-pointer select-none transition-colors group text-left"
                  >
                    <span className="inline-flex items-center">
                      Location
                      {renderSortIndicator('name')}
                    </span>
                  </th>
                  <th 
                    onClick={() => handleSort('orders')}
                    className="pb-4 text-[10px] font-black uppercase tracking-widest text-black/30 hover:text-black/70 cursor-pointer select-none transition-colors group text-center"
                  >
                    <span className="inline-flex items-center justify-center">
                      Orders
                      {renderSortIndicator('orders')}
                    </span>
                  </th>
                  <th 
                    onClick={() => handleSort('pending')}
                    className="pb-4 text-[10px] font-black uppercase tracking-widest text-black/30 hover:text-black/70 cursor-pointer select-none transition-colors group text-center"
                  >
                    <span className="inline-flex items-center justify-center">
                      Pending
                      {renderSortIndicator('pending')}
                    </span>
                  </th>
                  <th 
                    onClick={() => handleSort('delivered')}
                    className="pb-4 text-[10px] font-black uppercase tracking-widest text-black/30 hover:text-black/70 cursor-pointer select-none transition-colors group text-center"
                  >
                    <span className="inline-flex items-center justify-center">
                      Delivered
                      {renderSortIndicator('delivered')}
                    </span>
                  </th>
                  <th 
                    onClick={() => handleSort('units')}
                    className="pb-4 text-[10px] font-black uppercase tracking-widest text-black/30 hover:text-black/70 cursor-pointer select-none transition-colors group text-center"
                  >
                    <span className="inline-flex items-center justify-center">
                      Total Units
                      {renderSortIndicator('units')}
                    </span>
                  </th>
                  <th 
                    onClick={() => handleSort('minTime')}
                    className="pb-4 text-[10px] font-black uppercase tracking-widest text-black/30 hover:text-black/70 cursor-pointer select-none transition-colors group text-center"
                  >
                    <span className="inline-flex items-center justify-center">
                      Min Time
                      {renderSortIndicator('minTime')}
                    </span>
                  </th>
                  <th 
                    onClick={() => handleSort('maxTime')}
                    className="pb-4 text-[10px] font-black uppercase tracking-widest text-black/30 hover:text-black/70 cursor-pointer select-none transition-colors group text-center"
                  >
                    <span className="inline-flex items-center justify-center">
                      Max Time
                      {renderSortIndicator('maxTime')}
                    </span>
                  </th>
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
          <div className="flex flex-col gap-4 mb-6 mt-2">
            <h4 className="text-[13px] font-black uppercase tracking-[0.25em] text-[#5e7085]/90 select-none font-sans">
              VOLUME BY LOCATION
            </h4>
            
            {/* Filter Pill Buttons */ }
            <div className="flex bg-[#f4f4f6] p-1 rounded-full border border-gray-200/50 select-none gap-0.5 self-start" >
              <button 
                onClick={() => setLocationViewType('both')}
                className={`px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 ${
                  locationViewType === 'both' 
                    ? 'bg-white text-slate-800 shadow-[0_2px_8px_rgba(0,0,0,0.06)] font-black border border-neutral-100' 
                    : 'text-neutral-400 hover:text-neutral-600 font-bold'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-neutral-400 transition-all duration-200" />
                BOTH
              </button>
              <button 
                onClick={() => setLocationViewType('orders')}
                className={`px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 ${
                  locationViewType === 'orders' 
                    ? 'bg-white text-blue-600 shadow-[0_2px_8px_rgba(0,0,0,0.06)] font-black border border-neutral-100' 
                    : 'text-blue-500/50 hover:text-blue-600 font-bold'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#3b82f6] transition-all duration-200" />
                ORDERS
              </button>
              <button 
                onClick={() => setLocationViewType('units')}
                className={`px-3.5 py-1.5 rounded-full text-[10px] uppercase tracking-wider transition-all duration-200 flex items-center gap-1.5 ${
                  locationViewType === 'units' 
                    ? 'bg-white text-emerald-600 shadow-[0_2px_8px_rgba(0,0,0,0.06)] font-black border border-neutral-100' 
                    : 'text-emerald-500/50 hover:text-emerald-600 font-bold'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#10b981] transition-all duration-200" />
                UNITS
              </button>
            </div>
          </div>

          {/* Custom Image-Matched Legend */}
          <div className="flex items-center gap-6 mb-8 px-1 select-none">
            {locationViewType !== 'units' && (
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-[#3b82f6] shadow-sm" />
                <span className="text-[12.5px] font-extrabold text-[#3b82f6]">Quantity Orders</span>
              </div>
            )}
            {locationViewType !== 'orders' && (
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3.5 rounded-full bg-[#10b981] shadow-sm" />
                <span className="text-[12.5px] font-extrabold text-[#10b981]">Total Units</span>
              </div>
            )}
          </div>

          {locationData.length === 0 ? (
            <div className="h-[250px] flex flex-col items-center justify-center border border-dashed border-black/10 rounded-2xl bg-black/[0.01]">
              <span className="text-xs font-mono text-black/30">No location records in this time range</span>
            </div>
          ) : (
            <div className="h-[600px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart 
                  layout="vertical"
                  data={locationData}
                  margin={{ left: 5, right: 15, top: 0, bottom: 5 }}
                  barGap={4}
                  barCategoryGap="18%"
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                  <YAxis 
                    dataKey="name" 
                    type="category"
                    scale="band"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }}
                    width={85}
                  />
                  <XAxis 
                    type="number"
                    orientation="bottom"
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                    ticks={chartTicks}
                    domain={chartDomain}
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
                  <Bar 
                    name="Quantity Orders"
                    dataKey="orders" 
                    hide={locationViewType === 'units'}
                    radius={[0, 10, 10, 0]}
                    fill="#3b82f6"
                    barSize={locationViewType === 'both' ? 10 : 18}
                  />
                  <Bar 
                    name="Total Units"
                    dataKey="units" 
                    hide={locationViewType === 'orders'}
                    radius={[0, 10, 10, 0]}
                    fill="#10b981"
                    barSize={locationViewType === 'both' ? 10 : 18}
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
