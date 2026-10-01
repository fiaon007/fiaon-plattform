// ═══════════════════════════════════════════════════════════════════════════
// MARAS AKTION — sie schreibt jeden an, der noch nichts bezahlt hat
// (21.09.2026, Justin)
//
// „Mara hat ab jetzt JEDEN TAG, Mo bis So, 24 h folgende Aufgabe: ALLE Kunden,
// die wir im System haben und noch bekommen werden, die noch NICHTS bezahlt
// haben — Mara sieht sich JEDE Kundenakte an und beginnt bei den heißesten
// Kunden zuerst (A-Leads!) … Das macht sie bei JEDEM Kunden in JEDER Situation.
// In der Stunde versendet sie 50 E-Mails (24 h lang, auch nachts und abends
// lesen Menschen und konvertieren meist viel besser)."
//
// Freigegeben (Rückfrage 21.09.): Stufe A (Zahlung gemeldet, Geld nicht da) und
// B (Antrag fertig, Rechnung offen). C-Leads erst nach Prüfung der
// Mail-Einwilligung (§ 7 UWG) — hier gesperrt, bis Justin sie freigibt.
// Unterschrift nur „Mara Lindner" (Justins Entscheidung, Register E-206).
//
// ── DIE REGELN DER AKTION ─────────────────────────────────────────────────
// · Reihenfolge: A vor B, innerhalb der Stufe das jüngste Ereignis zuerst
//   (gemessen, E-162: 36 % der Zahlungsmelder zahlen am ersten Tag, die
//   Frische entscheidet).
// · Takt je Kunde: erste Mail 24 h nach Antrag bzw. Zahlungsmeldung, dann
//   nach 2, 4, 7 und danach alle 14 Tage — nie dieselbe Mail zweimal, jede mit
//   einem neuen Gedanken. Kein Ende: „so lange, bis er Kunde wird".
// · Stopp: bezahlt, storniert, gekündigt, Werbesperre, Vertriebssperre,
//   „Stopp"-Antwort, Zustellproblem an die Adresse, aus der Aktion genommen.
// · Rücksicht: Schreibt der Kunde selbst, antwortet Mara im Postfach — die
//   Aktion wartet 7 Tage. Hat ein Mitarbeiter in den letzten 12 h mit ihm
//   gesprochen oder ging in den letzten 6 h eine andere Mail raus, wartet sie.
// · Menge: frei einstellbar je Stunde (Vorgabe 50, bis 500), rund um die Uhr.
//   Der Anlauf (Tag 1 höchstens 200, dann 400, 800) ist am 22.09.2026 auf
//   Justins Anweisung entfallen: „die Adresse haben wir ja bereits länger und
//   viel genutzt". Der Tagesdeckel ist seitdem schlicht 24 × Stundenzahl.
//   Was bleibt: Wer den Regler hochzieht, beobachtet die Zustellung
//   (Rückläufer, Beschwerden) — eine Adresse, die bei Gmail im Spam landet,
//   nimmt jede Rechnung von fiaon.com mit.
// · Kosten: eigener Tagesdeckel (Einstellung, Vorgabe 15 €).
// · Jede Mail steht vollständig in fiaon_mara_aktion, in der Akte (Verlauf)
//   und im Steuerpult /chef/s/mara.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { wandPruefen } from "@shared/fiaon-wortverbote";
import { KARTE_LINK_SATZ, KARTE_ZEIT_SATZ } from "@shared/fiaon-karten-weg";
import { ohneEmojis } from "@shared/fiaon-telefonkartei";
import { akteLesen } from "./fiaon-postmeister-dossier";
import { kundenwegLesen } from "./fiaon-kundenweg";
import { gedaechtnisText } from "./fiaon-mara-gedaechtnis";
import { kiAufruf, antwortLesen, akteKompakt, MODELL, agentNamen } from "./fiaon-postmeister-agent";
import { kiPausiert, istKiPause } from "./fiaon-ki-pause";
import { anredeBestimmen, antwortBauen, grussMitAgent } from "./fiaon-postmeister-antworttext";
import { postfachGruss } from "./fiaon-postmeister-postfaecher";
import { kostenHeute, kostenCentsAus } from "./fiaon-postmeister-schema";
import { absoluteUrl } from "../fiaon-base-url";
import { menschSperre, werbesperreAnAdresse, werbungVerboten } from "./fiaon-mail-frequenz";
// E-248: Maras Stimme aus EINER Quelle — dieselbe Persona wie im Postfach und auf WhatsApp.
import { personaText, tonPruefung, linkPruefung, AUSSICHT_SAETZE, kartenZiel, kartenzielText, BANK_SATZ, nennAus, type KartenZiel } from "@shared/fiaon-mara-ton";
import type { MitarbeiterEintrag } from "@shared/fiaon-mitarbeiter-name";
import { abgeschicktSql } from "@shared/fiaon-antrag-stand";

export const DIENST = "mara-aktion";
export const PAKETE_PRIVAT = ["start", "pro", "highend", "ultra"];

// ── Einstellungen ─────────────────────────────────────────────────────────
export interface AktionEinstellungen {
  an: boolean;
  jeStunde: number;
  tagEuro: number;
  stufen: string[];
  emojis: boolean;
  postfach: string;
  start: string | null;
}
const VORGABE: Record<string, string> = {
  mara_aktion_an: "an",
  mara_aktion_je_stunde: "50",
  mara_aktion_tag_euro: "15",
  mara_aktion_stufen: "A,B",
  mara_aktion_emojis: "aus",
  mara_aktion_postfach: "support@fiaon.com",
};
export const AKTION_SCHLUESSEL = Object.keys(VORGABE);

export async function einstellungenLesen(): Promise<AktionEinstellungen> {
  const zeilen = (await sqlPool`SELECT key, value FROM fiaon_settings WHERE key LIKE 'mara_aktion_%'`.catch(() => [])) as any[];
  const w = (k: string) => String(zeilen.find((z) => z.key === k)?.value ?? VORGABE[k] ?? "");
  const zahl = (k: string, min: number, max: number) => Math.max(min, Math.min(max, Number(w(k)) || 0));
  return {
    an: w("mara_aktion_an") === "an",
    jeStunde: zahl("mara_aktion_je_stunde", 0, 500),
    tagEuro: zahl("mara_aktion_tag_euro", 0, 500),
    // C bleibt gesperrt, bis die Einwilligung geprüft ist — auch wenn jemand „C" einträgt.
    stufen: w("mara_aktion_stufen").split(",").map((x) => x.trim().toUpperCase()).filter((x) => x === "A" || x === "B"),
    emojis: w("mara_aktion_emojis") === "an",
    postfach: w("mara_aktion_postfach") || "support@fiaon.com",
    // 22.09.2026: nur noch Buchführung — der Anlauf ist entfallen.
    start: zeilen.find((z) => z.key === "mara_aktion_start")?.value ?? null,
  };
}

