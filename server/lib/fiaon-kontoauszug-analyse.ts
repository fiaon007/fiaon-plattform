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
import { wandPruefen } from "@shared/fiaon-wortverbote";
import { KATEGORIEN, KATEGORIE_SCHLUESSEL, istFest } from "@shared/fiaon-kontoauszug-kategorien";

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
  for (const sp of ["buchungen JSONB", "monate JSONB", "pruefung JSONB", "bank VARCHAR", "saldo_anfang_cents BIGINT"]) {
    await sqlPool.unsafe(`ALTER TABLE fiaon_kontoauszug_analysen ADD COLUMN IF NOT EXISTS ${sp}`).catch(() => {});
  }
  tabelleGeprueft = true;
}

export interface Buchung {
  datum: string;
  betragCents: number;
  empfaenger: string;
  zweck: string;
  kategorie: string;
  wiederkehrend: boolean;
  saldoDanachCents: number | null;
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
  };
}

/** Die jüngste Analyse einer Bestellung (oder null). */
export async function analyseFuer(ref: string): Promise<Analyse | null> {
  await ensureAnalyseTabelle();
  const [r] = (await sqlPool`SELECT * FROM fiaon_kontoauszug_analysen WHERE ref = ${ref} ORDER BY created_at DESC LIMIT 1`) as any[];
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
  "  Apotheke/Arzt = gesundheit; Geldautomat/Bargeld = bargeld.",
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
    const tag = median(g.map((b) => Number(b.datum.slice(8, 10))));
    aus.push({
      name: letzte.empfaenger, betragCents: median(g.map((b) => -b.betragCents)),
      rhythmus, kategorie: KATEGORIEN[letzte.kategorie]?.label || letzte.kategorie,
      tagImMonat: tag, letzteAm: letzte.datum, naechsteAm: monatPlus(letzte.datum, 1, tag), anzahl: g.length,
    });
  }
  return aus.sort((a, b) => b.betragCents - a.betragCents);
}

