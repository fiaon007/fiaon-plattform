// /app/geld/zahlen — Rate zahlen (Bauvorlage 3.10): der eine offene Zahlungsauftrag,
// drei Wege. Weg 1 Bank-App (Sofortzahlung, Betrag und Zweck vorausgefüllt), Weg 2
// Überweisen (GiroCode + Kopierzeilen aus shared/fiaon-bank.ts), Weg 3 Bankeinzug.
// „Ich habe überwiesen" ist ein Vermerk, kein Status — der Haken kommt mit dem Geld.
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { BANK } from "@shared/fiaon-bank";
import type { Bereich } from "./typen";
import { api, eur } from "./Bausteine";

interface Offen { art: "erstzahlung" | "rate"; referenz: string; betragCents: number; faelligAm: string | null; ueberfaellig: boolean; rateNr: number | null; ratenVon: number | null; sofortUrl: string | null; qrPfad: string | null; bank: { empfaenger: string; iban: string; ibanDisplay: string; bic: string }; vermerkAm: string | null }
interface Zahlung { offen: Offen | null; lastschrift: { aktiv: boolean; wartet: boolean } }

function Kopieren({ wert }: { wert: string }) {
  const [ok, setOk] = useState(false);
  return <button type="button" className="ap-link" style={{ background: "none", border: 0, padding: "0 0 0 8px", fontSize: 13, whiteSpace: "nowrap" }} onClick={async () => { try { await navigator.clipboard.writeText(wert); setOk(true); setTimeout(() => setOk(false), 1600); } catch { /* kein Zugriff */ } }}>{ok ? "Kopiert" : "Kopieren"}</button>;
}

/** Demo: aus dem Bereich-JSON gebaut — kein Sofort-Link, kein Vermerk. */
function demoZahlung(b: Bereich): Zahlung {
  const n = b.abo?.naechste ?? null;
  if (!n) return { offen: null, lastschrift: { aktiv: b.lastschrift.aktiv, wartet: !!b.lastschrift.mandat && !b.lastschrift.aktiv } };
  return { offen: { art: "rate", referenz: n.referenz, betragCents: n.betragCents, faelligAm: n.faelligAm, ueberfaellig: false, rateNr: n.nr, ratenVon: b.abo.raten.length || 12, sofortUrl: null, qrPfad: null, bank: { empfaenger: BANK.empfaenger, iban: BANK.iban, ibanDisplay: BANK.ibanDisplay, bic: BANK.bic }, vermerkAm: null }, lastschrift: { aktiv: b.lastschrift.aktiv, wartet: !!b.lastschrift.mandat && !b.lastschrift.aktiv } };
}

