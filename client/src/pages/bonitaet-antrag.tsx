// ═══════════════════════════════════════════════════════════════════════════
// /bonitaet-antrag — DIE BONITÄTSAUSKUNFT, ÖFFENTLICH EINZELN KAUFBAR
// (neu aufgebaut 24.09.2026, E-240)
//
// ── WARUM NEU ─────────────────────────────────────────────────────────────
// Die alte Seite sprach per Du, spielte vier bis zehn Sekunden lang eine
// „Prüfung" vor (Zufallswarten), versprach „Express", „noch heute" und „am
// selben Werktag", nannte Österreichern „CRIF Bürgel", kannte keine Schweiz,
// zeigte weder AGB noch Widerrufsbelehrung noch Vollmacht — und der Knopf hieß
// „Jetzt bezahlen & Auskunft erhalten (74 €)". Seit E-240 kostet die Auskunft
// einzeln 149 € (Unternehmen 349 €), mit laufendem Paket 74 € (199 €).
//
// ── WAS DIE SEITE JETZT TUT ───────────────────────────────────────────────
// Privat oder Unternehmen, Land DE/AT/CH, Pflichtangaben, dann EIN Block
// „Bestellung prüfen" mit allem, was § 312j Abs. 2 BGB unmittelbar vor dem
// Knopf verlangt (Leistung, Endpreis, Laufzeit), den vorvertraglichen
// Informationen (Art. 246a EGBGB), der Muster-Widerrufsbelehrung (seit
// 25.09.2026 aus shared/fiaon-auskunft-widerruf.ts, wörtlich — dieselbe Fassung
// geht mit der Zahlungsdaten-Mail als Vertragsbestätigung hinaus), den Pflicht-Häkchen (§ 356 Abs. 4
// BGB; Vollmacht zur Übermittlung im Botenmodell wie server/lib/
// fiaon-schreiben.ts) und dem Hinweis nach § 7 Abs. 3 UWG. Der Knopf heißt
// „Zahlungspflichtig bestellen" (§ 312j Abs. 3 BGB) — und NUR er bestellt:
// Die Eingabetaste in einem Feld schickt nichts ab.
//
// Absenden: POST /api/fiaon/payment-order {kind:"schufa", art, …, zustimmungen,
// messung} → /zahlung/<paymentReference>. Den PREIS entscheidet der Server
// (auskunftPreis/auskunftBestellen, server/lib/fiaon-auskunft.ts) — die Seite
// zeigt ihn nur an. Jede Zustimmung reist mit Textfassung und Zeitstempel mit
// (Texte und Fassung: client/src/i18n/bonitaet-antrag.ts).
//
// ── ANGEMELDETE KUNDEN ────────────────────────────────────────────────────
// Kommt ein Kunde mit Sitzung (Kunden-Cookie, /kunde/me), bestellt die Seite
// für IHN: Der Server nimmt die Stammdaten aus seiner Akte und den Kundenpreis
// (74 €), wenn sein Paket läuft. Ist die Auskunft schon bezahlt oder offen
// bestellt, gibt es keine zweite Bestellung — nur den Weg zur Zahlungsseite bzw.
// in den Bereich. Gekündigt (E-213) heißt: keine neue Leistung.
//
// Gegenlesen 24.09.2026: NUR die Kundensitzung zählt, nicht ?ref= oder die im
// Browser gemerkte Referenz. /kunde/:ref/bereich lässt auch die Als-Kunde-
// Ansicht der Leitung lesen (requireKunde, nur GET) — der Server erkennt
// `kundeRef` beim Bestellen aber ausschließlich am Kunden-Cookie. Ohne diese
// Wand hätte die Seite „Angemeldet als …" gezeigt und eine Bestellung ohne
// Namen und E-Mail angelegt.
// ═══════════════════════════════════════════════════════════════════════════
import { useEffect, useRef, useState, type ReactNode } from "react";
import GlassNav from "@/components/GlassNav";
import PremiumFooter from "@/components/PremiumFooter";
import { EmailVorschlaege } from "@/components/EmailVorschlaege";
import { landErkennen } from "@/lib/land-erkennen";
import { appViewport } from "@/lib/app-viewport";
import { messungsDaten } from "@/lib/werbung";
import { seoSeite } from "@shared/fiaon-seo-seiten";
// 25.09.2026 (E-240): die Belehrung der Auskunft statt der von FIAON Global — Anbieter wie im
// Impressum; Seite und Zahlungsdaten-Mail lesen dieselbe Quelle.
import { AUSKUNFT_WIDERRUF } from "@shared/fiaon-auskunft-widerruf";
import {
  AUSKUNFT_PREISE_CENTS, auskunftLeistung, auskunfteienFuer, auskunfteienText, auskunftLand, auskunftPreisCents, euroText,
  type AuskunftArt, type AuskunftLand,
} from "@shared/fiaon-auskunft";
import {
  T, BESTELL_FASSUNG, BESTELL_KNOPF, PREIS_STEUER, LANDNAMEN, VORWAHLEN, RECHTSFORMEN, REGISTER_BEISPIEL,
} from "@/i18n/bonitaet-antrag";
import "@/styles/bonitaet-antrag.css";

const LAENDER: AuskunftLand[] = ["DE", "AT", "CH"];
const PLZ_STELLEN: Record<AuskunftLand, number> = { DE: 5, AT: 4, CH: 4 };

