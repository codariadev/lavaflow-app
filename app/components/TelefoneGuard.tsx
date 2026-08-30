'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';

export default function TelefoneGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [hasMissingPhone, setHasMissingPhone] = useState(false);
  const [telefone, setTelefone] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Verifica se é uma rota pública/de autenticação
  const isAuthPage =
    pathname?.startsWith('/login') ||
    pathname?.startsWith('/register') ||
    pathname?.startsWith('/cadastro');

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (!user) {
        setHasMissingPhone(false);
        setUserId(null);
        return;
      }

      setUserId(user.uid);

      const userDocRef = doc(db, 'users', user.uid);
      const unsubscribeDoc = onSnapshot(userDocRef, (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data();

          // Exibe o modal apenas se o usuário já escolheu a role (cadastro concluído)
          // e o campo telefone está em branco ou ausente
          if (userData?.role && (!userData?.telefone || userData?.telefone.trim() === '')) {
            setHasMissingPhone(true);
          } else {
            setHasMissingPhone(false);
          }
        } else {
          setHasMissingPhone(false);
        }
      });

      return () => unsubscribeDoc();
    });

    return () => unsubscribeAuth();
  }, []);

  const handleSaveTelefone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId || !telefone.trim()) return;

    setLoading(true);
    try {
      await setDoc(
        doc(db, 'users', userId),
        { telefone: telefone.trim() },
        { merge: true }
      );
      setHasMissingPhone(false);
    } catch (err) {
      console.error('Erro ao salvar telefone:', err);
    } finally {
      setLoading(false);
    }
  };

  // O modal só é exibido se houver falta de telefone E NÃO estiver nas rotas de auth
  const shouldShowModal = !isAuthPage && hasMissingPhone;

  return (
    <>
      {children}

      {shouldShowModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white w-full max-w-sm p-6 rounded-2xl shadow-xl space-y-4">
            <div className="text-center">
              <h2 className="text-lg font-bold text-slate-800">
                Informe seu Telefone / WhatsApp
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                Precisamos do seu contato para atualizar sobre seus agendamentos.
              </p>
            </div>

            <form onSubmit={handleSaveTelefone} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  WhatsApp / Telefone
                </label>
                <input
                  type="tel"
                  required
                  placeholder="Ex: 47999998888"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="w-full text-sm p-3 rounded-xl border border-slate-200 focus:outline-none focus:border-blue-600 text-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition shadow-md cursor-pointer disabled:opacity-50"
              >
                {loading ? 'Salvando...' : 'Salvar e Continuar'}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}