// ═══════════════════════════════════════════════════════════════════════════
// FIAON FINANZ- UND BONITÄTSAUSWERTUNG — DIE REGELN (E-IT-D, 08.10.2026, Punkt 4b)
//
// Justin, 08.10.2026: „Im Paket enthalten (AGB § 5: Kontoauszug-Analyse/Finanz-
// auswertung — kein Aufpreis). Knopf in der Akte, nur aktiv, wenn Ausweis UND
// Kontoauszug vollständig vorliegen. Ampel je Bereich am Anfang + Score
// ‚FIAON-Finanzwert' 100–999, aber ÜBERALL klar gekennzeichnet: eigene Berechnung
// von FIAON aus den vorgelegten Unterlagen, KEIN SCHUFA-Score, keine
// Bonitätsauskunft einer Auskunftei, keine Kredit- oder Kartenzusage; transparente
// Berechnung (Gewichte offen im PDF). Konkrete Verbesserungsschritte mit
// Euro-Wirkung je Monat und Vergleichs-HINWEISE als allgemeine Wege."
//
// ── WAS HIER STEHT ─────────────────────────────────────────────────────────
// Alles, was eine Auswertung ENTSCHEIDET, steht in dieser Datei — rein, ohne
// Datenbank, ohne Modell, im Prüfstand nachrechenbar (scripts/pruef-it-d.ts):
//   1. die Voraussetzungen (Ausweis + Kontoauszug, mit fertigem Satz je Lücke),
//   2. die Maske für Art.-9-Daten (Gesundheit, Religion, Gewerkschaft, Politik,
//      Sexualleben) — VOR jeder Rechnung und vor jedem Modellaufruf,
//   3. die Kennzahlen aus der Tiefenanalyse (shared/fiaon-kontoauszug-tiefe.ts),
//   4. die Ampel je Bereich und die Gesamtampel,
//   5. der FIAON-Finanzwert (100–999) mit seinen offenen Gewichten,
//   6. die Schritte mit Euro-Wirkung und die allgemeinen Vergleichswege,
//   7. die Pflichtsätze (Kennzeichnung, Haftung, Datenschutz, Vorbehalt),
//   8. die Wände für Modelltexte (Zahlenwand, Beratungswand),
//   9. die Freigaberegel (Vier-Augen bei roter Gesamtlage oder Vorbehalt).
//
// ── WAS NIE PASSIERT ───────────────────────────────────────────────────────
// · Der Finanzwert rechnet NIE ein Modell — er ist eine feste Regel (EU-KI-
//   Verordnung Anhang III Nr. 5 b; § 31 BDSG). Das Modell schreibt nur Sätze,
//   in denen Zahlen nur als Platzhalter stehen dürfen.
// · Der Wert entscheidet nichts im Haus (kein Karten-Tor, keine Übermittlung an
//   die Bank) und geht an niemanden (Prüfstand: keine Route an Dritte).
// · Eine FIAON-Auswertung zählt NIE als Bonitätsauskunft (Karten-Tor E-178).
// · Diese Auswertung schickt keine Ausweisbilder an ein Modell (Justin, 08.10.: biometrische Daten;
//   eine Ausweis-Prüfung durch die KI ist ein eigener, späterer Schritt).
// ═══════════════════════════════════════════════════════════════════════════
import { tiefenanalyse, type Tiefe, type TiefeBuchung, type Posten } from "./fiaon-kontoauszug-tiefe";
import { EINKOMMEN_KATEGORIEN } from "./fiaon-kontoauszug-bereinigen";

/** Fassung der Regeln — steht in jeder Auswertung (eingefroren) und im PDF. */
export const FA_REGEL_VERSION = "FA-2026-10-08.1";
/** Der Dienstname in fiaon_ki_nutzung. */
export const FA_DIENST = "finanzauswertung";
export const FA_PRODUKT = "FIAON Finanz- und Bonitätsauswertung";
export const FA_WERT_NAME = "FIAON-Finanzwert";

// ───────────────────────────────────────────────────────────────────────────
// 1 · VORAUSSETZUNGEN
// ───────────────────────────────────────────────────────────────────────────

/** Mindestspanne des Kontoauszugs — dieselbe Regel wie die Dokumentprüfung („drei Monate", 75 Tage). */
export const FA_AUSZUG_MIN_TAGE = 75;
/** Der letzte gebuchte Tag darf höchstens so alt sein — sonst ist die Auswertung veraltet. */
export const FA_AUSZUG_MAX_ALTER_TAGE = 75;
/** Längste erlaubte Lücke ohne jede Buchung (gebundene Auszüge mit fehlendem Monat); dazu: kein voller Kalendermonat ohne Buchung. */
export const FA_AUSZUG_MAX_LUECKE_TAGE = 40;

export type SichtTyp = "reisepass" | "personalausweis" | "aufenthaltstitel_pass";
export const SICHT_TYP_TEXT: Record<SichtTyp, string> = {
  reisepass: "Reisepass (Datenseite)",
  personalausweis: "Personalausweis (Vorder- und Rückseite)",
  aufenthaltstitel_pass: "Aufenthaltstitel zusammen mit Reisepass",
};
export function istSichtTyp(v: unknown): v is SichtTyp {
  return v === "reisepass" || v === "personalausweis" || v === "aufenthaltstitel_pass";
}

/** Das Urteil der automatischen Dokumentprüfung (fiaon_dokument_pruefungen), soweit hier gebraucht. */
export interface PruefUrteil {
  erkannt: boolean | null;
  vollstaendig: boolean | null;
  pruefbar?: boolean;
  fehlt?: string[];
  hinweisIntern?: string | null;
  /** Wenn Strang (13) einen Dokumenttyp liefert: reisepass | personalausweis | aufenthaltstitel … */
  dokumenttyp?: string | null;
}

export interface AusweisEingang {
  vorhanden: boolean;
  urteil: PruefUrteil | null;
  /** Sichtprüfung durch einen Menschen — nur gültig für GENAU diese Datei (Server prüft den Prüfwert). */
  sicht: { dokumenttyp: SichtTyp; von: string | null; am: string } | null;
}

export interface AuszugEingang {
  vorhanden: boolean;
  analyse: {
    status: string;
    version: number | null;
    zeitraumVon: string | null;
    zeitraumBis: string | null;
    nebenkonto: boolean;
    /** Die gebuchten Tage (YYYY-MM-DD), sortiert oder nicht. */
    buchungsTage: string[];
    pruefung: { stimmt: boolean | null; differenzCents?: number | null } | null;
    fehler: string | null;
  } | null;
}

export type VorStand = "ok" | "fehlt" | "mangel" | "pruefen";

export interface Voraussetzung {
  ok: boolean;
  stand: VorStand;
  /** Kurzzeile für die Akte (Team). */
  satz: string;
  /** Der Satz an den Kunden, wenn etwas fehlt („Bitte laden Sie … hoch") — null, wenn nichts anzufordern ist. */
  bitte: string | null;
}

export interface Voraussetzungen {
  bereit: boolean;
  ausweis: Voraussetzung & { typ: string | null; quelle: "pruefung" | "sicht" | null };
  kontoauszug: Voraussetzung & {
    zeitraumVon: string | null; zeitraumBis: string | null; tage: number;
    fehlendeMonate: string[];
    /** Cent-Prüfung als Prüfvermerk: stimmt | abweichung | ohne_saldo | null. */
    cent: "stimmt" | "abweichung" | "ohne_saldo" | null;
  };
  /** Die Bonitätsauskunft ist freiwillig — fertig ausgewertet fließt sie ein, sonst „nicht bewertet". */
  auskunft: { ausgewertet: boolean; satz: string };
  /** Was sich beim Kunden anfordern lässt (4c). */
  anforderbar: ("ausweis" | "kontoauszug")[];
  /** Vermerke, die eine Auswertung „mit Vorbehalt" machen (stehen im PDF). */
  vorbehalte: string[];
}

const MONATSNAMEN = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];

/** „2026-08" → „August 2026"; ohne Jahr, wenn `ohneJahr`. */
export function monatsName(ym: string, ohneJahr = false): string {
  const m = Number(ym.slice(5, 7));
  const n = MONATSNAMEN[m - 1] ?? ym;
  return ohneJahr ? n : `${n} ${ym.slice(0, 4)}`;
}

const tagNr = (iso: string): number => Math.floor(Date.UTC(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))) / 86_400_000);
const isoAusNr = (n: number): string => new Date(n * 86_400_000).toISOString().slice(0, 10);
/** „2026-09-12" → „12.09.2026" */
export function datumDe(iso: string | null | undefined): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "—";
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}
const monatVon = (iso: string) => iso.slice(0, 7);
function monatPlus(ym: string, n: number): string {
  const g = Number(ym.slice(0, 4)) * 12 + Number(ym.slice(5, 7)) - 1 + n;
  return `${Math.floor(g / 12)}-${String((g % 12) + 1).padStart(2, "0")}`;
}
function letzterTag(ym: string): string {
  const j = Number(ym.slice(0, 4)); const m = Number(ym.slice(5, 7));
  return `${ym}-${String(new Date(Date.UTC(j, m, 0)).getUTCDate()).padStart(2, "0")}`;
}
function aufzaehlung(teile: string[]): string {
  const t = teile.filter(Boolean);
  if (t.length <= 1) return t[0] ?? "";
  return `${t.slice(0, -1).join(", ")} und ${t[t.length - 1]}`;
}

/**
 * Welche der letzten drei VOLLEN Kalendermonate (vor dem laufenden) deckt der
 * Auszug nicht ab? „Abgedeckt" heißt: der Monat liegt ganz oder bis auf die
 * ersten bzw. letzten fünf Tage im Zeitraum (Monatsauszüge beginnen selten am 1.).
 */
export function fehlendeMonate(von: string | null, bis: string | null, heuteIso: string): string[] {
  const aktuell = monatVon(heuteIso);
  const soll = [monatPlus(aktuell, -3), monatPlus(aktuell, -2), monatPlus(aktuell, -1)];
  if (!von || !bis) return soll;
  const v = tagNr(von); const b = tagNr(bis);
  return soll.filter((m) => {
    const anfang = tagNr(`${m}-01`); const ende = tagNr(letzterTag(m));
    return !(v <= anfang + 5 && b >= ende - 5);
  });
}