type Haken = "beginn" | "vollmacht" | "unternehmer";
type Daten = {
  vorname: string; nachname: string; geburt: string;
  strasse: string; plz: string; ort: string;
  email: string; telefon: string;
  firma: string; rechtsform: string; register: string;
};
const LEER: Daten = { vorname: "", nachname: "", geburt: "", strasse: "", plz: "", ort: "", email: "", telefon: "", firma: "", rechtsform: "", register: "" };

/** Ein angemeldeter Kunde — so, wie ihn /kunde/:ref/bereich liefert. */
interface Kunde {
  ref: string;
  name: string;
  zeilen: [string, string][];
  land: AuskunftLand;
  /** Laufendes, bezahltes Paket → Kundenpreis. Beim Bestellen entscheidet der Server es noch einmal. */
  mitAbo: boolean;
  /** Paket bestellt, erste Rate offen — dann gilt (noch) der Einzelpreis. */
  paketOffen: boolean;
  /** „vorhanden": Der Bereich sieht schon eine Auskunft (Kaufkarte dort zu). „gesperrt": gekündigt. */
  stufe: "bezahlt" | "offen" | "dokument" | "vorhanden" | "gesperrt" | "nichts";
  offen: { zahlungsseite: string | null; betragText: string; gemeldet: boolean } | null;
}

// ── Kleine Helfer ─────────────────────────────────────────────────────────
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim());

/** Die Nummer als +49…/+43…/+41… — ohne führende 0 ergänzt die Vorwahl des gewählten Landes. */
function telefonE164(roh: string, land: AuskunftLand): string | null {
  let p = String(roh || "").trim().replace(/[\s\-()./]/g, "");
  if (!p || /[^\d+]/.test(p)) return null;
  if (p.startsWith("00")) p = `+${p.slice(2)}`;
  else if (p.startsWith("0")) p = `${VORWAHLEN[land]}${p.slice(1)}`;
  else if (!p.startsWith("+")) p = `${VORWAHLEN[land]}${p}`;
  p = p.replace(/^\+(49|43|41)0/, "+$1"); // „+49 0176 …" — die 0 gehört nicht hinter die Vorwahl
  if (!/^\+\d{7,15}$/.test(p) || /^\+(\d)\1+$/.test(p)) return null;
  return p;
}
function telefonFehler(roh: string, land: AuskunftLand): string | null {
  const p = telefonE164(roh, land);
  if (!p) return T.f.telefon;
  if (!/^\+(49|43|41)\d/.test(p)) return T.f.telefonDach;
  if (p.startsWith("+41") && !/^\+41\d{9}$/.test(p)) return T.f.telefon;
  if (p.startsWith("+49") && !/^\+49\d{6,13}$/.test(p)) return T.f.telefon;
  if (p.startsWith("+43") && !/^\+43\d{4,13}$/.test(p)) return T.f.telefon;
  return null;
}

/** TT.MM.JJJJ beim Tippen: Die Punkte kommen von selbst (am Handy hat die Zifferntastatur keinen). */
function datumTippen(neu: string, alt: string): string {
  let v = neu.replace(/,/g, ".").replace(/[^\d.]/g, "").replace(/\.{2,}/g, ".");
  if (neu.length > alt.length && (/^\d{2}$/.test(v) || /^\d{1,2}\.\d{2}$/.test(v))) v += ".";
  return v.slice(0, 10);
}
function datumIso(v: string): string | null {
  const m = v.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (!m) return null;
  const t = Number(m[1]), mo = Number(m[2]), j = Number(m[3]);
  const d = new Date(Date.UTC(j, mo - 1, t));
  if (d.getUTCFullYear() !== j || d.getUTCMonth() !== mo - 1 || d.getUTCDate() !== t) return null;
  return `${j}-${String(mo).padStart(2, "0")}-${String(t).padStart(2, "0")}`;
}
function alterAm(iso: string): number {
  const [j, m, t] = iso.split("-").map(Number);
  const heute = new Date();
  let a = heute.getFullYear() - j;
  if (heute.getMonth() + 1 < m || (heute.getMonth() + 1 === m && heute.getDate() < t)) a -= 1;
  return a;
}
/** Das Geburtsdatum aus der Akte (Text, meist JJJJ-MM-TT) für die Anzeige. */
function datumAnzeige(v: unknown): string {
  const s = String(v ?? "").trim();
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : s || "—";
}

/** Ein Vorgabewert aus der Adresse (?art=firma, ?land=AT) — nur aus der erlaubten Liste. */
function ausAdresse<W extends string>(schluessel: string, erlaubt: readonly W[], sonst: W): W {
  try {
    const w = String(new URLSearchParams(window.location.search).get(schluessel) || "").toUpperCase();
    return erlaubt.find((e) => e.toUpperCase() === w) ?? sonst;
  } catch { return sonst; }
}

