import { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Order, OrderStatus } from '../types';
import { LayoutDashboard, Package, Truck, CheckCircle2, LogOut, Search, MapPin, Plus, Edit2, Trash2, AlertOctagon, X, FileSpreadsheet, Calendar, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import OrderCard from './OrderCard';
import OrderDetails from './OrderDetails';
import Logo from './Logo';
import OverviewDashboard from './OverviewDashboard';
import CreateOrder from './CreateOrder';
import EditOrderModal from './EditOrderModal';
import ReportExportCard from './ReportExportCard';

interface DashboardProps {
  orders: Order[];
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ orders, user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<OrderStatus | 'all' | 'create' | 'report'>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [longPressedOrder, setLongPressedOrder] = useState<Order | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Date Filtering / Picker States & Helpers lifted from OverviewDashboard
  const [dateRangeType, setDateRangeType] = useState<'all' | 'today' | '7days' | '30days' | 'custom'>('all');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  
  const today = new Date();
  const [viewMonth, setViewMonth] = useState(today.getMonth());
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [showMonthYearPicker, setShowMonthYearPicker] = useState(false);
  const [hoveredDateStr, setHoveredDateStr] = useState<string | null>(null);

  // Click-outside listener
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.header-datepicker-container')) {
        setIsDropdownOpen(false);
        setIsDatePickerOpen(false);
        setShowMonthYearPicker(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  // Calendar helpers
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

  const confirmDelete = async () => {
    if (!longPressedOrder) return;
    setIsDeleting(true);
    try {
      await deleteDoc(doc(db, 'orders', longPressedOrder.id));
      setIsDeleteOpen(false);
      setLongPressedOrder(null);
    } catch (error) {
      console.error("Error deleting order:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const getOrderTimestamp = (order: Order): Date => {
    const safeGetDate = (date: any): Date | null => {
      if (!date) return null;
      if (typeof date.toDate === 'function') return date.toDate();
      const d = new Date(date);
      return isNaN(d.getTime()) ? null : d;
    };

    if (order.status === 'delivered') {
      if (order.movement && order.movement.length > 0) {
        const deliveredStep = order.movement.find(m => {
          const statusLower = (m.status || '').toLowerCase();
          return statusLower.includes('deliver') || statusLower.includes('received');
        });
        if (deliveredStep && deliveredStep.timestamp) {
          const d = safeGetDate(deliveredStep.timestamp);
          if (d) return d;
        }
      }

      if (order.shippedItems && Object.keys(order.shippedItems).length > 0) {
        const firstItem = Object.values(order.shippedItems)[0];
        if (firstItem && firstItem.firstSeen) {
          if (typeof firstItem.firstSeen === 'string') {
            const timeMatch = firstItem.firstSeen.match(/(\d+):(\d+):(\d+)\s*(AM|PM)/i);
            if (timeMatch) {
              const updatedAt = safeGetDate(order.updatedAt) || new Date();
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
          } else {
            const d = safeGetDate(firstItem.firstSeen);
            if (d) return d;
          }
        }
      }

      if (order.updatedAt) {
        const d = safeGetDate(order.updatedAt);
        if (d) return d;
      }
    }

    const d = safeGetDate(order.orderDate);
    if (d) return d;

    return new Date();
  };

  const getFilteredByDateOrders = (): Order[] => {
    return orders.filter(order => {
      const oDate = getOrderTimestamp(order);
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
  };

  const dateFilteredOrders = getFilteredByDateOrders();

  const filteredOrders = dateFilteredOrders
    .filter(order => {
      const matchesTab = activeTab === 'all' || order.status === activeTab;
      const matchesSearch = order.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           order.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                           order.shippingAddress?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    })
    .sort((a, b) => {
      const dateA = getOrderTimestamp(a);
      const dateB = getOrderTimestamp(b);
      return dateB.getTime() - dateA.getTime();
    });

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  const stats = {
    all: dateFilteredOrders.length,
    pending: dateFilteredOrders.filter(o => o.status === 'pending').length,
    shipped: dateFilteredOrders.filter(o => o.status === 'shipped').length,
    delivered: dateFilteredOrders.filter(o => o.status === 'delivered').length,
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#dbdbdb]">
      {/* Sidebar */}
      <aside className="w-72 bg-black border-r border-black/5 flex flex-col p-8 shrink-0 relative z-20">
        <div className="mb-12 flex justify-center">
          <Logo light />
        </div>

        <nav className="flex-1 space-y-1">
          <NavItem 
            active={activeTab === 'all'} 
            onClick={() => setActiveTab('all')}
            icon={<LayoutDashboard className="w-4 h-4" />}
            label="Overview"
            count={0}
          />
          <NavItem 
            active={activeTab === 'create'} 
            onClick={() => setActiveTab('create')}
            icon={<Plus className="w-4 h-4" />}
            label="Create"
            count={0}
          />
          <NavItem 
            active={activeTab === 'pending'} 
            onClick={() => setActiveTab('pending')}
            icon={<Package className="w-4 h-4" />}
            label="Orders"
            count={stats.pending}
          />
          <NavItem 
            active={activeTab === 'shipped'} 
            onClick={() => setActiveTab('shipped')}
            icon={<Truck className="w-4 h-4" />}
            label="Shipped"
            count={stats.shipped}
          />
          <NavItem 
            active={activeTab === 'delivered'} 
            onClick={() => setActiveTab('delivered')}
            icon={<CheckCircle2 className="w-4 h-4" />}
            label="Delivered"
            count={stats.delivered}
          />
          <NavItem 
            active={activeTab === 'report'} 
            onClick={() => setActiveTab('report')}
            icon={<FileSpreadsheet className="w-4 h-4" />}
            label="Reports"
            count={0}
          />
        </nav>

        <div className="mt-auto pt-8 border-t border-white/10 space-y-6">
          <div className="flex items-center gap-3">
            <img 
              src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
              alt={user.displayName || ''} 
              className="w-8 h-8 rounded grayscale border border-white/10"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-bold text-white uppercase tracking-widest truncate">{user.displayName}</p>
              <p className="text-[9px] text-white/20 uppercase tracking-tighter truncate">Verified Node</p>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center gap-3 text-white/40 hover:text-white transition-colors text-[9px] uppercase font-bold tracking-[0.2em]"
          >
            <LogOut className="w-3 h-3" />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col overflow-hidden bg-[#dbdbdb]">
        <header className="h-28 border-b border-black/10 flex items-center justify-between px-12 shrink-0 bg-[#FFA000] sticky top-0 z-50 shadow-lg">
          <div className="flex items-center gap-12">
            <h2 className="text-2xl font-sans font-bold text-black capitalize tracking-tight flex-shrink-0">
              {activeTab === 'all' ? 'Dashboard' : activeTab === 'create' ? 'Create Order' : activeTab === 'report' ? 'Logistics Reports' : activeTab.replace('-', ' ')}
            </h2>
            
            {/* Custom Premium Stats Card with Cream Background */}
            <div className="bg-[#FAF6F0] px-6 py-2.5 rounded-[18px] flex items-center gap-6 shadow-md border border-neutral-100 flex-shrink-0">
              <div className="text-center px-1">
                <p className="text-[10px] font-bold text-[#8B7E6F] tracking-widest uppercase mb-1">ORDERS</p>
                <p className="text-xl font-bold font-sans text-black leading-none">{stats.all}</p>
              </div>
              <div className="w-px h-8 bg-black/10"></div>
              <div className="text-center px-1">
                <p className="text-[10px] font-bold text-[#8B7E6F] tracking-widest uppercase mb-1">PENDING</p>
                <p className="text-xl font-bold font-sans text-black leading-none">{stats.pending}</p>
              </div>
              <div className="w-px h-8 bg-black/10"></div>
              <div className="text-center px-1">
                <p className="text-[10px] font-bold text-[#8B7E6F] tracking-widest uppercase mb-1">DELIVERED</p>
                <p className="text-xl font-bold font-sans text-black leading-none">{stats.delivered}</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="relative w-48 transition-all">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
              <input 
                type="text" 
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-neutral-100 rounded-xl py-3 pl-10 pr-3 focus:border-neutral-400 text-xs font-semibold outline-none text-black placeholder:text-neutral-400 shadow-sm"
              />
            </div>

            {/* Central Date Range Selector & Picker */}
            {(activeTab === 'all' || activeTab === 'pending' || activeTab === 'shipped' || activeTab === 'delivered' || activeTab === 'report') && (
              <div className="relative header-datepicker-container flex items-center">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="bg-white border border-neutral-100 rounded-xl py-3 pl-11 pr-10 hover:border-neutral-200 transition-all text-xs font-sans font-bold text-black outline-none shadow-sm cursor-pointer flex items-center gap-1 min-w-[140px] text-left relative"
                >
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
                  <span className="truncate">
                    {dateRangeType === 'all' && 'All Time'}
                    {dateRangeType === 'today' && 'Today'}
                    {dateRangeType === '7days' && 'Last 7 Days'}
                    {dateRangeType === '30days' && 'Last 30 Days'}
                    {dateRangeType === 'custom' && (
                      customStartDate 
                        ? `${formatDatePickerLabel(customStartDate)}${customEndDate ? ` - ${formatDatePickerLabel(customEndDate)}` : ' - ...'}`
                        : 'Custom Range'
                    )}
                  </span>
                  <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
                </button>

                {isDropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-black/15 shadow-xl rounded-2xl w-48 py-2 text-black animate-fade-in">
                    <button
                      type="button"
                      onClick={() => {
                        setDateRangeType('all');
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-black/[0.02] transition-colors ${dateRangeType === 'all' ? 'text-black bg-black/[0.03]' : 'text-neutral-700'}`}
                    >
                      All Time
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDateRangeType('today');
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-black/[0.02] transition-colors ${dateRangeType === 'today' ? 'text-black bg-black/[0.03]' : 'text-neutral-700'}`}
                    >
                      Today
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDateRangeType('7days');
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-black/[0.02] transition-colors ${dateRangeType === '7days' ? 'text-black bg-black/[0.03]' : 'text-neutral-700'}`}
                    >
                      Last 7 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDateRangeType('30days');
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-black/[0.02] transition-colors ${dateRangeType === '30days' ? 'text-black bg-black/[0.03]' : 'text-neutral-700'}`}
                    >
                      Last 30 Days
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDateRangeType('custom');
                        setIsDatePickerOpen(true);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-black/[0.02] transition-colors ${dateRangeType === 'custom' ? 'text-black bg-black/[0.03]' : 'text-neutral-700'}`}
                    >
                      Custom Range...
                    </button>
                  </div>
                )}

                {dateRangeType === 'custom' && isDatePickerOpen && (
                  <div className="absolute right-0 top-full mt-2 z-50 bg-white border border-black/10 rounded-2xl p-4 shadow-xl w-[265px] text-black">
                    {showMonthYearPicker ? (
                      <div className="py-1">
                        <div className="flex justify-between items-center px-1 mb-3 border-b border-black/5 pb-2">
                          <button 
                            type="button"
                            onClick={() => setViewYear(prev => prev - 1)}
                            className="text-xs font-bold text-black/50 hover:text-black p-1 bg-black/[0.02] hover:bg-black/5 rounded"
                          >
                            &larr;
                          </button>
                          <span className="text-xs font-black text-black tracking-wider">{viewYear}</span>
                          <button 
                            type="button"
                            onClick={() => setViewYear(prev => prev + 1)}
                            className="text-xs font-bold text-black/50 hover:text-black p-1 bg-black/[0.02] hover:bg-black/5 rounded"
                          >
                            &rarr;
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-3 gap-1.5 text-center text-xs font-bold">
                          {monthNames.map((name, mIdx) => (
                            <button
                              key={name}
                              type="button"
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
                        <div className="flex items-center justify-between mb-4">
                          <button
                            type="button"
                            onClick={() => setShowMonthYearPicker(true)}
                            className="flex items-center gap-1 text-xs font-black uppercase text-neutral-800 hover:bg-black/5 px-2 py-1 rounded-lg transition-colors cursor-pointer text-left"
                          >
                            <span>{monthNames[viewMonth]} {viewYear}</span>
                            <span className="text-[8px] text-neutral-400">▼</span>
                          </button>

                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={prevMonth}
                              className="text-neutral-500 hover:text-neutral-800 hover:bg-black/5 p-1 rounded-full text-sm font-bold transition-all w-6 h-6 flex items-center justify-center cursor-pointer"
                            >
                              <ChevronLeft className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={nextMonth}
                              className="text-neutral-500 hover:text-neutral-800 hover:bg-black/5 p-1 rounded-full text-sm font-bold transition-all w-6 h-6 flex items-center justify-center cursor-pointer"
                            >
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-7 gap-y-1 gap-x-1 text-center text-[10px] font-bold text-black/35 tracking-wider mb-1.5">
                          {weekdays.map((day, i) => (
                            <div key={i}>{day}</div>
                          ))}
                        </div>

                        <div className="border-b border-black/[0.06] mb-2" />

                        <div className="text-[10px] font-black uppercase tracking-widest text-[#94a3b8] mb-1.5 px-0.5 text-left">
                          {monthNames[viewMonth]}
                        </div>

                        <div className="grid grid-cols-7 gap-y-1 gap-x-1 justify-items-center text-center">
                          {(() => {
                            const year = viewYear;
                            const month = viewMonth;
                            const total = getDaysInMonth(year, month);
                            const startOffset = getDayOfWeekOffset(year, month);
                            const cells = [];
                            
                            for (let b = 0; b < startOffset; b++) {
                              cells.push(<div key={`blank-${b}`} className="w-8 h-8" />);
                            }
                            
                            for (let d = 1; d <= total; d++) {
                              const dateStr = makeDateStr(year, month, d);
                              const isStart = isSelectedStart(dateStr);
                              const isEnd = isSelectedEnd(dateStr);
                              const isDateBetweenVal = isDateBetween(dateStr);
                              
                              cells.push(
                                <div key={`day-${d}`} className="relative w-full h-8 flex items-center justify-center">
                                  {isDateBetweenVal && (
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
                                          : isDateBetweenVal
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

                        {/* Reset button at bottom of Custom Range picker */}
                        <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between">
                          <span className="text-[9px] text-[#8B7E6F] font-black uppercase tracking-wider">
                            {customStartDate ? 'Range Active' : 'Select Dates'}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setCustomStartDate('');
                              setCustomEndDate('');
                              setHoveredDateStr(null);
                              setDateRangeType('all');
                              setIsDatePickerOpen(false);
                            }}
                            className="bg-neutral-100 hover:bg-neutral-200 text-neutral-800 hover:text-neutral-900 border border-neutral-200/50 text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-lg transition-all cursor-pointer shadow-sm"
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-5xl mx-auto space-y-12">
            {activeTab === 'all' ? (
              <OverviewDashboard 
                orders={orders} 
                dateRangeType={dateRangeType}
                customStartDate={customStartDate}
                customEndDate={customEndDate}
              />
            ) : activeTab === 'create' ? (
              <CreateOrder userId={user.uid} onSuccess={() => setActiveTab('pending')} />
            ) : activeTab === 'report' ? (
              <ReportExportCard orders={orders} />
            ) : (
              <>
                <div className="flex justify-between items-end">
                  <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-black/20">Operational Manifests</h3>
                  <span className="text-[9px] px-3 py-1 bg-black text-white rounded-full uppercase font-bold tracking-widest">Live Stream</span>
                </div>

                <div className="space-y-4">
                  <AnimatePresence mode="popLayout">
                    {filteredOrders.length > 0 ? (
                      filteredOrders.map((order, idx) => (
                        <OrderCard 
                          key={order.id} 
                          order={order} 
                          index={idx}
                          onClick={() => setSelectedOrderId(order.id)}
                          onLongPress={(ord) => setLongPressedOrder(ord)}
                        />
                      ))
                    ) : (
                      <motion.div 
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center py-20 text-black/10"
                      >
                        <Package className="w-12 h-12 mb-4 opacity-5" />
                        <p className="text-sm font-serif italic">Neutral state. No active records.</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </>
            )}
          </div>
        </div>
      </main>

      {/* Detail Slide-over */}
      <OrderDetails 
        order={selectedOrder} 
        isOpen={!!selectedOrderId} 
        onClose={() => setSelectedOrderId(null)} 
      />

      {/* Long-press Action Choice Menu */}
      {longPressedOrder && !isEditOpen && !isDeleteOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-black/5 text-center space-y-6"
          >
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#FF9800]">OPERATIONAL MANIFEST ACTION</p>
              <h3 className="text-xl font-black text-black mt-2">
                Order #{longPressedOrder.id.replace('#', '').toUpperCase()}
              </h3>
              <p className="text-xs text-black/40 mt-1 font-medium font-sans uppercase">
                Location: {longPressedOrder.shippingAddress || 'Not Specified'}
              </p>
            </div>

            <div className="flex flex-col gap-3">
              <button
                onClick={() => setIsEditOpen(true)}
                className="w-full py-4 rounded-2xl bg-[#FF9800] text-black hover:scale-[1.02] active:scale-[0.98] transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-[#FF9800]/10"
              >
                <Edit2 className="w-4 h-4 text-black" />
                Edit Order Details
              </button>
              
              <button
                onClick={() => setIsDeleteOpen(true)}
                className="w-full py-4 rounded-2xl bg-red-50 hover:bg-red-100 text-red-600 hover:scale-[1.02] active:scale-[0.98] transition-all text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 font-mono"
              >
                <Trash2 className="w-4 h-4 text-red-600" />
                Delete Order Record
              </button>
              
              <button
                onClick={() => setLongPressedOrder(null)}
                className="w-full py-4 rounded-2xl bg-black/[0.04] text-black hover:bg-black/[0.08] transition-all text-xs font-black uppercase tracking-widest"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {isDeleteOpen && longPressedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-[32px] p-8 max-w-sm w-full shadow-2xl border border-red-100 text-center space-y-6"
          >
            <div className="mx-auto w-16 h-16 rounded-full bg-red-50 flex items-center justify-center text-red-500">
              <AlertOctagon className="w-8 h-8" />
            </div>

            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-600">CRITICAL SAFETY CONFIRMATION</p>
              <h3 className="text-lg font-black text-black mt-2">
                Delete Order #{longPressedOrder.id.replace('#', '').toUpperCase()}?
              </h3>
              <p className="text-xs text-black/40 mt-1 leading-relaxed">
                Are you sure you want to permanently delete this operational manifest? This action cannot be revoked and will immediately reflect down to sync node terminals.
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setIsDeleteOpen(false)}
                disabled={isDeleting}
                className="flex-1 py-4 rounded-2xl bg-black/[0.04] text-black hover:bg-black/[0.08] transition-all text-xs font-black uppercase tracking-widest disabled:opacity-50"
              >
                No, Keep
              </button>
              
              <button
                onClick={confirmDelete}
                disabled={isDeleting}
                className="flex-1 py-4 rounded-2xl bg-red-600 text-white hover:bg-red-700 transition-all text-xs font-black uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isDeleting ? 'Deleting...' : 'Yes, Delete'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Edit Order Modal Overlay */}
      <EditOrderModal 
        order={longPressedOrder}
        isOpen={isEditOpen}
        onClose={() => {
          setIsEditOpen(false);
          setLongPressedOrder(null);
        }}
      />
    </div>
  );
}

function HeaderStat({ label, value, color }: any) {
  return (
    <div className="text-center">
      <p className="text-[9px] uppercase text-black/40 font-bold tracking-[0.2em] leading-none mb-1">{label}</p>
      <p className={cn("text-lg font-sans font-bold leading-none", color)}>{value}</p>
    </div>
  );
}

function NavItem({ active, onClick, icon, label, count }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full flex items-center justify-between px-3.5 py-3 rounded-lg transition-all",
        active 
          ? "bg-white text-black shadow-xl font-bold" 
          : "text-white/65 hover:text-white hover:bg-white/10"
      )}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      </div>
      {count > 0 && (
        <span className={cn(
          "text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-tighter",
          active ? "bg-[#FF9800] border-[#FF9800] text-white" : "bg-transparent border-white/20 text-white/50"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}
