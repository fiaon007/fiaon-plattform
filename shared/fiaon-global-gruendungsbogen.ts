// ═══════════════════════════════════════════════════════════════════════════
// DER GRÜNDUNGSBOGEN — REGELN UND WORTLAUT (E-526, 17.11.2026)
//
// Mehrere Gesellschafter gründen GEMEINSAM eine US-LLC. Jeder macht seine Angaben
// SELBST und unterschreibt SELBST, getrennt von den anderen. Dafür gibt es:
//   · eine GEMEINSAME Seite (/business/gruendung/:bogenToken): Kopf, „So geht es“,
//     Kostenhinweis, Statusliste je Mitglied, „Ich bin … — persönlichen Zugang anfordern“;
//   · je Mitglied eine PERSÖNLICHE Seite (/business/gruendung/:bogenToken/m/:mitgliedToken),
//     deren Link nur an die hinterlegte Adresse dieses Mitglieds geht: Gesellschaft ·
//     Ihre Angaben · Bestätigen und unterschreiben.
//
// ── DIESE DATEI IST REIN ──────────────────────────────────────────────────
// Keine Datenbank, kein Netz, kein Node-Modul: Browser, Server und der Prüfstand
// (scripts/pruef-gruendungsbogen.ts) lesen dieselben Regeln. „heute“/„jetzt“ kommen als
// Parameter. Kundentexte gesiezt; jeder deutsche Satz läuft durch die Wortwand
// (scripts/pruef-wortwand-de.ts sammelt GB_TEXTE und GB_BESTAETIGUNGEN).
//
// ── EIN SATZ, DER RECHTLICH ZÄHLT, STEHT GENAU EINMAL ─────────────────────
// Die fünf Bestätigungen vor der Unterschrift (GB_BESTAETIGUNGEN) stehen NUR hier.
// Seite, PDF und Hash lesen sie von hier; GB_WORTLAUT_FASSUNG steht im PDF und im
// Hash — wer einen Satz ändert, zählt die Fassung hoch.
//
// ── GEMEINSAM ODER PERSÖNLICH ─────────────────────────────────────────────
// Die gemeinsamen Angaben (GbGesellschaft) sind für alle gleich; jede Änderung erhöht
// die Fassung, und wer schon unterschrieben hat, muss neu unterschreiben (zuUeberholen).
// Die persönlichen Angaben (GbAngaben) sieht nur das Mitglied selbst und die Leitung —
// das andere Mitglied sieht vom anderen nur Namen und Status.
// ═══════════════════════════════════════════════════════════════════════════
import { STAATEN_ANGEBOTEN, STAAT_VORGABE_NEU, BUNDESSTAATEN, EIN_ZEITEN, type AngebotenerStaat } from "./fiaon-global-bundesstaaten";

export const GB_RECHTSFORM = "LLC" as const;
export const GB_KENNUNG_PRAEFIX = "GB-";
export const GB_MITGLIEDER_MIN = 2;
export const GB_MITGLIEDER_MAX = 6;
/** Der gemeinsame Link gilt 90 Tage (jede Ausgabe stellt neu aus). */
export const GB_BOGEN_TOKEN_TAGE = 90;
/** Der persönliche Link gilt 14 Tage. */
export const GB_MITGLIED_TOKEN_TAGE = 14;
/** Höchstens so viele Zugangs-Mails je Mitglied im Stundenfenster. */
export const GB_ZUGANG_MAX_JE_STUNDE = 5;
export const GB_ZUGANG_FENSTER_MS = 60 * 60 * 1000;
/** Bildseite des Reisepasses: PDF, JPG oder PNG, höchstens 10 MB. */
export const GB_REISEPASS_MAX_BYTES = 10 * 1024 * 1024;
export const GB_REISEPASS_TYPEN = ["application/pdf", "image/jpeg", "image/png"] as const;
/** Vorgabe der Leitung beim Anlegen. */
export const GB_KOSTEN_VORGABE = "Die Kosten der Gründung trägt ein Dritter; Ihnen entstehen keine Kosten.";
export const GB_STAAT_VORGABE: AngebotenerStaat = STAAT_VORGABE_NEU;
/** Fassung des Wortlauts (Bestätigungen, PDF-Aufbau). Steht im PDF und im Hash. */
export const GB_WORTLAUT_FASSUNG = "GB-2026-11-17";

export type GbStatus = "offen" | "vollstaendig" | "geschlossen";
export type GbFuehrung = "member" | "manager";
export type GbUnterschriftStatus = "offen" | "unterschrieben" | "neu_noetig";
export type GbAnrede = "Herr" | "Frau" | "";

export interface GbGesellschaft {
  wunschname1: string;
  wunschname2: string;
  wunschname3: string;
  bundesstaat: AngebotenerStaat;
  gegenstand: string;
  fuehrung: GbFuehrung;
  /** Mitglied-ids der Manager (nur bei „manager“). */
  manager: number[];
  /** Mitglied-id → Anteil in Prozent (höchstens zwei Nachkommastellen). */
  anteile: Record<string, number>;
  /** Mitglied-id der verantwortlichen Person für die EIN („Responsible Party“). */
  responsibleParty: number | null;
  website: string;
  anmerkungen: string;
}

export interface GbAngaben {
  anrede: GbAnrede;
  vornamen: string;
  nachname: string;
  geburtsdatum: string;
  geburtsort: string;
  staatsangehoerigkeit: string;
  strasse: string;
  plz: string;
  ort: string;
  land: string;
  steuerAnsaessig: string;
  kontaktEmail: string;
  telefon: string;
  passNummer: string;
  passStaat: string;
  passGueltigBis: string;
  /** null = noch nicht beantwortet. */
  usSteuernummerVorhanden: boolean | null;
  usSteuernummer: string;
}

export type GbFehler = { feld: string; text: string };
export type GbPruefung<T> = { ok: true; daten: T } | { ok: false; feld: string; error: string };

// ── Hilfen ───────────────────────────────────────────────────────────────────
const text = (v: unknown, max: number): string => {
  let s = String(v ?? "");
  try { s = s.normalize("NFC"); } catch { /* Rohwert */ }
  return s.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
};
const mehrzeilig = (v: unknown, max: number): string => {
  let s = String(v ?? "");
  try { s = s.normalize("NFC"); } catch { /* Rohwert */ }
  return s.replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f​-‏‪-‮⁦-⁩﻿]/g, " ")
    .split("\n").map((z) => z.replace(/[ \t]+/g, " ").trim()).join("\n").replace(/\n{3,}/g, "\n\n").trim().slice(0, max);
};
const nein = <T>(feld: string, error: string): GbPruefung<T> => ({ ok: false, feld, error });

