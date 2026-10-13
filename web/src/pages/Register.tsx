import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthField, AuthLayout, inputClass } from "../components/AuthLayout.js";
import { PasswordInput } from "../components/PasswordInput.js";
import { useAuth } from "../components/AuthProvider.js";
import type { ApiError } from "../services/api.js";
import { t } from "../i18n/index.js";
import { errorMessage, fieldErrorsOf } from "../i18n/errors.js";

const MIN_PASSWORD = 8;

// Criar conta em DOIS passos (Brief 7): primeiro a fazenda, depois o acesso.
// Idioma, moeda, unidade e base de preço chegam com as configurações da
// fazenda (parte G2); por enquanto o cadastro pede só o essencial.
export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState<1 | 2>(1);
  const [farmName, setFarmName] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);

  function handleContinue(event: FormEvent) {
    event.preventDefault();
    if (!farmName.trim()) {
      setErrors({ farmName: t("auth.register.farmNameRequired") });
      return;
    }
    setErrors({});
    setStep(2);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const found: Record<string, string> = {};
    if (!name.trim()) found.name = t("auth.register.nameRequired");
    if (!email.trim()) found.email = t("auth.login.emailRequired");
    if (password.length < MIN_PASSWORD) {
      found.password = t("auth.register.passwordMin", { min: MIN_PASSWORD });
    }
    if (confirm !== password) found.confirm = t("auth.register.confirmMismatch");
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await register({ farmName, name, email, password });
      navigate("/", { replace: true });
    } catch (err) {
      const error = err as ApiError;
      const fields = fieldErrorsOf(error);
      if (error.code === "EMAIL_ALREADY_REGISTERED") {
        setErrors({ email: errorMessage(error) });
      } else if (fields) {
        if (fields.farmName) setStep(1);
        setErrors(fields);
      } else {
        setErrors({ geral: errorMessage(error, "auth.register.failed") });
      }
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <p className="text-sm text-texto-leve mb-2">{t("auth.register.step", { step })}</p>
      <h1 className="text-2xl font-medium text-texto mb-1">{t("auth.register.title")}</h1>

      {step === 1 ? (
        <form onSubmit={handleContinue} noValidate>
          <p className="text-texto-suave mb-6">{t("auth.register.step1Intro")}</p>

          <AuthField id="farmName" label={t("auth.register.farmName")} error={errors.farmName}>
            <input
              id="farmName"
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              placeholder={t("auth.register.farmNamePlaceholder")}
              autoComplete="organization"
              aria-invalid={!!errors.farmName}
              aria-describedby={errors.farmName ? "farmName-error" : undefined}
              className={inputClass(!!errors.farmName)}
            />
          </AuthField>

          <button
            type="submit"
            className="w-full bg-verde text-white font-medium py-2.5 rounded-lg cursor-pointer"
          >
            {t("auth.register.continue")}
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <p className="text-texto-suave mb-6">{t("auth.register.step2Intro")}</p>

          <AuthField id="name" label={t("auth.register.name")} error={errors.name}>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
              aria-invalid={!!errors.name}
              aria-describedby={errors.name ? "name-error" : undefined}
              className={inputClass(!!errors.name)}
            />
          </AuthField>

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
              autoComplete="new-password"
            />
            {!errors.password && (
              <p className="text-sm text-texto-leve mt-1">{t("auth.register.passwordHint", { min: MIN_PASSWORD })}</p>
            )}
          </AuthField>

          <AuthField id="confirm" label={t("auth.register.confirm")} error={errors.confirm}>
            <PasswordInput
              id="confirm"
              value={confirm}
              onChange={setConfirm}
              hasError={!!errors.confirm}
              autoComplete="new-password"
            />
          </AuthField>

          {errors.geral && (
            <p role="alert" className="text-sm text-alerta mb-4">
              {errors.geral}
            </p>
          )}

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => {
                setErrors({});
                setStep(1);
              }}
              className="flex-1 border border-borda-chip text-texto-suave font-medium py-2.5 rounded-lg cursor-pointer"
            >
              {t("common.back")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-verde text-white font-medium py-2.5 rounded-lg cursor-pointer disabled:opacity-60"
            >
              {submitting ? t("auth.register.submitting") : t("auth.register.submit")}
            </button>
          </div>
        </form>
      )}

      <p className="text-sm text-texto-suave mt-6 text-center">
        {t("auth.register.hasAccount")}{" "}
        <Link to="/login" className="text-verde font-medium hover:underline">
          {t("auth.register.login")}
        </Link>
      </p>
    </AuthLayout>
  );
}
