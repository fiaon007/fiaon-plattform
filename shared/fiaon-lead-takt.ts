// ═══════════════════════════════════════════════════════════════════════════
// FIAON GLOBAL — EIN STAND JE LEAD, DANIELS TAKT, ÜBERSICHT 18:30, WÄCHTER: DIE REINEN REGELN (E-476 Scheibe 5, 05.11.2026)
//
// Justin (05.11.2026, „4× A … Mach alles fix und fertig“), Entscheidung 3A: Daniels Lead-Meldungen gehen an seine
// Firmenadresse — neues Feld „Lead-Meldungen an“ im Chefbüro › Rückholung › FIAON Global (Vorgabe: die Adresse auf der
// öffentlichen Visitenkarte der zuständigen Person, heute Daniels Firmenadresse) — nie an ein privates Postfach.
//
// Hier steht nur, was Server, Cockpit und Prüfstand gemeinsam lesen (ohne Datenbank):
//   · die Schlüssel der Einstellungen und ihre Vorgaben, die Prüfung der Adresse (nur @fiaon.com);
//   · die Pflicht-Notiz beim Anruf-Ergebnis „erreicht“ — NUR für Business-Leads (Gutachten 0, Mangel 9: nicht für
//     Kaltakquise-Listen) — und die Termin-Regel („Termin vereinbart“ nur mit einem Termin im Kalender);
//   · der EINE Stand: Der Stand der Anfrage folgt dem Firmen-Cockpit (plus Kalender und Anrufen), und jedes Ereignis
//     sagt, was mit dem Anruf-Auftrag passiert (schließen, offen lassen, wieder öffnen).
// Die Zeitregeln (Dienstzeit-Uhr, Eskalation 15/60/120, Übersicht 18:30) und die Mailtexte stehen in
// server/lib/fiaon-lead-takt-regeln.ts, die Datenbank-Arbeit in server/lib/fiaon-lead-takt.ts.
// Repo öffentlich: keine Kundendaten; Firmenadressen nur über die öffentlichen Visitenkarten.
// ═══════════════════════════════════════════════════════════════════════════
import { ERZAEHLT_FELDER, ERZAEHLT_MIN, EINSCHAETZUNGEN, type Einschaetzung } from "./fiaon-lead-weg";
import { VISITENKARTEN, visitenkarteFuerAgent } from "./fiaon-visitenkarte";

// ── Einstellungen (fiaon_settings) ──────────────────────────────────────────
export const LEAD_TAKT_SCHLUESSEL = {
  /** „Lead-Meldungen an“ (Chefbüro › Rückholung › FIAON Global): leer = Vorgabe (Visitenkarte der zuständigen Person). */
  meldungAn: "global_lead_meldung_an",
  /**
   * Die Erinnerungen 15/60/120 Minuten. Vorgabe AN (Entscheidung 3A). Nachbesserung E-476 (Gutachten Technik Mangel 2 /
   * Betreiber Mangel 9): getrennt von der Lead-Meldung T1 — wer die Erinnerungen leiser stellt, verliert nie die Meldung.
   */
  taktAn: "lead_takt_an",
  /** Die Lead-Meldung T1 an „Lead-Meldungen an“. Vorgabe AN. AUS = die Auftrag-Mail geht wieder (an dieselbe Firmenadresse). */
  meldungT1An: "lead_meldung_an",
  /** Zählbeginn des Takts — beim ersten Lauf gesetzt; Leads davor bekommen weder T1 noch Erinnerung (keine Flut). */
  ab: "lead_takt_ab",
  /** Die Übersicht um 18:30 an Justin und an die Lead-Meldungen-Adresse. Vorgabe AN. */
  uebersichtAn: "lead_uebersicht_an",
  /** Tagesmerker der Übersicht: „JJJJ-MM-TT“ = gesendet (oder nichts zu melden), „JJJJ-MM-TT#f<n>“ = n Fehlversuche. */
  uebersichtTag: "lead_uebersicht_tag",
  /** Der Meta-Webhook schweigt — bekannter Zustand seit … (einmal gemeldet, nicht täglich). Leer = Webhook liefert. */
  webhookStill: "meta_webhook_still_seit",
} as const;

