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
// (dann greift die Zahlungserinnerung) oder sieben Mails raus sind.
// ═══════════════════════════════════════════════════════════════════════════
import { createHmac } from "node:crypto";
import { sqlPool } from "./db-pool";
import { absoluteUrl } from "../fiaon-base-url";

const STUFEN_MAX = 7;
const ERSTE_NACH_MIN = 10;
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

/** Welche Stufe ist JETZT dran — oder null? Reine Funktion, testbar. */
export function stufeFaellig(opts: { stufe: number; standAm: Date; letzteAm: Date | null; jetzt?: Date }): number | null {
  const jetzt = opts.jetzt ?? new Date();
  if (opts.stufe >= STUFEN_MAX) return null;
  const min = berlinMinuten(jetzt);
  const nachts = min >= RUHE_VON || min < RUHE_BIS;
  if (opts.stufe === 0) {
    if (jetzt.getTime() - opts.standAm.getTime() < ERSTE_NACH_MIN * 60 * 1000) return null;
    if (nachts) return null;
    return 1;
  }
  // Folgestufen: nur in einem Tagesfenster, und nur wenn die letzte Mail VOR diesem Fenster lag.
  const slot = SLOTS.find((s) => min >= s && min < s + SLOT_BREITE_MIN);
  if (slot == null) return null;
  const letzte = opts.letzteAm;
  if (letzte && berlinTag(letzte) === berlinTag(jetzt) && berlinMinuten(letzte) >= slot) return null;
  return opts.stufe + 1;
}

const SCHRITT_TEXT: Record<number, string> = {
  1: "Schritt 1 von 5 — Persönliche Daten", 2: "Schritt 2 von 5 — Beruf & Finanzen", 3: "Schritt 3 von 5 — Karte konfigurieren",
  4: "Schritt 3 von 5 — Bonitätsprüfung", 5: "Schritt 3 von 5 — Ihr Rahmen steht", 6: "Schritt 4 von 5 — Vertrag annehmen", 7: "Schritt 4 von 5 — Vertrag annehmen",
};

/** Der Lauf — alle fünf Minuten. Gibt die Zahl der verschickten Mails zurück. */
export async function antragErinnerungenLauf(): Promise<number> {
  await ensureAntragErinnerungSpalten();
  const { sendMakeWebhook } = await import("../make-webhook");
  const kandidaten = (await sqlPool`
    SELECT a.ref, a.email, a.first_name, a.last_name, a.pack_name, a.pack_key, a.current_step, a.type,
           a.antrag_erinnerung_stufe AS stufe, a.antrag_erinnerung_am AS letzte_am,
           COALESCE(a.antrag_stand_am, a.updated_at, a.created_at) AS stand_am
    FROM fiaon_applications a
    WHERE a.type IN ('private', 'business')
      AND a.email IS NOT NULL AND a.email LIKE '%@%'
      AND a.email NOT ILIKE '%@example.%' AND a.email NOT ILIKE '%test%' AND a.email NOT ILIKE '%fiaon.%'
      AND a.merged_into IS NULL AND a.archived_at IS NULL AND a.gdpr_deleted_at IS NULL
      AND a.payment_reference IS NULL AND a.payment_status IS DISTINCT FROM 'paid'
      AND a.status NOT IN ('submitted', 'completed', 'payment_completed', 'documents_submitted', 'approved', 'processing')
      AND COALESCE(a.current_step, 0) BETWEEN 1 AND 7
      AND a.antrag_erinnerung_stufe < ${STUFEN_MAX}
      AND a.created_at > NOW() - INTERVAL '14 days'
      AND COALESCE(a.antrag_stand_am, a.updated_at, a.created_at) < NOW() - INTERVAL '10 minutes'
      AND NOT EXISTS (SELECT 1 FROM fiaon_applications b WHERE b.email = a.email AND b.ref <> a.ref
                        AND (b.payment_status = 'paid' OR b.payment_reference IS NOT NULL))
    ORDER BY a.created_at DESC LIMIT 200
  `) as any[];
  let n = 0;
  for (const k of kandidaten) {
    const stufe = stufeFaellig({ stufe: Number(k.stufe || 0), standAm: new Date(k.stand_am), letzteAm: k.letzte_am ? new Date(k.letzte_am) : null });
    if (!stufe) continue;
    // Atomar beanspruchen — ein zweiter Lauf (Neustart) schickt nicht doppelt.
    const claimed = (await sqlPool`
      UPDATE fiaon_applications SET antrag_erinnerung_stufe = ${stufe}, antrag_erinnerung_am = NOW()
      WHERE ref = ${k.ref} AND antrag_erinnerung_stufe = ${Number(k.stufe || 0)} RETURNING ref
    `) as any[];
    if (claimed.length === 0) continue;
    const schritt = Number(k.current_step || 1);
    const ok = await sendMakeWebhook("antrag_erinnerung", {
      email: String(k.email), vorname: k.first_name || null, nachname: k.last_name || null,
      antrag_id: k.ref, paket: k.pack_name || null, pack_key: k.pack_key || null,
      schritt: schritt, schritt_text: SCHRITT_TEXT[schritt] || `Schritt ${schritt}`,
      weiter_link: weiterLink(String(k.ref)), erinnerung_nr: stufe,
      portal_url: absoluteUrl("/antrag"),
    } as any).catch(() => false);
    await sqlPool`
      INSERT INTO fiaon_contact_log (ref, agent_id, agent_name, type, note, created_at)
      VALUES (${k.ref}, NULL, 'System', 'system',
              ${`Antrags-Erinnerung ${stufe}/${STUFEN_MAX} ${ok ? "verschickt" : "NICHT verschickt (Make)"} — ${SCHRITT_TEXT[schritt] || `Schritt ${schritt}`}.`}, NOW())
    `.catch(() => {});
    if (ok) n++;
  }
  if (n) console.log(`[ANTRAG-ERINNERUNG] ${n} Erinnerungen verschickt.`);
  return n;
}
