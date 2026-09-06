// ═══════════════════════════════════════════════════════════════════════════
// DER MAIL-MOTOR (28.08.2026)
//
// Rendert die Quelltext-Vorlagen (vorlagen/*.ts) mit einer Ereignis-Nutzlast
// und versendet direkt über Brevo — OHNE Make-Umweg und ohne Brevo-Vorlagen.
//
// ── DIE EINE TÜR BLEIBT DIE EINE TÜR ──────────────────────────────────────
// Kein Aufrufer ruft den Motor direkt. Alles läuft weiter durch
// sendMakeWebhookMitGrund (make-webhook.ts); NUR DORT entscheidet der
// Schalter `mail_versandweg` (fiaon_settings), was hinter der Tür passiert:
//   make    → wie bisher: Webhook an Make, Make rendert die Brevo-Vorlage
//   direkt  → dieser Motor: rendern + Brevo /smtp/email mit fertigem HTML
// So bleiben alle 72 Aufrufstellen unangetastet, jede Mail steht im
// Protokoll, und der Schalter geht jederzeit in beide Richtungen.
//
// ── WARUM KEINE BREVO-VORLAGEN MEHR ───────────────────────────────────────
// Der Motor schickt das fertige HTML mit. Damit gibt es genau EINEN Ort, an
// dem eine Mail entsteht (dieses Verzeichnis), und die Vorschau im Portal
// zeigt garantiert dasselbe, was der Kunde bekommt — es IST dieselbe Funktion.
//
// ── FEHLENDE PLATZHALTER SIND LAUT ────────────────────────────────────────
// Ein {{params.x}}, das die Nutzlast nicht mitbringt, wird leer ersetzt UND
// im Ergebnis gemeldet. Beim Prüfversand sieht man es sofort; im Betrieb
// steht es im Protokoll-Grund. Vorher hätte Make kommentarlos „{{vorname}}"
// in die Mail gedruckt.
// ═══════════════════════════════════════════════════════════════════════════
import { BANK } from "@shared/fiaon-bank";
import {
  ABSENDER, mailHtml, mailText, ratenLeisteEinsetzen,
  type AbsenderRolle, type MailBaustein,
} from "./geruest";
import { KONTO_VORLAGEN } from "./vorlagen/konto";
import { ZAHLUNG_VORLAGEN } from "./vorlagen/zahlung";
import { TERMIN_VORLAGEN } from "./vorlagen/termin";
import { AUSKUNFT_LEAD_VORLAGEN } from "./vorlagen/auskunft-lead";
import { TEAM_VORLAGEN } from "./vorlagen/team";
import { RUECKHOLUNG_VORLAGEN } from "./vorlagen/rueckholung";
import { APP_VORLAGEN } from "./vorlagen/app";

/** Alle Vorlagen, ein Verzeichnis. Schlüssel = Ereignisname. */
export const VORLAGEN: Record<string, MailBaustein> = {
  ...KONTO_VORLAGEN,
  ...ZAHLUNG_VORLAGEN,
  ...TERMIN_VORLAGEN,
  ...AUSKUNFT_LEAD_VORLAGEN,
  ...TEAM_VORLAGEN,
  ...RUECKHOLUNG_VORLAGEN,
  ...APP_VORLAGEN,
};

/** Wer als Absender im Postfach steht — je Ereignis. Alles nicht Genannte: welcome. */
const ROLLE_JE_EVENT: Record<string, AbsenderRolle> = {
  payment_details: "accounting",
  payment_reminder: "accounting",
  abo_payment_reminder: "accounting",
  claim_received: "accounting",
  payment_cancelled: "accounting",
  payment_reactivated: "accounting",
  abo_verlaengerung_frage: "accounting",
  sepa_einrichten: "accounting",
  // Rueckholung: S1/S2 sind Zahlungsklaerungen — sie kommen aus der Buchhaltung.
  // S3-S5 sind Wiederaufnahmen des Gespraechs und laufen unter dem Standard.
  rueckhol_s1: "accounting",
  rueckhol_s2: "accounting",
  account_suspended: "legal",
  gdpr_deleted: "legal",
  agent_invite: "team",
  agent_password_reset: "team",
  agent_payment_reminder: "team",
  agent_payout_done: "team",
  agent_payout_rejected: "team",
  agent_bank_reminder: "team",
  agent_callback_reminder: "team",
  agent_feedback_rewarded: "team",
  agent_feedback_reply: "team",
  aufgabe_zugewiesen: "team",
  contract_signed: "team",
  commission_statement_issued: "team",
};

