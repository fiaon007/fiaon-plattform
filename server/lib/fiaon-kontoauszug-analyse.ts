// ═══════════════════════════════════════════════════════════════════════════
// DIE KONTOAUSZUG-ANALYSE — „Wohin Ihr Geld geht: nicht geschätzt, gezählt"
//
// ── DER BEFUND (Justin als Kunde, 22.08.2026) ──────────────────────────────
// „Ich habe meinen Kontoauszug hochgeladen — aber es gab keine Auswertung!"
// Es gab keine. Die Datei lag in der Datenbank, die Verwaltung konnte sie
// genehmigen oder zurückweisen — mehr nicht. „Meine Finanzen" war eine
// Vorschau („nach der Analyse"). Das hier ist die Analyse.
//
// ── WIE ──────────────────────────────────────────────────────────────────────
// 1. Text aus dem PDF (server/lib/fiaon-pdf-lesen.ts — dieselbe Maschine wie
//    Firefox). Ein Foto/Scan hat keinen Text → „unlesbar", der Kunde erfährt es.
// 2. Strukturierte Auswertung über OpenAI (JSON-Schema, keine freie Prosa):
//    Zeitraum, Einnahmen, Ausgaben, Gehalt, Fixkosten, Dispo, Rücklastschriften,
//    Inkasso-/Mahn-Hinweise, Kategorien, drei Merksätze in Sie-Form.
// 3. Ergebnis in `fiaon_kontoauszug_analysen`, Eintrag in die Akte, Anzeige im
//    Kundenbereich. Der Kontoauszug selbst bleibt, wo er war; an das Modell
//    geht nur Text, keine Datei, und kein Name wird mitgeschickt.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { pdfText, pdfTextBrauchbar } from "./fiaon-pdf-lesen";

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
  tabelleGeprueft = true;
}

export interface Analyse {
  id: number; ref: string; status: "laeuft" | "fertig" | "unlesbar" | "fehler"; fehler: string | null;
  zeitraumVon: string | null; zeitraumBis: string | null;
  einnahmenCents: number | null; ausgabenCents: number | null; gehaltCents: number | null; saldoEndeCents: number | null;
  dispoGenutzt: boolean | null; dispoTiefstCents: number | null; ruecklastschriften: number;
  fixkosten: { name: string; betragCents: number; rhythmus: string; kategorie: string }[];
  kategorien: { name: string; betragCents: number; anteil: number }[];
  warnungen: { art: string; text: string; betragCents?: number | null }[];
  merksaetze: string[];
  erstelltAm: string;
}

/** JSONB kommt als Array — oder, aus einem frühen Lauf, als JSON-Text. Beides lesen. */
function liste(v: unknown): any[] {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") { try { const j = JSON.parse(v); return Array.isArray(j) ? j : []; } catch { return []; } }
  return [];
}
function tagText(v: unknown): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const d = new Date(String(v)); return isNaN(d.getTime()) ? String(v).slice(0, 10) : d.toISOString().slice(0, 10);
}

function zeile(r: any): Analyse {
  return {
    id: Number(r.id), ref: r.ref, status: r.status, fehler: r.fehler ?? null,
    zeitraumVon: tagText(r.zeitraum_von),
    zeitraumBis: tagText(r.zeitraum_bis),
    einnahmenCents: r.einnahmen_cents == null ? null : Number(r.einnahmen_cents),
    ausgabenCents: r.ausgaben_cents == null ? null : Number(r.ausgaben_cents),
    gehaltCents: r.gehalt_cents == null ? null : Number(r.gehalt_cents),
    saldoEndeCents: r.saldo_ende_cents == null ? null : Number(r.saldo_ende_cents),
    dispoGenutzt: r.dispo_genutzt ?? null, dispoTiefstCents: r.dispo_tiefst_cents == null ? null : Number(r.dispo_tiefst_cents),
    ruecklastschriften: Number(r.ruecklastschriften || 0),
    fixkosten: liste(r.fixkosten), kategorien: liste(r.kategorien),
    warnungen: liste(r.warnungen), merksaetze: liste(r.merksaetze),
    erstelltAm: r.created_at,
  };
}

/** Die jüngste Analyse einer Bestellung (oder null). */
export async function analyseFuer(ref: string): Promise<Analyse | null> {
  await ensureAnalyseTabelle();
  const [r] = (await sqlPool`SELECT * FROM fiaon_kontoauszug_analysen WHERE ref = ${ref} ORDER BY created_at DESC LIMIT 1`) as any[];
  return r ? zeile(r) : null;
}

