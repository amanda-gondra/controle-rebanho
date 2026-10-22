import { ChevronLeft, ChevronRight } from "lucide-react";
import { t } from "../../i18n/index.js";
import { pageWindow } from "../../navigation/listParams.js";

// Rodapé de tabela: resumo ("Mostrando X de Y …", já traduzido por quem usa)
// + páginas (primeira, última e vizinhas)
export function Pagination({
  page,
  totalPages,
  summary,
  onPage,
}: {
  page: number;
  totalPages: number;
  summary: string;
  onPage: (page: number) => void;
}) {
  const squareClass = "w-9 h-9 flex items-center justify-center rounded-lg border text-sm cursor-pointer";
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-borda">
      <p className="text-xs text-texto-suave">{summary}</p>
      {totalPages > 1 && (
        <nav aria-label={t("common.pagination")} className="flex items-center gap-1.5">
          <button
            type="button"
            disabled={page === 1}
            onClick={() => onPage(page - 1)}
            aria-label={t("herd.prevPage")}
            className={`${squareClass} border-borda bg-card disabled:opacity-40`}
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          {pageWindow(page, totalPages).map((value, index) =>
            value === null ? (
              <span key={`gap-${index}`} aria-hidden="true" className="px-1 text-texto-leve">
                …
              </span>
            ) : (
              <button
                key={value}
                type="button"
                onClick={() => onPage(value)}
                aria-label={t("herd.page", { page: value })}
                aria-current={value === page ? "page" : undefined}
                className={`${squareClass} ${value === page ? "bg-verde border-verde text-white" : "bg-card border-borda text-texto"}`}
              >
                {value}
              </button>
            ),
          )}
          <button
            type="button"
            disabled={page === totalPages}
            onClick={() => onPage(page + 1)}
            aria-label={t("herd.nextPage")}
            className={`${squareClass} border-borda bg-card disabled:opacity-40`}
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
}
