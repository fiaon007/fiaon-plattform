// ═══════════════════════════════════════════════════════════════════════════
// /agent/global — DIE REINE LOGIK DES WERKZEUGS (17.09.2026, E-188)
//
// ── WARUM EINE EIGENE DATEI ────────────────────────────────────────────────
// Liste (global.tsx) und Akte (global-akte.tsx) sind Oberfläche. Alles, was
// sich OHNE Bildschirm prüfen lässt, steht hier — ohne React, ohne Netz:
//   · das Lesen der Serverantwort (nichts stürzt ab, wenn ein Feld fehlt — der
//     Server zu dieser Oberfläche entstand gleichzeitig in einem anderen Zweig),
//   · Reihenfolge, Kopfzahlen, Filter der Liste,
//   · Datums- und Größenangaben,
//   · die Prüfung einer Datei VOR dem Hochladen,
//   · die Sätze, die das Werkzeug dem KUNDEN vorschlägt (Sie-Form, durch die
//     Wortwand und die schärferen Global-Regeln geprüft),
//   · der Kasten „Was ich dem Kunden NICHT zusage" — zusammengesetzt aus
//     shared/fiaon-global-vertrieb.ts und shared/fiaon-global.ts, nichts davon
//     ist hier neu erfunden.
// scripts/pruef-global-office.ts ruft genau diese Funktionen auf.
//
// ── DIE SCHNITTSTELLE ──────────────────────────────────────────────────────
// GET  /api/fiaon/agent/global/auftraege        → { ok, zeilen[] }
// GET  /api/fiaon/agent/global/auftraege/:ref   → { ok, auftrag }
// 403 = kein Zugriff (nur zuständige Person, Vertriebsleitung, Admin/Chef).
// ═══════════════════════════════════════════════════════════════════════════
import { GLOBAL_PFLICHTHINWEIS, GLOBAL_ROLLEN, globalKatalog, globalPaket } from "@shared/fiaon-global";
import { globalLeitfaden } from "@shared/fiaon-global-vertrieb";
import { globalWortPruefen, type GlobalWorthinweis } from "@shared/fiaon-global-wortregeln";

// ── Typen ───────────────────────────────────────────────────────────────────
export type GlobalStatus = "offen" | "bezahlt" | "gestartet" | "abgeschlossen" | "storniert";
const STATUS_WERTE: GlobalStatus[] = ["offen", "bezahlt", "gestartet", "abgeschlossen", "storniert"];

export interface GlobalSchritt { text: string; bis: string | null }
export interface GlobalFristKurz { titel: string; faelligAm: string }

export interface GlobalZeile {
  ref: string; firma: string; ort: string; land: string;
  paket: string; paketName: string; status: GlobalStatus; etappe: number;
  stichtag: string | null; naechsterSchritt: GlobalSchritt | null;
  offeneUnterlagen: number; naechsteFrist: GlobalFristKurz | null;
  zustaendig: { id: number; name: string } | null;
  alterTage: number; bezahltAm: string | null; betragCents: number;
}

export interface GlobalEtappe { nr: number; titel: string; text: string; stand: "fertig" | "jetzt" | "offen"; seit: string | null }
export interface GlobalUnterlage { art: string; titel: string; hinweis: string; vorhanden: boolean }
export interface GlobalDokument { id: string; art: string; artText: string; name: string; groesse: number; von: "kunde" | "fiaon"; am: string | null; sichtbar: boolean | null }
export interface GlobalFrist { id: string; titel: string; faelligAm: string; erledigt: boolean; hinweis: string; regel: boolean }
export interface GlobalNotiz { id: string; am: string | null; von: string; text: string; sichtbar: boolean }
export interface GlobalVerlaufZeile { am: string | null; art: string; text: string; sichtbar: boolean; von: string }
export interface GlobalGesellschaft { name: string; form: "" | "LLC" | "Corporation"; bundesstaat: string; gegruendetAm: string; einVorhanden: boolean; itinStand: "offen" | "beantragt" | "vorhanden" }

