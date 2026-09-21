// ═══════════════════════════════════════════════════════════════════════════
// DIE KONTOAUSZUG-ANALYSE — „Wohin Ihr Geld geht: nicht geschätzt, gezählt"
//
// ── DER BEFUND (Justin als Kunde, 22.08.2026) ──────────────────────────────
// „Ich habe meinen Kontoauszug hochgeladen — aber es gab keine Auswertung!"
// Es gab keine. Seit dem 22.08. gibt es eine — und sie war eine Schätzung.
//
// ── DER ZWEITE BEFUND (Justin, 11.09.2026, E-178) ─────────────────────────
// „Wenn wir einen Kontoauszug haben, dann muss dieser millimetergenau
// analysiert und gescannt werden, ALLE Ausgaben müssen im Kalender mit
// KORREKTEM Datum hinterlegt sein, der Kunde braucht durch uns wirklich einen
// Nutzen."
//
// Die erste Fassung fragte das Modell nach SUMMEN (Einnahmen, Ausgaben,
// Fixkosten, Kategorien) und speicherte, was es sagte. Zwei Dinge waren daran
// falsch, und beide sind gemessen:
//   1. Der PDF-Leser klebte jede Seite zu EINER Zeile zusammen. Datum,
//      Empfänger und Betrag einer Buchung verloren ihre Zeile; das Modell
//      musste raten, was zusammengehört. (Drei echte Auszüge geprüft: alle.)
//   2. Niemand prüfte, ob die Summen stimmen. Ein Modell, das drei Buchungen
//      übersieht, liefert trotzdem eine glatte Zahl.
//
// ── WIE ES JETZT LÄUFT ─────────────────────────────────────────────────────
// 1. ZEILEN statt Textsalat: `pdfTextUndZeilen(buf, { spalten: true })` baut aus den Koordinaten die
//    Zeilen und Spalten des Auszugs nach (server/lib/fiaon-pdf-lesen.ts).
// 2. KOPF zuerst: Bank, Zeitraum, Anfangs- und Endsaldo — aus den ersten
//    Seiten. Der Zeitraum ist nötig, weil manche Banken Daten ohne Jahr drucken.
// 3. BUCHUNGEN Zeile für Zeile: je Buchung Datum, Betrag (Belastung negativ),
//    Empfänger, Zweck, Kategorie, ob wiederkehrend, Saldo danach. In Stücken
//    von höchstens 35.000 Zeichen, damit nichts hinten abfällt.
// 4. DIE CENT-PRÜFUNG: Anfangssaldo + alle Buchungen muss den Endsaldo
//    ergeben. Stimmt es nicht auf 1 €, läuft das Stück ein zweites Mal — mit
//    der Differenz als Hinweis. Das Ergebnis mit der kleineren Abweichung
//    gewinnt, und die Abweichung steht im Ergebnis. Eine Analyse, die „stimmt
//    auf den Cent" sagt, hat es gemessen; eine, die es nicht sagt, sagt, um
//    wie viel sie danebenliegt.
// 5. SUMMEN RECHNET DER SERVER, nicht das Modell: Einnahmen, Ausgaben, Gehalt,
//    Fixkosten (wiederkehrend über Monate, mit Tag im Monat und nächster
//    Fälligkeit), Kategorien, Monatsbilanz, Dispo, Warnungen. Gleiche
//    Buchungen → gleiche Zahlen, ohne Laune.
// 6. Merksätze schreibt das Modell aus den GERECHNETEN Zahlen — und jeder geht
//    durch die Wand (shared/fiaon-wortverbote.ts).
//
// Ergebnis in `fiaon_kontoauszug_analysen` (Buchungen als JSONB), Eintrag in
// die Akte, Anzeige im Kundenbereich als Kalender und im Betreuerportal.
// An das Modell geht nur Text, keine Datei, und kein Name des Kunden.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { pdfTextUndZeilen } from "./fiaon-pdf-lesen";
import { ocrLesen, ocrZeilen, ohneFotoVermerk } from "./fiaon-ocr";
import { wandPruefen } from "@shared/fiaon-wortverbote";
import { KATEGORIEN, KATEGORIE_SCHLUESSEL, istFest } from "@shared/fiaon-kontoauszug-kategorien";
import { buchungenBereinigen, nebenkontoAus, EINKOMMEN_KATEGORIEN, type PersonName } from "@shared/fiaon-kontoauszug-bereinigen";

/** So viel Text geht höchstens ans Modell — ein Dreimonatsauszug liegt weit darunter. */
const TEXT_DECKEL = 400_000;
/** Ein Stück je Modellaufruf. Darüber fallen bei langen Auszügen Buchungen hinten ab. */
// Gemessen am 11.09.2026: Bei 13.700 Zeichen in EINEM Aufruf übersah das
// Modell Buchungen im Wert von 170 €. Kleinere Stücke lesen genauer.
const STUECK_DECKEL = 8_000;
/** Bis hierhin gilt „stimmt auf den Cent": ein Euro Toleranz für Rundungen im Ausdruck. */
const TOLERANZ_CENTS = 100;

/**
 * Ist die Textausbeute ein Kontoauszug, mit dem sich arbeiten lässt?
 *
 * `pdfTextBrauchbar` aus dem PDF-Leser prüft den Vokalanteil — richtig für
 * Prosa, falsch für einen Sparkassen-Auszug, der zu drei Vierteln aus Zahlen
 * besteht (Dirk Ladewig, 11.09.2026: 6 Seiten, 180 Beträge, durchgefallen).
 * Ein Auszug ist brauchbar, wenn er Beträge enthält. Ein Foto hat keine.
 */
function auszugBrauchbar(text: string): boolean {
  if (text.trim().length < 120) return false;
  const betraege = (text.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) || []).length;
  const vokale = (text.match(/[aeiouäöüAEIOU]/g) || []).length;
  return betraege >= 5 || vokale / text.length > 0.15;
}

/** Wie sehr sieht eine Seite nach Kontoauszug aus? Beträge zählen einfach, Auszugswörter dreifach. */
export function auszugWert(text: string): number {
  const betraege = (text.match(/\d{1,3}(?:\.\d{3})*,\d{2}/g) || []).length;
  const woerter = (text.match(/\b(kontostand|saldo|kontoauszug|buchungstag|buchungsdatum|valuta|wertstellung|umsätze|umsatzliste|gutschrift|lastschrift|überweisung|iban|haben|soll)\b/gi) || []).length;
  return betraege + woerter * 3;
}

