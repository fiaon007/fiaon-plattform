// ═══════════════════════════════════════════════════════════════════════════
// DIE SCHUFA-ANALYSE — „Was steht da über mich, und was machen wir damit?"
//
// ── DER BEFUND (10.09.2026) ────────────────────────────────────────────────
// Justin über Dirk Ladewig: „Die Schufa die er hochgeladen hat ist 100 %
// vollständig, bedeutet: der KI Agent muss die hochgeladene SCHUFA KOMPLETT
// und 100 % analysieren, eine ehrlich aber PERFEKT aussehende Ampel darstellen
// und ihm Handlungsempfehlungen geben, schreiben vorbereiten und co."
//
// Gemessen: 56 Bestellungen haben eine hochgeladene Bonitätsauskunft. KEINE
// wurde je inhaltlich gelesen. Was es gab, war die Dokumentenprüfung
// (fiaon-dokument-pruefung.ts) — sie beantwortet genau eine Frage: Sieht die
// Datei aus wie eine Bonitätsauskunft? Kein Eintrag, kein Gläubiger, kein
// Datum wurde je erfasst. Dirks 38-seitige Auskunft lag seit dem 03.09.
// ungelesen in der Datenbank.
//
// ── DIE BAUVORLAGE ─────────────────────────────────────────────────────────
// Zwillingsbau zu server/lib/fiaon-kontoauszug-analyse.ts, die seit dem
// 22.08. genau das für den Kontoauszug tut: PDF-Text, ein Modellaufruf mit
// striktem JSON-Schema, eigene Tabelle, Eintrag in die Akte, Anzeige im
// Kundenbereich, ehrliche Fehlerbehandlung.
//
// ── DREI UNTERSCHIEDE, DIE ABSICHT SIND ────────────────────────────────────
// 1. KEIN 60.000-ZEICHEN-DECKEL. Die Dokumentenprüfung liest nur die ersten
//    60.000 Zeichen — bei 38 Seiten ein Bruchteil, und genau daraus entstand
//    das falsche Urteil „unvollständig". Eine Analyse, die Einträge zählt,
//    darf nichts überspringen; sie liest bis 400.000 Zeichen und sagt es,
//    wenn sie kürzen musste.
// 2. DIE AMPEL RECHNET DIESE DATEI, NICHT DAS MODELL. Das Modell liefert
//    Tatsachen (Einträge, Beträge, Daten). Welche Stufe daraus wird,
//    entscheidet `ampelAus()` weiter unten — nachvollziehbar, gleich bei
//    gleicher Lage, und ohne dass ein Modell die Laune hat, jemanden
//    aufzumuntern oder zu erschrecken.
// 3. JEDER KUNDENSATZ GEHT DURCH DIE WAND. `wandPruefen` (shared/
//    fiaon-wortverbote.ts) ist dieselbe Prüfung wie im Postfach. Ein Text
//    über die eigene Bonität ist die heikelste Stelle, an der das Haus
//    schreibt: keine Garantie, keine Empfehlung, keine Rechtsberatung, keine
//    Frist- oder Erfolgszusage. Was durchfällt, wird ersetzt, nicht gezeigt.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { pdfText, pdfTextBrauchbar, pdfSeiten } from "./fiaon-pdf-lesen";
import { wandPruefen } from "@shared/fiaon-wortverbote";

/** So viel Text geht ans Modell. Eine 38-Seiten-Auskunft liegt weit darunter. */
const TEXT_DECKEL = 400_000;
/**
 * Darunter ist es keine Auskunft. Eine SCHUFA-Datenkopie ohne einen einzigen
 * Eintrag hat trotzdem Stammdaten, Erläuterungen und Rechtshinweise — weit über
 * tausend Zeichen. Dogan Cengiz' Datei hatte 105.
 */
const MINDEST_TEXT = 500;