export function absenderFuer(event: string): { name: string; email: string } {
  return ABSENDER[ROLLE_JE_EVENT[event] ?? "welcome"];
}

export function hatVorlage(event: string): boolean {
  return !!VORLAGEN[event];
}

/**
 * Die Hausbank — der Fallback für Zahlungsmails (Justins Auftrag 28.08.:
 * „Wenn wir den Kunden an die erste Rechnung, Abo, Schufa-Rechnung erinnern,
 * dann bitte in der E-Mail unsere Bankdaten einfügen.")
 *
 * Quelle der Wahrheit bleibt FIAON_BANK_DETAILS (fiaon-antrag.ts/fiaon-invoice.ts);
 * die Werte hier sind dieselben. Bringt eine Nutzlast eigene Werte mit
 * (z. B. die Abo-Erinnerung), gewinnen die — der Fallback springt nur ein,
 * wenn das Feld fehlt.
 */
const BANK_FALLBACK: Record<string, string> = {
  empfaenger: BANK.empfaenger,
  // 02.09.2026: Wise gesperrt → Airwallex/Banking Circle. Quelle: shared/fiaon-bank.ts
  iban: BANK.ibanDisplay,
  bic: BANK.bic,
};

// Der Vorrang wird alle 60 Sekunden nachgelesen — dieselbe Bauweise wie der
// Versandweg-Schalter, damit eine Umstellung ohne Auslieferung wirkt.
let sofortVorrang = false;
let sofortVorrangBis = 0;
export async function zahlwegVorrangLesen(): Promise<boolean> {
  if (Date.now() < sofortVorrangBis) return sofortVorrang;
  try {
    const { sqlPool } = await import("../lib/db-pool");
    const [r] = (await sqlPool`SELECT value FROM fiaon_settings WHERE key = 'zahlweg_sofort_vorrang' LIMIT 1`) as any[];
    sofortVorrang = String(r?.value ?? "").trim() === "1";
  } catch {
    sofortVorrang = false; // Im Zweifel der sichere Weg: Überweisung zuerst.
  }
  sofortVorrangBis = Date.now() + 60_000;
  return sofortVorrang;
}

/** {{params.x}} durch Werte ersetzen; fehlende Schlüssel einsammeln. */
function fuellen(text: string, payload: Record<string, unknown>, fehlend: Set<string>): string {
  return text.replace(/\{\{params\.([a-z_0-9]+)\}\}/gi, (_, k: string) => {
    const wert = (payload as any)[k] ?? BANK_FALLBACK[k];
    if (wert === undefined || wert === null || String(wert).trim() === "") {
      fehlend.add(k);
      return "";
    }
    // Beträge kommen aus der Datenbank als "59.99" — im Brief steht "59,99".
    // Nur reine Zahlwerte in Betragsfeldern; alles andere bleibt unangetastet.
    if (/betrag/.test(k) && /^\d+(\.\d{1,2})?$/.test(String(wert).trim())) {
      return String(wert).trim().replace(".", ",");
    }
    return String(wert);
  });
}

export interface GerenderteMail {
  betreff: string;
  html: string;
  text: string;
  absender: { name: string; email: string };
  /** Platzhalter, die die Nutzlast nicht mitbrachte. */
  fehlend: string[];
}

/**
 * Die Lead-Strecke fährt 11 Textvarianten mit eigenem Betreff in der Nutzlast
 * mit (shared/fiaon-lead-strecke.ts). Die Varianten sind Absicht — sie halten
 * die Strecke bei 2 Mails am Tag aus dem Spam-Raster. Bringt die Nutzlast
 * `text` und `betreff` mit, baut der Motor den Baustein daraus und behält vom
 * statischen `lead_followup`-Baustein nur Knopf, Ziel-Block und Abmeldung.
 */
