// ═══════════════════════════════════════════════════════════════════════════
// CHEFBÜRO › GLOBAL-KUNDEN › GESPRÄCHE (E-458 Nr. 11, 29.10.2026)
//
// Justin („go Plan“, 29.10.): Kein Global-Gespräch geht mehr verloren. Bis heute
// setzte ein Lauf jedes Gespräch zwölf Stunden nach dem Termin still auf
// „verpasst“ — alle drei, die es je gab, stehen so da, ohne Grund. Jetzt fragt
// das System die zuständige Person nach dem Ergebnis, und am nächsten Werktag
// um 9 Uhr die Leitung. Diese Leiste ist der Ort der Leitung: was ohne Ergebnis
// ist (mit den drei Knöpfen), was geplant ist (mit den Erinnerungen) und was
// zuletzt war. Keine eigene Seite — eine Leiste im Raum Global-Kunden, unter dem
// Kopf. Die Erinnerung an die Leitung verlinkt hierher (?gespraeche=offen).
// Dieselben Wege wie der Kalender: globalTerminErgebnis, globalGespraechVerschieben.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { useSearch } from "wouter";
import { useDaten } from "./chef-teile";
import { NACHLADEN_MS, senden } from "./chef-global-kunden-teile";
import { GLOBAL_ERGEBNIS_WAHL, NICHT_ERREICHT_FRAGE, type GlobalErgebnisWahl } from "@shared/fiaon-global-gespraech";

interface Zeile {
  id: number; beginn: string; dauerMin: number; status: string; herkunft: string | null;
  name: string; firma: string | null; kontakt: string | null; telefon: string | null; email: string | null; wer: string | null;
  vortagAm: string | null; kurzAm: string | null; ergebnisAufgabeAm: string | null; leitungAm: string | null;
  nichtErreichtMailAm: string | null; erledigtAm: string | null; verpasstGrund: string | null;
}
interface Stand { ok: true; offen: Zeile[]; kommend: Zeile[]; zuletzt: Zeile[]; vertretung: { id: number; name: string } | null }

