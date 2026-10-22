// ═══════════════════════════════════════════════════════════════════════════
// ARAS — Einstellungen und die Warteschlange (E-408, Vertrag § 3 / § 4)
//
// Die Warteschlange (fiaon_aras_plan) füllt sich aus der Akte — kein Mensch
// tippt etwas: Termine bei Aras, Zuruf-JA (Einwilligung), Zahlung gemeldet
// (Stufe A), Rate fällig (Tag 0/−1 und Tag 3/10/20), Zusage nachfassen.
// Lead, Stufe B kalt und Rückholung sind AUS, bis Justin sie einschaltet
// (LEXR). Jede Werbe-Spielart braucht eine Einwilligungs-Zeile — ohne sie
// entsteht gar kein Eintrag.
//
// Alles hier ist Buchführung; die Wände (Fenster, Deckel, Sperre, Höchstzahlen)
// prüft der Wähler NOCH EINMAL beim Wählen (fiaon-aras-waehler.ts).
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { arasSchema, arasAusweisId } from "./fiaon-aras-schema";
import { echtePersonSql } from "./fiaon-bestand-filter";
import { globalKundeSql, globalKundeBereit } from "./fiaon-global-kunde";
import { abgeschicktSql } from "../../shared/fiaon-antrag-stand";
import { ERINNERBARE_BESTELLUNG_SQL, RATE_NACH_ENDE_SQL_FUER } from "./fiaon-raten-storno";
import { waehlbareNummer } from "./fiaon-telefon";
import { berlinToday, berlinZeitpunkt } from "./fiaon-time";
import { telefonGesperrt, nummerKern } from "./fiaon-aras-sperre";
import { einwilligungGueltig, einwilligungMerken } from "./fiaon-telefon-einwilligung";
import { STUFE_A_GEMELDET_TAGE } from "../../shared/fiaon-wiedervorlage";
import {
  ARAS_SCHLUESSEL_LISTE, einstellungPruefen, einstellungenAnwenden, nummerLand, reihen, stundeFuer, fensterOffen, berlinTeile,
  PRIORITAET, RECHTSGRUND, SPIELARTEN, STUFE_B_FRISCH_STUNDEN, istSpielart, istWerbeSpielart, istVertragsFenster, stufenGrenzen, KEIN_VERTRAG_SATZ, KEIN_VERTRAG_MEHR_SATZ, istGesperrteSpielart, GESPERRT_TEXT, RATE_TAGE_BIS,
  VORRANG_SPIELARTEN, istVorrang, fensterAmWochentag, zusagePause, zusageSchwelle, zusageNachfassTag, SPIELART_TEXT,
  type ArasEinstellungen, type Spielart, type PlanStatus, type PlanZeile, type PlanLage, type Tagesplan, type Lernvorschlag, type Land,
} from "../../shared/fiaon-aras";

type Lauf = typeof sqlPool;

// ── Einstellungen ──────────────────────────────────────────────────────────
let zwischen: { wert: ArasEinstellungen; bis: number } | null = null;

export async function arasEinstellungenLesen(frisch = false, lauf: Lauf = sqlPool): Promise<ArasEinstellungen> {
  if (!frisch && zwischen && zwischen.bis > Date.now()) return zwischen.wert;
  const zeilen = (await lauf`SELECT key, value FROM fiaon_settings WHERE key LIKE 'aras_%'`.catch(() => [])) as any[];
  const roh: Record<string, string> = {};
  for (const z of zeilen) roh[String(z.key)] = String(z.value ?? "");
  const wert = einstellungenAnwenden(roh);
  zwischen = { wert, bis: Date.now() + 10_000 };
  return wert;
}
export function arasEinstellungenVergessen(): void { zwischen = null; }

/** Alle Rohwerte (für die Einstellungen-Seite: Wert neben Vorgabe). */
export async function arasEinstellungenRoh(lauf: Lauf = sqlPool): Promise<Record<string, string>> {
  const zeilen = (await lauf`SELECT key, value FROM fiaon_settings WHERE key LIKE 'aras_%'`.catch(() => [])) as any[];
  return Object.fromEntries(zeilen.map((z) => [String(z.key), String(z.value ?? "")]));
}

export async function einstellungSetzen(schluessel: string, wert: unknown, von: string, lauf: Lauf = sqlPool): Promise<string> {
  if (!ARAS_SCHLUESSEL_LISTE.includes(schluessel)) throw new Error(`Unbekannte Einstellung „${schluessel}“ — kein ARAS-Schlüssel.`);
  const w = einstellungPruefen(schluessel, wert);
  await lauf`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${schluessel}, ${w}, NOW())
             ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`;
  zwischen = null;
  const { protokollieren } = await import("./fiaon-mara-termin");
  await protokollieren({ kanal: "telefon", art: "aras_werkzeug" as any, text: `Einstellung ${schluessel} = ${w.slice(0, 80)} (${von})`, daten: { schluessel, von } }, lauf);
  return w;
}

// ── Kosten heute (für den Tagesdeckel) ────────────────────────────────────
/**
 * Was ARAS heute gekostet hat: KI aller aras-*-Dienste (fiaon_ki_nutzung — dieselbe Quelle wie kiKostenJeDienst
 * im KI-Raum, E-409) + die laufenden Sitzungen (noch nicht abgerechnet) + Telefon der ARAS-Anrufe (Schätzung je Minute).
 */
export async function arasKostenHeute(lauf: Lauf = sqlPool): Promise<{ ki: number; telefon: number; euro: number }> {
  await arasSchema(lauf);
  const t = berlinTeile(new Date()).datum;
  const [k] = (await lauf`SELECT COALESCE(SUM(kosten_cents), 0)::float AS cents FROM fiaon_ki_nutzung
                           WHERE dienst LIKE 'aras-%' AND (created_at AT TIME ZONE 'Europe/Berlin')::date = ${t}::date`.catch(() => [{ cents: 0 }])) as any[];
  const [a] = (await lauf`SELECT COALESCE(SUM(kosten_telefon_cents), 0)::float AS telefon,
                                 COALESCE(SUM(kosten_ki_cents) FILTER (WHERE nachbereitet_am IS NULL), 0)::float AS laufend
                            FROM fiaon_aras_anruf WHERE (created_at AT TIME ZONE 'Europe/Berlin')::date = ${t}::date`) as any[];
  const ki = (Number(k?.cents ?? 0) + Number(a?.laufend ?? 0)) / 100, telefon = Number(a?.telefon ?? 0) / 100;
  return { ki: Math.round(ki * 100) / 100, telefon: Math.round(telefon * 100) / 100, euro: Math.round((ki + telefon) * 100) / 100 };
}

// ── Versuche je Person (Mensch + ARAS zusammen) ────────────────────────────
export async function versucheHeute(personId: number, lauf: Lauf = sqlPool): Promise<{ heute: number; woche: number; fehlFolge: number; letzterVersuchAm: Date | null; erreichtAm: Date | null }> {
  const [z] = (await lauf`
    WITH v AS (
      SELECT c.beginn, c.ergebnis, c.status,
             -- Wählvorgänge binnen 5 Minuten sind EIN Versuch (Hausregel, fiaon-anrufversuche.ts)
             CASE WHEN LAG(c.beginn) OVER (ORDER BY c.beginn, c.id) > c.beginn - INTERVAL '5 minutes' THEN 0 ELSE 1 END AS neu
        FROM fiaon_calls c
       WHERE c.person_id = ${personId} AND c.richtung = 'raus'
         AND NOT (c.status = 'gewaehlt' AND c.twilio_sid IS NULL AND c.beginn < NOW() - INTERVAL '10 minutes')
         AND c.beginn > NOW() - INTERVAL '60 days'
    )
    SELECT COUNT(*) FILTER (WHERE neu = 1 AND (beginn AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS heute,
           COUNT(*) FILTER (WHERE neu = 1 AND beginn > NOW() - INTERVAL '7 days')::int AS woche,
           MAX(beginn) AS letzter
      FROM v`) as any[];
  const [f] = (await lauf`
    SELECT COUNT(*)::int AS fehl FROM fiaon_calls c
     WHERE c.person_id = ${personId} AND c.richtung = 'raus'
       AND c.beginn > COALESCE((SELECT MAX(beginn) FROM fiaon_calls WHERE person_id = ${personId} AND richtung = 'raus'
                                  AND (ergebnis LIKE 'erreicht%' OR ergebnis = 'rueckruf_termin' OR status = 'beendet' AND dauer_sek >= 30)), '1970-01-01')`) as any[];
  // Beste Uhrzeit je Kunde (Koordination 22.10.2026): wann er zuletzt ABGENOMMEN hat (Mensch oder ARAS, raus, 120 Tage) — nur ein
  // ausdrückliches Ergebnis zählt (erreicht, Rückruf vereinbart, übergeben, abgebrochen nach seinen Worten). Eine Mailbox-Nachricht
  // von 30 Sekunden ist kein Abnehmen; die Fehlversuchs-Serie oben bleibt bei ihrer eigenen, älteren Lesart.
  const [e] = (await lauf`
    SELECT MAX(beginn) AS am FROM fiaon_calls
     WHERE person_id = ${personId} AND richtung = 'raus' AND beginn > NOW() - INTERVAL '120 days'
       AND (ergebnis LIKE 'erreicht%' OR ergebnis IN ('rueckruf_termin', 'uebergeben', 'abgebrochen'))`) as any[];
  return { heute: Number(z?.heute ?? 0), woche: Number(z?.woche ?? 0), fehlFolge: Number(f?.fehl ?? 0), letzterVersuchAm: z?.letzter ? new Date(z.letzter) : null, erreichtAm: e?.am ? new Date(e.am) : null };
}

