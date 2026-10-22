// ═══════════════════════════════════════════════════════════════════════════
// ARAS — nachholen, was sie angekündigt hat (E-408, Justin 22.10.2026)
//
// Justin (22.10.2026): „… schickt sie keine email oder WhatsApp, kündigt es per Telefon aber an, dass muss unbedingt, und 100%
// funktionieren“ und „alle whatsapp raus schicken die ARAS angekündigt hat in Vergangenheit bitte!“. Seit e09a0ffe (22.10.
// 14:28 Berlin) hält die Brücke das Wort im Gespräch selbst (shared/fiaon-aras-wort.ts). Für die Gespräche davor — Go-live
// 21.10. 09:30 bis dahin — läuft das hier GENAU EINMAL (Merker), und nur tagsüber (Mo–Sa 09:30–19:30 Berlin):
//   1. Link: ARAS hat Link/Rechnung angekündigt (Abschrift oder Zusammenfassung), im Gespräch ging nichts raus, die Rate ist
//      noch offen und fällig, und seitdem kam keine Raten-WhatsApp → derselbe Weg wie im Gespräch (zahlungslink_senden:
//      WhatsApp, sonst Mail). Nie, wenn der Kunde Betrug, Anzeige oder Anwalt erwähnt hat.
//   2. Aufgabe: „Karte nicht bekommen“ zugesagt, aber keine Aufgabe angelegt → genau eine Aufgabe für Justin (wie im Gespräch).
//      Betrug/Anzeige erwähnt → eine Aufgabe für Justin, und ARAS ist für diese Person aus (ein Mensch klärt).
//   3. Rückruf: ein bei ARAS gebuchter Rückruf ist verfallen, ohne dass ARAS angerufen hat → am nächsten Arbeitstag ab 09:35.
// Jede Handlung hängt am Gespräch (fiaon_aras_werkzeug, aufruf_id „nachholen-…“) und steht im Protokoll — sichtbar im Cockpit.
// ═══════════════════════════════════════════════════════════════════════════
import { sqlPool } from "./db-pool";
import { werkzeugAusfuehren, type WerkzeugKontext } from "./fiaon-aras-werkzeuge";
import { briefingBauen } from "./fiaon-aras-briefing";
import { arasEinstellungenLesen, planVerschieben } from "./fiaon-aras-plan";
import { arasFuerPersonSchalten } from "./fiaon-aras-akte";
import { protokollieren } from "./fiaon-mara-termin";
import { GOLIVE_AB } from "./fiaon-aras-golive";
import { berlinTeile, nummerLand, type Spielart } from "../../shared/fiaon-aras";
import { arasKuendigtZusendungAn, arasBehauptetZusendung, karteNichtBekommen } from "../../shared/fiaon-aras-wort";

type Lauf = typeof sqlPool;

/** Ab hier hält die Brücke das Wort selbst (Deploy e09a0ffe, 22.10.2026 14:28:45 Berlin) — danach gibt es nichts nachzuholen. */
export const WORT_LIVE_AB = "2026-10-22T12:28:45Z";
/** Der Merker — steht er, läuft das Nachholen nie wieder. */
export const NACHHOLEN_MERKER = "aras_nachholen_22_10";
/** Nur tagsüber (Berlin), Mo–Sa: eine WhatsApp um 22 Uhr wäre die nächste Panne. */
export const NACHHOLEN_FENSTER = { von: "09:30", bis: "19:30" } as const;

export interface NachholZeile {
  arasAnrufId: number; callId: number; personId: number; ref: string | null; nummer: string;
  planId: number | null; rateId: number | null; spielart: Spielart; am: string;
  zusammenfassung: string | null; notiz: string | null; transkript: { wer: string; text: string }[] | null;
  /** Werkzeuge, die im Gespräch ok gemeldet haben. */
  werkzeugeOk: string[];
  /** Die Rate des Anrufs ist jetzt noch offen und fällig (nicht bezahlt, nicht storniert, Fälligkeit ≤ heute Berlin). */
  rateOffenFaellig: boolean;
  /** Seit dem Anruf ging eine Raten-WhatsApp (fiaon_kk_rate/fiaon_kkb_rate) an diese Person — von wem auch immer. */
  rateWaSeitdem: boolean;
  /** „Aras für diesen Kunden aus“ ist gesetzt. */
  arasAus: boolean;
}
export type NachholArt = "link" | "aufgabe_karte" | "aufgabe_betrug";

