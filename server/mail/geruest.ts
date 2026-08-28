// ═══════════════════════════════════════════════════════════════════════════
// DAS EINE MAIL-GERÜST (28.08.2026, v2)
//
// Justin: „ALLE Templates, für JEDES Event — perfekt abgestimmt, es muss eine
// Harmonie und BRUTAL hochwertige und konvertierende Emails werden." Und zur
// Karte: „nicht als Versprechen, sondern als Ziel."
//
// ── WARUM DIE VORLAGEN AUS DEM QUELLTEXT KOMMEN ───────────────────────────
// Vorher wurde jede Vorlage in der Brevo-Oberfläche von Hand gebaut. Bei 41
// Vorlagen heißt das 41 Gelegenheiten, eine andere Schriftgröße oder einen
// anderen Blauton zu erwischen — und keine Möglichkeit zu sehen, WAS sich
// wann geändert hat. Jetzt entsteht jede Vorlage aus DIESEM Gerüst plus einem
// kurzen Textteil (server/mail/vorlagen/). Eine Änderung hier wirkt auf alle.
//
// ── DIE REGELN FÜR E-MAIL-HTML (nicht verhandelbar) ───────────────────────
// · Tabellen-Layout. Kein Flexbox, kein Grid — Outlook kennt beides nicht.
// · Alles inline gesetzt. Gmail entfernt <style>-Blöcke im Kopf.
// · Höchstens 600 px breit; darunter fließend für das Telefon.
// · Web-sichere Schrift mit echtem Rückfall — Inter lädt in Mail nicht zuverlässig.
// · Preheader gesetzt, sonst zeigt das Postfach „Bilder werden nicht …".
// · Eine Handlung je Mail. Zwei Knöpfe heißen: keiner wird gedrückt.
// · Jede Mail hat einen TEXT-Teil — eine Mail ohne ihn bewertet jeder
//   Spamfilter schlechter, und wer HTML abschaltet, sähe nichts.
//
// ── DER KARTEN-ZIEL-BLOCK ─────────────────────────────────────────────────
// Kunden kommen mit der Haltung „Ahhh, Kreditkarte!". Der Block hält dieses
// Ziel sichtbar — als ZIEL, nie als Zusage. Der eine erlaubte Satz dazu ist
// KARTE_SATZ unten; kein Vorlagentext formuliert ihn selbst um. So kann kein
// einzelner Baustein aus Versehen ein Versprechen daraus machen.
// ═══════════════════════════════════════════════════════════════════════════

/** Wer im Postfach als Absender steht. Alle senden über welcome@fiaon.com. */
export type AbsenderRolle = "welcome" | "accounting" | "legal" | "team";

export const ABSENDER: Record<AbsenderRolle, { name: string; email: string }> = {
  welcome: { name: "FIAON Welcome", email: "welcome@fiaon.com" },
  accounting: { name: "FIAON Accounting", email: "welcome@fiaon.com" },
  legal: { name: "FIAON Legal", email: "welcome@fiaon.com" },
  team: { name: "FIAON Team", email: "welcome@fiaon.com" },
};

/** Der EINE erlaubte Karten-Satz. Compliance: Ziel, nie Zusage. */
export const KARTE_SATZ =
  "Ihr Ziel bleibt die eigene Karte: Wir bereiten Ihre Bonität Schritt für Schritt vor — "
  + "die Entscheidung über eine Karte trifft am Ende immer die Bank.";

export interface MailBaustein {
  /** Betreffzeile. Darf {{params.x}} enthalten. */
  betreff: string;
  /** Die Zeile neben dem Betreff im Postfach (35–90 Zeichen). */
  preheader: string;
  /** Überschrift im Textkörper. */
  titel: string;
  /** Absätze. Jeder wird als eigener <p> gesetzt. Einfaches <b> ist erlaubt. */
  absaetze: string[];
  /** Der eine Knopf. Fehlt er, ist es eine reine Mitteilung. */
  knopf?: { text: string; url: string };
  /** Optionaler Kasten mit Eckdaten (Beträge, Referenzen, Termine). */
  daten?: { label: string; wert: string }[];
  /** Kleiner Zusatz unter dem Knopf — Hinweis, Frist, Rückversicherung. */
  fussnote?: string;
  /** Großes Kartenbild direkt unter dem Kopf — für die Ankunftsmomente. */
  heroKarte?: boolean;
  /** Der Karten-Ziel-Block vor der Fußzeile (Bild + KARTE_SATZ). */
  karteZiel?: boolean;
  /**
   * Raten-Fortschritt „Rate {nr} von {von}" als Segmentleiste. nr darf ein
   * {{params.x}}-Platzhalter sein — der Motor füllt erst und rendert dann.
   */
  ratenLeiste?: { nr: string; von: number };
  /** Abmelde-Fuß (nur Lead-Strecke): URL oder Platzhalter des Abmeldelinks. */
  abmeldeUrl?: string;
  /** Kleine Marke über dem Titel, z. B. „Erinnerung {{params.reminder_number}}". */
  marke?: string;
  /** Persönliche Nachricht eines Mitarbeiters — die „automatisch erstellt"-Zeile entfällt. */
  persoenlich?: boolean;
}

