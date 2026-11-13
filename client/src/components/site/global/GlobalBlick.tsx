// ═══════════════════════════════════════════════════════════════════════════
// „AUF EINEN BLICK“ — die vier Antworten der 30-Sekunden-Probe (Register E-510, 13.11.2026)
//
// Sprachleitfaden FIAON Global, Abschnitt 1.3: Nach dreißig Sekunden weiß der Leser vier Dinge — was geschieht, was es
// kostet und wann, was er selbst tut, was gilt, wenn etwas ausbleibt. Die Antworten stehen im ersten Bild oder in diesem
// Kasten direkt darunter. Er steht unter der Bühne der Startseite und unter dem Honorarrechner (/business/start).
//
// Schlicht und zugänglich: eine Beschreibungsliste (dl) mit vier Fragen und ihren festen Antworten, darunter — wo gewünscht —
// die Spanne des Kapitalrahmens mit ihrem Satz (S9 und der Miami-Satz; die Spanne steht nie ohne ihn).
// Jeder Satz kommt als Eigenschaft herein (shared/fiaon-global-verkauf.ts, Feld `blick`) — hier steht kein eigener Wortlaut.
// Stil: styles/global-verkauf.css (Klassen .vk-blick…). Bewegung macht der Abschnitt, in dem der Kasten steht.
// ═══════════════════════════════════════════════════════════════════════════
import { sauber as W } from "@/components/site/global/VerkaufSatz";
import "@/styles/global-verkauf.css";

export interface GlobalBlickPunkt { frage: string; antwort: string }
export interface GlobalBlickRahmen { titel: string; wert: string; satz: string }

export default function GlobalBlick({ titel, punkte, rahmen, ebene = "h2", titelId = "vk-blick-titel" }: {
  /** „Auf einen Blick“ — die sichtbare Überschrift des Kastens. */
  titel: string;
  /** Die vier Fragen mit ihren festen Antworten. */
  punkte: readonly GlobalBlickPunkt[];
  /** Die Spanne des Kapitalrahmens mit ihrem Satz — nur dort, wo sie nicht schon im selben Blick steht (Regler). */
  rahmen?: GlobalBlickRahmen;
  /** Ebene der Überschrift: h2 unter der Bühne, h3 in einem Abschnitt, der schon eine h2 trägt. */
  ebene?: "h2" | "h3";
  titelId?: string;
}) {
  const Titel = ebene;
  return (
    <div className="vk-blick">
      <Titel className="vk-blick-titel" id={titelId}>{titel}</Titel>
      <dl className="vk-blick-liste">
        {punkte.map((p, i) => (
          <div key={p.frage} style={{ ["--i" as string]: String(i) }}>
            <dt>{p.frage}</dt>
            <dd>{W(p.antwort)}</dd>
          </div>
        ))}
      </dl>
      {rahmen && (
        <p className="vk-blick-rahmen">
          <span className="vk-blick-rahmen-titel">{rahmen.titel}</span>
          <b>{rahmen.wert}</b>
          <span className="vk-blick-rahmen-satz">{W(rahmen.satz)}</span>
        </p>
      )}
    </div>
  );
}
