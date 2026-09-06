// ═══════════════════════════════════════════════════════════════════════════
// /app/geld/bericht/:monat — DER MONATSBERICHT (Bauvorlage 3.11, Scheibe 6, 06.09.2026)
// /app/geld/bericht          — die Liste aller Berichte
//
// Gesetz 1: Jeder Monat hat einen Betrag, den der Kunde nachrechnen kann. Der
// Bericht ist ein BELEG, keine Anzeige: Der Server rechnet ihn einmal (Modul A,
// fiaon-monatsbericht.ts) und speichert ihn — hier wird nur gezeichnet. Die
// große Zahl ist die Summe der im Monat bewilligten monatlichen Beträge, NIE
// die eigene Rate. Raten sind ein eigener Abschnitt („Ihre Raten“).
//
// Zustände: vorhanden · 0-€-Monat · kommt (aktueller Monat) · kein Bericht
// (404) · Fehler. Demo: ein fester Beispielbericht für den Vormonat, klar als
// Demo gekennzeichnet — kein Aufruf, kein Datensatz.
//
// Daten: GET /kunde/:ref/app/berichte, GET /kunde/:ref/app/berichte/:monat.
// Der Server liefert Kennzahlen unter `kennzahlen` (Spalte JSONB) — die Leser
// hier nehmen die Felder wahlweise flach oder verschachtelt, damit ein kleiner
// Formunterschied nie einen leeren Bildschirm ergibt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useState } from "react";
import { Link } from "wouter";
import { api, eur } from "./Bausteine";
import "@/styles/app-antraege.css";
import "@/styles/app-bericht.css";

// ── Antwortformen (Spec Modul A) ────────────────────────────────────────────
export interface BerichtPosten { vorgangId: number | null; titel: string; betragCents: number; monatlich: boolean; bewilligtAm: string | null; aktenzeichen: string | null }
export interface BerichtUnterwegs { titel: string; empfaenger: string | null; versandtAm: string | null; fristAm: string | null; aktenzeichen: string | null; betragCents?: number | null }
export interface BerichtDaten {
  /** 'YYYY-MM' */
  monat: string;
  /** „August 2026“ */
  monatText: string;
  grosseZahlCents: number;
  grosseZahlText: string;
  /** Einmalige bewilligte Beträge, gesondert von der großen Zahl. */
  einmaligCents: number;
  beantragtCents: number;
  gezahltCents: number;
  posten: BerichtPosten[];
  unterwegs: BerichtUnterwegs[];
  raten: { anzahl: number; puenktlich: number; gezahltCents: number };
  weg: { erledigt: number; gesamt: number; vormonatErledigt: number | null };
  naechstes: string | null;
  erzeugtAm: string | null;
}
export interface BerichtZeile { monat: string; monatText: string; grosseZahlCents: number; grosseZahlText: string; gelesenAm: string | null }

// ── Monatshelfer (Berlin, nie Number(format())) ─────────────────────────────
const MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
export const monatGueltig = (m: string | null | undefined): m is string => typeof m === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
/** 'YYYY-MM' → „August 2026“. Unbekannte Form kommt unverändert zurück. */
export function monatText(ym: string): string {
  if (!monatGueltig(ym)) return ym;
  const j = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7));
  return `${MONATE[m - 1] ?? ym} ${j}`;
}
/** 'YYYY-MM' um n Monate verschieben. */
export function monatPlus(ym: string, n: number): string {
  const j = Number(ym.slice(0, 4)), m = Number(ym.slice(5, 7)) - 1 + n;
  const jahr = j + Math.floor(m / 12), monat = ((m % 12) + 12) % 12;
  return `${jahr}-${String(monat + 1).padStart(2, "0")}`;
}
/** Heutiger Monat in Berlin als 'YYYY-MM' — über formatToParts, nie über die Stunde (Zeit-Falle). */
export function berlinMonat(): string {
  const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit" }).formatToParts(new Date());
  const g = (a: string) => t.find((p) => p.type === a)?.value ?? "";
  return `${g("year")}-${g("month")}`;
}
const berlinTag = (): string => {
  const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  const g = (a: string) => t.find((p) => p.type === a)?.value ?? "";
  return `${g("day")}.${g("month")}.${g("year")}`;
};
/** ISO-Zeit oder schon formatiertes Datum → „dd.mm.yyyy“ in Berliner Zeit. */
const tagText = (v: string | null | undefined): string | null => {
  if (!v) return null;
  if (/^\d{2}\.\d{2}\.\d{4}/.test(v)) return v.slice(0, 10);
  const d = new Date(v); if (Number.isNaN(d.getTime())) return v;
  return new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Europe/Berlin" }).format(d);
};
/** Rückfall, wenn der Server keinePerson() meldet, aber keinen Satz mitschickt — ohne Zeitzusage. */
const KEINE_PERSON_TEXT = "Ihre Akte wird gerade mit Ihrer Person verknüpft. Bis dahin erreichen wir Sie per E-Mail.";
const zahl = (v: unknown, sonst = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : sonst);