export const LEAD_TAKT_VORGABE = {
  /** Die Erinnerungsleiter in Dienstminuten (Mo–Fr 9–18 Uhr Berlin): Daniel, Justin, Zusage-Wächter. */
  erinnerungMin: 15,
  justinMin: 60,
  zusageMin: 120,
  /** Die Dienstzeit (Berlin, Mo–Fr, ohne Feiertage). */
  dienstVon: 9,
  dienstBis: 18,
  /** Die Übersicht kommt um 18:30 (Minuten ab Mitternacht, Berlin), nur werktags. */
  uebersichtUm: 18 * 60 + 30,
  /** T1 und Erinnerungen nur für Leads bis zu so vielen Tagen. */
  hoechstensTage: 3,
  /** „Lead ohne Dossier“ schlägt nach so vielen Minuten an. */
  ohneDossierMin: 10,
  /** „Noch offen von früher“ in der Übersicht: Leads bis zu so vielen Tagen. */
  offenTage: 7,
  /** T1: so viele Versuche, dann ein Alarm (Wächter „Lead-Mail gescheitert“). */
  t1Versuche: 3,
  /** Nachbesserung (Gutachten Sicherheit, Mangel 2): höchstens so viele Lead-Meldungen je Berliner Tag — darüber Alarm „Flut“. */
  t1MaxTag: 30,
  /** Nachbesserung (Gutachten Sicherheit, Mangel 7): mehr Kalender-Buchungen in einer Stunde schlagen im Lagezimmer an. */
  buchungenJeStunde: 6,
  /** Die Wächter prüfen höchstens alle so viele Minuten (der Lauf selbst geht alle fünf). */
  waechterMin: 15,
} as const;

const AN = /^(1|an|true|ja|on)$/i;
const AUS = /^(0|aus|false|nein|off)$/i;
/** Ein Schalter mit Vorgabe: leer/fehlt = Vorgabe, sonst AN/AUS. Rein. */
export function schalterLesen(wert: unknown, vorgabe: boolean): boolean {
  const s = String(wert ?? "").trim();
  if (AN.test(s)) return true;
  if (AUS.test(s)) return false;
  return vorgabe;
}

// ── „Lead-Meldungen an“ ─────────────────────────────────────────────────────
const FIAON_ADRESSE = /^[a-z0-9._%+-]+@fiaon\.com$/;
/** Nur ein Postfach des Hauses (@fiaon.com) — Kundendaten gehören nie in ein privates Postfach (Entscheidung 3A). Rein. */
export function meldeAdresseGueltig(wert: unknown): boolean {
  return FIAON_ADRESSE.test(String(wert ?? "").trim().toLowerCase());
}

/**
 * Die Adresse für Daniels Lead-Meldungen: die Einstellung, wenn sie gültig ist — sonst die Adresse auf der öffentlichen
 * Visitenkarte der zuständigen Person (shared/fiaon-visitenkarte.ts), sonst Daniels Visitenkarte (Vorgabe aus Entscheidung
 * 3A). Nie die Login-Adresse des Kontos. Rein.
 */
export function meldeAdresseWaehlen(einstellung: unknown, zustaendigAgentId: number | null | undefined): { an: string; quelle: "einstellung" | "visitenkarte" | "vorgabe"; karte: string | null } {
  const e = String(einstellung ?? "").trim().toLowerCase();
  if (meldeAdresseGueltig(e)) return { an: e, quelle: "einstellung", karte: null };
  const k = visitenkarteFuerAgent(zustaendigAgentId ?? null);
  if (k && meldeAdresseGueltig(k.email)) return { an: k.email.toLowerCase(), quelle: "visitenkarte", karte: k.name };
  return { an: VISITENKARTEN.daniel.email, quelle: "vorgabe", karte: VISITENKARTEN.daniel.name };
}

/**
 * Nachbesserung (Gutachten Technik Mangel 2, Sicherheit Mangel 10): wohin die Meldung zu EINEM Auftrag geht. Liegt er bei der
 * zuständigen Person → „Lead-Meldungen an“ (meldeAdresseWaehlen). Liegt er bei jemand anderem (Vertretung, Abwesenheit,
 * Umhängen) → dessen Visitenkarte, sonst dessen Anmeldung NUR, wenn sie auf @fiaon.com endet — sonst wieder „Lead-Meldungen an“
 * (das Team-Postfach, `fremd`: der Auftrag liegt bei jemand anderem). Nie ein privates Postfach. Rein.
 */