/**
 * Die Zusammenfassung ohne Aufnahme-Ja trägt nur das Ende des Gesprächs — genau dort steht die Ankündigung meist:
 * „Er kündigte an, ihr einen Link zu schicken“, „… dass der Zahlungslink per WhatsApp gesendet wird“, „erhält die Rechnung per WhatsApp“.
 */
const ANGEKUENDIGT_ZUSAMMEN = [
  /\bkündigt\w*\s+an\b[^.]{0,50}\b(?:Link|Rechnung|Zahlungslink)\b/i,
  /\bkündigt\w*\b[^.]{0,40}\b(?:Link|Rechnung|Zahlungslink)\b[^.]{0,40}\ban\b/i,
  /\b(?:Link|Rechnung|Zahlungslink)\b[^.]{0,60}\b(?:per\s+(?:WhatsApp|E-Mail|Mail)|aufs\s+Handy)\b[^.]{0,30}\b(?:ge|zuge)?(?:sendet|schickt|senden|schicken)\b/i,
  /\b(?:schickte|sendete|versprach)\b[^.]{0,40}\b(?:Link|Rechnung|Zahlungslink)\b/i,
  /\berhält\s+(?:die\s+Rechnung|den\s+(?:Zahlungs)?[Ll]ink)\b/i,
];
/** Betrug, Anzeige, Anwalt — dann kein Zahlungsdruck mehr, ein Mensch klärt. */
const BETRUG = /\b(?:betrug\w*|betrüg\w*|strafanzeige|anzeige\s+(?:erstattet|gestellt|gemacht|aufgegeben)|polizei|anwalt|anwältin|verbraucherzentrale|abzocke)\b/i;
const KARTE_ZUSAMMEN = /\bKarte\b[^.]{0,30}\b(?:nicht|noch\s+nicht|nie)\s+(?:angekommen|erhalten|bekommen|da)\b/i;

const zeilenVon = (z: NachholZeile, wer: "aras" | "kunde") => (z.transkript ?? []).filter((t) => t?.wer === wer).map((t) => String(t?.text ?? ""));

/** Hat ARAS in diesem Gespräch Link oder Rechnung angekündigt (oder behauptet, sie sei raus)? Rein. */
export function zusendungAngekuendigt(z: NachholZeile): boolean {
  if (zeilenVon(z, "aras").some((t) => arasKuendigtZusendungAn(t) || arasBehauptetZusendung(t))) return true;
  const zus = String(z.zusammenfassung ?? "");
  return ANGEKUENDIGT_ZUSAMMEN.some((re) => re.test(zus));
}
/** Hat der Kunde Betrug, Anzeige oder Anwalt erwähnt? (Zusammenfassung, Notiz, seine eigenen Worte — nie ARAS' Sätze.) Rein. */
export function betrugErwaehnt(z: NachholZeile): boolean {
  return BETRUG.test(`${z.zusammenfassung ?? ""} ${z.notiz ?? ""} ${zeilenVon(z, "kunde").join(" ")}`);
}
/** Hat der Kunde gesagt, er habe keine Karte bekommen? Rein. */
export function karteFehltErwaehnt(z: NachholZeile): boolean {
  return zeilenVon(z, "kunde").some(karteNichtBekommen) || KARTE_ZUSAMMEN.test(`${z.zusammenfassung ?? ""} ${z.notiz ?? ""}`);
}

