// ═══════════════════════════════════════════════════════════════════════════
// ARAS — Tabellen und Spalten (E-408), angelegt im Plattform-Code
//
// CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS — beim ersten Gebrauch,
// einmal je Prozess (Promise-Merker gegen gleichzeitige Aufrufe, Muster
// fiaon-mara-termin.ts). Vertrag § 2 (Migrationen 117–119 als Code).
//
// Dazu der ARAS-AUSWEIS: ein Agent in fiaon_agents mit art = 'ki' — damit
// fiaon_calls.agent_id (NOT NULL) einen Besitzer hat und Termine „bei Aras“
// wie bei jedem Mitarbeiter laufen. Er ist als Testkonto markiert und nicht in
// der Verteilung: So fällt er aus Mitarbeiterlisten, Hitze und Provision, bis
// jede Liste art = 'mensch' filtert (pruef-aras-ausweis, spätere Scheibe).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

type Lauf = typeof sqlPool;

export const ARAS_AUSWEIS_EMAIL = "aras@fiaon.com";

let bereit: Promise<void> | null = null;

export function arasSchema(lauf: Lauf = sqlPool): Promise<void> {
  if (!bereit) {
    bereit = (async () => {
      await lauf`ALTER TABLE fiaon_agents ADD COLUMN IF NOT EXISTS art TEXT NOT NULL DEFAULT 'mensch'`;
      await lauf`ALTER TABLE fiaon_calls ADD COLUMN IF NOT EXISTS gefuehrt_von TEXT NOT NULL DEFAULT 'mensch'`;
      await lauf`ALTER TABLE fiaon_ki_nutzung ADD COLUMN IF NOT EXISTS sekunden INTEGER`.catch(() => {});
      // E-406 B1 legt fiaon_mara_rate_erinnerung im Code an — die Spalte nur, wenn es die Tabelle schon gibt.
      await lauf`DO $$ BEGIN
        IF to_regclass('public.fiaon_mara_rate_erinnerung') IS NOT NULL THEN
          ALTER TABLE fiaon_mara_rate_erinnerung ADD COLUMN IF NOT EXISTS kanal TEXT NOT NULL DEFAULT 'mail';
        END IF;
      END $$`;

      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_aras_plan (
          id BIGSERIAL PRIMARY KEY,
          person_id INTEGER, lead_id INTEGER, ref TEXT,
          nummer TEXT NOT NULL, land TEXT NOT NULL DEFAULT 'DE',
          spielart TEXT NOT NULL, prioritaet SMALLINT NOT NULL,
          grund TEXT NOT NULL,
          rechtsgrund TEXT NOT NULL,
          einwilligung_id BIGINT,
          termin_id INTEGER, rate_id INTEGER, erinnerung_id BIGINT,
          frueh_ab TIMESTAMPTZ NOT NULL, spaet_bis TIMESTAMPTZ NOT NULL,
          status TEXT NOT NULL DEFAULT 'wartet',
          versuch_nr SMALLINT NOT NULL DEFAULT 1,
          call_id INTEGER,
          erzeugt_von TEXT NOT NULL,
          verschoben_grund TEXT,
          betrag_cents INTEGER,
          anlass_am TIMESTAMPTZ,
          fehl_folge SMALLINT NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await lauf`CREATE UNIQUE INDEX IF NOT EXISTS aras_plan_offen_uq ON fiaon_aras_plan (person_id, spielart) WHERE status = 'wartet' AND person_id IS NOT NULL`;
      // Akte & Alltag (Nachtrag Akte-Steuerung): wer hat eingereiht, Freitext-Auftrag, „Offenes abgeben“, Benachrichtigung.
      await lauf`ALTER TABLE fiaon_aras_plan ADD COLUMN IF NOT EXISTS auftrag_von TEXT`;
      await lauf`ALTER TABLE fiaon_aras_plan ADD COLUMN IF NOT EXISTS auftrag_text TEXT`;
      await lauf`ALTER TABLE fiaon_aras_plan ADD COLUMN IF NOT EXISTS auftrag_offenes JSONB`;
      await lauf`ALTER TABLE fiaon_aras_plan ADD COLUMN IF NOT EXISTS benachrichtigen_agent_id INTEGER`;
      await lauf`CREATE INDEX IF NOT EXISTS aras_plan_takt_idx ON fiaon_aras_plan (status, prioritaet, frueh_ab)`;

      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_aras_anruf (
          id BIGSERIAL PRIMARY KEY,
          call_id INTEGER NOT NULL UNIQUE REFERENCES fiaon_calls(id),
          plan_id BIGINT REFERENCES fiaon_aras_plan(id),
          spielart TEXT NOT NULL, adapter TEXT NOT NULL, modell TEXT, stimme TEXT, prompt_version TEXT NOT NULL,
          briefing JSONB NOT NULL,
          stream_sid TEXT, sitzung_id TEXT,
          angenommen_am TIMESTAMPTZ, ki_hinweis_am TIMESTAMPTZ,
          aufnahme_ja_am TIMESTAMPTZ, aufnahme_nein_am TIMESTAMPTZ, aufnahme_gestartet_am TIMESTAMPTZ,
          aufnahme_ja_text TEXT,
          transkript JSONB,
          ergebnis TEXT, ergebnis_notiz TEXT, zusammenfassung TEXT,
          uebergabe_agent_id INTEGER, uebergabe_status TEXT,
          sekunden_sitzung INTEGER NOT NULL DEFAULT 0,
          kosten_ki_cents NUMERIC(10,3) NOT NULL DEFAULT 0, kosten_telefon_cents NUMERIC(10,3) NOT NULL DEFAULT 0,
          pruefung_status TEXT NOT NULL DEFAULT 'offen',
          pruefung JSONB,
          fehler TEXT, ende_grund TEXT,
          nachbereitet_am TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS aras_anruf_tag_idx ON fiaon_aras_anruf (created_at DESC, spielart)`;
      await lauf`CREATE INDEX IF NOT EXISTS aras_anruf_offen_idx ON fiaon_aras_anruf (nachbereitet_am) WHERE nachbereitet_am IS NULL`;
      // Justins Daumen nach dem Probeanruf (hoch/runter + Grund) — E-408 Scheibe 1.
      await lauf`ALTER TABLE fiaon_aras_anruf ADD COLUMN IF NOT EXISTS probe_urteil TEXT`;
      await lauf`ALTER TABLE fiaon_aras_anruf ADD COLUMN IF NOT EXISTS probe_urteil_grund TEXT`;
      await lauf`ALTER TABLE fiaon_aras_anruf ADD COLUMN IF NOT EXISTS probe_urteil_am TIMESTAMPTZ`;
      await lauf`ALTER TABLE fiaon_aras_anruf ADD COLUMN IF NOT EXISTS probe_urteil_von TEXT`;

      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_aras_werkzeug (
          id BIGSERIAL PRIMARY KEY,
          aras_anruf_id BIGINT NOT NULL REFERENCES fiaon_aras_anruf(id),
          werkzeug TEXT NOT NULL, aufruf_id TEXT NOT NULL,
          eingabe JSONB NOT NULL, ergebnis JSONB, ok BOOLEAN, dauer_ms INTEGER,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS aras_werkzeug_anruf_idx ON fiaon_aras_werkzeug (aras_anruf_id, created_at)`;

      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_aras_hoerprobe (
          id BIGSERIAL PRIMARY KEY,
          adapter TEXT NOT NULL, stimme TEXT NOT NULL, beschreibung TEXT, text TEXT NOT NULL,
          audio BYTEA, mime TEXT NOT NULL DEFAULT 'audio/wav', dauer_ms INTEGER, kosten_cents NUMERIC(10,3),
          bewertung SMALLINT, kommentar TEXT, gewaehlt_am TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;

      await lauf`CREATE TABLE IF NOT EXISTS fiaon_softphone_praesenz (agent_id INTEGER PRIMARY KEY, zuletzt_am TIMESTAMPTZ NOT NULL)`;

      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_telefon_einwilligung (
          id BIGSERIAL PRIMARY KEY,
          person_id INTEGER, lead_id INTEGER,
          nummer TEXT NOT NULL, nummer_kern TEXT NOT NULL,
          art TEXT NOT NULL,
          wortlaut TEXT NOT NULL,
          quelle_art TEXT, quelle_id TEXT,
          beleg JSONB,
          erteilt_am TIMESTAMPTZ NOT NULL, widerrufen_am TIMESTAMPTZ, widerruf_quelle TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS tel_einw_kern_idx ON fiaon_telefon_einwilligung (nummer_kern, erteilt_am DESC)`;

      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_telefon_sperre (
          id BIGSERIAL PRIMARY KEY,
          nummer_kern TEXT NOT NULL UNIQUE, person_id INTEGER,
          quelle TEXT NOT NULL,
          grund TEXT, call_id INTEGER,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), aufgehoben_am TIMESTAMPTZ, aufgehoben_von TEXT
        )`;

      await lauf`
        CREATE TABLE IF NOT EXISTS fiaon_ki_pruefung (
          id BIGSERIAL PRIMARY KEY,
          kanal TEXT NOT NULL,
          bezug_art TEXT NOT NULL, bezug_id BIGINT NOT NULL,
          person_id INTEGER,
          urteil TEXT NOT NULL,
          punkte JSONB NOT NULL,
          begruendung TEXT, modell TEXT, kosten_cents NUMERIC(10,3),
          karte_schluessel TEXT,
          entschieden TEXT, entschieden_am TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await lauf`CREATE INDEX IF NOT EXISTS ki_pruef_tag_idx ON fiaon_ki_pruefung (created_at DESC, kanal, urteil)`;
    })().catch((e) => {
      const code = String((e as any)?.code ?? "");
      if (code === "23505" || code === "42P07") return; // Wettlauf zweier Prozesse um dieselbe Tabelle — die andere hat gewonnen
      bereit = null;
      throw e;
    });
  }
  return bereit;
}

let ausweisId: number | null = null;

/**
 * Der ARAS-Ausweis: die Agenten-Zeile, unter der ARAS anruft (fiaon_calls.agent_id, fiaon_termine.agent_id).
 * Legt sie beim ersten Aufruf an und schreibt die Kennung nach fiaon_settings (aras_ausweis_agent_id).
 */
export async function arasAusweisId(lauf: Lauf = sqlPool): Promise<number> {
  if (ausweisId) return ausweisId;
  await arasSchema(lauf);
  const [vorhanden] = (await lauf`SELECT id FROM fiaon_agents WHERE art = 'ki' AND email = ${ARAS_AUSWEIS_EMAIL} LIMIT 1`) as any[];
  let id = vorhanden ? Number(vorhanden.id) : 0;
  if (!id) {
    const [neu] = (await lauf`
      INSERT INTO fiaon_agents (name, email, password_hash, active, first_name, last_name, rolle, is_test_account, distribution_active, art, anrede)
      VALUES ('Aras', ${ARAS_AUSWEIS_EMAIL}, NULL, TRUE, 'Aras', NULL, 'agent', TRUE, FALSE, 'ki', NULL)
      ON CONFLICT (email) DO UPDATE SET art = 'ki', is_test_account = TRUE, distribution_active = FALSE
      RETURNING id`) as any[];
    id = Number(neu.id);
  }
  await lauf`INSERT INTO fiaon_settings (key, value, updated_at) VALUES ('aras_ausweis_agent_id', ${String(id)}, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`.catch(() => {});
  ausweisId = id;
  return id;
}

/** Nur für Prüfstände: den Merker löschen (neue Datenbank, neuer Ausweis). */
export function arasSchemaZuruecksetzen(): void { bereit = null; ausweisId = null; }
