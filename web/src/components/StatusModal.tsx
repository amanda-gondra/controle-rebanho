import { useState } from "react";
import { X } from "lucide-react";
import { updateStatus } from "../services/animals.js";
import type { Status } from "../types/animal.js";
import { t } from "../i18n/index.js";
import { errorMessage } from "../i18n/errors.js";
import { statusLabel } from "../types/labels.js";

type Props = {
  animalId: string;
  animalTag: string;
  currentStatus: Status;
  onClose: () => void;
  onSaved: () => void;
};

const options: Status[] = ["ACTIVE", "SOLD", "DEAD"];

export function StatusModal({
  animalId,
  animalTag,
  currentStatus,
  onClose,
  onSaved,
}: Props) {
  const [status, setStatus] = useState<Status>(currentStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      await updateStatus(animalId, status);
      onSaved();
    } catch (err) {
      setError(errorMessage(err, "animal.statusModal.failed"));
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-card rounded-2xl p-6 w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-medium text-texto">
            {t("animal.statusModal.title")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            title={t("common.close")}
            aria-label={t("common.close")}
            className="text-texto-leve hover:text-texto cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>
        <p className="text-sm text-texto-suave mb-4">
          {t("animal.statusModal.question", { tag: animalTag })}
        </p>

        <form onSubmit={handleSave}>
          <div className="flex flex-col gap-2 mb-5">
            {options.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setStatus(value)}
                className={`py-2.5 rounded-lg border font-medium cursor-pointer ${
                  status === value
                    ? "bg-verde-claro border-verde text-verde-escuro"
                    : "bg-card border-borda-chip text-texto-suave"
                }`}
              >
                {statusLabel[value]}
              </button>
            ))}
          </div>

          {error && <p className="text-sm text-alerta mb-4">{error}</p>}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-borda-chip text-texto-suave font-medium cursor-pointer"
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2.5 rounded-xl bg-verde text-white font-medium cursor-pointer disabled:opacity-60"
            >
              {saving ? t("common.saving") : t("common.confirm")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}