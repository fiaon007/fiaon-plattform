// ═══════════════════════════════════════════════════════════════════════════
// DAS GEBURTSDATUM — EIN LESER, EINE REGEL, EINE ANZEIGE
// E-IT-G (08.10.2026), Punkt (14) der Team-Rückmeldung
//
// ── DER BEFUND ─────────────────────────────────────────────────────────────
// „63 statt 1963, und man muss ewig zurückscrollen.“ An 15 Stellen wurde ein
// Geburtsdatum eingegeben — in fünf Bauarten mit zwölf eigenen Helfern:
//   · Das native Datumsfeld des Browsers (Akte, Kunde anlegen, Chef-Akte,
//     Kündigungsseite) macht aus den Tasten 1-7-1-1-6-3 den Wert „0063-11-17“;
//     der Kalender öffnet im heutigen Monat und verlangt 60 bis 80 Jahre
//     Zurückblättern.
//   · Die Akte zeigte JEDES Geburtsdatum zweistellig („17.11.63“) — richtig
//     und falsch sahen gleich aus, 1927 wie 2027.
//   · Der Server prüfte nur die Form JJJJ-MM-TT: „0063-11-17“, ein 31.02. oder
//     ein Datum in der Zukunft gingen durch.
//
// ── DIE REGEL (Justin, 08.10.2026) ─────────────────────────────────────────
//   · Drei Felder TT · MM · JJJJ oder freie Eingabe („14.03.1963“, „14.3.63“,
//     „14031963“, „1963-03-14“, „14. März 1963“).
//   · Zweistellige Jahre werden sinnvoll ergänzt — nie 63 n. Chr.: Das Jahr
//     kommt aus dem Jahrhundert, in dem der Mensch mindestens 16 ist
//     (heute 2026: „00“…„10“ → 2000…2010, „11“…„99“ → 1911…1999).
//   · Nicht in der Zukunft, nicht vor 1900, Kalendertag echt (Schaltjahre).
//   · Unter 18 in der Akte → Rückfrage; nach Bestätigung darf der Mitarbeiter
//     speichern. LÖSCHEN darf nur die Leitung (Server-Wand, nicht nur Knopf).
//
// ── WARUM KEIN Date-OBJEKT ─────────────────────────────────────────────────
// new Date(63, 10, 17) ist der 17.11.1963 (JS ergänzt 0–99 still um 1900),
// und jedes Date bringt eine Zeitzone mit. Hier wird nur mit Zahlen gerechnet;
// „heute“ ist der Berliner Kalendertag über formatToParts (Zeit-Falle, siehe
// Gedächtnis fiaon-zeit-berlin-falle: nie Number(Intl.format())).
//
// Diese Datei ist rein (kein Server-, kein Browser-Zugriff) — Browser und Server
// laden dieselbe Fassung. Prüfstand: scripts/pruef-it-g.ts.
// ═══════════════════════════════════════════════════════════════════════════

/** Wofür das Datum gilt — bestimmt nur die Altersregel, nie das Format. */
export type GeburtKontext =
  /** Kunde schließt selbst einen Vertrag (Antrag alt/neu, Auskunft, Global): unter 18 und über 110 hart. */
  | "vertrag"
  /** Mitarbeiter/Leitung trägt laut Ausweis ein: unter 18 und ab 95 Rückfrage, über 110 hart. */
  | "akte"
  /** Ein Mensch weist sich aus (Passwort vergessen, Kündigung): nur Kalender und 1900 bis heute. */
  | "pruefung"
  /** Mitarbeiterverträge: unter 16 hart, über 100 hart. */
  | "mitarbeiter";

export type GeburtStand =
  | "leer" | "unvollstaendig" | "ungueltig" | "zukunft" | "zu_alt" | "zu_jung"
  /** Ein echtes Datum, das eine Rückfrage braucht („stimmt das?“) — mit Bestätigung speicherbar. */
  | "pruefen"
  | "ok";