export function voraussetzungenPruefen(e: {
  ausweis: AusweisEingang;
  auszug: AuszugEingang;
  auskunft: { status: string | null } | null;
  heuteIso: string;
  /** AUSWERTUNG_VERSION der Kontoauszug-Analyse (server) — ältere Fassungen gelten als nicht fertig. */
  aktuelleVersion: number;
}): Voraussetzungen {
  const vorbehalte: string[] = [];

  // ── AUSWEIS ──────────────────────────────────────────────────────────────
  // Justin 08.10.2026 (Punkt 13): Aufenthaltstitel nur zusammen mit Reisepass, beim
  // Reisepass genügt die Datenseite. Diese Regel liest kein Ausweisbild — geprüft wird
  // über die Textschicht (Dokumentprüfung) oder von einem Menschen (Sichtprüfung).
  let ausweis: Voraussetzungen["ausweis"];
  const u = e.ausweis.urteil;
  if (!e.ausweis.vorhanden) {
    ausweis = { ok: false, stand: "fehlt", typ: null, quelle: null, satz: "Ausweis fehlt.",
      bitte: "eine gut lesbare Kopie Ihres Ausweises: beim Personalausweis Vorder- und Rückseite, beim Reisepass die Seite mit Ihrem Foto und Ihren Daten" };
  } else if (e.ausweis.sicht) {
    ausweis = { ok: true, stand: "ok", typ: SICHT_TYP_TEXT[e.ausweis.sicht.dokumenttyp], quelle: "sicht",
      satz: `Ausweis von Hand geprüft: ${SICHT_TYP_TEXT[e.ausweis.sicht.dokumenttyp]}${e.ausweis.sicht.von ? ` (${e.ausweis.sicht.von})` : ""}.`, bitte: null };
  } else if (u && u.erkannt === true && u.vollstaendig === true && !(u.dokumenttyp && /aufenthalt/i.test(u.dokumenttyp))) {
    ausweis = { ok: true, stand: "ok", typ: u.dokumenttyp ?? null, quelle: "pruefung", satz: `Ausweis geprüft${u.hinweisIntern ? `: ${u.hinweisIntern}` : "."}`, bitte: null };
  } else if (u && u.dokumenttyp && /aufenthalt/i.test(u.dokumenttyp)) {
    ausweis = { ok: false, stand: "mangel", typ: u.dokumenttyp, quelle: "pruefung",
      satz: "Nur ein Aufenthaltstitel — er gilt nur zusammen mit dem Reisepass.",
      bitte: "zusätzlich zu Ihrem Aufenthaltstitel die Datenseite Ihres Reisepasses" };
  } else if (u && (u.fehlt ?? []).some((f) => /rückseite|rueckseite/i.test(f))) {
    ausweis = { ok: false, stand: "mangel", typ: "Personalausweis", quelle: "pruefung", satz: "Personalausweis: die Rückseite fehlt.",
      bitte: "die Rückseite Ihres Personalausweises (die Vorderseite liegt uns vor)" };
  } else if (u && u.erkannt === false) {
    ausweis = { ok: false, stand: "mangel", typ: null, quelle: "pruefung", satz: `Die Datei unter „Ausweis“ ist kein Ausweisdokument${u.hinweisIntern ? ` (${u.hinweisIntern})` : ""}.`,
      bitte: "eine gut lesbare Kopie Ihres Ausweises — die bisher hochgeladene Datei ist kein Ausweisdokument" };
  } else {
    ausweis = { ok: false, stand: "pruefen", typ: null, quelle: null,
      satz: "Ausweis liegt vor, die automatische Prüfung konnte ihn nicht bestätigen (Foto oder unklare Seiten) — bitte öffnen und von Hand bestätigen.",
      bitte: null };
  }

  // ── KONTOAUSZUG ──────────────────────────────────────────────────────────
  const a = e.auszug.analyse;
  let konto: Voraussetzungen["kontoauszug"];
  const leer = { zeitraumVon: null, zeitraumBis: null, tage: 0, fehlendeMonate: fehlendeMonate(null, null, e.heuteIso), cent: null };
  if (!e.auszug.vorhanden) {
    konto = { ...leer, ok: false, stand: "fehlt", satz: "Kontoauszug fehlt.",
      bitte: `Ihre Kontoauszüge für ${aufzaehlung(leer.fehlendeMonate.map((m) => monatsName(m)))} — vom Girokonto, auf dem Ihr Einkommen eingeht` };
  } else if (!a || a.status === "laeuft") {
    konto = { ...leer, ok: false, stand: "pruefen", satz: a ? "Der Kontoauszug wird gerade ausgewertet." : "Der Kontoauszug ist noch nicht ausgewertet — unten „Jetzt auswerten“.", bitte: null };
  } else if (a.status === "unlesbar") {
    konto = { ...leer, ok: false, stand: "mangel", satz: `Der Kontoauszug ist nicht auswertbar${a.fehler ? `: ${a.fehler}` : "."}`,
      bitte: "einen gut lesbaren Kontoauszug als PDF aus Ihrem Online-Banking (keine Fotos vom Bildschirm, keine Gehaltsabrechnung)" };
  } else if (a.status !== "fertig" || (a.version ?? 0) < e.aktuelleVersion) {
    konto = { ...leer, ok: false, stand: "pruefen", satz: "Die Auswertung des Kontoauszugs ist veraltet oder gescheitert — unten „Neu auswerten“.", bitte: null };
  } else {
    const von = a.zeitraumVon; const bis = a.zeitraumBis;
    const tage = von && bis ? tagNr(bis) - tagNr(von) + 1 : 0;
    const fehlend = fehlendeMonate(von, bis, e.heuteIso);
    const cent: Voraussetzungen["kontoauszug"]["cent"] = a.pruefung?.stimmt === true ? "stimmt" : a.pruefung?.stimmt === false ? "abweichung" : "ohne_saldo";
    const tageSort = Array.from(new Set(a.buchungsTage.filter((t) => /^\d{4}-\d{2}-\d{2}$/.test(t)))).sort();
    let luecke: { von: string; bis: string } | null = null;
    // Ein voller Kalendermonat im Zeitraum ganz ohne Buchung = ein fehlender Monatsauszug (gebundene Auszüge).
    if (von && bis) {
      const monate = new Set(tageSort.map((t) => t.slice(0, 7)));
      for (let m = monatVon(von); m <= monatVon(bis); m = monatPlus(m, 1)) {
        if (von <= `${m}-01` && bis >= letzterTag(m) && !monate.has(m)) { luecke = { von: `${m}-01`, bis: letzterTag(m) }; break; }
      }
    }
    for (let i = 1; !luecke && i < tageSort.length; i++) {
      if (tagNr(tageSort[i]) - tagNr(tageSort[i - 1]) > FA_AUSZUG_MAX_LUECKE_TAGE) luecke = { von: isoAusNr(tagNr(tageSort[i - 1]) + 1), bis: isoAusNr(tagNr(tageSort[i]) - 1) };
    }
    const alterTage = bis ? tagNr(e.heuteIso) - tagNr(bis) : 9999;
    const zr = von && bis ? `${datumDe(von)}–${datumDe(bis)}` : "unbekannt";
    const basis = { zeitraumVon: von, zeitraumBis: bis, tage, fehlendeMonate: fehlend, cent };
    if (a.nebenkonto) {
      konto = { ...basis, ok: false, stand: "mangel", satz: `Nebenkonto (${zr}): Die Eingänge kommen überwiegend von einem anderen eigenen Konto — das Gehaltskonto fehlt.`,
        bitte: "die Kontoauszüge des Kontos, auf dem Ihr Einkommen (Gehalt, Rente oder Leistung) eingeht — der hochgeladene Auszug ist ein Nebenkonto" };
    } else if (tage < FA_AUSZUG_MIN_TAGE) {
      const monate = fehlend.length ? fehlend : [monatPlus(monatVon(e.heuteIso), -1)];
      konto = { ...basis, ok: false, stand: "mangel", satz: `Der Kontoauszug deckt nur ${zr} ab (${tage} Tage) — es fehlen ${aufzaehlung(monate.map((m) => monatsName(m, true)))}.`,
        bitte: `Ihre Kontoauszüge für ${aufzaehlung(monate.map((m) => monatsName(m)))} (bisher liegt uns nur der Zeitraum ${zr} vor)` };
    } else if (luecke) {
      konto = { ...basis, ok: false, stand: "mangel", satz: `Lücke im Kontoauszug: vom ${datumDe(luecke.von)} bis ${datumDe(luecke.bis)} keine Buchung — vermutlich fehlt ein Monatsauszug.`,
        bitte: `den Kontoauszug für den Zeitraum ${datumDe(luecke.von)} bis ${datumDe(luecke.bis)} — dieser Teil fehlt in den bisherigen Auszügen` };
    } else if (alterTage > FA_AUSZUG_MAX_ALTER_TAGE) {
      const neu = fehlend.length ? fehlend : [monatPlus(monatVon(e.heuteIso), -1)];
      konto = { ...basis, ok: false, stand: "mangel", satz: `Der Kontoauszug endet am ${datumDe(bis)} — älter als ${FA_AUSZUG_MAX_ALTER_TAGE} Tage, die Auswertung wäre veraltet.`,
        bitte: `Ihre aktuellen Kontoauszüge für ${aufzaehlung(neu.map((m) => monatsName(m)))}` };
    } else {
      konto = { ...basis, ok: true, stand: "ok", bitte: null,
        satz: `Kontoauszug vollständig: ${zr} (${tage} Tage, Hauptkonto). Cent-Prüfung: ${cent === "stimmt" ? "stimmt" : cent === "abweichung" ? "nicht auf den Cent (Vorbehalt)" : "ohne Saldo im Auszug"}.` };
      if (cent === "abweichung") vorbehalte.push("cent");
    }
  }

  // ── AUSKUNFT (freiwillig) ────────────────────────────────────────────────
  const auskunftFertig = e.auskunft?.status === "fertig";
  const auskunft = {
    ausgewertet: auskunftFertig,
    satz: auskunftFertig ? "Bonitätsauskunft ausgewertet — fließt ein." : "Keine ausgewertete Bonitätsauskunft — dieser Teil wird „nicht bewertet“ ausgewiesen.",
  };

  const anforderbar: ("ausweis" | "kontoauszug")[] = [];
  if (!ausweis.ok && ausweis.bitte) anforderbar.push("ausweis");
  if (!konto.ok && konto.bitte) anforderbar.push("kontoauszug");
  return { bereit: ausweis.ok && konto.ok, ausweis, kontoauszug: konto, auskunft, anforderbar, vorbehalte };
}

// ───────────────────────────────────────────────────────────────────────────
// 2 · ART.-9-DATEN — NICHT AUSWERTEN, NICHT AUSWEISEN
// ───────────────────────────────────────────────────────────────────────────
// Kontoauszüge lassen Gesundheit, Religion, Gewerkschaft, Politik und Sexualleben
// erkennen (EuGH C-184/20, C-252/21). Justin, 08.10.2026: „Art.-9-Daten nicht
// auswerten/ausweisen, Hinweis im PDF." Solche Buchungen verlieren VOR jeder
// Rechnung Namen und Zweck; Ausgaben werden zu „Sonstige Ausgabe", Einkünfte
// behalten ihre Einkommensart (sonst fehlte z. B. Krankengeld im Einkommen),
// aber nicht ihren Absender. Danach sieht weder die Rechnung noch das Modell
// noch das PDF, wofür das Geld floss.

