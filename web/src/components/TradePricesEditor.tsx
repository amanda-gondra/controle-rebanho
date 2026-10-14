import { useMemo, useState } from "react";
import type { KeyboardEvent } from "react";
import { Check, ChevronDown, ChevronUp, RotateCcw } from "lucide-react";
import type { LastPrices, TradeType } from "../types/trade.js";
import type { Sex } from "../types/animal.js";
import {
  evaluateRow,
  groupKeyOf,
  parseDecimalInput,
  sumValues,
  type DraftRow,
  type EvaluatedRow,
  type GroupBy,
  type Pricing,
  type RowProblem,
} from "../types/tradeMath.js";
import { categoryLabelKey, type CategoryLabelKey } from "../types/categories.js";
import { formatDate, formatMoney, formatNumber } from "../types/format.js";
import { formatUnitPrice, priceUnitLabel } from "../types/tradeLabels.js";
import { sexLabel } from "../types/labels.js";
import { useCategoryLabels } from "../hooks/useCategoryLabels.js";
import { t, type MessageKey } from "../i18n/index.js";

// Preços e pesos da negociação (G5, RN-NEG-018 a 023).
//
// O caminho normal é curto: UM preço por categoria + o peso de cada animal.
// Variações reais do campo cabem sem atrapalhar, escondidas até serem usadas:
// agrupar também por raça, dar outro preço a vários animais marcados, ajustar
// o preço de um animal só. O mais específico vale (individual > marcados >
// categoria). O preço começa VAZIO: o "último usado" é só uma sugestão
// clicável (RN-NEG-020). Os valores mostrados são uma prévia — quem calcula
// e grava é o servidor.

type Props = {
  type: TradeType;
  pricing: Pricing;
  rows: DraftRow[];
  onRowsChange: (rows: DraftRow[]) => void;
  groupBy: GroupBy;
  onGroupByChange: (groupBy: GroupBy) => void;
  groupPrices: Record<string, string>;
  onGroupPricesChange: (prices: Record<string, string>) => void;
  lastPrices: LastPrices | null;
  rowErrors: Record<string, string>; // erro vindo do servidor, por linha
  showProblems: boolean; // depois de tentar salvar
};

type Group = { key: string; labelKey: CategoryLabelKey; breed: string | null; count: number };

const PROBLEM_TEXT: Record<RowProblem, MessageKey> = {
  REQUIRED: "trade.rowRequired",
  INVALID: "trade.rowInvalid",
  CARCASS_ABOVE_LIVE_WEIGHT: "errors.fieldCodes.CARCASS_ABOVE_LIVE_WEIGHT",
};

// Enter num campo de peso vai para o mesmo campo do próximo animal (ritmo de
// balança: digita, Enter, digita…)
function focusNext(event: KeyboardEvent<HTMLInputElement>, column: string, index: number) {
  if (event.key !== "Enter") return;
  event.preventDefault();
  const candidates = document.querySelectorAll<HTMLInputElement>(`[data-nav="${column}-${index + 1}"]`);
  const visible = [...candidates].find((input) => input.offsetParent !== null);
  visible?.focus();
}

