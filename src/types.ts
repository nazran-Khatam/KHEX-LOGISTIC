export type OrderStatus = 'pending' | 'shipped' | 'delivered';

export interface Movement {
  status: string;
  timestamp: any; // Firestore Timestamp
  location: string;
  description: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  serialNumbers?: string[];
}

export interface Order {
  id: string;
  userId: string;
  orderDate: any; // Firestore Timestamp
  status: OrderStatus;
  trackingNumber?: string;
  items: OrderItem[];
  shippingAddress: string;
  updatedAt: any; // Firestore Timestamp
  movement: Movement[];
  remark?: string;
  pickedItems?: Record<string, { count: number; firstSeen: string; serialNumbers?: string[] }>;
  shippedItems?: Record<string, { count: number; firstSeen: string; serialNumbers?: string[] }>;
  driverName?: string;
  deliveredBy?: string;
  receivingName?: string;
}