// ── Ereignisprotokoll (Modul E): nur Bildschirm/Knopf/Zeit, keine Inhalte ───
export type ProtokollBildschirm = "heute" | "weg" | "brief" | "geld" | "mehr" | "vorgaenge" | "ansprueche" | "unterlagen" | "zahlen" | "bericht" | "hilfe" | "termine" | "vollmacht" | "mitteilungen" | "daten" | "abo" | "konto";
export type ProtokollEreignis = "geoeffnet" | "knopf" | "fertig";
/**
 * Feuer und vergiss — ein Fehler hier darf nie einen Bildschirm stören. Demo meldet nichts.
 * „geoeffnet“ je Bildschirm meldet die Schale (Bereich.tsx); die Bildschirme melden nur „knopf“ und „fertig“.
 */
export function ereignisMelden(kundeRef: string, demo: boolean, bildschirm: ProtokollBildschirm, ereignis: ProtokollEreignis): void {
  if (demo || !kundeRef) return;
  try {
    api(`/kunde/${encodeURIComponent(kundeRef)}/app/ereignis`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bildschirm, ereignis }), keepalive: true }).catch(() => {});
  } catch { /* still */ }
}

// ── Server-Antwort → BerichtDaten (flach oder unter kennzahlen) ─────────────
function berichtAus(x: any, monatFallback: string): BerichtDaten {
  const k = (x?.kennzahlen && typeof x.kennzahlen === "object") ? x.kennzahlen : {};
  const lies = (name: string) => (x?.[name] !== undefined ? x[name] : k[name]);
  const monat = monatGueltig(x?.monat) ? x.monat : monatFallback;
  const posten: BerichtPosten[] = Array.isArray(lies("posten")) ? lies("posten").map((p: any) => ({
    vorgangId: p?.vorgangId != null && Number.isFinite(Number(p.vorgangId)) ? Number(p.vorgangId) : null,
    titel: String(p?.titel ?? "Vorgang"), betragCents: zahl(p?.betragCents), monatlich: p?.monatlich !== false,
    bewilligtAm: tagText(p?.bewilligtAm), aktenzeichen: p?.aktenzeichen ? String(p.aktenzeichen) : null,
  })) : [];
  const unterwegs: BerichtUnterwegs[] = Array.isArray(lies("unterwegs")) ? lies("unterwegs").map((u: any) => ({
    titel: String(u?.titel ?? "Vorgang"), empfaenger: u?.empfaenger ? String(typeof u.empfaenger === "object" ? u.empfaenger.name ?? "" : u.empfaenger) : null,
    versandtAm: tagText(u?.versandtAm), fristAm: tagText(u?.fristAm), aktenzeichen: u?.aktenzeichen ? String(u.aktenzeichen) : null,
    betragCents: typeof u?.betragCents === "number" ? u.betragCents : null,
  })) : [];
  const r = lies("raten") ?? {};
  const w = lies("weg") ?? {};
  return {
    monat, monatText: String(lies("monatText") ?? monatText(monat)),
    grosseZahlCents: zahl(lies("grosseZahlCents")), grosseZahlText: String(lies("grosseZahlText") ?? ""),
    einmaligCents: zahl(lies("einmaligCents")), beantragtCents: zahl(lies("beantragtCents")), gezahltCents: zahl(lies("gezahltCents")),
    posten, unterwegs,
    raten: { anzahl: zahl(r?.anzahl), puenktlich: zahl(r?.puenktlich), gezahltCents: zahl(r?.gezahltCents ?? lies("gezahltCents")) },
    weg: { erledigt: zahl(w?.erledigt), gesamt: zahl(w?.gesamt), vormonatErledigt: w?.vormonatErledigt == null ? null : zahl(w.vormonatErledigt) },
    naechstes: lies("naechstes") ? String(lies("naechstes")) : null,
    erzeugtAm: tagText(lies("erzeugtAm")),
  };
}