let tabelleGeprueft = false;
export async function ensureAnalyseTabelle(): Promise<void> {
  if (tabelleGeprueft) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_kontoauszug_analysen (
      id SERIAL PRIMARY KEY,
      ref VARCHAR NOT NULL,
      person_id INTEGER,
      status VARCHAR NOT NULL DEFAULT 'laeuft',
      fehler TEXT,
      zeitraum_von DATE, zeitraum_bis DATE,
      einnahmen_cents BIGINT, ausgaben_cents BIGINT, gehalt_cents BIGINT,
      saldo_ende_cents BIGINT,
      dispo_genutzt BOOLEAN, dispo_tiefst_cents BIGINT,
      ruecklastschriften INTEGER NOT NULL DEFAULT 0,
      fixkosten JSONB NOT NULL DEFAULT '[]'::jsonb,
      kategorien JSONB NOT NULL DEFAULT '[]'::jsonb,
      warnungen JSONB NOT NULL DEFAULT '[]'::jsonb,
      merksaetze JSONB NOT NULL DEFAULT '[]'::jsonb,
      modell VARCHAR,
      seiten INTEGER,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_kontoauszug_analysen_ref_idx ON fiaon_kontoauszug_analysen (ref, created_at DESC)`;
  // ── NACHGEZOGEN AM 11.09.2026 (E-178) ────────────────────────────────────
  // Die Tabelle steht seit dem 22.08. in Produktion; CREATE TABLE IF NOT EXISTS
  // ergänzt keine Spalte. Hier kommen die Buchungen, die Monatsbilanz, die
  // Cent-Prüfung, die Bank und der Anfangssaldo dazu.
  // 21.09.2026 (E-207): Umbuchungen, Nebenkonto, Inkasso und die Fassung der Auswertung.
  // Scheitert eine Spalte, wird beim nächsten Aufruf erneut geprüft: Die Ampel in
  // der Telefonkartei liest nebenkonto/inkasso_anzahl und bräche sonst ganz.
  let alleDa = true;
  for (const sp of ["buchungen JSONB", "monate JSONB", "pruefung JSONB", "bank VARCHAR", "saldo_anfang_cents BIGINT",
                    "eigen_ein_cents BIGINT", "eigen_aus_cents BIGINT", "nebenkonto BOOLEAN", "inkasso_anzahl INT", "auswertung_version INT",
                    "fotoseiten INT", "fotoseiten_erkannt INT"]) {
    await sqlPool.unsafe(`ALTER TABLE fiaon_kontoauszug_analysen ADD COLUMN IF NOT EXISTS ${sp}`).catch(() => { alleDa = false; });
  }
  tabelleGeprueft = alleDa;
}

/** Fassung der Rechnung — 2 = mit Bereinigung (eigenes Konto, Inkasso, Vorzeichen), 3 = dazu Spartöpfe der Bank (E-207). */
export const AUSWERTUNG_VERSION = 3;

export interface Buchung {
  datum: string;
  betragCents: number;
  empfaenger: string;
  zweck: string;
  kategorie: string;
  wiederkehrend: boolean;
  saldoDanachCents: number | null;
  /** Was die Bereinigung geändert hat („war: sozialleistung") — E-207. */
  korrektur?: string;
}

export interface Fixkosten {
  name: string; betragCents: number; rhythmus: string; kategorie: string;
  /** Tag im Monat, an dem die Zahlung abgeht (Median über die Buchungen). */
  tagImMonat: number | null;
  /** Letzte Buchung im Auszug und die daraus erwartete nächste Fälligkeit. */
  letzteAm: string | null; naechsteAm: string | null;
  /** Wie oft die Zahlung im Auszug steht. */
  anzahl: number;
}

export interface Analyse {
  id: number; ref: string; status: "laeuft" | "fertig" | "unlesbar" | "fehler"; fehler: string | null;
  bank: string | null;
  seiten: number | null;
  zeitraumVon: string | null; zeitraumBis: string | null;
  einnahmenCents: number | null; ausgabenCents: number | null; gehaltCents: number | null;
  saldoAnfangCents: number | null; saldoEndeCents: number | null;
  dispoGenutzt: boolean | null; dispoTiefstCents: number | null; ruecklastschriften: number;
  buchungen: Buchung[];
  monate: { monat: string; einnahmenCents: number; ausgabenCents: number; fixCents: number; freiCents: number; buchungen: number }[];
  fixkosten: Fixkosten[];
  kategorien: { name: string; betragCents: number; anteil: number }[];
  warnungen: { art: string; text: string; betragCents?: number | null }[];
  merksaetze: string[];
  /** Die Cent-Prüfung: Anfangssaldo + Buchungen gegen Endsaldo. */
  pruefung: { stimmt: boolean | null; differenzCents: number | null; erfasst: number; zeilen: number; durchlaeufe: number; kette?: { geprueft: number; brueche: number; korrigiert?: number }; hinweis: string | null } | null;
  erstelltAm: string;
  /** E-207: Umbuchungen zwischen eigenen Konten (nicht in Einnahmen/Ausgaben). */
  eigenEinCents: number | null; eigenAusCents: number | null;
  /** E-207: Eingänge überwiegend vom eigenen Konto — das Gehaltskonto fehlt. */
  nebenkonto: boolean;
  inkassoAnzahl: number;
}

/** JSONB kommt als Array — oder, aus einem frühen Lauf, als JSON-Text. Beides lesen. */
function liste(v: unknown): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") { try { const j = JSON.parse(v); return Array.isArray(j) ? j : []; } catch { return []; } }
  return [];
}
function objekt(v: unknown): any | null {
  if (v && typeof v === "object" && !Array.isArray(v)) return v;
  if (typeof v === "string") { try { const j = JSON.parse(v); return j && typeof j === "object" ? j : null; } catch { return null; } }
  return null;
}
function tagText(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const d = new Date(String(v)); return isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toISOString().slice(0, 10);
}

function zeile(r: any): Analyse {
  return {
    id: Number(r.id), ref: r.ref, status: r.status, fehler: r.fehler ?? null,
    bank: r.bank ?? null,
    seiten: r.seiten == null ? null : Number(r.seiten),
    zeitraumVon: tagText(r.zeitraum_von),
    zeitraumBis: tagText(r.zeitraum_bis),
    einnahmenCents: r.einnahmen_cents == null ? null : Number(r.einnahmen_cents),
    ausgabenCents: r.ausgaben_cents == null ? null : Number(r.ausgaben_cents),
    gehaltCents: r.gehalt_cents == null ? null : Number(r.gehalt_cents),
    saldoAnfangCents: r.saldo_anfang_cents == null ? null : Number(r.saldo_anfang_cents),
    saldoEndeCents: r.saldo_ende_cents == null ? null : Number(r.saldo_ende_cents),
    dispoGenutzt: r.dispo_genutzt ?? null, dispoTiefstCents: r.dispo_tiefst_cents == null ? null : Number(r.dispo_tiefst_cents),
    ruecklastschriften: Number(r.ruecklastschriften || 0),
    buchungen: liste(r.buchungen), monate: liste(r.monate),
    fixkosten: liste(r.fixkosten), kategorien: liste(r.kategorien),
    warnungen: liste(r.warnungen), merksaetze: liste(r.merksaetze),
    pruefung: objekt(r.pruefung),
    erstelltAm: r.created_at,
    eigenEinCents: r.eigen_ein_cents == null ? null : Number(r.eigen_ein_cents),
    eigenAusCents: r.eigen_aus_cents == null ? null : Number(r.eigen_aus_cents),
    nebenkonto: r.nebenkonto === true,
    inkassoAnzahl: Number(r.inkasso_anzahl || 0),
  };
}

/**
 * Die jüngste Analyse der PERSON hinter dieser Bestellung (oder null).
 * 18.09.2026: personenweit — die Analyse hängt an der Bestellung mit dem
 * Auszug, gefragt wird oft über eine andere (Team-Feedback, Priorität 1).
 */
export async function analyseFuer(ref: string): Promise<Analyse | null> {
  await ensureAnalyseTabelle();
  const [r] = (await sqlPool`SELECT * FROM fiaon_kontoauszug_analysen WHERE ref IN (SELECT x.ref FROM fiaon_applications x WHERE x.gdpr_deleted_at IS NULL AND (x.ref = ${ref} OR x.person_id = (SELECT y.person_id FROM fiaon_applications y WHERE y.ref = ${ref} LIMIT 1))) ORDER BY created_at DESC LIMIT 1`) as any[];
  return r ? zeile(r) : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE DREI MODELLAUFRUFE
// ═══════════════════════════════════════════════════════════════════════════
const KOPF_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    ist_kontoauszug: { type: "boolean", description: "true nur, wenn der Text ein Kontoauszug oder eine Umsatzliste eines Girokontos ist" },
    dokument_art: { type: "string", enum: ["kontoauszug", "gehaltsabrechnung", "kreditkartenabrechnung", "rechnung", "depot_oder_sparkonto", "vertrag_oder_schreiben", "sonstiges"], description: "was das Dokument tatsächlich ist" },
    bank: { type: ["string", "null"], description: "Name der Bank, wie er im Kopf steht" },
    zeitraum_von: { type: ["string", "null"], description: "YYYY-MM-DD, erster Tag des Auszugszeitraums" },
    zeitraum_bis: { type: ["string", "null"], description: "YYYY-MM-DD, letzter Tag des Auszugszeitraums" },
    saldo_anfang_cents: { type: ["integer", "null"], description: "Anfangssaldo / alter Saldo / Saldo Vortrag in Cent, negativ bei Soll" },
    saldo_ende_cents: { type: ["integer", "null"], description: "Endsaldo / neuer Saldo in Cent, negativ bei Soll" },
    dispo_limit_cents: { type: ["integer", "null"], description: "eingeräumter Dispositionskredit in Cent, falls genannt" },
  },
  required: ["ist_kontoauszug", "dokument_art", "bank", "zeitraum_von", "zeitraum_bis", "saldo_anfang_cents", "saldo_ende_cents", "dispo_limit_cents"],
} as const;

const BUCHUNG_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    buchungen: {
      type: "array",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          datum: { type: "string", description: "Buchungsdatum YYYY-MM-DD (fehlt das Jahr, aus dem Zeitraum ergänzen)" },
          betrag_cents: { type: "integer", description: "Betrag in Cent; Belastung/Soll/nachgestelltes Minus/S = NEGATIV, Gutschrift/Haben/H = positiv" },
          empfaenger: { type: "string", description: "Gegenpartei kurz: Firma, Behörde, Person — höchstens 60 Zeichen" },
          zweck: { type: "string", description: "Verwendungszweck gekürzt, höchstens 90 Zeichen" },
          kategorie: { type: "string", enum: KATEGORIE_SCHLUESSEL },
          wiederkehrend: { type: "boolean", description: "true bei Miete, Strom, Versicherung, Telefon, Abos, Kreditraten, Gehalt, Rente — allem, was regelmäßig kommt" },
          saldo_danach_cents: { type: ["integer", "null"], description: "der nach dieser Buchung gedruckte Saldo in Cent, falls die Zeile einen trägt; sonst null" },
        },
        required: ["datum", "betrag_cents", "empfaenger", "zweck", "kategorie", "wiederkehrend", "saldo_danach_cents"],
      },
    },
  },
  required: ["buchungen"],
} as const;

const MERK_SCHEMA = {
  type: "object", additionalProperties: false,
  properties: { merksaetze: { type: "array", items: { type: "string" }, minItems: 2, maxItems: 4 } },
  required: ["merksaetze"],
} as const;

const KOPF_ANWEISUNG = [
  "Du liest die ersten Seiten eines Bank-Dokuments und erfasst nur den KOPF: Bank, Zeitraum, Anfangs- und Endsaldo.",
  "· ist_kontoauszug = true nur bei einem Kontoauszug oder einer Umsatzliste eines Girokontos. Eine Rechnung, ein Depotauszug,",
  "  eine Kreditkartenabrechnung, eine Gehaltsabrechnung oder ein Schreiben ist keiner — dokument_art sagt dann, was es ist.",
  "· Beträge in Cent als ganze Zahlen. Ein Saldo im Soll (S, Minus, negativ) ist negativ.",
  "· Alter Saldo / Saldo Vortrag / Anfangssaldo / Kontostand am ersten Tag = saldo_anfang. Neuer Saldo / Endsaldo /",
  "  Kontostand am letzten Tag = saldo_ende. Steht nur ein Saldo je Seite, nimm den ersten und den letzten des Dokuments.",
  "· Zeitraum als YYYY-MM-DD. Steht kein Zeitraum, nimm das erste und letzte Buchungsdatum.",
  "· Keine Namen, Anschriften oder Kontonummern in der Antwort.",
].join("\n");

const BUCHUNG_ANWEISUNG = (zeitraumVon: string | null, zeitraumBis: string | null) => [
  "Du erfasst die BUCHUNGEN eines Kontoauszugs — jede Buchung ist eine Zeile mit Datum, Empfänger, Betrag.",
  "Du bewertest nicht. Du liest, Zeile für Zeile, und lässt nichts aus.",
  "",
  "REGELN:",
  "· GENAU EIN Objekt je Buchung. Folgezeilen ohne Betrag (Verwendungszweck, Mandatsreferenz, Gläubiger-ID) gehören zur",
  "  Buchung darüber — sie ergeben den Zweck, nie eine eigene Buchung.",
  "· KEINE Buchung für Saldo-Zeilen, Zwischensummen, Überträge, Kopf- oder Fußzeilen.",
  "· Betrag in Cent: Belastung/Soll/nachgestelltes Minus (12,50-)/S = NEGATIV. Gutschrift/Haben/H = positiv.",
  "  Bei zwei Betragsspalten (Soll | Haben) entscheidet die Spalte. Der laufende Saldo ist KEIN Buchungsbetrag — er gehört",
  "  in saldo_danach_cents, wenn die Zeile einen trägt.",
  `· Datum als YYYY-MM-DD. Der Auszug umfasst ${zeitraumVon || "?"} bis ${zeitraumBis || "?"}. Fehlt das Jahr (03.08.), ergänze es`,
  "  aus dem Zeitraum; springt der Monat von 12 auf 01, ist das Jahr um eins höher. Stehen Buchungs- und Wertstellungsdatum,",
  "  nimm das Buchungsdatum.",
  "· Kategorie aus der Liste. Gehalt/Lohn/Bezüge = gehalt; Rente/Pension = rente; Jobcenter/Kindergeld/Wohngeld/Bürgergeld =",
  "  sozialleistung; Miete/Hausverwaltung/Nebenkosten = miete; Stadtwerke/Strom/Gas = energie; Telekom/Vodafone/o2/1&1 =",
  "  telefon_internet; Netflix/Spotify/Amazon Prime/Fitness = abo_medien; Kredit/Darlehen/Rate/Ratenkauf/Klarna/PayPal-Ratenzahlung =",
  "  kredit_rate; Inkasso/Mahnung/Forderungsmanagement/Gerichtsvollzieher = inkasso_mahnung; Rücklastschrift/Rückbuchung/",
  "  Lastschrift zurück = ruecklastschrift; Kontoführung/Entgelt/Zinsen/Sollzinsen = gebuehren; Tipico/bwin/Lotto/Casino =",
  "  gluecksspiel; Supermärkte = lebensmittel; Tanken/Bahn/Bus = mobilitaet (Kfz-Versicherung = versicherung);",
  "  Apotheke/Arzt = gesundheit; Geldautomat/Bargeld = bargeld; Bareinzahlung (Gutschrift) = bareinzahlung;",
  "  Finanzamt/Kfz-Steuer (Hauptzollamt)/Rundfunkbeitrag/Stadtkasse (Abbuchung) = abgaben.",
  "· Aufladung/Top-up, Umbuchung oder Übertrag vom EIGENEN Konto (Zahlung vom Kontoinhaber selbst) = eigenes_konto — das ist",
  "  kein Einkommen und keine Sozialleistung. Bewegungen zwischen Spartöpfen/Unterkonten derselben Bank (Pocket, Space, Tagesgeld,",
  "  Portmonee, Vault) = spartopf, in beide Richtungen. Inkassobüros und Forderungskäufer (PRA Group, Axactor, Intrum, Lowell, EOS, coeo,",
  "  KSP, Creditreform, Pair Finance) = inkasso_mahnung, nie kredit_rate.",
  "· wiederkehrend = true bei allem, was regelmäßig kommt (Miete, Energie, Versicherung, Telefon, Abos, Raten, Gehalt, Rente,",
  "  Sozialleistung) — auch wenn es im Auszug nur einmal steht.",
  "· ERSTATTUNGEN sind Eingänge: Rückzahlung/Refund/Gutschrift eines Händlers (z. B. Temu, Amazon, Zalando) = POSITIV, Kategorie",
  "  erstattung. Ein Betrag mit vorangestelltem Plus oder in der Haben-Spalte ist immer positiv, auch wenn derselbe Händler",
  "  sonst belastet. Trägt die Zeile einen Saldo, prüfe: Saldo davor + Betrag = Saldo danach — daraus folgt das Vorzeichen.",
  "· Keine Namen von Privatpersonen als Empfänger — schreibe stattdessen Privatperson. Firmen und Behörden bleiben.",
].join("\n");

async function modellAufruf(name: string, schema: any, system: string, nutzer: string): Promise<{ modell: string; daten: any }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY fehlt.");
  const modell = process.env.FIAON_ANALYSE_MODELL || "gpt-4.1-mini";
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modell, temperature: 0,
      response_format: { type: "json_schema", json_schema: { name, strict: true, schema } },
      messages: [{ role: "system", content: system }, { role: "user", content: nutzer }],
    }),
  });
  const j: any = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${j?.error?.message || "unbekannt"}`);
  const inhalt = j?.choices?.[0]?.message?.content;
  return { modell, daten: JSON.parse(String(inhalt || "{}")) };
}

