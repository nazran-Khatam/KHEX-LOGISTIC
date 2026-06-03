import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getSanitizedMovement(movement: any[]): any[] {
  if (!Array.isArray(movement)) return [];
  
  const mapped = movement.map(m => {
    const desc = (m.description || '').toLowerCase();
    let correctStatus = m.status;
    
    const isPlaced = desc.includes('successfully created') || (desc.includes('order') && desc.includes('create')) || (desc.includes('order') && desc.includes('placed'));
    const isPickup = desc.includes('picked up') || desc.includes('dispatch driver') || desc.includes('sorting facility') || desc.includes('transit');
    const isDelivery = desc.includes('successfully delivered') || desc.includes('delivered and received') || desc.includes('reception') || desc.includes('received');
    
    if (isPlaced) {
      correctStatus = 'Order Placed';
    } else if (isPickup) {
      correctStatus = 'Picked up by Driver';
    } else if (isDelivery) {
      correctStatus = 'Delivered';
    }
    
    return {
      ...m,
      status: correctStatus
    };
  });

  // Deduplicate keeping only the latest one per unique status
  const uniqueMap = new Map<string, any>();
  mapped.forEach(m => {
    const statusKey = (m.status || '').trim().toLowerCase();
    if (!statusKey) return;
    
    if (!uniqueMap.has(statusKey)) {
      uniqueMap.set(statusKey, m);
    } else {
      const existing = uniqueMap.get(statusKey);
      const existingTime = existing.timestamp ? getTimestampMs(existing.timestamp) : 0;
      const mTime = m.timestamp ? getTimestampMs(m.timestamp) : 0;
      
      // If the current step has a valid/newer timestamp, update it
      if (mTime > existingTime) {
        uniqueMap.set(statusKey, m);
      }
    }
  });

  return Array.from(uniqueMap.values());
}

function getTimestampMs(timestamp: any): number {
  if (!timestamp) return 0;
  if (typeof timestamp.toDate === 'function') {
    return timestamp.toDate().getTime();
  }
  if (typeof timestamp === 'object' && 'seconds' in timestamp) {
    return timestamp.seconds * 1000;
  }
  const d = new Date(timestamp);
  return isNaN(d.getTime()) ? 0 : d.getTime();
}