export function Zahlen({ b, kundeRef, basis, demo }: { b: Bereich; kundeRef: string; basis: string; demo: boolean }) {
  const [z, setZ] = useState<Zahlung | null>(demo ? demoZahlung(b) : null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [vermerk, setVermerk] = useState<string | null>(null);
  const [lsMeldung, setLsMeldung] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);

  useEffect(() => {
    if (demo) return;
    api(`/kunde/${encodeURIComponent(kundeRef)}/app/zahlung`).then((r) => { if (r.ok && r.json?.ok) setZ({ offen: r.json.offen, lastschrift: r.json.lastschrift }); else setFehler(r.json?.error || "Ihre Zahlungsdaten konnten gerade nicht geladen werden."); }).catch(() => setFehler("Ihre Zahlungsdaten konnten gerade nicht geladen werden."));
  }, [kundeRef, demo]);

  const gemeldet = async () => {
    if (!z?.offen) return;
    if (demo) { setVermerk("In der Demo-Ansicht wird nichts vermerkt."); return; }
    const r = await api(`/kunde/${encodeURIComponent(kundeRef)}/app/zahlung/vermerk`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ referenz: z.offen.referenz }) });
    setVermerk(r.ok && r.json?.ok ? r.json.text : (r.json?.error || "Der Vermerk konnte gerade nicht gespeichert werden."));
  };
  const einzug = async () => {
    if (demo) { setLsMeldung("In der Demo-Ansicht wird kein Bankeinzug eingerichtet."); return; }
    setLaeuft(true); setLsMeldung(null);
    const r = await api(`/kunde/${encodeURIComponent(kundeRef)}/lastschrift/start`, { method: "POST" });
    setLaeuft(false);
    if (r.ok && r.json?.url) { window.location.href = r.json.url; return; }
    setLsMeldung(r.json?.error || "Der Bankeinzug lässt sich gerade nicht einrichten. Bitte versuchen Sie es in einem Moment noch einmal.");
  };

  if (fehler) return <><Zurueck basis={basis} /><div className="ap-karte ap-leer"><b>{fehler}</b><button type="button" className="ap-knopf still" style={{ marginTop: 12 }} onClick={() => window.location.reload()}>Noch einmal</button></div></>;
  if (!z) return <><Zurueck basis={basis} /><div className="ap-skelett" style={{ height: 220, borderRadius: 14 }} /></>;

  if (!z.offen) return (
    <>
      <Zurueck basis={basis} />
      <div className="ap-karte ap-auf" style={{ textAlign: "center", padding: 24 }}>
        <svg className="ap-haken" viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="30" /><path d="M20 33l8 8 16-18" /></svg>
        <h1 className="ap-gruss" style={{ marginTop: 12 }}>Nichts offen.<small>Alle fälligen Zahlungen sind eingegangen.{z.lastschrift.aktiv ? " Die nächste Rate wird zum Fälligkeitstag per Bankeinzug angefordert." : ""}</small></h1>
        <Link href={`${basis}/geld`} className="ap-knopf still" style={{ marginTop: 18 }}>Zurück zu Ihrem Geld</Link>
      </div>
    </>
  );

  const o = z.offen;
  const titel = o.art === "erstzahlung" ? "Ihre erste Zahlung" : `Rate ${o.rateNr} von ${o.ratenVon ?? 12}`;
  return (
    <>
      <Zurueck basis={basis} />
      <div className="ap-auf">
        <h1 className="ap-gruss">{titel}</h1>
        <div className="ap-zahl" style={{ marginTop: 6 }}>{eur(o.betragCents)}</div>
        <p className="ap-ruhe" style={{ marginTop: 4 }}>{o.ueberfaellig ? <>Seit <b>{o.faelligAm}</b> offen.</> : o.faelligAm ? <>Fällig am <b>{o.faelligAm}</b>.</> : null}</p>
        <div style={{ marginTop: 12 }}>
          <div style={{ fontSize: 13, color: "var(--fi-text-still)" }}>Verwendungszweck</div>
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}><span className="ap-mono" style={{ fontSize: 17, overflowWrap: "anywhere" }}>{o.referenz}</span><Kopieren wert={o.referenz} /></div>
        </div>
      </div>

      {z.lastschrift.aktiv && <div className="ap-karte ap-auf v1"><h3>Bankeinzug eingerichtet</h3><p>Diese Rate wird zum Fälligkeitstag per Bankeinzug angefordert – Sie müssen nicht überweisen. Die Wege unten brauchen Sie nur, wenn Ihre Bank den Einzug nicht ausführt.</p></div>}
      {z.lastschrift.wartet && <div className="ap-karte ap-auf v1"><h3>Ihre Bank bestätigt den Bankeinzug gerade</h3><p>Bis dahin können Sie diese Rate auf einem der Wege unten begleichen.</p></div>}

      {o.sofortUrl && (
        <div className="ap-karte ap-auf v1">
          <h3>Mit Ihrer Bank-App</h3>
          <p>Sie melden sich bei Ihrer Bank an – Betrag und Verwendungszweck sind schon eingetragen. Das Geld ist meist sofort da.</p>
          <a className="ap-knopf" style={{ marginTop: 14 }} href={o.sofortUrl}>Mit meiner Bank zahlen</a>
        </div>
      )}

      <section className="ap-abschnitt ap-auf v2">
        <h2 className="ap-abschnitt-titel">{o.sofortUrl ? "Oder überweisen" : "Überweisen"}</h2>
        <div className="ap-karte">
          {o.qrPfad && (
            <details open={!o.sofortUrl}>
              <summary className="ap-link" style={{ cursor: "pointer", fontSize: 15 }}>GiroCode für die Bank-App</summary>
              <img src={o.qrPfad} alt="GiroCode zum Scannen in Ihrer Bank-App" style={{ display: "block", width: 200, height: 200, margin: "12px auto 4px", borderRadius: 10, border: "1px solid var(--fi-linie)", background: "#fff" }} />
              <p className="ap-fuss" style={{ textAlign: "center" }}>In der Bank-App „Überweisen“ → „QR-Code scannen“ – Betrag und Zweck sind eingetragen.</p>
            </details>
          )}
          <dl className="ap-liste" style={{ marginTop: o.qrPfad ? 12 : 0 }}>
            <dt>Empfänger</dt><dd style={{ display: "flex", justifyContent: "space-between" }}><span>{o.bank.empfaenger}</span><Kopieren wert={o.bank.empfaenger} /></dd>
            <dt>IBAN</dt><dd style={{ display: "flex", justifyContent: "space-between" }}><span className="ap-mono">{o.bank.ibanDisplay}</span><Kopieren wert={o.bank.iban} /></dd>
            <dt>BIC</dt><dd><span className="ap-mono">{o.bank.bic}</span></dd>
            <dt>Betrag</dt><dd className="ap-mono">{eur(o.betragCents)}</dd>
            <dt>Zweck</dt><dd style={{ display: "flex", justifyContent: "space-between" }}><span className="ap-mono">{o.referenz}</span><Kopieren wert={o.referenz} /></dd>
          </dl>
          <div style={{ marginTop: 14 }}>
            {vermerk ? <div className="ap-meldung gut" role="status">{vermerk}</div>
              : o.vermerkAm ? <p className="ap-fuss">Sie haben am {o.vermerkAm} eine Überweisung gemeldet. Sobald das Geld eingeht, sehen Sie hier den Haken.</p>
              : <button type="button" className="ap-link" style={{ background: "none", border: 0, padding: 0, fontSize: 15 }} onClick={gemeldet}>Ich habe überwiesen</button>}
          </div>
        </div>
      </section>

      {o.art === "rate" && !z.lastschrift.aktiv && !z.lastschrift.wartet && (
        <section className="ap-abschnitt ap-auf v3">
          <h2 className="ap-abschnitt-titel">Für alle weiteren Raten</h2>
          <div className="ap-karte">
            <p style={{ margin: 0 }}>Bankeinzug einrichten – jede weitere Rate wird zum Fälligkeitstag angefordert. Ihre IBAN geben Sie bei GoCardless ein, FIAON sieht sie nie.</p>
            <button type="button" className="ap-knopf still" style={{ marginTop: 14 }} onClick={einzug} disabled={laeuft}>{laeuft ? "Einen Moment …" : "Bankeinzug einrichten"}</button>
            {lsMeldung && <div className="ap-meldung" role="status">{lsMeldung}</div>}
          </div>
        </section>
      )}

      <p className="ap-fuss ap-auf v4">Nach Eingang zählt die Rate als Zahlungsnachweis und als Schritt auf Ihrem Weg.</p>
    </>
  );
}

function Zurueck({ basis }: { basis: string }) {
  return <Link href={`${basis}/geld`} className="ap-link" style={{ display: "inline-flex", alignItems: "center", minHeight: 48, fontSize: 15 }}>← Zurück zu Ihrem Geld</Link>;
}
