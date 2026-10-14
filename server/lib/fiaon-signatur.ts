// ═══════════════════════════════════════════════════════════════════════════
// DIE SIGNATUR AN JEDER VERTRIEBSMAIL (12.10.2026, E-337)
//
// Justin: „Entwickle für Mara eine sehr seriöse Signatur, die wir an JEDER Email anhängen (vielleicht mit
// Animationen, GIFs) — und mach Mara ein Profilbild, eine freundliche Dame Mitte 30.“
//
// Eine Karte, zwei Personen: Mara (erfundene, KI-erzeugte Assistentin — sie heißt deshalb sichtbar „Digitale
// Assistentin“, KI-VO Art. 50) und Justin (echtes Website-Porträt /portraits/justin.jpg, E-309). Bilder liegen
// unter client/public/mail/signatur/ (Porträt rund mit Glasblau-Ring, Lichtlinie und Punkt als GIF auf WEISSEM
// Grund — GIF kennt keine halbe Transparenz). Outlook am Rechner zeigt von einem GIF nur das erste Bild; das ist
// deshalb ein ruhiges, fertiges Bild. Tabellen und Inline-Stile, weil Mailprogramme kein CSS-Layout können.
// Rohquelle Porträt: 08_Medien_Higgsfield/2026-10-12_Mara_Portrait/ (Variante 1, nano_banana_pro).
// ═══════════════════════════════════════════════════════════════════════════
import { FIAON_FIRMA } from "@shared/fiaon-firma";

const SCHRIFT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
const basis = () => (process.env.RADAR_SEITE || "https://fiaon.com").replace(/\/+$/, "");
const esc = (s: unknown) => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export type SignaturPerson = "mara" | "justin";

export interface SignaturDaten {
  person: SignaturPerson;
  /** Name und Rolle, wie sie unter der Mail stehen. */
  name: string;
  rolle: string;
  telefon?: string | null;
  /** Link zum Gespräch (mit UTM der Firma) — erscheint als „Gespräch buchen“. */
  termin?: string | null;
  /** Link auf die Seite (mit UTM). */
  seite?: string | null;
  // ── E-340 (12.10.2026): dieselbe Karte im Kundendienst (welcome@/support@). Alles optional — ohne Angabe bleibt
  //    jede Radar-Karte Byte für Byte, wie sie war (Beleg: Prüfstand gegen die Fassung vor dem Umbau).
  /** Die blaue Zeile unter der Rolle. Vorgabe „FIAON Global“; im Kundendienst das Team des Postfachs. */
  marke?: string | null;
  /** Postfach-Adresse vor dem Seitenlink (als mailto). */
  email?: string | null;
  /** Linktext der Seite. Vorgabe „fiaon.com/business“. */
  seiteText?: string | null;
  /**
   * Die Zeile mit dem Punkt. Vorgabe bei Mara: „Antwortet meist in wenigen Minuten“; null = keine Zeile. Im
   * Kundendienst bewusst ohne: dort lagen in 14 Tagen 111 Entwürfe neben 51 Sofort-Antworten (Messung 12.10.).
   */
  status?: string | null;
  /**
   * Weißer Kartengrund + <font color> an jeder Zeile — für Mails im Hausgerüst, das Gmails Dunkelmodus abfängt
   * (dieselbe Doppelung wie geruest.ts). Der Punkt ist ein GIF auf Weiß; der Grund muss weiß bleiben.
   */
  hell?: boolean;
}

/** Die Signatur für Mara — sichtbar als digitale Assistentin. */
export function maraSignatur(chef: string, extra: Partial<SignaturDaten> = {}): SignaturDaten {
  return { person: "mara", name: "Mara Lindner", rolle: `Digitale Assistentin von ${chef}`, ...extra };
}