let tabelleGeprueft = false;
export async function ensureSchufaTabelle(): Promise<void> {
  if (tabelleGeprueft) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_schufa_analysen (
      id SERIAL PRIMARY KEY,
      ref VARCHAR NOT NULL,
      person_id INTEGER,
      status VARCHAR NOT NULL DEFAULT 'laeuft',
      fehler TEXT,
      auskunftei VARCHAR,
      auskunft_vom DATE,
      score NUMERIC,
      score_text VARCHAR,
      summe_offen_cents BIGINT,
      eintraege JSONB NOT NULL DEFAULT '[]'::jsonb,
      anfragen JSONB NOT NULL DEFAULT '[]'::jsonb,
      positiv JSONB NOT NULL DEFAULT '[]'::jsonb,
      ampel VARCHAR,
      ampel_grund TEXT,
      empfehlungen JSONB NOT NULL DEFAULT '[]'::jsonb,
      merksaetze JSONB NOT NULL DEFAULT '[]'::jsonb,
      modell VARCHAR,
      seiten INTEGER,
      gekuerzt BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_schufa_analysen_ref_idx ON fiaon_schufa_analysen (ref, created_at DESC)`;
  // ── NACHGEZOGEN AM 10.09.2026 (E-175) ────────────────────────────────────
  // Die Tabelle steht seit gestern in Produktion; CREATE TABLE IF NOT EXISTS
  // ergaenzt keine Spalte. Der Loeschantrag merkt sich hier, wann er
  // beauftragt wurde - sonst schickt derselbe Knopf ihn jeden Tag neu los.
  await sqlPool`ALTER TABLE fiaon_schufa_analysen ADD COLUMN IF NOT EXISTS loeschantrag_am TIMESTAMPTZ`.catch(() => {});
  await sqlPool`ALTER TABLE fiaon_schufa_analysen ADD COLUMN IF NOT EXISTS loeschantrag_posten INTEGER`.catch(() => {});
  tabelleGeprueft = true;
}

export type AmpelStufe = "frei" | "aufraeumen" | "angreifbar" | "dringend";

export interface SchufaEintrag {
  nummer: number | null;
  art: string;
  glaeubiger: string | null;
  betragCents: number | null;
  /** Wie viele Saldo-Meldungen die Auskunft zu diesem Posten führt. */
  meldungen: number | null;
  gemeldetAm: string | null;
  letzterStandAm: string | null;
  erledigtAm: string | null;
  loeschungAm: string | null;
  offen: boolean;
  /** Warum dieser Eintrag Arbeit verträgt — in Kundensprache, ohne Zusage. */
  ansatz: string | null;
  /** Wann dieser Posten nach den Verhaltensregeln zu löschen ist (E-175). */
  loeschung: { faellig: boolean; am: string | null; grund: string; rechtsgrund: string } | null;
}

/**
 * ═══════════════════════════════════════════════════════════════════════════
 * WELCHE POSTEN IN DAS SCHREIBEN AN DIE AUSKUNFTEI GEHÖREN (10.09.2026, E-175)
 *
 * Justin: „Die Einträge die auf 0 sind und gelöscht werden können müssen ja
 * durch uns direkt gelöscht werden."
 *
 * Es sind zwei verschiedene Fälle, und sie brauchen zwei verschiedene Sätze:
 *
 *   ÜBERFÄLLIG — die Speicherfrist ist abgelaufen. Hier gibt es nichts zu
 *   diskutieren: Art. 17 Abs. 1 DSGVO, Löschung.
 *
 *   ZU PRÜFEN — ein offener Posten, für den die Auskunft keinen bezifferten
 *   Betrag nennt (bei Dirk Ladewig sind das sechs von vierzehn: Einträge aus
 *   dem Schuldnerverzeichnis), oder ein erledigter Posten ohne Löschdatum.
 *   Hier ist die Frist NICHT abgelaufen — eine Löschung zu behaupten wäre
 *   falsch. Aber die Auskunftei muss nach Art. 15 DSGVO sagen, worauf der
 *   Eintrag beruht und wann er entfällt; und wo die Meldevoraussetzungen des
 *   § 31 Abs. 2 BDSG nicht belegt sind, greift Art. 17 Abs. 1 lit. d.
 *
 * Diese eine Funktion entscheidet das für BEIDE Seiten: Das Schreiben
 * (fiaon-bonitaet-schreiben.ts) füllt daraus seine zwei Abschnitte, und
 * Kundenbereich wie Betreuerportal lesen die Zahlen aus `schreiben` unten.
 * Stünde die Regel zweimal da, zeigte der Knopf irgendwann eine andere Zahl
 * als der Brief.
 * ═══════════════════════════════════════════════════════════════════════════
 */
export function schreibenPosten(eintraege: SchufaEintrag[]): { ueberfaellig: SchufaEintrag[]; pruefen: SchufaEintrag[] } {
  const alle = Array.isArray(eintraege) ? eintraege : [];
  const ueberfaellig = alle.filter((e) => e?.loeschung?.faellig);
  const pruefen = alle.filter((e) => {
    if (e?.loeschung?.faellig) return false;
    if (e.offen) return e.betragCents == null || e.betragCents === 0;
    return !e.loeschung;
  });
  return { ueberfaellig, pruefen };
}

export interface SchufaAnalyse {
  id: number; ref: string;
  status: "laeuft" | "fertig" | "unlesbar" | "fehler"; fehler: string | null;
  auskunftei: string | null; auskunftVom: string | null;
  score: number | null; scoreText: string | null;
  summeOffenCents: number | null;
  eintraege: SchufaEintrag[];
  anfragen: { stelle: string; am: string | null }[];
  positiv: { art: string; text: string }[];
  ampel: AmpelStufe | null; ampelGrund: string | null;
  empfehlungen: { titel: string; text: string; wer: "kunde" | "fiaon" }[];
  merksaetze: string[];
  seiten: number | null; gekuerzt: boolean;
  /** Wann der Kunde den Loeschantrag beauftragt hat (E-175) - null = noch nie. */
  loeschantragAm: string | null;
  loeschantragPosten: number | null;
  /** Wie viele Posten in das Schreiben gehoeren - je Abschnitt (E-175). */
  schreiben: { ueberfaellig: number; pruefen: number };
  erstelltAm: string;
}

function liste(v: unknown): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") { try { const j = JSON.parse(v); return Array.isArray(j) ? j : []; } catch { return []; } }
  return [];
}
function tagText(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toISOString().slice(0, 10);
}

function zeile(r: any): SchufaAnalyse {
  return {
    id: Number(r.id), ref: r.ref, status: r.status, fehler: r.fehler ?? null,
    auskunftei: r.auskunftei ?? null, auskunftVom: tagText(r.auskunft_vom),
    score: r.score == null ? null : Number(r.score), scoreText: r.score_text ?? null,
    summeOffenCents: r.summe_offen_cents == null ? null : Number(r.summe_offen_cents),
    eintraege: liste(r.eintraege), anfragen: liste(r.anfragen), positiv: liste(r.positiv),
    schreiben: (() => { const t = schreibenPosten(liste(r.eintraege)); return { ueberfaellig: t.ueberfaellig.length, pruefen: t.pruefen.length }; })(),
    ampel: (r.ampel as AmpelStufe) ?? null, ampelGrund: r.ampel_grund ?? null,
    empfehlungen: liste(r.empfehlungen), merksaetze: liste(r.merksaetze),
    seiten: r.seiten == null ? null : Number(r.seiten), gekuerzt: !!r.gekuerzt,
    loeschantragAm: r.loeschantrag_am ? new Date(r.loeschantrag_am).toISOString() : null,
    loeschantragPosten: r.loeschantrag_posten == null ? null : Number(r.loeschantrag_posten),
    erstelltAm: r.created_at,
  };
}

/** Die jüngste Analyse einer Bestellung (oder null). */
export async function schufaAnalyseFuer(ref: string): Promise<SchufaAnalyse | null> {
  await ensureSchufaTabelle();
  const [r] = (await sqlPool`
    SELECT * FROM fiaon_schufa_analysen WHERE ref = ${ref} ORDER BY created_at DESC LIMIT 1
  `) as any[];
  return r ? zeile(r) : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE AMPEL — sie rechnet hier, nicht im Modell
//
// Justin: „eine ehrlich aber PERFEKT aussehende Ampel". Ehrlich heißt: Die
// Stufe folgt aus den Zahlen, nicht aus einer Stimmung. Perfekt aussehend
// heißt: Sie sagt, was ansteht, nicht was jemand wert ist. Deshalb heißen die
// Stufen nach der ARBEIT, die vor einem liegt — keine Schulnote, kein Urteil
// über einen Menschen.
//
// Was die Ampel NICHT bewertet: den Score (er gehört der Auskunftei und ändert
// sich nach deren Regeln), die Kreditwürdigkeit (darüber entscheidet die Bank)
// und die Aussichten eines einzelnen Antrags.
// ═══════════════════════════════════════════════════════════════════════════
// „Vollstreckungsverfahren" steht so in Dirk Ladewigs Auskunft — das engere
// „zwangsvollstreck" hätte es nicht gefasst.
const HART = /insolvenz|eidesstattlich|verm[oö]gensausk|haftbefehl|titel|vollstreck|gerichtlich/i;

export function ampelAus(eintraege: SchufaEintrag[]): { stufe: AmpelStufe; grund: string } {
  const offen = eintraege.filter((e) => e.offen);
  const erledigt = eintraege.filter((e) => !e.offen);
  const hart = eintraege.filter((e) => HART.test(`${e.art} ${e.glaeubiger ?? ""}`));
  const summeOffen = offen.reduce((s, e) => s + (e.betragCents || 0), 0);

  if (hart.length > 0) {
    return {
      stufe: "dringend",
      grund: hart.length === 1
        ? "In Ihrer Auskunft steht ein Eintrag aus einem Gerichts- oder Vollstreckungsverfahren. Solche Einträge wiegen "
          + "am schwersten, und sie brauchen als Erstes Arbeit."
        : `In Ihrer Auskunft stehen ${hart.length} Einträge aus einem Gerichts- oder Vollstreckungsverfahren. Solche `
          + "Einträge wiegen am schwersten, und sie brauchen als Erstes Arbeit.",
    };
  }
  if (offen.length === 0 && erledigt.length === 0) {
    return {
      stufe: "frei",
      grund: "In Ihrer Auskunft steht kein negativer Eintrag. Das ist die Ausgangslage, die sich jede Bank wünscht.",
    };
  }
  if (offen.length === 0) {
    return {
      stufe: "aufraeumen",
      grund: `Alle ${erledigt.length} Einträge sind erledigt und warten nur noch auf ihr Löschdatum. `
        + "Offene Forderungen stehen keine mehr drin.",
    };
  }
  if (offen.length <= 2 && summeOffen <= 200_000) {
    return {
      stufe: "angreifbar",
      grund: `${offen.length === 1 ? "Ein offener Eintrag" : `${offen.length} offene Einträge`} über zusammen `
        + `${(summeOffen / 100).toFixed(2).replace(".", ",")} €. Eine überschaubare Lage — daran lässt sich der Reihe nach arbeiten.`,
    };
  }
  return {
    stufe: "dringend",
    grund: `${offen.length} offene Einträge über zusammen ${(summeOffen / 100).toFixed(2).replace(".", ",")} €. `
      + "Das ist viel auf einmal, und es lohnt sich, gleich mit dem größten anzufangen.",
  };
}

/** Der Satz über der Ampel — kurz, in Sie-Form, ohne Versprechen. */
export const AMPEL_TITEL: Record<AmpelStufe, string> = {
  frei: "Nichts Belastendes gefunden",
  aufraeumen: "Erledigt — es läuft nur noch die Zeit",
  angreifbar: "Überschaubar — hier lässt sich arbeiten",
  dringend: "Viel auf einmal — wir fangen beim Größten an",
};

// ═══════════════════════════════════════════════════════════════════════════
// DAS MODELL LIEFERT TATSACHEN
// ═══════════════════════════════════════════════════════════════════════════
const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    auskunftei: { type: ["string", "null"], description: "SCHUFA, CRIF, Creditreform, KSV1870, Intrum, Boniversum …" },
    auskunft_vom: { type: ["string", "null"], description: "Ausstellungsdatum der Auskunft, YYYY-MM-DD" },
    score: { type: ["number", "null"], description: "Basisscore in Prozent, falls angegeben" },
    score_text: { type: ["string", "null"], description: "Wortlaut der Score-Einordnung, falls angegeben" },
    eintraege: {
      type: "array",
      description: "Die NUMMERIERTEN Bonitätsinformationen der Auskunft (1., 2., 3. …) — EIN Objekt je Nummer, nie je Saldo-Zeile.",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          nummer: { type: ["integer", "null"], description: "Die Nummer der Bonitätsinformation in der Auskunft" },
          art: { type: "string", description: "Wortlaut der Auskunft, z. B. Abwicklungskonto, Vollstreckungsverfahren, Inkasso, Forderung" },
          glaeubiger: { type: ["string", "null"], description: "Vertragspartner oder Gläubiger, falls genannt" },
          betrag_cents: { type: ["integer", "null"], description: "Der ZULETZT gemeldete Forderungsbetrag dieses Postens, nicht die Summe aller Meldungen" },
          meldungen: { type: ["integer", "null"], description: "Wie viele Saldo-Meldungen zu diesem Posten aufgeführt sind" },
          gemeldet_am: { type: ["string", "null"], description: "Datum des ERSTEN Ereignisses, YYYY-MM-DD" },
          letzter_stand_am: { type: ["string", "null"], description: "Datum der JÜNGSTEN Saldo-Meldung, YYYY-MM-DD" },
          erledigt_am: { type: ["string", "null"], description: "YYYY-MM-DD, falls als erledigt/ausgeglichen vermerkt" },
          loeschung_am: { type: ["string", "null"], description: "YYYY-MM-DD, falls ein Löschdatum genannt ist" },
          offen: { type: "boolean", description: "true, solange der Posten nicht als erledigt vermerkt ist" },
        },
        required: ["nummer", "art", "glaeubiger", "betrag_cents", "meldungen", "gemeldet_am", "letzter_stand_am", "erledigt_am", "loeschung_am", "offen"],
      },
    },
    anfragen: {
      type: "array",
      description: "Anfragen von Banken/Anbietern, die in der Auskunft aufgeführt sind.",
      items: {
        type: "object", additionalProperties: false,
        properties: { stelle: { type: "string" }, am: { type: ["string", "null"] } },
        required: ["stelle", "am"],
      },
    },
    positiv: {
      type: "array",
      description: "Positivmerkmale: laufende Verträge ohne Störung, ordnungsgemäß bediente Kredite, Girokonten.",
      items: {
        type: "object", additionalProperties: false,
        properties: { art: { type: "string" }, text: { type: "string" } },
        required: ["art", "text"],
      },
    },
    vollstaendig_gelesen: { type: "boolean", description: "false, wenn der Text erkennbar abbricht" },
    ist_bonitaetsauskunft: {
      type: "boolean",
      description: "true NUR, wenn der Text die Auskunft oder Datenkopie einer Auskunftei ist, die die zur Person gespeicherten Daten aufführt. false bei Rechnungen, Bestell- oder Zahlungsbestätigungen, Anschreiben, Ausweisen, Kontoauszügen, leeren oder fast leeren Seiten.",
    },
  },
  required: ["auskunftei", "auskunft_vom", "score", "score_text", "eintraege", "anfragen", "positiv", "vollstaendig_gelesen", "ist_bonitaetsauskunft"],
} as const;

const ANWEISUNG = [
  "Du liest den Text einer Bonitätsauskunft (SCHUFA, CRIF, Creditreform, KSV1870 oder ähnlich) und erfasst,",
  "was darin steht. Du bewertest NICHT und du empfiehlst NICHTS — du liest.",
  "",
  "DIE WICHTIGSTE REGEL — EIN POSTEN IST NICHT EINE ZEILE:",
  "Eine Bonitätsauskunft führt ihre Posten NUMMERIERT auf (1. Abwicklungskonto, 2. Abwicklungskonto,",
  "10. Vollstreckungsverfahren …). Zu JEDEM Posten meldet der Vertragspartner den Saldo immer wieder neu —",
  "oft monatlich, mit leicht steigendem Betrag durch Zinsen und Gebühren. Diese Wiederholungen sehen aus wie",
  "viele Forderungen, sind aber IMMER DIESELBE. Bei Dirk Ladewigs Auskunft stehen 14 nummerierte Posten und",
  "165 Saldo-Meldungen dazu.",
  "· Liefere GENAU EIN Objekt je NUMMERIERTEM Posten. Niemals eines je Saldo-Zeile.",
  "· betrag_cents ist der ZULETZT gemeldete Forderungsbetrag dieses Postens — nicht die Summe der Meldungen",
  "  und nicht der erste Betrag.",
  "· meldungen ist die Anzahl der Saldo-Meldungen zu diesem Posten.",
  "· gemeldet_am ist das erste genannte Ereignisdatum, letzter_stand_am das jüngste.",
  "",
  "Weitere Regeln:",
  "· Beträge in Cent als ganze Zahlen (Euro × 100). Steht kein Betrag da, schreibe null — erfinde keinen.",
  "· offen = true, solange die Forderung nicht ausdrücklich als erledigt, ausgeglichen oder bezahlt vermerkt ist.",
  "· Datumsangaben als YYYY-MM-DD. Steht nur ein Monat da, nimm den ersten des Monats. Steht nichts da, null.",
  "· Ein fehlender Score ist normal: Eine Datenkopie nach Art. 15 DSGVO enthält planmäßig keinen. Dann null.",
  "· Namen, Anschriften und Geburtsdaten der Person gehören NICHT in die Antwort.",
  "· vollstaendig_gelesen = false nur, wenn der Text sichtbar mitten im Satz oder mitten in einer Tabelle abbricht.",
  "· ist_bonitaetsauskunft = false, wenn das Dokument KEINE Auskunft ist — etwa eine Rechnung über eine Auskunft,",
  "  eine Bestellbestätigung, ein Anschreiben oder ein Foto mit kaum Text. Dann alle Listen leer lassen. Das Wort",
  "  „SCHUFA\" allein macht ein Dokument nicht zur Auskunft.",
].join("\n");

async function openaiAuswertung(text: string): Promise<{ modell: string; daten: any }> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY fehlt.");
  const modell = process.env.FIAON_ANALYSE_MODELL || "gpt-4.1-mini";
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modell, temperature: 0,
      response_format: { type: "json_schema", json_schema: { name: "bonitaetsauskunft", strict: true, schema: SCHEMA } },
      messages: [
        { role: "system", content: ANWEISUNG },
        { role: "user", content: `Bonitätsauskunft (Text, mehrere Seiten):\n\n${text}` },
      ],
    }),
  });
  const j: any = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${j?.error?.message || "unbekannt"}`);
  return { modell, daten: JSON.parse(String(j?.choices?.[0]?.message?.content || "{}")) };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER ANSATZ JE EINTRAG UND DIE EMPFEHLUNGEN — beides rechnet diese Datei
//
// Kein Modell formuliert hier. Die Sätze stehen fest, weil sie rechtlich
// heikel sind: Sie beschreiben, was FIAON TUT, und sagen dazu, wer entscheidet.
// Kein „wird gelöscht", kein „steht Ihnen zu", keine Frist.
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// WANN IST EIN POSTEN ZU LÖSCHEN? (10.09.2026, E-175)
//
// Justin: „Die Einträge die auf 0 sind und gelöscht werden können müssen ja
// durch uns direkt gelöscht werden."
//
// Diese Funktion rechnet die Frist, sie behauptet nichts. Alle Regeln stehen im
// Hauswissen (client/src/pages/agent/academy/kapitel-6-schufa.ts) MIT Quelle:
//   · Erledigte Forderung: drei Jahre taggenau nach der Erledigung
//     (Verhaltensregeln der Wirtschaftsauskunfteien, Fassung 2024).
//     Wurde binnen 100 Tagen nach der Meldung bezahlt: achtzehn Monate.
//   · Vollstreckungsverfahren / Schuldnerverzeichnis: drei Jahre (§ 882e ZPO).
//   · Restschuldbefreiung: sechs Monate (EuGH, 7.12.2023, C-26/22 und C-64/22).
//   · Ein in der Auskunft GENANNTES Löschdatum geht allem vor — steht es in der
//     Vergangenheit, ist die Löschung überfällig.
//
// Was hier NICHT passiert: eine offene Forderung für löschbar erklären. Ein
// berechtigter Eintrag mit ordnungsgemäßen Mahnungen bleibt seine Frist stehen;
// das steht so im Hauswissen und wird dem Kunden auch so gesagt.
// ═══════════════════════════════════════════════════════════════════════════
function monatePlus(iso: string, n: number): string {
  const [j, m, t] = iso.split("-").map(Number);
  const gesamt = j * 12 + (m - 1) + n;
  const jahr = Math.floor(gesamt / 12);
  const monat = (gesamt % 12) + 1;
  const letzter = new Date(Date.UTC(jahr, monat, 0)).getUTCDate();
  return `${jahr}-${String(monat).padStart(2, "0")}-${String(Math.min(t, letzter)).padStart(2, "0")}`;
}

const VOLLSTRECKUNG = /vollstreck|schuldnerverzeichnis|verm[oö]gensausk|haftbefehl/i;
const RESTSCHULD = /restschuldbefreiung|insolvenz/i;

export function loeschungFuer(e: SchufaEintrag, heute: string): SchufaEintrag["loeschung"] {
  const bezeichnung = `${e.art} ${e.glaeubiger ?? ""}`;
  const fertig = (am: string, grund: string, rechtsgrund: string) =>
    ({ faellig: am <= heute, am, grund, rechtsgrund });

  // Ein genanntes Löschdatum geht allem vor.
  if (e.loeschungAm) {
    return fertig(e.loeschungAm, "Die Auskunft nennt dieses Löschdatum selbst.",
      "Verhaltensregeln der Wirtschaftsauskunfteien, Fassung 2024");
  }
  if (RESTSCHULD.test(bezeichnung) && e.gemeldetAm) {
    return fertig(monatePlus(e.gemeldetAm, 6),
      "Sechs Monate nach Erteilung der Restschuldbefreiung.",
      "EuGH, Urteile vom 7.12.2023, C-26/22 und C-64/22");
  }
  if (VOLLSTRECKUNG.test(bezeichnung) && e.gemeldetAm) {
    return fertig(monatePlus(e.gemeldetAm, 36),
      "Drei Jahre nach der Eintragung im Schuldnerverzeichnis.", "§ 882e ZPO");
  }
  if (!e.offen && e.erledigtAm) {
    // Die 100-Tage-Regel verkürzt auf achtzehn Monate — nur wenn beide Daten da sind.
    const binnen100 = !!e.gemeldetAm
      && (Date.parse(e.erledigtAm) - Date.parse(e.gemeldetAm)) / 86_400_000 <= 100;
    return binnen100
      ? fertig(monatePlus(e.erledigtAm, 18),
          "Achtzehn Monate, weil binnen hundert Tagen nach der Meldung ausgeglichen wurde.",
          "Verhaltensregeln der Wirtschaftsauskunfteien, Fassung 2024 (100-Tage-Regel)")
      : fertig(monatePlus(e.erledigtAm, 36), "Drei Jahre taggenau nach der Erledigung.",
          "Verhaltensregeln der Wirtschaftsauskunfteien, Fassung 2024");
  }
  return null;
}

const dtDE = (iso: string) => iso.split("-").reverse().join(".");

function ansatzFuer(e: SchufaEintrag, heute: string): string | null {
  const l = e.loeschung;
  // Überfällig schlägt alles: Ein Posten, dessen Frist abgelaufen ist, gehört
  // weg — und das ist der Satz, den ein Kunde zuerst lesen soll.
  if (l?.faellig) {
    return `Die Speicherfrist für diesen Posten ist am ${dtDE(l.am!)} abgelaufen (${l.grund}). Wir fordern die Löschung `
      + "bei der Auskunftei an. Sie müssen dafür nichts tun.";
  }
  if (l?.am) {
    return `Nach den geltenden Fristen entfällt dieser Posten am ${dtDE(l.am)} (${l.grund}). Wir halten den Termin nach `
      + "und melden uns, wenn er dann noch stehen sollte.";
  }
  if (HART.test(`${e.art} ${e.glaeubiger ?? ""}`)) {
    return "Einträge aus einem Gerichts- oder Vollstreckungsverfahren folgen eigenen Regeln. Wir sehen uns die Unterlagen an "
      + "und sagen Ihnen, was möglich ist.";
  }
  if (!e.offen) {
    return "Erledigt, aber ohne vermerktes Löschdatum. Wir fragen die Auskunftei, wann der Posten entfällt.";
  }
  if (e.betragCents != null && e.betragCents > 0) {
    return "Offene Forderung. Wir fordern beim Gläubiger die Unterlagen an: die beiden Mahnungen mit Zugangsnachweis, den "
      + "Hinweis auf die Meldung und eine Forderungsaufstellung. Fehlt davon etwas, ist die Meldung angreifbar.";
  }
  return "Offener Posten ohne Betrag. Wir fordern beim Gläubiger die Unterlagen an, damit klar wird, worum es geht.";
}

function empfehlungenAus(eintraege: SchufaEintrag[], anfragen: number, score: number | null): { titel: string; text: string; wer: "kunde" | "fiaon" }[] {
  const out: { titel: string; text: string; wer: "kunde" | "fiaon" }[] = [];
  const offen = eintraege.filter((e) => e.offen);
  const erledigtOhneDatum = eintraege.filter((e) => !e.offen && !e.loeschungAm);

  const loeschbar = eintraege.filter((e) => e.loeschung?.faellig);
  if (loeschbar.length) {
    out.push({
      titel: `Löschung von ${loeschbar.length === 1 ? "einem Posten" : `${loeschbar.length} Posten`} anfordern`,
      text: "Bei " + (loeschbar.length === 1 ? "einem Posten" : `${loeschbar.length} Posten`) + " ist die Speicherfrist "
        + "abgelaufen. Wir schreiben die Auskunftei an und verlangen die Löschung nach Art. 17 DSGVO, mit Frist und "
        + "Bitte um Bestätigung. Ein Klick genügt, den Rest übernehmen wir.",
      wer: "fiaon",
    });
  }
  // ── NUR POSTEN MIT BEZIFFERTEM BETRAG (10.09.2026, E-175) ────────────────
  // Vorher zaehlte diese Empfehlung alle offenen Posten. Bei Dirk Ladewig stand
  // dort „Unterlagen zu den 14 offenen Forderungen anfordern" — sechs davon sind
  // Vollstreckungsvermerke aus dem Schuldnerverzeichnis. Dort gibt es keinen
  // Glaeubiger, den man um einen Vertrag bitten koennte; fuer sie ist die
  // Pruefbitte an die Auskunftei der Weg, und die steht als eigene Empfehlung.
  const beziffert = offen.filter((e) => (e.betragCents ?? 0) > 0);
  if (beziffert.length) {
    out.push({
      titel: `Unterlagen zu ${beziffert.length === 1 ? "der offenen Forderung" : `den ${beziffert.length} offenen Forderungen`} anfordern`,
      text: "Wir schreiben die Gläubiger an und verlangen den Nachweis: Vertrag, Abrechnung, Zeitpunkt. Ohne belegte Forderung "
        + "steht ein Eintrag auf schwachen Füßen. Sie müssen dafür nichts tun.",
      wer: "fiaon",
    });
  }
  const zuPruefen = schreibenPosten(eintraege).pruefen;
  if (zuPruefen.length) {
    out.push({
      titel: `Auskunft und Prüfung zu ${zuPruefen.length === 1 ? "einem Eintrag" : `${zuPruefen.length} Einträgen`} verlangen`,
      text: `Zu ${zuPruefen.length === 1 ? "einem Eintrag" : `${zuPruefen.length} Einträgen`} nennt Ihre Auskunft keinen `
        + "bezifferten Betrag. Wir verlangen von der Auskunftei nach Art. 15 DSGVO Auskunft, worauf sie beruhen und wann "
        + "sie entfallen — und wo die Meldevoraussetzungen nicht belegt sind, beantragen wir die Löschung. Ein Klick genügt.",
      wer: "fiaon",
    });
  }
  if (erledigtOhneDatum.length) {
    out.push({
      titel: "Löschdaten der erledigten Einträge klären",
      text: `Bei ${erledigtOhneDatum.length === 1 ? "einem erledigten Eintrag" : `${erledigtOhneDatum.length} erledigten Einträgen`} `
        + "steht kein Löschdatum. Wir fragen bei der Auskunftei nach, wann sie entfallen.",
      wer: "fiaon",
    });
  }
  out.push({
    titel: "Alles Laufende pünktlich halten",
    text: "Jede pünktliche Zahlung in den nächsten Monaten arbeitet für Sie — bei Ihren Verträgen genauso wie bei Ihrer Rate hier. "
      + "Das ist der Teil, den niemand für Sie übernehmen kann.",
    wer: "kunde",
  });
  if (anfragen >= 5) {
    out.push({
      titel: "Vorerst keine weiteren Anfragen stellen",
      text: `In Ihrer Auskunft stehen ${anfragen} Anfragen. Viele Anfragen in kurzer Zeit fallen auf. Warten Sie mit weiteren `
        + "Anträgen, bis Ihre Akte aufgeräumt ist.",
      wer: "kunde",
    });
  }
  if (score == null) {
    out.push({
      titel: "Auskunft mit Score nachreichen, falls vorhanden",
      text: "Ihre Auskunft enthält keinen Score — bei einer Datenkopie nach Art. 15 DSGVO ist das normal. Haben Sie zusätzlich "
        + "eine Bonitätsauskunft mit Score, laden Sie sie gern hoch. Zwingend ist sie nicht.",
      wer: "kunde",
    });
  }
  return out;
}

/**
 * Jeder Satz, den ein Kunde zu sehen bekommt, geht durch die Wand des Hauses.
 * Fällt einer durch, wird er ERSETZT — nicht gezeigt und nicht stillschweigend
 * weggelassen, damit im Protokoll steht, dass hier etwas war.
 */
function durchDieWand(text: string, wo: string, ref: string): string {
  const treffer = wandPruefen(text).filter((t) => t.art !== "floskel");
  if (!treffer.length) return text;
  console.warn(`[SCHUFA-ANALYSE] ${ref}: Wand hat ${wo} gestoppt — ${treffer.map((t) => t.treffer).join(", ")}`);
  return "Zu diesem Punkt sagt Ihnen Ihre Ansprechpartnerin im Gespräch mehr.";
}

/**
 * Die Analyse anstoßen. Idempotent je Upload: Eine fertige Analyse, die JÜNGER
 * als der Upload ist, wird nicht wiederholt — außer mit `erzwingen`.
 */
export async function schufaAnalysieren(ref: string, opts: { erzwingen?: boolean } = {}): Promise<SchufaAnalyse | null> {
  await ensureSchufaTabelle();
  const [a] = (await sqlPool`
    SELECT a.ref, a.person_id, a.schufa_pdf, a.documents_uploaded_at
    FROM fiaon_applications a WHERE a.ref = ${ref} AND a.merged_into IS NULL LIMIT 1
  `) as any[];
  if (!a?.schufa_pdf) return null;

  if (!opts.erzwingen) {
    const [j] = (await sqlPool`
      SELECT id, status, created_at FROM fiaon_schufa_analysen WHERE ref = ${ref} ORDER BY created_at DESC LIMIT 1
    `) as any[];
    if (j && j.status === "fertig"
        && (!a.documents_uploaded_at || new Date(j.created_at) >= new Date(a.documents_uploaded_at))) {
      return schufaAnalyseFuer(ref);
    }
  }

  const [neu] = (await sqlPool`
    INSERT INTO fiaon_schufa_analysen (ref, person_id, status) VALUES (${ref}, ${a.person_id ?? null}, 'laeuft') RETURNING id
  `) as any[];
  const id = Number(neu.id);
  const JSONB = new Set(["eintraege", "anfragen", "positiv", "empfehlungen", "merksaetze"]);
  const fertig = async (felder: Record<string, any>) => {
    const cols = Object.keys(felder);
    const sets = cols.map((c, i) => `${c} = $${i + 1}${JSONB.has(c) ? "::jsonb" : ""}`).join(", ");
    await sqlPool.unsafe(
      `UPDATE fiaon_schufa_analysen SET ${sets}, updated_at = NOW() WHERE id = $${cols.length + 1}`,
      [...cols.map((c) => felder[c]), id],
    );
  };

  try {
    const buf: Buffer = Buffer.isBuffer(a.schufa_pdf) ? a.schufa_pdf : Buffer.from(a.schufa_pdf);
    let seiten: number | null = null;
    try { seiten = await pdfSeiten(buf); } catch { /* Seitenzahl ist Beiwerk */ }
    let text = "";
    try { text = await pdfText(buf); } catch (e) { console.warn("[SCHUFA-ANALYSE] PDF nicht lesbar:", (e as Error).message); }
    if (!pdfTextBrauchbar(text)) {
      await fertig({
        status: "unlesbar", seiten,
        fehler: "Die Datei enthält keinen lesbaren Text (Foto oder Scan). Bitte laden Sie die Auskunft als PDF hoch, "
          + "so wie die Auskunftei sie verschickt hat.",
      });
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
        VALUES (${ref}, NULL, 'System', 'system',
                'Bonitätsauskunft: Datei ohne lesbaren Text (Foto oder Scan). Der Kunde sieht die Bitte um ein PDF.')
      `.catch(() => {});
      return schufaAnalyseFuer(ref);
    }

    // ── KEINE AUSKUNFT, KEINE AMPEL (11.09.2026) ──────────────────────────
    // Zwei von drei ausgewerteten Kunden bekamen am 10./11.09. „Nichts
    // Belastendes gefunden — die Ausgangslage, die sich jede Bank wünscht" —
    // über Dateien, die gar keine Auskunft waren: bei Dogan Cengiz eine Seite
    // mit 105 Zeichen Text, bei Silvia Camara Pinter eine Rechnung. Eine leere
    // Liste ist nur dann eine gute Nachricht, wenn feststeht, dass eine
    // Auskunft gelesen wurde. Deshalb zwei Wände:
    //   1. Unter MINDEST_TEXT Zeichen ist es keine vollständige Auskunft — kein
    //      Modellaufruf, kein Geld.
    //   2. Das Modell muss sagen, ob es eine Auskunft IST; ohne Auskunftei-Namen
    //      und ohne einen einzigen Posten zählt es ebenfalls nicht.
    // In beiden Fällen wird die Analyse „unlesbar" mit einem Satz, der sagt,
    // was stattdessen gebraucht wird — nie „frei".
    const keineAuskunft = async (warum: string, intern: string) => {
      await fertig({ status: "unlesbar", seiten, fehler: warum });
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
        VALUES (${ref}, NULL, 'System', 'system', ${`Bonitätsauskunft nicht auswertbar: ${intern}`})
      `.catch(() => {});
      return schufaAnalyseFuer(ref);
    };
    const BITTE = "Bitte laden Sie Ihre Bonitätsauskunft hoch, so wie die Auskunftei sie verschickt hat — "
      + "zum Beispiel die SCHUFA-Datenkopie als PDF.";
    if (text.trim().length < MINDEST_TEXT) {
      return keineAuskunft(
        `Die Datei enthält fast keinen Text und ist deshalb keine vollständige Bonitätsauskunft. ${BITTE}`,
        `${text.trim().length} Zeichen Text auf ${seiten ?? "?"} Seite(n) — zu wenig für eine Auskunft. Der Kunde sieht die Bitte um die richtige Datei.`,
      );
    }

    const gekuerzt = text.length > TEXT_DECKEL;
    const { modell, daten } = await openaiAuswertung(text.slice(0, TEXT_DECKEL));

    const listenLeer = !(daten.eintraege || []).length && !(daten.anfragen || []).length;
    if (daten.ist_bonitaetsauskunft === false || (!daten.auskunftei && listenLeer)) {
      return keineAuskunft(
        `Diese Datei ist keine Bonitätsauskunft. ${BITTE}`,
        `Die Datei (${seiten ?? "?"} Seite(n)) ist laut Auswertung keine Auskunft einer Auskunftei — z. B. eine Rechnung oder Bestätigung. Der Kunde sieht die Bitte um die richtige Datei.`,
      );
    }

    const heute = new Date().toISOString().slice(0, 10);
    const eintraege: SchufaEintrag[] = (daten.eintraege || []).map((e: any) => {
      const roh: SchufaEintrag = {
        nummer: e.nummer ?? null,
        art: String(e.art || "Eintrag"),
        glaeubiger: e.glaeubiger ? String(e.glaeubiger) : null,
        betragCents: e.betrag_cents ?? null,
        meldungen: e.meldungen ?? null,
        gemeldetAm: e.gemeldet_am || null,
        letzterStandAm: e.letzter_stand_am || null,
        erledigtAm: e.erledigt_am || null,
        loeschungAm: e.loeschung_am || null,
        offen: e.offen !== false,
        ansatz: null,
        loeschung: null,
      };
      roh.loeschung = loeschungFuer(roh, heute);
      roh.ansatz = durchDieWand(ansatzFuer(roh, heute) || "", "einen Ansatz", ref);
      return roh;
    });

    const ampel = ampelAus(eintraege);
    const summeOffen = eintraege.filter((e) => e.offen).reduce((s, e) => s + (e.betragCents || 0), 0);
    const anfragen = (daten.anfragen || []).map((x: any) => ({ stelle: String(x.stelle || "?"), am: x.am || null }));
    const positiv = (daten.positiv || []).map((x: any) => ({ art: String(x.art || ""), text: String(x.text || "") }));
    const empfehlungen = empfehlungenAus(eintraege, anfragen.length, daten.score ?? null)
      .map((v) => ({ ...v, text: durchDieWand(v.text, `die Empfehlung „${v.titel}“`, ref) }));

    const merksaetze = [
      durchDieWand(ampel.grund, "den Ampel-Satz", ref),
      eintraege.length
        ? `Wir haben ${eintraege.length === 1 ? "einen Eintrag" : `${eintraege.length} Einträge`} erfasst und jedem einen `
          + "nächsten Schritt zugeordnet."
        : "Wir haben keine negativen Einträge gefunden.",
      positiv.length
        ? `Dazu ${positiv.length === 1 ? "ein Merkmal" : `${positiv.length} Merkmale`}, die für Sie sprechen — die zählen mit.`
        : "Über Karte, Konto und Rahmen entscheidet am Ende die Bank. Wir bereiten alles vor.",
    ].filter(Boolean);

    await fertig({
      status: "fertig", modell, seiten, gekuerzt,
      auskunftei: daten.auskunftei || null,
      auskunft_vom: daten.auskunft_vom || null,
      score: daten.score ?? null,
      score_text: daten.score_text || null,
      summe_offen_cents: summeOffen,
      eintraege: JSON.stringify(eintraege),
      anfragen: JSON.stringify(anfragen),
      positiv: JSON.stringify(positiv),
      ampel: ampel.stufe,
      ampel_grund: durchDieWand(ampel.grund, "den Ampel-Grund", ref),
      empfehlungen: JSON.stringify(empfehlungen),
      merksaetze: JSON.stringify(merksaetze),
    });

    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note)
      VALUES (${ref}, NULL, 'System', 'system',
              ${`Bonitätsauskunft ausgewertet (${daten.auskunftei || "Auskunftei unbekannt"}, ${seiten ?? "?"} Seiten): `
                + `${eintraege.length} Eintrag/Einträge, davon ${eintraege.filter((e) => e.offen).length} offen über `
                + `${(summeOffen / 100).toFixed(2)} €, ${anfragen.length} Anfragen, ${positiv.length} Positivmerkmale. `
                + `Ampel: ${AMPEL_TITEL[ampel.stufe]}.`})
    `.catch(() => {});

    return schufaAnalyseFuer(ref);
  } catch (e: any) {
    await fertig({ status: "fehler", fehler: String(e?.message || e).slice(0, 500) });
    console.error("[SCHUFA-ANALYSE]", ref, e);
    return schufaAnalyseFuer(ref);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DER LÖSCHANTRAG IST BEAUFTRAGT (10.09.2026, E-175)
//
// Justin: „Die Einträge die auf 0 sind und gelöscht werden können müssen ja
// durch uns direkt gelöscht werden … er muss mit 1 Klick die Auskunftei
// anschreiben können."
//
// Ein Klick darf nicht heißen: jeden Tag ein neuer Antrag. Deshalb steht der
// Zeitpunkt an der Analyse. Der Knopf im Kundenbereich liest ihn und sagt
// danach, wann der Antrag rausging — statt ein zweites Mal anzubieten.
// ═══════════════════════════════════════════════════════════════════════════
export async function loeschantragVermerken(ref: string, posten: number): Promise<string | null> {
  await ensureSchufaTabelle();
  const [r] = (await sqlPool`
    UPDATE fiaon_schufa_analysen
       SET loeschantrag_am = NOW(), loeschantrag_posten = ${posten}, updated_at = NOW()
     WHERE id = (SELECT id FROM fiaon_schufa_analysen WHERE ref = ${ref} ORDER BY created_at DESC LIMIT 1)
     RETURNING loeschantrag_am
  `.catch(() => [] as any[])) as any[];
  return r?.loeschantrag_am ? new Date(r.loeschantrag_am).toISOString() : null;
}
