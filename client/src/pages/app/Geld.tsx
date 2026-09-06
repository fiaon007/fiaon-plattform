// /app/geld — Gesetz 1: Jeder Monat hat einen Betrag, den der Kunde nachrechnen
// kann (Bauvorlage 3.9). Nächste Rate, Überweisung mit GiroCode, Raten als
// Zahlungsnachweis, Bankeinzug, Paket. Bankdaten AUSSCHLIESSLICH aus
// shared/fiaon-bank.ts. „Ich habe überwiesen“ ist kein Status — der Haken kommt
// mit dem Geldeingang.
import { useState } from "react";
import { Link } from "wouter";
import { BANK } from "@shared/fiaon-bank";
import type { Rahmenweg } from "@shared/fiaon-rahmenweg";
import type { Bereich } from "./typen";
import { api, eur } from "./Bausteine";

function Kopieren({ wert }: { wert: string }) {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" className="ap-link" style={{ background: "none", border: 0, padding: "0 0 0 8px", fontSize: 13, whiteSpace: "nowrap" }}
      onClick={async () => { try { await navigator.clipboard.writeText(wert); setOk(true); setTimeout(() => setOk(false), 1600); } catch { /* kein Zugriff */ } }}>
      {ok ? "Kopiert" : "Kopieren"}
    </button>
  );
}

