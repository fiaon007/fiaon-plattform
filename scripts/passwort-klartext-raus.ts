/**
 * ═══════════════════════════════════════════════════════════════════════════
 * E-242 — Klartext-Passwörter raus. ALLE Orte, EINE Transaktion. (01.10.2026)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Orte, an denen ein Kundenpasswort im Klartext liegen kann (Befund und Zahlen stehen im
 * internen Register E-242 — NIE im Quelltext, das Repository ist öffentlich lesbar):
 *
 *   1. fiaon_applications.password — die Spalte, die die Anmeldung liest (storedPasswordOf).
 *      Altbestand im Klartext wird zu scrypt, exakt dem Format von passwortHashen(). Der Kunde
 *      merkt nichts: passwortPasst() versteht den Hash, sein Passwort bleibt dasselbe, es gibt
 *      KEINEN erzwungenen Wechsel. Jeder Hash wird VOR dem Schreiben gegen sein Klartext-Original
 *      geprüft (passwortPasst muss ja sagen, ein falsches Passwort muss nein sagen) — sonst Abbruch,
 *      bevor irgendetwas geschrieben ist. Niemand wird ausgesperrt.
 *      Ausnahme: DSGVO-gelöschte Zeilen (gdpr_deleted_at) werden geleert — die Anmeldung liest sie
 *      ohnehin nicht (loadLoginFamily filtert sie), ein Passwort hat dort nichts mehr zu suchen.
 *   2. fiaon_applications.utm — Passwort-Kopien als JSON-Text/Array (8518e421, 00fb0137, c616ee18).
 *      Gerechnet wird IN der Datenbank (die Werte verlassen sie nie), nur die Erlaubnisliste aus
 *      server/lib/fiaon-utm.ts bleibt, als Objekt. Protokoll: fiaon_utm_bereinigung_protokoll.
 *      (Löst scripts/sql/utm-bereinigung.sql ab — dieselbe Rechnung, jetzt in derselben Transaktion.)
 *   3. fiaon_persons.password — eine tote Kopie (keine Anmeldung liest sie). Wird geleert; der Code
 *      schreibt seit E-242 keine Kopie mehr (fiaon-person-model.ts, fiaon-person-merge.ts).
 *
 * Protokoll fiaon_passwort_klartext_protokoll: WELCHE Datensätze ein Klartext-Passwort trugen und was
 * damit geschah — Kennungen und Maßnahme, NIE Werte. Das ist die Liste, die ein späterer Zwangs-Reset
 * oder eine Benachrichtigung nach Art. 34 DSGVO braucht; nach dem Hashen wäre sie sonst verloren.
 *
 * Danach (nur --ausfuehren, nur wenn alles sauber ist) verbietet die Datenbank den Rückfall:
 *   CHECK fiaon_applications_password_gehasht  (password NULL, '' oder scrypt$…)
 *   CHECK fiaon_applications_utm_erlaubt       (utm NULL oder Objekt nur mit erlaubten Schlüsseln)
 *   CHECK fiaon_persons_password_gehasht       (password NULL oder scrypt$… — eine Hash-Kopie bricht nichts)
 *   je NOT VALID (kurze Sperre, lock_timeout 3 s, Wiederholung) und danach VALIDATE (ohne Schreibsperre).
 *
 * AUFRUF (aus dem Arbeitsbaum; die Ausgabe enthält nur Zähler — nie einen Wert, nie eine Referenz):
 *   Vorschau, nur lesend (Produktion erlaubt):
 *     DATABASE_URL=… node --import tsx scripts/passwort-klartext-raus.ts
 *   Probelauf — alles in EINER Transaktion, Kontrolle, dann ROLLBACK (Produktion erlaubt; ohne CHECKs):
 *     DATABASE_URL=… node --import tsx scripts/passwort-klartext-raus.ts --probelauf
 *   Ausführen — COMMIT + CHECKs (gegen Produktion zusätzlich --produktion, nur mit Justins Go):
 *     DATABASE_URL=… node --import tsx scripts/passwort-klartext-raus.ts --ausfuehren [--produktion]
 *   Nur die CHECKs nachholen (falls sie beim Ausführen an einer Sperre scheiterten):
 *     DATABASE_URL=… node --import tsx scripts/passwort-klartext-raus.ts --nur-checks [--produktion]
 *
 * SPERRARM: Alle Hashes werden VOR der Transaktion gerechnet (scrypt kostet Zeit); die Transaktion
 * selbst schreibt nur fertige Werte in Stapeln (je 200 Zeilen über den Primärschlüssel) und dauert
 * Sekundenbruchteile. lock_timeout 3 s: Hält jemand eine Zeile länger fest, bricht der Lauf mit ROLLBACK
 * ab und kann einfach wiederholt werden (idempotent). Kein Klartext wird als SQL-Parameter gesendet —
 * Postgres protokolliert Anweisungen über 2 s samt Parametern (log_min_duration_statement); gegen
 * nebenläufige Änderungen schützt xmin (die Zeile muss unverändert sein, sonst wird sie unter
 * Zeilensperre nachgezogen). updated_at bleibt unberührt — keine Zeile wirkt dadurch „frisch bearbeitet".
 *
 * Rückweg: Die Klartexte werden bewusst NICHT gesichert. Die CHECKs lassen sich lösen mit
 *   ALTER TABLE fiaon_applications DROP CONSTRAINT fiaon_applications_password_gehasht;
 *   ALTER TABLE fiaon_applications DROP CONSTRAINT fiaon_applications_utm_erlaubt;
 *   ALTER TABLE fiaon_persons DROP CONSTRAINT fiaon_persons_password_gehasht;
 *
 * Exit: 0 sauber · 1 Kontrolle/Prüfung fehlgeschlagen (ROLLBACK, nichts geändert) · 2 Aufruf falsch ·
 *       3 Sperre/Zeitlimit (ROLLBACK, später wiederholen) · 4 Daten sauber, CHECKs fehlen (--nur-checks)
 */
