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

export function universalParseDate(date: any): Date | null {
  if (!date) return null;
  // If it's a Firestore Timestamp or object with toDate()
  if (typeof date.toDate === 'function') {
    return date.toDate();
  }
  // If it has seconds / nanoseconds properties (serialized Firestore Timestamp)
  if (typeof date === 'object' && 'seconds' in date && typeof date.seconds === 'number') {
    return new Date(date.seconds * 1000 + Math.floor((date.nanoseconds || 0) / 1000000));
  }
  // If it's already a Date
  if (date instanceof Date) {
    return isNaN(date.getTime()) ? null : date;
  }
  // If it is a number (milliseconds)
  if (typeof date === 'number') {
    const d = new Date(date);
    return isNaN(d.getTime()) ? null : d;
  }
  // If it's a string, let's parse it carefully
  if (typeof date === 'string') {
    const trimmed = date.trim();
    if (!trimmed || trimmed === 'N/A' || trimmed === '-') return null;

    // Check if it's formatted as DD/MM/YYYY or DD-MM-YYYY (begins with 1-2 digits, separator, 1-2 digits, separator, 4 digits)
    const isDMY = /^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}/.test(trimmed);

    if (isDMY) {
      // Match DD/MM/YYYY hh:mm:ss with optional AM/PM, supporting 다양한 separators (spaces, dots, commas, dashes, bullets)
      const dmyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})(?:\s*[,•\-]\s*|\s+)(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)?$/i;
      const match = trimmed.match(dmyRegex);
      if (match) {
        const day = parseInt(match[1], 10);
        const month = parseInt(match[2], 10) - 1; // 0-indexed
        const year = parseInt(match[3], 10);
        let hour = parseInt(match[4], 10);
        const minute = parseInt(match[5], 10);
        const second = match[6] ? parseInt(match[6], 10) : 0;
        const ampm = match[7];

        if (ampm) {
          if (ampm.toUpperCase() === 'PM' && hour < 12) hour += 12;
          if (ampm.toUpperCase() === 'AM' && hour === 12) hour = 0;
        }

        const parsed = new Date(year, month, day, hour, minute, second);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }

      // Try just DD/MM/YYYY without times
      const dmyOnlyRegex = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/;
      const matchOnly = trimmed.match(dmyOnlyRegex);
      if (matchOnly) {
        const day = parseInt(matchOnly[1], 10);
        const month = parseInt(matchOnly[2], 10) - 1;
        const year = parseInt(matchOnly[3], 10);
        const parsed = new Date(year, month, day, 0, 0, 0);
        if (!isNaN(parsed.getTime())) {
          return parsed;
        }
      }
    }

    // Try parsing as standard ISO or browser-understood string (e.g., YYYY-MM-DD or YYYY/MM/DD)
    const nativeDate = new Date(trimmed);
    if (!isNaN(nativeDate.getTime())) {
      return nativeDate;
    }
  }

  // Fallback
  const fallback = new Date(date);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function getTimestampMs(timestamp: any): number {
  const d = universalParseDate(timestamp);
  return d ? d.getTime() : 0;
}
