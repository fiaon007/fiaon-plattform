// ═══════════════════════════════════════════════════════════════════════════
// BONITÄTSAUSWERTUNG — DIE ARBEITSLISTE (E-352, 14.10.2026)
//
// Daniel: „viele Kunden, die 74 € bezahlt und alles hochgeladen haben … wo ist das endlich?“
// Jeder Kunde mit bezahlter Bonitätsauskunft, sein Stand und der Weg in die Akte — dort steht
// der Knopf. Die Liste startet nichts: Jede Auswertung entsteht erst auf Knopfdruck (Justin).
// Server: GET /chef/auskunft-beschaffung/auswertungen.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { useDaten, seit } from "./chef-teile";
import { akteLink } from "@/lib/akte-link";
import "@/styles/auswertung-warteliste.css";

type StandKey = "bereit" | "laeuft" | "entwurf" | "fehlt" | "beim_kunden";
interface Zeile {
  personId: number; name: string; betreuer: string | null; bezahltAm: string | null; ausweis: boolean; kontoauszug: boolean;
  stand: StandKey; gesamt: string | null; finanzwert: number | null; vierAugen: boolean; gescheitert: boolean;
}
interface Antwort { zahlen: Record<string, number>; liste: Zeile[] }

const STAND: Record<StandKey, string> = {
  bereit: "Startklar", laeuft: "Wird entwickelt", entwurf: "Prüfen & freigeben", fehlt: "Unterlagen fehlen", beim_kunden: "Beim Kunden",
};
const FILTER: { key: StandKey; text: string }[] = [
  { key: "bereit", text: "Startklar" }, { key: "entwurf", text: "Zu prüfen" }, { key: "fehlt", text: "Unterlagen fehlen" }, { key: "beim_kunden", text: "Beim Kunden" },
];

export default function AuswertungWarteliste() {
  const d = useDaten<Antwort>("/chef/auskunft-beschaffung/auswertungen");
  const [wahl, setFilter] = useState<StandKey | null>(null);
  const a = d.daten;
  if (!a) return d.fehler ? <p className="awl-still">{d.fehler}</p> : null;
  // Ohne Wahl: die erste Gruppe, in der jemand steht (Startklar → Zu übergeben → Unterlagen fehlen → Beim Kunden).
  const anzahl = (k: StandKey) => (k === "entwurf" ? (a.zahlen.entwurf ?? 0) + (a.zahlen.laeuft ?? 0) : a.zahlen[k] ?? 0);
  const filter: StandKey = wahl ?? FILTER.find((f) => anzahl(f.key) > 0)?.key ?? "bereit";
  const zeilen = a.liste.filter((z) => (filter === "entwurf" ? z.stand === "entwurf" || z.stand === "laeuft" : z.stand === filter));
  return (
    <section className="awl" aria-label="Bonitätsauswertung">
      <header className="awl-kopf">
        <div>
          <h2>Bonitätsauswertung</h2>
          <p className="awl-still">{a.zahlen.gesamt} bezahlt · Akte öffnen, dort „Bonitätsauswertung erstellen“. Eine Auskunft muss nicht beschafft werden — die Auswertung ist die Leistung.</p>
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
      {zeilen.length === 0 ? <p className="awl-still awl-leer">Niemand in dieser Liste.</p> : (
        <ul className="awl-liste">
          {zeilen.map((z) => {
            const link = akteLink(z.personId);
            return (
              <li key={z.personId}>
                <div className="awl-wer">
                  <b>{z.name}</b>
                  <span className="awl-still">{z.betreuer ?? "ohne Betreuer"}{z.bezahltAm ? ` · bezahlt ${seit(z.bezahltAm)}` : ""}</span>
                </div>
                <span className="awl-haken">
                  <span className={z.ausweis ? "ja" : "nein"}>{z.ausweis ? "✓" : "✕"} Ausweis</span>
                  <span className={z.kontoauszug ? "ja" : "nein"}>{z.kontoauszug ? "✓" : "✕"} Kontoauszug</span>
                </span>
                <span className={`awl-stand s-${z.stand}`}>{z.gescheitert && z.stand === "bereit" ? "Letzter Lauf gescheitert" : STAND[z.stand]}</span>
                {link ? <a className="awl-auf" href={link}>Akte öffnen →</a> : <span />}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