const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    zeitraum_von: { type: ["string", "null"], description: "YYYY-MM-DD" },
    zeitraum_bis: { type: ["string", "null"], description: "YYYY-MM-DD" },
    einnahmen_cents: { type: ["integer", "null"] }, ausgaben_cents: { type: ["integer", "null"] },
    gehalt_cents: { type: ["integer", "null"], description: "regelmäßiger Lohn/Gehalt/Rente pro Monat" },
    saldo_ende_cents: { type: ["integer", "null"] },
    dispo_genutzt: { type: ["boolean", "null"] }, dispo_tiefst_cents: { type: ["integer", "null"], description: "tiefster negativer Saldo als negative Zahl" },
    ruecklastschriften: { type: "integer" },
    fixkosten: { type: "array", items: { type: "object", additionalProperties: false,
      properties: { name: { type: "string" }, betrag_cents: { type: "integer" }, rhythmus: { type: "string", enum: ["monatlich", "vierteljährlich", "jährlich", "unregelmäßig"] }, kategorie: { type: "string" } },
      required: ["name", "betrag_cents", "rhythmus", "kategorie"] } },
    kategorien: { type: "array", items: { type: "object", additionalProperties: false,
      properties: { name: { type: "string" }, betrag_cents: { type: "integer" }, anteil: { type: "number" } }, required: ["name", "betrag_cents", "anteil"] } },
    warnungen: { type: "array", items: { type: "object", additionalProperties: false,
      properties: { art: { type: "string", enum: ["inkasso", "mahnung", "ruecklastschrift", "dispo", "gluecksspiel", "kredit", "pfaendung", "sonstiges"] }, text: { type: "string" }, betrag_cents: { type: ["integer", "null"] } },
      required: ["art", "text", "betrag_cents"] } },
    merksaetze: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 4 },
  },
  required: ["zeitraum_von", "zeitraum_bis", "einnahmen_cents", "ausgaben_cents", "gehalt_cents", "saldo_ende_cents",
             "dispo_genutzt", "dispo_tiefst_cents", "ruecklastschriften", "fixkosten", "kategorien", "warnungen", "merksaetze"],
} as const;

const ANWEISUNG = `Du bist die Finanzanalyse von FIAON (Bonitätsplattform, DACH). Du bekommst den Text eines Kontoauszugs.
Werte ihn nüchtern und vollständig aus. Beträge in Cent als ganze Zahlen (Euro × 100). Einnahmen = alle Gutschriften im Zeitraum,
Ausgaben = alle Belastungen. Fixkosten = wiederkehrende Zahlungen (Miete, Strom, Versicherung, Telefon, Abos, Kredite) mit Betrag je Zahlung.
Kategorien = Ausgaben gruppiert (Wohnen, Energie, Versicherung, Mobilität, Lebensmittel, Abos/Medien, Kredite/Raten, Gesundheit,
Freizeit, Bargeld, Sonstiges) mit Anteil an den Ausgaben (0–1). Warnungen = alles, was für die Bonität zählt: Inkasso, Mahnungen,
Rücklastschriften, Dispo, Glücksspiel, Pfändung, laufende Kredite. Merksätze: 2–4 kurze Sätze in der Sie-Form, konkret, ohne Fachwörter,
die benennen, wo Spielraum ist und was zuerst zu tun ist. Keine Namen von Personen in der Antwort.`;