// ═══════════════════════════════════════════════════════════════════════════
// RECHNEN — hier entstehen die Zahlen, nicht im Modell
// ═══════════════════════════════════════════════════════════════════════════
const ISO = /^\d{4}-\d{2}-\d{2}$/;

function buchungAus(b: any): Buchung | null {
  const datum = String(b?.datum || "");
  const betrag = Number(b?.betrag_cents);
  if (!ISO.test(datum) || !Number.isFinite(betrag) || betrag === 0) return null;
  const kategorie = KATEGORIEN[String(b?.kategorie)] ? String(b.kategorie) : (betrag > 0 ? "sonstige_einnahme" : "sonstige_ausgabe");
  return {
    datum, betragCents: Math.round(betrag),
    empfaenger: String(b?.empfaenger || "").slice(0, 60).trim() || KATEGORIEN[kategorie].label,
    zweck: String(b?.zweck || "").slice(0, 90).trim(),
    kategorie, wiederkehrend: b?.wiederkehrend === true,
    saldoDanachCents: b?.saldo_danach_cents == null ? null : Math.round(Number(b.saldo_danach_cents)),
  };
}

/** Schlüssel, unter dem gleichartige Zahlungen zusammenfinden: Telekom Deutschland GmbH ≈ TELEKOM DEUTSCHL. */
function empfaengerKey(s: string): string {
  return s.toLowerCase().replace(/\b(gmbh|ag|kg|ev|e\.v\.|se|ltd|co|und)\b/g, " ").replace(/[^a-zäöüß0-9]+/g, " ").trim().split(" ").filter(Boolean).slice(0, 2).join(" ");
}
function median(z: number[]): number {
  const s = [...z].sort((a, b) => a - b); const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : Math.round((s[m - 1] + s[m]) / 2);
}
function monatPlus(iso: string, n: number, tag: number): string {
  const [j, m] = iso.split("-").map(Number);
  const gesamt = j * 12 + (m - 1) + n;
  const jahr = Math.floor(gesamt / 12), monat = (gesamt % 12) + 1;
  const letzter = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
  return `${jahr}-${String(monat).padStart(2, "0")}-${String(Math.min(tag, letzter)).padStart(2, "0")}`;
}

function fixkostenAus(buchungen: Buchung[], monateImAuszug: number): Fixkosten[] {
  const gruppen = new Map<string, Buchung[]>();
  for (const b of buchungen) {
    if (b.betragCents >= 0) continue;
    if (!istFest(b.kategorie, b.wiederkehrend)) continue;
    const key = `${b.kategorie}|${empfaengerKey(b.empfaenger)}`;
    gruppen.set(key, [...(gruppen.get(key) || []), b]);
  }
  const aus: Fixkosten[] = [];
  for (const g of Array.from(gruppen.values())) {
    const monate = new Set(g.map((b) => b.datum.slice(0, 7)));
    // In jedem Monat des Auszugs (bis auf einen) = monatlich. In zweien von
    // dreien = unregelmäßig. Nur einmal, aber vom Modell oder der Kategorie als
    // fest erkannt = monatlich; sonst zählt es nicht.
    // Nur EINMAL im Auszug: zählt allein mit fester Kategorie (Miete, Energie,
    // Versicherung, Telefon, Abo, Rate). Eine einzelne PayPal-Zahlung, die das
    // Modell „wiederkehrend" nannte, ist keine feste Zahlung (Silvia C. P., 11.09.).
    if (monate.size < 2 && !KATEGORIEN[g[0].kategorie]?.fix) continue;
    const rhythmus = monate.size >= 2 && monate.size >= monateImAuszug - 1 ? "monatlich"
      : monate.size >= 2 ? "unregelmäßig"
      : "monatlich";
    const sortiert = [...g].sort((a, b) => a.datum.localeCompare(b.datum));
    const letzte = sortiert[sortiert.length - 1];
    // Der Tag der LETZTEN Zahlung — der Kundentext verspricht genau das
    // („der Tag, an dem die Zahlung zuletzt abging"), kein Median (Skeptiker, 11.09.).
    const tag = Number(letzte.datum.slice(8, 10));
    aus.push({
      name: letzte.empfaenger, betragCents: median(g.map((b) => -b.betragCents)),
      rhythmus, kategorie: KATEGORIEN[letzte.kategorie]?.label || letzte.kategorie,
      tagImMonat: tag, letzteAm: letzte.datum, naechsteAm: monatPlus(letzte.datum, 1, tag), anzahl: g.length,
    });
  }
  return aus.sort((a, b) => b.betragCents - a.betragCents);
}