import postgres from "postgres";
import { passwortHashen, passwortPasst, istGehasht } from "../server/lib/fiaon-kunde-session";
import { UTM_SCHLUESSEL } from "../server/lib/fiaon-utm";

const argumente = new Set(process.argv.slice(2));
const MODUS = argumente.has("--ausfuehren") ? "ausfuehren"
  : argumente.has("--probelauf") ? "probelauf"
  : argumente.has("--nur-checks") ? "nur-checks"
  : "vorschau";
const unbekannt = [...argumente].filter((a) => !["--ausfuehren", "--probelauf", "--nur-checks", "--produktion"].includes(a));
const url = process.env.DATABASE_URL || "";
const LOKAL = /@(127\.0\.0\.1|localhost)(:\d+)?\//.test(url);

if (!url || unbekannt.length > 0) {
  console.error(`Aufruf: DATABASE_URL=… node --import tsx scripts/passwort-klartext-raus.ts [--probelauf | --ausfuehren | --nur-checks] [--produktion]${unbekannt.length ? ` (unbekannt: ${unbekannt.join(" ")})` : ""}`);
  process.exit(2);
}
if ((MODUS === "ausfuehren" || MODUS === "nur-checks") && !LOKAL && !argumente.has("--produktion")) {
  console.error("ABBRUCH: Die Datenbank ist nicht lokal. Schreiben in Produktion nur mit Justins Go und zusätzlich --produktion.");
  process.exit(2);
}

// ── Gemeinsame Regeln ───────────────────────────────────────────────────────
const ERLAUBT: string[] = [...UTM_SCHLUESSEL];
if (!ERLAUBT.every((k) => /^[a-z_]+$/.test(k))) { console.error("ABBRUCH: unerwarteter Schlüssel in UTM_SCHLUESSEL."); process.exit(2); }
/** Für DDL (CHECK) — dort gibt es keine Parameter. Nur [a-z_], oben geprüft. */
const ERLAUBT_SQL = `ARRAY[${ERLAUBT.map((k) => `'${k}'`).join(", ")}]::text[]`;
/** Schlüsselnamen, die als Passwort gelten (Protokoll der utm-Bereinigung). */
const PW_SCHLUESSEL = String.raw`^(pass(word|wort)?|passwd|pw|pwd|kennwort|new_?password|neues_?passwort)$`;
/** Passwort-SCHLÜSSEL in jeder Schicht von utm (auch in JSON-Text, dort mit \" davor) — Werte egal. */
const PW_SPUR = String.raw`(pass(word|wort)?|passwd|pwd?|kennwort)\\?"\s*:`;
const KLARTEXT = `password IS NOT NULL AND password <> '' AND password NOT LIKE 'scrypt$%'`;
const STAPEL = 200;

const sql = postgres(url, {
  ssl: /sslmode=disable/.test(url) ? false : "require",
  max: 1,
  onnotice: () => {},
  connection: {
    application_name: "e242-klartext-raus",
    statement_timeout: 30000,
    lock_timeout: 3000,
    idle_in_transaction_session_timeout: 120000,
  },
});

