import { useCallback, useEffect, useState } from "react";
import { Archive, ArchiveRestore, Pencil, Plus, Trash2 } from "lucide-react";
import { Sidebar } from "../components/Sidebar.js";
import { PageHeader } from "../components/PageHeader.js";
import { LoadError } from "../components/LoadError.js";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { ProductModal } from "../components/ProductModal.js";
import { ProductTypeIcon } from "../components/ProductTypeIcon.js";
import { buttonClass } from "../components/buttonStyles.js";
import { useToast } from "../components/ToastProvider.js";
import { deleteProduct, listProducts, setProductArchived } from "../services/sanitary.js";
import { PRODUCT_TYPES, type Product } from "../types/animal.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";

// Produtos sanitários (F-18, F-SAN-05): lista por tipo com para que serve,
// carência e uso; cadastrar, editar, arquivar (some da seleção, o histórico
// continua) e excluir só o que nunca foi usado.

export function Products() {
  const showToast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [editing, setEditing] = useState<Product | "new" | null>(null);
  const [deleting, setDeleting] = useState<Product | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const load = useCallback(() => {
    setLoading(true);
    setLoadError("");
    listProducts(undefined, true)
      .then(setProducts)
      .catch((err) => setLoadError(errorMessage(err, "products.loadFailed")))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function toggleArchived(product: Product) {
    try {
      await setProductArchived(product.id, !product.archivedAt);
      showToast(t(product.archivedAt ? "products.restoredToast" : "products.archivedToast"));
      load();
    } catch (err) {
      showToast(errorMessage(err, "products.actionFailed"));
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    setActionError("");
    try {
      await deleteProduct(deleting.id);
      showToast(t("products.deleted"));
      setDeleting(null);
      load();
    } catch (err) {
      setActionError(errorMessage(err, "products.actionFailed"));
    } finally {
      setBusy(false);
    }
  }

  const active = products.filter((product) => !product.archivedAt);
  const archived = products.filter((product) => product.archivedAt);

  const row = (product: Product) => (
    <li key={product.id} className="flex flex-wrap items-center gap-3 py-3">
      <ProductTypeIcon type={product.type} />
      <div className="flex-1 min-w-[10rem]">
        <p className="font-medium text-texto">
          {product.name}
          {product.archivedAt && <span className="ml-2 text-xs text-texto-leve">{t("products.archived")}</span>}
        </p>
        <p className="text-xs text-texto-suave">
          {[
            product.purpose,
            product.withdrawalDays == null
              ? t("product.withdrawal.notInformed")
              : t("product.withdrawal.days", { count: product.withdrawalDays }),
            product.usageCount ? t("products.usage", { count: product.usageCount }) : t("products.unused"),
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setEditing(product)}
          aria-label={`${t("products.edit")} ${product.name}`}
          className={buttonClass("secondary", "text-sm px-3 py-2")}
        >
          <Pencil size={15} aria-hidden="true" /> {t("products.edit")}
        </button>
        <button
          type="button"
          onClick={() => toggleArchived(product)}
          aria-label={`${product.archivedAt ? t("products.unarchive") : t("products.archive")} ${product.name}`}
          className={buttonClass("secondary", "text-sm px-3 py-2")}
        >
          {product.archivedAt ? <ArchiveRestore size={15} aria-hidden="true" /> : <Archive size={15} aria-hidden="true" />}{" "}
          {product.archivedAt ? t("products.unarchive") : t("products.archive")}
        </button>
        {!product.usageCount && (
          <button
            type="button"
            onClick={() => setDeleting(product)}
            aria-label={`${t("products.delete")} ${product.name}`}
            className={buttonClass("dangerOutline", "text-sm px-3 py-2")}
          >
            <Trash2 size={15} aria-hidden="true" /> {t("products.delete")}
          </button>
        )}
      </div>
    </li>
  );

  return (
    <div className="min-h-screen bg-bege flex">
      <Sidebar />
      <main className="flex-1 min-w-0 p-4 pb-24 md:p-8">
        <PageHeader
          title={t("products.title")}
          subtitle={t("products.subtitle")}
          backFallback="/manejo"
          backLabel={t("application.back")}
          actions={
            <button type="button" onClick={() => setEditing("new")} className={buttonClass("primary")}>
              <Plus size={18} aria-hidden="true" /> {t("products.new")}
            </button>
          }
        />

        {loading && products.length === 0 ? (
          <p className="text-texto-suave" aria-busy="true">{t("common.loading")}</p>
        ) : loadError ? (
          <div className="max-w-3xl">
            <LoadError message={loadError} onRetry={load} />
          </div>
        ) : products.length === 0 ? (
          <div className="bg-card border border-borda rounded-xl p-10 text-center max-w-xl">
            <p className="text-texto mb-4">{t("products.empty")}</p>
            <button type="button" onClick={() => setEditing("new")} className={buttonClass("primary")}>
              <Plus size={18} aria-hidden="true" /> {t("products.new")}
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6 max-w-3xl">
            {PRODUCT_TYPES.map((type) => {
              const ofType = active.filter((product) => product.type === type);
              return (
                <section key={type} className="bg-card border border-borda rounded-xl p-5" aria-labelledby={`group-${type}`}>
                  <h2 id={`group-${type}`} className="font-medium text-texto mb-1">
                    {t(`products.group.${type}`)}
                  </h2>
                  {ofType.length === 0 ? (
                    <p className="text-sm text-texto-leve py-2">{t("products.emptyType")}</p>
                  ) : (
                    <ul className="divide-y divide-borda">{ofType.map(row)}</ul>
                  )}
                </section>
              );
            })}
            {archived.length > 0 && (
              <details className="bg-card border border-borda rounded-xl p-5">
                <summary className="font-medium text-texto cursor-pointer">
                  {t("products.archivedSection")} ({archived.length})
                </summary>
                <ul className="divide-y divide-borda mt-2">{archived.map(row)}</ul>
              </details>
            )}
          </div>
        )}

        {editing && (
          <ProductModal
            product={editing === "new" ? undefined : editing}
            onClose={() => setEditing(null)}
            onSaved={() => {
              showToast(t(editing === "new" ? "products.created" : "products.saved"));
              setEditing(null);
              load();
            }}
          />
        )}

        {deleting && (
          <ConfirmDialog
            title={t("products.deleteTitle")}
            confirmLabel={t("products.delete")}
            busyLabel={t("common.deleting")}
            busy={busy}
            danger
            error={actionError}
            onConfirm={confirmDelete}
            onClose={() => setDeleting(null)}
          >
            {t("products.deleteBody", { name: deleting.name })}
          </ConfirmDialog>
        )}
      </main>
    </div>
  );
}
