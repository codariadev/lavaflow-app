"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  collectionGroup,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import defaultServices from "../data/services.json";
import ProtectedRoute from "../components/ProtectedRoute";

interface Agendamento {
  id: string;
  clienteId?: string;
  clienteNome?: string;
  vehicleModel?: string;
  licensePlate?: string;
  serviceType?: string;
  date?: string;
  time?: string;
  status: "pendente" | "andamento" | "concluido" | "cancelado";
  createdAt?: string;
}

interface Servico {
  id: string;
  name: string;
  price: number;
  category: "veiculo" | "residencial";
}

export default function AdmDashboard() {
  const router = useRouter();
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [loading, setLoading] = useState(true);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [userName, setUserName] = useState<string>("Administrador");
  const [salvandoServicos, setSalvandoServicos] = useState(false);
  const [modalPrecosAberto, setModalPrecosAberto] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().name) {
          setUserName(userDoc.data().name);
        } else if (user.displayName) {
          setUserName(user.displayName);
        }
      } catch (err) {
        console.error("Erro ao buscar usuário ADM:", err);
      }
    });

    const unsubServicos = onSnapshot(
      doc(db, "configuracoes", "servicos"),
      (docSnap) => {
        if (docSnap.exists() && docSnap.data().lista) {
          setServicos(docSnap.data().lista);
        } else {
          setServicos(defaultServices as Servico[]);
          setDoc(doc(db, "configuracoes", "servicos"), {
            lista: defaultServices,
          });
        }
      }
    );

    // Função assíncrona para buscar o Histórico e escutar os Agendamentos Atuais
    const carregarTodosAgendamentos = async () => {
      try {
        // 1. Busca os registros já arquivados no histórico (subcoleções 'servicos')
        const snapshotHistorico = await getDocs(collectionGroup(db, "servicos"));
        const listaHistorico = snapshotHistorico.docs.map((docSnap) => ({
          ...docSnap.data(),
          id: docSnap.id,
        })) as Agendamento[];

        // 2. Escuta a coleção 'agendamentos' do pátio atual em tempo real
        const unsubscribeSnapshot = onSnapshot(
          collection(db, "agendamentos"),
          (snapshot) => {
            const listaAtuais = snapshot.docs.map((docSnap) => ({
              ...docSnap.data(),
              id: docSnap.id,
            })) as Agendamento[];

            // Junta o histórico estático + os agendamentos do pátio atual
            const todosJuntos = [...listaHistorico, ...listaAtuais];

            // Ordena os agendamentos pela data de criação (mais novos primeiro)
            todosJuntos.sort((a, b) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return dateB - dateA;
            });

            setAgendamentos(todosJuntos);
            setLoading(false);
          }
        );

        return unsubscribeSnapshot;
      } catch (error) {
        console.error("Erro ao carregar dados do histórico:", error);
        setLoading(false);
      }
    };

    let unsubSnapshot: (() => void) | undefined;
    carregarTodosAgendamentos().then((unsub) => {
      unsubSnapshot = unsub;
    });

    return () => {
      unsubscribeAuth();
      unsubServicos();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, [router]);

  const getValorServico = (type?: string) => {
    const servico = servicos.find((s) => s.id === type);
    return servico ? servico.price : 0;
  };

  const getServiceLabel = (type?: string) => {
    const servico = servicos.find((s) => s.id === type);
    return servico ? servico.name : "Serviço Selecionado";
  };

  const handlePriceChange = (id: string, newPrice: number) => {
    setServicos((prev) =>
      prev.map((s) => (s.id === id ? { ...s, price: newPrice } : s))
    );
  };

  const handleSalvarPrecos = async () => {
    setSalvandoServicos(true);
    try {
      await setDoc(doc(db, "configuracoes", "servicos"), { lista: servicos });
      alert("Tabela de serviços e preços atualizada com sucesso!");
      setModalPrecosAberto(false);
    } catch (error) {
      console.error("Erro ao salvar serviços:", error);
      alert("Erro ao salvar novos valores.");
    } finally {
      setSalvandoServicos(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  // Cálculo de faturamento geral (Histórico + Pátio Atual)
  const faturamentoHoje = agendamentos
    .filter((a) => a.status === "concluido")
    .reduce((acc, item) => acc + getValorServico(item.serviceType), 0);

  const faturamentoProjetado = agendamentos
    .filter((a) => a.status !== "cancelado")
    .reduce((acc, item) => acc + getValorServico(item.serviceType), 0);

  const totalAtendimentos = agendamentos.filter(
    (a) => a.status === "concluido"
  ).length;
  
  const emAndamento = agendamentos.filter(
    (a) => a.status === "andamento"
  ).length;

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/login");
    } catch (error) {
      console.error("Erro ao fazer logout:", error);
    }
  };

  const agendamentosFiltrados = agendamentos.filter((a) => {
    if (filtroStatus === "todos") return true;
    return a.status === filtroStatus;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-semibold">
        Carregando dados da administração...
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRole="adm">

        <div className="min-h-screen bg-slate-100 p-4 sm:p-6 lg:p-8">
          <div className="max-w-6xl mx-auto space-y-6">
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200 gap-4">
              <div>
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  Gestão do Negócio
                </span>
                <h1 className="text-xl font-bold text-slate-900">
                  Painel Administrativo
                </h1>
              </div>
    
              <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
                <button
                  onClick={() => setModalPrecosAberto(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-xl text-xs transition border border-blue-200 cursor-pointer"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 6v12m-3-6h6m-7 8h8a2 2 0 002-2V6a2 2 0 00-2-2H7a2 2 0 00-2 2v12a2 2 0 002 2z"
                    />
                  </svg>
                  Gerenciar Preços
                </button>
    
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                    {getInitials(userName)}
                  </div>
                  <span className="text-xs font-bold text-slate-700">
                    {userName}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition cursor-pointer"
                >
                  Sair
                </button>
              </div>
            </header>
    
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-slate-400">
                  Faturamento Total Realizado
                </span>
                <p className="text-2xl font-black text-emerald-600 mt-1">
                  R$ {faturamentoHoje.toFixed(2)}
                </p>
                <span className="text-[10px] text-slate-400">
                  Acumulado de lavagens concluídas
                </span>
              </div>
    
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-slate-400">
                  Faturamento Projetado
                </span>
                <p className="text-2xl font-black text-slate-800 mt-1">
                  R$ {faturamentoProjetado.toFixed(2)}
                </p>
                <span className="text-[10px] text-slate-400">
                  Incluindo pendentes do pátio
                </span>
              </div>
    
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-slate-400">
                  Total de Lavações Concluídas
                </span>
                <p className="text-2xl font-black text-blue-600 mt-1">
                  {totalAtendimentos}{" "}
                  <span className="text-xs font-normal text-slate-500">itens</span>
                </p>
                <span className="text-[10px] text-slate-400">Histórico + Hoje</span>
              </div>
    
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <span className="text-xs font-semibold text-slate-400">
                  Em Andamento Agora
                </span>
                <p className="text-2xl font-black text-amber-500 mt-1">
                  {emAndamento}{" "}
                  <span className="text-xs font-normal text-slate-500">
                    no pátio
                  </span>
                </p>
                <span className="text-[10px] text-slate-400">
                  Lavadores trabalhando
                </span>
              </div>
            </div>
    
            <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Histórico Geral e Agendamentos
                  </h2>
                  <p className="text-xs text-slate-500">
                    Acompanhamento completo de atendimentos
                  </p>
                </div>
    
                <div className="flex gap-2 text-xs font-semibold">
                  {["todos", "pendente", "andamento", "concluido"].map((st) => (
                    <button
                      key={st}
                      onClick={() => setFiltroStatus(st)}
                      className={`px-3 py-1.5 rounded-lg capitalize transition cursor-pointer ${
                        filtroStatus === st
                          ? "bg-slate-900 text-white"
                          : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                      }`}
                    >
                      {st}
                    </button>
                  ))}
                </div>
              </div>
    
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 text-xs text-slate-400 uppercase font-semibold border-b border-slate-100">
                    <tr>
                      <th className="p-4">Data/Horário</th>
                      <th className="p-4">Cliente</th>
                      <th className="p-4">Veículo</th>
                      <th className="p-4">Serviço</th>
                      <th className="p-4">Valor</th>
                      <th className="p-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {agendamentosFiltrados.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50/50 transition">
                        <td className="p-4 font-bold text-slate-900">
                          <div>{item.date || "N/A"}</div>
                          <div className="text-xs text-slate-400 font-normal">
                            {item.time || "Presencial"}
                          </div>
                        </td>
                        <td className="p-4 font-medium text-slate-800">
                          {item.clienteNome || "Cliente"}
                        </td>
                        <td className="p-4">
                          <div className="font-semibold text-slate-800">
                            {item.vehicleModel || "Veículo"}
                          </div>
                          <div className="text-xs text-slate-400 font-mono">
                            {item.licensePlate || "N/A"}
                          </div>
                        </td>
                        <td className="p-4 font-medium">
                          {getServiceLabel(item.serviceType)}
                        </td>
                        <td className="p-4 font-bold text-slate-900">
                          R$ {getValorServico(item.serviceType).toFixed(2)}
                        </td>
                        <td className="p-4">
                          {item.status === "concluido" && (
                            <span className="px-2.5 py-1 text-xs font-bold bg-emerald-50 text-emerald-600 rounded-full border border-emerald-200">
                              Concluído
                            </span>
                          )}
                          {item.status === "andamento" && (
                            <span className="px-2.5 py-1 text-xs font-bold bg-amber-50 text-amber-600 rounded-full border border-amber-200">
                              Em Andamento
                            </span>
                          )}
                          {item.status === "pendente" && (
                            <span className="px-2.5 py-1 text-xs font-bold bg-slate-100 text-slate-600 rounded-full border border-slate-200">
                              Pendente
                            </span>
                          )}
                          {item.status === "cancelado" && (
                            <span className="px-2.5 py-1 text-xs font-bold bg-red-50 text-red-600 rounded-full border border-red-200">
                              Cancelado
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
    
                    {agendamentosFiltrados.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="p-8 text-center text-xs text-slate-500 font-medium"
                        >
                          Nenhum agendamento encontrado para este filtro.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
    
            {/* Modal para Gerenciamento de Preços */}
            {modalPrecosAberto && (
              <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
                <div className="bg-white w-full max-w-2xl rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <div>
                      <h3 className="text-lg font-bold text-slate-900">
                        Tabela de Preços dos Serviços
                      </h3>
                      <p className="text-xs text-slate-500">
                        Ajuste os valores cobrados em cada serviço
                      </p>
                    </div>
                    <button
                      onClick={() => setModalPrecosAberto(false)}
                      className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
                    >
                      ✕
                    </button>
                  </div>
    
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {servicos.map((servico) => (
                      <div
                        key={servico.id}
                        className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1"
                      >
                        <label className="block text-xs font-bold text-slate-700 truncate">
                          {servico.name}
                        </label>
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-slate-400 font-bold">
                            R$
                          </span>
                          <input
                            type="number"
                            min="0"
                            step="5"
                            value={servico.price}
                            onChange={(e) =>
                              handlePriceChange(
                                servico.id,
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full text-sm font-bold p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-blue-500 text-slate-800"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
    
                  <div className="flex gap-2 pt-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setModalPrecosAberto(false)}
                      className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer hover:bg-slate-50"
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      onClick={handleSalvarPrecos}
                      disabled={salvandoServicos}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer disabled:opacity-50"
                    >
                      {salvandoServicos ? "Salvando..." : "Salvar Alterações"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
    </ProtectedRoute>
    );

}