class Probelauf extends Error { constructor() { super("Probelauf — ROLLBACK"); } }
class Abbruch extends Error { constructor(text: string, readonly code = 1) { super(text); } }

/** Fehler nur mit Text und Code ausgeben — NIE das Objekt (postgres.js hängt Anfrage und Parameter an). */
const fehlerText = (e: any) => `${String(e?.message ?? e).slice(0, 300)}${e?.code ? ` [${e.code}]` : ""}`;
const istSperre = (e: any) => ["55P03", "57014", "40P01", "40001"].includes(String(e?.code ?? ""));

// ── Zählung (nur Zähler) ────────────────────────────────────────────────────
type Lauf = typeof sql | postgres.TransactionSql;
interface Stand {
  app_gesetzt: number; app_gehasht: number; app_klartext: number; app_klartext_dsgvo: number;
  utm_nicht_objekt: number; utm_fremd: number; utm_passwort_spur: number;
  person_gesetzt: number; person_klartext: number; merge_log_wert: number;
}
async function stand(t: Lauf): Promise<Stand> {
  const [a] = await t.unsafe(`
    SELECT COUNT(*) FILTER (WHERE password IS NOT NULL AND password <> '')::int AS app_gesetzt,
           COUNT(*) FILTER (WHERE password LIKE 'scrypt$%')::int AS app_gehasht,
           COUNT(*) FILTER (WHERE ${KLARTEXT})::int AS app_klartext,
           COUNT(*) FILTER (WHERE ${KLARTEXT} AND gdpr_deleted_at IS NOT NULL)::int AS app_klartext_dsgvo,
           COUNT(*) FILTER (WHERE utm IS NOT NULL AND jsonb_typeof(utm) <> 'object')::int AS utm_nicht_objekt,
           COUNT(*) FILTER (WHERE jsonb_typeof(utm) = 'object' AND (utm - $1::text[]) <> '{}'::jsonb)::int AS utm_fremd,
           COUNT(*) FILTER (WHERE utm::text ~* $2)::int AS utm_passwort_spur
      FROM fiaon_applications`, [ERLAUBT, PW_SPUR]);
  const [p] = await t.unsafe(`
    SELECT COUNT(*) FILTER (WHERE password IS NOT NULL AND password <> '')::int AS person_gesetzt,
           COUNT(*) FILTER (WHERE ${KLARTEXT})::int AS person_klartext
      FROM fiaon_persons`);
  // Sonstige: das Merge-Protokoll speichert den ALTEN Gewinnerwert gefüllter Felder (beim Passwort bisher
  // immer leer). Gezählt werden nur Einträge mit einem Text als Wert — 0 erwartet, wird nicht verändert.
  const [m] = await t.unsafe(`
    SELECT CASE WHEN to_regclass('fiaon_merge_log') IS NULL THEN 0 ELSE
      (SELECT COUNT(*)::int FROM fiaon_merge_log WHERE filled_fields::text ~* '"pass(word|wort)?"\\s*:\\s*"[^"]') END AS merge_log_wert`);
  return { ...(a as any), ...(p as any), ...(m as any) } as Stand;
}

function zeige(titel: string, s: Stand): void {
  console.log(`\n== ${titel}`);
  console.log(`  fiaon_applications.password  gesetzt ${s.app_gesetzt} · gehasht ${s.app_gehasht} · KLARTEXT ${s.app_klartext} (davon DSGVO-gelöscht ${s.app_klartext_dsgvo})`);
  console.log(`  fiaon_applications.utm       Passwort-Spur ${s.utm_passwort_spur} · keine Objekte ${s.utm_nicht_objekt} · fremde Schlüssel ${s.utm_fremd}`);
  console.log(`  fiaon_persons.password       gesetzt ${s.person_gesetzt} · KLARTEXT ${s.person_klartext}`);
  console.log(`  fiaon_merge_log (sonstige)   Passwort mit Textwert ${s.merge_log_wert} (wird nicht verändert${s.merge_log_wert > 0 ? " — WARNUNG: von Hand prüfen" : ""})`);
}
// Das Merge-Protokoll zählt nur mit (Bericht), es wird nicht verändert und hält den Lauf nicht an.
const sauber = (s: Stand) => s.app_klartext === 0 && s.person_gesetzt === 0 && s.utm_nicht_objekt === 0 && s.utm_fremd === 0 && s.utm_passwort_spur === 0;