// ── Demo: ein fester Beispielbericht für den Vormonat ───────────────────────
/** Feste Vorführwerte (Spec Modul D): 597,42 € P-Konto bewilligt, eine Rate pünktlich. Nie ein Datensatz. */
export function demoBericht(monat: string): BerichtDaten {
  const mt = monatText(monat);
  const mm = monat.slice(5, 7), jj = monat.slice(0, 4);
  const folge = monatPlus(monat, 1);
  return {
    monat, monatText: mt,
    grosseZahlCents: 59742, grosseZahlText: `Im ${mt.split(" ")[0]} für Sie geholt: ${eur(59742)} im Monat.`,
    einmaligCents: 0, beantragtCents: 0, gezahltCents: 5999,
    // Kein Link auf den Demo-Vorgang 2: der steht dort auf „Versandt – wartet auf Antwort“ (Bausteine.tsx), nicht auf bewilligt.
    posten: [{ vorgangId: null, titel: "Antrag: höherer Schutzbetrag (P-Konto)", betragCents: 59742, monatlich: true, bewilligtAm: `18.${mm}.${jj}`, aktenzeichen: "AZ 2026-000002" }],
    unterwegs: [],
    raten: { anzahl: 1, puenktlich: 1, gezahltCents: 5999 },
    weg: { erledigt: 7, gesamt: 11, vormonatErledigt: 5 },
    naechstes: "Wir arbeiten an Ihrem ersten Schreiben.",
    erzeugtAm: `01.${folge.slice(5, 7)}.${folge.slice(0, 4)}`,
  };
}
const demoZeile = (monat: string): BerichtZeile => { const d = demoBericht(monat); return { monat, monatText: d.monatText, grosseZahlCents: d.grosseZahlCents, grosseZahlText: d.grosseZahlText, gelesenAm: null }; };

// ═══════════════════════════════════════════════════════════════════════════
// EIN BERICHT
// ═══════════════════════════════════════════════════════════════════════════
type Zustand =
  | { art: "laedt" }
  | { art: "bericht"; b: BerichtDaten }
  | { art: "kommt"; text: string }
  | { art: "fehlt" }
  | { art: "fehler"; text: string };

