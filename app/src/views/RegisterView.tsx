import { useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth";

// Mirrors the server-side rules in auth-service.ts (emailSchema/passwordSchema):
// 8-72 chars, ≥1 uppercase, ≥1 digit. Kept local so feedback is instant.
// EMAIL_RE mirrors the zod v3 z.string().email() regex (node_modules/zod/v3/types.js)
// so the client rejects exactly what server/src/services/auth-service.ts rejects.
const EMAIL_RE = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;

/** First failing password rule, or null when the field is valid/empty. */
function passwordError(password: string): string | null {
  if (password.length === 0) return null;
  if (password.length < 8) return "A senha precisa de pelo menos 8 caracteres.";
  if (password.length > 72) return "A senha pode ter no máximo 72 caracteres.";
  if (!/[A-Z]/.test(password)) return "Inclua ao menos uma letra maiúscula.";
  if (!/[0-9]/.test(password)) return "Inclua ao menos um número.";
  return null;
}

/** Register form: email + password + confirm (port of RegisterView.vue). */
export default function RegisterView() {
  const navigate = useNavigate();
  const auth = useAuthStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const emailError = useMemo(
    () => (email.length > 0 && !EMAIL_RE.test(email.trim()) ? "E-mail inválido." : null),
    [email],
  );
  const passwordFieldError = useMemo(() => passwordError(password), [password]);
  const confirmError = useMemo(
    () => (confirm.length > 0 && password !== confirm ? "As senhas não coincidem" : null),
    [confirm, password],
  );

  const valid =
    email.length > 0 &&
    password.length > 0 &&
    confirm.length > 0 &&
    emailError === null &&
    passwordFieldError === null &&
    confirmError === null;

  async function onSubmit(e: FormEvent): Promise<void> {
    e.preventDefault();
    setFormError(null);
    if (!valid) return;
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

        <form className="space-y-4" onSubmit={onSubmit} noValidate>
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
            {emailError && (
              <p role="alert" className="text-nd-magenta font-data text-xs">
                {emailError}
              </p>
            )}
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
              maxLength={72}
              placeholder="Mínimo 8 caracteres"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-nd-bg border border-nd-cyan/30 rounded-terminal px-3 py-2 text-nd-text placeholder-nd-text-secondary/40 focus:border-nd-cyan focus:shadow-neon-cyan outline-none"
            />
            {passwordFieldError && (
              <p role="alert" className="text-nd-magenta font-data text-xs">
                {passwordFieldError}
              </p>
            )}
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
            {confirmError && (
              <p role="alert" className="text-nd-magenta font-data text-xs">
                {confirmError}
              </p>
            )}
          </label>

          {formError && <p className="text-nd-magenta font-data text-sm">{formError}</p>}

          <button
            type="submit"
            disabled={!valid || auth.loading}
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
