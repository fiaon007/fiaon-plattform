// ═══════════════════════════════════════════════════════════════════════════
// DIE RÜCKHOLUNG — vier Lagen plus Dauerpflege, ein Ziel: der Termin
// (02.09.2026, E-074; Dauerpflege statt „letzter Mail“ seit 02.09. abends)
//
// ── WAS HIER ZURÜCKGEHOLT WIRD ────────────────────────────────────────────
// 2.001 fertige, unbezahlte Anträge mit 96.840 € Auftragswert. Justins
// Grundsatz (02.09.2026, wörtlich): „Es soll NIEMALS ein Kunde deaktiviert,
// ausgeschlossen werden — er bekommt so lange Marketing bis er Kunde wird!
// AGRESSIV.“ Die Auszählung vom 01./02.09.2026 hat entschieden, was
// „aggressiv“ hier heißt — nämlich präzise und ausdauernd statt laut:
//
// · 70 % aller Zahlungen fallen in die ersten drei Tage nach Antrag; ab
//   Tag 7 ist jeder Fall KONSTANT ~0,2 % je vier Tage wert. Alter sortiert
//   nicht — die LAGE sortiert. Und: Der Wert verfällt nicht. Wer den
//   Kontakt einstellt, verschenkt diese 0,2 % jede Woche neu.
// · Mahnen ab Stufe 6 bringt null (12.260 Mails → 5 Zahler), Telefonieren
//   auf den Altbestand bringt null (1.387 Fälle → 15 Zahlungen).
// · Das EINZIGE, was messbar wirkt, ist der gebuchte Termin: 9,88 % gegen
//   1,66 %, Faktor 6, p = 0,0002 — und es wirkt die Buchung, nicht das
//   Gespräch. Deshalb ruft jede Mail dieses Laufs zum Termin, keine nennt
//   Bankdaten.
//
// ── DIE SEGMENTE (Vorlagen: server/mail/vorlagen/rueckholung.ts) ──────────
// S1 frische Zahlungsmeldung (<3 Tage): 9,52 % Zahlquote, Faktor 19 — aber
//    nur 72 Stunden lang. Verderbliche Ware, läuft zuerst.
// S2 alte Zahlungsmeldung: 47,2 % zahlten historisch doch. 296 von 305
//    wurden nach ihrer Meldung weitergemahnt (Schnitt 29,4×) — die Mail
//    entschuldigt sich dafür und verspricht den Stopp. Der Stopp wird HIER
//    eingelöst (mahnstopp_am), bevor die Mail rausgeht.
// S3 Preis fehlt (payment_reference ohne amount_due): 0 von 1.211 haben je
//    gezahlt — ein technischer Bruch, kein kalter Lead.
// S4 nie gemahnt mit Betrag: die Botschaft ist dort noch neu.
// S5 DAUERPFLEGE — wiederkehrend, ohne Obergrenze je Person. Kandidat ist,
//    wer HEUTE in keinem anderen Segment versandfertig ist (Altbestand nach
//    der Mahnkette, oder S1–S4 ausgeschöpft) und dessen letzte Rückhol-Mail
//    irgendeines Ereignisses mindestens N Tage zurückliegt (N =
//    rueckhol_dauerpflege_abstand_tage, Standard 28, nie unter 14). Vier
//    Blickwinkel rotieren (rueckhol_s5 / s5b / s5c / s5d), gewählt nach
//    Anzahl bisheriger Dauerpflege-Mails modulo 4 — niemand liest zweimal
//    hintereinander dieselbe Mail. Ende NUR durch bezahlt, Stopp oder
//    Bounce — nie durch eine Zählung.
//    Warum 28 Tage: Eine Mail im Monat je Empfänger bleibt unter jeder
//    Spam-Schwelle (Blockquote 9,5 → 11,9 → 15,7 % kam von zwei Mahnungen
//    TÄGLICH) und verdient über ein Jahr dieselben ~0,2 % je Kontakt, die
//    eine Mahnwelle in drei Tagen verbrennt. Unter 14 Tagen beginnt die
//    Kette, die gemessen nichts bringt.
//
// ── DIE BREMSEN (das sind die GRENZEN von „aggressiv“, nicht sein Ende) ───
// 1. `rueckhol_pro_tag` = 0 (Standard): Der Lauf tut nach dem Ausrollen
//    NICHTS. Ein Merge löst keine Welle aus. Der Deckel gilt über alle
//    Segmente zusammen, je Tag, nicht je Durchlauf.
// 2. Je Segment abschaltbar (`rueckhol_s1_an` … `_s5_an`).
// 3. S1–S4: höchstens 2 Mails je Person und Segment, mindestens 4 Tage
//    Abstand. S5: unbegrenzt, aber nie öfter als alle N Tage (s. o.) —
//    gezählt aus fiaon_mail_log, kein neues Feld.
// 4. Nachtruhe 8–20 Uhr Berlin.
// 5. Die Frequenzbremse (fiaon-mail-frequenz.ts) hängt hinter dem Versand
//    und deckelt zusätzlich je Empfänger über ALLE Ereignisse (2/Tag,
//    4/Woche, 8/Monat). Wen sie HEUTE zurückgehalten hat, versucht der Lauf
//    sechs Stunden lang nicht erneut (Hotfix 02.09.: 240 Versuche, 0 Versände).
// 6. S1/S2 laufen NICHT für Menschen, zu denen ein unverbuchter
//    Bankeingang passt (Referenz- oder Namenstreffer) — lieber einen Fall
//    auslassen als jemanden anschreiben, dessen Geld schon da ist. Gilt in
//    der Dauerpflege für dieselben Lagen weiter.
// 7. ABSOLUT, nie einstellbar: Die Werbesperre (fiaon_persons.
//    werbung_gesperrt_am, UWG § 7 / DSGVO Art. 21) nimmt den Menschen aus
//    der Grundmenge; gebouncte oder als Spam gemeldete Adressen bekommen nie
//    wieder Post — dort kommt nichts an, jeder Versuch schadet allen anderen.
//
// Versand ausschließlich über `versendenUndProtokollieren` — der eine Weg.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { versendenUndProtokollieren } from "./fiaon-mail-log";
import { terminLink } from "./fiaon-termine";
import { abmeldeLinkPerson } from "../routes/fiaon-abmelden";