export function meldeZielFuerAuftrag(ein: { einstellung: unknown; zustaendigId: number | null; auftragAgentId: number | null; loginEmail?: string | null }):
  { an: string; quelle: "einstellung" | "visitenkarte" | "vorgabe" | "anmeldung" | "team"; karte: string | null; fremd: boolean } {
  const team = meldeAdresseWaehlen(ein.einstellung, ein.zustaendigId);
  if (!ein.auftragAgentId || ein.auftragAgentId === ein.zustaendigId) return { ...team, fremd: false };
  const k = visitenkarteFuerAgent(ein.auftragAgentId);
  if (k && meldeAdresseGueltig(k.email)) return { an: k.email.toLowerCase(), quelle: "visitenkarte", karte: k.name, fremd: true };
  if (meldeAdresseGueltig(ein.loginEmail)) return { an: String(ein.loginEmail).trim().toLowerCase(), quelle: "anmeldung", karte: null, fremd: true };
  return { an: team.an, quelle: "team", karte: team.karte, fremd: true };
}

// ── Die Pflicht-Notiz beim Anruf-Ergebnis (nur Business-Leads) ──────────────
/** Bei diesen Ergebnissen muss ein Business-Lead-Anruf zwei, drei Sätze tragen (Plan 5.2) — sie fließen in D2 und D3. */
export const PFLICHT_NOTIZ_ERGEBNISSE = ["erreicht_interesse", "erreicht_termin"] as const;

/**
 * Prüft die Notiz eines Anruf-Ergebnisses. Kaltakquise (kein Business-Lead) und die anderen Ergebnisse: frei wie bisher.
 * Business-Lead + „erreicht — Interesse/Termin“: mindestens zwei, drei Sätze, was ER erzählt hat; die fünf kurzen Felder
 * (Wohnort, Rolle, wer noch, US-Bezug, Größe) und heiß/warm/kalt sind freiwillig. Ergebnis: EIN Text. Rein.
 */
export function anrufNotizPruefen(ein: {
  ergebnis: string; istLead: boolean; text: unknown; felder?: Partial<Record<string, unknown>> | null; einschaetzung?: unknown;
}): { ok: true; text: string | null; erzaehlt: string | null; einschaetzung: Einschaetzung | null } | { ok: false; error: string; feld: string } {
  const text = String(ein.text ?? "").replace(/\s+/g, " ").trim().slice(0, 1500);
  const pflicht = ein.istLead && (PFLICHT_NOTIZ_ERGEBNISSE as readonly string[]).includes(ein.ergebnis);
  const e = String(ein.einschaetzung ?? "").trim().toLowerCase().replace("ß", "ss");
  const einschaetzung = (EINSCHAETZUNGEN as readonly string[]).includes(e) ? (e as Einschaetzung) : null;
  const zeilen = text ? [text] : [];
  for (const f of ERZAEHLT_FELDER) {
    const w = String(ein.felder?.[f.key] ?? "").replace(/\s+/g, " ").trim().slice(0, 200);
    if (w) zeilen.push(`${f.label}: ${w}`);
  }
  if (pflicht && text.length < ERZAEHLT_MIN) {
    return { ok: false, feld: "notiz", error: "Bitte zwei, drei Sätze: Was hat er selbst erzählt? Wer ist er, was will er, wie groß, wie ernst? (Pflicht bei „erreicht“ — Justin liest das vor dem Gespräch.)" };
  }
  const gesamt = zeilen.join("\n").slice(0, 2000) || null;
  // „Was er selbst erzählt hat“ (D2/D3) nur aus einem ERREICHTEN Anruf eines Business-Leads — eine Notiz zu „nicht
  // erreicht“ ist keine Aussage des Leads.
  return { ok: true, text: gesamt, erzaehlt: ein.istLead && /^erreicht_/.test(ein.ergebnis) ? gesamt : null, einschaetzung };
}

/** Die Termin-Regel (Plan 5.1): „Erreicht — Termin vereinbart“ gibt es bei einem Business-Lead nur mit Termin im Kalender. */
export const TERMIN_OHNE_KALENDER = "Bei einem Business-Lead gibt es „Termin vereinbart“ nur mit einem Termin im Kalender — bitte zuerst „Termin bei Justin eintragen“ (die Zeit, die ihr eben vereinbart habt). Dann ist der Termin wirklich da, er bekommt die Bestätigung und Justin die Anruf-Karte.";

