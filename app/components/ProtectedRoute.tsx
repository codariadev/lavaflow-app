'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: 'adm' | 'lavador' | 'cliente';
}

export default function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      const userDocRef = doc(db, 'users', user.uid);
      const unsubscribeDoc = onSnapshot(userDocRef, async (docSnap) => {
        if (!docSnap.exists()) {
          // Se o documento não existir, garante que ele seja criado antes de barrar a rota
          await setDoc(userDocRef, { role: 'cliente', createdAt: new Date().toISOString() }, { merge: true });
          setAuthorized(true);
          setLoading(false);
          return;
        }

        const userData = docSnap.data();
        const role = userData?.role || 'cliente';

        if (allowedRole && role !== allowedRole) {
          if (role === 'adm') router.push('/adm');
          else if (role === 'lavador') router.push('/lavador');
          else router.push('/cliente');
        } else {
          setAuthorized(true);
        }
        setLoading(false);
      });

      return () => unsubscribeDoc();
    });

    return () => unsubscribeAuth();
  }, [allowedRole, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-semibold">
        Carregando...
      </div>
    );
  }

  return authorized ? <>{children}</> : null;
}