// ═══════════════════════════════════════════════════════════════════════════
// ERINNERUNGSKETTE NACH ANTRAGSABBRUCH (E-023, 22.08.2026)
//
// Justin: „10 Minuten nach dem Abbruch, dann 16:30 und 19:00 Uhr (da sind
// die Menschen von der Arbeit zuhause), am nächsten Tag 07:30, 15:00, 16:30
// und 19:00 Uhr. Wir brauchen maximale Conversion jetzt zu Beginn."
//
// Voraussetzung: Die E-Mail wird im ERSTEN Schritt abgefragt — vorher gab es
// keinen Empfänger, und es gab im ganzen System kein Ereignis für „Antrag
// begonnen, nicht beendet". Jede Mail trägt einen signierten Link genau an
// den abgebrochenen Schritt. Die Kette endet, sobald der Kunde weitermacht
// (antrag_stand_am wird neu gesetzt), eine Zahlungsbestellung existiert
// (dann greift die Zahlungserinnerung) oder alle Mails raus sind (bis 08.10.2026
// sieben, seitdem vier — siehe unten).
//
// ── Mara-Topsales 08.10.2026, nach der Prüfung: VIER MAILS, HÖCHSTENS EINE AM TAG ──
// Solange die Kette tot war (payment_reference, siehe unten), fiel es nicht auf:
// Die sieben Stufen durften in JEDEM Fenster raus, sobald die letzte Mail vor
// dem Fenster lag. Nachgerechnet: Abbruch 11:45 → 11:55 und 12:00 (fünf Minuten
// Abstand), dann 13:30, 17:30, 20:00 — fünf gleiche Werbemails an einem Tag,
// sieben in 27 Stunden, und die Frequenzbremse steht in der Produktion aus.
// Rechtlich trägt nur § 7 Abs. 3 UWG, jede weitere Mail macht den Fall
// angreifbarer (§ 7 Abs. 1 UWG), und Spam-Meldungen treffen fiaon.com — die
// Domain aller Zahlungs- und Ratenmails. JETZT (FOLGESTUFEN, stufeFaellig):
//   1. zehn Minuten nach dem Abbruch (nachts: im ersten Tagesfenster, 12:00),
//   2. am Folgetag ab 12:00, 3. einen Tag später ab 17:30, 4. drei Tage später
//      um 20:00 — nie zwei am selben Berliner Tag, höchstens vier.
// Dazu je Adresse und Person höchstens EINE antrag_erinnerung am Berliner Tag
// (auch über zwei Anträge hinweg), unabhängig von frequenzbremse_an.
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac } from "node:crypto";
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";
import { produktkategorieSql } from "./fiaon-produktkategorie";
import { globalKundeSql, globalKundeBereit } from "./fiaon-global-kunde";
// Mara-Topsales 08.10.2026 (Justin): die eine Regel „abgeschickt“ und die Sperren des Menschen — wie Mara-Aktion und Lead-Strecke.
import { abgeschicktSql } from "../../shared/fiaon-antrag-stand";
import {
  KOPF_SQL, LEAD_ABGEMELDET_ADRESSEN_SQL, LEAD_ABGEMELDET_KOEPFE_SQL, STOPP_KOEPFE_SQL, VERTRIEBSSPERRE_SQL, WERBESPERRE_FAMILIE_SQL,
} from "./fiaon-mail-frequenz";

/** Mara-Topsales 08.10.2026 (Prüfung): vier Mails statt sieben — siehe Kopf und FOLGESTUFEN. */
export const STUFEN_MAX = 4;
const ERSTE_NACH_MIN = 10;
/**
 * Mara-Topsales 08.10.2026 (Prüfung): die Folgestufen 2–4, Index = bisherige Stufe − 1. Eine Folgemail geht frühestens
 * `tageNach` Berliner Kalendertage nach der letzten Mail raus, und nur in einem Tagesfenster (SLOTS) ab `ab` — so liegen
 * nie zwei am selben Tag. Ab Abbruchtag gerechnet: Mail 1 am Tag 1, Mail 2 am Tag 2 ab 12:00, Mail 3 am Tag 3 ab 17:30,
 * Mail 4 am Tag 6 um 20:00 (die Stunden nach E-164: 12 Uhr 33 %, 17 Uhr 36 %, 20 Uhr 52 % geöffnet).
 */
