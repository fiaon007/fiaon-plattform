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
  tabelleGeprueft = true;
}

export type AmpelStufe = "frei" | "aufraeumen" | "angreifbar" | "dringend";

export interface SchufaEintrag {
  art: string;
  glaeubiger: string | null;
  betragCents: number | null;
  gemeldetAm: string | null;
  erledigtAm: string | null;
  loeschungAm: string | null;
  offen: boolean;
  /** Warum dieser Eintrag Arbeit verträgt — in Kundensprache, ohne Zusage. */
  ansatz: string | null;
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
    ampel: (r.ampel as AmpelStufe) ?? null, ampelGrund: r.ampel_grund ?? null,
    empfehlungen: liste(r.empfehlungen), merksaetze: liste(r.merksaetze),
    seiten: r.seiten == null ? null : Number(r.seiten), gekuerzt: !!r.gekuerzt,
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
const HART = /insolvenz|eidesstattlich|verm[oö]gensausk|haftbefehl|titel|zwangsvollstreck/i;

export function ampelAus(eintraege: SchufaEintrag[]): { stufe: AmpelStufe; grund: string } {
  const offen = eintraege.filter((e) => e.offen);
  const erledigt = eintraege.filter((e) => !e.offen);
  const hart = eintraege.filter((e) => HART.test(`${e.art} ${e.glaeubiger ?? ""}`));
  const summeOffen = offen.reduce((s, e) => s + (e.betragCents || 0), 0);

  if (hart.length > 0) {
    return {
      stufe: "dringend",
      grund: `In Ihrer Auskunft steht ${hart.length === 1 ? "ein Eintrag" : `${hart.length} Einträge`} aus einem Gerichts- oder `
        + "Vollstreckungsverfahren. Solche Einträge wiegen am schwersten, und sie brauchen als Erstes Arbeit.",
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
      description: "JEDER Negativeintrag: offene und erledigte Forderungen, Kredite in Verzug, Inkasso, Titel, Insolvenz.",
      items: {
        type: "object", additionalProperties: false,
        properties: {
          art: { type: "string", description: "z. B. Forderung, Inkasso, Kredit, Girokonto gekündigt, Titel, Insolvenz" },
          glaeubiger: { type: ["string", "null"] },
          betrag_cents: { type: ["integer", "null"] },
          gemeldet_am: { type: ["string", "null"], description: "YYYY-MM-DD" },
          erledigt_am: { type: ["string", "null"], description: "YYYY-MM-DD, falls als erledigt/ausgeglichen vermerkt" },
          loeschung_am: { type: ["string", "null"], description: "YYYY-MM-DD, falls ein Löschdatum genannt ist" },
          offen: { type: "boolean", description: "true, solange die Forderung nicht als erledigt vermerkt ist" },
        },
        required: ["art", "glaeubiger", "betrag_cents", "gemeldet_am", "erledigt_am", "loeschung_am", "offen"],
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
  },
  required: ["auskunftei", "auskunft_vom", "score", "score_text", "eintraege", "anfragen", "positiv", "vollstaendig_gelesen"],
} as const;

const ANWEISUNG = [
  "Du liest den Text einer Bonitätsauskunft (SCHUFA, CRIF, Creditreform, KSV1870 oder ähnlich) und erfasst,",
  "was darin steht. Du bewertest NICHT und du empfiehlst NICHTS — du liest.",
  "",
  "Regeln:",
  "· Erfasse JEDEN Negativeintrag einzeln, auch mehrfach genannte. Lieber einen zu viel als einen zu wenig.",
  "· Beträge in Cent als ganze Zahlen (Euro × 100). Steht kein Betrag da, schreibe null — erfinde keinen.",
  "· offen = true, solange die Forderung nicht ausdrücklich als erledigt, ausgeglichen oder bezahlt vermerkt ist.",
  "· Datumsangaben als YYYY-MM-DD. Steht nur ein Monat da, nimm den ersten des Monats. Steht nichts da, null.",
  "· Ein fehlender Score ist normal: Eine Datenkopie nach Art. 15 DSGVO enthält planmäßig keinen. Dann null.",
  "· Namen, Anschriften und Geburtsdaten der Person gehören NICHT in die Antwort.",
  "· vollstaendig_gelesen = false nur, wenn der Text sichtbar mitten im Satz oder mitten in einer Tabelle abbricht.",
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
function ansatzFuer(e: SchufaEintrag, heute: string): string | null {
  if (HART.test(`${e.art} ${e.glaeubiger ?? ""}`)) {
    return "Einträge aus einem Gerichts- oder Vollstreckungsverfahren folgen eigenen Regeln. Wir sehen uns die Unterlagen an "
      + "und sagen Ihnen, was möglich ist.";
  }
  if (!e.offen && e.loeschungAm && e.loeschungAm <= heute) {
    return "Dieser Eintrag ist erledigt und sein Löschdatum ist erreicht. Wir fragen bei der Auskunftei nach, warum er noch steht.";
  }
  if (!e.offen && e.loeschungAm) {
    return `Erledigt. Als Löschdatum ist der ${e.loeschungAm.split("-").reverse().join(".")} vermerkt. Wir behalten den Termin im Blick.`;
  }
  if (!e.offen) {
    return "Erledigt, aber ohne vermerktes Löschdatum. Wir fragen die Auskunftei, wann der Eintrag entfällt.";
  }
  if (e.betragCents != null && e.betragCents > 0) {
    return "Offene Forderung. Wir prüfen die Unterlagen des Gläubigers: Ist die Forderung belegt, ist die Höhe richtig, "
      + "ist sie noch durchsetzbar? Was dabei herauskommt, entscheidet den nächsten Schritt.";
  }
  return "Offener Eintrag ohne Betrag. Wir fordern beim Gläubiger die Unterlagen an, damit klar wird, worum es geht.";
}

function empfehlungenAus(eintraege: SchufaEintrag[], anfragen: number, score: number | null): { titel: string; text: string; wer: "kunde" | "fiaon" }[] {
  const out: { titel: string; text: string; wer: "kunde" | "fiaon" }[] = [];
  const offen = eintraege.filter((e) => e.offen);
  const erledigtOhneDatum = eintraege.filter((e) => !e.offen && !e.loeschungAm);

  if (offen.length) {
    out.push({
      titel: `Unterlagen zu ${offen.length === 1 ? "der offenen Forderung" : `den ${offen.length} offenen Forderungen`} anfordern`,
      text: "Wir schreiben die Gläubiger an und verlangen den Nachweis: Vertrag, Abrechnung, Zeitpunkt. Ohne belegte Forderung "
        + "steht ein Eintrag auf schwachen Füßen. Sie müssen dafür nichts tun.",
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

    const gekuerzt = text.length > TEXT_DECKEL;
    const { modell, daten } = await openaiAuswertung(text.slice(0, TEXT_DECKEL));

    const heute = new Date().toISOString().slice(0, 10);
    const eintraege: SchufaEintrag[] = (daten.eintraege || []).map((e: any) => {
      const roh: SchufaEintrag = {
        art: String(e.art || "Eintrag"),
        glaeubiger: e.glaeubiger ? String(e.glaeubiger) : null,
        betragCents: e.betrag_cents ?? null,
        gemeldetAm: e.gemeldet_am || null,
        erledigtAm: e.erledigt_am || null,
        loeschungAm: e.loeschung_am || null,
        offen: e.offen !== false,
        ansatz: null,
      };
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
