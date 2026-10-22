import { useCallback, useEffect, useState, useId } from "react";
import { useParams } from "react-router-dom";
import { Sidebar } from "../components/Sidebar.js";
import { getAnimal, updateAnimal } from "../services/animals.js";
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
import { LoadError } from "../components/LoadError.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useOrigin } from "../navigation/hooks.js";
import { useUnsavedChanges } from "../navigation/useUnsavedChanges.js";
import { OriginFields, type EditableOrigin } from "../components/OriginFields.js";
import { todayInTimeZone } from "../types/format.js";
import type { AnimalOrigin } from "../types/animal.js";

type BirthKnowledge = "" | "DAY" | "MONTH" | "UNKNOWN";

const sexOptions: Sex[] = ["MALE", "FEMALE"];

export function AnimalEdit() {
  const formId = useId(); // liga cada rótulo ao seu campo (leitor de tela, clique no rótulo)
  const { id } = useParams();
  // Sem origem (link direto), voltar/cancelar/salvar levam à ficha do animal
  const { goBack } = useOrigin(`/animais/${id}`);
  const showToast = useToast();
  const { account } = useAuth();
  const defaultCastrated = account?.farm.settings.defaultCastrated ?? false;

  const [tag, setTag] = useState("");
  const [sex, setSex] = useState<Sex | "">("");
  const [category, setCategory] = useState<Category | "">("");
  const [castrated, setCastrated] = useState(false);
  const [breed, setBreed] = useState("");
  const [birthKnowledge, setBirthKnowledge] = useState<BirthKnowledge>("");
  const [birthDate, setBirthDate] = useState("");
  const [birthMonth, setBirthMonth] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [notes, setNotes] = useState("");
  const [origin, setOrigin] = useState<AnimalOrigin>("NOT_INFORMED");
  const [entryDate, setEntryDate] = useState("");
  const today = todayInTimeZone(account?.farm.timezone ?? "America/Sao_Paulo");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  // Retrato do formulário logo depois de carregar: diferente dele = alterações não salvas
  const [initialSnapshot, setInitialSnapshot] = useState<string | null>(null);
  const snapshot = JSON.stringify([sex, category, castrated, breed, birthKnowledge, birthDate, birthMonth, birthYear, notes, origin, entryDate]);
  const dirty = initialSnapshot !== null && snapshot !== initialSnapshot;
  const { allowLeave, dialog: unsavedDialog } = useUnsavedChanges(dirty && !saving);

  // O retrato é tirado depois que os campos carregados chegam à tela
  const [captureSnapshot, setCaptureSnapshot] = useState(false);
  useEffect(() => {
    if (!captureSnapshot) return;
    setInitialSnapshot(snapshot);
    setCaptureSnapshot(false);
  }, [captureSnapshot, snapshot]);

  // Busca o animal e preenche o formulário
  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    setLoadError("");
    getAnimal(id)
      .then((animal) => {
        setTag(animal.tag);
        setSex(animal.sex);
        setCategory(animal.category);
        setCastrated(animal.castrated ?? defaultCastrated);
        setBreed(animal.breed ?? "");
        setNotes(animal.notes ?? "");
        setOrigin(animal.origin);
        setEntryDate(animal.entryDate ? animal.entryDate.slice(0, 10) : "");
        if (animal.birthPrecision === "DAY_MONTH_YEAR" && animal.birthDate) {
          setBirthKnowledge("DAY");
          setBirthDate(animal.birthDate.slice(0, 10));
        } else if (animal.birthPrecision === "MONTH_YEAR" && animal.birthDate) {
          setBirthKnowledge("MONTH");
          setBirthMonth(animal.birthDate.slice(5, 7));
          setBirthYear(animal.birthDate.slice(0, 4));
        } else {
          setBirthKnowledge("UNKNOWN");
        }
        setCaptureSnapshot(true);
      })
      .catch((err) => setLoadError(errorMessage(err, "animalDetail.loadFailed")))
      .finally(() => setLoading(false));
  }, [id, defaultCastrated]);

  useEffect(load, [load]);

  // Corrigir o sexo apaga a categoria se ela deixar de combinar: a pessoa
  // precisa escolher de novo antes de salvar (Espec — Animais, critério 15)
  function handleSexChange(newSex: Sex) {
    setSex(newSex);
    if (category && !isCategoryCompatible(category, newSex)) setCategory("");
  }

  async function handleSubmit() {
    if (!id) return;
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!sex) newErrors.sex = t("animal.form.sexRequired");
    if (!category) newErrors.category = t("animal.form.categoryRequired");
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

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
      await updateAnimal(id, {
        sex: sex as Sex,
        category: category as Category,
        ...(sex === "MALE" ? { castrated } : {}),
        breed: breed.trim() || undefined,
        birthPrecision,
        birthDate: finalBirthDate,
        notes: notes.trim() || undefined,
        // Com compra registrada, origem e entrada vêm da compra (não vão)
        ...(origin !== "PURCHASED" ? { origin, entryDate: entryDate || null } : {}),
      });
      showToast(t("animal.form.saved"));
      allowLeave();
      goBack();
    } catch (err) {
      setErrors(fieldErrorsOf(err) ?? { geral: errorMessage(err) });
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bege flex">
        <Sidebar />
        <main className="flex-1 p-4 pb-24 md:p-8">
          <p className="text-texto-suave" aria-busy="true">{t("common.loading")}</p>
        </main>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-bege flex">
        <Sidebar />
        <main className="flex-1 p-4 pb-24 md:p-8">
          <PageHeader title={t("animal.form.editTitle")} backFallback={`/animais/${id}`} backLabel={t("animal.form.backToAnimal")} />
          <LoadError message={loadError} onRetry={load} />
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 p-4 pb-24 md:p-8">
        <PageHeader
          title={t("animal.form.editTitle")}
          subtitle={t("animal.form.editSubtitle")}
          backFallback={`/animais/${id}`}
          backLabel={t("animal.form.backToAnimal")}
        />

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px] items-start max-w-6xl">
          <div className="bg-card border border-borda rounded-xl p-6">
            <FormSection step={1} title={t("animal.form.section.identification")} help={t("animal.form.section.identificationHelp")}>
              <div className="grid gap-x-6 md:grid-cols-2">
                {/* Brinco (somente leitura) */}
                <div className="mb-5">
                  <label htmlFor={`${formId}-1`} className="block font-medium text-texto mb-1">{t("animal.form.tag")}</label>
                  <input id={`${formId}-1`}
                    value={tag}
                    disabled
                    className="w-full border border-borda rounded-lg px-3 py-2 bg-bege text-texto-suave cursor-not-allowed"
                  />
                  <p className="text-sm text-texto-leve mt-1">
                    {t("animal.form.tagReadOnly")}
                  </p>
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
                </div>
              </div>
            </FormSection>
            <FormSection step={3} title={t("animal.form.section.entry")} help={t("animal.form.section.entryHelp")}>

              {/* Origem e entrada (D-52) */}
              <OriginFields
                origin={origin}
                entryDate={entryDate}
                onOriginChange={(value: EditableOrigin) => setOrigin(value)}
                onEntryDateChange={setEntryDate}
                error={errors.entryDate ?? errors.origin}
                max={today}
                fromPurchase={origin === "PURCHASED" ? { entryDate: entryDate || null } : undefined}
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

          <div className="flex justify-between gap-3 pt-5 border-t border-borda">
            <button type="button" onClick={goBack} className={buttonClass("secondary")}>
              {t("common.cancel")}
            </button>
            <button type="button" onClick={handleSubmit} disabled={saving} className={buttonClass("primary")}>
              <Save size={18} aria-hidden="true" />
              {saving ? t("common.saving") : t("animal.form.saveChanges")}
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