export type Segment = "s1_frisch" | "s2_behauptet" | "s3_preis_fehlt" | "s4_nie_gemahnt" | "s5_altbestand";

const SEGMENTE: Segment[] = ["s1_frisch", "s2_behauptet", "s3_preis_fehlt", "s4_nie_gemahnt", "s5_altbestand"];

/** Ereignisname im Mail-Log und in den Vorlagen, je Segment. S5 nennt das
 *  Grundereignis; die konkrete Variante wählt `dauerpflegeVariante`. */
const EVENT: Record<Segment, string> = {
  s1_frisch: "rueckhol_s1", s2_behauptet: "rueckhol_s2", s3_preis_fehlt: "rueckhol_s3",
  s4_nie_gemahnt: "rueckhol_s4", s5_altbestand: "rueckhol_s5",
};

/** Die vier Blickwinkel der Dauerpflege, in Rotationsreihenfolge. */
export const DAUERPFLEGE_EVENTS: string[] = ["rueckhol_s5", "rueckhol_s5b", "rueckhol_s5c", "rueckhol_s5d"];

/** Höchstzahl Mails je Person und Segment. Die Dauerpflege hat KEINE —
 *  Justins Grundsatz: Ende nur durch Kunde werden oder Stopp. */
const HOECHSTENS: Record<Segment, number> = {
  s1_frisch: 2, s2_behauptet: 2, s3_preis_fehlt: 2, s4_nie_gemahnt: 2, s5_altbestand: Infinity,
};

/** Abstand zwischen zwei Rückhol-Mails an dieselbe Person in der Dauerpflege.
 *  28 = eine im Monat (Begründung im Kopf). 14 ist die harte Untergrenze:
 *  Darunter wird aus Pflege wieder die Kette, die ab Stufe 6 null bringt. */
const DAUERPFLEGE_ABSTAND_STANDARD = 28;
const DAUERPFLEGE_ABSTAND_MINDESTENS = 21; // Prüfung 02.09.: 14 Tage + Mahnkette 6 = Frequenzdeckel 8 voll

