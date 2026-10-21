// Planilha CSV que abre certo no Excel em português: separador ";", acentos
// preservados (BOM UTF-8) e linhas com \r\n. Célula que começa com = + - @
// (ou tab/retorno) ganha um apóstrofo na frente, para o Excel NÃO tratar o
// texto como fórmula (injeção de fórmula em CSV — um brinco "=HYPERLINK(...)"
// digitado por alguém não pode virar link na planilha de outra pessoa).

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  let text = String(value);
  if (typeof value === "string" && FORMULA_START.test(text)) text = `'${text}`;
  return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  const lines = [header, ...rows].map((row) => row.map(csvCell).join(";"));
  return `﻿${lines.join("\r\n")}\r\n`;
}

// Baixa o texto como arquivo (no navegador)
export function downloadCsv(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
