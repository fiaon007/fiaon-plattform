// ═══════════════════════════════════════════════════════════════════════════
// BREVO — die einzige Stelle, an der wir Zustellung ERFAHREN können
//
// WARUM DAS NÖTIG IST
// Bisher endete unser Wissen bei „Make hat die Anfrage angenommen". Das ist
// keine Zustellung. Zwischen Make und dem Postfach des Kunden liegen zwei
// Stationen, an denen alles scheitern kann: der Zweig im Make-Szenario (fehlt
// er, verpufft die Anfrage lautlos mit HTTP 200) und die Vorlage in Brevo
// (ist sie inaktiv, wird nichts gerendert). Beide Fehler sehen von unserer
// Seite identisch aus — und genau deshalb darf man sie nicht raten.
//
// Brevo weiß es. Die Transactional-Events-API sagt für jede Adresse, ob eine
// Mail angenommen, zugestellt, geöffnet, gebounct oder blockiert wurde. Diese
// Datei holt diese Wahrheit ab.
//
// OHNE SCHLÜSSEL KEIN CRASH
// `BREVO_API_KEY` ist heute nirgends gesetzt. Jede Funktion hier gibt dann
// einen sauberen Zustand zurück, den die Oberfläche anzeigen kann — kein
// Fehler, kein leerer Bildschirm.
// ═══════════════════════════════════════════════════════════════════════════

import { brevoKlartext, brevoNichtEingerichtet, type BrevoKlartext } from "./fiaon-brevo-fehler";

const BASIS = "https://api.brevo.com/v3";

export function brevoKonfiguriert(): boolean {
  return !!process.env.BREVO_API_KEY;
}

/** Der Hinweis, den die Oberfläche zeigt, solange der Schlüssel fehlt. */
export const OHNE_SCHLUESSEL =
  "Zustellprüfung braucht den Brevo-API-Schlüssel. Lege ihn als BREVO_API_KEY in den "
  + "Umgebungsvariablen ab (Brevo → SMTP & API → API Keys), dann kann die Plattform bei "
  + "Brevo nachsehen, ob eine Mail wirklich angekommen ist.";

/**
 * DIE EINE STELLE, durch die jeder Brevo-Aufruf geht.
 *
 * Sie liefert neben `grund` (ein Satz für Protokolle) jetzt auch `klartext` —
 * Titel, Anleitung und die rohe Antwort. Der Vorgesetzte sah bis zum 11.08.2026
 * in der Mail-Zentrale die nackte API-Antwort („Unrecognised IP address …
 * unauthorized"). Das ist kein Programmfehler, sondern eine EINSTELLUNG mit
 * bekannter Lösung — also gehört die Lösung in die Meldung.
 */
async function brevo<T>(pfad: string, init: RequestInit = {}): Promise<
  { ok: true; daten: T } | { ok: false; grund: string; klartext: BrevoKlartext }
