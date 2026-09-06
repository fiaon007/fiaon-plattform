// ═══════════════════════════════════════════════════════════════════════════
// /app/mehr/abo — GELD UND ABO (Bauvorlage 3.14, Scheibe 6, 06.09.2026)
//
// Paket, monatlicher Betrag, nächste Rate (aus b.abo.naechste), der Satz
// „Kündbar zum Monatsende, formlos per E-Mail.“ und ein STILLER Textlink
// „Abo kündigen“ → mailto:support@fiaon.com mit Kundennummer im Betreff (die
// Seite /abo-kuendigen ist ein Du-Formular mit Prüfvorbehalt und passt nicht
// zum Satz — Prüfung 06.09.2026). Kein Verlust-Satz, kein Rabatt, kein
// Halten — Grundsatz 02.09.: Marketing bis Kunde, Stopp absolut.
//
// Verlängerungsfrage (E-024), nur wenn b.abo.verlaengerung.gefragt und noch
// nicht entschieden: „Ihre {n} Raten sind gezahlt — möchten Sie weitermachen?“
// Zwei GLEICHWERTIGE Knöpfe → POST /kunde/:ref/abo/verlaengerung { bleiben }
// (fiaon-kunde-bereich.ts:59ff.). Antwort { ok, verlaengert, meldung } — der
// Satz des Servers wird gezeigt, die Frage verschwindet. 409 = Laufzeit noch
// nicht erreicht → Fehlersatz vom Server.
// ═══════════════════════════════════════════════════════════════════════════
import { useState } from "react";
import { Link } from "wouter";
import type { Bereich } from "./typen";
import { api, eur } from "./Bausteine";
import { ereignisMelden } from "./Bericht";
import "@/styles/app-antraege.css";
import "@/styles/app-bericht.css";