export interface GlobalAkte {
  ref: string; status: GlobalStatus; sprache: "de" | "en"; paket: string; paketName: string; betragCents: number | null;
  firma: { name: string; ort: string; land: string };
  zahlung: { status: "offen" | "bezahlt"; zahlungsseite: string | null };
  etappe: number; etappen: GlobalEtappe[];
  stichtag: string | null; naechsterSchritt: GlobalSchritt | null;
  ansprechpartner: { name: string; email: string; telefon: string } | null;
  gesellschaft: GlobalGesellschaft;
  unterlagen: GlobalUnterlage[]; dokumente: GlobalDokument[]; fristen: GlobalFrist[];
  /** Arten, die der Upload anbietet: vom Server (dokumentArten), sonst die Arten der Unterlagenliste. */
  dokumentArten: { art: string; titel: string }[];
  verlauf: { am: string | null; text: string }[];
  vertragUrl: string | null; rechnungUrl: string | null;
  kontakt: { anrede: string; vorname: string; nachname: string; funktion: string; email: string; telefon: string };
  firmaVoll: Record<string, string>;
  ustId: string;
  notizen: GlobalNotiz[]; verlaufAlles: GlobalVerlaufZeile[];
  kundenLink: string | null;
}

// ── Kleine Leser: aus „irgendwas" wird ein sicherer Wert ────────────────────
const txt = (w: unknown): string => (typeof w === "string" ? w.trim() : typeof w === "number" && Number.isFinite(w) ? String(w) : "");
const zahl = (w: unknown, sonst = 0): number => { const n = Number(w); return Number.isFinite(n) ? n : sonst; };
const liste = (w: unknown): any[] => (Array.isArray(w) ? w : []);
const ding = (w: unknown): Record<string, any> => (w && typeof w === "object" && !Array.isArray(w) ? (w as Record<string, any>) : {});
/** „2026-10-01" aus „2026-10-01", „2026-10-01T00:00:00.000Z" oder einem Date; sonst null. */
export function isoTagAus(w: unknown): string | null {
  if (w instanceof Date) return Number.isNaN(w.getTime()) ? null : berlinTag(w);
  const s = txt(w);
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  // Ein reines Datum, das als Mitternacht UTC ankommt, bleibt derselbe Tag.
  if (/^\d{4}-\d{2}-\d{2}T00:00:00(\.0+)?Z$/.test(s)) return s.slice(0, 10);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : berlinTag(d);
}
const statusAus = (w: unknown): GlobalStatus => (STATUS_WERTE.includes(txt(w) as GlobalStatus) ? (txt(w) as GlobalStatus) : "offen");
const etappeAus = (w: unknown): number => Math.min(5, Math.max(0, Math.round(zahl(w, 0))));

function schrittAus(w: unknown): GlobalSchritt | null {
  if (typeof w === "string") return w.trim() ? { text: w.trim(), bis: null } : null;
  const o = ding(w); const text = txt(o.text);
  return text ? { text, bis: isoTagAus(o.bis) } : null;
}

