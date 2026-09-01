// ═══════════════════════════════════════════════════════════════════════════
// /agent/firmen — DAS FIRMENKUNDEN-COCKPIT (02.09.2026, Justins Nachtauftrag)
//
// Gebaut aus Nikitas Perspektive: 50 Anrufe am Tag schaffen nur, wenn
// zwischen zwei Anrufen NICHTS im Weg steht. Deshalb:
//   · Links die Tagesliste (fällige Wiedervorlagen zuerst), ein Klick öffnet
//     die Firma rechts — mit großer Telefonnummer (tel:-Link), Website,
//     Verlauf und SIEBEN Ergebnis-Knöpfen, die alles in einem Klick
//     festhalten (Status, Wiedervorlage, Zähler).
//   · Der Tagesring zählt live auf das 50er-Ziel.
//   · Der Leitfaden klappt direkt neben dem Gespräch auf: Öffner, drei
//     Schmerzpunkte, Einwände mit Antworten, die Abschlussfrage. EHRLICH:
//     keine Exklusiv-Behauptungen, keine Garantien — die Karte der
//     Seriosität ist im B2B das stärkste Argument.
//   · Nach dem Gespräch: Info-Mail (ein Klick, vom Haus, mit dem Namen des
//     Anrufers) und der Antragslink zum Kopieren.
//   · Nachschub: Listen einfach einkleben (Import versteht CSV/Tab/Excel-
//     Kopien und überspringt Doppelte).
// ═══════════════════════════════════════════════════════════════════════════
import { useCallback, useEffect, useState } from "react";
import { AgentShell } from "./shared";
import { useOffice } from "./OfficeShell";
import "@/styles/office-firmen.css";

async function api(pfad: string, init?: RequestInit) {
  const res = await fetch(`/api/fiaon${pfad}`, {
    credentials: "include",
    headers: init?.body ? { "Content-Type": "application/json" } : undefined,
    ...init,
  });
  const json = await res.json().catch(() => null);
  return { ok: res.ok && json?.ok, json };
}

const STATUS_TEXT: Record<string, [string, string]> = {
  neu: ["neu", "still"], in_arbeit: ["in Arbeit", "blau"], wiedervorlage: ["Wiedervorlage", "warte"],
  termin: ["Termin steht", "gut"], antrag: ["Antrag läuft", "gut"],
  kein_interesse: ["kein Interesse", "still"], ungueltig: ["ungültig", "still"],
};
const ERGEBNIS_KNOEPFE: [string, string, string][] = [
  ["erreicht_interesse", "Erreicht — Interesse", "gut"],
  ["erreicht_termin", "Erreicht — Termin vereinbart", "gut"],
  ["erreicht_antrag", "Erreicht — macht den Antrag", "gut"],
  ["erreicht_kein_interesse", "Erreicht — kein Interesse", "still"],
  ["nicht_erreicht", "Nicht erreicht", "still"],
  ["mailbox", "Mailbox", "still"],
  ["nummer_falsch", "Nummer falsch", "rot"],
];