function leadStreckenBaustein(payload: Record<string, unknown>): MailBaustein | null {
  const text = String((payload as any).text ?? "").trim();
  const betreff = String((payload as any).betreff ?? "").trim();
  if (!text || !betreff) return null;
  const basis = VORLAGEN.lead_followup;
  const absaetze = text.split(/\n\n+/)
    .map((a) => a.trim())
    // Knopf, Gruß und Abmeldezeile setzt das Gerüst selbst — die Rohtext-
    // Fassungen davon fliegen raus, sonst stünde alles doppelt in der Mail.
    .filter((a) => a && !/^Zum Antrag:/i.test(a) && !/^Viele Grüße/i.test(a)
      && !/^─/.test(a) && !/keine Nachrichten mehr/i.test(a))
    .map((a) => a.replace(/\n/g, "<br />"));
  return { ...basis, betreff, preheader: basis.preheader, titel: absaetze.shift() ?? basis.titel, absaetze };
}

/** Rendert eine Vorlage mit einer Nutzlast — Vorschau und Versand nutzen DIESELBE Funktion. */
export function mailRendern(event: string, payload: Record<string, unknown>): GerenderteMail | null {
  let vorlage = VORLAGEN[event];
  if (!vorlage) return null;
  if (event === "lead_followup") vorlage = leadStreckenBaustein(payload) ?? vorlage;

  // Ein Knopf, dessen Adresse die Nutzlast nicht füllt (z. B. {{params.sofort_url}},
  // solange die Sofortzahlung nicht eingerichtet ist), wird weggelassen — ein
  // Knopf ohne Ziel ist schlimmer als kein Knopf. Der Ersatz: knopf2 rückt auf.
  const knopfLeer = (k?: { url: string }) => {
    const m = k?.url.match(/\{\{params\.([a-z_0-9]+)\}\}/i);
    return !!(m && String((payload as any)[m[1]] ?? "").trim() === "" && BANK_FALLBACK[m[1]] === undefined);
  };
  // Dasselbe für das Bild: Eine QR-Adresse mit ungefülltem Platzhalter wird
  // zu …/zahlung//qr.png — ein kaputter Kasten mit der Unterschrift „scannen
  // Sie hier“. Lieber kein Bild als ein totes (Prüfung 02.09.2026).
  {
    const m = vorlage.bild?.url.match(/\{\{params\.([a-z_0-9]+)\}\}/i);
    if (m && String((payload as any)[m[1]] ?? "").trim() === "" && BANK_FALLBACK[m[1]] === undefined) {
      vorlage = { ...vorlage, bild: undefined };
    }
  }
  // ══════════════════════════════════════════════════════════════════════
  // WELCHER ZAHLWEG ZUERST STEHT — eine Einstellung, kein Umschreiben
  //
  // BEFUND 02.09.2026: GoCardless zahlt an EIN hinterlegtes Konto aus, und
  // das ist die gesperrte Wise-IBAN (endet 57), Rhythmus monatlich, Währung
  // GBP. Eine Sofortzahlung per Bank-App verlässt das Kundenkonto in
  // Sekunden, liegt danach aber bei GoCardless bis zum 1. des Monats — und
  // ginge dann ins Leere. Der QR-/Überweisungsweg geht direkt auf das
  // Banking-Circle-Konto und ist an einem Bankarbeitstag da.
  //
  // Deshalb steht bis auf Weiteres die ÜBERWEISUNG vorn: knopf und knopf2
  // werden getauscht, wenn `zahlweg_sofort_vorrang` nicht auf 1 steht.
  // Sobald Justin bei GoCardless das Auszahlungskonto auf Banking Circle
  // umgestellt und den Rhythmus auf täglich gesetzt hat, macht die Zahl 1
  // die Sofortzahlung wieder zum Hauptweg — ohne eine einzige Vorlage
  // anzufassen.
  // ══════════════════════════════════════════════════════════════════════
  const sofortIst = (k?: { url: string }) => !!k?.url.includes("params.sofort_url");
  if (!sofortVorrang && sofortIst(vorlage.knopf) && vorlage.knopf2 && !knopfLeer(vorlage.knopf2)) {
    vorlage = { ...vorlage, knopf: vorlage.knopf2, knopf2: vorlage.knopf };
  }
  if (knopfLeer(vorlage.knopf) || knopfLeer(vorlage.knopf2)) {
    vorlage = { ...vorlage };
    if (knopfLeer(vorlage.knopf)) { vorlage.knopf = knopfLeer(vorlage.knopf2) ? undefined : vorlage.knopf2; vorlage.knopf2 = undefined; }
    else if (knopfLeer(vorlage.knopf2)) vorlage.knopf2 = undefined;
  }

  const fehlend = new Set<string>();
  const html = ratenLeisteEinsetzen(fuellen(mailHtml(vorlage), payload, fehlend));
  const text = fuellen(mailText(vorlage), payload, fehlend).replace(/%%RATENLEISTE[^%]*%%/g, "");
  const betreff = fuellen(vorlage.betreff, payload, fehlend);
  return { betreff, html, text, absender: absenderFuer(event), fehlend: Array.from(fehlend).sort() };
}