/** Die drei Felder, wie getippt (Text, ohne Auffüllen). */
export interface GeburtTeile { tag: string; monat: string; jahr: string }

export interface GeburtErgebnis {
  stand: GeburtStand;
  /** JJJJ-MM-TT, sobald es den Kalendertag gibt (auch bei zukunft/zu_jung/zu_alt/pruefen) — sonst null. */
  iso: string | null;
  tag: number | null;
  monat: number | null;
  /** Das vollständige, ggf. ergänzte Jahr. */
  jahr: number | null;
  alter: number | null;
  /** Ein zweistelliges Jahr wurde ergänzt („63“ → 1963) — die Oberfläche zeigt das sichtbar. */
  jahrErgaenzt: boolean;
  /** Erklärung für Mensch (neutral formuliert, passt zu Sie- und du-Seiten); "" bei ok. */
  meldung: string;
  /** „17.11.1963“ — immer vierstellig; "" ohne Kalendertag. */
  anzeige: string;
  /** „17. November 1963“; "" ohne Kalendertag. */
  lang: string;
  /** Welches Feld die Meldung betrifft (für den Rahmen um das Feld). */
  feld: "tag" | "monat" | "jahr" | null;
}

export const GEBURT_MONATE = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"] as const;

/** Die Sätze an einer Stelle — auch für die Wortwand (scripts/pruef-wortwand-de.ts). Keine Anrede (du/Sie): Sie stehen auf Kunden- und Office-Seiten. */
export const GEBURT_TEXTE = {
  leer: "Bitte das Geburtsdatum eintragen (TT.MM.JJJJ).",
  unvollstaendig: "Bitte Tag, Monat und Jahr vollständig eintragen (z. B. 14.03.1963).",
  jahrVierstellig: "Bitte das Jahr vierstellig eintragen (z. B. 1963).",
  format: "Bitte als TT.MM.JJJJ eintragen (z. B. 14.03.1963).",
  monat: "Diesen Monat gibt es nicht – bitte 01 bis 12 eintragen.",
  tag: "Diesen Tag gibt es nicht – bitte Tag und Monat prüfen.",
  vor1900: "Das Jahr muss nach 1900 liegen (z. B. 1963).",
  zukunft: "Dieses Datum liegt in der Zukunft – bitte das Jahr prüfen.",
  zuAlt: (alter: number) => `Danach wäre die Person ${alter} Jahre alt – bitte das Jahr prüfen.`,
  vertragJung: "Den Vertrag kann nur abschließen, wer mindestens 18 Jahre alt ist.",
  mitarbeiterJung: "Danach wäre die Person jünger als 16 Jahre – bitte das Jahr prüfen.",
  rueckfrage: (alter: number) => `Danach wäre die Person ${alter} Jahre alt – stimmt das?`,
  bestaetigtZusatz: "bestätigt",
  jahrErgaenztZusatz: (zwei: string, voll: number) => `„${zwei}“ als ${voll} gelesen`,
  /** Server: Löschen ist der Leitung vorbehalten. */
  nurLeitungLoescht: "Ein Geburtsdatum entfernen kann nur die Leitung. Korrigieren geht jederzeit.",
  /** Akte (Gegenprüfung 08.10.): eine Bestellung mit anderem Namen an derselben Person — evtl. zwei Menschen. */
  fremderName: "Achtung: Eine Bestellung trägt einen anderen Namen – womöglich zwei Menschen mit gemeinsamer E-Mail oder Telefonnummer. Nicht vereinheitlichen, sondern erst klären und die Personen trennen lassen.",
} as const;