// ── Berlin-Zeit im Browser ──────────────────────────────────────────────────
// Bewusst formatToParts: Number(Intl.format()) hat im Haus schon einmal NaN
// geliefert (Zeit-Falle Berlin-Stunde). Hier wird nur zusammengesetzt, nie gerechnet.
export function berlinTag(d: Date = new Date()): string {
  const teile = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const t = (art: string) => teile.find((x) => x.type === art)?.value ?? "";
  return `${t("year")}-${t("month")}-${t("day")}`;
}
/** Ganze Kalendertage von `heute` bis `tag` (negativ = vorbei). Rechnet auf UTC-Mitternacht — ohne Sommerzeit-Sprung. */
export function tageBis(tag: string | null, heute: string = berlinTag()): number | null {
  if (!tag || !/^\d{4}-\d{2}-\d{2}$/.test(tag) || !/^\d{4}-\d{2}-\d{2}$/.test(heute)) return null;
  const ms = Date.parse(`${tag}T00:00:00Z`) - Date.parse(`${heute}T00:00:00Z`);
  return Number.isFinite(ms) ? Math.round(ms / 86_400_000) : null;
}
/** „01.10.2026" — aus dem ISO-Tag gesetzt, nicht über die Zeitzone des Rechners gerechnet. */
export function tagText(w: unknown): string {
  const tag = isoTagAus(w);
  if (!tag) return "—";
  const [j, m, t] = tag.split("-");
  return `${t}.${m}.${j}`;
}
/** „17.09.2026, 14:05" für Zeitpunkte aus dem Verlauf (Berliner Zeit). */
export function zeitText(w: unknown): string {
  const s = txt(w);
  if (!s) return "—";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return tagText(s);
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
/** „in 12 Tagen", „heute", „seit 3 Tagen überfällig". */
export function fristLage(tag: string | null, heute: string = berlinTag()): { text: string; ton: "rot" | "warn" | "still" } {
  const n = tageBis(tag, heute);
  if (n === null) return { text: "", ton: "still" };
  if (n < 0) return { text: n === -1 ? "seit gestern überfällig" : `seit ${-n} Tagen überfällig`, ton: "rot" };
  if (n === 0) return { text: "heute", ton: "rot" };
  if (n === 1) return { text: "morgen", ton: "warn" };
  return { text: `in ${n} Tagen`, ton: n <= 30 ? "warn" : "still" };
}

export function groesseText(bytes: unknown): string {
  const b = zahl(bytes, 0);
  if (b <= 0) return "";
  if (b < 1024 * 1024) return `${Math.max(1, Math.round(b / 1024))} KB`;
  return `${(b / (1024 * 1024)).toLocaleString("de-DE", { maximumFractionDigits: 1 })} MB`;
}
export function euroText(cents: unknown): string {
  const c = zahl(cents, NaN);
  if (!Number.isFinite(c)) return "—";
  return `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: c % 100 === 0 ? 0 : 2, maximumFractionDigits: 2 })} €`;
}

// ── Die Serverantwort lesen ─────────────────────────────────────────────────
export function zeileLesen(roh: unknown): GlobalZeile | null {
  const o = ding(roh); const ref = txt(o.ref);
  if (!ref) return null;
  const frist = ding(o.naechsteFrist); const fristTag = isoTagAus(frist.faelligAm);
  const z = ding(o.zustaendig);
  return {
    ref, firma: txt(o.firma) || txt(ding(o.firma).name) || "Ohne Firmennamen", ort: txt(o.ort), land: txt(o.land),
    paket: txt(o.paket), paketName: txt(o.paketName) || globalKatalog(o.paket)?.label || txt(o.paket) || "FIAON Global",
    status: statusAus(o.status), etappe: etappeAus(o.etappe), stichtag: isoTagAus(o.stichtag),
    naechsterSchritt: schrittAus(o.naechsterSchritt), offeneUnterlagen: Math.max(0, Math.round(zahl(o.offeneUnterlagen, 0))),
    naechsteFrist: fristTag && txt(frist.titel) ? { titel: txt(frist.titel), faelligAm: fristTag } : null,
    zustaendig: txt(z.name) ? { id: zahl(z.id, 0), name: txt(z.name) } : null,
    alterTage: Math.max(0, Math.round(zahl(o.alterTage, 0))), bezahltAm: txt(o.bezahltAm) || null,
    betragCents: zahl(o.betragCents, globalKatalog(o.paket)?.preisCents ?? 0),
  };
}
export function zeilenLesen(json: unknown): GlobalZeile[] {
  return liste(ding(json).zeilen).map(zeileLesen).filter((z): z is GlobalZeile => !!z);
}

/** Die sechs Etappen, falls die Antwort sie nicht mitbringt. Die TITEL sind die aus der
 *  Schnittstelle; Wahrheit für Titel UND Kundentexte ist shared/fiaon-global-bereich.ts im Server. */
export const ETAPPEN_TITEL: string[] = ["Auftrag angelegt", "Gründung und Dokumente", "Die erste Firmenkarte", "Die Kartenleiter", "Das Bankdarlehen", "Abgeschlossen"];

function etappenLesen(w: unknown, aktuelle: number): GlobalEtappe[] {
  const vomServer = new Map<number, Record<string, any>>();
  for (const e of liste(w)) { const o = ding(e); const nr = Math.round(zahl(o.nr, -1)); if (nr >= 0 && nr <= 5) vomServer.set(nr, o); }
  return ETAPPEN_TITEL.map((titel, nr) => {
    const o = vomServer.get(nr) ?? {};
    const stand = ["fertig", "jetzt", "offen"].includes(txt(o.stand)) ? (txt(o.stand) as GlobalEtappe["stand"]) : nr < aktuelle ? "fertig" : nr === aktuelle ? "jetzt" : "offen";
    return { nr, titel: txt(o.titel) || titel, text: txt(o.text), stand, seit: isoTagAus(o.seit) };
  });
}

/** Welche Arten der Upload anbietet. Nennt der Server sie (dokumentArten), gilt seine Liste.
 *  Sonst: die Arten der Unterlagenliste — die kennt der Server sicher — und „sonstiges". */
export const ART_SONSTIGES = "sonstiges";
function artenLesen(a: Record<string, any>): { art: string; titel: string }[] {
  const aus: { art: string; titel: string }[] = [];
  const dazu = (art: string, titel: string) => { if (art && !aus.some((x) => x.art === art)) aus.push({ art, titel: titel || art }); };
  for (const x of liste(a.dokumentArten)) { const o = ding(x); dazu(txt(o.art), txt(o.titel)); }
  if (!aus.length) {
    for (const x of liste(a.unterlagen)) { const o = ding(x); dazu(txt(o.art), txt(o.titel)); }
    dazu(ART_SONSTIGES, "Sonstiges Dokument");
  }
  return aus;
}

export function akteLesen(json: unknown): GlobalAkte | null {
  const a = ding(ding(json).auftrag); const ref = txt(a.ref);
  if (!ref) return null;
  const firma = ding(a.firma), voll = ding(a.firmaVoll), zahlung = ding(a.zahlung), g = ding(a.gesellschaft), k = ding(a.kontakt), intern = ding(a.intern), ap = ding(a.ansprechpartner);
  const etappe = etappeAus(a.etappe);
  const status = statusAus(a.status);
  const form = txt(g.form);
  const itin = txt(g.itinStand);
  const firmaVoll: Record<string, string> = {};
  for (const [schluessel, wert] of Object.entries(voll)) { const t = txt(wert); if (t) firmaVoll[schluessel] = t; }
  const apName = txt(ap.name) || [txt(ap.vorname), txt(ap.nachname)].filter(Boolean).join(" ");
  return {
    ref, status, sprache: txt(a.sprache) === "en" ? "en" : "de",
    paket: txt(a.paket), paketName: txt(a.paketName) || globalKatalog(a.paket)?.label || txt(a.paket) || "FIAON Global",
    betragCents: a.betragCents != null && Number.isFinite(Number(a.betragCents)) ? Number(a.betragCents) : globalKatalog(a.paket)?.preisCents ?? null,
    firma: { name: txt(firma.name) || txt(voll.name) || "Ohne Firmennamen", ort: txt(firma.ort) || txt(voll.ort), land: txt(firma.land) || txt(voll.land) },
    zahlung: { status: txt(zahlung.status) === "bezahlt" || ["bezahlt", "gestartet", "abgeschlossen"].includes(status) ? "bezahlt" : "offen", zahlungsseite: txt(zahlung.zahlungsseite) || null },
    etappe, etappen: etappenLesen(a.etappen, etappe),
    stichtag: isoTagAus(a.stichtag), naechsterSchritt: schrittAus(a.naechsterSchritt),
    ansprechpartner: apName ? { name: apName, email: txt(ap.email), telefon: txt(ap.telefon) } : null,
    gesellschaft: {
      name: txt(g.name), form: form === "LLC" || form === "Corporation" ? form : "", bundesstaat: txt(g.bundesstaat).toUpperCase(),
      gegruendetAm: isoTagAus(g.gegruendetAm) ?? "", einVorhanden: g.einVorhanden === true,
      itinStand: itin === "beantragt" || itin === "vorhanden" ? itin : "offen",
    },
    unterlagen: liste(a.unterlagen).map((u) => { const o = ding(u); return { art: txt(o.art), titel: txt(o.titel) || txt(o.art), hinweis: txt(o.hinweis), vorhanden: o.vorhanden === true }; }).filter((u) => u.art),
    dokumente: liste(a.dokumente).map((d) => {
      const o = ding(d);
      const sichtbar = typeof o.sichtbar === "boolean" ? o.sichtbar : typeof o.sichtbarFuerKunde === "boolean" ? o.sichtbarFuerKunde : null;
      return { id: txt(o.id), art: txt(o.art), artText: txt(o.artText) || txt(o.art) || "Dokument", name: txt(o.name) || "Datei", groesse: zahl(o.groesse, 0), von: txt(o.von) === "fiaon" ? "fiaon" as const : "kunde" as const, am: txt(o.am) || null, sichtbar };
    }).filter((d) => d.id),
    fristen: liste(a.fristen).map((f) => {
      const o = ding(f); const tag = isoTagAus(o.faelligAm);
      return { id: txt(o.id), titel: txt(o.titel) || "Frist", faelligAm: tag ?? "", erledigt: o.erledigt === true, hinweis: txt(o.hinweis), regel: o.regel === true || txt(o.quelle) === "regel" };
    }).filter((f) => f.id && f.faelligAm),
    dokumentArten: artenLesen(a),
    verlauf: liste(a.verlauf).map((v) => { const o = ding(v); return { am: txt(o.am) || null, text: txt(o.text) }; }).filter((v) => v.text),
    vertragUrl: txt(a.vertragUrl) || null, rechnungUrl: txt(a.rechnungUrl) || null,
    kontakt: { anrede: txt(k.anrede), vorname: txt(k.vorname), nachname: txt(k.nachname), funktion: txt(k.funktion), email: txt(k.email), telefon: txt(k.telefon) },
    firmaVoll, ustId: txt(a.ustId) || txt(voll.ustId),
    notizen: liste(intern.notizen).map((n) => { const o = ding(n); return { id: txt(o.id), am: txt(o.am) || null, von: txt(o.von), text: txt(o.text), sichtbar: o.sichtbar === true }; }).filter((n) => n.text),
    verlaufAlles: liste(intern.verlaufAlles).map((v) => { const o = ding(v); return { am: txt(o.am) || null, art: txt(o.art), text: txt(o.text), sichtbar: o.sichtbar === true, von: txt(o.von) }; }).filter((v) => v.text),
    kundenLink: txt(a.kundenLink) || null,
  };
}

// ── Die Liste: Reihenfolge, Kopfzahlen, Filter ──────────────────────────────
// Reihenfolge (Auftrag): bezahlt-nicht-gestartet zuerst — dort liegt Geld ohne
// Arbeit. Dann die nächste Frist (wer keine hat, steht dahinter), dann das
// Alter (der ältere wartet länger). Abgeschlossenes und Storniertes ganz unten.
const RANG: Record<GlobalStatus, number> = { bezahlt: 0, gestartet: 1, offen: 1, abgeschlossen: 2, storniert: 3 };
export function sortiere(zeilen: GlobalZeile[]): GlobalZeile[] {
  return [...zeilen].sort((a, b) => {
    if (RANG[a.status] !== RANG[b.status]) return RANG[a.status] - RANG[b.status];
    const fa = a.naechsteFrist?.faelligAm ?? "9999-12-31", fb = b.naechsteFrist?.faelligAm ?? "9999-12-31";
    if (fa !== fb) return fa < fb ? -1 : 1;
    if (a.alterTage !== b.alterTage) return b.alterTage - a.alterTage;
    return a.ref < b.ref ? -1 : a.ref > b.ref ? 1 : 0;
  });
}

export interface GlobalKopfzahlen { offen: number; bezahlt: number; inArbeit: number; fristen30: number; offenCents: number }
export function kopfZahlen(zeilen: GlobalZeile[], heute: string = berlinTag()): GlobalKopfzahlen {
  const laufend = (z: GlobalZeile) => z.status !== "storniert" && z.status !== "abgeschlossen";
  return {
    offen: zeilen.filter((z) => z.status === "offen").length,
    bezahlt: zeilen.filter((z) => z.status === "bezahlt").length,
    inArbeit: zeilen.filter((z) => z.status === "gestartet").length,
    // Überfällige zählen mit: Eine verpasste Frist ist dringender als eine in 29 Tagen.
    fristen30: zeilen.filter((z) => laufend(z) && z.naechsteFrist && (tageBis(z.naechsteFrist.faelligAm, heute) ?? 999) <= 30).length,
    offenCents: zeilen.filter((z) => z.status === "offen").reduce((s, z) => s + z.betragCents, 0),
  };
}

export type GlobalFilter = "laufend" | "offen" | "bezahlt" | "gestartet" | "abgeschlossen" | "alle";
export const FILTER_TEXT: [GlobalFilter, string][] = [
  ["laufend", "Laufend"], ["offen", "Offen, unbezahlt"], ["bezahlt", "Bezahlt, nicht gestartet"],
  ["gestartet", "In Arbeit"], ["abgeschlossen", "Abgeschlossen"], ["alle", "Alle"],
];
export function filtere(zeilen: GlobalZeile[], filter: GlobalFilter, suche: string): GlobalZeile[] {
  const q = suche.trim().toLowerCase();
  return zeilen.filter((z) => {
    if (filter === "laufend" && (z.status === "storniert" || z.status === "abgeschlossen")) return false;
    if (filter !== "laufend" && filter !== "alle" && z.status !== filter) return false;
    if (!q) return true;
    return [z.firma, z.ort, z.ref, z.paketName, z.zustaendig?.name ?? "", z.naechsterSchritt?.text ?? ""].some((t) => t.toLowerCase().includes(q));
  });
}

export const STATUS_TEXT: Record<GlobalStatus, [string, "warn" | "dringend" | "gut" | "still" | ""]> = {
  offen: ["Offen — wartet auf Zahlung", "warn"],
  bezahlt: ["Bezahlt — nicht gestartet", "dringend"],
  gestartet: ["In Arbeit", ""],
  abgeschlossen: ["Abgeschlossen", "gut"],
  storniert: ["Storniert", "still"],
};

/** Dieselben Stände in der Kurzform für die Listenzeile (die Spalte ist bei 1180 px rund 150 px breit). */
export const STATUS_KURZ: Record<GlobalStatus, string> = {
  offen: "Offen — unbezahlt", bezahlt: "Bezahlt — Start fehlt", gestartet: "In Arbeit", abgeschlossen: "Abgeschlossen", storniert: "Storniert",
};

/** Bis zu welcher Etappe das Paket reicht — abgeleitet aus den Leistungen in shared/fiaon-global.ts:
 *  Struktur endet mit dem ersten Konto- und Kartenantrag, Banking mit der Reihenfolge weiterer
 *  Herausgeber, Kapital und VIP mit den Unterlagen für ein späteres Bankdarlehen. */
export function etappenImPaket(paket: string): number {
  const key = globalPaket(paket)?.key;
  return key === "global_struktur" ? 2 : key === "global_banking" ? 3 : 4;
}

// ── Was das Werkzeug dem KUNDEN vorschlägt (Sie-Form, wandkonform) ──────────
// Der Mitarbeiter darf jeden Satz ändern. Was hier steht, sagt nur, was FIAON
// tut — nie, was ein Institut entscheidet, und nie eine Frist.
export const ETAPPE_KUNDENTEXT: string[] = [
  "Ihr Auftrag ist bei uns angelegt. Mit dem Zahlungseingang beginnt die Arbeit an Ihrer US-Gesellschaft.",
  "Wir bereiten die Gründung Ihrer US-Gesellschaft vor und stellen die Unterlagen zusammen. Welche Dokumente wir von Ihnen brauchen, sehen Sie in Ihrem Auftrag unter „Unterlagen“.",
  "Ihre Gesellschaft steht. Wir bereiten jetzt den ersten Konto- und Kartenantrag vollständig vor. Über Konto, Karte und Rahmen entscheidet allein das jeweilige Institut.",
  "Die erste Kartenbeziehung läuft. Wir planen mit Ihnen die Reihenfolge weiterer Herausgeber und bereiten jeden weiteren Antrag vollständig vor. Über jeden Antrag entscheidet das jeweilige Institut.",
  "Wir stellen mit Ihnen die Kennzahlen-Mappe und die Unterlagen für ein späteres Bankdarlehen zusammen. Ob und zu welchen Bedingungen ein Darlehen vergeben wird, entscheidet allein die Bank.",
  "Ihr Auftrag ist abgeschlossen. Ihre Dokumente und den Pflichtenkalender finden Sie weiterhin in Ihrem Auftrag.",
];
export const KUNDEN_PLATZHALTER = {
  schritt: "z. B. Bitte laden Sie Ihren Reisepass und einen Adressnachweis in Ihrem Auftrag hoch.",
  notiz: "z. B. Ihre Gründungsunterlagen sind eingereicht. Sobald die Bestätigung des Bundesstaates vorliegt, finden Sie sie in Ihrem Dokumentenraum.",
  abschluss: "z. B. Alle Leistungen aus Ihrem Paket sind erbracht. Ihre Dokumente und den Pflichtenkalender finden Sie weiterhin in Ihrem Auftrag.",
  // Titel und Hinweis einer eigenen Frist stehen im Pflichtenkalender des Kunden — auch sie sind Kundentext.
  fristTitel: "z. B. Monatlicher Durchgang mit Ihrem Ansprechpartner",
  fristHinweis: "z. B. Bitte halten Sie dafür die Unterlagen Ihres Steuerberaters bereit.",
};
// Wer auf /en/business/start unterschrieben hat, liest Englisch (Feld `sprache` der Akte).
// Britisches Englisch wie der ganze englische Auftritt; dieselben Grenzen wie im Deutschen.
export const ETAPPE_KUNDENTEXT_EN: string[] = [
  "Your order has been set up. Work on your US company begins once your payment has been received.",
  "We are preparing the formation of your US company and putting the documents together. The documents we need from you are listed in your order under “Documents”.",
  "Your company has been formed. We are now preparing the first account and card application in full. The institution alone decides on the account, the card and the limit.",
  "The first card relationship is in place. Together with you we plan the sequence of further issuers and prepare every further application in full. Each institution decides on its own application.",
  "Together with you we are compiling the key-figures file and the documents for a later bank loan. Whether a loan is granted, and on what terms, is decided by the bank alone.",
  "Your order is complete. You will continue to find your documents and the compliance calendar in your order.",
];
export const KUNDEN_PLATZHALTER_EN = {
  schritt: "e.g. Please upload your passport and a proof of address in your order.",
  notiz: "e.g. Your formation documents have been filed. As soon as the state has confirmed them, you will find the confirmation in your document room.",
  abschluss: "e.g. All services in your package have been delivered. You will continue to find your documents and the compliance calendar in your order.",
  fristTitel: "e.g. Monthly review with your dedicated contact",
  fristHinweis: "e.g. Please have the documents from your tax adviser ready.",
};
export const etappeKundentext = (nr: number, sprache: "de" | "en"): string =>
  (sprache === "en" ? ETAPPE_KUNDENTEXT_EN : ETAPPE_KUNDENTEXT)[Math.min(5, Math.max(0, Math.round(nr)))] ?? "";
export const kundenPlatzhalter = (sprache: "de" | "en") => (sprache === "en" ? KUNDEN_PLATZHALTER_EN : KUNDEN_PLATZHALTER);

/** Hinweise zu einem Satz, der an den Kunden geht — Hausregeln und Global-Regeln. */
export function kundentextHinweise(text: string): GlobalWorthinweis[] {
  // „meldet sich bei Ihnen" ist im Auftrag GEDECKT: Jede Kundennachricht legt eine Aufgabe
  // bei der zuständigen Person an — und die schreibt diesen Satz gerade selbst.
  return globalWortPruefen(text, ["aufgabe_an_betreuer", "notiz_an_betreuer"]);
}

// ── Der Kasten „Was ich dem Kunden NICHT zusage" ────────────────────────────
export interface NichtZusagen { verbote: string[]; saetze: string[]; pflicht: string[]; rollen: string[] }
export function nichtZusagen(): NichtZusagen {
  const alle = globalLeitfaden().flatMap((b) => b.s);
  return {
    // Die Anweisungen an den Mitarbeiter (Du-Form) — wörtlich aus dem Leitfaden.
    verbote: alle.filter((s) => !s.kunde && /^(NIE zusagen|Steuer und Recht)/.test(s.text)).map((s) => s.text),
    // Die zwei Antworten, mit denen er es dem Kunden sagt (Sie-Form) — wörtlich aus den Einwänden.
    saetze: alle.filter((s) => s.kunde && /^„(Bekomme ich dann sicher|Spare ich damit Steuern)/.test(s.text)).map((s) => s.text),
    pflicht: [...GLOBAL_PFLICHTHINWEIS.de],
    rollen: [GLOBAL_ROLLEN.de.fiaon, GLOBAL_ROLLEN.de.partner, GLOBAL_ROLLEN.de.kosten],
  };
}

// ── Hochladen: prüfen, BEVOR 15 MB auf die Reise gehen ──────────────────────
export const UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
export const UPLOAD_ERLAUBT = ".pdf,.jpg,.jpeg,.png,.heic,application/pdf,image/jpeg,image/png,image/heic";
const ENDUNGEN = ["pdf", "jpg", "jpeg", "png", "heic"];
const MIME = ["application/pdf", "image/jpeg", "image/png", "image/heic", "image/heif"];
/** null = in Ordnung; sonst der Satz für den Mitarbeiter. */
export function dateiPruefen(datei: { name: string; size: number; type?: string } | null | undefined): string | null {
  if (!datei) return "Bitte wähl eine Datei aus.";
  const endung = String(datei.name || "").toLowerCase().split(".").pop() || "";
  // HEIC-Fotos kommen aus manchen Browsern ohne Typangabe — dann entscheidet die Endung.
  const typOk = datei.type ? MIME.includes(String(datei.type).toLowerCase()) : ENDUNGEN.includes(endung);
  if (!typOk || !ENDUNGEN.includes(endung)) return "Dieser Dateityp geht nicht. Erlaubt sind PDF, JPG, PNG und HEIC.";
  if (!(datei.size > 0)) return "Die Datei ist leer.";
  if (datei.size > UPLOAD_MAX_BYTES) return `Die Datei ist ${groesseText(datei.size)} groß — erlaubt sind 15 MB.`;
  return null;
}

// ── Die 50 Bundesstaaten und der District of Columbia ───────────────────────
export const US_STAATEN: [string, string][] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"], ["CA", "Kalifornien"], ["CO", "Colorado"],
  ["CT", "Connecticut"], ["DE", "Delaware"], ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"],
  ["HI", "Hawaii"], ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"], ["KS", "Kansas"],
  ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"], ["MD", "Maryland"], ["MA", "Massachusetts"],
  ["MI", "Michigan"], ["MN", "Minnesota"], ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"],
  ["NE", "Nebraska"], ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"], ["OK", "Oklahoma"],
  ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"], ["SC", "South Carolina"], ["SD", "South Dakota"],
  ["TN", "Tennessee"], ["TX", "Texas"], ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
];
export const staatName = (kuerzel: string): string => US_STAATEN.find(([k]) => k === kuerzel)?.[1] ?? kuerzel;

