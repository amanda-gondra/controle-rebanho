import type { PriceUnit, Prisma } from "@prisma/client";
import {
  customCategoryLabels,
  type CategoryLabels,
} from "./categories.js";

// Fazenda e configurações (G2 — D-21, D-30, D-31).
//
// Este arquivo é a ÚNICA fonte de:
// - quais campos da fazenda são lidos (FARM_SELECT) — usado pela sessão, por
//   /auth/* e por /farm, para todos devolverem a mesma coisa;
// - o formato que a API devolve (toFarmView);
// - os padrões (FARM_DEFAULTS) — iguais aos @default do schema.prisma
//   (um teste de integração confere que batem);
// - os fusos aceitos na 1.0 (só Brasil — D-31).

export const FARM_DEFAULTS = {
  timezone: "America/Sao_Paulo", // D-16
  currency: "BRL", // D-30 (fixa na 1.0)
  weightUnit: "kg", // D-30 (fixa na 1.0)
  settings: {
    arrobaLiveFactorKg: 30,
    preferredPriceUnit: "PER_KG" as PriceUnit,
    reapplyAlertDays: 7,
    defaultCastrated: false,
    categoryLabels: {} as Partial<CategoryLabels>, // G4: nenhum nome personalizado
  },
} as const;

// Limites das configurações (iguais aos CHECK da migration G2).
export const MAX_ARROBA_LIVE_FACTOR_KG = 99.99; // Decimal(4, 2)
export const MAX_REAPPLY_ALERT_DAYS = 60;

// Fusos do Brasil no banco de fusos IANA (D-31). O frontend mostra cada um com
// o nome dos estados; aqui fica só a lista que a API aceita.
export const BRAZIL_TIME_ZONES = [
  "America/Noronha",
  "America/Belem",
  "America/Fortaleza",
  "America/Recife",
  "America/Araguaina",
  "America/Maceio",
  "America/Bahia",
  "America/Sao_Paulo",
  "America/Campo_Grande",
  "America/Cuiaba",
  "America/Santarem",
  "America/Porto_Velho",
  "America/Boa_Vista",
  "America/Manaus",
  "America/Eirunepe",
  "America/Rio_Branco",
] as const;

export const FARM_SELECT = {
  id: true,
  name: true,
  country: true,
  timezone: true,
  currency: true,
  weightUnit: true,
  arrobaLiveFactorKg: true,
  preferredPriceUnit: true,
  reapplyAlertDays: true,
  defaultCastrated: true,
  categoryLabels: true,
} as const satisfies Prisma.FarmSelect;

type FarmRow = Prisma.FarmGetPayload<{ select: typeof FARM_SELECT }>;

export type FarmSettings = {
  arrobaLiveFactorKg: number;
  preferredPriceUnit: PriceUnit;
  reapplyAlertDays: number;
  defaultCastrated: boolean;
  // Só os nomes de categoria que a fazenda personalizou (G4). Os padrões vêm
  // da tradução da tela, no idioma de quem usa (G3).
  categoryLabels: Partial<CategoryLabels>;
};

export type FarmView = {
  id: string;
  name: string;
  country: string;
  timezone: string;
  currency: string;
  weightUnit: string;
  settings: FarmSettings;
};

// Linha do banco → o que a API devolve (Decimal vira número).
export function toFarmView(row: FarmRow): FarmView {
  return {
    id: row.id,
    name: row.name,
    country: row.country,
    timezone: row.timezone,
    currency: row.currency,
    weightUnit: row.weightUnit,
    settings: {
      arrobaLiveFactorKg: Number(row.arrobaLiveFactorKg),
      preferredPriceUnit: row.preferredPriceUnit,
      reapplyAlertDays: row.reapplyAlertDays,
      defaultCastrated: row.defaultCastrated,
      categoryLabels: customCategoryLabels(row.categoryLabels),
    },
  };
}