// ── Einreihen ──────────────────────────────────────────────────────────────
export interface EinreihenEin {
  personId: number | null; leadId?: number | null; ref?: string | null;
  nummer: string; spielart: Spielart; grund: string;
  erzeugtVon: "takt" | "mara" | "lead_motor" | "antrag" | "chef" | "kunde" | "probe" | "akte";
  fruehAb?: Date; spaetBis?: Date;
  terminId?: number | null; rateId?: number | null; erinnerungId?: number | null; einwilligungId?: number | null;
  betragCents?: number | null; anlassAm?: Date | null; fehlFolge?: number;
  /** Nur der Takt darf die Prüfung „gibt es heute schon einen Eintrag“ nutzen; der Chef reiht bewusst erneut ein. */
  einmalProTag?: boolean;
  /** Wer von Hand eingereiht hat (Betreuer-Name, „Chef #928“, „Mara“) — die Warteschlange zeigt es. */
  auftragVon?: string | null;
  /** Derselbe im Dativ („Herrn Krause“) — für Aras' Satz „ich rufe im Auftrag von …“. */
  auftragVonDat?: string | null;
  /** Der Mitarbeiter, der den Auftrag gegeben hat (Akte). */
  auftragAgentId?: number | null;
  /** Freitext-Auftrag aus der Akte („teile dem Kunden mit …“) — schon durch die Wortwand. */
  auftragText?: string | null;
  /** „Offenes an Aras abgeben“ / „Aras anrufen lassen“: die Punkte in Reihenfolge (art, label für die Akte, satz für Aras). */
  offenes?: { art: string; label: string; satz: string }[] | null;
  /** Der wievielte Versuch dieses Auftrags (Akte: nicht erreicht → am nächsten Tag noch einmal, höchstens AUFTRAG_VERSUCHE). */
  versuchNr?: number;
  /** Nach dem Anruf diesen Mitarbeiter benachrichtigen. */
  benachrichtigenAgentId?: number | null;
}

/** „Aras für diesen Kunden aus“ (fiaon_aras_person.aus_am) — gilt nur für Aras, das Team ruft weiter an. */
export async function arasAusFuerPerson(personId: number, lauf: Lauf = sqlPool): Promise<boolean> {
  await arasSchema(lauf);
  const [z] = (await lauf`SELECT aus_am FROM fiaon_aras_person WHERE person_id = ${personId}`) as any[];
  return !!z?.aus_am;
}

/** Hat die Person einen Vertrag (bezahlt, Zahlung gemeldet, nicht beendet)? Dann ist ein Auftrag aus der Akte Vertragssache. */
export async function vertragsKunde(personId: number, lauf: Lauf = sqlPool): Promise<boolean> {
  const [z] = (await lauf`
    SELECT 1 FROM fiaon_applications a
     WHERE a.person_id = ${personId} AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.archived_at IS NULL
       AND (a.payment_status IN ('paid', 'claimed_paid') OR a.claimed_paid_at IS NOT NULL)
       AND a.gekuendigt_am IS NULL AND a.abo_gestoppt_am IS NULL AND COALESCE(a.payment_status, '') NOT IN ('cancelled', 'refunded', 'superseded')
     LIMIT 1`.catch(() => [])) as any[];
  return !!z;
}

/**
 * Hat die Person einen Vertrag? (Justin 20.10.2026, 21:55: „Nein, nur Vertragskunden“.) „laeuft“ = unterschrieben (Vertragsannahme
 * oder consent_contract), bezahlt oder Zahlung gemeldet — und nicht beendet — ODER eine offene Rate (der Vertrag läuft bis zum
 * Ende). „ehemalig“ = hatte einen Vertrag, der beendet ist. „keiner“ = Interessent. Fehlt die Tabelle der Vertragsannahmen,
 * zählt nur consent_contract.
 */
export async function vertragsLage(personId: number, lauf: Lauf = sqlPool): Promise<"laeuft" | "ehemalig" | "keiner"> {
  const sql = (mitAnnahme: boolean) => {
    const unterschrieben = `(a.consent_contract IS TRUE${mitAnnahme ? " OR EXISTS (SELECT 1 FROM fiaon_vertragsannahmen v WHERE v.ref = a.ref AND COALESCE(v.weg, '') NOT LIKE '%pruefstand%')" : ""})`;
    return lauf.unsafe(`
      SELECT COALESCE(bool_or(
               ((${unterschrieben} OR COALESCE(a.payment_status, '') IN ('paid', 'claimed_paid') OR a.claimed_paid_at IS NOT NULL)
                 AND a.archived_at IS NULL AND a.gekuendigt_am IS NULL AND a.abo_gestoppt_am IS NULL
                 AND COALESCE(a.payment_status, '') NOT IN ('cancelled', 'refunded', 'superseded'))
               OR EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL)
             ), FALSE) AS laeuft,
             COALESCE(bool_or(${unterschrieben} OR COALESCE(a.payment_status, '') IN ('paid', 'completed', 'claimed_paid', 'refunded') OR a.claimed_paid_at IS NOT NULL), FALSE) AS war
        FROM fiaon_applications a
       WHERE a.person_id = ${Number(personId)} AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL`);
  };
  const [z] = ((await sql(true).catch(() => null)) ?? (await sql(false).catch(() => []))) as any[];
  return z?.laeuft ? "laeuft" : z?.war ? "ehemalig" : "keiner";
}

/**
 * Go-live (20.10.2026, Koordination): „Willkommen nach Antrag“ nur nach dem UNTERSCHRIEBENEN Antrag — eine Vertragsannahme
 * (/antrag-neu „Zahlungspflichtig annehmen“) oder consent_contract (/vertrag-bestaetigen). Nie für Leads, nie nach Kündigung.
 * Fehlt die Tabelle der Vertragsannahmen, gilt nur consent_contract.
 */
export async function willkommenBereit(personId: number, lauf: Lauf = sqlPool): Promise<boolean> {
  const sql = (mitAnnahme: boolean) => lauf.unsafe(`
    SELECT 1 FROM fiaon_applications a
     WHERE a.person_id = ${Number(personId)} AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.archived_at IS NULL
       AND a.gekuendigt_am IS NULL AND COALESCE(a.payment_status, '') NOT IN ('cancelled', 'refunded', 'superseded')
       AND (a.consent_contract IS TRUE${mitAnnahme ? " OR EXISTS (SELECT 1 FROM fiaon_vertragsannahmen v WHERE v.ref = a.ref)" : ""})
     LIMIT 1`);
  const z = ((await sql(true).catch(() => null)) ?? (await sql(false).catch(() => []))) as any[];
  return z.length > 0;
}

// ── Willkommen nach Antrag (Go-live 20.10.2026, Koordination) ──────────────────────────────────────────────────
/** 20 Minuten nach der Unterschrift, höchstens 24 h danach — später nie. */
export const WILLKOMMEN_AB_MINUTEN = 20, WILLKOMMEN_BIS_STUNDEN = 24;
/** Koordination 22.10.2026 (21.10.: alle fünf Willkommens-Anrufe Mailbox oder nicht abgenommen, danach nichts): genau EIN
 *  zweiter Versuch, frühestens so viele Minuten nach dem ersten — im Fenster, höchstens 24 h nach der Unterschrift. */
export const WILLKOMMEN_ZWEITER_NACH_MINUTEN = 150;
/** Ergebnisse, nach denen ein Willkommens-Versuch nicht zählt (niemand hat gesprochen) — dann kommt der zweite. */
const WILLKOMMEN_OHNE_GESPRAECH = ["mailbox", "nicht_erreicht"] as const;
/**
 * EINE Quelle für Planer und Wähler: jede Vertragsannahme mit den Gründen, warum ARAS NICHT anruft. Angerufen wird nur, wenn
 * alle false sind: unterschrieben (Vertragsannahme, kein Prüfstand), Aktivierung offen (nichts bezahlt, nichts gemeldet),
 * Vertrag nicht beendet, keine Werbe- oder Vertriebssperre, keine Testperson, kein FIAON Global, KEIN Anruf mit ihm in den
 * letzten 24 h (Mensch oder ARAS, rein oder raus — ARAS' eigener Willkommens-Versuch ohne Gespräch zählt nicht, sonst gäbe es
 * keinen zweiten), die Unterschrift 20 Minuten bis 24 h alt.
 */
function willkommenSql(): string {
  return `
    SELECT v.ref, v.angenommen_am, ${PERSON_NUMMER_SQL},
           (COALESCE(a.payment_status, '') IN ('paid', 'completed', 'claimed_paid') OR a.claimed_paid_at IS NOT NULL) AS bezahlt,
           (a.gekuendigt_am IS NOT NULL OR a.abo_gestoppt_am IS NOT NULL OR COALESCE(a.payment_status, '') IN ('cancelled', 'refunded', 'superseded')) AS beendet,
           (COALESCE(p.is_blocked, FALSE) OR p.werbung_gesperrt_am IS NOT NULL) AS gesperrt,
           NOT (${echtePersonSql("p")}) AS test,
           ${globalKundeSql("p.id")} AS global,
           EXISTS (SELECT 1 FROM fiaon_calls c WHERE c.person_id = p.id AND c.beginn > NOW() - INTERVAL '24 hours'
                     AND NOT EXISTS (SELECT 1 FROM fiaon_aras_anruf wa WHERE wa.call_id = c.id AND wa.spielart = 'willkommen'
                                       AND (wa.ergebnis IN ('${WILLKOMMEN_OHNE_GESPRAECH.join("', '")}') OR c.status = 'fehlgeschlagen'))) AS anruf_24h,
           (v.angenommen_am < NOW() - make_interval(hours => ${WILLKOMMEN_BIS_STUNDEN})) AS zu_alt,
           (v.angenommen_am > NOW() - make_interval(mins => ${WILLKOMMEN_AB_MINUTEN})) AS zu_frisch,
           (COALESCE(v.weg, '') LIKE '%pruefstand%') AS pruefstand
      FROM fiaon_vertragsannahmen v
      JOIN fiaon_applications a ON a.ref = v.ref AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.archived_at IS NULL
      JOIN fiaon_persons p ON p.id = a.person_id`;
}
const WILLKOMMEN_NEIN: [string, string][] = [
  ["pruefstand", "Prüfstand-Annahme"], ["bezahlt", "Aktivierung schon da"], ["beendet", "Vertrag beendet"], ["gesperrt", "Werbe- oder Vertriebssperre"],
  ["test", "Testperson"], ["global", "FIAON Global"], ["anruf_24h", "Anruf in den letzten 24 h"], ["zu_alt", "Unterschrift älter als 24 h"],
  ["zu_frisch", "Unterschrift jünger als 20 Minuten"],
];
/** Darf ARAS zu diesem Vertrag JETZT „Willkommen“ anrufen? null = ja, sonst der Grund (für Warteschlange und Protokoll). */
export async function willkommenEntfaellt(ref: string | null | undefined, lauf: Lauf = sqlPool): Promise<string | null> {
  if (!ref) return "ohne Antrag";
  await globalKundeBereit();
  const [w] = (await lauf.unsafe(`${willkommenSql()} WHERE v.ref = $1 LIMIT 1`, [String(ref)]).catch(() => [])) as any[];
  if (!w) return "kein unterschriebener Antrag";
  for (const [k, text] of WILLKOMMEN_NEIN) if (w[k]) return text;
  return null;
}