const LEITFADEN = [
  { t: "Der Öffner (10 Sekunden)", s: [
    "„Guten Tag, [Name] von FIAON — ich halte Sie kurz: Wir helfen Unternehmen, ihre Firmen-Bonität bei Creditreform, SCHUFA und KSV in Ordnung zu bringen. Darf ich Ihnen in einem Satz sagen, warum sich das für Sie rechnet?“",
    "Dann SOFORT der eine Satz: „Über Ihre Kreditlinien, Leasingverträge und Lieferantenkonditionen entscheidet Ihre Auskunftei-Akte — und da stehen bei den meisten Unternehmen Dinge, die längst erledigt sind oder nicht stimmen.“",
  ]},
  { t: "Die drei Schmerzpunkte (den passenden wählen)", s: [
    "LIQUIDITÄT: „Wann hat Ihre Bank zuletzt die Konditionen erhöht oder die Linie gekürzt — und hat sie Ihnen gesagt, WARUM? Meist steht der Grund in der Auskunftei-Akte, nicht in Ihren Zahlen.“",
    "ALTE EINTRÄGE: „Ein erledigter Eintrag verschwindet nicht von selbst. Er kostet Sie jeden Monat Geld, ohne dass Sie ihn je zu Gesicht bekommen.“",
    "BLINDFLUG: „Die Auskunfteien kennen Ihre Firma besser als Sie deren Akte. Wir drehen das um: Sie sehen alles, erklärt in Menschensprache — und was angreifbar ist, greifen wir an.“",
  ]},
  { t: "Was FIAON konkret tut (ehrlich, ohne Übertreibung)", s: [
    "Mit Vollmacht beschaffen wir die Firmen-Auskünfte (Creditreform, SCHUFA, KSV), erklären jeden Eintrag und legen für alles Angreifbare anwaltlich geprüfte Schreiben vor — der Kunde gibt frei, wir versenden und verfolgen die Antworten.",
    "NIE versprechen: Löschung „garantiert“, bestimmte Scores, Kredite oder Karten. Die Entscheidung trifft immer die Bank/Auskunftei — WIR liefern die bestmögliche Akte dafür.",
  ]},
  { t: "Einwände", s: [
    "„Macht mein Steuerberater.“ — „Ihr Steuerberater macht Ihre Zahlen. Die Auskunftei-Akte ist eine ANDERE Baustelle: Da geht es um Datenschutzrecht und Fristen, nicht um Buchhaltung. Genau dafür sind wir da.“",
    "„Keine Zeit.“ — „Deshalb rufe ich an: Sie unterschreiben einmal die Vollmacht, alles Weitere sehen Sie bequem im Firmenbereich. Ihr Zeiteinsatz: zehn Minuten.“",
    "„Was kostet das?“ — „Die Geschäftspakete starten bei 39,99 € im Monat, monatlich kündbar. Eine einzige bessere Finanzierungskondition holt das um ein Vielfaches wieder rein.“",
    "„Seriös?“ — „Prüfen Sie uns an drei Punkten: Wir garantieren keine Löschungen, wir vermitteln keine Kredite, und jedes Schreiben sehen Sie vor dem Versand. Wer Ihnen mehr verspricht, will Vorkasse.“",
  ]},
  { t: "Der Abschluss", s: [
    "„Ich schicke Ihnen jetzt die kurze Info-Mail mit dem Einstiegslink — die Anmeldung dauert online wenige Minuten. Schaffen Sie das heute noch, oder sollen wir gleich einen festen Termin machen?“",
    "Termin > vage Zusage. Wer zögert: Termin-Knopf, morgen früh.",
  ]},
];

export default function AgentFirmenPage() { return <AgentShell><FirmenInnen /></AgentShell>; }

