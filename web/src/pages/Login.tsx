import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthField, AuthLayout, inputClass } from "../components/AuthLayout.js";
import { PasswordInput } from "../components/PasswordInput.js";
import { useAuth } from "../components/AuthProvider.js";
import type { ApiError } from "../services/api.js";

// Tela de entrar (Brief 6). Sem "Esqueci minha senha" por enquanto (D-25).
export function Login() {
  const { login, sessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const found: Record<string, string> = {};
    if (!email.trim()) found.email = "Informe o seu e-mail.";
    if (!password) found.password = "Informe a sua senha.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      const error = err as ApiError;
      if (error.code === "INVALID_CREDENTIALS") {
        setErrors({ geral: "E-mail ou senha incorretos. Confira e tente de novo." });
      } else if (error.code === "RATE_LIMITED") {
        setErrors({ geral: "Muitas tentativas. Espere um minuto e tente de novo." });
      } else if (error.status === undefined || error.status >= 500) {
        setErrors({ geral: "Não foi possível conectar. Verifique a internet e tente de novo." });
      } else {
        setErrors({ geral: error.message ?? "Algo deu errado. Tente de novo." });
      }
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-medium text-texto mb-1">Entrar</h1>
      <p className="text-texto-suave mb-6">Acesse o controle do seu rebanho.</p>

      {sessionExpired && (
        <p role="status" className="mb-4 rounded-lg bg-verde-claro text-verde-escuro px-3 py-2 text-sm">
          Sua sessão expirou. Entre de novo para continuar.
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <AuthField id="email" label="E-mail" error={errors.email}>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={inputClass(!!errors.email)}
          />
        </AuthField>

        <AuthField id="password" label="Senha" error={errors.password}>
          <PasswordInput
            id="password"
            value={password}
            onChange={setPassword}
            hasError={!!errors.password}
            autoComplete="current-password"
          />
        </AuthField>

        {errors.geral && (
          <p role="alert" className="text-sm text-alerta mb-4">
            {errors.geral}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-verde text-white font-medium py-2.5 rounded-lg cursor-pointer disabled:opacity-60"
        >
          {submitting ? "Entrando..." : "Entrar"}
        </button>
      </form>

      <p className="text-sm text-texto-suave mt-6 text-center">
        Não tem conta?{" "}
        <Link to="/register" className="text-verde font-medium hover:underline">
          Criar conta
        </Link>
      </p>
    </AuthLayout>
  );
}
