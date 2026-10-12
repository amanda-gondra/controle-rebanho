import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { AuthField, AuthLayout, inputClass } from "../components/AuthLayout.js";
import { PasswordInput } from "../components/PasswordInput.js";
import { useAuth } from "../components/AuthProvider.js";
import type { ApiError } from "../services/api.js";

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
      setErrors({ farmName: "Informe o nome da fazenda." });
      return;
    }
    setErrors({});
    setStep(2);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    const found: Record<string, string> = {};
    if (!name.trim()) found.name = "Informe o seu nome.";
    if (!email.trim()) found.email = "Informe o seu e-mail.";
    if (password.length < MIN_PASSWORD) {
      found.password = `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres.`;
    }
    if (confirm !== password) found.confirm = "As senhas não conferem.";
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    setSubmitting(true);
    try {
      await register({ farmName, name, email, password });
      navigate("/", { replace: true });
    } catch (err) {
      const error = err as ApiError;
      if (error.code === "EMAIL_ALREADY_REGISTERED") {
        setErrors({ email: "Já existe uma conta com esse e-mail." });
      } else if (error.code === "VALIDATION_ERROR" && error.errors?.length) {
        const mapped: Record<string, string> = {};
        for (const e of error.errors) mapped[e.field] = e.error;
        if (mapped.farmName) setStep(1);
        setErrors(mapped);
      } else if (error.code === "RATE_LIMITED") {
        setErrors({ geral: "Muitas tentativas. Espere um minuto e tente de novo." });
      } else {
        setErrors({ geral: "Não foi possível criar a conta. Tente de novo." });
      }
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <p className="text-sm text-texto-leve mb-2">Passo {step} de 2</p>
      <h1 className="text-2xl font-medium text-texto mb-1">Criar conta</h1>

      {step === 1 ? (
        <form onSubmit={handleContinue} noValidate>
          <p className="text-texto-suave mb-6">Comece pela sua fazenda.</p>

          <AuthField id="farmName" label="Nome da fazenda" error={errors.farmName}>
            <input
              id="farmName"
              value={farmName}
              onChange={(e) => setFarmName(e.target.value)}
              placeholder="Ex.: Fazenda Boa Vista"
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
            Continuar
          </button>
        </form>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <p className="text-texto-suave mb-6">Agora, os seus dados de acesso.</p>

          <AuthField id="name" label="Seu nome" error={errors.name}>
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
              autoComplete="new-password"
            />
            {!errors.password && (
              <p className="text-sm text-texto-leve mt-1">Pelo menos {MIN_PASSWORD} caracteres.</p>
            )}
          </AuthField>

          <AuthField id="confirm" label="Confirmar senha" error={errors.confirm}>
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
              Voltar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-verde text-white font-medium py-2.5 rounded-lg cursor-pointer disabled:opacity-60"
            >
              {submitting ? "Criando..." : "Criar conta"}
            </button>
          </div>
        </form>
      )}

      <p className="text-sm text-texto-suave mt-6 text-center">
        Já tem conta?{" "}
        <Link to="/login" className="text-verde font-medium hover:underline">
          Entrar
        </Link>
      </p>
    </AuthLayout>
  );
}