export const FOLGESTUFEN: readonly { tageNach: number; ab: number }[] = [
  { tageNach: 1, ab: 12 * 60 },
  { tageNach: 1, ab: 17 * 60 + 30 },
  { tageNach: 3, ab: 20 * 60 },
];
/**
 * Tagesfenster in Europe/Berlin: Stunde*60+Minute.
 *
 * ── DIE STUNDE ENTSCHEIDET MEHR ALS DER TEXT (07.09.2026, E-164) ──────────
 * Gemessen über 60 Tage in `fiaon_mail_log`, Öffnungsrate je Versandstunde
 * über alle Ereignisse mit mindestens 100 Mails:
 *   20 Uhr 51,6 % · 13 Uhr 46,2 % · 18 Uhr 38,6 % · 17 Uhr 36,2 % ·
 *   12 Uhr 33,2 % · 8 Uhr 23,2 % · 19 Uhr 21,0 % · 15 Uhr 13,5 % ·
 *   16 Uhr 13,2 % · 10 Uhr 12,1 % · 9 Uhr 9,0 % · 7 Uhr 1,5 %
 *
 * Das ist kein Effekt der Mailart, sondern der Stunde. Der Beweis steht in
 * derselben Tabelle, bei DERSELBEN Vorlage:
 *   `payment_details`  7 Uhr: 289 Mails, 1,7 % geöffnet
 *                     19 Uhr:  65 Mails, 55,4 %
 *                     20 Uhr:  51 Mails, 58,8 %
 *   `payment_reminder` 9 Uhr: 5.053 Mails, 7,9 % · 17 Uhr: 562 Mails, 23,5 %
 *   `lead_followup`    9 Uhr: 4.494 Mails, 7,9 % · 19 Uhr: 3.364 Mails, 17,9 %
 * Gleicher Text, gleiche Empfängerart, Faktor 3 bis 33.
 *
 * ── WAS HIER STAND UND WARUM ES WEG MUSSTE ───────────────────────────────
 * Der erste Slot lag auf 7:30. In dieser Stunde gingen über 60 Tage 1.498
 * Mails raus und wurden zu 1,5 % geöffnet; `bankverbindung_neu` schaffte dort
 * 1.142 Mails mit einer Öffnungsrate von 0,0 %. Eine Mail um halb acht kommt
 * an, wenn der Empfänger im Bus sitzt, und ist um neun Uhr unter zwanzig
 * anderen begraben.
 *
 * NEU: vier Fenster, alle in gemessen guten Stunden, weiterhin gleichmäßig
 * über den Tag verteilt, damit ein Mensch nicht vier Mails am Stück bekommt.
 * Die Nachtruhe (21:30–7:00) bleibt unberührt.
 *
 * Wer das ändert, misst vorher nach — die Abfrage steht im Register E-164.
 */
const SLOTS = [12 * 60, 13 * 60 + 30, 17 * 60 + 30, 20 * 60];
const SLOT_BREITE_MIN = 30;
const RUHE_VON = 21 * 60 + 30, RUHE_BIS = 7 * 60; // nachts keine Mail

function geheim(): string {
  return process.env.SESSION_SECRET || process.env.PORTAL_SESSION_SECRET || process.env.MAKE_WEBHOOK_URL || "fiaon-dev-weiter-secret";
}
export function weiterSignatur(ref: string, exp: number): string {
  return createHmac("sha256", geheim()).update(`weiter.${ref}.${exp}`).digest("hex").slice(0, 32);
}
/** Der Link zurück in den Antrag — 14 Tage gültig. */
export function weiterLink(ref: string, ttlMs = 14 * 24 * 60 * 60 * 1000): string {
  const exp = Date.now() + ttlMs;
  return absoluteUrl(`/antrag?weiter=${encodeURIComponent(`${ref}.${exp}.${weiterSignatur(ref, exp)}`)}`);
}
export function weiterPruefen(token: string): string | null {
  const teile = String(token || "").split(".");
  if (teile.length < 3) return null;
  const sig = teile.pop()!; const exp = Number(teile.pop()); const ref = teile.join(".");
  if (!ref || !exp || exp < Date.now()) return null;
  return weiterSignatur(ref, exp) === sig ? ref : null;
}