const NAVY = "#0f2044";
const NAVY_TIEF = "#0a1730";
const BLAU = "#1d4ed8";
const BLAU_HELL = "#3b82f6";
const TEXT = "#1f2937";
const LEISE = "#6b7280";
const LINIE = "#e5e7eb";
const HIMMEL = "#eef4fd";
const SCHRIFT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";

const BASIS_URL = "https://fiaon.com";
const BANNER_BILD = `${BASIS_URL}/mail/fiaon-karte-banner.jpg`;

/** Baut das vollständige HTML einer Vorlage (Platzhalter bleiben drin). */
export function mailHtml(b: MailBaustein): string {
  const absaetze = b.absaetze.map((a) =>
    `<p style="margin:0 0 16px;font:400 16px/1.65 ${SCHRIFT};color:${TEXT};">${a}</p>`).join("\n            ");

  const marke = b.marke
    ? `<div style="display:inline-block;margin:0 0 14px;padding:6px 14px;border-radius:999px;background:${HIMMEL};font:600 12px/1 ${SCHRIFT};letter-spacing:.06em;text-transform:uppercase;color:${BLAU};">${b.marke}</div>` : "";

  const daten = b.daten?.length
    ? `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:8px 0 24px;background:#fafbfe;border:1px solid ${LINIE};border-radius:12px;">
              ${b.daten.map((d, i) => `<tr>
                <td style="padding:13px 18px;font:400 13px/1.4 ${SCHRIFT};color:${LEISE};${i ? `border-top:1px solid ${LINIE};` : ""}">${d.label}</td>
                <td style="padding:13px 18px;font:600 15px/1.4 ${SCHRIFT};color:${TEXT};text-align:right;${i ? `border-top:1px solid ${LINIE};` : ""}">${d.wert}</td>
              </tr>`).join("\n              ")}
            </table>` : "";

  const knopf = b.knopf
    ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 8px;">
              <tr><td style="border-radius:12px;background:${BLAU};background-image:linear-gradient(180deg,${BLAU_HELL},${BLAU});box-shadow:0 4px 14px rgba(29,78,216,.28);">
                <a href="${b.knopf.url}" style="display:inline-block;padding:16px 36px;font:600 16px/1 ${SCHRIFT};color:#ffffff;text-decoration:none;border-radius:12px;">${b.knopf.text}&nbsp;&nbsp;&rarr;</a>
              </td></tr>
            </table>` : "";

  const fussnote = b.fussnote
    ? `<p style="margin:14px 0 0;font:400 13px/1.6 ${SCHRIFT};color:${LEISE};">${b.fussnote}</p>` : "";

  const hero = b.heroKarte
    ? `<tr><td style="background:${NAVY_TIEF};"><img src="${BANNER_BILD}" width="600" alt="Die FIAON Karte" style="display:block;width:100%;max-width:600px;height:auto;" /></td></tr>` : "";

  const leiste = b.ratenLeiste
    ? `%%RATENLEISTE:${b.ratenLeiste.nr}:${b.ratenLeiste.von}%%` : "";

  const ziel = b.karteZiel
    ? `<tr><td style="padding:0 34px 30px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:${NAVY_TIEF};border-radius:14px;overflow:hidden;">
            <tr>
              <td width="150" style="padding:0;vertical-align:middle;"><img src="${BANNER_BILD}" width="150" alt="" style="display:block;width:150px;height:auto;" /></td>
              <td style="padding:16px 20px 16px 6px;vertical-align:middle;">
                <div style="font:700 11px/1 ${SCHRIFT};letter-spacing:.12em;text-transform:uppercase;color:#93c5fd;margin-bottom:7px;">Ihr Ziel</div>
                <div style="font:400 13px/1.55 ${SCHRIFT};color:#dbe7fb;">${KARTE_SATZ}</div>
              </td>
            </tr>
          </table>
        </td></tr>` : "";

  const abmelden = b.abmeldeUrl
    ? `<p style="margin:10px 0 0;font:400 12px/1.6 ${SCHRIFT};color:#9ca3af;">Sie möchten diese Hinweise nicht mehr? <a href="${b.abmeldeUrl}" style="color:#9ca3af;">Hier abmelden</a> — ein Klick genügt.</p>` : "";

  return `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="x-apple-disable-message-reformatting" />
<meta name="color-scheme" content="light only" />
<title>${b.titel}</title>
</head>
<body style="margin:0;padding:0;background:#f0f4fa;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;font-size:1px;line-height:1px;color:#f0f4fa;">${b.preheader}&#8203;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;&#847;</div>
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="background:#f0f4fa;background-image:linear-gradient(180deg,#e8effa,#f0f4fa 340px);">
    <tr><td align="center" style="padding:30px 12px 44px;">

      <table role="presentation" cellpadding="0" cellspacing="0" width="600" style="width:600px;max-width:100%;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 6px 28px rgba(15,32,68,.10);">

        <tr><td style="background:${NAVY};background-image:linear-gradient(135deg,#12264f,${NAVY_TIEF});padding:26px 34px;">
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%"><tr>
            <td style="font:700 21px/1 ${SCHRIFT};letter-spacing:.13em;color:#ffffff;">FIAON</td>
            <td align="right" style="font:400 12px/1 ${SCHRIFT};color:#93c5fd;">Bonität ist machbar.</td>
          </tr></table>
        </td></tr>
        ${hero}

        <tr><td style="padding:34px 34px 26px;">
            ${marke}
            <h1 style="margin:0 0 18px;font:700 25px/1.3 ${SCHRIFT};color:${NAVY};letter-spacing:-.01em;">${b.titel}</h1>
            ${absaetze}
            ${leiste}
            ${daten}
            ${knopf}
            ${fussnote}
        </td></tr>
        ${ziel}

        <tr><td style="padding:0 34px;"><div style="height:1px;background:${LINIE};"></div></td></tr>

        <tr><td style="padding:22px 34px 30px;">
          <p style="margin:0 0 10px;font:400 13px/1.6 ${SCHRIFT};color:${LEISE};">
            Fragen? Antworten Sie einfach auf diese E-Mail — sie landet bei Ihrem Ansprechpartner.
          </p>
          <p style="margin:0;font:400 12px/1.6 ${SCHRIFT};color:#9ca3af;">
            FIAON LTD · <a href="${BASIS_URL}" style="color:#9ca3af;">fiaon.com</a> ·
            <a href="${BASIS_URL}/impressum" style="color:#9ca3af;">Impressum</a> ·
            <a href="${BASIS_URL}/datenschutz" style="color:#9ca3af;">Datenschutz</a><br />
            FIAON ist keine Rechtsberatung und verspricht keine Löschung berechtigter Einträge.
          </p>
          ${abmelden}
        </td></tr>

      </table>

      ${b.persoenlich ? "" : `<p style="margin:18px 0 0;font:400 11px/1.5 ${SCHRIFT};color:#9aa7bd;">Diese Nachricht wurde automatisch zu Ihrem Vorgang erstellt.</p>`}
    </td></tr>
  </table>
</body>
</html>`;
}

/**
 * Die Raten-Leiste: „Rate X von 12" als Segmente.
 *
 * Sie steht als %%RATENLEISTE:nr:von%%-Marke im Roh-HTML, weil `nr` meist ein
 * Platzhalter ist ({{params.rate_nr}}): Erst füllt der Motor die Platzhalter,
 * DANN ersetzt `ratenLeisteEinsetzen` die Marke — mit der echten Zahl.
 */
export function ratenLeisteEinsetzen(html: string): string {
  return html.replace(/%%RATENLEISTE:([^:]*):(\d+)%%/g, (_, nrRoh: string, vonRoh: string) => {
    const von = Number(vonRoh) || 12;
    const nr = Math.max(0, Math.min(von, Number(String(nrRoh).replace(/[^0-9]/g, "")) || 0));
    const zellen = Array.from({ length: von }, (_, i) =>
      `<td style="height:10px;border-radius:4px;background:${i < nr ? BLAU_HELL : "#dbe4f0"};"></td>${i < von - 1 ? `<td style="width:5px;"></td>` : ""}`).join("");
    return `<table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="margin:2px 0 6px;"><tr>${zellen}</tr></table>
    <p style="margin:0 0 20px;font:600 13px/1 ${SCHRIFT};color:${LEISE};">Rate ${nr || "?"} von ${von} — jede gezahlte Rate baut Ihre Historie weiter auf.</p>`;
  });
}

