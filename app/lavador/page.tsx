"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  onSnapshot,
  doc,
  getDoc,
  updateDoc,
  addDoc,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import ProtectedRoute from "../components/ProtectedRoute";
import Footer from "../components/Footer";

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
  status:
    | "aguardando_aprovacao"
    | "pendente"
    | "andamento"
    | "concluido"
    | "cancelado";
  obs?: string;
  createdAt?: string;
}

interface Servico {
  id: string;
  name: string;
  price: number;
  category: "veiculo" | "residencial";
}

const HORARIOS_DISPONIVEIS = Array.from({ length: 25 }, (_, i) => {
  const totalMinutos = 7 * 60 + i * 30;
  const horas = Math.floor(totalMinutos / 60)
    .toString()
    .padStart(2, "0");
  const minutos = (totalMinutos % 60).toString().padStart(2, "0");
  return `${horas}:${minutos}`;
});

export default function LavadorHome() {
  const router = useRouter();
  const [filtro, setFiltro] = useState<
    "pendente" | "andamento" | "concluido" | "cancelado"
  >("pendente");
  const [modalManual, setModalManual] = useState(false);
  const [modalConcluir, setModalConcluir] = useState<Agendamento | null>(null);
  const [modalAprovar, setModalAprovar] = useState<Agendamento | null>(null);
  const [dataAgendada, setDataAgendada] = useState("");
  const [horaAgendada, setHoraAgendada] = useState("");
  const [adicionaisSelecionados, setAdicionaisSelecionados] = useState<
    string[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [agendamentos, setAgendamentos] = useState<Agendamento[]>([]);
  const [userName, setUserName] = useState<string>("Lavador");
  const [empresaId, setEmpresaId] = useState<string | null>(null);
  const [empresaNome, setEmpresaNome] = useState<string>("");
  const [servicos, setServicos] = useState<Servico[]>([]);

  const [formManual, setFormManual] = useState({
    clienteNome: "",
    telefone: "",
    vehicleModel: "",
    licensePlate: "",
    serviceType: "",
  });

  const servicoSelecionado = servicos.find(
    (s) => s.id === formManual.serviceType,
  );
  const isVeiculoManual = servicoSelecionado?.category === "veiculo";

  useEffect(() => {
    let unsubServicos: (() => void) | undefined;
    let unsubSnapshot: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/login");
        return;
      }

      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setUserName(userData.name || user.displayName || "Lavador");

          const empId = userData.empresaId;
          setEmpresaId(empId);

          if (empId) {
            const empresaDoc = await getDoc(doc(db, "empresas", empId));
            if (empresaDoc.exists()) {
              setEmpresaNome(empresaDoc.data().nome || "Sua Empresa");
            } else if (userData.empresaNome) {
              setEmpresaNome(userData.empresaNome);
            }

            const servicosRef = doc(
              db,
              "empresas",
              empId,
              "configuracoes",
              "servicos",
            );
            unsubServicos = onSnapshot(servicosRef, (docSnap) => {
              if (docSnap.exists() && Array.isArray(docSnap.data().lista)) {
                setServicos(docSnap.data().lista);
              } else {
                setServicos([]);
              }
            });

            const agendamentosRef = collection(
              db,
              "empresas",
              empId,
              "agendamentos",
            );
            unsubSnapshot = onSnapshot(agendamentosRef, async (snapshot) => {
              const lista = await Promise.all(
                snapshot.docs.map(async (docSnap) => {
                  const data = docSnap.data();
                  let tel = data.telefone;

                  if (!tel && data.clienteId) {
                    try {
                      const uDoc = await getDoc(
                        doc(db, "users", data.clienteId),
                      );
                      if (uDoc.exists() && uDoc.data().telefone) {
                        tel = uDoc.data().telefone;
                      }
                    } catch (e) {
                      console.error("Erro ao buscar telefone do usuário:", e);
                    }
                  }

                  return {
                    ...data,
                    id: docSnap.id,
                    telefone: tel,
                  } as Agendamento;
                }),
              );

              lista.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
              });

              setAgendamentos(lista);
              setLoading(false);
            });
          } else {
            setLoading(false);
          }
        }
      } catch (err) {
        console.error("Erro ao buscar dados do usuário/empresa:", err);
        setLoading(false);
      }
    });

    return () => {
      unsubscribeAuth();
      if (unsubServicos) unsubServicos();
      if (unsubSnapshot) unsubSnapshot();
    };
  }, [router]);


  const handleAprovarAgendamento = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAprovar || !dataAgendada || !horaAgendada || !empresaId) return;

    try {
      const docRef = doc(
        db,
        "empresas",
        empresaId,
        "agendamentos",
        modalAprovar.id,
      );
      await updateDoc(docRef, {
        status: "pendente",
        date: dataAgendada,
        time: horaAgendada,
      });

      setModalAprovar(null);
      setDataAgendada("");
      setHoraAgendada("");
    } catch (error) {
      console.error("Erro ao aprovar agendamento:", error);
      alert("Erro ao aprovar agendamento.");
    }
  };

  const toggleAdicional = (id: string) => {
    setAdicionaisSelecionados((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const alterarStatus = async (
    id: string,
    novoStatus: "andamento" | "concluido" | "cancelado",
    obsExtra?: string,
    valorAdicional?: number,
  ) => {
    if (!empresaId) return;

    try {
      const docRef = doc(db, "empresas", empresaId, "agendamentos", id);
      const updateData: {
        status: string;
        obs?: string;
        valorAdicional?: number;
      } = {
        status: novoStatus,
      };

      if (obsExtra) updateData.obs = obsExtra;
      if (valorAdicional !== undefined)
        updateData.valorAdicional = valorAdicional;

      await updateDoc(docRef, updateData);

      if (novoStatus === "concluido" && modalConcluir?.clienteId) {
        await fetch("/api/notify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            clienteId: modalConcluir.clienteId,
            vehicleModel: modalConcluir.vehicleModel,
            licensePlate: modalConcluir.licensePlate,
          }),
        });
      }

      setModalConcluir(null);
      setAdicionaisSelecionados([]);
    } catch (error) {
      console.error("Erro ao atualizar o status:", error);
      alert("Erro ao atualizar o status.");
    }
  };

  const handleConfirmarConclusao = () => {
    if (!modalConcluir) return;

    const servicosExtrasObj = servicos.filter((s) =>
      adicionaisSelecionados.includes(s.id),
    );

    const valorAdicionalTotal = servicosExtrasObj.reduce(
      (acc, s) => acc + (s.price || 0),
      0,
    );

    const textoAdicionais = servicosExtrasObj
      .map((s) =>
        s.price > 0 ? `${s.name} (+R$ ${s.price.toFixed(2)})` : s.name,
      )
      .join(", ");

    const obsFinal = modalConcluir.obs
      ? `${modalConcluir.obs} | Adicionais: ${textoAdicionais}`
      : textoAdicionais
        ? `Adicionais: ${textoAdicionais}`
        : "";

    alterarStatus(modalConcluir.id, "concluido", obsFinal, valorAdicionalTotal);
  };

  const handleCadastrarManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formManual.serviceType || !empresaId) return;

    try {
      const horaAtual = new Date().toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
      const dataAtual = new Date().toISOString().split("T")[0];

      await addDoc(collection(db, "empresas", empresaId, "agendamentos"), {
        clienteNome: formManual.clienteNome,
        telefone: formManual.telefone,
        vehicleModel: isVeiculoManual
          ? formManual.vehicleModel.toUpperCase()
          : getServiceLabel(formManual.serviceType),
        licensePlate: isVeiculoManual
          ? formManual.licensePlate.toUpperCase()
          : "RESIDENCIAL",
        serviceType: formManual.serviceType,
        date: dataAtual,
        time: horaAtual,
        status: "pendente",
        createdAt: new Date().toISOString(),
      });

      setFormManual({
        clienteNome: "",
        telefone: "",
        vehicleModel: "",
        licensePlate: "",
        serviceType: "",
      });
      setModalManual(false);
    } catch (error) {
      console.error(error);
      alert("Erro ao salvar o agendamento manual.");
    }
  };

  const getServiceLabel = (type: string) => {
    const servico = servicos.find((s) => s.id === type);
    return servico ? servico.name : "Serviço Selecionado";
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  const getWhatsappUrl = (
    telefone: string,
    clienteNome: string,
    veiculo: string,
    status: string,
    data?: string,
    hora?: string,
  ) => {
    const numLimpo = telefone.replace(/\D/g, "");
    const numComDdd = numLimpo.startsWith("55") ? numLimpo : `55${numLimpo}`;

    let mensagem = "";

    if (status === "concluido") {
      mensagem = `Olá ${clienteNome}, tudo bem? Seu serviço (${veiculo}) foi concluído com sucesso! Seu veículo/item está pronto para retirada. ✨🚗`;
    } else {
      const horarioTexto = data && hora ? ` para o dia ${data} às ${hora}` : "";
      mensagem = `Olá ${clienteNome}, tudo bem? Seu agendamento para o serviço (${veiculo}) foi confirmado${horarioTexto}.`;
    }

    const texto = encodeURIComponent(mensagem);
    return `https://wa.me/${numComDdd}?text=${texto}`;
  };

  const agendamentosFiltrados = agendamentos.filter((item) => {
    if (filtro === "pendente") {
      return (
        item.status === "pendente" || item.status === "aguardando_aprovacao"
      );
    }
    return item.status === filtro;
  });

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-semibold">
        Carregando lista do pátio...
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRole="lavador">
      <div className="min-h-screen bg-slate-100 p-4 sm:p-6">
        <div className="max-w-2xl mx-auto space-y-4">
          <header className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
            <div>
              <span className="text-xs font-semibold text-blue-600 uppercase tracking-wider">
                {empresaNome ? `Patio - ${empresaNome}` : "Painel Operacional"}
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

          <div className="flex bg-slate-200 p-1 rounded-xl text-xs font-bold gap-1">
            <button
              onClick={() => setFiltro("pendente")}
              className={`flex-1 py-2 rounded-lg transition cursor-pointer ${
                filtro === "pendente"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600"
              }`}
            >
              Aguardando
            </button>
            <button
              onClick={() => setFiltro("andamento")}
              className={`flex-1 py-2 rounded-lg transition cursor-pointer ${
                filtro === "andamento"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600"
              }`}
            >
              Em Andamento
            </button>
            <button
              onClick={() => setFiltro("concluido")}
              className={`flex-1 py-2 rounded-lg transition cursor-pointer ${
                filtro === "concluido"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600"
              }`}
            >
              Concluídos
            </button>
            <button
              onClick={() => setFiltro("cancelado")}
              className={`flex-1 py-2 rounded-lg transition cursor-pointer ${
                filtro === "cancelado"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-600"
              }`}
            >
              Cancelados
            </button>
          </div>

          <div className="space-y-3">
            {agendamentosFiltrados.map((item) => {
              const isAguardandoAprovacao =
                item.status === "aguardando_aprovacao";

              return (
                <div
                  key={item.id}
                  className={`p-4 rounded-xl shadow-sm border transition ${
                    isAguardandoAprovacao
                      ? "bg-amber-50/90 border-amber-300"
                      : "bg-white border-slate-200"
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div>
                      {isAguardandoAprovacao ? (
                        <span className="text-xs font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded border border-amber-300">
                          ⚠️ Solicitado (Definir Data e Horário)
                        </span>
                      ) : (
                        <span className="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
                          📅 {item.date} às {item.time || "Presencial"}
                        </span>
                      )}

                      <h3 className="text-base font-bold text-slate-900 mt-2">
                        {item.vehicleModel}
                      </h3>
                      <p className="text-xs text-slate-500 font-mono">
                        {item.licensePlate !== "RESIDENCIAL"
                          ? `Placa: ${item.licensePlate} • `
                          : ""}
                        Cliente: {item.clienteNome}
                      </p>
                    </div>

                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                      {getServiceLabel(item.serviceType)}
                    </span>
                  </div>

                  {item.obs && (
                    <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-2 rounded-lg mt-2">
                      <strong>Adicional/Obs:</strong> {item.obs}
                    </div>
                  )}

                  <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-2 mt-3 items-center">
                    {item.telefone ? (
                      <a
                        href={getWhatsappUrl(
                          item.telefone,
                          item.clienteNome,
                          item.vehicleModel,
                          item.status,
                          item.date,
                          item.time,
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

                    {isAguardandoAprovacao ? (
                      <button
                        onClick={() => setModalAprovar(item)}
                        className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                      >
                        Aprovar e Agendar Data/Hora
                      </button>
                    ) : item.status === "pendente" ? (
                      <button
                        onClick={() => alterarStatus(item.id, "andamento")}
                        className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                      >
                        Iniciar Lavação
                      </button>
                    ) : null}

                    {item.status === "andamento" && (
                      <button
                        onClick={() => {
                          setModalConcluir(item);
                          setAdicionaisSelecionados([]);
                        }}
                        className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-lg text-xs transition cursor-pointer"
                      >
                        Finalizar Lavação
                      </button>
                    )}

                    {item.status !== "concluido" &&
                      item.status !== "cancelado" && (
                        <button
                          onClick={() => {
                            if (
                              confirm(
                                "Deseja realmente cancelar este agendamento?",
                              )
                            ) {
                              alterarStatus(item.id, "cancelado");
                            }
                          }}
                          className="py-2 px-3 bg-red-50 hover:bg-red-100 text-red-600 font-bold rounded-lg text-xs transition cursor-pointer border border-red-200"
                        >
                          Cancelar
                        </button>
                      )}
                  </div>
                </div>
              );
            })}

            {agendamentosFiltrados.length === 0 && (
              <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-500 font-medium">
                Nenhum item nesta categoria no momento.
              </div>
            )}
          </div>

          {modalAprovar && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl p-5 space-y-4">
                <h3 className="text-base font-bold text-slate-900">
                  Aprovar Agendamento
                </h3>
                <p className="text-xs text-slate-500">
                  Cliente: <strong>{modalAprovar.clienteNome}</strong> (
                  {modalAprovar.vehicleModel})
                </p>

                <form onSubmit={handleAprovarAgendamento} className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Data da Higienização
                    </label>
                    <input
                      type="date"
                      required
                      value={dataAgendada}
                      onChange={(e) => setDataAgendada(e.target.value)}
                      className="w-full text-sm p-2.5 rounded-lg border border-slate-300 text-slate-800"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Horário
                    </label>
                    <select
                      required
                      value={horaAgendada}
                      onChange={(e) => setHoraAgendada(e.target.value)}
                      className="w-full text-sm p-2.5 rounded-lg border border-slate-300 text-slate-800 bg-white font-medium"
                    >
                      <option value="">-- Selecione o horário --</option>
                      {HORARIOS_DISPONIVEIS.map((hora) => (
                        <option key={hora} value={hora}>
                          {hora}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setModalAprovar(null)}
                      className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={!dataAgendada || !horaAgendada}
                      className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg text-xs cursor-pointer disabled:opacity-50"
                    >
                      Aprovar e Salvar
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {modalConcluir && (
            <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
              <div className="bg-white w-full max-w-md rounded-2xl p-5 space-y-4">
                <h3 className="text-base font-bold text-slate-900">
                  Concluir Lavação
                </h3>
                <p className="text-xs text-slate-500">
                  Item:{" "}
                  <strong>
                    {modalConcluir.vehicleModel}{" "}
                    {modalConcluir.licensePlate !== "RESIDENCIAL" &&
                      `(${modalConcluir.licensePlate})`}
                  </strong>
                </p>

                <div className="space-y-2">
                  <label className="block text-xs font-semibold text-slate-700">
                    Selecione Serviços / Pacotes Adicionais Realizados:
                  </label>
                  <div className="max-h-48 overflow-y-auto space-y-1.5 p-1 border border-slate-200 rounded-lg">
                    {servicos
                      .filter((s) => s.id !== modalConcluir.serviceType)
                      .map((servico) => {
                        const isChecked = adicionaisSelecionados.includes(
                          servico.id,
                        );
                        return (
                          <div
                            key={servico.id}
                            onClick={() => toggleAdicional(servico.id)}
                            className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition border ${
                              isChecked
                                ? "bg-blue-50 border-blue-300 font-semibold text-blue-900"
                                : "bg-slate-50 border-slate-100 text-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => {}}
                                className="rounded text-blue-600 focus:ring-0 cursor-pointer"
                              />
                              <span>{servico.name}</span>
                            </div>
                            <span className="font-bold text-slate-600">
                              {servico.price > 0
                                ? `+ R$ ${servico.price.toFixed(2)}`
                                : "Sob Orçamento"}
                            </span>
                          </div>
                        );
                      })}

                    {servicos.filter(
                      (s) => s.id !== modalConcluir.serviceType,
                    ).length === 0 && (
                      <p className="text-center text-slate-400 text-xs py-3">
                        Nenhum outro serviço cadastrado para esta empresa.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setModalConcluir(null);
                      setAdicionaisSelecionados([]);
                    }}
                    className="flex-1 py-2.5 border border-slate-300 text-slate-700 font-semibold rounded-lg text-xs cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleConfirmarConclusao}
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
                        {s.name}{" "}
                        {s.price > 0
                          ? `- R$ ${s.price.toFixed(2)}`
                          : "- Sob Orçamento"}
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
        <Footer/>
      </div>
    </ProtectedRoute>
  );
}