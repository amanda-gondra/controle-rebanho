import { useState, useId } from "react";
import { useSearchParams } from "react-router-dom";
import { Sidebar } from "../components/Sidebar.js";
import { createAnimal } from "../services/animals.js";
import type { Sex, Category, BirthPrecision } from "../types/animal.js";
import { useToast } from "../components/ToastProvider.js";
import { useAuth } from "../components/AuthProvider.js";
import { Save } from "lucide-react";
import { SexIcon } from "../components/ui/SexIcon.js";
import { FormSection } from "../components/ui/FormSection.js";
import { AnimalFormHelp } from "../components/AnimalFormHelp.js";
import { CategoryPicker } from "../components/CategoryPicker.js";
import { isCategoryCompatible } from "../types/categories.js";
import { t } from "../i18n/index.js";
import { errorMessage, fieldErrorsOf } from "../i18n/errors.js";
import { monthNames } from "../types/format.js";
import { sexLabel } from "../types/labels.js";
import { PageHeader } from "../components/PageHeader.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useOrigin } from "../navigation/hooks.js";
import { OriginFields, type EditableOrigin } from "../components/OriginFields.js";
import { todayInTimeZone } from "../types/format.js";
import { useUnsavedChanges } from "../navigation/useUnsavedChanges.js";

type BirthKnowledge = "" | "DAY" | "MONTH" | "UNKNOWN";

const sexOptions: Sex[] = ["MALE", "FEMALE"];

