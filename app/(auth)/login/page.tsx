"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { 
  signInWithEmailAndPassword, 
  signInWithPopup 
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db, googleProvider } from "../../lib/firebase";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleRedirectByRole = async (uid: string) => {
    const userDoc = await getDoc(doc(db, "users", uid));

    if (userDoc.exists()) {
      const role = userDoc.data().role;
      if (role === "adm") router.push("/adm");
      else if (role === "lavador") router.push("/lavador");
      else router.push("/cliente");
    } else {
      await setDoc(doc(db, "users", uid), {
        role: "cliente",
        createdAt: new Date().toISOString(),
      });
      router.push("/cliente");
    }
  };

 const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      await handleRedirectByRole(userCredential.user.uid);
    } catch (err: unknown) {
      console.error(err);
      setError("Email ou senha inválidos.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");

    try {
      const result = await signInWithPopup(auth, googleProvider);
      await handleRedirectByRole(result.user.uid);
    } catch (err: unknown) {
      console.error(err);
      setError("Erro ao autenticar com o Google.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full px-0 sm:px-3 mx-auto mt-0 md:flex-0 shrink-0 flex justify-center items-center bg-slate-50">
      <div className="relative z-0 flex flex-col min-w-0 wrap-break-words w-full min-h-screen justify-center items-center sm:w-auto sm:min-h-0 sm:justify-start sm:items-stretch bg-white border-0 shadow-none sm:shadow-soft-xl rounded-none sm:rounded-2xl bg-clip-border">
        <div className="w-full flex flex-col justify-center items-center">
          
          <div className="p-6 mb-0 text-center bg-white border-b-0 rounded-t-2xl text-slate-700 text-2xl sm:text-sm">
            <h5 className="font-bold">Entrar no LavaFlow <p className="text-[12px] text-right">powered by <a className="underline" href="https://codariadev.vercel.app/">CodariaDev</a></p> </h5>
          </div>

          {error && (
            <div className="p-3 mb-2 text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg">
              {error}
            </div>
          )}

          <div className="flex flex-wrap px-3 -mx-3 sm:px-6 xl:px-12 justify-center">
            <div className="max-w-full px-1">
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="inline-flex items-center justify-center w-full px-6 py-3 mb-4 font-bold text-center text-gray-700 uppercase align-middle transition-all bg-transparent border border-gray-200 border-solid rounded-lg shadow-none cursor-pointer hover:scale-102 leading-pro text-xs ease-soft-in tracking-tight-soft bg-150 bg-x-25 hover:bg-slate-50 disabled:opacity-50"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  version="1.1"
                  viewBox="0 0 64 64"
                  height="32px"
                  width="24px"
                  className="mr-2"
                >
                  <g fillRule="evenodd" fill="none" strokeWidth="1" stroke="none">
                    <g fillRule="nonzero" transform="translate(3.000000, 2.000000)">
                      <path fill="#4285F4" d="M57.8123233,30.1515267 C57.8123233,27.7263183 57.6155321,25.9565533 57.1896408,24.1212666 L29.4960833,24.1212666 L29.4960833,35.0674653 L45.7515771,35.0674653 C45.4239683,37.7877475 43.6542033,41.8844383 39.7213169,44.6372555 L39.6661883,45.0037254 L48.4223791,51.7870338 L49.0290201,51.8475849 C54.6004021,46.7020943 57.8123233,39.1313952 57.8123233,30.1515267" />
                      <path fill="#34A853" d="M29.4960833,58.9921667 C37.4599129,58.9921667 44.1456164,56.3701671 49.0290201,51.8475849 L39.7213169,44.6372555 C37.2305867,46.3742596 33.887622,47.5868638 29.4960833,47.5868638 C21.6960582,47.5868638 15.0758763,42.4415995 12.7159637,35.3297782 L12.3700541,35.3591501 L3.26524241,42.4054492 L3.14617358,42.736447 C7.9965904,52.3717589 17.959737,58.9921667 29.4960833,58.9921667" />
                      <path fill="#FBBC05" d="M12.7159637,35.3297782 C12.0932812,33.4944915 11.7329116,31.5279353 12.6832029,23.6623884 L12.6667095,23.2715173 L3.44779955,16.1120237 L3.14617358,16.2554937 C1.14708246,20.2539019 0,24.7439495 0,29.4960833 C0,34.2482175 1.14708246,38.7380388 3.14617358,42.736447 L12.7159637,35.3297782" />
                      <path fill="#EB4335" d="M29.4960833,11.4050769 C35.0347044,11.4050769 38.7707997,13.7975244 40.9011602,15.7968415 L49.2255853,7.66898166 C44.1130815,2.91684746 37.4599129,0 29.4960833,0 C17.959737,0 7.9965904,6.62018183 3.14617358,16.2554937 L12.6832029,23.6623884 C15.0758763,16.5505675 21.6960582,11.4050769 29.4960833,11.4050769" />
                    </g>
                  </g>
                </svg>
                Entrar com o Google
              </button>
            </div>

            <div className="relative w-full max-w-full px-3 mt-2 text-center shrink-0">
              <p className="z-20 inline px-4 mb-2 font-semibold leading-normal bg-white text-slate-400 text-sm">
                ou
              </p>
            </div>
          </div>

          <div className="flex-auto p-6 flex justify-center w-full">
            <form
              onSubmit={handleEmailLogin}
              className="w-[calc(100%+24px)] -mx-3 sm:w-full sm:mx-0"
              role="form"
            >
              <div className="mb-4">
                <input
                  aria-label="Email"
                  placeholder="Email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="sm:text-sm text-base focus:shadow-soft-primary-outline leading-5.6 ease-soft block w-full appearance-none rounded-lg border border-solid border-gray-300 bg-white bg-clip-padding py-2 px-3 font-normal text-gray-700 transition-all focus:border-slate-800 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="mb-4">
                <input
                  aria-label="Password"
                  placeholder="Senha"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="sm:text-sm text-base focus:shadow-soft-primary-outline leading-5.6 ease-soft block w-full appearance-none rounded-lg border border-solid border-gray-300 bg-white bg-clip-padding py-2 px-3 font-normal text-gray-700 transition-all focus:border-slate-800 focus:bg-white focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between min-h-6 mb-0.5">
                <div className="pl-7">
                  <input
                    type="checkbox"
                    id="remember"
                    className="w-5 h-5 ease-soft -ml-7 rounded-1.4 checked:bg-linear-to-tl checked:from-gray-900 checked:to-slate-800 relative float-left mt-1 cursor-pointer appearance-none border border-solid border-slate-200 bg-white"
                  />
                  <label
                    htmlFor="remember"
                    className="ml-1 font-normal cursor-pointer select-none text-sm text-slate-700"
                  >
                    Lembrar de mim
                  </label>
                </div>

                <a
                  href="#"
                  className="font-bold text-sm text-slate-700 hover:opacity-75"
                >
                  Esqueci minha senha
                </a>
              </div>

              <div className="text-center">
                <button
                  type="submit"
                  disabled={loading}
                  className="inline-block w-full px-6 py-3 mt-6 mb-2 font-bold text-center text-white uppercase align-middle transition-all border-0 rounded-lg cursor-pointer active:opacity-85 hover:scale-102 leading-pro text-xs tracking-tight-soft shadow-soft-md bg-linear-to-tl from-gray-900 to-slate-800 hover:bg-slate-700 disabled:opacity-50"
                >
                  {loading ? "Entrando..." : "Entrar"}
                </button>
              </div>

              <p className="mt-4 mb-0 leading-normal text-sm text-slate-700 text-center">
                Ainda não tem uma conta?{" "}
                <Link
                  className="font-bold text-slate-700 underline"
                  href="/register"
                >
                  Registre-se
                </Link>
              </p>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}