export function Abo({ kundeRef, basis, demo, b }: { kundeRef: string; basis: string; demo: boolean; b: Bereich }) {
  const v = b.abo?.verlaengerung ?? null;
  const n = b.abo?.naechste ?? null;
  const [entschieden, setEntschieden] = useState<{ verlaengert: boolean; meldung: string } | null>(null);
  const [laeuft, setLaeuft] = useState<"bleiben" | "beenden" | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  // „geoeffnet“ meldet die Schale (Bereich.tsx, /mehr/abo) — hier nur „knopf“ und „fertig“.
  const frageOffen = !!v?.gefragt && !v.entschieden && !entschieden;
  const bezahlteRaten = v?.bezahlteRaten ?? b.abo?.bezahlt ?? 0;

  const antworten = async (bleiben: boolean) => {
    if (demo) { setEntschieden({ verlaengert: bleiben, meldung: "In der Demo-Ansicht wird nichts geändert." }); return; }
    setLaeuft(bleiben ? "bleiben" : "beenden"); setFehler(null);
    ereignisMelden(kundeRef, demo, "abo", "knopf");
    try {
      const r = await api(`/kunde/${encodeURIComponent(kundeRef)}/abo/verlaengerung`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bleiben }) });
      if (r.ok && r.json?.ok) {
        setEntschieden({ verlaengert: !!r.json.verlaengert, meldung: String(r.json.meldung || (r.json.verlaengert ? "Ihr Abo läuft weiter." : "Ihr Abo endet mit der letzten Rate.")) });
        ereignisMelden(kundeRef, demo, "abo", "fertig");
      } else {
        setFehler(String(r.json?.error || "Ihre Antwort konnte gerade nicht gespeichert werden. Bitte versuchen Sie es in einem Moment noch einmal."));
      }
    } catch {
      setFehler("Ohne Verbindung lässt sich Ihre Antwort nicht speichern. Bitte versuchen Sie es gleich noch einmal.");
    }
    setLaeuft(null);
  };

  // Stand des Abos in einem Satz — nur aus Datenfeldern.
  const standSatz = (): string | null => {
    if (!b.paket.abo) return null;
    if (entschieden) return entschieden.verlaengert ? "Verlängert – Ihr Abo läuft weiter." : "Endet mit der letzten Rate.";
    if (v?.beendet) return "Endet mit der letzten Rate.";
    if (v?.verlaengert) return "Verlängert – Ihr Abo läuft weiter.";
    return null;
  };

  return (
    <>
      <Link href={`${basis}/mehr`} className="ap-textknopf ap-auf">← Zurück</Link>
      <h1 className="ap-gruss ap-auf" style={{ marginTop: 0 }}>Geld und Abo<small>Ihr Paket, Ihre Rate, Ihre Laufzeit.</small></h1>
      {demo && <div className="ap-demo-band ap-auf"><b>Demo-Ansicht</b><span>Feste Vorführdaten, kein echtes Konto.</span></div>}

      {/* Verlängerungsfrage — die eine Handlung, wenn sie ansteht */}
      {frageOffen && (
        <div className="ap-karte ap-auf v1" style={{ borderLeft: "3px solid var(--fi-primaer)" }}>
          <h3>Ihre {bezahlteRaten} Raten sind gezahlt – möchten Sie weitermachen?</h3>
          <p>Weitermachen heißt: weitere zwölf Raten, die nächste entsteht sofort. Aufhören heißt: Ihr Abo endet mit der letzten Rate. Beides geht mit einem Tipp.</p>
          <div className="ap-gleich" role="group" aria-label="Weitermachen oder aufhören">
            <button type="button" className="ap-knopf still" disabled={laeuft !== null} onClick={() => antworten(false)}>{laeuft === "beenden" ? "Wird gespeichert …" : "Aufhören"}</button>
            <button type="button" className="ap-knopf still" disabled={laeuft !== null} onClick={() => antworten(true)}>{laeuft === "bleiben" ? "Wird gespeichert …" : "Weitermachen"}</button>
          </div>
          {fehler && <div className="ap-meldung fehler" role="alert">{fehler}</div>}
        </div>
      )}
      {entschieden && <div className="ap-meldung gut ap-auf" role="status">{entschieden.meldung}</div>}

      {/* Paket und Rate */}
      <div className="ap-karte ap-auf v1">
        <div className="ap-zeile"><span>Paket</span><b>{b.paket.name}</b></div>
        {b.paket.abo && b.paket.monatlichCents ? <div className="ap-zeile"><span>Monatlich</span><b>{eur(b.paket.monatlichCents)}</b></div> : null}
        {!b.paket.abo && <div className="ap-zeile"><span>Art</span><b>Einmaliger Auftrag</b></div>}
        {b.paket.abo && n && (
          <div className="ap-zeile"><span>Nächste Rate</span><b>{eur(n.betragCents)}{n.faelligAm ? ` · fällig ${n.faelligAm}` : ""}</b></div>
        )}
        {b.paket.abo && !n && b.stufe.bezahlt && <div className="ap-zeile"><span>Nächste Rate</span><b>Keine offen</b></div>}
        {b.paket.abo && !b.stufe.bezahlt && <div className="ap-zeile"><span>Erste Zahlung</span><b>Noch nicht eingegangen</b></div>}
        {b.paket.abo && (
          <div className="ap-zeile"><span>Raten</span><b>{b.abo?.bezahlt ?? 0} gezahlt · {b.abo?.offen ?? 0} offen</b></div>
        )}
        {b.paket.abo && <div className="ap-zeile"><span>Zahlungsweg</span><b>{b.lastschrift.aktiv ? "Bankeinzug" : b.lastschrift.mandat ? "Bankeinzug – Bank bestätigt gerade" : "Überweisung"}</b></div>}
        {standSatz() && <div className="ap-zeile"><span>Laufzeit</span><b>{standSatz()}</b></div>}
        <Link href={`${basis}/geld`} className="ap-link" style={{ display: "inline-block", marginTop: 12 }}>Alle Raten und Zahlungsweg →</Link>
      </div>

      {/* Berichte */}
      <div className="ap-karte ap-linkliste ap-auf v2">
        <Link href={`${basis}/geld/bericht`}>Monatsberichte</Link>
        <Link href={`${basis}/geld/zahlen`}>Rate zahlen</Link>
      </div>

      {/* Kündigung: der Satz und ein stiller Link, sonst nichts */}
      {b.paket.abo && !v?.beendet && !(entschieden && !entschieden.verlaengert) && (
        <div className="ap-auf v3" style={{ display: "grid", gap: 2 }}>
          <p className="ap-fuss">Kündbar zum Monatsende, formlos per E-Mail.</p>
          {/* Nicht /abo-kuendigen: die Seite ist ein Du-Formular mit Pflichtgrund und Prüfvorbehalt — weder „formlos“ noch „per E-Mail“ noch Sie.
              Bis sie umgestellt ist, führt der Link dorthin, was der Satz verspricht: eine formlose E-Mail. */}
          <a href={`mailto:support@fiaon.com?subject=${encodeURIComponent(`Kündigung Kundennummer ${kundeRef}`)}`} className="ap-textknopf still" onClick={() => ereignisMelden(kundeRef, demo, "abo", "knopf")}>Abo kündigen</a>
        </div>
      )}
    </>
  );
}
