// Confere se ficou texto fixo no código das telas (G3 — "textos fora do código").
//
// Procura, em web/src (menos web/src/i18n):
//  - texto solto dentro do JSX (<p>Olá</p>);
//  - textos entre aspas que parecem frase para gente ler (têm acento ou várias
//    palavras), fora de className, imports e das chamadas t("...").
// Para um caso legítimo, escreva  // i18n-ignore  no fim da linha.
//
// Uso: node scripts/check-i18n.mjs   (roda junto com "npm run lint")

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";

const ROOT = new URL("../src/", import.meta.url).pathname;
const SKIP_DIRS = new Set(["i18n"]);

function filesIn(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return SKIP_DIRS.has(name) ? [] : filesIn(path);
    // Testes não são telas: os nomes dos casos ficam em português
    return /\.(tsx|ts)$/.test(name) && !/\.(d|test)\.ts$/.test(name) ? [path] : [];
  });
}

const ACCENT = /[À-ÿ]/;
const isCssLike = (token) => /[-:[\]#/%]/.test(token) || /^\d/.test(token);

// Parece texto para gente ler?
// Chave de tradução ("nav.herd") e valores técnicos não são texto de tela
const isTechnical = (text) => /^[\w-]+(\.[\w-]+)+$/.test(text) || /^(true|false)$/.test(text);

function looksHuman(text) {
  const value = text.trim();
  if (!/[A-Za-zÀ-ÿ]{2,}/.test(value)) return false;
  if (ACCENT.test(value)) return true;
  const tokens = value.split(/\s+/).filter(Boolean);
  const words = tokens.filter((token) => /^[A-Za-zÀ-ÿ.,!?()'"“”]+$/.test(token) && !isCssLike(token));
  return tokens.length >= 2 && words.length / tokens.length > 0.5;
}

const ALLOWED_CALLS = new Set(["t", "tOptional", "errorMessage", "useState", "Error", "console.error", "console.log"]);
const IGNORED_ATTRS = new Set(["className", "key", "type", "role", "autoComplete", "inputMode", "to", "href", "src", "id", "htmlFor", "d", "viewBox", "preserveAspectRatio", "fill", "stroke", "name", "aria-haspopup", "aria-labelledby", "aria-describedby", "aria-checked", "aria-expanded", "aria-controls", "aria-current", "aria-live", "path", "value", "dataKey", "backFallback"]);

const problems = [];

for (const file of filesIn(ROOT)) {
  const source = readFileSync(file, "utf8");
  const lines = source.split("\n");
  const sf = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

  const report = (node, text) => {
    const { line } = sf.getLineAndCharacterOfPosition(node.getStart(sf));
    if (lines[line].includes("i18n-ignore")) return;
    problems.push(`${relative(join(ROOT, ".."), file)}:${line + 1}  ${JSON.stringify(text.trim().slice(0, 70))}`);
  };

  const insideAllowed = (node) => {
    for (let parent = node.parent; parent; parent = parent.parent) {
      if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true;
      if (ts.isJsxAttribute(parent) && IGNORED_ATTRS.has(parent.name.getText(sf))) return true;
      if ((ts.isCallExpression(parent) || ts.isNewExpression(parent)) && ALLOWED_CALLS.has(parent.expression.getText(sf))) return true;
      if (ts.isPropertyAssignment(parent) && parent.name.getText(sf) === "className") return true;
      if (ts.isBinaryExpression(parent) && /===|!==/.test(parent.operatorToken.getText(sf))) return true;
    }
    return false;
  };

  // Lugares onde até uma palavra só vai para a tela: atributo do JSX
  // (title, placeholder...), {cond ? "Sim" : "Não"} dentro do JSX e
  // propriedades como label: "Ativo".
  const DISPLAY_PROPS = new Set(["label", "title", "text", "message", "placeholder", "description", "help", "hint"]);
  const isDisplayPosition = (node) => {
    const parent = node.parent;
    if (ts.isJsxAttribute(parent) || ts.isJsxExpression(parent)) return true;
    if (ts.isPropertyAssignment(parent) && DISPLAY_PROPS.has(parent.name.getText(sf))) return true;
    if (ts.isConditionalExpression(parent) || (ts.isBinaryExpression(parent) && /\?\?|\|\|/.test(parent.operatorToken.getText(sf)))) {
      for (let up = parent.parent; up; up = up.parent) {
        if (ts.isJsxExpression(up)) return true;
        if (ts.isBlock(up) || ts.isSourceFile(up)) return false;
      }
    }
    return false;
  };

  const visit = (node) => {
    if (ts.isJsxText(node) && /[A-Za-zÀ-ÿ]{2,}/.test(node.getText(sf))) {
      report(node, node.getText(sf));
    } else if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) &&
      // Em atributo do JSX (title, placeholder, label...), até uma palavra só conta
      !isTechnical(node.text) &&
      (looksHuman(node.text) || (isDisplayPosition(node) && /[A-Za-zÀ-ÿ]{2,}/.test(node.text))) &&
      !insideAllowed(node)
    ) {
      report(node, node.text);
    } else if (ts.isTemplateExpression(node) && !insideAllowed(node)) {
      const text = [node.head.text, ...node.templateSpans.map((span) => span.literal.text)].join(" ");
      if (looksHuman(text)) report(node, text);
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
}

if (problems.length > 0) {
  console.error(`Texto fixo nas telas (use t("...") — G3): ${problems.length}\n`);
  console.error(problems.join("\n"));
  process.exit(1);
}
console.log("i18n: nenhum texto fixo encontrado nas telas.");
