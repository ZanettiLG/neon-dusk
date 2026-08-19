import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";

/** Login form: email + password, ?redirect= post-login target (port of LoginView.vue). */
export default function LoginView() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const auth = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null);
    try {
      await auth.login({ email: email.trim(), password });
      const redirect = searchParams.get("redirect") ?? undefined;
      navigate(redirect ?? "/dashboard");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha na conexão");
    }
  }

  return (
    <div className="flex items-center justify-center py-12">
      <div className="card w-full max-w-md space-y-6">
        <div className="space-y-1">
          <h2 className="font-heading text-2xl text-nd-cyan tracking-widest">ACESSO RESTRITO</h2>
          <p className="text-nd-text-secondary text-sm">
            Autentique-se para entrar na rede do Neon//Dusk.
          </p>
        </div>

        <form className="space-y-4" onSubmit={onSubmit}>
          <label className="block space-y-1">
            <span className="text-nd-text-secondary text-xs uppercase tracking-wider font-data">
              E-mail
            </span>
            <input
              type="email"
              required
              autoComplete="email"
              placeholder="voce@neondusk.gg"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-nd-bg border border-nd-cyan/30 rounded-terminal px-3 py-2 text-nd-text placeholder-nd-text-secondary/40 focus:border-nd-cyan focus:shadow-neon-cyan outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-nd-text-secondary text-xs uppercase tracking-wider font-data">
              Senha
            </span>
            <input
              type="password"
              required
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-nd-bg border border-nd-cyan/30 rounded-terminal px-3 py-2 text-nd-text placeholder-nd-text-secondary/40 focus:border-nd-cyan focus:shadow-neon-cyan outline-none"
            />
          </label>

          {formError ? (
            <p className="text-nd-magenta font-data text-sm">{formError}</p>
          ) : auth.error && !formError ? (
            <p className="text-nd-magenta font-data text-sm">{auth.error}</p>
          ) : null}

          <button
            type="submit"
            disabled={auth.loading}
            className="btn-neon w-full disabled:opacity-50"
          >
            {auth.loading ? "CONECTANDO..." : "ENTRAR"}
          </button>
        </form>

        <p className="text-nd-text-secondary text-sm text-center">
          Ainda não tem um perfil?{" "}
          <Link to="/register" className="text-nd-cyan hover:underline">
            Cadastre-se
          </Link>
        </p>
      </div>
    </div>
  );
}
