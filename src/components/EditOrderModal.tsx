import React, { useState, useEffect } from 'react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from '../firebase';
import { X, Save, Trash2, Plus, MapPin, Hash, Package, AlertCircle, Truck, CheckCircle } from 'lucide-react';
import { Order } from '../types';
import ScannedItemsManager from './ScannedItemsManager';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
          })) || []
    },
    operationType,
    path
  };
  const stringifiedError = JSON.stringify(errInfo);
  console.error('Firestore Error Details: ', stringifiedError);
  throw new Error(stringifiedError);
}

interface EditOrderModalProps {
  order: Order | null;
  isOpen: boolean;
  onClose: () => void;
}

interface TempItem {
  name: string;
  quantity: number;
  price: number;
  serialNumbers: string; // comma separated
}

const LOCATIONS = [
  'Angsana',
  'Avenue K',
  'Bangi',
  'Booth IOI',
  'Booth KLEM',
  'Booth TC',
  'Eco',
  'I-City',
  'IOI City Mall',
  'IOI Conezion',
  'IOI Damansara',
  'Ipoh',
  'KB',
  'KLEM',
  'KLGCC',
  'Kuantan',
  'Larkin',
  'Online',
  'Penang',
  'The Curve'
];

const formatTimeAMPM = (date: Date, includeSeconds = false, lowercase = false) => {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  let ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hrStr = String(hours).padStart(2, '0');
  
  if (lowercase) {
    ampm = ampm.toLowerCase();
  }
  
  if (includeSeconds) {
    return `${hrStr}:${minutes}:${seconds} ${ampm}`;
  }
  return `${hrStr}:${minutes} ${ampm}`;
};