// ── Berliner Kalendertag ───────────────────────────────────────────────────
let TAG_FORMAT: Intl.DateTimeFormat | null = null;
/** „JJJJ-MM-TT“ in Berlin — über formatToParts, nie über Number(format()). */
export function berlinHeuteIso(d: Date = new Date()): string {
  try {
    TAG_FORMAT ??= new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" });
    const t: Record<string, string> = {};
    for (const p of TAG_FORMAT.formatToParts(d)) t[p.type] = p.value;
    if (/^\d{4}$/.test(t.year ?? "") && /^\d{2}$/.test(t.month ?? "") && /^\d{2}$/.test(t.day ?? "")) return `${t.year}-${t.month}-${t.day}`;
  } catch { /* ohne Intl-Zeitzonen: Rückfall unten */ }
  return d.toISOString().slice(0, 10);
}

// ── Kalender in Zahlen ─────────────────────────────────────────────────────
export function istSchaltjahr(j: number): boolean { return (j % 4 === 0 && j % 100 !== 0) || j % 400 === 0; }
export function tageImMonat(j: number, m: number): number {
  return m === 2 ? (istSchaltjahr(j) ? 29 : 28) : [4, 6, 9, 11].includes(m) ? 30 : 31;
}
const zwei = (n: number) => String(n).padStart(2, "0");
function isoAus(j: number, m: number, t: number): string { return `${String(j).padStart(4, "0")}-${zwei(m)}-${zwei(t)}`; }

/** Volle Jahre am Stichtag (beide JJJJ-MM-TT). Wer heute Geburtstag hat, ist heute ein Jahr älter. */
export function alterAm(geburtIso: string, stichtagIso: string): number {
  const [gj, gm, gt] = geburtIso.slice(0, 10).split("-").map(Number);
  const [hj, hm, ht] = stichtagIso.slice(0, 10).split("-").map(Number);
  return hj - gj - (hm < gm || (hm === gm && ht < gt) ? 1 : 0);
}

/**
 * Ein zweistelliges Jahr wird vierstellig: das Jahrhundert, in dem der Mensch
 * heute mindestens 16 ist. 2026: „10“ → 2010, „11“ → 1911, „63“ → 1963.
 */
export function jahrErgaenzen(zweistellig: number, heuteIso: string): number {
  const heuteJahr = Number(heuteIso.slice(0, 4));
  const kandidat = Math.floor(heuteJahr / 100) * 100 + zweistellig;
  return kandidat > heuteJahr - 16 ? kandidat - 100 : kandidat;
}

const MONAT_NAMEN: Record<string, number> = {
  jan: 1, januar: 1, jaenner: 1, jänner: 1, feb: 2, februar: 2, mar: 3, mär: 3, maer: 3, märz: 3, maerz: 3, apr: 4, april: 4,
  mai: 5, jun: 6, juni: 6, jul: 7, juli: 7, aug: 8, august: 8, sep: 9, sept: 9, september: 9, okt: 10, oktober: 10,
  nov: 11, november: 11, dez: 12, dezember: 12,
};
function monatAusName(s: string): number | null {
  const k = s.toLowerCase().replace(/\.$/, "");
  return MONAT_NAMEN[k] ?? null;
}

