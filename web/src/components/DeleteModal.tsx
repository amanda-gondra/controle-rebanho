import { useCallback, useEffect, useState } from "react";
import { ModalFrame } from "./ModalFrame.js";
import { buttonClass } from "./buttonStyles.js";
import { LoadError } from "./LoadError.js";
import { deleteAnimal, getDeleteImpact } from "../services/animals.js";
import type { DeleteImpact } from "../types/animal.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";

// Excluir animal — só para cadastro errado (D-10, F-ANI-07). Antes de
// confirmar, mostra TUDO que some junto ("3 pesagens e 2 participações em
// aplicações"). Com compra ou venda, não exclui e diz por quê.

type Props = {
  animalId: string;
  animalTag: string;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteModal({ animalId, animalTag, onClose, onDeleted }: Props) {
  const [impact, setImpact] = useState<DeleteImpact | null>(null);
  const [loadError, setLoadError] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    setLoadError("");
    getDeleteImpact(animalId)
      .then(setImpact)
      .catch((err) => setLoadError(errorMessage(err, "animal.delete.impactFailed")));
  }, [animalId]);

  useEffect(load, [load]);

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setDeleting(true);
    try {
      await deleteAnimal(animalId);
      onDeleted();
    } catch (err) {
      setError(errorMessage(err, "animal.delete.failed"));
      setDeleting(false);
    }
  }

  const blocked = impact?.hasTransactions === true;

  return (
    <ModalFrame title={t("animal.delete.title")} subtitle={t("animal.delete.body", { tag: animalTag })} onClose={onClose} busy={deleting}>
      {loadError ? (
        <LoadError compact message={loadError} onRetry={load} />
      ) : !impact ? (
        <p className="text-sm text-texto-suave mb-4" aria-busy="true">{t("common.loading")}</p>
      ) : blocked ? (
        <p role="alert" className="text-sm text-texto bg-bege rounded-lg px-3 py-2 mb-4">
          {t("animal.delete.blocked")}
        </p>
      ) : (
        <p className="text-sm text-texto mb-4">
          {impact.weighings + impact.applications === 0
            ? t("animal.delete.nothingElse")
            : t("animal.delete.impact", {
                weighings: t("animal.delete.weighingsCount", { count: impact.weighings }),
                applications: t("animal.delete.applicationsCount", { count: impact.applications }),
              })}{" "}
          {t("animal.delete.cannotUndo")}
        </p>
      )}

      <form onSubmit={handleDelete}>
        {error && <p role="alert" className="text-sm text-alerta mb-4">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={buttonClass("secondary")}>
            {blocked ? t("common.close") : t("common.cancel")}
          </button>
          {!blocked && (
            <button type="submit" disabled={deleting || !impact} className={buttonClass("danger")}>
              {deleting ? t("common.deleting") : t("animal.delete.confirm", { tag: animalTag })}
            </button>
          )}
        </div>
      </form>
    </ModalFrame>
  );
}
