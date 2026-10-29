// ═══════════════════════════════════════════════════════════════════════════
// DIE TABELLEN DES POSTMEISTERS (02.09.2026, E-094)
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

import { claudeKostenCents, nutzungsModell } from "./fiaon-ki-claude";
import { sqlPool } from "./db-pool";
// E-458 (29.10.2026): echte Preise, Token-Zählung mit Cache und der Berliner Tag aus EINER Quelle (die KI-Kasse).
import { centsFuer, kasseTag, zaehlungAus } from "@shared/fiaon-ki-kasse";
import { kostenNachtragen } from "./fiaon-ki-kasse";

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
      ADD COLUMN IF NOT EXISTS gdpr_geleert_am TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS anhaenge JSONB,
      ADD COLUMN IF NOT EXISTS anhaenge_eingang JSONB,
      ADD COLUMN IF NOT EXISTS versand_versuche INTEGER NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS versand_fehler TEXT,
      ADD COLUMN IF NOT EXISTS naechster_versuch_am TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS versand_aufgegeben_am TIMESTAMPTZ,
      -- E-401 (19.10.2026): eine Mail — eine Einordnung, ein Aktenvermerk (fiaon-postmeister-einmal.ts).
      ADD COLUMN IF NOT EXISTS einordnung_merker JSONB,
      ADD COLUMN IF NOT EXISTS akte_vermerk_am TIMESTAMPTZ,
      -- E-401 (6/6, 19.10.2026): die 24-Stunden-Regel (fiaon-postmeister-frist.ts). frist_ab = die Zeile entstand ab dem
      -- Einbau (nur solche Entwürfe darf Mara nach 24 h neu schreiben und senden); frist_neu_am = einmal neu geschrieben.
      ADD COLUMN IF NOT EXISTS frist_ab TIMESTAMPTZ,
      ADD COLUMN IF NOT EXISTS frist_neu_am TIMESTAMPTZ
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
  // E-458 (29.10.2026): Wie viel der Eingabe kam aus dem Cache? Ohne diese Spalte war die Cache-Quote unbekannt (E-258).
  await sqlPool`ALTER TABLE fiaon_ki_nutzung ADD COLUMN IF NOT EXISTS cached_tokens INTEGER`
    .catch((e) => console.error("[POSTMEISTER-SCHEMA] ki_nutzung.cached_tokens:", String(e).slice(0, 200)));

  // Anrede EINMAL je Person bestimmen und behalten. Am 02.09. wurde dieselbe
  // Person in zwei Antworten „Herr" und „Frau" genannt.
  // ─────────────────────────────────────────────────────────────────────────
  // DIE SPRACHE DES KUNDEN (02.09.2026)
  //
  // Daniel am 02.09.: „Was machen wir mit Kunden die kein Deutsch oder Englisch
  // können — hat eine bulgarische Nummer, lebt aber wohl in Deutschland."
  //
  // `sprache` wird von HAND gesetzt, vom Betreuer nach dem Gespräch — NIE
  // automatisch aus Vorwahl oder Staatsangehörigkeit abgeleitet. Nachgemessen
  // am 02.09.: Von den drei belegten Fällen hätte die Staatsangehörigkeit zwei
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

  // ─────────────────────────────────────────────────────────────────────────
  // DIE ABO-SPALTEN — hier NUR abgesichert, angelegt werden sie woanders
  //
  // Die Lagebestimmung fragte vom 02.09. bis 19.09.2026 `gc_subscription_ref`
  // ab (Einzugsschutz, E-194: GoCardless beendet). Die Spalten bleiben als
  // Historie; angelegt werden sie in fiaon-abo.ts. Aber welche Migration beim Start zuerst läuft, ist nicht
  // festgelegt — und fehlt die Spalte, bricht die Abfrage bei JEDER Mail.
  // `ADD COLUMN IF NOT EXISTS` ist folgenlos, wenn sie schon da ist. Ein
  // doppelter Riegel kostet nichts; ein fehlender kostet einen Abend.
  // ─────────────────────────────────────────────────────────────────────────
  await sqlPool`
    ALTER TABLE fiaon_applications
      ADD COLUMN IF NOT EXISTS gc_subscription_ref VARCHAR,
      ADD COLUMN IF NOT EXISTS gc_subscription_status VARCHAR,
      ADD COLUMN IF NOT EXISTS gc_subscription_start DATE,
      ADD COLUMN IF NOT EXISTS gc_subscription_abgeglichen_am TIMESTAMPTZ
  `.catch((e) => console.error("[POSTMEISTER-SCHEMA] abo-spalten:", String(e).slice(0, 200)));

  await sqlPool`CREATE INDEX IF NOT EXISTS idx_postmeister_person ON fiaon_postmeister (person_id, created_at DESC)`.catch(() => {});
  await sqlPool`CREATE INDEX IF NOT EXISTS idx_postmeister_message ON fiaon_postmeister (message_id)`.catch(() => {});
  await sqlPool`CREATE INDEX IF NOT EXISTS idx_threads_status ON fiaon_postfach_threads (status, letzte_fremd_am DESC)`.catch(() => {});
  bereit = true;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE PREISE (E-458, 29.10.2026) — jetzt echte Dollar
