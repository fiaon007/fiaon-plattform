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
//
// ── E-276 (02.10.2026): DIE AKTION VERKAUFT SELBST — WIE POSTFACH UND WHATSAPP (E-275) ──
// Justin: „ja, bau die Mara-Aktion genauso um“ — nach E-275 („Mara soll selbst verkaufen …
// eher übermotiviert! … ‚Zahlen Sie die Aktivierung … Ihr Account ist sofort nach Eingang
// aktiv!‘“). Bis heute endete jede Aktionsmail mit Justins altem Beispiel „… und ich
// vereinbare Ihren Termin mit … — antworten Sie mir einfach mit einer Zeit“ (Mail 1719–1723
// am 01./02.10.: „Nikita Boychenko kann das danach mit Ihnen durchgehen; antworten Sie mir
// einfach mit einer Zeit“). Seitdem:
// · Stufe B (Antrag fertig, nicht bezahlt): die Karte vorn, dann die klare Aufforderung mit
//   dem Nutzen — „Zahlen Sie jetzt die Aktivierung, Ihre erste Monatsrate über 99,99 € — mit
//   Ihrem Verwendungszweck FIAON-… ist Ihr Account sofort nach Eingang aktiv, und Sie bekommen
//   direkt den fertigen Link unserer Partnerbank für Ihren Kartenantrag!“, das Tempo, der
//   Knopf. Fehlt im Antrag noch etwas (Akte, karte.fehlendeAngaben), nie „direkt der Link“
//   (mitAntragLuecke). Die Bausteine kommen aus shared/fiaon-mara-ton.ts (bausteinAbschluss),
//   nichts ist hier neu formuliert.
// · Stufe A (Zahlung gemeldet, nicht gebucht): Dank, Hilfe (Beleg als Antwort, sein
//   Verwendungszweck hinter dem Knopf „Verwendungszweck und Zahlungsdaten ansehen“), „Sobald wir
//   Ihre Zahlung zugeordnet haben, ist Ihr Account sofort aktiv …“ — NIE eine erneute
//   Zahlungsaufforderung (harte Prüfung).
// · Kein Termin als Ziel, kein „Herr X meldet sich/prüft“, kein „wir sind keine Bank“, kein
//   „wir versenden Ihre Karte“, höchstens ein „!“ — dieselben Prüfungen wie E-275
//   (tonPruefung weich, selbstErledigtTreffer), hier als zweiter Entwurf.
// · Kein Wort an jemanden, dessen Geld womöglich schon ungebucht im Bankbuch liegt (eingangOffenSql,
//   unscharf und lieber einer zu viel): Gemessen 02.10.: 37 Eingänge (2.328 €) ungebucht, meist
//   mit verkürztem Verwendungszweck — Frau H. (FIAON-MADJ3S) bekam am 01.10. die Aktionsmail und
//   zahlte am 02.10. mit „Fisimatenten-MADJ3S“.
// · Die einmalige RUNDE (mara_aktion_runde_seit), Justin 02.10. ~19:15: „ALLE Mails dafür
//   müssen noch heute raus gehen, wirklich alle die eine Zahlung offen haben (nicht die
//   gesperrten) ohne Ausnahme!“ — siehe kandidatenLaden und maraAktionLauf.
// · Unverändert: alle Wände (Werbesperre, Stopp, Vertriebssperre, Test, Global-Kunde E-272,
//   fiaon_mara_ausschluss, Kartei-Storno, Einwand, Kündigung, Zustellung), Takt, Deckel,
//   Stufen, Tagesbudget, Wortwand, Nachnamen der Mitarbeiter.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { wandPruefen } from "@shared/fiaon-wortverbote";
import { KARTE_ZEIT_SATZ } from "@shared/fiaon-karten-weg";
import { paketPreisCents } from "@shared/fiaon-pakete";
import { ohneEmojis } from "@shared/fiaon-telefonkartei";
import { akteLesen } from "./fiaon-postmeister-dossier";
import { kundenwegLesen } from "./fiaon-kundenweg";
import { gedaechtnisText } from "./fiaon-mara-gedaechtnis";
import { kiAufruf, antwortLesen, akteKompakt, MODELL, agentNamen, fordertZahlung } from "./fiaon-postmeister-agent";
import { kiPausiert, istKiPause } from "./fiaon-ki-pause";
import { maraGruppe } from "./fiaon-ki-claude";
import { anredeBestimmen, antwortBauen, grussMitAgent } from "./fiaon-postmeister-antworttext";
import { postfachGruss } from "./fiaon-postmeister-postfaecher";
import { kostenHeute, kostenCentsAus } from "./fiaon-postmeister-schema";
import { absoluteUrl } from "../fiaon-base-url";
import { menschSperre, werbesperreAnAdresse, werbungVerboten } from "./fiaon-mail-frequenz";
// E-248: Maras Stimme aus EINER Quelle — dieselbe Persona wie im Postfach und auf WhatsApp.
import { personaText, tonPruefung, linkPruefung, AUSSICHT_SAETZE, kartenZiel, kartenzielText, BANK_SATZ, type KartenZiel,
  // E-276 (02.10.2026): dieselben Bausteine wie Postfach und WhatsApp (E-275) — Abschluss, Aufforderung, Lücke, Prüfungen.
  bausteinAbschluss, mitAntragLuecke, nachDemEingang, nachDerZuordnung, AKTIVIERUNG_AUFRUF, TEMPO_SATZ, ZAHL_KNOPF_MAIL,
  selbstErledigtTreffer, ausrufezeichen,
} from "@shared/fiaon-mara-ton";
import type { MitarbeiterEintrag } from "@shared/fiaon-mitarbeiter-name";
import { abgeschicktSql } from "@shared/fiaon-antrag-stand";
import { globalKundeSql, globalKundeBereit, istGlobalKunde } from "./fiaon-global-kunde";
// E-276 (02.10.2026): der unscharfe Abgleich mit ungebuchten Eingängen — eine Quelle für Schlange und Senden.
import { eingangOffenSql, eingangOffenFuer } from "./fiaon-zahlung-unverbucht";

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
  /**
   * E-276 (02.10.2026): Beginn der laufenden RUNDE (ISO) — null, wenn keine läuft. Eine Runde gilt RUNDE_STUNDEN lang ab
   * diesem Zeitpunkt (rundeAktiv); `rundeEingestellt` ist der Wert, wie er in fiaon_settings steht.
   */
  rundeSeit: string | null;
  rundeEingestellt: string | null;
}
const VORGABE: Record<string, string> = {
  mara_aktion_an: "an",
  mara_aktion_je_stunde: "50",
  mara_aktion_tag_euro: "15",
  mara_aktion_stufen: "A,B",
  mara_aktion_emojis: "aus",
  mara_aktion_postfach: "support@fiaon.com",
  // E-276: leer = keine Runde. „jetzt“ setzt die Uhrzeit des Speicherns (einstellungSetzen).
  mara_aktion_runde_seit: "",
};
export const AKTION_SCHLUESSEL = Object.keys(VORGABE);

// ── E-276 (02.10.2026): DIE EINMALIGE RUNDE ───────────────────────────────
// Justin: „ALLE Mails dafür müssen noch heute raus gehen, wirklich alle die eine Zahlung
// offen haben (nicht die gesperrten) ohne Ausnahme!“ Gemessen 02.10. 19:20: ~654 Menschen
// mit offener erster Zahlung (A + B), die Aktion hatte an dem Tag 4 Mails geschickt — Takt
// (2/4/7/14 Tage) und Rücksicht (24 h nach dem Antrag, 7 Tage nach seiner Mail, 12 h nach
// einem Gespräch, 6 h nach einer anderen Mail, 24 h nach „abgelehnt“) hielten die übrigen.
// Mit mara_aktion_runde_seit = <Zeitpunkt> gilt RUNDE_STUNDEN lang: Jeder Mensch der
// Stufen A/B, der SEIT diesem Zeitpunkt noch keine Aktionsmail bekommen hat, ist fällig —
// ohne Takt und ohne Rücksichtsregeln, höchstens EINE Mail je Mensch ab Rundenstart. Nach
// einem Fehlversuch eine Stunde Ruhe, nach zwei Fehlversuchen ist er für die Runde fertig.
// ALLE Wände bleiben (Werbesperre, Stopp, Vertriebssperre, Test, Global, Ausschluss,
// Kartei-Storno, Einwand, Kündigung, Zustellung, ungebuchter Eingang, Gmail-Tür). Danach
// (oder mit leerem Wert) gelten die alten Regeln von selbst — eine vergessene Runde legt
// den Takt nicht dauerhaft still.
export const RUNDE_STUNDEN = 24;

