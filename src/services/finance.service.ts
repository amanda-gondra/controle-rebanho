import { prisma } from "../lib/prisma.js";

// Como o resultado foi apurado:
// - REALIZED  → animal vendido, resultado "real" (receita da venda)
// - ESTIMATED → animal vivo, resultado com base no preço/kg informado pelo produtor
// - null      → dados insuficientes (nem venda, nem estimativa possível)
export type ResultType = "REALIZED" | "ESTIMATED" | null;

// Uma "ponta" da negociação (compra ou venda), do ponto de vista do cálculo:
// só o que a conta precisa — peso e preço por kg.
export type TradeInput = {
  weightKg: number | string;
  pricePerKg: number | string;
} | null;

// Tudo que a conta pura precisa saber sobre um animal.
export type AnimalResultInput = {
  purchase: TradeInput; // compra registrada (ou null se nasceu na fazenda / não informada)
  sale: TradeInput; // venda registrada (ou null se ainda vivo)
  currentWeightKg: number | string | null; // peso da última pesagem (ou null)
  estimatedPricePerKg: number | string | null; // preço/kg que o produtor informou (ou null)
};

export type AnimalResultOutput = {
  purchaseCost: number | null; // peso × preço/kg da compra
  saleRevenue: number | null; // peso × preço/kg da venda
  estimatedValue: number | null; // peso atual × preço/kg estimado (só p/ animal vivo)
  result: number | null; // receita (ou estimativa) − custo de compra
  resultType: ResultType;
};

// Arredonda valores monetários para 2 casas (evita "12.340000000001").
function money(value: number): number {
  return Number(value.toFixed(2));
}

// peso × preço/kg de uma ponta da negociação; null se a ponta não existe.
function tradeValue(trade: TradeInput): number | null {
  if (!trade) {
    return null;
  }
  return money(Number(trade.weightKg) * Number(trade.pricePerKg));
}

// A CONTA PURA: recebe os dados já prontos e apura o resultado do animal.
// Não depende do banco.
//
// Regras:
// - custo de compra = peso × preço/kg da compra (null se não há compra)
// - se VENDIDO:  receita = peso × preço/kg da venda;
//                resultado = receita − custo de compra (compra ausente conta como 0);
//                tipo = REALIZED
// - se VIVO com peso atual E preço estimado:
//                valor estimado = peso atual × preço/kg estimado;
//                resultado = valor estimado − custo de compra;
//                tipo = ESTIMATED
// - senão:       sem resultado (tipo = null)
export function computeAnimalResult(
  input: AnimalResultInput,
): AnimalResultOutput {
  const purchaseCost = tradeValue(input.purchase);

  // Animal vendido: resultado "real".
  if (input.sale) {
    const saleRevenue = tradeValue(input.sale);
    return {
      purchaseCost,
      saleRevenue,
      estimatedValue: null,
      result: money((saleRevenue ?? 0) - (purchaseCost ?? 0)),
      resultType: "REALIZED",
    };
  }

  // Animal vivo: resultado estimado, só se dá pra estimar.
  const canEstimate =
    input.currentWeightKg !== null && input.estimatedPricePerKg !== null;

  if (canEstimate) {
    const estimatedValue = money(
      Number(input.currentWeightKg) * Number(input.estimatedPricePerKg),
    );
    return {
      purchaseCost,
      saleRevenue: null,
      estimatedValue,
      result: money(estimatedValue - (purchaseCost ?? 0)),
      resultType: "ESTIMATED",
    };
  }

  // Sem dados suficientes para apurar.
  return {
    purchaseCost,
    saleRevenue: null,
    estimatedValue: null,
    result: null,
    resultType: null,
  };
}

// A função que fala com o banco: busca compra, venda e a última pesagem do
// animal e chama a conta pura acima.
export async function calculateAnimalResult(
  animalId: string,
): Promise<AnimalResultOutput> {
  const animal = await prisma.animal.findUnique({
    where: { id: animalId },
    include: {
      purchase: true,
      sale: true,
      weighings: { orderBy: { date: "desc" }, take: 1 },
    },
  });

  if (!animal) {
    // A rota já garante que o animal existe antes de chamar aqui; isto é só
    // uma rede de segurança para não estourar um erro cru.
    return computeAnimalResult({
      purchase: null,
      sale: null,
      currentWeightKg: null,
      estimatedPricePerKg: null,
    });
  }

  return computeAnimalResult({
    purchase: animal.purchase
      ? {
          weightKg: Number(animal.purchase.weightKg),
          pricePerKg: Number(animal.purchase.pricePerKg),
        }
      : null,
    sale: animal.sale
      ? {
          weightKg: Number(animal.sale.weightKg),
          pricePerKg: Number(animal.sale.pricePerKg),
        }
      : null,
    currentWeightKg: animal.weighings[0]
      ? Number(animal.weighings[0].weightKg)
      : null,
    estimatedPricePerKg:
      animal.estimatedPricePerKg !== null
        ? Number(animal.estimatedPricePerKg)
        : null,
  });
}
