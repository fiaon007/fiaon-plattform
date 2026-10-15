// ═══════════════════════════════════════════════════════════════════════════
// BONITÄTSAUSWERTUNG — DIE ARBEITSLISTE (E-352, 14.10.2026)
//
// Daniel: „viele Kunden, die 74 € bezahlt und alles hochgeladen haben … wo ist das endlich?“
// Jeder zahlende Kunde, sein Stand und der Weg in die Akte — dort steht der Knopf. Die Liste
// startet nichts: Jede Auswertung entsteht erst auf Knopfdruck (Justin).
// E-364: nicht mehr nur Käufer der Auskunft, sondern jeder zahlende Paketkunde; Marke und
// Filter „Wartet auf Kartenlink“ (seit E-363 kommt der Link der Partnerbank erst nach der Bonität).
// Server: GET /chef/auskunft-beschaffung/auswertungen (server/lib/fiaon-bonitaet-arbeitsliste.ts).
// E-365 (15.10.2026): Jede Zeile sagt, worauf die Auswertung beruht — „bezahlt“, „im Paket“ (Kartenlink wartet, inklusive)
// oder „nicht gekauft“ —, und der Knopf „Käufer um Unterlagen bitten“ schreibt die Altkäufer EINMAL an (nur auf Klick).
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { useDaten, seit, API } from "./chef-teile";
import { akteLink } from "@/lib/akte-link";
import "@/styles/auswertung-warteliste.css";

type StandKey = "bereit" | "laeuft" | "entwurf" | "fehlt" | "beim_kunden";
type FilterKey = StandKey | "karte";
interface Zeile {
  personId: number; name: string; betreuer: string | null; bezahltAm: string | null; ausweis: boolean; kontoauszug: boolean;
  stand: StandKey; gesamt: string | null; finanzwert: number | null; vierAugen: boolean; gescheitert: boolean;
  paket: boolean; auskunft: boolean; gekuendigt: boolean; wartetKarte: boolean;
  /** E-365: bezahlt (74/149 €), inklusive (Kartenlink wartet) oder nicht gekauft. */
  grundlage?: "bezahlt" | "inklusive" | "nicht_gekauft";
}
interface Antwort { zahlen: Record<string, number>; liste: Zeile[]; altkaeufer?: number }

const GRUNDLAGE: Record<string, string> = { bezahlt: "bezahlt", inklusive: "im Paket", nicht_gekauft: "nicht gekauft" };

const STAND: Record<StandKey, string> = {
  bereit: "Startklar", laeuft: "Wird entwickelt", entwurf: "Prüfen & freigeben", fehlt: "Unterlagen fehlen", beim_kunden: "Beim Kunden",
};
const FILTER: { key: FilterKey; text: string }[] = [
  { key: "bereit", text: "Startklar" }, { key: "karte", text: "Wartet auf Kartenlink" }, { key: "entwurf", text: "Prüfen & freigeben" },
  { key: "fehlt", text: "Unterlagen fehlen" }, { key: "beim_kunden", text: "Beim Kunden" },
];

/** E-364: Seit jeder zahlende Kunde drinsteht (14.10.: 345 statt 73), zeigt jeder Filter erst die ersten 20 — die Beschaffung darunter bleibt erreichbar. */
const ERSTE = 20;