// ── Zahlungszusage pausiert die Rate-Anrufe (Koordination 22.10.2026) ──────────────────────────────────────────────
// 21.10.: „zahle heute“ (zahlungszusage_merken ok) — und am 22.10. um 09:46 rief ARAS wegen derselben Rate wieder an; ein
// zweiter Kunde mit Zusage stand wieder auf „wartet“. Die Spielart „zusage“ ist im Go-live aus, darum hält der Rate-Planer selbst
// still: bis zum zugesagten Tag plus zwei Bank-Werktage (die Überweisung läuft) — solange seit der Zusage keine Rate bezahlt ist.
/**
 * Der späteste zugesagte Tag (Berlin, als date) einer noch wirksamen Zusage der Person — oder NULL. Zusagen hängen an der
 * Bestellung (fiaon_contact_log.ref; person_id ist dort meist leer), darum über alle Bestellungen der Person. `schwelle` =
 * zusageSchwelle(heute) (geprüftes „JJJJ-MM-TT“). EINE Quelle für Planer, Aufräumen und Wähler.
 */
function zusageTagSql(personSpalte: string, schwelle: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(schwelle)) throw new Error(`Zusage-Schwelle „${schwelle}“ ist kein Datum.`);
  return `(SELECT MAX((zl.promised_date AT TIME ZONE 'Europe/Berlin')::date)
             FROM fiaon_applications za JOIN fiaon_contact_log zl ON zl.ref = za.ref
            WHERE za.person_id = ${personSpalte} AND zl.type = 'result' AND zl.outcome = 'erreicht_zahlt_am' AND zl.voided_at IS NULL
              AND zl.promised_date IS NOT NULL AND (zl.promised_date AT TIME ZONE 'Europe/Berlin')::date >= DATE '${schwelle}'
              AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten zr WHERE zr.ref = zl.ref AND zr.bezahlt_am > zl.created_at))`;
}

/** Hat die Person eine wirksame Zahlungszusage? Dann: zugesagter Tag, Pause bis einschließlich `bis`, wieder anrufen ab `wiederAb`. */
export async function zusagePauseFuer(personId: number, lauf: Lauf = sqlPool, heute: string = berlinToday()): Promise<{ zusageTag: string; bis: string; wiederAb: string } | null> {
  const [z] = (await lauf.unsafe(`SELECT ${zusageTagSql(String(Number(personId)), zusageSchwelle(heute))}::text AS tag`)) as any[];
  return z?.tag ? zusagePause(String(z.tag)) : null;
}

/** Fensterbeginn und -ende eines Kalendertags (Berlin) — gibt es an dem Tag kein Fenster, der nächste Tag mit Fenster. */
function tagMitFenster(tag: string, einst: ArasEinstellungen): { tag: string; ab: Date; bis: Date } {
  let t = tag;
  for (let n = 0; n < 8; n++) {
    const [j, m, d] = t.split("-").map(Number);
    const wt = new Date(Date.UTC(j, m - 1, d)).getUTCDay() || 7;
    const f = fensterAmWochentag(einst.fenster, wt);
    if (f) return { tag: t, ab: berlinZeitpunkt(t, Number(f.von.slice(0, 2)) * 60 + Number(f.von.slice(3))), bis: berlinZeitpunkt(t, Number(f.bis.slice(0, 2)) * 60 + Number(f.bis.slice(3))) };
    const nd = new Date(Date.UTC(j, m - 1, d + 1));
    t = nd.toISOString().slice(0, 10);
  }
  return { tag, ab: berlinZeitpunkt(tag, 9 * 60 + 30), bis: berlinZeitpunkt(tag, 21 * 60) };
}

/** Einen Rate-Eintrag bis nach der Zusage-Pause zurückstellen (Status „verschoben“, mit Grund; er kommt am Tag `wiederAb` zurück). */
async function ratePausieren(planId: number, p: { zusageTag: string; bis: string; wiederAb: string }, einst: ArasEinstellungen, lauf: Lauf): Promise<void> {
  const wieder = tagMitFenster(p.wiederAb, einst);
  const tagDe = (iso: string) => iso.split("-").reverse().slice(0, 2).join(".") + ".";
  await lauf`UPDATE fiaon_aras_plan SET status = 'verschoben', frueh_ab = ${wieder.ab}, spaet_bis = GREATEST(spaet_bis, ${wieder.bis}),
                    verschoben_grund = ${`Zahlungszusage für den ${tagDe(p.zusageTag)} — kein Rate-Anruf bis einschließlich ${tagDe(p.bis)} (Überweisung läuft)`.slice(0, 200)},
                    updated_at = NOW()
              WHERE id = ${planId} AND status IN ('wartet', 'verschoben')`;
}

/**
 * Rate offen — vor dem Wählen noch einmal dieselben Bedingungen wie beim Planen (die Reihe verteilt sich jetzt über den Tag;
 * zwischen Planen und Wählen liegen Stunden): Rate bezahlt, storniert, Vertrag nicht mehr erinnerbar (Abo-/Mahnstopp,
 * Vertragsende, abgelöst) → „verfallen“; inzwischen „zahle am …“ gesagt → „verschoben“ bis nach der Überweisungszeit. Die
 * Zusage-Pause gilt für Einträge des Planers — was ein Mensch von Hand einreiht, verschiebt oder wieder einreiht (auftrag_von),
 * ruft ARAS wie gewünscht an. null = anrufen.
 */
export async function rateEntfaellt(z: { id: number; person_id?: number | null; rate_id?: number | null; erzeugt_von?: string | null; auftrag_von?: string | null },
  einst: ArasEinstellungen, lauf: Lauf = sqlPool, heute: string = berlinToday()): Promise<{ status: "verfallen" | "verschoben"; grund: string } | null> {
  if (z.rate_id) {
    const [r] = (await lauf.unsafe(`
      SELECT (r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL) AS offen, r.bezahlt_am IS NOT NULL AS bezahlt,
             (a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND ${ERINNERBARE_BESTELLUNG_SQL("a")} AND a.abo_gestoppt_am IS NULL
              AND a.mahnstopp_am IS NULL AND NOT ${RATE_NACH_ENDE_SQL_FUER("a", "r")}) AS erinnerbar
        FROM fiaon_abo_raten r JOIN fiaon_applications a ON a.ref = r.ref WHERE r.id = $1`, [Number(z.rate_id)])) as any[];
    const grund = !r ? "Rate nicht mehr da" : r.bezahlt ? "Rate inzwischen bezahlt" : !r.offen ? "Rate nicht mehr offen (storniert)" : !r.erinnerbar ? "Vertrag nicht mehr erinnerbar (Abo-/Mahnstopp, Vertragsende)" : null;
    if (grund) {
      await lauf`UPDATE fiaon_aras_plan SET status = 'verfallen', verschoben_grund = ${grund}, updated_at = NOW() WHERE id = ${z.id} AND status = 'wartet'`;
      return { status: "verfallen", grund };
    }
  }
  if (z.erzeugt_von === "takt" && !z.auftrag_von && z.person_id) {
    const p = await zusagePauseFuer(Number(z.person_id), lauf, heute);
    if (p) {
      await ratePausieren(z.id, p, einst, lauf);
      return { status: "verschoben", grund: `Zahlungszusage bis ${p.bis}` };
    }
  }
  return null;
}

// ── Zusage nachfassen zur richtigen Zeit (Koordination 22.10.2026, Scheibe 3) ─────────────────────────────────────────────
/** „JJJJ-MM-TT“ → „TT.MM.“ */
const tagKurz = (iso: string) => `${iso.slice(0, 10).split("-").reverse().slice(0, 2).join(".")}.`;
export interface ZusageNachfass { personId: number; zusageTag: string; zusageAm: Date; ref: string | null; nummer: string | null; country: string | null }
/**
 * Wessen Zusage steht zum Nachfassen an? Je Person die wirksame Zusage mit dem spätesten Tag (dieselbe Lesart wie zusageTagSql:
 * nicht zurückgenommen, seit ihr keine Rate des Vertrags bezahlt) — und an DIESER Bestellung ist noch etwas offen: die erste
 * Zahlung (weder bezahlt noch beendet) oder eine offene, fällige Rate eines erinnerbaren Vertrags (kein Abo-/Mahnstopp, nicht
 * nach dem Vertragsende). Keine Testperson, kein Global-Kunde. `tagBis` = spätester zugesagter Tag (Planer: gestern — der Tag
 * selbst entscheidet zusageNachfassTag; Wähler: auch künftige, damit eine NEUE Zusage den alten Eintrag ablöst).
 * EINE Quelle für Planer (Abschnitt 5) und Wähler (zusageEntfaellt).
 */