export function auswerten(alleBuchungen: Buchung[], kopf: { saldoAnfang: number | null; saldoEnde: number | null; dispoLimit: number | null }) {
  // E-207 (21.09.2026): Umbuchungen zwischen eigenen Konten sind weder Einnahme
  // noch Ausgabe — sie zählten als Einnahmen (und einmal als „Gehalt").
  const neben = nebenkontoAus(alleBuchungen);
  const buchungen = alleBuchungen.filter((b) => !KATEGORIEN[b.kategorie]?.neutral);
  const ein = buchungen.filter((b) => b.betragCents > 0);
  const aus = buchungen.filter((b) => b.betragCents < 0);
  const einnahmen = ein.reduce((s, b) => s + b.betragCents, 0);
  const ausgaben = aus.reduce((s, b) => s - b.betragCents, 0);

  const monatsMap = new Map<string, { einnahmenCents: number; ausgabenCents: number; fixCents: number; buchungen: number }>();
  for (const b of buchungen) {
    const m = b.datum.slice(0, 7);
    const z = monatsMap.get(m) || { einnahmenCents: 0, ausgabenCents: 0, fixCents: 0, buchungen: 0 };
    if (b.betragCents > 0) z.einnahmenCents += b.betragCents; else z.ausgabenCents -= b.betragCents;
    if (b.betragCents < 0 && istFest(b.kategorie, b.wiederkehrend)) z.fixCents -= b.betragCents;
    z.buchungen++;
    monatsMap.set(m, z);
  }
  const monate = Array.from(monatsMap.entries()).sort(([a], [b]) => a.localeCompare(b))
    .map(([monat, z]) => ({ monat, ...z, freiCents: z.einnahmenCents - z.ausgabenCents }));

  // Gehalt: das regelmäßige Einkommen je Monat, Median über die Monate mit Einkommen.
  const einkommenJeMonat = new Map<string, number>();
  for (const b of ein) {
    if (!EINKOMMEN_KATEGORIEN.has(b.kategorie)) continue;
    einkommenJeMonat.set(b.datum.slice(0, 7), (einkommenJeMonat.get(b.datum.slice(0, 7)) || 0) + b.betragCents);
  }
  const gehalt = einkommenJeMonat.size ? median(Array.from(einkommenJeMonat.values())) : null;

  const fixkosten = fixkostenAus(buchungen, Math.max(1, monate.length));

  const katMap = new Map<string, number>();
  for (const b of aus) {
    const g = KATEGORIEN[b.kategorie]?.gruppe || "Sonstiges";
    katMap.set(g, (katMap.get(g) || 0) - b.betragCents);
  }
  const kategorien = Array.from(katMap.entries()).map(([name, betragCents]) => ({ name, betragCents, anteil: ausgaben ? betragCents / ausgaben : 0 }))
    .sort((a, b) => b.betragCents - a.betragCents);

  // Dispo: der tiefste gedruckte Saldo — oder, wenn keiner gedruckt ist, der
  // aus dem Anfangssaldo mitgerechnete.
  let tiefst: number | null = null;
  if (buchungen.some((b) => b.saldoDanachCents != null)) {
    for (const b of buchungen) if (b.saldoDanachCents != null && (tiefst == null || b.saldoDanachCents < tiefst)) tiefst = b.saldoDanachCents;
  } else if (kopf.saldoAnfang != null) {
    let lauf = kopf.saldoAnfang;
    for (const b of [...buchungen].sort((a, c) => a.datum.localeCompare(c.datum))) { lauf += b.betragCents; if (tiefst == null || lauf < tiefst) tiefst = lauf; }
  }
  const dispoGenutzt = tiefst == null ? null : tiefst < 0;

  const warnungen: { art: string; text: string; betragCents: number | null }[] = [];
  // Beim Zahler erscheint die zurückgegebene Lastschrift als GUTSCHRIFT — beide Richtungen zählen (E-207).
  const ruecklastschriften = buchungen.filter((b) => b.kategorie === "ruecklastschrift").length;
  const inkassoAnzahl = aus.filter((b) => b.kategorie === "inkasso_mahnung").length;
  const dt = (iso: string) => iso.split("-").reverse().join(".");
  // Kunden lesen diese Sätze — deutsches Zahlformat (285,93 €, nicht 285.93 €).
  const eur = (c: number) => `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  for (const b of aus) {
    const w = KATEGORIEN[b.kategorie]?.warnung;
    if (!w || w === "kredit") continue;
    if (w === "inkasso") warnungen.push({ art: "inkasso", text: `Zahlung an ${b.empfaenger} am ${dt(b.datum)} — Inkasso oder Mahnung.`, betragCents: -b.betragCents });
    if (w === "gluecksspiel") warnungen.push({ art: "gluecksspiel", text: `Glücksspiel oder Wette (${b.empfaenger}) am ${dt(b.datum)}.`, betragCents: -b.betragCents });
  }
  if (ruecklastschriften) warnungen.push({ art: "ruecklastschrift", text: `${ruecklastschriften} Rücklastschrift${ruecklastschriften === 1 ? "" : "en"} im Zeitraum — jede kostet Gebühren und fällt Banken auf.`, betragCents: null });
  const kredite = fixkosten.filter((f) => f.kategorie === KATEGORIEN.kredit_rate.label);
  if (kredite.length) warnungen.push({ art: "kredit", text: `${kredite.length} laufende Kreditrate${kredite.length === 1 ? "" : "n"} (${kredite.map((k) => k.name).join(", ")}) — zusammen ${eur(kredite.reduce((s, k) => s + k.betragCents, 0))} im Monat.`, betragCents: kredite.reduce((s, k) => s + k.betragCents, 0) });
  if (dispoGenutzt) warnungen.push({ art: "dispo", text: `Das Konto war im Minus — tiefster Stand ${eur(tiefst!)}${kopf.dispoLimit ? ` bei ${eur(kopf.dispoLimit)} Dispo` : ""}.`, betragCents: tiefst });
  const gebuehren = aus.filter((b) => b.kategorie === "gebuehren").reduce((s, b) => s - b.betragCents, 0);
  if (gebuehren >= 1500) warnungen.push({ art: "sonstiges", text: `${eur(gebuehren)} Kontogebühren und Zinsen im Zeitraum.`, betragCents: gebuehren });
  if (neben.nebenkonto) {
    warnungen.unshift({
      art: "nebenkonto",
      text: `Die Eingänge kommen überwiegend von einem anderen eigenen Konto (${eur(neben.vomEigenenKonto)}) — das ist ein Nebenkonto. Für das Einkommen fehlt der Auszug des Gehaltskontos.`,
      betragCents: neben.vomEigenenKonto,
    });
  }

  return {
    einnahmen, ausgaben, gehalt, monate, fixkosten, kategorien, tiefst, dispoGenutzt, ruecklastschriften, warnungen,
    eigenEin: neben.eigenEin, eigenAus: neben.eigenAus, nebenkonto: neben.nebenkonto, inkassoAnzahl,
  };
}

/**
 * DIE SALDO-KETTE — die schärfste Prüfung, die ein Auszug hergibt.
 *
 * Druckt die Bank nach jeder Buchung den neuen Saldo (Sparkasse, Revolut,
 * viele andere), dann muss gelten: Saldo nach Buchung n = Saldo nach Buchung
 * n-1 + Betrag n. Bricht die Kette, fehlt an genau dieser Stelle eine Buchung
 * oder ein Betrag ist falsch gelesen — und der zweite Durchlauf bekommt die
 * Stelle genannt, statt „irgendwo fehlen 115 €".
 *
 * Reihenfolge = Reihenfolge im Ausdruck (so liefert das Modell sie), nicht
 * nach Datum sortiert: Zwei Buchungen am selben Tag haben eine Druckfolge.
 */
/**
 * TAGESSALDO (18.09.2026). Manche Banken drucken den Saldo nur einmal je Tag — mal
 * hinter der ersten, mal hinter der letzten Buchung des Tages. Das Modell schrieb ihn
 * dann an JEDE Buchung des Tages (oder an die erste) — und die Kette „brach" an jeder
 * Stelle (gemessen: 37 von 37 an einem echten Kundenauszug). Trägt ein Tag mit mehreren
 * Buchungen genau EINEN gedruckten Saldowert, ist das der Stand am Tagesende: Er gehört
 * hinter die letzte Buchung des Tages. Ob diese Lesart stimmt, entscheidet die Kette
 * selbst (siehe lesenUndRichten: die Fassung mit weniger Brüchen gewinnt).
 */
export function tagessalden(b: Buchung[]): Buchung[] {
  const aus = b.map((x) => ({ ...x }));
  let i = 0;
  while (i < aus.length) {
    let j = i;
    while (j + 1 < aus.length && aus[j + 1].datum === aus[i].datum) j++;
    if (j > i) {
      const werte = new Set(aus.slice(i, j + 1).map((x) => x.saldoDanachCents).filter((v) => v != null));
      if (werte.size === 1) {
        const wert = Array.from(werte)[0] as number;
        for (let k = i; k < j; k++) aus[k].saldoDanachCents = null;
        aus[j].saldoDanachCents = wert;
      }
    }
    i = j + 1;
  }
  return aus;
}

/**
 * DRUCKRICHTUNG (18.09.2026). Umsatzlisten aus dem Online-Banking stehen oft mit der
 * jüngsten Buchung oben (gemessen: Finom, Revolut-Export). Die Kette lief dann von oben
 * nach unten gegen die Zeit und „brach" an fast jeder Stelle — 43 von 43 und 556 von 574
 * an echten Kundenauszügen, obwohl jede Buchung richtig gelesen war. Geprüft werden vier
 * Lesarten: Druckfolge und umgekehrt, jeweils mit Saldo je Zeile oder je Tag. Es gewinnt
 * die mit den wenigsten Brüchen, bei Gleichstand die Druckfolge — gedreht wird nur, wenn
 * die gedruckten Salden es belegen.
 */
export function kettenLesart(roh: Buchung[], saldoAnfang: number | null): Buchung[] {
  const rueck = [...roh].reverse();
  let beste = roh;
  let brueche = saldoKette(roh, saldoAnfang).brueche.length;
  for (const lesart of [tagessalden(roh), rueck, tagessalden(rueck)]) {
    const n = saldoKette(lesart, saldoAnfang).brueche.length;
    if (n < brueche) { beste = lesart; brueche = n; }
  }
  return beste;
}

export function saldoKette(b: Buchung[], saldoAnfang: number | null): { geprueft: number; brueche: { nach: number; erwartet: number; gedruckt: number }[] } {
  const brueche: { nach: number; erwartet: number; gedruckt: number }[] = [];
  let geprueft = 0;
  let vorher: number | null = saldoAnfang;
  for (let i = 0; i < b.length; i++) {
    const s = b[i].saldoDanachCents;
    // 18.09.2026: Ohne gedruckten Saldo läuft die Kette rechnerisch weiter (vorher: Abbruch) —
    // Banken mit Tagessaldo drucken ihn nur hinter der letzten Buchung des Tages.
    if (s == null) { if (vorher != null) vorher += b[i].betragCents; continue; }
    if (vorher != null) {
      geprueft++;
      const erwartet = vorher + b[i].betragCents;
      if (Math.abs(erwartet - s) > 1) brueche.push({ nach: i, erwartet, gedruckt: s });
    }
    vorher = s;
  }
  return { geprueft, brueche };
}

/**
 * DIE REPARATUR AUS DER KETTE — was der gedruckte Saldo beweist, wird korrigiert.
 *
 * Gemessen an Dogan Cengiz (Revolut, 11.09.2026): drei Brüche, alle drei
 * Temu-Erstattungen, die das Modell als Ausgabe las. Die Lücke war jedes Mal
 * exakt ZWEIMAL der Betrag — das ist die Handschrift eines gedrehten
 * Vorzeichens, und der Saldo beweist die Richtung. Nur diesen einen Fall
 * repariert diese Funktion; alles andere bleibt ein Bruch, der im Ergebnis
 * steht. Eine Reparatur, die rät, wäre schlimmer als eine sichtbare Lücke.
 */
function vorzeichenAusKette(b: Buchung[], saldoAnfang: number | null): { buchungen: Buchung[]; korrigiert: number } {
  const aus = b.map((x) => ({ ...x }));
  let korrigiert = 0;
  let vorher: number | null = saldoAnfang;
  // Repariert wird nur, wo der Saldo direkt davor gedruckt war — nach Zeilen ohne Saldo könnte
  // die Lücke von jeder der dazwischenliegenden Buchungen stammen.
  let direkt = true;
  for (let i = 0; i < aus.length; i++) {
    const x = aus[i];
    if (x.saldoDanachCents == null) { if (vorher != null) vorher += x.betragCents; direkt = false; continue; }
    if (vorher != null && direkt) {
      const erwartet = vorher + x.betragCents;
      const luecke = x.saldoDanachCents - erwartet;
      if (Math.abs(luecke) > 1 && Math.abs(luecke + 2 * x.betragCents) <= 1) {
        x.betragCents = -x.betragCents;
        x.kategorie = x.betragCents > 0 ? "erstattung" : (KATEGORIEN[x.kategorie]?.seite === "aus" ? x.kategorie : "sonstige_ausgabe");
        korrigiert++;
      }
    }
    vorher = x.saldoDanachCents;
    direkt = true;
  }
  return { buchungen: aus, korrigiert };
}

/** Ein Kundensatz durch die Wand — was durchfällt, wird ersetzt, nicht gezeigt. */
function durchDieWand(text: string, ersatz: string): string {
  const hart = wandPruefen(text).filter((f) => f.art === "verboten" || f.art === "zusage");
  return hart.length ? ersatz : text;
}

/** Was die Probe zurückgibt — alles, was die Analyse speichert, ohne Datenbank. */
export interface Probe {
  status: "fertig" | "unlesbar";
  fehler: string | null;
  akte: string | null;
  modell: string | null;
  seiten: number;
  bank: string | null;
  zeitraumVon: string | null; zeitraumBis: string | null;
  saldoAnfang: number | null; saldoEnde: number | null;
  buchungen: Buchung[];
  pruefung: Analyse["pruefung"];
  z: ReturnType<typeof auswerten> | null;
  merksaetze: string[];
  /** Seiten, die die Texterkennung gelesen hat (Fotos, Scans) — E-207. */
  fotoseiten: number;
  /** Seiten ohne Textschicht, die gelesen werden SOLLTEN — ist die Zahl größer als `fotoseiten`, fehlt etwas. */
  fotoseitenErkannt: number;
}

/**
 * DIE PROBE — der ganze Rechenweg ohne einen einzigen Schreibzugriff.
 *
 * Sie existiert, damit ein Prüfstand einen echten Auszug durch dieselbe
 * Maschine schicken und das Ergebnis gegen die Rohzeilen halten kann, ohne
 * eine Zeile in `fiaon_kontoauszug_analysen` zu hinterlassen. `kontoauszug-
 * Analysieren` ruft genau diese Funktion und speichert danach — es gibt keinen
 * zweiten Rechenweg.
 */
export async function kontoauszugProbe(buf: Buffer, person: PersonName = { vorname: null, nachname: null }): Promise<Probe> {
  const leer = (status: "unlesbar", fehler: string, akte: string, seiten: number, modell: string | null = null): Probe =>
    ({ status, fehler, akte, modell, seiten, bank: null, zeitraumVon: null, zeitraumBis: null, saldoAnfang: null, saldoEnde: null, buchungen: [], pruefung: null, z: null, merksaetze: [], fotoseiten: 0, fotoseitenErkannt });

  let seiten: string[][] = [];
  try { seiten = (await pdfTextUndZeilen(buf, { spalten: true })).zeilen; } catch (e) { console.warn("[ANALYSE] PDF nicht lesbar:", (e as Error).message); }
  let seitenText = seiten.map((z) => z.join("\n"));
  // ── FOTOSEITEN IN EINEM GEMISCHTEN PDF (21.09.2026, E-207) ──────────────
  // Die Texterkennung lief nur, wenn das GANZE Dokument keinen Text hatte. Ein
  // gebundener Upload aus Bank-PDF plus Handyfotos galt damit als lesbar — und
  // die Fotoseiten las niemand (gemessen: 3 Auszüge, bei einem 17 von 24 Seiten;
  // Ergebnis „kein Kontoauszug"). Jetzt liest die Texterkennung genau diese Seiten.
  let fotoseiten = 0;
  let fotoseitenErkannt = 0;
  let ocrModell: string | null = null;
  const fotoIdx = seitenText.map((t, i) => (ohneFotoVermerk(t).replace(/\s/g, "").length < 40 ? i : -1)).filter((i) => i >= 0);
  fotoseitenErkannt = fotoIdx.length;
  if (fotoIdx.length > 0 && fotoIdx.length < seitenText.length) {
    try {
      const ocr = await ocrLesen(buf, "kontoauszug", { seiten: fotoIdx });
      if (ocr) {
        const z = ocrZeilen(ocr);
        fotoIdx.forEach((seite, j) => { if (z[j]?.length) { seiten[seite] = z[j]; seitenText[seite] = z[j].join("\n"); fotoseiten++; } });
        if (fotoseiten) ocrModell = ocr.modell;
      }
    } catch (e) { console.warn("[ANALYSE] Texterkennung der Fotoseiten:", (e as Error).message); }
  }
  let gesamt = seitenText.join("\n\n");
  // ── FOTO ODER SCAN: DIE TEXTERKENNUNG LIEST (18.09.2026) ───────────────
  // 47 Auszüge endeten hier als „Foto oder Scan" — auch scharfe Fotos, die ein
  // Mensch mühelos liest. Ohne brauchbare Textschicht liest jetzt das
  // Bildmodell die Seiten zeilengetreu (fiaon-ocr.ts); gerechnet wird danach
  // derselbe Weg wie bei einem PDF aus dem Online-Banking.
  if (!auszugBrauchbar(gesamt)) {
    try {
      const ocr = await ocrLesen(buf, "kontoauszug");
      if (ocr) {
        const z = ocrZeilen(ocr);
        const t = z.map((zeilen) => zeilen.join("\n"));
        if (auszugBrauchbar(t.join("\n\n"))) { seiten = z; seitenText = t; gesamt = t.join("\n\n"); ocrModell = ocr.modell; fotoseiten = z.length; }
      }
    } catch (e) { console.warn("[ANALYSE] Texterkennung:", (e as Error).message); }
  }
  if (!auszugBrauchbar(gesamt)) {
    return leer("unlesbar", "Die Datei ist nicht lesbar — auch die Texterkennung findet keine Buchungen (zu unscharf, abgeschnitten oder leer). Bitte laden Sie den Kontoauszug als PDF aus dem Online-Banking hoch oder fotografieren Sie jede Seite gerade und scharf.",
      "Kontoauszug-Analyse: Datei auch mit Texterkennung nicht lesbar. Der Kunde sieht die Bitte um ein PDF aus dem Online-Banking oder ein scharfes Foto.", seiten.length);
  }

  // ── 1 · Der Kopf ───────────────────────────────────────────────────────
  // ── DER KOPF STEHT AUF DER ERSTEN AUSZUGSSEITE, NICHT AUF SEITE 1 (21.09.2026) ──
  // Ein Kunde lud 24 Seiten: vorn und hinten Werbeseiten einer PDF-App („Welcome
  // to PDF Reader"), dazwischen 16 Fotos seiner Auszüge. Der Kopf las Seite 1–2
  // und meldete „kein Kontoauszug". Jetzt zählt die erste und die letzte Seite,
  // die wie ein Auszug aussieht (Beträge, Kontostand, Buchungswörter).
  const auszugSeiten = seitenText.map((t, i) => ({ i, wert: auszugWert(t) })).filter((x) => x.wert >= 6).map((x) => x.i);
  const erste = auszugSeiten.length ? auszugSeiten[0] : 0;
  const letzte = auszugSeiten.length ? auszugSeiten[auszugSeiten.length - 1] : seitenText.length - 1;
  const kopfText = seitenText.slice(erste, erste + 2).join("\n\n").slice(0, 20_000)
    + (letzte > erste + 1 ? "\n\n[letzte Seite:]\n" + seitenText[letzte].slice(-4_000) : "");
  const { modell, daten: kopf } = await modellAufruf("kontoauszug_kopf", KOPF_SCHEMA, KOPF_ANWEISUNG, kopfText);
  if (kopf.ist_kontoauszug === false) {
    // Dirk Ladewig (11.09.2026) hatte drei Gehaltsabrechnungen als „Kontoauszug"
    // hochgeladen. „Kein Kontoauszug" allein hätte ihn ratlos gelassen — der
    // Satz sagt, was es IST, und was stattdessen gebraucht wird.
    const ART: Record<string, string> = {
      gehaltsabrechnung: "eine Gehaltsabrechnung", kreditkartenabrechnung: "eine Kreditkartenabrechnung", rechnung: "eine Rechnung",
      depot_oder_sparkonto: "ein Depot- oder Sparkontoauszug", vertrag_oder_schreiben: "ein Vertrag oder Schreiben",
    };
    const bekannt = ART[String(kopf.dokument_art)];
    return leer("unlesbar", `Diese Datei ist ${bekannt ? `${bekannt}, kein Kontoauszug` : "kein Kontoauszug"}. Bitte laden Sie die Umsätze Ihres Girokontos der letzten drei Monate als PDF aus dem Online-Banking hoch — Ihre Bank nennt das meist „Umsätze exportieren“ oder „Kontoauszug als PDF“.`,
      `Kontoauszug-Analyse: Die Datei ist ${bekannt || "kein Kontoauszug"} (${String(kopf.dokument_art)}). Der Kunde sieht die Bitte um die richtige Datei.`, seiten.length, modell);
  }
  const zeitraumVon = ISO.test(String(kopf.zeitraum_von)) ? String(kopf.zeitraum_von) : null;
  const zeitraumBis = ISO.test(String(kopf.zeitraum_bis)) ? String(kopf.zeitraum_bis) : null;
  const saldoAnfang = kopf.saldo_anfang_cents == null ? null : Math.round(Number(kopf.saldo_anfang_cents));
  const saldoEnde = kopf.saldo_ende_cents == null ? null : Math.round(Number(kopf.saldo_ende_cents));

  // ── 2 · Die Buchungen, in Stücken ─────────────────────────────────────
  const stuecke: string[] = [];
  let lauf = "";
  for (const s of seitenText) {
    if (lauf && lauf.length + s.length > STUECK_DECKEL) { stuecke.push(lauf); lauf = ""; }
    lauf += (lauf ? "\n\n" : "") + s;
    if (stuecke.join("").length + lauf.length > TEXT_DECKEL) break;
  }
  if (lauf) stuecke.push(lauf);
  const anweisung = BUCHUNG_ANWEISUNG(zeitraumVon, zeitraumBis);
  // 18.09.2026: Eine lange Seite aus der Texterkennung ließ die Antwort abbrechen („Unterminated
  // string in JSON"). Dann wird das Stück an einer Zeilengrenze halbiert, höchstens zweimal.
  const stueckLesen = async (text: string, teil: string, hinweis: string | null, tiefe = 0): Promise<Buchung[]> => {
    const nutzer = `Kontoauszug, ${teil}. Jede Zeile ist eine Zeile des Ausdrucks; das Zeichen | trennt Spalten.`
      + (hinweis ? `\n\nKONTROLLE AUS DEM ERSTEN DURCHLAUF: ${hinweis}` : "") + `\n\n${text}`;
    try {
      const { daten } = await modellAufruf("kontoauszug_buchungen", BUCHUNG_SCHEMA, anweisung, nutzer);
      const aus: Buchung[] = [];
      for (const b of daten.buchungen || []) { const x = buchungAus(b); if (x) aus.push(x); }
      return aus;
    } catch (e) {
      if (tiefe >= 2 || text.length < 1500) throw e;
      const zeilen = text.split("\n");
      const mitte = Math.floor(zeilen.length / 2);
      return [
        ...await stueckLesen(zeilen.slice(0, mitte).join("\n"), `${teil}, erste Hälfte`, hinweis, tiefe + 1),
        ...await stueckLesen(zeilen.slice(mitte).join("\n"), `${teil}, zweite Hälfte`, hinweis, tiefe + 1),
      ];
    }
  };
  const lesen = async (hinweis: string | null): Promise<Buchung[]> => {
    const alle: Buchung[] = [];
    for (let i = 0; i < stuecke.length; i++) {
      alle.push(...await stueckLesen(stuecke[i], `Teil ${i + 1} von ${stuecke.length}`, hinweis));
    }
    return alle; // Druckreihenfolge — die Saldo-Kette braucht sie
  };
  const differenz = (b: Buchung[]): number | null =>
    saldoAnfang != null && saldoEnde != null ? saldoAnfang + b.reduce((s, x) => s + x.betragCents, 0) - saldoEnde : null;

  let korrigiert = 0;
  const lesenUndRichten = async (hinweis: string | null): Promise<Buchung[]> => {
    const roh = await lesen(hinweis);
    // Vier Lesarten (Richtung × Saldo je Zeile/je Tag) — die mit den wenigsten Brüchen gewinnt.
    const basis = kettenLesart(roh, saldoAnfang);
    const rep = vorzeichenAusKette(basis, saldoAnfang);
    korrigiert += rep.korrigiert;
    return rep.buchungen;
  };
  let buchungen = await lesenUndRichten(null);
  let diff = differenz(buchungen);
  let kette = saldoKette(buchungen, saldoAnfang);
  let durchlaeufe = 1;
  const daneben = (d: number | null, k: typeof kette) => (d != null && Math.abs(d) > TOLERANZ_CENTS) || k.brueche.length > 0;
  // ── 3 · Die Cent-Prüfung — und der zweite Durchlauf, wenn sie scheitert ──
  if (daneben(diff, kette)) {
    const dt = (iso: string) => iso.split("-").reverse().join(".");
    const stellen = kette.brueche.slice(0, 6).map((x) => {
      const b = buchungen[x.nach];
      return `nach der Buchung vom ${dt(b.datum)} über ${(b.betragCents / 100).toFixed(2)} € (${b.empfaenger}) müsste der Saldo ${(x.erwartet / 100).toFixed(2)} € sein, gedruckt ist ${(x.gedruckt / 100).toFixed(2)} € — dazwischen fehlt eine Buchung über ${((x.gedruckt - x.erwartet) / 100).toFixed(2)} € oder ein Betrag ist falsch`;
    });
    const summe = saldoAnfang != null ? saldoAnfang + buchungen.reduce((s, x) => s + x.betragCents, 0) : null;
    const hinweis = [
      diff != null ? `Anfangssaldo ${(saldoAnfang! / 100).toFixed(2)} € plus deine ${buchungen.length} Buchungen ergaben ${(summe! / 100).toFixed(2)} €, der Endsaldo ist ${(saldoEnde! / 100).toFixed(2)} €. Differenz ${(diff / 100).toFixed(2)} €.` : "",
      stellen.length ? `Die gedruckten Salden zeigen genau, wo es hakt: ${stellen.join("; ")}.` : "",
      "Also wurden Buchungen übersehen, doppelt erfasst oder mit falschem Vorzeichen gelesen. Gehe jede Zeile erneut durch. Prüfe besonders Zeilen mit nachgestelltem Minus, Zeilen am Seitenende, Buchungen ohne eigenes Datum (gleicher Tag wie die Zeile darüber) und Zwecke über mehrere Zeilen.",
    ].filter(Boolean).join(" ");
    const zweiter = await lesenUndRichten(hinweis);
    const diff2 = differenz(zweiter);
    const kette2 = saldoKette(zweiter, saldoAnfang);
    durchlaeufe = 2;
    const besser = (kette2.brueche.length < kette.brueche.length)
      || (kette2.brueche.length === kette.brueche.length && diff2 != null && diff != null && Math.abs(diff2) < Math.abs(diff));
    if (besser) { buchungen = zweiter; diff = diff2; kette = kette2; }
  }
  // Stimmt die Kette lückenlos vom Anfangs- bis zum Endsaldo, ist das der
  // stärkere Beleg als ein möglicherweise falsch gelesener Kopf-Saldo.
  const ketteVoll = kette.geprueft > 0 && kette.geprueft === buchungen.length && kette.brueche.length === 0;
  const stimmt = ketteVoll ? true : diff == null ? null : Math.abs(diff) <= TOLERANZ_CENTS && kette.brueche.length === 0;
  buchungen = buchungen.map((b, i) => ({ ...b, _i: i })).sort((p: any, q: any) => p.datum.localeCompare(q.datum) || p._i - q._i).map(({ _i, ...b }: any) => b as Buchung);
  const euroDe = (c: number) => `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const pruefung = {
    stimmt, differenzCents: diff, erfasst: buchungen.length, zeilen: seiten.reduce((s, z) => s + z.length, 0), durchlaeufe,
    kette: { geprueft: kette.geprueft, brueche: kette.brueche.length, korrigiert },
    hinweis: stimmt === true ? (ketteVoll ? `Alle ${buchungen.length} Buchungen passen lückenlos zum gedruckten Kontostand.` : "Anfangssaldo, alle Buchungen und Endsaldo stimmen überein.")
      : stimmt === false ? (kette.brueche.length ? `An ${kette.brueche.length} Stelle${kette.brueche.length === 1 ? "" : "n"} passt die Buchungsfolge nicht zum gedruckten Kontostand${diff != null ? `; Differenz zum Endsaldo ${euroDe(Math.abs(diff))}` : ""}.` : `Zwischen Anfangssaldo, Buchungen und Endsaldo bleibt eine Differenz von ${euroDe(Math.abs(diff!))}.`)
      : "Der Auszug nennt keinen Anfangs- oder Endsaldo — die Summe konnte nicht gegengerechnet werden.",
  };
  // ── 4 · Bereinigen (E-207): eigenes Konto, Inkasso, Vorzeichen — mit dem
  //    Namen aus der Akte, auf dem Server. Beträge bleiben, die Prüfung auch.
  buchungen = buchungenBereinigen(buchungen, person);
  // ── 5 · Rechnen ───────────────────────────────────────────────────────
  const z = auswerten(buchungen, { saldoAnfang, saldoEnde, dispoLimit: kopf.dispo_limit_cents == null ? null : Math.round(Number(kopf.dispo_limit_cents)) });

  // ── 5 · Merksätze aus den gerechneten Zahlen ──────────────────────────
  let merksaetze: string[] = [];
  try {
    const lage = [
      `Zeitraum ${zeitraumVon || "?"} bis ${zeitraumBis || "?"}, ${z.monate.length} Monat(e).`,
      `Einnahmen ${(z.einnahmen / 100).toFixed(2)} €, Ausgaben ${(z.ausgaben / 100).toFixed(2)} €, bleibt ${((z.einnahmen - z.ausgaben) / 100).toFixed(2)} €.`,
      z.nebenkonto ? `Die Eingänge kommen überwiegend vom eigenen Konto (Umbuchungen ${(z.eigenEin / 100).toFixed(2)} €) — kein Einkommen auf diesem Konto; das Gehaltskonto fehlt.`
        : z.gehalt != null ? `Regelmäßiges Einkommen etwa ${(z.gehalt / 100).toFixed(2)} € im Monat.` : "Kein regelmäßiges Einkommen erkennbar.",
      `Feste Zahlungen: ${z.fixkosten.slice(0, 8).map((f) => `${f.name} ${(f.betragCents / 100).toFixed(2)} € ${f.rhythmus}`).join("; ") || "keine erkannt"}.`,
      `Größte Ausgabenbereiche: ${z.kategorien.slice(0, 4).map((k) => `${k.name} ${Math.round(k.anteil * 100)} %`).join(", ") || "—"}.`,
      z.warnungen.length ? `Auffällig: ${z.warnungen.map((w) => w.text).join(" ")}` : "Nichts Auffälliges für die Bonität.",
    ].join("\n");
    const { daten } = await modellAufruf("kontoauszug_merksaetze", MERK_SCHEMA,
      "Du schreibst für einen Kunden von FIAON (Bonitätsplattform, DACH) zwei bis vier kurze Merksätze in der Sie-Form aus den folgenden GERECHNETEN Zahlen. "
      + "Konkret, mit Beträgen, ohne Fachwörter. Sag, wo Spielraum ist und was zuerst dran wäre. Keine Garantie, kein Versprechen, keine Empfehlung im Wortlaut "
      + "(nicht empfehlen, nicht raten, nicht beraten), keine Fristzusage. Keine Namen von Personen.", lage);
    merksaetze = (daten.merksaetze || []).map((m: string) => durchDieWand(String(m), "")).filter(Boolean);
  } catch (e) { console.warn("[ANALYSE] Merksätze:", (e as Error).message); }
  if (!merksaetze.length) {
    merksaetze = [
      `Im Zeitraum kamen ${(z.einnahmen / 100).toFixed(2)} € herein und ${(z.ausgaben / 100).toFixed(2)} € gingen heraus.`,
      z.fixkosten.length ? `${z.fixkosten.length} feste Zahlungen kehren monatlich wieder — zusammen ${(z.fixkosten.reduce((s, f) => s + f.betragCents, 0) / 100).toFixed(2)} €.` : "Feste monatliche Zahlungen waren im Auszug nicht zu erkennen.",
    ];
  }

  return { status: "fertig", fehler: null, akte: null, fotoseiten, fotoseitenErkannt,
    modell: ocrModell ? `${modell} (Texterkennung ${ocrModell}${fotoseiten < seiten.length ? `, ${fotoseiten} von ${seiten.length} Seiten` : ""})` : modell, seiten: seiten.length, bank: kopf.bank ? String(kopf.bank).slice(0, 80) : null,
           zeitraumVon, zeitraumBis, saldoAnfang, saldoEnde, buchungen, pruefung, z, merksaetze };
}