/** Segmente, deren Mail einen Mahnstopp behauptet oder voraussetzt (S2 wörtlich,
 *  S1 wäre sonst Klärmail und Mahnung am selben Tag, S3 sagt „Sie schulden uns
 *  nichts“, S5 spricht mit Menschen, die die Kette längst hinter sich haben —
 *  Dauerpflege UND Mahnung am selben Tag wäre die Mahnwelle mit anderem
 *  Absender). Nur S4 lässt die normale Kette weiterlaufen. */
const MIT_MAHNSTOPP = new Set<Segment>(["s1_frisch", "s2_behauptet", "s3_preis_fehlt", "s5_altbestand"]);

/** Standard-Schalter, wenn in fiaon_settings nichts steht: konservativ.
 *  S3 und S5 erst nach Justins Freigabe im Leitstand (rueckhol_s5_an). */
const STANDARD_AN: Record<Segment, boolean> = {
  s1_frisch: true, s2_behauptet: true, s3_preis_fehlt: false, s4_nie_gemahnt: true, s5_altbestand: false,
};

const RUHE_BIS = 8, RUHE_AB = 20;

let spaltenGeprueft = false;
/** `werbung_gesperrt_am`: das eingelöste Stopp-Versprechen jeder Rückhol-Mail. */
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

/** N Tage Abstand der Dauerpflege — einstellbar, aber nie unter 14. */
export async function dauerpflegeAbstandTage(): Promise<number> {
  return Math.max(DAUERPFLEGE_ABSTAND_MINDESTENS, await zahl("rueckhol_dauerpflege_abstand_tage", DAUERPFLEGE_ABSTAND_STANDARD));
}

/** Welcher der vier Blickwinkel als Nächstes dran ist: bisherige Dauerpflege-
 *  Mails der Person (alle vier Ereignisse zusammen) modulo 4. */
export function dauerpflegeVariante(bisherige: number): string {
  const n = Number.isFinite(bisherige) && bisherige > 0 ? Math.floor(bisherige) : 0;
  return DAUERPFLEGE_EVENTS[n % DAUERPFLEGE_EVENTS.length];
}

// ── HOTFIX 02.09.2026, 08:50: DIE NACHTRUHE HAT NIE GEGRIFFEN ─────────────
// `format()` mit nur `hour` liefert in de-DE „08 Uhr“, nicht „08“. Number()
// davon ist NaN, und NaN ist weder < 8 noch >= 20 — die Nachtruhe war damit
// wirkungslos: neun Mails gingen um 01:17 raus, im ersten Takt nach dem
// Scharfschalten. Deshalb `formatToParts` wie in fiaon-antrag-erinnerung.ts
// (berlinMinuten) — das Hausmuster, das ich hätte kopieren sollen.
function berlinStunde(): number {
  const teile = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", hour12: false })
    .formatToParts(new Date());
  const h = Number(teile.find((p) => p.type === "hour")?.value);
  // Im Zweifel (NaN) gilt Nachtruhe — lieber eine Stunde später senden als
  // wieder um 01:17. -1 ist < 8 und damit „Nacht“.
  return Number.isFinite(h) ? h % 24 : -1;
}