export async function einstellungSetzen(schluessel: string, wert: string): Promise<void> {
  if (!AKTION_SCHLUESSEL.includes(schluessel)) throw new Error("Unbekannte Einstellung.");
  await sqlPool`INSERT INTO fiaon_settings (key, value) VALUES (${schluessel}, ${wert})
                ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}

// ── Tabellen ──────────────────────────────────────────────────────────────
let bereit = false;
export async function aktionTabellen(): Promise<void> {
  if (bereit) return;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_mara_aktion (
      id SERIAL PRIMARY KEY,
      person_id INTEGER NOT NULL,
      ref TEXT,
      stufe TEXT NOT NULL,
      schritt INTEGER NOT NULL,
      status TEXT NOT NULL,
      grund TEXT,
      betreff TEXT,
      text TEXT,
      html TEXT,
      empfaenger TEXT,
      postfach TEXT,
      gmail_id TEXT,
      thread_id TEXT,
      kosten_cents NUMERIC,
      pruefung JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      gesendet_am TIMESTAMPTZ
    )`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_mara_aktion_person_idx ON fiaon_mara_aktion (person_id, created_at DESC)`;
  await sqlPool`CREATE INDEX IF NOT EXISTS fiaon_mara_aktion_status_idx ON fiaon_mara_aktion (status, gesendet_am DESC)`;
  await sqlPool`
    CREATE TABLE IF NOT EXISTS fiaon_mara_ausschluss (
      person_id INTEGER PRIMARY KEY,
      grund TEXT,
      von TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`;
  bereit = true;
}

// ── Wer ist dran? ─────────────────────────────────────────────────────────
export interface Kandidat {
  personId: number; ref: string; stufe: "A" | "B"; schritt: number;
  email: string; vorname: string | null; nachname: string | null;
  paket: string | null; betragEuro: number | null; wunschlimit: number | null;
  zahlungsreferenz: string | null; ereignisAm: string; zuletztAm: string | null;
  /** E-265: der Paketschlüssel — für den Rahmen des Pakets (Kartenziel). */
  paketKey?: string | null;
}

/**
 * Die Schlange, heißeste zuerst. Eine Zeile je Person (die heißeste offene
 * Bestellung). Alle Stopp- und Rücksichtsregeln stehen HIER, in einer Abfrage —
 * das Steuerpult zeigt dieselbe Schlange.
 */
export async function kandidatenLaden(grenze: number, stufen: string[]): Promise<Kandidat[]> {
  await aktionTabellen();
  if (!stufen.length || grenze <= 0) return [];
  const status = stufen.map((s) => (s === "A" ? "claimed_paid" : "pending_payment"));
  // ── EINMAL JE MENGE STATT JE ZEILE (21.09.2026) ─────────────────────────
  // Die erste Fassung prüfte jede Regel als Unterabfrage je Kandidat — gegen
  // die Produktion gemessen 14,4 s (die Zustell-Prüfung über LOWER(empfaenger)
  // hat keinen Index und las das Mail-Protokoll je Zeile neu). Jetzt wird jede
  // Sperrmenge EINMAL gebildet und per Anti-Join abgezogen: 44 ms, dieselben 567 Menschen.
  // NOT IN verlangt Mengen ohne NULL — deshalb steht an jeder „person_id IS NOT NULL“.
  const zeilen = (await sqlPool`
    WITH app AS (
      SELECT DISTINCT ON (a.person_id) a.person_id, a.ref, a.payment_status, a.claimed_paid_at, a.created_at, a.pack_name, a.pack_key,
             a.amount_due, a.wanted_limit, a.payment_reference, a.email, a.first_name, a.last_name
        FROM fiaon_applications a
       WHERE a.gdpr_deleted_at IS NULL AND a.merged_into IS NULL AND a.person_id IS NOT NULL
         AND a.payment_status = ANY(${status}) AND a.pack_key = ANY(${PAKETE_PRIVAT})
         -- E-264 (29.09.2026): Stufe B heißt ABGESCHICKT. approved + pending_payment setzt der Antragsweg
         -- schon bei Schritt 3–5 — 36 Menschen bekamen seit E-248 von hier eine Zahlungsmail ohne Vertrag.
         AND (a.payment_status = 'claimed_paid' OR ${sqlPool.unsafe(abgeschicktSql("a"))})
         AND a.gekuendigt_am IS NULL AND a.cancelled_at IS NULL
         -- E-244 (26.09.2026): keine Auskunft-Bestellung. Zwei offene tragen den Paketschlüssel
         -- highend, Maras Mail spricht aber vom Paket. Erkannt wie IST_AUSKUNFT; an die
         -- Auskunft-Zahlung erinnert ein eigener Lauf.
         AND COALESCE(a.type, '') <> 'schufa' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
       ORDER BY a.person_id, (a.payment_status = 'claimed_paid') DESC, a.created_at DESC
    ),
    letzte AS (
      SELECT person_id, MAX(gesendet_am) AS am, COUNT(*)::int AS n
        FROM fiaon_mara_aktion WHERE status = 'gesendet' GROUP BY person_id
    ),
    -- „nichts bezahlt": wer schon eine bezahlte Bestellung hat, ist Kunde.
    -- E-244 (26.09.2026): Eine bezahlte Bonitätsauskunft ist kein Paket — wer nur sie bezahlt hat und
    -- einen offenen Paketantrag hat, bleibt in Maras Erinnerung (vorher fiel er dauerhaft heraus).
    bezahlt AS (SELECT DISTINCT person_id FROM fiaon_applications WHERE payment_status = 'paid' AND merged_into IS NULL AND person_id IS NOT NULL
                  AND COALESCE(type, '') <> 'schufa' AND COALESCE(ref, '') NOT LIKE 'FIAON-SCHUFA-%'),
    ausgenommen AS (SELECT person_id FROM fiaon_mara_ausschluss),
    storniert AS (SELECT DISTINCT person_id FROM fiaon_telefonkartei_storno WHERE zurueck_am IS NULL AND person_id IS NOT NULL),
    -- „Stopp" per Antwort, egal wann (flags steht teils als JSON-Text in der jsonb-Spalte —
    -- deshalb der Textvergleich, nie ein Cast, der an einer Zeile scheitert)
    stopp AS (SELECT DISTINCT person_id FROM fiaon_postmeister WHERE person_id IS NOT NULL AND flags::text ~ 'stopp\\\\?"\\s*:\\s*true'),
    -- E-248 (Prüfung 28.09.: 5 Personen, 8 Mails): Wer widerrufen, die Forderung bestritten,
    -- mit Anwalt gedroht oder „kann nicht zahlen" geschrieben hat, bekommt keine Werbemail
    -- zur Zahlung — egal wann. Eine Beschwerde hält die Aktion 30 Tage an.
    einwand AS (SELECT DISTINCT person_id FROM fiaon_postmeister WHERE person_id IS NOT NULL
                  AND (flags::text ~ '(widerruf|bestreitet|droht_anwalt|zahlungsunfaehig)\\\\?"\\s*:\\s*true'
                    OR (flags::text ~ 'beschwerde\\\\?"\\s*:\\s*true' AND COALESCE(empfangen_am, created_at) > NOW() - INTERVAL '30 days'))),
    -- E-248: Werbesperre an der ADRESSE (eine zweite Person, ein Lead oder ein Antrag mit derselben
    -- Adresse) — dieselbe Regel wie werbesperreAnAdresse. Vorher erst direkt vor dem Senden geprüft:
    -- dieselben zwei Menschen wurden jeden Tag erneut „zurückgehalten".
    gesperrte_adresse AS (
      SELECT LOWER(TRIM(p.primary_email)) AS adresse FROM fiaon_persons p WHERE p.werbung_gesperrt_am IS NOT NULL AND p.primary_email LIKE '%@%'
      UNION SELECT LOWER(TRIM(x.email)) FROM fiaon_applications x JOIN fiaon_persons p ON p.id = x.person_id WHERE p.werbung_gesperrt_am IS NOT NULL AND x.email LIKE '%@%'
      UNION SELECT LOWER(TRIM(l.email)) FROM fiaon_leads l JOIN fiaon_persons p ON p.id = l.person_id WHERE p.werbung_gesperrt_am IS NOT NULL AND l.email LIKE '%@%'
      UNION SELECT LOWER(TRIM(m.primary_email)) FROM fiaon_persons m JOIN fiaon_persons p ON p.id = m.merged_into_person_id WHERE p.werbung_gesperrt_am IS NOT NULL AND m.primary_email LIKE '%@%'),
    -- nach einer zurückgehaltenen Mail oder einem Fehler 24 h Ruhe — kein Dauerversuch
    ruhe AS (SELECT DISTINCT person_id FROM fiaon_mara_aktion WHERE status IN ('abgelehnt', 'fehler') AND created_at > NOW() - INTERVAL '24 hours'),
    -- der Kunde hat selbst geschrieben: Mara antwortet im Postfach, die Aktion wartet 7 Tage
    schrieb AS (SELECT DISTINCT person_id FROM fiaon_postmeister WHERE person_id IS NOT NULL AND empfangen_am > NOW() - INTERVAL '7 days'),
    -- ein Mitarbeiter war in den letzten 12 h dran
    kontakt AS (SELECT DISTINCT person_id FROM fiaon_contact_log WHERE person_id IS NOT NULL AND agent_id IS NOT NULL AND voided_at IS NULL AND created_at > NOW() - INTERVAL '12 hours'),
    -- eine andere Mail ist in den letzten 6 h raus
    mail AS (SELECT DISTINCT person_id FROM fiaon_mail_log WHERE person_id IS NOT NULL AND art = 'echt' AND created_at > NOW() - INTERVAL '6 hours'),
    -- an diese Adressen kommt nichts an
    kaputt AS (SELECT DISTINCT LOWER(empfaenger) AS adresse FROM fiaon_mail_log WHERE zustellung IN ('gebounct', 'blockiert', 'spam') AND empfaenger IS NOT NULL)
    SELECT app.*, COALESCE(NULLIF(TRIM(p.primary_email), ''), app.email) AS mail,
           COALESCE(NULLIF(TRIM(p.first_name), ''), app.first_name) AS vor,
           COALESCE(NULLIF(TRIM(p.last_name), ''), app.last_name) AS nach,
           COALESCE(l.n, 0) AS gesendet, l.am AS zuletzt
      FROM app
      JOIN fiaon_persons p ON p.id = app.person_id
      LEFT JOIN letzte l ON l.person_id = app.person_id
     WHERE COALESCE(NULLIF(TRIM(p.primary_email), ''), app.email) LIKE '%@%'
       AND p.merged_into_person_id IS NULL
       AND p.werbung_gesperrt_am IS NULL
       AND COALESCE(p.is_blocked, FALSE) = FALSE
       -- E-240 (24.09.2026): keine Testkonten, und wer NACH diesem Antrag irgendeinen Vertrag
       -- gekündigt hat, bekommt dafür keine Werbung (gekündigt ist der Mensch, E-213). Wer
       -- nach einer Kündigung NEU beantragt hat, bleibt drin — das ist neues Interesse.
       AND p.ist_test_am IS NULL
       AND NOT EXISTS (
         SELECT 1 FROM fiaon_applications g
          WHERE g.person_id = app.person_id AND g.merged_into IS NULL
            AND g.gekuendigt_am IS NOT NULL AND g.kuendigung_zurueckgenommen_am IS NULL
            AND g.gekuendigt_am >= app.created_at)
       AND app.person_id NOT IN (SELECT person_id FROM bezahlt)
       AND app.person_id NOT IN (SELECT person_id FROM ausgenommen)
       AND app.person_id NOT IN (SELECT person_id FROM storniert)
       AND app.person_id NOT IN (SELECT person_id FROM stopp)
       AND app.person_id NOT IN (SELECT person_id FROM einwand)
       AND LOWER(TRIM(COALESCE(NULLIF(TRIM(p.primary_email), ''), app.email))) NOT IN (SELECT adresse FROM gesperrte_adresse WHERE adresse IS NOT NULL)
       AND app.person_id NOT IN (SELECT person_id FROM ruhe)
       AND app.person_id NOT IN (SELECT person_id FROM schrieb)
       AND app.person_id NOT IN (SELECT person_id FROM kontakt)
       AND app.person_id NOT IN (SELECT person_id FROM mail)
       AND LOWER(COALESCE(NULLIF(TRIM(p.primary_email), ''), app.email)) NOT IN (SELECT adresse FROM kaputt)
       -- erste Mail frühestens 24 h nach Antrag bzw. Zahlungsmeldung
       AND (CASE WHEN app.payment_status = 'claimed_paid' THEN COALESCE(app.claimed_paid_at, app.created_at) ELSE app.created_at END) < NOW() - INTERVAL '24 hours'
       -- Takt: 2, 4, 7, dann 14 Tage
       AND (l.am IS NULL OR l.am < NOW() - (CASE LEAST(l.n, 4) WHEN 1 THEN INTERVAL '2 days' WHEN 2 THEN INTERVAL '4 days' WHEN 3 THEN INTERVAL '7 days' ELSE INTERVAL '14 days' END))
     ORDER BY (app.payment_status = 'claimed_paid') DESC,
              (CASE WHEN app.payment_status = 'claimed_paid' THEN COALESCE(app.claimed_paid_at, app.created_at) ELSE app.created_at END) DESC
     LIMIT ${Math.max(1, Math.min(500, grenze))}
  `) as any[];
  return zeilen.map((z) => ({
    personId: Number(z.person_id), ref: String(z.ref),
    stufe: z.payment_status === "claimed_paid" ? "A" : "B",
    schritt: Number(z.gesendet || 0) + 1,
    email: String(z.mail).trim(), vorname: z.vor ?? null, nachname: z.nach ?? null,
    paket: z.pack_name ?? null,
    paketKey: z.pack_key ?? null,
    betragEuro: z.amount_due == null ? null : Number(z.amount_due),
    wunschlimit: z.wanted_limit == null ? null : Number(z.wanted_limit),
    zahlungsreferenz: z.payment_reference ?? null,
    ereignisAm: new Date(z.payment_status === "claimed_paid" ? (z.claimed_paid_at ?? z.created_at) : z.created_at).toISOString(),
    zuletztAm: z.zuletzt ? new Date(z.zuletzt).toISOString() : null,
  }));
}

// ── Die Mail schreiben ────────────────────────────────────────────────────
const SCHEMA = {
  type: "object", additionalProperties: false,
  properties: {
    betreff: { type: "string", description: "3 bis 8 Wörter, persönlich, ohne Ausrufezeichen, ohne Emoji, ohne Werbesprache." },
    text: { type: "string", description: "Die Mail ohne Anrede, ohne Gruß, ohne Unterschrift, ohne Adresse (URL)." },
  },
  required: ["betreff", "text"],
};

function berlinStunde(): number {
  const p = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }).formatToParts(new Date());
  return Number(p.find((x) => x.type === "hour")?.value ?? "12") % 24;
}
function tageszeit(): string {
  const h = berlinStunde();
  return h < 5 ? "Nacht" : h < 11 ? "Morgen" : h < 14 ? "Mittag" : h < 18 ? "Nachmittag" : h < 22 ? "Abend" : "späten Abend";
}
const eur = (n: number | null) => (n == null ? null : `${n.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`);
/** Ein Limit ohne Cent: „25.000 €", nicht „25.000,00 €". */
const eurGanz = (n: number | null) => (n == null ? null : `${Math.round(n).toLocaleString("de-DE")} €`);
const tagDe = (iso: string | null) => (iso ? new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso)) : null);

/** Worum es in welcher Mail geht — jede bringt einen neuen Gedanken. */
function thema(stufe: "A" | "B", schritt: number): string {
  if (stufe === "A") {
    return [
      "Erste Mail: Stell dich kurz vor. Danke ihm, dass er die Zahlung gemeldet hat. Sag freundlich, dass sie bei dir noch nicht angekommen ist — Überweisungen brauchen manchmal etwas. Bitte ihn, dir den Überweisungsbeleg einfach als Antwort zu schicken, dann ordnest du ihn sofort zu; und wenn die Überweisung doch nicht rausging, geht es über den Knopf unten in zwei Minuten. Dann: Sobald die Zahlung da ist, aktivierst du seinen Account — und was ihn dann erwartet (Link der Partnerbank, Karte).",
      "Zweite Mail: Kein Vorstellen. Nimm kurz Bezug auf deine letzte Mail. Die Zahlung ist noch nicht zugeordnet — oft fehlt nur der Verwendungszweck. Bitte um den Beleg als Antwort oder den Weg über den Knopf (dort steht der richtige Verwendungszweck). Motivierend: Sobald die Zahlung zugeordnet ist, geht es direkt weiter.",
      "Dritte Mail: Konzentrier dich auf die Karte: Nach der Aktivierung kommt direkt der Link unserer Partnerbank, die Karte ist in der Regel nach der Zusage der Bank in 2–5 Werktagen da, meist vorher schon mit Apple Pay nutzbar. Bitte um den Beleg oder die Zahlung über den Knopf.",
      "Weitere Mail: Persönlich und kurz. Nimm Bezug auf seine Lage (Gedächtnis, Weg). Frag, ob etwas unklar ist — eine kurze Antwort genügt, du kümmerst dich. Freundliche Erinnerung an den offenen Schritt.",
    ][Math.min(schritt, 4) - 1];
  }
  return [
    // E-265 Nachbesserung (29.09.2026): kein „fehlt nur noch" (Nähe als Druck, fast eine Zusage — naehe_druck).
    "Erste Mail: Stell dich kurz vor (so wie in Justins Beispiel). Bei uns kommt er zu seiner eigenen Visa-Kreditkarte — sein Wunschlimit ist dabei das Ziel, über den Rahmen entscheidet unsere Partnerbank. Der nächste Schritt ist die offene Rechnung, seine erste Monatsrate. Sobald die Zahlung gebucht ist, aktivierst du den Account und sein persönlicher Betreuer begleitet ihn. Mach ihm Mut: Mit seinem Antrag ist er schon einen großen Schritt weiter. Du würdest dich freuen.",
    "Zweite Mail: Kein Vorstellen. Nimm kurz Bezug auf deine letzte Mail. Heute die Karte: Nach der Aktivierung bekommt er direkt den fertigen Link unserer Partnerbank für Konto und Karte; die Karte ist in der Regel nach der Zusage der Bank in 2–5 Werktagen bei ihm, meist vorher schon mit Apple Pay in der App der Bank nutzbar. Der einzige offene Schritt ist die Rechnung.",
    "Dritte Mail: Wie einfach es ist: ein Klick auf den Knopf, dort stehen Betrag, Bankdaten, Verwendungszweck und ein QR-Code für die Banking-App — in zwei Minuten erledigt. Wenn ihn etwas zögern lässt: Er kann dir einfach antworten, du kümmerst dich persönlich.",
    "Weitere Mail: Persönlich und kurz. Nimm Bezug auf seine Lage (Gedächtnis, Weg, was er bei der Bestellung wollte). Erinnere freundlich an sein Ziel (seine Visa-Kreditkarte, sein Wunschlimit) und daran, dass als nächster Schritt die Rechnung offen ist, und biete den Termin an. Kein Druck.",
  ][Math.min(schritt, 4) - 1];
}

function aktionsPrompt(ein: {
  name: string; k: Kandidat; akte: any; weg: string; gedaechtnis: string; betreuer: string | null;
  /**
   * E-265 Nachbesserung (29.09.2026, Regel 5): Team abwesend (E-260) — wer bis wann an Stelle des festen Betreuers
   * anruft (Nennform, `dat` nach „mit"). Den Termin bietet Mara dann mit IHM an, nie mit dem Abwesenden.
   */
  vertretung?: { name: string; dat: string; bis: string } | null;
  faelligAm: string | null; bisher: { am: string; betreff: string; text: string }[]; emojis: boolean; sprache: string;
  /** E-265: sein Kartenziel (wanted_limit, gedeckelt auf den Rahmen seines Pakets). */
  kartenziel?: KartenZiel | null;
  /** Justins eigene Anweisung (Steuerpult) — steht ganz oben und gewinnt im Zweifel. */
  hausanweisung?: string;
}): string {
  const { k } = ein;
  const fremd = ein.sprache && ein.sprache.slice(0, 2).toLowerCase() !== "de";
  // E-265 Nachbesserung (Regel 5): mit wem der Termin ist — bis „bis" der Vertreter, sonst der feste Betreuer.
  const terminMit = ein.vertretung ? { nom: ein.vertretung.name, dat: ein.vertretung.dat } : { nom: ein.betreuer ?? "jemand aus unserem Team", dat: nennAus(ein.betreuer)?.dat ?? "unserem Team" };
  return [
    ein.hausanweisung || ``,
    // E-248: „die digitale Assistentin" (KI-Offenlegung) — dieselbe Mara wie im Postfach und auf WhatsApp.
    `Du bist ${ein.name}, die digitale Assistentin von FIAON, und betreust Kunden. Du schreibst diesem Menschen VON DIR AUS eine persönliche E-Mail — er hat dir nicht geschrieben. Du hast seine Akte gelesen, seinen ganzen Weg bei uns und dein Gedächtnis zu ihm.`,
    `DEIN ZIEL: Er bezahlt jetzt die offene Rechnung, damit du seinen Account aktivieren kannst. Herzlich, mutmachend, menschlich — Aussicht ja („${AUSSICHT_SAETZE[0]}"), Zusage nie; nie drängelnd, nie drohend, nie belehrend.`,
    ``,
    // E-248: „Rahmen" statt „Limit" (TON_REGELN) — Justins Beispiel sinngemäß, ohne das Wort.
    // E-265 (29.09.2026, Justin: „VIEL MEHR AUF DIE KREDITKARTEN!"): die Karte vorn, das Wunschlimit mit dem Satz über
    // die Bank, der Termin mit Herrn/Frau Nachname — „Termin" stand in 0 von 368 Mails.
    // E-265 Nachbesserung: kein „fehlt mir nur noch" (naehe_druck); der Termin mit dem, der WIRKLICH anruft (E-260).
    `SO KLINGT ES (Justins Beispiel — nur der Ton, nie wörtlich übernehmen): „hier ist Mara Lindner, die digitale Assistentin von FIAON. Ich schreibe Ihnen, weil Sie bei uns zu Ihrer eigenen Visa-Kreditkarte kommen — mit Ihrem Wunschlimit von 25.000 € als Ziel, über den Rahmen entscheidet unsere Partnerbank. Der nächste Schritt ist Ihre erste Monatsrate. Sobald Ihre Zahlung gebucht ist, schaltet das System Sie frei, und ich vereinbare Ihren Termin mit ${terminMit.dat} — antworten Sie mir einfach mit einer Zeit, die Ihnen passt. Ich würde mich freuen! Ansonsten wünsche ich Ihnen einen schönen Tag und viel Gesundheit."`,
    ``,
    personaText("mail", { betreuer: ein.betreuer, vertretung: ein.vertretung ?? null }),
    ``,
    `LAGE: ${k.stufe === "A" ? `Stufe A — er hat am ${tagDe(k.ereignisAm)} gemeldet, dass er überwiesen hat; das Geld ist bei uns noch nicht zugeordnet.` : `Stufe B — sein Antrag ist seit dem ${tagDe(k.ereignisAm)} fertig, die Rechnung ist offen.`}`,
    `DIESE MAIL ist deine ${k.schritt}. an ihn. ${thema(k.stufe, k.schritt)}`,
    ``,
    `FAKTEN — nur diese Zahlen, Daten und Namen verwenden:`,
    `· Paket: ${k.paket ?? "unbekannt"}`,
    `· Offene Rechnung: ${eur(k.betragEuro) ?? "Betrag steht auf der Zahlungsseite"}${ein.faelligAm ? `, fällig am ${ein.faelligAm}` : ""}`,
    `· Verwendungszweck: ${k.zahlungsreferenz ?? "steht auf der Zahlungsseite"}`,
    // E-265: „Wunschlimit" darf stehen — genannt, nie zugesagt, immer mit dem Satz über die Bank (limit_ohne_bank, hart).
    `· Sein Wunschlimit (aus dem Antrag, auf den Rahmen seines Pakets begrenzt): ${ein.kartenziel ? `${kartenzielText(ein.kartenziel)} — so darfst du es nennen, immer mit „${BANK_SATZ}" im selben Satz; nie „Sie bekommen …", nie „Limit" allein` : "keins angegeben — dann sprich von seinem Ziel, seiner Visa-Kreditkarte, ohne Zahl"}`,
    `· Persönlicher Betreuer (so nennst du ihn — mit Herr/Frau, nie mit Vornamen): ${ein.betreuer ?? "wird nach der Aktivierung zugeteilt"}`,
    ...(ein.vertretung ? [`· Bis ${ein.vertretung.bis} ist das Team nicht im Haus — Anruf und Termin übernimmt ${ein.vertretung.name} (mit: ${ein.vertretung.dat}). Den Termin bietest du mit ${ein.vertretung.dat} an; ${ein.betreuer ?? "sein Betreuer"} macht danach weiter.`] : []),
    `· Tageszeit jetzt: ${tageszeit()}`,
    ``,
    `REGELN:`,
    fremd ? `· Sprache: Er schreibt uns auf ${ein.sprache} — du schreibst vollständig in dieser Sprache, in der höflichen Anredeform.` : `· Deutsch, Sie-Form.`,
    `· 4 bis 7 Sätze in 2 bis 3 kurzen Absätzen (Absätze durch eine Leerzeile). Ein Gedanke pro Satz, höchstens 20 Wörter.`,
    `· KEINE Anrede-Zeile, KEINE Grußformel, KEINE Unterschrift, KEINE Adresse (URL), KEINE Bankdaten — Anrede, Knopf „Rechnung ansehen und bezahlen" und Gruß setzt der Server. Sprich vom „Knopf unten" oder der „Zahlungsseite".`,
    ein.emojis ? `· Höchstens ein freundliches 🙂, sonst keine Emojis.` : `· Keine Emojis.`,
    // E-248: Kein „FIAON vergibt keine Kredite" mehr als Pflichtsatz — ein Nein, nach dem niemand gefragt hat.
    `· Nichts garantieren, nicht beraten, nie „ich empfehle", keine feste Frist, keine Zusage außer: Sobald die Zahlung da ist, aktivierst du den Account. Keine Rückzahlung zusagen. Hat er nach einem Kredit gefragt (Gedächtnis, Weg): nie mit einem Nein anfangen — seine eigene Kreditkarte ist das Bessere.`,
    `· Karten-Sätze nur sinngemäß so: „${KARTE_LINK_SATZ}" / „${KARTE_ZEIT_SATZ}" — „in der Regel", „nach der Zusage der Bank" und „meist" bleiben immer drin.`,
    `· Das Wunschlimit ist ein Ziel („als Ziel", „darauf arbeiten wir hin"), nie eine Zusage; über den Rahmen entscheidet unsere Partnerbank.`,
    `· Die Visa-Kreditkarte steht vorn (das Wort „Kreditkarte" gehört in jede Mail), und am Ende bietest du den Termin mit ${terminMit.dat} an („antworten Sie mir einfach mit einer Zeit, die Ihnen passt").`,
    `· Kein Nähe-Versprechen: nie „fehlt nur noch", „nur noch einen Schritt", „greifbar" — sag den nächsten Schritt.`,
    `· Keine internen Wörter (Akte, Status, Stufe, Aktion, System, Lead).`,
    `· Nutze, was du über ihn weißt: ein Telefonat, eine Zusage, eine frühere Mail, sein Ziel. Er soll merken, dass hier ein Mensch schreibt, der ihn kennt. Erfinde nichts.`,
    `· Wiederhole NIE Sätze aus deinen bisherigen Mails an ihn (unten) — jede Mail bringt einen neuen Gedanken.`,
    `· Schließ mit einem warmen, persönlichen Wunsch zur Tageszeit (${tageszeit()}).`,
    `· Betreff: 3 bis 8 Wörter, persönlich, ruhig — z. B. „Ihr nächster Schritt zur Karte", „Kurz zu Ihrer Karte" — ohne Ausrufezeichen, ohne Großbuchstaben-Wörter, ohne Emoji.`,
    ``,
    `DEIN GEDÄCHTNIS ZU IHM:`,
    ein.gedaechtnis,
    ``,
    `DEINE BISHERIGEN MAILS AN IHN (${ein.bisher.length}):`,
    ein.bisher.length ? ein.bisher.map((b) => `[${b.am}] „${b.betreff}": ${b.text}`).join("\n\n") : "(noch keine — das ist deine erste)",
    ``,
    `DIE AKTE:`,
    JSON.stringify(akteKompakt(ein.akte), null, 1).slice(0, 7_000),
    ``,
    `SEIN WEG BEI UNS (älteste zuerst):`,
    ein.weg,
  ].filter((z) => z !== null && z !== undefined).join("\n");
}

/**
 * Höchstens drei Absätze. Das Modell setzt gern jeden Satz in einen eigenen
 * Absatz — in der Mail wird daraus eine Liste statt eines Briefs (gesehen bei
 * der ersten Probe am 21.09.2026). Aufeinanderfolgende Absätze werden gebündelt.
 */
export function absaetzeFassen(text: string, hoechstens = 3): string {
  const teile = String(text || "").split(/\n\s*\n/).map((t) => t.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean);
  if (teile.length <= hoechstens) return teile.join("\n\n");
  const je = Math.ceil(teile.length / hoechstens);
  const aus: string[] = [];
  for (let i = 0; i < teile.length; i += je) aus.push(teile.slice(i, i + je).join(" "));
  return aus.join("\n\n");
}

/**
 * Die Nachprüfung — was hier hängen bleibt, geht nicht raus.
 * E-248: dazu Maras Ton (shared/fiaon-mara-ton.ts, nur harte Treffer: „Limit",
 * ISO-Datum, Rückfallsätze, „SCHUFA" nach Österreich/Schweiz) und jeder nackte
 * fiaon.com-Link (die URL im Text ist ohnehin verboten; der Knopf trägt seine
 * Zahlungsseite). `land` = Land des Kunden (AT/CH: kein „SCHUFA").
 */
export function aktionPruefen(betreff: string, text: string, opt: {
  land?: string | null;
  /** E-265 (29.09.2026): die Mitarbeiterliste — ein Vorname allein ist ein Mangel (#1388 „Florentine hat …"). */
  mitarbeiter?: readonly MitarbeiterEintrag[] | null;
  /** E-265: seine Namen — sein eigener Vorname ist kein Mitarbeiter. */
  kundeNamen?: readonly (string | null | undefined)[];
} = {}): string[] {
  const maengel: string[] = [];
  const land = String(opt.land || "").toUpperCase();
  for (const b of tonPruefung(`${betreff}\n${text}`, { kanal: "mail", land: land === "AT" || land === "CH" ? land as any : null, mitarbeiter: opt.mitarbeiter ?? null, kundeNamen: opt.kundeNamen })) {
    if (b.schwere === "hart") maengel.push(`Ton: „${b.treffer}" — ${b.hinweis}`);
  }
  // E-265 (29.09.2026, Justin: „VIEL MEHR AUF DIE KREDITKARTEN!"): „Kreditkarte" stand in 1 von 368 Mails.
  if (!/kreditkarte/i.test(text)) maengel.push("Die Visa-Kreditkarte kommt nicht vor — sie ist das, wofür er zahlt, und steht vorn");
  for (const b of linkPruefung(text)) if (b.schwere === "hart") maengel.push(`Link: ${b.link} — ${b.hinweis}`);
  for (const t of wandPruefen(`${betreff}\n${text}`)) {
    if (t.art === "verboten" || t.art === "zusage") maengel.push(`${t.art === "zusage" ? "Ungedeckte Zusage" : "Verboten"}: „${t.treffer}" — ${t.hinweis}`);
  }
  if (/https?:\/\/|www\.|\.com\//i.test(text)) maengel.push("Adresse (URL) im Text");
  if (/(^|[\s„"(])(du|dich|dir|dein|deine|deinen|deinem|deiner|euch|euer)(?=[\s.,;:!?)"“]|$)/.test(text)) maengel.push("Du-Form statt Sie-Form");
  if (!/(rechnung|zahlung|überweis|bezahl|begleich|beleg)/i.test(text)) maengel.push("Die offene Rechnung kommt nicht vor");
  if (text.length < 200) maengel.push("zu kurz");
  if (text.length > 1600) maengel.push("zu lang (höchstens sieben Sätze)");
  if (!betreff.trim() || betreff.length > 90) maengel.push("Betreff fehlt oder ist zu lang");
  if (/!/.test(betreff)) maengel.push("Ausrufezeichen im Betreff");
  if (/\b(sehr geehrte|mit freundlichen grüßen|herzliche grüße|liebe grüße)\b/i.test(text)) maengel.push("Anrede oder Gruß im Text — die setzt der Server");
  return maengel;
}

export interface Entwurf {
  ok: boolean; grund: string | null;
  betreff: string; text: string; html: string; kern: string;
  kostenCents: number; maengel: string[];
  /** Der VOLLSTÄNDIGE Auftragstext, mit dem sie geschrieben hat (Steuerpult, Trockenlauf). */
  auftrag?: string;
  /** Was sie wusste, kurz — landet als Denkprotokoll an der Mail. */
  wissen?: Record<string, unknown>;
}

/** Eine Mail für einen Kandidaten schreiben — ohne sie zu senden (auch für die Probe im Steuerpult). */
export async function mailSchreiben(k: Kandidat, ein: AktionEinstellungen): Promise<Entwurf> {
  const leer: Entwurf = { ok: false, grund: null, betreff: "", text: "", html: "", kern: "", kostenCents: 0, maengel: [] };
  const [akte, weg, gedaechtnis, namen, hausanweisung] = await Promise.all([
    akteLesen(k.personId, k.ref),
    kundenwegLesen(k.personId, k.ref, { maxZeichen: 9_000 }).catch(() => null),
    gedaechtnisText(k.personId).catch(() => "(noch nichts gemerkt)"),
    agentNamen(),
    import("./fiaon-mara-anweisung").then((m) => m.anweisungBlock("aktion")).catch(() => ""),
  ]);
  const bisher = (await sqlPool`
    SELECT gesendet_am, betreff, text FROM fiaon_mara_aktion
     WHERE person_id = ${k.personId} AND status = 'gesendet' ORDER BY gesendet_am DESC LIMIT 4`) as any[];
  const [z] = k.zahlungsreferenz
    ? (await sqlPool`SELECT payment_due_date FROM fiaon_applications WHERE ref = ${k.ref} LIMIT 1`) as any[]
    : [null];
  const faelligAm = z?.payment_due_date ? tagDe(new Date(z.payment_due_date).toISOString()) : null;
  const sprache = String((akte as any)?.person?.sprache || (akte as any)?.sprache || "de");

  // E-265: sein Kartenziel — dieselbe Regel wie WhatsApp und Postfach (kartenZiel, PACK_LIMITS).
  const kartenziel = k.wunschlimit ? kartenZiel({
    wunschEuro: k.wunschlimit, paketKey: k.paketKey ?? null,
    rahmenEuro: k.paketKey ? (await import("../routes/fiaon-antrag")).PACK_LIMITS[String(k.paketKey).toLowerCase()] ?? null : null,
  }) : null;
  // E-265 Nachbesserung (29.09.2026, Regel 5 / E-260): Ist das Team abwesend, bietet die Aktionsmail den Termin mit
  // dem Vertreter an (wie Postfach und WhatsApp) — vorher „ich vereinbare Ihren Termin mit Herrn Stripling", während
  // Herr Stripling bis Fr 02.10. nicht im Haus ist (405 Aktionsmails in 24 Stunden).
  const vertretung = await (async () => {
    const abw = await import("./fiaon-abwesenheit");
    const vt = await abw.vertretungFuerPerson(k.personId).catch(() => null);
    return vt ? { name: vt.ab.vertreter.anrufName, dat: vt.ab.vertreter.anrufDat, bis: abw.bisText(vt.ab.bis) } : null;
  })().catch(() => null);
  const auftrag = aktionsPrompt({
      kartenziel,
      vertretung,
      hausanweisung,
      name: namen.voll, k, akte, weg: weg?.text ?? "(kein Verlauf)", gedaechtnis,
      betreuer: weg?.zustaendig?.kundenName ?? null, faelligAm,
      bisher: bisher.reverse().map((b) => ({ am: tagDe(new Date(b.gesendet_am).toISOString()) ?? "", betreff: String(b.betreff || ""), text: String(b.text || "").slice(0, 900) })),
      emojis: ein.emojis, sprache,
  });
  // Was sie wusste, in einem Satz je Punkt — das Denkprotokoll hängt später an
  // der Mail, damit jede Zeile nachvollziehbar bleibt (Justin, 22.09.2026).
  const wissen = {
    stufe: k.stufe, schritt: k.schritt,
    betreuer: weg?.zustaendig?.kundenName ?? null,
    faelligAm, paket: (akte as any)?.vertrag?.paket ?? null,
    offeneRate: (akte as any)?.zahlung?.offeneRate ?? null,
    gedaechtnis: String(gedaechtnis || "").slice(0, 400),
    fruehereMails: bisher.length,
    hausanweisung: hausanweisung ? "ja" : "nein",
    auftragZeichen: 0,
  };
  const nachrichten: any[] = [
    { role: "system", content: auftrag },
    { role: "user", content: "Schreibe jetzt die Mail im vorgegebenen Format." },
  ];
  wissen.auftragZeichen = auftrag.length;

  let kosten = 0;
  const rufen = async (extra?: string) => {
    const j = await kiAufruf({
      dienst: DIENST, modell: MODELL(), aufwand: "low", maxTokens: 3500, schema: SCHEMA,
      nachrichten: extra ? [...nachrichten, { role: "user", content: extra }] : nachrichten,
    });
    kosten += kostenCentsAus(MODELL(), j?.usage);
    return antwortLesen(j, "Mara-Aktion");
  };

  let roh: any;
  // E-246: Die KI-Pause geht nach oben durch — der Lauf bricht ab, ohne „abgelehnt" (keine 24 h Ruhe).
  try { roh = await rufen(); } catch (e: any) { if (istKiPause(e)) throw e; return { ...leer, grund: `Modell: ${String(e?.message || e).slice(0, 160)}` }; }
  const saeubern = (t: string) => (ein.emojis ? String(t || "") : ohneEmojis(String(t || ""))).trim();
  let betreff = saeubern(roh?.betreff).replace(/[!]+/g, "").slice(0, 90);
  let text = saeubern(roh?.text);
  // E-248: Land des Kunden — in Österreich und der Schweiz nie „SCHUFA".
  const land = (akte as any)?.auskunft?.land ?? (akte as any)?.vertrag?.land ?? null;
  const landKurz = /^(at|österreich|oesterreich|austria)$/i.test(String(land || "").trim()) ? "AT" : /^(ch|schweiz|switzerland)$/i.test(String(land || "").trim()) ? "CH" : null;
  // E-265: mit der Mitarbeiterliste (Vorname allein = Mangel) und seinen Namen (sein Vorname ist keiner).
  const mitarbeiter = await (await import("./fiaon-mitarbeiter-namen")).mitarbeiterListe().catch(() => []);
  const kundeNamen = [k.vorname, k.nachname, [k.vorname, k.nachname].filter(Boolean).join(" ")].filter(Boolean) as string[];
  let maengel = aktionPruefen(betreff, text, { land: landKurz, mitarbeiter, kundeNamen });
  if (maengel.length) {
    try {
      const neu = await rufen(`Deine Mail hat diese Mängel:\n${maengel.map((m) => `· ${m}`).join("\n")}\n\nSchreib sie neu — derselbe Inhalt, ohne die Mängel. Nichts erfinden.`);
      const b2 = saeubern(neu?.betreff).replace(/[!]+/g, "").slice(0, 90);
      const t2 = saeubern(neu?.text);
      const m2 = aktionPruefen(b2, t2, { land: landKurz, mitarbeiter, kundeNamen });
      if (m2.length < maengel.length) { betreff = b2; text = t2; maengel = m2; }
    } catch (e) { if (istKiPause(e)) throw e; /* sonst bleibt es beim ersten Versuch */ }
  }
  if (maengel.length) return { ...leer, betreff, kern: text, maengel, auftrag, wissen, grund: `Prüfung: ${maengel.slice(0, 2).join("; ")}` };

  // Zusammensetzen wie jede Mara-Mail: Anrede · Kern · Knopf · Gruß.
  const anrede = await anredeBestimmen(k.personId, k.vorname, k.nachname, sprache);
  const url = absoluteUrl(`/zahlung/${k.zahlungsreferenz || k.ref}`);
  const gruss = `${grussMitAgent(postfachGruss(ein.postfach), namen.voll)}\n\nMöchten Sie keine Nachrichten mehr von mir, genügt eine kurze Antwort mit „Stopp“.`;
  text = absaetzeFassen(text);
  const fertig = antwortBauen({
    anrede: anrede.zeile, kern: text, gruss, betreff,
    schritt: { art: "zahlung" as any, url, text: "Rechnung ansehen und bezahlen" },
    sprache, agentName: namen.voll,
  });
  return { ok: true, grund: null, betreff, text: fertig.text, html: fertig.html, kern: text, kostenCents: kosten, maengel: [], auftrag, wissen };
}

// ── Der Lauf ──────────────────────────────────────────────────────────────
let laeuft = false;

/** Wie viele heute und in der letzten Stunde raus sind — und was der Takt heute erlaubt. */
export async function aktionZaehler(ein?: AktionEinstellungen): Promise<{
  letzteStunde: number; heute: number; tagesDeckel: number; kostenHeuteEuro: number;
}> {
  await aktionTabellen();
  const e = ein ?? await einstellungenLesen();
  const [z] = (await sqlPool`
    SELECT COUNT(*) FILTER (WHERE gesendet_am > NOW() - INTERVAL '1 hour')::int AS stunde,
           COUNT(*) FILTER (WHERE gesendet_am > date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin')::int AS heute
      FROM fiaon_mara_aktion WHERE status = 'gesendet' AND gesendet_am > NOW() - INTERVAL '2 days'`) as any[];
  // Kein Anlauf mehr (22.09.2026): der Tag ist genau 24 Stunden Takt.
  const tagesDeckel = e.jeStunde * 24;
  return { letzteStunde: Number(z?.stunde || 0), heute: Number(z?.heute || 0), tagesDeckel, kostenHeuteEuro: await kostenHeute(DIENST).catch(() => 0) };
}

/**
 * Ein Durchgang (alle 10 Minuten): so viele Mails, wie Takt und Kostendeckel
 * erlauben — heißeste zuerst, eine nach der anderen.
 */
export async function maraAktionLauf(): Promise<{ gesendet: number; abgelehnt: number; fehler: number; grund?: string }> {
  if (laeuft) return { gesendet: 0, abgelehnt: 0, fehler: 0, grund: "läuft schon" };
  laeuft = true;
  try {
    await aktionTabellen();
    const e = await einstellungenLesen();
    if (!e.an) return { gesendet: 0, abgelehnt: 0, fehler: 0, grund: "aus" };
    if (await kiPausiert()) return { gesendet: 0, abgelehnt: 0, fehler: 0, grund: "KI pausiert" }; // E-246
    const z = await aktionZaehler(e);
    if (z.kostenHeuteEuro >= e.tagEuro) return { gesendet: 0, abgelehnt: 0, fehler: 0, grund: `Kostendeckel (${z.kostenHeuteEuro.toFixed(2)} € von ${e.tagEuro} €)` };
    // Der Durchgang läuft alle 10 Minuten — je Durchgang also ein Sechstel der Stunde.
    const stundenRate = e.jeStunde;
    const erlaubt = Math.max(0, Math.min(Math.ceil(stundenRate / 6), stundenRate - z.letzteStunde, z.tagesDeckel - z.heute));
    if (!erlaubt) return { gesendet: 0, abgelehnt: 0, fehler: 0, grund: "Takt erfüllt" };
    const kandidaten = await kandidatenLaden(erlaubt * 2, e.stufen);
    const { neueMailSendenMitFaden } = await import("./fiaon-gmail");
    const { vonName } = { vonName: (await agentNamen()).voll };
    let gesendet = 0, abgelehnt = 0, fehler = 0;
    let pausiert = false;
    for (const k of kandidaten) {
      if (gesendet >= erlaubt) break;
      if ((await kostenHeute(DIENST).catch(() => 0)) >= e.tagEuro) break;
      // ── E-240: DIE SPERRE DIREKT VOR DEM SCHREIBEN ─────────────────────────
      // Diese Mails gehen über Gmail, nicht durch die Tür in make-webhook.ts —
      // die Schlange oben ist also die einzige Prüfung, und zwischen Schlange und
      // Versand vergehen Minuten (KI). Zweimal nachsehen: der Mensch (Werbesperre,
      // Vertriebssperre, Test) und die ADRESSE (eine Werbesperre an einer zweiten
      // Person oder im Lead-Formular mit derselben Adresse). Die Kündigung prüft
      // die Schlange (mit Zeitpunkt: wer danach neu beantragt, bleibt drin).
      // E-253 (28.09.2026): der MENSCH (menschSperre) — Werbesperre auch an einer Dublette, Vertriebssperre nur am Kopf.
      const ps = await menschSperre(k.personId).catch(() => null);
      const sperre = (ps ? werbungVerboten({ ...ps, gekuendigt: false, vertragVorbei: false }) : null)
        ?? ((await werbesperreAnAdresse(k.email).catch(() => false)) ? "Werbesperre an dieser Adresse" : null);
      if (sperre) {
        abgelehnt++;
        await sqlPool`INSERT INTO fiaon_mara_aktion (person_id, ref, stufe, schritt, status, grund, empfaenger, postfach)
          VALUES (${k.personId}, ${k.ref}, ${k.stufe}, ${k.schritt}, 'abgelehnt', ${`Sperre: ${sperre}`}, ${k.email}, ${e.postfach})`.catch(() => {});
        continue;
      }
      let m: Entwurf;
      try {
        m = await mailSchreiben(k, e);
      } catch (err: any) {
        // E-246: KI pausiert (oder gerade pausiert worden) — Durchgang beenden, KEINE Zeile:
        // „abgelehnt" hieße 24 h Ruhe für diesen Menschen und eine falsche Zahl im Steuerpult.
        if (istKiPause(err)) { pausiert = true; break; }
        m = { ok: false, grund: String(err?.message || err).slice(0, 200), betreff: "", text: "", html: "", kern: "", kostenCents: 0, maengel: [] };
      }
      if (!m.ok) {
        abgelehnt++;
        await sqlPool`INSERT INTO fiaon_mara_aktion (person_id, ref, stufe, schritt, status, grund, betreff, text, empfaenger, postfach, kosten_cents, pruefung)
          VALUES (${k.personId}, ${k.ref}, ${k.stufe}, ${k.schritt}, 'abgelehnt', ${m.grund}, ${m.betreff || null}, ${m.kern || null}, ${k.email}, ${e.postfach}, ${m.kostenCents}, ${sqlPool.json({ maengel: m.maengel, wissen: m.wissen ?? null } as any)})`.catch(() => {});
        continue;
      }
      try {
        const r = await neueMailSendenMitFaden(e.postfach, { vonName, an: k.email, betreff: m.betreff, text: m.text, html: m.html, abmelden: e.postfach });
        gesendet++;
        const kurz = m.kern.replace(/\s+/g, " ").slice(0, 300);
        await sqlPool`INSERT INTO fiaon_mara_aktion (person_id, ref, stufe, schritt, status, betreff, text, html, empfaenger, postfach, gmail_id, thread_id, kosten_cents, gesendet_am, pruefung)
          VALUES (${k.personId}, ${k.ref}, ${k.stufe}, ${k.schritt}, 'gesendet', ${m.betreff}, ${m.text}, ${m.html}, ${k.email}, ${e.postfach}, ${r.id}, ${r.threadId}, ${m.kostenCents}, NOW(),
                  ${sqlPool.json({ wissen: m.wissen ?? null, maengel: m.maengel ?? [] } as any)})`;
        await sqlPool`INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, betreff, art, ausgeloest_von)
          VALUES ('mara_aktion', ${k.personId}, ${k.email}, 'gesendet', ${m.betreff}, 'echt', 'Mara (Aktion)')`.catch(() => {});
        await sqlPool`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
          VALUES (${k.ref}, ${k.personId}, NULL, ${vonName}, 'system', ${`Mara hat geschrieben (Aktion, Stufe ${k.stufe}, Mail ${k.schritt}): „${m.betreff}" — ${kurz}`})`.catch(() => {});
      } catch (err: any) {
        fehler++;
        await sqlPool`INSERT INTO fiaon_mara_aktion (person_id, ref, stufe, schritt, status, grund, betreff, text, empfaenger, postfach, kosten_cents)
          VALUES (${k.personId}, ${k.ref}, ${k.stufe}, ${k.schritt}, 'fehler', ${String(err?.message || err).slice(0, 300)}, ${m.betreff}, ${m.text}, ${k.email}, ${e.postfach}, ${m.kostenCents})`.catch(() => {});
        // Ein Versandfehler (Gmail-Grenze, Sperre) stoppt den Durchgang — nicht 20-mal gegen dieselbe Wand.
        break;
      }
    }
    if (gesendet || abgelehnt || fehler) console.log(`[MARA-AKTION] ${gesendet} gesendet, ${abgelehnt} abgelehnt, ${fehler} Fehler (Kandidaten ${kandidaten.length}, erlaubt ${erlaubt})`);
    if (pausiert) return { gesendet, abgelehnt, fehler, grund: "KI pausiert" };
    return { gesendet, abgelehnt, fehler };
  } finally {
    laeuft = false;
  }
}