// ── DER EINE STAND ──────────────────────────────────────────────────────────
/** Was am Lead passiert — vom Anruf-Ergebnis, vom Kalender, vom Gesprächsergebnis, von Justins Knopf. */
export type LeadStandEreignis =
  | "anruf:erreicht_interesse" | "anruf:erreicht_termin" | "anruf:erreicht_antrag" | "anruf:erreicht_kein_interesse"
  | "anruf:nicht_erreicht" | "anruf:mailbox" | "anruf:nummer_falsch"
  | "termin_gebucht" | "termin_abgesagt" | "gespraech_gefuehrt" | "gespraech_nicht_zustande" | "gespraech_kein_interesse"
  | "selbst" | "ableitung"
  // Nachbesserung E-476 (Gutachten Sicherheit, Mangel 6): eine schriftliche Absage („kein Interesse“) — der Auftrag schließt sich.
  | "schriftlich_abgesagt"
  // E-481 (Mara Business): er wählt das Gespräch per E-Mail (Justin schreibt aus js@) oder auf WhatsApp (Mara) — der
  // Wunsch des Kunden zählt, Daniels Anruf-Auftrag schließt sich mit Vermerk.
  | "weg_mail" | "weg_whatsapp";

/** Was mit dem Anruf-Auftrag („bitte anrufen“, global-anfrage:<id>, und dem Rückruf der Vertretung) passiert. */
export type AuftragFolge = "schliessen" | "offen_lassen" | "wieder_oeffnen" | null;

/**
 * Ein Ereignis → was mit dem Anruf-Auftrag passiert. Erreicht (jeder Ausgang), Nummer falsch, Termin, Gespräch geführt,
 * Justin ruft selbst an → der Auftrag ist erfüllt. Nicht erreicht / Mailbox → er bleibt offen (Fälligkeit = Wiedervorlage,
 * eine Zeile im Verlauf). Termin abgesagt oder Justin hat ihn nicht erreicht → er geht wieder auf (heute anrufen). Rein.
 */
export function auftragNachEreignis(e: LeadStandEreignis): AuftragFolge {
  if (e === "anruf:nicht_erreicht" || e === "anruf:mailbox") return "offen_lassen";
  if (e === "termin_abgesagt" || e === "gespraech_nicht_zustande") return "wieder_oeffnen";
  if (e === "ableitung") return null;
  return "schliessen";
}

/** Diese Cockpit-Stände sind ein Abschluss — die Anfrage übernimmt sie wörtlich. */
export const STAND_ABSCHLUSS = ["kein_interesse", "ungueltig", "antrag", "kunde"] as const;

/**
 * Der Stand der Anfrage — abgeleitet, nie getrennt gepflegt (Plan 5.1: „Anfrage, Auftrag und Kalender ziehen mit“):
 *   privat bleibt privat · gebuchter Termin → „termin“ (NUR mit Termin — eine Firma auf „termin“ ohne Termin war der Befund) ·
 *   Abschluss im Cockpit → derselbe Stand · angerufen, Gespräch geführt oder „in Arbeit“ → „in_arbeit“ · sonst „neu“. Rein.
 */
export function anfrageStandAus(f: { jetzt?: string | null; firmaStatus: string | null; terminGebucht: boolean; angerufen: boolean; gefuehrt: boolean }): string {
  if (f.jetzt === "privat") return "privat";
  if (f.terminGebucht) return "termin";
  if (f.firmaStatus && (STAND_ABSCHLUSS as readonly string[]).includes(f.firmaStatus)) return f.firmaStatus;
  if (f.angerufen || f.gefuehrt || f.firmaStatus === "in_arbeit") return "in_arbeit";
  return "neu";
}

/**
 * Stimmt der Cockpit-Stand? „termin“ ohne gebuchten Termin ist ein Widerspruch (Gutachten 1, Mangel 4: der Lead glaubt an
 * ein Gespräch, Justin weiß nichts) → zurück nach oben in „Jetzt dran“ (Wiedervorlage heute). null = stimmt. Rein.
 */
export function firmaStandKorrektur(f: { firmaStatus: string | null; terminGebucht: boolean }): { status: "wiedervorlage"; grund: string } | null {
  if (f.firmaStatus === "termin" && !f.terminGebucht) {
    return { status: "wiedervorlage", grund: "Im Cockpit stand „Termin“, im Kalender steht keiner — bitte die vereinbarte Zeit erfragen und „Termin bei Justin eintragen“." };
  }
  return null;
}

/** Die Wörter des Anfrage-Stands (Chefbüro, Übersicht, Cockpit). */
export const ANFRAGE_STAND_WORT: Readonly<Record<string, string>> = {
  neu: "neu", in_arbeit: "in Arbeit", termin: "Termin steht", kein_interesse: "kein Interesse", ungueltig: "Nummer falsch",
  antrag: "Antrag läuft", kunde: "Kunde", privat: "Privat-Weg",
};