/** Aus irgendeiner Eingabe die drei Teile als Text — oder ein Formfehler. */
function zerlegen(roh: unknown): { teile: GeburtTeile } | { fehler: "leer" | "format" | "unvollstaendig" } {
  if (roh == null) return { fehler: "leer" };
  if (typeof roh === "object" && !(roh instanceof Date)) {
    const o = roh as Partial<Record<keyof GeburtTeile, unknown>>;
    const t = { tag: String(o.tag ?? "").trim(), monat: String(o.monat ?? "").trim(), jahr: String(o.jahr ?? "").trim() };
    if (!t.tag && !t.monat && !t.jahr) return { fehler: "leer" };
    // Ein Monatsname im Monatsfeld („März“) ist erlaubt.
    if (t.monat && !/^\d+$/.test(t.monat)) { const n = monatAusName(t.monat); if (n) t.monat = String(n); }
    return { teile: t };
  }
  if (roh instanceof Date) {
    if (Number.isNaN(roh.getTime())) return { fehler: "format" };
    const s = roh.toISOString().slice(0, 10);
    return { teile: { jahr: s.slice(0, 4), monat: s.slice(5, 7), tag: s.slice(8, 10) } };
  }
  const s = String(roh).trim();
  if (!s) return { fehler: "leer" };
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T ].*)?$/);
  if (m) return { teile: { jahr: m[1], monat: m[2], tag: m[3] } };
  m = s.match(/^(\d{1,2})\s*[.\s]\s*([A-Za-zÄÖÜäöü]{3,9}\.?)\s*(\d{0,4})$/);
  if (m) {
    const n = monatAusName(m[2]);
    return n ? { teile: { tag: m[1], monat: String(n), jahr: m[3] } } : { fehler: "format" };
  }
  m = s.match(/^(\d{1,2})\s*[./\-\s,]\s*(\d{1,2})\s*(?:[./\-\s,]\s*(\d{0,4}))?\s*\.?$/);
  if (m) return { teile: { tag: m[1], monat: m[2], jahr: m[3] ?? "" } };
  if (/^\d+$/.test(s)) {
    if (s.length === 8) {
      // TTMMJJJJ; passt das nicht, aber JJJJMMTT (19630314), dann so.
      const tt = Number(s.slice(0, 2)), mm = Number(s.slice(2, 4));
      const j2 = Number(s.slice(0, 4)), m2 = Number(s.slice(4, 6)), t2 = Number(s.slice(6, 8));
      const ttmm = mm >= 1 && mm <= 12 && tt >= 1 && tt <= 31;
      if (!ttmm && j2 >= 1900 && m2 >= 1 && m2 <= 12 && t2 >= 1 && t2 <= 31) return { teile: { jahr: s.slice(0, 4), monat: s.slice(4, 6), tag: s.slice(6, 8) } };
      return { teile: { tag: s.slice(0, 2), monat: s.slice(2, 4), jahr: s.slice(4, 8) } };
    }
    if (s.length === 6) return { teile: { tag: s.slice(0, 2), monat: s.slice(2, 4), jahr: s.slice(4, 6) } };
    // 1–5 oder 7 Ziffern: noch nicht fertig getippt (oder ein Jahr mit drei Stellen).
    return s.length < 8 ? { fehler: "unvollstaendig" } : { fehler: "format" };
  }
  return { fehler: "format" };
}

function leeresErgebnis(stand: GeburtStand, meldung: string, feld: GeburtErgebnis["feld"]): GeburtErgebnis {
  return { stand, iso: null, tag: null, monat: null, jahr: null, alter: null, jahrErgaenzt: false, meldung, anzeige: "", lang: "", feld };
}

/**
 * DER EINE LESER. Nimmt Text („14.3.63“, „1963-03-14“ …), die drei Felder
 * ({tag, monat, jahr}) oder ein Date und sagt, was es ist.
 */
