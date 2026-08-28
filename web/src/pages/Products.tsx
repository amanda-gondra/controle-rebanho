import { useEffect, useState } from "react";
import { Plus, Syringe, Pill } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { listProducts, createProduct } from "../services/sanitary.js";
import type { Product, ProductType } from "../types/animal.js";
import { useToast } from "../components/ToastProvider.js";

export function Products() {
  const showToast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  // formulário
  const [name, setName] = useState("");
  const [type, setType] = useState<ProductType>("VACCINE");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function loadProducts() {
    setLoading(true);
    listProducts()
      .then((data) => setProducts(data))
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError("Informe o nome do produto.");

    setSaving(true);
    try {
      await createProduct({ name: name.trim(), type });
      setName("");
      loadProducts();
      showToast("Produto cadastrado.");
    } catch (err: any) {
      setError(err?.message ?? "Algo deu errado. Tente de novo.");
    } finally {
      setSaving(false);
    }
  }

  const vaccines = products.filter((p) => p.type === "VACCINE");
  const dewormers = products.filter((p) => p.type === "DEWORMER");

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 p-4 pb-24 md:p-8">
        <div className="mb-6">
          <h1 className="text-2xl font-medium text-texto">Produtos</h1>
          <p className="text-texto-suave">
            Cadastre as vacinas e vermífugos que você usa
          </p>
        </div>

        {/* Formulário de cadastro */}
        <div className="bg-card border border-borda rounded-xl p-6 max-w-2xl mb-8">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="block font-medium text-texto mb-1">
                Nome do produto <span className="text-alerta">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Vacina Aftosa"
                autoFocus
                className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
              />
            </div>

            <div className="mb-5">
              <label className="block font-medium text-texto mb-1">Tipo</label>
              <div className="flex gap-3">
                {(
                  [
                    ["VACCINE", "Vacina"],
                    ["DEWORMER", "Vermífugo"],
                  ] as const
                ).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setType(value)}
                    className={`flex-1 py-2.5 rounded-lg border font-medium cursor-pointer ${
                      type === value
                        ? "bg-verde border-verde text-white"
                        : "bg-card border-borda-chip text-texto-suave"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-sm text-alerta mb-4">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 bg-verde text-white font-medium px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-60"
            >
              <Plus size={18} /> {saving ? "Cadastrando..." : "Cadastrar produto"}
            </button>
          </form>
        </div>

        {/* Listas de produtos */}
        {loading ? (
          <p className="text-texto-suave">Carregando...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
            {/* Vacinas */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Syringe size={18} className="text-verde" />
                <h2 className="font-medium text-texto">Vacinas</h2>
              </div>
              {vaccines.length === 0 ? (
                <p className="text-texto-leve text-sm">
                  Nenhuma vacina cadastrada.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {vaccines.map((p) => (
                    <div
                      key={p.id}
                      className="bg-card border border-borda rounded-lg px-4 py-2.5 text-texto"
                    >
                      {p.name}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Vermífugos */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Pill size={18} className="text-verde" />
                <h2 className="font-medium text-texto">Vermífugos</h2>
              </div>
              {dewormers.length === 0 ? (
                <p className="text-texto-leve text-sm">
                  Nenhum vermífugo cadastrado.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {dewormers.map((p) => (
                    <div
                      key={p.id}
                      className="bg-card border border-borda rounded-lg px-4 py-2.5 text-texto"
                    >
                      {p.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}