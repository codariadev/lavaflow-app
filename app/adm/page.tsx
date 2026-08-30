"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { signOut, onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
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
  valorAdicional?: number;
  obs?: string;
}

interface Servico {
  id: string;
  name: string;
  price: number;
  category: "veiculo" | "residencial";
}

interface Funcionario {
  id: string;
  name: string;
  email: string;
  telefone?: string;
  role: string;
}

export default function AdmDashboard() {
  const router = useRouter();
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [empresaNome, setEmpresaNome] = useState<string>("");
  const [empresaEndereco, setEmpresaEndereco] = useState<string>("");
  const [filtroStatus, setFiltroStatus] = useState<string>("todos");
  const [loading, setLoading] = useState(true);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [funcionarios, setFuncionarios] = useState<Funcionario[]>([]);
  const [userName, setUserName] = useState<string>("Administrador");

  const [precisaCadastrarEmpresa, setPrecisaCadastrarEmpresa] = useState(false);
  const [salvandoEmpresa, setSalvandoEmpresa] = useState(false);
  const [formEmpresa, setFormEmpresa] = useState({
    nome: "",
    endereco: "",
  });

  const [salvandoServicos, setSalvandoServicos] = useState(false);
  const [modalPrecosAberto, setModalPrecosAberto] = useState(false);
  const [modalFuncionariosAberto, setModalFuncionariosAberto] = useState(false);
  const [modalNovoFuncionario, setModalNovoFuncionario] = useState(false);
  const [cadastrandoFunc, setCadastrandoFunc] = useState(false);

  const [novoServicoNome, setNovoServicoNome] = useState("");
  const [novoServicoPreco, setNovoServicoPreco] = useState("");

  const [formFuncionario, setFormFuncionario] = useState({
    name: "",
    email: "",
    password: "",
    telefone: "",
  });

  useEffect(() => {
    let unsubServicos: (() => void) | undefined;
    let unsubAgendamentos: (() => void) | undefined;
    let unsubFuncionarios: (() => void) | undefined;

    const unsubAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserName(userData.name || user.displayName || "Administrador");

          const empId = userData.empresaId || user.uid;
          setEmpresaId(empId);

          if (!userData.empresaNome || !userData.empresaEndereco) {
            setPrecisaCadastrarEmpresa(true);
            setLoading(false);
            return;
          }

          setEmpresaNome(userData.empresaNome);
          setEmpresaEndereco(userData.empresaEndereco);
          setPrecisaCadastrarEmpresa(false);

          const servicosRef = doc(
            db,
            "empresas",
            empId,
            "configuracoes",
            "servicos"
          );
          unsubServicos = onSnapshot(servicosRef, (docSnap) => {
            if (docSnap.exists() && Array.isArray(docSnap.data().lista)) {
              setServicos(docSnap.data().lista);
            } else {
              setServicos([]);
              setDoc(servicosRef, { lista: [] });
            }
          });

          const agendamentosRef = collection(
            db,
            "empresas",
            empId,
            "agendamentos"
          );
          unsubAgendamentos = onSnapshot(agendamentosRef, (snapshot) => {
            const listaAtuais = snapshot.docs.map((docSnap) => ({
              ...docSnap.data(),
              id: docSnap.id,
            })) as Agendamento[];

            listaAtuais.sort((a, b) => {
              const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
              const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
              return dateB - dateA;
            });

            setAgendamentos(listaAtuais);
            setLoading(false);
          });

          const usersRef = collection(db, "empresas", empId, "users");
          const qFunc = query(usersRef, where("role", "==", "lavador"));
          unsubFuncionarios = onSnapshot(qFunc, (snapshot) => {
            const listaFunc = snapshot.docs.map((docSnap) => ({
              ...docSnap.data(),
              id: docSnap.id,
            })) as Funcionario[];
            setFuncionarios(listaFunc);
          });
        }
      } catch (err: unknown) {
        console.error("Erro ao buscar dados da empresa/ADM:", err);
        setLoading(false);
      }
    });

    return () => {
      unsubAuth();
      if (unsubServicos) unsubServicos();
      if (unsubAgendamentos) unsubAgendamentos();
      if (unsubFuncionarios) unsubFuncionarios();
    };
  }, [router]);

  const handleSalvarDadosEmpresa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser || !empresaId) return;

    if (!formEmpresa.nome.trim() || !formEmpresa.endereco.trim()) {
      alert("Por favor, preencha todos os campos da empresa.");
      return;
    }

    setSalvandoEmpresa(true);
    try {
      const userRef = doc(db, "users", auth.currentUser.uid);
      await updateDoc(userRef, {
        empresaId,
        empresaNome: formEmpresa.nome,
        empresaEndereco: formEmpresa.endereco,
      });

      const empresaRef = doc(db, "empresas", empresaId);
      await setDoc(
        empresaRef,
        {
          nome: formEmpresa.nome,
          endereco: formEmpresa.endereco,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );

      await setDoc(
        doc(db, "empresas", empresaId, "configuracoes", "servicos"),
        { lista: [] },
        { merge: true }
      );

      setEmpresaNome(formEmpresa.nome);
      setEmpresaEndereco(formEmpresa.endereco);
      setPrecisaCadastrarEmpresa(false);

      window.location.reload();
    } catch (error: unknown) {
      console.error("Erro ao salvar cadastro da empresa:", error);
      alert("Erro ao salvar dados da empresa. Tente novamente.");
    } finally {
      setSalvandoEmpresa(false);
    }
  };

  const getValorTotalAgendamento = (item: Agendamento) => {
    const precoBase = getValorServico(item.serviceType);
    const extra = item.valorAdicional || 0;
    return precoBase + extra;
  };

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

  const handleAdicionarServico = (e: React.FormEvent) => {
    e.preventDefault();
    if (!novoServicoNome.trim() || !novoServicoPreco) return;

    const novo: Servico = {
      id: `serv_${Date.now()}`,
      name: novoServicoNome.trim(),
      price: parseFloat(novoServicoPreco) || 0,
      category: "veiculo",
    };

    setServicos((prev) => [...prev, novo]);
    setNovoServicoNome("");
    setNovoServicoPreco("");
  };

  const handleRemoverServico = (id: string) => {
    setServicos((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSalvarPrecos = async () => {
    if (!empresaId) return;
    setSalvandoServicos(true);
    try {
      await setDoc(
        doc(db, "empresas", empresaId, "configuracoes", "servicos"),
        {
          lista: servicos,
        }
      );
      alert("Serviços atualizados com sucesso!");
      setModalPrecosAberto(false);
    } catch (error: unknown) {
      console.error("Erro ao salvar serviços:", error);
      alert("Erro ao salvar novos valores.");
    } finally {
      setSalvandoServicos(false);
    }
  };

  const handleCadastrarFuncionario = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empresaId) return;

    setCadastrandoFunc(true);
    try {
      const res = await fetch("/api/register-funcionario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formFuncionario,
          empresaId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Erro ao cadastrar funcionário.");
      }

      alert("Funcionário cadastrado com sucesso!");
      setFormFuncionario({ name: "", email: "", password: "", telefone: "" });
      setModalNovoFuncionario(false);
    } catch (error: unknown) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "Erro ao cadastrar funcionário.";
      alert(message);
    } finally {
      setCadastrandoFunc(false);
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

  const faturamentoHoje = agendamentos
    .filter((a) => a.status === "concluido")
    .reduce((acc, item) => acc + getValorTotalAgendamento(item), 0);

  const faturamentoProjetado = agendamentos
    .filter((a) => a.status !== "cancelado")
    .reduce((acc, item) => acc + getValorTotalAgendamento(item), 0);

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
    } catch (error: unknown) {
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
        {precisaCadastrarEmpresa && (
          <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-100 flex items-center justify-center p-4">
            <div className="bg-white w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4 border border-slate-100">
              <div className="border-b border-slate-100 pb-3">
                <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                  Configuração Obrigatória
                </span>
                <h2 className="text-xl font-bold text-slate-900">
                  Cadastre sua Empresa
                </h2>
                <p className="text-xs text-slate-500 mt-1">
                  Para começar a usar o painel, informe o nome e o endereço do
                  seu estabelecimento.
                </p>
              </div>

              <form onSubmit={handleSalvarDadosEmpresa} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nome da Empresa / Lava-jato *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Lava-Jato Express"
                    value={formEmpresa.nome}
                    onChange={(e) =>
                      setFormEmpresa({ ...formEmpresa, nome: e.target.value })
                    }
                    className="w-full text-sm p-3 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Endereço Completo *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ex: Av. Principal, 1000 - Centro, Cidade - UF"
                    value={formEmpresa.endereco}
                    onChange={(e) =>
                      setFormEmpresa({
                        ...formEmpresa,
                        endereco: e.target.value,
                      })
                    }
                    className="w-full text-sm p-3 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                <div className="pt-2 flex gap-3">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-1/3 py-3 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs hover:bg-slate-50 cursor-pointer"
                  >
                    Sair
                  </button>
                  <button
                    type="submit"
                    disabled={salvandoEmpresa}
                    className="w-2/3 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs transition shadow-md cursor-pointer disabled:opacity-50"
                  >
                    {salvandoEmpresa ? "Salvando..." : "Concluir Cadastro"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <div className="max-w-6xl mx-auto space-y-6">
          <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-white p-5 rounded-2xl shadow-sm border border-slate-200 gap-4">
            <div>
              <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
                Gestão - {empresaNome}
              </span>
              <h1 className="text-xl font-bold text-slate-900">
                Painel Administrativo
              </h1>
              {empresaEndereco && (
                <p className="text-xs text-slate-400 mt-0.5">
                  {empresaEndereco}
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
              <button
                onClick={() => setModalFuncionariosAberto(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold rounded-xl text-xs transition border border-slate-200 cursor-pointer"
              >
                Funcionários ({funcionarios.length})
              </button>

              <button
                onClick={() => setModalPrecosAberto(true)}
                className="flex items-center gap-2 px-3.5 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 font-bold rounded-xl text-xs transition border border-blue-200 cursor-pointer"
              >
                Gerenciar Serviços e Preços
              </button>

              <div className="flex items-center gap-2 ml-2">
                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs">
                  {getInitials(userName)}
                </div>
                <span className="text-xs font-bold text-slate-700 hidden lg:inline">
                  {userName}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-red-600 bg-red-50 hover:bg-red-100 rounded-xl transition cursor-pointer"
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
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-400">
                Faturamento Projetado
              </span>
              <p className="text-2xl font-black text-slate-800 mt-1">
                R$ {faturamentoProjetado.toFixed(2)}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-400">
                Lavações Concluídas
              </span>
              <p className="text-2xl font-black text-blue-600 mt-1">
                {totalAtendimentos}
              </p>
            </div>

            <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
              <span className="text-xs font-semibold text-slate-400">
                Em Andamento Agora
              </span>
              <p className="text-2xl font-black text-amber-500 mt-1">
                {emAndamento}
              </p>
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
                    <tr
                      key={item.id}
                      className="hover:bg-slate-50/50 transition"
                    >
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
                        <div>{getServiceLabel(item.serviceType)}</div>
                        {item.obs && (
                          <div className="text-xs text-blue-600 font-semibold mt-0.5">
                            + {item.obs}
                          </div>
                        )}
                      </td>
                      <td className="p-4 font-bold text-slate-900">
                        R$ {getValorTotalAgendamento(item).toFixed(2)}
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

          {modalFuncionariosAberto && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-xl rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Funcionários (Lavadores)
                    </h3>
                    <p className="text-xs text-slate-500">
                      Compartilhe o link de cadastro com a sua equipe
                    </p>
                  </div>
                  <button
                    onClick={() => setModalFuncionariosAberto(false)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl space-y-2">
                  <label className="block text-xs font-bold text-blue-900">
                    Link de Convite para Funcionários:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      readOnly
                      value={
                        typeof window !== "undefined"
                          ? `${window.location.origin}/cadastro/${empresaId}`
                          : ""
                      }
                      className="w-full text-xs p-2.5 rounded-lg border border-blue-200 bg-white text-slate-700 font-mono"
                    />
                    <button
                      onClick={() => {
                        if (typeof window !== "undefined" && empresaId) {
                          const link = `${window.location.origin}/cadastro/${empresaId}`;
                          navigator.clipboard.writeText(link);
                          alert("Link de cadastro copiado com sucesso!");
                        }
                      }}
                      className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs transition cursor-pointer shrink-0"
                    >
                      Copiar Link
                    </button>
                  </div>
                </div>

                <div className="space-y-2 pt-2">
                  <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                    Equipe Cadastrada
                  </h4>

                  {funcionarios.map((func) => (
                    <div
                      key={func.id}
                      className="p-3.5 rounded-xl border border-slate-200 bg-slate-50 flex justify-between items-center"
                    >
                      <div>
                        <h4 className="text-sm font-bold text-slate-800">
                          {func.name}
                        </h4>
                        <p className="text-xs text-slate-500">{func.email}</p>
                        {func.telefone && (
                          <p className="text-xs text-slate-400 font-mono">
                            {func.telefone}
                          </p>
                        )}
                      </div>
                      <span className="px-2.5 py-1 bg-blue-100 text-blue-700 font-bold text-[10px] rounded-full uppercase">
                        Lavador
                      </span>
                    </div>
                  ))}

                  {funcionarios.length === 0 && (
                    <p className="text-center py-6 text-xs text-slate-500">
                      Nenhum funcionário cadastrado até o momento.
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {modalNovoFuncionario && (
            <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl p-6 space-y-4">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <h3 className="text-base font-bold text-slate-900">
                    Cadastrar Novo Funcionário
                  </h3>
                  <button
                    onClick={() => setModalNovoFuncionario(false)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <form
                  onSubmit={handleCadastrarFuncionario}
                  className="space-y-3"
                >
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Nome Completo
                    </label>
                    <input
                      type="text"
                      required
                      value={formFuncionario.name}
                      onChange={(e) =>
                        setFormFuncionario({
                          ...formFuncionario,
                          name: e.target.value,
                        })
                      }
                      className="w-full text-sm p-2.5 rounded-lg border border-slate-300 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      E-mail de Acesso
                    </label>
                    <input
                      type="email"
                      required
                      value={formFuncionario.email}
                      onChange={(e) =>
                        setFormFuncionario({
                          ...formFuncionario,
                          email: e.target.value,
                        })
                      }
                      className="w-full text-sm p-2.5 rounded-lg border border-slate-300 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Senha de Acesso
                    </label>
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={formFuncionario.password}
                      onChange={(e) =>
                        setFormFuncionario({
                          ...formFuncionario,
                          password: e.target.value,
                        })
                      }
                      className="w-full text-sm p-2.5 rounded-lg border border-slate-300 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Telefone / WhatsApp (Opcional)
                    </label>
                    <input
                      type="tel"
                      value={formFuncionario.telefone}
                      onChange={(e) =>
                        setFormFuncionario({
                          ...formFuncionario,
                          telefone: e.target.value,
                        })
                      }
                      className="w-full text-sm p-2.5 rounded-lg border border-slate-300 text-slate-800"
                    />
                  </div>

                  <div className="flex gap-2 pt-3">
                    <button
                      type="button"
                      onClick={() => setModalNovoFuncionario(false)}
                      className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-xl text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={cadastrandoFunc}
                      className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs cursor-pointer disabled:opacity-50"
                    >
                      {cadastrandoFunc ? "Cadastrando..." : "Cadastrar"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {modalPrecosAberto && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-2xl rounded-2xl p-6 space-y-4 max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      Serviços e Preços
                    </h3>
                    <p className="text-xs text-slate-500">
                      Cadastre os serviços oferecidos e seus respectivos valores
                    </p>
                  </div>
                  <button
                    onClick={() => setModalPrecosAberto(false)}
                    className="text-slate-400 hover:text-slate-600 font-bold text-lg cursor-pointer"
                  >
                    ✕
                  </button>
                </div>

                <form
                  onSubmit={handleAdicionarServico}
                  className="p-3 bg-blue-50/60 border border-blue-100 rounded-xl space-y-2"
                >
                  <span className="block text-xs font-bold text-blue-900">
                    Adicionar Novo Serviço
                  </span>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      placeholder="Nome do Serviço (Ex: Lavagem Simples)"
                      value={novoServicoNome}
                      onChange={(e) => setNovoServicoNome(e.target.value)}
                      className="flex-1 text-xs p-2.5 rounded-lg border border-slate-200 bg-white text-slate-800"
                    />
                    <div className="flex items-center gap-1 w-full sm:w-32">
                      <span className="text-xs font-bold text-slate-400">
                        R$
                      </span>
                      <input
                        type="number"
                        placeholder="0.00"
                        min="0"
                        step="5"
                        value={novoServicoPreco}
                        onChange={(e) => setNovoServicoPreco(e.target.value)}
                        className="w-full text-xs font-bold p-2.5 rounded-lg border border-slate-200 bg-white text-slate-800"
                      />
                    </div>
                    <button
                      type="submit"
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg text-xs cursor-pointer transition shrink-0"
                    >
                      + Adicionar
                    </button>
                  </div>
                </form>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  {servicos.map((servico) => (
                    <div
                      key={servico.id}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50/50 space-y-1 relative group"
                    >
                      <div className="flex justify-between items-center">
                        <label className="block text-xs font-bold text-slate-700 truncate pr-4">
                          {servico.name}
                        </label>
                        <button
                          type="button"
                          onClick={() => handleRemoverServico(servico.id)}
                          className="text-red-500 hover:text-red-700 text-xs font-bold cursor-pointer"
                          title="Remover Serviço"
                        >
                          ✕
                        </button>
                      </div>

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
                              parseFloat(e.target.value) || 0,
                            )
                          }
                          className="w-full text-sm font-bold p-2 rounded-lg border border-slate-200 bg-white focus:outline-none focus:border-blue-500 text-slate-800"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {servicos.length === 0 && (
                  <div className="text-center py-6 text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl">
                    Nenhum serviço cadastrado. Adicione o primeiro serviço no
                    campo acima.
                  </div>
                )}

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