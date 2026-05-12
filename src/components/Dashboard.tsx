import { useState } from 'react';
import { User } from 'firebase/auth';
import { Order, OrderStatus } from '../types';
import { LayoutDashboard, Package, Truck, CheckCircle2, LogOut, Search, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import OrderCard from './OrderCard';
import OrderDetails from './OrderDetails';
import Logo from './Logo';
import OverviewDashboard from './OverviewDashboard';

interface DashboardProps {
  orders: Order[];
  user: User;
  onLogout: () => void;
}

export default function Dashboard({ orders, user, onLogout }: DashboardProps) {
  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>('all');
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredOrders = orders.filter(order => {
    const matchesTab = activeTab === 'all' || order.status === activeTab;
    const matchesSearch = order.trackingNumber?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         order.items.some(i => i.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
                         order.shippingAddress?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesTab && matchesSearch;
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
              {activeTab === 'all' ? 'Dashboard' : activeTab.replace('-', ' ')}
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
