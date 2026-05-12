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
}
