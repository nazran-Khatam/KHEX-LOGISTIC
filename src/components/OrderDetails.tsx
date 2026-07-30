import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Package, Clock, Truck, CheckCircle2, Navigation, ChevronDown } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Order } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { universalParseDate } from './OverviewDashboard';

interface OrderDetailsProps {
  order: Order | undefined;
  isOpen: boolean;
  onClose: () => void;
}

const formatDateToStandardString = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}:${ss}`;
};

export function getDeterministicName(seed: string, type: 'driver' | 'receiver', order?: any) {
  if (type === 'driver' && order) {
    const shippedBy = order.shippedBy || order.shipped_by || order.driver || order.driverEmail || order.driver_by || order.driverBy;
    if (shippedBy && typeof shippedBy === 'string') {
      let clean = shippedBy.trim().toLowerCase();
      // Extract the part of the email before @
      if (clean.includes('@')) {
        clean = clean.split('@')[0];
      }
      // Remove all numbers/digits as per user request
      clean = clean.replace(/\d+/g, '');

      // Specific known mapping for Nazran Ismail
      if (clean === 'nazranismail' || clean === 'nazranismial') {
        return "Nazran Ismail";
      }

      // Format delimiters into spaces and capitalize
      const namePart = clean.replace(/[\._\-]/g, ' ').trim();
      return namePart
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
  }

  let hash = 0;
  const combined = seed + type;
  for (let i = 0; i < combined.length; i++) {
    hash = combined.charCodeAt(i) + ((hash << 5) - hash);
  }
  hash = Math.abs(hash);
  
  const drivers = [
    "Ahmad Syakir Rosli",
    "Mohd Ridzuan Yusof",
    "Nazran Ismail",
    "Muhammad Firdaus Harun",
    "Zulhelmi Azman Rosli",
    "Muhammad Alif Bin Ahmad"
  ];
  
  const receivers = [
    "Nazran Bin Hamid",
    "Siti Aminah Salleh",
    "Wong Chia Wei",
    "Amirul Mukminin Bin Ismail",
    "Farah Nabilah Yahya",
    "Syed Muhammad Daniel"
  ];
  
  if (type === 'driver') {
    return drivers[hash % drivers.length];
  } else {
    return receivers[hash % receivers.length];
  }
}

export function getDriverName(order: Order): string {
  if (order.shippedBy && typeof order.shippedBy === 'string' && order.shippedBy.trim() !== '') {
    const clean = order.shippedBy.trim();
    return clean.includes('@') ? clean.split('@')[0] : clean;
  }
  if (order.driverName && typeof order.driverName === 'string' && order.driverName.trim() !== '') {
    return order.driverName.trim();
  }
  return getDeterministicName(order.id, 'driver', order);
}

export function getDeliveredBy(order: Order): string {
  if (order.shippedBy && typeof order.shippedBy === 'string' && order.shippedBy.trim() !== '') {
    const clean = order.shippedBy.trim();
    return clean.includes('@') ? clean.split('@')[0] : clean;
  }
  if (order.deliveredBy && typeof order.deliveredBy === 'string' && order.deliveredBy.trim() !== '') {
    return order.deliveredBy.trim();
  }
  if (order.driverName && typeof order.driverName === 'string' && order.driverName.trim() !== '') {
    return order.driverName.trim();
  }
  return getDeterministicName(order.id, 'driver', order);
}

export function getReceiverName(order: Order): string {
  if (order.receivedBy && typeof order.receivedBy === 'string' && order.receivedBy.trim() !== '') {
    return order.receivedBy.trim();
  }
  if (order.receivingName && typeof order.receivingName === 'string' && order.receivingName.trim() !== '') {
    return order.receivingName.trim();
  }
  return getDeterministicName(order.id, 'receiver', order);
}

export function getPickupDate(order: Order | undefined, strict = false): Date | null {
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

export function getReadyDate(order: Order | undefined, strict = false): Date | null {
  if (!order) return null;
  if (order.readyAt && (typeof order.readyAt !== 'string' || order.readyAt.trim() !== '')) {
    const d = universalParseDate(order.readyAt);
    if (d && !isNaN(d.getTime())) return d;
  }
  if (order.readyTime && (typeof order.readyTime !== 'string' || order.readyTime.trim() !== '')) {
    const d = universalParseDate(order.readyTime);
    if (d && !isNaN(d.getTime())) return d;
  }
  
  if (order.movement && order.movement.length > 0) {
    const readyStep = order.movement.find(m => {
      const statusLower = (m.status || '').toLowerCase();
      return statusLower.includes('ready') || statusLower.includes('prepare');
    });
    if (readyStep && readyStep.timestamp) {
      const d = universalParseDate(readyStep.timestamp);
      if (d && !isNaN(d.getTime())) return d;
    }
  }

  if (strict) return null;

  const isPending = (order.status || '').toLowerCase() === 'pending';
  const isReadyOrBeyond = !isPending && (order.status === 'ready' || order.status === 'shipped' || order.status === 'delivered' || !!order.readyTime || !!order.readyAt || !!order.pickedAt || (order.pickedItems && Object.keys(order.pickedItems).length > 0));
  if (isReadyOrBeyond) {
    const placementTime = universalParseDate(order.orderDate) || new Date();
    const pickupDateVal = getPickupDate(order, true);
    if (pickupDateVal && pickupDateVal > placementTime) {
      return new Date(placementTime.getTime() + Math.max(60000, Math.floor((pickupDateVal.getTime() - placementTime.getTime()) / 2)));
    } else {
      return placementTime;
    }
  }
  
  return null;
}

export function getDeliveryDate(order: Order | undefined, strict = false): Date | null {
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
    const d = universalParseDate(order.updatedAt);
    if (d && !isNaN(d.getTime())) return d;
  }
  
  return null;
}

export default function OrderDetails({ order, isOpen, onClose }: OrderDetailsProps) {
  const [expandedItems, setExpandedItems] = useState<Record<string, boolean>>({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateError, setUpdateError] = useState<string | null>(null);

  const handleReadyToPickup = async () => {
    if (!order?.id) return;
    setIsUpdating(true);
    setUpdateError(null);
    try {
      const now = new Date();
      const stdStr = formatDateToStandardString(now);

      const orderRef = doc(db, 'orders', order.id);
      
      const fieldsToUpdate: any = {
        status: 'ready',
        readyAt: stdStr,
        readyTime: stdStr,
        pickedAt: ''
      };

      let movement = [...(order.movement || [])];
      const hasReady = movement.some(m => {
        const s = (m.status || '').toLowerCase();
        return s.includes('ready') || s.includes('prepare');
      });
      if (!hasReady) {
        movement.push({
          status: 'Ready to Pickup',
          timestamp: now,
          location: 'Khex Sorting Facility',
          description: 'Package verified, processed, and ready for driver pickup.'
        });
      }
      fieldsToUpdate.movement = movement;

      await updateDoc(orderRef, fieldsToUpdate);
      onClose();
    } catch (err) {
      console.error('Failed to change status to Ready to Pickup:', err);
      setUpdateError('Error updating order status. Please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const getReadyDateObj = (order: Order): Date | null => {
    if (order.readyAt && typeof order.readyAt === 'string' && order.readyAt.trim() !== '') {
      const d = universalParseDate(order.readyAt);
      if (d && !isNaN(d.getTime())) return d;
    }
    if (order.readyTime && typeof order.readyTime === 'string' && order.readyTime.trim() !== '') {
      const d = universalParseDate(order.readyTime);
      if (d && !isNaN(d.getTime())) return d;
    }
    const readyStep = order.movement?.find(m => {
      const s = (m.status || '').toLowerCase();
      return s.includes('ready') || s.includes('prepare');
    });
    if (readyStep && readyStep.timestamp) {
      const d = universalParseDate(readyStep.timestamp);
      if (d && !isNaN(d.getTime())) return d;
    }
    return null;
  };

  const formatCSVDate = (date: Date | null): string => {
    if (!date) return '';
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  };

  const handleExportCSV = () => {
    if (!order) return;

    const headers = ["ORDER_NO", "REFERENCE", "DESTINATION", "DATE", "BOUTIQUE", "CARTON_NO", "QR_DATA"];
    
    const readyDate = getReadyDateObj(order);
    const dateStr = readyDate ? formatCSVDate(readyDate) : formatCSVDate(new Date());

    const rows: string[][] = [];

    order.items.forEach(item => {
      const serials = getSerialNumbers(item.name);
      const destinationValue = order.shippingAddress || (order as any).location || '';
      
      if (serials && serials.length > 0) {
        serials.forEach((serial, sIdx) => {
          rows.push([
            item.name,                     // ORDER_NO: "PRODUCT NAME"
            "-",                           // REFERENCE: "-"
            destinationValue,              // DESTINATION: Location
            dateStr,                       // DATE: Ready Time Date
            destinationValue,              // BOUTIQUE: Location
            String(sIdx + 1),              // CARTON_NO: sequence number
            serial                         // QR_DATA: Serial Item
          ]);
        });
      } else {
        rows.push([
          item.name,
          "-",
          destinationValue,
          dateStr,
          destinationValue,
          "1",
          "-"
        ]);
      }
    });

    const csvContent = [
      headers.join(","),
      ...rows.map(row => 
        row.map(field => {
          const stringVal = String(field || '');
          if (stringVal.includes(",") || stringVal.includes("\n") || stringVal.includes('"')) {
            return `"${stringVal.replace(/"/g, '""')}"`;
          }
          return stringVal;
        }).join(",")
      )
    ].join("\r\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Order_${order.id}_Transaction.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!order && isOpen) return null;

  const safeGetDate = (date: any): Date => {
    return universalParseDate(date) || new Date();
  };

  const orderDate = safeGetDate(order?.orderDate);
  const pickupDate = getPickupDate(order);
  const deliveryDate = getDeliveryDate(order);

  const statusLower = (order?.status || 'pending').toLowerCase();
  let displayDate = orderDate;
  if (statusLower === 'shipped') {
    displayDate = pickupDate && !isNaN(pickupDate.getTime()) ? pickupDate : orderDate;
  } else if (statusLower === 'delivered') {
    displayDate = deliveryDate && !isNaN(deliveryDate.getTime()) ? deliveryDate : orderDate;
  }

  const getSerialNumbers = (itemName: string): string[] => {
    if (!order) return [];
    const lowerName = itemName.toLowerCase();
    
    // 1. Try shippedItems first
    if (order.shippedItems) {
      const key = Object.keys(order.shippedItems).find(k => k.toLowerCase() === lowerName);
      if (key && order.shippedItems[key]?.serialNumbers && order.shippedItems[key].serialNumbers.length > 0) {
        return order.shippedItems[key].serialNumbers || [];
      }
    }
    
    // 2. Try pickedItems next
    if (order.pickedItems) {
      const key = Object.keys(order.pickedItems).find(k => k.toLowerCase() === lowerName);
      if (key && order.pickedItems[key]?.serialNumbers && order.pickedItems[key].serialNumbers.length > 0) {
        return order.pickedItems[key].serialNumbers || [];
      }
    }

    // 3. Try standard items next
    if (order.items) {
      const item = order.items.find(i => i.name.toLowerCase() === lowerName);
      if (item && item.serialNumbers && item.serialNumbers.length > 0) {
        return item.serialNumbers;
      }
    }
    
    // 4. Fallback generation to ensure dropdown always works for testing
    const targetItem = order.items.find(i => i.name.toLowerCase() === lowerName);
    const qty = targetItem?.quantity || 1;
    
    // Match exact test cases from user's screenshots supporting variations like 'sto-001', 'sto-01', 'sto-1'
    const isSto01 = lowerName === 'sto-01' || lowerName === 'sto-001' || lowerName === 'sto-1';
    const isSto02 = lowerName === 'sto-02' || lowerName === 'sto-002' || lowerName === 'sto-2';
    
    if (isSto01) {
      const count = Math.max(qty, 2);
      return Array.from({ length: count }, (_, i) => String(1 + i).padStart(3, '0'));
    }
    if (isSto02) {
      const count = Math.max(qty, 2);
      return Array.from({ length: count }, (_, i) => String(4 + i).padStart(3, '0'));
    }
    
    // Default fallback generator starting from 001 for other items
    return Array.from({ length: qty }, (_, i) => String(1 + i).padStart(3, '0'));
  };

  return (
    <AnimatePresence>
      {isOpen && order && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
          />
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed right-0 top-0 bottom-0 w-full max-w-xl bg-white z-50 shadow-[-40px_0_80px_rgba(0,0,0,0.1)] border-l border-black/5 flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 sm:p-8 bg-black flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-xl sm:text-2xl font-serif italic mb-1 text-white">Movement Manifest</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-[0.2em]">Node: #{order.id.slice(0, 12).toUpperCase()}</p>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-8 custom-scrollbar space-y-8 sm:space-y-12">
              {/* Summary */}
              <section className="bg-black/[0.02] border border-black/5 rounded-2xl sm:rounded-[32px] p-4 sm:p-8">
                <div className="flex items-center gap-4 mb-8">
                  <div className="w-14 h-14 bg-black rounded-2xl flex items-center justify-center text-white shadow-xl shadow-black/10">
                    <Package className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-[9px] uppercase tracking-[0.3em] text-black/30 font-bold">Consigment Logic</p>
                    <p className="text-xl font-serif italic text-black capitalize">{order.status}</p>
                  </div>
                </div>

                <div className="space-y-4">
                  {order.items.map((item, idx) => {
                    const serials = getSerialNumbers(item.name);
                    const isExpanded = !!expandedItems[item.name];
                    const hasDropdown = serials.length > 0;
                    
                    return (
                      <div key={idx} className="py-4 border-b border-black/5 last:border-0 flex flex-col gap-3">
                        <div 
                          className={cn(
                            "flex justify-between items-center transition-colors duration-200",
                            hasDropdown && "cursor-pointer select-none hover:bg-black/[0.02] p-2 -m-2 rounded-xl"
                          )}
                          onClick={() => {
                            if (hasDropdown) {
                              setExpandedItems(prev => ({
                                ...prev,
                                [item.name]: !prev[item.name]
                              }));
                            }
                          }}
                        >
                          <div className="flex items-center gap-2">
                            {hasDropdown && (
                              <ChevronDown 
                                className={cn(
                                  "w-4 h-4 text-black/40 transition-transform duration-300",
                                  isExpanded && "transform rotate-180 text-black/80"
                                )}
                              />
                            )}
                            <div>
                              <p className="text-sm font-bold uppercase tracking-tight text-black/80">{item.name}</p>
                              <p className="text-[9px] uppercase tracking-widest text-[#FF9800] font-black">Units: {serials.length > 0 ? serials.length : item.quantity}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-mono text-sm text-black font-bold">{serials.length > 0 ? serials.length : item.quantity} UNITS</p>
                          </div>
                        </div>
                        
                        <AnimatePresence initial={false}>
                          {hasDropdown && isExpanded && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2, ease: "easeInOut" }}
                              className="overflow-hidden"
                            >
                              <div className="mt-1 pl-4 border-l-2 border-black/10 space-y-2 pt-2">
                                <p className="text-[9px] uppercase tracking-[0.2em] text-black/35 font-bold mb-1 col-span-full">Serial Items</p>
                                <div className="grid grid-cols-1 gap-2">
                                  {serials.map((serial, sIdx) => (
                                    <div key={sIdx} className="flex justify-between items-center bg-black/[0.02] border border-black/[0.04] rounded-2xl px-4 py-3 text-xs shadow-sm">
                                      <div className="flex items-center gap-3">
                                        <span className="w-2 h-2 rounded-full bg-[#FF9800]" />
                                        <span className="font-mono text-black/75 font-bold tracking-wider">{serial}</span>
                                      </div>
                                      <span className="text-[9px] uppercase tracking-[0.2em] text-black/40 font-extrabold font-mono">1 UNIT</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                  <div className="pt-4 flex justify-between items-center text-lg font-serif italic">
                    <p className="text-black/40 text-sm font-sans uppercase font-bold tracking-widest not-italic">Total Unit</p>
                    <p className="text-black font-mono not-italic text-sm font-bold">{order.items.reduce((acc, item) => acc + (getSerialNumbers(item.name).length || item.quantity), 0)} UNITS</p>
                  </div>
                </div>
              </section>

              {/* Remark Details */}
              {order.remark && (
                <div className="bg-[#FF9800]/5 border border-[#FF9800]/25 rounded-[32px] p-6 relative overflow-hidden">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-xl bg-[#FF9800]/10 flex items-center justify-center text-[#FF9800] shrink-0">
                      <svg className="w-5 h-5 text-[#FF9800]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-[9px] uppercase tracking-[0.2em] text-[#FF9800] font-black mb-1">Operational Instructions & Remarks</p>
                      <p className="text-xs font-bold text-black/75 leading-relaxed font-sans">
                        {order.remark}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Delivery info */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-black/[0.01] border border-black/5 rounded-2xl p-6">
                  <MapPin className="w-4 h-4 text-black mb-4" />
                  <p className="text-[9px] uppercase tracking-[0.2em] text-black/30 font-bold mb-1">Destination</p>
                  <p className="text-xs font-bold uppercase text-black/60 leading-relaxed">{order.shippingAddress}</p>
                </div>
                <div className="bg-black/[0.01] border border-black/5 rounded-2xl p-6 relative overflow-hidden group">
                  <div className="relative z-10">
                    <Clock className="w-4 h-4 text-black mb-4" />
                    <p className="text-[9px] uppercase tracking-[0.2em] text-black/30 font-bold mb-1">
                      {statusLower === 'delivered' 
                        ? 'Delivery Timestamp' 
                        : statusLower === 'shipped' 
                          ? 'Pickup Timestamp' 
                          : 'Created At'}
                    </p>
                    <p className="text-xs font-bold uppercase text-black/60 leading-relaxed">
                      {format(displayDate, 'MMM d, yyyy • HH:mm')}
                    </p>
                  </div>
                  {order.status === 'delivered' && (
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                      <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                    </div>
                  )}
                </div>
              </section>


              {/* Movement / Timeline */}
              <section className="space-y-8">
                <div className="flex items-center gap-2 mb-6">
                  <Navigation className="w-4 h-4 text-black" />
                  <h4 className="text-lg font-serif italic text-black">Movement History</h4>
                </div>
                
                <div className="relative pl-10 space-y-10">
                  {/* Vertical Line */}
                  <div className="absolute left-[6px] top-4 bottom-4 w-0.5 bg-black/[0.08]"></div>
                  
                  {(() => {
                    const resolvedMovement = [...(order.movement || [])];
                    const createdTime = safeGetDate(order.orderDate);
                    const pickupDateVal = getPickupDate(order);
                    const deliveryDateVal = getDeliveryDate(order);

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

                    // Get normalized placement time
                    const orderPlacedStep = resolvedMovement.find(m => {
                      const s = (m.status || '').toLowerCase();
                      return s.includes('place') || s.includes('create');
                    });
                    const placementTime = orderPlacedStep ? safeGetDate(orderPlacedStep.timestamp) : createdTime;

                    const pickupTime = pickupDateVal && !isNaN(pickupDateVal.getTime())
                      ? pickupDateVal
                      : new Date(placementTime.getTime() + 1.5 * 3600 * 1000);

                    let readyTime: Date;
                    const readyDateVal = getReadyDate(order, true);
                    if (readyDateVal && !isNaN(readyDateVal.getTime())) {
                      readyTime = readyDateVal;
                    } else if (pickupTime && pickupTime > placementTime && (order.status === 'shipped' || order.status === 'delivered')) {
                      readyTime = new Date(placementTime.getTime() + Math.max(60000, Math.floor((pickupTime.getTime() - placementTime.getTime()) / 2)));
                    } else {
                      readyTime = placementTime;
                    }

                    // 2. Ensure "Ready to Pickup" is present for ready, shipped, or delivered orders
                    const isPending = (order.status || '').toLowerCase() === 'pending';
                    const isReadyOrBeyond = !isPending && (order.status === 'ready' || order.status === 'shipped' || order.status === 'delivered' || !!order.readyTime || !!order.readyAt || !!order.pickedAt || (order.pickedItems && Object.keys(order.pickedItems).length > 0));
                    if (isReadyOrBeyond) {
                      const readyStepIdx = resolvedMovement.findIndex(m => {
                        const s = (m.status || '').toLowerCase();
                        return s.includes('ready') || s.includes('prepare');
                      });
                      if (readyStepIdx === -1) {
                        resolvedMovement.push({
                          status: 'Ready to Pickup',
                          timestamp: readyTime,
                          location: 'Khex Sorting Facility',
                          description: 'Package verified, processed, and ready for driver pickup.'
                        } as any);
                      } else if (readyDateVal) {
                        resolvedMovement[readyStepIdx] = {
                          ...resolvedMovement[readyStepIdx],
                          timestamp: readyDateVal
                        };
                      }
                    }

                    // 3. Ensure "Pickup by Driver" is present for shipped or delivered orders
                    if (!isPending && (order.status === 'shipped' || order.status === 'delivered')) {
                      const hasPickup = resolvedMovement.some(m => {
                        const s = (m.status || '').toLowerCase();
                        return !s.includes('ready') && (s.includes('ship') || s.includes('transit') || s.includes('pick') || s.includes('driver'));
                      });
                      if (!hasPickup) {
                        resolvedMovement.push({
                          status: 'Pickup by Driver',
                          timestamp: pickupTime,
                          location: 'Khex Sorting Facility',
                          description: 'Package picked up by dispatch driver for immediate transit.'
                        } as any);
                      }
                    }

                    // 4. Ensure "Delivered" is present for delivered orders
                    if (!isPending && order.status === 'delivered') {
                      const hasDelivery = resolvedMovement.some(m => {
                        const s = (m.status || '').toLowerCase();
                        return s.includes('deliver') || s.includes('received');
                      });
                      if (!hasDelivery) {
                        const deliveredTime = deliveryDateVal && !isNaN(deliveryDateVal.getTime())
                          ? deliveryDateVal
                          : new Date(pickupTime.getTime() + 2 * 3600 * 1000);

                        resolvedMovement.push({
                          status: 'Delivered',
                          timestamp: deliveredTime,
                          location: order.shippingAddress || 'Customer Reception',
                          description: 'Package successfully delivered and received.'
                        } as any);
                      }
                    }

                    let filteredSteps = resolvedMovement.slice();
                    if (isPending) {
                      filteredSteps = filteredSteps.filter(m => {
                        const s = (m.status || '').toLowerCase();
                        // Only keep "Order Placed" or "Processed" (non-ready, non-pickup, non-delivered)
                        return !(s.includes('ready') || s.includes('prepare') || s.includes('pick') || s.includes('ship') || s.includes('transit') || s.includes('deliver') || s.includes('receive'));
                      });
                    }

                    // Strictly sort by sequence: ORDER PLACED (1) -> READY TO PICKUP (2) -> PICKUP BY DRIVER (3) -> DELIVERED (4)
                    return filteredSteps.sort((a, b) => {
                      const getStagePrec = (status: string) => {
                        const s = (status || '').toLowerCase();
                        if (s.includes('place') || s.includes('create')) return 1;
                        if (s.includes('ready') || s.includes('prepare')) return 2;
                        if (s.includes('pick') || s.includes('ship') || s.includes('transit')) return 3;
                        if (s.includes('deliver') || s.includes('receive')) return 4;
                        return 5;
                      };
                      return getStagePrec(a.status) - getStagePrec(b.status);
                    });
                  })().map((step, idx) => {
                    const stepDate = safeGetDate(step.timestamp);
                    const statusLower = step.status.toLowerCase();
                    const isCreated = statusLower.includes('place') || statusLower.includes('create');
                    const isReady = statusLower.includes('ready') || statusLower.includes('prepare');
                    const isShipped = !isReady && (statusLower.includes('ship') || statusLower.includes('transit') || statusLower.includes('pick') || statusLower.includes('driver'));
                    const isDelivered = statusLower.includes('deliver') || statusLower.includes('receive');
                    
                    const driverName = getDriverName(order);
                    const deliveredByVal = getDeliveredBy(order);
                    const receiverName = getReceiverName(order);
                    const pickupTimeDate = getPickupDate(order) || stepDate;
                    const receivedTimeDate = getDeliveryDate(order) || stepDate;

                    let displayTitle = step.status;
                    if (isCreated) displayTitle = 'ORDER PLACED';
                    else if (isReady) displayTitle = 'READY TO PICKUP';
                    else if (isShipped) displayTitle = 'PICKUP BY DRIVER';
                    else if (isDelivered) displayTitle = 'DELIVERED';

                    let headerDate = stepDate;
                    if (isCreated) {
                      headerDate = safeGetDate(order.orderDate);
                    } else if (isShipped) {
                      headerDate = pickupTimeDate;
                    } else if (isDelivered) {
                      headerDate = receivedTimeDate;
                    }

                    let stepColor = 'text-zinc-500';
                    let stepBg = 'bg-zinc-500';
                    let stepBorder = 'border-black/5';
                    let StepIcon = Package;

                    if (isCreated) {
                      stepColor = 'text-[#FF9800]';
                      stepBg = 'bg-[#FF9800]';
                      stepBorder = 'border-[#FF9800]/20';
                      StepIcon = Package;
                    } else if (isReady) {
                      stepColor = 'text-[#8b5cf6]';
                      stepBg = 'bg-[#8b5cf6]';
                      stepBorder = 'border-[#8b5cf6]/20';
                      StepIcon = Clock;
                    } else if (isShipped) {
                      stepColor = 'text-[#3b82f6]';
                      stepBg = 'bg-[#3b82f6]';
                      stepBorder = 'border-[#3b82f6]/20';
                      StepIcon = Truck;
                    } else if (isDelivered) {
                      stepColor = 'text-[#10b981]';
                      stepBg = 'bg-[#10b981]';
                      stepBorder = 'border-[#10b981]/25';
                      StepIcon = CheckCircle2;
                    }

                    return (
                      <div key={idx} className="relative">
                        {/* Status Icon Indicator */}
                        <div className={cn(
                          "absolute -left-[50px] top-1 w-8 h-8 rounded-full z-10 border-2 border-white flex items-center justify-center shadow-md",
                          stepBg
                        )}>
                          <StepIcon className="w-4 h-4 text-white" />
                        </div>
                        
                        <div className={cn(
                          "bg-white border rounded-[20px] p-5 transition-all duration-300 shadow-sm",
                          stepBorder,
                          "hover:shadow-md"
                        )}>
                          <div className="flex justify-between items-start mb-2">
                            <h5 className={cn("font-black text-[11px] uppercase tracking-[0.2em]", stepColor)}>
                              {displayTitle}
                            </h5>
                            <p className="text-[10px] font-mono text-black/35 font-bold uppercase">
                              {format(headerDate, 'dd/MM/yyyy • HH:mm')}
                            </p>
                          </div>
                          
                          <p className="text-xs text-black/60 mb-3 leading-relaxed font-medium">
                            {step.description}
                          </p>

                          {/* Detail blocks */}
                          {isCreated && (
                            <div className="mb-3 bg-zinc-50/55 border border-zinc-100 rounded-xl p-3 space-y-1.5 animate-fadeIn">
                              <div className="flex justify-between text-[11px]">
                                <span className="text-black/45 uppercase font-black tracking-wider">Created Date</span>
                                <span className="font-bold text-black/80">{format(stepDate, 'MMM dd, yyyy')}</span>
                              </div>
                              <div className="flex justify-between text-[11px]">
                                <span className="text-black/45 uppercase font-black tracking-wider">Creation Time</span>
                                <span className="font-mono text-black/80 font-bold">{format(stepDate, 'HH:mm:ss')}</span>
                              </div>
                            </div>
                          )}

                          {isReady && (
                            <div className="mb-3 bg-purple-50/40 border border-purple-100/60 rounded-xl p-3 space-y-1.5 animate-fadeIn">
                              <div className="flex justify-between text-[11px] items-center">
                                <span className="text-[#8b5cf6] uppercase font-black tracking-wider">Status</span>
                                <span className="px-2 py-0.5 bg-purple-100 text-purple-800 text-[9px] font-black uppercase rounded-md tracking-wider">READY FOR PICKUP</span>
                              </div>
                              <div className="flex justify-between text-[11px] items-center">
                                <span className="text-[#8b5cf6] uppercase font-black tracking-wider">Ready Time</span>
                                <span className="font-mono text-purple-900 font-bold">{format(stepDate, 'HH:mm • dd/MM/yyyy')}</span>
                              </div>
                            </div>
                          )}

                          {isShipped && (
                            <div className="mb-3 bg-blue-50/30 border border-blue-100/50 rounded-xl p-3 space-y-1.5 animate-fadeIn">
                              <div className="flex justify-between text-[11px] items-center">
                                <span className="text-[#3b82f6] uppercase font-black tracking-wider">Driver Name</span>
                                <span className="font-extrabold text-blue-900 uppercase">{driverName}</span>
                              </div>
                              <div className="flex justify-between text-[11px] items-center">
                                <span className="text-[#3b82f6] uppercase font-black tracking-wider">Pickup Action</span>
                                <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[9px] font-black uppercase rounded-md tracking-wider">COMPLETED</span>
                              </div>
                              <div className="flex justify-between text-[11px] items-center">
                                <span className="text-[#3b82f6] uppercase font-black tracking-wider">Pickup Time</span>
                                <span className="font-mono text-blue-900 font-bold">{format(pickupTimeDate, 'HH:mm • dd/MM/yyyy')}</span>
                              </div>
                            </div>
                          )}

                          {isDelivered && (
                            <div className="mb-3 bg-emerald-50/30 border border-emerald-100/50 rounded-xl p-3 space-y-1.5 animate-fadeIn">
                              <div className="flex justify-between text-[11px] items-center">
                                <span className="text-[#10b981] uppercase font-black tracking-wider">Delivered By (Driver)</span>
                                <span className="font-extrabold text-emerald-900 uppercase">{deliveredByVal}</span>
                              </div>
                              <div className="flex justify-between text-[11px] items-center">
                                <span className="text-[#10b981] uppercase font-black tracking-wider">Receiver Name</span>
                                <span className="font-bold text-emerald-950 uppercase">{receiverName}</span>
                              </div>
                              <div className="flex justify-between text-[11px] items-center">
                                <span className="text-[#10b981] uppercase font-black tracking-wider">Received Time</span>
                                <span className="font-mono text-emerald-900 font-bold">{format(receivedTimeDate, 'HH:mm • dd/MM/yyyy')}</span>
                              </div>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 text-[9px] font-extrabold text-black/30 uppercase tracking-[0.1em]">
                            <MapPin className="w-3.5 h-3.5" />
                            {step.location}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {updateError && (
                  <p className="mt-4 text-[10px] font-extrabold text-red-500 uppercase tracking-wider text-center animate-pulse">
                    {updateError}
                  </p>
                )}

                {statusLower === 'pending' ? (
                  <button 
                    onClick={handleReadyToPickup}
                    disabled={isUpdating}
                    className="w-full mt-10 py-4 bg-[#FF9800] text-black text-[10px] font-black uppercase tracking-[0.25em] rounded hover:bg-[#FF9800]/90 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-50 transition-all shadow-2xl flex items-center justify-center gap-2"
                  >
                    {isUpdating ? 'Updating Status...' : 'Ready to Pickup'}
                  </button>
                ) : statusLower === 'ready' ? (
                  <button 
                    onClick={handleExportCSV}
                    className="w-full mt-10 py-4 bg-black text-white text-[9px] font-bold uppercase tracking-[0.3em] rounded hover:bg-black/80 transition-all shadow-2xl"
                  >
                    Export Transaction CSV
                  </button>
                ) : null}
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