export function geburtsdatumLesen(roh: unknown, kontext: GeburtKontext = "akte", heuteIso: string = berlinHeuteIso()): GeburtErgebnis {
  const z = zerlegen(roh);
  if ("fehler" in z) {
    return z.fehler === "leer" ? leeresErgebnis("leer", GEBURT_TEXTE.leer, "tag")
      : z.fehler === "unvollstaendig" ? leeresErgebnis("unvollstaendig", GEBURT_TEXTE.unvollstaendig, "jahr")
      : leeresErgebnis("ungueltig", GEBURT_TEXTE.format, "tag");
  }
  const { tag: tRoh, monat: mRoh, jahr: jRoh } = z.teile;
  if (!/^\d{0,2}$/.test(tRoh) || !/^\d{0,2}$/.test(mRoh) || !/^\d{0,4}$/.test(jRoh)) return leeresErgebnis("ungueltig", GEBURT_TEXTE.format, !/^\d{0,2}$/.test(tRoh) ? "tag" : !/^\d{0,2}$/.test(mRoh) ? "monat" : "jahr");
  if (!tRoh) return leeresErgebnis("unvollstaendig", GEBURT_TEXTE.unvollstaendig, "tag");
  if (!mRoh) return leeresErgebnis("unvollstaendig", GEBURT_TEXTE.unvollstaendig, "monat");
  const t = Number(tRoh), m = Number(mRoh);
  if (m < 1 || m > 12) return leeresErgebnis("ungueltig", GEBURT_TEXTE.monat, "monat");
  if (t < 1 || t > 31) return leeresErgebnis("ungueltig", GEBURT_TEXTE.tag, "tag");
  if (jRoh.length !== 2 && jRoh.length !== 4) {
    return leeresErgebnis("unvollstaendig", jRoh.length === 3 ? GEBURT_TEXTE.jahrVierstellig : GEBURT_TEXTE.unvollstaendig, "jahr");
  }
  const jahrErgaenzt = jRoh.length === 2;
  const j = jahrErgaenzt ? jahrErgaenzen(Number(jRoh), heuteIso) : Number(jRoh);
  if (j < 1900) return { ...leeresErgebnis("ungueltig", GEBURT_TEXTE.vor1900, "jahr"), tag: t, monat: m, jahr: j };
  if (t > tageImMonat(j, m)) return { ...leeresErgebnis("ungueltig", GEBURT_TEXTE.tag, "tag"), monat: m, jahr: j };

  const iso = isoAus(j, m, t);
  const alter = alterAm(iso, heuteIso);
  const basis: GeburtErgebnis = {
    stand: "ok", iso, tag: t, monat: m, jahr: j, alter, jahrErgaenzt, meldung: "", feld: null,
    anzeige: `${zwei(t)}.${zwei(m)}.${j}`, lang: `${t}. ${GEBURT_MONATE[m - 1]} ${j}`,
  };
  const mit = (stand: GeburtStand, meldung: string): GeburtErgebnis => ({ ...basis, stand, meldung, feld: "jahr" });
  if (iso > heuteIso) return mit("zukunft", GEBURT_TEXTE.zukunft);
  switch (kontext) {
    case "pruefung":
      return basis;
    case "vertrag":
      if (alter > 110) return mit("zu_alt", GEBURT_TEXTE.zuAlt(alter));
      if (alter < 18) return mit("zu_jung", GEBURT_TEXTE.vertragJung);
      return basis;
    case "mitarbeiter":
      if (alter > 100) return mit("zu_alt", GEBURT_TEXTE.zuAlt(alter));
      if (alter < 16) return mit("zu_jung", GEBURT_TEXTE.mitarbeiterJung);
      return basis;
    case "akte":
    default:
      if (alter > 110) return mit("zu_alt", GEBURT_TEXTE.zuAlt(alter));
      if (alter < 18 || alter >= 95) return mit("pruefen", GEBURT_TEXTE.rueckfrage(alter));
      return basis;
  }
}

/** Darf das Ergebnis gespeichert werden? ok immer, „pruefen“ nur mit Bestätigung. */
export function geburtSpeicherbar(e: Pick<GeburtErgebnis, "stand">, bestaetigt = false): boolean {
  return e.stand === "ok" || (e.stand === "pruefen" && bestaetigt);
}

export type GeburtSpeicher =
  | { ok: true; aenderung: "keine" }
  | { ok: true; aenderung: "setzen"; iso: string; ergebnis: GeburtErgebnis }
  | { ok: true; aenderung: "loeschen" }
  | { ok: false; stand: GeburtStand; fehler: string; rueckfrage: boolean };

/**
 * FÜR JEDEN SCHREIBWEG IM SERVER. "" und null heißen „keine Änderung“ — eine
 * halb geleerte Eingabe löscht nie einen gespeicherten Wert. Gelöscht wird nur
 * ausdrücklich ({ loeschen: true }) und nur, wo die Route das der Leitung erlaubt.
 */
