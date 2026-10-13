import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AuthField, AuthLayout, inputClass } from "../components/AuthLayout.js";
import { PasswordInput } from "../components/PasswordInput.js";
import { useAuth } from "../components/AuthProvider.js";
import type { ApiError } from "../services/api.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";

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
    if (!email.trim()) found.email = t("auth.login.emailRequired");
    if (!password) found.password = t("auth.login.passwordRequired");
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      // Pelo código do erro (senha errada, muitas tentativas, sem conexão...)
      setErrors({ geral: errorMessage(err as ApiError) });
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <h1 className="text-2xl font-medium text-texto mb-1">{t("auth.login.title")}</h1>
      <p className="text-texto-suave mb-6">{t("auth.login.subtitle")}</p>

      {sessionExpired && (
        <p role="status" className="mb-4 rounded-lg bg-verde-claro text-verde-escuro px-3 py-2 text-sm">
          {t("auth.login.sessionExpired")}
        </p>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <AuthField id="email" label={t("auth.email")} error={errors.email}>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={t("auth.emailPlaceholder")}
            autoComplete="email"
            aria-invalid={!!errors.email}
            aria-describedby={errors.email ? "email-error" : undefined}
            className={inputClass(!!errors.email)}
          />
        </AuthField>

        <AuthField id="password" label={t("auth.password")} error={errors.password}>
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
          {submitting ? t("auth.login.submitting") : t("auth.login.submit")}
        </button>
      </form>

      <p className="text-sm text-texto-suave mt-6 text-center">
        {t("auth.login.noAccount")}{" "}
        <Link to="/register" className="text-verde font-medium hover:underline">
          {t("auth.login.createAccount")}
        </Link>
      </p>
    </AuthLayout>
  );
}