const wann = (iso: string) => new Date(iso).toLocaleString("de-DE", {
  timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
});
/** Berliner Wandzeit im Format von datetime-local — vorgefüllt mit der bisherigen Zeit (wie im Kalender, 26.08.2026). */
function feldWert(iso: string): string {
  try {
    return new Intl.DateTimeFormat("sv-SE", {
      timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(new Date(iso)).replace(" ", "T").slice(0, 16);
  } catch { return ""; }
}
const GRUND: Record<string, string> = {
  nicht_erschienen: "nicht erreicht", nummer_falsch: "Nummer stimmte nicht", abgesagt: "abgesagt", kein_interesse: "kein Interesse",
};
function ausgang(z: Zeile): string {
  if (z.status === "erledigt") return "Stattgefunden";
  if (z.status === "abgesagt") return "Abgesagt";
  if (z.status === "verpasst") return `Kam nicht zustande · ${GRUND[z.verpasstGrund ?? ""] ?? "nicht erreicht"}${z.nichtErreichtMailAm ? " · Mail ging raus" : ""}`;
  return z.status;
}
const folge = (k: GlobalErgebnisWahl) => GLOBAL_ERGEBNIS_WAHL.find((w) => w.key === k)?.folge ?? "";

export default function ChefGlobalGespraeche() {
  const such = useSearch();
  const ausLink = (() => { try { return new URLSearchParams(such).get("gespraeche") === "offen"; } catch { return false; } })();
  const { daten, fehler, neu } = useDaten<Stand>("/chef/global/gespraeche", [], NACHLADEN_MS);
  const [auf, setAuf] = useState(ausLink);
  const [laeuft, setLaeuft] = useState<number | null>(null);
  const [meldung, setMeldung] = useState<{ text: string; gut: boolean } | null>(null);
  const [schieben, setSchieben] = useState<{ id: number; wert: string } | null>(null);
  const offen = daten?.offen ?? []; const kommend = daten?.kommend ?? []; const zuletzt = daten?.zuletzt ?? [];

  // Fehlt irgendwo ein Ergebnis, steht die Leiste offen — das ist die Arbeit.
  useEffect(() => { if (offen.length) setAuf(true); }, [offen.length]);
  useEffect(() => {
    if (ausLink && daten) window.requestAnimationFrame(() => document.getElementById("cgg")?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [ausLink, !!daten]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!meldung) return; const t = window.setTimeout(() => setMeldung(null), 9000); return () => window.clearTimeout(t); }, [meldung]);

  const eintragen = async (z: Zeile, wahl: "stattgefunden" | "nicht_erreicht") => {
    if (wahl === "nicht_erreicht" && !window.confirm(NICHT_ERREICHT_FRAGE)) return;
    setLaeuft(z.id); setMeldung(null);
    const j = await senden(`/chef/global/gespraeche/${z.id}/ergebnis`, "POST", { ergebnis: wahl });
    setLaeuft(null);
    setMeldung({ text: j.ok ? String(j.meldung ?? "Vermerkt.") : String(j.error), gut: j.ok });
    if (j.ok) neu();
  };
  const verschieben = async () => {
    if (!schieben?.wert) return;
    setLaeuft(schieben.id); setMeldung(null);
    const j = await senden(`/chef/global/gespraeche/${schieben.id}/verschieben`, "POST", { beginn: schieben.wert });
    setLaeuft(null);
    setMeldung({ text: j.ok ? String(j.meldung ?? "Verschoben.") : String(j.error), gut: j.ok });
    if (j.ok) { setSchieben(null); neu(); }
  };

  const schiebenFeld = (z: Zeile) => schieben?.id === z.id && (
    <div className="cgg-schieben">
      <input type="datetime-local" value={schieben.wert} aria-label="Neue Zeit (deutsche Zeit)"
        onChange={(e) => setSchieben({ id: z.id, wert: e.target.value })} />
      <button type="button" className="cgn-knopf klein haupt" disabled={laeuft === z.id || !schieben.wert} onClick={() => void verschieben()}>Neue Zeit speichern</button>
      <button type="button" className="cgn-link leise" onClick={() => setSchieben(null)}>abbrechen</button>
      <small>{folge("verschoben")}</small>
    </div>
  );

  return (
    <section className="cgg" id="cgg" aria-label="Global-Gespräche" data-cgn="gespraeche">
      <button type="button" className="cgg-kopf" aria-expanded={auf} onClick={() => setAuf((v) => !v)}>
        <span className="cgn-auge">Gespräche</span>
        <span className="cgg-zahl"><b className={offen.length ? "an" : ""}>{offen.length}</b> ohne Ergebnis</span>
        <span className="cgg-zahl"><b>{kommend.length}</b> geplant</span>
        <span className="cgg-pfeil">{auf ? "ausblenden" : "zeigen"}</span>
      </button>

      {auf && (
        <div className="cgg-inhalt">
          {fehler && <p className="cgn-fehler" role="alert">{fehler}</p>}

          {offen.length > 0 && (
            <div className="cgg-gruppe" data-cgn="gespraeche-offen">
              <span className="cgg-titel">Ergebnis fehlt</span>
              {offen.map((z) => (
                <div key={z.id} className="cgg-zeile offen">
                  <div className="cgg-wer">
                    <b>{z.name}</b>
                    <small>{wann(z.beginn)} Uhr · {z.wer ?? "—"}{z.leitungAm ? " · Leitung erinnert" : z.ergebnisAufgabeAm ? " · Aufgabe gestellt" : ""}{z.telefon ? ` · ${z.telefon}` : ""}</small>
                  </div>
                  <div className="cgg-knoepfe">
                    {GLOBAL_ERGEBNIS_WAHL.map((w) => (
                      <button key={w.key} type="button" title={w.folge} disabled={laeuft === z.id || (w.key === "verschoben" && z.status !== "gebucht")}
                        className={`cgn-knopf klein${w.key === "stattgefunden" ? " haupt" : ""}`}
                        onClick={() => (w.key === "verschoben" ? setSchieben({ id: z.id, wert: feldWert(z.beginn) }) : void eintragen(z, w.key as "stattgefunden" | "nicht_erreicht"))}>
                        {w.text}
                      </button>
                    ))}
                  </div>
                  {schiebenFeld(z)}
                </div>
              ))}
            </div>
          )}

          <div className="cgg-gruppe">
            <span className="cgg-titel">Geplant</span>
            {kommend.length === 0 && <p className="cgg-leer">Gerade ist kein Gespräch gebucht.</p>}
            {kommend.map((z) => (
              <div key={z.id} className="cgg-zeile">
                <div className="cgg-wer">
                  <b>{z.name}</b>
                  <small>{wann(z.beginn)} Uhr · {z.wer ?? "—"}{z.vortagAm ? " · am Vortag erinnert" : ""}{z.kurzAm ? " · 1 Std. vorher erinnert" : ""}</small>
                </div>
                <div className="cgg-knoepfe">
                  <button type="button" className="cgn-knopf klein" title={folge("verschoben")} disabled={laeuft === z.id}
                    onClick={() => setSchieben({ id: z.id, wert: feldWert(z.beginn) })}>Verschieben</button>
                </div>
                {schiebenFeld(z)}
              </div>
            ))}
          </div>

          {zuletzt.length > 0 && (
            <div className="cgg-gruppe">
              <span className="cgg-titel">Zuletzt</span>
              {zuletzt.map((z) => (
                <div key={z.id} className="cgg-zeile still">
                  <div className="cgg-wer"><b>{z.name}</b><small>{wann(z.beginn)} Uhr · {z.wer ?? "—"}</small></div>
                  <span className="cgg-ausgang">{ausgang(z)}</span>
                </div>
              ))}
            </div>
          )}

          <p className="cgg-fuss">
            Erinnerungen am Vortag und eine Stunde vorher gehen von selbst. Fehlt ein Ergebnis am nächsten Werktag um 9 Uhr, erinnert dich das System.
            {" "}Vertretung: <b>{daten?.vertretung?.name ?? "keine"}</b> · <a href="/chef/rueckholung">festlegen</a>
          </p>
        </div>
      )}
      {meldung && <p className={`cgg-meldung${meldung.gut ? " gut" : ""}`} role="status">{meldung.text}</p>}
    </section>
  );
}