/** Aus der Antwort von /kunde/:ref/bereich — der Auskunft-Block (E-240), sonst die älteren Felder. */
function kundeAus(j: any): Kunde {
  const k = j.kunde || {};
  const b = j.bonitaet || {};
  const block = j.auskunft && typeof j.auskunft === "object" ? j.auskunft : null;
  const zStatus = String(b.zahlungsstatus || "");
  const roh: Kunde["stufe"] = block?.stufe
    ?? (b.bezahlt ? "bezahlt" : (zStatus === "pending_payment" || zStatus === "claimed_paid") ? "offen" : b.hatDokument ? "dokument" : "nichts");
  // Dieselbe Wand wie die Kaufkarte im Bereich (fiaon-kunde-bereich.ts, AuskunftKauf):
  // gekündigt → nichts Neues; „nichts" ohne Kaufrecht und ohne Sperre → der Bereich sieht
  // schon eine Auskunft (alter Kauf über die E-Mail, Dokument an einer Schwester-Zeile).
  const stufe: Kunde["stufe"] = block?.sperre === "gekuendigt" && roh !== "bezahlt" && roh !== "offen" ? "gesperrt"
    : block && roh === "nichts" && block.darfKaufen === false && !block.sperre ? "vorhanden"
    : roh;
  const offen: Kunde["offen"] = block
    ? (block.offen ?? null)
    : stufe === "offen" && b.zahlungsreferenz
      ? { zahlungsseite: `/zahlung/${encodeURIComponent(String(b.zahlungsreferenz))}`, betragText: b.preisEuro ? euroText(Math.round(Number(b.preisEuro) * 100)) : "", gemeldet: zStatus === "claimed_paid" }
      : null;
  const mitAbo = typeof block?.mitAbo === "boolean"
    ? block.mitAbo
    : j.paket?.abo !== false && j.stufe?.bezahlt === true && !j.vertrag?.beendet;
  const name = [k.vorname, k.nachname].filter(Boolean).join(" ").trim();
  return {
    ref: String(k.ref), name: name || "Ihr Konto",
    zeilen: [
      ["Name", name || "—"],
      ["Geburtsdatum", datumAnzeige(k.geburtsdatum)],
      ["Anschrift", [k.strasse, [k.plz, k.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ") || "—"],
      ["E-Mail", k.email || "—"],
      ["Telefon", k.telefon || "—"],
    ],
    land: auskunftLand(k.land),
    mitAbo, paketOffen: block?.sperre === "paket_offen", stufe, offen,
  };
}

// ── Kleine Bausteine ──────────────────────────────────────────────────────
function Haken16() {
  return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>;
}
function Haken12() {
  return <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>;
}

function Feld({ id, label, pflicht, fehler, hinweis, voll, children }: {
  id: string; label: string; pflicht?: boolean; fehler?: string; hinweis?: string; voll?: boolean; children: ReactNode;
}) {
  return (
    <div className={`ba-feld${voll ? " voll" : ""}${fehler ? " fehlt" : ""}`} id={`ba-f-${id}`}>
      <label htmlFor={`ba-e-${id}`}>{label}{pflicht && <span className="pflicht" aria-hidden="true">*</span>}</label>
      {children}
      {fehler ? <p className="ba-fehler" role="alert">{fehler}</p> : hinweis ? <p className="ba-hinweis">{hinweis}</p> : null}
    </div>
  );
}

function KarteKopf({ nr, titel, text }: { nr: number; titel: string; text?: string }) {
  return (
    <div className="ba-karte-kopf">
      <span className="ba-nr" aria-hidden="true">{nr}</span>
      <div><h2>{titel}</h2>{text && <p>{text}</p>}</div>
    </div>
  );
}

/** Die EINE Navy-Stelle der Seite: Preis, Auskunfteien, Leistung. */
function Bestellkarte({ art, land, preisCents, mitAbo, angemeldet, paketOffen }: {
  art: AuskunftArt; land: AuskunftLand; preisCents: number; mitAbo: boolean; angemeldet: boolean; paketOffen: boolean;
}) {
  const bei = auskunfteienFuer(land);
  return (
    <aside className="ba-bestell ba-rein v1" aria-label="Ihre Bestellung">
      <div className="tag">{T.karteTag}</div>
      <p className="fuer">{art === "firma" ? T.artFirma : T.artPrivat} · {LANDNAMEN[land]}</p>
      <div className="betrag"><b>{euroText(preisCents)}</b><span>{T.karteEinmal}</span></div>
      <p className="steuer">{PREIS_STEUER}</p>
      {mitAbo ? (
        <div className="kundenpreis">{T.karteKundenpreis}</div>
      ) : !angemeldet ? (
        <div className="kundenpreis">
          {T.kartePaket(euroText(AUSKUNFT_PREISE_CENTS.privat.mitAbo), euroText(AUSKUNFT_PREISE_CENTS.firma.mitAbo))}
          <br /><a href="/login">{T.kartePaketLink}</a>
        </div>
      ) : (
        <div className="kundenpreis">
          {T.karteKundeOhnePaket(euroText(AUSKUNFT_PREISE_CENTS[art].mitAbo))}
          {paketOffen && <><br />{T.karteKundePaketOffen}</>}
        </div>
      )}
      {art === "firma" && (<>
        <h3>{T.karteFirmaBei}</h3>
        <div className="ba-chips"><span>Creditreform</span><span>CRIF</span></div>
      </>)}
      <h3>{art === "firma" ? T.kartePersoenlichBei : T.karteBei}</h3>
      <div className="ba-chips">{bei.map((a) => <span key={a.key}>{a.kurz}</span>)}</div>
      <h3>{T.karteLeistung}</h3>
      <ul className="ba-liste">
        {auskunftLeistung(art, land).map((s) => <li key={s}><Haken16 /><span>{s}</span></li>)}
      </ul>
    </aside>
  );
}

function Pflichthaken({ an, fehlt, onWechsel, children }: { an: boolean; fehlt: boolean; onWechsel: (an: boolean) => void; children: ReactNode }) {
  return (
    <label className={`${an ? "an" : ""}${fehlt && !an ? " fehlt" : ""}`}>
      <input type="checkbox" checked={an} onChange={(e) => onWechsel(e.target.checked)} required />
      <span className="kasten" aria-hidden="true">{an && <Haken12 />}</span>
      <span className="satz">{children}<em aria-label="Pflichtangabe">*</em></span>
    </label>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function BonitaetAntragPage() {
  const [art, setArt] = useState<AuskunftArt>(() => ausAdresse<AuskunftArt>("art", ["privat", "firma"], "privat"));
  const [land, setLand] = useState<AuskunftLand>(() => ausAdresse<AuskunftLand>("land", LAENDER, "DE"));
  const [d, setD] = useState<Daten>(LEER);
  /** Wann welches Häkchen gesetzt wurde (ISO) — reist mit der Bestellung; null = nicht gesetzt. */
  const [haken, setHaken] = useState<Record<Haken, string | null>>({ beginn: null, vollmacht: null, unternehmer: null });
  const [fehler, setFehler] = useState<Record<string, string>>({});
  const [senden, setSenden] = useState<"bereit" | "laeuft" | "weiter">("bereit");
  const [meldung, setMeldung] = useState<{ ton: "rot" | "blau"; text: string; link?: { href: string; text: string } } | null>(null);
  const [kunde, setKunde] = useState<Kunde | null>(null);
  const [trotzdem, setTrotzdem] = useState(false);
  const beruehrt = useRef(false);
  const meldungRef = useRef<HTMLDivElement>(null);

  useEffect(() => appViewport(), []);
  useEffect(() => {
    try { window.scrollTo(0, 0); document.getElementById("root")?.scrollTo(0, 0); } catch { /* egal */ }
    // Titel aus der gemeinsamen SEO-Tabelle — derselbe, den der Server ins HTML schreibt.
    const e = seoSeite("/bonitaet-antrag");
    const vorher = document.title;
    if (e) document.title = e.titel;
    return () => { document.title = vorher; };
  }, []);

  // ── Wer ist da? Kunde mit Sitzung → Bestellung für ihn; sonst Land vorschlagen ──
  useEffect(() => {
    let weg = false;
    const url = new URLSearchParams(window.location.search);
    void (async () => {
      // Nur die Kundensitzung (Cookie) — siehe Kopf „ANGEMELDETE KUNDEN".
      const me = await fetch("/api/fiaon/kunde/me", { credentials: "include" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
      const ref = me?.eingeloggt && me.ref ? String(me.ref) : null;
      if (ref) {
        const r = await fetch(`/api/fiaon/kunde/${encodeURIComponent(ref)}/bereich`, { credentials: "include" }).catch(() => null);
        const j = r?.ok ? await r.json().catch(() => null) : null;
        if (!weg && j?.ok && j.kunde?.ref) {
          const k = kundeAus(j);
          setKunde(k);
          setLand(k.land);
          return;
        }
      }
      if (url.get("land")) return;
      const l = await landErkennen();
      if (!weg && l && !beruehrt.current) setLand(auskunftLand(l));
    })();
    return () => { weg = true; };
  }, []);

  // Ändern sich Art oder Land, ändert sich der Text der Vollmacht (andere Auskunfteien) —
  // eine Zustimmung gilt nur für den Text, den der Mensch beim Ankreuzen gesehen hat.
  const vorherArtLand = useRef(`${art}|${land}`);
  useEffect(() => {
    const jetzt = `${art}|${land}`;
    if (vorherArtLand.current === jetzt) return;
    vorherArtLand.current = jetzt;
    setHaken({ beginn: null, vollmacht: null, unternehmer: null });
  }, [art, land]);

  const mitAbo = !!kunde?.mitAbo;
  const preisCents = auskunftPreisCents(art, mitAbo);
  const bei = auskunfteienText(land);
  const firma = art === "firma";
  const privat = !firma;
  const widerruf = AUSKUNFT_WIDERRUF;
  const vollmachtText = firma ? T.hakenVollmachtFirma(bei) : T.hakenVollmacht(bei);

  // Angemeldet und schon bestellt oder bezahlt: keine zweite Bestellung. Gekündigt: keine neue Leistung.
  const gesperrt = !!kunde && (kunde.stufe === "bezahlt" || kunde.stufe === "offen" || kunde.stufe === "gesperrt");
  const dokumentFrage = !!kunde && (kunde.stufe === "dokument" || kunde.stufe === "vorhanden") && !trotzdem;
  const bestellbar = !gesperrt && !dokumentFrage;

  const setze = (feld: keyof Daten, wert: string) => {
    beruehrt.current = true;
    setD((v) => ({ ...v, [feld]: wert }));
    if (fehler[feld]) setFehler((f) => ({ ...f, [feld]: "" }));
  };
  const hakenSetzen = (h: Haken, an: boolean) => {
    beruehrt.current = true;
    setHaken((v) => ({ ...v, [h]: an ? new Date().toISOString() : null }));
    if (fehler[`haken_${h}`]) setFehler((f) => ({ ...f, [`haken_${h}`]: "" }));
  };

  function pruefen(): Record<string, string> {
    const f: Record<string, string> = {};
    if (!kunde) {
      if (!d.vorname.trim()) f.vorname = T.f.vorname;
      if (!d.nachname.trim()) f.nachname = T.f.nachname;
      const iso = datumIso(d.geburt);
      if (privat) {
        if (!iso) f.geburt = T.f.geburtsdatum;
        else if (alterAm(iso) < 18) f.geburt = T.f.geburtsdatumAlter;
        else if (alterAm(iso) > 110) f.geburt = T.f.geburtsdatum;
      } else if (d.geburt.trim() && !iso) f.geburt = T.f.geburtsdatumFirma;
      if (!d.strasse.trim()) f.strasse = T.f.strasse;
      else if (!/\d/.test(d.strasse)) f.strasse = T.f.hausnummer;
      if (!new RegExp(`^\\d{${PLZ_STELLEN[land]}}$`).test(d.plz.trim())) f.plz = T.f.plz(PLZ_STELLEN[land]);
      if (!d.ort.trim()) f.ort = T.f.ort;
      if (!emailOk(d.email)) f.email = T.f.email;
      const tf = telefonFehler(d.telefon, land);
      if (tf) f.telefon = tf;
    }
    if (firma) {
      if (!d.firma.trim()) f.firma = T.f.firma;
      if (!d.rechtsform) f.rechtsform = T.f.rechtsform;
    }
    if (privat && !haken.beginn) f.haken_beginn = T.f.haken;
    if (firma && !haken.unternehmer) f.haken_unternehmer = T.f.haken;
    if (!haken.vollmacht) f.haken_vollmacht = T.f.haken;
    return f;
  }

  async function bestellen() {
    if (senden !== "bereit" || !bestellbar) return;
    setMeldung(null);
    const f = pruefen();
    if (Object.values(f).some(Boolean)) {
      setFehler(f);
      const erstes = Object.keys(f).find((k) => f[k]);
      const ziel = erstes ? document.getElementById(erstes.startsWith("haken_") ? "ba-haken" : `ba-f-${erstes}`) : null;
      ziel?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setSenden("laeuft");
    const geburtIso = datumIso(d.geburt);
    // Was der Mensch gesehen und angekreuzt hat — Wortlaut, Fassung, Zeitpunkte.
    const zustimmungen = {
      fassung: BESTELL_FASSUNG,
      seite: "/bonitaet-antrag",
      knopf: BESTELL_KNOPF,
      bestelltAm: new Date().toISOString(),
      art, land,
      verbraucher: privat,
      preis: { cents: preisCents, text: euroText(preisCents), mitAbo, steuer: PREIS_STEUER },
      punkte: [
        ...(privat ? [{ schluessel: "vorzeitiger_beginn", text: T.hakenBeginn, zugestimmt: true, am: haken.beginn }] : []),
        ...(firma ? [{ schluessel: "unternehmer", text: T.hakenUnternehmer, zugestimmt: true, am: haken.unternehmer }] : []),
        { schluessel: "vollmacht_uebermittlung", text: vollmachtText, zugestimmt: true, am: haken.vollmacht },
        { schluessel: "agb_datenschutz", text: `${T.agbA}${T.agbLink} (/agb)${T.agbB}${T.dsLink} (/datenschutz)${T.agbC}`, angezeigt: true },
        privat
          ? { schluessel: "widerrufsbelehrung", text: T.widerrufAngezeigt, angezeigt: true }
          : { schluessel: "kein_widerrufsrecht", text: T.firmaKeinWiderruf, angezeigt: true },
        { schluessel: "uwg_hinweis", text: T.uwg, angezeigt: true },
      ],
    };
    const firmaDaten = firma ? { firma: d.firma.trim(), rechtsform: d.rechtsform, registernummer: d.register.trim() || null } : {};
    const body = kunde
      ? { kind: "schufa", art, kundeRef: kunde.ref, ...firmaDaten, zustimmungen, messung: messungsDaten() }
      : {
          kind: "schufa", art,
          firstName: d.vorname.trim(), lastName: d.nachname.trim(),
          email: d.email.trim().toLowerCase(), phone: telefonE164(d.telefon, land),
          ...(geburtIso ? { birthDate: geburtIso } : {}),
          street: d.strasse.trim(), plz: d.plz.trim(), city: d.ort.trim(), country: land,
          ...firmaDaten, zustimmungen, messung: messungsDaten(),
        };
    try {
      const r = await fetch("/api/fiaon/payment-order", {
        method: "POST", credentials: "include", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => null);
      if (r.ok && j?.ok && j.paymentReference) {
        setSenden("weiter");
        window.location.href = `/zahlung/${encodeURIComponent(String(j.paymentReference))}`;
        return;
      }
      if (r.ok && j?.ok && j.alreadyPaid) setMeldung({ ton: "blau", text: T.f.bezahlt, link: { href: "/mein-bereich", text: T.kundeZumBereich } });
      // Gegenlesen 24.09.2026: Der Server weist zahlende Paketkunden ohne Anmeldung mit 409
      // {anmelden:true} ab (sie zahlen im Bereich 74 € statt 149 €). Vorher stand hier
      // „ließ sich gerade nicht anlegen … versuchen Sie es noch einmal" — eine Schleife.
      else if (r.status === 409 && j?.anmelden) setMeldung({ ton: "blau", text: T.f.anmelden, link: { href: "/login", text: T.f.anmeldenLink } });
      else setMeldung({ ton: "rot", text: T.f.senden });
    } catch {
      setMeldung({ ton: "rot", text: T.f.senden });
    }
    setSenden("bereit");
    window.setTimeout(() => meldungRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  }

  const fe = (k: string) => fehler[k] || undefined;
  // Angemeldete sehen weniger Schritte — die Nummern bleiben lückenlos.
  const nr = { daten: 2, kontakt: 3, pruefen: kunde ? (firma ? 3 : 2) : 4 };

  return (
    <div className="ba">
      <div className="ba-nebel" aria-hidden="true" />
      <GlassNav />

      <header className="ba-rahmen ba-kopf ba-rein">
        <span className="ba-pille"><i aria-hidden="true" />{T.pille}</span>
        <h1 className="ba-h1">{T.h1a}<span className="ba-verlauf">{T.h1b}</span></h1>
        <p className="ba-lead">{T.lead}</p>
        <ul className="ba-fakten">{T.fakten.map((x) => <li key={x}><Haken16 />{x}</li>)}</ul>
      </header>

      <main className="ba-rahmen">
        <div className="ba-raster">
          <form
            className="ba-spalte ba-rein v1" noValidate
            onSubmit={(e) => { e.preventDefault(); void bestellen(); }}
            // Nur der Knopf bestellt (§ 312j Abs. 3 BGB) — die Eingabetaste in einem Feld nicht.
            onKeyDown={(e) => { if (e.key === "Enter" && (e.target as HTMLElement).tagName === "INPUT") e.preventDefault(); }}
          >
            {/* ── Angemeldet ── */}
            {kunde && (
              <section className="ba-karte ba-konto" aria-label="Ihr Konto">
                <h2 style={{ margin: 0 }}>{T.kundeTitel(kunde.name)}</h2>
                <p className="ba-hinweis" style={{ marginTop: 4 }}>{T.kundeText}</p>
                <dl>{kunde.zeilen.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
                <div className="ba-textknoepfe">
                  <a className="ba-textknopf" href="/mein-bereich">{T.kundeAendern}</a>
                  <button type="button" className="ba-textknopf" onClick={() => { setKunde(null); setTrotzdem(false); setMeldung(null); setFehler({}); }}>{T.kundeAndere}</button>
                </div>
                {kunde.stufe === "bezahlt" && (
                  <div className="ba-mitteilung" style={{ marginTop: 16 }}>{T.kundeBezahlt}<br /><a className="ba-knopf still" href="/mein-bereich">{T.kundeZumBereich}</a></div>
                )}
                {kunde.stufe === "offen" && (
                  <div className="ba-mitteilung" style={{ marginTop: 16 }}>
                    {kunde.offen?.gemeldet ? T.kundeOffenGemeldet : T.kundeOffen(kunde.offen?.betragText || "")}<br />
                    {kunde.offen?.zahlungsseite
                      ? <a className="ba-knopf" href={kunde.offen.zahlungsseite}>{T.kundeZurZahlung}</a>
                      : <a className="ba-knopf still" href="/mein-bereich">{T.kundeZumBereich}</a>}
                  </div>
                )}
                {kunde.stufe === "gesperrt" && (
                  <div className="ba-mitteilung" style={{ marginTop: 16 }}>{T.kundeGekuendigt}<br /><a className="ba-knopf still" href="/mein-bereich">{T.kundeZumBereich}</a></div>
                )}
                {(kunde.stufe === "dokument" || kunde.stufe === "vorhanden") && !trotzdem && (
                  <div className="ba-mitteilung" style={{ marginTop: 16 }}>
                    {kunde.stufe === "dokument" ? T.kundeDokument : T.kundeVorhanden}<br />
                    <button type="button" className="ba-knopf still" onClick={() => setTrotzdem(true)}>{T.kundeTrotzdem}</button>
                  </div>
                )}
              </section>
            )}

            {bestellbar && (<>
              {/* ── 1 · Für wen ── */}
              <section className="ba-karte" aria-label={T.s1}>
                <KarteKopf nr={1} titel={T.s1} />
                <div className="ba-wahl" role="radiogroup" aria-label={T.s1}>
                  {([["privat", T.artPrivat, T.artPrivatSub], ["firma", T.artFirma, T.artFirmaSub]] as const).map(([k, titel, sub]) => (
                    <button key={k} type="button" role="radio" aria-checked={art === k} className="ba-kachel"
                            onClick={() => { beruehrt.current = true; setArt(k); }}>
                      <span className="zeichen" aria-hidden="true">
                        {k === "privat"
                          ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /></svg>
                          : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="7" width="18" height="14" rx="2" /><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" /></svg>}
                      </span>
                      <span><b>{titel}</b><small>{sub}</small></span>
                      <span className="haken" aria-hidden="true"><Haken12 /></span>
                    </button>
                  ))}
                </div>
                <p className="ba-unter">{firma ? T.landTitelFirma : T.landTitel}</p>
                <div className="ba-wahl drei" role="radiogroup" aria-label={firma ? T.landTitelFirma : T.landTitel}>
                  {LAENDER.map((l) => (
                    <button key={l} type="button" role="radio" aria-checked={land === l} className="ba-kachel"
                            disabled={!!kunde && kunde.land !== l}
                            onClick={() => { beruehrt.current = true; setLand(l); if (fehler.plz) setFehler((f) => ({ ...f, plz: "" })); }}>
                      <span className="kuerzel" aria-hidden="true">{l}</span>
                      <span><b>{LANDNAMEN[l]}</b><small>{T.landSub(auskunfteienText(l))}</small></span>
                      <span className="haken" aria-hidden="true"><Haken12 /></span>
                    </button>
                  ))}
                </div>
              </section>

              {/* ── 2 · Angaben (Angemeldete nur für eine Firma) ── */}
              {(!kunde || firma) && (
                <section className="ba-karte" aria-label={firma ? T.s2Firma : T.s2}>
                  <KarteKopf nr={nr.daten} titel={firma ? T.s2Firma : T.s2} text={firma ? T.s2SubFirma : T.s2Sub} />
                  {firma && (
                    <div className="ba-felder">
                      <Feld id="firma" label={T.firma} pflicht fehler={fe("firma")} voll>
                        <input id="ba-e-firma" className="ba-eingabe" value={d.firma} onChange={(e) => setze("firma", e.target.value)} autoComplete="organization" placeholder="Muster GmbH" />
                      </Feld>
                      <Feld id="rechtsform" label={T.rechtsform} pflicht fehler={fe("rechtsform")}>
                        <select id="ba-e-rechtsform" className="ba-eingabe" value={d.rechtsform} onChange={(e) => setze("rechtsform", e.target.value)}>
                          <option value="">{T.rechtsformWaehlen}</option>
                          {RECHTSFORMEN[land].map((r) => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </Feld>
                      <Feld id="register" label={T.register}>
                        <input id="ba-e-register" className="ba-eingabe" value={d.register} onChange={(e) => setze("register", e.target.value)} placeholder={REGISTER_BEISPIEL[land]} />
                      </Feld>
                    </div>
                  )}
                  {!kunde && (<>
                    {firma && <p className="ba-unter">{T.ansprechperson}</p>}
                    <div className="ba-felder">
                      <Feld id="vorname" label={T.vorname} pflicht fehler={fe("vorname")}>
                        <input id="ba-e-vorname" className="ba-eingabe" value={d.vorname} onChange={(e) => setze("vorname", e.target.value)} autoComplete="given-name" autoCapitalize="words" />
                      </Feld>
                      <Feld id="nachname" label={T.nachname} pflicht fehler={fe("nachname")}>
                        <input id="ba-e-nachname" className="ba-eingabe" value={d.nachname} onChange={(e) => setze("nachname", e.target.value)} autoComplete="family-name" autoCapitalize="words" />
                      </Feld>
                      <Feld id="geburt" label={firma ? T.geburtsdatumFirma : T.geburtsdatum} pflicht={privat} fehler={fe("geburt")} hinweis={firma ? T.geburtsdatumFirmaHinweis : undefined} voll={firma}>
                        <input id="ba-e-geburt" className="ba-eingabe" value={d.geburt} inputMode="numeric" autoComplete="bday" placeholder={T.geburtsdatumPlatz}
                               onChange={(e) => setze("geburt", datumTippen(e.target.value, d.geburt))} style={firma ? { maxWidth: 260 } : undefined} />
                      </Feld>
                    </div>
                    <p className="ba-unter">{firma ? T.anschriftFirma : T.anschrift}</p>
                    <div className="ba-felder">
                      <Feld id="strasse" label={T.strasse} pflicht fehler={fe("strasse")} voll>
                        <input id="ba-e-strasse" className="ba-eingabe" value={d.strasse} onChange={(e) => setze("strasse", e.target.value)} autoComplete="street-address" placeholder="Musterstraße 12" />
                      </Feld>
                    </div>
                    <div className="ba-felder plz" style={{ marginTop: 16 }}>
                      <Feld id="plz" label={T.plz} pflicht fehler={fe("plz")}>
                        <input id="ba-e-plz" className="ba-eingabe" value={d.plz} inputMode="numeric" autoComplete="postal-code" maxLength={PLZ_STELLEN[land]}
                               placeholder={land === "DE" ? "12345" : "1234"} onChange={(e) => setze("plz", e.target.value.replace(/\D/g, ""))} />
                      </Feld>
                      <Feld id="ort" label={T.ort} pflicht fehler={fe("ort")}>
                        <input id="ba-e-ort" className="ba-eingabe" value={d.ort} onChange={(e) => setze("ort", e.target.value)} autoComplete="address-level2" />
                      </Feld>
                    </div>
                  </>)}
                </section>
              )}

              {/* ── 3 · Kontakt ── */}
              {!kunde && (
                <section className="ba-karte" aria-label={T.s3}>
                  <KarteKopf nr={nr.kontakt} titel={T.s3} text={T.s3Sub} />
                  <div className="ba-felder">
                    <Feld id="email" label={T.email} pflicht fehler={fe("email")} voll>
                      <input id="ba-e-email" className="ba-eingabe" type="email" inputMode="email" autoComplete="email" autoCapitalize="none" autoCorrect="off" spellCheck={false}
                             value={d.email} onChange={(e) => setze("email", e.target.value.trim())} placeholder={T.emailPlatz[land]} />
                      <EmailVorschlaege wert={d.email} land={land} onWahl={(v) => setze("email", v)} />
                    </Feld>
                    <Feld id="telefon" label={T.telefon} pflicht fehler={fe("telefon")} hinweis={T.telefonHinweis} voll>
                      <div className="ba-vorwahl">
                        <span aria-hidden="true">{VORWAHLEN[land]}</span>
                        <input id="ba-e-telefon" className="ba-eingabe" type="tel" inputMode="tel" autoComplete="tel-national"
                               value={d.telefon} onChange={(e) => setze("telefon", e.target.value)} placeholder={T.telefonPlatz[land]} />
                      </div>
                    </Feld>
                  </div>
                </section>
              )}

              {/* ── Prüfen und bestellen (§ 312j Abs. 2 BGB: alles Wesentliche direkt über dem Knopf) ── */}
              <section className="ba-karte" aria-label={T.s4}>
                <KarteKopf nr={nr.pruefen} titel={T.s4} text={T.s4Sub} />
                <dl className="ba-zf">
                  <div><dt>{T.zfLeistung}</dt><dd>{T.leistungName(art, land, bei)}</dd></div>
                  <div className="preis"><dt>{T.zfPreis}</dt><dd><b>{euroText(preisCents)}</b><small>{PREIS_STEUER}{mitAbo ? ` · ${T.karteKundenpreis}` : ""}</small></dd></div>
                  <div><dt>{T.zfLaufzeit}</dt><dd>{T.laufzeit}</dd></div>
                  <div><dt>{T.zfZahlung}</dt><dd>{T.zahlung}</dd></div>
                  <div><dt>{T.zfZeit}</dt><dd>{T.leistungszeit(art)}</dd></div>
                </dl>

                <div className="ba-recht">
                  <details className="ba-auf">
                    <summary>{T.infoTitel}</summary>
                    <div className="ba-auf-inhalt">
                      <dl>{T.infoZeilen.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
                    </div>
                  </details>
                  {privat ? (
                    <details className="ba-auf">
                      <summary>{T.widerrufTitel}</summary>
                      <div className="ba-auf-inhalt">
                        <p>{T.widerrufGilt}</p>
                        {widerruf.abschnitte.map((a) => (
                          <div key={a.h}><h4>{a.h}</h4>{a.absaetze.map((p) => <p key={p.slice(0, 48)}>{p}</p>)}</div>
                        ))}
                        <h4>{T.erloeschenTitel}</h4>
                        <p>{T.erloeschen}</p>
                        <div className="ba-formular">
                          <h4 style={{ marginTop: 0 }}>{widerruf.formular.titel}</h4>
                          <p>{widerruf.formular.hinweis}</p>
                          <p>{widerruf.formular.an}</p>
                          {widerruf.formular.zeilen.map((z) => <p key={z}>— {z}</p>)}
                          <p>{widerruf.formular.fuss}</p>
                        </div>
                      </div>
                    </details>
                  ) : (
                    <p className="ba-verweis">{T.firmaKeinWiderruf}</p>
                  )}
                  <p className="ba-verweis">
                    {T.agbA}<a href="/agb" target="_blank" rel="noopener">{T.agbLink}</a>{T.agbB}<a href="/datenschutz" target="_blank" rel="noopener">{T.dsLink}</a>{T.agbC}
                  </p>
                </div>

                <div className="ba-haken" id="ba-haken">
                  {privat && (
                    <Pflichthaken an={!!haken.beginn} fehlt={!!fehler.haken_beginn} onWechsel={(an) => hakenSetzen("beginn", an)}>{T.hakenBeginn}</Pflichthaken>
                  )}
                  {firma && (
                    <Pflichthaken an={!!haken.unternehmer} fehlt={!!fehler.haken_unternehmer} onWechsel={(an) => hakenSetzen("unternehmer", an)}>{T.hakenUnternehmer}</Pflichthaken>
                  )}
                  <Pflichthaken an={!!haken.vollmacht} fehlt={!!fehler.haken_vollmacht} onWechsel={(an) => hakenSetzen("vollmacht", an)}>{vollmachtText}</Pflichthaken>
                  {(fehler.haken_beginn || fehler.haken_vollmacht || fehler.haken_unternehmer) && <p className="ba-fehler" role="alert">{T.f.haken}</p>}
                </div>
                <p className="ba-uwg">{T.uwg}</p>

                {meldung && (
                  <div ref={meldungRef} className={`ba-mitteilung${meldung.ton === "rot" ? " rot" : ""}`} style={{ marginTop: 16 }} role="status">
                    {meldung.text}
                    {meldung.link && <><br /><a className="ba-knopf still" href={meldung.link.href}>{meldung.link.text}</a></>}
                  </div>
                )}
                {Object.values(fehler).some(Boolean) && !meldung && <p className="ba-fehler" style={{ marginTop: 14 }}>{T.f.oben}</p>}

                <div className="ba-endzeile">
                  <span>{T.endzeile(art, land)}<small>{PREIS_STEUER}</small></span>
                  <b>{euroText(preisCents)}</b>
                </div>
                <button type="submit" className="ba-knopf breit" disabled={senden !== "bereit"}>
                  {senden === "bereit" ? BESTELL_KNOPF : <><span className="dreht" aria-hidden="true" />{T.knopfLaeuft}</>}
                </button>
                <p className="ba-unterknopf">{T.unterKnopf}</p>
              </section>
            </>)}
          </form>

          <div className="ba-seite">
            <Bestellkarte art={art} land={land} preisCents={preisCents} mitAbo={mitAbo} angemeldet={!!kunde} paketOffen={!!kunde?.paketOffen} />
          </div>
        </div>

        <section className="ba-block" aria-labelledby="ba-ablauf">
          <h2 id="ba-ablauf">{T.ablaufTitel}</h2>
          <ol className="ba-schritte">{T.ablauf.map((s) => <li key={s.t}><b>{s.t}</b><p>{s.x}</p></li>)}</ol>
        </section>

        <section className="ba-block ba-fragen" aria-labelledby="ba-fragen">
          <h2 id="ba-fragen">{T.fragenTitel}</h2>
          {T.fragen.map((q) => <details key={q.f}><summary>{q.f}</summary><p>{q.a}</p></details>)}
        </section>
        <div className="ba-fuss-luft" />
      </main>

      <PremiumFooter />
    </div>
  );
}