const formatDateToStandardString = (date: Date): string => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${dd}/${mm}/${yyyy}, ${hh}:${min}:${ss}`;
};

export default function EditOrderModal({ order, isOpen, onClose }: EditOrderModalProps) {
  const [shippingAddress, setShippingAddress] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [status, setStatus] = useState<'pending' | 'pickup' | 'shipped' | 'delivered'>('pending');
  const [remark, setRemark] = useState('');
  const [driverName, setDriverName] = useState('');
  const [deliveredBy, setDeliveredBy] = useState('');
  const [receivingName, setReceivingName] = useState('');
  const [items, setItems] = useState<TempItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorStr, setErrorStr] = useState<string | null>(null);

  useEffect(() => {
    if (order) {
      setShippingAddress(order.shippingAddress || '');
      setStatus(order.status || 'pending');
      setRemark(order.remark || '');
      setDriverName(order.driverName || '');
      setDeliveredBy(order.deliveredBy || '');
      setReceivingName(order.receivingName || '');
      
      if (order.items && order.items.length > 0) {
        setItems(
          order.items.map((it) => ({
            name: it.name || '',
            quantity: it.quantity || 1,
            price: it.price || 0,
            serialNumbers: Array.isArray(it.serialNumbers) ? it.serialNumbers.join(', ') : ''
          }))
        );
      } else {
        setItems([{ name: '', quantity: 1, price: 0, serialNumbers: '' }]);
      }
      setErrorStr(null);
    }
  }, [order, isOpen]);

  if (!isOpen || !order) return null;

  const handleAddItem = () => {
    setItems([...items, { name: '', quantity: 1, price: 0, serialNumbers: '' }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length === 1) return;
    setItems(items.filter((_, idx) => idx !== index));
  };

  const handleItemChange = (index: number, field: keyof TempItem, value: any) => {
    setItems((prevItems) => {
      const nextItems = [...prevItems];
      nextItems[index] = { ...nextItems[index], [field]: value };
      return nextItems;
    });
  };

  const handleItemSerialsChange = (index: number, newSerials: string) => {
    const qty = newSerials
      .split(',')
      .map(s => s.trim())
      .filter(s => s !== '')
      .length;

    setItems((prevItems) => {
      const nextItems = [...prevItems];
      nextItems[index] = {
        ...nextItems[index],
        serialNumbers: newSerials,
        quantity: qty || 1
      };
      return nextItems;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStr(null);

    if (!shippingAddress.trim()) {
      setErrorStr('Shipping address/location is required.');
      return;
    }

    const filteredItems = items.filter(item => item.name.trim() !== '');
    if (filteredItems.length === 0) {
      setErrorStr('At least one item with a valid name is required.');
      return;
    }

    setLoading(true);

    try {
      const now = new Date();
      
      const finalItems = filteredItems.map(item => {
        const serials = item.serialNumbers
          .split(',')
          .map(s => s.trim())
          .filter(s => s !== '');

        return {
          productId: 'p_' + Math.random().toString(36).substr(2, 9),
          name: item.name.trim(),
          quantity: Number(item.quantity) || 1,
          price: Number(item.price) || 0,
          serialNumbers: serials
        };
      });

      // Mapped format compatible with Android App
      const itemsMap: Record<string, any> = {};
      finalItems.forEach(item => {
        itemsMap[item.name] = {
          count: item.quantity,
          firstSeen: formatTimeAMPM(now, true),
          serialNumbers: item.serialNumbers
        };
      });

      const pickedItems: Record<string, any> = {};
      finalItems.forEach(item => {
        pickedItems[item.name] = {
          count: item.quantity,
          firstSeen: formatTimeAMPM(now, true, true),
          serialNumbers: item.serialNumbers
        };
      });

      const shippedItems: Record<string, any> = {};
      finalItems.forEach(item => {
        shippedItems[item.name] = {
          count: item.quantity,
          firstSeen: formatTimeAMPM(now, true, true),
          serialNumbers: item.serialNumbers
        };
      });

      const totalItemsVal = finalItems.reduce((acc, item) => acc + item.quantity, 0);
      const uniqueItemsVal = finalItems.length;

      const orderRef = doc(db, 'orders', order.id);
      
      try {
        const fieldsToUpdate: Record<string, any> = {
          shippingAddress: shippingAddress.trim(),
          location: shippingAddress.trim(),
          status,
          items: itemsMap,
          pickedItems,
          shippedItems,
          totalItems: totalItemsVal,
          uniqueItems: uniqueItemsVal,
          remark: remark.trim(),
          driverName: driverName.trim(),
          deliveredBy: deliveredBy.trim(),
          receivingName: receivingName.trim(),
          updatedAt: serverTimestamp()
        };

        // Enforce readyAt, readyTime, pickedAt, and deliveredAt based on status updates
        if (status === 'pending') {
          fieldsToUpdate.readyAt = '';
          fieldsToUpdate.readyTime = '';
          // Remove ready step from movement for pending status as requested
          let movement = [...(order.movement || [])].filter(m => {
            const s = (m.status || '').toLowerCase();
            return !s.includes('ready') && !s.includes('prepare');
          });
          fieldsToUpdate.movement = movement;
        } else if (status === 'pickup' || (status as string) === 'ready') {
          const originalReadyAt = order.readyAt || order.readyTime;
          if (!originalReadyAt) {
            const stdStr = formatDateToStandardString(now);
            fieldsToUpdate.readyAt = stdStr;
            fieldsToUpdate.readyTime = stdStr;
          }
          fieldsToUpdate.pickedAt = ''; // Clear pickedAt since status is ready, not shipped
          
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
            fieldsToUpdate.movement = movement;
          }
        } else if (status === 'shipped') {
          const originalReadyAt = order.readyAt || order.readyTime;
          if (!originalReadyAt) {
            const stdStr = formatDateToStandardString(now);
            fieldsToUpdate.readyAt = stdStr;
            fieldsToUpdate.readyTime = stdStr;
          }
          if (!order.pickedAt) {
            fieldsToUpdate.pickedAt = formatDateToStandardString(now);
          }
          
          let movement = [...(order.movement || [])];
          // Ensure Ready step
          const hasReady = movement.some(m => (m.status || '').toLowerCase().includes('ready') || (m.status || '').toLowerCase().includes('prepare'));
          if (!hasReady) {
            movement.push({
              status: 'Ready to Pickup',
              timestamp: new Date(now.getTime() - 5 * 60 * 1000),
              location: 'Khex Sorting Facility',
              description: 'Package verified, processed, and ready for driver pickup.'
            });
          }
          // Ensure Picked step
          const hasPickup = movement.some(m => {
            const s = (m.status || '').toLowerCase();
            return !s.includes('ready') && (s.includes('ship') || s.includes('transit') || s.includes('pick') || s.includes('driver'));
          });
          if (!hasPickup) {
            movement.push({
              status: 'Pickup by Driver',
              timestamp: now,
              location: 'Khex Sorting Facility',
              description: 'Package picked up by dispatch driver for immediate transit.'
            });
          }
          fieldsToUpdate.movement = movement;
        } else if (status === 'delivered') {
          const originalReadyAt = order.readyAt || order.readyTime;
          if (!originalReadyAt) {
            const stdStr = formatDateToStandardString(now);
            fieldsToUpdate.readyAt = stdStr;
            fieldsToUpdate.readyTime = stdStr;
          }
          if (!order.pickedAt) {
            fieldsToUpdate.pickedAt = formatDateToStandardString(now);
          }
          if (!order.deliveredAt) {
            fieldsToUpdate.deliveredAt = formatDateToStandardString(now);
          }
          
          let movement = [...(order.movement || [])];
          // Ensure Ready
          const hasReady = movement.some(m => (m.status || '').toLowerCase().includes('ready') || (m.status || '').toLowerCase().includes('prepare'));
          if (!hasReady) {
            movement.push({
              status: 'Ready to Pickup',
              timestamp: new Date(now.getTime() - 10 * 60 * 1000),
              location: 'Khex Sorting Facility',
              description: 'Package verified, processed, and ready for driver pickup.'
            });
          }
          // Ensure Picked
          const hasPickup = movement.some(m => {
            const s = (m.status || '').toLowerCase();
            return !s.includes('ready') && (s.includes('ship') || s.includes('transit') || s.includes('pick') || s.includes('driver'));
          });
          if (!hasPickup) {
            movement.push({
              status: 'Pickup by Driver',
              timestamp: new Date(now.getTime() - 5 * 60 * 1000),
              location: 'Khex Sorting Facility',
              description: 'Package picked up by dispatch driver for immediate transit.'
            });
          }
          // Ensure Delivered
          const hasDel = movement.some(m => {
            const s = (m.status || '').toLowerCase();
            return s.includes('deliver') || s.includes('received');
          });
          if (!hasDel) {
            movement.push({
              status: 'Delivered',
              timestamp: now,
              location: shippingAddress.trim() || 'Customer Reception',
              description: 'Package successfully delivered and received.'
            });
          }
          fieldsToUpdate.movement = movement;
        }

        await updateDoc(orderRef, fieldsToUpdate);
      } catch (writeErr) {
        handleFirestoreError(writeErr, OperationType.WRITE, `orders/${order.id}`);
      }

      onClose();
    } catch (err: any) {
      console.error('Failed to update order:', err);
      try {
        // If it was already stringified by handleFirestoreError, parse the message part
        const parsed = JSON.parse(err.message);
        setErrorStr(parsed.error || 'Permission denied or writing failed.');
      } catch {
        setErrorStr(err.message || 'An error occurred while updating the order.');
      }
    } finally {
      setLoading(false);
    }
  };

  const filteredLocations = LOCATIONS.filter(loc =>
    loc.toLowerCase().includes(shippingAddress.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-[32px] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="p-6 border-b border-black/5 flex justify-between items-center bg-[#FF9800]">
          <div>
            <h3 className="text-lg font-black text-black tracking-tight">
              EDIT ORDER #{order.id.replace('#', '').toUpperCase()}
            </h3>
            <p className="text-[10px] text-black/60 font-mono tracking-wider mt-0.5 uppercase">
              MODERATING SECURE OPERATIONS
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-black transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
          {errorStr && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-2xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500 mt-0.5" />
              <div className="text-xs font-bold uppercase tracking-wide leading-relaxed">
                {errorStr}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Destination Location Dropdown */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-black/60 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-[#FF9800]" /> Destination Location
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={shippingAddress}
                  onChange={(e) => {
                    setShippingAddress(e.target.value);
                    setIsDropdownOpen(true);
                  }}
                  onFocus={() => setIsDropdownOpen(true)}
                  onBlur={() => setIsDropdownOpen(false)}
                  placeholder="Type or select location..."
                  required
                  className="w-full bg-black/[0.02] border border-black/10 rounded-2xl py-3.5 pl-4 pr-10 focus:border-[#FF9800] focus:bg-white transition-all text-xs outline-none text-black placeholder:text-black/20"
                />
                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
                  <svg className="w-4 h-4 text-black/40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>

                {isDropdownOpen && (
                  <div className="absolute left-0 right-0 mt-1 max-h-40 overflow-y-auto bg-white border border-black/10 rounded-2xl shadow-xl z-50 py-1.5 scrollbar-thin">
                    {filteredLocations.length > 0 ? (
                      filteredLocations.map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            setShippingAddress(loc);
                            setIsDropdownOpen(false);
                          }}
                          className="w-full text-left px-4 py-2.5 text-xs text-black hover:bg-black/[0.04] transition-colors font-medium border-b border-black/[0.02] last:border-0"
                        >
                          {loc}
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-2 text-xs text-black/40 italic">
                        Keep typing to use custom location
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Status Select Option */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-black/60">
                TRANSIT STATUS
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['pending', 'pickup', 'shipped', 'delivered'] as const).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`py-3.5 px-2 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${
                      status === s
                        ? 'bg-black text-white border-black shadow-md'
                        : 'bg-black/[0.02] border-black/10 text-black/40 hover:bg-black/[0.05]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Driver & Delivery Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Driver Name */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-black/60 flex items-center gap-1 font-sans">
                <Truck className="w-3.5 h-3.5 text-[#FF9800]" />
                Driver Name (Optional)
              </label>
              <input
                type="text"
                value={driverName}
                onChange={(e) => setDriverName(e.target.value)}
                placeholder="Assign driver name..."
                className="w-full bg-black/[0.02] border border-black/10 rounded-2xl py-3 px-4 focus:border-[#FF9800] focus:bg-white transition-all text-xs outline-none text-black placeholder:text-black/20 font-medium"
              />
            </div>

            {/* Delivered By */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#10b981] flex items-center gap-1 font-sans">
                <Truck className="w-3.5 h-3.5" />
                Delivered By (Driver) (Optional)
              </label>
              <input
                type="text"
                value={deliveredBy}
                onChange={(e) => setDeliveredBy(e.target.value)}
                placeholder="Driver delivering..."
                className="w-full bg-black/[0.02] border border-black/10 rounded-2xl py-3 px-4 focus:border-[#10b981] focus:bg-white transition-all text-xs outline-none text-black placeholder:text-black/20 font-medium"
              />
            </div>

            {/* Receiving Name */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-[#10b981] flex items-center gap-1 font-sans">
                <CheckCircle className="w-3.5 h-3.5" />
                Receiving Name (Optional)
              </label>
              <input
                type="text"
                value={receivingName}
                onChange={(e) => setReceivingName(e.target.value)}
                placeholder="Receiver name..."
                className="w-full bg-black/[0.02] border border-black/10 rounded-2xl py-3 px-4 focus:border-[#10b981] focus:bg-white transition-all text-xs outline-none text-black placeholder:text-black/20 font-medium"
              />
            </div>
          </div>

          {/* Remark (Optional) */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-black/60 flex items-center gap-1 font-sans">
              <svg className="w-3.5 h-3.5 text-[#FF9800]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
              </svg>
              REMARK (OPTIONAL)
            </label>
            <textarea
              value={remark}
              onChange={(e) => setRemark(e.target.value)}
              placeholder="Add special instructions or details about this order..."
              rows={2}
              className="w-full bg-black/[0.02] border border-black/10 rounded-2xl py-3 px-4 focus:border-[#FF9800] focus:bg-white transition-all text-xs outline-none text-black placeholder:text-black/30 font-medium resize-none shadow-inner"
            />
          </div>

          {/* Items segment */}
          <div className="space-y-4 pt-4 border-t border-black/5">
            <div className="flex justify-between items-center">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-[#FF9800] flex items-center gap-1.5">
                <Package className="w-4 h-4" /> LIST OF MANIFEST ITEMS ({items.length})
              </h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 px-3 py-1.5 bg-black text-white rounded-full text-[9px] font-black uppercase tracking-wider hover:scale-105 active:scale-95 transition-all shadow-sm"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>

            <div className="space-y-4 max-h-[40vh] overflow-y-auto pr-1">
              {items.map((item, idx) => (
                <div key={idx} className="bg-black/[0.01] border border-black/5 p-4 rounded-2xl space-y-3 relative group">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(idx)}
                      className="absolute right-3 top-3 text-black/30 hover:text-red-500 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black uppercase tracking-widest text-black/40">Product Name</label>
                    <input
                      type="text"
                      value={item.name}
                      onChange={(e) => handleItemChange(idx, 'name', e.target.value)}
                      placeholder="e.g. STO-001"
                      required
                      className="w-full bg-white border border-black/10 rounded-xl py-2 px-3 text-xs outline-none focus:border-black text-black font-semibold"
                    />
                  </div>

                  {/* Integrated Scanned Items Terminal */}
                  <ScannedItemsManager
                    serialNumbers={item.serialNumbers || ''}
                    onChange={(newSerials) => handleItemSerialsChange(idx, newSerials)}
                    onQuantityChange={() => {}}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Footer controls inside pop-up */}
          <div className="pt-6 border-t border-black/5 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="py-3 px-6 rounded-2xl bg-black/[0.04] text-black hover:bg-black/[0.08] text-xs font-black uppercase tracking-widest transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="py-3 px-6 rounded-2xl bg-[#FF9800] text-black hover:scale-[1.02] active:scale-[0.98] text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 shadow-lg shadow-[#FF9800]/10 disabled:opacity-55"
            >
              <Save className="w-4 h-4" />
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