/** Was ist für dieses Gespräch nachzuholen? Rein — der Prüfstand rechnet es mit echten Sätzen nach. */
export function nachholFaelle(z: NachholZeile): { art: NachholArt; grund: string }[] {
  const out: { art: NachholArt; grund: string }[] = [];
  const betrug = betrugErwaehnt(z);
  const aufgabeLief = z.werkzeugeOk.includes("aufgabe_fuer_justin");
  if (betrug) {
    if (!aufgabeLief) out.push({ art: "aufgabe_betrug", grund: "Betrug/Anzeige im Gespräch erwähnt — keine Aufgabe angelegt" });
    return out; // kein Link, keine Karten-Aufgabe: ein Mensch klärt alles
  }
  if (zusendungAngekuendigt(z) && !z.werkzeugeOk.includes("zahlungslink_senden") && !z.arasAus) {
    if (!z.rateOffenFaellig) { /* bezahlt, storniert oder (neu) noch nicht fällig — dann wäre der Link falsch */ }
    else if (z.rateWaSeitdem) { /* die Raten-WhatsApp kam inzwischen auf anderem Weg (z. B. WhatsApp-Zentrale) */ }
    else out.push({ art: "link", grund: "Link/Rechnung angekündigt, nichts geschickt" });
  }
  if (karteFehltErwaehnt(z) && !aufgabeLief) out.push({ art: "aufgabe_karte", grund: "„Karte nicht bekommen“ — Aufgabe zugesagt, nicht angelegt" });
  return out;
}

/** Liegt `jetzt` im Fenster (Mo–Sa, Berlin)? Rein. */
export function imNachholFenster(jetzt: Date): boolean {
  const b = berlinTeile(jetzt);
  return b.wochentag <= 6 && b.hhmm >= NACHHOLEN_FENSTER.von && b.hhmm < NACHHOLEN_FENSTER.bis;
}

/** Der nächste Arbeitstag (Mo–Sa) nach `datum` (JJJJ-MM-TT). Rein. */
export function naechsterArbeitstag(datum: string): string {
  const d = new Date(`${datum}T12:00:00Z`);
  do d.setUTCDate(d.getUTCDate() + 1); while (d.getUTCDay() === 0);
  return d.toISOString().slice(0, 10);
}

async function zeilenLaden(lauf: Lauf): Promise<NachholZeile[]> {
  const rows = (await lauf`
    SELECT a.id AS aras_anruf_id, a.call_id, c.person_id, p.ref, COALESCE(p.nummer, c.nummer) AS nummer, a.plan_id, p.rate_id,
           COALESCE(p.spielart, a.spielart) AS spielart, a.created_at, a.zusammenfassung, a.ergebnis_notiz, a.transkript,
           COALESCE((SELECT array_agg(DISTINCT w.werkzeug) FROM fiaon_aras_werkzeug w WHERE w.aras_anruf_id = a.id AND w.ok), '{}') AS werkzeuge_ok,
           EXISTS (SELECT 1 FROM fiaon_abo_raten r WHERE r.id = p.rate_id AND r.status = 'offen' AND r.storniert_am IS NULL AND r.bezahlt_am IS NULL
                     AND r.faellig_am::date <= (NOW() AT TIME ZONE 'Europe/Berlin')::date) AS rate_offen_faellig,
           EXISTS (SELECT 1 FROM fiaon_whatsapp x WHERE x.person_id = c.person_id AND x.richtung = 'raus' AND x.created_at >= a.created_at
                     AND x.vorlage IN ('fiaon_kk_rate', 'fiaon_kkb_rate') AND COALESCE(x.status, '') <> 'fehler') AS rate_wa_seitdem,
           EXISTS (SELECT 1 FROM fiaon_aras_person ap WHERE ap.person_id = c.person_id AND ap.aus_am IS NOT NULL) AS aras_aus
      FROM fiaon_aras_anruf a
      JOIN fiaon_calls c ON c.id = a.call_id
      LEFT JOIN fiaon_aras_plan p ON p.id = a.plan_id
     WHERE a.created_at >= ${GOLIVE_AB}::timestamptz AND a.created_at < ${WORT_LIVE_AB}::timestamptz
       AND COALESCE(p.spielart, a.spielart, '') <> 'probe' AND c.person_id IS NOT NULL
       AND a.ergebnis IS NOT NULL AND a.ergebnis NOT IN ('mailbox', 'nicht_erreicht', 'nummer_falsch')
     ORDER BY a.id`) as any[];
  return rows.map((r) => ({
    arasAnrufId: Number(r.aras_anruf_id), callId: Number(r.call_id), personId: Number(r.person_id), ref: r.ref ?? null, nummer: String(r.nummer ?? ""),
    planId: r.plan_id != null ? Number(r.plan_id) : null, rateId: r.rate_id != null ? Number(r.rate_id) : null, spielart: r.spielart as Spielart,
    am: new Date(r.created_at).toISOString(), zusammenfassung: r.zusammenfassung ?? null, notiz: r.ergebnis_notiz ?? null,
    transkript: Array.isArray(r.transkript) ? r.transkript : typeof r.transkript === "string" ? JSON.parse(r.transkript) : null,
    werkzeugeOk: Array.isArray(r.werkzeuge_ok) ? r.werkzeuge_ok.map(String) : [],
    rateOffenFaellig: r.rate_offen_faellig === true, rateWaSeitdem: r.rate_wa_seitdem === true, arasAus: r.aras_aus === true,
  }));
}

