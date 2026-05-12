/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider,
  signOut,
  User
} from 'firebase/auth';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  orderBy 
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { Order } from './types';
import Dashboard from './components/Dashboard';
import { LogIn, Package, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

import Logo from './components/Logo';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);

  const [errorStatus, setErrorStatus] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      console.log("Auth State Changed:", u ? `User: ${u.email}` : "No User");
      setUser(u);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) {
      setOrders([]);
      return;
    }

    const q = query(
      collection(db, 'orders')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const ordersData = snapshot.docs.map(doc => {
        const data = doc.data();
        // Determine the ID from document or data
        const docId = doc.id;
        
        // Normalize items
        let normalizedItems = [];
        if (Array.isArray(data.items)) {
          normalizedItems = data.items;
        } else if (data.items && typeof data.items === 'object') {
          normalizedItems = Object.entries(data.items).map(([key, val]: [string, any]) => ({
            name: key,
            quantity: val.count || 1,
            productId: key,
            price: 0
          }));
        }

        return {
          id: docId,
          ...data,
          status: data.status || 'pending',
          items: normalizedItems,
          shippingAddress: data.shippingAddress || data.location || 'Not Specified',
          movement: Array.isArray(data.movement) ? data.movement : [],
          orderDate: data.createdAt ? (typeof data.createdAt === 'string' ? { toDate: () => new Date(data.createdAt) } : data.createdAt) : 
                    (data.orderDate || { toDate: () => new Date() })
        };
      }) as Order[];
      setOrders(ordersData);
    }, (error: any) => {
      console.error("Firestore error:", error);
      if (error.message && error.message.includes("requires an index")) {
        setErrorStatus("Database index required. Please check browser console for the direct creation link.");
      } else {
        setErrorStatus("Storage Connection Error: " + (error.code || error.message));
      }
    });

    return () => unsubscribe();
  }, [user]);

  const login = async () => {
    setErrorStatus(null);
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Login error:", error);
      if (error.code === 'auth/popup-blocked') {
        setErrorStatus("Popup was blocked by your browser.");
      } else if (error.code === 'auth/unauthorized-domain') {
        setErrorStatus("This domain is not authorized in your Firebase console.");
      } else {
        setErrorStatus(error.message || "Failed to sign in.");
      }
    }
  };

  const logout = () => signOut(auth);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#dbdbdb] flex items-center justify-center">
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center gap-4"
        >
          <Loader2 className="w-8 h-8 animate-spin text-black" />
          <p className="text-black/40 font-bold uppercase tracking-widest text-[10px]">
            KHEX LOGISTIC...
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#dbdbdb] text-black font-sans selection:bg-black selection:text-white">
      <AnimatePresence mode="wait">
        {!user ? (
          <motion.div 
            key="login"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.02 }}
            className="flex flex-col items-center justify-center min-h-screen p-6"
          >
            <div className="max-w-md w-full bg-white border border-black/10 rounded-[32px] p-12 shadow-2xl flex flex-col items-center text-center">
              <Logo className="mb-10 scale-125" />
              <p className="text-black/40 mb-10 text-lg leading-relaxed font-light">
                Secure item tracking for KHEX clients.
              </p>
              {errorStatus && (
                <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl text-red-600 text-xs font-bold uppercase tracking-widest text-center">
                  {errorStatus}
                </div>
              )}
              <button
                onClick={login}
                className="w-full bg-black text-white rounded-full py-4 px-8 flex items-center justify-center gap-3 hover:bg-black/90 transition-all font-bold text-sm tracking-widest uppercase group"
              >
                <LogIn className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                Access Dashboard
              </button>
            </div>
          </motion.div>
        ) : (
          <Dashboard orders={orders} user={user} onLogout={logout} />
        )}
      </AnimatePresence>
    </div>
  );
}


