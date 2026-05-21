import React, { useState, useEffect } from 'react';
import { collection, doc, setDoc, addDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Plus, Trash2, Save, Package, MapPin, Mail, Hash, Loader2, CheckCircle, Clock } from 'lucide-react';
import ScannedItemsManager from './ScannedItemsManager';

interface CreateOrderProps {
  userId: string;
  onSuccess: () => void;
}

interface TempItem {
  name: string;
  quantity: number;
  price: number;
  serialNumbers: string; // Comma separated in input
}

const generateRandomOrderId = () => 'ODR-' + Math.floor(10000 + Math.random() * 90000);

const LOCATIONS = [
  'Angsana',
  'Avenue K',
  'Bangi',
  'Eco',
  'I-City',
  'IOI',
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

const formatDateTime = (date: Date) => {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  const ss = String(date.getSeconds()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}:${ss}`;
};

const formatDateStr = (date: Date) => {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
};

const formatTimeAMPM = (date: Date, includeSeconds = false, lowercase = false) => {
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  let ampm = hours >= 12 ? 'PM' : 'AM';
  if (lowercase) ampm = ampm.toLowerCase();
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const hrStr = String(hours).padStart(2, '0');
  
  if (includeSeconds) {
    return `${hrStr}:${minutes}:${seconds} ${ampm}`;
  }
  return `${hrStr}:${minutes} ${ampm}`;
};

export default function CreateOrder({ userId, onSuccess }: CreateOrderProps) {
  const [orderId, setOrderId] = useState(() => generateRandomOrderId());
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const [shippingAddress, setShippingAddress] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [remark, setRemark] = useState('');
  const status = 'pending';
  
  const [items, setItems] = useState<TempItem[]>( [
    { name: '', quantity: 1, price: 0, serialNumbers: '' }
  ]);
  
  const [loading, setLoading] = useState(false);
  const [errorStr, setErrorStr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorStr(null);
    setSuccessMsg(null);

    // Validations
    if (!shippingAddress.trim()) {
      setErrorStr('Shipping Address / Location is required.');
      return;
    }

    const filteredItems = items.filter(item => item.name.trim() !== '');
    if (filteredItems.length === 0) {
      setErrorStr('At least one item with a valid name is required.');
      return;
    }

    setLoading(true);

    try {
      // Package the items
      const finalItems = filteredItems.map(item => {
        const serials = item.serialNumbers
          .split(',')
          .map(s => s.trim())
          .filter(s => s !== '');

        return {
          productId: 'p_' + Math.random().toString(36).substr(2, 9),
          name: item.name.trim(),
          quantity: Number(item.quantity) || 1,
          price: 0,
          serialNumbers: serials
        };
      });

      // Build movement log
      const initialMovement = [
        {
          status: 'Order Placed',
          timestamp: new Date(),
          location: 'Khex Central Hub',
          description: 'Your order was successfully created and logged.'
        }
      ];

      const now = new Date();
      const createdAtStr = formatDateTime(now);
      const dateStr = formatDateStr(now);
      const timeStr = formatTimeAMPM(now, false, false); // e.g., "04:32 PM"
      const creatorEmail = auth.currentUser?.email || 'nazranismail20@gmail.com';

      // Format items as a Map to match the Android App structure
      const itemsMap: Record<string, any> = {};
      finalItems.forEach(item => {
        itemsMap[item.name] = {
          count: item.quantity,
          firstSeen: formatTimeAMPM(now, true, false), // e.g., "04:33:27 PM"
          serialNumbers: item.serialNumbers // array of strings
        };
      });

      // Format pickedItems / shippedItems structure to matches the application database representation
      const shippedItems: Record<string, any> = {};
      const pickedItems: Record<string, any> = {};

      finalItems.forEach(item => {
        pickedItems[item.name] = {
          count: item.quantity,
          firstSeen: formatTimeAMPM(now, true, true), // e.g., "04:33:27 pm" (lowercase)
          serialNumbers: item.serialNumbers
        };
      });

      const totalItemsVal = finalItems.reduce((acc, item) => acc + item.quantity, 0);
      const uniqueItemsVal = finalItems.length;

      const orderPayload: any = {
        // App's original schema fields (for backward compatibility & smooth rendering)
        userId,
        status,
        shippingAddress: shippingAddress.trim(),
        shippedBy: '',
        orderDate: serverTimestamp(),
        updatedAt: serverTimestamp(),
        movement: initialMovement,
        trackingNumber: 'TRK' + Math.floor(100000000 + Math.random() * 900000000),
        remark: remark.trim(),

        // Android App layout format requirements
        id: orderId,
        createdAt: createdAtStr,
        createdBy: creatorEmail,
        date: dateStr,
        time: timeStr,
        deliveredAt: '',
        pickedAt: '',
        location: shippingAddress.trim(),
        totalItems: totalItemsVal,
        uniqueItems: uniqueItemsVal,
        items: itemsMap,
        pickedItems,
        shippedItems
      };

      const ordersRef = collection(db, 'orders');
      await setDoc(doc(ordersRef, orderId), orderPayload);

      setSuccessMsg('Order created successfully!');
      setOrderId(generateRandomOrderId());
      setShippingAddress('');
      setRemark('');
      setItems([{ name: '', quantity: 1, price: 0, serialNumbers: '' }]);
      
      setTimeout(() => {
        onSuccess();
      }, 1500);

    } catch (err: any) {
      console.error(err);
      setErrorStr('Failed to save order to Database: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredLocations = LOCATIONS.filter(loc =>
    loc.toLowerCase().includes(shippingAddress.toLowerCase())
  );

  return (
    <div className="bg-white rounded-[32px] p-10 border border-black/[0.03] shadow-xl w-full max-w-4xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 border-b border-black/5 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#FF9800] rounded-2xl flex items-center justify-center text-black">
            <Plus className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-xl font-black text-black uppercase tracking-tight">Create Order</h3>
            <p className="text-xs text-black/40 uppercase tracking-widest font-bold">New Order Entry</p>
          </div>
        </div>
        <div className="bg-black/[0.02] border border-black/5 rounded-2xl py-3 px-4 flex items-center gap-3 self-start sm:self-auto font-mono text-xs font-bold text-black/70">
          <Clock className="w-4 h-4 text-[#FF9800] animate-pulse" />
          <div className="flex flex-col sm:items-end">
            <span className="text-[8px] uppercase font-black tracking-widest text-black/30 leading-none mb-1">System Timestamp</span>
            <span className="text-black/80 font-bold tracking-tight">
              {currentTime.toLocaleDateString('en-GB', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric'
              })} {currentTime.toLocaleTimeString('en-GB', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
              })}
            </span>
          </div>
        </div>
      </div>

      {errorStr && (
        <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold uppercase tracking-widest text-center">
          {errorStr}
        </div>
      )}

      {successMsg && (
        <div className="mb-6 p-4 bg-green-50 border border-green-100 rounded-2xl text-green-600 text-xs font-bold uppercase tracking-widest text-center flex items-center justify-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {successMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Left Column: Core Info */}
          <div className="space-y-6">
            <h4 className="text-[10px] uppercase font-black tracking-[0.3em] text-black/30 border-b border-black/5 pb-2">
              Logistics & Node Config
            </h4>

            {/* Custom Order ID */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-black/60 flex items-center gap-1">
                <Hash className="w-3.5 h-3.5" /> Order Identifier (Auto-Generated)
              </label>
              <div className="w-full bg-black/[0.04] border border-black/10 rounded-2xl py-3.5 px-4 text-xs font-mono font-bold text-black/70 flex items-center justify-between select-all">
                <span>{orderId}</span>
                <span className="text-[9px] uppercase tracking-widest text-[#FF9800] bg-[#FF9800]/10 px-2 py-0.5 rounded-md font-sans">
                  System Assigned
                </span>
              </div>
            </div>



            {/* Location Address */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-black/60 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" /> Shipping Address / Destination Location
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
                  <div className="absolute left-0 right-0 mt-1 max-h-48 overflow-y-auto bg-white border border-black/10 rounded-2xl shadow-xl z-50 py-1.5 scrollbar-thin">
                    {filteredLocations.length > 0 ? (
                      filteredLocations.map((loc) => (
                        <button
                          key={loc}
                          type="button"
                          onMouseDown={(e) => {
                            // Prevent loss of focus before update
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
                        Press Enter or keep typing to use custom location
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Remark Field (Optional) */}
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
                rows={3}
                className="w-full bg-black/[0.02] border border-black/10 rounded-2xl py-3 px-4 focus:border-[#FF9800] focus:bg-white transition-all text-xs outline-none text-black placeholder:text-black/30 font-medium resize-none shadow-inner"
              />
            </div>
          </div>

          {/* Right Column: Items */}
          <div className="space-y-6">
            <div className="flex justify-between items-center border-b border-black/5 pb-2">
              <h4 className="text-[10px] uppercase font-black tracking-[0.3em] text-black/30">
                Manifest Items
              </h4>
              <button
                type="button"
                onClick={handleAddItem}
                className="flex items-center gap-1 text-[9px] font-black bg-black text-white px-3 py-1.5 rounded-full uppercase tracking-wider hover:bg-black/80 transition-all"
              >
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>

            <div className="space-y-4 max-h-[380px] overflow-y-auto pr-2 custom-scrollbar">
              {items.map((item, index) => (
                <div key={index} className="p-4 bg-zinc-50 border border-black/[0.05] rounded-[24px] space-y-3 relative group">
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(index)}
                      className="absolute right-3 top-3 text-black/30 hover:text-red-500 transition-colors"
                      title="Remove item"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}

                  <div className="grid grid-cols-1 gap-4">
                    {/* Item Name */}
                    <div>
                      <label className="text-[9px] font-black uppercase tracking-widest text-black/40 mb-1 block font-sans">
                        Order Number / Item Name
                      </label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleItemChange(index, 'name', e.target.value)}
                        placeholder="e.g. STO-001 or Wireless Headphones"
                        required={index === 0}
                        className="w-full bg-white border border-black/10 rounded-xl py-2 px-3 focus:border-[#FF9800] transition-all text-xs outline-none text-black font-semibold placeholder:text-black/30"
                      />
                    </div>



                    {/* Integrated Scanned Items Terminal */}
                    <ScannedItemsManager
                      serialNumbers={item.serialNumbers || ''}
                      onChange={(newSerials) => handleItemChange(index, 'serialNumbers', newSerials)}
                      onQuantityChange={(newQty) => handleItemChange(index, 'quantity', newQty || 1)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="border-t border-black/5 pt-6 flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="bg-black text-white hover:bg-black/95 px-8 py-4 rounded-xl flex items-center justify-center gap-3 font-bold text-xs tracking-widest uppercase transition-all shadow-xl shadow-black/10 disabled:opacity-50"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                CREATING ORDER...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                CREATE ORDER
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