export function Bericht({ kundeRef, basis, demo, monat }: { kundeRef: string; basis: string; demo: boolean; monat: string }) {
  const [z, setZ] = useState<Zustand>({ art: "laedt" });
  const aktuell = berlinMonat();
  const gueltig = monatGueltig(monat);

  const laden = () => {
    setZ({ art: "laedt" });
    if (!gueltig) { setZ({ art: "fehlt" }); return; }
    if (demo) {
      if (monat === monatPlus(aktuell, -1)) setZ({ art: "bericht", b: demoBericht(monat) });
      else if (monat === aktuell) setZ({ art: "kommt", text: `Der Bericht für ${monatText(monat)} wird am 1. ${monatText(monatPlus(monat, 1)).split(" ")[0]} erstellt.` });
      else setZ({ art: "fehlt" });
      return;
    }
    api(`/kunde/${encodeURIComponent(kundeRef)}/app/berichte/${encodeURIComponent(monat)}`).then((r) => {
      if (r.status === 404) { setZ({ art: "fehlt" }); return; }
      if (r.ok && r.json?.ok && r.json.kommt) { setZ({ art: "kommt", text: String(r.json.text || `Der Bericht für ${monatText(monat)} wird am 1. ${monatText(monatPlus(monat, 1)).split(" ")[0]} erstellt.`) }); return; }
      // keinePerson() antwortet 200 mit { ok:false, grund, text } — der ehrliche Satz, kein Störungssatz.
      if (r.json?.grund === "keine_person") { setZ({ art: "fehler", text: String(r.json.text || KEINE_PERSON_TEXT) }); return; }
      if (!r.ok || !r.json || r.json.ok === false) { setZ({ art: "fehler", text: String(r.json?.error || "Ihr Bericht lässt sich gerade nicht öffnen.") }); return; }
      setZ({ art: "bericht", b: berichtAus(r.json.bericht ?? r.json, monat) });
    }).catch(() => setZ({ art: "fehler", text: "Ihr Bericht lässt sich gerade nicht öffnen." }));
  };
  // „geoeffnet“ meldet die Schale (Bereich.tsx) je Bildschirm — hier nichts doppelt zählen.
  useEffect(() => { laden(); }, [kundeRef, demo, monat]);

  const zurueck = <Link href={`${basis}/geld/bericht`} className="ap-textknopf ap-auf">← Alle Berichte</Link>;

  if (z.art === "laedt") {
    return (
      <>
        {zurueck}
        <div className="ap-skelett" style={{ height: 30, width: "60%" }} />
        <div className="ap-skelett" style={{ height: 140, borderRadius: 14 }} />
        <div className="ap-skelett" style={{ height: 200, borderRadius: 14 }} />
      </>
    );
  }
  if (z.art === "fehlt") {
    return (
      <>
        {zurueck}
        <div className="ap-karte ap-leer ap-auf v1"><b>Für diesen Monat gibt es in Ihrer Akte keinen Bericht.</b>Ihre Berichte entstehen jeweils am Monatsanfang für den Monat davor – sobald Ihre erste Zahlung eingegangen ist.<Link href={`${basis}/geld/bericht`} className="ap-knopf still" style={{ marginTop: 14 }}>Zu meinen Berichten</Link></div>
      </>
    );
  }
  if (z.art === "fehler") {
    return (
      <>
        {zurueck}
        <div className="ap-karte ap-leer ap-auf v1"><b>{z.text}</b><button type="button" className="ap-knopf still" style={{ marginTop: 12 }} onClick={laden}>Noch einmal</button></div>
      </>
    );
  }
  if (z.art === "kommt") {
    return (
      <>
        {zurueck}
        <div className="ap-bericht-kopf ap-auf"><h1 className="ap-gruss">{monatText(monat)}<small>Dieser Monat läuft noch.</small></h1></div>
        <div className="ap-karte ap-auf v1">
          <p className="ap-bericht-satz">{z.text}</p>
          <p>Bis dahin sehen Sie unter Vorgänge, was gerade unterwegs ist, und unter Geld Ihre Raten.</p>
          <Link href={`${basis}/vorgaenge`} className="ap-knopf still" style={{ marginTop: 14 }}>Zu meinen Vorgängen</Link>
        </div>
      </>
    );
  }

  // ── Der Bericht ──────────────────────────────────────────────────────────
  const b = z.b;
  const nullMonat = b.grosseZahlCents <= 0 && b.posten.length === 0;
  const einmalige = b.posten.filter((p) => !p.monatlich);
  const monatliche = b.posten.filter((p) => p.monatlich);
  const summeMonatlich = monatliche.reduce((s, p) => s + p.betragCents, 0);

  return (
    <>
      {zurueck}
      <div className="ap-bericht-kopf ap-auf">
        <h1 className="ap-gruss">{b.monatText}<small>Ihr Bericht – zum Nachrechnen.</small></h1>
      </div>
      {demo && <div className="ap-demo-band ap-auf"><b>Demo-Bericht</b><span>Feste Vorführwerte, kein echtes Konto.</span></div>}

      {/* Große Zahl */}
      <div className="ap-karte ap-bericht-zahl ap-auf v1">
        <div className="ap-zahl">{eur(b.grosseZahlCents)}{b.grosseZahlCents > 0 && <small>im Monat</small>}</div>
        <p className="ap-bericht-satz">{b.grosseZahlText || (nullMonat ? "In diesem Monat ist noch kein Betrag entstanden." : `Im ${b.monatText.split(" ")[0]} für Sie geholt: ${eur(b.grosseZahlCents)} im Monat.`)}</p>
        {b.einmaligCents > 0 && <div className="ap-bericht-neben"><span>Dazu einmalig bewilligt</span><b>{eur(b.einmaligCents)}</b></div>}
        <div className="ap-bericht-neben"><span>Beantragt und offen</span><b>{eur(b.beantragtCents)}</b></div>
      </div>

      {/* So rechnen Sie nach */}
      <section className="ap-abschnitt ap-auf v2">
        <h2 className="ap-abschnitt-titel">So rechnen Sie nach</h2>
        <div className="ap-karte">
          {b.posten.length === 0 ? (
            <p style={{ margin: 0 }}>In diesem Monat wurde kein Vorgang bewilligt. Was unterwegs ist, steht weiter unten – die Antwort der Stelle entscheidet über den Betrag.</p>
          ) : (
            <>
              <ul className="ap-posten">
                {b.posten.map((p, i) => {
                  const innen = (
                    <>
                      <div><b>{p.titel}</b><small>{[p.bewilligtAm ? `bewilligt am ${p.bewilligtAm}` : null, p.aktenzeichen].filter(Boolean).join(" · ")}</small></div>
                      <span className="ap-posten-betrag">{eur(p.betragCents)}<small>{p.monatlich ? "im Monat" : "einmalig"}</small></span>
                    </>
                  );
                  return <li key={`${p.vorgangId ?? "p"}-${i}`}>{p.vorgangId ? <Link href={`${basis}/vorgaenge/${p.vorgangId}`}>{innen}</Link> : <div className="ap-posten-zeile">{innen}</div>}</li>;
                })}
              </ul>
              {monatliche.length > 1 && <div className="ap-posten-summe"><span>Summe im Monat</span><b>{eur(summeMonatlich)}</b></div>}
              {einmalige.length > 0 && <p className="ap-fuss" style={{ marginTop: 10 }}>Einmalige Beträge zählen nicht in die Monatszahl – sie stehen gesondert.</p>}
            </>
          )}
        </div>
      </section>

      {/* Ihre Raten */}
      <section className="ap-abschnitt ap-auf v2">
        <h2 className="ap-abschnitt-titel">Ihre Raten</h2>
        <div className="ap-karte">
          {b.raten.anzahl === 0 ? (
            <p style={{ margin: 0 }}>In diesem Monat ist keine Rate eingegangen.</p>
          ) : (
            <>
              <div className="ap-zeile"><span>Gezahlt</span><b>{b.raten.anzahl === 1 ? "1 Rate" : `${b.raten.anzahl} Raten`} · {eur(b.raten.gezahltCents)}</b></div>
              <div className="ap-zeile"><span>Davon pünktlich</span><b>{b.raten.puenktlich} von {b.raten.anzahl}</b></div>
              <p style={{ fontSize: 14 }}>Jede pünktlich gezahlte Rate ist zugleich Ihr Zahlungsnachweis. Ihre Rate ist nicht Teil der Monatszahl oben.</p>
            </>
          )}
          <Link href={`${basis}/geld`} className="ap-link" style={{ display: "inline-block", marginTop: 8 }}>Alle Raten ansehen →</Link>
        </div>
      </section>

      {/* Unterwegs */}
      <section className="ap-abschnitt ap-auf v3">
        <h2 className="ap-abschnitt-titel">Unterwegs</h2>
        <div className="ap-karte">
          {b.unterwegs.length === 0 ? (
            <p style={{ margin: 0 }}>Am Monatsende war kein Antrag unterwegs.</p>
          ) : (
            <ul className="ap-posten">
              {b.unterwegs.map((u, i) => (
                <li key={`${u.aktenzeichen ?? "u"}-${i}`}>
                  <div className="ap-posten-zeile">
                    <div><b>{u.titel}</b><small>{[u.empfaenger ? `an ${u.empfaenger}` : null, u.versandtAm ? `versandt ${u.versandtAm}` : null, u.fristAm ? `Antwort erwartet bis ${u.fristAm}` : null].filter(Boolean).join(" · ")}{u.aktenzeichen ? <><br />{u.aktenzeichen}</> : null}</small></div>
                    {typeof u.betragCents === "number" ? <span className="ap-posten-betrag">{eur(u.betragCents)}</span> : <span className="ap-posten-betrag"><small>Betrag offen</small></span>}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Ihr Weg in diesem Monat */}
      {b.weg.gesamt > 0 && (
        <section className="ap-abschnitt ap-auf v3">
          <h2 className="ap-abschnitt-titel">Ihr Weg in diesem Monat</h2>
          <div className="ap-karte">
            <div className="ap-bericht-weg"><b>{b.weg.erledigt} von {b.weg.gesamt} Schritten</b>{b.weg.vormonatErledigt !== null && <span>Vormonat: {b.weg.vormonatErledigt} von {b.weg.gesamt}</span>}</div>
            <div className="ap-stufen hell" style={{ marginTop: 12 }}>{Array.from({ length: b.weg.gesamt }, (_, i) => <span key={i} className={`ap-stufe ${i < b.weg.erledigt ? "fertig" : ""}`} />)}</div>
            <Link href={`${basis}/weg`} className="ap-link" style={{ display: "inline-block", marginTop: 12 }}>Alle Schritte ansehen →</Link>
          </div>
        </section>
      )}

      {/* Als Nächstes */}
      {b.naechstes && (
        <section className="ap-abschnitt ap-auf v4">
          <h2 className="ap-abschnitt-titel">Als Nächstes</h2>
          <div className="ap-karte"><p className="ap-bericht-satz">{b.naechstes}</p></div>
        </section>
      )}

      <p className="ap-bericht-fuss ap-auf v4">Erstellt am {b.erzeugtAm ?? berlinTag()} · gilt für {b.monatText} · ändert sich nicht mehr.</p>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE LISTE
// ═══════════════════════════════════════════════════════════════════════════
export function Berichte({ kundeRef, basis, demo }: { kundeRef: string; basis: string; demo: boolean }) {
  const [liste, setListe] = useState<BerichtZeile[] | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const aktuell = berlinMonat();

  const laden = () => {
    setFehler(null); setListe(null);
    if (demo) { setListe([demoZeile(monatPlus(aktuell, -1))]); return; }
    api(`/kunde/${encodeURIComponent(kundeRef)}/app/berichte`).then((r) => {
      if (r.json?.grund === "keine_person") { setFehler(String(r.json.text || KEINE_PERSON_TEXT)); setListe([]); return; }
      if (!r.ok || !r.json || r.json.ok === false) { setFehler(String(r.json?.error || "Ihre Berichte lassen sich gerade nicht laden.")); setListe([]); return; }
      const roh: any[] = Array.isArray(r.json) ? r.json : Array.isArray(r.json.berichte) ? r.json.berichte : [];
      setListe(roh.filter((x) => monatGueltig(x?.monat)).map((x) => ({
        monat: String(x.monat), monatText: String(x.monatText ?? monatText(String(x.monat))),
        grosseZahlCents: zahl(x.grosseZahlCents), grosseZahlText: String(x.grosseZahlText ?? ""), gelesenAm: x.gelesenAm ?? null,
      })));
    }).catch(() => { setFehler("Ihre Berichte lassen sich gerade nicht laden."); setListe([]); });
  };
  useEffect(() => { laden(); }, [kundeRef, demo]);

  return (
    <>
      <Link href={`${basis}/geld`} className="ap-textknopf ap-auf">← Zurück</Link>
      <h1 className="ap-gruss ap-auf" style={{ marginTop: 0 }}>Ihre Berichte<small>Jeden Monat ein Beleg: was für Sie entstanden ist, was unterwegs ist, was Sie gezahlt haben.</small></h1>
      {demo && <div className="ap-demo-band ap-auf"><b>Demo-Ansicht</b><span>Ein Beispielbericht mit festen Werten.</span></div>}

      {liste === null && !fehler && <div className="ap-skelett" style={{ height: 130, borderRadius: 14 }} />}
      {fehler && <div className="ap-karte ap-leer ap-auf v1"><b>{fehler}</b><button type="button" className="ap-knopf still" style={{ marginTop: 12 }} onClick={laden}>Noch einmal</button></div>}

      {liste && !fehler && liste.length === 0 && (
        <div className="ap-karte ap-leer ap-auf v1"><b>Noch kein Bericht.</b>Ihr erster Bericht entsteht Anfang {monatText(monatPlus(aktuell, 1)).split(" ")[0]} – sobald Ihre erste Zahlung eingegangen ist.</div>
      )}

      {liste && liste.length > 0 && (
        <div className="ap-karte ap-monate ap-auf v1">
          {liste.map((z) => (
            <Link key={z.monat} href={`${basis}/geld/bericht/${z.monat}`}>
              <span className={`ap-monat-neu${z.gelesenAm ? "" : " neu"}`} aria-label={z.gelesenAm ? undefined : "Noch nicht gelesen"} />
              <div><b>{z.monatText}</b><small>{z.grosseZahlCents > 0 ? "Für Sie geholt, im Monat" : "Kein Betrag entstanden"}</small></div>
              <span className="ap-monat-zahl">{eur(z.grosseZahlCents)}</span>
            </Link>
          ))}
        </div>
      )}

      {liste && liste.length > 0 && !liste.some((z) => z.monat === aktuell) && (
        <p className="ap-fuss">Der Bericht für {monatText(aktuell)} entsteht Anfang {monatText(monatPlus(aktuell, 1)).split(" ")[0]}.</p>
      )}
    </>
  );
}