export function AnimalCreate() {
  const formId = useId(); // liga cada rótulo ao seu campo (leitor de tela, clique no rótulo)
  const { goBack } = useOrigin("/");
  const showToast = useToast();
  const { account } = useAuth();

  // Vindo da pesagem em sequência com um brinco que não existe: já preenchido
  const [params] = useSearchParams();
  const [initialTag] = useState(() => (params.get("brinco") ?? "").slice(0, 50));
  const [tag, setTag] = useState(initialTag);
  const [sex, setSex] = useState<Sex | "">("");
  const [category, setCategory] = useState<Category | "">("");
  // Castrado começa com o padrão da fazenda (Configurações → Animais)
  const [castrated, setCastrated] = useState(account?.farm.settings.defaultCastrated ?? false);
  const [breed, setBreed] = useState("");
  const [birthKnowledge, setBirthKnowledge] = useState<BirthKnowledge>("");
  const [birthDate, setBirthDate] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [notes, setNotes] = useState("");
  const [origin, setOrigin] = useState<EditableOrigin>("NOT_INFORMED");
  const [entryDate, setEntryDate] = useState("");
  const today = todayInTimeZone(account?.farm.timezone ?? "America/Sao_Paulo");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const defaultCastrated = account?.farm.settings.defaultCastrated ?? false;
  const dirty =
    tag !== initialTag || sex !== "" || category !== "" || castrated !== defaultCastrated || breed !== "" ||
    birthKnowledge !== "" || birthDate !== "" || birthMonth !== "" || birthYear !== "" || notes !== "" ||
    origin !== "NOT_INFORMED" || entryDate !== "";
  const { allowLeave, dialog: unsavedDialog } = useUnsavedChanges(dirty && !saving);

  // Trocar o sexo apaga a categoria escolhida se ela deixar de combinar
  // (ex.: "garrote" e depois "fêmea")
  function handleSexChange(newSex: Sex) {
    setSex(newSex);
    if (category && !isCategoryCompatible(category, newSex)) setCategory("");
  }

  async function handleSubmit() {
    setErrors({});

    // validação simples no cliente (o backend também valida)
    const newErrors: Record<string, string> = {};
    if (!tag.trim()) newErrors.tag = t("animal.form.tagRequired");
    if (!sex) newErrors.sex = t("animal.form.sexRequired");
    if (!category) newErrors.category = t("animal.form.categoryRequired");
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    // monta a data conforme a precisão escolhida
    let birthPrecision: BirthPrecision = "UNKNOWN";
    let finalBirthDate: string | undefined;
    if (birthKnowledge === "DAY" && birthDate) {
      birthPrecision = "DAY_MONTH_YEAR";
      finalBirthDate = birthDate;
    } else if (birthKnowledge === "MONTH" && birthMonth && birthYear) {
      birthPrecision = "MONTH_YEAR";
      finalBirthDate = `${birthYear}-${birthMonth}-01`;
    }

    setSaving(true);
    try {
      await createAnimal({
        tag: tag.trim(),
        sex: sex as Sex,
        category: category as Category,
        ...(sex === "MALE" ? { castrated } : {}),
        breed: breed.trim() || undefined,
        birthPrecision,
        birthDate: finalBirthDate,
        notes: notes.trim() || undefined,
        origin,
        entryDate: entryDate || undefined,
      });
      showToast(t("animal.form.created"));
      allowLeave();
      goBack();
    } catch (err) {
      const fields = fieldErrorsOf(err);
      if ((err as { code?: string })?.code === "DUPLICATE_TAG") {
        setErrors({ tag: errorMessage(err) });
      } else if (fields) {
        setErrors(fields);
      } else {
        setErrors({ geral: errorMessage(err) });
      }
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 p-4 pb-24 md:p-8">
        <PageHeader
          title={t("animal.form.createTitle")}
          subtitle={t("animal.form.createSubtitle")}
          backFallback="/"
          backLabel={t("animal.form.backToHerd")}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] items-start max-w-6xl">
          <div className="bg-card border border-borda rounded-xl p-6">
            <FormSection step={1} title={t("animal.form.section.identification")} help={t("animal.form.section.identificationHelp")}>
              <div className="grid gap-x-6 md:grid-cols-2">
                {/* Brinco */}
                <div className="mb-5">
                  <label htmlFor={`${formId}-1`} className="block font-medium text-texto mb-1">
                    {t("animal.form.tag")} <span className="text-alerta">*</span>
                  </label>
                  <input id={`${formId}-1`}
                    value={tag}
                    onChange={(e) => setTag(e.target.value)}
                    placeholder={t("animal.form.tagPlaceholder")}
                    className={`w-full border rounded-lg px-3 py-2 text-texto ${
                      errors.tag ? "border-alerta" : "border-borda"
                    }`}
                  />
                  {errors.tag ? (
                    <p className="text-sm text-alerta mt-1">{errors.tag}</p>
                  ) : (
                    <p className="text-sm text-texto-leve mt-1">
                      {t("animal.form.tagHelp")}
                    </p>
                  )}
                </div>

                {/* Sexo */}
                <div className="mb-5">
                  <label className="block font-medium text-texto mb-1">
                    {t("animal.form.sex")} <span className="text-alerta">*</span>
                  </label>
                  <div className="flex gap-3">
                    {sexOptions.map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => handleSexChange(value)}
                        className={`flex-1 inline-flex items-center justify-center gap-2 py-2.5 rounded-lg border font-medium cursor-pointer ${
                          sex === value
                            ? "bg-verde-claro border-verde text-verde-escuro"
                            : "bg-card border-borda-chip text-texto-suave"
                        }`}
                      >
                        <SexIcon sex={value} />
                        {sexLabel[value]}
                      </button>
                    ))}
                  </div>
                  {errors.sex && <p className="text-sm text-alerta mt-1">{errors.sex}</p>}
                </div>
              </div>

              {/* Categoria (só as que combinam com o sexo) + castrado (só machos) — G4 */}
              <CategoryPicker
                sex={sex}
                category={category}
                onCategoryChange={setCategory}
                castrated={castrated}
                onCastratedChange={setCastrated}
                error={errors.category ?? errors.castrated}
              />

            </FormSection>
            <FormSection step={2} title={t("animal.form.section.info")} help={t("animal.form.section.infoHelp")}>
              <div className="grid gap-x-6 md:grid-cols-2">
                {/* Raça */}
                <div className="mb-5">
                  <label htmlFor={`${formId}-2`} className="block font-medium text-texto mb-1">
                    {t("animal.form.breed")}{" "}
                    <span className="text-texto-leve font-normal">{t("common.optional")}</span>
                  </label>
                  <input id={`${formId}-2`}
                    value={breed}
                    onChange={(e) => setBreed(e.target.value)}
                    placeholder={t("animal.form.breedPlaceholder")}
                    className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
                  />
                </div>

                {/* Data de nascimento */}
                <div className="mb-5">
                  <label className="block font-medium text-texto mb-1">
                    {t("animal.form.birthDate")}{" "}
                    <span className="text-texto-leve font-normal">{t("common.optional")}</span>
                  </label>
                  <p className="text-sm text-texto-suave mb-2">
                    {t("animal.form.birthQuestion")}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-2">
                    {(
                      [
                        ["DAY", t("animal.form.birthExact")],
                        ["MONTH", t("animal.form.birthMonthYear")],
                        ["UNKNOWN", t("animal.form.birthUnknown")],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setBirthKnowledge(value)}
                        className={`px-3 py-1.5 rounded-lg border text-sm cursor-pointer ${
                          birthKnowledge === value
                            ? "bg-verde-claro border-verde text-verde-escuro"
                            : "bg-card border-borda-chip text-texto-suave"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>

                  {birthKnowledge === "DAY" && (
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => setBirthDate(e.target.value)}
                      className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
                    />
                  )}

                  {birthKnowledge === "MONTH" && (
                    <div className="flex gap-3">
                      <select
                        value={birthMonth}
                        onChange={(e) => setBirthMonth(e.target.value)}
                        className="border border-borda rounded-lg px-3 py-2 text-texto cursor-pointer"
                      >
                        <option value="">{t("animal.form.month")}</option>
                        {monthNames().map((name, i) => (
                          <option key={name} value={String(i + 1).padStart(2, "0")}>
                            {name}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        value={birthYear}
                        onChange={(e) => setBirthYear(e.target.value)}
                        placeholder={t("animal.form.year")}
                        className="w-28 border border-borda rounded-lg px-3 py-2 text-texto"
                      />
                    </div>
                  )}

                  <p className="text-sm text-texto-leve mt-2">
                    {t("animal.form.birthHelp")}
                  </p>
                </div>
              </div>
            </FormSection>
            <FormSection step={3} title={t("animal.form.section.entry")} help={t("animal.form.section.entryHelp")}>

              {/* Origem e entrada (D-52) */}
              <OriginFields
                origin={origin}
                entryDate={entryDate}
                onOriginChange={setOrigin}
                onEntryDateChange={setEntryDate}
                error={errors.entryDate ?? errors.origin}
                max={today}
              />

            </FormSection>
            <FormSection step={4} title={t("animal.form.section.notes")}>
              {/* Observações */}
              <div className="mb-6">
                <label htmlFor={`${formId}-3`} className="block font-medium text-texto mb-1">
                  {t("animal.form.notes")}{" "}
                  <span className="text-texto-leve font-normal">{t("common.optional")}</span>
                </label>
                <textarea id={`${formId}-3`}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={t("animal.form.notesPlaceholder")}
                  rows={3}
                  className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
                />
              </div>

            </FormSection>

          {errors.geral && <p role="alert" className="text-sm text-alerta mb-4">{errors.geral}</p>}

          {/* Botões */}
          <div className="flex justify-between gap-3 pt-5 border-t border-borda">
            <button type="button" onClick={goBack} className={buttonClass("secondary")}>
              {t("common.cancel")}
            </button>
            <button type="button" onClick={handleSubmit} disabled={saving} className={buttonClass("primary")}>
              <Save size={18} aria-hidden="true" />
              {saving ? t("common.saving") : t("animal.form.saveNew")}
            </button>
          </div>
          </div>
          <AnimalFormHelp />
        </div>
        {unsavedDialog}
      </main>
    </div>
  );
}