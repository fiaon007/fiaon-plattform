// ═══════════════════════════════════════════════════════════════════════════
// TIEFENANALYSE DES KONTOAUSZUGS (21.09.2026, E-207)
//
// Justin: „Ich muss EXAKT sehen — WAS VERDIENT ER WANN? WANN GIBT ER WIE VIEL
// UND WARUM WO AUS? WAS SIND SEINE HÖCHSTEN KOSTENPUNKTE? WAS KANN MAN SOFORT
// OPTIMIEREN?"
//
// ── DIE REGEL ─────────────────────────────────────────────────────────────
// Alles hier ist RECHNUNG auf den gelesenen und bereinigten Buchungen
// (fiaon-kontoauszug-bereinigen.ts) — kein Modellaufruf, nichts geschätzt,
// was nicht als Schätzung dasteht. Jede Zahl lässt sich bis auf die einzelne
// Buchung zurückverfolgen (`termine` an jedem Posten). Dieselbe Funktion
// rechnet im Browser (Akte, Telefonkartei) und im Prüfstand.
//
// ── WAS ZUSAMMENGEHÖRT ────────────────────────────────────────────────────
// Das Modell schreibt die Gegenpartei kurz („Telefonica Germany", „PAYPAL
// EUROPE"). Posten entstehen über einen Schlüssel: bekannte Marken zuerst
// (Netflix, Klarna, Toto-Lotto …), bei Zahldiensten (PayPal, SumUp …) der
// Händler aus dem Zweck, bei Privatpersonen die Kategorie (Miete an eine
// Privatperson ist etwas anderes als Taschengeld), sonst die ersten Wörter
// des Namens ohne Rechtsform.
// ═══════════════════════════════════════════════════════════════════════════
import { KATEGORIEN, istFest } from "./fiaon-kontoauszug-kategorien";
import { EINKOMMEN_KATEGORIEN, NEUTRAL } from "./fiaon-kontoauszug-bereinigen";
import { flachText, markeIn, GENERISCHE_GEGENPARTEI, type Markentyp } from "./fiaon-kontoauszug-marken";

export { markeIn };

export interface TiefeBuchung {
  datum: string;
  betragCents: number;
  empfaenger: string;
  zweck: string;
  kategorie: string;
  wiederkehrend?: boolean;
  saldoDanachCents?: number | null;
  korrektur?: string;
}

export interface Termin { datum: string; betragCents: number; zweck: string; korrektur?: string }

export interface Posten {
  schluessel: string;
  name: string;
  /** Häufigste Kategorie der Buchungen dieses Postens. */
  kategorie: string;
  kategorieLabel: string;
  gruppe: string;
  typ: Markentyp | null;
  /** Betrag immer positiv (Ausgaben als Betrag, nicht mit Minus). */
  summeCents: number;
  jeMonatCents: number;
  anzahl: number;
  /** Monat (YYYY-MM) → Betrag. */
  monate: Record<string, number>;
  rhythmus: string;
  monatlich: boolean;
  tagImMonat: number | null;
  ersteAm: string;
  letzteAm: string;
  groessteCents: number;
  /** Der übliche Einzelbetrag (Median) — bei einem Abo der Monatspreis. */
  typischCents: number;
  /** Letzte Buchung höchstens 40 Tage vor Ende des Auszugs — läuft noch. */
  aktiv: boolean;
  /** Der häufigste Verwendungszweck — das „Warum" neben der Kategorie. */
  zweck: string;
  fest: boolean;
  /** Anteil am Einkommen je Monat (0–1), wenn ein Einkommen belegt ist. */
  anteilEinkommen: number | null;
  termine: Termin[];
}

export interface Tipp {
  art: string;
  titel: string;
  text: string;
  /** Was der Punkt im Monat kostet (Durchschnitt über den Zeitraum). */
  jeMonatCents: number;
  /** true = ließe sich ganz vermeiden (Gebühren, Zinsen, Wetten). */
  vermeidbar: boolean;
  /** true = nur zur Einordnung, kein Handlungspunkt. */
  hinweis: boolean;
  posten: string[];
  /** Wie oft es vorkam, wo der Betrag nichts sagt (Rücklastschriften ohne Gebühr). */
  anzahl?: number;
}

export interface Monatszeile {
  monat: string;
  /** false = der Auszug deckt den Monat nur zum Teil ab. */
  voll: boolean;
  einkommenCents: number;
  weitereCents: number;
  festCents: number;
  variabelCents: number;
  freiCents: number;
  tiefsterSaldoCents: number | null;
  tiefsterSaldoAm: string | null;
}

export interface Tiefe {
  zeitraum: { von: string; bis: string; tage: number; monatsFaktor: number; monate: string[] };
  buchungen: number;
  kennzahlen: {
    einkommenJeMonatCents: number;
    weitereJeMonatCents: number;
    ausgabenJeMonatCents: number;
    festJeMonatCents: number;
    variabelJeMonatCents: number;
    freiJeMonatCents: number;
    umbuchungenEinCents: number;
    umbuchungenAusCents: number;
    vermeidbarJeMonatCents: number;
  };
  einkommen: Posten[];
  weitereEingaenge: Posten[];
  ausgaben: Posten[];
  gruppen: { name: string; summeCents: number; jeMonatCents: number; anteil: number; monate: Record<string, number>; posten: number }[];
  kostenpunkte: Posten[];
  groessteZahlungen: (Termin & { name: string; kategorieLabel: string })[];
  monatsverlauf: Monatszeile[];
  zahltag: { tag: number; quelle: string; text: string } | null;
  tipps: Tipp[];
}