async function kontext(z: NachholZeile, lauf: Lauf): Promise<WerkzeugKontext> {
  const briefing = await briefingBauen({ personId: z.personId, nummer: z.nummer, spielart: z.spielart, rateId: z.rateId, planId: z.planId }, lauf);
  const nichts = async () => ({ ok: false, grund: "nachholen" });
  return {
    callId: z.callId, arasAnrufId: z.arasAnrufId, personId: z.personId, ref: z.ref, nummer: z.nummer, land: nummerLand(z.nummer) ?? "DE", spielart: z.spielart,
    briefing, einstellungen: await arasEinstellungenLesen(true, lauf), ergebnisGesetzt: true, ausgefuehrt: [],
    letzteKundenZeile: () => null, aufnahmeStarten: nichts, uebergabe: nichts, beenden: async () => {},
  };
}

const tagDe = (iso: string) => berlinTeile(new Date(iso)).datum.split("-").reverse().join(".");

/**
 * Einmal-Lauf. Liefert true, wenn er JETZT gelaufen ist. Erst das Fenster, dann der Merker (wer ihn setzt, gewinnt — auch bei
 * zwei Instanzen), dann die Fälle. Jeder Fall für sich: ein Fehler hält die anderen nicht auf.
 */
export async function nachholenPruefen(lauf: Lauf = sqlPool, jetzt: Date = new Date(), ausfuehren: typeof werkzeugAusfuehren = werkzeugAusfuehren): Promise<boolean> {
  if (!imNachholFenster(jetzt)) return false;
  const gesetzt = (await lauf`
    INSERT INTO fiaon_settings (key, value, updated_at) VALUES (${NACHHOLEN_MERKER}, ${jetzt.toISOString()}, NOW())
    ON CONFLICT (key) DO NOTHING RETURNING key`) as any[];
  if (!gesetzt.length) return false;

  const zaehler: Record<string, number> = { link: 0, link_fehler: 0, link_ohne_rate: 0, aufgabe_karte: 0, aufgabe_betrug: 0, aras_aus: 0, rueckruf: 0, fehler: 0 };
  for (const z of await zeilenLaden(lauf)) {
    for (const f of nachholFaelle(z)) {
      try {
        const ctx = await kontext(z, lauf);
        const aufruf = `nachholen-${z.arasAnrufId}-${f.art}`;
        if (f.art === "link") {
          // Ohne offene Rate im Briefing ginge zahlungslink_senden auf den Antrag-Link — das wäre falsch.
          if (!ctx.briefing.offeneRate) { zaehler.link_ohne_rate++; continue; }
          const r = await ausfuehren(ctx, "zahlungslink_senden", { weg: "whatsapp", zweck: "rate" }, aufruf, lauf);
          zaehler[r.ok ? "link" : "link_fehler"]++;
        } else {
          const text = f.art === "aufgabe_karte"
            ? `Nachgetragen: Im Anruf vom ${tagDe(z.am)} sagte der Kunde, die Karte sei nicht angekommen. ARAS hat eine Klärung zugesagt, die Aufgabe aber nicht angelegt.`
            : `Nachgetragen: Im Anruf vom ${tagDe(z.am)} erwähnte der Kunde Betrug bzw. eine Anzeige. ARAS ruft ihn nicht mehr an — bitte persönlich klären.`;
          const r = await ausfuehren(ctx, "aufgabe_fuer_justin", { art: f.art === "aufgabe_karte" ? "karte_nicht_erhalten" : "sonstiges", text }, aufruf, lauf);
          if (r.ok) zaehler[f.art]++; else zaehler.fehler++;
          if (f.art === "aufgabe_betrug") {
            await arasFuerPersonSchalten(z.personId, true, "Betrug/Anzeige im ARAS-Anruf erwähnt — ein Mensch klärt", null, "ARAS nachholen", lauf);
            zaehler.aras_aus++;
          }
        }
      } catch (e) {
        zaehler.fehler++;
        console.error("[ARAS-NACHHOLEN]", f.art, String((e as Error)?.message ?? e).slice(0, 200));
      }
    }
  }
  zaehler.rueckruf = await rueckrufeNachholen(lauf, jetzt).catch((e) => { console.error("[ARAS-NACHHOLEN] Rückrufe:", String(e).slice(0, 200)); return 0; });

  const satz = `ARAS nachgeholt (Gespräche 21.10.–22.10. 14:28): ${zaehler.link} Link(s) geschickt${zaehler.link_fehler ? `, ${zaehler.link_fehler} nicht rausgegangen` : ""}, `
    + `${zaehler.aufgabe_karte + zaehler.aufgabe_betrug} Aufgabe(n) für Justin, ${zaehler.aras_aus}× ARAS aus (Betrug/Anzeige), ${zaehler.rueckruf} Rückruf(e) neu eingeplant.`;
  await protokollieren({ kanal: "telefon", art: "aras_werkzeug" as any, text: satz, daten: { ...zaehler, merker: NACHHOLEN_MERKER }, ok: zaehler.fehler === 0 }, lauf).catch(() => null);
  console.log(`[ARAS] ${satz}`);
  return true;
}

