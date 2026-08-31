'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  createUserWithEmailAndPassword, 
  signInWithPopup, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db, googleProvider } from '@/app/lib/firebase';

interface FirebaseAuthError {
  code?: string;
  message?: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [step, setStep] = useState<1 | 2>(1);
  const [userCreated, setUserCreated] = useState<User | null>(null);

  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [senha, setSenha] = useState('');

  const [tipoConta, setTipoConta] = useState<'cliente' | 'empresa'>('cliente');

  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stepParam = searchParams.get('step');

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser && stepParam === '2') {
        setUserCreated(currentUser);
        if (currentUser.displayName) setNome(currentUser.displayName);
        if (currentUser.email) setEmail(currentUser.email);
        setStep(2);
      }
    });

    return () => unsubscribe();
  }, [searchParams]);

  const handleAuthRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, senha);
      setUserCreated(userCredential.user);
      setStep(2);
    } catch (err: unknown) {
      console.error(err);
      const firebaseError = err as FirebaseAuthError;

      if (firebaseError.code === 'auth/email-already-in-use') {
        setErro('Este e-mail já está em uso.');
      } else if (firebaseError.code === 'auth/weak-password') {
        setErro('A senha deve ter pelo menos 6 caracteres.');
      } else {
        setErro('Erro ao criar conta. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRegister = async () => {
    setErro('');
    setLoading(true);

    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      if (user.displayName) setNome(user.displayName);
      if (user.email) setEmail(user.email);

      setUserCreated(user);
      setStep(2);
    } catch (err: unknown) {
      console.error(err);
      setErro('Erro ao realizar autenticação com o Google.');
    } finally {
      setLoading(false);
    }
  };

  const handleProfileSelection = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userCreated) return;

    setErro('');
    setLoading(true);

    try {
      const role = tipoConta === 'empresa' ? 'adm' : 'cliente';

      await setDoc(
        doc(db, 'users', userCreated.uid),
        {
          name: nome || userCreated.displayName || '',
          email: userCreated.email || email,
          role,
          empresaId: tipoConta === 'empresa' ? userCreated.uid : null,
          createdAt: new Date().toISOString(),
        },
        { merge: true }
      );

      if (tipoConta === 'empresa') {
        router.push('/adm');
      } else {
        router.push('/cliente');
      }
    } catch (err: unknown) {
      console.error(err);
      setErro('Erro ao salvar informações do perfil. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md p-6 sm:p-8 rounded-2xl shadow-md space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 text-center">
            {step === 1 ? 'Criar Conta' : 'Selecione o Perfil'}
          </h1>
          <p className="text-xs text-slate-500 text-center mt-1">
            {step === 1
              ? 'Escolha como deseja se registrar'
              : 'Defina se você usará a conta como cliente ou empresa'}
          </p>
        </div>

        {erro && (
          <div className="bg-red-50 text-red-600 text-xs p-3 rounded-lg border border-red-200 text-center font-medium">
            {erro}
          </div>
        )}

        {step === 1 && (
          <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleRegister}
              disabled={loading}
              className="w-full py-3 px-4 border border-slate-300 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              Cadastrar com Google
            </button>

            <div className="flex items-center my-3">
              <div className="flex-1 border-t border-slate-200"></div>
              <span className="px-3 text-xs text-slate-400 font-semibold">ou preencha os dados</span>
              <div className="flex-1 border-t border-slate-200"></div>
            </div>

            <form onSubmit={handleAuthRegister} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nome Completo</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: João Silva"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full text-sm p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail</label>
                <input
                  type="email"
                  required
                  placeholder="seuemail@exemplo.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full text-sm p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 text-slate-800"
                />
              </div>


              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Senha</label>
                <input
                  type="password"
                  required
                  placeholder="Mínimo 6 caracteres"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="w-full text-sm p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-blue-600 text-slate-800"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition shadow-md disabled:opacity-50 cursor-pointer mt-2"
              >
                {loading ? 'Criando Conta...' : 'Continuar'}
              </button>
            </form>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleProfileSelection} className="space-y-4">
            <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setTipoConta('cliente')}
                className={`flex-1 py-2.5 rounded-lg transition cursor-pointer ${
                  tipoConta === 'cliente'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sou Cliente
              </button>
              <button
                type="button"
                onClick={() => setTipoConta('empresa')}
                className={`flex-1 py-2.5 rounded-lg transition cursor-pointer ${
                  tipoConta === 'empresa'
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Sou Empresa / Lava-Jato
              </button>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition shadow-md disabled:opacity-50 cursor-pointer mt-2"
            >
              {loading ? 'Finalizando...' : 'Concluir Cadastro'}
            </button>
          </form>
        )}

        <p className="text-center text-xs text-slate-500">
          Já possui conta?{' '}
          <Link href="/login" className="text-blue-600 font-bold hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}