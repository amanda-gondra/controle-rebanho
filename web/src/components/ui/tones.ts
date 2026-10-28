// Cores com significado (a mesma informação tem sempre a mesma cor em todas as
// telas). A cor só reforça: o texto sempre diz o que é.
//   herd     verde      rebanho, animais ativos, concluído
//   sale     verde      venda (dinheiro entrando)
//   entry    azul       entradas e compras (animal chegando)
//   purchase azul
//   exit     terracota  saídas (vendidos e mortos)
//   weight   roxo       pesagens, peso, ganho de peso
//   health   turquesa   manejo sanitário
//   warning  âmbar      precisa de atenção (chegando, aguardando)
//   danger   vermelho   vencido / problema
//   neutral  cinza      contagens neutras (arquivados, produtos, total)
export type Tone = "herd" | "sale" | "entry" | "purchase" | "exit" | "weight" | "health" | "warning" | "danger" | "neutral";

// fundo claro + cor do ícone (contraste do ícone ≥ 3:1 sobre o fundo)
export const TONE_CIRCLE: Record<Tone, string> = {
  herd: "bg-verde-claro text-verde",
  sale: "bg-verde-claro text-verde",
  entry: "bg-[#E6EEF8] text-[#1D5FA8]",
  purchase: "bg-[#E6EEF8] text-[#1D5FA8]",
  exit: "bg-[#F5E9E0] text-[#9A4F24]",
  weight: "bg-[#EFEAFA] text-[#6544B0]",
  health: "bg-[#DFF1EF] text-[#0E7470]",
  warning: "bg-[#FBF0D9] text-[#9A6500]",
  danger: "bg-[#FBEEEA] text-alerta",
  neutral: "bg-bege text-texto-suave",
};

// borda do cartão: só destaca o que pede atenção
export const TONE_BORDER: Partial<Record<Tone, string>> = {
  warning: "border-[#EBCF95]",
  danger: "border-[#E7C3B8]",
};

// Lembretes: vencido → vermelho; chegando → âmbar; nada aberto → manejo em dia
export const reminderTone = (overdue: number, open: number): Tone =>
  overdue > 0 ? "danger" : open > 0 ? "warning" : "health";