/**
 * Verfallene Rückrufe bei ARAS (Spielart termin): Der Kunde hat sich einen Anruf gewünscht, ARAS rief nicht an (22.10.: der
 * Tagesdeckel war um 10:07 voll, der Rückruf um 11:00 verfiel). → Dieselbe Zeile am nächsten Arbeitstag ab 09:35 wieder auf
 * „wartet“ (planVerschieben — derselbe Termin, dieselbe Einwilligung).
 */
async function rueckrufeNachholen(lauf: Lauf, jetzt: Date): Promise<number> {
  const rows = (await lauf`
    SELECT p.id
      FROM fiaon_aras_plan p
     WHERE p.spielart = 'termin' AND p.status = 'verfallen' AND p.termin_id IS NOT NULL AND p.person_id IS NOT NULL
       AND p.created_at >= ${GOLIVE_AB}::timestamptz AND p.created_at < ${WORT_LIVE_AB}::timestamptz
       AND NOT EXISTS (SELECT 1 FROM fiaon_aras_anruf a JOIN fiaon_calls c ON c.id = a.call_id
                        WHERE c.person_id = p.person_id AND a.created_at >= p.frueh_ab)
       AND NOT EXISTS (SELECT 1 FROM fiaon_aras_plan x WHERE x.termin_id = p.termin_id AND x.id <> p.id AND x.status IN ('wartet', 'gewaehlt', 'laeuft', 'fertig'))
       AND NOT EXISTS (SELECT 1 FROM fiaon_aras_person ap WHERE ap.person_id = p.person_id AND ap.aus_am IS NOT NULL)`) as any[];
  if (!rows.length) return 0;
  const tag = naechsterArbeitstag(berlinTeile(jetzt).datum);
  const [t] = (await lauf`SELECT ((${tag}::date + time '09:35') AT TIME ZONE 'Europe/Berlin') AS von`) as any[];
  for (const r of rows) await planVerschieben(Number(r.id), new Date(t.von), "Rückruf ausgefallen (Tagesdeckel) — nachholen", "ARAS nachholen", lauf);
  return rows.length;
}
