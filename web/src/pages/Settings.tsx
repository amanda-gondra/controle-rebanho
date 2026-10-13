import { useCallback, useEffect, useId, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { Bell, Home, RotateCcw } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { useAuth } from "../components/AuthProvider.js";
import { useToast } from "../components/ToastProvider.js";
import { getFarm, updateFarm } from "../services/farm.js";
import type { FarmWithDefaults, UpdateFarmInput } from "../services/farm.js";
import type { ApiError } from "../services/api.js";
import { BRAZIL_TIME_ZONE_LABELS, utcOffsetLabel } from "../types/timezones.js";

// Configurações da fazenda (G2 — "Espec — Configurações da fazenda").
//
// Um cartão por assunto, cada um com o próprio "Salvar": se um der erro, o
// que foi digitado nos outros não se perde. Nesta versão aparecem só os
// cartões que já têm efeito no sistema (Fazenda e Manejo sanitário). Os de
// Negociações e Animais entram junto com a compra e venda (G5) e as novas
// categorias (G4) — nada de botão que não muda nada.

type FieldErrors = Record<string, string>;

// Opções de fuso: Brasília primeiro (o padrão), depois o resto em ordem alfabética
const TIME_ZONE_OPTIONS = Object.entries(BRAZIL_TIME_ZONE_LABELS)
  .map(([value, label]) => ({ value, label: `${label} (${utcOffsetLabel(value)})` }))
  .sort((a, b) =>
    a.value === "America/Sao_Paulo" ? -1 : b.value === "America/Sao_Paulo" ? 1 : a.label.localeCompare(b.label, "pt-BR"),
  );

export function Settings() {
  const [farm, setFarm] = useState<FarmWithDefaults | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const load = useCallback(() => {
    getFarm()
      .then(setFarm)
      .catch(() => setLoadFailed(true));
  }, []);

  useEffect(load, [load]);

  function retry() {
    setLoadFailed(false);
    load();
  }

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 p-4 pb-24 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-medium text-texto">Configurações</h1>
          <p className="text-texto-suave">
            Ajuste o Rebanho ao jeito da sua fazenda. Tudo já vem com um padrão que funciona.
          </p>
        </div>

        {loadFailed ? (
          <div className="bg-card border border-borda rounded-xl p-6 max-w-2xl">
            <p className="text-texto mb-4">Não foi possível carregar as configurações.</p>
            <button
              type="button"
              onClick={retry}
              className="bg-verde text-white font-medium px-4 py-2.5 rounded-xl cursor-pointer"
            >
              Tentar de novo
            </button>
          </div>
        ) : !farm ? (
          <SkeletonCards />
        ) : (
          <div className="flex flex-col gap-6 max-w-2xl">
            <FarmCard farm={farm} onSaved={setFarm} />
            <SanitaryCard farm={farm} onSaved={setFarm} />
          </div>
        )}
      </main>
    </div>
  );
}

// ── Salvar um cartão (lógica comum) ──────────────────────────────────────────

function useSaveFarm(onSaved: (farm: FarmWithDefaults) => void) {
  const { setFarm: setAccountFarm } = useAuth();
  const showToast = useToast();
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failed, setFailed] = useState(false);

  async function save(input: UpdateFarmInput) {
    setSaving(true);
    setErrors({});
    setFailed(false);
    try {
      const updated = await updateFarm(input);
      onSaved(updated);
      // Atualiza o resto do app (nome no menu, fuso, antecedência...)
      const { defaults: _defaults, ...farmOnly } = updated;
      setAccountFarm(farmOnly);
      showToast("Configurações salvas.");
    } catch (err) {
      const apiError = err as Partial<ApiError>;
      if (apiError.status === 400 && Array.isArray(apiError.errors)) {
        const mapped: FieldErrors = {};
        for (const { field, error } of apiError.errors) mapped[field] = error;
        setErrors(mapped);
      } else if (apiError.status !== 401) {
        // Sem conexão ou erro no servidor: o que foi digitado continua na tela
        setFailed(true);
      }
    } finally {
      setSaving(false);
    }
  }

  return { save, saving, errors, failed };
}

// ── Cartão: Fazenda ──────────────────────────────────────────────────────────

function FarmCard({ farm, onSaved }: { farm: FarmWithDefaults; onSaved: (f: FarmWithDefaults) => void }) {
  const [name, setName] = useState(farm.name);
  const [timezone, setTimezone] = useState(farm.timezone);
  const { save, saving, errors, failed } = useSaveFarm(onSaved);
  const nameId = useId();
  const tzId = useId();

  const changed = name.trim() !== farm.name || timezone !== farm.timezone;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const input: UpdateFarmInput = {};
    if (name.trim() !== farm.name) input.name = name;
    if (timezone !== farm.timezone) input.timezone = timezone;
    save(input);
  }

  return (
    <Card icon={<Home size={18} />} title="Fazenda" onSubmit={handleSubmit} saving={saving} changed={changed} failed={failed}>
      <Field id={nameId} label="Nome da fazenda" error={errors.name}>
        <input
          id={nameId}
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          aria-invalid={!!errors.name}
          aria-describedby={errors.name ? `${nameId}-error` : undefined}
          className={inputClass(!!errors.name)}
        />
      </Field>

      <Field
        id={tzId}
        label="Fuso horário"
        error={errors.timezone}
        help="Define o que é “hoje” para datas e lembretes. Datas já registradas não mudam."
      >
        <select
          id={tzId}
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          aria-invalid={!!errors.timezone}
          aria-describedby={`${tzId}-help`}
          className={`${inputClass(!!errors.timezone)} bg-card`}
        >
          {TIME_ZONE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </Field>

      {/* Fixos na 1.0 (D-30): mostrados, mas sem edição */}
      <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2 text-sm">
        <ReadOnly label="País" value="Brasil" />
        <ReadOnly label="Moeda" value="Real (R$)" />
        <ReadOnly label="Peso" value="Quilos (kg)" />
      </dl>
      <p className="text-xs text-texto-leve mb-5">
        País, moeda e unidade de peso poderão ser alterados quando o Rebanho atender outros países.
      </p>
    </Card>
  );
}