export function TradePricesEditor({
  type,
  pricing,
  rows,
  onRowsChange,
  groupBy,
  onGroupByChange,
  groupPrices,
  onGroupPricesChange,
  lastPrices,
  rowErrors,
  showProblems,
}: Props) {
  const { labelOf, labelOfKey: labelForKey } = useCategoryLabels();
  const [marked, setMarked] = useState<Set<string>>(new Set());
  const [showBulk, setShowBulk] = useState(false);
  const [bulkPrice, setBulkPrice] = useState("");
  const [bulkError, setBulkError] = useState("");
  const [editingPrice, setEditingPrice] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState({ group: "", breed: "", sex: "" as Sex | "", min: "", max: "" });

  const carcassBasis = pricing.priceUnit === "PER_ARROBA" && pricing.arrobaBasis === "CARCASS";
  const unitText = priceUnitLabel(pricing.priceUnit, pricing.arrobaBasis, pricing.arrobaFactorKg);

  // Grupos presentes nesta negociação (só as categorias que aparecem)
  const groups = useMemo(() => {
    const byKey = new Map<string, Group>();
    for (const row of rows) {
      const key = groupKeyOf(row.animal, groupBy);
      const existing = byKey.get(key);
      if (existing) existing.count += 1;
      else
        byKey.set(key, {
          key,
          labelKey: categoryLabelKey(row.animal.category, row.animal.sex),
          breed: groupBy === "categoryBreed" ? row.animal.breed?.trim() || null : null,
          count: 1,
        });
    }
    return [...byKey.values()];
  }, [rows, groupBy]);

  const evaluated: EvaluatedRow[] = rows.map((row) =>
    evaluateRow(row, pricing, groupPrices[groupKeyOf(row.animal, groupBy)] ?? ""),
  );
  const total = sumValues(evaluated.map((row) => row.value));
  const awaitingCarcass = evaluated.filter((row) => row.awaitingCarcass).length;

  const groupName = (group: Group) =>
    groupBy === "categoryBreed"
      ? t("trade.groupWithBreed", { category: labelForKey(group.labelKey), breed: group.breed ?? t("trade.noBreed") })
      : labelForKey(group.labelKey);

  function lastPriceFor(group: Group) {
    if (!lastPrices) return null;
    if (groupBy === "category") return lastPrices.byCategory.find((last) => last.group === group.labelKey) ?? null;
    const breed = group.breed?.toLocaleLowerCase("pt-BR") ?? "";
    return (
      lastPrices.byCategoryAndBreed.find(
        (last) => last.group === group.labelKey && (last.breed?.toLocaleLowerCase("pt-BR") ?? "") === breed,
      ) ?? null
    );
  }

  const updateRow = (key: string, patch: Partial<DraftRow>) =>
    onRowsChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  // ── Marcar vários (RN-NEG-021/023) ──
  const matchesFilter = (row: DraftRow, index: number) => {
    const live = evaluated[index].liveWeightKg;
    const min = parseDecimalInput(filter.min);
    const max = parseDecimalInput(filter.max);
    return (
      (!filter.group || categoryLabelKey(row.animal.category, row.animal.sex) === filter.group) &&
      (!filter.sex || row.animal.sex === filter.sex) &&
      (!filter.breed || (row.animal.breed ?? "").toLocaleLowerCase("pt-BR").includes(filter.breed.trim().toLocaleLowerCase("pt-BR"))) &&
      (!min || (live !== null && Number(live) >= Number(min))) &&
      (!max || (live !== null && Number(live) <= Number(max)))
    );
  };
  const filteredKeys = rows.filter(matchesFilter).map((row) => row.key);

  function toggleMarked(key: string) {
    setMarked((previous) => {
      const next = new Set(previous);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function applyToMarked() {
    const price = parseDecimalInput(bulkPrice);
    if (!price || price === "0.00") {
      setBulkError(t("trade.bulkPriceInvalid"));
      return;
    }
    setBulkError("");
    onRowsChange(rows.map((row) => (marked.has(row.key) ? { ...row, selectionPrice: bulkPrice } : row)));
  }

  function resetMarked() {
    onRowsChange(
      rows.map((row) => (marked.has(row.key) ? { ...row, selectionPrice: null, individualPrice: null } : row)),
    );
  }

  const presentGroupKeys = [...new Set(rows.map((row) => categoryLabelKey(row.animal.category, row.animal.sex)))];

  // ── Campos de uma linha (usados na tabela e nos cartões do celular) ──
  function weightInput(row: DraftRow, index: number, column: "live" | "carcass") {
    const problem = evaluated[index].problems[column === "live" ? "liveWeight" : "carcassWeight"];
    const label = t(column === "live" ? "trade.liveWeight" : "trade.carcassWeight");
    return (
      <input
        inputMode="decimal"
        data-nav={`${column}-${index}`}
        aria-label={`${label} — ${row.animal.tag}`}
        aria-invalid={showProblems && !!problem}
        value={column === "live" ? row.liveWeight : row.carcassWeight}
        placeholder={column === "carcass" ? t("trade.carcassPending") : ""}
        onChange={(e) => updateRow(row.key, column === "live" ? { liveWeight: e.target.value } : { carcassWeight: e.target.value })}
        onKeyDown={(e) => focusNext(e, column, index)}
        className={`w-24 border rounded-lg px-2 py-1.5 text-texto text-right ${
          showProblems && problem ? "border-alerta" : "border-borda"
        }`}
      />
    );
  }

  function priceCell(row: DraftRow, index: number) {
    const state = evaluated[index];
    const editing = editingPrice.has(row.key) || row.individualPrice !== null;
    if (editing) {
      return (
        <span className="flex items-center gap-1">
          <input
            inputMode="decimal"
            aria-label={`${t("trade.animalPrice")} — ${row.animal.tag}`}
            value={row.individualPrice ?? ""}
            placeholder={state.price ? state.price.replace(".", ",") : ""}
            onChange={(e) => updateRow(row.key, { individualPrice: e.target.value === "" ? null : e.target.value })}
            className="w-24 border border-borda rounded-lg px-2 py-1.5 text-texto text-right"
          />
          <button
            type="button"
            title={t("trade.backToGroupPrice")}
            aria-label={t("trade.backToGroupPrice")}
            onClick={() => {
              updateRow(row.key, { individualPrice: null, selectionPrice: null });
              setEditingPrice((previous) => {
                const next = new Set(previous);
                next.delete(row.key);
                return next;
              });
            }}
            className="text-texto-leve hover:text-verde cursor-pointer p-1"
          >
            <RotateCcw size={14} />
          </button>
        </span>
      );
    }
    return (
      <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <span className="text-texto">
          {state.price ? formatUnitPrice(pricing.priceUnit, state.price) : <span className="text-texto-leve">—</span>}
        </span>
        {state.adjusted && (
          <span className="text-xs rounded px-1.5 py-0.5 bg-[#FAEEDA] text-[#854F0B]">{t("trade.adjusted")}</span>
        )}
        {state.adjusted ? (
          <button
            type="button"
            onClick={() => updateRow(row.key, { individualPrice: null, selectionPrice: null })}
            className="text-xs text-verde underline cursor-pointer"
          >
            {t("trade.backToGroupPrice")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setEditingPrice((previous) => new Set(previous).add(row.key))}
            className="text-xs text-verde underline cursor-pointer"
          >
            {t("trade.adjust")}
          </button>
        )}
      </span>
    );
  }

  function rowMessages(row: DraftRow, index: number) {
    const state = evaluated[index];
    const messages: string[] = [];
    if (rowErrors[row.key]) messages.push(rowErrors[row.key]);
    if (showProblems) {
      if (state.problems.liveWeight) messages.push(`${t("trade.liveWeight")}: ${t(PROBLEM_TEXT[state.problems.liveWeight])}`);
      if (state.problems.carcassWeight) {
        messages.push(`${t("trade.carcassWeight")}: ${t(PROBLEM_TEXT[state.problems.carcassWeight])}`);
      }
      if (state.problems.price) messages.push(`${t("trade.price")}: ${t(PROBLEM_TEXT[state.problems.price])}`);
    }
    return messages.length > 0 ? (
      <p role="alert" className="text-xs text-alerta mt-1">
        {messages.join(" · ")}
      </p>
    ) : null;
  }

  const markBox = (row: DraftRow) => (
    <button
      type="button"
      role="checkbox"
      aria-checked={marked.has(row.key)}
      aria-label={t("trade.markAnimal", { tag: row.animal.tag })}
      onClick={() => toggleMarked(row.key)}
      className={`flex items-center justify-center w-5 h-5 rounded border cursor-pointer shrink-0 ${
        marked.has(row.key) ? "bg-verde border-verde text-white" : "border-borda-chip bg-card"
      }`}
    >
      {marked.has(row.key) && <Check size={14} />}
    </button>
  );

  const animalText = (row: DraftRow) =>
    [labelOf(row.animal.category, row.animal.sex), row.animal.breed].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col gap-6">
      {/* 1) Preço por grupo */}
      <section className="bg-card border border-borda rounded-xl p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <h2 className="font-medium text-texto">{t("trade.pricesTitle")}</h2>
          <div role="radiogroup" aria-label={t("trade.groupBy")} className="flex items-center gap-1 text-sm">
            <span className="text-texto-suave mr-1">{t("trade.groupBy")}</span>
            {(["category", "categoryBreed"] as GroupBy[]).map((option) => (
              <button
                key={option}
                type="button"
                role="radio"
                aria-checked={groupBy === option}
                onClick={() => onGroupByChange(option)}
                className={`px-2.5 py-1 rounded-lg border cursor-pointer ${
                  groupBy === option ? "bg-verde-claro border-verde text-verde-escuro" : "border-borda-chip text-texto-suave"
                }`}
              >
                {t(option === "category" ? "trade.groupByCategory" : "trade.groupByCategoryBreed")}
              </button>
            ))}
          </div>
        </div>
        <p className="text-sm text-texto-suave mb-4">{t("trade.pricesHelp", { unit: unitText })}</p>

        <div className="flex flex-col divide-y divide-borda">
          {groups.map((group) => {
            const last = lastPriceFor(group);
            const value = groupPrices[group.key] ?? "";
            const invalid = value !== "" && !parseDecimalInput(value);
            return (
              <div key={group.key} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3">
                <span className="text-texto">
                  <span className="font-medium">{groupName(group)}</span>{" "}
                  <span className="text-texto-suave">— {t("trade.animalsCount", { count: group.count })}</span>
                </span>
                <span className="flex flex-col items-start sm:items-end">
                  <span className="flex items-center gap-2">
                    <input
                      inputMode="decimal"
                      aria-label={t("trade.groupPriceLabel", { group: groupName(group), unit: unitText })}
                      value={value}
                      onChange={(e) => onGroupPricesChange({ ...groupPrices, [group.key]: e.target.value })}
                      className={`w-28 border rounded-lg px-2 py-1.5 text-right text-texto ${invalid ? "border-alerta" : "border-borda"}`}
                    />
                    <span className="text-sm text-texto-suave">{unitText}</span>
                  </span>
                  {last && (
                    <button
                      type="button"
                      onClick={() =>
                        onGroupPricesChange({ ...groupPrices, [group.key]: last.unitPrice.replace(".", ",") })
                      }
                      className="text-xs text-verde underline mt-1 cursor-pointer"
                    >
                      {t("trade.lastUsed", {
                        price: formatUnitPrice(pricing.priceUnit, last.unitPrice),
                        date: formatDate(last.date),
                      })}
                    </button>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2) Preço para vários animais marcados (opcional, recolhido) */}
      <section className="bg-card border border-borda rounded-xl p-4 md:p-6">
        <button
          type="button"
          aria-expanded={showBulk}
          onClick={() => setShowBulk((open) => !open)}
          className="flex items-center justify-between w-full text-left cursor-pointer"
        >
          <span>
            <span className="font-medium text-texto">{t("trade.bulkTitle")}</span>{" "}
            <span className="text-sm text-texto-suave">{t("trade.markedCount", { count: marked.size })}</span>
          </span>
          {showBulk ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>

        {showBulk && (
          <div className="mt-4 flex flex-col gap-3">
            <p className="text-sm text-texto-suave">{t("trade.bulkHelp")}</p>
            <div className="flex flex-wrap gap-2">
              <select
                aria-label={t("trade.filterCategory")}
                value={filter.group}
                onChange={(e) => setFilter({ ...filter, group: e.target.value })}
                className="bg-bege border border-borda rounded-lg px-2.5 py-1.5 text-sm text-texto cursor-pointer"
              >
                <option value="">{t("trade.filterAllCategories")}</option>
                {presentGroupKeys.map((key) => (
                  <option key={key} value={key}>
                    {labelForKey(key)}
                  </option>
                ))}
              </select>
              <select
                aria-label={t("trade.filterSex")}
                value={filter.sex}
                onChange={(e) => setFilter({ ...filter, sex: e.target.value as Sex | "" })}
                className="bg-bege border border-borda rounded-lg px-2.5 py-1.5 text-sm text-texto cursor-pointer"
              >
                <option value="">{t("trade.filterAllSexes")}</option>
                <option value="MALE">{sexLabel.MALE}</option>
                <option value="FEMALE">{sexLabel.FEMALE}</option>
              </select>
              <input
                aria-label={t("trade.filterBreed")}
                placeholder={t("trade.filterBreed")}
                value={filter.breed}
                onChange={(e) => setFilter({ ...filter, breed: e.target.value })}
                className="w-32 bg-bege border border-borda rounded-lg px-2.5 py-1.5 text-sm text-texto"
              />
              <input
                inputMode="decimal"
                aria-label={t("trade.filterMinWeight")}
                placeholder={t("trade.filterMinWeight")}
                value={filter.min}
                onChange={(e) => setFilter({ ...filter, min: e.target.value })}
                className="w-28 bg-bege border border-borda rounded-lg px-2.5 py-1.5 text-sm text-texto"
              />
              <input
                inputMode="decimal"
                aria-label={t("trade.filterMaxWeight")}
                placeholder={t("trade.filterMaxWeight")}
                value={filter.max}
                onChange={(e) => setFilter({ ...filter, max: e.target.value })}
                className="w-28 bg-bege border border-borda rounded-lg px-2.5 py-1.5 text-sm text-texto"
              />
            </div>
            <div className="flex flex-wrap gap-3 text-sm">
              <button
                type="button"
                onClick={() => setMarked(new Set([...marked, ...filteredKeys]))}
                className="text-verde font-medium cursor-pointer"
              >
                {t("trade.markFiltered", { count: filteredKeys.length })}
              </button>
              <button type="button" onClick={() => setMarked(new Set())} className="text-texto-suave cursor-pointer">
                {t("trade.unmarkAll")}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                inputMode="decimal"
                aria-label={t("trade.bulkPrice", { unit: unitText })}
                placeholder={t("trade.bulkPrice", { unit: unitText })}
                value={bulkPrice}
                onChange={(e) => setBulkPrice(e.target.value)}
                className="w-44 border border-borda rounded-lg px-2.5 py-1.5 text-texto"
              />
              <button
                type="button"
                disabled={marked.size === 0}
                onClick={applyToMarked}
                className="px-3 py-1.5 rounded-lg bg-verde text-white text-sm font-medium cursor-pointer disabled:opacity-50"
              >
                {t("trade.applyToMarked", { count: marked.size })}
              </button>
              <button
                type="button"
                disabled={marked.size === 0}
                onClick={resetMarked}
                className="px-3 py-1.5 rounded-lg border border-borda-chip text-texto-suave text-sm cursor-pointer disabled:opacity-50"
              >
                {t("trade.backToGroupPrice")}
              </button>
            </div>
            {bulkError && <p className="text-sm text-alerta">{bulkError}</p>}
          </div>
        )}
      </section>

      {/* 3) Animal por animal */}
      <section className="bg-card border border-borda rounded-xl p-4 md:p-6">
        <h2 className="font-medium text-texto mb-1">{t("trade.animalsTitle")}</h2>
        <p className="text-sm text-texto-suave mb-4">
          {t(pricing.priceUnit === "PER_HEAD" ? "trade.weightOptionalHelp" : "trade.weightHelp")}
        </p>

        {/* Computador: tabela */}
        <table className="hidden md:table w-full text-sm">
          <thead>
            <tr className="text-left text-texto-suave border-b border-borda">
              <th className="py-2 w-8">
                <span className="sr-only">{t("trade.mark")}</span>
              </th>
              <th className="py-2">{t("trade.tag")}</th>
              <th className="py-2">{t("trade.animal")}</th>
              <th className="py-2 text-right">{t("trade.liveWeight")}</th>
              {carcassBasis && <th className="py-2 text-right">{t("trade.carcassWeight")}</th>}
              <th className="py-2 pl-4">{t("trade.price")}</th>
              <th className="py-2 text-right">{t("trade.value")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.key} className="border-b border-borda align-top">
                <td className="py-2">{markBox(row)}</td>
                <td className="py-2 font-medium text-texto">
                  {row.animal.tag}
                  {rowMessages(row, index)}
                </td>
                <td className="py-2 text-texto-suave">{animalText(row)}</td>
                <td className="py-2 text-right">{weightInput(row, index, "live")}</td>
                {carcassBasis && <td className="py-2 text-right">{weightInput(row, index, "carcass")}</td>}
                <td className="py-2 pl-4">{priceCell(row, index)}</td>
                <td className="py-2 text-right text-texto whitespace-nowrap">
                  {evaluated[index].value ? (
                    formatMoney(Number(evaluated[index].value))
                  ) : (
                    <span className="text-texto-leve">
                      {evaluated[index].awaitingCarcass ? t("trade.pendingValue") : "—"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Celular: um cartão por animal */}
        <ul className="md:hidden flex flex-col gap-3">
          {rows.map((row, index) => (
            <li key={row.key} className="border border-borda rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                {markBox(row)}
                <span className="font-medium text-texto">{row.animal.tag}</span>
                <span className="text-xs text-texto-suave truncate">{animalText(row)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <label className="flex flex-col gap-1 text-texto-suave">
                  {t("trade.liveWeight")}
                  {weightInput(row, index, "live")}
                </label>
                {carcassBasis && (
                  <label className="flex flex-col gap-1 text-texto-suave">
                    {t("trade.carcassWeight")}
                    {weightInput(row, index, "carcass")}
                  </label>
                )}
              </div>
              <div className="flex items-center justify-between gap-2 mt-2 text-sm">
                {priceCell(row, index)}
                <span className="font-medium text-texto whitespace-nowrap">
                  {evaluated[index].value ? formatMoney(Number(evaluated[index].value)) : "—"}
                </span>
              </div>
              {rowMessages(row, index)}
            </li>
          ))}
        </ul>

        <div className="flex flex-wrap items-center justify-between gap-2 mt-4 pt-3 border-t border-borda">
          <span className="text-texto-suave text-sm">
            {t("trade.animalsCount", { count: rows.length })}
            {pricing.priceUnit !== "PER_HEAD" &&
              ` · ${t("units.kgValue", {
                value: formatNumber(evaluated.reduce((sum, row) => sum + Number(row.liveWeightKg ?? 0), 0)),
              })}`}
            {awaitingCarcass > 0 && ` · ${t("trade.awaitingCarcassCount", { count: awaitingCarcass })}`}
          </span>
          <span className="text-lg font-medium text-texto">
            {t("trade.totalPreview", { total: formatMoney(Number(total)) })}
          </span>
        </div>
        <p className="text-xs text-texto-leve mt-1">{t("trade.serverCalculates")}</p>
        {type === "SALE" && <p className="text-xs text-texto-leve">{t("trade.saleWeighingNote")}</p>}
      </section>
    </div>
  );
}