/** Beschriftung der Firmenfelder aus dem Auftrag (firmaVoll) — Unbekanntes zeigt seinen Schlüssel. */
export const FIRMA_FELDER: [string, string][] = [
  ["name", "Firma"], ["rechtsform", "Rechtsform"], ["strasse", "Straße"], ["plz", "PLZ"], ["ort", "Ort"], ["land", "Land"],
  ["registergericht", "Registergericht"], ["registernummer", "Registernummer"], ["website", "Website"], ["branche", "Branche"],
];
export const LAND_NAME: Record<string, string> = { DE: "Deutschland", AT: "Österreich", CH: "Schweiz" };
/** Wie die Art eines Verlaufseintrags im Office heißt. Eine Art, die hier fehlt, zeigt ihren Schlüssel. */
export const VERLAUF_ART: Record<string, string> = {
  auftrag: "Auftrag", zahlung: "Zahlung", start: "Start", etappe: "Etappe", schritt: "Nächster Schritt", "naechster-schritt": "Nächster Schritt",
  stichtag: "Stichtag", gesellschaft: "Gesellschaft", frist: "Frist", dokument: "Dokument", notiz: "Notiz", nachricht: "Nachricht des Kunden",
  zugang: "Zugang", mail: "E-Mail", abschluss: "Abschluss", abschliessen: "Abschluss", storno: "Storno",
};

export const telLink = (telefon: string): string => `tel:${String(telefon || "").replace(/[^0-9+]/g, "")}`;