// ── Cartão: Manejo sanitário ─────────────────────────────────────────────────

function SanitaryCard({ farm, onSaved }: { farm: FarmWithDefaults; onSaved: (f: FarmWithDefaults) => void }) {
  const saved = farm.settings.reapplyAlertDays;
  const standard = farm.defaults.reapplyAlertDays;
  const [days, setDays] = useState(String(saved));
  const { save, saving, errors, failed } = useSaveFarm(onSaved);
  const [localError, setLocalError] = useState("");
  const id = useId();

  const changed = days.trim() !== String(saved);
  const error = localError || errors.reapplyAlertDays;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setLocalError("");
    const value = Number(days);
    if (days.trim() === "" || !Number.isInteger(value)) {
      return setLocalError("Informe um número inteiro de dias.");
    }
    save({ reapplyAlertDays: value });
  }

  return (
    <Card icon={<Bell size={18} />} title="Manejo sanitário" onSubmit={handleSubmit} saving={saving} changed={changed} failed={failed}>
      <Field
        id={id}
        label="Avisar reaplicação com quantos dias de antecedência?"
        error={error}
        help="A reaplicação aparece nos lembretes esse número de dias antes da data. Use 0 para avisar só no dia."
      >
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="number"
            inputMode="numeric"
            min={0}
            max={60}
            step={1}
            value={days}
            onChange={(e) => setDays(e.target.value)}
            aria-invalid={!!error}
            aria-describedby={`${id}-help${error ? ` ${id}-error` : ""}`}
            className={inputClass(!!error, "w-24")}
          />
          <span className="text-texto-suave">dias</span>
        </div>
      </Field>

      {days.trim() !== String(standard) && (
        <p className="flex flex-wrap items-center gap-x-2 text-sm text-texto-leve -mt-3 mb-5">
          padrão: {standard} dias
          <button
            type="button"
            onClick={() => setDays(String(standard))}
            className="inline-flex items-center gap-1 text-verde font-medium cursor-pointer hover:underline"
          >
            <RotateCcw size={14} aria-hidden="true" /> Voltar ao padrão
          </button>
        </p>
      )}
    </Card>
  );
}

// ── Peças visuais ────────────────────────────────────────────────────────────

const inputClass = (hasError: boolean, width = "w-full") =>
  `${width} border rounded-lg px-3 py-2 text-texto ${hasError ? "border-alerta" : "border-borda"}`;

function Card(props: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  onSubmit: (e: FormEvent) => void;
  saving: boolean;
  changed: boolean;
  failed: boolean;
}) {
  const titleId = useId();
  return (
    <section className="bg-card border border-borda rounded-xl p-5 md:p-6" aria-labelledby={titleId}>
      <h2 id={titleId} className="flex items-center gap-2 font-medium text-texto mb-4">
        <span className="text-verde">{props.icon}</span>
        {props.title}
      </h2>
      <form onSubmit={props.onSubmit} noValidate>
        {props.children}
        {props.failed && (
          <p role="alert" className="text-sm text-alerta mb-3">
            Não foi possível salvar. O que você digitou não foi perdido.
          </p>
        )}
        <button
          type="submit"
          disabled={props.saving || (!props.changed && !props.failed)}
          className="bg-verde text-white font-medium px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {props.saving ? "Salvando..." : props.failed ? "Tentar de novo" : "Salvar"}
        </button>
      </form>
    </section>
  );
}

function Field(props: { id: string; label: string; error?: string; help?: string; children: ReactNode }) {
  return (
    <div className="mb-5">
      <label htmlFor={props.id} className="block font-medium text-texto mb-1">
        {props.label}
      </label>
      {props.children}
      {props.error && (
        <p id={`${props.id}-error`} role="alert" className="text-sm text-alerta mt-1">
          {props.error}
        </p>
      )}
      {props.help && (
        <p id={`${props.id}-help`} className="text-sm text-texto-leve mt-1">
          {props.help}
        </p>
      )}
    </div>
  );
}

function ReadOnly({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-bege rounded-lg px-3 py-2">
      <dt className="text-texto-leve text-xs">{label}</dt>
      <dd className="text-texto-suave">{value}</dd>
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="flex flex-col gap-6 max-w-2xl" aria-busy="true" aria-label="Carregando configurações">
      {[0, 1].map((i) => (
        <div key={i} className="bg-card border border-borda rounded-xl p-6 animate-pulse">
          <div className="h-5 w-40 bg-bege rounded mb-5" />
          <div className="h-10 w-full bg-bege rounded mb-4" />
          <div className="h-10 w-2/3 bg-bege rounded" />
        </div>
      ))}
    </div>
  );
}