export const ART9_HINWEIS =
  "Buchungen, die Rückschlüsse auf Gesundheit, religiöse oder weltanschauliche Überzeugungen, Gewerkschafts- oder Parteizugehörigkeit "
  + "oder das Sexualleben zulassen könnten (besondere Kategorien nach Art. 9 DSGVO), machen wir nach dem Lesen unkenntlich: Sie werden in dieser "
  + "Auswertung weder einzeln bewertet noch ausgewiesen und fließen ohne Empfänger und ohne Verwendungszweck nur als Teil der sonstigen Ausgaben "
  + "bzw. Ihres Einkommens in die Summen ein.";

const ART9_MUSTER: { art: string; muster: RegExp }[] = [
  { art: "gesundheit", muster: /\b(apotheke\w*|aerzt\w*|ärzt\w*|arzt\w*|zahnarzt\w*|zahnaerzt\w*|praxis|arztpraxis|gemeinschaftspraxis|klinik\w*|krankenhaus\w*|hospital|physio\w*|ergotherap\w*|logopaed\w*|logopäd\w*|psycho\w*|therapie\w*|therapeut\w*|heilpraktik\w*|hospiz|pflegedienst\w*|sanitaetshaus|sanitätshaus|hoergeraet\w*|hörgerät\w*|optiker|labor|dialyse|reha\w*|kur ?klinik|krankengeld|verletztengeld|pflegegeld|erwerbsminderung\w*|schwerbehind\w*|medizin\w*|medical|doc ?morris|shop ?apotheke|zur rose)\b/ },
  { art: "religion", muster: /\b(kirche\w*|kirchgeld|kirchensteuer|kirchgemeinde|bistum|erzbistum|dioezese|diözese|pfarr\w*|evangelisch\w*|katholisch\w*|caritas|diakonie\w*|moschee\w*|islamisch\w*|ditib|synagog\w*|juedische gemeinde|jüdische gemeinde|zeugen jehovas|neuapostolisch\w*|freikirch\w*|kloster|orden)\b/ },
  { art: "gewerkschaft", muster: /\b(gewerkschaft\w*|ver\.? ?di|ig metall|ig bce|ig bau|igbce|igmetall|ngg|dgb|komba|dbb beamtenbund|marburger bund|gdl|gew)\b/ },
  { art: "politik", muster: /\b(spd|cdu|csu|fdp|afd|buendnis 90|bündnis 90|die gruenen|die grünen|die linke|bsw|oevp|övp|spoe|spö|fpoe|fpö|neos|partei)\b/ },
  { art: "sexualleben", muster: /\b(onlyfans|tinder|parship|elitepartner|lovoo|bumble|grindr|joyclub|finya|badoo|hinge|fetlife|erotik\w*|sexshop|amorelie|eis\.de|orion versand)\b/ },
];
const ART9_KATEGORIEN = new Set(["gesundheit"]);

