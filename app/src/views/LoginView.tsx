import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Button, ErrorState, Input } from "@/components/ui";
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

  // Local failure wins over any stale store error; identical to the previous
  // formError/auth.error cascade.
  const errorMessage = formError ?? auth.error;

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
          <Input
            label="E-mail"
            type="email"
            required
            autoComplete="email"
            placeholder="voce@neondusk.gg"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            fullWidth
          />

          <Input
            label="Senha"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            fullWidth
          />

          {errorMessage && <ErrorState message={errorMessage} />}

          <Button type="submit" loading={auth.loading} fullWidth>
            {auth.loading ? "CONECTANDO..." : "ENTRAR"}
          </Button>
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
