import { useId, useState } from "react";
import { ModalFrame } from "./ModalFrame.js";
import { buttonClass } from "./buttonStyles.js";
import { createProduct, updateProduct, type ProductInput } from "../services/sanitary.js";
import { PRODUCT_TYPES, type Product, type ProductType } from "../types/animal.js";
import { t } from "../i18n/index.js";
import { errorMessage, fieldErrorsOf } from "../i18n/errors.js";

// Cadastrar ou editar um produto sanitário (F-18, D-39, D-12). Abre na tela
// de Produtos e também DENTRO de "Registrar aplicação" ("+ Novo produto" sem
// sair da tela). A carência é escrita pelo produtor a partir da bula; em
// branco = "não informada" (nunca zero). O sistema não sugere nada.

type Props = {
  product?: Product; // sem produto = cadastro
  initialType?: ProductType;
  onClose: () => void;
  onSaved: (product: Product) => void;
};

const textOrNull = (value: string) => (value.trim() === "" ? null : value.trim());

export function ProductModal({ product, initialType = "VACCINE", onClose, onSaved }: Props) {
  const id = useId();
  const initial = {
    name: product?.name ?? "",
    type: product?.type ?? initialType,
    purpose: product?.purpose ?? "",
    manufacturer: product?.manufacturer ?? "",
    withdrawalDays: product?.withdrawalDays == null ? "" : String(product.withdrawalDays),
    notes: product?.notes ?? "",
  };
  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const dirty = JSON.stringify(form) !== JSON.stringify(initial);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const found: Record<string, string> = {};
    if (!form.name.trim()) found.name = t("products.nameRequired");
    const days = form.withdrawalDays.trim();
    if (days !== "" && !/^\d{1,3}$/.test(days)) found.withdrawalDays = t("products.withdrawalInvalid");
    else if (days !== "" && Number(days) > 365) found.withdrawalDays = t("products.withdrawalInvalid");
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const data: ProductInput = {
      name: form.name.trim(),
      type: form.type,
      purpose: textOrNull(form.purpose),
      manufacturer: textOrNull(form.manufacturer),
      withdrawalDays: days === "" ? null : Number(days),
      notes: textOrNull(form.notes),
    };
    setSaving(true);
    try {
      const saved = product ? await updateProduct(product.id, data) : await createProduct(data);
      onSaved(saved);
    } catch (err) {
      const fields = fieldErrorsOf(err);
      const code = (err as { code?: string })?.code;
      setErrors(code === "DUPLICATE_PRODUCT_NAME" ? { name: errorMessage(err) } : (fields ?? { geral: errorMessage(err) }));
      setSaving(false);
    }
  }

  const field = (key: keyof typeof form, label: string, options: { placeholder?: string; help?: string; optional?: boolean; inputMode?: "numeric" } = {}) => (
    <div className="mb-4">
      <label htmlFor={`${id}-${key}`} className="block font-medium text-texto mb-1">
        {label}{" "}
        {options.optional ? (
          <span className="text-texto-leve font-normal">{t("common.optional")}</span>
        ) : (
          <span className="text-alerta">*</span>
        )}
      </label>
      <input
        id={`${id}-${key}`}
        value={form[key]}
        onChange={(e) => set(key, e.target.value as never)}
        placeholder={options.placeholder}
        inputMode={options.inputMode}
        aria-invalid={!!errors[key]}
        aria-describedby={errors[key] ? `${id}-${key}-error` : options.help ? `${id}-${key}-help` : undefined}
        className={`w-full border rounded-lg px-3 py-2 text-texto ${errors[key] ? "border-alerta" : "border-borda"}`}
      />
      {options.help && !errors[key] && (
        <p id={`${id}-${key}-help`} className="text-sm text-texto-leve mt-1">
          {options.help}
        </p>
      )}
      {errors[key] && (
        <p id={`${id}-${key}-error`} className="text-sm text-alerta mt-1">
          {errors[key]}
        </p>
      )}
    </div>
  );

  return (
    <ModalFrame title={product ? t("products.editTitle") : t("products.newTitle")} onClose={onClose} dirty={dirty} busy={saving} size="lg">
      <form onSubmit={handleSubmit} noValidate>
        {field("name", t("products.name"), { placeholder: t("products.namePlaceholder") })}

        <fieldset className="mb-4">
          <legend className="block font-medium text-texto mb-1">
            {t("products.type")} <span className="text-alerta">*</span>
          </legend>
          <div className="grid grid-cols-2 gap-2">
            {PRODUCT_TYPES.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={form.type === value}
                onClick={() => set("type", value)}
                className={`py-2.5 px-3 rounded-lg border text-sm font-medium cursor-pointer ${
                  form.type === value ? "bg-verde border-verde text-white" : "bg-card border-borda-chip text-texto-suave"
                }`}
              >
                {t(`product.type.${value}`)}
              </button>
            ))}
          </div>
        </fieldset>

        {field("purpose", t("products.purpose"), { placeholder: t("products.purposePlaceholder"), optional: true })}
        {field("manufacturer", t("products.manufacturer"), { optional: true })}
        {field("withdrawalDays", t("products.withdrawalDays"), { help: t("products.withdrawalHelp"), optional: true, inputMode: "numeric" })}

        <div className="mb-5">
          <label htmlFor={`${id}-notes`} className="block font-medium text-texto mb-1">
            {t("products.notes")} <span className="text-texto-leve font-normal">{t("common.optional")}</span>
          </label>
          <textarea
            id={`${id}-notes`}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            rows={2}
            className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
          />
        </div>

        {errors.geral && <p role="alert" className="text-sm text-alerta mb-4">{errors.geral}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={buttonClass("secondary")}>
            {t("common.cancel")}
          </button>
          <button type="submit" disabled={saving} className={buttonClass("primary")}>
            {saving ? t("common.saving") : product ? t("products.save") : t("products.create")}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
