import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { getAnimal, updateAnimal } from "../services/animals.js";
import type { Sex, Category, BirthPrecision } from "../types/animal.js";
import { useToast } from "../components/ToastProvider.js";
import { useAuth } from "../components/AuthProvider.js";
import { CategoryPicker } from "../components/CategoryPicker.js";
import { isCategoryCompatible } from "../types/categories.js";
import { t } from "../i18n/index.js";
import { errorMessage, fieldErrorsOf } from "../i18n/errors.js";
import { monthNames } from "../types/format.js";
import { sexLabel } from "../types/labels.js";

type BirthKnowledge = "" | "DAY" | "MONTH" | "UNKNOWN";

const sexOptions: Sex[] = ["MALE", "FEMALE"];

export function AnimalEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
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

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  // Busca o animal e preenche o formulário
  useEffect(() => {
    if (!id) return;
    getAnimal(id)
      .then((animal) => {
        setTag(animal.tag);
        setSex(animal.sex);
        setCategory(animal.category);
        setCastrated(animal.castrated ?? defaultCastrated);
        setBreed(animal.breed ?? "");
        setNotes(animal.notes ?? "");
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
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [id, defaultCastrated]);

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
      });
      showToast(t("animal.form.saved"));
      navigate(`/animais/${id}`);
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
          <p className="text-texto-suave">{t("common.loading")}</p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate(`/animais/${id}`)}
            title={t("animal.form.backToAnimal")}
            aria-label={t("animal.form.backToAnimal")}
            className="text-texto-suave hover:text-texto cursor-pointer"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-2xl font-medium text-texto">{t("animal.form.editTitle")}</h1>
            <p className="text-texto-suave">{t("animal.form.editSubtitle")}</p>
          </div>
        </div>

        <div className="bg-card border border-borda rounded-xl p-6 max-w-2xl">
          {/* Brinco (somente leitura) */}
          <div className="mb-5">
            <label className="block font-medium text-texto mb-1">{t("animal.form.tag")}</label>
            <input
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
                  className={`flex-1 py-2.5 rounded-lg border font-medium cursor-pointer ${
                    sex === value
                      ? "bg-verde border-verde text-white"
                      : "bg-card border-borda-chip text-texto-suave"
                  }`}
                >
                  {sexLabel[value]}
                </button>
              ))}
            </div>
            {errors.sex && <p className="text-sm text-alerta mt-1">{errors.sex}</p>}
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

          {/* Raça */}
          <div className="mb-5">
            <label className="block font-medium text-texto mb-1">
              {t("animal.form.breed")}{" "}
              <span className="text-texto-leve font-normal">{t("common.optional")}</span>
            </label>
            <input
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
                className="border border-borda rounded-lg px-3 py-2 text-texto"
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

          {/* Observações */}
          <div className="mb-6">
            <label className="block font-medium text-texto mb-1">
              {t("animal.form.notes")}{" "}
              <span className="text-texto-leve font-normal">{t("common.optional")}</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("animal.form.notesPlaceholder")}
              rows={3}
              className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
            />
          </div>

          {errors.geral && <p className="text-sm text-alerta mb-4">{errors.geral}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate(`/animais/${id}`)}
              className="px-4 py-2.5 rounded-xl border border-borda-chip text-texto-suave font-medium cursor-pointer"
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-verde text-white font-medium cursor-pointer disabled:opacity-60"
            >
              {saving ? t("common.saving") : t("animal.form.saveChanges")}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}