async function checksStand(t: Lauf): Promise<Record<string, boolean | null>> {
  const r = await t`
    SELECT conname, convalidated FROM pg_constraint
     WHERE conname IN ('fiaon_applications_password_gehasht', 'fiaon_applications_utm_erlaubt', 'fiaon_persons_password_gehasht')`;
  const aus: Record<string, boolean | null> = {
    fiaon_applications_password_gehasht: null, fiaon_applications_utm_erlaubt: null, fiaon_persons_password_gehasht: null,
  };
  for (const x of r as any[]) aus[x.conname] = x.convalidated === true;
  return aus;
}

// ── utm: dieselbe Rechnung wie die bisherige scripts/sql/utm-bereinigung.sql ─────
// $1 = Erlaubnisliste (text[]), $2 = Muster für Passwort-Schlüsselnamen. Rechnet nur in der DB.
const UTM_BERECHNUNG = String.raw`
WITH schichten AS (
  SELECT a.id, s.nr, s.o
  FROM fiaon_applications a
  CROSS JOIN LATERAL (
    SELECT 0::bigint AS nr, a.utm AS o WHERE jsonb_typeof(a.utm) = 'object'
    UNION ALL
    SELECT 0::bigint, (a.utm #>> '{}')::jsonb WHERE jsonb_typeof(a.utm) = 'string' AND (a.utm #>> '{}') ~ '^\s*\{'
    UNION ALL
    SELECT e.nr, CASE WHEN jsonb_typeof(e.v) = 'object' THEN e.v ELSE (e.v #>> '{}')::jsonb END
    FROM jsonb_array_elements(CASE WHEN jsonb_typeof(a.utm) = 'array' THEN a.utm ELSE '[]'::jsonb END) WITH ORDINALITY AS e(v, nr)
    WHERE jsonb_typeof(e.v) = 'object' OR (jsonb_typeof(e.v) = 'string' AND (e.v #>> '{}') ~ '^\s*\{')
  ) s
  WHERE a.utm IS NOT NULL
),
schluessel AS (
  SELECT s.id, s.nr, kv.key AS k, kv.value AS v
  FROM schichten s
  CROSS JOIN LATERAL jsonb_each(CASE WHEN jsonb_typeof(s.o) = 'object' THEN s.o ELSE '{}'::jsonb END) kv
),
neu AS (
  SELECT a.id, a.ref, a.created_at, jsonb_typeof(a.utm) AS alte_form, a.utm AS alt,
    COALESCE(array_agg(DISTINCT x.k ORDER BY x.k) FILTER (WHERE x.k IS NOT NULL), '{}'::text[]) AS alte_schluessel,
    (COUNT(DISTINCT x.nr) FILTER (WHERE x.k ~* $2))::int AS passwort_eintraege,
    COALESCE(jsonb_object_agg(x.k, to_jsonb(left(btrim(x.v #>> '{}'), 500)) ORDER BY x.nr)
      FILTER (WHERE x.k = ANY($1::text[]) AND jsonb_typeof(x.v) IN ('string', 'number') AND btrim(x.v #>> '{}') <> ''),
      '{}'::jsonb) AS neu
  FROM fiaon_applications a
  LEFT JOIN schluessel x ON x.id = a.id
  WHERE a.utm IS NOT NULL
  GROUP BY a.id
)`;

async function utmVorschau(t: Lauf): Promise<void> {
  const r = await t.unsafe(`${UTM_BERECHNUNG}
    SELECT alte_form, COUNT(*)::int AS zeilen,
           COUNT(*) FILTER (WHERE passwort_eintraege > 0)::int AS mit_passwort,
           COALESCE(SUM(passwort_eintraege), 0)::int AS passwort_eintraege,
           COUNT(*) FILTER (WHERE neu <> '{}'::jsonb)::int AS behalten_erlaubte,
           (SELECT string_agg(DISTINCT k, ', ') FROM neu n2, unnest(n2.alte_schluessel) AS k
             WHERE n2.alte_form = neu.alte_form AND n2.alt IS DISTINCT FROM n2.neu) AS schluesselnamen
      FROM neu WHERE alt IS DISTINCT FROM neu GROUP BY 1 ORDER BY 1`, [ERLAUBT, PW_SCHLUESSEL]);
  console.log("\n== utm: was sich ändert (Form · Zeilen · mit Passwort · Passwort-Einträge · behalten erlaubte Schlüssel · Schlüsselnamen)");
  if ((r as any[]).length === 0) console.log("  nichts");
  for (const x of r as any[]) console.log(`  ${x.alte_form} · ${x.zeilen} · ${x.mit_passwort} · ${x.passwort_eintraege} · ${x.behalten_erlaubte} · ${x.schluesselnamen ?? "—"}`);
}

