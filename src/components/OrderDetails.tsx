import { motion, AnimatePresence } from 'motion/react';
import { X, MapPin, Package, Clock, Truck, CheckCircle2, Navigation } from 'lucide-react';
import { Order } from '../types';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

interface OrderDetailsProps {
  order: Order | undefined;
  isOpen: boolean;
  onClose: () => void;
}

export default function OrderDetails({ order, isOpen, onClose }: OrderDetailsProps) {
  if (!order && isOpen) return null;

  const orderDate = order?.orderDate?.toDate() || new Date();

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
            <div className="p-8 bg-black flex items-center justify-between shrink-0">
              <div>
                <h3 className="text-2xl font-serif italic mb-1 text-white">Movement Manifest</h3>
                <p className="text-[10px] text-white/40 uppercase tracking-[0.2em]">Node: #{order.id.slice(0, 12).toUpperCase()}</p>
              </div>
              <button 
                onClick={onClose}
                className="w-10 h-10 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 transition-colors text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-12">
              {/* Summary */}
              <section className="bg-black/[0.02] border border-black/5 rounded-[32px] p-8">
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
                  {order.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-4 border-b border-black/5 last:border-0">
                      <div>
                        <p className="text-sm font-bold uppercase tracking-tight text-black/80">{item.name}</p>
                        <p className="text-[9px] uppercase tracking-widest text-black/30">Units: {item.quantity}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-mono text-sm text-black font-bold">{item.quantity} UNITS</p>
                      </div>
                    </div>
                  ))}
                  <div className="pt-4 flex justify-between items-center text-lg font-serif italic">
                    <p className="text-black/40 text-sm font-sans uppercase font-bold tracking-widest not-italic">Total Unit</p>
                    <p className="text-black font-mono not-italic text-sm font-bold">{order.items.reduce((acc, item) => acc + item.quantity, 0)} UNITS</p>
                  </div>
                </div>
              </section>

              {/* Delivery info */}
              <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-black/[0.01] border border-black/5 rounded-2xl p-6">
                  <MapPin className="w-4 h-4 text-black mb-4" />
                  <p className="text-[9px] uppercase tracking-[0.2em] text-black/30 font-bold mb-1">Destination</p>
                  <p className="text-xs font-bold uppercase text-black/60 leading-relaxed">{order.shippingAddress}</p>
                </div>
                <div className="bg-black/[0.01] border border-black/5 rounded-2xl p-6">
                  <Clock className="w-4 h-4 text-black mb-4" />
                  <p className="text-[9px] uppercase tracking-[0.2em] text-black/30 font-bold mb-1">Timestamp</p>
                  <p className="text-xs font-bold uppercase text-black/60 leading-relaxed">{format(orderDate, 'MMM d, yyyy • HH:mm')}</p>
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
                  <div className="absolute left-[7px] top-2 bottom-2 w-px bg-black/10"></div>
                  
                  {order.movement.slice().reverse().map((step, idx) => (
                    <div key={idx} className="relative">
                      <div className={cn(
                        "absolute -left-[37px] w-4 h-4 rounded-full z-10 border-2 border-white",
                        idx === 0 
                          ? "bg-black" 
                          : "bg-black/10"
                      )} />
                      
                      <div className={cn(
                        "bg-white border rounded-lg p-5 transition-all duration-500",
                        idx === 0 ? "border-black shadow-lg" : "border-black/5 opacity-40"
                      )}>
                        <div className="flex justify-between items-start mb-2">
                          <h5 className="font-bold text-[10px] text-black uppercase tracking-[0.2em]">{step.status}</h5>
                          <p className="text-[9px] font-mono text-black/30 uppercase">
                            {format(step.timestamp?.toDate ? step.timestamp.toDate() : new Date(step.timestamp), 'HH:mm • dd/MM')}
                          </p>
                        </div>
                        <p className="text-xs text-black/60 mb-3">{step.description}</p>
                        <div className="flex items-center gap-1.5 text-[9px] font-bold text-black/30 uppercase tracking-[0.1em]">
                          <MapPin className="w-3 h-3" />
                          {step.location}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button className="w-full mt-10 py-4 bg-black text-white text-[9px] font-bold uppercase tracking-[0.3em] rounded hover:bg-black/80 transition-all shadow-2xl">
                  Export Transaction PDF
                </button>
              </section>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