export async function zusageNachfassKandidaten(heute: string, lauf: Lauf = sqlPool, opt: { personId?: number; tagBis?: string } = {}): Promise<ZusageNachfass[]> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(heute)) throw new Error(`Berliner Datum „${heute}“ unlesbar.`);
  const tagBis = opt.tagBis ?? null;
  if (tagBis && !/^\d{4}-\d{2}-\d{2}$/.test(tagBis)) throw new Error(`Datum „${tagBis}“ unlesbar.`);
  await globalKundeBereit();
  const rows = (await lauf.unsafe(`
    SELECT z.person_id, z.tag::text AS zusage_tag, z.zusage_am, z.ref, p.primary_phone AS nummer, p.country
      FROM (SELECT DISTINCT ON (za.person_id) za.person_id, (zl.promised_date AT TIME ZONE 'Europe/Berlin')::date AS tag, zl.created_at AS zusage_am, za.ref
              FROM fiaon_applications za JOIN fiaon_contact_log zl ON zl.ref = za.ref
             WHERE zl.type = 'result' AND zl.outcome = 'erreicht_zahlt_am' AND zl.voided_at IS NULL AND zl.promised_date IS NOT NULL
               AND za.merged_into IS NULL AND za.gdpr_deleted_at IS NULL AND ($1::int IS NULL OR za.person_id = $1::int)
               AND zl.created_at > DATE '${heute}' - 60
               AND NOT EXISTS (SELECT 1 FROM fiaon_abo_raten zr WHERE zr.ref = zl.ref AND zr.bezahlt_am > zl.created_at)
             ORDER BY za.person_id, (zl.promised_date AT TIME ZONE 'Europe/Berlin')::date DESC, zl.created_at DESC) z
      JOIN fiaon_persons p ON p.id = z.person_id
     WHERE z.tag >= DATE '${heute}' - 30 AND z.tag <= COALESCE($2::date, DATE '${heute}' - 1)
       AND ${echtePersonSql("p")} AND NOT ${globalKundeSql("p.id")}
       AND EXISTS (SELECT 1 FROM fiaon_applications a WHERE a.ref = z.ref AND a.archived_at IS NULL
                     AND ((COALESCE(a.payment_status, '') NOT IN ('paid', 'completed', 'cancelled', 'refunded', 'superseded')
                           AND COALESCE(a.ist_entwurf, FALSE) = FALSE AND a.gekuendigt_am IS NULL AND a.abo_gestoppt_am IS NULL)
                          OR EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.ref = a.ref AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL
                                       AND r.faellig_am::date <= DATE '${heute}' AND ${ERINNERBARE_BESTELLUNG_SQL("a")} AND a.abo_gestoppt_am IS NULL
                                       AND a.mahnstopp_am IS NULL AND NOT ${RATE_NACH_ENDE_SQL_FUER("a", "r")})))
     ORDER BY z.tag, z.person_id LIMIT 300`, [opt.personId ?? null, tagBis])) as any[];
  return rows.map((r) => ({ personId: Number(r.person_id), zusageTag: String(r.zusage_tag), zusageAm: new Date(r.zusage_am), ref: r.ref ?? null, nummer: r.nummer ?? null, country: r.country ?? null }));
}

/**
 * Zusage nachfassen — vor dem Wählen noch einmal (zwischen Planen um 00:04 und Wählen liegen Stunden): inzwischen bezahlt, die
 * Zusage zurückgenommen oder nichts mehr offen → „verfallen“; eine NEUE Zusage (späterer Tag) → „verfallen“, der Planer fasst
 * zum neuen Tag nach. Gilt für Einträge des Planers — was ein Mensch von Hand einreiht, ruft ARAS wie gewünscht an. null = anrufen.
 */
export async function zusageEntfaellt(z: { id: number; person_id?: number | null; nummer?: string | null; erzeugt_von?: string | null; auftrag_von?: string | null },
  einst: ArasEinstellungen, lauf: Lauf = sqlPool, heute: string = berlinToday()): Promise<{ status: "verfallen"; grund: string } | null> {
  if (z.erzeugt_von !== "takt" || z.auftrag_von || !z.person_id) return null;
  const [k] = await zusageNachfassKandidaten(heute, lauf, { personId: Number(z.person_id), tagBis: "2099-12-31" });
  let grund: string | null = null;
  if (!k) grund = "Zusage erledigt — bezahlt, zurückgenommen oder nichts mehr offen";
  else {
    const tag = zusageNachfassTag(k.zusageTag, { land: nummerLand(z.nummer ?? "") ?? "DE", fenster: einst.fenster });
    if (tag > heute) grund = `neue Zusage für den ${tagKurz(k.zusageTag)} — Nachfassen am ${tagKurz(tag)}`;
  }
  if (!grund) return null;
  await lauf`UPDATE fiaon_aras_plan SET status = 'verfallen', verschoben_grund = ${grund.slice(0, 200)}, updated_at = NOW() WHERE id = ${z.id} AND status = 'wartet'`;
  return { status: "verfallen", grund };
}

/** Die wählbare Nummer einer Person (primary_phone, Land) — E.164 oder null. */
export async function personNummer(personId: number, lauf: Lauf = sqlPool): Promise<string | null> {
  const [p] = (await lauf`SELECT primary_phone, country FROM fiaon_persons WHERE id = ${personId}`.catch(() => [])) as any[];
  if (!p?.primary_phone) return null;
  return waehlbareNummer([{ nummer: p.primary_phone }], p.country).waehlbar ?? null;
}

export async function planEinreihen(e: EinreihenEin, lauf: Lauf = sqlPool): Promise<{ ok: boolean; id?: number; grund?: string }> {
  await arasSchema(lauf);
  if (!istSpielart(e.spielart)) return { ok: false, grund: "Unbekannte Spielart." };
  // Justin 20.10.2026 („nur Vertragskunden“): Zuruf, Lead, Stufe B und Rückholung sind im Code gesperrt — auch von Hand.
  if (istGesperrteSpielart(e.spielart)) return { ok: false, grund: `${e.spielart}: ${GESPERRT_TEXT}.` };
  const einst = await arasEinstellungenLesen(false, lauf);
  if (!einst.spielarten[e.spielart] && e.spielart !== "probe") return { ok: false, grund: `Spielart „${e.spielart}“ ist ausgeschaltet.` };
  const nummer = e.spielart === "probe" ? e.nummer : (waehlbareNummer([{ nummer: e.nummer }]).waehlbar ?? null);
  if (!nummer) return { ok: false, grund: "Keine wählbare Nummer." };
  const land: Land = nummerLand(nummer) ?? "DE";
  const kern = nummerKern(nummer);
  if (e.spielart !== "probe" && await telefonGesperrt(kern, e.personId, lauf)) return { ok: false, grund: "Telefonsperre (nicht mehr anrufen)." };
  if (e.personId && e.spielart !== "probe" && await arasAusFuerPerson(e.personId, lauf)) return { ok: false, grund: "Aras ist für diesen Kunden aus." };
  let rechtsgrund = RECHTSGRUND[e.spielart];
  if (e.personId && e.spielart !== "probe") {
    await globalKundeBereit();
    const [g] = (await lauf.unsafe(`SELECT ${globalKundeSql("p.id")} AS global, p.ist_test_am IS NOT NULL AS test, p.werbung_gesperrt_am IS NOT NULL AS werbesperre FROM fiaon_persons p WHERE p.id = ${Number(e.personId)}`)) as any[];
    if (g?.global) return { ok: false, grund: "Firmenkunde (FIAON Global) — ARAS ruft nicht an." };
    if (g?.test) return { ok: false, grund: "Testperson." };
    if (g?.werbesperre && istWerbeSpielart(e.spielart)) return { ok: false, grund: "Werbesperre — keine Werbe-Spielart." };
    // Auftrag aus der Akte: NUR Kunden mit Vertrag (Justin 20.10.2026, 21:55: „Nein, nur Vertragskunden“) — Interessenten schreibt Mara.
    if (e.spielart === "auftrag") {
      const v = await vertragsLage(e.personId, lauf);
      if (v !== "laeuft") return { ok: false, grund: v === "ehemalig" ? KEIN_VERTRAG_MEHR_SATZ : KEIN_VERTRAG_SATZ };
      rechtsgrund = "vertrag";
    }
    if (e.spielart === "willkommen" && !(await willkommenBereit(e.personId, lauf))) return { ok: false, grund: "Willkommen nur nach dem unterschriebenen Antrag." };
  } else if (e.spielart === "auftrag") return { ok: false, grund: "Ein Auftrag braucht einen Kunden." };
  else if (e.spielart === "willkommen") return { ok: false, grund: "Willkommen braucht einen Kunden mit unterschriebenem Antrag." };
  let einwilligungId = e.einwilligungId ?? null;
  if (rechtsgrund === "einwilligung") {
    if (!einwilligungId) {
      const ew = await einwilligungGueltig(kern, e.personId, lauf);
      if (!ew) return { ok: false, grund: "Keine gültige Telefon-Einwilligung (§ 7a UWG) — Werbe-Spielart ohne Ja." };
      einwilligungId = ew.id;
    }
    if (land === "CH" && !einst.callerIdCh) return { ok: false, grund: "Schweiz: keine eingetragene CH-Nummer (UWG lit. v) — keine Werbe-Spielart." };
  }
  if (e.einmalProTag && e.personId) {
    const [d] = (await lauf`SELECT 1 FROM fiaon_aras_plan WHERE person_id = ${e.personId} AND spielart = ${e.spielart}
                             AND (created_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date LIMIT 1`) as any[];
    if (d) return { ok: false, grund: "Heute schon eingereiht." };
  }
  const jetzt = new Date();
  const fruehAb = e.fruehAb ?? jetzt;
  const spaetBis = e.spaetBis ?? new Date(fruehAb.getTime() + 12 * 3600_000);
  const [z] = (await lauf`
    INSERT INTO fiaon_aras_plan (person_id, lead_id, ref, nummer, land, spielart, prioritaet, grund, rechtsgrund, einwilligung_id,
                                 termin_id, rate_id, erinnerung_id, frueh_ab, spaet_bis, erzeugt_von, betrag_cents, anlass_am, fehl_folge,
                                 auftrag_von, auftrag_text, auftrag_offenes, benachrichtigen_agent_id, versuch_nr, auftrag_von_dat, auftrag_agent_id)
    VALUES (${e.personId}, ${e.leadId ?? null}, ${e.ref ?? null}, ${nummer}, ${land}, ${e.spielart}, ${PRIORITAET[e.spielart]}, ${e.grund.slice(0, 200)},
            ${rechtsgrund}, ${einwilligungId}, ${e.terminId ?? null}, ${e.rateId ?? null}, ${e.erinnerungId ?? null},
            ${fruehAb}, ${spaetBis}, ${e.erzeugtVon}, ${e.betragCents ?? null}, ${e.anlassAm ?? null}, ${e.fehlFolge ?? 0},
            ${e.auftragVon ?? null}, ${e.auftragText ?? null}, ${e.offenes?.length ? lauf.json(e.offenes as any) : null}, ${e.benachrichtigenAgentId ?? null}, ${Math.max(1, Math.min(9, e.versuchNr ?? 1))},
            ${e.auftragVonDat ?? null}, ${e.auftragAgentId ?? null})
    ON CONFLICT (person_id, spielart) WHERE status = 'wartet' AND person_id IS NOT NULL DO NOTHING
    RETURNING id`) as any[];
  if (!z) return { ok: false, grund: "Wartet schon (ein offener Eintrag je Person und Spielart)." };
  return { ok: true, id: Number(z.id) };
}

