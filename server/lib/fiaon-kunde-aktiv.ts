// ═══════════════════════════════════════════════════════════════════════════
// AKTIV ODER ARCHIV — EINE REGEL FÜR ALLE LISTEN (05.09.2026, Florentine Punkt 2)
//
// „Kunden, die gesperrt wurden oder gekündigt haben, sind weiterhin in den
// aktiven Bereichen sichtbar. Sie sollten nicht mehr in Kundenlisten,
// Onboarding, Tasks, Anruflisten auftauchen — die Akte bleibt, unter
// ‚Inaktive Kunden / Archiv' abrufbar."
//
// Inaktiv ist ein Mensch, wenn
//   · sein Konto gesperrt ist (account_status = 'suspended'), ODER
//   · er Bestellungen hat und KEINE davon mehr lebt: jede ist archiviert,
//     storniert oder ihr Vertrag ist beendet (vertrag_ende_am erreicht).
// Wer nur einen Vertrag gekündigt hat, dessen letzte Rate noch offen ist,
// bleibt AKTIV — die Forderung ist Arbeit, und der Vertrag läuft bis zur
// Zahlung (Justins Regel, E-135). Leads ohne Bestellung sind nie „inaktiv"
// — für sie gibt es die Sperre (is_blocked).
//
// Die Regel ist SQL, damit jede Liste sie als eine Bedingung anhängen kann;
// `p` ist der Alias der fiaon_persons-Zeile.
// ═══════════════════════════════════════════════════════════════════════════

export function kundeInaktivSql(p = "p"): string {
  return `(
    ${p}.account_status = 'suspended'
    OR (
      EXISTS (SELECT 1 FROM fiaon_applications kx WHERE kx.person_id = ${p}.id AND kx.merged_into IS NULL)
      AND NOT EXISTS (
        SELECT 1 FROM fiaon_applications ky
         WHERE ky.person_id = ${p}.id AND ky.merged_into IS NULL AND ky.archived_at IS NULL
           AND (ky.vertrag_ende_am IS NULL OR ky.vertrag_ende_am > NOW())
           AND COALESCE(ky.payment_status, '') NOT IN ('cancelled', 'canceled', 'storniert', 'refunded', 'void')
      )
    )
  )`;
}