const RECHTSFORM = new Set(["gmbh", "mbh", "ag", "kg", "ohg", "gbr", "ev", "e", "v", "se", "ltd", "limited", "inc", "llc", "sarl", "s", "a", "r", "l", "sa", "bv",
  "nv", "uab", "ab", "as", "asa", "oy", "spa", "srl", "plc", "co", "und", "and", "the", "der", "die", "das", "fuer", "von", "deutschland", "germany", "europe",
  "eu", "international", "payments", "payment", "services", "service", "online", "digital", "holding", "group", "gruppe", "zweigniederlassung", "filiale", "fil"]);
/** Ist das erste Wort zu allgemein, gehört das zweite dazu („Stadtwerke Hannover" ≠ „Stadtwerke München"). */
const ALLGEMEINES_ERSTWORT = new Set(["deutsche", "stadt", "stadtwerke", "landeshauptstadt", "kreis", "landkreis", "gemeinde", "sparkasse", "kreissparkasse",
  "stadtsparkasse", "volksbank", "raiffeisenbank", "vr", "vb", "bundesagentur", "amtsgericht", "autohaus", "auto", "apotheke", "praxis", "dr", "kanzlei",
  "restaurant", "cafe", "baeckerei", "hotel", "hausverwaltung", "wohnungsbau", "wohnungsgesellschaft", "immobilien", "tankstelle", "kiosk", "tabak", "friseur",
  "sb", "evangelische", "katholische", "st", "sankt", "allgemeine", "neue", "erste", "haus", "zahnarzt", "physio"]);

function nameSchluessel(empfaenger: string): string {
  const woerter = flachText(empfaenger).split(" ").filter((w) => w.length >= 2 && !/^\d+$/.test(w) && !RECHTSFORM.has(w));
  if (!woerter.length) return "";
  if (woerter[0].length >= 4 && !ALLGEMEINES_ERSTWORT.has(woerter[0])) return woerter[0];
  return woerter.slice(0, 2).join(" ");
}

interface Zuordnung { schluessel: string; name: string | null; typ: Markentyp | null }

/** Wohin gehört eine Buchung? Marke vor Zahldienst vor Name; generische Gegenparteien nach Kategorie. */
export function zuordnen(b: Pick<TiefeBuchung, "empfaenger" | "zweck" | "kategorie">): Zuordnung {
  const gegen = flachText(b.empfaenger);
  const ausName = markeIn(b.empfaenger);
  if (ausName && ausName.typ !== "zahldienst") return { schluessel: `m:${ausName.name}`, name: ausName.name, typ: ausName.typ };
  const generisch = GENERISCHE_GEGENPARTEI.has(gegen) || gegen === flachText(KATEGORIEN[b.kategorie]?.label ?? "");
  if (ausName || generisch) {
    // Zahldienst oder nichtssagende Gegenpartei: Der Händler steht oft im Zweck.
    const ausZweck = markeIn(b.zweck);
    if (ausZweck && ausZweck.typ !== "zahldienst") return { schluessel: `m:${ausZweck.name}`, name: ausZweck.name, typ: ausZweck.typ };
    if (ausName) {
      // PayPal schreibt den Händler oft aus: „… Ihr Einkauf bei J.P. Morgan Mobility Payments …".
      const haendler = haendlerAusZweck(b.zweck);
      if (haendler) return { schluessel: `h:${flachText(haendler)}`, name: `${haendler} (über ${ausName.name})`, typ: null };
      return { schluessel: `m:${ausName.name}`, name: `${ausName.name} (ohne Händlerangabe)`, typ: "zahldienst" };
    }
    const label = KATEGORIEN[b.kategorie]?.label ?? "Buchung";
    return gegen === "privatperson" || gegen === ""
      ? { schluessel: `p:${b.kategorie}`, name: `Privatperson · ${label}`, typ: null }
      : { schluessel: `g:${b.kategorie}`, name: label, typ: null };
  }
  const k = nameSchluessel(b.empfaenger);
  return { schluessel: k ? `n:${k}` : `g:${b.kategorie}`, name: null, typ: null };
}

/** „Ihr Einkauf bei XY GmbH" → „XY" (höchstens drei Wörter, ohne Rechtsform). */
function haendlerAusZweck(zweck: string): string | null {
  const m = String(zweck || "").match(/(?:ihr einkauf bei|einkauf bei|purchase at|zahlung an)\s+([^,;/]{2,60})/i);
  if (!m) return null;
  const woerter = m[1].replace(/[.]/g, " ").split(/\s+/)
    .filter((w) => w.length >= 2 && !RECHTSFORM.has(flachText(w)) && !/\d{3,}/.test(w) && flachText(w) !== "pp");
  const name = woerter.slice(0, 3).join(" ").trim();
  return name.length >= 2 ? name : null;
}

