// ═══════════════════════════════════════════════════════════════════════════
// /app — Bausteine der Scheibe 2 (05.09.2026): Ansprüche, Post mit Brief-Knopf,
// Unterlagen, Mehr. Jeder Baustein zeichnet Serverdaten, rechnet keine Wahrheit
// selbst — mit einer Ausnahme: der Anspruchs-Check nutzt dieselbe reine Funktion
// `befunde()` wie der Server (shared/fiaon-ansprueche.ts), damit die Demo-
// Ansicht ohne Datenbank dieselbe Liste zeigt wie ein echter Kunde.
//
// Sprachregel Ansprüche (Detailplan Station 3, bindend): „Das können Sie
// beantragen. Über den Betrag entscheidet die Stelle." Nie „steht Ihnen zu“.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { FRAGEN, befunde, beantwortet as anzahlBeantwortet, summeMonatlichCents, type Antworten, type Frage } from "@shared/fiaon-ansprueche";
import type { Vorgang } from "./typen";

export const eur = (cents: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
/** ISO-Zeit → „Sa., 09.05., 10:30“ in Berliner Zeit (Zeit-Falle: nie Number(format())). */
export const zeit = (iso: string | null | undefined): string | null => {
  if (!iso) return null;
  const d = new Date(iso); if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Berlin" }).format(d);
};

export async function api(pfad: string, init?: RequestInit) {
  const r = await fetch(`/api/fiaon${pfad}`, { credentials: "include", ...init });
  const json = await r.json().catch(() => null);
  return { ok: r.ok, status: r.status, json };
}

/** Startgespräch buchen: Token holen, Terminseite öffnen (derselbe Weg wie der alte Bereich). */
export async function startgespraechBuchen(kundeRef: string): Promise<string | null> {
  const r = await api(`/kunde/${encodeURIComponent(kundeRef)}/startgespraech`);
  const token = r.json?.token;
  if (token) { window.location.href = `/termin/${encodeURIComponent(token)}?art=start`; return null; }
  return r.json?.error || "Der Terminlink konnte gerade nicht erzeugt werden. Bitte versuchen Sie es gleich noch einmal.";
}

// ── Demo-Daten: feste Vorführwerte, nie ein echter Datensatz ────────────────
export const DEMO_ANTWORTEN: Antworten = { p_konto: true, pfaendung: false, unterhalt: 2, familienstand: "getrennt", netto_cents: 198000, warmmiete_cents: 98000, haushalt: 3, sozialleistung: false, rundfunk_gezahlt: true, kfz_handy: ["kfz", "handy"] };
export const DEMO_POST: Vorgang[] = [
  { id: 3, art: "brief", artText: "Ihr Brief", titel: "Brief vom 03.09.2026", stand: "gelesen", standText: "Gelesen – Mahnung eines Inkassobüros, wir prüfen die Forderung", fristAm: null, versandtAm: null, empfaenger: null, zustaendig: "Lena Winter", eingegangenAm: "03.09.2026", aktualisiertAm: "04.09.2026", dokumente: 1, offen: true },
  { id: 2, art: "p_konto", artText: "Antrag: höherer Schutzbetrag (P-Konto)", titel: "Antrag an Ihre Bank", stand: "versandt", standText: "Versandt – wartet auf Antwort", fristAm: "19.09.2026", versandtAm: "29.08.2026", empfaenger: "Ihre Bank", zustaendig: "Lena Winter", eingegangenAm: "28.08.2026", aktualisiertAm: "29.08.2026", dokumente: 2, offen: true },
  { id: 1, art: "selbstauskunft", artText: "Selbstauskunft (Art. 15 DSGVO)", titel: "Datenkopie bei der Auskunftei", stand: "bewilligt", standText: "Antwort da – Auskunft liegt in Ihrem Bereich", fristAm: null, versandtAm: "12.05.2026", empfaenger: "Auskunftei", zustaendig: "Lena Winter", eingegangenAm: "12.05.2026", aktualisiertAm: "02.06.2026", dokumente: 2, offen: false },
];

// ═══════════════════════════════════════════════════════════════════════════
// ANSPRÜCHE
// ═══════════════════════════════════════════════════════════════════════════
interface Staende { [regel: string]: { stand: string; fristAm: string | null } }
const STAND_WORT: Record<string, string> = { offen: "Noch nicht beantragt", beantragt: "Beantragt", bewilligt: "Bewilligt", abgelehnt: "Abgelehnt", verworfen: "Zurückgestellt", nicht_zutreffend: "Trifft nicht mehr zu" };

export function Ansprueche({ kundeRef, demo, startCheck = false, onFertig, ansprechpartner }: { kundeRef: string; demo: boolean; startCheck?: boolean; onFertig?: () => void; ansprechpartner?: string | null }) {
  const [antragLaeuft, setAntragLaeuft] = useState<string | null>(null);
  const [antraegeAn, setAntraegeAn] = useState<boolean>(demo);
  const [antragMeldung, setAntragMeldung] = useState<string | null>(null);
  // „Antrag vorbereiten“: legt den Vorgang an (Schreiben in Ich-Form des Kunden) und führt zur Unterschrift —
  // vorher ggf. zur Vollmacht (Kette 1 von 2). Der Versand bleibt beim Menschen.
  const antragVorbereiten = async (regelSchluessel: string) => {
    if (demo) { setAntragMeldung("In der Demo-Ansicht wird kein Antrag angelegt. Bei echten Kunden führt dieser Knopf zur Unterschrift mit dem Finger."); return; }
    setAntragLaeuft(regelSchluessel); setAntragMeldung(null);
    const r = await api(`/kunde/${encodeURIComponent(kundeRef)}/app/vorgaenge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ regelSchluessel }) });
    setAntragLaeuft(null);
    if (r.ok && r.json?.ok && r.json.unterschriftUrl) { window.location.href = r.json.unterschriftUrl; return; }
    setAntragMeldung(r.json?.error || "Der Antrag konnte gerade nicht vorbereitet werden. Bitte versuchen Sie es in einem Moment noch einmal.");
  };
  const [a, setA] = useState<Antworten | null>(demo ? DEMO_ANTWORTEN : null);
  const [staende, setStaende] = useState<Staende>({});
  const [grund, setGrund] = useState<string | null>(null);
  const [fragen, setFragen] = useState(startCheck);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (demo) return;
    api(`/kunde/${encodeURIComponent(kundeRef)}/app/ansprueche`).then((r) => {
      if (r.json?.ok === false && r.json?.grund) { setGrund(r.json.text || "Dieser Bereich steht Ihnen in Kürze zur Verfügung."); setA({}); return; }
      if (!r.ok || !r.json) { setFehler("Ihre Ansprüche konnten gerade nicht geladen werden."); setA({}); return; }
      setA(r.json.antworten || {});
      setAntraegeAn(!!r.json.antraegeAn);
      const st: Staende = {}; for (const b of r.json.befunde || []) st[b.schluessel] = { stand: b.stand, fristAm: b.fristAm };
      setStaende(st);
    });
  }, [kundeRef, demo]);

  const speichern = async (neu: Antworten) => {
    setA(neu);
    if (demo) return;
    const r = await api(`/kunde/${encodeURIComponent(kundeRef)}/app/ansprueche`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ antworten: neu }) });
    if (!r.ok) setFehler(r.json?.error || "Ihre Antwort konnte gerade nicht gespeichert werden.");
    else { const st: Staende = {}; for (const b of r.json?.befunde || []) st[b.schluessel] = { stand: b.stand, fristAm: b.fristAm }; setStaende(st); setFehler(null); }
  };

  if (!a) return <div className="ap-skelett" style={{ height: 220, borderRadius: 18 }} />;
  if (grund) return <div className="ap-karte ap-leer ap-auf v1"><b>Noch einen Moment.</b>{grund}</div>;

  const liste = befunde(a);
  const n = anzahlBeantwortet(a);
  const summe = summeMonatlichCents(liste);
  const offeneBetraege = liste.filter((b) => b.betragCents === null).length;

  if (fragen) return <Fragefluss antworten={a} onAntwort={speichern} onFertig={() => { setFragen(false); onFertig?.(); }} />;

  return (
    <>
      <p className="ap-ruhe ap-auf">Das können Sie beantragen. Über den Betrag entscheidet die Stelle.</p>

      {n < FRAGEN.length && (
        <div className="ap-karte ap-auf v1">
          <div className="ap-karte-kopf"><h3>Anspruchs-Check</h3><span className="ap-stempel">{n} von {FRAGEN.length} Fragen</span></div>
          <p>{n === 0 ? "Zehn kurze Fragen, eine nach der anderen. Am Ende steht, was Sie beantragen können." : "Noch nicht alle Fragen sind beantwortet. Je vollständiger, desto genauer die Liste."}</p>
          <div className="ap-stufen hell" style={{ marginTop: 12 }}>{FRAGEN.map((f) => <span key={f.schluessel} className={`ap-stufe ${a[f.schluessel] !== undefined && a[f.schluessel] !== null ? "fertig" : ""}`} />)}</div>
          <button type="button" className="ap-knopf" style={{ marginTop: 14 }} onClick={() => setFragen(true)}>{n === 0 ? "Check starten" : "Weiter beantworten"}</button>
        </div>
      )}

      {liste.length > 0 && (
        <div className="ap-karte ap-auf v2">
          <div className="ap-zahl">{summe > 0 ? eur(summe) : `${liste.length} ${liste.length === 1 ? "Punkt" : "Punkte"}`}<small>{summe > 0 ? "im Monat bezifferbar" : "auf Ihrer Liste"}</small></div>
          <p style={{ fontSize: 13 }}>
            {summe > 0 ? "Summe der Punkte, die sich heute schon in Euro nennen lassen. " : ""}
            {offeneBetraege > 0 ? `${offeneBetraege} weitere ${offeneBetraege === 1 ? "Punkt ergibt seinen Betrag" : "Punkte ergeben ihren Betrag"} erst aus Vergleich oder Bescheid. ` : ""}
            Über jeden Betrag entscheidet am Ende die zuständige Stelle.
          </p>
        </div>
      )}

      {liste.length === 0 && n >= FRAGEN.length && (
        <div className="ap-karte ap-leer ap-auf v2"><b>Nach Ihren Angaben kein offener Punkt.</b>Ändert sich etwas – Pfändung, Leistung, Vertrag –, passen Sie Ihre Antworten an. Ihr Ansprechpartner prüft Ihre Akte trotzdem weiter.</div>
      )}

      {liste.length > 0 && (
        <section className="ap-abschnitt ap-auf v3">
          <h2 className="ap-abschnitt-titel">Ihre Liste</h2>
          {liste.map((b) => {
            const st = staende[b.regel.schluessel]?.stand ?? "offen";
            return (
              <article key={b.regel.schluessel} className="ap-karte ap-befund">
                <div className="ap-karte-kopf">
                  <h3>{b.regel.titel}</h3>
                  <span className={`ap-status ${st === "bewilligt" ? "gut" : st === "offen" ? "" : "offen"}`}>{STAND_WORT[st] ?? st}</span>
                </div>
                <div className="ap-befund-betrag">
                  {b.betragCents !== null ? <>{eur(b.betragCents)}<small>{b.rhythmus === "monatlich" ? "im Monat" : b.rhythmus === "jaehrlich" ? "im Jahr" : "einmalig"}</small></> : <span className="ap-befund-offen">Betrag aus {b.regel.kategorie === "vertrag" ? "Ihrem Vergleich" : "dem Bescheid"}</span>}
                </div>
                <p>{b.begruendung}</p>
                <dl className="ap-liste">
                  <dt>Entscheidet</dt><dd>{b.regel.stelle}</dd>
                  <dt>Wir tun</dt><dd>{b.regel.wasWirTun}</dd>
                  <dt>Grundlage</dt><dd>{b.regel.rechtsgrundlage} · <a className="ap-link" href={b.regel.quelleUrl} target="_blank" rel="noopener noreferrer">Quelle</a> · geprüft {b.regel.geprueftAm.split("-").reverse().join(".")}</dd>
                </dl>
                {st === "offen" && antraegeAn && b.regel.kategorie !== "vertrag" && (
                  <button type="button" className="ap-knopf" style={{ marginTop: 14 }} disabled={antragLaeuft !== null} onClick={() => antragVorbereiten(b.regel.schluessel)}>{antragLaeuft === b.regel.schluessel ? "Wird vorbereitet …" : "Antrag vorbereiten"}</button>
                )}
                {st === "offen" && antraegeAn && b.regel.kategorie === "vertrag" && (
                  <button type="button" className="ap-knopf still" style={{ marginTop: 14 }} disabled={antragLaeuft !== null} onClick={() => antragVorbereiten(b.regel.schluessel)}>{antragLaeuft === b.regel.schluessel ? "Wird vorbereitet …" : "Kündigung vorbereiten"}</button>
                )}
              </article>
            );
          })}
          {!antraegeAn && liste.some((b) => (staende[b.regel.schluessel]?.stand ?? "offen") === "offen") && <p className="ap-fuss">Anträge direkt aus Ihrem Bereich schalten wir gerade frei. Bis dahin bereitet Ihre Ansprechperson sie mit Ihnen im Gespräch vor.</p>}
          <p className="ap-fuss">{ansprechpartner ? `Nehmen Sie die Liste mit ins Gespräch mit ${ansprechpartner} – dort gehen Sie sie gemeinsam durch.` : "Nehmen Sie die Liste mit ins Gespräch mit Ihrem FIAON-Team."} {n < FRAGEN.length ? "Vervollständigen Sie den Check, damit nichts fehlt." : ""}</p>
        </section>
      )}

      {antragMeldung && <div className="ap-meldung" role="status">{antragMeldung}</div>}
      {n >= FRAGEN.length && <button type="button" className="ap-knopf still ap-auf v4" onClick={() => setFragen(true)}>Antworten ändern</button>}
      {fehler && <div className="ap-problem" role="alert"><b>{fehler}</b></div>}
    </>
  );
}

// Eine Frage zur Zeit, Schaltflächen unten. Jede Antwort wird sofort gespeichert.
function Fragefluss({ antworten, onAntwort, onFertig }: { antworten: Antworten; onAntwort: (a: Antworten) => void; onFertig: () => void }) {
  const erste = Math.max(0, FRAGEN.findIndex((f) => antworten[f.schluessel] === undefined || antworten[f.schluessel] === null));
  const [i, setI] = useState(erste === -1 ? 0 : erste);
  const f = FRAGEN[i];
  const wert = antworten[f.schluessel];
  const [zahl, setZahl] = useState<string>(wert === undefined || wert === null ? "" : f.art === "betrag" ? String(Number(wert) / 100) : String(wert));
  useEffect(() => { const w = antworten[f.schluessel]; setZahl(w === undefined || w === null ? "" : f.art === "betrag" ? String(Number(w) / 100) : String(w)); }, [i]);

  const setzen = (v: unknown) => onAntwort({ ...antworten, [f.schluessel]: v } as Antworten);
  const weiter = () => { if (i + 1 < FRAGEN.length) setI(i + 1); else onFertig(); };
  const zahlUebernehmen = () => {
    const roh = zahl.replace(/\./g, "").replace(",", ".").trim();
    const z = Number(roh);
    if (!roh || !Number.isFinite(z) || z < 0) return;
    setzen(f.art === "betrag" ? Math.round(z * 100) : Math.floor(z));
    weiter();
  };

  return (
    <div className="ap-frage ap-auf">
      <div className="ap-zeile"><span>Frage {i + 1} von {FRAGEN.length}</span><button type="button" className="ap-link" onClick={onFertig} style={{ background: "none", border: 0, padding: 0 }}>Später</button></div>
      <div className="ap-stufen hell" style={{ marginTop: 8 }}>{FRAGEN.map((q, k) => <span key={q.schluessel} className={`ap-stufe ${k < i || (antworten[q.schluessel] !== undefined && antworten[q.schluessel] !== null) ? "fertig" : k === i ? "jetzt" : ""}`} />)}</div>
      <h2 className="ap-frage-text">{f.text}</h2>
      <p className="ap-frage-warum">{f.warum}</p>

      <div className="ap-frage-antwort">
        {f.art === "ja_nein" && (
          <div className="ap-knopf-reihe">
            <button type="button" className={`ap-knopf ${wert === true ? "" : "still"}`} onClick={() => { setzen(true); weiter(); }}>Ja</button>
            <button type="button" className={`ap-knopf ${wert === false ? "" : "still"}`} onClick={() => { setzen(false); weiter(); }}>Nein</button>
          </div>
        )}
        {(f.art === "zahl" || f.art === "betrag") && (
          <>
            <label className="ap-feld">
              <span>{f.art === "betrag" ? "Betrag in Euro" : "Anzahl"}</span>
              <input inputMode={f.art === "betrag" ? "decimal" : "numeric"} value={zahl} onChange={(e) => setZahl(e.target.value)} placeholder={f.art === "betrag" ? "z. B. 1.850" : "z. B. 2"} autoFocus />
            </label>
            <div className="ap-knopf-reihe">
              {f.art === "zahl" && <button type="button" className="ap-knopf still" onClick={() => { setzen(0); weiter(); }}>Keine</button>}
              <button type="button" className="ap-knopf" onClick={zahlUebernehmen} disabled={!zahl.trim()}>Weiter</button>
            </div>
          </>
        )}
        {f.art === "wahl" && (
          <div className="ap-wahl">
            {(f.optionen ?? []).map((o) => <button key={o.wert} type="button" className={`ap-knopf ${wert === o.wert ? "" : "still"}`} onClick={() => { setzen(o.wert); weiter(); }}>{o.text}</button>)}
          </div>
        )}
        {f.art === "mehrfach" && <Mehrfach frage={f} wert={Array.isArray(wert) ? (wert as string[]) : []} onWeiter={(v) => { setzen(v); weiter(); }} />}
      </div>
      <div className="ap-zeile" style={{ marginTop: 16 }}>
        {i > 0 ? <button type="button" className="ap-link" style={{ background: "none", border: 0, padding: 0 }} onClick={() => setI(i - 1)}>← Zurück</button> : <span />}
        {(wert !== undefined && wert !== null) && f.art !== "ja_nein" && f.art !== "wahl" && f.art !== "mehrfach" ? <button type="button" className="ap-link" style={{ background: "none", border: 0, padding: 0 }} onClick={weiter}>Überspringen →</button> : <span />}
      </div>
    </div>
  );
}

function Mehrfach({ frage, wert, onWeiter }: { frage: Frage; wert: string[]; onWeiter: (v: string[]) => void }) {
  const [w, setW] = useState<string[]>(wert);
  const umschalten = (o: string) => {
    if (o === "keins") { setW(["keins"]); return; }
    const ohne = w.filter((x) => x !== "keins" && x !== o);
    setW(w.indexOf(o) === -1 ? [...ohne, o] : ohne);
  };
  return (
    <>
      <div className="ap-wahl">
        {(frage.optionen ?? []).map((o) => <button key={o.wert} type="button" className={`ap-knopf ${w.indexOf(o.wert) !== -1 ? "" : "still"}`} onClick={() => umschalten(o.wert)}>{o.text}</button>)}
      </div>
      <button type="button" className="ap-knopf" style={{ marginTop: 12 }} disabled={w.length === 0} onClick={() => onWeiter(w)}>Weiter</button>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// UNTERLAGEN — derselbe Endpunkt wie bisher (/upload-kyc), neue Oberfläche
// ═══════════════════════════════════════════════════════════════════════════
export function Unterlagen({ kundeRef, demo, u }: { kundeRef: string; demo: boolean; u: { kontoauszug: boolean; ausweis: boolean; auskunft: boolean; kycStatus?: string } }) {
  const [dateien, setDateien] = useState<{ bankStatement?: File; idCard?: File; schufaDoc?: File }>({});
  const [laeuft, setLaeuft] = useState(false);
  const [meldung, setMeldung] = useState<{ ton: "gut" | "fehler"; text: string } | null>(null);
  const felder: { key: "bankStatement" | "idCard" | "schufaDoc"; titel: string; text: string; da: boolean; optional?: boolean }[] = [
    { key: "bankStatement", titel: "Kontoauszug", text: "Die letzten drei Monate, alle Seiten. PDF aus der Bank-App oder ein lesbares Foto.", da: u.kontoauszug },
    { key: "idCard", titel: "Ausweis oder Reisepass", text: "Vorderseite genügt, alle vier Ecken im Bild.", da: u.ausweis },
    { key: "schufaDoc", titel: "Eigene Bonitätsauskunft", text: "Nur falls Sie schon eine haben: die vollständige Datenkopie nach Art. 15 DSGVO, alle Seiten. Ein Foto der Score-Anzeige aus einer App können wir nicht verwenden.", da: u.auskunft, optional: true },
  ];
  const offen = felder.filter((f) => !f.da);
  const gewaehlt = Object.keys(dateien).filter((k) => (dateien as any)[k]).length;

  const senden = async () => {
    if (demo) { setMeldung({ ton: "gut", text: "In der Demo-Ansicht wird nichts hochgeladen." }); return; }
    const fd = new FormData(); fd.append("ref", kundeRef);
    let n = 0; for (const f of offen) { const d = dateien[f.key]; if (d) { fd.append(f.key, d); n++; } }
    if (!n) return;
    setLaeuft(true); setMeldung(null);
    const r = await fetch("/api/fiaon/upload-kyc", { method: "POST", body: fd, credentials: "include" });
    const j = await r.json().catch(() => null); setLaeuft(false);
    if (r.ok && j?.ok !== false) { setMeldung({ ton: "gut", text: j?.message || "Eingegangen. Wir prüfen Ihre Unterlagen innerhalb von zwei Werktagen und melden uns." }); setDateien({}); }
    else setMeldung({ ton: "fehler", text: j?.error || "Der Upload hat nicht geklappt. Bitte versuchen Sie es erneut." });
  };

  return (
    <>
      <h1 className="ap-gruss ap-auf">Unterlagen<small>{offen.filter((f) => !f.optional).length === 0 ? "Alles da. Wir prüfen und melden uns." : "Was noch fehlt – ein Handyfoto genügt, wenn alles lesbar ist."}</small></h1>
      <div className="ap-karte ap-auf v1">
        <ol className="ap-etappen">
          {felder.map((f) => (
            <li key={f.key} className={`ap-etappe ${f.da ? "fertig" : "jetzt"}`}>
              <span className={`ap-punkt ${f.da ? "fertig" : f.optional ? "" : "jetzt"}`}>{f.da ? "✓" : null}</span>
              <div>
                <b>{f.titel}{f.optional && !f.da ? " (optional)" : ""}</b>
                <small>{f.da ? "Liegt vor." : f.text}</small>
                {!f.da && (
                  <label className="ap-datei">
                    <input type="file" accept="image/jpeg,image/png,application/pdf" hidden onChange={(e) => setDateien({ ...dateien, [f.key]: e.target.files?.[0] ?? undefined })} />
                    <span className="ap-knopf still klein">{dateien[f.key] ? dateien[f.key]!.name : "Datei wählen oder fotografieren"}</span>
                  </label>
                )}
              </div>
              <span className="ap-stempel">{f.da ? "geprüft" : ""}</span>
            </li>
          ))}
        </ol>
        {offen.length > 0 && <button type="button" className="ap-knopf" style={{ marginTop: 14 }} disabled={laeuft || gewaehlt === 0} onClick={senden}>{laeuft ? "Wird hochgeladen …" : gewaehlt > 1 ? `${gewaehlt} Dateien einreichen` : "Einreichen"}</button>}
        {meldung && <div className={`ap-meldung ${meldung.ton}`} role="status">{meldung.text}</div>}
        <p className="ap-fuss" style={{ marginTop: 12 }}>PDF, JPG oder PNG, bis 25 MB je Datei. iPhone-Fotos im Format HEIC können wir nicht lesen – stellen Sie in den Kamera-Einstellungen auf „Maximale Kompatibilität“.</p>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MEHR — Daten, Paket, Passwort, Abmelden, Rechtliches
// ═══════════════════════════════════════════════════════════════════════════
export function Mehr({ kundeRef, demo, kunde, paket, ansprechpartner, basis, naechsterTermin }: {
  kundeRef: string; demo: boolean; basis: string; naechsterTermin?: string | null;
  kunde: { vorname: string; nachname: string; email: string; telefon: string; strasse: string; plz: string; ort: string; land: string; kundeSeit: string | null };
  paket: { name: string; abo: boolean; monatlichCents: number | null; zahlungsstatus: string };
  ansprechpartner: { name: string; rolle: string | null } | null;
}) {
  const [alt, setAlt] = useState(""); const [neu, setNeu] = useState(""); const [pwMeldung, setPwMeldung] = useState<{ ton: "gut" | "fehler"; text: string } | null>(null); const [pwLaeuft, setPwLaeuft] = useState(false);
  const passwort = async (e: React.FormEvent) => {
    e.preventDefault();
    if (demo) { setPwMeldung({ ton: "gut", text: "In der Demo-Ansicht wird nichts geändert." }); return; }
    setPwLaeuft(true); setPwMeldung(null);
    const r = await api(`/kunde/${encodeURIComponent(kundeRef)}/passwort`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ alt, neu }) });
    setPwLaeuft(false);
    if (r.ok && r.json?.ok !== false) { setPwMeldung({ ton: "gut", text: "Ihr neues Passwort gilt ab jetzt." }); setAlt(""); setNeu(""); }
    else setPwMeldung({ ton: "fehler", text: r.json?.error || "Das Passwort konnte nicht geändert werden." });
  };
  const abmelden = async () => { if (!demo) await api("/kunde/logout", { method: "POST" }); window.location.href = demo ? "/app/demo" : "/app/login"; };

  return (
    <>
      <h1 className="ap-gruss ap-auf">Mehr<small>Ihre Daten, Ihr Paket, Ihr Zugang.</small></h1>
      <section className="ap-abschnitt ap-auf v1">
        <div className="ap-karte ap-linkliste">
          <Link href={`${basis}/mehr/hilfe`}>Hilfe und Nachricht{ansprechpartner ? ` an ${ansprechpartner.name}` : ""}</Link>
          <Link href={`${basis}/mehr/termine`}>Termine{naechsterTermin ? ` · nächster ${naechsterTermin}` : ""}</Link>
          <Link href={`${basis}/unterlagen`}>Unterlagen</Link>
          <Link href={`${basis}/vorgaenge`}>Vorgänge und Ansprüche</Link>
          <Link href={`${basis}/mehr/vollmachten`}>Vollmacht</Link>
        </div>
      </section>
      <section className="ap-abschnitt ap-auf v1">
        <h2 className="ap-abschnitt-titel">Ihre Daten</h2>
        <div className="ap-karte">
          <dl className="ap-liste">
            <dt>Name</dt><dd>{kunde.vorname} {kunde.nachname}</dd>
            <dt>E-Mail</dt><dd>{kunde.email}</dd>
            {kunde.telefon && <><dt>Telefon</dt><dd>{kunde.telefon}</dd></>}
            {(kunde.strasse || kunde.ort) && <><dt>Adresse</dt><dd>{kunde.strasse}{kunde.strasse ? ", " : ""}{kunde.plz} {kunde.ort}</dd></>}
            <dt>Kundennummer</dt><dd className="ap-mono">{kundeRef}</dd>
            {kunde.kundeSeit && <><dt>Dabei seit</dt><dd>{kunde.kundeSeit}</dd></>}
          </dl>
          <p className="ap-fuss" style={{ marginTop: 10 }}>Umzug oder neue Nummer? Sagen Sie es {ansprechpartner?.name ?? "Ihrem Ansprechpartner"} – wir ändern es in Ihrer Akte und in allen laufenden Vorgängen zugleich.</p>
        </div>
      </section>
      <section className="ap-abschnitt ap-auf v2">
        <h2 className="ap-abschnitt-titel">Ihr Paket</h2>
        <div className="ap-karte">
          <div className="ap-zeile"><span>Paket</span><b>{paket.name}</b></div>
          {paket.abo && paket.monatlichCents ? <div className="ap-zeile"><span>Monatlich</span><b>{eur(paket.monatlichCents)}</b></div> : null}
          <div className="ap-zeile"><span>Zahlung</span><b>{paket.zahlungsstatus === "paid" || paket.zahlungsstatus === "bezahlt" ? "Erste Zahlung eingegangen" : paket.zahlungsstatus}</b></div>
          <Link href={`${basis}/weg`} className="ap-link" style={{ display: "inline-block", marginTop: 10 }}>Alle Raten ansehen →</Link>
        </div>
      </section>
      <section className="ap-abschnitt ap-auf v3">
        <h2 className="ap-abschnitt-titel">Passwort</h2>
        <form className="ap-karte" onSubmit={passwort} style={{ display: "grid", gap: 12 }}>
          <label className="ap-feld"><span>Bisheriges Passwort</span><input type="password" autoComplete="current-password" value={alt} onChange={(e) => setAlt(e.target.value)} required /></label>
          <label className="ap-feld"><span>Neues Passwort (mindestens 8 Zeichen)</span><input type="password" autoComplete="new-password" minLength={8} value={neu} onChange={(e) => setNeu(e.target.value)} required /></label>
          <button type="submit" className="ap-knopf still" disabled={pwLaeuft}>{pwLaeuft ? "Wird geändert …" : "Passwort ändern"}</button>
          {pwMeldung && <div className={`ap-meldung ${pwMeldung.ton}`} role="status">{pwMeldung.text}</div>}
        </form>
      </section>
      <section className="ap-abschnitt ap-auf v4">
        <h2 className="ap-abschnitt-titel">Rechtliches und Hilfe</h2>
        <div className="ap-karte ap-linkliste">
          <a href="/agb">Allgemeine Geschäftsbedingungen</a>
          <a href="/widerrufsbelehrung">Widerrufsbelehrung</a>
          <a href="/datenschutz">Datenschutz</a>
          <a href="/impressum">Impressum</a>
          <a href="/mein-bereich">Bisherige Ansicht öffnen</a>
        </div>
      </section>
      <button type="button" className="ap-knopf still ap-auf v4" onClick={abmelden}>Abmelden</button>
    </>
  );
}
