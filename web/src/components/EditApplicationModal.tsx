import { invalidateReminderCount } from "../hooks/useReminderCount.js";
import { useEffect, useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ModalFrame } from "./ModalFrame.js";
import { buttonClass } from "./buttonStyles.js";
import { listProducts, updateApplication } from "../services/sanitary.js";
import { listAllAnimals } from "../services/animals.js";
import { PRODUCT_TYPES, type Animal, type Application, type DoseUnit, type Product, type ProductType } from "../types/animal.js";
import { t } from "../i18n/index.js";
import { singleErrorMessage } from "../i18n/errors.js";

// Corrigir uma aplicação (F-SAN-04, RN-SAN-011): produto, data, reaplicação,
// dose, partida, observação e os ANIMAIS — tirar quem não recebeu, incluir
// quem faltou (só ativos). As regras do cadastro valem na correção.

type Props = {
  application: Application;
  onClose: () => void;
  onSaved: () => void;
};

const DOSE_UNITS: DoseUnit[] = ["ML", "G", "DOSE"];

export function EditApplicationModal({ application, onClose, onSaved }: Props) {
  const formId = useId();
  const startAnimals = useMemo(
    () => (application.animals ?? []).map((link) => ({ id: link.animalId, tag: link.animal?.tag ?? "—" })),
    [application.animals],
  );
  const initial = {
    type: application.product.type,
    productId: application.productId,
    date: application.date.slice(0, 10),
    needsReapply: application.reapplyDate != null,
    reapplyDate: application.reapplyDate ? application.reapplyDate.slice(0, 10) : "",
    notes: application.notes ?? "",
    batchNumber: application.batchNumber ?? "",
    doseAmount: application.doseAmount ? String(Number(application.doseAmount)).replace(".", ",") : "",
    doseUnit: (application.doseUnit ?? "") as DoseUnit | "",
    animals: startAnimals,
  };
  const [form, setForm] = useState(initial);
  const set = <K extends keyof typeof form>(key: K, value: (typeof form)[K]) => setForm((prev) => ({ ...prev, [key]: value }));
  const [products, setProducts] = useState<Product[]>([]);
  const [activeAnimals, setActiveAnimals] = useState<Animal[]>([]);
  const [addTag, setAddTag] = useState("");
  const [addError, setAddError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const dirty = JSON.stringify(form) !== JSON.stringify(initial);

  // Produtos ATIVOS do tipo; o produto atual continua na lista mesmo arquivado
  useEffect(() => {
    listProducts(form.type)
      .then((data) => {
        const current = application.product;
        setProducts(
          current.type === form.type && !data.some((product) => product.id === current.id) ? [current, ...data] : data,
        );
      })
      .catch(() => setError(t("application.productsLoadFailed")));
  }, [form.type, application.product]);

  useEffect(() => {
    listAllAnimals({ status: "ACTIVE", sortBy: "tag", order: "asc" })
      .then(setActiveAnimals)
      .catch(() => setActiveAnimals([]));
  }, []);

  const removed = startAnimals.filter((animal) => !form.animals.some((kept) => kept.id === animal.id));

  function addAnimal() {
    setAddError("");
    const wanted = addTag.trim().toLocaleLowerCase();
    const found = activeAnimals.find((animal) => animal.tag.toLocaleLowerCase() === wanted);
    if (!found) return setAddError(t("application.noActiveMatch"));
    if (!form.animals.some((animal) => animal.id === found.id)) set("animals", [...form.animals, { id: found.id, tag: found.tag }]);
    setAddTag("");
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!form.productId) return setError(t("application.productRequired"));
    if (!form.date) return setError(t("application.dateRequired"));
    if (form.needsReapply && !form.reapplyDate) return setError(t("application.reapplyDateRequired"));
    if (form.animals.length === 0) return setError(t("application.animalsRequired"));
    const dose = form.doseAmount.trim() === "" ? null : Number(form.doseAmount.replace(",", "."));
    if ((dose === null) !== (form.doseUnit === "") || (dose !== null && !(dose > 0))) {
      return setError(t("errors.fieldCodes.DOSE_INCOMPLETE"));
    }

    setSaving(true);
    try {
      const animalsChanged = JSON.stringify(form.animals.map((a) => a.id).sort()) !== JSON.stringify(startAnimals.map((a) => a.id).sort());
      await updateApplication(application.id, {
        productId: form.productId,
        date: form.date,
        reapplyDate: form.needsReapply ? form.reapplyDate : null,
        notes: form.notes.trim() || undefined,
        batchNumber: form.batchNumber.trim() || null,
        doseAmount: dose,
        doseUnit: form.doseUnit || null,
        ...(animalsChanged ? { animalIds: form.animals.map((animal) => animal.id) } : {}),
      });
      invalidateReminderCount(); // o sino do topo recalcula
      onSaved();
    } catch (err) {
      setError(singleErrorMessage(err));
      setSaving(false);
    }
  }

  return (
    <ModalFrame title={t("application.editTitle")} onClose={onClose} dirty={dirty} busy={saving} size="lg">
      <form onSubmit={handleSave} noValidate>
        <fieldset className="mb-4">
          <legend className="block font-medium text-texto mb-1">{t("application.type")}</legend>
          <div className="grid grid-cols-2 gap-2">
            {PRODUCT_TYPES.map((value: ProductType) => (
              <button
                key={value}
                type="button"
                aria-pressed={form.type === value}
                onClick={() => setForm((prev) => ({ ...prev, type: value, productId: value === application.product.type ? application.productId : "" }))}
                className={`py-2.5 px-2 rounded-lg border text-sm font-medium cursor-pointer ${
                  form.type === value ? "bg-verde border-verde text-white" : "bg-card border-borda-chip text-texto-suave"
                }`}
              >
                {t(`product.type.${value}`)}
              </button>
            ))}
          </div>
        </fieldset>

        <div className="mb-4">
          <label htmlFor={`${formId}-product`} className="block font-medium text-texto mb-1">
            {t("application.product")} <span className="text-alerta">*</span>
          </label>
          <select
            id={`${formId}-product`}
            value={form.productId}
            onChange={(e) => set("productId", e.target.value)}
            className="w-full border border-borda rounded-lg px-3 py-2 text-texto cursor-pointer"
          >
            <option value="">{t("application.chooseProduct")}</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.archivedAt ? ` ${t("applicationDetail.archivedProduct")}` : ""}
              </option>
            ))}
          </select>
        </div>

        <div className="mb-4">
          <label htmlFor={`${formId}-date`} className="block font-medium text-texto mb-1">
            {t("application.date")} <span className="text-alerta">*</span>
          </label>
          <input
            id={`${formId}-date`}
            type="date"
            value={form.date}
            onChange={(e) => set("date", e.target.value)}
            className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
          />
        </div>

        <div className="mb-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.needsReapply}
              onChange={(e) => set("needsReapply", e.target.checked)}
              className="w-4 h-4 cursor-pointer accent-[#3B6D11]"
            />
            <span className="font-medium text-texto">{t("application.needsReapply")}</span>
          </label>
          {form.needsReapply && (
            <div className="mt-2">
              <label htmlFor={`${formId}-reapply`} className="block text-sm text-texto-suave mb-1">
                {t("application.reapplyDate")}
              </label>
              <input
                id={`${formId}-reapply`}
                type="date"
                value={form.reapplyDate}
                onChange={(e) => set("reapplyDate", e.target.value)}
                className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
              />
            </div>
          )}
        </div>

        <fieldset className="mb-4">
          <legend className="block font-medium text-texto mb-1">{t("application.dose")}</legend>
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor={`${formId}-dose`}>
              {t("application.doseAmount")}
            </label>
            <input
              id={`${formId}-dose`}
              inputMode="decimal"
              value={form.doseAmount}
              onChange={(e) => set("doseAmount", e.target.value)}
              className="w-28 border border-borda rounded-lg px-3 py-2 text-texto"
            />
            <label className="sr-only" htmlFor={`${formId}-unit`}>
              {t("application.doseUnit")}
            </label>
            <select
              id={`${formId}-unit`}
              value={form.doseUnit}
              onChange={(e) => set("doseUnit", e.target.value as DoseUnit | "")}
              className="border border-borda rounded-lg px-3 py-2 text-texto cursor-pointer"
            >
              <option value="">{t("application.doseUnit")}</option>
              {DOSE_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {t(`product.doseUnit.${unit}`)}
                </option>
              ))}
            </select>
          </div>
        </fieldset>

        <div className="mb-4">
          <label htmlFor={`${formId}-batch`} className="block font-medium text-texto mb-1">
            {t("application.batchNumber")}
          </label>
          <input
            id={`${formId}-batch`}
            value={form.batchNumber}
            maxLength={50}
            onChange={(e) => set("batchNumber", e.target.value)}
            className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
          />
        </div>

        <div className="mb-4">
          <label htmlFor={`${formId}-notes`} className="block font-medium text-texto mb-1">
            {t("application.notes")}
          </label>
          <input
            id={`${formId}-notes`}
            value={form.notes}
            onChange={(e) => set("notes", e.target.value)}
            placeholder={t("application.notesPlaceholder")}
            className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
          />
        </div>

        {/* Animais (RN-SAN-011): tirar e incluir */}
        <fieldset className="mb-5">
          <legend className="block font-medium text-texto mb-1">
            {t("application.editAnimals")} ({form.animals.length})
          </legend>
          <ul className="flex flex-wrap gap-2 mb-3">
            {form.animals.map((animal) => (
              <li key={animal.id}>
                <button
                  type="button"
                  onClick={() => set("animals", form.animals.filter((kept) => kept.id !== animal.id))}
                  aria-label={t("application.removeAnimal", { tag: animal.tag })}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-borda-chip bg-bege text-sm text-texto cursor-pointer"
                >
                  {animal.tag} <X size={14} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
          {removed.length > 0 && (
            <p className="text-sm text-texto-suave mb-2">{t("application.removedNote", { count: removed.length })}</p>
          )}
          <div className="flex flex-wrap gap-2">
            <label className="sr-only" htmlFor={`${formId}-add`}>
              {t("application.addAnimal")}
            </label>
            <input
              id={`${formId}-add`}
              list={`${formId}-active`}
              value={addTag}
              onChange={(e) => setAddTag(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addAnimal();
                }
              }}
              placeholder={t("application.addAnimalPlaceholder")}
              className="flex-1 min-w-[10rem] border border-borda rounded-lg px-3 py-2 text-texto"
            />
            <datalist id={`${formId}-active`}>
              {activeAnimals
                .filter((animal) => !form.animals.some((kept) => kept.id === animal.id))
                .map((animal) => (
                  <option key={animal.id} value={animal.tag} />
                ))}
            </datalist>
            <button type="button" onClick={addAnimal} className={buttonClass("secondary", "text-sm px-3 py-2")}>
              {t("application.addAnimal")}
            </button>
          </div>
          {addError && <p className="text-sm text-alerta mt-1">{addError}</p>}
        </fieldset>

        {error && <p role="alert" className="text-sm text-alerta mb-4">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={buttonClass("secondary")}>
            {t("common.cancel")}
          </button>
          <button type="submit" disabled={saving} className={buttonClass("primary")}>
            {saving ? t("common.saving") : t("application.saveChanges")}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}
