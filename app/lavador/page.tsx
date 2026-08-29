'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { signOut, onAuthStateChanged } from 'firebase/auth';
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  addDoc
} from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import defaultServices from '../data/services.json';

interface Agendamento {
  id: string;
  clienteId?: string;
  clienteNome: string;
  telefone?: string;
  vehicleModel: string;
  licensePlate: string;
  serviceType: string;
  date?: string;
  time?: string;
  status: 'pendente' | 'andamento' | 'concluido' | 'cancelado';
  obs?: string;
  createdAt?: string;
}

interface Servico {
  id: string;
  name: string;
  price: number;
  category: 'veiculo' | 'residencial';
}

export default function LavadorHome() {
  const router = useRouter();
  const [filtro, setFiltro] = useState<'pendente' | 'andamento' | 'concluido'>('pendente');
  const [modalManual, setModalManual] = useState(false);
  const [modalConcluir, setModalConcluir] = useState<Agendamento | null>(null);
  const [adicional, setAdicional] = useState('');
  const [loading, setLoading] = useState(true);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [userName, setUserName] = useState<string>('Lavador');
  const [servicos, setServicos] = useState<Servico[]>(defaultServices as Servico[]);

  const [formManual, setFormManual] = useState({
    clienteNome: '',
    telefone: '',
    vehicleModel: '',
    licensePlate: '',
    serviceType: '',
  });

  const servicoSelecionado = servicos.find((s) => s.id === formManual.serviceType);
  const isVeiculoManual = servicoSelecionado?.category === 'veiculo';
  const isResidencialManual = servicoSelecionado?.category === 'residencial';

  useEffect(() => {
    const unsubServicos = onSnapshot(doc(db, 'configuracoes', 'servicos'), (docSnap) => {
      if (docSnap.exists() && docSnap.data().lista) {
        setServicos(docSnap.data().lista);
      }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/login');
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().name) {
          setUserName(userDoc.data().name);
        } else if (user.displayName) {
          setUserName(user.displayName);
        }
      } catch (err) {
        console.error(err);
      }
    });

    const unsubscribeSnapshot = onSnapshot(
      collection(db, 'agendamentos'),
      async (snapshot) => {
        const lista = await Promise.all(
          snapshot.docs.map(async (docSnap) => {
            const data = docSnap.data();
            let tel = data.telefone;

            if (!tel && data.clienteId) {
              try {
                const uDoc = await getDoc(doc(db, 'users', data.clienteId));
                if (uDoc.exists() && uDoc.data().telefone) {
                  tel = uDoc.data().telefone;
                }
              } catch (e) {
                console.error('Erro ao buscar telefone do usuário:', e);
              }
            }

            return {
              ...data,
              id: docSnap.id,
              telefone: tel,
            } as Agendamento;
          })
        );

        lista.sort((a, b) => {
          const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return dateB - dateA;
        });

        setAgendamentos(lista);
        setLoading(false);
      }
    );

    return () => {
      unsubServicos();
      unsubscribeAuth();
      unsubscribeSnapshot();
    };
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push('/login');
    } catch (error) {
      console.error(error);
    }
  };

  const alterarStatus = async (
    id: string,
    novoStatus: 'andamento' | 'concluido',
    obsExtra?: string
  ) => {
    try {
      const docRef = doc(db, 'agendamentos', id);
      const updateData: { status: string; obs?: string } = {
        status: novoStatus,
      };

      if (obsExtra) {
        updateData.obs = obsExtra;
      }

      await updateDoc(docRef, updateData);

      if (novoStatus === 'concluido' && modalConcluir?.clienteId) {
        await fetch('/api/notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clienteId: modalConcluir.clienteId,
            vehicleModel: modalConcluir.vehicleModel,
            licensePlate: modalConcluir.licensePlate,
          }),
        });
      }

      setModalConcluir(null);
      setAdicional('');
    } catch (error) {
      console.error('Erro ao atualizar o status:', error);
      alert('Erro ao atualizar o status.');
    }
  };

  const handleCadastrarManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formManual.serviceType) return;

    try {
      const horaAtual = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      const dataAtual = new Date().toISOString().split('T')[0];

      await addDoc(collection(db, 'agendamentos'), {
        clienteNome: formManual.clienteNome,
        telefone: formManual.telefone,
        vehicleModel: isResidencialManual
          ? getServiceLabel(formManual.serviceType)
          : formManual.vehicleModel.toUpperCase(),
        licensePlate: isResidencialManual
          ? 'RESIDENCIAL'
          : formManual.licensePlate.toUpperCase(),
        serviceType: formManual.serviceType,
        date: dataAtual,
        time: horaAtual,
        status: 'pendente',
        createdAt: new Date().toISOString(),
      });

      setFormManual({
        clienteNome: '',
        telefone: '',
        vehicleModel: '',
        licensePlate: '',
        serviceType: '',
      });
      setModalManual(false);
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar o agendamento manual.');
    }
  };

  const getServiceLabel = (type: string) => {
    const servico = servicos.find((s) => s.id === type);
    return servico ? servico.name : 'Serviço Selecionado';
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const getWhatsappUrl = (
    telefone: string,
    clienteNome: string,
    veiculo: string
  ) => {
    const numLimpo = telefone.replace(/\D/g, '');
    const numComDdd = numLimpo.startsWith('55') ? numLimpo : `55${numLimpo}`;
    const texto = encodeURIComponent(
      `Olá ${clienteNome}, tudo bem? Estamos entrando em contato sobre o seu serviço (${veiculo}) na lavação.`
    );
    return `https://wa.me/${numComDdd}?text=${texto}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-semibold">
        Carregando lista do pátio...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <header className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
          <div>
            <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
              Painel Operacional
            </span>
            <h1 className="text-lg font-bold text-slate-800">
              Pátio de Lavação
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                {getInitials(userName)}
              </div>
              <span className="text-xs font-bold text-slate-700 hidden sm:inline">
                {userName}
              </span>
            </div>

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition cursor-pointer"
            >
              Sair
            </button>
          </div>
        </header>

        <button
          onClick={() => setModalManual(true)}
          className="w-full py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-md flex items-center justify-center gap-2 text-sm transition cursor-pointer"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Incluir Agendamento Manual (Presencial)
        </button>

        <div className="flex bg-slate-200 p-1 rounded-xl text-xs font-bold">
          <button
            onClick={() => setFiltro('pendente')}
            className={`flex-1 py-2 rounded-lg transition cursor-pointer ${
              filtro === 'pendente'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600'
            }`}
          >
            Aguardando
          </button>
          <button
            onClick={() => setFiltro('andamento')}
            className={`flex-1 py-2 rounded-lg transition cursor-pointer ${
              filtro === 'andamento'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600'
            }`}
          >
            Em Andamento
          </button>
          <button
            onClick={() => setFiltro('concluido')}
            className={`flex-1 py-2 rounded-lg transition cursor-pointer ${
              filtro === 'concluido'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600'
            }`}
          >
            Concluídos
          </button>
        </div>

        <div className="space-y-3">
          {agendamentos
            .filter((a) => a.status === filtro)
            .map((item) => (
              <div
                key={item.id}
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                      🕒 {item.time || 'Presencial'}
                    </span>
                    <h3 className="text-base font-bold text-slate-900 mt-1">
                      {item.vehicleModel}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono">
                      {item.licensePlate !== 'RESIDENCIAL'
                        ? `Placa: ${item.licensePlate} • `
                        : ''}
                      Cliente: {item.clienteNome}
                    </p>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                    {getServiceLabel(item.serviceType)}
                  </span>
                </div>

                {item.obs && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2 rounded-lg">
                    <strong>Adicional/Obs:</strong> {item.obs}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-100 flex gap-2">
                  {item.telefone ? (
                    <a
                      href={getWhatsappUrl(
                        item.telefone,
                        item.clienteNome,
                        item.vehicleModel
                      )}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2 px-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 shadow-sm"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        fill="currentColor"
                        viewBox="0 0 16 16"
                      >
                        <path d="M13.601 2.326A7.85 7.85 0 0 0 7.994 0C3.627 0 .068 3.558.064 7.926c0 1.399.366 2.76 1.057 3.965L0 16l4.204-1.102a7.9 7.9 0 0 0 3.79.965h.004c4.368 0 7.926-3.558 7.93-7.93A7.9 7.9 0 0 0 13.6 2.326zM7.994 14.521a6.57 6.57 0 0 1-3.356-.92l-.24-.144-2.494.654.666-2.433-.156-.251a6.56 6.56 0 0 1-1.007-3.505c0-3.626 2.957-6.584 6.591-6.584a6.56 6.56 0 0 1 4.66 1.931 6.56 6.56 0 0 1 1.928 4.66c-.004 3.639-2.961 6.592-6.592 6.592zm3.615-4.934c-.197-.099-1.17-.578-1.353-.646-.182-.065-.315-.099-.445.099-.133.197-.513.646-.627.775-.114.133-.232.148-.43.05-.197-.1-.836-.308-1.592-.985-.59-.525-.985-1.175-1.103-1.372-.114-.198-.011-.304.088-.403.087-.088.197-.232.296-.346.1-.114.133-.198.198-.33.065-.134.034-.248-.015-.347-.05-.099-.445-1.076-.612-1.47-.16-.389-.323-.335-.445-.34-.114-.007-.247-.007-.38-.007a.73.73 0 0 0-.529.247c-.182.198-.691.677-.691 1.654s.707 1.916.806 2.05c.1.134 1.392 2.125 3.372 2.98.47.203.838.324 1.125.415.472.15.902.129 1.241.078.378-.057 1.17-.478 1.336-.94.165-.462.165-.857.116-.94-.048-.083-.182-.133-.38-.232z" />
                      </svg>
                      WhatsApp
                    </a>
                  ) : (
                    <span className="py-2 px-3 bg-slate-100 text-slate-400 font-medium rounded-lg text-xs flex items-center justify-center">
                      Sem Whats
                    </span>
                  )}

                  {item.status === 'pendente' && (
                    <button
                      onClick={() => alterarStatus(item.id, 'andamento')}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                    >
                      Iniciar Lavação
                    </button>
                  )}

                  {item.status === 'andamento' && (
                    <button
                      onClick={() => setModalConcluir(item)}
                      className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                    >
                      Finalizar Lavação
                    </button>
                  )}
                </div>
              </div>
            ))}

          {agendamentos.filter((a) => a.status === filtro).length === 0 && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-500 font-medium">
              Nenhum item nesta categoria no momento.
            </div>
          )}
        </div>

        {modalConcluir && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Concluir Lavação
              </h3>
              <p className="text-xs text-slate-500">
                Item:{' '}
                <strong>
                  {modalConcluir.vehicleModel}{' '}
                  {modalConcluir.licensePlate !== 'RESIDENCIAL' &&
                    `(${modalConcluir.licensePlate})`}
                </strong>
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Adicionar Pacote Extra / Observação (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ex: Aplicação de Cera + R$ 20,00"
                  value={adicional}
                  onChange={(e) => setAdicional(e.target.value)}
                  className="w-full text-sm p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:border-slate-900 text-slate-800"
                />
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setModalConcluir(null)}
                  className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  onClick={() =>
                    alterarStatus(modalConcluir.id, 'concluido', adicional)
                  }
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer"
                >
                  Confirmar Conclusão
                </button>
              </div>
            </div>
          </div>
        )}

        {modalManual && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-md rounded-2xl p-5 space-y-4">
              <h3 className="text-base font-bold text-slate-900">
                Lançamento Manual (Pátio)
              </h3>
              <form onSubmit={handleCadastrarManual} className="space-y-3">
                <input
                  type="text"
                  placeholder="Nome do Cliente"
                  required
                  value={formManual.clienteNome}
                  onChange={(e) =>
                    setFormManual({
                      ...formManual,
                      clienteNome: e.target.value,
                    })
                  }
                  className="w-full text-sm p-2.5 rounded-lg border border-slate-300 text-slate-800"
                />

                <input
                  type="tel"
                  placeholder="Telefone / WhatsApp (ex: 47999998888)"
                  value={formManual.telefone}
                  onChange={(e) =>
                    setFormManual({ ...formManual, telefone: e.target.value })
                  }
                  className="w-full text-sm p-2.5 rounded-lg border border-slate-300 text-slate-800"
                />

                <select
                  required
                  value={formManual.serviceType}
                  onChange={(e) =>
                    setFormManual({
                      ...formManual,
                      serviceType: e.target.value,
                    })
                  }
                  className="w-full text-sm p-2.5 rounded-lg border border-slate-300 text-slate-800 bg-white font-medium"
                >
                  <option value="">-- Selecione o serviço --</option>
                  {servicos.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.price > 0 ? `- R$ ${s.price.toFixed(2)}` : '- Sob Orçamento'}
                    </option>
                  ))}
                </select>

                {isVeiculoManual && (
                  <>
                    <input
                      type="text"
                      placeholder="Modelo do Veículo"
                      required
                      value={formManual.vehicleModel}
                      onChange={(e) =>
                        setFormManual({
                          ...formManual,
                          vehicleModel: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full text-sm p-2.5 rounded-lg border border-slate-300 text-slate-800 uppercase"
                    />
                    <input
                      type="text"
                      placeholder="Placa"
                      required
                      value={formManual.licensePlate}
                      onChange={(e) =>
                        setFormManual({
                          ...formManual,
                          licensePlate: e.target.value.toUpperCase(),
                        })
                      }
                      className="w-full text-sm p-2.5 rounded-lg border border-slate-300 text-slate-800 uppercase"
                    />
                  </>
                )}

                <div className="flex gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModalManual(false)}
                    className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={!formManual.serviceType}
                    className="flex-1 py-2.5 bg-blue-600 text-white font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}