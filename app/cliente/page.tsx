'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, onAuthStateChanged, User } from 'firebase/auth';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  doc, 
  getDoc,
  getDocs
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import defaultServices from '../data/services.json';
import ProtectedRoute from '../components/ProtectedRoute';

interface Empresa {
  id: string;
  nome: string;
  endereco?: string;
}

interface Agendamento {
  id: string;
  clienteId: string;
  empresaId?: string;
  empresaNome?: string;
  vehicleModel: string;
  licensePlate: string;
  serviceType: string;
  date?: string;
  time?: string;
  status: 'aguardando_aprovacao' | 'pendente' | 'andamento' | 'concluido' | 'cancelado';
  createdAt: string;
}

interface Servico {
  id: string;
  name: string;
  price?: number;
  category: 'veiculo' | 'residencial';
}

export default function ClienteHome() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userName, setUserName] = useState<string>('Cliente');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [buscaEmpresa, setBuscaEmpresa] = useState<string>('');
  const [empresaSelecionada, setEmpresaSelecionada] = useState<Empresa | null>(null);

  const [servicos, setServicos] = useState<Servico[]>(defaultServices as Servico[]);
  const [agendamentoAtivo, setAgendamentoAtivo] = useState<Agendamento | null>(null);

  const [formData, setFormData] = useState({
    vehicleModel: '',
    licensePlate: '',
    serviceType: '',
  });

  const servicoSelecionado = servicos.find((s) => s.id === formData.serviceType);
  const isVeiculo = servicoSelecionado?.category === 'veiculo';
  const isResidencial = servicoSelecionado?.category === 'residencial';

  const dispararNotificacaoPushCliente = async (veiculo: string, placa: string) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;

    if (Notification.permission === 'granted') {
      try {
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.ready;
          const options: NotificationOptions & { vibrate?: number[] } = {
            body: `Seu serviço/veículo ${veiculo} (${placa}) está pronto!`,
            icon: '/favicon.ico',
            vibrate: [200, 100, 200],
          };
          reg.showNotification('Sua lavação foi concluída! 🚗✨', options);
        } else {
          new Notification('Sua lavação foi concluída! 🚗✨', {
            body: `Seu serviço/veículo ${veiculo} (${placa}) está pronto!`,
            icon: '/favicon.ico',
          });
        }
      } catch (err) {
        console.error('Erro ao exibir notificação:', err);
      }
    }
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push('/login');
        return;
      }

      setUser(currentUser);

      try {
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        if (userDoc.exists() && userDoc.data().name) {
          setUserName(userDoc.data().name);
        } else if (currentUser.displayName) {
          setUserName(currentUser.displayName);
        }
      } catch (err) {
        console.error("Erro ao buscar dados do usuário:", err);
      }
    });

    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const carregarEmpresasEAgendamentos = async () => {
      try {
        const querySnapshot = await getDocs(collection(db, 'empresas'));
        const listaEmpresas: Empresa[] = querySnapshot.docs.map((docSnap) => ({
          id: docSnap.id,
          nome: docSnap.data().nome || 'Lava-Jato',
          endereco: docSnap.data().endereco || '',
        }));
        setEmpresas(listaEmpresas);

        const unsubscribes = listaEmpresas.map((emp) => {
          const q = query(
            collection(db, 'empresas', emp.id, 'agendamentos'),
            where('clienteId', '==', user.uid)
          );

          return onSnapshot(q, (snapshot) => {
            const agendamentosEmpresa = snapshot.docs.map((docSnap) => ({
              ...docSnap.data(),
              id: docSnap.id,
            })) as Agendamento[];

            setAgendamentoAtivo((prevAtivo) => {
              const agora = new Date().getTime();
              const duasHorasEmMs = 2 * 60 * 60 * 1000;

              const ativoLocal = agendamentosEmpresa.find((item) => {
                if (item.status === 'aguardando_aprovacao' || item.status === 'pendente' || item.status === 'andamento') {
                  return true;
                }
                if (item.status === 'concluido') {
                  const dataItem = new Date(item.createdAt).getTime();
                  return (agora - dataItem) < duasHorasEmMs;
                }
                return false;
              });
              
              const ultimoConcluido = agendamentosEmpresa.find((item) => item.status === 'concluido');
              if (ultimoConcluido) {
                const key = `notificado_${ultimoConcluido.id}`;
                if (!localStorage.getItem(key)) {
                  dispararNotificacaoPushCliente(ultimoConcluido.vehicleModel, ultimoConcluido.licensePlate);
                  localStorage.setItem(key, 'true');
                }
              }

              return ativoLocal || prevAtivo;
            });
            setLoading(false);
          });
        });

        if (listaEmpresas.length === 0) {
          setLoading(false);
        }

        return () => {
          unsubscribes.forEach((unsub) => unsub());
        };
      } catch (err) {
        console.error("Erro ao carregar dados:", err);
        setLoading(false);
      }
    };

    carregarEmpresasEAgendamentos();
  }, [user]);

  useEffect(() => {
    if (!empresaSelecionada) return;

    const servicosRef = doc(db, 'empresas', empresaSelecionada.id, 'configuracoes', 'servicos');
    const unsubServicos = onSnapshot(servicosRef, (docSnap) => {
      if (docSnap.exists() && docSnap.data().lista) {
        setServicos(docSnap.data().lista);
      } else {
        setServicos(defaultServices as Servico[]);
      }
    });

    return () => unsubServicos();
  }, [empresaSelecionada]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !formData.serviceType || !empresaSelecionada) {
      alert('Por favor, selecione uma empresa e um serviço.');
      return;
    }

    setSubmitting(true);

    try {
      const userDocSnap = await getDoc(doc(db, 'users', user.uid));
      const userPhone = userDocSnap.exists() ? userDocSnap.data().telefone || '' : '';

      const novoAgendamento = {
        clienteId: user.uid,
        clienteNome: userName,
        telefone: userPhone,
        empresaId: empresaSelecionada.id,
        empresaNome: empresaSelecionada.nome,
        vehicleModel: isResidencial ? getServiceLabel(formData.serviceType) : formData.vehicleModel.toUpperCase(),
        licensePlate: isResidencial ? 'RESIDENCIAL' : formData.licensePlate.toUpperCase(),
        serviceType: formData.serviceType,
        status: 'aguardando_aprovacao',
        createdAt: new Date().toISOString(),
      };

      await addDoc(collection(db, 'empresas', empresaSelecionada.id, 'agendamentos'), novoAgendamento);

      setFormData({
        vehicleModel: '',
        licensePlate: '',
        serviceType: '',
      });

      alert('Solicitação enviada para a empresa com sucesso!');

    } catch (error) {
      console.error('Erro ao salvar agendamento:', error);
      alert('Ocorreu um erro ao realizar o agendamento. Tente novamente.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error('Erro ao fazer logout:', error);
    }
  };

  const getServiceLabel = (type: string) => {
    const servico = servicos.find((s) => s.id === type);
    return servico ? servico.name : (type || 'Serviço Selecionado');
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const empresasFiltradas = empresas.filter((emp) =>
    emp.nome.toLowerCase().includes(buscaEmpresa.toLowerCase()) ||
    (emp.endereco && emp.endereco.toLowerCase().includes(buscaEmpresa.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-600 text-sm font-semibold">
        Carregando informações do pátio...
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRole="cliente">
      <div className="min-h-screen bg-slate-50 p-4 sm:p-6 lg:p-8">
        <div className="max-w-xl mx-auto space-y-6">
          <header className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
            <div>
              <p className="text-xs text-slate-400 font-medium">Bem-vindo(a) 👋</p>
              <h1 className="text-lg font-bold text-slate-800">{userName}</h1>
            </div>
            <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-sm">
              {getInitials(userName)}
            </div>
          </header>

          {agendamentoAtivo ? (
            <section className="bg-slate-900 text-white p-5 rounded-2xl shadow-md space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  {agendamentoAtivo.status === 'aguardando_aprovacao' && (
                    <span className="inline-block bg-amber-500/20 text-amber-300 text-xs px-2.5 py-1 rounded-full font-semibold border border-amber-500/30">
                      Aguardando Aprovação ⏳
                    </span>
                  )}
                  {agendamentoAtivo.status === 'pendente' && (
                    <span className="inline-block bg-blue-500/20 text-blue-300 text-xs px-2.5 py-1 rounded-full font-semibold border border-blue-500/30">
                      Aprovado / Na Fila 🕒
                    </span>
                  )}
                  {agendamentoAtivo.status === 'andamento' && (
                    <span className="inline-block bg-emerald-500/20 text-emerald-300 text-xs px-2.5 py-1 rounded-full font-semibold border border-emerald-500/30">
                      Em Andamento 🧼
                    </span>
                  )}
                  {agendamentoAtivo.status === 'concluido' && (
                    <span className="inline-block bg-purple-500/20 text-purple-300 text-xs px-2.5 py-1 rounded-full font-semibold border border-purple-500/30">
                      Serviço Concluído ✅
                    </span>
                  )}

                  <h2 className="text-xl font-bold mt-2">
                    {agendamentoAtivo.vehicleModel} {agendamentoAtivo.licensePlate !== 'RESIDENCIAL' && `- ${agendamentoAtivo.licensePlate}`}
                  </h2>
                  <p className="text-xs text-slate-300">
                    {agendamentoAtivo.empresaNome ? `Empresa: ${agendamentoAtivo.empresaNome} • ` : ''}
                    {getServiceLabel(agendamentoAtivo.serviceType)}
                  </p>
                </div>
                {agendamentoAtivo.time && (
                  <span className="text-sm font-semibold text-slate-300">
                    {agendamentoAtivo.time}
                  </span>
                )}
              </div>
              <div className="pt-2 border-t border-slate-700/50 flex justify-between items-center text-xs text-slate-400">
                <span>
                  {agendamentoAtivo.date ? `Data Agendada: ${agendamentoAtivo.date}` : 'Aguardando confirmação de data/hora'}
                </span>
                <span className="text-slate-300 font-medium">Acompanhamento</span>
              </div>
            </section>
          ) : (
            <section className="bg-slate-200/60 p-4 rounded-2xl text-center space-y-1 border border-slate-200">
              <p className="text-sm font-bold text-slate-700">Nenhum agendamento ativo no momento</p>
              <p className="text-xs text-slate-500">Escolha uma empresa abaixo para agendar seu serviço.</p>
            </section>
          )}

          <section className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-3">
            <h2 className="text-sm font-bold text-slate-800">1. Buscar e Selecionar Empresa</h2>
            
            <div className="relative">
              <input
                type="text"
                placeholder="Pesquisar por nome ou endereço..."
                value={buscaEmpresa}
                onChange={(e) => setBuscaEmpresa(e.target.value)}
                className="w-full text-xs p-3 pl-9 rounded-xl border border-slate-200 text-slate-800 focus:outline-none focus:border-blue-600 bg-slate-50"
              />
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4 text-slate-400 absolute left-3 top-3.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 pt-1">
              {empresasFiltradas.map((emp) => {
                const isSelected = empresaSelecionada?.id === emp.id;
                return (
                  <div
                    key={emp.id}
                    onClick={() => setEmpresaSelecionada(emp)}
                    className={`p-3 rounded-xl border transition cursor-pointer flex justify-between items-center ${
                      isSelected
                        ? "bg-blue-50 border-blue-500 text-blue-900"
                        : "bg-slate-50/50 border-slate-200 hover:bg-slate-100 text-slate-800"
                    }`}
                  >
                    <div>
                      <h4 className="text-xs font-bold">{emp.nome}</h4>
                      {emp.endereco && (
                        <p className="text-[11px] text-slate-500">{emp.endereco}</p>
                      )}
                    </div>
                    {isSelected && (
                      <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-md">
                        Selecionada
                      </span>
                    )}
                  </div>
                );
              })}

              {empresasFiltradas.length === 0 && (
                <p className="text-center py-4 text-xs text-slate-400">
                  Nenhuma empresa encontrada com este nome.
                </p>
              )}
            </div>
          </section>

          <section className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
            <h2 className="text-base font-bold text-slate-800 mb-4">
              2. Novo Agendamento {empresaSelecionada ? `em ${empresaSelecionada.nome}` : ''}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Qual serviço você deseja?</label>
                <select
                  required
                  disabled={!empresaSelecionada}
                  value={formData.serviceType}
                  onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                  className="w-full text-sm p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 text-slate-800 bg-white font-medium disabled:bg-slate-100 disabled:cursor-not-allowed"
                >
                  <option value="">
                    {empresaSelecionada ? "-- Selecione o serviço --" : "-- Selecione uma empresa primeiro --"}
                  </option>
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.price ? `- R$ ${s.price.toFixed(2)}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {isVeiculo && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-fadeIn">
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Modelo do Veículo</label>
                    <input
                      type="text"
                      required
                      placeholder="EX: COROLLA, CG 160"
                      value={formData.vehicleModel}
                      onChange={(e) => setFormData({ ...formData, vehicleModel: e.target.value.toUpperCase() })}
                      className="w-full text-sm p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 text-slate-800 uppercase"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Placa do Veículo</label>
                    <input
                      type="text"
                      required
                      placeholder="EX: ABC-1234"
                      value={formData.licensePlate}
                      onChange={(e) => setFormData({ ...formData, licensePlate: e.target.value.toUpperCase() })}
                      className="w-full text-sm p-3 rounded-lg border border-slate-200 focus:outline-none focus:border-slate-900 text-slate-800 uppercase"
                    />
                  </div>
                </div>
              )}

              {formData.serviceType && (
                <button
                  type="submit"
                  disabled={submitting || !empresaSelecionada}
                  className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg text-sm transition shadow-md mt-2 disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Enviando Solicitação...' : 'Solicitar Agendamento'}
                </button>
              )}
            </form>
          </section>

          <footer className="pt-4 pb-8 flex justify-center">
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 hover:border-red-300 text-sm font-semibold transition cursor-pointer"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sair da Conta
            </button>
          </footer>
        </div>
      </div>
    </ProtectedRoute>
  );
}