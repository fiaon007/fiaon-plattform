// ═══════════════════════════════════════════════════════════════════════════
// TELEFONKARTEI — der Server hinter Justins Anrufseite (21.09.2026, E-201)
//
// Justin: „Ich habe heute selbst telefoniert und es lief hervorragend." Er
// wollte eine eigene, simple Seite: alle Kunden als Kartei, Anrufen mit
// Kontakt-Speichern am iPhone, und für jeden Kunden vier Wege — Rechnung
// (Mail mit PDF + WhatsApp), nicht erreicht (Mail + WhatsApp mit seinem
// Kalender), stornieren, später anrufen.
//
// WAS HIER STEHT, IST FAST NUR VERDRAHTUNG
// Jede Wirkung läuft über den Weg, den das Haus dafür schon hat — sonst sähen
// die Mitarbeiter etwas anderes als Justin:
//   · Stufe A/B/C        priority_tier (tier.ts); „Rate offen" = RATE_FAELLIG_SQL
//   · Reihung            EREIGNIS_SQL — dieselbe Frische wie die Arbeitsliste;
//                        seit E-259 dazu die Anrufversuche (fiaon-anrufversuche.ts)
//                        und die Wunschzeit (JETZT_ERREICHBAR_SQL), KARTEI_ORDNUNG_SQL
//   · WhatsApp           waSenden (fiaon-whatsapp.ts) — seit E-259 über das
//                        FIAON-Konto bei Meta, nie mehr über wa.me
//   · Nummer             waehlbareNummer (fiaon-telefon.ts)
//   · Preis              katalogpreisCents — Katalog vor amount_due (E-181)
//   · Ergebnis           ergebnisNachbereiten (fiaon-kontakt-ergebnis.ts); für
//                        Leads logLead + dieselbe Statuszuordnung wie die
//                        Lead-Route
//   · Rechnung           rechnungStellen (nurBuchen), dann freitextVersenden mit
//                        der Rechnung als PDF — Wand, Protokoll, Akte inklusive
//   · Freie E-Mail       freitextVersenden wie die Verwaltung (E-274) — ohne
//                        Ergebnis; die Rechnung nur mit der eigenen Referenz
//   · Storno             kuendigungSetzen (Hausregel E-092/E-159), Vertriebs-
//                        und Werbesperre, Lead-Stopp, Termin-Absage
//
// JUSTIN WIRD NIE BETREUER
// Einträge im Verlauf tragen agent_id NULL und seinen Namen. `betreuerVon` und
// die Provisionsregel zählen nur Einträge MIT agent_id — ein Anruf des Chefs
// nimmt keinem Mitarbeiter den Kunden oder die Provision (wie E-124).
//
// „ZAHLT GLEICH" HEISST: ZUSAGE MORGEN
// Das Haus-Ergebnis „erreicht — zahlt sofort" setzt die Zusage auf HEUTE; damit
// stünde der Kunde Minuten nach Justins Anruf ganz oben in der Liste seines
// Betreuers („Zusage fällig") und bekäme den zweiten Anruf. Deshalb hier
// „zahlt am" mit morgen: Kommt das Geld, ist er ohnehin raus.
// ═══════════════════════════════════════════════════════════════════════════

import { createHash } from "node:crypto";
import { sqlPool } from "./db-pool";
import { waehlbareNummer } from "./fiaon-telefon";
import { katalogpreisCents } from "./fiaon-massgebliche-bestellung";
import { terminTokenErzeugen } from "./fiaon-termine";
import { produktkategorieSql } from "./fiaon-produktkategorie";
import { globalKundeSql, globalKundeBereit, istGlobalKunde } from "./fiaon-global-kunde";
import { berlinPlusTage } from "./fiaon-time";
import { ABBRECHER_STATUS } from "./tier";
import { boniLateralSql, BONI_SPALTEN_SQL, boniEingangAusZeile } from "./fiaon-boni-ampel";
import { boniAmpel } from "@shared/fiaon-boni-ampel";
import { absoluteUrl } from "../fiaon-base-url";
import { signInvoiceUrl } from "../fiaon-invoice";
import { kurzFenster } from "@shared/fiaon-erreichbarkeit";
import { KUNDENSTATUS, ETIKETT_FRIST_ABGELAUFEN } from "@shared/fiaon-kundenstatus";
import { paket as katalogPaket } from "@shared/fiaon-pakete";
import { terminArtAusQuelle } from "@shared/fiaon-termin-art";
import { ERGEBNIS_TEXT, istErgebnis, type Ergebnis } from "@shared/fiaon-kontakt-ergebnis-liste";
import { whatsappUrteil } from "@shared/fiaon-whatsapp-erlaubnis";
import { WA_VORLAGEN, bildName } from "@shared/fiaon-lead-texte";
import { persoenlicherLink, stufeAusAntrag, type MaraKanal } from "@shared/fiaon-mara-ton";
import { antragAbgeschickt, abgeschicktSql } from "@shared/fiaon-antrag-stand";
import {
  KARTEI_SEITE, KARTEI_LAGE_TEXT, KARTEI_WA_VORLAGE, NICHT_ERREICHT_HINWEIS, datumKurz, euro, euroGanz,
  mailRechnung, mailNichtErreicht, mailAntrag, hatRechnungsweg, hatAntragsweg,
  whatsappNichtErreicht, whatsappAntrag, karteiWaVorlage, ohneEmojis,
  type KarteiGruppe, type KarteiKarte, type KarteiLage, type KarteiZahlung,
  type KarteiErgebnis, type KarteiRueckruf, type KarteiTermin,
  type KarteiWaFall, type KarteiWaFallLage, type KarteiWaLage, type KarteiWaErgebnis,
  KARTEI_MAIL_DOPPELT_SEKUNDEN, KARTEI_MAIL_BETREFF_MAX, KARTEI_MAIL_TEXT_MAX,
  type KarteiMailZeile, type KarteiMailLage, type KarteiMailAntwort,
} from "@shared/fiaon-telefonkartei";
import { anrufversucheCte, ANRUFE_ENDE, FRISCH_TAGE, PAUSE_STUNDEN } from "./fiaon-anrufversuche";

/** Rechnungslinks in WhatsApp halten 30 Tage (die Vorgabe von 72 Stunden ist für Mails an Make). */
const RECHNUNG_LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;

/** Doppelklick-Schutz: dieselbe Handlung am selben Menschen innerhalb dieser Minuten zählt einmal. */
const DOPPELT_MINUTEN = 10;

/** „Nicht erreicht"-Mails höchstens alle drei Tage je Mensch — das ist Service, keine Kampagne. */
const NICHT_ERREICHT_MAIL_ABSTAND_TAGE = 3;

