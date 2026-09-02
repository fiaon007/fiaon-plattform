// ═══════════════════════════════════════════════════════════════════════════
// DIE RÜCKHOLUNG — fünf Lagen, ein Ziel: der Termin (02.09.2026, E-074)
//
// ── WAS HIER ZURÜCKGEHOLT WIRD ────────────────────────────────────────────
// 2.001 fertige, unbezahlte Anträge mit 96.840 € Auftragswert. Justins
// Auftrag: aggressiv. Die Auszählung vom 01./02.09.2026 hat entschieden,
// was „aggressiv“ hier heißt — nämlich präzise statt laut:
//
// · 70 % aller Zahlungen fallen in die ersten drei Tage nach Antrag; ab
//   Tag 7 ist jeder Fall konstant ~0,2 % je vier Tage wert. Alter sortiert
//   nicht — die LAGE sortiert.
// · Mahnen ab Stufe 6 bringt null (12.260 Mails → 5 Zahler), Telefonieren
//   auf den Altbestand bringt null (1.387 Fälle → 15 Zahlungen).
// · Das EINZIGE, was messbar wirkt, ist der gebuchte Termin: 9,88 % gegen
//   1,66 %, Faktor 6, p = 0,0002 — und es wirkt die Buchung, nicht das
//   Gespräch. Deshalb ruft jede Mail dieses Laufs zum Termin, keine nennt
//   Bankdaten.
//
// ── DIE FÜNF SEGMENTE (Vorlagen: server/mail/vorlagen/rueckholung.ts) ─────
// S1 frische Zahlungsmeldung (<3 Tage): 9,52 % Zahlquote, Faktor 19 — aber
//    nur 72 Stunden lang. Verderbliche Ware, läuft zuerst.
// S2 alte Zahlungsmeldung: 47,2 % zahlten historisch doch. 296 von 305
//    wurden nach ihrer Meldung weitergemahnt (Schnitt 29,4×) — die Mail
//    entschuldigt sich dafür und verspricht den Stopp. Der Stopp wird HIER
//    eingelöst (mahnstopp_am), bevor die Mail rausgeht.
// S3 Preis fehlt (payment_reference ohne amount_due): 0 von 1.211 haben je
//    gezahlt — ein technischer Bruch, kein kalter Lead. Standard AUS, bis
//    Justin die Ansprache freigibt.
// S4 nie gemahnt mit Betrag: die Botschaft ist dort noch neu.
// S5 Altbestand: genau EINE letzte Mail, würdevoll, mit echtem Ausstieg.
//    Standard AUS — sie ist unumkehrbar („unsere letzte Nachricht“).
//
// ── DIE BREMSEN ───────────────────────────────────────────────────────────
// 1. `rueckhol_pro_tag` = 0 (Standard): Der Lauf tut nach dem Ausrollen
//    NICHTS. Ein Merge löst keine Welle aus.
// 2. Je Segment abschaltbar (`rueckhol_s1_an` … `_s5_an`).
// 3. Höchstens 2 Mails je Person und Segment (S5: genau 1), mindestens
//    4 Tage Abstand — gezählt aus fiaon_mail_log, kein neues Feld.
// 4. Nachtruhe 8–20 Uhr Berlin, Deckel gilt je Tag, nicht je Durchlauf.
// 5. Die Frequenzbremse (fiaon-mail-frequenz.ts) hängt hinter dem Versand
//    und deckelt zusätzlich je Empfänger über ALLE Ereignisse.
// 6. S1/S2 laufen NICHT für Menschen, zu denen ein unverbuchter
//    Bankeingang passt (Referenz- oder Namenstreffer) — lieber einen Fall
//    auslassen als jemanden anschreiben, dessen Geld schon da ist.
//
// Versand ausschließlich über `versendenUndProtokollieren` — der eine Weg.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { versendenUndProtokollieren } from "./fiaon-mail-log";
import { terminLink } from "./fiaon-termine";