/**
 * Der Text-Teil derselben Mail — für Spamfilter und Nur-Text-Leser.
 * Bewusst schlicht: Titel, Absätze, Daten, der Link des Knopfs.
 */
export function mailText(b: MailBaustein): string {
  const ohneTags = (s: string) => s.replace(/<[^>]+>/g, "");
  return [
    "FIAON — Bonität ist machbar.",
    "",
    b.titel.toUpperCase(),
    "",
    ...b.absaetze.map(ohneTags),
    ...(b.daten?.length ? ["", ...b.daten.map((d) => `${d.label}: ${ohneTags(d.wert)}`)] : []),
    ...(b.knopf ? ["", `${b.knopf.text}: ${b.knopf.url}`] : []),
    ...(b.fussnote ? ["", ohneTags(b.fussnote)] : []),
    ...(b.karteZiel ? ["", KARTE_SATZ] : []),
    "",
    "—",
    "FIAON LTD · fiaon.com · Impressum: fiaon.com/impressum · Datenschutz: fiaon.com/datenschutz",
    "FIAON ist keine Rechtsberatung und verspricht keine Löschung berechtigter Einträge.",
    ...(b.abmeldeUrl ? [`Abmelden: ${b.abmeldeUrl}`] : []),
  ].join("\n").replace(/%%RATENLEISTE:[^%]*%%/g, "");
}