// ── Protokolle ──────────────────────────────────────────────────────────────
async function protokolleAnlegen(t: Lauf): Promise<void> {
  await t`
    CREATE TABLE IF NOT EXISTS fiaon_utm_bereinigung_protokoll (
      application_id integer PRIMARY KEY,
      ref varchar NOT NULL,
      alte_form text NOT NULL,
      alte_schluessel text[] NOT NULL,
      passwort_eintraege integer NOT NULL,
      behaltene_schluessel text[] NOT NULL,
      bereinigt_am timestamptz NOT NULL DEFAULT NOW()
    )`;
  await t`COMMENT ON TABLE fiaon_utm_bereinigung_protokoll IS
    'E-242 (25.09.2026): welche Antragszeilen die utm-Bereinigung geändert hat. Nur Schlüsselnamen und Zähler — NIE Werte.'`;
  await t`
    CREATE TABLE IF NOT EXISTS fiaon_passwort_klartext_protokoll (
      ort text NOT NULL,
      datensatz_id bigint NOT NULL,
      ref varchar,
      person_id integer,
      massnahme text NOT NULL,
      war_klartext boolean NOT NULL,
      am timestamptz NOT NULL DEFAULT NOW(),
      PRIMARY KEY (ort, datensatz_id)
    )`;
  await t`COMMENT ON TABLE fiaon_passwort_klartext_protokoll IS
    'E-242 (01.10.2026): welche Datensätze ein Klartext-Passwort trugen und was damit geschah (gehasht/geleert). Nur Kennungen — NIE Werte. Grundlage für Zwangs-Reset und Benachrichtigung (Art. 34 DSGVO).'`;
}

// ── Hashen VOR der Transaktion ──────────────────────────────────────────────
interface Fall { id: number; xm: string; hash: string | null; klar: string }
function hashMitBeweis(klar: string): string {
  const h = passwortHashen(klar);
  // Der Beweis, dass niemand ausgesperrt wird: Der neue Hash muss genau dieses Passwort annehmen
  // und ein anderes ablehnen — mit derselben Funktion, die die Anmeldung benutzt.
  if (!istGehasht(h) || !passwortPasst(h, klar) || passwortPasst(h, `${klar}\u0000x`)) {
    throw new Abbruch("Hash-Prüfung fehlgeschlagen — nichts geschrieben.");
  }
  return h;
}

async function vorbereiten(): Promise<Fall[]> {
  const zeilen = await sql.begin("read only", (t) => t.unsafe(`
    SELECT id, password, xmin::text AS xm, (gdpr_deleted_at IS NOT NULL) AS geloescht
      FROM fiaon_applications WHERE ${KLARTEXT} ORDER BY id`)) as any[];
  const faelle: Fall[] = [];
  const t0 = Date.now();
  for (const z of zeilen) {
    faelle.push({ id: Number(z.id), xm: String(z.xm), hash: z.geloescht ? null : hashMitBeweis(String(z.password)), klar: String(z.password) });
    if (faelle.length % 100 === 0) console.log(`  … ${faelle.length}/${zeilen.length} gehasht und geprüft (${Math.round((Date.now() - t0) / 1000)} s)`);
  }
  console.log(`  ${faelle.length} Klartext-Zeilen vorbereitet: ${faelle.filter((f) => f.hash).length} zu hashen, ${faelle.filter((f) => !f.hash).length} zu leeren (DSGVO-gelöscht) — ${Math.round((Date.now() - t0) / 1000)} s`);
  return faelle;
}

// ── Die eine Transaktion ────────────────────────────────────────────────────
interface Ergebnis { gehasht: number; geleert: number; nachgezogen: number; personen: number; utm: number }