function auswerten(buchungen: Buchung[], kopf: { saldoAnfang: number | null; saldoEnde: number | null; dispoLimit: number | null }) {
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
    if (!["gehalt", "rente", "sozialleistung"].includes(b.kategorie)) continue;
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
  const ruecklastschriften = aus.filter((b) => b.kategorie === "ruecklastschrift").length;
  const dt = (iso: string) => iso.split("-").reverse().join(".");
  for (const b of aus) {
    const w = KATEGORIEN[b.kategorie]?.warnung;
    if (!w || w === "kredit") continue;
    if (w === "inkasso") warnungen.push({ art: "inkasso", text: `Zahlung an ${b.empfaenger} am ${dt(b.datum)} — Inkasso oder Mahnung.`, betragCents: -b.betragCents });
    if (w === "gluecksspiel") warnungen.push({ art: "gluecksspiel", text: `Glücksspiel oder Wette (${b.empfaenger}) am ${dt(b.datum)}.`, betragCents: -b.betragCents });
  }
  if (ruecklastschriften) warnungen.push({ art: "ruecklastschrift", text: `${ruecklastschriften} Rücklastschrift${ruecklastschriften === 1 ? "" : "en"} im Zeitraum — jede kostet Gebühren und fällt Banken auf.`, betragCents: null });
  const kredite = fixkosten.filter((f) => f.kategorie === KATEGORIEN.kredit_rate.label);
  if (kredite.length) warnungen.push({ art: "kredit", text: `${kredite.length} laufende Kreditrate${kredite.length === 1 ? "" : "n"} (${kredite.map((k) => k.name).join(", ")}) — zusammen ${(kredite.reduce((s, k) => s + k.betragCents, 0) / 100).toFixed(2)} € im Monat.`, betragCents: kredite.reduce((s, k) => s + k.betragCents, 0) });
  if (dispoGenutzt) warnungen.push({ art: "dispo", text: `Das Konto war im Minus — tiefster Stand ${(tiefst! / 100).toFixed(2)} €${kopf.dispoLimit ? ` bei ${(kopf.dispoLimit / 100).toFixed(2)} € Dispo` : ""}.`, betragCents: tiefst });
  const gebuehren = aus.filter((b) => b.kategorie === "gebuehren").reduce((s, b) => s - b.betragCents, 0);
  if (gebuehren >= 1500) warnungen.push({ art: "sonstiges", text: `${(gebuehren / 100).toFixed(2)} € Kontogebühren und Zinsen im Zeitraum.`, betragCents: gebuehren });

  return { einnahmen, ausgaben, gehalt, monate, fixkosten, kategorien, tiefst, dispoGenutzt, ruecklastschriften, warnungen };
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
function saldoKette(b: Buchung[], saldoAnfang: number | null): { geprueft: number; brueche: { nach: number; erwartet: number; gedruckt: number }[] } {
  const brueche: { nach: number; erwartet: number; gedruckt: number }[] = [];
  let geprueft = 0;
  let vorher: number | null = saldoAnfang;
  for (let i = 0; i < b.length; i++) {
    const s = b[i].saldoDanachCents;
    if (s == null) { vorher = null; continue; }
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
  for (let i = 0; i < aus.length; i++) {
    const x = aus[i];
    if (x.saldoDanachCents == null) { vorher = null; continue; }
    if (vorher != null) {
      const erwartet = vorher + x.betragCents;
      const luecke = x.saldoDanachCents - erwartet;
      if (Math.abs(luecke) > 1 && Math.abs(luecke + 2 * x.betragCents) <= 1) {
        x.betragCents = -x.betragCents;
        x.kategorie = x.betragCents > 0 ? "erstattung" : (KATEGORIEN[x.kategorie]?.seite === "aus" ? x.kategorie : "sonstige_ausgabe");
        korrigiert++;
      }
    }
    vorher = x.saldoDanachCents;
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
export async function kontoauszugProbe(buf: Buffer): Promise<Probe> {
  const leer = (status: "unlesbar", fehler: string, akte: string, seiten: number, modell: string | null = null): Probe =>
    ({ status, fehler, akte, modell, seiten, bank: null, zeitraumVon: null, zeitraumBis: null, saldoAnfang: null, saldoEnde: null, buchungen: [], pruefung: null, z: null, merksaetze: [] });

  let seiten: string[][] = [];
  try { seiten = (await pdfTextUndZeilen(buf, { spalten: true })).zeilen; } catch (e) { console.warn("[ANALYSE] PDF nicht lesbar:", (e as Error).message); }
  const seitenText = seiten.map((z) => z.join("\n"));
  const gesamt = seitenText.join("\n\n");
  if (!auszugBrauchbar(gesamt)) {
    return leer("unlesbar", "Die Datei enthält keinen lesbaren Text (Foto oder Scan). Bitte laden Sie den Kontoauszug als PDF aus dem Online-Banking hoch.",
      "Kontoauszug-Analyse: Datei ohne lesbaren Text (Foto/Scan). Der Kunde sieht die Bitte um ein PDF aus dem Online-Banking.", seiten.length);
  }

  // ── 1 · Der Kopf ───────────────────────────────────────────────────────
  const kopfText = seitenText.slice(0, 2).join("\n\n").slice(0, 20_000)
    + (seitenText.length > 2 ? "\n\n[letzte Seite:]\n" + seitenText[seitenText.length - 1].slice(-4_000) : "");
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
  const lesen = async (hinweis: string | null): Promise<Buchung[]> => {
    const alle: Buchung[] = [];
    for (let i = 0; i < stuecke.length; i++) {
      const nutzer = `Kontoauszug, Teil ${i + 1} von ${stuecke.length}. Jede Zeile ist eine Zeile des Ausdrucks; das Zeichen | trennt Spalten.`
        + (hinweis ? `\n\nKONTROLLE AUS DEM ERSTEN DURCHLAUF: ${hinweis}` : "") + `\n\n${stuecke[i]}`;
      const { daten } = await modellAufruf("kontoauszug_buchungen", BUCHUNG_SCHEMA, anweisung, nutzer);
      for (const b of daten.buchungen || []) { const x = buchungAus(b); if (x) alle.push(x); }
    }
    return alle; // Druckreihenfolge — die Saldo-Kette braucht sie
  };
  const differenz = (b: Buchung[]): number | null =>
    saldoAnfang != null && saldoEnde != null ? saldoAnfang + b.reduce((s, x) => s + x.betragCents, 0) - saldoEnde : null;

  let korrigiert = 0;
  const lesenUndRichten = async (hinweis: string | null): Promise<Buchung[]> => {
    const rep = vorzeichenAusKette(await lesen(hinweis), saldoAnfang);
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
  const pruefung = {
    stimmt, differenzCents: diff, erfasst: buchungen.length, zeilen: seiten.reduce((s, z) => s + z.length, 0), durchlaeufe,
    kette: { geprueft: kette.geprueft, brueche: kette.brueche.length, korrigiert },
    hinweis: stimmt === true ? (ketteVoll ? `Alle ${buchungen.length} Buchungen passen lückenlos zum gedruckten Kontostand.` : "Anfangssaldo, alle Buchungen und Endsaldo stimmen überein.")
      : stimmt === false ? (kette.brueche.length ? `An ${kette.brueche.length} Stelle${kette.brueche.length === 1 ? "" : "n"} passt die Buchungsfolge nicht zum gedruckten Kontostand${diff != null ? `; Differenz zum Endsaldo ${(Math.abs(diff) / 100).toFixed(2)} €` : ""}.` : `Zwischen Anfangssaldo, Buchungen und Endsaldo bleibt eine Differenz von ${(Math.abs(diff!) / 100).toFixed(2)} €.`)
      : "Der Auszug nennt keinen Anfangs- oder Endsaldo — die Summe konnte nicht gegengerechnet werden.",
  };
  // ── 4 · Rechnen ───────────────────────────────────────────────────────
  const z = auswerten(buchungen, { saldoAnfang, saldoEnde, dispoLimit: kopf.dispo_limit_cents == null ? null : Math.round(Number(kopf.dispo_limit_cents)) });

  // ── 5 · Merksätze aus den gerechneten Zahlen ──────────────────────────
  let merksaetze: string[] = [];
  try {
    const lage = [
      `Zeitraum ${zeitraumVon || "?"} bis ${zeitraumBis || "?"}, ${z.monate.length} Monat(e).`,
      `Einnahmen ${(z.einnahmen / 100).toFixed(2)} €, Ausgaben ${(z.ausgaben / 100).toFixed(2)} €, bleibt ${((z.einnahmen - z.ausgaben) / 100).toFixed(2)} €.`,
      z.gehalt != null ? `Regelmäßiges Einkommen etwa ${(z.gehalt / 100).toFixed(2)} € im Monat.` : "Kein regelmäßiges Einkommen erkennbar.",
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

  return { status: "fertig", fehler: null, akte: null, modell, seiten: seiten.length, bank: kopf.bank ? String(kopf.bank).slice(0, 80) : null,
           zeitraumVon, zeitraumBis, saldoAnfang, saldoEnde, buchungen, pruefung, z, merksaetze };
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
  const [a] = (await sqlPool`
    SELECT a.ref, a.person_id, a.bank_statement_pdf, a.documents_uploaded_at FROM fiaon_applications a
    WHERE a.ref = ${ref} AND a.merged_into IS NULL LIMIT 1`) as any[];
  if (!a?.bank_statement_pdf) return null;
  if (!opts.erzwingen) {
    const [j] = (await sqlPool`SELECT id, status, created_at, buchungen FROM fiaon_kontoauszug_analysen WHERE ref = ${ref} ORDER BY created_at DESC LIMIT 1`) as any[];
    const juenger = !!j && (!a.documents_uploaded_at || new Date(j.created_at) >= new Date(a.documents_uploaded_at));
    const vollwertig = !!j && (j.status === "laeuft" || j.status === "unlesbar" || liste(j.buchungen).length > 0);
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
    const pr = await kontoauszugProbe(buf);
    if (pr.status !== "fertig" || !pr.z) {
      await fertig({ status: "unlesbar", seiten: pr.seiten, modell: pr.modell, fehler: pr.fehler });
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
      buchungen: JSON.stringify(buchungen), monate: JSON.stringify(z.monate), pruefung: JSON.stringify(pruefung),
      fixkosten: JSON.stringify(z.fixkosten), kategorien: JSON.stringify(z.kategorien),
      warnungen: JSON.stringify(z.warnungen), merksaetze: JSON.stringify(merksaetze),
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