export function kundeAktivSql(p = "p"): string {
  return `NOT ${kundeInaktivSql(p)}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// ZAHLENDE KUNDEN WERDEN NICHT GESPERRT (06.09.2026, Justin: „alle offenen Punkte umsetzen")
//
// Am 05.09. standen 24 zahlende Kunden auf Vertriebssperre — gesetzt durch
// „Erreicht – abgelehnt", „Kein Interesse" oder Aussortieren, oft im
// Forderungsgespräch. Ein Zahler mit lebender Bestellung gehört in die
// Listen seines Betreuers; ein „nein" von ihm ist ein Vermerk, keine Sperre.
// Die drei Sperr-Stellen fragen hier nach, bevor sie is_blocked setzen.
// ═══════════════════════════════════════════════════════════════════════════
export async function istZahlenderKunde(personId: number | null | undefined): Promise<boolean> {
  if (!personId) return false;
  try {
    const { sqlPool } = await import("./db-pool");
    const [r] = (await sqlPool`
      SELECT 1 AS da FROM fiaon_applications a
       WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.archived_at IS NULL
         AND a.payment_status = 'paid' AND (a.vertrag_ende_am IS NULL OR a.vertrag_ende_am > NOW())
       LIMIT 1`) as any[];
    return !!r;
  } catch { return false; }
}

// ═══════════════════════════════════════════════════════════════════════════
// SPERR-PROTOKOLL (05.09.2026, Fall Cataldo Sapia)
//
// Ein bezahlter, voll aktiver Kunde stand um 16:36:25 plötzlich auf
// `is_blocked` — mitten im Startgespräch. Weder eine Anfrage noch ein Klick
// stand dazu im Log; der Zeitstempel fiel in den Takt der Hintergrundläufe.
// Sieben Stellen im Code können die Sperre setzen, keine hinterlässt eine
// Spur an der Person. Ab jetzt schreibt die Datenbank selbst mit: jede
// Änderung von is_blocked landet mit altem und neuem Wert, Zeitpunkt,
// Verbindung und dem auslösenden SQL in fiaon_sperr_protokoll.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";

let protokollGeprueft = false;
export async function ensureSperrProtokoll(): Promise<void> {
  if (protokollGeprueft) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_sperr_protokoll (
      id BIGSERIAL PRIMARY KEY,
      person_id INTEGER NOT NULL,
      alt BOOLEAN,
      neu BOOLEAN,
      geaendert_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      anwendung TEXT,
      verbindung INTEGER,
      transaktion BIGINT,
      anweisung TEXT
    )
  `;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_sperr_protokoll_person ON fiaon_sperr_protokoll (person_id, geaendert_am DESC)`;
  await sqlPool.unsafe(`
    CREATE OR REPLACE FUNCTION fiaon_sperr_protokoll_trg() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN
      IF NEW.is_blocked IS DISTINCT FROM OLD.is_blocked THEN
        INSERT INTO fiaon_sperr_protokoll (person_id, alt, neu, anwendung, verbindung, transaktion, anweisung)
        VALUES (NEW.id, OLD.is_blocked, NEW.is_blocked, current_setting('application_name', true), pg_backend_pid(), txid_current(), LEFT(current_query(), 4000));
      END IF;
      RETURN NEW;
    END $$;
  `);
  // ── NUR ANLEGEN, WENN ER FEHLT (E-254, 28.09.2026) ────────────────────
  // Vorher lief bei JEDEM Start `DROP TRIGGER … ON fiaon_persons` + `CREATE
  // TRIGGER`. Weil der Trigger immer schon da war, hieß das bei jedem Deploy
  // ACCESS EXCLUSIVE auf fiaon_persons — hinter jeder laufenden Lesung, und
  // jede weitere Abfrage auf die Personen stand dahinter an (derselbe Stau wie
  // am 28.09. im Agentenportal). Dazu gab es zwischen DROP und CREATE einen
  // Augenblick ohne Sperr-Protokoll. Jetzt: der Katalog sagt, ob er da ist
  // (sperrt nichts); nur wenn er fehlt oder anders aussieht, legt ihn CREATE
  // OR REPLACE TRIGGER in einem Schritt an (Postgres ≥ 14, ohne Lücke).
  const [trg] = (await sqlPool`
    SELECT pg_get_triggerdef(oid) AS def, tgenabled
      FROM pg_trigger
     WHERE tgrelid = to_regclass('fiaon_persons') AND tgname = 'fiaon_sperr_protokoll_aud' AND NOT tgisinternal
  `) as any[];
  const passt = !!trg && trg.tgenabled !== "D"
    && /AFTER UPDATE OF is_blocked ON (?:public\.)?fiaon_persons FOR EACH ROW EXECUTE FUNCTION fiaon_sperr_protokoll_trg\(\)$/.test(String(trg.def));
  if (!passt) {
    await sqlPool.unsafe(`
      CREATE OR REPLACE TRIGGER fiaon_sperr_protokoll_aud
        AFTER UPDATE OF is_blocked ON fiaon_persons
        FOR EACH ROW EXECUTE FUNCTION fiaon_sperr_protokoll_trg()
    `);
    if (trg?.tgenabled === "D") await sqlPool.unsafe(`ALTER TABLE fiaon_persons ENABLE TRIGGER fiaon_sperr_protokoll_aud`);
  }
  protokollGeprueft = true;
  console.log(`[SPERR-PROTOKOLL] Trigger auf fiaon_persons.is_blocked aktiv${passt ? " (war schon da)" : " (neu angelegt)"}.`);
}
