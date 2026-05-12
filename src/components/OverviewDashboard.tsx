import { Order } from '../types';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line
} from 'recharts';
import { motion } from 'motion/react';
import { Package, TrendingUp, AlertCircle, Clock } from 'lucide-react';

interface OverviewDashboardProps {
  orders: Order[];
}

export default function OverviewDashboard({ orders }: OverviewDashboardProps) {
  // Process data for Status Distribution
  const statusData = [
    { name: 'Pending', value: orders.filter(o => o.status === 'pending').length, color: '#94a3b8' },
    { name: 'Shipped', value: orders.filter(o => o.status === 'shipped').length, color: '#3b82f6' },
    { name: 'Delivered', value: orders.filter(o => o.status === 'delivered').length, color: '#10b981' },
  ].filter(d => d.value > 0);

  // Simple daily order aggregation (mock dates if real dates aren't varied enough for a good graph)
  // For now, let's just group by status as a bar chart for volume
  const volumeData = [
    { name: 'Pending', count: orders.filter(o => o.status === 'pending').length },
    { name: 'Shipped', count: orders.filter(o => o.status === 'shipped').length },
    { name: 'Delivered', count: orders.filter(o => o.status === 'delivered').length },
  ];

  const totalValue = orders.reduce((acc, order) => 
    acc + order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0), 0
  );

  // Average Delivery Time Calculation
  const getDate = (date: any) => {
    if (!date) return null;
    if (typeof date.toDate === 'function') return date.toDate();
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  };

  const deliveredOrders = orders.filter(o => o.status === 'delivered');
  let totalDays = 0;
  let validCount = 0;

  deliveredOrders.forEach(order => {
    const start = getDate(order.orderDate);
    const end = getDate(order.updatedAt);
    if (start && end) {
      const diff = Math.max(0, end.getTime() - start.getTime());
      totalDays += diff / (1000 * 60 * 60 * 24);
      validCount++;
    }
  });

  const avgDeliveryTimeDays = validCount > 0 ? totalDays / validCount : 0;

  // Location-based Stats
  const locationStatsMap = orders.reduce((acc: Record<string, { orders: number, pending: number, delivered: number }>, order) => {
    const loc = order.shippingAddress.split(',')[0]; 
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
      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <MetricCard 
          icon={<Package className="w-5 h-5 text-blue-500" />}
          label="Total Orders"
          value={orders.length}
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
          value={orders.filter(o => o.status === 'shipped').length}
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