// ── Tabellen ────────────────────────────────────────────────────────────────
// Zwei kleine eigene Tabellen: die Storno-Liste (mit dem Vorher-Stand, damit
// „Zurückholen" genau das zurücknimmt, was der Storno getan hat) und Justins
// Rückrufe. KEINE neue Spalte an fiaon_persons — ALTER TABLE nimmt dort eine
// Sperre auf die meistgelesene Tabelle des Hauses (tier.ts, „30 Sekunden").
let tabellenBereit: Promise<void> | null = null;
export function karteiTabellen(): Promise<void> {
  if (!tabellenBereit) {
    tabellenBereit = (async () => {
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_telefonkartei_storno (
          person_id INTEGER PRIMARY KEY,
          am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          grund TEXT,
          durch TEXT,
          durch_agent_id INTEGER,
          stand JSONB NOT NULL DEFAULT '{}'::jsonb,
          zurueck_am TIMESTAMPTZ,
          zurueck_durch TEXT
        )`;
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_telefonkartei_rueckruf (
          id SERIAL PRIMARY KEY,
          person_id INTEGER NOT NULL,
          am TIMESTAMPTZ NOT NULL,
          notiz TEXT,
          angelegt_am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          angelegt_durch TEXT,
          erledigt_am TIMESTAMPTZ
        )`;
      await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_tk_rueckruf_offen_idx ON fiaon_telefonkartei_rueckruf (am) WHERE erledigt_am IS NULL`;
      // Nachbesserung E-259 (29.09.2026): der Takt der Knöpfe — eine Zeile je Mensch und Knopf
      // (Doppelklick auf zwei Geräten, 3-Tage-Marke für „Nicht erreicht" als freier Text). Siehe taktNehmen.
      await sqlPool`
        CREATE TABLE IF NOT EXISTS fiaon_telefonkartei_takt (
          person_id INTEGER NOT NULL,
          art TEXT NOT NULL,
          am TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (person_id, art)
        )`;
    })().catch((e) => { tabellenBereit = null; throw e; });
  }
  return tabellenBereit;
}

/** JSONB tolerant lesen — der erste Radar-Test lag doppelt verpackt (siehe fiaon-radar.ts). */
function ausJson<T>(v: unknown, vorgabe: T): T {
  if (v == null) return vorgabe;
  if (typeof v === "string") { try { return JSON.parse(v) as T; } catch { return vorgabe; } }
  return v as T;
}

const text = (v: unknown): string => String(v ?? "").trim();
const iso = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? null : d.toISOString();
};
const tagText = (v: unknown): string | null => {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = String(v).match(/^(\d{4}-\d{2}-\d{2})/);
  return m ? m[1] : null;
};

/** Der Name, der im Verlauf und unter den Nachrichten steht. */
export async function akteurName(agentId: number | null | undefined): Promise<string> {
  if (agentId) {
    const [a] = (await sqlPool`SELECT name FROM fiaon_agents WHERE id = ${agentId}`.catch(() => [])) as any[];
    if (text(a?.name)) return text(a.name);
  }
  return "Justin Schwarzott";
}

// ── Die Abfrage ─────────────────────────────────────────────────────────────

const ABBRECHER_SQL = ABBRECHER_STATUS.map((s) => `'${s}'`).join(", ");
const KATEGORIE_A = produktkategorieSql("a");
// ── E-272 (02.10.2026): GLOBAL-KUNDEN STEHEN IN KEINEM REITER ───────────────
// Justin (Fall Hildbrand): „nehme ihn bitte komplett aus den Workflows … Er soll
// Global bleiben, also keine unnötigen Mails.“ Die Reiter (A, B, C, Rate offen,
// Alle) sind die Anrufliste der Privatlinie. Ein Global-Kunde (Regel:
// fiaon-global-kunde.ts) steht in keinem davon — auch nicht mit der alten Stufe,
// die er bis zum nächsten Neurechnen nach einem neuen Individualangebot trägt,
// und nicht unter „Alle“ als „Ausgeschlossen — Bestellung storniert“. Die Suche
// und der Einzelaufruf finden ihn weiter (wie Gesperrte und Testkonten).
//
// ALS MENGE, NICHT JE ZEILE — gemessen (Produktion, nur lesend, 02.10.): Die
// Regel je Zeile in der Bedingung kostet selbst nur ~20 ms für alle Personen,
// aber der Planer schätzt eine Bedingung aus einer Unterabfrage auf „trifft die
// Hälfte“. Mit halb so vielen erwarteten Zeilen verband er die Anrufzählung (vz)
// in einer Schleife statt per Hash: Reiter „Alle“ 173 ms → 1.191 ms, C 131 → 984.
// Als Menge (die Regel EINMAL über alle Köpfe, dann „p.id <> ALL(…)“) bleibt die
// Schätzung wie vorher und der Plan derselbe. Die Köpfe genügen: Jede Liste hier
// zeigt nur Personen mit merged_into_person_id IS NULL.
const GLOBAL_KUNDEN_IDS_SQL = `ARRAY(SELECT gkt.id FROM fiaon_persons gkt
  WHERE gkt.merged_into_person_id IS NULL AND ${globalKundeSql("gkt.id")})`;

interface Filter {
  gruppe: KarteiGruppe;
  suche?: string;
  gesperrte?: boolean;
  personId?: number;
  /**
   * Nachbesserung E-259: die schon gezeigten Karten — „Weitere laden" holt die
   * nächstbesten OHNE sie, statt per OFFSET zu blättern (siehe karteiListe).
   */
  ohne?: number[];
}

async function vertriebSql(): Promise<{ RATE_FAELLIG_SQL: string; EREIGNIS_SQL: string; JETZT_ERREICHBAR_SQL: string }> {
  const m = await import("../routes/fiaon-office-vertrieb");
  return { RATE_FAELLIG_SQL: m.RATE_FAELLIG_SQL, EREIGNIS_SQL: m.EREIGNIS_SQL, JETZT_ERREICHBAR_SQL: m.JETZT_ERREICHBAR_SQL };
}

/**
 * „Stopp" des Menschen für die Karte (Nachbesserung E-259) — dieselbe Lesart wie
 * menschSperre (fiaon-mail-frequenz.ts, E-253): WhatsApp „STOPP"/„Keine
 * Nachrichten mehr" oder Postfach-Merkmal stopp, an irgendeiner Person seiner
 * Familie. `b.id` ist immer ein Kopf (merged_into_person_id IS NULL), also genügt
 * die Menge der Köpfe mit Stopp (STOPP_KOEPFE_SQL, einmal je Abfrage gebildet).
 * Gemessen (Produktion, nur lesend): 10 ms für eine Seite; die Familie je Karte
 * einzeln abzufragen kostete 80 ms.
 */
async function stoppSql(): Promise<string> {
  const m = await import("./fiaon-mail-frequenz");
  return `(b.id IN ${m.STOPP_KOEPFE_SQL})`;
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE REIHENFOLGE (29.09.2026, E-259)
//
// Justin: „Ich brauche ganz oben immer den frischesten Kunden, einen Kunden,
// der nicht schon 10× angerufen wurde — also gib mir ganz oben A, dann B und
// dann C Kunden, die keine oder am wenigsten Anrufe bekommen haben — ich rufe
// oft 30 Kunden an, ohne dass jemand erreichbar ist."
//
// GEMESSEN (Produktion, nur lesend, 29.09.): Bis heute zählte nur das jüngste
// Ereignis. Im Reiter A hatten von den ersten 30 sechs schon 10 und mehr
// Anrufe, zwölf waren drei- und mehrmal in Folge nicht erreicht (längste Serie
// 16). Wer noch nie erreicht wurde, geht beim ersten Anruf zu 24,6 % ran, nach
// fünf Fehlversuchen in Folge zu ~12 %.
//
// DIE REGEL — für jeden Reiter dieselbe Ordnung (im Einzelreiter ist die Stufe
// fest, dort fällt Schritt 3 weg):
//   1  ab 10 Versuchen ans Ende (in „Alle" dazu Bezahlte, Abbrecher,
//      Ausgeschlossene — sie gehören in keinen der Stufen-Reiter)
//   2  frisch zuerst: Ereignis (Antrag, Zahlungsmeldung, fällige Rate)
//      höchstens 3 Tage alt — in „Alle" also erst die Frischen quer über die
//      Stufen, dann der Bestand. Streng „A, dann B, dann C" hätte oben nur alte
//      A-Kunden gezeigt (Median 39 Tage), der erste frische B-Kunde stünde
//      hinter ~70 A-Karten.
//   3  Stufe A → B → C → Rate offen
//   4  Pause nach hinten: in den letzten 20 Stunden versucht, Zusage läuft,
//      Termin gebucht oder dein Rückruf offen — wer gerade dran war, steht
//      nicht gleich wieder oben
//   5  wenigste Versuche: 0 | 1–2 | 3–5 | 6–9 — „keine oder am wenigsten"
//   6  innerhalb derselben Versuchsstufe: Wunschzeit aus dem Antrag passt jetzt
//      (E-184, dieselbe Regel wie die Arbeitsliste)
//   7  dann die kürzeste Serie ohne Erreichen, dann das jüngste Ereignis
// Nachbesserung E-259 (29.09.2026): 5 und 6 getauscht. Vorher stand die
// Wunschzeit VOR der Versuchszahl — gemessen im Reiter „Alle": „8 Versuche" auf
// Platz 7 über sechs Karten „noch nie angerufen", nur weil deren Wunschzeit
// gerade nicht passte. Justin: „die keine oder am wenigsten Anrufe bekommen haben".
// `pause` und `fenster_jetzt` sind nie NULL (COALESCE) — NULL sortierte sonst
// hinter TRUE, im Test gemessen.
// ═══════════════════════════════════════════════════════════════════════════
export const KARTEI_ORDNUNG_SQL = `
      (b.versuche >= ${ANRUFE_ENDE} OR b.rang = 5),
      COALESCE(b.ereignis_am < NOW() - INTERVAL '${FRISCH_TAGE} days', TRUE),
      b.rang,
      b.pause,
      CASE WHEN b.versuche = 0 THEN 0 WHEN b.versuche <= 2 THEN 1 WHEN b.versuche <= 5 THEN 2 ELSE 3 END,
      NOT b.fenster_jetzt,
      b.fehl_folge,
      b.ereignis_am DESC NULLS LAST,
      b.id DESC`;

/** Die Felder der Basis, nach denen gereiht wird — `p` ist die Person, `vz` die Anrufzählung. */
function reihungSpalten(RATE_FAELLIG_SQL: string, JETZT_ERREICHBAR_SQL: string): string {
  return `
      COALESCE(vz.versuche, 0) AS versuche, COALESCE(vz.fehl_folge, 0) AS fehl_folge, vz.letzter AS letzter_versuch,
      CASE WHEN p.priority_tier = 1 THEN 1
           WHEN p.priority_tier = 2 THEN 2
           WHEN p.priority_tier = 3 AND p.tier_reason = 'nur_lead' THEN 3
           WHEN COALESCE(p.priority_tier, 0) = 0 AND ${RATE_FAELLIG_SQL} THEN 4
           ELSE 5 END AS rang,
      (COALESCE(vz.letzter > NOW() - INTERVAL '${PAUSE_STUNDEN} hours', FALSE)
        OR COALESCE(p.promised_payment_date >= (NOW() AT TIME ZONE 'Europe/Berlin')::date, FALSE)
        OR EXISTS (SELECT 1 FROM fiaon_termine tp WHERE tp.person_id = p.id AND tp.status = 'gebucht' AND tp.beginn > NOW())
        OR EXISTS (SELECT 1 FROM fiaon_telefonkartei_rueckruf rp WHERE rp.person_id = p.id AND rp.erledigt_am IS NULL)) AS pause,
      COALESCE(${JETZT_ERREICHBAR_SQL}, TRUE) AS fenster_jetzt`;
}

function suchBedingung(suche: string) {
  const s = suche.trim().slice(0, 80);
  if (!s) return sqlPool``;
  const muster = `%${s.replace(/[%_\\]/g, (z) => `\\${z}`)}%`;
  const ziffern = s.replace(/\D/g, "");
  // Die letzten acht Ziffern: „0171 1234567" und „+49 171 1234567" sind dieselbe Nummer.
  const tel = ziffern.length >= 6 ? `%${ziffern.slice(-8)}` : null;
  return sqlPool`AND (
      (COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')) ILIKE ${muster}
      OR COALESCE(p.contact_name, '') ILIKE ${muster}
      OR COALESCE(p.primary_email, '') ILIKE ${muster}
      ${tel ? sqlPool`OR regexp_replace(COALESCE(p.primary_phone, ''), '\\D', '', 'g') LIKE ${tel}` : sqlPool``}
      OR EXISTS (SELECT 1 FROM fiaon_applications sa WHERE sa.person_id = p.id AND sa.merged_into IS NULL AND (
           sa.ref ILIKE ${muster} OR COALESCE(sa.payment_reference, '') ILIKE ${muster}
           OR COALESCE(sa.email, '') ILIKE ${muster}
           OR (COALESCE(sa.first_name, '') || ' ' || COALESCE(sa.last_name, '')) ILIKE ${muster}
           ${tel ? sqlPool`OR regexp_replace(COALESCE(sa.phone, ''), '\\D', '', 'g') LIKE ${tel}` : sqlPool``}))
      OR EXISTS (SELECT 1 FROM fiaon_leads sl WHERE sl.person_id = p.id AND (
           COALESCE(sl.email, '') ILIKE ${muster}
           OR (COALESCE(sl.vorname, '') || ' ' || COALESCE(sl.nachname, '')) ILIKE ${muster}
           ${tel ? sqlPool`OR regexp_replace(COALESCE(sl.telefon, ''), '\\D', '', 'g') LIKE ${tel}` : sqlPool``}))
    )`;
}

function gruppenBedingung(gruppe: KarteiGruppe, RATE_FAELLIG_SQL: string) {
  // E-272: jeder Reiter außer „Storniert“ ohne Global-Kunden (GLOBAL_KUNDEN_IDS_SQL oben).
  const ohneGlobal = sqlPool`AND p.id <> ALL(${sqlPool.unsafe(GLOBAL_KUNDEN_IDS_SQL)})`;
  switch (gruppe) {
    case "A": return sqlPool`AND s.person_id IS NULL AND p.priority_tier = 1 ${ohneGlobal}`;
    case "B": return sqlPool`AND s.person_id IS NULL AND p.priority_tier = 2 ${ohneGlobal}`;
    case "C": return sqlPool`AND s.person_id IS NULL AND p.priority_tier = 3 AND p.tier_reason = 'nur_lead' ${ohneGlobal}`;
    case "rate": return sqlPool`AND s.person_id IS NULL AND COALESCE(p.priority_tier, 0) = 0 AND ${sqlPool.unsafe(RATE_FAELLIG_SQL)} ${ohneGlobal}`;
    case "storniert": return sqlPool`AND s.person_id IS NOT NULL`;
    default: return sqlPool`AND s.person_id IS NULL ${ohneGlobal}`;
  }
}

async function zeilenLaden(f: Filter, grenze: number, versatz: number): Promise<any[]> {
  await karteiTabellen();
  await globalKundeBereit();
  const { boniSpaltenSicher } = await import("./fiaon-boni-ampel");
  await boniSpaltenSicher();
  const { RATE_FAELLIG_SQL, EREIGNIS_SQL, JETZT_ERREICHBAR_SQL } = await vertriebSql();
  const STOPP_SQL = await stoppSql();
  // SUCHE FINDET JEDEN (21.09.2026, Justin: „Wenn ich ‚Justin Schwarzott' suche,
  // kommt nichts — mich muss man aber finden."). Seine Datensätze sind als
  // Testkonto markiert (Name eines Mitarbeiters), andere sind gesperrt oder
  // storniert. Die Reiter bleiben ohne sie; wer einen Namen sucht, will genau
  // diesen Menschen — die Karte trägt dann ihr Schild (Testkonto, Sperre, Storno).
  const sucht = !!String(f.suche ?? "").trim();
  const einzeln = f.personId ? sqlPool`AND p.id = ${f.personId}` : sqlPool``;
  const gruppe = f.personId || sucht ? sqlPool`` : gruppenBedingung(f.gruppe, RATE_FAELLIG_SQL);
  const test = f.personId || sucht ? sqlPool`` : sqlPool`AND p.ist_test_am IS NULL`;
  // Gesperrte blendet die Kartei aus, solange Justin sie nicht ausdrücklich will —
  // eine Vertriebssperre heißt meistens: Der Mensch hat Nein gesagt.
  const sperre = f.personId || sucht || f.gruppe === "storniert" || f.gesperrte ? sqlPool`` : sqlPool`AND NOT COALESCE(p.is_blocked, FALSE)`;
  // Nachbesserung E-259: „Weitere laden" ohne die schon gezeigten Karten (siehe karteiListe).
  const ohneIds = (f.ohne ?? []).filter((n) => Number.isInteger(n) && n > 0);
  const ohne = !f.personId && ohneIds.length ? sqlPool`AND p.id <> ALL(${ohneIds}::int[])` : sqlPool``;
  // E-259: eine Ordnung für alle Reiter (KARTEI_ORDNUNG_SQL, oben); nur „Storniert" nach Storno-Datum.
  const ordnung = f.gruppe === "storniert" && !f.personId && !sucht
    ? sqlPool`ORDER BY b.storno_am DESC NULLS LAST, b.id DESC`
    : sqlPool`ORDER BY ${sqlPool.unsafe(KARTEI_ORDNUNG_SQL)}`;
  return (await sqlPool`
    WITH ${sqlPool.unsafe(anrufversucheCte({ personId: f.personId ?? null }))},
    basis AS (
      SELECT p.id, p.first_name, p.last_name, p.contact_name, p.anrede, p.primary_email, p.primary_phone,
             p.street, p.zip, p.city, p.country, p.priority_tier, p.tier_reason, p.is_blocked, p.werbung_gesperrt_am,
             p.unreachable_count, p.promised_payment_date, p.assigned_agent_id, p.created_at,
             (p.ist_test_am IS NOT NULL) AS testfall,
             ${sqlPool.unsafe(EREIGNIS_SQL)} AS ereignis_am,
             ${sqlPool.unsafe(reihungSpalten(RATE_FAELLIG_SQL, JETZT_ERREICHBAR_SQL))},
             s.am AS storno_am, s.grund AS storno_grund, s.durch AS storno_durch
      FROM fiaon_persons p
      LEFT JOIN fiaon_telefonkartei_storno s ON s.person_id = p.id AND s.zurueck_am IS NULL
      -- E-259: die Anrufzählung — ein Hash-Join auf die Liste, keine Schleife über das Kontaktprotokoll.
      LEFT JOIN vz ON vz.person_id = p.id
      WHERE p.merged_into_person_id IS NULL
        ${test} ${einzeln} ${gruppe} ${sperre} ${ohne} ${suchBedingung(f.suche ?? "")}
    ),
    -- ERST DIE SEITE, DANN DIE KARTEN (21.09.2026, E-202): Die Reihenfolge
    -- hängt nur an der Basis (seit E-259: KARTEI_ORDNUNG_SQL bzw. Storno-Datum). Vorher liefen alle
    -- Nachschlagungen unten für JEDEN Menschen der Liste (~5.000 unter „Alle“),
    -- und erst danach wurden 26 ausgewählt — mit den drei Verbindungen der
    -- Boni-Ampel 502 ms statt 278 ms. Jetzt werden nur die Karten der Seite
    -- nachgeschlagen. Jede Verbindung unten ist ein LEFT JOIN auf höchstens
    -- eine Zeile — die Menge und ihre Reihenfolge bleiben dieselben.
    seite AS (
      SELECT * FROM basis b ${ordnung} LIMIT ${grenze} OFFSET ${versatz}
    )
    SELECT b.*,
           o.ref AS o_ref, o.type AS o_type, o.pack_key AS o_pack, o.pack_name AS o_pack_name,
           o.payment_status AS o_status, o.payment_reference AS o_referenz, o.amount_due AS o_betrag,
           o.status AS o_antrag_status, o.current_step AS o_schritt, o.submitted_at AS o_abgeschickt_am,
           o.wanted_limit AS o_wunsch, o.claimed_paid_at AS o_gemeldet, o.created_at AS o_am,
           o.payment_due_date AS o_frist, o.phone AS o_phone, o.phone_country_code AS o_vorwahl,
           o.contact_phone AS o_contact_phone, o.email AS o_email, o.city AS o_city,
           o.erreichbarkeit AS o_erreichbarkeit, o.first_name AS o_vorname, o.last_name AS o_nachname,
           pa.ref AS pa_ref, pa.type AS pa_type, pa.pack_key AS pa_pack, pa.pack_name AS pa_pack_name,
           pa.wanted_limit AS pa_wunsch, pa.phone AS pa_phone, pa.phone_country_code AS pa_vorwahl,
           pa.contact_phone AS pa_contact_phone, pa.email AS pa_email, pa.city AS pa_city,
           pa.first_name AS pa_vorname, pa.last_name AS pa_nachname,
           r.rate_nr, r.betrag_cents AS r_betrag, r.faellig_am AS r_faellig, r.zahlungsreferenz AS r_referenz,
           r.ref AS r_ref, r.anzahl AS r_anzahl,
           x.ref AS x_ref,
           l.id AS l_id, l.vorname AS l_vorname, l.nachname AS l_nachname, l.email AS l_email,
           l.telefon AS l_telefon, l.quelle AS l_quelle, l.kampagne AS l_kampagne, l.erstellt_am AS l_am,
           ag.name AS betreuer,
           k.am AS k_am, k.von AS k_von, k.ergebnis AS k_ergebnis,
           t.beginn AS t_beginn, t.quelle AS t_quelle, tag.name AS t_bei,
           rr.am AS rr_am,
           ${sqlPool.unsafe(STOPP_SQL)} AS stopp,
           ${sqlPool.unsafe(BONI_SPALTEN_SQL)}
    FROM seite b
    -- Die offene Bestellung: erst eine echte Rechnung, dann ein fertiger Antrag
    -- ohne Rechnung; ein Paket vor der Auskunft; nie ein Firmenauftrag (Global).
    LEFT JOIN LATERAL (
      SELECT a.* FROM fiaon_applications a
      WHERE a.person_id = b.id AND a.merged_into IS NULL AND a.archived_at IS NULL
        AND a.gdpr_deleted_at IS NULL AND a.cancelled_at IS NULL
        AND (a.payment_status IN ('pending_payment', 'claimed_paid', 'expired')
             OR (a.payment_status = 'pending' AND COALESCE(a.status, '') NOT IN (${sqlPool.unsafe(ABBRECHER_SQL)})))
        AND ${sqlPool.unsafe(KATEGORIE_A)} <> 'global'
      -- E-264 (29.09.2026): ein ABGESCHICKTER Antrag (oder „Zahlung gemeldet") vor einem nie abgeschickten —
      -- nur dort gibt es eine Rechnung (karteBauen).
      ORDER BY (${sqlPool.unsafe(KATEGORIE_A)} = 'auskunft') ASC,
               (a.payment_status = 'claimed_paid' OR ${sqlPool.unsafe(abgeschicktSql("a"))}) DESC,
               (a.payment_status IN ('pending_payment', 'claimed_paid', 'expired')) DESC,
               a.created_at DESC
      LIMIT 1) o ON TRUE
    LEFT JOIN LATERAL (
      SELECT a.* FROM fiaon_applications a
      WHERE a.person_id = b.id AND a.merged_into IS NULL AND a.archived_at IS NULL
        AND a.payment_status = 'paid' AND ${sqlPool.unsafe(KATEGORIE_A)} = 'konto'
      ORDER BY a.created_at DESC LIMIT 1) pa ON TRUE
    -- Die älteste fällige, offene Rate zuerst — sie ist zuerst zu zahlen.
    LEFT JOIN LATERAL (
      SELECT r.rate_nr, r.betrag_cents, r.faellig_am, r.zahlungsreferenz, r.ref,
             COUNT(*) OVER () AS anzahl
      FROM fiaon_abo_raten r JOIN fiaon_applications ar ON ar.ref = r.ref
      WHERE ar.person_id = b.id AND ar.merged_into IS NULL
        AND r.status = 'offen' AND r.storniert_am IS NULL
        AND r.faellig_am <= (NOW() AT TIME ZONE 'Europe/Berlin')::date
      ORDER BY r.faellig_am ASC, r.rate_nr ASC LIMIT 1) r ON TRUE
    LEFT JOIN LATERAL (
      SELECT a.ref FROM fiaon_applications a
      WHERE a.person_id = b.id AND a.merged_into IS NULL
      ORDER BY a.created_at DESC LIMIT 1) x ON TRUE
    LEFT JOIN LATERAL (
      SELECT l.* FROM fiaon_leads l WHERE l.person_id = b.id ORDER BY l.erstellt_am DESC LIMIT 1) l ON TRUE
    LEFT JOIN fiaon_agents ag ON ag.id = b.assigned_agent_id
    LEFT JOIN LATERAL (
      SELECT y.am, y.von, y.ergebnis FROM (
        SELECT cl.created_at AS am, cl.agent_name AS von, cl.outcome AS ergebnis
        FROM fiaon_contact_log cl JOIN fiaon_applications ca ON ca.ref = cl.ref
        WHERE ca.person_id = b.id AND cl.type = 'result' AND cl.voided_at IS NULL
        UNION ALL
        SELECT ll.created_at, ll.agent_name, ll.outcome
        FROM fiaon_lead_log ll JOIN fiaon_leads cl2 ON cl2.id = ll.lead_id
        WHERE cl2.person_id = b.id AND ll.type = 'result'
      ) y ORDER BY y.am DESC LIMIT 1) k ON TRUE
    LEFT JOIN LATERAL (
      SELECT t.beginn, t.quelle, t.agent_id FROM fiaon_termine t
      WHERE t.person_id = b.id AND t.status = 'gebucht' AND t.beginn > NOW()
      ORDER BY t.beginn LIMIT 1) t ON TRUE
    LEFT JOIN fiaon_agents tag ON tag.id = t.agent_id
    LEFT JOIN LATERAL (
      SELECT rr.am FROM fiaon_telefonkartei_rueckruf rr
      WHERE rr.person_id = b.id AND rr.erledigt_am IS NULL ORDER BY rr.am LIMIT 1) rr ON TRUE
    ${sqlPool.unsafe(boniLateralSql("b"))}
    ${ordnung}
  `) as any[];
}

// ── Aus einer Zeile wird eine Karte ────────────────────────────────────────

let packLimits: Record<string, number> | null = null;
async function rahmenFuer(packKey: unknown): Promise<number | null> {
  if (!packLimits) packLimits = (await import("../routes/fiaon-antrag")).PACK_LIMITS;
  const k = text(packKey).toLowerCase();
  return k && packLimits[k] != null ? Number(packLimits[k]) : null;
}

/**
 * E-264 (29.09.2026): Ist die offene Bestellung dieser Karte ein ABGESCHICKTER Antrag (oder „Zahlung
 * gemeldet")? Nur dann gibt es eine Rechnung. approved + pending_payment setzt der Antragsweg schon bei
 * Schritt 3–5 — die Kartei bot 94 solchen Menschen nur „Rechnung schicken" (fiaon_kk_rechnung mit
 * Zahlungsseite) an, die Kartei-KI [ZAHLUNGSSEITE] und [RECHNUNG]. EINE Regel: antragAbgeschickt.
 */
function offenAbgeschickt(z: any): boolean {
  if (!z.o_ref) return false;
  if (text(z.o_status) === "claimed_paid") return true;
  return antragAbgeschickt({ status: z.o_antrag_status, current_step: z.o_schritt, submitted_at: z.o_abgeschickt_am });
}

function lageVon(z: any): KarteiLage {
  if (z.storno_am) return "storniert";
  const tier = z.priority_tier == null ? null : Number(z.priority_tier);
  if (tier === 1) return "A";
  // E-264: Stufe B heißt abgeschickt. Ein „pending"-Antrag nach der Konfiguration (Rang 30) steht in der
  // Einstufung noch auf B (Entscheidung offen, tier.ts) — hier ist er, was er ist: ein Abbrecher, mit
  // Wiedereinstieg statt Rechnung.
  if (tier === 2) return z.o_ref && !offenAbgeschickt(z) ? "abbrecher" : "B";
  if (tier === 3) return text(z.tier_reason) === "nur_lead" ? "C" : "abbrecher";
  if (tier === 0) return z.r_referenz ? "rate" : "bezahlt";
  if (tier === -1) return "ausgeschlossen";
  return z.o_ref ? "B" : "C";
}

function standVon(lage: KarteiLage, z: any): string {
  switch (lage) {
    case "A": return `${KUNDENSTATUS.zahlung_gemeldet.text} (${KUNDENSTATUS.zahlung_gemeldet.zusatz})`;
    case "B": {
      if (text(z.o_status) === "pending") return "Antrag fertig — noch keine Rechnung gestellt";
      const frist = z.o_frist ? new Date(z.o_frist) : null;
      const vorbei = text(z.o_status) === "expired" || (!!frist && frist.getTime() < Date.now());
      return `${KUNDENSTATUS.rechnung_offen.text}${vorbei ? ` · ${ETIKETT_FRIST_ABGELAUFEN}` : ""}`;
    }
    case "C": return "Lead ohne Antrag";
    case "rate": {
      const n = Number(z.r_anzahl || 1);
      return `Rate ${z.rate_nr} über ${euro(Number(z.r_betrag))} offen · fällig seit ${datumKurz(tagText(z.r_faellig))}${n > 1 ? ` · ${n} Raten offen` : ""}`;
    }
    case "bezahlt": return KUNDENSTATUS.bezahlt.text;
    case "abbrecher": return "Antrag abgebrochen";
    case "ausgeschlossen": return "Ausgeschlossen — Bestellung storniert oder erstattet";
    case "storniert": return `Storniert am ${datumKurz(tagText(z.storno_am))}${z.storno_durch ? ` durch ${z.storno_durch}` : ""}`;
  }
}

function ergebnisText(outcome: unknown): string | null {
  const o = text(outcome);
  if (!o) return null;
  if (istErgebnis(o)) return ERGEBNIS_TEXT[o];
  const lead: Record<string, string> = {
    erreicht_interesse: "Erreicht — Interesse", erreicht_kein_interesse: "Erreicht — kein Interesse",
  };
  return lead[o] ?? o.replace(/_/g, " ");
}

async function karteBauen(z: any): Promise<KarteiKarte> {
  const lage = lageVon(z);
  const vorname = text(z.first_name) || text(z.o_vorname) || text(z.pa_vorname) || text(z.l_vorname);
  const nachname = text(z.last_name) || text(z.o_nachname) || text(z.pa_nachname) || text(z.l_nachname);
  const name = [vorname, nachname].filter(Boolean).join(" ") || text(z.contact_name) || `Unbekannt #${z.id}`;
  const tel = waehlbareNummer([
    { nummer: z.o_phone, vorwahl: z.o_vorwahl }, { nummer: z.o_contact_phone },
    { nummer: z.pa_phone, vorwahl: z.pa_vorwahl }, { nummer: z.pa_contact_phone },
    { nummer: z.primary_phone }, { nummer: z.l_telefon },
  ], z.country);

  // Welche Bestellung trägt das Paket? Offen vor bezahlt — außer bei „Rate offen".
  const offenZuerst = lage !== "rate" && lage !== "bezahlt" && !!z.o_ref;
  const pRef = offenZuerst ? z.o_ref : (z.pa_ref || z.o_ref);
  const pType = offenZuerst ? z.o_type : (z.pa_ref ? z.pa_type : z.o_type);
  const pKey = offenZuerst ? z.o_pack : (z.pa_ref ? z.pa_pack : z.o_pack);
  const kat = katalogPaket(pKey);
  const preis = pRef ? katalogpreisCents({ ref: pRef, type: pType, pack_key: pKey }) : null;
  const istAuskunft = text(pType) === "schufa" || text(pRef).startsWith("FIAON-SCHUFA-");
  const paketAnzeige = pRef && (kat || istAuskunft)
    ? { key: text(pKey), label: istAuskunft ? "Bonitätsauskunft" : kat!.label, preisCents: preis }
    : null;

  let zahlung: KarteiZahlung | null = null;
  if (lage === "rate" && z.r_referenz) {
    const referenz = text(z.r_referenz);
    zahlung = {
      art: "rate", referenz, betragCents: z.r_betrag != null ? Number(z.r_betrag) : null,
      rateNr: z.rate_nr != null ? Number(z.rate_nr) : null, faelligAm: tagText(z.r_faellig),
      zahlungsseite: absoluteUrl(`/zahlung/${encodeURIComponent(referenz)}`),
      rechnungLink: null, nochKeineRechnung: false,
    };
  } else if (lage !== "storniert" && z.o_ref && text(z.o_referenz) && offenAbgeschickt(z)) {
    // E-264: eine Rechnung nur zu einem abgeschickten Antrag — sonst greift der Antragsweg (hatAntragsweg).
    const referenz = text(z.o_referenz);
    const betrag = katalogpreisCents({ ref: z.o_ref, type: z.o_type, pack_key: z.o_pack })
      ?? (z.o_betrag != null && Number(z.o_betrag) > 0 ? Math.round(Number(z.o_betrag) * 100) : null);
    zahlung = {
      art: "bestellung", referenz, betragCents: betrag, rateNr: null, faelligAm: tagText(z.o_frist),
      zahlungsseite: absoluteUrl(`/zahlung/${encodeURIComponent(referenz)}`),
      rechnungLink: signInvoiceUrl(referenz, RECHNUNG_LINK_TTL_MS),
      nochKeineRechnung: text(z.o_status) === "pending",
    };
  }

  const wunsch = offenZuerst ? z.o_wunsch : (z.pa_wunsch ?? z.o_wunsch);
  const aktenRef = text(z.o_ref) || text(z.r_ref) || text(z.pa_ref) || text(z.x_ref) || null;
  return {
    personId: Number(z.id),
    vorname, nachname, name, lage,
    stand: standVon(lage, z),
    ereignisAm: iso(z.ereignis_am),
    telefonAnzeige: tel.anzeige, telefonWaehlbar: tel.waehlbar, telefonHinweis: tel.hinweis,
    email: text(z.primary_email) || text(z.o_email) || text(z.pa_email) || text(z.l_email) || null,
    ort: text(z.city) || text(z.o_city) || text(z.pa_city) || null,
    paket: paketAnzeige,
    wunschlimitEuro: wunsch != null && Number(wunsch) > 0 ? Number(wunsch) : null,
    rahmenEuro: await rahmenFuer(pKey),
    zahlung,
    ref: aktenRef,
    leadId: z.l_id != null ? Number(z.l_id) : null,
    lead: z.l_id != null ? { quelle: text(z.l_quelle) || null, kampagne: text(z.l_kampagne) || null, am: iso(z.l_am) } : null,
    betreuer: text(z.betreuer) || null,
    kontakt: {
      am: iso(z.k_am), von: text(z.k_von) || null, ergebnis: ergebnisText(z.k_ergebnis),
      nichtErreicht: Number(z.unreachable_count || 0),
      // E-259: aus der Anrufzählung (fiaon-anrufversuche.ts) — auch für Leads.
      versuche: Number(z.versuche || 0),
      fehlInFolge: Number(z.fehl_folge || 0),
      letzterVersuch: iso(z.letzter_versuch),
    },
    termin: z.t_beginn ? { beginn: iso(z.t_beginn)!, art: terminArtAusQuelle(z.t_quelle).text, bei: text(z.t_bei) || null } : null,
    erreichbarkeit: kurzFenster(z.o_erreichbarkeit),
    zusage: tagText(z.promised_payment_date),
    gesperrt: !!z.is_blocked,
    werbungGesperrt: !!z.werbung_gesperrt_am,
    stopp: !!z.stopp,
    testfall: !!z.testfall,
    terminLink: absoluteUrl(`/justin?k=${terminTokenErzeugen(Number(z.id))}`),
    akteId: aktenRef ?? (z.l_id != null ? `lead-${Number(z.l_id)}` : null),
    akteLink: aktenRef
      ? `/akte/${encodeURIComponent(aktenRef)}`
      : (z.l_id != null ? `/chef/s/akte?id=lead-${Number(z.l_id)}` : null),
    storno: z.storno_am ? { am: iso(z.storno_am)!, grund: text(z.storno_grund) || null, durch: text(z.storno_durch) || null } : null,
    rueckrufAm: iso(z.rr_am),
    // E-202: FIAONs eigene Einschätzung — dieselbe Rechnung wie in der Akte der Mitarbeiter.
    ampel: boniAmpel(boniEingangAusZeile(z, { strasse: z.street, plz: z.zip, ort: z.city, land: z.country })),
    anrede: /^(herr|frau)$/i.test(text(z.anrede)) ? (text(z.anrede).toLowerCase() === "frau" ? "Frau" : "Herr") : null,
  };
}

// ── Liste, Zähler, eine Karte ───────────────────────────────────────────────

/**
 * Eine Seite Karten. Nachbesserung E-259 (29.09.2026): „Weitere laden" schickt
 * die schon gezeigten personIds (`ohne`) und bekommt die nächstbesten OHNE sie —
 * kein OFFSET mehr. Seit E-259 hängt die Reihenfolge an Justins eigenen Klicks
 * (Pause, Versuche); nach 25× „Nicht erreicht" rutschten die Angerufenen nach
 * hinten, und OFFSET 25 zeigte sie ein zweites Mal, während die nächsten 25 nie
 * erschienen (gemessen: in A 25 übersprungen, 5 doppelt). `seite` bleibt nur für
 * Seiten ohne `ohne` (alte Fassung im Browser während des Deploys).
 */
export async function karteiListe(f: Filter & { seite?: number }): Promise<{ karten: KarteiKarte[]; mehr: boolean }> {
  const seite = Math.max(0, Math.min(400, Math.floor(Number(f.seite) || 0)));
  const zeilen = await zeilenLaden(f, KARTEI_SEITE + 1, f.ohne?.length ? 0 : seite * KARTEI_SEITE);
  const karten: KarteiKarte[] = [];
  for (const z of zeilen.slice(0, KARTEI_SEITE)) karten.push(await karteBauen(z));
  return { karten, mehr: zeilen.length > KARTEI_SEITE };
}

export async function karteEinzeln(personId: number): Promise<KarteiKarte | null> {
  const [z] = await zeilenLaden({ gruppe: "alle", personId }, 1, 0);
  return z ? karteBauen(z) : null;
}

export async function karteiZaehler(gesperrte: boolean): Promise<Record<KarteiGruppe, number> & { gesperrt: number }> {
  await karteiTabellen();
  await globalKundeBereit();
  const { RATE_FAELLIG_SQL } = await vertriebSql();
  // E-272: Die Zähler zählen, was die Reiter zeigen — ohne Global-Kunden (GLOBAL_KUNDEN_IDS_SQL oben),
  // auch unter „gesperrt“: Ein gesperrter Global-Kunde erscheint beim Einblenden in keinem Reiter.
  // Die Menge einmal je Abfrage (gk, MATERIALIZED): Als einfache Unterabfrage zog der Planer sie in
  // jeden Zähler einzeln hinein — fünfmal dieselbe Regel, gemessen 11 → 101 ms.
  const offen = gesperrte ? sqlPool`p.id <> ALL(gk.ids)` : sqlPool`p.id <> ALL(gk.ids) AND NOT COALESCE(p.is_blocked, FALSE)`;
  const [z] = (await sqlPool`
    WITH gk AS MATERIALIZED (SELECT ${sqlPool.unsafe(GLOBAL_KUNDEN_IDS_SQL)} AS ids)
    SELECT
      COUNT(*) FILTER (WHERE s.person_id IS NULL AND ${offen})::int AS alle,
      COUNT(*) FILTER (WHERE s.person_id IS NULL AND ${offen} AND p.priority_tier = 1)::int AS a,
      COUNT(*) FILTER (WHERE s.person_id IS NULL AND ${offen} AND p.priority_tier = 2)::int AS b,
      COUNT(*) FILTER (WHERE s.person_id IS NULL AND ${offen} AND p.priority_tier = 3 AND p.tier_reason = 'nur_lead')::int AS c,
      COUNT(*) FILTER (WHERE s.person_id IS NULL AND ${offen} AND COALESCE(p.priority_tier, 0) = 0
                         AND ${sqlPool.unsafe(RATE_FAELLIG_SQL)})::int AS rate,
      COUNT(*) FILTER (WHERE s.person_id IS NOT NULL)::int AS storniert,
      COUNT(*) FILTER (WHERE s.person_id IS NULL AND p.id <> ALL(gk.ids) AND COALESCE(p.is_blocked, FALSE))::int AS gesperrt
    FROM fiaon_persons p
    LEFT JOIN fiaon_telefonkartei_storno s ON s.person_id = p.id AND s.zurueck_am IS NULL
    CROSS JOIN gk
    WHERE p.merged_into_person_id IS NULL AND p.ist_test_am IS NULL
  `) as any[];
  return {
    alle: Number(z?.alle || 0), A: Number(z?.a || 0), B: Number(z?.b || 0), C: Number(z?.c || 0),
    rate: Number(z?.rate || 0), storniert: Number(z?.storniert || 0), gesperrt: Number(z?.gesperrt || 0),
  };
}

// ── Die Kontaktkarte fürs iPhone ────────────────────────────────────────────
// vCard 3.0 — die Fassung, die iOS ohne Umweg als „Neuen Kontakt erstellen"
// zeigt. Der Zusatz „(FIAON)" steht im Namenssuffix: So zeigt das iPhone bei
// einem Rückruf „Max Mustermann (FIAON)" — Justin weiß sofort, wer anruft.
function vEsc(v: unknown): string {
  return String(v ?? "").replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

export function vcardText(k: KarteiKarte): string {
  const heute = new Date().toLocaleDateString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" });
  const notiz = [
    `FIAON · ${KARTEI_LAGE_TEXT[k.lage]}`,
    k.paket ? `Paket: ${k.paket.label}${k.paket.preisCents != null ? ` (${euro(k.paket.preisCents)})` : ""}` : null,
    k.wunschlimitEuro != null ? `Wunschlimit: ${euroGanz(k.wunschlimitEuro)}` : null,
    k.zahlung ? `Verwendungszweck: ${k.zahlung.referenz}` : (k.ref ? `Bestellung: ${k.ref}` : null),
    k.betreuer ? `Betreuer: ${k.betreuer}` : null,
    `Gespeichert am ${heute} aus der Telefonkartei`,
  ].filter(Boolean).join("\n");
  const vor = k.vorname || (!k.nachname ? k.name : "");
  const zeilen = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `N:${vEsc(k.nachname)};${vEsc(vor)};;;(FIAON)`,
    `FN:${vEsc(k.name)} (FIAON)`,
    "ORG:FIAON Kunde",
    k.telefonWaehlbar ? `TEL;TYPE=CELL,VOICE:${k.telefonWaehlbar}` : null,
    k.email ? `EMAIL;TYPE=INTERNET:${vEsc(k.email)}` : null,
    k.ort ? `ADR;TYPE=HOME:;;;${vEsc(k.ort)};;;` : null,
    `NOTE:${vEsc(notiz)}`,
    k.akteLink ? `URL:${absoluteUrl(k.akteLink)}` : null,
    "CATEGORIES:FIAON",
    "END:VCARD",
  ];
  return zeilen.filter(Boolean).join("\r\n") + "\r\n";
}

export function vcardDateiname(k: KarteiKarte): string {
  const roh = `${k.name} FIAON`.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z0-9 ._-]/g, "").trim();
  return `${roh.replace(/\s+/g, "-") || `Kontakt-${k.personId}`}.vcf`;
}

// ── Die vier Fälle ──────────────────────────────────────────────────────────

export interface ErgebnisAntwort {
  ok: boolean;
  meldung: string;
  mail: { ok: boolean; text: string } | null;
  /** E-259: was mit der WhatsApp passiert ist. */
  wa?: KarteiWaErgebnis | null;
  /** Derselbe Knopf binnen zehn Minuten — nichts ging ein zweites Mal raus (kein Fehler). */
  doppelt?: boolean;
  rueckruf?: KarteiRueckruf | null;
}

// mailProtokoll schreibt die Nutzlast als JSON-TEXT in die jsonb-Spalte (jsonb_typeof =
// 'string', gemessen: alle 134 Freitext-Zeilen). Gelesen wird deshalb beides.
const NUTZLAST_SQL = `(CASE WHEN jsonb_typeof(payload) = 'string' THEN (payload #>> '{}')::jsonb ELSE payload END)`;

async function schonGetan(personId: number, kennung: string, akteur: string, minuten: number): Promise<boolean> {
  const [m] = (await sqlPool`
    SELECT 1 AS da FROM fiaon_mail_log
    WHERE person_id = ${personId} AND event = 'frei_text' AND ausgeloest_von = ${akteur}
      AND status = 'versandt'
      AND ${sqlPool.unsafe(NUTZLAST_SQL)}->>'kennung' = ${kennung}
      AND created_at > NOW() - make_interval(mins => ${minuten}::int)
    LIMIT 1`.catch(() => [])) as any[];
  return !!m;
}

// ═══════════════════════════════════════════════════════════════════════════
// DER TAKT — EIN KNOPF ZÄHLT EINMAL, AUCH AUF ZWEI GERÄTEN (Nachbesserung E-259, 29.09.2026)
//
// Gemessen im Prüfstand: zweimal „Rechnung schicken" gleichzeitig (zweites
// Gerät, zweiter Tab) ergab zwei Vorlagen bei Meta — die Prüfung „schon
// gesendet?" las fiaon_whatsapp, und die Zeile entsteht erst nach Metas
// Antwort. Und „Nicht erreicht" im offenen Fenster ging zweimal raus: Der Text
// trägt den Kalenderlink, dessen Token die Uhrzeit enthält — der Vergleich
// „derselbe Text" traf nie; das zweite Mal stand danach „Schon festgehalten"
// im Verlauf, obwohl die WhatsApp raus war.
//
// JETZT: Vor jeder Wirkung nimmt der Knopf seinen Takt — eine Zeile je Mensch
// und Knopf in fiaon_telefonkartei_takt, überschrieben nur, wenn sie älter ist
// als das Fenster (INSERT … ON CONFLICT DO UPDATE … WHERE, atomar: Von zwei
// gleichzeitigen Klicks bekommt genau einer den Zuschlag). Dieselbe Tabelle
// merkt sich, wann die Kartei „Nicht erreicht" als FREIEN TEXT geschickt hat —
// dafür gibt es in fiaon_whatsapp keine Marke, und die 3-Tage-Regel galt
// vorher nur für die Vorlage.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Den Takt nehmen: true = dieser Klick darf wirken; false = derselbe Knopf lief binnen `minuten`.
 * E-274 (02.10.2026): in Sekunden gerechnet — die freie Mail nimmt ein halbes Minutenfenster
 * (KARTEI_MAIL_DOPPELT_SEKUNDEN); ganze Minuten ergeben dasselbe Fenster wie vorher.
 */
async function taktNehmen(personId: number, art: string, minuten: number): Promise<boolean> {
  await karteiTabellen();
  const r = (await sqlPool`
    INSERT INTO fiaon_telefonkartei_takt AS t (person_id, art, am) VALUES (${personId}, ${art}, NOW())
    ON CONFLICT (person_id, art) DO UPDATE SET am = NOW()
      WHERE t.am < NOW() - make_interval(secs => ${Math.round(minuten * 60)}::int)
    RETURNING am`) as any[];
  return r.length > 0;
}

/** Den Takt zurückgeben — wenn der Klick abbrach, bevor irgendetwas rausging. */
async function taktFreigeben(personId: number, art: string): Promise<void> {
  await sqlPool`DELETE FROM fiaon_telefonkartei_takt WHERE person_id = ${personId} AND art = ${art}`.catch(() => {});
}

/** Eine Marke setzen (ohne Fenster) — z. B. „Nicht erreicht als freier Text gesendet". */
async function taktMarke(personId: number, art: string): Promise<void> {
  await sqlPool`
    INSERT INTO fiaon_telefonkartei_takt (person_id, art, am) VALUES (${personId}, ${art}, NOW())
    ON CONFLICT (person_id, art) DO UPDATE SET am = NOW()`.catch((e) => console.error("[TELEFONKARTEI] Marke:", String(e?.message || e).slice(0, 160)));
}

/** Kurzer, fester Schlüssel für einen Text (Doppelklick auf dieselbe persönliche Nachricht). */
function textSchluessel(t: string): string {
  return createHash("sha1").update(t).digest("hex").slice(0, 16);
}

const DOPPELT_MELDUNG = "Schon erledigt — vor weniger als zehn Minuten. Es ging nichts ein zweites Mal raus.";

type Ausgang = "nicht_erreicht" | "zahlt" | "interesse";

const HAUS_ERGEBNIS: Record<Ausgang, Ergebnis> = { nicht_erreicht: "nicht_erreicht", zahlt: "erreicht_zahlt_am", interesse: "erreicht_sonstiges" };
const LEAD_ERGEBNIS: Record<Ausgang, string> = { nicht_erreicht: "nicht_erreicht", zahlt: "erreicht_interesse", interesse: "erreicht_interesse" };

/**
 * Hat Justin dasselbe Ergebnis an diesem Menschen gerade schon festgehalten (auch
 * über die Akte)? Nachbesserung E-259: Diese Prüfung stand in ergebnisBuchen —
 * also NACH Mail und WhatsApp. Jetzt kommt sie vor jeder Wirkung.
 */
async function schonGebucht(k: KarteiKarte, ausgang: Ausgang, akteur: string): Promise<boolean> {
  const [schon] = (await sqlPool`
    SELECT 1 AS da FROM fiaon_contact_log cl JOIN fiaon_applications a ON a.ref = cl.ref
    WHERE a.person_id = ${k.personId} AND cl.agent_id IS NULL AND cl.agent_name = ${akteur}
      AND cl.outcome = ${HAUS_ERGEBNIS[ausgang]} AND cl.created_at > NOW() - make_interval(mins => ${DOPPELT_MINUTEN}::int)
    UNION ALL
    SELECT 1 FROM fiaon_lead_log ll JOIN fiaon_leads l ON l.id = ll.lead_id
    WHERE l.person_id = ${k.personId} AND ll.agent_id IS NULL AND ll.agent_name = ${akteur}
      AND ll.outcome = ${LEAD_ERGEBNIS[ausgang]} AND ll.created_at > NOW() - make_interval(mins => ${DOPPELT_MINUTEN}::int)
    LIMIT 1`.catch(() => [])) as any[];
  return !!schon;
}

/**
 * Das Ergebnis über den Hausweg buchen. Für Bestellungen die eine Kette
 * (ergebnisNachbereiten), für reine Leads dieselbe Zuordnung wie die Lead-Route.
 *   zahlt       → „zahlt am" morgen (siehe Kopf: keine Zusage für heute)
 *   interesse   → „erreicht — sonstiges" (Wiedervorlage in drei Tagen)
 *   nicht_erreicht → Zähler +1, Wiedervorlage morgen, Nicht-erreicht-Automatik
 * Den zweiten Klick fangen vorher Takt und schonGebucht ab (Nachbesserung E-259).
 */
async function ergebnisBuchen(k: KarteiKarte, ausgang: Ausgang, notiz: string, akteur: string): Promise<string> {
  const haus = HAUS_ERGEBNIS[ausgang];
  const lead = LEAD_ERGEBNIS[ausgang];
  if (k.ref) {
    const { ergebnisNachbereiten } = await import("./fiaon-kontakt-ergebnis");
    const r = await ergebnisNachbereiten({
      ref: k.ref, personId: k.personId, ergebnis: haus, notiz,
      zusageDatum: haus === "erreicht_zahlt_am" ? berlinPlusTage(1) : null,
      akteur: { id: null, name: akteur }, herkunft: "telefon",
    });
    return r.meldung;
  }
  if (k.leadId) {
    // Dieselbe Zuordnung wie POST /agent/leads/:id/contact-result (LEAD_OUTCOMES):
    // beides → „kontaktiert"; nicht erreicht ist in vier Stunden wieder dran.
    const { logLead } = await import("../routes/fiaon-leads");
    await logLead(k.leadId, { id: null, name: akteur }, "result", { outcome: lead, note: notiz });
    await sqlPool`
      UPDATE fiaon_leads SET status = 'kontaktiert', letzter_kontakt_am = NOW(), opened_at = NULL,
             requeue_at = ${lead === "nicht_erreicht" ? sqlPool`NOW() + INTERVAL '4 hours'` : sqlPool`NULL`},
             updated_at = NOW()
      WHERE id = ${k.leadId} AND status NOT IN ('konvertiert')`;
    return lead === "nicht_erreicht" ? "Nicht erreicht — festgehalten." : "Erreicht — festgehalten.";
  }
  return "Kein Verlauf möglich — weder Bestellung noch Lead.";
}

async function rueckrufeErledigen(personId: number): Promise<void> {
  await sqlPool`UPDATE fiaon_telefonkartei_rueckruf SET erledigt_am = NOW() WHERE person_id = ${personId} AND erledigt_am IS NULL AND am <= NOW() + INTERVAL '30 minutes'`.catch(() => {});
}

/** „Rechnung per Mail und WhatsApp über FIAON" — was wirklich rausging, für den Verlauf. */
function wegeText(mail: ErgebnisAntwort["mail"], wa: KarteiWaErgebnis | null, mailWort: string): string {
  const raus = [mail?.ok ? mailWort : null, wa?.ok ? "WhatsApp über FIAON" : null].filter(Boolean).join(" und ");
  const nicht = wa && !wa.ok ? ` WhatsApp nicht gesendet (${wa.text.replace(/^(Keine WhatsApp|WhatsApp nicht gesendet): /, "")}).` : "";
  return `${raus ? `${raus} geschickt.` : "Keine Nachricht rausgegangen."}${nicht}`;
}

/**
 * Ein Knopf der Karte. Seit E-259 (29.09.2026) schickt der SERVER auch die
 * WhatsApp — über das FIAON-Konto bei Meta (karteiWhatsApp, unten), nicht mehr
 * als wa.me-Link über Justins privates WhatsApp. Der Verlauf nennt nur, was
 * wirklich rausging.
 * Nachbesserung E-259: Jeder Fall nimmt zuerst seinen Takt (zehn Minuten,
 * atomar) und prüft, ob das Ergebnis schon gebucht ist — erst DANN gehen Mail
 * und WhatsApp raus. Ein zweiter Klick liefert `doppelt` und schickt nichts.
 */
export async function ergebnisFesthalten(personId: number, art: KarteiErgebnis, akteur: string, opts: { am?: string | null; notiz?: string | null } = {}): Promise<ErgebnisAntwort> {
  await karteiTabellen();
  const k = await karteEinzeln(personId);
  if (!k) return { ok: false, meldung: "Kunde nicht gefunden.", mail: null };
  if (k.lage === "storniert") return { ok: false, meldung: "Storniert — erst zurückholen.", mail: null };
  const { freitextVersenden } = await import("../routes/fiaon-mail");

  if (art === "rueckruf") {
    const am = opts.am ? new Date(opts.am) : null;
    if (!am || isNaN(am.getTime())) return { ok: false, meldung: "Bitte eine Uhrzeit wählen.", mail: null };
    if (am.getTime() < Date.now() - 5 * 60_000) return { ok: false, meldung: "Die Zeit liegt in der Vergangenheit.", mail: null };
    if (am.getTime() > Date.now() + 60 * 86_400_000) return { ok: false, meldung: "Höchstens 60 Tage im Voraus.", mail: null };
    const notiz = text(opts.notiz).slice(0, 300) || null;
    const [r] = (await sqlPool`
      INSERT INTO fiaon_telefonkartei_rueckruf (person_id, am, notiz, angelegt_durch)
      VALUES (${personId}, ${am}, ${notiz}, ${akteur}) RETURNING id, am`) as any[];
    const wann = am.toLocaleString("de-DE", { timeZone: "Europe/Berlin", weekday: "short", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
    // Ein Vermerk für den Betreuer — KEIN Haus-Ergebnis „Rückruf": das würde den
    // Kunden zur selben Minute in die Liste des Betreuers stellen (RUECKRUF_SQL),
    // und er bekäme zwei Anrufe.
    if (k.ref) {
      await sqlPool`
        INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
        VALUES (${k.ref}, ${personId}, NULL, ${akteur}, 'note',
                ${`${akteur} hat den Kunden erreicht — passt gerade nicht. ${akteur} ruft selbst zurück: ${wann} Uhr.${notiz ? ` ${notiz}` : ""}`}, NOW())`.catch(() => {});
    } else if (k.leadId) {
      const { logLead } = await import("../routes/fiaon-leads");
      await logLead(k.leadId, { id: null, name: akteur }, "note", { note: `${akteur} ruft selbst zurück: ${wann} Uhr.${notiz ? ` ${notiz}` : ""}` }).catch(() => {});
    }
    return {
      ok: true, meldung: `Rückruf ${wann} Uhr gespeichert.`, mail: null,
      rueckruf: { id: Number(r.id), personId, name: k.name, am: iso(r.am)!, notiz, telefonWaehlbar: k.telefonWaehlbar, telefonAnzeige: k.telefonAnzeige },
    };
  }

  const doppelt = (meldung = DOPPELT_MELDUNG): ErgebnisAntwort => ({ ok: true, doppelt: true, meldung, mail: null, wa: null });

  if (art === "rechnung") {
    const z = k.zahlung;
    if (!z || !hatRechnungsweg(k)) return { ok: false, meldung: "Keine offene Zahlung — hier gibt es keine Rechnung.", mail: null };
    if (!(await taktNehmen(personId, "rechnung", DOPPELT_MINUTEN))) return doppelt();
    if (await schonGetan(personId, "tk_rechnung", akteur, DOPPELT_MINUTEN)) return doppelt("Die Rechnung ist schon unterwegs (vor weniger als zehn Minuten). Es ging nichts ein zweites Mal raus.");
    if (await schonGebucht(k, "zahlt", akteur)) return doppelt("Schon festgehalten (vor weniger als zehn Minuten). Es ging nichts ein zweites Mal raus.");
    // Ein fertiger Antrag ohne Rechnung wird erst gebucht (Betrag, Frist, „Rechnung
    // offen") — ohne die Haus-Mail, denn gleich geht Justins Mail mit der Rechnung raus.
    if (z.art === "bestellung" && z.nochKeineRechnung && k.ref) {
      const { rechnungStellen } = await import("./fiaon-rechnung-stellen");
      const b = await rechnungStellen(k.ref, { akteur, agentId: null, nurBuchen: true, aufAnweisung: true });
      if (!b.ok) {
        await taktFreigeben(personId, "rechnung");
        return { ok: false, meldung: `Rechnung konnte nicht gestellt werden: ${b.grund}`, mail: null };
      }
    }
    let mail: ErgebnisAntwort["mail"] = null;
    const m = mailRechnung(k, akteur);
    if (m && k.email) {
      const v = await freitextVersenden({ personId, betreff: m.betreff, text: m.text, anhangReferenz: z.referenz, akteur, kennung: "tk_rechnung" });
      mail = v.ok ? { ok: true, text: `Mail mit Rechnung (PDF) an ${v.empfaenger ?? k.email}` } : { ok: false, text: `Mail nicht verschickt: ${v.error}` };
    } else {
      mail = { ok: false, text: "Keine E-Mail hinterlegt." };
    }
    // E-259: die Vorlage „Rechnung" bzw. „Monatsrate" über das FIAON-Konto — Knopf zur Zahlungsseite.
    const wa = await karteiWhatsApp(k, "rechnung", akteur);
    const meldung = await ergebnisBuchen(k, "zahlt",
      `${akteur} hat den Kunden erreicht — zahlt sofort (Zusage für morgen gesetzt). ${wegeText(mail, wa, "Rechnung per Mail")} (Telefonkartei)`,
      akteur);
    await rueckrufeErledigen(personId);
    const { personTierAktualisieren } = await import("./tier");
    await personTierAktualisieren(sqlPool, { personId }).catch((e) => console.error("[TELEFONKARTEI] Stufe:", e));
    return { ok: true, meldung, mail, wa };
  }

  if (art === "antrag") {
    if (!hatAntragsweg(k)) return { ok: false, meldung: "Hier gibt es schon eine Bestellung — nimm „Rechnung schicken\".", mail: null };
    if (!(await taktNehmen(personId, "antrag", DOPPELT_MINUTEN))) return doppelt();
    if (await schonGetan(personId, "tk_antrag", akteur, DOPPELT_MINUTEN)) return doppelt("Der Antrags-Link ist schon unterwegs. Es ging nichts ein zweites Mal raus.");
    if (await schonGebucht(k, "interesse", akteur)) return doppelt("Schon festgehalten (vor weniger als zehn Minuten). Es ging nichts ein zweites Mal raus.");
    let mail: ErgebnisAntwort["mail"] = null;
    if (k.email) {
      // Nachbesserung E-259: sein persönlicher Link (Lead: /a/<code>/m, Abbrecher: Wiedereinstieg) — nie ein nackter /antrag.
      const link = await antragLinkFuer(k, "mail", true);
      if (link.url) {
        const m = mailAntrag(k, akteur, link.url);
        const v = await freitextVersenden({ personId, betreff: m.betreff, text: m.text, akteur, kennung: "tk_antrag" });
        mail = v.ok ? { ok: true, text: `Mail mit seinem persönlichen Antrags-Link an ${v.empfaenger ?? k.email}` } : { ok: false, text: `Mail nicht verschickt: ${v.error}` };
      } else {
        mail = { ok: false, text: `Keine Mail: ${link.grund ?? "kein persönlicher Link"}` };
      }
    } else {
      mail = { ok: false, text: "Keine E-Mail hinterlegt." };
    }
    const wa = await karteiWhatsApp(k, "antrag", akteur);
    const meldung = await ergebnisBuchen(k, "interesse",
      `${akteur} hat den Kunden erreicht — Interesse. Antrags-Link: ${wegeText(mail, wa, "Mail")} (Telefonkartei)`,
      akteur);
    await rueckrufeErledigen(personId);
    return { ok: true, meldung, mail, wa };
  }

  // art === "nicht_erreicht"
  if (!(await taktNehmen(personId, "nicht_erreicht", DOPPELT_MINUTEN))) return doppelt();
  if (await schonGebucht(k, "nicht_erreicht", akteur)) return doppelt("Schon festgehalten (vor weniger als zehn Minuten). Es ging nichts ein zweites Mal raus.");
  let mail: ErgebnisAntwort["mail"] = null;
  const kurzZuvor = await schonGetan(personId, "tk_nicht_erreicht", akteur, NICHT_ERREICHT_MAIL_ABSTAND_TAGE * 24 * 60);
  if (kurzZuvor) {
    mail = { ok: false, text: `Keine zweite Mail — die letzte ist keine ${NICHT_ERREICHT_MAIL_ABSTAND_TAGE} Tage alt.` };
  } else if (!k.email) {
    mail = { ok: false, text: "Keine E-Mail hinterlegt." };
  } else if (k.werbungGesperrt) {
    mail = { ok: false, text: "Werbesperre — keine Mail." };
  } else {
    const m = mailNichtErreicht(k, akteur);
    const v = await freitextVersenden({ personId, betreff: m.betreff, text: m.text, akteur, kennung: "tk_nicht_erreicht" });
    mail = v.ok ? { ok: true, text: `Mail mit deinem Kalender an ${v.empfaenger ?? k.email}` } : { ok: false, text: `Mail nicht verschickt: ${v.error}` };
  }
  // E-259: Vorlage „Nicht erreicht" (B/C/Abbrecher, Tagesplatz) — im offenen Fenster freier Text mit deinem
  // Kalender; beides höchstens alle 3 Tage.
  const wa = await karteiWhatsApp(k, "nicht_erreicht", akteur);
  const meldung = await ergebnisBuchen(k, "nicht_erreicht",
    `${akteur} hat angerufen — nicht erreicht. ${wegeText(mail, wa, "Mail mit dem persönlichen Kalender")} (Telefonkartei)`,
    akteur);
  return { ok: true, meldung, mail, wa };
}

// ═══════════════════════════════════════════════════════════════════════════
// WHATSAPP ÜBER DAS FIAON-KONTO BEI META (29.09.2026, E-259)
//
// Justin: „Wenn ich WhatsApp-Nachricht auswähle (weil ich ihn nicht erreicht
// habe, oder Rechnung schicke oder was auch immer), dann muss das über unser
// WhatsApp-Meta-Konto laufen, nicht über das private."
//
// GEMESSEN (Produktion, nur lesend, 29.09.): Seit dem 21.09. öffnete jeder Fall
// einen wa.me-Link — 43× „Nicht erreicht", 4× „Rechnung". Nichts davon stand in
// fiaon_whatsapp: nicht im WhatsApp-Raum, Mara kannte es nicht, und die
// Zentrale schrieb am selben Tag trotzdem ihre Vorlage. Der Verlauf trug
// „Zahlungsdaten per WhatsApp geschickt" ein, bevor Justin überhaupt auf
// Senden getippt hatte.
//
// JETZT: kein zweiter Sendeweg, sondern der eine Hausweg waSenden — Sperre
// (Werbesperre, „Stopp", Vertriebssperre, Kündigung), Wand, 24-Stunden-
// Fenster, Bildfassung, Protokoll in fiaon_whatsapp (im Raum als „Mensch").
// Die Kartei legt nur fest, welcher Fall welche Vorlage nimmt
// (KARTEI_WA_VORLAGE, shared/fiaon-telefonkartei.ts) und hält eigene Regeln:
//   · Vorlage nur, wenn Meta sie freigegeben hat — sonst ehrlich der Grund.
//   · Doppelklick: dieselbe WhatsApp an denselben Menschen binnen 10 Minuten
//     nur einmal (dazu der Takt der Knöpfe, oben — atomar).
//   · „Nicht erreicht" höchstens alle 3 Tage (wie die Mail) — Vorlage UND
//     freier Text (Marke im Takt) — und die Vorlage nur mit dem Tagesplatz
//     (E-253): Hat der Mensch heute schon eine WhatsApp bekommen, bleibt es bei
//     der Mail. Ebenso die Rückfrage. Rechnung, Rate und Antrag hat er am
//     Telefon erbeten — sie nehmen keinen Platz, sperren aber durch ihre Zeile
//     in fiaon_whatsapp die Automatik für den Tag.
//   · Freier Text, den die Kartei selbst schreibt (Nicht erreicht, Antrag im
//     offenen Fenster), achtet dieselbe Sperre wie die Vorlage des Falls.
//   · Nachbesserung E-259: Auch die persönliche Nachricht (freier Text) achtet
//     den Menschen — bei „Stopp" nie; bei Werbesperre, Vertriebssperre oder
//     Kündigung nur nach ausdrücklicher Bestätigung (der Kunde hat uns ja
//     selbst geschrieben) und ohne Verkauf (der KI-Auftrag kennt die Sperre).
//   · Jeder Link ist sein persönlicher (antragLinkFuer) — nie ein nackter
//     fiaon.com/antrag (Hausregel E-248).
// Nach einer Vorlage bleibt Mara im Gespräch an (E-224: ein Anstupser, kein
// Gespräch); nach freiem Text führt ein Mensch, bis die Pause abläuft (E-230).
// ═══════════════════════════════════════════════════════════════════════════

/** Dieselbe WhatsApp an denselben Menschen binnen dieser Minuten zählt einmal (Doppelklick). */
const WA_DOPPELT_MINUTEN = 10;
/** „Nicht erreicht" auf WhatsApp höchstens alle drei Tage je Mensch — wie die Mail. */
const WA_NICHT_ERREICHT_ABSTAND_TAGE = 3;
/** Die Marke im Takt: „Nicht erreicht" ging als freier Text raus (fiaon_whatsapp kennt dafür keine Marke). */
const TAKT_NICHT_ERREICHT_TEXT = "wa_nicht_erreicht_text";

type WaFallServer = KarteiWaFall | "frei";

type WaWahl =
  | { weg: "vorlage"; vorlage: string; werte: string[]; knopfWert?: string; unaufgefordert: boolean; sperrVorlage: string; hinweis?: string | null }
  | { weg: "text"; text: string; sperrVorlage: string | null; hinweis?: string | null }
  | { weg: null; grund: string; kurz: string };

interface WaUmfeld {
  nummer: string | null;
  fenster: boolean;
  frei: Set<string>;
  /** Warum für diesen Menschen gar keine WhatsApp geht (nicht eingerichtet, keine Nummer, Festnetz). */
  aus: { grund: string; kurz: string } | null;
}

/** Freigegeben heißt: Textfassung oder Bildfassung ist bei Meta APPROVED (wie istFrei der Zentrale). */
function vorlageFrei(vorlage: string, frei: Set<string>): boolean {
  return frei.has(vorlage) || frei.has(bildName(vorlage));
}

/** Die Kopfzeile der Vorlage — „Ihre offene Rechnung" —, sonst ihr Name. */
function vorlageKlartext(vorlage: string): string {
  return WA_VORLAGEN.find((v) => v.name === vorlage)?.kopf ?? vorlage;
}

async function waUmfeld(k: KarteiKarte): Promise<WaUmfeld> {
  const wa = await import("./fiaon-whatsapp");
  const konfig = wa.waKonfig();
  if (!konfig.bereit) {
    return { nummer: null, fenster: false, frei: new Set(), aus: { grund: `WhatsApp ist auf diesem Server nicht eingerichtet (${konfig.fehlt.join(", ")}).`, kurz: "nicht eingerichtet" } };
  }
  // Dieselbe Prüfung wie Raum und Zähler: keine Nummer oder Festnetz → kein WhatsApp.
  const urteil = whatsappUrteil({ telefon: k.telefonWaehlbar });
  if (!urteil.moeglich || !urteil.nummer) {
    return { nummer: urteil.nummer, fenster: false, frei: new Set(), aus: { grund: `${urteil.grund}.`, kurz: urteil.art === "festnetz" ? "Festnetz" : "keine Nummer" } };
  }
  const [fenster, frei] = await Promise.all([
    wa.fensterOffen(urteil.nummer).catch(() => false),
    wa.freigegebeneVorlagen().catch(() => new Set<string>()),
  ]);
  return { nummer: urteil.nummer, fenster, frei, aus: null };
}

// ── Sein persönlicher Antrag-Link (Nachbesserung E-259) ─────────────────────

export interface AntragLink {
  /** Sein persönlicher Link für freien Text und Mail — null heißt: KEIN Link (nie ein nackter). */
  url: string | null;
  /** Der Knopfwert für fiaon_kk_antrag_offen („<code>/w") — nur, wenn der Code wirklich in seinen begonnenen Antrag führt. */
  knopfWert: string | null;
  /** Warum es keinen Link gibt. */
  grund: string | null;
  /** Warum der Knopf der Abbrecher-Vorlage nicht geht (dann keine Vorlage). */
  knopfGrund: string | null;
}

/**
 * Sein persönlicher Antrag-Link — dieselbe Regel wie Mara (persoenlicherLink,
 * shared/fiaon-mara-ton.ts, Hausregel E-248):
 *   · Lead (C)    sein Code: /a/<code>/w bzw. /m. Fehlt der Code, legt
 *                 kurzlinkFuerLead ihn an (nur mit `anlegen`, also beim Senden;
 *                 die Vorschau schreibt nichts). Ohne Lead: kein Link.
 *   · Abbrecher   der Wiedereinstieg in GENAU seinen begonnenen Antrag
 *                 (weiterLink). Der Knopf der Vorlage fiaon_kk_antrag_offen
 *                 kann nur /a/<code> — er bekommt den Code seines Leads, aber
 *                 nur, wenn dieser Code wirklich in denselben Antrag führt
 *                 (kurzlinkLesen: Anträge der letzten 60 Tage). Gemessen 29.09.:
 *                 107 von 156 Abbrechern; 44 ohne Lead, 5, deren Code in einen
 *                 neuen bzw. anderen Antrag führte. Vorher schickte waSenden
 *                 „start" — /a/start führte in einen NEUEN Antrag, obwohl die
 *                 Vorlage „genau an die Stelle, an der Sie aufgehört haben"
 *                 verspricht.
 */
export async function antragLinkFuer(k: KarteiKarte, kanal: MaraKanal, anlegen: boolean): Promise<AntragLink> {
  if (!hatAntragsweg(k)) return { url: null, knopfWert: null, grund: "Hier gibt es schon eine Bestellung.", knopfGrund: null };
  const kl = await import("./fiaon-kurzlink");
  if (k.lage === "abbrecher") {
    const [a] = (await sqlPool`
      SELECT ref, status, payment_status, current_step FROM fiaon_applications
       WHERE person_id = ${k.personId} AND merged_into IS NULL AND archived_at IS NULL AND gdpr_deleted_at IS NULL
         AND cancelled_at IS NULL
         -- E-264 (29.09.2026): begonnen heißt NIE abgeschickt (EINE Regel) — auch approved + pending_payment
         -- bei Schritt 5 (vorher nur started/config/personal_data mit „pending": 94 Menschen ohne Link).
         AND payment_status IN ('pending', 'pending_payment', 'expired') AND NOT ${sqlPool.unsafe(abgeschicktSql(""))}
       ORDER BY created_at DESC LIMIT 1`) as any[];
    if (!a) return { url: null, knopfWert: null, grund: "Kein begonnener Antrag gefunden — kein persönlicher Link.", knopfGrund: "kein begonnener Antrag" };
    const ref = String(a.ref);
    const { weiterLink } = await import("./fiaon-antrag-erinnerung");
    let code: string | null = null;
    let knopfGrund: string | null = null;
    if (!k.leadId) {
      knopfGrund = "kein Lead — der Knopf „Antrag fortsetzen“ braucht seinen persönlichen Code";
    } else {
      const ziel = anlegen
        ? (await kl.kurzlinkLesen((code = await kl.kurzlinkFuerLead(k.leadId))))?.antrag ?? null
        : await kl.antragDesLeads(k.leadId);
      if (!ziel || ziel.bezahlt || ziel.ref !== ref) {
        knopfGrund = ziel ? "sein persönlicher Code führt in einen anderen Antrag" : "sein persönlicher Code führt in einen neuen Antrag (begonnener Antrag älter als 60 Tage)";
      }
    }
    const wahl = persoenlicherLink({ stufe: stufeAusAntrag(a), weiterLink: weiterLink(ref), leadCode: code }, kanal);
    return {
      url: wahl.url, knopfWert: code && !knopfGrund ? `${code}/w` : null,
      grund: wahl.url ? null : "Kein persönlicher Link für seinen Antrag.", knopfGrund,
    };
  }
  // Lead (C)
  if (!k.leadId) return { url: null, knopfWert: null, grund: "Kein Lead — kein persönlicher Antrags-Link (nie ein nackter fiaon.com/antrag).", knopfGrund: null };
  if (!anlegen) return { url: null, knopfWert: null, grund: null, knopfGrund: null };
  const code = await kl.kurzlinkFuerLead(k.leadId);
  return { url: persoenlicherLink({ stufe: "lead", leadCode: code }, kanal).url, knopfWert: null, grund: null, knopfGrund: null };
}

// ── Die Sperre des Menschen für freien Text (Nachbesserung E-259) ──────────

export interface KarteiSperre {
  /** Geht gar nicht: „Stopp" — oder die Prüfung ist gestört. */
  hart: string | null;
  /** Geht nur nach ausdrücklicher Bestätigung und ohne Verkauf: Werbesperre, Vertriebssperre, gekündigt. */
  weich: string | null;
}

/**
 * Dieselbe Lesart wie die Tür für Vorlagen (waVorlagenSperre): menschSperre
 * (Kopf, Familie, „Stopp" aus WhatsApp und Postfach) und werbungVerboten.
 * Testkonten bleiben erreichbar — an ihnen prüft Justin.
 * Gemessen im Prüfstand: Wer eben „STOPP" geschrieben hatte, öffnete damit das
 * 24-Stunden-Fenster — und die persönliche Nachricht ging trotzdem raus.
 */
export async function karteiSperre(personId: number): Promise<KarteiSperre> {
  try {
    const { menschSperre, werbungVerboten } = await import("./fiaon-mail-frequenz");
    const s = await menschSperre(personId);
    if (!s) return { hart: null, weich: null };
    if (s.stopp) return { hart: "„Stopp“ — er will keine Nachrichten mehr. Auch kein freier Text.", weich: null };
    return { hart: null, weich: werbungVerboten({ ...s, test: false }) };
  } catch (e) {
    console.error("[TELEFONKARTEI] Sperrprüfung:", String((e as Error)?.message || e).slice(0, 160));
    return { hart: "Die Sperre dieses Menschen ließ sich gerade nicht prüfen — lieber keine Nachricht. Bitte gleich noch einmal.", weich: null };
  }
}

/**
 * Was ein Fall schicken würde. `anlegen` = beim Senden (legt den Code des Leads
 * an, wenn er fehlt); ohne `anlegen` nur lesend (Vorschau).
 */
async function waPlanen(k: KarteiKarte, fall: WaFallServer, akteur: string, u: WaUmfeld, opts: { text?: string | null; anlegen: boolean }): Promise<WaWahl> {
  if (u.aus) return { weg: null, ...u.aus };
  if (fall === "frei") {
    const t = ohneEmojis(String(opts.text ?? "")).trim();
    if (!u.fenster) {
      return { weg: null, kurz: "24-Stunden-Fenster zu", grund: "Das 24-Stunden-Fenster ist zu — freier Text geht über Meta erst, wenn der Kunde uns schreibt. Die Rückfrage-Vorlage öffnet das Gespräch neu." };
    }
    if (t.length < 3) return { weg: null, grund: "Kein Text.", kurz: "kein Text" };
    return { weg: "text", text: t, sperrVorlage: null };
  }
  // Im offenen Fenster schreibt Justin in eigenen Worten — mit SEINEM Kalender bzw. dem persönlichen Antrag-Link.
  // Die Rechnung bleibt immer die Vorlage: Bankdaten im freien Text hält die Wand auf.
  if (u.fenster && fall === "nicht_erreicht") {
    return { weg: "text", text: whatsappNichtErreicht(k, akteur), sperrVorlage: KARTEI_WA_VORLAGE.nicht_erreicht };
  }
  const antrag = fall === "antrag" && hatAntragsweg(k) ? await antragLinkFuer(k, "whatsapp", opts.anlegen) : null;
  if (u.fenster && antrag) {
    if (antrag.grund || (opts.anlegen && !antrag.url)) return { weg: null, grund: `${antrag.grund ?? "Kein persönlicher Link."} Ohne ihn keine WhatsApp.`, kurz: "kein persönlicher Link" };
    // In der Vorschau steht beim Lead noch kein Code fest (er entsteht erst beim Senden) — der Text wird dort nicht gesendet.
    return { weg: "text", text: whatsappAntrag(k, akteur, antrag.url ?? "[sein persönlicher Link]"), sperrVorlage: KARTEI_WA_VORLAGE.antrag_abbrecher };
  }
  const plan = karteiWaVorlage(k, fall, akteur);
  if (plan.art === "keine") return { weg: null, grund: plan.grund, kurz: plan.kurz };
  if (!vorlageFrei(plan.vorlage, u.frei)) {
    return { weg: null, kurz: "Vorlage nicht freigegeben", grund: `Die Vorlage „${plan.vorlage}“ ist bei Meta nicht freigegeben — es geht keine WhatsApp raus.` };
  }
  let knopfWert = plan.knopfWert;
  if (plan.vorlage === KARTEI_WA_VORLAGE.antrag_abbrecher) {
    // Der Knopf „Antrag fortsetzen" MUSS in seinen begonnenen Antrag führen — sonst keine Vorlage (siehe antragLinkFuer).
    if (!antrag || antrag.knopfGrund) {
      return { weg: null, kurz: "Knopf führt nicht in seinen Antrag", grund: `„${vorlageKlartext(plan.vorlage)}“ verspricht „genau an die Stelle, an der Sie aufgehört haben“ — ${antrag?.knopfGrund ?? "kein persönlicher Link"}. Die Mail trägt den Wiedereinstieg.` };
    }
    knopfWert = antrag.knopfWert ?? undefined;
  }
  return {
    weg: "vorlage", vorlage: plan.vorlage, werte: plan.werte, knopfWert, unaufgefordert: plan.unaufgefordert, sperrVorlage: plan.vorlage,
    hinweis: plan.vorlage === KARTEI_WA_VORLAGE.nicht_erreicht ? NICHT_ERREICHT_HINWEIS : null,
  };
}

/** Hat der Mensch heute schon eine WhatsApp (oder hat ein anderer Weg den Tagesplatz)? Nur lesend — für die Vorschau. */
async function heuteSchonWa(personId: number, nummer: string): Promise<boolean> {
  const [w] = (await sqlPool`
    SELECT 1 AS da FROM fiaon_whatsapp w
     WHERE w.richtung = 'raus' AND COALESCE(w.status, '') <> 'fehler'
       AND (w.created_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date
       AND (w.person_id = ${personId} OR w.nummer = ${nummer})
     LIMIT 1`.catch(() => [])) as any[];
  if (w) return true;
  const [t] = (await sqlPool`
    SELECT 1 AS da FROM fiaon_wa_tagesplatz
     WHERE schluessel = ANY(${[`p:${personId}`, `n:${nummer}`]}::text[]) AND tag = (NOW() AT TIME ZONE 'Europe/Berlin')::date
     LIMIT 1`.catch(() => [])) as any[];
  return !!t;
}

interface WaHindernis { grund: string; kurz: string; doppelt?: boolean; bestaetigen?: boolean }

/**
 * Was diesen einen Versand verhindert: Sperre, Doppelklick, drei-Tage-Abstand,
 * Tagesplatz (in der Vorschau nur lesend). null = darf raus. `bestaetigen` =
 * darf nur nach ausdrücklicher Bestätigung raus (freier Text trotz Sperre).
 */
async function waHindernis(k: KarteiKarte, fall: WaFallServer, wahl: Exclude<WaWahl, { weg: null }>, u: WaUmfeld, opts: { vorschau: boolean; bestaetigt?: boolean }): Promise<WaHindernis | null> {
  const wa = await import("./fiaon-whatsapp");
  const nummer = u.nummer!;
  // E-261 (29.09.2026): die WhatsApp-Bremse zuerst — in der Pause keine Vorlage (bei Kontosperre auch kein Text),
  // bei Meta-Qualität ROT keine Werbe-Vorlage. So zeigt schon die Knopfzeile, warum es gerade nicht geht.
  const { waBremse } = await import("./fiaon-wa-bremse");
  const bremse = await waBremse({ vorlage: wahl.weg === "vorlage" ? wahl.vorlage : null, text: wahl.weg === "text", weg: "telefonkartei" });
  if (!bremse.erlaubt) return { grund: bremse.grund ?? "WhatsApp pausiert", kurz: bremse.pause ? "WhatsApp pausiert" : "Meta-Qualität ROT" };
  if (wahl.sperrVorlage) {
    const sperre = await wa.waVorlagenSperre(wahl.sperrVorlage, nummer, { personId: k.personId, leadId: k.leadId });
    if (sperre) return { grund: sperre, kurz: sperre.split(":")[0] };
  }
  if (fall === "frei") {
    const sp = await karteiSperre(k.personId);
    if (sp.hart) return { grund: sp.hart, kurz: /Stopp/.test(sp.hart) ? "Stopp" : "Sperre nicht prüfbar" };
    if (sp.weich && !opts.bestaetigt) {
      return {
        bestaetigen: true, kurz: sp.weich,
        grund: `${sp.weich}: Freier Text nur, wenn du es ausdrücklich bestätigst — und ohne Verkauf. Der Kunde hat uns selbst geschrieben; antworte nur darauf.`,
      };
    }
  }
  const vorlagen = wahl.weg === "vorlage" ? [wahl.vorlage, bildName(wahl.vorlage)] : [];
  const [doppelt] = (await sqlPool`
    SELECT 1 AS da FROM fiaon_whatsapp
     WHERE person_id = ${k.personId} AND richtung = 'raus' AND COALESCE(status, '') <> 'fehler'
       AND created_at > NOW() - make_interval(mins => ${WA_DOPPELT_MINUTEN}::int)
       AND ${wahl.weg === "vorlage" ? sqlPool`vorlage = ANY(${vorlagen}::text[])` : sqlPool`vorlage IS NULL AND text = ${wahl.text}`}
     LIMIT 1`.catch(() => [])) as any[];
  if (doppelt) return { doppelt: true, grund: "Diese WhatsApp ist vor weniger als zehn Minuten schon über FIAON rausgegangen.", kurz: "eben schon gesendet" };
  if (fall === "nicht_erreicht") {
    // Nachbesserung E-259: für Vorlage UND freien Text — vorher galt der Abstand nur für die Vorlage.
    const ne = [KARTEI_WA_VORLAGE.nicht_erreicht, bildName(KARTEI_WA_VORLAGE.nicht_erreicht)];
    const [kurz] = (await sqlPool`
      SELECT 1 AS da FROM fiaon_whatsapp
       WHERE person_id = ${k.personId} AND richtung = 'raus' AND COALESCE(status, '') <> 'fehler'
         AND vorlage = ANY(${ne}::text[])
         AND created_at > NOW() - make_interval(days => ${WA_NICHT_ERREICHT_ABSTAND_TAGE}::int)
      UNION ALL
      SELECT 1 FROM fiaon_telefonkartei_takt
       WHERE person_id = ${k.personId} AND art = ${TAKT_NICHT_ERREICHT_TEXT}
         AND am > NOW() - make_interval(days => ${WA_NICHT_ERREICHT_ABSTAND_TAGE}::int)
       LIMIT 1`.catch(() => [])) as any[];
    if (kurz) return { grund: `Die letzte „Nicht erreicht“-WhatsApp ist keine ${WA_NICHT_ERREICHT_ABSTAND_TAGE} Tage alt — keine zweite.`, kurz: `letzte vor < ${WA_NICHT_ERREICHT_ABSTAND_TAGE} Tagen` };
  }
  if (opts.vorschau && wahl.weg === "vorlage" && wahl.unaufgefordert && await heuteSchonWa(k.personId, nummer)) {
    return { grund: wa.TAGESPLATZ_BELEGT, kurz: "heute schon eine WhatsApp" };
  }
  return null;
}

/** Das Gespräch im WhatsApp-Raum: Nach einer Vorlage bleibt Mara an, nach freiem Text führt ein Mensch. */
async function gespraechMerken(nummer: string, k: KarteiKarte, weg: "vorlage" | "text"): Promise<void> {
  if (weg === "vorlage") {
    await sqlPool`
      INSERT INTO fiaon_whatsapp_gespraech (nummer, person_id, lead_id, mara_an, updated_at)
      VALUES (${nummer}, ${k.personId}, ${k.leadId}, TRUE, NOW())
      ON CONFLICT (nummer) DO UPDATE SET person_id = COALESCE(EXCLUDED.person_id, fiaon_whatsapp_gespraech.person_id),
        lead_id = COALESCE(EXCLUDED.lead_id, fiaon_whatsapp_gespraech.lead_id), updated_at = NOW()`
      .catch((e) => console.error("[TELEFONKARTEI] WhatsApp-Gespräch:", String(e?.message || e).slice(0, 160)));
    return;
  }
  // Wie im Raum (/senden, E-224/E-230): Von Hand abgeschaltet bleibt abgeschaltet; sonst eine Pause, die von selbst endet.
  await sqlPool`
    INSERT INTO fiaon_whatsapp_gespraech (nummer, person_id, lead_id, mara_an, mara_aus_grund, mara_aus_am, updated_at)
    VALUES (${nummer}, ${k.personId}, ${k.leadId}, FALSE, 'mensch', NOW(), NOW())
    ON CONFLICT (nummer) DO UPDATE SET mara_an = FALSE,
      mara_aus_grund = CASE WHEN fiaon_whatsapp_gespraech.mara_an = FALSE AND fiaon_whatsapp_gespraech.mara_aus_grund = 'schalter' THEN 'schalter' ELSE 'mensch' END,
      mara_aus_am = CASE WHEN fiaon_whatsapp_gespraech.mara_an = FALSE AND fiaon_whatsapp_gespraech.mara_aus_grund = 'schalter' THEN fiaon_whatsapp_gespraech.mara_aus_am ELSE NOW() END,
      person_id = COALESCE(EXCLUDED.person_id, fiaon_whatsapp_gespraech.person_id),
      lead_id = COALESCE(EXCLUDED.lead_id, fiaon_whatsapp_gespraech.lead_id), updated_at = NOW()`
    .catch((e) => console.error("[TELEFONKARTEI] WhatsApp-Gespräch:", String(e?.message || e).slice(0, 160)));
}

/**
 * Eine WhatsApp der Kartei — über das FIAON-Konto bei Meta. `fall` = einer der
 * Fälle oder „frei" (persönliche Nachricht, nur im offenen Fenster).
 * Schreibt keinen Verlauf: Das tut der Aufrufer (ergebnisBuchen bzw.
 * karteiNachricht), damit dort steht, was wirklich rausging.
 */
export async function karteiWhatsApp(k: KarteiKarte, fall: WaFallServer, akteur: string, opts: { text?: string | null; bestaetigt?: boolean } = {}): Promise<KarteiWaErgebnis> {
  const u = await waUmfeld(k);
  const wahl = await waPlanen(k, fall, akteur, u, { text: opts.text, anlegen: true });
  if (!wahl.weg) return { ok: false, weg: null, vorlage: null, text: `Keine WhatsApp: ${wahl.grund}` };
  const vorlage = wahl.weg === "vorlage" ? wahl.vorlage : null;
  const hindernis = await waHindernis(k, fall, wahl, u, { vorschau: false, bestaetigt: opts.bestaetigt });
  if (hindernis?.doppelt) return { ok: true, doppelt: true, weg: wahl.weg, vorlage, text: hindernis.grund };
  if (hindernis) return { ok: false, weg: null, vorlage, text: `Keine WhatsApp: ${hindernis.grund}`, ...(hindernis.bestaetigen ? { bestaetigen: true } : {}) };
  const wa = await import("./fiaon-whatsapp");
  if (wahl.weg === "vorlage" && wahl.unaufgefordert) {
    // Unaufgefordert: erst den Tagesplatz nehmen (E-253) — genau ein Weg bekommt ihn.
    const platz = await wa.waTagesplatz({ personId: k.personId, nummer: u.nummer, weg: "telefonkartei", vorlage: wahl.vorlage });
    if (!platz.ok) return { ok: false, weg: null, vorlage, text: `Keine WhatsApp: ${platz.grund}` };
  }
  const erg = await wa.waSenden(
    u.nummer!,
    wahl.weg === "vorlage" ? { vorlage: wahl.vorlage, werte: wahl.werte, knopfWert: wahl.knopfWert } : { text: wahl.text },
    { personId: k.personId, leadId: k.leadId, von: akteur },
  );
  if (!erg.ok) return { ok: false, weg: null, vorlage, text: `WhatsApp nicht gesendet: ${erg.grund ?? "unbekannter Fehler"}` };
  await gespraechMerken(u.nummer!, k, wahl.weg);
  if (fall === "nicht_erreicht" && wahl.weg === "text") await taktMarke(k.personId, TAKT_NICHT_ERREICHT_TEXT);
  console.log(`[TELEFONKARTEI] ${akteur}: WhatsApp an Person ${k.personId} über FIAON (${vorlage ?? "freier Text"}).`);
  return {
    ok: true, weg: wahl.weg, vorlage,
    text: wahl.weg === "vorlage"
      ? `WhatsApp über FIAON gesendet — Vorlage „${vorlageKlartext(wahl.vorlage)}“${wahl.hinweis ? ` (${wahl.hinweis})` : ""}`
      // Neutral (Nachbesserung E-259): Vorher stand „er hat uns …" — auch bei Kundinnen.
      : "WhatsApp über FIAON gesendet — freier Text (in den letzten 24 Stunden kam eine Nachricht von dieser Nummer)",
  };
}

/** Was ein Fall gerade täte — für die Knopfzeilen im Blatt „Nachrichten". Nur lesend. */
async function waFallLage(k: KarteiKarte, fall: WaFallServer, akteur: string, u: WaUmfeld): Promise<KarteiWaFallLage> {
  const wahl = await waPlanen(k, fall, akteur, u, { text: fall === "frei" ? "Vorschau" : null, anlegen: false });
  if (!wahl.weg) return { weg: null, vorlage: null, klartext: null, grund: wahl.grund, kurz: wahl.kurz };
  const vorlage = wahl.weg === "vorlage" ? wahl.vorlage : null;
  const klartext = vorlage ? vorlageKlartext(vorlage) : "freier Text";
  const hindernis = await waHindernis(k, fall, wahl, u, { vorschau: true });
  if (hindernis?.bestaetigen) return { weg: wahl.weg, vorlage, klartext, grund: hindernis.grund, kurz: hindernis.kurz, bestaetigen: true };
  if (hindernis) return { weg: null, vorlage, klartext, grund: hindernis.grund, kurz: hindernis.kurz };
  return { weg: wahl.weg, vorlage, klartext, grund: null, kurz: null, hinweis: wahl.hinweis ?? null };
}

/** GET …/whatsapp-lage — was jeder Fall auf WhatsApp täte, bevor Justin tippt. */
export async function karteiWaLage(personId: number, akteur: string): Promise<KarteiWaLage | null> {
  const k = await karteEinzeln(personId);
  if (!k) return null;
  const u = await waUmfeld(k);
  const faelle: KarteiWaLage["faelle"] = {};
  const liste: KarteiWaFall[] = [
    ...(hatRechnungsweg(k) ? ["rechnung" as const] : []),
    ...(hatAntragsweg(k) ? ["antrag" as const] : []),
    "nicht_erreicht", "rueckfrage",
  ];
  for (const f of liste) faelle[f] = await waFallLage(k, f, akteur, u);
  return { ok: true, nummer: u.nummer, fensterOffen: u.fenster, faelle, frei: await waFallLage(k, "frei", akteur, u) };
}

/** Ein Vermerk im Verlauf — mit Justins Namen, ohne Mitarbeiter-ID (er wird nie Betreuer). */
async function waVermerk(k: KarteiKarte, akteur: string, notiz: string): Promise<void> {
  if (k.ref) {
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
      VALUES (${k.ref}, ${k.personId}, NULL, ${akteur}, 'system', ${notiz.slice(0, 2_000)})`.catch((e) => console.error("[TELEFONKARTEI] Vermerk:", e));
  } else if (k.leadId) {
    const { logLead } = await import("../routes/fiaon-leads");
    await logLead(k.leadId, { id: null, name: akteur }, "note", { note: notiz.slice(0, 2_000) }).catch((e: unknown) => console.error("[TELEFONKARTEI] Vermerk:", e));
  }
}

/**
 * Die persönliche Nachricht (E-205) über das FIAON-Konto: `frei` = der Text als
 * freie Nachricht (nur im offenen Fenster), `rueckfrage` = die Vorlage
 * fiaon_kk_rueckfrage, die das Gespräch neu öffnet. Vorher wurde nur vermerkt,
 * dass Justin WhatsApp „geöffnet" hatte (nachrichtVermerken, entfallen).
 * Nachbesserung E-259: `bestaetigt` = Justin hat die Sperre gesehen und will
 * trotzdem antworten (nicht bei „Stopp"); derselbe Text binnen zehn Minuten
 * geht einmal raus, auch bei zwei gleichzeitigen Klicks (Takt).
 */
export async function karteiNachricht(personId: number, art: "frei" | "rueckfrage", akteur: string, text?: string | null, opts: { bestaetigt?: boolean } = {}): Promise<{ ok: boolean; meldung: string; wa: KarteiWaErgebnis | null; fensterZu?: boolean; bestaetigen?: boolean; doppelt?: boolean }> {
  await karteiTabellen();
  const k = await karteEinzeln(personId);
  if (!k) return { ok: false, meldung: "Kunde nicht gefunden.", wa: null };
  if (k.lage === "storniert") return { ok: false, meldung: "Storniert — erst zurückholen.", wa: null };
  const sauber = ohneEmojis(String(text ?? "")).trim();
  const takt = art === "frei" ? `frei:${textSchluessel(sauber)}` : "rueckfrage";
  if (!(await taktNehmen(personId, takt, WA_DOPPELT_MINUTEN))) {
    return { ok: true, doppelt: true, meldung: "Diese Nachricht ist vor weniger als zehn Minuten schon über FIAON rausgegangen — nichts ein zweites Mal.", wa: null };
  }
  const wa = await karteiWhatsApp(k, art, akteur, { text, bestaetigt: opts.bestaetigt === true });
  if (!wa.ok) await taktFreigeben(personId, takt);
  if (wa.ok && !wa.doppelt) {
    await waVermerk(k, akteur, art === "frei"
      ? `WhatsApp von ${akteur} über FIAON (persönliche Nachricht, Telefonkartei${opts.bestaetigt ? ", trotz Sperre ausdrücklich bestätigt" : ""}):\n${sauber.slice(0, 1_800)}`
      : `WhatsApp von ${akteur} über FIAON: Rückfrage-Vorlage („${vorlageKlartext(KARTEI_WA_VORLAGE.rueckfrage)}“) — öffnet das Gespräch neu (Telefonkartei).`);
  }
  const fensterZu = art === "frei" && !wa.ok && /24-Stunden-Fenster ist zu/.test(wa.text);
  return { ok: wa.ok, meldung: wa.text, wa, ...(fensterZu ? { fensterZu } : {}), ...(wa.bestaetigen ? { bestaetigen: true } : {}), ...(wa.doppelt ? { doppelt: true } : {}) };
}

// ═══════════════════════════════════════════════════════════════════════════
// E-MAIL AUS DER AKTE (02.10.2026, E-274)
//
// Justin: „bei fiaon.com/chef/s/telefonkartei in der Akte — ich brauch da ein
// Knopf wo ich den Kunden eine Email senden kann — wie jetzt, ich hatte eben
// mit [einem Kunden] telefoniert, der will einbezahlen und braucht aber die
// Mail neu — nur da gibts kein Knopf oder so." Er nahm „Rechnung schicken" —
// das bucht „zahlt am" für morgen und schickt die WhatsApp mit. Für „bitte die
// Mail noch einmal" ist das zu viel.
//
// JETZT: eine freie Mail über GENAU die Kette der Verwaltung (freitextVersenden:
// Wortwand, Rechnungs-PDF, Brevo, Protokoll fiaon_mail_log, Verlauf der Akte).
// Dieselben Wände wie die Admin-Route /admin/mail/:personId/frei — dort prüft
// niemand eine Werbesperre, und eine Mail, die Justin selbst schreibt, ist keine
// Werbung. Kein Gesprächsergebnis, keine WhatsApp, kein Zusagedatum.
//   · Anhang nur mit SEINER Referenz: der offenen Zahlung der Karte (dieselbe
//     Regel wie „Rechnung schicken", hatRechnungsweg). rechnungAlsPdf nähme jede
//     Referenz des Hauses — der Server glaubt dem Browser keine.
//   · Ein fertiger Antrag ohne Rechnung wird vor dem Senden gestellt (nurBuchen,
//     wie bei „Rechnung schicken") — sonst trüge das PDF den alten Bestellbetrag.
//     Vorher läuft die Wand: Hält sie den Text auf, wird auch nichts gestellt.
//   · Doppelklick: derselbe Text binnen 30 Sekunden geht einmal raus (Takt je
//     Mensch und Text, atomar); ein anderer Text geht sofort.
//   · Zustellung: Das Blatt zeigt die letzten Mails dieses Menschen mit dem Stand
//     aus fiaon_mail_log (Abgleich mit Brevo alle 20 Minuten, fiaon-zustellung.ts —
//     zugeordnet nach Adresse und Uhrzeit, nicht nach der Nachrichten-Kennung).
//     „gesendet" heißt nur: Brevo hat angenommen.
// ═══════════════════════════════════════════════════════════════════════════

const MAIL_TON: Record<string, KarteiMailZeile["ton"]> = {
  zugestellt: "gut", geoeffnet: "gut", geklickt: "gut", angenommen: "neutral",
  gebounct: "warn", blockiert: "warn", spam: "warn", fehler: "warn",
};

/** Die Nutzlast einer Protokollzeile — mailProtokoll legt sie als JSON-TEXT ab (siehe NUTZLAST_SQL), manche doppelt. */
function nutzlastAus(v: unknown): Record<string, any> {
  let x: unknown = v;
  for (let i = 0; i < 2 && typeof x === "string"; i++) x = ausJson<unknown>(x, null);
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Record<string, any>) : {};
}

/** Die letzten Mails dieses Menschen, neueste zuerst — „Zuletzt gesendet" im Blatt „E-Mail". */
export async function karteiMailVerlauf(personId: number, grenze = 6): Promise<KarteiMailZeile[]> {
  const [{ ZUSTELL_TEXT }, { VERSAND_TEXT }] = await Promise.all([import("./fiaon-zustellung"), import("./fiaon-versand")]);
  const zeilen = (await sqlPool`
    SELECT id, created_at, event, status, grund, ausgeloest_von, zustellung, zustellung_grund, betreff, payload
    FROM fiaon_mail_log
    WHERE person_id = ${personId} AND COALESCE(art, 'echt') = 'echt'
    ORDER BY id DESC LIMIT ${Math.max(1, Math.min(20, grenze))}`) as any[];
  return zeilen.map((r) => {
    const nutz = nutzlastAus(r.payload);
    const status = text(r.status);
    const zust = text(r.zustellung);
    let stand = "gesendet";
    let ton: KarteiMailZeile["ton"] = "neutral";
    let grund: string | null = null;
    if (status === "fehlgeschlagen") { stand = "nicht gesendet"; ton = "warn"; grund = text(r.grund) || null; }
    else if (status === "uebersprungen") { stand = "übersprungen"; grund = text(r.grund) || null; }
    else if (status === "ausstehend") stand = "wartet";
    else if (zust && zust !== "angenommen") {
      stand = (ZUSTELL_TEXT as Record<string, string>)[zust] ?? zust;
      ton = MAIL_TON[zust] ?? "neutral";
      grund = ton === "warn" ? text(r.zustellung_grund) || null : null;
    }
    const event = text(r.event);
    return {
      id: Number(r.id),
      am: iso(r.created_at) ?? new Date().toISOString(),
      betreff: text(r.betreff) || text(nutz.betreff) || (VERSAND_TEXT as Record<string, { titel: string }>)[event]?.titel || event.replace(/_/g, " "),
      stand, ton, grund,
      von: text(r.ausgeloest_von) || "System",
      mitAnhang: !!nutz.anhang && typeof nutz.anhang === "object",
      ausKartei: /^tk_/.test(text(nutz.kennung)),
    };
  });
}

/** Was das Blatt „E-Mail" beim Öffnen braucht: Adresse und Anrede wie beim Versand, die offene Zahlung, die letzten Mails. */
export async function karteiMailLage(personId: number, akteur: string): Promise<KarteiMailLage | null> {
  const k = await karteEinzeln(personId);
  if (!k) return null;
  const { freitextZiel } = await import("../routes/fiaon-mail");
  const [ziel, verlauf] = await Promise.all([freitextZiel(personId), karteiMailVerlauf(personId)]);
  return {
    ok: true,
    empfaenger: ziel?.email || null,
    anrede: ziel?.anrede ?? "Guten Tag,",
    absender: akteur,
    zahlung: hatRechnungsweg(k) ? k.zahlung : null,
    verlauf,
  };
}

/**
 * Vorschau (`nurVorschau`) oder Versand der freien Mail. `status` ist der HTTP-Stand für die
 * Route: 400 = Eingabe (leer, zu lang, fremde Referenz), 404 = unbekannt, 409 = nicht
 * gesendet (Wand, keine Adresse, Brevo), 200 = gesendet bzw. Doppelklick.
 */
export async function karteiMail(
  personId: number,
  ein: { betreff?: unknown; text?: unknown; anhangReferenz?: unknown; nurVorschau?: boolean },
  akteur: string,
): Promise<KarteiMailAntwort & { status: number }> {
  await karteiTabellen();
  const betreff = text(ein.betreff);
  const inhalt = text(ein.text);
  if (!betreff || !inhalt) return { status: 400, ok: false, meldung: "Betreff und Text dürfen nicht leer sein." };
  if (betreff.length > KARTEI_MAIL_BETREFF_MAX || inhalt.length > KARTEI_MAIL_TEXT_MAX) {
    return { status: 400, ok: false, meldung: `Zu lang — Betreff höchstens ${KARTEI_MAIL_BETREFF_MAX} Zeichen, Text höchstens ${KARTEI_MAIL_TEXT_MAX.toLocaleString("de-DE")}.` };
  }
  const k = await karteEinzeln(personId);
  if (!k) return { status: 404, ok: false, meldung: "Kunde nicht gefunden." };

  // Die Rechnung hängt nur an, wenn die Referenz die offene Zahlung GENAU dieses Menschen ist.
  const gewuenscht = text(ein.anhangReferenz).toUpperCase();
  const offen = hatRechnungsweg(k) ? k.zahlung : null;
  if (gewuenscht && (!offen || offen.referenz.trim().toUpperCase() !== gewuenscht)) {
    return {
      status: 400, ok: false,
      meldung: offen
        ? `${gewuenscht} ist nicht die offene Zahlung von ${k.name} (${offen.referenz}) — angehängt wird nur seine eigene Rechnung.`
        : `${k.name} hat keine offene Zahlung — es gibt keine Rechnung zum Anhängen.`,
    };
  }
  const anhang = gewuenscht && offen ? offen : null;
  // Ein fertiger Antrag ohne Rechnung: Die Rechnung entsteht erst beim Senden (siehe Kopf).
  const stellen = !!anhang && anhang.art === "bestellung" && anhang.nochKeineRechnung && !!k.ref;
  const angekuendigt = stellen && anhang
    ? { art: "bestellung", betrag: anhang.betragCents != null ? (anhang.betragCents / 100).toFixed(2) : "" }
    : null;
  const { freitextVersenden, freitextZiel } = await import("../routes/fiaon-mail");

  if (ein.nurVorschau) {
    const v = await freitextVersenden({
      personId, betreff, text: inhalt, nurVorschau: true, akteur, kennung: "tk_frei",
      ...(anhang && !stellen ? { anhangReferenz: anhang.referenz } : {}),
      ...(angekuendigt ? { anhangAngekuendigt: angekuendigt } : {}),
    });
    if (!v.ok) return { status: 409, ok: false, meldung: String(v.error || "Die Vorschau ging nicht.") };
    return {
      status: 200, ok: true, meldung: "Vorschau", empfaenger: v.empfaenger ?? null, anhang: v.anhang ?? null,
      ...(v.anhangBeimSenden ? { anhangBeimSenden: true } : {}),
      vorschau: { betreff: String(v.betreff), html: String(v.html), absender: v.absender ? `${v.absender.name} <${v.absender.email}>` : null },
    };
  }

  // Doppelklick: derselbe Text (mit derselben Rechnung) binnen 30 Sekunden zählt einmal — auch auf zwei Geräten.
  const takt = `mail:${textSchluessel(`${betreff}\n${inhalt}\n${anhang?.referenz ?? ""}`)}`;
  if (!(await taktNehmen(personId, takt, KARTEI_MAIL_DOPPELT_SEKUNDEN / 60))) {
    return {
      status: 200, ok: true, doppelt: true,
      meldung: `Diese Mail ist vor weniger als ${KARTEI_MAIL_DOPPELT_SEKUNDEN} Sekunden schon rausgegangen — nichts ein zweites Mal.`,
      verlauf: await karteiMailVerlauf(personId).catch(() => []),
    };
  }
  try {
    if (stellen && angekuendigt && k.ref) {
      // Erst die Wand (ohne Wirkung), dann die Rechnung stellen — nie eine gestellte Rechnung ohne Mail wegen der Wand.
      const probe = await freitextVersenden({ personId, betreff, text: inhalt, nurVorschau: true, akteur, anhangAngekuendigt: angekuendigt });
      if (!probe.ok) {
        await taktFreigeben(personId, takt);
        return { status: 409, ok: false, meldung: String(probe.error || "Nicht gesendet.") };
      }
      const { rechnungStellen } = await import("./fiaon-rechnung-stellen");
      const b = await rechnungStellen(k.ref, { akteur, agentId: null, nurBuchen: true, aufAnweisung: true });
      if (!b.ok) {
        await taktFreigeben(personId, takt);
        return { status: 409, ok: false, meldung: `Rechnung konnte nicht gestellt werden: ${b.grund}` };
      }
    }
    const v = await freitextVersenden({
      personId, betreff, text: inhalt, akteur, kennung: "tk_frei",
      ...(anhang ? { anhangReferenz: anhang.referenz } : {}),
    });
    if (!v.ok) {
      await taktFreigeben(personId, takt);
      return { status: 409, ok: false, meldung: String(v.error || "Die Mail ging nicht raus."), verlauf: await karteiMailVerlauf(personId).catch(() => []) };
    }
    // Den Verlauf schreibt freitextVersenden an die jüngste NICHT archivierte Bestellung (freitextZiel.ref).
    // Gegenprüfung E-274 (02.10.2026): Gibt es die nicht — ein reiner Lead, oder alle Bestellungen sind
    // archiviert (gemessen: 22 Menschen mit Adresse, darunter der Global-Kunde aus E-272) —, schrieb
    // niemand einen Eintrag, und das Blatt sagte trotzdem „Steht im Verlauf der Akte“. Dann hier: an die
    // Bestellung der Karte (die Akte liest das Kontaktprotokoll der ganzen Familie, auch archivierter),
    // sonst an den Lead.
    const ziel = await freitextZiel(personId).catch(() => undefined);
    if (ziel !== undefined && !ziel?.ref) {
      const notiz = `E-Mail „${betreff}“ an ${v.empfaenger ?? k.email} verschickt${v.anhang ? ` — mit Rechnung ${v.anhang.rechnungsnummer} über ${v.anhang.betrag} € im Anhang` : ""} (Telefonkartei).`;
      if (k.ref) {
        await sqlPool`
          INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note, created_at)
          VALUES (${k.ref}, ${personId}, NULL, ${akteur}, 'system', ${notiz}, NOW())`
          .catch((e: unknown) => console.error("[TELEFONKARTEI] Mail-Vermerk:", e));
      } else if (k.leadId) {
        const { logLead } = await import("../routes/fiaon-leads");
        await logLead(k.leadId, { id: null, name: akteur }, "note", { note: notiz })
          .catch((e: unknown) => console.error("[TELEFONKARTEI] Mail-Vermerk:", e));
      }
    }
    return {
      status: 200, ok: true, meldung: `Gesendet an ${v.empfaenger ?? k.email}`, empfaenger: v.empfaenger ?? null,
      anhang: v.anhang ?? null, verlauf: await karteiMailVerlauf(personId).catch(() => []),
    };
  } catch (e) {
    await taktFreigeben(personId, takt);
    throw e;
  }
}

// ── Stornieren und Zurückholen ──────────────────────────────────────────────

interface StornoStand {
  bestellungen: {
    ref: string; weg: string; ok: boolean;
    vorher: { payment_status: string | null; cancelled_at: string | null; mahnstopp_am: string | null };
    kulanzRaten?: number[];
  }[];
  leads: {
    id: number;
    vorher: { dismissed_at: string | null; dismissed_reason: string | null; dismissed_by: number | null; strecke_stopp: string | null; strecke_stopp_am: string | null; in_sequence: boolean | null };
  }[];
  /** werbesperre_quelle: seit 08.10.2026 (Zahlungspost-Freigabe) — fehlt in älteren Storno-Zeilen. */
  person: { is_blocked: boolean; werbung_gesperrt_am: string | null; gesperrt: boolean; werbesperre_quelle?: string | null };
  termine: number[];
  mails: string[];
}

export interface StornoAntwort {
  ok: boolean;
  meldung: string;
  punkte: string[];
  bereits?: boolean;
}

/**
 * Stornieren — mit Justins Worten: „storniert werden, auf eine eigene Liste
 * kommen und nirgendwo mehr erscheinen." Jede Wirkung über den Hausweg:
 *   · unbezahlte Bestellung → kuendigungSetzen (Weg 1: storniert, keine
 *     Forderung, Mahnstopp) — die Mitarbeiter sehen „Storniert"
 *   · bezahlter Vertrag → kuendigungSetzen nach Hausregel (die laufende Rate
 *     bleibt fällig; „Kulanz" beendet sofort) + Bestätigungsmail
 *   · Lead → aussortiert (Grund „sonstiges"), Lead-Strecke gestoppt
 *   · Person → Vertriebssperre (nicht bei zahlenden Kunden, Regel 06.09.),
 *     Werbesperre (nicht bei Global-Kunden, E-272), keine Wiedervorlage;
 *     gebuchte Termine abgesagt (nie die zu FIAON Global und beim Global-Kunden
 *     nie der Gründer-Termin, E-272)
 * Der Vorher-Stand steht in der Storno-Zeile — „Zurückholen" nimmt genau das
 * zurück.
 */
export async function stornieren(personId: number, opts: { grund: string; kulanz: boolean; akteur: string; akteurId: number | null }): Promise<StornoAntwort> {
  await karteiTabellen();
  const [p] = (await sqlPool`
    SELECT id, is_blocked, werbung_gesperrt_am, werbesperre_quelle FROM fiaon_persons
    WHERE id = ${personId} AND merged_into_person_id IS NULL`) as any[];
  if (!p) return { ok: false, meldung: "Kunde nicht gefunden.", punkte: [] };
  const [schon] = (await sqlPool`SELECT 1 AS da FROM fiaon_telefonkartei_storno WHERE person_id = ${personId} AND zurueck_am IS NULL`) as any[];
  if (schon) return { ok: true, bereits: true, meldung: "War schon storniert.", punkte: [] };

  const grund = text(opts.grund).slice(0, 300) || "Kunde hat am Telefon storniert";
  const grundVoll = `${grund} (${opts.akteur}, Telefonkartei)`;
  // ── E-272 (02.10.2026): DER STORNO GILT DER PRIVATLINIE, NIE FIAON GLOBAL ──
  // Justin (Fall Hildbrand): „nehme ihn bitte komplett aus den Workflows … Er
  // soll Global bleiben.“ Storniert wird, was der Privatlinie gehört (Bestellungen
  // ohne Global, Leads, Vertriebssperre). Unberührt bleiben: Global-Bestellungen
  // (schon bisher), Termine mit quelle „global“ (das Erstgespräch zu FIAON Global,
  // Schritt 4) und bei einem Global-Kunden (Regel: fiaon-global-kunde.ts) die
  // Werbesperre. Sie ist ein Merkmal des Menschen, nicht der Privatlinie: Der
  // Postmeister stellte ihn damit bis E-272 auf „gesperrt“, auch für Fragen zu
  // seinem Auftrag (fiaon-postmeister-dossier.ts), und jede andere Stelle, die nach
  // ihr fragt, hielte ihn ebenso an. Werbung der Privatlinie bekommt ein
  // Global-Kunde seit E-272 ohnehin nicht mehr. Gelesen VOR dem Storno — so, wie
  // der Kunde dastand, als Justin klickte.
  const globalKunde = await istGlobalKunde(personId);
  const stand: StornoStand = {
    bestellungen: [], leads: [],
    person: { is_blocked: !!p.is_blocked, werbung_gesperrt_am: iso(p.werbung_gesperrt_am), gesperrt: false, werbesperre_quelle: p.werbesperre_quelle ?? null },
    termine: [], mails: [],
  };
  // Zuerst die Zeile — bricht unterwegs etwas ab, steht der Mensch trotzdem in
  // „Storniert" und lässt sich zurückholen.
  await sqlPool`
    INSERT INTO fiaon_telefonkartei_storno (person_id, am, grund, durch, durch_agent_id, stand, zurueck_am, zurueck_durch)
    VALUES (${personId}, NOW(), ${grund}, ${opts.akteur}, ${opts.akteurId}, ${sqlPool.json(stand as any)}, NULL, NULL)
    ON CONFLICT (person_id) DO UPDATE SET am = NOW(), grund = EXCLUDED.grund, durch = EXCLUDED.durch,
      durch_agent_id = EXCLUDED.durch_agent_id, stand = EXCLUDED.stand, zurueck_am = NULL, zurueck_durch = NULL`;

  const punkte: string[] = [];
  // E-213: derselbe Vorgang wie in der Akte, im Postfach und über die
  // Admin-Tür — Wirkung, Urkunde, Bestätigung, Verlauf. Vorher setzte dieser
  // Weg die Wirkung und schickte die Mail, fertigte aber keine Urkunde aus.
  const { kuendigungDurchfuehren } = await import("../routes/fiaon-kuendigung");

  // 1. Bestellungen — offene und laufende, nie ein Firmenauftrag (Global hat eigene Regeln).
  const bestellungen = (await sqlPool`
    SELECT a.ref, a.payment_status, a.cancelled_at, a.mahnstopp_am, a.pack_name
    FROM fiaon_applications a
    WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
      AND ${sqlPool.unsafe(KATEGORIE_A)} <> 'global'
      AND (a.payment_status IN ('pending', 'pending_payment', 'claimed_paid', 'expired')
           OR (a.payment_status = 'paid' AND (a.vertrag_ende_am IS NULL OR a.vertrag_ende_am > NOW())
               AND (a.gekuendigt_am IS NULL OR a.kuendigung_zurueckgenommen_am IS NOT NULL)))
    ORDER BY a.created_at`) as any[];
  for (const b of bestellungen) {
    const bezahlt = String(b.payment_status) === "paid";
    const kulanzRaten = bezahlt && opts.kulanz
      ? ((await sqlPool`SELECT id FROM fiaon_abo_raten WHERE ref = ${b.ref} AND status = 'offen'`) as any[]).map((r) => Number(r.id))
      : undefined;
    const erg = await kuendigungDurchfuehren(String(b.ref), {
      quelle: "telefon", grund: grundVoll, sofort: bezahlt && opts.kulanz, personId,
      unterzeichner: { name: String(opts.akteur || "FIAON LTD"), rolle: "Geschäftsführung", agentId: opts.akteurId ?? null },
      mail: bezahlt,
    });
    stand.bestellungen.push({
      ref: String(b.ref), weg: erg.weg, ok: erg.ok,
      vorher: { payment_status: b.payment_status ?? null, cancelled_at: iso(b.cancelled_at), mahnstopp_am: iso(b.mahnstopp_am) },
      ...(kulanzRaten ? { kulanzRaten } : {}),
    });
    const paketName = text(b.pack_name).split("\n")[0] || String(b.ref);
    if (!erg.ok) punkte.push(`${paketName}: nicht storniert — ${erg.grund}`);
    else if (erg.weg === "storno_unbezahlt") punkte.push(`${paketName}: Bestellung storniert, keine Zahlungserinnerungen mehr`);
    else if (erg.weg === "letzte_rate") punkte.push(`${paketName}: gekündigt — Rate ${erg.letzteRateNr} bleibt fällig, ${erg.stornierteRaten} spätere entfallen`);
    else if (erg.weg === "kulanz_sofort") punkte.push(`${paketName}: sofort beendet (Kulanz), ${erg.stornierteRaten} offene Rate(n) entfallen`);
    else if (erg.weg === "sofort_beendet") punkte.push(`${paketName}: Vertrag beendet (alles bezahlt)`);
    if (erg.mailGesendet) stand.mails.push(String(b.ref));
  }

  // 2. Leads — aus jeder Liste, die Lead-Mails hören auf.
  const leads = (await sqlPool`
    SELECT id, dismissed_at, dismissed_reason, dismissed_by, strecke_stopp, strecke_stopp_am, in_sequence
    FROM fiaon_leads WHERE person_id = ${personId} AND COALESCE(status, '') <> 'konvertiert'`) as any[];
  if (leads.length) {
    const { logLead } = await import("../routes/fiaon-leads");
    for (const l of leads) {
      stand.leads.push({
        id: Number(l.id),
        vorher: {
          dismissed_at: iso(l.dismissed_at), dismissed_reason: l.dismissed_reason ?? null, dismissed_by: l.dismissed_by ?? null,
          strecke_stopp: l.strecke_stopp ?? null, strecke_stopp_am: iso(l.strecke_stopp_am), in_sequence: l.in_sequence ?? null,
        },
      });
      await sqlPool`
        UPDATE fiaon_leads SET dismissed_at = COALESCE(dismissed_at, NOW()), dismissed_reason = COALESCE(dismissed_reason, 'sonstiges'),
               strecke_stopp = COALESCE(strecke_stopp, 'hand'), strecke_stopp_am = COALESCE(strecke_stopp_am, NOW()),
               in_sequence = FALSE, opened_at = NULL, updated_at = NOW()
        WHERE id = ${l.id}`;
      await logLead(Number(l.id), { id: null, name: opts.akteur }, "system", { note: `Storniert durch ${opts.akteur} (Telefonkartei): ${grund}. Rückholbar in der Telefonkartei unter „Storniert".` }).catch(() => {});
    }
    punkte.push(leads.length === 1 ? "Lead aus allen Listen genommen, Lead-Mails gestoppt" : `${leads.length} Leads aus allen Listen genommen, Lead-Mails gestoppt`);
  }

  // 3. Die Person — Sperre nur, wo das Haus sie zulässt.
  const { istZahlenderKunde } = await import("./fiaon-kunde-aktiv");
  const zahlend = await istZahlenderKunde(personId);
  stand.person.gesperrt = !zahlend;
  // Zahlungspost-Freigabe (zweite Prüfung, 08.10.2026): Der Storno ist der Wunsch des Menschen — werbesperre_quelle
  // 'mensch', auch auf eine stehende Werbesperre der Freigabe (fiaon-mail-frequenz.ts, FREIGABE_WERBESPERRE_PERSONEN_SQL).
  // Den Stand davor hält die Storno-Zeile; „Zurückholen" stellt ihn wieder her.
  await sqlPool`
    UPDATE fiaon_persons SET
      is_blocked = ${zahlend ? sqlPool`is_blocked` : sqlPool`TRUE`},
      werbung_gesperrt_am = ${globalKunde ? sqlPool`werbung_gesperrt_am` : sqlPool`COALESCE(werbung_gesperrt_am, NOW())`},
      werbesperre_quelle = ${globalKunde ? sqlPool`werbesperre_quelle` : sqlPool`'mensch'`},
      follow_up_date = NULL, promised_payment_date = NULL, updated_at = NOW()
    WHERE id = ${personId}`;
  punkte.push(zahlend
    ? "Zahlender Kunde: keine Vertriebssperre (Hausregel) — die offene Rate läuft bis zum Vertragsende weiter"
    : globalKunde ? "In keiner Anrufliste mehr" : "In keiner Anrufliste mehr, keine Werbung");
  if (globalKunde) punkte.push("Global-Kunde: keine Werbesperre — FIAON Global (Auftrag, Termine, Mails) läuft unverändert weiter");

  // 4. Gebuchte Termine absagen — der Zuständige erfährt es (terminAbsagen meldet).
  //    E-272 (02.10.2026): nie ein Termin mit quelle „global“ — das Erstgespräch zu FIAON Global
  //    gehört nicht der Privatlinie und bleibt samt Erinnerung bestehen (Kopf von stornieren).
  //    Bei einem Global-Kunden auch nicht der Gründer-Termin (quelle „gruender“, /justin): Das
  //    Startgespräch zum Individualangebot zählt einen über /justin neu gebuchten Termin als
  //    Ersatz (fiaon-global-angebot-startgespraech.ts), und Gründer- wie Global-Termine führt nie
  //    ein Vertreter (anruferNennform). Gegenprüfung 02.10.: ohne diese Zeile sagte der Storno
  //    eines Global-Kunden seinen Gründer-Termin ab. Beim Privatkunden bleibt es wie bisher.
  const termine = (await sqlPool`
    SELECT id, storno_token FROM fiaon_termine WHERE person_id = ${personId} AND status = 'gebucht' AND beginn > NOW()
      AND NOT (COALESCE(quelle, '') = 'global' OR (${globalKunde} AND quelle = 'gruender'))`) as any[];
  const [globalTermine] = (await sqlPool`
    SELECT COUNT(*)::int AS n FROM fiaon_termine WHERE person_id = ${personId} AND status = 'gebucht' AND beginn > NOW()
      AND (quelle = 'global' OR (${globalKunde} AND quelle = 'gruender'))`) as any[];
  if (Number(globalTermine?.n || 0) > 0) {
    punkte.push(`${Number(globalTermine.n) === 1 ? "Der Termin" : `${globalTermine.n} Termine`} zu FIAON Global ${Number(globalTermine.n) === 1 ? "bleibt" : "bleiben"} bestehen`);
  }
  if (termine.length) {
    const { terminAbsagen } = await import("./fiaon-termine");
    for (const t of termine) {
      const r = await terminAbsagen(String(t.storno_token), "kunde").catch(() => ({ ok: false }));
      if (r.ok) stand.termine.push(Number(t.id));
    }
    if (stand.termine.length) punkte.push(`${stand.termine.length} gebuchte${stand.termine.length === 1 ? "r Termin" : " Termine"} abgesagt`);
  }
  await sqlPool`UPDATE fiaon_telefonkartei_rueckruf SET erledigt_am = NOW() WHERE person_id = ${personId} AND erledigt_am IS NULL`.catch(() => {});

  // 5. Stufe neu rechnen — sonst stünde der Kunde bis zum Tageslauf in den Listen.
  const { personTierAktualisieren } = await import("./tier");
  await personTierAktualisieren(sqlPool, { personId }).catch((e) => console.error("[TELEFONKARTEI] Stufe:", e));

  await sqlPool`UPDATE fiaon_telefonkartei_storno SET stand = ${sqlPool.json(stand as any)} WHERE person_id = ${personId} AND zurueck_am IS NULL`;
  if (stand.mails.length) punkte.push("Kündigungsbestätigung per Mail verschickt");
  return { ok: true, meldung: "Storniert.", punkte };
}

export async function stornoZuruecknehmen(personId: number, akteur: string): Promise<StornoAntwort> {
  await karteiTabellen();
  const [s] = (await sqlPool`SELECT * FROM fiaon_telefonkartei_storno WHERE person_id = ${personId} AND zurueck_am IS NULL`) as any[];
  if (!s) return { ok: false, meldung: "Dieser Kunde ist nicht storniert.", punkte: [] };
  const stand = ausJson<StornoStand>(s.stand, { bestellungen: [], leads: [], person: { is_blocked: false, werbung_gesperrt_am: null, gesperrt: false }, termine: [], mails: [] });
  const grund = `Zurückgeholt durch ${akteur} (Telefonkartei)`;
  const punkte: string[] = [];
  const { kuendigungZuruecknehmen } = await import("./fiaon-kuendigung");

  for (const b of stand.bestellungen ?? []) {
    if (!b.ok || !["storno_unbezahlt", "letzte_rate", "sofort_beendet", "kulanz_sofort"].includes(b.weg)) continue;
    if (b.weg === "storno_unbezahlt") {
      await sqlPool`
        UPDATE fiaon_applications
           SET payment_status = ${b.vorher.payment_status || "pending_payment"}, cancelled_at = ${b.vorher.cancelled_at},
               mahnstopp_am = ${b.vorher.mahnstopp_am}, updated_at = NOW()
         WHERE ref = ${b.ref} AND payment_status = 'cancelled'`;
    }
    await kuendigungZuruecknehmen(b.ref, grund);
    if (b.weg === "kulanz_sofort" && b.kulanzRaten?.length) {
      await sqlPool`
        UPDATE fiaon_abo_raten SET status = 'offen', storniert_am = NULL, storno_grund = NULL, updated_at = NOW()
         WHERE id = ANY(${b.kulanzRaten}) AND status = 'storniert' AND storno_grund = 'kuendigung_kulanz'`;
    }
    if (b.weg !== "storno_unbezahlt") {
      await sqlPool`UPDATE fiaon_applications SET mahnstopp_am = ${b.vorher.mahnstopp_am}, kuendigung_bestaetigt_mail_am = NULL, updated_at = NOW() WHERE ref = ${b.ref}`;
    }
    punkte.push(`${b.ref}: wieder offen`);
  }

  if (stand.leads?.length) {
    const { logLead } = await import("../routes/fiaon-leads");
    for (const l of stand.leads) {
      await sqlPool`
        UPDATE fiaon_leads SET dismissed_at = ${l.vorher.dismissed_at}, dismissed_reason = ${l.vorher.dismissed_reason},
               dismissed_by = ${l.vorher.dismissed_by}, strecke_stopp = ${l.vorher.strecke_stopp},
               strecke_stopp_am = ${l.vorher.strecke_stopp_am}, in_sequence = ${l.vorher.in_sequence ?? false}, updated_at = NOW()
        WHERE id = ${l.id}`;
      await logLead(l.id, { id: null, name: akteur }, "system", { note: `${grund}.` }).catch(() => {});
    }
    punkte.push(stand.leads.length === 1 ? "Lead wieder in den Listen" : `${stand.leads.length} Leads wieder in den Listen`);
  }

  // Die Sperren nur zurücknehmen, wenn DER STORNO sie gesetzt hat. Die Herkunft der Werbesperre (08.10.2026) wie vor dem
  // Storno: ohne Werbesperre davor leer; mit einer davor die damalige Herkunft — fehlt sie (ältere Storno-Zeile), bleibt
  // die jetzige ('mensch', im Zweifel die strengere Lesart).
  const quelleVorher = !stand.person.werbung_gesperrt_am ? sqlPool`NULL`
    : stand.person.werbesperre_quelle !== undefined ? sqlPool`${stand.person.werbesperre_quelle}` : sqlPool`werbesperre_quelle`;
  await sqlPool`
    UPDATE fiaon_persons SET
      is_blocked = ${stand.person.gesperrt && !stand.person.is_blocked ? sqlPool`FALSE` : sqlPool`is_blocked`},
      werbung_gesperrt_am = ${stand.person.werbung_gesperrt_am ? sqlPool`werbung_gesperrt_am` : sqlPool`NULL`},
      werbesperre_quelle = ${quelleVorher},
      updated_at = NOW()
    WHERE id = ${personId}`;

  const { personTierAktualisieren } = await import("./tier");
  await personTierAktualisieren(sqlPool, { personId }).catch((e) => console.error("[TELEFONKARTEI] Stufe:", e));
  await sqlPool`UPDATE fiaon_telefonkartei_storno SET zurueck_am = NOW(), zurueck_durch = ${akteur} WHERE person_id = ${personId} AND zurueck_am IS NULL`;
  if (stand.termine?.length) punkte.push("Abgesagte Termine bleiben abgesagt — bei Bedarf neu buchen");
  return { ok: true, meldung: "Zurückgeholt.", punkte };
}

// ── Rückrufe und Termine ────────────────────────────────────────────────────

export async function rueckrufListe(): Promise<KarteiRueckruf[]> {
  await karteiTabellen();
  const zeilen = (await sqlPool`
    SELECT rr.id, rr.person_id, rr.am, rr.notiz, p.first_name, p.last_name, p.contact_name, p.primary_phone, p.country,
           (SELECT a.phone FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL ORDER BY a.created_at DESC LIMIT 1) AS a_phone,
           (SELECT a.phone_country_code FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL ORDER BY a.created_at DESC LIMIT 1) AS a_vorwahl,
           (SELECT l.telefon FROM fiaon_leads l WHERE l.person_id = p.id ORDER BY l.erstellt_am DESC LIMIT 1) AS l_telefon
    FROM fiaon_telefonkartei_rueckruf rr JOIN fiaon_persons p ON p.id = rr.person_id
    WHERE rr.erledigt_am IS NULL
    ORDER BY rr.am LIMIT 100`) as any[];
  return zeilen.map((z) => {
    const tel = waehlbareNummer([{ nummer: z.a_phone, vorwahl: z.a_vorwahl }, { nummer: z.primary_phone }, { nummer: z.l_telefon }], z.country);
    const name = [text(z.first_name), text(z.last_name)].filter(Boolean).join(" ") || text(z.contact_name) || `Unbekannt #${z.person_id}`;
    return { id: Number(z.id), personId: Number(z.person_id), name, am: iso(z.am)!, notiz: z.notiz ?? null, telefonWaehlbar: tel.waehlbar, telefonAnzeige: tel.anzeige };
  });
}

export async function rueckrufErledigt(id: number): Promise<boolean> {
  await karteiTabellen();
  const r = (await sqlPool`UPDATE fiaon_telefonkartei_rueckruf SET erledigt_am = NOW() WHERE id = ${id} AND erledigt_am IS NULL RETURNING id`) as any[];
  return r.length > 0;
}

/**
 * Kalendereintrag für den Rückruf — das iPhone erinnert, auch wenn die Seite zu ist.
 * 29.09.2026 (E-263): über server/lib/fiaon-ics.ts — vorher ohne Faltung, eine lange
 * Notiz ergab eine Zeile über 75 Oktette (nach RFC 5545 ungültig).
 */
export async function rueckrufIcs(id: number): Promise<{ name: string; ics: string } | null> {
  const [r] = (await rueckrufListe()).filter((x) => x.id === id);
  if (!r) return null;
  const beginn = new Date(r.am);
  const ende = new Date(beginn.getTime() + 15 * 60_000);
  const seite = absoluteUrl("/chef/s/telefonkartei");
  const { icsKalender } = await import("./fiaon-ics");
  const ics = icsKalender({
    prodid: "-//FIAON//Telefonkartei//DE",
    ereignisse: [{
      uid: `tk-rueckruf-${r.id}@fiaon.com`,
      stempel: new Date(),
      beginn, ende,
      titel: `Rückruf: ${r.name} (FIAON)`,
      beschreibung: [r.telefonAnzeige ? `Telefon: ${r.telefonAnzeige}` : null, r.notiz, `Telefonkartei: ${seite}`].filter(Boolean).join("\n"),
      url: seite,
      alarme: [{ minutenVorher: 5, text: `In 5 Minuten: ${r.name} anrufen` }, { minutenVorher: 0, text: `Jetzt ${r.name} anrufen` }],
    }],
  });
  return { name: `Rueckruf-${r.id}.ics`, ics };
}

/**
 * Die Termine für den unteren Abschnitt. Justin (21.09.2026): „Ich will nur meine
 * sehen und erst weiter unten ALLE Termine — vorrangig die, die Leute bei mir
 * buchen." Deshalb zwei Mengen in einer Abfrage:
 *   · deine  = das Konto der Gründerseite (/justin), das eigene Chef-Konto oder
 *              ein Gründergespräch — heute (auch erledigte/verpasste) und die
 *              nächsten 60 Tage
 *   · andere = gebuchte Termine des Teams, ab zwei Stunden zurück, 21 Tage
 */
export async function termineListe(meineAgentIds: number[]): Promise<KarteiTermin[]> {
  const meine = Array.from(new Set(meineAgentIds.filter((n) => Number.isInteger(n) && n > 0)));
  const zeilen = (await sqlPool`
    WITH t0 AS (
      SELECT t.*, (t.quelle = 'gruender' OR t.agent_id = ANY(${meine})) AS meiner
      FROM fiaon_termine t
      WHERE t.status <> 'abgesagt'
        AND t.beginn >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
        AND t.beginn < NOW() + INTERVAL '60 days'
    )
    SELECT t.id, t.person_id, t.beginn, t.dauer_min, t.status, t.quelle, t.agent_id, t.notiz, t.meiner,
           ag.name AS bei, p.first_name, p.last_name, p.contact_name, p.primary_phone, p.country,
           (SELECT a.phone FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL ORDER BY a.created_at DESC LIMIT 1) AS a_phone,
           (SELECT a.phone_country_code FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL ORDER BY a.created_at DESC LIMIT 1) AS a_vorwahl
    FROM t0 t
    LEFT JOIN fiaon_persons p ON p.id = t.person_id
    LEFT JOIN fiaon_agents ag ON ag.id = t.agent_id
    WHERE t.meiner
       OR (COALESCE(p.ist_test_am IS NULL, TRUE) AND t.status = 'gebucht'
           AND t.beginn > NOW() - INTERVAL '2 hours' AND t.beginn < NOW() + INTERVAL '21 days')
    ORDER BY t.beginn LIMIT 300`) as any[];
  return zeilen.map((z) => {
    const tel = waehlbareNummer([{ nummer: z.a_phone, vorwahl: z.a_vorwahl }, { nummer: z.primary_phone }], z.country);
    const name = [text(z.first_name), text(z.last_name)].filter(Boolean).join(" ") || text(z.contact_name) || "Ohne Namen";
    return {
      id: Number(z.id), personId: z.person_id != null ? Number(z.person_id) : null, name,
      beginn: iso(z.beginn)!, dauerMin: z.dauer_min != null ? Number(z.dauer_min) : null,
      status: String(z.status), art: terminArtAusQuelle(z.quelle).text, bei: text(z.bei) || null,
      meiner: !!z.meiner,
      telefonWaehlbar: tel.waehlbar, telefonAnzeige: tel.anzeige,
      notiz: text(z.notiz).slice(0, 240) || null,
    };
  });
}
