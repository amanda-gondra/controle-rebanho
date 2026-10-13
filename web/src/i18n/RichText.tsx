import { Fragment } from "react";

// Mostra uma frase traduzida que tem uma parte em destaque, marcada com <b>…</b>
// no arquivo de tradução (ex.: "o animal passa a <b>Vendido</b>"). Assim a
// frase fica inteira na tradução — cada idioma põe o destaque onde fizer
// sentido. Só entende <b>; qualquer outra coisa aparece como texto (seguro:
// nada vira HTML de verdade).
export function RichText({ text }: { text: string }) {
  const parts = text.split(/(<b>.*?<\/b>)/g);
  return (
    <>
      {parts.map((part, index) =>
        part.startsWith("<b>") && part.endsWith("</b>") ? (
          <strong key={index}>{part.slice(3, -4)}</strong>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </>
  );
}