let spaltenGeprueft = false;
export async function ensureAntragErinnerungSpalten(): Promise<void> {
  if (spaltenGeprueft) return;
  await sqlPool`
    ALTER TABLE fiaon_applications
    ADD COLUMN IF NOT EXISTS antrag_stand_am TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS antrag_erinnerung_stufe INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS antrag_erinnerung_am TIMESTAMPTZ
  `;
  spaltenGeprueft = true;
}

function berlinMinuten(d = new Date()): number {
  const t = new Intl.DateTimeFormat("de-DE", { timeZone: "Europe/Berlin", hour: "2-digit", minute: "2-digit", hour12: false })
    .formatToParts(d).reduce<Record<string, string>>((o, p) => { o[p.type] = p.value; return o; }, {});
  return Number(t.hour) * 60 + Number(t.minute);
}
function berlinTag(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
/** Ganze Berliner Kalendertage von `von` bis `bis` (gleicher Tag = 0). */
function kalendertageZwischen(von: Date, bis: Date): number {
  return Math.round((Date.parse(`${berlinTag(bis)}T12:00:00Z`) - Date.parse(`${berlinTag(von)}T12:00:00Z`)) / 86_400_000);
}

/** Welche Stufe ist JETZT dran — oder null? Reine Funktion, testbar. */
export function stufeFaellig(opts: { stufe: number; standAm: Date; letzteAm: Date | null; jetzt?: Date }): number | null {
  const jetzt = opts.jetzt ?? new Date();
  if (opts.stufe >= STUFEN_MAX) return null;
  const min = berlinMinuten(jetzt);
  const nachts = min >= RUHE_VON || min < RUHE_BIS;
  if (opts.stufe === 0) {
    if (jetzt.getTime() - opts.standAm.getTime() < ERSTE_NACH_MIN * 60 * 1000) return null;
    if (nachts) return null;
    // ── Mara-Topsales 08.10.2026 (Justin): DIE ERSTE MAIL NIE UM SIEBEN ──────────
    // Die 10-Minuten-Mail (E-023) bleibt für jeden Abbruch AM TAG. Lag der Abbruch in der Nachtruhe (oder an einem
    // früheren Tag, z. B. 21:25 Uhr), ging sie bisher um 07:00 raus — gemessen die schwächste Stunde (1,5 % geöffnet,
    // Kopf oben). Jetzt wartet sie auf das erste Tagesfenster (12:00 Uhr, 33 % geöffnet).
    const amTag = berlinTag(opts.standAm) === berlinTag(jetzt) && berlinMinuten(opts.standAm) >= RUHE_BIS;
    if (!amTag && !SLOTS.some((s) => min >= s && min < s + SLOT_BREITE_MIN)) return null;
    return 1;
  }
  // Folgestufen: nur in einem Tagesfenster ab dem Fenster der Stufe, und frühestens `tageNach` Kalendertage nach der
  // letzten Mail (Mara-Topsales 08.10.2026, Prüfung: vorher jedes Fenster, sobald die letzte Mail davor lag — bis zu
  // fünf am selben Tag, zwei im Abstand von fünf Minuten).
  const slot = SLOTS.find((s) => min >= s && min < s + SLOT_BREITE_MIN);
  if (slot == null) return null;
  const regel = FOLGESTUFEN[opts.stufe - 1];
  if (!regel || slot < regel.ab) return null;
  const letzte = opts.letzteAm ?? opts.standAm;
  if (kalendertageZwischen(letzte, jetzt) < regel.tageNach) return null;
  return opts.stufe + 1;
}

// 18.09.2026 exportiert: Der Handversand aus dem Sende-Menü (fiaon-mail-senden.ts)
// nennt denselben Schritt wie der Lauf — eine Liste, nicht zwei.
export const SCHRITT_TEXT: Record<number, string> = {
  1: "Schritt 1 von 5 — Persönliche Daten", 2: "Schritt 2 von 5 — Beruf & Finanzen", 3: "Schritt 3 von 5 — Karte konfigurieren",
  4: "Schritt 3 von 5 — Bonitätsprüfung", 5: "Schritt 3 von 5 — Ihr Rahmen steht", 6: "Schritt 4 von 5 — Vertrag annehmen", 7: "Schritt 4 von 5 — Vertrag annehmen",
};

/**
 * Die Schritte des NEUEN Antrags (05.10.2026, E-283) — current_step, wie
 * server/routes/fiaon-antrag-neu.ts (STAND) ihn schreibt: 1 Angaben, 2 Beruf
 * und Einkommen, 4 Prüfung, 5 Ergebnis/PIN/Paket/Limit, 6 Vertrag und
 * Unterschrift. Ohne „von 5" (der neue Weg zählt anders) und ohne „Rahmen
 * steht"/„genehmigt" — über Karte und Limit entscheidet die Bank.
 */
export const NEU_SCHRITT_TEXT: Record<number, string> = {
  1: "Ihre Angaben", 2: "Beruf und Einkommen", 4: "Prüfung", 5: "Persönliche PIN, Paket und Limit", 6: "Vertrag",
};

/** Der Schritt in Worten — je Weg (antrag_weg „neu" oder alt). Eine Quelle für Lauf und Handversand. */
export function schrittText(schritt: number, weg: string | null | undefined): string {
  if (weg === "neu") return NEU_SCHRITT_TEXT[schritt] || "Ihr Antrag";
  return SCHRITT_TEXT[schritt] || `Schritt ${schritt}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Mara-Topsales 08.10.2026 (Justin): DIE KETTE ZUM ERSTEN MAL SCHARF
//
// Gemessen (nur lesend, 08.10.): Seit dem Einbau am 22.08. ging aus diesem Lauf genau EINE Mail raus. Er verlangte
// `a.payment_reference IS NULL` — der Trigger aus Migration 037 (Z. 55–67) gibt aber JEDEM Antrag beim ersten
// Speichern einen Verwendungszweck. 275 Abbrecher in 14 Tagen, 0 erinnert; der Lauf meldete 582-mal „erfolg“.
// Jetzt gilt die EINE Regel des Hauses (shared/fiaon-antrag-stand.ts): nicht abgeschickt und nichts bezahlt oder
// als bezahlt gemeldet. Dazu, weil antrag_erinnerung Werbung ist (WERBUNG_IMMER in fiaon-mail-frequenz.ts):
//   · der Abmeldelink je Person (wie Rückholung und Lead-Strecke) — ohne Person geht nichts raus,
//   · Werbesperre (Familie), Vertriebssperre (Kopf), „Stopp“ (WhatsApp/Postfach) und Testkonto halten auf,
//   · Global-Kunde (E-272) wie bisher.
// SCHUTZ GEGEN DEN STOSS: Beim ersten scharfen Lauf wird der Zeitpunkt in fiaon_settings festgehalten
// (ANTRAG_ERINNERUNG_STICHTAG). Erinnert werden nur Anträge, die höchstens 48 Stunden vor diesem Zeitpunkt
// begonnen wurden — die übrigen rund 120 Abbrecher der letzten 14 Tage bekommen keine Kette nachgeholt. Danach
// wächst das Fenster von selbst auf die bisherigen 14 Tage. Zeitfenster und der Deckel je Lauf (200) bleiben; die
// Stufen sind seit der Prüfung vier statt sieben, höchstens eine am Tag (Kopf der Datei).
// NACH DER PRÜFUNG (08.10.) außerdem: Lead-Abmeldung hält auf, der alte Antragsweg nur nach dem Werbehinweis, eine
// antrag_erinnerung je Person und Adresse am Tag (abbrecherSql).
// ═══════════════════════════════════════════════════════════════════════════
export const ANTRAG_ERINNERUNG_STICHTAG = "antrag_erinnerung_scharf_seit";
/** Wie weit der erste Lauf zurückgreift (Stunden vor dem Stichtag). */
export const ERSTER_LAUF_STUNDEN = 48;

/** Der Stichtag — beim ersten Aufruf gesetzt (jetzt), danach gelesen (und im Prozess gemerkt: er ändert sich nie). */
let stichtagGemerkt: Date | null = null;
export async function stichtagLesen(lauf: typeof sqlPool = sqlPool): Promise<Date> {
  if (stichtagGemerkt && lauf === sqlPool) return stichtagGemerkt;
  await lauf`INSERT INTO fiaon_settings (key, value) VALUES (${ANTRAG_ERINNERUNG_STICHTAG}, ${new Date().toISOString()})
             ON CONFLICT (key) DO NOTHING`;
  const [z] = (await lauf`SELECT value FROM fiaon_settings WHERE key = ${ANTRAG_ERINNERUNG_STICHTAG}`) as any[];
  const t = Date.parse(String(z?.value ?? ""));
  const d = Number.isFinite(t) ? new Date(t) : new Date();
  if (lauf === sqlPool && Number.isFinite(t)) stichtagGemerkt = d;
  return d;
}

/** Ab wann ein Antrag erinnert werden darf: der spätere von „vor 14 Tagen“ und „48 h vor dem Stichtag“. Rein. */
export function erinnerbarAb(stichtag: Date, jetzt: Date = new Date()): Date {
  return new Date(Math.max(jetzt.getTime() - 14 * 86_400_000, stichtag.getTime() - ERSTER_LAUF_STUNDEN * 3_600_000));
}

/**
 * Die Auswahl der Kette als SQL (ohne Fälligkeit — die rechnet stufeFaellig). `ab` = erinnerbarAb(…) als ISO.
 * Exportiert für Prüfstand und Trockenzählung: dieselbe Abfrage, die der Lauf nimmt.
 */
export function abbrecherSql(ab: string): string {
  const abIso = new Date(ab).toISOString();
  return `
    SELECT a.ref, a.email, a.first_name, a.last_name, a.pack_name, a.pack_key, a.current_step, a.type, a.antrag_weg, a.person_id,
           a.antrag_erinnerung_stufe AS stufe, a.antrag_erinnerung_am AS letzte_am,
           COALESCE(a.antrag_stand_am, a.updated_at, a.created_at) AS stand_am
    FROM fiaon_applications a
    WHERE a.type IN ('private', 'business')
      AND a.email IS NOT NULL AND a.email LIKE '%@%'
      AND a.email NOT ILIKE '%@example.%' AND a.email NOT ILIKE '%test%' AND a.email NOT ILIKE '%fiaon.%'
      AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
      -- Mara-Topsales 08.10.2026: nicht abgeschickt (EINE Regel, shared/fiaon-antrag-stand.ts) und nichts bezahlt
      -- oder gemeldet — statt der alten Bedingung „kein Verwendungszweck“ (den setzt ein Trigger bei jedem Antrag).
      AND NOT ${abgeschicktSql("a")}
      AND COALESCE(a.payment_status, '') NOT IN ('paid', 'claimed_paid')
      -- E-188 (17.09.2026): Die Abbruch-Erinnerung führt zurück in den PRIVATEN
      -- Antrag und spricht von Auskunft und Einträgen. Ein begonnener
      -- FIAON-Global-Auftrag (Unternehmen) bekommt sie nicht.
      AND NOT (${produktkategorieSql("a")} = 'global')
      -- E-272 (02.10.2026): auch kein Privatantrag eines GLOBAL-KUNDEN (Individualangebot oder
      -- Global-Auftrag, kein bezahltes Stufenpaket — Regel in fiaon-global-kunde.ts). Justin:
      -- „nehme ihn bitte komplett aus den Workflows … Er soll Global bleiben, also keine
      -- unnötigen Mails“. Ohne Person (früher Abbruch) bleibt die Zeile drin: Der Ausdruck ist
      -- dann FALSE, nie NULL.
      AND NOT ${globalKundeSql("a.person_id")}
      -- Mara-Topsales 08.10.2026: Werbung braucht eine Person (Abmeldelink) — und deren Sperren halten auf:
      -- Werbesperre (ganze Familie), Vertriebssperre (nur der Kopf), „Stopp“ (WhatsApp/Postfach), Testkonto.
      AND a.person_id IS NOT NULL
      AND NOT ${WERBESPERRE_FAMILIE_SQL("a.person_id")}
      AND NOT ${VERTRIEBSSPERRE_SQL("a.person_id")}
      AND ${KOPF_SQL("a.person_id")} NOT IN ${STOPP_KOEPFE_SQL}
      AND NOT EXISTS (SELECT 1 FROM fiaon_persons pt WHERE pt.id = a.person_id AND pt.ist_test_am IS NOT NULL)
      -- Mara-Topsales 08.10.2026 (Prüfung): Wer sich über den Link einer Lead-Mail abgemeldet hat, liest dort „Du bekommst
      -- keine weiteren E-Mails von uns.“ — an seiner Familie ODER an derselben Adresse (§ 7 Abs. 3 Nr. 3 UWG, Art. 21 DSGVO).
      -- Gemessen 08.10.: 70 Menschen mit Lead-Abmeldung ohne Werbesperre, 4 davon mit Antrag. Seit heute setzt die
      -- Lead-Abmeldung zusätzlich die Werbesperre der Person (fiaon-leads.ts) — diese Zeile hält auch den Bestand.
      AND ${KOPF_SQL("a.person_id")} NOT IN ${LEAD_ABGEMELDET_KOEPFE_SQL}
      AND LOWER(TRIM(a.email)) NOT IN ${LEAD_ABGEMELDET_ADRESSEN_SQL}
      -- Mara-Topsales 08.10.2026 (Prüfung): nur wer den Werbe- und Widerspruchshinweis (§ 7 Abs. 3 Nr. 4 UWG) gesehen hat.
      -- Der neue Antrag zeigt ihn direkt am E-Mail-Feld (ANTRAG_NEU_WERBE_HINWEIS, schritte-angaben.tsx); der alte erst im
      -- Vertragsschritt 6 (antrag.tsx). Ein alter Abbrecher davor bekommt die Kette nur mit einem Lead-Formular samt
      -- gespeicherter Einwilligung (fiaon_leads.einwilligung). Gemessen 08.10.: 7 alte Abbrecher vor Schritt 6 in 3 Tagen.
      AND (COALESCE(a.antrag_weg, '') = 'neu' OR COALESCE(a.current_step, 0) >= 6
           OR EXISTS (SELECT 1 FROM fiaon_leads le WHERE le.einwilligung IS NOT NULL AND le.abgemeldet_am IS NULL
                        AND (le.person_id = a.person_id OR LOWER(TRIM(le.email)) = LOWER(TRIM(a.email)))))
      -- Mara-Topsales 08.10.2026 (Prüfung): höchstens EINE antrag_erinnerung je Person und Adresse am Berliner Tag — auch
      -- über zwei Anträge hinweg, unabhängig von der Frequenzbremse (in der Produktion aus).
      AND NOT EXISTS (SELECT 1 FROM fiaon_mail_log ml
                       WHERE ml.event = 'antrag_erinnerung' AND ml.status = 'versandt'
                         AND ml.created_at >= ((NOW() AT TIME ZONE 'Europe/Berlin')::date::timestamp AT TIME ZONE 'Europe/Berlin')
                         AND (ml.person_id = a.person_id OR LOWER(TRIM(ml.empfaenger)) = LOWER(TRIM(a.email))))
      AND COALESCE(a.current_step, 0) BETWEEN 1 AND 7
      AND a.antrag_erinnerung_stufe < ${STUFEN_MAX}
      AND a.created_at > '${abIso}'::timestamptz
      AND COALESCE(a.antrag_stand_am, a.updated_at, a.created_at) < NOW() - INTERVAL '10 minutes'
      -- Daneben ein abgeschickter, bezahlter oder gemeldeter Antrag derselben Adresse oder Person? Dann ist er kein
      -- Abbrecher, sondern B/A/Kunde — dort greifen Mahnkette, Rückholung und Mara-Aktion.
      AND NOT EXISTS (SELECT 1 FROM fiaon_applications b
                       WHERE b.ref <> a.ref
                         AND (LOWER(TRIM(b.email)) = LOWER(TRIM(a.email)) OR b.person_id = a.person_id)
                         AND (COALESCE(b.payment_status, '') IN ('paid', 'claimed_paid') OR ${abgeschicktSql("b")}))
    ORDER BY a.created_at DESC LIMIT 200`;
}

/** Der Lauf — alle fünf Minuten. Gibt die Zahl der verschickten Mails zurück. */
export async function antragErinnerungenLauf(): Promise<number> {
  await ensureAntragErinnerungSpalten();
  await globalKundeBereit(); // E-272: die Auswahl liest fiaon_global_angebote
  const { sendMakeWebhookMitGrund } = await import("../make-webhook");
  const { abmeldeLinkPerson } = await import("../routes/fiaon-abmelden");
  const ab = erinnerbarAb(await stichtagLesen());
  const kandidaten = (await sqlPool.unsafe(abbrecherSql(ab.toISOString()))) as any[];
  let n = 0;
  // Mara-Topsales 08.10.2026 (Prüfung): eine antrag_erinnerung je Person und Adresse am Tag — die Auswahl prüft das am
  // Mail-Protokoll (abbrecherSql); innerhalb DIESES Laufs (zwei Anträge derselben Adresse) hält es diese Menge.
  const heuteSchon = new Set<string>();
  for (const k of kandidaten) {
    const stufe = stufeFaellig({ stufe: Number(k.stufe || 0), standAm: new Date(k.stand_am), letzteAm: k.letzte_am ? new Date(k.letzte_am) : null });
    if (!stufe) continue;
    const adresse = `a:${String(k.email).trim().toLowerCase()}`, person = `p:${Number(k.person_id)}`;
    if (heuteSchon.has(adresse) || heuteSchon.has(person)) continue;
    heuteSchon.add(adresse); heuteSchon.add(person);
    // Atomar beanspruchen — ein zweiter Lauf (Neustart) schickt nicht doppelt.
    const claimed = (await sqlPool`
      UPDATE fiaon_applications SET antrag_erinnerung_stufe = ${stufe}, antrag_erinnerung_am = NOW()
      WHERE ref = ${k.ref} AND antrag_erinnerung_stufe = ${Number(k.stufe || 0)} RETURNING ref
    `) as any[];
    if (claimed.length === 0) continue;
    const schritt = Number(k.current_step || 1);
    const text = schrittText(schritt, k.antrag_weg);
    const erg = await sendMakeWebhookMitGrund("antrag_erinnerung", {
      email: String(k.email), vorname: k.first_name || null, nachname: k.last_name || null,
      person_id: Number(k.person_id),
      antrag_id: k.ref, paket: k.pack_name || null, pack_key: k.pack_key || null,
      schritt: schritt, schritt_text: text,
      weiter_link: weiterLink(String(k.ref)), erinnerung_nr: stufe,
      portal_url: absoluteUrl("/antrag"),
      // Mara-Topsales 08.10.2026: antrag_erinnerung ist Werbung — ohne Abmeldelink lässt die Tür sie nicht durch (ABMELDEPFLICHT).
      abmelde_url: abmeldeLinkPerson(Number(k.person_id)),
    } as any).catch((e: unknown) => ({ ok: false, grund: e instanceof Error ? e.message : String(e) }));
    const ok = !!erg.ok;
    // Mara-Topsales 08.10.2026: Ein endgültiges Nein der Tür (Werbesperre an der Adresse, unzustellbar) beendet die Kette —
    // sonst klopfte jede Folgestufe erneut an dieselbe Wand (eine Fehlzeile je Fenster).
    if (!ok && /Werbesperre|unzustellbar|Global/.test(String(erg.grund ?? ""))) {
      await sqlPool`UPDATE fiaon_applications SET antrag_erinnerung_stufe = ${STUFEN_MAX} WHERE ref = ${k.ref}`.catch(() => {});
    }
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
      VALUES (${k.ref}, NULL, 'System', 'system',
              ${`Antrags-Erinnerung ${stufe}/${STUFEN_MAX} ${ok ? "verschickt" : "NICHT verschickt (Mail-Tür)"} — ${text}.`}, NOW())
    `.catch(() => {});
    if (ok) n++;
  }
  if (n) console.log(`[ANTRAG-ERINNERUNG] ${n} Erinnerungen verschickt.`);
  return n;
}
