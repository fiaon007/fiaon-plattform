// ═══════════════════════════════════════════════════════════════════════════
// FIAON — MARAS MAIL „IHR VORSORGE-ÜBERBLICK“: KREIS, TAKT, TÜR UND DER KNOPF FÜR JUSTIN (E-487 (09.11.2026))
//
// Justin (09.11.2026): „für alle Privatkunden eine Mail … und direkt einen Termin beim Partner buchen“. Die Mail wirbt für
// FIAONs EIGENE Leistung (den Vorsorge-Überblick, shared/fiaon-vorsorge.ts) — ohne Partnernamen. Der Partner und die
// Einwilligung im Wortlaut erscheinen erst auf der persönlichen Seite (server/lib/fiaon-vorsorge.ts).
//
// ── NICHTS GEHT OHNE DEN KNOPF ────────────────────────────────────────────
//   · vorsorge_mail_an = 0 ist die Vorgabe (auch bei fehlender Zeile oder Störung): Der Takt tut NICHTS, die Tür in
//     make-webhook.ts lehnt jede echte Mail dieses Ereignisses ab (vorsorgeTuerSperre). Nur „Freigeben“ im Chefbüro ›
//     Mailwerk setzt an = 1 und den Kreis in EINER Buchung; „Anhalten“ setzt an = 0 — ein laufender Lauf fragt vor jeder Mail neu.
//   · Vorschau und Prüfversand senden NIE an Kunden: Die Vorschau rendert nur, der Prüfversand geht an die Testadresse des
//     Mailwerks, und in beiden führen Knopf und Abmeldelink auf die Vorschau-Seite (kein Kundenlink, keine fremde Abmeldung).
//
// ── DER KREIS (vorsorge_mail_kreis) ───────────────────────────────────────
//   „gruen“ (Vorgabe, der engere): bezahlt, Deutschland, ungekündigt, und der Hinweis nach § 7 Abs. 3 UWG stand schon bei der
//   Erhebung der Adresse (erster Antrag ab UWG_STICHTAG). „gruen_gelb“: dieselbe Menge ohne die Stichtag-Grenze.
//   NIE: A (Zahlung gemeldet), B (Antrag offen), C (nur Lead) — sie haben kein bezahltes Stufenpaket und stehen gar nicht erst
//   in der Grundmenge; Österreich/Schweiz, FIAON Global, Gesperrte, Abgemeldete, Werbesperre, Stopp, Rückläufer, Test, DSGVO,
//   minderjährig, „kein Interesse“, Widerruf oder Partner-Kontakt in 6 Monaten, überfällige Rate, Telefonkartei-Storno.
//   Die Datenbank liefert je Mensch nur FAKTEN (merkmaleSql); die Entscheidung ist EINE reine Funktion
//   (vorsorgeSperrgrund/vorsorgeEmpfaenger in shared/fiaon-vorsorge.ts) — für Zählung, Vorschau, Takt und Tür gleich.
//
// ── DER TAKT (Muster Bonitätsauskunft-Verkauf, fiaon-auskunft-verkauf.ts) ─
//   Alle 30 Minuten, 09:00–18:59 Berlin (formatToParts), Tagesdeckel 60, gleichmäßig über den Tag (vorsorgeLaufDeckel),
//   je Mensch genau EINE Mail (Person und Adresse), Rücksicht: keine andere Mail in 6 h, keine andere WERBLICHE in 20 h,
//   nach einem Fehlversuch 24 h Ruhe, höchstens drei Versuche. Vor jeder Mail: Sperren, Kreis und Freigabe frisch geprüft.
//   Versand nur über versendenUndProtokollieren → Tür (make-webhook.ts) → Motor: Protokoll in fiaon_mail_log und Akte-Verlauf.
// DATENSCHUTZ: Das Repo ist öffentlich (E-242) — hier stehen KEINE Partner- oder Kundendaten.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { berlinToday } from "./fiaon-time";
import { produktkategorieSql } from "@shared/fiaon-produktkategorie";
import { LAEUFT_UNGEKUENDIGT_SQL, KUENDIGUNG_WIRKSAM_SQL } from "@shared/fiaon-kuendigung-regel";
import { UWG_STICHTAG, ERSTER_ANTRAG_SQL, NICHT_GLOBAL_SQL, LAND_HINWEIS_SQL } from "./fiaon-auskunft-verkauf";
import {
  WERBESPERRE_KOEPFE_SQL, WERBESPERRE_ADRESSEN_SQL, LEAD_ABGEMELDET_KOEPFE_SQL, LEAD_ABGEMELDET_ADRESSEN_SQL, STOPP_KOEPFE_SQL,
} from "./fiaon-mail-frequenz";
import {
  VORSORGE_KREISE, VORSORGE_KREIS_TEXT, VORSORGE_SCHALTER, VORSORGE_SPERRGRUND_TEXT, VORSORGE_TAGESDECKEL, VORSORGE_SENDE_AB_MIN, VORSORGE_SENDE_BIS_MIN,
  VORSORGE_FASSUNG, imVorsorgeKreis, vorsorgeEinstellungenAus, vorsorgeEmpfaenger, vorsorgeHeuteNicht, vorsorgeKreisAus, vorsorgeLaufDeckel,
  vorsorgeSendezeit, vorsorgeSperrgrund, vorsorgeRollenZeile, vorsorgePartnerName,
  type VorsorgeEinstellungen, type VorsorgeKreis, type VorsorgeMerkmale, type VorsorgeRuecksicht, type VorsorgeSperrgrund,
} from "@shared/fiaon-vorsorge";
import { ensureVorsorgeTabellen, vorsorgeLink, vorsorgeVorschauLink, VORSORGE_LINK_TAGE } from "./fiaon-vorsorge";
import type { MakeWebhookPayload } from "../make-webhook";

type Lauf = typeof sqlPool;

