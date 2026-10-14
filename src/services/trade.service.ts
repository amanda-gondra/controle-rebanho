import { checkDateWithinLife, findExitConflict } from "./exit.service.js";

// Negociações (G5 — compra e venda): o VALOR de cada animal (RN-NEG-001).
//
// Regras puras, testadas em trade.service.test.ts. Dinheiro e peso nunca passam
// por conta de ponto flutuante (F-25): tudo vira inteiro em centésimos
// (BigInt), a conta é exata e o arredondamento é feito UMA vez, por item, para
// centavos ("meio para cima", como na calculadora do produtor).

export type PriceUnit = "PER_KG" | "PER_ARROBA" | "PER_HEAD";
export type ArrobaBasis = "CARCASS" | "LIVE_FACTOR";

// Uma arroba = 15 kg de carcaça (RN-NEG-002, fixo).
export const ARROBA_CARCASS_KG = 15;

type Decimalish = number | string;

export type TradePricing = {
  priceUnit: PriceUnit;
  arrobaBasis?: ArrobaBasis | null;
  arrobaFactorKg?: Decimalish | null; // kg de peso vivo por arroba (só LIVE_FACTOR)
};

export type ItemAmounts = {
  liveWeightKg?: Decimalish | null;
  carcassWeightKg?: Decimalish | null;
  unitPrice: Decimalish;
};

// "333.33" (ou 333.33) → 33333n. Os valores já chegam validados com no
// máximo 2 casas; toFixed(2) só normaliza a escrita.
function toHundredths(value: Decimalish): bigint {
  const fixed = Number(value).toFixed(2);
  if (!/^\d+\.\d{2}$/.test(fixed)) {
    throw new Error(`Valor inválido para cálculo: ${value}`);
  }
  return BigInt(fixed.replace(".", ""));
}

// Divisão inteira arredondando meio para cima (só valores positivos).
function divideRoundingHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator * 2n + denominator) / (denominator * 2n);
}

// 1234567n centavos → "12345.67"
export function centsToString(cents: bigint): string {
  const whole = cents / 100n;
  const fraction = (cents % 100n).toString().padStart(2, "0");
  return `${whole}.${fraction}`;
}

export function stringToCents(value: string): bigint {
  return toHundredths(value);
}

// Valor de um animal na negociação, em reais com 2 casas ("4500.00"), ou
// null quando ainda não dá para saber: venda por arroba de carcaça sem o peso
// de carcaça (o romaneio do frigorífico ainda não chegou — D-35).
//
//   por kg               = peso vivo × preço
//   arroba (carcaça)     = (peso de carcaça ÷ 15) × preço
//   arroba (peso vivo)   = (peso vivo ÷ fator) × preço
//   por cabeça           = preço
export function computeItemValue(pricing: TradePricing, item: ItemAmounts): string | null {
  const price = toHundredths(item.unitPrice);

  switch (pricing.priceUnit) {
    case "PER_HEAD":
      return centsToString(price);

    case "PER_KG": {
      const live = requireAmount(item.liveWeightKg, "liveWeightKg");
      // centésimos × centésimos = décimos de milésimo → ÷ 100 = centavos
      return centsToString(divideRoundingHalfUp(live * price, 100n));
    }

    case "PER_ARROBA": {
      if (pricing.arrobaBasis === "CARCASS") {
        if (item.carcassWeightKg === null || item.carcassWeightKg === undefined) return null;
        const carcass = toHundredths(item.carcassWeightKg);
        return centsToString(divideRoundingHalfUp(carcass * price, BigInt(ARROBA_CARCASS_KG) * 100n));
      }
      if (pricing.arrobaBasis === "LIVE_FACTOR") {
        const live = requireAmount(item.liveWeightKg, "liveWeightKg");
        const factor = requireAmount(pricing.arrobaFactorKg, "arrobaFactorKg");
        if (factor === 0n) throw new Error("Fator da arroba não pode ser zero.");
        // (peso × preço) em décimos de milésimo ÷ fator em centésimos = centavos
        return centsToString(divideRoundingHalfUp(live * price, factor));
      }
      throw new Error("Arroba sem base de cálculo.");
    }
  }
}

function requireAmount(value: Decimalish | null | undefined, name: string): bigint {
  if (value === null || value === undefined) {
    throw new Error(`Falta ${name} para o cálculo.`);
  }
  return toHundredths(value);
}

// Total da negociação = soma EXATA dos valores dos itens (já arredondados).
// Se algum item está pendente, o total também fica pendente (null).
export function sumValues(values: (string | null)[]): string | null {
  if (values.some((value) => value === null)) return null;
  const total = values.reduce<bigint>((sum, value) => sum + toHundredths(value as string), 0n);
  return centsToString(total);
}

