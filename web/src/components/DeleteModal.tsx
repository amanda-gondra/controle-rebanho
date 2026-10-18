import { ModalFrame } from "./ModalFrame.js";
import { buttonClass } from "./buttonStyles.js";
import { useState } from "react";
import { deleteAnimal } from "../services/animals.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";

type Props = {
  animalId: string;
  animalTag: string;
  onClose: () => void;
  onDeleted: () => void;
};

export function DeleteModal({ animalId, animalTag, onClose, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

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

  return (
    <ModalFrame title={t("animal.delete.title")} subtitle={t("animal.delete.body", { tag: animalTag })} onClose={onClose} busy={deleting}>

      <form onSubmit={handleDelete}>
        {error && <p className="text-sm text-alerta mb-4">{error}</p>}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className={buttonClass("secondary")}
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={deleting}
            className={buttonClass("danger")}
          >
            {deleting ? t("common.deleting") : t("common.delete")}
          </button>
        </div>
      </form>
    </ModalFrame>
  );
}