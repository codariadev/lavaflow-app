"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where,
} from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import ProtectedRoute from "../components/ProtectedRoute";
import Footer from "../components/Footer";

interface Usuario {
  id: string;
  name?: string;
  email?: string;
  role?: string;
  telefone?: string;
  empresaId?: string;
}

interface Empresa {
  id: string;
  nome?: string;
  endereco?: string;
  telefone?: string;
}

const MASTER_UID = process.env.NEXT_PUBLIC_MASTER_UID;

export default function MasterDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [empresas, setEmpresas] = useState<Empresa[]>([]);
  const [abaAtiva, setAbaAtiva] = useState<"empresas" | "usuarios">("empresas");

  // Estados para edição de empresa
  const [empresaEditandoId, setEmpresaEditandoId] = useState<string | null>(
    null,
  );
  const [nomeEditado, setNomeEditado] = useState("");
  const [telefoneEditado, setTelefoneEditado] = useState("");
  const [enderecoEditado, setEnderecoEditado] = useState("");

  const carregarDadosMaster = async () => {
    try {
      const empresasSnap = await getDocs(collection(db, "empresas"));
      const listaEmpresas = empresasSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Empresa[];
      setEmpresas(listaEmpresas);

      const usersSnap = await getDocs(collection(db, "users"));
      const listaUsers = usersSnap.docs.map((d) => ({
        id: d.id,
        ...d.data(),
      })) as Usuario[];
      setUsuarios(listaUsers);
    } catch (error) {
      console.error("Erro ao carregar dados do painel master:", error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser || currentUser.uid !== MASTER_UID) {
        alert("Acesso negado. Apenas o Master pode entrar aqui.");
        router.push("/login");
        return;
      }
      await carregarDadosMaster();
      setLoading(false);
    });

    return () => unsubscribe();
  }, [router]);

  const alterarRoleUsuario = async (
    userId: string,
    novaRole: string,
    empresaIdAtual?: string,
  ) => {
    try {
      const userRef = doc(db, "users", userId);
      const updateData: { role: string; empresaId?: string } = {
        role: novaRole,
      };
      if (empresaIdAtual) {
        updateData.empresaId = empresaIdAtual;
      }

      await updateDoc(userRef, updateData);

      setUsuarios((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: novaRole } : u)),
      );
      alert("Cargo do usuário atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar cargo:", error);
      alert("Erro ao atualizar cargo.");
    }
  };

  const salvarEdicaoEmpresa = async (empresaId: string) => {
    try {
      const empresaRef = doc(db, "empresas", empresaId);
      await updateDoc(empresaRef, {
        nome: nomeEditado,
        telefone: telefoneEditado,
        endereco: enderecoEditado,
      });

      setEmpresas((prev) =>
        prev.map((e) =>
          e.id === empresaId
            ? {
                ...e,
                nome: nomeEditado,
                telefone: telefoneEditado,
                endereco: enderecoEditado,
              }
            : e,
        ),
      );

      const q = query(
        collection(db, "users"),
        where("empresaId", "==", empresaId),
      );
      const querySnapshot = await getDocs(q);

      const updates = querySnapshot.docs.map(async (userDoc) => {
        const userRef = doc(db, "users", userDoc.id);
        await updateDoc(userRef, {
            empresaNome: nomeEditado,
            empresaEndereco: enderecoEditado,
        });
      });
      await Promise.all(updates);

      setEmpresaEditandoId(null);
      alert("Empresa atualizada com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar empresa:", error);
      alert("Erro ao atualizar empresa.");
    }
  };

  const deletarEmpresaMaster = async (empresaId: string) => {
    if (!confirm("Tem certeza que deseja excluir esta empresa do sistema?"))
      return;
    try {
      await deleteDoc(doc(db, "empresas", empresaId));
      setEmpresas((prev) => prev.filter((e) => e.id !== empresaId));
      alert("Empresa excluída com sucesso.");
    } catch (error) {
      console.error("Erro ao excluir empresa:", error);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white text-sm font-semibold">
        Carregando Painel Master...
      </div>
    );
  }

  const devs: Usuario[] = [];
  const usuariosPorEmpresa: { [key: string]: Usuario[] } = {};
  const semEmpresa: Usuario[] = [];

  usuarios.forEach((u) => {
    if (u.role === "dev") {
      devs.push(u);
    } else if (u.empresaId) {
      if (!usuariosPorEmpresa[u.empresaId]) {
        usuariosPorEmpresa[u.empresaId] = [];
      }
      usuariosPorEmpresa[u.empresaId].push(u);
    } else {
      semEmpresa.push(u);
    }
  });

  return (
    <ProtectedRoute allowedRole="dev">
      <div className="min-h-screen bg-slate-950 text-slate-100 p-6 lg:p-10">
        <div className="max-w-6xl mx-auto space-y-6">
          <header className="flex justify-between items-center bg-slate-900 p-6 rounded-2xl border border-slate-800 shadow-xl">
            <div>
              <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-xs px-3 py-1 rounded-full font-bold">
                🛠️ Modo Master / Programação
              </span>
              <h1 className="text-2xl font-black mt-2 text-white">
                Painel de Controle Global
              </h1>
              <p className="text-xs text-slate-400">
                Controle total de empresas, permissões e base de dados.
              </p>
            </div>
          </header>

          <div className="flex gap-3 border-b border-slate-800 pb-3">
            <button
              onClick={() => setAbaAtiva("empresas")}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                abaAtiva === "empresas"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800"
              }`}
            >
              Empresas Cadastradas ({empresas.length})
            </button>
            <button
              onClick={() => setAbaAtiva("usuarios")}
              className={`px-5 py-2.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                abaAtiva === "usuarios"
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                  : "bg-slate-900 text-slate-400 hover:bg-slate-800"
              }`}
            >
              Usuários e Desenvolvedores ({usuarios.length})
            </button>
          </div>

          {abaAtiva === "empresas" && (
            <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
              <div className="p-5 border-b border-slate-800">
                <h2 className="font-bold text-sm">
                  Empresas / Lava-Jatos no Sistema
                </h2>
              </div>
              <div className="divide-y divide-slate-800">
                {empresas.map((emp) => {
                  const estaEditando = empresaEditandoId === emp.id;
                  return (
                    <div
                      key={emp.id}
                      className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:bg-slate-800/50 transition"
                    >
                      {estaEditando ? (
                        <div className="flex-1 flex flex-col gap-3 w-full">
                          <div className="flex flex-col sm:flex-row gap-3 w-full">
                            <input
                              type="text"
                              value={nomeEditado}
                              onChange={(e) => setNomeEditado(e.target.value)}
                              placeholder="Nome da Empresa"
                              className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-blue-500 flex-1"
                            />
                            <input
                              type="text"
                              value={telefoneEditado}
                              onChange={(e) =>
                                setTelefoneEditado(e.target.value)
                              }
                              placeholder="Telefone"
                              className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-blue-500 w-full sm:w-48"
                            />
                          </div>
                          <input
                            type="text"
                            value={enderecoEditado}
                            onChange={(e) => setEnderecoEditado(e.target.value)}
                            placeholder="Endereço (Rua, Número, Bairro)"
                            className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-3 py-2 text-white font-medium focus:outline-none focus:border-blue-500 w-full"
                          />
                        </div>
                      ) : (
                        <div>
                          <h3 className="font-bold text-sm text-white">
                            {emp.nome}
                          </h3>
                          <p className="text-xs text-slate-400">
                            Tel: {emp.telefone || "Não informado"} • Endereço:{" "}
                            {emp.endereco || "Não informado"} • ID: {emp.id}
                          </p>
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {estaEditando ? (
                          <>
                            <button
                              onClick={() => salvarEdicaoEmpresa(emp.id)}
                              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition cursor-pointer"
                            >
                              Salvar
                            </button>
                            <button
                              onClick={() => setEmpresaEditandoId(null)}
                              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-lg transition cursor-pointer"
                            >
                              Cancelar
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => {
                                setEmpresaEditandoId(emp.id);
                                setNomeEditado(emp.nome || "");
                                setTelefoneEditado(emp.telefone || "");
                                setEnderecoEditado(emp.endereco || "");
                              }}
                              className="px-3 py-1.5 bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 text-xs font-semibold rounded-lg transition cursor-pointer"
                            >
                              Editar
                            </button>
                            <button
                              onClick={() => deletarEmpresaMaster(emp.id)}
                              className="px-3 py-1.5 bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 text-xs font-semibold rounded-lg transition cursor-pointer"
                            >
                              Excluir Empresa
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
                {empresas.length === 0 && (
                  <p className="p-6 text-center text-xs text-slate-500">
                    Nenhuma empresa encontrada.
                  </p>
                )}
              </div>
            </div>
          )}

          {abaAtiva === "usuarios" && (
            <div className="space-y-6">
              {devs.length > 0 && (
                <div className="bg-slate-900 rounded-2xl border border-red-500/30 overflow-hidden shadow-xl">
                  <div className="p-4 bg-red-500/10 border-b border-red-500/20 flex justify-between items-center">
                    <h2 className="font-bold text-sm text-red-400">
                      ⚡ Desenvolvedores (Master / Dev)
                    </h2>
                    <span className="text-xs bg-red-500/20 text-red-300 px-2.5 py-1 rounded-full font-semibold border border-red-500/30">
                      {devs.length} desenvolvedor(es)
                    </span>
                  </div>

                  <div className="divide-y divide-slate-800">
                    {devs.map((u) => (
                      <div
                        key={u.id}
                        className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-slate-800/30 transition"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-white">
                              {u.name || "Sem Nome"}
                            </h3>
                            <span className="text-[10px] uppercase font-bold bg-red-500/20 text-red-400 border border-red-500/30 px-2 py-0.5 rounded">
                              {u.role}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {u.email} • Tel: {u.telefone || "Não informado"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400">
                            Revogar acesso:
                          </span>
                          <button
                            onClick={() => setAbaAtiva("usuarios")}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer bg-red-600 text-white shadow-lg shadow-red-600/30"
                          >
                            X
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {empresas.map((emp) => {
                const membrosEmpresa = usuariosPorEmpresa[emp.id] || [];
                return (
                  <div
                    key={emp.id}
                    className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl"
                  >
                    <div className="p-4 bg-slate-800/60 border-b border-slate-800 flex justify-between items-center">
                      <h2 className="font-bold text-sm text-blue-400">
                        🏢 {emp.nome}
                      </h2>
                      <span className="text-xs bg-slate-800 px-2.5 py-1 rounded-full text-slate-300 font-semibold">
                        {membrosEmpresa.length} usuário(s) vinculado(s)
                      </span>
                    </div>

                    <div className="divide-y divide-slate-800">
                      {membrosEmpresa.map((u) => (
                        <div
                          key={u.id}
                          className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-slate-800/30 transition"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="font-bold text-sm text-white">
                                {u.name || "Sem Nome"}
                              </h3>
                              <span className="text-[10px] uppercase font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                                {u.role || "cliente"}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {u.email} • Tel: {u.telefone || "Não informado"}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-slate-400">
                              Alterar Cargo:
                            </span>
                            <select
                              value={u.role || "cliente"}
                              onChange={(e) =>
                                alterarRoleUsuario(
                                  u.id,
                                  e.target.value,
                                  u.empresaId,
                                )
                              }
                              className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-3 py-1.5 text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                            >
                              <option value="cliente">Cliente</option>
                              <option value="lavador">
                                Funcionário / Lavador
                              </option>
                              <option value="adm">Administrador (Adm)</option>
                              <option value="dev">Desenvolvedor (Dev)</option>
                              <option value="master">Master (Total)</option>
                            </select>
                          </div>
                        </div>
                      ))}
                      {membrosEmpresa.length === 0 && (
                        <p className="p-4 text-xs text-slate-500 italic">
                          Nenhum usuário vinculado a esta empresa.
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}

              {semEmpresa.length > 0 && (
                <div className="bg-slate-900 rounded-2xl border border-slate-800 overflow-hidden shadow-xl">
                  <div className="p-4 bg-slate-800/60 border-b border-slate-800 flex justify-between items-center">
                    <h2 className="font-bold text-sm text-amber-400">
                      👤 Geral / Clientes
                    </h2>
                    <span className="text-xs bg-slate-800 px-2.5 py-1 rounded-full text-slate-300 font-semibold">
                      {semEmpresa.length} usuário(s)
                    </span>
                  </div>

                  <div className="divide-y divide-slate-800">
                    {semEmpresa.map((u) => (
                      <div
                        key={u.id}
                        className="p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:bg-slate-800/30 transition"
                      >
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm text-white">
                              {u.name || "Sem Nome"}
                            </h3>
                            <span className="text-[10px] uppercase font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded">
                              {u.role || "cliente"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {u.email} • Tel: {u.telefone || "Não informado"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-slate-400">
                            Alterar Cargo:
                          </span>
                          <select
                            value={u.role || "cliente"}
                            onChange={(e) =>
                              alterarRoleUsuario(
                                u.id,
                                e.target.value,
                                u.empresaId,
                              )
                            }
                            className="bg-slate-950 border border-slate-700 text-xs rounded-lg px-3 py-1.5 text-white font-medium focus:outline-none focus:border-blue-500 cursor-pointer"
                          >
                            <option value="cliente">Cliente</option>
                            <option value="lavador">
                              Funcionário / Lavador
                            </option>
                            <option value="adm">Administrador (Adm)</option>
                            <option value="dev">Desenvolvedor (Dev)</option>
                            <option value="master">Master (Total)</option>
                          </select>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        <Footer/>
        </div>
      </div>
    </ProtectedRoute>
  );
}