/** Ein Mitglied-Schlüssel: positive ganze Zahl. */
const idAus = (v: unknown): number | null => { const n = Number(v); return Number.isInteger(n) && n > 0 ? n : null; };

export const EMAIL_MUSTER = /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/;
export function emailNormalisieren(v: unknown): string {
  return text(v, 160).toLowerCase();
}

/** „kim@beispiel.example“ → „k•••@beispiel.example“. Leer oder kaputt → „•••“. */
export function emailMaskieren(v: unknown): string {
  const s = emailNormalisieren(v);
  const at = s.lastIndexOf("@");
  if (at < 1 || at === s.length - 1) return "•••";
  return `${s[0]}•••@${s.slice(at + 1)}`;
}

/** SSN/ITIN (9 Ziffern) maskiert: „•••-••-6789“. */
export function usNummerMaskieren(v: unknown): string {
  const z = String(v ?? "").replace(/\D/g, "");
  if (z.length < 4) return "";
  return `•••-••-${z.slice(-4)}`;
}

/** IPv4 → die ersten drei Blöcke, IPv6 → die ersten drei Gruppen (für das PDF). */
export function ipKuerzen(v: unknown): string {
  const s = String(v ?? "").trim().replace(/^::ffff:/i, "");
  if (!s) return "—";
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(s)) return `${s.split(".").slice(0, 3).join(".")}.xxx`;
  if (s.includes(":")) return `${s.split(":").filter((x, i) => i < 3).join(":")}:…`;
  return "—";
}

/**
 * Name gleich? Groß-/Kleinschreibung und Leerzeichen sind egal (Regel der Unterschrift:
 * „Max  Muster“ = „max muster“ = „MaxMuster“). Sonst muss jedes Zeichen stimmen.
 */
export function namenGleich(a: unknown, b: unknown): boolean {
  const n = (v: unknown) => text(v, 300).toLocaleLowerCase("de-DE").replace(/\s+/g, "");
  const x = n(a);
  return x.length > 0 && x === n(b);
}

/** Der volle Name, wie er im Reisepass steht: „Vorname(n) Nachname“. */
export function nameLautPass(a: Pick<GbAngaben, "vornamen" | "nachname"> | null | undefined): string {
  return [a?.vornamen, a?.nachname].map((x) => text(x, 120)).filter(Boolean).join(" ");
}

/** Prozent in Hundertstel (ganzzahlig), damit 33,33 + 33,33 + 33,34 genau 100 ergibt. */
const hundertstel = (n: number) => Math.round(n * 100);
export function anteileSumme(anteile: Record<string, number>, ids: number[]): number {
  return ids.reduce((s, id) => s + hundertstel(Number(anteile[String(id)] ?? 0)), 0) / 100;
}
export function anteilText(n: number): string {
  return `${Number(n).toLocaleString("de-DE", { maximumFractionDigits: 2 })} %`;
}

/** Stabiles JSON (Schlüssel sortiert) — Grundlage des Hashs über die unterschriebenen Inhalte. */
export function stabilesJson(v: unknown): string {
  if (v === null || v === undefined) return "null";
  if (typeof v === "number") return Number.isFinite(v) ? JSON.stringify(v) : "null";
  if (typeof v === "string" || typeof v === "boolean") return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stabilesJson).join(",")}]`;
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o).sort().filter((k) => o[k] !== undefined).map((k) => `${JSON.stringify(k)}:${stabilesJson(o[k])}`).join(",")}}`;
  }
  return "null";
}

// ── Bundesstaaten ────────────────────────────────────────────────────────────
export function gbStaat(roh: unknown): AngebotenerStaat | null {
  const s = String(roh ?? "").trim().toLowerCase();
  for (const k of STAATEN_ANGEBOTEN) if (s === k || s === BUNDESSTAATEN[k].kurz.toLowerCase() || s === BUNDESSTAATEN[k].name.toLowerCase()) return k;
  return null;
}
export function gbStaatName(k: unknown): string {
  const s = gbStaat(k);
  return s ? BUNDESSTAATEN[s].name : String(k ?? "");
}
/** Die Staaten zur Wahl mit einem Satz Erklärung (aus der einen Quelle shared/fiaon-global-bundesstaaten.ts). */
export function gbStaatenZurWahl(): { schluessel: AngebotenerStaat; name: string; satz: string; eintragung: string }[] {
  return STAATEN_ANGEBOTEN.map((k) => ({ schluessel: k, name: BUNDESSTAATEN[k].name, satz: BUNDESSTAATEN[k].einordnung.de, eintragung: BUNDESSTAATEN[k].eintragungKurz.de }));
}

