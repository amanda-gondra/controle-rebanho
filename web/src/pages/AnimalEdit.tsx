import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { getAnimal, updateAnimal } from "../services/animals.js";
import type { Sex, Category, BirthPrecision } from "../types/animal.js";
import { useToast } from "../components/ToastProvider.js";

type BirthKnowledge = "" | "DAY" | "MONTH" | "UNKNOWN";

const sexOptions: { value: Sex; label: string }[] = [
  { value: "MALE", label: "Macho" },
  { value: "FEMALE", label: "Fêmea" },
];

const categoryOptions: { value: Category; label: string }[] = [
  { value: "CALF", label: "Bezerro" },
  { value: "YEARLING", label: "Novilho" },
  { value: "STEER", label: "Boi" },
  { value: "COW", label: "Vaca" },
];

const months = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

export function AnimalEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const showToast = useToast();

  const [tag, setTag] = useState("");
  const [sex, setSex] = useState<Sex | "">("");
  const [category, setCategory] = useState<Category | "">("");
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
  }, [id]);

  async function handleSubmit() {
    if (!id) return;
    setErrors({});

    const newErrors: Record<string, string> = {};
    if (!sex) newErrors.sex = "Escolha o sexo.";
    if (!category) newErrors.category = "Escolha a categoria.";
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
        breed: breed.trim() || undefined,
        birthPrecision,
        birthDate: finalBirthDate,
        notes: notes.trim() || undefined,
      });
      showToast("Alterações salvas.");
      navigate(`/animais/${id}`);
    } catch (err: any) {
      if (Array.isArray(err?.errors)) {
        const mapped: Record<string, string> = {};
        for (const e of err.errors) mapped[e.field] = e.error;
        setErrors(mapped);
      } else {
        setErrors({ geral: err?.message ?? "Algo deu errado. Tente de novo." });
      }
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bege flex">
        <Sidebar />
        <main className="flex-1 p-4 pb-24 md:p-8">
          <p className="text-texto-suave">Carregando...</p>
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
            title="Voltar para a ficha"
            className="text-texto-suave hover:text-texto cursor-pointer"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-2xl font-medium text-texto">Editar animal</h1>
            <p className="text-texto-suave">Atualize os dados do animal</p>
          </div>
        </div>

        <div className="bg-card border border-borda rounded-xl p-6 max-w-2xl">
          {/* Brinco (somente leitura) */}
          <div className="mb-5">
            <label className="block font-medium text-texto mb-1">Brinco</label>
            <input
              value={tag}
              disabled
              className="w-full border border-borda rounded-lg px-3 py-2 bg-bege text-texto-suave cursor-not-allowed"
            />
            <p className="text-sm text-texto-leve mt-1">
              O brinco não pode ser alterado.
            </p>
          </div>

          {/* Sexo */}
          <div className="mb-5">
            <label className="block font-medium text-texto mb-1">
              Sexo <span className="text-alerta">*</span>
            </label>
            <div className="flex gap-3">
              {sexOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSex(opt.value)}
                  className={`flex-1 py-2.5 rounded-lg border font-medium cursor-pointer ${
                    sex === opt.value
                      ? "bg-verde border-verde text-white"
                      : "bg-card border-borda-chip text-texto-suave"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {errors.sex && <p className="text-sm text-alerta mt-1">{errors.sex}</p>}
          </div>

          {/* Categoria */}
          <div className="mb-5">
            <label className="block font-medium text-texto mb-1">
              Categoria <span className="text-alerta">*</span>
            </label>
            <div className="grid grid-cols-2 gap-3">
              {categoryOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setCategory(opt.value)}
                  className={`py-2.5 rounded-lg border font-medium cursor-pointer ${
                    category === opt.value
                      ? "bg-verde border-verde text-white"
                      : "bg-card border-borda-chip text-texto-suave"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            {errors.category && (
              <p className="text-sm text-alerta mt-1">{errors.category}</p>
            )}
          </div>

          {/* Raça */}
          <div className="mb-5">
            <label className="block font-medium text-texto mb-1">
              Raça <span className="text-texto-leve font-normal">(opcional)</span>
            </label>
            <input
              value={breed}
              onChange={(e) => setBreed(e.target.value)}
              placeholder="Ex.: Nelore"
              className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
            />
          </div>

          {/* Data de nascimento */}
          <div className="mb-5">
            <label className="block font-medium text-texto mb-1">
              Data de nascimento{" "}
              <span className="text-texto-leve font-normal">(opcional)</span>
            </label>
            <p className="text-sm text-texto-suave mb-2">
              Você sabe a data de nascimento?
            </p>
            <div className="flex flex-wrap gap-2 mb-2">
              {(
                [
                  ["DAY", "Sei o dia certo"],
                  ["MONTH", "Só o mês e o ano"],
                  ["UNKNOWN", "Não sei ao certo"],
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
                  <option value="">Mês</option>
                  {months.map((name, i) => (
                    <option key={name} value={String(i + 1).padStart(2, "0")}>
                      {name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={birthYear}
                  onChange={(e) => setBirthYear(e.target.value)}
                  placeholder="Ano"
                  className="w-28 border border-borda rounded-lg px-3 py-2 text-texto"
                />
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="mb-6">
            <label className="block font-medium text-texto mb-1">
              Observações{" "}
              <span className="text-texto-leve font-normal">(opcional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anotações sobre o animal (opcional)"
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
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-verde text-white font-medium cursor-pointer disabled:opacity-60"
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}