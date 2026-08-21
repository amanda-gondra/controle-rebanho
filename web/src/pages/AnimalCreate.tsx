import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { createAnimal } from "../services/animals.js";
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

export function AnimalCreate() {
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

  async function handleSubmit() {
    setErrors({});

    // validação simples no cliente (o backend também valida)
    const newErrors: Record<string, string> = {};
    if (!tag.trim()) newErrors.tag = "Informe o brinco do animal.";
    if (!sex) newErrors.sex = "Escolha o sexo.";
    if (!category) newErrors.category = "Escolha a categoria.";
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
        breed: breed.trim() || undefined,
        birthPrecision,
        birthDate: finalBirthDate,
        notes: notes.trim() || undefined,
      });
      showToast("Animal cadastrado com sucesso.");
      navigate("/");
    } catch (err: any) {
      if (err?.status === 409) {
        setErrors({ tag: "Já existe um animal com esse brinco. Confira o número." });
      } else if (Array.isArray(err?.errors)) {
        const mapped: Record<string, string> = {};
        for (const e of err.errors) mapped[e.field] = e.error;
        setErrors(mapped);
      } else {
        setErrors({ geral: err?.message ?? "Algo deu errado. Tente de novo." });
      }
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 p-8">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate("/")}
            title="Voltar para o rebanho"
            className="text-texto-suave hover:text-texto cursor-pointer"
          >
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="text-2xl font-medium text-texto">Cadastrar animal</h1>
            <p className="text-texto-suave">Preencha os dados do novo animal</p>
          </div>
        </div>

        <div className="bg-card border border-borda rounded-xl p-6 max-w-2xl">
          {/* Brinco */}
          <div className="mb-5">
            <label className="block font-medium text-texto mb-1">
              Brinco <span className="text-alerta">*</span>
            </label>
            <input
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              placeholder="Ex.: BR-004"
              className={`w-full border rounded-lg px-3 py-2 text-texto ${
                errors.tag ? "border-alerta" : "border-borda"
              }`}
            />
            {errors.tag ? (
              <p className="text-sm text-alerta mt-1">{errors.tag}</p>
            ) : (
              <p className="text-sm text-texto-leve mt-1">
                O número da etiqueta do animal. Não pode repetir.
              </p>
            )}
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

            <p className="text-sm text-texto-leve mt-2">
              Se o bezerro nasceu no pasto e você não viu o dia, tudo bem — escolha a
              opção que combina.
            </p>
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

          {/* Botões */}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => navigate("/")}
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
              {saving ? "Salvando..." : "Salvar animal"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}