export function geburtsdatumFuerSpeicher(
  roh: unknown,
  kontext: GeburtKontext,
  opt: { bestaetigt?: boolean; loeschen?: boolean; heuteIso?: string } = {},
): GeburtSpeicher {
  if (opt.loeschen) return { ok: true, aenderung: "loeschen" };
  if (roh === undefined || roh === null || (typeof roh === "string" && roh.trim() === "")) return { ok: true, aenderung: "keine" };
  const e = geburtsdatumLesen(roh, kontext, opt.heuteIso ?? berlinHeuteIso());
  if (e.stand === "leer") return { ok: true, aenderung: "keine" };
  if (geburtSpeicherbar(e, !!opt.bestaetigt) && e.iso) return { ok: true, aenderung: "setzen", iso: e.iso, ergebnis: e };
  return { ok: false, stand: e.stand, fehler: e.meldung || GEBURT_TEXTE.format, rueckfrage: e.stand === "pruefen" };
}

/**
 * Ein gespeicherter Wert als JJJJ-MM-TT — oder null. Reine Textumformung für
 * Vergleiche (Identifikation, Abweichung Person/Bestellung); prüft den
 * Kalendertag, aber keine Altersregel.
 */
export function geburtsdatumIso(wert: unknown): string | null {
  if (wert == null || wert === "") return null;
  // Gegenprüfung 08.10.: mit dem echten Berliner Tag — mit „9999-12-31“ wurde aus
  // „17.11.63“ das Jahr 9963. Ein Datum in der Zukunft behält sein iso (Stand „zukunft“).
  const e = geburtsdatumLesen(wert, "pruefung");
  return e.iso;
}

/** Für die Anzeige: „17.11.1963“ — immer vierstellig. Leer → "". Unlesbares bleibt sichtbar, wie es steht. */
export function geburtsdatumAnzeige(wert: unknown): string {
  if (wert == null || wert === "") return "";
  const iso = geburtsdatumIso(wert);
  if (!iso) return String(wert).trim();
  return `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`;
}