export async function planVerschieben(id: number, bis: Date, grund: string, von: string, lauf: Lauf = sqlPool): Promise<void> {
  await arasSchema(lauf);
  // Wer von Hand verschiebt oder wieder einreiht, steuert den Eintrag ab jetzt selbst (auftrag_von) — eine Zahlungszusage stellt
  // ihn dann nicht mehr still zurück (Koordination 22.10.2026; sonst spränge „Wieder einreihen“ gleich wieder auf „verschoben“).
  await lauf`UPDATE fiaon_aras_plan SET frueh_ab = ${bis}, spaet_bis = GREATEST(spaet_bis, ${bis} + INTERVAL '4 hours'), status = 'wartet',
             verschoben_grund = ${`${grund} (${von})`.slice(0, 200)}, auftrag_von = COALESCE(auftrag_von, ${von.slice(0, 80)}), updated_at = NOW()
              WHERE id = ${id} AND status IN ('wartet', 'verschoben', 'verfallen')`;
}
export async function planEntfernen(id: number, grund: string, von: string, lauf: Lauf = sqlPool): Promise<void> {
  await arasSchema(lauf);
  await lauf`UPDATE fiaon_aras_plan SET status = 'verfallen', verschoben_grund = ${`${grund} (${von})`.slice(0, 200)}, updated_at = NOW() WHERE id = ${id} AND status = 'wartet'`;
}

// ── Lage und Listen ────────────────────────────────────────────────────────
function zeile(z: any, maskiert: boolean): PlanZeile {
  const name = z.last_name ? String(z.last_name) : (z.company_name ? String(z.company_name) : "—");
  return {
    id: Number(z.id), personId: z.person_id != null ? Number(z.person_id) : null,
    name: maskiert && name !== "—" ? `${name.slice(0, 1)}…` : name,
    spielart: z.spielart, prioritaet: Number(z.prioritaet), grund: String(z.grund ?? ""),
    fruehAb: new Date(z.frueh_ab).toISOString(), spaetBis: new Date(z.spaet_bis).toISOString(),
    status: z.status, versuchNr: Number(z.versuch_nr ?? 1), rechtsgrund: z.rechtsgrund, land: String(z.land ?? "DE"),
    verschobenGrund: z.verschoben_grund ? String(z.verschoben_grund) : null,
  };
}

export async function planLage(lauf: Lauf = sqlPool, maskiert = false): Promise<PlanLage> {
  await arasSchema(lauf);
  const je = (await lauf`SELECT spielart, status, COUNT(*)::int AS n FROM fiaon_aras_plan
                          WHERE created_at > NOW() - INTERVAL '2 days' OR status = 'wartet' GROUP BY 1, 2`) as any[];
  const jeSpielart: Record<string, Record<string, number>> = {};
  for (const z of je) { (jeSpielart[z.spielart] ??= {})[z.status] = Number(z.n); }
  const naechste = (await lauf`
    SELECT pl.*, p.last_name, p.company_name FROM fiaon_aras_plan pl LEFT JOIN fiaon_persons p ON p.id = pl.person_id
     WHERE pl.status = 'wartet' ORDER BY pl.prioritaet, pl.frueh_ab LIMIT 20`) as any[];
  const [w] = (await lauf`SELECT COUNT(*) FILTER (WHERE status = 'wartet')::int AS wartet,
                                  COUNT(*) FILTER (WHERE status = 'fertig' AND (updated_at AT TIME ZONE 'Europe/Berlin')::date = (NOW() AT TIME ZONE 'Europe/Berlin')::date)::int AS fertig
                             FROM fiaon_aras_plan`) as any[];
  return { jeSpielart, naechste: naechste.map((z) => zeile(z, maskiert)), wartet: Number(w?.wartet ?? 0), heuteFertig: Number(w?.fertig ?? 0) };
}

export async function planListe(f: { status?: PlanStatus; spielart?: Spielart; seite?: number }, lauf: Lauf = sqlPool, maskiert = false): Promise<PlanZeile[]> {
  await arasSchema(lauf);
  const seite = Math.max(0, Number(f.seite ?? 0));
  const zeilen = (await lauf`
    SELECT pl.*, p.last_name, p.company_name FROM fiaon_aras_plan pl LEFT JOIN fiaon_persons p ON p.id = pl.person_id
     WHERE (${f.status ?? null}::text IS NULL OR pl.status = ${f.status ?? null})
       AND (${f.spielart ?? null}::text IS NULL OR pl.spielart = ${f.spielart ?? null})
     ORDER BY CASE pl.status WHEN 'wartet' THEN 0 WHEN 'laeuft' THEN 1 WHEN 'gewaehlt' THEN 1 ELSE 2 END, pl.prioritaet, pl.frueh_ab DESC
     LIMIT 50 OFFSET ${seite * 50}`) as any[];
  return zeilen.map((z) => zeile(z, maskiert));
}

// ── Der Füller: aus der Akte in die Warteschlange ──────────────────────────
function heuteUm(h: number, min = 0): Date {
  const b = berlinTeile(new Date());
  const [j, m, t] = b.datum.split("-").map(Number);
  // Berliner Wandzeit → Zeitpunkt: über die Differenz zwischen UTC-Interpretation und Berlin-Anzeige
  const utc = new Date(Date.UTC(j, m - 1, t, h, min, 0));
  const anzeige = berlinTeile(utc);
  const versatz = (Number(anzeige.hhmm.slice(0, 2)) * 60 + Number(anzeige.hhmm.slice(3))) - (h * 60 + min);
  return new Date(utc.getTime() - versatz * 60_000);
}
function fensterEnde(spielart: Spielart, einst: ArasEinstellungen): Date {
  const f = istVertragsFenster(spielart) ? einst.fenster.rate : einst.fenster.verkauf;
  const wt = berlinTeile(new Date()).wochentag;
  let bis = "19:00";
  for (const [tage, zeit] of Object.entries(f)) {
    const m = /^([1-7])(?:-([1-7]))?$/.exec(tage);
    if (m && wt >= Number(m[1]) && wt <= Number(m[2] ?? m[1])) bis = zeit[1];
  }
  return heuteUm(Number(bis.slice(0, 2)), Number(bis.slice(3)));
}
function abBesterStunde(spielart: Spielart): Date {
  const h = stundeFuer(spielart, null);
  const ab = heuteUm(h);
  return ab.getTime() > Date.now() ? ab : new Date();
}

const PERSON_NUMMER_SQL = `p.primary_phone AS nummer, p.country, p.id AS person_id, p.last_name`;

/**
 * Ein Rückruf mit Vorrang hat seine Zeit verpasst (Koordination 22.10.2026: nie still verfallen lassen — der Kunde verlässt sich
 * darauf). „Rückruf verpasst — bitte anrufen“ auf den Wegen der anderen ARAS-Hinweise: eine Aufgabe für den Zuständigen des
 * Kunden (dringend, heute, mit Akte — je Eintrag genau eine), die Karte auf der Tafel (aras:rueckruf_verpasst, je Fall eine
 * Zeile) und das ARAS-Protokoll (Kanal telefon). Der Grund ist die beste Erklärung aus der Lage beim Verfallen.
 */