async function bereinigen(t: postgres.TransactionSql, faelle: Fall[], probe: boolean): Promise<Ergebnis> {
  await t`SET LOCAL lock_timeout = '3s'`;
  await t`SET LOCAL statement_timeout = '20s'`;
  await protokolleAnlegen(t);
  const erg: Ergebnis = { gehasht: 0, geleert: 0, nachgezogen: 0, personen: 0, utm: 0 };
  const geschrieben = new Map<number, string | null>();

  // 1. fiaon_applications.password — ZUERST, solange xmin noch der gelesene Stand ist
  //    (jede spätere Änderung in dieser Transaktion setzt xmin auf die eigene Transaktion).
  const schreibe = async (stapel: { id: number; hash: string | null; xm: string | null }[]) => {
    const r = await t.unsafe(`
      WITH v AS (SELECT * FROM unnest($1::bigint[], $2::text[], $3::text[]) AS v(id, hash, xm)),
      g AS (
        UPDATE fiaon_applications a SET password = v.hash
          FROM v
         WHERE a.id = v.id AND (v.xm IS NULL OR a.xmin::text = v.xm)
           AND a.password IS NOT NULL AND a.password <> '' AND a.password NOT LIKE 'scrypt$%'
        RETURNING a.id, a.ref, a.person_id, (v.hash IS NULL) AS geleert
      )
      INSERT INTO fiaon_passwort_klartext_protokoll (ort, datensatz_id, ref, person_id, massnahme, war_klartext)
      SELECT 'fiaon_applications.password', g.id, g.ref, g.person_id,
             CASE WHEN g.geleert THEN 'geleert_dsgvo_geloescht' ELSE 'gehasht' END, TRUE
        FROM g
      ON CONFLICT (ort, datensatz_id) DO UPDATE SET massnahme = EXCLUDED.massnahme, am = NOW()
      RETURNING datensatz_id`,
      [stapel.map((f) => f.id), stapel.map((f) => f.hash), stapel.map((f) => f.xm)]) as any[];
    const ids = new Set(r.map((x) => Number(x.datensatz_id)));
    for (const f of stapel) if (ids.has(f.id)) {
      geschrieben.set(f.id, f.hash);
      if (f.hash) erg.gehasht++; else erg.geleert++;
    }
  };
  for (let i = 0; i < faelle.length; i += STAPEL) await schreibe(faelle.slice(i, i + STAPEL));

  // 1b. Nachzügler: Zeilen, die sich seit dem Lesen geändert haben und noch Klartext tragen — jetzt unter
  //     Zeilensperre (lock_timeout 3 s) neu lesen und hashen. Normalfall: 0.
  const rest = await t.unsafe(`SELECT id, password, (gdpr_deleted_at IS NOT NULL) AS geloescht
                                 FROM fiaon_applications WHERE ${KLARTEXT} ORDER BY id FOR UPDATE`) as any[];
  if (rest.length > 0) {
    const nach = rest.map((z) => ({ id: Number(z.id), hash: z.geloescht ? null : hashMitBeweis(String(z.password)), xm: null }));
    const vorher = geschrieben.size;
    await schreibe(nach);
    erg.nachgezogen = geschrieben.size - vorher;
  }

  // 2. fiaon_applications.utm — Rechnung in der DB, Protokoll nur mit Schlüsselnamen und Zählern.
  const u = await t.unsafe(`${UTM_BERECHNUNG}
    , geaendert AS (
      UPDATE fiaon_applications a SET utm = n.neu
        FROM neu n
       WHERE a.id = n.id AND a.utm IS DISTINCT FROM n.neu
      RETURNING a.id
    )
    INSERT INTO fiaon_utm_bereinigung_protokoll
      (application_id, ref, alte_form, alte_schluessel, passwort_eintraege, behaltene_schluessel)
    SELECT n.id, n.ref, n.alte_form, n.alte_schluessel, n.passwort_eintraege,
           ARRAY(SELECT jsonb_object_keys(n.neu) ORDER BY 1)
      FROM geaendert g JOIN neu n ON n.id = g.id
    ON CONFLICT (application_id) DO NOTHING
    RETURNING application_id`, [ERLAUBT, PW_SCHLUESSEL]) as any[];
  erg.utm = u.length;

  // 3. fiaon_persons.password — die tote Kopie leeren (in Stapeln über den Primärschlüssel).
  const pIds = (await t`SELECT id FROM fiaon_persons WHERE password IS NOT NULL ORDER BY id`).map((x: any) => Number(x.id));
  for (let i = 0; i < pIds.length; i += 500) {
    const r = await t.unsafe(`
      WITH z AS (SELECT id, (password <> '' AND password NOT LIKE 'scrypt$%') AS war_klartext
                   FROM fiaon_persons WHERE id = ANY($1::int[]) AND password IS NOT NULL FOR UPDATE),
      g AS (UPDATE fiaon_persons p SET password = NULL FROM z WHERE p.id = z.id RETURNING p.id, z.war_klartext)
      INSERT INTO fiaon_passwort_klartext_protokoll (ort, datensatz_id, ref, person_id, massnahme, war_klartext)
      SELECT 'fiaon_persons.password', g.id, NULL, g.id, 'geleert_kopie', g.war_klartext FROM g
      ON CONFLICT (ort, datensatz_id) DO UPDATE SET massnahme = EXCLUDED.massnahme, am = NOW()
      RETURNING datensatz_id`, [pIds.slice(i, i + 500)]) as any[];
    erg.personen += r.length;
  }

  // 4. Kontrolle IN der Transaktion — sonst ROLLBACK.
  const nachher = await stand(t);
  zeige(probe ? "nachher (im Probelauf, vor dem ROLLBACK)" : "nachher (vor dem COMMIT)", nachher);
  if (!sauber(nachher)) throw new Abbruch("Kontrolle: Es ist noch etwas übrig — ROLLBACK, nichts geändert.");

  //    Jeder geschriebene Hash steht so in der DB, wie er vor dem Schreiben geprüft wurde …
  const ids = [...geschrieben.keys()];
  const [gleich] = await t.unsafe(`
    SELECT COUNT(*)::int AS n FROM fiaon_applications a
      JOIN unnest($1::bigint[], $2::text[]) AS v(id, hash) ON a.id = v.id
     WHERE a.password IS NOT DISTINCT FROM v.hash`, [ids, ids.map((i) => geschrieben.get(i) ?? null)]) as any[];
  if (Number(gleich.n) !== ids.length) throw new Abbruch(`Kontrolle: ${ids.length - Number(gleich.n)} Hashes weichen ab — ROLLBACK.`);
  //    … und eine Stichprobe wird aus der DB gelesen und mit der Anmelde-Funktion gegen das Original geprüft.
  const klar = new Map(faelle.map((f) => [f.id, f.klar]));
  const stich = ids.filter((i) => geschrieben.get(i) && klar.has(i)).sort(() => Math.random() - 0.5).slice(0, 12);
  if (stich.length > 0) {
    const r = await t`SELECT id, password FROM fiaon_applications WHERE id = ANY(${stich}::int[])` as any[];
    const falsch = r.filter((x) => !passwortPasst(x.password, klar.get(Number(x.id))!)).length;
    if (falsch > 0 || r.length !== stich.length) throw new Abbruch(`Kontrolle: Stichprobe — ${falsch} von ${stich.length} Passwörtern passen nicht — ROLLBACK.`);
    console.log(`  Stichprobe: ${stich.length} von ${stich.length} Konten melden sich mit dem alten Passwort an (gegen den Hash aus der DB).`);
  }
  if (probe) throw Object.assign(new Probelauf(), { erg });
  return erg;
}

