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
}

// Average Delivery Time Calculation Helper Functions
function getResolvedMovement(order: Order): any[] {
  if (!order) return [];
  const safeGetDate = (date: any): Date => {
    if (!date) return new Date();
    if (typeof date.toDate === 'function') return date.toDate();
    const d = new Date(date);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const getDeliveryDate = () => {
    if (!order) return null;
    
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
  if (resolvedMovement.length === 0) {
    const createdTime = safeGetDate(order.orderDate);
    
    resolvedMovement.push({
      status: 'Order Placed',
      timestamp: createdTime,
      location: 'Khex Central Hub',
      description: 'Your order was successfully created and logged.'
    } as any);

    if (order.status === 'shipped' || order.status === 'delivered') {
      const shippedTime = new Date(createdTime.getTime() + 1.5 * 3600 * 1000);
      resolvedMovement.push({
        status: 'Picked up by Driver',
        timestamp: shippedTime,
        location: 'Khex Sorting Facility',
        description: 'Package picked up by dispatch driver for immediate transit.'
      } as any);
    }

    if (order.status === 'delivered') {
      const deliveryDate = getDeliveryDate();
      const deliveredTime = deliveryDate && !isNaN(deliveryDate.getTime())
        ? deliveryDate
        : new Date(createdTime.getTime() + 4 * 3600 * 1000);

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
    return dateA.getTime() - dateB.getTime();
  });
}

export default function OverviewDashboard({ orders }: OverviewDashboardProps) {
  const [dateRangeType, setDateRangeType] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);
  const [hoveredDateStr, setHoveredDateStr] = useState<string | null>(null);

  // Click-outside listener
  useEffect(() => {
    if (!isDatePickerOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.custom-datepicker-container')) {
        setIsDatePickerOpen(false);
        setShowMonthYearPicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isDatePickerOpen]);

  const monthNamesAbbrev = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const weekdays = ["M", "T", "W", "T", "F", "S", "S"];

  const getDaysInMonth = (year: number, month: number) => {
    return new Date(year, month + 1, 0).getDate();
  };

  const getDayOfWeekOffset = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Mon=0, Sun=6
  };

  const formatDatePickerLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    return `${d.getDate()} ${monthNamesAbbrev[d.getMonth()]} ${d.getFullYear()}`;
  };

  const makeDateStr = (year: number, month: number, day: number) => {
    const mStr = String(month + 1).padStart(2, '0');
    const dStr = String(day).padStart(2, '0');
    return `${year}-${mStr}-${dStr}`;
  };

  const handleDateClick = (dayStr: string) => {
    if (!customStartDate || (customStartDate && customEndDate)) {
      setCustomStartDate(dayStr);
      setCustomEndDate('');
    } else {
      const startTime = new Date(customStartDate).getTime();
      const clickedTime = new Date(dayStr).getTime();
      
      if (clickedTime < startTime) {
        setCustomStartDate(dayStr);
      } else {
        setCustomEndDate(dayStr);
        setIsDatePickerOpen(false);
      }
    }
  };

  const isSelectedStart = (dayDateStr: string) => {
    return customStartDate === dayDateStr;
  };

  const isSelectedEnd = (dayDateStr: string) => {
    return customEndDate === dayDateStr;
  };

  const isDateBetween = (dayDateStr: string) => {
    if (!customStartDate) return false;
    
    const dayTime = new Date(dayDateStr).getTime();
    const startTime = new Date(customStartDate).getTime();
    
    if (customEndDate) {
      const endTime = new Date(customEndDate).getTime();
      return dayTime > startTime && dayTime < endTime;
    }
    
    if (hoveredDateStr) {
      const hoverTime = new Date(hoveredDateStr).getTime();
      if (hoverTime > startTime) {
        return dayTime > startTime && dayTime < hoverTime;
      }
    }
    
    return false;
  };

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear(prev => prev - 1);
    } else {
      setViewMonth(prev => prev - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear(prev => prev + 1);
    } else {
      setViewMonth(prev => prev + 1);
    }
  };

  const getOrderDate = (order: Order): Date | null => {
    if (!order.orderDate) return null;
    if (typeof order.orderDate.toDate === 'function') {
      return order.orderDate.toDate();
    }
    const d = new Date(order.orderDate);
    return isNaN(d.getTime()) ? null : d;
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

  const totalValue = displayOrders.reduce((acc, order) => 
    acc + order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0), 0
  );

  // Average Delivery Time Calculation (Pickup Time to Received Time)
  const getDate = (date: any) => {
    if (!date) return null;
    if (typeof date.toDate === 'function') return date.toDate();
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
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
  const locationStatsMap = displayOrders.reduce((acc: Record<string, { orders: number, pending: number, delivered: number }>, order) => {
    const loc = order.shippingAddress ? (order.shippingAddress.split(',')[0] || 'Unknown') : 'Unknown'; 
    if (!acc[loc]) {
      acc[loc] = { orders: 0, pending: 0, delivered: 0 };
    }
    acc[loc].orders += 1;
    if (order.status === 'pending') acc[loc].pending += 1;
    if (order.status === 'delivered') acc[loc].delivered += 1;
    return acc;
  }, {});

  const locationData = Object.entries(locationStatsMap)
    .map(([name, stats]) => ({ name, ...stats }))
    .sort((a, b) => b.orders - a.orders);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-8"
    >
      {/* Top Header with Date Filter */}
      <div className="flex justify-end items-center gap-4 bg-white p-4 rounded-3xl border border-black/5 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 bg-black/[0.03] px-3 py-2 rounded-xl border border-black/5">
            <Calendar className="w-3.5 h-3.5 text-black/40" />
            <select
              value={dateRangeType}
              onChange={(e) => setDateRangeType(e.target.value as any)}
              className="bg-transparent border-none outline-none text-xs font-bold text-black cursor-pointer pr-4 focus:ring-0"
            >
              <option value="all">All Time</option>
              <option value="today">Today</option>
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {dateRangeType === 'custom' && (
            <div className="relative custom-datepicker-container min-w-[220px]">
              <button
                onClick={() => setIsDatePickerOpen(!isDatePickerOpen)}
                className="flex items-center justify-between w-full gap-2 bg-black/[0.03] hover:bg-black/[0.06] transition-colors p-3 py-2 rounded-xl border border-black/5 text-xs font-bold text-black cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-3.5 h-3.5 text-black/40" />
                  <span>
                    {customStartDate 
                      ? `${formatDatePickerLabel(customStartDate)}${customEndDate ? ` - ${formatDatePickerLabel(customEndDate)}` : ' - ...'}`
                      : 'Select Range'
                    }
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {(customStartDate || customEndDate) && (
                    <span 
                      onClick={(e) => {
                        e.stopPropagation();
                        setCustomStartDate('');
                        setCustomEndDate('');
                        setHoveredDateStr(null);
                      }} 
                      className="text-[10px] bg-black/5 hover:bg-black/10 px-1.5 py-0.5 rounded text-black/40 hover:text-black/80 uppercase font-black"
                    >
                      Clear
                    </span>
                  )}
                  <span className="text-[10px] text-black/40 font-black">▼</span>
                </div>
              </button>

              {isDatePickerOpen && (
                <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-black/10 rounded-2xl p-4 shadow-xl w-[265px] animate-fade-in text-black custom-datepicker-container">
                  {showMonthYearPicker ? (
                    <div className="py-1">
                      {/* Year slider */}
                      <div className="flex justify-between items-center px-1 mb-3 border-b border-black/5 pb-2">
                        <button 
                          onClick={() => setViewYear(prev => prev - 1)}
                          className="text-xs font-bold text-black/50 hover:text-black p-1 bg-black/[0.02] hover:bg-black/5 rounded"
                        >
                          &larr;
                        </button>
                        <span className="text-xs font-black text-black tracking-wider">{viewYear}</span>
                        <button 
                          onClick={() => setViewYear(prev => prev + 1)}
                          className="text-xs font-bold text-black/50 hover:text-black p-1 bg-black/[0.02] hover:bg-black/5 rounded"
                        >
                          &rarr;
                        </button>
                      </div>
                      
                      {/* Month selection grid */}
                      <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-bold">
                        {monthNames.map((name, mIdx) => (
                          <button
                            key={name}
                            onClick={() => {
                              setViewMonth(mIdx);
                              setShowMonthYearPicker(false);
                            }}
                            className={`py-2 rounded-xl transition-all ${
                              viewMonth === mIdx 
                                ? 'bg-black text-white' 
                                : 'bg-black/[0.02] text-black hover:bg-black/5'
                            }`}
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Header with Month/Year dropdown and left/right arrows */}
                      <div className="flex items-center justify-between mb-4">
                        <button
                          onClick={() => setShowMonthYearPicker(true)}
                          className="flex items-center gap-1 text-xs font-black uppercase text-neutral-800 hover:bg-black/5 px-2 py-1 rounded-lg transition-colors cursor-pointer text-left"
                        >
                          <span>{monthNames[viewMonth]} {viewYear}</span>
                          <span className="text-[8px] text-neutral-400">▼</span>
                        </button>

                        <div className="flex items-center gap-3">
                          <button
                            onClick={prevMonth}
                            className="text-neutral-500 hover:text-neutral-800 hover:bg-black/5 p-1 rounded-full text-sm font-bold transition-all w-6 h-6 flex items-center justify-center cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={nextMonth}
                            className="text-neutral-500 hover:text-neutral-800 hover:bg-black/5 p-1 rounded-full text-sm font-bold transition-all w-6 h-6 flex items-center justify-center cursor-pointer"
                          >
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Row labels: M T W T F S S */}
                      <div className="grid grid-cols-7 gap-y-1 gap-x-1 text-center text-[10px] font-bold text-black/35 tracking-wider mb-1.5">
                        {weekdays.map((day, i) => (
                          <div key={i}>{day}</div>
                        ))}
                      </div>

                      {/* Divider line */}
                      <div className="border-b border-black/[0.06] mb-2" />

                      {/* Month label divider (e.g. JUN) */}
                      <div className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8] mb-1.5 px-0.5 text-left">
                        {monthNames[viewMonth]}
                      </div>

                      {/* Dynamic grid of days */}
                      <div className="grid grid-cols-7 gap-y-1 gap-x-1 justify-items-center text-center">
                        {(() => {
                          const year = viewYear;
                          const month = viewMonth;
                          const total = getDaysInMonth(year, month);
                          const startOffset = getDayOfWeekOffset(year, month);
                          const cells = [];
                          
                          // Empty cells for offset offsets
                          for (let b = 0; b < startOffset; b++) {
                            cells.push(<div key={`blank-${b}`} className="w-8 h-8" />);
                          }
                          
                          // Days in month
                          for (let d = 1; d <= total; d++) {
                            const dateStr = makeDateStr(year, month, d);
                            const isStart = isSelectedStart(dateStr);
                            const isEnd = isSelectedEnd(dateStr);
                            const isBetween = isDateBetween(dateStr);
                            
                            cells.push(
                              <div key={`day-${d}`} className="relative w-full h-8 flex items-center justify-center">
                                {/* Connector highlight background lines */}
                                {isBetween && (
                                  <div className="absolute inset-y-1.5 left-0 right-0 bg-[#edf5ff]/80" />
                                )}
                                {isStart && (customEndDate || hoveredDateStr) && (
                                  <div className="absolute inset-y-1.5 left-1/2 right-0 bg-[#edf5ff]/80" />
                                )}
                                {isEnd && (
                                  <div className="absolute inset-y-1.5 left-0 right-1/2 bg-[#edf5ff]/80" />
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleDateClick(dateStr)}
                                  onMouseEnter={() => setHoveredDateStr(dateStr)}
                                  onMouseLeave={() => setHoveredDateStr(null)}
                                  className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                                    isStart
                                      ? 'border border-black bg-white text-black shadow-sm'
                                      : isEnd
                                        ? 'bg-[#edf5ff] border border-blue-200 text-[#2c6ec4] shadow-sm'
                                        : isBetween
                                          ? 'text-[#2c6ec4] bg-transparent hover:bg-blue-100/30'
                                          : 'text-neutral-700 hover:bg-black/5 font-medium'
                                  }`}
                                >
                                  {d}
                                </button>
                              </div>
                            );
                          }
                          
                          return cells;
                        })()}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard 
          icon={<Package className="w-5 h-5 text-blue-500" />}
          label="Total Orders"
          value={displayOrders.length}
          subValue="Active Lifecycle"
        />
        <MetricCard 
          icon={<TrendingUp className="w-5 h-5 text-emerald-500" />}
          label="Total Value"
          value={`$${totalValue.toLocaleString()}`}
          subValue="Revenue Flow"
        />
        <MetricCard 
          icon={<AlertCircle className="w-5 h-5 text-amber-500" />}
          label="In Transit"
          value={displayOrders.filter(o => o.status === 'shipped').length}
          subValue="Active Shipments"
        />
        <MetricCard 
          icon={<Clock className="w-5 h-5 text-indigo-500" />}
          label="Average Time"
          value={`${avgDeliveryTimeDays.toFixed(1)} Days`}
          subValue="Total Lead Time"
        />
      </div>

      {/* Main Charts area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Status Distribution */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 lg:col-span-1 border-b-4 border-b-blue-500">
          <h4 className="text-xs font-black uppercase tracking-[0.3em] text-black/40 mb-8">Status Distribution</h4>
          <div className="h-[300px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
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
                <Legend iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

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
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5">
                {locationData.map((loc) => (
                  <tr key={loc.name} className="group hover:bg-black/[0.02] transition-colors">
                    <td className="py-4 text-xs font-bold text-black">{loc.name}</td>
                    <td className="py-4 text-xs font-mono text-center text-black/60">{loc.orders}</td>
                    <td className="py-4 text-xs font-mono text-center text-amber-600 font-bold">{loc.pending}</td>
                    <td className="py-4 text-xs font-mono text-center text-emerald-600 font-bold">{loc.delivered}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Volume Analysis */}
        <div className="bg-white p-8 rounded-3xl shadow-sm border border-black/5 lg:col-span-3">
          <h4 className="text-xs font-black uppercase tracking-[0.3em] text-black/40 mb-8">Operational Volume (Total Orders)</h4>
          <div className="h-[200px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={volumeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis 
                  dataKey="name" 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  dy={10}
                />
                <YAxis 
                  axisLine={false} 
                  tickLine={false} 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
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
                  dataKey="count" 
                  radius={[6, 6, 0, 0]}
                  fill="#FF9800"
                  barSize={60}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

    </motion.div>
  );
}

function MetricCard({ icon, label, value, subValue }: any) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-black/5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="p-2 bg-black/5 rounded-xl">
          {icon}
        </div>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-widest text-black/30 mb-1">{label}</p>
        <p className="text-2xl font-sans font-bold text-black tracking-tight mb-1">{value}</p>
        <p className="text-[9px] text-black/40 font-medium">{subValue}</p>
      </div>
    </div>
  );
}