// ── Wunschname ───────────────────────────────────────────────────────────────
/** Ohne „LLC“ am Ende (der Zusatz ist fest) und ohne doppelte Leerzeichen. */
export function wunschnameNormalisieren(v: unknown): string {
  return text(v, 100).replace(/[\s,]*(l\.?\s?l\.?\s?c\.?|limited liability company)$/i, "").trim().slice(0, 80);
}
/** Fehlertext oder null. Leer ist hier KEIN Fehler (Pflicht prüft der Aufrufer). */
export function wunschnameFehler(n: string): string | null {
  if (!n) return null;
  if (/[äöüÄÖÜß]/.test(n)) return "Bitte ohne Umlaute schreiben (ä → ae, ö → oe, ü → ue, ß → ss) — die US-Behörden tragen Umlaute nicht ein.";
  if (!/^[A-Za-z0-9][A-Za-z0-9 &,.'\-]*$/.test(n)) return "Bitte nur lateinische Buchstaben, Ziffern und die Zeichen & - , . ' verwenden.";
  if (n.length < 2) return "Der Name ist zu kurz.";
  return null;
}

// ── Gemeinsame Angaben ───────────────────────────────────────────────────────
export function gesellschaftLeer(staat: AngebotenerStaat = GB_STAAT_VORGABE): GbGesellschaft {
  return { wunschname1: "", wunschname2: "", wunschname3: "", bundesstaat: staat, gegenstand: "", fuehrung: "member", manager: [], anteile: {}, responsibleParty: null, website: "", anmerkungen: "" };
}

/** Aus beliebiger Eingabe (Formular, JSONB) die Form machen — ohne zu urteilen. Unbekannte Mitglieder fallen weg. */
export function gesellschaftNormalisieren(roh: unknown, ids: number[]): GbGesellschaft {
  let r: any = roh;
  for (let i = 0; i < 2 && typeof r === "string"; i++) { try { r = JSON.parse(r); } catch { r = {}; } }
  if (!r || typeof r !== "object") r = {};
  const anteile: Record<string, number> = {};
  for (const id of ids) {
    const v = r.anteile?.[String(id)];
    const n = typeof v === "string" ? Number(v.replace(",", ".")) : Number(v);
    if (v !== undefined && v !== null && v !== "" && Number.isFinite(n)) anteile[String(id)] = Math.round(n * 100) / 100;
  }
  const fuehrung: GbFuehrung = r.fuehrung === "manager" ? "manager" : "member";
  const manager = fuehrung === "manager" && Array.isArray(r.manager)
    ? Array.from(new Set((r.manager as unknown[]).map(idAus).filter((x): x is number => x !== null && ids.includes(x)))).sort((a, b) => a - b)
    : [];
  const rp = idAus(r.responsibleParty);
  return {
    wunschname1: wunschnameNormalisieren(r.wunschname1),
    wunschname2: wunschnameNormalisieren(r.wunschname2),
    wunschname3: wunschnameNormalisieren(r.wunschname3),
    bundesstaat: gbStaat(r.bundesstaat) ?? GB_STAAT_VORGABE,
    gegenstand: mehrzeilig(r.gegenstand, 600),
    fuehrung, manager, anteile,
    responsibleParty: rp !== null && ids.includes(rp) ? rp : null,
    website: text(r.website, 120),
    anmerkungen: mehrzeilig(r.anmerkungen, 1200),
  };
}

/**
 * Prüfung der gemeinsamen Angaben. `stufe`:
 *   „speichern“    — Form und Inhalt jedes ausgefüllten Felds, Wunschname 1, Anteile = 100 %, Manager gewählt;
 *   „unterschrift“ — dazu alle Pflichtfelder (Ausweichnamen, Gegenstand, Responsible Party).
 * Gibt den ERSTEN Fehler mit Feld zurück (Muster des Hauses), sonst die normalisierte Form.
 */
export function gesellschaftPruefen(roh: unknown, ids: number[], stufe: "speichern" | "unterschrift"): GbPruefung<GbGesellschaft> {
  const g = gesellschaftNormalisieren(roh, ids);
  const fehlt = gesellschaftFehler(g, ids, stufe);
  if (fehlt.length) return nein(fehlt[0].feld, fehlt[0].text);
  return { ok: true, daten: g };
}

/** Alle Fehler der gemeinsamen Angaben (für die Liste „Was noch fehlt“). */
export function gesellschaftFehler(g: GbGesellschaft, ids: number[], stufe: "speichern" | "unterschrift"): GbFehler[] {
  const f: GbFehler[] = [];
  const streng = stufe === "unterschrift";
  const namen: [keyof GbGesellschaft, string][] = [["wunschname1", "Wunschname"], ["wunschname2", "Ausweichname 1"], ["wunschname3", "Ausweichname 2"]];
  for (const [feld, wort] of namen) {
    const n = String(g[feld] ?? "");
    const fehler = wunschnameFehler(n);
    if (fehler) f.push({ feld: `gesellschaft.${feld}`, text: `${wort}: ${fehler}` });
    else if (!n && (feld === "wunschname1" || streng)) f.push({ feld: `gesellschaft.${feld}`, text: feld === "wunschname1" ? "Bitte geben Sie den Wunschnamen der Gesellschaft an." : `Bitte geben Sie einen ${wort} an — falls der Wunschname schon vergeben ist, nehmen wir diesen.` });
  }
  const klein = [g.wunschname1, g.wunschname2, g.wunschname3].map((n) => n.toLowerCase()).filter(Boolean);
  if (new Set(klein).size !== klein.length) f.push({ feld: "gesellschaft.wunschname2", text: "Die drei Namen müssen verschieden sein." });
  if (streng && g.gegenstand.length < 10) f.push({ feld: "gesellschaft.gegenstand", text: "Bitte beschreiben Sie in einem Satz, womit sich die Gesellschaft beschäftigen soll." });
  if (g.website && !/^(https?:\/\/)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+(\/\S*)?$/i.test(g.website)) {
    f.push({ feld: "gesellschaft.website", text: "Bitte prüfen Sie die Website — zum Beispiel beispiel-llc.com." });
  }
  // Anteile: jedes Mitglied mehr als 0 %, höchstens 100 %, zusammen genau 100 %.
  for (const id of ids) {
    const n = g.anteile[String(id)];
    if (n === undefined) { f.push({ feld: `gesellschaft.anteile.${id}`, text: "Bitte tragen Sie für jeden Gesellschafter einen Anteil ein." }); break; }
    if (!(n > 0) || n > 100) { f.push({ feld: `gesellschaft.anteile.${id}`, text: "Jeder Anteil muss größer als 0 % und höchstens 100 % sein." }); break; }
    if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) { f.push({ feld: `gesellschaft.anteile.${id}`, text: "Bitte höchstens zwei Stellen nach dem Komma." }); break; }
  }
  if (!f.some((x) => x.feld.startsWith("gesellschaft.anteile."))) {
    const summe = anteileSumme(g.anteile, ids);
    if (Math.round(summe * 100) !== 10000) f.push({ feld: "gesellschaft.anteile", text: `Die Anteile ergeben zusammen ${anteilText(summe)} — es müssen genau 100 % sein.` });
  }
  if (g.fuehrung === "manager" && g.manager.length === 0) f.push({ feld: "gesellschaft.manager", text: "Bitte wählen Sie mindestens einen Manager." });
  if (streng && g.responsibleParty === null) f.push({ feld: "gesellschaft.responsibleParty", text: "Bitte wählen Sie, wer für die Steuernummer EIN verantwortlich ist (Responsible Party)." });
  return f;
}

/** Haben sich die gemeinsamen Angaben inhaltlich geändert? (Fassung zählt nur dann hoch.) */
export function gesellschaftGleich(a: GbGesellschaft, b: GbGesellschaft): boolean {
  return stabilesJson(a) === stabilesJson(b);
}

// ── Persönliche Angaben ──────────────────────────────────────────────────────
export function angabenLeer(): GbAngaben {
  return { anrede: "", vornamen: "", nachname: "", geburtsdatum: "", geburtsort: "", staatsangehoerigkeit: "", strasse: "", plz: "", ort: "", land: "", steuerAnsaessig: "", kontaktEmail: "", telefon: "", passNummer: "", passStaat: "", passGueltigBis: "", usSteuernummerVorhanden: null, usSteuernummer: "" };
}

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/;
function isoGueltig(s: string): boolean {
  if (!ISO_TAG.test(s)) return false;
  const [y, m, d] = s.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
/** „TT.MM.JJJJ“ oder „JJJJ-MM-TT“ → „JJJJ-MM-TT“; sonst der bereinigte Rohwert (die Prüfung meldet ihn). */
export function tagNormalisieren(v: unknown): string {
  const s = text(v, 20);
  const de = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
  if (de) return `${de[3]}-${de[2].padStart(2, "0")}-${de[1].padStart(2, "0")}`;
  return s;
}
/** Volle Jahre zwischen zwei ISO-Tagen. */
function jahreZwischen(von: string, bis: string): number {
  const [y1, m1, d1] = von.split("-").map(Number);
  const [y2, m2, d2] = bis.split("-").map(Number);
  return y2 - y1 - (m2 < m1 || (m2 === m1 && d2 < d1) ? 1 : 0);
}

/** Buchstaben des lateinischen Alphabets samt Umlauten und Akzenten (ohne u-Flag — das Ziel des Typchecks kennt es nicht). */
const BUCHSTABE = "A-Za-z\\u00C0-\\u00D6\\u00D8-\\u00F6\\u00F8-\\u024F\\u1E00-\\u1EFF";
const NAME_ZEICHEN = new RegExp(`^[${BUCHSTABE}][${BUCHSTABE} .'\\-]*$`);

export function angabenNormalisieren(roh: unknown): GbAngaben {
  let r: any = roh;
  for (let i = 0; i < 2 && typeof r === "string"; i++) { try { r = JSON.parse(r); } catch { r = {}; } }
  if (!r || typeof r !== "object") r = {};
  const anrede: GbAnrede = r.anrede === "Herr" || r.anrede === "Frau" ? r.anrede : "";
  const vorhanden = r.usSteuernummerVorhanden === true ? true : r.usSteuernummerVorhanden === false ? false : null;
  return {
    anrede,
    vornamen: text(r.vornamen, 120), nachname: text(r.nachname, 120),
    geburtsdatum: tagNormalisieren(r.geburtsdatum), geburtsort: text(r.geburtsort, 120), staatsangehoerigkeit: text(r.staatsangehoerigkeit, 80),
    strasse: text(r.strasse, 160), plz: text(r.plz, 12).toUpperCase(), ort: text(r.ort, 120), land: text(r.land, 80),
    steuerAnsaessig: text(r.steuerAnsaessig, 80),
    kontaktEmail: emailNormalisieren(r.kontaktEmail),
    telefon: text(r.telefon, 40),
    passNummer: text(r.passNummer, 30).toUpperCase().replace(/[\s-]/g, ""),
    passStaat: text(r.passStaat, 80),
    passGueltigBis: tagNormalisieren(r.passGueltigBis),
    usSteuernummerVorhanden: vorhanden,
    usSteuernummer: vorhanden === true ? String(r.usSteuernummer ?? "").replace(/\D/g, "").slice(0, 9) : "",
  };
}

/**
 * Fehler der persönlichen Angaben. `stufe`:
 *   „speichern“    — nur Form ausgefüllter Felder (Zwischenspeichern geht jederzeit);
 *   „unterschrift“ — dazu jedes Pflichtfeld und der hochgeladene Reisepass.
 */
export function angabenFehler(a: GbAngaben, o: { heute: string; stufe: "speichern" | "unterschrift"; reisepass?: boolean }): GbFehler[] {
  const f: GbFehler[] = [];
  const streng = o.stufe === "unterschrift";
  const pflicht = (feld: keyof GbAngaben, wert: string, satz: string) => { if (streng && !wert) f.push({ feld: `angaben.${feld}`, text: satz }); };

  pflicht("vornamen", a.vornamen, "Bitte geben Sie Ihre Vornamen an — genau wie im Reisepass.");
  if (a.vornamen && !NAME_ZEICHEN.test(a.vornamen)) f.push({ feld: "angaben.vornamen", text: "Bitte nur Buchstaben, Leerzeichen, Bindestrich und Apostroph." });
  pflicht("nachname", a.nachname, "Bitte geben Sie Ihren Nachnamen an — genau wie im Reisepass.");
  if (a.nachname && !NAME_ZEICHEN.test(a.nachname)) f.push({ feld: "angaben.nachname", text: "Bitte nur Buchstaben, Leerzeichen, Bindestrich und Apostroph." });

  if (a.geburtsdatum) {
    if (!isoGueltig(a.geburtsdatum) || a.geburtsdatum < "1900-01-01" || a.geburtsdatum >= o.heute) f.push({ feld: "angaben.geburtsdatum", text: "Bitte prüfen Sie das Geburtsdatum (TT.MM.JJJJ)." });
    else if (jahreZwischen(a.geburtsdatum, o.heute) < 18) f.push({ feld: "angaben.geburtsdatum", text: "Gesellschafter müssen volljährig sein." });
  } else pflicht("geburtsdatum", "", "Bitte geben Sie Ihr Geburtsdatum an.");
  pflicht("geburtsort", a.geburtsort, "Bitte geben Sie Ihren Geburtsort an.");
  pflicht("staatsangehoerigkeit", a.staatsangehoerigkeit, "Bitte geben Sie Ihre Staatsangehörigkeit an.");

  pflicht("strasse", a.strasse, "Bitte geben Sie Straße und Hausnummer an.");
  if (a.strasse && a.strasse.length < 3) f.push({ feld: "angaben.strasse", text: "Bitte geben Sie Straße und Hausnummer an." });
  pflicht("plz", a.plz, "Bitte geben Sie die Postleitzahl an.");
  if (a.plz && !/^[A-Z0-9][A-Z0-9 \-]{1,10}$/.test(a.plz)) f.push({ feld: "angaben.plz", text: "Bitte prüfen Sie die Postleitzahl." });
  pflicht("ort", a.ort, "Bitte geben Sie den Ort an.");
  pflicht("land", a.land, "Bitte geben Sie das Land an.");
  pflicht("steuerAnsaessig", a.steuerAnsaessig, "Bitte geben Sie an, in welchem Land Sie steuerlich ansässig sind.");

  if (a.kontaktEmail && !EMAIL_MUSTER.test(a.kontaktEmail)) f.push({ feld: "angaben.kontaktEmail", text: "Bitte prüfen Sie die E-Mail-Adresse." });
  if (a.telefon) {
    const ziffern = a.telefon.replace(/^\s*00/, "+").replace(/[^\d+]/g, "");
    if (!/^\+\d{8,15}$/.test(ziffern) || /[^\d+\s()\/.\-]/.test(a.telefon)) f.push({ feld: "angaben.telefon", text: "Bitte mit Ländervorwahl angeben — zum Beispiel +49 171 1234567." });
  } else pflicht("telefon", "", "Bitte geben Sie eine Telefonnummer mit Ländervorwahl an.");

  pflicht("passNummer", a.passNummer, "Bitte geben Sie die Nummer Ihres Reisepasses an.");
  if (a.passNummer && !/^[A-Z0-9]{5,20}$/.test(a.passNummer)) f.push({ feld: "angaben.passNummer", text: "Bitte prüfen Sie die Reisepassnummer (Buchstaben und Ziffern)." });
  pflicht("passStaat", a.passStaat, "Bitte geben Sie den Staat an, der Ihren Reisepass ausgestellt hat.");
  if (a.passGueltigBis) {
    if (!isoGueltig(a.passGueltigBis)) f.push({ feld: "angaben.passGueltigBis", text: "Bitte prüfen Sie das Datum (TT.MM.JJJJ)." });
    else if (a.passGueltigBis <= o.heute) f.push({ feld: "angaben.passGueltigBis", text: "Der Reisepass ist abgelaufen — bitte nehmen Sie einen gültigen Reisepass." });
  } else pflicht("passGueltigBis", "", "Bitte geben Sie an, bis wann Ihr Reisepass gültig ist.");

  if (streng && a.usSteuernummerVorhanden === null) f.push({ feld: "angaben.usSteuernummerVorhanden", text: "Bitte beantworten Sie, ob Sie eine US-Steuernummer (SSN oder ITIN) haben." });
  if (a.usSteuernummerVorhanden === true && a.usSteuernummer && a.usSteuernummer.length !== 9) f.push({ feld: "angaben.usSteuernummer", text: "Eine SSN oder ITIN hat neun Ziffern." });
  if (streng && a.usSteuernummerVorhanden === true && !a.usSteuernummer) f.push({ feld: "angaben.usSteuernummer", text: "Bitte tragen Sie Ihre SSN oder ITIN ein (neun Ziffern)." });

  if (streng && !o.reisepass) f.push({ feld: "reisepass", text: "Bitte laden Sie die Bildseite Ihres Reisepasses hoch." });
  return f;
}

/** Zwischenspeichern: der erste Formfehler oder die normalisierten Angaben. */
export function angabenPruefen(roh: unknown, heute: string): GbPruefung<GbAngaben> {
  const a = angabenNormalisieren(roh);
  const f = angabenFehler(a, { heute, stufe: "speichern" });
  if (f.length) return nein(f[0].feld, f[0].text);
  return { ok: true, daten: a };
}

// ── Unterschriften und Fassungen ────────────────────────────────────────────
export interface GbUnterschriftLage {
  id: number;
  unterschriebenAm: string | Date | null;
  unterschriftFassung: number | null;
  /** Wie viele frühere Unterschriften überholt wurden. */
  ueberholtAnzahl?: number;
}

/** Status der Unterschrift eines Mitglieds gegenüber der aktuellen Fassung. */
export function unterschriftStatus(m: GbUnterschriftLage, fassung: number): GbUnterschriftStatus {
  if (m.unterschriebenAm && Number(m.unterschriftFassung) === Number(fassung)) return "unterschrieben";
  if ((m.ueberholtAnzahl ?? 0) > 0 || (m.unterschriebenAm && Number(m.unterschriftFassung) !== Number(fassung))) return "neu_noetig";
  return "offen";
}

/** Wessen Unterschrift wird durch die neue Fassung überholt? (alle, die eine ältere Fassung unterschrieben haben) */
export function zuUeberholen(mitglieder: GbUnterschriftLage[], neueFassung: number): number[] {
  return mitglieder.filter((m) => m.unterschriebenAm && Number(m.unterschriftFassung) < Number(neueFassung)).map((m) => m.id);
}

/** Haben ALLE Mitglieder die aktuelle Fassung unterschrieben? (leere Liste: nein) */
export function alleUnterschrieben(mitglieder: GbUnterschriftLage[], fassung: number): boolean {
  return mitglieder.length >= GB_MITGLIEDER_MIN && mitglieder.every((m) => unterschriftStatus(m, fassung) === "unterschrieben");
}

/**
 * Drossel der Zugangs-Mails je Mitglied (dieselbe Regel wie das UPDATE in der Datenbank):
 * neues Fenster, wenn keins läuft oder es älter als eine Stunde ist; sonst höchstens fünf.
 */
export function zugangDrossel(l: { fensterAb: Date | string | null; anzahl: number; jetzt: Date }, max = GB_ZUGANG_MAX_JE_STUNDE, fensterMs = GB_ZUGANG_FENSTER_MS): { erlaubt: boolean; fensterAb: Date; anzahl: number } {
  const ab = l.fensterAb ? new Date(l.fensterAb) : null;
  if (!ab || Number.isNaN(ab.getTime()) || l.jetzt.getTime() - ab.getTime() >= fensterMs) return { erlaubt: true, fensterAb: l.jetzt, anzahl: 1 };
  if (l.anzahl >= max) return { erlaubt: false, fensterAb: ab, anzahl: l.anzahl };
  return { erlaubt: true, fensterAb: ab, anzahl: l.anzahl + 1 };
}

// ── Bestätigungen (der EINE Wortlaut) ───────────────────────────────────────
export type GbBestaetigungSchluessel = "richtig" | "auftrag" | "datenschutz" | "kosten" | "keineBeratung";
export interface GbBestaetigung { schluessel: GbBestaetigungSchluessel; titel: string; text: (kostenHinweis: string) => string; link?: { text: string; href: string } }
export const GB_BESTAETIGUNGEN: GbBestaetigung[] = [
  {
    schluessel: "richtig", titel: "Richtigkeit",
    text: () => "Meine Angaben sind richtig und vollständig. Änderungen teile ich FIAON unverzüglich mit.",
  },
  {
    schluessel: "auftrag", titel: "Auftrag und Vollmacht zur Gründung",
    text: () => "Ich beauftrage die FIAON LTD, London, die Gesellschaft mit den oben stehenden Angaben gemeinsam mit den übrigen Gesellschaftern zu gründen, "
      + "die Gründungsunterlagen bei der zuständigen Behörde des Bundesstaats einzureichen, die gesetzlich vorgeschriebene Zustelladresse (Registered Agent) zu stellen "
      + "und die Steuernummer EIN bei der US-Steuerbehörde IRS zu beantragen. Ich ermächtige sie, die dafür erforderlichen Erklärungen in meinem Namen abzugeben und Formulare vorzubereiten. "
      + "Unterschriften auf Behördenformularen, die eine eigenhändige Unterschrift verlangen, leiste ich selbst.",
  },
  {
    schluessel: "datenschutz", titel: "Datenschutz",
    text: () => "Meine Angaben und mein Reisepass werden ausschließlich für die Gründung und die damit verbundenen Behördenanträge verwendet und dafür an die zuständigen US-Behörden "
      + "und an den Dienstleister für die Zustelladresse übermittelt. Einzelheiten stehen in der Datenschutzerklärung.",
    link: { text: "Datenschutzerklärung", href: "/datenschutz" },
  },
  {
    schluessel: "kosten", titel: "Kosten",
    text: (k) => `${text(k, 400) || GB_KOSTEN_VORGABE} Das nehme ich zur Kenntnis.`,
  },
  {
    schluessel: "keineBeratung", titel: "Keine Rechts- oder Steuerberatung",
    text: () => "FIAON erbringt keine Rechts- oder Steuerberatung. Die steuerliche Behandlung der Gesellschaft und meiner Beteiligung kläre ich mit meiner eigenen Steuer- und Rechtsberatung.",
  },
];
export const GB_BESTAETIGUNG_SCHLUESSEL: GbBestaetigungSchluessel[] = GB_BESTAETIGUNGEN.map((b) => b.schluessel);

/** Nur ein echtes `true` je Kästchen zählt (nie vorangekreuzt). Erster fehlender Schlüssel oder null. */
export function bestaetigungFehlt(roh: unknown): GbBestaetigungSchluessel | null {
  const b = (roh && typeof roh === "object" ? roh : {}) as Record<string, unknown>;
  for (const k of GB_BESTAETIGUNG_SCHLUESSEL) if (b[k] !== true) return k;
  return null;
}

/** Der Wortlaut, wie er unterschrieben wird (in dieser Reihenfolge) — für PDF und Hash. */
export function bestaetigungsWortlaut(kostenHinweis: string): { titel: string; text: string }[] {
  return GB_BESTAETIGUNGEN.map((b) => ({ titel: b.titel, text: b.text(kostenHinweis) }));
}

/** Ort der Unterschrift: 2 bis 80 Zeichen. */
export function ortPruefen(v: unknown): string | null {
  const o = text(v, 80);
  return o.length >= 2 ? o : null;
}

// ── Was unterschrieben wird (Grundlage des Hashs) ────────────────────────────
export interface GbUnterschriftInhalt {
  kennung: string;
  fassung: number;
  wortlautFassung: string;
  rechtsform: string;
  kostenHinweis: string;
  gesellschaft: GbGesellschaft;
  /** Mitglied-id → Anzeigename (für Anteile, Manager, Responsible Party). */
  mitglieder: { id: number; name: string }[];
  ich: { id: number; anzeigename: string; email: string };
  /** Angaben mit maskierter US-Steuernummer (so, wie sie im PDF stehen). */
  angaben: GbAngaben;
  reisepassSha256: string;
  bestaetigungen: { titel: string; text: string }[];
  name: string;
  ort: string;
  zeitIso: string;
  ip: string;
}
/** Die eine Zeichenfolge, über die der SHA-256 läuft — stabil sortiert, ohne Unterschriftsbild. */
export function unterschriftInhaltText(i: GbUnterschriftInhalt): string {
  return `gruendungsbogen|${stabilesJson(i)}`;
}

/** Die Angaben, wie sie im PDF und im Hash stehen: US-Steuernummer maskiert. */
export function angabenFuerBeleg(a: GbAngaben): GbAngaben {
  return { ...a, usSteuernummer: a.usSteuernummerVorhanden === true ? usNummerMaskieren(a.usSteuernummer) : "" };
}

// ── Anlegen (Formular der Leitung und Skript — DIESELBE Prüfung) ─────────────
export interface GbAnlage {
  gruss: string;
  kostenHinweis: string;
  bundesstaat: AngebotenerStaat;
  wunschname: string;
  gegenstand: string;
  fuehrung: GbFuehrung;
  mitglieder: { anzeigename: string; email: string; anteil: number }[];
  notizIntern: string;
}
export function anlagePruefen(roh: unknown): GbPruefung<GbAnlage> {
  const r = (roh && typeof roh === "object" ? roh : {}) as Record<string, any>;
  const gruss = text(r.gruss, 300);
  if (gruss.length < 5) return nein("gruss", "Bitte die Anredezeile angeben (z. B. „Sehr geehrter Herr A, sehr geehrter Herr B“).");
  const kostenHinweis = text(r.kostenHinweis, 400) || GB_KOSTEN_VORGABE;
  const bundesstaat = r.bundesstaat === undefined || r.bundesstaat === "" ? GB_STAAT_VORGABE : gbStaat(r.bundesstaat);
  if (!bundesstaat) return nein("bundesstaat", "Bitte einen der angebotenen Bundesstaaten wählen (Delaware, Florida oder Wyoming).");
  const wunschname = wunschnameNormalisieren(r.wunschname);
  if (!wunschname) return nein("wunschname", "Bitte den Wunschnamen der Gesellschaft angeben (ohne „LLC“).");
  const wf = wunschnameFehler(wunschname);
  if (wf) return nein("wunschname", wf);
  const gegenstand = mehrzeilig(r.gegenstand, 600);
  const fuehrung: GbFuehrung = r.fuehrung === "manager" ? "manager" : "member";
  const liste = Array.isArray(r.mitglieder) ? r.mitglieder : [];
  if (liste.length < GB_MITGLIEDER_MIN || liste.length > GB_MITGLIEDER_MAX) return nein("mitglieder", `Ein Gründungsbogen hat ${GB_MITGLIEDER_MIN} bis ${GB_MITGLIEDER_MAX} Gesellschafter.`);
  const mitglieder: GbAnlage["mitglieder"] = [];
  const adressen = new Set<string>();
  for (let i = 0; i < liste.length; i++) {
    const m = liste[i] ?? {};
    const anzeigename = text(m.anzeigename, 120);
    if (anzeigename.length < 2) return nein(`mitglieder.${i}.anzeigename`, `Gesellschafter ${i + 1}: Bitte den Namen angeben (z. B. „Herr Max Muster“).`);
    const email = emailNormalisieren(m.email);
    if (!EMAIL_MUSTER.test(email)) return nein(`mitglieder.${i}.email`, `Gesellschafter ${i + 1}: Bitte eine gültige E-Mail-Adresse angeben — dorthin geht der persönliche Zugang.`);
    if (adressen.has(email)) return nein(`mitglieder.${i}.email`, `Gesellschafter ${i + 1}: Jeder Gesellschafter braucht eine eigene E-Mail-Adresse — sonst wären die Unterschriften nicht getrennt.`);
    adressen.add(email);
    const roh = typeof m.anteil === "string" ? Number(m.anteil.replace(",", ".")) : Number(m.anteil);
    if (!Number.isFinite(roh) || roh <= 0 || roh > 100 || Math.abs(roh * 100 - Math.round(roh * 100)) > 1e-6) return nein(`mitglieder.${i}.anteil`, `Gesellschafter ${i + 1}: Anteil größer als 0 und höchstens 100 %, höchstens zwei Nachkommastellen.`);
    mitglieder.push({ anzeigename, email, anteil: Math.round(roh * 100) / 100 });
  }
  const summe = mitglieder.reduce((s, m) => s + hundertstel(m.anteil), 0);
  if (summe !== 10000) return nein("mitglieder", `Die Anteile ergeben zusammen ${anteilText(summe / 100)} — es müssen genau 100 % sein.`);
  return { ok: true, daten: { gruss, kostenHinweis, bundesstaat, wunschname, gegenstand, fuehrung, mitglieder, notizIntern: mehrzeilig(r.notizIntern, 2000) } };
}

/** Die Kennung „GB-“ + 6 Zeichen aus einem Alphabet ohne Verwechsler (0/O, 1/I/L). */
const KENNUNG_ZEICHEN = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function kennungAus(zufall: Uint8Array): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += KENNUNG_ZEICHEN[(zufall[i] ?? 0) % KENNUNG_ZEICHEN.length];
  return `${GB_KENNUNG_PRAEFIX}${s}`;
}
export function istKennung(v: unknown): boolean {
  return new RegExp(`^${GB_KENNUNG_PRAEFIX}[${KENNUNG_ZEICHEN}]{6}$`).test(String(v ?? ""));
}

// ── Die Texte der Seiten (gesiezt; Wortwand: scripts/pruef-wortwand-de.ts) ──
export const GB_STATUS_TEXT: Record<GbStatus, string> = {
  offen: "Angaben und Unterschriften laufen",
  vollstaendig: "Alle haben unterschrieben — FIAON gründet",
  geschlossen: "Abgeschlossen",
};
export const GB_UNTERSCHRIFT_TEXT: Record<GbUnterschriftStatus, string> = {
  offen: "Unterschrift offen",
  unterschrieben: "Unterschrieben",
  neu_noetig: "Neue Unterschrift nötig",
};

/** „A“, „A und B“, „A, B und C“. */
export function aufzaehlung(namen: string[]): string {
  const n = namen.map((x) => String(x ?? "").trim()).filter(Boolean);
  if (n.length <= 1) return n[0] ?? "";
  return `${n.slice(0, -1).join(", ")} und ${n[n.length - 1]}`;
}
/** Für „von …“, „an …“: „Herr Max Muster“ → „Herrn Max Muster“ (Dativ); alles andere bleibt. */
export function dativ(name: string): string {
  return String(name ?? "").trim().replace(/^Herr\s+/, "Herrn ");
}
/** „Herr Max Muster“ → „er“, „Frau …“ → „sie“, sonst der Name selbst. */
export function pronomen(name: string): string {
  const s = String(name ?? "").trim();
  if (/^herr\b/i.test(s)) return "er";
  if (/^frau\b/i.test(s)) return "sie";
  return s || "er oder sie";
}

/** Was nach allen Unterschriften passiert — mit der ehrlichen Dauer aus der einen Quelle (Bundesstaat, EIN). */
export function danachSatz(staat: unknown): string {
  const s = gbStaat(staat) ?? GB_STAAT_VORGABE;
  return `Sobald alle Gesellschafter unterschrieben haben, reicht FIAON die Gründung in ${BUNDESSTAATEN[s].name} ein. ${BUNDESSTAATEN[s].eintragung.de} `
    + `Die Steuernummer EIN beantragen wir nach der Eintragung — ${EIN_ZEITEN.de.fax}.`;
}

export const GB_TEXTE = {
  seitentitel: "Gründung Ihrer US-Gesellschaft · FIAON Global",
  gemeinsam: {
    auge: "Gründung Ihrer US-Gesellschaft",
    titelZusatz: "Gemeinsam gründen — jeder unterschreibt für sich.",
    soGehtEs: "So geht es",
    schritte: [
      { titel: "Persönlichen Zugang anfordern", text: "Jeder Gesellschafter fordert unten mit einem Klick seinen eigenen Link an. Er kommt an die E-Mail-Adresse, die wir für Sie hinterlegt haben." },
      { titel: "Angaben und Reisepass", text: "Auf Ihrer persönlichen Seite prüfen Sie die gemeinsamen Angaben zur Gesellschaft, tragen Ihre eigenen Angaben ein und laden die Bildseite Ihres Reisepasses hoch. Zwischenspeichern geht jederzeit." },
      { titel: "Einzeln unterschreiben", text: "Jeder unterschreibt für sich, auf seiner eigenen Seite. Die übrigen Gesellschafter sehen nur, ob Sie fertig sind — nie Ihre Angaben." },
    ],
    kosten: "Kosten",
    status: "Wer ist wie weit?",
    angabenOffen: "Angaben offen",
    angabenFertig: "Angaben vollständig",
    knopf: (name: string) => `Ich bin ${name} — persönlichen Zugang anfordern`,
    gesendet: (adresse: string) => `Wir haben Ihren Zugang an ${adresse} geschickt. Bitte sehen Sie auch im Werbe- oder Spam-Ordner nach.`,
    einleitung: "hier machen Sie die Angaben für Ihre neue US-Gesellschaft — jeder Gesellschafter für sich und mit seiner eigenen Unterschrift.",
    hinweisZugang: "Der Link kommt nur an die hinterlegte Adresse — so unterschreibt jeder selbst. Stimmt Ihre Adresse nicht, schreiben Sie uns an support@fiaon.com.",
    vollstaendig: "Alle Gesellschafter haben unterschrieben. FIAON bereitet jetzt die Gründung vor.",
    geschlossen: "Dieser Gründungsbogen ist abgeschlossen. Bei Fragen erreichen Sie uns unter support@fiaon.com.",
  },
  persoenlich: {
    auge: "Ihr persönlicher Bereich",
    titel: "Ihre Angaben zur Gründung",
    hallo: (name: string) => `Guten Tag, ${name}. Diese Seite ist nur für Sie. Die übrigen Gesellschafter sehen Ihre Angaben nicht — nur, ob Sie fertig sind.`,
    abschnitte: ["Gesellschaft", "Ihre Angaben", "Bestätigen und unterschreiben"],
    gesellschaftLead: "Diese Angaben gelten für alle Gesellschafter gleich. Jeder darf sie ändern, solange der Bogen offen ist.",
    angabenLead: "Bitte genau wie im Reisepass. Zwischenspeichern geht jederzeit — unterschreiben können Sie, sobald alles vollständig ist.",
    unterschriftLead: "Prüfen Sie die Zusammenfassung, bestätigen Sie die fünf Punkte und unterschreiben Sie im Feld.",
    zusatzLlc: "Der Zusatz „LLC“ wird angefügt.",
    geschaeftsjahr: "Das Geschäftsjahr ist das Kalenderjahr.",
    fuehrungMember: "Von den Gesellschaftern geführt (member-managed)",
    fuehrungManager: "Von Managern geführt (manager-managed)",
    responsibleParty: "Verantwortlich für die Steuernummer EIN (Responsible Party)",
    responsiblePartyHilfe: "Diese Person nennt die US-Steuerbehörde im Antrag auf die EIN. Sie ist dort Ansprechpartner der Gesellschaft.",
    warnungAndere: (namen: string[] | string) => {
      const n = Array.isArray(namen) ? namen : [String(namen)];
      if (n.length > 1) return `${aufzaehlung(n)} haben schon unterschrieben — wenn Sie das ändern, müssen sie neu unterschreiben.`;
      return `${n[0]} hat schon unterschrieben — wenn Sie das ändern, muss ${pronomen(n[0])} neu unterschreiben.`;
    },
    warnungSelbst: "Sie haben schon unterschrieben — wenn Sie das ändern, unterschreiben Sie danach neu.",
    trotzdem: "Ändern und speichern",
    gespeichert: "Gespeichert.",
    neuUnterschreibenNoetig: (namen: string) => `Gespeichert. Neu unterschreiben müssen jetzt: ${namen}.`,
    reisepassTitel: "Bildseite Ihres Reisepasses",
    reisepassHilfe: "PDF, JPG oder PNG, höchstens 10 MB. Bitte die Seite mit Foto — gut lesbar, ohne Spiegelung.",
    reisepassDa: (name: string, am: string) => `Hochgeladen: ${name} (${am})`,
    usFrage: "Haben Sie eine US-Steuernummer (SSN oder ITIN)?",
    usHilfe: "Wenn nicht, ist das der Normalfall — dann wählen Sie „Nein“.",
    fehltTitel: "Bevor Sie unterschreiben, fehlt noch:",
    zusammenfassung: "Was Sie unterschreiben",
    ort: "Ort",
    name: "Ihr vollständiger Name (wie im Reisepass)",
    nameFalsch: (soll: string) => `Bitte geben Sie Ihren Namen genau wie im Reisepass ein: ${soll}.`,
    padHinweis: "Hier mit Finger oder Maus unterschreiben",
    unterschreiben: "Verbindlich unterschreiben",
    unterschrieben: (am: string) => `Unterschrieben am ${am}.`,
    pdf: "Ihr Gründungsauftrag als PDF",
    nachUnterschrift: "Danke. Sobald alle Gesellschafter unterschrieben haben, beginnt FIAON mit der Gründung. Ändert jemand vorher die gemeinsamen Angaben, bitten wir Sie um eine neue Unterschrift.",
    abgelaufen: "Ihr persönlicher Link ist abgelaufen. Fordern Sie auf der gemeinsamen Seite einen neuen an — er gilt dann wieder 14 Tage.",
    gesperrt: "Der Gründungsbogen ist abgeschlossen — Änderungen sind nicht mehr möglich.",
    ungespeichert: "Noch nicht gespeichert",
  },
  fehler: {
    link: "Dieser Link ist ungültig. Bitte nehmen Sie den Link aus Ihrer E-Mail oder fragen Sie uns unter support@fiaon.com.",
    linkAbgelaufen: "Dieser Link ist abgelaufen. Bitte fragen Sie uns unter support@fiaon.com nach einem neuen.",
    zuViel: "Sie haben den Zugang gerade mehrmals angefordert. Bitte sehen Sie in Ihrem Postfach nach oder versuchen Sie es in einer Stunde noch einmal.",
    zuVielIp: "Von Ihrem Anschluss kamen gerade viele Anfragen. Bitte versuchen Sie es in einigen Minuten noch einmal.",
    fassung: "Inzwischen hat ein anderer Gesellschafter die gemeinsamen Angaben geändert. Bitte laden Sie die Seite neu — Ihre Eingabe ist noch nicht gespeichert.",
    fassungUnterschrift: "Die gemeinsamen Angaben haben sich gerade geändert. Bitte laden Sie die Seite neu, prüfen Sie die Angaben und unterschreiben Sie dann.",
    schonUnterschrieben: "Sie haben diese Fassung bereits unterschrieben.",
    mail: "Die E-Mail ließ sich gerade nicht senden. Bitte versuchen Sie es in einer Minute noch einmal.",
    server: "Das hat gerade nicht geklappt. Bitte versuchen Sie es in einer Minute noch einmal.",
    datei: "Bitte laden Sie eine PDF-, JPG- oder PNG-Datei hoch (höchstens 10 MB).",
    roboter: "Diese Unterschrift können wir nicht annehmen. Bitte öffnen Sie die Seite in Ihrem Browser und unterschreiben Sie dort.",
    unterschrift: "Die Unterschrift fehlt oder ist unbrauchbar — bitte unterschreiben Sie noch einmal im Feld.",
    pdf: "Ihr Gründungsauftrag konnte gerade nicht ausgefertigt werden. Bitte versuchen Sie es in einer Minute noch einmal — es wurde nichts gespeichert.",
  },
} as const;
