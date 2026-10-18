import { useEffect, useState, useId } from "react";
import { Plus, Syringe, Pill } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { listProducts, createProduct } from "../services/sanitary.js";
import type { Product, ProductType } from "../types/animal.js";
import { useToast } from "../components/ToastProvider.js";
import { t } from "../i18n/index.js";
import { errorMessage, singleErrorMessage } from "../i18n/errors.js";
import { PageHeader } from "../components/PageHeader.js";
import { LoadError } from "../components/LoadError.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useUnsavedChanges } from "../navigation/useUnsavedChanges.js";

export function Products() {
  const formId = useId(); // liga cada rótulo ao seu campo (leitor de tela, clique no rótulo)
  const showToast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  // formulário
  const [name, setName] = useState("");
  const [type, setType] = useState<ProductType>("VACCINE");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // Nome digitado e ainda não cadastrado
  const { dialog: unsavedDialog } = useUnsavedChanges(name.trim() !== "" && !saving);

  function loadProducts() {
    setLoading(true);
    setLoadError("");
    listProducts()
      .then((data) => setProducts(data))
      .catch((err) => setLoadError(errorMessage(err, "products.loadFailed")))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadProducts();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return setError(t("products.nameRequired"));

    setSaving(true);
    try {
      await createProduct({ name: name.trim(), type });
      setName("");
      loadProducts();
      showToast(t("products.created"));
    } catch (err) {
      setError(singleErrorMessage(err));
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
        <PageHeader
          title={t("products.title")}
          subtitle={t("products.subtitle")}
          backFallback="/manejo"
          backLabel={t("application.back")}
        />

        {/* Formulário de cadastro */}
        <div className="bg-card border border-borda rounded-xl p-6 max-w-2xl mb-8">
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label htmlFor={`${formId}-1`} className="block font-medium text-texto mb-1">
                {t("products.name")} <span className="text-alerta">*</span>
              </label>
              <input id={`${formId}-1`}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("products.namePlaceholder")}
                autoFocus
                className="w-full border border-borda rounded-lg px-3 py-2 text-texto"
              />
            </div>

            <div className="mb-5">
              <label className="block font-medium text-texto mb-1">{t("products.type")}</label>
              <div className="flex gap-3">
                {(["VACCINE", "DEWORMER"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={type === value}
                    onClick={() => setType(value)}
                    className={`flex-1 py-2.5 rounded-lg border font-medium cursor-pointer ${
                      type === value
                        ? "bg-verde border-verde text-white"
                        : "bg-card border-borda-chip text-texto-suave"
                    }`}
                  >
                    {t(`product.type.${value}`)}
                  </button>
                ))}
              </div>
            </div>

            {error && <p role="alert" className="text-sm text-alerta mb-4">{error}</p>}

            <button type="submit" disabled={saving} className={buttonClass("primary")}>
              <Plus size={18} aria-hidden="true" /> {saving ? t("products.creating") : t("products.create")}
            </button>
          </form>
        </div>

        {/* Listas de produtos */}
        {loading ? (
          <p className="text-texto-suave" aria-busy="true">{t("common.loading")}</p>
        ) : loadError ? (
          <div className="max-w-2xl">
            <LoadError message={loadError} onRetry={loadProducts} />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl">
            {/* Vacinas */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Syringe size={18} className="text-verde" />
                <h2 className="font-medium text-texto">{t("products.vaccines")}</h2>
              </div>
              {vaccines.length === 0 ? (
                <p className="text-texto-leve text-sm">
                  {t("products.noVaccines")}
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
                <h2 className="font-medium text-texto">{t("products.dewormers")}</h2>
              </div>
              {dewormers.length === 0 ? (
                <p className="text-texto-leve text-sm">
                  {t("products.noDewormers")}
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
        {unsavedDialog}
      </main>
    </div>
  );
}