// ═══════════════════════════════════════════════════════════════════════════
// E-487 (09.11.2026, Wunsch aus dem Vertrieb): RÜCKRUF SELBST EINTRAGEN — im Cockpit Tag und auf Wunsch Uhrzeit wählen,
// das nächste Ergebnis („Erreicht — Interesse“, „Nicht erreicht“, „Mailbox“) nimmt ihn mit. Bis dahin ist die Firma aus
// „Jetzt dran“ verschwunden, am Tag steht sie oben, 10 Minuten vor der Uhrzeit kommt eine kurze Mail. Rein.
// ═══════════════════════════════════════════════════════════════════════════
/** Die Ergebnisse, die einen eigenen Rückruf mitnehmen — bei allen anderen gilt die feste Regel des Cockpits. */
export const RUECKRUF_ERGEBNISSE = ["erreicht_interesse", "nicht_erreicht", "mailbox"] as const;
/** So weit voraus darf ein Rückruf liegen (Tage). */
export const RUECKRUF_MAX_TAGE = 120;
/** Die Uhrzeiten zur Wahl (halbstündlich, 8:00–20:00). */
export const RUECKRUF_ZEITEN: readonly string[] = Array.from({ length: 25 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

const ISO_TAG = /^(\d{4})-(\d{2})-(\d{2})$/;
const tagZahl = (iso: string): number | null => {
  const m = ISO_TAG.exec(iso);
  if (!m) return null;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const d = new Date(t);
  // Kein 31.02.: das Datum muss nach dem Umrechnen gleich bleiben.
  if (d.getUTCFullYear() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
  return Math.round(t / 86_400_000);
};

/**
 * Prüft einen eingetragenen Rückruf. `heute` ist der Berliner Kalendertag (JJJJ-MM-TT, vom Server). Leer = kein Rückruf.
 * Liefert den Tag (und die Uhrzeit) oder einen Satz für die Person am Telefon.
 */
export function rueckrufLesen(tagRoh: unknown, zeitRoh: unknown, heute: string): { tag: string | null; zeit: string | null; fehler: string | null } {
  // Kein Abschneiden: „2026-11-16; …“ ist kein Tag (genau JJJJ-MM-TT und HH:MM aus der Liste).
  const tag = String(tagRoh ?? "").trim().slice(0, 40);
  const zeit = String(zeitRoh ?? "").trim().slice(0, 20);
  if (!tag) return { tag: null, zeit: null, fehler: zeit ? "Bitte zuerst den Tag für den Rückruf wählen." : null };
  const t = tagZahl(tag), h = tagZahl(heute);
  if (t === null || h === null) return { tag: null, zeit: null, fehler: "Der Tag für den Rückruf ist ungültig — bitte neu wählen." };
  if (t < h) return { tag: null, zeit: null, fehler: "Der Rückruf liegt in der Vergangenheit — bitte einen Tag ab heute wählen." };
  if (t - h > RUECKRUF_MAX_TAGE) return { tag: null, zeit: null, fehler: `Ein Rückruf geht höchstens ${RUECKRUF_MAX_TAGE} Tage voraus.` };
  if (zeit && !RUECKRUF_ZEITEN.includes(zeit)) return { tag: null, zeit: null, fehler: "Die Uhrzeit für den Rückruf ist ungültig — bitte neu wählen." };
  return { tag, zeit: zeit || null, fehler: null };
}

/** „Rückruf vereinbart: Mo., 16.11.2026, 10:00 Uhr“ — die Zeile für Verlauf und Notiz. Rein. */
export function rueckrufSatz(tag: string, zeit: string | null): string {
  const t = tagZahl(tag);
  if (t === null) return "";
  const d = new Date(t * 86_400_000);
  const wt = ["So.", "Mo.", "Di.", "Mi.", "Do.", "Fr.", "Sa."][d.getUTCDay()];
  const datum = `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}.${d.getUTCFullYear()}`;
  return `Rückruf vereinbart: ${wt}, ${datum}${zeit ? `, ${zeit} Uhr` : " (ohne feste Uhrzeit)"}`;
}

/** Die Tage zur Wahl ab heute (Sonntage ausgelassen) — `heute` ist der Berliner Kalendertag. Rein. */
export function rueckrufTage(heute: string, anzahl = 12): string[] {
  const h = tagZahl(heute);
  if (h === null) return [];
  const aus: string[] = [];
  for (let i = 0; aus.length < anzahl && i < 31; i++) {
    const d = new Date((h + i) * 86_400_000);
    if (d.getUTCDay() === 0) continue;
    aus.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`);
  }
  return aus;
}