//
// Bis hierher stand: gpt-5.5 = 0,125 / 1,0 Cent je 1.000 Token (GPT-5-Preis), gpt-5.4 genauso, alles andere
// 0,1 / 0,8 als Rückfall — jede Anzeige und jeder Deckel lag ≈ 3,3-mal zu niedrig (Plan E-458: 193,73 „€“
// Hausrechnung gegen ≈ 645 $ Listenpreis in 18 Tagen). Gecachte Eingabe wurde nie erkannt. Die Preistabelle
// steht jetzt in shared/fiaon-ki-kasse.ts (KI_PREISE): gpt-5.5 5 $ / 0,50 $ gecacht / 30 $ je 1 Mio. Token
// (E-258), dazu gpt-5.4, gpt-5.4-mini, gpt-4.1, gpt-4.1-mini, gpt-4o-mini. Ein unbekanntes Modell rechnet mit
// dem teuersten Preis — lieber zu teuer als zu billig, sonst bremst kein Deckel. Werte in Dollar-Cent.
// ═══════════════════════════════════════════════════════════════════════════
// E-408 (19.10.2026): Stimme wird je SEKUNDE bezahlt, nicht je Token — Listenpreise je Minute in USD (shared/fiaon-aras.ts,
// stimmKostenCents rechnet mit USD_EUR). Hier nur zur Dokumentation; nutzungMerken nimmt `sekunden` + `kostenCents` direkt.
export const PREIS_JE_MINUTE_USD: Record<string, number> = { "gpt-live-1": 0.05, "gpt-realtime-2.1-mini": 0.08 };

/**
 * E-279: Claude-Kosten — aus Claudes eigener Zählung (_anbieter: "claude"), oder, wenn ein Modul seine Zählung
 * selbst umbaut (nur Ein-/Ausgabe), mit dem Claude-Modell, das für diesen OpenAI-Namen lief. null = OpenAI.
 */
function claudeKosten(modell: string, usage: any, dienst?: string | null): number | null {
  const direkt = claudeKostenCents(modell, usage);
  if (direkt != null) return direkt;
  const echt = nutzungsModell(modell, dienst);
  if (echt === modell || !/^claude-/.test(echt)) return null;
  return claudeKostenCents(echt, { ...usage, _anbieter: "claude", _modell: echt });
}

/** Kosten eines Aufrufs in Dollar-Cent zu Listenpreis — dieselbe Rechnung wie im Protokoll (E-458: mit Cache-Anteil). */
export function kostenCentsAus(modell: string, usage: any): number {
  // E-279: Kommt die Zählung von Claude (oder trägt Claude für ein OpenAI-Modell), gilt Claudes Preis.
  const c = claudeKosten(modell, usage);
  if (c != null) return c;
  return centsFuer(modell, usage);
}