/**
 * Freitext im FIAON-Gerüst (Justins Auftrag 28.08.: „Baue etwas ein, damit
 * die Mitarbeiter eine Freitext-Mail perfekt in unserem CI senden können.")
 *
 * Der Mitarbeiter liefert Betreff und Text; das Gerüst liefert Kopf, Fuß,
 * Pflichtangaben und Absender. Absätze trennt eine Leerzeile. HTML im Text
 * wird entschärft — eine Freitext-Mail ist eine Nachricht, kein Baukasten.
 */
export function freitextBaustein(ein: { betreff: string; text: string; anrede?: string | null }): MailBaustein {
  const sicher = (s: string) => s
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const absaetze = ein.text.split(/\n\n+/)
    .map((a) => sicher(a.trim()).replace(/\n/g, "<br />"))
    .filter(Boolean);
  if (ein.anrede) absaetze.unshift(sicher(ein.anrede));
  return {
    persoenlich: true,
    betreff: sicher(ein.betreff),
    preheader: absaetze[0] ? absaetze[0].replace(/<br \/>/g, " ").slice(0, 90) : "Eine Nachricht von Ihrem Ansprechpartner.",
    titel: sicher(ein.betreff),
    absaetze,
  };
}

/** Freitext rendern — für die Vorschau in der Akte. */
export function freitextRendern(ein: { betreff: string; text: string; anrede?: string | null }): GerenderteMail {
  const b = freitextBaustein(ein);
  return {
    betreff: b.betreff,
    html: mailHtml(b),
    text: mailText(b),
    absender: ABSENDER.welcome,
    fehlend: [],
  };
}

