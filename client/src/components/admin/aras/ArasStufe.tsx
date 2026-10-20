// ═══════════════════════════════════════════════════════════════════════════
// REITER „AUSBAUSTUFE“ (Cockpit, 20.10.2026) — wie Aras wächst und wann er bremst (/chef/aras/stufe)
// Vier Stufen als Leiter (0 Probe → 3 Voll), die Automatik in einem Satz, die Ampel der letzten 14 Tage in Worten.
// Nur Anzeige — die Stufe stellst du in „Einstellungen“ (Ausbaustufe), die Automatik schaltet selbst (Rot → zurück).
// ═══════════════════════════════════════════════════════════════════════════
import { useTakt, NichtVerbunden } from "../ki-teile";
import { STUFEN, type Stufe } from "@shared/fiaon-aras";
import { STUFEN_ZIELE, type AmpelPunkt } from "@shared/fiaon-aras-stufe";
import { berlinHeute, tagName } from "./aras-texte";
import { Karte, Leer, Punkt } from "./aras-teile";

interface StufeLage { ok: boolean; stufe: number; auto: boolean; naechste?: string; tage: { tag: string; stufe: number; farbe: string; entscheidung: string | null; punkte: AmpelPunkt[] }[] }
const KLASSE: Record<string, "" | "gut" | "warn" | "krit"> = { gruen: "gut", gelb: "warn", rot: "krit", leer: "" };
const FARBE_TEXT: Record<string, string> = { gruen: "grün", gelb: "gelb", rot: "rot", leer: "keine Kundenanrufe" };
const STUFE_SATZ: Record<number, string> = { 0: "nur Probeanrufe an dich", 1: "Rückrufe, Zahlung gemeldet, Raten", 2: "dazu Verkauf nach JA und Zusagen", 3: "alle Gesprächsarten" };

export default function ArasStufe({ verbunden, onEinstellungen }: { verbunden: boolean; onEinstellungen: () => void }) {
  const { daten, fehler, status, neu } = useTakt<StufeLage>(verbunden ? "/chef/aras/stufe" : null, 60_000);
  if (!verbunden || status === 404) return <NichtVerbunden />;
  if (fehler && !daten) return <Leer titel="Die Ausbaustufe ließ sich nicht laden.">{fehler} <button type="button" className="ar-knopf-text" onClick={neu}>Nochmal</button></Leer>;
  if (!daten) return <div className="ar-karte" aria-busy="true"><div className="ar-zeile-lade" /><div className="ar-zeile-lade" /></div>;
  const st = Math.max(0, Math.min(3, daten.stufe)) as Stufe;
  const brauche = STUFEN_ZIELE.tageHoch[st];
  const heute = berlinHeute();
  return (
    <div className="ar-reiter-inhalt" data-ki="aras-stufe">
      <Karte titel={`Stufe ${st} · ${STUFEN[st].name}`} satz={STUFE_SATZ[st]} data="stufe"
        rechts={<button type="button" className="ar-knopf klein" onClick={onEinstellungen} title="Die Stufe stellst du in den Einstellungen (Ausbaustufe) — mit Rückfrage.">Stufe ändern</button>}>
        <ol className="ar-leiter" aria-label="Die vier Ausbaustufen">
          {([0, 1, 2, 3] as Stufe[]).map((n) => (
            <li key={n} className={n === st ? "an" : n < st ? "fertig" : ""} aria-current={n === st ? "step" : undefined}>
              <b>{n} · {STUFEN[n].name}</b>
              <span>{n === 0 ? "nur du" : `${STUFEN[n].versucheJeTag} am Tag · ${STUFEN[n].tagEuro} €`}</span>
            </li>
          ))}
        </ol>
        <p className="ar-text">
          {daten.auto ? "Automatik an. " : "Automatik aus. "}
          {st === 0 ? "Aus Stufe 0 schaltest nur du." : brauche ? `Nach ${brauche} grünen Tagen eine Stufe hoch, bei Rot sofort eine zurück (du bekommst eine Karte).` : "Höchste Stufe — bei Rot geht es eine zurück."}
        </p>
        {daten.naechste && st > 0 ? <p className="ar-leise">{daten.naechste}</p> : null}
      </Karte>
      <Karte titel="Ampel der letzten 14 Tage" satz="Grün an genug Tagen = eine Stufe hoch. Rot = sofort eine zurück.">
        {daten.tage.length ? (
          <ul className="ar-ampel-liste">
            {daten.tage.map((t) => {
              const auffaellig = (t.punkte ?? []).filter((p) => p.farbe === "rot" || p.farbe === "gelb");
              return (
                <li key={t.tag} title={(t.punkte ?? []).map((p) => `${p.name}: ${p.wert} (Ziel ${p.ziel})`).join("\n")}>
                  <span className="ar-ampel-tag">{tagName(t.tag, heute)}</span>
                  <span className="ar-ampel-farbe"><Punkt klasse={KLASSE[t.farbe] ?? ""} />{FARBE_TEXT[t.farbe] ?? t.farbe}</span>
                  <span className="ar-ampel-stufe">Stufe {t.stufe >= 0 ? t.stufe : "—"}</span>
                  <span className="ar-ampel-was">{auffaellig.length ? auffaellig.map((p) => `${p.name}: ${p.wert}`).join(" · ") : t.entscheidung || t.farbe === "leer" ? "" : "nichts auffällig"}{t.entscheidung ? <b> {t.entscheidung}</b> : null}</span>
                </li>
              );
            })}
          </ul>
        ) : <p className="ar-leise">Noch keine Tage — die Ampel beginnt mit den ersten Kundenanrufen.</p>}
        <details className="ar-mehr-text">
          <summary>So misst die Ampel</summary>
          <p>Erreicht ≥ 25 % (Rückrufe ≥ 40 %) · Zahlung binnen 48 Stunden ≥ 20–30 % · unter {STUFEN_ZIELE.kostenJeZahlungEuro} € je Zahlung · Gespräche {STUFEN_ZIELE.minutenVon}–{STUFEN_ZIELE.minutenBis} Minuten · rot ab 3 % Abbrüchen oder 2 % Fehlern bei Prüf-Mara.</p>
        </details>
      </Karte>
    </div>
  );
}