> {
  const key = process.env.BREVO_API_KEY;
  if (!key) {
    const k = brevoNichtEingerichtet();
    return { ok: false, grund: OHNE_SCHLUESSEL, klartext: k };
  }
  try {
    const res = await fetch(`${BASIS}${pfad}`, {
      ...init,
      headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json", ...(init.headers || {}) },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const k = brevoKlartext(res.status, text);
      return {
        ok: false,
        // Der Titel ist der Satz, der überall angezeigt werden kann.
        grund: k.titel,
        klartext: k,
      };
    }
    return { ok: true, daten: (await res.json()) as T };
  } catch (err) {
    const k = brevoKlartext(0, err instanceof Error ? err.message : String(err));
    return { ok: false, grund: k.titel, klartext: k };
  }
}

// ───────────────────────────────────────────────────────────────────────────
// Vorlagen
// ───────────────────────────────────────────────────────────────────────────

export interface BrevoVorlage {
  id: number;
  name: string;
  betreff: string;
  aktiv: boolean;
}

export async function vorlagen(): Promise<{ ok: boolean; liste: BrevoVorlage[]; grund?: string }> {
  const r = await brevo<{ templates?: any[] }>("/smtp/templates?limit=200&sort=asc");
  if (!r.ok) return { ok: false, liste: [], grund: r.grund };
  return {
    ok: true,
    liste: (r.daten.templates || []).map((t) => ({
      id: Number(t.id),
      name: String(t.name ?? `Vorlage ${t.id}`),
      betreff: String(t.subject ?? ""),
      // `isActive` ist der Grund, warum eine Mail bei korrektem Make-Zweig
      // trotzdem nie ankommt. Deshalb steht das Feld hier und in der Auswahl.
      aktiv: t.isActive !== false,
    })),
  };
}

/** Das HTML einer Vorlage — für die Live-Vorschau. */
export async function vorlagenHtml(id: number): Promise<{ ok: boolean; html: string; betreff: string; grund?: string }> {
  const r = await brevo<any>(`/smtp/templates/${id}`);
  if (!r.ok) return { ok: false, html: "", betreff: "", grund: r.grund };
  return { ok: true, html: String(r.daten.htmlContent ?? ""), betreff: String(r.daten.subject ?? "") };
}

// ───────────────────────────────────────────────────────────────────────────
// Zustell-Ereignisse
// ───────────────────────────────────────────────────────────────────────────

/**
 * Brevos Ereignisnamen auf unser Vokabular.
 *
 * Die Reihenfolge im Wert ist die Rangfolge: Ein „geöffnet" überschreibt ein
 * „zugestellt", nicht umgekehrt. Sonst hinge der Status davon ab, in welcher
 * Reihenfolge die API antwortet.
 */
const RANG: Record<string, { name: string; rang: number }> = {
  requests: { name: "angenommen", rang: 1 },
  delivered: { name: "zugestellt", rang: 2 },
  opened: { name: "geoeffnet", rang: 3 },
  uniqueOpened: { name: "geoeffnet", rang: 3 },
  clicks: { name: "geklickt", rang: 4 },
  softBounces: { name: "gebounct", rang: 5 },
  hardBounces: { name: "gebounct", rang: 6 },
  blocked: { name: "blockiert", rang: 6 },
  spam: { name: "spam", rang: 6 },
  invalid: { name: "gebounct", rang: 6 },
  deferred: { name: "angenommen", rang: 1 },
  error: { name: "fehler", rang: 6 },
};

export interface ZustellEreignis {
  email: string;
  ereignis: string;
  am: string;
  betreff: string | null;
  grund: string | null;
  messageId: string | null;
}

/**
 * Zustell-Ereignisse für eine Adresse in einem Zeitfenster.
 *
 * @param seit  frühester Zeitpunkt (ISO)
 */
export async function ereignisseFuer(
  email: string, seit: Date,
): Promise<{ ok: boolean; ereignisse: ZustellEreignis[]; grund?: string }> {
  const von = seit.toISOString().slice(0, 10);
  const bis = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
  const r = await brevo<{ events?: any[] }>(
    `/smtp/statistics/events?email=${encodeURIComponent(email)}&startDate=${von}&endDate=${bis}&limit=100&sort=desc`,
  );
  if (!r.ok) return { ok: false, ereignisse: [], grund: r.grund };
  return {
    ok: true,
    ereignisse: (r.daten.events || []).map((e) => ({
      email: String(e.email ?? email),
      ereignis: RANG[String(e.event)]?.name ?? String(e.event),
      am: String(e.date ?? ""),
      betreff: e.subject ? String(e.subject) : null,
      grund: e.reason ? String(e.reason) : null,
      messageId: e["message-id"] ? String(e["message-id"]) : null,
    })),
  };
}

/** Aus mehreren Ereignissen den aussagekräftigsten Zustand wählen. */
export function besterZustand(ereignisse: ZustellEreignis[]): { zustand: string; am: string | null; grund: string | null } | null {
  if (ereignisse.length === 0) return null;
  let beste = ereignisse[0];
  let besterRang = 0;
  for (const e of ereignisse) {
    const rang = Object.values(RANG).find((r) => r.name === e.ereignis)?.rang ?? 0;
    if (rang >= besterRang) { besterRang = rang; beste = e; }
  }
  return { zustand: beste.ereignis, am: beste.am || null, grund: beste.grund };
}

// ───────────────────────────────────────────────────────────────────────────
// Eigener Versand (Freitext aus der Mail-Zentrale)
// ───────────────────────────────────────────────────────────────────────────

export interface EigeneMail {
  an: string;
  name?: string | null;
  betreff: string;
  /** Reiner Text. Der CI-Rahmen kommt aus `rahmen()`. */
  text: string;
  /** Ging diese Mail an mehrere? Dann trägt sie einen Abmelde-Hinweis. */
  gruppe?: boolean;
}

/**
 * Freitext-Mails gehen DIREKT über Brevo, nicht über Make.
 *
 * Make ist ein Verteiler für vorlagengebundene Ereignisse — jede Freitextmail
 * bräuchte dort einen eigenen Zweig, und den gibt es nie. Der direkte Weg
 * liefert außerdem sofort eine `messageId`, mit der der stündliche Abgleich
 * die Zustellung genau dieser Mail nachverfolgen kann.
 */
export async function eigeneMailSenden(
  mail: EigeneMail,
): Promise<{ ok: boolean; messageId: string | null; grund?: string }> {
  const r = await brevo<{ messageId?: string }>("/smtp/email", {
    method: "POST",
    body: JSON.stringify({
      // Absendername ist die MARKE, nicht die Domain — im Posteingang steht
      // dann „FIAON" und nicht „welcome@fiaon.com".
      sender: { name: "FIAON", email: "welcome@fiaon.com" },
      replyTo: { name: "FIAON", email: "welcome@fiaon.com" },
      to: [{ email: mail.an, ...(mail.name ? { name: mail.name } : {}) }],
      subject: mail.betreff,
      htmlContent: rahmen(mail.betreff, mail.text, mail.gruppe === true),
      // Mehrteilig: Wer HTML abgeschaltet hat, sähe sonst eine leere Mail —
      // und jeder Spamfilter bewertet eine Mail ohne Textteil schlechter.
      textContent: rahmenText(mail.text, mail.gruppe === true),
    }),
  });
  if (!r.ok) return { ok: false, messageId: null, grund: r.grund };
  return { ok: true, messageId: r.daten.messageId ?? null };
}

/**
 * Der FIAON-Rahmen um einen Freitext.
 *
 * Bewusst schmal und ohne Bilder: Eine Mail aus der Zentrale ist eine
 * persönliche Nachricht und kein Newsletter. Was sie braucht, ist eine
 * erkennbare Absenderidentität und einen Fuß, der die Pflichtangaben trägt.
 */
/**
 * Der FIAON-Rahmen um einen Freitext.
 *
 * ── ENTITÄTEN-TRENNUNG IST GESCHÄFTSREGEL (11.08.2026) ─────────────────────
 * In der Fußzeile stand „FIAON — Schwarzott Global". In der Kommunikation
 * mit Kunden existiert AUSSCHLIESSLICH FIAON. Wer eine zweite Firma in der
 * Fußzeile liest, fragt sich, mit wem er eigentlich einen Vertrag hat — und
 * genau diese Frage soll nie entstehen.
 *
 * `gruppe` setzt den Abmelde-Hinweis. Bei einer persönlichen Nachricht an
 * eine Person wäre er falsch: Man meldet sich nicht von einem Gespräch ab.
 */
/**
 * Die reine Textfassung derselben Mail.
 *
 * Mehrteilig zu senden ist kein Luxus: Manche Postfächer (und jeder
 * Spamfilter) bewerten eine Mail ohne Textteil schlechter, und wer HTML
 * abgeschaltet hat, sähe sonst eine leere Nachricht.
 */
export function rahmenText(text: string, gruppe = false): string {
  return [
    text.trim(),
    "",
    "—",
    "FIAON",
    "Impressum: https://www.fiaon.com/impressum",
    "Datenschutz: https://www.fiaon.com/datenschutz",
    ...(gruppe
      ? ["", "Diese Mail ging an mehrere Empfänger. Wenn du keine solchen",
         "Nachrichten mehr möchtest, antworte kurz mit „keine Mails“."]
      : []),
  ].join("\n");
}

export function rahmen(betreff: string, text: string, gruppe = false): string {
  const html = text
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .split(/\n{2,}/)
    .map((absatz) => `<p style="margin:0 0 16px;line-height:1.65;">${absatz.replace(/\n/g, "<br>")}</p>`)
    .join("");
  return `<!doctype html><html lang="de"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${betreff.replace(/</g, "&lt;")}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 12px;">
<tr><td align="center">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
         style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;
                box-shadow:0 1px 3px rgba(15,23,42,.06);font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
    <tr><td style="padding:28px 32px 0;">
      <div style="font-size:19px;font-weight:800;letter-spacing:-.02em;color:#1d4ed8;">FIAON</div>
      <div style="height:1px;background:linear-gradient(90deg,rgba(29,78,216,.28),rgba(15,23,42,.06) 40%,transparent);margin:18px 0 24px;"></div>
    </td></tr>
    <tr><td style="padding:0 32px 28px;font-size:15px;color:#0f172a;">${html}</td></tr>
    <tr><td style="padding:20px 32px 28px;border-top:1px solid #e2e8f0;font-size:11.5px;color:#64748b;line-height:1.6;">
      <strong style="color:#475569;">FIAON</strong><br>
      Diese Nachricht wurde persönlich an dich geschickt.<br>
      <a href="https://www.fiaon.com/impressum" style="color:#64748b;">Impressum</a> ·
      <a href="https://www.fiaon.com/datenschutz" style="color:#64748b;">Datenschutz</a>${
        gruppe ? `<br><span style="color:#94a3b8;">Diese Mail ging an mehrere Empfänger. `
          + `Wenn du keine solchen Nachrichten mehr möchtest, antworte kurz mit „keine Mails“.</span>` : ""}
    </td></tr>
  </table>
</td></tr></table></body></html>`;
}
