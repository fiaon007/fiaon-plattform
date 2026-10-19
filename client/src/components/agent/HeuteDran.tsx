// ═══════════════════════════════════════════════════════════════════════════
// „HEUTE DRAN“ — der Block auf dem Schreibtisch (E-406 A, 19.10.2026)
//
// Eine Liste für heute: höchstens 25 Einträge, nach Wirkung sortiert, die
// Menge nach deiner Arbeitszeit. Ein Klick öffnet die Stelle, an der die
// Arbeit schon liegt (Akte, Inkasso, Termin, Auftrag, Anliegen). Abhaken
// musst du nichts: „erledigt“ liest der Server aus der Sache selbst (Rate
// bezahlt, Auftrag zu, Termin geführt …). Was nicht passt, steht als Rückstau
// darunter — aufklappbar, nie still verloren.
//
// Daten: GET /agent/heute-dran (alle zwei Minuten neu). Regeln:
// shared/fiaon-heute-dran.ts. Keine KI — läuft auch in der KI-Pause.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { api } from "@/pages/agent/shared";
import { HEUTE_DRAN_HOECHSTENS } from "@shared/fiaon-heute-dran";

interface Zeile {
  schluessel: string; quelle: string; name: string; grund: string; weitere: string[];
  betragCents: number | null; ziel: string; zeit: string | null; stufe: number; verteilt: boolean; erledigt: boolean;
}
interface Antwort {
  ok: boolean; stand: string; fehlend: string[]; hinweis?: string;
  person: null | {
    name: string; minuten: number; kapazitaet: number; hinweis: string | null;
    zahlen: { heuteDran: number; erledigt: number; rueckstau: number };
    offen: Zeile[]; erledigt: Zeile[]; rueckstau: Zeile[]; rueckstauGesamt: number;
  };
}

const QUELLE_KURZ: Record<string, string> = {
  termin: "Termin", rueckruf: "Rückruf", auftrag: "Auftrag", inkasso: "Rate", zahlung: "Zahlung",
  kyc: "Ausweis", anliegen: "Anliegen", hitze: "Anruf", bonitaet: "Bonität",
};
const uhr = (iso: string) => new Date(iso).toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" });
const euro = (c: number) => (c / 100).toLocaleString("de-DE", { style: "currency", currency: "EUR" });

function HeuteZeile({ z }: { z: Zeile }) {
  // Links steht, was die Zeile ist: die Uhrzeit bei Terminen und Rückrufen heute, „Frist“ bei Fristfällen, sonst die Art.
  const marke = z.stufe === 1 && z.zeit ? uhr(z.zeit) : z.stufe === 3 ? "Frist" : (QUELLE_KURZ[z.quelle] ?? "Heute");
  const zusatz = [
    ...(z.weitere.length ? [`auch: ${z.weitere.join(", ")}`] : []),
    ...(z.verteilt ? ["ohne Betreuer – heute für dich"] : []),
  ].join(" · ");
  return (
    <div className={`st-zeile st-heute-zeile s${z.stufe}${z.erledigt ? " fertig" : ""}`}>
      <div className="st-zeit">
        <b>{z.erledigt ? "✓" : marke}</b>
        {z.betragCents ? <small>{euro(z.betragCents)}</small> : null}
      </div>
      <div className="st-wer">
        <b>{z.name}</b>
        <small>{z.grund}</small>
        {zusatz && <small className="st-notiz" title={zusatz}>{zusatz}</small>}
      </div>
      <div className="st-aktion">
        <Link href={z.ziel} className={`st-knopf${z.erledigt ? " still" : ""}`} aria-label={`${z.name}: ${z.grund} – öffnen`}>
          {z.erledigt ? "Ansehen" : "Öffnen"}
        </Link>
      </div>
    </div>
  );
}

export function HeuteDranBlock() {
  const [daten, setDaten] = useState<Antwort | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [stauAuf, setStauAuf] = useState(false);
  const [fertigAuf, setFertigAuf] = useState(false);
  useEffect(() => {
    let an = true;
    const laden = () => api("/agent/heute-dran").then((r) => {
      if (!an) return;
      if (r.ok) { setDaten(r.json); setFehler(null); } else setFehler(r.json?.error || "„Heute dran“ konnte gerade nicht geladen werden.");
    }).catch(() => { if (an) setFehler("Keine Verbindung."); });
    laden();
    const i = setInterval(laden, 120_000);
    return () => { an = false; clearInterval(i); };
  }, []);

  if (!daten) return fehler ? <section className="st-block st-heute"><p className="st-fehler">{fehler}</p></section> : null;
  const p = daten.person;
  if (!p) return null; // Konten ohne Tagesliste (Geschäftsführung, Testkonten) sehen den Block nicht.
  const { heuteDran, erledigt, rueckstau } = p.zahlen;
  const anteil = heuteDran > 0 ? Math.round((erledigt / heuteDran) * 100) : 0;
  return (
    <section className="st-block st-heute" aria-label="Heute dran">
      <div className="st-block-kopf">
        <b>Heute dran</b>
        <small>{heuteDran > 0 ? `${erledigt} von ${heuteDran} erledigt` : "noch nichts"}</small>
      </div>
      {heuteDran > 0 && (
        <div className="st-heute-balken" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={anteil} aria-label="Heute erledigt">
          <i style={{ width: `${anteil}%` }} />
        </div>
      )}
      {p.hinweis && <p className="st-leer">{p.hinweis}</p>}
      {!p.hinweis && p.offen.length === 0 && (
        <p className="st-leer">{erledigt > 0 ? "Alles für heute erledigt. Stark!" : "Heute steht nichts an. Schau in die Pipeline."}</p>
      )}
      {p.offen.map((z) => <HeuteZeile key={z.schluessel} z={z} />)}
      {daten.fehlend.length > 0 && (
        <p className="st-heute-hinweis">Gerade nicht lesbar: {daten.fehlend.join(", ")} — die Liste zeigt den Rest.</p>
      )}
      <div className="st-heute-knoepfe">
        {erledigt > 0 && (
          <button type="button" className="st-heute-auf" aria-expanded={fertigAuf} onClick={() => setFertigAuf((v) => !v)}>
            {fertigAuf ? "Erledigte zuklappen" : `Erledigt heute: ${erledigt}`}
          </button>
        )}
        {rueckstau > 0 && (
          <button type="button" className="st-heute-auf" aria-expanded={stauAuf} onClick={() => setStauAuf((v) => !v)}
                  title={`Passt heute nicht mehr in deine ${p.kapazitaet || HEUTE_DRAN_HOECHSTENS} Plätze — nach Wichtigkeit sortiert.`}>
            {stauAuf ? "Rückstau zuklappen" : `Rückstau: ${rueckstau}`}
          </button>
        )}
      </div>
      {fertigAuf && p.erledigt.map((z) => <HeuteZeile key={`e${z.schluessel}`} z={z} />)}
      {stauAuf && (
        <div className="st-heute-stau">
          {p.rueckstau.map((z) => <HeuteZeile key={`r${z.schluessel}`} z={z} />)}
          {p.rueckstauGesamt > p.rueckstau.length && (
            <p className="st-heute-hinweis">… und {p.rueckstauGesamt - p.rueckstau.length} weitere — sie stehen in Tasks, Inkasso und in der Pipeline.</p>
          )}
        </div>
      )}
      <p className="st-heute-stand">Stand {uhr(daten.stand)} Uhr · {p.kapazitaet} Plätze nach deiner Arbeitszeit</p>
    </section>
  );
}