export function signaturHtml(s: SignaturDaten): string {
  const b = basis();
  const bild = `${b}/mail/signatur/${s.person === "mara" ? "mara" : "justin"}.png`;
  const seite = s.seite || `${b}/business`;
  const hell = !!s.hell;
  const farbig = (inhalt: string, farbe: string) => (hell ? `<font color="${farbe}" style="color:${farbe};">${inhalt}</font>` : inhalt);
  const zeile = (inhalt: string, farbe = "#4b5565", gewicht = 400) =>
    `<div style="font:${gewicht} 12.5px/1.5 ${SCHRIFT};color:${farbe};">${farbig(inhalt, farbe)}</div>`;
  const status = s.status === undefined ? (s.person === "mara" ? "Antwortet meist in wenigen Minuten" : null) : s.status;
  const email = s.email ? `<a href="mailto:${esc(s.email)}" style="color:#1d4ed8;text-decoration:none;">${esc(s.email)}</a> · ` : "";
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0"${hell ? ` class="fiaon-karte" bgcolor="#ffffff"` : ""} style="margin:6px 0 0;border-collapse:collapse;${hell ? "background-color:#ffffff;" : ""}">
<tr>
<td style="vertical-align:top;padding:2px 16px 0 0;width:64px;"><img src="${esc(bild)}" width="64" height="64" alt="${esc(s.name)}" style="display:block;width:64px;height:64px;border:0;border-radius:32px;"></td>
<td style="vertical-align:top;">
<div style="font:600 15px/1.35 ${SCHRIFT};color:#0b1c36;">${farbig(esc(s.name), "#0b1c36")}</div>
${zeile(esc(s.rolle))}
${zeile(esc(s.marke ?? "FIAON Global"), "#1d4ed8", 500)}
<img src="${esc(`${b}/mail/signatur/linie.gif`)}" width="240" height="2" alt="" style="display:block;width:240px;height:2px;border:0;margin:9px 0 8px;">
${status ? zeile(`<img src="${esc(`${b}/mail/signatur/punkt.gif`)}" width="10" height="10" alt="" style="width:10px;height:10px;border:0;vertical-align:-1px;margin-right:7px;">${esc(status)}`, "#12284a") : ""}
${zeile(`${s.telefon ? `${esc(s.telefon)} · ` : ""}${email}<a href="${esc(seite)}" style="color:#1d4ed8;text-decoration:none;">${esc(s.seiteText ?? "fiaon.com/business")}</a>${s.termin ? ` · <a href="${esc(s.termin)}" style="color:#1d4ed8;text-decoration:underline;">Gespräch buchen</a>` : ""}`)}
</td>
</tr>
</table>`;
}

/**
 * Maras Karte im Kundendienst (E-340, 12.10.2026): Postmeister-Antworten und Mara-Aktion aus welcome@/support@.
 * Privatkunden sehen das Team ihres Postfachs und fiaon.com — nie „FIAON Global“ oder /business (E-272). Die
 * Rolle bleibt sichtbar „Digitale Assistentin“ (KI-VO Art. 50), in der Sprache der Mail.
 */
export function maraKundendienst(ein: { name: string; rolle: string; team?: string | null; email?: string | null }): SignaturDaten {
  return {
    person: "mara", name: ein.name, rolle: ein.rolle, marke: ein.team || "FIAON",
    email: ein.email ?? null, seite: "https://fiaon.com", seiteText: "fiaon.com", status: null, hell: true,
  };
}

export function signaturText(s: SignaturDaten): string {
  return [s.name, s.rolle, "FIAON Global", [s.telefon, s.seite || `${basis()}/business`].filter(Boolean).join(" · ")].join("\n");
}

/** Der kleine Fuß: Abmeldesatz und Pflichtangaben. */
export function fussText(): string {
  return `Kein Thema für Sie? Eine kurze Antwort genügt, dann melde ich mich nicht wieder.\n${FIAON_FIRMA.name} · ${FIAON_FIRMA.strasse}, ${FIAON_FIRMA.ortZeile}, ${FIAON_FIRMA.land} · ${FIAON_FIRMA.register} Nr. ${FIAON_FIRMA.companyNo} · Director: ${FIAON_FIRMA.director}`;
}

/**
 * Macht aus einer Textmail (Absätze, „Viele Grüße“, Unterschrift, „—“ und Fuß) eine persönliche HTML-Mail mit der
 * Signaturkarte. So bleibt der Text im Chefbüro frei änderbar, und die Karte kommt trotzdem immer mit.
 */
export function htmlAusText(text: string, s: SignaturDaten, sprache: "de" | "en" = "de"): string {
  // E-361 (14.10.2026): Mara antwortet in der Sprache der Firma — englisch mit „Best regards“, „Choose a time“ und lang="en".
  const en = sprache === "en";
  const roh = String(text ?? "").replace(/\r/g, "");
  const [hauptRoh, ...fussTeile] = roh.split(/\n—\n/);
  const zeilen = hauptRoh.split("\n");
  const grussIdx = zeilen.findIndex((z) => /^(viele|beste|freundliche|herzliche)\s+grü(ß|ss)e\b/i.test(z.trim()) || (en && /^(best|kind|warm) regards\b|^best wishes\b/i.test(z.trim())));
  const rumpf = (grussIdx >= 0 ? zeilen.slice(0, grussIdx) : zeilen).join("\n").trim();
  const gruss = grussIdx >= 0 ? zeilen[grussIdx].trim() : (en ? "Best regards" : "Viele Grüße");
  const verlinken = (t: string) => esc(t).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:#1d4ed8;text-decoration:underline;">${/utm_|#gespraech/.test(u) ? (en ? "Choose a time" : "Einen Termin wählen") : u}</a>`);
  const absaetze = rumpf.split(/\n\s*\n/).map((a) => a.trim()).filter(Boolean)
    .map((a) => `<p style="margin:0 0 14px;">${verlinken(a).replace(/\n/g, "<br>")}</p>`).join("\n");
  const fuss = fussTeile.join("\n—\n").trim();
  return `<!DOCTYPE html><html lang="${en ? "en" : "de"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="max-width:600px;padding:8px 4px;font-family:${SCHRIFT};font-size:15px;line-height:1.6;color:#1b2333">
${absaetze}
<p style="margin:0 0 4px;">${esc(gruss)}</p>
${signaturHtml(s)}
${fuss ? `<p style="margin:22px 0 0;padding-top:12px;border-top:1px solid #e5e8ee;font-size:11.5px;line-height:1.5;color:#7a8394">${esc(fuss).replace(/\n/g, "<br>")}</p>` : ""}
</div></body></html>`;
}