// ── CHECKs (nach dem COMMIT, je kurz) ───────────────────────────────────────
async function checksAnlegen(): Promise<boolean> {
  const versuche = async (text: string, f: () => Promise<unknown>): Promise<boolean> => {
    for (let i = 1; i <= 5; i++) {
      try { await f(); return true; } catch (e: any) {
        if (!istSperre(e) || i === 5) { console.log(`  ${text}: FEHLER ${fehlerText(e)}`); return false; }
        console.log(`  ${text}: Sperre belegt (Versuch ${i}/5) — warte 5 s`);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
    return false;
  };
  const vorhanden = await checksStand(sql);
  let ok = true;
  // NOT VALID braucht eine kurze exklusive Sperre, VALIDATE nur eine, die Lesen und Schreiben zulässt.
  // lock_timeout (3 s) und statement_timeout (30 s) gelten für die ganze Verbindung (siehe postgres(...) oben).
  const appNeu: string[] = [];
  if (vorhanden.fiaon_applications_password_gehasht === null) appNeu.push(`ADD CONSTRAINT fiaon_applications_password_gehasht CHECK (password IS NULL OR password = '' OR password LIKE 'scrypt$%') NOT VALID`);
  if (vorhanden.fiaon_applications_utm_erlaubt === null) appNeu.push(`ADD CONSTRAINT fiaon_applications_utm_erlaubt CHECK (utm IS NULL OR (jsonb_typeof(utm) = 'object' AND (utm - ${ERLAUBT_SQL}) = '{}'::jsonb)) NOT VALID`);
  if (appNeu.length > 0) ok = (await versuche("CHECKs an fiaon_applications anlegen", () => sql.unsafe(`ALTER TABLE fiaon_applications ${appNeu.join(", ")}`))) && ok;
  if (vorhanden.fiaon_persons_password_gehasht === null) {
    ok = (await versuche("CHECK an fiaon_persons anlegen", () => sql.unsafe(`ALTER TABLE fiaon_persons ADD CONSTRAINT fiaon_persons_password_gehasht CHECK (password IS NULL OR password LIKE 'scrypt$%') NOT VALID`))) && ok;
  }
  for (const [tabelle, name] of [["fiaon_applications", "fiaon_applications_password_gehasht"], ["fiaon_applications", "fiaon_applications_utm_erlaubt"], ["fiaon_persons", "fiaon_persons_password_gehasht"]]) {
    ok = (await versuche(`VALIDATE ${name}`, () => sql.unsafe(`ALTER TABLE ${tabelle} VALIDATE CONSTRAINT ${name}`))) && ok;
  }
  const danach = await checksStand(sql);
  for (const [n, v] of Object.entries(danach)) console.log(`  ${n}: ${v === null ? "FEHLT" : v ? "angelegt und geprüft" : "angelegt, NICHT geprüft"}`);
  return ok && Object.values(danach).every((v) => v === true);
}

// ── Ablauf ──────────────────────────────────────────────────────────────────
let exitCode = 0;
try {
  console.log(`E-242 Klartext raus — Modus: ${MODUS} · Datenbank: ${LOKAL ? "lokal" : "NICHT lokal"}`);
  const vorher = await sql.begin("read only", (t) => stand(t));
  zeige("vorher", vorher);
  const checks = await checksStand(sql);
  console.log(`\n== CHECKs: ${Object.entries(checks).map(([n, v]) => `${n} ${v === null ? "fehlt" : v ? "aktiv" : "NICHT geprüft"}`).join(" · ")}`);

  if (MODUS === "vorschau") {
    await sql.begin("read only", (t) => utmVorschau(t));
    console.log(`\n== Vorschau: ${vorher.app_klartext - vorher.app_klartext_dsgvo} Spalten-Passwörter würden gehasht, ${vorher.app_klartext_dsgvo} (DSGVO-gelöscht) geleert, ${vorher.person_gesetzt} Personen-Kopien geleert. Nur gelesen.`);
  } else if (MODUS === "nur-checks") {
    if (!sauber(vorher)) throw new Abbruch("Die Daten sind nicht sauber — erst --ausfuehren.");
    if (!(await checksAnlegen())) exitCode = 4;
  } else {
    console.log("\n== Hashes rechnen und prüfen (vor der Transaktion)");
    const faelle = await vorbereiten();
    const t0 = Date.now();
    let erg: Ergebnis | null = null;
    try {
      erg = await sql.begin((t) => bereinigen(t, faelle, MODUS === "probelauf")) as Ergebnis;
    } catch (e: any) {
      if (e instanceof Probelauf) {
        const x = (e as any).erg as Ergebnis;
        console.log(`\n== Probelauf: würde ${x.gehasht} Passwörter hashen, ${x.geleert} leeren (DSGVO-gelöscht), ${x.nachgezogen} nachziehen, ${x.utm} utm-Zeilen bereinigen, ${x.personen} Personen-Kopien leeren. Transaktion ${Date.now() - t0} ms — ROLLBACK, nichts geändert.`);
      } else throw e;
    } finally {
      for (const f of faelle) f.klar = ""; // Klartext nicht länger als nötig halten
    }
    if (erg) {
      console.log(`\n== COMMIT: ${erg.gehasht} Passwörter gehasht, ${erg.geleert} geleert (DSGVO-gelöscht), ${erg.nachgezogen} nachgezogen, ${erg.utm} utm-Zeilen bereinigt, ${erg.personen} Personen-Kopien geleert. Transaktion ${Date.now() - t0} ms.`);
      zeige("nachher (nach dem COMMIT)", await sql.begin("read only", (t) => stand(t)));
      console.log("\n== CHECKs anlegen");
      if (!(await checksAnlegen())) { exitCode = 4; console.log("  Daten sind sauber, aber nicht alle CHECKs stehen — später mit --nur-checks nachholen."); }
    }
  }
} catch (e: any) {
  if (e instanceof Abbruch) { console.error(`\nABBRUCH: ${e.message}`); exitCode = e.code; }
  else if (istSperre(e)) { console.error(`\nABBRUCH (Sperre/Zeitlimit, ROLLBACK — nichts geändert, später wiederholen): ${fehlerText(e)}`); exitCode = 3; }
  else { console.error(`\nFEHLER (ROLLBACK — nichts geändert): ${fehlerText(e)}`); exitCode = 1; }
} finally {
  await sql.end({ timeout: 5 });
}
process.exit(exitCode);
