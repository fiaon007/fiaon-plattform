// ═══════════════════════════════════════════════════════════════════════════
// DIE TABELLEN DES POSTMEISTERS (03.09.2026, E-094)
//
// Alle Erweiterungen sind additiv und laufen beim Start einmal. Keine Spalte
// wird gelöscht, keine bestehende geändert — die alte Fassung läuft weiter,
// bis die neue sie ablöst.
//
// WARUM DIE ZEILE DEN KLARTEXT SPEICHERT: Die Zentrale soll zeigen, was der
// Kunde geschrieben hat („ich will auch immer sehen was der Kunde geschrieben
// hat", Justin). Bisher stand nur der Betreff in der Datenbank; der Text lag
// allein bei Gmail. Wer entscheiden soll, ob eine Antwort rausgeht, muss die
// Frage lesen können.
// ═══════════════════════════════════════════════════════════════════════════

import { sqlPool } from "./db-pool";

let bereit = false;

export async function postmeisterSchema(): Promise<void> {
  if (bereit) return;
  await sqlPool`
    ALTER TABLE fiaon_postmeister
      ADD COLUMN IF NOT EXISTS text TEXT,
      ADD COLUMN IF NOT EXISTS zusammenfassung TEXT,
      ADD COLUMN IF NOT EXISTS kategorien TEXT[],
      ADD COLUMN IF NOT EXISTS flags JSONB,
      ADD COLUMN IF NOT EXISTS kundenlage TEXT,
      ADD COLUMN IF NOT EXISTS belege JSONB,
      ADD COLUMN IF NOT EXISTS handlungen JSONB,
      ADD COLUMN IF NOT EXISTS pruefung JSONB,
      ADD COLUMN IF NOT EXISTS naechster_schritt JSONB,
      ADD COLUMN IF NOT EXISTS antwort_html TEXT,
      ADD COLUMN IF NOT EXISTS versuche INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS in_arbeit_seit TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS entwurf_geprueft_am TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS message_id TEXT,
      ADD COLUMN IF NOT EXISTS person_kandidaten JSONB,
      ADD COLUMN IF NOT EXISTS ki_kosten_cents NUMERIC(8,3),
      ADD COLUMN IF NOT EXISTS gdpr_geleert_am TIMESTAMPTZ
  `.catch((e) => console.error("[POSTMEISTER-SCHEMA] fiaon_postmeister:", String(e).slice(0, 200)));

  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_postfach_threads (
      id SERIAL PRIMARY KEY,
      postfach TEXT NOT NULL,
      thread_id TEXT NOT NULL,
      betreff TEXT,
      absender TEXT,
      absender_domain TEXT,
      person_id INTEGER,
      ref TEXT,
      nachrichten INTEGER NOT NULL DEFAULT 0,
      letzte_fremd_am TIMESTAMPTZ,
      letzte_eigen_am TIMESTAMPTZ,
      eigen_quelle TEXT,
      status TEXT NOT NULL DEFAULT 'offen',
      ignoriert_grund TEXT,
      verarbeitet_am TIMESTAMPTZ,
      welle_am TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (postfach, thread_id)
    )
  `.catch((e) => console.error("[POSTMEISTER-SCHEMA] threads:", String(e).slice(0, 200)));

  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_ki_nutzung (
      id SERIAL PRIMARY KEY,
      dienst TEXT NOT NULL,
      modell TEXT NOT NULL,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      reasoning_tokens INTEGER,
      dauer_ms INTEGER,
      kosten_cents NUMERIC(10,4),
      ok BOOLEAN NOT NULL DEFAULT TRUE,
      fehler TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `.catch((e) => console.error("[POSTMEISTER-SCHEMA] ki_nutzung:", String(e).slice(0, 200)));

  // Anrede EINMAL je Person bestimmen und behalten. Am 02.09. wurde dieselbe
  // Person in zwei Antworten „Herr" und „Frau" genannt.
  // ─────────────────────────────────────────────────────────────────────────
  // DIE SPRACHE DES KUNDEN (03.09.2026)
  //
  // Daniel am 02.09.: „Was machen wir mit Kunden die kein Deutsch oder Englisch
  // können — hat eine bulgarische Nummer, lebt aber wohl in Deutschland."
  //
  // `sprache` wird von HAND gesetzt, vom Betreuer nach dem Gespräch — NIE
  // automatisch aus Vorwahl oder Staatsangehörigkeit abgeleitet. Nachgemessen
  // am 03.09.: Von den drei belegten Fällen hätte die Staatsangehörigkeit zwei
  // falsch eingeordnet (österreichische Staatsbürger mit +43-Nummer). Wer
  // welche Sprache spricht, weiß nur, wer mit ihm gesprochen hat.
  //
  // `sprache_notiz` ist der Freitext daneben: „versteht mündlich, aber nicht
  // schriftlich", „Tochter übersetzt, bitte abends anrufen".
  // ─────────────────────────────────────────────────────────────────────────
  await sqlPool`
    ALTER TABLE fiaon_persons
      ADD COLUMN IF NOT EXISTS anrede TEXT,
      ADD COLUMN IF NOT EXISTS anrede_quelle TEXT,
      ADD COLUMN IF NOT EXISTS gesperrt_seit TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS sprache TEXT,
      ADD COLUMN IF NOT EXISTS sprache_notiz TEXT,
      ADD COLUMN IF NOT EXISTS sprache_gesetzt_am TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS sprache_gesetzt_von INTEGER
  `.catch((e) => console.error("[POSTMEISTER-SCHEMA] persons:", String(e).slice(0, 200)));

  await sqlPool`CREATE INDEX IF NOT EXISTS idx_postmeister_person ON fiaon_postmeister (person_id, created_at DESC)`.catch(() => {});
  await sqlPool`CREATE INDEX IF NOT EXISTS idx_postmeister_message ON fiaon_postmeister (message_id)`.catch(() => {});
  await sqlPool`CREATE INDEX IF NOT EXISTS idx_threads_status ON fiaon_postfach_threads (status, letzte_fremd_am DESC)`.catch(() => {});
  bereit = true;
}