function FirmenInnen() {
  const { dunkel, titel } = useOffice();
  useEffect(() => { dunkel(true); titel("Firmenkunden"); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const [firmen, setFirmen] = useState<any[]>([]);
  const [zahlen, setZahlen] = useState<any>({});
  const [filter, setFilter] = useState("arbeit");
  const [suche, setSuche] = useState("");
  const [aktiv, setAktiv] = useState<any | null>(null);
  const [verlauf, setVerlauf] = useState<any[] | null>(null);
  const [notiz, setNotiz] = useState("");
  const [leitfadenAuf, setLeitfadenAuf] = useState(false);
  const [importAuf, setImportAuf] = useState(false);
  const [importText, setImportText] = useState("");
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [meldung, setMeldung] = useState<string | null>(null);

  const sag = (t: string) => { setMeldung(t); setTimeout(() => setMeldung(null), 6000); };

  const laden = useCallback(async () => {
    const r = await api(`/agent/firmen/liste?filter=${filter}&q=${encodeURIComponent(suche)}`);
    if (r.ok) { setFirmen(r.json.firmen || []); setZahlen(r.json.zahlen || {}); }
  }, [filter, suche]);
  useEffect(() => { const t = setTimeout(() => void laden(), 250); return () => clearTimeout(t); }, [laden]);

  const oeffnen = async (f: any) => {
    setAktiv(f); setVerlauf(null); setNotiz("");
    const r = await api(`/agent/firmen/${f.id}`);
    if (r.ok) { setAktiv(r.json.firma); setVerlauf(r.json.verlauf || []); }
  };

  const ergebnis = async (wert: string) => {
    if (!aktiv) return;
    setLaeuft(wert);
    const r = await api(`/agent/firmen/${aktiv.id}/anruf`, {
      method: "POST",
      body: JSON.stringify({ ergebnis: wert, notiz: notiz.trim() || undefined }),
    });
    setLaeuft(null);
    if (!r.ok) return sag(r.json?.error || "Konnte das Ergebnis nicht speichern.");
    setNotiz("");
    sag("Festgehalten — nächster Anruf.");
    if (wert === "erreicht_antrag") sag("Stark! Status „Antrag läuft“ — schick ihm gleich die Info-Mail mit dem Link.");
    await laden();
    const neu = await api(`/agent/firmen/${aktiv.id}`);
    if (neu.ok) { setAktiv(neu.json.firma); setVerlauf(neu.json.verlauf || []); }
  };

  const infoMail = async () => {
    if (!aktiv) return;
    setLaeuft("mail");
    const r = await api(`/agent/firmen/${aktiv.id}/mail`, { method: "POST", body: "{}" });
    setLaeuft(null);
    sag(r.ok ? "Info-Mail ist raus — mit deinem Namen als Ansprechpartner." : (r.json?.error || "Mail fehlgeschlagen."));
    if (r.ok) void oeffnen(aktiv);
  };

  const linkKopieren = async () => {
    try {
      await navigator.clipboard.writeText("https://fiaon.com/business");
      sag("Antragslink kopiert — z. B. für WhatsApp Business.");
    } catch { sag("Kopieren nicht möglich — Link: fiaon.com/business"); }
  };

  const importieren = async () => {
    setLaeuft("import");
    const r = await api("/agent/firmen/import", { method: "POST", body: JSON.stringify({ text: importText }) });
    setLaeuft(null);
    if (r.ok) {
      sag(`${r.json.neu} neue Firmen aufgenommen, ${r.json.doppelt} Doppelte übersprungen.`);
      setImportText(""); setImportAuf(false); void laden();
    } else sag(r.json?.error || "Import fehlgeschlagen.");
  };

  const anrufe = Number(zahlen.anrufe_heute || 0);
  const ziel = Number(zahlen.ziel || 50);
  const ring = Math.min(1, anrufe / ziel);

  return (
    <div className="fk">
      {/* ── Kopf: das Tagesziel als Ring ── */}
      <section className="fk-kopf">
        <div>
          <span className="fk-pille">Firmenkunden · B2B</span>
          <h1>Jede Firma braucht <span className="fk-verlauf">Liquidität.</span></h1>
          <p>Deine Tagesliste, der Leitfaden direkt daneben, jedes Ergebnis ein Klick. Vorrat: {zahlen.vorrat_neu ?? 0} neue Firmen{Number(zahlen.faellig || 0) > 0 ? ` · ${zahlen.faellig} Wiedervorlagen fällig` : ""}.</p>
        </div>
        <div className="fk-ring" role="img" aria-label={`${anrufe} von ${ziel} Anrufen heute`}>
          <svg viewBox="0 0 120 120">
            <circle cx="60" cy="60" r="52" className="fk-ring-grund" />
            <circle cx="60" cy="60" r="52" className="fk-ring-wert"
                    strokeDasharray={`${(ring * 326.7).toFixed(1)} 326.7`} />
          </svg>
          <div className="fk-ring-text"><b>{anrufe}</b><span>von {ziel}<br />Anrufen heute</span></div>
          <small>{Number(zahlen.treffer_woche || 0)} Treffer diese Woche</small>
        </div>
      </section>

      {meldung && <p className="fk-meldung" onClick={() => setMeldung(null)}>{meldung}</p>}

      {/* ── Leitfaden — immer griffbereit ── */}
      <section className={`fk-leitfaden${leitfadenAuf ? " auf" : ""}`}>
        <button type="button" onClick={() => setLeitfadenAuf(!leitfadenAuf)}>
          <b>Der Leitfaden fürs Firmengespräch</b>
          <span>{leitfadenAuf ? "einklappen" : "aufklappen"}</span>
        </button>
        {leitfadenAuf && (
          <div className="fk-leitfaden-innen">
            {LEITFADEN.map((b) => (
              <div key={b.t} className="fk-leitfaden-block">
                <b>{b.t}</b>
                {b.s.map((satz, i) => <p key={i}>{satz}</p>)}
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="fk-raster">
        {/* ── Die Liste ── */}
        <section className="fk-tafel">
          <header>
            <div className="fk-reiter">
              {[["arbeit", "Jetzt dran"], ["meine", "Meine"], ["alle", "Alle"]].map(([w, l]) => (
                <button key={w} type="button" className={filter === w ? "an" : ""} onClick={() => setFilter(w)}>{l}</button>
              ))}
            </div>
            <button type="button" className="fk-knopf still klein" onClick={() => setImportAuf(!importAuf)}>Liste einkleben</button>
          </header>
          {importAuf && (
            <div className="fk-import">
              <p>Eine Firma je Zeile: <code>Firma; Ansprechpartner; Telefon; E-Mail; Website; Ort; Branche</code> — Excel-Kopien (Tab) gehen auch. Doppelte werden übersprungen.</p>
              <textarea rows={6} value={importText} onChange={(e) => setImportText(e.target.value)}
                        placeholder={"Beispiel GmbH;Max Beispiel;+49 30 1234567;info@beispiel.de;beispiel.de;Berlin;Handwerk"} />
              <button type="button" className="fk-knopf" disabled={laeuft === "import" || importText.trim().length < 5}
                      onClick={() => void importieren()}>{laeuft === "import" ? "Lese ein …" : "Einlesen"}</button>
            </div>
          )}
          <input className="fk-suche" value={suche} onChange={(e) => setSuche(e.target.value)}
                 placeholder="Firma, Ort, Ansprechpartner, Nummer …" />
          <ul className="fk-liste">
            {firmen.map((f) => {
              const [st, ton] = STATUS_TEXT[f.status] || [f.status, "still"];
              return (
                <li key={f.id}>
                  <button type="button" className={aktiv?.id === f.id ? "an" : ""} onClick={() => void oeffnen(f)}>
                    <span className="fk-liste-wer"><b>{f.firma}</b><small>{[f.ort, f.branche].filter(Boolean).join(" · ") || "—"}</small></span>
                    <span className={`fk-marke ${ton}`}>{st}</span>
                  </button>
                </li>
              );
            })}
            {!firmen.length && <li className="fk-leise">Nichts in dieser Sicht — Liste einkleben oder Filter wechseln.</li>}
          </ul>
        </section>

        {/* ── Die Anruf-Karte ── */}
        <section className="fk-tafel">
          {!aktiv && <p className="fk-leise" style={{ padding: 8 }}>Wähle links eine Firma — hier erscheint die Anruf-Karte.</p>}
          {aktiv && (
            <div className="fk-karte">
              <header>
                <div>
                  <h2>{aktiv.firma}</h2>
                  <small>{[aktiv.ansprechpartner, aktiv.ort, aktiv.branche].filter(Boolean).join(" · ") || "—"}</small>
                </div>
                {(() => { const [st, ton] = STATUS_TEXT[aktiv.status] || [aktiv.status, "still"]; return <span className={`fk-marke ${ton}`}>{st}</span>; })()}
              </header>
              <div className="fk-kontakt">
                {aktiv.telefon
                  ? <a className="fk-tel" href={`tel:${String(aktiv.telefon).replace(/[^0-9+]/g, "")}`}>{aktiv.telefon}</a>
                  : <span className="fk-leise">Keine Nummer hinterlegt</span>}
                <div className="fk-kontakt-neben">
                  {aktiv.email && <span>{aktiv.email}</span>}
                  {aktiv.website && <a href={/^https?:/.test(aktiv.website) ? aktiv.website : `https://${aktiv.website}`} target="_blank" rel="noreferrer">{aktiv.website}</a>}
                </div>
              </div>
              {aktiv.notiz && <p className="fk-notizen">{aktiv.notiz}</p>}

              <textarea className="fk-notiz-feld" rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)}
                        placeholder="Notiz zum Gespräch (wird mit dem Ergebnis gespeichert) …" />

              <div className="fk-ergebnisse">
                {ERGEBNIS_KNOEPFE.map(([wert, label, ton]) => (
                  <button key={wert} type="button" className={`fk-erg ${ton}`} disabled={!!laeuft}
                          onClick={() => void ergebnis(wert)}>{laeuft === wert ? "…" : label}</button>
                ))}
              </div>

              <div className="fk-aktionen">
                <button type="button" className="fk-knopf" disabled={laeuft === "mail" || !aktiv.email}
                        title={aktiv.email ? "Info-Mail mit deinem Namen (max. 1× je 7 Tage)" : "Keine E-Mail hinterlegt"}
                        onClick={() => void infoMail()}>{laeuft === "mail" ? "Sende …" : "Info-Mail senden"}</button>
                <button type="button" className="fk-knopf still" onClick={() => void linkKopieren()}>Antragslink kopieren</button>
              </div>

              <div className="fk-verlauf">
                <b>Verlauf</b>
                {verlauf === null && <p className="fk-leise">Lade …</p>}
                {verlauf?.length === 0 && <p className="fk-leise">Noch kein Eintrag — dein Anruf ist der erste.</p>}
                <ul>
                  {(verlauf || []).map((v, i) => (
                    <li key={i}>
                      <span>{new Date(v.created_at).toLocaleString("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>
                      <span>{v.agent_name || "System"}: {v.art === "anruf" ? (ERGEBNIS_KNOEPFE.find(([w]) => w === v.ergebnis)?.[1] || v.ergebnis) : v.art === "mail" ? "Info-Mail versendet" : "Notiz"}{v.notiz ? ` — ${v.notiz}` : ""}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