// ───────────────────────────────────────────────────────────────────────────
// Kleine Rechenhelfer
// ───────────────────────────────────────────────────────────────────────────
function median(z: number[]): number {
  const s = [...z].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
function tagesZahl(iso: string): number { return Math.floor(Date.parse(`${iso}T12:00:00Z`) / 86_400_000); }
function monateZwischen(von: string, bis: string): string[] {
  const aus: string[] = [];
  let [j, m] = [Number(von.slice(0, 4)), Number(von.slice(5, 7))];
  const [jb, mb] = [Number(bis.slice(0, 4)), Number(bis.slice(5, 7))];
  for (let i = 0; i < 36 && (j < jb || (j === jb && m <= mb)); i++) {
    aus.push(`${j}-${String(m).padStart(2, "0")}`);
    m++; if (m > 12) { m = 1; j++; }
  }
  return aus;
}
function monatsLetzter(monat: string): string {
  const [j, m] = [Number(monat.slice(0, 4)), Number(monat.slice(5, 7))];
  return `${monat}-${String(new Date(Date.UTC(j, m, 0)).getUTCDate()).padStart(2, "0")}`;
}
export function eur(c: number): string {
  return `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
export function eurRund(c: number): string {
  return `${Math.round(c / 100).toLocaleString("de-DE")} €`;
}
function datumDe(iso: string): string { return iso.split("-").reverse().join("."); }
function aufzaehlen(namen: string[], hoechstens = 4): string {
  const n = namen.filter(Boolean);
  if (n.length <= hoechstens) return n.length > 1 ? `${n.slice(0, -1).join(", ")} und ${n[n.length - 1]}` : (n[0] ?? "");
  return `${n.slice(0, hoechstens).join(", ")} und ${n.length - hoechstens} weitere`;
}
function haeufigster<T>(werte: T[]): T | null {
  const zaehler = new Map<T, number>();
  for (const w of werte) zaehler.set(w, (zaehler.get(w) ?? 0) + 1);
  let best: T | null = null, n = 0;
  zaehler.forEach((k, w) => { if (k > n) { best = w; n = k; } });
  return best;
}
/** Zweck ohne Buchungsart, Referenz-, Kunden- und Kartennummern — das, was ein Mensch „Zweck" nennt. */
export function zweckKurz(z: string): string {
  return String(z || "")
    .replace(/^\s*(sepa[- ]?)?(echtzeit)?(ueberweisung|überweisung|lastschrift|basislastschrift|folgelastschrift|erstlastschrift|gutschrift|kartenzahlung|dauerauftrag|kartenumsatz)\s*[/:|-]?\s*/i, "")
    .replace(/\b(mref|mandat\w*|cred|gl(ae|ä)ubiger\w*|end\s?to\s?end|eref|kref|iban|bic|ref\.?|referenz|othr|sonst\.?\s*transakt\.?)\b[:\s]*[\w./-]*/gi, " ")
    .replace(/\b(kd|ku|kunden|rg|re|rech|rechnungs|vertrags|beleg|konto|vorgangs|auftrags|steuer)[- .]?(nr|nummer)\b\.?:?\s*[\w./-]*/gi, " ")
    .replace(/\bkarte:?\s*[*x\d]{4,}\b|\*{2,}\d+/gi, " ")
    .replace(/\b[A-Z0-9]{12,}\b/g, " ")
    .replace(/\b\d{5,}\b/g, " ")
    .replace(/(\s*[,/:;|]\s*){2,}/g, " / ")
    .replace(/^[\s,/:;|.-]+|[\s,/:;|-]+$/g, "")
    .replace(/\s{2,}/g, " ").trim().slice(0, 70);
}
/** Wie oft und wann — in Worten. */
function rhythmusAus(termine: Termin[], monateImZeitraum: number, monatsFaktor: number, wiederkehrend: boolean): { text: string; monatlich: boolean; tag: number | null } {
  const n = termine.length;
  const monate = new Set(termine.map((t) => t.datum.slice(0, 7))).size;
  const tag = n ? median(termine.map((t) => Number(t.datum.slice(8, 10)))) : null;
  if (n === 1) {
    return wiederkehrend
      ? { text: `wiederkehrend, am ${Number(termine[0].datum.slice(8, 10))}.`, monatlich: true, tag }
      : { text: `einmal, am ${datumDe(termine[0].datum)}`, monatlich: false, tag: null };
  }
  const jeMonat = n / Math.max(1, monate);
  if (monate >= 2 && jeMonat <= 1.25 && monate >= Math.max(2, Math.round(monateImZeitraum * 0.6))) {
    return { text: `monatlich, meist um den ${tag}.`, monatlich: true, tag };
  }
  if (monate === 1 && n <= 2 && wiederkehrend) return { text: `wiederkehrend, um den ${tag}.`, monatlich: true, tag };
  const proMonat = n / Math.max(1, monatsFaktor);
  if (proMonat >= 1.8) return { text: `${proMonat.toLocaleString("de-DE", { maximumFractionDigits: 1 })}× im Monat`, monatlich: false, tag: null };
  return { text: `${n}× im Zeitraum`, monatlich: false, tag: null };
}

// ───────────────────────────────────────────────────────────────────────────
// DIE RECHNUNG
// ───────────────────────────────────────────────────────────────────────────
export function tiefenanalyse(roh: TiefeBuchung[], kopf: { zeitraumVon?: string | null; zeitraumBis?: string | null } = {}): Tiefe | null {
  const ISO = /^\d{4}-\d{2}-\d{2}$/;
  const alle = (roh || []).filter((b) => b && ISO.test(String(b.datum)) && Number.isFinite(Number(b.betragCents)) && Number(b.betragCents) !== 0)
    .map((b) => ({ ...b, betragCents: Math.round(Number(b.betragCents)), empfaenger: String(b.empfaenger ?? ""), zweck: String(b.zweck ?? ""), kategorie: String(b.kategorie ?? "") }));
  if (!alle.length) return null;

  // ── Zeitraum: der gedruckte, erweitert um Buchungen außerhalb ──────────
  const daten = alle.map((b) => b.datum).sort();
  let von = daten[0], bis = daten[daten.length - 1];
  if (kopf.zeitraumVon && ISO.test(kopf.zeitraumVon) && kopf.zeitraumVon < von) von = kopf.zeitraumVon;
  if (kopf.zeitraumBis && ISO.test(kopf.zeitraumBis) && kopf.zeitraumBis > bis) bis = kopf.zeitraumBis;
  const tage = tagesZahl(bis) - tagesZahl(von) + 1;
  const monatsFaktor = Math.max(1, tage / 30.4375);
  const monate = monateZwischen(von, bis);
  const jeMonat = (c: number) => Math.round(c / monatsFaktor);

  // ── Teilen: Einkommen, weitere Eingänge, Ausgaben, Umbuchungen ────────
  const neutral = alle.filter((b) => NEUTRAL.has(b.kategorie) || KATEGORIEN[b.kategorie]?.neutral);
  const zaehlend = alle.filter((b) => !(NEUTRAL.has(b.kategorie) || KATEGORIEN[b.kategorie]?.neutral));
  const einkommenB = zaehlend.filter((b) => b.betragCents > 0 && EINKOMMEN_KATEGORIEN.has(b.kategorie));
  const weitereB = zaehlend.filter((b) => b.betragCents > 0 && !EINKOMMEN_KATEGORIEN.has(b.kategorie));
  const ausgabenB = zaehlend.filter((b) => b.betragCents < 0);

  const summe = (l: { betragCents: number }[]) => l.reduce((s, b) => s + Math.abs(b.betragCents), 0);
  const einkommenJeMonat = jeMonat(summe(einkommenB));

  const postenBauen = (liste: typeof alle): Posten[] => {
    const gruppen = new Map<string, { z: Zuordnung; b: typeof alle }>();
    for (const b of liste) {
      const z = zuordnen(b);
      const g = gruppen.get(z.schluessel);
      if (g) g.b.push(b); else gruppen.set(z.schluessel, { z, b: [b] });
    }
    const aus: Posten[] = [];
    for (const [schluessel, { z, b }] of Array.from(gruppen.entries())) {
      const sortiert = [...b].sort((x, y) => x.datum.localeCompare(y.datum));
      const termine: Termin[] = sortiert.map((x) => ({ datum: x.datum, betragCents: Math.abs(x.betragCents), zweck: zweckKurz(x.zweck), ...(x.korrektur ? { korrektur: x.korrektur } : {}) }));
      const kategorie = haeufigster(sortiert.map((x) => x.kategorie)) ?? "sonstige_ausgabe";
      const kat = KATEGORIEN[kategorie];
      const summeCents = summe(sortiert);
      const monateMap: Record<string, number> = {};
      for (const t of termine) monateMap[t.datum.slice(0, 7)] = (monateMap[t.datum.slice(0, 7)] ?? 0) + t.betragCents;
      const wiederkehrend = sortiert.filter((x) => x.wiederkehrend).length >= sortiert.length / 2;
      const r = rhythmusAus(termine, monate.length, monatsFaktor, wiederkehrend);
      const name = z.name ?? (haeufigster(sortiert.map((x) => x.empfaenger.replace(/\s+/g, " ").trim()).filter(Boolean)) || kat?.label || "Buchung").slice(0, 48);
      const zweckeKurz = termine.map((t) => t.zweck).filter((x) => x.length >= 3);
      aus.push({
        schluessel, name, kategorie, kategorieLabel: kat?.label ?? "Buchung", gruppe: kat?.gruppe ?? "Sonstiges", typ: z.typ,
        summeCents, jeMonatCents: jeMonat(summeCents), anzahl: termine.length, monate: monateMap,
        rhythmus: r.text, monatlich: r.monatlich, tagImMonat: r.tag,
        ersteAm: termine[0].datum, letzteAm: termine[termine.length - 1].datum,
        groessteCents: Math.max(...termine.map((t) => t.betragCents)),
        typischCents: median(termine.map((t) => t.betragCents)),
        aktiv: tagesZahl(bis) - tagesZahl(termine[termine.length - 1].datum) <= 40,
        zweck: haeufigster(zweckeKurz) ?? "",
        fest: sortiert.some((x) => x.betragCents < 0) && istFest(kategorie, wiederkehrend),
        anteilEinkommen: einkommenJeMonat > 0 ? jeMonat(summeCents) / einkommenJeMonat : null,
        termine,
      });
    }
    return aus.sort((a, b) => b.summeCents - a.summeCents);
  };

  const einkommen = postenBauen(einkommenB);
  const weitereEingaenge = postenBauen(weitereB);
  const ausgaben = postenBauen(ausgabenB);

  // ── Gruppen (Wofür) mit Monatsverlauf ─────────────────────────────────
  const gesamtAus = summe(ausgabenB);
  const gruppenMap = new Map<string, { summeCents: number; monate: Record<string, number>; posten: Set<string> }>();
  for (const b of ausgabenB) {
    const g = KATEGORIEN[b.kategorie]?.gruppe ?? "Sonstiges";
    const e = gruppenMap.get(g) ?? { summeCents: 0, monate: {}, posten: new Set<string>() };
    e.summeCents += Math.abs(b.betragCents);
    e.monate[b.datum.slice(0, 7)] = (e.monate[b.datum.slice(0, 7)] ?? 0) + Math.abs(b.betragCents);
    e.posten.add(zuordnen(b).schluessel);
    gruppenMap.set(g, e);
  }
  const gruppen = Array.from(gruppenMap.entries())
    .map(([name, e]) => ({ name, summeCents: e.summeCents, jeMonatCents: jeMonat(e.summeCents), anteil: gesamtAus ? e.summeCents / gesamtAus : 0, monate: e.monate, posten: e.posten.size }))
    .sort((a, b) => b.summeCents - a.summeCents);

  // ── Monatsverlauf und tiefster Kontostand ─────────────────────────────
  const monatsverlauf: Monatszeile[] = monate.map((m) => {
    const inM = zaehlend.filter((b) => b.datum.startsWith(m));
    const ein = summe(inM.filter((b) => b.betragCents > 0 && EINKOMMEN_KATEGORIEN.has(b.kategorie)));
    const weitere = summe(inM.filter((b) => b.betragCents > 0 && !EINKOMMEN_KATEGORIEN.has(b.kategorie)));
    const fest = summe(inM.filter((b) => b.betragCents < 0 && istFest(b.kategorie, b.wiederkehrend)));
    const aus = summe(inM.filter((b) => b.betragCents < 0));
    let tiefst: number | null = null, am: string | null = null;
    for (const b of alle) {
      if (!b.datum.startsWith(m) || b.saldoDanachCents == null) continue;
      if (tiefst == null || Number(b.saldoDanachCents) < tiefst) { tiefst = Number(b.saldoDanachCents); am = b.datum; }
    }
    return {
      monat: m, voll: von <= `${m}-01` && bis >= monatsLetzter(m),
      einkommenCents: ein, weitereCents: weitere, festCents: fest, variabelCents: aus - fest, freiCents: ein + weitere - aus,
      tiefsterSaldoCents: tiefst, tiefsterSaldoAm: am,
    };
  });

  // ── Zahltag: wann Geld auf dem Konto ist ──────────────────────────────
  const hauptquelle = einkommen.find((p) => p.monatlich && p.tagImMonat != null);
  const zahltag = hauptquelle
    ? {
      tag: hauptquelle.tagImMonat as number,
      quelle: hauptquelle.name,
      text: `Das Einkommen kommt meist um den ${hauptquelle.tagImMonat}. (${hauptquelle.name}). Eine Rate in den Tagen danach trifft das Konto mit Geld — kurz davor ist es am knappsten.`,
    }
    : null;

  // ── Die größten Einzelzahlungen ───────────────────────────────────────
  const groessteZahlungen = [...ausgabenB].sort((a, b) => a.betragCents - b.betragCents).slice(0, 8).map((b) => {
    const z = zuordnen(b);
    const p = ausgaben.find((x) => x.schluessel === z.schluessel);
    return { datum: b.datum, betragCents: Math.abs(b.betragCents), zweck: zweckKurz(b.zweck), name: p?.name ?? b.empfaenger, kategorieLabel: KATEGORIEN[b.kategorie]?.label ?? "Buchung" };
  });

  const umbuchungNetto = summe(neutral.filter((b) => b.betragCents > 0)) - summe(neutral.filter((b) => b.betragCents < 0));
  const tipps = tippsAus({ ausgaben, ausgabenB, einkommenJeMonat, gesamtAusJeMonat: jeMonat(gesamtAus), jeMonat, zaehlend, weitereJeMonat: jeMonat(summe(weitereB)), umbuchungNettoJeMonat: jeMonat(umbuchungNetto) });
  const vermeidbar = tipps.filter((t) => t.vermeidbar).reduce((s, t) => s + t.jeMonatCents, 0);
  const festJe = jeMonat(summe(ausgabenB.filter((b) => istFest(b.kategorie, b.wiederkehrend))));

  return {
    zeitraum: { von, bis, tage, monatsFaktor: Math.round(monatsFaktor * 10) / 10, monate },
    buchungen: alle.length,
    kennzahlen: {
      einkommenJeMonatCents: einkommenJeMonat,
      weitereJeMonatCents: jeMonat(summe(weitereB)),
      ausgabenJeMonatCents: jeMonat(gesamtAus),
      festJeMonatCents: festJe,
      variabelJeMonatCents: jeMonat(gesamtAus) - festJe,
      freiJeMonatCents: jeMonat(summe(einkommenB) + summe(weitereB) - gesamtAus),
      umbuchungenEinCents: summe(neutral.filter((b) => b.betragCents > 0)),
      umbuchungenAusCents: summe(neutral.filter((b) => b.betragCents < 0)),
      vermeidbarJeMonatCents: vermeidbar,
    },
    einkommen, weitereEingaenge, ausgaben, gruppen,
    kostenpunkte: ausgaben.filter((p) => p.typ !== "karte").slice(0, 10),
    groessteZahlungen, monatsverlauf, zahltag, tipps,
  };
}

// ───────────────────────────────────────────────────────────────────────────
// SOFORT OPTIMIEREN — feste Regeln, jede mit Betrag und Belegen
// ───────────────────────────────────────────────────────────────────────────
const W = {
  dispo: /\b(sollzins\w*|ueberziehungszins\w*|dispozins\w*|dispositionskredit|zinsen fuer (ihren )?(dispo|ueberziehung)|ueberziehung|zins\w* soll|kreditzins\w*|abschluss zinsen|zinsabschluss)\b/,
  zins: /\bzins/,
  konto: /\b(kontofuehrung\w*|kontopreis|grundpreis|grundgebuehr|kartenpreis|kartengebuehr|kartenentgelt|jahresgebuehr|jahresentgelt|kontomodell|paketpreis|kontoentgelt|buchungsposten|postenentgelt|entgelt fuer|rechnungsabschluss|abschlussentgelt)\b/,
  automat: /\b(fremdautomat|geldautomat\w* entgelt|atm fee|auslandseinsatz\w*|fremdwaehrung\w*|waehrungsumrechnung|auslandsentgelt|bargeldentgelt|abhebegebuehr)\b/,
  rueck: /\b(ruecklastschrift\w*|rueckbelastung|rueckgabe\w*|rueckbuchung\w*|lastschriftrueckgabe)\b/,
  mahn: /\b(mahngebuehr\w*|mahnkosten|mahnentgelt|mahnspesen|saeumniszuschlag\w*|saeumnis|verzugszins\w*|verzugsschaden)\b/,
};

function tippsAus(x: {
  ausgaben: Posten[];
  ausgabenB: TiefeBuchung[];
  einkommenJeMonat: number;
  gesamtAusJeMonat: number;
  weitereJeMonat: number;
  jeMonat: (c: number) => number;
  zaehlend: TiefeBuchung[];
  umbuchungNettoJeMonat: number;
}): Tipp[] {
  const tipps: Tipp[] = [];
  const text = (b: TiefeBuchung) => flachText(`${b.empfaenger} ${b.zweck}`);
  const summeWo = (f: (b: TiefeBuchung) => boolean) => x.ausgabenB.filter(f).reduce((s, b) => s - b.betragCents, 0);
  const namenWo = (f: (p: Posten) => boolean) => x.ausgaben.filter(f).map((p) => p.name);

  // Mehr raus als rein — zur Einordnung zuerst
  const frei = x.einkommenJeMonat + x.weitereJeMonat - x.gesamtAusJeMonat;
  if (frei < -2000) {
    const gedeckt = x.umbuchungNettoJeMonat >= -frei * 0.8;
    tipps.push({
      art: "defizit", titel: "Mehr Ausgaben als Eingänge",
      text: gedeckt
        ? `Im Schnitt gehen ${eurRund(-frei)} im Monat mehr raus als reinkommen — gedeckt durch Umbuchungen vom eigenen Konto (${eurRund(x.umbuchungNettoJeMonat)} im Monat). Das Einkommen läuft über ein anderes Konto.`
        : `Im Schnitt gehen ${eurRund(-frei)} im Monat mehr raus als reinkommen — das Konto lebt vom Dispo oder von Rücklagen.`,
      jeMonatCents: -frei, vermeidbar: false, hinweis: true, posten: [],
    });
  }

  // Dispozinsen
  const istGebuehr = (b: TiefeBuchung) => b.kategorie === "gebuehren" || b.kategorie === "sonstige_ausgabe";
  const dispo = summeWo((b) => istGebuehr(b) && (W.dispo.test(text(b)) || (b.kategorie === "gebuehren" && W.zins.test(text(b)))));
  if (dispo >= 100) {
    tipps.push({ art: "dispo", titel: "Dispozinsen", text: "Für das Minus auf dem Konto fallen Zinsen an. Jeder Euro, um den der Dispo sinkt, spart sofort Zinsen — einer der teuersten Kredite überhaupt.", jeMonatCents: x.jeMonat(dispo), vermeidbar: true, hinweis: false, posten: [] });
  }
  // Kontogebühren
  const konto = summeWo((b) => b.kategorie === "gebuehren" && W.konto.test(text(b)) && !W.zins.test(text(b)) && !W.automat.test(text(b)) && !W.rueck.test(text(b)));
  if (konto >= 300) {
    tipps.push({ art: "konto", titel: "Kontogebühren", text: "Grundpreis, Kartenentgelt und Buchungsposten. Ein Girokonto ohne Grundgebühr spart das vollständig.", jeMonatCents: x.jeMonat(konto), vermeidbar: true, hinweis: false, posten: [] });
  }
  // Automaten- und Auslandsgebühren
  const automat = summeWo((b) => istGebuehr(b) && W.automat.test(text(b)));
  if (automat >= 300) {
    tipps.push({ art: "automat", titel: "Automaten- und Auslandsgebühren", text: "Bargeld am Automaten der eigenen Bank oder an der Supermarktkasse abheben; im Ausland die Karte ohne Fremdwährungsentgelt nutzen.", jeMonatCents: x.jeMonat(automat), vermeidbar: true, hinweis: false, posten: [] });
  }
  // Rücklastschriften und ihre Gebühren
  const rueckAnzahl = x.zaehlend.filter((b) => b.kategorie === "ruecklastschrift").length;
  const rueckGebuehr = summeWo((b) => istGebuehr(b) && W.rueck.test(text(b)));
  if (rueckAnzahl > 0 || rueckGebuehr > 0) {
    tipps.push({
      art: "ruecklastschrift", titel: "Rücklastschriften",
      text: `${rueckAnzahl > 0 ? `${rueckAnzahl} Lastschrift${rueckAnzahl === 1 ? "" : "en"} kam${rueckAnzahl === 1 ? "" : "en"} mangels Deckung zurück` : "Gebühren für zurückgegebene Lastschriften"}${rueckGebuehr > 0 ? `, dazu ${eur(rueckGebuehr)} Gebühren` : ""}. Abbuchungstermine auf die Tage nach dem Geldeingang legen — jede Rücklastschrift fällt Banken auf.`,
      jeMonatCents: x.jeMonat(rueckGebuehr), vermeidbar: rueckGebuehr > 0, hinweis: false, posten: [], anzahl: rueckAnzahl,
    });
  }
  // Mahn- und Verzugskosten (ohne Inkasso — das hat einen eigenen Punkt)
  const mahn = summeWo((b) => b.kategorie !== "inkasso_mahnung" && W.mahn.test(text(b)));
  if (mahn >= 300) {
    tipps.push({ art: "mahn", titel: "Mahn- und Verzugskosten", text: "Geld für zu spät bezahlte Rechnungen. Pünktlich zahlen oder eine Ratenzahlung vereinbaren — dieses Geld ist sonst einfach weg.", jeMonatCents: x.jeMonat(mahn), vermeidbar: true, hinweis: false, posten: [] });
  }
  // Glücksspiel und Wetten
  const spielPosten = x.ausgaben.filter((p) => p.typ === "spiel" || p.kategorie === "gluecksspiel");
  const spiel = spielPosten.reduce((s, p) => s + p.summeCents, 0);
  const spielAnzahl = spielPosten.reduce((s, p) => s + p.anzahl, 0);
  if (spiel > 0 && (spielAnzahl >= 2 || x.jeMonat(spiel) >= 1000)) {
    tipps.push({ art: "gluecksspiel", titel: "Glücksspiel und Wetten", text: `${aufzaehlen(spielPosten.map((p) => p.name))}. Sofort stoppen: Banken sehen jede Wettbuchung, und für eine Karte gehört sie zu den schlechtesten Signalen auf dem Konto.`, jeMonatCents: x.jeMonat(spiel), vermeidbar: true, hinweis: false, posten: spielPosten.map((p) => p.name), anzahl: spielAnzahl });
  }
  // Inkasso
  const inkassoPosten = x.ausgaben.filter((p) => p.kategorie === "inkasso_mahnung");
  const inkasso = inkassoPosten.reduce((s, p) => s + p.summeCents, 0);
  if (inkasso > 0) {
    tipps.push({ art: "inkasso", titel: "Zahlungen an Inkasso", text: `An ${aufzaehlen(inkassoPosten.map((p) => p.name))}. Die Forderungen prüfen und einen Plan machen — Inkassokosten treiben jede Schuld nach oben, und eine erledigte Forderung steht in der Auskunft besser da als eine offene.`, jeMonatCents: x.jeMonat(inkasso), vermeidbar: false, hinweis: false, posten: inkassoPosten.map((p) => p.name) });
  }
  // Ratenkäufe / später bezahlen
  const bnplPosten = x.ausgaben.filter((p) => p.typ === "bnpl");
  const bnpl = bnplPosten.reduce((s, p) => s + p.summeCents, 0);
  if (bnplPosten.length) {
    const n = bnplPosten.reduce((s, p) => s + p.anzahl, 0);
    tipps.push({ art: "ratenkauf", titel: "Ratenkäufe und „Später bezahlen“", text: `${n} Zahlungen an ${aufzaehlen(bnplPosten.map((p) => p.name))}. Keine neuen Käufe auf Raten — jede offene Rate steht in der Auskunft und bindet das Geld der nächsten Monate.`, jeMonatCents: x.jeMonat(bnpl), vermeidbar: false, hinweis: false, posten: bnplPosten.map((p) => p.name) });
  }
  // Abos und Mitgliedschaften — nur die laufenden, mit ihrem üblichen Preis
  const aboPosten = x.ausgaben.filter((p) => (p.typ === "abo" || (p.kategorie === "abo_medien" && p.typ !== "handel" && p.typ !== "zahldienst")) && p.aktiv);
  const aboMonat = aboPosten.reduce((s, p) => s + (p.monatlich ? p.typischCents : p.jeMonatCents), 0);
  if (aboPosten.length >= 2 || aboMonat >= 3000) {
    tipps.push({ art: "abos", titel: `${aboPosten.length} laufende Abos und Mitgliedschaften`, text: `${aufzaehlen(aboPosten.map((p) => `${p.name} (${eur(p.monatlich ? p.typischCents : p.jeMonatCents)})`), 5)}. Kündigen, was nicht jede Woche genutzt wird.`, jeMonatCents: aboMonat, vermeidbar: false, hinweis: false, posten: aboPosten.map((p) => p.name) });
  }
  // Lieferdienste und Essen unterwegs
  const lieferPosten = x.ausgaben.filter((p) => p.typ === "liefer" || p.typ === "essen");
  const liefer = lieferPosten.reduce((s, p) => s + p.summeCents, 0);
  if (x.jeMonat(liefer) >= 4000) {
    tipps.push({ art: "liefer", titel: "Lieferdienste und Essen unterwegs", text: `${aufzaehlen(lieferPosten.map((p) => p.name))}. Selbst kochen spart hier am meisten.`, jeMonatCents: x.jeMonat(liefer), vermeidbar: false, hinweis: false, posten: lieferPosten.map((p) => p.name) });
  }
  // Telefon und Internet
  const telPosten = x.ausgaben.filter((p) => p.kategorie === "telefon_internet");
  const tel = telPosten.reduce((s, p) => s + p.summeCents, 0);
  if (telPosten.length >= 3 || x.jeMonat(tel) >= 6000) {
    const wer = telPosten.length === 1 ? `Alles bei ${telPosten[0].name}` : `${telPosten.length} Anbieter: ${aufzaehlen(telPosten.map((p) => p.name))}`;
    tipps.push({ art: "telefon", titel: "Telefon und Internet", text: `${wer}. Tarife vergleichen, doppelte Verträge kündigen.`, jeMonatCents: x.jeMonat(tel), vermeidbar: false, hinweis: false, posten: telPosten.map((p) => p.name) });
  }
  // Versicherungen
  const versPosten = x.ausgaben.filter((p) => p.kategorie === "versicherung");
  const vers = versPosten.reduce((s, p) => s + p.summeCents, 0);
  if (versPosten.length >= 4 || (x.einkommenJeMonat > 0 && x.jeMonat(vers) > x.einkommenJeMonat * 0.15)) {
    tipps.push({ art: "versicherung", titel: "Versicherungen", text: `${versPosten.length} Verträge: ${aufzaehlen(versPosten.map((p) => p.name))}. Auf doppelte Verträge prüfen.`, jeMonatCents: x.jeMonat(vers), vermeidbar: false, hinweis: false, posten: versPosten.map((p) => p.name) });
  }
  // Bargeld
  const bargeld = summeWo((b) => b.kategorie === "bargeld");
  if (x.jeMonat(bargeld) >= 15000 && x.gesamtAusJeMonat > 0 && x.jeMonat(bargeld) >= x.gesamtAusJeMonat * 0.25) {
    tipps.push({ art: "bargeld", titel: "Viel Bargeld", text: `${Math.round((x.jeMonat(bargeld) / x.gesamtAusJeMonat) * 100)} % der Ausgaben gehen als Bargeld raus — wofür, sieht niemand. Ein fester Wochenbetrag schafft Überblick.`, jeMonatCents: x.jeMonat(bargeld), vermeidbar: false, hinweis: false, posten: [] });
  }
  // Kreditraten im Verhältnis zum Einkommen — Einordnung, kein Handlungspunkt
  const kredit = summeWo((b) => b.kategorie === "kredit_rate");
  if (x.einkommenJeMonat > 0 && x.jeMonat(kredit) >= x.einkommenJeMonat * 0.35) {
    tipps.push({ art: "kredite", titel: "Kreditraten", text: `Die Raten binden ${Math.round((x.jeMonat(kredit) / x.einkommenJeMonat) * 100)} % des Einkommens.`, jeMonatCents: x.jeMonat(kredit), vermeidbar: false, hinweis: true, posten: namenWo((p) => p.kategorie === "kredit_rate") });
  }
  // Kreditkartenabrechnungen — Einordnung
  const kartePosten = x.ausgaben.filter((p) => p.typ === "karte");
  const karte = kartePosten.reduce((s, p) => s + p.summeCents, 0);
  if (kartePosten.length) {
    tipps.push({ art: "karte", titel: "Kreditkartenabrechnungen", text: `An ${aufzaehlen(kartePosten.map((p) => p.name))}. Die einzelnen Ausgaben stehen auf der Kartenabrechnung, nicht auf diesem Konto.`, jeMonatCents: x.jeMonat(karte), vermeidbar: false, hinweis: true, posten: kartePosten.map((p) => p.name) });
  }

  // Vermeidbares zuerst, dann nach Betrag; Einordnungen ans Ende (das Defizit bleibt vorn).
  const rang = (t: Tipp) => (t.art === "defizit" ? 0 : t.hinweis ? 3 : t.vermeidbar ? 1 : 2);
  return tipps.sort((a, b) => rang(a) - rang(b) || b.jeMonatCents - a.jeMonatCents);
}
