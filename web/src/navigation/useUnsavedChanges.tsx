import { useCallback, useEffect, useRef } from "react";
import { useBlocker } from "react-router-dom";
import { ConfirmDialog } from "../components/ConfirmDialog.js";
import { t } from "../i18n/index.js";

// Alterações não salvas (auditoria de interface, 2026-10-18).
//
// Com `dirty` verdadeiro:
// - sair da tela por dentro do sistema (voltar, cancelar, menu, link) abre a
//   pergunta "Descartar as alterações?" — ficar ou descartar;
// - fechar ou recarregar a aba mostra o aviso do próprio navegador.
// Sem alterações, nada é perguntado. Depois de salvar, a tela chama
// `allowLeave()` antes de navegar, para não perguntar à toa.
export function useUnsavedChanges(dirty: boolean) {
  const bypass = useRef(false);

  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      dirty &&
      !bypass.current &&
      (currentLocation.pathname !== nextLocation.pathname || currentLocation.search !== nextLocation.search),
  );

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = ""; // navegadores antigos
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const allowLeave = useCallback(() => {
    bypass.current = true;
  }, []);

  const dialog =
    blocker.state === "blocked" ? (
      <ConfirmDialog
        title={t("unsaved.title")}
        confirmLabel={t("unsaved.discard")}
        cancelLabel={t("unsaved.stay")}
        busyLabel={t("unsaved.discard")}
        busy={false}
        danger
        onConfirm={() => blocker.proceed()}
        onClose={() => blocker.reset()}
      >
        <p>{t("unsaved.body")}</p>
      </ConfirmDialog>
    ) : null;

  return { allowLeave, dialog };
}
