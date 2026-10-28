import type { AnimalEvent, AnimalOrigin, Category, Sex } from "./animal.js";
import { formatDate, formatMonthYear } from "./format.js";
import { t } from "../i18n/index.js";

// Linha do tempo do animal (D-28): cada evento vem da API com os valores em
// código ("YEARLING") ou JSON pequeno ({"status":"DEAD","exitDate":...}).
// Aqui viram a frase da tela — sempre pela tradução, nunca texto fixo.

type Labels = {
  category: (category: Category) => string;
  sex: (sex: Sex) => string;
};

const parse = (value: string | null): Record<string, string | null> => {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
};

function birthText(value: string | null) {
  const birth = parse(value);
  if (!birth.date || birth.precision === "UNKNOWN") return t("history.birthUnknown");
  return birth.precision === "MONTH_YEAR" ? formatMonthYear(birth.date) : formatDate(birth.date);
}

export function originText(origin: AnimalOrigin | string | null | undefined, entryDate?: string | null) {
  const label = t(`animal.origin.${(origin ?? "NOT_INFORMED") as AnimalOrigin}`);
  return entryDate ? t("history.originWithEntry", { origin: label, date: formatDate(entryDate) }) : label;
}

function statusText(value: string | null, previous: string | null) {
  const to = parse(value);
  const from = parse(previous);
  const date = to.exitDate ? formatDate(to.exitDate) : "";
  if (to.status !== "ACTIVE" && to.status !== "SOLD" && to.status !== "DEAD") return t("history.statusChanged");
  if (to.status === "ACTIVE") return t("history.backToActive");
  const corrected = from.status === to.status;
  if (to.status === "SOLD") return t(corrected ? "history.saleCorrected" : "history.sold", { date });
  const certainty = t(`history.certainty.${(to.certainty ?? "NOT_INFORMED") as "CONFIRMED" | "SUSPECTED" | "NOT_INFORMED"}`);
  const base = t(corrected ? "history.deathCorrected" : "history.died", { date, certainty });
  return to.cause ? t("history.withCause", { text: base, cause: to.cause }) : base;
}

export function describeEvent(event: AnimalEvent, labels: Labels): string {
  switch (event.type) {
    case "TAG_CHANGED":
      return t("history.tagChanged", {
        from: event.fromValue ?? "",
        to: event.toValue ?? "",
        reason: t(`tagChange.reason.${event.reason ?? "OTHER"}`),
      });
    case "CATEGORY_CHANGED":
      return t("history.categoryChanged", {
        from: labels.category(event.fromValue as Category),
        to: labels.category(event.toValue as Category),
      });
    case "SEX_CHANGED":
      return t("history.sexChanged", {
        from: labels.sex(event.fromValue as Sex),
        to: labels.sex(event.toValue as Sex),
      });
    case "BIRTH_CHANGED":
      return t("history.birthChanged", { from: birthText(event.fromValue), to: birthText(event.toValue) });
    case "STATUS_CHANGED":
      return statusText(event.toValue, event.fromValue);
    case "ORIGIN_CHANGED": {
      const from = parse(event.fromValue);
      const to = parse(event.toValue);
      return t("history.originChanged", {
        from: originText(from.origin, from.entryDate),
        to: originText(to.origin, to.entryDate),
      });
    }
    case "LOT_CHANGED": {
      const from = parse(event.fromValue);
      const to = parse(event.toValue);
      if (!from.lotId) return t("history.lotJoined", { lot: to.name ?? "" });
      if (!to.lotId) return t("history.lotLeft", { lot: from.name ?? "" });
      return t("history.lotMoved", { from: from.name ?? "", to: to.name ?? "" });
    }
  }
}