// ── DIE GEMEINSAME GRUNDMENGE ───────────────────────────────────────────────
// Ein fertiger, unbezahlter, lebendiger Antrag eines echten Menschen mit
// Mailadresse und ohne Werbesperre. Jede Segmentabfrage baut hierauf auf —
// EINE Definition, damit die Segmente nie auseinanderlaufen und sich nie
// überlappen können (die CASE-Kette unten ist vollständig und disjunkt).
// Die Dauerpflege greift auf dieselbe Grundmenge zu: Wer hier herausfällt
// (bezahlt, storniert, gelöscht, Werbesperre), ist auch dort raus — das ist
// das EINZIGE Ende der Dauerpflege.
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
     WHERE a.payment_status NOT IN ('paid', 'superseded')
       AND a.merged_into IS NULL AND a.archived_at IS NULL
       AND a.gdpr_deleted_at IS NULL AND a.cancelled_at IS NULL AND a.refunded_at IS NULL
       AND COALESCE(a.ist_entwurf, FALSE) = FALSE
       AND a.ref NOT LIKE 'FIAON-TEST%' AND a.ref NOT LIKE 'FIAON-SCHUFA-%'
       AND p.ist_test_am IS NULL
       AND p.werbung_gesperrt_am IS NULL
  `;
}

// ── DIE DAUERPFLEGE-MENGE ───────────────────────────────────────────────────
// „Heute in keinem anderen Segment versandfertig“ heißt in SQL: Die Lage
// ist s5_altbestand (kein anderes Segment trifft zu), ODER die Lage ist
// S1–S4 und das Segment ist für diese Person ausgeschöpft (Höchstzahl
// erreicht). Ein noch laufendes S1–S4 (Höchstzahl offen, 4-Tage-Abstand
// abgewartet) hat Vorrang und bleibt der Dauerpflege fern — automatisch,
// weil dessen letzte Mail jünger als N Tage ist.
// Die Zuordnung Lage → Ereignis/Höchstzahl kommt aus den Konstanten oben,
// damit eine Änderung dort nicht hier vergessen wird.
const LAGEN_S1_BIS_S4 = SEGMENTE.filter((s) => s !== "s5_altbestand");
const LAGE_EVENT_CASE = `CASE b.segment ${LAGEN_S1_BIS_S4.map((s) => `WHEN '${s}' THEN '${EVENT[s]}'`).join(" ")} END`;
const LAGE_HOECHSTENS_CASE = `CASE b.segment ${LAGEN_S1_BIS_S4.map((s) => `WHEN '${s}' THEN ${HOECHSTENS[s]}`).join(" ")} END`;

/**
 * Alle HEUTE versandfertigen Dauerpflege-Fälle, EINE Zeile je Person (18
 * Personen haben mehrere offene Anträge — die Dauerpflege schreibt an den
 * Menschen, nicht an die Akte; es gewinnt der wertvollste Antrag).
 * Wird von Übersicht und Kandidatenliste gleichermaßen benutzt — eine
 * Definition, damit die Zahl im Leitstand dem entspricht, was der Lauf zieht.
 */
function dauerpflegeMenge(abstandTage: number) {
  return sqlPool`
    WITH basis AS (${grundmenge()}),
    je_event AS (
      SELECT person_id, event, COUNT(*)::int AS n, MAX(created_at) AS letzte
        FROM fiaon_mail_log
       WHERE event LIKE 'rueckhol_%' AND status = 'versandt' AND art = 'echt' AND person_id IS NOT NULL
       GROUP BY 1, 2
    ),
    je_person AS (
      SELECT person_id,
             MAX(letzte) AS letzte_rueckhol,
             COALESCE(SUM(n) FILTER (WHERE event = ANY(${DAUERPFLEGE_EVENTS})), 0)::int AS dauerpflege_n
        FROM je_event
       GROUP BY 1
    ),
    -- Wen die Frequenzbremse in den letzten 6 Stunden zurückgehalten hat —
    -- egal für welches Rückhol-Ereignis: Die Bremse zählt je Empfänger, nicht
    -- je Ereignis, sie hielte die Dauerpflege genauso zurück.
    gebremst AS (
      SELECT DISTINCT LOWER(TRIM(empfaenger)) AS adr FROM fiaon_mail_log
       WHERE status = 'fehlgeschlagen'
         AND grund LIKE 'Frequenzbremse:%' AND empfaenger IS NOT NULL
         AND created_at > NOW() - INTERVAL '24 hours'
    ),
    -- Gebounct oder als Spam gemeldet: nie wieder, ohne Verfallsdatum. Die
    -- Frequenzbremse sieht nur 30 Tage zurück — bei einer Mail alle 28 Tage
    -- käme sonst jede Adresse einmal im Monat wieder an die Reihe.
    unzustellbar AS (
      SELECT DISTINCT LOWER(TRIM(empfaenger)) AS adr FROM fiaon_mail_log
       WHERE zustellung IN ('gebounct', 'spam') AND empfaenger IS NOT NULL
    )
    SELECT DISTINCT ON (b.person_id)
           b.*, COALESCE(jp.dauerpflege_n, 0) AS bisherige, jp.letzte_rueckhol
      FROM basis b
      LEFT JOIN je_person jp ON jp.person_id = b.person_id
     WHERE b.segment IS NOT NULL
       AND b.email IS NOT NULL
       -- REIFE (Prüfung 02.09.): „Altbestand“ heißt in der CASE-Kette nur „mindestens
       -- eine Mahnung“. Ein drei Tage alter Antrag mit vier Mahnungen steckt noch in
       -- dem Teil der Kette, der belegt wirkt (35 von 37 Zahlern nach Mahnung 1–3).
       -- Dauerpflege erst, wenn die Kette durch ist (6 = gemessene Nullertrags-
       -- Schwelle) oder der Antrag zwei Wochen alt ist.
       AND (b.segment <> 's5_altbestand' OR COALESCE(b.mahnungen, 0) >= 6 OR b.alter_tage >= 14)
       -- Wer bereits einen kommenden Termin hat, braucht keinen Termin-Aufruf.
       AND NOT EXISTS (SELECT 1 FROM fiaon_termine t WHERE t.person_id = b.person_id AND t.beginn > NOW() AND t.abgesagt_am IS NULL)
       AND (b.segment = 's5_altbestand' OR EXISTS (
             SELECT 1 FROM je_event x
              WHERE x.person_id = b.person_id
                AND x.event = ${sqlPool.unsafe(LAGE_EVENT_CASE)}
                AND x.n >= ${sqlPool.unsafe(LAGE_HOECHSTENS_CASE)}))
       AND (jp.letzte_rueckhol IS NULL OR jp.letzte_rueckhol < NOW() - make_interval(days => ${abstandTage}::int))
       AND NOT EXISTS (SELECT 1 FROM gebremst g WHERE g.adr = LOWER(TRIM(b.email)))
       AND NOT EXISTS (SELECT 1 FROM unzustellbar u WHERE u.adr = LOWER(TRIM(b.email)))
       -- Behaupter (Lage S1/S2) auch hier nicht anschreiben, wenn ein
       -- unverbuchter Bankeingang zu ihnen passt — dieselbe Regel wie im
       -- Segment selbst (61 Eingänge / 7.302 € am 02.09.).
       AND (b.segment NOT IN ('s1_frisch', 's2_behauptet') OR NOT EXISTS (
         SELECT 1 FROM fiaon_bank_txns t
          WHERE t.applied = FALSE AND t.amount_cents > 0
            AND (
              t.matched_ref = b.ref
              OR t.extracted_ref = b.payment_reference
              OR (LENGTH(COALESCE((SELECT NULLIF(TRIM(a2.last_name), '') FROM fiaon_applications a2 WHERE a2.ref = b.ref), '')) >= 4
                  AND t.payer_name ILIKE '%' || (SELECT TRIM(a2.last_name) FROM fiaon_applications a2 WHERE a2.ref = b.ref) || '%')
            )
       ))
     ORDER BY b.person_id, b.amount_due DESC NULLS LAST, b.ref ASC
  `;
}

export interface SegmentStand { anzahl: number; wert_cents: number; mit_mail: number; mit_telefon: number; bereits_angeschrieben: number }

/**
 * Die Übersicht für den Leitstand — jede Zahl gezählt. S1–S4 zeigen die
 * Lage (wie viele Anträge dort liegen); S5 zeigt die HEUTE versandfertigen
 * Dauerpflege-Fälle — die Zahl, die der Lauf bei offenem Deckel zöge.
 * `bereits_angeschrieben` ist bei S5: schon mindestens eine Dauerpflege-Mail.
 */
export async function rueckholSegmente(): Promise<Record<Segment, SegmentStand>> {
  await ensureRueckholSpalten();
  const abstand = await dauerpflegeAbstandTage();
  const [zeilen, dauerpflege] = await Promise.all([
    sqlPool`
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
    ` as Promise<any[]>,
    sqlPool`
      SELECT COUNT(*)::int AS anzahl,
             COALESCE(SUM(ROUND(d.amount_due * 100)), 0)::bigint AS wert_cents,
             COUNT(*) FILTER (WHERE d.telefon IS NOT NULL)::int AS mit_telefon,
             COUNT(*) FILTER (WHERE d.bisherige > 0)::int AS bereits_angeschrieben
        FROM (${dauerpflegeMenge(abstand)}) d
    ` as Promise<any[]>,
  ]);
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
  const d = dauerpflege[0];
  erg.s5_altbestand = {
    anzahl: Number(d?.anzahl || 0), wert_cents: Number(d?.wert_cents || 0),
    // Jede Dauerpflege-Zeile hat per Definition eine Mailadresse.
    mit_mail: Number(d?.anzahl || 0), mit_telefon: Number(d?.mit_telefon || 0),
    bereits_angeschrieben: Number(d?.bereits_angeschrieben || 0),
  };
  return erg;
}

export interface RueckholFall {
  ref: string; personId: number; segment: Segment; email: string | null; telefon: string | null;
  vorname: string | null; betrag: string | null; paket: string | null; zahlungsreferenz: string | null;
  alterTage: number; mahnungen: number; claimedTage: number | null;
  /** S1–S4: Mails dieses Segments an die Person. S5: Dauerpflege-Mails (alle vier Varianten). */
  bisherige: number;
  /** Das Ereignis, das der Lauf tatsächlich versendet — bei S5 die rotierende Variante. */
  event: string;
  /** Die Lage laut Grundmenge. Bei S1–S4 gleich `segment`; in der Dauerpflege
   *  die ursprüngliche Lage (z. B. s2_behauptet nach ausgeschöpftem S2). */
  lage: Segment;
}

function fallAusZeile(z: any, segment: Segment, event: string): RueckholFall {
  return {
    ref: String(z.ref), personId: Number(z.person_id), segment, event,
    lage: (z.segment as Segment) || segment,
    email: z.email || null, telefon: z.telefon || null, vorname: z.vorname || null,
    betrag: z.amount_due != null ? String(z.amount_due) : null,
    paket: z.pack_name ? String(z.pack_name).split("\n")[0].trim() : null,
    zahlungsreferenz: z.payment_reference || null,
    alterTage: Number(z.alter_tage || 0), mahnungen: Number(z.mahnungen || 0),
    claimedTage: z.claimed_tage != null ? Number(z.claimed_tage) : null,
    bisherige: Number(z.bisherige || 0),
  };
}

/**
 * Die nächsten Dauerpflege-Kandidaten. Reihenfolge: Wer am längsten nichts
 * gehört hat, zuerst (nie angeschrieben vor allen anderen), dann nach Wert.
 * Nur so stimmt „alle N Tage eine Mail“ auch dann, wenn der Tagesdeckel den
 * Vorrat nicht an einem Tag schafft — bei 40/Tag und 850 Fällen braucht eine
 * Runde drei Wochen, und ohne diese Sortierung käme immer dieselbe Spitze dran.
 */
async function dauerpflegeKandidaten(limit: number): Promise<RueckholFall[]> {
  const abstand = await dauerpflegeAbstandTage();
  const zeilen = (await sqlPool`
    SELECT d.* FROM (${dauerpflegeMenge(abstand)}) d
     ORDER BY d.letzte_rueckhol ASC NULLS FIRST, d.amount_due DESC NULLS LAST, d.ref ASC
     LIMIT ${limit}
  `) as any[];
  return zeilen.map((z: any) => fallAusZeile(z, "s5_altbestand", dauerpflegeVariante(Number(z.bisherige || 0))));
}

/**
 * Die nächsten Kandidaten eines Segments — versandfertig gefiltert:
 * Mailadresse vorhanden, Höchstzahl nicht erreicht, 4 Tage Abstand, und für
 * S1/S2 kein unverbuchter Bankeingang mit Referenz- oder Namenstreffer.
 * S5 (Dauerpflege) hat eigene Regeln — siehe `dauerpflegeMenge`.
 */
export async function rueckholKandidaten(segment: Segment, limit: number): Promise<RueckholFall[]> {
  await ensureRueckholSpalten();
  if (segment === "s5_altbestand") return dauerpflegeKandidaten(limit);
  const event = EVENT[segment];
  const hoechstens = HOECHSTENS[segment];
  const zeilen = (await sqlPool`
    WITH basis AS (${grundmenge()}),
    bisher AS (
      SELECT person_id, COUNT(*)::int n, MAX(created_at) letzte
        FROM fiaon_mail_log
       WHERE event = ${event} AND status = 'versandt' AND art = 'echt' AND person_id IS NOT NULL
       GROUP BY 1
    )
    SELECT b.*, COALESCE(x.n, 0) AS bisherige
      FROM basis b
      LEFT JOIN bisher x ON x.person_id = b.person_id
     WHERE b.segment = ${segment}
       AND b.email IS NOT NULL
       AND COALESCE(x.n, 0) < ${hoechstens}
       AND (x.letzte IS NULL OR x.letzte < NOW() - INTERVAL '4 days')
       -- Doppelpost-Sperre (Prüfung 02.09.): Wer heute aus IRGENDEINEM Rückhol-
       -- Segment Post bekam (auch Dauerpflege), bekommt heute keine zweite.
       AND NOT EXISTS (
         SELECT 1 FROM fiaon_mail_log dp
          WHERE dp.event LIKE 'rueckhol_%' AND dp.status = 'versandt' AND dp.art = 'echt'
            AND dp.person_id = b.person_id AND dp.created_at > NOW() - INTERVAL '24 hours')
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
  return zeilen.map((z: any) => fallAusZeile(z, segment, event));
}