/** „17. November 1963“ — leer → "". */
export function geburtsdatumLang(wert: unknown): string {
  const iso = geburtsdatumIso(wert);
  if (!iso) return wert == null ? "" : String(wert).trim();
  return `${Number(iso.slice(8, 10))}. ${GEBURT_MONATE[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;
}

/** „17.11.1963 · 62 Jahre“ für Akten. */
export function geburtsdatumMitAlter(wert: unknown, heuteIso: string = berlinHeuteIso()): string {
  const iso = geburtsdatumIso(wert);
  if (!iso) return geburtsdatumAnzeige(wert);
  const a = alterAm(iso, heuteIso);
  return `${geburtsdatumAnzeige(iso)} · ${a} ${a === 1 ? "Jahr" : "Jahre"}`;
}

/** Ein gespeichertes Datum in die drei Felder („1963-03-14“ → 14 · 03 · 1963). */
export function geburtTeileAus(wert: unknown): GeburtTeile {
  const iso = geburtsdatumIso(wert);
  return iso ? { tag: iso.slice(8, 10), monat: iso.slice(5, 7), jahr: iso.slice(0, 4) } : { tag: "", monat: "", jahr: "" };
}

/**
 * Freie Eingabe (Einfügen, Autofill „bday“, getippt mit Trennzeichen) → die
 * drei Felder, Tag und Monat zweistellig. null, wenn nichts Lesbares darin steht.
 */
export function geburtTeileAusEingabe(text: string): GeburtTeile | null {
  const z = zerlegen(text);
  if ("fehler" in z) return null;
  const t = z.teile;
  return { tag: t.tag ? t.tag.padStart(2, "0") : "", monat: t.monat ? t.monat.padStart(2, "0") : "", jahr: t.jahr };
}

/**
 * Für Formulare, die das Datum als TEXT halten (Entwürfe, Vertragsvariablen):
 * drei Felder → Text. Mit vierstelligem Jahr und echtem Tag JJJJ-MM-TT, sonst
 * „TT.MM.JJ…“ genau wie getippt (ein halbes Jahr wie „19“ bleibt „19“ — sonst
 * würde es beim Weitertippen zu 2019 umgeschrieben), alles leer → "".
 */
export function geburtTextAusTeile(t: GeburtTeile): string {
  if (!t.tag && !t.monat && !t.jahr) return "";
  if (t.jahr.length === 4) {
    const e = geburtsdatumLesen(t, "pruefung", "9999-12-31");
    if (e.iso) return e.iso;
  }
  return `${t.tag}.${t.monat}.${t.jahr}`;
}

/** …und zurück: JJJJ-MM-TT oder „TT.MM.JJJJ“ (auch halb getippt) → die drei Felder. */
export function geburtTeileAusText(v: string): GeburtTeile {
  const s = String(v ?? "").trim();
  if (!s) return { tag: "", monat: "", jahr: "" };
  if (/^\d{4}-\d{1,2}-\d{1,2}/.test(s)) return geburtTeileAus(s);
  const [tag = "", monat = "", jahr = ""] = s.split(".");
  return { tag: tag.replace(/\D/g, "").slice(0, 2), monat: monat.replace(/\D/g, "").slice(0, 2), jahr: jahr.replace(/\D/g, "").slice(0, 4) };
}

/** Die Zeile unter dem Feld: zum Gegenlesen „17. November 1963 · 62 Jahre“ (+ Ergänzungshinweis) — oder die Meldung. */
export function geburtRuecklesen(e: GeburtErgebnis, bestaetigt = false): string {
  if (!e.iso) return e.meldung;
  const alter = e.alter != null ? ` · ${e.alter} ${e.alter === 1 ? "Jahr" : "Jahre"}` : "";
  if (e.stand === "ok" || (e.stand === "pruefen" && bestaetigt)) {
    return `${e.lang}${alter}${e.stand === "pruefen" ? ` · ${GEBURT_TEXTE.bestaetigtZusatz}` : ""}`;
  }
  return e.meldung;
}

// ── WER DARF DAS GEBURTSDATUM DER PERSON ÄNDERN? (Gegenprüfung 08.10.) ────────
/**
 * Das öffentliche Antragsformular (POST /application) schreibt grundsätzlich
 * NUR seine eigene Bestellung. Eine Person kann über eine gemeinsame E-Mail-
 * oder Telefonnummer zwei Menschen tragen (gemessen 08.10.: 17 Personen mit
 * verschiedenen Vornamen), und das Datum dient zur Identifikation (Kündigung,
 * Passwort-Reset, Auskunft). Eine einzige Ausnahme lässt die eigene Korrektur
 * eines neuen Antragstellers an der Person ankommen, damit ein Tippfehler im
 * Antrag nicht als „Geburtsdatum weicht ab“ in der Akte stehen bleibt:
 *   · diese Bestellung ist die EINZIGE lebende Bestellung der Person,
 *   · sie ist noch nicht bezahlt (kein bestehender Kunde),
 *   · und ihr Name passt zur Person.
 * Sonst bleibt die Akte stehen: Der Mitarbeiter wählt laut Ausweis.
 * Person und alle Bestellungen zusammen schreibt sonst nur der Mitarbeiter-
 * und Leitungsweg (server/lib/fiaon-geburtsdatum-akte.ts, geburtsdatumSetzen).
 */
export function antragKorrigiertPerson(lage: { lebendeBestellungen: number; bezahlt: boolean; namePasst: boolean }): boolean {
  return lage.lebendeBestellungen === 1 && !lage.bezahlt && lage.namePasst;
}
