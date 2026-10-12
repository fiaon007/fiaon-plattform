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
}

/** Die Signatur für Mara — sichtbar als digitale Assistentin. */
export function maraSignatur(chef: string, extra: Partial<SignaturDaten> = {}): SignaturDaten {
  return { person: "mara", name: "Mara Lindner", rolle: `Digitale Assistentin von ${chef}`, ...extra };
}

export function signaturHtml(s: SignaturDaten): string {
  const b = basis();
  const bild = `${b}/mail/signatur/${s.person === "mara" ? "mara" : "justin"}.png`;
  const seite = s.seite || `${b}/business`;
  const zeile = (inhalt: string, farbe = "#4b5565", gewicht = 400) =>
    `<div style="font:${gewicht} 12.5px/1.5 ${SCHRIFT};color:${farbe};">${inhalt}</div>`;
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 0;border-collapse:collapse;">
<tr>
<td style="vertical-align:top;padding:2px 16px 0 0;width:64px;"><img src="${esc(bild)}" width="64" height="64" alt="${esc(s.name)}" style="display:block;width:64px;height:64px;border:0;border-radius:32px;"></td>
<td style="vertical-align:top;">
<div style="font:600 15px/1.35 ${SCHRIFT};color:#0b1c36;">${esc(s.name)}</div>
${zeile(esc(s.rolle))}
${zeile("FIAON Global", "#1d4ed8", 500)}
<img src="${esc(`${b}/mail/signatur/linie.gif`)}" width="240" height="2" alt="" style="display:block;width:240px;height:2px;border:0;margin:9px 0 8px;">
${s.person === "mara" ? zeile(`<img src="${esc(`${b}/mail/signatur/punkt.gif`)}" width="10" height="10" alt="" style="width:10px;height:10px;border:0;vertical-align:-1px;margin-right:7px;">Antwortet meist in wenigen Minuten`, "#12284a") : ""}
${zeile(`${s.telefon ? `${esc(s.telefon)} · ` : ""}<a href="${esc(seite)}" style="color:#1d4ed8;text-decoration:none;">fiaon.com/business</a>${s.termin ? ` · <a href="${esc(s.termin)}" style="color:#1d4ed8;text-decoration:underline;">Gespräch buchen</a>` : ""}`)}
</td>
</tr>
</table>`;
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
export function htmlAusText(text: string, s: SignaturDaten): string {
  const roh = String(text ?? "").replace(/\r/g, "");
  const [hauptRoh, ...fussTeile] = roh.split(/\n—\n/);
  const zeilen = hauptRoh.split("\n");
  const grussIdx = zeilen.findIndex((z) => /^(viele|beste|freundliche|herzliche)\s+grü(ß|ss)e\b/i.test(z.trim()));
  const rumpf = (grussIdx >= 0 ? zeilen.slice(0, grussIdx) : zeilen).join("\n").trim();
  const gruss = grussIdx >= 0 ? zeilen[grussIdx].trim() : "Viele Grüße";
  const verlinken = (t: string) => esc(t).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:#1d4ed8;text-decoration:underline;">${/utm_|#gespraech/.test(u) ? "Einen Termin wählen" : u}</a>`);
  const absaetze = rumpf.split(/\n\s*\n/).map((a) => a.trim()).filter(Boolean)
    .map((a) => `<p style="margin:0 0 14px;">${verlinken(a).replace(/\n/g, "<br>")}</p>`).join("\n");
  const fuss = fussTeile.join("\n—\n").trim();
  return `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff">
<div style="max-width:600px;padding:8px 4px;font-family:${SCHRIFT};font-size:15px;line-height:1.6;color:#1b2333">
${absaetze}
<p style="margin:0 0 4px;">${esc(gruss)}</p>
${signaturHtml(s)}
${fuss ? `<p style="margin:22px 0 0;padding-top:12px;border-top:1px solid #e5e8ee;font-size:11.5px;line-height:1.5;color:#7a8394">${esc(fuss).replace(/\n/g, "<br>")}</p>` : ""}
</div></body></html>`;
}
