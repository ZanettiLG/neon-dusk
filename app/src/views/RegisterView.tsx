import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";

/** Register form: email + password + confirm (port of RegisterView.vue). */
export default function RegisterView() {
  const navigate = useNavigate();
  const auth = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const passwordMismatch = useMemo(
    () => confirm.length > 0 && password !== confirm,
    [confirm, password],
  );

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null);
    if (passwordMismatch) {
      setFormError("As senhas não coincidem");
      return;
    }
    try {
      await auth.register({ email: email.trim(), password });
      navigate("/dashboard");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Falha na conexão");
    }
  }

  return (
    <div className="flex items-center justify-center py-12">
      <div className="card w-full max-w-md space-y-6">
        <div className="space-y-1">
          <h2 className="font-heading text-2xl text-nd-magenta tracking-widest">CRIAR PERFIL</h2>
          <p className="text-nd-text-secondary text-sm">
            Novos nomes no grid. Novo sangue na cidade.
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
              placeholder="fixer@neondusk.gg"
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
              autoComplete="new-password"
              minLength={8}
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-nd-bg border border-nd-cyan/30 rounded-terminal px-3 py-2 text-nd-text placeholder-nd-text-secondary/40 focus:border-nd-cyan focus:shadow-neon-cyan outline-none"
            />
          </label>

          <label className="block space-y-1">
            <span className="text-nd-text-secondary text-xs uppercase tracking-wider font-data">
              Confirmar senha
            </span>
            <input
              type="password"
              required
              autoComplete="new-password"
              placeholder="Repita a senha"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full bg-nd-bg border border-nd-cyan/30 rounded-terminal px-3 py-2 text-nd-text placeholder-nd-text-secondary/40 focus:border-nd-cyan focus:shadow-neon-cyan outline-none"
            />
          </label>

          {formError ? (
            <p className="text-nd-magenta font-data text-sm">{formError}</p>
          ) : passwordMismatch ? (
            <p className="text-nd-magenta font-data text-sm">As senhas não coincidem</p>
          ) : null}

          <button
            type="submit"
            disabled={auth.loading}
            className="btn-neon w-full disabled:opacity-50"
          >
            {auth.loading ? "GERANDO CREDENCIAIS..." : "CADASTRAR"}
          </button>
        </form>

        <p className="text-nd-text-secondary text-sm text-center">
          Já tem um perfil?{" "}
          <Link to="/login" className="text-nd-cyan hover:underline">
            Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