async function openaiAuswertung(text: string): Promise<any> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY fehlt.");
  const modell = process.env.FIAON_ANALYSE_MODELL || "gpt-4.1-mini";
  const r = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: modell, temperature: 0.1,
      response_format: { type: "json_schema", json_schema: { name: "kontoauszug_analyse", strict: true, schema: SCHEMA } },
      messages: [
        { role: "system", content: ANWEISUNG },
        { role: "user", content: `Kontoauszug (Text, ggf. mehrere Seiten):\n\n${text.slice(0, 60_000)}` },
      ],
    }),
  });
  const j: any = await r.json().catch(() => null);
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${j?.error?.message || "unbekannt"}`);
  const inhalt = j?.choices?.[0]?.message?.content;
  return { modell, daten: JSON.parse(String(inhalt || "{}")) };
}

/**
 * Die Analyse anstoßen. Idempotent je Upload: Eine laufende oder fertige
 * Analyse, die JÜNGER als der Upload ist, wird nicht wiederholt — außer mit
 * `erzwingen`.
 */
export async function kontoauszugAnalysieren(ref: string, opts: { erzwingen?: boolean } = {}): Promise<Analyse | null> {
  await ensureAnalyseTabelle();
  const [a] = (await sqlPool`
    SELECT a.ref, a.person_id, a.bank_statement_pdf, a.documents_uploaded_at FROM fiaon_applications a
    WHERE a.ref = ${ref} AND a.merged_into IS NULL LIMIT 1`) as any[];
  if (!a?.bank_statement_pdf) return null;
  if (!opts.erzwingen) {
    const [j] = (await sqlPool`SELECT id, status, created_at FROM fiaon_kontoauszug_analysen WHERE ref = ${ref} ORDER BY created_at DESC LIMIT 1`) as any[];
    if (j && (!a.documents_uploaded_at || new Date(j.created_at) >= new Date(a.documents_uploaded_at)) && j.status !== "fehler") {
      return analyseFuer(ref);
    }
  }
  const [neu] = (await sqlPool`
    INSERT INTO fiaon_kontoauszug_analysen (ref, person_id, status) VALUES (${ref}, ${a.person_id ?? null}, 'laeuft') RETURNING id`) as any[];
  const id = Number(neu.id);
  const fertig = async (felder: Record<string, any>) => {
    const cols = Object.keys(felder);
    const JSONB = new Set(["fixkosten", "kategorien", "warnungen", "merksaetze"]);
    // Ausdrücklich `::jsonb` aus Text — sonst verpackt der Treiber den JSON-Text
    // noch einmal als JSON-String (jsonb_typeof = 'string'), gemessen am 22.08.
    const sets = cols.map((c, i) => `${c} = $${i + 1}${JSONB.has(c) ? "::jsonb" : ""}`).join(", ");
    await sqlPool.unsafe(`UPDATE fiaon_kontoauszug_analysen SET ${sets}, updated_at = NOW() WHERE id = $${cols.length + 1}`, [...cols.map((c) => felder[c]), id]);
  };
  try {
    const buf: Buffer = Buffer.isBuffer(a.bank_statement_pdf) ? a.bank_statement_pdf : Buffer.from(a.bank_statement_pdf);
    let text = "";
    try { text = await pdfText(buf); } catch (e) { console.warn("[ANALYSE] PDF nicht lesbar:", (e as Error).message); }
    if (!pdfTextBrauchbar(text)) {
      await fertig({ status: "unlesbar", fehler: "Die Datei enthält keinen lesbaren Text (Foto oder Scan). Bitte laden Sie den Kontoauszug als PDF aus dem Online-Banking hoch." });
      await sqlPool`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note) VALUES (${ref}, NULL, 'System', 'system',
        'Kontoauszug-Analyse: Datei ohne lesbaren Text (Foto/Scan). Der Kunde sieht die Bitte um ein PDF aus dem Online-Banking.')`.catch(() => {});
      return analyseFuer(ref);
    }
    const { modell, daten } = await openaiAuswertung(text);
    await fertig({
      status: "fertig", modell,
      zeitraum_von: daten.zeitraum_von || null, zeitraum_bis: daten.zeitraum_bis || null,
      einnahmen_cents: daten.einnahmen_cents ?? null, ausgaben_cents: daten.ausgaben_cents ?? null, gehalt_cents: daten.gehalt_cents ?? null,
      saldo_ende_cents: daten.saldo_ende_cents ?? null, dispo_genutzt: daten.dispo_genutzt ?? null, dispo_tiefst_cents: daten.dispo_tiefst_cents ?? null,
      ruecklastschriften: Number(daten.ruecklastschriften || 0),
      fixkosten: JSON.stringify((daten.fixkosten || []).map((f: any) => ({ name: f.name, betragCents: f.betrag_cents, rhythmus: f.rhythmus, kategorie: f.kategorie }))),
      kategorien: JSON.stringify((daten.kategorien || []).map((k: any) => ({ name: k.name, betragCents: k.betrag_cents, anteil: k.anteil }))),
      warnungen: JSON.stringify((daten.warnungen || []).map((w: any) => ({ art: w.art, text: w.text, betragCents: w.betrag_cents ?? null }))),
      merksaetze: JSON.stringify(daten.merksaetze || []),
    });
    const w = (daten.warnungen || []).length;
    await sqlPool`INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note) VALUES (${ref}, NULL, 'System', 'system',
      ${`Kontoauszug ausgewertet (${daten.zeitraum_von || "?"} bis ${daten.zeitraum_bis || "?"}): Einnahmen ${((daten.einnahmen_cents || 0) / 100).toFixed(2)} €, Ausgaben ${((daten.ausgaben_cents || 0) / 100).toFixed(2)} €, ${(daten.fixkosten || []).length} Fixkosten, ${w} Warnung(en). Der Kunde sieht die Auswertung unter „Ihre Finanzen".`})`.catch(() => {});
    return analyseFuer(ref);
  } catch (e: any) {
    await fertig({ status: "fehler", fehler: String(e?.message || e).slice(0, 500) });
    console.error("[ANALYSE]", ref, e);
    return analyseFuer(ref);
  }
}