/** Kosten je 1.000 Token — grobe Hausrechnung, nur zur Messung. */
const PREIS: Record<string, { ein: number; aus: number }> = {
  "gpt-5.5": { ein: 0.125, aus: 1.0 },
  "gpt-5.4": { ein: 0.125, aus: 1.0 },
  "gpt-4.1-mini": { ein: 0.04, aus: 0.16 },
};

export async function nutzungMerken(ein: {
  dienst: string; modell: string; usage?: any; dauerMs: number; ok: boolean; fehler?: string | null;
}): Promise<void> {
  const p = PREIS[ein.modell] ?? PREIS[ein.modell.replace(/-\d{4}-\d{2}-\d{2}$/, "")] ?? { ein: 0.1, aus: 0.8 };
  const pt = Number(ein.usage?.prompt_tokens || 0);
  const ct = Number(ein.usage?.completion_tokens || 0);
  const rt = Number(ein.usage?.completion_tokens_details?.reasoning_tokens || 0);
  const kosten = (pt / 1000) * p.ein + (ct / 1000) * p.aus;
  await sqlPool`
    INSERT INTO fiaon_ki_nutzung (dienst, modell, prompt_tokens, completion_tokens, reasoning_tokens, dauer_ms, kosten_cents, ok, fehler)
    VALUES (${ein.dienst}, ${ein.modell}, ${pt}, ${ct}, ${rt}, ${Math.round(ein.dauerMs)}, ${kosten}, ${ein.ok}, ${ein.fehler ?? null})
  `.catch(() => {});
}

/** Tagesausgaben in Euro — für den Kostendeckel. */
export async function kostenHeute(dienst = "postmeister"): Promise<number> {
  const [r] = (await sqlPool`
    SELECT COALESCE(SUM(kosten_cents), 0)::float AS c FROM fiaon_ki_nutzung
     WHERE dienst = ${dienst} AND created_at > date_trunc('day', NOW())
  `) as any[];
  return Number(r?.c || 0) / 100;
}