export type Segment = "s1_frisch" | "s2_behauptet" | "s3_preis_fehlt" | "s4_nie_gemahnt" | "s5_altbestand";

const SEGMENTE: Segment[] = ["s1_frisch", "s2_behauptet", "s3_preis_fehlt", "s4_nie_gemahnt", "s5_altbestand"];

/** Ereignisname im Mail-Log und in den Vorlagen, je Segment. */
const EVENT: Record<Segment, string> = {
  s1_frisch: "rueckhol_s1", s2_behauptet: "rueckhol_s2", s3_preis_fehlt: "rueckhol_s3",
  s4_nie_gemahnt: "rueckhol_s4", s5_altbestand: "rueckhol_s5",
};

/** Höchstzahl Mails je Person und Segment. S5 verspricht „die letzte“ — also genau eine. */
const HOECHSTENS: Record<Segment, number> = {
  s1_frisch: 2, s2_behauptet: 2, s3_preis_fehlt: 2, s4_nie_gemahnt: 2, s5_altbestand: 1,
};

/** Segmente, deren Mail einen Mahnstopp behauptet oder voraussetzt (S2 wörtlich,
 *  S1 wäre sonst Klärmail und Mahnung am selben Tag, S3 sagt „Sie schulden uns
 *  nichts“, S5 verspricht Ruhe). Nur S4 lässt die normale Kette weiterlaufen. */
const MIT_MAHNSTOPP = new Set<Segment>(["s1_frisch", "s2_behauptet", "s3_preis_fehlt", "s5_altbestand"]);

/** Standard-Schalter: konservativ. S3 und S5 erst nach Justins Freigabe. */
const STANDARD_AN: Record<Segment, boolean> = {
  s1_frisch: true, s2_behauptet: true, s3_preis_fehlt: false, s4_nie_gemahnt: true, s5_altbestand: false,
};

const RUHE_BIS = 8, RUHE_AB = 20;

let spaltenGeprueft = false;
/** `werbung_gesperrt_am`: das eingelöste Stopp-Versprechen der S5-Mail. */
export async function ensureRueckholSpalten(): Promise<void> {
  if (spaltenGeprueft) return;
  await sqlPool`ALTER TABLE fiaon_persons ADD COLUMN IF NOT EXISTS werbung_gesperrt_am TIMESTAMPTZ`;
  spaltenGeprueft = true;
}

