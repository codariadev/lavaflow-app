'use client';

import { useState, useEffect } from 'react';
import { auth, db, app } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getMessaging, getToken } from 'firebase/messaging';

export default function NotificationGuard({ children }: { children: React.ReactNode }) {
  const [permission, setPermission] = useState<NotificationPermission | 'loading'>('loading');

  const getSwUrl = () => {
    const params = new URLSearchParams({
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || '',
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || '',
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || '',
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '',
    });
    return `/firebase-messaging-sw.js?${params.toString()}`;
  };

  useEffect(() => {
    const checkNotificationPermission = async () => {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);

        if ('serviceWorker' in navigator && Notification.permission === 'granted') {
          try {
            await navigator.serviceWorker.register(getSwUrl());
          } catch (err: unknown) {
            console.error('Erro ao registrar Service Worker:', err);
          }
        }
      } else {
        setPermission('granted');
      }
    };

    const timer = setTimeout(checkNotificationPermission, 0);
    return () => clearTimeout(timer);
  }, []);

  const requestPermission = async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    try {
      const res = await Notification.requestPermission();
      setPermission(res);

      if (res === 'granted' && 'serviceWorker' in navigator) {
        await navigator.serviceWorker.register(getSwUrl());

        if (auth.currentUser) {
          const messaging = getMessaging(app);
          const fcmToken = await getToken(messaging, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          });

          if (fcmToken) {
            await updateDoc(doc(db, 'users', auth.currentUser.uid), {
              fcmToken: fcmToken,
              pushEnabled: true,
              lastNotificationPermissionAt: new Date().toISOString(),
            });
          }
        }
      }
    } catch (error: unknown) {
      console.error('Erro ao solicitar permissão:', error);
    }
  };

  if (permission === 'loading') {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-sm">
        Validando permissões...
      </div>
    );
  }

  if (permission !== 'granted') {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/95 flex items-center justify-center p-4 text-white">
        <div className="max-w-md bg-slate-800 p-6 rounded-2xl shadow-2xl border border-slate-700 text-center space-y-4">
          <div className="w-12 h-12 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center mx-auto text-xl">
            🔔
          </div>
          <h2 className="text-lg font-bold">Ative as Notificações</h2>
          <p className="text-xs text-slate-300 leading-relaxed">
            Para acompanhar o progresso e receber o aviso automático no celular/computador quando seu veículo estiver pronto, é obrigatório permitir as notificações.
          </p>
          {permission === 'denied' && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 text-red-300 text-xs rounded-lg">
              Notificação bloqueada no seu navegador. Acesse as configurações de permissão do site (ícone de cadeado) e altere para <strong>Permitir</strong>.
            </div>
          )}
          <button
            onClick={requestPermission}
            className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-bold text-sm rounded-xl transition shadow-lg cursor-pointer"
          >
            Ativar Notificação para Continuar
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}