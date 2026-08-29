'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRole: 'cliente' | 'lavador' | 'adm';
}

export default function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));

        if (userDoc.exists()) {
          const userRole = userDoc.data().role;

          if (userRole !== allowedRole) {
            switch (userRole) {
              case 'lavador':
                router.push('/lavador');
                break;
              case 'adm':
                router.push('/adm');
                break;
              case 'cliente':
              default:
                router.push('/cliente');
                break;
            }
            return;
          }
        } else {
          router.push('/login');
          return;
        }

        setLoading(false);
      } catch (error) {
        console.error('Erro ao verificar permissão do usuário:', error);
        router.push('/login');
      }
    });

    return () => unsubscribe();
  }, [allowedRole, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-semibold">
        Verificando permissões de acesso...
      </div>
    );
  }

  return <>{children}</>;
}