/** Freitext direkt über Brevo senden. */
export async function freitextSenden(ein: {
  an: string; betreff: string; text: string; anrede?: string | null;
}): Promise<{ ok: boolean; messageId: string | null; grund?: string }> {
  if (!adresseSiehtGueltigAus(String(ein.an || "").trim())) {
    return { ok: false, messageId: null, grund: `Empfängeradresse ungültig: „${ein.an}“ — bitte in der Akte korrigieren.` };
  }
  const mail = freitextRendern(ein);
  const key = process.env.BREVO_API_KEY;
  if (!key) return { ok: false, messageId: null, grund: "BREVO_API_KEY ist nicht gesetzt." };
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: mail.absender, replyTo: mail.absender,
        to: [{ email: ein.an }],
        subject: mail.betreff, htmlContent: mail.html, textContent: mail.text,
        tags: ["frei_text"],
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, messageId: null, grund: `Brevo hat abgelehnt (HTTP ${res.status}): ${t.slice(0, 200)}` };
    }
    const d = (await res.json().catch(() => ({}))) as { messageId?: string };
    return { ok: true, messageId: d.messageId ?? null };
  } catch (err) {
    return { ok: false, messageId: null, grund: `Brevo nicht erreichbar: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/**
 * Direktversand über Brevo. Gibt die messageId zurück — damit weiß das
 * Protokoll erstmals bei JEDER Mail, dass Brevo sie angenommen hat.
 */
/**
 * Sieht die Adresse nach einer E-Mail-Adresse aus? (29./30.08.2026)
 *
 * Brevo lehnte „bgutaj@t-online.de@" und „…@gmail.com5p" mit HTTP 400 ab —
 * zu Recht, aber als kryptische KRITISCH-Diagnose. GEMESSEN: 11 solcher
 * Adressen im Bestand (Leerzeichen, doppeltes @, Müll-Suffixe), alle aus
 * Handeingaben. Der Motor sagt es jetzt VOR dem Versand in Klartext — und
 * der Protokoll-Grund nennt die Tat: Adresse in der Akte korrigieren.
 */
function adresseSiehtGueltigAus(an: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[A-Za-z]{2,}$/.test(an);
}

export async function mailDirektSenden(
  event: string,
  payload: Record<string, unknown>,
): Promise<{ ok: boolean; messageId: string | null; grund?: string }> {
  // Den Vorrang der Zahlwege vor dem Rendern nachlesen (60-Sekunden-Puffer).
  // `mailRendern` ist synchron und nimmt den gepufferten Wert; der Anfangswert
  // ist der sichere: Überweisung zuerst.
  await zahlwegVorrangLesen().catch(() => {});
  const an = String((payload as any).email ?? "").trim();
  if (!an) return { ok: false, messageId: null, grund: "Keine Empfängeradresse in der Nutzlast." };
  if (!adresseSiehtGueltigAus(an)) {
    return { ok: false, messageId: null, grund: `Empfängeradresse ungültig: „${an}“ — bitte in der Akte korrigieren, vorher kommt dort keine Mail an.` };
  }
  const mail = mailRendern(event, payload);
  if (!mail) return { ok: false, messageId: null, grund: `Keine Vorlage für '${event}' im Motor.` };

  const key = process.env.BREVO_API_KEY;
  if (!key) return { ok: false, messageId: null, grund: "BREVO_API_KEY ist nicht gesetzt." };
  try {
    const res = await fetch("https://api.brevo.com/v3/smtp/email", {
      method: "POST",
      headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        sender: mail.absender,
        replyTo: mail.absender,
        to: [{ email: an }],
        subject: mail.betreff,
        htmlContent: mail.html,
        textContent: mail.text,
        // Für Auswertungen in Brevo: welche Mail welches Ereignis war.
        tags: [event],
        // One-Click-Abmeldung (RFC 8058): Trägt die Nutzlast einen Abmeldelink,
        // bekommt der Postfach-Anbieter die Kopfzeilen, um den Abmeldeknopf
        // oben zu zeigen — sonst klicken Menschen „Spam“, und das trifft die
        // Domain für alle Mails des Hauses (Prüfung 02.09.2026).
        ...(String((payload as any)?.abmelde_url || "") ? { headers: {
          "List-Unsubscribe": `<${String((payload as any).abmelde_url)}>, <mailto:${mail.absender.email}?subject=Stopp>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        } } : {}),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const t = await res.text().catch(() => "");
      return { ok: false, messageId: null, grund: `Brevo hat abgelehnt (HTTP ${res.status}): ${t.slice(0, 200)}` };
    }
    const d = (await res.json().catch(() => ({}))) as { messageId?: string };
    const fehltHinweis = mail.fehlend.length ? ` (Platzhalter ohne Wert: ${mail.fehlend.join(", ")})` : "";
    return { ok: true, messageId: d.messageId ?? null, grund: fehltHinweis || undefined };
  } catch (err) {
    return { ok: false, messageId: null, grund: `Brevo nicht erreichbar: ${err instanceof Error ? err.message : String(err)}` };
  }
}