export default function AuswertungWarteliste() {
  const d = useDaten<Antwort>("/chef/auskunft-beschaffung/auswertungen");
  const [wahl, setWahl] = useState<FilterKey | null>(null);
  const [alle, setAlle] = useState(false);
  const [frage, setFrage] = useState(false);
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<string | null>(null);
  const setFilter = (k: FilterKey) => { setWahl(k); setAlle(false); };
  // E-365: Altkäufer einmal um Ausweis und Kontoauszug bitten — mit Rückfrage, nie automatisch.
  const altAnschreiben = async () => {
    setLaeuft(true); setMeldung(null);
    try {
      const r = await fetch(`${API}/chef/auskunft-beschaffung/auswertungen/altkaeufer`, { method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: "{}" });
      const j = await r.json().catch(() => null);
      setMeldung(j?.ok ? j.meldung : (j?.error || "Das hat nicht geklappt."));
    } catch { setMeldung("Keine Verbindung."); }
    setLaeuft(false); setFrage(false); d.neu();
  };
  const a = d.daten;
  if (!a) return d.fehler ? <p className="awl-still">{d.fehler}</p> : null;
  // Ohne Wahl: die erste Gruppe, in der jemand steht (Startklar → Kartenlink → Zu übergeben → Unterlagen fehlen → Beim Kunden).
  const anzahl = (k: FilterKey) => (k === "karte" ? a.zahlen.wartet_karte ?? 0
    : k === "entwurf" ? (a.zahlen.entwurf ?? 0) + (a.zahlen.laeuft ?? 0) : a.zahlen[k] ?? 0);
  const filter: FilterKey = wahl ?? FILTER.find((f) => anzahl(f.key) > 0)?.key ?? "bereit";
  const zeilen = a.liste.filter((z) => (filter === "karte" ? z.wartetKarte
    : filter === "entwurf" ? z.stand === "entwurf" || z.stand === "laeuft" : z.stand === filter));
  return (
    <section className="awl" aria-label="Bonitätsauswertung">
      <header className="awl-kopf">
        <div>
          <h2>Bonitätsauswertung</h2>
          <p className="awl-still">{a.zahlen.gesamt} zahlende Kunden · Akte öffnen, dort „Bonität jetzt entwickeln“. Die Auswertung ist die Leistung — eine Auskunft muss nicht beschafft werden.</p>
          <p className="awl-still" data-fiaon="awl-grundlage">{a.zahlen.bezahlt ?? 0} bezahlt · {a.zahlen.inklusive ?? 0} im Paket (Kartenlink wartet) · {a.zahlen.nicht_gekauft ?? 0} nicht gekauft</p>
          {(a.altkaeufer ?? 0) > 0 && (
            <div className="awl-alt" data-fiaon="awl-altkaeufer">
              {!frage ? (
                <button type="button" className="awl-mehr" onClick={() => setFrage(true)}>Käufer um Unterlagen bitten ({a.altkaeufer})</button>
              ) : (
                <span>
                  {a.altkaeufer} Käufer haben bezahlt, aber nie die Bitte um Ausweis und Kontoauszug bekommen. Jetzt jedem einmal den Upload-Link schicken?{" "}
                  <button type="button" className="awl-mehr" disabled={laeuft} onClick={() => void altAnschreiben()}>{laeuft ? "Schickt …" : "Ja, senden"}</button>{" "}
                  <button type="button" className="awl-mehr" disabled={laeuft} onClick={() => setFrage(false)}>Abbrechen</button>
                </span>
              )}
            </div>
          )}
          {meldung && <p className="awl-still" role="status">{meldung}</p>}
        </div>
        <div className="awl-filter" role="tablist">
          {FILTER.map((f) => {
            const n = anzahl(f.key);
            return (
              <button key={f.key} type="button" role="tab" aria-selected={filter === f.key} className={filter === f.key ? "an" : ""} onClick={() => setFilter(f.key)}>
                {f.text} <b>{n}</b>
              </button>
            );
          })}
        </div>
      </header>
      {filter === "karte" && zeilen.length > 0 && (
        <p className="awl-still">Noch kein Link draußen, kein Bestandsschutz — der Kartenlink der Partnerbank kommt erst nach der freigegebenen Bonität.</p>
      )}
      {zeilen.length === 0 ? <p className="awl-still awl-leer">Niemand in dieser Liste.</p> : (
        <ul className="awl-liste">
          {(alle ? zeilen : zeilen.slice(0, ERSTE)).map((z) => {
            const link = akteLink(z.personId);
            return (
              <li key={z.personId}>
                <div className="awl-wer">
                  <b>{z.name}</b>
                  <span className="awl-still">
                    {z.betreuer ?? "ohne Betreuer"}{z.bezahltAm ? ` · bezahlt ${seit(z.bezahltAm)}` : ""}{z.gekuendigt ? " · gekündigt, Auskunft bezahlt" : ""}
                  </span>
                </div>
                <span className="awl-haken">
                  <span className={z.ausweis ? "ja" : "nein"}>{z.ausweis ? "✓" : "✕"} Ausweis</span>
                  <span className={z.kontoauszug ? "ja" : "nein"}>{z.kontoauszug ? "✓" : "✕"} Kontoauszug</span>
                </span>
                <span className="awl-marken">
                  {z.wartetKarte && filter !== "karte" && <span className="awl-karte">wartet auf den Kartenlink</span>}
                  {z.grundlage && <span className={`awl-grund g-${z.grundlage}`}>{GRUNDLAGE[z.grundlage]}</span>}
                  <span className={`awl-stand s-${z.stand}`}>{z.gescheitert && z.stand === "bereit" ? "Letzter Lauf gescheitert" : STAND[z.stand]}</span>
                </span>
                {link ? <a className="awl-auf" href={link}>Akte öffnen →</a> : <span />}
              </li>
            );
          })}
        </ul>
      )}
      {!alle && zeilen.length > ERSTE && (
        <button type="button" className="awl-mehr" onClick={() => setAlle(true)}>Alle {zeilen.length} zeigen</button>
      )}
    </section>
  );
}