export async function nutzungMerken(ein: {
  dienst: string; modell: string; usage?: any; dauerMs: number; ok: boolean; fehler?: string | null;
  /** E-408: Sekunden-Abrechnung (Stimme) — mit `kostenCents` als fertige Hausrechnung statt Token. */
  sekunden?: number | null; kostenCents?: number | null;
}): Promise<void> {
  // E-458: Chat- UND Responses-Form, mit gecachter Eingabe und Nachdenken (vorher nur prompt_/completion_tokens).
  const z = zaehlungAus(ein.usage);
  const pt = z.ein;
  const ct = z.aus;
  const rt = z.denken;
  const gecacht = z.gecacht;
  // E-279: Claude-Preis (mit Cache-Anteilen), und in der Tabelle steht das Modell, das wirklich lief.
  // E-408: Eine fertige Sekunden-Rechnung (Stimme) hat Vorrang vor der Token-Rechnung.
  const kosten = ein.kostenCents != null && Number.isFinite(Number(ein.kostenCents))
    ? Number(ein.kostenCents)
    : claudeKosten(ein.modell, ein.usage, ein.dienst) ?? centsFuer(ein.modell, ein.usage);
  ein = { ...ein, modell: String(ein.usage?._modell ?? nutzungsModell(ein.modell, ein.dienst)) };
  const sekunden = ein.sekunden != null && Number.isFinite(Number(ein.sekunden)) ? Math.round(Number(ein.sekunden)) : null;
  // E-458: Die KI-Kasse kennt den Verbrauch sofort — nicht erst nach ihrem nächsten Blick in die Tabelle.
  kostenNachtragen(ein.dienst, kosten);
  // Die Spalte `cached_tokens` einmal je Prozess sichern (schreibt ein Dienst vor postmeisterSchema(), fehlte sie sonst).
  cacheSpalte ??= sqlPool`ALTER TABLE fiaon_ki_nutzung ADD COLUMN IF NOT EXISTS cached_tokens INTEGER`.catch(() => {});
  await cacheSpalte;
  await sqlPool`
    INSERT INTO fiaon_ki_nutzung (dienst, modell, prompt_tokens, completion_tokens, reasoning_tokens, cached_tokens, dauer_ms, kosten_cents, ok, fehler, sekunden)
    VALUES (${ein.dienst}, ${ein.modell}, ${pt}, ${ct}, ${rt}, ${gecacht}, ${Math.round(ein.dauerMs)}, ${kosten}, ${ein.ok}, ${ein.fehler ?? null}, ${sekunden})
  `.catch(async () => {
    // Die Spalte `sekunden` legt arasSchema() an — läuft der Postmeister vor ARAS, fehlt sie noch: dann ohne sie.
    await sqlPool`
      INSERT INTO fiaon_ki_nutzung (dienst, modell, prompt_tokens, completion_tokens, reasoning_tokens, cached_tokens, dauer_ms, kosten_cents, ok, fehler)
      VALUES (${ein.dienst}, ${ein.modell}, ${pt}, ${ct}, ${rt}, ${gecacht}, ${Math.round(ein.dauerMs)}, ${kosten}, ${ein.ok}, ${ein.fehler ?? null})
    `.catch(async () => {
      await sqlPool`
        INSERT INTO fiaon_ki_nutzung (dienst, modell, prompt_tokens, completion_tokens, reasoning_tokens, dauer_ms, kosten_cents, ok, fehler)
        VALUES (${ein.dienst}, ${ein.modell}, ${pt}, ${ct}, ${rt}, ${Math.round(ein.dauerMs)}, ${kosten}, ${ein.ok}, ${ein.fehler ?? null})
      `.catch(() => {});
    });
  });
}
let cacheSpalte: Promise<unknown> | null = null;

/**
 * Tagesausgaben eines Dienstes in DOLLAR (E-458: echte Preise, vorher „Euro“ aus der Hausrechnung) — für die
 * Deckel je Dienst. Der Tag ist der Berliner Kalendertag (vorher UTC: Er begann um 01:00/02:00 Uhr Berlin).
 */
export async function kostenHeute(dienst = "postmeister-antwort"): Promise<number> {
  const tag = kasseTag();
  const [r] = (await sqlPool`
    SELECT COALESCE(SUM(kosten_cents), 0)::float AS c FROM fiaon_ki_nutzung
     WHERE dienst = ${dienst} AND created_at >= (${tag}::date::timestamp AT TIME ZONE 'Europe/Berlin')
  `) as any[];
  return Number(r?.c || 0) / 100;
}