/** Der Ereignisname — Vorlage server/mail/vorlagen/vorsorge.ts, Tür in make-webhook.ts, Register in make-events-registry.ts. */
export const VORSORGE_EVENT = "vorsorge_ueberblick" as const;
/** Werbliche Mails (Rücksicht 20 h) — dieselbe Liste wie im Auskunft-Takt (WERBLICHE_EVENTS) plus dessen Angebot. */
const WERBLICH = [
  "auskunft_angebot", "lead_followup", "lead_application_link", "lead_willkommen", "followup_48h", "antrag_erinnerung", "mara_aktion",
  "konto_karte_einladung",
];
const PROTOKOLL_ZIEL = "vorsorge-mail:";

// ═══════════════════════════════════════════════════════════════════════════
// DIE EINSTELLUNGEN — Vorgabe AUS
// ═══════════════════════════════════════════════════════════════════════════
const ALLE_SCHALTER = [VORSORGE_SCHALTER.an, VORSORGE_SCHALTER.kreis, VORSORGE_SCHALTER.freigabe];
/** Bei einer Störung der sichere Stand: AUS, Kreis „gruen“ — ein Datenbank-Schluckauf startet nie eine Welle. */
export async function vorsorgeEinstellungen(lauf: Lauf = sqlPool): Promise<VorsorgeEinstellungen> {
  try {
    const zeilen = (await lauf`SELECT key, value FROM fiaon_settings WHERE key = ANY(${ALLE_SCHALTER})`) as any[];
    return vorsorgeEinstellungenAus(Object.fromEntries(zeilen.map((z) => [String(z.key), z.value])));
  } catch (e) {
    console.error("[VORSORGE-MAIL] Einstellungen nicht lesbar — sicherer Stand (aus):", String((e as Error)?.message || e).slice(0, 160));
    return { an: false, kreis: "gruen", freigabe: null };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DIE FAKTEN JE MENSCH (Grundmenge: ein bezahltes Stufenpaket) — entschieden wird in shared/fiaon-vorsorge.ts
// ═══════════════════════════════════════════════════════════════════════════
let tabellen: Promise<{ mitRaten: boolean; mitKartei: boolean }> | null = null;
function tabellenBereit(): Promise<{ mitRaten: boolean; mitKartei: boolean }> {
  if (!tabellen) {
    tabellen = (async () => {
      await ensureVorsorgeTabellen();
      const [r] = (await sqlPool`SELECT to_regclass('public.fiaon_abo_raten') AS raten, to_regclass('public.fiaon_telefonkartei_storno') AS kartei`) as any[];
      return { mitRaten: !!r?.raten, mitKartei: !!r?.kartei };
    })().catch((e) => { tabellen = null; throw e; });
  }
  return tabellen;
}

/** Nur geprüfte Parameter-Ausdrücke („$1“) für den Personen-Filter — nie freier Text. */
function personenFilter(param?: string | null): string {
  if (!param) return "";
  if (!/^\$\d{1,2}$/.test(param)) throw new Error("[VORSORGE-MAIL] Personen-Filter: unerlaubter Ausdruck");
  return `AND a.person_id = ANY(${param}::int[])`;
}

/**
 * Eine Zeile je Mensch mit bezahltem Stufenpaket (nicht erstattet, kein Test, nicht zusammengeführt) und allen Fakten, die
 * vorsorgeSperrgrund und vorsorgeHeuteNicht brauchen. Die Adresslisten sind Unterabfragen OHNE Bezug (einmal je Abfrage
 * gebildet, NOT IN-sicher); was je Mensch gezählt wird, fragt nur die eigenen Zeilen.
 */
export function merkmaleSql(opts: { personenParam?: string | null; mitRaten: boolean; mitKartei: boolean }): string {
  const lebt = (a: string) => `(${a}.cancelled_at IS NULL AND ${a}.gdpr_deleted_at IS NULL AND (${a}.vertrag_ende_am IS NULL OR ${a}.vertrag_ende_am > NOW()))`;
  const werblich = WERBLICH.map((e) => `'${e}'`).join(", ");
  const telefonA = "NULLIF(TRIM(COALESCE(NULLIF(TRIM(a.phone), ''), a.contact_phone)), '')";
  return `
WITH vs_bezahlt AS (
  SELECT a.person_id,
         bool_or(${LAEUFT_UNGEKUENDIGT_SQL("a")} AND ${lebt("a")}) AS paket_ungekuendigt,
         (array_agg(a.ref ORDER BY a.paid_at DESC NULLS LAST, a.created_at DESC))[1] AS ref,
         MAX(COALESCE(a.paid_at, a.created_at::timestamptz)) AS aktiv_am,
         (array_agg(NULLIF(TRIM(a.email), '') ORDER BY a.paid_at DESC NULLS LAST, a.created_at DESC) FILTER (WHERE NULLIF(TRIM(a.email), '') IS NOT NULL))[1] AS a_email,
         (array_agg(NULLIF(TRIM(a.first_name), '') ORDER BY a.created_at DESC) FILTER (WHERE NULLIF(TRIM(a.first_name), '') IS NOT NULL))[1] AS a_vorname,
         (array_agg(NULLIF(TRIM(a.last_name), '') ORDER BY a.created_at DESC) FILTER (WHERE NULLIF(TRIM(a.last_name), '') IS NOT NULL))[1] AS a_nachname,
         (array_agg(${telefonA} ORDER BY a.created_at DESC) FILTER (WHERE ${telefonA} IS NOT NULL))[1] AS a_telefon,
         (array_agg(NULLIF(TRIM(a.birthdate), '') ORDER BY a.created_at DESC) FILTER (WHERE NULLIF(TRIM(a.birthdate), '') IS NOT NULL))[1] AS a_geburt
    FROM fiaon_applications a
   WHERE a.person_id IS NOT NULL AND a.merged_into IS NULL AND a.payment_status = 'paid' AND a.refunded_at IS NULL
     AND NOT COALESCE(a.ist_entwurf, FALSE) AND COALESCE(a.ref, '') NOT LIKE 'FIAON-TEST%'
     AND ${produktkategorieSql("a")} = 'konto'
     ${personenFilter(opts.personenParam)}
   GROUP BY a.person_id
),
vs_basis AS (
  SELECT p.id AS person_id, k.ref, k.aktiv_am, k.paket_ungekuendigt,
         COALESCE(NULLIF(TRIM(p.first_name), ''), k.a_vorname, '') AS vorname,
         COALESCE(NULLIF(TRIM(p.last_name), ''), k.a_nachname, '') AS nachname,
         LOWER(TRIM(COALESCE(NULLIF(TRIM(p.primary_email), ''), k.a_email, ''))) AS email,
         COALESCE(NULLIF(TRIM(p.primary_phone), ''), k.a_telefon) AS telefon,
         COALESCE(NULLIF(TRIM(p.birthdate), ''), k.a_geburt) AS geburt,
         UPPER(TRIM(COALESCE(
           (SELECT NULLIF(TRIM(c.country), '') FROM fiaon_applications c WHERE c.person_id = p.id AND c.merged_into IS NULL
               AND NULLIF(TRIM(c.country), '') IS NOT NULL ORDER BY (c.payment_status = 'paid') DESC, c.created_at DESC LIMIT 1),
           NULLIF(TRIM(p.country), ''),
           ${LAND_HINWEIS_SQL("COALESCE(NULLIF(TRIM(p.primary_phone), ''), k.a_telefon)", "COALESCE(NULLIF(TRIM(p.primary_email), ''), k.a_email)")},
           ''))) AS land,
         ${ERSTER_ANTRAG_SQL("p.id")} AS erster_antrag_am,
         COALESCE(p.is_blocked, FALSE) AS vertriebssperre,
         (COALESCE(p.priority_tier, 0) = -1) AS ausgeschlossen
    FROM vs_bezahlt k JOIN fiaon_persons p ON p.id = k.person_id
   WHERE p.merged_into_person_id IS NULL
)
SELECT b.person_id, b.ref, b.vorname, b.nachname, b.email, b.aktiv_am, b.land,
       TRUE AS bezahlt,
       (b.paket_ungekuendigt AND NOT ${KUENDIGUNG_WIRKSAM_SQL("b.person_id")}) AS ungekuendigt,
       (b.email LIKE '%_@_%._%' AND b.email NOT LIKE '% %') AS mail_ok,
       (LENGTH(regexp_replace(COALESCE(b.telefon, ''), '[^0-9]', '', 'g')) >= 6) AS telefon_ok,
       EXISTS (SELECT 1 FROM fiaon_persons t WHERE (t.id = b.person_id OR t.merged_into_person_id = b.person_id) AND t.ist_test_am IS NOT NULL) AS test,
       b.vertriebssperre, b.ausgeschlossen,
       (COALESCE(b.geburt, '') ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}'
        AND LEFT(b.geburt, 10) > to_char((NOW() AT TIME ZONE 'Europe/Berlin')::date - INTERVAL '18 years', 'YYYY-MM-DD')) AS minderjaehrig,
       (COALESCE(b.person_id IN ${WERBESPERRE_KOEPFE_SQL}, FALSE) OR COALESCE(b.email IN ${WERBESPERRE_ADRESSEN_SQL}, FALSE)) AS werbesperre,
       (COALESCE(b.person_id IN ${LEAD_ABGEMELDET_KOEPFE_SQL}, FALSE) OR COALESCE(b.email IN ${LEAD_ABGEMELDET_ADRESSEN_SQL}, FALSE)
        OR EXISTS (SELECT 1 FROM fiaon_leads ls WHERE ls.person_id = b.person_id AND ls.strecke_stopp = 'abgemeldet')) AS abgemeldet,
       COALESCE(b.person_id IN ${STOPP_KOEPFE_SQL}, FALSE) AS stopp,
       (COALESCE(b.email IN (SELECT DISTINCT LOWER(TRIM(z.empfaenger)) FROM fiaon_mail_log z
                              WHERE z.zustellung IN ('gebounct', 'blockiert', 'spam') AND z.empfaenger IS NOT NULL), FALSE)
        OR COALESCE(b.email IN (SELECT LOWER(TRIM(lb.email)) FROM fiaon_leads lb WHERE lb.bounce_am IS NOT NULL AND NULLIF(TRIM(lb.email), '') IS NOT NULL), FALSE)) AS unzustellbar,
       EXISTS (SELECT 1 FROM fiaon_applications g WHERE g.person_id = b.person_id AND g.gdpr_deleted_at IS NOT NULL) AS dsgvo,
       (EXISTS (SELECT 1 FROM fiaon_global_angebote ga WHERE ga.person_id = b.person_id) OR NOT ${NICHT_GLOBAL_SQL("b.person_id")}) AS global,
       COALESCE((SELECT e.art FROM fiaon_koop_einwilligungen e WHERE e.person_id = b.person_id AND e.art IN ('interesse', 'abgelehnt')
                  ORDER BY e.erteilt_am DESC LIMIT 1) = 'abgelehnt', FALSE) AS kein_interesse,
       EXISTS (SELECT 1 FROM fiaon_koop_einwilligungen ew WHERE ew.person_id = b.person_id AND ew.widerrufen_am > NOW() - INTERVAL '6 months') AS widerrufen,
       EXISTS (SELECT 1 FROM fiaon_koop_kontakte kk WHERE kk.person_id = b.person_id AND kk.status <> 'storniert'
                 AND kk.created_at > NOW() - INTERVAL '6 months') AS kontakt_kuerzlich,
       ${opts.mitRaten ? `EXISTS (SELECT 1 FROM fiaon_abo_raten r JOIN fiaon_applications ra ON ra.ref = r.ref
                 WHERE ra.person_id = b.person_id AND ra.merged_into IS NULL AND r.status = 'offen' AND r.storniert_am IS NULL
                   AND r.faellig_am < (NOW() AT TIME ZONE 'Europe/Berlin')::date)` : "FALSE"} AS rate_ueberfaellig,
       ${opts.mitKartei ? `COALESCE(b.person_id IN (SELECT ts.person_id FROM fiaon_telefonkartei_storno ts
                 WHERE ts.person_id IS NOT NULL AND ts.zurueck_am IS NULL), FALSE)` : "FALSE"} AS storniert,
       COALESCE(b.erster_antrag_am >= '${UWG_STICHTAG}'::timestamptz, FALSE) AS nach_stichtag,
       (EXISTS (SELECT 1 FROM fiaon_mail_log mv WHERE mv.person_id = b.person_id AND mv.event = '${VORSORGE_EVENT}' AND mv.status = 'versandt'
                  AND COALESCE(mv.art, 'echt') = 'echt')
        OR COALESCE(b.email IN (SELECT LOWER(TRIM(mx.empfaenger)) FROM fiaon_mail_log mx WHERE mx.event = '${VORSORGE_EVENT}' AND mx.status = 'versandt'
                                 AND COALESCE(mx.art, 'echt') = 'echt' AND mx.empfaenger IS NOT NULL), FALSE)) AS versandt,
       EXISTS (SELECT 1 FROM fiaon_mail_log m6 WHERE m6.person_id = b.person_id AND COALESCE(m6.art, 'echt') = 'echt' AND m6.status = 'versandt'
                 AND m6.created_at > NOW() - INTERVAL '6 hours') AS mail_6h,
       EXISTS (SELECT 1 FROM fiaon_mail_log w20 WHERE (w20.person_id = b.person_id OR LOWER(TRIM(w20.empfaenger)) = b.email)
                 AND w20.created_at > NOW() - INTERVAL '20 hours' AND COALESCE(w20.art, 'echt') = 'echt' AND w20.status IN ('versandt', 'gesendet')
                 AND (w20.event IN (${werblich}) OR w20.event LIKE 'rueckhol%')) AS werbung_20h,
       EXISTS (SELECT 1 FROM fiaon_mail_log f24 WHERE f24.person_id = b.person_id AND f24.event = '${VORSORGE_EVENT}' AND f24.status <> 'versandt'
                 AND COALESCE(f24.art, 'echt') = 'echt' AND f24.created_at > NOW() - INTERVAL '24 hours') AS fehlversuch_24h,
       (SELECT COUNT(*) FROM fiaon_mail_log fy WHERE fy.person_id = b.person_id AND fy.event = '${VORSORGE_EVENT}' AND fy.status = 'fehlgeschlagen'
          AND COALESCE(fy.art, 'echt') = 'echt')::int AS fehlversuche
  FROM vs_basis b`;
}

export interface VorsorgeMensch {
  personId: number; ref: string | null; vorname: string; nachname: string; email: string; aktivAm: string | null;
  merkmale: VorsorgeMerkmale; ruecksicht: VorsorgeRuecksicht;
}
/** Eine Zeile aus merkmaleSql → die Fakten für die reine Entscheidung. */
export function menschAus(z: any): VorsorgeMensch {
  const ja = (v: unknown) => v === true;
  return {
    personId: Number(z.person_id), ref: z.ref ? String(z.ref) : null, vorname: String(z.vorname ?? ""), nachname: String(z.nachname ?? ""),
    email: String(z.email ?? ""), aktivAm: z.aktiv_am ? new Date(z.aktiv_am).toISOString() : null,
    merkmale: {
      bezahlt: ja(z.bezahlt), ungekuendigt: ja(z.ungekuendigt), land: String(z.land ?? ""), mailOk: ja(z.mail_ok), telefonOk: ja(z.telefon_ok),
      test: ja(z.test), vertriebssperre: ja(z.vertriebssperre), ausgeschlossen: ja(z.ausgeschlossen), minderjaehrig: ja(z.minderjaehrig),
      werbesperre: ja(z.werbesperre), abgemeldet: ja(z.abgemeldet), stopp: ja(z.stopp), unzustellbar: ja(z.unzustellbar), dsgvo: ja(z.dsgvo),
      global: ja(z.global), keinInteresse: ja(z.kein_interesse), widerrufen: ja(z.widerrufen), kontaktKuerzlich: ja(z.kontakt_kuerzlich),
      rateUeberfaellig: ja(z.rate_ueberfaellig), storniert: ja(z.storniert), nachStichtag: ja(z.nach_stichtag), versandt: ja(z.versandt),
    },
    ruecksicht: { mail6h: ja(z.mail_6h), werbung20h: ja(z.werbung_20h), fehlversuch24h: ja(z.fehlversuch_24h), fehlversuche: Number(z.fehlversuche ?? 0) },
  };
}

/** Alle Menschen der Grundmenge (oder nur `nurPersonen`) mit ihren Fakten. */
export async function menschenLesen(nurPersonen?: number[] | null, lauf: Lauf = sqlPool): Promise<VorsorgeMensch[]> {
  const t = await tabellenBereit();
  const mitFilter = Array.isArray(nurPersonen);
  const ids = mitFilter ? Array.from(new Set(nurPersonen!.map(Number).filter((n) => Number.isInteger(n) && n > 0))) : [];
  if (mitFilter && !ids.length) return [];
  const sql = `${merkmaleSql({ personenParam: mitFilter ? "$1" : null, mitRaten: t.mitRaten, mitKartei: t.mitKartei })}
   ORDER BY b.aktiv_am DESC NULLS LAST, b.person_id`;
  const zeilen = (await (mitFilter ? lauf.unsafe(sql, [ids]) : lauf.unsafe(sql))) as any[];
  return zeilen.map(menschAus);
}

const maske = (mail: string) => mail.replace(/^(.{2}).*(@.*)$/, "$1…$2");

// ═══════════════════════════════════════════════════════════════════════════
// DIE TÜR — eine Regel für Takt und Mail-Motor (make-webhook.ts)
// ═══════════════════════════════════════════════════════════════════════════
/** Ist ein aktiver Vorsorge-Partner da? Ohne ihn hätte die Seite nichts zu buchen — dann keine Mail. */
async function partnerDa(jetzt?: Date): Promise<boolean> {
  const { koopVorsorgePartner } = await import("./fiaon-koop-lieferung");
  return (await koopVorsorgePartner(jetzt)).length > 0;
}

/**
 * Darf die Mail an diesen Menschen — frisch geprüft, BEVOR eine Nutzlast entsteht: Grundmenge und Sperrgrund, Kreis, noch
 * nie bekommen, die Sperren von koopKandidat und die Werbe-Regel des Menschen (menschSperre: Familie, Stopp, Test,
 * Vertriebssperre, gekündigt) und ein aktiver Vorsorge-Partner. null = darf. Jeder Grund beginnt mit „Sperre:“ — ein Urteil
 * über den Menschen, keine Störung des Versands.
 */
export async function vorsorgeSperre(personId: number, kreis: VorsorgeKreis): Promise<string | null> {
  if (!Number.isInteger(personId) || personId <= 0) return "Sperre: ohne Person kein Vorsorge-Überblick.";
  const [m] = await menschenLesen([personId]);
  if (!m) return "Sperre: kein bezahltes Stufenpaket (A, B, C) — kein Vorsorge-Überblick.";
  const grund = vorsorgeSperrgrund(m.merkmale);
  if (grund) return `Sperre: ${VORSORGE_SPERRGRUND_TEXT[grund]} — kein Vorsorge-Überblick.`;
  if (!imVorsorgeKreis(kreis, m.merkmale)) return `Sperre: nicht im Kreis „${VORSORGE_KREIS_TEXT[kreis].titel}“ (erster Antrag vor dem Widerspruchs-Hinweis) — kein Vorsorge-Überblick.`;
  if (m.merkmale.versandt) return "Sperre: hat den Vorsorge-Überblick schon bekommen — je Mensch genau eine Mail.";
  const { koopKandidat } = await import("./fiaon-koop-lieferung");
  const k = await koopKandidat(personId);
  if (!k) return "Sperre: Akte fehlt — kein Vorsorge-Überblick.";
  if (k.sperren.length) return `Sperre: ${k.sperren[0]} — kein Vorsorge-Überblick.`;
  const { menschSperre, werbungVerboten } = await import("./fiaon-mail-frequenz");
  const verboten = werbungVerboten(await menschSperre(personId));
  if (verboten) return `Sperre: ${verboten} — kein Vorsorge-Überblick.`;
  if (!(await partnerDa())) return "Sperre: kein aktiver Vorsorge-Partner — die Seite hätte nichts zu buchen.";
  return null;
}

/**
 * DIE TÜR IM MAIL-MOTOR (make-webhook.ts): Ohne Freigabe geht keine echte Mail dieses Ereignisses raus — auch nicht von
 * Hand —, und mit Freigabe nur an Menschen im eingestellten Kreis ohne Sperre. Prüfversände (test: true) prüft die Tür nicht.
 */
export async function vorsorgeTuerSperre(personId: number | null): Promise<string | null> {
  if (!personId) return "Sperre: Vorsorge-Überblick nur an bekannte Kunden — ohne Person nicht.";
  const e = await vorsorgeEinstellungen();
  if (!e.an) return "Sperre: Die Mail „Ihr Vorsorge-Überblick“ ist nicht freigegeben (Chefbüro › Mailwerk) — nicht verschickt.";
  return vorsorgeSperre(personId, e.kreis);
}

/** Die Nutzlast der Mail — `vorschau`: Knopf und Abmeldelink zeigen auf die Vorschau-Seite, nie auf einen Kundenlink. */
export async function vorsorgeNutzlast(m: Pick<VorsorgeMensch, "personId" | "email" | "vorname" | "nachname">, opts: { vorschau?: boolean; an?: string } = {}): Promise<MakeWebhookPayload> {
  if (opts.vorschau) {
    const vorschau = vorsorgeVorschauLink();
    return { email: opts.an ?? m.email, vorname: m.vorname, nachname: m.nachname, link: vorschau, abmelde_url: `${vorschau}#abmelden` };
  }
  const { abmeldeLinkPerson } = await import("../routes/fiaon-abmelden");
  return {
    email: m.email, person_id: m.personId, vorname: m.vorname, nachname: m.nachname,
    link: vorsorgeLink(m.personId), abmelde_url: abmeldeLinkPerson(m.personId),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DER TAKT — alle 30 Minuten (server/routes.ts, tageslauf „vorsorge_mail“)
// ═══════════════════════════════════════════════════════════════════════════
export interface VorsorgeTaktErgebnis {
  grund?: string; geprueft: number; mails: number; uebersprungen: number; gruende: Record<string, number>;
  deckel?: number; plan?: { personId: number; name: string }[];
}
let taktLaeuft = false;
/** Wen die Vorprüfung HEUTE verworfen hat — sonst hielte er jeden Lauf die ersten Plätze (Muster mailHeuteNicht, Auskunft-Takt). */
const heuteNicht = new Map<number, string>();

/** Mails dieses Ereignisses heute (Berliner Tag), nur echte. */
export async function vorsorgeHeuteVersandt(lauf: Lauf = sqlPool): Promise<number> {
  const [z] = (await lauf`
    SELECT COUNT(*)::int AS n FROM fiaon_mail_log
     WHERE event = ${VORSORGE_EVENT} AND status = 'versandt' AND COALESCE(art, 'echt') = 'echt'
       AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'`) as any[];
  return Number(z?.n ?? 0);
}

/** Wer heute dran wäre — im Kreis, ohne Sperrgrund, noch nie bekommen, mit der Rücksicht des Tages. */
export async function vorsorgeKandidaten(kreis: VorsorgeKreis, limit: number, opts: { ruecksicht?: boolean; nurPersonen?: number[] | null } = {}): Promise<VorsorgeMensch[]> {
  const alle = await menschenLesen(opts.nurPersonen ?? null);
  return alle
    .filter((m) => vorsorgeEmpfaenger(m.merkmale, kreis) && (opts.ruecksicht === false || !vorsorgeHeuteNicht(m.ruecksicht)))
    .slice(0, Math.max(0, limit));
}

/**
 * EIN DURCHLAUF. Ohne Freigabe nichts. `trocken` = nur planen (fragt den Schalter nicht). `jetzt` = die Uhr (Prüfstand).
 */
export async function vorsorgeTakt(opts: { jetzt?: Date; trocken?: boolean; nurPersonen?: number[] | null } = {}): Promise<VorsorgeTaktErgebnis> {
  const leer = (grund: string): VorsorgeTaktErgebnis => ({ grund, geprueft: 0, mails: 0, uebersprungen: 0, gruende: {} });
  if (!opts.trocken && taktLaeuft) return leer("Takt läuft noch");
  const e = await vorsorgeEinstellungen();
  if (!opts.trocken && !e.an) return leer(`nicht freigegeben (${VORSORGE_SCHALTER.an} = 0)`);
  if (!opts.trocken && !vorsorgeSendezeit(opts.jetzt)) return leer("außerhalb des Fensters 09–19 Uhr (Berlin)");
  if (!opts.trocken) taktLaeuft = true;
  try {
    if (!(await partnerDa(opts.jetzt))) return leer("kein aktiver Vorsorge-Partner — kein Versand");
    const heute = await vorsorgeHeuteVersandt();
    const rest = Math.max(0, VORSORGE_TAGESDECKEL - heute);
    if (rest <= 0) return leer(`Tagesdeckel erreicht (${heute}/${VORSORGE_TAGESDECKEL})`);
    let platz = opts.trocken ? rest : vorsorgeLaufDeckel(rest, opts.jetzt);
    if (platz <= 0) return leer("dieser Lauf hat keinen Platz (gleichmäßig über den Tag)");
    const tag = berlinToday(opts.jetzt ?? new Date());
    for (const [id, t] of Array.from(heuteNicht)) if (t !== tag) heuteNicht.delete(id);
    const faelle = (await vorsorgeKandidaten(e.kreis, platz + 10 + heuteNicht.size, { nurPersonen: opts.nurPersonen }))
      .filter((f) => opts.trocken || !heuteNicht.has(f.personId));
    const erg: VorsorgeTaktErgebnis = { geprueft: faelle.length, mails: 0, uebersprungen: 0, gruende: {}, deckel: platz, ...(opts.trocken ? { plan: [] } : {}) };
    const zaehle = (g: string) => { const s = g.slice(0, 140); erg.gruende[s] = (erg.gruende[s] ?? 0) + 1; erg.uebersprungen++; };
    /** „Anhalten“ heißt ab sofort nichts mehr — vor JEDER Mail neu gefragt (eine Störung beim Lesen heißt „aus“). */
    const nochAn = async (): Promise<boolean> => (await vorsorgeEinstellungen()).an;
    const adressenImLauf = new Set<string>();
    let fehlerInFolge = 0;
    const { versendenUndProtokollieren } = await import("./fiaon-mail-log");
    for (const f of faelle) {
      if (platz <= 0) break;
      if (opts.trocken) { erg.plan!.push({ personId: f.personId, name: `${f.vorname} ${f.nachname}`.trim() }); platz--; continue; }
      if (!vorsorgeSendezeit(opts.jetzt)) { zaehle("Fenster geschlossen — Rest nicht gesendet"); break; }
      if (!(await nochAn())) { erg.grund = "angehalten — Rest nicht gesendet"; break; }
      if (adressenImLauf.has(f.email)) { zaehle("Adresse in diesem Lauf schon angeschrieben"); continue; }
      try {
        const nein = await vorsorgeSperre(f.personId, e.kreis);
        if (nein) { heuteNicht.set(f.personId, tag); zaehle(nein); continue; }
        adressenImLauf.add(f.email);
        const nutzlast = await vorsorgeNutzlast(f);
        const v = await versendenUndProtokollieren(VORSORGE_EVENT, nutzlast, {
          personId: f.personId, verlaufRef: f.ref,
          verlaufText: `Vorsorge-Überblick: Maras Einladung per E-Mail (Kreis „${VORSORGE_KREIS_TEXT[e.kreis].titel}“, persönlicher Link ${VORSORGE_LINK_TAGE} Tage gültig). Werbung für die FIAON-eigene Leistung, ohne Partnernamen.`,
        });
        if (v.status === "versandt") { erg.mails++; platz--; fehlerInFolge = 0; }
        else if (/^(Sperre|Frequenzbremse)/.test(String(v.grund ?? ""))) { heuteNicht.set(f.personId, tag); zaehle(`Tür: ${v.grund}`); }
        else {
          zaehle(`Mail: ${v.grund ?? v.status}`);
          // Drei Fehlschläge hintereinander heißen: Es klemmt am Versand, nicht am Menschen.
          if (++fehlerInFolge >= 3) { erg.grund = `Versand klemmt (${v.grund ?? v.status}) — Lauf beendet`; break; }
        }
      } catch (err) {
        heuteNicht.set(f.personId, tag);
        zaehle(String((err as Error)?.message || err));
        console.error(`[VORSORGE-MAIL] Person ${f.personId}:`, err);
        if (++fehlerInFolge >= 3) { erg.grund = "Drei Fehler hintereinander — Lauf beendet"; break; }
      }
    }
    if (!opts.trocken && erg.mails) console.log(`[VORSORGE-MAIL] Kreis ${e.kreis}: ${erg.mails} Mails (heute ${heute + erg.mails}/${VORSORGE_TAGESDECKEL})`);
    return erg;
  } finally {
    if (!opts.trocken) taktLaeuft = false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DAS CHEFBÜRO › MAILWERK — Zahlen, Vorschau, Prüfversand, Freigeben, Anhalten
// ═══════════════════════════════════════════════════════════════════════════
export interface VorsorgeChefStand {
  einstellungen: VorsorgeEinstellungen;
  kreise: Record<VorsorgeKreis, { gesamt: number; offen: number; versandt: number }>;
  gesperrt: { grund: VorsorgeSperrgrund; text: string; anzahl: number }[];
  bezahlt: number;
  heute: { versandt: number; deckel: number };
  fenster: string;
  partner: { name: string; rolle: string; freieTermine: number; sperre: string | null }[];
  naechste: Record<VorsorgeKreis, { name: string; mail: string }[]>;
  trichter: { versandt: number; geoeffnet: number; ueberblick: number; gebucht: number };
  protokoll: { zeit: string; text: string; wer: string }[];
  testAdresse: string;
}

const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

async function protokollLesen(anzahl = 8): Promise<VorsorgeChefStand["protokoll"]> {
  try {
    const zeilen = (await sqlPool`
      SELECT l.zeit, l.notiz, l.stufe, l.agent_id,
             COALESCE(NULLIF(ag.name, ''), NULLIF(TRIM(CONCAT_WS(' ', ag.first_name, ag.last_name)), '')) AS name
        FROM fiaon_admin_log l LEFT JOIN fiaon_agents ag ON ag.id = l.agent_id
       WHERE l.ziel LIKE ${PROTOKOLL_ZIEL + "%"}
       ORDER BY l.zeit DESC, l.id DESC LIMIT ${anzahl}`) as any[];
    return zeilen.map((z) => ({
      zeit: new Date(z.zeit).toISOString(), text: String(z.notiz ?? ""),
      wer: z.name ? String(z.name) : z.agent_id ? `Mitarbeiter #${z.agent_id}` : z.stufe === "inhaber" ? "Inhaber" : "Chefbüro",
    }));
  } catch { return []; }
}

export async function vorsorgeChefStand(): Promise<VorsorgeChefStand> {
  await tabellenBereit();
  const { koopVorsorgePartner, koopLieferStand, koopFreieTermine, koopSchalterAus } = await import("./fiaon-koop-lieferung");
  const { koopDatenAus } = await import("./fiaon-global-angebot-koop");
  const [einstellungen, menschen, heute, zeilen, protokoll, test] = await Promise.all([
    vorsorgeEinstellungen(), menschenLesen(), vorsorgeHeuteVersandt(), koopVorsorgePartner(), protokollLesen(),
    sqlPool`SELECT value FROM fiaon_settings WHERE key = 'mail_test_adresse'` as Promise<any[]>,
  ]);
  const kreise: VorsorgeChefStand["kreise"] = { gruen: { gesamt: 0, offen: 0, versandt: 0 }, gruen_gelb: { gesamt: 0, offen: 0, versandt: 0 } };
  const gesperrt = new Map<VorsorgeSperrgrund, number>();
  const naechste: VorsorgeChefStand["naechste"] = { gruen: [], gruen_gelb: [] };
  for (const m of menschen) {
    const g = vorsorgeSperrgrund(m.merkmale);
    if (g) { gesperrt.set(g, (gesperrt.get(g) ?? 0) + 1); continue; }
    for (const k of VORSORGE_KREISE) {
      if (!imVorsorgeKreis(k, m.merkmale)) continue;
      kreise[k].gesamt++;
      if (m.merkmale.versandt) kreise[k].versandt++;
      else {
        kreise[k].offen++;
        if (naechste[k].length < 8) naechste[k].push({ name: `${m.vorname} ${m.nachname}`.trim() || "Ohne Namen", mail: maske(m.email) });
      }
    }
  }
  const partner: VorsorgeChefStand["partner"] = [];
  for (const z of zeilen) {
    const d = koopDatenAus(z);
    const stand = await koopLieferStand(z);
    partner.push({
      name: vorsorgePartnerName(d.partner), rolle: vorsorgeRollenZeile(koopSchalterAus(z).rolle, d.partner.anrede),
      freieTermine: stand.sperre ? 0 : (await koopFreieTermine(z)).length, sperre: stand.sperre,
    });
  }
  const [t] = (await sqlPool`
    SELECT (SELECT COUNT(*) FROM fiaon_mail_log WHERE event = ${VORSORGE_EVENT} AND status = 'versandt' AND COALESCE(art, 'echt') = 'echt')::int AS versandt,
           (SELECT COUNT(*) FROM fiaon_vorsorge_ueberblick WHERE link_geoeffnet_am IS NOT NULL)::int AS geoeffnet,
           (SELECT COUNT(*) FROM fiaon_vorsorge_ueberblick WHERE gespeichert_am IS NOT NULL AND themen <> '[]'::jsonb)::int AS ueberblick,
           (SELECT COUNT(*) FROM fiaon_koop_einwilligungen e JOIN fiaon_koop_kontakte k ON k.einwilligung_id = e.id
             WHERE e.fassung = ${VORSORGE_FASSUNG} AND k.status <> 'storniert')::int AS gebucht`) as any[];
  return {
    einstellungen, kreise,
    gesperrt: Array.from(gesperrt.entries()).sort((a, b) => b[1] - a[1]).map(([grund, anzahl]) => ({ grund, text: VORSORGE_SPERRGRUND_TEXT[grund], anzahl })),
    bezahlt: menschen.length,
    heute: { versandt: heute, deckel: VORSORGE_TAGESDECKEL },
    fenster: `${hhmm(VORSORGE_SENDE_AB_MIN)}–${hhmm(VORSORGE_SENDE_BIS_MIN)} Uhr`,
    partner, naechste,
    trichter: { versandt: Number(t?.versandt ?? 0), geoeffnet: Number(t?.geoeffnet ?? 0), ueberblick: Number(t?.ueberblick ?? 0), gebucht: Number(t?.gebucht ?? 0) },
    protokoll, testAdresse: String(test?.[0]?.value ?? "").trim(),
  };
}

/** Wessen echte Daten Vorschau und Prüfversand zeigen: der Nächste im Kreis — sonst ein erfundener Mensch. */
async function vorschauMensch(kreis: VorsorgeKreis): Promise<Pick<VorsorgeMensch, "personId" | "email" | "vorname" | "nachname"> & { echt: boolean }> {
  const [m] = await vorsorgeKandidaten(kreis, 1, { ruecksicht: false });
  return m ? { ...m, echt: true } : { personId: 0, email: "max.mustermann@example.com", vorname: "Max", nachname: "Mustermann", echt: false };
}

/** VORSCHAU — rendert nur, sendet nie. Knopf und Abmeldelink zeigen auf die Vorschau-Seite. */
export async function vorsorgeVorschau(kreisRoh: unknown): Promise<{ html: string; betreff: string; fuer: string; fehlend: string[] }> {
  const kreis = vorsorgeKreisAus(kreisRoh);
  const m = await vorschauMensch(kreis);
  const { mailRendern } = await import("../mail/motor");
  const r = mailRendern(VORSORGE_EVENT, await vorsorgeNutzlast(m, { vorschau: true }));
  if (!r) throw new Error("Vorlage vorsorge_ueberblick fehlt im Motor");
  return { html: r.html, betreff: r.betreff, fuer: m.echt ? `${m.vorname} ${m.nachname} (${maske(m.email)})` : "Beispiel (niemand im Kreis offen)", fehlend: r.fehlend };
}

/** PRÜFVERSAND an die Testadresse — dieselbe Mail wie die Vorschau, als Test im Protokoll, nie an einen Kunden. */
export async function vorsorgePruefversand(kreisRoh: unknown, anRoh: unknown): Promise<{ ok: true; meldung: string } | { ok: false; error: string }> {
  const kreis = vorsorgeKreisAus(kreisRoh);
  let an = String(anRoh ?? "").trim();
  if (!an) {
    const [s] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'mail_test_adresse'`) as any[];
    an = String(s?.value || process.env.BETREIBER_MAIL || "").trim();
  }
  if (!/^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(an)) return { ok: false, error: "Keine gültige Testadresse — bitte oben im Mailwerk eintragen." };
  const m = await vorschauMensch(kreis);
  const nutzlast = { ...(await vorsorgeNutzlast(m, { vorschau: true, an })), test: true };
  const motor = await import("../mail/motor");
  const r = await motor.mailDirektSenden(VORSORGE_EVENT, nutzlast);
  const { mailProtokoll } = await import("./fiaon-mail-log");
  await mailProtokoll({
    event: VORSORGE_EVENT, empfaenger: an, status: r.ok ? "versandt" : "fehlgeschlagen", grund: r.ok ? (r.grund ?? null) : (r.grund ?? "unbekannt"),
    ausgeloestVon: "Prüfversand (Mailwerk › Vorsorge-Überblick)", brevoMessageId: r.messageId,
  });
  // Als Test markieren — zählt gegen keinen Deckel und nicht als „schon bekommen“ (Muster Prüfversand im Mailwerk).
  await sqlPool`UPDATE fiaon_mail_log SET art = 'test' WHERE id = (SELECT MAX(id) FROM fiaon_mail_log WHERE event = ${VORSORGE_EVENT} AND empfaenger = ${an})`.catch(() => {});
  return r.ok
    ? { ok: true, meldung: `Prüfversand an ${an} raus (Brevo ${r.messageId ?? "ohne Id"}). Knopf und Abmeldelink führen auf die Vorschau-Seite.` }
    : { ok: false, error: r.grund ?? "Prüfversand fehlgeschlagen." };
}

/**
 * „FREIGEBEN“ — Justins Knopf: Kreis und Schalter in EINER Buchung, dazu wer und wann. Ohne aktiven Vorsorge-Partner oder
 * ohne offenen Empfänger im Kreis geht es nicht (die Seite hätte nichts zu buchen bzw. es gäbe nichts zu senden).
 */
export async function vorsorgeFreigeben(kreisRoh: unknown, wer: string): Promise<{ ok: true; vorher: VorsorgeEinstellungen; nachher: VorsorgeEinstellungen; offen: number } | { ok: false; error: string }> {
  if (!(VORSORGE_KREISE as readonly string[]).includes(String(kreisRoh ?? ""))) return { ok: false, error: "Bitte zuerst einen Kreis wählen: Grün oder Grün + Gelb." };
  const kreis = vorsorgeKreisAus(kreisRoh);
  if (!(await partnerDa())) return { ok: false, error: "Es gibt keinen aktiven Vorsorge-Partner — ohne Partner hätte die Seite nichts zu buchen." };
  const offen = (await vorsorgeKandidaten(kreis, 100_000, { ruecksicht: false })).length;
  if (!offen) return { ok: false, error: `Im Kreis „${VORSORGE_KREIS_TEXT[kreis].titel}“ wartet niemand mehr auf die Mail.` };
  const vorher = await vorsorgeEinstellungen();
  const freigabe = JSON.stringify({ am: new Date().toISOString(), von: wer.slice(0, 120), kreis, angehaltenAm: null, angehaltenVon: null });
  await (sqlPool as any).begin(async (tx: Lauf) => {
    for (const [key, value] of [[VORSORGE_SCHALTER.kreis, kreis], [VORSORGE_SCHALTER.freigabe, freigabe], [VORSORGE_SCHALTER.an, "1"]] as const) {
      await tx`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${key}, ${value}, NOW())
               ON CONFLICT (key) DO UPDATE SET value = ${value}, updated_at = NOW()`;
    }
  });
  return { ok: true, vorher, nachher: await vorsorgeEinstellungen(), offen };
}

/** „ANHALTEN“ — ab sofort nichts mehr (der laufende Lauf fragt vor jeder Mail). Kreis und Freigabe bleiben zur Nachsicht stehen. */
export async function vorsorgeAnhalten(wer: string): Promise<{ ok: true; nachher: VorsorgeEinstellungen }> {
  const vorher = await vorsorgeEinstellungen();
  const freigabe = vorher.freigabe ? JSON.stringify({ ...vorher.freigabe, angehaltenAm: new Date().toISOString(), angehaltenVon: wer.slice(0, 120) }) : null;
  await (sqlPool as any).begin(async (tx: Lauf) => {
    await tx`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${VORSORGE_SCHALTER.an}, '0', NOW())
             ON CONFLICT (key) DO UPDATE SET value = '0', updated_at = NOW()`;
    if (freigabe) {
      await tx`INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${VORSORGE_SCHALTER.freigabe}, ${freigabe}, NOW())
               ON CONFLICT (key) DO UPDATE SET value = ${freigabe}, updated_at = NOW()`;
    }
  });
  return { ok: true, nachher: await vorsorgeEinstellungen() };
}

/** Für den Protokoll-Satz im Chefbüro: „Kreis Grün + Gelb, 163 offen, höchstens 60 am Tag, 09:00–19:00 Uhr“. */
export function freigabeSatz(kreis: VorsorgeKreis, offen: number): string {
  return `Kreis „${VORSORGE_KREIS_TEXT[kreis].titel}“, ${offen} offen, höchstens ${VORSORGE_TAGESDECKEL} am Tag, ${hhmm(VORSORGE_SENDE_AB_MIN)}–${hhmm(VORSORGE_SENDE_BIS_MIN)} Uhr Berlin, je Mensch eine Mail`;
}
export { PROTOKOLL_ZIEL as VORSORGE_PROTOKOLL_ZIEL };