// ═══════════════════════════════════════════════════════════════════════════
// NEU RECHNEN OHNE MODELL (21.09.2026, E-207)
//
// Die gelesenen Buchungen stehen je Analyse als JSONB da. Die Bereinigung
// (eigenes Konto, Inkasso, Vorzeichen) braucht kein Modell — also werden alle
// fertigen Analysen der Fassung 1 aus ihren Buchungen neu gerechnet. Die
// Merksätze entstehen dabei aus den korrigierten Zahlen neu: Die alten nannten
// teils ein falsches Einkommen (ein Revolut-Kunde: „regelmäßiges Einkommen 285,93 €").
// ═══════════════════════════════════════════════════════════════════════════

/** Merksätze aus den gerechneten Zahlen — ohne Modell, Sie-Form, ohne Zusage. */
export function merksaetzeAusZahlen(z: ReturnType<typeof auswerten>): string[] {
  const e = (c: number) => `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
  const s: string[] = [];
  if (z.nebenkonto) s.push("Die Eingänge auf diesem Konto kommen überwiegend von einem anderen Konto von Ihnen. Für Ihr Einkommen brauchen wir den Auszug Ihres Gehaltskontos.");
  else if (z.gehalt != null) s.push(`Ihr regelmäßiges Einkommen liegt bei etwa ${e(z.gehalt)} im Monat.`);
  s.push(`Im Zeitraum kamen ${e(z.einnahmen)} herein und ${e(z.ausgaben)} gingen heraus${z.eigenEin || z.eigenAus ? " — Umbuchungen zwischen Ihren eigenen Konten und Spartöpfen sind nicht mitgezählt" : ""}.`);
  if (z.kategorien[0]) s.push(`Der größte Ausgabenblock ist ${z.kategorien[0].name} mit ${e(z.kategorien[0].betragCents)}.`);
  if (z.fixkosten.length) s.push(`${z.fixkosten.length} feste Zahlungen kehren regelmäßig wieder — zusammen ${e(z.fixkosten.reduce((x, f) => x + f.betragCents, 0))}.`);
  return s.slice(0, 4);
}

export async function analysenNeuRechnen(grenze = 300): Promise<{ gerechnet: number; offen: number }> {
  await ensureAnalyseTabelle();
  const zeilen = (await sqlPool`
    SELECT k.id, k.buchungen, k.saldo_anfang_cents, k.saldo_ende_cents, k.merksaetze,
           COALESCE(NULLIF(TRIM(p.first_name), ''), a.first_name) AS vorname,
           COALESCE(NULLIF(TRIM(p.last_name), ''), a.last_name) AS nachname
      FROM fiaon_kontoauszug_analysen k
      LEFT JOIN fiaon_applications a ON a.ref = k.ref
      LEFT JOIN fiaon_persons p ON p.id = COALESCE(k.person_id, a.person_id)
     WHERE k.status = 'fertig' AND k.buchungen IS NOT NULL AND COALESCE(k.auswertung_version, 1) < ${AUSWERTUNG_VERSION}
     ORDER BY k.id LIMIT ${Math.max(1, Math.min(1000, grenze))}`) as any[];
  let gerechnet = 0;
  for (const k of zeilen) {
    const roh = liste(k.buchungen) as Buchung[];
    if (!roh.length) {
      await sqlPool`UPDATE fiaon_kontoauszug_analysen SET auswertung_version = ${AUSWERTUNG_VERSION} WHERE id = ${k.id}`;
      continue;
    }
    const bereinigt = buchungenBereinigen(roh, { vorname: k.vorname ?? null, nachname: k.nachname ?? null });
    const z = auswerten(bereinigt, {
      saldoAnfang: k.saldo_anfang_cents == null ? null : Number(k.saldo_anfang_cents),
      saldoEnde: k.saldo_ende_cents == null ? null : Number(k.saldo_ende_cents),
      dispoLimit: null,
    });
    // Hat die Bereinigung nichts geändert, beruhen die Merksätze des Modells auf
    // denselben Zahlen — sie bleiben. Sonst entstehen sie neu aus den Zahlen.
    const alteMerksaetze = liste(k.merksaetze);
    const unveraendert = !bereinigt.some((b) => b.korrektur) && !z.nebenkonto && alteMerksaetze.length > 0;
    const felder: Record<string, any> = {
      einnahmen_cents: z.einnahmen, ausgaben_cents: z.ausgaben, gehalt_cents: z.gehalt,
      dispo_genutzt: z.dispoGenutzt, dispo_tiefst_cents: z.tiefst, ruecklastschriften: z.ruecklastschriften,
      buchungen: bereinigt, monate: z.monate, fixkosten: z.fixkosten, kategorien: z.kategorien,
      warnungen: z.warnungen, merksaetze: unveraendert ? alteMerksaetze : merksaetzeAusZahlen(z),
      eigen_ein_cents: z.eigenEin, eigen_aus_cents: z.eigenAus, nebenkonto: z.nebenkonto,
      inkasso_anzahl: z.inkassoAnzahl, auswertung_version: AUSWERTUNG_VERSION,
    };
    const JSONB = new Set(["fixkosten", "kategorien", "warnungen", "merksaetze", "buchungen", "monate"]);
    const cols = Object.keys(felder);
    const sets = cols.map((c, i) => `${c} = $${i + 1}${JSONB.has(c) ? "::jsonb" : ""}`).join(", ");
    await sqlPool.unsafe(`UPDATE fiaon_kontoauszug_analysen SET ${sets}, updated_at = NOW() WHERE id = $${cols.length + 1}`,
      [...cols.map((c) => felder[c]), k.id]);
    gerechnet++;
  }
  const [rest] = (await sqlPool`
    SELECT count(*)::int AS n FROM fiaon_kontoauszug_analysen
     WHERE status = 'fertig' AND buchungen IS NOT NULL AND COALESCE(auswertung_version, 1) < ${AUSWERTUNG_VERSION}`) as any[];
  if (gerechnet) console.log(`[ANALYSE] Neu gerechnet (Fassung ${AUSWERTUNG_VERSION}): ${gerechnet}, offen ${rest?.n ?? 0}`);
  return { gerechnet, offen: Number(rest?.n ?? 0) };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER LAUF
// ═══════════════════════════════════════════════════════════════════════════
/**
 * Die Analyse anstoßen. Idempotent je Upload: Eine laufende oder fertige
 * Analyse, die JÜNGER als der Upload ist, wird nicht wiederholt — außer mit
 * `erzwingen`. Eine fertige Analyse ohne Buchungen (aus der Zeit vor E-178)
 * zählt nicht: Sie wird beim nächsten Anstoß neu gerechnet.
 */
export async function kontoauszugAnalysieren(ref: string, opts: { erzwingen?: boolean } = {}): Promise<Analyse | null> {
  await ensureAnalyseTabelle();
  // 18.09.2026: an der Bestellung, die den Auszug TRÄGT (dokumentTraeger).
  const { dokumentTraeger } = await import("./fiaon-dokumente");
  ref = (await dokumentTraeger({ ref }, "kontoauszug")) ?? ref;
  const [a] = (await sqlPool`
    SELECT a.ref, a.person_id, a.bank_statement_pdf, a.documents_uploaded_at,
           COALESCE(NULLIF(TRIM(p.first_name), ''), a.first_name) AS vorname,
           COALESCE(NULLIF(TRIM(p.last_name), ''), a.last_name) AS nachname
      FROM fiaon_applications a LEFT JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.ref = ${ref} AND a.gdpr_deleted_at IS NULL LIMIT 1`) as any[];
  if (!a?.bank_statement_pdf) return null;
  if (!opts.erzwingen) {
    const [j] = (await sqlPool`SELECT id, status, created_at, fehler, buchungen FROM fiaon_kontoauszug_analysen WHERE ref = ${ref} ORDER BY created_at DESC LIMIT 1`) as any[];
    const juenger = !!j && (!a.documents_uploaded_at || new Date(j.created_at) >= new Date(a.documents_uploaded_at));
    // 18.09.2026: Ein Lauf, der seit einer Viertelstunde „läuft", ist tot (Neustart
    // mitten im Lauf) — sieben Zeilen standen seit dem 11.09. so und blockierten
    // jede Wiederholung. Und ein „unlesbar" aus der Zeit vor der Texterkennung
    // zählt nicht: Genau diese Fotos kann der Server jetzt lesen.
    const tot = !!j && j.status === "laeuft" && Date.now() - new Date(j.created_at).getTime() > 15 * 60_000;
    const vorOcr = !!j && j.status === "unlesbar" && /keinen lesbaren Text/.test(String(j.fehler || ""));
    const vollwertig = !!j && !tot && !vorOcr && (j.status === "laeuft" || j.status === "unlesbar" || liste(j.buchungen).length > 0);
    if (juenger && vollwertig && j.status !== "fehler") return analyseFuer(ref);
  }
  const [neu] = (await sqlPool`
    INSERT INTO fiaon_kontoauszug_analysen (ref, person_id, status) VALUES (${ref}, ${a.person_id ?? null}, 'laeuft') RETURNING id`) as any[];
  const id = Number(neu.id);
  const JSONB = new Set(["fixkosten", "kategorien", "warnungen", "merksaetze", "buchungen", "monate", "pruefung"]);
  const fertig = async (felder: Record<string, any>) => {
    const cols = Object.keys(felder);
    // Ausdrücklich `::jsonb` aus Text — sonst verpackt der Treiber den JSON-Text
    // noch einmal als JSON-String (jsonb_typeof = 'string'), gemessen am 22.08.
    const sets = cols.map((c, i) => `${c} = $${i + 1}${JSONB.has(c) ? "::jsonb" : ""}`).join(", ");
    await sqlPool.unsafe(`UPDATE fiaon_kontoauszug_analysen SET ${sets}, updated_at = NOW() WHERE id = $${cols.length + 1}`, [...cols.map((c) => felder[c]), id]);
  };
  const akte = async (note: string) => sqlPool`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note) VALUES (${ref}, NULL, 'System', 'system', ${note})`.catch(() => {});

  try {
    const buf: Buffer = Buffer.isBuffer(a.bank_statement_pdf) ? a.bank_statement_pdf : Buffer.from(a.bank_statement_pdf);
    const pr = await kontoauszugProbe(buf, { vorname: a.vorname ?? null, nachname: a.nachname ?? null });
    if (pr.status !== "fertig" || !pr.z) {
      await fertig({ status: "unlesbar", seiten: pr.seiten, modell: pr.modell, fehler: pr.fehler, fotoseiten: pr.fotoseiten, fotoseiten_erkannt: pr.fotoseitenErkannt });
      if (pr.akte) await akte(pr.akte);
      return analyseFuer(ref);
    }
    const { z, buchungen, pruefung, merksaetze } = pr;
    await fertig({
      status: "fertig", modell: pr.modell, seiten: pr.seiten, bank: pr.bank,
      zeitraum_von: pr.zeitraumVon, zeitraum_bis: pr.zeitraumBis,
      einnahmen_cents: z.einnahmen, ausgaben_cents: z.ausgaben, gehalt_cents: z.gehalt,
      saldo_anfang_cents: pr.saldoAnfang, saldo_ende_cents: pr.saldoEnde,
      dispo_genutzt: z.dispoGenutzt, dispo_tiefst_cents: z.tiefst,
      ruecklastschriften: z.ruecklastschriften,
      // ── KEIN JSON.stringify (11.09.2026, E-181) ─────────────────────────
      // Der Treiber serialisiert einen JS-String fuer eine jsonb-Spalte als
      // JSON-STRING — gemessen: jsonb_typeof(buchungen) = 'string' an allen
      // frischen Zeilen. Arrays und Objekte uebergeben, dann wird es JSON.
      // Die Leser liste()/objekt() und die SQL-Zaehler verstehen beide Formen.
      buchungen, monate: z.monate, pruefung,
      fixkosten: z.fixkosten, kategorien: z.kategorien,
      warnungen: z.warnungen, merksaetze,
      eigen_ein_cents: z.eigenEin, eigen_aus_cents: z.eigenAus, nebenkonto: z.nebenkonto,
      inkasso_anzahl: z.inkassoAnzahl, auswertung_version: AUSWERTUNG_VERSION, fotoseiten: pr.fotoseiten, fotoseiten_erkannt: pr.fotoseitenErkannt,
    });
    await akte(`Kontoauszug ausgewertet (${pr.bank || "Bank unbekannt"}, ${pr.zeitraumVon || "?"} bis ${pr.zeitraumBis || "?"}, ${pr.seiten} Seiten): `
      + `${buchungen.length} Buchungen, Einnahmen ${(z.einnahmen / 100).toFixed(2)} €, Ausgaben ${(z.ausgaben / 100).toFixed(2)} €, `
      + `${z.fixkosten.length} feste Zahlungen, ${z.warnungen.length} Warnung(en). Prüfung: ${pruefung?.hinweis || "—"} `
      + `Der Kunde sieht Kalender und Auswertung unter „Ihre Finanzen“.`);
    return analyseFuer(ref);
  } catch (e: any) {
    await fertig({ status: "fehler", fehler: String(e?.message || e).slice(0, 500) });
    console.error("[ANALYSE]", ref, e);
    return analyseFuer(ref);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NACHHOLEN — jeder hochgeladene Auszug wird gelesen (21.09.2026, E-207)
//
// Justin: „JEDES Bild, jedes PDF — alles muss im Detail analysiert werden."
// Gemessen am 21.09. (nur lesend, 146 Auszüge): 16 nie ausgewertet, einer seit
// dem 18.09. in „läuft" hängen geblieben, einer „unlesbar" aus der Zeit vor der
// Texterkennung, vier Auswertungen ohne gespeicherte Buchungen (vor E-178) und
// drei gemischte PDFs, deren Fotoseiten nie gelesen wurden.
//
// Der Lauf holt das nach — höchstens `grenze` Modellläufe je Durchgang, und
// nie mehr als drei Läufe je Auszug in sieben Tagen (kein Dauerversuch an
// einer Datei, die nicht lesbar ist). Ob ein PDF Fotoseiten hat, prüft er
// ohne Modell über die Textschicht und merkt es sich (`fotoseiten`).
// ═══════════════════════════════════════════════════════════════════════════
export async function auszuegeNachholen(grenze = 3): Promise<{ gestartet: number; seitenGeprueft: number; offen: number }> {
  await ensureAnalyseTabelle();
  const kandidaten = (await sqlPool`
    WITH l AS (
      SELECT DISTINCT ON (k.ref) k.ref, k.id, k.status, k.fehler, k.created_at, k.fotoseiten, k.fotoseiten_erkannt, k.modell,
             COALESCE(k.auswertung_version, 1) AS fassung,
             CASE WHEN jsonb_typeof(k.buchungen) = 'array' THEN jsonb_array_length(k.buchungen) ELSE 0 END AS n_buchungen
        FROM fiaon_kontoauszug_analysen k
       ORDER BY k.ref, k.created_at DESC
    )
    SELECT a.ref, l.id AS analyse_id, l.modell, l.fotoseiten,
           CASE
             WHEN l.id IS NULL THEN 'nie'
             WHEN l.status = 'laeuft' AND l.created_at < NOW() - INTERVAL '15 minutes' THEN 'haengt'
             WHEN l.status = 'unlesbar' AND l.fehler LIKE '%keinen lesbaren Text%' THEN 'vor_ocr'
             WHEN l.status = 'fehler' AND l.created_at < NOW() - INTERVAL '1 hour' THEN 'fehler'
             -- nur alte Auswertungen ohne Buchungen (vor E-178); eine frische ohne Buchungen ist ein Ergebnis
             WHEN l.status = 'fertig' AND l.n_buchungen = 0 AND l.fassung < 3 THEN 'ohne_buchungen'
             -- Fotoseiten erkannt, aber nicht alle gelesen (ein Päckchen der Texterkennung scheiterte)
             WHEN l.status IN ('fertig', 'unlesbar') AND l.fotoseiten_erkannt > COALESCE(l.fotoseiten, 0) THEN 'foto_ungelesen'
             WHEN l.status IN ('fertig', 'unlesbar') AND l.fotoseiten_erkannt IS NULL THEN 'seiten_pruefen'
           END AS grund
      FROM fiaon_applications a
      LEFT JOIN l ON l.ref = a.ref
     WHERE a.gdpr_deleted_at IS NULL AND a.bank_statement_pdf IS NOT NULL
       -- Je Person nur die Bestellung, die den Auszug TRÄGT (dieselbe Reihenfolge wie dokumentTraeger):
       -- zusammengeführte Dubletten und Kopien in der Auskunfts-Bestellung nicht doppelt auswerten.
       AND a.ref = COALESCE((SELECT y.ref FROM fiaon_applications y
                              WHERE y.person_id = a.person_id AND y.gdpr_deleted_at IS NULL AND y.bank_statement_pdf IS NOT NULL
                              ORDER BY (y.merged_into IS NULL) DESC, y.documents_uploaded_at DESC NULLS LAST, y.created_at DESC
                              LIMIT 1), a.ref)
       AND (SELECT count(*) FROM fiaon_kontoauszug_analysen k2
             WHERE k2.ref = a.ref AND k2.created_at > NOW() - INTERVAL '7 days') < 3
     ORDER BY a.documents_uploaded_at DESC NULLS LAST
  `) as any[];
  const offen = kandidaten.filter((k) => k.grund);
  let gestartet = 0, seitenGeprueft = 0;
  for (const k of offen) {
    if (k.grund === "seiten_pruefen") {
      if (seitenGeprueft >= 25) continue;
      seitenGeprueft++;
      const [d] = (await sqlPool`SELECT bank_statement_pdf FROM fiaon_applications WHERE ref = ${k.ref}`) as any[];
      const buf: Buffer | null = d?.bank_statement_pdf ? (Buffer.isBuffer(d.bank_statement_pdf) ? d.bank_statement_pdf : Buffer.from(d.bank_statement_pdf)) : null;
      let texte: string[] = [];
      try { if (buf) texte = (await pdfTextUndZeilen(buf)).seiten; } catch { texte = []; }
      const foto = texte.filter((t) => ohneFotoVermerk(t).replace(/\s/g, "").length < 40).length;
      const schonGelesen = /Texterkennung/.test(String(k.modell || ""));
      const neuLesen = foto > 0 && !schonGelesen && texte.length > 0;
      if (neuLesen && gestartet < grenze) {
        // Fotoseiten, die nie gelesen wurden: neu auswerten (setzt beide Zahlen selbst).
        gestartet++;
        await kontoauszugAnalysieren(k.ref, { erzwingen: true }).catch((e) => console.error("[ANALYSE] Nachholen", k.ref, e));
      } else if (!neuLesen) {
        await sqlPool`UPDATE fiaon_kontoauszug_analysen
                         SET fotoseiten = ${schonGelesen ? Math.max(Number(k.fotoseiten || 0), foto) : 0}, fotoseiten_erkannt = ${schonGelesen ? foto : 0}
                       WHERE id = ${k.analyse_id}`;
      }
      continue;
    }
    if (gestartet >= grenze) continue;
    gestartet++;
    // Ohne `erzwingen`: kontoauszugAnalysieren erkennt hängende, veraltete und leere Läufe selbst.
    await kontoauszugAnalysieren(k.ref, { erzwingen: k.grund === "ohne_buchungen" || k.grund === "fehler" || k.grund === "foto_ungelesen" }).catch((e) => console.error("[ANALYSE] Nachholen", k.ref, e));
  }
  if (gestartet || seitenGeprueft) console.log(`[ANALYSE] Nachholen: ${gestartet} Auswertungen, ${seitenGeprueft} Seiten geprüft, ${offen.length} Kandidaten`);
  return { gestartet, seitenGeprueft, offen: offen.length };
}