/** Die laufende Runde als ISO-Zeit — null ohne Wert, mit unlesbarem Wert, in der Zukunft oder nach RUNDE_STUNDEN. Rein. */
export function rundeAktiv(wert: string | null | undefined, jetzt: number = Date.now()): string | null {
  const t = Date.parse(String(wert ?? "").trim());
  if (!Number.isFinite(t) || t > jetzt + 60_000 || jetzt - t > RUNDE_STUNDEN * 3_600_000) return null;
  return new Date(t).toISOString();
}

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
    // E-276: die Runde — gilt nur RUNDE_STUNDEN lang ab dem eingetragenen Zeitpunkt.
    rundeSeit: rundeAktiv(w("mara_aktion_runde_seit")),
    rundeEingestellt: w("mara_aktion_runde_seit") || null,
  };
}

export async function einstellungSetzen(schluessel: string, wert: string): Promise<void> {
  if (!AKTION_SCHLUESSEL.includes(schluessel)) throw new Error("Unbekannte Einstellung.");
  // E-276 (02.10.2026): die Runde — „jetzt“ (oder „an“) setzt den Zeitpunkt des Speicherns, „aus“/leer beendet sie,
  // sonst eine lesbare Zeit (ISO). Gespeichert wird immer ISO, damit die Abfrage sie als Zeitpunkt lesen kann.
  if (schluessel === "mara_aktion_runde_seit") {
    const w = String(wert ?? "").trim().toLowerCase();
    if (!w || w === "aus") wert = "";
    else if (w === "jetzt" || w === "an") wert = new Date().toISOString();
    else if (Number.isFinite(Date.parse(String(wert).trim()))) wert = new Date(Date.parse(String(wert).trim())).toISOString();
    else throw new Error("Runde: „jetzt“, „aus“ oder eine Zeit (ISO, z. B. 2026-10-02T19:30:00+02:00).");
  }
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
  // E-276 (02.10.2026): EIN Anspruch je Mensch — „in_arbeit“ höchstens einmal. Zwei Durchgänge, die sich überlappen
  // (Neustart beim Deploy, Knopf „Durchgang“ im Steuerpult neben dem Takt), können ihm so nie zweimal schreiben.
  await sqlPool`CREATE UNIQUE INDEX IF NOT EXISTS fiaon_mara_aktion_in_arbeit_uidx ON fiaon_mara_aktion (person_id) WHERE status = 'in_arbeit'`;
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
 * E-276 (02.10.2026): `rundeSeit` — ohne Angabe liest die Schlange die Einstellung selbst (dann zeigen Steuerpult und
 * Probe die Runde, ohne dass sie davon wissen müssen); null = ausdrücklich ohne Runde. `hoechstens` hebt die Grenze von 500
 * (nur zum Zählen der offenen Runde, rundeStand).
 */
export async function kandidatenLaden(grenze: number, stufen: string[], opt: { rundeSeit?: string | null; hoechstens?: number } = {}): Promise<Kandidat[]> {
  await aktionTabellen();
  if (!stufen.length || grenze <= 0) return [];
  await globalKundeBereit(); // E-272: die Schlange liest fiaon_global_angebote
  const status = stufen.map((s) => (s === "A" ? "claimed_paid" : "pending_payment"));
  const rundeSeit = opt.rundeSeit !== undefined ? rundeAktiv(opt.rundeSeit) : (await einstellungenLesen()).rundeSeit;
  const runde = !!rundeSeit;
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
    -- (E-276: „abgebrochen“ = ein Anspruch, den ein unterbrochener Durchgang liegen ließ — wie ein Fehler)
    ruhe AS (SELECT DISTINCT person_id FROM fiaon_mara_aktion WHERE status IN ('abgelehnt', 'fehler', 'abgebrochen') AND created_at > NOW() - INTERVAL '24 hours' AND person_id IS NOT NULL),
    -- E-276 (02.10.2026): Ein passender Eingang liegt UNGEBUCHT im Bankbuch (unscharf, lieber einer zu viel —
    -- fiaon-zahlung-unverbucht.ts). Wer womöglich schon gezahlt hat, bekommt nie „Zahlen Sie jetzt …“ und auch keine
    -- Erinnerung an seine Meldung: Er gehört gebucht, nicht angeschrieben.
    eingang AS (${sqlPool.unsafe(eingangOffenSql())}),
    -- E-276: gerade in Arbeit — ein anderer Durchgang schreibt ihm schon (Anspruch, maraAktionLauf)
    in_arbeit AS (SELECT DISTINCT person_id FROM fiaon_mara_aktion WHERE status = 'in_arbeit' AND person_id IS NOT NULL),
    -- E-276 RUNDE: schon geschrieben seit Rundenstart (höchstens EINE Mail je Mensch) …
    runde_raus AS (SELECT DISTINCT person_id FROM fiaon_mara_aktion
                    WHERE ${rundeSeit}::timestamptz IS NOT NULL AND status = 'gesendet' AND gesendet_am >= ${rundeSeit}::timestamptz AND person_id IS NOT NULL),
    -- … und nach einem Fehlversuch eine Stunde Ruhe, nach zwei Fehlversuchen für die Runde fertig
    runde_ruhe AS (SELECT person_id FROM fiaon_mara_aktion
                    WHERE ${rundeSeit}::timestamptz IS NOT NULL AND status IN ('abgelehnt', 'fehler', 'abgebrochen') AND created_at >= ${rundeSeit}::timestamptz AND person_id IS NOT NULL
                    GROUP BY person_id HAVING COUNT(*) >= 2 OR MAX(created_at) > NOW() - INTERVAL '1 hour'),
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
       -- E-272 (02.10.2026): kein GLOBAL-KUNDE. Wer ein Individualangebot oder einen Auftrag über
       -- FIAON Global hat und kein bezahltes Stufenpaket, bekommt keine Zahlungsmail zu einem
       -- alten Privatantrag (Fall Hildbrand, Person 13411). Justin: „nehme ihn bitte komplett aus
       -- den Workflows … Er soll Global bleiben, also keine unnötigen Mails“. Je Zeile der Schlange
       -- statt als Menge: Der Ausdruck läuft über den Personen-Index der Bestellungen, die Angebote
       -- liest Postgres einmal (Regel und Gründe: fiaon-global-kunde.ts).
       AND NOT ${sqlPool.unsafe(globalKundeSql("app.person_id"))}
       AND app.person_id NOT IN (SELECT person_id FROM ausgenommen)
       AND app.person_id NOT IN (SELECT person_id FROM storniert)
       AND app.person_id NOT IN (SELECT person_id FROM stopp)
       AND app.person_id NOT IN (SELECT person_id FROM einwand)
       AND LOWER(TRIM(COALESCE(NULLIF(TRIM(p.primary_email), ''), app.email))) NOT IN (SELECT adresse FROM gesperrte_adresse WHERE adresse IS NOT NULL)
       AND LOWER(COALESCE(NULLIF(TRIM(p.primary_email), ''), app.email)) NOT IN (SELECT adresse FROM kaputt)
       -- E-276: Wände, die auch in der Runde gelten — ungebuchter Eingang, gerade in Arbeit
       AND app.person_id NOT IN (SELECT person_id FROM eingang)
       AND app.person_id NOT IN (SELECT person_id FROM in_arbeit)
       -- ── TAKT UND RÜCKSICHT (ohne Runde) ──────────────────────────────────────
       AND (${runde}::boolean OR (
             app.person_id NOT IN (SELECT person_id FROM ruhe)
         AND app.person_id NOT IN (SELECT person_id FROM schrieb)
         AND app.person_id NOT IN (SELECT person_id FROM kontakt)
         AND app.person_id NOT IN (SELECT person_id FROM mail)
         -- erste Mail frühestens 24 h nach Antrag bzw. Zahlungsmeldung
         AND (CASE WHEN app.payment_status = 'claimed_paid' THEN COALESCE(app.claimed_paid_at, app.created_at) ELSE app.created_at END) < NOW() - INTERVAL '24 hours'
         -- Takt: 2, 4, 7, dann 14 Tage
         AND (l.am IS NULL OR l.am < NOW() - (CASE LEAST(l.n, 4) WHEN 1 THEN INTERVAL '2 days' WHEN 2 THEN INTERVAL '4 days' WHEN 3 THEN INTERVAL '7 days' ELSE INTERVAL '14 days' END))))
       -- ── E-276 RUNDE: statt Takt und Rücksicht — einmal je Mensch seit Rundenstart ──
       AND (NOT ${runde}::boolean OR (
             app.person_id NOT IN (SELECT person_id FROM runde_raus)
         AND app.person_id NOT IN (SELECT person_id FROM runde_ruhe)))
     ORDER BY (app.payment_status = 'claimed_paid') DESC,
              (CASE WHEN app.payment_status = 'claimed_paid' THEN COALESCE(app.claimed_paid_at, app.created_at) ELSE app.created_at END) DESC
     LIMIT ${Math.max(1, Math.min(opt.hoechstens ?? 500, grenze))}
  `) as any[];
  return zeilen.map((z) => ({
    personId: Number(z.person_id), ref: String(z.ref),
    stufe: z.payment_status === "claimed_paid" ? "A" : "B",
    schritt: Number(z.gesendet || 0) + 1,
    email: String(z.mail).trim(), vorname: z.vor ?? null, nachname: z.nach ?? null,
    paket: z.pack_name ?? null,
    paketKey: z.pack_key ?? null,
    // E-276 (02.10.2026): der Katalogpreis, wenn das Paket bekannt ist (E-181: amount_due ist Altlast) — gemessen am 02.10.
    // stimmen alle 1.173 offenen A/B-Bestellungen damit überein; die Regel hält es so.
    betragEuro: z.pack_key && paketPreisCents(String(z.pack_key)) > 0 ? paketPreisCents(String(z.pack_key)) / 100 : z.amount_due == null ? null : Number(z.amount_due),
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

/**
 * Worum es in welcher Mail geht — jede bringt einen neuen Gedanken.
 * E-276 (02.10.2026): ohne Termin. Stufe B verkauft die Aktivierung (Abschluss unten), Stufe A hilft bei der Zuordnung
 * und bittet NIE erneut um Zahlung — er hat schon überwiesen.
 */
function thema(stufe: "A" | "B", schritt: number): string {
  if (stufe === "A") {
    return [
      "Erste Mail: Stell dich kurz vor. Danke ihm herzlich, dass er seine Zahlung gemeldet hat. Sag freundlich, dass sie bei uns noch nicht zugeordnet ist — oft kommt der Verwendungszweck verkürzt an. Hilf selbst: Den Überweisungsbeleg schickt er dir einfach als Antwort; Verwendungszweck und Zahlungsdaten stehen hinter dem Knopf unten. Dann mit Freude, was die Zuordnung bringt (Abschluss).",
      "Zweite Mail: Kein Vorstellen. Nimm kurz Bezug auf deine letzte Mail. Die Zahlung ist noch nicht zugeordnet — bitte ihn um den Beleg (Datum, Betrag, Verwendungszweck) als Antwort; du kümmerst dich selbst darum. Dann, was die Zuordnung bringt (Abschluss).",
      "Dritte Mail: Konzentrier dich auf die Karte: Nach der Zuordnung kommt direkt der Link unserer Partnerbank, die Karte ist nach der Zusage der Bank in der Regel in 2–5 Werktagen da, meist vorher schon mit Apple Pay nutzbar. Bitte um den Beleg als Antwort.",
      "Weitere Mail: Persönlich und kurz. Nimm Bezug auf seine Lage (Gedächtnis, Weg). Frag, ob etwas unklar ist — eine kurze Antwort genügt, du klärst es selbst. Bitte um den Beleg als Antwort.",
    ][Math.min(schritt, 4) - 1];
  }
  return [
    // E-265 Nachbesserung (29.09.2026): kein „fehlt nur noch" (Nähe als Druck, fast eine Zusage — naehe_druck).
    "Erste Mail: Stell dich kurz vor. Sein Antrag liegt bei dir — jetzt aktiviert er mit seiner ersten Monatsrate seinen Account. Die Visa-Kreditkarte vorn (sein Wunschlimit als Ziel, über den Rahmen entscheidet die Bank), dann begeistert die klare Aufforderung mit dem Nutzen (Abschluss).",
    "Zweite Mail: Kein Vorstellen. Nimm kurz Bezug auf deine letzte Mail. Heute die Karte: was direkt nach dem Eingang passiert (Link unserer Partnerbank, nach der Zusage der Bank in der Regel 2–5 Werktage, Apple Pay meist vorher) — dann die Aufforderung (Abschluss).",
    "Dritte Mail: Wie einfach es ist: ein Klick auf den Knopf, dort stehen Betrag, Bankdaten, Verwendungszweck und ein QR-Code für die Banking-App — in zwei Minuten erledigt. Zögert er, antwortet er dir kurz, und du klärst es selbst. Dann die Aufforderung (Abschluss).",
    "Weitere Mail: Persönlich und kurz. Nimm Bezug auf seine Lage (Gedächtnis, Weg, was er bei der Bestellung wollte). Erinnere mit Freude an sein Ziel, seine Visa-Kreditkarte, und fordere ihn klar auf, die Aktivierung jetzt zu zahlen (Abschluss).",
  ][Math.min(schritt, 4) - 1];
}

// ── E-276 (02.10.2026): DER ABSCHLUSS DER AKTIONSMAIL — AUS DEN BAUSTEINEN VON POSTFACH UND WHATSAPP (E-275) ──
/** Stufe A: die Hilfe zur Zuordnung — Beleg als Antwort, Verwendungszweck hinter dem Knopf. Keine Zahlungsbitte. */
export const A_HILFE_SATZ = "Haben Sie Ihren Überweisungsbeleg zur Hand? Schicken Sie ihn mir einfach als Antwort auf diese Mail, dann ist Ihre Zahlung schneller zugeordnet — Ihren Verwendungszweck und die Zahlungsdaten finden Sie über den Knopf unten.";
/** Der Knopf der Stufe A — er führt auf dieselbe Zahlungsseite, fordert aber nicht zum Zahlen auf. */
export const A_KNOPF_TEXT = "Verwendungszweck und Zahlungsdaten ansehen";

/**
 * Justins Abschluss für diese Mail (E-275-Bausteine, kanal „mail“): B = Karte, „Zahlen Sie jetzt die Aktivierung, Ihre
 * erste Monatsrate über … — mit Ihrem Verwendungszweck … ist Ihr Account sofort nach Eingang aktiv, und Sie bekommen
 * direkt den fertigen Link …!“, Tempo, Zeit bis zur Karte, Knopf; A = Dank, „Sobald wir Ihre Zahlung … zugeordnet
 * haben …“, Zeit bis zur Karte, Hilfe. Fehlt im Antrag etwas, die Lücken-Fassung (mitAntragLuecke). Rein.
 */
export function aktionAbschluss(ein: {
  stufe: "A" | "B"; ziel?: KartenZiel | null; betrag?: string | null; verwendungszweck?: string | null; luecke?: readonly string[];
}): string {
  const luecke = ein.luecke ?? [];
  if (ein.stufe === "A") {
    return `${mitAntragLuecke(bausteinAbschluss({ kanal: "mail", art: "a", ziel: ein.ziel ?? null, betrag: ein.betrag ?? null }), luecke)}\n\n${A_HILFE_SATZ}`;
  }
  return mitAntragLuecke(bausteinAbschluss({ kanal: "mail", art: "b", ziel: ein.ziel ?? null, betrag: ein.betrag ?? null, verwendungszweck: ein.verwendungszweck ?? null }), luecke);
}

/** Der Wunsch zur Tageszeit — „Eine gute Nacht …“, sonst „Einen schönen Abend …“. Rein. */
export function wunschZurTageszeit(t: string): string {
  return t === "Nacht" ? "Eine gute Nacht wünsche ich Ihnen." : `Einen schönen ${t} wünsche ich Ihnen.`;
}

/**
 * Die ERSATZFASSUNG (nur Deutsch): Besteht auch der zweite Entwurf des Modells die Prüfung nicht, geht statt „abgelehnt“
 * diese Mail aus den freigegebenen Bausteinen raus — Justin: „wirklich alle … ohne Ausnahme!“. Sie enthält nichts, was
 * nicht in Postfach und WhatsApp schon freigegeben ist, und besteht aktionPruefen (Prüfstand pruef-mara-aktion). Rein.
 */
export function ersatzKern(ein: { stufe: "A" | "B"; name: string; abschluss: string; tageszeit: string; gemeldetAm?: string | null }): string {
  const vorstellen = `Hier ist ${ein.name}, die digitale Assistentin von FIAON.`;
  const lage = ein.stufe === "A"
    ? ` Sie haben uns${ein.gemeldetAm ? ` am ${ein.gemeldetAm}` : ""} gemeldet, dass Ihre Zahlung unterwegs ist — bei uns ist sie noch nicht zugeordnet, oft kommt der Verwendungszweck verkürzt an.`
    : ` Ihr Antrag liegt bei mir, und ich freue mich, Sie jetzt auf den Weg zu Ihrer Karte zu bringen.`;
  return `${vorstellen}${lage}\n\n${ein.abschluss}\n\n${wunschZurTageszeit(ein.tageszeit)}`;
}

/** Schreibt er uns nicht auf Deutsch? Dann keine Ersatzfassung und der Standard-Knopftext seiner Sprache. Rein. */
function fremdeSprache(sprache: string | null | undefined): boolean {
  return !!sprache && String(sprache).slice(0, 2).toLowerCase() !== "de";
}

function aktionsPrompt(ein: {
  name: string; k: Kandidat; akte: any; weg: string; gedaechtnis: string; betreuer: string | null;
  faelligAm: string | null; bisher: { am: string; betreff: string; text: string }[]; emojis: boolean; sprache: string;
  /** E-265: sein Kartenziel (wanted_limit, gedeckelt auf den Rahmen seines Pakets). */
  kartenziel?: KartenZiel | null;
  /** E-276: Justins Abschluss für ihn (aktionAbschluss) — die Kernsätze wörtlich. */
  abschluss: string;
  /** E-276: was im Antrag noch fehlt (Akte, karte.fehlendeAngaben) — leer, wenn er vollständig ist. */
  luecke: readonly string[];
  /** Justins eigene Anweisung (Steuerpult) — steht ganz oben und gewinnt im Zweifel. */
  hausanweisung?: string;
}): string {
  const { k } = ein;
  const a = k.stufe === "A";
  const fremd = ein.sprache && ein.sprache.slice(0, 2).toLowerCase() !== "de";
  return [
    ein.hausanweisung || ``,
    // E-248: „die digitale Assistentin" (KI-Offenlegung) — dieselbe Mara wie im Postfach und auf WhatsApp.
    `Du bist ${ein.name}, die digitale Assistentin von FIAON, und betreust Kunden. Du schreibst diesem Menschen VON DIR AUS eine persönliche E-Mail — er hat dir nicht geschrieben. Du hast seine Akte gelesen, seinen ganzen Weg bei uns und dein Gedächtnis zu ihm.`,
    // E-276 (02.10.2026, Justin: „ja, bau die Mara-Aktion genauso um“ — wie E-275: selbst verkaufen, eher übermotiviert, seriös).
    a
      ? `DEIN ZIEL: Seine gemeldete Zahlung wird zugeordnet, und er freut sich auf seine Karte. Du hilfst SELBST — Beleg als Antwort, Verwendungszweck hinter dem Knopf. Er hat schon überwiesen: KEINE Bitte um Zahlung, kein „zahlen/überweisen Sie“, kein „am besten heute“. Herzlich, zupackend, seriös — Aussicht ja („${AUSSICHT_SAETZE[0]}"), Zusage nie.`
      : `DEIN ZIEL: Er zahlt JETZT die Aktivierung — seine erste Monatsrate. Du verkaufst selbst: begeistert, eher übermotiviert, aber seriös (Sie-Form, kein Slang). Die klare Aufforderung „${AKTIVIERUNG_AUFRUF} …“ gehört in jede Mail, mit dem Nutzen direkt dahinter. Aussicht ja („${AUSSICHT_SAETZE[0]}"), Zusage nie; nie drohend, nie belehrend.`,
    ``,
    // E-276: Justins altes Beispiel endete mit „… und ich vereinbare Ihren Termin mit … — antworten Sie mir einfach mit einer
    // Zeit“ (Mail 1719–1723 am 01./02.10.). Jetzt der Abschluss aus denselben Bausteinen wie Postfach und WhatsApp.
    `SO SCHLIESST DU AB (Justin, 02.10.2026 — die Sätze mit Betrag, Verwendungszweck, „sofort“ und dem Link der Partnerbank WÖRTLICH, alles andere in eigenen Worten mit denselben Fakten): „${ein.abschluss}“`,
    a
      ? `SO KLINGT DER ANFANG (nur der Ton, nie wörtlich): „hier ist Mara Lindner, die digitale Assistentin von FIAON. Danke, dass Sie uns Ihre Überweisung gemeldet haben — bei uns ist sie noch nicht zugeordnet, oft kommt der Verwendungszweck verkürzt an.“`
      : `SO KLINGT DER ANFANG (nur der Ton, nie wörtlich): „hier ist Mara Lindner, die digitale Assistentin von FIAON. Ihr Antrag liegt bei mir, und ich freue mich, Sie jetzt auf den Weg zu Ihrer eigenen Visa-Kreditkarte zu bringen.“`,
    ``,
    personaText("mail", { betreuer: ein.betreuer, vertretung: null }),
    ``,
    `LAGE: ${a ? `Stufe A — er hat am ${tagDe(k.ereignisAm)} gemeldet, dass er überwiesen hat; das Geld ist bei uns noch nicht zugeordnet.` : `Stufe B — sein Antrag ist seit dem ${tagDe(k.ereignisAm)} abgeschickt, die Aktivierung (erste Monatsrate) ist offen.`}`,
    `DIESE MAIL ist deine ${k.schritt}. an ihn. ${thema(k.stufe, k.schritt)}`,
    ``,
    `FAKTEN — nur diese Zahlen, Daten und Namen verwenden:`,
    `· Paket: ${k.paket ?? "unbekannt"}`,
    `· ${a ? "Gemeldete Zahlung (erste Monatsrate)" : "Aktivierung = erste Monatsrate"}: ${eur(k.betragEuro) ?? "Betrag steht auf der Zahlungsseite"}${!a && ein.faelligAm ? `, fällig am ${ein.faelligAm}` : ""}`,
    `· Verwendungszweck: ${k.zahlungsreferenz ?? "steht auf der Zahlungsseite"}`,
    // E-265: „Wunschlimit" darf stehen — genannt, nie zugesagt, immer mit dem Satz über die Bank (limit_ohne_bank, hart).
    `· Sein Wunschlimit (aus dem Antrag, auf den Rahmen seines Pakets begrenzt): ${ein.kartenziel ? `${kartenzielText(ein.kartenziel)} — so darfst du es nennen, immer mit „${BANK_SATZ}" im selben Satz; nie „Sie bekommen …", nie „Limit" allein` : "keins angegeben — dann sprich von seinem Ziel, seiner Visa-Kreditkarte, ohne Zahl"}`,
    ...(ein.luecke.length ? [`· Im Antrag fehlt noch: ${ein.luecke.join(", ")} — der Link der Partnerbank geht erst raus, wenn das eingetragen ist; nie „direkt nach der Zahlung der Link“ (der Abschluss oben sagt es richtig).`] : []),
    `· Persönlicher Betreuer (so nennst du ihn — mit Herr/Frau, nie mit Vornamen): ${ein.betreuer ?? "wird nach der Aktivierung zugeteilt"} — höchstens als Begleiter nach der Aktivierung, nie „meldet sich“, „ruft an“ oder „prüft“.`,
    `· Tageszeit jetzt: ${tageszeit()}`,
    ``,
    `REGELN:`,
    fremd ? `· Sprache: Er schreibt uns auf ${ein.sprache} — du schreibst vollständig in dieser Sprache, in der höflichen Anredeform.` : `· Deutsch, Sie-Form.`,
    `· 5 bis 9 Sätze in 2 bis 3 kurzen Absätzen (Absätze durch eine Leerzeile). Ein Gedanke pro Satz.`,
    `· KEINE Anrede-Zeile, KEINE Grußformel, KEINE Unterschrift, KEINE Adresse (URL), KEINE Bankdaten — Anrede, Knopf „${a ? A_KNOPF_TEXT : "Rechnung ansehen und bezahlen"}" und Gruß setzt der Server. Sprich vom „Knopf unten“.`,
    ein.emojis ? `· Höchstens ein freundliches 🙂, sonst keine Emojis.` : `· Keine Emojis.`,
    `· Höchstens EIN Ausrufezeichen in der ganzen Mail (das im Abschluss).`,
    // E-276: wie E-275 — selbst erledigen, nie abgeben, kein Termin als Ziel.
    `· KEIN Termin, kein Anruf, kein Rückruf als Ziel — nie „antworten Sie mir mit einer Zeit“, nie „ich vereinbare Ihren Termin“. Kein „Herr/Frau X meldet sich, prüft oder ruft an“ — du erledigst es selbst.`,
    `· Nie „wir sind keine Bank“, nie „wir versenden Ihre Karte“ und nie „in Produktion“ — die Karte gibt unsere Partnerbank nach ihrer Zusage aus.`,
    a
      ? `· „Sofort aktiv“ nur so: „${nachDerZuordnung({ anfang: true })}“ — nie „sofort nach Zahlungseingang“.`
      : `· „Sofort“ nur mit seinem Verwendungszweck im selben Satz: „${nachDemEingang({ ref: k.zahlungsreferenz, anfang: true })}“. ${TEMPO_SATZ} ${ZAHL_KNOPF_MAIL}`,
    `· Nichts garantieren, nicht beraten, nie „ich empfehle“, keine feste Frist, keine Zusage außer der im Abschluss. Keine Rückzahlung zusagen. Hat er nach einem Kredit gefragt (Gedächtnis, Weg): nie mit einem Nein anfangen — seine eigene Kreditkarte ist das Bessere.`,
    `· Karten-Zeit nur sinngemäß so: „${KARTE_ZEIT_SATZ}“ — „in der Regel“, „nach der Zusage der Bank“ und „meist“ bleiben immer drin.`,
    `· Das Wunschlimit ist ein Ziel („als Ziel“, „darauf arbeiten wir hin“), nie eine Zusage; über den Rahmen entscheidet unsere Partnerbank. Das Wort „Kreditkarte“ gehört in jede Mail.`,
    `· Kein Nähe-Versprechen: nie „fehlt nur noch“, „nur noch einen Schritt“, „greifbar“ — sag den nächsten Schritt.`,
    `· Keine internen Wörter (Akte, Status, Stufe, Aktion, System, Lead).`,
    `· Nutze, was du über ihn weißt: ein Telefonat, eine frühere Mail, sein Ziel. Er soll merken, dass hier ein Mensch schreibt, der ihn kennt. Erfinde nichts.`,
    `· Wiederhole keine Sätze aus deinen bisherigen Mails an ihn (unten) — außer den Kernsätzen des Abschlusses.`,
    `· Schließ mit einem warmen, persönlichen Wunsch zur Tageszeit (${tageszeit()}).`,
    `· Betreff: 3 bis 8 Wörter, persönlich, ruhig — z. B. ${a ? "„Ihre Zahlung und Ihre Karte“, „Kurz zu Ihrer Überweisung“" : "„Ihre Karte wartet auf die Aktivierung“, „Ihr nächster Schritt zur Karte“"} — ohne Ausrufezeichen, ohne Großbuchstaben-Wörter, ohne Emoji.`,
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
  /** E-276 (02.10.2026): A = Zahlung gemeldet (nie eine erneute Zahlungsbitte), B = Aktivierung offen. Ohne Angabe: B. */
  stufe?: "A" | "B";
} = {}): string[] {
  const maengel: string[] = [];
  const land = String(opt.land || "").toUpperCase();
  const befunde = tonPruefung(`${betreff}\n${text}`, { kanal: "mail", land: land === "AT" || land === "CH" ? land as any : null, mitarbeiter: opt.mitarbeiter ?? null, kundeNamen: opt.kundeNamen });
  for (const b of befunde) {
    if (b.schwere === "hart") maengel.push(`Ton: „${b.treffer}" — ${b.hinweis}`);
    // E-276 (02.10.2026): In der Aktion sind diese weichen Regeln hart — sie wären eine unwahre Angabe in einer Mail, um
    // die er nicht gebeten hat (Kartenversand durch FIAON, „sofort“ ohne Verwendungszweck, „wir sind keine Bank“).
    else if (AKTION_HART.includes(b.id)) maengel.push(`Ton: „${b.treffer}" — ${b.hinweis}`);
  }
  // E-265 (29.09.2026, Justin: „VIEL MEHR AUF DIE KREDITKARTEN!"): „Kreditkarte" stand in 1 von 368 Mails.
  if (!/kreditkarte/i.test(text)) maengel.push("Die Visa-Kreditkarte kommt nicht vor — sie ist das, wofür er zahlt, und steht vorn");
  for (const b of linkPruefung(text)) if (b.schwere === "hart") maengel.push(`Link: ${b.link} — ${b.hinweis}`);
  for (const t of wandPruefen(`${betreff}\n${text}`)) {
    if (t.art === "verboten" || t.art === "zusage") maengel.push(`${t.art === "zusage" ? "Ungedeckte Zusage" : "Verboten"}: „${t.treffer}" — ${t.hinweis}`);
  }
  if (/https?:\/\/|www\.|\.com\//i.test(text)) maengel.push("Adresse (URL) im Text");
  if (/(^|[\s„"(])(du|dich|dir|dein|deine|deinen|deinem|deiner|euch|euer)(?=[\s.,;:!?)"“]|$)/.test(text)) maengel.push("Du-Form statt Sie-Form");
  // E-276: Justins Aufforderung „Zahlen Sie jetzt die Aktivierung, Ihre erste Monatsrate …“ nennt die offene Rechnung auch.
  if (!/(rechnung|zahlung|überweis|bezahl|begleich|beleg|monatsrate|zahlen\s+sie)/i.test(text)) maengel.push("Die offene Rechnung kommt nicht vor");
  if (text.length < 200) maengel.push("zu kurz");
  if (text.length > 1800) maengel.push("zu lang (höchstens neun Sätze)");
  if (!betreff.trim() || betreff.length > 90) maengel.push("Betreff fehlt oder ist zu lang");
  if (/!/.test(betreff)) maengel.push("Ausrufezeichen im Betreff");
  if (/\b(sehr geehrte|mit freundlichen grüßen|herzliche grüße|liebe grüße)\b/i.test(text)) maengel.push("Anrede oder Gruß im Text — die setzt der Server");
  // ── E-276 (02.10.2026): kein Termin als Ziel, keine Abgabe an Kollegen, Stufe A ohne Zahlungsbitte ──
  const e275 = selbstErledigtTreffer(text);
  if (/\btermin/i.test(`${betreff}\n${text}`)) maengel.push("Termin in der Mail — kein Termin als Ziel (E-276): sag, was die Zahlung bringt, und schließ mit dem Knopf");
  else if (e275.anruf) maengel.push(`Anruf/Termin angeboten („${e275.anruf.trim().slice(0, 70)}“) — kein Termin als Ziel (E-276)`);
  if (e275.abgabe) maengel.push(`Verweis auf einen Kollegen („${e275.abgabe.trim().slice(0, 70)}“) — du erledigst es selbst (E-276)`);
  if (opt.stufe === "A") {
    const z = fordertZahlung(text);
    if (z) maengel.push(`Erneute Zahlungsaufforderung („${z.trim().slice(0, 60)}“) — er hat seine Zahlung schon gemeldet (E-276)`);
  }
  return maengel;
}

/** E-276: weiche Regeln aus tonPruefung, die in der Aktion hart zählen. */
export const AKTION_HART: readonly string[] = ["karte_versand", "sofort_ohne_zweck", "keine_bank"];

/**
 * E-276 (02.10.2026): die WEICHEN Befunde (E-275-Ton) — sie lösen einen zweiten Entwurf aus, halten die Mail aber nicht
 * auf: weiche Regeln aus tonPruefung, mehr als ein „!“, und bei B die fehlende klare Aufforderung. Rein.
 */
export function aktionHinweise(betreff: string, text: string, opt: { stufe?: "A" | "B"; land?: string | null } = {}): string[] {
  const h: string[] = [];
  const land = String(opt.land || "").toUpperCase();
  for (const b of tonPruefung(`${betreff}\n${text}`, { kanal: "mail", land: land === "AT" || land === "CH" ? land as any : null })) {
    if (b.schwere === "weich" && !AKTION_HART.includes(b.id) && b.id !== "ausrufezeichen") h.push(`Ton: „${b.treffer}" — ${b.hinweis}`);
  }
  if (ausrufezeichen(text) > 1) h.push("Mehr als ein Ausrufezeichen — höchstens eins (das im Abschluss)");
  if (opt.stufe !== "A" && !fordertZahlung(text)) h.push(`Die klare Aufforderung fehlt — „${AKTIVIERUNG_AUFRUF}, Ihre erste Monatsrate …“ mit dem Nutzen dahinter`);
  return h;
}

/** Höchstens EIN „!“ — die übrigen werden zu Punkten (das erste bleibt). Rein. */
export function nurEinAusrufezeichen(text: string): string {
  let gesehen = false;
  return String(text ?? "").replace(/!/g, () => (gesehen ? "." : ((gesehen = true), "!")));
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
  // E-276 (02.10.2026): kein Termin mehr — die Vertretung (E-260), mit der Mara den Termin anbot, braucht die Aktion nicht.
  // Fehlt im Antrag noch etwas (Akte, karte.fehlendeAngaben — dieselbe Quelle wie Postfach und WhatsApp), sagt der
  // Abschluss es und verspricht den Link der Partnerbank erst danach (mitAntragLuecke).
  const luecke: string[] = Array.isArray((akte as any)?.karte?.fehlendeAngaben) ? (akte as any).karte.fehlendeAngaben.map(String) : [];
  const abschluss = aktionAbschluss({ stufe: k.stufe, ziel: kartenziel, betrag: eur(k.betragEuro), verwendungszweck: k.zahlungsreferenz, luecke });
  const auftrag = aktionsPrompt({
      kartenziel,
      abschluss, luecke,
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
    // E-280: A/B-Gruppe dieses Menschen (Opus 5.5 / Sonnet 5.5) — für den späteren Vergleich der Zahlungen.
    abGruppe: maraGruppe(k.personId),
    betreuer: weg?.zustaendig?.kundenName ?? null,
    faelligAm, paket: (akte as any)?.vertrag?.paket ?? null,
    offeneRate: (akte as any)?.zahlung?.offeneRate ?? null,
    gedaechtnis: String(gedaechtnis || "").slice(0, 400),
    fruehereMails: bisher.length,
    hausanweisung: hausanweisung ? "ja" : "nein",
    auftragZeichen: 0,
    // E-276: was im Antrag fehlt, ob der zweite Entwurf nötig war und ob die Ersatzfassung ging (mit den Mängeln des Modells)
    luecke,
    zweiterEntwurf: false as boolean,
    ersatz: null as string[] | null,
  };
  const nachrichten: any[] = [
    { role: "system", content: auftrag },
    { role: "user", content: "Schreibe jetzt die Mail im vorgegebenen Format." },
  ];
  wissen.auftragZeichen = auftrag.length;

  let kosten = 0;
  const rufen = async (extra?: string) => {
    const j = await kiAufruf({
      dienst: DIENST, modell: MODELL(), aufwand: "low", maxTokens: 3500, schema: SCHEMA, person: k.personId,
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
  const pOpt = { land: landKurz, mitarbeiter, kundeNamen, stufe: k.stufe };
  let maengel = aktionPruefen(betreff, text, pOpt);
  let hinweise = aktionHinweise(betreff, text, { stufe: k.stufe, land: landKurz });
  // E-276 (02.10.2026): ein zweiter Entwurf auch bei weichen Befunden (E-275-Ton) — gewählt wird der mit weniger harten,
  // bei Gleichstand weniger weichen Befunden.
  if (maengel.length || hinweise.length) {
    wissen.zweiterEntwurf = true;
    try {
      const liste = [...maengel, ...hinweise].map((m) => `· ${m}`).join("\n");
      const neu = await rufen(`Deine Mail hat diese Mängel:\n${liste}\n\nSchreib sie neu — derselbe Inhalt, ohne die Mängel. Den Abschluss (Betrag, Verwendungszweck, „sofort“, Link der Partnerbank) wörtlich wie vorgegeben. Nichts erfinden.`);
      const b2 = saeubern(neu?.betreff).replace(/[!]+/g, "").slice(0, 90);
      const t2 = saeubern(neu?.text);
      const m2 = aktionPruefen(b2, t2, pOpt);
      const h2 = aktionHinweise(b2, t2, { stufe: k.stufe, land: landKurz });
      if (m2.length < maengel.length || (m2.length === maengel.length && h2.length < hinweise.length)) { betreff = b2; text = t2; maengel = m2; hinweise = h2; }
    } catch (e) { if (istKiPause(e)) throw e; /* sonst bleibt es beim ersten Versuch */ }
  }
  // E-276 (02.10.2026, Justin: „wirklich alle … ohne Ausnahme!“): Besteht auch der zweite Entwurf nicht, geht die
  // Ersatzfassung aus den freigegebenen Bausteinen raus (nur Deutsch) — statt „abgelehnt“ und einer Stunde Ruhe.
  if (maengel.length && !fremdeSprache(sprache)) {
    const ersatzBetreff = k.stufe === "A" ? "Ihre Zahlung und Ihre Karte" : "Ihre Karte wartet auf die Aktivierung";
    const ersatzText = ersatzKern({ stufe: k.stufe, name: namen.voll, abschluss, tageszeit: tageszeit(), gemeldetAm: k.stufe === "A" ? tagDe(k.ereignisAm) : null });
    if (!aktionPruefen(ersatzBetreff, ersatzText, pOpt).length) {
      wissen.ersatz = maengel.slice(0, 4);
      betreff = ersatzBetreff; text = ersatzText; maengel = []; hinweise = [];
    }
  }
  if (maengel.length) return { ...leer, betreff, kern: text, maengel, auftrag, wissen, grund: `Prüfung: ${maengel.slice(0, 2).join("; ")}` };
  // höchstens EIN „!“ (E-275 Ton) — übrig gebliebene werden Punkte
  text = nurEinAusrufezeichen(text);

  // Zusammensetzen wie jede Mara-Mail: Anrede · Kern · Knopf · Gruß.
  const anrede = await anredeBestimmen(k.personId, k.vorname, k.nachname, sprache);
  const url = absoluteUrl(`/zahlung/${k.zahlungsreferenz || k.ref}`);
  const gruss = `${grussMitAgent(postfachGruss(ein.postfach), namen.voll)}\n\nMöchten Sie keine Nachrichten mehr von mir, genügt eine kurze Antwort mit „Stopp“.`;
  text = absaetzeFassen(text);
  const fertig = antwortBauen({
    anrede: anrede.zeile, kern: text, gruss, betreff,
    schritt: { art: "zahlung" as any, url, text: k.stufe === "A" ? A_KNOPF_TEXT : "Rechnung ansehen und bezahlen" },
    sprache, agentName: namen.voll,
    // E-276: Stufe A hat schon überwiesen — der Knopf zeigt Verwendungszweck und Zahlungsdaten, fordert nicht zum Zahlen auf.
    knopfText: k.stufe === "A" && !fremdeSprache(sprache) ? A_KNOPF_TEXT : null,
  });
  return { ok: true, grund: null, betreff, text: fertig.text, html: fertig.html, kern: text, kostenCents: kosten, maengel: hinweise, auftrag, wissen };
}

/**
 * E-276 (02.10.2026): der Stand der RUNDE fürs Steuerpult — „Runde seit … — X geschrieben, Y offen“; null ohne Runde.
 * geschrieben/ausgelassen zählen MENSCHEN seit Rundenstart, offen ist die Schlange der Runde (dieselbe Abfrage wie der Lauf).
 */
export async function rundeStand(ein?: AktionEinstellungen): Promise<{ seit: string; bis: string; geschrieben: number; ausgelassen: number; offen: number } | null> {
  await aktionTabellen();
  const e = ein ?? await einstellungenLesen();
  if (!e.rundeSeit) return null;
  const [z] = (await sqlPool`
    SELECT COUNT(DISTINCT person_id) FILTER (WHERE status = 'gesendet' AND gesendet_am >= ${e.rundeSeit}::timestamptz)::int AS geschrieben,
           COUNT(DISTINCT person_id) FILTER (WHERE status = 'abgelehnt' AND created_at >= ${e.rundeSeit}::timestamptz)::int AS ausgelassen
      FROM fiaon_mara_aktion WHERE created_at >= ${e.rundeSeit}::timestamptz - INTERVAL '1 hour'`) as any[];
  const offen = (await kandidatenLaden(5_000, e.stufen, { rundeSeit: e.rundeSeit, hoechstens: 5_000 })).length;
  return {
    seit: e.rundeSeit, bis: new Date(Date.parse(e.rundeSeit) + RUNDE_STUNDEN * 3_600_000).toISOString(),
    geschrieben: Number(z?.geschrieben || 0), ausgelassen: Number(z?.ausgelassen || 0), offen,
  };
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
 * E-276 (02.10.2026): So viele Mails schreibt ein Durchgang GLEICHZEITIG. Gemessen (Produktion, 7 Tage, nur lesend):
 * Modell im Mittel 4,0 s (Median 3,7 s, p90 5,0 s, max 22 s), eine Mail nach der anderen im Median alle 4,5 s — ein
 * Durchgang schafft allein ~130 Mails in 10 Minuten. Mit dem zweiten Entwurf (E-276) und einer Stunde wie 400/h
 * (67 je Durchgang) wird das knapp; drei gleichzeitig halten Luft, ohne Gmail oder das Modell zu drängen.
 */
export const AKTION_PARALLEL = 3;
/** E-276: Ein Anspruch („in_arbeit“), den ein unterbrochener Durchgang liegen ließ, gilt nach so vielen Minuten als abgebrochen. */
export const ANSPRUCH_MINUTEN = 30;

/**
 * Ein Durchgang (alle 10 Minuten): so viele Mails, wie Takt und Kostendeckel
 * erlauben — heißeste zuerst.
 * E-276 (02.10.2026): drei gleichzeitig (AKTION_PARALLEL), jede mit einem ANSPRUCH je Mensch — eine Zeile
 * status „in_arbeit“, die der eindeutige Index fiaon_mara_aktion_in_arbeit_uidx höchstens einmal je Person zulässt.
 * Zwei Durchgänge, die sich überlappen (Neustart beim Deploy, Knopf im Steuerpult), schreiben ihm so nie zweimal:
 * Wer den Anspruch nicht bekommt, überspringt ihn. Aus der Zeile wird „gesendet“, „abgelehnt“ oder „fehler“; bleibt sie
 * liegen (Neustart mitten im Schreiben), wird sie nach ANSPRUCH_MINUTEN „abgebrochen“ (zählt wie ein Fehlversuch).
 * Direkt vor dem Schreiben: Sperren (wie bisher) und ein ungebuchter Eingang (eingangOffenFuer) — dann keine Mail,
 * sondern „abgelehnt“ mit dem Grund „ungebuchter Eingang — buchen statt anschreiben“.
 */
export async function maraAktionLauf(opt: {
  /** Nur Prüfstand (pruef-mara-aktion --db): statt Modell und Gmail. Der Takt und das Steuerpult rufen ohne Angabe. */
  schreiben?: (k: Kandidat, e: AktionEinstellungen) => Promise<Entwurf>;
  senden?: (postfach: string, m: { vonName: string; an: string; betreff: string; text: string; html: string; abmelden: string }) => Promise<{ id: string; threadId: string }>;
} = {}): Promise<{ gesendet: number; abgelehnt: number; fehler: number; grund?: string }> {
  if (laeuft) return { gesendet: 0, abgelehnt: 0, fehler: 0, grund: "läuft schon" };
  laeuft = true;
  try {
    await aktionTabellen();
    // E-276: liegen gebliebene Ansprüche freigeben — sonst hielte die Schlange (in_arbeit) den Menschen für immer fest.
    await sqlPool`UPDATE fiaon_mara_aktion SET status = 'abgebrochen', grund = COALESCE(grund, 'Anspruch liegen geblieben (Durchgang unterbrochen)')
                   WHERE status = 'in_arbeit' AND created_at < NOW() - make_interval(mins => ${ANSPRUCH_MINUTEN})`.catch(() => {});
    const e = await einstellungenLesen();
    if (!e.an) return { gesendet: 0, abgelehnt: 0, fehler: 0, grund: "aus" };
    if (await kiPausiert()) return { gesendet: 0, abgelehnt: 0, fehler: 0, grund: "KI pausiert" }; // E-246
    const z = await aktionZaehler(e);
    if (z.kostenHeuteEuro >= e.tagEuro) return { gesendet: 0, abgelehnt: 0, fehler: 0, grund: `Kostendeckel (${z.kostenHeuteEuro.toFixed(2)} € von ${e.tagEuro} €)` };
    // Der Durchgang läuft alle 10 Minuten — je Durchgang also ein Sechstel der Stunde.
    const stundenRate = e.jeStunde;
    const erlaubt = Math.max(0, Math.min(Math.ceil(stundenRate / 6), stundenRate - z.letzteStunde, z.tagesDeckel - z.heute));
    if (!erlaubt) return { gesendet: 0, abgelehnt: 0, fehler: 0, grund: "Takt erfüllt" };
    // E-276: der Beginn dieses Durchgangs — wer SEITDEM eine Aktionsmail bekommen hat (ein anderer Durchgang), wird übersprungen.
    const beginn = new Date();
    const kandidaten = await kandidatenLaden(erlaubt * 2, e.stufen, { rundeSeit: e.rundeSeit });
    const neueMailSendenMitFaden = opt.senden ?? (await import("./fiaon-gmail")).neueMailSendenMitFaden;
    const schreiben = opt.schreiben ?? mailSchreiben;
    const { vonName } = { vonName: (await agentNamen()).voll };
    let gesendet = 0, abgelehnt = 0, fehler = 0, uebersprungen = 0, unterwegs = 0, naechster = 0;
    let pausiert = false, gestoppt: string | null = null;

    /** Eine Zeile des Anspruchs abschließen (nur solange sie noch „in_arbeit“ ist). */
    const abschluss = async (id: number, status: "abgelehnt" | "fehler", f: { grund: string | null; betreff?: string | null; text?: string | null; kostenCents?: number; pruefung?: unknown }) => {
      await sqlPool`UPDATE fiaon_mara_aktion SET status = ${status}, grund = ${f.grund}, betreff = ${f.betreff ?? null}, text = ${f.text ?? null},
                      kosten_cents = ${f.kostenCents ?? null}, pruefung = ${f.pruefung == null ? null : sqlPool.json(f.pruefung as any)}
                     WHERE id = ${id} AND status = 'in_arbeit'`.catch(() => {});
    };

    const einer = async (k: Kandidat): Promise<void> => {
      // ── E-276: DER ANSPRUCH ──────────────────────────────────────────────
      const [anspruch] = (await sqlPool`
        INSERT INTO fiaon_mara_aktion (person_id, ref, stufe, schritt, status, empfaenger, postfach)
        VALUES (${k.personId}, ${k.ref}, ${k.stufe}, ${k.schritt}, 'in_arbeit', ${k.email}, ${e.postfach})
        ON CONFLICT (person_id) WHERE status = 'in_arbeit' DO NOTHING
        RETURNING id`) as any[];
      if (!anspruch) { uebersprungen++; return; }
      const id = Number(anspruch.id);
      let raus = false;
      try {
        // Hat ihm ein anderer Durchgang seit unserem Beginn schon geschrieben? Dann still zurückgeben, keine Zeile.
        const [schon] = (await sqlPool`SELECT 1 AS ja FROM fiaon_mara_aktion WHERE person_id = ${k.personId} AND status = 'gesendet' AND gesendet_am >= ${beginn} LIMIT 1`) as any[];
        if (schon) { await sqlPool`DELETE FROM fiaon_mara_aktion WHERE id = ${id} AND status = 'in_arbeit'`; uebersprungen++; return; }
        // ── E-240: DIE SPERRE DIREKT VOR DEM SCHREIBEN ─────────────────────────
        // Diese Mails gehen über Gmail, nicht durch die Tür in make-webhook.ts —
        // die Schlange oben ist also die einzige Prüfung, und zwischen Schlange und
        // Versand vergehen Minuten (KI). Zweimal nachsehen: der Mensch (Werbesperre,
        // Vertriebssperre, Test) und die ADRESSE (eine Werbesperre an einer zweiten
        // Person oder im Lead-Formular mit derselben Adresse). Die Kündigung prüft
        // die Schlange (mit Zeitpunkt: wer danach neu beantragt, bleibt drin).
        // E-253 (28.09.2026): der MENSCH (menschSperre) — Werbesperre auch an einer Dublette, Vertriebssperre nur am Kopf.
        const ps = await menschSperre(k.personId).catch(() => null);
        // E-272 (02.10.2026): und ein drittes Mal — ist er inzwischen GLOBAL-KUNDE? Ein Individualangebot
        // kann zwischen Schlange und Versand angelegt worden sein. Im Zweifel (Prüfung gescheitert) nicht senden.
        const global = await istGlobalKunde(k.personId).then(
          (ja) => (ja ? "Kunde von FIAON Global (E-272) — keine Mail der Privatlinie" : null),
          () => "Global-Prüfung gescheitert — lieber nicht senden (E-272)",
        );
        const sperre = global
          ?? (ps ? werbungVerboten({ ...ps, gekuendigt: false, vertragVorbei: false }) : null)
          ?? ((await werbesperreAnAdresse(k.email).catch(() => false)) ? "Werbesperre an dieser Adresse" : null);
        if (sperre) { abgelehnt++; await abschluss(id, "abgelehnt", { grund: `Sperre: ${sperre}` }); return; }
        // E-276 (02.10.2026): Liegt sein Geld womöglich schon ungebucht im Bankbuch (unscharf, im Zweifel ja)? Dann kein
        // „Zahlen Sie jetzt …“ und keine Erinnerung an seine Meldung — er gehört gebucht, nicht angeschrieben.
        if (await eingangOffenFuer(k.personId)) { abgelehnt++; await abschluss(id, "abgelehnt", { grund: "ungebuchter Eingang — buchen statt anschreiben" }); return; }
        let m: Entwurf;
        try {
          m = await schreiben(k, e);
        } catch (err: any) {
          // E-246: KI pausiert (oder gerade pausiert worden) — Durchgang beenden, KEINE Zeile:
          // „abgelehnt" hieße Ruhe für diesen Menschen und eine falsche Zahl im Steuerpult.
          if (istKiPause(err)) { pausiert = true; await sqlPool`DELETE FROM fiaon_mara_aktion WHERE id = ${id} AND status = 'in_arbeit'`.catch(() => {}); return; }
          m = { ok: false, grund: String(err?.message || err).slice(0, 200), betreff: "", text: "", html: "", kern: "", kostenCents: 0, maengel: [] };
        }
        if (!m.ok) {
          abgelehnt++;
          await abschluss(id, "abgelehnt", { grund: m.grund, betreff: m.betreff || null, text: m.kern || null, kostenCents: m.kostenCents, pruefung: { maengel: m.maengel, wissen: m.wissen ?? null } });
          return;
        }
        if (gestoppt || pausiert) { await sqlPool`DELETE FROM fiaon_mara_aktion WHERE id = ${id} AND status = 'in_arbeit'`.catch(() => {}); return; }
        let r: { id: string; threadId: string };
        try {
          r = await neueMailSendenMitFaden(e.postfach, { vonName, an: k.email, betreff: m.betreff, text: m.text, html: m.html, abmelden: e.postfach });
        } catch (err: any) {
          fehler++;
          await abschluss(id, "fehler", { grund: String(err?.message || err).slice(0, 300), betreff: m.betreff, text: m.text, kostenCents: m.kostenCents });
          // Ein Versandfehler (Gmail-Grenze, Sperre) stoppt den Durchgang — nicht 20-mal gegen dieselbe Wand.
          gestoppt = "Versandfehler";
          return;
        }
        raus = true;
        gesendet++;
        const kurz = m.kern.replace(/\s+/g, " ").slice(0, 300);
        await sqlPool`UPDATE fiaon_mara_aktion SET status = 'gesendet', grund = NULL, betreff = ${m.betreff}, text = ${m.text}, html = ${m.html},
                        gmail_id = ${r.id}, thread_id = ${r.threadId}, kosten_cents = ${m.kostenCents}, gesendet_am = NOW(),
                        pruefung = ${sqlPool.json({ wissen: m.wissen ?? null, maengel: m.maengel ?? [] } as any)}
                       WHERE id = ${id}`;
        await sqlPool`INSERT INTO fiaon_mail_log (event, person_id, empfaenger, status, betreff, art, ausgeloest_von)
          VALUES ('mara_aktion', ${k.personId}, ${k.email}, 'gesendet', ${m.betreff}, 'echt', 'Mara (Aktion)')`.catch(() => {});
        await sqlPool`INSERT INTO fiaon_contact_log (ref, person_id, agent_id, agent_name, type, note)
          VALUES (${k.ref}, ${k.personId}, NULL, ${vonName}, 'system', ${`Mara hat geschrieben (Aktion, Stufe ${k.stufe}, Mail ${k.schritt}): „${m.betreff}" — ${kurz}`})`.catch(() => {});
      } catch (err: any) {
        // Unerwartet (Datenbank): Ist die Mail schon raus, zählt sie als gesendet — sonst bekäme er sie nach dem Abbruch
        // ein zweites Mal. Sonst „fehler“ (zählt wie ein Fehlversuch).
        if (raus) await sqlPool`UPDATE fiaon_mara_aktion SET status = 'gesendet', gesendet_am = COALESCE(gesendet_am, NOW()) WHERE id = ${id}`.catch(() => {});
        else { fehler++; await abschluss(id, "fehler", { grund: String(err?.message || err).slice(0, 300) }); }
      }
    };

    // E-276: AKTION_PARALLEL Arbeiter ziehen aus derselben Schlange; „unterwegs“ reserviert den Platz, bevor gewartet wird.
    const arbeiter = async (): Promise<void> => {
      while (!pausiert && !gestoppt) {
        if (gesendet + unterwegs >= erlaubt) return;
        const k = kandidaten[naechster++];
        if (!k) return;
        unterwegs++;
        try {
          if ((await kostenHeute(DIENST).catch(() => 0)) >= e.tagEuro) { gestoppt = "Kostendeckel"; return; }
          await einer(k);
        } finally {
          unterwegs--;
        }
      }
    };
    await Promise.all(Array.from({ length: Math.max(1, Math.min(AKTION_PARALLEL, kandidaten.length)) }, () => arbeiter()));
    if (gesendet || abgelehnt || fehler || uebersprungen) console.log(`[MARA-AKTION] ${gesendet} gesendet, ${abgelehnt} abgelehnt, ${fehler} Fehler, ${uebersprungen} übersprungen (Kandidaten ${kandidaten.length}, erlaubt ${erlaubt}${e.rundeSeit ? `, Runde seit ${e.rundeSeit}` : ""})`);
    if (pausiert) return { gesendet, abgelehnt, fehler, grund: "KI pausiert" };
    if (gestoppt === "Kostendeckel") return { gesendet, abgelehnt, fehler, grund: "Kostendeckel" };
    return { gesendet, abgelehnt, fehler };
  } finally {
    laeuft = false;
  }
}