async function rueckrufVerpasst(z: any, einst: ArasEinstellungen, grenzen: ReturnType<typeof stufenGrenzen>, lauf: Lauf): Promise<void> {
  const spielart = z.spielart as Spielart;
  const personId = z.person_id != null ? Number(z.person_id) : null;
  // Rückruf: die gebuchte Zeit (anlass_am = Termin-Beginn); Zusage-Nachfassen: die geplante Zeit (anlass_am ist dort die Zusage selbst).
  const wann: Date | null = spielart === "termin" && z.anlass_am ? new Date(z.anlass_am) : z.frueh_ab ? new Date(z.frueh_ab) : null;
  const zeit = wann ? wann.toLocaleString("de-DE", { timeZone: "Europe/Berlin", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "";
  const grund = einst.notaus ? "Not-Aus war an" : !einst.an ? "ARAS war aus" : einst.leerlauf ? "Leerlauf (Deploy)" : grenzen.stufe === 0 ? "Stufe 0 (nur Probeanrufe)"
    : !grenzen.spielartErlaubt(spielart) ? `„${SPIELART_TEXT[spielart]}“ ist ausgeschaltet`
    : spielart === "termin" && wann && !fensterOffen("termin", (z.land as Land) || "DE", wann, { fenster: einst.fenster }).offen ? "die Zeit lag außerhalb 08–21 Uhr"
    : "ARAS kam in der Zeit nicht zum Anrufen";
  const was = spielart === "termin" ? `Rückruf bei ARAS, vom Kunden selbst gebucht${zeit ? ` für ${zeit} Uhr` : ""}` : `Nachfassen zur Zahlungszusage${zeit ? ` (${zeit} Uhr)` : ""}`;
  // Ein früherer Grund (z. B. „Twilio: …“ bei einem hängen gebliebenen Eintrag) bleibt hinten stehen — für die Fehlersuche.
  await lauf`UPDATE fiaon_aras_plan SET verschoben_grund = LEFT(CONCAT_WS(' · ', ${`Rückruf verpasst (${grund}) — Team informiert`}::text, NULLIF(verschoben_grund, '')), 200),
                    updated_at = NOW() WHERE id = ${Number(z.id)}`;
  let ref: string | null = z.ref ?? null, wer = "Kunde";
  if (personId) {
    const [p] = (await lauf`
      SELECT p.anrede, p.last_name,
             (SELECT a.ref FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
               ORDER BY (a.payment_status = 'paid') DESC, a.created_at DESC LIMIT 1) AS ref
        FROM fiaon_persons p WHERE p.id = ${personId}`.catch(() => [])) as any[];
    ref = ref ?? p?.ref ?? null;
    const anrede = String(p?.anrede ?? "").toLowerCase();
    wer = [anrede === "frau" ? "Frau" : anrede === "herr" ? "Herr" : "", p?.last_name ?? ""].join(" ").trim() || "Kunde";
  }
  try {
    const { auftragFuerKunden } = await import("../routes/fiaon-betreiber-todo");
    await auftragFuerKunden({
      personId, ref, titel: `Rückruf verpasst — bitte anrufen: ${wer}`.slice(0, 160),
      text: `${was}: ARAS hat nicht angerufen (${grund}). Bitte ruf heute noch an.`, dringend: true, faelligAm: berlinToday(),
      schluessel: `aras:rueckruf_verpasst:${Number(z.id)}`, quelle: "aras", autorName: "ARAS", anlageText: "Angelegt von ARAS: ein zugesagter Rückruf kam nicht zustande",
    });
  } catch (e) { console.error("[ARAS-PLAN] Rückruf verpasst — Aufgabe:", String((e as Error)?.message ?? e).slice(0, 200)); }
  const { alarmMelden } = await import("./fiaon-system-alarme");
  await alarmMelden("aras:rueckruf_verpasst", {
    quelle: "aras", titel: "ARAS: Rückruf verpasst — bitte anrufen", text: `${was} — ${grund}${ref ? ` (Akte ${ref})` : ""}. Aufgabe für das Team ist angelegt.`,
    stufe: "rot", link: ref ? `/akte/${ref}` : "/chef/s/aras?reiter=probe", endetNachStunden: 24, anhaengen: true,
  }, lauf).catch(() => null);
  const { protokollieren } = await import("./fiaon-mara-termin");
  await protokollieren({ kanal: "telefon", art: "aras_termin", ok: false, personId, nummer: z.nummer ?? null, text: `Rückruf verpasst — bitte anrufen: ${was} (${grund}). Aufgabe für das Team angelegt.`, daten: { planId: Number(z.id), spielart, terminId: z.termin_id ?? null, grund } }, lauf);
}

export async function planFuellen(lauf: Lauf = sqlPool): Promise<{ eingereiht: Record<string, number>; uebersprungen: Record<string, number>; verfallen: number }> {
  await arasSchema(lauf);
  await globalKundeBereit();
  const einst = await arasEinstellungenLesen(true, lauf);
  const eingereiht: Record<string, number> = {}, uebersprungen: Record<string, number> = {};
  const zaehl = (s: Spielart, r: { ok: boolean; grund?: string }) => { if (r.ok) eingereiht[s] = (eingereiht[s] ?? 0) + 1; else uebersprungen[`${s}:${(r.grund ?? "").slice(0, 40)}`] = (uebersprungen[`${s}:${(r.grund ?? "").slice(0, 40)}`] ?? 0) + 1; };
  const nummerVon = (z: any) => waehlbareNummer([{ nummer: z.nummer }], z.country).waehlbar;
  const heute = berlinToday();
  const grenzen = stufenGrenzen(einst);
  // Abgelaufenes geht aus der Reihe. Ein Rückruf mit Vorrang (vom Kunden gebucht, ARAS' Zusage-Nachfassen) verfällt nie still
  // (Koordination 22.10.2026) — auch keiner, der „verschoben“ hängen blieb (Twilio-Fehler, hängender Versuch): jeder bringt die
  // Meldung „Rückruf verpasst — bitte anrufen“. Das läuft vor jeder Stufen-Prüfung (auch bei Not-Aus und Stufe 0).
  const verfallenR = (await lauf`
    UPDATE fiaon_aras_plan SET status = 'verfallen', updated_at = NOW()
     WHERE spaet_bis < NOW() AND (status = 'wartet' OR (status = 'verschoben' AND spielart = ANY(${[...VORRANG_SPIELARTEN] as string[]})))
     RETURNING id, spielart, person_id, ref, nummer, land, anlass_am, frueh_ab, termin_id`) as any[];
  for (const z of verfallenR) {
    if (istVorrang(z.spielart)) await rueckrufVerpasst(z, einst, grenzen, lauf).catch((e) => console.error("[ARAS-PLAN] Rückruf verpasst — Meldung:", String((e as Error)?.message ?? e).slice(0, 200)));
  }
  // Stufenplan (hart): Stufe 0 reiht keinen Kunden ein; darüber nur die Gesprächsarten der Stufe (und des Schalters).
  if (grenzen.stufe === 0) return { eingereiht, uebersprungen: { stufe_0: 1 }, verfallen: verfallenR.length };
  const an = (s: Spielart) => grenzen.spielartErlaubt(s);

  // 1. Termine bei Aras (Minute genau; die Buchung ist die Einwilligung)
  if (an("termin")) {
    const ausweis = await arasAusweisId(lauf);
    const zeilen = (await lauf`
      SELECT t.id AS termin_id, t.beginn, t.person_id, ${lauf.unsafe(PERSON_NUMMER_SQL)}
        FROM fiaon_termine t JOIN fiaon_persons p ON p.id = t.person_id
       WHERE t.agent_id = ${ausweis} AND t.status = 'gebucht' AND t.beginn BETWEEN NOW() - INTERVAL '15 minutes' AND NOW() + INTERVAL '36 hours'
         AND ${lauf.unsafe(echtePersonSql("p"))}
         AND NOT EXISTS (SELECT 1 FROM fiaon_aras_plan x WHERE x.termin_id = t.id AND x.status IN ('wartet', 'gewaehlt', 'laeuft', 'fertig'))`) as any[];
    for (const z of zeilen) {
      const nummer = nummerVon(z);
      if (!nummer) { zaehl("termin", { ok: false, grund: "keine Nummer" }); continue; }
      const ew = await einwilligungGueltig(nummerKern(nummer), Number(z.person_id), lauf)
        ?? await einwilligungMerken({ personId: Number(z.person_id), nummer, art: "rueckruf_buchung", wortlaut: "Kunde hat einen Anruf bei Aras gebucht (Terminbuchung).", quelleArt: "termin", quelleId: String(z.termin_id), erteiltAm: new Date() }, lauf);
      const beginn = new Date(z.beginn);
      zaehl("termin", await planEinreihen({
        personId: Number(z.person_id), nummer, spielart: "termin", grund: `Termin bei Aras ${beginn.toLocaleString("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit" })} Uhr`,
        erzeugtVon: "takt", fruehAb: new Date(beginn.getTime() - 60_000), spaetBis: new Date(beginn.getTime() + 30 * 60_000), terminId: Number(z.termin_id), einwilligungId: ew.id, anlassAm: beginn,
      }, lauf));
    }
  }

  // 1b. Willkommen nach Antrag (Go-live 20.10.2026): EINMAL je Vertrag, 20 Minuten nach der Unterschrift (im Fenster), sonst zum
  //     nächsten Fensterbeginn — höchstens 24 h danach, später nie (spaet_bis). Vertragsabwicklung: nur Onboarding, kein LEXR-Tor.
  if (an("willkommen")) {
    try {
      const zeilen = (await lauf.unsafe(`
        SELECT * FROM (${willkommenSql()}) w
         WHERE NOT (w.${WILLKOMMEN_NEIN.map(([k]) => k).join(" OR w.")})
           AND NOT EXISTS (SELECT 1 FROM fiaon_aras_plan x WHERE x.spielart = 'willkommen' AND x.ref = w.ref)
         ORDER BY w.angenommen_am LIMIT 100`)) as any[];
      for (const z of zeilen) {
        const nummer = nummerVon(z);
        if (!nummer) { zaehl("willkommen", { ok: false, grund: "keine Nummer" }); continue; }
        const am = new Date(z.angenommen_am);
        zaehl("willkommen", await planEinreihen({
          personId: Number(z.person_id), ref: z.ref, nummer, spielart: "willkommen", grund: "Antrag unterschrieben — Willkommen", erzeugtVon: "takt",
          fruehAb: new Date(Math.max(Date.now(), am.getTime() + WILLKOMMEN_AB_MINUTEN * 60_000)), spaetBis: new Date(am.getTime() + WILLKOMMEN_BIS_STUNDEN * 3600_000), anlassAm: am,
        }, lauf));
      }
    } catch (e) { zaehl("willkommen", { ok: false, grund: `Fehler: ${String((e as Error)?.message ?? e).slice(0, 30)}` }); }
    // 1c. Koordination 22.10.2026 (21.10.: alle fünf Willkommens-Anrufe Mailbox oder nicht abgenommen — danach kam nichts): genau
    //     EIN zweiter Versuch, wenn der erste Mailbox oder „nicht erreicht“ ergab. Frühestens 2,5 h danach, im Fenster, höchstens
    //     24 h nach der Unterschrift (dieselbe spaet_bis-Regel) — dieselben Gründe dagegen wie beim ersten (willkommenSql: bezahlt,
    //     anderer Anruf in 24 h, Sperre …). Er zählt bei den Grenzen je Person mit; nie ein dritter (genau ein Eintrag davor).
    try {
      const zweite = (await lauf.unsafe(`
        SELECT w.*, e.am AS erster_am FROM (${willkommenSql()}) w
          JOIN LATERAL (SELECT aa.created_at AS am, aa.ergebnis FROM fiaon_aras_plan x JOIN fiaon_aras_anruf aa ON aa.plan_id = x.id
                         WHERE x.spielart = 'willkommen' AND x.ref = w.ref ORDER BY aa.id DESC LIMIT 1) e ON TRUE
         WHERE NOT (w.${WILLKOMMEN_NEIN.map(([k]) => k).join(" OR w.")})
           AND e.ergebnis IN ('${WILLKOMMEN_OHNE_GESPRAECH.join("', '")}')
           AND (SELECT COUNT(*) FROM fiaon_aras_plan y WHERE y.spielart = 'willkommen' AND y.ref = w.ref) = 1
         ORDER BY w.angenommen_am LIMIT 100`)) as any[];
      for (const z of zweite) {
        const nummer = nummerVon(z);
        if (!nummer) { zaehl("willkommen", { ok: false, grund: "keine Nummer" }); continue; }
        const am = new Date(z.angenommen_am);
        const fruehAb = new Date(Math.max(Date.now(), new Date(z.erster_am).getTime() + WILLKOMMEN_ZWEITER_NACH_MINUTEN * 60_000));
        const spaetBis = new Date(am.getTime() + WILLKOMMEN_BIS_STUNDEN * 3600_000);
        if (fruehAb.getTime() >= spaetBis.getTime()) { zaehl("willkommen", { ok: false, grund: "2. Versuch: 24 h vorbei" }); continue; }
        zaehl("willkommen", await planEinreihen({
          personId: Number(z.person_id), ref: z.ref, nummer, spielart: "willkommen", grund: "Willkommen — 2. Versuch (beim ersten niemand erreicht)", erzeugtVon: "takt",
          fruehAb, spaetBis, anlassAm: am, versuchNr: 2,
        }, lauf));
      }
    } catch (e) { zaehl("willkommen", { ok: false, grund: `Fehler 2. Versuch: ${String((e as Error)?.message ?? e).slice(0, 20)}` }); }
  }

  // 2. Zuruf-JA / Antrag-Kästchen / Antrag-Knopf / Meta-Kästchen: frische Einwilligung + Antrag abgeschickt, unbezahlt
  if (an("zuruf")) {
    const zeilen = (await lauf`
      SELECT e.id AS einwilligung_id, e.art, e.erteilt_am, e.person_id, ${lauf.unsafe(PERSON_NUMMER_SQL)}, a.ref, a.created_at AS antrag_am
        FROM fiaon_telefon_einwilligung e
        JOIN fiaon_persons p ON p.id = e.person_id
        JOIN LATERAL (SELECT a.ref, a.created_at FROM fiaon_applications a WHERE a.person_id = p.id AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
                        AND ${lauf.unsafe(abgeschicktSql("a"))} AND COALESCE(a.payment_status, '') IN ('pending_payment', 'pending', 'unpaid', '', 'expired') AND a.claimed_paid_at IS NULL
                      ORDER BY a.created_at DESC LIMIT 1) a ON TRUE
       WHERE e.widerrufen_am IS NULL AND e.art = ANY(${grenzen.regel.zurufNurNachricht ? ["zuruf_whatsapp", "zuruf_mail"] : ["zuruf_whatsapp", "zuruf_mail", "antrag_kaestchen", "antrag_knopf", "meta_kaestchen"]})
         AND e.erteilt_am > NOW() - INTERVAL '24 hours'
         AND ${lauf.unsafe(echtePersonSql("p"))} AND NOT ${lauf.unsafe(globalKundeSql("p.id"))} AND NOT COALESCE(p.is_blocked, FALSE)
         AND NOT EXISTS (SELECT 1 FROM fiaon_aras_plan x WHERE x.einwilligung_id = e.id)`) as any[];
    for (const z of zeilen) {
      const nummer = nummerVon(z);
      if (!nummer) { zaehl("zuruf", { ok: false, grund: "keine Nummer" }); continue; }
      const frisch = (Date.now() - new Date(z.antrag_am).getTime()) < STUFE_B_FRISCH_STUNDEN * 3600_000;
      const grund = z.art === "antrag_kaestchen" || z.art === "antrag_knopf" ? (frisch ? "antrag_frisch" : "Antrag mit Kästchen") : z.art === "meta_kaestchen" ? "Lead mit Kästchen" : "JA per Nachricht";
      zaehl("zuruf", await planEinreihen({
        personId: Number(z.person_id), ref: z.ref, nummer, spielart: "zuruf", grund, erzeugtVon: "takt",
        fruehAb: new Date(), spaetBis: new Date(Date.now() + 4 * 3600_000), einwilligungId: Number(z.einwilligung_id), anlassAm: new Date(z.erteilt_am),
      }, lauf));
    }
  }

  // 3. Stufe A — Zahlung gemeldet, nicht gebucht (frischeste zuerst, höchstens 14 Tage alt)
  if (an("stufe_a")) {
    const zeilen = (await lauf`
      SELECT a.ref, a.claimed_paid_at, ${lauf.unsafe(PERSON_NUMMER_SQL)}
        FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
       WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.archived_at IS NULL
         AND (a.payment_status = 'claimed_paid' OR (a.claimed_paid_at IS NOT NULL AND COALESCE(a.payment_status, '') NOT IN ('paid', 'completed', 'cancelled', 'refunded')))
         AND a.claimed_paid_at > NOW() - make_interval(days => ${STUFE_A_GEMELDET_TAGE})
         AND ${lauf.unsafe(echtePersonSql("p"))} AND NOT ${lauf.unsafe(globalKundeSql("p.id"))}
       ORDER BY a.claimed_paid_at DESC LIMIT 200`) as any[];
    for (const z of zeilen) {
      const nummer = nummerVon(z);
      if (!nummer) continue;
      zaehl("stufe_a", await planEinreihen({
        personId: Number(z.person_id), ref: z.ref, nummer, spielart: "stufe_a", grund: "Zahlung gemeldet, nicht gebucht", erzeugtVon: "takt",
        fruehAb: abBesterStunde("stufe_a"), spaetBis: fensterEnde("stufe_a", einst), anlassAm: new Date(z.claimed_paid_at), einmalProTag: true,
      }, lauf));
    }
  }

  // 4. Rate offen (Go-live C, 20.10.2026): JEDE überfällige Rate, Tag 1 bis 45 nach Fälligkeit (Stufe 2/3 dazu heute/morgen fällig)
  //    — mit den bestehenden Grenzen (1/Tag, 3/Woche je Person, Tagesmenge); nie nach Vertragsende, nie bei Abo-/Mahnstopp.
  //    Koordination 22.10.2026: Die Tage zählen nach dem BERLINER Kalender — der Füller läuft ab 00:04 Berlin, die DB-Sitzung
  //    rechnet in UTC, CURRENT_DATE war dann noch gestern („Rate 4 heute fällig“ für eine gestern fällige Rate, das Tage-Fenster
  //    um einen Tag verschoben). Und wer „zahle am …“ gesagt hat, bekommt bis nach der Überweisungszeit keinen Rate-Anruf —
  //    auch kein schon eingereihter Eintrag (der wird „verschoben“, mit Grund).
  if (an("rate")) {
    const tage = grenzen.regel.rateTage ? [...grenzen.regel.rateTage] : [-1, 0, ...Array.from({ length: RATE_TAGE_BIS }, (_, i) => i + 1)];
    if (!/^\d{4}-\d{2}-\d{2}$/.test(heute)) throw new Error(`Berliner Datum „${heute}“ unlesbar.`);
    const schwelle = zusageSchwelle(heute);
    const zeilen = (await lauf.unsafe(`
      SELECT r.id AS rate_id, r.rate_nr, r.betrag_cents, r.faellig_am::date::text AS faellig, a.ref, ${PERSON_NUMMER_SQL},
             (DATE '${heute}' - r.faellig_am::date)::int AS tage, ${zusageTagSql("p.id", schwelle)}::text AS zusage_tag
        FROM fiaon_abo_raten r
        JOIN fiaon_applications a ON a.ref = r.ref AND a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL
        JOIN fiaon_persons p ON p.id = a.person_id
       WHERE r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL
         AND ${ERINNERBARE_BESTELLUNG_SQL("a")} AND a.abo_gestoppt_am IS NULL AND a.mahnstopp_am IS NULL
         AND NOT ${RATE_NACH_ENDE_SQL_FUER("a", "r")}
         AND (DATE '${heute}' - r.faellig_am::date) IN (${tage.filter((x) => Number.isFinite(x)).join(",") || "3"})
         AND ${echtePersonSql("p")} AND NOT ${globalKundeSql("p.id")}
       ORDER BY r.betrag_cents DESC LIMIT 300`)) as any[];
    for (const z of zeilen) {
      const nummer = nummerVon(z);
      if (!nummer) continue;
      if (z.zusage_tag) { zaehl("rate", { ok: false, grund: `Zahlungszusage (Pause bis ${zusagePause(String(z.zusage_tag)).bis})` }); continue; }
      const tage = Number(z.tage);
      const grund = tage < 0 ? `Rate ${z.rate_nr} morgen fällig` : tage === 0 ? `Rate ${z.rate_nr} heute fällig` : tage === 1 ? `Rate ${z.rate_nr} seit gestern überfällig` : `Rate ${z.rate_nr} seit ${tage} Tagen überfällig`;
      const r = await planEinreihen({
        personId: Number(z.person_id), ref: z.ref, nummer, spielart: "rate", grund, erzeugtVon: "takt", rateId: Number(z.rate_id),
        betragCents: Number(z.betrag_cents ?? 0), fruehAb: abBesterStunde("rate"), spaetBis: fensterEnde("rate", einst), anlassAm: new Date(`${z.faellig}T09:00:00+02:00`), einmalProTag: true,
      }, lauf);
      zaehl("rate", r);
      // Ein älterer, verschobener Rate-Eintrag derselben Person (Zusage-Pause, je Person/Tag voll, Twilio) ist damit abgelöst — sonst
      // käme er zu seiner alten Zeit zurück und stünde neben dem neuen.
      if (r.ok && r.id) await lauf`UPDATE fiaon_aras_plan SET status = 'verfallen', verschoben_grund = 'abgelöst durch den neuen Eintrag', updated_at = NOW()
                                    WHERE person_id = ${Number(z.person_id)} AND spielart = 'rate' AND status = 'verschoben' AND id <> ${r.id}`;
    }
    // Schon eingereiht, und inzwischen „zahle am …“ gesagt (Mensch, Mara oder ARAS) → zurückstellen bis nach der Überweisungszeit.
    const eingereihte = (await lauf.unsafe(`
      SELECT pl.id, ${zusageTagSql("pl.person_id", schwelle)}::text AS zusage_tag FROM fiaon_aras_plan pl
       WHERE pl.status = 'wartet' AND pl.spielart = 'rate' AND pl.erzeugt_von = 'takt' AND pl.auftrag_von IS NULL AND pl.person_id IS NOT NULL`)) as any[];
    for (const g of eingereihte) {
      if (!g.zusage_tag) continue;
      await ratePausieren(Number(g.id), zusagePause(String(g.zusage_tag)), einst, lauf);
      zaehl("rate", { ok: false, grund: "zurückgestellt: Zahlungszusage" });
    }
  }

  // 5. Zusage nachfassen (Koordination 22.10.2026, Scheibe 3) — NICHT mehr am Tag nach dem zugesagten Datum: Dann läuft die
  //    Überweisung noch, und der Rate-Planer hält ohnehin still (zusagePause). Sondern am ersten Tag nach dieser Pause mit
  //    Raten-Fenster (zusageNachfassTag: zugesagter Tag + zwei Bank-Werktage + 1; Sonntag/Feiertag → der nächste Fenstertag),
  //    nur wenn seit der Zusage nichts bezahlt und noch etwas offen ist (zusageNachfassKandidaten — dieselbe Quelle prüft der
  //    Wähler vor dem Wählen noch einmal: zusageEntfaellt). ARAS nennt beim Eintragen genau diesen Tag (zusageNotiertSatz).
  if (an("zusage")) {
    for (const z of await zusageNachfassKandidaten(heute, lauf)) {
      const nummer = nummerVon(z);
      if (!nummer) { zaehl("zusage", { ok: false, grund: "keine Nummer" }); continue; }
      if (zusageNachfassTag(z.zusageTag, { land: nummerLand(nummer) ?? "DE", fenster: einst.fenster }) !== heute) continue;
      const tag = tagMitFenster(heute, einst);
      if (tag.tag !== heute || tag.bis.getTime() <= Date.now()) { zaehl("zusage", { ok: false, grund: "Fenster heute vorbei" }); continue; }
      zaehl("zusage", await planEinreihen({
        personId: z.personId, ref: z.ref, nummer, spielart: "zusage", erzeugtVon: "takt",
        grund: `Zusage für den ${tagKurz(z.zusageTag)} nachfassen (Überweisungszeit bis ${tagKurz(zusagePause(z.zusageTag).bis)})`,
        fruehAb: tag.ab, spaetBis: tag.bis, anlassAm: berlinZeitpunkt(z.zusageTag, 0), einmalProTag: true,
      }, lauf));
    }
  }

  // 6. Stufe B kalt, Lead frisch, Rückholung — nur eingeschaltet (LEXR) und nur mit gültiger Einwilligung (planEinreihen prüft)
  if (an("stufe_b")) {
    const zeilen = (await lauf`
      SELECT a.ref, a.created_at AS antrag_am, ${lauf.unsafe(PERSON_NUMMER_SQL)}
        FROM fiaon_applications a JOIN fiaon_persons p ON p.id = a.person_id
       WHERE a.merged_into IS NULL AND a.gdpr_deleted_at IS NULL AND a.archived_at IS NULL AND COALESCE(a.ist_entwurf, FALSE) = FALSE
         AND ${lauf.unsafe(abgeschicktSql("a"))} AND COALESCE(a.payment_status, '') IN ('pending_payment', 'pending', 'unpaid', '', 'expired') AND a.claimed_paid_at IS NULL
         AND a.created_at > NOW() - INTERVAL '30 days' AND NOT COALESCE(p.is_blocked, FALSE) AND p.werbung_gesperrt_am IS NULL
         AND ${lauf.unsafe(echtePersonSql("p"))} AND NOT ${lauf.unsafe(globalKundeSql("p.id"))}
       ORDER BY a.created_at DESC LIMIT 200`) as any[];
    for (const z of zeilen) {
      const nummer = nummerVon(z);
      if (!nummer) continue;
      zaehl("stufe_b", await planEinreihen({
        personId: Number(z.person_id), ref: z.ref, nummer, spielart: "stufe_b", grund: "Antrag abgeschickt, unbezahlt", erzeugtVon: "takt",
        fruehAb: abBesterStunde("stufe_b"), spaetBis: fensterEnde("stufe_b", einst), anlassAm: new Date(z.antrag_am), einmalProTag: true,
      }, lauf));
    }
  }

  return { eingereiht, uebersprungen, verfallen: verfallenR.length };
}

// ── Tagesplan und Lernvorschlag ────────────────────────────────────────────
export async function tagesplan(tag: string, lauf: Lauf = sqlPool): Promise<Tagesplan> {
  await arasSchema(lauf);
  const t = /^\d{4}-\d{2}-\d{2}$/.test(tag) ? tag : berlinToday();
  const geplant = (await lauf`
    SELECT spielart, EXTRACT(HOUR FROM frueh_ab AT TIME ZONE 'Europe/Berlin')::int AS h, COUNT(*)::int AS n
      FROM fiaon_aras_plan WHERE (frueh_ab AT TIME ZONE 'Europe/Berlin')::date = ${t}::date GROUP BY 1, 2`) as any[];
  const anrufe = (await lauf`
    SELECT spielart, EXTRACT(HOUR FROM created_at AT TIME ZONE 'Europe/Berlin')::int AS h,
           COUNT(*)::int AS gewaehlt, COUNT(*) FILTER (WHERE angenommen_am IS NOT NULL)::int AS erreicht,
           COUNT(*) FILTER (WHERE sekunden_sitzung >= 30)::int AS gespraeche
      FROM fiaon_aras_anruf WHERE (created_at AT TIME ZONE 'Europe/Berlin')::date = ${t}::date GROUP BY 1, 2`) as any[];
  const stunden: Tagesplan["stunden"] = [];
  for (let h = 8; h < 20; h++) {
    const je: Record<string, { geplant: number; gewaehlt: number; erreicht: number; gespraeche: number }> = {};
    for (const s of SPIELARTEN) {
      const g = geplant.find((x) => x.spielart === s && Number(x.h) === h);
      const a = anrufe.find((x) => x.spielart === s && Number(x.h) === h);
      if (g || a) je[s] = { geplant: Number(g?.n ?? 0), gewaehlt: Number(a?.gewaehlt ?? 0), erreicht: Number(a?.erreicht ?? 0), gespraeche: Number(a?.gespraeche ?? 0) };
    }
    stunden.push({ h, je });
  }
  const pool = (await lauf`SELECT spielart, COUNT(*) FILTER (WHERE status = 'wartet')::int AS pool,
                                   COUNT(*) FILTER (WHERE (created_at AT TIME ZONE 'Europe/Berlin')::date = ${t}::date)::int AS geplant
                              FROM fiaon_aras_plan GROUP BY 1`) as any[];
  const mengen: Tagesplan["mengen"] = {};
  for (const s of SPIELARTEN) { const z = pool.find((x) => x.spielart === s); mengen[s] = { pool: Number(z?.pool ?? 0), geplant: Number(z?.geplant ?? 0) }; }
  return { tag: t, stunden, mengen, lernvorschlag: await lernvorschlag(lauf) };
}

export async function lernvorschlag(lauf: Lauf = sqlPool): Promise<Lernvorschlag | null> {
  await arasSchema(lauf);
  const einst = await arasEinstellungenLesen(false, lauf);
  if (!einst.lernenAn) return null;
  const zeilen = (await lauf`
    SELECT spielart, EXTRACT(HOUR FROM created_at AT TIME ZONE 'Europe/Berlin')::int AS h, COUNT(*)::int AS n,
           COUNT(*) FILTER (WHERE sekunden_sitzung >= 30)::int AS gespraeche
      FROM fiaon_aras_anruf WHERE created_at > NOW() - INTERVAL '28 days' GROUP BY 1, 2 HAVING COUNT(*) >= 5`) as any[];
  if (zeilen.length < 6) return null;
  const stunden: Record<string, number[]> = {};
  const texte: string[] = [];
  for (const s of SPIELARTEN) {
    const je = zeilen.filter((z) => z.spielart === s);
    if (je.length < 3) continue;
    const quote: Record<number, number> = {};
    for (const z of je) quote[Number(z.h)] = Number(z.gespraeche) / Math.max(1, Number(z.n));
    const beste = Object.entries(quote).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([h]) => Number(h)).sort((a, b) => a - b);
    stunden[s] = beste;
    texte.push(`${s}: beste Stunden ${beste.map((h) => `${h}–${h + 1}`).join(", ")} Uhr`);
  }
  if (!texte.length) return null;
  return { erzeugtAm: new Date().toISOString(), text: `Aus 28 Tagen: ${texte.join(" · ")}. Nur ein Vorschlag — die Fenster änderst du selbst.`, stunden };
}

/** Rechtsgrund und Fenster für einen Eintrag kurz prüfen (für Wähler und Oberfläche). */
export function eintragFensterOffen(spielart: Spielart, land: Land, einst: ArasEinstellungen, jetzt = new Date()) {
  return fensterOffen(spielart, land, jetzt, { fenster: einst.fenster });
}
export { reihen };
