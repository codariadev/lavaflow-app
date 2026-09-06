'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole?: 'adm' | 'lavador' | 'cliente' | 'dev';
}

export default function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    let unsubscribeDoc: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        if (unsubscribeDoc) unsubscribeDoc();
        setAuthorized(false);
        setLoading(false);
        router.push('/login');
        return;
      }

      const userDocRef = doc(db, 'users', user.uid);
      unsubscribeDoc = onSnapshot(
        userDocRef,
        async (docSnap) => {
          if (!docSnap.exists()) {
            await setDoc(
              userDocRef,
              { role: 'cliente', createdAt: new Date().toISOString() },
              { merge: true }
            );
            if (allowedRole && allowedRole !== 'cliente') {
              router.push('/cliente');
            } else {
              setAuthorized(true);
            }
            setLoading(false);
            return;
          }

          const userData = docSnap.data();
          const role = userData?.role || 'cliente';

          if (allowedRole && role !== allowedRole) {
            setAuthorized(false);
            
            if (role === 'adm') router.push('/adm');
            else if (role === 'lavador') router.push('/lavador');
            else if (role === 'dev') router.push('/master');
            else router.push('/cliente');
          } else {
            setAuthorized(true);
          }
          
          setLoading(false);
        },
        (error) => {
          console.error('Erro ao verificar permissão do usuário:', error);
          setLoading(false);
          router.push('/login');
        }
      );
    });

    return () => {
      unsubscribeAuth();
      if (unsubscribeDoc) unsubscribeDoc();
    };
  }, [allowedRole, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-semibold">
        Carregando permissões...
      </div>
    );
  }

  return authorized ? <>{children}</> : null;
}