import React, { useState } from 'react';
import { Order } from '../types';
import { Download, FileSpreadsheet, FileJson, SlidersHorizontal, CheckCircle, Info, Upload, FileUp, RefreshCw, AlertTriangle, Trash2, Loader2, Check } from 'lucide-react';
import { motion } from 'motion/react';
import { getDeterministicName } from './OrderDetails';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

interface ReportExportCardProps {
  orders: Order[];
}

// RFC 4180 compliant robust CSV Parser
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let currentVal = '';
  
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];
    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        currentVal += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      row.push(currentVal);
      currentVal = '';
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++;
      }
      row.push(currentVal);
      lines.push(row);
      row = [];
      currentVal = '';
    } else {
      currentVal += char;
    }
  }
  if (row.length > 0 || currentVal !== '') {
    row.push(currentVal);
    lines.push(row);
  }
  return lines;
}

function getResolvedMovement(order: Order): any[] {
  if (!order) return [];
  const safeGetDate = (date: any): Date => {
    if (!date) return new Date();
    if (typeof date.toDate === 'function') return date.toDate();
    const d = new Date(date);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  const getDeliveryDate = () => {
    if (!order) return null;
    
    // Check shippedItems for more precise delivery time
    if (order.shippedItems && Object.keys(order.shippedItems).length > 0) {
      const firstItem = Object.values(order.shippedItems)[0];
      if (firstItem && firstItem.firstSeen) {
        if (typeof firstItem.firstSeen === 'string') {
          // Parse "03:38:10 PM" format
          const timeMatch = firstItem.firstSeen.match(/(\d+):(\d+):(\d+)\s*(AM|PM)/i);
          if (timeMatch) {
            const updatedAt = safeGetDate(order.updatedAt);
            const d = new Date(updatedAt);
            let h = parseInt(timeMatch[1]);
            const m = parseInt(timeMatch[2]);
            const s = parseInt(timeMatch[3]);
            const period = timeMatch[4].toUpperCase();
            
            if (period === 'PM' && h < 12) h += 12;
            if (period === 'AM' && h === 12) h = 0;
            
            d.setHours(h, m, s, 0);
            return d;
          }
        } else if (typeof firstItem.firstSeen === 'object') {
          return safeGetDate(firstItem.firstSeen);
        }
      }
    }
    
    if (order.status === 'delivered') {
      return safeGetDate(order.updatedAt);
    }
    
    return null;
  };

  const resolvedMovement = [...(order.movement || [])];
  if (resolvedMovement.length === 0) {
    const createdTime = safeGetDate(order.orderDate);
    
    resolvedMovement.push({
      status: 'Order Placed',
      timestamp: createdTime,
      location: 'Khex Central Hub',
      description: 'Your order was successfully created and logged.'
    } as any);

    if (order.status === 'shipped' || order.status === 'delivered') {
      const shippedTime = new Date(createdTime.getTime() + 1.5 * 3600 * 1000);
      resolvedMovement.push({
        status: 'Picked up by Driver',
        timestamp: shippedTime,
        location: 'Khex Sorting Facility',
        description: 'Package picked up by dispatch driver for immediate transit.'
      } as any);
    }

    if (order.status === 'delivered') {
      const deliveryDate = getDeliveryDate();
      const deliveredTime = deliveryDate && !isNaN(deliveryDate.getTime())
        ? deliveryDate
        : new Date(createdTime.getTime() + 4 * 3600 * 1000);

      resolvedMovement.push({
        status: 'Delivered',
        timestamp: deliveredTime,
        location: order.shippingAddress || 'Customer Reception',
        description: 'Package successfully delivered and received.'
      } as any);
    }
  }

  return resolvedMovement.slice().sort((a, b) => {
    const dateA = safeGetDate(a.timestamp);
    const dateB = safeGetDate(b.timestamp);
    return dateA.getTime() - dateB.getTime();
  });
}

function getMovementTime(order: Order, targetStatus: 'shipped' | 'delivered'): string {
  if (!order) return 'N/A';
  
  const resolvedMovement = getResolvedMovement(order);
  
  const safeGetDate = (date: any): Date => {
    if (!date) return new Date();
    if (typeof date.toDate === 'function') return date.toDate();
    const d = new Date(date);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  if (targetStatus === 'shipped') {
    const step = resolvedMovement.find(m => {
      const statusLower = (m.status || '').toLowerCase();
      return statusLower.includes('ship') || statusLower.includes('transit') || statusLower.includes('pick');
    });
    if (step && step.timestamp) {
      return safeGetDate(step.timestamp).toLocaleString('en-GB');
    }
  } else if (targetStatus === 'delivered') {
    const step = resolvedMovement.find(m => {
      const statusLower = (m.status || '').toLowerCase();
      return statusLower.includes('deliver') || statusLower.includes('received');
    });
    if (step && step.timestamp) {
      return safeGetDate(step.timestamp).toLocaleString('en-GB');
    }
  }
  
  return 'N/A';
}

interface BulkPreviewItem {
  orderId: string;
  originalAddress: string;
  proposedAddress: string;
  originalStatus: string;
  proposedStatus: string;
  originalTracking: string;
  proposedTracking: string;
  originalDriver: string;
  proposedDriver: string;
  originalDeliveredBy: string;
  proposedDeliveredBy: string;
  originalReceiver: string;
  proposedReceiver: string;
  originalRemark: string;
  proposedRemark: string;
  originalPickupTime?: string;
  proposedPickupTime?: string;
  originalReceivedTime?: string;
  proposedReceivedTime?: string;
  originalItems?: any[];
  proposedItems?: any[];
  isValid: boolean;
  errors: string[];
  changesCount: number;
}

export function BulkUploadControl({ orders, getFilteredOrders, locationFilter, statusFilter, triggerDownload, reportDepth }: {
  orders: Order[];
  getFilteredOrders: () => Order[];
  locationFilter: string;
  statusFilter: string;
  triggerDownload: (blob: Blob, filename: string) => void;
  reportDepth: 'detailed' | 'summary';
}) {
  const [previewItems, setPreviewItems] = useState<BulkPreviewItem[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [updateProgress, setUpdateProgress] = useState({ current: 0, total: 0 });
  const [updateSuccessMessage, setUpdateSuccessMessage] = useState<string | null>(null);

  const downloadBlankTemplate = () => {
    let headers: string[] = [];
    let exampleRow: string[] = [];

    if (reportDepth === 'detailed') {
      headers = [
        "Order ID",
        "Date Created",
        "Pickup Time",
        "Received Time",
        "Created By",
        "Destination Location",
        "Logistics Status",
        "Tracking Number",
        "Driver Name",
        "Delivered By (Driver)",
        "Receiving Name",
        "Product Name",
        "Quantity / Units Count",
        "Serial Numbers List",
        "Special Remark",
        "Last Logged Status",
        "Delivered At"
      ];
      exampleRow = [
        "ID_OF_EXISTING_ORDER_HERE",
        new Date().toLocaleString('en-GB'),
        "N/A",
        "N/A",
        "Khex Terminal Node",
        "KHEX Sorting Facility, KLIA",
        "SHIPPED",
        "TRK772819280",
        "Ahmad Syakir Rosli",
        "Ahmad Syakir Rosli",
        "Siti Aminah Salleh",
        "Industrial Cables 50M",
        "10",
        "SN-100293; SN-100294",
        "Package dispatched under bulk authorization node",
        "SHIPPED",
        "Pending"
      ];
    } else {
      headers = [
        "Order ID",
        "Date Created",
        "Pickup Time",
        "Received Time",
        "Created By",
        "Destination Location",
        "Logistics Status",
        "Tracking Number",
        "Driver Name",
        "Delivered By (Driver)",
        "Receiving Name",
        "Unique Items",
        "Total Units",
        "Combined Manifest Item Summary",
        "Combined Serials Dump",
        "Special Remark",
        "Last Logged Status"
      ];
      exampleRow = [
        "ID_OF_EXISTING_ORDER_HERE",
        new Date().toLocaleString('en-GB'),
        "N/A",
        "N/A",
        "Khex Terminal Node",
        "KHEX Sorting Facility, KLIA",
        "SHIPPED",
        "TRK772819280",
        "Ahmad Syakir Rosli",
        "Ahmad Syakir Rosli",
        "Siti Aminah Salleh",
        "1",
        "10",
        "Industrial Cables 50M (x10)",
        "SN-100293",
        "Package dispatched under bulk authorization node",
        "SHIPPED"
      ];
    }

    let csvContent = headers.map(h => `"${h}"`).join(",") + "\n";
    csvContent += exampleRow.map(v => `"${v}"`).join(",") + "\n";
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `khex_bulk_edit_template_blank_${reportDepth}.csv`);
  };

  const downloadPrepopulatedTemplate = () => {
    let headers: string[] = [];
    let csvContent = "";
    const targetOrders = getFilteredOrders();

    if (reportDepth === 'detailed') {
      headers = [
        "Order ID",
        "Date Created",
        "Pickup Time",
        "Received Time",
        "Created By",
        "Destination Location",
        "Logistics Status",
        "Tracking Number",
        "Driver Name",
        "Delivered By (Driver)",
        "Receiving Name",
        "Product Name",
        "Quantity / Units Count",
        "Serial Numbers List",
        "Special Remark",
        "Last Logged Status",
        "Delivered At"
      ];
      csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";

      targetOrders.forEach(o => {
        const dateStr = o.orderDate?.toDate ? o.orderDate.toDate().toLocaleString('en-GB') : new Date(o.orderDate || '').toLocaleString('en-GB');
        const lastMove = o.movement && o.movement.length > 0 ? o.movement[o.movement.length - 1].status : "No record";
        const pickupStr = getMovementTime(o, 'shipped');
        const receivedStr = getMovementTime(o, 'delivered');
        
        const statusLower = (o.status || '').toLowerCase();
        const dName = o.driverName || ((statusLower === 'shipped' || statusLower === 'delivered') ? getDeterministicName(o.id, 'driver', o) : '');
        const delBy = o.deliveredBy || (statusLower === 'delivered' ? (o.driverName || getDeterministicName(o.id, 'driver', o)) : '');
        const recName = o.receivingName || (statusLower === 'delivered' ? getDeterministicName(o.id, 'receiver', o) : '');

        o.items.forEach(item => {
          const row = [
            o.id,
            dateStr,
            pickupStr,
            receivedStr,
            o.userId || "Khex Terminal Node",
            o.shippingAddress,
            o.status.toUpperCase(),
            o.trackingNumber || "N/A",
            dName,
            delBy,
            recName,
            item.name,
            item.quantity,
            (item.serialNumbers || []).join("; "),
            o.remark || "",
            lastMove,
            o.status === 'delivered' ? 'Completed' : 'Pending'
          ];
          csvContent += row.map(v => `"${String(v ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`).join(",") + "\n";
        });
      });
    } else {
      headers = [
        "Order ID",
        "Date Created",
        "Pickup Time",
        "Received Time",
        "Created By",
        "Destination Location",
        "Logistics Status",
        "Tracking Number",
        "Driver Name",
        "Delivered By (Driver)",
        "Receiving Name",
        "Unique Items",
        "Total Units",
        "Combined Manifest Item Summary",
        "Combined Serials Dump",
        "Special Remark",
        "Last Logged Status"
      ];
      csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";

      targetOrders.forEach(o => {
        const dateStr = o.orderDate?.toDate ? o.orderDate.toDate().toLocaleString('en-GB') : new Date(o.orderDate || '').toLocaleString('en-GB');
        const lastMove = o.movement && o.movement.length > 0 ? o.movement[o.movement.length - 1].status : "No record";
        const pickupStr = getMovementTime(o, 'shipped');
        const receivedStr = getMovementTime(o, 'delivered');
        
        const uniqueItems = o.items.length;
        const totalUnits = o.items.reduce((sum, i) => sum + i.quantity, 0);
        
        const manifestSummary = o.items.map(i => `${i.name} (x${i.quantity})`).join("; ");
        const serialsDump = o.items.flatMap(i => i.serialNumbers || []).join("; ");

        const statusLower = (o.status || '').toLowerCase();
        const dName = o.driverName || ((statusLower === 'shipped' || statusLower === 'delivered') ? getDeterministicName(o.id, 'driver', o) : '');
        const delBy = o.deliveredBy || (statusLower === 'delivered' ? (o.driverName || getDeterministicName(o.id, 'driver', o)) : '');
        const recName = o.receivingName || (statusLower === 'delivered' ? getDeterministicName(o.id, 'receiver', o) : '');

        const row = [
          o.id,
          dateStr,
          pickupStr,
          receivedStr,
          o.userId || "Khex Terminal Node",
          o.shippingAddress,
          o.status.toUpperCase(),
          o.trackingNumber || "N/A",
          dName,
          delBy,
          recName,
          uniqueItems,
          totalUnits,
          manifestSummary,
          serialsDump,
          o.remark || "",
          lastMove
        ];
        csvContent += row.map(v => `"${String(v ?? '').replace(/"/g, '""').replace(/\n/g, ' ')}"`).join(",") + "\n";
      });
    }

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    triggerDownload(blob, `khex_bulk_edit_template_populated_${statusFilter}_${reportDepth}_${new Date().toISOString().slice(0,10)}.csv`);
  };

  const handleCSVContent = (text: string) => {
    try {
      setUploadError(null);
      setUpdateSuccessMessage(null);
      const parsed = parseCSV(text);
      if (parsed.length === 0) {
        throw new Error("The uploaded CSV format is empty.");
      }
      
      const headerRow = parsed[0].map(h => h.trim().toLowerCase());
      
      // Map column indexes based on template keys and logical variations
      const idIdx = headerRow.findIndex(h => h === 'order id' || h === 'id' || h === 'order_id' || h === 'reference');
      const locationIdx = headerRow.findIndex(h => h === 'destination location' || h === 'location' || h === 'shipping address' || h === 'shippingaddress' || h === 'destination');
      const statusIdx = headerRow.findIndex(h => h === 'logistics status' || h === 'status' || h === 'state' || h === 'logistics_status');
      const trackingIdx = headerRow.findIndex(h => h === 'tracking number' || h === 'tracking' || h === 'tracking_number' || h === 'awb');
      const driverIdx = headerRow.findIndex(h => h === 'driver name' || h === 'driver_name' || h === 'driver');
      const deliveredByIdx = headerRow.findIndex(h => h === 'delivered by' || h === 'delivered_by' || h === 'delivered by (driver)');
      const receiverIdx = headerRow.findIndex(h => h === 'receiving name' || h === 'receiving_name' || h === 'receiver' || h === 'receiver name' || h === 'receivingname');
      const remarkIdx = headerRow.findIndex(h => h === 'special remark' || h === 'remark' || h === 'remarks' || h === 'comment' || h === 'notes');
      
      // Additional columns for item-level and movement-level edits
      const pickupTimeIdx = headerRow.findIndex(h => h === 'pickup time' || h === 'pickup_time' || h === 'dispatched time' || h === 'shipped time');
      const receivedTimeIdx = headerRow.findIndex(h => h === 'received time' || h === 'received_time' || h === 'delivered time' || h === 'delivery time');
      const productNameIdx = headerRow.findIndex(h => h === 'product name' || h === 'product_name' || h === 'product' || h === 'item');
      const quantityIdx = headerRow.findIndex(h => h === 'quantity / units count' || h === 'quantity' || h === 'units' || h === 'units count' || h === 'qty');
      const serialsIdx = headerRow.findIndex(h => h === 'serial numbers list' || h === 'serial_numbers' || h === 'serial numbers' || h === 'serials');

      if (idIdx === -1) {
        throw new Error("Could not find required 'Order ID' column. Please download the correct template headers.");
      }

      // Group rows by unique Order ID to consolidate 1:N rows (Detailed Reports) elegantly
      const orderGroups = new Map<string, {
        addresses: string[];
        statuses: string[];
        trackings: string[];
        drivers: string[];
        deliveredBys: string[];
        receivers: string[];
        remarks: string[];
        pickupTimes: string[];
        receivedTimes: string[];
        csvItems: {
          productName: string;
          quantity: string;
          serialNumbers: string;
        }[];
      }>();

      for (let i = 1; i < parsed.length; i++) {
        const row = parsed[i];
        if (row.length === 0 || (row.length === 1 && !row[0].trim())) continue;

        const orderId = (row[idIdx] || '').trim();
        if (!orderId || orderId.toLowerCase() === 'id_of_existing_order_here') continue;

        const addr = locationIdx !== -1 ? (row[locationIdx] || '').trim() : '';
        const stat = statusIdx !== -1 ? (row[statusIdx] || '').trim() : '';
        const track = trackingIdx !== -1 ? (row[trackingIdx] || '').trim() : '';
        const drv = driverIdx !== -1 ? (row[driverIdx] || '').trim() : '';
        const delBy = deliveredByIdx !== -1 ? (row[deliveredByIdx] || '').trim() : '';
        const rec = receiverIdx !== -1 ? (row[receiverIdx] || '').trim() : '';
        const rem = remarkIdx !== -1 ? (row[remarkIdx] || '').trim() : '';

        const pickupStr = pickupTimeIdx !== -1 ? (row[pickupTimeIdx] || '').trim() : '';
        const receivedStr = receivedTimeIdx !== -1 ? (row[receivedTimeIdx] || '').trim() : '';
        const prodName = productNameIdx !== -1 ? (row[productNameIdx] || '').trim() : '';
        const qtyStr = quantityIdx !== -1 ? (row[quantityIdx] || '').trim() : '';
        const serialsStr = serialsIdx !== -1 ? (row[serialsIdx] || '').trim() : '';

        if (!orderGroups.has(orderId)) {
          orderGroups.set(orderId, {
            addresses: [],
            statuses: [],
            trackings: [],
            drivers: [],
            deliveredBys: [],
            receivers: [],
            remarks: [],
            pickupTimes: [],
            receivedTimes: [],
            csvItems: []
          });
        }
        
        const group = orderGroups.get(orderId)!;
        if (addr) group.addresses.push(addr);
        if (stat) group.statuses.push(stat);
        if (track) group.trackings.push(track);
        if (drv) group.drivers.push(drv);
        if (delBy) group.deliveredBys.push(delBy);
        if (rec) group.receivers.push(rec);
        if (rem) group.remarks.push(rem);
        if (pickupStr) group.pickupTimes.push(pickupStr);
        if (receivedStr) group.receivedTimes.push(receivedStr);
        if (prodName || qtyStr || serialsStr) {
          group.csvItems.push({
            productName: prodName,
            quantity: qtyStr,
            serialNumbers: serialsStr
          });
        }
      }

      const previews: BulkPreviewItem[] = [];

      for (const [orderId, group] of orderGroups.entries()) {
        const matched = orders.find(o => o.id.toLowerCase().trim() === orderId.toLowerCase().trim());
        const errors: string[] = [];

        // Select the first non-empty input if available, else blank
        let proposedAddress = group.addresses[0] || '';
        let proposedStatusStr = group.statuses[0] || '';
        let proposedTracking = group.trackings[0] || '';
        let proposedDriver = group.drivers[0] || '';
        let proposedDeliveredBy = group.deliveredBys[0] || '';
        let proposedReceiver = group.receivers[0] || '';
        let proposedRemark = group.remarks[0] || '';
        let proposedPickupTime = group.pickupTimes[0] || '';
        let proposedReceivedTime = group.receivedTimes[0] || '';

        let finalStatus = (proposedStatusStr || '').toLowerCase();

        if (!matched) {
          errors.push(`Order ID reference "${orderId}" could not be matched with any server record.`);
        } else {
          // If the CSV column has values, use the parsed one, otherwise fall back to matched value
          if (locationIdx === -1 || group.addresses.length === 0) proposedAddress = matched.shippingAddress || '';
          if (statusIdx === -1 || group.statuses.length === 0) {
            finalStatus = (matched.status || 'pending').toLowerCase();
          }
          if (trackingIdx === -1 || group.trackings.length === 0) proposedTracking = matched.trackingNumber || '';
          if (driverIdx === -1 || group.drivers.length === 0) proposedDriver = matched.driverName || '';
          if (deliveredByIdx === -1 || group.deliveredBys.length === 0) proposedDeliveredBy = matched.deliveredBy || '';
          if (receiverIdx === -1 || group.receivers.length === 0) proposedReceiver = matched.receivingName || '';
          if (remarkIdx === -1 || group.remarks.length === 0) proposedRemark = matched.remark || '';
          if (pickupTimeIdx === -1 || group.pickupTimes.length === 0) {
            proposedPickupTime = getMovementTime(matched, 'shipped');
          }
          if (receivedTimeIdx === -1 || group.receivedTimes.length === 0) {
            proposedReceivedTime = getMovementTime(matched, 'delivered');
          }

          if (finalStatus && !['pending', 'shipped', 'delivered'].includes(finalStatus)) {
            errors.push(`Status value "${proposedStatusStr}" is invalid. Allowed: PENDING, SHIPPED, or DELIVERED.`);
          }
        }

        const originalAddress = matched ? (matched.shippingAddress || '') : '';
        const originalStatus = matched ? (matched.status || 'pending').toLowerCase() : '';
        const originalTracking = matched ? (matched.trackingNumber || '') : '';
        const originalDriver = matched ? (matched.driverName || '') : '';
        const originalDeliveredBy = matched ? (matched.deliveredBy || '') : '';
        const originalReceiver = matched ? (matched.receivingName || '') : '';
        const originalRemark = matched ? (matched.remark || '') : '';
        const originalPickupTime = matched ? getMovementTime(matched, 'shipped') : 'N/A';
        const originalReceivedTime = matched ? getMovementTime(matched, 'delivered') : 'N/A';

        // Deep copy original items
        const originalItems = matched ? matched.items.map(item => ({
          productId: item.productId || '',
          name: item.name || '',
          quantity: item.quantity || 0,
          price: item.price || 0,
          serialNumbers: [...(item.serialNumbers || [])]
        })) : [];

        // Build proposed items based on group.csvItems sequence
        let proposedItems = [];
        if (group.csvItems.length > 0) {
          // Group and consolidate CSV items by product name (case-insensitive)
          const consolidatedCsvItemsMap = new Map<string, { quantity: number; serialNumbers: string[] }>();
          
          group.csvItems.forEach(csvItm => {
            const nameClean = (csvItm.productName || '').trim();
            if (!nameClean) return;

            let qty = parseInt(csvItm.quantity, 10);
            if (isNaN(qty)) qty = 0;

            let serials: string[] = [];
            if (csvItm.serialNumbers !== undefined && csvItm.serialNumbers !== '') {
              serials = csvItm.serialNumbers.split(/[;,]/).map(s => s.trim()).filter(Boolean);
            }

            // Find an existing entry with case-insensitive match to merge safely
            const foundKey = Array.from(consolidatedCsvItemsMap.keys()).find(k => k.toLowerCase() === nameClean.toLowerCase());
            if (foundKey) {
              const existing = consolidatedCsvItemsMap.get(foundKey)!;
              existing.quantity += qty;
              // Combine and keep unique serials
              const combinedSerials = [...existing.serialNumbers, ...serials];
              existing.serialNumbers = Array.from(new Set(combinedSerials));
            } else {
              consolidatedCsvItemsMap.set(nameClean, {
                quantity: qty,
                serialNumbers: serials
              });
            }
          });

          proposedItems = Array.from(consolidatedCsvItemsMap.entries()).map(([prodName, data]) => {
            // Find if there's an original item with same name (case-insensitive)
            const origItem = originalItems.find(itm => (itm.name || '').toLowerCase().trim() === prodName.toLowerCase().trim());
            return {
              productId: origItem?.productId || `prod-${Math.random().toString(36).substring(2, 11)}`,
              name: prodName,
              quantity: data.quantity,
              price: origItem?.price || 0,
              serialNumbers: data.serialNumbers
            };
          });
        } else {
          proposedItems = originalItems.map(item => ({ ...item }));
        }

        let changesCount = 0;
        if (matched) {
          if (proposedAddress && proposedAddress !== originalAddress) changesCount++;
          if (finalStatus && finalStatus !== originalStatus) changesCount++;
          if (proposedTracking && proposedTracking !== originalTracking) changesCount++;
          if (proposedDriver && proposedDriver !== originalDriver) changesCount++;
          if (proposedDeliveredBy && proposedDeliveredBy !== originalDeliveredBy) changesCount++;
          if (proposedReceiver && proposedReceiver !== originalReceiver) changesCount++;
          if (proposedRemark !== originalRemark) changesCount++;
          if (proposedPickupTime && proposedPickupTime !== 'N/A' && proposedPickupTime !== originalPickupTime) changesCount++;
          if (proposedReceivedTime && proposedReceivedTime !== 'N/A' && proposedReceivedTime !== originalReceivedTime) changesCount++;

          // Items changed check
          let itemsChanged = false;
          if (proposedItems.length !== originalItems.length) {
            itemsChanged = true;
          } else {
            for (let i = 0; i < originalItems.length; i++) {
              const orig = originalItems[i];
              const prop = proposedItems[i];
              if (orig.name !== prop.name) itemsChanged = true;
              if (orig.quantity !== prop.quantity) itemsChanged = true;
              const origSerials = (orig.serialNumbers || []).join('; ');
              const propSerials = (prop.serialNumbers || []).join('; ');
              if (origSerials !== propSerials) itemsChanged = true;
            }
          }
          if (itemsChanged) {
            changesCount++;
          }
        }

        previews.push({
          orderId: matched ? matched.id : orderId,
          originalAddress,
          proposedAddress: proposedAddress || originalAddress,
          originalStatus,
          proposedStatus: finalStatus || originalStatus,
          originalTracking,
          proposedTracking: proposedTracking || originalTracking,
          originalDriver,
          proposedDriver: proposedDriver || originalDriver,
          originalDeliveredBy,
          proposedDeliveredBy: proposedDeliveredBy || originalDeliveredBy,
          originalReceiver,
          proposedReceiver: proposedReceiver || originalReceiver,
          originalRemark,
          proposedRemark,
          originalPickupTime,
          proposedPickupTime,
          originalReceivedTime,
          proposedReceivedTime,
          originalItems,
          proposedItems,
          isValid: errors.length === 0,
          errors,
          changesCount
        });
      }

      if (previews.length === 0) {
        throw new Error("No valid spreadsheet records identified in the uploaded file.");
      }

      setPreviewItems(previews);
    } catch (err: any) {
      setUploadError(err.message || 'Failed to successfully analyze spreadsheet rows.');
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        handleCSVContent(event.target.result);
      }
    };
    reader.readAsText(file);
    e.target.value = ''; // Reset input selection
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      if (typeof event.target?.result === 'string') {
        handleCSVContent(event.target.result);
      }
    };
    reader.readAsText(file);
  };

  const executeBulkUpdate = async () => {
    const validUpdates = previewItems.filter(item => item.isValid && item.changesCount > 0);
    if (validUpdates.length === 0) {
      alert("No valid modified manifests available in queue to update.");
      return;
    }

    setIsUpdating(true);
    setUpdateProgress({ current: 0, total: validUpdates.length });

    for (let i = 0; i < validUpdates.length; i++) {
      const item = validUpdates[i];
      try {
        const orderRef = doc(db, 'orders', item.orderId);
        
        const fieldsToUpdate: Record<string, any> = {
          updatedAt: serverTimestamp()
        };

        if (item.proposedAddress !== item.originalAddress) {
          fieldsToUpdate.shippingAddress = item.proposedAddress;
          fieldsToUpdate.location = item.proposedAddress;
        }
        if (item.proposedStatus !== item.originalStatus) {
          fieldsToUpdate.status = item.proposedStatus;
        }
        if (item.proposedTracking !== item.originalTracking) {
          fieldsToUpdate.trackingNumber = item.proposedTracking;
        }
        if (item.proposedDriver !== item.originalDriver) {
          fieldsToUpdate.driverName = item.proposedDriver;
        }
        if (item.proposedDeliveredBy !== item.originalDeliveredBy) {
          fieldsToUpdate.deliveredBy = item.proposedDeliveredBy;
        }
        if (item.proposedReceiver !== item.originalReceiver) {
          fieldsToUpdate.receivingName = item.proposedReceiver;
        }
        if (item.proposedRemark !== item.originalRemark) {
          fieldsToUpdate.remark = item.proposedRemark;
        }

        if (item.proposedItems && JSON.stringify(item.proposedItems) !== JSON.stringify(item.originalItems)) {
          fieldsToUpdate.items = item.proposedItems;
        }

        // Handle movement updates for pickup/received times
        const matched = orders.find(o => o.id === item.orderId);
        if (matched) {
          let movementToUpdate = [...(matched.movement || [])];
          let movementChanged = false;

          // 1. Check pickup step
          if (item.proposedPickupTime && item.proposedPickupTime !== 'N/A' && item.proposedPickupTime !== item.originalPickupTime) {
            let pickupStepIdx = movementToUpdate.findIndex(m => {
              const sl = (m.status || '').toLowerCase();
              return sl.includes('ship') || sl.includes('transit') || sl.includes('pick');
            });

            const [datePart, timePart] = item.proposedPickupTime.split(',');
            let parsedDate = new Date(item.proposedPickupTime);
            if (datePart && timePart) {
              const parts = datePart.trim().split('/');
              if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                const timeParts = timePart.trim().split(':');
                let hr = 0, min = 0, sec = 0;
                if (timeParts.length >= 2) {
                  hr = parseInt(timeParts[0], 10);
                  min = parseInt(timeParts[1], 10);
                  if (timeParts.length >= 3) {
                    sec = parseInt(timeParts[2].replace(/\s*(AM|PM)/i, ''), 10);
                    const isPm = /pm/i.test(timeParts[2]);
                    if (isPm && hr < 12) hr += 12;
                    if (!isPm && hr === 12 && /am/i.test(timeParts[2])) hr = 0;
                  }
                }
                const dStr = new Date(year, month, day, hr, min, sec);
                if (!isNaN(dStr.getTime())) {
                  parsedDate = dStr;
                }
              }
            }

            if (!isNaN(parsedDate.getTime())) {
              if (pickupStepIdx !== -1) {
                movementToUpdate[pickupStepIdx] = {
                  ...movementToUpdate[pickupStepIdx],
                  timestamp: parsedDate
                };
              } else {
                movementToUpdate.push({
                  status: 'Picked up by Driver',
                  timestamp: parsedDate,
                  location: 'Khex Sorting Facility',
                  description: 'Package picked up by dispatch driver for immediate transit.'
                });
              }
              movementChanged = true;
            }
          }

          // 2. Check received step
          if (item.proposedReceivedTime && item.proposedReceivedTime !== 'N/A' && item.proposedReceivedTime !== item.originalReceivedTime) {
            let receivedStepIdx = movementToUpdate.findIndex(m => {
              const sl = (m.status || '').toLowerCase();
              return sl.includes('deliver') || sl.includes('received');
            });

            const [datePart, timePart] = item.proposedReceivedTime.split(',');
            let parsedDate = new Date(item.proposedReceivedTime);
            if (datePart && timePart) {
              const parts = datePart.trim().split('/');
              if (parts.length === 3) {
                const day = parseInt(parts[0], 10);
                const month = parseInt(parts[1], 10) - 1;
                const year = parseInt(parts[2], 10);
                const timeParts = timePart.trim().split(':');
                let hr = 0, min = 0, sec = 0;
                if (timeParts.length >= 2) {
                  hr = parseInt(timeParts[0], 10);
                  min = parseInt(timeParts[1], 10);
                  if (timeParts.length >= 3) {
                    sec = parseInt(timeParts[2].replace(/\s*(AM|PM)/i, ''), 10);
                    const isPm = /pm/i.test(timeParts[2]);
                    if (isPm && hr < 12) hr += 12;
                    if (!isPm && hr === 12 && /am/i.test(timeParts[2])) hr = 0;
                  }
                }
                const dStr = new Date(year, month, day, hr, min, sec);
                if (!isNaN(dStr.getTime())) {
                  parsedDate = dStr;
                }
              }
            }

            if (!isNaN(parsedDate.getTime())) {
              if (receivedStepIdx !== -1) {
                movementToUpdate[receivedStepIdx] = {
                  ...movementToUpdate[receivedStepIdx],
                  timestamp: parsedDate
                };
              } else {
                movementToUpdate.push({
                  status: 'Delivered',
                  timestamp: parsedDate,
                  location: matched.shippingAddress || 'Customer Reception',
                  description: 'Package successfully delivered and received.'
                });
              }
              movementChanged = true;
            }
          }

          if (movementChanged) {
            fieldsToUpdate.movement = movementToUpdate;
          }
        }

        await updateDoc(orderRef, fieldsToUpdate);
      } catch (err) {
        console.error(`Failed to update Order #${item.orderId}:`, err);
      }
      setUpdateProgress(prev => ({ ...prev, current: i + 1 }));
    }

    setIsUpdating(false);
    setUpdateSuccessMessage(`SUCCESS: Bulk synchronization completed! ${validUpdates.length} manifests modified on central nodes.`);
    setPreviewItems([]);
  };

  const totalModifications = previewItems.filter(item => item.isValid && item.changesCount > 0).length;
  const invalidRowsTotal = previewItems.filter(item => !item.isValid).length;

  return (
    <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 pb-4">
        <div>
          <h4 className="text-xs font-black uppercase tracking-[0.3em] text-black/40 mb-1">
            Data Upload Synchronization
          </h4>
          <h3 className="text-lg font-black text-black uppercase tracking-tight">
            Bulk Edit Manifest Details by CSV Upload
          </h3>
        </div>
        
        {/* Template Downloads */}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={downloadBlankTemplate}
            className="px-4 py-2 border border-black/10 rounded-xl hover:bg-black/5 text-black font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Blank CSV Template
          </button>
          
          <button
            type="button"
            onClick={downloadPrepopulatedTemplate}
            disabled={getFilteredOrders().length === 0}
            className="px-4 py-2 bg-[#FF9800]/10 border border-[#FF9800]/20 rounded-xl hover:bg-[#FF9800]/20 text-[#E65100] disabled:opacity-40 disabled:cursor-not-allowed font-bold text-[10px] uppercase tracking-wider flex items-center gap-1.5 transition-all"
          >
            <Download className="w-3.5 h-3.5" />
            Populated Active CSV Template
          </button>
        </div>
      </div>

      <p className="text-xs text-black/50 leading-relaxed font-medium">
        Easily run massive bulk modifications to your dispatch manifests. First, download the <strong>Populated Active CSV Template</strong> (pre-filled with your current matched database), open it in Excel/Sheets to edit fields like locations, driver names, delivery statuses, or remarks, and drag the saved spreadsheet below to align live database configurations.
      </p>

      {/* Drag & Drop Zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`border-2 border-dashed rounded-3xl p-8 flex flex-col items-center justify-center text-center transition-all relative ${
          isDragging
            ? 'border-[#FF9800] bg-[#FF9800]/5 scale-[0.99]'
            : 'border-black/10 hover:border-black/20 hover:bg-black/[0.01]'
        }`}
      >
        <input
          type="file"
          accept=".csv"
          onChange={handleFileChange}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <div className="p-4 bg-black/5 rounded-full mb-3 text-black/60">
          <Upload className="w-6 h-6 animate-pulse" />
        </div>
        <h4 className="font-bold text-xs uppercase tracking-widest text-black">
          Drag and drop CSV Spreadsheet here
        </h4>
        <p className="text-[10px] text-black/40 uppercase font-black tracking-widest mt-1">
          or click anywhere to browse local device files
        </p>
      </div>

      {uploadError && (
        <div className="p-4 bg-red-50 border border-red-150 rounded-2xl flex items-start gap-3 text-red-700 animate-fadeIn text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 text-red-500 mt-0.5" />
          <div className="font-bold uppercase tracking-widest text-[10px]">
            {uploadError}
          </div>
        </div>
      )}

      {updateSuccessMessage && (
        <div className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-start gap-3 text-emerald-800 animate-fadeIn text-xs">
          <CheckCircle className="w-4 h-4 shrink-0 text-[#10b981] mt-0.5" />
          <div className="font-bold uppercase tracking-widest text-[10px]">
            {updateSuccessMessage}
          </div>
        </div>
      )}

      {/* Progressive Upgrade Loader */}
      {isUpdating && (
        <div className="p-6 bg-black/[0.02] border border-black/5 rounded-3xl space-y-3 animate-pulse">
          <div className="flex justify-between items-center text-xs">
            <span className="font-black uppercase tracking-widest text-[#FF9800] flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              HOT DATABASE SYNCHRONOUS WRITE OUT
            </span>
            <span className="font-mono font-bold text-black">
              {updateProgress.current} / {updateProgress.total} Complete
            </span>
          </div>
          <div className="w-full bg-black/5 h-2 rounded-full overflow-hidden">
            <div 
              className="bg-emerald-500 h-full transition-all duration-300"
              style={{ width: `${(updateProgress.current / updateProgress.total) * 100}%` }}
            />
          </div>
          <p className="text-[9px] text-black/40 uppercase tracking-wider font-extrabold text-center">
            Broadcasting change vectors onto Firebase nodes. Please keep this session tab open...
          </p>
        </div>
      )}

      {/* Previewalterations table list */}
      {previewItems.length > 0 && (
        <div className="space-y-4 animate-fadeIn">
          <div className="flex justify-between items-center bg-black/5 rounded-2xl p-4">
            <div className="flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-[#FF9800] animate-spin" />
              <span className="text-[10px] font-black uppercase tracking-widest text-black">
                Review proposed database changes:
              </span>
            </div>
            
            <div className="flex gap-2">
              <span className="bg-emerald-50 text-emerald-800 text-[9px] font-black tracking-wider px-2.5 py-1 rounded-full uppercase">
                {totalModifications} Modified
              </span>
              {invalidRowsTotal > 0 && (
                <span className="bg-red-50 text-red-800 text-[9px] font-black tracking-wider px-2.5 py-1 rounded-full uppercase">
                  {invalidRowsTotal} Unmatched/Invalid
                </span>
              )}
            </div>
          </div>

          <div className="max-h-72 overflow-y-auto border border-black/5 rounded-2xl bg-black/[0.01]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-black/5 bg-black/[0.02] text-[9px] uppercase font-black tracking-widest text-black/40">
                  <th className="p-3">Order ID</th>
                  <th className="p-3">Location Shift</th>
                  <th className="p-3">Status</th>
                  <th className="p-3">AWB Track</th>
                  <th className="p-3">Driver Assigned</th>
                  <th className="p-3">State / Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 font-sans">
                {previewItems.map((item, idx) => {
                  const isModified = item.changesCount > 0;
                  return (
                    <tr 
                      key={idx} 
                      className={`hover:bg-black/[0.01] transition-colors ${
                        !item.isValid ? 'bg-red-50/20' : isModified ? 'bg-amber-50/10' : ''
                      }`}
                    >
                      <td className="p-3 font-mono font-bold text-black uppercase">
                        {item.orderId}
                      </td>
                      
                      <td className="p-3 max-w-[140px] truncate text-black/60 font-medium">
                        {item.proposedAddress !== item.originalAddress ? (
                          <div className="flex flex-col">
                            <span className="text-[10px] line-through text-black/20 leading-none">{item.originalAddress || '(unassigned)'}</span>
                            <span className="text-[#FF9800] font-bold leading-normal">{item.proposedAddress}</span>
                          </div>
                        ) : (
                          <span>{item.proposedAddress || '(N/A)'}</span>
                        )}
                      </td>

                      <td className="p-3 font-bold">
                        {item.proposedStatus !== item.originalStatus ? (
                          <div className="flex flex-col">
                            <span className="text-[10px] line-through text-black/20 uppercase leading-none">{item.originalStatus}</span>
                            <span className="text-[#FFA726] uppercase font-black leading-normal">{item.proposedStatus}</span>
                          </div>
                        ) : (
                          <span className="uppercase text-black/60">{item.proposedStatus}</span>
                        )}
                      </td>

                      <td className="p-3 font-mono">
                        {item.proposedTracking !== item.originalTracking ? (
                          <div className="flex flex-col">
                            <span className="text-[10px] line-through text-black/20 leading-none">{item.originalTracking || '(unassigned)'}</span>
                            <span className="text-[#FF9800] font-black leading-normal">{item.proposedTracking}</span>
                          </div>
                        ) : (
                          <span className="text-black/60">{item.proposedTracking || '(None)'}</span>
                        )}
                      </td>

                      <td className="p-3 font-medium">
                        {item.proposedDriver !== item.originalDriver ? (
                          <div className="flex flex-col">
                            <span className="text-[10px] line-through text-black/20 leading-none">{item.originalDriver || '(unassigned)'}</span>
                            <span className="text-emerald-600 font-extrabold leading-normal">{item.proposedDriver}</span>
                          </div>
                        ) : (
                          <span className="text-black/60">{item.proposedDriver || '(None)'}</span>
                        )}
                      </td>

                      <td className="p-3">
                        {item.isValid ? (
                          item.changesCount === 0 ? (
                            <span className="bg-black/5 text-black/40 text-[9px] font-bold px-2 py-0.5 rounded-full">
                              No Changes
                            </span>
                          ) : (
                            <span className="bg-[#FF9800]/10 text-[#E65100] text-[9px] font-black px-2 py-0.5 rounded-full uppercase">
                              {item.changesCount} Edits detected
                            </span>
                          )
                        ) : (
                          <span className="text-red-600 text-[10px] font-extrabold uppercase tracking-tighter flex flex-col gap-0.5">
                            {item.errors.map((err, errIdx) => (
                              <span key={errIdx}>⚠️ {err}</span>
                            ))}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              disabled={isUpdating}
              onClick={() => setPreviewItems([])}
              className="px-5 py-3 rounded-xl border border-black/10 hover:bg-black/5 text-xs font-bold uppercase tracking-widest text-black transition-all flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Discard Preview
            </button>

            <button
              type="button"
              disabled={isUpdating || totalModifications === 0}
              onClick={executeBulkUpdate}
              className="px-6 py-3 bg-emerald-650 hover:bg-emerald-700 disabled:bg-black/10 disabled:cursor-not-allowed text-white shadow-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-1.5"
              style={{ backgroundColor: totalModifications > 0 ? '#10b981' : '' }}
            >
              <Check className="w-4 h-4" />
              Apply {totalModifications} Updates onto Firebase
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ReportExportCard({ orders }: ReportExportCardProps) {
  const [reportFormat, setReportFormat] = useState<'csv' | 'json'>('csv');
  const [reportDepth, setReportDepth] = useState<'detailed' | 'summary'>('detailed');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'shipped' | 'delivered'>('all');
  const [locationFilter, setLocationFilter] = useState<string>('all');
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  // Get list of unique locations for filters
  const uniqueLocations = Array.from(
    new Set(orders.map(o => o.shippingAddress.split(',')[0].trim()).filter(Boolean))
  ).sort();

  // Filter orders based on user inputs
  const getFilteredOrders = () => {
    return orders.filter(o => {
      const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
      const matchesLocation = locationFilter === 'all' || o.shippingAddress.toLowerCase().includes(locationFilter.toLowerCase());
      return matchesStatus && matchesLocation;
    });
  };

  const handleExport = () => {
    const targetOrders = getFilteredOrders();
    
    if (targetOrders.length === 0) {
      alert("No records match the selected report criteria.");
      return;
    }

    if (reportFormat === 'json') {
      const enrichedOrders = targetOrders.map(o => {
        const statusLower = (o.status || '').toLowerCase();
        const dName = o.driverName || ((statusLower === 'shipped' || statusLower === 'delivered') ? getDeterministicName(o.id, 'driver', o) : '');
        const delBy = o.deliveredBy || (statusLower === 'delivered' ? (o.driverName || getDeterministicName(o.id, 'driver', o)) : '');
        const recName = o.receivingName || (statusLower === 'delivered' ? getDeterministicName(o.id, 'receiver', o) : '');
        return {
          ...o,
          driverName: dName,
          deliveredBy: delBy,
          receivingName: recName
        };
      });
      const jsonStr = JSON.stringify(enrichedOrders, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      triggerDownload(blob, `khex-logistics-report-${statusFilter}-${new Date().toISOString().slice(0,10)}.json`);
    } else {
      let csvContent = "";

      if (reportDepth === 'detailed') {
        const headers = [
          "Order ID",
          "Date Created",
          "Pickup Time",
          "Received Time",
          "Created By",
          "Destination Location",
          "Logistics Status",
          "Tracking Number",
          "Driver Name",
          "Delivered By (Driver)",
          "Receiving Name",
          "Product Name",
          "Quantity / Units Count",
          "Serial Numbers List",
          "Special Remark",
          "Last Logged Status",
          "Delivered At"
        ];
        
        csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";

        targetOrders.forEach(o => {
          const dateStr = o.orderDate?.toDate ? o.orderDate.toDate().toLocaleString('en-GB') : new Date(o.orderDate || '').toLocaleString('en-GB');
          const lastMove = o.movement && o.movement.length > 0 ? o.movement[o.movement.length - 1].status : "No record";
          const pickupStr = getMovementTime(o, 'shipped');
          const receivedStr = getMovementTime(o, 'delivered');
          
          const statusLower = (o.status || '').toLowerCase();
          const dName = o.driverName || ((statusLower === 'shipped' || statusLower === 'delivered') ? getDeterministicName(o.id, 'driver', o) : '');
          const delBy = o.deliveredBy || (statusLower === 'delivered' ? (o.driverName || getDeterministicName(o.id, 'driver', o)) : '');
          const recName = o.receivingName || (statusLower === 'delivered' ? getDeterministicName(o.id, 'receiver', o) : '');

          o.items.forEach(item => {
            const row = [
              o.id,
              dateStr,
              pickupStr,
              receivedStr,
              o.userId || "Khex Terminal Node",
              o.shippingAddress,
              o.status.toUpperCase(),
              o.trackingNumber || "N/A",
              dName,
              delBy,
              recName,
              item.name,
              item.quantity,
              (item.serialNumbers || []).join("; "),
              o.remark || "",
              lastMove,
              o.status === 'delivered' ? 'Completed' : 'Pending'
            ];
            csvContent += row.map(v => {
              const strVal = String(v ?? '');
              return `"${strVal.replace(/"/g, '""')}"`;
            }).join(",") + "\n";
          });
        });
      } else {
        const headers = [
          "Order ID",
          "Date Created",
          "Pickup Time",
          "Received Time",
          "Created By",
          "Destination Location",
          "Logistics Status",
          "Tracking Number",
          "Driver Name",
          "Delivered By (Driver)",
          "Receiving Name",
          "Unique Items",
          "Total Units",
          "Combined Manifest Item Summary",
          "Combined Serials Dump",
          "Special Remark",
          "Last Logged Status"
        ];

        csvContent += headers.map(h => `"${h.replace(/"/g, '""')}"`).join(",") + "\n";

        targetOrders.forEach(o => {
          const dateStr = o.orderDate?.toDate ? o.orderDate.toDate().toLocaleString('en-GB') : new Date(o.orderDate || '').toLocaleString('en-GB');
          const lastMove = o.movement && o.movement.length > 0 ? o.movement[o.movement.length - 1].status : "No record";
          const pickupStr = getMovementTime(o, 'shipped');
          const receivedStr = getMovementTime(o, 'delivered');
          
          const uniqueItems = o.items.length;
          const totalUnits = o.items.reduce((sum, i) => sum + i.quantity, 0);
          
          const manifestSummary = o.items.map(i => `${i.name} (x${i.quantity})`).join("; ");
          const serialsDump = o.items.flatMap(i => i.serialNumbers || []).join("; ");

          const statusLower = (o.status || '').toLowerCase();
          const dName = o.driverName || ((statusLower === 'shipped' || statusLower === 'delivered') ? getDeterministicName(o.id, 'driver', o) : '');
          const delBy = o.deliveredBy || (statusLower === 'delivered' ? (o.driverName || getDeterministicName(o.id, 'driver', o)) : '');
          const recName = o.receivingName || (statusLower === 'delivered' ? getDeterministicName(o.id, 'receiver', o) : '');

          const row = [
            o.id,
            dateStr,
            pickupStr,
            receivedStr,
            o.userId || "Khex Terminal Node",
            o.shippingAddress,
            o.status.toUpperCase(),
            o.trackingNumber || "N/A",
            dName,
            delBy,
            recName,
            uniqueItems,
            totalUnits,
            manifestSummary,
            serialsDump,
            o.remark || "",
            lastMove
          ];
          csvContent += row.map(v => {
            const strVal = String(v ?? '');
            return `"${strVal.replace(/"/g, '""')}"`;
          }).join(",") + "\n";
        });
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      triggerDownload(blob, `khex-logistics-${reportDepth}-report-${statusFilter}-${new Date().toISOString().slice(0,10)}.csv`);
    }

    setDownloadSuccess(true);
    setTimeout(() => setDownloadSuccess(false), 3000);
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredCount = getFilteredOrders().length;

  return (
    <div className="space-y-8">
      {/* Search & Selection Card */}
      <div className="bg-white p-8 rounded-3xl border border-black/5 shadow-sm space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-black/5 pb-4">
          <div>
            <h4 className="text-xs font-black uppercase tracking-[0.3em] text-black/40 mb-1">
              Data Extraction Laboratory
            </h4>
            <h3 className="text-lg font-black text-black uppercase tracking-tight">
              Order & Serials Manifest Reports
            </h3>
          </div>
          
          <div className="bg-black/5 rounded-full px-4 py-1.5 flex items-center gap-2 self-start sm:self-auto text-xs font-bold text-black/60">
            <Info className="w-3.5 h-3.5 text-[#FF9800]" />
            <span>Matches Filtered: <strong className="text-black font-extrabold">{filteredCount}</strong> manifests</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-black/40 block">
              1. Output File Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReportFormat('csv')}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 font-bold text-xs ${
                  reportFormat === 'csv'
                    ? 'border-[#FF9800] bg-[#FF9800]/5 text-[#E65100]'
                    : 'border-black/5 hover:bg-black/[0.02] text-black/60'
                }`}
              >
                <FileSpreadsheet className="w-5 h-5" />
                <span>CSV Spreadsheet</span>
              </button>
              <button
                type="button"
                onClick={() => setReportFormat('json')}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 font-bold text-xs ${
                  reportFormat === 'json'
                    ? 'border-[#FF9800] bg-[#FF9800]/5 text-[#E65100]'
                    : 'border-black/5 hover:bg-black/[0.02] text-black/60'
                }`}
              >
                <FileJson className="w-5 h-5" />
                <span>JSON Backup</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-black/40 block">
              2. Structural Layout
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={reportFormat !== 'csv'}
                onClick={() => setReportDepth('detailed')}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 font-bold text-xs ${
                  reportFormat !== 'csv' ? 'opacity-40 cursor-not-allowed' : ''
                } ${
                  reportDepth === 'detailed' && reportFormat === 'csv'
                    ? 'border-black bg-black text-white'
                    : 'border-black/5 hover:bg-black/[0.02] text-black/60'
                }`}
              >
                <span className="text-sm font-black font-mono">1:N</span>
                <span className="text-[10px] leading-tight">Detailed Items</span>
              </button>
              <button
                type="button"
                disabled={reportFormat !== 'csv'}
                onClick={() => setReportDepth('summary')}
                className={`p-3 rounded-2xl border text-center transition-all flex flex-col items-center justify-center gap-1.5 font-bold text-xs ${
                  reportFormat !== 'csv' ? 'opacity-40 cursor-not-allowed' : ''
                } ${
                  reportDepth === 'summary' && reportFormat === 'csv'
                    ? 'border-black bg-black text-white'
                    : 'border-black/5 hover:bg-black/[0.02] text-black/60'
                }`}
              >
                <span className="text-sm font-black font-mono">1:1</span>
                <span className="text-[10px] leading-tight">Order Summary</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-black/40 block">
              3. Logistics Status
            </label>
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="w-full bg-black/[0.02] border border-black/10 rounded-2xl py-3 px-4 font-bold text-xs text-black outline-none focus:border-[#FF9800]"
            >
              <option value="all">All States combined</option>
              <option value="pending">Pending manifests</option>
              <option value="shipped">Active Shipped transit</option>
              <option value="delivered">Completed / Delivered</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-black/40 block">
              4. Location
            </label>
            <select
              value={locationFilter}
              onChange={(e) => setLocationFilter(e.target.value)}
              className="w-full bg-black/[0.02] border border-black/10 rounded-2xl py-3 px-4 font-bold text-xs text-black outline-none focus:border-[#FF9800]"
            >
              <option value="all">All Location</option>
              {uniqueLocations.map(loc => (
                <option key={loc} value={loc}>{loc}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredCount === 0 && (
          <div className="p-4 bg-amber-50 border border-amber-100 rounded-2xl text-amber-800 text-xs font-bold uppercase tracking-wider text-center">
            No matching logs exist for: Status={statusFilter.toUpperCase()}, Region={locationFilter.toUpperCase()}. Please adjust selections!
          </div>
        )}

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-black/5">
          <p className="text-[10px] text-black/40 leading-relaxed max-w-md font-medium">
            Extracting data compiles live Firestore logs in real-time. Detailed item rows include separated item names and individual barcode serial arrays for professional warehousing and inventory reconciliations.
          </p>

          <button
            type="button"
            disabled={filteredCount === 0}
            onClick={handleExport}
            className={`px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg transition-all ${
              filteredCount === 0
                ? 'bg-black/10 text-black/30 cursor-not-allowed shadow-none'
                : downloadSuccess
                ? 'bg-emerald-600 text-white shadow-emerald-500/20'
                : 'bg-[#FF9800] text-black hover:bg-[#FFA726] shadow-[#FF9800]/10'
            }`}
          >
            {downloadSuccess ? (
              <>
                <CheckCircle className="w-4 h-4" />
                REPORT COMPILED!
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                COMPILE AND DOWNLOAD
              </>
            )}
          </button>
        </div>
      </div>

      {/* Bulk Upload Control Center */}
      <BulkUploadControl
        orders={orders}
        getFilteredOrders={getFilteredOrders}
        locationFilter={locationFilter}
        statusFilter={statusFilter}
        triggerDownload={triggerDownload}
        reportDepth={reportDepth}
      />
    </div>
  );
}