async function zahl(schluessel: string, standard: number): Promise<number> {
  try {
    const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = ${schluessel} LIMIT 1`) as any[];
    if (r?.value === undefined || r?.value === null || String(r.value).trim() === "") return standard;
    const n = Number(String(r.value).trim());
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : standard;
  } catch { return standard; }
}

async function segmentAn(segment: Segment): Promise<boolean> {
  const kurz = segment.split("_")[0]; // s1 … s5
  return (await zahl(`rueckhol_${kurz}_an`, STANDARD_AN[segment] ? 1 : 0)) === 1;
}

function berlinStunde(): number {
  return Number(new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false }).format(new Date()));
}

// ── DIE GEMEINSAME GRUNDMENGE ───────────────────────────────────────────────
// Ein fertiger, unbezahlter, lebendiger Antrag eines echten Menschen mit
// Mailadresse und ohne Werbesperre. Jede Segmentabfrage baut hierauf auf —
// EINE Definition, damit die Segmente nie auseinanderlaufen und sich nie
// überlappen können (die CASE-Kette unten ist vollständig und disjunkt).
const SEGMENT_CASE = `
  CASE
    WHEN a.payment_status = 'claimed_paid' AND a.claimed_paid_at > NOW() - INTERVAL '3 days' THEN 's1_frisch'
    WHEN a.payment_status = 'claimed_paid' THEN 's2_behauptet'
    WHEN a.payment_reference IS NOT NULL AND COALESCE(a.amount_due, 0) = 0 THEN 's3_preis_fehlt'
    WHEN COALESCE(a.amount_due, 0) > 0 AND COALESCE(a.reminder_count, 0) = 0 THEN 's4_nie_gemahnt'
    WHEN COALESCE(a.amount_due, 0) > 0 THEN 's5_altbestand'
    ELSE NULL
  END`;

function grundmenge() {
  return sqlPool`
    SELECT a.ref, a.person_id,
           COALESCE(NULLIF(a.first_name, ''), NULLIF(a.contact_name, '')) AS vorname,
           COALESCE(NULLIF(TRIM(a.email), ''), NULLIF(TRIM(a.contact_email), ''), NULLIF(TRIM(a.billing_email), '')) AS email,
           COALESCE(NULLIF(TRIM(a.phone), ''), NULLIF(TRIM(a.contact_phone), '')) AS telefon,
           a.pack_name, a.amount_due, a.payment_reference,
           COALESCE(a.reminder_count, 0) AS mahnungen,
           EXTRACT(DAY FROM NOW() - a.created_at)::int AS alter_tage,
           EXTRACT(DAY FROM NOW() - a.claimed_paid_at)::int AS claimed_tage,
           ${sqlPool.unsafe(SEGMENT_CASE)} AS segment
      FROM fiaon_applications a
      JOIN fiaon_persons p ON p.id = a.person_id
     WHERE a.payment_status <> 'paid'
       AND a.merged_into IS NULL AND a.archived_at IS NULL
       AND a.gdpr_deleted_at IS NULL AND a.cancelled_at IS NULL AND a.refunded_at IS NULL
       AND COALESCE(a.ist_entwurf, FALSE) = FALSE
       AND a.ref NOT LIKE 'FIAON-TEST%' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
       AND p.ist_test_am IS NULL
       AND p.werbung_gesperrt_am IS NULL
  `;
}

export interface SegmentStand { anzahl: number; wert_cents: number; mit_mail: number; mit_telefon: number; bereits_angeschrieben: number }

/** Die Übersicht für den Leitstand — eine Abfrage, jede Zahl gezählt. */
export async function rueckholSegmente(): Promise<Record<Segment, SegmentStand>> {
  await ensureRueckholSpalten();
  const zeilen = (await sqlPool`
    WITH basis AS (${grundmenge()}),
    angeschrieben AS (
      SELECT person_id, event FROM fiaon_mail_log
       WHERE event LIKE 'rueckhol_%' AND status = 'versandt' AND person_id IS NOT NULL
       GROUP BY 1, 2
    )
    SELECT b.segment,
           COUNT(*)::int AS anzahl,
           COALESCE(SUM(ROUND(b.amount_due * 100)), 0)::bigint AS wert_cents,
           COUNT(*) FILTER (WHERE b.email IS NOT NULL)::int AS mit_mail,
           COUNT(*) FILTER (WHERE b.telefon IS NOT NULL)::int AS mit_telefon,
           COUNT(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM angeschrieben x WHERE x.person_id = b.person_id
           ))::int AS bereits_angeschrieben
      FROM basis b
     WHERE b.segment IS NOT NULL
     GROUP BY 1
  `) as any[];
  const leer: SegmentStand = { anzahl: 0, wert_cents: 0, mit_mail: 0, mit_telefon: 0, bereits_angeschrieben: 0 };
  const erg = Object.fromEntries(SEGMENTE.map((s) => [s, { ...leer }])) as Record<Segment, SegmentStand>;
  for (const z of zeilen) {
    if (z.segment && erg[z.segment as Segment]) {
      erg[z.segment as Segment] = {
        anzahl: Number(z.anzahl), wert_cents: Number(z.wert_cents),
        mit_mail: Number(z.mit_mail), mit_telefon: Number(z.mit_telefon),
        bereits_angeschrieben: Number(z.bereits_angeschrieben),
      };
    }
  }
  return erg;
}

export interface RueckholFall {
  ref: string; personId: number; segment: Segment; email: string | null; telefon: string | null;
  vorname: string | null; betrag: string | null; paket: string | null; zahlungsreferenz: string | null;
  alterTage: number; mahnungen: number; claimedTage: number | null; bisherige: number;
}

/**
 * Die nächsten Kandidaten eines Segments — versandfertig gefiltert:
 * Mailadresse vorhanden, Höchstzahl nicht erreicht, 4 Tage Abstand, und für
 * S1/S2 kein unverbuchter Bankeingang mit Referenz- oder Namenstreffer.
 */
export async function rueckholKandidaten(segment: Segment, limit: number): Promise<RueckholFall[]> {
  await ensureRueckholSpalten();
  const event = EVENT[segment];
  const hoechstens = HOECHSTENS[segment];
  const zeilen = (await sqlPool`
    WITH basis AS (${grundmenge()}),
    bisher AS (
      SELECT person_id, COUNT(*)::int n, MAX(created_at) letzte
        FROM fiaon_mail_log
       WHERE event = ${event} AND status = 'versandt' AND person_id IS NOT NULL
       GROUP BY 1
    )
    SELECT b.*, COALESCE(x.n, 0) AS bisherige
      FROM basis b
      LEFT JOIN bisher x ON x.person_id = b.person_id
     WHERE b.segment = ${segment}
       AND b.email IS NOT NULL
       AND COALESCE(x.n, 0) < ${hoechstens}
       AND (x.letzte IS NULL OR x.letzte < NOW() - INTERVAL '4 days')
       -- Wen die Frequenzbremse HEUTE schon zurückgehalten hat, versucht der
       -- Lauf heute nicht noch einmal — sonst hängt er alle 30 Minuten an
       -- denselben zehn Blockierten fest und kommt nie zu den Nächsten
       -- (Hotfix 02.09.2026: 240 Versuche, 0 Versände).
       AND NOT EXISTS (
         SELECT 1 FROM fiaon_mail_log f
          WHERE f.event = ${event} AND f.status = 'fehlgeschlagen'
            AND f.grund LIKE 'Frequenzbremse:%'
            AND LOWER(TRIM(f.empfaenger)) = LOWER(TRIM(b.email))
            AND f.created_at > NOW() - INTERVAL '6 hours')
       -- Kein Rückhol-Anschreiben an jemanden, dessen Geld womöglich schon
       -- unverbucht auf dem Konto liegt (61 Eingänge / 7.302 € am 02.09.).
       -- Referenztreffer ODER Namenstreffer (payer_name enthält den Nachnamen).
       AND (${segment} NOT IN ('s1_frisch', 's2_behauptet') OR NOT EXISTS (
         SELECT 1 FROM fiaon_bank_txns t
          WHERE t.applied = FALSE AND t.amount_cents > 0
            AND (
              t.matched_ref = b.ref
              OR t.extracted_ref = b.payment_reference
              OR (LENGTH(COALESCE((SELECT NULLIF(TRIM(a2.last_name), '') FROM fiaon_applications a2 WHERE a2.ref = b.ref), '')) >= 4
                  AND t.payer_name ILIKE '%' || (SELECT TRIM(a2.last_name) FROM fiaon_applications a2 WHERE a2.ref = b.ref) || '%')
            )
       ))
     ORDER BY
       -- S1: die frischeste Meldung zuerst (72-Stunden-Uhr). Sonst: Wert zuerst —
       -- High End trägt 47 % des offenen Auftragswerts.
       CASE WHEN ${segment} = 's1_frisch' THEN -b.claimed_tage ELSE 0 END DESC,
       b.amount_due DESC NULLS LAST, b.ref ASC
     LIMIT ${limit}
  `) as any[];
  return zeilen.map((z: any) => ({
    ref: String(z.ref), personId: Number(z.person_id), segment,
    email: z.email || null, telefon: z.telefon || null, vorname: z.vorname || null,
    betrag: z.amount_due != null ? String(z.amount_due) : null,
    paket: z.pack_name ? String(z.pack_name).split("\n")[0].trim() : null,
    zahlungsreferenz: z.payment_reference || null,
    alterTage: Number(z.alter_tage || 0), mahnungen: Number(z.mahnungen || 0),
    claimedTage: z.claimed_tage != null ? Number(z.claimed_tage) : null,
    bisherige: Number(z.bisherige || 0),
  }));
}

export interface LaufErgebnis { segment: Segment; geprueft: number; verschickt: number; uebersprungen: number; grund?: string }

/**
 * Ein Durchlauf über alle aktiven Segmente, in der Reihenfolge des belegten
 * Werts: S1 (verderblich) → S2 (47 %) → S4 (neu) → S3 → S5. Der Tagesdeckel
 * gilt über ALLE Segmente zusammen.
 */
export async function rueckholLauf(): Promise<LaufErgebnis[]> {
  await ensureRueckholSpalten();
  const deckel = await zahl("rueckhol_pro_tag", 0);
  if (deckel <= 0) return [{ segment: "s1_frisch", geprueft: 0, verschickt: 0, uebersprungen: 0, grund: "abgeschaltet (rueckhol_pro_tag = 0)" }];
  const std = berlinStunde();
  if (std < RUHE_BIS || std >= RUHE_AB) return [{ segment: "s1_frisch", geprueft: 0, verschickt: 0, uebersprungen: 0, grund: "Nachtruhe" }];

  const [heute] = (await sqlPool`
    SELECT COUNT(*)::int n FROM fiaon_mail_log
     WHERE event LIKE 'rueckhol_%' AND art = 'echt' AND status = 'versandt'
       AND created_at > date_trunc('day', NOW() AT TIME ZONE 'Europe/Berlin') AT TIME ZONE 'Europe/Berlin'
  `) as any[];
  let rest = deckel - Number(heute?.n || 0);
  if (rest <= 0) return [{ segment: "s1_frisch", geprueft: 0, verschickt: 0, uebersprungen: 0, grund: "Tagesdeckel erreicht" }];

  const reihenfolge: Segment[] = ["s1_frisch", "s2_behauptet", "s4_nie_gemahnt", "s3_preis_fehlt", "s5_altbestand"];
  const ergebnisse: LaufErgebnis[] = [];

  for (const segment of reihenfolge) {
    if (rest <= 0) break;
    if (!(await segmentAn(segment))) { ergebnisse.push({ segment, geprueft: 0, verschickt: 0, uebersprungen: 0, grund: "Segment abgeschaltet" }); continue; }
    const faelle = await rueckholKandidaten(segment, rest);
    let verschickt = 0, uebersprungen = 0;
    for (const f of faelle) {
      try {
        // ── DER MAHNSTOPP KOMMT VOR DER MAIL ──────────────────────────────
        // Die S2-Vorlage behauptet ihn wörtlich; für S1/S3/S5 verhindert er,
        // dass am selben Tag Klärmail UND Mahnung ankommen. Erst stoppen,
        // dann schreiben — in dieser Reihenfolge ist der Satz beim Lesen wahr.
        if (MIT_MAHNSTOPP.has(segment)) {
          await sqlPool`UPDATE fiaon_applications SET mahnstopp_am = NOW(), updated_at = NOW()
            WHERE ref = ${f.ref} AND mahnstopp_am IS NULL`;
        }
        const erg = await versendenUndProtokollieren(EVENT[segment] as any, {
          email: String(f.email),
          vorname: f.vorname || "",
          paket: f.paket,
          betrag: f.betrag,
          payment_reference: f.zahlungsreferenz,
          antrag_id: f.ref,
          termin_link: terminLink(f.personId, "rueckholung"),
        } as any, {
          personId: f.personId,
          verlaufRef: f.ref,
          verlaufText: `Rückholung ${segment} (Mail ${f.bisherige + 1} von ${HOECHSTENS[segment]}).`,
        });
        if (erg.status === "versandt") { verschickt++; rest--; } else uebersprungen++;
      } catch (e) {
        uebersprungen++;
        console.error(`[RUECKHOLUNG] ${segment} ${f.ref}:`, e);
      }
    }
    ergebnisse.push({ segment, geprueft: faelle.length, verschickt, uebersprungen });
  }
  return ergebnisse;
}