function flach(s: string): string {
  return String(s ?? "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .replace(/[^a-z0-9.]+/g, " ").replace(/\s+/g, " ").trim();
}

/** Gehört diese Buchung zu einer besonderen Kategorie (Art. 9 DSGVO)? Gibt die Art zurück oder null. */
export function art9Art(b: { empfaenger?: string; zweck?: string; kategorie?: string }): string | null {
  if (ART9_KATEGORIEN.has(String(b.kategorie ?? ""))) return "gesundheit";
  const roh = `${b.empfaenger ?? ""} ${b.zweck ?? ""}`.toLowerCase();
  const text = `${roh} ${flach(roh)}`;
  for (const m of ART9_MUSTER) if (m.muster.test(text)) return m.art;
  return null;
}

export const ART9_NAME = "Nicht ausgewiesen";

/** Maskiert Art.-9-Buchungen. Zurück: dieselben Buchungen (Kopien) und wie viele maskiert wurden. */
export function art9Maskieren<T extends TiefeBuchung>(buchungen: readonly T[]): { buchungen: T[]; anzahl: number } {
  let anzahl = 0;
  const aus = buchungen.map((b) => {
    if (!art9Art(b)) return { ...b };
    anzahl++;
    const einkommen = b.betragCents > 0 && EINKOMMEN_KATEGORIEN.has(String(b.kategorie));
    return {
      ...b,
      empfaenger: ART9_NAME,
      zweck: "",
      kategorie: einkommen ? b.kategorie : b.betragCents > 0 ? "sonstige_einnahme" : "sonstige_ausgabe",
      korrektur: undefined,
    };
  });
  return { buchungen: aus, anzahl };
}

// ───────────────────────────────────────────────────────────────────────────
// 3 · KENNZAHLEN
// ───────────────────────────────────────────────────────────────────────────

export interface Vertrag {
  name: string; kategorie: string; jeMonatCents: number; rhythmus: string; aktiv: boolean; tag: number | null;
}

export interface Fakten {
  zeitraum: { von: string; bis: string; tage: number; monate: string[]; volleMonate: string[] };
  buchungen: number;
  einkommenJeMonatCents: number;
  weitereJeMonatCents: number;
  einnahmenJeMonatCents: number;
  ausgabenJeMonatCents: number;
  festJeMonatCents: number;
  variabelJeMonatCents: number;
  ueberschussJeMonatCents: number;
  /** Überschuss / Einnahmen (−∞…1), 0 wenn keine Einnahmen. */
  ueberschussQuote: number;
  /** Feste Ausgaben / Einnahmen. */
  fixkostenQuote: number;
  einkommenQuelle: "gehalt" | "rente" | "sozialleistung" | "gemischt" | "keins";
  /** Je Monat des Zeitraums: Einkommen in Cent und ob der Monat voll im Auszug liegt. */
  einkommenMonate: { monat: string; cents: number; voll: boolean }[];
  /** Je Monat: Einkommen, weitere Eingänge, Ausgaben, Saldo (für den Monatsverlauf im PDF). */
  monate: { monat: string; voll: boolean; einkommenCents: number; weitereCents: number; ausgabenCents: number; freiCents: number }[];
  volleMonateMitEinkommen: number;
  zahltag: number | null;
  ratenJeMonatCents: number;
  ratenQuote: number;
  ratenPosten: string[];
  inkassoAnzahl: number;
  inkassoPosten: string[];
  mahnAnzahl: number;
  ruecklastschriften: number;
  dispoTage: number | null;
  tiefsterSaldoCents: number | null;
  gluecksspielJeMonatCents: number;
  gluecksspielAnzahl: number;
  bargeldQuote: number;
  pfaendungHinweis: boolean;
  /** Feste Verträge und Abos (laufend, monatlich). */
  vertraege: Vertrag[];
  /** Ausgaben je Gruppe (Wofür), je Monat. */
  gruppen: { name: string; jeMonatCents: number; anteil: number }[];
  /** Die größten Kostenpunkte (Posten), ohne Art.-9-Posten. */
  kostenpunkte: { name: string; gruppe: string; jeMonatCents: number; rhythmus: string }[];
  /** Vermeidbare Kosten je Monat laut Tiefenanalyse. */
  vermeidbarJeMonatCents: number;
  art9Anzahl: number;
  /** Die Tipps der Tiefenanalyse — nur Art, Betrag, Posten (keine Mitarbeiter-Sätze). */
  tipps: { art: string; jeMonatCents: number; vermeidbar: boolean; posten: string[]; anzahl: number | null }[];
}

const PFAENDUNG = /\b(pfaendung\w*|pfändung\w*|p-konto|pkonto|pfaendungsschutz\w*|pfändungsschutz\w*|drittschuldner|gerichtsvollzieher|vollstreckung\w*|zwangsvollstreckung)\b/i;
const MAHN = /\b(mahngebuehr\w*|mahngebühr\w*|mahnkosten|mahnentgelt|mahnspesen|saeumniszuschlag\w*|säumniszuschlag\w*|verzugszins\w*)\b/i;

/**
 * Die Kennzahlen aus den (bereits maskierten, bereinigten) Buchungen. null, wenn
 * keine Buchungen da sind. Rechnet über tiefenanalyse() — dieselbe Rechnung wie
 * „Kontoauszug im Detail" in der Akte.
 */
export function faktenAus(buchungen: TiefeBuchung[], kopf: { zeitraumVon?: string | null; zeitraumBis?: string | null }, art9Anzahl = 0): Fakten | null {
  const t: Tiefe | null = tiefenanalyse(buchungen, kopf);
  if (!t) return null;
  const k = t.kennzahlen;
  const einnahmen = k.einkommenJeMonatCents + k.weitereJeMonatCents;
  const quote = (z: number) => (einnahmen > 0 ? z / einnahmen : z > 0 ? 9.99 : 0);

  const einkommenMonate = t.monatsverlauf.map((m) => ({ monat: m.monat, cents: m.einkommenCents, voll: m.voll }));
  const volle = einkommenMonate.filter((m) => m.voll);
  const quellen = new Set(t.einkommen.map((p) => p.kategorie));
  const einkommenQuelle: Fakten["einkommenQuelle"] = quellen.size === 0 ? "keins" : quellen.size > 1 ? "gemischt"
    : quellen.has("gehalt") ? "gehalt" : quellen.has("rente") ? "rente" : "sozialleistung";

  const istRate = (p: Posten) => p.kategorie === "kredit_rate" || p.typ === "bnpl";
  const raten = t.ausgaben.filter(istRate);
  const ratenJeMonat = raten.reduce((s, p) => s + p.jeMonatCents, 0);
  const inkasso = t.ausgaben.filter((p) => p.kategorie === "inkasso_mahnung");
  const text = (b: TiefeBuchung) => `${b.empfaenger} ${b.zweck}`;
  const mahnAnzahl = buchungen.filter((b) => b.betragCents < 0 && b.kategorie !== "inkasso_mahnung" && MAHN.test(text(b))).length;
  const ruecklastschriften = buchungen.filter((b) => b.kategorie === "ruecklastschrift").length;

  // Dispo-Tage: Tage, an denen ein gedruckter Saldo unter null lag. Ohne Saldo-Spalte: unbekannt.
  const mitSaldo = buchungen.filter((b) => b.saldoDanachCents != null && Number.isFinite(Number(b.saldoDanachCents)));
  let dispoTage: number | null = null;
  let tiefst: number | null = null;
  if (mitSaldo.length) {
    const minus = new Set<string>();
    for (const b of mitSaldo) {
      const s = Number(b.saldoDanachCents);
      if (tiefst == null || s < tiefst) tiefst = s;
      if (s < 0) minus.add(b.datum);
    }
    dispoTage = minus.size;
  }

  const spiel = t.ausgaben.filter((p) => p.typ === "spiel" || p.kategorie === "gluecksspiel");
  const bargeld = t.gruppen.find((g) => g.name === "Bargeld");
  const vertraege: Vertrag[] = t.ausgaben
    .filter((p) => p.fest && p.aktiv && (p.monatlich || p.rhythmus.startsWith("wiederkehrend")) && p.name !== ART9_NAME)
    .map((p) => ({ name: p.name, kategorie: p.kategorieLabel, jeMonatCents: p.monatlich ? p.typischCents : p.jeMonatCents, rhythmus: p.rhythmus, aktiv: p.aktiv, tag: p.tagImMonat }))
    .sort((a, b) => b.jeMonatCents - a.jeMonatCents);

  return {
    zeitraum: { von: t.zeitraum.von, bis: t.zeitraum.bis, tage: t.zeitraum.tage, monate: t.zeitraum.monate, volleMonate: volle.map((m) => m.monat) },
    buchungen: t.buchungen,
    einkommenJeMonatCents: k.einkommenJeMonatCents,
    weitereJeMonatCents: k.weitereJeMonatCents,
    einnahmenJeMonatCents: einnahmen,
    ausgabenJeMonatCents: k.ausgabenJeMonatCents,
    festJeMonatCents: k.festJeMonatCents,
    variabelJeMonatCents: k.variabelJeMonatCents,
    ueberschussJeMonatCents: k.freiJeMonatCents,
    ueberschussQuote: einnahmen > 0 ? k.freiJeMonatCents / einnahmen : (k.freiJeMonatCents >= 0 ? 0 : -9.99),
    fixkostenQuote: quote(k.festJeMonatCents),
    einkommenQuelle,
    einkommenMonate,
    monate: t.monatsverlauf.map((m) => ({ monat: m.monat, voll: m.voll, einkommenCents: m.einkommenCents, weitereCents: m.weitereCents, ausgabenCents: m.festCents + m.variabelCents, freiCents: m.freiCents })),
    volleMonateMitEinkommen: volle.filter((m) => m.cents > 0).length,
    zahltag: t.zahltag?.tag ?? null,
    ratenJeMonatCents: ratenJeMonat,
    ratenQuote: quote(ratenJeMonat),
    ratenPosten: raten.map((p) => p.name),
    inkassoAnzahl: inkasso.reduce((s, p) => s + p.anzahl, 0),
    inkassoPosten: inkasso.map((p) => p.name),
    mahnAnzahl,
    ruecklastschriften,
    dispoTage,
    tiefsterSaldoCents: tiefst,
    gluecksspielJeMonatCents: spiel.reduce((s, p) => s + p.jeMonatCents, 0),
    gluecksspielAnzahl: spiel.reduce((s, p) => s + p.anzahl, 0),
    bargeldQuote: bargeld ? bargeld.anteil : 0,
    pfaendungHinweis: buchungen.some((b) => PFAENDUNG.test(text(b))),
    vertraege,
    gruppen: t.gruppen.map((g) => ({ name: g.name, jeMonatCents: g.jeMonatCents, anteil: g.anteil })),
    kostenpunkte: t.kostenpunkte.filter((p) => p.name !== ART9_NAME).slice(0, 10)
      .map((p) => ({ name: p.name, gruppe: p.gruppe, jeMonatCents: p.jeMonatCents, rhythmus: p.rhythmus })),
    vermeidbarJeMonatCents: k.vermeidbarJeMonatCents,
    art9Anzahl,
    tipps: t.tipps.map((x) => ({ art: x.art, jeMonatCents: x.jeMonatCents, vermeidbar: x.vermeidbar, posten: x.posten.filter((n) => n !== ART9_NAME), anzahl: x.anzahl ?? null })),
  };
}

// ───────────────────────────────────────────────────────────────────────────
// 4 · AMPELN
// ───────────────────────────────────────────────────────────────────────────

export type Ampel = "gruen" | "gelb" | "rot" | "offen";
export const AMPEL_WORT: Record<Ampel, string> = { gruen: "Grün", gelb: "Gelb", rot: "Rot", offen: "Nicht bewertet" };

export type BereichKey = "identitaet" | "einkommen" | "fixkosten" | "lebenshaltung" | "verbindlichkeiten" | "zahlungsverhalten" | "auffaelligkeiten";
export const BEREICHE: { key: BereichKey; titel: string; frage: string }[] = [
  { key: "identitaet", titel: "Identität & Adresse", frage: "Passen Ausweis, Kontoinhaber und Anschrift zusammen?" },
  { key: "einkommen", titel: "Beschäftigung & Einkommen", frage: "Geht jeden Monat verlässlich Einkommen ein?" },
  { key: "fixkosten", titel: "Fixkosten", frage: "Wie viel der Einnahmen binden feste Zahlungen und Verträge?" },
  { key: "lebenshaltung", titel: "Lebenshaltung", frage: "Bleibt am Monatsende etwas übrig?" },
  { key: "verbindlichkeiten", titel: "Verbindlichkeiten", frage: "Wie stark binden Raten und Forderungen das Einkommen?" },
  { key: "zahlungsverhalten", titel: "Zahlungsverhalten", frage: "Wird das Konto im Plus geführt, gehen Lastschriften durch?" },
  { key: "auffaelligkeiten", titel: "Auffälligkeiten", frage: "Gibt es Buchungen, die Banken kritisch sehen?" },
];

export interface IdentEingang {
  ausweisOk: boolean;
  ausweisTyp: string | null;
  /** Steht die Anschrift der Akte im Kopf des Kontoauszugs? null = nicht prüfbar (Foto, keine Anschrift in der Akte). */
  adresseImAuszug: boolean | null;
  /** Steht der Name des Kunden im Kopf des Kontoauszugs? null = nicht prüfbar. */
  inhaberImAuszug: boolean | null;
}

export interface AuskunftEingang {
  /** Stufe der ausgewerteten Auskunft (fiaon-schufa-analyse ampelAus). */
  stufe: "frei" | "aufraeumen" | "angreifbar" | "dringend" | null;
  auskunftei: string | null;
  vom: string | null;
  negativ: number;
  offenCents: number | null;
}

export interface BereichAmpel { key: BereichKey; titel: string; ampel: Ampel; grund: string; beleg: string }

const prozent = (q: number) => `${Math.round(q * 100)} %`;
const euro = (c: number) => `${Math.round(c / 100).toLocaleString("de-DE")} €`;

export const SCHWELLEN = {
  einkommenMin: 100_000,
  einkommenAngabeAnteil: 0.8,
  fixGruen: 0.55, fixGelb: 0.75,
  ueberschussGruen: 0.1,
  ratenGruen: 0.15, ratenGelb: 0.35,
  bargeldHoch: 0.4,
  gluecksspielRot: 0.05,
} as const;

export function ampelnRechnen(f: Fakten, ident: IdentEingang, auskunft: AuskunftEingang | null, angabeEinkommenCents: number | null): BereichAmpel[] {
  const aus: BereichAmpel[] = [];
  const titel = (k: BereichKey) => BEREICHE.find((b) => b.key === k)!.titel;
  const setze = (key: BereichKey, ampel: Ampel, grund: string, beleg: string) => aus.push({ key, titel: titel(key), ampel, grund, beleg });

  // ① Identität & Adresse
  if (!ident.ausweisOk) setze("identitaet", "rot", "Der Ausweis ist nicht bestätigt.", "Ausweis");
  else if (ident.inhaberImAuszug === false) setze("identitaet", "rot", "Ihr Name steht nicht im Kopf des Kontoauszugs — es ist nicht belegt, dass das Konto Ihnen gehört.", "Ausweis, Kopf des Kontoauszugs");
  // Nachprüfung 08.10.: Der Personalausweis belegt die Anschrift nur, wenn der Kontoauszug nicht widerspricht.
  else if (ident.adresseImAuszug === true || (/personalausweis/i.test(ident.ausweisTyp ?? "") && ident.adresseImAuszug !== false)) {
    setze("identitaet", "gruen", "Ausweis geprüft, die Anschrift ist belegt.", ident.adresseImAuszug ? "Ausweis, Anschrift im Kontoauszug" : "Personalausweis (mit Anschrift)");
  } else setze("identitaet", "gelb", "Ausweis geprüft; die Anschrift ist durch die Unterlagen nicht belegt (Reisepass ohne Anschrift oder abweichende Anschrift).", "Ausweis");

  // ② Beschäftigung & Einkommen
  const volle = f.zeitraum.volleMonate.length;
  const regel = volle > 0 ? f.volleMonateMitEinkommen === volle : f.einkommenMonate.every((m) => m.cents > 0);
  const unterAngabe = angabeEinkommenCents != null && angabeEinkommenCents > 0 && f.einkommenJeMonatCents < angabeEinkommenCents * SCHWELLEN.einkommenAngabeAnteil;
  if (f.einkommenJeMonatCents <= 0) setze("einkommen", "rot", "Im Kontoauszug ist kein regelmäßiges Einkommen (Gehalt, Rente, Leistung) zu sehen.", "Kontoauszug");
  else if (!regel) setze("einkommen", "gelb", "Einkommen geht nicht in jedem Monat ein.", "Kontoauszug, Monatsverlauf");
  else if (f.einkommenJeMonatCents < SCHWELLEN.einkommenMin) setze("einkommen", "gelb", `Regelmäßiges Einkommen, aber unter ${euro(SCHWELLEN.einkommenMin)} im Monat.`, "Kontoauszug");
  else if (f.einkommenQuelle === "sozialleistung") setze("einkommen", "gelb", "Regelmäßiges Einkommen, ausschließlich aus Sozialleistungen.", "Kontoauszug");
  else if (unterAngabe) setze("einkommen", "gelb", "Das belegte Einkommen liegt deutlich unter der Angabe im Antrag.", "Kontoauszug, Antrag");
  else setze("einkommen", "gruen", "Einkommen geht in jedem Monat verlässlich ein.", "Kontoauszug, Monatsverlauf");

  // ③ Fixkosten
  const doppelt = doppelteVertraege(f);
  if (f.einnahmenJeMonatCents <= 0 || f.fixkostenQuote > SCHWELLEN.fixGelb) setze("fixkosten", "rot", `Feste Zahlungen binden ${f.einnahmenJeMonatCents > 0 ? prozent(f.fixkostenQuote) : "mehr als"} der Einnahmen.`, "Kontoauszug, feste Zahlungen");
  else if (f.fixkostenQuote > SCHWELLEN.fixGruen || doppelt.length) {
    setze("fixkosten", "gelb", doppelt.length && f.fixkostenQuote <= SCHWELLEN.fixGruen
      ? `Fixkostenquote ${prozent(f.fixkostenQuote)}, aber vermutlich doppelte Verträge (${doppelt.map((d) => d.kategorie).join(", ")}).`
      : `Feste Zahlungen binden ${prozent(f.fixkostenQuote)} der Einnahmen.`, "Kontoauszug, feste Zahlungen");
  } else setze("fixkosten", "gruen", `Feste Zahlungen binden ${prozent(f.fixkostenQuote)} der Einnahmen.`, "Kontoauszug, feste Zahlungen");

  // ④ Lebenshaltung
  if (f.ueberschussQuote < 0) setze("lebenshaltung", "rot", "Im Schnitt geht mehr hinaus, als hereinkommt.", "Kontoauszug, Monatsbilanz");
  else if (f.ueberschussQuote < SCHWELLEN.ueberschussGruen || f.bargeldQuote > SCHWELLEN.bargeldHoch) {
    setze("lebenshaltung", "gelb", f.bargeldQuote > SCHWELLEN.bargeldHoch && f.ueberschussQuote >= SCHWELLEN.ueberschussGruen
      ? `Ein großer Teil der Ausgaben geht als Bargeld hinaus (${prozent(f.bargeldQuote)}) — wofür, ist nicht zu sehen.`
      : `Am Monatsende bleibt wenig übrig (${prozent(f.ueberschussQuote)} der Einnahmen).`, "Kontoauszug, Monatsbilanz");
  } else setze("lebenshaltung", "gruen", `Am Monatsende bleiben im Schnitt ${prozent(f.ueberschussQuote)} der Einnahmen übrig.`, "Kontoauszug, Monatsbilanz");

  // ⑤ Verbindlichkeiten
  if (f.inkassoAnzahl >= 2 || f.ratenQuote > SCHWELLEN.ratenGelb) {
    setze("verbindlichkeiten", "rot", f.inkassoAnzahl >= 2 ? `${f.inkassoAnzahl} Zahlungen an Inkasso im Zeitraum.` : `Raten binden ${prozent(f.ratenQuote)} der Einnahmen.`, "Kontoauszug");
  } else if (f.inkassoAnzahl === 1 || f.ratenQuote >= SCHWELLEN.ratenGruen || (auskunft?.stufe === "dringend")) {
    setze("verbindlichkeiten", "gelb", f.inkassoAnzahl === 1 ? "Eine Zahlung an ein Inkassobüro im Zeitraum." : auskunft?.stufe === "dringend" && f.ratenQuote < SCHWELLEN.ratenGruen
      ? "Laut Ihrer Bonitätsauskunft stehen mehrere offene Einträge an." : `Raten binden ${prozent(f.ratenQuote)} der Einnahmen.`, auskunft?.stufe === "dringend" ? "Kontoauszug, Bonitätsauskunft" : "Kontoauszug");
  } else setze("verbindlichkeiten", "gruen", f.ratenJeMonatCents > 0 ? `Raten binden ${prozent(f.ratenQuote)} der Einnahmen.` : "Keine laufenden Raten oder Forderungen im Zeitraum.", "Kontoauszug");

  // ⑥ Zahlungsverhalten
  const minus = (f.dispoTage ?? 0) > 0 || (f.tiefsterSaldoCents != null && f.tiefsterSaldoCents < 0);
  if (f.ruecklastschriften >= 2 || f.mahnAnzahl >= 3) {
    setze("zahlungsverhalten", "rot", f.ruecklastschriften >= 2 ? `${f.ruecklastschriften} Rücklastschriften im Zeitraum.` : `${f.mahnAnzahl} Mahn- oder Verzugsgebühren im Zeitraum.`, "Kontoauszug");
  } else if (f.ruecklastschriften === 1 || minus || f.mahnAnzahl > 0) {
    setze("zahlungsverhalten", "gelb", f.ruecklastschriften === 1 ? "Eine Rücklastschrift im Zeitraum." : minus
      ? `Das Konto war im Minus${f.dispoTage ? ` (an ${f.dispoTage} Tagen)` : ""}.` : "Mahn- oder Verzugsgebühren im Zeitraum.", "Kontoauszug, Salden");
  } else setze("zahlungsverhalten", "gruen", f.dispoTage == null ? "Keine Rücklastschrift, keine Mahngebühr (Kontostand je Buchung nicht im Auszug)." : "Konto im Plus, keine Rücklastschrift, keine Mahngebühr.", "Kontoauszug");

  // ⑦ Auffälligkeiten
  const spielQuote = f.einnahmenJeMonatCents > 0 ? f.gluecksspielJeMonatCents / f.einnahmenJeMonatCents : (f.gluecksspielJeMonatCents > 0 ? 1 : 0);
  if (f.pfaendungHinweis || spielQuote >= SCHWELLEN.gluecksspielRot) {
    setze("auffaelligkeiten", "rot", f.pfaendungHinweis ? "Im Auszug stehen Hinweise auf eine Pfändung oder ein Pfändungsschutzkonto." : `Glücksspiel und Wetten binden ${prozent(spielQuote)} der Einnahmen.`, "Kontoauszug");
  } else if (f.gluecksspielAnzahl > 0 || f.bargeldQuote > SCHWELLEN.bargeldHoch || f.mahnAnzahl > 0) {
    setze("auffaelligkeiten", "gelb", f.gluecksspielAnzahl > 0 ? `${f.gluecksspielAnzahl} Buchungen für Glücksspiel oder Wetten.` : f.bargeldQuote > SCHWELLEN.bargeldHoch
      ? `Hoher Bargeldanteil (${prozent(f.bargeldQuote)} der Ausgaben).` : "Mahn- oder Verzugsgebühren im Zeitraum.", "Kontoauszug");
  } else setze("auffaelligkeiten", "gruen", "Keine Buchungen, die Banken üblicherweise kritisch sehen.", "Kontoauszug");

  return aus;
}

/** Vermutlich doppelte Verträge: mehrere laufende Posten derselben Art (Telefon/Internet, Versicherung mit gleichem Anbieter-Wort). */
export function doppelteVertraege(f: Fakten): { kategorie: string; posten: string[]; kleinsterCents: number }[] {
  const aus: { kategorie: string; posten: string[]; kleinsterCents: number }[] = [];
  const tel = f.vertraege.filter((v) => v.kategorie === "Telefon / Internet");
  if (tel.length >= 3) aus.push({ kategorie: "Telefon / Internet", posten: tel.map((v) => v.name), kleinsterCents: Math.min(...tel.map((v) => v.jeMonatCents)) });
  const abo = f.vertraege.filter((v) => v.kategorie === "Abo / Medien");
  const streaming = abo.filter((v) => /netflix|disney|sky|wow|prime|dazn|rtl|joyn|paramount|waipu|zattoo|magenta/i.test(v.name));
  if (streaming.length >= 3) aus.push({ kategorie: "Streaming", posten: streaming.map((v) => v.name), kleinsterCents: Math.min(...streaming.map((v) => v.jeMonatCents)) });
  return aus;
}

// ───────────────────────────────────────────────────────────────────────────
// 5 · FIAON-FINANZWERT (100–999)
// ───────────────────────────────────────────────────────────────────────────

export interface Kriterium { key: string; titel: string; punkte: number; max: number; grund: string; beleg: "belegt" | "Angabe" | "nicht bewertet" }
export interface Finanzwert { wert: number; band: Band; kriterien: Kriterium[]; sockel: number }
export type Band = "sehr stabil" | "stabil" | "tragfähig" | "angespannt" | "kritisch";

export const FINANZWERT_SOCKEL = 100;
/** Die Gewichte — offen im PDF. Summe 899, mit dem Sockel 999. */
export const GEWICHTE: { key: string; titel: string; max: number }[] = [
  { key: "einkommen_belegt", titel: "Einkommen belegt und regelmäßig", max: 150 },
  { key: "einkommen_hoehe", titel: "Höhe des Einkommens", max: 70 },
  { key: "ueberschuss", titel: "Monatlicher Überschuss", max: 150 },
  { key: "fixkosten", titel: "Fixkostenquote", max: 100 },
  { key: "kontofuehrung", titel: "Kontoführung ohne Minus", max: 90 },
  { key: "ruecklastschriften", titel: "Keine Rücklastschriften", max: 80 },
  { key: "inkasso", titel: "Keine Inkasso- und Mahnkosten", max: 70 },
  { key: "raten", titel: "Raten und „Später bezahlen“", max: 70 },
  { key: "gluecksspiel", titel: "Kein Glücksspiel", max: 30 },
  { key: "identitaet", titel: "Identität und Anschrift belegt", max: 40 },
  { key: "auskunft", titel: "Ihre Bonitätsauskunft (falls vorgelegt)", max: 49 },
];

export const BAENDER: { ab: number; band: Band; satz: string }[] = [
  { ab: 850, band: "sehr stabil", satz: "Ihre Finanzen sind sehr stabil geordnet." },
  { ab: 700, band: "stabil", satz: "Ihre Finanzen sind stabil — mit einzelnen Stellschrauben." },
  { ab: 550, band: "tragfähig", satz: "Ihre Finanzen tragen — es gibt klare Punkte, an denen Sie ansetzen können." },
  { ab: 400, band: "angespannt", satz: "Ihre Finanzen sind angespannt — die Schritte unten haben Vorrang." },
  { ab: 100, band: "kritisch", satz: "Ihre Finanzen sind derzeit kritisch — beginnen Sie mit den Sofort-Schritten." },
];

export function bandFuer(wert: number): Band {
  return (BAENDER.find((b) => wert >= b.ab) ?? BAENDER[BAENDER.length - 1]).band;
}

function stufen(w: number, stufen: [number, number][], sonst: number): number {
  for (const [grenze, punkte] of stufen) if (w >= grenze) return punkte;
  return sonst;
}

export function finanzwertRechnen(f: Fakten, ampeln: BereichAmpel[], auskunft: AuskunftEingang | null): Finanzwert {
  const k: Kriterium[] = [];
  const g = (key: string) => GEWICHTE.find((x) => x.key === key)!;
  const add = (key: string, punkte: number, grund: string, beleg: Kriterium["beleg"] = "belegt") => {
    const gw = g(key);
    k.push({ key, titel: gw.titel, max: gw.max, punkte: Math.max(0, Math.min(gw.max, Math.round(punkte))), grund, beleg });
  };

  const volle = f.zeitraum.volleMonate.length;
  const anteil = volle > 0 ? f.volleMonateMitEinkommen / volle : (f.einkommenMonate.length ? f.einkommenMonate.filter((m) => m.cents > 0).length / f.einkommenMonate.length : 0);
  add("einkommen_belegt", f.einkommenJeMonatCents <= 0 ? 0 : anteil >= 1 ? 150 : anteil >= 0.66 ? 100 : 50,
    f.einkommenJeMonatCents <= 0 ? "Kein Einkommen im Auszug." : `Einkommen in ${volle ? `${f.volleMonateMitEinkommen} von ${volle} vollen Monaten` : "den belegten Monaten"}.`);
  add("einkommen_hoehe", stufen(f.einkommenJeMonatCents, [[300_000, 70], [220_000, 55], [160_000, 40], [110_000, 25], [60_000, 10]], 0),
    `Rund ${euro(f.einkommenJeMonatCents)} Einkommen im Monat.`);
  add("ueberschuss", f.einnahmenJeMonatCents <= 0 ? 0 : stufen(f.ueberschussQuote, [[0.2, 150], [0.1, 115], [0.05, 80], [0, 40], [-0.1, 10]], 0),
    `Überschuss ${f.einnahmenJeMonatCents > 0 ? prozent(f.ueberschussQuote) : "—"} der Einnahmen (${euro(f.ueberschussJeMonatCents)} im Monat).`);
  add("fixkosten", f.einnahmenJeMonatCents <= 0 ? 0 : f.fixkostenQuote <= 0.4 ? 100 : f.fixkostenQuote <= 0.55 ? 70 : f.fixkostenQuote <= 0.7 ? 35 : f.fixkostenQuote <= 0.85 ? 10 : 0,
    `Feste Zahlungen ${f.einnahmenJeMonatCents > 0 ? prozent(f.fixkostenQuote) : "—"} der Einnahmen.`);
  if (f.dispoTage == null && f.tiefsterSaldoCents == null) {
    add("kontofuehrung", 45, "Kontostand je Buchung nicht im Auszug — halb gewertet.", "nicht bewertet");
  } else {
    const tiefst = f.tiefsterSaldoCents ?? 0;
    const tage = f.dispoTage ?? 0;
    add("kontofuehrung", tiefst >= 0 && tage === 0 ? 90 : tiefst >= -50_000 && tage <= 5 ? 55 : tage <= 15 ? 25 : 0,
      tiefst >= 0 && tage === 0 ? "Konto durchgehend im Plus." : `Konto an ${tage} Tagen im Minus, tiefster Stand ${euro(tiefst)}.`);
  }
  add("ruecklastschriften", f.ruecklastschriften === 0 ? 80 : f.ruecklastschriften === 1 ? 30 : 0,
    f.ruecklastschriften === 0 ? "Keine Rücklastschrift." : `${f.ruecklastschriften} Rücklastschrift${f.ruecklastschriften === 1 ? "" : "en"}.`);
  add("inkasso", f.inkassoAnzahl >= 2 ? 0 : f.inkassoAnzahl === 1 ? 20 : f.mahnAnzahl > 0 ? 45 : 70,
    f.inkassoAnzahl ? `${f.inkassoAnzahl} Zahlung${f.inkassoAnzahl === 1 ? "" : "en"} an Inkasso.` : f.mahnAnzahl ? `${f.mahnAnzahl} Mahngebühr${f.mahnAnzahl === 1 ? "" : "en"}.` : "Keine Inkasso- oder Mahnkosten.");
  add("raten", f.ratenJeMonatCents <= 0 ? 70 : f.einnahmenJeMonatCents <= 0 ? 0 : stufen(-f.ratenQuote, [[-0.05, 70], [-0.15, 55], [-0.25, 35], [-0.35, 15]], 0),
    f.ratenJeMonatCents <= 0 ? "Keine laufenden Raten." : `Raten ${euro(f.ratenJeMonatCents)} im Monat (${prozent(f.ratenQuote)} der Einnahmen).`);
  const spielQuote = f.einnahmenJeMonatCents > 0 ? f.gluecksspielJeMonatCents / f.einnahmenJeMonatCents : 0;
  add("gluecksspiel", f.gluecksspielAnzahl === 0 ? 30 : spielQuote < 0.01 && f.gluecksspielAnzahl < 3 ? 15 : 0,
    f.gluecksspielAnzahl === 0 ? "Keine Glücksspiel-Buchung." : `${f.gluecksspielAnzahl} Buchungen für Glücksspiel oder Wetten.`);
  const id = ampeln.find((a) => a.key === "identitaet");
  add("identitaet", id?.ampel === "gruen" ? 40 : id?.ampel === "gelb" ? 20 : 0, id?.grund ?? "—");
  if (!auskunft?.stufe) add("auskunft", 25, "Keine ausgewertete Bonitätsauskunft vorgelegt — halb gewertet.", "nicht bewertet");
  else add("auskunft", auskunft.stufe === "frei" ? 49 : auskunft.stufe === "aufraeumen" ? 40 : auskunft.stufe === "angreifbar" ? 20 : 0,
    auskunft.stufe === "frei" || !auskunft.negativ ? "Keine belastenden Einträge laut Ihrer Auskunft."
      : auskunft.negativ === 1 ? "Laut Ihrer Auskunft 1 belastender Eintrag." : `Laut Ihrer Auskunft ${auskunft.negativ} belastende Einträge.`);

  const wert = FINANZWERT_SOCKEL + k.reduce((s, x) => s + x.punkte, 0);
  return { wert: Math.max(100, Math.min(999, wert)), band: bandFuer(wert), kriterien: k, sockel: FINANZWERT_SOCKEL };
}

export function gesamtAmpel(ampeln: BereichAmpel[], band: Band): { ampel: Ampel; grund: string } {
  const rot = ampeln.filter((a) => a.ampel === "rot").length;
  const gelb = ampeln.filter((a) => a.ampel === "gelb").length;
  if (band === "kritisch" || rot >= 2) return { ampel: "rot", grund: rot >= 2 ? `${rot} Bereiche stehen auf Rot.` : "Der Finanzwert liegt im kritischen Band." };
  if ((band === "sehr stabil" || band === "stabil") && rot === 0 && gelb <= 2) return { ampel: "gruen", grund: "Stabile Lage, höchstens einzelne gelbe Punkte." };
  return { ampel: "gelb", grund: rot ? "Ein Bereich steht auf Rot." : "Mehrere Bereiche mit Handlungsbedarf." };
}

// ───────────────────────────────────────────────────────────────────────────
// 6 · SCHRITTE MIT EURO-WIRKUNG · VERGLEICHSWEGE
// ───────────────────────────────────────────────────────────────────────────

export type Frist = "sofort" | "30" | "90" | "365";
export const FRIST_TEXT: Record<Frist, string> = { sofort: "Sofort", "30": "In den nächsten 30 Tagen", "90": "In den nächsten 90 Tagen", "365": "Einmal im Jahr" };
export interface Schritt {
  art: string;
  frist: Frist;
  titel: string;
  warum: string;
  wie: string[];
  /** Euro-Wirkung je Monat als Spanne (Cent). null = Ordnung, keine Ersparnis in Euro. */
  wirkung: { vonCents: number; bisCents: number; art: "ersparnis" | "ruecklage" } | null;
}

const runde10 = (c: number) => Math.floor(c / 1000) * 1000;

/** Die Schritte — nur aus den eigenen Zahlen des Kunden, nie aus Marktpreisen oder Anbieterlisten. */
export function schritteAus(f: Fakten): Schritt[] {
  const s: Schritt[] = [];
  const tipp = (art: string) => f.tipps.find((t) => t.art === art) ?? null;
  const zahltag = f.zahltag ? `um den ${f.zahltag}.` : null;

  const dispo = tipp("dispo");
  if (dispo && dispo.jeMonatCents > 0) s.push({ art: "dispo", frist: "sofort", titel: "Dispo abbauen", warum: "Für das Minus auf dem Konto fallen Zinsen an — einer der teuersten Wege, Geld zu leihen.",
    wie: ["Prüfen Sie, wie hoch Ihr Dispozins ist (Preisaushang Ihrer Bank).", "Legen Sie fest, um welchen Betrag Sie den Dispo jeden Monat zurückführen.", "Fragen Sie Ihre Bank nach günstigeren Wegen, den Dispo abzulösen, und vergleichen Sie Angebote selbst — FIAON vermittelt keine Kredite."],
    wirkung: { vonCents: Math.round(dispo.jeMonatCents * 0.5), bisCents: dispo.jeMonatCents, art: "ersparnis" } });
  const konto = tipp("konto");
  if (konto && konto.jeMonatCents > 0) s.push({ art: "konto", frist: "30", titel: "Kontomodell prüfen", warum: "Grundpreis, Kartenentgelt und Buchungsposten kosten Monat für Monat.",
    wie: ["Fragen Sie Ihre Bank nach einem günstigeren Kontomodell.", "Vergleichen Sie Girokonten über ein unabhängiges Vergleichsportal.", "Viele Banken bieten eine Kontowechselhilfe an, die Daueraufträge und Lastschriften mitnimmt."],
    wirkung: { vonCents: Math.round(konto.jeMonatCents * 0.5), bisCents: konto.jeMonatCents, art: "ersparnis" } });
  const automat = tipp("automat");
  if (automat && automat.jeMonatCents > 0) s.push({ art: "automat", frist: "sofort", titel: "Gebühren beim Bargeld vermeiden", warum: "Fremde Geldautomaten und Auslandseinsätze kosten Gebühren.",
    wie: ["Heben Sie an Automaten Ihrer Bank oder an der Supermarktkasse ab.", "Nutzen Sie im Ausland eine Karte ohne Fremdwährungsentgelt."],
    wirkung: { vonCents: automat.jeMonatCents, bisCents: automat.jeMonatCents, art: "ersparnis" } });
  const rueck = tipp("ruecklastschrift");
  if (rueck && (rueck.anzahl ?? 0) + rueck.jeMonatCents > 0) s.push({ art: "lastschrifttermine", frist: "30", titel: "Lastschrifttermine nach dem Zahltag ordnen", warum: "Jede zurückgegebene Lastschrift kostet Gebühren und fällt Banken auf.",
    wie: [zahltag ? `Ihr Einkommen kommt meist ${zahltag} Bitten Sie Vermieter, Versicherer und Anbieter, ihre Abbuchungen auf die Tage danach zu legen.` : "Bitten Sie Vermieter, Versicherer und Anbieter, ihre Abbuchungen auf die Tage nach Ihrem Geldeingang zu legen.", "Halten Sie vor großen Abbuchungen einen kleinen Puffer auf dem Konto."],
    wirkung: rueck.jeMonatCents > 0 ? { vonCents: rueck.jeMonatCents, bisCents: rueck.jeMonatCents, art: "ersparnis" } : null });
  const mahn = tipp("mahn");
  if (mahn && mahn.jeMonatCents > 0) s.push({ art: "mahn", frist: "sofort", titel: "Mahn- und Verzugskosten stoppen", warum: "Geld für zu spät bezahlte Rechnungen ist einfach weg.",
    wie: ["Begleichen Sie offene Rechnungen zuerst, bei denen Mahngebühren laufen.", "Fragen Sie beim Gläubiger nach einer Ratenzahlung, wenn der Betrag zu hoch ist."],
    wirkung: { vonCents: mahn.jeMonatCents, bisCents: mahn.jeMonatCents, art: "ersparnis" } });
  const spiel = tipp("gluecksspiel");
  if (spiel && spiel.jeMonatCents > 0) s.push({ art: "gluecksspiel", frist: "sofort", titel: "Glücksspiel und Wetten beenden", warum: "Banken sehen jede Wettbuchung — und das Geld fehlt am Monatsende.",
    wie: ["Kündigen Sie Spielerkonten und löschen Sie Wett-Apps.", "Wenn es schwerfällt: Fachstellen für Glücksspielsucht helfen kostenfrei und vertraulich."],
    wirkung: { vonCents: spiel.jeMonatCents, bisCents: spiel.jeMonatCents, art: "ersparnis" } });
  const abos = tipp("abos");
  if (abos && abos.jeMonatCents > 0) s.push({ art: "abos", frist: "30", titel: "Abos und Mitgliedschaften durchgehen", warum: `${abos.posten.length} laufende Abos und Mitgliedschaften.`,
    wie: ["Gehen Sie Ihre Verträge und Abos durch: Was nutzen Sie nicht jede Woche?", "Kündigen Sie, was Sie nicht brauchen — Kündigungsfristen stehen im Vertrag oder im Kundenkonto.", ...(abos.posten.length ? [`Ihre Abos: ${aufzaehlung(abos.posten.slice(0, 6))}${abos.posten.length > 6 ? " und weitere" : ""}.`] : [])],
    wirkung: { vonCents: 0, bisCents: abos.jeMonatCents, art: "ersparnis" } });
  for (const d of doppelteVertraege(f)) s.push({ art: `doppelt_${d.kategorie}`, frist: "30", titel: `Mehrere Verträge: ${d.kategorie}`, warum: `${d.posten.length} laufende Verträge (${aufzaehlung(d.posten.slice(0, 5))}).`,
    wie: ["Prüfen Sie, ob alle Verträge noch gebraucht werden oder sich überschneiden.", "Tarife lassen sich über unabhängige Vergleichsportale vergleichen; der bisherige Anbieter hat oft ein günstigeres Angebot für Bestandskunden."],
    wirkung: { vonCents: 0, bisCents: d.kleinsterCents, art: "ersparnis" } });
  const tel = tipp("telefon");
  if (tel && tel.jeMonatCents > 0 && !s.some((x) => x.art === "doppelt_Telefon / Internet")) s.push({ art: "telefon", frist: "90", titel: "Telefon- und Internettarif vergleichen", warum: "Telefon und Internet gehören zu den Kosten, die sich am leichtesten senken lassen.",
    wie: ["Schauen Sie, wann Ihre Mindestlaufzeit endet.", "Vergleichen Sie Tarife über ein unabhängiges Vergleichsportal und fragen Sie Ihren Anbieter nach einem Bestandskunden-Angebot."],
    wirkung: { vonCents: 0, bisCents: Math.round(tel.jeMonatCents * 0.3), art: "ersparnis" } });
  const liefer = tipp("liefer");
  if (liefer && liefer.jeMonatCents > 0) s.push({ art: "liefer", frist: "30", titel: "Lieferdienste seltener nutzen", warum: "Essen unterwegs und Lieferdienste summieren sich.",
    wie: ["Legen Sie ein festes Wochenbudget für Essen unterwegs fest.", "Planen Sie zwei, drei Gerichte pro Woche vor."],
    wirkung: { vonCents: Math.round(liefer.jeMonatCents * 0.25), bisCents: Math.round(liefer.jeMonatCents * 0.5), art: "ersparnis" } });
  if (f.inkassoAnzahl > 0 || f.pfaendungHinweis) s.push({ art: "forderungen", frist: "30", titel: "Offene Forderungen ordnen", warum: "Inkassokosten treiben jede Schuld nach oben.",
    wie: ["Listen Sie alle offenen Forderungen mit Betrag und Gläubiger auf.", "Nehmen Sie Kontakt mit den Gläubigern auf und vereinbaren Sie, was Sie leisten können.", "Anerkannte Schuldnerberatungsstellen (Verbraucherzentrale, Wohlfahrtsverbände) helfen kostenfrei."],
    wirkung: null });
  if (f.ratenJeMonatCents > 0 && tipp("ratenkauf")) s.push({ art: "ratenkauf", frist: "90", titel: "Keine neuen Ratenkäufe", warum: "Jede offene Rate bindet das Geld der nächsten Monate.",
    wie: ["Bezahlen Sie neue Einkäufe nur noch, wenn das Geld schon auf dem Konto ist.", "Lösen Sie laufende Ratenkäufe nach und nach ab, beginnend mit dem kleinsten."], wirkung: null });
  if (f.ueberschussJeMonatCents >= 5000) {
    const rate = Math.max(1000, runde10(f.ueberschussJeMonatCents * 0.5));
    s.push({ art: "ruecklage", frist: "30", titel: "Eine Rücklage aufbauen", warum: "Eine Rücklage fängt unerwartete Ausgaben ab, ohne dass das Konto ins Minus rutscht.",
      wie: [`Richten Sie einen Dauerauftrag ${zahltag ? `am Tag nach Ihrem Zahltag (${zahltag})` : "am Tag nach Ihrem Geldeingang"} auf ein eigenes Sparkonto ein.`, "Ziel: rund drei Monatsausgaben als Polster."],
      wirkung: { vonCents: rate, bisCents: rate, art: "ruecklage" } });
  } else if (f.ueberschussJeMonatCents < 0) {
    s.push({ art: "haushaltsplan", frist: "sofort", titel: "Einen Monatsplan aufstellen", warum: "Im Schnitt geht mehr hinaus, als hereinkommt.",
      wie: ["Schreiben Sie feste Einnahmen und feste Ausgaben untereinander.", "Legen Sie für Lebensmittel, Freizeit und Bargeld je einen festen Wochenbetrag fest.", "Beginnen Sie mit den Sofort-Schritten auf dieser Seite."], wirkung: null });
  }
  s.push({ art: "jaehrlich", frist: "365", titel: "Einmal im Jahr: Verträge und Tarife prüfen", warum: "Preise und Bedarf ändern sich — Verträge laufen weiter.",
    wie: ["Gehen Sie einmal im Jahr Konto, Versicherungen, Strom, Telefon und Abos durch.", "Bringen Sie dazu die aktuellen Kontoauszüge mit — wir werten sie gern neu aus."], wirkung: null });

  const rang: Record<Frist, number> = { sofort: 0, "30": 1, "90": 2, "365": 3 };
  return s.sort((a, b) => rang[a.frist] - rang[b.frist] || (b.wirkung?.bisCents ?? 0) - (a.wirkung?.bisCents ?? 0));
}

/** Summe der Ersparnis-Spannen (ohne Rücklage) je Monat. */
export function sparpotenzial(schritte: Schritt[]): { vonCents: number; bisCents: number } {
  const e = schritte.filter((s) => s.wirkung?.art === "ersparnis");
  return { vonCents: e.reduce((x, s) => x + (s.wirkung?.vonCents ?? 0), 0), bisCents: e.reduce((x, s) => x + (s.wirkung?.bisCents ?? 0), 0) };
}

/** Allgemeine Vergleichs- und Beratungswege — ohne Anbieter, ohne Partnerlinks, ohne Provision. */
export const VERGLEICHSWEGE: { titel: string; text: string }[] = [
  { titel: "Unabhängige Vergleichsportale", text: "Für Strom, Gas, Telefon, Internet, Girokonto und Versicherungen. Nutzen Sie mehr als ein Portal — nicht jedes listet alle Anbieter, und manche Anbieter zahlen Portalen eine Vergütung." },
  { titel: "Verbraucherzentrale", text: "Unabhängige Hilfe bei Verträgen, Versicherungen, Energie und Geldfragen — teils kostenfrei, teils gegen ein geringes Entgelt." },
  { titel: "Schuldnerberatungsstellen", text: "Anerkannte Schuldnerberatungsstellen der Verbraucherzentralen, der Wohlfahrtsverbände und der Kommunen helfen bei offenen Forderungen kostenfrei." },
  { titel: "Ihr bisheriger Anbieter", text: "Fragen Sie vor einem Wechsel nach einem Angebot für Bestandskunden — oft lässt sich der Preis ohne Wechsel senken." },
  { titel: "Zustehende Leistungen", text: "Ob Ihnen Leistungen wie Wohngeld, Kinderzuschlag oder eine Befreiung vom Rundfunkbeitrag zustehen, prüft die jeweils zuständige Stelle; viele Behörden bieten dafür Online-Rechner an." },
];

// ───────────────────────────────────────────────────────────────────────────
// 7 · PFLICHTSÄTZE — überall, wo Wert oder Ampel stehen (PDF, Portal, Akte)
// ───────────────────────────────────────────────────────────────────────────

export const FINANZWERT_KENNZEICHNUNG =
  "Der FIAON-Finanzwert ist eine eigene Berechnung von FIAON aus den von Ihnen vorgelegten Unterlagen. Er ist kein SCHUFA-Score und "
  + "kein Score einer anderen Auskunftei, keine Bonitätsauskunft, keine Kreditwürdigkeitsprüfung und keine automatisierte Entscheidung im Sinne "
  + "von Art. 22 DSGVO. Er ist "
  + "keine Kredit- oder Kartenzusage, entscheidet bei FIAON über nichts und wird nicht an Dritte weitergegeben.";

export const FINANZWERT_KURZ = "Eigene Berechnung von FIAON aus Ihren Unterlagen — kein SCHUFA-Score, keine Bonitätsauskunft, keine Kredit- oder Kartenzusage.";

export const HAFTUNG_ABSAETZE: string[] = [
  "Diese Auswertung dient Ihrer Information und der Ordnung Ihrer Finanzen. Sie ist keine Anlage-, Kredit-, Versicherungs-, Steuer- oder Rechtsberatung "
  + "und keine Vermittlung von Krediten, Versicherungen, Finanzanlagen oder Immobiliardarlehen (§§ 34c, 34d, 34f, 34i GewO). FIAON empfiehlt keine "
  + "bestimmten Produkte oder Anbieter und erhält für die genannten allgemeinen Wege keine Vergütung.",
  "Die Auswertung beruht ausschließlich auf den Unterlagen, die Sie vorgelegt haben, und auf dem Stand des genannten Zeitraums. Buchungen, die im Auszug "
  + "nicht oder nicht lesbar enthalten sind, kennen wir nicht. Zahlen sind auf volle Euro gerundet und als Monatsdurchschnitt über den Zeitraum gerechnet.",
  "Die genannten Einsparungen sind Spannen auf Grundlage Ihrer eigenen Buchungen — keine Zusage. Ob und in welcher Höhe sie eintreten, hängt von Ihren "
  + "Verträgen und Entscheidungen ab. Entscheidungen Dritter (Banken, Auskunfteien, Gläubiger) liegen nicht in der Hand von FIAON.",
  "Einzelne Forderungen und Einträge prüfen wir nicht rechtlich. Ob eine Forderung besteht oder ein Eintrag zu löschen ist, kann im Einzelfall nur eine "
  + "dazu befugte Stelle beurteilen (Rechtsdienstleistungsgesetz).",
];

// Nachprüfung 08.10.2026: Der Absatz sagte „An das Sprachmodell geht nur ein Faktenblatt“ und „Ausweisbilder
// gehen an kein Modell“. Beides stimmte so nicht: Der Zeilenleser (fiaon-kontoauszug-analyse.ts) liest den
// ganzen Auszug samt Kopf (bei Fotos per Bild), maskiert wird erst danach; und die Ausweis-Prüfung ist ein
// eigener, späterer Schritt (Justin 08.10.). Jetzt steht hier nur, was für DIESE Auswertung zutrifft.
export const DATENSCHUTZ_ABSATZ =
  "Zum Lesen der Buchungen übermitteln wir den Inhalt Ihres Kontoauszugs — einschließlich des Kopfes mit Name, Anschrift und Kontonummer — an einen "
  + "KI-Dienstleister, der in unserem Auftrag arbeitet (Art. 28 DSGVO). Für die Einordnung in dieser Auswertung erhält das Sprachmodell danach nur ein "
  + "Faktenblatt ohne Namen, Kontonummern und Anschrift. Alle Zahlen, Ampeln und der Finanzwert entstehen nach festen Regeln auf den Servern von FIAON, "
  + "nicht im Modell. " + ART9_HINWEIS;

export const VORBEHALT_TEXTE: Record<string, string> = {
  cent: "Die gelesenen Buchungen ließen sich nicht vollständig mit den Salden des Kontoauszugs abgleichen. Einzelne Beträge können fehlen oder abweichen — "
    + "die Kennzahlen sind deshalb Näherungswerte.",
  inhaber: "Ihr Name war im Kopf des Kontoauszugs nicht eindeutig zu finden. Die Auswertung setzt voraus, dass das Konto Ihnen gehört.",
};

// ───────────────────────────────────────────────────────────────────────────
// 8 · WÄNDE FÜR MODELLTEXTE
// ───────────────────────────────────────────────────────────────────────────
// Das Modell schreibt Sätze, keine Zahlen. Zahlen stehen nur als {{z:schluessel}}
// und werden vom Server eingesetzt. Jede Ziffer außerhalb davon → Satz verworfen.

export const PLATZHALTER = ["einkommen", "ausgaben", "ueberschuss", "fixkosten", "fixquote", "raten", "ratenquote", "finanzwert", "band", "sparpotenzial", "zeitraum"] as const;
export type Platzhalter = (typeof PLATZHALTER)[number];

export function zahlenWandFunde(text: string): string[] {
  const ohne = String(text ?? "").replace(/\{\{z:([a-z]+)\}\}/g, (m, k) => ((PLATZHALTER as readonly string[]).includes(k) ? "" : m));
  const funde: string[] = [];
  if (/\d/.test(ohne)) funde.push("Ziffer außerhalb eines Platzhalters");
  if (/\{\{/.test(ohne)) funde.push("Unbekannter Platzhalter");
  return funde;
}

/** Was ein Text zur Auswertung NIE sagt — Beratung, Zusage, Rechtsrat, SCHUFA-Vergleich. */
const BERATUNG_VERBOTEN: { muster: RegExp; grund: string }[] = [
  { muster: /\bkredit\w*\s+(aufnehmen|beantragen|abschlie(ß|ss)en)|\bumschuld/i, grund: "Kredit- oder Umschuldungsempfehlung" },
  { muster: /\b(garantiert|garantie|gewährleistet|zusicher\w*|versprech\w*)\b/i, grund: "Zusage" },
  { muster: /\bsie bekommen (die|eine|ihre) (karte|kreditkarte|zusage)|\bkarte (ist|wird) (ihnen )?sicher/i, grund: "Kartenzusage" },
  { muster: /\b(aktien|fonds|etf|krypto\w*|bitcoin|anleihe\w*|tagesgeld bei|festgeld bei|bausparvertrag abschlie)/i, grund: "Anlageempfehlung" },
  { muster: /\b(schlie(ß|ss)en sie eine|abschlie(ß|ss)en sie eine)\s+\w*versicherung/i, grund: "Versicherungsempfehlung" },
  { muster: /\b(müssen|muessen) sie nicht (zahlen|bezahlen)|\bverjährt|\bunwirksam\b|\brechtswidrig|\bsittenwidrig/i, grund: "Rechtsrat im Einzelfall" },
  { muster: /\bschufa[- ]?(score|wert)|\bscore der schufa|\bbesser als die schufa/i, grund: "Vergleich mit dem SCHUFA-Score" },
  { muster: /\b(du|dein|deine|dir|dich)\b/, grund: "Du-Form — Kunden werden gesiezt" },
];

export function beratungsWandFunde(text: string): string[] {
  return BERATUNG_VERBOTEN.filter((v) => v.muster.test(String(text ?? ""))).map((v) => v.grund);
}

export function platzhalterEinsetzen(text: string, werte: Partial<Record<Platzhalter, string>>): string {
  return String(text ?? "").replace(/\{\{z:([a-z]+)\}\}/g, (_m, k) => werte[k as Platzhalter] ?? "");
}

// ───────────────────────────────────────────────────────────────────────────
// 9 · FREIGABE
// ───────────────────────────────────────────────────────────────────────────

/**
 * Wer darf übergeben? Justin, 08.10.2026: Freigabe durch den Betreuer; bei roter
 * Gesamtlage oder Vorbehalt nur durch die Leitung, und zwar durch einen ANDEREN
 * Menschen als den, der sie erzeugt hat (Vier-Augen).
 */
export function freigabeRegel(e: {
  gesamt: Ampel; vorbehalt: boolean; rolle: string; freigeberId: number | null; erstellerId: number | null; zustaendig: boolean;
}): { erlaubt: boolean; vierAugen: boolean; grund: string | null } {
  const vierAugen = e.gesamt === "rot" || e.vorbehalt;
  const leitung = e.rolle === "admin" || e.rolle === "vertriebsleiter";
  if (vierAugen) {
    if (!leitung) return { erlaubt: false, vierAugen, grund: `${e.vorbehalt ? "Auswertung mit Vorbehalt" : "Rote Gesamtlage"}: Freigabe nur durch die Leitung (Vier-Augen).` };
    if (e.freigeberId != null && e.erstellerId != null && e.freigeberId === e.erstellerId) {
      return { erlaubt: false, vierAugen, grund: "Vier-Augen: Freigeben muss ein anderer Mensch als der, der die Auswertung erzeugt hat." };
    }
    return { erlaubt: true, vierAugen, grund: null };
  }
  // Nachprüfung 08.10.: Inkasso betreut nicht — und die Pflichtmail „Auswertung bereit“ kennt die Rolle nicht
  // (der Kunde sähe die Auswertung sonst ohne Mail).
  if (!leitung && (!e.zustaendig || e.rolle === "inkasso")) return { erlaubt: false, vierAugen, grund: "Freigeben darf der Betreuer des Kunden oder die Leitung." };
  return { erlaubt: true, vierAugen, grund: null };
}

/** Die Nummer einer Fassung — steht im PDF und in der Akte. */
export function auswertungNummer(personId: number, fassung: number): string {
  return `FA-${personId}-${fassung}`;
}

// ───────────────────────────────────────────────────────────────────────────
// DER EINGEFRORENE INHALT — was gespeichert, gedruckt und im Portal gezeigt wird
// ───────────────────────────────────────────────────────────────────────────

export interface AuswertungInhalt {
  regelVersion: string;
  nummer: string;
  fassung: number;
  erstelltAm: string;
  kunde: { vorname: string | null; nachname: string | null };
  zeitraum: { von: string; bis: string; tage: number };
  fakten: Fakten;
  ampeln: BereichAmpel[];
  gesamt: { ampel: Ampel; grund: string };
  finanzwert: Finanzwert;
  schritte: Schritt[];
  sparpotenzial: { vonCents: number; bisCents: number };
  vergleichswege: { titel: string; text: string }[];
  auskunft: AuskunftEingang | null;
  einordnung: { zusammenfassung: string; bereiche: Partial<Record<BereichKey, string>> };
  texteQuelle: "ki" | "regel";
  vorbehalte: string[];
  pruefvermerke: string[];
  ausweisTyp: string | null;
}

/** Feste Einordnung je Bereich — der Rückfall, wenn kein Modell schreibt (und Maßstab für die Wände). */
export function einordnungRegel(ampeln: BereichAmpel[], fw: Finanzwert, gesamt: { ampel: Ampel }): AuswertungInhalt["einordnung"] {
  const band = BAENDER.find((b) => b.band === fw.band)!;
  const gruen = ampeln.filter((a) => a.ampel === "gruen").map((a) => a.titel);
  const offen = ampeln.filter((a) => a.ampel === "rot" || a.ampel === "gelb").map((a) => a.titel);
  const zusammenfassung = `${band.satz} ${gruen.length ? `Gut aufgestellt sind Sie bei ${aufzaehlung(gruen)}.` : ""} `
    + `${offen.length ? `Ansetzen lohnt sich bei ${aufzaehlung(offen)} — die Schritte in Ihrem Plan zeigen, wie.` : "Ihr Plan zeigt, wie Sie diesen Stand halten."}`
    + `${gesamt.ampel === "rot" ? " Beginnen Sie mit den Sofort-Schritten." : ""}`;
  const bereiche: Partial<Record<BereichKey, string>> = {};
  for (const a of ampeln) bereiche[a.key] = a.grund;
  return { zusammenfassung: zusammenfassung.replace(/\s+/g, " ").trim(), bereiche };
}

// ───────────────────────────────────────────────────────────────────────────
// KONTOINHABER UND ANSCHRIFT IM KOPF DES KONTOAUSZUGS — ohne Modell
// ───────────────────────────────────────────────────────────────────────────
// Der Kopf eines Bank-PDFs nennt Inhaber und Anschrift. Ein lokaler Abgleich
// (Umlaute, Doppelnamen, Reihenfolge egal) reicht: Steht der Nachname dort, ist
// das Konto belegt; stehen Postleitzahl und Straße dort, ist die Anschrift
// belegt. Ein Foto ohne Textschicht ist „nicht prüfbar" (null), nie „falsch".

function normName(s: string): string {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/ß/g, "ss").replace(/æ/g, "ae").replace(/ø/g, "o")
    .replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}
function normUmlaut(s: string): string {
  return String(s ?? "").toLowerCase().replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss")
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function kopfAbgleich(kopfText: string, p: { vorname?: string | null; nachname?: string | null; strasse?: string | null; plz?: string | null }): { inhaber: boolean | null; adresse: boolean | null } {
  const roh = String(kopfText ?? "");
  if (roh.replace(/\s+/g, "").length < 40) return { inhaber: null, adresse: null };
  const t1 = ` ${normName(roh)} `;
  const t2 = ` ${normUmlaut(roh)} `;
  const enthaelt = (wort: string) => {
    const a = normName(wort); const b = normUmlaut(wort);
    return (a.length >= 2 && t1.includes(` ${a} `)) || (b.length >= 2 && t2.includes(` ${b} `)) || (a.length >= 4 && t1.includes(a)) || (b.length >= 4 && t2.includes(b));
  };
  let inhaber: boolean | null = null;
  const teile = String(p.nachname ?? "").split(/[\s-]+/).map((x) => x.trim()).filter((x) => x.length >= 2 && !/^(von|van|de|der|den|zu|da|di|del|la|le)$/i.test(x));
  if (teile.length) inhaber = teile.some((t) => enthaelt(t));
  let adresse: boolean | null = null;
  const plz = String(p.plz ?? "").replace(/\D/g, "");
  const strWort = String(p.strasse ?? "").replace(/\d.*$/, "").replace(/(str\.?|straße|strasse)$/i, "").trim();
  if (plz.length >= 4 && strWort.length >= 3) adresse = t1.includes(plz) && enthaelt(strWort.split(/\s+/)[0]);
  return { inhaber, adresse };
}