export interface LaufErgebnis { segment: Segment; geprueft: number; verschickt: number; uebersprungen: number; grund?: string }

/**
 * Ein Durchlauf über alle aktiven Segmente, in der Reihenfolge des belegten
 * Werts: S1 (verderblich) → S2 (47 %) → S4 (neu) → S3 → S5 (Dauerpflege).
 * Der Tagesdeckel gilt über ALLE Segmente zusammen — die Dauerpflege bekommt,
 * was die vier Lagen des Tages übrig lassen.
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

  const abstand = await dauerpflegeAbstandTage();
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
        // S1–S3: erst stoppen, dann schreiben — die Mail behauptet den Stopp.
        // S5 (Dauerpflege): erst NACH erfolgreichem Versand stoppen — sonst
        // beendet ein von der Bremse blockierter Versuch eine laufende Kette
        // (Prüfung 02.09.).
        if (MIT_MAHNSTOPP.has(segment) && segment !== "s5_altbestand") {
          await sqlPool`UPDATE fiaon_applications SET mahnstopp_am = NOW(), updated_at = NOW()
            WHERE ref = ${f.ref} AND mahnstopp_am IS NULL`;
        }
        const erg = await versendenUndProtokollieren(f.event as any, {
          email: String(f.email),
          vorname: f.vorname || "",
          paket: f.paket,
          betrag: f.betrag,
          payment_reference: f.zahlungsreferenz,
          antrag_id: f.ref,
          termin_link: terminLink(f.personId, "rueckholung"),
          abmelde_url: abmeldeLinkPerson(f.personId),
        } as any, {
          personId: f.personId,
          verlaufRef: f.ref,
          verlaufText: segment === "s5_altbestand"
            ? `Dauerpflege Nr. ${f.bisherige + 1} (${f.event}, Lage ${f.lage}) — die nächste frühestens in ${abstand} Tagen.`
            : `Rückholung ${segment} (Mail ${f.bisherige + 1} von ${HOECHSTENS[segment]}).`,
        });
        if (erg.status === "versandt") {
          verschickt++; rest--;
          if (segment === "s5_altbestand") {
            await sqlPool`UPDATE fiaon_applications SET mahnstopp_am = NOW(), updated_at = NOW()
              WHERE ref = ${f.ref} AND mahnstopp_am IS NULL`.catch(() => {});
          }
        } else uebersprungen++;
      } catch (e) {
        uebersprungen++;
        console.error(`[RUECKHOLUNG] ${segment} ${f.ref}:`, e);
      }
    }
    ergebnisse.push({ segment, geprueft: faelle.length, verschickt, uebersprungen });
  }
  return ergebnisse;
}