export function Geld({ b, rw, kundeRef, basis, demo }: { b: Bereich; rw: Rahmenweg; kundeRef: string; basis: string; demo: boolean }) {
  const [lsMeldung, setLsMeldung] = useState<string | null>(null);
  const [lsLaeuft, setLsLaeuft] = useState(false);
  const n = b.abo?.naechste ?? null;
  const zweck = n?.referenz || b.paket.zahlungsreferenz || kundeRef;
  const ueberfaellig = rw.raten.ueberfaellig;
  const einzugMoeglich = b.stufe.bezahlt && b.paket.abo && !b.lastschrift.aktiv && !b.lastschrift.mandat;

  const einzugStarten = async () => {
    if (demo) { setLsMeldung("In der Demo-Ansicht wird kein Bankeinzug eingerichtet."); return; }
    setLsLaeuft(true); setLsMeldung(null);
    const r = await api(`/kunde/${encodeURIComponent(kundeRef)}/lastschrift/start`, { method: "POST" });
    setLsLaeuft(false);
    const url = r.json?.url; // flowStarten liefert { ok, url } (authorisation_url) — TFO, 05.09.
    if (r.ok && url) { window.location.href = url; return; }
    setLsMeldung(r.json?.error || "Der Bankeinzug lässt sich gerade nicht einrichten. Bitte versuchen Sie es in einem Moment noch einmal.");
  };

  return (
    <>
      <h1 className="ap-gruss ap-auf">Ihr Geld<small>Raten, Zahlungsweg und Nachweis – alles an einem Ort.</small></h1>

      {b.paket.abo && (n || !b.stufe.bezahlt) && (
        <div className="ap-karte ap-auf v1">
          <h2 className="ap-abschnitt-titel" style={{ padding: 0 }}>{!b.stufe.bezahlt ? "Ihre erste Zahlung" : "Nächste Rate"}</h2>
          <div className="ap-zahl" style={{ marginTop: 6 }}>{eur(n?.betragCents ?? b.paket.monatlichCents ?? 0)}</div>
          <p style={{ marginTop: 4 }}>
            {n ? <>Rate {n.nr} von {rw.raten.gesamt || 12}{ueberfaellig && ueberfaellig.nr === n.nr ? ` · offen seit ${ueberfaellig.seit ?? "Fälligkeit"}` : n.faelligAm ? ` · fällig am ${n.faelligAm}` : ""}</> : "Mit dem Eingang beginnt die Arbeit an Ihrer Akte."}
          </p>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 13, color: "var(--fi-text-still)" }}>Verwendungszweck</div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8, marginTop: 2 }}><span className="ap-mono" style={{ fontSize: 16, overflowWrap: "anywhere" }}>{zweck}</span><Kopieren wert={zweck} /></div>
          </div>
          {b.lastschrift.aktiv && <p style={{ fontSize: 14, marginTop: 10 }}>Wird zum Fälligkeitstag per Bankeinzug angefordert – Sie müssen nicht überweisen.</p>}
          {!b.lastschrift.aktiv && b.lastschrift.mandat && <p style={{ fontSize: 14, marginTop: 10 }}>Ihre Bank bestätigt den Bankeinzug gerade.</p>}
        </div>
      )}

      {(n || !b.stufe.bezahlt) && !b.lastschrift.aktiv && (
        <Link href={`${basis}/geld/zahlen`} className="ap-knopf ap-auf v2">{!b.stufe.bezahlt ? "Jetzt zahlen" : "Rate zahlen"}</Link>
      )}

      {b.paket.abo && rw.raten.gesamt > 0 && (
        <section className="ap-abschnitt ap-auf v3">
          <h2 className="ap-abschnitt-titel">Ihre Raten — zugleich Ihr Zahlungsnachweis</h2>
          <div className="ap-karte">
            <b style={{ fontSize: 16, fontWeight: 500 }}>{rw.raten.puenktlich} von {rw.raten.gesamt} Raten pünktlich</b>
            <p style={{ fontSize: 14 }}>Jede pünktlich gezahlte Rate ist zugleich Ihr Zahlungsnachweis – und ein Schritt auf Ihrem Weg.</p>
            <ol className="ap-etappen" style={{ marginTop: 8 }}>
              {b.abo.raten.map((r) => {
                const bez = r.status === "bezahlt";
                const ueber = !bez && !!r.faelligIso && ueberfaellig?.nr === r.nr;
                return (
                  <li key={r.nr} className={`ap-etappe ${bez ? "fertig" : "kommt"}`}>
                    <span className={`ap-punkt ${bez ? "fertig" : ""}`} style={ueber ? { borderColor: "var(--fi-warnung)" } : undefined}>{bez ? "✓" : <span style={{ color: ueber ? "var(--fi-warnung)" : "var(--fi-text-still)", fontSize: 12 }}>{r.nr}</span>}</span>
                    <div><b className="ap-mono" style={{ fontSize: 15 }}>{eur(r.betragCents)}</b><small>Rate {r.nr} · fällig {r.faelligAm ?? "–"}{bez ? ` · gezahlt am ${r.bezahltAm ?? "–"}` : ueber ? " · offen" : ""}</small></div>
                    <span />
                  </li>
                );
              })}
            </ol>
          </div>
        </section>
      )}

      {einzugMoeglich && (
        <section className="ap-abschnitt ap-auf v4">
          <h2 className="ap-abschnitt-titel">Bankeinzug</h2>
          <div className="ap-karte">
            <p style={{ margin: 0 }}>Bankeinzug einrichten – jede weitere Rate wird zum Fälligkeitstag angefordert. Ihre IBAN geben Sie bei GoCardless ein, FIAON sieht sie nie.</p>
            <button type="button" className="ap-knopf still" style={{ marginTop: 14 }} onClick={einzugStarten} disabled={lsLaeuft}>{lsLaeuft ? "Einen Moment …" : "Einrichten"}</button>
            {lsMeldung && <div className="ap-meldung" role="status">{lsMeldung}</div>}
          </div>
        </section>
      )}

      <section className="ap-abschnitt ap-auf v4">
        <h2 className="ap-abschnitt-titel">Ihre Berichte</h2>
        <div className="ap-karte">
          <p style={{ margin: 0 }}>Jeden Monatsersten ein Beleg: was für Sie geholt wurde, was beantragt ist, welche Raten gezahlt sind – Zeile für Zeile nachrechenbar.</p>
          <Link href={`${basis}/geld/bericht`} className="ap-link" style={{ display: "inline-block", marginTop: 10 }}>Alle Berichte →</Link>
        </div>
      </section>

      <div className="ap-karte ap-auf v4">
        <div className="ap-zeile"><span>Ihr Paket</span><b style={{ fontWeight: 500 }}>{b.paket.name}{b.paket.abo && b.paket.monatlichCents ? ` · ${eur(b.paket.monatlichCents)} im Monat` : ""}</b></div>
        <p style={{ fontSize: 14, marginTop: 6 }}>{b.paket.abo ? "Kündbar zum Monatsende, formlos per E-Mail." : "Einmaliger Auftrag."} <Link href={`${basis}/mehr`} className="ap-link">Mehr</Link></p>
      </div>
    </>
  );
}
