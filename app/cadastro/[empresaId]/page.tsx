"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc } from "firebase/firestore";
import { signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import { auth, db } from "../../lib/firebase";

export default function CadastroFuncionarioPage() {
  const params = useParams();
  const router = useRouter();
  const empresaId = params?.empresaId as string;

  const [empresaNome, setEmpresaNome] = useState<string>("");
  const [loadingEmpresa, setLoadingEmpresa] = useState<boolean>(true);
  const [cadastrando, setCadastrando] = useState<boolean>(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
    telefone: "",
  });

  useEffect(() => {
    async function carregarEmpresa() {
      if (!empresaId) return;
      try {
        const empresaDoc = await getDoc(doc(db, "empresas", empresaId));
        if (empresaDoc.exists()) {
          setEmpresaNome(empresaDoc.data().nome || "Nossa Empresa");
        } else {
          setEmpresaNome("Empresa");
        }
      } catch (err) {
        console.error("Erro ao buscar dados da empresa:", err);
      } finally {
        setLoadingEmpresa(false);
      }
    }
    carregarEmpresa();
  }, [empresaId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setCadastrando(true);

    try {
      const res = await fetch("/api/register-funcionario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          empresaId,
        }),
      });

      const textData = await res.text();
      let data;

      try {
        data = textData ? JSON.parse(textData) : {};
      } catch {
        throw new Error(
          "O servidor retornou uma resposta inválida. Verifique os logs do terminal."
        );
      }

      if (!res.ok) {
        throw new Error(data.error || `Erro no cadastro (Status ${res.status})`);
      }

      alert("Cadastro realizado com sucesso! Você já pode fazer login.");
      router.push("/login");
    } catch (error: unknown) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Erro ao realizar cadastro.";
      alert(message);
    } finally {
      setCadastrando(false);
    }
  };

  const handleGoogleRegister = async () => {
    setCadastrando(true);
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      const user = result.user;

      if (!user.email) {
        throw new Error("Não foi possível obter o e-mail da conta Google.");
      }

      const res = await fetch("/api/register-funcionario", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.displayName || "Funcionário Google",
          email: user.email,
          password: user.uid,
          telefone: formData.telefone,
          empresaId,
          isGoogle: true,
        }),
      });

      const textData = await res.text();
      let data;

      try {
        data = textData ? JSON.parse(textData) : {};
      } catch {
        throw new Error("O servidor retornou uma resposta inválida.");
      }

      if (!res.ok) {
        throw new Error(data.error || `Erro no cadastro (Status ${res.status})`);
      }

      alert("Cadastro com Google realizado com sucesso!");
      router.push("/lavador");
    } catch (error: unknown) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : "Erro ao cadastrar com Google.";
      alert(message);
    } finally {
      setCadastrando(false);
    }
  };

  if (loadingEmpresa) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center text-slate-600 text-sm font-semibold">
        Carregando formulário...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl p-6 shadow-xl border border-slate-200 space-y-4">
        <div className="text-center border-b border-slate-100 pb-4">
          <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">
            Convite de Equipe
          </span>
          <h1 className="text-xl font-bold text-slate-900 mt-1">
            Cadastro de Lavador
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Cadastre-se para fazer parte da equipe{" "}
            <strong className="text-slate-700">{empresaNome}</strong>
          </p>
        </div>

        <button
          type="button"
          onClick={handleGoogleRegister}
          disabled={cadastrando}
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
          Entrar / Cadastrar com Google
        </button>

        <div className="flex items-center my-3">
          <div className="flex-1 border-t border-slate-200"></div>
          <span className="px-3 text-xs text-slate-400 font-semibold">ou</span>
          <div className="flex-1 border-t border-slate-200"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nome Completo *
            </label>
            <input
              type="text"
              required
              placeholder="Digite seu nome"
              value={formData.name}
              onChange={(e) =>
                setFormData({ ...formData, name: e.target.value })
              }
              className="w-full text-sm p-3 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              E-mail de Acesso *
            </label>
            <input
              type="email"
              required
              placeholder="seuemail@exemplo.com"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full text-sm p-3 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Crie uma Senha *
            </label>
            <input
              type="password"
              required
              minLength={6}
              placeholder="Mínimo 6 caracteres"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="w-full text-sm p-3 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Telefone / WhatsApp (Opcional)
            </label>
            <input
              type="tel"
              placeholder="(00) 00000-0000"
              value={formData.telefone}
              onChange={(e) =>
                setFormData({ ...formData, telefone: e.target.value })
              }
              className="w-full text-sm p-3 rounded-xl border border-slate-300 text-slate-800 focus:outline-none focus:border-blue-600"
            />
          </div>

          <button
            type="submit"
            disabled={cadastrando}
            className="w-full mt-2 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-sm transition shadow-md cursor-pointer disabled:opacity-50"
          >
            {cadastrando ? "Criando conta..." : "Finalizar Cadastro"}
          </button>
        </form>
      </div>
    </div>
  );
}