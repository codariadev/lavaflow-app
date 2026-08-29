'use client';

import { useState, useEffect } from 'react';
import { auth, db } from '../lib/firebase';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

export default function TelefoneGuard({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [precisaTelefone, setPrecisaTelefone] = useState(false);
  const [telefone, setTelefone] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const data = userDocSnap.data();
          if (!data.telefone || data.telefone.trim() === '') {
            setPrecisaTelefone(true);
          }
        } else {
          setPrecisaTelefone(true);
        }
      } catch (err) {
        console.error('Erro ao verificar telefone:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleSalvarTelefone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !telefone.trim()) return;

    setSalvando(true);
    try {
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userDocRef, {
        telefone: telefone.trim(),
        updatedAt: new Date().toISOString(),
      });

      setPrecisaTelefone(false);
    } catch (err) {
      console.error('Erro ao salvar telefone:', err);
      alert('Erro ao salvar telefone. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white text-sm font-semibold">
        Verificando dados do perfil...
      </div>
    );
  }

  return (
    <>
      {precisaTelefone && (
        <div className="fixed inset-0 z-50 bg-slate-900/95 flex items-center justify-center p-4 text-white">
          <div className="max-w-md w-full bg-slate-800 p-6 rounded-2xl shadow-2xl border border-slate-700 text-center space-y-4">
            <div className="w-12 h-12 bg-blue-600/20 text-blue-400 rounded-full flex items-center justify-center mx-auto text-xl">
              📱
            </div>
            <h2 className="text-lg font-bold">Informe seu Telefone</h2>
            <p className="text-xs text-slate-300 leading-relaxed">
              Para prosseguir e concluir seus agendamentos, precisamos do seu número de telefone/WhatsApp para contato.
            </p>

            <form onSubmit={handleSalvarTelefone} className="space-y-3 pt-2">
              <input
                type="tel"
                required
                placeholder="(47) 99999-9999"
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                className="w-full text-sm p-3 rounded-xl border border-slate-700 bg-slate-900 text-white focus:outline-none focus:border-blue-500 text-center font-medium"
              />

              <button
                type="submit"
                disabled={salvando || !telefone.trim()}
                className="w-full py-3 bg-blue-600 hover:bg-blue-500 font-bold text-sm rounded-xl transition shadow-lg cursor-pointer disabled:opacity-50"
              >
                {salvando ? 'Salvando...' : 'Salvar e Continuar'}
              </button>
            </form>
          </div>
        </div>
      )}
      {children}
    </>
  );
}