// O que cada forma de preço exige de cada animal (validação, antes de gravar):
// - peso vivo: obrigatório, exceto por cabeça (lá é opcional — D-07);
// - peso de carcaça: só existe na arroba por carcaça, pode ficar pendente
//   (D-35) e não passa do peso vivo quando os dois estão informados.
export type ItemProblem =
  | "LIVE_WEIGHT_REQUIRED"
  | "CARCASS_WEIGHT_NOT_ALLOWED"
  | "CARCASS_ABOVE_LIVE_WEIGHT";

export function findItemProblem(pricing: TradePricing, item: ItemAmounts): ItemProblem | null {
  const hasLive = item.liveWeightKg !== null && item.liveWeightKg !== undefined;
  const hasCarcass = item.carcassWeightKg !== null && item.carcassWeightKg !== undefined;
  const carcassBasis = pricing.priceUnit === "PER_ARROBA" && pricing.arrobaBasis === "CARCASS";

  if (!hasLive && pricing.priceUnit !== "PER_HEAD") return "LIVE_WEIGHT_REQUIRED";
  if (hasCarcass && !carcassBasis) return "CARCASS_WEIGHT_NOT_ALLOWED";
  if (hasCarcass && hasLive && toHundredths(item.carcassWeightKg!) > toHundredths(item.liveWeightKg!)) {
    return "CARCASS_ABOVE_LIVE_WEIGHT";
  }
  return null;
}

// ── Pode este animal entrar nesta negociação? (RN-NEG-004/005/007) ──
//
// Recebe os fatos do animal SEM a negociação que está sendo corrigida (na
// edição, a própria venda não conta como "já vendido") e devolve o problema
// com os dados para a mensagem, ou null.


export type TradeType = "PURCHASE" | "SALE";

export type AnimalTradeFacts = {
  status: "ACTIVE" | "SOLD" | "DEAD";
  exitDate: string | null;
  birthDate: string | null;
  birthIsExact: boolean;
  purchaseDate: string | null; // compra em OUTRA negociação
  saleDate: string | null; // venda em OUTRA negociação
  lastWeighingDate: string | null; // sem contar as pesagens criadas por esta negociação
  lastApplicationDate: string | null;
};

export type TradeAnimalProblem =
  | { code: "DEAD_ANIMAL_CANNOT_BE_SOLD" }
  | { code: "ANIMAL_ALREADY_SOLD"; date: string }
  | { code: "ANIMAL_ALREADY_PURCHASED"; date: string }
  | { code: "SALE_BEFORE_PURCHASE"; date: string }
  | { code: "EXIT_DATE_CONFLICT"; kind: string; date: string }
  | { code: "TRADE_DATE_OUT_OF_RANGE"; reason: "AFTER_EXIT" | "BEFORE_BIRTH"; date: string };

export function checkAnimalForTrade(
  type: TradeType,
  date: string,
  facts: AnimalTradeFacts,
): TradeAnimalProblem | null {
  if (type === "SALE") {
    if (facts.status === "DEAD") return { code: "DEAD_ANIMAL_CANNOT_BE_SOLD" };
    if (facts.saleDate) return { code: "ANIMAL_ALREADY_SOLD", date: facts.saleDate };
    if (facts.purchaseDate && date < facts.purchaseDate) {
      return { code: "SALE_BEFORE_PURCHASE", date: facts.purchaseDate };
    }
    // A venda é a saída: nada registrado pode ficar depois dela (RN-NEG-007)
    const blocker = findExitConflict(date, {
      birthDate: facts.birthDate,
      purchaseDate: facts.purchaseDate,
      lastWeighingDate: facts.lastWeighingDate,
      lastApplicationDate: facts.lastApplicationDate,
    });
    return blocker ? { code: "EXIT_DATE_CONFLICT", ...blocker } : null;
  }

  if (facts.purchaseDate) return { code: "ANIMAL_ALREADY_PURCHASED", date: facts.purchaseDate };
  if (facts.saleDate && date > facts.saleDate) {
    return { code: "SALE_BEFORE_PURCHASE", date: facts.saleDate };
  }
  // A compra fica dentro da vida do animal: não depois da saída (morte) nem
  // antes do nascimento com dia certo
  const problem = checkDateWithinLife(date, {
    exitDate: facts.exitDate,
    birthDate: facts.birthDate,
    birthIsExact: facts.birthIsExact,
  });
  return problem ? { code: "TRADE_DATE_OUT_OF_RANGE", ...problem } : null;
}
