import { useState } from 'react';
import { User } from 'firebase/auth';
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { Order, OrderStatus } from '../types';
import { LayoutDashboard, Package, Truck, CheckCircle2, LogOut, Search, MapPin, Plus, Edit2, Trash2, AlertOctagon, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import OrderCard from './OrderCard';
import OrderDetails from './OrderDetails';
import Logo from './Logo';
import OverviewDashboard from './OverviewDashboard';
import CreateOrder from './CreateOrder';
import EditOrderModal from './EditOrderModal';

interface DashboardProps {
  orders: Order[];
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ orders, user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<OrderStatus | 'all' | 'create'>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [longPressedOrder, setLongPressedOrder] = useState<Order | null>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

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

  const filteredOrders = orders
    .filter(order => {
      const matchesTab = activeTab === 'all' || order.status === activeTab;
      const matchesSearch = order.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                           order.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                           order.shippingAddress?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesTab && matchesSearch;
    })
    .sort((a, b) => {
      const dateA = a.orderDate?.toDate ? a.orderDate.toDate() : new Date(a.orderDate);
      const dateB = b.orderDate?.toDate ? b.orderDate.toDate() : new Date(b.orderDate);
      return dateB.getTime() - dateA.getTime();
    });

  const selectedOrder = orders.find(o => o.id === selectedOrderId);

  const stats = {
    all: orders.length,
    pending: orders.filter(o => o.status === 'pending').length,
    shipped: orders.filter(o => o.status === 'shipped').length,
    delivered: orders.filter(o => o.status === 'delivered').length,
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
            count={stats.all}
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
        <header className="h-24 border-b border-black/10 flex items-center justify-between px-12 shrink-0 bg-[#FF9800] sticky top-0 z-10 shadow-lg">
          <div className="flex items-center gap-12">
            <h2 className="text-2xl font-sans font-bold text-black capitalize tracking-tight">
              {activeTab === 'all' ? 'Dashboard' : activeTab === 'create' ? 'Create' : activeTab.replace('-', ' ')}
            </h2>
            
            <div className="bg-white/90 px-6 py-3 rounded-xl flex items-center gap-8 shadow-sm border border-black/5">
              <HeaderStat label="Units" value={stats.all} color="text-black" />
              <div className="w-px h-8 bg-black/10"></div>
              <HeaderStat label="Pending" value={stats.pending} color="text-black/60" />
              <div className="w-px h-8 bg-black/10"></div>
              <HeaderStat label="Complete" value={stats.delivered} color="text-black" />
            </div>
          </div>

          <div className="relative w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-black/40" />
            <input 
              type="text" 
              placeholder="Secure Node Lookup..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-black/10 rounded-xl py-3.5 pl-12 pr-4 focus:border-black transition-all text-xs outline-none text-black placeholder:text-black/30 shadow-sm"
            />
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-12 custom-scrollbar">
          <div className="max-w-5xl mx-auto space-y-12">
            {activeTab === 'all' ? (
              <OverviewDashboard orders={orders} />
            ) : activeTab === 'create' ? (
              <CreateOrder userId={user.uid} onSuccess={() => setActiveTab('pending')} />
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
        "w-full flex items-center justify-between px-3 py-3 rounded transition-all",
        active 
          ? "bg-white text-black shadow-xl" 
          : "text-white/30 hover:text-white"
      )}
    >
      <div className="flex items-center gap-3">
        {icon}
        <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
      </div>
      {count > 0 && (
        <span className={cn(
          "text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-tighter",
          active ? "bg-[#FF9800] border-[#FF9800] text-white" : "bg-transparent border-white/10 text-white/20"
        )}>
          {count}
        </span>
      )}
    </button>
  );
}
