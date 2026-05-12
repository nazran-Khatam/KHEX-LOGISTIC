import { 
  collection, 
  addDoc, 
  serverTimestamp, 
  query, 
  where, 
  getDocs,
  Timestamp 
} from 'firebase/firestore';
import { db } from '../firebase';

export async function seedMockData(userId: string) {
  const ordersRef = collection(db, 'orders');
  
  // Check if we already have data
  const q = query(ordersRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);
  
  if (!snapshot.empty) return;

  const mockOrders = [
    {
      userId,
      orderDate: serverTimestamp(),
      status: 'shipped',
      trackingNumber: 'TRK123456789',
      items: [
        { productId: 'p1', name: 'Premium Wireless Headphones', quantity: 1, price: 299.99 },
        { productId: 'p2', name: 'Leather Carrying Case', quantity: 1, price: 49.99 }
      ],
      shippingAddress: '123 Southeast Ave, Singapore 018989',
      updatedAt: serverTimestamp(),
      movement: [
        { status: 'Order Placed', timestamp: Timestamp.fromDate(new Date(Date.now() - 86400000 * 2)), location: 'Online Store', description: 'Your order has been received.' },
        { status: 'Processed', timestamp: Timestamp.fromDate(new Date(Date.now() - 86400000)), location: 'Warehouse A', description: 'Item has been picked and packed.' },
        { status: 'Shipped', timestamp: Timestamp.fromDate(new Date()), location: 'Sorting Facility', description: 'Package is in transit.' }
      ]
    },
    {
      userId,
      orderDate: serverTimestamp(),
      status: 'pending',
      items: [
        { productId: 'p3', name: 'Mechanical Keyboard TKL', quantity: 1, price: 159.00 }
      ],
      shippingAddress: '45 Orchard Rd, Singapore 238868',
      updatedAt: serverTimestamp(),
      movement: [
        { status: 'Order Placed', timestamp: Timestamp.fromDate(new Date()), location: 'Online Store', description: 'Your order is being processed.' }
      ]
    },
    {
      userId,
      orderDate: serverTimestamp(),
      status: 'delivered',
      trackingNumber: 'TRK987654321',
      items: [
        { productId: 'p4', name: '4K Mirrorless Camera', quantity: 1, price: 1200.00 }
      ],
      shippingAddress: '78 Marina Blvd, Singapore 018981',
      updatedAt: serverTimestamp(),
      movement: [
        { status: 'Order Placed', timestamp: Timestamp.fromDate(new Date(Date.now() - 86400000 * 5)), location: 'Online Store', description: 'Order confirmed.' },
        { status: 'Shipped', timestamp: Timestamp.fromDate(new Date(Date.now() - 86400000 * 3)), location: 'Warehouse B', description: 'Package is on its way.' },
        { status: 'Delivered', timestamp: Timestamp.fromDate(new Date(Date.now() - 86400000 * 1)), location: 'Customer Reception', description: 'Package delivered.' }
      ]
    }
  ];

  for (const order of mockOrders) {
    await addDoc(ordersRef, order);
  }
}

